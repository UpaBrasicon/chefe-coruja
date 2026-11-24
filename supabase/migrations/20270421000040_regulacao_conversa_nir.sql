-- ════════════════════════════════════════════════════════════════════════════
-- Regulação dentro do paciente, perfil NIR e cobrança (pedidos do RT, R1 a R3,
-- NIR, cobrança e lista do gestor; 24/11/2026).
--
-- • R3: conversa por pedido de regulação (public.regulacao_mensagens). O autor
--   é quem está logado; o lado (origem ou central) sai do papel. O regulador
--   pode marcar a mensagem como pergunta ou pedido. Toda mensagem entra no
--   histórico do pedido (regulacao_eventos) e na auditoria (sem o texto).
--   Quando o regulador escreve, avisam-se o solicitante, o médico assistente e
--   o médico e o NIR escalados no dia na unidade de origem. Quando a origem
--   escreve, avisa-se o regulador que assumiu (ou os reguladores escalados no
--   dia na central; sem escala, todos os da central).
-- • Leitura da conversa por pessoa (public.regulacao_conversa_leitura): o aviso
--   de mensagem nova na lista de pacientes em regulação.
-- • R1/R2, NIR e gestor: regulacao_pacientes (internados da unidade, por setor,
--   e quem tem regulação em aberto saindo dela, com situação, prazo, pendência e
--   o que o regulador pergunta) e regulacao_do_paciente (a aba Regulação).
-- • Pendência formal do regulador (regulacao_pendencia): o aviso passa a ir
--   também ao médico e ao NIR escalados no dia na origem.
-- • Cobrança do NIR (nir_cobrar): além do responsável, o médico e o NIR
--   escalados no dia na unidade recebem o aviso.
--
-- Só adiciona (expand). Idempotente. Rollback em
-- docs/regulacao/ROLLBACK-20270421000040.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── tabelas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulacao_mensagens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  uuid NOT NULL REFERENCES public.regulacao_solicitacoes(id),
  autor_id        uuid NOT NULL REFERENCES public.perfis(id),
  lado            text NOT NULL CHECK (lado IN ('origem', 'central')),
  intencao        text NOT NULL DEFAULT 'mensagem' CHECK (intencao IN ('mensagem', 'pergunta', 'pedido')),
  texto           text NOT NULL CHECK (length(btrim(texto)) BETWEEN 2 AND 4000),
  em              timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (lado = 'central' OR intencao = 'mensagem')
);
CREATE INDEX IF NOT EXISTS idx_regulacao_mensagens ON public.regulacao_mensagens (solicitacao_id, em);
CREATE INDEX IF NOT EXISTS idx_regulacao_mensagens_autor ON public.regulacao_mensagens (autor_id);
DROP TRIGGER IF EXISTS trg_regulacao_mensagens_so_insercao ON public.regulacao_mensagens;
CREATE TRIGGER trg_regulacao_mensagens_so_insercao BEFORE UPDATE OR DELETE ON public.regulacao_mensagens
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

CREATE TABLE IF NOT EXISTS public.regulacao_conversa_leitura (
  solicitacao_id  uuid NOT NULL REFERENCES public.regulacao_solicitacoes(id),
  perfil_id       uuid NOT NULL REFERENCES public.perfis(id),
  lida_em         timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (solicitacao_id, perfil_id)
);
CREATE INDEX IF NOT EXISTS idx_regulacao_conversa_leitura_perfil ON public.regulacao_conversa_leitura (perfil_id);

ALTER TABLE public.regulacao_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulacao_conversa_leitura ENABLE ROW LEVEL SECURITY;
-- como as outras tabelas da regulação: leitura e escrita pelas RPCs abaixo
REVOKE ALL ON public.regulacao_mensagens, public.regulacao_conversa_leitura FROM anon, authenticated;

