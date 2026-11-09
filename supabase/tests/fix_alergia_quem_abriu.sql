-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270308000008_alergia_quem_abriu.sql (decisão do RT em
-- 08/11/2026: quem abriu a observação também registra alergia enquanto ela
-- está aberta, como no item 4). Tudo em transação com ROLLBACK. O cenário é o
-- de fix_observacao_quem_abriu_parecer.sql.
--
-- 1. ok: o autor lê as alergias e registra uma (autor = login);
-- 2. recusado: outro médico da porta; o autor fora do plantão;
-- 3. continua ok: o médico escalado na observação;
-- 4. fora da observação, o autor não registra mais.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-0000000a8a01'),
  ('upa',    '00000000-0000-4000-8000-0000000a8a02'),
  ('porta',  '00000000-0000-4000-8000-0000000a8a11'),
  ('obs',    '00000000-0000-4000-8000-0000000a8a12'),
  ('med',    '00000000-0000-4000-8000-0000000a8a21'),  -- autor: de plantão na porta
  ('med2',   '00000000-0000-4000-8000-0000000a8a22'),  -- outro médico da porta
  ('medobs', '00000000-0000-4000-8000-0000000a8a23'),  -- médico escalado na observação
  ('medfora','00000000-0000-4000-8000-0000000a8a24'),  -- autor que sai do plantão
  ('rec',    '00000000-0000-4000-8000-0000000a8a27');
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
    json_build_object('nome', 'Paciente Alergia ' || upper(p_nome), 'data_nascimento', '1980-01-01')::jsonb) ->> 'episodio_id')::uuid;
  RESET ROLE;
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
  INSERT INTO v SELECT 'p' || p_nome, paciente_id FROM public.episodios WHERE id = v_ep;
END $$;

INSERT INTO auth.users (id, email) SELECT id, nome || '@fixalergia.local' FROM ids WHERE nome LIKE 'med%' OR nome LIKE 'rec%';
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome LIKE 'med%' OR nome LIKE 'rec%'
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do fix da alergia');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do fix da alergia', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação Adulto', 'observacao');
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT pg_temp.id('obs'), 'OA-0' || n, 'observacao'::public.tipo_leito FROM generate_series(1, 4) n;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('med2'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('medobs'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medfora'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('rec'), pg_temp.id('upa'), 'recepcao');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('upa'), pg_temp.id(s), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES ('porta', 'med'), ('porta', 'med2'), ('obs', 'medobs'), ('porta', 'medfora'), ('porta', 'rec')) x(s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('upa') ON CONFLICT DO NOTHING;

SELECT pg_temp.observar('a', 'med', 'rec', 'porta');
SELECT pg_temp.observar('f', 'medfora', 'rec', 'porta');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.internacoes i
                    WHERE i.id IN (SELECT id FROM v WHERE nome LIKE 'i%') AND i.status = 'em_observacao' AND i.setor_atual_id = pg_temp.id('obs')),
  'cenário: dois pacientes na observação, postos pela porta');
UPDATE public.escala_plantao SET ativo = false WHERE perfil_id = pg_temp.id('medfora');

SET LOCAL ROLE authenticated;

-- ── 1. o autor lê e registra ────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.ok((public.alergias_do_paciente(pg_temp.v('pa')) -> 'alergias') = '[]'::jsonb,
  '1: o autor lê as alergias do paciente (ainda nenhuma)');
INSERT INTO v SELECT 'alg', public.registrar_alergia(pg_temp.v('pa'), 'Dipirona', 'Urticária', 'medicamento', 'grave');
RESET ROLE;
SELECT pg_temp.ok((SELECT registrado_por = pg_temp.id('med') AND inativada_em IS NULL FROM public.alergias_paciente WHERE id = pg_temp.v('alg')),
  '1: o autor da observação registra a alergia (autor = login)');
SET LOCAL ROLE authenticated;

-- ── 2. quem não abriu, ou saiu do plantão ───────────────────────────────────
SELECT pg_temp.como('med2');
SELECT pg_temp.falha(format('SELECT public.registrar_alergia(%L, %L)', pg_temp.v('pa'), 'Látex'),
  'Acesso negado', '2: outro médico da porta não registra');
SELECT pg_temp.falha(format('SELECT public.alergias_do_paciente(%L)', pg_temp.v('pa')),
  'Acesso negado', '2: outro médico da porta não lê');
SELECT pg_temp.como('medfora');
SELECT pg_temp.falha(format('SELECT public.registrar_alergia(%L, %L)', pg_temp.v('pf'), 'Látex'),
  'Acesso negado', '2: o autor fora do plantão não registra');

-- ── 3. o médico escalado na observação continua ─────────────────────────────
SELECT pg_temp.como('medobs');
SELECT pg_temp.ok(public.registrar_alergia(pg_temp.v('pf'), 'Látex', NULL, 'latex') IS NOT NULL,
  '3: o médico escalado na observação registra');

-- ── 4. fora da observação, o autor não registra mais ────────────────────────
RESET ROLE;
-- a observação deixa de estar aberta (vira internação; a regra olha status em_observacao)
UPDATE public.internacoes SET status = 'internado' WHERE id = pg_temp.v('ia');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.registrar_alergia(%L, %L)', pg_temp.v('pa'), 'Látex'),
  'Acesso negado', '4: fora da observação, o autor não registra');
RESET ROLE;
ROLLBACK;
