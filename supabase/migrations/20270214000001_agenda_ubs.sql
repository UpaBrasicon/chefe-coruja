-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 3, parte 3.1 (BACKLOG.md; decisões do RT em 02/11/2026, F1 a F6 =
-- A): agenda de consultas da UBS, pelo Manual do PEC do e-SUS APS (MS):
-- configuração por profissional (3.5.5), fechamento (3.5.6), marcação e
-- reserva (5.1, 5.2), situações e falta (5.1.3, 5.1.6), chegada à lista de
-- atendimento (5.1.2) e cancelamento (5.1.5).
--
-- 1. agenda_configuracoes: por profissional na unidade, dia da semana e
--    período, com início, fim e duração da consulta (F1). O gestor configura
--    (F2). Mudar a configuração não mexe no que já está marcado.
-- 2. agenda_fechamentos: período fechado com motivo (F5); não se marca dentro.
-- 3. agendamentos: consulta (com paciente) ou reserva (com motivo), situação
--    agendado → presente → realizado / não aguardou; não compareceu; cancelado
--    (F4). Recepção, enfermagem, médico e gestor marcam e cancelam (F2).
--    Origem opcional: o episódio de onde veio a marcação (F6).
-- 4. episodios.agendamento_id (anulável): a chegada abre a ficha ligada (F3);
--    o gatilho private.agendamento_segue_episodio() fecha o agendamento quando
--    o episódio encerra.
--
-- A escala continua valendo para atender (D2 da tarefa 2): a agenda_dia mostra
-- se cada horário está dentro da escala do profissional. Só UBS.
-- Tabelas com RLS e sem acesso direto: leitura e escrita só pelas RPCs.
-- Idempotente. Teste: supabase/tests/5a_agenda.sql
--
-- Rollback (na ordem):
--   DROP TRIGGER trg_agendamento_segue_episodio ON public.episodios;
--   DROP FUNCTION das RPCs agenda_* e private.agenda_*;
--   ALTER TABLE public.episodios DROP COLUMN agendamento_id;   -- só a agenda usa
--   DROP TABLE public.agendamentos, public.agenda_fechamentos, public.agenda_configuracoes;
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 a 3. tabelas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agenda_configuracoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  perfil_id    uuid NOT NULL REFERENCES public.perfis(id),
  dia_semana   smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),   -- 0 = domingo
  periodo      text NOT NULL CHECK (periodo IN ('manha', 'tarde', 'noite')),
  hora_inicio  time NOT NULL,
  hora_fim     time NOT NULL,
  duracao_min  smallint NOT NULL CHECK (duracao_min BETWEEN 5 AND 240),
  criada_por   uuid NOT NULL REFERENCES public.perfis(id),
  criada_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, perfil_id, dia_semana, periodo),
  CHECK (hora_fim > hora_inicio),
  CHECK (hora_fim - hora_inicio >= make_interval(mins => duracao_min))
);

