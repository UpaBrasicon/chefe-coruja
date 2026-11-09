-- ════════════════════════════════════════════════════════════════════════════
-- Item 17 do kit de desempenho (docs/desempenho/AUDITORIA.md; decisão do RT em
-- 09/11/2026: A, agora). Três partes:
--
-- 1. Busca de paciente (buscar_pacientes). Com nome e documento num OR só, o
--    plano não usava índice nenhum: ~600 ms por busca com 50 mil pacientes na
--    unidade (homologação, transação desfeita). Agora um ramo por índice
--    (UNION ALL; a deduplicação do "unicos" já existia) e índices trigram
--    (pg_trgm) nos nomes comparáveis e no prontuário só com dígitos. Medido:
--    nome 610 → 0,3 ms; documento 108 → 0,1 ms. O resultado não muda.
-- 2. As 8 políticas RLS que o advisor aponta (auth_rls_initplan): auth.uid()
--    passa a (SELECT auth.uid()), avaliado uma vez por consulta e não por
--    linha. A regra é a mesma.
-- 3. Índices nas chaves estrangeiras das tabelas que crescem com o uso
--    (paciente, episódio, internação, unidade). Colunas de autoria ("por") e
--    catálogos ficam sem índice de propósito.
--
-- Só cria (expand): extensão, índices e a mesma função reescrita. Nenhuma
-- coluna ou tabela muda. Reaplicável.
-- ROLLBACK: docs/desempenho/ROLLBACK-20270320000002.sql (testado na homolog).
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ── 1. busca de paciente ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS pacientes_nome_trgm ON public.pacientes USING gin (private.nome_comparavel(nome) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS pacientes_nome_social_trgm ON public.pacientes USING gin (private.nome_comparavel(nome_social) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS pacientes_nome_mae_trgm ON public.pacientes USING gin (private.nome_comparavel(nome_mae) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS pacientes_prontuario_digitos ON public.pacientes (unidade_id, private.so_digitos(prontuario));

-- a função só é trocada se estiver igual à da homologação (ou já trocada)
DO $$
DECLARE v text := md5(replace(pg_get_functiondef('public.buscar_pacientes(uuid,text)'::regprocedure), chr(13), ''));
BEGIN
  IF v NOT IN ('b4cb21d012b2fa4b54e473cb1904bb34', 'dc716fef86b4299cb2582d72bb5c7dd1') THEN
    RAISE EXCEPTION 'buscar_pacientes mudou desde a homologação (md5 %): revisar a migration 20270320000002', v;
  END IF;
END $$;

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
    -- item 17 do kit de desempenho: um ramo por índice. Com tudo num OR só, o
    -- plano não usava índice nenhum (600 ms com 50 mil pacientes na unidade).
    SELECT p.id AS pid, false AS via_unificado
      FROM public.pacientes p
     WHERE length(coalesce(v_dig, '')) >= 4 AND p.unidade_id = p_unidade AND p.ativo AND p.cpf = v_dig
    UNION ALL
    SELECT p.id, false FROM public.pacientes p
     WHERE length(coalesce(v_dig, '')) >= 4 AND p.unidade_id = p_unidade AND p.ativo AND p.cns = v_dig
    UNION ALL
    SELECT p.id, false FROM public.pacientes p
     WHERE length(coalesce(v_dig, '')) >= 4 AND p.unidade_id = p_unidade AND p.ativo AND private.so_digitos(p.prontuario) = v_dig
    UNION ALL
    SELECT p.id, false FROM public.pacientes p
     WHERE length(coalesce(v_nome, '')) >= 3 AND p.unidade_id = p_unidade AND p.ativo
       AND private.nome_comparavel(p.nome) LIKE '%' || v_nome || '%'
    UNION ALL
    SELECT p.id, false FROM public.pacientes p
     WHERE length(coalesce(v_nome, '')) >= 3 AND p.unidade_id = p_unidade AND p.ativo
       AND private.nome_comparavel(p.nome_social) LIKE '%' || v_nome || '%'
    UNION ALL
    SELECT p.id, false FROM public.pacientes p
     WHERE length(coalesce(v_nome, '')) >= 3 AND p.unidade_id = p_unidade AND p.ativo
       AND private.nome_comparavel(p.nome_mae) LIKE '%' || v_nome || '%'
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

-- ── 2. políticas RLS: auth.uid() uma vez por consulta ───────────────────────
ALTER POLICY aceites_termo_select ON public.aceites_termo
  USING ((perfil_id = (SELECT auth.uid())) OR private.eh_super_admin());
ALTER POLICY adesoes_contrato_select ON public.adesoes_contrato
  USING ((perfil_id = (SELECT auth.uid())) OR private.eh_super_admin() OR (EXISTS ( SELECT 1
   FROM public.contratos_rede c
  WHERE ((c.id = adesoes_contrato.contrato_id) AND private.eh_admin_da_organizacao(c.organizacao_id)))));
ALTER POLICY clinical_search_feedback_select ON public.clinical_search_feedback
  USING ((user_id = (SELECT auth.uid())) OR private.eh_super_admin() OR (EXISTS ( SELECT 1
   FROM public.clinical_search_logs l
  WHERE ((l.request_id = clinical_search_feedback.request_id) AND (private.tenho_papel(l.unidade_id, 'gestor'::text) OR private.tenho_papel(l.unidade_id, 'admin'::text))))));
ALTER POLICY dispositivos_confiaveis_proprios ON public.dispositivos_confiaveis
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY dispositivos_confiaveis_remover ON public.dispositivos_confiaveis
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY preferencias_aviso_insert ON public.preferencias_aviso
  WITH CHECK (perfil_id = (SELECT auth.uid()));
ALTER POLICY preferencias_aviso_select ON public.preferencias_aviso
  USING (perfil_id = (SELECT auth.uid()));
ALTER POLICY preferencias_aviso_update ON public.preferencias_aviso
  USING (perfil_id = (SELECT auth.uid()))
  WITH CHECK (perfil_id = (SELECT auth.uid()));

-- ── 3. chaves estrangeiras das tabelas que crescem ──────────────────────────
CREATE INDEX IF NOT EXISTS aihs_episodio_id_fk_idx ON public.aihs (episodio_id);
CREATE INDEX IF NOT EXISTS aihs_internacao_id_fk_idx ON public.aihs (internacao_id);
CREATE INDEX IF NOT EXISTS aihs_paciente_id_fk_idx ON public.aihs (paciente_id);
CREATE INDEX IF NOT EXISTS aihs_laudo_id_fk_idx ON public.aihs (laudo_id);
CREATE INDEX IF NOT EXISTS apacs_episodio_id_fk_idx ON public.apacs (episodio_id);
CREATE INDEX IF NOT EXISTS apacs_internacao_id_fk_idx ON public.apacs (internacao_id);
CREATE INDEX IF NOT EXISTS contas_paciente_id_fk_idx ON public.contas (paciente_id);
CREATE INDEX IF NOT EXISTS contas_conta_origem_id_fk_idx ON public.contas (conta_origem_id);
CREATE INDEX IF NOT EXISTS classificacoes_dini_paciente_id_fk_idx ON public.classificacoes_dini (paciente_id);
CREATE INDEX IF NOT EXISTS classificacoes_dini_unidade_id_fk_idx ON public.classificacoes_dini (unidade_id);
CREATE INDEX IF NOT EXISTS classificacoes_fugulin_paciente_id_fk_idx ON public.classificacoes_fugulin (paciente_id);
CREATE INDEX IF NOT EXISTS classificacoes_fugulin_unidade_id_fk_idx ON public.classificacoes_fugulin (unidade_id);
CREATE INDEX IF NOT EXISTS intercorrencias_episodio_id_fk_idx ON public.intercorrencias (episodio_id);
CREATE INDEX IF NOT EXISTS intercorrencias_internacao_id_fk_idx ON public.intercorrencias (internacao_id);
CREATE INDEX IF NOT EXISTS intercorrencias_setor_id_fk_idx ON public.intercorrencias (setor_id);
CREATE INDEX IF NOT EXISTS isolamentos_paciente_episodio_id_fk_idx ON public.isolamentos_paciente (episodio_id);
CREATE INDEX IF NOT EXISTS isolamentos_paciente_internacao_id_fk_idx ON public.isolamentos_paciente (internacao_id);
CREATE INDEX IF NOT EXISTS isolamentos_paciente_unidade_id_fk_idx ON public.isolamentos_paciente (unidade_id);
CREATE INDEX IF NOT EXISTS regulacao_solicitacoes_episodio_id_fk_idx ON public.regulacao_solicitacoes (episodio_id);
CREATE INDEX IF NOT EXISTS regulacao_solicitacoes_internacao_id_fk_idx ON public.regulacao_solicitacoes (internacao_id);
CREATE INDEX IF NOT EXISTS regulacao_solicitacoes_destino_unidade_id_fk_idx ON public.regulacao_solicitacoes (destino_unidade_id);
CREATE INDEX IF NOT EXISTS regulacao_solicitacoes_destino_paciente_id_fk_idx ON public.regulacao_solicitacoes (destino_paciente_id);
CREATE INDEX IF NOT EXISTS regulacao_solicitacoes_destino_episodio_id_fk_idx ON public.regulacao_solicitacoes (destino_episodio_id);
CREATE INDEX IF NOT EXISTS regulacao_solicitacoes_destino_internacao_id_fk_idx ON public.regulacao_solicitacoes (destino_internacao_id);
CREATE INDEX IF NOT EXISTS regulacao_solicitacoes_organizacao_id_fk_idx ON public.regulacao_solicitacoes (organizacao_id);
CREATE INDEX IF NOT EXISTS regulacao_solicitacoes_reserva_id_fk_idx ON public.regulacao_solicitacoes (reserva_id);
CREATE INDEX IF NOT EXISTS reservas_leito_internacao_id_fk_idx ON public.reservas_leito (internacao_id);
CREATE INDEX IF NOT EXISTS reservas_leito_unidade_id_fk_idx ON public.reservas_leito (unidade_id);
CREATE INDEX IF NOT EXISTS episodios_regulacao_id_fk_idx ON public.episodios (regulacao_id);
CREATE INDEX IF NOT EXISTS duplas_checagens_paciente_id_fk_idx ON public.duplas_checagens (paciente_id);
CREATE INDEX IF NOT EXISTS duplas_checagens_unidade_id_fk_idx ON public.duplas_checagens (unidade_id);
CREATE INDEX IF NOT EXISTS procedimentos_realizados_episodio_id_fk_idx ON public.procedimentos_realizados (episodio_id);
CREATE INDEX IF NOT EXISTS agendamentos_episodio_id_fk_idx ON public.agendamentos (episodio_id);
CREATE INDEX IF NOT EXISTS contrarreferencias_paciente_origem_id_fk_idx ON public.contrarreferencias (paciente_origem_id);
CREATE INDEX IF NOT EXISTS contrarreferencias_encaminhamento_upa_id_fk_idx ON public.contrarreferencias (encaminhamento_upa_id);
CREATE INDEX IF NOT EXISTS contrarreferencias_unidade_origem_id_fk_idx ON public.contrarreferencias (unidade_origem_id);
CREATE INDEX IF NOT EXISTS encaminhamentos_upa_episodio_destino_id_fk_idx ON public.encaminhamentos_upa (episodio_destino_id);
CREATE INDEX IF NOT EXISTS dispensacoes_medicamento_id_fk_idx ON public.dispensacoes (medicamento_id);
CREATE INDEX IF NOT EXISTS movimentos_estoque_medicamento_id_fk_idx ON public.movimentos_estoque (medicamento_id);
CREATE INDEX IF NOT EXISTS aprazamentos_unidade_id_fk_idx ON public.aprazamentos (unidade_id);
CREATE INDEX IF NOT EXISTS regulacao_anexos_documento_id_fk_idx ON public.regulacao_anexos (documento_id);
CREATE INDEX IF NOT EXISTS pre_natal_gestacoes_episodio_id_fk_idx ON public.pre_natal_gestacoes (episodio_id);
CREATE INDEX IF NOT EXISTS programa_participantes_episodio_id_fk_idx ON public.programa_participantes (episodio_id);
CREATE INDEX IF NOT EXISTS avaliacoes_pes_episodio_id_fk_idx ON public.avaliacoes_pes (episodio_id);
CREATE INDEX IF NOT EXISTS avaliacoes_pes_unidade_id_fk_idx ON public.avaliacoes_pes (unidade_id);
CREATE INDEX IF NOT EXISTS aih_eventos_unidade_id_fk_idx ON public.aih_eventos (unidade_id);
CREATE INDEX IF NOT EXISTS apac_eventos_unidade_id_fk_idx ON public.apac_eventos (unidade_id);
CREATE INDEX IF NOT EXISTS apac_execucoes_unidade_id_fk_idx ON public.apac_execucoes (unidade_id);
CREATE INDEX IF NOT EXISTS retornos_falta_unidade_id_fk_idx ON public.retornos_falta (unidade_id);
CREATE INDEX IF NOT EXISTS reentradas_contingencia_paciente_id_fk_idx ON public.reentradas_contingencia (paciente_id);
CREATE INDEX IF NOT EXISTS reentradas_contingencia_unidade_id_fk_idx ON public.reentradas_contingencia (unidade_id);
CREATE INDEX IF NOT EXISTS webhook_entregas_unidade_id_fk_idx ON public.webhook_entregas (unidade_id);
