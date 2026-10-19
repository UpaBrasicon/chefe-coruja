-- Testes da migration 20261207000001_api_laboratorio.sql (Fase 5C, tarefa 1,
-- etapa 1.3): chave com recurso laboratorio; pedidos como ServiceRequest;
-- coleta; laudo preliminar, final, reenvio e corrigido; cancelamento pelo
-- laboratório; exame não pedido recusado; registro de cada chamada. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
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
  json_build_object('nome', 'Paciente Laboratorio Teste', 'data_nascimento', '1980-04-04')::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('a'), 'verde',
  '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":38.1,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('a'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('a');
UPDATE public.pacientes SET prontuario = 'LAB-1' WHERE id = pg_temp.u('pac');
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia, valor_sa, valor_sh, valor_sp) VALUES
  ('0202990011', 'HEMOGRAMA COMPLETO TESTE LIS', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 4.11, 0, 0),
  ('0202990012', 'DOSAGEM DE POTASSIO TESTE LIS', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 1.85, 0, 0)
ON CONFLICT (codigo) DO NOTHING;
-- chaves: uma com o recurso laboratorio, outra sem
INSERT INTO public.api_chaves (nome, ambiente, prefixo, hash, unidades, recursos, criada_por, expira_em) VALUES
  ('LIS de teste', 'test', 'cc_test_abababab', private.api_hash('cc_test_' || repeat('ab', 24)), ARRAY['21000000-0000-4000-8000-000000000001']::uuid[],
   ARRAY['laboratorio'], '10000000-0000-4000-8000-000000000001', now() + interval '1 month'),
  ('Leitura de teste', 'test', 'cc_test_cdcdcdcd', private.api_hash('cc_test_' || repeat('cd', 24)), ARRAY['21000000-0000-4000-8000-000000000001']::uuid[],
   ARRAY['pacientes'], '10000000-0000-4000-8000-000000000001', now() + interval '1 month');
CREATE FUNCTION pg_temp.lab(p_acao text, p_dados jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.api_v1_laboratorio('cc_test_' || repeat('ab', 24), '10.0.0.1', 'req-teste', p_acao, p_dados) $$;
CREATE FUNCTION pg_temp.ex(p text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.exames_pedidos WHERE episodio_id = (SELECT valor::uuid FROM t WHERE nome = 'a') AND exame = p $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.pedir_exames(pg_temp.u('a'), '[{"procedimento":"0202990011"},{"procedimento":"0202990012"},{"nome":"Exame livre qualquer"}]', 'urgente', 'paciente em jejum');
RESET ROLE;
INSERT INTO t SELECT 'hemo', id::text FROM public.exames_pedidos WHERE procedimento = '0202990011';
INSERT INTO t SELECT 'pota', id::text FROM public.exames_pedidos WHERE procedimento = '0202990012';

-- 1a. a chave precisa do recurso laboratorio
DO $$ BEGIN
  IF (public.api_v1_laboratorio('cc_test_' || repeat('cd', 24), NULL, 'r', 'pedidos', '{}') ->> 'status')::int <> 403
     OR (public.api_v1_laboratorio('cc_test_' || repeat('ef', 24), NULL, 'r', 'pedidos', '{}') ->> 'status')::int <> 401 THEN
    RAISE EXCEPTION 'FALHOU: escopo da chave';
  END IF;
  RAISE NOTICE 'OK  1a: só chave com o recurso laboratorio entra; chave inexistente é recusada';
END $$;

-- 2a/3a. pedidos pendentes com código, como ServiceRequest com o paciente contido
DO $$
DECLARE r jsonb := pg_temp.lab('pedidos', '{}'); s jsonb; p jsonb;
BEGIN
  IF (r ->> 'status')::int <> 200 THEN RAISE EXCEPTION 'FALHOU: pedidos: %', r; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'corpo' -> 'pedidos') x WHERE x -> 'code' ->> 'text' = 'Exame livre qualquer') THEN
    RAISE EXCEPTION 'FALHOU: texto livre não sai para o laboratório';
  END IF;
  SELECT x INTO s FROM jsonb_array_elements(r -> 'corpo' -> 'pedidos') x WHERE (x ->> 'id')::uuid = pg_temp.u('hemo');
  p := s -> 'contained' -> 0;
  IF s ->> 'resourceType' <> 'ServiceRequest' OR s ->> 'priority' <> 'urgent' OR s -> 'code' -> 'coding' -> 0 ->> 'code' <> '0202990011'
     OR s -> 'note' -> 0 ->> 'text' <> 'paciente em jejum' OR p ->> 'resourceType' <> 'Patient' OR p -> 'name' -> 0 ->> 'text' <> 'Paciente Laboratorio Teste'
     OR p ->> 'birthDate' <> '1980-04-04' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'identifier') i WHERE i ->> 'value' = 'LAB-1') THEN
    RAISE EXCEPTION 'FALHOU: ServiceRequest: %', s;
  END IF;
  RAISE NOTICE 'OK  2a/3a: pedidos com código saem como ServiceRequest (urgência, observação, paciente com nome, nascimento e prontuário)';
