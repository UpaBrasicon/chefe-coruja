-- Testes da migration 20261211000001_api_imagem.sql (Fase 5C, tarefa 2,
-- etapa 2.2): chave com recurso imagem; pedidos de imagem e ECG como
-- ServiceRequest com a categoria; ImagingStudy marca realizado com o link;
-- link só de domínio cadastrado (porta e tela); laudo do serviço de imagem,
-- reenvio e corrigido; chave de laboratório não mexe em imagem e vice-versa.
-- ROLLBACK no fim.
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
INSERT INTO t SELECT 'a', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor torácica', NULL,
  json_build_object('nome', 'Paciente Imagem Porta', 'data_nascimento', '1975-02-02')::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('a'), 'verde',
  '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":36.8,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('a'));
RESET ROLE;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia, valor_sa, valor_sh, valor_sp) VALUES
  ('0202990031', 'HEMOGRAMA TESTE RIS', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 4.11, 0, 0),
  ('0204990031', 'RADIOGRAFIA DE TORAX TESTE RIS', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 9.50, 0, 0),
  ('0211990031', 'ELETROCARDIOGRAMA TESTE RIS', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 5.15, 0, 0)
ON CONFLICT (codigo) DO NOTHING;
-- chaves: RIS (imagem), LIS (laboratorio)
INSERT INTO public.api_chaves (nome, ambiente, prefixo, hash, unidades, recursos, criada_por, expira_em) VALUES
  ('RIS de teste', 'test', 'cc_test_12121212', private.api_hash('cc_test_' || repeat('12', 24)), ARRAY['21000000-0000-4000-8000-000000000001']::uuid[],
   ARRAY['imagem'], '10000000-0000-4000-8000-000000000001', now() + interval '1 month'),
  ('LIS de teste', 'test', 'cc_test_34343434', private.api_hash('cc_test_' || repeat('34', 24)), ARRAY['21000000-0000-4000-8000-000000000001']::uuid[],
   ARRAY['laboratorio'], '10000000-0000-4000-8000-000000000001', now() + interval '1 month');
