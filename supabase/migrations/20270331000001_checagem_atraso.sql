-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 9 do Portão de 11/10/2026: "atrasado" registrado na checagem.
-- Diagnóstico e decisão do RT (10/11/2026, A em A1 a A9):
--   docs/porta/LACUNA-09-ATRASADO-CHECAGEM-DIAGNOSTICO.md
--
-- Fontes (texto conferido em 10/11/2026):
--   - Portaria MS nº 2.095/2013, Anexo 03 (protocolo de segurança na
--     prescrição, uso e administração de medicamentos):
--       item IV, "hora certa": antecipar ou atrasar a dose só com o
--         consentimento do enfermeiro e do prescritor;
--       item VI, "registro certo": registrar o horário da administração e as
--         ocorrências (adiamento, cancelamento, desabastecimento, recusa);
--       item 7.2: a omissão de dose é registrada e comunicada ao enfermeiro;
--       item 7.3.1: indicador "taxa de erro de omissão".
--     O protocolo não fixa tolerância em minutos.
--   - Resolução COFEN nº 514/2016 (guia de registros), item 9.3: o
--     medicamento não administrado leva o motivo.
--   - Regra da unidade (RT, 30/09/2026): 2 h de tolerância numa janela de 12 h.
--
-- O que faz:
--   A1  private.janela_atraso(horarios): 2 h, ou o menor intervalo entre os
--       horários do item quando for menor (o 1/1h tem 1 h, para a dose não
--       engolir a seguinte). A mesma regra no painel da enfermagem
--       (private.aprazamentos_atrasados), no painel da porta
--       (private.doses_do_item: "atrasada" só depois da janela; antes,
--       "pendente") e na checagem. A trava da alta após medicação não muda:
--       ela conta toda dose com horário já passado sem feito ou "não feito"
--       (previsto_em <= agora), atrasada ou pendente.
--   A2  administracoes ganha previsto_em, atraso_min, atrasada, motivo_atraso,
--       motivo_atraso_texto e setor_id, gravados pelo servidor no gatilho de
--       inserção (o valor que vier de fora é ignorado). previsto_em é o
--       horário aprazado do dia a que a checagem se refere (a mesma conta de
--       private.doses_do_item: de 2 h antes a 22 h depois). atraso_min vale
--       para feito, não feito e recusado e conta do horário previsto, ou da
--       prescrição quando o horário é anterior a ela (não há atraso de dose
--       que ainda não estava prescrita). atrasada só no "feito" que passou da
--       janela. A situação continua "feito".
--   A3  checar pede p_motivo_atraso (lista fechada) no "feito" atrasado;
--       "outro" pede p_motivo_atraso_texto com 5 letras ou mais. Fora do
--       atraso, o motivo é ignorado (não se grava).
--       Assinatura: checar(uuid, text, text, text) vira
--       checar(uuid, text, text, text, text, text), os dois novos com DEFAULT
--       NULL. A antiga sai na mesma migration (DROP e CREATE pelo texto atual,
--       como as colunas novas de 20270327000001): duas versões com defaults
--       deixariam o PostgREST sem saber qual chamar (PGRST203). Quem chama
--       com 2 a 4 argumentos (a tela em cache, os testes, os scripts) cai na
--       nova; na dose sem atraso nada muda. Os privilégios voltam como
--       estavam (authenticated e service_role).
--   A4  public.omissoes_dose: o horário que passa de 12 h sem nenhuma
--       checagem vira registro (só inserção, um por item e horário), gravado
--       pelo job; avisa o enfermeiro e o médico de plantão do setor.
--   A5  public.doses_atrasadas: cada dose que passou da janela (sem checagem,
--       pelo job; ou feita com atraso, pelo gatilho da checagem), uma por
--       item e horário; avisa o enfermeiro do setor uma vez. A ciência do
--       enfermeiro (public.dar_ciencia_atraso) grava quem e quando, uma vez
--       só (gatilho de guarda). O médico só recebe aviso de omissão.
--   A6  fila_checagem leva, por horário, previsto_em, atraso_min, atrasada e o
--       motivo; public.atrasos_de_dose(itens) lista as doses atrasadas das
--       últimas 24 h com a ciência; public.indicador_atraso_checagem (gestor,
--       segundo fator): taxa de doses atrasadas (feitas com atraso / feitas)
--       e taxa de omissão (omissões / doses previstas), por mês e por setor
--       (Anexo 03, item 7.3.1), só medicamento.
--   A7  job "checagem-atraso" a cada 15 min: aviso de dose atrasada e
--       registro de omissão. Olha 36 h para trás (a transição não acorda
--       dose antiga).
--   A8  item vencido continua só com "não feito" (a recusa do "feito" vem
--       antes do atraso); dupla checagem continua valendo 2 h; a dose
--       atrasada não muda os horários seguintes (nada aqui toca o
--       aprazamento).
--   A9  fora de tudo isso (private.item_conta_atraso): "Agora", "Se
--       necessário", contenção, item sem horário e infusão (posologia com
--       "contínuo/contínua", "bomba" ou "BIC", ou medicamento vasoativo do
--       catálogo).
--
-- Funções trocadas trecho a trecho pelo texto atual (pg_get_functiondef),
-- como em 20270327000001: trecho que sumiu para a migration com erro; trecho
-- já trocado é pulado (reaplicável); corpo CRLF continua CRLF. Conferido na
-- homologação em 10/11/2026: checar, doses_do_item, aprazamentos_atrasados,
-- fila_checagem.
--
-- Só expande: colunas, tabelas, funções, gatilhos e job novos; quatro funções
-- com o corpo trocado (checar com dois argumentos opcionais a mais).
-- Teste: supabase/tests/checagem_atraso.sql
--
-- Rollback (testado na homologação, em transação desfeita; o md5 das funções
-- trocadas volta ao de antes): o bloco comentado no fim deste arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── A2: o atraso gravado na checagem ────────────────────────────────────────
ALTER TABLE public.administracoes ADD COLUMN IF NOT EXISTS previsto_em timestamptz;
ALTER TABLE public.administracoes ADD COLUMN IF NOT EXISTS atraso_min integer;
ALTER TABLE public.administracoes ADD COLUMN IF NOT EXISTS atrasada boolean NOT NULL DEFAULT false;
ALTER TABLE public.administracoes ADD COLUMN IF NOT EXISTS motivo_atraso text;
ALTER TABLE public.administracoes ADD COLUMN IF NOT EXISTS motivo_atraso_texto text;
ALTER TABLE public.administracoes ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.administracoes DROP CONSTRAINT IF EXISTS administracoes_motivo_atraso_check;
ALTER TABLE public.administracoes ADD CONSTRAINT administracoes_motivo_atraso_check
  CHECK (motivo_atraso IS NULL OR motivo_atraso IN ('fora_do_setor_exame', 'falta_medicamento', 'sem_acesso_venoso',
                                                    'jejum_procedimento', 'aguardando_farmacia', 'intercorrencia', 'outro')) NOT VALID;
