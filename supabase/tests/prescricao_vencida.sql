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

-- ── V1/V7: validade gravada na inserção ─────────────────────────────────────
SELECT pg_temp.ok((pg_temp.it('i_dip')).valida_ate = now() + interval '24 hours'
  AND (pg_temp.it('i_cui')).valida_ate = now() + interval '24 hours'
  AND (pg_temp.it('i_cont')).valida_ate = now() + interval '24 hours',
  'medicamento, cuidado e contenção valem 24 h desde a prescrição');
SELECT pg_temp.ok((pg_temp.it('i_sn')).valida_ate = now() + interval '24 hours', '"Se necessário" vence em 24 h (V7)');
SELECT pg_temp.ok((pg_temp.it('i_agora')).valida_ate IS NULL AND private.validade_item((pg_temp.it('i_agora')).valida_ate) = 'sem_prazo',
  '"Agora" (dose única) não vence (V7)');
SELECT pg_temp.ok(private.validade_item(now() + interval '3 hours') = 'em_dia' AND private.validade_item(now() + interval '2 hours') = 'vence_logo'
  AND private.validade_item(now() + interval '1 minute') = 'vence_logo' AND private.validade_item(now()) = 'vencido',
  'estado: em dia, vence logo (2 h antes) e vencido (no minuto do vencimento)');
-- só o servidor grava a validade
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format($q$UPDATE public.prescricao_itens SET valida_ate = now() + interval '10 days' WHERE id = %L$q$, pg_temp.u('i_dip')),
  'A validade do item é do servidor', 'médico não estende a validade direto pela API');
SELECT pg_temp.falha(format($q$UPDATE public.prescricao_itens SET renovacao_pedida_em = now() WHERE id = %L$q$, pg_temp.u('i_dip')),
  'A validade do item é do servidor', 'pedido de renovação não se grava direto');
RESET ROLE;
SELECT pg_temp.ok((pg_temp.it('i_dip')).valida_ate = now() + interval '24 hours', 'a validade continua a do servidor');

-- ── V1: transição ───────────────────────────────────────────────────────────
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.prescricao_itens i JOIN public.prescricoes p ON p.id = i.prescricao_id
                               WHERE p.status = 'ativa' AND i.suspenso_em IS NULL AND i.valida_ate IS NULL
                                 AND NOT private.item_e_agora(i.posologia)),
  'a migration deu validade a todo item ativo que já estava na base (exceto o "Agora")');
UPDATE public.prescricao_itens SET valida_ate = NULL WHERE id IN (pg_temp.u('i_cui'), pg_temp.u('i_cont'));
UPDATE public.prescricao_itens SET created_at = now() - interval '5 hours' WHERE id IN (pg_temp.u('i_cui'), pg_temp.u('i_cont'));
INSERT INTO t SELECT 'trans1', private.prescricao_validade_transicao()::text;
SELECT pg_temp.ok((pg_temp.it('i_cui')).valida_ate = now() + interval '24 hours'
  AND (pg_temp.it('i_cont')).valida_ate = now() + interval '19 hours'
  AND (pg_temp.it('i_agora')).valida_ate IS NULL AND (SELECT valor::int FROM t WHERE nome = 'trans1') = 2,
  'transição: item ativo ganha 24 h a partir de agora; a contenção fica com criação + 24 h; "Agora" continua sem prazo');
UPDATE public.prescricao_itens SET valida_ate = now() + interval '3 hours' WHERE id = pg_temp.u('i_cui');
SELECT pg_temp.ok(private.prescricao_validade_transicao() = 0 AND (pg_temp.it('i_cui')).valida_ate = now() + interval '3 hours',
  'transição de novo não estende nada');
UPDATE public.prescricao_itens SET created_at = now(), valida_ate = now() + interval '24 hours' WHERE id IN (pg_temp.u('i_cui'), pg_temp.u('i_cont'));

