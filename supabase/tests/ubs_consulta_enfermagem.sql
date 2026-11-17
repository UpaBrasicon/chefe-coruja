-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000007_ubs_consulta_enfermagem.sql (percurso da
-- UBS, U6, PR 3). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. o enfermeiro atende a ficha da enfermagem: inicia, registra o SOAP e
--    fecha pela conduta da UBS; a consulta conta no hiperdia;
-- 2. o enfermeiro não atende a ficha do médico;
-- 3. o pedido de exame na consulta de enfermagem sai da lista do protocolo
--    (texto livre recusado; a lista é testada em ubs_exames_enfermeiro.sql).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000077a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000077a2'),
  ('cons', '00000000-0000-4000-8000-0000000077a3'),
  ('rec',  '00000000-0000-4000-8000-0000000077b1'),
  ('enf',  '00000000-0000-4000-8000-0000000077b2'),
  ('med',  '00000000-0000-4000-8000-0000000077b3');
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u63.local' FROM ids WHERE nome IN ('rec', 'enf', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U6 PR3');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U6 PR3', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'enf', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'enf', (public.registrar_ficha(pg_temp.id('cons'), 'Renovar acompanhamento da pressão', NULL,
  '{"nome":"Paciente PR3 Enfermagem","data_nascimento":"1960-05-05","tipo_atendimento":"consulta_programada","destino":"enfermagem"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'med', (public.registrar_ficha(pg_temp.id('cons'), 'Dor lombar', NULL,
  '{"nome":"Paciente PR3 Medico","data_nascimento":"1970-06-06","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;

-- ── 2. o enfermeiro não atende a ficha do médico ────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha($$SELECT public.iniciar_atendimento(pg_temp.v('med'))$$, 'O atendimento é do médico',
  '2. o enfermeiro não inicia a ficha do médico');

-- ── 1. consulta de enfermagem ───────────────────────────────────────────────
SELECT public.iniciar_atendimento(pg_temp.v('enf'));
SELECT public.registrar_soap(pg_temp.v('enf'), 'Hipertensa, sem queixas', 'PA 142x90', 'Hipertensão em acompanhamento',
  'Orientação e retorno', NULL);

-- ── 3. exame: só da lista do protocolo (20270415000010) ─────────────────────
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('enf'), '[{"nome":"Hemoglobina glicada (HbA1c)"}]')$$,
  'Na consulta de enfermagem o exame sai da lista do protocolo', '3. o enfermeiro não pede exame em texto livre');

SELECT public.registrar_conduta_aps(pg_temp.v('enf'), 'consulta_programada', '{hipertensao_arterial}', '{}',
  '{retorno_cuidado_continuado}', 'Retorno em 30 dias', '{}');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND conduta_aps IS NOT NULL AND desfecho_por = pg_temp.id('enf')
                     FROM public.episodios WHERE id = pg_temp.v('enf')),
  '1. o enfermeiro fecha a consulta pela conduta da UBS');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.programa_participantes
                           WHERE paciente_id = (SELECT paciente_id FROM public.episodios WHERE id = pg_temp.v('enf'))),
  '1. a consulta de enfermagem conta no hiperdia');
SET LOCAL ROLE authenticated;

-- o médico continua atendendo qualquer ficha
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('med'));
RESET ROLE;
SELECT pg_temp.ok((SELECT atendimento_iniciado_em IS NOT NULL FROM public.episodios WHERE id = pg_temp.v('med')),
  '2. o médico segue atendendo a ficha dele');

ROLLBACK;