-- Quem vê o pedido (origem: médico, gestor e NIR; central: regulador e gestor;
-- destino enquanto o pedido é dele; super admin), pelo id.
CREATE OR REPLACE FUNCTION private.regulacao_pode_ver_id(p_sol uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT private.regulacao_pode_ver(s) FROM public.regulacao_solicitacoes s WHERE s.id = p_sol), false)
$$;
REVOKE ALL ON FUNCTION private.regulacao_pode_ver_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.regulacao_pode_ver_id(uuid) TO authenticated;

-- Políticas (defesa em profundidade; sem GRANT, o caminho são as RPCs):
-- leem a equipe da origem, o NIR da origem, o regulador e o gestor da central;
-- o autor grava só a própria mensagem.
DROP POLICY IF EXISTS regulacao_mensagens_ler ON public.regulacao_mensagens;
CREATE POLICY regulacao_mensagens_ler ON public.regulacao_mensagens FOR SELECT TO authenticated
  USING (private.regulacao_pode_ver_id(solicitacao_id));
DROP POLICY IF EXISTS regulacao_mensagens_gravar ON public.regulacao_mensagens;
CREATE POLICY regulacao_mensagens_gravar ON public.regulacao_mensagens FOR INSERT TO authenticated
  WITH CHECK (autor_id = private.meu_perfil_id() AND private.regulacao_pode_ver_id(solicitacao_id));
DROP POLICY IF EXISTS regulacao_conversa_leitura_propria ON public.regulacao_conversa_leitura;
CREATE POLICY regulacao_conversa_leitura_propria ON public.regulacao_conversa_leitura FOR ALL TO authenticated
  USING (perfil_id = private.meu_perfil_id()) WITH CHECK (perfil_id = private.meu_perfil_id());

