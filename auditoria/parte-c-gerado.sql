-- =====================================================================
-- CORREÇÕES DA AUDITORIA — PARTE C (Índices, Blocos 8 e 9) — 22/08/2026
-- Gerado a partir do banco real (checagens.json). Sem CONCURRENTLY: a
-- migration da CLI roda em transação e com 121 MB o lock é de ms.
-- =====================================================================

create index if not exists idx_acessos_plantonista_unidade_id on public.acessos_plantonista (unidade_id);
create index if not exists idx_alta_paciente_criado_por on public.alta_paciente (criado_por);
create index if not exists idx_alta_paciente_paciente_id on public.alta_paciente (paciente_id);
create index if not exists idx_assinaturas_medico_id on public.assinaturas (medico_id);
create index if not exists idx_candidaturas_escala_criado_por on public.candidaturas_escala (criado_por);
create index if not exists idx_candidaturas_escala_decidido_por on public.candidaturas_escala (decidido_por);
create index if not exists idx_censo_ocupacao_organizacao_id on public.censo_ocupacao (organizacao_id);
create index if not exists idx_censo_ocupacao_setor_id on public.censo_ocupacao (setor_id);
create index if not exists idx_cerbero_incidentes_tenant_id on public.cerbero_incidentes (tenant_id);
create index if not exists idx_cerbero_quarentena_autor_id on public.cerbero_quarentena (autor_id);
create index if not exists idx_cerbero_quarentena_incidente_id on public.cerbero_quarentena (incidente_id);
create index if not exists idx_cerbero_quarentena_tenant_id on public.cerbero_quarentena (tenant_id);
create index if not exists idx_chat_mensagens_autor_id on public.chat_mensagens (autor_id);
create index if not exists idx_checklist_admissao_atualizado_por on public.checklist_admissao (atualizado_por);
create index if not exists idx_cuidados_plantonistas_unidade_id on public.cuidados_plantonistas (unidade_id);
create index if not exists idx_documentos_clinicos_autor_id on public.documentos_clinicos (autor_id);
create index if not exists idx_documentos_clinicos_organizacao_id on public.documentos_clinicos (organizacao_id);
create index if not exists idx_documentos_clinicos_retificacao_de on public.documentos_clinicos (retificacao_de);
create index if not exists idx_documentos_clinicos_unidade_id on public.documentos_clinicos (unidade_id);
create index if not exists idx_escala_fixa_criado_por on public.escala_fixa (criado_por);
create index if not exists idx_escala_fixa_perfil_id on public.escala_fixa (perfil_id);
create index if not exists idx_escala_fixa_setor_id on public.escala_fixa (setor_id);
create index if not exists idx_escala_plantao_criado_por on public.escala_plantao (criado_por);
create index if not exists idx_escala_plantao_unidade_id on public.escala_plantao (unidade_id);
create index if not exists idx_escala_plantoes_criado_por on public.escala_plantoes (criado_por);
create index if not exists idx_escala_plantoes_setor_id on public.escala_plantoes (setor_id);
create index if not exists idx_escala_plantoes_unidade_id on public.escala_plantoes (unidade_id);
create index if not exists idx_eventos_adt_autor_id on public.eventos_adt (autor_id);
create index if not exists idx_eventos_adt_organizacao_id on public.eventos_adt (organizacao_id);
create index if not exists idx_eventos_leito_autor_id on public.eventos_leito (autor_id);
create index if not exists idx_eventos_leito_internacao_id on public.eventos_leito (internacao_id);
create index if not exists idx_historico_escala_perfil_id on public.historico_escala (perfil_id);
create index if not exists idx_internacoes_leito_atual_id on public.internacoes (leito_atual_id);
create index if not exists idx_internacoes_organizacao_id on public.internacoes (organizacao_id);
create index if not exists idx_interop_outbox_unidade_id on public.interop_outbox (unidade_id);
create index if not exists idx_links_publicos_receita_criado_por on public.links_publicos_receita (criado_por);
create index if not exists idx_links_publicos_receita_prescricao_id on public.links_publicos_receita (prescricao_id);
create index if not exists idx_log_acesso_prontuario_internacao_id on public.log_acesso_prontuario (internacao_id);
create index if not exists idx_log_acesso_prontuario_organizacao_id on public.log_acesso_prontuario (organizacao_id);
create index if not exists idx_log_acesso_prontuario_unidade_id on public.log_acesso_prontuario (unidade_id);
create index if not exists idx_log_auditoria_ator_id on public.log_auditoria (ator_id);
create index if not exists idx_mensagens_chat_criado_por on public.mensagens_chat (criado_por);
create index if not exists idx_mensagens_chat_destinatario_id on public.mensagens_chat (destinatario_id);
create index if not exists idx_mensagens_chat_remetente_id on public.mensagens_chat (remetente_id);
create index if not exists idx_notificacoes_plantonista_unidade_id on public.notificacoes_plantonista (unidade_id);
create index if not exists idx_notificacoes_whatsapp_prescricao_id on public.notificacoes_whatsapp (prescricao_id);
create index if not exists idx_observacao_conceito_id on public.observacao (conceito_id);
create index if not exists idx_observacao_registrado_por on public.observacao (registrado_por);
create index if not exists idx_observacao_unidade_id on public.observacao (unidade_id);
create index if not exists idx_observacao_valor_conceito_id on public.observacao (valor_conceito_id);
create index if not exists idx_prescricao_itens_medicamento_id on public.prescricao_itens (medicamento_id);
create index if not exists idx_prescricoes_criada_por on public.prescricoes (criada_por);
create index if not exists idx_prescricoes_unidade_id on public.prescricoes (unidade_id);
create index if not exists idx_presenca_plantonista_criado_por on public.presenca_plantonista (criado_por);
create index if not exists idx_presenca_plantonista_escala_plantao_id on public.presenca_plantonista (escala_plantao_id);
create index if not exists idx_remuneracoes_plantao_criado_por on public.remuneracoes_plantao (criado_por);
create index if not exists idx_remuneracoes_plantao_setor_id on public.remuneracoes_plantao (setor_id);
create index if not exists idx_solicitacoes_escala_criado_por on public.solicitacoes_escala (criado_por);
create index if not exists idx_solicitacoes_escala_decidido_por on public.solicitacoes_escala (decidido_por);
create index if not exists idx_solicitacoes_escala_destino_perfil_id on public.solicitacoes_escala (destino_perfil_id);
create index if not exists idx_sugestoes_prescricao_decidido_por on public.sugestoes_prescricao (decidido_por);
create index if not exists idx_sugestoes_prescricao_gestor_id on public.sugestoes_prescricao (gestor_id);
create index if not exists idx_sugestoes_prescricao_organizacao_id on public.sugestoes_prescricao (organizacao_id);
create index if not exists idx_sugestoes_prescricao_unidade_id on public.sugestoes_prescricao (unidade_id);
create index if not exists idx_transferencias_paciente_setor_destino_id on public.transferencias_paciente (setor_destino_id);
create index if not exists idx_transferencias_paciente_setor_origem_id on public.transferencias_paciente (setor_origem_id);
create index if not exists idx_transferencias_paciente_transferido_por on public.transferencias_paciente (transferido_por);
create index if not exists idx_trocas_plantao_criado_por on public.trocas_plantao (criado_por);
create index if not exists idx_trocas_plantao_decidido_por on public.trocas_plantao (decidido_por);
create index if not exists idx_trocas_plantao_perfil_b_id on public.trocas_plantao (perfil_b_id);
create index if not exists idx_trocas_plantao_plantao_b_id on public.trocas_plantao (plantao_b_id);
create index if not exists idx_vinculos_criado_por on public.vinculos (criado_por);

-- Compostos para as tabelas quentes (C2)
create index if not exists idx_internacoes_org_status on public.internacoes (organizacao_id, status);
create index if not exists idx_documentos_clinicos_unidade_criado on public.documentos_clinicos (unidade_id, created_at desc);
create index if not exists idx_log_acesso_prontuario_unidade_data on public.log_acesso_prontuario (unidade_id, created_at desc);
create index if not exists idx_censo_ocupacao_org_data on public.censo_ocupacao (organizacao_id, created_at desc);
create index if not exists idx_eventos_adt_unidade_data on public.eventos_adt (unidade_id, created_at desc);
create index if not exists idx_notificacoes_plantonista_unidade on public.notificacoes_plantonista (unidade_id, created_at desc);
create index if not exists idx_interop_outbox_pendentes on public.interop_outbox (created_at) where status in ('pending','pendente','erro','failed');

-- Estatísticas atualizadas
analyze;
