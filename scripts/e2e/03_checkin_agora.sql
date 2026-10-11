-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — check-in dos plantões em curso das contas E2E.
-- Sem o check-in, passada a tolerância (30 min), a escala fecha a porta.
-- Rodar no começo de cada sessão de teste. Ambiente local ou homologação.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio
  FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id::text LIKE 'e2000000%'
   AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
SELECT 'check-in E2E', count(*) FROM public.presenca_plantonista WHERE perfil_id::text LIKE 'e2000000%' AND checkin_em IS NOT NULL;
