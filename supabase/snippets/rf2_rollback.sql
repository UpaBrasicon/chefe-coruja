-- Rollback da migration 20270415000035_ubs_rf2_demanda_espontanea.sql
-- (refinamento da UBS, RF2). Volta as duas funções e as duas CHECK como
-- estavam antes. Só vale se nenhuma escuta tiver 'atender_hoje':
--   SELECT count(*) FROM public.classificacoes_risco WHERE saida_escuta = 'atender_hoje';  -- tem de ser 0
BEGIN;
ALTER TABLE public.classificacoes_risco DROP CONSTRAINT IF EXISTS classificacoes_risco_saida_escuta_check;
ALTER TABLE public.classificacoes_risco ADD CONSTRAINT classificacoes_risco_saida_escuta_check
  CHECK (saida_escuta IS NULL OR (coalesce(protocolo, '') = 'cab28' AND saida_escuta IN ('orientacao', 'agendamento', 'consulta')));
ALTER TABLE public.classificacoes_risco DROP CONSTRAINT IF EXISTS classificacoes_risco_protocolo_check;
ALTER TABLE public.classificacoes_risco ADD CONSTRAINT classificacoes_risco_protocolo_check
  CHECK (protocolo IS NULL OR (protocolo = 'cab28' AND cor IN ('vermelho', 'amarelo', 'verde', 'azul')
         AND saida_escuta IS NOT NULL AND ((saida_escuta IN ('orientacao', 'agendamento')) = (cor = 'azul'))));

