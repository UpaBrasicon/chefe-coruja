-- ════════════════════════════════════════════════════════════════════════════
-- Fase 6 — painel do gestor, auditoria da unidade e visão agregada da
-- organização.
--
-- 1. Auditoria (gestor da unidade): quem abriu, imprimiu ou exportou qual
--    prontuário, e a trilha de ações da unidade. log_auditoria só era lido pelo
--    administrador da organização, que por ADR 0002 só deveria ver agregado.
--    Aqui o GESTOR lê a trilha da própria unidade por RPC; o administrador
--    continua sem identidade de paciente.
-- 2. Painel do gestor: um retrato da unidade agora (ocupação, porta, presença,
--    setores sem ninguém escalado, pedidos pendentes, registros tardios).
-- 3. Organização (administrador): números por unidade, com supressão de célula
--    pequena (1 a 4 vira NULL) num helper único.
-- ════════════════════════════════════════════════════════════════════════════

-- ── supressão de célula pequena (ADR 0002) ─────────────────────────────────
CREATE OR REPLACE FUNCTION private.suprimir(n bigint)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT CASE WHEN n BETWEEN 1 AND 4 THEN NULL ELSE n END; $$;

CREATE OR REPLACE FUNCTION private.gestor_da_unidade(p_unidade uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor'; $$;
REVOKE ALL ON FUNCTION private.gestor_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.gestor_da_unidade(uuid) TO authenticated;

-- ── 1. auditoria da unidade ────────────────────────────────────────────────
-- Acessos ao prontuário. `via_pedido`: havia pedido aprovado e vigente de quem
-- acessou naquele momento (a leitura fora da escala).
CREATE OR REPLACE FUNCTION public.acessos_prontuario_da_unidade(
  p_unidade uuid, p_desde timestamptz DEFAULT now() - interval '7 days', p_ate timestamptz DEFAULT now(),
  p_perfil uuid DEFAULT NULL, p_paciente uuid DEFAULT NULL)
RETURNS TABLE (id uuid, criado_em timestamptz, profissional_id uuid, profissional_nome text, papel text,
               paciente_id uuid, paciente_nome text, tipo_acesso text, documento_tipo text, ip text, via_pedido boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT la.id, la.created_at, la.acessado_por, pf.nome_completo, la.papel, la.paciente_id, pa.nome,
         la.tipo_acesso, la.documento_tipo, host(la.ip),
         EXISTS (SELECT 1 FROM public.pedidos_acesso_prontuario pd
                 WHERE pd.solicitante_id = la.acessado_por AND pd.paciente_id = la.paciente_id
                   AND pd.status = 'aprovado' AND la.created_at BETWEEN pd.decidido_em AND pd.valido_ate)
  FROM public.log_acesso_prontuario la
  JOIN public.perfis pf ON pf.id = la.acessado_por
  JOIN public.pacientes pa ON pa.id = la.paciente_id
  WHERE la.unidade_id = p_unidade
    AND la.created_at >= coalesce(p_desde, now() - interval '7 days')
    AND la.created_at <= coalesce(p_ate, now())
    AND (p_perfil IS NULL OR la.acessado_por = p_perfil)
    AND (p_paciente IS NULL OR la.paciente_id = p_paciente)
  ORDER BY la.created_at DESC
  LIMIT 1000;
END $$;
REVOKE ALL ON FUNCTION public.acessos_prontuario_da_unidade(uuid, timestamptz, timestamptz, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acessos_prontuario_da_unidade(uuid, timestamptz, timestamptz, uuid, uuid) TO authenticated;

-- Trilha de ações da unidade (o payload já é lista fechada, sem dado clínico).
CREATE OR REPLACE FUNCTION public.trilha_da_unidade(
  p_unidade uuid, p_desde timestamptz DEFAULT now() - interval '7 days', p_ate timestamptz DEFAULT now())
RETURNS TABLE (seq bigint, criado_em timestamptz, ator_nome text, acao text, entidade text, entidade_id uuid, payload jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT la.seq, la.created_at, pf.nome_completo, la.acao, la.entidade, la.entidade_id, la.payload
  FROM public.log_auditoria la
  LEFT JOIN public.perfis pf ON pf.id = la.ator_id
  WHERE la.unidade_id = p_unidade
    AND la.created_at >= coalesce(p_desde, now() - interval '7 days')
    AND la.created_at <= coalesce(p_ate, now())
  ORDER BY la.seq DESC
  LIMIT 1000;
END $$;
REVOKE ALL ON FUNCTION public.trilha_da_unidade(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trilha_da_unidade(uuid, timestamptz, timestamptz) TO authenticated;

-- Integridade da cadeia de hash: devolve só se está íntegra e onde quebrou.
CREATE OR REPLACE FUNCTION public.integridade_trilha(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_quebra bigint;
BEGIN
  IF NOT private.gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  v_quebra := private.verificar_cadeia_auditoria();
  RETURN jsonb_build_object('integra', v_quebra IS NULL, 'quebra_seq', v_quebra, 'conferido_em', now(),
                            'registros', (SELECT count(*) FROM public.log_auditoria));
END $$;
REVOKE ALL ON FUNCTION public.integridade_trilha(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.integridade_trilha(uuid) TO authenticated;

-- ── 2. painel do gestor ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.painel_gestor(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT private.gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT jsonb_build_object(
    'gerado_em', now(),
    'ocupacao', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('setor_id', s.id, 'setor', s.nome, 'tipo', s.tipo,
               'pacientes', (SELECT count(*) FROM public.pacientes p WHERE p.setor_id = s.id AND p.ativo),
               'leitos', (SELECT count(*) FROM public.leitos l WHERE l.setor_id = s.id AND l.ativo),
               'leitos_ocupados', (SELECT count(*) FROM public.leitos l WHERE l.setor_id = s.id AND l.ativo AND l.status = 'ocupado'),
               'leitos_livres', (SELECT count(*) FROM public.leitos l WHERE l.setor_id = s.id AND l.ativo AND l.status = 'livre'),
               'escalados_agora', (SELECT count(DISTINCT e.perfil_id) FROM public.escala_plantao e
                                    WHERE e.setor_id = s.id AND e.inicio <= now()
                                      AND now() < e.inicio + make_interval(mins => e.duracao_min)))
             ORDER BY s.ordem, s.nome), '[]'::jsonb)
      FROM public.setores s WHERE s.unidade_id = p_unidade AND s.ativo),
    'porta', (
      SELECT jsonb_build_object(
        'triagem', count(*) FILTER (WHERE etapa = 'triagem'),
        'atendimento', count(*) FILTER (WHERE etapa = 'atendimento'),
        'observacao', count(*) FILTER (WHERE etapa = 'observacao'),
        'internacao', count(*) FILTER (WHERE etapa = 'internacao'),
        'encerrados_24h', (SELECT count(*) FROM public.episodios e2 WHERE e2.unidade_id = p_unidade
                             AND e2.encerrado_em > now() - interval '24 hours'),
        'chegadas_24h', (SELECT count(*) FROM public.episodios e3 WHERE e3.unidade_id = p_unidade
                           AND e3.chegada_em > now() - interval '24 hours'),
        'espera_mais_antiga_min', floor(extract(epoch FROM now() - min(chegada_em) FILTER (WHERE etapa IN ('triagem', 'atendimento'))) / 60))
      FROM public.episodios WHERE unidade_id = p_unidade AND etapa <> 'encerrado'),
    'presenca', (
      SELECT jsonb_build_object(
        'em_expediente', count(*) FILTER (WHERE pp.checkin_em IS NOT NULL AND pp.checkout_em IS NULL),
        'checkin_fora_do_raio', count(*) FILTER (WHERE pp.checkin_em IS NOT NULL AND pp.checkout_em IS NULL AND pp.checkin_dentro IS FALSE))
      FROM public.presenca_plantonista pp
      WHERE pp.unidade_id = p_unidade AND pp.checkin_em > now() - interval '36 hours'),
    'escalados_sem_checkin', (
      SELECT count(DISTINCT e.perfil_id) FROM public.escala_plantao e
      WHERE e.unidade_id = p_unidade AND e.inicio <= now() - interval '15 minutes'
        AND now() < e.inicio + make_interval(mins => e.duracao_min)
        AND NOT EXISTS (SELECT 1 FROM public.presenca_plantonista pp
                        WHERE pp.perfil_id = e.perfil_id AND pp.unidade_id = p_unidade
                          AND pp.checkin_em IS NOT NULL AND pp.checkout_em IS NULL)),
    'pedidos_acesso_pendentes', (
      SELECT count(*) FROM public.pedidos_acesso_prontuario WHERE unidade_id = p_unidade AND status = 'pendente'),
    'acessos_prontuario_24h', (
      SELECT count(*) FROM public.log_acesso_prontuario WHERE unidade_id = p_unidade AND created_at > now() - interval '24 hours'),
    'impressoes_24h', (
      SELECT count(*) FROM public.log_acesso_prontuario WHERE unidade_id = p_unidade AND created_at > now() - interval '24 hours'
        AND tipo_acesso IN ('impressao', 'exportacao'))
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.painel_gestor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_gestor(uuid) TO authenticated;

-- ── 3. organização em agregado (administrador) ─────────────────────────────
-- Por unidade da organização: contagens suprimidas de 1 a 4. Taxa só quando os
-- dois termos passam pela supressão. Sem nome, sem identidade de paciente.
CREATE OR REPLACE FUNCTION public.painel_organizacao(p_dias int DEFAULT 30)
RETURNS TABLE (unidade_id uuid, unidade_nome text, leitos bigint, leitos_ocupados bigint, taxa_ocupacao numeric,
               porta_agora bigint, internados_agora bigint, chegadas_periodo bigint, encerrados_periodo bigint,
               obitos_periodo bigint, evasoes_periodo bigint, profissionais_em_expediente bigint,
               taxa_ocupacao_media_censo numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dias int := greatest(1, least(coalesce(p_dias, 30), 365));
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  WITH u AS (
    SELECT un.id, un.nome FROM public.unidades un
    WHERE private.eh_super_admin() OR un.id IN (SELECT private.unidades_admin())
  ), c AS (
    SELECT u.id, u.nome,
      (SELECT count(*) FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id WHERE s.unidade_id = u.id AND s.ativo AND l.ativo) AS leitos,
      (SELECT count(*) FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id WHERE s.unidade_id = u.id AND s.ativo AND l.ativo AND l.status = 'ocupado') AS ocupados,
      (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.etapa IN ('triagem', 'atendimento', 'observacao')) AS porta,
      (SELECT count(*) FROM public.internacoes i WHERE i.unidade_id = u.id AND i.data_alta IS NULL) AS internados,
      (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.chegada_em > now() - make_interval(days => v_dias)) AS chegadas,
      (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.encerrado_em > now() - make_interval(days => v_dias)) AS encerrados,
      (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.encerrado_em > now() - make_interval(days => v_dias) AND e.desfecho = 'obito') AS obitos,
      (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.encerrado_em > now() - make_interval(days => v_dias) AND e.desfecho = 'evasao') AS evasoes,
      (SELECT count(*) FROM public.presenca_plantonista pp WHERE pp.unidade_id = u.id AND pp.checkin_em > now() - interval '36 hours'
         AND pp.checkin_em IS NOT NULL AND pp.checkout_em IS NULL) AS expediente,
      (SELECT round(avg(co.taxa_ocupacao), 1) FROM public.censo_ocupacao co
        WHERE co.unidade_id = u.id AND co.data > (now() - make_interval(days => v_dias))::date) AS censo
    FROM u
  )
  SELECT c.id, c.nome,
         private.suprimir(c.leitos), private.suprimir(c.ocupados),
         CASE WHEN private.suprimir(c.leitos) IS NOT NULL AND private.suprimir(c.ocupados) IS NOT NULL AND c.leitos > 0
              THEN round(100.0 * c.ocupados / c.leitos, 1) END,
         private.suprimir(c.porta), private.suprimir(c.internados), private.suprimir(c.chegadas),
         private.suprimir(c.encerrados), private.suprimir(c.obitos), private.suprimir(c.evasoes),
         c.expediente,  -- profissionais, não pacientes: sem supressão
         CASE WHEN private.suprimir(c.leitos) IS NOT NULL THEN c.censo END  -- unidade pequena: taxa também sai
  FROM c
  ORDER BY c.nome;
END $$;
REVOKE ALL ON FUNCTION public.painel_organizacao(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_organizacao(int) TO authenticated;
