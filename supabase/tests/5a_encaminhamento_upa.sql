-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270216000001_encaminhamento_upa.sql (5A, tarefa 5,
-- parte 5.1). Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. quem envia: médico ou enfermeiro de plantão no consultório (recepção não);
--    destino: UPA ou hospital da mesma rede; motivo; um envio aberto por vez;
-- 2. da consulta: o resumo leva o SOAP e o episódio da UBS segue aberto; da
--    escuta: a ficha da UBS encerra; o destino é avisado;
-- 3. a UPA vê e marca a chegada (com a ficha dela) ou o não chegou; quem
--    enviou é avisado; a UBS não vê a lista do destino;
-- 4. o prazo de 12 h marca "não chegou" e avisa; a UPA ainda corrige;
-- 5. cancelamento pela origem; listas da origem e do paciente; o job existe.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000058a1'),
  ('org2', '00000000-0000-4000-8000-0000000058a2'),
  ('ubs',  '00000000-0000-4000-8000-0000000058a3'),
  ('upa',  '00000000-0000-4000-8000-0000000058a4'),
  ('upa2', '00000000-0000-4000-8000-0000000058a5'),
  ('cons', '00000000-0000-4000-8000-0000000058a6'),
  ('porta','00000000-0000-4000-8000-0000000058a7'),
  ('med',  '00000000-0000-4000-8000-0000000058b1'),
  ('enf',  '00000000-0000-4000-8000-0000000058b2'),
  ('rec',  '00000000-0000-4000-8000-0000000058b3'),
  ('recu', '00000000-0000-4000-8000-0000000058b4');
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
-- leitura da tabela no teste (o authenticated não tem acesso direto)
CREATE FUNCTION pg_temp.sit(p text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT situacao FROM public.encaminhamentos_upa WHERE id = (SELECT id FROM v WHERE nome = p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.sit(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a5.local' FROM ids WHERE nome IN ('med', 'enf', 'rec', 'recu');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf', 'rec', 'recu')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do 5A5'), (pg_temp.id('org2'), 'Outra rede do 5A5');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do 5A5', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do 5A5', 'upa'),
  (pg_temp.id('upa2'), pg_temp.id('org2'), 'UPA de outra rede', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio'),
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('recu'), pg_temp.id('upa'), 'recepcao');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT u, s, pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), 'med'), (pg_temp.id('ubs'), pg_temp.id('cons'), 'enf'),
               (pg_temp.id('ubs'), pg_temp.id('cons'), 'rec'), (pg_temp.id('upa'), pg_temp.id('porta'), 'recu')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('ubs'), pg_temp.id('upa')) ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── fichas na UBS ───────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep1', (public.registrar_ficha(pg_temp.id('cons'), 'Dor no peito há 1 hora', NULL,
  '{"nome":"Paciente Envio Um","data_nascimento":"1958-03-03","cns":"898001160000001","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'ep2', (public.registrar_ficha(pg_temp.id('cons'), 'Falta de ar', NULL,
  '{"nome":"Paciente Envio Dois","data_nascimento":"1970-04-04","tipo_atendimento":"escuta_inicial"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'ep3', (public.registrar_ficha(pg_temp.id('cons'), 'Tontura', NULL,
  '{"nome":"Paciente Envio Tres","data_nascimento":"1980-05-05","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;

-- ── 1. quem envia e para onde ───────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.encaminhar_upa(pg_temp.v('ep1'), pg_temp.id('upa'), 'Dor torácica típica, sem ECG na UBS')$$,
  'Acesso negado: envia o médico ou o enfermeiro', 'recepção não envia');
SELECT pg_temp.como('med');
SELECT pg_temp.falha($$SELECT public.encaminhar_upa(pg_temp.v('ep1'), pg_temp.id('upa2'), 'Dor torácica típica, sem ECG na UBS')$$,
  'Escolha uma UPA ou um hospital da rede', 'UPA de outra rede é recusada');
SELECT pg_temp.falha($$SELECT public.encaminhar_upa(pg_temp.v('ep1'), pg_temp.id('ubs'), 'Dor torácica típica, sem ECG na UBS')$$,
  'Escolha uma UPA ou um hospital da rede', 'a própria UBS não é destino');
SELECT pg_temp.falha($$SELECT public.encaminhar_upa(pg_temp.v('ep1'), pg_temp.id('upa'), 'Dor')$$,
  'Escreva o motivo do envio', 'motivo obrigatório');

-- ── 2. da consulta e da escuta ──────────────────────────────────────────────
SELECT public.iniciar_atendimento(pg_temp.v('ep1'));
SELECT public.registrar_soap(pg_temp.v('ep1'), 'Dor em aperto há 1 h', 'PA 160x100, sudorese', 'Suspeita de síndrome coronariana aguda',
  'Enviar à UPA', 'I20.0');
INSERT INTO v SELECT 'x1', public.encaminhar_upa(pg_temp.v('ep1'), pg_temp.id('upa'), 'Dor torácica típica, sem ECG na UBS');
SELECT pg_temp.falha($$SELECT public.encaminhar_upa(pg_temp.v('ep1'), pg_temp.id('upa'), 'Dor torácica típica, de novo')$$,
  'Já há um envio à UPA em andamento', 'um envio aberto por consulta');
