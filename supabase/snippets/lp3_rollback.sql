-- Rollback da migration 20270415000036_ubs_lp3_atendimento_nao_encerrado.sql
-- (limpeza do percurso da UBS, LP3). Tira as três funções novas e volta as duas
-- funções internas como estavam (migrations 20270415000022 e 20270415000021).
-- Os episódios já encerrados como "não concluído" continuam encerrados.
BEGIN;
DROP FUNCTION IF EXISTS public.ubs_atendimentos_nao_encerrados(uuid);
DROP FUNCTION IF EXISTS public.ubs_encerrar_nao_concluido(uuid, text);
DROP FUNCTION IF EXISTS public.atendimento_aberto_info(uuid);

CREATE OR REPLACE FUNCTION private.ledi_fai_cabe(p_episodio uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.episodios e JOIN public.unidades u ON u.id = e.unidade_id AND u.tipo::text = 'ubs'
     WHERE e.id = p_episodio AND e.etapa = 'encerrado'
       AND coalesce(e.desfecho, '') NOT IN ('evasao', 'cancelado')
       AND NOT coalesce((e.desfecho_detalhes ->> 'vencida')::boolean, false))
$function$;

CREATE OR REPLACE FUNCTION private.rnds_rac_fora(p_episodio uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.episodios e JOIN public.unidades u ON u.id = e.unidade_id AND u.tipo::text = 'ubs'
     WHERE e.id = p_episodio
       AND (coalesce((e.desfecho_detalhes ->> 'vencida')::boolean, false)
            OR EXISTS (SELECT 1 FROM public.rnds_config_unidade c WHERE c.unidade_id = e.unidade_id AND c.rac_aps_pelo = 'pec')))
$function$;
COMMIT;
