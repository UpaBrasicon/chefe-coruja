-- ════════════════════════════════════════════════════════════════════════════
-- Bug alto A1 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- o gestor não abria vaga de duas categorias na mesma faixa (ex.: médico e
-- enfermeiro no PS de manhã). A E2/E4 deu categoria à vaga (papel), mas o índice
-- único escala_vagas_aberta (20261012000001) ficou (setor_id, data, turno):
-- a 2ª categoria batia em "duplicate key value violates unique constraint".
-- marcar_vaga_escala e a geração do mês já procuram a vaga existente pela
-- categoria; o resto (escala_faixas, vagas_abertas) já lida com várias vagas
-- por faixa.
--
-- Correção: o índice passa a ser (setor_id, data, turno, papel) com NULLS NOT
-- DISTINCT — uma vaga aberta por categoria na faixa, e uma só sem categoria.
-- O índice novo nasce antes de o antigo sair (expand e contract no mesmo
-- arquivo: o antigo é mais estrito e nenhum código usa o nome dele nem
-- ON CONFLICT nele). Sem DROP/RENAME de coluna. Idempotente.
-- Teste: supabase/tests/escala_vaga_por_categoria.sql
--
-- Rollback (só se não houver duas vagas abertas da mesma faixa; conferir antes
-- com o SELECT abaixo, que deve devolver 0):
--   SELECT count(*) FROM (SELECT 1 FROM public.escala_vagas
--     WHERE fechada_em IS NULL AND plantao_origem_id IS NULL
--     GROUP BY setor_id, data, turno HAVING count(*) > 1) x;
--   CREATE UNIQUE INDEX IF NOT EXISTS escala_vagas_aberta
--     ON public.escala_vagas (setor_id, data, turno) WHERE fechada_em IS NULL AND plantao_origem_id IS NULL;
--   DROP INDEX IF EXISTS public.escala_vagas_aberta_categoria;
-- ════════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS escala_vagas_aberta_categoria
  ON public.escala_vagas (setor_id, data, turno, papel) NULLS NOT DISTINCT
  WHERE fechada_em IS NULL AND plantao_origem_id IS NULL;

DROP INDEX IF EXISTS public.escala_vagas_aberta;
