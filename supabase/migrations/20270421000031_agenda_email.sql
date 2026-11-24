-- ════════════════════════════════════════════════════════════════════════════
-- Agenda do administrador, e-mail aos convidados (pedido do RT, 24/11/2026).
-- A migration 20270421000030 avisava só no app; agora o mesmo aviso também
-- vai por e-mail, pela Edge Function avisar-reuniao (Resend).
--
-- • private.reuniao_emails: a fila. private.reuniao_avisar (o mesmo ponto que
--   grava o aviso no app) põe uma linha por pessoa e evento (convite, alterada,
--   cancelada, retirado). Quem decide quem recebe o quê é o banco: a tela só
--   diz qual reunião acabou de salvar ou cancelar.
-- • public.reuniao_emails_reservar(reuniao, quem, evento): só service_role. Confere
--   que quem chama é quem marcou (quem = NULL quando é o próprio serviço),
--   reserva as linhas pendentes por 2 minutos e devolve a reunião e o e-mail de
--   cada pessoa. O e-mail sai do banco só para a função, nunca para o navegador.
-- • public.reuniao_emails_concluir(ids, situacao): só service_role. Anota
--   enviado, sem_email, descartado ou falhou (falhou volta para a fila, até 3
--   tentativas; pendente com mais de 2 dias é descartado).
--
-- Expand: tabela e funções novas; private.reuniao_avisar ganha só a inclusão
-- na fila no fim (o aviso no app não muda). Idempotente.
-- Volta: docs/agenda/ROLLBACK-20270421000031.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── a fila ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.reuniao_emails (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reuniao_id    uuid NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  perfil_id     uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  evento        text NOT NULL CHECK (evento IN ('convite', 'alterada', 'cancelada', 'retirado')),
  situacao      text NOT NULL DEFAULT 'pendente'
                CHECK (situacao IN ('pendente', 'enviado', 'sem_email', 'descartado', 'falhou')),
  tentativas    smallint NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT clock_timestamp(),
  reservado_em  timestamptz,
  concluido_em  timestamptz
);
COMMENT ON TABLE private.reuniao_emails IS
  'Agenda do administrador: fila do e-mail aos convidados (Edge Function avisar-reuniao). Uma linha por pessoa e evento; sem o e-mail, que é lido de auth.users na hora do envio.';
CREATE INDEX IF NOT EXISTS reuniao_emails_fila ON private.reuniao_emails (reuniao_id, situacao);
CREATE INDEX IF NOT EXISTS reuniao_emails_perfil ON private.reuniao_emails (perfil_id);

ALTER TABLE private.reuniao_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.reuniao_emails FROM PUBLIC, anon, authenticated;

