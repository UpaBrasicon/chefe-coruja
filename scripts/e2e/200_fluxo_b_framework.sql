-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B (25/11/2026): porta da UPA Homologação → internação →
-- regulação, 10 pacientes fictícios "Teste Fluxo B01…B10". Só homologação.
--
-- Um login só (teste.homolog) tem todos os papéis. Para cada passo valer pelo
-- papel certo, e2e.fb desliga os outros vínculos do login DENTRO do passo e
-- religa no fim (mesma transação; o que falha desfaz sozinho). Papéis:
--   rec, enf, tec, med, nir, ges, far  → só esse papel na UPA Homologação
--   reg                                → só regulador da Central
--   regupa                             → só o papel regulador na UPA (regulador sem papel na central)
--   dmed, dges                         → só médico / gestor do Hospital de Referência
--   login                              → o login como está (todos os papéis)
--   banco                              → postgres (conferência do que a tela não mostra)
-- Resultado em e2e.resultados (passo 'FB.<fase>.<nome>', paciente = n).
-- ════════════════════════════════════════════════════════════════════════════
DO $t$ BEGIN
  IF NOT coalesce((SELECT c.valor FROM public.configuracao_plataforma c WHERE c.chave = 'ambiente_teste'), false) THEN
    RAISE EXCEPTION 'Este banco não é de teste.'; END IF;
END $t$;

