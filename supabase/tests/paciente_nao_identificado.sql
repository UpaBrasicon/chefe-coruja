-- Testes da migration 20270322000001_paciente_nao_identificado.sql (lacuna 1
-- do Portão de 11/10/2026; decisão do RT em 10/11/2026: A em N1–N4).
--  N1. nome provisório "Não identificado <prontuário>", gerado no servidor;
--  N2. sexo aparente, idade estimada (data_nascimento_estimada) e sinais;
--      sem idade, o nascimento fica vazio;
--  N3. marca identidade_desconhecida e sinais visíveis para a triagem e o PS;
--  N4. identificar_paciente: CPF/CNS de outro cadastro sempre bloqueia; nome +
--      nascimento bloqueia até confirmar; grava e tira a marca; o histórico
--      (pacientes_identidade_provisoria) guarda o nome provisório e os sinais e
--      ganha quem identificou; a auditoria não traz dado de pessoa; RLS do
--      histórico; edição comum não troca o nome de quem está marcado.
-- ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- médico (…0002), enfermeira (…0004) e recepção (…0005) de plantão agora no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;

SET LOCAL ROLE authenticated;

-- ── N1 e N2. cadastro provisório pela recepção ─────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'r1', public.registrar_nao_identificado('22000000-0000-4000-8000-000000000003',
  'Trazido inconsciente', 'M', 40, '  SAMU, ocorrência 123; tatuagem no braço direito  ')::text;
INSERT INTO t SELECT 'p1', pg_temp.v('r1')::jsonb ->> 'paciente_id';
INSERT INTO t SELECT 'ep1', pg_temp.v('r1')::jsonb ->> 'episodio_id';
INSERT INTO t SELECT 'r2', public.registrar_nao_identificado('22000000-0000-4000-8000-000000000003',
  'Desacordado na via pública', NULL, NULL, 'Bombeiros')::text;
INSERT INTO t SELECT 'p2', pg_temp.v('r2')::jsonb ->> 'paciente_id';
INSERT INTO t SELECT 'ep2', pg_temp.v('r2')::jsonb ->> 'episodio_id';
-- 70 anos estimados: a prioridade 60+ entra pela idade estimada
INSERT INTO t SELECT 'r3', public.registrar_nao_identificado('22000000-0000-4000-8000-000000000003',
  'Confuso, sem acompanhante', 'F', 70, NULL)::text;
INSERT INTO t SELECT 'p3', pg_temp.v('r3')::jsonb ->> 'paciente_id';

RESET ROLE;
SELECT pg_temp.ok((SELECT nome = 'Não identificado ' || prontuario AND prontuario ~ '^\d{4}\.\d{6}$'
                     FROM public.pacientes WHERE id = pg_temp.u('p1')),
  'N1: nome provisório "Não identificado <prontuário>"');
SELECT pg_temp.ok((SELECT pg_temp.v('r1')::jsonb ->> 'nome' = nome FROM public.pacientes WHERE id = pg_temp.u('p1')),
  'N1: a resposta traz o nome provisório');
