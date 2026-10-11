-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 2 — fila regulada. Decisões do RT em 11/10/2026 (BACKLOG.md):
--
-- • Ordem: "não classificada" no topo (o regulador classifica); depois por
--   prioridade (emergência, urgência, prioritária, eletiva) e, dentro de cada
--   nível, quem espera há mais tempo primeiro.
-- • Assumir: o regulador assume o pedido, que passa a "em análise" com o nome
--   dele; pode devolver à fila. Tudo no histórico.
-- • Filtros: tipo, prioridade, unidade de origem, status, caráter, tipo de
--   leito, isolamento e busca (nome do paciente, nº ou protocolo externo).
-- • A tela atualiza a cada 30 s (no navegador).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.regulacao_solicitacoes
  ADD COLUMN IF NOT EXISTS assumida_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS assumida_em timestamptz;

-- o detalhe passa a mostrar quem assumiu
CREATE OR REPLACE FUNCTION private.regulacao_json_fila(s public.regulacao_solicitacoes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.regulacao_json(s) || jsonb_build_object(
    'assumida_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.assumida_por),
    'assumida_por_mim', s.assumida_por IS NOT DISTINCT FROM private.meu_perfil_id() AND s.assumida_por IS NOT NULL,
    'assumida_em', s.assumida_em,
    'espera_segundos', floor(extract(epoch FROM now() - s.criada_em))::bigint)
$$;
REVOKE ALL ON FUNCTION private.regulacao_json_fila(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- ── fila ────────────────────────────────────────────────────────────────────
-- p_filtros: tipo, prioridade, unidade_origem_id, status (lista; padrão: em
-- aberto na central), carater, tipo_leito, isolamento (true/false), busca.
CREATE OR REPLACE FUNCTION public.regulacao_fila(p_central uuid, p_filtros jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_status text[];
  v_busca text := nullif(btrim(coalesce(f->>'busca', '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_central) THEN
    RAISE EXCEPTION 'Esta unidade não é uma central de regulação.';
  END IF;
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_central, 'regulador') OR private.tenho_papel(p_central, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_status := CASE WHEN jsonb_typeof(f->'status') = 'array' AND jsonb_array_length(f->'status') > 0
                   THEN ARRAY(SELECT jsonb_array_elements_text(f->'status'))
                   ELSE ARRAY['enviada', 'em_analise', 'pendencia'] END;

  RETURN jsonb_build_object(
    'dados', coalesce((
      SELECT jsonb_agg(private.regulacao_json_fila(s) ORDER BY
               (s.prioridade = 'nao_classificada') DESC,
               CASE s.prioridade WHEN 'emergencia' THEN 1 WHEN 'urgencia' THEN 2 WHEN 'prioritaria' THEN 3 WHEN 'eletiva' THEN 4 ELSE 5 END,
               s.criada_em, s.numero)
        FROM (SELECT x.* FROM public.regulacao_solicitacoes x
               LEFT JOIN public.pacientes pa ON pa.id = x.paciente_id
              WHERE x.central_id = p_central
                AND x.status = ANY (v_status)
                AND (NOT f ? 'tipo' OR x.tipo = f->>'tipo')
                AND (NOT f ? 'prioridade' OR x.prioridade = f->>'prioridade')
                AND (NOT f ? 'unidade_origem_id' OR x.unidade_origem_id = (f->>'unidade_origem_id')::uuid)
                AND (NOT f ? 'carater' OR x.carater = f->>'carater')
                AND (NOT f ? 'tipo_leito' OR x.tipo_leito = f->>'tipo_leito')
                AND (NOT f ? 'isolamento' OR x.isolamento = (f->>'isolamento')::boolean)
                AND (v_busca IS NULL
                     OR x.numero::text = v_busca
                     OR x.externo_protocolo ILIKE '%' || v_busca || '%'
                     OR coalesce(pa.nome_social, pa.nome) ILIKE '%' || v_busca || '%')
              ORDER BY x.criada_em
              LIMIT 500) s), '[]'::jsonb),
    -- contagem do que está em aberto na central, por prioridade (sem filtros)
    'resumo', coalesce((SELECT jsonb_object_agg(prioridade, n) FROM (
        SELECT prioridade, count(*) AS n FROM public.regulacao_solicitacoes
         WHERE central_id = p_central AND status IN ('enviada', 'em_analise', 'pendencia')
         GROUP BY prioridade) r), '{}'::jsonb),
    -- unidades que já mandaram pedido, para o filtro de origem
    'origens', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) ORDER BY u.nome)
        FROM public.unidades u WHERE u.id IN (SELECT DISTINCT unidade_origem_id FROM public.regulacao_solicitacoes WHERE central_id = p_central)), '[]'::jsonb),
    'agora', now());
END $$;
REVOKE ALL ON FUNCTION public.regulacao_fila(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_fila(uuid, jsonb) TO authenticated;

-- ── assumir e devolver à fila ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_assumir(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_quem text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT private.tenho_papel(s.central_id, 'regulador') THEN
    RAISE EXCEPTION 'Assume o pedido o médico regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.assumida_por IS NOT NULL AND s.assumida_por <> private.meu_perfil_id() THEN
    SELECT nome_completo INTO v_quem FROM public.perfis WHERE id = s.assumida_por;
    RAISE EXCEPTION 'Este pedido está com %.', coalesce(v_quem, 'outro regulador');
  END IF;
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia') THEN
    RAISE EXCEPTION 'Este pedido não está na fila.';
  END IF;
  UPDATE public.regulacao_solicitacoes
     SET status = CASE WHEN status = 'enviada' THEN 'em_analise' ELSE status END,
         assumida_por = private.meu_perfil_id(), assumida_em = now()
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'assumida', NULL);
  RETURN private.regulacao_json_fila(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_assumir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_assumir(uuid) TO authenticated;

-- Devolve o pedido à fila (sem decisão). Quem assumiu, ou o gestor da central.
CREATE OR REPLACE FUNCTION public.regulacao_soltar(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF s.assumida_por IS NULL THEN RAISE EXCEPTION 'Este pedido não está com ninguém.'; END IF;
  IF NOT (s.assumida_por = private.meu_perfil_id() OR private.tenho_papel(s.central_id, 'gestor')) THEN
    RAISE EXCEPTION 'Devolve à fila quem assumiu o pedido ou o gestor da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.regulacao_solicitacoes
     SET status = CASE WHEN status = 'em_analise' THEN 'enviada' ELSE status END,
         assumida_por = NULL, assumida_em = NULL
   WHERE id = s.id;
  PERFORM private.regulacao_evento(s.id, 'devolvida_a_fila',
    CASE WHEN nullif(btrim(coalesce(p_motivo, '')), '') IS NOT NULL THEN jsonb_build_object('motivo', btrim(p_motivo)) END);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_soltar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_soltar(uuid, text) TO authenticated;
