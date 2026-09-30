-- Testes das telas da telemedicina (migration 20261009000002). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_telemedicina.sql
-- Disponibilidade (escolhida e "em consulta" pelo banco), o que o plantonista
-- vê da telemedicina de plantão, salas dos outros sem o paciente, pendências
-- (parecer por escrever e parecer sem assinatura ICP-Brasil), histórico com a
-- trilha, extrato pela escala, cobertura e credenciais.
BEGIN;
-- …0006 (seed) e …0097 (criado aqui): telemedicina escalados agora na Clínica
-- Médica; …0002 plantonista escalado agora na Clínica Médica.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-000000000097', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'tele-dois@teste.local', '', now(), '{}', '{"nome_completo":"Segundo Teleconsultor"}', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm) VALUES ('10000000-0000-4000-8000-000000000097', 'Segundo Teleconsultor', '88888', 'SP')
ON CONFLICT (id) DO NOTHING;
UPDATE public.perfis SET crm = '99999', uf_crm = 'SP' WHERE id = '10000000-0000-4000-8000-000000000006';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT p, '21000000-0000-4000-8000-000000000001', 'telemedicina'
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000097']::uuid[]) p
WHERE NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p AND v.papel = 'telemedicina');
DELETE FROM public.disponibilidade_telemedicina WHERE perfil_id = '10000000-0000-4000-8000-000000000006';
-- o banco local pode ter teleinterconsulta em atendimento de conferências anteriores
UPDATE public.teleinterconsultas SET status = 'cancelada', cancelada_em = now(), consultor_id = NULL
 WHERE consultor_id IN ('10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000097') AND status = 'em_atendimento';
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id) VALUES
  ('23000000-0000-4000-8000-000000000096', '21000000-0000-4000-8000-000000000001', 'Paciente Tele Um', '1950-01-01', 'T-096', '22000000-0000-4000-8000-000000000001'),
  ('23000000-0000-4000-8000-000000000095', '21000000-0000-4000-8000-000000000001', 'Paciente Tele Dois', '1951-01-01', 'T-095', '22000000-0000-4000-8000-000000000001');
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000097');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', p, private.data_atual(), private.turno_atual(),
       now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000097']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated;
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
CREATE FUNCTION pg_temp.igual(p_obtido text, p_esperado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtido IS DISTINCT FROM p_esperado THEN RAISE EXCEPTION 'FALHOU: % (obtido %, esperado %)', p_ok, p_obtido, p_esperado; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.igual(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.sit() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.minha_situacao_tele('21000000-0000-4000-8000-000000000001') $$;
GRANT EXECUTE ON FUNCTION pg_temp.sit() TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. disponibilidade ──────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.definir_minha_disponibilidade_tele('ausente')$$, 'Disponibilidade é do médico de telemedicina',
  'o plantonista não tem disponibilidade de telemedicina');
SELECT pg_temp.falha($$SELECT public.minha_situacao_tele('21000000-0000-4000-8000-000000000001')$$, 'Acesso negado', 'o topo da telemedicina é só dela');
SELECT pg_temp.falha($$SELECT public.tele_minha_escala(current_date, current_date)$$, 'Acesso negado', 'o plantonista não lê a escala pela tela da telemedicina');
SELECT pg_temp.igual((SELECT situacao FROM public.telemedicina_na_unidade('21000000-0000-4000-8000-000000000001') WHERE nome = 'Teleconsultor de Teste'),
  'disponivel', 'o plantonista vê a telemedicina de plantão, disponível por padrão');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.definir_minha_disponibilidade_tele('em_consulta')$$, 'Escolha disponível ou ausente',
  '"em consulta" não se escolhe');
SELECT public.definir_minha_disponibilidade_tele('ausente');
SELECT pg_temp.igual((SELECT concat_ws(':', x ->> 'estado', x ->> 'de_plantao', x ->> 'setor') FROM pg_temp.sit() x),
  'ausente:true:Clínica Médica', 'o topo mostra ausente e o plantão em curso');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.igual((SELECT situacao FROM public.telemedicina_na_unidade('21000000-0000-4000-8000-000000000001') WHERE nome = 'Teleconsultor de Teste'),
  'ausente', 'o plantonista vê que a telemedicina está ausente');

-- ── 2. pedidos, salas e pendências ──────────────────────────────────────────
INSERT INTO t SELECT 't1', public.solicitar_teleinterconsulta('23000000-0000-4000-8000-000000000096', 'Dúvida sobre anticoagulação na fibrilação atrial', 'obtido');
INSERT INTO t SELECT 't2', public.solicitar_teleinterconsulta('23000000-0000-4000-8000-000000000095', 'Dúvida sobre a sedação para a transferência', 'obtido', 'urgente');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.igual((SELECT (x ->> 'fila')::int >= 2 FROM pg_temp.sit() x)::text, 'true', 'o topo conta a fila da unidade');
SELECT public.aceitar_teleinterconsulta(pg_temp.u('t1'));
SELECT pg_temp.igual((SELECT concat_ws(':', x ->> 'estado', x ->> 'salas') FROM pg_temp.sit() x), 'em_consulta:1',
  'aceitar põe em consulta (pelo banco, sem escolher)');
