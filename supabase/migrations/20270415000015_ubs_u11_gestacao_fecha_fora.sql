-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U11, PR 2 (plano em docs/ubs/U11-PLANO.md; U11 = A do RT).
-- Achados A8 e A9: parto ou aborto no hospital ou na UPA não fechava a gestação
-- na UBS, e a consulta de puerpério se perdia.
--
-- 1. private.fechar_gestacao_de_fora(mulher, desfecho, data, origem): fecha a
--    gestação ativa (sem desfecho) da mesma mulher em todas as UBS da rede onde
--    ela tem cadastro (private.regulacao_mesmo_paciente: CNS, CPF ou
--    unificação). Só fecha se a data não for antes da DUM. Fica na auditoria
--    com a origem. A UBS já recebe a contrarreferência da alta.
-- 2. Sinais de parto e aborto:
--    - cadastro de RN ligado à mãe (pacientes.mae_id): parto na data de
--      nascimento do RN;
--    - alta da internação com CID O80 a O84 (parto) ou O00 a O08 (aborto), na
--      data da alta;
--    - desfecho da porta (UPA ou hospital, fora da UBS) com o mesmo CID, na data
--      do encerramento.
--    Um erro aqui vira aviso no log: nunca impede o cadastro, a alta ou o
--    desfecho.
--
-- Sem CNS, CPF nem unificação, a UBS não é achada e a gestação fica aberta; a
-- UBS fecha à mão, como antes.
--
-- Idempotente. Teste: supabase/tests/ubs_u11_gestacao_fecha_fora.sql
--
-- Rollback:
--   DROP TRIGGER trg_u11_rn_fecha_gestacao ON public.pacientes;
--   DROP TRIGGER trg_u11_alta_fecha_gestacao ON public.internacoes;
--   DROP TRIGGER trg_u11_desfecho_fecha_gestacao ON public.episodios;
--   DROP FUNCTION private.u11_rn_fecha_gestacao(), private.u11_alta_fecha_gestacao(),
--     private.u11_desfecho_fecha_gestacao(), private.desfecho_pelo_cid(text),
--     private.fechar_gestacao_de_fora(uuid, text, date, text);
-- ════════════════════════════════════════════════════════════════════════════

-- parto (O80–O84) ou aborto (O00–O08) pelo CID-10; nulo nos outros
CREATE OR REPLACE FUNCTION private.desfecho_pelo_cid(p_cid text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN upper(replace(coalesce(p_cid, ''), '.', '')) ~ '^O8[0-4]' THEN 'parto'
              WHEN upper(replace(coalesce(p_cid, ''), '.', '')) ~ '^O0[0-8]' THEN 'aborto' END
$$;
REVOKE ALL ON FUNCTION private.desfecho_pelo_cid(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.fechar_gestacao_de_fora(p_mulher uuid, p_desfecho text, p_data date, p_origem text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g record; n int := 0;
BEGIN
  IF p_mulher IS NULL OR p_data IS NULL OR p_desfecho NOT IN ('parto', 'aborto') THEN RETURN 0; END IF;
  FOR g IN
    SELECT x.id, x.unidade_id FROM public.pre_natal_gestacoes x
      JOIN public.unidades u ON u.id = x.unidade_id AND u.tipo::text = 'ubs'
     WHERE x.paciente_id IN (SELECT m.paciente_id FROM private.regulacao_mesmo_paciente(p_mulher) m)
       AND x.desfecho IS NULL AND x.saida_em IS NULL
       AND (x.dum IS NULL OR p_data >= x.dum)
       AND private.pre_natal_ativa(x.saida_em, x.desfecho, x.dum, x.desfecho_em)
     FOR UPDATE OF x
  LOOP
    UPDATE public.pre_natal_gestacoes
       SET desfecho = p_desfecho, desfecho_em = p_data, desfecho_por = private.meu_perfil_id(), desfecho_registrado_em = now()
     WHERE id = g.id;
    PERFORM private.registrar_auditoria('pre_natal_desfecho', 'pre_natal_gestacoes', g.id, g.unidade_id,
      jsonb_build_object('desfecho', p_desfecho, 'situacao', p_origem));
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.fechar_gestacao_de_fora(uuid, text, date, text) FROM PUBLIC, anon, authenticated;

-- ── RN ligado à mãe ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.u11_rn_fecha_gestacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    PERFORM private.fechar_gestacao_de_fora(NEW.mae_id, 'parto', NEW.data_nascimento, 'nascimento do RN');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'U11: gestação não fechada pelo RN %: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.u11_rn_fecha_gestacao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_u11_rn_fecha_gestacao ON public.pacientes;
CREATE TRIGGER trg_u11_rn_fecha_gestacao AFTER INSERT ON public.pacientes
  FOR EACH ROW WHEN (NEW.mae_id IS NOT NULL AND NEW.data_nascimento IS NOT NULL)
  EXECUTE FUNCTION private.u11_rn_fecha_gestacao();

-- ── alta da internação ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.u11_alta_fecha_gestacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_desfecho text := private.desfecho_pelo_cid(NEW.cid_alta);
BEGIN
  IF v_desfecho IS NOT NULL THEN
    BEGIN
      PERFORM private.fechar_gestacao_de_fora(NEW.paciente_id, v_desfecho,
        (NEW.data_alta AT TIME ZONE 'America/Sao_Paulo')::date, 'alta da internação');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'U11: gestação não fechada pela alta %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.u11_alta_fecha_gestacao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_u11_alta_fecha_gestacao ON public.internacoes;
CREATE TRIGGER trg_u11_alta_fecha_gestacao AFTER UPDATE OF data_alta ON public.internacoes
  FOR EACH ROW WHEN (OLD.data_alta IS NULL AND NEW.data_alta IS NOT NULL)
  EXECUTE FUNCTION private.u11_alta_fecha_gestacao();

-- ── desfecho da porta (fora da UBS) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.u11_desfecho_fecha_gestacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_desfecho text := private.desfecho_pelo_cid(NEW.desfecho_detalhes ->> 'cid_alta');
BEGIN
  IF v_desfecho IS NOT NULL THEN
    BEGIN
      PERFORM private.fechar_gestacao_de_fora(NEW.paciente_id, v_desfecho,
        (coalesce(NEW.encerrado_em, now()) AT TIME ZONE 'America/Sao_Paulo')::date, 'desfecho da porta');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'U11: gestação não fechada pelo desfecho %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.u11_desfecho_fecha_gestacao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_u11_desfecho_fecha_gestacao ON public.episodios;
CREATE TRIGGER trg_u11_desfecho_fecha_gestacao AFTER UPDATE OF etapa ON public.episodios
  FOR EACH ROW WHEN (NEW.etapa = 'encerrado' AND OLD.etapa IS DISTINCT FROM 'encerrado' AND NEW.tipo_atendimento_aps IS NULL)
  EXECUTE FUNCTION private.u11_desfecho_fecha_gestacao();
