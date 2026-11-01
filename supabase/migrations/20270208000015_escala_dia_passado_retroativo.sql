-- ════════════════════════════════════════════════════════════════════════════
-- Bug baixo B3 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md),
-- decisão do RT em 31/10/2026 (opção A, "Aceita como retroativo",
-- docs/escala/BAIXOS-PROPOSTAS-E-REGISTRO.md): adicionar_plantao_escala aceitava
-- dia que já passou sem marcar nada (gravado 28/10 noite às 04 h de 29/10).
--
-- Correção: escalar em dia que já passou continua valendo e continua só para o
-- gestor (e o super admin), como já era; quando o plantão já começou, o
-- histórico da escala ganha a ação 'retroativo' ("Acerto retroativo: plantão
-- escalado depois de começar"), com o gestor como autor. Serve para acertar a
-- escala do mês (ERP, falta, presença). A tela avisa antes de confirmar (mesmo PR).
-- O corpo é o de 20270202000003_escala_gestor_categorias.sql com o bloco do B3.
-- Mesma assinatura e mesmo retorno. Sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/escala_dia_passado_retroativo.sql
--
-- Rollback:
--   reaplicar public.adicionar_plantao_escala de 20270202000003_escala_gestor_categorias.sql
--   (o histórico 'retroativo' já gravado pode ficar).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.adicionar_plantao_escala(
  p_unidade uuid, p_setor uuid, p_perfil uuid, p_data date, p_turno text,
  p_rotulo text DEFAULT NULL, p_quinzenal boolean DEFAULT false, p_papel public.papel DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_existente uuid;
  v_id uuid;
  v_inicio timestamptz;
BEGIN
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor pode montar a escala.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo) THEN
    RAISE EXCEPTION 'Este profissional não tem vínculo ativo nesta unidade.';
  END IF;
  -- a categoria escolhida tem de ser um papel da pessoa (o gatilho confere de novo)
  IF p_papel IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo AND v.papel = p_papel) THEN
    RAISE EXCEPTION 'Este profissional não tem o papel de % nesta unidade.', replace(p_papel::text, '_', ' ');
  END IF;

  SELECT e.id INTO v_existente
  FROM public.escala_plantao e
  WHERE e.perfil_id = p_perfil
    AND e.data = p_data
    AND e.turno = p_turno
    AND e.setor_id <> p_setor
    AND e.ativo
  LIMIT 1;

  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito: este profissional já está escalado em outro setor nesta data/turno.';
  END IF;

  INSERT INTO public.escala_plantao
    (unidade_id, setor_id, perfil_id, data, turno, rotulo, quinzenal, ativo, criado_por, papel)
  VALUES (p_unidade, p_setor, p_perfil, p_data, p_turno, p_rotulo, p_quinzenal, true, auth.uid(), p_papel)
  ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este plantão já está preenchido por este profissional.';
  END IF;

  -- B3: plantão que já começou fica como acerto retroativo no histórico
  SELECT e.inicio INTO v_inicio FROM public.escala_plantao e WHERE e.id = v_id;
  IF v_inicio <= now() THEN
    PERFORM private.registrar_historico(p_unidade, v_id, 'retroativo',
      'Acerto retroativo: plantão escalado depois de começar',
      jsonb_build_object('data', p_data, 'turno', p_turno, 'perfil_id', p_perfil, 'papel', p_papel));
  END IF;

  RETURN v_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.adicionar_plantao_escala(uuid, uuid, uuid, date, text, text, boolean, public.papel) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adicionar_plantao_escala(uuid, uuid, uuid, date, text, text, boolean, public.papel) TO authenticated;
