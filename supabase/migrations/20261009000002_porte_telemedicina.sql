-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 8 — telas do médico de telemedicina (P/index.html
-- 5919–6240, valsTele e valsTmExtrato; navegação 32231–32238).
--
-- O protótipo é de salas de vídeo com transcrição; o app (fase 7) é a
-- teleinterconsulta ESCRITA: pedido e parecer viram documentos numerados.
-- As telas do protótipo ficam, lidas do que o banco tem:
--
--  * DISPONIBILIDADE NO TOPO (Disponível / Ausente / Em consulta): a escolha
--    fica em disponibilidade_telemedicina (antes era estado do navegador);
--    "Em consulta" não se escolhe: é ter teleinterconsulta em atendimento.
--    O plantonista vê a telemedicina de plantão na unidade e a situação dela
--    (telemedicina_na_unidade) — é para isso que a escolha serve.
--  * SALAS EM ANDAMENTO: as minhas em atendimento (teleinterconsultas_da_
--    unidade, fase 7) e as dos outros teleconsultores da unidade, sem o nome
--    do paciente — "só para saber que existem" (tele_outras_em_atendimento).
--  * MINHA AGENDA: a minha escala (tele_minha_escala). Não há teleconsulta
--    eletiva marcada no app: a teleinterconsulta é por chamado.
--  * EXTRATO: por plantão escalado (valor da unidade, private.valor_plantao,
--    o mesmo do extrato do plantonista), com as horas de check-in/out e os
--    pareceres respondidos no turno. Não há tabela de valor por consulta na
--    rede: a contagem aparece, o valor não.
--  * TELEMONITORAMENTO: a cobertura de telemedicina da unidade pela escala —
--    que setor, quem, quando (tele_cobertura).
--  * ASSINATURAS PENDENTES: pareceres meus emitidos sem assinatura ICP-Brasil
--    (etapa 4.8, sem provedor: nada aqui assina) e os pedidos aceitos ainda
--    sem parecer (tele_pendencias).
--  * HISTÓRICO E AUDITORIA: as minhas teleinterconsultas e a trilha (log de
--    auditoria delas e as aberturas de prontuário que eu fiz) — tele_historico.
--  * UNIDADES E CREDENCIAIS: inscrição do cadastro, especialidades declaradas
--    e as unidades em que tenho o papel de telemedicina, com a situação da
--    escala hoje (tele_credenciais).
--
-- Escritas só por RPC, com segundo fator. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── disponibilidade ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disponibilidade_telemedicina (
  perfil_id     uuid PRIMARY KEY REFERENCES public.perfis(id) ON DELETE CASCADE,
  estado        text NOT NULL CHECK (estado IN ('disponivel', 'ausente')),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.disponibilidade_telemedicina ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS disponibilidade_telemedicina_select ON public.disponibilidade_telemedicina;
CREATE POLICY disponibilidade_telemedicina_select ON public.disponibilidade_telemedicina FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id());
REVOKE ALL ON public.disponibilidade_telemedicina FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.disponibilidade_telemedicina FROM authenticated;
GRANT SELECT ON public.disponibilidade_telemedicina TO authenticated;

CREATE OR REPLACE FUNCTION private.sou_telemedicina() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = private.meu_perfil_id() AND v.ativo AND v.papel = 'telemedicina')
$$;

-- a situação de um teleconsultor: em consulta (tem pedido em atendimento),
-- ou o que ele escolheu (disponível, se nunca escolheu)
CREATE OR REPLACE FUNCTION private.situacao_telemedicina(p_perfil uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.teleinterconsultas t WHERE t.consultor_id = p_perfil AND t.status = 'em_atendimento') THEN 'em_consulta'
    ELSE coalesce((SELECT d.estado FROM public.disponibilidade_telemedicina d WHERE d.perfil_id = p_perfil), 'disponivel') END
$$;