SELECT pg_temp.como('enf');
INSERT INTO v SELECT 'x2', public.encaminhar_upa(pg_temp.v('ep2'), pg_temp.id('upa'), 'Dispneia grave na escuta, sem médico na UBS');
RESET ROLE;
SELECT pg_temp.ok((SELECT resumo -> 'soap' ->> 'avaliacao' = 'Suspeita de síndrome coronariana aguda' AND resumo -> 'paciente' ->> 'cns' = '898001160000001'
                          AND prazo_em > now() + interval '11 hours' FROM public.encaminhamentos_upa WHERE id = pg_temp.v('x1')),
  'o resumo leva o SOAP e o paciente; prazo de 12 h');
SELECT pg_temp.ok((SELECT etapa = 'atendimento' FROM public.episodios WHERE id = pg_temp.v('ep1')), 'da consulta: a ficha da UBS segue aberta para a conduta');
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND desfecho_motivo LIKE 'Enviado à UPA do 5A5:%' FROM public.episodios WHERE id = pg_temp.v('ep2')),
  'da escuta: a ficha da UBS encerra com o envio');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('recu') AND tipo LIKE 'ubs_upa_%'),
  'a recepção da UPA é avisada de cada envio');
SET LOCAL ROLE authenticated;

-- ── 3. a UPA recebe ─────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.encaminhamentos_upa_destino(pg_temp.id('upa'))$$, 'Acesso negado', 'a UBS não vê a lista da UPA');
SELECT pg_temp.como('recu');
SELECT pg_temp.ok(jsonb_array_length(public.encaminhamentos_upa_destino(pg_temp.id('upa'))) = 2, 'a UPA vê os dois vindos da UBS');
SELECT pg_temp.falha($$SELECT public.encaminhamento_upa_marcar_chegada(pg_temp.v('x1'), true, pg_temp.v('ep1'))$$,
  'A ficha informada não é desta unidade', 'a ficha da chegada é da UPA');
INSERT INTO v SELECT 'epu', (public.registrar_ficha(pg_temp.id('porta'), 'Dor torácica (vindo da UBS)', NULL,
  '{"nome":"Paciente Envio Um","data_nascimento":"1958-03-03"}') ->> 'episodio_id')::uuid;
SELECT public.encaminhamento_upa_marcar_chegada(pg_temp.v('x1'), true, pg_temp.v('epu'));
SELECT pg_temp.ok(pg_temp.sit('x1') = 'chegou', 'chegou, ligado à ficha da UPA');
SELECT pg_temp.falha($$SELECT public.encaminhamento_upa_marcar_chegada(pg_temp.v('x2'), false)$$,
  'Escreva o que aconteceu', 'não chegou pede o relato');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('med') AND tipo LIKE 'ubs_upa_%'
                     AND mensagem LIKE '%chegou à UPA do 5A5%'), 'quem enviou é avisado da chegada');

-- ── 4. prazo ────────────────────────────────────────────────────────────────
UPDATE public.encaminhamentos_upa SET prazo_em = now() - interval '1 minute' WHERE id = pg_temp.v('x2');
SELECT pg_temp.ok(private.encaminhamentos_upa_prazo() = 1 AND pg_temp.sit('x2') = 'nao_chegou', 'sem chegada em 12 h: não chegou');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('enf') AND tipo LIKE 'ubs_upa_%'
                     AND mensagem LIKE '%não registrou a chegada em 12 horas%'), 'quem enviou é avisado do prazo');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('recu');
SELECT public.encaminhamento_upa_marcar_chegada(pg_temp.v('x2'), true, NULL, 'Chegou de ambulância, ficha aberta depois');
SELECT pg_temp.ok(pg_temp.sit('x2') = 'chegou', 'a UPA corrige o não chegou automático');

-- ── 5. cancelamento e listas ────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('ep3'));
INSERT INTO v SELECT 'x3', public.encaminhar_upa(pg_temp.v('ep3'), pg_temp.id('upa'), 'Vertigem com déficit focal');
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.encaminhamento_upa_cancelar(pg_temp.v('x3'), 'Melhorou')$$, 'Acesso negado: cancela', 'recepção não cancela');
SELECT pg_temp.como('med');
SELECT public.encaminhamento_upa_cancelar(pg_temp.v('x3'), 'Reavaliado: sem déficit, fica na UBS');
SELECT pg_temp.ok(pg_temp.sit('x3') = 'cancelado', 'cancelado pela origem');
SELECT pg_temp.falha($$SELECT public.encaminhamento_upa_cancelar(pg_temp.v('x3'), 'De novo')$$, 'Só se cancela o envio', 'não cancela duas vezes');
SELECT pg_temp.ok(jsonb_array_length(public.encaminhamentos_upa_origem(pg_temp.id('ubs'))) = 3, '"Encaminhados" da UBS com os três');
SELECT pg_temp.ok((SELECT e ->> 'situacao' = 'chegou' FROM jsonb_array_elements(public.encaminhamentos_upa_do_paciente(
                     (SELECT paciente_id FROM public.episodios WHERE id = pg_temp.v('ep1')))) e), 'histórico do paciente');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'encaminhamento-upa-prazo'), 'job do prazo agendado');
SELECT pg_temp.ok(has_table_privilege('authenticated', 'public.encaminhamentos_upa', 'SELECT') IS FALSE, 'sem acesso direto à tabela');

ROLLBACK;
