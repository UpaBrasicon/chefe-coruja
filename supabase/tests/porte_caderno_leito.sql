-- Testes da migration 20261004000005_caderno_leito.sql (caderno do leito).
-- ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_caderno_leito.sql
-- Um adulto chega pela porta, é classificado e internado na Clínica Médica.
-- O médico (…0002) fica escalado SÓ na Clínica Médica: vê a classificação da
-- porta pelo leito, registra o diagnóstico (primário único, secundários só com
-- primário, histórico preservado), a tendência da acuidade nasce dos vitais e
-- a alta que ele deu aparece para cancelar.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-000000000088', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'sem-vinculo-caderno@teste.local', '', now(), '{}', '{"nome_completo":"Sem Vínculo Caderno"}', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-000000000088', 'Sem Vínculo Caderno') ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';
-- com a CID-10 carregada, os códigos do teste têm de existir nela
INSERT INTO t VALUES ('cid10_carregada', (EXISTS (SELECT 1 FROM terminologia.cid10))::text);

-- ── porta: ficha, classificação, atendimento e internação ──────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre e tosse', NULL,
  json_build_object('nome', 'Paciente Caderno Leito', 'data_nascimento', (current_date - interval '64 years')::date)::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":104,"frequencia-respiratoria":24,"temperatura":38.4,"saturacao-o2":93,"escala-dor":2,"pressao-arterial-sistolica":110,"pressao-arterial-diastolica":70}',
  pg_temp.u('flx'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep')), public.registrar_soap(pg_temp.u('ep'), 'tosse', 'crepitação', 'pneumonia?', 'internar', 'J18.9');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'internacao', NULL, '{"setor_id":"22000000-0000-4000-8000-000000000001"}');
RESET ROLE;
INSERT INTO t SELECT 'i', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('ep');
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.internacoes WHERE id = pg_temp.u('i');
-- o médico agora só na Clínica Médica (a porta sai da escala dele)
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

-- ── 1. classificação da porta vista do leito ───────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.abrir_prontuario(pg_temp.u('pac'), pg_temp.u('i'));
DO $$ DECLARE n int; c text;
BEGIN
  SELECT count(*), max(cor) INTO n, c FROM public.classificacoes_do_leito(pg_temp.u('i'));
  IF n <> 1 OR c <> 'amarelo' THEN RAISE EXCEPTION 'FALHOU: classificação da porta no leito (veio % %)', n, c; END IF;
  RAISE NOTICE 'OK  o médico do leito vê a classificação da porta, fora da escala da porta';
END $$;
SELECT pg_temp.falha(format('SELECT public.classificacoes_do_episodio(%L)', pg_temp.v('ep')), 'Acesso negado',
  'pela função da porta, sem estar na porta, continua negado (nada mudou nela)');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000088');
SELECT pg_temp.falha(format('SELECT public.classificacoes_do_leito(%L)', pg_temp.v('i')), 'Acesso negado', 'sem vínculo não vê a classificação');

-- ── 2. diagnóstico do episódio ─────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_diagnostico(%L, %L, %L, %L)', pg_temp.v('i'), 'secundario', 'I10', 'confirmado'),
  'Informe primeiro o diagnóstico primário', 'secundário sem primário é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_diagnostico(%L, %L, %L, %L)', pg_temp.v('i'), 'primario', 'pneumonia', 'hipotese'),
  'CID fora do formato', 'CID fora do formato é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_diagnostico(%L, %L, %L, %L, %s)', pg_temp.v('i'), 'primario', 'J18.9', 'hipotese', 3),
  'Escolha a unidade do tempo', 'tempo da doença sem unidade é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_diagnostico(%L, %L, %L, %L, %s, %L)', pg_temp.v('i'), 'primario', 'J18.9', 'talvez', 3, 'dias'),
  'Status: hipótese ou confirmado', 'status fora da lista é recusado');
