-- ════════════════════════════════════════════════════════════════════════════
-- Rollback da migration 20270421000052_turnos_avisos.sql (turnos da unidade
-- nos avisos, no turno em andamento, nos indicadores e no sobreaviso). Rodar à
-- mão, numa transação, primeiro na homologação.
--
-- 1. As funções trocadas voltam ao corpo que estava na homologação em
--    24/11/2026, antes da 052 (pg_get_functiondef, fim de linha normalizado).
--    Os grants ficam (CREATE OR REPLACE não mexe neles).
-- 2. Saem as funções novas (nada mais as chama depois do passo 1).
--
-- Efeito: avisos, turno_atual e filtro dos indicadores voltam a só manhã,
-- tarde e noite; o sobreaviso volta a pedir check-in como o plantão; a tela
-- de carga horária precisa da versão do app que chama resumo_carga_plantonistas
-- (reverter o PR do app antes). Notificações já gravadas ficam.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. corpos de antes ─────────────────────────────────────────────────────

-- private.aviso_fixo_turno(uuid,time,text)
CREATE OR REPLACE FUNCTION private.aviso_fixo_turno(p_unidade uuid, p_hora time without time zone, p_turno text, OUT tipo text, OUT mensagem text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
BEGIN
  -- F5-T1: a UBS não tem internação nem observação, e esses avisos são da
  -- passagem de plantão da UPA e do hospital.
  IF (SELECT u.tipo::text FROM public.unidades u WHERE u.id = p_unidade) = 'ubs' THEN
    RETURN;
  END IF;

  IF p_turno = 'noite' THEN
    IF p_hora >= time '19:30' AND p_hora < time '19:59' THEN
      tipo := 'noite_1930';
      mensagem := 'Você é o plantonista da noite. Confira os pacientes internados e em observação que estão sob sua responsabilidade.';
    ELSIF p_hora >= time '20:00' THEN
      tipo := 'noite_2000';
      mensagem := 'Plantão noturno em andamento. Verifique os pacientes internados e em observação da sua escala.';
    END IF;
  END IF;

  IF p_turno = 'manha' THEN
    IF p_hora >= time '07:30' AND p_hora < time '07:59' THEN
      tipo := 'manha_0730';
      mensagem := 'Bom dia! Assuma os pacientes internados e em observação do plantão da manhã.';
    ELSIF p_hora >= time '08:00' THEN
      tipo := 'manha_0800';
      mensagem := 'Plantão da manhã em andamento. Confira os pacientes internados e em observação.';
    END IF;
  END IF;
END $function$;

-- public.turno_atual()
CREATE OR REPLACE FUNCTION public.turno_atual()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT private.turno_atual(); $function$;

-- public.gerar_notificacoes_turno(uuid)
CREATE OR REPLACE FUNCTION public.gerar_notificacoes_turno(p_unidade uuid)
 RETURNS TABLE(id uuid, tipo text, mensagem text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_hora   time;
  v_turno  text;
  v_tipo   text;
  v_msg    text;
  v_pac    RECORD;
BEGIN
  IF NOT private.na_escala_agora(p_unidade) AND NOT private.eh_super_admin() THEN
    RETURN;
  END IF;

  v_hora := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_turno := private.turno_atual();

  -- Avisos fixos de turno (noite 19:30/20:00, manhã 07:30/08:00); na UBS, nenhum
  SELECT a.tipo, a.mensagem INTO v_tipo, v_msg FROM private.aviso_fixo_turno(p_unidade, v_hora, v_turno) a;

  IF v_tipo IS NOT NULL THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (auth.uid(), p_unidade, private.data_atual(), v_tipo, v_msg)
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END IF;

  -- A2: observação vencendo (faltam 30min ou 15min para 6h) — por paciente
  IF v_turno IN ('manha', 'tarde', 'noite') THEN
    FOR v_pac IN
      SELECT p.id AS paciente_id, p.nome, p.created_at
      FROM public.pacientes p
      WHERE p.unidade_id = p_unidade AND p.ativo
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
        AND p.setor_id IN (
          SELECT s.id FROM public.setores s
          WHERE s.tipo = 'observacao' AND position('verm' in lower(s.nome)) = 0
        )
    LOOP
      -- Janelas: aos 5h30 e 5h45 de observação
      IF (now() - v_pac.created_at) BETWEEN interval '5 hours 30 minutes' AND interval '5 hours 45 minutes' THEN
        INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
        SELECT auth.uid(), p_unidade, private.data_atual(), 'obs_30min_' || v_pac.paciente_id,
                'Paciente ' || v_pac.nome || ' completa 6h de observação em 30 minutos. Internar ou liberar.' WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n0 WHERE n0.perfil_id = auth.uid() AND n0.unidade_id = p_unidade AND n0.tipo = 'obs_30min_' || v_pac.paciente_id AND n0.created_at > now() - interval '1 hour')
        ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      ELSIF (now() - v_pac.created_at) BETWEEN interval '5 hours 45 minutes' AND interval '6 hours' THEN
        INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
        SELECT auth.uid(), p_unidade, private.data_atual(), 'obs_15min_' || v_pac.paciente_id,
                'Paciente ' || v_pac.nome || ' completa 6h de observação em 15 minutos. Internar ou liberar.' WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n0 WHERE n0.perfil_id = auth.uid() AND n0.unidade_id = p_unidade AND n0.tipo = 'obs_15min_' || v_pac.paciente_id AND n0.created_at > now() - interval '1 hour')
        ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- A3: reaviso de decisão pendente (sair do fixo / passagem / justificativa)
  FOR v_pac IN
    SELECT s.tipo AS st, s.id AS sid
    FROM public.solicitacoes_escala s
    WHERE s.perfil_id = auth.uid() AND s.unidade_id = p_unidade AND s.status = 'pendente'
  LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (auth.uid(), p_unidade, private.data_atual(),
            'solic_pendente_' || v_pac.sid,
            'Sua solicitação (' || v_pac.st || ') ainda aguarda decisão do gestor.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;

  -- A4: aviso de candidatura aprovada/recusada
  FOR v_pac IN
    SELECT c.id AS cid, c.status AS cstatus, c.setor_id AS csetor
    FROM public.candidaturas_escala c
    WHERE c.perfil_id = auth.uid() AND c.unidade_id = p_unidade
      AND c.status <> 'pendente'
      AND c.updated_at > now() - interval '24 hours'
  LOOP
    IF v_pac.cstatus = 'aprovado' THEN
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      VALUES (auth.uid(), p_unidade, private.data_atual(), 'cand_aprovada_' || v_pac.cid,
              'Parabéns! Sua candidatura a um plantão foi APROVADA.')
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
    ELSIF v_pac.cstatus = 'recusado' THEN
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      VALUES (auth.uid(), p_unidade, private.data_atual(), 'cand_recusada_' || v_pac.cid,
              'Sua candidatura a um plantão foi recusada.')
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT n.id, n.tipo, n.mensagem, n.created_at
    FROM public.notificacoes_plantonista n
    WHERE n.perfil_id = auth.uid()
      AND n.unidade_id = p_unidade
      AND (n.data = private.data_atual() OR (n.tipo LIKE 'obs\_%' AND n.created_at > now() - interval '1 hour'))
      AND n.lida_em IS NULL
    ORDER BY n.created_at;
END;
$function$;

-- public.registrar_checkin(uuid,float8,float8,text,text)
CREATE OR REPLACE FUNCTION public.registrar_checkin(p_unidade uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_observacao text DEFAULT NULL::text, p_justificativa text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_escala public.escala_plantao%ROWTYPE;
  v_unidade public.unidades%ROWTYPE;
  v_dentro boolean;
  v_distancia_m integer;
  v_just text := nullif(trim(coalesce(p_justificativa, '')), '');
  v_reg uuid;
  v_data date;
  v_turno text;
  v_remoto boolean := private.papel_na_unidade(p_unidade) = 'telemedicina';
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT * INTO v_escala FROM private.plantoes_na_janela() p
   WHERE p.unidade_id = p_unidade
   ORDER BY (private.checkin_do_plantao(p.id) IS NOT NULL), p.inicio
   LIMIT 1;
  IF v_escala.id IS NULL AND (private.tem_acesso_atendimento(p_unidade) IS NOT TRUE) THEN
    RAISE EXCEPTION 'Você não está em escala ou não tem acesso de atendimento nesta unidade agora.';
  END IF;

  SELECT * INTO v_unidade FROM public.unidades WHERE id = p_unidade;
  -- Telemedicina é remota por definição; sem cerca geográfica.
  IF NOT v_remoto AND v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      IF v_just IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_SEM_LOCALIZACAO: não foi possível obter a sua localização.';
      END IF;
      -- B4: a justificativa só é conferida quando é ela que libera o check-in
      IF length(v_just) < 10 THEN
        RAISE EXCEPTION 'CHECKIN_JUSTIFICATIVA_CURTA: descreva o problema com o GPS em pelo menos 10 caracteres.';
      END IF;
    ELSE
      v_distancia_m := round(private.distancia_km(v_unidade.latitude, v_unidade.longitude, p_lat, p_lng) * 1000);
      v_dentro := v_distancia_m <= v_unidade.raio_metros;
      IF NOT v_dentro AND v_just IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_FORA_DO_RAIO: você está a % m da unidade; o raio é de % m.', v_distancia_m, v_unidade.raio_metros;
      END IF;
      IF NOT v_dentro AND length(v_just) < 10 THEN
        RAISE EXCEPTION 'CHECKIN_JUSTIFICATIVA_CURTA: descreva o problema com o GPS em pelo menos 10 caracteres.';
      END IF;
    END IF;
  END IF;

  -- VD5: sem escala, a data é a do plantão em curso (a noite de 00h às 6h59 começou ontem)
  v_data := coalesce(v_escala.data, private.data_do_turno());
  v_turno := coalesce(v_escala.turno, private.turno_atual());

  INSERT INTO public.presenca_plantonista
    (unidade_id, escala_plantao_id, perfil_id, data, turno,
     checkin_em, checkin_lat, checkin_lng, checkin_dentro, checkin_distancia_m, checkin_justificativa,
     observacao, criado_por)
  VALUES
    (p_unidade, v_escala.id, v_perfil, v_data, v_turno,
     now(), CASE WHEN v_remoto THEN NULL ELSE p_lat END, CASE WHEN v_remoto THEN NULL ELSE p_lng END,
     v_dentro, v_distancia_m, CASE WHEN v_dentro IS TRUE OR v_remoto THEN NULL ELSE v_just END,
     CASE WHEN v_remoto THEN left('Telemedicina (remoto)' || coalesce(' · ' || p_observacao, ''), 500) ELSE p_observacao END, v_perfil)
  ON CONFLICT (perfil_id, unidade_id, data, turno)
  DO UPDATE SET checkin_em = EXCLUDED.checkin_em,
    checkin_lat = EXCLUDED.checkin_lat, checkin_lng = EXCLUDED.checkin_lng,
    checkin_dentro = EXCLUDED.checkin_dentro, checkin_distancia_m = EXCLUDED.checkin_distancia_m,
    checkin_justificativa = EXCLUDED.checkin_justificativa, observacao = EXCLUDED.observacao,
    -- VD13: a presença reaberta não herda o check-out anterior
    checkout_em = NULL, checkout_lat = NULL, checkout_lng = NULL,
    checkout_dentro = NULL, checkout_automatico = false
  RETURNING id INTO v_reg;

  RETURN v_reg;
END; $function$;

-- private.episodios_filtrados(uuid,date,date,uuid,text,text,text,uuid)
CREATE OR REPLACE FUNCTION private.episodios_filtrados(p_unidade uuid, p_de date, p_ate date, p_setor uuid DEFAULT NULL::uuid, p_cor text DEFAULT NULL::text, p_turno text DEFAULT NULL::text, p_publico text DEFAULT NULL::text, p_medico uuid DEFAULT NULL::uuid)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_cor IS NOT NULL AND p_cor NOT IN ('vermelho', 'laranja', 'amarelo', 'verde', 'azul') THEN RAISE EXCEPTION 'Cor inválida.'; END IF;
  IF p_turno IS NOT NULL AND p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Turno inválido.'; END IF;
  IF p_publico IS NOT NULL AND p_publico NOT IN ('adulto', 'pediatrico') THEN RAISE EXCEPTION 'Grupo inválido.'; END IF;
  RETURN QUERY
  SELECT e.id
    FROM public.episodios e
    LEFT JOIN LATERAL (
      SELECT c.cor, c.publico FROM public.classificacoes_risco c
       WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1) ult ON true
   WHERE e.unidade_id = p_unidade
     AND e.chegada_em >= ((p_de + time '07:00') AT TIME ZONE 'America/Sao_Paulo')
     AND e.chegada_em <  (((p_ate + 1) + time '07:00') AT TIME ZONE 'America/Sao_Paulo')
     AND (p_setor IS NULL OR e.setor_id = p_setor)
     AND (p_cor IS NULL OR ult.cor = p_cor)
     AND (p_publico IS NULL OR ult.publico = p_publico)
     AND (p_medico IS NULL OR e.atendimento_medico_id = p_medico)
     AND (p_turno IS NULL OR p_turno = CASE
            WHEN (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time >= time '07:00'
             AND (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time <  time '13:00' THEN 'manha'
            WHEN (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time >= time '13:00'
             AND (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time <  time '19:00' THEN 'tarde'
            ELSE 'noite' END);
END $function$;

-- public.pacientes_por_cor(uuid,date,date,uuid,text,text,text,uuid)
CREATE OR REPLACE FUNCTION public.pacientes_por_cor(p_unidade uuid, p_de date, p_ate date, p_setor uuid DEFAULT NULL::uuid, p_cor text DEFAULT NULL::text, p_turno text DEFAULT NULL::text, p_publico text DEFAULT NULL::text, p_medico uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_res jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;
  IF p_publico IS NOT NULL AND p_publico NOT IN ('adulto', 'pediatrico') THEN RAISE EXCEPTION 'Grupo inválido.'; END IF;
  IF p_turno IS NOT NULL AND p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Turno inválido.'; END IF;

  WITH ep AS (
    SELECT e.id, e.setor_id, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo') AS local,
           (SELECT c.cor FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em ASC LIMIT 1) AS cor_entrada,
           (SELECT c.cor FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1) AS cor_final,
           (SELECT c.publico FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1) AS publico,
           EXISTS (SELECT 1 FROM public.classificacoes_risco c WHERE c.episodio_id = e.id AND c.reclassificacao) AS reclassificado
      FROM public.episodios e
     WHERE e.id IN (SELECT private.episodios_filtrados(p_unidade, p_de, p_ate, p_setor, p_cor, p_turno, p_publico, p_medico))
  ), f AS (
    SELECT ep.*, private.dia_do_plantao(ep.local AT TIME ZONE 'America/Sao_Paulo') AS dia,
           CASE WHEN ep.local::time >= time '07:00' AND ep.local::time < time '13:00' THEN 'manha'
                WHEN ep.local::time >= time '13:00' AND ep.local::time < time '19:00' THEN 'tarde'
                ELSE 'noite' END AS turno,
           -- gravidade: vermelho 5 … azul 1
           array_position(ARRAY['azul', 'verde', 'amarelo', 'laranja', 'vermelho'], ep.cor_entrada) AS g_entrada,
           array_position(ARRAY['azul', 'verde', 'amarelo', 'laranja', 'vermelho'], ep.cor_final) AS g_final
      FROM ep
  ), s AS (
    SELECT * FROM f
     WHERE (p_turno IS NULL OR f.turno = p_turno)
       AND (p_publico IS NULL OR f.publico = p_publico)
  )
  SELECT jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'setor', p_setor, 'publico', p_publico, 'turno', p_turno,
    'total', count(*),
    'por_cor', jsonb_build_object(
      'vermelho', count(*) FILTER (WHERE cor_final = 'vermelho'),
      'laranja',  count(*) FILTER (WHERE cor_final = 'laranja'),
      'amarelo',  count(*) FILTER (WHERE cor_final = 'amarelo'),
      'verde',    count(*) FILTER (WHERE cor_final = 'verde'),
      'azul',     count(*) FILTER (WHERE cor_final = 'azul'),
      'sem_classificacao', count(*) FILTER (WHERE cor_final IS NULL)),
    'reclassificados', jsonb_build_object(
      'total',   count(*) FILTER (WHERE reclassificado),
      'subiram', count(*) FILTER (WHERE reclassificado AND g_final > g_entrada),
      'baixaram', count(*) FILTER (WHERE reclassificado AND g_final < g_entrada)),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'dia', d.dia, 'total', d.total, 'vermelho', d.vm, 'laranja', d.la, 'amarelo', d.am,
               'verde', d.ve, 'azul', d.az, 'sem_classificacao', d.sem) ORDER BY d.dia)
        FROM (SELECT x.dia, count(*) AS total,
                     count(*) FILTER (WHERE x.cor_final = 'vermelho') AS vm,
                     count(*) FILTER (WHERE x.cor_final = 'laranja') AS la,
                     count(*) FILTER (WHERE x.cor_final = 'amarelo') AS am,
                     count(*) FILTER (WHERE x.cor_final = 'verde') AS ve,
                     count(*) FILTER (WHERE x.cor_final = 'azul') AS az,
                     count(*) FILTER (WHERE x.cor_final IS NULL) AS sem
                FROM s x GROUP BY x.dia) d), '[]'::jsonb),
    -- setores de entrada da unidade, para o filtro
    'setores', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', st.id, 'nome', st.nome) ORDER BY st.ordem, st.nome)
        FROM public.setores st
       WHERE st.unidade_id = p_unidade AND st.ativo
         AND EXISTS (SELECT 1 FROM public.episodios e2 WHERE e2.setor_id = st.id)), '[]'::jsonb))
    INTO v_res
    FROM s;
  RETURN v_res;
