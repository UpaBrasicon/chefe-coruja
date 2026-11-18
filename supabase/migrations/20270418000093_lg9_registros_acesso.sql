-- ════════════════════════════════════════════════════════════════════════════
-- LG9, decisões R1–R3 = A do RT (18/11/2026,
-- docs/regulatorio/LG9-REGISTROS-ACESSO-DIAGNOSTICO.md): registros de acesso
-- à aplicação (Marco Civil, art. 15; Decreto 8.771/2016, art. 13).
--   R1: a fonte é o log de auditoria do Auth no banco (auth.audit_log_entries),
--       religado no painel pelo RT. Esta migration não liga nada no Auth.
--   R2: guarda de 6 meses. Rotina diária às 03:45 de Brasília (06:45 UTC)
--       apaga o que venceu, menos o que está sob guarda.
--   R3: guarda maior a pedido da autoridade (art. 15, § 2º) e entrega por
--       ordem judicial (art. 15, § 3º), só pelo super admin, com o segundo
--       fator e registro em log_auditoria (inventário do decreto, art. 13, III).
--
-- Expand: cria uma tabela, três funções e um agendamento; não muda coluna.
-- Volta: docs/regulatorio/LG9-ROLLBACK-20270418000093.sql
-- ════════════════════════════════════════════════════════════════════════════

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

-- R2: apaga o registro de acesso com mais de p_meses, menos o de usuário sob guarda.
CREATE OR REPLACE FUNCTION private.apagar_registros_acesso_vencidos(p_meses int DEFAULT 6)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_corte timestamptz := now() - make_interval(months => greatest(coalesce(p_meses, 6), 6));
  n int;
BEGIN
  DELETE FROM auth.audit_log_entries e
   WHERE e.created_at < v_corte
     AND NOT EXISTS (SELECT 1 FROM private.guardas_registros_acesso g
                      WHERE g.usuario_id::text = e.payload ->> 'actor_id' AND g.ate >= current_date);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    PERFORM private.registrar_auditoria('apagar_registros_acesso_vencidos', 'auth.audit_log_entries', NULL, NULL,
      jsonb_build_object('quantidade', n, 'limite', greatest(coalesce(p_meses, 6), 6)));
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
  PERFORM private.registrar_auditoria('anotar_guarda_registros_acesso', 'auth.audit_log_entries', p_usuario, NULL,
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
    SELECT e.created_at, e.payload ->> 'action', nullif(e.ip_address, '')::text
      FROM auth.audit_log_entries e
     WHERE e.payload ->> 'actor_id' = p_usuario::text
       AND e.created_at >= p_de AND e.created_at < p_ate
     ORDER BY e.created_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM private.registrar_auditoria('extrair_registros_acesso', 'auth.audit_log_entries', p_usuario, NULL,
    jsonb_build_object('perfil_id', p_usuario, 'ordem', btrim(p_ordem), 'quantidade', n));
END $$;

REVOKE ALL ON FUNCTION private.apagar_registros_acesso_vencidos(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.anotar_guarda_registros_acesso(uuid, date, text),
  public.extrair_registros_acesso(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anotar_guarda_registros_acesso(uuid, date, text),
  public.extrair_registros_acesso(uuid, timestamptz, timestamptz, text) TO authenticated;

-- idempotente: o pg_cron atualiza o agendamento de mesmo nome
SELECT cron.schedule('lg9-registros-acesso-6-meses', '45 6 * * *', 'SELECT private.apagar_registros_acesso_vencidos(6);');
