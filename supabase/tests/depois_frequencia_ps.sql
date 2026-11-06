-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270301000001_frequencia_prescricao_ps.sql (frequência
-- com horário na prescrição do PS; decisão do RT: A em F1 a F6). Tudo em
-- transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. F1: porta aceita 8/8h, Agora, Se necessário e Contínuo; recusa "de manhã",
--    também pela alteração do item; o leito segue com texto livre;
-- 2. F2: o painel da porta devolve os horários e as doses por horário
--    (atrasada, pendente, feita) e continua com a última checagem;
-- 3. F3: alta após medicação barrada com horário vencido sem checagem e
--    liberada depois da checagem; "não feito" com motivo também libera;
-- 4. F5: o 2º "feito" de item "Agora" é recusado;
-- 5. F4: prescricao_porta_ativa lista o item da porta de quem foi para a
--    observação; outra unidade não lê; quem está só na porta não tem lista;
-- 6. F6: horarios_dos_itens devolve o aprazamento.
-- O relógio da transação é fixo (now()): o item é "prescrito" 5 horas antes e
-- o primeiro horário fica 3 horas antes de agora.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000072a1'),
  ('upa',   '00000000-0000-4000-8000-0000000072a2'),
  ('outra', '00000000-0000-4000-8000-0000000072a3'),
  ('porta', '00000000-0000-4000-8000-0000000072a4'),
  ('obs',   '00000000-0000-4000-8000-0000000072a5'),
  ('porta2','00000000-0000-4000-8000-0000000072a6'),
  ('med',   '00000000-0000-4000-8000-0000000072b1'),
  ('enf',   '00000000-0000-4000-8000-0000000072b2'),
  ('medx',  '00000000-0000-4000-8000-0000000072b3'),
  ('pac1',  '00000000-0000-4000-8000-0000000072c1'),
  ('ep1',   '00000000-0000-4000-8000-0000000072c2'),
  ('pac2',  '00000000-0000-4000-8000-0000000072c3'),
  ('ep2',   '00000000-0000-4000-8000-0000000072c4'),
  ('int2',  '00000000-0000-4000-8000-0000000072c5'),
  ('dipi',  '00000000-0000-4000-8000-0000000072d1'),
  ('ondan', '00000000-0000-4000-8000-0000000072d2'),
  ('cefa',  '00000000-0000-4000-8000-0000000072d3'),
  ('omep',  '00000000-0000-4000-8000-0000000072d4'),
  ('hidro', '00000000-0000-4000-8000-0000000072d5'),
  ('soro',  '00000000-0000-4000-8000-0000000072d6');
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
-- horário HH:MM de Brasília a "agora + n horas"
CREATE FUNCTION pg_temp.h(n int) RETURNS text LANGUAGE sql AS $$
  SELECT to_char((now() + make_interval(hours => n)) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') $$;
GRANT EXECUTE ON FUNCTION pg_temp.h(int) TO authenticated;
-- o item do painel do episódio
CREATE FUNCTION pg_temp.item_painel(p_ep uuid, p_item uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT x FROM jsonb_array_elements(public.painel_atendimento_ps(p_ep) -> 'prescricao') x WHERE (x ->> 'id')::uuid = p_item $$;
GRANT EXECUTE ON FUNCTION pg_temp.item_painel(uuid, uuid) TO authenticated;
-- prescrito há 5 horas (o relógio da transação não anda)
CREATE FUNCTION pg_temp.prescrito_antes(p_item uuid) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.prescricao_itens SET created_at = now() - interval '5 hours' WHERE id = p_item $$;
GRANT EXECUTE ON FUNCTION pg_temp.prescrito_antes(uuid) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@freqps.local' FROM ids WHERE nome IN ('med', 'enf', 'medx');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf', 'medx')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da frequência');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA da frequência', 'upa'),
  (pg_temp.id('outra'), pg_temp.id('org'), 'UPA vizinha da frequência', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação', 'observacao'),
  (pg_temp.id('porta2'), pg_temp.id('outra'), 'Pronto-socorro vizinho', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('enf'), pg_temp.id('upa'), 'enfermeiro'),
  (pg_temp.id('medx'), pg_temp.id('outra'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT u, s, pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('upa'), pg_temp.id('porta'), 'med'), (pg_temp.id('upa'), pg_temp.id('obs'), 'med'),
               (pg_temp.id('upa'), pg_temp.id('porta'), 'enf'), (pg_temp.id('upa'), pg_temp.id('obs'), 'enf'),
               (pg_temp.id('outra'), pg_temp.id('porta2'), 'medx')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('upa'), pg_temp.id('outra')) ON CONFLICT DO NOTHING;

INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  (pg_temp.id('dipi'), 'Dipirona freq', 'dipirona freq', 'solução injetável 500 mg/mL (teste freq)', 'teste-freq'),
  (pg_temp.id('ondan'), 'Ondansetrona freq', 'ondansetrona freq', 'solução injetável 2 mg/mL (teste freq)', 'teste-freq'),
  (pg_temp.id('cefa'), 'Cefalexina freq', 'cefalexina freq', 'cápsula 500 mg (teste freq)', 'teste-freq'),
  (pg_temp.id('omep'), 'Omeprazol freq', 'omeprazol freq', 'pó para solução injetável 40 mg (teste freq)', 'teste-freq'),
  (pg_temp.id('hidro'), 'Hidrocortisona freq', 'hidrocortisona freq', 'pó para solução injetável 100 mg (teste freq)', 'teste-freq'),
  (pg_temp.id('soro'), 'Cloreto de sódio freq', 'cloreto de sodio freq', 'solução 0,9% 500 mL (teste freq)', 'teste-freq');

-- dois pacientes adultos na porta, em atendimento com o médico, pesados agora
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, setor_id) VALUES
  (pg_temp.id('pac1'), pg_temp.id('upa'), 'Paciente Frequência Um', '1980-01-01', 'F', pg_temp.id('porta')),
  (pg_temp.id('pac2'), pg_temp.id('upa'), 'Paciente Frequência Dois', '1975-05-05', 'M', pg_temp.id('porta'));
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em,
                              atendimento_medico_id, atendimento_iniciado_em)
