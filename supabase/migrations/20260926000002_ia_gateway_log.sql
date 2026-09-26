-- ════════════════════════════════════════════════════════════════════════════
-- Registro do gateway de IA (JEV) — ADR 0006.
--
-- Uma linha por chamada ao modelo: de onde veio, quem pediu, quantos
-- identificadores foram trocados por categoria, se foi bloqueada, provedor,
-- modelo, latência e o hash da entrada. NUNCA o texto: o registro prova que a
-- desidentificação aconteceu sem virar ele mesmo um depósito de dado sensível.
--
-- Escrita: só o serviço (Hermes, service_role). Leitura: super_admin.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ia_gateway_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  origem        text NOT NULL,
  perfil_id     uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  bloqueado     boolean NOT NULL,
  substituicoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  residuos      integer NOT NULL DEFAULT 0,
  hash_entrada  text NOT NULL,
  provedor      text,
  modelo        text,
  latencia_ms   integer,
  erro          text,
  CONSTRAINT ia_gateway_log_hash CHECK (hash_entrada ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ia_gateway_log_substituicoes CHECK (jsonb_typeof(substituicoes) = 'object')
);

CREATE INDEX IF NOT EXISTS ia_gateway_log_criado_em ON public.ia_gateway_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS ia_gateway_log_perfil ON public.ia_gateway_log (perfil_id) WHERE perfil_id IS NOT NULL;

ALTER TABLE public.ia_gateway_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_gateway_log FORCE ROW LEVEL SECURITY;

-- Registro não se altera nem se apaga pela API.
REVOKE ALL ON public.ia_gateway_log FROM anon, authenticated;
GRANT SELECT ON public.ia_gateway_log TO authenticated;

DROP POLICY IF EXISTS ia_gateway_log_select_super ON public.ia_gateway_log;
CREATE POLICY ia_gateway_log_select_super ON public.ia_gateway_log
  FOR SELECT TO authenticated
  USING (private.eh_super_admin());

COMMENT ON TABLE public.ia_gateway_log IS
  'Uma linha por chamada ao modelo de IA, via gateway (ADR 0006). Só metadados — nunca o texto.';
