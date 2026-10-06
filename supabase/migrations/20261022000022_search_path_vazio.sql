-- ════════════════════════════════════════════════════════════════════════════
-- Fase 0, tarefa 5 do BACKLOG.md: `SET search_path = ''` em toda função
-- SECURITY DEFINER.
--
-- Estado antes (catálogo do banco montado pelas migrations, 05/10/2026):
-- nenhuma função SECURITY DEFINER estava SEM search_path, mas 27 usavam um
-- caminho não vazio: 12 com `public, private, pg_temp` (pg_temp por último:
-- sem o risco de sombra) e 15 só com `public` — nessas o Postgres procura
-- PRIMEIRO em pg_temp, e uma tabela temporária de mesmo nome poderia ser lida
-- no lugar da real dentro de uma função que roda com privilégio de dono.
--
-- Os corpos das 27 já qualificam todo objeto do banco (conferido por script
-- contra o catálogo: tabelas, views, funções e tipos de public/private/
-- terminologia; nenhuma usa função de extensão). Então basta fixar o caminho
-- vazio: funções embutidas (pg_catalog) continuam visíveis.
--
-- Não destrutiva e idempotente (só ALTER ... SET). Evidência depois de
-- aplicar: a consulta do fim do arquivo devolve 0.
--
-- ROLLBACK (reaplicar o caminho anterior de cada função):
-- ALTER FUNCTION private.aplicar_troca(p_troca trocas_plantao) SET search_path = public;
-- ALTER FUNCTION private.enfileirar_documento(p_unidade_id uuid, p_tipo text, p_referencia_id uuid, p_payload jsonb) SET search_path = public, private, pg_temp;
-- ALTER FUNCTION private.enfileirar_na_alta() SET search_path = public, private, pg_temp;
-- ALTER FUNCTION private.enfileirar_rac() SET search_path = public, private, pg_temp;
-- ALTER FUNCTION private.fn_censo_unidade() SET search_path = public, private, pg_temp;
-- ALTER FUNCTION private.fn_indicadores_unidade() SET search_path = public, private, pg_temp;
-- ALTER FUNCTION private.gerar_censo_diario(p_unidade uuid, p_data date) SET search_path = public;
-- ALTER FUNCTION private.notificar_vaga() SET search_path = public;
-- ALTER FUNCTION private.registrar_historico(p_unidade uuid, p_plantao uuid, p_acao text, p_detalhe text, p_dados jsonb) SET search_path = public;
-- ALTER FUNCTION private.registrar_historico_escala() SET search_path = public;
-- ALTER FUNCTION private.tem_conflito_plantao(p_perfil uuid, p_unidade uuid, p_setor uuid, p_data date, p_turno text, p_ignorar uuid) SET search_path = public;
-- ALTER FUNCTION private.valor_plantao(p_unidade uuid, p_setor uuid, p_turno text) SET search_path = public;
-- ALTER FUNCTION public.abrir_conversa_direta(p_destinatario_id uuid) SET search_path = public, private, pg_temp;
-- ALTER FUNCTION public.abrir_conversa_suporte() SET search_path = public, private, pg_temp;
-- ALTER FUNCTION public.aprovar_troca(p_troca uuid) SET search_path = public;
-- ALTER FUNCTION public.diluicao_publicada(p_medicamento uuid) SET search_path = public;
-- ALTER FUNCTION public.diluicoes_rascunho() SET search_path = public;
-- ALTER FUNCTION public.editar_mensagem(p_mensagem_id uuid, p_corpo text) SET search_path = public, private, pg_temp;
-- ALTER FUNCTION public.enviar_mensagem(p_conversa_id uuid, p_corpo text) SET search_path = public, private, pg_temp;
-- ALTER FUNCTION public.excluir_mensagem(p_mensagem_id uuid) SET search_path = public, private, pg_temp;
-- ALTER FUNCTION public.gerar_extrato_plantonista(p_unidade uuid, p_inicio date, p_fim date) SET search_path = public;
-- ALTER FUNCTION public.listar_conversas() SET search_path = public, private, pg_temp;
-- ALTER FUNCTION public.marcar_lida(p_conversa_id uuid) SET search_path = public, private, pg_temp;
-- ALTER FUNCTION public.marcar_notificacao_lida(p_id uuid) SET search_path = public;
-- ALTER FUNCTION public.publicar_diluicao(p_diluicao uuid, p_revisor_crf text, p_data_revisao date) SET search_path = public;
-- ALTER FUNCTION public.recusar_troca(p_troca uuid, p_motivo text) SET search_path = public;
-- ALTER FUNCTION public.solicitar_troca(p_plantao_a uuid, p_plantao_b uuid, p_mensagem text) SET search_path = public;

