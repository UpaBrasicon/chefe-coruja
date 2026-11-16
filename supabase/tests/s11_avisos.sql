-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S11: avisos do Supabase (migration 20270414000062).
-- 1. F5: as funções auxiliares têm search_path fixo e continuam funcionando.
-- 2. F6: as duas tabelas de terminologia têm RLS e quem está logado lê.
-- Tudo em transação com ROLLBACK, sem depender do seed.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;

-- ── 1. F5 ───────────────────────────────────────────────────────────────────
SELECT pg_temp.ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'private', 'terminologia') AND p.prokind = 'f'
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')),
  'nenhuma função de public, private ou terminologia sem search_path fixo');
SELECT pg_temp.ok(private.so_digitos('a1b-2.3') = '123', 'so_digitos segue igual');
SELECT pg_temp.ok(private.nome_comparavel('  José   da SILVA ') = 'jose da silva', 'nome_comparavel segue igual');
SELECT pg_temp.ok(private.mascarar('12345678') = '••••5678', 'mascarar segue igual');
SELECT pg_temp.ok(length(private.hash_evento(1, 'x', '{}'::jsonb, NULL, NULL, NULL)) = 64, 'hash_evento segue igual');
SELECT pg_temp.ok(terminologia.unaccent_text('Ação') = 'Acao', 'unaccent_text segue igual');
SELECT pg_temp.ok(round(private.distancia_km(0, 0, 0, 1)::numeric) = 111, 'distancia_km segue igual');

-- ── 2. F6 ───────────────────────────────────────────────────────────────────
SELECT pg_temp.ok(
  (SELECT count(*) FROM pg_class c WHERE c.relnamespace = 'terminologia'::regnamespace
     AND c.relname IN ('ciap2', 'sigtap_procedimento_cid') AND c.relrowsecurity) = 2,
  'ciap2 e sigtap_procedimento_cid com RLS');
INSERT INTO terminologia.ciap2 (codigo, descricao, capitulo)
SELECT 'Z99', 'Teste do S11', 'Z' WHERE NOT EXISTS (SELECT 1 FROM terminologia.ciap2 WHERE codigo = 'Z99');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.ciap2) > 0, 'quem está logado lê a ciap2');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.buscar('ciap2', 'Z99', 5)) >= 0, 'terminologia.buscar roda como quem está logado');
RESET ROLE;

ROLLBACK;