-- ── V2: checagem antes e depois do vencimento ──────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'adm_sn', public.checar(pg_temp.u('i_sn'), 'feito')::text;
INSERT INTO t SELECT 'adm_agora', public.checar(pg_temp.u('i_agora'), 'feito')::text;
RESET ROLE;
SELECT pg_temp.ok(pg_temp.u('adm_sn') IS NOT NULL AND pg_temp.u('adm_agora') IS NOT NULL, 'antes do vencimento a enfermagem checa como feito');
UPDATE public.prescricao_itens SET valida_ate = now() - interval '1 minute' WHERE id = pg_temp.u('i_sn');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('i_sn'), 'feito'),
  'Prescrição vencida às', 'item vencido: o "feito" é recusado (COFEN 689/2022)');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, NULL, %L)', pg_temp.u('i_sn'), 'feito', 'Justificativa longa de urgência'),
  'Prescrição vencida às', 'nem com justificativa');
INSERT INTO t SELECT 'adm_nf', public.checar(pg_temp.u('i_sn'), 'nao_feito', NULL, 'Prescrição vencida, renovação pedida')::text;
RESET ROLE;
SELECT pg_temp.ok((SELECT situacao = 'nao_feito' FROM public.administracoes WHERE id = pg_temp.u('adm_nf')),
  '"não feito" segue registrável no item vencido');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = 'public.checar(uuid, text, text, text, text, text)'::regprocedure
                            AND pg_get_functiondef(p.oid) LIKE '%COFEN 689/2022%'), 'a mensagem cita a Resolução COFEN 689/2022');

-- ── V2: dispensação ────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.validar_item(pg_temp.u('i_dip'), true);
INSERT INTO t SELECT 'disp1', public.dispensar_item(pg_temp.u('i_dip'), 1) ->> 'id';
RESET ROLE;
SELECT pg_temp.ok(pg_temp.u('disp1') IS NOT NULL, 'antes do vencimento a farmácia dispensa');
UPDATE public.prescricao_itens SET valida_ate = now() - interval '1 minute' WHERE id = pg_temp.u('i_dip');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.dispensar_item(%L, 1)', pg_temp.u('i_dip')),
  'Prescrição vencida às', 'item vencido não se dispensa');
INSERT INTO t SELECT 'fv', (SELECT jsonb_agg(to_jsonb(f)) FROM public.fila_validacao('21000000-0000-4000-8000-000000000001') f
                             WHERE f.item_id IN (pg_temp.u('i_ome'), pg_temp.u('i_cui')))::text;
RESET ROLE;
SELECT pg_temp.ok(jsonb_array_length(pg_temp.j('fv')) = 1 AND pg_temp.j('fv') -> 0 ->> 'validade' = 'em_dia'
  AND (pg_temp.j('fv') -> 0 ->> 'valida_ate')::timestamptz = now() + interval '24 hours',
  'fila_validacao traz a validade (só medicamento, como antes)');

-- ── V2: aprazamento para no vencimento ─────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.aprazar(pg_temp.u('i_ome'), ARRAY['00:00', '06:00', '12:00', '18:00']);
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM private.doses_do_item(pg_temp.u('i_ome')) d WHERE d.previsto_em >= now() + interval '7 hours'),
  'com 24 h de validade há horário depois de 7 h');
UPDATE public.prescricao_itens SET valida_ate = now() + interval '7 hours' WHERE id = pg_temp.u('i_ome');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM private.doses_do_item(pg_temp.u('i_ome')) d WHERE d.previsto_em >= now() + interval '7 hours')
  AND EXISTS (SELECT 1 FROM private.doses_do_item(pg_temp.u('i_ome')) d WHERE d.previsto_em > now()),
  'vencendo em 7 h: nenhum horário a partir do vencimento; os de antes continuam');

-- ── V2/V6: as listas trazem a validade ─────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'fc', (SELECT jsonb_object_agg(f.item_id, jsonb_build_object('validade', f.validade, 'valida_ate', f.valida_ate))
                              FROM public.fila_checagem() f WHERE f.paciente_id = pg_temp.u('pac'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'pv', (SELECT jsonb_object_agg(v.id, v.validade) FROM public.prescricao_vigente(pg_temp.u('pac')) v)::text;
INSERT INTO t SELECT 'painel', public.painel_atendimento_ps(pg_temp.u('ep'))::text;
RESET ROLE;
SELECT pg_temp.ok(pg_temp.j('fc') -> pg_temp.u('i_dip')::text ->> 'validade' = 'vencido'
  AND pg_temp.j('fc') -> pg_temp.u('i_agora')::text ->> 'validade' = 'sem_prazo'
  AND pg_temp.j('fc') -> pg_temp.u('i_cui')::text ->> 'validade' = 'em_dia',
  'fila_checagem traz validade e estado de cada item');
SELECT pg_temp.ok(pg_temp.j('pv') ->> pg_temp.u('i_dip')::text = 'vencido' AND pg_temp.j('pv') ->> pg_temp.u('i_ome')::text = 'em_dia',
  'prescricao_vigente traz o estado');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('painel') -> 'prescricao') x
                           WHERE (x ->> 'id')::uuid = pg_temp.u('i_dip') AND x ->> 'validade' = 'vencido' AND x ? 'valida_ate' AND x ? 'renovacao_pedida_em'),
  'painel do atendimento traz a validade de cada item');

