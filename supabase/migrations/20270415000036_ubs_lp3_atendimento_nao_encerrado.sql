-- ════════════════════════════════════════════════════════════════════════════
-- Limpeza do percurso da UBS, LP3 = A (RT, 23/11/2026): ficha "em atendimento"
-- de dias anteriores. Diagnóstico em docs/ubs/LIMPEZA-PERCURSO-DIAGNOSTICO.md.
--
-- Ninguém fecha sozinho (autor = login):
-- 1. public.ubs_atendimentos_nao_encerrados(unidade): para o gestor da UBS, as
--    fichas em atendimento iniciado antes de hoje, com quem abriu e quando;
-- 2. public.ubs_encerrar_nao_concluido(episodio, motivo): o gestor encerra com
--    motivo (mínimo de 10 letras), pelo login dele e com auditoria. O episódio
--    fica com desfecho_detalhes.nao_concluido = true;
-- 3. o encerramento não concluído não vai ao SISAB (private.ledi_fai_cabe) nem
--    à RNDS (private.rnds_rac_fora), e não conta na produção (o gestor_ubs já
--    só conta quem atendeu: médico ou enfermeiro);
-- 4. public.atendimento_aberto_info(paciente): para a recepção, de quando é o
--    atendimento aberto e com quem, com a mesma regra de acesso da
--    atendimento_aberto_do_paciente.
--
-- Expand: funções novas e duas funções internas com uma condição a mais.
-- Reaplicável: CREATE OR REPLACE.
--
-- Rollback (testado na homologação):
--   DROP FUNCTION IF EXISTS public.ubs_atendimentos_nao_encerrados(uuid);
--   DROP FUNCTION IF EXISTS public.ubs_encerrar_nao_concluido(uuid, text);
--   DROP FUNCTION IF EXISTS public.atendimento_aberto_info(uuid);
--   e recriar private.ledi_fai_cabe e private.rnds_rac_fora sem a linha
--   'nao_concluido' (definições das migrations 20270415000022 e 20270415000021).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 3. fora do SISAB e da RNDS ──────────────────────────────────────────────
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
       AND NOT coalesce((e.desfecho_detalhes ->> 'vencida')::boolean, false)
       AND NOT coalesce((e.desfecho_detalhes ->> 'nao_concluido')::boolean, false))  -- LP3
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
            OR coalesce((e.desfecho_detalhes ->> 'nao_concluido')::boolean, false)  -- LP3
            OR EXISTS (SELECT 1 FROM public.rnds_config_unidade c WHERE c.unidade_id = e.unidade_id AND c.rac_aps_pelo = 'pec')))
$function$;

-- ── 1. a lista do gestor ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ubs_atendimentos_nao_encerrados(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (coalesce(private.eh_super_admin(), false) OR private.tenho_papel(p_unidade, 'gestor') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'episodio_id', e.id, 'paciente_id', e.paciente_id, 'nome', p.nome, 'nome_social', p.nome_social,
             'chegada_em', e.chegada_em, 'iniciado_em', e.atendimento_iniciado_em,
             'quem_abriu', pf.nome_completo, 'setor', s.nome)
           ORDER BY e.atendimento_iniciado_em)
      FROM public.episodios e
      JOIN public.pacientes p ON p.id = e.paciente_id
      JOIN public.setores s ON s.id = e.setor_id
      LEFT JOIN public.perfis pf ON pf.id = e.atendimento_medico_id
     WHERE e.unidade_id = p_unidade AND e.tipo_atendimento_aps IS NOT NULL AND e.etapa = 'atendimento'
       AND e.atendimento_iniciado_em IS NOT NULL
       AND (e.atendimento_iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date < private.data_atual()), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.ubs_atendimentos_nao_encerrados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubs_atendimentos_nao_encerrados(uuid) TO authenticated;

-- ── 2. o gestor encerra com motivo ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ubs_encerrar_nao_concluido(p_episodio uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_eu uuid := private.meu_perfil_id();
  v_motivo text := nullif(btrim(p_motivo), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF NOT (coalesce(private.eh_super_admin(), false) OR private.tenho_papel(e.unidade_id, 'gestor') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade encerra.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'Só para a ficha da UBS.'; END IF;
  IF e.etapa <> 'atendimento' OR e.atendimento_iniciado_em IS NULL THEN
    RAISE EXCEPTION 'Esta ficha não está em atendimento.';
  END IF;
  IF (e.atendimento_iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date >= private.data_atual() THEN
    RAISE EXCEPTION 'O atendimento é de hoje: quem atende encerra pela conduta.';
  END IF;
  IF length(coalesce(v_motivo, '')) < 10 THEN
    RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).';
  END IF;

  UPDATE public.episodios
     SET etapa = 'encerrado', encerrado_em = now(), encerrado_por = v_eu,
         desfecho_em = now(), desfecho_por = v_eu,
         desfecho_motivo = 'Atendimento não concluído: ' || v_motivo,
         desfecho_detalhes = coalesce(e.desfecho_detalhes, '{}'::jsonb) || jsonb_build_object(
           'nao_concluido', true, 'encerrado_pelo_gestor', true,
           'iniciado_em', e.atendimento_iniciado_em, 'quem_abriu', e.atendimento_medico_id),
         updated_at = now()
   WHERE id = e.id;

  PERFORM private.registrar_auditoria('atendimento_nao_concluido_encerrado', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('iniciado_em', e.atendimento_iniciado_em, 'quem_abriu', e.atendimento_medico_id));
END $$;
REVOKE ALL ON FUNCTION public.ubs_encerrar_nao_concluido(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubs_encerrar_nao_concluido(uuid, text) TO authenticated;

-- ── 4. a recepção vê de quando e com quem ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.atendimento_aberto_info(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR (private.eh_super_admin() OR private.papel_na_unidade(v_unidade) = 'gestor'
      OR private.na_escala_agora(v_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: só para quem está de plantão na unidade.';
  END IF;
  RETURN (
    SELECT jsonb_build_object('episodio_id', e.id, 'iniciado_em', e.atendimento_iniciado_em,
             'quem_abriu', pf.nome_completo, 'ubs', e.tipo_atendimento_aps IS NOT NULL)
      FROM public.episodios e LEFT JOIN public.perfis pf ON pf.id = e.atendimento_medico_id
     WHERE e.paciente_id = p_paciente AND e.etapa <> 'encerrado'
     LIMIT 1);
END $$;
REVOKE ALL ON FUNCTION public.atendimento_aberto_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atendimento_aberto_info(uuid) TO authenticated;
