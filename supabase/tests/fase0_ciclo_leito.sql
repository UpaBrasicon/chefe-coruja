-- Fase 0, tarefas 6 e 7 do BACKLOG.md — migration 20261024000001_ciclo_leito.sql.
-- Trava das transições do leito, higienização, bloqueio/desbloqueio e o bug de
-- ocupar leito que não está livre. Banco local com o seed (unidade
-- 21000000-…01: gestor 01, plantonista 02, enfermeiro 04; leitos 12A…14B na
-- Clínica Médica). Transação com ROLLBACK.
BEGIN;

UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE l (nome text PRIMARY KEY, id uuid NOT NULL);
INSERT INTO l
SELECT x.identificador, x.id FROM public.leitos x JOIN public.setores s ON s.id = x.setor_id
 WHERE s.unidade_id = '21000000-0000-4000-8000-000000000001' AND x.identificador IN ('13A', '13B', '14B');
-- 13A livre, 13B ocupado, 14B em higienização
UPDATE public.leitos SET status = 'ocupado' WHERE id = (SELECT id FROM l WHERE nome = '13B');
UPDATE public.leitos SET status = 'ocupado' WHERE id = (SELECT id FROM l WHERE nome = '14B');
UPDATE public.leitos SET status = 'higienizacao' WHERE id = (SELECT id FROM l WHERE nome = '14B');
GRANT SELECT ON l TO authenticated;

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.recusa(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
CREATE FUNCTION pg_temp.st(p_nome text) RETURNS text LANGUAGE sql AS $$
  SELECT x.status::text FROM public.leitos x WHERE x.id = (SELECT id FROM l WHERE nome = p_nome) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text), pg_temp.recusa(text), pg_temp.st(text) TO authenticated;

-- 1. Trava das transições (vale para qualquer função).
DO $$
DECLARE e text;
BEGIN
  e := pg_temp.recusa($q$UPDATE public.leitos SET status = 'ocupado' WHERE id = (SELECT id FROM l WHERE nome = '13B')$q$);
  IF e IS NULL OR e NOT LIKE '%não está livre%' THEN RAISE EXCEPTION 'FALHOU: ocupou leito já ocupado (%)', e; END IF;
  e := pg_temp.recusa($q$UPDATE public.leitos SET status = 'ocupado' WHERE id = (SELECT id FROM l WHERE nome = '14B')$q$);
  IF e IS NULL THEN RAISE EXCEPTION 'FALHOU: ocupou leito em higienização'; END IF;
  e := pg_temp.recusa($q$UPDATE public.leitos SET status = 'bloqueado' WHERE id = (SELECT id FROM l WHERE nome = '13B')$q$);
  IF e IS NULL OR e NOT LIKE '%só depois da alta%' THEN RAISE EXCEPTION 'FALHOU: bloqueou leito ocupado (%)', e; END IF;
  e := pg_temp.recusa($q$UPDATE public.leitos SET status = 'livre' WHERE id = (SELECT id FROM l WHERE nome = '13B')$q$);
  IF e IS NULL THEN RAISE EXCEPTION 'FALHOU: liberou leito ocupado sem higienização'; END IF;
  RAISE NOTICE 'OK  trava: não ocupa leito ocupado/em higienização, não bloqueia nem libera leito ocupado';
END $$;

-- liberação de leito bloqueado não desbloqueia (alta de dado antigo não trava)
UPDATE public.leitos SET status = 'bloqueado' WHERE id = (SELECT id FROM l WHERE nome = '13A');
UPDATE public.leitos SET status = 'higienizacao' WHERE id = (SELECT id FROM l WHERE nome = '13A');
DO $$ BEGIN
  IF pg_temp.st('13A') <> 'bloqueado' THEN RAISE EXCEPTION 'FALHOU: liberação desbloqueou o leito'; END IF;
  RAISE NOTICE 'OK  alta sobre leito bloqueado não trava e o leito continua bloqueado';
END $$;
UPDATE public.leitos SET status = 'livre' WHERE id = (SELECT id FROM l WHERE nome = '13A');

