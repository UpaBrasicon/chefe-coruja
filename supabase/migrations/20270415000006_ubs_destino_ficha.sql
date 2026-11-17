-- Percurso da UBS, U6, PR 2 (plano docs/ubs/U6-U7-PLANO.md; RT, 17/11/2026):
-- a ficha da UBS vai para o médico ou para a enfermagem.
--
-- 1. episodios.destino_aps (expand): 'medico' ou 'enfermagem'; nulo fora da UBS
--    e nas fichas antigas (= médico).
-- 2. registrar_ficha: na UBS, p_dados.destino escolhe; sem enfermeiro de
--    plantão no consultório, vai ao médico. Devolve o destino.
-- 3. agenda_registrar_chegada: a consulta marcada com o enfermeiro vai para a
--    enfermagem; com o médico, para o médico.
--
-- A consulta de enfermagem em si (iniciar, SOAP e conduta pelo enfermeiro) vem
-- no PR 3. Este PR só vai à produção junto com o PR 3: sem ele, a ficha da
-- enfermagem ficaria sem quem a atendesse.
--
-- Idempotente. Teste: supabase/tests/ubs_destino_ficha.sql
--
-- Rollback (na ordem): as trocas 2 e 3 invertidas (os trechos estão abaixo);
-- a coluna fica (expand); para tirá-la, com janela:
--   ALTER TABLE public.episodios DROP COLUMN destino_aps;

CREATE OR REPLACE FUNCTION pg_temp.u62_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(replace(p_pares[k + 1], chr(13), '') IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. coluna ───────────────────────────────────────────────────────────────
ALTER TABLE public.episodios ADD COLUMN IF NOT EXISTS destino_aps text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'episodios_destino_aps_check'
                   AND conrelid = 'public.episodios'::regclass) THEN
    ALTER TABLE public.episodios ADD CONSTRAINT episodios_destino_aps_check CHECK (
      destino_aps IS NULL OR (tipo_atendimento_aps IS NOT NULL AND destino_aps IN ('medico', 'enfermagem')));
  END IF;
END $$;
COMMENT ON COLUMN public.episodios.destino_aps IS
  'UBS: para quem é a ficha, médico ou enfermagem (percurso da UBS, U6). Nulo nas antigas = médico.';

-- ── 2. ficha com destino ────────────────────────────────────────────────────
SELECT pg_temp.u62_trocar('public.registrar_ficha(uuid, text, uuid, jsonb, text[], boolean)',
  'INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, prioridades_legais, aberto_por, etapa, tipo_atendimento_aps)',
  'INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, prioridades_legais, aberto_por, etapa, tipo_atendimento_aps, destino_aps)',
  'THEN ''atendimento'' ELSE ''triagem'' END, v_tipo_aps)',
  'THEN ''atendimento'' ELSE ''triagem'' END, v_tipo_aps, CASE WHEN v_ubs THEN CASE WHEN coalesce(p_dados ->> ''destino'', '''') = ''enfermagem'' AND private.enfermeiro_de_plantao(p_setor) THEN ''enfermagem'' ELSE ''medico'' END END)',
  '''etapa'', (SELECT etapa FROM public.episodios WHERE id = v_epi));',
  '''etapa'', (SELECT etapa FROM public.episodios WHERE id = v_epi), ''destino'', (SELECT destino_aps FROM public.episodios WHERE id = v_epi));');

-- ── 3. chegada da consulta marcada ──────────────────────────────────────────
SELECT pg_temp.u62_trocar('public.agenda_registrar_chegada(uuid, uuid, text)',
  'jsonb_build_object(''tipo_atendimento'', a.tipo_atendimento_aps)',
  'jsonb_build_object(''tipo_atendimento'', a.tipo_atendimento_aps, ''destino'', CASE WHEN EXISTS (SELECT 1 FROM public.vinculos v WHERE v.unidade_id = a.unidade_id AND v.perfil_id = a.perfil_id AND v.ativo AND v.papel::text = ''plantonista'') THEN ''medico'' ELSE ''enfermagem'' END)');

DROP FUNCTION pg_temp.u62_trocar(regprocedure, text[]);
