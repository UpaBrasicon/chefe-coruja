-- Testes da migration 20261123000001_escala_sem_sobreposicao.sql (Portão 2,
-- tarefa 4, R2-07): a mesma pessoa não fica escalada em dois lugares no mesmo
-- horário, em nenhuma unidade e em nenhum papel. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- dia de teste longe do seed (que escala ontem, hoje e amanhã)
CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;
INSERT INTO t VALUES ('dia', (private.data_atual() + 20)::text);
CREATE FUNCTION pg_temp.dia() RETURNS date LANGUAGE sql AS $$ SELECT v::date FROM t WHERE k = 'dia' $$;
GRANT EXECUTE ON FUNCTION pg_temp.dia() TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT v::uuid FROM t WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
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

-- outra unidade (2b)
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('00000000-0000-4000-8000-0000000d4001', '20000000-0000-4000-8000-000000000001', 'UPA Vizinha', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  ('00000000-0000-4000-8000-0000000d4002', '00000000-0000-4000-8000-0000000d4001', 'Clínica Vizinha', 'internacao');

-- 4a. o gestor escala o plantonista na Clínica Médica de manhã; no mesmo
-- horário, no Pronto Socorro, é recusado com o plantão que conflita
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.adicionar_plantao_escala('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', pg_temp.dia(), 'manha');
SELECT pg_temp.falha(format('SELECT public.adicionar_plantao_escala(%L, %L, %L, %L::date, %L)',
  '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', pg_temp.dia(), 'manha'),
  'Conflito: este profissional já está escalado em outro setor', 'tela da escala: mesmo horário em outro setor é recusado');
-- por fora da tela (inserção direta) o gatilho recusa, dizendo com qual plantão
SELECT pg_temp.falha(format($q$INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
  VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', %L, 'manha')$q$, pg_temp.dia()),
  'Escala sobreposta: Plantonista de Teste já está escalado(a) no setor Clínica Médica (Unidade Teste) de 07:00 de ',
  'gravação direta no mesmo horário é recusada, com o plantão que conflita');
-- 3a. encostar não é sobrepor: a tarde começa quando a manhã termina
SELECT public.adicionar_plantao_escala('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000002', pg_temp.dia(), 'tarde');
DO $$ BEGIN RAISE NOTICE 'OK  plantão que só encosta no outro passa'; END $$;
-- 1b. vale para a enfermagem também
SELECT public.adicionar_plantao_escala('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', pg_temp.dia(), 'noite');
SELECT pg_temp.falha(format('SELECT public.adicionar_plantao_escala(%L, %L, %L, %L::date, %L)',
  '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', pg_temp.dia(), 'noite'),
  'Conflito: este profissional', 'enfermagem também não fica em dois setores no mesmo horário (tela)');
SELECT pg_temp.falha(format($q$INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
  VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', %L, 'noite')$q$, pg_temp.dia()),
  'Escala sobreposta: Enfermeira de Teste', 'enfermagem também não fica em dois setores no mesmo horário (gatilho)');
RESET ROLE;

-- 2b. em outra unidade, no mesmo horário, também não (qualquer caminho de gravação)
SELECT pg_temp.falha(format($q$INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
  VALUES ('00000000-0000-4000-8000-0000000d4001', '00000000-0000-4000-8000-0000000d4002', '10000000-0000-4000-8000-000000000002', %L, 'manha')$q$, pg_temp.dia()),
  'Escala sobreposta: Plantonista de Teste já está escalado(a) no setor Clínica Médica (Unidade Teste)',
  'outra unidade no mesmo horário é recusada');
-- outra pessoa no Pronto Socorro de manhã; passar esse plantão para quem já
-- está escalado no horário (passagem, candidatura) trava. Desde a E1
-- (20270202000002), passagem e troca só valem na mesma categoria: a outra pessoa
-- também é plantonista, e o plantão é de plantonista, para chegar à sobreposição.
RESET ROLE;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'plantonista')
ON CONFLICT DO NOTHING;
SET LOCAL ROLE authenticated;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000006', pg_temp.dia(), 'manha', 'plantonista');
SELECT pg_temp.falha(format($q$UPDATE public.escala_plantao SET perfil_id = '10000000-0000-4000-8000-000000000002'
  WHERE setor_id = '22000000-0000-4000-8000-000000000003' AND data = %L AND turno = 'manha'
    AND perfil_id = '10000000-0000-4000-8000-000000000006'$q$, pg_temp.dia()),
  'Escala sobreposta: Plantonista de Teste', 'passar o plantão para quem já está escalado no horário trava');

-- troca de setor no mesmo horário: os dois UPDATEs da troca passam
DO $$
DECLARE a uuid; b uuid;
BEGIN
  SELECT id INTO a FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND data = pg_temp.dia() AND turno = 'manha';
  SELECT id INTO b FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000006' AND data = pg_temp.dia() AND turno = 'manha';
  -- C1 (20270208000001): a troca leva os donos de agora dos dois plantões
  PERFORM private.aplicar_troca(jsonb_populate_record(NULL::public.trocas_plantao, jsonb_build_object(
    'plantao_a_id', a, 'perfil_a_id', '10000000-0000-4000-8000-000000000002',
    'plantao_b_id', b, 'perfil_b_id', '10000000-0000-4000-8000-000000000006')));
  IF (SELECT perfil_id FROM public.escala_plantao WHERE id = a) <> '10000000-0000-4000-8000-000000000006'
     OR (SELECT perfil_id FROM public.escala_plantao WHERE id = b) <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: troca no mesmo horário não aplicou';
  END IF;
  RAISE NOTICE 'OK  troca de setor no mesmo horário passa (a checagem espera os dois lados)';
END $$;

-- 6b. geração do mês: o dia em conflito vira vaga aberta e a resposta diz qual
INSERT INTO public.escala_fixa (unidade_id, setor_id, perfil_id, dia_semana, turno, quinzenal, ativo)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
        EXTRACT(ISODOW FROM pg_temp.dia())::int % 7, 'manha', false, true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'geracao', public.gerar_escala_mensal_detalhada('21000000-0000-4000-8000-000000000001',
  EXTRACT(YEAR FROM pg_temp.dia())::int, EXTRACT(MONTH FROM pg_temp.dia())::int)::text;
RESET ROLE;
DO $$
DECLARE g jsonb := (SELECT v::jsonb FROM t WHERE k = 'geracao');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(g -> 'vagas') x
                  WHERE (x ->> 'data')::date = pg_temp.dia() AND x ->> 'setor' = 'Observação' AND x ->> 'conflito' LIKE 'no setor Pronto Socorro%') THEN
    RAISE EXCEPTION 'FALHOU: conflito do dia não listado: %', g;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.escala_vagas WHERE setor_id = '22000000-0000-4000-8000-000000000002' AND data = pg_temp.dia()
                  AND turno = 'manha' AND fechada_em IS NULL AND observacao LIKE 'Vaga aberta na geração do mês: Plantonista de Teste já estava escalado(a) no setor Pronto Socorro%') THEN
    RAISE EXCEPTION 'FALHOU: o dia em conflito não virou vaga aberta';
  END IF;
  IF (g ->> 'gerados')::int < 1 OR NOT EXISTS (SELECT 1 FROM public.escala_plantao WHERE setor_id = '22000000-0000-4000-8000-000000000002'
        AND perfil_id = '10000000-0000-4000-8000-000000000002' AND turno = 'manha' AND data <> pg_temp.dia()) THEN
    RAISE EXCEPTION 'FALHOU: os outros dias deveriam ter sido gerados: %', g;
  END IF;
  RAISE NOTICE 'OK  geração do mês grava o resto e deixa o conflito como vaga aberta, com a lista';
END $$;
-- gerar de novo não duplica a vaga; a função antiga devolve o número de dias
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'dias', public.gerar_escala_mensal('21000000-0000-4000-8000-000000000001',
  EXTRACT(YEAR FROM pg_temp.dia())::int, EXTRACT(MONTH FROM pg_temp.dia())::int)::text;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT v::int FROM t WHERE k = 'dias') NOT BETWEEN 28 AND 31 THEN RAISE EXCEPTION 'FALHOU: gerar_escala_mensal deveria devolver os dias'; END IF;
  IF (SELECT count(*) FROM public.escala_vagas WHERE setor_id = '22000000-0000-4000-8000-000000000002' AND data = pg_temp.dia()
       AND turno = 'manha' AND fechada_em IS NULL) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: gerar de novo duplicou a vaga';
  END IF;
  RAISE NOTICE 'OK  gerar de novo não duplica a vaga; a função antiga devolve os dias';
END $$;
ROLLBACK;
