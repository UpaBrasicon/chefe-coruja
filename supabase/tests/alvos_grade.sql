-- Alvos da grade de ações — migration 20270108000001_alvos_grade.sql: o gestor
-- define ou apaga os alvos de exame, medicação e permanência (nulo = sem alvo);
-- limites_unidade os devolve; a classificação da grade usa o alvo chegada → triagem.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '00000000-0000-4000-8000-00000000aab1', organizacao_id, 'Unidade dos Alvos', tipo
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000aab1', 'gestor'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000aab1', 'plantonista');

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE r (n int, v jsonb);
GRANT ALL ON r TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');  -- gestor
INSERT INTO r SELECT 0, public.limites_unidade('00000000-0000-4000-8000-00000000aab1');
INSERT INTO r SELECT 1, public.salvar_alvos_grade('00000000-0000-4000-8000-00000000aab1', '{"exame": 60, "medicacao": 30, "permanencia": 240}');
INSERT INTO r SELECT 2, public.salvar_alvos_grade('00000000-0000-4000-8000-00000000aab1', '{"exame": 45, "medicacao": null}');
INSERT INTO r SELECT 3, public.porta_grade('00000000-0000-4000-8000-00000000aab1');
RESET ROLE;

DO $$
DECLARE
  v0 jsonb := (SELECT v FROM r WHERE n = 0);
  v1 jsonb := (SELECT v FROM r WHERE n = 1);
  v2 jsonb := (SELECT v FROM r WHERE n = 2);
  v3 jsonb := (SELECT v FROM r WHERE n = 3);
BEGIN
  IF v0 -> 'alvos_grade' <> '{"exame": null, "medicacao": null, "permanencia": null}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: sem configuração, os alvos da grade são nulos: %', v0 -> 'alvos_grade';
  END IF;
  RAISE NOTICE 'OK  sem configuração: nenhum alvo da grade';
  IF v1 -> 'alvos_grade' <> '{"exame": 60, "medicacao": 30, "permanencia": 240}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: os três alvos gravados: %', v1 -> 'alvos_grade';
  END IF;
  RAISE NOTICE 'OK  o gestor grava os três alvos';
  -- nulo apaga; ausente também apaga (a tela sempre manda os três)
  IF v2 -> 'alvos_grade' <> '{"exame": 45, "medicacao": null, "permanencia": null}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: nulo e ausente apagam o alvo: %', v2 -> 'alvos_grade';
  END IF;
  RAISE NOTICE 'OK  nulo ou ausente = sem alvo';
  IF (v3 #>> '{alvos,exame}')::int <> 45 OR (v3 #>> '{alvos,classificacao}')::int <> 10 THEN
    RAISE EXCEPTION 'FALHOU: a grade lê o alvo de exame e o alvo chegada → triagem (padrão 10): %', v3 -> 'alvos';
  END IF;
  RAISE NOTICE 'OK  a grade lê os alvos novos e a classificação usa o alvo da triagem';
  IF (SELECT count(*) FROM public.log_auditoria WHERE acao = 'salvar_alvos_grade'
        AND unidade_id = '00000000-0000-4000-8000-00000000aab1') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: cada gravação fica na trilha';
  END IF;
  RAISE NOTICE 'OK  gravação na auditoria';
END $$;

-- valores fora do intervalo ou que não são número: recusados
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  PERFORM public.salvar_alvos_grade('00000000-0000-4000-8000-00000000aab1', '{"exame": 0}');
  RAISE EXCEPTION 'FALHOU: aceitou alvo 0';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  alvo 0 recusado';
END $$;
DO $$ BEGIN
  PERFORM public.salvar_alvos_grade('00000000-0000-4000-8000-00000000aab1', '{"exame": "trinta"}');
  RAISE EXCEPTION 'FALHOU: aceitou texto';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  texto recusado';
END $$;
-- quem não é gestor não grava
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');  -- plantonista
DO $$ BEGIN
  PERFORM public.salvar_alvos_grade('00000000-0000-4000-8000-00000000aab1', '{"exame": 30}');
  RAISE EXCEPTION 'FALHOU: plantonista gravou alvo';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.salvar_alvos_grade(uuid, jsonb)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