CREATE FUNCTION pg_temp.ris(p_acao text, p_dados jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.api_v1_fhir('cc_test_' || repeat('12', 24), '10.0.0.1', 'req-teste', p_acao, p_dados) $$;
CREATE FUNCTION pg_temp.lis(p_acao text, p_dados jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.api_v1_fhir('cc_test_' || repeat('34', 24), '10.0.0.1', 'req-teste', p_acao, p_dados) $$;
CREATE FUNCTION pg_temp.ex(p text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.exames_pedidos WHERE episodio_id = (SELECT valor::uuid FROM t WHERE nome = 'a') AND procedimento = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.ex(text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.pedir_exames(pg_temp.u('a'), '[{"procedimento":"0202990031"},{"procedimento":"0204990031"},{"procedimento":"0211990031"},{"nome":"RX livre sem código"}]');

-- 4a. domínios do visualizador: só o gestor cadastra; o endereço colado vira só o servidor
SELECT pg_temp.falha($$SELECT public.definir_dominio_imagem('21000000-0000-4000-8000-000000000001', 'pacs.hospital.com.br')$$,
  'Acesso negado: os domínios do visualizador são do gestor', 'médico não cadastra domínio');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.definir_dominio_imagem('21000000-0000-4000-8000-000000000001', 'não é domínio')$$,
  'Domínio inválido', 'domínio inválido recusado');
SELECT public.definir_dominio_imagem('21000000-0000-4000-8000-000000000001', 'https://PACS.Hospital.com.br:8443/viewer?x=1');
SELECT public.definir_dominio_imagem('21000000-0000-4000-8000-000000000001', 'pacs.hospital.com.br');
SELECT public.definir_dominio_imagem('21000000-0000-4000-8000-000000000001', 'outro.exemplo.com');
SELECT public.retirar_dominio_imagem('21000000-0000-4000-8000-000000000001', 'outro.exemplo.com');
DO $$
DECLARE l jsonb := public.dominios_imagem('21000000-0000-4000-8000-000000000001');
BEGIN
  IF jsonb_array_length(l) <> 1 OR l -> 0 ->> 'dominio' <> 'pacs.hospital.com.br' THEN RAISE EXCEPTION 'FALHOU: lista de domínios: %', l; END IF;
  RAISE NOTICE 'OK  4a: gestor cadastra o domínio (endereço colado vira o servidor, sem repetir) e retira';
END $$;
RESET ROLE;
DO $$
DECLARE u uuid := '21000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT private.link_imagem_permitido(u, 'https://pacs.hospital.com.br/viewer?study=1')
     OR NOT private.link_imagem_permitido(u, 'https://web.pacs.hospital.com.br:8443/v')
     OR private.link_imagem_permitido(u, 'http://pacs.hospital.com.br/v')
     OR private.link_imagem_permitido(u, 'https://pacs.hospital.com.br@mal.com/v')
     OR private.link_imagem_permitido(u, 'https://pacs.hospital.com.br.mal.com/v')
     OR private.link_imagem_permitido(u, 'https://mal.com/?pacs.hospital.com.br')
     OR private.link_imagem_permitido(u, 'https://xpacs.hospital.com.br/v')
     OR private.link_imagem_permitido('21000000-0000-4000-8000-000000000002', 'https://pacs.hospital.com.br/v') THEN
    RAISE EXCEPTION 'FALHOU: regra do link';
  END IF;
  RAISE NOTICE 'OK  4a: só https do domínio ou subdomínio cadastrado; usuário embutido, sufixo falso e outra unidade recusados';
END $$;

-- 4a na tela: o link digitado pela enfermagem segue a mesma regra
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.marcar_exame_realizado(%L, %L)', pg_temp.ex('0204990031'), 'https://qualquer.com/x'),
  'O link da imagem precisa ser https:// e de um visualizador cadastrado', 'link de domínio não cadastrado recusado na tela');
RESET ROLE;

-- chave sem laboratorio nem imagem é recusada
INSERT INTO public.api_chaves (nome, ambiente, prefixo, hash, unidades, recursos, criada_por, expira_em) VALUES
  ('Leitura de teste', 'test', 'cc_test_56565656', private.api_hash('cc_test_' || repeat('56', 24)), ARRAY['21000000-0000-4000-8000-000000000001']::uuid[],
   ARRAY['pacientes'], '10000000-0000-4000-8000-000000000001', now() + interval '1 month');
DO $$ BEGIN
  IF (public.api_v1_fhir('cc_test_' || repeat('56', 24), NULL, 'r', 'pedidos', '{}') ->> 'status')::int <> 403 THEN
    RAISE EXCEPTION 'FALHOU: escopo da chave';
  END IF;
  RAISE NOTICE 'OK  chave sem laboratorio nem imagem não entra na porta FHIR';
END $$;

-- 1a/3a. o RIS vê só imagem e ECG, com a categoria; o LIS vê só laboratório
DO $$
DECLARE r jsonb := pg_temp.ris('pedidos', '{}'); l jsonb := pg_temp.lis('pedidos', '{}'); s jsonb;
BEGIN
  IF (r ->> 'status')::int <> 200 THEN RAISE EXCEPTION 'FALHOU: pedidos: %', r; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'corpo' -> 'pedidos') x WHERE (x ->> 'id')::uuid IN (pg_temp.ex('0202990031')))
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'corpo' -> 'pedidos') x WHERE (x ->> 'id')::uuid = pg_temp.ex('0211990031'))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'corpo' -> 'pedidos') x WHERE x -> 'code' ->> 'text' = 'RX livre sem código')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'corpo' -> 'pedidos') x WHERE (x ->> 'id')::uuid IN (pg_temp.ex('0204990031'), pg_temp.ex('0211990031')))
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'corpo' -> 'pedidos') x WHERE (x ->> 'id')::uuid = pg_temp.ex('0202990031')) THEN
    RAISE EXCEPTION 'FALHOU: separação dos pedidos: % / %', r, l;
  END IF;
  SELECT x INTO s FROM jsonb_array_elements(r -> 'corpo' -> 'pedidos') x WHERE (x ->> 'id')::uuid = pg_temp.ex('0204990031');
  IF s -> 'category' -> 0 -> 'coding' -> 0 ->> 'code' <> '363679005' THEN RAISE EXCEPTION 'FALHOU: categoria imagem: %', s; END IF;
  SELECT x INTO s FROM jsonb_array_elements(l -> 'corpo' -> 'pedidos') x WHERE (x ->> 'id')::uuid = pg_temp.ex('0202990031');
  IF s -> 'category' -> 0 -> 'coding' -> 0 ->> 'code' <> '108252007' THEN RAISE EXCEPTION 'FALHOU: categoria laboratório: %', s; END IF;
  RAISE NOTICE 'OK  1a/3a: RIS recebe RX e ECG (categoria imagem); LIS recebe só laboratório; texto livre não sai';
