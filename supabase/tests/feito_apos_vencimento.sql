-- Testes da migration 20270402000001_feito_apos_vencimento.sql (RT, 10/11/2026:
-- "Sim, até 2 h"): o "feito" de um horário aprazado ANTERIOR ao vencimento é
-- aceito até 2 h depois do vencimento; fora disso a regra da lacuna 6 segue.
-- A montagem é a mesma de prescricao_vencida.sql (cabeçalho original abaixo).
-- ROLLBACK no fim.
-- Testes da migration 20270327000001_prescricao_vencida.sql (lacuna 6 do
-- Portão de 11/10/2026; decisão do RT em 10/11/2026: A em V1 a V9).
--  V1. validade gravada na inserção (24 h), só pelo servidor; transição:
--      item ativo sem validade ganha 24 h a partir de agora, a contenção fica
--      com criação + 24 h, e rodar de novo não estende nada;
--  V2. vencido: checar recusa o "feito" (aceita antes; "não feito" segue),
--      dispensar_item recusa, o aprazamento não gera horário depois do
--      vencimento; filas e listas trazem a validade;
--  V3. pedir_renovacao: só enfermagem, a 2 h do fim ou vencido; avisa o
--      médico uma vez;
--  V4/V5. renovar_prescricao: manter (versão nova pelo login de quem renova,
--      horários e validação da farmácia mantidos, anterior "Renovada"),
--      alterar, suspender, tudo numa transação; só o médico;
--  V6. job: um aviso por item e por janela (2 h antes e no vencimento);
--  V7. "Agora" não vence; "Se necessário" e cuidado vencem; contenção fora do
--      job, da renovação e do pedido;
--  V8. item da porta entra na renovação na internação e a versão nova vai
--      para a prescrição do leito;
--  privilégios e auditoria sem dado de pessoa.
-- Farmacêutico: perfil …0006 vinculado aqui (o seed não tem), como em
-- controlados.sql. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE FUNCTION pg_temp.pesar() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
  SELECT p.unidade_id, p.id, c.id, now(), 70, 'manual'
    FROM public.pacientes p JOIN public.conceito c ON c.nome = 'peso' AND c.unidade_id IS NULL
   WHERE private.peso_do_atendimento(p.id) IS NULL $$;
GRANT EXECUTE ON FUNCTION pg_temp.pesar() TO authenticated;
-- médico, enfermeira e recepção no PS e na Clínica Médica
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001'::uuid, s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004']::uuid[]) p,
       unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000001']::uuid[]) s
UNION ALL
SELECT '21000000-0000-4000-8000-000000000001'::uuid, '22000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000005'::uuid,
       private.data_atual(), 'manha', now() - interval '1 hour', 360;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.j(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.j(text) TO authenticated;
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
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated, anon;
-- item lido como superusuário
CREATE FUNCTION pg_temp.it(p text) RETURNS public.prescricao_itens LANGUAGE sql AS $$
  SELECT * FROM public.prescricao_itens WHERE id = pg_temp.u(p) $$;
CREATE FUNCTION pg_temp.avisos(p_tipo text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.notificacoes_plantonista WHERE tipo LIKE p_tipo $$;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

-- medicamentos do teste
WITH novos AS (
  INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, fonte) VALUES
    ('Dipirona validade', 'dipirona validade', 'ampola 2 mL (teste validade)', '500 mg/mL', 'teste-validade'),
    ('Ondansetrona validade', 'ondansetrona validade', 'ampola 2 mL (teste validade)', '2 mg/mL', 'teste-validade'),
    ('Paracetamol validade', 'paracetamol validade', 'comprimido (teste validade)', '500 mg', 'teste-validade'),
    ('Omeprazol validade', 'omeprazol validade', 'cápsula (teste validade)', '20 mg', 'teste-validade')
  RETURNING id, principio_ativo_norm)
INSERT INTO t SELECT split_part(principio_ativo_norm, ' ', 1), id::text FROM novos;

-- ── paciente na porta, com o atendimento aberto ──────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor abdominal', NULL,
  json_build_object('nome', 'Paciente Validade', 'data_nascimento', (current_date - interval '40 years')::date)::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":98,"frequencia-respiratoria":18,"temperatura":36.8,"saturacao-o2":97,"escala-dor":6,"pressao-arterial-sistolica":132,"pressao-arterial-diastolica":84}',
  pg_temp.u('flx'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep')),
       public.registrar_soap(pg_temp.u('ep'), 'Dor abdominal', 'Dor difusa', 'Dor abdominal a esclarecer', 'Analgesia e observação', 'R10.4');
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.pesar();
INSERT INTO t SELECT 'i_dip', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('dipirona'),
  'dose', '1 g', 'via', 'EV', 'posologia', '6/6h')::jsonb);
