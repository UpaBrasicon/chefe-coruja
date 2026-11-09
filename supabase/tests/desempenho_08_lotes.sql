-- Testes da migration 20270320000001 (item 08 do kit de desempenho): leituras
-- em lote de alergias, acuidade e trava de alergia. O lote tem de devolver,
-- para cada paciente ou remédio, exatamente o que a função de um item devolve,
-- e quem não tem acesso continua sem ler nada. ROLLBACK no fim.
-- Montagem igual à de porte_alergias.sql.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Dipirona', 'dipirona', 'solução 500 mg/mL 2 mL', 'teste'),
  ('Ceftriaxona', 'ceftriaxona', 'pó 1 g', 'teste');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'dip', id::text FROM public.medicamento WHERE principio_ativo_norm = 'dipirona' AND fonte = 'teste';
INSERT INTO t SELECT 'cef', id::text FROM public.medicamento WHERE principio_ativo_norm = 'ceftriaxona' AND fonte = 'teste';
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;

-- ── dois pacientes na porta, um com alergia a dipirona ──────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Lote Um","data_nascimento":"1970-03-03"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'ep2', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse', NULL,
  '{"nome":"Lote Dois","data_nascimento":"2018-04-04"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO t SELECT 'pac2', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep2');
INSERT INTO t VALUES ('nada', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
UPDATE public.episodios SET etapa = 'atendimento', atendimento_medico_id = '10000000-0000-4000-8000-000000000002',
       atendimento_iniciado_em = now() WHERE id IN (pg_temp.u('ep'), pg_temp.u('ep2'));

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.registrar_alergia(pg_temp.u('pac'), 'Dipirona', 'urticária', 'medicamento', 'grave', pg_temp.u('dip'));
SELECT public.registrar_nega_alergia(pg_temp.u('pac2'));

-- ── alergias: o lote devolve o mesmo que a leitura de um paciente ───────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
CREATE TEMP TABLE lote ON COMMIT DROP AS
  SELECT public.alergias_dos_pacientes(ARRAY[pg_temp.u('pac'), pg_temp.u('pac2'), pg_temp.u('pac'), NULL, pg_temp.u('nada')]) AS r;
SELECT pg_temp.confere((SELECT r -> pg_temp.u('pac')::text -> 'dados' FROM lote) = public.alergias_do_paciente(pg_temp.u('pac')),
  'alergias em lote: paciente com alergia igual à leitura de um paciente');
SELECT pg_temp.confere((SELECT r -> pg_temp.u('pac2')::text -> 'dados' FROM lote) = public.alergias_do_paciente(pg_temp.u('pac2')),
  'alergias em lote: paciente que nega igual à leitura de um paciente');
SELECT pg_temp.confere((SELECT r -> pg_temp.u('pac')::text -> 'dados' ->> 'estado' FROM lote) = 'tem'
  AND (SELECT r -> pg_temp.u('pac2')::text -> 'dados' ->> 'estado' FROM lote) = 'nega',
  'alergias em lote: estados "tem" e "nega" chegam certos');
SELECT pg_temp.confere((SELECT (SELECT count(*) FROM jsonb_object_keys(r)) FROM lote) = 3,
  'alergias em lote: repetido e nulo não duplicam; três chaves (dois pacientes e o inexistente)');
SELECT pg_temp.confere((SELECT r -> pg_temp.u('nada')::text ->> 'erro' FROM lote) LIKE 'Paciente não encontrado%',
  'alergias em lote: paciente inexistente volta com o erro dele, sem derrubar os outros');
SELECT pg_temp.confere(public.alergias_dos_pacientes('{}'::uuid[]) = '{}'::jsonb, 'alergias em lote: lista vazia devolve objeto vazio');

-- ── acuidade: o lote devolve o mesmo que a leitura de um paciente ───────────
SELECT pg_temp.confere((public.acuidade_dos_pacientes(ARRAY[pg_temp.u('pac'), pg_temp.u('pac2')]) -> pg_temp.u('pac')::text -> 'dados')
  = public.acuidade(pg_temp.u('pac')), 'acuidade em lote: adulto igual à leitura de um paciente');
SELECT pg_temp.confere((public.acuidade_dos_pacientes(ARRAY[pg_temp.u('pac'), pg_temp.u('pac2')]) -> pg_temp.u('pac2')::text -> 'dados')
  = public.acuidade(pg_temp.u('pac2')), 'acuidade em lote: criança igual à leitura de um paciente');

-- ── trava: o lote devolve o mesmo que a trava de um remédio ─────────────────
SELECT pg_temp.confere((public.alergia_trava_medicamentos(pg_temp.u('pac'), ARRAY[pg_temp.u('dip'), pg_temp.u('cef')]) ->> pg_temp.u('dip')::text)
  IS NOT DISTINCT FROM public.alergia_trava_medicamento(pg_temp.u('pac'), pg_temp.u('dip'))
  AND public.alergia_trava_medicamento(pg_temp.u('pac'), pg_temp.u('dip')) IS NOT NULL,
  'trava em lote: dipirona trava, igual à trava de um remédio');
SELECT pg_temp.confere((public.alergia_trava_medicamentos(pg_temp.u('pac'), ARRAY[pg_temp.u('dip'), pg_temp.u('cef')]) ->> pg_temp.u('cef')::text) IS NULL,
  'trava em lote: ceftriaxona não trava');

-- ── fora do plantão: o lote não lê nada ─────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.confere((public.alergias_dos_pacientes(ARRAY[pg_temp.u('pac')]) -> pg_temp.u('pac')::text ->> 'erro') LIKE 'Acesso negado%'
  AND (public.alergias_dos_pacientes(ARRAY[pg_temp.u('pac')]) -> pg_temp.u('pac')::text -> 'dados') IS NULL,
  'fora do plantão: alergias em lote voltam "Acesso negado", sem dados');
SELECT pg_temp.confere((public.acuidade_dos_pacientes(ARRAY[pg_temp.u('pac')]) -> pg_temp.u('pac')::text ->> 'erro') LIKE 'Acesso negado%',
  'fora do plantão: acuidade em lote volta "Acesso negado"');
SELECT pg_temp.confere((public.alergia_trava_medicamentos(pg_temp.u('pac'), ARRAY[pg_temp.u('dip')]) ->> pg_temp.u('dip')::text) IS NULL,
  'fora do plantão: a trava em lote não revela a alergia (igual à trava de um remédio)');
RESET ROLE;

-- ── só authenticated executa ────────────────────────────────────────────────
SELECT pg_temp.confere(NOT has_function_privilege('anon', 'public.alergias_dos_pacientes(uuid[])', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.acuidade_dos_pacientes(uuid[])', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.alergia_trava_medicamentos(uuid, uuid[])', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.alergias_dos_pacientes(uuid[])', 'EXECUTE'),
  'anon não executa as funções em lote; authenticated executa');

ROLLBACK;
