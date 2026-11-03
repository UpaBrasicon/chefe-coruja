-- ════════════════════════════════════════════════════════════════════════════
-- Ponta a ponta da consulta da UBS (5A, tarefa 2, partes 2.1 a 2.3): as mesmas
-- chamadas que as telas fazem, na ordem da tela, cada uma com o papel de quem
-- usa (JWT simulado, RLS valendo). Tudo em transação com ROLLBACK; o cenário é
-- criado aqui e roda também na homologação.
--
-- 1. recepção: o consultório é a porta da ficha; duas fichas; fila;
-- 2. médico: plantão no consultório; fila com o tipo; sala do plantão; chamada;
--    a recepção vê a chamada;
-- 3. janela: sem classificação; painel; alergias; rascunho do SOAP;
-- 4. conduta: SOAP registrado e consulta encerrada com a ficha do e-SUS APS;
--    saídas do plantão; a fila fica só com a segunda ficha;
-- 5. evasão na UBS pelo desfecho.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000054a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000054a2'),
  ('rec',  '00000000-0000-4000-8000-0000000054a8'),
  ('med',  '00000000-0000-4000-8000-0000000054a9');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE TEMP TABLE v (nome text PRIMARY KEY, val text) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT val FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE TEMP TABLE log (n serial, passo text) ON COMMIT DROP;
GRANT ALL ON log TO authenticated;
GRANT USAGE ON SEQUENCE log_n_seq TO authenticated;

-- cenário: UBS nova; o setor de consultório criado como na tela de Setores
-- (o gatilho dá a sala); recepção e médico de plantão agora, com check-in
INSERT INTO auth.users (id, email) SELECT id, nome || '@e2e-ubs.local' FROM ids WHERE nome IN ('rec', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'E2E UBS ' || nome FROM ids WHERE nome IN ('rec', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede E2E UBS');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS E2E', 'ubs');
WITH s AS (INSERT INTO public.setores (unidade_id, nome, tipo) VALUES (pg_temp.id('ubs'), 'Consultório 1', 'consultorio') RETURNING id)
INSERT INTO v SELECT 'cons', id::text FROM s;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.v('cons')::uuid, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('rec')), (pg_temp.id('med'))) x(p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── recepção (Recepcao.tsx) ─────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.setores WHERE unidade_id = pg_temp.id('ubs') AND tipo = 'consultorio' AND ativo),
  'recepção: o consultório aparece como porta da ficha');
SELECT pg_temp.ok(pg_temp.v('cons')::uuid IN (SELECT * FROM public.setores_na_escala_agora()), 'recepção: está de plantão no consultório');
INSERT INTO v SELECT 'ep1', (public.registrar_ficha(pg_temp.v('cons')::uuid, 'Renovação de receita da pressão', NULL,
  '{"nome":"Paciente E2E Um","data_nascimento":"1964-02-01","tipo_atendimento":"consulta_programada"}') ->> 'episodio_id');
INSERT INTO v SELECT 'ep2', (public.registrar_ficha(pg_temp.v('cons')::uuid, 'Febre há 2 dias', NULL,
  '{"nome":"Paciente E2E Dois","data_nascimento":"2001-05-05","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.fila_da_porta(pg_temp.v('cons')::uuid)), 'recepção: a fila do consultório mostra as duas fichas');

-- ── médico: fila (FilaPS.tsx) ───────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.ok(pg_temp.v('cons')::uuid IN (SELECT * FROM public.setores_na_escala_agora()), 'médico: está de plantão no consultório');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
                    WHERE e.setor_id = pg_temp.v('cons')::uuid AND e.etapa = 'atendimento' AND e.tipo_atendimento_aps IS NOT NULL),
  'médico: a fila tem as duas fichas, com o tipo de atendimento e o paciente');
