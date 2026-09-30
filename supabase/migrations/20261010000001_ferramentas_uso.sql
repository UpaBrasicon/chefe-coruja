-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 9 — favoritos e contagem de uso das ferramentas da
-- Central do Plantonista (P/index.html: FAVS, `usos()`, "Mais usados por você"
-- com "N×"). O protótipo guardava no localStorage; o app guardava favoritos e
-- recentes no localStorage do aparelho. Aqui passa a ser do PERFIL, no banco:
-- troca de aparelho não perde a lista.
--
-- • Uma linha por pessoa e ferramenta (chave 'secao/slug' do registro de
--   ferramentas, src/content/registry.tsx). Não é dado de paciente nem de
--   prontuário: é preferência de trabalho. Por isso não pede segundo fator.
-- • Só o dono lê a própria lista (RLS). Gestor e administrador não veem — o
--   uso individual de ferramenta não é indicador de desempenho.
-- • Escrita só pelas RPCs: registrar_uso_ferramenta (abre a ferramenta, conta
--   +1) e marcar_favorito_ferramenta. A contagem não se edita à mão.
-- • Chave que o registro deixar de ter continua na tabela e é ignorada pela
--   tela (o front resolve a chave contra o registro; sem casar, não aparece).
-- Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ferramenta_uso (
  perfil_id      uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  chave          text NOT NULL CHECK (chave ~ '^[a-z0-9-]{1,80}/[a-z0-9-]{1,120}$'),
  favorita       boolean NOT NULL DEFAULT false,
  favoritada_em  timestamptz,
  usos           integer NOT NULL DEFAULT 0 CHECK (usos >= 0),
  ultimo_uso_em  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (perfil_id, chave)
);

COMMENT ON TABLE public.ferramenta_uso IS
  'Favoritos e contagem de uso das ferramentas da Central, por perfil. Só o dono lê; escrita só pelas RPCs.';

CREATE INDEX IF NOT EXISTS ferramenta_uso_perfil_usos ON public.ferramenta_uso (perfil_id, usos DESC);

DROP TRIGGER IF EXISTS trg_ferramenta_uso_updated_at ON public.ferramenta_uso;
CREATE TRIGGER trg_ferramenta_uso_updated_at BEFORE UPDATE ON public.ferramenta_uso
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.ferramenta_uso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ferramenta_uso FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ferramenta_uso TO authenticated;

DROP POLICY IF EXISTS ferramenta_uso_select ON public.ferramenta_uso;
CREATE POLICY ferramenta_uso_select ON public.ferramenta_uso
  FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id());

-- ── a minha lista ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.minhas_ferramentas()
RETURNS TABLE (chave text, favorita boolean, usos integer, ultimo_uso_em timestamptz, favoritada_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := private.meu_perfil_id();
BEGIN
  IF v_eu IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
    SELECT f.chave, f.favorita, f.usos, f.ultimo_uso_em, f.favoritada_em
      FROM public.ferramenta_uso f
     WHERE f.perfil_id = v_eu
     ORDER BY f.usos DESC, f.ultimo_uso_em DESC NULLS LAST;
END $$;

-- ── abriu a ferramenta: +1 ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_uso_ferramenta(p_chave text)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_usos integer;
BEGIN
  IF v_eu IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_chave IS NULL OR p_chave !~ '^[a-z0-9-]{1,80}/[a-z0-9-]{1,120}$' THEN
    RAISE EXCEPTION 'Ferramenta inválida.';
  END IF;
  INSERT INTO public.ferramenta_uso AS f (perfil_id, chave, usos, ultimo_uso_em)
  VALUES (v_eu, p_chave, 1, now())
  ON CONFLICT (perfil_id, chave) DO UPDATE
     SET usos = f.usos + 1, ultimo_uso_em = now()
  RETURNING f.usos INTO v_usos;
  RETURN v_usos;
END $$;

-- ── favoritar / tirar dos favoritos ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_favorito_ferramenta(p_chave text, p_favorita boolean)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := private.meu_perfil_id();
BEGIN
  IF v_eu IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_chave IS NULL OR p_chave !~ '^[a-z0-9-]{1,80}/[a-z0-9-]{1,120}$' THEN
    RAISE EXCEPTION 'Ferramenta inválida.';
  END IF;
  IF p_favorita IS NULL THEN RAISE EXCEPTION 'Informe se é favorita.'; END IF;
  INSERT INTO public.ferramenta_uso AS f (perfil_id, chave, favorita, favoritada_em)
  VALUES (v_eu, p_chave, p_favorita, CASE WHEN p_favorita THEN now() END)
  ON CONFLICT (perfil_id, chave) DO UPDATE
     SET favorita = p_favorita,
         favoritada_em = CASE WHEN p_favorita THEN coalesce(f.favoritada_em, now()) END;
END $$;

REVOKE ALL ON FUNCTION public.minhas_ferramentas(), public.registrar_uso_ferramenta(text),
  public.marcar_favorito_ferramenta(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_ferramentas(), public.registrar_uso_ferramenta(text),
  public.marcar_favorito_ferramenta(text, boolean) TO authenticated;
