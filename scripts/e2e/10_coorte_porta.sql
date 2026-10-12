-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — coorte de 15 pacientes: recepção, triagem e
-- atendimento médico na porta (etapas 1 a 3 do roteiro do RT).
-- Cada ação roda como a conta do papel; o resultado vai para e2e.resultados.
-- Pré-requisitos: 01_rede_e2e, 02_catalogo_e2e, 03_checkin_agora, 04_framework.
-- Dados 100% fictícios (CPF gerado com dígito válido, nomes "E2E ...").
-- Sinais vitais e doses são entradas de teste, não referência clínica.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
DROP TABLE IF EXISTS e2e.coorte;
CREATE TABLE e2e.coorte (
  n int PRIMARY KEY, nome text, nascimento date, sexo text, cpf text, queixa text, cid text, cor text,
  fluxograma text, publico text, desfecho text, vitais jsonb, dados jsonb DEFAULT '{}'
);
-- CIDs da CID-10 do DATASUS (a tabela do SUS não tem K35.8 nem N18.5 da OMS;
-- correções do portão, tarefa 3): apendicite K35.9, renal crônica N18.0
INSERT INTO e2e.coorte VALUES
  (1,  'E2E Lactente Febril',          current_date - interval '4 months',   'M', e2e.cpf('900000001'), 'Febre e irritabilidade', 'R50.9', 'laranja',  'Alterações do Sistema Nervoso Central', 'pediatrico', 'observacao',
       '{"frequencia-cardiaca":178,"frequencia-respiratoria":52,"temperatura":39.1,"saturacao-o2":95,"escala-dor":4}', '{"responsavel_nome":"E2E Mãe do Lactente","responsavel_parentesco":"mãe"}'),
  (2,  'E2E Criança Asma',             current_date - interval '6 years',    'F', e2e.cpf('900000002'), 'Falta de ar e chiado', 'J45.9', 'amarelo', 'Alterações respiratórias', 'pediatrico', 'observacao',
       '{"frequencia-cardiaca":128,"frequencia-respiratoria":34,"temperatura":36.8,"saturacao-o2":93,"escala-dor":2}', '{"responsavel_nome":"E2E Pai da Criança","responsavel_parentesco":"pai"}'),
  (3,  'E2E Adolescente Punho',        current_date - interval '16 years',   'M', e2e.cpf('900000003'), 'Queda com dor no punho', 'S62.0', 'verde', 'Politraumas', 'adulto', 'alta',
       '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":99,"escala-dor":5,"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":72}', '{"responsavel_nome":"E2E Tia do Adolescente","responsavel_parentesco":"tia"}'),
  (4,  'E2E Adulto Meningite',         current_date - interval '28 years',   'F', e2e.cpf('900000004'), 'Cefaleia intensa e rigidez de nuca', 'G03.9', 'laranja', 'Dor de cabeça', 'adulto', 'internacao',
       '{"frequencia-cardiaca":112,"frequencia-respiratoria":22,"temperatura":39.4,"saturacao-o2":97,"escala-dor":9,"pressao-arterial-sistolica":110,"pressao-arterial-diastolica":70}', '{}'),
  (5,  'E2E Adulto Apendicite',        current_date - interval '35 years',   'M', e2e.cpf('900000005'), 'Dor abdominal em fossa ilíaca direita', 'K35.9', 'amarelo', 'Dor abdominal', 'adulto', 'internacao',
       '{"frequencia-cardiaca":104,"frequencia-respiratoria":18,"temperatura":38.1,"saturacao-o2":98,"escala-dor":7,"pressao-arterial-sistolica":126,"pressao-arterial-diastolica":80}', '{}'),
  (6,  'E2E Gestante Sangramento',     current_date - interval '30 years',   'F', e2e.cpf('900000006'), 'Sangramento vaginal na gestação de 32 semanas', 'O46.9', 'laranja', 'Sangramentos', 'adulto', 'internacao',
       '{"frequencia-cardiaca":108,"frequencia-respiratoria":20,"temperatura":36.7,"saturacao-o2":98,"escala-dor":6,"pressao-arterial-sistolica":100,"pressao-arterial-diastolica":60}', '{}'),
  (7,  'E2E Adulto Infarto',           current_date - interval '45 years',   'M', e2e.cpf('900000007'), 'Dor torácica em aperto há 1 hora', 'I21.9', 'vermelho', 'Dor torácica', 'adulto', 'internacao',
       '{"frequencia-cardiaca":96,"frequencia-respiratoria":22,"temperatura":36.4,"saturacao-o2":94,"escala-dor":9,"pressao-arterial-sistolica":150,"pressao-arterial-diastolica":95}', '{}'),
  (8,  'E2E Adulto Renal',             current_date - interval '52 years',   'F', e2e.cpf('900000008'), 'Fraqueza; faz hemodiálise e faltou à sessão', 'N18.0', 'laranja', 'Mal-estar geral', 'adulto', 'internacao',
       '{"frequencia-cardiaca":52,"frequencia-respiratoria":20,"temperatura":36.3,"saturacao-o2":96,"escala-dor":2,"pressao-arterial-sistolica":168,"pressao-arterial-diastolica":98}', '{}'),
  (9,  'E2E Idoso AVC',                current_date - interval '68 years',   'M', e2e.cpf('900000009'), 'Fraqueza súbita no lado direito e fala enrolada', 'I63.9', 'vermelho', 'Mal-estar geral', 'adulto', 'internacao',
       '{"frequencia-cardiaca":84,"frequencia-respiratoria":18,"temperatura":36.6,"saturacao-o2":96,"escala-dor":0,"pressao-arterial-sistolica":182,"pressao-arterial-diastolica":104}', '{}'),
  (10, 'E2E Idoso Pneumonia',          current_date - interval '74 years',   'F', e2e.cpf('900000010'), 'Falta de ar, febre e tosse', 'J18.9', 'vermelho', 'Queixas respiratórias', 'adulto', 'internacao',
       '{"frequencia-cardiaca":124,"frequencia-respiratoria":34,"temperatura":38.9,"saturacao-o2":82,"escala-dor":3,"pressao-arterial-sistolica":96,"pressao-arterial-diastolica":58}', '{}'),
  (11, 'E2E Idosa Delirium',           current_date - interval '80 years',   'F', e2e.cpf('900000011'), 'Confusão mental e ardor ao urinar', 'N39.0', 'amarelo', 'Queixas urinárias', 'adulto', 'observacao',
       '{"frequencia-cardiaca":98,"frequencia-respiratoria":20,"temperatura":37.9,"saturacao-o2":95,"escala-dor":3,"pressao-arterial-sistolica":134,"pressao-arterial-diastolica":76}', '{}'),
  (12, 'E2E Adulto Agitação',          current_date - interval '40 years',   'M', e2e.cpf('900000012'), 'Agitação psicomotora após ingestão de comprimidos', 'F19.1', 'laranja', 'Alterações de comportamento', 'adulto', 'internacao',
       '{"frequencia-cardiaca":118,"frequencia-respiratoria":22,"temperatura":37.2,"saturacao-o2":97,"escala-dor":0,"pressao-arterial-sistolica":146,"pressao-arterial-diastolica":90}', '{}'),
  (13, 'E2E Adulto Choque Séptico',    current_date - interval '55 years',   'M', e2e.cpf('900000013'), 'Febre, confusão e pressão baixa', 'A41.9', 'vermelho', 'Mal-estar geral', 'adulto', 'internacao',
       '{"frequencia-cardiaca":138,"frequencia-respiratoria":30,"temperatura":39.6,"saturacao-o2":89,"escala-dor":4,"pressao-arterial-sistolica":72,"pressao-arterial-diastolica":40}', '{}'),
  (14, 'E2E Adulto Lombalgia',         current_date - interval '33 years',   'M', e2e.cpf('900000014'), 'Dor lombar há 3 semanas', 'M54.5', 'azul', 'Dor na coluna', 'adulto', 'alta',
       '{"frequencia-cardiaca":76,"frequencia-respiratoria":14,"temperatura":36.4,"saturacao-o2":99,"escala-dor":4,"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":78}', '{}'),
  (15, 'E2E Desconhecido SAMU',        NULL,                                 'M', NULL,                 'Trazido inconsciente pelo SAMU', 'R40.2', 'vermelho', 'Mal-estar geral', 'adulto', 'internacao',
       '{"frequencia-cardiaca":58,"frequencia-respiratoria":10,"temperatura":35.4,"saturacao-o2":90,"escala-dor":0,"pressao-arterial-sistolica":92,"pressao-arterial-diastolica":54}', '{"sem_documento":true}');

