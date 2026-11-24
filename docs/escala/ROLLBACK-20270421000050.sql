-- ════════════════════════════════════════════════════════════════════════════
-- Rollback da migration 20270421000050_turnos_unidade.sql (turnos configuráveis
-- por unidade). Rodar à mão, numa transação, primeiro na homologação.
--
-- 1. Para se algum plantão, fixa, vaga, candidatura ou presença usa um turno
--    novo (código 't…'): as CHECK antigas não aceitam esses códigos. Decida
--    com o gestor o que fazer com essas linhas (passar para manhã/tarde/noite
--    ou desativar) antes de rodar de novo.
-- 2. Desfaz as trocas de texto nas funções (o trecho novo volta ao antigo).
-- 3. inicio_do_turno, duracao_padrao e escala_janela voltam às versões de
--    20260926000003 e 20261012000001.
-- 4. As CHECK de turno e de duração voltam às listas de antes.
-- 5. Saem os gatilhos, as funções novas e a tabela turnos_unidade (o
--    cadastro se perde; os três turnos de sempre não dependem dela).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. nada pode estar usando turno novo ───────────────────────────────────
DO $$
DECLARE
  n bigint;
BEGIN
  SELECT (SELECT count(*) FROM public.escala_plantao WHERE turno ~ '^t[0-9a-f]{10}$')
       + (SELECT count(*) FROM public.escala_fixa WHERE turno ~ '^t[0-9a-f]{10}$')
       + (SELECT count(*) FROM public.escala_vagas WHERE turno ~ '^t[0-9a-f]{10}$')
       + (SELECT count(*) FROM public.candidaturas_escala WHERE turno ~ '^t[0-9a-f]{10}$')
       + (SELECT count(*) FROM public.presenca_plantonista WHERE turno ~ '^t[0-9a-f]{10}$')
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'Rollback parado: % linha(s) da escala usam turno novo. Trate essas linhas antes.', n;
  END IF;
END $$;