-- ── V3: a enfermagem pede a renovação ──────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.pedir_renovacao(%L)', pg_temp.u('i_dip')),
  'O pedido de renovação é da enfermagem', 'recepção não pede renovação');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.pedir_renovacao(%L)', pg_temp.u('i_cui')),
  'O item vale até', 'item em dia: o pedido só abre 2 h antes');
SELECT pg_temp.falha(format('SELECT public.pedir_renovacao(%L)', pg_temp.u('i_agora')),
  'Item "Agora" (dose única) não vence', '"Agora" não tem renovação');
SELECT pg_temp.falha(format('SELECT public.pedir_renovacao(%L)', pg_temp.u('i_cont')),
  'A contenção mecânica tem renovação própria', 'contenção fica com a renovação dela');
INSERT INTO t SELECT 'ped1', public.pedir_renovacao(pg_temp.u('i_dip'))::text;
INSERT INTO t SELECT 'ped2', public.pedir_renovacao(pg_temp.u('i_dip'))::text;
RESET ROLE;
SELECT pg_temp.ok((pg_temp.j('ped1') ->> 'avisados')::int >= 1 AND (pg_temp.j('ped2') ->> 'avisados')::int = 0
  AND pg_temp.avisos('presc_pedido_' || pg_temp.u('i_dip')) = (pg_temp.j('ped1') ->> 'avisados')::int
  AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000002'
                AND tipo = 'presc_pedido_' || pg_temp.u('i_dip')
                AND mensagem LIKE 'A enfermagem pede a renovação: Dipirona validade%de Paciente Validade (Pronto Socorro), vencida às%'),
  'pedido de renovação avisa o médico de plantão do setor uma vez');
SELECT pg_temp.ok((pg_temp.it('i_dip')).renovacao_pedida_em = now() AND (pg_temp.it('i_dip')).renovacao_pedida_por = '10000000-0000-4000-8000-000000000004',
  'o item guarda quando e quem pediu');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000004'
                                AND tipo LIKE 'presc_%'), 'o aviso não vai para a enfermagem');

-- ── V6: o job (2 h antes e no vencimento, uma vez por janela) ──────────────
UPDATE public.prescricao_itens SET valida_ate = now() + interval '90 minutes' WHERE id = pg_temp.u('i_cui');
UPDATE public.prescricao_itens SET valida_ate = now() - interval '1 minute' WHERE id = pg_temp.u('i_cont');
INSERT INTO t SELECT 'job1', private.prescricao_validade_avisar()::text;
INSERT INTO t SELECT 'job2', private.prescricao_validade_avisar()::text;
SELECT pg_temp.ok(pg_temp.avisos('presc_vencida_' || pg_temp.u('i_dip')) = 1 AND pg_temp.avisos('presc_vencida_' || pg_temp.u('i_sn')) = 1
  AND pg_temp.avisos('presc_vence_' || pg_temp.u('i_cui')) = 1 AND pg_temp.avisos('presc_%_' || pg_temp.u('i_ome')) = 0
  AND (SELECT valor::int FROM t WHERE nome = 'job2') = 0,
  'job: um aviso por item e por janela (vencido e a 2 h do fim); em dia, nenhum; de novo, nada');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000002'
                            AND tipo = 'presc_vence_' || pg_temp.u('i_cui') AND mensagem LIKE 'Renovar a prescrição: Cabeceira elevada de Paciente Validade%vence às%'),
  'o aviso de 2 h antes vai ao médico com o item e o paciente');
