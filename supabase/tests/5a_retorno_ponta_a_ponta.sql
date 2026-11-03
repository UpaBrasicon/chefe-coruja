-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 6, parte 6.3: o caminho inteiro da UBS à UPA e de volta, com as
-- mesmas chamadas das telas e o papel de cada um. Tudo em transação com
-- ROLLBACK; o cenário é criado aqui.
--
-- UBS: a recepção abre a ficha, o médico atende e envia à UPA ("Enviar à UPA").
-- UPA: a recepção vê "Vindo da UBS", abre a ficha e marca a chegada; o médico
--      atende e dá alta com a orientação à UBS (aba Desfecho).
-- UBS: "Encaminhados" mostra que chegou; o aviso do retorno chega ao médico e
--      ao enfermeiro; a aba Retornos lista um só retorno (envio e CNS apontam a
--      mesma UBS); o enfermeiro abre o resumo; a recepção agenda o retorno
--      ("Agendar retorno": paciente da UBS, consulta programada, sem episódio).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000060a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000060a2'),
  ('upa',  '00000000-0000-4000-8000-0000000060a3'),
  ('cons', '00000000-0000-4000-8000-0000000060a4'),
  ('porta','00000000-0000-4000-8000-0000000060a5'),
  ('med',  '00000000-0000-4000-8000-0000000060b1'),
  ('enf',  '00000000-0000-4000-8000-0000000060b2'),
  ('rec',  '00000000-0000-4000-8000-0000000060b3'),
  ('ges',  '00000000-0000-4000-8000-0000000060b4'),
  ('medu', '00000000-0000-4000-8000-0000000060b5'),
  ('recu', '00000000-0000-4000-8000-0000000060b6');
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
-- horário local (America/Sao_Paulo) do dia hoje + n
CREATE FUNCTION pg_temp.h(n int, hora text) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT ((private.data_atual() + n) + hora::time) AT TIME ZONE 'America/Sao_Paulo' $$;
GRANT EXECUTE ON FUNCTION pg_temp.h(int, text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a6e2e.local' FROM ids WHERE nome IN ('med', 'enf', 'rec', 'ges', 'medu', 'recu');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf', 'rec', 'ges', 'medu', 'recu')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do 5A6 ponta a ponta');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS ponta a ponta', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA ponta a ponta', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio'),
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor'),
  (pg_temp.id('medu'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('recu'), pg_temp.id('upa'), 'recepcao');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT u, s, pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), 'med'), (pg_temp.id('ubs'), pg_temp.id('cons'), 'rec'),
               (pg_temp.id('upa'), pg_temp.id('porta'), 'medu'), (pg_temp.id('upa'), pg_temp.id('porta'), 'recu')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('ubs'), pg_temp.id('upa')) ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── UBS: ficha, consulta e envio ────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep', (public.registrar_ficha(pg_temp.id('cons'), 'Falta de ar desde ontem', NULL,
  '{"nome":"Paciente Ponta a Ponta","data_nascimento":"1985-05-05","cns":"898001160000001","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('ep'));
SELECT public.registrar_soap(pg_temp.v('ep'), 'Dispneia progressiva', 'Sibilos, SpO2 90%', 'Crise de asma grave', 'Enviar à UPA', 'J45.9');
INSERT INTO v SELECT 'envio', public.encaminhar_upa(pg_temp.v('ep'), pg_temp.id('upa'), 'Crise de asma grave, SpO2 90% na UBS');
RESET ROLE;
INSERT INTO v SELECT 'pac_ubs', paciente_id FROM public.episodios WHERE id = pg_temp.v('ep');
SET LOCAL ROLE authenticated;

-- ── UPA: Vindo da UBS, chegada e alta ───────────────────────────────────────
SELECT pg_temp.como('recu');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM jsonb_array_elements(public.encaminhamentos_upa_destino(pg_temp.id('upa'))) e
                    WHERE e ->> 'situacao' = 'enviado'), 'UPA: o paciente aparece em "Vindo da UBS"');