CREATE OR REPLACE FUNCTION e2e.guardar(p_nome text, p_valor text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO e2e.vars VALUES (p_nome, p_valor) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor
$$;

-- ── 1. recepção ─────────────────────────────────────────────────────────────
DO $$
DECLARE c record; v_dados jsonb;
BEGIN
  FOR c IN SELECT * FROM e2e.coorte ORDER BY n LOOP
    v_dados := jsonb_strip_nulls(jsonb_build_object('nome', c.nome, 'data_nascimento', c.nascimento, 'sexo', c.sexo, 'cpf', c.cpf,
                 'nome_mae', CASE WHEN c.n <> 15 THEN 'E2E Mãe de ' || c.nome END, 'municipio', 'Cidade Teste', 'uf', 'SP', 'categoria', 'sus',
                 'raca_cor', 'sem_informacao') || c.dados);
    PERFORM e2e.passo('1.ficha', c.n, 'recepcao', '/recepcao', 'Recepção cria a ficha',
      format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb, %L::text[]) ->> ''episodio_id'')',
             'e1200000-0000-4000-8000-000000000001', c.queixa, v_dados,
             CASE WHEN c.n = 6 THEN '{gestante}' WHEN c.n IN (9, 10, 11) THEN '{idoso_60}' ELSE '{}' END),
      'ok', 'ep' || c.n);
    PERFORM e2e.guardar('pac' || c.n, (SELECT paciente_id::text FROM public.episodios WHERE id = e2e.u('ep' || c.n)));
  END LOOP;
