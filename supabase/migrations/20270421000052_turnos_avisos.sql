-- ════════════════════════════════════════════════════════════════════════════
-- Turnos da unidade: avisos, turno em andamento, indicadores e sobreaviso
-- (continuação de 20270421000050_turnos_unidade; pedido do RT, 24/11/2026).
--
-- A 050 deixou quatro coisas só com manhã, tarde e noite. Aqui elas passam a
-- valer para os turnos cadastrados, sem mudar nada para os três de sempre
-- (o teste supabase/tests/escala_turnos_avisos.sql compara com as fórmulas de
-- antes, escritas nele):
--
--   1. avisos de começo de turno (aviso_fixo_turno, gerar_notificacoes_turno):
--      o turno cadastrado ganha os dois avisos no padrão da manhã e da noite,
--      com o nome dele: 30 min depois do início ("Você é o plantonista do
--      turno X...") e a partir de 1 h ("Plantão do turno X em andamento...",
--      até o fim do turno ou a meia-noite, como a noite). Turno de sobreaviso
--      não recebe aviso de passagem (não está na unidade);
--   2. turno_atual: private.turno_atual(unidade) reconhece o turno da unidade
--      em andamento (o meu plantão num turno cadastrado; senão o do relógio,
--      se a unidade não o desativou; senão o turno cadastrado que está
--      correndo). public.turno_atual() devolve o turno cadastrado do meu
--      plantão em andamento; sem ele, o relógio, como antes;
--   3. filtro de turno dos Indicadores: aceita o turno da unidade e filtra a
--      chegada pela janela do turno cadastrado (manhã, tarde e noite pela
--      hora do relógio, como antes);
--   4. sobreaviso: não exige check-in presencial (o acesso vale a janela toda,
--      não aparece como check-in pendente, nem como falta no Gavião, no painel
--      e na auditoria, que mostra "sobreaviso") e conta à parte na carga
--      horária (public.resumo_carga_horaria: horas e dias de sobreaviso em
--      colunas próprias; resumo_carga_plantonistas fica como estava).
--
-- Fica de fora: o quadro "por turno" da evasão (continua manhã/tarde/noite
-- pela hora da chegada) e a remuneração por turno.
--
-- Nada é apagado nem renomeado. Rollback: docs/escala/ROLLBACK-20270421000052.sql.
-- Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. apoio ────────────────────────────────────────────────────────────────
-- O turno é de sobreaviso na unidade (os três de sempre: só se o gestor marcou).
CREATE OR REPLACE FUNCTION private.turno_sobreaviso(p_unidade uuid, p_turno text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT t.sobreaviso FROM public.turnos_unidade t
                    WHERE t.unidade_id = p_unidade AND t.codigo = p_turno), false)
