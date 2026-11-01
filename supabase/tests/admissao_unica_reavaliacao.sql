-- Testes da migration 20270203000005_admissao_unica_reavaliacao.sql (ponto 10
-- do plantonista): uma admissão por internação, com trava no banco; corrigir a
-- admissão leva a ficha junto (e a anterior fica guardada); a correção pelo
-- caminho de texto sem a ficha é recusada; a reavaliação do quadro é do médico,
-- precisa de tudo preenchido e fica ligada à admissão. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
-- médico (…0002) e enfermeira (…0004) de plantão na Observação; recepção (…0005) no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
-- os detalhes da admissão não são obrigatórios no setor do teste
DELETE FROM public.admissao_detalhes_obrigatorio WHERE setor_id = '22000000-0000-4000-8000-000000000002';

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
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
CREATE FUNCTION pg_temp.ficha(p text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('subjetivo', 'Dor torácica há 2 horas ' || p, 'objetivo', 'Bom estado geral, corado ' || p,
    'cid', 'J18.9 — Pneumonia não especificada', 'plano', 'Antibiótico e reavaliação ' || p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.ficha(text) TO authenticated;

-- paciente cadastrado no PS e internado na Observação
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Paciente Da Admissao","data_nascimento":"1970-04-04"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, episodio_id, setor_atual_id, status)
SELECT u.organizacao_id, u.id, pg_temp.u('pac'), pg_temp.u('ep'), '22000000-0000-4000-8000-000000000002', 'internado'
  FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO t SELECT 'int', id::text FROM public.internacoes WHERE paciente_id = pg_temp.u('pac') AND data_alta IS NULL;

-- a reavaliação precisa da admissão antes
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format($q$SELECT public.registrar_reavaliacao_quadro(%L, 'Reavaliação do quadro de teste', '{"motivo":"x","subjetivo":"x","objetivo":"x","cid":"x","plano":"x"}')$q$, pg_temp.u('int')),
  'Registre a admissão antes', 'reavaliação sem admissão é recusada');

-- o médico registra a admissão; a segunda é recusada
INSERT INTO t SELECT 'adm1', public.registrar_admissao(pg_temp.u('int'), 'ADMISSÃO — texto legível da primeira versão', pg_temp.ficha('v1'))::text;
SELECT pg_temp.falha(format($q$SELECT public.registrar_admissao(%L, 'ADMISSÃO — de novo, segunda', %L)$q$, pg_temp.u('int'), pg_temp.ficha('v2')),
  'A admissão desta internação já foi registrada', 'segunda admissão pela função é recusada');
RESET ROLE;

-- trava no banco: nem por fora da função entra a segunda admissão (versão 1) ou ficha repetida
SELECT pg_temp.falha(format($q$INSERT INTO public.documentos_clinicos (documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id,
    internacao_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado)
  SELECT gen_random_uuid(), 1, organizacao_id, unidade_id, paciente_id, internacao_id, 'admissao_anamnese', 'duplicada', 'x', autor_id, 'ativo'
    FROM public.documentos_clinicos WHERE id = %L$q$, pg_temp.u('adm1')),
  'duplicate key value violates unique constraint "uq_admissao_por_internacao"', 'segunda admissão por fora da função é barrada pelo índice');
SELECT pg_temp.falha(format($q$INSERT INTO public.admissao_fichas (documento_id, documento_raiz_id, internacao_id, unidade_id, paciente_id, autor_id, dados)
  SELECT id, id, internacao_id, unidade_id, paciente_id, autor_id, '{}' FROM public.documentos_clinicos WHERE id = %L$q$, pg_temp.u('adm1')),
  'duplicate key value', 'ficha repetida da mesma admissão é barrada');

-- corrigir só o texto (corrigir_evolucao), sem a ficha, é recusado no fim da transação
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
BEGIN
  BEGIN
    PERFORM public.corrigir_evolucao(pg_temp.u('adm1'), 'ADMISSÃO — texto mudado sem a ficha', 'Corrigindo sem a ficha de propósito');
    SET CONSTRAINTS trg_admissao_corrigida_com_ficha IMMEDIATE;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Corrija a admissão pela aba Admissão%' THEN RAISE EXCEPTION 'FALHOU: erro inesperado: %', SQLERRM; END IF;
    RAISE NOTICE 'OK  correção do texto sem a ficha é recusada'; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: correção do texto sem a ficha passou';
END $$;

-- corrigir_admissao: justificativa curta e quem não é o autor são recusados
SELECT pg_temp.falha(format($q$SELECT public.corrigir_admissao(%L, 'ADMISSÃO — texto corrigido', %L, 'curta')$q$, pg_temp.u('adm1'), pg_temp.ficha('v2')),
  'Justifique a correção', 'correção sem justificativa é recusada');
SELECT pg_temp.falha(format($q$SELECT public.corrigir_admissao(%L, 'ADMISSÃO — texto corrigido', %L, 'Hipótese errada na primeira')$q$, pg_temp.u('adm1'), '{"subjetivo":"só isto"}'),
  'Falta para registrar a admissão', 'ficha incompleta na correção é recusada');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format($q$SELECT public.corrigir_admissao(%L, 'ADMISSÃO — texto corrigido', %L, 'Hipótese errada na primeira')$q$, pg_temp.u('adm1'), pg_temp.ficha('v2')),
  'Só o autor corrige', 'quem não é o autor não corrige a admissão');

