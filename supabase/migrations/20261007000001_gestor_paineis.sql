-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 8 — telas do gestor, parte 2 (leituras).
--
--  * farmacia_do_gestor: a aba Farmácia do gestor (P/index.html 7335–7431).
--    O gestor vê a CONSEQUÊNCIA do trabalho da farmácia: o que o plantão e o
--    farmacêutico sinalizaram (faltas abertas e as repostas da última semana)
--    e o estoque informado, com o selo de public.disponibilidade (a
--    regra é uma só, da farmácia). Validação e diluição continuam do farmacêutico;
--    o gestor não escreve nada aqui.
--  * revisao_clinica_panorama: a Revisão Clínica vista pelo gestor. A decisão
--    continua só do responsável técnico médico nomeado pela rede (fase 5); o
--    gestor da unidade vê, ferramenta a ferramenta, quem conferiu (nome e
--    CRM), o que está aguardando e a correção apontada, e a camada da unidade.
--  * mapa_leitos_gestor: a aba Setores da Unidade (P/index.html 7446–7520,
--    D11): ocupação por setor com o limite de 85%, pacientes por plantonista
--    escalado agora, pendências vencidas e escores em banda de alerta, e o
--    mapa de leitos. O gestor lê por leito: nome de paciente não entra.
--
-- Tudo aqui é leitura por RPC (SECURITY DEFINER, search_path vazio), com o
-- segundo fator e o papel conferidos no banco. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. farmácia do gestor ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.farmacia_do_gestor(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: tela do gestor da unidade.';
  END IF;
  RETURN jsonb_build_object(
    'faltas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', f.id, 'medicamento', m.principio_ativo, 'apresentacao', m.apresentacao,
               'situacao', f.situacao, 'observacao', f.observacao,
               'sinalizada_por', ps.nome_completo, 'sinalizada_em', f.sinalizada_em,
               'atualizada_por', pa.nome_completo, 'atualizada_em', f.atualizada_em)
             ORDER BY CASE f.situacao WHEN 'registrada' THEN 0 WHEN 'em_cotacao' THEN 1 ELSE 2 END, f.sinalizada_em DESC)
        FROM public.faltas_medicamento f
        JOIN public.medicamento m ON m.id = f.medicamento_id
        LEFT JOIN public.perfis ps ON ps.id = f.sinalizada_por
        LEFT JOIN public.perfis pa ON pa.id = f.atualizada_por
       WHERE f.unidade_id = p_unidade
         AND (f.situacao <> 'reposta' OR coalesce(f.atualizada_em, f.sinalizada_em) > now() - interval '7 days')), '[]'::jsonb),
    -- o selo vem de public.disponibilidade (regra única, dona da farmácia:
    -- limite do item ou, sem ele, o padrão da unidade); só itens informados
    'estoque', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'medicamento_id', d.medicamento_id, 'medicamento', d.principio_ativo, 'apresentacao', d.apresentacao,
               'quantidade', d.quantidade, 'limite_critico', d.limite_critico, 'limite_falta', d.limite_falta,
               'situacao', d.situacao, 'atualizado_por', pe.nome_completo, 'atualizado_em', d.atualizado_em)
             ORDER BY CASE d.situacao WHEN 'falta' THEN 0 WHEN 'critico' THEN 1 ELSE 2 END, d.principio_ativo)
        FROM public.disponibilidade(p_unidade) d
        LEFT JOIN public.estoque_medicamento e ON e.unidade_id = p_unidade AND e.medicamento_id = d.medicamento_id
        LEFT JOIN public.perfis pe ON pe.id = e.atualizado_por
       WHERE d.quantidade IS NOT NULL), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.farmacia_do_gestor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.farmacia_do_gestor(uuid) TO authenticated;