CREATE OR REPLACE FUNCTION public.definir_minha_disponibilidade_tele(p_estado text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR NOT private.sou_telemedicina() THEN RAISE EXCEPTION 'Disponibilidade é do médico de telemedicina.'; END IF;
  IF p_estado NOT IN ('disponivel', 'ausente') THEN RAISE EXCEPTION 'Escolha disponível ou ausente.'; END IF;
  INSERT INTO public.disponibilidade_telemedicina (perfil_id, estado) VALUES (v_perfil, p_estado)
  ON CONFLICT (perfil_id) DO UPDATE SET estado = EXCLUDED.estado, atualizado_em = now();
  PERFORM private.registrar_auditoria('disponibilidade_telemedicina', 'disponibilidade_telemedicina', v_perfil, NULL,
    jsonb_build_object('estado', p_estado));
END $$;

-- o topo das telas da telemedicina
CREATE OR REPLACE FUNCTION public.minha_situacao_tele(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id(); p public.escala_plantao;
BEGIN
  IF v_perfil IS NULL OR NOT private.tenho_papel(p_unidade, 'telemedicina') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO p FROM private.plantoes_agora() x WHERE x.unidade_id = p_unidade ORDER BY x.inicio LIMIT 1;
  RETURN jsonb_build_object(
    'estado', private.situacao_telemedicina(v_perfil),
    'escolhido', coalesce((SELECT d.estado FROM public.disponibilidade_telemedicina d WHERE d.perfil_id = v_perfil), 'disponivel'),
    'de_plantao', p.id IS NOT NULL,
    'plantao_inicio', p.inicio, 'plantao_fim', p.inicio + make_interval(mins => p.duracao_min),
    'setor', (SELECT s.nome FROM public.setores s WHERE s.id = p.setor_id),
    'fila', CASE WHEN p.id IS NULL THEN 0 ELSE
      (SELECT count(*) FROM public.teleinterconsultas t WHERE t.unidade_id = p_unidade AND t.status = 'aberta') END,
    'salas', (SELECT count(*) FROM public.teleinterconsultas t WHERE t.consultor_id = v_perfil AND t.status = 'em_atendimento'),
    'assinaturas', (SELECT count(*) FROM public.documentos_clinicos d
                     JOIN public.teleinterconsultas t ON t.documento_resposta_id = d.id
                    WHERE t.consultor_id = v_perfil AND d.estado = 'ativo' AND d.assinado_em IS NULL));
END $$;

-- para quem pede: a telemedicina de plantão agora na unidade e a situação
CREATE OR REPLACE FUNCTION public.telemedicina_na_unidade(p_unidade uuid)
RETURNS TABLE (nome text, crm text, setor text, ate timestamptz, situacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.papel_na_unidade(p_unidade) NOT IN ('plantonista', 'gestor', 'telemedicina') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (e.perfil_id) pf.nome_completo, pf.crm || coalesce('/' || pf.uf_crm, ''), s.nome,
         e.inicio + make_interval(mins => e.duracao_min), private.situacao_telemedicina(e.perfil_id)
    FROM public.escala_plantao e
    JOIN public.vinculos v ON v.perfil_id = e.perfil_id AND v.unidade_id = e.unidade_id AND v.ativo AND v.papel = 'telemedicina'
    JOIN public.perfis pf ON pf.id = e.perfil_id
    JOIN public.setores s ON s.id = e.setor_id
   WHERE e.unidade_id = p_unidade AND e.ativo AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
   ORDER BY e.perfil_id, e.inicio;
END $$;

-- ── salas dos outros ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tele_outras_em_atendimento(p_unidade uuid)
RETURNS TABLE (id uuid, setor text, consultor text, urgencia text, aceita_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (private.telemedicina_de_plantao(p_unidade) OR private.papel_na_unidade(p_unidade) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT t.id, s.nome, pf.nome_completo, t.urgencia, t.aceita_em
    FROM public.teleinterconsultas t
    JOIN public.pacientes pa ON pa.id = t.paciente_id
    LEFT JOIN public.setores s ON s.id = pa.setor_id
    JOIN public.perfis pf ON pf.id = t.consultor_id
   WHERE t.unidade_id = p_unidade AND t.status = 'em_atendimento' AND t.consultor_id <> private.meu_perfil_id()
   ORDER BY t.aceita_em;
END $$;

-- ── minha escala (agenda e extrato) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tele_minha_escala(p_de date, p_ate date)
RETURNS TABLE (escala_id uuid, unidade text, setor text, data date, turno text, inicio timestamptz, fim timestamptz,
               agora boolean, checkin_em timestamptz, checkout_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.sou_telemedicina() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_ate < p_de OR p_ate - p_de > 93 THEN RAISE EXCEPTION 'Período de até 3 meses.'; END IF;
  RETURN QUERY
  SELECT e.id, u.nome, s.nome, e.data, e.turno, e.inicio, e.inicio + make_interval(mins => e.duracao_min),
         (e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)),
         pp.checkin_em, pp.checkout_em
    FROM public.escala_plantao e
    JOIN public.vinculos v ON v.perfil_id = e.perfil_id AND v.unidade_id = e.unidade_id AND v.ativo AND v.papel = 'telemedicina'
    JOIN public.unidades u ON u.id = e.unidade_id
    JOIN public.setores s ON s.id = e.setor_id
    LEFT JOIN LATERAL (SELECT x.checkin_em, x.checkout_em FROM public.presenca_plantonista x
                        WHERE x.perfil_id = e.perfil_id AND x.unidade_id = e.unidade_id AND x.data = e.data AND x.turno = e.turno
                        ORDER BY x.checkin_em DESC NULLS LAST LIMIT 1) pp ON true
   WHERE e.perfil_id = private.meu_perfil_id() AND e.ativo AND e.data BETWEEN p_de AND p_ate
   ORDER BY e.inicio;
END $$;

CREATE OR REPLACE FUNCTION public.tele_extrato(p_de date, p_ate date)
RETURNS TABLE (escala_id uuid, unidade text, setor text, data date, turno text, inicio timestamptz, fim timestamptz,
               checkin_em timestamptz, checkout_em timestamptz, horas numeric, valor numeric, pareceres bigint, situacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF NOT private.sou_telemedicina() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_ate < p_de OR p_ate - p_de > 93 THEN RAISE EXCEPTION 'Período de até 3 meses.'; END IF;
  RETURN QUERY
  SELECT e.id, u.nome, s.nome, e.data, e.turno, e.inicio, e.inicio + make_interval(mins => e.duracao_min),
         pp.checkin_em, pp.checkout_em, round(e.duracao_min / 60.0, 1),
         private.valor_plantao(e.unidade_id, e.setor_id, e.turno),
         (SELECT count(*) FROM public.teleinterconsultas t
           WHERE t.consultor_id = v_perfil AND t.unidade_id = e.unidade_id AND t.status = 'respondida'
             AND t.respondida_em >= e.inicio AND t.respondida_em < e.inicio + make_interval(mins => e.duracao_min)),
         CASE WHEN now() >= e.inicio + make_interval(mins => e.duracao_min) THEN 'fechado'
              WHEN now() >= e.inicio THEN 'em_curso' ELSE 'previsto' END
    FROM public.escala_plantao e
    JOIN public.vinculos v ON v.perfil_id = e.perfil_id AND v.unidade_id = e.unidade_id AND v.ativo AND v.papel = 'telemedicina'
    JOIN public.unidades u ON u.id = e.unidade_id
    JOIN public.setores s ON s.id = e.setor_id
    LEFT JOIN LATERAL (SELECT x.checkin_em, x.checkout_em FROM public.presenca_plantonista x
                        WHERE x.perfil_id = e.perfil_id AND x.unidade_id = e.unidade_id AND x.data = e.data AND x.turno = e.turno
                        ORDER BY x.checkin_em DESC NULLS LAST LIMIT 1) pp ON true
   WHERE e.perfil_id = v_perfil AND e.ativo AND e.data BETWEEN p_de AND p_ate
   ORDER BY e.inicio;
END $$;

-- ── telemonitoramento: a cobertura da telemedicina na unidade ───────────────
CREATE OR REPLACE FUNCTION public.tele_cobertura(p_unidade uuid, p_dias int DEFAULT 7)
RETURNS TABLE (setor text, medico text, inicio timestamptz, fim timestamptz, agora boolean, minha boolean, situacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.papel_na_unidade(p_unidade) NOT IN ('plantonista', 'gestor', 'telemedicina') AND NOT private.tenho_papel(p_unidade, 'telemedicina') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT s.nome, pf.nome_completo, e.inicio, e.inicio + make_interval(mins => e.duracao_min),
         (e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)),
         e.perfil_id = private.meu_perfil_id(),
         CASE WHEN e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
              THEN private.situacao_telemedicina(e.perfil_id) END
    FROM public.escala_plantao e
    JOIN public.vinculos v ON v.perfil_id = e.perfil_id AND v.unidade_id = e.unidade_id AND v.ativo AND v.papel = 'telemedicina'
    JOIN public.perfis pf ON pf.id = e.perfil_id
    JOIN public.setores s ON s.id = e.setor_id
   WHERE e.unidade_id = p_unidade AND e.ativo
     AND e.inicio + make_interval(mins => e.duracao_min) > now()
     AND e.inicio < now() + make_interval(days => greatest(1, least(coalesce(p_dias, 7), 31)))
   ORDER BY e.inicio, s.nome;
END $$;

-- ── assinaturas pendentes ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tele_pendencias()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF NOT private.sou_telemedicina() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN jsonb_build_object(
    'sem_assinatura', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'teleinterconsulta_id', t.id, 'documento_id', d.id, 'numero', d.numero, 'emitido_em', d.emitido_em,
        'paciente', pa.nome, 'unidade', u.nome, 'setor', s.nome, 'solicitante', ps.nome_completo)
        ORDER BY d.emitido_em DESC), '[]'::jsonb)
      FROM public.teleinterconsultas t
      JOIN public.documentos_clinicos d ON d.id = t.documento_resposta_id
      JOIN public.pacientes pa ON pa.id = t.paciente_id
      JOIN public.unidades u ON u.id = t.unidade_id
      LEFT JOIN public.setores s ON s.id = pa.setor_id
      JOIN public.perfis ps ON ps.id = t.solicitante_id
     WHERE t.consultor_id = v_perfil AND d.estado = 'ativo' AND d.assinado_em IS NULL),
    'sem_parecer', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'teleinterconsulta_id', t.id, 'aceita_em', t.aceita_em, 'urgencia', t.urgencia,
        'paciente', pa.nome, 'unidade', u.nome, 'setor', s.nome, 'solicitante', ps.nome_completo)
        ORDER BY t.aceita_em), '[]'::jsonb)
      FROM public.teleinterconsultas t
      JOIN public.pacientes pa ON pa.id = t.paciente_id
      JOIN public.unidades u ON u.id = t.unidade_id
      LEFT JOIN public.setores s ON s.id = pa.setor_id
      JOIN public.perfis ps ON ps.id = t.solicitante_id
     WHERE t.consultor_id = v_perfil AND t.status = 'em_atendimento'));