CREATE OR REPLACE FUNCTION e2e.fb_login() RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT '757db1d9-589d-461c-bed6-24adfed1fa29'::uuid $$;
CREATE OR REPLACE FUNCTION e2e.fb_upa() RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT '31000000-0000-4000-8000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION e2e.fb_central() RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT '31000000-0000-4000-8000-0000000000c1'::uuid $$;
CREATE OR REPLACE FUNCTION e2e.fb_hosp() RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT '31000000-0000-4000-8000-0000000000d1'::uuid $$;
CREATE OR REPLACE FUNCTION e2e.fbv(p_n int, p_nome text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT valor FROM e2e.vars WHERE nome = 'fb' || p_n || '_' || p_nome $$;
CREATE OR REPLACE FUNCTION e2e.fbu(p_n int, p_nome text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT e2e.fbv(p_n, p_nome)::uuid $$;
CREATE OR REPLACE FUNCTION e2e.fb_confere(p boolean, p_msg text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN IF p IS NOT TRUE THEN RAISE EXCEPTION 'confere: %', coalesce(p_msg, '(nulo)'); END IF; RETURN 'ok: ' || coalesce(p_msg, ''); END $$;
CREATE OR REPLACE FUNCTION e2e.fb_falhar(p text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '%', p; END $$;
-- guarda o número do pedido de regulação (fb<n>_num) e devolve vazio, para compor com a conferência
CREATE OR REPLACE FUNCTION e2e.fb_guardar_numero(p_n int, p_numero bigint) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO e2e.vars VALUES ('fb' || p_n || '_num', p_numero::text) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor;
  RETURN '';
END $$;
GRANT USAGE ON SCHEMA e2e TO authenticated;
GRANT EXECUTE ON FUNCTION e2e.fb_confere(boolean, text), e2e.fb_falhar(text) TO authenticated;

-- CNS fictício com dígito verificador válido
CREATE OR REPLACE FUNCTION e2e.fb_cns(p_n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE base text; s int; d int; k int := 0; i int;
BEGIN
  LOOP
    base := '7' || lpad((92500000000 + p_n * 7 + k)::text, 13, '0');
    s := 0;
    FOR i IN 1..14 LOOP s := s + substr(base, i, 1)::int * (16 - i); END LOOP;
    d := (11 - s % 11) % 11;
    IF d < 10 THEN RETURN base || d; END IF;
    k := k + 1;
  END LOOP;
END $$;

-- sinais vitais crus como a tela grava (sincronizar_registros)
CREATE OR REPLACE FUNCTION e2e.fb_sinais_sql(p_pac uuid, p_sinais jsonb, p_internacao uuid DEFAULT NULL, p_metodo text DEFAULT NULL)
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT format($q$SELECT CASE WHEN bool_and(x ->> 'status' = 'gravado') THEN count(*)::text || ' sinais gravados'
                             ELSE e2e.fb_falhar(string_agg(coalesce(x ->> 'motivo', x::text), '; ')) END
                     FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)::jsonb) x$q$,
    (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'observacao', 'hora', now(), 'sem_conexao', false,
              'aparelho_id', 'e2e-fluxo-b',
              'dados', jsonb_build_object('paciente_id', p_pac, 'internacao_id', p_internacao,
                         'conceito_id', (SELECT c.id FROM public.conceito c WHERE c.nome = k.key AND c.unidade_id IS NULL),
                         'valor_num', k.value, 'origem', 'manual', 'metodo', p_metodo)))
       FROM jsonb_each(p_sinais) k))
$$;

-- p_antes: SQL rodado como postgres dentro do passo, antes de virar o papel. Serve
-- para os caminhos errados que precisam de OUTRA pessoa (o login de teste é o
-- solicitante de tudo): troca o solicitante do pedido e o passo é desfeito.
DROP FUNCTION IF EXISTS e2e.fb(int, text, text, text, text, text, text, boolean, text);
CREATE OR REPLACE FUNCTION e2e.fb(p_n int, p_passo text, p_papel text, p_descricao text, p_sql text,
                                 p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL, p_desfazer boolean DEFAULT false,
                                 p_dep text DEFAULT NULL, p_antes text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_res text; v_ok boolean; v_err text; v_sit text; v_det text; v_dep text; v_off uuid[];
  v_unidade uuid; v_papel text; v_sa jsonb;
BEGIN
  FOREACH v_dep IN ARRAY string_to_array(coalesce(p_dep, ''), ',') LOOP
    IF btrim(v_dep) <> '' AND e2e.fbv(p_n, btrim(v_dep)) IS NULL THEN
      INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
      VALUES (p_passo, p_n, p_papel, NULL, p_descricao, p_esperado, 'lacuna', 'bloqueado por passo anterior (sem ' || btrim(v_dep) || ')');
      RETURN 'lacuna — B' || lpad(p_n::text, 2, '0') || ' ' || p_passo || ' — bloqueado (sem ' || btrim(v_dep) || ')';
    END IF;
  END LOOP;
  IF p_sql IS NULL THEN
    INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
    VALUES (p_passo, p_n, p_papel, NULL, p_descricao, p_esperado, 'lacuna', 'SQL do passo nulo (faltou dado anterior)');
    RETURN 'lacuna — B' || lpad(p_n::text, 2, '0') || ' ' || p_passo || ' — SQL nulo';
  END IF;
  SELECT x.u, x.p INTO v_unidade, v_papel FROM (VALUES
    ('rec', e2e.fb_upa(), 'recepcao'), ('enf', e2e.fb_upa(), 'enfermeiro'), ('tec', e2e.fb_upa(), 'tecnico_enfermagem'),
    ('med', e2e.fb_upa(), 'plantonista'), ('nir', e2e.fb_upa(), 'nir'), ('ges', e2e.fb_upa(), 'gestor'), ('far', e2e.fb_upa(), 'farmaceutico'),
    ('fat', e2e.fb_upa(), 'faturamento'), ('tele', e2e.fb_upa(), 'telemedicina'), ('reg', e2e.fb_central(), 'regulador'), ('regupa', e2e.fb_upa(), 'regulador'), ('dmed', e2e.fb_hosp(), 'plantonista'), ('dges', e2e.fb_hosp(), 'gestor')) x(k, u, p)
   WHERE x.k = p_papel;
  IF v_papel IS NULL AND p_papel NOT IN ('login', 'banco') THEN RAISE EXCEPTION 'papel de teste desconhecido: %', p_papel; END IF;
  BEGIN
    IF p_antes IS NOT NULL THEN
      IF NOT p_desfazer THEN RAISE EXCEPTION 'p_antes só em passo desfeito'; END IF;
      EXECUTE p_antes;
    END IF;
    IF v_papel IS NOT NULL THEN
      WITH u AS (UPDATE public.vinculos SET ativo = false
                  WHERE perfil_id = e2e.fb_login() AND ativo AND NOT (unidade_id = v_unidade AND papel::text = v_papel) RETURNING id)
      SELECT array_agg(id) INTO v_off FROM u;
      -- o login de teste também é super admin (public.super_admins), que abre várias portas:
      -- sai durante o passo e volta no fim, como os vínculos
      WITH d AS (DELETE FROM public.super_admins WHERE perfil_id = e2e.fb_login() RETURNING *)
      SELECT to_jsonb(d) INTO v_sa FROM d;
    END IF;
    IF p_papel <> 'banco' THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.fb_login(), 'role', 'authenticated')::text, true);
      PERFORM set_config('role', 'authenticated', true);
    END IF;
    EXECUTE p_sql INTO v_res;
    PERFORM set_config('role', 'postgres', true);
    IF v_off IS NOT NULL THEN UPDATE public.vinculos SET ativo = true WHERE id = ANY (v_off); END IF;
    IF v_sa IS NOT NULL THEN INSERT INTO public.super_admins SELECT * FROM jsonb_populate_record(NULL::public.super_admins, v_sa); END IF;
    IF p_desfazer THEN RAISE EXCEPTION USING ERRCODE = 'P0E2E', MESSAGE = 'e2e_desfazer'; END IF;
    v_ok := true;
  EXCEPTION
    WHEN SQLSTATE 'P0E2E' THEN PERFORM set_config('role', 'postgres', true); v_ok := true;
    WHEN OTHERS THEN PERFORM set_config('role', 'postgres', true); v_ok := false; v_err := SQLERRM;
  END;
  IF p_esperado = 'registrar' THEN
    v_sit := 'ok';
    v_det := CASE WHEN v_ok THEN 'ACEITO' || CASE WHEN p_desfazer THEN ' (desfeito)' ELSE '' END || ': ' || left(coalesce(v_res, ''), 400)
                  ELSE 'RECUSADO: ' || v_err END;
  ELSIF p_esperado = 'ok' THEN
    IF v_ok AND p_guardar IS NOT NULL AND v_res IS NULL THEN
      v_sit := 'falha'; v_det := 'sem retorno (nada para guardar em ' || p_guardar || ')';
    ELSIF v_ok THEN
      v_sit := 'ok'; v_det := coalesce(left(v_res, 500), '(sem retorno: void)');
      IF p_guardar IS NOT NULL AND NOT p_desfazer THEN
        INSERT INTO e2e.vars VALUES ('fb' || p_n || '_' || p_guardar, v_res) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor;
      END IF;
    ELSE
      v_sit := 'falha'; v_det := v_err;
    END IF;
  ELSE
    IF v_ok THEN
      v_sit := 'falha'; v_det := 'PASSOU sem erro (deveria ser recusado)' || CASE WHEN p_desfazer THEN ' (desfeito)' ELSE '' END || ': ' || left(coalesce(v_res, ''), 300);
    ELSIF p_esperado = 'erro' OR v_err ILIKE '%' || substr(p_esperado, 6) || '%' THEN
      v_sit := 'ok'; v_det := 'recusado: ' || v_err;
    ELSE
      v_sit := 'falha'; v_det := 'recusado com outra mensagem: ' || v_err;
    END IF;
  END IF;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, p_papel, NULL, p_descricao, p_esperado, v_sit, v_det);
  RETURN v_sit || ' — B' || lpad(p_n::text, 2, '0') || ' ' || p_passo || ' [' || p_papel || '] — ' || coalesce(left(v_det, 300), '');
