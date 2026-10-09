-- Demo (Fase 2, roteiro de teste): complemento do catálogo mínimo da
-- homologação para testar a dupla checagem (tarefa 1), as interações
-- críticas (tarefa 3) e o painel da farmácia (tarefa 9). Em produção o
-- catálogo vem do ETL; aqui são só itens de teste.
--
-- Só nome, apresentação e concentração — SEM dose. A marca de alta vigilância
-- NÃO vem daqui: o gatilho da migration 20261031000001 aplica as regras do
-- ISMP 2019 no INSERT (ex.: tramadol = opioide; glicose 50% e NaCl 20%;
-- midazolam e amiodarona injetáveis; heparina). Fluoxetina, sertralina e
-- selegilina servem para o par ISRS × IMAO da lista ONC (tarefa 3).
-- Idempotente: não duplica se já existir. Rodar SÓ na homologação.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = '31000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a UPA Homologação). Confira a URL do painel.';
  END IF;
END $$;

INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao)
SELECT m.p, trim(regexp_replace(regexp_replace(lower(extensions.unaccent(m.p)), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')), m.a, m.c
  FROM (VALUES
    ('Tramadol',               'solução injetável, ampola 2 mL', '50 mg/mL'),
    ('Tramadol',               'cápsula',                        '50 mg'),
    ('Glicose',                'solução injetável, ampola 10 mL', '50%'),
    ('Cloreto de sódio',       'solução injetável, ampola 10 mL', '20%'),
    ('Midazolam',              'solução injetável, ampola 3 mL', '5 mg/mL'),
    ('Amiodarona',             'solução injetável, ampola 3 mL', '50 mg/mL'),
    ('Heparina sódica',        'solução injetável, frasco 5 mL', '5.000 UI/mL'),
    ('Fluoxetina',             'cápsula',                        '20 mg'),
    ('Sertralina',             'comprimido',                     '50 mg'),
    ('Selegilina',             'comprimido',                     '5 mg')
  ) AS m(p, a, c)
 WHERE NOT EXISTS (SELECT 1 FROM public.medicamento x WHERE x.principio_ativo = m.p AND x.apresentacao = m.a);

-- conferência: o que ficou marcado como alta vigilância, e por qual regra
SELECT principio_ativo, apresentacao, concentracao, alta_vigilancia, alta_vigilancia_regra
  FROM public.medicamento WHERE ativo ORDER BY alta_vigilancia DESC, principio_ativo;
