-- Testes da migration 20261203000001_conta_pre_auditoria.sql (Fase 5B, tarefa 5):
-- quem bloqueia e quem só avisa; CID da porta e CNES; agrupamento e contagem;
-- trava do fechamento, liberação do gestor, lista guardada no fechamento e
-- resumo na lista de contas. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000001', 'faturamento') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento_cid (procedimento, cid, principal, competencia) VALUES
  ('0303140151', 'J18.9', true, to_char(now(), 'YYYYMM')) ON CONFLICT DO NOTHING;
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-0000000d5201', '21000000-0000-4000-8000-000000000001', 'Paciente Auditoria', '1980-02-02', 'PA-1',
   '22000000-0000-4000-8000-000000000003', 'F');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, atendimento_medico_id, atendimento_iniciado_em)
VALUES ('25000000-0000-4000-8000-0000000d5201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d5201',
        '22000000-0000-4000-8000-000000000003', 'atendimento', 'Tosse', '10000000-0000-4000-8000-000000000004', now() - interval '3 hours',
        '10000000-0000-4000-8000-000000000002', now() - interval '150 minutes');

CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT v::uuid FROM t WHERE k = p $$;
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
INSERT INTO t SELECT 'porta', id::text FROM public.contas WHERE episodio_id = '25000000-0000-4000-8000-0000000d5201';

-- 2a/5a. regras, com partes montadas à mão
DO $$
DECLARE c public.contas; p jsonb; i jsonb;
  itens jsonb := jsonb_build_array(
    -- linha do BPA fora do arquivo: crítica bloqueia
    jsonb_build_object('origem', 'atendimento', 'procedimento', '0303140151', 'cid', 'J189', 'destino', 'fora',
      'criticas', jsonb_build_array(jsonb_build_object('codigo', 'sem_codigo', 'texto', 'Sem código.'),
                                    jsonb_build_object('codigo', 'raca', 'texto', 'Raça/cor obrigatória.')),
      'avisos', jsonb_build_array(jsonb_build_object('codigo', 'documento', 'texto', 'Paciente sem CNS nem CPF.'))),
    -- linha que vai no BPA-C: a mesma crítica só avisa; conta duas vezes
    jsonb_build_object('origem', 'registro', 'procedimento', '0303140151', 'cid', 'A00.9', 'destino', 'bpa_c',
      'criticas', jsonb_build_array(jsonb_build_object('codigo', 'cbo', 'texto', 'Profissional sem CBO no perfil.')), 'avisos', '[]'::jsonb),
    jsonb_build_object('origem', 'medicacao', 'procedimento', NULL, 'destino', 'bpa_c',
      'criticas', jsonb_build_array(jsonb_build_object('codigo', 'cbo', 'texto', 'Profissional sem CBO no perfil.')), 'avisos', '[]'::jsonb),
    -- atendimento sem CID para procedimento que exige
    jsonb_build_object('origem', 'atendimento', 'procedimento', '0303140151', 'cid', NULL, 'destino', 'bpa_i', 'criticas', '[]'::jsonb, 'avisos', '[]'::jsonb));
  meds jsonb := jsonb_build_array(
    jsonb_build_object('medicamento', 'Dipirona', 'aviso', 'Administrado sem nada dispensado pela farmácia.', 'fora_da_conta', false),
    jsonb_build_object('medicamento', 'Ondansetrona', 'aviso', 'Dispensado e nunca administrado.', 'fora_da_conta', true));
  docs jsonb := jsonb_build_object('avisos', jsonb_build_array('AIH ainda não aprovada pelo regulador.', 'APAC ainda não autorizada.'));
