-- Percurso da UBS, U1 (RT, 17/11/2026, decisão A): a ficha da UBS que não foi
-- atendida vence no fim do expediente e fecha como "não aguardou".
--
-- Achados R1, E1 e M1 do percurso: na homologação havia fichas "aguardando"
-- havia 330 h, e a busca da recepção dizia que o paciente "já está na fila"
-- por uma ficha de 13 dias antes (FICHA_EPISODIO_ABERTO).
--
-- Regra:
-- - vale só para a UBS (episódio com tipo_atendimento_aps);
-- - só a ficha sem atendimento iniciado (etapa triagem ou atendimento, sem
--   atendimento_iniciado_em). Quem já está em atendimento continua com o médico,
--   que registra a conduta ou a evasão;
-- - "fim do expediente" é a virada do dia em America/Sao_Paulo. Quando a UBS
--   ganhar horário de funcionamento (U3), o vencimento passa a usar o fechamento;
-- - o desfecho é "evasao" (o mesmo da saída sem atendimento), com o relato e a
--   marca "vencida" nos detalhes. A agenda segue sozinha: consulta marcada com
--   ficha vencida vira "não aguardou" (gatilho agendamento_segue_episodio).
-- - desfecho_por e encerrado_por ficam vazios: quem fecha é o sistema, e a
--   auditoria registra cada ficha.
--
-- Rollback:
--   SELECT cron.unschedule('ubs-ficha-vence');
--   DROP FUNCTION private.ubs_vencer_fichas();
--   (as fichas já vencidas ficam como estão: o encerramento é registro)

CREATE OR REPLACE FUNCTION private.ubs_vencer_fichas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r record;
  n int := 0;
  v_hoje timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  FOR r IN
    UPDATE public.episodios e
       SET etapa = 'encerrado',
           desfecho = 'evasao',
           desfecho_motivo = 'Não aguardou: a ficha venceu no fim do expediente sem atendimento (encerrada pelo sistema).',
           desfecho_detalhes = jsonb_build_object('vencida', true, 'etapa_anterior', e.etapa),
           desfecho_em = now(),
           encerrado_em = now(),
           reavaliar_em = NULL,
           updated_at = now()
     WHERE e.tipo_atendimento_aps IS NOT NULL
       AND e.etapa IN ('triagem', 'atendimento')
       AND e.atendimento_iniciado_em IS NULL
       AND e.chegada_em < v_hoje
    RETURNING e.id, e.unidade_id, e.chegada_em, (e.desfecho_detalhes ->> 'etapa_anterior') AS etapa_anterior
  LOOP
    n := n + 1;
    DELETE FROM public.atendimento_rascunhos WHERE episodio_id = r.id;
    PERFORM private.registrar_auditoria('ficha_vencida', 'episodios', r.id, r.unidade_id,
      jsonb_build_object('chegada_em', r.chegada_em, 'etapa_anterior', r.etapa_anterior,
                         'motivo', 'U1: ficha da UBS sem atendimento venceu no fim do expediente'));
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.ubs_vencer_fichas() FROM PUBLIC, anon, authenticated;

-- todo dia às 00:05 de Brasília (03:05 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ubs-ficha-vence';
  PERFORM cron.schedule('ubs-ficha-vence', '5 3 * * *', 'SELECT private.ubs_vencer_fichas();');
END $$;
