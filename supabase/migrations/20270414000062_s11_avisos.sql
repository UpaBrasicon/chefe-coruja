-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S11: avisos do Supabase
-- (docs/seguranca/S11-PAINEL-AVISOS-DIAGNOSTICO.md). Decisões do RT em
-- 16/11/2026: todas A.
--
-- F5. search_path fixo nas funções auxiliares que estavam sem ele. Os corpos
--     usam só funções do catálogo ou nomes com schema (conferido na produção
--     em 16/11/2026), então o search_path vazio não muda o comportamento.
-- F6. RLS nas duas tabelas de terminologia que estavam sem ela, com o mesmo
--     par de políticas das outras (leitura para quem está logado, escrita só
--     service_role).
-- F1 a F3 são no painel do Auth; F4 fica como está; F7 é registro no BACKLOG.
--
-- Idempotente. Rollback no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── F5. search_path fixo ────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'private.distancia_km(double precision,double precision,double precision,double precision)',
    'private.hash_evento(integer,text,jsonb,uuid,text,text)',
    'private.internacao_ativa(uuid)',
    'private.limite_chegada_direta()',
    'private.limite_sem_conexao()',
    'private.mascarar(text)',
    'private.nome_comparavel(text)',
    'private.prioridades_por_idade(date,timestamp with time zone)',
    'private.set_updated_at()',
    'private.so_digitos(text)',
    'private.tolerancia_fim_plantao()',
    'private.uuid_conceito(text)',
    'private.validar_observacao()',
    'public.terminologia_buscar(text,text,integer)',
    'terminologia.buscar(text,text,integer)',
    'terminologia.unaccent_text(text)']
  LOOP
    IF to_regprocedure(f) IS NULL THEN
      RAISE NOTICE 'S11: função % não existe aqui, pulada', f;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER FUNCTION %s SET search_path = %L', f, '');
  END LOOP;
END $$;

-- ── F6. RLS nas tabelas de terminologia ─────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ciap2', 'sigtap_procedimento_cid'] LOOP
    IF to_regclass('terminologia.' || t) IS NULL THEN
      RAISE NOTICE 'S11: tabela terminologia.% não existe aqui, pulada', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE terminologia.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_select ON terminologia.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_select ON terminologia.%1$I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_write ON terminologia.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_write ON terminologia.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, se precisar):
--   F5: ALTER FUNCTION <cada uma da lista> RESET search_path;
--   F6: DROP POLICY ciap2_select, ciap2_write ON terminologia.ciap2;
--       DROP POLICY sigtap_procedimento_cid_select, sigtap_procedimento_cid_write
--         ON terminologia.sigtap_procedimento_cid;
--       ALTER TABLE terminologia.ciap2 DISABLE ROW LEVEL SECURITY;
--       ALTER TABLE terminologia.sigtap_procedimento_cid DISABLE ROW LEVEL SECURITY;
-- ════════════════════════════════════════════════════════════════════════════