BEGIN
  SELECT * INTO c FROM public.contas WHERE id = pg_temp.u('porta');
  p := private.conta_pendencias(c, itens, meds, docs);
  -- sem_codigo e raca da linha "fora" bloqueiam; cbo da linha do BPA-C só avisa (2 vezes)
  SELECT x INTO i FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'sem_codigo';
  IF NOT (i ->> 'bloqueante')::boolean OR i ->> 'grupo' <> 'procedimento' THEN RAISE EXCEPTION 'FALHOU: sem_codigo: %', i; END IF;
  SELECT x INTO i FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'raca';
  IF NOT (i ->> 'bloqueante')::boolean OR i ->> 'grupo' <> 'paciente' THEN RAISE EXCEPTION 'FALHOU: raca: %', i; END IF;
  SELECT x INTO i FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'cbo';
  IF (i ->> 'bloqueante')::boolean OR i ->> 'grupo' <> 'profissional' OR (i ->> 'vezes')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: cbo: %', i; END IF;
  SELECT x INTO i FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'documento';
  IF (i ->> 'bloqueante')::boolean THEN RAISE EXCEPTION 'FALHOU: aviso do BPA bloqueou: %', i; END IF;
  RAISE NOTICE 'OK  2a: BPA — crítica da linha fora do arquivo bloqueia; a que vai no BPA-C e o aviso só avisam; repetida conta as vezes';
  -- 5a. CID: compatível passa; incompatível e ausente bloqueiam
  IF (SELECT count(*) FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'cid_exigido' AND (x ->> 'bloqueante')::boolean) <> 1
     OR (SELECT count(*) FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'cid_procedimento' AND x ->> 'texto' LIKE '%A00.9%') <> 1
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p) x WHERE x ->> 'texto' LIKE '%J18.9%') THEN
    RAISE EXCEPTION 'FALHOU: CID da porta: %', p;
  END IF;
  -- 5a. CNES: a unidade de teste não tem
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'cnes' AND (x ->> 'bloqueante')::boolean AND x ->> 'grupo' = 'unidade') THEN
    RAISE EXCEPTION 'FALHOU: CNES';
  END IF;
  RAISE NOTICE 'OK  5a: CID exigido pelo procedimento (ausente ou incompatível) e CNES da unidade bloqueiam';
  -- AIH bloqueia, APAC e medicamento avisam; medicamento fora da conta não entra
  IF NOT (SELECT (x ->> 'bloqueante')::boolean FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'aih')
     OR (SELECT (x ->> 'bloqueante')::boolean FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'apac')
     OR (SELECT count(*) FROM jsonb_array_elements(p) x WHERE x ->> 'grupo' = 'medicamento' AND NOT (x ->> 'bloqueante')::boolean) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: documentos e medicamentos: %', p;
  END IF;
  RAISE NOTICE 'OK  2a: falta de AIH aprovada bloqueia; APAC e medicamento só avisam';
  -- bloqueantes primeiro
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p) WITH ORDINALITY a(x, n), jsonb_array_elements(p) WITH ORDINALITY b(y, m)
              WHERE n < m AND NOT (x ->> 'bloqueante')::boolean AND (y ->> 'bloqueante')::boolean) THEN
    RAISE EXCEPTION 'FALHOU: ordem';
  END IF;
  -- AIH e lançamento: bloqueante pelo catálogo e pela configuração da unidade
  p := private.conta_pendencias(c, jsonb_build_array(
         jsonb_build_object('origem', 'aih', 'criticas', jsonb_build_array(
           jsonb_build_object('codigo', 'cid_principal', 'texto', 'CID principal ausente.', 'bloqueante', true),
           jsonb_build_object('codigo', 'cbo', 'texto', 'Médico sem CBO.', 'bloqueante', false))),
         jsonb_build_object('origem', 'lancamento', 'criticas', jsonb_build_array(
           jsonb_build_object('codigo', 'sexo', 'texto', 'Procedimento só para o sexo M.'),
           jsonb_build_object('codigo', 'instrumento', 'texto', 'Não é especial da AIH.')))), '[]', '{}');
  IF NOT (SELECT (x ->> 'bloqueante')::boolean FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'cid_principal')
     OR (SELECT (x ->> 'bloqueante')::boolean FROM jsonb_array_elements(p) x WHERE x ->> 'texto' = 'Médico sem CBO.')
     OR NOT (SELECT (x ->> 'bloqueante')::boolean AND x ->> 'grupo' = 'procedimento' FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'sexo')
     OR (SELECT (x ->> 'bloqueante')::boolean FROM jsonb_array_elements(p) x WHERE x ->> 'codigo' = 'instrumento') THEN
    RAISE EXCEPTION 'FALHOU: AIH e lançamento: %', p;
  END IF;
  RAISE NOTICE 'OK  2a: AIH e lançamento seguem a crítica bloqueante do catálogo e da unidade';
