-- Aba Escala para todos os papéis, entrega E1 (decisões do RT em 27/10/2026):
-- cada plantão passa a ter categoria, e troca e passagem só valem dentro dela.
--
-- Expand (idempotente):
--   * coluna `papel` (public.papel, NULL) em escala_plantao, escala_fixa e escala_vagas.
--     Gestor e administrador não são categoria de plantão (CHECK).
--   * preenchimento: o único papel escalável da pessoa na unidade (todo papel menos
--     gestor e admin). Quem tem mais de um fica com NULL: o gestor escolhe na E2
--     (resposta 6 do RT: quem tem dois papéis é escalado escolhendo a categoria).
--     Vaga com plantão de origem herda a categoria dele.
--   * gatilho na gravação do plantão: sem categoria, herda a do plantão de origem
--     (parte de plantão fracionado) ou o papel único da pessoa; com categoria, a
--     pessoa precisa ter esse papel ativo na unidade. Isso vale também quando o
--     plantão muda de dono (troca aplicada, passagem): é a trava de categoria.
--   * gatilho no pedido de troca e no pedido de passagem: recusa já no pedido
--     quando o outro lado não é da mesma categoria, em vez de falhar só na
--     aprovação do gestor.
--   * escala_da_unidade passa a filtrar pela categoria gravada (resposta 2 do RT:
--     a própria escala e a da equipe inteira da minha categoria) e devolve `papel`.
--     Plantão ainda sem categoria conta pelo vínculo do colega, como na E0.
--
-- Fora desta entrega: seletor de categoria do gestor e geração da fixa com
-- categoria (E2); vaga e candidatura por categoria (E4). Nenhuma coluna vira
-- NOT NULL agora (contrato só com janela declarada).
--
-- Rollback (nesta ordem):
--   DROP TRIGGER IF EXISTS trg_escala_categoria ON public.escala_plantao;
--   DROP TRIGGER IF EXISTS trg_escala_fixa_categoria ON public.escala_fixa;
--   DROP TRIGGER IF EXISTS trg_escala_vagas_categoria ON public.escala_vagas;
--   DROP TRIGGER IF EXISTS trg_troca_mesma_categoria ON public.trocas_plantao;
--   DROP TRIGGER IF EXISTS trg_passagem_mesma_categoria ON public.solicitacoes_escala;
--   DROP FUNCTION IF EXISTS private.escala_categoria(), private.escala_vagas_categoria(),
--     private.troca_mesma_categoria(), private.passagem_mesma_categoria(),
--     private.papel_escalavel_unico(uuid, uuid), private.tem_papel_na_unidade(uuid, uuid, public.papel);
--   DROP FUNCTION IF EXISTS public.escala_da_unidade(uuid, date, date);
--   -- e reaplicar o corpo da 20270202000001_escala_da_unidade.sql (versão da E0)
--   ALTER TABLE public.escala_plantao DROP COLUMN IF EXISTS papel;
--   ALTER TABLE public.escala_fixa DROP COLUMN IF EXISTS papel;
--   ALTER TABLE public.escala_vagas DROP COLUMN IF EXISTS papel;

-- ── Colunas ──────────────────────────────────────────────────────────────────
ALTER TABLE public.escala_plantao ADD COLUMN IF NOT EXISTS papel public.papel;
ALTER TABLE public.escala_fixa    ADD COLUMN IF NOT EXISTS papel public.papel;
ALTER TABLE public.escala_vagas   ADD COLUMN IF NOT EXISTS papel public.papel;

ALTER TABLE public.escala_plantao DROP CONSTRAINT IF EXISTS escala_plantao_papel_escalavel;
ALTER TABLE public.escala_plantao ADD CONSTRAINT escala_plantao_papel_escalavel
  CHECK (papel IS NULL OR papel NOT IN ('admin', 'gestor'));
ALTER TABLE public.escala_fixa DROP CONSTRAINT IF EXISTS escala_fixa_papel_escalavel;
ALTER TABLE public.escala_fixa ADD CONSTRAINT escala_fixa_papel_escalavel
  CHECK (papel IS NULL OR papel NOT IN ('admin', 'gestor'));
ALTER TABLE public.escala_vagas DROP CONSTRAINT IF EXISTS escala_vagas_papel_escalavel;
ALTER TABLE public.escala_vagas ADD CONSTRAINT escala_vagas_papel_escalavel
  CHECK (papel IS NULL OR papel NOT IN ('admin', 'gestor'));

