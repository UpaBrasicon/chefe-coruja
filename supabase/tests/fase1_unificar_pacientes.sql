-- Fase 1, tarefa 9 — migration 20261030000004_unificar_pacientes.sql: recepção
-- pede, gestor aprova; o absorvido fica inativo apontando para o principal,
-- sem mover registro; bloqueios (dois abertos, alergia escondida); desfazer.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- dois cadastros da mesma pessoa (nome escrito diferente, mesma mãe e nascimento) e um terceiro sem relação
INSERT INTO public.pacientes (id, unidade_id, nome, nome_mae, data_nascimento, cpf, prontuario) VALUES
  ('00000000-0000-4000-8000-0000000b9001', '21000000-0000-4000-8000-000000000001', 'Joana da Silva', 'Maria da Silva', '1980-05-05', NULL, 'TU-1'),
  ('00000000-0000-4000-8000-0000000b9002', '21000000-0000-4000-8000-000000000001', 'Joana D. Silva', 'MARIA DA SÍLVA', '1980-05-05', '52998224725', 'TU-2'),
  ('00000000-0000-4000-8000-0000000b9003', '21000000-0000-4000-8000-000000000001', 'Outra Pessoa', 'Outra Mãe', '1990-01-01', NULL, 'TU-3');
-- o duplicado tem um atendimento antigo encerrado e um aberto; o principal, um aberto
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, desfecho, encerrado_em) VALUES
  ('00000000-0000-4000-8000-0000000b9e01', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b9002',
   '22000000-0000-4000-8000-000000000003', 'encerrado', 'Antigo', '10000000-0000-4000-8000-000000000004', now() - interval '60 days', 'alta', now() - interval '60 days'),
  ('00000000-0000-4000-8000-0000000b9e02', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b9002',
   '22000000-0000-4000-8000-000000000003', 'triagem', 'Ficha duplicada de hoje', '10000000-0000-4000-8000-000000000004', now(), NULL, NULL),
  ('00000000-0000-4000-8000-0000000b9e03', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b9001',
   '22000000-0000-4000-8000-000000000003', 'triagem', 'Ficha de hoje', '10000000-0000-4000-8000-000000000004', now(), NULL, NULL);
INSERT INTO public.alergias_paciente (unidade_id, paciente_id, substancia, substancia_norm, tipo, registrado_por)
VALUES ('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b9002', 'Dipirona', 'dipirona', 'medicamento', '10000000-0000-4000-8000-000000000004');

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;

-- recepção vê o par (mãe + nascimento) e pede
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE c jsonb := public.candidatos_duplicados('21000000-0000-4000-8000-000000000001');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c) x
                  WHERE x -> 'regras' ? 'mae_nascimento'
                    AND x::text LIKE '%0000000b9001%' AND x::text LIKE '%0000000b9002%') THEN
    RAISE EXCEPTION 'FALHOU: par pela mãe + nascimento não apareceu: %', c;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(c) x WHERE x::text LIKE '%0000000b9003%') THEN
    RAISE EXCEPTION 'FALHOU: cadastro sem relação virou candidato';
  END IF;
  RAISE NOTICE 'OK  candidatos: mesma mãe + nascimento (sem acento/maiúscula); sem relação fora';
END $$;
INSERT INTO t SELECT 'pedido', public.pedir_unificacao('00000000-0000-4000-8000-0000000b9001', '00000000-0000-4000-8000-0000000b9002', 'Mesma paciente: nome digitado diferente na recepção')::text;
DO $$ BEGIN
  PERFORM public.decidir_unificacao((SELECT v FROM t WHERE k = 'pedido')::uuid, true);
  RAISE EXCEPTION 'FALHOU: recepção aprovou';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  recepção pede mas não aprova';
END $$;

-- gestor aprova: bloqueado por dois abertos; depois pela alergia escondida
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  PERFORM public.decidir_unificacao((SELECT v FROM t WHERE k = 'pedido')::uuid, true);
  RAISE EXCEPTION 'FALHOU: unificou com dois atendimentos abertos';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  dois atendimentos abertos: recusado';