END $function$;

-- private.plantoes_agora()
CREATE OR REPLACE FUNCTION private.plantoes_agora()
 RETURNS SETOF escala_plantao
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- dentro da janela do plantão (comportamento de sempre: tolerância de
  -- check-in ou check-in feito), menos quem já fez o check-out (C1)
  SELECT e.*
  FROM private.plantoes_na_janela() e
  WHERE (now() < e.inicio + private.tolerancia_checkin(e.unidade_id)
     OR EXISTS (
       SELECT 1 FROM public.presenca_plantonista x
        WHERE x.perfil_id = e.perfil_id AND x.unidade_id = e.unidade_id
          AND x.checkin_em IS NOT NULL
          AND (x.escala_plantao_id = e.id OR (x.data = e.data AND x.turno = e.turno)
               OR (x.checkin_em >= e.inicio AND x.checkin_em < e.inicio + make_interval(mins => e.duracao_min)))))
    AND private.checkout_do_plantao(e.id) IS NULL
  UNION
  -- 20 minutos de tolerância depois do fim do plantão, só com check-in feito
  -- e sem check-out da pessoa (C1), OU enquanto houver liberação ativa do
  -- gestor (decisão do RT 03/10/2026)
  SELECT e.*
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id AND s.unidade_id = e.unidade_id
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND now() >= e.inicio + make_interval(mins => e.duracao_min)
    AND (
      (now() < e.inicio + make_interval(mins => e.duracao_min) + private.tolerancia_fim_plantao()
       AND private.checkin_do_plantao(e.id) IS NOT NULL
       AND private.checkout_do_plantao(e.id) IS NULL)
      OR private.liberacao_pos_plantao_ativa(e.unidade_id)
    )
    -- limita a plantões recentes, para a liberação não reabrir plantões antigos
    AND now() < e.inicio + make_interval(mins => e.duracao_min) + interval '12 hours';
