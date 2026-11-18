-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000012_ubs_citopatologico.sql (percurso da UBS,
-- U6, E2: o pedido de exame aceita o citopatológico). Tudo em transação com
-- ROLLBACK; o cenário é criado aqui.
--
-- 1. o médico pede o citopatológico, num pedido só dele (grupo citopatologia);
-- 2. o enfermeiro pede o citopatológico de rastreamento e não o outro;
-- 3. o anatomopatológico (02.03.02) segue fora.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000085a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000085a2'),
  ('cons', '00000000-0000-4000-8000-0000000085a3'),
  ('rec',  '00000000-0000-4000-8000-0000000085b1'),
  ('enf',  '00000000-0000-4000-8000-0000000085b2'),
  ('med',  '00000000-0000-4000-8000-0000000085b3');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@u6c.local' FROM ids WHERE nome IN ('rec', 'enf', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U6 cito');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U6 cito', 'ubs');
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

-- o CI não tem a tabela SIGTAP inteira: os códigos do teste entram aqui (na homologação já existem)
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0203010019', 'EXAME CITOPATOLOGICO CERVICO-VAGINAL/MICROFLORA', '1', 'F', 0, 1560, to_char(now(), 'YYYYMM')),
  ('0203010086', 'EXAME CITOPATOLOGICO CERVICO VAGINAL/MICROFLORA-RASTREAMENTO', '1', 'F', 0, 1560, to_char(now(), 'YYYYMM')),
  ('0203020081', 'EXAME ANATOMO-PATOLOGICO DO COLO UTERINO - BIOPSIA', '1', 'F', 0, 1560, to_char(now(), 'YYYYMM')),
  ('0202020380', 'HEMOGRAMA COMPLETO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'))
ON CONFLICT (codigo) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'med', (public.registrar_ficha(pg_temp.id('cons'), 'Preventivo', NULL,
  '{"nome":"Paciente Cito Medico","data_nascimento":"1985-05-05","sexo":"F","tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'enf', (public.registrar_ficha(pg_temp.id('cons'), 'Preventivo de rotina', NULL,
  '{"nome":"Paciente Cito Enfermagem","data_nascimento":"1980-08-08","sexo":"F","tipo_atendimento":"consulta_programada","destino":"enfermagem"}') ->> 'episodio_id')::uuid;

-- ── 1. o médico ─────────────────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('med'));
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('med'), '[{"procedimento":"0203010019"},{"procedimento":"0202020380"}]')$$,
  'Laboratório, imagem e ECG vão em pedidos separados', '1. citopatológico com hemograma: pedidos separados');
SELECT pg_temp.ok(public.pedir_exames(pg_temp.v('med'), '[{"procedimento":"0203010019"}]') = 1,
  '1. o médico pede o citopatológico');
-- ── 3. anatomopatológico fora ───────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('med'), '[{"procedimento":"0203020081"}]')$$,
  'Exame 0203020081 fora dos grupos de exame do SIGTAP', '3. biópsia do colo (02.03.02) segue fora');
RESET ROLE;
SELECT pg_temp.ok((SELECT grupo = 'citopatologia' AND tipo = 'citopatologia' FROM public.exames_pedidos
                    WHERE episodio_id = pg_temp.v('med') AND procedimento = '0203010019'),
  '1. o pedido fica no grupo e no tipo citopatologia');
SET LOCAL ROLE authenticated;

-- ── 2. o enfermeiro ─────────────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT public.iniciar_atendimento(pg_temp.v('enf'));
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('enf'), '[{"procedimento":"0203010019"}]')$$,
  'Exame fora do protocolo de enfermagem', '2. o enfermeiro não pede o citopatológico diagnóstico');
SELECT pg_temp.ok(public.pedir_exames(pg_temp.v('enf'), '[{"procedimento":"0203010086"}]') = 1,
  '2. o enfermeiro pede o citopatológico de rastreamento (Saúde das Mulheres, p. 175)');
RESET ROLE;
SELECT pg_temp.ok(private.grupo_do_procedimento('0203010086') = 'citopatologia', '2. o grupo do código é citopatologia');

ROLLBACK;
