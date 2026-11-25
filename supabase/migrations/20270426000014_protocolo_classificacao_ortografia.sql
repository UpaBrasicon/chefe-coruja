-- ════════════════════════════════════════════════════════════════════════════
-- Protocolo de classificação de risco (SMS Aparecida de Goiânia, 2025):
-- ortografia de seis discriminadores (decisão do RT em 25/11/2026, teste de
-- fluxo A, item A-15: "só ortografia e acentuação, sem mudar sentido, cor ou
-- ordem").
--
--   antes                                            depois
--   Estridor laríngeo (tosse ladrante                Estridor laríngeo (tosse ladrante)
--   Apneia ou Bradpneia                              Apneia ou bradipneia
--   Dor leve ( < 7 dias                              Dor leve ( < 7 dias)
--   Dor leve (< 7 dias                               Dor leve (< 7 dias)
--   Dor moderada (4-6/10                             Dor moderada (4-6/10)
--   Violência, maus tratos, LESÃO AUTO PROVOCADA     Violência, maus-tratos, lesão autoprovocada
--
-- Troca só o nome do discriminador (o primeiro texto de cada par), pelo texto
-- inteiro: a cor, a ordem e a descrição ficam como estão. Vale para o protocolo
-- e para as revisões por unidade (classificacao_fluxograma_unidade). As
-- classificações já registradas guardam o texto da época e não mudam.
--
-- Ficou de fora, por mudar o sentido: "Erupções secretantes ou bolhosas
-- associado a prurido centímetro" (texto sem sentido claro). O azul de
-- Alterações odontológicas ("Dor leve ( < 7 dias)") só ganha o parêntese: o
-- espaço que o distingue do verde ("Dor leve (< 7 dias)") fica, porque a
-- classificação acha a cor do discriminador pelo texto.
--
-- Idempotente: quem já está com o texto novo não muda.
-- Rollback: a mesma troca com os pares invertidos.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.ortografia(p jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce(jsonb_object_agg(c.key, coalesce((
           SELECT jsonb_agg(CASE WHEN m.novo IS NULL THEN x.d ELSE jsonb_set(x.d, '{0}', to_jsonb(m.novo)) END ORDER BY x.ord)
             FROM jsonb_array_elements(c.value) WITH ORDINALITY x(d, ord)
             LEFT JOIN (VALUES
               ('Estridor laríngeo (tosse ladrante', 'Estridor laríngeo (tosse ladrante)'),
               ('Apneia ou Bradpneia', 'Apneia ou bradipneia'),
               ('Dor leve ( < 7 dias', 'Dor leve ( < 7 dias)'),
               ('Dor leve (< 7 dias', 'Dor leve (< 7 dias)'),
               ('Dor moderada (4-6/10', 'Dor moderada (4-6/10)'),
               ('Violência, maus tratos, LESÃO AUTO PROVOCADA', 'Violência, maus-tratos, lesão autoprovocada')
             ) m(velho, novo) ON m.velho = x.d ->> 0), '[]'::jsonb)), '{}'::jsonb)
    FROM jsonb_each(p) c
   WHERE jsonb_typeof(c.value) = 'array'
$$;

UPDATE public.protocolo_fluxogramas f
   SET discriminadores = pg_temp.ortografia(f.discriminadores)
 WHERE jsonb_typeof(f.discriminadores) = 'object'
   AND NOT EXISTS (SELECT 1 FROM jsonb_each(f.discriminadores) c WHERE jsonb_typeof(c.value) <> 'array')
   AND pg_temp.ortografia(f.discriminadores) IS DISTINCT FROM f.discriminadores;

UPDATE public.classificacao_fluxograma_unidade r
   SET discriminadores = pg_temp.ortografia(r.discriminadores)
 WHERE jsonb_typeof(r.discriminadores) = 'object'
   AND NOT EXISTS (SELECT 1 FROM jsonb_each(r.discriminadores) c WHERE jsonb_typeof(c.value) <> 'array')
   AND pg_temp.ortografia(r.discriminadores) IS DISTINCT FROM r.discriminadores;

DROP FUNCTION pg_temp.ortografia(jsonb);