VALUES (pg_temp.id('ep1'), pg_temp.id('upa'), pg_temp.id('pac1'), pg_temp.id('porta'), 'atendimento', 'Dor abdominal', pg_temp.id('med'),
        now() - interval '6 hours', pg_temp.id('med'), now() - interval '6 hours'),
       (pg_temp.id('ep2'), pg_temp.id('upa'), pg_temp.id('pac2'), pg_temp.id('porta'), 'atendimento', 'Pneumonia', pg_temp.id('med'),
        now() - interval '6 hours', pg_temp.id('med'), now() - interval '6 hours');
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT pg_temp.id('upa'), p, c.id, now(), 70, 'manual'
  FROM unnest(ARRAY[pg_temp.id('pac1'), pg_temp.id('pac2')]) p, public.conceito c WHERE c.nome = 'peso' AND c.unidade_id IS NULL;
-- o médico abriu o prontuário (o painel da porta pede)
INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, acessado_por, tipo_acesso)
VALUES (pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac1'), pg_temp.id('med'), 'leitura_prontuario');

SET LOCAL ROLE authenticated;

-- ── 1. F1: frequência na porta ──────────────────────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO v SELECT 'cefa8', public.prescrever(pg_temp.id('pac1'), json_build_object('medicamento_id', pg_temp.id('cefa'),
  'dose', '500 mg', 'via', 'VO', 'posologia', '8/8h')::jsonb);
SELECT pg_temp.ok(pg_temp.v('cefa8') IS NOT NULL, 'porta aceita 8/8h');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.id('pac1'), json_build_object('medicamento_id', pg_temp.id('omep'),
  'dose', '40 mg', 'via', 'EV', 'posologia', 'de manhã')),
  'Frequência não reconhecida: use Agora, Se necessário ou um intervalo como 8/8h.', 'porta recusa "de manhã"');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.id('pac1'), json_build_object('medicamento_id', pg_temp.id('omep'),
  'dose', '40 mg', 'via', 'EV', 'posologia', 'Se necessário', 'se_necessario', false)),
  'Frequência não reconhecida', 'porta recusa "Se necessário" sem a marca de se necessário');