-- ── 2. trocas de texto ao contrário ────────────────────────────────────────
DO $$
DECLARE
  t record;
  def text;
  atual text;
  mudou boolean := false;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('private.escala_faixas(uuid,date,date)',
     $a$CROSS JOIN (VALUES ('manha', 6), ('tarde', 6), ('noite', 12)) t(turno, horas)$a$,
     $n$CROSS JOIN private.turnos_da_grade(p_unidade) t(turno, mins)$n$),
    ('private.escala_faixas(uuid,date,date)',
     $a$make_interval(hours => t.horas)$a$,
     $n$make_interval(mins => t.mins)$n$),
    ('public.marcar_vaga_escala(uuid,date,text,text,public.papel)',
     $a$IF p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Faixa inválida: manhã, tarde ou noite.'; END IF;$a$,
     $n$IF private.turno_valido(v_unidade, p_turno) IS NOT TRUE THEN RAISE EXCEPTION 'Faixa inválida: escolha um turno ativo da unidade.'; END IF;$n$),
    ('public.marcar_vaga_escala(uuid,date,text,text,public.papel)',
     $a$CASE p_turno WHEN 'manha' THEN 'manhã' WHEN 'tarde' THEN 'tarde' ELSE 'noite' END$a$,
     $n$private.nome_do_turno(p_turno)$n$),
    ('public.marcar_vaga_escala(uuid,date,text,text,public.papel)',
     $a$' · ' || p_turno || CASE$a$,
     $n$' · ' || private.turno_no_texto(p_turno) || CASE$n$),
    ('public.candidatar_faixa(uuid,date,text)',
     $a$IF p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Faixa inválida: manhã, tarde ou noite.'; END IF;$a$,
     $n$IF private.turno_valido(v_unidade, p_turno, 'medico') IS NOT TRUE THEN RAISE EXCEPTION 'Faixa inválida: escolha um turno ativo da unidade.'; END IF;$n$),
    ('private.descrever_plantao(uuid)',
     $a$CASE e.turno WHEN 'manha' THEN 'manhã' WHEN 'tarde' THEN 'tarde' ELSE 'noite' END$a$,
     $n$private.nome_do_turno(e.turno)$n$),
    ('public.gerar_escala_mensal_detalhada(uuid,integer,integer)',
     $a$' (' || f.turno || ').$a$,
     $n$' (' || private.turno_no_texto(f.turno) || ').$n$),
    ('public.gerar_escala_mensal_detalhada(uuid,integer,integer)',
     $a$' · ' || f.turno || ' (conflito$a$,
     $n$' · ' || private.turno_no_texto(f.turno) || ' (conflito$n$),
    ('private.plantao_erp_valor(uuid,uuid,text,integer,boolean)',
     $a$CASE WHEN p_turno = 'noite' THEN 720 ELSE 360 END$a$,
     $n$private.duracao_padrao(p_turno)$n$),
    ('public.resumo_carga_plantonistas(uuid,date,date)',
     $a$bool_or(e.turno IN ('manha','tarde'))$a$,
     $n$bool_or(private.classe_do_turno(e.turno, e.inicio) = 'diurno')$n$),
    ('public.resumo_carga_plantonistas(uuid,date,date)',
     $a$bool_or(e.turno = 'noite')$a$,
     $n$bool_or(private.classe_do_turno(e.turno, e.inicio) = 'noturno')$n$)
  ) AS x(fn, antigo, novo)
  ORDER BY fn
  LOOP
    IF atual IS DISTINCT FROM t.fn THEN
      IF mudou THEN EXECUTE def; END IF;
      atual := t.fn;
      def := pg_get_functiondef(t.fn::regprocedure);
      mudou := false;
    END IF;
    IF position(t.novo IN def) > 0 THEN
      def := replace(def, t.novo, t.antigo);
      mudou := true;
    END IF;
  END LOOP;
  IF mudou THEN EXECUTE def; END IF;
END $$;

-- ── 3. início, duração e janela como antes ─────────────────────────────────
CREATE OR REPLACE FUNCTION private.inicio_do_turno(p_data date, p_turno text)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (p_data + CASE p_turno
            WHEN 'manha'     THEN time '07:00'
            WHEN 'tarde'     THEN time '13:00'
            WHEN 'noite'     THEN time '19:00'
            WHEN 'madrugada' THEN time '01:00'
          END) AT TIME ZONE 'America/Sao_Paulo';
$$;

CREATE OR REPLACE FUNCTION private.duracao_padrao(p_turno text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_turno WHEN 'noite' THEN 720 ELSE 360 END;
$$;

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
  NEW.inicio := private.inicio_do_turno(NEW.data, NEW.turno);
  NEW.duracao_min := coalesce(NEW.duracao_min, private.duracao_padrao(NEW.turno));
  IF NEW.turno IN ('manha', 'tarde', 'madrugada') AND NEW.duracao_min <> 360 THEN
    RAISE EXCEPTION 'O turno % tem 6 horas.', NEW.turno;
  END IF;
  RETURN NEW;
END; $$;

-- ── 4. CHECK como antes ────────────────────────────────────────────────────
ALTER TABLE public.escala_plantao DROP CONSTRAINT IF EXISTS escala_plantao_turno_check;
ALTER TABLE public.escala_plantao ADD CONSTRAINT escala_plantao_turno_check CHECK (turno IN ('manha', 'tarde', 'noite', 'madrugada'));
ALTER TABLE public.presenca_plantonista DROP CONSTRAINT IF EXISTS presenca_plantonista_turno_check;
ALTER TABLE public.presenca_plantonista ADD CONSTRAINT presenca_plantonista_turno_check CHECK (turno IN ('manha', 'tarde', 'noite', 'madrugada'));
ALTER TABLE public.escala_fixa DROP CONSTRAINT IF EXISTS escala_fixa_turno_check;
ALTER TABLE public.escala_fixa ADD CONSTRAINT escala_fixa_turno_check CHECK (turno IN ('manha', 'tarde', 'noite'));
ALTER TABLE public.escala_vagas DROP CONSTRAINT IF EXISTS escala_vagas_turno_check;
ALTER TABLE public.escala_vagas ADD CONSTRAINT escala_vagas_turno_check CHECK (turno IN ('manha', 'tarde', 'noite'));
ALTER TABLE public.candidaturas_escala DROP CONSTRAINT IF EXISTS candidaturas_escala_turno_check;
ALTER TABLE public.candidaturas_escala ADD CONSTRAINT candidaturas_escala_turno_check CHECK (turno IN ('manha', 'tarde', 'noite'));
ALTER TABLE public.escala_plantao DROP CONSTRAINT IF EXISTS escala_plantao_duracao_check;
ALTER TABLE public.escala_plantao ADD CONSTRAINT escala_plantao_duracao_check
  CHECK (duracao_min IN (360, 720) OR (fracionado AND duracao_min BETWEEN 60 AND 720));

-- ── 5. gatilhos, funções e tabela ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_turno_da_unidade ON public.escala_fixa;
DROP TRIGGER IF EXISTS trg_turno_da_unidade ON public.escala_plantao;
DROP TRIGGER IF EXISTS trg_turno_da_unidade ON public.escala_vagas;
DROP TRIGGER IF EXISTS trg_turno_da_unidade ON public.candidaturas_escala;
DROP TRIGGER IF EXISTS trg_unidade_nova_turnos ON public.unidades;
DROP FUNCTION IF EXISTS public.salvar_turno_unidade(uuid, uuid, text, time, time, text, boolean, integer);
DROP FUNCTION IF EXISTS public.ativar_turno_unidade(uuid, boolean);
DROP FUNCTION IF EXISTS private.conferir_turno_da_unidade();
DROP FUNCTION IF EXISTS private.unidade_nova_turnos();
DROP FUNCTION IF EXISTS private.semear_turnos_unidade(uuid);
DROP FUNCTION IF EXISTS private.turno_valido(uuid, text, text);
DROP FUNCTION IF EXISTS private.nome_do_turno(text);
DROP FUNCTION IF EXISTS private.turno_no_texto(text);
DROP FUNCTION IF EXISTS private.classe_do_turno(text, timestamptz);
DROP FUNCTION IF EXISTS private.turnos_da_grade(uuid);
DROP TABLE IF EXISTS public.turnos_unidade;
DROP FUNCTION IF EXISTS private.minutos_do_turno(time, time);

COMMIT;
