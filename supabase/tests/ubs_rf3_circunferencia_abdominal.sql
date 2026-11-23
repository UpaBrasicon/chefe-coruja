-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000033_ubs_rf3_circunferencia_abdominal.sql
-- (refinamento da UBS, RF3). Tudo em transação com ROLLBACK; o cenário é
-- criado aqui.
--
-- 1. o conceito global 'circunferencia-abdominal' existe, numérico, em cm, como
--    sinal vital;
-- 2. o técnico de plantão registra a circunferência abdominal da ficha aberta
--    pela registrar_sinais_aps, junto com outros sinais;
-- 3. o valor fica em observacao, cru, com o técnico como autor.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-00000000f3a1'),
  ('ubs',  '00000000-0000-4000-8000-00000000f3a2'),
  ('cons', '00000000-0000-4000-8000-00000000f3a3'),
  ('rec',  '00000000-0000-4000-8000-00000000f3b1'),
  ('tec',  '00000000-0000-4000-8000-00000000f3b2');
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

-- ── 1. o conceito ───────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT tipo = 'numerico' AND unidade_padrao = 'cm' AND categoria = 'sinal_vital'
                     FROM public.conceito WHERE nome = 'circunferencia-abdominal' AND unidade_id IS NULL),
  '1. conceito global circunferencia-abdominal, numérico, em cm, sinal vital');

-- ── cenário: UBS com recepção e técnico de plantão ──────────────────────────
INSERT INTO auth.users (id, email) SELECT id, nome || '@rf3.local' FROM ids WHERE nome IN ('rec', 'tec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'tec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do RF3');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do RF3', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'tec']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep', (public.registrar_ficha(pg_temp.id('cons'), 'Consulta do hiperdia', NULL,
  '{"nome":"Paciente RF3","data_nascimento":"1961-05-05","tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;

-- ── 2. o técnico registra ───────────────────────────────────────────────────
SELECT pg_temp.como('tec');
SELECT pg_temp.ok(public.registrar_sinais_aps(pg_temp.v('ep'),
  '{"circunferencia-abdominal":102.5,"peso":91,"estatura":168}') = 3,
  '2. o técnico de plantão registra a circunferência abdominal com o peso e a altura');
RESET ROLE;

-- ── 3. o valor cru, com o autor ─────────────────────────────────────────────
SELECT pg_temp.ok((SELECT o.valor_num = 102.5 AND o.registrado_por = pg_temp.id('tec')
                     FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
                    WHERE o.episodio_id = pg_temp.v('ep') AND c.nome = 'circunferencia-abdominal'),
  '3. a circunferência abdominal fica em observacao, crua, com o técnico como autor');

ROLLBACK;
