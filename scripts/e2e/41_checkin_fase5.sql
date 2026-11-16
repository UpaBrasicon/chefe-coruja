-- ════════════════════════════════════════════════════════════════════════════
-- Portão da Fase 5 — check-in dos plantões em curso das contas da rede F5.
-- Sem o check-in, passada a tolerância (30 min), a escala fecha a porta.
-- Rodar no começo de cada sessão de teste. Ambiente local ou homologação.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
-- trava (S10, H4): só homologação ou banco local; nunca a produção
DO $trava$
BEGIN
  -- S10 (H4): só homologação ou banco local, pela marca ambiente_teste da
  -- configuração (a produção tem uma rede fictícia com a UPA Homologação, então
  -- a existência dessa unidade não prova nada)
  IF NOT coalesce((SELECT c.valor FROM public.configuracao_plataforma c WHERE c.chave = 'ambiente_teste'), false) THEN
    RAISE EXCEPTION 'Este banco não é de teste: a marca ambiente_teste não está ligada (só a homologação e o banco local a têm; a produção tem a marca desligada). Confira o projeto ligado (kswurfyxxvfydpjfrivy).';
  END IF;
END
$trava$;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio
  FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id::text LIKE 'f5200000%'
   AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
SELECT 'check-in F5' AS situacao, count(*) AS presencas FROM public.presenca_plantonista
 WHERE perfil_id::text LIKE 'f5200000%' AND checkin_em IS NOT NULL;