INSERT INTO v SELECT 'dipi_agora', public.prescrever(pg_temp.id('pac1'), json_build_object('medicamento_id', pg_temp.id('dipi'),
  'dose', '1 g', 'via', 'EV', 'posologia', 'Agora')::jsonb);
INSERT INTO v SELECT 'ondan_sn', public.prescrever(pg_temp.id('pac1'), json_build_object('medicamento_id', pg_temp.id('ondan'),
  'dose', '4 mg', 'via', 'EV', 'posologia', 'Se necessário', 'se_necessario', true)::jsonb);
INSERT INTO v SELECT 'soro_cont', public.prescrever(pg_temp.id('pac1'), json_build_object('medicamento_id', pg_temp.id('soro'),
  'dose', '500 mL', 'via', 'EV', 'posologia', 'contínuo')::jsonb);
SELECT pg_temp.ok(pg_temp.v('dipi_agora') IS NOT NULL AND pg_temp.v('ondan_sn') IS NOT NULL AND pg_temp.v('soro_cont') IS NOT NULL,
  'porta aceita Agora, Se necessário e Contínuo');
-- a alteração passa pela mesma regra (a nova versão é gravada por prescrever)
SELECT pg_temp.falha(format('SELECT public.alterar_item_prescricao(%L, %L, %L)', pg_temp.v('soro_cont'), '{"posologia":"de manhã"}', 'Trocar a frequência'),
  'Frequência não reconhecida', 'alterar item da porta para "de manhã" é recusado');
RESET ROLE;
SELECT pg_temp.ok((SELECT suspenso_em IS NULL FROM public.prescricao_itens WHERE id = pg_temp.v('soro_cont')),
  'alteração recusada não suspende o item');
SET LOCAL ROLE authenticated;

-- ── 2. F2: doses por horário no painel ──────────────────────────────────────
SELECT pg_temp.prescrito_antes(pg_temp.v('cefa8'));
SELECT pg_temp.como('enf');
-- 8/8h: o primeiro horário 3 horas antes de agora; os outros 5 e 13 horas depois
SELECT public.aprazar(pg_temp.v('cefa8'), ARRAY[pg_temp.h(-3), pg_temp.h(5), pg_temp.h(13)]);
SELECT pg_temp.como('med');
SELECT pg_temp.ok((SELECT jsonb_array_length(x -> 'horarios') = 3 AND x ? 'checagem' FROM pg_temp.item_painel(pg_temp.id('ep1'), pg_temp.v('cefa8')) x),
  'painel devolve os horários e mantém a checagem');
SELECT pg_temp.ok((SELECT count(*) FILTER (WHERE d ->> 'situacao' = 'atrasada') = 1
                      AND count(*) FILTER (WHERE d ->> 'situacao' = 'atrasada' AND d ->> 'horario' = pg_temp.h(-3)) = 1
                      AND count(*) FILTER (WHERE d ->> 'situacao' = 'pendente' AND d ->> 'horario' IN (pg_temp.h(5), pg_temp.h(13))) = 2
                     FROM jsonb_array_elements((pg_temp.item_painel(pg_temp.id('ep1'), pg_temp.v('cefa8'))) -> 'doses') d),
  'painel: horário vencido atrasado, os próximos pendentes');

