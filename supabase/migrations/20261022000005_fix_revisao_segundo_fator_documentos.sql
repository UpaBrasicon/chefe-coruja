-- ════════════════════════════════════════════════════════════════════════════
-- Correções da revisão de 02/10/2026 (segunda leva). Gerado a partir das
-- definições em vigor (iguais às da produção), com mudanças mínimas:
--
-- 1. Segundo fator em funções SECURITY DEFINER que liam dado de paciente sem
--    ele (a RLS restritiva de 2FA não vale dentro de SECURITY DEFINER):
--    notificacao_ficha, notificacao_compulsoria_periodo, minha_situacao_tele,
--    tele_outras_em_atendimento, tele_pendencias, tele_historico; e nas
--    escritas do gestor que o cabeçalho prometia (fracionar_plantao,
--    remover_fracionamento, aprovar_candidatura).
-- 2. cancelar_documento: cancelar a versão 2 de um pedido de exames retificado
--    deixava os exames da versão 1 como 'pedido' (e eles barravam a alta).
--    Agora cancela os exames de todas as versões do documento.
-- 3. copiar_documento: não copia termo de consentimento nem prescrição (a
--    cópia virava rascunho emitido sem as regras de emitir_termo_consentimento
--    — quem assina, responsável — nem as da prescrição estruturada).
-- 4. remover_fracionamento: contava as partes de ciclos antigos já fechados e
--    multiplicava a duração errado (podia passar do limite e travar o
--    desfazer). Conta só as vagas ainda abertas.
-- 5. admissao_fichas sem a guarda de 20 anos; anexos_prontuario e
--    impressoes_prontuario sem as leituras de pedido de acesso e
--    teleinterconsulta; motivos de encerramento de diluição legíveis por
--    farmacêutico de qualquer unidade.
-- ════════════════════════════════════════════════════════════════════════════