INSERT INTO t SELECT 'd1', public.registrar_diagnostico(pg_temp.u('i'), 'primario', 'j189', 'hipotese', 3, 'dias')::text;
SELECT pg_temp.falha(format('SELECT public.registrar_diagnostico(%L, %L, %L, %L, %s, %L)', pg_temp.v('i'), 'secundario', 'I10', 'confirmado', 2, 'anos'),
  'O tempo da doença vai no diagnóstico primário', 'tempo da doença em secundário é recusado');
INSERT INTO t SELECT 'd2', public.registrar_diagnostico(pg_temp.u('i'), 'secundario', 'I10', 'confirmado')::text;
SELECT pg_temp.falha(format('SELECT public.registrar_diagnostico(%L, %L, %L, %L)', pg_temp.v('i'), 'secundario', 'I10', 'hipotese'),
  'O CID I10 já está no diagnóstico', 'secundário repetido é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_diagnostico(%L, %L, %L, %L)', pg_temp.v('i'), 'primario', 'I10', 'confirmado'),
  'O CID I10 está entre os secundários', 'primário igual a um secundário vigente é recusado');
-- o mesmo primário, igual, não grava de novo
DO $$ BEGIN
  IF public.registrar_diagnostico(pg_temp.u('i'), 'primario', 'J18.9', 'hipotese', 3, 'dias') <> pg_temp.u('d1') THEN
    RAISE EXCEPTION 'FALHOU: primário idêntico gravou outra linha';
  END IF;
  RAISE NOTICE 'OK  primário idêntico ao vigente não duplica';
END $$;
-- confirmar troca o primário e preserva o anterior
INSERT INTO t SELECT 'd3', public.registrar_diagnostico(pg_temp.u('i'), 'primario', 'J18.9', 'confirmado', 3, 'dias')::text;
DO $$ DECLARE n int; enc text; sub uuid;
BEGIN
  SELECT count(*) INTO n FROM public.diagnosticos_do_leito(pg_temp.u('i')) WHERE tipo = 'primario' AND encerrado_em IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: esperava um primário vigente, veio %', n; END IF;
  SELECT encerramento INTO enc FROM public.diagnosticos_do_leito(pg_temp.u('i')) WHERE id = pg_temp.u('d1');
  IF enc IS DISTINCT FROM 'substituido' THEN RAISE EXCEPTION 'FALHOU: o primário anterior não ficou como substituído (%)', enc; END IF;
  SELECT substitui_id INTO sub FROM public.diagnosticos_do_leito(pg_temp.u('i')) WHERE id = pg_temp.u('d3');
  IF sub IS DISTINCT FROM pg_temp.u('d1') THEN RAISE EXCEPTION 'FALHOU: o novo primário não aponta o anterior'; END IF;
  IF (SELECT autor_nome FROM public.diagnosticos_do_leito(pg_temp.u('i')) WHERE id = pg_temp.u('d3')) IS NULL THEN
    RAISE EXCEPTION 'FALHOU: sem o nome do autor';
  END IF;
  RAISE NOTICE 'OK  trocar o primário encerra o anterior (histórico preservado) e mantém um só vigente, com autor';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT cid_principal FROM public.internacoes WHERE id = pg_temp.u('i')) IS DISTINCT FROM 'J18.9' THEN
    RAISE EXCEPTION 'FALHOU: o primário não virou o CID principal da internação';
  END IF;
  RAISE NOTICE 'OK  o primário vigente é o CID principal da internação';
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.retirar_diagnostico(%L)', pg_temp.v('d3')), 'O primário é obrigatório', 'o primário não se retira');
SELECT public.retirar_diagnostico(pg_temp.u('d2'), 'Descartado após revisão');
DO $$ BEGIN
  IF (SELECT encerramento FROM public.diagnosticos_do_leito(pg_temp.u('i')) WHERE id = pg_temp.u('d2')) IS DISTINCT FROM 'retirado' THEN
    RAISE EXCEPTION 'FALHOU: secundário não foi retirado';
  END IF;
  RAISE NOTICE 'OK  secundário retirado fica no histórico';