END $$;

-- 1a/3a. a conta real (unidade sem CNES, sem códigos do BPA) trava; só o gestor libera
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  IF (public.conta_detalhe(pg_temp.u('porta')) ->> 'bloqueantes_sem_liberacao')::int = 0 THEN RAISE EXCEPTION 'FALHOU: conta sem bloqueante'; END IF;
  RAISE NOTICE 'OK  4a: detalhe mostra as pendências da conta aberta';
END $$;
SELECT pg_temp.falha(format('SELECT public.liberar_fechamento_conta(%L, %L)', pg_temp.u('porta'), 'liberação antes da conferência'),
  'Acesso negado', 'faturamento não libera');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.liberar_fechamento_conta(%L, %L)', pg_temp.u('porta'), 'liberação antes da conferência'),
  'A liberação é para conta em conferência', 'liberação só em conferência');
RESET ROLE;
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'alta', desfecho_em = now() - interval '1 hour',
       desfecho_por = '10000000-0000-4000-8000-000000000002', encerrado_em = now() - interval '1 hour'
 WHERE id = '25000000-0000-4000-8000-0000000d5201';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('porta'), 'em_conferencia');
SELECT pg_temp.falha(format('SELECT public.mudar_etapa_conta(%L, %L)', pg_temp.u('porta'), 'fechada'),
  'A conta tem', '1a: pendência bloqueante trava o fechamento');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.liberar_fechamento_conta(%L, %L)', pg_temp.u('porta'), 'curta'),
  'Escreva a justificativa', 'liberação pede justificativa');
SELECT public.liberar_fechamento_conta(pg_temp.u('porta'), 'unidade em credenciamento; CNES sai na semana que vem');
DO $$
DECLARE d jsonb := public.conta_detalhe(pg_temp.u('porta'));
BEGIN
  IF (d ->> 'bloqueantes_sem_liberacao')::int <> 0 OR d -> 'liberacao' ->> 'motivo' NOT LIKE 'unidade em credenciamento%'
     OR jsonb_array_length(d -> 'liberacao' -> 'pendencias') = 0 THEN
    RAISE EXCEPTION 'FALHOU: liberação: %', d -> 'liberacao';
  END IF;
  RAISE NOTICE 'OK  3a: gestor libera com justificativa; cobre os bloqueantes do momento';
END $$;
RESET ROLE;
-- aparece bloqueante que a liberação não cobre: trava de novo
UPDATE public.contas SET liberacao_pendencias = liberacao_pendencias - 0 WHERE id = pg_temp.u('porta');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.mudar_etapa_conta(%L, %L)', pg_temp.u('porta'), 'fechada'),
  'A conta tem 1 pendência', '3a: bloqueante novo, fora da liberação, trava de novo');
-- voltar a aberta desfaz a liberação
SELECT public.mudar_etapa_conta(pg_temp.u('porta'), 'aberta', 'faltou conferir a medicação');
DO $$ BEGIN
  IF public.conta_detalhe(pg_temp.u('porta')) -> 'liberacao' <> 'null'::jsonb THEN RAISE EXCEPTION 'FALHOU: liberação ficou ao voltar a aberta'; END IF;
  RAISE NOTICE 'OK  3a: voltar a aberta desfaz a liberação';
