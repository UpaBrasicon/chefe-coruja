-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270307000006_regulacao_origem_encerrada.sql (achado
-- P2-2 do A01; decisão do RT em 07/11/2026: A em S1 a S6). Tudo em transação
-- com ROLLBACK. O cenário é criado aqui.
--
-- A. porta, chegada antes da alta: a saída manual é recusada (S3); a chegada
--    fica "em trânsito" com a marca, avisa a origem e aparece no NIR da origem
--    (S2, S5), sem "a caminho" no NIR do destino; a alta por transferência
--    com a regulação conclui: realizada na hora da chegada, saída marcada pela
--    alta, autor = login (S1, S3, S4);
-- B. porta, alta antes da chegada: a alta marca a saída; a chegada grava
--    realizada direto (S1);
-- C. observação: finalizar_observacao("transferencia") conclui do mesmo jeito;
-- D. regulação de outro paciente nos detalhes da alta: recusada (S4);
-- E. consulta regulada: nada muda (chegada = realizada).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000a5e01'),
  ('upa',   '00000000-0000-4000-8000-0000000a5e02'),
  ('hosp',  '00000000-0000-4000-8000-0000000a5e03'),
  ('cent',  '00000000-0000-4000-8000-0000000a5e04'),
  ('porta', '00000000-0000-4000-8000-0000000a5e11'),
  ('obs',   '00000000-0000-4000-8000-0000000a5e12'),
  ('cm',    '00000000-0000-4000-8000-0000000a5e13'),
  ('med',   '00000000-0000-4000-8000-0000000a5e21'),  -- médico da UPA (porta e observação)
  ('medh',  '00000000-0000-4000-8000-0000000a5e22'),  -- médico do hospital (destino)
  ('pA',    '00000000-0000-4000-8000-0000000a5e31'), ('eA', '00000000-0000-4000-8000-0000000a5e41'), ('rA', '00000000-0000-4000-8000-0000000a5e51'),
  ('pB',    '00000000-0000-4000-8000-0000000a5e32'), ('eB', '00000000-0000-4000-8000-0000000a5e42'), ('rB', '00000000-0000-4000-8000-0000000a5e52'),
  ('pC',    '00000000-0000-4000-8000-0000000a5e33'), ('eC', '00000000-0000-4000-8000-0000000a5e43'), ('rC', '00000000-0000-4000-8000-0000000a5e53'),
  ('iC',    '00000000-0000-4000-8000-0000000a5e63'),
  ('pD',    '00000000-0000-4000-8000-0000000a5e34'), ('eD', '00000000-0000-4000-8000-0000000a5e44'),
  ('pE',    '00000000-0000-4000-8000-0000000a5e35'), ('eE', '00000000-0000-4000-8000-0000000a5e45'), ('rE', '00000000-0000-4000-8000-0000000a5e55');
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
CREATE FUNCTION pg_temp.reg(p text) RETURNS public.regulacao_solicitacoes LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.regulacao_solicitacoes WHERE id = pg_temp.id(p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.reg(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@regorigem.local' FROM ids WHERE nome IN ('med', 'medh');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'medh')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da origem encerrada');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA Origem do teste S', 'upa', '7654601'),
  (pg_temp.id('hosp'), pg_temp.id('org'), 'Hospital Destino do teste S', 'hospital', '7654602'),
  (pg_temp.id('cent'), pg_temp.id('org'), 'Central do teste S', 'hospital', NULL);
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação Adulto', 'observacao'),
  (pg_temp.id('cm'), pg_temp.id('hosp'), 'Clínica Médica', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medh'), pg_temp.id('hosp'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT x.u, x.s, x.p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('upa'), pg_temp.id('porta'), pg_temp.id('med')), (pg_temp.id('upa'), pg_temp.id('obs'), pg_temp.id('med')),
               (pg_temp.id('hosp'), pg_temp.id('cm'), pg_temp.id('medh'))) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('upa'), pg_temp.id('hosp')) ON CONFLICT DO NOTHING;

