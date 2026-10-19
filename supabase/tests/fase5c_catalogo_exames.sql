-- Testes da migration 20261205000001_catalogo_exames.sql (Fase 5C, tarefa 1,
-- etapa 1.1): lista de exames da unidade sobre o grupo 02.02 do SIGTAP; busca;
-- pedido pelo catálogo com urgência e observação; texto livre sem código;
-- pedido impresso ganha código quando o nome bate. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia, valor_sa, valor_sh, valor_sp) VALUES
  ('0202990001', 'HEMOGRAMA COMPLETO TESTE', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 4.11, 0, 0),
  ('0202990002', 'DOSAGEM DE GLICOSE TESTE', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 1.85, 0, 0),
  ('0202990003', 'DOSAGEM DE POTASSIO TESTE', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 1.85, 0, 0),
  ('0301990001', 'CONSULTA TESTE FORA DO LABORATORIO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 10, 0, 0)
ON CONFLICT (codigo) DO NOTHING;
-- médico (…0002), enfermeira (…0004) e recepção (…0005) de plantão agora no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
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

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'a', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  json_build_object('nome', 'Paciente Exames Teste', 'data_nascimento', '1980-04-04')::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('a'), 'verde',
  '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":38.1,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('a'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('a');
SET LOCAL ROLE authenticated;

-- 2a. sem lista da unidade, a busca vai ao grupo 02.02 inteiro (e só a ele)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.buscar_exames('21000000-0000-4000-8000-000000000001', 'hemograma completo teste')) x
                  WHERE x ->> 'procedimento' = '0202990001')
     OR jsonb_array_length(public.buscar_exames('21000000-0000-4000-8000-000000000001', 'consulta teste fora')) <> 0 THEN
    RAISE EXCEPTION 'FALHOU: busca sem lista da unidade';
  END IF;
  RAISE NOTICE 'OK  2a: sem lista, a busca usa o grupo 02.02 do SIGTAP';
END $$;

-- 1a/2a/3a. a lista é do gestor
SELECT pg_temp.falha($$SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990001', 'Hemograma')$$,
  'Acesso negado: a lista de exames é do gestor', 'médico não mexe na lista');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0301990001', 'Consulta')$$,
  'Procedimento 0301990001 não é de laboratório', 'só exame (laboratório, imagem ou método gráfico)');
SELECT pg_temp.falha($$SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990001', 'Hemograma', 'abc')$$,
  'LOINC no formato', 'LOINC com formato conferido');
SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '02.02.99.000-1', 'Hemo', NULL, true, 1);
SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990001', 'Hemograma', '12345-6', true, 1);
SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990002', 'Glicemia', NULL, false, 2);
DO $$
DECLARE l jsonb := public.exames_da_unidade('21000000-0000-4000-8000-000000000001');
BEGIN
  IF jsonb_array_length(l -> 'exames') <> 2 OR l -> 'exames' -> 0 ->> 'nome_curto' <> 'Hemograma'
     OR l -> 'exames' -> 0 ->> 'loinc' <> '12345-6' OR NOT (l -> 'exames' -> 0 ->> 'botao')::boolean OR NOT (l ->> 'pode_definir')::boolean THEN
    RAISE EXCEPTION 'FALHOU: lista da unidade: %', l;
  END IF;
  RAISE NOTICE 'OK  1a/2a/3a: gestor monta a lista com nome curto, LOINC e botão; mudar guarda a versão anterior';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.exames_unidade WHERE procedimento = '0202990001') <> 2
     OR (SELECT count(*) FROM public.exames_unidade WHERE procedimento = '0202990001' AND vigente_ate IS NULL) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: histórico da lista';
  END IF;
END $$;
SET LOCAL ROLE authenticated;

-- com lista, a busca fica nela
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF jsonb_array_length(public.buscar_exames('21000000-0000-4000-8000-000000000001', 'potassio teste')) <> 0
     OR public.buscar_exames('21000000-0000-4000-8000-000000000001', 'glic') -> 0 ->> 'nome' <> 'Glicemia'
     OR jsonb_array_length(public.buscar_exames('21000000-0000-4000-8000-000000000001', 'potassio teste', true)) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: busca na lista da unidade';
  END IF;
  RAISE NOTICE 'OK  2a: com lista, a busca fica nela; a tela do gestor busca no grupo 02.02 inteiro';