-- ── 3. F3: alta após medicação ──────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT public.checar(pg_temp.v('dipi_agora'), 'feito');
SELECT public.checar(pg_temp.v('soro_cont'), 'feito');
RESET ROLE;
SELECT pg_temp.ok(private.medicacao_sem_checagem(pg_temp.id('ep1')) = ARRAY['Cefalexina freq cápsula 500 mg (teste freq)'],
  'só o 8/8h com horário vencido falta');
SELECT pg_temp.falha(format('UPDATE public.episodios SET desfecho = %L, desfecho_em = now() WHERE id = %L', 'alta_apos_medicacao', pg_temp.id('ep1')),
  'Alta após medicação: falta a enfermagem checar', 'alta barrada com horário vencido sem checagem');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT public.checar(pg_temp.v('cefa8'), 'feito', pg_temp.h(-3));
SELECT pg_temp.como('med');
SELECT pg_temp.ok((SELECT count(*) FILTER (WHERE d ->> 'situacao' = 'feito' AND d ->> 'por' = 'Pessoa enf') = 1
                      AND count(*) FILTER (WHERE d ->> 'situacao' = 'atrasada') = 0
                     FROM jsonb_array_elements((pg_temp.item_painel(pg_temp.id('ep1'), pg_temp.v('cefa8'))) -> 'doses') d),
  'painel: o horário checado aparece feito, com quem checou');
RESET ROLE;
SELECT pg_temp.ok(cardinality(private.medicacao_sem_checagem(pg_temp.id('ep1'))) = 0, 'nada falta depois da checagem');
UPDATE public.episodios SET desfecho = 'alta_apos_medicacao', desfecho_em = now() WHERE id = pg_temp.id('ep1');
SELECT pg_temp.ok((SELECT desfecho = 'alta_apos_medicacao' FROM public.episodios WHERE id = pg_temp.id('ep1')),
  'alta após medicação liberada depois da checagem');
UPDATE public.episodios SET desfecho = NULL, desfecho_em = NULL WHERE id = pg_temp.id('ep1');
-- "não feito" com motivo também resolve o horário vencido
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
INSERT INTO v SELECT 'hidro6', public.prescrever(pg_temp.id('pac1'), json_build_object('medicamento_id', pg_temp.id('hidro'),
  'dose', '100 mg', 'via', 'EV', 'posologia', 'a cada 6 horas')::jsonb);
SELECT pg_temp.prescrito_antes(pg_temp.v('hidro6'));
SELECT pg_temp.como('enf');
SELECT public.aprazar(pg_temp.v('hidro6'), ARRAY[pg_temp.h(-2), pg_temp.h(4), pg_temp.h(10), pg_temp.h(16)]);
RESET ROLE;
SELECT pg_temp.ok(private.medicacao_sem_checagem(pg_temp.id('ep1')) = ARRAY['Hidrocortisona freq pó para solução injetável 100 mg (teste freq)'],
  'o 6/6h com horário vencido falta');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT public.checar(pg_temp.v('hidro6'), 'recusado', pg_temp.h(-2), 'Paciente recusou');
RESET ROLE;
SELECT pg_temp.ok(cardinality(private.medicacao_sem_checagem(pg_temp.id('ep1'))) = 1, 'recusado não resolve o horário vencido');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT public.checar(pg_temp.v('hidro6'), 'nao_feito', pg_temp.h(-2), 'Sem acesso venoso no horário');
RESET ROLE;
SELECT pg_temp.ok(cardinality(private.medicacao_sem_checagem(pg_temp.id('ep1'))) = 0, '"não feito" com motivo resolve o horário vencido');
SET LOCAL ROLE authenticated;

-- ── 4. F5: "Agora" é dose única ─────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.v('dipi_agora'), 'feito'),
  'Item "Agora" é dose única e já foi feito.', 'checar recusa o 2º feito de "Agora"');
SELECT public.checar(pg_temp.v('soro_cont'), 'feito');
SELECT pg_temp.ok(true, 'item contínuo aceita outro feito');