-- pacientes na porta (A, B, D, E) em atendimento com o SOAP feito; C na observação
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, setor_id)
SELECT pg_temp.id(p), pg_temp.id('upa'), 'Paciente S ' || p, '1960-01-01', 'M', pg_temp.id(CASE p WHEN 'pC' THEN 'obs' ELSE 'porta' END)
  FROM unnest(ARRAY['pA', 'pB', 'pC', 'pD', 'pE']) p;
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, atendimento_medico_id, atendimento_iniciado_em)
SELECT pg_temp.id('e' || right(p, 1)), pg_temp.id('upa'), pg_temp.id(p), pg_temp.id('porta'), CASE p WHEN 'pC' THEN 'observacao' ELSE 'atendimento' END,
       'Dor torácica', pg_temp.id('med'), now() - interval '5 hours', pg_temp.id('med'), now() - interval '5 hours'
  FROM unnest(ARRAY['pA', 'pB', 'pC', 'pD', 'pE']) p;
INSERT INTO public.atendimento_registros (episodio_id, unidade_id, paciente_id, subjetivo, avaliacao, cid, plano, autor_id)
SELECT pg_temp.id('e' || right(p, 1)), pg_temp.id('upa'), pg_temp.id(p), 'Dor torácica (teste)', 'Síndrome coronariana aguda', 'I21.9',
       'Transferir pela regulação', pg_temp.id('med')
  FROM unnest(ARRAY['pA', 'pB', 'pC', 'pD', 'pE']) p;
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, tipo_internacao, origem_admissao, setor_atual_id, data_admissao, episodio_id)
VALUES (pg_temp.id('iC'), pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pC'), 'em_observacao', 'observacao', 'emergencia',
        pg_temp.id('obs'), now() - interval '3 hours', pg_temp.id('eC'));
-- como o desfecho "observação" da porta deixa o episódio
UPDATE public.episodios SET desfecho = 'observacao', desfecho_em = now() - interval '3 hours', desfecho_por = pg_temp.id('med'),
       desfecho_detalhes = jsonb_build_object('internacao_id', pg_temp.id('iC'))
 WHERE id = pg_temp.id('eC');
INSERT INTO public.observacao_eventos (unidade_id, paciente_id, internacao_id, tipo, autor_id)
VALUES (pg_temp.id('upa'), pg_temp.id('pC'), pg_temp.id('iC'), 'atendimento', pg_temp.id('med'));

-- regulações já aceitas pelo destino (o caminho até aqui tem teste próprio)
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, episodio_id,
  internacao_id, tipo, procedimento, tipo_leito, transporte, especialidade, cbo, destino_tipo, destino_unidade_id, carater, modalidade,
  prioridade, cid, quadro_clinico, solicitante_id, solicitante_papel, status, autorizada_em)
SELECT pg_temp.id(x.r), pg_temp.id('org'), pg_temp.id('cent'), pg_temp.id('upa'), '7654601', pg_temp.id(x.p), pg_temp.id('e' || right(x.p, 1)),
       CASE x.p WHEN 'pC' THEN pg_temp.id('iC') END, x.tipo, '0303060190', x.leito, x.transp, x.esp, x.cbo, 'rede', pg_temp.id('hosp'),
       'urgencia', '04', 'urgencia', 'I21.9', 'Quadro clínico do pedido de teste da origem encerrada.', pg_temp.id('med'), 'medico',
       'autorizada', now() - interval '1 hour'
  FROM (VALUES ('rA', 'pA', 'transferencia', NULL, 'ambulancia_avancada', NULL, NULL),
               ('rB', 'pB', 'leito', 'clinico', NULL, NULL, NULL),
               ('rC', 'pC', 'transferencia', NULL, 'ambulancia_avancada', NULL, NULL),
               ('rE', 'pE', 'consulta', NULL, NULL, 'Cardiologia', '225120')) x(r, p, tipo, leito, transp, esp, cbo);

SET LOCAL ROLE authenticated;

-- ── A. chegada antes da alta ────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.regulacao_marcar_saida(%L)', pg_temp.id('rA')),
  'O paciente segue em atendimento na origem', 'S3: saída manual recusada com o paciente em atendimento na origem');
SELECT pg_temp.como('medh');
SELECT public.regulacao_marcar_chegada(pg_temp.id('rA'), true);
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'em_transito' AND chegada_em IS NOT NULL AND realizada_em IS NULL AND saida_em IS NULL
                     AND chegada_por = pg_temp.id('medh') FROM pg_temp.reg('rA')),
  'S2: chegou com a origem aberta: em trânsito, com a marca da chegada');
