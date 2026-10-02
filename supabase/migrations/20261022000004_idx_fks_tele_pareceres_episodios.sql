-- Índices das chaves estrangeiras mais consultadas, sem índice na varredura de
-- 02/10/2026 (produto/memoria/banco-de-dados.md, "Achados"). Sem índice, as
-- junções por autor e a checagem de FK ao excluir/atualizar o perfil ou o
-- documento referenciado varrem a tabela inteira. Sem CONCURRENTLY: a
-- migration roda em transação e as tabelas ainda são pequenas.

CREATE INDEX IF NOT EXISTS idx_teleinterconsultas_solicitante_id ON public.teleinterconsultas (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_teleinterconsultas_consultor_id ON public.teleinterconsultas (consultor_id);
CREATE INDEX IF NOT EXISTS idx_teleinterconsultas_documento_solicitacao_id ON public.teleinterconsultas (documento_solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_teleinterconsultas_documento_resposta_id ON public.teleinterconsultas (documento_resposta_id);
CREATE INDEX IF NOT EXISTS idx_pareceres_medicos_solicitante_id ON public.pareceres_medicos (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_pareceres_medicos_analista_id ON public.pareceres_medicos (analista_id);
CREATE INDEX IF NOT EXISTS idx_pareceres_medicos_especialidade ON public.pareceres_medicos (especialidade);
CREATE INDEX IF NOT EXISTS idx_pareceres_medicos_cancelado_por ON public.pareceres_medicos (cancelado_por);
CREATE INDEX IF NOT EXISTS idx_pareceres_medicos_documento_solicitacao_id ON public.pareceres_medicos (documento_solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_pareceres_medicos_documento_resposta_id ON public.pareceres_medicos (documento_resposta_id);
CREATE INDEX IF NOT EXISTS idx_pareceres_medicos_documento_cancelamento_id ON public.pareceres_medicos (documento_cancelamento_id);
CREATE INDEX IF NOT EXISTS idx_episodios_aberto_por ON public.episodios (aberto_por);
CREATE INDEX IF NOT EXISTS idx_episodios_encerrado_por ON public.episodios (encerrado_por);
CREATE INDEX IF NOT EXISTS idx_episodios_atendimento_medico_id ON public.episodios (atendimento_medico_id);
CREATE INDEX IF NOT EXISTS idx_episodios_desfecho_por ON public.episodios (desfecho_por);
CREATE INDEX IF NOT EXISTS idx_episodios_suspeita_infeccao_por ON public.episodios (suspeita_infeccao_por);