ALTER TABLE public.administracoes VALIDATE CONSTRAINT administracoes_motivo_atraso_check;
COMMENT ON COLUMN public.administracoes.previsto_em IS
  'Horário aprazado (dia e hora, Brasília) a que a checagem se refere. Do servidor (lacuna 9).';
COMMENT ON COLUMN public.administracoes.atraso_min IS
  'Minutos do horário previsto (ou da prescrição, se o horário é anterior a ela) até o registro. Do servidor.';
COMMENT ON COLUMN public.administracoes.atrasada IS
  '"Feito" depois da janela de tolerância (2 h, ou o intervalo do item se menor). Do servidor (Portaria MS 2.095/2013, Anexo 03, item IV).';
COMMENT ON COLUMN public.administracoes.motivo_atraso IS
  'Motivo do atraso (lista fechada), obrigatório no "feito" atrasado.';
COMMENT ON COLUMN public.administracoes.setor_id IS
  'Setor do paciente na hora da checagem (indicador por setor). Do servidor.';
CREATE INDEX IF NOT EXISTS administracoes_setor_id_fk_idx ON public.administracoes (setor_id);
CREATE INDEX IF NOT EXISTS administracoes_previsto ON public.administracoes (unidade_id, previsto_em) WHERE previsto_em IS NOT NULL;