INSERT INTO t SELECT 'i_agora', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('ondansetrona'),
  'dose', '4 mg', 'via', 'EV', 'posologia', 'Agora')::jsonb);
INSERT INTO t SELECT 'i_sn', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('paracetamol'),
  'dose', '750 mg', 'via', 'VO', 'posologia', 'Se necessário', 'se_necessario', true)::jsonb);
INSERT INTO t SELECT 'i_ome', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('omeprazol'),
  'dose', '20 mg', 'via', 'VO', 'posologia', '24/24h')::jsonb);
INSERT INTO t SELECT 'i_cui', public.prescrever(pg_temp.u('pac'), '{"tipo":"cuidado","descricao":"Cabeceira elevada"}');
INSERT INTO t SELECT 'i_cont', public.prescrever(pg_temp.u('pac'),
  '{"tipo":"contencao","pontos":2,"periodo_h":4,"motivo":"Agitação com risco de queda do leito","criterios_retirada":"Paciente calmo e colaborativo por 30 min"}');
RESET ROLE;

-- ── exceção das 2 h ──────────────────────────────────────────────────────────
-- horário aprazado 1 h atrás; o item venceu há 30 min (depois do horário)
CREATE TEMP TABLE hh AS SELECT
  to_char((now() - interval '1 hour') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS antes,
  to_char((now() - interval '10 minutes') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS depois;
GRANT SELECT ON hh TO authenticated;
UPDATE public.prescricao_itens
   SET horarios = ARRAY[(SELECT antes FROM hh), (SELECT depois FROM hh)],
       created_at = now() - interval '23 hours', valida_ate = now() - interval '30 minutes'
 WHERE id = pg_temp.u('i_dip');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'adm_antes', public.checar(pg_temp.u('i_dip'), 'feito', (SELECT antes FROM hh), NULL, 'intercorrencia')::text;
-- o horário de 10 min atrás já é depois do vencimento: recusado
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, %L, NULL, %L)', pg_temp.u('i_dip'), 'feito', (SELECT depois FROM hh), 'intercorrencia'),
  'Prescrição vencida às', 'horário depois do vencimento: recusado');
RESET ROLE;
SELECT pg_temp.ok(pg_temp.u('adm_antes') IS NOT NULL
  AND (SELECT situacao FROM public.administracoes WHERE id = pg_temp.u('adm_antes')) = 'feito',
  'dose de horário anterior ao vencimento, registrada 30 min depois: aceita');

-- vencido há 3 h: passou das 2 h, recusado mesmo com horário anterior
UPDATE public.prescricao_itens SET valida_ate = now() - interval '3 hours',
       horarios = ARRAY[to_char((now() - interval '4 hours') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')]
 WHERE id = pg_temp.u('i_ome');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, %L, NULL, %L)', pg_temp.u('i_ome'), 'feito',
  to_char((now() - interval '4 hours') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), 'intercorrencia'),
  'Prescrição vencida às', 'mais de 2 h depois do vencimento: recusado');
RESET ROLE;

-- "Se necessário" (sem horário) vencido: sem exceção
UPDATE public.prescricao_itens SET valida_ate = now() - interval '10 minutes' WHERE id = pg_temp.u('i_sn');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('i_sn'), 'feito'),
  'Prescrição vencida às', '"Se necessário" vencido: recusado');
RESET ROLE;
ROLLBACK;
