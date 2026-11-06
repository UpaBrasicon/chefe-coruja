-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270304000001_prontuario_leitura.sql (Prontuário
-- completo em linha do tempo; decisão do RT em 06/11/2026: A em P1 a P7).
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. sem pedido nem escala, a leitura falha (e os nomes também);
-- 2. com pedido vigente (sem escala), lê: 5 atendimentos, o resumo, a
--    internação, o registro do atendimento, o exame com o resultado, o
--    documento ligado pela internação, os sinais vitais, os nomes e o
--    registro sem atendimento; a leitura não grava nada;
-- 3. a paginação traz 5 e depois o resto (com o cadastro unificado), sem
--    repetir os registros sem atendimento;
-- 4. pedido vencido falha;
-- 5. com o segundo fator exigido, a leitura sem ele falha.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-000000007401'),
  ('upa',   '00000000-0000-4000-8000-000000007402'),
  ('porta', '00000000-0000-4000-8000-000000007403'),
  ('obs',   '00000000-0000-4000-8000-000000007404'),
  ('med',   '00000000-0000-4000-8000-000000007411'),
  ('medx',  '00000000-0000-4000-8000-000000007412'),
  ('gest',  '00000000-0000-4000-8000-000000007413'),
  ('medv',  '00000000-0000-4000-8000-000000007414'),
  ('pac',   '00000000-0000-4000-8000-000000007421'),
  ('pacb',  '00000000-0000-4000-8000-000000007422'),
  ('ep1',   '00000000-0000-4000-8000-000000007431'),
  ('ep2',   '00000000-0000-4000-8000-000000007432'),
  ('ep3',   '00000000-0000-4000-8000-000000007433'),
  ('ep4',   '00000000-0000-4000-8000-000000007434'),
  ('ep5',   '00000000-0000-4000-8000-000000007435'),
  ('ep6',   '00000000-0000-4000-8000-000000007436'),
  ('ep7',   '00000000-0000-4000-8000-000000007437'),
  ('int1',  '00000000-0000-4000-8000-000000007441'),
  ('ex1',   '00000000-0000-4000-8000-000000007451');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
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
CREATE TEMP TABLE r (nome text PRIMARY KEY, v jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;
CREATE FUNCTION pg_temp.r(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT v FROM r WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.r(text) TO authenticated;
CREATE TEMP TABLE contagem (nome text PRIMARY KEY, n bigint) ON COMMIT DROP;

-- ── cenário: uma UPA, quatro pessoas, um paciente com cadastro absorvido ────
INSERT INTO auth.users (id, email) SELECT id, nome || '@prontleitura.local' FROM ids WHERE nome IN ('med', 'medx', 'gest', 'medv');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'medx', 'gest', 'medv')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do prontuário');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do prontuário', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-Socorro do prontuário', 'emergencia'),
  (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação do prontuário', 'observacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medx'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('medv'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('gest'), pg_temp.id('upa'), 'gestor');
-- ninguém de escala: quem lê, lê pelo pedido

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo) VALUES
  (pg_temp.id('pac'), pg_temp.id('upa'), 'Paciente do prontuário', '1958-03-12', 'F'),
  (pg_temp.id('pacb'), pg_temp.id('upa'), 'Paciente do prontuário (cadastro antigo)', '1958-03-12', 'F');
UPDATE public.pacientes SET unificado_em = pg_temp.id('pac') WHERE id = pg_temp.id('pacb');

-- sete atendimentos encerrados: ep1 é o mais recente; ep7 é do cadastro absorvido
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, cor_atual,
                              atendimento_medico_id, desfecho, encerrado_em, desfecho_em)
SELECT pg_temp.id(x.ep), pg_temp.id('upa'), pg_temp.id(x.pac), pg_temp.id('porta'), 'encerrado', 'Queixa do teste', pg_temp.id('gest'),
       now() - make_interval(days => x.dias), 'amarelo', pg_temp.id('med'), x.desfecho,
       now() - make_interval(days => x.dias) + interval '2 hours', now() - make_interval(days => x.dias) + interval '2 hours'
  FROM (VALUES ('ep1', 'pac', 1, 'observacao'), ('ep2', 'pac', 20, 'alta'), ('ep3', 'pac', 40, 'alta'), ('ep4', 'pac', 60, 'alta'),
               ('ep5', 'pac', 80, 'alta'), ('ep6', 'pac', 100, 'alta'), ('ep7', 'pacb', 400, 'alta')) x(ep, pac, dias, desfecho);