-- ── 2. revisão clínica vista pelo gestor ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revisao_clinica_panorama(p_unidade uuid)
RETURNS TABLE (ferramenta_id text, titulo text, versao_vigente text, versao_ultima text, status_ultima text,
               publico text, fontes jsonb, decidida_por text, decisao_registro text, decidida_em timestamptz,
               decisao_nota text, pendentes int, oculta boolean, nota_local text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE
     OR NOT (private.gestor_da_unidade(p_unidade) OR (private.responsavel_tecnico('medico')).id IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado: tela do gestor da unidade ou do responsável técnico.';
  END IF;
  RETURN QUERY
  SELECT f.id, f.titulo,
         (SELECT a.versao FROM public.ferramenta_versoes a WHERE a.ferramenta_id = f.id AND a.status = 'aprovada'),
         u.versao, u.status, u.publico, u.fontes, pd.nome_completo, u.decisao_registro, u.decidida_em, u.decisao_nota,
         (SELECT count(*)::int FROM public.ferramenta_versoes a WHERE a.ferramenta_id = f.id AND a.status = 'aguardando_aprovacao'),
         coalesce(fu.oculta, false), fu.nota_local
    FROM public.ferramentas_clinicas f
    LEFT JOIN LATERAL (SELECT v.* FROM public.ferramenta_versoes v WHERE v.ferramenta_id = f.id
                        ORDER BY v.registrada_em DESC, v.versao DESC LIMIT 1) u ON true
    LEFT JOIN public.perfis pd ON pd.id = u.decidida_por
    LEFT JOIN public.ferramenta_unidade fu ON fu.ferramenta_id = f.id AND fu.unidade_id = p_unidade AND fu.vigente_ate IS NULL
   ORDER BY f.titulo;
END $$;
REVOKE ALL ON FUNCTION public.revisao_clinica_panorama(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revisao_clinica_panorama(uuid) TO authenticated;

-- ── 3. mapa de leitos do gestor ─────────────────────────────────────────────
-- Internação ativa: sem alta e ainda internada ou em observação. O leito conta
-- como ocupado pelo status do leito OU por uma internação ativa nele.
CREATE OR REPLACE FUNCTION public.mapa_leitos_gestor(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: tela do gestor da unidade.';
  END IF;

  WITH ativas AS (
    SELECT i.id, i.paciente_id, i.setor_atual_id AS setor_id, i.leito_atual_id AS leito_id,
           coalesce(i.data_entrada_setor, i.data_admissao) AS desde
      FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.data_alta IS NULL AND i.status IN ('internado', 'em_observacao')
  ), vencidas AS (
    SELECT pe.internacao_id, pe.descricao, pe.tipo, pe.prazo
      FROM public.pendencias pe
     WHERE pe.unidade_id = p_unidade AND pe.situacao = 'aberta' AND pe.prazo IS NOT NULL AND pe.prazo < now()
  ), escores AS (
    SELECT DISTINCT ON (a.paciente_id) a.paciente_id, a.escala, a.total, a.banda, a.aferido_em
      FROM public.acuidade_afericoes a
     WHERE a.unidade_id = p_unidade AND a.aferido_em > now() - interval '24 hours'
     ORDER BY a.paciente_id, a.aferido_em DESC
  ), setores AS (
    SELECT s.id, s.nome, s.tipo::text AS tipo, s.ordem
      FROM public.setores s
     WHERE s.unidade_id = p_unidade AND s.ativo AND s.tipo IN ('internacao', 'observacao')
  ), leitos AS (
    SELECT l.id, l.setor_id, l.identificador, l.status::text AS status, at.id AS internacao_id, at.paciente_id, at.desde
      FROM public.leitos l
      JOIN setores s ON s.id = l.setor_id
      LEFT JOIN ativas at ON at.leito_id = l.id
     WHERE l.ativo
  )
  SELECT jsonb_build_object(
    'gerado_em', now(),
    'limite', 0.85,
    'setores', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id, 'nome', s.nome, 'tipo', s.tipo,
               'leitos_total', (SELECT count(*) FROM leitos l WHERE l.setor_id = s.id),
               'leitos_ocupados', (SELECT count(*) FROM leitos l WHERE l.setor_id = s.id AND (l.status = 'ocupado' OR l.internacao_id IS NOT NULL)),
               'pacientes', (SELECT count(*) FROM ativas a WHERE a.setor_id = s.id),
               'sem_leito', (SELECT count(*) FROM ativas a WHERE a.setor_id = s.id AND a.leito_id IS NULL),
               'leitos', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                     'id', l.id, 'identificador', l.identificador, 'status', l.status,
                                     'ocupado', l.status = 'ocupado' OR l.internacao_id IS NOT NULL,
                                     'internacao_id', l.internacao_id, 'paciente_id', l.paciente_id, 'desde', l.desde,
                                     'vencidas', (SELECT count(*) FROM vencidas vv WHERE vv.internacao_id = l.internacao_id),
                                     'banda', (SELECT e.banda FROM escores e WHERE e.paciente_id = l.paciente_id))
                                   ORDER BY l.identificador)
                                   FROM leitos l WHERE l.setor_id = s.id), '[]'::jsonb))
             ORDER BY s.ordem, s.nome)
        FROM setores s), '[]'::jsonb),
    -- quem está escalado agora nos setores de internação e observação, e
    -- quantos pacientes ativos o setor tem
    'plantonistas', coalesce((
      SELECT jsonb_agg(x ORDER BY (x ->> 'pacientes')::int DESC, x ->> 'nome')
        FROM (SELECT DISTINCT ON (e.perfil_id, e.setor_id)
                     jsonb_build_object('perfil_id', e.perfil_id, 'nome', p.nome_completo, 'setor', s.nome,
                                        'ate', e.inicio + make_interval(mins => e.duracao_min),
                                        'pacientes', (SELECT count(*) FROM ativas a WHERE a.setor_id = e.setor_id)) AS x
                FROM public.escala_plantao e
                JOIN setores s ON s.id = e.setor_id
                JOIN public.perfis p ON p.id = e.perfil_id
                JOIN public.vinculos vi ON vi.perfil_id = e.perfil_id AND vi.unidade_id = p_unidade AND vi.ativo AND vi.papel = 'plantonista'
               WHERE e.ativo AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
               ORDER BY e.perfil_id, e.setor_id) q), '[]'::jsonb),
    'alertas', coalesce((
      SELECT jsonb_agg(al ORDER BY (al ->> 'ordem')::int, al ->> 'leito')
        FROM (
          SELECT jsonb_build_object('ordem', 0, 'leito', coalesce(l.identificador, 'sem leito'), 'setor', s.nome,
                                    'internacao_id', a.id, 'paciente_id', a.paciente_id,
                                    'texto', vv.descricao, 'nota', vv.tipo, 'prazo', vv.prazo, 'selo', 'Vencida') AS al
            FROM vencidas vv
            JOIN ativas a ON a.id = vv.internacao_id
            JOIN setores s ON s.id = a.setor_id
            LEFT JOIN public.leitos l ON l.id = a.leito_id
          UNION ALL
          SELECT jsonb_build_object('ordem', CASE WHEN e.banda = 2 THEN 1 ELSE 2 END,
                                    'leito', coalesce(l.identificador, 'sem leito'), 'setor', s.nome,
                                    'internacao_id', a.id, 'paciente_id', a.paciente_id,
                                    'texto', e.escala || ' ' || e.total, 'nota', 'aferido em ' || to_char(e.aferido_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
                                    'selo', CASE WHEN e.banda = 2 THEN 'Escore alto' ELSE 'Escore médio' END)
            FROM escores e
            JOIN ativas a ON a.paciente_id = e.paciente_id
            JOIN setores s ON s.id = a.setor_id
            LEFT JOIN public.leitos l ON l.id = a.leito_id
           WHERE e.banda >= 1) z), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.mapa_leitos_gestor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mapa_leitos_gestor(uuid) TO authenticated;
