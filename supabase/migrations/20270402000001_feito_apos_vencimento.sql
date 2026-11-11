-- ════════════════════════════════════════════════════════════════════════════
-- Dose dada antes do vencimento e registrada depois (decisão do RT em
-- 10/11/2026: "Sim, até 2 h"; pendência da lacuna 6).
--
-- Antes: o "feito" de item vencido era recusado pela hora do registro. Se a
-- enfermagem deu a dose de um horário aprazado ANTERIOR ao vencimento e só
-- registrou depois, a checagem era recusada.
--
-- Agora o "feito" é aceito quando:
--   - o item tem horário aprazado e o horário checado (p_horario) cai antes do
--     vencimento (private.horario_previsto, da lacuna 9); e
--   - o registro é feito em até 2 h depois do vencimento.
-- Fora disso a regra continua: a enfermagem não executa prescrição fora da
-- validade (Resolução COFEN 689/2022, art. 4º). Item sem horário ("Se
-- necessário", contínuo) segue sem a exceção. O atraso e o motivo do atraso
-- (lacuna 9) continuam valendo para essa dose.
--
-- A função é trocada pelo texto atual, trecho a trecho; se o trecho sumiu, a
-- migration para; se já foi trocado, pula. Idempotente.
-- Teste: supabase/tests/feito_apos_vencimento.sql
--
-- Rollback: trocar o trecho novo pelo antigo (os dois estão abaixo).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.trocar_feito(f regprocedure, v_ant text, v_novo text)
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

SELECT pg_temp.trocar_feito('public.checar(uuid, text, text, text, text, text)'::regprocedure,
$a$  IF p_situacao = 'feito' AND it.valida_ate IS NOT NULL AND now() >= it.valida_ate THEN
$a$,
$b$  -- exceção (RT, 10/11/2026): dose de horário aprazado anterior ao vencimento,
  -- registrada até 2 h depois dele, é aceita
  IF p_situacao = 'feito' AND it.valida_ate IS NOT NULL AND now() >= it.valida_ate
     AND NOT (p_horario IS NOT NULL
              AND now() < it.valida_ate + interval '2 hours'
              AND private.horario_previsto(p_horario, now()) < it.valida_ate) THEN
$b$);