CREATE OR REPLACE FUNCTION public.registrar_escuta_aps(p_episodio uuid, p_cor text, p_saida text, p_queixa text DEFAULT NULL::text, p_sinais jsonb DEFAULT '{}'::jsonb, p_publico text DEFAULT NULL::text, p_obs text DEFAULT NULL::text, p_dum date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  e public.episodios;
  v_eu uuid := private.meu_perfil_id();
  v_nasc date;
  v_sexo text;
  v_pub_idade text;
  v_publico text;
  v_obs text := nullif(btrim(p_obs), '');
  v_conceito uuid;
  v_id uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  k text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'A escuta inicial do CAB 28 é só da UBS.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão neste consultório.';
  END IF;
  IF private.tenho_papel(e.unidade_id, 'enfermeiro') IS NOT TRUE THEN
    RAISE EXCEPTION 'A escuta inicial e a classificação são do enfermeiro.';
  END IF;
  IF e.etapa <> 'triagem' THEN RAISE EXCEPTION 'Este paciente não está aguardando a escuta inicial.'; END IF;
  IF p_cor IS NULL OR p_cor NOT IN ('vermelho', 'amarelo', 'verde', 'azul') THEN
    RAISE EXCEPTION 'Escolha a classificação do CAB 28 (vermelho, amarelo, verde ou azul).';
  END IF;
  IF p_cor = 'azul' AND p_saida IS DISTINCT FROM 'orientacao' AND p_saida IS DISTINCT FROM 'agendamento' THEN
    RAISE EXCEPTION 'Situação não aguda (azul): orientação ou agendamento.';
  END IF;
  IF p_cor <> 'azul' AND p_saida IS DISTINCT FROM 'consulta' THEN
    RAISE EXCEPTION 'Situação aguda (vermelho, amarelo ou verde) vai para a consulta.';
  END IF;
  IF p_cor = 'azul' AND length(coalesce(v_obs, '')) < 10 THEN
    RAISE EXCEPTION 'Escreva a orientação dada ou o agendamento (mínimo de 10 letras).';
  END IF;

  SELECT data_nascimento, sexo INTO v_nasc, v_sexo FROM public.pacientes WHERE id = e.paciente_id;
  -- DUM (U8): só de quem pode gestar, não no futuro e com até 48 semanas
  IF p_dum IS NOT NULL THEN
    IF coalesce(v_sexo, '') ~* '^m' THEN RAISE EXCEPTION 'DUM: o cadastro do paciente é do sexo masculino.'; END IF;
    IF p_dum > v_hoje THEN RAISE EXCEPTION 'DUM no futuro.'; END IF;
    IF v_hoje - p_dum > 336 THEN RAISE EXCEPTION 'DUM com mais de 48 semanas: confira a data.'; END IF;
    PERFORM private.conferir_dum_parto(e.paciente_id, p_dum, NULL);  -- U11
  END IF;

  -- grupo pela idade (pediatria até 13a 11m 29d); sem data de nascimento,
  -- vale o informado
  IF v_nasc IS NOT NULL THEN
    v_pub_idade := CASE WHEN private.pediatrico_em(v_nasc, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date)
                        THEN 'pediatrico' ELSE 'adulto' END;
  END IF;
  v_publico := coalesce(v_pub_idade, p_publico, e.publico);
  IF v_publico IS NULL OR v_publico NOT IN ('adulto', 'pediatrico') THEN
    RAISE EXCEPTION 'Sem data de nascimento: informe se é adulto ou pediatria.';
  END IF;

  -- sinais vitais opcionais (decisão do RT): os que vierem, numéricos e
  -- conhecidos, ficam como aferidos agora por quem escutou
  FOR k IN SELECT jsonb_object_keys(coalesce(p_sinais, '{}')) LOOP
    IF jsonb_typeof(p_sinais -> k) <> 'number' THEN RAISE EXCEPTION 'Sinal vital sem número: %.', replace(k, '-', ' '); END IF;
    SELECT id INTO v_conceito FROM public.conceito WHERE nome = k AND (unidade_id IS NULL OR unidade_id = e.unidade_id) LIMIT 1;
    IF v_conceito IS NULL THEN RAISE EXCEPTION 'Sinal vital desconhecido: %.', k; END IF;
    INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, registrado_por, valor_num, origem)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_conceito, now(), v_eu, (p_sinais ->> k)::numeric, 'manual');
  END LOOP;

  INSERT INTO public.classificacoes_risco
    (episodio_id, unidade_id, paciente_id, cor, publico, avaliacao, reclassificacao, motivo, autor_id, autor_papel,
     queixa, publico_pela_idade, protocolo, saida_escuta, gestacao)
  VALUES
    (e.id, e.unidade_id, e.paciente_id, p_cor, v_publico, '{}', false, v_obs, v_eu, 'enfermeiro',
     coalesce(nullif(btrim(p_queixa), ''), e.queixa), v_pub_idade, 'cab28', p_saida,
     CASE WHEN p_dum IS NOT NULL THEN jsonb_build_object('dum', p_dum, 'origem', 'escuta_aps') END)
  RETURNING id INTO v_id;

  IF p_cor = 'azul' THEN
    -- não aguda: a escuta resolve (orientação) ou deixa o agendamento escrito;
    -- o episódio encerra sem desfecho da porta e sem conduta médica
    UPDATE public.episodios
       SET cor_atual = p_cor, publico = v_publico, classificado_em = now(), etapa = 'encerrado',
           desfecho_motivo = v_obs, desfecho_em = now(), desfecho_por = v_eu, encerrado_em = now(), encerrado_por = v_eu,
           updated_at = now()
     WHERE id = e.id;
  ELSE
    UPDATE public.episodios
       SET cor_atual = p_cor, publico = v_publico, classificado_em = now(), etapa = 'atendimento', updated_at = now()
     WHERE id = e.id;
  END IF;

  PERFORM private.registrar_auditoria('escuta_aps_registrada', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('cor', p_cor, 'status', p_saida, 'escala', 'cab28', 'dum', p_dum IS NOT NULL));
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.agenda_dia(p_unidade uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb;
BEGIN
  PERFORM private.agenda_exigir_ubs(p_unidade);
  IF private.segundo_fator_ok() IS NOT TRUE
     OR NOT (coalesce(private.eh_super_admin(), false) OR coalesce(private.papel_na_unidade(p_unidade), '') <> '') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  WITH prof AS (
    SELECT DISTINCT v.perfil_id, pf.nome_completo AS nome
      FROM public.vinculos v JOIN public.perfis pf ON pf.id = v.perfil_id
     WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel::text IN ('plantonista', 'enfermeiro')
  ), grade AS (
    SELECT c.perfil_id, gs AS inicio, gs + make_interval(mins => c.duracao_min) AS fim
      FROM public.agenda_configuracoes c,
           generate_series((p_data + c.hora_inicio) AT TIME ZONE 'America/Sao_Paulo',
                           ((p_data + c.hora_fim) AT TIME ZONE 'America/Sao_Paulo') - make_interval(mins => c.duracao_min),
                           make_interval(mins => c.duracao_min)) gs
     WHERE c.unidade_id = p_unidade AND c.dia_semana = extract(dow FROM p_data)
  ), ag AS (
    SELECT a.*, jsonb_build_object(
             'id', a.id, 'tipo', a.tipo, 'situacao', a.situacao, 'inicio', a.inicio, 'fim', a.fim,
             'paciente_id', a.paciente_id, 'nome', p.nome, 'nome_social', p.nome_social, 'data_nascimento', p.data_nascimento,
             'tipo_atendimento_aps', a.tipo_atendimento_aps, 'servico', a.servico, 'observacao', a.observacao,
             'motivo_reserva', a.motivo_reserva, 'especifique', a.especifique, 'episodio_id', a.episodio_id) AS j
      FROM public.agendamentos a LEFT JOIN public.pacientes p ON p.id = a.paciente_id
     WHERE a.unidade_id = p_unidade AND a.situacao <> 'cancelado'
       AND (a.inicio AT TIME ZONE 'America/Sao_Paulo')::date = p_data
  )
  SELECT jsonb_build_object('data', p_data, 'profissionais', coalesce(jsonb_agg(x ORDER BY x ->> 'nome'), '[]'::jsonb)) INTO r
    FROM (
      SELECT jsonb_build_object(
        'perfil_id', pr.perfil_id, 'nome', pr.nome,
        'fechamento', (SELECT jsonb_build_object('id', f.id, 'motivo', f.motivo, 'especifique', f.especifique)
                         FROM public.agenda_fechamentos f
                        WHERE f.unidade_id = p_unidade AND f.perfil_id = pr.perfil_id AND f.cancelado_em IS NULL
                          AND p_data BETWEEN f.inicio AND f.fim LIMIT 1),
        'horarios', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
                   'inicio', g.inicio, 'fim', g.fim,
                   'na_escala', EXISTS (SELECT 1 FROM public.escala_plantao e
                                         WHERE e.unidade_id = p_unidade AND e.perfil_id = pr.perfil_id AND e.ativo
                                           AND e.inicio <= g.inicio AND e.inicio + make_interval(mins => e.duracao_min) >= g.fim),
                   'agendamento', (SELECT ag.j FROM ag WHERE ag.perfil_id = pr.perfil_id
                                      AND tstzrange(ag.inicio, ag.fim) && tstzrange(g.inicio, g.fim)
                                    ORDER BY ag.inicio LIMIT 1)) ORDER BY g.inicio)
            FROM grade g WHERE g.perfil_id = pr.perfil_id), '[]'::jsonb),
        'fora_da_grade', coalesce((
          SELECT jsonb_agg(ag.j ORDER BY ag.inicio) FROM ag
           WHERE ag.perfil_id = pr.perfil_id
             AND NOT EXISTS (SELECT 1 FROM grade g WHERE g.perfil_id = pr.perfil_id AND g.inicio = ag.inicio)), '[]'::jsonb)
      ) AS x
        FROM prof pr
       WHERE EXISTS (SELECT 1 FROM grade g WHERE g.perfil_id = pr.perfil_id)
          OR EXISTS (SELECT 1 FROM ag WHERE ag.perfil_id = pr.perfil_id)
    ) t;
  RETURN r;
END $function$;
COMMIT;
