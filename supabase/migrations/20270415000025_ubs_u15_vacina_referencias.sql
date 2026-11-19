-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U15, vacina, PR 1 (plano docs/ubs/U15-VACINA-PLANO.md; RT,
-- 19/11/2026: VC1 a VC7 = A): as tabelas de referência da vacinação.
--
-- Fonte: Ministério da Saúde, e-SUS APS, Layout e-SUS APS de Dados e Interface
-- (LEDI APS) 8.7.0, baixado em 19/11/2026 de integracao.esusaps.bridge.ufsc.tech:
--   - Dicionário de dados (ledi/documentacao/referencias/dicionario.html):
--     Imunobiologico, EstrategiaVacinacao, Dose, GrupoDeAtendimento,
--     coRndsFabricante, viaAdministracao (para imunobiológicos), localAplicacao;
--   - Regras de vacinação (ledi/documentacao/regras/validar_regras_vacinacao.html,
--     alterada em 13/07/2026): imunobiológico x estratégia x dose aceitos no
--     atendimento do dia. O imunobiológico fora dela só vai como registro
--     anterior (transcrição de caderneta);
--   - Ficha de Vacinação (estrutura_arquivos/dicionario-fv.html), campo
--     localAplicacao: os locais aceitos para cada via;
--   - CBOs (regras/cbo.html), Tabela 12: quem pode registrar a vacinação.
--
-- 1. terminologia.vacina_imunobiologico, vacina_estrategia (código do e-SUS APS,
--    que vai na ficha, e o código RNDS), vacina_dose, vacina_grupo_atendimento
--    (com a situação ativo/inativo do LEDI), vacina_fabricante (código RNDS,
--    texto), vacina_via e vacina_local (com o código RNDS).
-- 2. terminologia.vacina_via_local: o local de aplicação aceito em cada via.
-- 3. terminologia.vacina_regra: 871 combinações de imunobiológico,
--    estratégia e dose. Na página, a coluna "Código RNDS da estratégia" tem
--    13 linhas com código diferente do nome da estratégia (Intensificação,
--    Monitoramento e Vacinação escolar com 2); a estratégia entra pelo nome, no
--    código do e-SUS APS.
-- 4. terminologia.vacina_cbo: os CBOs da Tabela 12.
--
-- Só referência: nenhuma tela usa ainda. Leitura para authenticated e escrita
-- só para service_role, como as outras tabelas de terminologia.
--
-- Idempotente. Teste: supabase/tests/ubs_u15_vacina_referencias.sql
--
-- Rollback:
--   DROP TABLE IF EXISTS terminologia.vacina_regra, terminologia.vacina_via_local,
--     terminologia.vacina_cbo, terminologia.vacina_local, terminologia.vacina_via,
--     terminologia.vacina_fabricante, terminologia.vacina_grupo_atendimento,
--     terminologia.vacina_dose, terminologia.vacina_estrategia,
--     terminologia.vacina_imunobiologico;
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. tabelas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terminologia.vacina_imunobiologico (
  codigo integer PRIMARY KEY CHECK (codigo > 0),
  nome   text NOT NULL,
  sigla  text NOT NULL
);
CREATE TABLE IF NOT EXISTS terminologia.vacina_estrategia (
  codigo      integer PRIMARY KEY CHECK (codigo > 0),
  nome        text NOT NULL,
  codigo_rnds integer NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS terminologia.vacina_dose (
  codigo integer PRIMARY KEY CHECK (codigo > 0),
  nome   text NOT NULL,
  sigla  text NOT NULL
);
CREATE TABLE IF NOT EXISTS terminologia.vacina_grupo_atendimento (
  codigo      integer PRIMARY KEY CHECK (codigo > 0),
  nome        text NOT NULL,
  codigo_rnds text NOT NULL CHECK (codigo_rnds ~ '^[0-9]{6}$'),
  ativo       boolean NOT NULL
);
CREATE TABLE IF NOT EXISTS terminologia.vacina_fabricante (
  codigo_rnds text PRIMARY KEY CHECK (codigo_rnds ~ '^[0-9]+$'),
  nome        text NOT NULL
);
CREATE TABLE IF NOT EXISTS terminologia.vacina_via (
  codigo      integer PRIMARY KEY CHECK (codigo > 0),
  nome        text NOT NULL,
  codigo_rnds text NOT NULL
);
CREATE TABLE IF NOT EXISTS terminologia.vacina_local (
  codigo      integer PRIMARY KEY CHECK (codigo > 0),
  nome        text NOT NULL,
  codigo_rnds text NOT NULL
);
CREATE TABLE IF NOT EXISTS terminologia.vacina_via_local (
  via   integer NOT NULL REFERENCES terminologia.vacina_via(codigo),
  local integer NOT NULL REFERENCES terminologia.vacina_local(codigo),
  PRIMARY KEY (via, local)
);
CREATE TABLE IF NOT EXISTS terminologia.vacina_regra (
  imunobiologico integer NOT NULL REFERENCES terminologia.vacina_imunobiologico(codigo),
  estrategia     integer NOT NULL REFERENCES terminologia.vacina_estrategia(codigo),
  dose           integer NOT NULL REFERENCES terminologia.vacina_dose(codigo),
  PRIMARY KEY (imunobiologico, estrategia, dose)
);
CREATE TABLE IF NOT EXISTS terminologia.vacina_cbo (
  cbo  text PRIMARY KEY CHECK (cbo ~ '^[0-9A-Z]{6}$'),
  nome text NOT NULL
);

COMMENT ON TABLE terminologia.vacina_imunobiologico IS 'U15: imunobiológicos do LEDI APS 8.7.0 (Imunobiologico).';
COMMENT ON TABLE terminologia.vacina_estrategia IS 'U15: estratégias de vacinação do LEDI APS 8.7.0; codigo é o do e-SUS APS (vai na ficha), codigo_rnds o da RNDS.';
COMMENT ON TABLE terminologia.vacina_dose IS 'U15: doses do LEDI APS 8.7.0 (Dose).';
COMMENT ON TABLE terminologia.vacina_grupo_atendimento IS 'U15: grupos de atendimento da vacinação do LEDI APS 8.7.0, com a situação.';
COMMENT ON TABLE terminologia.vacina_fabricante IS 'U15: fabricantes de imunobiológico pelo código RNDS (LEDI APS 8.7.0, coRndsFabricante).';
COMMENT ON TABLE terminologia.vacina_via IS 'U15: vias de administração de imunobiológico do LEDI APS 8.7.0.';
COMMENT ON TABLE terminologia.vacina_local IS 'U15: locais de aplicação do LEDI APS 8.7.0.';
COMMENT ON TABLE terminologia.vacina_via_local IS 'U15: local de aplicação aceito em cada via (Ficha de Vacinação, campo localAplicacao).';
COMMENT ON TABLE terminologia.vacina_regra IS 'U15: imunobiológico x estratégia x dose aceitos no atendimento do dia (LEDI APS 8.7.0, Regras de vacinação).';
COMMENT ON TABLE terminologia.vacina_cbo IS 'U15: CBOs que podem registrar a vacinação (LEDI APS 8.7.0, Tabela 12).';

CREATE INDEX IF NOT EXISTS vacina_regra_estrategia_idx ON terminologia.vacina_regra (estrategia);
CREATE INDEX IF NOT EXISTS vacina_regra_dose_idx ON terminologia.vacina_regra (dose);
CREATE INDEX IF NOT EXISTS vacina_via_local_local_idx ON terminologia.vacina_via_local (local);

-- ── 2. acesso ───────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vacina_imunobiologico', 'vacina_estrategia', 'vacina_dose',
    'vacina_grupo_atendimento', 'vacina_fabricante', 'vacina_via', 'vacina_local',
    'vacina_via_local', 'vacina_regra', 'vacina_cbo'] LOOP
    EXECUTE format('ALTER TABLE terminologia.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON terminologia.%I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON terminologia.%I FOR SELECT TO authenticated USING (true)', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON terminologia.%I', t || '_write', t);
    EXECUTE format('CREATE POLICY %I ON terminologia.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t || '_write', t);
    EXECUTE format('REVOKE ALL ON terminologia.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON terminologia.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON terminologia.%I TO service_role', t);
  END LOOP;
END $$;

-- ── 3. dados (LEDI APS 8.7.0) ───────────────────────────────────────────────

INSERT INTO terminologia.vacina_imunobiologico (codigo, nome, sigla) VALUES
  (1, 'Imunoglobulina humana antitétano', 'IGHAT'), (2, 'Soro antitetânico', 'SAT'),
  (3, 'Soro antiaracnídico (Loxosceles, Phoneutria, Tityus)', 'SAAR'),
  (4, 'Soro antiescorpiônico', 'SAESC'), (5, 'Vacina difteria e tétano infantil', 'DT'),
  (6, 'Soro antielapídico', 'SAELA'), (7, 'Soro antirrábico', 'SAR'),
  (8, 'Soro antibotrópico (pentavalente)', 'SABR'), (9, 'Vacina hepatite B', 'HB'),
  (10, 'Soro antidiftérico', 'SAD'),
  (11, 'Soro antibotrópico (pentavalente) e anticrotálico', 'SABC'),
  (12, 'Soro antibotrópico (pentavalente) e antilaquético', 'SABOLAQ'),
  (13, 'Vacina meningo AC', 'MenAC'), (14, 'Vacina febre amarela', 'VFA'), (15, 'Vacina BCG', 'BCG'),
  (16, 'Soro anticrotálico', 'SAC'), (17, 'Vacina Hib', 'Hib'),
  (18, 'Vacina raiva embrião de galinha', 'VR embrião de galinha'),
  (19, 'Imunoglobulina humana antivaricela', 'IGHAVZ'),
  (20, 'Imunoglobulina humana anti-hepatite B', 'IGHAHB'), (21, 'Vacina pneumo 23', 'VPP23'),
  (22, 'vacina inativada poliomielite', 'VIP'), (23, 'Imunoglobulina humana antirrábica', 'IGHAR'),
  (24, 'vacina tríplice viral', 'SCR'), (25, 'Vacina difteria e tétano adulto', 'dT'),
  (26, 'Vacina pneumo 10', 'VPC10'), (28, 'vacina oral poliomielite bivalente', 'VOPb'),
  (29, 'Vacina penta acelular (DTPa/VIP/Hib)', 'PENTA acelular'),
  (30, 'Vacina febre tifóide', 'FTp'), (31, 'Soro antiloxoscélico (trivalente)', 'SALOX'),
  (32, 'Soro antilonômico', 'SALON'), (33, 'Vacina influenza trivalente', 'INF3'),
  (34, 'Vacina varicela', 'VZ'), (35, 'vacina hepatite A (virossomal)', 'HA virossomal'),
  (36, 'Vacina Dupla Viral', 'SR'), (37, 'vacina raiva (inativada)', 'Vero'),
  (38, 'Soro antibotulínico (trivalente)', 'SBOTULTRI'), (39, 'Vacina DTP/Hib', 'Tetra'),
  (40, 'vacina pneumo 7', 'VPC7'), (41, 'Vacina meningo C', 'MenC'),
  (42, 'vacina penta (DTP/HB/Hib)', 'PENTA'),
  (43, 'vacina hexa acelular (DTPa/HB/VIP/Hib)', 'Hexa acelular'),
  (44, 'vacina influenza A (H1N1) (inativada, fragmentada)', 'INFH1N1-2009'),
  (45, 'Vacina rotavírus', 'ROTA'), (46, 'Vacina DTP', 'DTP'), (47, 'Vacina DTPa infantil', 'DTPa'),
  (51, 'Vacina febre tifóide (atenuada)', 'Fta'), (55, 'Vacina hepatite A infantil', 'HAinf'),
  (56, 'vacina tetraviral', 'SCRV'), (57, 'Vacina dTpa adulto', 'dTpa'),
  (58, 'vacina tetra acelular DTPa/VIP', 'DTPa/VIP'), (59, 'Vacina pneumo 13', 'VPC13'),
  (60, 'Vacina HPV bivalente', 'HPV2'), (61, 'vacina tétano', 'Tétano'),
  (62, 'vacina hepatite A e B infantil', 'HA-HBinf'),
  (63, 'vacina hepatite A e B adulto', 'HA-HBad'), (64, 'vacina influenza trivalente ID', 'INF3-ID'),
  (65, 'Vacina rotavírus pentavalente', 'ROTA5'), (66, 'vacina meningo BC', 'MenBC'),
  (67, 'Vacina HPV quadrivalente', 'HPV4'), (69, 'Soro antibotulínico AB (bivalente)', 'SAB'),
  (70, 'Vacina sarampo', 'Sarampo'), (71, 'Vacina rubéola', 'Rubeola'),
  (72, 'vacina influenza A (H1N1) (inativada, fragmentada)', 'Gripe Sazonal'),
  (73, 'vacina sarampo, caxumba, rubéola e varicela', 'SCRV'),
  (74, 'Vacina meningo ACWY', 'MenACWY'), (75, 'vacina cólera oral', 'VCO'),
  (76, 'vacina herpes-zóster (atenuada)', 'VHZ'), (77, 'Vacina influenza tetravalente', 'INF4'),
  (78, 'Vacina meningo B', 'MenB'), (82, 'vacina dengue (recombinante e atenuada)', 'Dengue'),
  (83, 'Vacina hepatite A adulto', 'HAad'), (84, 'Vacina febre amarela fracionada', 'VFA-F'),
  (85, 'Vacina COVID-19-recombinante, AstraZeneca/Fiocruz (Covishield)', 'COVID-19 ASTRAZENECA/FIOCRUZ - COVISHIELD'),
  (86, 'Vacina COVID-19-inativada, Sinovac/Butantan (Coronavac)', 'COVID-19 SINOVAC/BUTANTAN - CORONAVAC'),
  (87, 'Vacina COVID-19-RNAm, Pfizer (Comirnaty)', 'COVID-19 PFIZER - COMIRNATY'),
  (88, 'Vacina COVID-19-recombinante, Janssen (Ad26.COV2.S)', 'COVID-19 JANSSEN - Ad26.COV2.S'),
  (89, 'Vacina COVID-19-recombinante, AstraZeneca/Covax (ChAdOx1-S)', 'COVID-19 ASTRAZENECA - ChAdOx1-S'),
  (93, 'Vacina HPV nonavalente', 'HPV9'),
  (97, 'vacina COVID-19-RNAm, Moderna (Spikevax)', 'COVID-19 MODERNA - SPIKEVAX'),
  (98, 'Vacina COVID-19-inativada, Sinovac (Coronavac)', 'COVID-19 SINOVAC - CORONAVAC'),
  (99, 'Vacina COVID-19-RNAm, Pfizer (Comirnaty) pediátrica', 'COVID-19 PFIZER - COMIRNATY PEDIÁTRICA'),
  (100, 'Vacina varíola símia (atenuada)', 'VVS'),
  (101, 'Vacina Herpes-Zoster (recombinante)', 'VHZR'),
  (102, 'Vacina COVID-19-RNAm, Pfizer (Comirnaty) pediátrica menor de 5 anos', 'COVID-19 PFIZER - COMIRNATY PEDIÁTRICA MENOR DE 5 ANOS'),
  (103, 'Vacina COVID-19-RNAm, Pfizer (Comirnaty) bivalente', 'COVID-19 PFIZER - COMIRNATY BIVALENTE'),
  (104, 'Vacina dengue (atenuada)', 'DNG'),
  (105, 'Vacina Covid-19-RNAm, Moderna (Spikevax) bivalente', 'COVID-19-SPIKEVAX BI'),
  (106, 'vacina pneumo 15', 'VPC15'), (107, 'Vacina Pneumo 20', 'VPC20'),
  (108, 'Vacina Vírus Sincicial Respiratório A e B (recombinante)', 'VVSR-Rec'),
  (109, 'Vacina vírus sincicial respiratório (recombinante, adjuvada)', 'VVSR-RecAdj'),
  (110, 'Vacina Influenza Tetravalente - Alta Dosagem', 'INF4-alta dosagem'),
  (111, 'Vacina Tetra Acelular dTpa/VIP', 'dTpa/VIP'),
  (112, 'Vacina Covid-19-recombinante, Serum/Zalika', 'COVID-19 SERUM/ZALIKA'),
  (113, 'Vacina chikungunya (recombinante e atenuada)', 'CHIKUNGUNYA'),
  (114, 'Vacina Covid-19-inativada, Sinopharm', 'COVID-19 SINOPHARM'),
  (115, 'Nirsevimabe 0,5ml', 'NIRSEVIMABE 0,5ml'), (116, 'Nirsevimabe 1,0ml', 'NIRSEVIMABE 1,0ml'),
  (117, 'Vacina influenza trivalente - alta dosagem', 'INF3-alta dosagem')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, sigla = EXCLUDED.sigla;

INSERT INTO terminologia.vacina_estrategia (codigo, nome, codigo_rnds) VALUES
  (1, 'Rotina', 1), (2, 'Especial', 2), (3, 'Bloqueio', 3), (4, 'Intensificação', 4),
  (5, 'Campanha indiscriminada', 5), (6, 'Campanha seletiva', 6), (7, 'Soroterapia', 7),
  (8, 'Serviço privado', 8), (9, 'Monitoramento das Estratégias de Vacinação', 9),
  (11, 'Pesquisa', 10), (12, 'Pré-exposição', 11), (13, 'Pós-exposição', 12),
  (14, 'Reexposição', 13), (15, 'Vacinação escolar', 14)
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, codigo_rnds = EXCLUDED.codigo_rnds;

INSERT INTO terminologia.vacina_dose (codigo, nome, sigla) VALUES
  (1, '1ª Dose', 'D1'), (2, '2ª Dose', 'D2'), (3, '3ª Dose', 'D3'), (4, '4ª Dose', 'D4'),
  (5, '5ª Dose', 'D5'), (6, '1º Reforço', 'R1'), (7, '2º Reforço', 'R2'), (8, 'Dose', 'D'),
  (9, 'Única', 'DU'), (10, 'Revacinação', 'REV'), (11, 'Tratamento com uma dose', 'T1'),
  (12, 'Tratamento com duas doses', 'T2'), (13, 'Tratamento com três doses', 'T3'),
  (14, 'Tratamento com quatro doses', 'T4'), (15, 'Tratamento com cinco doses', 'T5'),
  (16, 'Tratamento com seis doses', 'T6'), (17, 'Tratamento com sete doses', 'T7'),
  (18, 'Tratamento com oito doses', 'T8'), (19, 'Tratamento com nove doses', 'T9'),
  (20, 'Tratamento com dez doses', 'T10'), (21, 'Tratamento com onze doses', 'T11'),
  (22, 'Tratamento com doze doses', 'T12'), (23, 'Tratamento com treze doses', 'T13'),
  (24, 'Tratamento com quatorze doses', 'T14'), (25, 'Tratamento com quinze doses', 'T15'),
  (26, 'Tratamento com dezesseis doses', 'T16'), (27, 'Tratamento com dezessete doses', 'T17'),
  (28, 'Tratamento com dezoito doses', 'T18'), (29, 'Tratamento com dezenove doses', 'T19'),
  (30, 'Tratamento com vinte doses', 'T20'), (31, 'Tratamento com vinte quatro doses', 'T24'),
  (32, '1ª Dose Revacinação', 'D1REV'), (33, '2ª Dose Revacinação', 'D2REV'),
  (34, '3ª Dose Revacinação', 'D3REV'), (35, '4ª Dose Revacinação', 'D4REV'),
  (36, 'Dose Inicial', 'DI'), (37, 'Dose Adicional', 'DA'), (38, 'Reforço', 'REF'),
  (39, '3º Reforço', 'R3'), (40, '4º Reforço', 'R4'), (41, '5º Reforço', 'R5'),
  (42, '6º Reforço', 'R6'), (43, '5ª Dose Revacinacao', 'D5REV'), (44, '1ª Dose Fracionada', 'D1F'),
  (45, '2ª Dose Fracionada', 'D2F'), (46, '3ª Dose Fracionada', 'D3F'),
  (47, '4ª Dose Fracionada', 'D4F'), (48, '5ª Dose Fracionada', 'D5F'),
  (49, '1ª Dose Dobrada', 'D1D'), (50, '2ª Dose Dobrada', 'D2D'), (51, '3ª Dose Dobrada', 'D3D'),
  (52, '4ª Dose Dobrada', 'D4D'), (53, '1ª Dose Revacinação Dobrada', 'D1REVD'),
  (54, '2ª Dose Revacinação Dobrada', 'D2REVD'), (55, '3ª Dose Revacinação Dobrada', 'D3REVD'),
  (56, '4ª Dose Revacinação Dobrada', 'D4REVD'), (57, 'Dose Zero', 'D0'), (58, 'Reforço Zero', 'R0'),
  (59, 'Profilaxia/Tratamento com 1 unidade', 'P/T1'),
  (60, 'Profilaxia/Tratamento com 2 unidades', 'P/T2'),
  (61, 'Profilaxia/Tratamento com 3 unidades', 'P/T3'),
  (62, 'Profilaxia/Tratamento com 4 unidades', 'P/T4'),
  (63, 'Profilaxia/Tratamento com 5 unidades', 'P/T5'),
  (64, 'Profilaxia/Tratamento com 6 unidades', 'P/T6'),
  (65, 'Profilaxia/Tratamento com 7 unidades', 'P/T7'),
  (66, 'Profilaxia/Tratamento com 8 unidades', 'P/T8'),
  (67, 'Profilaxia/Tratamento com 9 unidades', 'P/T9'),
  (68, 'Profilaxia/Tratamento com 10 unidades', 'P/T10'),
  (69, 'Profilaxia/Tratamento com 11 unidades', 'P/T11'),
  (70, 'Profilaxia/Tratamento com 12 unidades', 'P/T12'),
  (71, 'Profilaxia/Tratamento com 13 unidades', 'P/T13'),
  (72, 'Profilaxia/Tratamento com 14 unidades', 'P/T14'),
  (73, 'Profilaxia/Tratamento com 15 unidades', 'P/T15'),
  (74, 'Profilaxia/Tratamento com 16 unidades', 'P/T16'),
  (75, 'Profilaxia/Tratamento com 17 unidades', 'P/T17'),
  (76, 'Profilaxia/Tratamento com 18 unidades', 'P/T18'),
  (77, 'Profilaxia/Tratamento com 19 unidades', 'P/T19'),
  (78, 'Profilaxia/Tratamento com 20 unidades', 'P/T20'),
  (79, 'Profilaxia/Tratamento com 21 unidades', 'P/T21'),
  (80, 'Profilaxia/Tratamento com 22 unidades', 'P/T22'),
  (81, 'Profilaxia/Tratamento com 23 unidades', 'P/T23'),
  (82, 'Profilaxia/Tratamento com 24 unidades', 'P/T24')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, sigla = EXCLUDED.sigla;

INSERT INTO terminologia.vacina_grupo_atendimento (codigo, nome, codigo_rnds, ativo) VALUES
  (5, 'QUILOMBOLA', '000601', true), (6, 'POPULAÇÃO PRIVADA DE LIBERDADE', '001501', true),
  (10, 'OUTROS', '999999', false),
  (13, 'FUNCIONÁRIO DO SISTEMA DE PRIVAÇÃO DE LIBERDADE', '001401', true),
  (31, 'CAMINHONEIRO', '001002', true),
  (32, 'COLETIVO RODOVIÁRIO PASSAGEIROS URBANO E DE LONGO CURSO', '001003', true),
  (33, 'TRABALHADORES PORTUÁRIOS', '001301', true), (34, 'HEMOGLOBINOPATIA GRAVE', '000101', true),
  (35, 'NEOPLASIAS', '000117', false), (36, 'DIABETES MELLITUS', '000103', true),
  (37, 'PNEUMOPATIAS CRÔNICAS GRAVES', '000104', true), (38, 'DOENÇA RENAL CRÔNICA', '000105', true),
  (39, 'DOENÇAS CARDIOVASCULARES E CEREBROVASCULARES', '000116', false),
  (40, 'HIPERTENSÃO DE DIFÍCIL CONTROLE OU COM COMPLICAÇÕES/LESÃO DE ÓRGÃO ALVO', '000107', true),
  (41, 'INDIVÍDUOS TRANSPLANTADOS DE ÓRGÃO SÓLIDO', '000117', false),
  (42, 'OBESIDADE GRAVE (IMC≥40)', '000109', true), (43, 'PESSOAS DE 18 A 64 ANOS', '000210', false),
  (44, 'PESSOAS DE 65 A 69 ANOS', '000210', false), (45, 'PESSOAS DE 70 A 74 ANOS', '000210', false),
  (46, 'PESSOAS DE 75 A 79 ANOS', '000210', false),
  (47, 'PESSOAS DE 80 ANOS OU MAIS', '000210', false),
  (48, 'PESSOAS DE 60 ANOS OU MAIS, INSTITUCIONALIZADAS', '000210', false),
  (49, 'MARINHA DO BRASIL - MB', '000401', true), (50, 'EXÉRCITO BRASILEIRO - EB', '000402', true),
  (51, 'FORÇA AÉREA BRASILEIRA - FAB', '000403', true), (52, 'BOMBEIRO CIVIL', '000501', true),
  (53, 'BOMBEIRO MILITAR', '000502', true), (54, 'GUARDA MUNICIPAL', '000503', true),
  (55, 'POLICIAL RODOVIÁRIO FEDERAL', '000504', true), (56, 'POLICIAL CIVIL', '000505', true),
  (57, 'POLICIAL FEDERAL', '000506', true), (58, 'POLICIAL MILITAR', '000507', true),
  (59, 'RIBEIRINHA', '000602', true), (60, 'POVOS INDÍGENAS EM TERRAS INDÍGENAS', '000703', false),
  (61, 'ENSINO BÁSICO', '000801', true), (62, 'ENSINO SUPERIOR', '000802', true),
  (63, 'AUXILIAR DE VETERINÁRIO', '000901', true), (64, 'BIÓLOGO', '000902', true),
  (65, 'BIOMÉDICO', '000903', true), (66, 'COZINHEIRO E AUXILIARES', '000904', true),
  (67, 'CUIDADOR DE IDOSOS', '000905', true), (68, 'DOULA/PARTEIRA', '000906', true),
  (69, 'ENFERMEIRO(A)', '000907', true), (70, 'FARMACÊUTICO', '000908', true),
  (71, 'FISIOTERAPEUTAS', '000909', true), (72, 'FONOAUDIÓLOGO', '000910', true),
  (73, 'FUNCIONÁRIO DO SISTEMA FUNERÁRIO QUE TENHAM CONTATO COM CADÁVERES POTENCIALMENTE CONTAMINADOS', '000911', true),
  (74, 'MÉDICO', '000912', true), (75, 'MÉDICO VETERINÁRIO', '000913', true),
  (76, 'MOTORISTA DE AMBULÂNCIA', '000914', true), (77, 'NUTRICIONISTA', '000915', true),
  (78, 'ODONTOLOGISTA', '000916', true),
  (79, 'PROFISSIONAIS E AUXILIARES DE LIMPEZA', '000917', true),
  (80, 'PROFISSIONAIS DE EDUCAÇÃO FÍSICA', '000918', true), (81, 'PSICÓLOGO', '000919', true),
  (82, 'RECEPCIONISTA', '000920', true), (83, 'SEGURANÇA', '000921', true),
  (84, 'ASSISTENTE SOCIAL', '000922', true), (85, 'TÉCNICO DE ENFERMAGEM', '000923', true),
  (86, 'TÉCNICO DE VETERINÁRIO', '000924', true), (87, 'TERAPEUTA OCUPACIONAL', '000925', true),
  (88, 'AÉREO', '001001', true), (89, 'FERROVIÁRIO', '001004', true),
  (90, 'METROVIÁRIO', '001005', true), (91, 'AQUAVIÁRIO', '001006', true),
  (92, 'PESSOAS COM DEFICIÊNCIA INSTITUCIONALIZADAS', '001101', true),
  (93, 'PESSOAS COM DEFICIÊNCIA PERMANENTE', '001102', true),
  (94, 'PESSOAS EM SITUAÇÃO DE RUA', '001201', true),
  (95, 'TRABALHADORES INDUSTRIAIS', '001601', true), (96, 'SÍNDROME DE DOWN', '000110', true),
  (97, 'AUXILIAR DE ENFERMAGEM', '000927', true), (98, 'TÉCNICO DE ODONTOLOGIA', '000928', true),
  (99, 'ACADÊMICOS/ESTUDANTES EM ESTÁGIO EM ESTABELECIMENTOS DE SAÚDE', '000929', true),
  (100, 'OUTROS IMUNOCOMPROMETIDOS', '000117', false),
  (101, 'INDIVÍDUOS TRANSPLANTADOS DE MEDULA ÓSSEA', '000117', false),
  (102, 'CIRROSE HEPÁTICA', '000114', false), (103, 'DOENÇA NEUROLÓGICA CRÔNICA', '000115', true),
  (104, 'DOENÇA CARDIOVASCULAR', '000116', true), (105, 'PESSOAS DE 12 A 17 ANOS', '000210', false),
  (106, 'OUTROS PROFISSIONAIS DE SAÚDE', '000926', false),
  (107, 'AGENTE DE COMBATE A ENDEMIAS - ACE', '000930', true),
  (108, 'AGENTE COMUNITÁRIO DE SAÚDE - ACS', '000931', true),
  (109, 'AUXILIAR EM SAÚDE BUCAL - ASB', '000932', true),
  (110, 'TÉCNICO EM SAÚDE BUCAL - TSB', '000933', true),
  (111, 'TRABALHADORES DE LIMPEZA URBANA E MANEJO DE RESÍDUOS SÓLIDOS', '001701', true),
  (112, 'GESTANTE', '001801', true), (113, 'PUÉRPERA', '001901', true),
  (114, 'PESSOAS DE 5 A 11 ANOS', '000210', false), (115, 'CRIANÇAS QUILOMBOLAS', '000601', false),
  (116, 'CRIANÇAS RIBEIRINHAS', '000602', false), (117, 'CRIANÇAS INDÍGENAS', '000704', false),
  (118, 'PESSOAS DE 3 A 4 ANOS', '000210', false),
  (119, 'PESSOAS DE 6 MESES A 2 ANOS', '000210', false), (120, 'IMUNOCOMPROMETIDOS', '000117', true),
  (121, 'FAIXA ETÁRIA', '000210', true),
  (122, 'POVOS INDÍGENAS VIVENDO EM TERRAS INDÍGENAS', '000703', true),
  (123, 'POVOS INDÍGENAS VIVENDO FORA DAS TERRAS INDÍGENAS', '000704', true),
  (124, 'ADOLESCENTES CUMPRINDO MEDIDAS SOCIOEDUCATIVAS', '001502', true),
  (125, 'PESSOAS INSTITUCIONALIZADAS', '000302', true), (126, 'TRISSOMIAS', '000118', true),
  (127, 'OUTROS TRABALHADORES DA SAÚDE', '000926', true), (128, 'PREMATURIDADE', '000120', true),
  (129, 'ANOMALIAS DE VIAS AÉREAS', '000121', true),
  (130, 'OBESIDADE (SCORE-Z ACIMA DE +2)', '000122', true),
  (131, 'ERROS INATOS DA IMUNIDADE (EII)', '000123', true),
  (132, 'DOENÇA HEPÁTICA CRÔNICA', '000119', true), (133, 'POPULAÇÃO RURAL', '002001', true),
  (134, 'TRABALHADORES DOS CORREIOS', '002101', true)
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, codigo_rnds = EXCLUDED.codigo_rnds, ativo = EXCLUDED.ativo;

INSERT INTO terminologia.vacina_fabricante (codigo_rnds, nome) VALUES
  ('38', 'GAMALEYA-SPUTNIK-V'), ('141', 'IVB'), ('142', 'PFIZER'), ('149', 'FIOCRUZ'),
  ('150', 'FUNED'), ('151', 'F.A.P.'), ('152', 'BUTANTAN'), ('153', 'TECPAR'), ('156', 'DADO B.'),
  ('159', 'SMITHKLINE'), ('160', 'GREENCROSS'), ('161', 'AVENTIS'), ('162', 'CHIRON SPA'),
  ('163', 'SERUM-INDIA'), ('164', 'LGCHEMICAL'), ('165', 'MERCK'), ('166', 'BIKEN'),
  ('167', 'SEVAC'), ('168', 'BERNE'), ('169', 'FINLAY'), ('235', 'INCQS'), ('239', 'BAYER CO'),
  ('608', 'BAXTER'), ('712', 'BIOMERIEUX'), ('1659', 'CYANAMID'), ('1913', 'CPPI'),
  ('2250', 'IIMUNO'), ('2260', 'CSL'), ('2263', 'WYETH-LTDA'), ('2355', 'NOVARTIS'),
  ('2560', 'HEBER'), ('2769', 'BERNA'), ('2862', 'SANPASTEUR'), ('2901', 'MERIAL'),
  ('3521', 'BIOVET'), ('9406', 'HALEXISTAR'), ('10534', 'CRUCELL'), ('10885', 'NI'),
  ('11347', 'VIRBAC'), ('12551', 'GRIFOLS'), ('12572', 'KEDRION'), ('13219', 'BIOGENESIS-BAGO S/A'),
  ('13688', 'SHANTHA'), ('16763', 'BIOFARMA'), ('17934', 'BIOLOGICAL'), ('18189', 'INTERVAX'),
  ('18190', 'BB-NCIPD'), ('22942', 'LGLIFE'), ('25538', 'MERCK-CAMPI'), ('26313', 'MERCK-GO'),
  ('26513', 'BEHRING'), ('27816', 'EUBIOLOGI'), ('27880', 'GSK-BRASIL'), ('27883', 'MERCK-RJ'),
  ('28211', 'KAMADA'), ('28251', 'SANMEDLEY'), ('28283', 'VINS'), ('28289', 'GLAXO-BIO'),
  ('28290', 'PFIZER-BELGICA'), ('28303', 'PANACEA'), ('28425', 'BIOGENESIS BAGO SAUDE ANIMAL LTDA'),
  ('28738', 'BOEHRINGER'), ('29501', 'SINOVAC LIFE SCIENCE CO LTD'), ('29909', 'ASTRAZENECA'),
  ('30357', 'EQUIPLEX'), ('30587', 'JANSSEN'), ('31101', 'FARMACE'), ('33502', 'BAV-NORDIC'),
  ('33713', 'AMYIN'), ('35977', 'GAMALEYA'), ('35978', 'MODERNA BIOTECH'), ('35979', 'BHARAT'),
  ('36271', 'ABBOTT-HOLAN'), ('37646', 'EMERGENT'), ('39262', 'IDT BIOLOGIKA'), ('39263', 'TAKEDA'),
  ('42430', 'MODERNA SWITZERLAND GMBH'), ('42488', 'ROVI-PHARMA'), ('42489', 'CATALENT'),
  ('42490', 'SINOVAC BIOTECH CO LTD'), ('42507', 'ADIUM'), ('42655', 'SK-BIOSCEN'),
  ('42931', 'MERCK SHARP & DOHME FARMACEUTICA LTDA - SAO PAULO/SP'), ('42932', 'MSD-LLC'),
  ('43175', 'GSK-SRL'), ('43202', 'GSK-FRANCA'), ('43499', 'GC-BIOPHARMA'),
  ('43897', 'KI BIOPHARMA'), ('44329', 'PATHEON'), ('44618', 'BIONTECH'), ('44779', 'MIBE'),
  ('44781', 'JUBILANT'), ('44805', 'BEIJING'), ('45086', 'PFIZER-IRLANDA'),
  ('45240', 'TAKEDA-JAPAO'), ('45686', 'CORIXA-GSK'),
  ('45915', 'SINOVAC DALIAN VACCINE TECHNOLOGY CO., LTD.'), ('47619', 'LIBBS')
ON CONFLICT (codigo_rnds) DO UPDATE SET nome = EXCLUDED.nome;

INSERT INTO terminologia.vacina_via (codigo, nome, codigo_rnds) VALUES
  (1, 'INTRAVENOSA', '10898'), (2, 'INTRADÉRMICA', '10885'), (3, 'INTRAMUSCULAR', '10890'),
  (5, 'ORAL', '10907'), (6, 'SUBCUTÂNEA', '10916'), (7, 'INTRALESIONAL', '10888')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, codigo_rnds = EXCLUDED.codigo_rnds;

INSERT INTO terminologia.vacina_local (codigo, nome, codigo_rnds) VALUES
  (1, 'BOCA', '9'), (2, 'DELTÓIDE DIREITO', '1'), (3, 'DELTÓIDE ESQUERDO', '2'),
  (4, 'DORSO GLÚTEO DIREITO', '10'), (5, 'DORSO GLÚTEO ESQUERDO', '11'),
  (6, 'FACE ANTEROLATERAL EXTERNA DA COXA DIREITA', '17'),
  (7, 'FACE ANTEROLATERAL EXTERNA DA COXA ESQUERDA', '18'),
  (8, 'FACE ANTEROLATERAL EXTERNA DO BRAÇO DIREITO', '19'),
  (9, 'FACE ANTEROLATERAL EXTERNA DO BRAÇO ESQUERDO', '20'),
  (10, 'FACE ANTEROLATERAL EXTERNA DO ANTEBRAÇO DIREITO', '21'),
  (11, 'FACE ANTEROLATERAL EXTERNA DO ANTEBRAÇO ESQUERDO', '22'),
  (12, 'FACE EXTERNA INFERIOR DO BRAÇO DIREITO', '12'),
  (13, 'FACE EXTERNA INFERIOR DO BRAÇO ESQUERDO', '13'),
  (14, 'FACE EXTERNA SUPERIOR DO BRAÇO DIREITO', '14'),
  (15, 'FACE EXTERNA SUPERIOR DO BRAÇO ESQUERDO', '15'), (16, 'OUTRO', '99'),
  (17, 'REDE VENOSA', '16'), (18, 'VASTO LATERAL DA COXA DIREITA', '3'),
  (19, 'VASTO LATERAL DA COXA ESQUERDA', '4'), (20, 'VENTRO GLÚTEO DIREITO', '5'),
  (21, 'VENTRO GLÚTEO ESQUERDO', '6'), (22, 'FERIMENTO LOCAL', '8')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, codigo_rnds = EXCLUDED.codigo_rnds;

INSERT INTO terminologia.vacina_via_local (via, local) VALUES
  (1, 17), (2, 6), (2, 7), (2, 8), (2, 9), (2, 10), (2, 11), (2, 12), (2, 13), (2, 14), (2, 15),
  (2, 16), (3, 2), (3, 3), (3, 4), (3, 5), (3, 16), (3, 18), (3, 19), (3, 20), (3, 21), (5, 1),
  (6, 6), (6, 7), (6, 8), (6, 9), (6, 10), (6, 11), (6, 12), (6, 13), (6, 14), (6, 15), (6, 16),
  (7, 22)
ON CONFLICT DO NOTHING;

INSERT INTO terminologia.vacina_regra (imunobiologico, estrategia, dose) VALUES
  (1, 2, 59), (1, 2, 60), (1, 2, 61), (1, 2, 62), (1, 2, 63), (1, 2, 64), (1, 2, 65), (1, 2, 66),
  (1, 2, 67), (1, 2, 68), (1, 2, 69), (1, 2, 70), (1, 2, 71), (1, 2, 72), (1, 2, 73), (1, 2, 74),
  (1, 2, 75), (1, 2, 76), (1, 2, 77), (1, 2, 78), (1, 2, 79), (1, 2, 80), (1, 2, 81), (1, 2, 82),
  (2, 7, 59), (2, 7, 60), (2, 7, 61), (2, 7, 62), (2, 7, 63), (2, 7, 64), (2, 7, 65), (2, 7, 66),
  (2, 7, 67), (2, 7, 68), (2, 7, 69), (2, 7, 70), (2, 7, 71), (2, 7, 72), (2, 7, 73), (2, 7, 74),
  (2, 7, 75), (2, 7, 76), (2, 7, 77), (2, 7, 78), (2, 7, 79), (2, 7, 80), (2, 7, 81), (2, 7, 82),
  (3, 7, 59), (3, 7, 60), (3, 7, 61), (3, 7, 62), (3, 7, 63), (3, 7, 64), (3, 7, 65), (3, 7, 66),
  (3, 7, 67), (3, 7, 68), (3, 7, 69), (3, 7, 70), (3, 7, 71), (3, 7, 72), (3, 7, 73), (3, 7, 74),
  (3, 7, 75), (3, 7, 76), (3, 7, 77), (3, 7, 78), (3, 7, 79), (3, 7, 80), (3, 7, 81), (3, 7, 82),
  (4, 7, 59), (4, 7, 60), (4, 7, 61), (4, 7, 62), (4, 7, 63), (4, 7, 64), (4, 7, 65), (4, 7, 66),
  (4, 7, 67), (4, 7, 68), (4, 7, 69), (4, 7, 70), (4, 7, 71), (4, 7, 72), (4, 7, 73), (4, 7, 74),
  (4, 7, 75), (4, 7, 76), (4, 7, 77), (4, 7, 78), (4, 7, 79), (4, 7, 80), (4, 7, 81), (4, 7, 82),
  (5, 2, 1), (5, 2, 2), (5, 2, 6), (5, 2, 7), (6, 7, 59), (6, 7, 60), (6, 7, 61), (6, 7, 62),
  (6, 7, 63), (6, 7, 64), (6, 7, 65), (6, 7, 66), (6, 7, 67), (6, 7, 68), (6, 7, 69), (6, 7, 70),
  (6, 7, 71), (6, 7, 72), (6, 7, 73), (6, 7, 74), (6, 7, 75), (6, 7, 76), (6, 7, 77), (6, 7, 78),
  (6, 7, 79), (6, 7, 80), (6, 7, 81), (6, 7, 82), (7, 7, 59), (7, 7, 60), (7, 7, 61), (7, 7, 62),
  (7, 7, 63), (7, 7, 64), (7, 7, 65), (7, 7, 66), (7, 7, 67), (7, 7, 68), (7, 7, 69), (7, 7, 70),
  (7, 7, 71), (7, 7, 72), (7, 7, 73), (7, 7, 74), (7, 7, 75), (7, 7, 76), (7, 7, 77), (7, 7, 78),
  (7, 7, 79), (7, 7, 80), (7, 7, 81), (7, 7, 82), (8, 7, 59), (8, 7, 60), (8, 7, 61), (8, 7, 62),
  (8, 7, 63), (8, 7, 64), (8, 7, 65), (8, 7, 66), (8, 7, 67), (8, 7, 68), (8, 7, 69), (8, 7, 70),
  (8, 7, 71), (8, 7, 72), (8, 7, 73), (8, 7, 74), (8, 7, 75), (8, 7, 76), (8, 7, 77), (8, 7, 78),
  (8, 7, 79), (8, 7, 80), (8, 7, 81), (8, 7, 82), (9, 1, 1), (9, 1, 2), (9, 1, 3), (9, 1, 8),
  (9, 2, 1), (9, 2, 2), (9, 2, 3), (9, 2, 32), (9, 2, 33), (9, 2, 34), (9, 2, 49), (9, 2, 50),
  (9, 2, 51), (9, 2, 52), (9, 2, 53), (9, 2, 54), (9, 2, 55), (9, 2, 56), (9, 15, 1), (9, 15, 2),
  (9, 15, 3), (9, 15, 8), (10, 7, 59), (10, 7, 60), (10, 7, 61), (10, 7, 62), (10, 7, 63),
  (10, 7, 64), (10, 7, 65), (10, 7, 66), (10, 7, 67), (10, 7, 68), (10, 7, 69), (10, 7, 70),
  (10, 7, 71), (10, 7, 72), (10, 7, 73), (10, 7, 74), (10, 7, 75), (10, 7, 76), (10, 7, 77),
  (10, 7, 78), (10, 7, 79), (10, 7, 80), (10, 7, 81), (10, 7, 82), (11, 7, 59), (11, 7, 60),
  (11, 7, 61), (11, 7, 62), (11, 7, 63), (11, 7, 64), (11, 7, 65), (11, 7, 66), (11, 7, 67),
  (11, 7, 68), (11, 7, 69), (11, 7, 70), (11, 7, 71), (11, 7, 72), (11, 7, 73), (11, 7, 74),
  (11, 7, 75), (11, 7, 76), (11, 7, 77), (11, 7, 78), (11, 7, 79), (11, 7, 80), (11, 7, 81),
  (11, 7, 82), (12, 7, 59), (12, 7, 60), (12, 7, 61), (12, 7, 62), (12, 7, 63), (12, 7, 64),
  (12, 7, 65), (12, 7, 66), (12, 7, 67), (12, 7, 68), (12, 7, 69), (12, 7, 70), (12, 7, 71),
  (12, 7, 72), (12, 7, 73), (12, 7, 74), (12, 7, 75), (12, 7, 76), (12, 7, 77), (12, 7, 78),
  (12, 7, 79), (12, 7, 80), (12, 7, 81), (12, 7, 82), (14, 1, 8), (14, 1, 9), (14, 1, 38),
  (14, 3, 8), (14, 3, 9), (14, 3, 38), (14, 4, 8), (14, 4, 9), (14, 4, 38), (14, 9, 8), (14, 9, 9),
  (14, 9, 38), (14, 15, 8), (14, 15, 9), (14, 15, 38), (15, 1, 8), (15, 1, 9), (15, 2, 8),
  (15, 4, 9), (15, 15, 9), (16, 7, 59), (16, 7, 60), (16, 7, 61), (16, 7, 62), (16, 7, 63),
  (16, 7, 64), (16, 7, 65), (16, 7, 66), (16, 7, 67), (16, 7, 68), (16, 7, 69), (16, 7, 70),
  (16, 7, 71), (16, 7, 72), (16, 7, 73), (16, 7, 74), (16, 7, 75), (16, 7, 76), (16, 7, 77),
  (16, 7, 78), (16, 7, 79), (16, 7, 80), (16, 7, 81), (16, 7, 82), (17, 2, 1), (17, 2, 2),
  (17, 2, 3), (17, 2, 6), (17, 2, 8), (17, 2, 9), (19, 2, 59), (19, 2, 60), (19, 2, 61), (19, 2, 62),
  (19, 2, 63), (19, 2, 64), (19, 2, 65), (19, 2, 66), (19, 2, 67), (19, 2, 68), (19, 2, 69),
  (19, 2, 70), (19, 2, 71), (19, 2, 72), (19, 2, 73), (19, 2, 74), (19, 2, 75), (19, 2, 76),
  (19, 2, 77), (19, 2, 78), (19, 2, 79), (19, 2, 80), (19, 2, 81), (19, 2, 82), (20, 2, 59),
  (20, 2, 60), (20, 2, 61), (20, 2, 62), (20, 2, 63), (20, 2, 64), (20, 2, 65), (20, 2, 66),
  (20, 2, 67), (20, 2, 68), (20, 2, 69), (20, 2, 70), (20, 2, 71), (20, 2, 72), (20, 2, 73),
  (20, 2, 74), (20, 2, 75), (20, 2, 76), (20, 2, 77), (20, 2, 78), (20, 2, 79), (20, 2, 80),
  (20, 2, 81), (20, 2, 82), (21, 1, 1), (21, 1, 2), (21, 2, 1), (21, 2, 2), (21, 15, 1), (21, 15, 2),
  (22, 1, 1), (22, 1, 2), (22, 1, 3), (22, 1, 6), (22, 1, 7), (22, 2, 1), (22, 2, 2), (22, 2, 3),
  (22, 2, 6), (22, 2, 7), (22, 4, 1), (22, 4, 2), (22, 4, 3), (22, 4, 6), (22, 4, 7), (22, 5, 8),
  (22, 9, 1), (22, 9, 2), (22, 9, 3), (22, 9, 6), (22, 9, 7), (22, 9, 8), (22, 15, 1), (22, 15, 2),
  (22, 15, 3), (22, 15, 6), (22, 15, 7), (23, 2, 59), (23, 2, 60), (23, 2, 61), (23, 2, 62),
  (23, 2, 63), (23, 2, 64), (23, 2, 65), (23, 2, 66), (23, 2, 67), (23, 2, 68), (23, 2, 69),
  (23, 2, 70), (23, 2, 71), (23, 2, 72), (23, 2, 73), (23, 2, 74), (23, 2, 75), (23, 2, 76),
  (23, 2, 77), (23, 2, 78), (23, 2, 79), (23, 2, 80), (23, 2, 81), (23, 2, 82), (24, 1, 1),
  (24, 1, 2), (24, 1, 8), (24, 3, 1), (24, 3, 2), (24, 3, 8), (24, 3, 57), (24, 4, 1), (24, 4, 2),
  (24, 4, 8), (24, 4, 57), (24, 5, 8), (24, 6, 1), (24, 6, 2), (24, 9, 1), (24, 9, 2), (24, 9, 8),
  (24, 9, 57), (24, 15, 1), (24, 15, 2), (25, 1, 1), (25, 1, 2), (25, 1, 3), (25, 1, 38), (25, 2, 1),
  (25, 2, 2), (25, 3, 1), (25, 3, 2), (25, 3, 3), (25, 3, 38), (25, 4, 1), (25, 4, 2), (25, 4, 3),
  (25, 4, 38), (25, 15, 1), (25, 15, 2), (25, 15, 3), (25, 15, 38), (26, 1, 1), (26, 1, 2),
  (26, 1, 9), (26, 1, 38), (26, 2, 1), (26, 2, 2), (26, 2, 3), (26, 2, 38), (26, 4, 1), (26, 4, 2),
  (26, 4, 9), (26, 4, 38), (26, 9, 1), (26, 9, 2), (26, 9, 3), (26, 9, 38), (26, 15, 1), (26, 15, 2),
  (26, 15, 9), (26, 15, 38), (28, 5, 8), (28, 9, 8), (29, 2, 1), (29, 2, 2), (29, 2, 3), (29, 2, 38),
  (30, 1, 9), (30, 1, 10), (31, 7, 59), (31, 7, 60), (31, 7, 61), (31, 7, 62), (31, 7, 63),
  (31, 7, 64), (31, 7, 65), (31, 7, 66), (31, 7, 67), (31, 7, 68), (31, 7, 69), (31, 7, 70),
  (31, 7, 71), (31, 7, 72), (31, 7, 73), (31, 7, 74), (31, 7, 75), (31, 7, 76), (31, 7, 77),
  (31, 7, 78), (31, 7, 79), (31, 7, 80), (31, 7, 81), (31, 7, 82), (32, 7, 59), (32, 7, 60),
  (32, 7, 61), (32, 7, 62), (32, 7, 63), (32, 7, 64), (32, 7, 65), (32, 7, 66), (32, 7, 67),
  (32, 7, 68), (32, 7, 69), (32, 7, 70), (32, 7, 71), (32, 7, 72), (32, 7, 73), (32, 7, 74),
  (32, 7, 75), (32, 7, 76), (32, 7, 77), (32, 7, 78), (32, 7, 79), (32, 7, 80), (32, 7, 81),
  (32, 7, 82), (33, 1, 1), (33, 1, 2), (33, 1, 9), (33, 2, 1), (33, 2, 2), (33, 2, 9), (33, 5, 1),
  (33, 5, 2), (33, 5, 9), (33, 15, 1), (33, 15, 2), (33, 15, 9), (34, 1, 1), (34, 1, 2), (34, 2, 1),
  (34, 2, 2), (34, 2, 57), (34, 3, 1), (34, 3, 2), (34, 3, 57), (34, 4, 1), (34, 4, 2), (34, 15, 1),
  (34, 15, 2), (36, 3, 57), (36, 4, 57), (37, 12, 1), (37, 12, 2), (37, 12, 38), (37, 13, 1),
  (37, 13, 2), (37, 13, 3), (37, 13, 4), (37, 14, 1), (37, 14, 2), (37, 14, 3), (37, 14, 4),
  (41, 1, 1), (41, 1, 2), (41, 1, 8), (41, 1, 9), (41, 1, 38), (41, 2, 1), (41, 2, 2), (41, 2, 8),
  (41, 2, 38), (41, 3, 1), (41, 3, 2), (41, 3, 8), (41, 3, 9), (41, 3, 38), (41, 4, 1), (41, 4, 2),
  (41, 4, 8), (41, 4, 9), (41, 4, 38), (41, 9, 1), (41, 9, 2), (41, 9, 8), (41, 9, 9), (41, 9, 38),
  (41, 15, 1), (41, 15, 2), (41, 15, 8), (41, 15, 9), (41, 15, 38), (42, 1, 1), (42, 1, 2),
  (42, 1, 3), (42, 1, 6), (42, 1, 7), (42, 2, 8), (42, 4, 1), (42, 4, 2), (42, 4, 3), (42, 9, 1),
  (42, 9, 2), (42, 9, 3), (42, 15, 1), (42, 15, 2), (42, 15, 3), (42, 15, 6), (42, 15, 7),
  (43, 1, 1), (43, 1, 2), (43, 1, 3), (43, 2, 1), (43, 2, 2), (43, 2, 3), (43, 2, 6), (43, 2, 7),
  (43, 2, 8), (45, 1, 1), (45, 1, 2), (45, 4, 1), (45, 4, 2), (45, 9, 1), (45, 9, 2), (45, 15, 1),
  (45, 15, 2), (46, 1, 6), (46, 1, 7), (46, 3, 6), (46, 3, 7), (46, 4, 6), (46, 4, 7), (46, 9, 6),
  (46, 9, 7), (46, 15, 6), (46, 15, 7), (47, 2, 6), (47, 2, 7), (55, 1, 9), (55, 2, 1), (55, 2, 2),
  (55, 2, 9), (55, 3, 9), (55, 4, 9), (55, 15, 9), (56, 1, 9), (56, 2, 1), (56, 2, 2), (56, 2, 9),
  (56, 3, 9), (56, 4, 9), (56, 9, 9), (56, 15, 9), (57, 1, 8), (57, 1, 38), (57, 2, 1), (57, 2, 2),
  (57, 2, 3), (57, 2, 8), (57, 3, 8), (57, 4, 8), (57, 4, 38), (57, 15, 8), (57, 15, 38), (59, 1, 1),
  (59, 1, 2), (59, 1, 9), (59, 1, 38), (59, 2, 1), (59, 2, 2), (59, 2, 3), (59, 2, 6), (59, 2, 9),
  (59, 15, 1), (59, 15, 2), (59, 15, 9), (59, 15, 38), (67, 1, 9), (67, 2, 1), (67, 2, 2),
  (67, 2, 3), (67, 4, 9), (67, 15, 9), (69, 7, 59), (69, 7, 60), (69, 7, 61), (69, 7, 62),
  (69, 7, 63), (69, 7, 64), (69, 7, 65), (69, 7, 66), (69, 7, 67), (69, 7, 68), (69, 7, 69),
  (69, 7, 70), (69, 7, 71), (69, 7, 72), (69, 7, 73), (69, 7, 74), (69, 7, 75), (69, 7, 76),
  (69, 7, 77), (69, 7, 78), (69, 7, 79), (69, 7, 80), (69, 7, 81), (69, 7, 82), (74, 1, 1),
  (74, 1, 2), (74, 1, 8), (74, 1, 9), (74, 1, 38), (74, 2, 1), (74, 2, 2), (74, 2, 38), (74, 3, 1),
  (74, 3, 2), (74, 3, 8), (74, 3, 9), (74, 3, 38), (74, 4, 1), (74, 4, 2), (74, 4, 8), (74, 4, 9),
  (74, 4, 38), (74, 9, 1), (74, 9, 2), (74, 9, 8), (74, 9, 9), (74, 9, 38), (74, 15, 1), (74, 15, 2),
  (74, 15, 8), (74, 15, 9), (74, 15, 38), (75, 1, 8), (83, 2, 1), (83, 2, 2), (87, 1, 8),
  (87, 1, 10), (87, 2, 1), (87, 2, 2), (87, 2, 3), (87, 2, 8), (87, 2, 10), (87, 2, 32), (87, 2, 33),
  (87, 2, 34), (87, 5, 8), (87, 5, 10), (87, 6, 8), (87, 6, 10), (97, 1, 1), (97, 1, 2), (97, 1, 8),
  (97, 1, 10), (97, 2, 1), (97, 2, 2), (97, 2, 3), (97, 2, 8), (97, 2, 10), (97, 2, 32), (97, 2, 33),
  (97, 2, 34), (97, 5, 8), (97, 5, 10), (97, 6, 1), (97, 6, 2), (97, 6, 8), (97, 6, 10), (97, 15, 1),
  (97, 15, 2), (99, 1, 8), (99, 1, 10), (99, 2, 1), (99, 2, 2), (99, 2, 3), (99, 2, 8), (99, 2, 10),
  (99, 2, 32), (99, 2, 33), (99, 2, 34), (99, 5, 8), (99, 5, 10), (99, 6, 8), (99, 6, 10),
  (100, 3, 1), (100, 3, 2), (100, 4, 1), (100, 4, 2), (102, 1, 1), (102, 1, 2), (102, 1, 3),
  (102, 1, 10), (102, 2, 1), (102, 2, 2), (102, 2, 3), (102, 2, 8), (102, 2, 10), (102, 2, 32),
  (102, 2, 33), (102, 2, 34), (102, 5, 8), (102, 5, 10), (102, 6, 1), (102, 6, 2), (102, 6, 3),
  (102, 6, 8), (102, 6, 10), (102, 15, 1), (102, 15, 2), (102, 15, 3), (104, 1, 1), (104, 1, 2),
  (104, 1, 9), (104, 15, 1), (104, 15, 2), (107, 1, 1), (107, 1, 2), (107, 1, 9), (107, 1, 38),
  (107, 2, 1), (107, 2, 2), (107, 2, 3), (107, 2, 9), (107, 2, 32), (107, 2, 33), (107, 2, 34),
  (107, 2, 37), (107, 2, 38), (107, 4, 1), (107, 4, 2), (107, 4, 9), (107, 4, 38), (107, 9, 1),
  (107, 9, 2), (107, 9, 3), (107, 9, 9), (107, 9, 38), (107, 15, 1), (107, 15, 2), (107, 15, 9),
  (107, 15, 38), (108, 1, 9), (112, 1, 8), (112, 1, 10), (112, 2, 1), (112, 2, 2), (112, 2, 3),
  (112, 2, 8), (112, 2, 10), (112, 2, 32), (112, 2, 33), (112, 2, 34), (112, 5, 8), (112, 5, 10),
  (112, 6, 8), (112, 6, 10), (113, 5, 9), (115, 2, 59), (116, 2, 59), (116, 2, 60)
ON CONFLICT DO NOTHING;

INSERT INTO terminologia.vacina_cbo (cbo, nome) VALUES
  ('2231F9', 'MÉDICO RESIDENTE'), ('223305', 'MÉDICO VETERINÁRIO'), ('223405', 'FARMACÊUTICO'),
  ('223410', 'FARMACEUTICO BIOQUIMICO'), ('223415', 'FARMACÊUTICO ANALISTA CLÍNICO'),
  ('223425', 'FARMACÊUTICO PRÁTICAS INTEGRATIVAS E COMPLEMENTARES'),
  ('223430', 'FARMACÊUTICO EM SAÚDE PÚBLICA'), ('223445', 'FARMACÊUTICO HOSPITALAR E CLÍNICO'),
  ('223505', 'ENFERMEIRO'), ('223520', 'ENFERMEIRO DE CENTRO CIRÚRGICO'),
  ('223525', 'ENFERMEIRO DE TERAPIA INTENSIVA'), ('223530', 'ENFERMEIRO DO TRABALHO'),
  ('223535', 'ENFERMEIRO NEFROLOGISTA'), ('223540', 'ENFERMEIRO NEONATOLOGISTA'),
  ('223545', 'ENFERMEIRO OBSTÉTRICO'), ('223550', 'ENFERMEIRO PSIQUIÁTRICO'),
  ('223555', 'ENFERMEIRO PUERICULTOR E PEDIÁTRICO'), ('223560', 'ENFERMEIRO SANITARISTA'),
  ('223565', 'ENFERMEIRO DA ESTRATÉGIA DE SAÚDE DA FAMÍLIA'), ('225103', 'MÉDICO INFECTOLOGISTA'),
  ('225105', 'MÉDICO ACUPUNTURISTA'), ('225106', 'MÉDICO LEGISTA'),
  ('225109', 'MÉDICO NEFROLOGISTA'), ('225110', 'MÉDICO ALERGISTA E IMUNOLOGISTA'),
  ('225112', 'MÉDICO NEUROLOGISTA'), ('225115', 'MÉDICO ANGIOLOGISTA'),
  ('225118', 'MÉDICO NUTROLOGISTA'), ('225120', 'MÉDICO CARDIOLOGISTA'),
  ('225121', 'MÉDICO ONCOLOGISTA CLÍNICO'), ('225122', 'MÉDICO CANCEROLOGISTA PEDIÁTRICO'),
  ('225124', 'MÉDICO PEDIATRA'), ('225125', 'MÉDICO CLÍNICO'), ('225127', 'MÉDICO PNEUMOLOGISTA'),
  ('225130', 'MÉDICO DE FAMÍLIA E COMUNIDADE'), ('225133', 'MÉDICO PSIQUIATRA'),
  ('225135', 'MÉDICO DERMATOLOGISTA'), ('225136', 'MÉDICO REUMATOLOGISTA'),
  ('225139', 'MÉDICO SANITARISTA'), ('225140', 'MÉDICO DO TRABALHO'),
  ('225142', 'MÉDICO DA ESTRATÉGIA DE SAÚDE DA FAMÍLIA'),
  ('225145', 'MÉDICO EM MEDICINA DE TRÁFEGO'), ('225148', 'MÉDICO ANATOMOPATOLOGISTA'),
  ('225150', 'MÉDICO EM MEDICINA INTENSIVA'), ('225151', 'MÉDICO ANESTESIOLOGISTA'),
  ('225154', 'MÉDICO ANTROPOSÓFICO'), ('225155', 'MÉDICO ENDOCRINOLOGISTA E METABOLOGISTA'),
  ('225160', 'MÉDICO FISIATRA'), ('225165', 'MÉDICO GASTROENTEROLOGISTA'),
  ('225170', 'MÉDICO GENERALISTA'), ('225175', 'MÉDICO GENETICISTA'), ('225180', 'MÉDICO GERIATRA'),
  ('225185', 'MÉDICO HEMATOLOGISTA'), ('225195', 'MÉDICO HOMEOPATA'),
  ('225203', 'MÉDICO EM CIRURGIA VASCULAR'), ('225210', 'MÉDICO CIRURGIÃO CARDIOVASCULAR'),
  ('225215', 'MÉDICO CIRURGIÃO DE CABEÇA E PESCOÇO'),
  ('225220', 'MÉDICO CIRURGIÃO DO APARELHO DIGESTIVO'), ('225225', 'MÉDICO CIRURGIÃO GERAL'),
  ('225230', 'MÉDICO CIRURGIÃO PEDIÁTRICO'), ('225235', 'MÉDICO CIRURGIÃO PLÁSTICO'),
  ('225240', 'MÉDICO CIRURGIÃO TORÁCICO'), ('225250', 'MÉDICO GINECOLOGISTA E OBSTETRA'),
  ('225255', 'MÉDICO MASTOLOGISTA'), ('225260', 'MÉDICO NEUROCIRURGIÃO'),
  ('225265', 'MÉDICO OFTALMOLOGISTA'), ('225270', 'MÉDICO ORTOPEDISTA E TRAUMATOLOGISTA'),
  ('225275', 'MÉDICO OTORRINOLARINGOLOGISTA'), ('225280', 'MÉDICO COLOPROCTOLOGISTA'),
  ('225285', 'MÉDICO UROLOGISTA'), ('225290', 'MÉDICO CANCEROLOGISTA CIRURGICO'),
  ('225295', 'MÉDICO CIRURGIÃO DA MÃO'), ('225305', 'MÉDICO CITOPATOLOGISTA'),
  ('225310', 'MÉDICO EM ENDOSCOPIA'), ('225315', 'MÉDICO EM MEDICINA NUCLEAR'),
  ('225320', 'MÉDICO EM RADIOLOGIA E DIAGNÓSTICO POR IMAGEM'), ('225325', 'MÉDICO PATOLOGISTA'),
  ('225330', 'MÉDICO RADIOTERAPEUTA'),
  ('225335', 'MÉDICO PATOLOGISTA CLÍNICO / MEDICINA LABORATORIAL'),
  ('225340', 'MÉDICO HEMOTERAPEUTA'), ('225345', 'MÉDICO HIPERBARISTA'),
  ('225350', 'MÉDICO NEUROFISIOLOGISTA CLÍNICO'), ('322205', 'TÉCNICO DE ENFERMAGEM'),
  ('322210', 'TÉCNICO DE ENFERMAGEM DE TERAPIA INTENSIVA'),
  ('322215', 'TÉCNICO DE ENFERMAGEM DO TRABALHO'), ('322220', 'TÉCNICO DE ENFERMAGEM PSIQUIÁTRICA'),
  ('322230', 'AUXILIAR DE ENFERMAGEM'), ('322235', 'AUXILIAR DE ENFERMAGEM DO TRABALHO'),
  ('322245', 'TÉCNICO DE ENFERMAGEM DA ESTRATÉGIA DE SAÚDE DA FAMÍLIA'),
  ('322250', 'AUXILIAR DE ENFERMAGEM DA ESTRATÉGIA DE SAÚDE DA FAMÍLIA'),
  ('515110', 'ATENDENTE DE ENFERMAGEM')
ON CONFLICT (cbo) DO UPDATE SET nome = EXCLUDED.nome;
