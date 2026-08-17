-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — RPCs de curadoria da diluição
-- publicar_diluicao: exige revisor_crf; nunca permite publicar sem revisor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Publica um registro de diluição (somente super; revisor_crf obrigatório)
CREATE OR REPLACE FUNCTION public.publicar_diluicao(
  p_diluicao uuid,
  p_revisor_crf text,
  p_data_revisao date DEFAULT CURRENT_DATE
) RETURNS void AS $$
BEGIN
  IF p_revisor_crf IS NULL OR trim(p_revisor_crf) = '' THEN
    RAISE EXCEPTION 'Registro de diluição não pode ser publicado sem revisor_crf (farmacêutico responsável).';
  END IF;
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Apenas o super usuário (curadoria) pode publicar diluições.';
  END IF;
  UPDATE public.diluicao
    SET status = 'publicado',
        revisor_crf = p_revisor_crf,
        data_revisao = p_data_revisao
    WHERE id = p_diluicao;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Lista diluições pendentes de revisão (rascunho) — apenas curadoria
CREATE OR REPLACE FUNCTION public.diluicoes_rascunho()
RETURNS SETOF public.diluicao AS $$
BEGIN
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY SELECT * FROM public.diluicao WHERE status = 'rascunho' ORDER BY principio_ativo;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