END $$;

-- cada chave só mexe no seu tipo de exame
DO $$ BEGIN
  IF (pg_temp.lis('laudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'final', 'nota', 'x')) ->> 'status')::int <> 403
     OR (pg_temp.ris('laudo', jsonb_build_object('exame_id', pg_temp.ex('0202990031'), 'status', 'final', 'nota', 'x')) ->> 'status')::int <> 403
     OR public.api_fhir_pode_anexar('cc_test_' || repeat('34', 24), pg_temp.ex('0204990031'))
     OR NOT public.api_fhir_pode_anexar('cc_test_' || repeat('12', 24), pg_temp.ex('0204990031'))
     OR (pg_temp.ris('coleta', jsonb_build_object('exame_id', pg_temp.ex('0204990031'))) ->> 'status')::int <> 409
     OR (pg_temp.ris('estudo', jsonb_build_object('exame_id', gen_random_uuid(), 'status', 'available')) ->> 'status')::int <> 404 THEN
    RAISE EXCEPTION 'FALHOU: escopo por tipo de exame';
  END IF;
  RAISE NOTICE 'OK  LIS não lauda imagem e RIS não lauda laboratório; imagem não tem coleta; exame inexistente é recusado';
END $$;

-- 1a/2a/4a. ImagingStudy: link fora do domínio recusa; available marca realizado com o link; reenvio não muda
DO $$
DECLARE r jsonb; v_quando timestamptz := date_trunc('second', now() - interval '20 minutes');
BEGIN
  r := pg_temp.ris('estudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'available', 'link', 'https://mal.com/v'));
  IF (r ->> 'status')::int <> 422 OR (SELECT situacao FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> 'pedido' THEN
    RAISE EXCEPTION 'FALHOU: link de fora: %', r;
  END IF;
  r := pg_temp.ris('estudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'registered'));
  IF (r ->> 'status')::int <> 200 OR (SELECT situacao FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> 'pedido' THEN
    RAISE EXCEPTION 'FALHOU: registered: %', r;
  END IF;
  r := pg_temp.ris('estudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'available', 'iniciado_em', v_quando,
         'link', 'https://pacs.hospital.com.br/viewer?study=1.2.3', 'identificador', '1.2.3'));
  IF (r ->> 'status')::int <> 200 OR (SELECT situacao FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> 'realizado'
     OR (SELECT realizado_em FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> v_quando
     OR (SELECT realizado_por FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) IS NOT NULL
     OR (SELECT imagem_url FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> 'https://pacs.hospital.com.br/viewer?study=1.2.3' THEN
    RAISE EXCEPTION 'FALHOU: available: %', r;
  END IF;
  r := pg_temp.ris('estudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'available', 'iniciado_em', now()));
  IF (r ->> 'status')::int <> 200 OR (SELECT realizado_em FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> v_quando THEN
    RAISE EXCEPTION 'FALHOU: reenvio mudou a hora: %', r;
  END IF;
  IF (pg_temp.ris('estudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'entered-in-error')) ->> 'status')::int <> 400
     OR (pg_temp.ris('estudo', jsonb_build_object('exame_id', pg_temp.ex('0211990031'), 'status', 'available', 'iniciado_em', now() + interval '1 hour')) ->> 'status')::int <> 400
     OR (pg_temp.lis('estudo', jsonb_build_object('exame_id', pg_temp.ex('0202990031'), 'status', 'available')) ->> 'status')::int <> 409 THEN
    RAISE EXCEPTION 'FALHOU: ImagingStudy inválido';
  END IF;
  RAISE NOTICE 'OK  1a/2a/4a: ImagingStudy marca realizado com a hora e o link do PACS; link de fora recusado; reenvio não muda; status e hora futura recusados';
END $$;

-- 5a. laudo do RX pelo serviço de imagem: preliminar não muda; final grava; reenvio igual não duplica; corrigido vira versão 2
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.ris('laudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'preliminary', 'identificador', 'RIS-7'));
  IF (SELECT situacao FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> 'realizado' THEN RAISE EXCEPTION 'FALHOU: preliminar: %', r; END IF;
  r := pg_temp.ris('laudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'final', 'identificador', 'RIS-7',
         'nota', 'Pneumotórax à direita.', 'itens', '[{"analito":"Achado","valor":"pneumotórax","marca":"AA","critico":true}]'::jsonb, 'conteudo_hash', 'i1'));
  IF (r ->> 'status')::int <> 200 OR (r -> 'corpo' ->> 'versao')::int <> 1
     OR (SELECT resultado_origem FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> 'imagem'
     OR NOT (SELECT critico FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) THEN
    RAISE EXCEPTION 'FALHOU: laudo final: %', r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'exame_critico_' || pg_temp.ex('0204990031')
                  AND mensagem LIKE 'Resultado CRÍTICO (marcado por quem laudou)%') THEN
    RAISE EXCEPTION 'FALHOU: aviso de crítico';
  END IF;
  r := pg_temp.ris('laudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'final', 'identificador', 'RIS-7',
         'nota', 'Pneumotórax à direita.', 'itens', '[{"analito":"Achado","valor":"pneumotórax","marca":"AA","critico":true}]'::jsonb, 'conteudo_hash', 'i1'));
  IF NOT (r -> 'corpo' ->> 'repetido')::boolean OR (SELECT count(*) FROM public.exame_resultados WHERE exame_id = pg_temp.ex('0204990031')) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: reenvio duplicou: %', r;
  END IF;
  r := pg_temp.ris('laudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'amended', 'identificador', 'RIS-7',
         'nota', 'lado corrigido', 'conteudo_hash', 'i2'));
  IF (r -> 'corpo' ->> 'versao')::int <> 2
     OR (SELECT motivo_retificacao FROM public.exame_resultados WHERE exame_id = pg_temp.ex('0204990031') AND versao = 1) <> 'Retificado pelo serviço de imagem: lado corrigido' THEN
    RAISE EXCEPTION 'FALHOU: laudo corrigido: %', r;
  END IF;
  -- o link pode chegar depois, com o exame já laudado
  r := pg_temp.ris('estudo', jsonb_build_object('exame_id', pg_temp.ex('0204990031'), 'status', 'available', 'link', 'https://pacs.hospital.com.br/viewer?study=9'));
  IF (SELECT imagem_url FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> 'https://pacs.hospital.com.br/viewer?study=9'
     OR (SELECT situacao FROM public.exames_pedidos WHERE id = pg_temp.ex('0204990031')) <> 'resultado' THEN
    RAISE EXCEPTION 'FALHOU: link depois do laudo: %', r;
  END IF;
  RAISE NOTICE 'OK  5a: laudo do serviço de imagem (origem imagem, crítico de quem laudou), reenvio sem duplicar, corrigido vira versão 2, link atualizado';
END $$;

-- 3a. ECG pela porta sem ImagingStudy: laudo final direto do pedido; cancelamento pelo RIS
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.ris('laudo', jsonb_build_object('exame_id', pg_temp.ex('0211990031'), 'status', 'final', 'identificador', 'ECG-1',
         'nota', 'Ritmo sinusal, FC 78.', 'conteudo_hash', 'e1'));
  IF (r ->> 'status')::int <> 200 OR (SELECT situacao FROM public.exames_pedidos WHERE id = pg_temp.ex('0211990031')) <> 'resultado' THEN
    RAISE EXCEPTION 'FALHOU: laudo do ECG: %', r;
  END IF;
  IF (pg_temp.ris('estudo', jsonb_build_object('exame_id', pg_temp.ex('0211990031'), 'status', 'cancelled')) ->> 'status')::int <> 409 THEN
    RAISE EXCEPTION 'FALHOU: cancelar exame laudado';
  END IF;
  RAISE NOTICE 'OK  3a: laudo do ECG pela porta; exame laudado não é cancelado pelo RIS';
END $$;

-- registro de chamadas por tipo e privilégios
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.api_acessos a JOIN public.api_chaves k ON k.id = a.chave_id
                  WHERE k.prefixo = 'cc_test_12121212' AND a.recurso = 'imagem_estudo' AND a.status = 422)
     OR NOT EXISTS (SELECT 1 FROM public.api_acessos a JOIN public.api_chaves k ON k.id = a.chave_id
                     WHERE k.prefixo = 'cc_test_12121212' AND a.recurso = 'fhir_pedidos' AND a.status = 200)
     OR has_function_privilege('authenticated', 'public.api_v1_fhir(text, text, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.api_v1_fhir(text, text, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.api_fhir_pode_anexar(text, uuid)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.imagem_dominios', 'SELECT')
     OR has_function_privilege('anon', 'public.definir_dominio_imagem(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: registro de chamadas ou privilégios';
  END IF;
  RAISE NOTICE 'OK  cada chamada fica registrada com o tipo; porta só para a Edge Function; domínios só pelas funções';
END $$;
ROLLBACK;
