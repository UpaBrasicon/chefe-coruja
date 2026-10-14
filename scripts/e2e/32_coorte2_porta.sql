-- ════════════════════════════════════════════════════════════════════════════
-- Rodada 2 (Portão 2) — coorte 2: recepção, triagem, atendimento e desfecho
-- na porta (etapas 1 a 3). Pacientes #16 a #32 da tabela e2e.coorte2, mais o
-- #33 (ficha aberta no cadastro de outro paciente) e o #34 (retorno em 48 h
-- da #11 da Rodada 1). Variáveis com prefixo r2 (r2ep16, r2pac16, r2int16).
-- Roda depois de 01–04, 10–16 (coorte 1), 30 e 31. Local ou homologação.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DROP TABLE IF EXISTS e2e.coorte2;
CREATE TABLE e2e.coorte2 (
  n int PRIMARY KEY, nome text, nascimento date, sexo text, cpf text, queixa text, cid text, cor text,
  fluxograma text, publico text, desfecho text, vitais jsonb, dados jsonb DEFAULT '{}', prioridades text[] DEFAULT '{}', peso numeric
);
INSERT INTO e2e.coorte2 VALUES
  (16, 'E2E RN Icterícia',          current_date - 10,                    'M', NULL,                 'Icterícia e sucção fraca', 'P59.9', 'laranja', 'Alterações dermatológicas', 'pediatrico', 'internacao',
       '{"frequencia-cardiaca":160,"frequencia-respiratoria":50,"temperatura":36.6,"saturacao-o2":96,"escala-dor":0}',
       '{"responsavel_nome":"E2E Mãe do RN","responsavel_parentesco":"mãe","sem_documento":true}', '{}', 3.2),
  (17, 'E2E Criança Anlodipino',    current_date - interval '3 years',    'F', e2e.cpf('900000017'), 'Ingeriu comprimidos de anlodipino da avó há 40 minutos', 'T46.5', 'vermelho', 'Intoxicações exógenas', 'pediatrico', 'observacao',
       '{"frequencia-cardiaca":70,"frequencia-respiratoria":24,"temperatura":36.5,"saturacao-o2":97,"escala-dor":0}',
       '{"responsavel_nome":"E2E Avó da Criança","responsavel_parentesco":"avó"}', '{}', 14),
  (18, 'E2E Criança Cetoacidose',   current_date - interval '9 years',    'M', e2e.cpf('900000018'), 'Vômitos, respiração rápida e sonolência; diabético', 'E10.1', 'vermelho', 'Alterações glicêmicas', 'pediatrico', 'internacao',
       '{"frequencia-cardiaca":130,"frequencia-respiratoria":36,"temperatura":36.8,"saturacao-o2":98,"escala-dor":3}',
       '{"responsavel_nome":"E2E Mãe do Diabético","responsavel_parentesco":"mãe"}', '{}', 30),
  (19, 'E2E Adolescente Ectópica',  current_date - interval '15 years',   'F', e2e.cpf('900000019'), 'Dor abdominal forte e tontura; veio sozinha', 'O00.9', 'laranja', 'Dor abdominal', 'adulto', 'internacao',
       '{"frequencia-cardiaca":110,"frequencia-respiratoria":20,"temperatura":36.7,"saturacao-o2":98,"escala-dor":8,"pressao-arterial-sistolica":100,"pressao-arterial-diastolica":60}',
       '{}', '{}', 52),
  (20, 'E2E Gestante Pré-eclâmpsia', current_date - interval '24 years',  'F', e2e.cpf('900000020'), 'Pressão alta e dor de cabeça; gestante de 36 semanas', 'O14.1', 'vermelho', 'Dor de cabeça', 'adulto', 'internacao',
       '{"frequencia-cardiaca":96,"frequencia-respiratoria":18,"temperatura":36.6,"saturacao-o2":97,"escala-dor":7,"pressao-arterial-sistolica":170,"pressao-arterial-diastolica":110}',
       '{}', '{gestante}', 68),
  (21, 'E2E Puérpera Mastite',      current_date - interval '29 years',   'F', e2e.cpf('900000021'), 'Febre e dor na mama; parto há 8 dias, amamentando', 'O91.1', 'amarelo', 'Mal-estar geral', 'adulto', 'alta',
       '{"frequencia-cardiaca":100,"frequencia-respiratoria":18,"temperatura":38.5,"saturacao-o2":98,"escala-dor":6,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
       '{}', '{lactante_crianca_colo}', 62),
  (22, 'E2E Adulto Etilismo',       current_date - interval '22 years',   'M', e2e.cpf('900000022'), 'Embriaguez e agitação', 'F10.0', 'amarelo', 'Intoxicações exógenas', 'adulto', 'alta_a_pedido',
       '{"frequencia-cardiaca":104,"frequencia-respiratoria":18,"temperatura":36.2,"saturacao-o2":96,"escala-dor":0,"pressao-arterial-sistolica":128,"pressao-arterial-diastolica":82}',
       '{}', '{}', 70),
  (23, 'E2E Adulto Jararaca',       current_date - interval '38 years',   'M', e2e.cpf('900000023'), 'Picada de cobra na perna há 2 horas; sangramento na gengiva', 'T63.0', 'vermelho', 'Mordeduras, picadas e acidentes com animais peçonhentos', 'adulto', 'internacao',
       '{"frequencia-cardiaca":102,"frequencia-respiratoria":20,"temperatura":36.9,"saturacao-o2":97,"escala-dor":8,"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":76}',
       '{}', '{}', 80),
  (24, 'E2E Adulto Politrauma',     current_date - interval '41 years',   'M', e2e.cpf('900000024'), 'Acidente de moto, trazido pelo SAMU', 'T07', 'vermelho', 'Politraumas', 'adulto', 'internacao',
       '{"frequencia-cardiaca":128,"frequencia-respiratoria":26,"temperatura":36.0,"saturacao-o2":94,"escala-dor":9,"pressao-arterial-sistolica":85,"pressao-arterial-diastolica":50}',
       '{}', '{}', 75),
  (25, 'E2E Adulto Queimadura',     current_date - interval '47 years',   'M', e2e.cpf('900000025'), 'Queimadura em tronco e braços (incêndio)', 'T31.2', 'vermelho', 'Queimaduras', 'adulto', 'internacao',
       '{"frequencia-cardiaca":110,"frequencia-respiratoria":22,"temperatura":36.4,"saturacao-o2":96,"escala-dor":9,"pressao-arterial-sistolica":130,"pressao-arterial-diastolica":80}',
       '{}', '{}', 70),
  (26, 'E2E Adulto Anafilaxia',     current_date - interval '50 years',   'M', e2e.cpf('900000026'), 'Urticária, inchaço e falta de ar após medicação', 'T78.2', 'vermelho', 'Alterações cutâneas', 'adulto', 'observacao',
       '{"frequencia-cardiaca":124,"frequencia-respiratoria":28,"temperatura":36.5,"saturacao-o2":90,"escala-dor":2,"pressao-arterial-sistolica":80,"pressao-arterial-diastolica":40}',
       '{}', '{}', 80),
  (27, 'E2E Adulto Hipoglicemia',   current_date - interval '58 years',   'M', e2e.cpf('900000027'), 'Confusão e suor frio; usa insulina', 'E16.2', 'laranja', 'Mal-estar geral', 'adulto', 'alta',
       '{"frequencia-cardiaca":96,"frequencia-respiratoria":18,"temperatura":36.3,"saturacao-o2":97,"escala-dor":0,"pressao-arterial-sistolica":140,"pressao-arterial-diastolica":88}',
       '{}', '{}', 85),
  (28, 'E2E Adulto TEP',            current_date - interval '62 years',   'M', e2e.cpf('900000028'), 'Falta de ar súbita; cirurgia de joelho há 10 dias', 'I26.9', 'laranja', 'Queixas respiratórias', 'adulto', 'internacao',
       '{"frequencia-cardiaca":110,"frequencia-respiratoria":26,"temperatura":36.8,"saturacao-o2":91,"escala-dor":4,"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":74}',
       '{}', '{idoso_60}', 90),
  (29, 'E2E Idoso Fêmur',           current_date - interval '77 years',   'M', e2e.cpf('900000029'), 'Queda com dor no quadril; não consegue andar', 'S72.0', 'amarelo', 'Politraumas', 'adulto', 'internacao',
       '{"frequencia-cardiaca":92,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":96,"escala-dor":8,"pressao-arterial-sistolica":150,"pressao-arterial-diastolica":90}',
       '{}', '{idoso_60}', 60),
  (30, 'E2E Idoso Paliativo',       current_date - interval '85 years',   'M', e2e.cpf('900000030'), 'Falta de ar; câncer de pulmão terminal; demência', 'C34.9', 'laranja', 'Queixas respiratórias', 'adulto', 'internacao',
       '{"frequencia-cardiaca":110,"frequencia-respiratoria":30,"temperatura":37.2,"saturacao-o2":86,"escala-dor":5,"pressao-arterial-sistolica":100,"pressao-arterial-diastolica":60}',
       '{"responsavel_nome":"E2E Filha do Idoso","responsavel_parentesco":"filha"}', '{idoso_80}', 50),
  (31, 'E2E Adulto Tuberculose',    current_date - interval '36 years',   'M', e2e.cpf('900000031'), 'Tosse há 3 semanas, febre e emagrecimento; HIV positivo', 'A15.0', 'amarelo', 'Queixas respiratórias', 'adulto', 'internacao',
       '{"frequencia-cardiaca":98,"frequencia-respiratoria":22,"temperatura":38.0,"saturacao-o2":94,"escala-dor":2,"pressao-arterial-sistolica":110,"pressao-arterial-diastolica":70}',
       '{}', '{}', 55),
  (32, 'E2E Registro Civil Silva',  current_date - interval '44 years',   'M', e2e.cpf('900000032'), 'Pressão muito alta', 'I10', 'amarelo', 'Mal-estar geral', 'adulto', 'alta',
       '{"frequencia-cardiaca":90,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":3,"pressao-arterial-sistolica":190,"pressao-arterial-diastolica":120}',
       '{"nome_social":"Helena"}', '{}', 70);

