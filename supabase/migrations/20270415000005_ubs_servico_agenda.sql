-- Percurso da UBS, U6, PR 1 (plano docs/ubs/U6-U7-PLANO.md; RT, 17/11/2026):
-- tipo de serviço na consulta marcada da agenda da UBS.
--
-- 1. agendamentos.servico (expand, anulável): consulta médica, consulta de
--    enfermagem, coleta de preventivo, inserção de implante, inserção de DIU,
--    curativo, teste rápido ou outro. A vacinação ficou fora (P3 = B: vai com a
--    integração do SI-PNI e da RNDS, U15).
-- 2. Serviços de cada profissional (plano aprovado):
--      médico (plantonista): consulta médica, implante, DIU, preventivo, outro;
--      enfermeiro: consulta de enfermagem, preventivo, curativo, teste rápido, outro.
--    Sem serviço informado, vale a consulta do profissional (médica ou de
--    enfermagem). As consultas já marcadas ficam como estão (sem serviço).
-- 3. agenda_marcar ganha p_servico (padrão nulo); agenda_dia devolve o serviço.
--
-- Idempotente. Teste: supabase/tests/ubs_servico_agenda.sql
--
-- Rollback (na ordem):
--   recriar public.agenda_marcar(uuid, uuid, timestamptz, uuid, text, text, uuid)
--     de 20270214000001_agenda_ubs.sql e
--     DROP FUNCTION public.agenda_marcar(uuid, uuid, timestamptz, uuid, text, text, uuid, text);
--   a troca do agenda_dia invertida;
--   DROP FUNCTION private.agenda_servicos_do_profissional(uuid, uuid);
--   a coluna fica (expand); para tirá-la, com janela:
--   ALTER TABLE public.agendamentos DROP COLUMN servico;

-- ── 1. coluna ───────────────────────────────────────────────────────────────
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS servico text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agendamentos_servico_check'
                   AND conrelid = 'public.agendamentos'::regclass) THEN
    ALTER TABLE public.agendamentos ADD CONSTRAINT agendamentos_servico_check CHECK (
      servico IS NULL OR (tipo = 'consulta' AND servico IN ('consulta_medica', 'consulta_enfermagem', 'preventivo',
                                                           'implante', 'diu', 'curativo', 'teste_rapido', 'outro')));
  END IF;
END $$;
COMMENT ON COLUMN public.agendamentos.servico IS
  'Serviço da consulta marcada (percurso da UBS, U6): consulta médica ou de enfermagem, preventivo, implante, DIU, curativo, teste rápido, outro. Nulo nas antigas.';

-- ── 2. serviços de cada profissional ────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.agenda_servicos_do_profissional(p_unidade uuid, p_perfil uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ARRAY(SELECT DISTINCT s FROM (
    SELECT unnest(ARRAY['consulta_medica', 'implante', 'diu', 'preventivo', 'outro']) s
     WHERE EXISTS (SELECT 1 FROM public.vinculos WHERE unidade_id = p_unidade AND perfil_id = p_perfil AND ativo AND papel::text = 'plantonista')
    UNION ALL
    SELECT unnest(ARRAY['consulta_enfermagem', 'preventivo', 'curativo', 'teste_rapido', 'outro'])
     WHERE EXISTS (SELECT 1 FROM public.vinculos WHERE unidade_id = p_unidade AND perfil_id = p_perfil AND ativo AND papel::text = 'enfermeiro')
  ) x ORDER BY 1)
$$;
REVOKE ALL ON FUNCTION private.agenda_servicos_do_profissional(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. marcação com o serviço ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.agenda_marcar(uuid, uuid, timestamptz, uuid, text, text, uuid);
CREATE OR REPLACE FUNCTION public.agenda_marcar(p_unidade uuid, p_perfil uuid, p_inicio timestamptz, p_paciente uuid,
  p_tipo_atendimento text DEFAULT 'consulta_agendada', p_observacao text DEFAULT NULL, p_origem_episodio uuid DEFAULT NULL,
  p_servico text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.agenda_configuracoes;
  v_fim timestamptz;
  v_id uuid;
  v_permitidos text[];
  v_servico text := nullif(btrim(coalesce(p_servico, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  PERFORM private.agenda_exigir_ubs(p_unidade);
  IF NOT private.agenda_pode_marcar(p_unidade) THEN RAISE EXCEPTION 'Acesso negado: marca a recepção, a enfermagem, o médico ou o gestor.'; END IF;
  PERFORM private.agenda_exigir_profissional(p_unidade, p_perfil);
  IF p_tipo_atendimento NOT IN ('consulta_agendada', 'consulta_programada') THEN
    RAISE EXCEPTION 'Tipo da consulta: agendada ou programada (cuidado continuado).';
  END IF;
  -- U6: o serviço é um dos do profissional; sem serviço, a consulta dele
  v_permitidos := private.agenda_servicos_do_profissional(p_unidade, p_perfil);
  IF v_servico IS NULL THEN
    v_servico := CASE WHEN 'consulta_medica' = ANY (v_permitidos) THEN 'consulta_medica' ELSE 'consulta_enfermagem' END;
  END IF;
  IF NOT (v_servico = ANY (v_permitidos)) THEN
    RAISE EXCEPTION 'Este profissional não faz este serviço na agenda.';
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
                                   origem_episodio_id, marcado_por, servico)
  VALUES (p_unidade, p_perfil, 'consulta', p_paciente, p_tipo_atendimento, p_inicio, v_fim, nullif(btrim(p_observacao), ''),
          p_origem_episodio, private.meu_perfil_id(), v_servico)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('agendamento_marcado', 'agendamentos', v_id, p_unidade,
    jsonb_build_object('perfil_id', p_perfil, 'tipo', 'consulta', 'status', 'agendado', 'servico', v_servico));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.agenda_marcar(uuid, uuid, timestamptz, uuid, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_marcar(uuid, uuid, timestamptz, uuid, text, text, uuid, text) TO authenticated;

-- ── 4. a agenda do dia mostra o serviço ─────────────────────────────────────
DO $$
DECLARE
  def text := replace(pg_get_functiondef('public.agenda_dia(uuid, date)'::regprocedure), chr(13), '');
  antigo text := '''tipo_atendimento_aps'', a.tipo_atendimento_aps, ''observacao'', a.observacao,';
  novo text := '''tipo_atendimento_aps'', a.tipo_atendimento_aps, ''servico'', a.servico, ''observacao'', a.observacao,';
BEGIN
  IF position(novo IN def) > 0 THEN RETURN; END IF;
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'agenda_dia mudou: trecho do item não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;