END $$;

-- duplicidade, edição, cancelamento
SELECT e2e.passo('1.duplicidade_cpf', 4, 'recepcao', '/recepcao', 'Mesmo CPF de novo: deve avisar a duplicidade',
  format('SELECT public.registrar_ficha(%L, %L, NULL, %L::jsonb)::text', 'e1200000-0000-4000-8000-000000000001', 'Retorno',
         jsonb_build_object('nome', 'E2E Outro Nome', 'cpf', e2e.cpf('900000004'), 'data_nascimento', '1998-01-01')),
  'erro:FICHA_DUPLICATA_DOCUMENTO');
SELECT e2e.passo('1.ficha_cancelar', NULL, 'recepcao', '/recepcao', 'Ficha aberta por engano é cancelada (retirar da fila)',
  format($q$SELECT public.retirar_da_fila((public.registrar_ficha(%L, 'Ficha de teste por engano', NULL, '{"nome":"E2E Ficha Engano","data_nascimento":"1990-05-05"}'::jsonb) ->> 'episodio_id')::uuid, 'engano', 'Ficha aberta por engano no teste E2E')::text$q$,
         'e1200000-0000-4000-8000-000000000001'));
SELECT e2e.passo('1.evasao_antes_triagem', NULL, 'recepcao', '/recepcao', 'Paciente vai embora antes da triagem (evasão)',
  format($q$SELECT public.retirar_da_fila((public.registrar_ficha(%L, 'Tosse leve', NULL, '{"nome":"E2E Evadido Antes Triagem","data_nascimento":"1985-03-03"}'::jsonb) ->> 'episodio_id')::uuid, 'evasao', 'Chamado três vezes e não respondeu na sala de espera')::text$q$,
         'e1200000-0000-4000-8000-000000000001'));
SELECT e2e.lacuna('1.pulseira', NULL, 'recepcao', 'Impressão de pulseira de identificação', 'Não há pulseira no sistema (nenhuma rota, RPC ou folha).');
SELECT e2e.lacuna('1.nao_identificado', 15, 'recepcao', 'Cadastro provisório de paciente não identificado',
  'Não há fluxo próprio: a ficha exige um nome (mínimo 3 letras); o marcador "não identificado" só existe na regulação. Usado o nome "E2E Desconhecido SAMU" e sem_documento.');

-- ── 2. triagem (enfermeiro) ─────────────────────────────────────────────────
DO $$
DECLARE c record; v_flux uuid; v_disc text;
BEGIN
  FOR c IN SELECT * FROM e2e.coorte ORDER BY n LOOP
    SELECT id INTO v_flux FROM public.protocolo_fluxogramas WHERE nome = c.fluxograma AND publico = c.publico;
    v_disc := e2e.disc('e1100000-0000-4000-8000-000000000001', v_flux, c.cor);
    PERFORM e2e.passo('2.classificar', c.n, 'enfermeiro', '/triagem', 'Enfermeira classifica (' || c.cor || ', ' || c.fluxograma || ')',
      format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L, ''{}''::jsonb, %L)::text',
             e2e.u('ep' || c.n), c.cor, c.vitais, v_flux, v_disc, CASE WHEN c.nascimento IS NULL THEN c.publico END));
  END LOOP;
END $$;
SELECT e2e.passo('2.alergia', 7, 'enfermeiro', '/triagem', 'Registra alergia a dipirona no #7',
  format('SELECT public.registrar_alergia(%L::uuid, %L, %L, %L, %L)::text', e2e.u('pac7'), 'Dipirona', 'Urticária', 'medicamento', 'moderada'));
SELECT e2e.passo('2.tecnico_nao_classifica', 14, 'tecnico', '/triagem', 'Técnico tenta classificar (deve ser negado)',
  format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, (SELECT id FROM public.protocolo_fluxogramas WHERE nome = %L AND publico = %L), %L)::text',
         e2e.u('ep14'), 'azul', (SELECT vitais FROM e2e.coorte WHERE n = 14), 'Dor na coluna', 'adulto', 'x'), 'erro');
SELECT e2e.passo('2.fila_por_cor', NULL, 'enfermeiro', '/triagem', 'Fila da porta com a cor atual',
  format('SELECT string_agg(cor_atual || '':'' || n, '' '') FROM (SELECT cor_atual, count(*) n FROM public.fila_da_porta(%L) GROUP BY 1 ORDER BY 1) x', 'e1200000-0000-4000-8000-000000000001'));

SELECT 'porta: recepção e triagem' AS etapa, situacao, count(*) FROM e2e.resultados GROUP BY situacao ORDER BY situacao;
