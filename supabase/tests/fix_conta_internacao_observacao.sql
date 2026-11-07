-- Teste da migration 20270307000001_conta_na_conversao.sql (achado B P1-1 do
-- teste da rede, decisões do RT de 07/11/2026: A em P1 a P3).
--
-- A observação que vira internação muda só o status; quem preenche
-- internado_em é o gatilho BEFORE trg_internacao_tipo_na_conversao. O gatilho
-- da conta (UPDATE OF internado_em) não via essa mudança, e a conta de
-- internação não abria. Cobre:
--   1. observação → internação só pelo status abre UMA conta, ligada à da porta,
--      com abertura em internado_em;
--   2. internação direta continua abrindo uma só;
--   3. nova mudança de status não abre segunda conta;
--   4. a abertura das contas que faltam é idempotente.
-- Termina em ROLLBACK.
BEGIN;
-- cenário próprio (não depende do seed): rede, UPA, porta, observação, médico
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000cb021', 'med@fixconta.local');
INSERT INTO public.perfis (id, nome_completo) VALUES ('00000000-0000-4000-8000-0000000cb021', 'Médico do fix da conta')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES ('00000000-0000-4000-8000-0000000cb001', 'Rede do fix da conta');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
VALUES ('00000000-0000-4000-8000-0000000cb002', '00000000-0000-4000-8000-0000000cb001', 'UPA do fix da conta', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  ('00000000-0000-4000-8000-0000000cb011', '00000000-0000-4000-8000-0000000cb002', 'Pronto-socorro', 'emergencia'),
  ('00000000-0000-4000-8000-0000000cb012', '00000000-0000-4000-8000-0000000cb002', 'Observação Adulto', 'observacao');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario) VALUES
  ('23000000-0000-4000-8000-0000000cb001', '00000000-0000-4000-8000-0000000cb002', 'Conta Da Observacao', '1960-01-01', 'CB-1'),
  ('23000000-0000-4000-8000-0000000cb002', '00000000-0000-4000-8000-0000000cb002', 'Conta Direta', '1961-01-01', 'CB-2'),
  ('23000000-0000-4000-8000-0000000cb003', '00000000-0000-4000-8000-0000000cb002', 'Conta Que Faltou', '1962-01-01', 'CB-3');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
SELECT ('25000000-0000-4000-8000-0000000cb00' || n)::uuid, '00000000-0000-4000-8000-0000000cb002',
       ('23000000-0000-4000-8000-0000000cb00' || n)::uuid, '00000000-0000-4000-8000-0000000cb011', 'atendimento', q,
       '00000000-0000-4000-8000-0000000cb021', now() - h
  FROM (VALUES (1, 'Dispneia', interval '6 hours'), (2, 'Dor torácica', interval '3 hours'), (3, 'Febre', interval '9 hours')) x(n, q, h);

-- 1. observação → internação mudando só o status, como finalizar_observacao faz
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, episodio_id)
VALUES ('26000000-0000-4000-8000-0000000cb001', '00000000-0000-4000-8000-0000000cb001', '00000000-0000-4000-8000-0000000cb002',
        '23000000-0000-4000-8000-0000000cb001', 'em_observacao', '00000000-0000-4000-8000-0000000cb012', now() - interval '5 hours',
        '25000000-0000-4000-8000-0000000cb001');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.contas WHERE internacao_id = '26000000-0000-4000-8000-0000000cb001') THEN
    RAISE EXCEPTION 'FALHOU: observação abriu conta de internação';
  END IF;
  RAISE NOTICE 'OK  observação continua na conta da porta';
END $$;
UPDATE public.internacoes SET status = 'internado' WHERE id = '26000000-0000-4000-8000-0000000cb001';
DO $$
DECLARE v_internado timestamptz := (SELECT internado_em FROM public.internacoes WHERE id = '26000000-0000-4000-8000-0000000cb001');
BEGIN
  IF v_internado IS NULL THEN RAISE EXCEPTION 'FALHOU: a conversão não preencheu internado_em'; END IF;
  IF (SELECT count(*) FROM public.contas WHERE internacao_id = '26000000-0000-4000-8000-0000000cb001' AND tipo = 'internacao') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: a conversão da observação não abriu a conta de internação';
  END IF;
  IF (SELECT c.conta_origem_id IS NOT DISTINCT FROM (SELECT a.id FROM public.contas a
                                                    WHERE a.episodio_id = '25000000-0000-4000-8000-0000000cb001' AND a.tipo = 'ambulatorial')
             AND c.aberta_em = v_internado AND c.numero LIKE 'I-%'
        FROM public.contas c WHERE c.internacao_id = '26000000-0000-4000-8000-0000000cb001') IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: conta da conversão sem a ligação com a da porta ou fora da hora da internação';
  END IF;
  RAISE NOTICE 'OK  observação que vira internação abre uma conta, ligada à da porta, na hora da internação';
