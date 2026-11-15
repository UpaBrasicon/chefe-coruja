-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S4: documentos e reenvio offline (migration 20270414000059).
-- 1. D2: tipos com fluxo próprio recusados em emitir_documento, salvar_rascunho
--    e na sincronização.
-- 2. D3: faltas_documento no emitir_documento (todo tipo) e na sincronização.
-- 3. D4: "sem conexão" desmentido por renovação de sessão vai para revisão;
--    sem renovação no período, entra direto; sem vínculo ativo, recusado.
-- Tudo em transação com ROLLBACK, sem depender do seed.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000054a1'),
  ('uni', '00000000-0000-4000-8000-0000000054a2'),
  ('set', '00000000-0000-4000-8000-0000000054a3'),
  ('med', '00000000-0000-4000-8000-0000000054b1'),
  ('pac', '00000000-0000-4000-8000-0000000054c1'),
  ('i1',  '00000000-0000-4000-8000-0000000054d1'),
  ('i2',  '00000000-0000-4000-8000-0000000054d2'),
  ('i3',  '00000000-0000-4000-8000-0000000054d3'),
  ('i4',  '00000000-0000-4000-8000-0000000054d4'),
  ('i5',  '00000000-0000-4000-8000-0000000054d5');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
-- um item de sincronização (documento) e o status devolvido
CREATE FUNCTION pg_temp.sync(p_item text, p_tipo text, p_conteudo text, p_hora timestamptz, p_contato timestamptz)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.sincronizar_registros(jsonb_build_array(jsonb_build_object(
    'id', pg_temp.id(p_item), 'tipo', 'documento', 'hora', p_hora, 'sem_conexao', true, 'ultimo_contato', p_contato,
    'aparelho_id', 'teste-s4',
    'dados', jsonb_build_object('paciente_id', pg_temp.id('pac'), 'tipo', p_tipo, 'conteudo', p_conteudo)))) -> 0 $$;
GRANT EXECUTE ON FUNCTION pg_temp.sync(text, text, text, timestamptz, timestamptz) TO authenticated;

INSERT INTO auth.users (id, email) VALUES (pg_temp.id('med'), 'med@s4.local');
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('med'), 'Médica do S4')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do S4');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA do S4', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('set'), pg_temp.id('uni'), 'Pronto Socorro', 'emergencia');
-- gestor: vê o paciente sem montar o cuidado; a escala abaixo é o caminho da sincronização
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('med'), pg_temp.id('uni'), 'gestor');
INSERT INTO public.pacientes (id, unidade_id, setor_id, nome, data_nascimento)
VALUES (pg_temp.id('pac'), pg_temp.id('uni'), pg_temp.id('set'), 'Paciente do S4', date '1970-01-01');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES (pg_temp.id('uni'), pg_temp.id('set'), pg_temp.id('med'), private.data_atual(), 'manha', now() - interval '3 hours', 720);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('uni') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');

-- ── 1. D2: tipos com fluxo próprio ───────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.emitir_documento(%L, %L, %L)', pg_temp.id('pac'), 'termo_consentimento', '{"termo":{}}'),
  'Este documento tem tela própria', 'emitir_documento recusa o termo');
SELECT pg_temp.falha(format('SELECT public.emitir_documento(%L, %L, %L)', pg_temp.id('pac'), 'sumario_obito', '{"x":1}'),
  'Este documento tem tela própria', 'emitir_documento recusa o sumário de óbito');
SELECT pg_temp.falha(format('SELECT public.salvar_rascunho(%L, %L, %L)', pg_temp.id('pac'), 'termo_consentimento', '{"termo":{}}'),
  'Tipo de documento desconhecido', 'salvar_rascunho não aceita mais o termo');
SELECT pg_temp.ok((SELECT pg_temp.sync('i1', 'parecer', '{"x":1}', now() - interval '10 minutes', now() - interval '20 minutes') ->> 'motivo')
  LIKE 'SYNC_TIPO_PROPRIO%', 'sincronização recusa o parecer');

-- ── 2. D3: faltas em todos os caminhos ───────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.emitir_documento(%L, %L, %L)', pg_temp.id('pac'), 'encaminhamento', '{}'),
  'Falta para emitir', 'emitir_documento confere faltas também no encaminhamento');
SELECT pg_temp.ok((SELECT pg_temp.sync('i2', 'encaminhamento', '{}', now() - interval '10 minutes', now() - interval '20 minutes') ->> 'motivo')
  LIKE 'SYNC_FALTAS%', 'sincronização confere faltas');

-- ── 3. D4: prova do "sem conexão" ────────────────────────────────────────────
SELECT pg_temp.ok((SELECT pg_temp.sync('i3', 'evolucao', 'Evolução sem conexão', now() - interval '10 minutes', now() - interval '40 minutes') ->> 'status')
  = 'gravado', 'sem renovação de sessão no período: entra direto');
RESET ROLE;
INSERT INTO auth.refresh_tokens (token, user_id, revoked, created_at, updated_at)
VALUES ('s4-teste-' || gen_random_uuid(), pg_temp.id('med')::text, false, now() - interval '25 minutes', now() - interval '25 minutes');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok((SELECT pg_temp.sync('i4', 'evolucao', 'Evolução com sessão renovada', now() - interval '10 minutes', now() - interval '40 minutes') ->> 'status')
  = 'em_revisao', 'sessão renovada no período declarado sem conexão: vai para a revisão');

RESET ROLE;
UPDATE public.vinculos SET ativo = false WHERE perfil_id = pg_temp.id('med');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok((SELECT pg_temp.sync('i5', 'evolucao', 'Evolução sem vínculo', now() - interval '10 minutes', now() - interval '20 minutes') ->> 'motivo')
  LIKE 'SYNC_FORA_DO_PLANTAO%', 'sem vínculo ativo com a unidade: recusado');

RESET ROLE;
ROLLBACK;