-- ep1 seguiu para a observação
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, tipo_internacao, setor_atual_id, data_admissao, episodio_id, cid_principal)
VALUES (pg_temp.id('int1'), pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac'), 'em_observacao', 'observacao', pg_temp.id('obs'),
        now() - interval '1 day' + interval '2 hours', pg_temp.id('ep1'), 'J18.9');
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, publico, cor, reclassificacao, autor_id, autor_papel, criado_em)
VALUES (pg_temp.id('ep1'), pg_temp.id('upa'), pg_temp.id('pac'), 'adulto', 'amarelo', false, pg_temp.id('gest'), 'enfermeiro', now() - interval '1 day' + interval '5 minutes'),
       (pg_temp.id('ep1'), pg_temp.id('upa'), pg_temp.id('pac'), 'adulto', 'laranja', true, pg_temp.id('med'), 'plantonista', now() - interval '1 day' + interval '40 minutes');
INSERT INTO public.atendimento_registros (episodio_id, unidade_id, paciente_id, subjetivo, cid, autor_id, criado_em)
VALUES (pg_temp.id('ep1'), pg_temp.id('upa'), pg_temp.id('pac'), 'Dispneia há 3 dias', 'J18.9', pg_temp.id('med'), now() - interval '1 day' + interval '20 minutes');
INSERT INTO public.exames_pedidos (id, unidade_id, paciente_id, episodio_id, exame, pedido_por, situacao)
VALUES (pg_temp.id('ex1'), pg_temp.id('upa'), pg_temp.id('pac'), pg_temp.id('ep1'), 'Hemograma completo', pg_temp.id('med'), 'resultado');
INSERT INTO public.exame_resultados (exame_id, versao, origem, texto, registrado_por, vigente, liberado_em, conteudo_hash)
VALUES (pg_temp.id('ex1'), 1, 'manual', 'Hb 12,1 g/dL', pg_temp.id('med'), true, now(), 'h');
-- uma evolução da observação (ligada só à internação) e um atestado sem atendimento
INSERT INTO public.documentos_clinicos (organizacao_id, unidade_id, paciente_id, internacao_id, tipo_documento, conteudo, conteudo_hash,
                                        autor_id, estado, documento_raiz_id, versao)
VALUES (pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac'), pg_temp.id('int1'), 'evolucao', 'Evolução da observação', 'h',
        pg_temp.id('med'), 'ativo', gen_random_uuid(), 1),
       (pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac'), NULL, 'atestado', 'Atestado sem atendimento', 'h',
        pg_temp.id('med'), 'ativo', gen_random_uuid(), 1);
-- uma aferição na observação
INSERT INTO public.observacao (unidade_id, paciente_id, internacao_id, episodio_id, conceito_id, aferido_em, valor_num, origem)
SELECT pg_temp.id('upa'), pg_temp.id('pac'), pg_temp.id('int1'), pg_temp.id('ep1'), c.id, now() - interval '20 hours', x.v, 'manual'
  FROM (VALUES ('pressao-arterial-sistolica', 128), ('pressao-arterial-diastolica', 82), ('frequencia-cardiaca', 96)) x(nome, v)
  JOIN public.conceito c ON c.nome = x.nome AND c.unidade_id IS NULL;

-- pedidos: o de med vigente; o de medv vencido
INSERT INTO public.pedidos_acesso_prontuario (organizacao_id, unidade_id, paciente_id, solicitante_id, papel, motivo,
                                              status, decidido_por, decidido_em, valido_ate)
VALUES (pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac'), pg_temp.id('med'), 'plantonista', 'Revisar a internação anterior',
        'aprovado', pg_temp.id('gest'), now() - interval '1 hour', now() + interval '20 hours'),
       (pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac'), pg_temp.id('medv'), 'plantonista', 'Revisar a internação anterior',
        'aprovado', pg_temp.id('gest'), now() - interval '30 hours', now() - interval '6 hours');

-- ── 1. sem pedido nem escala ────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('medx');
SELECT pg_temp.falha($$SELECT public.prontuario_leitura(pg_temp.id('pac'))$$, 'Sem acesso a este paciente',
                     'sem pedido nem escala, a leitura falha');
SELECT pg_temp.falha($$SELECT private.prontuario_complemento(pg_temp.id('pac'), ARRAY[pg_temp.id('med')], '{}')$$, 'Acesso negado',
                     'sem acesso, os nomes também não saem');