SELECT pg_temp.ok((SELECT identidade_desconhecida AND sinais_identificacao = 'SAMU, ocorrência 123; tatuagem no braço direito'
                          AND sexo = 'M' AND data_nascimento_estimada
                          AND data_nascimento = ((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '40 years')::date
                     FROM public.pacientes WHERE id = pg_temp.u('p1')),
  'N2/N3: marca, sinais, sexo aparente e idade estimada (40 anos) gravados');
SELECT pg_temp.ok((SELECT identidade_desconhecida AND data_nascimento IS NULL AND NOT data_nascimento_estimada AND sexo IS NULL
                     FROM public.pacientes WHERE id = pg_temp.u('p2')),
  'N2: sem idade estimada, o nascimento fica vazio');
SELECT pg_temp.ok((SELECT etapa = 'triagem' AND aberto_por = '10000000-0000-4000-8000-000000000005' AND queixa = 'Trazido inconsciente'
                     FROM public.episodios WHERE id = pg_temp.u('ep1')),
  'a ficha abre na fila da triagem, pela recepção');
SELECT pg_temp.ok((SELECT 'idoso_60' = ANY (prioridades_legais) FROM public.episodios
                    WHERE paciente_id = pg_temp.u('p3') AND etapa <> 'encerrado'),
  'idade estimada de 70 anos dá prioridade 60+');
SELECT pg_temp.ok((SELECT count(*) = 3 FROM public.log_auditoria
                    WHERE acao = 'cadastrar_nao_identificado' AND entidade_id IN (pg_temp.u('p1'), pg_temp.u('p2'), pg_temp.u('p3'))
                      AND payload = jsonb_build_object('setor_id', '22000000-0000-4000-8000-000000000003')),
  'cadastro provisório auditado só com o setor (sem dado de pessoa)');
SELECT pg_temp.ok((SELECT h.nome_provisorio = p.nome AND h.prontuario = p.prontuario AND h.unidade_id = p.unidade_id
                          AND h.sinais_identificacao = 'SAMU, ocorrência 123; tatuagem no braço direito'
                          AND h.sexo_aparente = 'M' AND h.idade_estimada = 40
                          AND h.criado_por = '10000000-0000-4000-8000-000000000005'
                          AND h.identificado_em IS NULL AND h.identificado_por IS NULL AND NOT h.outra_pessoa_confirmada
                     FROM public.pacientes_identidade_provisoria h JOIN public.pacientes p ON p.id = h.paciente_id
                    WHERE h.paciente_id = pg_temp.u('p1')),
  'histórico: a linha nasce com nome provisório, sinais, prontuário, sexo aparente, idade estimada e quem cadastrou');
SELECT pg_temp.ok((SELECT count(*) = 3 FROM public.pacientes_identidade_provisoria
                    WHERE paciente_id IN (pg_temp.u('p1'), pg_temp.u('p2'), pg_temp.u('p3'))),
  'histórico: uma linha por cadastro provisório');
SET LOCAL ROLE authenticated;

-- validações
SELECT pg_temp.falha(format('SELECT public.registrar_nao_identificado(%L, %L, NULL, NULL, %L)',
  '22000000-0000-4000-8000-000000000003', 'Queixa', repeat('x', 501)), 'Sinais e quem trouxe: no máximo 500 letras', 'sinais com mais de 500 letras');
SELECT pg_temp.falha(format('SELECT public.registrar_nao_identificado(%L, %L, NULL, 200)',
  '22000000-0000-4000-8000-000000000003', 'Queixa'), 'Informe a idade estimada em anos (de 0 a 130)', 'idade estimada fora da faixa');
SELECT pg_temp.falha(format('SELECT public.registrar_nao_identificado(%L, %L, %L)',
  '22000000-0000-4000-8000-000000000003', 'Queixa', 'X'), 'Sexo aparente: F (feminino), M (masculino) ou em branco', 'sexo aparente inválido');
SELECT pg_temp.falha(format('SELECT public.registrar_nao_identificado(%L, %L)',
  '22000000-0000-4000-8000-000000000003', ' '), 'Informe a queixa referida', 'sem queixa');

-- permissão: o teleconsultor não está de plantão na porta
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.registrar_nao_identificado(%L, %L)',
  '22000000-0000-4000-8000-000000000003', 'Queixa qualquer'), 'Acesso negado: você não está de plantão nesta porta', 'fora do plantão da porta não cadastra');
SELECT pg_temp.falha(format('SELECT public.identificar_paciente(%L, %L)', pg_temp.u('p1'), '{"nome": "Fulano de Tal"}'),
  'Acesso negado: paciente fora do seu plantão', 'fora do plantão não identifica');
SELECT pg_temp.falha(format('SELECT public.pacientes_nao_identificados(%L)', '21000000-0000-4000-8000-000000000001'),
  'Acesso negado: recepção ou gestor da unidade', 'lista dos não identificados só para recepção ou gestor');

