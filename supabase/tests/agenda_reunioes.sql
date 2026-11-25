-- Testes da migration 20270421000030 (agenda do administrador: reuniões com o
-- link colado; pedido do RT de 24/11/2026). Dados próprios. ROLLBACK no fim.
-- O administrador marca, edita e cancela; os convidados leem e recebem o aviso
-- no app; quem não foi convidado não lê (nem o administrador de outra rede);
-- quem não é administrador não marca; o link só aceita https://; convidado de
-- fora da organização é recusado; as tabelas não se escrevem direto.
BEGIN;
INSERT INTO auth.users (id, email)
SELECT ('e7a00000-0000-4000-8000-00000000000' || n)::uuid, 'reuniao' || n || '@agenda.local' FROM generate_series(1, 5) n
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('e7a00000-0000-4000-8000-000000000001', 'Admin Agenda'),
  ('e7a00000-0000-4000-8000-000000000002', 'Gestora Convidada'),
  ('e7a00000-0000-4000-8000-000000000003', 'Médico Convidado'),
  ('e7a00000-0000-4000-8000-000000000004', 'Admin Outra Rede'),
  ('e7a00000-0000-4000-8000-000000000005', 'Médica Outra Rede')
-- o gatilho de auth.users já cria o perfil com o nome do e-mail
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES
  ('e7a10000-0000-4000-8000-000000000001', 'Rede Agenda'),
  ('e7a10000-0000-4000-8000-000000000002', 'Rede Vizinha');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('e7a20000-0000-4000-8000-000000000001', 'e7a10000-0000-4000-8000-000000000001', 'UPA Agenda', 'upa'),
  ('e7a20000-0000-4000-8000-000000000002', 'e7a10000-0000-4000-8000-000000000001', 'UBS Agenda', 'ubs'),
  ('e7a20000-0000-4000-8000-000000000003', 'e7a10000-0000-4000-8000-000000000002', 'UPA Vizinha', 'upa');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('e7a00000-0000-4000-8000-000000000001', 'e7a20000-0000-4000-8000-000000000001', 'admin'),
  ('e7a00000-0000-4000-8000-000000000002', 'e7a20000-0000-4000-8000-000000000001', 'gestor'),
  ('e7a00000-0000-4000-8000-000000000003', 'e7a20000-0000-4000-8000-000000000001', 'plantonista'),
  ('e7a00000-0000-4000-8000-000000000003', 'e7a20000-0000-4000-8000-000000000002', 'plantonista'),
  ('e7a00000-0000-4000-8000-000000000004', 'e7a20000-0000-4000-8000-000000000003', 'admin'),
  ('e7a00000-0000-4000-8000-000000000005', 'e7a20000-0000-4000-8000-000000000003', 'plantonista');

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
-- avisos de reunião da pessoa (lidos como ela, pela RLS de notificacoes_plantonista)
CREATE FUNCTION pg_temp.avisos(p_acao text) RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.notificacoes_plantonista WHERE tipo LIKE 'reuniao_' || p_acao || '_%' $$;
GRANT EXECUTE ON FUNCTION pg_temp.avisos(text) TO authenticated;

-- ── o administrador marca a reunião ────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'r1', public.salvar_reuniao(NULL, 'e7a20000-0000-4000-8000-000000000001', '  Reunião da rede  ',
  current_date + 1, '10:00', '11:00', ' https://meet.google.com/abc-defg-hij ', 'Escala de dezembro',
  ARRAY['e7a00000-0000-4000-8000-000000000002', 'e7a00000-0000-4000-8000-000000000003',
        'e7a00000-0000-4000-8000-000000000001']::uuid[])::text;
