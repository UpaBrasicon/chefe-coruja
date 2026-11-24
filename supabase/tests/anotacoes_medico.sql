-- Testes da migration 20270419000003 (anotações pessoais do médico, pedido 7;
-- AN1 a AN4 = A do RT em 23/11/2026). Dados próprios. ROLLBACK no fim.
-- O médico cria, edita, marca feita, fixa e apaga as próprias notas; ninguém
-- mais lê (nem o outro médico, nem o gestor); quem não é médico não escreve;
-- texto vazio ou com mais de 1.000 letras é recusado; a rotina apaga o que
-- passou 30 dias sem mudança; a tabela não se escreve direto.
BEGIN;
INSERT INTO auth.users (id, email)
SELECT ('aa000000-0000-4000-8000-00000000000' || n)::uuid, 'nota' || n || '@notas.local' FROM generate_series(1, 3) n
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('aa000000-0000-4000-8000-000000000001', 'Médica Notas'),
  ('aa000000-0000-4000-8000-000000000002', 'Médico Vizinho'),
  ('aa000000-0000-4000-8000-000000000003', 'Gestora Notas')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES ('aa100000-0000-4000-8000-000000000001', 'Rede Notas');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('aa200000-0000-4000-8000-000000000001', 'aa100000-0000-4000-8000-000000000001', 'UPA Notas', 'upa');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('aa000000-0000-4000-8000-000000000001', 'aa200000-0000-4000-8000-000000000001', 'plantonista'),
  ('aa000000-0000-4000-8000-000000000002', 'aa200000-0000-4000-8000-000000000001', 'telemedicina'),
  ('aa000000-0000-4000-8000-000000000003', 'aa200000-0000-4000-8000-000000000001', 'gestor');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.igual(p_obtido text, p_esperado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtido IS DISTINCT FROM p_esperado THEN
    RAISE EXCEPTION 'FALHOU: % — esperado %, veio %', p_ok, p_esperado, p_obtido;
  END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.igual(text, text, text) TO authenticated;

-- ── a médica usa as próprias notas ──────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('aa000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'n1', public.salvar_anotacao(NULL, '  Ligar para o laboratório às 15h  ')::text;
INSERT INTO t SELECT 'n2', public.salvar_anotacao(NULL, 'Pedir troca do dia 30')::text;
SELECT public.salvar_anotacao(pg_temp.v('n2'), 'Pedir troca do dia 30 com a Dra. X');
SELECT public.marcar_anotacao(pg_temp.v('n1'), true, NULL);
SELECT public.marcar_anotacao(pg_temp.v('n2'), NULL, true);
SELECT pg_temp.igual((SELECT string_agg(texto || ':' || feita || ':' || fixada, ' | ' ORDER BY criada_em) FROM public.anotacoes_medico),
  'Ligar para o laboratório às 15h:true:false | Pedir troca do dia 30 com a Dra. X:false:true',
  'cria (sem espaços nas pontas), edita, marca feita e fixa');
SELECT pg_temp.falha($$SELECT public.salvar_anotacao(NULL, '   ')$$, 'Escreva a anotação', 'nota vazia é recusada');
SELECT pg_temp.falha(format($q$SELECT public.salvar_anotacao(NULL, %L)$q$, repeat('a', 1001)), 'Escreva a anotação', 'mais de 1.000 letras é recusado');
SELECT pg_temp.falha($$INSERT INTO public.anotacoes_medico (perfil_id, texto) VALUES ('aa000000-0000-4000-8000-000000000001', 'x')$$,
  'permission denied', 'não se escreve direto na tabela');

-- ── ninguém mais lê nem mexe ───────────────────────────────────────────────
SELECT pg_temp.como('aa000000-0000-4000-8000-000000000002');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.anotacoes_medico), '0', 'o outro médico não lê as notas dela');
SELECT pg_temp.falha(format($q$SELECT public.apagar_anotacao(%L)$q$, pg_temp.v('n1')), 'Anotação não encontrada', 'o outro médico não apaga');
SELECT pg_temp.falha(format($q$SELECT public.salvar_anotacao(%L, 'mudei')$q$, pg_temp.v('n1')), 'Anotação não encontrada', 'o outro médico não edita');
INSERT INTO t SELECT 'n3', public.salvar_anotacao(NULL, 'Nota do médico da telemedicina')::text;
SELECT pg_temp.como('aa000000-0000-4000-8000-000000000003');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.anotacoes_medico), '0', 'a gestora não lê');
SELECT pg_temp.falha($$SELECT public.salvar_anotacao(NULL, 'lembrete')$$, 'Acesso negado', 'quem não é médico não escreve');

-- ── a médica apaga uma; a rotina apaga a velha ─────────────────────────────
SELECT pg_temp.como('aa000000-0000-4000-8000-000000000001');
SELECT public.apagar_anotacao(pg_temp.v('n1'));
RESET ROLE;
UPDATE public.anotacoes_medico SET alterada_em = now() - interval '31 days' WHERE id = pg_temp.v('n2');
SELECT pg_temp.igual((SELECT private.apagar_anotacoes_vencidas() >= 1)::text, 'true', 'a rotina apaga o que passou 30 dias sem mudança');
SELECT pg_temp.igual((SELECT string_agg(texto, ',') FROM public.anotacoes_medico
                       WHERE perfil_id IN ('aa000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000002')),
  'Nota do médico da telemedicina', 'sobra só a nota recente do outro médico');
SELECT pg_temp.igual((SELECT count(*)::text FROM cron.job WHERE jobname = 'anotacoes-medico-30-dias'), '1', 'a rotina diária está agendada');

SET LOCAL ROLE anon;
SELECT pg_temp.falha($$SELECT public.salvar_anotacao(NULL, 'x')$$, 'permission denied', 'anônimo não chama');
RESET ROLE;

ROLLBACK;
