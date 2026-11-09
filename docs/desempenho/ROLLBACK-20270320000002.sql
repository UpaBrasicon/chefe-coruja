-- Rollback da migration 20270320000002 (item 17 do kit de desempenho).
-- Volta a busca de paciente, as políticas e tira os índices. A extensão
-- pg_trgm fica (outros podem usar); para tirar: DROP EXTENSION pg_trgm.
BEGIN;
CREATE OR REPLACE FUNCTION public.buscar_pacientes(p_unidade uuid, p_termo text)
 RETURNS TABLE(id uuid, nome text, nome_social text, data_nascimento date, nome_mae text, cpf_final text, cns_final text, prontuario text, episodio_etapa text, documento_unificado boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_dig text := private.so_digitos(p_termo);
  v_nome text := private.nome_comparavel(p_termo);
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor'
      OR private.na_escala_agora(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: busca só para quem está de plantão na unidade.';
  END IF;
  IF length(coalesce(v_nome, '')) < 3 AND length(coalesce(v_dig, '')) < 4 THEN
    RAISE EXCEPTION 'Digite ao menos 3 letras do nome ou 4 números do documento.';
  END IF;

  RETURN QUERY
  WITH achados AS (
    SELECT p.id AS pid, false AS via_unificado
      FROM public.pacientes p
     WHERE p.unidade_id = p_unidade AND p.ativo
       AND (   (v_dig IS NOT NULL AND length(v_dig) >= 4 AND (p.cpf = v_dig OR p.cns = v_dig OR private.so_digitos(p.prontuario) = v_dig))
            OR (length(coalesce(v_nome, '')) >= 3 AND (private.nome_comparavel(p.nome) LIKE '%' || v_nome || '%'
                                                        OR private.nome_comparavel(p.nome_social) LIKE '%' || v_nome || '%'
                                                        OR private.nome_comparavel(p.nome_mae) LIKE '%' || v_nome || '%')))
    UNION ALL
    -- documento que ficou no cadastro absorvido (inativo): leva ao principal
    SELECT private.paciente_principal(p.id), true
      FROM public.pacientes p
     WHERE p.unidade_id = p_unidade AND NOT p.ativo AND p.unificado_em IS NOT NULL
       AND v_dig IS NOT NULL AND length(v_dig) >= 4 AND (p.cpf = v_dig OR p.cns = v_dig)
  ), unicos AS (
    SELECT x.pid, bool_and(x.via_unificado) AS via_unificado FROM achados x GROUP BY x.pid
  )
  SELECT p.id, p.nome, p.nome_social, p.data_nascimento, p.nome_mae,
         private.mascarar(p.cpf), private.mascarar(p.cns), p.prontuario,
         (SELECT e.etapa FROM public.episodios e WHERE e.paciente_id = p.id AND e.etapa <> 'encerrado'),
         u.via_unificado
  FROM unicos u JOIN public.pacientes p ON p.id = u.pid AND p.ativo
  ORDER BY p.nome
  LIMIT 20;
END $function$;

ALTER POLICY aceites_termo_select ON public.aceites_termo
  USING ((perfil_id = auth.uid()) OR private.eh_super_admin());
ALTER POLICY adesoes_contrato_select ON public.adesoes_contrato
  USING ((perfil_id = auth.uid()) OR private.eh_super_admin() OR (EXISTS ( SELECT 1
   FROM contratos_rede c
  WHERE ((c.id = adesoes_contrato.contrato_id) AND private.eh_admin_da_organizacao(c.organizacao_id)))));
ALTER POLICY clinical_search_feedback_select ON public.clinical_search_feedback
  USING ((user_id = auth.uid()) OR private.eh_super_admin() OR (EXISTS ( SELECT 1
   FROM clinical_search_logs l
  WHERE ((l.request_id = clinical_search_feedback.request_id) AND (private.tenho_papel(l.unidade_id, 'gestor'::text) OR private.tenho_papel(l.unidade_id, 'admin'::text))))));
ALTER POLICY dispositivos_confiaveis_proprios ON public.dispositivos_confiaveis
  USING (user_id = auth.uid());
ALTER POLICY dispositivos_confiaveis_remover ON public.dispositivos_confiaveis
  USING (user_id = auth.uid());
ALTER POLICY preferencias_aviso_insert ON public.preferencias_aviso
  WITH CHECK (perfil_id = auth.uid());
ALTER POLICY preferencias_aviso_select ON public.preferencias_aviso
  USING (perfil_id = auth.uid());
ALTER POLICY preferencias_aviso_update ON public.preferencias_aviso
  USING (perfil_id = auth.uid())
  WITH CHECK (perfil_id = auth.uid());

DROP INDEX IF EXISTS public.pacientes_nome_trgm;
DROP INDEX IF EXISTS public.pacientes_nome_social_trgm;
DROP INDEX IF EXISTS public.pacientes_nome_mae_trgm;
DROP INDEX IF EXISTS public.pacientes_prontuario_digitos;
DROP INDEX IF EXISTS public.aihs_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.aihs_internacao_id_fk_idx;
DROP INDEX IF EXISTS public.aihs_paciente_id_fk_idx;
DROP INDEX IF EXISTS public.aihs_laudo_id_fk_idx;
DROP INDEX IF EXISTS public.apacs_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.apacs_internacao_id_fk_idx;
DROP INDEX IF EXISTS public.contas_paciente_id_fk_idx;
DROP INDEX IF EXISTS public.contas_conta_origem_id_fk_idx;
DROP INDEX IF EXISTS public.classificacoes_dini_paciente_id_fk_idx;
DROP INDEX IF EXISTS public.classificacoes_dini_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.classificacoes_fugulin_paciente_id_fk_idx;
DROP INDEX IF EXISTS public.classificacoes_fugulin_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.intercorrencias_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.intercorrencias_internacao_id_fk_idx;
DROP INDEX IF EXISTS public.intercorrencias_setor_id_fk_idx;
DROP INDEX IF EXISTS public.isolamentos_paciente_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.isolamentos_paciente_internacao_id_fk_idx;
DROP INDEX IF EXISTS public.isolamentos_paciente_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.regulacao_solicitacoes_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.regulacao_solicitacoes_internacao_id_fk_idx;
DROP INDEX IF EXISTS public.regulacao_solicitacoes_destino_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.regulacao_solicitacoes_destino_paciente_id_fk_idx;
DROP INDEX IF EXISTS public.regulacao_solicitacoes_destino_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.regulacao_solicitacoes_destino_internacao_id_fk_idx;
DROP INDEX IF EXISTS public.regulacao_solicitacoes_organizacao_id_fk_idx;
DROP INDEX IF EXISTS public.regulacao_solicitacoes_reserva_id_fk_idx;
DROP INDEX IF EXISTS public.reservas_leito_internacao_id_fk_idx;
DROP INDEX IF EXISTS public.reservas_leito_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.episodios_regulacao_id_fk_idx;
DROP INDEX IF EXISTS public.duplas_checagens_paciente_id_fk_idx;
DROP INDEX IF EXISTS public.duplas_checagens_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.procedimentos_realizados_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.agendamentos_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.contrarreferencias_paciente_origem_id_fk_idx;
DROP INDEX IF EXISTS public.contrarreferencias_encaminhamento_upa_id_fk_idx;
DROP INDEX IF EXISTS public.contrarreferencias_unidade_origem_id_fk_idx;
DROP INDEX IF EXISTS public.encaminhamentos_upa_episodio_destino_id_fk_idx;
DROP INDEX IF EXISTS public.dispensacoes_medicamento_id_fk_idx;
DROP INDEX IF EXISTS public.movimentos_estoque_medicamento_id_fk_idx;
DROP INDEX IF EXISTS public.aprazamentos_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.regulacao_anexos_documento_id_fk_idx;
DROP INDEX IF EXISTS public.pre_natal_gestacoes_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.programa_participantes_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.avaliacoes_pes_episodio_id_fk_idx;
DROP INDEX IF EXISTS public.avaliacoes_pes_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.aih_eventos_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.apac_eventos_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.apac_execucoes_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.retornos_falta_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.reentradas_contingencia_paciente_id_fk_idx;
DROP INDEX IF EXISTS public.reentradas_contingencia_unidade_id_fk_idx;
DROP INDEX IF EXISTS public.webhook_entregas_unidade_id_fk_idx;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270320000002';
COMMIT;
