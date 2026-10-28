-- Ponto 11 do plantonista: carga dos sinônimos da busca de medicamento
-- (docs/plantonista/PONTO-11-SINONIMOS.md). Só nomes, sem dose.
--   Lista A (siglas, DCB, DCI, uso corrente): aprovada pelo RT em 28/10/2026.
--   Lista B (nome comercial): o RT aprovou gravar só os nomes que passassem na
--   Anvisa. Conferidos nos dados abertos de medicamentos registrados
--   (dados.anvisa.gov.br, DADOS_ABERTOS_MEDICAMENTOS.csv de 13/10/2026), em
--   28/10/2026: registro ativo e um único princípio ativo. Ficaram de fora
--   Zofran, Vancocina e Solu-Cortef (sem registro ativo), Rocefin (registro com
--   lidocaína) e Tazocin (combinação).
-- O sinônimo vale para o princípio ativo do cadastro com o mesmo nome
-- normalizado; com concentração, só para ela (SF é o cloreto de sódio 0,9 %).
-- Onde o cadastro não tem o princípio ativo, a linha não acha nada.
--
-- Rollback:
--   DELETE FROM public.medicamento_sinonimo WHERE fonte LIKE '%pelo RT em 28/10/2026%';

WITH s(principio, concentracao, termo, tipo, origem) AS (VALUES
  -- lista A
  ('Ácido acetilsalicílico', NULL, 'AAS', 'sigla', 'sigla'),
  ('Adrenalina', NULL, 'epinefrina', 'sinonimo', 'DCB'),
  ('Noradrenalina', NULL, 'norepinefrina', 'sinonimo', 'DCB'),
  ('Noradrenalina', NULL, 'nora', 'sigla', 'sigla'),
  ('Dipirona sódica', NULL, 'metamizol', 'sinonimo', 'DCI'),
  ('Paracetamol', NULL, 'acetaminofeno', 'sinonimo', 'USAN'),
  ('Salbutamol', NULL, 'albuterol', 'sinonimo', 'USAN'),
  ('Cetamina', NULL, 'ketamina', 'sinonimo', 'DCI (grafia inglesa)'),
  ('Cetamina', NULL, 'quetamina', 'sinonimo', 'grafia antiga'),
  ('Fentanila', NULL, 'fentanil', 'sinonimo', 'uso corrente'),
  ('Cloreto de sódio', '0,9%', 'SF', 'sigla', 'sigla'),
  ('Cloreto de sódio', '0,9%', 'SF 0,9%', 'sigla', 'sigla'),
  ('Cloreto de sódio', '0,9%', 'soro fisiológico', 'sinonimo', 'uso corrente'),
  ('Cloreto de sódio', '0,9%', 'salina', 'sinonimo', 'uso corrente'),
  ('Cloreto de sódio', '20%', 'NaCl 20%', 'sigla', 'sigla'),
  ('Cloreto de sódio', '20%', 'sal hipertônico', 'sinonimo', 'uso corrente'),
  ('Glicose', '5%', 'SG', 'sigla', 'sigla'),
  ('Glicose', '5%', 'SG 5%', 'sigla', 'sigla'),
  ('Glicose', '5%', 'soro glicosado', 'sinonimo', 'uso corrente'),
  ('Glicose', '5%', 'dextrose', 'sinonimo', 'USAN'),
  ('Glicose', '50%', 'glicose hipertônica', 'sinonimo', 'uso corrente'),
  ('Glicose', '50%', 'G50', 'sigla', 'sigla'),
  ('Ringer com lactato', NULL, 'RL', 'sigla', 'sigla'),
  ('Ringer com lactato', NULL, 'Ringer lactato', 'sinonimo', 'uso corrente'),
  ('Cloreto de potássio', NULL, 'KCl', 'sigla', 'sigla'),
  ('Sulfato de magnésio', NULL, 'MgSO4', 'sigla', 'sigla'),
  ('Bicarbonato de sódio', NULL, 'bic', 'sigla', 'sigla'),
  ('Gluconato de cálcio', NULL, 'gluconato', 'sinonimo', 'uso corrente'),
  ('Heparina sódica', NULL, 'HNF', 'sigla', 'sigla'),
  ('Heparina sódica', NULL, 'heparina não fracionada', 'sinonimo', 'uso corrente'),
  ('Enoxaparina sódica', NULL, 'HBPM', 'sigla', 'sigla'),
  ('Insulina humana regular', NULL, 'insulina R', 'sinonimo', 'uso corrente'),
  ('Insulina humana regular', NULL, 'regular', 'sinonimo', 'uso corrente'),
  ('Alteplase', NULL, 'rtPA', 'sigla', 'sigla'),
  ('Alteplase', NULL, 'rt-PA', 'sigla', 'sigla'),
  ('Amoxicilina + clavulanato', NULL, 'amoxiclav', 'sinonimo', 'uso corrente'),
  ('Amoxicilina + clavulanato', NULL, 'amoxicilina clavulanato', 'sinonimo', 'uso corrente'),
  ('Piperacilina + tazobactam', NULL, 'pipe tazo', 'sinonimo', 'uso corrente'),
  ('Piperacilina + tazobactam', NULL, 'piperacilina tazobactam', 'sinonimo', 'uso corrente'),
  ('Rifampicina + isoniazida + pirazinamida + etambutol', NULL, 'RHZE', 'sigla', 'sigla (Ministério da Saúde)'),
  ('Rifampicina + isoniazida + pirazinamida + etambutol', NULL, 'esquema básico', 'sinonimo', 'Ministério da Saúde'),
  ('Tiamina', NULL, 'vitamina B1', 'sinonimo', 'uso corrente'),
  ('Soro antibotrópico', NULL, 'SAB', 'sigla', 'sigla (Ministério da Saúde)'),
  ('Brometo de ipratrópio', NULL, 'ipratrópio', 'sinonimo', 'DCB (sem o sal)'),
  ('Rocurônio', NULL, 'brometo de rocurônio', 'sinonimo', 'DCB (com o sal)'),
  -- lista B (número do registro ativo na Anvisa)
  ('Metoclopramida', NULL, 'Plasil', 'comercial', 'registro 109170151'),
  ('Dipirona sódica', NULL, 'Novalgina', 'comercial', 'registro 186200018'),
  ('Paracetamol', NULL, 'Tylenol', 'comercial', 'registro 157211214'),
  ('Prometazina', NULL, 'Fenergan', 'comercial', 'registro 186200005'),
  ('Cefalexina', NULL, 'Keflex', 'comercial', 'registro 156260017'),
  ('Azitromicina', NULL, 'Zitromax', 'comercial', 'registro 121100359'),
  ('Enoxaparina sódica', NULL, 'Clexane', 'comercial', 'registro 183260336'),
  ('Furosemida', NULL, 'Lasix', 'comercial', 'registro 183260356'),
  ('Midazolam', NULL, 'Dormonid', 'comercial', 'registro 103900204'),
  ('Diazepam', NULL, 'Valium', 'comercial', 'registro 164250014'),
  ('Haloperidol', NULL, 'Haldol', 'comercial', 'registro 164250009'),
  ('Fenobarbital', NULL, 'Gardenal', 'comercial', 'registro 104400238'),
  ('Amiodarona', NULL, 'Ancoron', 'comercial', 'registros 100330001 e 100330162'),
  ('Propofol', NULL, 'Diprivan', 'comercial', 'registro 137640155'),
  ('Alteplase', NULL, 'Actilyse', 'comercial', 'registro 103670049'),
  ('Rocurônio', NULL, 'Esmeron', 'comercial', 'registro 101710096'),
  ('Tramadol', NULL, 'Tramal', 'comercial', 'registros 186100003, 186100005 e 186100006'),
  ('Morfina', NULL, 'Dimorf', 'comercial', 'registros 102980097 e 102980363'),
  ('Salbutamol', NULL, 'Aerolin', 'comercial', 'registro 101070226'),
  ('Brometo de ipratrópio', NULL, 'Atrovent', 'comercial', 'registro 103670004'),
  ('Clopidogrel', NULL, 'Plavix', 'comercial', 'registro 183260370'))
INSERT INTO public.medicamento_sinonimo (principio_ativo_norm, concentracao, termo, termo_norm, tipo, fonte)
SELECT private.norm_medicamento(s.principio), s.concentracao, s.termo, private.norm_medicamento(s.termo), s.tipo,
       CASE WHEN s.tipo = 'comercial'
            THEN 'Anvisa, dados abertos de medicamentos registrados (13/10/2026), ' || s.origem || '; aprovado pelo RT em 28/10/2026'
            ELSE 'Lista A (' || s.origem || '), aprovada pelo RT em 28/10/2026' END
  FROM s
ON CONFLICT ON CONSTRAINT medicamento_sinonimo_unico DO NOTHING;
