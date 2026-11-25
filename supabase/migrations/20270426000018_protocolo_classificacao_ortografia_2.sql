-- ════════════════════════════════════════════════════════════════════════════
-- Protocolo de classificação de risco (SMS Aparecida de Goiânia, 2025): dois
-- textos que a migration 20270426000014 deixou para o RT decidir (resposta de
-- 25/11/2026, teste de fluxo A, item A-15).
--
--   antes                                              depois
--   Erupções secretantes ou bolhosas associado a       Erupções secretivas ou bolhosas associado a
--     prurido centímetro                                 prurido centímetro
--     (Alterações cutâneas, adulto, verde: só a palavra "secretantes" muda;
--      "associado a prurido centímetro" fica como está, para o RT ver)
--   Dor leve ( < 7 dias)                               Dor leve (> 7 dias)
--     (Alterações odontológicas, adulto e pediátrico, AZUL; o verde do adulto
--      continua "Dor leve (< 7 dias)")
--
-- A troca do azul é por fluxograma e cor: só o azul de Alterações
-- odontológicas muda. Cor, ordem e descrição ficam como estão. Vale para o
-- protocolo e para as revisões por unidade. As classificações já registradas
-- guardam o texto da época.
--
-- Idempotente. Rollback: a mesma troca com os pares invertidos.
-- ════════════════════════════════════════════════════════════════════════════

-- troca o nome de um discriminador (texto inteiro); p_cor nulo = em qualquer cor
CREATE OR REPLACE FUNCTION pg_temp.renomear(p jsonb, p_cor text, p_velho text, p_novo text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce(jsonb_object_agg(c.key, CASE
           WHEN jsonb_typeof(c.value) <> 'array' OR (p_cor IS NOT NULL AND c.key <> p_cor) THEN c.value
           ELSE coalesce((SELECT jsonb_agg(CASE WHEN x.d ->> 0 = p_velho THEN jsonb_set(x.d, '{0}', to_jsonb(p_novo)) ELSE x.d END ORDER BY x.ord)
                            FROM jsonb_array_elements(c.value) WITH ORDINALITY x(d, ord)), '[]'::jsonb) END), '{}'::jsonb)
    FROM jsonb_each(p) c
$$;

UPDATE public.protocolo_fluxogramas f
   SET discriminadores = pg_temp.renomear(f.discriminadores, NULL,
         'Erupções secretantes ou bolhosas associado a prurido centímetro',
         'Erupções secretivas ou bolhosas associado a prurido centímetro')
 WHERE jsonb_typeof(f.discriminadores) = 'object'
   AND f.discriminadores::text LIKE '%Erupções secretantes ou bolhosas associado a prurido centímetro%';

UPDATE public.protocolo_fluxogramas f
   SET discriminadores = pg_temp.renomear(pg_temp.renomear(f.discriminadores, 'azul', 'Dor leve ( < 7 dias)', 'Dor leve (> 7 dias)'),
                                          'azul', 'Dor leve ( < 7 dias', 'Dor leve (> 7 dias)')
 WHERE f.nome = 'Alterações odontológicas' AND jsonb_typeof(f.discriminadores) = 'object'
   AND (f.discriminadores -> 'azul')::text LIKE '%Dor leve ( < 7 dias%';

UPDATE public.classificacao_fluxograma_unidade r
   SET discriminadores = pg_temp.renomear(r.discriminadores, NULL,
         'Erupções secretantes ou bolhosas associado a prurido centímetro',
         'Erupções secretivas ou bolhosas associado a prurido centímetro')
 WHERE jsonb_typeof(r.discriminadores) = 'object'
   AND r.discriminadores::text LIKE '%Erupções secretantes ou bolhosas associado a prurido centímetro%';

UPDATE public.classificacao_fluxograma_unidade r
   SET discriminadores = pg_temp.renomear(pg_temp.renomear(r.discriminadores, 'azul', 'Dor leve ( < 7 dias)', 'Dor leve (> 7 dias)'),
                                          'azul', 'Dor leve ( < 7 dias', 'Dor leve (> 7 dias)')
  FROM public.protocolo_fluxogramas f
 WHERE f.id = r.fluxograma_id AND f.nome = 'Alterações odontológicas' AND jsonb_typeof(r.discriminadores) = 'object'
   AND (r.discriminadores -> 'azul')::text LIKE '%Dor leve ( < 7 dias%';

DROP FUNCTION pg_temp.renomear(jsonb, text, text, text);