CREATE TABLE IF NOT EXISTS public.agenda_fechamentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  perfil_id     uuid NOT NULL REFERENCES public.perfis(id),
  inicio        date NOT NULL,
  fim           date NOT NULL,
  motivo        text NOT NULL CHECK (motivo IN ('atestado', 'curso', 'ferias', 'licenca', 'reuniao', 'outro')),
  especifique   text,
  criado_por    uuid NOT NULL REFERENCES public.perfis(id),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  cancelado_em  timestamptz,
  cancelado_por uuid REFERENCES public.perfis(id),
  CHECK (fim >= inicio),
  CHECK (motivo <> 'outro' OR length(btrim(coalesce(especifique, ''))) >= 3)
);
CREATE INDEX IF NOT EXISTS idx_agenda_fechamentos ON public.agenda_fechamentos (unidade_id, perfil_id, inicio);

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  perfil_id           uuid NOT NULL REFERENCES public.perfis(id),
  tipo                text NOT NULL CHECK (tipo IN ('consulta', 'reserva')),
  paciente_id         uuid REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  tipo_atendimento_aps text CHECK (tipo_atendimento_aps IN ('consulta_agendada', 'consulta_programada')),
  motivo_reserva      text CHECK (motivo_reserva IN ('atendimento_externo', 'atividade_coletiva', 'reuniao', 'outro')),
  especifique         text,
  inicio              timestamptz NOT NULL,
  fim                 timestamptz NOT NULL,
  observacao          text,
  situacao            text NOT NULL DEFAULT 'agendado'
                      CHECK (situacao IN ('agendado', 'presente', 'realizado', 'nao_aguardou', 'nao_compareceu', 'cancelado')),
  episodio_id         uuid REFERENCES public.episodios(id),
  origem_episodio_id  uuid REFERENCES public.episodios(id),
  marcado_por         uuid NOT NULL REFERENCES public.perfis(id),
  marcado_em          timestamptz NOT NULL DEFAULT now(),
  situacao_em         timestamptz,
  situacao_por        uuid REFERENCES public.perfis(id),
  motivo_cancelamento text,
  CHECK (fim > inicio),
  CHECK (tipo <> 'consulta' OR (paciente_id IS NOT NULL AND tipo_atendimento_aps IS NOT NULL AND motivo_reserva IS NULL)),
  CHECK (tipo <> 'reserva' OR (paciente_id IS NULL AND motivo_reserva IS NOT NULL
                               AND situacao IN ('agendado', 'cancelado'))),
  CHECK (motivo_reserva IS DISTINCT FROM 'outro' OR length(btrim(coalesce(especifique, ''))) >= 3),
  CHECK (situacao NOT IN ('presente', 'realizado', 'nao_aguardou') OR episodio_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_agendamentos_dia ON public.agendamentos (unidade_id, inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_profissional ON public.agendamentos (perfil_id, inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente ON public.agendamentos (paciente_id, inicio DESC);

ALTER TABLE public.agenda_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agenda_configuracoes, public.agenda_fechamentos, public.agendamentos FROM anon, authenticated;

-- ── 4. ligação com o episódio ───────────────────────────────────────────────
ALTER TABLE public.episodios ADD COLUMN IF NOT EXISTS agendamento_id uuid REFERENCES public.agendamentos(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_episodios_agendamento ON public.episodios (agendamento_id) WHERE agendamento_id IS NOT NULL;
COMMENT ON COLUMN public.episodios.agendamento_id IS
  'Consulta da agenda da UBS que abriu este episódio (chegada do agendado, 5A tarefa 3).';

-- ── apoio ───────────────────────────────────────────────────────────────────
-- só UBS; quem lê é quem tem vínculo na unidade
CREATE OR REPLACE FUNCTION private.agenda_exigir_ubs(p_unidade uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = p_unidade AND tipo = 'ubs') THEN
    RAISE EXCEPTION 'A agenda de consultas é da UBS.';
  END IF;
END $$;

-- F2: recepção, enfermagem, médico e gestor marcam e cancelam
CREATE OR REPLACE FUNCTION private.agenda_pode_marcar(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.eh_super_admin(), false)
      OR EXISTS (SELECT 1 FROM unnest(ARRAY['recepcao', 'enfermeiro', 'tecnico_enfermagem', 'plantonista', 'gestor']) r
                  WHERE private.tenho_papel(p_unidade, r) IS TRUE)
$$;

-- F2: o gestor configura (o "coordenador" do PEC)
CREATE OR REPLACE FUNCTION private.agenda_exigir_gestor(p_unidade uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (coalesce(private.eh_super_admin(), false) OR private.tenho_papel(p_unidade, 'gestor') IS TRUE) THEN
    RAISE EXCEPTION 'A configuração da agenda é do gestor da unidade.';
  END IF;
END $$;

-- quem tem agenda: médico ou enfermeiro com vínculo ativo na unidade
CREATE OR REPLACE FUNCTION private.agenda_exigir_profissional(p_unidade uuid, p_perfil uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.vinculos WHERE unidade_id = p_unidade AND perfil_id = p_perfil AND ativo
                    AND papel::text IN ('plantonista', 'enfermeiro')) THEN
    RAISE EXCEPTION 'Este profissional não tem agenda nesta unidade (médico ou enfermeiro com vínculo ativo).';
  END IF;
END $$;

-- o horário cabe na grade do profissional: devolve a configuração do período
CREATE OR REPLACE FUNCTION private.agenda_periodo_do_horario(p_unidade uuid, p_perfil uuid, p_inicio timestamptz)
RETURNS public.agenda_configuracoes LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_local timestamp := p_inicio AT TIME ZONE 'America/Sao_Paulo';
  c public.agenda_configuracoes;
BEGIN
  SELECT * INTO c FROM public.agenda_configuracoes
   WHERE unidade_id = p_unidade AND perfil_id = p_perfil AND dia_semana = extract(dow FROM v_local)
     AND v_local::time >= hora_inicio
     AND v_local::time + make_interval(mins => duracao_min) <= hora_fim
     AND (extract(epoch FROM v_local::time - hora_inicio) / 60)::int % duracao_min = 0
     AND date_trunc('minute', v_local) = v_local;
  IF NOT FOUND THEN RAISE EXCEPTION 'Horário fora da agenda do profissional.'; END IF;
  RETURN c;
END $$;

-- o dia não está fechado e o horário está livre (com trava por profissional)
CREATE OR REPLACE FUNCTION private.agenda_exigir_livre(p_unidade uuid, p_perfil uuid, p_inicio timestamptz, p_fim timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.agenda_fechamentos;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('agenda:' || p_unidade::text || ':' || p_perfil::text, 0));
  IF p_inicio <= now() THEN RAISE EXCEPTION 'Só se marca em horário futuro.'; END IF;
  SELECT * INTO f FROM public.agenda_fechamentos
   WHERE unidade_id = p_unidade AND perfil_id = p_perfil AND cancelado_em IS NULL
     AND (p_inicio AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN inicio AND fim
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'A agenda está fechada nesse dia (%).', coalesce(nullif(btrim(f.especifique), ''), f.motivo);
  END IF;
  IF EXISTS (SELECT 1 FROM public.agendamentos
              WHERE unidade_id = p_unidade AND perfil_id = p_perfil AND situacao IN ('agendado', 'presente')
                AND tstzrange(inicio, fim) && tstzrange(p_inicio, p_fim)) THEN
    RAISE EXCEPTION 'Esse horário já está ocupado.';
  END IF;
END $$;

REVOKE ALL ON FUNCTION private.agenda_exigir_ubs(uuid), private.agenda_pode_marcar(uuid), private.agenda_exigir_gestor(uuid),
  private.agenda_exigir_profissional(uuid, uuid), private.agenda_periodo_do_horario(uuid, uuid, timestamptz),
  private.agenda_exigir_livre(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- ── configuração (gestor) ───────────────────────────────────────────────────
-- p_horarios: [{"dia": 1, "periodo": "manha", "inicio": "07:00", "fim": "11:00", "duracao": 20}, ...]
-- troca a grade inteira do profissional; o que já está marcado fica.
CREATE OR REPLACE FUNCTION public.agenda_definir_configuracao(p_unidade uuid, p_perfil uuid, p_horarios jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  h jsonb;
  v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  PERFORM private.agenda_exigir_ubs(p_unidade);
  PERFORM private.agenda_exigir_gestor(p_unidade);
  PERFORM private.agenda_exigir_profissional(p_unidade, p_perfil);
  IF jsonb_typeof(coalesce(p_horarios, '[]')) <> 'array' THEN RAISE EXCEPTION 'Horários em lista.'; END IF;
  DELETE FROM public.agenda_configuracoes WHERE unidade_id = p_unidade AND perfil_id = p_perfil;
  FOR h IN SELECT * FROM jsonb_array_elements(coalesce(p_horarios, '[]')) LOOP
    IF NOT (h ? 'dia' AND h ? 'periodo' AND h ? 'inicio' AND h ? 'fim' AND h ? 'duracao') THEN
      RAISE EXCEPTION 'Cada horário tem dia, período, início, fim e duração.';
    END IF;
    INSERT INTO public.agenda_configuracoes (unidade_id, perfil_id, dia_semana, periodo, hora_inicio, hora_fim, duracao_min, criada_por)
    VALUES (p_unidade, p_perfil, (h ->> 'dia')::smallint, h ->> 'periodo', (h ->> 'inicio')::time, (h ->> 'fim')::time,
            (h ->> 'duracao')::smallint, v_eu);
  END LOOP;
  -- dois períodos do mesmo dia não se cruzam
  IF EXISTS (SELECT 1 FROM public.agenda_configuracoes a JOIN public.agenda_configuracoes b
                ON a.unidade_id = b.unidade_id AND a.perfil_id = b.perfil_id AND a.dia_semana = b.dia_semana AND a.id < b.id
              WHERE a.unidade_id = p_unidade AND a.perfil_id = p_perfil
                AND a.hora_inicio < b.hora_fim AND b.hora_inicio < a.hora_fim) THEN
    RAISE EXCEPTION 'Dois períodos do mesmo dia se cruzam.';
  END IF;
  PERFORM private.registrar_auditoria('agenda_configurada', 'agenda_configuracoes', p_perfil, p_unidade,
    jsonb_build_object('perfil_id', p_perfil, 'quantidade', jsonb_array_length(coalesce(p_horarios, '[]'))));
END $$;

CREATE OR REPLACE FUNCTION public.agenda_fechar(p_unidade uuid, p_perfil uuid, p_inicio date, p_fim date, p_motivo text,
  p_especifique text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; n int;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  PERFORM private.agenda_exigir_ubs(p_unidade);
  PERFORM private.agenda_exigir_gestor(p_unidade);
  PERFORM private.agenda_exigir_profissional(p_unidade, p_perfil);
  SELECT count(*) INTO n FROM public.agendamentos
   WHERE unidade_id = p_unidade AND perfil_id = p_perfil AND tipo = 'consulta' AND situacao = 'agendado'
     AND (inicio AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim;
  IF n > 0 THEN
    RAISE EXCEPTION 'Há % consulta(s) marcada(s) nesse período: cancele ou remarque antes de fechar a agenda.', n;
  END IF;
  INSERT INTO public.agenda_fechamentos (unidade_id, perfil_id, inicio, fim, motivo, especifique, criado_por)
  VALUES (p_unidade, p_perfil, p_inicio, p_fim, p_motivo, nullif(btrim(p_especifique), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('agenda_fechada', 'agenda_fechamentos', v_id, p_unidade,
    jsonb_build_object('perfil_id', p_perfil, 'tipo', p_motivo));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.agenda_reabrir(p_fechamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.agenda_fechamentos;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO f FROM public.agenda_fechamentos WHERE id = p_fechamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fechamento não encontrado.'; END IF;
  PERFORM private.agenda_exigir_gestor(f.unidade_id);
  IF f.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Este fechamento já foi desfeito.'; END IF;
  UPDATE public.agenda_fechamentos SET cancelado_em = now(), cancelado_por = private.meu_perfil_id() WHERE id = f.id;
  PERFORM private.registrar_auditoria('agenda_reaberta', 'agenda_fechamentos', f.id, f.unidade_id,
    jsonb_build_object('perfil_id', f.perfil_id));
END $$;

-- ── marcação ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_marcar(p_unidade uuid, p_perfil uuid, p_inicio timestamptz, p_paciente uuid,
  p_tipo_atendimento text DEFAULT 'consulta_agendada', p_observacao text DEFAULT NULL, p_origem_episodio uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.agenda_configuracoes;
  v_fim timestamptz;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  PERFORM private.agenda_exigir_ubs(p_unidade);
  IF NOT private.agenda_pode_marcar(p_unidade) THEN RAISE EXCEPTION 'Acesso negado: marca a recepção, a enfermagem, o médico ou o gestor.'; END IF;
  PERFORM private.agenda_exigir_profissional(p_unidade, p_perfil);
  IF p_tipo_atendimento NOT IN ('consulta_agendada', 'consulta_programada') THEN
    RAISE EXCEPTION 'Tipo da consulta: agendada ou programada (cuidado continuado).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente) THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF p_origem_episodio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = p_origem_episodio
                                                      AND paciente_id = p_paciente AND unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'A consulta de origem não é deste paciente nesta unidade.';
  END IF;
  c := private.agenda_periodo_do_horario(p_unidade, p_perfil, p_inicio);
  v_fim := p_inicio + make_interval(mins => c.duracao_min);
  PERFORM private.agenda_exigir_livre(p_unidade, p_perfil, p_inicio, v_fim);
  IF EXISTS (SELECT 1 FROM public.agendamentos WHERE perfil_id = p_perfil AND paciente_id = p_paciente
                AND situacao IN ('agendado', 'presente')
                AND (inicio AT TIME ZONE 'America/Sao_Paulo')::date = (p_inicio AT TIME ZONE 'America/Sao_Paulo')::date) THEN
    RAISE EXCEPTION 'O paciente já tem consulta marcada com este profissional nesse dia.';
  END IF;
  INSERT INTO public.agendamentos (unidade_id, perfil_id, tipo, paciente_id, tipo_atendimento_aps, inicio, fim, observacao,
                                   origem_episodio_id, marcado_por)
  VALUES (p_unidade, p_perfil, 'consulta', p_paciente, p_tipo_atendimento, p_inicio, v_fim, nullif(btrim(p_observacao), ''),
          p_origem_episodio, private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('agendamento_marcado', 'agendamentos', v_id, p_unidade,
    jsonb_build_object('perfil_id', p_perfil, 'tipo', 'consulta', 'status', 'agendado'));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.agenda_reservar(p_unidade uuid, p_perfil uuid, p_inicio timestamptz, p_motivo text,
  p_especifique text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.agenda_configuracoes;
  v_fim timestamptz;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  PERFORM private.agenda_exigir_ubs(p_unidade);
  IF NOT private.agenda_pode_marcar(p_unidade) THEN RAISE EXCEPTION 'Acesso negado: marca a recepção, a enfermagem, o médico ou o gestor.'; END IF;
  PERFORM private.agenda_exigir_profissional(p_unidade, p_perfil);
  c := private.agenda_periodo_do_horario(p_unidade, p_perfil, p_inicio);
  v_fim := p_inicio + make_interval(mins => c.duracao_min);
  PERFORM private.agenda_exigir_livre(p_unidade, p_perfil, p_inicio, v_fim);
  INSERT INTO public.agendamentos (unidade_id, perfil_id, tipo, motivo_reserva, especifique, inicio, fim, marcado_por)
  VALUES (p_unidade, p_perfil, 'reserva', p_motivo, nullif(btrim(p_especifique), ''), p_inicio, v_fim, private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('agendamento_marcado', 'agendamentos', v_id, p_unidade,
    jsonb_build_object('perfil_id', p_perfil, 'tipo', 'reserva', 'status', 'agendado'));
  RETURN v_id;
END $$;

-- cancelar só antes do horário, sem justificativa obrigatória (F4, PEC 5.1.5)
CREATE OR REPLACE FUNCTION public.agenda_cancelar(p_agendamento uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.agendamentos;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO a FROM public.agendamentos WHERE id = p_agendamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;
  IF NOT private.agenda_pode_marcar(a.unidade_id) THEN RAISE EXCEPTION 'Acesso negado: cancela a recepção, a enfermagem, o médico ou o gestor.'; END IF;
  IF a.situacao <> 'agendado' THEN RAISE EXCEPTION 'Só se cancela o que está agendado.'; END IF;
  IF a.inicio <= now() THEN RAISE EXCEPTION 'O horário já passou: registre a falta.'; END IF;
  UPDATE public.agendamentos
     SET situacao = 'cancelado', situacao_em = now(), situacao_por = private.meu_perfil_id(),
         motivo_cancelamento = nullif(btrim(p_motivo), '')
   WHERE id = a.id;
  PERFORM private.registrar_auditoria('agendamento_cancelado', 'agendamentos', a.id, a.unidade_id,
    jsonb_build_object('tipo', a.tipo, 'status', 'cancelado'));
END $$;

-- "não compareceu" só depois do horário; desfazer só no mesmo dia (F4, PEC 5.1.6)
CREATE OR REPLACE FUNCTION public.agenda_registrar_falta(p_agendamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.agendamentos;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO a FROM public.agendamentos WHERE id = p_agendamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;
  IF NOT private.agenda_pode_marcar(a.unidade_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF a.tipo <> 'consulta' OR a.situacao <> 'agendado' THEN RAISE EXCEPTION 'Só se registra falta de consulta agendada.'; END IF;
  IF a.inicio > now() THEN RAISE EXCEPTION 'O horário ainda não chegou.'; END IF;
  UPDATE public.agendamentos SET situacao = 'nao_compareceu', situacao_em = now(), situacao_por = private.meu_perfil_id()
   WHERE id = a.id;
  PERFORM private.registrar_auditoria('agendamento_falta', 'agendamentos', a.id, a.unidade_id,
    jsonb_build_object('status', 'nao_compareceu'));
END $$;

CREATE OR REPLACE FUNCTION public.agenda_desfazer_falta(p_agendamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.agendamentos;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO a FROM public.agendamentos WHERE id = p_agendamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;
  IF NOT private.agenda_pode_marcar(a.unidade_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF a.situacao <> 'nao_compareceu' THEN RAISE EXCEPTION 'Este agendamento não está com falta.'; END IF;
  IF (a.inicio AT TIME ZONE 'America/Sao_Paulo')::date <> private.data_atual() THEN
    RAISE EXCEPTION 'A falta só se desfaz no dia da consulta.';
  END IF;
  UPDATE public.agendamentos SET situacao = 'agendado', situacao_em = now(), situacao_por = private.meu_perfil_id()
   WHERE id = a.id;
  PERFORM private.registrar_auditoria('agendamento_falta_desfeita', 'agendamentos', a.id, a.unidade_id,
    jsonb_build_object('status', 'agendado'));
END $$;

-- chegada: abre a ficha da UBS ligada ao agendamento (F3, PEC 5.1.2). A ficha
-- segue as regras de registrar_ficha (consultório da UBS, quem pode abrir).
CREATE OR REPLACE FUNCTION public.agenda_registrar_chegada(p_agendamento uuid, p_setor uuid, p_queixa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.agendamentos;
  r jsonb;
  v_epi uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO a FROM public.agendamentos WHERE id = p_agendamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;
  IF a.tipo <> 'consulta' OR a.situacao <> 'agendado' THEN RAISE EXCEPTION 'Só chega quem tem consulta agendada.'; END IF;
  IF (a.inicio AT TIME ZONE 'America/Sao_Paulo')::date <> private.data_atual() THEN
    RAISE EXCEPTION 'A chegada se registra no dia da consulta.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.setores WHERE id = p_setor AND unidade_id = a.unidade_id) THEN
    RAISE EXCEPTION 'O consultório não é desta unidade.';
  END IF;
  r := public.registrar_ficha(p_setor, p_queixa, a.paciente_id, jsonb_build_object('tipo_atendimento', a.tipo_atendimento_aps));
  v_epi := (r ->> 'episodio_id')::uuid;
  UPDATE public.episodios SET agendamento_id = a.id WHERE id = v_epi;
  UPDATE public.agendamentos SET situacao = 'presente', episodio_id = v_epi, situacao_em = now(), situacao_por = private.meu_perfil_id()
   WHERE id = a.id;
  PERFORM private.registrar_auditoria('agendamento_presente', 'agendamentos', a.id, a.unidade_id,
    jsonb_build_object('status', 'presente'));
  RETURN r || jsonb_build_object('agendamento_id', a.id);
END $$;

-- o episódio encerrado fecha o agendamento: consulta feita = realizado; evasão
-- = não aguardou; ficha retirada por engano ou duplicada = volta a agendado
CREATE OR REPLACE FUNCTION private.agendamento_segue_episodio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.agendamento_id IS NOT NULL AND NEW.etapa = 'encerrado' AND OLD.etapa IS DISTINCT FROM 'encerrado' THEN
    IF NEW.desfecho = 'cancelado' THEN
      UPDATE public.agendamentos SET situacao = 'agendado', episodio_id = NULL, situacao_em = now()
       WHERE id = NEW.agendamento_id AND situacao = 'presente';
      UPDATE public.episodios SET agendamento_id = NULL WHERE id = NEW.id;
    ELSE
      UPDATE public.agendamentos
         SET situacao = CASE WHEN NEW.desfecho = 'evasao' THEN 'nao_aguardou' ELSE 'realizado' END, situacao_em = now()
       WHERE id = NEW.agendamento_id AND situacao = 'presente';
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.agendamento_segue_episodio() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_agendamento_segue_episodio ON public.episodios;
CREATE TRIGGER trg_agendamento_segue_episodio AFTER UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.agendamento_segue_episodio();

-- ── leitura ─────────────────────────────────────────────────────────────────
-- o dia da agenda: por profissional, os horários da grade (com o que está
-- marcado, se cabe na escala e se o dia está fechado) e o que ficou fora da
-- grade (marcado antes de a configuração mudar)
CREATE OR REPLACE FUNCTION public.agenda_dia(p_unidade uuid, p_data date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb;
BEGIN
  PERFORM private.agenda_exigir_ubs(p_unidade);
  IF private.segundo_fator_ok() IS NOT TRUE
     OR NOT (coalesce(private.eh_super_admin(), false) OR private.papel_na_unidade(p_unidade) IS NOT NULL) THEN
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
             'tipo_atendimento_aps', a.tipo_atendimento_aps, 'observacao', a.observacao,
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
END $$;

-- a configuração da unidade (tela do gestor): profissionais, grade e
-- fechamentos de hoje em diante
CREATE OR REPLACE FUNCTION public.agenda_configuracao(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.agenda_exigir_ubs(p_unidade);
  IF NOT (coalesce(private.eh_super_admin(), false) OR private.papel_na_unidade(p_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'perfil_id', pr.perfil_id, 'nome', pr.nome, 'papel', pr.papel,
      'horarios', coalesce((SELECT jsonb_agg(jsonb_build_object('dia', c.dia_semana, 'periodo', c.periodo,
                                    'inicio', to_char(c.hora_inicio, 'HH24:MI'), 'fim', to_char(c.hora_fim, 'HH24:MI'),
                                    'duracao', c.duracao_min) ORDER BY c.dia_semana, c.hora_inicio)
                              FROM public.agenda_configuracoes c WHERE c.unidade_id = p_unidade AND c.perfil_id = pr.perfil_id), '[]'::jsonb),
      'fechamentos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'inicio', f.inicio, 'fim', f.fim,
                                      'motivo', f.motivo, 'especifique', f.especifique) ORDER BY f.inicio)
                                FROM public.agenda_fechamentos f
                               WHERE f.unidade_id = p_unidade AND f.perfil_id = pr.perfil_id AND f.cancelado_em IS NULL
                                 AND f.fim >= private.data_atual()), '[]'::jsonb)
    ) ORDER BY pr.nome)
      FROM (SELECT v.perfil_id, pf.nome_completo AS nome, min(v.papel::text) AS papel
              FROM public.vinculos v JOIN public.perfis pf ON pf.id = v.perfil_id
             WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel::text IN ('plantonista', 'enfermeiro')
             GROUP BY v.perfil_id, pf.nome_completo) pr), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.agenda_definir_configuracao(uuid, uuid, jsonb),
  public.agenda_fechar(uuid, uuid, date, date, text, text), public.agenda_reabrir(uuid),
  public.agenda_marcar(uuid, uuid, timestamptz, uuid, text, text, uuid), public.agenda_reservar(uuid, uuid, timestamptz, text, text),
  public.agenda_cancelar(uuid, text), public.agenda_registrar_falta(uuid), public.agenda_desfazer_falta(uuid),
  public.agenda_registrar_chegada(uuid, uuid, text), public.agenda_dia(uuid, date), public.agenda_configuracao(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_definir_configuracao(uuid, uuid, jsonb),
  public.agenda_fechar(uuid, uuid, date, date, text, text), public.agenda_reabrir(uuid),
  public.agenda_marcar(uuid, uuid, timestamptz, uuid, text, text, uuid), public.agenda_reservar(uuid, uuid, timestamptz, text, text),
  public.agenda_cancelar(uuid, text), public.agenda_registrar_falta(uuid), public.agenda_desfazer_falta(uuid),
  public.agenda_registrar_chegada(uuid, uuid, text), public.agenda_dia(uuid, date), public.agenda_configuracao(uuid)
  TO authenticated;
