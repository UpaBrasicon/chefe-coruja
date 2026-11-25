-- Testes da migration 20270421000076_pessoas_diferentes.sql: "são pessoas
-- diferentes" fica gravado (quem, quando, motivo), o par sai de
-- candidatos_duplicados e volta ao desfazer; só recepção, gestor e
-- administrador geral da unidade; com auditoria. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- homônimos de verdade: mesmo nome e nascimento, mães diferentes
INSERT INTO public.pacientes (id, unidade_id, nome, nome_mae, data_nascimento, prontuario) VALUES
  ('00000000-0000-4000-8000-0000000d7001', '21000000-0000-4000-8000-000000000001', 'Zuleica Homonima Teste', 'Ana', '1961-07-07', 'PD-1'),
  ('00000000-0000-4000-8000-0000000d7002', '21000000-0000-4000-8000-000000000001', 'Zuleica Homonima Teste', 'Beatriz', '1961-07-07', 'PD-2');

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
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
-- o par aparece na lista? (ignora o limite de 100 pares olhando só o nome do teste)
CREATE FUNCTION pg_temp.par_sugerido() RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(public.candidatos_duplicados('21000000-0000-4000-8000-000000000001')) x
                  WHERE x::text LIKE '%0000000d7001%' AND x::text LIKE '%0000000d7002%');
$$;
GRANT EXECUTE ON FUNCTION pg_temp.par_sugerido() TO authenticated;
CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;

-- 1. sem marca, o par é sugerido
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  IF NOT pg_temp.par_sugerido() THEN RAISE EXCEPTION 'FALHOU: homônimos sem marca deveriam ser sugeridos'; END IF;
  RAISE NOTICE 'OK  sem marca, o par aparece em candidatos_duplicados';
END $$;
INSERT INTO t VALUES ('recepcao', private.meu_perfil_id()::text);

-- 2. quem não é recepção, gestor nem administrador não marca
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($q$SELECT public.marcar_pessoas_diferentes('00000000-0000-4000-8000-0000000d7001', '00000000-0000-4000-8000-0000000d7002', 'Mães diferentes')$q$,
  'Acesso negado', 'plantonista não marca pessoas diferentes');

-- 3. recepção: motivo curto não passa; com motivo, grava e o par some da lista
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($q$SELECT public.marcar_pessoas_diferentes('00000000-0000-4000-8000-0000000d7001', '00000000-0000-4000-8000-0000000d7002', ' ab ')$q$,
  'Escreva o motivo', 'motivo curto não grava');
-- ordem trocada de propósito: a tabela guarda o par em ordem canônica
INSERT INTO t SELECT 'marca', public.marcar_pessoas_diferentes('00000000-0000-4000-8000-0000000d7002', '00000000-0000-4000-8000-0000000d7001', 'Mães diferentes')::text;
DO $$ BEGIN
  IF pg_temp.par_sugerido() THEN RAISE EXCEPTION 'FALHOU: par marcado continua sugerido'; END IF;
  RAISE NOTICE 'OK  marcado, o par sai de candidatos_duplicados';
END $$;
SELECT pg_temp.falha($q$SELECT public.marcar_pessoas_diferentes('00000000-0000-4000-8000-0000000d7001', '00000000-0000-4000-8000-0000000d7002', 'Outra vez')$q$,
  'Este par já está marcado', 'não marca o mesmo par duas vezes');
RESET ROLE;
DO $$
DECLARE r public.pacientes_pessoas_diferentes;
BEGIN
  SELECT * INTO r FROM public.pacientes_pessoas_diferentes WHERE id = (SELECT v FROM t WHERE k = 'marca')::uuid;
  IF r.paciente_a <> '00000000-0000-4000-8000-0000000d7001' OR r.paciente_b <> '00000000-0000-4000-8000-0000000d7002'
     OR r.decidido_por::text <> (SELECT v FROM t WHERE k = 'recepcao') OR r.motivo <> 'Mães diferentes'
     OR r.decidido_em IS NULL OR r.desfeito_em IS NOT NULL OR r.unidade_id <> '21000000-0000-4000-8000-000000000001'
     OR r.organizacao_id IS DISTINCT FROM (SELECT organizacao_id FROM public.unidades WHERE id = r.unidade_id) THEN
    RAISE EXCEPTION 'FALHOU: registro errado: %', r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'marcar_pessoas_diferentes' AND entidade_id = r.id) THEN
    RAISE EXCEPTION 'FALHOU: marcar sem auditoria';
  END IF;
  RAISE NOTICE 'OK  registro com par canônico, unidade, organização, quem, quando e motivo; auditoria gravada';
END $$;