SELECT pg_temp.ok(pg_temp.avisos('presc_%_' || pg_temp.u('i_cont')) = 0 AND pg_temp.avisos('presc_%_' || pg_temp.u('i_agora')) = 0,
  'contenção (avisos próprios) e "Agora" ficam fora do job');
-- a janela de vencimento é outra: o item que estava a 2 h do fim e venceu ganha o segundo aviso
UPDATE public.prescricao_itens SET valida_ate = now() - interval '1 minute' WHERE id = pg_temp.u('i_cui');
SELECT private.prescricao_validade_avisar();
SELECT pg_temp.ok(pg_temp.avisos('presc_vencida_' || pg_temp.u('i_cui')) = 1 AND pg_temp.avisos('presc_vence_' || pg_temp.u('i_cui')) = 1,
  'no vencimento, o segundo aviso (a janela muda)');
-- o dia seguinte não repete (a chave do aviso tem a data)
UPDATE public.notificacoes_plantonista SET data = data - 1 WHERE tipo = 'presc_vencida_' || pg_temp.u('i_dip');
SELECT private.prescricao_validade_avisar();
SELECT pg_temp.ok(pg_temp.avisos('presc_vencida_' || pg_temp.u('i_dip')) = 1, 'virando o dia, o aviso da mesma janela não se repete');

-- ── V4/V5: renovar ─────────────────────────────────────────────────────────
-- o item foi prescrito por outro médico: a versão renovada é de quem renova
UPDATE public.prescricao_itens SET autor_id = '10000000-0000-4000-8000-000000000001' WHERE id = pg_temp.u('i_dip');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.aprazar(pg_temp.u('i_dip'), ARRAY['06:00', '12:00', '18:00', '00:00']);
SELECT pg_temp.falha(format('SELECT public.renovar_prescricao(%L, %L::jsonb)', pg_temp.u('pac'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.u('i_dip'), 'acao', 'manter'))),
  'A renovação é do médico de plantão', 'enfermagem não renova (V5)');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.renovar_prescricao(%L, %L::jsonb)', pg_temp.u('pac'), '[]'),
  'Marque manter, alterar ou suspender', 'sem decisão, nada se renova');
SELECT pg_temp.falha(format('SELECT public.renovar_prescricao(%L, %L::jsonb)', pg_temp.u('pac'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.u('i_dip'), 'acao', 'renovar_tudo'))),
  'Marque manter, alterar ou suspender', 'cada item com a marca (não há "renovar tudo")');
SELECT pg_temp.falha(format('SELECT public.renovar_prescricao(%L, %L::jsonb)', pg_temp.u('pac'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.u('i_dip'), 'acao', 'manter'), jsonb_build_object('item_id', pg_temp.u('i_dip'), 'acao', 'suspender'))),
  'Cada item entra uma vez só', 'item repetido é recusado');
SELECT pg_temp.falha(format('SELECT public.renovar_prescricao(%L, %L::jsonb)', pg_temp.u('pac'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.u('i_cont'), 'acao', 'manter'))),
  'A contenção mecânica se renova pela própria ordem', 'contenção fora da renovação (V7)');
SELECT pg_temp.falha(format('SELECT public.renovar_prescricao(%L, %L::jsonb)', pg_temp.u('pac'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.u('i_agora'), 'acao', 'manter'))),
  'Ondansetrona validade', '"Agora" não se renova');
-- tudo ou nada: o segundo item falha (motivo curto) e o primeiro não é renovado
SELECT pg_temp.falha(format('SELECT public.renovar_prescricao(%L, %L::jsonb)', pg_temp.u('pac'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.u('i_dip'), 'acao', 'manter'),
                    jsonb_build_object('item_id', pg_temp.u('i_cui'), 'acao', 'suspender', 'motivo', 'x'))),
  'Diga por que suspende', 'decisão inválida desfaz a renovação inteira');
RESET ROLE;
SELECT pg_temp.ok((pg_temp.it('i_dip')).suspenso_em IS NULL, 'depois da recusa, o item continua como estava');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'ren1', public.renovar_prescricao(pg_temp.u('pac'), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.u('i_dip'), 'acao', 'manter'),
  jsonb_build_object('item_id', pg_temp.u('i_sn'), 'acao', 'alterar', 'mudancas', jsonb_build_object('dose', '1 g'), 'motivo', 'Ajuste da dose na renovação'),
  jsonb_build_object('item_id', pg_temp.u('i_cui'), 'acao', 'suspender', 'motivo', 'Sem indicação agora')))::text;