-- public.notificacao_ficha(uuid)
CREATE OR REPLACE FUNCTION public.notificacao_ficha(p_agravo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.agravos_notificacao; v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
  SELECT * INTO a FROM public.agravos_notificacao WHERE id = p_agravo;
  IF NOT FOUND OR NOT private.pode_notificar(a.unidade_id) THEN RAISE EXCEPTION 'Notificação não encontrada.'; END IF;
  SELECT jsonb_build_object(
    'id', a.id, 'paciente_id', a.paciente_id, 'paciente_nome', pa.nome, 'episodio_id', a.episodio_id, 'internacao_id', a.internacao_id,
    'agravo', a.agravo, 'cid', a.cid, 'situacao', a.situacao, 'origem', a.origem, 'ficha', a.ficha,
    'numero_sinan', a.numero_sinan, 'suspeito_em', a.suspeito_em,
    'registrado_em', CASE WHEN a.situacao = 'notificado' THEN a.resolvido_em END,
    'registrado_por', CASE WHEN a.situacao = 'notificado' THEN rp.nome_completo END,
    'reaberto_em', a.reaberto_em, 'reaberto_por', rb.nome_completo, 'motivo_reabertura', a.motivo_reabertura,
    'motivo_descarte', a.motivo_descarte,
    'item', l.item, 'imediata', l.imediata, 'destino', l.destino, 'condicao', l.condicao, 'conferido', l.conferido_em IS NOT NULL,
    'unidade', jsonb_build_object('nome', u.nome, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf),
    'notificador', jsonb_build_object('nome', eu.nome_completo, 'conselho', eu.conselho, 'registro', eu.registro_numero, 'registro_uf', eu.registro_uf),
    'pendencias', to_jsonb(private.ficha_sinan_pendencias(a.ficha)),
    'pode_abrir_paciente', private.pode_atuar_no_paciente(a.paciente_id))
  INTO v
  FROM public.pacientes pa
  JOIN public.unidades u ON u.id = a.unidade_id
  LEFT JOIN public.lnnc_agravos l ON l.item = coalesce(a.lnnc_item, private.lnnc_item_do_cid(a.cid))
  LEFT JOIN public.perfis rp ON rp.id = a.resolvido_por
  LEFT JOIN public.perfis rb ON rb.id = a.reaberto_por
  LEFT JOIN public.perfis eu ON eu.id = private.meu_perfil_id()
  WHERE pa.id = a.paciente_id;
  RETURN v;
END $function$;

-- public.notificacao_compulsoria_periodo(uuid,date,date,text[])
CREATE OR REPLACE FUNCTION public.notificacao_compulsoria_periodo(p_unidade uuid, p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date, p_cids text[] DEFAULT NULL::text[])
 RETURNS TABLE(chave text, atendimento_em timestamp with time zone, paciente_id uuid, paciente_nome text, local text, origem text, episodio_id uuid, internacao_id uuid, cid text, cid_descricao text, item text, item_numero integer, agravo text, imediata boolean, destino text, condicao text, conferido boolean, agravo_id uuid, situacao text, numero_sinan text, registrado_por text, registrado_em timestamp with time zone, reaberto_em timestamp with time zone, motivo_reabertura text, pendencias text[], no_acesso boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_ate date := coalesce(p_ate, private.data_atual());
  v_filtro text[];
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
  IF NOT private.pode_notificar(p_unidade) THEN
    RAISE EXCEPTION 'A lista de notificação compulsória é da equipe de plantão da unidade e da gestão.';
  END IF;
  IF p_de IS NOT NULL AND p_de > v_ate THEN RAISE EXCEPTION 'Período: a data inicial é depois da final.'; END IF;
  SELECT array_agg(DISTINCT private.cid_do_texto(c)) FILTER (WHERE private.cid_do_texto(c) IS NOT NULL)
    INTO v_filtro FROM unnest(coalesce(p_cids, '{}'::text[])) c;

  RETURN QUERY
  WITH det AS (
    SELECT d.paciente_id AS pac, d.episodio_id AS ep, d.internacao_id AS it, d.cid AS cid, d.descricao AS descr, d.registrado_em AS em,
           CASE WHEN d.internacao_id IS NOT NULL THEN 'Diagnóstico do leito' ELSE 'Diagnóstico da porta' END AS org
      FROM public.diagnosticos_episodio d
     WHERE d.unidade_id = p_unidade AND d.encerramento IS DISTINCT FROM 'retirado'
    UNION ALL
    SELECT r.paciente_id, r.episodio_id, NULL::uuid, private.cid_normalizado(r.cid), NULL::text, r.criado_em, 'CID do atendimento'
      FROM public.atendimento_registros r
     WHERE r.unidade_id = p_unidade AND r.cid IS NOT NULL
    UNION ALL
    SELECT i.paciente_id, i.episodio_id, i.id, private.cid_normalizado(i.cid_alta), NULL::text, coalesce(i.alta_registrada_em, i.data_alta, i.updated_at), 'CID da alta'
      FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.cid_alta IS NOT NULL
  ),
  det2 AS (
    SELECT x.*, private.lnnc_item_do_cid(x.cid) AS itm,
           coalesce(x.ep, (SELECT i.episodio_id FROM public.internacoes i WHERE i.id = x.it)) AS ep2,
           coalesce(x.it, (SELECT i.id FROM public.internacoes i WHERE i.episodio_id = x.ep)) AS it2
      FROM det x
  ),
  agr AS (
    SELECT a.*, coalesce(a.lnnc_item, private.lnnc_item_do_cid(a.cid)) AS itm,
           coalesce(a.episodio_id, (SELECT i.episodio_id FROM public.internacoes i WHERE i.id = a.internacao_id)) AS ep2,
           coalesce(a.internacao_id, (SELECT i.id FROM public.internacoes i WHERE i.episodio_id = a.episodio_id)) AS it2
      FROM public.agravos_notificacao a
     WHERE a.unidade_id = p_unidade
  ),
  casos AS (
    -- notificações abertas (qualquer situação)
    SELECT 'agravo:' || a.id AS chv, a.paciente_id AS pac, a.ep2, a.it2, a.cid, NULL::text AS descr, a.itm, a.agravo AS nome_agravo,
           CASE a.origem WHEN 'manual' THEN 'Aberta na notificação' WHEN 'cid' THEN 'Aberta pelo CID' ELSE 'Suspeita marcada pelo médico' END AS org,
           a.id AS agr_id, a.suspeito_em AS em,
           CASE WHEN a.situacao = 'notificado' THEN 'notificado' WHEN a.situacao = 'descartado' THEN 'descartado'
                WHEN a.reaberto_em IS NOT NULL THEN 'reaberto' ELSE 'a_registrar' END AS sit,
           a.numero_sinan AS num, a.resolvido_por AS reg_por, CASE WHEN a.situacao = 'notificado' THEN a.resolvido_em END AS reg_em,
           a.reaberto_em AS reab_em, a.motivo_reabertura AS reab_mot,
           CASE WHEN a.situacao = 'suspeito' THEN private.ficha_sinan_pendencias(a.ficha) END AS pend
      FROM agr a
    UNION ALL
    -- CID notificável sem notificação aberta do mesmo agravo no mesmo atendimento: só sugestão
    (SELECT DISTINCT ON (coalesce(d.ep2, d.it2), d.itm)
           'cid:' || coalesce(d.ep2, d.it2) || ':' || d.itm, d.pac, d.ep2, d.it2, d.cid, d.descr, d.itm, NULL::text, d.org,
           NULL::uuid, d.em, 'sugerido', NULL::text, NULL::uuid, NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::text[]
      FROM det2 d
     WHERE d.itm IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM agr a
                        WHERE a.itm = d.itm AND a.paciente_id = d.pac
                          AND (a.ep2 = d.ep2 OR a.it2 = d.it2))
     ORDER BY coalesce(d.ep2, d.it2), d.itm, d.em)
  )
  SELECT c.chv,
         coalesce(e.chegada_em, i.data_admissao, c.em) AS quando,
         c.pac, pa.nome,
         CASE WHEN i.id IS NOT NULL AND i.status IN ('admitido', 'em_observacao', 'internado')
              THEN concat_ws(' · ', si.nome, CASE WHEN le.identificador IS NOT NULL THEN 'Leito ' || le.identificador END)
              WHEN e.id IS NOT NULL THEN concat_ws(' · ', se.nome, CASE WHEN e.etapa = 'encerrado' OR e.desfecho IS NOT NULL THEN 'atendimento encerrado' END)
              ELSE si.nome END,
         c.org, c.ep2, c.it2, c.cid,
         coalesce(c.descr, (SELECT t.descricao FROM terminologia.cid10 t WHERE t.codigo IN (c.cid, replace(c.cid, '.', '')) LIMIT 1)),
         l.item, l.numero, coalesce(l.agravo, c.nome_agravo), coalesce(l.imediata, false), l.destino, l.condicao, l.conferido_em IS NOT NULL,
         c.agr_id, c.sit, c.num, rp.nome_completo, c.reg_em, c.reab_em, c.reab_mot, c.pend,
         private.pode_atuar_no_paciente(c.pac)
    FROM casos c
    JOIN public.pacientes pa ON pa.id = c.pac
    LEFT JOIN public.episodios e ON e.id = c.ep2
    LEFT JOIN public.internacoes i ON i.id = c.it2
    LEFT JOIN public.setores se ON se.id = e.setor_id
    LEFT JOIN public.setores si ON si.id = i.setor_atual_id
    LEFT JOIN public.leitos le ON le.id = i.leito_atual_id
    LEFT JOIN public.lnnc_agravos l ON l.item = c.itm
    LEFT JOIN public.perfis rp ON rp.id = c.reg_por
   WHERE (p_de IS NULL OR (coalesce(e.chegada_em, i.data_admissao, c.em) AT TIME ZONE 'America/Sao_Paulo')::date >= p_de)
     AND (coalesce(e.chegada_em, i.data_admissao, c.em) AT TIME ZONE 'America/Sao_Paulo')::date <= v_ate
     AND (v_filtro IS NULL OR EXISTS (SELECT 1 FROM unnest(v_filtro) f WHERE c.cid = f OR starts_with(c.cid, f || CASE WHEN length(f) = 3 THEN '.' ELSE '' END)))
   ORDER BY (c.sit IN ('sugerido', 'a_registrar', 'reaberto')) DESC, coalesce(l.imediata, false) DESC, 2 DESC;
END $function$;

-- public.minha_situacao_tele(uuid)
CREATE OR REPLACE FUNCTION public.minha_situacao_tele(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_perfil uuid := private.meu_perfil_id(); p public.escala_plantao;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
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
END $function$;

-- public.tele_outras_em_atendimento(uuid)
CREATE OR REPLACE FUNCTION public.tele_outras_em_atendimento(p_unidade uuid)
 RETURNS TABLE(id uuid, setor text, consultor text, urgencia text, aceita_em timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
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
END $function$;

-- public.tele_pendencias()
CREATE OR REPLACE FUNCTION public.tele_pendencias()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
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
END $function$;

-- public.tele_historico(integer)
CREATE OR REPLACE FUNCTION public.tele_historico(p_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_perfil uuid := private.meu_perfil_id(); v_desde timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365)));
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
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
END $function$;

-- public.fracionar_plantao(uuid,integer)
CREATE OR REPLACE FUNCTION public.fracionar_plantao(p_plantao uuid, p_partes integer DEFAULT 2)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_pl public.escala_plantao%ROWTYPE;
  v_setor text;
  v_parte int;
  v_ini timestamptz;
  v_faixa record;
  v_vaga uuid;
  v_aviso uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = p_plantao AND ativo FOR UPDATE;
  IF v_pl.id IS NULL THEN RAISE EXCEPTION 'Plantão não encontrado ou inativo.'; END IF;
  IF NOT (private.gestor_da_unidade(v_pl.unidade_id) OR v_pl.perfil_id = v_perfil) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o plantonista escalado ou o gestor podem fracionar.';
  END IF;
  IF p_partes IS NULL OR p_partes < 2 OR p_partes > 4 THEN
    RAISE EXCEPTION 'O número de partes deve ser entre 2 e 4.';
  END IF;
  IF v_pl.fracionado OR v_pl.plantao_origem_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este plantão já foi fracionado.';
  END IF;
  IF v_pl.duracao_min % p_partes <> 0 OR v_pl.duracao_min / p_partes < 60 THEN
    RAISE EXCEPTION 'Este plantão não se divide em % partes iguais de pelo menos 1 hora.', p_partes;
  END IF;
  IF v_pl.inicio + make_interval(mins => v_pl.duracao_min / p_partes) <= now() THEN
    RAISE EXCEPTION 'A segunda parte deste plantão já começou: não dá mais para fracionar.';
  END IF;

  SELECT nome INTO v_setor FROM public.setores WHERE id = v_pl.setor_id;

  -- 1ª parte: o próprio registro, encurtado (check-in e presença continuam nele)
  UPDATE public.escala_plantao
     SET fracionado = true, duracao_min = v_pl.duracao_min / p_partes
   WHERE id = v_pl.id;

  -- demais partes: vagas marcadas com a janela de cada uma
  FOR v_parte IN 2..p_partes LOOP
    v_ini := v_pl.inicio + make_interval(mins => (v_parte - 1) * (v_pl.duracao_min / p_partes));
    SELECT * INTO v_faixa FROM private.faixa_do_instante(v_pl.data, v_ini);
    INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, observacao, aberta_por,
                                     inicio, duracao_min, plantao_origem_id, parte, partes)
    VALUES (v_pl.unidade_id, v_pl.setor_id, v_faixa.data, v_faixa.turno,
            'Parte ' || v_parte || ' de ' || p_partes || ' do plantão de ' || to_char(v_pl.data, 'DD/MM'),
            v_perfil, v_ini, v_pl.duracao_min / p_partes, v_pl.id, v_parte, p_partes)
    RETURNING id INTO v_vaga;
    FOR v_aviso IN SELECT DISTINCT vi.perfil_id FROM public.vinculos vi
                    WHERE vi.unidade_id = v_pl.unidade_id AND vi.papel = 'plantonista' AND vi.ativo
                      AND vi.perfil_id IS DISTINCT FROM v_pl.perfil_id LOOP
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      VALUES (v_aviso, v_pl.unidade_id, v_faixa.data, 'vaga_' || v_vaga,
              'Vaga aberta em ' || coalesce(v_setor, 'setor') || ': parte ' || v_parte || ' de ' || p_partes
                || ' do plantão de ' || to_char(v_pl.data, 'DD/MM') || ', '
                || to_char(v_ini AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '–'
                || to_char((v_ini + make_interval(mins => v_pl.duracao_min / p_partes)) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
                || '. Candidate-se em Vagas.')
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
    END LOOP;
  END LOOP;

  INSERT INTO public.historico_escala (unidade_id, plantao_id, perfil_id, acao, detalhe, dados)
  VALUES (v_pl.unidade_id, v_pl.id, v_perfil, 'fracionar',
          coalesce(v_setor, 'Setor') || ' · ' || to_char(v_pl.data, 'DD/MM') || ' · ' || v_pl.turno || ' em ' || p_partes || ' partes',
          jsonb_build_object('plantao_id', v_pl.id, 'partes', p_partes, 'duracao_original_min', v_pl.duracao_min));
  RETURN p_partes;
END $function$;

-- public.aprovar_candidatura(uuid)
CREATE OR REPLACE FUNCTION public.aprovar_candidatura(p_candidatura uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_candidatura public.candidaturas_escala%ROWTYPE;
  v_vaga public.escala_vagas%ROWTYPE;
  v_orig public.escala_plantao%ROWTYPE;
  v_plantao uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
  SELECT * INTO v_candidatura
  FROM public.candidaturas_escala
  WHERE id = p_candidatura
  FOR UPDATE;

  IF v_candidatura.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  IF (private.eh_super_admin() OR private.papel_na_unidade(v_candidatura.unidade_id) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor da unidade aprova candidaturas.';
  END IF;
  IF v_candidatura.perfil_id = private.meu_perfil_id() AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Ninguém aprova a própria candidatura.';
  END IF;
  IF v_candidatura.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta candidatura já foi decidida.';
  END IF;

  IF v_candidatura.vaga_id IS NOT NULL THEN
    SELECT * INTO v_vaga FROM public.escala_vagas WHERE id = v_candidatura.vaga_id FOR UPDATE;
    IF v_vaga.fechada_em IS NOT NULL THEN
      RAISE EXCEPTION 'Esta vaga já foi preenchida ou retirada.';
    END IF;
  END IF;

  IF v_vaga.plantao_origem_id IS NOT NULL THEN
    -- parte de plantão fracionado
    SELECT * INTO v_orig FROM public.escala_plantao WHERE id = v_vaga.plantao_origem_id;
    IF v_orig.id IS NULL OR NOT v_orig.ativo THEN
      RAISE EXCEPTION 'O plantão desta parte não está mais na escala.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.escala_plantao e
                WHERE e.perfil_id = v_candidatura.perfil_id AND e.ativo
                  AND e.inicio < v_vaga.inicio + make_interval(mins => v_vaga.duracao_min)
                  AND e.inicio + make_interval(mins => e.duracao_min) > v_vaga.inicio) THEN
      RAISE EXCEPTION 'O candidato já tem plantão nesse horário.';
    END IF;
    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, rotulo,
                                       quinzenal, fracionado, plantao_origem_id, ativo, criado_por)
    VALUES (v_orig.unidade_id, v_orig.setor_id, v_candidatura.perfil_id, v_orig.data, v_orig.turno,
            v_vaga.inicio, v_vaga.duracao_min, 'Parte ' || v_vaga.parte || '/' || v_vaga.partes,
            false, true, v_orig.id, true, auth.uid())
    RETURNING id INTO v_plantao;
  ELSE
    SELECT e.id INTO v_plantao
    FROM public.escala_plantao e
    WHERE e.setor_id = v_candidatura.setor_id
      AND e.data = v_candidatura.data
      AND e.turno = v_candidatura.turno
      AND e.ativo
    LIMIT 1;

    IF v_plantao IS NOT NULL THEN
      RAISE EXCEPTION 'Este plantão já foi preenchido por outro plantonista.';
    END IF;

    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, ativo, criado_por)
    VALUES (v_candidatura.unidade_id, v_candidatura.setor_id, v_candidatura.perfil_id,
            v_candidatura.data, v_candidatura.turno, true, auth.uid())
    RETURNING id INTO v_plantao;
  END IF;

  UPDATE public.candidaturas_escala
  SET status = 'aprovado', decidido_por = auth.uid()
  WHERE id = p_candidatura;

  IF v_vaga.id IS NOT NULL THEN
    UPDATE public.escala_vagas SET fechada_em = clock_timestamp(), fechada_por = private.meu_perfil_id() WHERE id = v_vaga.id;
    UPDATE public.candidaturas_escala SET status = 'recusado', decidido_por = auth.uid()
     WHERE vaga_id = v_vaga.id AND status = 'pendente' AND id <> p_candidatura;
  END IF;

  RETURN v_plantao;
END;
$function$;

-- public.remover_fracionamento(uuid)
CREATE OR REPLACE FUNCTION public.remover_fracionamento(p_plantao uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_pl public.escala_plantao%ROWTYPE;
  v_partes int;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = p_plantao;
  IF v_pl.id IS NULL THEN RAISE EXCEPTION 'Plantão não encontrado.'; END IF;
  IF v_pl.plantao_origem_id IS NOT NULL THEN
    SELECT * INTO v_pl FROM public.escala_plantao WHERE id = v_pl.plantao_origem_id;
  END IF;
  IF NOT private.gestor_da_unidade(v_pl.unidade_id) THEN
    RAISE EXCEPTION 'Apenas o gestor pode remover fracionamentos.';
  END IF;
  PERFORM 1 FROM public.escala_plantao WHERE id = v_pl.id FOR UPDATE;
  IF NOT v_pl.fracionado THEN RAISE EXCEPTION 'Este plantão não está fracionado.'; END IF;
  IF EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.plantao_origem_id = v_pl.id AND e.ativo) THEN
    RAISE EXCEPTION 'Uma parte já foi assumida por outro plantonista: retire esse plantão antes de desfazer o fracionamento.';
  END IF;
  SELECT max(v.partes) INTO v_partes FROM public.escala_vagas v WHERE v.plantao_origem_id = v_pl.id AND v.fechada_em IS NULL;
  UPDATE public.escala_vagas SET fechada_em = clock_timestamp(), fechada_por = private.meu_perfil_id()
   WHERE plantao_origem_id = v_pl.id AND fechada_em IS NULL;
  UPDATE public.candidaturas_escala SET status = 'recusado', decidido_por = private.meu_perfil_id()
   WHERE status = 'pendente' AND vaga_id IN (SELECT v.id FROM public.escala_vagas v WHERE v.plantao_origem_id = v_pl.id);
  UPDATE public.escala_plantao
     SET fracionado = false, duracao_min = v_pl.duracao_min * coalesce(v_partes, 1)
   WHERE id = v_pl.id;
  INSERT INTO public.historico_escala (unidade_id, plantao_id, perfil_id, acao, detalhe, dados)
  VALUES (v_pl.unidade_id, v_pl.id, private.meu_perfil_id(), 'remover_fracionamento',
          'Fracionamento desfeito (' || to_char(v_pl.data, 'DD/MM') || ' · ' || v_pl.turno || ')',
          jsonb_build_object('plantao_id', v_pl.id, 'partes', v_partes));
END $function$;

-- public.cancelar_documento(uuid,text)
CREATE OR REPLACE FUNCTION public.cancelar_documento(p_documento uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
  v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF d.estado = 'cancelado' AND d.numero IS NOT NULL THEN
    RAISE EXCEPTION 'Este documento já está cancelado.';
  END IF;
  IF d.estado NOT IN ('ativo', 'assinado') OR d.numero IS NULL THEN
    RAISE EXCEPTION 'Só se cancela documento emitido e em vigor. Rascunho se descarta; versão retificada já foi substituída.';
  END IF;
  IF d.tipo_documento NOT IN ('atestado', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'boletim_emergencia',
                              'admissao_anamnese') THEN
    RAISE EXCEPTION 'Este tipo de documento tem cancelamento próprio (alta, termo, parecer, prescrição ou evolução).';
  END IF;
  IF (SELECT x.autor_id FROM public.documentos_clinicos x
       WHERE x.documento_raiz_id = d.documento_raiz_id ORDER BY x.versao LIMIT 1) IS DISTINCT FROM v_perfil THEN
    RAISE EXCEPTION 'Só o autor cancela o próprio documento.';
  END IF;
  IF length(v_motivo) < 15 THEN
    RAISE EXCEPTION 'Informe a justificativa do cancelamento (mínimo de 15 letras).';
  END IF;

  UPDATE public.documentos_clinicos
     SET estado = 'cancelado', cancelado_em = now(), cancelado_por = v_perfil, motivo_cancelamento = v_motivo, updated_at = now()
   WHERE id = d.id
  RETURNING * INTO d;

  IF d.tipo_documento = 'pedido_exames' THEN
    UPDATE public.exames_pedidos
       SET situacao = 'cancelado', motivo_cancelamento = left('Pedido cancelado: ' || v_motivo, 500),
           resolvido_por = v_perfil, resolvido_em = now()
     WHERE documento_id IN (SELECT x.id FROM public.documentos_clinicos x WHERE x.documento_raiz_id = d.documento_raiz_id)
       AND situacao = 'pedido';
  END IF;

  PERFORM private.registrar_auditoria('cancelar_documento', 'documentos_clinicos', d.id, d.unidade_id,
    jsonb_build_object('tipo', d.tipo_documento, 'numero', d.numero, 'motivo', v_motivo));
  RETURN jsonb_build_object('id', d.id, 'numero', d.numero, 'estado', d.estado, 'cancelado_em', d.cancelado_em);
END $function$;

-- public.copiar_documento(uuid)
CREATE OR REPLACE FUNCTION public.copiar_documento(p_documento uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
  v_epi uuid;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF d.numero IS NULL OR d.estado NOT IN ('ativo', 'assinado', 'cancelado', 'retificado') THEN
    RAISE EXCEPTION 'Só se copia documento emitido (em vigor, retificado ou cancelado).';
  END IF;
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(d.paciente_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF d.tipo_documento NOT IN ('atestado', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih',
                              'sumario_alta', 'boletim_emergencia') THEN  -- termo e prescrição têm fluxo próprio
    RAISE EXCEPTION 'Este tipo de documento não se copia como rascunho.';
  END IF;
  v_epi := private.episodio_aberto(d.paciente_id);
  IF EXISTS (SELECT 1 FROM public.documentos_clinicos x
              WHERE x.paciente_id = d.paciente_id AND x.tipo_documento = d.tipo_documento AND x.autor_id = v_perfil
                AND x.estado = 'rascunho' AND x.episodio_id IS NOT DISTINCT FROM v_epi) THEN
    RAISE EXCEPTION 'Já existe um rascunho seu deste tipo para o paciente. Emita ou descarte antes de copiar.';
  END IF;
  v_id := public.salvar_rascunho(d.paciente_id, d.tipo_documento, d.conteudo);
  UPDATE public.documentos_clinicos SET copia_de = d.id WHERE id = v_id;
  PERFORM private.registrar_auditoria('copiar_documento', 'documentos_clinicos', v_id, d.unidade_id,
    jsonb_build_object('tipo', d.tipo_documento, 'copia_de', d.id, 'numero_origem', d.numero));
  RETURN jsonb_build_object('id', v_id, 'tipo', d.tipo_documento, 'conteudo', d.conteudo, 'copia_de', d.id);
END $function$;

-- ── guarda e leituras ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.admissao_fichas;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.admissao_fichas
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['anexos_prontuario', 'impressoes_prontuario'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_pedido_acesso ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_pedido_acesso ON public.%1$I FOR SELECT TO authenticated
                      USING (private.acesso_encerrado_vigente(paciente_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_teleinterconsulta ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_teleinterconsulta ON public.%1$I FOR SELECT TO authenticated
                      USING (private.teleinterconsulta_vigente(paciente_id))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS diluicao_encerramentos_select ON public.diluicao_encerramentos;
CREATE POLICY diluicao_encerramentos_select ON public.diluicao_encerramentos FOR SELECT TO authenticated
  USING (private.farmaceutico_da(unidade_id) OR private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor');
