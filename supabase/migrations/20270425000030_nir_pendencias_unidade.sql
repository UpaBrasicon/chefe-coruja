-- ════════════════════════════════════════════════════════════════════════════
-- Internação do NIR pelo modelo do RT (25/11/2026), NIR2 a NIR4.
--
-- • NIR2 "Avisar médico": a pendência da unidade num pedido de regulação
--   (public.regulacao_pendencias_unidade). Dono médico ou NIR, motivo de 1
--   clique (atualizar evolução, exame pedido pela central, reavaliar
--   isolamento, responder dúvida da central ou outro), título, urgência, os
--   médicos avisados e a situação: pendente, médico avisado, resolvida. O aviso
--   vai aos médicos de plantão no setor do paciente agora (escala); sem
--   ninguém escalado no setor, aos médicos da unidade (private.nir_medicos_plantao),
--   pelo aviso que já existe (notificacoes_plantonista, tipo reg_nirmed_<nº>).
--   Resolver grava autor e hora. Tudo entra no histórico do pedido
--   (regulacao_eventos) e na auditoria (sem o texto).
-- • Quem lê e escreve: o médico, o gestor e o NIR da unidade de origem
--   (private.regulacao_exigir_unidade), como a conversa com a central.
-- • NIR3: a lista das pendências da unidade (abertas e as resolvidas nas
--   últimas 24 h) com leito, setor, paciente, nº do pedido e responsáveis.
-- • NIR2: os médicos do setor para o aviso (nir_medicos_do_setor).
-- • NIR4: o mapa de leitos (nir_mapa_leitos), só leitura: setores ativos da
--   unidade, leitos ativos com situação e o paciente internado, os médicos de
--   plantão em cada setor agora e o isolamento ativo e o sexo dos internados.
--
-- Só adiciona (expand). Idempotente. Rollback no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.regulacao_pendencias_unidade (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  solicitacao_id  uuid NOT NULL REFERENCES public.regulacao_solicitacoes(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  setor_id        uuid REFERENCES public.setores(id),
  dono            text NOT NULL DEFAULT 'medico' CHECK (dono IN ('medico', 'nir')),
  motivo          text NOT NULL DEFAULT 'outro' CHECK (motivo IN ('evolucao', 'exame', 'isolamento', 'duvida', 'outro')),
  titulo          text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 5 AND 500),
  urgencia        text NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('alta', 'normal')),
  responsaveis    uuid[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'medico_avisado', 'resolvida')),
  criada_por      uuid NOT NULL REFERENCES public.perfis(id),
  criada_em       timestamptz NOT NULL DEFAULT clock_timestamp(),
  avisado_em      timestamptz,
  avisado_por     uuid REFERENCES public.perfis(id),
  avisos          integer NOT NULL DEFAULT 0 CHECK (avisos >= 0),
  resolvida_em    timestamptz,
  resolvida_por   uuid REFERENCES public.perfis(id),
  resolucao       text CHECK (resolucao IS NULL OR length(resolucao) <= 500),
  CHECK ((status = 'resolvida') = (resolvida_em IS NOT NULL AND resolvida_por IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_regulacao_pendencias_unidade ON public.regulacao_pendencias_unidade (unidade_id, status, criada_em DESC);
CREATE INDEX IF NOT EXISTS idx_regulacao_pendencias_unidade_sol ON public.regulacao_pendencias_unidade (solicitacao_id) WHERE status <> 'resolvida';
CREATE INDEX IF NOT EXISTS idx_regulacao_pendencias_unidade_paciente ON public.regulacao_pendencias_unidade (paciente_id);
CREATE INDEX IF NOT EXISTS idx_regulacao_pendencias_unidade_setor ON public.regulacao_pendencias_unidade (setor_id);
CREATE INDEX IF NOT EXISTS idx_regulacao_pendencias_unidade_criada_por ON public.regulacao_pendencias_unidade (criada_por);
CREATE INDEX IF NOT EXISTS idx_regulacao_pendencias_unidade_avisado_por ON public.regulacao_pendencias_unidade (avisado_por);
CREATE INDEX IF NOT EXISTS idx_regulacao_pendencias_unidade_resolvida_por ON public.regulacao_pendencias_unidade (resolvida_por);

ALTER TABLE public.regulacao_pendencias_unidade ENABLE ROW LEVEL SECURITY;
-- como as outras tabelas da regulação: leitura e escrita pelas RPCs abaixo
REVOKE ALL ON public.regulacao_pendencias_unidade FROM anon, authenticated;
-- defesa em profundidade (sem GRANT, o caminho são as RPCs): o médico, o
-- gestor e o NIR da unidade
DROP POLICY IF EXISTS regulacao_pendencias_unidade_ler ON public.regulacao_pendencias_unidade;
CREATE POLICY regulacao_pendencias_unidade_ler ON public.regulacao_pendencias_unidade FOR SELECT TO authenticated
  USING (private.tenho_papel(unidade_id, 'plantonista') OR private.tenho_papel(unidade_id, 'gestor') OR private.sou_nir(unidade_id));

-- ── apoio ───────────────────────────────────────────────────────────────────
-- Médicos de plantão agora no setor (só a escala; sem o "todos da unidade").
CREATE OR REPLACE FUNCTION private.nir_medicos_escalados_setor(p_unidade uuid, p_setor uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ARRAY(SELECT DISTINCT e.perfil_id FROM public.escala_plantao e
                 JOIN public.vinculos v ON v.perfil_id = e.perfil_id AND v.unidade_id = e.unidade_id AND v.ativo AND v.papel = 'plantonista'
                WHERE e.unidade_id = p_unidade AND e.ativo AND p_setor IS NOT NULL AND e.setor_id = p_setor
                  AND now() >= e.inicio AND now() < e.inicio + make_interval(mins => e.duracao_min))
$$;
REVOKE ALL ON FUNCTION private.nir_medicos_escalados_setor(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Pessoas como [{id, nome}], na ordem do nome.
CREATE OR REPLACE FUNCTION private.nir_pessoas_json(p_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome_completo) ORDER BY p.nome_completo), '[]'::jsonb)
    FROM public.perfis p WHERE p.id = ANY (coalesce(p_ids, '{}'::uuid[]))
$$;
REVOKE ALL ON FUNCTION private.nir_pessoas_json(uuid[]) FROM PUBLIC, anon, authenticated;

-- Leito atual do paciente na unidade (identificador) e o setor da internação aberta.
CREATE OR REPLACE FUNCTION private.nir_internacao_atual(p_unidade uuid, p_paciente uuid)
RETURNS TABLE (setor_id uuid, leito text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.setor_atual_id, le.identificador
    FROM public.internacoes i LEFT JOIN public.leitos le ON le.id = i.leito_atual_id
   WHERE i.unidade_id = p_unidade AND i.paciente_id = p_paciente AND i.data_alta IS NULL
   ORDER BY i.data_admissao DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.nir_internacao_atual(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Manda (ou reenvia) o aviso da pendência aos médicos dela. Devolve quantos.
CREATE OR REPLACE FUNCTION private.regulacao_pendencia_unidade_avisar(p public.regulacao_pendencias_unidade)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_leito text; v_setor text;
BEGIN
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p.solicitacao_id;
  SELECT x.leito INTO v_leito FROM private.nir_internacao_atual(p.unidade_id, p.paciente_id) x;
  SELECT se.nome INTO v_setor FROM public.setores se WHERE se.id = p.setor_id;
  -- o texto do aviso leva o nº do pedido, o leito e o setor; o nome do paciente fica na tela
  RETURN private.regulacao_avisar_pessoas(p.responsaveis, p.unidade_id, 'reg_nirmed_' || s.numero,
    'Regulação nº ' || s.numero || coalesce(' · leito ' || v_leito, '') || coalesce(' (' || v_setor || ')', '')
    || ': ' || CASE WHEN p.urgencia = 'alta' THEN 'URGENTE — ' ELSE '' END || left(p.titulo, 300) || ' (pedido do NIR)');
END $$;
REVOKE ALL ON FUNCTION private.regulacao_pendencia_unidade_avisar(public.regulacao_pendencias_unidade) FROM PUBLIC, anon, authenticated;

-- ── NIR2: criar, reavisar e resolver ────────────────────────────────────────
-- p_medicos vazio: os médicos de plantão no setor do paciente agora (sem
-- ninguém escalado, os médicos da unidade). Dono NIR: não avisa ninguém.
CREATE OR REPLACE FUNCTION public.regulacao_pendencia_unidade_criar(
  p_solicitacao uuid, p_motivo text, p_titulo text, p_urgencia text DEFAULT 'normal',
  p_medicos uuid[] DEFAULT NULL, p_dono text DEFAULT 'medico')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.regulacao_solicitacoes;
  p public.regulacao_pendencias_unidade;
  v_setor uuid;
  v_dono text := coalesce(nullif(btrim(p_dono), ''), 'medico');
  v_motivo text := coalesce(nullif(btrim(p_motivo), ''), 'outro');
  v_urg text := coalesce(nullif(btrim(p_urgencia), ''), 'normal');
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_para uuid[];
  v_n integer := 0;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao;
  IF NOT FOUND OR NOT private.regulacao_pode_ver(s) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  PERFORM private.regulacao_exigir_unidade(s.unidade_origem_id);
  IF NOT private.regulacao_em_aberto(s.status) THEN RAISE EXCEPTION 'Este pedido está encerrado.'; END IF;
  IF v_dono NOT IN ('medico', 'nir') THEN RAISE EXCEPTION 'Dono da pendência inválido.'; END IF;
  IF v_motivo NOT IN ('evolucao', 'exame', 'isolamento', 'duvida', 'outro') THEN RAISE EXCEPTION 'Motivo inválido.'; END IF;
  IF v_urg NOT IN ('alta', 'normal') THEN RAISE EXCEPTION 'Urgência inválida.'; END IF;
  IF length(v_titulo) < 5 THEN RAISE EXCEPTION 'Escreva a pendência (mínimo de 5 letras).'; END IF;
  IF length(v_titulo) > 500 THEN RAISE EXCEPTION 'A pendência vai até 500 letras.'; END IF;

  SELECT x.setor_id INTO v_setor FROM private.nir_internacao_atual(s.unidade_origem_id, s.paciente_id) x;
  IF v_dono = 'medico' THEN
    IF p_medicos IS NOT NULL AND cardinality(p_medicos) > 0 THEN
      -- só médicos com vínculo ativo na unidade
      v_para := ARRAY(SELECT DISTINCT m FROM unnest(p_medicos) m
                       WHERE EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = m AND v.unidade_id = s.unidade_origem_id
                                        AND v.ativo AND v.papel = 'plantonista'));
      IF cardinality(v_para) <> (SELECT count(DISTINCT m) FROM unnest(p_medicos) m) THEN
        RAISE EXCEPTION 'Escolha médicos desta unidade.';
      END IF;
    ELSE
      v_para := private.nir_medicos_plantao(s.unidade_origem_id, v_setor);
    END IF;
    v_para := ARRAY(SELECT q FROM unnest(v_para) q WHERE q IS DISTINCT FROM private.meu_perfil_id());
    IF cardinality(v_para) = 0 THEN RAISE EXCEPTION 'Não há médico da unidade para avisar.'; END IF;
  ELSE
    v_para := '{}';
  END IF;

  INSERT INTO public.regulacao_pendencias_unidade
    (unidade_id, solicitacao_id, paciente_id, setor_id, dono, motivo, titulo, urgencia, responsaveis, status, criada_por)
  VALUES (s.unidade_origem_id, s.id, s.paciente_id, v_setor, v_dono, v_motivo, v_titulo, v_urg, v_para, 'pendente', private.meu_perfil_id())
  RETURNING * INTO p;

  IF v_dono = 'medico' THEN
    v_n := private.regulacao_pendencia_unidade_avisar(p);
    UPDATE public.regulacao_pendencias_unidade
       SET status = 'medico_avisado', avisado_em = clock_timestamp(), avisado_por = private.meu_perfil_id(), avisos = 1
     WHERE id = p.id;
  END IF;

  PERFORM private.regulacao_evento(s.id, 'pendencia_unidade',
    jsonb_build_object('pendencia', p.id, 'dono', v_dono, 'motivo', v_motivo, 'urgencia', v_urg, 'titulo', v_titulo,
                       'avisados', private.nir_pessoas_json(v_para)));
  PERFORM private.registrar_auditoria('regulacao_pendencia_unidade', 'regulacao_pendencias_unidade', p.id, s.unidade_origem_id,
    jsonb_build_object('situacao', 'criada', 'tipo', v_motivo, 'quantidade', v_n));
  RETURN p.id;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_pendencia_unidade_criar(uuid, text, text, text, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_pendencia_unidade_criar(uuid, text, text, text, uuid[], text) TO authenticated;

-- Reenvia o aviso aos médicos da pendência (sem médico gravado: os de plantão no setor agora).
CREATE OR REPLACE FUNCTION public.regulacao_pendencia_unidade_reavisar(p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.regulacao_pendencias_unidade; v_n integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO p FROM public.regulacao_pendencias_unidade WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pendência não encontrada.'; END IF;
  PERFORM private.regulacao_exigir_unidade(p.unidade_id);
  IF p.status = 'resolvida' THEN RAISE EXCEPTION 'Esta pendência já foi resolvida.'; END IF;
  IF cardinality(p.responsaveis) = 0 THEN
    p.responsaveis := ARRAY(SELECT q FROM unnest(private.nir_medicos_plantao(p.unidade_id, p.setor_id)) q
                             WHERE q IS DISTINCT FROM private.meu_perfil_id());
  END IF;
  IF cardinality(p.responsaveis) = 0 THEN RAISE EXCEPTION 'Não há médico da unidade para avisar.'; END IF;
  v_n := private.regulacao_pendencia_unidade_avisar(p);
  UPDATE public.regulacao_pendencias_unidade
     SET responsaveis = p.responsaveis, status = 'medico_avisado', avisado_em = clock_timestamp(),
         avisado_por = private.meu_perfil_id(), avisos = avisos + 1
   WHERE id = p.id;
  PERFORM private.regulacao_evento(p.solicitacao_id, 'pendencia_unidade_reaviso',
    jsonb_build_object('pendencia', p.id, 'titulo', p.titulo, 'avisados', private.nir_pessoas_json(p.responsaveis)));
  PERFORM private.registrar_auditoria('regulacao_pendencia_unidade', 'regulacao_pendencias_unidade', p.id, p.unidade_id,
    jsonb_build_object('situacao', 'reaviso', 'tipo', p.motivo, 'quantidade', v_n));
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_pendencia_unidade_reavisar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_pendencia_unidade_reavisar(uuid) TO authenticated;

-- Resolve com autor (o login) e hora; a nota é opcional.
CREATE OR REPLACE FUNCTION public.regulacao_pendencia_unidade_resolver(p_id uuid, p_nota text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.regulacao_pendencias_unidade; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO p FROM public.regulacao_pendencias_unidade WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pendência não encontrada.'; END IF;
  PERFORM private.regulacao_exigir_unidade(p.unidade_id);
  IF p.status = 'resolvida' THEN RAISE EXCEPTION 'Esta pendência já foi resolvida.'; END IF;
  IF length(coalesce(v_nota, '')) > 500 THEN RAISE EXCEPTION 'A nota vai até 500 letras.'; END IF;
  UPDATE public.regulacao_pendencias_unidade
     SET status = 'resolvida', resolvida_em = clock_timestamp(), resolvida_por = private.meu_perfil_id(), resolucao = v_nota
   WHERE id = p.id;
  PERFORM private.regulacao_evento(p.solicitacao_id, 'pendencia_unidade_resolvida',
    jsonb_build_object('pendencia', p.id, 'titulo', p.titulo, 'nota', v_nota));
  PERFORM private.registrar_auditoria('regulacao_pendencia_unidade', 'regulacao_pendencias_unidade', p.id, p.unidade_id,
    jsonb_build_object('situacao', 'resolvida', 'tipo', p.motivo));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_pendencia_unidade_resolver(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_pendencia_unidade_resolver(uuid, text) TO authenticated;

-- ── NIR3: as pendências da unidade ──────────────────────────────────────────
-- Abertas e as resolvidas nas últimas 24 h, mais novas primeiro.
CREATE OR REPLACE FUNCTION public.regulacao_pendencias_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_exigir_unidade(p_unidade);
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'solicitacao_id', p.solicitacao_id, 'numero', s.numero, 'pedido_status', s.status,
        'paciente', jsonb_build_object('id', pa.id, 'nome', coalesce(pa.nome_social, pa.nome), 'nascimento', pa.data_nascimento),
        'setor', CASE WHEN se.id IS NULL THEN NULL ELSE jsonb_build_object('id', se.id, 'nome', se.nome) END,
        'leito', (SELECT x.leito FROM private.nir_internacao_atual(p.unidade_id, p.paciente_id) x),
        'dono', p.dono, 'motivo', p.motivo, 'titulo', p.titulo, 'urgencia', p.urgencia, 'status', p.status,
        'responsaveis', private.nir_pessoas_json(p.responsaveis),
        'criada_em', p.criada_em, 'criada_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = p.criada_por),
        'avisado_em', p.avisado_em, 'avisos', p.avisos,
        'resolvida_em', p.resolvida_em, 'resolvida_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = p.resolvida_por),
        'resolucao', p.resolucao)
      ORDER BY p.criada_em DESC)
      FROM public.regulacao_pendencias_unidade p
      JOIN public.regulacao_solicitacoes s ON s.id = p.solicitacao_id
      JOIN public.pacientes pa ON pa.id = p.paciente_id
      LEFT JOIN public.setores se ON se.id = p.setor_id
     WHERE p.unidade_id = p_unidade
       AND (p.status <> 'resolvida' OR p.resolvida_em > now() - interval '24 hours')), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_pendencias_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_pendencias_da_unidade(uuid) TO authenticated;

-- ── NIR2: médicos do setor para o aviso ─────────────────────────────────────
-- Os médicos de plantão no setor agora (no_plantao = true); sem ninguém
-- escalado no setor, os médicos da unidade (no_plantao = false).
CREATE OR REPLACE FUNCTION public.nir_medicos_do_setor(p_unidade uuid, p_setor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_escalados uuid[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_exigir_unidade(p_unidade);
  IF p_setor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.setores WHERE id = p_setor AND unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Setor não encontrado nesta unidade.';
  END IF;
  v_escalados := private.nir_medicos_escalados_setor(p_unidade, p_setor);
  RETURN jsonb_build_object(
    'no_plantao', cardinality(v_escalados) > 0,
    'medicos', private.nir_pessoas_json(CASE WHEN cardinality(v_escalados) > 0 THEN v_escalados
                                             ELSE private.nir_medicos_plantao(p_unidade, NULL) END));
END $$;
REVOKE ALL ON FUNCTION public.nir_medicos_do_setor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nir_medicos_do_setor(uuid, uuid) TO authenticated;

-- ── NIR4: mapa de leitos (só leitura) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nir_mapa_leitos(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_exigir_unidade(p_unidade);
  RETURN jsonb_build_object(
    'setores', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', se.id, 'nome', se.nome,
          'medicos', private.nir_pessoas_json(private.nir_medicos_escalados_setor(p_unidade, se.id)),
          'leitos', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', le.id, 'identificador', le.identificador, 'tipo', le.tipo, 'status', le.status,
                'paciente_id', (SELECT i.paciente_id FROM public.internacoes i
                                 WHERE i.leito_atual_id = le.id AND i.unidade_id = p_unidade AND i.data_alta IS NULL
                                 ORDER BY i.data_admissao DESC LIMIT 1))
              ORDER BY le.identificador)
              FROM public.leitos le WHERE le.setor_id = se.id AND le.ativo), '[]'::jsonb))
        ORDER BY se.ordem, se.nome)
        FROM public.setores se
       WHERE se.unidade_id = p_unidade AND se.ativo
         AND EXISTS (SELECT 1 FROM public.leitos le WHERE le.setor_id = se.id AND le.ativo)), '[]'::jsonb),
    'internados', coalesce((
      SELECT jsonb_agg(jsonb_build_object('paciente_id', x.paciente_id, 'sexo', pa.sexo,
                                          'isolamento', to_jsonb(private.isolamento_ativo(x.paciente_id))))
        FROM (SELECT DISTINCT i.paciente_id FROM public.internacoes i
               WHERE i.unidade_id = p_unidade AND i.data_alta IS NULL) x
        JOIN public.pacientes pa ON pa.id = x.paciente_id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.nir_mapa_leitos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nir_mapa_leitos(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Rollback (testado na homologação antes da produção):
--   DROP FUNCTION IF EXISTS public.nir_mapa_leitos(uuid);
--   DROP FUNCTION IF EXISTS public.nir_medicos_do_setor(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.regulacao_pendencias_da_unidade(uuid);
--   DROP FUNCTION IF EXISTS public.regulacao_pendencia_unidade_resolver(uuid, text);
--   DROP FUNCTION IF EXISTS public.regulacao_pendencia_unidade_reavisar(uuid);
--   DROP FUNCTION IF EXISTS public.regulacao_pendencia_unidade_criar(uuid, text, text, text, uuid[], text);
--   DROP FUNCTION IF EXISTS private.regulacao_pendencia_unidade_avisar(public.regulacao_pendencias_unidade);
--   DROP FUNCTION IF EXISTS private.nir_internacao_atual(uuid, uuid);
--   DROP FUNCTION IF EXISTS private.nir_pessoas_json(uuid[]);
--   DROP FUNCTION IF EXISTS private.nir_medicos_escalados_setor(uuid, uuid);
--   -- a tabela só sai se ainda não houver dado que valha guardar (20 anos, Lei 13.787/2018):
--   -- DROP TABLE IF EXISTS public.regulacao_pendencias_unidade;
-- Os eventos 'pendencia_unidade*' em regulacao_eventos ficam (só inserção).
-- ════════════════════════════════════════════════════════════════════════════
