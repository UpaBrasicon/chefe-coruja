-- Testes da Fase 3 (migrations 20260928000001..04). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase3_observacao_internacao_alta.sql
-- Regras do ESTADO.md: observação (box automático, 6h, sair resolve), alta
-- (impeditivos, CID, retroativa, cancelar), passagem (aceite, recusa com motivo,
-- retirar/reenviar, check-out bloqueado) e vitais crus.
BEGIN;
-- médico (…0002) no PS, na Observação e na Clínica Médica; enfermeira (…0004)
-- chega na Observação daqui a 1h; recepção (…0005) no PS.
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
-- presenças de check-ins reais no banco local (desde 20261014000001 a tela cobra o check-in) não entram no teste
DELETE FROM public.presenca_plantonista WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000001']::uuid[]) s;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'tarde', now() + interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- dois boxes na Observação
INSERT INTO public.leitos (setor_id, identificador, tipo) VALUES
  ('22000000-0000-4000-8000-000000000002', 'Box 2', 'observacao'),
  ('22000000-0000-4000-8000-000000000002', 'Box 1', 'observacao');
-- presença do médico com check-in feito
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT unidade_id, id, perfil_id, data, turno, now() - interval '1 hour' FROM public.escala_plantao
 WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND setor_id = '22000000-0000-4000-8000-000000000002';
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
-- espera erro com o começo de mensagem dado
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

-- ── porta: três adultos e uma criança chegam, são triados e atendidos ──────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ea', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL, '{"nome":"Fase Tres A","data_nascimento":"1970-01-01"}') ->> 'episodio_id';
INSERT INTO t SELECT 'eb', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL, '{"nome":"Fase Tres B","data_nascimento":"1960-01-01"}') ->> 'episodio_id';
INSERT INTO t SELECT 'ec', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL, '{"nome":"Fase Tres C","data_nascimento":"1980-01-01"}') ->> 'episodio_id';
INSERT INTO t SELECT 'ed', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  json_build_object('nome', 'Fase Tres Crianca', 'data_nascimento', (current_date - interval '2 years 3 months')::date)::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u(x), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  pg_temp.u('flx'), 'Edema de face')
  FROM unnest(ARRAY['ea', 'eb', 'ec']) x;
-- criança: PA não é obrigatória na triagem pediátrica
SELECT public.classificar_risco(pg_temp.u('ed'), 'amarelo',
  '{"frequencia-cardiaca":120,"frequencia-respiratoria":30,"temperatura":38.0,"saturacao-o2":97,"escala-dor":2}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE publico = 'pediatrico' AND nome = 'Alterações cardíacas'), 'História de lipotimia');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u(x)), public.registrar_soap(pg_temp.u(x), 'queixa', 'exame', 'avaliacao', 'plano', 'R60')
  FROM unnest(ARRAY['ea', 'eb', 'ec', 'ed']) x;

-- ── 3.1 box automático e observação como pendência de 6h ────────────────────
SELECT public.registrar_desfecho(pg_temp.u('ea'), 'observacao');
SELECT public.registrar_desfecho(pg_temp.u('eb'), 'observacao');
SELECT public.registrar_desfecho(pg_temp.u('ec'), 'observacao');
SELECT public.registrar_desfecho(pg_temp.u('ed'), 'observacao');
RESET ROLE;
INSERT INTO t SELECT 'ia', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('ea');
INSERT INTO t SELECT 'ib', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('eb');
INSERT INTO t SELECT 'ic', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('ec');
INSERT INTO t SELECT 'pa', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ea');
INSERT INTO t SELECT 'pd', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ed');
DO $$
DECLARE a public.internacoes; b public.internacoes; c public.internacoes; pe public.pendencias;
BEGIN
  SELECT * INTO a FROM public.internacoes WHERE id = pg_temp.u('ia');
  SELECT * INTO b FROM public.internacoes WHERE id = pg_temp.u('ib');
  SELECT * INTO c FROM public.internacoes WHERE id = pg_temp.u('ic');
  IF a.status <> 'em_observacao' OR a.setor_atual_id <> '22000000-0000-4000-8000-000000000002'
     OR (SELECT identificador FROM public.leitos WHERE id = a.leito_atual_id) <> 'Box 1'
     OR (SELECT identificador FROM public.leitos WHERE id = b.leito_atual_id) <> 'Box 2' THEN
    RAISE EXCEPTION 'FALHOU: box automático (A=%, B=%)', a.leito_atual_id, b.leito_atual_id;
  END IF;
  RAISE NOTICE 'OK  desfecho observação abre a internação do episódio no primeiro box livre';
  IF c.leito_atual_id IS NOT NULL OR c.status <> 'em_observacao' THEN RAISE EXCEPTION 'FALHOU: sem box livre'; END IF;
  RAISE NOTICE 'OK  sem box livre o paciente fica na Observação aguardando box';
  IF (SELECT status FROM public.leitos WHERE id = a.leito_atual_id) <> 'ocupado' THEN RAISE EXCEPTION 'FALHOU: box não ocupado'; END IF;
  SELECT * INTO pe FROM public.pendencias WHERE internacao_id = a.id AND tipo = 'observacao';
  IF pe.situacao <> 'aberta' OR abs(extract(epoch FROM pe.prazo - (a.data_admissao + interval '6 hours'))) > 5 THEN
    RAISE EXCEPTION 'FALHOU: pendência de observação de 6h (%)', pe;
  END IF;
  RAISE NOTICE 'OK  observação vira pendência com prazo de 6h contado da entrada no box';
  IF (SELECT etapa FROM public.episodios WHERE id = pg_temp.u('ea')) <> 'observacao'
     OR (SELECT setor_id FROM public.pacientes WHERE id = a.paciente_id) <> a.setor_atual_id THEN
    RAISE EXCEPTION 'FALHOU: episódio/paciente não acompanharam';
  END IF;
  RAISE NOTICE 'OK  episódio em observação e paciente no censo da Observação';
END $$;

-- ── 3.2 pendências ──────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.concluir_pendencia(%L)',
  (SELECT id FROM public.pendencias WHERE internacao_id = pg_temp.u('ia') AND tipo = 'observacao')),
  'A observação se resolve com a conduta', 'a pendência de observação não se conclui à mão');
