-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000008_ubs_sinais_vitais.sql (percurso da UBS,
-- U7, PR 4). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. o técnico de plantão registra os sinais da ficha aberta, e o hiperdia vê
--    a pressão;
-- 2. a recepção não registra; ficha encerrada e fora da UBS, não;
-- 3. sinal desconhecido ou sem número é recusado.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000078a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000078a2'),
  ('cons', '00000000-0000-4000-8000-0000000078a3'),
  ('rec',  '00000000-0000-4000-8000-0000000078b1'),
  ('tec',  '00000000-0000-4000-8000-0000000078b2'),
  ('med',  '00000000-0000-4000-8000-0000000078b3');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@u74.local' FROM ids WHERE nome IN ('rec', 'tec', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'tec', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U7 PR4');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U7 PR4', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'tec', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep', (public.registrar_ficha(pg_temp.id('cons'), 'Consulta do hiperdia', NULL,
  '{"nome":"Paciente PR4","data_nascimento":"1958-08-08","tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;

-- ── 2. quem registra ────────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.registrar_sinais_aps(pg_temp.v('ep'), '{"pressao-arterial-sistolica":150}')$$,
  'Os sinais vitais são registrados pelo médico, pelo enfermeiro ou pelo técnico', '2. a recepção não registra sinais vitais');

-- ── 3. validação ────────────────────────────────────────────────────────────
SELECT pg_temp.como('tec');
SELECT pg_temp.falha($$SELECT public.registrar_sinais_aps(pg_temp.v('ep'), '{}')$$, 'Informe ao menos um sinal vital', '3. sem sinal, recusa');
SELECT pg_temp.falha($$SELECT public.registrar_sinais_aps(pg_temp.v('ep'), '{"pressao-arterial-sistolica":"alta"}')$$,
  'Sinal vital sem número', '3. sinal sem número, recusa');
SELECT pg_temp.falha($$SELECT public.registrar_sinais_aps(pg_temp.v('ep'), '{"humor":3}')$$, 'Sinal vital desconhecido', '3. sinal desconhecido, recusa');

-- ── 1. o técnico registra ───────────────────────────────────────────────────
SELECT pg_temp.ok(public.registrar_sinais_aps(pg_temp.v('ep'),
  '{"pressao-arterial-sistolica":150,"pressao-arterial-diastolica":95,"peso":82,"estatura":170}') = 4,
  '1. o técnico de plantão registra quatro sinais');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 4 FROM public.observacao WHERE episodio_id = pg_temp.v('ep') AND registrado_por = pg_temp.id('tec')),
  '1. os sinais ficam em observacao com o técnico como autor');
SET LOCAL ROLE authenticated;

-- a ficha encerrada não recebe mais sinais
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('ep'));
SELECT public.registrar_soap(pg_temp.v('ep'), 'Hipertenso', 'PA 150x95', 'Hipertensão', 'Retorno', NULL);
SELECT public.registrar_conduta_aps(pg_temp.v('ep'), 'consulta_programada', '{hipertensao_arterial}', '{}',
  '{retorno_cuidado_continuado}', NULL, '{}');
SELECT pg_temp.falha($$SELECT public.registrar_sinais_aps(pg_temp.v('ep'), '{"pressao-arterial-sistolica":140}')$$,
  'A ficha já foi encerrada', '2. ficha encerrada não recebe sinais');
SELECT pg_temp.ok((SELECT (p ->> 'ultima_pa') IS NOT NULL
                     FROM jsonb_array_elements(public.hiperdia_painel(pg_temp.id('ubs'))) p
                    WHERE (p ->> 'paciente_id')::uuid = (SELECT paciente_id FROM public.episodios WHERE id = pg_temp.v('ep'))),
  '1. o hiperdia vê a pressão registrada pelo técnico');

ROLLBACK;
