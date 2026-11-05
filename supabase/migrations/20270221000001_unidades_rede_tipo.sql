-- ════════════════════════════════════════════════════════════════════════════
-- Pendência da 5A, tarefa 5 (03/11/2026): o "Enviar à UPA" da UBS lista as
-- unidades da rede de regulacao_contexto, que só traz id e nome. As outras UBS
-- aparecem na lista, e encaminhar_upa as recusa ("Escolha uma UPA ou um
-- hospital da rede").
--
-- Expand: cada item de unidades_rede ganha o campo 'tipo' (ubs, upa, hospital,
-- clinica). Nada sai e nada muda de nome; as telas que não leem o campo seguem
-- iguais. Assinatura, SECURITY DEFINER, search_path e grants ficam os mesmos.
--
-- Idempotente (CREATE OR REPLACE).
-- Teste: supabase/tests/5a_unidades_rede_tipo.sql.
--
-- Rollback: recriar public.regulacao_contexto sem o campo 'tipo' (a versão
-- anterior tem md5 do corpo 19486e53272a2cc1b3e92231b86a457e).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.regulacao_contexto(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE c public.centrais_regulacao;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT cr.* INTO c FROM public.centrais_regulacao cr JOIN public.unidades u ON u.organizacao_id = cr.organizacao_id
   WHERE u.id = p_unidade;
  RETURN jsonb_build_object(
    'central', CASE WHEN c.unidade_id IS NULL THEN NULL
                    ELSE (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = c.unidade_id) END,
    'sou_central', c.unidade_id = p_unidade,
    'pode_solicitar', private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor') OR private.sou_nir(p_unidade),
    'sou_nir', private.sou_nir(p_unidade),
    'sou_regulador', c.unidade_id IS NOT NULL AND private.tenho_papel(c.unidade_id, 'regulador'),
    'sou_super_admin', private.eh_super_admin(),
    -- unidades da rede, para o destino
    'unidades_rede', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'tipo', u.tipo) ORDER BY u.nome)
                       FROM public.unidades u
                      WHERE u.ativo AND u.organizacao_id = (SELECT organizacao_id FROM public.unidades WHERE id = p_unidade)
                        AND u.id IS DISTINCT FROM c.unidade_id), '[]'::jsonb));
END $$;