-- sala (useChamadas / useConsultorioDoPlantao) e chamada (Chamada.tsx)
INSERT INTO v SELECT 'sala', id::text FROM public.salas WHERE setor_id = pg_temp.v('cons')::uuid AND ativo ORDER BY ordem LIMIT 1;
SELECT pg_temp.ok(pg_temp.v('sala') IS NOT NULL, 'médico: o consultório tem sala para chamar');
SELECT public.definir_sala_do_plantao(pg_temp.v('cons')::uuid, pg_temp.v('sala')::uuid);
SELECT pg_temp.ok((SELECT count(*) >= 1 FROM public.minhas_salas_do_plantao()), 'médico: a sala do plantão fica guardada');
SELECT public.chamar_paciente(pg_temp.v('ep1')::uuid, pg_temp.v('sala')::uuid);
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.chamadas WHERE episodio_id = pg_temp.v('ep1')::uuid), 'médico: chamada registrada');
SELECT pg_temp.como('rec');
SELECT pg_temp.ok((SELECT count(*) >= 1 FROM public.ultimas_chamadas_porta(pg_temp.v('cons')::uuid, 8)), 'recepção: vê a última chamada');

-- ── médico: janela da consulta (JanelaAtendimento.tsx) ──────────────────────
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('ep1')::uuid);
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.classificacoes_do_episodio(pg_temp.v('ep1')::uuid)), 'janela: sem classificação na UBS');
SELECT pg_temp.ok((SELECT atendimento_iniciado_em IS NOT NULL FROM public.episodios WHERE id = pg_temp.v('ep1')::uuid), 'janela: atendimento aberto');
SELECT pg_temp.ok(public.painel_atendimento_ps(pg_temp.v('ep1')::uuid) IS NOT NULL, 'janela: o painel do atendimento abre');
SELECT pg_temp.ok((SELECT count(*) >= 0 FROM public.alergias_do_paciente((SELECT paciente_id FROM public.episodios WHERE id = pg_temp.v('ep1')::uuid))),
  'janela: alergias do paciente');
SELECT public.salvar_rascunho_atendimento(pg_temp.v('ep1')::uuid, '{"s":"Hipertensa há 10 anos","o":"","a":"","p":"","cid":""}');
SELECT pg_temp.ok((public.painel_atendimento_ps(pg_temp.v('ep1')::uuid) -> 'rascunho' ->> 's') = 'Hipertensa há 10 anos', 'janela: o rascunho do SOAP volta do servidor');
-- aba Conduta: o rascunho vira registro, depois a conduta (AbaConduta.tsx)
SELECT public.registrar_soap(pg_temp.v('ep1')::uuid, 'Hipertensa há 10 anos, sem queixas', 'PA 148x92 mmHg', 'Hipertensão sem controle ideal',
  'Ajuste da medicação e retorno', 'I10');
SELECT public.registrar_conduta_aps(pg_temp.v('ep1')::uuid, 'consulta_programada', '{hipertensao_arterial}', '{E11.9}',
  '{retorno_cuidado_continuado,encaminhamento_especializado}', 'Retorno em 30 dias com o MAPA');
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND desfecho IS NULL AND conduta_aps = '{encaminhamento_especializado,retorno_cuidado_continuado}'
                          AND cid_aps = '{E11.9}' AND problemas_aps = '{hipertensao_arterial}' AND desfecho_motivo = 'Retorno em 30 dias com o MAPA'
                     FROM public.episodios WHERE id = pg_temp.v('ep1')::uuid), 'conduta: consulta encerrada com a ficha do e-SUS APS');
-- saídas do plantão (FilaPS.tsx): na UBS entram as sem desfecho
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.episodios WHERE setor_id = pg_temp.v('cons')::uuid AND etapa NOT IN ('triagem', 'atendimento')
                    AND conduta_aps IS NOT NULL), 'saídas: a consulta encerrada aparece com a conduta');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.fila_da_porta(pg_temp.v('cons')::uuid)), 'fila: sobra só a segunda ficha');

-- ── evasão: "Saiu sem a consulta" (AbaConduta.tsx) ──────────────────────────
SELECT public.iniciar_atendimento(pg_temp.v('ep2')::uuid);
SELECT public.registrar_desfecho(pg_temp.v('ep2')::uuid, 'evasao', 'Chamado duas vezes e não estava na sala de espera',
  '{"motivo_evasao":"demora"}');
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND desfecho = 'evasao' FROM public.episodios WHERE id = pg_temp.v('ep2')::uuid), 'evasão registrada na UBS');

RESET ROLE;
ROLLBACK;
