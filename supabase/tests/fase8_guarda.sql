-- Testes da migration 20261001000004_fase8_guarda_20_anos.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase8_guarda.sql
BEGIN;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.negado(sql text, rotulo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RETURN;  -- qualquer recusa (gatilho, chave estrangeira, permissão) serve
  END;
  RAISE EXCEPTION 'FALHOU: %', rotulo;
END $$;

-- ── 1. DELETE de registro clínico é recusado até para o superusuário ────────
SELECT pg_temp.negado($$DELETE FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000001'$$, 'apagou paciente');
SELECT pg_temp.negado($$DELETE FROM public.observacao WHERE paciente_id = '23000000-0000-4000-8000-000000000001'$$, 'apagou sinal vital');
SELECT pg_temp.negado($$DELETE FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001'$$, 'apagou a unidade em cascata');
DO $$ BEGIN RAISE NOTICE 'OK  paciente, sinal vital e unidade (cascata) não se apagam'; END $$;

-- ── 2. rascunho de prescrição ainda sai; prescrição emitida não ─────────────
DO $$
DECLARE v_r uuid; v_a uuid;
BEGIN
  INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status)
  VALUES ('21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'rascunho')
  RETURNING id INTO v_r;
  INSERT INTO public.prescricao_itens (prescricao_id, descricao) VALUES (v_r, 'dipirona');
  DELETE FROM public.prescricoes WHERE id = v_r;
  IF EXISTS (SELECT 1 FROM public.prescricoes WHERE id = v_r) THEN RAISE EXCEPTION 'FALHOU: rascunho não saiu'; END IF;

  INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status)
  VALUES ('21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'ativa')
  RETURNING id INTO v_a;
  BEGIN
    DELETE FROM public.prescricoes WHERE id = v_a;
    RAISE EXCEPTION 'FALHOU: prescrição ativa apagada';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  rascunho de prescrição sai; prescrição ativa fica';
END $$;

-- ── 3. dentro dos 20 anos não há destinação ────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.negado($$SELECT public.solicitar_destinacao_prontuario('23000000-0000-4000-8000-000000000001', 'eliminacao', 'teste dentro da guarda')$$,
  'destinação dentro dos 20 anos');
DO $$ BEGIN
  IF (public.guarda_prontuarios('21000000-0000-4000-8000-000000000001') ->> 'elegiveis')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: unidade de teste com prontuário elegível';
  END IF;
  RAISE NOTICE 'OK  dentro dos 20 anos a destinação é recusada; retrato da guarda sem elegíveis';
END $$;

-- ── 4. paciente antigo: gestor solicita, RT (outra pessoa) aprova ──────────
RESET ROLE;
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, created_at)
VALUES ('23000000-0000-4000-8000-000000000097', '21000000-0000-4000-8000-000000000001', 'Paciente Antigo de Teste', '1930-01-01', '2004.000001',
        now() - interval '21 years');
-- o plantonista do seed vira RT médico só nesta transação
INSERT INTO public.responsaveis_tecnicos (perfil_id, tipo, conselho, registro, uf)
VALUES ('10000000-0000-4000-8000-000000000002', 'medico', 'CRM', '00000', 'GO');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE v uuid;
BEGIN
  v := public.solicitar_destinacao_prontuario('23000000-0000-4000-8000-000000000097', 'devolucao_paciente', 'Pedido do próprio paciente, após 20 anos');
  PERFORM set_config('teste.dest', v::text, true);
  BEGIN
    PERFORM public.decidir_destinacao_prontuario(v, true);
    RAISE EXCEPTION 'FALHOU: gestor (sem ser RT) decidiu';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  gestor solicita a destinação de prontuário com mais de 20 anos';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.decidir_destinacao_prontuario(current_setting('teste.dest')::uuid, true);
  IF (SELECT status FROM public.destinacoes_prontuario WHERE id = current_setting('teste.dest')::uuid) <> 'aprovada' THEN
    RAISE EXCEPTION 'FALHOU: RT não aprovou';
  END IF;
  RAISE NOTICE 'OK  RT médico aprova; a destinação fica registrada';
END $$;

-- ── 5. o registro da destinação não se apaga ───────────────────────────────
RESET ROLE;
SELECT pg_temp.negado(format('DELETE FROM public.destinacoes_prontuario WHERE id = %L', current_setting('teste.dest')), 'apagou o registro da destinação');
DO $$ BEGIN
  IF (SELECT identificacao_hash FROM public.destinacoes_prontuario WHERE id = current_setting('teste.dest')::uuid) !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'FALHOU: destinação sem hash de identificação';
  END IF;
  RAISE NOTICE 'OK  registro da destinação é permanente e guarda o hash, não o nome';
END $$;

ROLLBACK;