SELECT pg_temp.igual((SELECT titulo || '|' || link || '|' || to_char(inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
                        FROM public.reunioes WHERE id = pg_temp.v('r1')),
  'Reunião da rede|https://meet.google.com/abc-defg-hij|10:00', 'marca com título e link sem espaços, no horário de Brasília');
SELECT pg_temp.igual((SELECT plataforma || ':' || jsonb_array_length(convidados) || ':' || sou_criador
                        FROM public.minhas_reunioes(current_date - 1, current_date + 7)),
  'Google Meet:2:true', 'a agenda mostra a plataforma e os dois convidados (quem marcou não se convida)');
SELECT pg_temp.igual((SELECT string_agg(nome, ',' ORDER BY nome)
                        FROM public.pessoas_para_reuniao('e7a20000-0000-4000-8000-000000000001', 'conv')),
  'Gestora Convidada,Médico Convidado', 'a busca acha as pessoas da organização');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.pessoas_para_reuniao('e7a20000-0000-4000-8000-000000000001', 'outra rede')),
  '0', 'a busca não acha gente de outra organização');

SELECT pg_temp.falha($$SELECT public.salvar_reuniao(NULL, 'e7a20000-0000-4000-8000-000000000001', 'Reunião', current_date + 1,
  '10:00', '11:00', 'http://meet.google.com/abc', NULL, NULL)$$, 'Cole o endereço completo', 'link sem https é recusado');
SELECT pg_temp.falha($$SELECT public.salvar_reuniao(NULL, 'e7a20000-0000-4000-8000-000000000001', 'Reunião', current_date + 1,
  '10:00', '11:00', 'javascript:alert(1)', NULL, NULL)$$, 'Cole o endereço completo', 'link javascript: é recusado');
SELECT pg_temp.falha($$SELECT public.salvar_reuniao(NULL, 'e7a20000-0000-4000-8000-000000000001', 'Reunião', current_date + 1,
  '10:00', '11:00', 'https://meet.google.com@golpe.com/x', NULL, NULL)$$, 'Cole o endereço completo', 'link com usuário@endereço é recusado');
SELECT pg_temp.falha($$SELECT public.salvar_reuniao(NULL, 'e7a20000-0000-4000-8000-000000000001', 'Reunião', current_date + 1,
  '11:00', '10:00', NULL, NULL, NULL)$$, 'O fim tem de ser depois', 'fim antes do início é recusado');
SELECT pg_temp.falha($$SELECT public.salvar_reuniao(NULL, 'e7a20000-0000-4000-8000-000000000001', 'Reunião', current_date + 1,
  '10:00', '11:00', NULL, NULL, ARRAY['e7a00000-0000-4000-8000-000000000005']::uuid[])$$,
  'Só pessoas da organização', 'convidado de outra organização é recusado');
SELECT pg_temp.falha($$INSERT INTO public.reunioes (organizacao_id, criado_por, titulo, inicio, fim)
  VALUES ('e7a10000-0000-4000-8000-000000000001', 'e7a00000-0000-4000-8000-000000000001', 'direto', now(), now() + interval '1 hour')$$,
  'permission denied', 'não se escreve direto na tabela de reuniões');
SELECT pg_temp.falha(format($q$INSERT INTO public.reuniao_convidados (reuniao_id, perfil_id) VALUES (%L, 'e7a00000-0000-4000-8000-000000000005')$q$,
  pg_temp.v('r1')), 'permission denied', 'não se escreve direto na lista de convidados');

-- ── os convidados leem e recebem o aviso ───────────────────────────────────
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000002');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.reunioes), '1', 'a convidada lê a reunião');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.reuniao_convidados), '2', 'a convidada vê a lista de convidados');
SELECT pg_temp.igual((SELECT sou_criador::text || ':' || criador_nome FROM public.minhas_reunioes(current_date - 1, current_date + 7)),
  'false:Admin Agenda', 'a agenda da convidada mostra quem marcou');
SELECT pg_temp.igual(pg_temp.avisos('convite'), '1', 'a convidada recebe o convite no app');
SELECT pg_temp.falha($$SELECT public.salvar_reuniao(NULL, 'e7a20000-0000-4000-8000-000000000001', 'Reunião da gestão', current_date + 1,
  '10:00', '11:00', NULL, NULL, NULL)$$, 'Acesso negado', 'quem não é administrador não marca');
