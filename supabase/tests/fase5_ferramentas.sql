-- Testes das migrations 20260930000001/2 (fase 5: camadas das ferramentas). ROLLBACK no fim.
BEGIN;
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
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
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;

SELECT private.registrar_versao_ferramenta('teste-escore', 'Escore de teste', 'v1', 'adulto', '[{"citacao":"Fonte X"}]');

SET LOCAL ROLE authenticated;
-- sem responsável técnico, a versão só aguarda
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.confere(public.situacao_ferramenta('teste-escore', 'v1') ->> 'status' = 'aguardando_aprovacao',
  'versão registrada nasce aguardando aprovação');
SELECT pg_temp.confere(public.situacao_ferramenta('teste-escore', 'v9') ->> 'status' = 'nao_registrada',
  'versão que não está no banco aparece como não registrada');
SELECT pg_temp.falha($$SELECT public.decidir_versao_ferramenta('teste-escore', 'v1', true)$$,
  'Só o responsável técnico médico', 'quem não é responsável técnico não aprova');
SELECT pg_temp.falha($$SELECT public.nomear_responsavel_tecnico('10000000-0000-4000-8000-000000000002', 'medico', '12345', 'SP')$$,
  'Só a administração da rede', 'só a administração da rede nomeia');
SELECT pg_temp.falha($$INSERT INTO public.ferramenta_versoes (ferramenta_id, versao, publico, fontes) VALUES ('teste-escore', 'v2', 'adulto', '[]')$$,
  'permission denied', 'ninguém grava versão direto na tabela');

-- nomeação e aprovação nominal
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.nomear_responsavel_tecnico('10000000-0000-4000-8000-000000000002', 'medico', '12345', 'sp');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.confere((public.meu_papel_tecnico() -> 0 ->> 'registro') = '12345', 'o responsável vê o próprio registro');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.fila_aprovacao_ferramentas() WHERE ferramenta_id = 'teste-escore'),
  'a versão aparece na fila do responsável técnico');
SELECT pg_temp.falha($$SELECT public.decidir_versao_ferramenta('teste-escore', 'v1', false, 'curto')$$,
  'Para reprovar, descreva', 'reprovar exige nota');
SELECT public.decidir_versao_ferramenta('teste-escore', 'v1', true);
SELECT pg_temp.confere(public.situacao_ferramenta('teste-escore', 'v1') ->> 'decisao_registro' = 'CRM 12345/SP',
  'aprovação guarda o CRM de quem aprovou');
SELECT pg_temp.falha($$SELECT public.decidir_versao_ferramenta('teste-escore', 'v1', false, 'mudei de ideia agora')$$,
  'Esta versão já foi decidida', 'decisão não se refaz');
RESET ROLE;
SELECT private.registrar_versao_ferramenta('teste-escore', 'Escore de teste', 'v2', 'adulto', '[{"citacao":"Fonte X"}]');
SET LOCAL ROLE authenticated;
SELECT pg_temp.confere(public.situacao_ferramenta('teste-escore', 'v2') ->> 'status' = 'aguardando_aprovacao',
  'versão nova entra aguardando, mesmo com a anterior aprovada');
SELECT public.decidir_versao_ferramenta('teste-escore', 'v2', true);
SELECT pg_temp.confere(public.situacao_ferramenta('teste-escore', 'v1') ->> 'status' = 'substituida',
  'aprovar a nova versão substitui a anterior');

-- camada da unidade
SELECT pg_temp.falha($$SELECT public.definir_ferramenta_unidade('21000000-0000-4000-8000-000000000001', 'teste-escore', false, 'nota', 'protocolo local de 2026')$$,
  'Só o gestor da unidade', 'plantonista não define a camada da unidade');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.definir_ferramenta_unidade('21000000-0000-4000-8000-000000000001', 'teste-escore', false, 'nota', 'curto')$$,
  'Motivo obrigatório', 'camada da unidade exige motivo');
SELECT public.definir_ferramenta_unidade('21000000-0000-4000-8000-000000000001', 'teste-escore', false,
  'Na unidade, confirmar com a CCIH.', 'protocolo local aprovado em reunião');
SELECT public.definir_ferramenta_unidade('21000000-0000-4000-8000-000000000001', 'teste-escore', true,
  NULL, 'ferramenta suspensa até revisão');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.confere((public.situacao_ferramenta('teste-escore', 'v2', '21000000-0000-4000-8000-000000000001') -> 'unidade' ->> 'oculta')::boolean,
  'o plantonista vê a camada vigente da unidade');
SELECT pg_temp.confere(public.situacao_ferramenta('teste-escore', 'v2', '21000000-0000-4000-8000-000000000001') ->> 'status' = 'aprovada',
  'a camada da unidade não apaga a aprovação da base');
RESET ROLE;
SELECT pg_temp.confere((SELECT count(*) FROM public.ferramenta_unidade WHERE ferramenta_id = 'teste-escore') = 2,
  'camada anterior sai de vigência sem ser apagada');
SELECT pg_temp.confere((SELECT count(*) FROM public.ferramenta_versoes WHERE ferramenta_id IN ('dengue-classificacao', 'acesso-venoso', 'hiperpotassemia')) = 3,
  'fichas do pacote estão registradas');
ROLLBACK;
