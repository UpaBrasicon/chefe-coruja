-- ════════════════════════════════════════════════════════════════════════════
-- Protocolo de classificação de risco (SMS Aparecida de Goiânia, 2025): o
-- discriminador de Alterações cutâneas perde a palavra "centímetro" (resposta do
-- RT em 25/11/2026, terceira rodada do item A-15 do teste de fluxo A).
--
--   antes   Erupções secretivas ou bolhosas associado a prurido centímetro
--   depois  Erupções secretivas ou bolhosas associado a prurido
--   (Alterações cutâneas, adulto, verde; o protocolo pediátrico não tem este texto)
--
-- Troca o nome do discriminador pelo texto inteiro, em qualquer fluxograma que
-- o tenha (e também a forma anterior, "secretantes", se a 20270426000018 não
-- tiver passado). Cor, ordem e descrição ficam como estão. Vale para o
-- protocolo e para as revisões por unidade. As classificações já registradas
-- guardam o texto da época.
--
-- Idempotente. Rollback: a mesma troca com o par invertido.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.sem_centimetro(p jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce(jsonb_object_agg(c.key, CASE
           WHEN jsonb_typeof(c.value) <> 'array' THEN c.value
           ELSE coalesce((SELECT jsonb_agg(CASE WHEN x.d ->> 0 IN ('Erupções secretivas ou bolhosas associado a prurido centímetro',
                                                                 'Erupções secretantes ou bolhosas associado a prurido centímetro')
                                              THEN jsonb_set(x.d, '{0}', to_jsonb('Erupções secretivas ou bolhosas associado a prurido'::text))
                                              ELSE x.d END ORDER BY x.ord)
                            FROM jsonb_array_elements(c.value) WITH ORDINALITY x(d, ord)), '[]'::jsonb) END), '{}'::jsonb)
    FROM jsonb_each(p) c
$$;

UPDATE public.protocolo_fluxogramas f
   SET discriminadores = pg_temp.sem_centimetro(f.discriminadores)
 WHERE jsonb_typeof(f.discriminadores) = 'object'
   AND f.discriminadores::text LIKE '%bolhosas associado a prurido centímetro%';

UPDATE public.classificacao_fluxograma_unidade r
   SET discriminadores = pg_temp.sem_centimetro(r.discriminadores)
 WHERE jsonb_typeof(r.discriminadores) = 'object'
   AND r.discriminadores::text LIKE '%bolhosas associado a prurido centímetro%';

DROP FUNCTION pg_temp.sem_centimetro(jsonb);
