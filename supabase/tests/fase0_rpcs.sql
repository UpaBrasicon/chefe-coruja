-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20260926000001_fase0_endurecer_rpcs.sql
--
-- Roda num banco local (npx supabase start) — NUNCA contra produção:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase0_rpcs.sql
--
-- Tudo acontece dentro de uma transação que termina em ROLLBACK. Cada caso
-- imprime OK; o primeiro que falhar aborta com "FALHOU: <caso>".
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── Personagens ─────────────────────────────────────────────────────────────
--   gestor_a   gestor da unidade A
--   plant_a    plantonista de A, escalado AGORA no setor A1
--   cand_a     plantonista de A, com candidatura pendente
--   estranho   plantonista só da unidade B
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',      '00000000-0000-4000-8000-000000000001'),
  ('uni_a',    '00000000-0000-4000-8000-00000000000a'),
  ('uni_b',    '00000000-0000-4000-8000-00000000000b'),
  ('setor_a1', '00000000-0000-4000-8000-0000000000a1'),
  ('setor_b1', '00000000-0000-4000-8000-0000000000b1'),
  ('gestor_a', '00000000-0000-4000-8000-000000000101'),
  ('plant_a',  '00000000-0000-4000-8000-000000000102'),
  ('cand_a',   '00000000-0000-4000-8000-000000000103'),
  ('estranho', '00000000-0000-4000-8000-000000000104'),
  ('pac_a',    '00000000-0000-4000-8000-000000000201'),
  ('pac_porta','00000000-0000-4000-8000-000000000202'),
  ('cand',     '00000000-0000-4000-8000-000000000301'),
  ('cand_prop','00000000-0000-4000-8000-000000000302');
GRANT SELECT, INSERT ON ids TO authenticated, anon;

CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;

-- Age como o usuário `quem` (NULL = anônimo) até o próximo pg_temp.como().
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF quem IS NULL THEN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
  ELSE
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text) TO authenticated, anon;

-- ── Cenário (como postgres) ────────────────────────────────────────────────
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT id, nome || '@teste.local', json_build_object('nome_completo', nome)::jsonb
FROM ids WHERE nome IN ('gestor_a','plant_a','cand_a','estranho');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gestor_a','plant_a','cand_a','estranho')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('uni_a'), pg_temp.id('org'), 'Unidade A', 'hospital'),
  (pg_temp.id('uni_b'), pg_temp.id('org'), 'Unidade B', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('setor_a1'), pg_temp.id('uni_a'), 'Clínica A1', 'internacao'),
  (pg_temp.id('setor_b1'), pg_temp.id('uni_b'), 'Clínica B1', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gestor_a'), pg_temp.id('uni_a'), 'gestor'),
  (pg_temp.id('plant_a'),  pg_temp.id('uni_a'), 'plantonista'),
  (pg_temp.id('cand_a'),   pg_temp.id('uni_a'), 'plantonista'),
  (pg_temp.id('estranho'), pg_temp.id('uni_b'), 'plantonista');

-- o estranho também está de plantão agora — mas na unidade B
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('uni_a'), pg_temp.id('setor_a1'), pg_temp.id('plant_a'),  private.data_atual(), private.turno_atual()),
  (pg_temp.id('uni_b'), pg_temp.id('setor_b1'), pg_temp.id('estranho'), private.data_atual(), private.turno_atual());

INSERT INTO public.pacientes (id, unidade_id, nome, setor_id) VALUES
  (pg_temp.id('pac_a'),     pg_temp.id('uni_a'), 'Paciente A1', pg_temp.id('setor_a1')),
  (pg_temp.id('pac_porta'), pg_temp.id('uni_a'), 'Paciente da porta', NULL);
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, status, setor_atual_id)
VALUES (pg_temp.id('org'), pg_temp.id('uni_a'), pg_temp.id('pac_a'), 'internado', pg_temp.id('setor_a1'));

-- candidatura de cand_a para amanhã (a do próprio gestor é criada como gestor_a)
INSERT INTO public.candidaturas_escala (id, unidade_id, setor_id, data, turno, perfil_id) VALUES
  (pg_temp.id('cand'),      pg_temp.id('uni_a'), pg_temp.id('setor_a1'), private.data_atual() + 1, 'manha', pg_temp.id('cand_a')),
  (pg_temp.id('cand_prop'), pg_temp.id('uni_a'), pg_temp.id('setor_a1'), private.data_atual() + 2, 'manha', pg_temp.id('plant_a'));