-- ── o aviso no app passa a pôr o e-mail na fila ────────────────────────────
-- Igual à 20270421000030, com a inclusão na fila no fim (só pessoas da
-- organização, como o aviso no app).
CREATE OR REPLACE FUNCTION private.reuniao_avisar(p_reuniao uuid, p_perfis uuid[], p_acao text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.reunioes%ROWTYPE;
  v_quem text;
  v_quando text;
  v_onde text;
  v_msg text;
  v_tipo text;
  x record;
BEGIN
  IF p_perfis IS NULL OR cardinality(p_perfis) = 0 THEN RETURN; END IF;
  SELECT * INTO r FROM public.reunioes WHERE id = p_reuniao;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT coalesce(nullif(btrim(p.nome_completo), ''), 'a administração') INTO v_quem
    FROM public.perfis p WHERE p.id = r.criado_por;
  v_quando := to_char(r.inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || ', das '
           || to_char(r.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' às '
           || to_char(r.fim AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' (horário de Brasília)';
  v_onde := CASE WHEN r.link IS NULL THEN '' ELSE '. ' || private.plataforma_reuniao(r.link) || ': ' || r.link END;
  v_msg := CASE p_acao
    WHEN 'convite'   THEN 'Convite para reunião: ' || r.titulo || ', ' || v_quando || v_onde || '. Marcada por ' || coalesce(v_quem, 'a administração') || '.'
    WHEN 'alterada'  THEN 'Reunião alterada: ' || r.titulo || ', agora ' || v_quando || v_onde || '.'
    WHEN 'cancelada' THEN 'Reunião cancelada: ' || r.titulo || ', que seria em ' || v_quando || '.'
    WHEN 'retirado'  THEN 'Você não está mais na lista da reunião ' || r.titulo || ', de ' || v_quando || '.'
  END;
  IF v_msg IS NULL THEN RETURN; END IF;
  v_tipo := 'reuniao_' || p_acao || '_' || r.id::text || '_' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text;
  FOR x IN
    SELECT DISTINCT v.perfil_id, v.unidade_id
      FROM public.vinculos v
      JOIN public.unidades u ON u.id = v.unidade_id
     WHERE v.perfil_id = ANY (p_perfis) AND v.ativo AND u.ativo AND u.organizacao_id = r.organizacao_id
  LOOP
    PERFORM private.avisar(x.perfil_id, x.unidade_id, NULL, v_tipo, v_msg);
  END LOOP;

  -- e-mail (Edge Function avisar-reuniao): uma linha por pessoa
  INSERT INTO private.reuniao_emails (reuniao_id, perfil_id, evento)
  SELECT DISTINCT r.id, v.perfil_id, p_acao
    FROM public.vinculos v
    JOIN public.unidades u ON u.id = v.unidade_id
   WHERE v.perfil_id = ANY (p_perfis) AND v.ativo AND u.ativo AND u.organizacao_id = r.organizacao_id;
END $$;
REVOKE ALL ON FUNCTION private.reuniao_avisar(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;

-- ── reservar o que falta enviar (só a função, com a chave de serviço) ──────
CREATE OR REPLACE FUNCTION public.reuniao_emails_reservar(p_reuniao uuid, p_quem uuid DEFAULT NULL, p_evento text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.reunioes%ROWTYPE;
  v_pendentes jsonb;
BEGIN
  SELECT * INTO r FROM public.reunioes WHERE id = p_reuniao;
  IF NOT FOUND OR (p_quem IS NOT NULL AND r.criado_por <> p_quem) THEN
    RAISE EXCEPTION 'Reunião não encontrada.' USING ERRCODE = '42501';
  END IF;
  IF p_evento IS NOT NULL AND p_evento NOT IN ('convite', 'alterada', 'cancelada', 'retirado') THEN
    RAISE EXCEPTION 'Evento inválido.';
  END IF;

  -- velho demais para ainda fazer sentido
  UPDATE private.reuniao_emails
     SET situacao = 'descartado', concluido_em = clock_timestamp()
   WHERE reuniao_id = p_reuniao AND situacao IN ('pendente', 'falhou') AND criado_em < now() - interval '2 days';

  WITH livres AS (
    SELECT e.id FROM private.reuniao_emails e
     WHERE e.reuniao_id = p_reuniao
       AND e.situacao IN ('pendente', 'falhou') AND e.tentativas < 3
       AND (e.reservado_em IS NULL OR e.reservado_em < now() - interval '2 minutes')
       AND (p_evento IS NULL OR e.evento = p_evento)
     ORDER BY e.id
     FOR UPDATE SKIP LOCKED
  ), reservadas AS (
    UPDATE private.reuniao_emails e
       SET reservado_em = clock_timestamp(), tentativas = e.tentativas + 1
      FROM livres WHERE e.id = livres.id
    RETURNING e.id, e.perfil_id, e.evento
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'perfil_id', x.perfil_id, 'evento', x.evento,
           'nome', p.nome_completo,
           -- contas de teste (.local) e contas apagadas ficam sem e-mail
           'email', (SELECT au.email FROM auth.users au
                      WHERE au.id = x.perfil_id AND au.deleted_at IS NULL
                        AND au.email IS NOT NULL AND au.email NOT ILIKE '%.local'))
         ORDER BY x.id), '[]'::jsonb)
    INTO v_pendentes
    FROM reservadas x
    LEFT JOIN public.perfis p ON p.id = x.perfil_id;

  RETURN jsonb_build_object(
    'reuniao', jsonb_build_object(
      'titulo', r.titulo, 'inicio', r.inicio, 'fim', r.fim, 'link', r.link,
      'plataforma', private.plataforma_reuniao(r.link), 'pauta', r.pauta,
      'cancelada', r.cancelada_em IS NOT NULL,
      'criador_nome', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = r.criado_por)),
    'pendentes', v_pendentes);
END $$;

-- ── anotar o resultado ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reuniao_emails_concluir(p_ids bigint[], p_situacao text)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  n integer;
BEGIN
  IF p_situacao NOT IN ('enviado', 'sem_email', 'descartado', 'falhou') THEN
    RAISE EXCEPTION 'Situação inválida.';
  END IF;
  UPDATE private.reuniao_emails
     SET situacao = p_situacao,
         concluido_em = CASE WHEN p_situacao = 'falhou' THEN NULL ELSE clock_timestamp() END,
         -- falhou: volta para a fila na próxima chamada (até 3 tentativas)
         reservado_em = CASE WHEN p_situacao = 'falhou' THEN NULL ELSE reservado_em END
   WHERE id = ANY (coalesce(p_ids, '{}'::bigint[])) AND situacao IN ('pendente', 'falhou');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.reuniao_emails_reservar(uuid, uuid, text), public.reuniao_emails_concluir(bigint[], text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reuniao_emails_reservar(uuid, uuid, text), public.reuniao_emails_concluir(bigint[], text)
  TO service_role;