RESET ROLE;
INSERT INTO t SELECT 'n_dip', x ->> 'novo_id' FROM jsonb_array_elements(pg_temp.j('ren1') -> 'itens') x WHERE (x ->> 'item_id')::uuid = pg_temp.u('i_dip');
INSERT INTO t SELECT 'n_sn', x ->> 'novo_id' FROM jsonb_array_elements(pg_temp.j('ren1') -> 'itens') x WHERE (x ->> 'item_id')::uuid = pg_temp.u('i_sn');
SELECT pg_temp.ok((pg_temp.j('ren1') ->> 'mantidos')::int = 1 AND (pg_temp.j('ren1') ->> 'alterados')::int = 1 AND (pg_temp.j('ren1') ->> 'suspensos')::int = 1,
  'renovação: um mantido, um alterado, um suspenso');
SELECT pg_temp.ok((pg_temp.it('i_dip')).suspenso_em IS NOT NULL AND (pg_temp.it('i_dip')).motivo_suspensao LIKE 'Renovada%'
  AND (pg_temp.it('i_dip')).suspenso_por = '10000000-0000-4000-8000-000000000002',
  'manter: a anterior é suspensa como "Renovada"');
SELECT pg_temp.ok((pg_temp.it('n_dip')).autor_id = '10000000-0000-4000-8000-000000000002'
  AND (pg_temp.it('n_dip')).substitui_item_id = pg_temp.u('i_dip') AND (pg_temp.it('n_dip')).versao = (pg_temp.it('i_dip')).versao + 1
  AND (pg_temp.it('n_dip')).dose = '1 g' AND (pg_temp.it('n_dip')).via = 'EV' AND (pg_temp.it('n_dip')).posologia = '6/6h'
  AND (pg_temp.it('n_dip')).medicamento_id = pg_temp.u('dipirona') AND (pg_temp.it('n_dip')).ordem = (pg_temp.it('i_dip')).ordem,
  'manter: versão nova idêntica, com o autor sendo quem renovou (login)');
SELECT pg_temp.ok((pg_temp.it('n_dip')).horarios = ARRAY['00:00', '06:00', '12:00', '18:00']
  AND (pg_temp.it('n_dip')).horarios = (pg_temp.it('i_dip')).horarios,
  'manter: o aprazamento continua');
SELECT pg_temp.ok((pg_temp.it('n_dip')).valida_ate = now() + interval '24 hours' AND (pg_temp.it('n_dip')).renovacao_pedida_em IS NULL,
  'manter: vale 24 h a partir da renovação');
SELECT pg_temp.ok(private.liberado_pela_farmacia(pg_temp.u('n_dip'))
  AND (SELECT v.herdada_de = (SELECT a.id FROM public.validacoes_prescricao a WHERE a.item_id = pg_temp.u('i_dip') ORDER BY a.em DESC LIMIT 1)
              AND v.farmaceutico_id = '10000000-0000-4000-8000-000000000006' AND v.situacao = 'confere'
         FROM public.validacoes_prescricao v WHERE v.item_id = pg_temp.u('n_dip')),
  'manter sem mudança: a validação da farmácia segue (herdada da anterior)');
SELECT pg_temp.ok((pg_temp.it('n_sn')).dose = '1 g' AND (pg_temp.it('n_sn')).substitui_item_id = pg_temp.u('i_sn')
  AND (pg_temp.it('i_sn')).motivo_suspensao LIKE 'Alterado:%' AND (pg_temp.it('n_sn')).valida_ate = now() + interval '24 hours'
  AND NOT EXISTS (SELECT 1 FROM public.validacoes_prescricao WHERE item_id = pg_temp.u('n_sn')),
  'alterar: o fluxo de alteração, com validade nova e sem validação herdada');