END $$;

-- ── histórico e trilha ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tele_historico(p_dias int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id(); v_desde timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365)));
BEGIN
  IF NOT private.sou_telemedicina() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN jsonb_build_object(
    'consultas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'paciente', pa.nome, 'unidade', u.nome, 'setor', s.nome, 'solicitante', ps.nome_completo,
        'pergunta', t.pergunta, 'resposta', t.resposta, 'status', t.status, 'urgencia', t.urgencia,
        'criada_em', t.criada_em, 'aceita_em', t.aceita_em, 'respondida_em', t.respondida_em,
        'numero_solicitacao', ds.numero, 'numero_parecer', dr.numero, 'assinado_em', dr.assinado_em)
        ORDER BY coalesce(t.respondida_em, t.aceita_em) DESC), '[]'::jsonb)
      FROM public.teleinterconsultas t
      JOIN public.pacientes pa ON pa.id = t.paciente_id
      JOIN public.unidades u ON u.id = t.unidade_id
      LEFT JOIN public.setores s ON s.id = pa.setor_id
      JOIN public.perfis ps ON ps.id = t.solicitante_id
      LEFT JOIN public.documentos_clinicos ds ON ds.id = t.documento_solicitacao_id
      LEFT JOIN public.documentos_clinicos dr ON dr.id = t.documento_resposta_id
     WHERE t.consultor_id = v_perfil AND t.status IN ('em_atendimento', 'respondida') AND coalesce(t.respondida_em, t.aceita_em) >= v_desde),
    'trilha', (SELECT coalesce(jsonb_agg(s.x ORDER BY s.em DESC), '[]'::jsonb) FROM (
        SELECT a.created_at AS em, jsonb_build_object('em', a.created_at, 'acao', a.acao, 'paciente', pa.nome, 'unidade', u.nome,
                                  'por', coalesce(pf.nome_completo, 'Sistema')) AS x
          FROM public.log_auditoria a
          JOIN public.teleinterconsultas t ON t.id = a.entidade_id AND a.entidade = 'teleinterconsultas'
          JOIN public.pacientes pa ON pa.id = t.paciente_id
          JOIN public.unidades u ON u.id = t.unidade_id
          LEFT JOIN public.perfis pf ON pf.id = a.ator_id
         WHERE t.consultor_id = v_perfil AND a.created_at >= v_desde
        UNION ALL
        SELECT l.created_at, jsonb_build_object('em', l.created_at, 'acao', l.tipo_acesso, 'paciente', pa.nome, 'unidade', u.nome,
                                  'por', pf.nome_completo)
          FROM public.log_acesso_prontuario l
          JOIN public.pacientes pa ON pa.id = l.paciente_id
          JOIN public.unidades u ON u.id = l.unidade_id
          JOIN public.perfis pf ON pf.id = l.acessado_por
         WHERE l.acessado_por = v_perfil AND l.created_at >= v_desde
        ORDER BY 1 DESC LIMIT 200) s));
