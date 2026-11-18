-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U12 (U12 = A do RT em 17/11/2026), parte 2: sugestão de
-- inclusão no hiperdia a partir do retorno da UPA. Achado A13: o hipertenso com
-- CID I10 na UPA não chegava como sugestão ao hiperdia da UBS.
--
-- 1. public.hiperdia_sugestoes(unidade): retornos da UPA ou do hospital
--    (contrarreferências dos últimos 180 dias, não canceladas) com CID de
--    hipertensão ou diabetes (a mesma regra da consulta,
--    private.hiperdia_programas_da_consulta), de paciente que ainda não está no
--    programa e cuja sugestão não foi dispensada.
-- 2. public.programa_sugestoes_dispensadas e hiperdia_dispensar_sugestao: o médico
--    ou o enfermeiro diz "não incluir", com motivo, e a sugestão some.
-- A inclusão segue por programa_incluir (manual, como hoje).
--
-- Idempotente. Teste: supabase/tests/ubs_u12_sugestao_hiperdia.sql
--
-- Rollback:
--   DROP FUNCTION public.hiperdia_sugestoes(uuid), public.hiperdia_dispensar_sugestao(uuid, text, text);
--   a tabela fica (expand); para tirá-la, com janela:
--   DROP TABLE public.programa_sugestoes_dispensadas;
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.programa_sugestoes_dispensadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  contrarreferencia_id uuid NOT NULL REFERENCES public.contrarreferencias(id),
  programa text NOT NULL CHECK (programa IN ('hipertensao', 'diabetes')),
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 300),
  dispensado_por uuid REFERENCES public.perfis(id),
  dispensado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrarreferencia_id, programa)
);
COMMENT ON TABLE public.programa_sugestoes_dispensadas IS
  'Sugestões de hiperdia vindas do retorno da UPA que a UBS decidiu não incluir (U12). Acesso só por RPC.';
CREATE INDEX IF NOT EXISTS programa_sugestoes_dispensadas_unidade ON public.programa_sugestoes_dispensadas (unidade_id);
ALTER TABLE public.programa_sugestoes_dispensadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programa_sugestoes_dispensadas FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hiperdia_sugestoes(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.hiperdia_ve(p_unidade) THEN
    RAISE EXCEPTION 'O hiperdia é visto pelo médico, pela enfermagem e pelo gestor da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('contrarreferencia_id', s.id, 'paciente_id', s.paciente_ubs_id,
                                        'nome', s.nome, 'programa', s.programa, 'cid', s.cid,
                                        'unidade_origem', s.origem, 'saida_em', s.saida_em) ORDER BY s.saida_em DESC)
      FROM (
        SELECT c.id, c.paciente_ubs_id, coalesce(nullif(btrim(pa.nome_social), ''), pa.nome) AS nome, prog AS programa,
               c.resumo ->> 'cid' AS cid, uo.nome AS origem, c.saida_em
          FROM public.contrarreferencias c
          JOIN public.pacientes pa ON pa.id = c.paciente_ubs_id AND pa.ativo
          JOIN public.unidades uo ON uo.id = c.unidade_origem_id
          CROSS JOIN LATERAL unnest(private.hiperdia_programas_da_consulta('{}', ARRAY[c.resumo ->> 'cid'], '{}')) prog
         WHERE c.unidade_ubs_id = p_unidade AND c.situacao <> 'cancelada'
           AND c.saida_em >= now() - interval '180 days'
           AND NOT EXISTS (SELECT 1 FROM public.programa_participantes pp
                            WHERE pp.paciente_id = c.paciente_ubs_id AND pp.programa = prog AND pp.saida_em IS NULL)
           AND NOT EXISTS (SELECT 1 FROM public.programa_sugestoes_dispensadas d
                            WHERE d.contrarreferencia_id = c.id AND d.programa = prog)) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.hiperdia_sugestoes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hiperdia_sugestoes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.hiperdia_dispensar_sugestao(p_contrarreferencia uuid, p_programa text, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contrarreferencias; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contrarreferencias WHERE id = p_contrarreferencia;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retorno não encontrado.'; END IF;
  IF NOT (private.tenho_papel(c.unidade_ubs_id, 'plantonista') IS TRUE OR private.tenho_papel(c.unidade_ubs_id, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: decide o médico ou o enfermeiro da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_programa IS NULL OR p_programa NOT IN ('hipertensao', 'diabetes') THEN RAISE EXCEPTION 'Programa: hipertensão ou diabetes.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo de não incluir (mínimo de 5 letras).'; END IF;
  INSERT INTO public.programa_sugestoes_dispensadas (unidade_id, contrarreferencia_id, programa, motivo, dispensado_por)
  VALUES (c.unidade_ubs_id, c.id, p_programa, left(btrim(p_motivo), 300), private.meu_perfil_id())
  ON CONFLICT (contrarreferencia_id, programa) DO NOTHING
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('programa_sugestao_dispensada', 'programa_sugestoes_dispensadas', v_id, c.unidade_ubs_id,
    jsonb_build_object('tipo', p_programa));
END $$;
REVOKE ALL ON FUNCTION public.hiperdia_dispensar_sugestao(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hiperdia_dispensar_sugestao(uuid, text, text) TO authenticated;
