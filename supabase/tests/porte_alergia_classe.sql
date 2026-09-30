-- Testes da migration 20261003000008 (alergia trava a prescrição pela
-- classe ATC do princípio ativo). ROLLBACK no fim. Mesmo preparo de
-- porte_alergias.sql.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Ceftriaxona', 'ceftriaxona', 'pó 1 g', 'teste'),
  ('Dipirona', 'dipirona', 'solução 500 mg/mL 2 mL', 'teste'),
  ('Amoxicilina + clavulanato de potássio', 'amoxicilina + clavulanato de potassio', 'comprimido 875 mg', 'teste'),
  ('Benzilpenicilina benzatina', 'benzilpenicilina benzatina', 'pó 1.200.000 UI', 'teste'),
  ('Cetorolaco de trometamina', 'cetorolaco de trometamina', 'solução 30 mg/mL', 'teste'),
  ('Azitromicina', 'azitromicina', 'comprimido 500 mg', 'teste');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'cef', id::text FROM public.medicamento WHERE principio_ativo_norm = 'ceftriaxona' AND fonte = 'teste';
INSERT INTO t SELECT 'dip', id::text FROM public.medicamento WHERE principio_ativo_norm = 'dipirona' AND fonte = 'teste';
INSERT INTO t SELECT 'amox', id::text FROM public.medicamento WHERE principio_ativo_norm LIKE 'amoxicilina%' AND fonte = 'teste';
INSERT INTO t SELECT 'bpg', id::text FROM public.medicamento WHERE principio_ativo_norm LIKE 'benzilpenicilina%' AND fonte = 'teste';
INSERT INTO t SELECT 'ceto', id::text FROM public.medicamento WHERE principio_ativo_norm LIKE 'cetorolaco%' AND fonte = 'teste';
INSERT INTO t SELECT 'azi', id::text FROM public.medicamento WHERE principio_ativo_norm = 'azitromicina' AND fonte = 'teste';
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
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
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;

-- ── paciente na porta ───────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Alergia Adulto","data_nascimento":"1970-03-03"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'ep2', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse', NULL,
  '{"nome":"Alergia Outro","data_nascimento":"1980-04-04"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO t SELECT 'pac2', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep2');

-- ── classe: "Penicilinas" trava amoxicilina e penicilina benzatina ────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.registrar_alergia(pg_temp.u('pac'), 'Penicilinas', 'urticária', 'medicamento', 'grave');
SELECT public.registrar_alergia(pg_temp.u('pac2'), 'AINES', 'broncoespasmo', 'medicamento', 'grave');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('amox'), 'dose', '875 mg', 'via', 'EV', 'posologia', '8/8h')),
  'ALERGIA', '"Penicilinas" (classe) trava amoxicilina + clavulanato');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('bpg'), 'dose', '1.200.000 UI', 'via', 'EV', 'posologia', '8/8h')),
  'ALERGIA', '"Penicilinas" (classe) trava a penicilina benzatina');
SELECT pg_temp.confere(public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('azi'), 'dose', '500 mg', 'via', 'EV', 'posologia', '8/8h')::jsonb) IS NOT NULL,
  'alergia a penicilinas não trava azitromicina (outra classe)');
SELECT pg_temp.confere(public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('cef'), 'dose', '1 g', 'via', 'EV', 'posologia', '8/8h')::jsonb) IS NOT NULL,
  'penicilina não trava cefalosporina: reatividade cruzada é julgamento clínico, não trava');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac2'), json_build_object('medicamento_id', pg_temp.u('ceto'), 'dose', '30 mg', 'via', 'EV', 'posologia', '8/8h')),
  'ALERGIA', 'sinônimo "AINES" trava cetorolaco (classe M01A)');
SELECT pg_temp.confere(public.prescrever(pg_temp.u('pac2'), json_build_object('medicamento_id', pg_temp.u('dip'), 'dose', '1 g', 'via', 'EV', 'posologia', '8/8h')::jsonb) IS NOT NULL,
  'AINE não trava dipirona (pirazolona, N02BB)');
SELECT pg_temp.confere(public.alergia_trava_medicamento(pg_temp.u('pac'), pg_temp.u('amox')) = 'Penicilinas',
  'a tela recebe o nome da alergia que trava, antes de enviar');

-- ── o nome continua travando como antes (singular e plural) ────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.registrar_alergia(pg_temp.u('pac2'), 'Azitromicinas', NULL, 'medicamento', 'leve');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac2'), json_build_object('medicamento_id', pg_temp.u('azi'), 'dose', '500 mg', 'via', 'EV', 'posologia', '8/8h')),
  'ALERGIA', 'nome no plural ("Azitromicinas") trava a azitromicina');

-- ── inativada deixa de travar ───────────────────────────────────────────────
RESET ROLE;
UPDATE public.alergias_paciente SET inativada_em = now(), inativada_por = '10000000-0000-4000-8000-000000000004',
  motivo_inativacao = 'teste: alergia descartada' WHERE paciente_id = pg_temp.u('pac') AND substancia = 'Penicilinas';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.confere(public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('amox'), 'dose', '875 mg', 'via', 'EV', 'posologia', '8/8h')::jsonb) IS NOT NULL,
  'alergia de classe inativada deixa de travar');

ROLLBACK;
