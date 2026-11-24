-- ════════════════════════════════════════════════════════════════════════════
-- Pedido 26 do checklist "31 pedidos" (F8 do diagnóstico de 23/11/2026):
-- índices das tabelas do aviso de sepse.
--
-- aviso_sepse_atendimento procura o "dispensado" por episodio_id, nivel e
-- evento. O único índice por episódio é parcial (evento = 'exibido'), então
-- essa busca lê a tabela inteira: na homologação, mesmo com enable_seqscan =
-- off, o plano foi Seq Scan. As duas chaves estrangeiras de paciente também
-- não têm índice. As tabelas são pequenas hoje, mas crescem a cada
-- atendimento. Só cria (expand) e pode rodar de novo.
--
-- Sem CONCURRENTLY: a migration roda em transação e as tabelas são pequenas.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS public.avisos_sepse_atendimento_episodio_idx;
--   DROP INDEX IF EXISTS public.avisos_sepse_atendimento_paciente_fk_idx;
--   DROP INDEX IF EXISTS public.alertas_sepse_internacao_paciente_fk_idx;
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS avisos_sepse_atendimento_episodio_idx
  ON public.avisos_sepse_atendimento (episodio_id, nivel, evento);

CREATE INDEX IF NOT EXISTS avisos_sepse_atendimento_paciente_fk_idx
  ON public.avisos_sepse_atendimento (paciente_id);

CREATE INDEX IF NOT EXISTS alertas_sepse_internacao_paciente_fk_idx
  ON public.alertas_sepse_internacao (paciente_id);
