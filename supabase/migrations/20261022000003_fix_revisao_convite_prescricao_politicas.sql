-- ════════════════════════════════════════════════════════════════════════════
-- Correções da revisão de 02/10/2026 (mudanças feitas pelo Remote Control).
--
-- 1. pedir_novo_convite: a tentativa errada era registrada e logo desfeita
--    pelo RAISE seguinte, então sondar códigos por esta RPC não contava no
--    limite de força bruta. Agora registra e devolve vazio (a tela de Cadastro
--    já trata resposta vazia como erro).
-- 2. registrar_prescricao_itens (legado, sem uso no app): apagava os itens de
--    uma prescrição ATIVA, o que a guarda de 20 anos recusa — o autor não
--    conseguia mais salvar; e o gestor ainda gravava itens na prescrição de
--    outro médico. A prescrição estruturada substituiu esta RPC: sai de
--    authenticated (fica só para service_role).
-- 3. pareceres_medicos, atendimento_reavaliacoes e acuidade_afericoes ficaram
--    sem as policies de leitura por pedido de acesso (fase 6) e por
--    teleinterconsulta (fase 7) que as tabelas clínicas irmãs têm;
--    pareceres_medicos também sem a RESTRICTIVA de segundo fator.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pedir_novo_convite(p_codigo text)
 RETURNS TABLE(convidou text, pedido_em timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.convites%ROWTYPE;
BEGIN
  IF private.primeiro_acesso_bloqueado() THEN
    RAISE EXCEPTION 'Muitas tentativas. Espere 15 minutos.';
  END IF;
  SELECT * INTO c FROM public.convites WHERE codigo = upper(btrim(coalesce(p_codigo, ''))) FOR UPDATE;
  IF NOT FOUND OR private.situacao_convite(c.usado_em, c.revogado_em, c.expira_em) <> 'expirado' THEN
    -- sem RAISE: a tentativa precisa ficar registrada (o RAISE a desfazia)
    PERFORM private.registrar_tentativa_primeiro_acesso();
    RETURN;
  END IF;
  UPDATE public.convites SET novo_pedido_em = coalesce(novo_pedido_em, now()) WHERE id = c.id
  RETURNING convites.novo_pedido_em INTO c.novo_pedido_em;
  RETURN QUERY SELECT (SELECT p.nome_completo FROM public.perfis p WHERE p.id = c.criado_por), c.novo_pedido_em;
END $function$;

-- ── 2 ───────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.registrar_prescricao_itens(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_prescricao_itens(uuid, text, jsonb) TO service_role;

-- ── 3 ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pareceres_medicos', 'atendimento_reavaliacoes', 'acuidade_afericoes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_pedido_acesso ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_pedido_acesso ON public.%1$I FOR SELECT TO authenticated
                      USING (private.acesso_encerrado_vigente(paciente_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_teleinterconsulta ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_teleinterconsulta ON public.%1$I FOR SELECT TO authenticated
                      USING (private.teleinterconsulta_vigente(paciente_id))', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS pareceres_medicos_segundo_fator ON public.pareceres_medicos;
CREATE POLICY pareceres_medicos_segundo_fator ON public.pareceres_medicos AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());
