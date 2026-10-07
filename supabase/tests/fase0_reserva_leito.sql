-- Fase 0, item 12 do BACKLOG.md — migrations 20261027000001/2 (reserva de leito).
-- Seed: unidade 21000000-…01 (gestor 01, plantonista 02, enfermeiro 04,
-- recepção 05); leitos 13A, 13B e 14B livres na Clínica Médica. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE l (nome text PRIMARY KEY, id uuid NOT NULL);
INSERT INTO l SELECT x.identificador, x.id FROM public.leitos x JOIN public.setores s ON s.id = x.setor_id
 WHERE s.unidade_id = '21000000-0000-4000-8000-000000000001' AND x.identificador IN ('13A', '13B', '14B');
INSERT INTO public.pacientes (id, unidade_id, nome) VALUES
  ('00000000-0000-4000-8000-00000000d001', '21000000-0000-4000-8000-000000000001', 'Paciente Reserva X'),
  ('00000000-0000-4000-8000-00000000d002', '21000000-0000-4000-8000-000000000001', 'Paciente Reserva Y');
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000001');
GRANT SELECT ON l TO authenticated;

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.recusa(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE p_sql; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
CREATE FUNCTION pg_temp.st(p_nome text) RETURNS text LANGUAGE sql AS $$
  SELECT x.status::text FROM public.leitos x WHERE x.id = (SELECT id FROM l WHERE nome = p_nome) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text), pg_temp.recusa(text), pg_temp.st(text) TO authenticated;

SET LOCAL ROLE authenticated;

-- 1. Quem pode reservar e com quais dados
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');   -- recepção
DO $$ BEGIN
  PERFORM public.reservar_leito((SELECT id FROM l WHERE nome = '13A'), 2, '00000000-0000-4000-8000-00000000d001');
  RAISE EXCEPTION 'FALHOU: recepção reservou leito';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  recepção não reserva';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');   -- plantonista
DO $$
DECLARE e text;
BEGIN
  e := pg_temp.recusa($q$SELECT public.reservar_leito((SELECT id FROM l WHERE nome = '13A'), 3, '00000000-0000-4000-8000-00000000d001')$q$);
  IF e IS NULL THEN RAISE EXCEPTION 'FALHOU: validade de 3 h aceita'; END IF;
  e := pg_temp.recusa($q$SELECT public.reservar_leito((SELECT id FROM l WHERE nome = '13A'), 2)$q$);
  IF e IS NULL THEN RAISE EXCEPTION 'FALHOU: reserva sem paciente e sem motivo aceita'; END IF;
  e := pg_temp.recusa($q$SELECT public.reservar_leito((SELECT id FROM public.leitos WHERE identificador = '12A' LIMIT 1), 2, '00000000-0000-4000-8000-00000000d001')$q$);
  IF e IS NULL OR e NOT LIKE '%só leito livre%' THEN RAISE EXCEPTION 'FALHOU: reservou leito ocupado (%)', e; END IF;
  PERFORM public.reservar_leito((SELECT id FROM l WHERE nome = '13A'), 2, '00000000-0000-4000-8000-00000000d001');
  IF pg_temp.st('13A') <> 'reservado' THEN RAISE EXCEPTION 'FALHOU: leito não ficou reservado'; END IF;
  e := pg_temp.recusa($q$SELECT public.reservar_leito((SELECT id FROM l WHERE nome = '13B'), 2, '00000000-0000-4000-8000-00000000d001')$q$);
  IF e IS NULL OR e NOT LIKE '%já tem um leito reservado%' THEN RAISE EXCEPTION 'FALHOU: mesmo paciente com duas reservas (%)', e; END IF;
  RAISE NOTICE 'OK  plantonista reserva leito livre para o paciente (2 h); validade, motivo, leito ocupado e reserva dupla recusados';
END $$;

-- 2. Leito reservado: não bloqueia; aparece só para o paciente certo
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');   -- enfermeiro
DO $$
DECLARE e text; v_setor uuid;
BEGIN
  e := pg_temp.recusa($q$SELECT public.bloquear_leito((SELECT id FROM l WHERE nome = '13A'), 'manutencao')$q$);
  IF e IS NULL OR e NOT LIKE '%reservado%' THEN RAISE EXCEPTION 'FALHOU: bloqueou leito reservado (%)', e; END IF;
  SELECT setor_id INTO v_setor FROM public.leitos WHERE id = (SELECT id FROM l WHERE nome = '13A');
  IF NOT EXISTS (SELECT 1 FROM public.leitos_para_ocupar(v_setor, '00000000-0000-4000-8000-00000000d001') WHERE identificador = '13A' AND reservado) THEN
    RAISE EXCEPTION 'FALHOU: leito reservado não aparece para o paciente da reserva';
  END IF;
  IF EXISTS (SELECT 1 FROM public.leitos_para_ocupar(v_setor, '00000000-0000-4000-8000-00000000d002') WHERE identificador = '13A') THEN
    RAISE EXCEPTION 'FALHOU: leito reservado aparece para outro paciente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.situacao_leitos('21000000-0000-4000-8000-000000000001')
                  WHERE identificador = '13A' AND status = 'reservado' AND reserva_paciente = 'Paciente Reserva X' AND pode_cancelar_reserva) THEN
    RAISE EXCEPTION 'FALHOU: mapa não mostra a reserva';
  END IF;
  RAISE NOTICE 'OK  reservado não bloqueia; só o paciente da reserva vê o leito para ocupar; o mapa mostra a reserva';