SELECT pg_temp.falha(format($q$SELECT public.cancelar_reuniao(%L)$q$, pg_temp.v('r1')), 'Reunião não encontrada', 'a convidada não cancela');
SELECT pg_temp.falha($$SELECT * FROM public.pessoas_para_reuniao('e7a20000-0000-4000-8000-000000000001', 'adm')$$,
  'Acesso negado', 'quem não é administrador não busca pessoas');
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000003');
SELECT pg_temp.igual(pg_temp.avisos('convite'), '2', 'o médico com duas unidades na rede recebe o convite nas duas');

-- ── quem não foi convidado não lê ───────────────────────────────────────────
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000004');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.reunioes), '0', 'o administrador de outra rede não lê a reunião');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.reuniao_convidados), '0', 'nem a lista de convidados');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.minhas_reunioes(current_date - 1, current_date + 7)), '0', 'nem pela agenda');
SELECT pg_temp.falha(format($q$SELECT public.salvar_reuniao(%L, NULL, 'Invadida', current_date + 1, '10:00', '11:00', NULL, NULL, NULL)$q$,
  pg_temp.v('r1')), 'Reunião não encontrada', 'o administrador de outra rede não edita');
SELECT pg_temp.falha($$SELECT * FROM public.pessoas_para_reuniao('e7a20000-0000-4000-8000-000000000001', 'conv')$$,
  'Acesso negado', 'o administrador de outra rede não busca pessoas desta');
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000005');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.reunioes), '0', 'a médica de outra rede não lê');

-- ── o administrador muda o horário e tira um convidado ─────────────────────
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000001');
SELECT public.salvar_reuniao(pg_temp.v('r1'), NULL, 'Reunião da rede', current_date + 1, '14:00', '15:30',
  'https://us02web.zoom.us/j/123456789?pwd=abc', 'Escala de dezembro', ARRAY['e7a00000-0000-4000-8000-000000000002']::uuid[]);
SELECT pg_temp.igual((SELECT plataforma || ':' || to_char(inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ':' || jsonb_array_length(convidados)
                        FROM public.minhas_reunioes(current_date - 1, current_date + 7)),
  'Zoom:14:00:1', 'a edição troca o horário, o link e a lista');
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000002');
SELECT pg_temp.igual(pg_temp.avisos('alterada'), '1', 'a convidada mantida recebe a mudança');
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000003');
SELECT pg_temp.igual(pg_temp.avisos('retirado'), '2', 'o médico retirado é avisado');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.reunioes), '0', 'o médico retirado não lê mais a reunião');

-- ── cancelamento ────────────────────────────────────────────────────────────
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000001');
SELECT public.cancelar_reuniao(pg_temp.v('r1'));
SELECT pg_temp.igual((SELECT cancelada::text FROM public.minhas_reunioes(current_date - 1, current_date + 7)), 'true',
  'a reunião cancelada continua na agenda, marcada');
SELECT pg_temp.falha(format($q$SELECT public.salvar_reuniao(%L, NULL, 'De novo', current_date + 1, '10:00', '11:00', NULL, NULL, NULL)$q$,
  pg_temp.v('r1')), 'A reunião foi cancelada', 'reunião cancelada não se edita');
SELECT pg_temp.como('e7a00000-0000-4000-8000-000000000002');
SELECT pg_temp.igual(pg_temp.avisos('cancelada'), '1', 'a convidada recebe o cancelamento');
RESET ROLE;
SELECT pg_temp.igual((SELECT count(*)::text FROM public.log_auditoria WHERE entidade = 'reunioes' AND entidade_id = pg_temp.v('r1')),
  '3', 'criar, alterar e cancelar ficam na auditoria');

SET LOCAL ROLE anon;
SELECT pg_temp.falha($$SELECT * FROM public.minhas_reunioes(current_date, current_date)$$, 'permission denied', 'anônimo não chama');
RESET ROLE;

ROLLBACK;
