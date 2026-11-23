-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000036_ubs_lp3_atendimento_nao_encerrado.sql
-- (limpeza do percurso da UBS, LP3). Tudo em transação com ROLLBACK; o cenário
-- é criado aqui.
--
-- 1. a recepção vê de quando é o atendimento aberto e com quem;
-- 2. o gestor vê a ficha em atendimento de ontem; a de hoje, não;
-- 3. só o gestor encerra; pede motivo; a de hoje não se encerra assim;
-- 4. encerrada pelo gestor: fica não concluída, fora do SISAB e da RNDS, com o
--    gestor como autor, e o paciente pode abrir ficha nova.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-00000000d3a1'),
  ('ubs',  '00000000-0000-4000-8000-00000000d3a2'),
  ('cons', '00000000-0000-4000-8000-00000000d3a3'),
  ('rec',  '00000000-0000-4000-8000-00000000d3b1'),
  ('med',  '00000000-0000-4000-8000-00000000d3b2'),
  ('ges',  '00000000-0000-4000-8000-00000000d3b3');
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
CREATE TEMP TABLE epi (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON epi TO authenticated;
CREATE FUNCTION pg_temp.e(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM epi WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.e(text) TO authenticated;
CREATE FUNCTION pg_temp.lista() RETURNS uuid[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg((x ->> 'episodio_id')::uuid), '{}')
    FROM jsonb_array_elements(public.ubs_atendimentos_nao_encerrados(pg_temp.id('ubs'))) x $$;
GRANT EXECUTE ON FUNCTION pg_temp.lista() TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@lp3.local' FROM ids WHERE nome IN ('rec', 'med', 'ges');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'med', 'ges')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do LP3');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do LP3', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'),
  (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO epi SELECT 'ontem', (public.registrar_ficha(pg_temp.id('cons'), 'Renovação de receita', NULL,
  '{"nome":"Paciente Ontem","data_nascimento":"1962-02-02","tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;
INSERT INTO epi SELECT 'hoje', (public.registrar_ficha(pg_temp.id('cons'), 'Dor de cabeça', NULL,
  '{"nome":"Paciente Hoje","data_nascimento":"1970-07-07","tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.e('ontem'));
SELECT public.iniciar_atendimento(pg_temp.e('hoje'));
RESET ROLE;
-- a ficha "ontem" começou ontem e ficou aberta
UPDATE public.episodios SET chegada_em = chegada_em - interval '1 day', atendimento_iniciado_em = atendimento_iniciado_em - interval '1 day'
 WHERE id = pg_temp.e('ontem');
SET LOCAL ROLE authenticated;

-- ── 1. a recepção vê de quando e com quem ───────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.ok((SELECT (i ->> 'quem_abriu') = 'Pessoa med' AND (i ->> 'iniciado_em') IS NOT NULL
                     FROM public.atendimento_aberto_info((SELECT paciente_id FROM public.episodios WHERE id = pg_temp.e('ontem'))) i),
  '1. a recepção vê quem abriu o atendimento e quando');
SELECT pg_temp.falha($$SELECT public.ubs_atendimentos_nao_encerrados(pg_temp.id('ubs'))$$, 'Acesso negado', '3. a recepção não vê a lista do gestor');

-- ── 2. a lista do gestor ────────────────────────────────────────────────────
SELECT pg_temp.como('ges');
SELECT pg_temp.ok(pg_temp.e('ontem') = ANY (pg_temp.lista()) AND NOT (pg_temp.e('hoje') = ANY (pg_temp.lista())),
  '2. o gestor vê a de ontem; a de hoje, não');

-- ── 3. quem encerra ─────────────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.falha($$SELECT public.ubs_encerrar_nao_concluido(pg_temp.e('ontem'), 'Paciente foi embora sem concluir')$$,
  'Acesso negado', '3. o médico não encerra por aqui');
SELECT pg_temp.como('ges');
SELECT pg_temp.falha($$SELECT public.ubs_encerrar_nao_concluido(pg_temp.e('ontem'), 'curto')$$,
  'Escreva o motivo', '3. pede motivo de 10 letras');
SELECT pg_temp.falha($$SELECT public.ubs_encerrar_nao_concluido(pg_temp.e('hoje'), 'Paciente foi embora sem concluir')$$,
  'O atendimento é de hoje', '3. a de hoje quem atende encerra pela conduta');

-- ── 4. encerrada pelo gestor ────────────────────────────────────────────────
SELECT public.ubs_encerrar_nao_concluido(pg_temp.e('ontem'), 'Paciente saiu sem concluir a consulta');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND encerrado_por = pg_temp.id('ges') AND desfecho_por = pg_temp.id('ges')
                          AND (desfecho_detalhes ->> 'nao_concluido')::boolean AND desfecho IS NULL
                          AND desfecho_motivo LIKE 'Atendimento não concluído:%'
                     FROM public.episodios WHERE id = pg_temp.e('ontem')),
  '4. encerrada como não concluída, com o gestor como autor');
SELECT pg_temp.ok(NOT private.ledi_fai_cabe(pg_temp.e('ontem')), '4. não vai ao SISAB');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledi_fila f WHERE f.referencia_id = pg_temp.e('ontem')), '4. nada na fila do LEDI');
SELECT pg_temp.ok(private.rnds_rac_fora(pg_temp.e('ontem')), '4. fica fora do RAC da RNDS');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.acao = 'atendimento_nao_concluido_encerrado'
                            AND a.entidade_id = pg_temp.e('ontem') AND a.ator_id = pg_temp.id('ges')),
  '4. o encerramento fica na auditoria');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
SELECT pg_temp.ok((public.registrar_ficha(pg_temp.id('cons'), 'Volta para a consulta',
  (SELECT paciente_id FROM public.episodios WHERE id = pg_temp.e('ontem')),
  '{"tipo_atendimento":"consulta_programada"}') ->> 'episodio_id') IS NOT NULL,
  '4. o paciente pode abrir ficha nova');
RESET ROLE;

ROLLBACK;
