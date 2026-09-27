-- ════════════════════════════════════════════════════════════════════════════
-- Hermes (rodada A) — vínculo de canal de conversa ao perfil.
--
-- O bot do Telegram não sabia quem estava falando: a identidade era pensada
-- para o WhatsApp (telefone). Agora cada canal (telegram, whatsapp…) liga um
-- identificador do próprio canal a um perfil, e esse vínculo só nasce de um
-- CÓDIGO de uso único gerado pela pessoa logada na plataforma:
--   1. Perfil → "Conectar ao Telegram" → gerar_codigo_vinculo_hermes()
--      devolve 6 dígitos, válidos por 10 minutos (guardados só como hash);
--   2. a pessoa manda o código ao bot; o backend do Hermes (service role)
--      confere o hash, o prazo e o uso, e grava o vínculo.
-- Ninguém digita ID de Telegram à mão e ninguém vincula a conta de outro.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.hermes_identidades (
  canal          text NOT NULL CHECK (canal IN ('telegram', 'whatsapp')),
  identificador  text NOT NULL CHECK (length(identificador) BETWEEN 1 AND 64),
  perfil_id      uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (canal, identificador)
);
CREATE INDEX IF NOT EXISTS hermes_identidades_perfil ON public.hermes_identidades (perfil_id);

ALTER TABLE public.hermes_identidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hermes_identidades FROM anon;
REVOKE INSERT, UPDATE ON public.hermes_identidades FROM authenticated;
GRANT SELECT, DELETE ON public.hermes_identidades TO authenticated;
-- cada um vê e desfaz só os próprios vínculos
DROP POLICY IF EXISTS hermes_identidades_proprias ON public.hermes_identidades;
CREATE POLICY hermes_identidades_proprias ON public.hermes_identidades FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id());
DROP POLICY IF EXISTS hermes_identidades_desfazer ON public.hermes_identidades;
CREATE POLICY hermes_identidades_desfazer ON public.hermes_identidades FOR DELETE TO authenticated
  USING (perfil_id = private.meu_perfil_id());

CREATE TABLE IF NOT EXISTS private.hermes_codigos_vinculo (
  codigo_hash  text PRIMARY KEY,
  perfil_id    uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  canal        text NOT NULL,
  expira_em    timestamptz NOT NULL,
  usado_em     timestamptz
);

-- Gera o código (devolvido UMA vez). Códigos anteriores não usados do mesmo
-- perfil e canal deixam de valer.
CREATE OR REPLACE FUNCTION public.gerar_codigo_vinculo_hermes(p_canal text DEFAULT 'telegram')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_codigo text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_canal NOT IN ('telegram', 'whatsapp') THEN RAISE EXCEPTION 'Canal desconhecido.'; END IF;
  DELETE FROM private.hermes_codigos_vinculo WHERE perfil_id = v_perfil AND canal = p_canal AND usado_em IS NULL;
  -- sorteio criptográfico (random() é previsível)
  v_codigo := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000))::text, 6, '0');
  INSERT INTO private.hermes_codigos_vinculo (codigo_hash, perfil_id, canal, expira_em)
  VALUES (encode(extensions.digest(p_canal || ':' || v_codigo, 'sha256'), 'hex'), v_perfil, p_canal, now() + interval '10 minutes');
  PERFORM private.registrar_auditoria('gerar_codigo_vinculo', 'hermes_identidades', v_perfil, NULL,
    jsonb_build_object('tipo', p_canal));
  RETURN v_codigo;
END $$;
REVOKE ALL ON FUNCTION public.gerar_codigo_vinculo_hermes(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_vinculo_hermes(text) TO authenticated;

-- Usado pelo backend do Hermes (service role): confere o código e grava o
-- vínculo. Devolve o perfil vinculado ou NULL (código errado/vencido/usado).
CREATE OR REPLACE FUNCTION public.confirmar_vinculo_hermes(p_canal text, p_identificador text, p_codigo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r private.hermes_codigos_vinculo;
BEGIN
  SELECT * INTO r FROM private.hermes_codigos_vinculo
   WHERE codigo_hash = encode(extensions.digest(p_canal || ':' || btrim(coalesce(p_codigo, '')), 'sha256'), 'hex')
     AND canal = p_canal AND usado_em IS NULL AND expira_em > now()
   FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE private.hermes_codigos_vinculo SET usado_em = now() WHERE codigo_hash = r.codigo_hash;
  INSERT INTO public.hermes_identidades (canal, identificador, perfil_id)
  VALUES (p_canal, p_identificador, r.perfil_id)
  ON CONFLICT (canal, identificador) DO UPDATE SET perfil_id = EXCLUDED.perfil_id, criado_em = now();
  INSERT INTO public.log_auditoria (ator_id, acao, entidade, entidade_id, payload)
  VALUES (r.perfil_id, 'confirmar_vinculo', 'hermes_identidades', r.perfil_id, jsonb_build_object('tipo', p_canal));
  RETURN r.perfil_id;
END $$;
REVOKE ALL ON FUNCTION public.confirmar_vinculo_hermes(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_vinculo_hermes(text, text, text) TO service_role;