-- ── 2. com pedido vigente, lê ───────────────────────────────────────────────
RESET ROLE;
INSERT INTO contagem SELECT 'log', count(*) FROM public.log_acesso_prontuario WHERE paciente_id = pg_temp.id('pac');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT public.abrir_prontuario(pg_temp.id('pac'));
RESET ROLE;
INSERT INTO contagem SELECT 'log_aberto', count(*) FROM public.log_acesso_prontuario WHERE paciente_id = pg_temp.id('pac');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
INSERT INTO r SELECT 'p1', public.prontuario_leitura(pg_temp.id('pac'));
DO $$
DECLARE v jsonb := pg_temp.r('p1');
BEGIN
  PERFORM pg_temp.ok(jsonb_array_length(v -> 'atendimentos') = 5 AND (v ->> 'mais')::boolean,
                     'com pedido vigente: 5 atendimentos e há mais');
  PERFORM pg_temp.ok(v #>> '{atendimentos,0,id}' = pg_temp.id('ep1')::text, 'o mais recente primeiro');
  PERFORM pg_temp.ok((v #>> '{resumo,atendimentos}')::int = 7 AND (v #>> '{resumo,internacoes}')::int = 1
                     AND jsonb_array_length(v #> '{resumo,anos}') >= 1, 'resumo: 7 atendimentos (cadastro unificado junto), 1 internação, anos');
  PERFORM pg_temp.ok(v #>> '{internacoes,0,id}' = pg_temp.id('int1')::text AND v #>> '{internacoes,0,setor_id}' = pg_temp.id('obs')::text,
                     'a internação do atendimento, com o setor');
  PERFORM pg_temp.ok(jsonb_array_length(v -> 'classificacoes') = 2, 'classificação e reclassificação');
  PERFORM pg_temp.ok(v #>> '{registros,0,cid}' = 'J18.9', 'o registro do atendimento, com o CID');
  PERFORM pg_temp.ok(v #>> '{exames,0,exame}' = 'Hemograma completo'
                     AND v #>> ARRAY['resultados', pg_temp.id('ex1')::text, 'texto'] = 'Hb 12,1 g/dL', 'o exame com o resultado vigente');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'documentos') d WHERE d ->> 'conteudo' = 'Evolução da observação'),
                     'o documento ligado pela internação');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'documentos') d
                              WHERE d ->> 'conteudo' = 'Atestado sem atendimento' AND d ->> 'episodio_id' IS NULL),
                     'o documento sem atendimento vem na primeira página');
  PERFORM pg_temp.ok(jsonb_array_length(v -> 'observacoes') = 3, 'os sinais vitais da aferição');
  PERFORM pg_temp.ok(v #>> ARRAY['nomes', pg_temp.id('med')::text] = 'Pessoa med'
                     AND v #>> ARRAY['nomes', pg_temp.id('obs')::text] = 'Observação do prontuário'
                     AND v #>> ARRAY['nomes', pg_temp.id('upa')::text] = 'UPA do prontuário',
                     'os nomes do médico, do setor e da unidade (perfis e setores não aceitam o pedido)');
  PERFORM pg_temp.ok(NOT (v -> 'nomes') ? pg_temp.id('medx')::text, 'só o nome de quem aparece nos registros');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT n FROM contagem WHERE nome = 'log_aberto') = (SELECT count(*) FROM public.log_acesso_prontuario WHERE paciente_id = pg_temp.id('pac'))
                     AND (SELECT n FROM contagem WHERE nome = 'log_aberto') > (SELECT n FROM contagem WHERE nome = 'log'),
                     'abrir grava o acesso; a leitura não grava nada');
END $$;

-- ── 3. paginação: 5 e depois o resto ────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
INSERT INTO r SELECT 'p2', public.prontuario_leitura(pg_temp.id('pac'), (pg_temp.r('p1') ->> 'proximo_antes')::timestamptz);
DO $$
DECLARE v jsonb := pg_temp.r('p2');
BEGIN
  PERFORM pg_temp.ok(jsonb_array_length(v -> 'atendimentos') = 2 AND NOT (v ->> 'mais')::boolean, 'a segunda página traz o resto (2) e acaba');
  PERFORM pg_temp.ok(v #>> '{atendimentos,1,id}' = pg_temp.id('ep7')::text AND v #>> '{atendimentos,1,paciente_id}' = pg_temp.id('pacb')::text,
                     'o atendimento do cadastro absorvido entra na sequência');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'documentos') d WHERE d ->> 'conteudo' = 'Atestado sem atendimento'),
                     'os registros sem atendimento não se repetem');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'atendimentos') a
                                  WHERE a ->> 'id' IN (SELECT jsonb_array_elements(pg_temp.r('p1') -> 'atendimentos') ->> 'id')),
                     'nenhum atendimento repetido entre as páginas');
END $$;
INSERT INTO r SELECT 'p3', public.prontuario_leitura(pg_temp.id('pac'), NULL, 2);
SELECT pg_temp.ok(jsonb_array_length(pg_temp.r('p3') -> 'atendimentos') = 2 AND (pg_temp.r('p3') ->> 'mais')::boolean, 'p_limite muda o tamanho da página');

-- ── 4. pedido vencido ───────────────────────────────────────────────────────
SELECT pg_temp.como('medv');
SELECT pg_temp.falha($$SELECT public.prontuario_leitura(pg_temp.id('pac'))$$, 'Sem acesso a este paciente', 'pedido vencido falha');

-- ── 5. segundo fator ────────────────────────────────────────────────────────
RESET ROLE;
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.falha($$SELECT public.prontuario_leitura(pg_temp.id('pac'))$$, 'SEGUNDO_FATOR', 'sem o segundo fator, a leitura falha');

RESET ROLE;
ROLLBACK;
