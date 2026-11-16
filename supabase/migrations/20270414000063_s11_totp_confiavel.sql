-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S11 (F1, opção C): o aplicativo autenticador só vale
-- como segundo fator se o PRIMEIRO código dele foi confirmado numa sessão que
-- já tinha passado pelo código por e-mail. Decisão do RT em 16/11/2026
-- ("Sim, pelo banco").
--
-- Por quê: o hook "MFA verification attempt" (T4 do S3) exige o plano Team, e
-- o projeto é Pro. Sem ele, quem tem só a senha cadastra o próprio aplicativo
-- e vira aal2 sem nunca ver o e-mail.
--
-- Como: ao confirmar um código TOTP, o Auth grava em auth.sessions o fator
-- usado (factor_id) e sobe a sessão para aal2. O gatilho abaixo, na primeira
-- vez que vê cada fator, guarda se aquela sessão tinha passado pelo e-mail
-- (private.segundo_fator_sessao_ok). O portão (segundo_fator_valido) só
-- aceita aal2 quando o fator da sessão está marcado como confiável. Fator sem
-- registro ou marcado como não confiável cai no código por e-mail.
--
-- Falha do gatilho nunca derruba a verificação do Auth: o fator fica sem
-- registro e o portão pede o e-mail (falha fechada para a segurança, aberta
-- para quem usa).
--
-- Expand: só cria. Rollback no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS private.totp_confiavel (
  factor_id   uuid PRIMARY KEY REFERENCES auth.mfa_factors(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confiavel   boolean NOT NULL,
  session_id  uuid,
  decidido_em timestamptz NOT NULL DEFAULT now(),
  origem      text NOT NULL CHECK (origem IN ('sessao', 'anterior_ao_s11'))
);
ALTER TABLE private.totp_confiavel ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.totp_confiavel FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE private.totp_confiavel IS
  'S11 (F1-C): primeiro uso de cada aplicativo autenticador e se a sessão tinha passado pelo código por e-mail. Só o banco grava.';

-- Aplicativos já verificados antes desta regra: confiáveis (cadastrados quando
-- o hook não existia; na produção, 1 em 16/11/2026).
INSERT INTO private.totp_confiavel (factor_id, user_id, confiavel, origem)
SELECT f.id, f.user_id, true, 'anterior_ao_s11'
  FROM auth.mfa_factors f
 WHERE f.factor_type::text = 'totp' AND f.status::text = 'verified'
ON CONFLICT (factor_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.totp_registrar_primeiro_uso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.factor_id IS NULL OR NEW.aal::text <> 'aal2'
     OR (TG_OP = 'UPDATE' AND OLD.factor_id IS NOT DISTINCT FROM NEW.factor_id AND OLD.aal::text = 'aal2') THEN
    RETURN NEW;
  END IF;
  BEGIN
    INSERT INTO private.totp_confiavel (factor_id, user_id, confiavel, session_id, origem)
    SELECT f.id, f.user_id,
           EXISTS (SELECT 1 FROM private.segundo_fator_sessao_ok s
                    WHERE s.session_id = NEW.id AND s.user_id = NEW.user_id),
           NEW.id, 'sessao'
      FROM auth.mfa_factors f
     WHERE f.id = NEW.factor_id AND f.factor_type::text = 'totp'
    ON CONFLICT (factor_id) DO NOTHING;   -- só a primeira vez decide
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'S11: totp_confiavel não registrado: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.totp_registrar_primeiro_uso() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS s11_totp_primeiro_uso ON auth.sessions;
CREATE TRIGGER s11_totp_primeiro_uso
  AFTER INSERT OR UPDATE OF factor_id, aal ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION private.totp_registrar_primeiro_uso();

-- O fator da sessão atual é um aplicativo confiável?
CREATE OR REPLACE FUNCTION private.totp_da_sessao_confiavel()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
      FROM auth.sessions s
      JOIN private.totp_confiavel c ON c.factor_id = s.factor_id AND c.confiavel
     WHERE s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       AND s.user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION private.totp_da_sessao_confiavel() FROM PUBLIC, anon;

-- Portão: aal2 + TOTP (< 24 h) só com aplicativo confiável; ou sessão
-- verificada por e-mail (como antes).
CREATE OR REPLACE FUNCTION private.segundo_fator_valido()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (auth.jwt()->>'aal' = 'aal2'
       AND private.ultima_verificacao_totp() > now() - interval '24 hours'
       AND private.totp_da_sessao_confiavel())
    OR private.segundo_fator_sessao_valida(),
    false);
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, se precisar):
--   CREATE OR REPLACE FUNCTION private.segundo_fator_valido() … versão de
--     20261022000001_segundo_fator_email.sql (sem totp_da_sessao_confiavel);
--   DROP TRIGGER IF EXISTS s11_totp_primeiro_uso ON auth.sessions;
--   DROP FUNCTION IF EXISTS private.totp_da_sessao_confiavel();
--   DROP FUNCTION IF EXISTS private.totp_registrar_primeiro_uso();
--   DROP TABLE IF EXISTS private.totp_confiavel;
-- ════════════════════════════════════════════════════════════════════════════
