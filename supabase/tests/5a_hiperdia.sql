-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270218000001_hiperdia.sql (5A, tarefa 7, parte 7.1).
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. a consulta da UBS inclui no programa pelo problema, pelo CID-10 ou pela
--    CIAP-2 da nota; não duplica; consulta sem a condição não inclui;
-- 2. inclusão e saída à mão: médico e enfermeiro (recepção não), saída com motivo;
-- 3. avaliação dos pés na consulta aberta, com a alteração descrita;
-- 4. painel e paciente: só médico, enfermagem e gestor; as datas de consulta,
--    pressão, peso e altura no mesmo dia, hemoglobina glicada e pés.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000061a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000061a2'),
  ('cons', '00000000-0000-4000-8000-0000000061a3'),
  ('med',  '00000000-0000-4000-8000-0000000061b1'),
  ('enf',  '00000000-0000-4000-8000-0000000061b2'),
  ('rec',  '00000000-0000-4000-8000-0000000061b3'),
  ('tec',  '00000000-0000-4000-8000-0000000061b4');
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
-- programas ativos do paciente do episódio (leitura da tabela no teste)
CREATE FUNCTION pg_temp.progs(p_ep text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(x.programa || ':' || x.origem, ',' ORDER BY x.programa), '')
    FROM public.programa_participantes x
   WHERE x.paciente_id = (SELECT paciente_id FROM public.episodios WHERE id = (SELECT id FROM v WHERE nome = p_ep)) AND x.saida_em IS NULL $$;
GRANT EXECUTE ON FUNCTION pg_temp.progs(text) TO authenticated;
-- uma consulta da UBS do começo ao fim, como na tela
CREATE FUNCTION pg_temp.consulta(p_ep text, p_prob text[], p_cids text[], p_ciaps text[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.iniciar_atendimento(pg_temp.v(p_ep));
  PERFORM public.registrar_soap(pg_temp.v(p_ep), 'Acompanhamento', 'Sem alterações', 'Condição crônica em acompanhamento', 'Manter', NULL);
  PERFORM public.registrar_conduta_aps(pg_temp.v(p_ep), 'consulta_programada', p_prob, p_cids, '{retorno_cuidado_continuado}', NULL, p_ciaps);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.consulta(text, text[], text[], text[]) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a7.local' FROM ids WHERE nome IN ('med', 'enf', 'rec', 'tec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf', 'rec', 'tec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do 5A7');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do 5A7', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['med', 'rec']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep' || n, (public.registrar_ficha(pg_temp.id('cons'), 'Consulta de acompanhamento', NULL,
  jsonb_build_object('nome', 'Paciente Hiperdia ' || n, 'data_nascimento', '1960-01-0' || n, 'tipo_atendimento', 'consulta_programada')) ->> 'episodio_id')::uuid
  FROM generate_series(1, 5) n;

-- ── 1. entrada pela consulta ────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.consulta('ep1', '{hipertensao_arterial}', '{}', '{}');
SELECT pg_temp.consulta('ep2', '{}', '{E11.9}', '{}');
SELECT pg_temp.consulta('ep3', '{}', '{}', '{K86}');
SELECT pg_temp.consulta('ep4', '{tabagismo}', '{}', '{}');
SELECT pg_temp.ok(pg_temp.progs('ep1') = 'hipertensao:consulta', 'problema "hipertensão" inclui no programa');
SELECT pg_temp.ok(pg_temp.progs('ep2') = 'diabetes:consulta', 'CID E11.9 inclui no diabetes');
SELECT pg_temp.ok(pg_temp.progs('ep3') = 'hipertensao:consulta', 'CIAP K86 inclui na hipertensão');
SELECT pg_temp.ok(pg_temp.progs('ep4') = '', 'consulta sem a condição não inclui');
-- segunda consulta do mesmo paciente: não duplica
RESET ROLE;
INSERT INTO v SELECT 'p1', paciente_id FROM public.episodios WHERE id = pg_temp.v('ep1');
INSERT INTO v SELECT 'p2', paciente_id FROM public.episodios WHERE id = pg_temp.v('ep2');
INSERT INTO v SELECT 'p3', paciente_id FROM public.episodios WHERE id = pg_temp.v('ep3');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep6', (public.registrar_ficha(pg_temp.id('cons'), 'Retorno', pg_temp.v('p1'),
  '{"tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.como('med');
SELECT pg_temp.consulta('ep6', '{hipertensao_arterial}', '{I10}', '{}');
SELECT pg_temp.ok(pg_temp.progs('ep6') = 'hipertensao:consulta', 'nova consulta não duplica o programa');

