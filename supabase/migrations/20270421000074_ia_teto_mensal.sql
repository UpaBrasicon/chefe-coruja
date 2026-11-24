-- ════════════════════════════════════════════════════════════════════════════
-- Ajustes da revisão (RT, 24/11/2026), item 5: teto mensal da IA em Servidores.
--
-- O administrador geral define um teto mensal de gasto da IA, em dólar (a
-- mesma moeda do custo estimado de ia_custo_busca_mes, E6). Sem valor padrão:
-- enquanto ninguém define, não há teto.
--   • private.ia_teto_mensal: uma linha só (id = 1), com quem definiu e quando.
--     RLS ligada e sem grant: só as RPCs abaixo leem e gravam;
--   • public.ia_teto_mensal(): o teto atual (vazio se não há), só para o
--     administrador geral (os outros, 42501, como no custo);
--   • public.definir_ia_teto_mensal(p_usd): grava o teto; nulo tira o teto.
--     Só o administrador geral, com o segundo fator e linha na auditoria.
-- O teto é só referência na tela: nada bloqueia a IA quando passa dele.
--
-- Expand puro: tabela e funções novas.
-- ROLLBACK (na ordem):
--   DROP FUNCTION IF EXISTS public.definir_ia_teto_mensal(numeric);
--   DROP FUNCTION IF EXISTS public.ia_teto_mensal();
--   DROP TABLE IF EXISTS private.ia_teto_mensal;
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS private.ia_teto_mensal (
  id            smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  usd           numeric(12, 2) NOT NULL CHECK (usd > 0 AND usd <= 1000000),
  definido_por  uuid        REFERENCES public.perfis(id),
  definido_em   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE private.ia_teto_mensal IS
  'Ajustes da revisão, item 5: teto mensal de gasto da IA (USD), definido pelo administrador geral. Uma linha só.';
ALTER TABLE private.ia_teto_mensal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ia_teto_mensal FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ia_teto_mensal()
RETURNS TABLE (usd numeric, definido_em timestamptz, definido_por text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT coalesce(private.eh_super_admin(), false) THEN
    RAISE EXCEPTION 'Só o administrador geral vê o teto da IA.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT t.usd, t.definido_em, (SELECT p.nome_completo FROM public.perfis p WHERE p.id = t.definido_por)
    FROM private.ia_teto_mensal t;
END $$;
REVOKE ALL ON FUNCTION public.ia_teto_mensal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ia_teto_mensal() TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_ia_teto_mensal(p_usd numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.eh_super_admin(), false) THEN
    RAISE EXCEPTION 'Só o administrador geral define o teto da IA.' USING ERRCODE = '42501';
  END IF;
  IF p_usd IS NULL THEN
    DELETE FROM private.ia_teto_mensal WHERE id = 1;
  ELSE
    IF p_usd <= 0 OR p_usd > 1000000 THEN
      RAISE EXCEPTION 'O teto precisa ser maior que zero (em dólar).';
    END IF;
    INSERT INTO private.ia_teto_mensal (id, usd, definido_por, definido_em)
    VALUES (1, round(p_usd, 2), private.meu_perfil_id(), now())
    ON CONFLICT (id) DO UPDATE SET usd = EXCLUDED.usd, definido_por = EXCLUDED.definido_por, definido_em = EXCLUDED.definido_em;
  END IF;
  PERFORM private.registrar_auditoria('definir_ia_teto_mensal', 'ia_teto_mensal', NULL, NULL,
    jsonb_build_object('limite', round(p_usd, 2)));
END $$;
REVOKE ALL ON FUNCTION public.definir_ia_teto_mensal(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_ia_teto_mensal(numeric) TO authenticated;