-- 2. abrir_internacao: o bug — ocupava leito que não estava livre.
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000001');
INSERT INTO public.pacientes (id, unidade_id, nome)
VALUES ('00000000-0000-4000-8000-00000000c001', '21000000-0000-4000-8000-000000000001', 'Paciente Teste Leito');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE e text; v_setor uuid;
BEGIN
  SELECT x.setor_id INTO v_setor FROM public.leitos x WHERE x.id = (SELECT id FROM l WHERE nome = '13B');
  e := pg_temp.recusa(format($q$SELECT public.abrir_internacao('00000000-0000-4000-8000-00000000c001',
         '21000000-0000-4000-8000-000000000001', 'urgencia', 'emergencia', %L, %L)$q$, v_setor, (SELECT id FROM l WHERE nome = '13B')));
  IF e IS NULL OR e NOT LIKE '%não está livre%' THEN RAISE EXCEPTION 'FALHOU: internou em leito ocupado (%)', e; END IF;
  e := pg_temp.recusa(format($q$SELECT public.abrir_internacao('00000000-0000-4000-8000-00000000c001',
         '21000000-0000-4000-8000-000000000001', 'urgencia', 'emergencia', %L, %L)$q$, v_setor, (SELECT id FROM l WHERE nome = '14B')));
  IF e IS NULL THEN RAISE EXCEPTION 'FALHOU: internou em leito em higienização'; END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes WHERE paciente_id = '00000000-0000-4000-8000-00000000c001') THEN
    RAISE EXCEPTION 'FALHOU: internação recusada deixou rastro';
  END IF;
  PERFORM public.abrir_internacao('00000000-0000-4000-8000-00000000c001', '21000000-0000-4000-8000-000000000001',
                                  'urgencia', 'emergencia', v_setor, (SELECT id FROM l WHERE nome = '13A'));
  IF pg_temp.st('13A') <> 'ocupado' THEN RAISE EXCEPTION 'FALHOU: internação em leito livre não ocupou'; END IF;
  RAISE NOTICE 'OK  abrir_internacao recusa leito ocupado/em higienização e ocupa leito livre';
END $$;

-- 3. Transferência para leito ocupado (registrar_evento_adt) — o mesmo bug.
DO $$
DECLARE e text; v_int uuid;
BEGIN
  SELECT id INTO v_int FROM public.internacoes WHERE paciente_id = '00000000-0000-4000-8000-00000000c001';
  e := pg_temp.recusa(format($q$SELECT public.registrar_evento_adt(%L, 'transferencia_leito', NULL, %L, 'teste', NULL)$q$,
         v_int, (SELECT id FROM l WHERE nome = '13B')));
  IF e IS NULL OR e NOT LIKE '%não está livre%' THEN RAISE EXCEPTION 'FALHOU: transferiu para leito ocupado (%)', e; END IF;
  IF (SELECT leito_atual_id FROM public.internacoes WHERE id = v_int) <> (SELECT id FROM l WHERE nome = '13A') THEN
    RAISE EXCEPTION 'FALHOU: transferência recusada mudou o leito do paciente';
  END IF;
  RAISE NOTICE 'OK  transferência para leito ocupado é recusada e nada muda';
END $$;
RESET ROLE;
DELETE FROM public.super_admins WHERE perfil_id = '10000000-0000-4000-8000-000000000001';

-- 4. Higienização: enfermagem e gestor concluem; plantonista não.
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.concluir_higienizacao((SELECT id FROM l WHERE nome = '14B'));
  RAISE EXCEPTION 'FALHOU: plantonista concluiu higienização';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista não conclui higienização';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  PERFORM public.concluir_higienizacao((SELECT id FROM l WHERE nome = '14B'));
  IF pg_temp.st('14B') <> 'livre' THEN RAISE EXCEPTION 'FALHOU: higienização concluída não liberou'; END IF;
  BEGIN
    PERFORM public.concluir_higienizacao((SELECT id FROM l WHERE nome = '14B'));
    RAISE EXCEPTION 'FALHOU: concluiu higienização de leito livre';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'OK  enfermeiro conclui a higienização (leito volta a livre)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.eventos_leito WHERE leito_id = (SELECT id FROM l WHERE nome = '14B')
                  AND tipo_evento = 'higienizacao_concluida' AND autor_id = '10000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'FALHOU: sem evento higienizacao_concluida com o autor';
  END IF;
  RAISE NOTICE 'OK  evento higienizacao_concluida gravado com o autor';
END $$;

-- 5. Bloqueio: gestor e enfermeiro, motivo obrigatório, nunca leito ocupado.
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.bloquear_leito((SELECT id FROM l WHERE nome = '14B'), 'manutencao');
  RAISE EXCEPTION 'FALHOU: plantonista bloqueou leito';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista não bloqueia leito';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$
