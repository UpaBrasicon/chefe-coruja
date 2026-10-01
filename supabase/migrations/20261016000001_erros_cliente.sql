-- ════════════════════════════════════════════════════════════════════════════
-- Onda 12 — Erros e alertas do sistema (o BANCO que recebe e guarda os erros).
--
-- O navegador captura os defeitos (ErroBoundary, erro não tratado, promessa
-- rejeitada, falha de RPC/rede) e manda para cá, já HIGIENIZADO (sem id, sem
-- nome, sem conteúdo digitado, sem dado de paciente — isso é responsabilidade
-- da frente do front). Aqui ficam o recebimento e a leitura:
--
--  * public.erros_cliente — um registro por ocorrência. Ninguém lê a tabela
--    direto (RLS liga e os GRANTs são revogados); grava-se só pela RPC
--    registrar_erro_cliente (SECURITY DEFINER), que vale logado E deslogado.
--  * registrar_erro_cliente(...) — grava um erro. Nunca confia no front para
--    papel/unidade/perfil: deriva do próprio token (auth.uid() → perfil →
--    vínculo ativo). O front manda só tipo/origem/mensagem/detalhe/assinatura/
--    navegador/versão. Trunca os campos de texto. PROTEÇÃO CONTRA FLOOD: se o
--    MESMO perfil (ou o mesmo IP, quando deslogado) já gravou a MESMA
--    assinatura nos últimos 2 minutos, ignora em silêncio (não grava, não dá
--    erro) — um defeito em loop não enche a tabela.
--  * erros_cliente_agrupados(...) — SÓ o administrador geral (super admin).
--    Agrupa por assinatura: um exemplo da mensagem, ocorrências, perfis
--    afetados, primeira/última ocorrência e se está resolvido.
--  * resolver_erro_cliente(assinatura, resolver) — SÓ o super admin. Marca ou
--    desmarca um grupo como resolvido. Resolver NÃO apaga os erros (fica numa
--    tabela à parte, erros_cliente_resolvidos).
--
-- Reaplicável (CREATE OR REPLACE / IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. tabela dos erros do navegador ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.erros_cliente (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  -- derivados do token no servidor (nulos quando o erro ocorre deslogado)
  perfil_id   uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  unidade_id  uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  papel       text,
  -- vindos do front (já higienizados)
  tipo        text NOT NULL CHECK (tipo IN ('render', 'erro_js', 'promessa', 'rpc', 'rede')),
  origem      text,              -- a rota SEM parâmetros, ex. '/plantao/internacao'
  mensagem    text,              -- mensagem higienizada
  detalhe     text,              -- stack curto, higienizado
  assinatura  text NOT NULL,     -- rótulo estável para agrupar
  navegador   text,
  versao_app  text,
  ip          inet
);
CREATE INDEX IF NOT EXISTS erros_cliente_assinatura_idx ON public.erros_cliente (assinatura, criado_em DESC);
CREATE INDEX IF NOT EXISTS erros_cliente_criado_em_idx  ON public.erros_cliente (criado_em DESC);
-- índice para a checagem de flood (mesma assinatura do mesmo perfil/ip, recente)
CREATE INDEX IF NOT EXISTS erros_cliente_flood_idx ON public.erros_cliente (assinatura, criado_em DESC)
  INCLUDE (perfil_id, ip);
COMMENT ON TABLE public.erros_cliente IS
  'Defeitos capturados no navegador (Onda 12). Grava-se só pela RPC registrar_erro_cliente; lê-se só pelo super admin, agrupado. Campos já higienizados pelo front: sem id/nome/conteúdo/dado de paciente.';

-- grupos marcados como resolvidos (resolver não apaga os erros)
CREATE TABLE IF NOT EXISTS public.erros_cliente_resolvidos (
  assinatura   text PRIMARY KEY,
  resolvido_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  resolvido_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.erros_cliente_resolvidos IS
  'Assinaturas de erro marcadas como resolvidas pelo super admin. Não apaga os erros em public.erros_cliente.';

-- ── 2. RLS: ninguém lê/escreve direto; tudo passa pelas RPCs ────────────────
ALTER TABLE public.erros_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erros_cliente_resolvidos ENABLE ROW LEVEL SECURITY;
-- sem política de SELECT/INSERT: as RPCs são SECURITY DEFINER e rodam como owner
REVOKE ALL ON public.erros_cliente FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.erros_cliente_resolvidos FROM PUBLIC, anon, authenticated;

-- ── 3. registrar um erro (logado ou deslogado) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_erro_cliente(
  p_tipo       text,
  p_origem     text,
  p_mensagem   text,
  p_detalhe    text    DEFAULT NULL,
  p_assinatura text    DEFAULT NULL,
  p_navegador  text    DEFAULT NULL,
  p_versao_app text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil     uuid := private.meu_perfil_id();
  v_unidade    uuid;
  v_papel      text;
  v_ip         inet := private.requisicao_ip();
  v_tipo       text;
  v_assinatura text;
  v_navegador  text := coalesce(nullif(btrim(p_navegador), ''), private.requisicao_navegador());
  v_id         uuid;
BEGIN
  -- o front não decide o tipo livremente; o que não reconhecemos vira 'erro_js'
  v_tipo := lower(btrim(coalesce(p_tipo, '')));
  IF v_tipo NOT IN ('render', 'erro_js', 'promessa', 'rpc', 'rede') THEN
    v_tipo := 'erro_js';
  END IF;

  -- assinatura estável para agrupar; se o front não mandar, derivamos uma
  v_assinatura := left(btrim(coalesce(nullif(p_assinatura, ''),
    md5(v_tipo || '|' || coalesce(p_origem, '') || '|' || coalesce(p_mensagem, '')))), 200);

  -- papel/unidade nunca vêm do front: derivam do vínculo ativo do perfil
  IF v_perfil IS NOT NULL THEN
    SELECT v.unidade_id, v.papel::text INTO v_unidade, v_papel
      FROM public.vinculos v
     WHERE v.perfil_id = v_perfil AND v.ativo
     ORDER BY v.updated_at DESC
     LIMIT 1;
  END IF;

  -- proteção contra flood: mesmo perfil (ou mesmo ip, deslogado) e mesma
  -- assinatura nos últimos 2 minutos — ignora em silêncio (não grava, sem erro)
  IF (v_perfil IS NOT NULL OR v_ip IS NOT NULL) AND EXISTS (
    SELECT 1 FROM public.erros_cliente e
     WHERE e.assinatura = v_assinatura
       AND e.criado_em > now() - interval '2 minutes'
       AND ((v_perfil IS NOT NULL AND e.perfil_id = v_perfil)
            OR (v_perfil IS NULL AND v_ip IS NOT NULL AND e.ip = v_ip))
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.erros_cliente
    (perfil_id, unidade_id, papel, tipo, origem, mensagem, detalhe, assinatura, navegador, versao_app, ip)
  VALUES
    (v_perfil, v_unidade, v_papel, v_tipo,
     left(nullif(btrim(coalesce(p_origem, '')), ''), 300),
     left(coalesce(p_mensagem, ''), 2000),
     left(nullif(coalesce(p_detalhe, ''), ''), 2000),
     v_assinatura,
     left(v_navegador, 300),
     left(nullif(btrim(coalesce(p_versao_app, '')), ''), 50),
     v_ip)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ── 4. leitura agrupada (só o administrador geral / super admin) ────────────
CREATE OR REPLACE FUNCTION public.erros_cliente_agrupados(
  p_desde              timestamptz DEFAULT now() - interval '7 days',
  p_incluir_resolvidos boolean     DEFAULT false
)
RETURNS TABLE (
  assinatura       text,
  tipo             text,
  origem           text,
  mensagem         text,
  ocorrencias      bigint,
  perfis_afetados  bigint,
  primeira_em      timestamptz,
  ultima_em        timestamptz,
  resolvido        boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: erros do sistema são do administrador geral.';
  END IF;
  RETURN QUERY
  SELECT g.assinatura,
         (array_agg(g.tipo     ORDER BY g.criado_em DESC))[1],
         (array_agg(g.origem   ORDER BY g.criado_em DESC))[1],
         (array_agg(g.mensagem ORDER BY g.criado_em DESC))[1],
         count(*),
         count(DISTINCT g.perfil_id),
         min(g.criado_em),
         max(g.criado_em),
         (r.assinatura IS NOT NULL)
    FROM public.erros_cliente g
    LEFT JOIN public.erros_cliente_resolvidos r ON r.assinatura = g.assinatura
   WHERE g.criado_em >= p_desde
     AND (p_incluir_resolvidos OR r.assinatura IS NULL)
   GROUP BY g.assinatura, r.assinatura
   ORDER BY max(g.criado_em) DESC;
END $$;

-- ── 5. marcar/desmarcar um grupo como resolvido (só o super admin) ──────────
CREATE OR REPLACE FUNCTION public.resolver_erro_cliente(
  p_assinatura text,
  p_resolver   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: erros do sistema são do administrador geral.';
  END IF;
  IF p_assinatura IS NULL OR btrim(p_assinatura) = '' THEN
    RAISE EXCEPTION 'Assinatura do erro é obrigatória.';
  END IF;
  IF p_resolver THEN
    INSERT INTO public.erros_cliente_resolvidos (assinatura, resolvido_por, resolvido_em)
    VALUES (p_assinatura, private.meu_perfil_id(), now())
    ON CONFLICT (assinatura)
      DO UPDATE SET resolvido_por = excluded.resolvido_por, resolvido_em = excluded.resolvido_em;
  ELSE
    DELETE FROM public.erros_cliente_resolvidos WHERE assinatura = p_assinatura;
  END IF;
END $$;

-- ── 6. permissões ───────────────────────────────────────────────────────────
-- registrar: vale logado E deslogado (o erro pode ocorrer sem sessão)
REVOKE ALL ON FUNCTION public.registrar_erro_cliente(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_erro_cliente(text, text, text, text, text, text, text) TO anon, authenticated;
-- leitura/resolução: só o administrador geral (checado dentro, mas sem anon)
REVOKE ALL ON FUNCTION public.erros_cliente_agrupados(timestamptz, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erros_cliente_agrupados(timestamptz, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.resolver_erro_cliente(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_erro_cliente(text, boolean) TO authenticated;
