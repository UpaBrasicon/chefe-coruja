-- Percurso da UBS, U3 (RT, 17/11/2026, decisão A): horário de funcionamento da
-- UBS. Achados R3, M3 e GE2: a escala da UBS tinha noite de 12 h e fim de
-- semana, e a grade da agenda ia até 23:40, porque a UBS seguia o modelo da UPA.
--
-- 1. public.ubs_funcionamento: um horário por dia da semana (abre e fecha). Dia
--    sem linha = a UBS não abre. Sem nenhuma linha, nada muda (regra antiga).
-- 2. ubs_funcionamento(p_unidade) lê (quem tem papel na unidade) e
--    ubs_definir_funcionamento(p_unidade, p_horarios) grava (o gestor). Não
--    grava horário que deixaria de fora a grade da agenda ou a escala futura.
-- 3. Travas: a escala e a grade da agenda da UBS só aceitam turno ou período
--    dentro do funcionamento do dia.
-- 4. U1 com o horário: a ficha não atendida vence uma hora depois do
--    fechamento do dia (ou na virada, se o dia não tem horário). O job passa a
--    rodar a cada 30 minutos.
--
-- Idempotente. Teste: supabase/tests/ubs_funcionamento.sql
--
-- Rollback (na ordem):
--   DROP TRIGGER trg_escala_ubs_funcionamento ON public.escala_plantao;
--   DROP TRIGGER trg_agenda_ubs_funcionamento ON public.agenda_configuracoes;
--   DROP FUNCTION private.escala_ubs_funcionamento(), private.agenda_ubs_funcionamento(),
--     private.ubs_dentro_do_funcionamento(uuid, timestamp, timestamp),
--     public.ubs_funcionamento(uuid), public.ubs_definir_funcionamento(uuid, jsonb);
--   recriar private.ubs_vencer_fichas() de 20270415000001_ubs_ficha_vence.sql e
--     voltar o job 'ubs-ficha-vence' para '5 3 * * *';
--   DROP TABLE public.ubs_funcionamento (só com janela: some o horário salvo).

-- ── 1. tabela ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ubs_funcionamento (
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  dia_semana     smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),   -- 0 = domingo
  abre           time NOT NULL,
  fecha          time NOT NULL,
  atualizado_por uuid REFERENCES public.perfis(id),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (unidade_id, dia_semana),
  CHECK (fecha > abre)
);
ALTER TABLE public.ubs_funcionamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ubs_funcionamento FROM anon, authenticated;
COMMENT ON TABLE public.ubs_funcionamento IS
  'Horário de funcionamento da UBS por dia da semana (percurso da UBS, U3). Dia sem linha: fechada. Sem linhas: sem trava.';

-- o intervalo [de, ate), em hora local, cabe no funcionamento do dia? true
-- também quando a unidade não é UBS ou não tem horário salvo
CREATE OR REPLACE FUNCTION private.ubs_dentro_do_funcionamento(p_unidade uuid, p_de timestamp, p_ate timestamp)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = p_unidade AND tipo = 'ubs')
      OR NOT EXISTS (SELECT 1 FROM public.ubs_funcionamento WHERE unidade_id = p_unidade)
      OR EXISTS (SELECT 1 FROM public.ubs_funcionamento f
                  WHERE f.unidade_id = p_unidade
                    AND f.dia_semana = extract(dow FROM p_de)
                    AND p_ate::date = p_de::date
                    AND p_de::time >= f.abre
                    AND p_ate::time <= f.fecha)
$$;
REVOKE ALL ON FUNCTION private.ubs_dentro_do_funcionamento(uuid, timestamp, timestamp) FROM PUBLIC, anon, authenticated;

