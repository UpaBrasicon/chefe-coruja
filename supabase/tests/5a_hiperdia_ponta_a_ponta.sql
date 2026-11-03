-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 7, parte 7.3: o hiperdia de ponta a ponta na UBS, com as mesmas
-- chamadas das telas e o papel de cada um. Tudo em transação com ROLLBACK; o
-- cenário é criado aqui.
--
-- Recepção abre a ficha da escuta; o enfermeiro faz a escuta com pressão, peso
-- e altura (EscutaInicial); o médico atende, pede a hemoglobina glicada
-- (AbaExames), avalia os pés (bloco Hiperdia) e encerra com hipertensão e
-- diabetes (AbaConduta); o paciente entra nos dois programas e o painel mostra
-- tudo registrado; o gestor abre a agenda e a recepção marca o retorno
-- ("Agendar"), que aparece como próxima consulta.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000062a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000062a2'),
  ('cons', '00000000-0000-4000-8000-0000000062a3'),
  ('med',  '00000000-0000-4000-8000-0000000062b1'),
  ('enf',  '00000000-0000-4000-8000-0000000062b2'),
  ('rec',  '00000000-0000-4000-8000-0000000062b3'),
  ('ges',  '00000000-0000-4000-8000-0000000062b4');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a7e2e.local' FROM ids WHERE nome IN ('med', 'enf', 'rec', 'ges');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf', 'rec', 'ges')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do hiperdia ponta a ponta');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do hiperdia', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['med', 'enf', 'rec']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── recepção e escuta (Recepcao.tsx, EscutaInicial.tsx) ─────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep', (public.registrar_ficha(pg_temp.id('cons'), 'Renovar a receita da pressão e do diabetes', NULL,
  '{"nome":"Paciente Hiperdia E2E","data_nascimento":"1961-07-07","tipo_atendimento":"escuta_inicial"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.como('enf');
SELECT public.registrar_escuta_aps(pg_temp.v('ep'), 'verde', 'consulta', 'Renovar a receita, sem queixas agudas',
  '{"pressao-arterial-sistolica":148,"pressao-arterial-diastolica":92,"peso":84,"estatura":168}');
RESET ROLE;
INSERT INTO v SELECT 'pac', paciente_id FROM public.episodios WHERE id = pg_temp.v('ep');
SET LOCAL ROLE authenticated;

-- ── consulta (JanelaAtendimento, AbaExames, bloco Hiperdia, AbaConduta) ─────
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('ep'));
SELECT public.registrar_soap(pg_temp.v('ep'), 'Hipertenso e diabético, sem queixas', 'PA 148x92', 'Hipertensão e diabetes sem controle ideal',
  'Ajuste da medicação, HbA1c e retorno', 'I10');
-- pelo nome: a SIGTAP do CI é reduzida (na homologação o código 02.02.01.050-3 também vale)
SELECT public.pedir_exames(pg_temp.v('ep'), '[{"nome":"Hemoglobina glicada (HbA1c)"}]');
SELECT public.registrar_avaliacao_pes(pg_temp.v('ep'), 'sem_alteracao');
SELECT public.registrar_conduta_aps(pg_temp.v('ep'), 'consulta_programada', '{hipertensao_arterial,diabetes}', '{}',
  '{retorno_cuidado_continuado}', 'Retorno em 30 dias com a HbA1c', '{}');

-- ── painel (Hiperdia.tsx) ───────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((SELECT jsonb_array_length(p -> 'programas') = 2 AND (p ->> 'ultima_consulta') IS NOT NULL AND (p ->> 'ultima_pa') IS NOT NULL
                          AND (p ->> 'ultimo_peso_altura') IS NOT NULL AND (p ->> 'ultima_hba1c') IS NOT NULL
                          AND (p ->> 'ultima_avaliacao_pes') IS NOT NULL AND NOT (p ->> 'pes_com_alteracao')::boolean
                          AND (p ->> 'proxima_consulta') IS NULL
                     FROM jsonb_array_elements(public.hiperdia_painel(pg_temp.id('ubs'))) p WHERE (p ->> 'paciente_id')::uuid = pg_temp.v('pac')),
  'painel: hipertensão e diabetes, com consulta, pressão, peso e altura, HbA1c e pés registrados pela consulta');

-- ── agenda: "Agendar" (AgendaConsultas.tsx) ─────────────────────────────────
SELECT pg_temp.como('ges');
SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('med'),
  (SELECT jsonb_agg(jsonb_build_object('dia', d, 'periodo', 'manha', 'inicio', '07:00', 'fim', '12:00', 'duracao', 20)) FROM generate_series(0, 6) d));
SELECT pg_temp.como('rec');
SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(30, '08:00'), pg_temp.v('pac'), 'consulta_programada', 'Retorno do hiperdia');
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((SELECT (p ->> 'proxima_consulta') IS NOT NULL FROM jsonb_array_elements(public.hiperdia_painel(pg_temp.id('ubs'))) p
                    WHERE (p ->> 'paciente_id')::uuid = pg_temp.v('pac')), 'painel: o retorno marcado pela recepção aparece como próxima consulta');
RESET ROLE;

ROLLBACK;