SELECT pg_temp.ok((private.regulacao_json(pg_temp.reg('rA')) ->> 'chegou_origem_aberta')::boolean, 'S2: o detalhe mostra "chegou, origem aberta"');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('med') AND tipo LIKE 'reg_chegou_origem_aberta_%'),
  'S5: o solicitante na origem é avisado');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM private.nir_itens(pg_temp.id('upa')) n WHERE n.tipo = 'reg_origem_aberta' AND n.ref_id = pg_temp.id('rA')),
  'S5: item no NIR da origem');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM private.nir_itens(pg_temp.id('hosp')) n WHERE n.tipo = 'reg_chegada' AND n.ref_id = pg_temp.id('rA')),
  'no NIR do destino não aparece "a caminho sem chegada"');
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha(format('SELECT public.regulacao_marcar_chegada(%L, true)', pg_temp.id('rA')),
  'A chegada deste paciente já foi registrada', 'a chegada não é registrada duas vezes');
SELECT pg_temp.como('med');
SELECT pg_temp.ok((SELECT (x ->> 'chegou_origem_aberta')::boolean FROM jsonb_array_elements(public.regulacao_historico_paciente(pg_temp.id('pA'))) x
                    WHERE x ->> 'id' = pg_temp.id('rA')::text), 'o histórico do paciente mostra a marca');
SELECT public.registrar_desfecho(pg_temp.id('eA'), 'transferencia', 'Transferido pela regulação',
  jsonb_build_object('destino', 'Hospital Destino do teste S', 'regulacao_id', pg_temp.id('rA')));
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'realizada' AND realizada_em = chegada_em AND saida_em IS NOT NULL AND saida_por = pg_temp.id('med')
                     AND origem_encerrada_em IS NOT NULL FROM pg_temp.reg('rA')),
  'S1/S3: com a alta por transferência, realizada na hora da chegada e saída marcada pela alta (autor = login)');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM private.nir_itens(pg_temp.id('upa')) n WHERE n.ref_id = pg_temp.id('rA')), 'S5: o item do NIR some');
SELECT pg_temp.ok((SELECT desfecho_detalhes ->> 'regulacao_id' = pg_temp.id('rA')::text FROM public.episodios WHERE id = pg_temp.id('eA')),
  'S4: a alta grava a regulação');
SET LOCAL ROLE authenticated;

-- ── B. alta antes da chegada ────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT public.registrar_desfecho(pg_temp.id('eB'), 'transferencia', 'Transferido pela regulação',
  jsonb_build_object('destino', 'Hospital Destino do teste S', 'regulacao_id', pg_temp.id('rB')));
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'em_transito' AND saida_em IS NOT NULL AND origem_encerrada_em IS NOT NULL AND chegada_em IS NULL FROM pg_temp.reg('rB')),
  'S3: a alta por transferência marca a saída');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('medh');
SELECT public.regulacao_marcar_chegada(pg_temp.id('rB'), true);
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'realizada' AND realizada_em = chegada_em FROM pg_temp.reg('rB')), 'S1: origem já encerrada: a chegada grava realizada');
SET LOCAL ROLE authenticated;

-- ── C. observação ───────────────────────────────────────────────────────────
SELECT pg_temp.como('medh');
SELECT public.regulacao_marcar_chegada(pg_temp.id('rC'), true);
SELECT pg_temp.como('med');
SELECT public.finalizar_observacao(pg_temp.id('iC'), 'transferencia', 'I21.9', 'Transferido pela regulação',
  jsonb_build_object('destino', 'Hospital Destino do teste S', 'regulacao_id', pg_temp.id('rC')));
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'realizada' AND realizada_em = chegada_em AND saida_em IS NOT NULL FROM pg_temp.reg('rC')),
  'S1: a alta por transferência da observação conclui a regulação');
SET LOCAL ROLE authenticated;

-- ── D. regulação de outro paciente ──────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L)', pg_temp.id('eD'), 'transferencia', 'Transferido',
    jsonb_build_object('destino', 'Hospital Destino do teste S', 'regulacao_id', pg_temp.id('rE'))),
  'A regulação escolhida não é deste paciente', 'S4: a regulação de outro paciente é recusada');

-- ── E. consulta: nada muda ──────────────────────────────────────────────────
SELECT pg_temp.como('medh');
SELECT public.regulacao_marcar_chegada(pg_temp.id('rE'), true);
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'realizada' FROM pg_temp.reg('rE')), 'consulta regulada: a chegada grava realizada, como antes');
ROLLBACK;
