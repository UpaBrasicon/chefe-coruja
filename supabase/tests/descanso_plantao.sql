-- Testes da migration 20270419000002 (divisão do descanso dos médicos,
-- pedido 8; PS4 e PS5 do RT em 23/11/2026). Dados próprios. ROLLBACK no fim.
-- Divisão igual: 3 médicos, 6 horas, pelo menos 1 acordado: cada um descansa
-- 4 horas e nunca mais de 2 descansam juntos. Refazer guarda a anterior. A
-- enfermagem e o gestor veem quem está acordado; a recepção não. Só o médico de
-- plantão agora divide, com regras de mínimo e de lista.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER USER;

INSERT INTO auth.users (id, email)
SELECT ('a9000000-0000-4000-8000-00000000000' || n)::uuid, 'descanso' || n || '@descanso.local' FROM generate_series(1, 6) n
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('a9000000-0000-4000-8000-000000000001', 'Dra. A'),
  ('a9000000-0000-4000-8000-000000000002', 'Dr. B'),
  ('a9000000-0000-4000-8000-000000000003', 'Dr. C'),
  ('a9000000-0000-4000-8000-000000000004', 'Enfermeira D'),
  ('a9000000-0000-4000-8000-000000000005', 'Gestora E'),
  ('a9000000-0000-4000-8000-000000000006', 'Recepção F')
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES ('a9100000-0000-4000-8000-000000000001', 'Rede Descanso');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('a9200000-0000-4000-8000-000000000001', 'a9100000-0000-4000-8000-000000000001', 'UPA Descanso', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  ('a9300000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001', 'Pronto Socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('a9000000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001', 'plantonista'),
  ('a9000000-0000-4000-8000-000000000002', 'a9200000-0000-4000-8000-000000000001', 'plantonista'),
  ('a9000000-0000-4000-8000-000000000003', 'a9200000-0000-4000-8000-000000000001', 'plantonista'),
  ('a9000000-0000-4000-8000-000000000004', 'a9200000-0000-4000-8000-000000000001', 'enfermeiro'),
  ('a9000000-0000-4000-8000-000000000005', 'a9200000-0000-4000-8000-000000000001', 'gestor'),
  ('a9000000-0000-4000-8000-000000000006', 'a9200000-0000-4000-8000-000000000001', 'recepcao');
-- A e B estão na escala agora (A com check-in); C não está
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', private.data_atual(), 'noite', now() - interval '2 hours', 720),
  ('a9200000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000002', private.data_atual(), 'noite', now() - interval '2 hours', 720);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.perfil_id = 'a9000000-0000-4000-8000-000000000001';

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
-- a janela do teste: começou há 1 hora e dura 6 horas
SELECT set_config('teste.inicio', date_trunc('minute', now() - interval '1 hour')::text, true);

-- ── a médica de plantão divide ──────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('a9000000-0000-4000-8000-000000000001');
SELECT pg_temp.igual((SELECT string_agg(nome || ':' || na_escala, ', ') FROM public.medicos_para_descanso('a9200000-0000-4000-8000-000000000001')),
  'Dr. B:true, Dra. A:true, Dr. C:false', 'os médicos da unidade, os da escala primeiro');
SELECT public.dividir_descanso('a9200000-0000-4000-8000-000000000001', current_setting('teste.inicio')::timestamptz,
  current_setting('teste.inicio')::timestamptz + interval '6 hours', 1,
  ARRAY['a9000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000003']::uuid[]);
RESET ROLE;

SELECT pg_temp.igual((SELECT string_agg(n || ':' || m, ', ' ORDER BY n) FROM (
    SELECT b->>'nome' n, sum(extract(epoch FROM (b->>'fim')::timestamptz - (b->>'inicio')::timestamptz) / 60)::int m
      FROM public.descanso_divisoes d, jsonb_array_elements(d.blocos) b
     WHERE d.unidade_id = 'a9200000-0000-4000-8000-000000000001' AND d.substituida_em IS NULL GROUP BY 1) x),
  'Dr. B:240, Dr. C:240, Dra. A:240', 'cada um descansa o mesmo tempo: 6 h x 2 / 3 = 4 h');
SELECT pg_temp.igual((SELECT max(c)::text FROM (
    SELECT t, count(*) c
      FROM generate_series(current_setting('teste.inicio')::timestamptz, current_setting('teste.inicio')::timestamptz + interval '359 minutes', interval '1 minute') t
      JOIN public.descanso_divisoes d ON d.unidade_id = 'a9200000-0000-4000-8000-000000000001' AND d.substituida_em IS NULL
      JOIN LATERAL jsonb_array_elements(d.blocos) b ON (b->>'inicio')::timestamptz <= t AND t < (b->>'fim')::timestamptz
     GROUP BY t) x), '2', 'nunca mais de 2 descansando juntos (pelo menos 1 acordado)');

-- ── a enfermeira e a gestora veem quem está acordado; a recepção não ────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('a9000000-0000-4000-8000-000000000004');
SELECT pg_temp.igual((SELECT string_agg((m->>'nome') || ':' || (m->>'descansando'), ', ')
                        FROM jsonb_array_elements(public.descanso_do_plantao('a9200000-0000-4000-8000-000000000001')->'medicos') m),
  'Dra. A:true, Dr. B:true, Dr. C:false', 'uma hora depois do início: A e B descansam, C está acordado');
SELECT pg_temp.como('a9000000-0000-4000-8000-000000000005');
SELECT pg_temp.igual((public.descanso_do_plantao('a9200000-0000-4000-8000-000000000001')->>'minimo_acordados'), '1', 'a gestora vê a divisão');
SELECT pg_temp.como('a9000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.descanso_do_plantao('a9200000-0000-4000-8000-000000000001')$$, 'Acesso negado', 'a recepção não vê');

-- ── regras de quem divide e do que se divide ────────────────────────────────
SELECT pg_temp.como('a9000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.dividir_descanso('a9200000-0000-4000-8000-000000000001', now(), now() + interval '6 hours', 1,
  ARRAY['a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002']::uuid[])$$, 'Acesso negado', 'a enfermeira não divide');
SELECT pg_temp.como('a9000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha($$SELECT public.dividir_descanso('a9200000-0000-4000-8000-000000000001', now(), now() + interval '6 hours', 1,
  ARRAY['a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002']::uuid[])$$, 'Só quem está de plantão', 'médico fora do plantão não divide');
SELECT pg_temp.como('a9000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.dividir_descanso('a9200000-0000-4000-8000-000000000001', now(), now() + interval '6 hours', 2,
  ARRAY['a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002']::uuid[])$$, 'O mínimo acordado', 'mínimo igual ao número de médicos é recusado');