DECLARE e text;
BEGIN
  e := pg_temp.recusa($q$SELECT public.bloquear_leito((SELECT id FROM l WHERE nome = '14B'), NULL)$q$);
  IF e IS NULL THEN RAISE EXCEPTION 'FALHOU: bloqueou sem motivo'; END IF;
  e := pg_temp.recusa($q$SELECT public.bloquear_leito((SELECT id FROM l WHERE nome = '14B'), 'outro')$q$);
  IF e IS NULL THEN RAISE EXCEPTION 'FALHOU: motivo "outro" sem descrição passou'; END IF;
  e := pg_temp.recusa($q$SELECT public.bloquear_leito((SELECT id FROM l WHERE nome = '13B'), 'manutencao')$q$);
  IF e IS NULL OR e NOT LIKE '%só depois da alta%' THEN RAISE EXCEPTION 'FALHOU: bloqueou leito ocupado (%)', e; END IF;
  PERFORM public.bloquear_leito((SELECT id FROM l WHERE nome = '14B'), 'isolamento', 'contato — KPC');
  IF pg_temp.st('14B') <> 'bloqueado' THEN RAISE EXCEPTION 'FALHOU: bloqueio não aplicou'; END IF;
  RAISE NOTICE 'OK  enfermeiro bloqueia com motivo; sem motivo ou leito ocupado é recusado';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.situacao_leitos('21000000-0000-4000-8000-000000000001') WHERE identificador = '14B';
  IF r.status <> 'bloqueado' OR r.motivo <> 'isolamento: contato — KPC' OR NOT r.pode_bloquear THEN
    RAISE EXCEPTION 'FALHOU: situacao_leitos para o gestor: %', r;
  END IF;
  PERFORM public.desbloquear_leito((SELECT id FROM l WHERE nome = '14B'), 'isolamento suspenso');
  IF pg_temp.st('14B') <> 'livre' THEN RAISE EXCEPTION 'FALHOU: desbloqueio não liberou'; END IF;
  RAISE NOTICE 'OK  gestor vê o motivo do bloqueio e desbloqueia';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.situacao_leitos('21000000-0000-4000-8000-000000000001') LIMIT 1;
  IF r.pode_bloquear OR r.pode_higienizar THEN RAISE EXCEPTION 'FALHOU: plantonista recebeu ações de leito'; END IF;
  RAISE NOTICE 'OK  situacao_leitos não oferece ação a quem não pode';
END $$;

-- 6. Pela API, o status não se grava mais direto (só pelas RPCs).
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE e text;
BEGIN
  e := pg_temp.recusa($q$UPDATE public.leitos SET status = 'bloqueado' WHERE id = (SELECT id FROM l WHERE nome = '14B')$q$);
  IF e IS NULL OR e NOT LIKE '%permission denied%' THEN RAISE EXCEPTION 'FALHOU: gestor gravou status direto (%)', e; END IF;
  UPDATE public.leitos SET identificador = '14B' WHERE id = (SELECT id FROM l WHERE nome = '14B');
  RAISE NOTICE 'OK  status do leito só pelas RPCs; cadastro (identificador) segue editável';
END $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT array_agg(tipo_evento ORDER BY tipo_evento DESC) FROM public.eventos_leito
       WHERE leito_id = (SELECT id FROM l WHERE nome = '14B') AND tipo_evento IN ('higienizacao_concluida', 'bloqueio', 'desbloqueio'))
     <> ARRAY['higienizacao_concluida', 'desbloqueio', 'bloqueio'] THEN
    RAISE EXCEPTION 'FALHOU: faltou evento do leito (higienização, bloqueio ou desbloqueio)';
  END IF;
  RAISE NOTICE 'OK  eventos do leito: higienização concluída, bloqueio, desbloqueio';
END $$;

-- 7. Leito "ocupado" sem paciente (dado antigo): só o gestor libera, com motivo.
CREATE TEMP TABLE l2 AS
SELECT x.identificador AS nome, x.id FROM public.leitos x JOIN public.setores s ON s.id = x.setor_id
 WHERE s.unidade_id = '21000000-0000-4000-8000-000000000001' AND x.identificador = '12B';
GRANT SELECT ON l2 TO authenticated;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  PERFORM public.liberar_leito_sem_paciente((SELECT id FROM l2), 'leito vazio no censo');
  RAISE EXCEPTION 'FALHOU: enfermeiro liberou leito sem paciente';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  só o gestor libera leito ocupado sem paciente';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE e text;
BEGIN
  e := pg_temp.recusa($q$SELECT public.liberar_leito_sem_paciente((SELECT id FROM l WHERE nome = '13A'), 'teste de recusa')$q$);
  IF e IS NULL OR e NOT LIKE '%tem paciente%' THEN RAISE EXCEPTION 'FALHOU: liberou leito com paciente (%)', e; END IF;
  e := pg_temp.recusa($q$SELECT public.liberar_leito_sem_paciente((SELECT id FROM l2), '')$q$);
  IF e IS NULL THEN RAISE EXCEPTION 'FALHOU: liberou sem motivo'; END IF;
  PERFORM public.liberar_leito_sem_paciente((SELECT id FROM l2), 'leito vazio no censo');
  IF (SELECT status FROM public.leitos WHERE id = (SELECT id FROM l2)) <> 'higienizacao' THEN
    RAISE EXCEPTION 'FALHOU: leito sem paciente não foi para higienização';
  END IF;
  RAISE NOTICE 'OK  gestor libera leito sem paciente (vai para higienização); com paciente é recusado';
END $$;
RESET ROLE;

ROLLBACK;
