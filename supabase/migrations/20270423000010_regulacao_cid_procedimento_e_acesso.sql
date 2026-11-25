-- ════════════════════════════════════════════════════════════════════════════
-- Regulação: CID compatível com o procedimento, aviso do pedido novo e o que o
-- regulador precisa ver (pedidos do RT de 24/11/2026, revisão dos perfis
-- Médico regulador e NIR).
--
-- 1. CID × procedimento (SIGTAP): quando o procedimento tem lista de CID no
--    SIGTAP (terminologia.sigtap_procedimento_cid, competência mais nova do
--    procedimento), o CID do pedido precisa estar nela. Gatilho em
--    public.regulacao_solicitacoes (entrada e troca de CID ou procedimento):
--    cobre regulacao_solicitar, o reenvio do pedido devolvido e a entrada pela
--    API, sem copiar o corpo das funções. Procedimento sem lista: livre, como
--    antes. A mensagem é a mesma da tela.
--    public.regulacao_cids_do_procedimento: a lista para a busca do CID na
--    tela (só leitura; terminologia pública do DATASUS) e se um CID está nela.
-- 2. Aviso do pedido novo: ao entrar um pedido enviado, "Novo pedido de
--    regulação nº N" vai ao gestor e ao NIR da unidade de origem e aos
--    reguladores da central do pedido (public.notificacoes_plantonista, a
--    mesma dos outros avisos da regulação; tipo reg_novo_<nº>). Quem abriu o
--    pedido não recebe.
-- 3. Regulador:
--    • regulacao_sla_painel numa unidade de origem aceita o regulador
--      vinculado a ela, mas só com os pedidos que vão a uma central onde ele é
--      regulador (antes: "Acesso negado" para quem só tinha esse papel ali).
--    • public.aih_internados_sem_laudo: os internados da unidade sem AIH
--      solicitada nem aprovada (leito e desde quando), para a AIH do
--      regulador e do gestor. O regulador não lê public.internacoes (a
--      política continua gestor ou escala); recebe só isto, sem o nome do
--      paciente, que vai só ao gestor.
--
-- Expand: funções e gatilhos novos; regulacao_sla_painel trocada (CREATE OR
-- REPLACE, mesma assinatura). Nenhuma tabela nem coluna muda. Idempotente.
-- Teste: supabase/tests/regulacao_cid_procedimento.sql (BEGIN … ROLLBACK).
-- Volta: docs/regulacao/ROLLBACK-20270423000010.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. CID × procedimento ───────────────────────────────────────────────────
-- Verdadeiro quando o procedimento não tem lista de CID (competência mais nova
-- dele) ou quando o CID está na lista.
CREATE OR REPLACE FUNCTION private.regulacao_cid_compativel(p_procedimento text, p_cid text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH lista AS (
    SELECT r.cid FROM terminologia.sigtap_procedimento_cid r
     WHERE r.procedimento = p_procedimento
       AND r.competencia = (SELECT max(x.competencia) FROM terminologia.sigtap_procedimento_cid x WHERE x.procedimento = p_procedimento))
  SELECT NOT EXISTS (SELECT 1 FROM lista)
      OR EXISTS (SELECT 1 FROM lista l WHERE l.cid = coalesce(private.cid_normalizado(p_cid), upper(btrim(coalesce(p_cid, '')))))
$$;
REVOKE ALL ON FUNCTION private.regulacao_cid_compativel(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.regulacao_conferir_cid_procedimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- na troca, só confere quando o CID ou o procedimento mudou (pedidos antigos seguem como estão)
  IF TG_OP = 'UPDATE' AND NEW.cid IS NOT DISTINCT FROM OLD.cid AND NEW.procedimento IS NOT DISTINCT FROM OLD.procedimento THEN
    RETURN NEW;
  END IF;
  IF NEW.procedimento IS NOT NULL AND NEW.cid IS NOT NULL AND NOT private.regulacao_cid_compativel(NEW.procedimento, NEW.cid) THEN
    -- sem ERRCODE de check_violation: regulacao_solicitar troca essa mensagem por uma genérica
    RAISE EXCEPTION 'O CID % não é compatível com o procedimento % no SIGTAP. Escolha um CID da lista do procedimento ou troque o procedimento.',
      NEW.cid, NEW.procedimento;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_conferir_cid_procedimento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_regulacao_cid_procedimento ON public.regulacao_solicitacoes;
CREATE TRIGGER trg_regulacao_cid_procedimento
  BEFORE INSERT OR UPDATE OF cid, procedimento ON public.regulacao_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION private.regulacao_conferir_cid_procedimento();

-- Lista de CID do procedimento para a busca da tela: tem_lista (o procedimento
-- tem CID no SIGTAP), total, se p_cid está na lista (compativel; NULL sem
-- p_cid ou sem lista) e os itens (principal primeiro), com busca por código ou
-- descrição.
CREATE OR REPLACE FUNCTION public.regulacao_cids_do_procedimento(p_procedimento text, p_termo text DEFAULT NULL,
  p_cid text DEFAULT NULL, p_limite integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_proc text := nullif(regexp_replace(coalesce(p_procedimento, ''), '\D', '', 'g'), '');
  v_cid text := coalesce(private.cid_normalizado(p_cid), nullif(upper(btrim(coalesce(p_cid, ''))), ''));
  v_termo text := nullif(btrim(coalesce(p_termo, '')), '');
  v_comp text;
BEGIN
  IF v_proc IS NOT NULL THEN
    SELECT max(r.competencia) INTO v_comp FROM terminologia.sigtap_procedimento_cid r WHERE r.procedimento = v_proc;
  END IF;
  IF v_comp IS NULL THEN
    RETURN jsonb_build_object('procedimento', v_proc, 'tem_lista', false, 'competencia', NULL, 'total', 0,
      'compativel', NULL, 'principal', NULL, 'itens', '[]'::jsonb);
  END IF;
  RETURN (
    WITH lista AS (
      SELECT r.cid, r.principal, coalesce(c.descricao, r.cid) AS descricao
        FROM terminologia.sigtap_procedimento_cid r
        LEFT JOIN terminologia.cid10 c ON c.codigo = r.cid
       WHERE r.procedimento = v_proc AND r.competencia = v_comp
    ), achados AS (
      SELECT l.* FROM lista l
       WHERE v_termo IS NULL
          OR replace(l.cid, '.', '') LIKE upper(replace(v_termo, '.', '')) || '%'
          OR terminologia.unaccent_text(lower(l.descricao)) LIKE '%' || terminologia.unaccent_text(lower(v_termo)) || '%'
       ORDER BY l.principal DESC, l.cid
       LIMIT greatest(1, least(coalesce(p_limite, 50), 200))
    )
    SELECT jsonb_build_object(
      'procedimento', v_proc, 'tem_lista', true, 'competencia', v_comp,
      'total', (SELECT count(*) FROM lista),
      'compativel', CASE WHEN v_cid IS NULL THEN NULL ELSE EXISTS (SELECT 1 FROM lista WHERE cid = v_cid) END,
      'principal', (SELECT principal FROM lista WHERE cid = v_cid),
      'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('codigo', a.cid, 'descricao', a.descricao, 'principal', a.principal)
                                          ORDER BY a.principal DESC, a.cid) FROM achados a), '[]'::jsonb)));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_cids_do_procedimento(text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_cids_do_procedimento(text, text, text, integer) TO authenticated;

-- ── 2. aviso do pedido novo ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_avisar_novo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT v.perfil_id, v.unidade_id, current_date, 'reg_novo_' || NEW.numero,
         CASE WHEN v.unidade_id = NEW.central_id
              THEN 'Novo pedido de regulação nº ' || NEW.numero || ' de ' || coalesce(uo.nome, 'unidade de origem') || '.'
              ELSE 'Novo pedido de regulação nº ' || NEW.numero || ' enviado à central.' END
    FROM public.vinculos v
    LEFT JOIN public.unidades uo ON uo.id = NEW.unidade_origem_id
   WHERE v.ativo
     AND v.perfil_id IS DISTINCT FROM NEW.solicitante_id
     AND ((v.unidade_id = NEW.unidade_origem_id AND v.papel IN ('gestor', 'nir'))
       OR (v.unidade_id = NEW.central_id AND v.papel = 'regulador'))
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_avisar_novo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_regulacao_avisar_novo ON public.regulacao_solicitacoes;
CREATE TRIGGER trg_regulacao_avisar_novo
  AFTER INSERT ON public.regulacao_solicitacoes
  FOR EACH ROW WHEN (NEW.status = 'enviada')
  EXECUTE FUNCTION private.regulacao_avisar_novo();

-- ── 3a. painel de prazos: o regulador vinculado à unidade de origem ─────────
-- Igual à 20270421000012, mais: numa unidade de origem, quem só é regulador
-- ali vê os pedidos dela que vão a uma central onde ele é regulador.
CREATE OR REPLACE FUNCTION public.regulacao_sla_painel(p_unidade uuid, p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_central boolean;
  v_ref uuid;
  v_so_regulador boolean := false;
  v_so_atrasados boolean := coalesce((f->>'so_atrasados')::boolean, false);
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_central := private.regulacao_eh_central(p_unidade);
  IF v_central THEN
    IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'regulador') OR private.tenho_papel(p_unidade, 'gestor')) THEN
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NOT (private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor') OR private.sou_nir(p_unidade)) THEN
    IF NOT private.tenho_papel(p_unidade, 'regulador') THEN
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    v_so_regulador := true;
  END IF;
  v_ref := private.regulacao_central_referencia(p_unidade);

  RETURN (
    WITH base AS (
      SELECT s, private.regulacao_sla(s) AS sla
        FROM public.regulacao_solicitacoes s
       WHERE s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino')
         AND ((v_central AND s.central_id = p_unidade) OR (NOT v_central AND s.unidade_origem_id = p_unidade))
         AND (NOT v_so_regulador OR private.tenho_papel(s.central_id, 'regulador'))
    ), filtrada AS (
      SELECT b.* FROM base b
       WHERE (NOT f ? 'tipo' OR (b.s).tipo = f->>'tipo')
         AND (NOT f ? 'prioridade' OR coalesce((b.s).prioridade_regulador, (b.s).prioridade) = f->>'prioridade')
         AND (NOT v_so_atrasados OR (b.sla->>'atrasado_central')::boolean OR (b.sla->>'atrasado_origem')::boolean
              OR (b.sla->>'atrasado_destino')::boolean)
    )
    SELECT jsonb_build_object(
      'central', v_central,
      'dados', coalesce((SELECT jsonb_agg(private.regulacao_json_fila(x.s) ORDER BY
                 CASE WHEN v_central THEN (x.sla->>'atrasado_central')::boolean OR (x.sla->>'atrasado_destino')::boolean
                      ELSE (x.sla->>'atrasado_origem')::boolean END DESC,
                 ((x.sla->>'atrasado_central')::boolean OR (x.sla->>'atrasado_origem')::boolean OR (x.sla->>'atrasado_destino')::boolean) DESC,
                 CASE coalesce((x.s).prioridade_regulador, (x.s).prioridade)
                   WHEN 'emergencia' THEN 1 WHEN 'urgencia' THEN 2 WHEN 'prioritaria' THEN 3 WHEN 'eletiva' THEN 4 ELSE 5 END,
                 (x.s).criada_em)
          FROM (SELECT * FROM filtrada LIMIT 500) x), '[]'::jsonb),
      'resumo', (SELECT jsonb_build_object(
          'abertos', count(*),
          'fila_atrasada', count(*) FILTER (WHERE (b.sla->>'atrasado_central')::boolean),
          'fila_sem_prazo', count(*) FILTER (WHERE b.sla->'fila'->'prazo_min' = 'null'::jsonb),
          'fila_prazo_tipo', count(*) FILTER (WHERE b.sla->'fila'->>'prazo_por' = 'tipo'),
          'pendencia_atrasada', count(*) FILTER (WHERE (b.sla->'pendencia'->>'atrasada')::boolean),
          'evolucao_atrasada', count(*) FILTER (WHERE (b.sla->'evolucao'->>'atrasada')::boolean),
          'risco_cancelamento', count(*) FILTER (WHERE (b.sla->'evolucao'->>'risco_cancelamento')::boolean),
          'destino_atrasado', count(*) FILTER (WHERE (b.sla->>'atrasado_destino')::boolean))
        FROM base b),
      'prazos', private.regulacao_prazos_json(v_ref)
                || jsonb_build_object('por_tipo', CASE WHEN v_ref IS NULL THEN '{}'::jsonb ELSE private.regulacao_prazos_tipo_json(v_ref) END),
      'agora', now()));
END $function$;

-- ── 3b. internados sem laudo de AIH (AIH do regulador e do gestor) ──────────
CREATE OR REPLACE FUNCTION public.aih_internados_sem_laudo(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_gestor boolean := private.tenho_papel(p_unidade, 'gestor');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (v_gestor OR private.tenho_papel(p_unidade, 'regulador') OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', i.id, 'leito', l.identificador, 'desde', coalesce(i.internado_em, i.data_admissao),
             -- o nome só para o gestor (quem cobra o laudo); o regulador vê leito e tempo
             'paciente', CASE WHEN v_gestor THEN coalesce(nullif(btrim(p.nome_social), ''), p.nome) END)
           ORDER BY coalesce(i.internado_em, i.data_admissao))
      FROM public.internacoes i
      LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
      LEFT JOIN public.pacientes p ON p.id = i.paciente_id
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'internado')
       AND NOT EXISTS (SELECT 1 FROM public.aihs a WHERE a.internacao_id = i.id AND a.status IN ('solicitada', 'aprovada'))),
    '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.aih_internados_sem_laudo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aih_internados_sem_laudo(uuid) TO authenticated;
