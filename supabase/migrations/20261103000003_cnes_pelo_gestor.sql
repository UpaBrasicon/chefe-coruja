-- Fase 3, tarefa 3 (decisão do RT de 10/10/2026): cada unidade tem o seu
-- CNES, preenchido pelo gestor da unidade. O CNES vai em toda linha do BPA
-- (posições 3–9). Confere o formato (7 dígitos); o dígito verificador não é
-- conferido porque não há fonte oficial do algoritmo à mão. Fica na
-- auditoria. Só aditiva.
CREATE OR REPLACE FUNCTION public.definir_cnes_unidade(p_unidade uuid, p_cnes text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text := private.so_digitos(p_cnes); v_antes text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'O CNES da unidade é preenchido pelo gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v IS NULL OR length(v) <> 7 THEN RAISE EXCEPTION 'CNES com 7 dígitos.'; END IF;
  IF EXISTS (SELECT 1 FROM public.unidades WHERE cnes = v AND id <> p_unidade) THEN
    RAISE EXCEPTION 'Este CNES já está em outra unidade.';
  END IF;
  SELECT cnes INTO v_antes FROM public.unidades WHERE id = p_unidade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  UPDATE public.unidades SET cnes = v, updated_at = now() WHERE id = p_unidade;
  PERFORM private.registrar_auditoria('cnes_unidade_definido', 'unidades', p_unidade, p_unidade,
    jsonb_build_object('antes', v_antes, 'depois', v));
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.definir_cnes_unidade(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_cnes_unidade(uuid, text) TO authenticated;
