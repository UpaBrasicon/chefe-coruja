-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — segundo fator (ADR 0010): uma vez a cada 24 horas, e sempre que o
-- aparelho é novo.
--
-- "Aparelho novo" sai de graça: na Supabase o nível aal2 é da SESSÃO — um
-- login em outro aparelho nasce aal1 e precisa do código. A janela diária é
-- conferida no próprio JWT: o claim `amr` traz o horário da verificação TOTP.
--
-- Implantação em duas chaves (ordem decidida em 26/09/2026): as pessoas
-- cadastram o autenticador primeiro; a exigência só vale quando
-- `exigir_segundo_fator` for ligada em configuracao_plataforma. Com ela
-- desligada, nada muda para ninguém.
--
-- Pendente antes de ligar a chave: as RPCs SECURITY DEFINER clínicas não
-- passam pela RLS e precisam chamar private.exigir_segundo_fator() — lista
-- em produto/docs/PLANO-DE-FASES.md.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.configuracao_plataforma (
  chave        text PRIMARY KEY,
  valor        boolean NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracao_plataforma ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.configuracao_plataforma FROM anon, authenticated;
GRANT SELECT ON public.configuracao_plataforma TO authenticated;
DROP POLICY IF EXISTS configuracao_plataforma_leitura ON public.configuracao_plataforma;
CREATE POLICY configuracao_plataforma_leitura ON public.configuracao_plataforma
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.configuracao_plataforma (chave, valor)
VALUES ('exigir_segundo_fator', false)
ON CONFLICT (chave) DO NOTHING;

-- Horário (epoch) da verificação TOTP mais recente desta sessão, lido do JWT.
CREATE OR REPLACE FUNCTION private.ultima_verificacao_totp()
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT to_timestamp(max((e->>'timestamp')::bigint))
  FROM jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) e
  WHERE e->>'method' = 'totp';
$$;

-- Sessão com segundo fator válido: aal2 E verificação TOTP há menos de 24 h.
CREATE OR REPLACE FUNCTION private.segundo_fator_valido()
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(
    auth.jwt()->>'aal' = 'aal2'
    AND private.ultima_verificacao_totp() > now() - interval '24 hours',
    false);
$$;

-- O que as policies usam: com a chave desligada, sempre verdadeiro.
CREATE OR REPLACE FUNCTION private.segundo_fator_ok()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN coalesce((SELECT c.valor FROM public.configuracao_plataforma c WHERE c.chave = 'exigir_segundo_fator'), false)
      THEN private.segundo_fator_valido()
    ELSE true
  END;
$$;

-- Para RPCs SECURITY DEFINER (que não passam pela RLS).
CREATE OR REPLACE FUNCTION private.exigir_segundo_fator()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE THEN
    RAISE EXCEPTION 'SEGUNDO_FATOR: confirme o código do autenticador para continuar.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END; $$;

-- Para a interface decidir entre "cadastrar", "digitar o código" ou nada.
CREATE OR REPLACE FUNCTION public.segundo_fator_status()
RETURNS TABLE(exigido boolean, valido boolean, verificado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT c.valor FROM public.configuracao_plataforma c WHERE c.chave = 'exigir_segundo_fator'), false),
         private.segundo_fator_valido(),
         private.ultima_verificacao_totp();
$$;

REVOKE EXECUTE ON FUNCTION private.ultima_verificacao_totp(), private.segundo_fator_valido(),
  private.segundo_fator_ok(), private.exigir_segundo_fator(), public.segundo_fator_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.ultima_verificacao_totp(), private.segundo_fator_valido(),
  private.segundo_fator_ok(), private.exigir_segundo_fator(), public.segundo_fator_status() TO authenticated;

-- Policy RESTRITIVA em toda tabela com dado de paciente: soma-se às
-- permissivas existentes (AND), então só aperta — nunca abre acesso.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pacientes','internacoes','observacao','prescricoes','documentos_clinicos',
                           'eventos_adt','checklist_admissao','alta_paciente','transferencias_paciente',
                           'sugestoes_prescricao','cuidados_plantonistas','log_acesso_prontuario'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_segundo_fator', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok())',
      t || '_segundo_fator', t);
  END LOOP;
END $$;
