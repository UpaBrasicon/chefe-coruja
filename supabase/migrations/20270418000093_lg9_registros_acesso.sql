-- ════════════════════════════════════════════════════════════════════════════
-- LG9, decisões do RT (18/11/2026, docs/regulatorio/LG9-REGISTROS-ACESSO-DIAGNOSTICO.md):
-- registros de acesso à aplicação (Marco Civil, art. 15; Decreto 8.771/2016, art. 13).
--   R1 = D (revista): o log do Auth no banco grava a ação sem o IP, conferido
--       na homologação. O registro vem de um gatilho em auth.sessions, que tem
--       o IP: entrada (sessão aberta), renovação (refreshed_at muda, cerca de
--       1 vez por hora com o app aberto) e saída (sessão apagada). É do
--       servidor; o app não consegue pular. Sem custo novo.
--   R2 = A: guarda de 6 meses. Rotina diária às 03:45 de Brasília (06:45 UTC)
--       apaga o que venceu, menos o que está sob guarda.
--   R3 = A: guarda maior a pedido da autoridade (art. 15, § 2º) e entrega por
--       ordem judicial (art. 15, § 3º), só pelo super admin, com o segundo
--       fator e registro em log_auditoria (inventário do decreto, art. 13, III).
--
-- Expand: cria duas tabelas, quatro funções, um gatilho e um agendamento.
-- Volta: docs/regulatorio/LG9-ROLLBACK-20270418000093.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS private.registros_acesso_aplicacao (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL,
  sessao_id uuid,
  acao text NOT NULL CHECK (acao IN ('entrada', 'renovacao', 'saida')),
  ip inet,
  em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registros_acesso_aplicacao_usuario_idx ON private.registros_acesso_aplicacao (usuario_id, em);
CREATE INDEX IF NOT EXISTS registros_acesso_aplicacao_em_idx ON private.registros_acesso_aplicacao (em);
ALTER TABLE private.registros_acesso_aplicacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.registros_acesso_aplicacao FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.guardas_registros_acesso (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL,
  ate date NOT NULL,
  pedido text NOT NULL CHECK (length(btrim(pedido)) BETWEEN 3 AND 200),
  anotado_por uuid,
  anotado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guardas_registros_acesso_usuario_idx ON private.guardas_registros_acesso (usuario_id, ate);
ALTER TABLE private.guardas_registros_acesso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.guardas_registros_acesso FROM PUBLIC, anon, authenticated;

-- R1: uma linha por entrada, renovação e saída. Nunca derruba a entrada no
-- sistema: um erro aqui vira aviso no log do banco.
CREATE OR REPLACE FUNCTION private.registrar_acesso_aplicacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO private.registros_acesso_aplicacao (usuario_id, sessao_id, acao, ip)
      VALUES (NEW.user_id, NEW.id, 'entrada', NEW.ip);
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.refreshed_at IS DISTINCT FROM OLD.refreshed_at THEN
        INSERT INTO private.registros_acesso_aplicacao (usuario_id, sessao_id, acao, ip)
        VALUES (NEW.user_id, NEW.id, 'renovacao', NEW.ip);
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO private.registros_acesso_aplicacao (usuario_id, sessao_id, acao, ip)
      VALUES (OLD.user_id, OLD.id, 'saida', OLD.ip);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'LG9: registro de acesso não gravado: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.registrar_acesso_aplicacao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lg9_registro_acesso ON auth.sessions;
CREATE TRIGGER lg9_registro_acesso
  AFTER INSERT OR UPDATE OF refreshed_at OR DELETE ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION private.registrar_acesso_aplicacao();

-- R2: apaga o registro com mais de p_meses (nunca menos de 6), menos o de usuário sob guarda.
CREATE OR REPLACE FUNCTION private.apagar_registros_acesso_vencidos(p_meses int DEFAULT 6)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meses int := greatest(coalesce(p_meses, 6), 6);
  n int;
BEGIN
  DELETE FROM private.registros_acesso_aplicacao r
   WHERE r.em < now() - make_interval(months => v_meses)
     AND NOT EXISTS (SELECT 1 FROM private.guardas_registros_acesso g
                      WHERE g.usuario_id = r.usuario_id AND g.ate >= current_date);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    PERFORM private.registrar_auditoria('apagar_registros_acesso_vencidos', 'registros_acesso_aplicacao', NULL, NULL,
      jsonb_build_object('quantidade', n, 'limite', v_meses));
  END IF;
  RETURN n;
END $$;

-- R3: o super admin anota a guarda pedida pela autoridade.
CREATE OR REPLACE FUNCTION public.anotar_guarda_registros_acesso(p_usuario uuid, p_ate date, p_pedido text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint;
BEGIN
  IF private.eh_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Só o super admin anota guarda de registros de acesso.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.exigir_segundo_fator();
  IF p_usuario IS NULL THEN RAISE EXCEPTION 'Diga de qual usuário é a guarda.'; END IF;
  IF p_ate IS NULL OR p_ate <= current_date OR p_ate > current_date + 1830 THEN
    RAISE EXCEPTION 'A guarda vai até uma data futura, de no máximo 5 anos.';
  END IF;
  IF length(btrim(coalesce(p_pedido, ''))) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'Escreva o número ou a referência do pedido da autoridade.';
  END IF;
  INSERT INTO private.guardas_registros_acesso (usuario_id, ate, pedido, anotado_por)
  VALUES (p_usuario, p_ate, btrim(p_pedido), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('anotar_guarda_registros_acesso', 'registros_acesso_aplicacao', p_usuario, NULL,
    jsonb_build_object('perfil_id', p_usuario, 'ordem', btrim(p_pedido)));
  RETURN v_id;
END $$;

-- R3: entrega por ordem judicial. Devolve data, hora, ação e IP do período.
CREATE OR REPLACE FUNCTION public.extrair_registros_acesso(p_usuario uuid, p_de timestamptz, p_ate timestamptz, p_ordem text)
RETURNS TABLE (em timestamptz, acao text, ip text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int;
BEGIN
  IF private.eh_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Só o super admin extrai registros de acesso.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.exigir_segundo_fator();
  IF p_usuario IS NULL OR p_de IS NULL OR p_ate IS NULL OR p_de >= p_ate THEN
    RAISE EXCEPTION 'Diga o usuário e o período (início antes do fim).';
  END IF;
  IF length(btrim(coalesce(p_ordem, ''))) NOT BETWEEN 5 AND 200 THEN
    RAISE EXCEPTION 'Escreva o número da ordem judicial (art. 15, § 3º, do Marco Civil).';
  END IF;
  RETURN QUERY
    SELECT r.em, r.acao, host(r.ip)
      FROM private.registros_acesso_aplicacao r
     WHERE r.usuario_id = p_usuario AND r.em >= p_de AND r.em < p_ate
     ORDER BY r.em, r.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM private.registrar_auditoria('extrair_registros_acesso', 'registros_acesso_aplicacao', p_usuario, NULL,
    jsonb_build_object('perfil_id', p_usuario, 'ordem', btrim(p_ordem), 'quantidade', n));
END $$;

REVOKE ALL ON FUNCTION private.apagar_registros_acesso_vencidos(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.anotar_guarda_registros_acesso(uuid, date, text),
  public.extrair_registros_acesso(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anotar_guarda_registros_acesso(uuid, date, text),
  public.extrair_registros_acesso(uuid, timestamptz, timestamptz, text) TO authenticated;

-- idempotente: o pg_cron atualiza o agendamento de mesmo nome
SELECT cron.schedule('lg9-registros-acesso-6-meses', '45 6 * * *', 'SELECT private.apagar_registros_acesso_vencidos(6);');
