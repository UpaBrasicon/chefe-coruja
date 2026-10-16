-- Testes da migration 20261122000001_unificacao_documentos_divergentes.sql
-- (Portão 2, tarefa 3, R2-02): unificação com CPF/CNS diferentes é aceita com
-- alerta, motivo de 30 letras e confirmação no pedido e na aprovação. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- mesmo nome e nascimento, CPFs válidos e diferentes (o caso do paciente #33)
INSERT INTO public.pacientes (id, unidade_id, nome, nome_mae, data_nascimento, cpf, prontuario) VALUES
  ('00000000-0000-4000-8000-0000000c3001', '21000000-0000-4000-8000-000000000001', 'Carla Divergente', 'Rosa', '1975-03-03', '52998224725', 'DV-1'),
  ('00000000-0000-4000-8000-0000000c3002', '21000000-0000-4000-8000-000000000001', 'Carla Divergente', 'Rosa', '1975-03-03', '11144477735', 'DV-2');

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
CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;

-- 2a. recepção pede: sem o motivo longo e a confirmação, o pedido não sai
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($q$SELECT public.pedir_unificacao('00000000-0000-4000-8000-0000000c3001', '00000000-0000-4000-8000-0000000c3002',
  'Mesma paciente, 2x', true)$q$,
  'Documentos diferentes (CPF): os cadastros podem ser de pessoas diferentes', 'CPF diferente: motivo curto não basta');
SELECT pg_temp.falha($q$SELECT public.pedir_unificacao('00000000-0000-4000-8000-0000000c3001', '00000000-0000-4000-8000-0000000c3002',
  'Mesma paciente: confirmado com o documento na mão, CPF antigo errado')$q$,
  'Documentos diferentes (CPF)', 'CPF diferente: sem a confirmação não pede');
INSERT INTO t SELECT 'pedido', public.pedir_unificacao('00000000-0000-4000-8000-0000000c3001', '00000000-0000-4000-8000-0000000c3002',
  'Mesma paciente: confirmado com o documento na mão, CPF antigo errado', true);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT divergencias FROM public.pedidos_unificacao WHERE id = (SELECT v FROM t WHERE k = 'pedido')::uuid) <> '{CPF}'
     OR NOT (SELECT confirmado_no_pedido FROM public.pedidos_unificacao WHERE id = (SELECT v FROM t WHERE k = 'pedido')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: pedido sem a divergência ou sem a confirmação gravada';
  END IF;
  RAISE NOTICE 'OK  com motivo de 30 letras e confirmação, o pedido sai com a divergência gravada';
END $$;

-- 3a. o gestor vê o alerta e precisa confirmar para aprovar
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE p jsonb;
BEGIN
  SELECT x INTO p FROM jsonb_array_elements(public.pedidos_unificacao_da_unidade('21000000-0000-4000-8000-000000000001')) x
   WHERE x ->> 'id' = (SELECT v FROM t WHERE k = 'pedido');
  IF p -> 'divergencias' <> '["CPF"]'::jsonb OR NOT (p ->> 'confirmado_no_pedido')::boolean THEN
    RAISE EXCEPTION 'FALHOU: lista de pedidos sem o alerta: %', p;
  END IF;
  RAISE NOTICE 'OK  a lista de pedidos mostra "CPF" divergente e a confirmação de quem pediu';
END $$;
SELECT pg_temp.falha(format('SELECT public.decidir_unificacao(%L, true)', (SELECT v FROM t WHERE k = 'pedido')),
  'Documentos diferentes (CPF): confirme que é a mesma pessoa para aprovar', 'gestor não aprova divergência sem confirmar');
SELECT public.decidir_unificacao((SELECT v FROM t WHERE k = 'pedido')::uuid, true, NULL, true);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM public.pedidos_unificacao WHERE id = (SELECT v FROM t WHERE k = 'pedido')::uuid) <> 'aprovado'
     OR NOT (SELECT confirmado_na_decisao FROM public.pedidos_unificacao WHERE id = (SELECT v FROM t WHERE k = 'pedido')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: aprovação sem a confirmação gravada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'aprovar_unificacao_documentos_divergentes'
                  AND entidade_id = (SELECT v FROM t WHERE k = 'pedido')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: aprovação com divergência sem auditoria';
  END IF;
  -- cada cadastro fica com o seu CPF (o índice único não aceita os dois no principal)
  IF (SELECT cpf FROM public.pacientes WHERE id = '00000000-0000-4000-8000-0000000c3002') <> '11144477735' THEN
    RAISE EXCEPTION 'FALHOU: o absorvido deveria guardar o próprio CPF';
  END IF;
  RAISE NOTICE 'OK  aprovado com confirmação, auditoria própria; o absorvido guarda o próprio CPF';
END $$;

-- 4a. a busca pelo CPF do absorvido acha o principal, com a marca
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.buscar_pacientes('21000000-0000-4000-8000-000000000001', '111.444.777-35');
  IF r.id IS DISTINCT FROM '00000000-0000-4000-8000-0000000c3001' OR NOT r.documento_unificado THEN
    RAISE EXCEPTION 'FALHOU: CPF do absorvido não levou ao principal com a marca (%)', r;
  END IF;
  SELECT * INTO r FROM public.buscar_pacientes('21000000-0000-4000-8000-000000000001', '52998224725');
  IF r.id IS DISTINCT FROM '00000000-0000-4000-8000-0000000c3001' OR r.documento_unificado THEN
    RAISE EXCEPTION 'FALHOU: CPF do próprio principal não deveria ter a marca';
  END IF;
  IF (SELECT count(*) FROM public.buscar_pacientes('21000000-0000-4000-8000-000000000001', 'Carla Divergente')) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: busca por nome deveria trazer só o principal ativo';
  END IF;
  RAISE NOTICE 'OK  busca pelo CPF do absorvido acha o principal com "documento de cadastro unificado"';
END $$;
RESET ROLE;

DO $$ BEGIN
  IF has_function_privilege('authenticated', 'private.decidir_unificacao_base(uuid, boolean, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pedir_unificacao(uuid, uuid, text, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: caminho sem a checagem exposto';
  END IF;
  RAISE NOTICE 'OK  a decisão antiga não é chamada direto';
END $$;
ROLLBACK;
