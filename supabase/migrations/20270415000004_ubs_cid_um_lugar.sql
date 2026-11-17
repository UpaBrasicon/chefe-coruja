-- Percurso da UBS, U10 (RT, 17/11/2026, decisão A): o CID em um lugar só.
--
-- Achados A6, M5, G3 e A7 do percurso:
-- - a consulta da UBS tinha o CID do registro (SOAP) separado do problema
--   avaliado na conduta; um I10 ou um CID O digitado só no SOAP não punha o
--   paciente no hiperdia nem no pré-natal (os gatilhos leem cid_aps);
-- - a notificação compulsória não lia o CID da conduta da UBS (cid_aps), nem os
--   problemas da lista da ficha (dengue, tuberculose, hanseníase) e a CIAP-2.
--
-- 1. registrar_conduta_aps: o CID do último registro do atendimento entra em
--    cid_aps (se ainda não estiver). Assim os gatilhos do hiperdia e do
--    pré-natal veem o CID do SOAP.
-- 2. notificacao_compulsoria_periodo: entram o CID da conduta da UBS e, como
--    sugestão, os problemas e as CIAP com agravo da lista (LNNC):
--      problema dengue      → A90  (item Dengue: A90, A91, A97)
--      problema tuberculose → A16.9 (item Tuberculose: A15–A19)
--      problema hanseníase  → A30  (item Hanseníase: A30)
--      CIAP-2 A70 (tuberculose) → A16.9
--      CIAP-2 X70 e Y70 (sífilis) → A53.9 (item Sífilis: A50–A53)
--    O CID é a referência do item, com a origem escrita ("pela lista de
--    problemas" ou "pela CIAP-2"). DST (lista) e CIAP de grupo largo (A77,
--    A78) ficam de fora: não apontam um agravo só. Nada é notificado sozinho.
--
-- Idempotente. Teste: supabase/tests/ubs_cid_um_lugar.sql
--
-- Rollback: as duas trocas invertidas (os trechos estão abaixo).

CREATE OR REPLACE FUNCTION pg_temp.u10_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(replace(p_pares[k + 1], chr(13), '') IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. o CID do SOAP conta na conduta ───────────────────────────────────────
SELECT pg_temp.u10_trocar('public.registrar_conduta_aps(uuid, text, text[], text[], text[], text, text[])',
  '  v_cids := ARRAY(SELECT DISTINCT x FROM unnest(v_cids) x ORDER BY x);',
  '  -- U10: o CID do último registro do atendimento (SOAP) conta como problema avaliado
  v_cids := v_cids || coalesce((SELECT ARRAY[private.cid_normalizado(r.cid)] FROM public.atendimento_registros r WHERE r.episodio_id = p_episodio AND private.cid_normalizado(r.cid) IS NOT NULL ORDER BY r.criado_em DESC LIMIT 1), ''{}'');
  v_cids := ARRAY(SELECT DISTINCT x FROM unnest(v_cids) x ORDER BY x);');

-- ── 2. a notificação lê a consulta da UBS ───────────────────────────────────
SELECT pg_temp.u10_trocar('public.notificacao_compulsoria_periodo(uuid, date, date, text[])',
  '     WHERE i.unidade_id = p_unidade AND i.cid_alta IS NOT NULL',
  '     WHERE i.unidade_id = p_unidade AND i.cid_alta IS NOT NULL
    UNION ALL
    -- U10: o CID da conduta da consulta da UBS
    SELECT e.paciente_id, e.id, NULL::uuid, private.cid_normalizado(c), NULL::text, coalesce(e.encerrado_em, e.chegada_em), ''CID da consulta da UBS''
      FROM public.episodios e CROSS JOIN LATERAL unnest(e.cid_aps) c
     WHERE e.unidade_id = p_unidade AND e.tipo_atendimento_aps IS NOT NULL AND e.cid_aps IS NOT NULL
    UNION ALL
    -- U10: problema da lista da ficha e CIAP-2 com agravo (sugestão; CID de referência do item)
    SELECT e.paciente_id, e.id, NULL::uuid, m.cid, m.descr, coalesce(e.encerrado_em, e.chegada_em), m.org
      FROM public.episodios e
      CROSS JOIN LATERAL (VALUES
        (''dengue'', NULL::text, ''A90'', ''Dengue (pela lista de problemas)''),
        (''tuberculose'', NULL, ''A16.9'', ''Tuberculose (pela lista de problemas)''),
        (''hanseniase'', NULL, ''A30'', ''Hanseníase (pela lista de problemas)''),
        (NULL, ''A70'', ''A16.9'', ''Tuberculose (pela CIAP-2 A70)''),
        (NULL, ''X70'', ''A53.9'', ''Sífilis (pela CIAP-2 X70)''),
        (NULL, ''Y70'', ''A53.9'', ''Sífilis (pela CIAP-2 Y70)'')) AS m0(problema, ciap, cid, descr)
      CROSS JOIN LATERAL (SELECT m0.cid, m0.descr, ''Problema da consulta da UBS''::text AS org) m
     WHERE e.unidade_id = p_unidade AND e.tipo_atendimento_aps IS NOT NULL
       AND ((m0.problema IS NOT NULL AND m0.problema = ANY (coalesce(e.problemas_aps, ''{}'')))
            OR (m0.ciap IS NOT NULL AND m0.ciap = ANY (coalesce(e.ciap_aps, ''{}''))))');

DROP FUNCTION pg_temp.u10_trocar(regprocedure, text[]);