END $$;
SELECT pg_temp.falha(format('SELECT public.retirar_diagnostico(%L)', pg_temp.v('d2')), 'Diagnóstico não encontrado ou já encerrado', 'retirar duas vezes é recusado');
-- escrita direta não existe para o cliente
SELECT pg_temp.falha(format($q$INSERT INTO public.diagnosticos_episodio (unidade_id, paciente_id, internacao_id, tipo, cid, status, registrado_por)
  VALUES ('21000000-0000-4000-8000-000000000001', %L, %L, 'secundario', 'E11', 'hipotese', '10000000-0000-4000-8000-000000000002')$q$,
  pg_temp.v('pac'), pg_temp.v('i')), 'permission denied', 'o cliente não grava diagnóstico direto na tabela');
-- a enfermagem (fora da Clínica Médica) e quem não tem vínculo não registram nem leem
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.registrar_diagnostico(%L, %L, %L, %L)', pg_temp.v('i'), 'secundario', 'E11', 'hipotese'),
  'O diagnóstico é registrado pelo médico de plantão', 'fora do plantão do paciente não registra');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000088');
SELECT pg_temp.falha(format('SELECT public.diagnosticos_do_leito(%L)', pg_temp.v('i')), 'Acesso negado', 'sem vínculo não lê o diagnóstico');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.diagnosticos_episodio) THEN RAISE EXCEPTION 'FALHOU: RLS mostrou diagnóstico a quem não tem vínculo'; END IF;
  RAISE NOTICE 'OK  RLS esconde o diagnóstico de quem não tem vínculo';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.diagnosticos_episodio WHERE internacao_id = pg_temp.u('i')) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: o médico do leito não lê o diagnóstico pela tabela';
  END IF;
  RAISE NOTICE 'OK  o médico do leito lê o diagnóstico pela RLS (para a lista de internados)';
END $$;
RESET ROLE;
-- nem o dono do banco reescreve ou apaga
SELECT pg_temp.falha(format('UPDATE public.diagnosticos_episodio SET cid = %L WHERE id = %L', 'J15.9', pg_temp.v('d3')),
  'Diagnóstico registrado não se reescreve', 'diagnóstico não se reescreve');
SELECT pg_temp.falha(format('UPDATE public.diagnosticos_episodio SET motivo_encerramento = %L WHERE id = %L', 'x', pg_temp.v('d2')),
  'Diagnóstico encerrado não muda', 'diagnóstico encerrado não muda');
SELECT pg_temp.falha(format('DELETE FROM public.diagnosticos_episodio WHERE id = %L', pg_temp.v('d1')),
  'Registro clínico não se apaga', 'diagnóstico não se apaga (guarda de 20 anos)');

-- ── 3. tendência da acuidade ───────────────────────────────────────────────
INSERT INTO public.observacao (unidade_id, paciente_id, internacao_id, conceito_id, valor_num, valor_conceito_id, aferido_em, registrado_por)
SELECT '21000000-0000-4000-8000-000000000001', pg_temp.u('pac'), pg_temp.u('i'), c.id, x.n,
       (SELECT o.id FROM public.conceito_opcao o WHERE o.conceito_id = c.id AND o.valor = x.cod), clock_timestamp() - interval '4 hours',
       '10000000-0000-4000-8000-000000000002'
FROM (VALUES ('frequencia-respiratoria', 18, NULL), ('saturacao-o2', 97, NULL), ('temperatura', 37.0, NULL),
             ('pressao-arterial-sistolica', 125, NULL), ('frequencia-cardiaca', 80, NULL),
             ('oxigenio-suplementar', NULL, 'ar'), ('nivel-consciencia', NULL, 'A')) x(nome, n, cod)