END $$;

-- ── credenciais ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tele_credenciais()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF NOT private.sou_telemedicina() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN jsonb_build_object(
    'perfil', (SELECT jsonb_build_object('nome', pf.nome_completo, 'crm', pf.crm, 'uf_crm', pf.uf_crm,
                                         'conselho', pf.conselho, 'registro_numero', pf.registro_numero, 'registro_uf', pf.registro_uf)
                 FROM public.perfis pf WHERE pf.id = v_perfil),
    'especialidades', (SELECT coalesce(jsonb_agg(e.especialidade ORDER BY e.especialidade), '[]'::jsonb)
                         FROM public.especialidades_perfil e WHERE e.perfil_id = v_perfil),
    'unidades', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'unidade_id', u.id, 'nome', u.nome, 'uf', u.uf, 'municipio', u.municipio,
        'de_plantao', EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.perfil_id = v_perfil AND e.unidade_id = u.id AND e.ativo
                                AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)),
        'proximo', (SELECT min(e.inicio) FROM public.escala_plantao e WHERE e.perfil_id = v_perfil AND e.unidade_id = u.id AND e.ativo
                      AND e.inicio > now()))
        ORDER BY u.nome), '[]'::jsonb)
      FROM public.vinculos v JOIN public.unidades u ON u.id = v.unidade_id
     WHERE v.perfil_id = v_perfil AND v.ativo AND v.papel = 'telemedicina'));
END $$;

REVOKE ALL ON FUNCTION private.sou_telemedicina() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.situacao_telemedicina(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_minha_disponibilidade_tele(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.minha_situacao_tele(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.telemedicina_na_unidade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tele_outras_em_atendimento(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tele_minha_escala(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tele_extrato(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tele_cobertura(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tele_pendencias() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tele_historico(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tele_credenciais() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.sou_telemedicina() TO authenticated;
GRANT EXECUTE ON FUNCTION private.situacao_telemedicina(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_minha_disponibilidade_tele(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.minha_situacao_tele(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.telemedicina_na_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_outras_em_atendimento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_minha_escala(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_extrato(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_cobertura(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_pendencias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_historico(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_credenciais() TO authenticated;
