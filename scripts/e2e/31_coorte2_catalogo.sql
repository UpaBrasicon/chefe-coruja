-- ════════════════════════════════════════════════════════════════════════════
-- Rodada 2 (Portão 2) — medicamentos que a coorte 2 prescreve e o catálogo da
-- Rodada 1 não tem. Só nome, apresentação e concentração comercial; SEM dose.
-- Idempotente. Ambiente local ou homologação; nunca produção.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, alta_vigilancia)
SELECT m.p, trim(regexp_replace(regexp_replace(lower(extensions.unaccent(m.p)), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')), m.a, m.c, m.av
  FROM (VALUES
    ('Hidralazina',                 'solução injetável, ampola 1 mL',  '20 mg/mL',   false),
    ('Cefalexina',                  'cápsula',                         '500 mg',     false),
    ('Adrenalina',                  'solução injetável, ampola 1 mL',  '1 mg/mL',    true),
    ('Tiamina',                     'solução injetável, ampola 1 mL',  '100 mg/mL',  false),
    ('Soro antibotrópico',          'solução injetável, ampola 10 mL', '—',          true),
    ('Rifampicina + isoniazida + pirazinamida + etambutol', 'comprimido', '150 + 75 + 400 + 275 mg', false),
    ('Captopril',                   'comprimido',                      '25 mg',      false),
    ('Anlodipino',                  'comprimido',                      '5 mg',       false),
    ('Ibuprofeno',                  'comprimido',                      '600 mg',     false),
    ('Fenobarbital',                'solução injetável, ampola 1 mL',  '100 mg/mL',  true)
  ) AS m(p, a, c, av)
 WHERE NOT EXISTS (SELECT 1 FROM public.medicamento x WHERE x.principio_ativo = m.p AND x.apresentacao = m.a);
SELECT 'catálogo coorte 2' AS o_que, count(*) FROM public.medicamento;