END $$;

-- 4a. coleta pelo laboratório
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.lab('coleta', jsonb_build_object('exame_id', pg_temp.u('hemo'), 'coletado_em', now() - interval '10 minutes'));
  IF (r ->> 'status')::int <> 200 OR (SELECT situacao FROM public.exames_pedidos WHERE id = pg_temp.u('hemo')) <> 'coletado' THEN
    RAISE EXCEPTION 'FALHOU: coleta: %', r;
  END IF;
  r := pg_temp.lab('coleta', jsonb_build_object('exame_id', pg_temp.u('hemo'), 'coletado_em', now()));
  IF (r ->> 'status')::int <> 200 OR (SELECT coletado_em FROM public.exames_pedidos WHERE id = pg_temp.u('hemo')) > now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'FALHOU: coleta repetida mudou a hora';
  END IF;
  IF (pg_temp.lab('coleta', jsonb_build_object('exame_id', pg_temp.u('pota'), 'coletado_em', now() + interval '1 hour')) ->> 'status')::int <> 400
     OR (pg_temp.lab('coleta', jsonb_build_object('exame_id', gen_random_uuid())) ->> 'status')::int <> 404
     OR (pg_temp.lab('coleta', '{"exame_id":"nao-e-uuid"}') ->> 'status')::int <> 400 THEN
    RAISE EXCEPTION 'FALHOU: coleta inválida';
  END IF;
  RAISE NOTICE 'OK  4a: laboratório marca a coleta com a hora; reenvio não muda; hora futura e exame inexistente recusados';
END $$;

