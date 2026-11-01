-- ════════════════════════════════════════════════════════════════════════════
-- Médio M7 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md),
-- decisão do RT em 31/10/2026 (opção A, "Categoria em comum",
-- docs/escala/PROPOSTAS-MEDIOS-M2-M7-M9.md): o plantão sem categoria
-- (papel NULL, que a E1 deixa para quem tem duas categorias) pulava a trava de
-- troca e passagem dentro da categoria.
--
-- Correção:
--  1. enquanto o plantão não tiver categoria, troca e passagem só valem com quem
--     tem alguma categoria em comum com o dono na unidade (os gatilhos da E1,
--     private.troca_mesma_categoria e private.passagem_mesma_categoria, ganham o
--     ramo do plantão sem categoria; o ramo com categoria não muda);
--  2. public.definir_categoria_plantoes(plantões, papel): o gestor da unidade
--     (ou o super admin) escolhe a categoria de um ou de vários plantões de uma
--     vez; o gatilho da E1 confere que a pessoa tem o papel. É o atalho do aviso
--     "N plantões sem categoria" do mês do gestor (mesmo PR).
-- Expand: funções novas e corpos novos das duas funções de gatilho (mesmos
-- gatilhos); sem DROP/RENAME de coluna. Idempotente.
-- Teste: supabase/tests/escala_sem_categoria.sql
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.definir_categoria_plantoes(uuid[], public.papel);
--   reaplicar private.troca_mesma_categoria e private.passagem_mesma_categoria de
--   20270202000002_escala_categoria.sql;
--   DROP FUNCTION IF EXISTS private.categoria_em_comum(uuid, uuid, uuid);
-- ════════════════════════════════════════════════════════════════════════════

-- as duas pessoas têm alguma categoria (papel escalável) em comum na unidade?
CREATE OR REPLACE FUNCTION private.categoria_em_comum(p_unidade uuid, p_perfil_a uuid, p_perfil_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.vinculos a
      JOIN public.vinculos b ON b.unidade_id = a.unidade_id AND b.papel = a.papel AND b.ativo
     WHERE a.unidade_id = p_unidade AND a.perfil_id = p_perfil_a AND a.ativo
       AND b.perfil_id = p_perfil_b AND a.papel NOT IN ('admin', 'gestor')
  );
$function$;
REVOKE ALL ON FUNCTION private.categoria_em_comum(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── Pedido de troca: os dois lados da mesma categoria ──────────────────────
CREATE OR REPLACE FUNCTION private.troca_mesma_categoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_a public.escala_plantao%ROWTYPE;
  v_b public.escala_plantao%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.escala_plantao WHERE id = NEW.plantao_a_id;
  SELECT * INTO v_b FROM public.escala_plantao WHERE id = NEW.plantao_b_id;
  IF (v_a.papel IS NOT NULL AND NOT private.tem_papel_na_unidade(v_a.unidade_id, v_b.perfil_id, v_a.papel))
     OR (v_b.papel IS NOT NULL AND NOT private.tem_papel_na_unidade(v_b.unidade_id, v_a.perfil_id, v_b.papel)) THEN
    RAISE EXCEPTION 'Troca só entre a mesma categoria: os dois plantões precisam ser da mesma categoria (% e %).',
      coalesce(replace(v_a.papel::text, '_', ' '), 'sem categoria'), coalesce(replace(v_b.papel::text, '_', ' '), 'sem categoria')
      USING ERRCODE = 'check_violation';
  END IF;
  -- M7: plantão sem categoria, só com quem tem categoria em comum com o dono
  IF (v_a.papel IS NULL OR v_b.papel IS NULL)
     AND NOT private.categoria_em_comum(v_a.unidade_id, v_a.perfil_id, v_b.perfil_id) THEN
    RAISE EXCEPTION 'Plantão sem categoria: a troca só vale com quem tem uma categoria em comum com o dono nesta unidade. Peça à coordenação para definir a categoria deste plantão.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

-- ── Pedido de passagem: o destino tem a categoria do plantão ───────────────
CREATE OR REPLACE FUNCTION private.passagem_mesma_categoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_pl public.escala_plantao%ROWTYPE;
BEGIN
  IF NEW.tipo = 'passar_plantao' AND NEW.destino_perfil_id IS NOT NULL THEN
    SELECT * INTO v_pl FROM public.escala_plantao WHERE id = NEW.escala_plantao_id;
    IF v_pl.papel IS NOT NULL AND NOT private.tem_papel_na_unidade(v_pl.unidade_id, NEW.destino_perfil_id, v_pl.papel) THEN
      RAISE EXCEPTION 'Passagem só para a mesma categoria: o plantão é de %, e o destino não tem esse papel nesta unidade.',
        replace(v_pl.papel::text, '_', ' ')
        USING ERRCODE = 'check_violation';
    END IF;
    -- M7: plantão sem categoria, só para quem tem categoria em comum com o dono
    IF v_pl.papel IS NULL AND NOT private.categoria_em_comum(v_pl.unidade_id, v_pl.perfil_id, NEW.destino_perfil_id) THEN
      RAISE EXCEPTION 'Plantão sem categoria: a passagem só vale para quem tem uma categoria em comum com você nesta unidade. Peça à coordenação para definir a categoria deste plantão.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.troca_mesma_categoria(), private.passagem_mesma_categoria() FROM PUBLIC, anon, authenticated;

-- ── O gestor escolhe a categoria de um ou de vários plantões ────────────────
CREATE OR REPLACE FUNCTION public.definir_categoria_plantoes(p_plantoes uuid[], p_papel public.papel)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_unidade uuid;
  v_n integer;
BEGIN
  IF p_plantoes IS NULL OR cardinality(p_plantoes) = 0 OR p_papel IS NULL THEN
    RAISE EXCEPTION 'Informe os plantões e a categoria.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF (SELECT count(DISTINCT e.unidade_id) FROM public.escala_plantao e WHERE e.id = ANY (p_plantoes)) <> 1 THEN
    RAISE EXCEPTION 'Os plantões precisam ser de uma unidade só.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT e.unidade_id INTO v_unidade FROM public.escala_plantao e WHERE e.id = ANY (p_plantoes) LIMIT 1;
  IF (private.eh_super_admin() OR private.papel_na_unidade(v_unidade) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor define a categoria do plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- o gatilho trg_escala_categoria confere que a pessoa tem o papel (e grava o histórico)
  UPDATE public.escala_plantao e SET papel = p_papel
   WHERE e.id = ANY (p_plantoes) AND e.papel IS DISTINCT FROM p_papel;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.definir_categoria_plantoes(uuid[], public.papel) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_categoria_plantoes(uuid[], public.papel) TO authenticated;