-- ── 1. recepção ─────────────────────────────────────────────────────────────
DO $$
DECLARE c record; v_dados jsonb;
BEGIN
  FOR c IN SELECT * FROM e2e.coorte2 ORDER BY n LOOP
    v_dados := jsonb_strip_nulls(jsonb_build_object('nome', c.nome, 'data_nascimento', c.nascimento, 'sexo', c.sexo, 'cpf', c.cpf,
                 'nome_mae', CASE WHEN c.n <> 16 THEN 'E2E Mãe de ' || c.nome ELSE 'E2E Mãe do RN' END,
                 'municipio', 'Cidade Teste', 'uf', 'SP', 'categoria', 'sus', 'raca_cor', 'sem_informacao') || c.dados);
    PERFORM e2e.passo('R2.1.ficha', c.n, 'recepcao', '/recepcao', 'Recepção cria a ficha' || CASE WHEN c.n = 19 THEN ' (menor de 15 anos desacompanhada)' WHEN c.n = 32 THEN ' (nome social)' WHEN c.n = 16 THEN ' (recém-nascido sem CPF)' ELSE '' END,
      format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb, %L::text[]) ->> ''episodio_id'')',
             'e1200000-0000-4000-8000-000000000001', c.queixa, v_dados, c.prioridades), 'ok', 'r2ep' || c.n);
    PERFORM e2e.guardar('r2pac' || c.n, (SELECT paciente_id::text FROM public.episodios WHERE id = e2e.u('r2ep' || c.n)));
  END LOOP;
