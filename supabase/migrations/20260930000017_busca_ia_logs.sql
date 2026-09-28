-- Busca inteligente da Central (guia produto/docs/pesquisa/busca-ia-guia-implementacao.md, §8).
-- Log das consultas à biblioteca (a pergunta já chega mascarada: CPF, CNS,
-- telefone, data) e feedback do plantonista por resposta.
-- Inserção do log: só a Edge Function clinical-search (service role).
-- Leitura: gestor/admin da unidade, admin da organização e super admin.

CREATE TABLE IF NOT EXISTS public.clinical_search_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     text NOT NULL UNIQUE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  mode           text NOT NULL CHECK (mode IN ('search', 'ask')),
  query_redacted text NOT NULL CHECK (length(query_redacted) <= 800),
  status         int,
  latency_ms     int
);
CREATE INDEX IF NOT EXISTS clinical_search_logs_user_mode_idx ON public.clinical_search_logs (user_id, mode, created_at DESC);
CREATE INDEX IF NOT EXISTS clinical_search_logs_unidade_idx ON public.clinical_search_logs (unidade_id, created_at DESC);

ALTER TABLE public.clinical_search_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinical_search_logs_select" ON public.clinical_search_logs;
CREATE POLICY "clinical_search_logs_select" ON public.clinical_search_logs
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.tenho_papel(unidade_id, 'gestor')
    OR private.tenho_papel(unidade_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.unidades u
               WHERE u.id = clinical_search_logs.unidade_id
                 AND private.eh_admin_da_organizacao(u.organizacao_id))
  );
-- Sem policy de INSERT/UPDATE/DELETE para authenticated: só o service role grava.

CREATE TABLE IF NOT EXISTS public.clinical_search_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  text NOT NULL REFERENCES public.clinical_search_logs(request_id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  util        boolean NOT NULL,
  comentario  text CHECK (length(comentario) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);

ALTER TABLE public.clinical_search_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinical_search_feedback_select" ON public.clinical_search_feedback;
CREATE POLICY "clinical_search_feedback_select" ON public.clinical_search_feedback
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.eh_super_admin()
    OR EXISTS (SELECT 1 FROM public.clinical_search_logs l
               WHERE l.request_id = clinical_search_feedback.request_id
                 AND (private.tenho_papel(l.unidade_id, 'gestor') OR private.tenho_papel(l.unidade_id, 'admin')))
  );
-- Gravação só pela RPC abaixo (confere que a consulta é do próprio usuário).

CREATE OR REPLACE FUNCTION public.registrar_feedback_busca(p_request_id text, p_util boolean, p_comentario text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinical_search_logs l
                 WHERE l.request_id = p_request_id AND l.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Consulta não encontrada para este usuário' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.clinical_search_feedback (request_id, user_id, util, comentario)
  VALUES (p_request_id, auth.uid(), p_util, nullif(trim(coalesce(p_comentario, '')), ''))
  ON CONFLICT (request_id, user_id) DO UPDATE
    SET util = EXCLUDED.util, comentario = EXCLUDED.comentario, created_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.registrar_feedback_busca(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_feedback_busca(text, boolean, text) TO authenticated;

-- Resumo para o gestor: consultas por dia na unidade (sem texto da pergunta).
CREATE OR REPLACE FUNCTION public.resumo_busca_ia(p_unidade uuid, p_dias int DEFAULT 30)
RETURNS TABLE (dia date, consultas bigint, perguntas_ia bigint, uteis bigint, nao_uteis bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.created_at::date AS dia,
         count(*) AS consultas,
         count(*) FILTER (WHERE l.mode = 'ask') AS perguntas_ia,
         count(f.id) FILTER (WHERE f.util) AS uteis,
         count(f.id) FILTER (WHERE NOT f.util) AS nao_uteis
  FROM public.clinical_search_logs l
  LEFT JOIN public.clinical_search_feedback f ON f.request_id = l.request_id
  WHERE l.unidade_id = p_unidade
    AND l.created_at >= now() - make_interval(days => greatest(p_dias, 1))
    AND (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor') OR private.tenho_papel(p_unidade, 'admin'))
  GROUP BY 1 ORDER BY 1 DESC
$$;
REVOKE ALL ON FUNCTION public.resumo_busca_ia(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_busca_ia(uuid, int) TO authenticated;
