-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270307000003_prescrever_atendimento_aberto.sql (achado
-- A P2-2 do teste da rede; decisão do RT em 07/11/2026: A). Tudo em transação
-- com ROLLBACK. O cenário é criado aqui.
--
-- Na porta, prescrever exige o atendimento aberto pelo médico, como o
-- registro da consulta (registrar_soap):
-- 1. paciente na triagem (sem classificação, sem atendimento): recusado, para
--    medicamento e para cuidado; nada fica gravado;
-- 2. em atendimento sem o médico ter aberto (atendimento_iniciado_em vazio):
--    recusado;
-- 3. atendimento aberto pelo médico: aceito; a alteração do item também;
-- 4. na observação (internação em_observacao) a regra da porta não se aplica:
--    a prescrição vai para a internação e é aceita.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000a2b01'),
  ('upa',   '00000000-0000-4000-8000-0000000a2b02'),
  ('porta', '00000000-0000-4000-8000-0000000a2b11'),
  ('obs',   '00000000-0000-4000-8000-0000000a2b12'),
  ('med',   '00000000-0000-4000-8000-0000000a2b21'),
  ('pac1',  '00000000-0000-4000-8000-0000000a2b31'),
  ('ep1',   '00000000-0000-4000-8000-0000000a2b32'),
  ('pac2',  '00000000-0000-4000-8000-0000000a2b33'),
  ('ep2',   '00000000-0000-4000-8000-0000000a2b34'),
  ('int2',  '00000000-0000-4000-8000-0000000a2b35'),
  ('dipi',  '00000000-0000-4000-8000-0000000a2b41');
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
CREATE FUNCTION pg_temp.med_sql(p_pac text) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.prescrever(%L, %L)', pg_temp.id(p_pac), json_build_object('medicamento_id', pg_temp.id('dipi'),
                'dose', 'dose de teste', 'via', 'EV', 'posologia', 'Agora')) $$;
GRANT EXECUTE ON FUNCTION pg_temp.med_sql(text) TO authenticated;
CREATE FUNCTION pg_temp.itens(p_pac text) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.prescricao_itens it JOIN public.prescricoes pr ON pr.id = it.prescricao_id
   WHERE pr.paciente_id = pg_temp.id(p_pac) $$;
GRANT EXECUTE ON FUNCTION pg_temp.itens(text) TO authenticated;

INSERT INTO auth.users (id, email) VALUES (pg_temp.id('med'), 'med@prescatend.local');
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('med'), 'Pessoa med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da prescrição com atendimento');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA da prescrição com atendimento', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação', 'observacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('upa'), pg_temp.id(s), pg_temp.id('med'), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES ('porta'), ('obs')) x(s);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('upa') ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte)
VALUES (pg_temp.id('dipi'), 'Dipirona atendimento', 'dipirona atendimento', 'solução injetável (teste atendimento)', 'teste-atendimento');

-- paciente 1 na porta, ainda na triagem; paciente 2 na observação
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, setor_id) VALUES
  (pg_temp.id('pac1'), pg_temp.id('upa'), 'Paciente Atendimento Um', '1990-01-01', 'F', pg_temp.id('porta')),
  (pg_temp.id('pac2'), pg_temp.id('upa'), 'Paciente Atendimento Dois', '1970-05-05', 'M', pg_temp.id('obs'));
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em) VALUES
  (pg_temp.id('ep1'), pg_temp.id('upa'), pg_temp.id('pac1'), pg_temp.id('porta'), 'triagem', 'Queixa de teste', pg_temp.id('med'), now() - interval '1 hour'),
  (pg_temp.id('ep2'), pg_temp.id('upa'), pg_temp.id('pac2'), pg_temp.id('porta'), 'observacao', 'Queixa de teste', pg_temp.id('med'), now() - interval '4 hours');
UPDATE public.episodios SET atendimento_medico_id = pg_temp.id('med'), atendimento_iniciado_em = now() - interval '3 hours' WHERE id = pg_temp.id('ep2');
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT pg_temp.id('upa'), p, c.id, now(), 70, 'manual'
  FROM unnest(ARRAY[pg_temp.id('pac1'), pg_temp.id('pac2')]) p, public.conceito c WHERE c.nome = 'peso' AND c.unidade_id IS NULL;
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, tipo_internacao, origem_admissao,
                                setor_atual_id, data_admissao, episodio_id)
VALUES (pg_temp.id('int2'), pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac2'), 'em_observacao', 'observacao', 'emergencia',
        pg_temp.id('obs'), now() - interval '1 hour', pg_temp.id('ep2'));

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');

-- ── 1. na triagem: recusado ─────────────────────────────────────────────────
SELECT pg_temp.falha(pg_temp.med_sql('pac1'), 'Abra o atendimento antes de prescrever', 'triagem: medicamento recusado');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.id('pac1'), '{"tipo":"cuidado","descricao":"Cabeceira elevada 30°"}'),
  'Abra o atendimento antes de prescrever', 'triagem: cuidado recusado');
SELECT pg_temp.ok(pg_temp.itens('pac1') = 0, 'triagem: nenhum item gravado');

-- ── 2. em atendimento sem o médico ter aberto ───────────────────────────────
RESET ROLE;
UPDATE public.episodios SET etapa = 'atendimento' WHERE id = pg_temp.id('ep1');
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha(pg_temp.med_sql('pac1'), 'Abra o atendimento antes de prescrever', 'atendimento sem abertura pelo médico: recusado');

-- ── 3. atendimento aberto pelo médico ───────────────────────────────────────
RESET ROLE;
UPDATE public.episodios SET atendimento_medico_id = pg_temp.id('med'), atendimento_iniciado_em = now() WHERE id = pg_temp.id('ep1');
SET LOCAL ROLE authenticated;
INSERT INTO v SELECT 'dipi1', public.prescrever(pg_temp.id('pac1'), json_build_object('medicamento_id', pg_temp.id('dipi'),
  'dose', 'dose de teste', 'via', 'EV', 'posologia', '6/6h')::jsonb);
SELECT pg_temp.ok(pg_temp.v('dipi1') IS NOT NULL, 'atendimento aberto: aceito');
INSERT INTO v SELECT 'dipi1b', public.alterar_item_prescricao(pg_temp.v('dipi1'), '{"posologia":"8/8h"}', 'Trocar a frequência no teste');
SELECT pg_temp.ok(pg_temp.v('dipi1b') IS NOT NULL, 'atendimento aberto: a alteração do item também passa');

-- ── 4. na observação: vai para a internação ─────────────────────────────────
INSERT INTO v SELECT 'obs1', public.prescrever(pg_temp.id('pac2'), json_build_object('medicamento_id', pg_temp.id('dipi'),
  'dose', 'dose de teste', 'via', 'EV', 'posologia', '6/6h')::jsonb);
RESET ROLE;
SELECT pg_temp.ok((SELECT pr.internacao_id = pg_temp.id('int2') FROM public.prescricao_itens it JOIN public.prescricoes pr ON pr.id = it.prescricao_id
                    WHERE it.id = pg_temp.v('obs1')), 'observação: aceito, na prescrição da internação');
ROLLBACK;