SELECT pg_temp.falha($$SELECT public.dividir_descanso('a9200000-0000-4000-8000-000000000001', now(), now() + interval '6 hours', 1,
  ARRAY['a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001']::uuid[])$$, 'Escolha pelo menos dois', 'o mesmo médico duas vezes conta uma');
SELECT pg_temp.falha($$SELECT public.dividir_descanso('a9200000-0000-4000-8000-000000000001', now(), now() + interval '6 hours', 1,
  ARRAY['a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000004']::uuid[])$$, 'Há na lista quem não é médico', 'enfermeira na lista é recusada');
SELECT pg_temp.falha($$SELECT public.dividir_descanso('a9200000-0000-4000-8000-000000000001', now(), now() + interval '15 hours', 1,
  ARRAY['a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002']::uuid[])$$, 'A divisão termina depois', 'janela de mais de 14 horas é recusada');
-- refazer com 2 médicos: a divisão anterior fica guardada como substituída
SELECT public.dividir_descanso('a9200000-0000-4000-8000-000000000001', current_setting('teste.inicio')::timestamptz,
  current_setting('teste.inicio')::timestamptz + interval '6 hours', 1,
  ARRAY['a9000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000002']::uuid[]);
SELECT pg_temp.falha($$SELECT * FROM public.descanso_divisoes$$, 'permission denied', 'a tabela não se lê direto');
RESET ROLE;
SELECT pg_temp.igual((SELECT count(*) FILTER (WHERE substituida_em IS NULL) || '/' || count(*)
                        FROM public.descanso_divisoes WHERE unidade_id = 'a9200000-0000-4000-8000-000000000001'),
  '1/2', 'refazer guarda a anterior como substituída');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.log_auditoria WHERE acao = 'dividir_descanso'
                       AND entidade_id IN (SELECT id FROM public.descanso_divisoes WHERE unidade_id = 'a9200000-0000-4000-8000-000000000001')),
  '2', 'cada divisão fica na auditoria');

SET LOCAL ROLE anon;
SELECT pg_temp.falha($$SELECT public.descanso_do_plantao('a9200000-0000-4000-8000-000000000001')$$, 'permission denied', 'anônimo não vê');
RESET ROLE;

ROLLBACK;