INSERT INTO v SELECT 'epu', (public.registrar_ficha(pg_temp.id('porta'), 'Falta de ar (vindo da UBS)', NULL,
  '{"nome":"Paciente Ponta a Ponta","data_nascimento":"1985-05-05","cns":"898001160000001"}') ->> 'episodio_id')::uuid;
SELECT public.encaminhamento_upa_marcar_chegada(pg_temp.v('envio'), true, pg_temp.v('epu'));
RESET ROLE;
-- a classificação de risco não é o assunto daqui: o paciente vai direto ao médico
UPDATE public.episodios SET etapa = 'atendimento' WHERE id = pg_temp.v('epu');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('medu');
SELECT public.iniciar_atendimento(pg_temp.v('epu'));
SELECT public.registrar_soap(pg_temp.v('epu'), 'Dispneia', 'Sibilos difusos', 'Crise de asma grave, boa resposta',
  'Alta com corticoide oral e espaçador', 'J45.9');
SELECT public.registrar_desfecho(pg_temp.v('epu'), 'alta', NULL,
  '{"cid_alta":"J45.9","orientacao_ubs":"Rever a técnica do espaçador e o controle da asma em 7 dias"}');

-- ── UBS: chegou, aviso, retorno, resumo e agenda ────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.ok((SELECT e ->> 'situacao' = 'chegou' FROM jsonb_array_elements(public.encaminhamentos_upa_origem(pg_temp.id('ubs'))) e),
  'UBS: "Encaminhados" mostra que chegou');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.notificacoes_plantonista WHERE unidade_id = pg_temp.id('ubs') AND tipo LIKE 'ubs_retorno_%'
                     AND perfil_id IN (pg_temp.id('med'), pg_temp.id('enf'))), 'UBS: o médico e o enfermeiro recebem o aviso do retorno');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ret', (r ->> 'id')::uuid FROM jsonb_array_elements(public.contrarreferencias_da_unidade(pg_temp.id('ubs'))) r;
SELECT pg_temp.ok((SELECT count(*) = 1 FROM v WHERE nome = 'ret'), 'UBS: um só retorno (o envio e o CNS apontam a mesma UBS)');
SELECT pg_temp.ok((SELECT r ->> 'situacao' = 'a_ver' AND (r ->> 'paciente_ubs_id')::uuid = pg_temp.v('pac_ubs') AND (r ->> 'tem_orientacao')::boolean
                     FROM jsonb_array_elements(public.contrarreferencias_da_unidade(pg_temp.id('ubs'))) r),
  'UBS: retorno "a ver", no cadastro da UBS, com orientação');
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((SELECT r ->> 'orientacao' LIKE 'Rever a técnica do espaçador%' AND r -> 'resumo' ->> 'cid' = 'J45.9'
                          AND r -> 'resumo' -> 'registro' ->> 'plano' = 'Alta com corticoide oral e espaçador'
                     FROM public.contrarreferencia_abrir(pg_temp.v('ret')) r), 'UBS: o enfermeiro abre o resumo e a orientação');
-- a agenda da UBS (o gestor configura a grade; a recepção marca pelo "Agendar retorno")
SELECT pg_temp.como('ges');
SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('med'),
  (SELECT jsonb_agg(jsonb_build_object('dia', d, 'periodo', 'manha', 'inicio', '07:00', 'fim', '12:00', 'duracao', 20)) FROM generate_series(0, 6) d));
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ag', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '08:00'), pg_temp.v('pac_ubs'),
  'consulta_programada', 'Retorno da UPA: asma');
SELECT pg_temp.ok(pg_temp.v('ag') IS NOT NULL, 'UBS: a recepção agenda o retorno do paciente');
RESET ROLE;
SELECT pg_temp.ok((SELECT situacao = 'visto' AND visto_por = pg_temp.id('enf') FROM public.contrarreferencias WHERE id = pg_temp.v('ret')),
  'o retorno fica "visto" por quem abriu');

ROLLBACK;
