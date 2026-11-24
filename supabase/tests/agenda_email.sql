-- Testes da migration 20270421000031 (e-mail aos convidados da agenda do
-- administrador). Dados próprios. ROLLBACK no fim.
-- O aviso no app põe o e-mail na fila (convite, alterada, retirado, cancelada);
-- só o serviço reserva e anota; quem não marcou a reunião não reserva; o
-- navegador não lê a fila nem os e-mails; a reserva não entrega a mesma linha
-- duas vezes; falhou volta para a fila.
BEGIN;
INSERT INTO auth.users (id, email)
SELECT ('e7b00000-0000-4000-8000-00000000000' || n)::uuid,
       CASE WHEN n = 4 THEN 'sem-email' || n || '@agenda.local' ELSE 'reuniao' || n || '@agenda-email.test' END
  FROM generate_series(1, 5) n
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('e7b00000-0000-4000-8000-000000000001', 'Admin Email'),
  ('e7b00000-0000-4000-8000-000000000002', 'Gestora Email'),
  ('e7b00000-0000-4000-8000-000000000003', 'Médico Email'),
  ('e7b00000-0000-4000-8000-000000000004', 'Técnica Sem Email'),
  ('e7b00000-0000-4000-8000-000000000005', 'Outro Admin')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES ('e7b10000-0000-4000-8000-000000000001', 'Rede Email');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('e7b20000-0000-4000-8000-000000000001', 'e7b10000-0000-4000-8000-000000000001', 'UPA Email', 'upa'),
  ('e7b20000-0000-4000-8000-000000000002', 'e7b10000-0000-4000-8000-000000000001', 'UBS Email', 'ubs');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('e7b00000-0000-4000-8000-000000000001', 'e7b20000-0000-4000-8000-000000000001', 'admin'),
  ('e7b00000-0000-4000-8000-000000000002', 'e7b20000-0000-4000-8000-000000000001', 'gestor'),
  ('e7b00000-0000-4000-8000-000000000003', 'e7b20000-0000-4000-8000-000000000001', 'plantonista'),
  ('e7b00000-0000-4000-8000-000000000003', 'e7b20000-0000-4000-8000-000000000002', 'plantonista'),
  ('e7b00000-0000-4000-8000-000000000004', 'e7b20000-0000-4000-8000-000000000001', 'tecnico_enfermagem'),
  ('e7b00000-0000-4000-8000-000000000005', 'e7b20000-0000-4000-8000-000000000001', 'admin');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, service_role;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated, service_role;
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
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, service_role;
CREATE FUNCTION pg_temp.igual(p_obtido text, p_esperado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtido IS DISTINCT FROM p_esperado THEN
    RAISE EXCEPTION 'FALHOU: % — esperado %, veio %', p_ok, p_esperado, p_obtido;
  END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.igual(text, text, text) TO authenticated, service_role;
-- a fila da reunião, como texto ordenado: "evento:perfil final:situacao"
CREATE FUNCTION pg_temp.fila(p_reuniao text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT string_agg(e.evento || ':' || right(e.perfil_id::text, 1) || ':' || e.situacao, ',' ORDER BY e.id)
    FROM private.reuniao_emails e WHERE e.reuniao_id = p_reuniao::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.fila(text) TO authenticated, service_role;

-- ── marcar põe o convite na fila (uma linha por pessoa, não por unidade) ───
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('e7b00000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'r1', public.salvar_reuniao(NULL, 'e7b20000-0000-4000-8000-000000000001', 'Reunião do e-mail',
  current_date + 1, '10:00', '11:00', 'https://meet.google.com/abc-defg-hij', 'Escala',
  ARRAY['e7b00000-0000-4000-8000-000000000002', 'e7b00000-0000-4000-8000-000000000003',
        'e7b00000-0000-4000-8000-000000000004']::uuid[])::text;
SELECT pg_temp.igual(pg_temp.fila(pg_temp.v('r1')), 'convite:2:pendente,convite:3:pendente,convite:4:pendente',
  'o convite entra na fila uma vez por pessoa (o médico com duas unidades também)');
SELECT pg_temp.falha('SELECT count(*) FROM private.reuniao_emails', 'permission denied', 'o navegador não lê a fila');
SELECT pg_temp.falha(format('SELECT public.reuniao_emails_reservar(%L, NULL, NULL)', pg_temp.v('r1')),
  'permission denied', 'o navegador não reserva (nem vê os e-mails)');
SELECT pg_temp.falha('SELECT public.reuniao_emails_concluir(ARRAY[1]::bigint[], ''enviado'')',
  'permission denied', 'o navegador não anota envio');

-- ── a função reserva como serviço, com quem chamou ─────────────────────────
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT pg_temp.falha(format('SELECT public.reuniao_emails_reservar(%L, %L, NULL)', pg_temp.v('r1'), 'e7b00000-0000-4000-8000-000000000005'),
  'Reunião não encontrada', 'outro administrador (não quem marcou) não reserva');
INSERT INTO t SELECT 'res1', public.reuniao_emails_reservar(pg_temp.v('r1')::uuid, 'e7b00000-0000-4000-8000-000000000001', NULL)::text;
SELECT pg_temp.igual((SELECT string_agg(x->>'evento' || ':' || coalesce(x->>'email', '-'), ',' ORDER BY (x->>'id')::bigint)
                        FROM jsonb_array_elements(pg_temp.v('res1')::jsonb->'pendentes') x),
  'convite:reuniao2@agenda-email.test,convite:reuniao3@agenda-email.test,convite:-',
  'quem marcou reserva; a conta de teste (.local) vem sem e-mail');
SELECT pg_temp.igual(pg_temp.v('res1')::jsonb->'reuniao'->>'plataforma' || '|' || (pg_temp.v('res1')::jsonb->'reuniao'->>'criador_nome'),
  'Google Meet|Admin Email', 'a reserva traz a plataforma e quem marcou');
SELECT pg_temp.igual(jsonb_array_length(public.reuniao_emails_reservar(pg_temp.v('r1')::uuid, NULL, NULL)->'pendentes')::text, '0',
  'a mesma linha não é reservada duas vezes');
SELECT pg_temp.igual(public.reuniao_emails_concluir(ARRAY(SELECT (x->>'id')::bigint FROM jsonb_array_elements(pg_temp.v('res1')::jsonb->'pendentes') x
                                                            WHERE x->>'email' IS NOT NULL), 'enviado')::text, '2', 'anota os enviados');
SELECT pg_temp.igual(public.reuniao_emails_concluir(ARRAY(SELECT (x->>'id')::bigint FROM jsonb_array_elements(pg_temp.v('res1')::jsonb->'pendentes') x
                                                            WHERE x->>'email' IS NULL), 'sem_email')::text, '1', 'anota quem está sem e-mail');
SELECT pg_temp.falha('SELECT public.reuniao_emails_concluir(ARRAY[1]::bigint[], ''apagado'')', 'Situação inválida', 'situação fora da lista é recusada');
SELECT pg_temp.falha(format('SELECT public.reuniao_emails_reservar(%L, NULL, %L)', pg_temp.v('r1'), 'outro'), 'Evento inválido', 'evento fora da lista é recusado');

-- ── editar: mudança para quem fica, retirada para quem sai ─────────────────
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('e7b00000-0000-4000-8000-000000000001');
SELECT public.salvar_reuniao(pg_temp.v('r1')::uuid, NULL, 'Reunião do e-mail', current_date + 1, '14:00', '15:00',
  'https://meet.google.com/abc-defg-hij', 'Escala', ARRAY['e7b00000-0000-4000-8000-000000000002']::uuid[]);
RESET ROLE;
SELECT pg_temp.igual(pg_temp.fila(pg_temp.v('r1')),
  'convite:2:enviado,convite:3:enviado,convite:4:sem_email,alterada:2:pendente,retirado:3:pendente,retirado:4:pendente',
  'a edição põe a mudança e as retiradas na fila');

-- ── falhou volta para a fila; o filtro por evento funciona ─────────────────
SET LOCAL ROLE service_role;
INSERT INTO t SELECT 'res2', public.reuniao_emails_reservar(pg_temp.v('r1')::uuid, NULL, 'alterada')::text;
SELECT pg_temp.igual(jsonb_array_length(pg_temp.v('res2')::jsonb->'pendentes')::text, '1', 'o serviço (sem quem) reserva só a mudança, pelo filtro');
SELECT public.reuniao_emails_concluir(ARRAY(SELECT (x->>'id')::bigint FROM jsonb_array_elements(pg_temp.v('res2')::jsonb->'pendentes') x), 'falhou');
SELECT pg_temp.igual(jsonb_array_length(public.reuniao_emails_reservar(pg_temp.v('r1')::uuid, NULL, 'alterada')->'pendentes')::text, '1',
  'o que falhou volta para a fila');
RESET ROLE;

-- ── cancelar ────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('e7b00000-0000-4000-8000-000000000001');
SELECT public.cancelar_reuniao(pg_temp.v('r1')::uuid);
RESET ROLE;
SELECT pg_temp.igual((SELECT count(*)::text FROM private.reuniao_emails WHERE reuniao_id = pg_temp.v('r1')::uuid AND evento = 'cancelada'),
  '1', 'o cancelamento põe a convidada que ficou na fila');

-- ── a fila velha é descartada ──────────────────────────────────────────────
UPDATE private.reuniao_emails SET criado_em = now() - interval '3 days' WHERE reuniao_id = pg_temp.v('r1')::uuid AND situacao = 'pendente';
SET LOCAL ROLE service_role;
SELECT pg_temp.igual(jsonb_array_length(public.reuniao_emails_reservar(pg_temp.v('r1')::uuid, NULL, NULL)->'pendentes')::text, '0',
  'pendente com mais de 2 dias não sai mais');
RESET ROLE;
SELECT pg_temp.igual((SELECT count(*)::text FROM private.reuniao_emails WHERE reuniao_id = pg_temp.v('r1')::uuid AND situacao = 'descartado'),
  '3', 'e fica como descartado');

ROLLBACK;