END $$;
SELECT e2e.conferir('R2.1.nome_social_gravado', 32, 'Nome social fica no cadastro',
  (SELECT nome_social = 'Helena' FROM public.pacientes WHERE id = e2e.u('r2pac32')), (SELECT nome_social FROM public.pacientes WHERE id = e2e.u('r2pac32')));
SELECT e2e.conferir('R2.1.menor_desacompanhada', 19, 'Menor de 15 anos sem responsável foi cadastrada (regra da unidade)',
  e2e.u('r2pac19') IS NOT NULL, NULL);

-- #33: ficha aberta no cadastro de OUTRO paciente (o #3 da Rodada 1, já de alta, achado pelo CPF)
SELECT e2e.passo('R2.1.ficha_paciente_errado', 33, 'recepcao', '/recepcao', 'Recepção abre ficha no cadastro do #3 da Rodada 1 (CPF digitado era de outra pessoa)',
  format('SELECT (public.registrar_ficha(%L, %L, %L::uuid, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001',
         'Dor no peito ao esforço', e2e.u('pac3'), '{}'), 'ok', 'r2ep33');
SELECT e2e.guardar('r2pac33', e2e.v('pac3'));
SELECT e2e.passo('R2.1.ficha_cpf_repetido', 33, 'recepcao', '/recepcao', 'Ficha nova com o CPF do #3 e outro nome (deve avisar duplicidade)',
  format('SELECT public.registrar_ficha(%L, %L, NULL, %L::jsonb)::text', 'e1200000-0000-4000-8000-000000000001', 'Dor no peito ao esforço',
         jsonb_build_object('nome', 'E2E Paciente Errado', 'cpf', e2e.cpf('900000003'), 'data_nascimento', '1972-02-02')), 'erro:FICHA_DUPLICATA_DOCUMENTO');

-- #34: retorno da #11 da Rodada 1 em 48 h (episódio novo no mesmo cadastro)
SELECT e2e.passo('R2.1.ficha_retorno', 34, 'recepcao', '/recepcao', 'Retorno da #11 (Rodada 1) 48 h depois da alta: ficha no mesmo cadastro',
  format('SELECT (public.registrar_ficha(%L, %L, %L::uuid, %L::jsonb, %L::text[]) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001',
         'Voltou a ficar confusa e com febre', e2e.u('pac11'), '{}', '{idoso_60}'), 'ok', 'r2ep34');