INSERT INTO t SELECT 'parecer', public.registrar_pendencia(pg_temp.u('ia'), 'parecer', 'Parecer da cirurgia', '2h');
INSERT INTO t SELECT 'exame', public.registrar_pendencia(pg_temp.u('ia'), 'exame', 'Hemograma', 'fim_plantao');
RESET ROLE;
DO $$ BEGIN
  IF NOT (SELECT impeditiva FROM public.pendencias WHERE id = pg_temp.u('parecer'))
     OR (SELECT impeditiva FROM public.pendencias WHERE id = pg_temp.u('exame'))
     OR (SELECT prazo FROM public.pendencias WHERE id = pg_temp.u('exame')) IS NULL
     OR (SELECT autor_id FROM public.pendencias WHERE id = pg_temp.u('exame')) <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: pendência com tipo, prazo e autor';
  END IF;
  RAISE NOTICE 'OK  pendência guarda tipo, prazo (inclusive fim do plantão) e autor; parecer impede a alta';
END $$;

-- ── 3.3 vitais crus e acuidade ──────────────────────────────────────────────
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, valor_num, valor_conceito_id, aferido_em, registrado_por)
SELECT '21000000-0000-4000-8000-000000000001', pg_temp.u('pa'), c.id, x.n,
       (SELECT o.id FROM public.conceito_opcao o WHERE o.conceito_id = c.id AND o.valor = x.cod), clock_timestamp(),
       '10000000-0000-4000-8000-000000000004'
FROM (VALUES ('frequencia-respiratoria', 26, NULL), ('saturacao-o2', 91, NULL), ('temperatura', 38.5, NULL),
             ('pressao-arterial-sistolica', 95, NULL), ('frequencia-cardiaca', 115, NULL),
             ('oxigenio-suplementar', NULL, 'ar'), ('nivel-consciencia', NULL, 'A')) x(nome, n, cod)
JOIN public.conceito c ON c.nome = x.nome AND c.unidade_id IS NULL;
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, valor_num, valor_conceito_id, aferido_em, registrado_por)
SELECT '21000000-0000-4000-8000-000000000001', pg_temp.u('pd'), c.id, x.n,
       (SELECT o.id FROM public.conceito_opcao o WHERE o.conceito_id = c.id AND o.valor = x.cod), clock_timestamp(),
       '10000000-0000-4000-8000-000000000004'
FROM (VALUES ('frequencia-respiratoria', 50, NULL), ('frequencia-cardiaca', 150, NULL), ('saturacao-o2', 93, NULL),
             ('esforco-respiratorio', NULL, '1'), ('oxigenio-suplementar', NULL, 'ar'), ('enchimento-capilar', NULL, '<3')) x(nome, n, cod)