END $$;

-- 2. internação direta continua abrindo uma só
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, episodio_id)
VALUES ('26000000-0000-4000-8000-0000000cb002', '00000000-0000-4000-8000-0000000cb001', '00000000-0000-4000-8000-0000000cb002',
        '23000000-0000-4000-8000-0000000cb002', 'internado', '00000000-0000-4000-8000-0000000cb012', now() - interval '2 hours',
        '25000000-0000-4000-8000-0000000cb002');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.contas WHERE internacao_id = '26000000-0000-4000-8000-0000000cb002' AND tipo = 'internacao') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: internação direta deveria abrir uma conta';
  END IF;
  RAISE NOTICE 'OK  internação direta abre uma conta';
END $$;

-- 3. outra mudança de status não abre segunda conta
UPDATE public.internacoes SET status = 'admitido' WHERE id IN ('26000000-0000-4000-8000-0000000cb001', '26000000-0000-4000-8000-0000000cb002');
UPDATE public.internacoes SET status = 'internado' WHERE id IN ('26000000-0000-4000-8000-0000000cb001', '26000000-0000-4000-8000-0000000cb002');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.contas
       WHERE internacao_id IN ('26000000-0000-4000-8000-0000000cb001', '26000000-0000-4000-8000-0000000cb002') AND tipo = 'internacao') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: mudança de status abriu conta repetida';
  END IF;
  RAISE NOTICE 'OK  nova mudança de status não abre segunda conta';
END $$;

-- 4. conta que faltou (como as gravadas antes da correção): a abertura das
--    que faltam pega a internação uma vez só
ALTER TABLE public.internacoes DISABLE TRIGGER trg_conta_da_internacao;
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, episodio_id, internado_em)
VALUES ('26000000-0000-4000-8000-0000000cb003', '00000000-0000-4000-8000-0000000cb001', '00000000-0000-4000-8000-0000000cb002',
        '23000000-0000-4000-8000-0000000cb003', 'internado', '00000000-0000-4000-8000-0000000cb012', now() - interval '8 hours',
        '25000000-0000-4000-8000-0000000cb003', now() - interval '7 hours');
ALTER TABLE public.internacoes ENABLE TRIGGER trg_conta_da_internacao;
DO $$
DECLARE v_primeira integer; v_segunda integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.contas WHERE internacao_id = '26000000-0000-4000-8000-0000000cb003') THEN
    RAISE EXCEPTION 'FALHOU: preparo do teste: a internação já tem conta';
  END IF;
  v_primeira := private.abrir_contas_de_internacao_que_faltam();
  v_segunda := private.abrir_contas_de_internacao_que_faltam();
  IF v_primeira < 1 OR v_segunda <> 0 THEN
    RAISE EXCEPTION 'FALHOU: abertura das que faltam: primeira %, segunda %', v_primeira, v_segunda;
  END IF;
  IF (SELECT c.aberta_em = (SELECT internado_em FROM public.internacoes WHERE id = '26000000-0000-4000-8000-0000000cb003')
             AND c.conta_origem_id IS NOT DISTINCT FROM (SELECT a.id FROM public.contas a
                                                        WHERE a.episodio_id = '25000000-0000-4000-8000-0000000cb003' AND a.tipo = 'ambulatorial')
        FROM public.contas c WHERE c.internacao_id = '26000000-0000-4000-8000-0000000cb003' AND c.tipo = 'internacao') IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: conta que faltava aberta fora da hora da internação ou sem a da porta';
  END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes i WHERE i.internado_em IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM public.contas c WHERE c.internacao_id = i.id AND c.tipo = 'internacao')) THEN
    RAISE EXCEPTION 'FALHOU: ainda há internação sem conta';
  END IF;
  RAISE NOTICE 'OK  abertura das contas que faltam: uma vez só, na hora da internação, ligada à da porta';
END $$;

DO $$ BEGIN
  IF has_function_privilege('authenticated', 'private.abrir_contas_de_internacao_que_faltam()', 'EXECUTE')
     OR has_function_privilege('anon', 'private.abrir_contas_de_internacao_que_faltam()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: abertura das que faltam exposta a usuário';
  END IF;
  RAISE NOTICE 'OK  abertura das que faltam fora do alcance de usuário';
END $$;
ROLLBACK;