-- ── A9: o que entra na regra do atraso ──────────────────────────────────────
CREATE OR REPLACE FUNCTION private.item_conta_atraso(p_item public.prescricao_itens)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_item.id IS NOT NULL
     AND p_item.tipo <> 'contencao'
     AND NOT coalesce(p_item.se_necessario, false)
     AND cardinality(coalesce(p_item.horarios, '{}'::text[])) > 0
     AND NOT private.item_e_agora(p_item.posologia)
     -- infusão: contínuo/contínua, bomba de infusão ou BIC na posologia, ou vasoativo do catálogo
     AND translate(lower(coalesce(p_item.posologia, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc') !~ '(continu|bomba|\mbic\M)'
     AND NOT coalesce((SELECT m.vasoativo FROM public.medicamento m WHERE m.id = p_item.medicamento_id), false)
$$;
REVOKE ALL ON FUNCTION private.item_conta_atraso(public.prescricao_itens) FROM PUBLIC, anon, authenticated;

-- ── A1: a janela de tolerância ──────────────────────────────────────────────
-- 2 h, ou o menor intervalo entre dois horários do item (dando a volta no dia).
CREATE OR REPLACE FUNCTION private.janela_atraso(p_horarios text[])
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH h AS (
    SELECT DISTINCT split_part(x, ':', 1)::int * 60 + split_part(x, ':', 2)::int AS m
      FROM unnest(coalesce(p_horarios, '{}'::text[])) x
     WHERE x ~ '^([01]\d|2[0-3]):[0-5]\d$'
  ), g AS (
    SELECT coalesce(lead(m) OVER (ORDER BY m), min(m) OVER () + 1440) - m AS intervalo FROM h
  )
  SELECT make_interval(mins => least(120, coalesce((SELECT min(intervalo) FROM g), 1440)))
$$;
REVOKE ALL ON FUNCTION private.janela_atraso(text[]) FROM PUBLIC, anon, authenticated;

-- O horário aprazado (dia e hora) a que uma checagem feita em p_em se refere:
-- a checagem vale de 2 h antes a 22 h depois do horário (private.doses_do_item).
CREATE OR REPLACE FUNCTION private.horario_previsto(p_horario text, p_em timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_horario ~ '^([01]\d|2[0-3]):[0-5]\d$' AND p_em IS NOT NULL THEN
    (SELECT x.s FROM (
       SELECT (((p_em AT TIME ZONE 'America/Sao_Paulo')::date + k) + p_horario::time) AT TIME ZONE 'America/Sao_Paulo' AS s
         FROM generate_series(-1, 1) k) x
      WHERE p_em >= x.s - interval '2 hours' AND p_em < x.s + interval '22 hours'
      ORDER BY x.s LIMIT 1)
  END
$$;
REVOKE ALL ON FUNCTION private.horario_previsto(text, timestamptz) FROM PUBLIC, anon, authenticated;

-- De onde o atraso conta: o horário previsto, ou a prescrição do item quando o
-- horário é anterior a ela.
CREATE OR REPLACE FUNCTION private.referencia_atraso(p_previsto timestamptz, p_prescrito timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT greatest(p_previsto, date_trunc('minute', p_prescrito))
$$;
REVOKE ALL ON FUNCTION private.referencia_atraso(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- "3 h 10 min", "45 min"
CREATE OR REPLACE FUNCTION private.duracao_texto(p interval)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN m >= 60 THEN (m / 60) || ' h' || CASE WHEN m % 60 > 0 THEN ' ' || (m % 60) || ' min' ELSE '' END
              ELSE m || ' min' END
    FROM (SELECT greatest(0, floor(extract(epoch FROM p) / 60))::int AS m) x
$$;
REVOKE ALL ON FUNCTION private.duracao_texto(interval) FROM PUBLIC, anon, authenticated;

-- ── A3: a lista de motivos ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.motivo_atraso_rotulo(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p
    WHEN 'fora_do_setor_exame' THEN 'paciente fora do setor ou em exame'
    WHEN 'falta_medicamento' THEN 'falta do medicamento'
    WHEN 'sem_acesso_venoso' THEN 'sem acesso venoso'
    WHEN 'jejum_procedimento' THEN 'jejum ou procedimento'
    WHEN 'aguardando_farmacia' THEN 'aguardando a farmácia'
    WHEN 'intercorrencia' THEN 'intercorrência'
    WHEN 'outro' THEN 'outro'
  END
$$;
REVOKE ALL ON FUNCTION private.motivo_atraso_rotulo(text) FROM PUBLIC, anon, authenticated;

-- ── A2: o servidor calcula o atraso de toda checagem ────────────────────────
CREATE OR REPLACE FUNCTION private.administracao_atraso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes;
BEGIN
  NEW.previsto_em := NULL; NEW.atraso_min := NULL; NEW.atrasada := false;
  SELECT * INTO it FROM public.prescricao_itens WHERE id = NEW.item_id;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  NEW.setor_id := CASE WHEN pr.id IS NOT NULL THEN private.prescricao_setor(pr) END;
  IF NEW.horario_previsto ~ '^([01]\d|2[0-3]):[0-5]\d$' AND NOT coalesce(it.se_necessario, false)
     AND cardinality(coalesce(it.horarios, '{}'::text[])) > 0 THEN
    NEW.previsto_em := private.horario_previsto(NEW.horario_previsto, NEW.registrado_em);
    NEW.atraso_min := floor(extract(epoch FROM NEW.registrado_em - private.referencia_atraso(NEW.previsto_em, it.created_at)) / 60)::int;
    NEW.atrasada := NEW.situacao = 'feito' AND private.item_conta_atraso(it)
      AND NEW.registrado_em - private.referencia_atraso(NEW.previsto_em, it.created_at) > private.janela_atraso(it.horarios);
  END IF;
  IF NOT NEW.atrasada THEN
    NEW.motivo_atraso := NULL;
    NEW.motivo_atraso_texto := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.administracao_atraso() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_administracao_atraso ON public.administracoes;
CREATE TRIGGER trg_administracao_atraso BEFORE INSERT ON public.administracoes
  FOR EACH ROW EXECUTE FUNCTION private.administracao_atraso();

-- ── A5: doses atrasadas e a ciência do enfermeiro ───────────────────────────
CREATE TABLE IF NOT EXISTS public.doses_atrasadas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES public.prescricao_itens(id),
  paciente_id  uuid NOT NULL REFERENCES public.pacientes(id),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  setor_id     uuid REFERENCES public.setores(id),
  horario      text NOT NULL,
  previsto_em  timestamptz NOT NULL,
  detectada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  origem       text NOT NULL CHECK (origem IN ('janela', 'checagem')),
  ciente_por   uuid REFERENCES public.perfis(id),
  ciente_em    timestamptz,
  UNIQUE (item_id, previsto_em)
);
COMMENT ON TABLE public.doses_atrasadas IS
  'Dose aprazada que passou da janela (lacuna 9): sem checagem (origem janela, pelo job) ou feita com atraso (origem checagem). Ciência do enfermeiro uma vez (Portaria MS 2.095/2013, Anexo 03, item IV). Escrita só pelo servidor.';
CREATE INDEX IF NOT EXISTS doses_atrasadas_paciente_id_fk_idx ON public.doses_atrasadas (paciente_id);
CREATE INDEX IF NOT EXISTS doses_atrasadas_unidade_previsto ON public.doses_atrasadas (unidade_id, previsto_em);
CREATE INDEX IF NOT EXISTS doses_atrasadas_setor_id_fk_idx ON public.doses_atrasadas (setor_id);
CREATE INDEX IF NOT EXISTS doses_atrasadas_ciente_por_fk_idx ON public.doses_atrasadas (ciente_por);

-- Só a ciência muda, e uma vez; nada se apaga.
CREATE OR REPLACE FUNCTION private.dose_atrasada_guarda()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Dose atrasada não se apaga.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.ciente_em IS NOT NULL OR NEW.ciente_em IS NULL OR NEW.ciente_por IS NULL
     OR (NEW.id, NEW.item_id, NEW.paciente_id, NEW.unidade_id, NEW.setor_id, NEW.horario, NEW.previsto_em, NEW.detectada_em, NEW.origem)
        IS DISTINCT FROM (OLD.id, OLD.item_id, OLD.paciente_id, OLD.unidade_id, OLD.setor_id, OLD.horario, OLD.previsto_em, OLD.detectada_em, OLD.origem) THEN
    RAISE EXCEPTION 'Dose atrasada: só se registra a ciência, uma vez.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.dose_atrasada_guarda() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_dose_atrasada_guarda ON public.doses_atrasadas;
CREATE TRIGGER trg_dose_atrasada_guarda BEFORE UPDATE OR DELETE ON public.doses_atrasadas
  FOR EACH ROW EXECUTE FUNCTION private.dose_atrasada_guarda();

ALTER TABLE public.doses_atrasadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doses_atrasadas_select ON public.doses_atrasadas;
CREATE POLICY doses_atrasadas_select ON public.doses_atrasadas FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS doses_atrasadas_segundo_fator ON public.doses_atrasadas;
CREATE POLICY doses_atrasadas_segundo_fator ON public.doses_atrasadas AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok());
REVOKE ALL ON public.doses_atrasadas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.doses_atrasadas TO authenticated;

-- ── A4: omissão de dose (só inserção) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.omissoes_dose (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES public.prescricao_itens(id),
  paciente_id  uuid NOT NULL REFERENCES public.pacientes(id),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  setor_id     uuid REFERENCES public.setores(id),
  horario      text NOT NULL,
  previsto_em  timestamptz NOT NULL,
  detectada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (item_id, previsto_em)
);
COMMENT ON TABLE public.omissoes_dose IS
  'Horário aprazado que passou de 12 h sem nenhuma checagem (lacuna 9; Portaria MS 2.095/2013, Anexo 03, itens 7.2 e 7.3.1). Só inserção, pelo job.';
CREATE INDEX IF NOT EXISTS omissoes_dose_paciente_id_fk_idx ON public.omissoes_dose (paciente_id);
CREATE INDEX IF NOT EXISTS omissoes_dose_unidade_previsto ON public.omissoes_dose (unidade_id, previsto_em);
CREATE INDEX IF NOT EXISTS omissoes_dose_setor_id_fk_idx ON public.omissoes_dose (setor_id);
DROP TRIGGER IF EXISTS trg_omissoes_dose_so_insercao ON public.omissoes_dose;
CREATE TRIGGER trg_omissoes_dose_so_insercao BEFORE UPDATE OR DELETE ON public.omissoes_dose
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.omissoes_dose ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS omissoes_dose_select ON public.omissoes_dose;
CREATE POLICY omissoes_dose_select ON public.omissoes_dose FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS omissoes_dose_segundo_fator ON public.omissoes_dose;
CREATE POLICY omissoes_dose_segundo_fator ON public.omissoes_dose AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok());
REVOKE ALL ON public.omissoes_dose FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.omissoes_dose TO authenticated;

-- ── avisos ──────────────────────────────────────────────────────────────────
-- Os destinatários da contenção (lacuna 4): os escalados agora no setor; sem
-- ninguém no setor, os da unidade. Um aviso por registro e por pessoa (a chave
-- leva o id do registro; o NOT EXISTS segura a repetição no dia seguinte).
CREATE OR REPLACE FUNCTION private.avisar_dose_atrasada(p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.doses_atrasadas; f record; v_tipo text := 'dose_atrasada_' || p_id; v_msg text; k integer;
BEGIN
  SELECT * INTO d FROM public.doses_atrasadas WHERE id = p_id;
  IF d.id IS NULL THEN RETURN 0; END IF;
  SELECT a.registrado_em, a.motivo_atraso INTO f FROM public.administracoes a
   WHERE a.item_id = d.item_id AND a.previsto_em = d.previsto_em AND a.situacao = 'feito'
   ORDER BY a.registrado_em LIMIT 1;
  v_msg := 'Dose atrasada: ' || coalesce(private.validade_item_rotulo(d.item_id), 'item da prescrição') || ', horário das ' || d.horario
    || CASE WHEN f.registrado_em IS NOT NULL
            THEN ', feita às ' || to_char(f.registrado_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
                 || coalesce(' (motivo: ' || private.motivo_atraso_rotulo(f.motivo_atraso) || ')', '')
            ELSE ', sem checagem depois da tolerância' END
    || '. Dê ciência na Checagem (Portaria MS 2.095/2013, Anexo 03, item IV).';
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT x, d.unidade_id, private.data_atual(), v_tipo, v_msg
    FROM private.contencao_destinatarios(d.unidade_id, d.setor_id, 'enfermeiro') x
   WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.perfil_id = x AND n.unidade_id = d.unidade_id AND n.tipo = v_tipo)
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $$;
REVOKE ALL ON FUNCTION private.avisar_dose_atrasada(uuid) FROM PUBLIC, anon, authenticated;

-- Omissão: o enfermeiro (item 7.2) e o médico de plantão do setor.
CREATE OR REPLACE FUNCTION private.avisar_omissao_dose(p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.omissoes_dose; v_tipo text := 'dose_omitida_' || p_id; v_msg text; k integer;
BEGIN
  SELECT * INTO o FROM public.omissoes_dose WHERE id = p_id;
  IF o.id IS NULL THEN RETURN 0; END IF;
  v_msg := 'Dose omitida: ' || coalesce(private.validade_item_rotulo(o.item_id), 'item da prescrição') || ', horário das ' || o.horario
    || ' de ' || to_char(o.previsto_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')
    || ' passou de 12 h sem checagem (Portaria MS 2.095/2013, Anexo 03, item 7.2).';
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT x, o.unidade_id, private.data_atual(), v_tipo, v_msg
    FROM (SELECT y FROM private.contencao_destinatarios(o.unidade_id, o.setor_id, 'enfermeiro') y
          UNION
          SELECT z FROM private.contencao_destinatarios(o.unidade_id, o.setor_id, 'plantonista') z) dest(x)
   WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.perfil_id = dest.x AND n.unidade_id = o.unidade_id AND n.tipo = v_tipo)
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $$;
REVOKE ALL ON FUNCTION private.avisar_omissao_dose(uuid) FROM PUBLIC, anon, authenticated;

-- Registra a dose atrasada (uma por item e horário) e avisa; devolve o id só
-- quando o registro é novo.
CREATE OR REPLACE FUNCTION private.registrar_dose_atrasada(p_item uuid, p_horario text, p_previsto timestamptz, p_origem text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pr public.prescricoes; v_id uuid;
BEGIN
  SELECT p.* INTO pr FROM public.prescricoes p JOIN public.prescricao_itens i ON i.prescricao_id = p.id WHERE i.id = p_item;
  IF pr.id IS NULL OR p_previsto IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.doses_atrasadas (item_id, paciente_id, unidade_id, setor_id, horario, previsto_em, origem)
  VALUES (p_item, pr.paciente_id, pr.unidade_id, private.prescricao_setor(pr), p_horario, p_previsto, p_origem)
  ON CONFLICT (item_id, previsto_em) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN PERFORM private.avisar_dose_atrasada(v_id); END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.registrar_dose_atrasada(uuid, text, timestamptz, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.registrar_omissao_dose(p_item uuid, p_horario text, p_previsto timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pr public.prescricoes; v_id uuid;
BEGIN
  SELECT p.* INTO pr FROM public.prescricoes p JOIN public.prescricao_itens i ON i.prescricao_id = p.id WHERE i.id = p_item;
  IF pr.id IS NULL OR p_previsto IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.omissoes_dose (item_id, paciente_id, unidade_id, setor_id, horario, previsto_em)
  VALUES (p_item, pr.paciente_id, pr.unidade_id, private.prescricao_setor(pr), p_horario, p_previsto)
  ON CONFLICT (item_id, previsto_em) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN PERFORM private.avisar_omissao_dose(v_id); END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.registrar_omissao_dose(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;

-- Depois da checagem: o "feito" atrasado vira dose atrasada (com aviso) e
-- entra na auditoria, sem dado de pessoa.
CREATE OR REPLACE FUNCTION private.administracao_atraso_registrar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.atrasada THEN
    PERFORM private.registrar_dose_atrasada(NEW.item_id, NEW.horario_previsto, NEW.previsto_em, 'checagem');
    PERFORM private.registrar_auditoria('dose_atrasada_registrada', 'administracoes', NEW.id, NEW.unidade_id,
      jsonb_build_object('situacao', NEW.situacao, 'horario', NEW.horario_previsto, 'motivo_codigo', NEW.motivo_atraso,
                         'quantidade', NEW.atraso_min));
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.administracao_atraso_registrar() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_administracao_atraso_registrar ON public.administracoes;
CREATE TRIGGER trg_administracao_atraso_registrar AFTER INSERT ON public.administracoes
  FOR EACH ROW EXECUTE FUNCTION private.administracao_atraso_registrar();

-- ── A7: o job (a cada 15 min) ───────────────────────────────────────────────
-- Dose aprazada que passou da janela sem checagem: até 12 h, dose atrasada
-- (aviso ao enfermeiro); depois de 12 h, omissão (aviso ao enfermeiro e ao
-- médico). Olha 36 h para trás. Na renovação (lacuna 6), a checagem do mesmo
-- horário na versão seguinte do item vale para a anterior.
CREATE OR REPLACE FUNCTION private.checagem_atraso_job()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; n integer := 0; v_id uuid;
BEGIN
  FOR r IN
    SELECT i.id AS item_id, d.horario, d.previsto_em
      FROM public.prescricao_itens i
      JOIN public.prescricoes pr ON pr.id = i.prescricao_id
      CROSS JOIN LATERAL private.doses_do_item(i.id) d
     WHERE private.item_conta_atraso(i)
       AND (pr.status = 'ativa' OR pr.encerrada_em > now() - interval '36 hours')
       AND (i.suspenso_em IS NULL OR i.suspenso_em > now() - interval '36 hours')
       AND (i.valida_ate IS NULL OR i.valida_ate > now() - interval '36 hours')
       AND d.situacao = 'atrasada' AND d.previsto_em > now() - interval '36 hours'
       AND NOT EXISTS (SELECT 1 FROM public.prescricao_itens nv JOIN public.administracoes a ON a.item_id = nv.id
                        WHERE nv.substitui_item_id = i.id AND a.horario_previsto = d.horario
                          AND a.registrado_em >= d.previsto_em - interval '2 hours'
                          AND a.registrado_em < d.previsto_em + interval '22 hours')
     ORDER BY d.previsto_em
  LOOP
    IF r.previsto_em <= now() - interval '12 hours' THEN
      v_id := private.registrar_omissao_dose(r.item_id, r.horario, r.previsto_em);
    ELSE
      v_id := private.registrar_dose_atrasada(r.item_id, r.horario, r.previsto_em, 'janela');
    END IF;
    IF v_id IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.checagem_atraso_job() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'checagem-atraso';
SELECT cron.schedule('checagem-atraso', '*/15 * * * *', 'SELECT private.checagem_atraso_job();');

-- ── A5: a ciência do enfermeiro ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dar_ciencia_atraso(p_dose_atrasada uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.doses_atrasadas; v_ja boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.doses_atrasadas WHERE id = p_dose_atrasada FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Dose atrasada não encontrada.'; END IF;
  IF private.tenho_papel(d.unidade_id, 'enfermeiro') IS NOT TRUE OR NOT coalesce(private.paciente_no_meu_plantao(d.paciente_id), false) THEN
    RAISE EXCEPTION 'A ciência da dose atrasada é do enfermeiro de plantão com o paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_ja := d.ciente_em IS NOT NULL;
  IF NOT v_ja THEN
    UPDATE public.doses_atrasadas SET ciente_por = private.meu_perfil_id(), ciente_em = now() WHERE id = d.id
    RETURNING * INTO d;
    PERFORM private.registrar_auditoria('ciencia_dose_atrasada', 'doses_atrasadas', d.id, d.unidade_id,
      jsonb_build_object('tipo', d.origem, 'horario', d.horario));
  END IF;
  RETURN jsonb_build_object('id', d.id, 'ciente_em', d.ciente_em,
    'ciente_por', (SELECT nome_completo FROM public.perfis WHERE id = d.ciente_por), 'ja_estava', v_ja);
END $$;
REVOKE ALL ON FUNCTION public.dar_ciencia_atraso(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dar_ciencia_atraso(uuid) TO authenticated;

-- ── A6: as doses atrasadas dos itens da checagem (últimas 24 h) ─────────────
-- O mesmo acesso de fila_checagem: enfermagem com o paciente no plantão.
CREATE OR REPLACE FUNCTION public.atrasos_de_dose(p_itens uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'item_id', d.item_id, 'horario', d.horario, 'previsto_em', d.previsto_em,
           'detectada_em', d.detectada_em, 'origem', d.origem, 'ciente_em', d.ciente_em, 'ciente_por', pc.nome_completo,
           'feito_em', f.registrado_em, 'atraso_min', f.atraso_min, 'motivo_atraso', f.motivo_atraso,
           'motivo_atraso_texto', f.motivo_atraso_texto,
           'omitida', EXISTS (SELECT 1 FROM public.omissoes_dose o WHERE o.item_id = d.item_id AND o.previsto_em = d.previsto_em))
           ORDER BY d.previsto_em), '[]'::jsonb)
    FROM public.doses_atrasadas d
    LEFT JOIN public.perfis pc ON pc.id = d.ciente_por
    LEFT JOIN LATERAL (SELECT a.registrado_em, a.atraso_min, a.motivo_atraso, a.motivo_atraso_texto FROM public.administracoes a
                        WHERE a.item_id = d.item_id AND a.previsto_em = d.previsto_em AND a.situacao = 'feito'
                        ORDER BY a.registrado_em LIMIT 1) f ON true
   WHERE d.item_id = ANY (p_itens) AND d.previsto_em > now() - interval '24 hours'
     AND private.segundo_fator_ok() AND private.sou_enfermagem(d.unidade_id) AND private.paciente_em_cuidado_no_plantao(d.paciente_id)
$$;
REVOKE ALL ON FUNCTION public.atrasos_de_dose(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atrasos_de_dose(uuid[]) TO authenticated;

-- ── A6: indicador do gestor (Anexo 03, item 7.3.1) ──────────────────────────
-- Dose prevista: horário aprazado de medicamento (regra do atraso, A9) com
-- alguma checagem ou com omissão registrada, pelo dia e hora do horário
-- (Brasília, dia do calendário). Conta a partir da publicação desta migration
-- (checagens antigas não têm o horário previsto gravado). Sem dado de pessoa.
CREATE OR REPLACE FUNCTION public.indicador_atraso_checagem(p_unidade uuid, p_de date, p_ate date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_desde timestamptz; v_ate timestamptz; v_res jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.gestor_da_unidade(p_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;
  v_desde := p_de::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ate := (p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  WITH chec AS (
    SELECT a.item_id, a.previsto_em,
           (array_agg(a.setor_id ORDER BY a.registrado_em))[1] AS setor_id,
           bool_or(a.situacao = 'feito') AS feita,
           coalesce((array_agg(a.atrasada ORDER BY a.registrado_em) FILTER (WHERE a.situacao = 'feito'))[1], false) AS atrasada
      FROM public.administracoes a
      JOIN public.prescricao_itens i ON i.id = a.item_id
     WHERE a.unidade_id = p_unidade AND a.previsto_em >= v_desde AND a.previsto_em < v_ate
       AND i.tipo = 'medicamento' AND private.item_conta_atraso(i)
     GROUP BY a.item_id, a.previsto_em
  ), om AS (
    SELECT o.item_id, o.previsto_em, o.setor_id
      FROM public.omissoes_dose o
      JOIN public.prescricao_itens i ON i.id = o.item_id
     WHERE o.unidade_id = p_unidade AND o.previsto_em >= v_desde AND o.previsto_em < v_ate AND i.tipo = 'medicamento'
  ), doses AS (
    SELECT coalesce(c.previsto_em, o.previsto_em) AS previsto_em, coalesce(o.setor_id, c.setor_id) AS setor_id,
           coalesce(c.feita, false) AS feita, coalesce(c.atrasada, false) AS atrasada, o.item_id IS NOT NULL AS omitida
      FROM chec c FULL JOIN om o ON o.item_id = c.item_id AND o.previsto_em = c.previsto_em
  ), linhas AS (
    SELECT to_char(d.previsto_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes, d.setor_id, s.nome AS setor,
           count(*) AS previstas, count(*) FILTER (WHERE d.feita) AS feitas,
           count(*) FILTER (WHERE d.feita AND d.atrasada) AS atrasadas, count(*) FILTER (WHERE d.omitida) AS omissoes
      FROM doses d LEFT JOIN public.setores s ON s.id = d.setor_id
     GROUP BY 1, 2, 3
  )
  SELECT jsonb_build_object(
           'de', p_de, 'ate', p_ate,
           'linhas', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.mes, l.setor NULLS LAST) FROM linhas l), '[]'::jsonb),
           'total', (SELECT jsonb_build_object('previstas', count(*), 'feitas', count(*) FILTER (WHERE d.feita),
                                               'atrasadas', count(*) FILTER (WHERE d.feita AND d.atrasada),
                                               'omissoes', count(*) FILTER (WHERE d.omitida)) FROM doses d))
    INTO v_res;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.indicador_atraso_checagem(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicador_atraso_checagem(uuid, date, date) TO authenticated;

-- ── funções trocadas trecho a trecho ────────────────────────────────────────
-- pula o que já foi trocado; trecho que sumiu (ou aparece mais de uma vez) para com erro.
-- Corpo gravado com quebra de linha CRLF continua CRLF (o rollback volta ao mesmo md5).
-- p_recriar: assinatura nova pede DROP e CREATE (os privilégios voltam logo
-- abaixo, como estavam).
CREATE OR REPLACE FUNCTION pg_temp.trocar_atraso(f regprocedure, trechos text[], p_recriar boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
  v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
  v_nome text := f::text;
BEGIN
  IF f IS NULL THEN RAISE EXCEPTION 'Função a trocar não encontrada.'; END IF;
  FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
    v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
    v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
    IF position(v_novo IN def) > 0 THEN CONTINUE; END IF;
    IF position(v_ant IN def) = 0 THEN
      RAISE EXCEPTION '%: trecho não encontrado: %', f, v_ant;
    END IF;
    IF (length(def) - length(replace(def, v_ant, ''))) / length(v_ant) <> 1 THEN
      RAISE EXCEPTION '%: trecho aparece mais de uma vez: %', f, v_ant;
    END IF;
    def := replace(def, v_ant, v_novo);
    mudou := true;
  END LOOP;
  IF mudou THEN
    IF p_recriar THEN EXECUTE 'DROP FUNCTION ' || v_nome; END IF;
    EXECUTE def;
  END IF;
END $$;

-- checar (A1 a A3, A8): o "feito" atrasado pede o motivo; a hora do registro
-- é a mesma da conta do atraso. Na reaplicação, a versão nova já existe e
-- nada muda.
SELECT pg_temp.trocar_atraso(coalesce(to_regprocedure('public.checar(uuid, text, text, text, text, text)'),
                                      to_regprocedure('public.checar(uuid, text, text, text)')), ARRAY[
  $a$p_motivo text DEFAULT NULL::text)$a$,
  $b$p_motivo text DEFAULT NULL::text, p_motivo_atraso text DEFAULT NULL::text, p_motivo_atraso_texto text DEFAULT NULL::text)$b$,
  $a$DECLARE it public.prescricao_itens; pr public.prescricoes; v_id uuid; v_dupla uuid; v_sem_liberacao boolean := false;
$a$,
  $b$DECLARE it public.prescricao_itens; pr public.prescricoes; v_id uuid; v_dupla uuid; v_sem_liberacao boolean := false;
  v_agora timestamptz := clock_timestamp(); v_previsto timestamptz; v_atrasada boolean := false;
$b$,
  $a$  -- F5 (frequência da porta): "Agora" é dose única; o 2º "feito" é recusado
$a$,
  $b$  -- lacuna 9 (A1 a A3): o "feito" depois da janela (2 h, ou o intervalo do
  -- item se menor) fica "atrasado" e pede o motivo (Portaria MS 2.095/2013,
  -- Anexo 03, itens IV e VI). A situação continua "feito" e os horários
  -- seguintes não mudam. "Agora", "Se necessário", infusão e contenção ficam
  -- fora (private.item_conta_atraso). O vencido já parou acima (A8).
  IF p_situacao = 'feito' AND p_horario IS NOT NULL AND private.item_conta_atraso(it) THEN
    v_previsto := private.referencia_atraso(private.horario_previsto(p_horario, v_agora), it.created_at);
    v_atrasada := v_agora - v_previsto > private.janela_atraso(it.horarios);
  END IF;
  IF v_atrasada THEN
    IF p_motivo_atraso IS NULL OR private.motivo_atraso_rotulo(p_motivo_atraso) IS NULL THEN
      RAISE EXCEPTION 'Dose atrasada: % depois do horário das % (tolerância de %). Escolha o motivo do atraso.',
        private.duracao_texto(v_agora - v_previsto), p_horario, private.duracao_texto(private.janela_atraso(it.horarios))
        USING ERRCODE = 'check_violation';
    END IF;
    IF p_motivo_atraso = 'outro' AND length(btrim(coalesce(p_motivo_atraso_texto, ''))) < 5 THEN
      RAISE EXCEPTION 'Motivo do atraso "outro": descreva o motivo (mínimo de 5 letras).' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  -- F5 (frequência da porta): "Agora" é dose única; o 2º "feito" é recusado
$b$,
  $a$  INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, horario_previsto, situacao, motivo, registrado_por, sem_liberacao)
  VALUES (it.id, pr.paciente_id, pr.unidade_id, p_horario, p_situacao, nullif(btrim(p_motivo), ''), private.meu_perfil_id(), v_sem_liberacao)
$a$,
  $b$  INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, horario_previsto, situacao, motivo, registrado_por, sem_liberacao,
                                      registrado_em, motivo_atraso, motivo_atraso_texto)
  VALUES (it.id, pr.paciente_id, pr.unidade_id, p_horario, p_situacao, nullif(btrim(p_motivo), ''), private.meu_perfil_id(), v_sem_liberacao,
          v_agora, CASE WHEN v_atrasada THEN p_motivo_atraso END, CASE WHEN v_atrasada THEN nullif(btrim(p_motivo_atraso_texto), '') END)
$b$], true);
REVOKE ALL ON FUNCTION public.checar(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checar(uuid, text, text, text, text, text) TO authenticated, service_role;

-- doses_do_item (A1, A9): "atrasada" só depois da janela; item fora da regra
-- fica "pendente" (a trava da alta após medicação segue pelo previsto_em)
SELECT pg_temp.trocar_atraso('private.doses_do_item(uuid)'::regprocedure, ARRAY[
  $a$    SELECT i.id, i.horarios, i.created_at, i.valida_ate,
$a$,
  $b$    SELECT i.id, i.horarios, i.created_at, i.valida_ate,
           -- lacuna 9 (A1, A9): a janela de tolerância; nula fora da regra do atraso
           CASE WHEN private.item_conta_atraso(i) THEN private.janela_atraso(i.horarios) END AS janela,
$b$,
  $a$    SELECT it.id, it.created_at, it.fim, it.valida_ate, h.h,$a$,
  $b$    SELECT it.id, it.created_at, it.fim, it.valida_ate, it.janela, h.h,$b$,
  $a$         coalesce(a.situacao, CASE WHEN s.slot <= now() THEN 'atrasada' ELSE 'pendente' END),$a$,
  $b$         coalesce(a.situacao, CASE WHEN s.slot + s.janela < now() THEN 'atrasada' ELSE 'pendente' END),$b$]);

-- aprazamentos_atrasados (A1, A9): a mesma janela e as mesmas exceções no
-- painel da enfermagem (leitos, pendências e o retrato da passagem)
SELECT pg_temp.trocar_atraso('private.aprazamentos_atrasados(uuid[])'::regprocedure, ARRAY[
  $a$     AND NOT it.se_necessario
$a$,
  $b$     AND NOT it.se_necessario
     -- lacuna 9 (A9): fora "Agora", infusão e contenção
     AND private.item_conta_atraso(it)
$b$,
  $a$     AND s.slot <= now() - interval '2 hours'
$a$,
  $b$     -- lacuna 9 (A1): 2 h, ou o intervalo do item se menor
     AND s.slot + private.janela_atraso(it.horarios) < now()
$b$]);

-- fila_checagem (A6): o atraso de cada horário checado
SELECT pg_temp.trocar_atraso('public.fila_checagem()'::regprocedure, ARRAY[
  $a$jsonb_build_object('situacao', ah.situacao, 'em', ah.registrado_em)$a$,
  $b$jsonb_build_object('situacao', ah.situacao, 'em', ah.registrado_em,
                    -- lacuna 9 (A6): o atraso gravado na checagem
                    'previsto_em', ah.previsto_em, 'atraso_min', ah.atraso_min, 'atrasada', ah.atrasada,
                    'motivo_atraso', ah.motivo_atraso, 'motivo_atraso_texto', ah.motivo_atraso_texto)$b$,
  $a$JOIN LATERAL (SELECT a.situacao, a.registrado_em FROM public.administracoes a$a$,
  $b$JOIN LATERAL (SELECT a.situacao, a.registrado_em, a.previsto_em, a.atraso_min, a.atrasada, a.motivo_atraso,
                                  a.motivo_atraso_texto FROM public.administracoes a$b$]);

DROP FUNCTION pg_temp.trocar_atraso(regprocedure, text[], boolean);

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (rodar inteiro; testado na homologação em transação desfeita):
--
-- CREATE OR REPLACE FUNCTION pg_temp.desfazer_atraso(f regprocedure, trechos text[], p_recriar boolean DEFAULT false)
-- RETURNS void LANGUAGE plpgsql AS $$
-- DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
--   v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
--   v_nome text := f::text;
-- BEGIN
--   FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
--     v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
--     v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
--     IF position(v_novo IN def) > 0 THEN
--       def := replace(def, v_novo, v_ant);
--       mudou := true;
--     END IF;
--   END LOOP;
--   IF mudou THEN
--     IF p_recriar THEN EXECUTE 'DROP FUNCTION ' || v_nome; END IF;
--     EXECUTE def;
--   END IF;
-- END $$;
-- -- as quatro chamadas pg_temp.trocar_atraso acima, iguais, com o nome
-- -- pg_temp.desfazer_atraso (os mesmos pares: ele troca o novo pelo antigo).
-- -- A de checar recebe 'public.checar(uuid, text, text, text, text, text)'::regprocedure
-- -- e true; logo depois:
-- --   REVOKE ALL ON FUNCTION public.checar(uuid, text, text, text) FROM PUBLIC, anon;
-- --   GRANT EXECUTE ON FUNCTION public.checar(uuid, text, text, text) TO authenticated, service_role;
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'checagem-atraso';
-- DROP TRIGGER IF EXISTS trg_administracao_atraso ON public.administracoes;
-- DROP TRIGGER IF EXISTS trg_administracao_atraso_registrar ON public.administracoes;
-- DROP FUNCTION IF EXISTS public.indicador_atraso_checagem(uuid, date, date), public.atrasos_de_dose(uuid[]),
--   public.dar_ciencia_atraso(uuid), private.checagem_atraso_job(), private.administracao_atraso_registrar(),
--   private.registrar_omissao_dose(uuid, text, timestamptz), private.registrar_dose_atrasada(uuid, text, timestamptz, text),
--   private.avisar_omissao_dose(uuid), private.avisar_dose_atrasada(uuid), private.administracao_atraso(),
--   private.motivo_atraso_rotulo(text), private.duracao_texto(interval), private.referencia_atraso(timestamptz, timestamptz),
--   private.horario_previsto(text, timestamptz), private.janela_atraso(text[]),
--   private.item_conta_atraso(public.prescricao_itens);
-- -- doses_atrasadas e omissoes_dose (com os gatilhos e a função de guarda)
-- -- e as colunas novas de administracoes ficam: são registro clínico. A
-- -- remoção só numa janela declarada (contract).
-- ════════════════════════════════════════════════════════════════════════════