JOIN public.conceito c ON c.nome = x.nome AND c.unidade_id IS NULL;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'acu_a', public.acuidade(pg_temp.u('pa'))::text;
INSERT INTO t SELECT 'acu_d', public.acuidade(pg_temp.u('pd'))::text;
RESET ROLE;
DO $$
DECLARE a jsonb := pg_temp.v('acu_a')::jsonb; d jsonb := pg_temp.v('acu_d')::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
              WHERE c.categoria = 'sinal_vital' AND (o.flag <> 'N' OR o.ref_min IS NOT NULL OR o.ref_max IS NOT NULL)) THEN
    RAISE EXCEPTION 'FALHOU: sinal vital com marca de alterado';
  END IF;
  RAISE NOTICE 'OK  sinal vital fica cru: sem faixa e sem marca (FC 150 da criança inclusive)';
  -- NEWS2: FR26=3, SpO2 91=3, ar=0, T38,5=1, PAS95=2, FC115=2, Alerta=0 → 11
  IF a ->> 'escala' <> 'NEWS2' OR (a ->> 'total')::int <> 11 OR (a ->> 'banda')::int <> 2 OR (a ->> 'parcial')::boolean THEN
    RAISE EXCEPTION 'FALHOU: NEWS2 do adulto (%)', a;
  END IF;
  RAISE NOTICE 'OK  adulto recebe NEWS2 (11, banda alta) com fonte declarada';
  -- PEWS 1 a 4 anos: FR50=2, FC150=2, SpO2 93=1, esforço leve=1, ar=0, TEC<3=0 → 6; PAS faltando
  IF d ->> 'escala' <> 'PEWS' OR (d ->> 'total')::int <> 6 OR (d ->> 'banda')::int <> 1 OR d ->> 'grupo' <> '1 a 4 anos'
     OR NOT (d ->> 'parcial')::boolean OR NOT (d -> 'faltando') ? 'Pressão sistólica' OR d ->> 'fonte' NOT LIKE '%Parshuram%' THEN
    RAISE EXCEPTION 'FALHOU: PEWS da criança (%)', d;
  END IF;
  RAISE NOTICE 'OK  criança (< 14 anos) recebe PEWS por faixa de idade; vital faltando não trava e é listado';
END $$;
-- zona azul: FR 3 aos 2 anos dispara sozinha
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, valor_num, aferido_em)
SELECT '21000000-0000-4000-8000-000000000001', pg_temp.u('pd'), id, 3, clock_timestamp() FROM public.conceito WHERE nome = 'frequencia-respiratoria' AND unidade_id IS NULL;
DO $$ DECLARE d jsonb := private.calcular_acuidade(pg_temp.u('pd'));
BEGIN
  IF (d ->> 'banda')::int <> 2 OR NOT (d -> 'azul') ? 'Frequência respiratória' THEN RAISE EXCEPTION 'FALHOU: zona azul (%)', d; END IF;
  RAISE NOTICE 'OK  zona azul do PEWS é gatilho de parâmetro único';
END $$;

-- ── 3.4 admissão e evolução ─────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'adm', public.registrar_evolucao(pg_temp.u('ia'), 'admissao_anamnese', 'Admissão: edema de face há 2 dias.');
SELECT pg_temp.falha(format('SELECT public.registrar_evolucao(%L, %L, %L)', pg_temp.v('ia'), 'admissao_anamnese', 'Outra admissão qualquer'),
  'A admissão desta internação já foi registrada', 'uma admissão por internação');