END $$;

-- 3. Reserva vira ocupação — e recusa outro paciente
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');   -- super admin (abre internação)
DO $$
DECLARE e text; v_setor uuid;
BEGIN
  SELECT setor_id INTO v_setor FROM public.leitos WHERE id = (SELECT id FROM l WHERE nome = '13A');
  e := pg_temp.recusa(format($q$SELECT public.abrir_internacao('00000000-0000-4000-8000-00000000d002',
         '21000000-0000-4000-8000-000000000001', 'urgencia', 'emergencia', %L, %L)$q$, v_setor, (SELECT id FROM l WHERE nome = '13A')));
  IF e IS NULL OR e NOT LIKE '%reservado para outro paciente%' THEN RAISE EXCEPTION 'FALHOU: outro paciente ocupou leito reservado (%)', e; END IF;
  PERFORM public.abrir_internacao('00000000-0000-4000-8000-00000000d001', '21000000-0000-4000-8000-000000000001',
                                  'urgencia', 'emergencia', v_setor, (SELECT id FROM l WHERE nome = '13A'));
  IF pg_temp.st('13A') <> 'ocupado' THEN RAISE EXCEPTION 'FALHOU: paciente da reserva não ocupou'; END IF;
  RAISE NOTICE 'OK  outro paciente recusado; o paciente da reserva ocupa o leito';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.reservas_leito WHERE paciente_id = '00000000-0000-4000-8000-00000000d001'
                  AND situacao = 'ocupada' AND internacao_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHOU: reserva não virou "ocupada" com a internação';
  END IF;
  RAISE NOTICE 'OK  reserva marcada como ocupada, ligada à internação';
END $$;

-- 4. Reserva por motivo livre: qualquer paciente ocupa; cancelamento com permissão
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');   -- enfermeiro
SELECT public.reservar_leito((SELECT id FROM l WHERE nome = '13B'), 1, NULL, 'transferência externa do Hospital Regional');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');   -- recepção tenta cancelar
DO $$ BEGIN
  PERFORM public.cancelar_reserva((SELECT id FROM l WHERE nome = '13B'), 'teste de recusa');
  RAISE EXCEPTION 'FALHOU: recepção cancelou reserva';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  recepção não cancela reserva';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');   -- plantonista (não reservou) tenta cancelar
DO $$ BEGIN
  PERFORM public.cancelar_reserva((SELECT id FROM l WHERE nome = '13B'), 'teste de recusa');
  RAISE EXCEPTION 'FALHOU: plantonista cancelou reserva de outra pessoa';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  plantonista não cancela reserva alheia';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');   -- gestor/super admin
DO $$
DECLARE v_setor uuid;
BEGIN
  SELECT setor_id INTO v_setor FROM public.leitos WHERE id = (SELECT id FROM l WHERE nome = '13B');
  IF NOT EXISTS (SELECT 1 FROM public.leitos_para_ocupar(v_setor, '00000000-0000-4000-8000-00000000d002') WHERE identificador = '13B') THEN
    RAISE EXCEPTION 'FALHOU: reserva por motivo livre não aparece para quem chega';
  END IF;
  PERFORM public.cancelar_reserva((SELECT id FROM l WHERE nome = '13B'), 'transferência desmarcada');
  IF pg_temp.st('13B') <> 'livre' THEN RAISE EXCEPTION 'FALHOU: cancelamento não liberou'; END IF;
  RAISE NOTICE 'OK  reserva por motivo livre serve a quem chega; gestor cancela e o leito volta a livre';
END $$;

-- 5. Expiração automática
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.reservar_leito((SELECT id FROM l WHERE nome = '14B'), 1, '00000000-0000-4000-8000-00000000d002');
RESET ROLE;
UPDATE public.reservas_leito SET expira_em = now() - interval '1 minute'
 WHERE leito_id = (SELECT id FROM l WHERE nome = '14B') AND situacao = 'ativa';
DO $$
DECLARE n int;
BEGIN
  n := private.expirar_reservas();
  IF n <> 1 OR pg_temp.st('14B') <> 'livre' THEN RAISE EXCEPTION 'FALHOU: reserva vencida não liberou o leito (n=%)', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reservas_leito WHERE leito_id = (SELECT id FROM l WHERE nome = '14B') AND situacao = 'expirada') THEN
    RAISE EXCEPTION 'FALHOU: reserva não marcada como expirada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expirar-reservas-leito' AND schedule = '*/5 * * * *') THEN
    RAISE EXCEPTION 'FALHOU: expiração não agendada no pg_cron';
  END IF;
  RAISE NOTICE 'OK  reserva vencida expira, o leito volta a livre; pg_cron a cada 5 min';
END $$;

-- 6. Trilha do leito
DO $$ BEGIN
  IF (SELECT count(*) FROM public.eventos_leito WHERE tipo_evento IN ('reserva', 'cancelamento_reserva')
        AND leito_id IN (SELECT id FROM l)) < 5 THEN
    RAISE EXCEPTION 'FALHOU: eventos de reserva/cancelamento faltando';
  END IF;
  RAISE NOTICE 'OK  reservas, cancelamento e expiração na trilha do leito';
END $$;
ROLLBACK;
