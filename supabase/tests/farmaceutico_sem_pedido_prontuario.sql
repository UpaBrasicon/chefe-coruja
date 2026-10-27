-- Testes da migration 20270105000001_farmaceutico_sem_pedido_prontuario.sql
-- (telas do farmacêutico, ponto 6, decisão do RT de 27/10/2026).
-- Banco local com o seed, transação com ROLLBACK:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/farmaceutico_sem_pedido_prontuario.sql
--
-- O perfil …06 (telemedicina no seed) fica só farmacêutico na unidade. O
-- paciente do teste (…98) tem um pedido aprovado e vigente desse perfil, como
-- se tivesse sido aprovado antes da migration.
BEGIN;

UPDATE public.vinculos SET ativo = false
 WHERE perfil_id = '10000000-0000-4000-8000-000000000006' AND unidade_id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico')
ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true;
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000006';

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id)
VALUES ('23000000-0000-4000-8000-000000000098', '21000000-0000-4000-8000-000000000001', 'Paciente do Teste do Farmacêutico',
        '1971-02-02', 'T-098', '22000000-0000-4000-8000-000000000001');
INSERT INTO public.pedidos_acesso_prontuario (organizacao_id, unidade_id, paciente_id, solicitante_id, papel, motivo,
                                              status, decidido_por, decidido_em, valido_ate)
SELECT u.organizacao_id, u.id, '23000000-0000-4000-8000-000000000098', '10000000-0000-4000-8000-000000000006', 'farmaceutico',
       'Pedido aprovado antes da mudança', 'aprovado', '10000000-0000-4000-8000-000000000001', now(), now() + interval '20 hours'
FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;

-- ── 1. a regra: quem pede ───────────────────────────────────────────────────
DO $$ BEGIN
  IF private.papel_pode_pedir_acesso('farmaceutico') THEN
    RAISE EXCEPTION 'FALHOU: farmacêutico ainda pode pedir acesso';
  END IF;
  IF NOT (private.papel_pode_pedir_acesso('plantonista') AND private.papel_pode_pedir_acesso('telemedicina')
          AND private.papel_pode_pedir_acesso('enfermeiro') AND private.papel_pode_pedir_acesso('tecnico_enfermagem')) THEN
    RAISE EXCEPTION 'FALHOU: um papel do cuidado perdeu o pedido de acesso';
  END IF;
  IF private.papel_pode_pedir_acesso('gestor') OR private.papel_pode_pedir_acesso('recepcao') OR private.papel_pode_pedir_acesso('') THEN
    RAISE EXCEPTION 'FALHOU: papel fora do cuidado pode pedir';
  END IF;
  RAISE NOTICE 'OK  farmacêutico fora; plantonista, telemedicina, enfermeiro e técnico seguem';
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');

-- ── 2. o farmacêutico não busca nem pede ────────────────────────────────────
DO $$ BEGIN
  IF private.papel_na_unidade('21000000-0000-4000-8000-000000000001') <> 'farmaceutico' THEN
    RAISE EXCEPTION 'FALHOU: preparo — o perfil do teste não é só farmacêutico';
  END IF;
  BEGIN
    PERFORM * FROM public.buscar_paciente_para_pedido('21000000-0000-4000-8000-000000000001', 'T-098', NULL, NULL);
    RAISE EXCEPTION 'FALHOU: farmacêutico buscou paciente para pedido';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.pedir_acesso_prontuario('23000000-0000-4000-8000-000000000098', 'Conferir a alergia antes de validar');
    RAISE EXCEPTION 'FALHOU: farmacêutico pediu acesso ao prontuário';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  farmacêutico não busca nem pede';
END $$;

-- ── 3. pedido aprovado antes da mudança não abre leitura ────────────────────
DO $$ BEGIN
  IF private.acesso_encerrado_vigente('23000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'FALHOU: pedido aprovado do farmacêutico ainda abre leitura';
  END IF;
  BEGIN
    PERFORM public.abrir_prontuario('23000000-0000-4000-8000-000000000098');
    RAISE EXCEPTION 'FALHOU: farmacêutico abriu o prontuário pelo pedido antigo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  pedido antigo do farmacêutico não abre leitura';
END $$;

-- ── 4. com papel do cuidado na unidade, o mesmo pedido volta a valer ────────
RESET ROLE;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'enfermeiro')
ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
DO $$ BEGIN
  IF private.papel_na_unidade('21000000-0000-4000-8000-000000000001') <> 'enfermeiro' THEN
    RAISE EXCEPTION 'FALHOU: preparo — o perfil do teste não ficou enfermeiro';
  END IF;
  IF NOT private.acesso_encerrado_vigente('23000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'FALHOU: papel do cuidado perdeu a leitura do pedido aprovado';
  END IF;
  RAISE NOTICE 'OK  papel do cuidado na unidade segue lendo';
END $$;

ROLLBACK;
