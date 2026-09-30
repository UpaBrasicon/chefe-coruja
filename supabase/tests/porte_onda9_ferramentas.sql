-- Testes da migration 20261011000001 (onda 9: fichas das ferramentas novas da
-- Central). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_onda9_ferramentas.sql
-- As 11 fichas estão registradas na versão 2026-09-30.1, com fonte, público
-- certo e AGUARDANDO APROVAÇÃO do responsável técnico; a situação que a tela
-- lê (situacao_ferramenta) diz isso ao plantonista; o plantonista não aprova.
BEGIN;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(p_ok, false) THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;

SELECT pg_temp.confere(
  (SELECT count(*) FROM public.ferramenta_versoes v
    WHERE v.versao = '2026-09-30.1'
      AND v.ferramenta_id IN ('adulto-duke-modificado', 'adulto-sincope-san-francisco', 'adulto-vm-cinco-passos', 'adulto-vni-cinco-passos',
        'ckd-epi-2021', 'iss', 'ped-phoenix', 'ped-pram', 'ped-tfg-schwartz', 'sincope-canadense', 'timi-iamcsst')
      AND jsonb_array_length(v.fontes) > 0) = 11,
  'as 11 fichas da onda 9 estão registradas com fonte');

SELECT pg_temp.confere(
  (SELECT bool_and(publico = 'pediatrico') FROM public.ferramenta_versoes WHERE versao = '2026-09-30.1' AND ferramenta_id IN ('ped-phoenix', 'ped-pram', 'ped-tfg-schwartz'))
  AND (SELECT bool_and(publico = 'adulto') FROM public.ferramenta_versoes WHERE versao = '2026-09-30.1' AND ferramenta_id IN ('adulto-vm-cinco-passos', 'timi-iamcsst', 'ckd-epi-2021', 'iss')),
  'público: pediátricas e de adulto registradas como tal');

SELECT pg_temp.confere(
  (SELECT bool_and((f->>'pediatrica')::boolean) FROM public.ferramenta_versoes v, jsonb_array_elements(v.fontes) f
    WHERE v.versao = '2026-09-30.1' AND v.ferramenta_id IN ('ped-phoenix', 'ped-pram')),
  'fontes das pediátricas são marcadas pediátricas');

-- nada foi aprovado por migration: fica para o RT, a não ser que ele já tenha decidido
SELECT pg_temp.confere(
  NOT EXISTS (SELECT 1 FROM public.ferramenta_versoes WHERE versao = '2026-09-30.1' AND ferramenta_id = 'adulto-vm-cinco-passos' AND decidida_por IS NULL AND status <> 'aguardando_aprovacao'),
  'VM em cinco passos entra aguardando aprovação');

-- registrar de novo não muda a versão (a fonte de uma versão registrada é imutável)
SELECT private.registrar_versao_ferramenta('iss', 'ISS', '2026-09-30.1', 'adulto', '[{"citacao":"outra"}]');
SELECT pg_temp.confere(
  (SELECT fontes->0->>'citacao' FROM public.ferramenta_versoes WHERE ferramenta_id = 'iss' AND versao = '2026-09-30.1') LIKE 'Baker SP%',
  'versão registrada não é sobrescrita');

-- o plantonista lê a situação e não consegue aprovar
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.confere(
  (public.situacao_ferramenta('timi-iamcsst', '2026-09-30.1', NULL)->>'status') IN ('aguardando_aprovacao', 'aprovada', 'reprovada'),
  'situacao_ferramenta devolve o estado da versão para a tela');
DO $$
BEGIN
  PERFORM public.decidir_versao_ferramenta('timi-iamcsst', '2026-09-30.1', true, NULL);
  RAISE EXCEPTION 'FALHOU: plantonista aprovou uma ferramenta';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  plantonista não aprova ferramenta (%)', SQLERRM;
END $$;
RESET ROLE;
ROLLBACK;
