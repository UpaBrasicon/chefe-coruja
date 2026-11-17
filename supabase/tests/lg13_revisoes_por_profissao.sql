-- Testes da migration 20270417000090 (LG13: revisão por profissão). ROLLBACK no fim.
BEGIN;
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
-- parte de um estado sem responsável técnico ativo
UPDATE public.responsaveis_tecnicos SET ativo = false, encerrado_em = now() WHERE ativo;

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
CREATE FUNCTION pg_temp.st(p_v text) RETURNS text LANGUAGE sql AS $$
  SELECT public.situacao_ferramenta('teste-dose', p_v) ->> 'status' $$;
GRANT EXECUTE ON FUNCTION pg_temp.st(text) TO authenticated;

-- médico = ...002; farmacêutico = ...004; enfermeiro = ...005; admin da rede = ...003
SELECT private.registrar_versao_ferramenta('teste-dose', 'Conduta com dose', 'v1', 'adulto', '[{"citacao":"Fonte X"}]');
SELECT private.registrar_versao_ferramenta('teste-escore', 'Escore sem dose', 'v1', 'adulto', '[{"citacao":"Fonte X"}]');
UPDATE public.ferramentas_clinicas SET revisoes_exigidas = ARRAY['medico', 'farmaceutico'] WHERE id = 'teste-dose';
SELECT pg_temp.falha($$UPDATE public.ferramentas_clinicas SET revisoes_exigidas = ARRAY['farmaceutico'] WHERE id = 'teste-dose'$$,
  'new row for relation "ferramentas_clinicas" violates check constraint', 'o médico revisa sempre');

SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT public.nomear_responsavel_tecnico('10000000-0000-4000-8000-000000000002', 'medico', '12345', 'SP');
SELECT pg_temp.falha($$SELECT public.nomear_responsavel_tecnico('10000000-0000-4000-8000-000000000005', 'dentista', '1', 'SP')$$,
  'Tipo de responsável inválido', 'só médico, farmacêutico ou enfermeiro');

-- 1. sem farmacêutico nomeado, o médico aprova sozinho e a falta fica registrada
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.decidir_versao_ferramenta('teste-dose', 'v1', true);
SELECT pg_temp.confere(pg_temp.st('v1') = 'aprovada', 'sem farmacêutico nomeado, a aprovação do médico basta');
SELECT pg_temp.confere(public.situacao_ferramenta('teste-dose', 'v1') -> 'revisoes_pendentes' = '["farmaceutico"]'::jsonb,
  'a tela sabe que falta a revisão do farmacêutico');
SELECT public.decidir_versao_ferramenta('teste-escore', 'v1', true);
SELECT pg_temp.confere(public.situacao_ferramenta('teste-escore', 'v1') -> 'revisoes_pendentes' = '[]'::jsonb,
  'ficha sem dose não pede farmacêutico');

-- 2. com farmacêutico nomeado, a versão nova espera os dois
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.nomear_responsavel_tecnico('10000000-0000-4000-8000-000000000004', 'farmaceutico', '777', 'SP');
SELECT public.nomear_responsavel_tecnico('10000000-0000-4000-8000-000000000005', 'enfermeiro', '888', 'SP');
SELECT pg_temp.confere((SELECT conselho FROM public.responsaveis_tecnicos WHERE perfil_id = '10000000-0000-4000-8000-000000000005' AND ativo) = 'COREN',
  'enfermeiro é nomeado com COREN');
RESET ROLE;
SELECT private.registrar_versao_ferramenta('teste-dose', 'Conduta com dose', 'v2', 'adulto', '[{"citacao":"Fonte X"}]');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.decidir_versao_ferramenta('teste-dose', 'v2', true);
SELECT pg_temp.confere(pg_temp.st('v2') = 'aguardando_aprovacao', 'com farmacêutico nomeado, o médico sozinho não aprova a ficha com dose');
SELECT pg_temp.confere(pg_temp.st('v1') = 'aprovada', 'até a aprovação completa, vale a versão anterior');
SELECT pg_temp.confere(NOT EXISTS (SELECT 1 FROM public.fila_aprovacao_ferramentas() WHERE ferramenta_id = 'teste-dose'),
  'a fila do médico não mostra o que ele já decidiu');
