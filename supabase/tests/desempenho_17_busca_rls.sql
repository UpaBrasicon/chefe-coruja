-- Testes da migration 20270320000002 (item 17 do kit de desempenho): busca de
-- paciente com índices, políticas RLS com auth.uid() avaliado uma vez e
-- índices nas chaves das tabelas que crescem. ROLLBACK no fim.
-- A busca em si (nome sem acento, CPF mascarado) já é testada em
-- fase2_ficha_episodio.sql; aqui, que cada ramo acha e usa índice.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000005';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005',
        private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id = '10000000-0000-4000-8000-000000000005'
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;

-- ── um paciente com nome, mãe, CPF e prontuário ─────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000005', 'role', 'authenticated')::text, true);
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Zuleica Índice Teste","data_nascimento":"1970-03-03","nome_mae":"Raimunda Trigram","cpf":"52998224725"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
UPDATE public.pacientes SET prontuario = 'PR-77.123-4' WHERE id = pg_temp.u('pac');

-- ── cada ramo da busca acha o paciente ──────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.buscar_pacientes('21000000-0000-4000-8000-000000000001', 'zuleica indice') b WHERE b.id = pg_temp.u('pac')),
  'busca por nome (sem acento) acha');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.buscar_pacientes('21000000-0000-4000-8000-000000000001', 'raimunda trig') b WHERE b.id = pg_temp.u('pac')),
  'busca pelo nome da mãe acha');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.buscar_pacientes('21000000-0000-4000-8000-000000000001', '529.982.247-25') b WHERE b.id = pg_temp.u('pac')),
  'busca por CPF (com pontuação) acha');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.buscar_pacientes('21000000-0000-4000-8000-000000000001', '771234') b WHERE b.id = pg_temp.u('pac')),
  'busca pelos dígitos do prontuário acha');
SELECT pg_temp.confere((SELECT count(*) FROM public.buscar_pacientes('21000000-0000-4000-8000-000000000001', 'zuleica indice')) = 1,
  'o mesmo paciente achado por mais de um ramo sai uma vez só');
RESET ROLE;

-- ── os índices existem e o ramo do nome usa o trigram ───────────────────────
SELECT pg_temp.confere((SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN
  ('pacientes_nome_trgm', 'pacientes_nome_social_trgm', 'pacientes_nome_mae_trgm', 'pacientes_prontuario_digitos')) = 4,
  'quatro índices da busca de paciente');
SET LOCAL enable_seqscan = off;
CREATE FUNCTION pg_temp.plano() RETURNS text LANGUAGE plpgsql AS $$
DECLARE l text; r text := '';
BEGIN
  FOR l IN EXPLAIN SELECT 1 FROM public.pacientes p WHERE private.nome_comparavel(p.nome) LIKE '%zuleica%' LOOP r := r || l; END LOOP;
  RETURN r;
END $$;
SELECT pg_temp.confere(pg_temp.plano() LIKE '%pacientes_nome_trgm%', 'o LIKE no nome comparável pode usar o índice trigram');
RESET enable_seqscan;
SELECT pg_temp.confere((SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%\_fk\_idx') >= 52,
  'índices nas chaves estrangeiras das tabelas que crescem');

-- ── políticas: auth.uid() dentro de SELECT (uma vez por consulta) ───────────
SELECT pg_temp.confere((SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
  AND policyname IN ('aceites_termo_select', 'adesoes_contrato_select', 'clinical_search_feedback_select', 'dispositivos_confiaveis_proprios',
                     'dispositivos_confiaveis_remover', 'preferencias_aviso_insert', 'preferencias_aviso_select', 'preferencias_aviso_update')
  AND coalesce(qual, '') || coalesce(with_check, '') ILIKE '%SELECT auth.uid()%'
  AND coalesce(qual, '') || coalesce(with_check, '') NOT ILIKE '%= auth.uid()%') = 8,
  'as 8 políticas do advisor usam (SELECT auth.uid())');

-- ── a regra das políticas não mudou: cada um vê só as próprias preferências ──
INSERT INTO public.preferencias_aviso (perfil_id, chave, ligado) VALUES ('10000000-0000-4000-8000-000000000005', 'leito_novo', true) ON CONFLICT DO NOTHING;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000004', 'role', 'authenticated')::text, true);
SELECT pg_temp.confere(NOT EXISTS (SELECT 1 FROM public.preferencias_aviso WHERE perfil_id = '10000000-0000-4000-8000-000000000005'),
  'outra pessoa não vê as preferências de aviso de quem não é ela');
SELECT set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000005', 'role', 'authenticated')::text, true);
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.preferencias_aviso WHERE perfil_id = '10000000-0000-4000-8000-000000000005'),
  'a própria pessoa vê as suas preferências de aviso');
RESET ROLE;

ROLLBACK;