-- ── N3. o que a triagem e o PS leem (select com RLS, como Triagem.tsx e FilaPS.tsx) ──
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.ok((SELECT p.identidade_desconhecida AND p.sinais_identificacao LIKE 'SAMU, ocorrência 123%'
                     FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id WHERE e.id = pg_temp.u('ep1')),
  'N3: a enfermagem da triagem lê a marca e os sinais');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
                    WHERE e.id IN (pg_temp.u('ep1'), pg_temp.u('ep2')) AND p.identidade_desconhecida),
  'N3: os dois não identificados aparecem marcados na fila');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok((SELECT p.identidade_desconhecida AND p.sinais_identificacao = 'Bombeiros'
                     FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id WHERE e.id = pg_temp.u('ep2')),
  'N3: o médico do PS lê a marca e os sinais');
-- a lista da recepção
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.ok((SELECT count(*) = 3 FROM jsonb_array_elements(public.pacientes_nao_identificados('21000000-0000-4000-8000-000000000001')) x
                    WHERE (x ->> 'id')::uuid IN (pg_temp.u('p1'), pg_temp.u('p2'), pg_temp.u('p3')) AND x ->> 'episodio_id' IS NOT NULL),
  'a recepção lista os não identificados com a ficha aberta');

-- ── edição comum não troca o nome provisório ────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.salvar_cadastro_paciente(%L, %L)', pg_temp.u('p1'), '{"nome": "Outro Nome Qualquer"}'),
  'Paciente não identificado: use "Identificar paciente"', 'salvar_cadastro_paciente recusa trocar o nome de quem está marcado');
-- o mesmo nome (formulário inteiro reenviado) passa
SELECT public.salvar_cadastro_paciente(pg_temp.u('p1'),
  jsonb_build_object('nome', (SELECT nome FROM public.pacientes WHERE id = pg_temp.u('p1')), 'telefone', '11999990000'));

-- ── N4. identificar ─────────────────────────────────────────────────────────
-- um cadastro conhecido na unidade (CPF válido de teste)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'k', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor abdominal', NULL,
  json_build_object('nome', 'Maria Conhecida Teste', 'data_nascimento', '1980-05-05', 'cpf', '52998224725')::jsonb) ->> 'paciente_id';

-- validações do nome
SELECT pg_temp.falha(format('SELECT public.identificar_paciente(%L, %L)', pg_temp.u('p1'), '{"nome": "Jo"}'),
  'Informe o nome do paciente (ao menos 3 letras)', 'nome com menos de 3 letras');
SELECT pg_temp.falha(format('SELECT public.identificar_paciente(%L, %L)', pg_temp.u('p1'), '{"nome": "Nao Identificado 2026"}'),
  'Informe o nome verdadeiro do paciente', 'nome provisório não vale como identificação');
SELECT pg_temp.falha(format('SELECT public.identificar_paciente(%L, %L)', pg_temp.u('p1'), '{"nome": "Fulano de Tal", "cpf": "12345678900"}'),
  'CPF inválido', 'CPF inválido é recusado');

-- CPF de outro cadastro: sempre bloqueia, mesmo confirmando outra pessoa
INSERT INTO t SELECT 'd1', public.identificar_paciente(pg_temp.u('p2'), '{"nome": "José da Silva", "cpf": "529.982.247-25"}', true)::text;
SELECT pg_temp.ok((SELECT (r ->> 'identificado')::boolean = false AND r ->> 'motivo' = 'documento'
                          AND r -> 'candidatos' -> 0 ->> 'id' = pg_temp.v('k') AND r -> 'candidatos' -> 0 ->> 'regra' = 'documento'
                     FROM (SELECT pg_temp.v('d1')::jsonb r) x),
  'N4: CPF de outro cadastro devolve o candidato e não grava');
-- mesmo nome (sem acento/maiúscula) e nascimento: devolve o candidato
INSERT INTO t SELECT 'd2', public.identificar_paciente(pg_temp.u('p2'), '{"nome": "MARIA  CONHECIDA teste", "data_nascimento": "1980-05-05"}')::text;
SELECT pg_temp.ok((SELECT (r ->> 'identificado')::boolean = false AND r ->> 'motivo' = 'nome_nascimento'
                          AND r -> 'candidatos' -> 0 ->> 'id' = pg_temp.v('k') AND (r -> 'candidatos' -> 0 ->> 'aberto')::boolean
                     FROM (SELECT pg_temp.v('d2')::jsonb r) x),
  'N4: mesmo nome e nascimento devolve o candidato (com o atendimento aberto)');
