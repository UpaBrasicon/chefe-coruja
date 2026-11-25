-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000010_ubs_exames_enfermeiro.sql (percurso da
-- UBS, U6, lista de exames do enfermeiro, P1 = A). Tudo em transação com
-- ROLLBACK; o cenário é criado aqui.
--
-- 1. o enfermeiro pede exame da lista do protocolo na consulta de enfermagem;
-- 2. fora da lista (TSH, mamografia, ECG, hepatite C da gestante, HIV da
--    população geral) e texto livre, recusa;
-- 3. o médico segue pedindo qualquer exame, inclusive na ficha da enfermagem.
-- A lista da tela é conferida com a do banco em src/lib/telaUbsExames.test.ts.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000081a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000081a2'),
  ('cons', '00000000-0000-4000-8000-0000000081a3'),
  ('rec',  '00000000-0000-4000-8000-0000000081b1'),
  ('enf',  '00000000-0000-4000-8000-0000000081b2'),
  ('med',  '00000000-0000-4000-8000-0000000081b3');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@u6x.local' FROM ids WHERE nome IN ('rec', 'enf', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U6 exames');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U6 exames', 'ubs');
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
INSERT INTO v SELECT 'enf', (public.registrar_ficha(pg_temp.id('cons'), 'Pré-natal: exames do 1º trimestre', NULL,
  '{"nome":"Gestante Exames","data_nascimento":"1995-03-03","sexo":"F","tipo_atendimento":"consulta_programada","destino":"enfermagem"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'enf2', (public.registrar_ficha(pg_temp.id('cons'), 'Diabetes: exames de controle', NULL,
  '{"nome":"Paciente Exames Dois","data_nascimento":"1958-08-08","tipo_atendimento":"consulta_programada","destino":"enfermagem"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'med', (public.registrar_ficha(pg_temp.id('cons'), 'Cansaço', NULL,
  '{"nome":"Paciente Exames Medico","data_nascimento":"1970-06-06","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;

SELECT pg_temp.como('enf');
SELECT public.iniciar_atendimento(pg_temp.v('enf'));

-- ── 1. da lista ─────────────────────────────────────────────────────────────
SELECT pg_temp.ok(public.pedir_exames(pg_temp.v('enf'),
  '[{"procedimento":"0202020380"},{"procedimento":"0202031179"},{"procedimento":"0202030768"}]') = 3,
  '1. o enfermeiro pede hemograma, sífilis em gestante e toxoplasmose IgG');
SELECT pg_temp.ok(public.pedir_exames(pg_temp.v('enf'), '[{"procedimento":"0202020355"}]') = 1,
  '1. o enfermeiro pede a eletroforese de hemoglobina (C3)');

-- ── 2. fora da lista ────────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('enf'), '[{"procedimento":"0202060250"}]')$$,
  'Exame fora do protocolo de enfermagem', '2. TSH fora da lista, recusa');
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('enf'), '[{"procedimento":"0204030188"}]')$$,
  'Exame fora do protocolo de enfermagem', '2. mamografia fora da lista, recusa');
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('enf'), '[{"procedimento":"0211020036"}]')$$,
  'Exame fora do protocolo de enfermagem', '2. ECG fora da lista, recusa');
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('enf'), '[{"nome":"Hemoglobina glicada","grupo":"laboratorio"}]')$$,
  'Na consulta de enfermagem o exame sai da lista do protocolo', '2. texto livre, recusa');
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('enf'), '[{"procedimento":"0202031489"}]')$$,
  'Exame fora do protocolo de enfermagem', '2. hepatite C em gestante não é rotina (C1), recusa');
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('enf'), '[{"procedimento":"0202031500"}]')$$,
  'Exame fora do protocolo de enfermagem', '2. HIV da população geral fica com o teste rápido (C2), recusa');
-- um item fora da lista derruba o pedido inteiro
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('enf'), '[{"procedimento":"0202010317"},{"procedimento":"0202010120"}]')$$,
  'Exame fora do protocolo de enfermagem', '2. creatinina com ácido úrico: o pedido inteiro volta');

SELECT public.iniciar_atendimento(pg_temp.v('enf2'));
SELECT pg_temp.ok(public.pedir_exames(pg_temp.v('enf2'),
  '[{"procedimento":"0202010503"},{"procedimento":"0202010317"},{"procedimento":"0202050092"}]') = 3,
  '1. o enfermeiro pede HbA1c, creatinina e microalbumina no hiperdia');

-- ── 3. o médico ─────────────────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('med'));
SELECT pg_temp.ok(public.pedir_exames(pg_temp.v('med'), '[{"procedimento":"0202060250"},{"procedimento":"0202010120"}]') = 2,
  '3. o médico pede TSH e ácido úrico');
SELECT pg_temp.ok(public.pedir_exames(pg_temp.v('enf'), '[{"nome":"Exame pedido pelo médico","grupo":"laboratorio"}]') = 1,
  '3. o médico pede texto livre na ficha da enfermagem');
RESET ROLE;

SELECT pg_temp.ok((SELECT count(*) = 7 FROM public.exames_pedidos
                    WHERE episodio_id IN (pg_temp.v('enf'), pg_temp.v('enf2')) AND pedido_por = pg_temp.id('enf')),
  '1. ficam os sete exames da lista pedidos pelo enfermeiro');

ROLLBACK;