-- 4. RLS: a escrita é só pelas funções; plantonista não lê; recepção lê
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha($q$INSERT INTO public.pacientes_pessoas_diferentes (unidade_id, paciente_a, paciente_b, motivo, decidido_por)
  VALUES ('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d7001', '00000000-0000-4000-8000-0000000d7002', 'direto', '10000000-0000-4000-8000-000000000005')$q$,
  'permission denied', 'ninguém grava direto na tabela');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pacientes_pessoas_diferentes WHERE id = (SELECT v FROM t WHERE k = 'marca')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: recepção não lê a marca da própria unidade';
  END IF;
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes_pessoas_diferentes WHERE id = (SELECT v FROM t WHERE k = 'marca')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: plantonista lê a marca';
  END IF;
  RAISE NOTICE 'OK  RLS: escrita só pelas funções; recepção lê, plantonista não';
END $$;
SELECT pg_temp.falha(format('SELECT public.desfazer_pessoas_diferentes(%L)', (SELECT v FROM t WHERE k = 'marca')),
  'Acesso negado', 'plantonista não desfaz');
SELECT pg_temp.falha($q$SELECT public.pessoas_diferentes_da_unidade('21000000-0000-4000-8000-000000000001')$q$,
  'Acesso negado', 'plantonista não vê o histórico');

-- 5. o administrador da unidade vê o histórico e desfaz: o par volta
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
DO $$
DECLARE h jsonb;
BEGIN
  SELECT x INTO h FROM jsonb_array_elements(public.pessoas_diferentes_da_unidade('21000000-0000-4000-8000-000000000001')) x
   WHERE x ->> 'id' = (SELECT v FROM t WHERE k = 'marca');
  IF h IS NULL OR h ->> 'motivo' <> 'Mães diferentes' OR h ->> 'decidido_em' IS NULL OR h ->> 'desfeito_em' IS NOT NULL
     OR h -> 'a' ->> 'prontuario' <> 'PD-1' OR h -> 'b' ->> 'prontuario' <> 'PD-2' THEN
    RAISE EXCEPTION 'FALHOU: histórico sem a marca: %', h;
  END IF;
  RAISE NOTICE 'OK  histórico mostra a marca com motivo e os dois cadastros';
END $$;
SELECT public.desfazer_pessoas_diferentes((SELECT v FROM t WHERE k = 'marca')::uuid);
SELECT pg_temp.falha(format('SELECT public.desfazer_pessoas_diferentes(%L)', (SELECT v FROM t WHERE k = 'marca')),
  'Esta marca já foi desfeita', 'não desfaz duas vezes');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  IF NOT pg_temp.par_sugerido() THEN RAISE EXCEPTION 'FALHOU: desfeita a marca, o par deveria voltar'; END IF;
  RAISE NOTICE 'OK  desfeita a marca, o par volta a ser sugerido';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT desfeito_por FROM public.pacientes_pessoas_diferentes WHERE id = (SELECT v FROM t WHERE k = 'marca')::uuid) IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'desfazer_pessoas_diferentes'
                     AND entidade_id = (SELECT v FROM t WHERE k = 'marca')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: desfazer sem quem desfez ou sem auditoria';
  END IF;
  RAISE NOTICE 'OK  desfazer grava quem e quando, com auditoria';
END $$;

-- 6. com pedido de unificação aguardando o gestor, não marca; o gestor marca de novo depois de recusar
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'pedido', public.pedir_unificacao('00000000-0000-4000-8000-0000000d7001', '00000000-0000-4000-8000-0000000d7002', 'Talvez seja a mesma pessoa')::text;
SELECT pg_temp.falha($q$SELECT public.marcar_pessoas_diferentes('00000000-0000-4000-8000-0000000d7001', '00000000-0000-4000-8000-0000000d7002', 'Mães diferentes')$q$,
  'Há um pedido de unificação aguardando', 'com pedido pendente não marca');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.decidir_unificacao((SELECT v FROM t WHERE k = 'pedido')::uuid, false, 'Mães diferentes no documento');
INSERT INTO t SELECT 'marca2', public.marcar_pessoas_diferentes('00000000-0000-4000-8000-0000000d7001', '00000000-0000-4000-8000-0000000d7002', 'Mães diferentes')::text;
DO $$ BEGIN
  IF pg_temp.par_sugerido() THEN RAISE EXCEPTION 'FALHOU: par marcado pelo gestor continua sugerido'; END IF;
  RAISE NOTICE 'OK  gestor marca depois de recusar o pedido; nova marca depois da desfeita';
END $$;
RESET ROLE;

DO $$ BEGIN
  IF has_function_privilege('anon', 'public.marcar_pessoas_diferentes(uuid, uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.desfazer_pessoas_diferentes(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pessoas_diferentes_da_unidade(uuid)', 'EXECUTE')
     OR has_table_privilege('anon', 'public.pacientes_pessoas_diferentes', 'SELECT')
     OR has_table_privilege('authenticated', 'public.pacientes_pessoas_diferentes', 'INSERT')
     OR has_table_privilege('authenticated', 'public.pacientes_pessoas_diferentes', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.pacientes_pessoas_diferentes', 'DELETE') THEN
    RAISE EXCEPTION 'FALHOU: permissão a mais';
  END IF;
  RAISE NOTICE 'OK  anon sem acesso; authenticated só lê a tabela';
END $$;
ROLLBACK;
