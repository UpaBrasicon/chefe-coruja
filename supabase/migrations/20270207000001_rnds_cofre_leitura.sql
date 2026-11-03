-- ════════════════════════════════════════════════════════════════════════════
-- Fase 5C, tarefa 5, etapa 5.4b: o serviço lê o certificado que acabou de chegar.
--
-- O certificado enviado pelo gestor fica 'aguardando' até o serviço no VPS abri-lo.
-- Sem esta função, o serviço só o abriria ao enviar um documento da unidade, e a
-- unidade com o envio desligado nunca saberia se o certificado presta.
-- public.rnds_certificados_aguardando(limite) devolve os aguardando, os mais antigos
-- primeiro, só para a chave de serviço.
--
-- Só acrescenta (expand). Idempotente.
-- Rollback:
--   DROP FUNCTION IF EXISTS public.rnds_certificados_aguardando(integer);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rnds_certificados_aguardando(p_limite integer DEFAULT 10)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('credencial_id', k.id, 'certificado_cifrado', k.certificado_cifrado)
                            ORDER BY k.certificado_enviado_em), '[]'::jsonb)
    FROM (SELECT id, certificado_cifrado, certificado_enviado_em
            FROM public.rnds_credenciais
           WHERE certificado_situacao = 'aguardando' AND certificado_cifrado IS NOT NULL
           ORDER BY certificado_enviado_em
           LIMIT least(greatest(coalesce(p_limite, 10), 1), 50)) k
$$;

REVOKE ALL ON FUNCTION public.rnds_certificados_aguardando(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rnds_certificados_aguardando(integer) TO service_role;