JOIN public.conceito c ON c.nome = x.nome AND c.unidade_id IS NULL;
INSERT INTO public.observacao (unidade_id, paciente_id, internacao_id, conceito_id, valor_num, valor_conceito_id, aferido_em, registrado_por)
SELECT '21000000-0000-4000-8000-000000000001', pg_temp.u('pac'), pg_temp.u('i'), c.id, x.n, NULL, clock_timestamp(),
       '10000000-0000-4000-8000-000000000002'
FROM (VALUES ('frequencia-respiratoria', 26), ('pressao-arterial-sistolica', 95), ('frequencia-cardiaca', 118)) x(nome, n)
JOIN public.conceito c ON c.nome = x.nome AND c.unidade_id IS NULL;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ DECLARE n int; primeiro int; ultimo int; acu jsonb;
BEGIN
  SELECT count(*) INTO n FROM public.tendencia_acuidade(pg_temp.u('pac'));
  IF n < 2 THEN RAISE EXCEPTION 'FALHOU: esperava 2 pontos na tendência, veio %', n; END IF;
  SELECT total INTO primeiro FROM public.tendencia_acuidade(pg_temp.u('pac')) LIMIT 1;
  SELECT total INTO ultimo FROM public.tendencia_acuidade(pg_temp.u('pac')) ORDER BY aferido_em DESC LIMIT 1;
  acu := public.acuidade(pg_temp.u('pac'));
  IF ultimo <> (acu ->> 'total')::int THEN
    RAISE EXCEPTION 'FALHOU: o último ponto (%) difere do escore de agora (%)', ultimo, acu ->> 'total';
  END IF;
  IF primeiro >= ultimo THEN RAISE EXCEPTION 'FALHOU: a tendência devia subir (% → %)', primeiro, ultimo; END IF;
  RAISE NOTICE 'OK  cada lançamento de vitais grava o escore; a série sobe de % para % e termina no escore de agora', primeiro, ultimo;
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000088');
SELECT pg_temp.falha(format('SELECT public.tendencia_acuidade(%L)', pg_temp.v('pac')), 'Acesso negado', 'sem vínculo não lê a tendência');
RESET ROLE;
SELECT pg_temp.falha(format('DELETE FROM public.acuidade_afericoes WHERE paciente_id = %L', pg_temp.v('pac')),
  'Registro clínico não se apaga', 'escore gravado não se apaga');

-- ── 4. altas que eu dei (para cancelar em 24 h) ────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.dar_alta(pg_temp.u('i'), 'alta_melhorada', 'J18.9');
DO $$ DECLARE n int; nome text;
BEGIN
  SELECT count(*), max(paciente_nome) INTO n, nome FROM public.minhas_altas_recentes('21000000-0000-4000-8000-000000000001')
   WHERE internacao_id = pg_temp.u('i');
  IF n <> 1 OR nome <> 'Paciente Caderno Leito' THEN RAISE EXCEPTION 'FALHOU: a alta dada não aparece (% %)', n, nome; END IF;
  RAISE NOTICE 'OK  a alta que o médico deu aparece para ele, com o nome do paciente';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.minhas_altas_recentes('21000000-0000-4000-8000-000000000001') WHERE internacao_id = pg_temp.u('i')) THEN
    RAISE EXCEPTION 'FALHOU: a alta de outro aparece para quem não a deu';
  END IF;
  RAISE NOTICE 'OK  quem não deu a alta não a vê na lista';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.cancelar_alta(pg_temp.u('i'), 'Alta dada no leito errado, paciente segue internado');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.minhas_altas_recentes('21000000-0000-4000-8000-000000000001') WHERE internacao_id = pg_temp.u('i')) THEN
    RAISE EXCEPTION 'FALHOU: alta cancelada continua na lista';
  END IF;
  RAISE NOTICE 'OK  alta cancelada sai da lista';
END $$;

ROLLBACK;
