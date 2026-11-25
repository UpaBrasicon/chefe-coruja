-- EX6 (revisão unslop da aba Exames do leito; decisão do RT de 25/11/2026):
-- a "USG de Abdome" aparecia como LAB na lista e na folha por setor.
--
-- Causa conferida na homolog: não é o catálogo. O pedido é de 28/10/2026, feito
-- em texto livre (sem código SIGTAP) antes de o pedido gravar o setor; ficou
-- com grupo NULL, e a tela lê setor nulo como laboratório. O mesmo vale para
-- outros pedidos de imagem e ECG daquela época. Os pedidos com código já
-- ganharam o setor pelo código (20270203000004); os do catálogo de hoje e os
-- avulsos novos gravam o setor escolhido.
--
-- Aqui: só pedidos sem setor e sem código, pelo nome, só imagem e ECG (os de
-- laboratório continuam como estão: a tela já os lê como LAB). O nome que não
-- é claramente de imagem ou ECG fica como está. Nada de clínico muda: é o
-- setor da folha de pedido.
--
-- Homolog, antes → depois (25/11/2026): 9 pedidos
--   UPA Homologação: USG de Abdome (501ff9ce) NULL → imagem;
--     Radiografia de tórax (a6349f92, 92abfc7b) NULL → imagem;
--     ECG (edbe2ba0, 798f7d93) NULL → grafico
--   UPA E2E 24h: Raio-X de punho (daeb9484), Raio-X de tórax (43641f2d),
--     Tomografia de crânio (3addf8ef) NULL → imagem; ECG (d77b2ee6) NULL → grafico
-- Os ids corrigidos saem num NOTICE na aplicação (guardar para o rollback).
--
-- Rollback: UPDATE public.exames_pedidos SET grupo = NULL WHERE id = ANY(<ids do
-- NOTICE>); na homolog, os 9 ids acima (prefixos; os inteiros estão em
-- revisao-telas-novas-unslop.md, EX6). O gatilho trg_exame_grupo só preenche
-- pelo código, e esses pedidos não têm código: o NULL volta como estava.

DO $$
DECLARE
  v_ids uuid[];
BEGIN
  WITH alvo AS (
    SELECT ep.id,
           CASE
             WHEN n ~ '\m(ecg|eletrocardiograma|holter)\M' THEN 'grafico'
             WHEN n ~ '\m(rx|raio|radiografia|tomografia|tc|ultrassom|ultrassonografia|usg|ressonancia|rm|ecocardiograma|doppler|mamografia)\M' THEN 'imagem'
           END AS grupo
      FROM public.exames_pedidos ep,
           LATERAL (SELECT lower(translate(ep.exame, 'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'aaaaeeiooouucAAAAEEIOOOUUC')) AS n) x
     WHERE ep.grupo IS NULL AND ep.procedimento IS NULL
  ), feitos AS (
    UPDATE public.exames_pedidos ep SET grupo = a.grupo
      FROM alvo a
     WHERE ep.id = a.id AND a.grupo IS NOT NULL AND ep.grupo IS NULL
    RETURNING ep.id
  )
  SELECT array_agg(id) INTO v_ids FROM feitos;
  RAISE NOTICE 'EX6: % pedido(s) de imagem/ECG ganharam o setor: %', coalesce(cardinality(v_ids), 0), coalesce(v_ids::text, '{}');
END $$;