-- ── Auxiliares ───────────────────────────────────────────────────────────────
-- O papel escalável da pessoa na unidade, se for um só; NULL se nenhum ou mais de um.
CREATE OR REPLACE FUNCTION private.papel_escalavel_unico(p_unidade uuid, p_perfil uuid)
RETURNS public.papel
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE WHEN count(DISTINCT v.papel) = 1 THEN min(v.papel::text)::public.papel END
  FROM public.vinculos v
  WHERE v.unidade_id = p_unidade AND v.perfil_id = p_perfil AND v.ativo
    AND v.papel NOT IN ('admin', 'gestor');
$function$;

CREATE OR REPLACE FUNCTION private.tem_papel_na_unidade(p_unidade uuid, p_perfil uuid, p_papel public.papel)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.vinculos v
    WHERE v.unidade_id = p_unidade AND v.perfil_id = p_perfil AND v.ativo AND v.papel = p_papel
  );
$function$;

-- ── Preenchimento (antes dos gatilhos; sem disparar histórico nem aviso de vaga) ──
ALTER TABLE public.escala_plantao DISABLE TRIGGER USER;
UPDATE public.escala_plantao e
   SET papel = private.papel_escalavel_unico(e.unidade_id, e.perfil_id)
 WHERE e.papel IS NULL
   AND private.papel_escalavel_unico(e.unidade_id, e.perfil_id) IS NOT NULL;
ALTER TABLE public.escala_plantao ENABLE TRIGGER USER;

ALTER TABLE public.escala_fixa DISABLE TRIGGER USER;
UPDATE public.escala_fixa f
   SET papel = private.papel_escalavel_unico(f.unidade_id, f.perfil_id)
 WHERE f.papel IS NULL
   AND private.papel_escalavel_unico(f.unidade_id, f.perfil_id) IS NOT NULL;
ALTER TABLE public.escala_fixa ENABLE TRIGGER USER;

UPDATE public.escala_vagas g
   SET papel = o.papel
  FROM public.escala_plantao o
 WHERE g.papel IS NULL AND o.id = g.plantao_origem_id AND o.papel IS NOT NULL;

-- ── Gatilho do plantão e da fixa: preenche e trava a categoria ──────────────
CREATE OR REPLACE FUNCTION private.escala_categoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_mudou_dono boolean := true;
  v_conferir   boolean := true;
BEGIN
  -- IFs aninhados: a tabela da fixa não tem plantao_origem_id, e OLD só existe no UPDATE
  IF TG_OP = 'UPDATE' THEN
    v_mudou_dono := NEW.perfil_id IS DISTINCT FROM OLD.perfil_id;
    v_conferir := v_mudou_dono OR NEW.papel IS DISTINCT FROM OLD.papel;
  END IF;

  IF NEW.papel IS NULL THEN
    -- parte de plantão fracionado herda a categoria do plantão de origem
    IF TG_TABLE_NAME = 'escala_plantao' AND TG_OP = 'INSERT' THEN
      IF NEW.plantao_origem_id IS NOT NULL THEN
        SELECT o.papel INTO NEW.papel FROM public.escala_plantao o WHERE o.id = NEW.plantao_origem_id;
      END IF;
    END IF;
    IF NEW.papel IS NULL AND v_mudou_dono THEN
      NEW.papel := private.papel_escalavel_unico(NEW.unidade_id, NEW.perfil_id);
    END IF;
  END IF;

  IF NEW.papel IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Gestor e administrador não são categoria de plantão.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.papel IS NOT NULL AND v_conferir
     AND NOT private.tem_papel_na_unidade(NEW.unidade_id, NEW.perfil_id, NEW.papel) THEN
    RAISE EXCEPTION 'Categoria diferente: o plantão é de %, e o profissional não tem esse papel nesta unidade.',
      replace(NEW.papel::text, '_', ' ')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_escala_categoria ON public.escala_plantao;
CREATE TRIGGER trg_escala_categoria
  BEFORE INSERT OR UPDATE OF perfil_id, papel ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION private.escala_categoria();

DROP TRIGGER IF EXISTS trg_escala_fixa_categoria ON public.escala_fixa;
CREATE TRIGGER trg_escala_fixa_categoria
  BEFORE INSERT OR UPDATE OF perfil_id, papel ON public.escala_fixa
  FOR EACH ROW EXECUTE FUNCTION private.escala_categoria();

