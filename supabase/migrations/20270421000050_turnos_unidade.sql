-- ════════════════════════════════════════════════════════════════════════════
-- Turnos configuráveis por unidade (pedido do RT, 24/11/2026).
--
-- Até aqui a escala tinha três turnos fixos: manhã 07–13, tarde 13–19 e noite
-- 19–07, gravados como texto ('manha', 'tarde', 'noite') em escala_fixa,
-- escala_plantao, escala_vagas, candidaturas_escala e presenca_plantonista.
-- Agora cada unidade cadastra os seus (nome, início, fim, quem cobre,
-- sobreaviso) em public.turnos_unidade, e as grades mostram os da unidade.
--
-- Expandir, sem contrair (ADR 0003 continua valendo: o turno é uma janela):
--   * cada unidade começa com os três turnos de hoje semeados, com os MESMOS
--     códigos de texto e o mesmo horário (que não se edita). Quem não cadastra
--     turno novo não vê diferença nenhuma;
--   * turno novo ganha um código próprio, único na rede ('t' + 10 letras hexa),
--     para que private.inicio_do_turno(data, turno) e
--     private.duracao_padrao(turno), que não recebem a unidade, achem o horário
--     dele no cadastro. Para os códigos antigos as duas devolvem o mesmo de
--     antes (o teste supabase/tests/escala_turnos_unidade.sql confere);
--   * a escala (gatilho escala_janela) grava a janela do turno novo a partir do
--     cadastro; o check-in, que já olha só a janela (plantoes_na_janela), vale
--     para ele sem mudança;
--   * as CHECK de turno das tabelas da escala passam a aceitar, além da lista
--     de antes, o formato do código novo; um gatilho confere que o código é da
--     própria unidade;
--   * nas funções que escreviam o nome do turno com CASE (manhã/tarde/noite),
--     a troca é feita no texto da definição que está no banco (o mesmo jeito
--     da 20270414000064), só quando o trecho antigo está lá.
--
-- Fica de fora (continua só com os três turnos de hoje): avisos de turno
-- (aviso_fixo_turno, gerar_notificacoes_turno), remuneração por turno
-- (remuneracoes_plantao; a regra "todos os turnos" vale para o turno novo),
-- filtro de turno dos indicadores (hora do relógio) e turno_atual().
--
-- Nada é apagado nem renomeado. Rollback: docs/escala/ROLLBACK-20270421000050.sql.
-- Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. cadastro ─────────────────────────────────────────────────────────────
-- Minutos entre início e fim, passando da meia-noite; início = fim vale 24 h.
CREATE OR REPLACE FUNCTION private.minutos_do_turno(p_inicio time, p_fim time)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ((extract(epoch FROM p_fim)::int - extract(epoch FROM p_inicio)::int) / 60 + 1439) % 1440 + 1
$$;
REVOKE ALL ON FUNCTION private.minutos_do_turno(time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.minutos_do_turno(time, time) TO authenticated;

CREATE TABLE IF NOT EXISTS public.turnos_unidade (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  nome          text NOT NULL,
  inicio        time NOT NULL,
  fim           time NOT NULL,
  duracao_min   integer NOT NULL,
  cobre         text NOT NULL DEFAULT 'todos',
  sobreaviso    boolean NOT NULL DEFAULT false,
  padrao        boolean NOT NULL DEFAULT false,
  ordem         smallint NOT NULL DEFAULT 0,
  ativo         boolean NOT NULL DEFAULT true,
  criado_por    uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT turnos_unidade_codigo_unidade UNIQUE (unidade_id, codigo),
  CONSTRAINT turnos_unidade_codigo_check CHECK (
    (padrao AND codigo IN ('manha', 'tarde', 'noite')) OR (NOT padrao AND codigo ~ '^t[0-9a-f]{10}$')),
  CONSTRAINT turnos_unidade_nome_check CHECK (char_length(btrim(nome)) BETWEEN 1 AND 40),
  CONSTRAINT turnos_unidade_duracao_check CHECK (
    duracao_min BETWEEN 60 AND 1440 AND duracao_min = private.minutos_do_turno(inicio, fim)),
  CONSTRAINT turnos_unidade_cobre_check CHECK (cobre IN ('todos', 'medico', 'enfermagem')),
  -- o horário dos três turnos de sempre não muda
  CONSTRAINT turnos_unidade_padrao_horario CHECK (NOT padrao OR (codigo, inicio, duracao_min) IN (
    ('manha', time '07:00', 360), ('tarde', time '13:00', 360), ('noite', time '19:00', 720)))
);
-- código do turno novo é único na rede: inicio_do_turno(data, turno) acha o horário só pelo código
CREATE UNIQUE INDEX IF NOT EXISTS turnos_unidade_codigo_rede ON public.turnos_unidade (codigo) WHERE NOT padrao;

COMMENT ON TABLE public.turnos_unidade IS
  'Turnos da escala de cada unidade (pedido do RT, 24/11/2026). padrao = os três de sempre (manha, tarde, noite; horário fixo). Escrita só por salvar_turno_unidade e ativar_turno_unidade.';

ALTER TABLE public.turnos_unidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS turnos_unidade_select ON public.turnos_unidade;
CREATE POLICY turnos_unidade_select ON public.turnos_unidade FOR SELECT TO authenticated
  USING (coalesce(private.papel_na_unidade(unidade_id), '') <> '' OR private.gestao_da_unidade(unidade_id));
-- sem política de escrita: grava pelas funções (gestor ou administrador da unidade)
REVOKE ALL ON public.turnos_unidade FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.turnos_unidade TO authenticated;

-- ── 2. os três turnos de sempre em toda unidade (e na unidade nova) ────────
CREATE OR REPLACE FUNCTION private.semear_turnos_unidade(p_unidade uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.turnos_unidade (unidade_id, codigo, nome, inicio, fim, duracao_min, padrao, ordem)
  VALUES (p_unidade, 'manha', 'Manhã', time '07:00', time '13:00', 360, true, 10),
         (p_unidade, 'tarde', 'Tarde', time '13:00', time '19:00', 360, true, 20),
         (p_unidade, 'noite', 'Noite', time '19:00', time '07:00', 720, true, 30)
  ON CONFLICT (unidade_id, codigo) DO NOTHING
$$;
REVOKE ALL ON FUNCTION private.semear_turnos_unidade(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.unidade_nova_turnos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.semear_turnos_unidade(NEW.id);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.unidade_nova_turnos() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_unidade_nova_turnos ON public.unidades;
CREATE TRIGGER trg_unidade_nova_turnos AFTER INSERT ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION private.unidade_nova_turnos();

SELECT private.semear_turnos_unidade(u.id) FROM public.unidades u;

-- ── 3. apoio ────────────────────────────────────────────────────────────────
-- O turno vale na unidade: está ativo no cadastro, ou é um dos três de sempre e
-- a unidade não o desativou (unidade sem cadastro: os três de sempre).
CREATE OR REPLACE FUNCTION private.turno_valido(p_unidade uuid, p_turno text, p_cobre text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    EXISTS (SELECT 1 FROM public.turnos_unidade t
             WHERE t.unidade_id = p_unidade AND t.codigo = p_turno AND t.ativo
               AND (p_cobre IS NULL OR t.cobre IN ('todos', p_cobre)))
    OR (p_turno IN ('manha', 'tarde', 'noite')
        AND NOT EXISTS (SELECT 1 FROM public.turnos_unidade t WHERE t.unidade_id = p_unidade AND t.codigo = p_turno)),
    false)
$$;
REVOKE ALL ON FUNCTION private.turno_valido(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.turno_valido(uuid, text, text) TO authenticated;

-- Nome do turno nas mensagens. Os de sempre saem como antes (manhã, tarde,
-- noite; madrugada e código desconhecido também saíam "noite").
CREATE OR REPLACE FUNCTION private.nome_do_turno(p_turno text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE p_turno
           WHEN 'manha' THEN 'manhã'
           WHEN 'tarde' THEN 'tarde'
           WHEN 'noite' THEN 'noite'
           WHEN 'madrugada' THEN 'noite'
           ELSE coalesce((SELECT t.nome FROM public.turnos_unidade t WHERE t.codigo = p_turno AND NOT t.padrao), 'noite')
         END
$$;
REVOKE ALL ON FUNCTION private.nome_do_turno(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.nome_do_turno(text) TO authenticated;

-- O turno no texto do histórico e dos avisos da geração do mês: o código de
-- sempre continua como estava; o turno novo sai pelo nome.
CREATE OR REPLACE FUNCTION private.turno_no_texto(p_turno text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT t.nome FROM public.turnos_unidade t WHERE t.codigo = p_turno AND NOT t.padrao), p_turno)
$$;
REVOKE ALL ON FUNCTION private.turno_no_texto(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.turno_no_texto(text) TO authenticated;

-- Diurno ou noturno, para a carga horária: os de sempre como antes (manhã e
-- tarde diurnos, noite noturno, madrugada nenhum dos dois); o turno novo pela
-- hora de início em Brasília (07h a 18h59 = diurno).
CREATE OR REPLACE FUNCTION private.classe_do_turno(p_turno text, p_inicio timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE
           WHEN p_turno IN ('manha', 'tarde') THEN 'diurno'
           WHEN p_turno = 'noite' THEN 'noturno'
           WHEN p_turno = 'madrugada' THEN NULL
           WHEN (p_inicio AT TIME ZONE 'America/Sao_Paulo')::time >= time '07:00'
            AND (p_inicio AT TIME ZONE 'America/Sao_Paulo')::time < time '19:00' THEN 'diurno'
           ELSE 'noturno'
         END
$$;
REVOKE ALL ON FUNCTION private.classe_do_turno(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.classe_do_turno(text, timestamptz) TO authenticated;

-- As faixas da grade: os turnos ativos da unidade (sem cadastro, os três de sempre).
CREATE OR REPLACE FUNCTION private.turnos_da_grade(p_unidade uuid)
RETURNS TABLE (turno text, mins integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.codigo, t.duracao_min FROM public.turnos_unidade t WHERE t.unidade_id = p_unidade AND t.ativo
  UNION ALL
  SELECT v.turno, v.mins FROM (VALUES ('manha', 360), ('tarde', 360), ('noite', 720)) v(turno, mins)
   WHERE NOT EXISTS (SELECT 1 FROM public.turnos_unidade t WHERE t.unidade_id = p_unidade)
$$;
REVOKE ALL ON FUNCTION private.turnos_da_grade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.turnos_da_grade(uuid) TO authenticated;

-- ── 4. início e duração do turno: os de sempre iguais, o novo pelo cadastro ─
-- Era IMMUTABLE; passa a STABLE porque o turno novo é lido da tabela. Nenhum
-- índice nem CHECK usa a função (conferido em pg_depend na homologação).
CREATE OR REPLACE FUNCTION private.inicio_do_turno(p_data date, p_turno text)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE
           WHEN p_turno IN ('manha', 'tarde', 'noite', 'madrugada') THEN
             (p_data + CASE p_turno
                         WHEN 'manha'     THEN time '07:00'
                         WHEN 'tarde'     THEN time '13:00'
                         WHEN 'noite'     THEN time '19:00'
                         WHEN 'madrugada' THEN time '01:00'
                       END) AT TIME ZONE 'America/Sao_Paulo'
           ELSE (SELECT (p_data + t.inicio) AT TIME ZONE 'America/Sao_Paulo'
                   FROM public.turnos_unidade t WHERE t.codigo = p_turno AND NOT t.padrao)
         END
$$;

CREATE OR REPLACE FUNCTION private.duracao_padrao(p_turno text)
RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE
           WHEN p_turno = 'noite' THEN 720
           WHEN p_turno IN ('manha', 'tarde', 'madrugada') THEN 360
           ELSE coalesce((SELECT t.duracao_min FROM public.turnos_unidade t WHERE t.codigo = p_turno AND NOT t.padrao), 360)
         END
$$;

-- A janela do plantão: igual à de 20261012000001 para os de sempre; o turno
-- novo leva sempre a duração do cadastro (menos a parte de plantão fracionado,
-- que guarda a própria janela).
CREATE OR REPLACE FUNCTION private.escala_janela()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.fracionado THEN
    IF TG_OP = 'UPDATE' AND (NEW.data IS DISTINCT FROM OLD.data OR NEW.turno IS DISTINCT FROM OLD.turno) THEN
      RAISE EXCEPTION 'Parte de plantão fracionado não muda de dia nem de turno: desfaça o fracionamento antes.';
    END IF;
    NEW.inicio := coalesce(NEW.inicio, private.inicio_do_turno(NEW.data, NEW.turno));
    NEW.duracao_min := coalesce(NEW.duracao_min, private.duracao_padrao(NEW.turno));
    RETURN NEW;
  END IF;
  IF NEW.turno NOT IN ('manha', 'tarde', 'noite', 'madrugada') THEN
    NEW.duracao_min := private.duracao_padrao(NEW.turno);
  END IF;
  NEW.inicio := private.inicio_do_turno(NEW.data, NEW.turno);
  NEW.duracao_min := coalesce(NEW.duracao_min, private.duracao_padrao(NEW.turno));
  IF NEW.turno IN ('manha', 'tarde', 'madrugada') AND NEW.duracao_min <> 360 THEN
    RAISE EXCEPTION 'O turno % tem 6 horas.', NEW.turno;
  END IF;
  RETURN NEW;
END; $$;

-- ── 5. as tabelas da escala aceitam o código novo ─────────────────────────
-- Cada CHECK continua com a lista de antes e ganha o formato do código novo.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('escala_plantao',       'escala_plantao_turno_check',       $l$'manha', 'tarde', 'noite', 'madrugada'$l$),
    ('presenca_plantonista', 'presenca_plantonista_turno_check', $l$'manha', 'tarde', 'noite', 'madrugada'$l$),
    ('escala_fixa',          'escala_fixa_turno_check',          $l$'manha', 'tarde', 'noite'$l$),
    ('escala_vagas',         'escala_vagas_turno_check',         $l$'manha', 'tarde', 'noite'$l$),
    ('candidaturas_escala',  'candidaturas_escala_turno_check',  $l$'manha', 'tarde', 'noite'$l$)
  ) AS x(tabela, nome, lista)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t.tabela, t.nome);
    EXECUTE format($f$ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (turno IN (%s) OR turno ~ '^t[0-9a-f]{10}$')$f$,
                   t.tabela, t.nome, t.lista);
  END LOOP;
END $$;

-- a duração do turno novo vai de 1 h a 24 h (os de sempre: 6 h ou 12 h, como antes)
ALTER TABLE public.escala_plantao DROP CONSTRAINT IF EXISTS escala_plantao_duracao_check;
ALTER TABLE public.escala_plantao
  ADD CONSTRAINT escala_plantao_duracao_check
  CHECK (duracao_min IN (360, 720)
         OR (fracionado AND duracao_min BETWEEN 60 AND 720)
         OR (turno ~ '^t[0-9a-f]{10}$' AND duracao_min BETWEEN 60 AND 1440));

-- O código novo tem de ser da própria unidade. Na escala fixa, o turno tem de
-- estar ativo (nos de sempre: não desativado). Os códigos de sempre passam nas
-- outras tabelas como antes (a CHECK decide).
CREATE OR REPLACE FUNCTION private.conferir_turno_da_unidade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.turno IS NOT DISTINCT FROM OLD.turno AND NEW.unidade_id IS NOT DISTINCT FROM OLD.unidade_id THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'escala_fixa' THEN
    IF private.turno_valido(NEW.unidade_id, NEW.turno) IS NOT TRUE THEN
      RAISE EXCEPTION 'Turno inválido: escolha um turno ativo da unidade.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.turno IN ('manha', 'tarde', 'noite', 'madrugada') THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.turnos_unidade t WHERE t.unidade_id = NEW.unidade_id AND t.codigo = NEW.turno) THEN
    RAISE EXCEPTION 'Turno inválido: escolha um turno ativo da unidade.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.conferir_turno_da_unidade() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_turno_da_unidade ON public.escala_fixa;
CREATE TRIGGER trg_turno_da_unidade BEFORE INSERT OR UPDATE OF turno, unidade_id ON public.escala_fixa
  FOR EACH ROW EXECUTE FUNCTION private.conferir_turno_da_unidade();
DROP TRIGGER IF EXISTS trg_turno_da_unidade ON public.escala_plantao;
CREATE TRIGGER trg_turno_da_unidade BEFORE INSERT OR UPDATE OF turno, unidade_id ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION private.conferir_turno_da_unidade();
DROP TRIGGER IF EXISTS trg_turno_da_unidade ON public.escala_vagas;
CREATE TRIGGER trg_turno_da_unidade BEFORE INSERT OR UPDATE OF turno, unidade_id ON public.escala_vagas
  FOR EACH ROW EXECUTE FUNCTION private.conferir_turno_da_unidade();
DROP TRIGGER IF EXISTS trg_turno_da_unidade ON public.candidaturas_escala;
CREATE TRIGGER trg_turno_da_unidade BEFORE INSERT OR UPDATE OF turno, unidade_id ON public.candidaturas_escala
  FOR EACH ROW EXECUTE FUNCTION private.conferir_turno_da_unidade();

-- ── 6. gravar o cadastro (gestor ou administrador da unidade) ──────────────
CREATE OR REPLACE FUNCTION public.salvar_turno_unidade(
  p_unidade uuid, p_id uuid, p_nome text, p_inicio time, p_fim time,
  p_cobre text DEFAULT 'todos', p_sobreaviso boolean DEFAULT false, p_ordem integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_nome text := btrim(coalesce(p_nome, ''));
  v_cobre text := coalesce(p_cobre, 'todos');
  v_ini time;
  v_fim time;
  v_dur integer;
  v_atual public.turnos_unidade%ROWTYPE;
  v_codigo text;
  v_id uuid;
BEGIN
  IF private.sou_gestor_da_unidade(p_unidade) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor ou o administrador da unidade cadastra turnos.';
  END IF;
  PERFORM private.exigir_segundo_fator();
  IF char_length(v_nome) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Dê um nome ao turno, com até 40 letras.';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL THEN
    RAISE EXCEPTION 'Informe o início e o fim do turno.';
  END IF;
  v_ini := make_time(extract(hour FROM p_inicio)::int, extract(minute FROM p_inicio)::int, 0);
  v_fim := make_time(extract(hour FROM p_fim)::int, extract(minute FROM p_fim)::int, 0);
  v_dur := private.minutos_do_turno(v_ini, v_fim);
  IF v_dur < 60 THEN
    RAISE EXCEPTION 'O turno precisa ter pelo menos 1 hora.';
  END IF;
  IF v_cobre NOT IN ('todos', 'medico', 'enfermagem') THEN
    RAISE EXCEPTION 'Quem cobre o turno: todos, médico ou enfermagem.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.turnos_unidade t
              WHERE t.unidade_id = p_unidade AND t.ativo AND lower(t.nome) = lower(v_nome) AND t.id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Já existe um turno ativo com esse nome nesta unidade.';
  END IF;

  IF p_id IS NULL THEN
    LOOP
      v_codigo := 't' || substr(md5(gen_random_uuid()::text), 1, 10);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.turnos_unidade t WHERE t.codigo = v_codigo);
    END LOOP;
    INSERT INTO public.turnos_unidade (unidade_id, codigo, nome, inicio, fim, duracao_min, cobre, sobreaviso, ordem, criado_por)
    VALUES (p_unidade, v_codigo, v_nome, v_ini, v_fim, v_dur, v_cobre, coalesce(p_sobreaviso, false),
            coalesce(p_ordem, (SELECT coalesce(max(t.ordem), 0) + 10 FROM public.turnos_unidade t WHERE t.unidade_id = p_unidade))::smallint,
            private.meu_perfil_id())
    RETURNING id INTO v_id;
    PERFORM private.registrar_auditoria('cadastrar_turno', 'turnos_unidade', v_id, p_unidade,
      jsonb_build_object('nome', v_nome, 'inicio', v_ini, 'fim', v_fim, 'cobre', v_cobre, 'sobreaviso', coalesce(p_sobreaviso, false)));
    RETURN v_id;
  END IF;

  SELECT * INTO v_atual FROM public.turnos_unidade t WHERE t.id = p_id AND t.unidade_id = p_unidade FOR UPDATE;
  IF v_atual.id IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado nesta unidade.';
  END IF;
  IF v_atual.inicio IS DISTINCT FROM v_ini OR v_atual.fim IS DISTINCT FROM v_fim THEN
    IF v_atual.padrao THEN
      RAISE EXCEPTION 'O horário da manhã, da tarde e da noite não muda. Para outro horário, cadastre um turno novo.';
    END IF;
    -- a janela dos plantões já gravados não muda sozinha: o horário só muda sem plantão pela frente
    IF EXISTS (SELECT 1 FROM public.escala_plantao e
                WHERE e.unidade_id = p_unidade AND e.turno = v_atual.codigo AND e.ativo
                  AND e.inicio + make_interval(mins => e.duracao_min) > now()) THEN
      RAISE EXCEPTION 'Este turno já tem plantões marcados daqui para a frente. Para outro horário, cadastre um turno novo.';
    END IF;
  END IF;
  UPDATE public.turnos_unidade
     SET nome = v_nome, inicio = v_ini, fim = v_fim, duracao_min = v_dur, cobre = v_cobre,
         sobreaviso = coalesce(p_sobreaviso, false), ordem = coalesce(p_ordem, ordem)::smallint, atualizado_em = now()
   WHERE id = p_id;
  PERFORM private.registrar_auditoria('alterar_turno', 'turnos_unidade', p_id, p_unidade,
    jsonb_build_object('antes', jsonb_build_object('nome', v_atual.nome, 'inicio', v_atual.inicio, 'fim', v_atual.fim,
                                                   'cobre', v_atual.cobre, 'sobreaviso', v_atual.sobreaviso),
                       'depois', jsonb_build_object('nome', v_nome, 'inicio', v_ini, 'fim', v_fim,
                                                    'cobre', v_cobre, 'sobreaviso', coalesce(p_sobreaviso, false))));
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_turno_unidade(uuid, uuid, text, time, time, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_turno_unidade(uuid, uuid, text, time, time, text, boolean, integer) TO authenticated;

-- Turno não se apaga (o código fica nos plantões antigos): desativa e reativa.
CREATE OR REPLACE FUNCTION public.ativar_turno_unidade(p_id uuid, p_ativo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_t public.turnos_unidade%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.turnos_unidade WHERE id = p_id FOR UPDATE;
  IF v_t.id IS NULL OR private.sou_gestor_da_unidade(v_t.unidade_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor ou o administrador da unidade cadastra turnos.';
  END IF;
  PERFORM private.exigir_segundo_fator();
  IF p_ativo IS NULL OR p_ativo = v_t.ativo THEN
    RETURN;
  END IF;
  IF NOT p_ativo THEN
    IF EXISTS (SELECT 1 FROM public.escala_fixa f
                WHERE f.unidade_id = v_t.unidade_id AND f.turno = v_t.codigo AND f.ativo) THEN
      RAISE EXCEPTION 'Este turno está na escala fixa. Tire as pessoas dele na aba Fixa antes de desativar.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.turnos_unidade t
                    WHERE t.unidade_id = v_t.unidade_id AND t.ativo AND t.id <> v_t.id) THEN
      RAISE EXCEPTION 'A unidade precisa de pelo menos um turno ativo.';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.turnos_unidade t
                 WHERE t.unidade_id = v_t.unidade_id AND t.ativo AND lower(t.nome) = lower(v_t.nome) AND t.id <> v_t.id) THEN
    RAISE EXCEPTION 'Já existe um turno ativo com esse nome nesta unidade.';
  END IF;
  UPDATE public.turnos_unidade SET ativo = p_ativo, atualizado_em = now() WHERE id = p_id;
  PERFORM private.registrar_auditoria(CASE WHEN p_ativo THEN 'reativar_turno' ELSE 'desativar_turno' END,
    'turnos_unidade', p_id, v_t.unidade_id, jsonb_build_object('nome', v_t.nome));
END $$;
REVOKE ALL ON FUNCTION public.ativar_turno_unidade(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ativar_turno_unidade(uuid, boolean) TO authenticated;

-- ── 7. funções que tinham os três turnos escritos à mão ────────────────────
-- Troca no texto da definição que está no banco: só onde o trecho antigo
-- aparece; se já foi trocado (o trecho novo está lá), pula; se nenhum dos dois
-- está lá, para (a função mudou e esta troca precisa ser revista).
DO $$
DECLARE
  t record;
  def text;
  atual text;
  mudou boolean := false;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    -- grade: as faixas são os turnos ativos da unidade
    ('private.escala_faixas(uuid,date,date)',
     $a$CROSS JOIN (VALUES ('manha', 6), ('tarde', 6), ('noite', 12)) t(turno, horas)$a$,
     $n$CROSS JOIN private.turnos_da_grade(p_unidade) t(turno, mins)$n$),
    ('private.escala_faixas(uuid,date,date)',
     $a$make_interval(hours => t.horas)$a$,
     $n$make_interval(mins => t.mins)$n$),
    -- marcar vaga: turno da unidade; nome do turno no aviso e no histórico
    ('public.marcar_vaga_escala(uuid,date,text,text,public.papel)',
     $a$IF p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Faixa inválida: manhã, tarde ou noite.'; END IF;$a$,
     $n$IF private.turno_valido(v_unidade, p_turno) IS NOT TRUE THEN RAISE EXCEPTION 'Faixa inválida: escolha um turno ativo da unidade.'; END IF;$n$),
    ('public.marcar_vaga_escala(uuid,date,text,text,public.papel)',
     $a$CASE p_turno WHEN 'manha' THEN 'manhã' WHEN 'tarde' THEN 'tarde' ELSE 'noite' END$a$,
     $n$private.nome_do_turno(p_turno)$n$),
    ('public.marcar_vaga_escala(uuid,date,text,text,public.papel)',
     $a$' · ' || p_turno || CASE$a$,
     $n$' · ' || private.turno_no_texto(p_turno) || CASE$n$),
    -- candidatura do médico pela Escala geral: turno da unidade que o médico cobre
    ('public.candidatar_faixa(uuid,date,text)',
     $a$IF p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Faixa inválida: manhã, tarde ou noite.'; END IF;$a$,
     $n$IF private.turno_valido(v_unidade, p_turno, 'medico') IS NOT TRUE THEN RAISE EXCEPTION 'Faixa inválida: escolha um turno ativo da unidade.'; END IF;$n$),
    -- avisos de passagem e troca
    ('private.descrever_plantao(uuid)',
     $a$CASE e.turno WHEN 'manha' THEN 'manhã' WHEN 'tarde' THEN 'tarde' ELSE 'noite' END$a$,
     $n$private.nome_do_turno(e.turno)$n$),
    -- geração do mês: nome do turno novo no aviso da vaga e no histórico
    ('public.gerar_escala_mensal_detalhada(uuid,integer,integer)',
     $a$' (' || f.turno || ').$a$,
     $n$' (' || private.turno_no_texto(f.turno) || ').$n$),
    ('public.gerar_escala_mensal_detalhada(uuid,integer,integer)',
     $a$' · ' || f.turno || ' (conflito$a$,
     $n$' · ' || private.turno_no_texto(f.turno) || ' (conflito$n$),
    -- ERP: a base do plantão fracionado é a duração do turno
    ('private.plantao_erp_valor(uuid,uuid,text,integer,boolean)',
     $a$CASE WHEN p_turno = 'noite' THEN 720 ELSE 360 END$a$,
     $n$private.duracao_padrao(p_turno)$n$),
    -- carga horária: diurno e noturno do turno novo pela hora de início
    ('public.resumo_carga_plantonistas(uuid,date,date)',
     $a$bool_or(e.turno IN ('manha','tarde'))$a$,
     $n$bool_or(private.classe_do_turno(e.turno, e.inicio) = 'diurno')$n$),
    ('public.resumo_carga_plantonistas(uuid,date,date)',
     $a$bool_or(e.turno = 'noite')$a$,
     $n$bool_or(private.classe_do_turno(e.turno, e.inicio) = 'noturno')$n$)
  ) AS x(fn, antigo, novo)
  ORDER BY fn   -- as trocas da mesma função vão juntas numa definição só
  LOOP
    IF atual IS DISTINCT FROM t.fn THEN
      IF mudou THEN EXECUTE def; END IF;
      IF to_regprocedure(t.fn) IS NULL THEN
        RAISE EXCEPTION 'turnos da unidade: função % não existe', t.fn;
      END IF;
      atual := t.fn;
      def := pg_get_functiondef(t.fn::regprocedure);
      mudou := false;
    END IF;
    IF position(t.antigo IN def) > 0 THEN
      def := replace(def, t.antigo, t.novo);
      mudou := true;
    ELSIF position(t.novo IN def) = 0 THEN
      RAISE EXCEPTION 'turnos da unidade: trecho não encontrado em %: %', t.fn, t.antigo;
    END IF;
  END LOOP;
  IF mudou THEN EXECUTE def; END IF;
END $$;
