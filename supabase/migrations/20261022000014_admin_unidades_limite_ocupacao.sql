-- Auditoria do frontend (03/10/2026), defeito 7: o limite de ocupação já é
-- configurável por unidade (Unidade › Configurações, chave ocupacao_limite_pct,
-- padrão 85%), mas a lista de unidades do administrador pintava a barra com 85%
-- fixo. admin_unidades passa a devolver o limite de cada unidade.
-- A assinatura de retorno muda, então a função é recriada.

DROP FUNCTION IF EXISTS public.admin_unidades();

CREATE OR REPLACE FUNCTION public.admin_unidades()
RETURNS TABLE (unidade_id uuid, nome text, tipo text, municipio text, uf text,
               leitos bigint, leitos_ocupados bigint, taxa_ocupacao numeric, em_plantao bigint,
               sessoes_ativas bigint, ultimo_uso timestamptz,
               chamados_abertos bigint, chamados_alta bigint,
               rnds_pendentes bigint, rnds_erro bigint, rnds_mais_antigo timestamptz,
               ocupacao_limite_pct integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR EXISTS (SELECT 1 FROM private.orgs_admin())) THEN
    RAISE EXCEPTION 'Acesso negado: tela do administrador.';
  END IF;
  RETURN QUERY
  WITH u AS (
    SELECT un.id, un.nome, un.tipo::text AS tipo, un.municipio, un.uf FROM public.unidades un
     WHERE un.ativo AND (private.eh_super_admin() OR un.id IN (SELECT private.unidades_admin()))
  ), s AS (
    SELECT v.unidade_id,
           count(DISTINCT se.user_id) FILTER (WHERE coalesce(se.refreshed_at AT TIME ZONE 'UTC', se.updated_at, se.created_at) > private.sessao_em_uso_desde()) AS ativas,
           max(coalesce(se.refreshed_at AT TIME ZONE 'UTC', se.updated_at, se.created_at)) AS ultimo
      FROM public.vinculos v
      JOIN auth.sessions se ON se.user_id = v.perfil_id AND (se.not_after IS NULL OR se.not_after > now())
     WHERE v.ativo AND v.unidade_id IN (SELECT id FROM u)
     GROUP BY v.unidade_id
  ), c AS (
    SELECT u.id, u.nome, u.tipo, u.municipio, u.uf,
      (SELECT count(*) FROM public.leitos l JOIN public.setores st ON st.id = l.setor_id WHERE st.unidade_id = u.id AND st.ativo AND l.ativo) AS leitos,
      (SELECT count(*) FROM public.leitos l JOIN public.setores st ON st.id = l.setor_id WHERE st.unidade_id = u.id AND st.ativo AND l.ativo AND l.status = 'ocupado') AS ocupados,
      (SELECT count(DISTINCT pp.perfil_id) FROM public.presenca_plantonista pp WHERE pp.unidade_id = u.id AND pp.checkin_em > now() - interval '36 hours'
          AND pp.checkin_em IS NOT NULL AND pp.checkout_em IS NULL) AS plantao,
      (SELECT count(*) FROM public.chamados_tecnicos ch WHERE ch.unidade_id = u.id AND ch.situacao <> 'resolvido') AS abertos,
      (SELECT count(*) FROM public.chamados_tecnicos ch WHERE ch.unidade_id = u.id AND ch.situacao <> 'resolvido' AND ch.severidade = 'alta') AS alta,
      (SELECT count(*) FROM public.interop_outbox o WHERE o.unidade_id = u.id AND o.status = 'pendente') AS pend,
      (SELECT count(*) FROM public.interop_outbox o WHERE o.unidade_id = u.id AND o.status = 'erro') AS erro,
      (SELECT min(o.created_at) FROM public.interop_outbox o WHERE o.unidade_id = u.id AND o.status IN ('pendente', 'erro')) AS antigo
    FROM u
  )
  SELECT c.id, c.nome, c.tipo, c.municipio, c.uf,
         private.suprimir(c.leitos), private.suprimir(c.ocupados),
         CASE WHEN private.suprimir(c.leitos) IS NOT NULL AND private.suprimir(c.ocupados) IS NOT NULL AND c.leitos > 0
              THEN round(100.0 * c.ocupados / c.leitos, 1) END,
         c.plantao,  -- profissionais: sem supressão
         coalesce(s.ativas, 0), s.ultimo,
         c.abertos, c.alta, c.pend, c.erro, c.antigo,
         (private.limites_unidade(c.id) ->> 'ocupacao_pct')::int
    FROM c LEFT JOIN s ON s.unidade_id = c.id
   ORDER BY c.nome;
END $$;
REVOKE ALL ON FUNCTION public.admin_unidades() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unidades() TO authenticated;
