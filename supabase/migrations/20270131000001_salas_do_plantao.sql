-- Consultório do plantão na fila do PS (P2 "fila do PS com dados novos", decisão do RT em
-- 27/10/2026: a fila fica como está hoje; só o consultório deixa de ser escolhido a cada
-- chamada). O plantonista escolhe o consultório uma vez no plantão, na barra no topo da
-- fila; vale até o fim daquele plantão e não depende do aparelho. No plantão seguinte, a
-- escolha começa vazia.
--
-- Rollback: DROP FUNCTION IF EXISTS public.definir_sala_do_plantao(uuid, uuid);
--           DROP FUNCTION IF EXISTS public.minhas_salas_do_plantao();
--           DROP TABLE IF EXISTS public.salas_do_plantao;

CREATE TABLE IF NOT EXISTS public.salas_do_plantao (
  escala_plantao_id uuid PRIMARY KEY REFERENCES public.escala_plantao(id) ON DELETE CASCADE,
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  perfil_id         uuid NOT NULL REFERENCES public.perfis(id),
  setor_id          uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  sala_id           uuid NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  definida_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS salas_do_plantao_perfil ON public.salas_do_plantao (perfil_id);
CREATE INDEX IF NOT EXISTS salas_do_plantao_unidade ON public.salas_do_plantao (unidade_id);
CREATE INDEX IF NOT EXISTS salas_do_plantao_setor ON public.salas_do_plantao (setor_id);
CREATE INDEX IF NOT EXISTS salas_do_plantao_sala ON public.salas_do_plantao (sala_id);

-- só pelas funções abaixo; a leitura direta fica com o próprio plantonista
ALTER TABLE public.salas_do_plantao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS salas_do_plantao_leitura ON public.salas_do_plantao;
CREATE POLICY salas_do_plantao_leitura ON public.salas_do_plantao FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id());
REVOKE ALL ON public.salas_do_plantao FROM anon, authenticated;
GRANT SELECT ON public.salas_do_plantao TO authenticated;

-- O consultório de cada setor em que estou de plantão agora: {setor_id: sala_id}
CREATE OR REPLACE FUNCTION public.minhas_salas_do_plantao()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce(jsonb_object_agg(x.setor_id, x.sala_id), '{}'::jsonb)
    FROM (
      SELECT DISTINCT ON (p.setor_id) p.setor_id, s.sala_id
        FROM private.plantoes_agora() p
        JOIN public.salas_do_plantao s ON s.escala_plantao_id = p.id
       WHERE p.perfil_id = private.meu_perfil_id()
       ORDER BY p.setor_id, p.inicio DESC) x;
$function$;

-- Escolher o consultório do plantão de agora neste setor (sala de atendimento do setor, ativa)
CREATE OR REPLACE FUNCTION public.definir_sala_do_plantao(p_setor uuid, p_sala uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_plantao public.escala_plantao;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT p.* INTO v_plantao
    FROM private.plantoes_agora() p
   WHERE p.perfil_id = v_eu AND p.setor_id = p_setor
   ORDER BY p.inicio DESC LIMIT 1;
  IF v_plantao.id IS NULL THEN
    RAISE EXCEPTION 'Você não está de plantão nesta porta agora.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.salas s
                  WHERE s.id = p_sala AND s.setor_id = p_setor AND s.ativo AND s.tipo <> 'triagem') THEN
    RAISE EXCEPTION 'Escolha um consultório desta porta.';
  END IF;
  INSERT INTO public.salas_do_plantao (escala_plantao_id, unidade_id, perfil_id, setor_id, sala_id)
  VALUES (v_plantao.id, v_plantao.unidade_id, v_eu, p_setor, p_sala)
  ON CONFLICT (escala_plantao_id) DO UPDATE SET sala_id = EXCLUDED.sala_id, definida_em = now()
  WHERE public.salas_do_plantao.sala_id IS DISTINCT FROM EXCLUDED.sala_id;
  RETURN public.minhas_salas_do_plantao();
END $function$;

REVOKE ALL ON FUNCTION public.minhas_salas_do_plantao(), public.definir_sala_do_plantao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_salas_do_plantao(), public.definir_sala_do_plantao(uuid, uuid) TO authenticated;

COMMENT ON TABLE public.salas_do_plantao IS
  'Consultório escolhido pelo plantonista para o plantão (fila do PS): vale até o fim daquele plantão.';