END $$;

-- coorte: 10 pacientes fictícios (nome, idade, sexo, quadro e escolhas de teste)
DROP TABLE IF EXISTS e2e.fb_coorte;
CREATE TABLE e2e.fb_coorte (
  n int PRIMARY KEY, nome text, nasc date, sexo text, queixa text, cor text, publico text, fluxo text, disc_livre text,
  sinais jsonb, cid text, hipotese text, via text,            -- via: 'internacao' (direto) ou 'observacao' (box, depois leito)
  setor uuid, leito text, proc text, tipo_leito text, prioridade text, vuln text[],
  iso_pac text, iso_tipo text, iso_sit text, iso_agente text, quadro text, prioridades text[]);
INSERT INTO e2e.fb_coorte VALUES
 (1, 'Teste Fluxo B01', '1968-03-14', 'M', 'Dor no peito em aperto há 1 hora, com suor frio', 'laranja', 'adulto', 'Dor torácica', 'Dor precordial em aperto (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":104,"pressao-arterial-sistolica":158,"pressao-arterial-diastolica":96,"frequencia-respiratoria":22,"saturacao-o2":95,"temperatura":36.4,"escala-dor":8}',
  'I21.9', 'Infarto agudo do miocárdio', 'internacao', '32000000-0000-4000-8000-000000000003', 'CM-2', '0303060190', 'uti_adulto', 'emergencia', '{}',
  NULL, NULL, NULL, NULL, 'Homem de 58 anos com dor precordial em aperto há 1 hora, sudorese e ECG com supra de ST em parede inferior (teste de fluxo B01).', '{}'),
 (2, 'Teste Fluxo B02', '1979-07-02', 'M', 'Tosse com sangue e febre há 3 semanas, falta de ar hoje', 'laranja', 'adulto', 'Queixas respiratórias', 'Hemoptise com dispneia (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":112,"pressao-arterial-sistolica":104,"pressao-arterial-diastolica":64,"frequencia-respiratoria":28,"saturacao-o2":88,"temperatura":38.2,"escala-dor":3}',
  'J18.9', 'Pneumonia; tuberculose pulmonar a esclarecer', 'internacao', '32000000-0000-4000-8000-000000000004', 'SV-1', '0303140151', 'uti_adulto', 'urgencia', '{}',
  'aerossol', 'aerossol', 'suspeito', 'Tuberculose pulmonar a esclarecer (BAAR colhido)', 'Homem de 47 anos, tosse com hemoptise e febre há 3 semanas, emagrecido, SatO2 88% em ar ambiente; RX com cavitação em ápice direito (teste de fluxo B02).', '{}'),
 (3, 'Teste Fluxo B03', '1991-11-23', 'F', 'Febre, tosse seca e falta de ar há 5 dias', 'amarelo', 'adulto', 'Queixas respiratórias', 'Dispneia moderada (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":98,"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":72,"frequencia-respiratoria":24,"saturacao-o2":91,"temperatura":38.6,"escala-dor":2}',
  'J12.9', 'Pneumonia viral', 'internacao', '32000000-0000-4000-8000-000000000003', 'CM-3', '0303140151', 'clinico', 'urgencia', '{}',
  NULL, 'contato_aerossol', 'suspeito', 'SARS-CoV-2 a confirmar (teste rápido colhido)', 'Mulher de 35 anos, febre e tosse seca há 5 dias, dispneia aos pequenos esforços, SatO2 91% em ar ambiente, infiltrado bilateral (teste de fluxo B03).', '{}'),
 (4, 'Teste Fluxo B04', '1962-01-30', 'F', 'Febre e fraqueza 8 dias depois da quimioterapia', 'laranja', 'adulto', 'Mal-estar geral', 'Febre em paciente imunossuprimida (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":116,"pressao-arterial-sistolica":96,"pressao-arterial-diastolica":58,"frequencia-respiratoria":22,"saturacao-o2":96,"temperatura":38.9,"escala-dor":2}',
  'D70', 'Neutropenia febril', 'internacao', '32000000-0000-4000-8000-000000000003', 'CM-4', '0303020083', 'clinico', 'urgencia', '{oncologico}',
  NULL, 'reverso', 'confirmado', 'Neutropenia febril pós-quimioterapia', 'Mulher de 64 anos em quimioterapia, febre 38,9 °C no oitavo dia do ciclo, neutrófilos baixos no hemograma da porta (teste de fluxo B04).', '{}'),
 (5, 'Teste Fluxo B05', '2019-05-09', 'M', 'Chiado e falta de ar desde ontem, piorou hoje', 'laranja', 'pediatrico', 'Alterações respiratórias', 'Esforço respiratório importante (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":138,"frequencia-respiratoria":38,"saturacao-o2":90,"temperatura":37.2,"escala-dor":2}',
  'J45.9', 'Crise de asma', 'observacao', '32000000-0000-4000-8000-000000000003', 'CM-5', '0303140046', 'pediatrico', 'urgencia', '{crianca}',
  NULL, NULL, NULL, NULL, 'Menino de 7 anos com crise de asma, tiragem e sibilos difusos, SatO2 90% em ar ambiente, resposta parcial ao resgate (teste de fluxo B05).', '{}'),
 (6, 'Teste Fluxo B06', '1997-09-18', 'F', 'Gestante de 33 semanas com dor de cabeça forte e vista embaçada', 'laranja', 'adulto', 'Dor de cabeça', 'Cefaleia intensa em gestante (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":92,"pressao-arterial-sistolica":168,"pressao-arterial-diastolica":112,"frequencia-respiratoria":20,"saturacao-o2":98,"temperatura":36.6,"escala-dor":8}',
  'O14.1', 'Pré-eclâmpsia grave', 'observacao', '32000000-0000-4000-8000-000000000003', 'CM-6', '0303100044', 'obstetrico', 'emergencia', '{gestante}',
  NULL, NULL, NULL, NULL, 'Gestante de 29 anos, 33 semanas, PA 168x112, cefaleia e escotomas, proteinúria na fita (teste de fluxo B06).', '{gestante}'),
 (7, 'Teste Fluxo B07', '1944-02-11', 'M', 'Fraqueza no lado direito e fala enrolada há 2 horas', 'vermelho', 'adulto', 'Alterações de comportamento', 'Déficit neurológico agudo (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":88,"pressao-arterial-sistolica":186,"pressao-arterial-diastolica":102,"frequencia-respiratoria":18,"saturacao-o2":94,"temperatura":36.2,"escala-dor":0}',
  'I64', 'Acidente vascular cerebral', 'internacao', '32000000-0000-4000-8000-000000000004', 'SV-2', '0303040149', 'uti_adulto', 'emergencia', '{idoso}',
  NULL, NULL, NULL, NULL, 'Homem de 82 anos, hemiparesia direita e disartria há 2 horas, PA 186x102, glicemia normal (teste de fluxo B07).', '{}'),
 (8, 'Teste Fluxo B08', '1981-06-05', 'F', 'Dor nas costas, febre e ardor para urinar há 2 dias', 'amarelo', 'adulto', 'Queixas urinárias', 'Dor lombar com febre (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":102,"pressao-arterial-sistolica":112,"pressao-arterial-diastolica":70,"frequencia-respiratoria":20,"saturacao-o2":97,"temperatura":38.8,"escala-dor":6}',
  'N10', 'Pielonefrite aguda', 'internacao', '32000000-0000-4000-8000-000000000003', 'CM-7', '0303150041', 'clinico', 'prioritaria', '{}',
  'contato', 'contato', 'confirmado', 'Enterobactéria ESBL em urocultura anterior', 'Mulher de 45 anos com pielonefrite, febre 38,8 °C, punho-percussão positiva e ESBL em urocultura anterior (teste de fluxo B08).', '{}'),
 (9, 'Teste Fluxo B09', '1959-10-27', 'M', 'Falta de ar e catarro amarelo há 4 dias, usa bombinha', 'laranja', 'adulto', 'Queixas respiratórias', 'Dispneia com sibilos (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":108,"pressao-arterial-sistolica":138,"pressao-arterial-diastolica":84,"frequencia-respiratoria":28,"saturacao-o2":87,"temperatura":37.9,"escala-dor":1}',
  'J44.1', 'DPOC exacerbado', 'internacao', '32000000-0000-4000-8000-000000000003', 'CM-8', '0303140046', 'uti_adulto', 'urgencia', '{idoso}',
  'goticula', 'goticula', 'suspeito', 'Influenza a confirmar', 'Homem de 67 anos com DPOC exacerbado, SatO2 87% em ar ambiente, uso de musculatura acessória e gasometria com retenção de CO2 (teste de fluxo B09).', '{}'),
 (10, 'Teste Fluxo B10', '1992-12-01', 'F', 'Febre alta, calafrios e confusão desde a madrugada', 'laranja', 'adulto', 'Mal-estar geral', 'Febre com alteração do nível de consciência (texto da enfermeira de teste)',
  '{"frequencia-cardiaca":124,"pressao-arterial-sistolica":88,"pressao-arterial-diastolica":52,"frequencia-respiratoria":26,"saturacao-o2":93,"temperatura":39.4,"escala-dor":4}',
  'A41.9', 'Sepse de foco a esclarecer', 'observacao', NULL, NULL, '0303010037', 'uti_adulto', 'emergencia', '{situacao_rua}',
  NULL, NULL, NULL, NULL, 'Mulher de 33 anos em situação de rua, febre 39,4 °C, PA 88x52, confusa, lactato alto (teste de fluxo B10).', '{}');
SELECT 'framework ok: ' || count(*) || ' pacientes na coorte' FROM e2e.fb_coorte;
