-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend, onda 1 — o farmacêutico no chat.
--
-- O protótipo dá chat ao farmacêutico (P/index.html chatTemAcesso): o
-- plantonista pergunta de diluição e de falta ali. As funções do chat já
-- aceitam qualquer vínculo ativo; faltava o farmacêutico aparecer nos
-- contatos, para que alguém consiga começar a conversa com ele.
--
-- Duas mudanças na lista de contatos (o resto é o de 20260926000003):
--   1. ganha os farmacêuticos das unidades do usuário (formato dos gestores);
--   2. quem está escalado agora vem com o PAPEL do vínculo, e não sempre
--      "plantonista" — enfermeira e recepção apareciam como plantonista.
--
-- DOWN: reaplicar a definição de 20260926000003_fase1_turno_como_janela.sql.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.contatos_chat()
RETURNS TABLE(perfil_id uuid, nome text, foto text, papel text, setor_nome text, em_plantao boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id, p.nome_completo, p.foto_url, v.papel::text, s.nome, true
  FROM public.escala_plantao e
  JOIN public.perfis p ON p.id = e.perfil_id
  JOIN public.setores s ON s.id = e.setor_id
  JOIN public.vinculos v ON v.perfil_id = p.id AND v.unidade_id = e.unidade_id AND v.ativo
  WHERE e.ativo
    AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
    AND e.unidade_id IN (SELECT v2.unidade_id FROM public.vinculos v2 WHERE v2.perfil_id = v_perfil AND v2.ativo)
  UNION ALL
  SELECT DISTINCT p.id, p.nome_completo, p.foto_url, 'gestor'::text, NULL::text, false
  FROM public.vinculos v
  JOIN public.perfis p ON p.id = v.perfil_id
  WHERE v.papel = 'gestor' AND v.ativo
    AND v.unidade_id IN (SELECT v2.unidade_id FROM public.vinculos v2 WHERE v2.perfil_id = v_perfil AND v2.ativo)
    AND p.id <> v_perfil
  UNION ALL
  SELECT DISTINCT p.id, p.nome_completo, p.foto_url, 'farmaceutico'::text, NULL::text, false
  FROM public.vinculos v
  JOIN public.perfis p ON p.id = v.perfil_id
  WHERE v.papel = 'farmaceutico' AND v.ativo
    AND v.unidade_id IN (SELECT v2.unidade_id FROM public.vinculos v2 WHERE v2.perfil_id = v_perfil AND v2.ativo)
    AND p.id <> v_perfil
  ORDER BY 2;
END; $$;

REVOKE EXECUTE ON FUNCTION public.contatos_chat() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.contatos_chat() TO authenticated;