RESET ROLE;
SELECT pg_temp.ok((SELECT identidade_desconhecida AND nome LIKE 'Não identificado %' AND cpf IS NULL
                     FROM public.pacientes WHERE id = pg_temp.u('p2')),
  'N4: com candidato, nada foi gravado');
SET LOCAL ROLE authenticated;

-- o candidato vira pedido de unificação pelo fluxo que já existe
SELECT pg_temp.ok(public.pedir_unificacao(pg_temp.u('k'), pg_temp.u('p2'),
  'Paciente não identificado reconhecido pela família na recepção') IS NOT NULL,
  'N4: a recepção pede a unificação com o cadastro existente');

-- confirmada outra pessoa (só nome + nascimento), grava
INSERT INTO t SELECT 'd3', public.identificar_paciente(pg_temp.u('p2'), '{"nome": "Maria Conhecida Teste", "data_nascimento": "1980-05-05", "sexo": "F"}', true)::text;
SELECT pg_temp.ok((pg_temp.v('d3')::jsonb ->> 'identificado')::boolean, 'N4: confirmada outra pessoa, grava');

-- identificação com CPF novo e data real
INSERT INTO t SELECT 'pront1', prontuario FROM public.pacientes WHERE id = pg_temp.u('p1');
INSERT INTO t SELECT 'd4', public.identificar_paciente(pg_temp.u('p1'),
  '{"nome": " João  Identificado Teste ", "data_nascimento": "1985-01-02", "cpf": "111.444.777-35", "sexo": "M"}')::text;
SELECT pg_temp.ok((SELECT (r ->> 'identificado')::boolean AND r ->> 'nome' = 'João Identificado Teste' AND r ->> 'prontuario' = pg_temp.v('pront1')
                     FROM (SELECT pg_temp.v('d4')::jsonb r) x),
  'N4: sem candidato, identifica e mantém o prontuário');
SELECT pg_temp.falha(format('SELECT public.identificar_paciente(%L, %L)', pg_temp.u('p1'), '{"nome": "Outro Nome"}'),
  'Este paciente já está identificado', 'quem já foi identificado não passa de novo');

-- identificação só com o nome: a idade estimada continua estimada
SELECT public.identificar_paciente(pg_temp.u('p3'), '{"nome": "Ana Sem Data Teste"}');

RESET ROLE;
SELECT pg_temp.ok((SELECT NOT identidade_desconhecida AND sinais_identificacao IS NULL AND nome = 'João Identificado Teste'
                          AND data_nascimento = '1985-01-02' AND NOT data_nascimento_estimada AND cpf = '11144477735'
                     FROM public.pacientes WHERE id = pg_temp.u('p1')),
  'N4: marca e sinais saem; a data real apaga a marca de idade estimada; CPF gravado');
SELECT pg_temp.ok((SELECT NOT identidade_desconhecida AND data_nascimento_estimada AND data_nascimento IS NOT NULL AND sexo = 'F'
                     FROM public.pacientes WHERE id = pg_temp.u('p3')),
  'N4: sem data real, a idade estimada continua valendo');
SELECT pg_temp.ok((SELECT h.nome_provisorio = 'Não identificado ' || pg_temp.v('pront1')
                          AND h.sinais_identificacao = 'SAMU, ocorrência 123; tatuagem no braço direito'
                          AND h.prontuario = pg_temp.v('pront1')
                          AND h.identificado_em IS NOT NULL AND h.identificado_por = '10000000-0000-4000-8000-000000000005'
                          AND NOT h.outra_pessoa_confirmada
                     FROM public.pacientes_identidade_provisoria h WHERE h.paciente_id = pg_temp.u('p1')),
  'N4: o histórico guarda nome provisório, sinais e prontuário, e ganha quem identificou e quando');
