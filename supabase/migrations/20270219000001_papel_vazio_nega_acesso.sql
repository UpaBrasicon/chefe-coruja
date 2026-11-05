-- ════════════════════════════════════════════════════════════════════════════
-- Correção de segurança achada no portão da Fase 5 (03/11/2026; o RT autorizou
-- corrigir na hora, como bug crítico em produção).
--
-- private.papel_na_unidade(u) devolve '' (texto vazio) quando a pessoa não tem
-- vínculo na unidade, nunca NULL. Funções que liberavam a leitura com
-- "papel_na_unidade(u) IS NOT NULL" deixavam QUALQUER usuário logado ler a
-- unidade de outro: pendencias_pep (nome do paciente e documento pendente),
-- agenda_dia e agenda_configuracao, encaminhamentos_upa_origem e
-- encaminhamentos_upa_do_paciente (com o resumo clínico do envio),
-- contrarreferencias_da_unidade e contrarreferencias_do_paciente,
-- admissao_detalhes_config e receita_protocolos_da_unidade.
--
-- O conserto troca, no corpo de cada função, o teste
--   private.papel_na_unidade(x) IS NOT NULL
-- por
--   coalesce(private.papel_na_unidade(x), '') <> ''
-- (o mesmo teste que as funções de acesso ao prontuário já usam). Nada mais
-- muda: assinatura, SECURITY DEFINER, search_path e grants ficam os mesmos.
-- Idempotente: depois de aplicada, nenhuma função tem o padrão errado.
-- Teste: supabase/tests/papel_vazio_sem_acesso.sql (também barra a volta do padrão).
--
-- Rollback (só se precisar desfazer; reabre a falha):
--   o mesmo DO trocando de volta "coalesce(private.papel_na_unidade(x), '') <> ''"
--   por "private.papel_na_unidade(x) IS NOT NULL" nas funções listadas acima.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  f record;
  v_def text;
  v_novo text;
  n int := 0;
BEGIN
  FOR f IN
    SELECT p.oid, n.nspname, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('public', 'private')
       AND p.prosrc ~ 'private\.papel_na_unidade\([^()]*\) IS NOT NULL'
  LOOP
    v_def := pg_get_functiondef(f.oid);
    v_novo := regexp_replace(v_def, 'private\.papel_na_unidade\(([^()]*)\) IS NOT NULL',
                             'coalesce(private.papel_na_unidade(\1), '''') <> ''''', 'g');
    EXECUTE v_novo;
    n := n + 1;
    RAISE NOTICE 'corrigida: %.%', f.nspname, f.proname;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname IN ('public', 'private') AND p.prosrc ~ 'papel_na_unidade\([^()]*\) IS NOT NULL') THEN
    RAISE EXCEPTION 'Ainda há função com "papel_na_unidade(...) IS NOT NULL".';
  END IF;
  RAISE NOTICE '% função(ões) corrigida(s).', n;
END $$;