SELECT pg_temp.igual((SELECT jsonb_array_length(public.tele_pendencias() -> 'sem_parecer'))::text, '1', 'o pedido aceito aparece como parecer por escrever');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000097');
SELECT public.aceitar_teleinterconsulta(pg_temp.u('t2'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.igual((SELECT consultor || ':' || urgencia FROM public.tele_outras_em_atendimento('21000000-0000-4000-8000-000000000001') WHERE id = pg_temp.u('t2')),
  'Segundo Teleconsultor:urgente', 'a sala do outro teleconsultor aparece, sem o paciente');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.tele_outras_em_atendimento('21000000-0000-4000-8000-000000000001') WHERE id = pg_temp.u('t1')),
  '0', 'a minha sala não entra em "outras"');
SELECT public.abrir_prontuario('23000000-0000-4000-8000-000000000096');
SELECT public.responder_teleinterconsulta(pg_temp.u('t1'), 'Manter anticoagulação plena e reavaliar a função renal amanhã cedo.');
-- a contagem do topo é a mesma lista das pendências (o banco local pode ter pareceres antigos)
SELECT pg_temp.igual((SELECT concat_ws(':', x ->> 'estado', x ->> 'salas', ((x ->> 'assinaturas')::int >= 1
                                         AND (x ->> 'assinaturas')::int = jsonb_array_length(public.tele_pendencias() -> 'sem_assinatura'))::text)
                        FROM pg_temp.sit() x), 'ausente:0:true',
  'respondido, volta ao escolhido e o parecer fica sem assinatura');
SELECT pg_temp.igual((SELECT concat_ws(':', jsonb_array_length(p -> 'sem_parecer'), p -> 'sem_assinatura' -> 0 ->> 'paciente',
                                        ((p -> 'sem_assinatura' -> 0 ->> 'numero') IS NOT NULL)::text)
                        FROM public.tele_pendencias() p),
  '0:Paciente Tele Um:true', 'o parecer emitido (numerado) espera a assinatura ICP-Brasil');

-- ── 3. histórico e trilha ───────────────────────────────────────────────────
SELECT pg_temp.igual((SELECT concat_ws(':', c ->> 'status', c ->> 'paciente', ((c ->> 'numero_parecer') IS NOT NULL)::text)
                        FROM jsonb_array_elements(public.tele_historico(30) -> 'consultas') c WHERE c ->> 'id' = pg_temp.v('t1')),
  'respondida:Paciente Tele Um:true', 'o histórico traz a teleinterconsulta respondida');
SELECT pg_temp.igual((SELECT count(*)::text FROM jsonb_array_elements(public.tele_historico(30) -> 'consultas') c WHERE c ->> 'id' = pg_temp.v('t2')),
  '0', 'o histórico não traz a do outro teleconsultor');
SELECT pg_temp.igual((SELECT string_agg(DISTINCT x ->> 'acao', ',' ORDER BY x ->> 'acao')
                        FROM jsonb_array_elements(public.tele_historico(30) -> 'trilha') x WHERE x ->> 'paciente' = 'Paciente Tele Um'),
  'aceitar_teleinterconsulta,leitura_prontuario,responder_teleinterconsulta,solicitar_teleinterconsulta',
  'a trilha tem o pedido, o aceite, a abertura do prontuário e a resposta');

-- ── 4. extrato, agenda, cobertura e credenciais ─────────────────────────────
SELECT pg_temp.igual((SELECT concat_ws(':', situacao, (pareceres >= 1)::text, horas, (valor IS NOT NULL)::text)
                        FROM public.tele_extrato(private.data_atual() - 1, private.data_atual() + 1) WHERE situacao = 'em_curso'),
  'em_curso:true:6.0:true', 'o extrato traz o plantão em curso com o parecer respondido nele');
SELECT pg_temp.falha($$SELECT * FROM public.tele_extrato(current_date - 200, current_date)$$, 'Período de até 3 meses', 'extrato limitado a 3 meses');
SELECT pg_temp.igual((SELECT agora::text || ':' || setor FROM public.tele_minha_escala(private.data_atual(), private.data_atual())),
  'true:Clínica Médica', 'a agenda traz a escala de hoje, marcada como agora');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.tele_cobertura('21000000-0000-4000-8000-000000000001', 7) WHERE agora), '2',
  'a cobertura traz os dois teleconsultores de plantão agora');
SELECT pg_temp.igual((SELECT concat_ws(':', c -> 'perfil' ->> 'crm', c -> 'unidades' -> 0 ->> 'nome', c -> 'unidades' -> 0 ->> 'de_plantao')
                        FROM public.tele_credenciais() c),
  '99999:Unidade Teste:true', 'as credenciais trazem o CRM e a unidade, de plantão agora');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT * FROM public.tele_cobertura('21000000-0000-4000-8000-000000000001', 7)$$, 'Acesso negado',
  'a recepção não lê a cobertura da telemedicina');
SELECT pg_temp.falha($$SELECT public.tele_pendencias()$$, 'Acesso negado', 'a recepção não lê pendências da telemedicina');
ROLLBACK;