INSERT INTO t SELECT 'ev1', public.registrar_evolucao(pg_temp.u('ia'), 'evolucao', 'Evolução 1: melhora do edema.');
INSERT INTO t SELECT 'ev2', public.registrar_evolucao(pg_temp.u('ia'), 'evolucao', 'Evolução 2: sem queixas novas.');
SELECT pg_temp.falha(format('SELECT public.corrigir_evolucao(%L, %L, %L)', pg_temp.v('ev1'), 'Evolução 1 corrigida.', 'curto'),
  'Justifique a correção', 'correção exige justificativa');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.corrigir_evolucao(%L, %L, %L)', pg_temp.v('ev1'), 'Evolução 1 alterada por outra pessoa.', 'justificativa bem longa'),
  'Só o autor corrige', 'só o autor corrige a própria evolução');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'ev1b', public.corrigir_evolucao(pg_temp.u('ev1'), 'Evolução 1: melhora parcial do edema.', 'lateralidade estava errada');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT documento_raiz_id FROM public.documentos_clinicos WHERE id = pg_temp.u('ev1'))
     = (SELECT documento_raiz_id FROM public.documentos_clinicos WHERE id = pg_temp.u('ev2')) THEN
    RAISE EXCEPTION 'FALHOU: evolução nova virou versão da anterior';
  END IF;
  RAISE NOTICE 'OK  cada evolução é um registro próprio';
  IF (SELECT versao FROM public.documentos_clinicos WHERE id = pg_temp.u('ev1b')) <> 2
     OR (SELECT estado FROM public.documentos_clinicos WHERE id = pg_temp.u('ev1')) <> 'retificado'
     OR (SELECT motivo_retificacao FROM public.documentos_clinicos WHERE id = pg_temp.u('ev1b')) <> 'lateralidade estava errada' THEN
    RAISE EXCEPTION 'FALHOU: versão da correção';
  END IF;
  RAISE NOTICE 'OK  correção gera versão 2 com a justificativa e a anterior fica retificada';
END $$;

-- ── 3.5 passagem de plantão ─────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.enviar_passagem(%L, %L, %L)', pg_temp.v('ia'), '10000000-0000-4000-8000-000000000004', 'curto'),
  'Escreva o resumo', 'passagem exige resumo');
SELECT pg_temp.falha(format('SELECT public.enviar_passagem(%L, %L, %L)', pg_temp.v('ia'), '10000000-0000-4000-8000-000000000005', 'Paciente estável, aguarda parecer.'),
  'O colega escolhido não está na escala', 'só passa para quem está na escala do setor');
INSERT INTO t SELECT 'pp1', public.enviar_passagem(pg_temp.u('ia'), '10000000-0000-4000-8000-000000000004', 'Paciente estável, aguarda parecer da cirurgia.');
SELECT pg_temp.falha(format('SELECT public.enviar_passagem(%L, %L, %L)', pg_temp.v('ia'), '10000000-0000-4000-8000-000000000004', 'Paciente estável, aguarda parecer.'),
  'Já existe passagem aguardando', 'uma passagem aguardando por paciente');
SELECT pg_temp.falha(format('SELECT public.registrar_checkout(%L)',
  (SELECT id FROM public.presenca_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000002' LIMIT 1)),
  'Check-out bloqueado', 'check-out bloqueado com passagem aguardando aceite');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.responder_passagem(%L, false, %L)', pg_temp.v('pp1'), 'não'),
  'Diga por que recusa', 'recusa exige motivo de 15 letras');
SELECT public.responder_passagem(pg_temp.u('pp1'), false, 'Ainda não cheguei ao plantão, reenvie depois.');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'pp2', public.enviar_passagem(pg_temp.u('ia'), '10000000-0000-4000-8000-000000000004', 'Paciente estável, aguarda parecer da cirurgia.');
SELECT public.retirar_passagem(pg_temp.u('pp2'));
INSERT INTO t SELECT 'pp3', public.enviar_passagem(pg_temp.u('ia'), '10000000-0000-4000-8000-000000000004', 'Paciente estável, aguarda parecer da cirurgia.');
RESET ROLE;
-- o check-out automático espera o aceite
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
UPDATE public.escala_plantao SET inicio = now() - interval '7 hours'
 WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND setor_id = '22000000-0000-4000-8000-000000000002';
SELECT private.fechar_presencas_vencidas();
DO $$ BEGIN
  IF (SELECT checkout_em FROM public.presenca_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000002' LIMIT 1) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: check-out automático com passagem aguardando';
  END IF;
  RAISE NOTICE 'OK  check-out automático também espera o aceite';
  IF (SELECT count(*) FROM public.passagens_plantao WHERE internacao_id = pg_temp.u('ia')) <> 3
     OR (SELECT situacao FROM public.passagens_plantao WHERE id = pg_temp.u('pp1')) <> 'recusada'
     OR (SELECT situacao FROM public.passagens_plantao WHERE id = pg_temp.u('pp2')) <> 'retirada' THEN
    RAISE EXCEPTION 'FALHOU: recusar/retirar/reenviar';
  END IF;
  RAISE NOTICE 'OK  recusar com motivo, retirar e reenviar ficam no histórico';
END $$;
UPDATE public.escala_plantao SET inicio = now() - interval '1 hour'
 WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND setor_id = '22000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

-- ── 3.6 alta com impeditivos ────────────────────────────────────────────────
UPDATE public.internacoes SET data_admissao = now() - interval '5 hours' WHERE id = pg_temp.u('ia');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.dar_alta(%L, %L, %L)', pg_temp.v('ia'), 'alta_melhorada', ''),
  'Informe o CID de alta', 'CID de alta obrigatório');
SELECT pg_temp.falha(format('SELECT public.dar_alta(%L, %L, %L)', pg_temp.v('ia'), 'alta_melhorada', 'R60'),
  'Existe(m) pendência(s) em aberto', 'parecer sem resposta e passagem aguardando impedem a alta');
RESET ROLE;
INSERT INTO public.documentos_clinicos (documento_raiz_id, organizacao_id, unidade_id, paciente_id, internacao_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado)
SELECT gen_random_uuid(), organizacao_id, unidade_id, paciente_id, id, 'sumario_alta', 'rascunho', 'x', '10000000-0000-4000-8000-000000000002', 'rascunho'
  FROM public.internacoes WHERE id = pg_temp.u('ia');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.concluir_pendencia(pg_temp.u('parecer'), 'Cirurgia sem indicação');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.responder_passagem(pg_temp.u('pp3'), true);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.dar_alta(%L, %L, %L)', pg_temp.v('ia'), 'alta_melhorada', 'R60'),
  'Existe(m) pendência(s) em aberto: Documento do PEP aberto', 'documento do PEP aberto impede a alta');
