-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000013_ubs_prescricao_enfermeiro.sql (percurso
-- da UBS, U6, PR 3b). Tudo em transação com ROLLBACK; o cenário é criado aqui.
-- Os medicamentos abaixo são dado de teste, não conteúdo clínico do app.
--
-- 1. o gestor marca o protocolo de enfermagem com o documento de origem;
-- 2. o enfermeiro emite na consulta de enfermagem só o item do protocolo, como
--    está, e nunca controle especial;
-- 3. a recepção não emite receita; o médico segue como antes.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000087a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000087a2'),
  ('cons', '00000000-0000-4000-8000-0000000087a3'),
  ('rec',  '00000000-0000-4000-8000-0000000087b1'),
  ('enf',  '00000000-0000-4000-8000-0000000087b2'),
  ('med',  '00000000-0000-4000-8000-0000000087b3'),
  ('ges',  '00000000-0000-4000-8000-0000000087b4');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@u6r.local' FROM ids WHERE nome IN ('rec', 'enf', 'med', 'ges');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med', 'ges')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U6 receita');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U6 receita', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'enf', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
-- ── 1. protocolo de enfermagem ──────────────────────────────────────────────
SELECT pg_temp.como('ges');
INSERT INTO v SELECT 'prot', public.salvar_receita_protocolo(pg_temp.id('ubs'), 'Protocolo de teste da enfermagem', 'Teste',
  '[{"medicamento":"Medicamento de teste A","posologia":"1 comprimido ao dia","quantidade":"30 comprimidos"}]', NULL, true, 'v1', 'Protocolo municipal de teste, versão 1, 2026');
SELECT pg_temp.falha($$SELECT public.definir_protocolo_enfermagem(pg_temp.v('prot'), true, NULL, '2026-01-10', 'Secretaria Municipal de Saúde')$$,
  'Informe o número do documento de origem', '1. marcar sem o número do documento, recusa');
SELECT public.definir_protocolo_enfermagem(pg_temp.v('prot'), true, 'Portaria SMS 12/2026', '2026-01-10', 'Secretaria Municipal de Saúde');
SELECT pg_temp.ok((SELECT (x ->> 'enfermagem')::boolean AND x ->> 'origem_numero' = 'Portaria SMS 12/2026'
                     FROM jsonb_array_elements(public.receita_protocolos_da_unidade(pg_temp.id('ubs'))) x WHERE (x ->> 'id')::uuid = pg_temp.v('prot')),
  '1. a lista da unidade devolve a marca e a origem');
SELECT pg_temp.como('enf');
SELECT pg_temp.falha($$SELECT public.definir_protocolo_enfermagem(pg_temp.v('prot'), false)$$,
  'Só o gestor da unidade marca', '1. o enfermeiro não marca protocolo');

-- fichas
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'enf', (public.registrar_ficha(pg_temp.id('cons'), 'Consulta de enfermagem', NULL,
  '{"nome":"Paciente Receita Enf","data_nascimento":"1990-01-01","tipo_atendimento":"consulta_programada","destino":"enfermagem"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'med', (public.registrar_ficha(pg_temp.id('cons'), 'Consulta médica', NULL,
  '{"nome":"Paciente Receita Med","data_nascimento":"1980-01-01","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'pac_enf', paciente_id FROM public.episodios WHERE id = pg_temp.v('enf');
INSERT INTO v SELECT 'pac_med', paciente_id FROM public.episodios WHERE id = pg_temp.v('med');

-- ── 3. a recepção não emite receita ─────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.emitir_documento(pg_temp.v('pac_enf'), 'receita', '{"paciente":{"nome":"Teste"},"receita":{"tipo":"branca","obs":"","itens":[{"medicamento":"Medicamento de teste A","posologia":"1 comprimido ao dia","quantidade":"30 comprimidos"}]}}', pg_temp.v('enf'))$$,
  'Falta para emitir: A receita é do médico', '3. a recepção não emite receita');

-- ── 2. o enfermeiro ─────────────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT public.iniciar_atendimento(pg_temp.v('enf'));
SELECT pg_temp.falha($$SELECT public.emitir_documento(pg_temp.v('pac_enf'), 'receita',
  '{"paciente":{"nome":"Teste"},"receita":{"tipo":"branca","obs":"","itens":[{"medicamento":"Medicamento de teste A","posologia":"2 comprimidos ao dia","quantidade":"30 comprimidos"}]}}', pg_temp.v('enf'))$$,
  'Falta para emitir: Medicamento de teste A: fora do protocolo', '2. posologia diferente do protocolo, recusa');
SELECT pg_temp.falha($$SELECT public.emitir_documento(pg_temp.v('pac_enf'), 'receita',
  '{"paciente":{"nome":"Teste"},"receita":{"tipo":"branca","obs":"","itens":[{"medicamento":"Medicamento de teste A","posologia":"1 comprimido ao dia","quantidade":"30 comprimidos","controle_especial":true}]}}', pg_temp.v('enf'))$$,
  'Falta para emitir:', '2. controle especial, recusa');
SELECT pg_temp.falha($$SELECT public.emitir_documento(pg_temp.v('pac_med'), 'receita', '{"paciente":{"nome":"Teste"},"receita":{"tipo":"branca","obs":"","itens":[{"medicamento":"Medicamento de teste A","posologia":"1 comprimido ao dia","quantidade":"30 comprimidos"}]}}', pg_temp.v('med'))$$,
  'Falta para emitir: A receita é do médico', '2. fora da consulta de enfermagem, recusa');
SELECT pg_temp.ok(public.emitir_documento(pg_temp.v('pac_enf'), 'receita', '{"paciente":{"nome":"Teste"},"receita":{"tipo":"branca","obs":"","itens":[{"medicamento":"Medicamento de teste A","posologia":"1 comprimido ao dia","quantidade":"30 comprimidos"}]}}', pg_temp.v('enf')) IS NOT NULL,
  '2. o enfermeiro emite o item do protocolo como está');

-- ── 3. o médico segue como antes ────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('med'));
SELECT pg_temp.ok(public.emitir_documento(pg_temp.v('pac_med'), 'receita',
  '{"paciente":{"nome":"Teste"},"receita":{"tipo":"branca","obs":"","itens":[{"medicamento":"Medicamento livre do médico","posologia":"1 vez ao dia","quantidade":"10"}]}}', pg_temp.v('med')) IS NOT NULL,
  '3. o médico emite receita livre');
RESET ROLE;

-- o CHECK: protocolo de enfermagem publicado sem origem não grava
SELECT pg_temp.falha($$UPDATE public.receita_protocolos SET origem_numero = NULL WHERE id = pg_temp.v('prot')$$,
  'new row for relation "receita_protocolos" violates check constraint', '1. publicado sem origem não grava');

ROLLBACK;
