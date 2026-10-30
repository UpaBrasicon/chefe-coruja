-- ════════════════════════════════════════════════════════════════════════════
-- Bug alto A2 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- a troca entrava na escala sem o gestor. aprovar_troca aceitava o colega que
-- recebe (perfil_b) como aprovador e aplicava na hora, embora a unidade exija
-- aprovação (escala_passagem_exige_aprovacao, padrão seguro = exige) e a tela da
-- E4 diga "a coordenação decide".
--
-- Correção: aprovar_troca só aplica com o gestor da unidade (ou o super admin).
-- O colega continua podendo recusar (recusar_troca). Na unidade sem aprovação,
-- solicitar_troca segue aplicando na hora, como antes. A tela do gestor passa a
-- listar as trocas na aba Pedidos (mesmo PR).
-- O A3 (quem recebe reescrevia a troca por update direto) já foi fechado pela
-- 20270208000001 (escrita em trocas_plantao só pelas RPCs).
--
-- Corpo de 20260815000028/20261022000022, igual na produção (md5 21ca0bb1…, sem
-- \r); muda só a conferência de acesso. Sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/escala_troca_gestor.sql
--
-- Rollback: reaplicar public.aprovar_troca com a conferência antiga:
--   IF NOT (v_t.perfil_b_id = v_perfil OR private.papel_na_unidade(v_t.unidade_id) = 'gestor'
--           OR private.eh_super_admin()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.aprovar_troca(p_troca uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_t public.trocas_plantao%ROWTYPE;
  v_erro text;
BEGIN
  SELECT * INTO v_t FROM public.trocas_plantao WHERE id = p_troca;
  IF v_t.id IS NULL THEN
    RAISE EXCEPTION 'Troca não encontrada';
  END IF;
  IF v_t.status <> 'pendente' THEN
    RAISE EXCEPTION 'Troca não está pendente';
  END IF;
  -- A2: só o gestor da unidade (ou o super admin) põe a troca na escala
  IF NOT (private.papel_na_unidade(v_t.unidade_id) = 'gestor' OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Só o gestor da unidade aprova a troca. O colega pode recusar.';
  END IF;

  BEGIN
    PERFORM private.aplicar_troca(v_t);
    UPDATE public.trocas_plantao SET status = 'aprovado', decidido_por = v_perfil, updated_at = now() WHERE id = p_troca;
    PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'troca_aprovada',
      'Troca aprovada', jsonb_build_object('troca_id', p_troca));
  EXCEPTION WHEN OTHERS THEN
    v_erro := SQLERRM;
    UPDATE public.trocas_plantao SET status = 'erro', erro = v_erro, updated_at = now() WHERE id = p_troca;
    PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'erro_passagem',
      v_erro, jsonb_build_object('troca_id', p_troca, 'tipo', 'troca'));
    RAISE EXCEPTION '%', v_erro;
  END;
END; $function$;