RESET ROLE;
UPDATE public.documentos_clinicos SET estado = 'ativo' WHERE internacao_id = pg_temp.u('ia') AND estado = 'rascunho';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.dar_alta(%L, %L, %L, %L)', pg_temp.v('ia'), 'alta_melhorada', 'R60', now() - interval '2 hours'),
  'Alta retroativa', 'alta retroativa exige justificativa');
SELECT public.registrar_checkout((SELECT id FROM public.presenca_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000002' LIMIT 1));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
-- (a escala segue em curso: o médico continua cuidando do setor)
SELECT public.dar_alta(pg_temp.u('ia'), 'alta_melhorada', 'R60', now() - interval '2 hours', 'Alta dada às 10h, registro atrasado', 'Retorno em 7 dias');
-- pacote de alta
INSERT INTO t SELECT 'pac', public.gerar_pacote_alta(pg_temp.u('ia'), '["Voltar se febre","Beber água"]', 'UBS em 7 dias')::text;
RESET ROLE;
DO $$
DECLARE a public.internacoes;
BEGIN
  SELECT * INTO a FROM public.internacoes WHERE id = pg_temp.u('ia');
  IF a.status <> 'alta_melhorada' OR a.cid_alta <> 'R60' OR a.alta_justificativa_retroativa IS NULL
     OR a.data_alta > now() - interval '119 minutes' THEN
    RAISE EXCEPTION 'FALHOU: alta registrada (%)', a;
  END IF;
  IF (SELECT etapa FROM public.episodios WHERE id = pg_temp.u('ea')) <> 'encerrado'
     OR (SELECT situacao FROM public.pendencias WHERE internacao_id = a.id AND tipo = 'observacao') <> 'concluida'
     OR (SELECT situacao FROM public.pendencias WHERE id = pg_temp.u('exame')) <> 'cancelada'
     OR (SELECT setor_id FROM public.pacientes WHERE id = a.paciente_id) IS NOT NULL
     OR (SELECT status FROM public.leitos l JOIN public.eventos_adt e ON e.leito_origem_id = l.id
          WHERE e.internacao_id = a.id AND e.tipo_evento = 'alta_melhorada') <> 'higienizacao' THEN
    RAISE EXCEPTION 'FALHOU: consequências da alta';
  END IF;
  RAISE NOTICE 'OK  alta retroativa justificada: episódio encerrado, observação resolvida, box em higienização, fora do censo';
END $$;

-- ── pacote de alta: o paciente, sem login ───────────────────────────────────
SET LOCAL ROLE anon;
DO $$
DECLARE tok text := pg_temp.v('pac')::jsonb ->> 'token'; cod text := pg_temp.v('pac')::jsonb ->> 'codigo'; r jsonb;
BEGIN
  IF public.situacao_pacote_alta(tok) ->> 'situacao' <> 'ativo' OR public.situacao_pacote_alta(tok) ? 'primeiro_nome' THEN
    RAISE EXCEPTION 'FALHOU: situação do link sem código';
  END IF;
  r := public.abrir_pacote_alta(tok, '000000');
  IF cod = '000000' THEN r := public.abrir_pacote_alta(tok, '111111'); END IF;
  IF r ->> 'situacao' <> 'codigo_errado' OR (r ->> 'restantes')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: código errado (%)', r; END IF;
  r := public.abrir_pacote_alta(tok, cod);
  IF r ->> 'situacao' <> 'ok' OR r ->> 'primeiro_nome' <> 'Fase' OR r -> 'orientacoes' ->> 0 <> 'Voltar se febre' THEN
    RAISE EXCEPTION 'FALHOU: abrir com o código (%)', r;
  END IF;
  RAISE NOTICE 'OK  pacote abre só com o código; sem código o link não mostra nome';
  PERFORM public.abrir_pacote_alta(tok, CASE WHEN cod = '222222' THEN '333333' ELSE '222222' END) FROM generate_series(1, 3);
  IF public.abrir_pacote_alta(tok, cod) ->> 'situacao' <> 'bloqueado' THEN RAISE EXCEPTION 'FALHOU: três erros bloqueiam'; END IF;
  RAISE NOTICE 'OK  três códigos errados bloqueiam o link';
END $$;
RESET ROLE;

-- ── cancelar alta ───────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.cancelar_alta(%L, %L)', pg_temp.v('ia'), 'engano'),
  'Justifique o cancelamento', 'cancelar alta exige justificativa de 10 letras');
SELECT public.cancelar_alta(pg_temp.u('ia'), 'Paciente voltou a ter febre antes de sair');
RESET ROLE;
DO $$
DECLARE a public.internacoes;
BEGIN
  SELECT * INTO a FROM public.internacoes WHERE id = pg_temp.u('ia');
  IF a.status <> 'em_observacao' OR a.leito_atual_id IS NULL OR a.data_alta IS NOT NULL
     OR (SELECT status FROM public.leitos WHERE id = a.leito_atual_id) <> 'ocupado'
     OR (SELECT etapa FROM public.episodios WHERE id = pg_temp.u('ea')) <> 'observacao'
     OR (SELECT setor_id FROM public.pacientes WHERE id = a.paciente_id) IS NULL THEN
    RAISE EXCEPTION 'FALHOU: cancelar alta (%)', a;
  END IF;
  IF EXISTS (SELECT 1 FROM public.pacotes_alta WHERE internacao_id = a.id AND situacao = 'ativo') THEN
    RAISE EXCEPTION 'FALHOU: pacote segue ativo após cancelar a alta';
  END IF;
  RAISE NOTICE 'OK  cancelar a alta devolve o paciente ao censo e ao box, e revoga o link';
END $$;

-- ── observação → internação resolve a pendência de observação ───────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_evento_adt(pg_temp.u('ib'), 'internacao', '22000000-0000-4000-8000-000000000001',
  (SELECT id FROM public.leitos WHERE setor_id = '22000000-0000-4000-8000-000000000001' AND status = 'livre' ORDER BY identificador LIMIT 1));
RESET ROLE;
DO $$ BEGIN
  IF (SELECT situacao FROM public.pendencias WHERE internacao_id = pg_temp.u('ib') AND tipo = 'observacao') <> 'concluida'
     OR (SELECT etapa FROM public.episodios WHERE id = pg_temp.u('eb')) <> 'internacao'
     OR (SELECT status FROM public.leitos WHERE setor_id = '22000000-0000-4000-8000-000000000002' AND identificador = 'Box 2') <> 'higienizacao'
     OR (SELECT setor_id FROM public.leitos WHERE id = (SELECT leito_atual_id FROM public.internacoes WHERE id = pg_temp.u('ib'))) <> '22000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'FALHOU: converter observação em internação';
  END IF;
  RAISE NOTICE 'OK  converter em internação resolve a observação, libera o box e leva o episódio junto';
END $$;
-- a equipe não lê o token nem o hash do código do pacote
DO $x$ BEGIN
  IF has_column_privilege('authenticated', 'public.pacotes_alta', 'token', 'SELECT')
     OR has_column_privilege('authenticated', 'public.pacotes_alta', 'codigo_hash', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: token/código do pacote legível pela equipe';
  END IF;
  RAISE NOTICE 'OK  token e hash do código do pacote não saem para a equipe';
END $x$;
ROLLBACK;