SELECT pg_temp.falha($$SELECT public.decidir_versao_ferramenta('teste-dose', 'v2', true)$$,
  'Esta versão já foi decidida pelo médico', 'o médico não decide duas vezes');

-- 3. farmacêutico
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT public.revisar_versao_ferramenta('teste-dose', 'v2', 'farmaceutico', true)$$,
  'Só o revisor nomeado (farmaceutico)', 'enfermeiro não revisa como farmacêutico');
SELECT pg_temp.falha($$SELECT public.revisar_versao_ferramenta('teste-dose', 'v2', 'enfermeiro', true)$$,
  'Esta ficha não pede revisão de enfermeiro', 'ficha com dose não pede enfermeiro');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.fila_revisao_ferramentas('farmaceutico') WHERE ferramenta_id = 'teste-dose' AND versao = 'v2' AND NOT retroativa AND medico_aprovou),
  'a versão nova aparece na fila do farmacêutico');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.fila_revisao_ferramentas('farmaceutico') WHERE ferramenta_id = 'teste-dose' AND versao = 'v1' AND retroativa),
  'a versão já no ar entra na fila retroativa');
SELECT pg_temp.falha($$SELECT public.revisar_versao_ferramenta('teste-dose', 'v2', 'farmaceutico', false, 'curto')$$,
  'Para reprovar, descreva', 'reprovar exige a correção');
SELECT pg_temp.confere(public.revisar_versao_ferramenta('teste-dose', 'v2', 'farmaceutico', true) = 'aprovada',
  'com o farmacêutico, a versão fica aprovada');
SELECT pg_temp.confere(pg_temp.st('v1') = 'substituida', 'a versão anterior sai do ar');
SELECT pg_temp.confere(public.situacao_ferramenta('teste-dose', 'v2') ->> 'decisao_registro' = 'CRM 12345/SP',
  'a aprovação mostra o registro do médico');
SELECT pg_temp.falha($$SELECT public.revisar_versao_ferramenta('teste-dose', 'v2', 'farmaceutico', true)$$,
  'Esta versão já foi revisada', 'revisão não se refaz');

-- 4. reprovação do farmacêutico reprova
RESET ROLE;
SELECT private.registrar_versao_ferramenta('teste-dose', 'Conduta com dose', 'v3', 'adulto', '[{"citacao":"Fonte X"}]');
SET LOCAL ROLE authenticated;
SELECT public.revisar_versao_ferramenta('teste-dose', 'v3', 'farmaceutico', false, 'dose máxima acima da fonte');
SELECT pg_temp.confere(pg_temp.st('v3') = 'reprovada', 'uma reprovação basta');
SELECT pg_temp.confere(pg_temp.st('v2') = 'aprovada', 'a reprovação não mexe na versão no ar');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.decidir_versao_ferramenta('teste-dose', 'v3', true)$$,
  'Esta versão já foi decidida (reprovada)', 'versão reprovada não volta');

-- 5. revisão retroativa e registro só de inclusão
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.revisar_versao_ferramenta('teste-dose', 'v1', 'farmaceutico', true)$$,
  'Versão fora de vigência', 'versão substituída não se revisa');
SELECT pg_temp.falha($$UPDATE public.ferramenta_revisoes SET aprovada = false$$, 'permission denied', 'ninguém altera revisão pela API');
RESET ROLE;
SELECT pg_temp.falha($$UPDATE public.ferramenta_revisoes SET nota = 'x'$$, 'ferramenta_revisoes é só-inserção', 'revisão não se altera nem pelo dono do banco');
SELECT pg_temp.confere((SELECT count(*) FROM public.ferramenta_revisoes r JOIN public.ferramenta_versoes v ON v.id = r.versao_id
                         WHERE v.ferramenta_id = 'teste-dose') = 4, 'cada decisão virou uma revisão (v1 médico; v2 médico e farmacêutico; v3 farmacêutico)');
SELECT pg_temp.confere(NOT EXISTS (SELECT 1 FROM public.ferramenta_versoes v
                                    WHERE v.decidida_por IS NOT NULL AND v.decidida_em IS NOT NULL
                                      AND NOT EXISTS (SELECT 1 FROM public.ferramenta_revisoes r WHERE r.versao_id = v.id)),
  'toda decisão antiga tem a sua revisão (carga da migration)');
ROLLBACK;
