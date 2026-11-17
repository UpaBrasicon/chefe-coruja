-- Gerado por scripts/fichas-sql.mjs a partir de src/clinico. Não editar à mão.
-- Mapa CID → ferramentas (pedido do RT de 17/11/2026; CF1–CF9 = A). Só a ficha nova; as demais já estão registradas.
SELECT private.registrar_versao_ferramenta('mapa-cid-ferramentas', 'Ferramentas pelo CID no atendimento', '2026-11-17.1', 'ambos', '[{"citacao":"Topo de cada ferramenta da Central (frase-resumo e \"Quando usar\", com a fonte e a página de cada frase em src/clinico/topos.ts); CID-10 do DATASUS (terminologia.cid10) para os códigos"}]'::jsonb);
-- Volta (testada na homologação em 17/11/2026, em transação desfeita):
--   DELETE FROM public.ferramenta_versoes WHERE ferramenta_id = 'mapa-cid-ferramentas' AND versao = '2026-11-17.1';
--   DELETE FROM public.ferramentas_clinicas WHERE id = 'mapa-cid-ferramentas';