-- ════════════════════════════════════════════════════════════════════════════

ALTER FUNCTION private.aplicar_troca(p_troca trocas_plantao) SET search_path = '';
ALTER FUNCTION private.enfileirar_documento(p_unidade_id uuid, p_tipo text, p_referencia_id uuid, p_payload jsonb) SET search_path = '';
ALTER FUNCTION private.enfileirar_na_alta() SET search_path = '';
ALTER FUNCTION private.enfileirar_rac() SET search_path = '';
ALTER FUNCTION private.fn_censo_unidade() SET search_path = '';
ALTER FUNCTION private.fn_indicadores_unidade() SET search_path = '';
ALTER FUNCTION private.gerar_censo_diario(p_unidade uuid, p_data date) SET search_path = '';
ALTER FUNCTION private.notificar_vaga() SET search_path = '';
ALTER FUNCTION private.registrar_historico(p_unidade uuid, p_plantao uuid, p_acao text, p_detalhe text, p_dados jsonb) SET search_path = '';
ALTER FUNCTION private.registrar_historico_escala() SET search_path = '';
ALTER FUNCTION private.tem_conflito_plantao(p_perfil uuid, p_unidade uuid, p_setor uuid, p_data date, p_turno text, p_ignorar uuid) SET search_path = '';
ALTER FUNCTION private.valor_plantao(p_unidade uuid, p_setor uuid, p_turno text) SET search_path = '';
ALTER FUNCTION public.abrir_conversa_direta(p_destinatario_id uuid) SET search_path = '';
ALTER FUNCTION public.abrir_conversa_suporte() SET search_path = '';
ALTER FUNCTION public.aprovar_troca(p_troca uuid) SET search_path = '';
ALTER FUNCTION public.diluicao_publicada(p_medicamento uuid) SET search_path = '';
ALTER FUNCTION public.diluicoes_rascunho() SET search_path = '';
ALTER FUNCTION public.editar_mensagem(p_mensagem_id uuid, p_corpo text) SET search_path = '';
ALTER FUNCTION public.enviar_mensagem(p_conversa_id uuid, p_corpo text) SET search_path = '';
ALTER FUNCTION public.excluir_mensagem(p_mensagem_id uuid) SET search_path = '';
ALTER FUNCTION public.gerar_extrato_plantonista(p_unidade uuid, p_inicio date, p_fim date) SET search_path = '';
ALTER FUNCTION public.listar_conversas() SET search_path = '';
ALTER FUNCTION public.marcar_lida(p_conversa_id uuid) SET search_path = '';
ALTER FUNCTION public.marcar_notificacao_lida(p_id uuid) SET search_path = '';
ALTER FUNCTION public.publicar_diluicao(p_diluicao uuid, p_revisor_crf text, p_data_revisao date) SET search_path = '';
ALTER FUNCTION public.recusar_troca(p_troca uuid, p_motivo text) SET search_path = '';
ALTER FUNCTION public.solicitar_troca(p_plantao_a uuid, p_plantao_b uuid, p_mensagem text) SET search_path = '';

-- Conferência (deve devolver 0):
-- SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE p.prosecdef AND n.nspname IN ('public', 'private', 'terminologia')
--    AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c IN ('search_path=""', 'search_path='));