-- Verifica que `sql` falha com erro; `caso` nomeia o teste.
CREATE FUNCTION pg_temp.deve_falhar(caso text, sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  recusado: % (%)', caso, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — deveria ter sido recusado', caso;
END $$;
CREATE FUNCTION pg_temp.deve_passar(caso text, sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  RAISE NOTICE 'OK  permitido: %', caso;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FALHOU: % — deveria ter passado (%)', caso, SQLERRM;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.deve_falhar(text, text), pg_temp.deve_passar(text, text) TO authenticated, anon;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Anônimo não executa nada
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE anon;
SELECT pg_temp.como(NULL);
SELECT pg_temp.deve_falhar('anon: dar_alta_internado',
  format('SELECT public.dar_alta_internado(%L, %L)', pg_temp.id('pac_a'), 'obito'));
SELECT pg_temp.deve_falhar('anon: plantonistas_da_unidade',
  format('SELECT * FROM public.plantonistas_da_unidade(%L)', pg_temp.id('uni_a')));
SELECT pg_temp.deve_falhar('anon: censo_recente',
  format('SELECT * FROM public.censo_recente(%L, 7)', pg_temp.id('uni_a')));
RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Estranho (só da unidade B) contra a unidade A
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('estranho');
SELECT pg_temp.deve_falhar('estranho dá alta/óbito a paciente de A',
  format('SELECT public.dar_alta_internado(%L, %L)', pg_temp.id('pac_a'), 'obito'));
SELECT pg_temp.deve_falhar('estranho aprova candidatura de A',
  format('SELECT public.aprovar_candidatura(%L)', pg_temp.id('cand')));
SELECT pg_temp.deve_falhar('estranho monta escala de A (guarda furada por NULL)',
  format('SELECT public.adicionar_plantao_escala(%L, %L, %L, %L::date, %L)',
         pg_temp.id('uni_a'), pg_temp.id('setor_a1'), pg_temp.id('estranho'), private.data_atual() + 3, 'tarde'));
SELECT pg_temp.deve_falhar('estranho gera escala mensal de A',
  format('SELECT public.gerar_escala_mensal(%L, 2026, 12)', pg_temp.id('uni_a')));
SELECT pg_temp.deve_falhar('estranho grava prescrição em paciente de A (guarda furada por NULL)',
  format('SELECT public.registrar_prescricao_itens(%L, %L, %L::jsonb)', pg_temp.id('pac_a'), 'x', '[]'));
SELECT pg_temp.deve_falhar('estranho transfere paciente de A (guarda furada por NULL)',
  format('SELECT public.transferir_internado(%L, %L)', pg_temp.id('pac_a'), pg_temp.id('setor_a1')));
SELECT pg_temp.deve_falhar('estranho abre internação em A',
  format('SELECT public.abrir_internacao(%L, %L)', pg_temp.id('pac_porta'), pg_temp.id('uni_a')));
SELECT pg_temp.deve_falhar('estranho lê plantonistas (nome, CRM, e-mail) de A',
  format('SELECT * FROM public.plantonistas_da_unidade(%L)', pg_temp.id('uni_a')));
SELECT pg_temp.deve_falhar('estranho lê presenças de A',
  format('SELECT * FROM public.presencas_do_dia_gestor(%L)', pg_temp.id('uni_a')));
SELECT pg_temp.deve_falhar('estranho lê censo de A',
  format('SELECT * FROM public.censo_recente(%L, 7)', pg_temp.id('uni_a')));
SELECT pg_temp.deve_falhar('estranho lê ocupação de A',
  format('SELECT * FROM public.ocupacao_setores(%L)', pg_temp.id('uni_a')));
SELECT pg_temp.deve_falhar('estranho grava auditoria em nome de A',
  format('SELECT public.registrar_auditoria(%L, %L, NULL, %L)', 'forjado', 'x', pg_temp.id('uni_a')));
SELECT pg_temp.deve_falhar('estranho escreve documento de paciente de A pela unidade B',
  format('SELECT public.salvar_documento(%L, %L, %L, %L)', pg_temp.id('pac_a'), pg_temp.id('uni_b'), 'evolucao', 'texto'));
SELECT pg_temp.deve_falhar('ninguém logado executa o censo de todas as unidades',
  'SELECT public.gerar_censo_todas_unidades()');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Plantonista de A: o que não pode e o que continua podendo
-- ════════════════════════════════════════════════════════════════════════════
SELECT pg_temp.como('plant_a');
SELECT pg_temp.deve_falhar('plantonista aprova a própria candidatura',
  format('SELECT public.aprovar_candidatura(%L)', pg_temp.id('cand_prop')));
SELECT pg_temp.deve_falhar('plantonista passa plantão para quem não é da unidade',
  format('SELECT public.passar_plantao((SELECT id FROM public.escala_plantao WHERE perfil_id = %L LIMIT 1), %L)',
         pg_temp.id('plant_a'), pg_temp.id('estranho')));
SELECT pg_temp.deve_falhar('plantonista lê presenças (é do gestor)',
  format('SELECT * FROM public.presencas_do_dia_gestor(%L)', pg_temp.id('uni_a')));

SELECT pg_temp.deve_passar('plantonista lê ocupação da própria unidade',
  format('SELECT * FROM public.ocupacao_setores(%L)', pg_temp.id('uni_a')));
SELECT pg_temp.deve_passar('plantonista lê colegas da própria unidade',
  format('SELECT * FROM public.plantonistas_da_unidade(%L)', pg_temp.id('uni_a')));
-- como no app: o id do episódio vem do retorno de abrir_internacao
SELECT pg_temp.deve_passar('plantonista em escala abre internação na porta',
  format('INSERT INTO ids VALUES (%L, public.abrir_internacao(%L, %L))',
         'int_porta', pg_temp.id('pac_porta'), pg_temp.id('uni_a')));
SELECT pg_temp.deve_passar('plantonista registra evento no episódio da porta (ainda sem setor)',
  format('SELECT public.registrar_evento_adt(%L, %L)', pg_temp.id('int_porta'), 'entrada_observacao'));
SELECT pg_temp.deve_passar('plantonista escalado no setor dá alta ao seu paciente',
  format('SELECT public.dar_alta_internado(%L, %L)', pg_temp.id('pac_a'), 'alta_melhorada'));

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Gestor de A
-- ════════════════════════════════════════════════════════════════════════════
SELECT pg_temp.como('gestor_a');
SELECT pg_temp.deve_falhar('gestor de A escala setor da unidade B (vazamento R3)',
  format('SELECT public.adicionar_plantao_escala(%L, %L, %L, %L::date, %L)',
         pg_temp.id('uni_a'), pg_temp.id('setor_b1'), pg_temp.id('plant_a'), private.data_atual() + 4, 'tarde'));
SELECT pg_temp.deve_falhar('gestor escala quem não tem vínculo na unidade',
  format('SELECT public.adicionar_plantao_escala(%L, %L, %L, %L::date, %L)',
         pg_temp.id('uni_a'), pg_temp.id('setor_a1'), pg_temp.id('estranho'), private.data_atual() + 4, 'tarde'));
SELECT pg_temp.deve_passar('gestor aprova candidatura de outro',
  format('SELECT public.aprovar_candidatura(%L)', pg_temp.id('cand')));
SELECT pg_temp.deve_falhar('candidatura já decidida não é aprovada de novo',
  format('SELECT public.aprovar_candidatura(%L)', pg_temp.id('cand')));
SELECT pg_temp.deve_passar('gestor lê presenças da unidade',
  format('SELECT * FROM public.presencas_do_dia_gestor(%L)', pg_temp.id('uni_a')));
SELECT pg_temp.deve_passar('gestor gera censo da unidade',
  format('SELECT public.gerar_censo_diario(%L, %L::date)', pg_temp.id('uni_a'), private.data_atual()));
SELECT pg_temp.deve_passar('gestor gera escala de dezembro (bug do mês 13)',
  format('SELECT public.gerar_escala_mensal(%L, 2026, 12)', pg_temp.id('uni_a')));
RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. O job agendado continua funcionando (roda como postgres)
-- ════════════════════════════════════════════════════════════════════════════
SELECT pg_temp.deve_passar('job: gerar_censo_todas_unidades como postgres',
  'SELECT public.gerar_censo_todas_unidades()');

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Nenhuma função de public executável por anon — exceto as da lista, que
--    são públicas de propósito e só leem o que o token delas permite.
--    painel_chamadas: TV da porta, por token (Fase 2.3).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE n int; nomes text;
BEGIN
  SELECT count(*), string_agg(p.proname, ', ') INTO n, nomes
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname NOT IN ('painel_chamadas');
  IF n > 0 THEN RAISE EXCEPTION 'FALHOU: % funções de public ainda executáveis por anon (%)', n, nomes; END IF;
  RAISE NOTICE 'OK  nenhuma função de public executável por anon (fora as públicas de propósito)';
END $$;

ROLLBACK;
