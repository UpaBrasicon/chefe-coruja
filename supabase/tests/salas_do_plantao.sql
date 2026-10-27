-- Consultório do plantão — migration 20270131000001_salas_do_plantao.sql: o plantonista
-- escolhe uma vez no plantão; vale só para o plantão de agora e só para consultório do setor.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- unidade e setor só deste teste; o 0003 (sem escala em outro lugar) está de plantão agora, com check-in
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '00000000-0000-4000-8000-00000000aad1', organizacao_id, 'Unidade do Consultório', tipo
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('00000000-0000-4000-8000-00000000aad2', '00000000-0000-4000-8000-00000000aad1', 'PS do Consultório', 'emergencia', 1),
  ('00000000-0000-4000-8000-00000000aad3', '00000000-0000-4000-8000-00000000aad1', 'Outra porta', 'emergencia', 2);
INSERT INTO public.salas (id, setor_id, nome, tipo, ordem, ativo) VALUES
  ('00000000-0000-4000-8000-0000000aad01', '00000000-0000-4000-8000-00000000aad2', 'Consultório A', 'consultorio', 91, true),
  ('00000000-0000-4000-8000-0000000aad02', '00000000-0000-4000-8000-00000000aad2', 'Consultório B', 'consultorio', 92, true),
  ('00000000-0000-4000-8000-0000000aad03', '00000000-0000-4000-8000-00000000aad2', 'Triagem T', 'triagem', 93, true),
  ('00000000-0000-4000-8000-0000000aad04', '00000000-0000-4000-8000-00000000aad3', 'Consultório da outra', 'consultorio', 94, true);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000aad1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000aad1', 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT '00000000-0000-4000-8000-00000000aad1', '00000000-0000-4000-8000-00000000aad2', '10000000-0000-4000-8000-000000000003', d, t
  FROM generate_series(private.data_atual() - 1, private.data_atual() + 1, interval '1 day') d, unnest(ARRAY['manha', 'tarde', 'noite']) t;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, now() - interval '1 minute'
  FROM public.escala_plantao e WHERE e.unidade_id = '00000000-0000-4000-8000-00000000aad1' AND e.perfil_id = '10000000-0000-4000-8000-000000000003';

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE r (n int, v jsonb);
GRANT ALL ON r TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
INSERT INTO r SELECT 0, public.minhas_salas_do_plantao();
INSERT INTO r SELECT 1, public.definir_sala_do_plantao('00000000-0000-4000-8000-00000000aad2', '00000000-0000-4000-8000-0000000aad01');
INSERT INTO r SELECT 2, public.definir_sala_do_plantao('00000000-0000-4000-8000-00000000aad2', '00000000-0000-4000-8000-0000000aad02');
INSERT INTO r SELECT 3, public.minhas_salas_do_plantao();
RESET ROLE;

DO $$
DECLARE
  v0 jsonb := (SELECT r.v FROM r WHERE r.n = 0);
  v1 jsonb := (SELECT r.v FROM r WHERE r.n = 1);
  v3 jsonb := (SELECT r.v FROM r WHERE r.n = 3);
BEGIN
  IF v0 ? '00000000-0000-4000-8000-00000000aad2' THEN RAISE EXCEPTION 'FALHOU: começa sem consultório: %', v0; END IF;
  RAISE NOTICE 'OK  o plantão começa sem consultório';
  IF v1 ->> '00000000-0000-4000-8000-00000000aad2' <> '00000000-0000-4000-8000-0000000aad01' THEN RAISE EXCEPTION 'FALHOU: escolher: %', v1; END IF;
  IF v3 ->> '00000000-0000-4000-8000-00000000aad2' <> '00000000-0000-4000-8000-0000000aad02' THEN RAISE EXCEPTION 'FALHOU: trocar: %', v3; END IF;
  IF (SELECT count(*) FROM public.salas_do_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000003') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: um registro só, no plantão de agora';
  END IF;
  RAISE NOTICE 'OK  escolher e trocar o consultório do plantão';
END $$;

-- sala de triagem e consultório de outra porta: recusados
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
DO $$ BEGIN
  PERFORM public.definir_sala_do_plantao('00000000-0000-4000-8000-00000000aad2', '00000000-0000-4000-8000-0000000aad03');
  RAISE EXCEPTION 'FALHOU: aceitou sala de triagem';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  sala de triagem recusada';
END $$;
DO $$ BEGIN
  PERFORM public.definir_sala_do_plantao('00000000-0000-4000-8000-00000000aad2', '00000000-0000-4000-8000-0000000aad04');
  RAISE EXCEPTION 'FALHOU: aceitou consultório de outra porta';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  consultório de outra porta recusado';
END $$;
-- porta em que não estou de plantão
DO $$ BEGIN
  PERFORM public.definir_sala_do_plantao('00000000-0000-4000-8000-00000000aad3', '00000000-0000-4000-8000-0000000aad04');
  RAISE EXCEPTION 'FALHOU: escolheu em porta sem plantão';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  porta sem plantão: recusado';
END $$;
-- quem não está de plantão nesta porta
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.definir_sala_do_plantao('00000000-0000-4000-8000-00000000aad2', '00000000-0000-4000-8000-0000000aad01');
  RAISE EXCEPTION 'FALHOU: plantonista fora da escala escolheu';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  fora da escala: recusado';
END $$;
-- o outro não vê o consultório do colega na tabela
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.salas_do_plantao) THEN RAISE EXCEPTION 'FALHOU: viu o consultório do colega'; END IF;
  RAISE NOTICE 'OK  cada um lê só o seu';
END $$;
RESET ROLE;

-- 2FA ligado, sem segundo fator: recusado
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
DO $$ BEGIN
  PERFORM public.definir_sala_do_plantao('00000000-0000-4000-8000-00000000aad2', '00000000-0000-4000-8000-0000000aad01');
  RAISE EXCEPTION 'FALHOU: rodou sem segundo fator';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  sem segundo fator: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.definir_sala_do_plantao(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.minhas_salas_do_plantao()', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
