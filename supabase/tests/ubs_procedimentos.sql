-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000009_ubs_procedimentos.sql (percurso da UBS,
-- U7, PR 5). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. o enfermeiro registra o teste rápido com resultado; o técnico, o curativo;
-- 2. cada papel só registra os seus; o teste exige resultado e o curativo não
--    aceita; fora da lista, recusa;
-- 3. sífilis reagente em gestante vira sugestão de notificação (O98.1); não
--    reagente, não.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000079a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000079a2'),
  ('cons', '00000000-0000-4000-8000-0000000079a3'),
  ('rec',  '00000000-0000-4000-8000-0000000079b1'),
  ('enf',  '00000000-0000-4000-8000-0000000079b2'),
  ('tec',  '00000000-0000-4000-8000-0000000079b3');
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
CREATE TEMP TABLE n (cid text, origem text, episodio uuid) ON COMMIT DROP;
GRANT ALL ON n TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u75.local' FROM ids WHERE nome IN ('rec', 'enf', 'tec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'tec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U7 PR5');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U7 PR5', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'enf', 'tec']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep', (public.registrar_ficha(pg_temp.id('cons'), 'Pré-natal: testes do 1º trimestre', NULL,
  '{"nome":"Gestante PR5","data_nascimento":"1996-09-09","sexo":"F","tipo_atendimento":"consulta_programada","destino":"enfermagem"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'ep2', (public.registrar_ficha(pg_temp.id('cons'), 'Curativo', NULL,
  '{"nome":"Paciente PR5 Dois","data_nascimento":"1970-01-01","tipo_atendimento":"consulta_no_dia","destino":"enfermagem"}') ->> 'episodio_id')::uuid;

-- ── 2. quem e o quê ─────────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.registrar_procedimento_aps(pg_temp.v('ep'), '0214010252', 'reagente')$$,
  'Este procedimento não é do seu papel', '2. a recepção não registra procedimento');
SELECT pg_temp.como('tec');
SELECT pg_temp.falha($$SELECT public.registrar_procedimento_aps(pg_temp.v('ep'), '0214010252', 'reagente')$$,
  'Este procedimento não é do seu papel', '2. o técnico não registra teste rápido');
SELECT public.registrar_procedimento_aps(pg_temp.v('ep2'), '0301100284');
SELECT pg_temp.falha($$SELECT public.registrar_procedimento_aps(pg_temp.v('ep2'), '0301100284', 'reagente')$$,
  'Este procedimento não tem resultado', '2. curativo não aceita resultado');
SELECT pg_temp.como('enf');
SELECT pg_temp.falha($$SELECT public.registrar_procedimento_aps(pg_temp.v('ep'), '0214010252')$$,
  'Informe o resultado do teste rápido', '2. teste rápido exige o resultado');
SELECT pg_temp.falha($$SELECT public.registrar_procedimento_aps(pg_temp.v('ep'), '0301040176')$$,
  'Este procedimento não é do seu papel', '2. o enfermeiro não registra implante (P4 e plano)');
SELECT pg_temp.falha($$SELECT public.registrar_procedimento_aps(pg_temp.v('ep'), '0303010010')$$,
  'Procedimento fora da lista da UBS', '2. fora da lista, recusa');

-- ── 1. teste rápido com resultado ───────────────────────────────────────────
SELECT public.registrar_procedimento_aps(pg_temp.v('ep'), '0214010252', 'reagente');
SELECT public.registrar_procedimento_aps(pg_temp.v('ep'), '0214010279', 'nao_reagente');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.procedimentos_realizados WHERE episodio_id = pg_temp.v('ep')
                     AND profissional_id = pg_temp.id('enf') AND resultado IS NOT NULL),
  '1. o enfermeiro registra dois testes rápidos com resultado');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.procedimentos_realizados WHERE episodio_id = pg_temp.v('ep2')
                     AND profissional_id = pg_temp.id('tec') AND procedimento = '0301100284' AND resultado IS NULL),
  '1. o técnico registra o curativo, sem resultado');

-- ── 3. notificação ──────────────────────────────────────────────────────────
INSERT INTO n SELECT cid, origem, episodio_id
  FROM public.notificacao_compulsoria_periodo(pg_temp.id('ubs'), private.data_atual(), NULL, NULL);
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM n WHERE episodio = pg_temp.v('ep') AND cid = 'O98.1' AND origem = 'Teste rápido reagente'),
  '3. sífilis reagente em gestante vira sugestão de notificação (O98.1)');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM n WHERE episodio = pg_temp.v('ep') AND cid = 'O98.7'),
  '3. HIV não reagente não sugere notificação');

-- a ficha mostra os procedimentos registrados
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.ok(jsonb_array_length(public.procedimentos_aps_do_episodio(pg_temp.v('ep'))) = 2, '1. a ficha lista os dois testes registrados');
RESET ROLE;

ROLLBACK;
