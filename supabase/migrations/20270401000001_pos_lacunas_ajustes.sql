-- ════════════════════════════════════════════════════════════════════════════
-- Ajustes das pendências da trilha "Lacunas do Portão" (RT, 10/11/2026: "vamos
-- fazer cada pendência").
--
-- 1. cancelar_alta: depois de 24 h a mensagem mandava "falar com o gestor",
--    mas o servidor recusa também o gestor. A mensagem passa a dizer o que
--    fazer: nova admissão, se o paciente voltar. A regra não muda.
-- 2. cancelar_documento: o documento de transferência (lacuna 7) não se
--    cancela depois de a transferência estar registrada no atendimento (porta:
--    desfecho 'transferencia'; observação e internação: status
--    'transferencia_externa'). O documento acompanhou o paciente e compõe o
--    prontuário do destino (Portaria GM/MS 2.048/2002, Anexo, Cap. VI, 3.1 f).
--    Cancelar fica só antes da saída.
--
-- As funções são trocadas pelo texto atual, trecho a trecho; se o trecho
-- sumiu, a migration para; se já foi trocado, pula. Idempotente.
--
-- Rollback: trocar os trechos de volta (os textos "antes" estão abaixo).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.trocar_ajuste(f regprocedure, v_ant text, v_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := pg_get_functiondef(f);
  v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
  a text := replace(replace(v_ant, E'\r', ''), E'\n', v_fim);
  b text := replace(replace(v_novo, E'\r', ''), E'\n', v_fim);
BEGIN
  IF position(b IN def) > 0 THEN RETURN; END IF;
  IF position(a IN def) = 0 THEN RAISE EXCEPTION '%: trecho não encontrado: %', f, a; END IF;
  IF (length(def) - length(replace(def, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '%: trecho aparece mais de uma vez', f;
  END IF;
  EXECUTE replace(def, a, b);
END $$;

-- 1. mensagem das 24 h
SELECT pg_temp.trocar_ajuste('public.cancelar_alta(uuid, text)'::regprocedure,
  $a$RAISE EXCEPTION 'A alta tem mais de 24 horas: fale com o gestor.';$a$,
  $b$RAISE EXCEPTION 'A alta tem mais de 24 horas e não pode mais ser cancelada. Se o paciente voltar, faça uma nova admissão.';$b$);

-- 2. documento de transferência depois da saída
SELECT pg_temp.trocar_ajuste('public.cancelar_documento(uuid, text)'::regprocedure,
  $a$  IF length(v_motivo) < 15 THEN
    RAISE EXCEPTION 'Informe a justificativa do cancelamento (mínimo de 15 letras).';
  END IF;
$a$,
  $b$  IF length(v_motivo) < 15 THEN
    RAISE EXCEPTION 'Informe a justificativa do cancelamento (mínimo de 15 letras).';
  END IF;
  -- documento de transferência não se cancela depois da saída: acompanhou o
  -- paciente e compõe o prontuário do destino (Portaria 2.048/2002, VI, 3.1 f)
  IF d.tipo_documento = 'documento_transferencia' AND (
       EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = d.episodio_id AND e.desfecho = 'transferencia')
    OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = d.internacao_id AND i.status = 'transferencia_externa')) THEN
    RAISE EXCEPTION 'A transferência já foi registrada: o documento acompanhou o paciente e não se cancela mais.';
  END IF;
$b$);