-- o autor corrige: texto novo e ficha nova vigente; a anterior fica guardada
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'adm2', public.corrigir_admissao(pg_temp.u('adm1'), 'ADMISSÃO — texto legível corrigido', pg_temp.ficha('v2'), 'Hipótese errada na primeira')::text;
SET CONSTRAINTS trg_admissao_corrigida_com_ficha IMMEDIATE;
SELECT pg_temp.falha(format($q$SELECT public.corrigir_admissao(%L, 'ADMISSÃO — de novo pela antiga', %L, 'Corrigindo a versão antiga')$q$, pg_temp.u('adm1'), pg_temp.ficha('v3')),
  'Corrija a versão mais recente', 'a versão antiga não se corrige');
RESET ROLE;
SET CONSTRAINTS trg_admissao_corrigida_com_ficha DEFERRED;
DO $$
DECLARE v text;
BEGIN
  IF (SELECT estado FROM public.documentos_clinicos WHERE id = pg_temp.u('adm1')) <> 'retificado'
     OR (SELECT estado || ':' || versao FROM public.documentos_clinicos WHERE id = pg_temp.u('adm2')) <> 'ativo:2' THEN
    RAISE EXCEPTION 'FALHOU: versões do documento da admissão';
  END IF;
  SELECT string_agg(CASE WHEN documento_id = pg_temp.u('adm1') THEN 'v1' ELSE 'v2' END || ':' || vigente || ':' || (dados ->> 'plano') || ':' || coalesce(justificativa, '-'),
                    ' | ' ORDER BY criado_em, vigente) INTO v
    FROM public.admissao_fichas WHERE internacao_id = pg_temp.u('int');
  IF v <> 'v1:false:Antibiótico e reavaliação v1:- | v2:true:Antibiótico e reavaliação v2:Hipótese errada na primeira' THEN
    RAISE EXCEPTION 'FALHOU: fichas depois da correção — %', v;
  END IF;
  IF (SELECT documento_raiz_id FROM public.admissao_fichas WHERE documento_id = pg_temp.u('adm2')) <> pg_temp.u('adm1') THEN
    RAISE EXCEPTION 'FALHOU: ficha nova fora da raiz da admissão';
  END IF;
  RAISE NOTICE 'OK  correção grava a ficha nova como vigente e guarda a anterior na versão antiga';
END $$;

-- reavaliação do quadro: a enfermagem não registra; faltando campo, recusa; o médico registra
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format($q$SELECT public.registrar_reavaliacao_quadro(%L, 'Reavaliação do quadro de teste', '{"motivo":"x","subjetivo":"x","objetivo":"x","cid":"x","plano":"x"}')$q$, pg_temp.u('int')),
  'Acesso negado', 'enfermagem não registra reavaliação do quadro');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format($q$SELECT public.registrar_reavaliacao_quadro(%L, 'Reavaliação do quadro de teste', '{"motivo":"Evoluiu com AVC","subjetivo":"Hemiparesia"}')$q$, pg_temp.u('int')),
  'Falta para registrar a reavaliação: Exame, Hipótese diagnóstica, Plano', 'reavaliação incompleta é recusada');
INSERT INTO t SELECT 'rq', public.registrar_reavaliacao_quadro(pg_temp.u('int'), 'REAVALIAÇÃO DO QUADRO — evoluiu com AVC isquêmico',
  '{"motivo":"Evoluiu com AVC","subjetivo":"Hemiparesia à direita desde 10h","objetivo":"Força grau 3 em MSD","cid":"I63.9 — Infarto cerebral não especificado","plano":"Tomografia e protocolo de AVC"}')::text;
RESET ROLE;
DO $$
DECLARE d public.documentos_clinicos; r public.reavaliacoes_quadro;
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = pg_temp.u('rq');
  SELECT * INTO r FROM public.reavaliacoes_quadro WHERE documento_id = pg_temp.u('rq');
  IF d.tipo_documento <> 'reavaliacao_quadro' OR d.numero IS NULL OR d.estado <> 'ativo' OR d.internacao_id <> pg_temp.u('int') THEN
    RAISE EXCEPTION 'FALHOU: documento da reavaliação — % % %', d.tipo_documento, d.numero, d.estado;
  END IF;
  IF r.admissao_raiz_id <> pg_temp.u('adm1') OR r.dados ->> 'cid' NOT LIKE 'I63.9%' OR r.autor_id <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: reavaliação fora da admissão';
  END IF;
  IF (SELECT estado FROM public.documentos_clinicos WHERE id = pg_temp.u('adm2')) <> 'ativo' THEN
    RAISE EXCEPTION 'FALHOU: a reavaliação mexeu na admissão';
  END IF;
  RAISE NOTICE 'OK  reavaliação numerada, ligada à admissão, e a admissão não muda';
END $$;
ROLLBACK;