END $$;

-- 1a/5a/6a. pedido pelo catálogo, com urgência e observação; texto livre sem código
SELECT pg_temp.falha(format('SELECT public.pedir_exames(%L, %L)', pg_temp.u('a'), '[{"procedimento":"0202990003"}]'),
  'O exame DOSAGEM DE POTASSIO TESTE não está na lista da unidade', 'exame fora da lista da unidade');
SELECT pg_temp.falha(format('SELECT public.pedir_exames(%L, %L, %L)', pg_temp.u('a'), '[{"procedimento":"0202990001"}]', 'agora'),
  'Urgência: rotina ou urgente', 'urgência da lista');
SELECT public.pedir_exames(pg_temp.u('a'), '[{"procedimento":"0202990001"},{"nome":"Pesquisa de dengue NS1"}]', 'urgente', 'febre há 3 dias');
SELECT pg_temp.falha(format('SELECT public.pedir_exames(%L, %L)', pg_temp.u('a'), '[{"procedimento":"0202990001"}]'),
  'Esses exames já estão pedidos', 'o mesmo exame pendente não entra de novo');
DO $$
DECLARE h jsonb; l jsonb; p jsonb := public.painel_atendimento_ps(pg_temp.u('a')) -> 'exames';
BEGIN
  SELECT x INTO h FROM jsonb_array_elements(p) x WHERE x ->> 'procedimento' = '0202990001';
  SELECT x INTO l FROM jsonb_array_elements(p) x WHERE x ->> 'exame' = 'Pesquisa de dengue NS1';
  IF h ->> 'exame' <> 'Hemograma' OR h ->> 'urgencia' <> 'urgente' OR h ->> 'observacao' <> 'febre há 3 dias'
     OR l ->> 'procedimento' IS NOT NULL OR l ->> 'urgencia' <> 'urgente' THEN
    RAISE EXCEPTION 'FALHOU: pedido pelo catálogo: %', p;
  END IF;
  RAISE NOTICE 'OK  1a/5a/6a: pedido com código, nome curto, urgência e observação; texto livre fica sem código';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT loinc FROM public.exames_pedidos WHERE procedimento = '0202990001') <> '12345-6' THEN RAISE EXCEPTION 'FALHOU: LOINC no pedido'; END IF;
END $$;
SET LOCAL ROLE authenticated;
-- o pedido antigo (texto) continua funcionando
SELECT public.pedir_exames_atendimento(pg_temp.u('a'), ARRAY['Ureia']);

-- 5a. pedido impresso: a linha com o nome do catálogo ganha o código
SELECT public.emitir_documento(pg_temp.u('pac'), 'pedido_exames', '{"pedido":{"texto":"- Glicemia\n- Exame raro qualquer"}}');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT procedimento FROM public.exames_pedidos WHERE exame = 'Glicemia' AND documento_id IS NOT NULL) IS DISTINCT FROM '0202990002'
     OR (SELECT procedimento FROM public.exames_pedidos WHERE exame = 'Exame raro qualquer') IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: pedido impresso';
  END IF;
  RAISE NOTICE 'OK  5a: pedido impresso ganha o código só quando o nome bate com o catálogo';
END $$;

-- retirar da lista pede motivo
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.retirar_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990002', 'curto')$$,
  'Diga por que o exame sai da lista', 'retirar pede motivo');
SELECT public.retirar_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990002', 'laboratório parou de fazer');
SELECT pg_temp.falha($$SELECT public.retirar_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990002', 'laboratório parou de fazer')$$,
  'Este exame não está na lista da unidade', 'não retira o que não está');
RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('authenticated', 'public.exames_unidade', 'INSERT') OR has_table_privilege('authenticated', 'public.exames_unidade', 'SELECT')
     OR has_function_privilege('anon', 'public.pedir_exames(uuid, jsonb, text, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.exame_do_catalogo(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: privilégios';
  END IF;
  IF (SELECT count(*) FROM public.log_auditoria WHERE acao LIKE 'exame_unidade_%') <> 4 THEN RAISE EXCEPTION 'FALHOU: auditoria da lista'; END IF;
  RAISE NOTICE 'OK  lista só pelas funções; cada mudança auditada';
END $$;
ROLLBACK;