END $$;
RESET ROLE;
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'cancelado', encerrado_em = now() WHERE id = '00000000-0000-4000-8000-0000000b9e02';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  PERFORM public.decidir_unificacao((SELECT v FROM t WHERE k = 'pedido')::uuid, true);
  RAISE EXCEPTION 'FALHOU: unificou com alergia só no absorvido';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%Dipirona%' THEN RAISE EXCEPTION 'FALHOU: mensagem sem a alergia: %', SQLERRM; END IF;
  RAISE NOTICE 'OK  alergia ativa só no absorvido: recusado, com o nome da alergia';
END $$;
RESET ROLE;
INSERT INTO public.alergias_paciente (unidade_id, paciente_id, substancia, substancia_norm, tipo, registrado_por)
VALUES ('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b9001', 'DIPIRONA', 'dipirona', 'medicamento', '10000000-0000-4000-8000-000000000004');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.decidir_unificacao((SELECT v FROM t WHERE k = 'pedido')::uuid, true);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT ativo FROM public.pacientes WHERE id = '00000000-0000-4000-8000-0000000b9002')
     OR (SELECT unificado_em FROM public.pacientes WHERE id = '00000000-0000-4000-8000-0000000b9002') <> '00000000-0000-4000-8000-0000000b9001' THEN
    RAISE EXCEPTION 'FALHOU: absorvido deveria ficar inativo apontando para o principal';
  END IF;
  IF (SELECT cpf FROM public.pacientes WHERE id = '00000000-0000-4000-8000-0000000b9001') <> '52998224725'
     OR (SELECT cpf FROM public.pacientes WHERE id = '00000000-0000-4000-8000-0000000b9002') IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: CPF deveria passar ao principal';
  END IF;
  IF (SELECT paciente_id FROM public.episodios WHERE id = '00000000-0000-4000-8000-0000000b9e01') <> '00000000-0000-4000-8000-0000000b9002' THEN
    RAISE EXCEPTION 'FALHOU: registro clínico não pode mudar de paciente';
  END IF;
  IF (SELECT count(*) FROM private.familia_paciente('00000000-0000-4000-8000-0000000b9002')) <> 2 THEN RAISE EXCEPTION 'FALHOU: família'; END IF;
  RAISE NOTICE 'OK  aprovado: absorvido inativo e vinculado, CPF no principal, registros onde estavam';
END $$;
-- o gestor (tem acesso) vê o histórico do absorvido no principal
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.historico_encerrado('00000000-0000-4000-8000-0000000b9001') -> 'atendimentos') a
                  WHERE a ->> 'id' = '00000000-0000-4000-8000-0000000b9e01' AND a ->> 'cadastro' = 'TU-2') THEN
    RAISE EXCEPTION 'FALHOU: histórico do principal sem o atendimento do absorvido';
  END IF;
  RAISE NOTICE 'OK  histórico do principal mostra o atendimento gravado no absorvido (com o prontuário dele)';
END $$;
-- desfazer devolve tudo
SELECT public.desfazer_unificacao((SELECT v FROM t WHERE k = 'pedido')::uuid, 'Eram pessoas diferentes, homônimas');
RESET ROLE;
DO $$ BEGIN
  IF NOT (SELECT ativo FROM public.pacientes WHERE id = '00000000-0000-4000-8000-0000000b9002')
     OR (SELECT unificado_em FROM public.pacientes WHERE id = '00000000-0000-4000-8000-0000000b9002') IS NOT NULL
     OR (SELECT cpf FROM public.pacientes WHERE id = '00000000-0000-4000-8000-0000000b9002') <> '52998224725'
     OR (SELECT cpf FROM public.pacientes WHERE id = '00000000-0000-4000-8000-0000000b9001') IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: desfazer deveria devolver o cadastro e o CPF';
  END IF;
  IF (SELECT status FROM public.pedidos_unificacao WHERE id = (SELECT v FROM t WHERE k = 'pedido')::uuid) <> 'desfeito' THEN RAISE EXCEPTION 'FALHOU: status'; END IF;
  RAISE NOTICE 'OK  desfeito: cadastro reativado e CPF devolvido';
END $$;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.decidir_unificacao(uuid, boolean, text)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.pedidos_unificacao', 'INSERT') THEN RAISE EXCEPTION 'FALHOU: exposto'; END IF;
  RAISE NOTICE 'OK  fora do anon; pedidos só por RPC';
END $$;
ROLLBACK;
