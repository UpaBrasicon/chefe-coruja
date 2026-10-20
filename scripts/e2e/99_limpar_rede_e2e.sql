-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — apaga a "Rede E2E" e tudo o que foi gravado nela.
-- SÓ ambiente local ou homologação; NUNCA produção (o script confere o nome
-- do banco e para se não houver a organização E2E).
-- Uso: psql ... -f scripts/e2e/99_limpar_rede_e2e.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL session_replication_role = replica;  -- tabelas só de inserção e gatilhos de histórico

DO $$
DECLARE
  v_org constant uuid := 'e1000000-0000-4000-8000-000000000001';
  v_un uuid[];
  v_pac uuid[];
  v_sol uuid[];
  t record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizacoes WHERE id = v_org) THEN
    RAISE NOTICE 'Rede E2E não existe: nada a apagar.'; RETURN;
  END IF;
  v_un := ARRAY(SELECT id FROM public.unidades WHERE organizacao_id = v_org);
  v_pac := ARRAY(SELECT id FROM public.pacientes WHERE unidade_id = ANY (v_un));
  v_sol := ARRAY(SELECT id FROM public.regulacao_solicitacoes WHERE organizacao_id = v_org);

  -- tabelas ligadas à regulação
  DELETE FROM public.regulacao_destino_respostas WHERE solicitacao_id = ANY (v_sol);
  DELETE FROM public.regulacao_evolucoes WHERE solicitacao_id = ANY (v_sol);
  DELETE FROM public.regulacao_status_tempos WHERE solicitacao_id = ANY (v_sol);
  DELETE FROM public.regulacao_anexos WHERE solicitacao_id = ANY (v_sol);
  DELETE FROM public.regulacao_eventos WHERE solicitacao_id = ANY (v_sol);
  DELETE FROM public.regulacao_solicitacoes WHERE id = ANY (v_sol);

  -- toda tabela pública com unidade_id ou paciente_id da rede E2E (ordem: as que
  -- apontam para paciente primeiro); repete até não sobrar nada
  FOR i IN 1..6 LOOP
    FOR t IN SELECT c.table_name, c.column_name FROM information_schema.columns c
               JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
              WHERE c.table_schema = 'public' AND c.column_name IN ('paciente_id', 'unidade_id', 'unidade_origem_id', 'destino_unidade_id', 'central_id', 'organizacao_id')
                AND c.table_name NOT IN ('unidades', 'organizacoes', 'pacientes', 'setores', 'leitos', 'vinculos', 'perfis')
    LOOP
      BEGIN
        IF t.column_name = 'paciente_id' THEN
          EXECUTE format('DELETE FROM public.%I WHERE paciente_id = ANY ($1)', t.table_name) USING v_pac;
        ELSIF t.column_name = 'organizacao_id' THEN
          EXECUTE format('DELETE FROM public.%I WHERE organizacao_id = $1', t.table_name) USING v_org;
        ELSE
          EXECUTE format('DELETE FROM public.%I WHERE %I = ANY ($1)', t.table_name, t.column_name) USING v_un;
        END IF;
      EXCEPTION WHEN foreign_key_violation THEN NULL;  -- tenta de novo na próxima volta
      END;
    END LOOP;
  END LOOP;

  DELETE FROM public.pacientes WHERE id = ANY (v_pac);
  DELETE FROM public.leitos WHERE setor_id IN (SELECT id FROM public.setores WHERE unidade_id = ANY (v_un));
  DELETE FROM public.setores WHERE unidade_id = ANY (v_un);
  DELETE FROM public.vinculos WHERE unidade_id = ANY (v_un);
  DELETE FROM public.centrais_regulacao WHERE organizacao_id = v_org;
  DELETE FROM public.unidades WHERE id = ANY (v_un);
  DELETE FROM public.organizacoes WHERE id = v_org;
  DELETE FROM public.super_admins WHERE perfil_id::text LIKE 'e2000000%';
  DELETE FROM public.notificacoes_plantonista WHERE perfil_id::text LIKE 'e2000000%';
  DELETE FROM public.perfis WHERE id::text LIKE 'e2000000%';
  DELETE FROM auth.identities WHERE user_id::text LIKE 'e2000000%';
  DELETE FROM auth.users WHERE id::text LIKE 'e2000000%';
  RAISE NOTICE 'Rede E2E apagada.';
END $$;
COMMIT;
