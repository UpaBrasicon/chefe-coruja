-- ════════════════════════════════════════════════════════════════════════════
-- Bug crítico C1 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- troca forçada. Qualquer escalado gravava a troca direto em trocas_plantao
-- (a política de INSERT só conferia perfil_a_id = eu), com o plantão de um colega
-- como A e ele mesmo como B, e aprovava com aprovar_troca (que aceita perfil_b).
-- private.aplicar_troca trocava os donos reais dos plantões, sem o colega e sem
-- o gestor. A política de UPDATE (sem WITH CHECK) deixava quem recebe reescrever
-- a troca (outro plantão, outro dono) e chegar ao mesmo resultado.
--
-- Correção:
--  1. trocas_plantao só se escreve pelas RPCs (solicitar_troca, aprovar_troca,
--     recusar_troca, todas SECURITY DEFINER). A tela não grava na tabela: só lê
--     (Escala.tsx, usePedidosDaEquipe.ts) e chama as RPCs. Sai o INSERT, o UPDATE
--     e o DELETE de anon/authenticated e as duas políticas de escrita; a leitura
--     (trocas_select) fica como está.
--  2. private.aplicar_troca confere que os donos gravados na troca são os donos
--     de agora dos dois plantões e que são pessoas diferentes. Pega a troca
--     forjada que já esteja gravada e o plantão que mudou de dono depois do pedido.
--
-- Sem DROP/RENAME de coluna, sem mudança de tipo. Idempotente.
-- Teste: supabase/tests/escala_troca_forcada.sql
--
-- Rollback (devolve o estado da 20260815000028 + 20261123000001):
--   GRANT INSERT, UPDATE, DELETE ON public.trocas_plantao TO authenticated;
--   DROP POLICY IF EXISTS "trocas_insert" ON public.trocas_plantao;
--   CREATE POLICY "trocas_insert" ON public.trocas_plantao FOR INSERT TO authenticated
--     WITH CHECK (perfil_a_id = private.meu_perfil_id());
--   DROP POLICY IF EXISTS "trocas_update" ON public.trocas_plantao;
--   CREATE POLICY "trocas_update" ON public.trocas_plantao FOR UPDATE TO authenticated
--     USING (perfil_b_id = private.meu_perfil_id() OR private.eh_super_admin()
--            OR private.papel_na_unidade(unidade_id) = 'gestor');
--   e reaplicar private.aplicar_troca de 20261123000001_escala_sem_sobreposicao.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. escrita só pelas RPCs ───────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON public.trocas_plantao FROM anon, authenticated;
DROP POLICY IF EXISTS "trocas_insert" ON public.trocas_plantao;
DROP POLICY IF EXISTS "trocas_update" ON public.trocas_plantao;

-- ── 2. a troca aplicada tem de bater com a escala ──────────────────────────
-- Corpo de 20261123000001_escala_sem_sobreposicao.sql; entra só a conferência
-- dos donos antes das checagens de conflito.
CREATE OR REPLACE FUNCTION private.aplicar_troca(p_troca public.trocas_plantao)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_a public.escala_plantao%ROWTYPE;
  v_b public.escala_plantao%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.escala_plantao WHERE id = p_troca.plantao_a_id AND ativo;
  SELECT * INTO v_b FROM public.escala_plantao WHERE id = p_troca.plantao_b_id AND ativo;
  IF v_a.id IS NULL OR v_b.id IS NULL THEN
    RAISE EXCEPTION 'Um dos plantões da troca não está mais ativo';
  END IF;

  -- C1: cada plantão ainda é de quem a troca diz, e são duas pessoas
  IF v_a.perfil_id IS DISTINCT FROM p_troca.perfil_a_id
     OR v_b.perfil_id IS DISTINCT FROM p_troca.perfil_b_id
     OR p_troca.perfil_a_id = p_troca.perfil_b_id THEN
    RAISE EXCEPTION 'A troca não confere com a escala: um dos plantões não é mais de quem está na troca. Peça a troca de novo.';
  END IF;

  -- conflito do B assumindo A
  IF private.tem_conflito_plantao(v_b.perfil_id, v_a.unidade_id, v_a.setor_id, v_a.data, v_a.turno, v_a.id) THEN
    RAISE EXCEPTION 'Conflito de horário: o plantonista do plantão B já tem plantão no mesmo horário';
  END IF;
  -- conflito do A assumindo B
  IF private.tem_conflito_plantao(v_a.perfil_id, v_b.unidade_id, v_b.setor_id, v_b.data, v_b.turno, v_b.id) THEN
    RAISE EXCEPTION 'Conflito de horário: o plantonista do plantão A já tem plantão no mesmo horário';
  END IF;

  -- Portão 2, tarefa 4: a sobreposição se confere com os dois lados gravados
  SET CONSTRAINTS public.trg_escala_sem_sobreposicao DEFERRED;
  UPDATE public.escala_plantao SET perfil_id = v_b.perfil_id, updated_at = now() WHERE id = v_a.id;
  UPDATE public.escala_plantao SET perfil_id = v_a.perfil_id, updated_at = now() WHERE id = v_b.id;
  SET CONSTRAINTS public.trg_escala_sem_sobreposicao IMMEDIATE;
END; $function$;
