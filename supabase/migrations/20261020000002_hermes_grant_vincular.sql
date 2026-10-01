-- Hermes V1 (follow-up): faltou conceder confirmar_vinculo_hermes a hermes_user
-- na 20261020000001. /skill/vincular (onboarding do canal) chama essa RPC; sem o
-- grant, quebraria após o cutover (quando o Hermes usa a chave hermes_user).
-- Reaplicável (GRANT é idempotente). Só adiciona hermes_user; não mexe nos
-- grants existentes (service_role segue).
GRANT EXECUTE ON FUNCTION public.confirmar_vinculo_hermes(text, text, text) TO hermes_user;