-- ── Gatilho da vaga: herda a categoria do plantão de origem ────────────────
CREATE OR REPLACE FUNCTION private.escala_vagas_categoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.papel IS NULL AND NEW.plantao_origem_id IS NOT NULL THEN
    SELECT o.papel INTO NEW.papel FROM public.escala_plantao o WHERE o.id = NEW.plantao_origem_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_escala_vagas_categoria ON public.escala_vagas;
CREATE TRIGGER trg_escala_vagas_categoria
  BEFORE INSERT ON public.escala_vagas
  FOR EACH ROW EXECUTE FUNCTION private.escala_vagas_categoria();

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
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_troca_mesma_categoria ON public.trocas_plantao;
CREATE TRIGGER trg_troca_mesma_categoria
  BEFORE INSERT ON public.trocas_plantao
  FOR EACH ROW EXECUTE FUNCTION private.troca_mesma_categoria();

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
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_passagem_mesma_categoria ON public.solicitacoes_escala;
CREATE TRIGGER trg_passagem_mesma_categoria
  BEFORE INSERT ON public.solicitacoes_escala
  FOR EACH ROW EXECUTE FUNCTION private.passagem_mesma_categoria();

REVOKE ALL ON FUNCTION private.papel_escalavel_unico(uuid, uuid), private.tem_papel_na_unidade(uuid, uuid, public.papel),
  private.escala_categoria(), private.escala_vagas_categoria(), private.troca_mesma_categoria(),
  private.passagem_mesma_categoria() FROM PUBLIC, anon, authenticated;

-- ── escala_da_unidade: a equipe é a da minha categoria ─────────────────────
-- O tipo de retorno ganha `papel`, por isso DROP + CREATE (na mesma transação).
DROP FUNCTION IF EXISTS public.escala_da_unidade(uuid, date, date);
CREATE FUNCTION public.escala_da_unidade(p_unidade uuid, p_de date, p_ate date)
RETURNS TABLE (
  id                uuid,
  unidade_id        uuid,
  setor_id          uuid,
  perfil_id         uuid,
  papel             public.papel,
  data              date,
  turno             text,
  inicio            timestamptz,
  duracao_min       integer,
  rotulo            text,
  observacao        text,
  quinzenal         boolean,
  fracionado        boolean,
  plantao_origem_id uuid,
  nome_completo     text,
  crm               text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_eu      uuid := private.meu_perfil_id();
  v_tudo    boolean;
  v_papeis  public.papel[];
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: entre no app.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_unidade IS NULL OR p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN
    RAISE EXCEPTION 'Informe a unidade e o período.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_ate - p_de > 62 THEN
    RAISE EXCEPTION 'Período maior que 62 dias.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_tudo := private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor';
  IF NOT v_tudo AND NOT EXISTS (
    SELECT 1 FROM public.vinculos v
    WHERE v.perfil_id = v_eu AND v.unidade_id = p_unidade AND v.ativo
  ) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com esta unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- minhas categorias na unidade (todo papel menos gestor e admin)
  SELECT coalesce(array_agg(DISTINCT v.papel), '{}') INTO v_papeis
  FROM public.vinculos v
  WHERE v.perfil_id = v_eu AND v.unidade_id = p_unidade AND v.ativo
    AND v.papel NOT IN ('admin', 'gestor');

  RETURN QUERY
  SELECT e.id, e.unidade_id, e.setor_id, e.perfil_id, e.papel, e.data, e.turno, e.inicio, e.duracao_min,
         e.rotulo,
         CASE WHEN v_tudo OR e.perfil_id = v_eu THEN e.observacao END,
         e.quinzenal, e.fracionado, e.plantao_origem_id,
         p.nome_completo, p.crm
  FROM public.escala_plantao e
  LEFT JOIN public.perfis p ON p.id = e.perfil_id
  WHERE e.unidade_id = p_unidade
    AND e.ativo
    AND e.data BETWEEN p_de AND p_ate
    AND (
      v_tudo
      OR e.perfil_id = v_eu
      OR e.papel = ANY (v_papeis)
      -- plantão ainda sem categoria: conta pelo vínculo do colega
      OR (e.papel IS NULL AND EXISTS (
        SELECT 1 FROM public.vinculos c
        WHERE c.perfil_id = e.perfil_id AND c.unidade_id = p_unidade AND c.ativo
          AND c.papel = ANY (v_papeis)
      ))
    )
  ORDER BY e.data, e.inicio NULLS LAST, e.setor_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.escala_da_unidade(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escala_da_unidade(uuid, date, date) TO authenticated;
