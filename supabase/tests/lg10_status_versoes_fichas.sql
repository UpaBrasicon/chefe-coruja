-- Testes da migration 20270414000082 (LG10: status das versões para o gate do CI). ROLLBACK no fim.
BEGIN;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO anon;

SELECT private.registrar_versao_ferramenta('teste-lg10', 'Ficha de teste do LG10', 'v1', 'adulto', '[{"citacao":"Fonte X"}]');
SELECT private.registrar_versao_ferramenta('teste-lg10', 'Ficha de teste do LG10', 'v2', 'adulto', '[{"citacao":"Fonte X"}]');
UPDATE public.ferramenta_versoes SET status = 'aprovada' WHERE ferramenta_id = 'teste-lg10' AND versao = 'v1';

-- sem login, com a chave publicável
SET LOCAL ROLE anon;
SELECT pg_temp.confere(
  (SELECT status FROM public.status_versoes_fichas('[{"ferramenta_id":"teste-lg10","versao":"v1"}]')) = 'aprovada',
  'anon lê o status de versão aprovada');
SELECT pg_temp.confere(
  (SELECT status FROM public.status_versoes_fichas('[{"ferramenta_id":"teste-lg10","versao":"v2"}]')) = 'aguardando_aprovacao',
  'anon lê o status de versão aguardando');
SELECT pg_temp.confere(
  (SELECT status FROM public.status_versoes_fichas('[{"ferramenta_id":"teste-lg10","versao":"v9"}]')) = 'nao_registrada',
  'versão que não existe volta como nao_registrada');
SELECT pg_temp.confere(
  (SELECT count(*) FROM public.status_versoes_fichas('{"x":1}')) = 0,
  'entrada que não é lista não devolve nada');
SELECT pg_temp.confere(
  (SELECT count(*) FROM public.status_versoes_fichas(
     (SELECT jsonb_agg(jsonb_build_object('ferramenta_id', 'teste-lg10', 'versao', 'v' || g)) FROM generate_series(1, 3000) g))) = 2000,
  'no máximo 2000 itens por chamada');
-- a função não abre a tabela para anon
SELECT pg_temp.confere(
  NOT has_table_privilege('anon', 'public.ferramenta_versoes', 'SELECT'),
  'anon segue sem SELECT em ferramenta_versoes');
SELECT pg_temp.confere(
  (SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_proc p, unnest(p.proargnames) WITH ORDINALITY a(attname, attnum)
    WHERE p.proname = 'status_versoes_fichas') = ARRAY['p_itens', 'ferramenta_id', 'versao', 'status'],
  'a função devolve só id, versão e status');
RESET ROLE;

ROLLBACK;