-- ── apoio ───────────────────────────────────────────────────────────────────
-- Pessoas escaladas no dia de hoje (horário de Brasília) na unidade, num dos
-- papéis. O plantão conta pela categoria gravada; sem ela, pelo vínculo.
CREATE OR REPLACE FUNCTION private.escalados_no_dia(p_unidade uuid, p_papeis text[])
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH dia AS (
    SELECT ((now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AS ini
  )
  SELECT ARRAY(
    SELECT DISTINCT e.perfil_id
      FROM public.escala_plantao e, dia
     WHERE e.unidade_id = p_unidade AND e.ativo
       AND e.inicio < dia.ini + interval '1 day'
       AND e.inicio + make_interval(mins => e.duracao_min) > dia.ini
       AND EXISTS (SELECT 1 FROM public.vinculos v
                    WHERE v.perfil_id = e.perfil_id AND v.unidade_id = p_unidade AND v.ativo
                      AND v.papel::text = ANY (p_papeis)
                      AND (e.papel IS NULL OR e.papel::text = v.papel::text)))
$$;
REVOKE ALL ON FUNCTION private.escalados_no_dia(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- Pedido em aberto (ainda há o que acompanhar).
CREATE OR REPLACE FUNCTION private.regulacao_em_aberto(p_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_status NOT IN ('realizada', 'falta', 'negada', 'cancelada', 'excluida')
$$;
REVOKE ALL ON FUNCTION private.regulacao_em_aberto(text) FROM PUBLIC, anon, authenticated;

-- Lado de quem está logado na conversa do pedido (NULL = só lê).
CREATE OR REPLACE FUNCTION private.regulacao_meu_lado(s public.regulacao_solicitacoes)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN private.tenho_papel(s.central_id, 'regulador') THEN 'central'
    WHEN private.tenho_papel(s.unidade_origem_id, 'plantonista') OR private.tenho_papel(s.unidade_origem_id, 'gestor')
      OR private.sou_nir(s.unidade_origem_id) THEN 'origem'
  END
$$;
REVOKE ALL ON FUNCTION private.regulacao_meu_lado(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- Estado da conversa para quem consulta pela origem: o que a central escreveu
-- depois da última mensagem da origem (aguardando) e o que é novo para mim.
CREATE OR REPLACE FUNCTION private.regulacao_conversa_estado(s public.regulacao_solicitacoes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH ult AS (
    SELECT max(m.em) FILTER (WHERE m.lado = 'origem') AS origem_em, count(*) AS total
      FROM public.regulacao_mensagens m WHERE m.solicitacao_id = s.id
  ), lida AS (
    SELECT l.lida_em FROM public.regulacao_conversa_leitura l
     WHERE l.solicitacao_id = s.id AND l.perfil_id = private.meu_perfil_id()
  )
  SELECT jsonb_build_object(
    'total', (SELECT total FROM ult),
    'novas', (SELECT count(*) FROM public.regulacao_mensagens m
               WHERE m.solicitacao_id = s.id AND m.lado = 'central'
                 AND m.em > coalesce((SELECT lida_em FROM lida), '-infinity'::timestamptz)),
    'aguardando', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'texto', m.texto, 'intencao', m.intencao, 'em', m.em,
          'autor', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = m.autor_id)) ORDER BY m.em)
        FROM public.regulacao_mensagens m
       WHERE m.solicitacao_id = s.id AND m.lado = 'central'
         AND m.em > coalesce((SELECT origem_em FROM ult), '-infinity'::timestamptz)), '[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION private.regulacao_conversa_estado(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- Resumo do pedido para as listas do paciente (sem o quadro clínico).
CREATE OR REPLACE FUNCTION private.regulacao_resumo(s public.regulacao_solicitacoes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'numero', s.numero, 'status', s.status, 'tipo', s.tipo, 'carater', s.carater,
    'prioridade', s.prioridade, 'prioridade_regulador', s.prioridade_regulador,
    'especialidade', s.especialidade, 'procedimento', s.procedimento,
    'procedimento_nome', (SELECT p.nome FROM terminologia.sigtap_procedimento p WHERE p.codigo = s.procedimento),
    'tipo_leito', s.tipo_leito, 'transporte', s.transporte, 'cid', s.cid,
    'destino', CASE s.destino_tipo
      WHEN 'rede' THEN (SELECT u.nome FROM public.unidades u WHERE u.id = s.destino_unidade_id)
      WHEN 'externo' THEN s.destino_externo END,
    'criada_em', s.criada_em, 'em_aberto', private.regulacao_em_aberto(s.status),
    'pendencia_pergunta', CASE WHEN s.status = 'pendencia' THEN s.pendencia_pergunta END,
    'pendencia_em', CASE WHEN s.status = 'pendencia' THEN s.pendencia_em END,
    'motivo_devolucao', CASE WHEN s.status = 'devolvida' THEN s.motivo_devolucao END,
    'sla', CASE WHEN private.regulacao_em_aberto(s.status) THEN private.regulacao_sla(s) END,
    'conversa', private.regulacao_conversa_estado(s))
$$;
REVOKE ALL ON FUNCTION private.regulacao_resumo(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- Avisa um conjunto de pessoas (sem repetir e sem o autor), numa unidade.
CREATE OR REPLACE FUNCTION private.regulacao_avisar_pessoas(p_pessoas uuid[], p_unidade uuid, p_tipo text, p_mensagem text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_n integer;
BEGIN
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT q, p_unidade, current_date, p_tipo, p_mensagem
    FROM unnest(p_pessoas) q
   WHERE q IS NOT NULL AND q IS DISTINCT FROM private.meu_perfil_id()
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
    SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_avisar_pessoas(uuid[], uuid, text, text) FROM PUBLIC, anon, authenticated;

-- A pendência formal do regulador também avisa o médico e o NIR escalados no
-- dia na origem (o resto dos avisos segue como era: solicitante e assistente).
CREATE OR REPLACE FUNCTION private.regulacao_avisar(s public.regulacao_solicitacoes, p_tipo text, p_mensagem text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT q, s.unidade_origem_id, current_date, p_tipo || '_' || s.numero, p_mensagem
    FROM unnest(ARRAY[s.solicitante_id, s.medico_assistente_id]
                || CASE WHEN p_tipo = 'reg_pendencia'
                        THEN private.escalados_no_dia(s.unidade_origem_id, ARRAY['plantonista', 'nir'])
                        ELSE '{}'::uuid[] END) q
   WHERE q IS NOT NULL
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
    SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now()
$$;
REVOKE ALL ON FUNCTION private.regulacao_avisar(public.regulacao_solicitacoes, text, text) FROM PUBLIC, anon, authenticated;

-- ── R3: conversa ────────────────────────────────────────────────────────────
-- Lê a conversa do pedido e marca como lida para quem leu.
CREATE OR REPLACE FUNCTION public.regulacao_conversa(p_solicitacao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_lado text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao;
  IF NOT FOUND OR NOT private.regulacao_pode_ver(s) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  v_lado := private.regulacao_meu_lado(s);
  INSERT INTO public.regulacao_conversa_leitura (solicitacao_id, perfil_id, lida_em)
  VALUES (s.id, private.meu_perfil_id(), clock_timestamp())
  ON CONFLICT (solicitacao_id, perfil_id) DO UPDATE SET lida_em = clock_timestamp();
  RETURN jsonb_build_object(
    'meu_lado', v_lado,
    'pode_escrever', v_lado IS NOT NULL AND s.status NOT IN ('cancelada', 'excluida', 'realizada'),
    'mensagens', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'lado', m.lado, 'intencao', m.intencao, 'texto', m.texto, 'em', m.em,
        'autor', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = m.autor_id),
        'minha', m.autor_id = private.meu_perfil_id()) ORDER BY m.em)
      FROM public.regulacao_mensagens m WHERE m.solicitacao_id = s.id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_conversa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_conversa(uuid) TO authenticated;

-- Escreve na conversa. O autor é quem está logado; o lado sai do papel.
CREATE OR REPLACE FUNCTION public.regulacao_conversa_enviar(p_solicitacao uuid, p_texto text, p_intencao text DEFAULT 'mensagem')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.regulacao_solicitacoes;
  v_lado text;
  v_intencao text := coalesce(nullif(btrim(p_intencao), ''), 'mensagem');
  v_texto text := btrim(coalesce(p_texto, ''));
  v_id uuid;
  v_para uuid[];
  v_verbo text;
  v_n integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao;
  IF NOT FOUND OR NOT private.regulacao_pode_ver(s) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  v_lado := private.regulacao_meu_lado(s);
  IF v_lado IS NULL THEN
    RAISE EXCEPTION 'Escrevem a equipe e o NIR da unidade de origem e o médico regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status IN ('cancelada', 'excluida', 'realizada') THEN RAISE EXCEPTION 'Este pedido está encerrado.'; END IF;
  IF v_intencao NOT IN ('mensagem', 'pergunta', 'pedido') THEN RAISE EXCEPTION 'Tipo de mensagem inválido.'; END IF;
  IF v_lado = 'origem' AND v_intencao <> 'mensagem' THEN v_intencao := 'mensagem'; END IF;
  IF length(v_texto) < 2 THEN RAISE EXCEPTION 'Escreva a mensagem.'; END IF;
  IF length(v_texto) > 4000 THEN RAISE EXCEPTION 'A mensagem vai até 4000 letras.'; END IF;

  INSERT INTO public.regulacao_mensagens (solicitacao_id, autor_id, lado, intencao, texto)
  VALUES (s.id, private.meu_perfil_id(), v_lado, v_intencao, v_texto)
  RETURNING id INTO v_id;
  INSERT INTO public.regulacao_conversa_leitura (solicitacao_id, perfil_id, lida_em)
  VALUES (s.id, private.meu_perfil_id(), clock_timestamp())
  ON CONFLICT (solicitacao_id, perfil_id) DO UPDATE SET lida_em = clock_timestamp();
  PERFORM private.regulacao_evento(s.id, 'mensagem', jsonb_build_object('lado', v_lado, 'intencao', v_intencao));

  IF v_lado = 'central' THEN
    v_para := ARRAY[s.solicitante_id, s.medico_assistente_id]
              || private.escalados_no_dia(s.unidade_origem_id, ARRAY['plantonista', 'nir']);
    v_verbo := CASE v_intencao WHEN 'pergunta' THEN 'o regulador pergunta' WHEN 'pedido' THEN 'o regulador pede' ELSE 'o regulador escreveu' END;
    v_n := private.regulacao_avisar_pessoas(v_para, s.unidade_origem_id, 'reg_conversa_' || s.numero,
      'Regulação nº ' || s.numero || ': ' || v_verbo || ' — ' || left(v_texto, 300));
  ELSE
    v_para := CASE
      WHEN s.assumida_por IS NOT NULL THEN ARRAY[s.assumida_por]
      ELSE coalesce(nullif(private.escalados_no_dia(s.central_id, ARRAY['regulador']), '{}'),
                    private.nir_com_papel(s.central_id, ARRAY['regulador'])) END;
    v_n := private.regulacao_avisar_pessoas(v_para, s.central_id, 'reg_conversa_' || s.numero,
      'Regulação nº ' || s.numero || ': a origem escreveu — ' || left(v_texto, 300));
  END IF;

  PERFORM private.registrar_auditoria('regulacao_mensagem', 'regulacao_mensagens', v_id,
    CASE v_lado WHEN 'central' THEN s.central_id ELSE s.unidade_origem_id END,
    jsonb_build_object('situacao', v_lado, 'tipo', v_intencao, 'quantidade', v_n));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_conversa_enviar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_conversa_enviar(uuid, text, text) TO authenticated;

-- ── R1/R2, NIR e gestor: pacientes e pedidos da unidade ─────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_exigir_unidade(p_unidade uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor')
          OR private.sou_nir(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_exigir_unidade(uuid) FROM PUBLIC, anon, authenticated;

-- Internados da unidade (observação incluída) e quem tem regulação em aberto
-- saindo dela, com o setor, o leito e os pedidos em aberto.
CREATE OR REPLACE FUNCTION public.regulacao_pacientes(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_exigir_unidade(p_unidade);
  RETURN coalesce((
    WITH inter AS (
      SELECT DISTINCT ON (i.paciente_id) i.*
        FROM public.internacoes i
       WHERE i.unidade_id = p_unidade AND i.data_alta IS NULL
       ORDER BY i.paciente_id, i.data_admissao DESC
    ), regs AS (
      SELECT s.* FROM public.regulacao_solicitacoes s
       WHERE s.unidade_origem_id = p_unidade AND private.regulacao_em_aberto(s.status)
    ), pac AS (
      SELECT paciente_id FROM inter UNION SELECT paciente_id FROM regs
    ), linhas AS (
      SELECT pa.id, coalesce(pa.nome_social, pa.nome) AS nome, pa.data_nascimento,
             i.id AS internacao_id, i.tipo_internacao, i.data_admissao, i.episodio_id,
             se.id AS setor_id, se.nome AS setor_nome, le.identificador AS leito
        FROM pac
        JOIN public.pacientes pa ON pa.id = pac.paciente_id
        LEFT JOIN inter i ON i.paciente_id = pa.id
        LEFT JOIN public.setores se ON se.id = i.setor_atual_id
        LEFT JOIN public.leitos le ON le.id = i.leito_atual_id
    )
    SELECT jsonb_agg(jsonb_build_object(
        'paciente', jsonb_build_object('id', l.id, 'nome', l.nome, 'nascimento', l.data_nascimento),
        'internacao', CASE WHEN l.internacao_id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', l.internacao_id, 'tipo', l.tipo_internacao, 'admissao', l.data_admissao, 'episodio_id', l.episodio_id) END,
        'setor', CASE WHEN l.setor_id IS NULL THEN NULL ELSE jsonb_build_object('id', l.setor_id, 'nome', l.setor_nome) END,
        'leito', l.leito,
        'pedidos', coalesce((SELECT jsonb_agg(private.regulacao_resumo(r) ORDER BY r.criada_em DESC)
                               FROM regs r WHERE r.paciente_id = l.id), '[]'::jsonb))
      ORDER BY l.setor_nome NULLS LAST, l.leito NULLS LAST, l.nome)
      FROM linhas l), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_pacientes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_pacientes(uuid) TO authenticated;

-- Pedidos do paciente saídos desta unidade (a aba Regulação): em aberto
-- primeiro, depois os mais recentes; até 20.
CREATE OR REPLACE FUNCTION public.regulacao_do_paciente(p_unidade uuid, p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_exigir_unidade(p_unidade);
  RETURN jsonb_build_object(
    'pode_solicitar', private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor') OR private.sou_nir(p_unidade),
    'pedidos', coalesce((SELECT jsonb_agg(private.regulacao_resumo(x) ORDER BY private.regulacao_em_aberto(x.status) DESC, x.criada_em DESC)
      FROM (SELECT * FROM public.regulacao_solicitacoes s
             WHERE s.unidade_origem_id = p_unidade AND s.paciente_id = p_paciente
             ORDER BY private.regulacao_em_aberto(s.status) DESC, s.criada_em DESC LIMIT 20) x), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_do_paciente(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_do_paciente(uuid, uuid) TO authenticated;

-- ── cobrança do NIR: também o médico e o NIR escalados no dia ───────────────
CREATE OR REPLACE FUNCTION public.nir_cobrar(p_unidade uuid, p_tipo text, p_ref uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it record; v_tipo_aviso text; v_n integer; v_para uuid[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.nir_exigir(p_unidade);
  SELECT * INTO it FROM private.nir_itens(p_unidade) x WHERE x.tipo = p_tipo AND x.ref_id = p_ref LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta pendência não está mais em aberto.'; END IF;
  v_para := ARRAY(SELECT DISTINCT q FROM unnest(it.responsaveis || private.escalados_no_dia(p_unidade, ARRAY['plantonista', 'nir'])) q
                   WHERE q IS NOT NULL AND q IS DISTINCT FROM private.meu_perfil_id());
  IF cardinality(v_para) = 0 THEN RAISE EXCEPTION 'Não há responsável para cobrar nesta pendência.'; END IF;
  v_tipo_aviso := CASE it.grupo
    WHEN 'regulacao' THEN 'reg_cobranca_' || (SELECT numero FROM public.regulacao_solicitacoes WHERE id = p_ref)
    WHEN 'aih' THEN 'nir_aih_' || left(p_ref::text, 8)
    ELSE 'nir_apac_' || left(p_ref::text, 8) END;
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT q, p_unidade, current_date, v_tipo_aviso,
         'NIR: ' || it.titulo || coalesce(' — ' || (SELECT coalesce(pa.nome_social, pa.nome) FROM public.pacientes pa WHERE pa.id = it.paciente_id), '')
         || '. Parado desde ' || to_char(it.desde AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.'
    FROM unnest(v_para) q
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO public.nir_cobrancas (unidade_id, tipo, ref_id, destinatarios, por)
  VALUES (p_unidade, p_tipo, p_ref, v_para, private.meu_perfil_id());
  PERFORM private.registrar_auditoria('nir_cobranca', 'nir_cobrancas', p_ref, p_unidade, jsonb_build_object('tipo', p_tipo, 'quantidade', v_n));
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.nir_cobrar(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nir_cobrar(uuid, text, uuid) TO authenticated;