$function$;

-- public.situacao_checkin(uuid)
CREATE OR REPLACE FUNCTION public.situacao_checkin(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_tol interval := private.tolerancia_checkin(p_unidade);
  v_liberado boolean;
  v_janela boolean;
  v_pend jsonb;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  v_liberado := EXISTS (SELECT 1 FROM private.plantoes_agora() p WHERE p.unidade_id = p_unidade);
  v_janela := EXISTS (SELECT 1 FROM private.plantoes_na_janela() p WHERE p.unidade_id = p_unidade);

  SELECT jsonb_build_object(
           'escala_id', p.id, 'setor_nome', s.nome, 'turno', p.turno,
           'inicio', p.inicio, 'fim', p.inicio + make_interval(mins => p.duracao_min),
           'prazo', p.inicio + v_tol)
    INTO v_pend
    FROM private.plantoes_na_janela() p
    JOIN public.setores s ON s.id = p.setor_id
   WHERE p.unidade_id = p_unidade AND private.checkin_do_plantao(p.id) IS NULL
   ORDER BY p.inicio
   LIMIT 1;

  RETURN jsonb_build_object(
    'servidor', now(),
    'tolerancia_min', round(extract(epoch FROM v_tol) / 60)::integer,
    'na_janela', v_janela,
    'liberado', v_liberado,
    'bloqueado', v_janela AND NOT v_liberado,
    'pendente', v_pend);
END; $function$;

-- public.hermes_checkin_pendente()
CREATE OR REPLACE FUNCTION public.hermes_checkin_pendente()
 RETURNS TABLE(perfil_id uuid, unidade_id uuid, setor text, inicio_brasilia text, escala_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT DISTINCT ON (e.perfil_id, e.unidade_id)
         e.perfil_id, e.unidade_id, s.nome, to_char(e.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), e.id
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id
  WHERE e.ativo
    AND e.inicio BETWEEN now() - interval '60 minutes' AND now() - interval '15 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.presenca_plantonista p
      WHERE p.perfil_id = e.perfil_id AND p.unidade_id = e.unidade_id
        AND p.checkin_em >= e.inicio - interval '2 hours')
  ORDER BY e.perfil_id, e.unidade_id, e.inicio;
$function$;

-- public.auditoria_checkin(uuid,date)
CREATE OR REPLACE FUNCTION public.auditoria_checkin(p_unidade uuid, p_data date DEFAULT NULL::date)
 RETURNS TABLE(plantao_id uuid, presenca_id uuid, perfil_id uuid, nome text, papel text, setor text, turno text, previsto timestamp with time zone, fim_previsto timestamp with time zone, realizado timestamp with time zone, diferenca_min integer, dentro boolean, distancia_m integer, justificativa text, situacao text, divergente boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_data date := coalesce(p_data, private.data_atual());
  -- a mesma tolerância que bloqueia o acesso sem check-in (20261014000001)
  v_tol int := private.config_unidade_int(p_unidade, 'checkin_tolerancia_min', 30, 0, 120);
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a auditoria de check-in é do gestor da unidade.';
  END IF;

  RETURN QUERY
  WITH pl AS (
    SELECT e.* FROM public.escala_plantao e
     WHERE e.unidade_id = p_unidade AND e.ativo AND e.data = v_data AND e.perfil_id IS NOT NULL
  ), casado AS (
    SELECT pl.id AS pid, pl.perfil_id AS perf, pl.setor_id, pl.turno AS pturno, pl.inicio,
           pl.inicio + make_interval(mins => pl.duracao_min) AS fim, pr.*
      FROM pl
      LEFT JOIN LATERAL (
        SELECT x.id AS prid, x.checkin_em, x.checkin_dentro, x.checkin_distancia_m, x.checkin_justificativa
          FROM public.presenca_plantonista x
         WHERE x.unidade_id = p_unidade
           AND (x.escala_plantao_id = pl.id
                OR (x.perfil_id = pl.perfil_id AND x.data = pl.data AND x.turno = pl.turno))
         ORDER BY (x.escala_plantao_id = pl.id) DESC NULLS LAST, x.checkin_em DESC NULLS LAST
         LIMIT 1) pr ON true
  ), linhas AS (
    SELECT c.pid, c.prid, c.perf, c.setor_id, c.pturno, c.inicio, c.fim, c.checkin_em,
           c.checkin_dentro, c.checkin_distancia_m, c.checkin_justificativa,
           CASE
             WHEN c.checkin_em IS NULL THEN
               CASE WHEN now() < c.inicio THEN 'a_comecar'
                    WHEN now() < c.inicio + make_interval(mins => v_tol) THEN 'aguardando'
                    ELSE 'sem_checkin' END
             WHEN c.checkin_em > c.inicio + make_interval(mins => v_tol) AND c.checkin_dentro IS FALSE THEN 'atraso_fora_do_raio'
             WHEN c.checkin_em > c.inicio + make_interval(mins => v_tol) THEN 'atraso'
             WHEN c.checkin_dentro IS FALSE THEN 'fora_do_raio'
             ELSE 'confere'
           END AS sit
      FROM casado c
    UNION ALL
    -- check-in do dia sem plantão na escala
    SELECT NULL, x.id, x.perfil_id, NULL, x.turno, NULL, NULL, x.checkin_em,
           x.checkin_dentro, x.checkin_distancia_m, x.checkin_justificativa, 'sem_escala'
      FROM public.presenca_plantonista x
     WHERE x.unidade_id = p_unidade AND x.data = v_data AND x.checkin_em IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM casado c WHERE c.prid = x.id)
  )
  SELECT l.pid, l.prid, l.perf, pf.nome_completo,
         (SELECT v.papel::text FROM public.vinculos v
           WHERE v.perfil_id = l.perf AND v.unidade_id = p_unidade AND v.ativo
           ORDER BY v.papel LIMIT 1),
         s.nome, l.pturno, l.inicio, l.fim, l.checkin_em,
         CASE WHEN l.inicio IS NOT NULL AND l.checkin_em IS NOT NULL
              THEN round(extract(epoch FROM l.checkin_em - l.inicio) / 60)::int END,
         l.checkin_dentro, l.checkin_distancia_m, l.checkin_justificativa, l.sit,
         l.sit IN ('atraso_fora_do_raio', 'atraso', 'fora_do_raio', 'sem_checkin', 'sem_escala')
    FROM linhas l
    JOIN public.perfis pf ON pf.id = l.perf
    LEFT JOIN public.setores s ON s.id = l.setor_id
   ORDER BY l.inicio NULLS LAST, pf.nome_completo;
END $function$;

-- public.painel_gestor(uuid)
CREATE OR REPLACE FUNCTION public.painel_gestor(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$;

-- private.gaviao_varredura(uuid)
CREATE OR REPLACE FUNCTION private.gaviao_varredura(p_unidade uuid)
 RETURNS TABLE(chave text, tipo text, severidade text, titulo text, evidencia text, recomendacao text, icone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH hoje AS (SELECT private.data_atual() AS d),
  lim AS (
    SELECT (l ->> 'descanso_ativo')::boolean AS descanso_ativo, (l ->> 'descanso_horas')::int AS descanso_horas,
           (l ->> 'sobrecarga_horas')::int AS sobrecarga_horas, (l ->> 'ocupacao_pct')::int AS ocupacao_pct
      FROM private.limites_unidade(p_unidade) l
  ),
  pl AS (
    SELECT e.id, e.perfil_id, e.data, e.turno, e.inicio, e.inicio + make_interval(mins => e.duracao_min) AS fim, e.duracao_min
      FROM public.escala_plantao e, hoje
     WHERE e.unidade_id = p_unidade AND e.ativo AND e.perfil_id IS NOT NULL
       AND e.data BETWEEN hoje.d - 30 AND hoje.d + 7
  ),
  -- jornadas: os plantões do profissional fundidos no tempo (dois setores ao
  -- mesmo tempo contam uma vez; plantões emendados viram uma jornada só)
  blocos AS (
    SELECT x.perfil_id, lower(b) AS ini, upper(b) AS fim,
           (lower(b) AT TIME ZONE 'America/Sao_Paulo')::date AS dia
      FROM (SELECT pl.perfil_id, range_agg(tstzrange(pl.inicio, pl.fim)) AS m FROM pl GROUP BY pl.perfil_id) x,
           unnest(x.m) b
  ),
  -- sobrecarga: 7 dias para trás e 7 para a frente
  horas AS (
    SELECT bl.perfil_id, j.janela, sum(extract(epoch FROM bl.fim - bl.ini)) / 3600.0 AS h, count(*) AS n,
           min(bl.dia) AS de, max(bl.dia) AS ate
      FROM blocos bl, hoje,
           LATERAL (SELECT CASE WHEN bl.dia BETWEEN hoje.d - 6 AND hoje.d THEN 'ultimos'
                                WHEN bl.dia BETWEEN hoje.d + 1 AND hoje.d + 7 THEN 'proximos' END AS janela) j
     WHERE j.janela IS NOT NULL
     GROUP BY bl.perfil_id, j.janela
    HAVING sum(extract(epoch FROM bl.fim - bl.ini)) > (SELECT lim.sobrecarga_horas FROM lim) * 3600
  ),
  -- descanso: intervalo entre jornadas consecutivas do mesmo profissional,
  -- só quando a unidade exige descanso mínimo
  seq AS (
    SELECT bl.*, lead(bl.ini) OVER w AS prox_inicio
      FROM blocos bl WINDOW w AS (PARTITION BY bl.perfil_id ORDER BY bl.ini)
  ),
  descanso AS (
    SELECT s.* FROM seq s, hoje, lim
     WHERE lim.descanso_ativo
       AND s.prox_inicio IS NOT NULL AND s.prox_inicio < s.fim + make_interval(hours => lim.descanso_horas)
       AND s.dia BETWEEN hoje.d - 7 AND hoje.d + 7
  ),
  -- presença, 30 dias
  sem_escala AS (
    SELECT x.perfil_id, count(*) AS n, max(x.checkin_em) AS ultimo, (array_agg(x.id ORDER BY x.checkin_em DESC))[1] AS ultimo_id
      FROM public.presenca_plantonista x, hoje
     WHERE x.unidade_id = p_unidade AND x.checkin_em IS NOT NULL AND x.data BETWEEN hoje.d - 30 AND hoje.d
       AND NOT EXISTS (SELECT 1 FROM public.escala_plantao e
                        WHERE e.unidade_id = p_unidade AND e.ativo
                          AND (e.id = x.escala_plantao_id OR (e.perfil_id = x.perfil_id AND e.data = x.data AND e.turno = x.turno)))
     GROUP BY x.perfil_id
  ),
  ausencias AS (
    SELECT pl.perfil_id, count(DISTINCT (pl.data, pl.turno)) AS n,
           (SELECT string_agg(to_char(dd, 'DD/MM'), ', ' ORDER BY dd) FROM unnest(array_agg(DISTINCT pl.data)) dd) AS datas,
           (array_agg(pl.id ORDER BY pl.inicio DESC))[1] AS ultimo_id
      FROM pl, hoje
     WHERE pl.fim < now() AND pl.data >= hoje.d - 30
       AND NOT EXISTS (SELECT 1 FROM public.presenca_plantonista x
                        WHERE x.unidade_id = p_unidade AND x.checkin_em IS NOT NULL
                          AND (x.escala_plantao_id = pl.id
                               OR (x.perfil_id = pl.perfil_id AND x.data = pl.data AND x.turno = pl.turno)))
       AND NOT EXISTS (SELECT 1 FROM public.solicitacoes_escala so
                        WHERE so.escala_plantao_id = pl.id AND so.status = 'aprovado'
                          AND so.tipo IN ('falta', 'justificar_falta', 'passar_plantao', 'sair_fixo'))
     GROUP BY pl.perfil_id
  ),
  -- documentação, por setor
  sem_evolucao AS (
    SELECT i.setor_atual_id AS setor_id, count(*) AS n
      FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
       AND NOT private.setor_de_observacao(i.setor_atual_id)
       AND i.data_admissao < now() - interval '24 hours'
       AND NOT EXISTS (SELECT 1 FROM public.evolucoes_estruturadas ev
                        WHERE ev.internacao_id = i.id AND ev.created_at > now() - interval '24 hours')
     GROUP BY i.setor_atual_id
  ),
  -- operação
  ocupacao AS (
    SELECT s.id AS setor_id, s.nome, count(*) AS total, count(*) FILTER (WHERE l.status = 'ocupado') AS ocup
      FROM public.setores s JOIN public.leitos l ON l.setor_id = s.id AND l.ativo
     WHERE s.unidade_id = p_unidade AND s.ativo
     GROUP BY s.id, s.nome
    HAVING count(*) FILTER (WHERE l.status = 'ocupado') >= (SELECT lim.ocupacao_pct FROM lim) / 100.0 * count(*)
  ),
  obs_vencida AS (
    SELECT count(*) AS n, floor(extract(epoch FROM now() - min(pe.prazo)) / 60)::int AS min_atraso
      FROM public.pendencias pe
     WHERE pe.unidade_id = p_unidade AND pe.tipo = 'observacao' AND pe.situacao = 'aberta' AND pe.prazo < now()
    HAVING count(*) > 0
  )
  SELECT 'horas:' || h.perfil_id || ':' || h.janela || ':' || to_char(hoje.d, 'IYYY-IW'),
         'Sobrecarga', 'alta',
         pf.nome_completo || CASE h.janela WHEN 'ultimos' THEN ' acumulou ' ELSE ' está escalado(a) para ' END
           || replace(round(h.h)::text, '.', ',') || ' horas em 7 dias',
         h.n || CASE WHEN h.n = 1 THEN ' jornada' ELSE ' jornadas' END || ' nesta unidade'
           || CASE WHEN h.de = h.ate THEN ' começando em ' || to_char(h.de, 'DD/MM') ELSE ' entre ' || to_char(h.de, 'DD/MM') || ' e ' || to_char(h.ate, 'DD/MM') END
           || CASE h.janela WHEN 'ultimos' THEN ' (últimos 7 dias)' ELSE ' (próximos 7 dias)' END
           || '. Limite interno da unidade: ' || lim.sobrecarga_horas || ' horas em 7 dias.',
         CASE h.janela WHEN 'ultimos' THEN 'Evitar novos plantões extras nesta semana e rever a escala fixa.'
                       ELSE 'Redistribuir um dos plantões da semana ou abrir vaga para cobertura.' END,
         'stethoscope'
    FROM horas h JOIN public.perfis pf ON pf.id = h.perfil_id, hoje, lim
  UNION ALL
  SELECT 'descanso:' || d.perfil_id || ':' || floor(extract(epoch FROM d.fim))::bigint, 'Sobrecarga', 'media',
         pf.nome_completo || ' sem descanso de ' || lim.descanso_horas || ' horas entre jornadas',
         'Sai às ' || to_char(d.fim AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI "de" DD/MM') || ' e volta às '
           || to_char(d.prox_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI "de" DD/MM') || ': '
           || floor(extract(epoch FROM d.prox_inicio - d.fim) / 3600) || ' h '
           || lpad((floor(extract(epoch FROM d.prox_inicio - d.fim) / 60)::int % 60)::text, 2, '0') || ' min de intervalo.',
         'Ajustar a escala: a unidade exige descanso mínimo de ' || lim.descanso_horas || ' horas entre duas jornadas.',
         'clock'
    FROM descanso d JOIN public.perfis pf ON pf.id = d.perfil_id, lim
  UNION ALL
  SELECT 'sem_escala:' || x.perfil_id || ':' || x.ultimo_id, 'Presença', CASE WHEN x.n >= 3 THEN 'alta' ELSE 'media' END,
         'Check-in sem plantão na escala — ' || pf.nome_completo,
         x.n || ' check-in(s) nos últimos 30 dias sem plantão correspondente na escala; o último em '
           || to_char(x.ultimo AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') || '.',
         'Confirmar se houve troca informal não registrada e acertar a escala.',
         'map-pin'
    FROM sem_escala x JOIN public.perfis pf ON pf.id = x.perfil_id
  UNION ALL
  SELECT 'ausencia:' || a.perfil_id || ':' || a.ultimo_id, 'Presença', CASE WHEN a.n >= 2 THEN 'media' ELSE 'baixa' END,
         pf.nome_completo || ' com ' || a.n || CASE WHEN a.n = 1 THEN ' plantão' ELSE ' plantões' END || ' sem check-in no mês',
         'Plantões de ' || a.datas || ' sem check-in e sem falta ou troca aprovada.',
         'Conversar com o profissional e registrar a falta ou a troca na escala.',
         'alert-triangle'
    FROM ausencias a JOIN public.perfis pf ON pf.id = a.perfil_id
  UNION ALL
  SELECT 'evolucao:' || se.setor_id || ':' || hoje.d, 'Documentação', CASE WHEN se.n >= 5 THEN 'alta' ELSE 'media' END,
         se.n || CASE WHEN se.n = 1 THEN ' evolução em atraso' ELSE ' evoluções em atraso' END || ' — ' || s.nome,
         se.n || CASE WHEN se.n = 1 THEN ' internado há mais de 24 horas está' ELSE ' internados há mais de 24 horas estão' END
           || ' sem evolução nas últimas 24 horas.',
         'Cobrar na passagem de plantão e verificar a carga do setor.',
         'clipboard-list'
    FROM sem_evolucao se JOIN public.setores s ON s.id = se.setor_id, hoje
  UNION ALL
  SELECT 'ocupacao:' || o.setor_id || ':' || hoje.d, 'Operação',
         CASE WHEN o.ocup >= 0.95 * o.total THEN 'alta' ELSE 'media' END,
         o.nome || ' com ' || round(100.0 * o.ocup / o.total) || '% de ocupação',
         o.ocup || ' de ' || o.total || ' leitos ocupados agora. Limite de atenção da unidade: ' || lim.ocupacao_pct || '%.',
         'Avaliar altas previstas, remanejamento ou leito extra temporário.',
         'trending-up'
    FROM ocupacao o, hoje, lim
  UNION ALL
  SELECT 'observacao:' || hoje.d, 'Operação', 'alta',
         ov.n || CASE WHEN ov.n = 1 THEN ' paciente passou' ELSE ' pacientes passaram' END || ' do prazo da observação',
         'O atraso mais antigo é de ' || ov.min_atraso || ' min além do prazo.',
         'Definir conduta: internar, dar alta ou transferir.',
         'hourglass'
    FROM obs_vencida ov, hoje
  UNION ALL
  SELECT 'chronos:' || c.id, 'Escala', 'media',
         CASE c.metrica WHEN 'taxa_repasse' THEN 'Repasses' WHEN 'faltas' THEN 'Faltas'
                        WHEN 'cancelamento_tardio' THEN 'Cancelamentos tardios' WHEN 'trocas_iniciadas' THEN 'Trocas iniciadas'
                        ELSE 'Concentração de destino' END || ' fora do padrão — ' || pf.nome_completo,
         'Valor ' || replace(c.valor::text, '.', ',') || ' na janela de ' || c.janela || '; mediana da unidade '
           || replace(c.mediana_unidade::text, '.', ',') || ' (Sentinela, IQR).',
         'Conferir o histórico da escala do profissional.',
         'calendar-clock'
    FROM public.chronos_alertas_escala c JOIN public.perfis pf ON pf.id = c.medico_id
   WHERE c.unidade_id = p_unidade AND c.status IN ('novo', 'visto', 'em_acompanhamento')
$function$;

-- ── 2. funções novas ───────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.resumo_carga_horaria(uuid, date, date);
DROP FUNCTION IF EXISTS private.turno_atual(uuid);
DROP FUNCTION IF EXISTS private.turno_da_unidade_em(uuid, timestamptz);
DROP FUNCTION IF EXISTS private.turno_do_indicador(uuid, text);
DROP FUNCTION IF EXISTS private.hora_no_turno(uuid, text, time);
DROP FUNCTION IF EXISTS private.turno_sobreaviso(uuid, text);

COMMIT;