-- ── 5. F4: itens da porta no leito ──────────────────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO v SELECT 'porta8', public.prescrever(pg_temp.id('pac2'), json_build_object('medicamento_id', pg_temp.id('cefa'),
  'dose', '500 mg', 'via', 'VO', 'posologia', '8/8h')::jsonb);
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.prescricao_porta_ativa(pg_temp.id('pac2'))), 'na porta, sem lista "Vindos da porta"');
RESET ROLE;
-- conversão para a observação (o desfecho completo não é o assunto daqui)
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, tipo_internacao, origem_admissao,
                                setor_atual_id, data_admissao, episodio_id)
VALUES (pg_temp.id('int2'), pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac2'), 'em_observacao', 'observacao', 'emergencia',
        pg_temp.id('obs'), now() - interval '1 hour', pg_temp.id('ep2'));
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
-- o leito segue com o texto livre
INSERT INTO v SELECT 'leito_livre', public.prescrever(pg_temp.id('pac2'), json_build_object('medicamento_id', pg_temp.id('omep'),
  'dose', '40 mg', 'via', 'EV', 'posologia', 'de manhã')::jsonb);
RESET ROLE;
SELECT pg_temp.ok((SELECT pr.internacao_id = pg_temp.id('int2') FROM public.prescricao_itens it JOIN public.prescricoes pr ON pr.id = it.prescricao_id
                    WHERE it.id = pg_temp.v('leito_livre')), 'leito aceita texto livre ("de manhã") na prescrição da observação');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok((SELECT count(*) = 1 AND bool_and(p.id = pg_temp.v('porta8') AND p.posologia = '8/8h' AND p.episodio_id = pg_temp.id('ep2'))
                     FROM public.prescricao_porta_ativa(pg_temp.id('pac2')) p),
  'prescricao_porta_ativa lista o item da porta de quem está na observação');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.prescricao_vigente(pg_temp.id('pac2')) p WHERE p.id = pg_temp.v('leito_livre'))
                  AND (SELECT count(*) = 0 FROM public.prescricao_vigente(pg_temp.id('pac2')) p WHERE p.id = pg_temp.v('porta8')),
  'prescricao_vigente continua só com o leito');
SELECT pg_temp.como('medx');
SELECT pg_temp.falha(format('SELECT * FROM public.prescricao_porta_ativa(%L)', pg_temp.id('pac2')), 'Acesso negado.',
  'outra unidade não lê os itens da porta');
-- o médico do leito suspende o item da porta: sai da lista
SELECT pg_temp.como('med');
SELECT public.suspender_item(pg_temp.v('porta8'), 'Troca para via venosa no leito');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.prescricao_porta_ativa(pg_temp.id('pac2'))), 'item suspenso sai de "Vindos da porta"');

-- ── 6. F6: horários para a folha impressa ───────────────────────────────────
SELECT pg_temp.ok((SELECT (SELECT array_agg(x ORDER BY x) FROM jsonb_array_elements_text(h -> 'horarios') x)
                             = (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[pg_temp.h(-3), pg_temp.h(5), pg_temp.h(13)]) x)
                     FROM jsonb_array_elements(public.horarios_dos_itens(ARRAY[pg_temp.v('cefa8')])) h),
  'horarios_dos_itens devolve o aprazamento');
SELECT pg_temp.como('medx');
SELECT pg_temp.ok(jsonb_array_length(public.horarios_dos_itens(ARRAY[pg_temp.v('cefa8')])) = 0, 'outra unidade não lê os horários');

RESET ROLE;
SELECT pg_temp.ok(has_function_privilege('authenticated', 'private.doses_do_item(uuid)', 'EXECUTE') IS FALSE
                  AND has_function_privilege('authenticated', 'private.frequencia_porta_reconhecida(text, boolean)', 'EXECUTE') IS FALSE,
  'funções internas fora do alcance do usuário');

ROLLBACK;