END $$;
SELECT public.mudar_etapa_conta(pg_temp.u('porta'), 'em_conferencia');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.liberar_fechamento_conta(pg_temp.u('porta'), 'unidade em credenciamento; CNES sai na semana que vem');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('porta'), 'fechada');
RESET ROLE;
-- 6a. a lista do fechamento fica guardada: corrigir depois não muda a conta fechada
UPDATE public.unidades SET cnes = '1234567' WHERE id = '21000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE d jsonb := public.conta_detalhe(pg_temp.u('porta')); l jsonb; ev jsonb;
BEGIN
  IF NOT (d ->> 'pendencias_registradas')::boolean
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'pendencias') x WHERE x ->> 'codigo' = 'cnes') THEN
    RAISE EXCEPTION 'FALHOU: conta fechada deveria manter as pendências do fechamento';
  END IF;
  SELECT x INTO l FROM jsonb_array_elements(public.contas_da_unidade('21000000-0000-4000-8000-000000000001', 'fechada') -> 'contas') x
   WHERE (x ->> 'id')::uuid = pg_temp.u('porta');
  IF (l -> 'pendencias' ->> 'bloqueantes')::int = 0 THEN RAISE EXCEPTION 'FALHOU: lista da conta fechada: %', l -> 'pendencias'; END IF;
  RAISE NOTICE 'OK  6a/4a: pendências do fechamento guardadas; a lista usa a lista guardada';
END $$;
RESET ROLE;
DO $$
DECLARE ev public.conta_eventos;
BEGIN
  SELECT * INTO ev FROM public.conta_eventos WHERE conta_id = pg_temp.u('porta') AND evento = 'fechada';
  IF jsonb_array_length(ev.detalhes -> 'pendencias') = 0 OR ev.detalhes -> 'liberacao' ->> 'motivo' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: histórico do fechamento: %', ev.detalhes;
  END IF;
  IF (SELECT count(*) FROM public.conta_eventos WHERE conta_id = pg_temp.u('porta') AND evento = 'liberada') <> 2
     OR (SELECT count(*) FROM public.log_auditoria WHERE entidade_id = pg_temp.u('porta') AND acao = 'conta_fechamento_liberado') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: liberações no histórico e na auditoria';
  END IF;
  RAISE NOTICE 'OK  6a: histórico do fechamento leva as pendências e a liberação';
END $$;
-- reabrir limpa o que foi guardado
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.mudar_etapa_conta(pg_temp.u('porta'), 'aberta', 'conferir de novo com o CNES certo');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT pendencias_fechamento IS NOT NULL OR liberada_em IS NOT NULL FROM public.contas WHERE id = pg_temp.u('porta')) THEN
    RAISE EXCEPTION 'FALHOU: reabrir deveria limpar';
  END IF;
  RAISE NOTICE 'OK  reabrir volta a calcular as pendências';
END $$;

-- 4a. resumo na lista bate com o detalhe (conta aberta)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE d jsonb := public.conta_detalhe(pg_temp.u('porta')); l jsonb;
BEGIN
  SELECT x INTO l FROM jsonb_array_elements(public.contas_da_unidade('21000000-0000-4000-8000-000000000001', 'aberta') -> 'contas') x
   WHERE (x ->> 'id')::uuid = pg_temp.u('porta');
  IF (l -> 'pendencias' ->> 'bloqueantes')::int <> (d ->> 'bloqueantes_sem_liberacao')::int
     OR (l -> 'pendencias' ->> 'avisos')::int <> (SELECT count(*) FROM jsonb_array_elements(d -> 'pendencias') x WHERE NOT (x ->> 'bloqueante')::boolean) THEN
    RAISE EXCEPTION 'FALHOU: resumo da lista (%) diferente do detalhe (%)', l -> 'pendencias', d ->> 'bloqueantes_sem_liberacao';
  END IF;
  RAISE NOTICE 'OK  4a: resumo da lista igual ao detalhe';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('authenticated', 'private.conta_pendencias(public.contas, jsonb, jsonb, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.contas_pendencias_resumo(uuid, uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.liberar_fechamento_conta(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: funções expostas';
  END IF;
  RAISE NOTICE 'OK  funções internas fechadas';
END $$;
ROLLBACK;