SELECT pg_temp.ok((SELECT outra_pessoa_confirmada AND identificado_em IS NOT NULL FROM public.pacientes_identidade_provisoria
                    WHERE paciente_id = pg_temp.u('p2')),
  'N4: a confirmação de outra pessoa fica no histórico');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria l
                    WHERE l.acao = 'identificar_paciente' AND l.entidade = 'pacientes' AND l.entidade_id = pg_temp.u('p1')
                      AND l.ator_id = '10000000-0000-4000-8000-000000000005'
                      AND l.payload -> 'campos_alterados' ?& ARRAY['nome', 'cpf', 'data_nascimento', 'identidade_desconhecida']
                      AND l.hash IS NOT NULL),
  'N4: auditoria com o id do paciente, autor = login e os campos alterados');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.log_auditoria l
                    WHERE l.acao IN ('identificar_paciente', 'cadastrar_nao_identificado')
                      AND l.entidade_id IN (pg_temp.u('p1'), pg_temp.u('p2'), pg_temp.u('p3'))
                      AND (l.payload::text LIKE '%Identificado Teste%' OR l.payload::text LIKE '%Não identificado%'
                           OR l.payload::text LIKE '%SAMU%' OR l.payload::text LIKE '%Bombeiros%'
                           OR l.payload::text LIKE '%' || pg_temp.v('pront1') || '%')),
  'N4: a auditoria não traz nome, sinais nem prontuário');

-- RLS do histórico: a recepção de plantão lê; o teleconsultor (sem acesso ao paciente) não; anon nada
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.pacientes_identidade_provisoria WHERE paciente_id = pg_temp.u('p1')),
  'RLS: quem lê o paciente lê o histórico');
SELECT pg_temp.falha(format('INSERT INTO public.pacientes_identidade_provisoria (paciente_id, unidade_id, nome_provisorio) VALUES (%L, %L, %L)',
  pg_temp.u('p1'), '21000000-0000-4000-8000-000000000001', 'x'), 'permission denied', 'RLS: authenticated não grava direto');
SELECT pg_temp.falha(format('UPDATE public.pacientes_identidade_provisoria SET sinais_identificacao = NULL WHERE paciente_id = %L', pg_temp.u('p1')),
  'permission denied', 'RLS: authenticated não altera direto');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.pacientes WHERE id = pg_temp.u('p1'))
                  AND (SELECT count(*) = 0 FROM public.pacientes_identidade_provisoria WHERE paciente_id IN (pg_temp.u('p1'), pg_temp.u('p2'), pg_temp.u('p3'))),
  'RLS: sem acesso ao paciente, não lê o histórico');
RESET ROLE;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(
                    (SELECT public.pacientes_nao_identificados('21000000-0000-4000-8000-000000000001'))) x
                    WHERE (x ->> 'id')::uuid IN (pg_temp.u('p1'), pg_temp.u('p2'), pg_temp.u('p3'))),
  'identificados saem da lista da recepção');

-- ── a regulação continua com a regra dela (documento), sem olhar a marca ──
SELECT pg_temp.ok(private.paciente_tem_documento(pg_temp.u('p1')) AND NOT private.paciente_tem_documento(pg_temp.u('p3')),
  'paciente_tem_documento continua dependendo só de CPF/CNS');

-- ── privilégios ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.registrar_nao_identificado(uuid, text, text, numeric, text, text[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.identificar_paciente(uuid, jsonb, boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pacientes_nao_identificados(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon executa';
  END IF;
  IF NOT (has_function_privilege('authenticated', 'public.registrar_nao_identificado(uuid, text, text, numeric, text, text[])', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.identificar_paciente(uuid, jsonb, boolean)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.pacientes_nao_identificados(uuid)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'FALHOU: authenticated sem EXECUTE';
  END IF;
  -- histórico: anon nada; authenticated só lê (com RLS ligada)
  IF has_table_privilege('anon', 'public.pacientes_identidade_provisoria', 'SELECT')
     OR has_table_privilege('anon', 'public.pacientes_identidade_provisoria', 'INSERT')
     OR has_table_privilege('authenticated', 'public.pacientes_identidade_provisoria', 'INSERT')
     OR has_table_privilege('authenticated', 'public.pacientes_identidade_provisoria', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.pacientes_identidade_provisoria', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.pacientes_identidade_provisoria', 'SELECT')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.pacientes_identidade_provisoria'::regclass) THEN
    RAISE EXCEPTION 'FALHOU: privilégios ou RLS do histórico';
  END IF;
  RAISE NOTICE 'OK  privilégios';
END $$;
ROLLBACK;