SELECT e2e.guardar('r2pac34', e2e.v('pac11'));

-- ── 2. triagem ──────────────────────────────────────────────────────────────
DO $$
DECLARE c record; v_flux uuid; v_disc text;
BEGIN
  FOR c IN SELECT * FROM e2e.coorte2 ORDER BY n LOOP
    SELECT id INTO v_flux FROM public.protocolo_fluxogramas WHERE nome = c.fluxograma AND publico = c.publico;
    v_disc := e2e.disc('e1100000-0000-4000-8000-000000000001', v_flux, c.cor);
    PERFORM e2e.passo('R2.2.classificar', c.n, 'enfermeiro', '/triagem', 'Enfermeira classifica (' || c.cor || ', ' || c.fluxograma || ')',
      format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text', e2e.u('r2ep' || c.n), c.cor, c.vitais, v_flux, v_disc));
  END LOOP;
END $$;
SELECT e2e.passo('R2.2.classificar', 33, 'enfermeiro', '/triagem', 'Classifica a ficha aberta no cadastro errado (amarelo, dor torácica)',
  format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text', e2e.u('r2ep33'), 'amarelo',
         '{"frequencia-cardiaca":88,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":97,"escala-dor":5,"pressao-arterial-sistolica":138,"pressao-arterial-diastolica":86}',
         (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Dor torácica' AND publico = 'adulto'),
         e2e.disc('e1100000-0000-4000-8000-000000000001', (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Dor torácica' AND publico = 'adulto'), 'amarelo')));
SELECT e2e.passo('R2.2.classificar', 34, 'enfermeiro', '/triagem', 'Classifica o retorno da #11 (amarelo)',
  format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text', e2e.u('r2ep34'), 'amarelo',
         '{"frequencia-cardiaca":100,"frequencia-respiratoria":20,"temperatura":38.2,"saturacao-o2":95,"escala-dor":2,"pressao-arterial-sistolica":130,"pressao-arterial-diastolica":78}',
         (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Queixas urinárias' AND publico = 'adulto'),
         e2e.disc('e1100000-0000-4000-8000-000000000001', (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Queixas urinárias' AND publico = 'adulto'), 'amarelo')));
-- peso e glicemia na triagem (o RN em quilos: a plataforma não tem peso em gramas)
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM e2e.coorte2 WHERE peso IS NOT NULL ORDER BY n LOOP
    PERFORM e2e.passo('R2.2.peso', c.n, 'enfermeiro', '/triagem', 'Peso ' || c.peso || ' kg', e2e.sql_sinal(e2e.u('r2pac' || c.n), 'peso', c.peso));
  END LOOP;
END $$;
SELECT e2e.lacuna('R2.2.peso_em_gramas', 16, 'enfermeiro', 'Peso do recém-nascido em gramas', 'O conceito "peso" é em quilogramas; o RN entra como 3,2 kg. Não há campo em gramas nem aviso de faixa neonatal.');
SELECT e2e.passo('R2.2.glicemia', 18, 'enfermeiro', '/triagem', 'Glicemia capilar 480 mg/dL', e2e.sql_sinal(e2e.u('r2pac18'), 'glicemia-capilar', 480));
SELECT e2e.passo('R2.2.glicemia', 22, 'enfermeiro', '/triagem', 'Glicemia capilar 62 mg/dL', e2e.sql_sinal(e2e.u('r2pac22'), 'glicemia-capilar', 62));
SELECT e2e.passo('R2.2.glicemia', 27, 'enfermeiro', '/triagem', 'Glicemia capilar 32 mg/dL', e2e.sql_sinal(e2e.u('r2pac27'), 'glicemia-capilar', 32));
SELECT e2e.passo('R2.2.glasgow', 24, 'enfermeiro', '/triagem', 'Glasgow 13 no politrauma', e2e.sql_sinal(e2e.u('r2pac24'), 'glasgow', 13));
SELECT e2e.passo('R2.2.alergia_previa', 26, 'enfermeiro', '/triagem', 'Registra a alergia nova: anafilaxia a dipirona (agente do episódio)',
  format('SELECT public.registrar_alergia(%L::uuid, %L, %L, %L, %L, %L::uuid)::text', e2e.u('r2pac26'), 'Dipirona', 'Anafilaxia (edema de glote e hipotensão)', 'medicamento', 'grave', e2e.med('Dipirona sódica', 'ampola')));
SELECT e2e.passo('R2.2.fila_nome_social', NULL, 'enfermeiro', '/triagem', 'Fila da triagem mostra o nome social da #32',
  format('SELECT CASE WHEN count(*) = 1 THEN ''Helena na fila'' ELSE e2e.falhar(''nome social não aparece'') END FROM public.fila_da_porta(%L) f WHERE f.nome_social = ''Helena''', 'e1200000-0000-4000-8000-000000000001'));

-- ── 3. atendimento ──────────────────────────────────────────────────────────
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT n, queixa, cid FROM e2e.coorte2 UNION ALL VALUES (33, 'Dor no peito ao esforço', 'R07.4'), (34, 'Voltou a ficar confusa e com febre', 'N39.0') ORDER BY 1 LOOP
    PERFORM e2e.passo('R2.3.iniciar', c.n, 'plantonista', '/plantao/porta', 'Plantonista inicia o atendimento',
      format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('r2ep' || c.n)));
    PERFORM e2e.passo('R2.3.soap', c.n, 'plantonista', '/plantao/porta', 'Anamnese, exame físico e hipótese com CID ' || c.cid,
      format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', e2e.u('r2ep' || c.n),
             'Queixa: ' || c.queixa || '. (texto de teste E2E)', 'Exame físico de teste E2E; sinais vitais da triagem conferidos.',
             'Hipótese: ' || c.cid || ' (teste E2E).', 'Conduta conforme protocolo da unidade (teste E2E).', c.cid));
  END LOOP;
END $$;

-- prescrições (dose escrita pelo médico, como na tela; a plataforma não calcula dose por kg)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT * FROM (VALUES
      (16, 'Ampicilina', NULL, '160 mg', 'endovenosa', '12/12h', 'ok'),
      (17, 'Carvão ativado', NULL, '14 g', 'oral', 'dose única', 'ok'),
      (17, 'Gluconato de cálcio', NULL, '2,8 mL', 'endovenosa', 'dose única, lento', 'ok'),
      (18, 'Insulina humana regular', NULL, '3 UI/h', 'endovenosa', 'contínuo em bomba', 'ok'),
      (18, 'Cloreto de sódio', NULL, '300 mL', 'endovenosa', 'na primeira hora', 'ok'),
      (18, 'Cloreto de potássio', NULL, '20 mEq/L', 'endovenosa', 'no soro de manutenção', 'ok'),
      (19, 'Dipirona sódica', 'ampola', '1 g', 'endovenosa', 'dose única', 'ok'),
      (20, 'Sulfato de magnésio', NULL, '4 g', 'endovenosa', 'ataque em 20 min, depois 1 g/h', 'ok'),
      (20, 'Hidralazina', NULL, '5 mg', 'endovenosa', 'repetir em 20 min se PA ≥ 160×110', 'ok'),
      (21, 'Cefalexina', NULL, '500 mg', 'oral', '6/6h por 10 dias', 'ok'),
      (22, 'Tiamina', NULL, '300 mg', 'endovenosa', 'dose única, antes da glicose', 'ok'),
      (22, 'Glicose', NULL, '40 mL', 'endovenosa', 'dose única, após a tiamina', 'ok'),
      (22, 'Haloperidol', NULL, '5 mg', 'intramuscular', 'dose única se agitação', 'ok'),
      (23, 'Soro antibotrópico', NULL, '8 ampolas', 'endovenosa', 'dose única, por gravidade (moderado)', 'ok'),
      (24, 'Ringer com lactato', NULL, '1.000 mL', 'endovenosa', 'correr aberto', 'ok'),
      (24, 'Fentanila', NULL, '50 mcg', 'endovenosa', 'dose única', 'ok'),
      (25, 'Ringer com lactato', NULL, '3.500 mL', 'endovenosa', 'nas primeiras 8 h (Parkland)', 'ok'),
      (25, 'Morfina', NULL, '5 mg', 'endovenosa', 'a cada 15 min se dor', 'ok'),
      (26, 'Adrenalina', NULL, '0,5 mg', 'intramuscular', 'dose única; repetir em 5 min se necessário', 'ok'),
      (26, 'Dipirona sódica', 'ampola', '1 g', 'endovenosa', 'dose única', 'erro:ALERGIA'),
      (26, 'Hidrocortisona', NULL, '200 mg', 'endovenosa', 'dose única', 'ok'),
      (27, 'Glicose', NULL, '40 mL', 'endovenosa', 'dose única', 'ok'),
      (28, 'Enoxaparina sódica', NULL, '90 mg', 'subcutânea', '12/12h', 'ok'),
      (29, 'Morfina', NULL, '3 mg', 'endovenosa', 'a cada 10 min se dor', 'ok'),
      (30, 'Morfina', NULL, '2 mg', 'subcutânea', '4/4h e se dispneia', 'ok'),
      (31, 'Rifampicina + isoniazida + pirazinamida + etambutol', NULL, '3 comprimidos', 'oral', '1x ao dia, em jejum', 'ok'),
      (32, 'Captopril', NULL, '25 mg', 'oral', 'dose única; reavaliar em 30 min', 'ok'),
      (33, 'Ácido acetilsalicílico', NULL, '200 mg', 'oral', 'dose única', 'ok'),
      (34, 'Ceftriaxona', NULL, '1 g', 'endovenosa', '1x ao dia', 'ok')
    ) x(n, principio, apres, dose, via, posologia, esperado) LOOP
    PERFORM e2e.passo('R2.3.prescrever', p.n, 'plantonista', '/plantao/porta', 'Prescreve ' || p.principio || ' ' || p.dose,
      format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('r2pac' || p.n),
             jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med(p.principio, p.apres), 'dose', p.dose, 'via', p.via,
                                'posologia', p.posologia, 'justificativa_interacao', 'Benefício maior que o risco no caso de teste E2E')),
      p.esperado);
  END LOOP;
END $$;
SELECT e2e.lacuna('R2.3.dose_por_kg', 16, 'plantonista', 'Dose por kg calculada na prescrição', 'A prescrição recebe a dose como texto; o cálculo por peso fica nas calculadoras da Central Clínica, fora da prescrição.');
SELECT e2e.lacuna('R2.3.ciatox', 17, 'plantonista', 'Contato com o CIATox registrado no atendimento', 'Não há campo nem registro de contato com o CIATox; o CIATox de referência existe só como unidade de destino da regulação.');
SELECT e2e.lacuna('R2.3.prescricao_domiciliar', 27, 'plantonista', 'Revisão da prescrição domiciliar (insulina de casa)', 'Não há registro de medicação de uso contínuo além do texto livre da triagem; não há conciliação medicamentosa.');

-- exames
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT * FROM (VALUES
      (16, ARRAY['Bilirrubina total e frações', 'Tipagem sanguínea e Coombs']),
      (17, ARRAY['ECG', 'Eletrólitos', 'Glicemia']),
      (18, ARRAY['Gasometria arterial', 'Eletrólitos', 'Cetonúria']),
      (19, ARRAY['Beta-HCG quantitativo', 'Ultrassonografia transvaginal', 'Hemograma']),
      (20, ARRAY['Proteinúria', 'Plaquetas', 'Creatinina', 'TGO/TGP']),
      (21, ARRAY['Hemograma']),
      (22, ARRAY['Glicemia', 'Eletrólitos']),
      (23, ARRAY['Tempo de coagulação', 'Hemograma', 'Creatinina']),
      (24, ARRAY['FAST', 'Tomografia de crânio', 'Hemograma', 'Tipagem sanguínea']),
      (25, ARRAY['Hemograma', 'Eletrólitos']),
      (26, ARRAY['ECG']),
      (27, ARRAY['Glicemia']),
      (28, ARRAY['D-dímero', 'Angiotomografia de tórax', 'ECG']),
      (29, ARRAY['Raio-X de quadril e fêmur', 'Hemograma']),
      (31, ARRAY['Baciloscopia de escarro', 'Raio-X de tórax', 'Carga viral HIV']),
      (32, ARRAY['ECG', 'Creatinina']),
      (33, ARRAY['ECG', 'Troponina']),
      (34, ARRAY['Urina tipo I', 'Hemograma'])) v(n, exames) LOOP
    PERFORM e2e.passo('R2.3.pedir_exames', x.n, 'plantonista', '/plantao/porta', 'Pede exames', format('SELECT public.pedir_exames_atendimento(%L::uuid, %L::text[])::text', e2e.u('r2ep' || x.n), x.exames));
  END LOOP;
  -- resultados dos que decidem o desfecho na porta
  FOR x IN SELECT e.id, c.n, e.exame FROM public.exames_pedidos e JOIN (SELECT n FROM e2e.coorte2 WHERE n IN (19, 21, 22, 26, 27, 28, 32, 33)) c ON e.paciente_id = e2e.u('r2pac' || c.n)
            WHERE e.situacao = 'pedido' LOOP
    PERFORM e2e.passo('R2.3.resultado_exame', x.n, 'plantonista', '/plantao/porta', 'Registra resultado: ' || x.exame,
      format('SELECT public.resolver_exame(%L::uuid, %L)::text', x.id, 'Resultado de teste E2E para ' || x.exame));
  END LOOP;
END $$;

-- agravos de notificação compulsória marcados na porta (#23 e #31; #17 intoxicação exógena)
SELECT e2e.passo('R2.3.agravo', 23, 'plantonista', '/plantao/porta', 'Marca agravo: acidente por animal peçonhento',
  format('SELECT public.marcar_agravo(%L::uuid, %L, %L)::text', e2e.u('r2pac23'), 'Acidente por animal peçonhento', 'T63.0'), 'ok', 'r2agravo23');
SELECT e2e.passo('R2.3.agravo', 31, 'plantonista', '/plantao/porta', 'Marca agravo: tuberculose',
  format('SELECT public.marcar_agravo(%L::uuid, %L, %L)::text', e2e.u('r2pac31'), 'Tuberculose', 'A15.0'), 'ok', 'r2agravo31');
SELECT e2e.passo('R2.3.agravo', 17, 'plantonista', '/plantao/porta', 'Marca agravo: intoxicação exógena',
  format('SELECT public.marcar_agravo(%L::uuid, %L, %L)::text', e2e.u('r2pac17'), 'Intoxicação Exógena', 'T46.5'), 'ok', 'r2agravo17');
SELECT e2e.passo('R2.3.notificacao_sinan', 23, 'plantonista', '/plantao/porta', 'Abre a notificação (ficha LNNC) do acidente ofídico',
  format('SELECT public.abrir_notificacao(%L::uuid, %L, %L, %L::uuid)::text', e2e.u('r2pac23'), '2', 'T63.0', e2e.u('r2ep23')), 'ok', 'r2notif23');
SELECT e2e.passo('R2.3.notificacao_sinan', 31, 'plantonista', '/plantao/porta', 'Abre a notificação (ficha LNNC) da tuberculose',
  format('SELECT public.abrir_notificacao(%L::uuid, %L, %L, %L::uuid)::text', e2e.u('r2pac31'), '64', 'A15.0', e2e.u('r2ep31')), 'ok', 'r2notif31');
SELECT e2e.lacuna('R2.3.boletim_policial', 24, 'plantonista', 'Boletim policial / comunicação de acidente de trânsito', 'Não há registro de boletim de ocorrência nem de comunicação à autoridade no politrauma.');
SELECT e2e.lacuna('R2.3.sigilo_adolescente', 19, 'plantonista', 'Marcação de sigilo do atendimento da adolescente (gravidez não conhecida pela família)', 'Não há marcador de sigilo por episódio; o prontuário segue as regras gerais de acesso.');

-- ── desfechos na porta ──────────────────────────────────────────────────────
SELECT e2e.passo('R2.3.receita', 21, 'plantonista', '/plantao/porta', 'Receita compatível com a amamentação',
  format('SELECT public.emitir_documento(%L::uuid, %L, %L, %L::uuid)::text', e2e.u('r2pac21'), 'receita', 'Cefalexina 500 mg, 1 cápsula de 6/6h por 10 dias. Manter a amamentação (teste E2E).', e2e.u('r2ep21')));
SELECT e2e.passo('R2.3.alta', 21, 'plantonista', '/plantao/porta', 'Alta da puérpera', format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep21'), 'alta', '{"cid_alta":"O91.1"}'));
SELECT e2e.passo('R2.3.termo_recusa', 22, 'plantonista', '/plantao/porta', 'Termo de recusa de tratamento (etilista quer ir embora)',
  format('SELECT public.emitir_termo_consentimento(%L::uuid, %L::jsonb, %L::uuid)::text', e2e.u('r2pac22'),
         '{"procedimento":"Permanência em observação até a sobriedade","texto":"Paciente orientado sobre os riscos de sair embriagado; recusa permanecer em observação (teste E2E).","assinante":"paciente"}', e2e.u('r2ep22')));
SELECT e2e.passo('R2.3.alta_a_pedido', 22, 'plantonista', '/plantao/porta', 'Alta a pedido após sobriedade parcial',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', e2e.u('r2ep22'), 'alta_a_pedido', 'Paciente lúcido, recusa observação; termo assinado (teste E2E).', '{"cid_alta":"F10.0"}'));
SELECT e2e.passo('R2.3.alta', 27, 'plantonista', '/plantao/porta', 'Alta após correção da hipoglicemia, com orientação',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', e2e.u('r2ep27'), 'alta', 'Glicemia normalizada; orientado a rever a dose de insulina com o médico de origem (teste E2E).', '{"cid_alta":"E16.2"}'));
SELECT e2e.passo('R2.3.atestado_nome_social', 32, 'plantonista', '/plantao/porta', 'Atestado da #32 (documento com nome social)',
  format('SELECT public.emitir_documento(%L::uuid, %L, %L, %L::uuid)::text', e2e.u('r2pac32'), 'atestado', 'Atesto que a paciente esteve em atendimento nesta data (teste E2E).', e2e.u('r2ep32')), 'ok', 'r2doc32');
SELECT e2e.passo('R2.3.alta', 32, 'plantonista', '/plantao/porta', 'Alta da crise hipertensiva', format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep32'), 'alta', '{"cid_alta":"I10"}'));
SELECT e2e.passo('R2.3.desfecho_observacao', 16, 'plantonista', '/plantao/porta', 'RN ictérico vai para a observação pediátrica (fototerapia; regulação neonatal a seguir)',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep16'), 'observacao', jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000004', 'leito_id', e2e.leito('OP-04'))));
SELECT e2e.lacuna('R2.3.fototerapia', 16, 'plantonista', 'Prescrição de fototerapia como procedimento', 'A prescrição só tem itens do catálogo de medicamentos; fototerapia entra como texto na evolução, sem checagem pela enfermagem.');
SELECT e2e.passo('R2.3.desfecho_observacao', 17, 'plantonista', '/plantao/porta', 'Criança intoxicada vai para a observação pediátrica (prolongada)',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep17'), 'observacao', jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000004', 'leito_id', e2e.leito('OP-03'))));
SELECT e2e.passo('R2.3.desfecho_observacao', 26, 'plantonista', '/plantao/porta', 'Anafilaxia vai para a observação adulto',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep26'), 'observacao', jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000003', 'leito_id', e2e.leito('OA-06'))));
-- #31: o roteiro pede que o sistema impeça leito comum; o produto não tem a regra
SELECT e2e.passo('R2.3.isolamento_bloqueio', 31, 'plantonista', '/plantao/porta', 'Tuberculose bacilífera em enfermaria comum (o roteiro espera recusa)',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep31'), 'internacao', jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000005')), 'erro');
SELECT e2e.lacuna('R2.3.isolamento_regra', 31, 'plantonista', 'Regra que impede alocar paciente com indicação de isolamento em leito comum', 'Não há marcação de "precisa de isolamento" no paciente nem regra na internação; o setor Isolamento existe, mas a escolha é manual. O #31 entrou na enfermaria comum e é movido para o Isolamento no script 33.');
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT * FROM (VALUES
      (18, 'e1200000-0000-4000-8000-000000000005', NULL),
      (19, 'e1200000-0000-4000-8000-000000000005', NULL), (20, 'e1200000-0000-4000-8000-000000000005', NULL),
      (23, 'e1200000-0000-4000-8000-000000000005', NULL), (24, 'e1200000-0000-4000-8000-000000000005', NULL),
      (25, 'e1200000-0000-4000-8000-000000000005', NULL), (28, 'e1200000-0000-4000-8000-000000000005', NULL),
      (29, 'e1200000-0000-4000-8000-000000000005', NULL), (30, 'e1200000-0000-4000-8000-000000000005', NULL),
      (31, 'e1200000-0000-4000-8000-000000000006', NULL)) v(n, setor, leito)
   WHERE v.n <> 31 OR NOT EXISTS (SELECT 1 FROM public.internacoes WHERE paciente_id = e2e.u('r2pac31') AND data_alta IS NULL) LOOP
    PERFORM e2e.passo('R2.3.desfecho_internacao', x.n, 'plantonista', '/plantao/porta', 'Interna em ' || (SELECT nome FROM public.setores WHERE id = x.setor::uuid) || coalesce(' ' || x.leito, ' (sem leito)'),
      format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep' || x.n), 'internacao',
             jsonb_strip_nulls(jsonb_build_object('setor_id', x.setor, 'leito_id', e2e.leito(x.leito)))));
  END LOOP;
  FOR x IN SELECT n FROM e2e.coorte2 WHERE desfecho IN ('internacao', 'observacao') UNION SELECT 34 LOOP
    PERFORM e2e.guardar('r2int' || x.n, (SELECT id::text FROM public.internacoes WHERE paciente_id = e2e.u('r2pac' || x.n) AND data_alta IS NULL ORDER BY created_at DESC LIMIT 1));
  END LOOP;
END $$;
SELECT e2e.lacuna('R2.3.sala_vermelha', 20, 'plantonista', 'Internar na Sala Vermelha (emergência) pela porta', 'A internação só aceita setor de internação, UTI ou isolamento; a pré-eclâmpsia e o politrauma ficam na Internação sem leito até a regulação.');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'R2.%' GROUP BY 1 ORDER BY 1;
SELECT passo, paciente, left(coalesce(detalhe, ''), 120) FROM e2e.resultados WHERE passo LIKE 'R2.%' AND situacao = 'falha' ORDER BY id;
