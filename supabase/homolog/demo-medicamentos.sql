-- Demo (Fase 0, item 17): catálogo mínimo de medicamentos de PS para a
-- homologação. Em produção o catálogo vem do ETL (scripts/etl/); a
-- homologação nasce vazia e a prescrição da demo não acha nada.
--
-- Só nome, apresentação e concentração — SEM dose (a dose é escrita pelo
-- médico; o sistema não sugere). Alta vigilância conforme a lista do ISMP
-- (opioide, anticoagulante, insulina, eletrólito concentrado).
-- Idempotente: não duplica se já existir. Rodar SÓ na homologação.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = '31000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a UPA Homologação). Confira a URL do painel.';
  END IF;
END $$;

INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, alta_vigilancia)
SELECT m.p, trim(regexp_replace(regexp_replace(lower(extensions.unaccent(m.p)), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')), m.a, m.c, m.av
  FROM (VALUES
    ('Dipirona sódica',        'solução injetável, ampola 2 mL', '500 mg/mL', false),
    ('Dipirona sódica',        'comprimido',                     '500 mg',    false),
    ('Paracetamol',            'comprimido',                     '500 mg',    false),
    ('Ceftriaxona',            'pó para solução injetável',      '1 g',       false),
    ('Azitromicina',           'comprimido',                     '500 mg',    false),
    ('Amoxicilina + clavulanato', 'comprimido',                  '875 mg + 125 mg', false),
    ('Ondansetrona',           'solução injetável, ampola 2 mL', '2 mg/mL',   false),
    ('Metoclopramida',         'solução injetável, ampola 2 mL', '5 mg/mL',   false),
    ('Omeprazol',              'pó para solução injetável',      '40 mg',     false),
    ('Hidrocortisona',         'pó para solução injetável',      '500 mg',    false),
    ('Salbutamol',             'aerossol',                       '100 mcg/dose', false),
    ('Furosemida',             'solução injetável, ampola 2 mL', '10 mg/mL',  false),
    ('Captopril',              'comprimido',                     '25 mg',     false),
    ('Cloreto de sódio',       'solução injetável, bolsa 500 mL', '0,9%',     false),
    ('Glicose',                'solução injetável, bolsa 500 mL', '5%',       false),
    ('Morfina',                'solução injetável, ampola 1 mL', '10 mg/mL',  true),
    ('Enoxaparina sódica',     'solução injetável, seringa 0,4 mL', '40 mg/0,4 mL', true),
    ('Insulina humana regular', 'solução injetável, frasco 10 mL', '100 UI/mL', true),
    ('Cloreto de potássio',    'solução injetável, ampola 10 mL', '19,1%',    true)
  ) AS m(p, a, c, av)
 WHERE NOT EXISTS (SELECT 1 FROM public.medicamento x WHERE x.principio_ativo = m.p AND x.apresentacao = m.a);

SELECT count(*) AS medicamentos_no_catalogo FROM public.medicamento WHERE ativo;