-- ── 2. inclusão e saída à mão ───────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha(format('SELECT public.programa_incluir(%L, %L)', pg_temp.v('p1'), 'diabetes'), 'Acesso negado: inclui', 'recepção não inclui');
SELECT pg_temp.como('enf');
INSERT INTO v SELECT 'man', public.programa_incluir(pg_temp.v('p1'), 'diabetes');
SELECT pg_temp.ok(pg_temp.progs('ep1') = 'diabetes:manual,hipertensao:consulta', 'o enfermeiro inclui o diabetes à mão');
SELECT pg_temp.falha(format('SELECT public.programa_incluir(%L, %L)', pg_temp.v('p1'), 'diabetes'), 'O paciente já está no programa', 'não inclui duas vezes');
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.programa_retirar(%L, %L)',
  (SELECT (p ->> 'id')::uuid FROM jsonb_array_elements(public.hiperdia_do_paciente(pg_temp.v('p3')) -> 'programas') p), 'Ok'),
  'Escreva o motivo da saída', 'saída pede motivo');
SELECT public.programa_retirar((SELECT (p ->> 'id')::uuid FROM jsonb_array_elements(public.hiperdia_do_paciente(pg_temp.v('p3')) -> 'programas') p),
  'Diagnóstico revisto: hipertensão do avental branco');
SELECT pg_temp.ok(pg_temp.progs('ep3') = '', 'o médico retira do programa com motivo');

-- ── 3. avaliação dos pés ────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep7', (public.registrar_ficha(pg_temp.id('cons'), 'Retorno do diabetes', pg_temp.v('p2'),
  '{"tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.falha(format('SELECT public.registrar_avaliacao_pes(%L, %L)', pg_temp.v('ep7'), 'sem_alteracao'),
  'Acesso negado: registra o médico', 'recepção não registra');
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('ep7'));
SELECT pg_temp.falha(format('SELECT public.registrar_avaliacao_pes(%L, %L)', pg_temp.v('ep7'), 'com_alteracao'),
  'Descreva a alteração', 'alteração pede descrição');
SELECT public.registrar_avaliacao_pes(pg_temp.v('ep7'), 'com_alteracao', 'Perda da sensibilidade protetora no pé direito');

-- registros da consulta: pressão, peso e altura no mesmo dia, hemoglobina glicada pedida
RESET ROLE;
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT pg_temp.id('ubs'), pg_temp.v('p1'), c.id, now() - interval '10 days', x.val, 'manual'
  FROM (VALUES ('pressao-arterial-sistolica', 142), ('peso', 81), ('estatura', 170)) x(nome, val)
  JOIN public.conceito c ON c.nome = x.nome AND c.unidade_id IS NULL;
INSERT INTO public.exames_pedidos (unidade_id, paciente_id, exame, pedido_por, pedido_em, situacao)
VALUES (pg_temp.id('ubs'), pg_temp.v('p1'), 'HbA1c', pg_temp.id('med'), now() - interval '20 days', 'pedido');
SET LOCAL ROLE authenticated;

-- ── 4. painel e paciente ────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha(format('SELECT public.hiperdia_painel(%L)', pg_temp.id('ubs')), 'O hiperdia é visto', 'a recepção não vê o painel');
SELECT pg_temp.como('tec');
SELECT pg_temp.ok(jsonb_array_length(public.hiperdia_painel(pg_temp.id('ubs'))) = 2, 'o técnico vê o painel com os dois pacientes ativos');
SELECT pg_temp.ok((SELECT jsonb_array_length(p -> 'programas') = 2 AND (p ->> 'ultima_consulta') IS NOT NULL AND (p ->> 'ultima_pa') IS NOT NULL
                          AND (p ->> 'ultimo_peso_altura') IS NOT NULL AND (p ->> 'ultima_hba1c') IS NOT NULL AND (p ->> 'ultima_avaliacao_pes') IS NULL
                     FROM jsonb_array_elements(public.hiperdia_painel(pg_temp.id('ubs'))) p WHERE (p ->> 'paciente_id')::uuid = pg_temp.v('p1')),
  'paciente 1: dois programas, consulta, pressão, peso com altura e HbA1c');
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((SELECT (h ->> 'ultima_avaliacao_pes') IS NOT NULL AND (h ->> 'pes_com_alteracao')::boolean
                     FROM public.hiperdia_do_paciente(pg_temp.v('p2')) h), 'paciente 2: avaliação dos pés com alteração');
RESET ROLE;
SELECT pg_temp.ok(has_table_privilege('authenticated', 'public.programa_participantes', 'SELECT') IS FALSE
                  AND has_table_privilege('authenticated', 'public.avaliacoes_pes', 'SELECT') IS FALSE, 'sem acesso direto às tabelas');

ROLLBACK;