-- laudo preliminar põe em análise; final grava a versão; reenvio igual não duplica
DO $$
DECLARE r jsonb; itens jsonb := '[{"analito":"Hemoglobina","valor":"6,9","unidade":"g/dL","referencia":"12,0 a 16,0","marca":"LL","critico":true}]';
BEGIN
  r := pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.u('hemo'), 'status', 'preliminary', 'identificador', 'LAB-9'));
  IF (SELECT situacao FROM public.exames_pedidos WHERE id = pg_temp.u('hemo')) <> 'em_analise' THEN RAISE EXCEPTION 'FALHOU: em análise: %', r; END IF;
  r := pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.u('hemo'), 'status', 'final', 'identificador', 'LAB-9',
         'itens', itens, 'conteudo_hash', 'h1'));
  IF (r ->> 'status')::int <> 200 OR (r -> 'corpo' ->> 'versao')::int <> 1
     OR NOT (SELECT critico FROM public.exames_pedidos WHERE id = pg_temp.u('hemo')) THEN
    RAISE EXCEPTION 'FALHOU: laudo final: %', r;
  END IF;
  r := pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.u('hemo'), 'status', 'final', 'identificador', 'LAB-9',
         'itens', itens, 'conteudo_hash', 'h1'));
  IF NOT (r -> 'corpo' ->> 'repetido')::boolean OR (SELECT count(*) FROM public.exame_resultados WHERE exame_id = pg_temp.u('hemo')) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: reenvio duplicou: %', r;
  END IF;
  RAISE NOTICE 'OK  2a/6a: preliminar põe em análise; final grava a versão do laboratório; reenvio igual não duplica';
  -- 6a: final diferente é conflito; corrigido vira versão nova com o motivo do laboratório
  r := pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.u('hemo'), 'status', 'final', 'identificador', 'LAB-9',
         'itens', itens, 'conteudo_hash', 'h2'));
  IF (r ->> 'status')::int <> 409 THEN RAISE EXCEPTION 'FALHOU: final diferente deveria ser conflito: %', r; END IF;
  r := pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.u('hemo'), 'status', 'amended', 'identificador', 'LAB-9',
         'nota', 'valor redigitado', 'itens', '[{"analito":"Hemoglobina","valor":"9,6","unidade":"g/dL"}]'::jsonb, 'conteudo_hash', 'h2'));
  IF (r -> 'corpo' ->> 'versao')::int <> 2
     OR (SELECT motivo_retificacao FROM public.exame_resultados WHERE exame_id = pg_temp.u('hemo') AND versao = 1) <> 'Retificado pelo laboratório: valor redigitado'
     OR (SELECT critico FROM public.exames_pedidos WHERE id = pg_temp.u('hemo')) THEN
    RAISE EXCEPTION 'FALHOU: laudo corrigido: %', r;
  END IF;
  RAISE NOTICE 'OK  6a: final diferente é conflito; corrigido vira versão 2 com "Retificado pelo laboratório" e a nota';
END $$;

-- cancelamento pelo laboratório; status desconhecido
DO $$
DECLARE r jsonb;
BEGIN
  IF (pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.u('hemo'), 'status', 'cancelled')) ->> 'status')::int <> 409 THEN
    RAISE EXCEPTION 'FALHOU: cancelar exame com resultado';
  END IF;
  r := pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.u('pota'), 'status', 'cancelled', 'nota', 'amostra hemolisada'));
  IF (SELECT motivo_cancelamento FROM public.exames_pedidos WHERE id = pg_temp.u('pota')) <> 'Cancelado pelo laboratório: amostra hemolisada' THEN
    RAISE EXCEPTION 'FALHOU: cancelamento pelo laboratório: %', r;
  END IF;
  IF (pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.u('pota'), 'status', 'final', 'conteudo_hash', 'x')) ->> 'status')::int <> 409
     OR (pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.u('hemo'), 'status', 'entered-in-error')) ->> 'status')::int <> 400 THEN
    RAISE EXCEPTION 'FALHOU: estados recusados';
  END IF;
  RAISE NOTICE 'OK  laboratório cancela com nota; resultado em pedido cancelado e status desconhecido recusados';
END $$;

-- 5a. exame de texto livre (não foi ao laboratório) não recebe laudo; tudo fica no registro de chamadas
DO $$ BEGIN
  IF (pg_temp.lab('laudo', jsonb_build_object('exame_id', pg_temp.ex('Exame livre qualquer'), 'status', 'final')) ->> 'status')::int <> 404 THEN
    RAISE EXCEPTION 'FALHOU: exame sem código';
  END IF;
  IF (SELECT count(*) FROM public.api_acessos a JOIN public.api_chaves k ON k.id = a.chave_id
       WHERE k.prefixo = 'cc_test_abababab' AND a.recurso LIKE 'laboratorio_%') < 12
     OR NOT EXISTS (SELECT 1 FROM public.api_acessos a JOIN public.api_chaves k ON k.id = a.chave_id
                     WHERE k.prefixo = 'cc_test_abababab' AND a.recurso = 'laboratorio_laudo' AND a.status = 404)
     OR has_function_privilege('authenticated', 'public.api_v1_laboratorio(text, text, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.api_v1_laboratorio(text, text, text, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: registro de chamadas ou privilégios';
  END IF;
  RAISE NOTICE 'OK  5a: exame não pedido ao laboratório é recusado e fica no registro de chamadas; porta só para a Edge Function';
END $$;
ROLLBACK;