$$;
REVOKE ALL ON FUNCTION private.turno_sobreaviso(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.turno_sobreaviso(uuid, text) TO authenticated;

-- A hora (de Brasília) cai no turno: os de sempre pela hora do relógio, como
-- os indicadores faziam; o cadastrado pela janela dele (passa da meia-noite).
CREATE OR REPLACE FUNCTION private.hora_no_turno(p_unidade uuid, p_turno text, p_hora time)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
           WHEN p_turno IN ('manha', 'tarde', 'noite') THEN
             p_turno = CASE
                         WHEN p_hora >= time '07:00' AND p_hora < time '13:00' THEN 'manha'
                         WHEN p_hora >= time '13:00' AND p_hora < time '19:00' THEN 'tarde'
                         ELSE 'noite' END
           ELSE coalesce((SELECT (floor(extract(epoch FROM p_hora - t.inicio))::int + 86400) % 86400 < t.duracao_min * 60
                            FROM public.turnos_unidade t
                           WHERE t.unidade_id = p_unidade AND t.codigo = p_turno AND NOT t.padrao), false)
         END
$$;
REVOKE ALL ON FUNCTION private.hora_no_turno(uuid, text, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.hora_no_turno(uuid, text, time) TO authenticated;

-- Turno que o filtro dos indicadores aceita: os de sempre ou um do cadastro da
-- unidade (também o desativado, que ainda tem chegadas no período).
CREATE OR REPLACE FUNCTION private.turno_do_indicador(p_unidade uuid, p_turno text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_turno IN ('manha', 'tarde', 'noite')
      OR EXISTS (SELECT 1 FROM public.turnos_unidade t WHERE t.unidade_id = p_unidade AND t.codigo = p_turno)
$$;
REVOKE ALL ON FUNCTION private.turno_do_indicador(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.turno_do_indicador(uuid, text) TO authenticated;

-- ── 2. turno em andamento ──────────────────────────────────────────────────
-- O turno da unidade num instante, para quem chama:
--   a. o meu plantão em andamento nesta unidade num turno cadastrado;
--   b. o turno do relógio (manhã 07–13, tarde 13–19, noite 19–07), se a
--      unidade não o desativou — o resultado de sempre;
--   c. o turno cadastrado (presencial) que está correndo, na ordem do cadastro;
--   d. o do relógio.
CREATE OR REPLACE FUNCTION private.turno_da_unidade_em(p_unidade uuid, p_instante timestamptz)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH h AS (
    SELECT (p_instante AT TIME ZONE 'America/Sao_Paulo')::time AS hora
  ), relogio AS (
    SELECT CASE WHEN h.hora >= time '07:00' AND h.hora < time '13:00' THEN 'manha'
                WHEN h.hora >= time '13:00' AND h.hora < time '19:00' THEN 'tarde'
                ELSE 'noite' END AS turno
      FROM h
  )
  SELECT coalesce(
    (SELECT e.turno FROM public.escala_plantao e
      WHERE e.perfil_id = private.meu_perfil_id() AND e.unidade_id = p_unidade AND e.ativo
        AND e.turno ~ '^t[0-9a-f]{10}$'
        AND e.inicio <= p_instante AND p_instante < e.inicio + make_interval(mins => e.duracao_min)
      ORDER BY e.inicio DESC LIMIT 1),
    (SELECT r.turno FROM relogio r WHERE private.turno_valido(p_unidade, r.turno)),
    (SELECT t.codigo FROM public.turnos_unidade t, h
      WHERE t.unidade_id = p_unidade AND t.ativo AND NOT t.padrao AND NOT t.sobreaviso
        AND (floor(extract(epoch FROM h.hora - t.inicio))::int + 86400) % 86400 < t.duracao_min * 60
      ORDER BY t.ordem, t.nome LIMIT 1),
    (SELECT r.turno FROM relogio r))
$$;
REVOKE ALL ON FUNCTION private.turno_da_unidade_em(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.turno_da_unidade_em(uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION private.turno_atual(p_unidade uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.turno_da_unidade_em(p_unidade, now())
$$;
REVOKE ALL ON FUNCTION private.turno_atual(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.turno_atual(uuid) TO authenticated;

-- Sem unidade: o turno cadastrado do meu plantão em andamento; sem ele, o do
-- relógio (private.turno_atual() continua sendo o relógio).
CREATE OR REPLACE FUNCTION public.turno_atual()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT e.turno FROM private.plantoes_na_janela() e
      WHERE e.turno ~ '^t[0-9a-f]{10}$'
      ORDER BY e.inicio DESC LIMIT 1),
    private.turno_atual())
$$;

-- ── 3. avisos de começo de turno ───────────────────────────────────────────
-- Manhã e noite: o texto e as horas de antes. Turno cadastrado: o mesmo
-- padrão (30 min e 1 h depois do início), com o nome do turno; o tipo leva o
-- código e a hora (uma vez por dia, como os de sempre). Sobreaviso e UBS: nada.
CREATE OR REPLACE FUNCTION private.aviso_fixo_turno(p_unidade uuid, p_hora time without time zone, p_turno text, OUT tipo text, OUT mensagem text)
RETURNS record LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_t public.turnos_unidade%ROWTYPE;
  v_ini integer;
  v_seg integer;
BEGIN
  -- F5-T1: a UBS não tem internação nem observação, e esses avisos são da
  -- passagem de plantão da UPA e do hospital.
  IF (SELECT u.tipo::text FROM public.unidades u WHERE u.id = p_unidade) = 'ubs' THEN
    RETURN;
  END IF;
  -- sobreaviso não está na unidade: sem aviso de passagem
  IF private.turno_sobreaviso(p_unidade, p_turno) THEN
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

  IF p_turno ~ '^t[0-9a-f]{10}$' THEN
    SELECT * INTO v_t FROM public.turnos_unidade t
     WHERE t.unidade_id = p_unidade AND t.codigo = p_turno AND NOT t.padrao;
    IF v_t.id IS NULL THEN
      RETURN;
    END IF;
    v_ini := extract(epoch FROM v_t.inicio)::int;
    -- segundos desde o início do turno (passa da meia-noite)
    v_seg := (floor(extract(epoch FROM p_hora))::int - v_ini + 86400) % 86400;
    IF v_seg >= 1800 AND v_seg < 3540 THEN
      tipo := v_t.codigo || '_' || replace(left((v_t.inicio + interval '30 minutes')::text, 5), ':', '');
      mensagem := 'Você é o plantonista do turno ' || v_t.nome || '. Confira os pacientes internados e em observação que estão sob sua responsabilidade.';
    ELSIF v_seg >= 3600 AND v_seg < v_t.duracao_min * 60 AND v_ini + v_seg < 86400 THEN
      tipo := v_t.codigo || '_' || replace(left((v_t.inicio + interval '60 minutes')::text, 5), ':', '');
      mensagem := 'Plantão do turno ' || v_t.nome || ' em andamento. Confira os pacientes internados e em observação.';
    END IF;
  END IF;
END $$;

-- ── 4. carga horária com o sobreaviso à parte ──────────────────────────────
-- As colunas de resumo_carga_plantonistas contam só o plantão; horas e dias de
-- sobreaviso vêm separados. Sem sobreaviso, as sete primeiras colunas são as
-- de resumo_carga_plantonistas (o teste confere).
CREATE OR REPLACE FUNCTION public.resumo_carga_horaria(p_unidade uuid, p_inicio date, p_fim date)
RETURNS TABLE(perfil_id uuid, nome text, diurnos bigint, noturnos bigint, horas numeric, dias bigint, categorias text,
              horas_sobreaviso numeric, dias_sobreaviso bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.gestao_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  WITH pl AS (
    SELECT e.perfil_id, e.data, e.turno, e.inicio, e.duracao_min, e.papel,
           private.turno_sobreaviso(p_unidade, e.turno) AS sobreaviso
    FROM public.escala_plantao e
    WHERE e.unidade_id = p_unidade AND e.ativo
      AND e.data BETWEEN p_inicio AND p_fim
  ), por_dia AS (
    SELECT pl.perfil_id, pl.data,
           bool_or(NOT pl.sobreaviso AND private.classe_do_turno(pl.turno, pl.inicio) = 'diurno') AS tem_diurno,
           bool_or(NOT pl.sobreaviso AND private.classe_do_turno(pl.turno, pl.inicio) = 'noturno') AS tem_noturno,
           bool_or(NOT pl.sobreaviso) AS tem_plantao,
           bool_or(pl.sobreaviso) AS tem_sobreaviso,
           coalesce(sum(pl.duracao_min) FILTER (WHERE NOT pl.sobreaviso), 0) AS minutos,
           coalesce(sum(pl.duracao_min) FILTER (WHERE pl.sobreaviso), 0) AS minutos_sobreaviso
    FROM pl
    GROUP BY pl.perfil_id, pl.data
  ), cat AS (
    SELECT pl.perfil_id,
           string_agg(DISTINCT coalesce(pl.papel::text, 'sem categoria'), ', ' ORDER BY coalesce(pl.papel::text, 'sem categoria')) AS categorias
    FROM pl
    GROUP BY pl.perfil_id
  )
  SELECT d.perfil_id,
         p.nome_completo,
         COUNT(*) FILTER (WHERE d.tem_diurno),
         COUNT(*) FILTER (WHERE d.tem_noturno),
         round(sum(d.minutos) / 60.0, 1),
         COUNT(*) FILTER (WHERE d.tem_plantao),
         c.categorias,
         round(sum(d.minutos_sobreaviso) / 60.0, 1),
         COUNT(*) FILTER (WHERE d.tem_sobreaviso)
  FROM por_dia d
  JOIN public.perfis p ON p.id = d.perfil_id
  LEFT JOIN cat c ON c.perfil_id = d.perfil_id
  GROUP BY d.perfil_id, p.nome_completo, c.categorias
  ORDER BY p.nome_completo;
END; $$;
REVOKE ALL ON FUNCTION public.resumo_carga_horaria(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_carga_horaria(uuid, date, date) TO authenticated;

-- ── 5. trocas no texto das funções que estão no banco ─────────────────────
-- O mesmo jeito da 050: se o trecho novo já está lá, pula (reaplicar não
-- repete); senão troca o antigo; se nenhum dos dois está, para (a função
-- mudou e a troca precisa ser revista). Cada trecho antigo aparece uma vez.
DO $$
DECLARE
  t record;
  def text;
  atual text;
  mudou boolean := false;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    -- 1. avisos: o turno da unidade; a observação vencendo vale em qualquer
    --    turno presencial (antes: manhã, tarde ou noite, que era sempre)
    ('public.gerar_notificacoes_turno(uuid)',
     $a$v_turno := private.turno_atual();$a$,
     $n$v_turno := private.turno_atual(p_unidade);$n$),
    ('public.gerar_notificacoes_turno(uuid)',
     $a$IF v_turno IN ('manha', 'tarde', 'noite') THEN$a$,
     $n$IF v_turno IS NOT NULL AND private.turno_sobreaviso(p_unidade, v_turno) IS NOT TRUE THEN$n$),
    -- 2. check-in sem escala: o turno da unidade em andamento
    ('public.registrar_checkin(uuid,double precision,double precision,text,text)',
     $a$coalesce(v_escala.turno, private.turno_atual())$a$,
     $n$coalesce(v_escala.turno, private.turno_atual(p_unidade))$n$),
    -- 3. indicadores: o turno da unidade, pela janela dele
    ('private.episodios_filtrados(uuid,date,date,uuid,text,text,text,uuid)',
     $a$IF p_turno IS NOT NULL AND p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Turno inválido.'; END IF;$a$,
     $n$IF p_turno IS NOT NULL AND private.turno_do_indicador(p_unidade, p_turno) IS NOT TRUE THEN RAISE EXCEPTION 'Turno inválido.'; END IF;$n$),
    ('private.episodios_filtrados(uuid,date,date,uuid,text,text,text,uuid)',
     $a$AND (p_turno IS NULL OR p_turno = CASE
            WHEN (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time >= time '07:00'
             AND (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time <  time '13:00' THEN 'manha'
            WHEN (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time >= time '13:00'
             AND (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time <  time '19:00' THEN 'tarde'
            ELSE 'noite' END);$a$,
     $n$AND (p_turno IS NULL OR private.hora_no_turno(p_unidade, p_turno, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time));$n$),
    ('public.pacientes_por_cor(uuid,date,date,uuid,text,text,text,uuid)',
     $a$IF p_turno IS NOT NULL AND p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Turno inválido.'; END IF;$a$,
     $n$IF p_turno IS NOT NULL AND private.turno_do_indicador(p_unidade, p_turno) IS NOT TRUE THEN RAISE EXCEPTION 'Turno inválido.'; END IF;$n$),
    ('public.pacientes_por_cor(uuid,date,date,uuid,text,text,text,uuid)',
     $a$WHERE (p_turno IS NULL OR f.turno = p_turno)$a$,
     $n$WHERE (p_turno IS NULL OR private.hora_no_turno(p_unidade, p_turno, f.local::time))$n$),
    -- 4. sobreaviso: acesso na janela toda sem check-in
    ('private.plantoes_agora()',
     $a$WHERE (now() < e.inicio + private.tolerancia_checkin(e.unidade_id)$a$,
     $n$WHERE (private.turno_sobreaviso(e.unidade_id, e.turno)
     OR now() < e.inicio + private.tolerancia_checkin(e.unidade_id)$n$),
    --    ... não é check-in pendente na casca
    ('public.situacao_checkin(uuid)',
     $a$WHERE p.unidade_id = p_unidade AND private.checkin_do_plantao(p.id) IS NULL$a$,
     $n$WHERE p.unidade_id = p_unidade AND private.turno_sobreaviso(p.unidade_id, p.turno) IS NOT TRUE
     AND private.checkin_do_plantao(p.id) IS NULL$n$),
    --    ... nem no lembrete do Hermes
    ('public.hermes_checkin_pendente()',
     $a$WHERE e.ativo
    AND e.inicio BETWEEN now()$a$,
     $n$WHERE e.ativo AND private.turno_sobreaviso(e.unidade_id, e.turno) IS NOT TRUE
    AND e.inicio BETWEEN now()$n$),
    --    ... na auditoria do gestor é "sobreaviso" (não diverge)
    ('public.auditoria_checkin(uuid,date)',
     $a$CASE
             WHEN c.checkin_em IS NULL THEN$a$,
     $n$CASE
             WHEN private.turno_sobreaviso(p_unidade, c.pturno) THEN 'sobreaviso'
             WHEN c.checkin_em IS NULL THEN$n$),
    --    ... nem "escalado sem check-in" no painel
    ('public.painel_gestor(uuid)',
     $a$WHERE e.unidade_id = p_unidade AND e.inicio <= now() - interval '15 minutes'$a$,
     $n$WHERE e.unidade_id = p_unidade AND private.turno_sobreaviso(e.unidade_id, e.turno) IS NOT TRUE
        AND e.inicio <= now() - interval '15 minutes'$n$),
    --    ... nem ausência no Gavião
    ('private.gaviao_varredura(uuid)',
     $a$WHERE pl.fim < now() AND pl.data >= hoje.d - 30$a$,
     $n$WHERE private.turno_sobreaviso(p_unidade, pl.turno) IS NOT TRUE AND pl.fim < now() AND pl.data >= hoje.d - 30$n$)
  ) AS x(fn, antigo, novo)
  ORDER BY fn   -- as trocas da mesma função vão juntas numa definição só
  LOOP
    IF atual IS DISTINCT FROM t.fn THEN
      IF mudou THEN EXECUTE def; END IF;
      IF to_regprocedure(t.fn) IS NULL THEN
        RAISE EXCEPTION 'turnos avisos: função % não existe', t.fn;
      END IF;
      atual := t.fn;
      def := pg_get_functiondef(t.fn::regprocedure);
      mudou := false;
    END IF;
    -- parte das funções está no banco com fim de linha CRLF: o trecho de
    -- várias linhas é procurado dos dois jeitos
    IF position(t.novo IN def) > 0 OR position(replace(t.novo, E'\n', E'\r\n') IN def) > 0 THEN
      NULL;   -- já trocado
    ELSIF position(t.antigo IN def) > 0 THEN
      def := replace(def, t.antigo, t.novo);
      mudou := true;
    ELSIF position(replace(t.antigo, E'\n', E'\r\n') IN def) > 0 THEN
      def := replace(def, replace(t.antigo, E'\n', E'\r\n'), replace(t.novo, E'\n', E'\r\n'));
      mudou := true;
    ELSE
      RAISE EXCEPTION 'turnos avisos: trecho não encontrado em %: %', t.fn, t.antigo;
    END IF;
  END LOOP;
  IF mudou THEN EXECUTE def; END IF;
END $$;