-- ── 2. leitura e gravação ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ubs_funcionamento(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- papel_na_unidade devolve '' sem papel: nunca IS NOT NULL
  IF NOT (coalesce(private.eh_super_admin(), false) OR coalesce(private.papel_na_unidade(p_unidade), '') <> '') THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('dia', dia_semana, 'abre', to_char(abre, 'HH24:MI'), 'fecha', to_char(fecha, 'HH24:MI'))
                                    ORDER BY dia_semana)
                     FROM public.ubs_funcionamento WHERE unidade_id = p_unidade), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.ubs_funcionamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubs_funcionamento(uuid) TO authenticated;

-- p_horarios: [{"dia": 1, "abre": "07:00", "fecha": "19:00"}, ...]; troca o
-- horário inteiro. Lista vazia tira a trava.
CREATE OR REPLACE FUNCTION public.ubs_definir_funcionamento(p_unidade uuid, p_horarios jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  h jsonb;
  v_eu uuid := private.meu_perfil_id();
  v_quem text;
  v_n int;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  PERFORM private.agenda_exigir_ubs(p_unidade);
  PERFORM private.agenda_exigir_gestor(p_unidade);
  IF jsonb_typeof(coalesce(p_horarios, '[]')) <> 'array' THEN RAISE EXCEPTION 'Horários em lista.'; END IF;

  DELETE FROM public.ubs_funcionamento WHERE unidade_id = p_unidade;
  FOR h IN SELECT * FROM jsonb_array_elements(coalesce(p_horarios, '[]')) LOOP
    IF NOT (h ? 'dia' AND h ? 'abre' AND h ? 'fecha') THEN RAISE EXCEPTION 'Cada dia tem abre e fecha.'; END IF;
    IF (h ->> 'fecha')::time <= (h ->> 'abre')::time THEN
      RAISE EXCEPTION 'O fechamento vem depois da abertura (dia %).', h ->> 'dia';
    END IF;
    INSERT INTO public.ubs_funcionamento (unidade_id, dia_semana, abre, fecha, atualizado_por)
    VALUES (p_unidade, (h ->> 'dia')::smallint, (h ->> 'abre')::time, (h ->> 'fecha')::time, v_eu);
  END LOOP;

  -- o horário novo não deixa de fora o que já está combinado
  SELECT p.nome_completo INTO v_quem
    FROM public.agenda_configuracoes c JOIN public.perfis p ON p.id = c.perfil_id
   WHERE c.unidade_id = p_unidade
     AND NOT private.ubs_dentro_do_funcionamento(p_unidade, date '2000-01-02' + c.dia_semana + c.hora_inicio,
                                                 date '2000-01-02' + c.dia_semana + c.hora_fim)
   LIMIT 1;
  IF v_quem IS NOT NULL THEN
    RAISE EXCEPTION 'A grade da agenda de % tem período fora deste horário: ajuste a grade antes.', v_quem;
  END IF;
  SELECT count(*) INTO v_n
    FROM public.escala_plantao e
   WHERE e.unidade_id = p_unidade AND e.ativo AND e.data >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
     AND NOT private.ubs_dentro_do_funcionamento(p_unidade, e.inicio AT TIME ZONE 'America/Sao_Paulo',
                                                 (e.inicio + make_interval(mins => e.duracao_min)) AT TIME ZONE 'America/Sao_Paulo');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'A escala tem % plantões de hoje em diante fora deste horário: tire-os da escala antes.', v_n;
  END IF;

  PERFORM private.registrar_auditoria('ubs_funcionamento_definido', 'ubs_funcionamento', p_unidade, p_unidade,
    jsonb_build_object('horarios', coalesce(p_horarios, '[]')));
END $$;
REVOKE ALL ON FUNCTION public.ubs_definir_funcionamento(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubs_definir_funcionamento(uuid, jsonb) TO authenticated;

-- ── 3. travas na escala e na grade da agenda ────────────────────────────────
-- (o gatilho da janela, trg_escala_janela, roda antes: calcula início e duração)
CREATE OR REPLACE FUNCTION private.escala_ubs_funcionamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.ativo AND NOT private.ubs_dentro_do_funcionamento(NEW.unidade_id, NEW.inicio AT TIME ZONE 'America/Sao_Paulo',
                         (NEW.inicio + make_interval(mins => NEW.duracao_min)) AT TIME ZONE 'America/Sao_Paulo') THEN
    RAISE EXCEPTION 'Plantão fora do horário de funcionamento da UBS (% de %).', NEW.turno, to_char(NEW.data, 'DD/MM');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.escala_ubs_funcionamento() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_escala_ubs_funcionamento ON public.escala_plantao;
CREATE TRIGGER trg_escala_ubs_funcionamento
  BEFORE INSERT OR UPDATE OF data, turno, duracao_min, inicio, ativo, unidade_id ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION private.escala_ubs_funcionamento();

CREATE OR REPLACE FUNCTION private.agenda_ubs_funcionamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- 02/01/2000 foi domingo: a data só carrega o dia da semana
  IF NOT private.ubs_dentro_do_funcionamento(NEW.unidade_id, date '2000-01-02' + NEW.dia_semana + NEW.hora_inicio,
                                             date '2000-01-02' + NEW.dia_semana + NEW.hora_fim) THEN
    RAISE EXCEPTION 'Período da agenda fora do horário de funcionamento da UBS (%, % a %).',
      (ARRAY['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'])[NEW.dia_semana + 1],
      to_char(NEW.hora_inicio, 'HH24:MI'), to_char(NEW.hora_fim, 'HH24:MI');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.agenda_ubs_funcionamento() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_agenda_ubs_funcionamento ON public.agenda_configuracoes;
CREATE TRIGGER trg_agenda_ubs_funcionamento
  BEFORE INSERT OR UPDATE ON public.agenda_configuracoes
  FOR EACH ROW EXECUTE FUNCTION private.agenda_ubs_funcionamento();

-- ── 4. vencimento da ficha pelo fechamento ──────────────────────────────────
CREATE OR REPLACE FUNCTION private.ubs_vencer_fichas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r record;
  n int := 0;
  v_agora timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
  v_hoje timestamptz := date_trunc('day', v_agora) AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  FOR r IN
    UPDATE public.episodios e
       SET etapa = 'encerrado',
           desfecho = 'evasao',
           desfecho_motivo = 'Não aguardou: a ficha venceu no fim do expediente sem atendimento (encerrada pelo sistema).',
           desfecho_detalhes = jsonb_build_object('vencida', true, 'etapa_anterior', e.etapa),
           desfecho_em = now(),
           encerrado_em = now(),
           reavaliar_em = NULL,
           updated_at = now()
     WHERE e.tipo_atendimento_aps IS NOT NULL
       AND e.etapa IN ('triagem', 'atendimento')
       AND e.atendimento_iniciado_em IS NULL
       AND (e.chegada_em < v_hoje
            -- U3: uma hora depois do fechamento de hoje, se a UBS tem horário
            OR EXISTS (SELECT 1 FROM public.ubs_funcionamento f
                        WHERE f.unidade_id = e.unidade_id AND f.dia_semana = extract(dow FROM v_agora)
                          AND f.fecha < time '23:00'  -- fecha + 1 h não vira o dia
                          AND v_agora::time >= f.fecha + interval '1 hour'))
    RETURNING e.id, e.unidade_id, e.chegada_em, (e.desfecho_detalhes ->> 'etapa_anterior') AS etapa_anterior
  LOOP
    n := n + 1;
    DELETE FROM public.atendimento_rascunhos WHERE episodio_id = r.id;
    PERFORM private.registrar_auditoria('ficha_vencida', 'episodios', r.id, r.unidade_id,
      jsonb_build_object('chegada_em', r.chegada_em, 'etapa_anterior', r.etapa_anterior,
                         'motivo', 'U1/U3: ficha da UBS sem atendimento venceu no fim do expediente'));
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.ubs_vencer_fichas() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ubs-ficha-vence';
  PERFORM cron.schedule('ubs-ficha-vence', '*/30 * * * *', 'SELECT private.ubs_vencer_fichas();');
END $$;
