-- Testes da migration 20270422000040_farmacia_contexto_paciente.sql (revisão
-- do perfil Farmacêutico, RT 24/11/2026):
--   VA1 contexto_paciente_farmacia: o farmacêutico com item ativo do paciente
--       lê idade e alergias (e a leitura vai para log_acesso_prontuario); sem
--       item, recusa; médico, enfermagem e recepção, recusa; corte pediátrico
--       em 13 anos, 11 meses e 29 dias; os quatro estados da alergia.
--   DI3 pacientes_das_faltas: só itens de medicamento com falta aberta, com
--       leito (ou setor) e o próximo horário aprazado, o mais próximo primeiro.
-- Transação desfeita no fim (ROLLBACK): nada fica gravado.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- o perfil ...0006 (teleconsultor no seed) ganha também o papel de farmacêutico
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico') ON CONFLICT DO NOTHING;

INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('00000000-0000-4000-8000-0000000fc001', 'Ceftriaxona CTX', 'ceftriaxona ctx', 'Frasco 1 g', 'teste-ctx'),
  ('00000000-0000-4000-8000-0000000fc002', 'Dipirona CTX', 'dipirona ctx', 'Ampola 2 mL', 'teste-ctx');

-- P1 adulto com alergia grave e internado no leito 13A; P2 pediátrico pelo
-- último dia (14 anos amanhã) e "nega"; P3 adulto pelo primeiro dia (14 anos
-- hoje) sem registro de alergia; P4 sem prescrição.
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-0000000fc001', '21000000-0000-4000-8000-000000000001', 'Paciente Ctx Um', '1970-01-01', 'CTX-1', '22000000-0000-4000-8000-000000000001', 'F'),
  ('23000000-0000-4000-8000-0000000fc002', '21000000-0000-4000-8000-000000000001', 'Paciente Ctx Dois',
   ((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '14 years' + interval '1 day')::date, 'CTX-2', '22000000-0000-4000-8000-000000000003', 'M'),
  ('23000000-0000-4000-8000-0000000fc003', '21000000-0000-4000-8000-000000000001', 'Paciente Ctx Tres',
   ((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '14 years')::date, 'CTX-3', '22000000-0000-4000-8000-000000000003', 'M'),
  ('23000000-0000-4000-8000-0000000fc004', '21000000-0000-4000-8000-000000000001', 'Paciente Ctx Quatro', '1980-05-05', 'CTX-4', '22000000-0000-4000-8000-000000000003', 'F');
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, setor_atual_id, leito_atual_id, status, data_admissao)
SELECT '2c000000-0000-4000-8000-0000000fc001', u.organizacao_id, u.id, '23000000-0000-4000-8000-0000000fc001',
       '22000000-0000-4000-8000-000000000001', (SELECT l.id FROM public.leitos l WHERE l.setor_id = '22000000-0000-4000-8000-000000000001' AND l.identificador = '13A'),
       'internado', now() - interval '2 days'
  FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';
-- peso do atendimento (a prescrição de medicamento exige idade e peso)
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT '21000000-0000-4000-8000-000000000001', p.id, c.id, now() - interval '1 hour', p.kg, 'manual'
  FROM public.conceito c,
       (VALUES ('23000000-0000-4000-8000-0000000fc001'::uuid, 70), ('23000000-0000-4000-8000-0000000fc002'::uuid, 40),
               ('23000000-0000-4000-8000-0000000fc003'::uuid, 50)) p(id, kg)
 WHERE c.nome = 'peso' AND c.unidade_id IS NULL;
INSERT INTO public.alergias_paciente (unidade_id, paciente_id, substancia, substancia_norm, tipo, gravidade, reacao, registrado_por) VALUES
  ('21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000fc001', 'Penicilina', 'penicilina', 'medicamento', 'grave', 'Anafilaxia em 2019',
   '10000000-0000-4000-8000-000000000004');
INSERT INTO public.alergias_negacoes (unidade_id, paciente_id, registrado_por, tipo) VALUES
  ('21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000fc002', '10000000-0000-4000-8000-000000000004', 'nega');

INSERT INTO public.prescricoes (id, unidade_id, paciente_id, medico_id, status, internacao_id, criada_por) VALUES
  ('2a000000-0000-4000-8000-0000000fc001', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000fc001',
   '10000000-0000-4000-8000-000000000002', 'ativa', '2c000000-0000-4000-8000-0000000fc001', '10000000-0000-4000-8000-000000000002');
INSERT INTO public.prescricoes (id, unidade_id, paciente_id, medico_id, status, criada_por) VALUES
  ('2a000000-0000-4000-8000-0000000fc002', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000fc002',
   '10000000-0000-4000-8000-000000000002', 'ativa', '10000000-0000-4000-8000-000000000002'),
  ('2a000000-0000-4000-8000-0000000fc003', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000fc003',
   '10000000-0000-4000-8000-000000000002', 'ativa', '10000000-0000-4000-8000-000000000002');
INSERT INTO public.prescricao_itens (id, prescricao_id, medicamento_id, descricao, dose, via, posologia, se_necessario, tipo, ordem, autor_id, peso_kg) VALUES
  -- P1: ceftriaxona aprazada daqui a 2 h
  ('2b000000-0000-4000-8000-0000000fc001', '2a000000-0000-4000-8000-0000000fc001', '00000000-0000-4000-8000-0000000fc001', 'Ceftriaxona', '1 g', 'EV', '12/12h', false, 'medicamento', 1, '10000000-0000-4000-8000-000000000002', 70),
  -- P2: ceftriaxona aprazada daqui a 5 h
  ('2b000000-0000-4000-8000-0000000fc002', '2a000000-0000-4000-8000-0000000fc002', '00000000-0000-4000-8000-0000000fc001', 'Ceftriaxona', '1 g', 'EV', '24/24h', false, 'medicamento', 1, '10000000-0000-4000-8000-000000000002', 40),
  -- P3: ceftriaxona sem aprazamento e dipirona se necessário (sem falta)
  ('2b000000-0000-4000-8000-0000000fc003', '2a000000-0000-4000-8000-0000000fc003', '00000000-0000-4000-8000-0000000fc001', 'Ceftriaxona', '1 g', 'EV', '24/24h', false, 'medicamento', 1, '10000000-0000-4000-8000-000000000002', NULL),
  ('2b000000-0000-4000-8000-0000000fc004', '2a000000-0000-4000-8000-0000000fc003', '00000000-0000-4000-8000-0000000fc002', 'Dipirona', '1 g', 'EV', '6/6h', true, 'medicamento', 2, '10000000-0000-4000-8000-000000000002', NULL);
UPDATE public.prescricao_itens SET horarios = ARRAY[to_char((now() + interval '2 hours') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')]
 WHERE id = '2b000000-0000-4000-8000-0000000fc001';
UPDATE public.prescricao_itens SET horarios = ARRAY[to_char((now() + interval '5 hours') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')]
 WHERE id = '2b000000-0000-4000-8000-0000000fc002';
INSERT INTO public.faltas_medicamento (unidade_id, medicamento_id, observacao, sinalizada_por) VALUES
  ('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000fc001', 'fornecedor sem previsão', '10000000-0000-4000-8000-000000000006');

CREATE TEMP TABLE t (k text PRIMARY KEY, v jsonb);
GRANT ALL ON t TO authenticated;
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

-- permissões: só authenticated executa
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.contexto_paciente_farmacia(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pacientes_das_faltas(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon executa as funções novas';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.contexto_paciente_farmacia(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated sem EXECUTE';
  END IF;
  RAISE NOTICE 'OK  anon sem EXECUTE; authenticated com EXECUTE';
END $$;

SET LOCAL ROLE authenticated;
-- ── VA1: quem não pode ──────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.contexto_paciente_farmacia('23000000-0000-4000-8000-0000000fc001', '21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'médico não usa a leitura da farmácia');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.contexto_paciente_farmacia('23000000-0000-4000-8000-0000000fc001', '21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'enfermagem não usa a leitura da farmácia');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT public.contexto_paciente_farmacia('23000000-0000-4000-8000-0000000fc001', '21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'recepção não lê');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.contexto_paciente_farmacia('23000000-0000-4000-8000-0000000fc001', '21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'gestor não usa a leitura da farmácia');

-- ── VA1: farmacêutico ───────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.contexto_paciente_farmacia('23000000-0000-4000-8000-0000000fc004', '21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'farmacêutico sem item ativo do paciente é recusado');
INSERT INTO t SELECT 'p1', public.contexto_paciente_farmacia('23000000-0000-4000-8000-0000000fc001', '21000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'p2', public.contexto_paciente_farmacia('23000000-0000-4000-8000-0000000fc002', '21000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'p3', public.contexto_paciente_farmacia('23000000-0000-4000-8000-0000000fc003', '21000000-0000-4000-8000-000000000001');
-- item suspenso não abre a leitura
RESET ROLE;
UPDATE public.prescricao_itens SET suspenso_em = now() WHERE prescricao_id = '2a000000-0000-4000-8000-0000000fc003';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.contexto_paciente_farmacia('23000000-0000-4000-8000-0000000fc003', '21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'com os itens suspensos, o farmacêutico deixa de ler');
RESET ROLE;
UPDATE public.prescricao_itens SET suspenso_em = NULL WHERE prescricao_id = '2a000000-0000-4000-8000-0000000fc003';

DO $$
DECLARE p1 jsonb := (SELECT v FROM t WHERE k = 'p1');
        p2 jsonb := (SELECT v FROM t WHERE k = 'p2');
        p3 jsonb := (SELECT v FROM t WHERE k = 'p3');
BEGIN
  IF p1 -> 'idade' ->> 'texto' IS NULL OR (p1 -> 'idade' ->> 'anos')::int < 50 OR p1 ->> 'publico' <> 'adulto' THEN
    RAISE EXCEPTION 'FALHOU: idade do adulto: %', p1;
  END IF;
  IF p1 -> 'alergias' ->> 'estado' <> 'tem' OR p1 -> 'alergias' -> 'ativas' -> 0 ->> 'substancia' <> 'Penicilina'
     OR p1 -> 'alergias' -> 'ativas' -> 0 ->> 'gravidade' <> 'grave' OR p1 -> 'alergias' -> 'ativas' -> 0 ->> 'reacao' <> 'Anafilaxia em 2019' THEN
    RAISE EXCEPTION 'FALHOU: alergia ativa: %', p1 -> 'alergias';
  END IF;
  IF (p1 ->> 'peso_kg')::numeric <> 70 THEN RAISE EXCEPTION 'FALHOU: peso de referência da prescrição: %', p1; END IF;
  IF p1 ? 'nome' OR p1 ? 'cpf' OR p1 ? 'cns' OR p1 ? 'data_nascimento' THEN RAISE EXCEPTION 'FALHOU: identificação além do necessário: %', p1; END IF;
  RAISE NOTICE 'OK  VA1: farmacêutico lê idade, alergia (substância, gravidade, reação) e peso; sem nome, CPF, CNS ou nascimento';
  IF p2 ->> 'publico' <> 'pediatrico' OR (p2 -> 'idade' ->> 'anos')::int <> 13 OR (p2 -> 'idade' ->> 'meses')::int <> 11 OR p2 -> 'alergias' ->> 'estado' <> 'nega' THEN
    RAISE EXCEPTION 'FALHOU: último dia da pediatria (13 anos e 11 meses) e "nega": %', p2;
  END IF;
  IF p3 ->> 'publico' <> 'adulto' OR p3 -> 'idade' ->> 'texto' <> '14 anos' OR p3 -> 'alergias' ->> 'estado' <> 'nao_registrada'
     OR jsonb_array_length(p3 -> 'alergias' -> 'ativas') <> 0 OR (p3 ->> 'peso_kg')::numeric <> 50 THEN
    RAISE EXCEPTION 'FALHOU: 14 anos completos é adulto; sem registro de alergia: %', p3;
  END IF;
  RAISE NOTICE 'OK  VA1: corte em 13 anos, 11 meses e 29 dias; nega e não registrada';
  IF (SELECT count(*) FROM public.log_acesso_prontuario
       WHERE acessado_por = '10000000-0000-4000-8000-000000000006' AND documento_tipo = 'Validação da farmácia'
         AND motivo LIKE 'validacao_farmacia%' AND papel = 'farmaceutico' AND tipo_acesso = 'leitura_prontuario'
         AND paciente_id IN ('23000000-0000-4000-8000-0000000fc001', '23000000-0000-4000-8000-0000000fc002', '23000000-0000-4000-8000-0000000fc003')) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: cada leitura com sucesso grava uma linha em log_acesso_prontuario';
  END IF;
  IF EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE paciente_id = '23000000-0000-4000-8000-0000000fc004') THEN
    RAISE EXCEPTION 'FALHOU: leitura recusada não grava acesso';
  END IF;
  RAISE NOTICE 'OK  VA1: registro de acesso (Validação da farmácia, motivo validacao_farmacia) a cada leitura';
END $$;

-- ── DI3: pacientes das faltas ───────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.pacientes_das_faltas('21000000-0000-4000-8000-000000000001')$$, 'Acesso negado', 'médico não lê os pacientes das faltas');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'faltas', public.pacientes_das_faltas('21000000-0000-4000-8000-000000000001');
RESET ROLE;
DO $$
DECLARE l jsonb := (SELECT v FROM t WHERE k = 'faltas');
BEGIN
  IF jsonb_array_length(l) <> 3 THEN RAISE EXCEPTION 'FALHOU: só os três itens da ceftriaxona em falta (dipirona sem falta fica fora): %', l; END IF;
  IF l -> 0 ->> 'item_id' <> '2b000000-0000-4000-8000-0000000fc001' OR l -> 0 ->> 'leito' <> '13A' OR l -> 0 ->> 'local' <> '13A'
     OR l -> 0 ->> 'proximo_em' IS NULL OR NOT (l -> 0 ->> 'aprazado')::boolean THEN
    RAISE EXCEPTION 'FALHOU: primeiro o horário mais próximo, com o leito: %', l -> 0;
  END IF;
  IF l -> 1 ->> 'item_id' <> '2b000000-0000-4000-8000-0000000fc002' OR l -> 1 ->> 'leito' IS NOT NULL OR l -> 1 ->> 'local' <> 'Pronto Socorro'
     OR (l -> 1 ->> 'proximo_em')::timestamptz <= (l -> 0 ->> 'proximo_em')::timestamptz THEN
    RAISE EXCEPTION 'FALHOU: sem leito, o setor; depois o horário seguinte: %', l -> 1;
  END IF;
  IF l -> 2 ->> 'item_id' <> '2b000000-0000-4000-8000-0000000fc003' OR l -> 2 ->> 'proximo_em' IS NOT NULL OR (l -> 2 ->> 'aprazado')::boolean THEN
    RAISE EXCEPTION 'FALHOU: sem aprazamento, sem horário e no fim: %', l -> 2;
  END IF;
  IF l -> 0 ? 'paciente' OR l -> 0 ? 'nome' THEN RAISE EXCEPTION 'FALHOU: nome do paciente não vem nesta leitura'; END IF;
  RAISE NOTICE 'OK  DI3: leito (ou setor) e próximo horário, o mais próximo primeiro; sem aprazamento no fim';
END $$;
-- a falta reposta tira os itens da lista
UPDATE public.faltas_medicamento SET situacao = 'reposta' WHERE medicamento_id = '00000000-0000-4000-8000-0000000fc001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
DO $$ BEGIN
  IF jsonb_array_length(public.pacientes_das_faltas('21000000-0000-4000-8000-000000000001')) <> 0 THEN
    RAISE EXCEPTION 'FALHOU: falta reposta não lista pacientes';
  END IF;
  RAISE NOTICE 'OK  DI3: falta reposta sai da lista';
END $$;
RESET ROLE;
ROLLBACK;
