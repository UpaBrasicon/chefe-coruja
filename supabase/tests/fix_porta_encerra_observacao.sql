-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270305000001_porta_encerra_observacao.sql (achado P1-2
-- do teste de rede A01, passo A01R.24.porta_finaliza; decisão do RT em
-- 06/11/2026: "Sim, deve poder"). Tudo em transação com ROLLBACK. O cenário é
-- criado aqui.
--
-- O médico da porta que pôs o paciente em observação encerra a observação
-- (finalizar_observacao) sem estar escalado no setor da observação, desde que:
-- seja o autor do desfecho "observação" do episódio, tenha o papel plantonista
-- na unidade, esteja de plantão agora na mesma unidade e o paciente siga em
-- observação. Só o encerramento: as outras ações continuam com a escala.
--
-- 1. ok: o autor encerra com alta, com transferência e com internação;
-- 2. recusado: outro médico da porta; o autor fora do plantão; o autor que
--    agora é enfermeiro; o autor numa observação de outra unidade;
-- 3. continua ok: a equipe escalada na observação;
-- 4. continua recusado: o autor em outras ações (atender, evoluir, dar_alta e
--    registrar_evento_adt chamados direto), mesmo com a marca de encerramento;
-- 5. auditoria: alta, evento ADT e log com o autor = login.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-0000000a0e01'),
  ('upa',    '00000000-0000-4000-8000-0000000a0e02'),
  ('upa2',   '00000000-0000-4000-8000-0000000a0e03'),
  ('porta',  '00000000-0000-4000-8000-0000000a0e11'),
  ('obs',    '00000000-0000-4000-8000-0000000a0e12'),
  ('cm',     '00000000-0000-4000-8000-0000000a0e13'),
  ('porta2', '00000000-0000-4000-8000-0000000a0e14'),
  ('obs2',   '00000000-0000-4000-8000-0000000a0e15'),
  ('med',    '00000000-0000-4000-8000-0000000a0e21'),  -- autor: de plantão na porta
  ('med2',   '00000000-0000-4000-8000-0000000a0e22'),  -- outro médico da porta
  ('medobs', '00000000-0000-4000-8000-0000000a0e23'),  -- médico escalado na observação
  ('medfora','00000000-0000-4000-8000-0000000a0e24'),  -- autor que sai do plantão
  ('medenf', '00000000-0000-4000-8000-0000000a0e25'),  -- autor que passa a enfermeiro
  ('medab',  '00000000-0000-4000-8000-0000000a0e26'),  -- autor na UPA 2, de plantão na UPA 1
  ('rec',    '00000000-0000-4000-8000-0000000a0e27'),
  ('rec2',   '00000000-0000-4000-8000-0000000a0e28');
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
-- a ficha chega, o médico atende na porta e põe em observação (desfecho da porta)
CREATE FUNCTION pg_temp.observar(p_nome text, p_medico text, p_rec text, p_porta text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_ep uuid;
BEGIN
  PERFORM pg_temp.como(p_rec);
  SET LOCAL ROLE authenticated;
  v_ep := (public.registrar_ficha(pg_temp.id(p_porta), 'Dor abdominal', NULL,
    json_build_object('nome', 'Paciente Obs ' || upper(p_nome), 'data_nascimento', '1980-01-01')::jsonb) ->> 'episodio_id')::uuid;
  RESET ROLE;
  -- a classificação de risco não é o assunto daqui: o paciente vai direto ao médico
  UPDATE public.episodios SET etapa = 'atendimento' WHERE id = v_ep;
  PERFORM pg_temp.como(p_medico);
  SET LOCAL ROLE authenticated;
  PERFORM public.iniciar_atendimento(v_ep);
  PERFORM public.registrar_soap(v_ep, 'Dor abdominal há 6 horas', 'Abdome doloroso, sem peritonite',
    'Dor abdominal a esclarecer', 'Observação com analgesia e reavaliação', 'R60');
  PERFORM public.registrar_desfecho(v_ep, 'observacao');
  RESET ROLE;
  INSERT INTO v VALUES ('e' || p_nome, v_ep);
  INSERT INTO v SELECT 'i' || p_nome, id FROM public.internacoes WHERE episodio_id = v_ep;
END $$;

INSERT INTO auth.users (id, email) SELECT id, nome || '@fixobs.local' FROM ids WHERE nome LIKE 'med%' OR nome LIKE 'rec%';
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome LIKE 'med%' OR nome LIKE 'rec%'
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do fix da observação');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA Um do fix', 'upa'),
  (pg_temp.id('upa2'), pg_temp.id('org'), 'UPA Dois do fix', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação Adulto', 'observacao'),
  (pg_temp.id('cm'), pg_temp.id('upa'), 'Clínica Médica', 'internacao'),
  (pg_temp.id('porta2'), pg_temp.id('upa2'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('obs2'), pg_temp.id('upa2'), 'Observação Adulto', 'observacao');
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT pg_temp.id('obs'), 'OA-0' || n, 'observacao'::public.tipo_leito FROM generate_series(1, 7) n
UNION ALL SELECT pg_temp.id('obs2'), 'OA-01', 'observacao'::public.tipo_leito;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('med2'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('medobs'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medfora'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('medenf'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medab'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('medab'), pg_temp.id('upa2'), 'plantonista'),
  (pg_temp.id('rec'), pg_temp.id('upa'), 'recepcao'), (pg_temp.id('rec2'), pg_temp.id('upa2'), 'recepcao');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id(u), pg_temp.id(s), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES ('upa', 'porta', 'med'), ('upa', 'porta', 'med2'), ('upa', 'obs', 'medobs'), ('upa', 'porta', 'medfora'),
               ('upa', 'porta', 'medenf'), ('upa', 'porta', 'medab'), ('upa2', 'porta2', 'medab'),
               ('upa', 'porta', 'rec'), ('upa2', 'porta2', 'rec2')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('upa'), pg_temp.id('upa2')) ON CONFLICT DO NOTHING;

-- ── observações abertas pela porta ──────────────────────────────────────────
SELECT pg_temp.observar(x, 'med', 'rec', 'porta') FROM unnest(ARRAY['a', 'b', 'c', 'd']) x;
SELECT pg_temp.observar('f', 'medfora', 'rec', 'porta');
SELECT pg_temp.observar('g', 'medenf', 'rec', 'porta');
SELECT pg_temp.observar('x', 'medab', 'rec2', 'porta2');
SELECT pg_temp.ok((SELECT count(*) = 7 FROM public.internacoes i
                    WHERE i.id IN (SELECT id FROM v WHERE nome LIKE 'i%') AND i.status = 'em_observacao'
                      AND i.setor_atual_id IN (pg_temp.id('obs'), pg_temp.id('obs2'))),
  'cenário: sete pacientes na observação, postos pela porta');

-- o autor sai do plantão; o outro autor passa a enfermeiro; o terceiro sai do plantão da UPA 2
UPDATE public.escala_plantao SET ativo = false WHERE perfil_id = pg_temp.id('medfora');
UPDATE public.vinculos SET papel = 'enfermeiro' WHERE perfil_id = pg_temp.id('medenf') AND unidade_id = pg_temp.id('upa');
UPDATE public.escala_plantao SET ativo = false WHERE perfil_id = pg_temp.id('medab') AND unidade_id = pg_temp.id('upa2');

SET LOCAL ROLE authenticated;

-- ── 2. recusados ────────────────────────────────────────────────────────────
SELECT pg_temp.como('med2');
SELECT pg_temp.falha($$SELECT public.finalizar_observacao(pg_temp.v('ia'), 'alta_medica', 'R60')$$,
  'Acesso negado', 'outro médico da porta, que não abriu a observação, não encerra');
-- a marca de encerramento sozinha não abre nada para quem não é o autor
SELECT set_config('cc.encerra_observacao', pg_temp.v('ia')::text, true);
SELECT pg_temp.falha($$SELECT public.dar_alta(pg_temp.v('ia'), 'alta_melhorada', 'R60')$$,
  'Acesso negado', 'outro médico com a marca de encerramento forjada: dar_alta recusado');
SELECT set_config('cc.encerra_observacao', '', true);
SELECT pg_temp.como('medfora');
SELECT pg_temp.falha($$SELECT public.finalizar_observacao(pg_temp.v('if'), 'alta_medica', 'R60')$$,
  'Acesso negado', 'o autor fora do plantão não encerra');
SELECT pg_temp.como('medenf');
SELECT pg_temp.falha($$SELECT public.finalizar_observacao(pg_temp.v('ig'), 'alta_medica', 'R60')$$,
  'Acesso negado', 'o autor que agora é enfermeiro não encerra');
SELECT pg_temp.como('medab');
SELECT pg_temp.falha($$SELECT public.finalizar_observacao(pg_temp.v('ix'), 'alta_medica', 'R60')$$,
  'Acesso negado', 'o autor de plantão em outra unidade não encerra a observação da UPA 2');

-- ── 4. o autor continua sem as outras ações da observação ───────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.falha($$SELECT public.observacao_atender(pg_temp.v('ia'))$$,
  'Acesso negado', 'o autor não atende na observação (observacao_para_mim segue pela escala)');
SELECT pg_temp.falha($$SELECT public.registrar_evolucao(pg_temp.v('ia'), 'evolucao', 'Evolução na observação: dor estável.')$$,
  'Acesso negado', 'o autor não evolui na observação');
SELECT pg_temp.falha($$SELECT public.dar_alta(pg_temp.v('ia'), 'alta_melhorada', 'R60')$$,
  'Acesso negado', 'o autor não dá alta pelo dar_alta direto, fora do encerramento');
SELECT pg_temp.falha($$SELECT public.registrar_evento_adt(pg_temp.v('ia'), 'transferencia', pg_temp.id('cm'))$$,
  'Acesso negado', 'o autor não move o paciente pelo registrar_evento_adt direto');
-- a marca de encerramento não abre as ações que não passam por dar_alta/registrar_evento_adt
SELECT set_config('cc.encerra_observacao', pg_temp.v('ia')::text, true);
SELECT pg_temp.falha($$SELECT public.observacao_atender(pg_temp.v('ia'))$$,
  'Acesso negado', 'com a marca de encerramento, o autor ainda não atende na observação');
SELECT pg_temp.falha($$SELECT public.registrar_evolucao(pg_temp.v('ia'), 'evolucao', 'Evolução na observação: dor estável.')$$,
  'Acesso negado', 'com a marca de encerramento, o autor ainda não evolui');
SELECT set_config('cc.encerra_observacao', '', true);

-- ── 1. o autor encerra: alta, transferência e internação ───────────────────
SELECT public.finalizar_observacao(pg_temp.v('ia'), 'alta_medica', 'R60', 'Dor controlada, sem sinais de alarme.');
SELECT pg_temp.ok(coalesce(current_setting('cc.encerra_observacao', true), '') = '', 'a marca de encerramento sai ao fim do encerramento');
SELECT public.finalizar_observacao(pg_temp.v('ib'), 'transferencia', 'R60', NULL, '{"destino":"Hospital de Referência"}');
SELECT public.finalizar_observacao(pg_temp.v('ic'), 'internacao', NULL, NULL,
  json_build_object('setor_id', pg_temp.id('cm'))::jsonb);
-- depois da internação o paciente não está mais na observação: o autor não age nele
SELECT pg_temp.falha($$SELECT public.registrar_evolucao(pg_temp.v('ic'), 'evolucao', 'Evolução na clínica médica: estável.')$$,
  'Acesso negado', 'internado na Clínica Médica, o autor da observação não evolui');
SELECT pg_temp.falha($$SELECT public.finalizar_observacao(pg_temp.v('ia'), 'alta_medica', 'R60')$$,
  'O paciente não está na observação', 'observação encerrada não se encerra de novo');

-- ── 3. a equipe escalada na observação continua encerrando ─────────────────
SELECT pg_temp.como('medobs');
SELECT public.finalizar_observacao(pg_temp.v('id'), 'alta_medica', 'R60');
RESET ROLE;

SELECT pg_temp.ok((SELECT status = 'alta_melhorada' AND alta_por = pg_temp.id('med') AND alta_detalhes ->> 'desfecho_observacao' = 'alta_medica'
                     FROM public.internacoes WHERE id = pg_temp.v('ia')),
  'o autor encerra com alta, e a alta fica no nome dele');
SELECT pg_temp.ok((SELECT status = 'transferencia_externa' AND alta_por = pg_temp.id('med') AND alta_detalhes ->> 'destino' = 'Hospital de Referência'
                     FROM public.internacoes WHERE id = pg_temp.v('ib')),
  'o autor encerra com transferência, com o destino');
SELECT pg_temp.ok((SELECT status = 'internado' AND setor_atual_id = pg_temp.id('cm') FROM public.internacoes WHERE id = pg_temp.v('ic'))
                  AND (SELECT setor_id = pg_temp.id('cm') FROM public.pacientes WHERE id = (SELECT paciente_id FROM public.internacoes WHERE id = pg_temp.v('ic'))),
  'o autor encerra com internação, e o paciente vai à Clínica Médica');
SELECT pg_temp.ok((SELECT status = 'alta_melhorada' AND alta_por = pg_temp.id('medobs') FROM public.internacoes WHERE id = pg_temp.v('id')),
  'a equipe escalada na observação continua encerrando');
SELECT pg_temp.ok((SELECT count(*) = 3 FROM public.internacoes
                    WHERE id IN (pg_temp.v('if'), pg_temp.v('ig'), pg_temp.v('ix')) AND status = 'em_observacao'),
  'as recusadas seguem em observação');

-- ── 5. auditoria: o autor = login ───────────────────────────────────────────
SELECT pg_temp.ok((SELECT tipo_evento = 'alta_melhorada' AND autor_id = pg_temp.id('med') FROM public.eventos_adt
                    WHERE internacao_id = pg_temp.v('ia') ORDER BY seq DESC LIMIT 1)
                  AND (SELECT tipo_evento = 'transferencia_externa' AND autor_id = pg_temp.id('med') FROM public.eventos_adt
                    WHERE internacao_id = pg_temp.v('ib') ORDER BY seq DESC LIMIT 1)
                  AND (SELECT tipo_evento = 'internacao' AND autor_id = pg_temp.id('med') AND setor_destino_id = pg_temp.id('cm')
                         FROM public.eventos_adt WHERE internacao_id = pg_temp.v('ic') ORDER BY seq DESC LIMIT 1),
  'o evento ADT de cada encerramento leva o autor = login');
SELECT pg_temp.ok((SELECT count(*) = 3 FROM public.log_auditoria
                    WHERE acao = 'internacao_status' AND ator_id = pg_temp.id('med')
                      AND entidade_id IN (pg_temp.v('ia'), pg_temp.v('ib'), pg_temp.v('ic'))),
  'o log de auditoria da mudança de status leva o autor = login');
SELECT pg_temp.ok((SELECT criado_por = pg_temp.id('med') FROM public.alta_paciente
                    WHERE criterios ->> 'internacao_id' = pg_temp.v('ia')::text),
  'o registro de alta do paciente leva o autor = login');

-- ── permissões: a auxiliar nova é fechada ───────────────────────────────────
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', 'private.abriu_a_observacao(public.internacoes)', 'EXECUTE')
                  AND NOT has_function_privilege('anon', 'private.abriu_a_observacao(public.internacoes)', 'EXECUTE')
                  AND NOT has_function_privilege('authenticated', 'private.encerrando_observacao_que_abri(public.internacoes)', 'EXECUTE'),
  'as auxiliares privadas não são executáveis pelo cliente');

ROLLBACK;
