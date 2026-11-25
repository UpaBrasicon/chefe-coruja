-- ════════════════════════════════════════════════════════════════════════════
-- Volta da migration 20270423000010_regulacao_cid_procedimento_e_acesso.sql.
--
-- Tira os dois gatilhos de public.regulacao_solicitacoes (CID × procedimento e
-- aviso do pedido novo), apaga as funções novas e devolve
-- public.regulacao_sla_painel ao corpo da 20270421000012 (o regulador que só tem
-- esse papel na unidade de origem volta a receber "Acesso negado").
--
-- Depois da volta: pedido com CID fora da lista do procedimento volta a
-- entrar; o aviso "Novo pedido de regulação" para de sair (os já enviados
-- ficam em notificacoes_plantonista, como os outros avisos); a tela da AIH
-- volta a ler os internados direto da tabela (só o gestor e a escala veem).
-- A tela segue funcionando: ela cai na busca livre de CID quando
-- regulacao_cids_do_procedimento não existe.
--
-- Idempotente. Testar na homologação em transação desfeita (migration, depois
-- esta volta, depois os testes antigos da regulação; BEGIN … ROLLBACK).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER IF EXISTS trg_regulacao_cid_procedimento ON public.regulacao_solicitacoes;
DROP TRIGGER IF EXISTS trg_regulacao_avisar_novo ON public.regulacao_solicitacoes;
DROP FUNCTION IF EXISTS private.regulacao_conferir_cid_procedimento();
DROP FUNCTION IF EXISTS private.regulacao_avisar_novo();
DROP FUNCTION IF EXISTS public.regulacao_cids_do_procedimento(text, text, text, integer);
DROP FUNCTION IF EXISTS private.regulacao_cid_compativel(text, text);
DROP FUNCTION IF EXISTS public.aih_internados_sem_laudo(uuid);

-- public.regulacao_sla_painel, como na 20270421000012
CREATE OR REPLACE FUNCTION public.regulacao_sla_painel(p_unidade uuid, p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_central boolean;
  v_ref uuid;
  v_so_atrasados boolean := coalesce((f->>'so_atrasados')::boolean, false);
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_central := private.regulacao_eh_central(p_unidade);
  IF v_central THEN
    IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'regulador') OR private.tenho_papel(p_unidade, 'gestor')) THEN
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NOT (private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor') OR private.sou_nir(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_ref := private.regulacao_central_referencia(p_unidade);

  RETURN (
    WITH base AS (
      SELECT s, private.regulacao_sla(s) AS sla
        FROM public.regulacao_solicitacoes s
       WHERE s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino')
         AND ((v_central AND s.central_id = p_unidade) OR (NOT v_central AND s.unidade_origem_id = p_unidade))
    ), filtrada AS (
      SELECT b.* FROM base b
       WHERE (NOT f ? 'tipo' OR (b.s).tipo = f->>'tipo')
         AND (NOT f ? 'prioridade' OR coalesce((b.s).prioridade_regulador, (b.s).prioridade) = f->>'prioridade')
         AND (NOT v_so_atrasados OR (b.sla->>'atrasado_central')::boolean OR (b.sla->>'atrasado_origem')::boolean
              OR (b.sla->>'atrasado_destino')::boolean)
    )
    SELECT jsonb_build_object(
      'central', v_central,
      'dados', coalesce((SELECT jsonb_agg(private.regulacao_json_fila(x.s) ORDER BY
                 CASE WHEN v_central THEN (x.sla->>'atrasado_central')::boolean OR (x.sla->>'atrasado_destino')::boolean
                      ELSE (x.sla->>'atrasado_origem')::boolean END DESC,
                 ((x.sla->>'atrasado_central')::boolean OR (x.sla->>'atrasado_origem')::boolean OR (x.sla->>'atrasado_destino')::boolean) DESC,
                 CASE coalesce((x.s).prioridade_regulador, (x.s).prioridade)
                   WHEN 'emergencia' THEN 1 WHEN 'urgencia' THEN 2 WHEN 'prioritaria' THEN 3 WHEN 'eletiva' THEN 4 ELSE 5 END,
                 (x.s).criada_em)
          FROM (SELECT * FROM filtrada LIMIT 500) x), '[]'::jsonb),
      'resumo', (SELECT jsonb_build_object(
          'abertos', count(*),
          'fila_atrasada', count(*) FILTER (WHERE (b.sla->>'atrasado_central')::boolean),
          'fila_sem_prazo', count(*) FILTER (WHERE b.sla->'fila'->'prazo_min' = 'null'::jsonb),
          'fila_prazo_tipo', count(*) FILTER (WHERE b.sla->'fila'->>'prazo_por' = 'tipo'),
          'pendencia_atrasada', count(*) FILTER (WHERE (b.sla->'pendencia'->>'atrasada')::boolean),
          'evolucao_atrasada', count(*) FILTER (WHERE (b.sla->'evolucao'->>'atrasada')::boolean),
          'risco_cancelamento', count(*) FILTER (WHERE (b.sla->'evolucao'->>'risco_cancelamento')::boolean),
          'destino_atrasado', count(*) FILTER (WHERE (b.sla->>'atrasado_destino')::boolean))
        FROM base b),
      'prazos', private.regulacao_prazos_json(v_ref)
                || jsonb_build_object('por_tipo', CASE WHEN v_ref IS NULL THEN '{}'::jsonb ELSE private.regulacao_prazos_tipo_json(v_ref) END),
      'agora', now()));
END $function$;

COMMIT;
