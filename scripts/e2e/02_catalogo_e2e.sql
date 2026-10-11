-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — catálogo mínimo de medicamentos para a coorte.
-- Só nome, apresentação e concentração comercial; SEM dose (a dose é escrita
-- pelo médico no teste e não é referência clínica). Alta vigilância conforme
-- a lista do ISMP já usada na demo (supabase/homolog/demo-medicamentos.sql),
-- acrescida de vasoativo (a coluna vasoativo é calculada pelo banco), sedativos, bloqueador neuromuscular e trombolítico.
-- Idempotente. Ambiente local ou homologação; nunca produção.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, alta_vigilancia)
SELECT m.p, trim(regexp_replace(regexp_replace(lower(extensions.unaccent(m.p)), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')), m.a, m.c, m.av
  FROM (VALUES
    ('Dipirona sódica',          'solução injetável, ampola 2 mL',   '500 mg/mL',        false, false),
    ('Dipirona sódica',          'solução oral gotas',               '500 mg/mL',        false, false),
    ('Paracetamol',              'comprimido',                       '500 mg',           false, false),
    ('Paracetamol',              'solução oral gotas',               '200 mg/mL',        false, false),
    ('Ibuprofeno',               'suspensão oral',                   '50 mg/mL',         false, false),
    ('Ceftriaxona',              'pó para solução injetável',        '1 g',              false, false),
    ('Ampicilina',               'pó para solução injetável',        '1 g',              false, false),
    ('Amoxicilina',              'suspensão oral',                   '250 mg/5 mL',      false, false),
    ('Azitromicina',             'comprimido',                       '500 mg',           false, false),
    ('Piperacilina + tazobactam', 'pó para solução injetável',       '4 g + 0,5 g',      false, false),
    ('Vancomicina',              'pó para solução injetável',        '500 mg',           false, false),
    ('Ciprofloxacino',           'comprimido',                       '500 mg',           false, false),
    ('Ondansetrona',             'solução injetável, ampola 2 mL',   '2 mg/mL',          false, false),
    ('Metoclopramida',           'solução injetável, ampola 2 mL',   '5 mg/mL',          false, false),
    ('Omeprazol',                'pó para solução injetável',        '40 mg',            false, false),
    ('Hidrocortisona',           'pó para solução injetável',        '500 mg',           false, false),
    ('Prednisolona',             'solução oral',                     '3 mg/mL',          false, false),
    ('Salbutamol',               'aerossol',                         '100 mcg/dose',     false, false),
    ('Brometo de ipratrópio',    'solução para nebulização',         '0,25 mg/mL',       false, false),
    ('Sulfato de magnésio',      'solução injetável, ampola 10 mL',  '50%',              true,  false),
    ('Furosemida',               'solução injetável, ampola 2 mL',   '10 mg/mL',         false, false),
    ('Ácido acetilsalicílico',   'comprimido',                       '100 mg',           false, false),
    ('Clopidogrel',              'comprimido',                       '75 mg',            false, false),
    ('Heparina sódica',          'solução injetável, frasco 5 mL',   '5.000 UI/mL',      true,  false),
    ('Enoxaparina sódica',       'solução injetável, seringa 0,4 mL', '40 mg/0,4 mL',    true,  false),
    ('Alteplase',                'pó para solução injetável',        '50 mg',            true,  false),
    ('Gluconato de cálcio',      'solução injetável, ampola 10 mL',  '10%',              false, false),
    ('Insulina humana regular',  'solução injetável, frasco 10 mL',  '100 UI/mL',        true,  false),
    ('Glicose',                  'solução injetável, ampola 10 mL',  '50%',              false, false),
    ('Bicarbonato de sódio',     'solução injetável, ampola 10 mL',  '8,4%',             false, false),
    ('Cloreto de potássio',      'solução injetável, ampola 10 mL',  '19,1%',            true,  false),
    ('Cloreto de sódio',         'solução injetável, bolsa 500 mL',  '0,9%',             false, false),
    ('Ringer com lactato',       'solução injetável, bolsa 500 mL',  '—',                false, false),
    ('Noradrenalina',            'solução injetável, ampola 4 mL',   '1 mg/mL',          true,  true),
    ('Midazolam',                'solução injetável, ampola 10 mL',  '5 mg/mL',          true,  false),
    ('Fentanila',                'solução injetável, ampola 10 mL',  '50 mcg/mL',        true,  false),
    ('Propofol',                 'emulsão injetável, ampola 20 mL',  '10 mg/mL',         true,  false),
    ('Cetamina',                 'solução injetável, frasco 10 mL',  '50 mg/mL',         true,  false),
    ('Rocurônio',                'solução injetável, ampola 5 mL',   '10 mg/mL',         true,  false),
    ('Morfina',                  'solução injetável, ampola 1 mL',   '10 mg/mL',         true,  false),
    ('Haloperidol',              'solução injetável, ampola 1 mL',   '5 mg/mL',          false, false),
    ('Diazepam',                 'solução injetável, ampola 2 mL',   '5 mg/mL',          false, false),
    ('Prometazina',              'solução injetável, ampola 2 mL',   '25 mg/mL',         false, false),
    ('Carvão ativado',           'pó para suspensão oral',           '—',                false, false)
  ) AS m(p, a, c, av, va)
 WHERE NOT EXISTS (SELECT 1 FROM public.medicamento x WHERE x.principio_ativo = m.p AND x.apresentacao = m.a);
SELECT 'catálogo E2E', count(*) FROM public.medicamento;