SELECT pg_temp.ok((pg_temp.it('i_cui')).suspenso_em IS NOT NULL AND (pg_temp.it('i_cui')).motivo_suspensao = 'Sem indicação agora',
  'suspender: o item sai com o motivo');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'prescricao_item_renovado' AND entidade_id = pg_temp.u('n_dip')
                            AND payload ->> 'anterior' = pg_temp.u('i_dip')::text)
  AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'renovar_prescricao')
  AND NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao IN ('prescricao_item_renovado', 'renovar_prescricao', 'renovacao_pedida')
                    AND (payload::text LIKE '%Paciente Validade%' OR payload ? 'paciente_id' OR payload::text LIKE '%Dipirona%')),
  'auditoria da renovação e do pedido, sem dado de pessoa');
-- o item renovado volta à checagem
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'adm_ren', public.checar(pg_temp.u('n_dip'), 'feito', '06:00')::text;
RESET ROLE;
SELECT pg_temp.ok(pg_temp.u('adm_ren') IS NOT NULL, 'a versão renovada se checa como feita');

-- ── V8: da porta para a internação ─────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'internacao', NULL, '{"setor_id":"22000000-0000-4000-8000-000000000001"}');
INSERT INTO t SELECT 'pa', (SELECT jsonb_object_agg(p.id, jsonb_build_object('validade', p.validade, 'valida_ate', p.valida_ate))
                              FROM public.prescricao_porta_ativa(pg_temp.u('pac')) p)::text;
RESET ROLE;
SELECT pg_temp.ok(pg_temp.j('pa') -> pg_temp.u('i_ome')::text ->> 'validade' = 'em_dia'
  AND (pg_temp.j('pa') -> pg_temp.u('i_ome')::text ->> 'valida_ate')::timestamptz = now() + interval '7 hours',
  'na internação, o item da porta aparece com a validade de quando foi prescrito');
UPDATE public.prescricao_itens SET valida_ate = now() - interval '1 minute' WHERE id = pg_temp.u('i_ome');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'ren2', public.renovar_prescricao(pg_temp.u('pac'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.u('i_ome'), 'acao', 'manter')))::text;
RESET ROLE;
INSERT INTO t SELECT 'n_ome', pg_temp.j('ren2') -> 'itens' -> 0 ->> 'novo_id';
SELECT pg_temp.ok((SELECT pr.internacao_id IS NOT NULL FROM public.prescricoes pr WHERE pr.id = (pg_temp.it('n_ome')).prescricao_id)
  AND (pg_temp.it('n_ome')).prescricao_id <> (pg_temp.it('i_ome')).prescricao_id
  AND (pg_temp.it('n_ome')).horarios = ARRAY['00:00', '06:00', '12:00', '18:00'],
  'item da porta renovado na internação: a versão nova vai para a prescrição do leito, com o aprazamento');

-- ── privilégios ────────────────────────────────────────────────────────────
SELECT pg_temp.ok(NOT has_function_privilege('anon', f, 'EXECUTE') AND has_function_privilege('authenticated', f, 'EXECUTE'), 'anon não executa ' || f)
  FROM unnest(ARRAY['public.renovar_prescricao(uuid, jsonb)', 'public.pedir_renovacao(uuid)', 'public.fila_checagem()',
                    'public.fila_validacao(uuid)', 'public.prescricao_vigente(uuid, timestamptz)', 'public.prescricao_porta_ativa(uuid)',
                    'public.checar(uuid, text, text, text, text, text)', 'public.dispensar_item(uuid, integer, text)']) f;
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', f, 'EXECUTE'), 'authenticated não executa ' || f)
  FROM unnest(ARRAY['private.prescricao_validade_avisar()', 'private.prescricao_validade_transicao()',
                    'private.avisar_validade_item(uuid, text, text)', 'private.validade_item(timestamptz)',
                    'private.prescricao_item_validade()', 'private.doses_do_item(uuid)']) f;
SELECT pg_temp.ok((SELECT count(*) = 1 FROM cron.job WHERE jobname = 'prescricao-validade-avisos' AND schedule = '*/15 * * * *'),
  'job de avisos a cada 15 min');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha('SELECT private.prescricao_validade_avisar()', 'permission denied', 'authenticated não roda o job');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');   -- farmacêutico, sem o paciente no plantão
SELECT pg_temp.falha(format('SELECT public.renovar_prescricao(%L, %L::jsonb)', pg_temp.u('pac'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.u('n_dip'), 'acao', 'manter'))),
  'A renovação é do médico de plantão', 'farmacêutico não renova');
RESET ROLE;

ROLLBACK;
