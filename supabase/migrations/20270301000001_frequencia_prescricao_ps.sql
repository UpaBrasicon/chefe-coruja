-- ════════════════════════════════════════════════════════════════════════════
-- Frequência com horário na prescrição do PS (achado guardado de 07/10/2026;
-- docs/porta/FREQUENCIA-PRESCRICAO-PS-DIAGNOSTICO.md). Decisão do RT em
-- 06/11/2026: A em F1 a F6.
--
-- F1. Item de medicamento da porta (prescrição sem internação) só entra com
--     uma frequência que o servidor entende: "Agora", "Se necessário" (com a
--     marca de se necessário), "Contínuo" ou um intervalo que
--     private.intervalo_posologia reconhece (8/8h, a cada 6 h, 3x ao dia...).
--     A observação e a internação seguem com o texto livre. A alteração do
--     item (alterar_item_prescricao) passa pela mesma regra, porque a nova
--     versão é gravada por public.prescrever.
-- F2. painel_atendimento_ps devolve, por item, os horários aprazados e as
--     doses por horário (feita, não feita, recusada, pendente ou atrasada),
--     pelo relógio do servidor. O campo antigo "checagem" (a última) continua.
-- F3. private.medicacao_sem_checagem (a trava da alta após medicação): item
--     com horário exige toda dose vencida até agora feita ou registrada como
--     "não feito" com motivo. Enquanto nenhuma dose venceu, vale a regra de
--     antes (uma dose feita). Item sem horário: a regra de antes. "Se
--     necessário" continua fora.
-- F4. public.prescricao_porta_ativa(p_paciente): os itens ativos da
--     prescrição da porta de quem está na observação ou na internação, para a
--     lista "Vindos da porta" do leito. Mesmo acesso de prescricao_vigente.
-- F5. checar recusa o 2º "feito" de item "Agora" (dose única).
-- F6. public.horarios_dos_itens(p_itens): os horários aprazados dos itens,
--     para a coluna de aprazamento da folha impressa do leito. Mesmo acesso de
--     alteracoes_de_itens.
--
-- Dose por horário (F2 e F3): cada horário aprazado (Brasília) vale em cada
-- dia, a partir da prescrição do item, até a suspensão do item ou o
-- encerramento da prescrição. A checagem daquele horário conta a partir de 2
-- horas antes dele (a mesma tolerância de private.aprazamentos_atrasados) e até
-- 22 horas depois (não invade o mesmo horário do dia seguinte). Vencida =
-- horário igual ou anterior a agora sem checagem.
--
-- Só expande: funções novas e CREATE OR REPLACE. prescrever e
-- painel_atendimento_ps recebem um trecho por troca de texto no corpo atual
-- (como 20261121000001 e 20261206000001); se o trecho não for achado, para.
-- Reaplicável: a troca não se repete quando o trecho novo já está lá.
--
-- ROLLBACK (em homologação antes; nada aqui apaga dado):
--   1. checar: rodar de novo o CREATE OR REPLACE FUNCTION public.checar de
--      supabase/migrations/20261119000001_desfecho_encerra_cuidado.sql.
--   2. medicacao_sem_checagem: rodar de novo o CREATE OR REPLACE FUNCTION
--      private.medicacao_sem_checagem de
--      supabase/migrations/20260929000006_fase4_checagem.sql.
--   3. prescrever e painel_atendimento_ps: desfazer as trocas.
--      DO $$
--      DECLARE d text;
--      BEGIN
--        d := replace(pg_get_functiondef('public.prescrever(uuid, jsonb)'::regprocedure), E'\r', '');
--        EXECUTE regexp_replace(d, '\n  -- F1 \(frequência da porta\).*?-- fim F1\n', E'\n', 's');
--        d := replace(pg_get_functiondef('public.painel_atendimento_ps(uuid)'::regprocedure), E'\r', '');
--        EXECUTE replace(d, E'\n           ''horarios'', coalesce(to_jsonb(it.horarios), ''[]''::jsonb), ''doses'', private.doses_do_item_json(it.id),', '');
--      END $$;
--   4. DROP FUNCTION IF EXISTS public.prescricao_porta_ativa(uuid), public.horarios_dos_itens(uuid[]),
--        private.doses_do_item_json(uuid), private.doses_do_item(uuid),
--        private.frequencia_porta_reconhecida(text, boolean);
--   A tela antiga lê "checagem" do painel, que não mudou; a tela nova sem
--   "doses" cai na situação da última checagem.
-- ════════════════════════════════════════════════════════════════════════════

-- ── troca de texto reaplicável ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  -- sem \r: o corpo gravado e este arquivo podem ter fim de linha do Windows
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

-- ── F1: frequência que o servidor entende ───────────────────────────────────
CREATE OR REPLACE FUNCTION private.frequencia_porta_reconhecida(p_posologia text, p_se_necessario boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN lower(btrim(coalesce(p_posologia, ''))) IN ('agora', 'contínuo', 'continuo') THEN true
    WHEN lower(btrim(coalesce(p_posologia, ''))) IN ('se necessário', 'se necessario') THEN coalesce(p_se_necessario, false)
    ELSE private.intervalo_posologia(p_posologia) IS NOT NULL
  END
$$;
REVOKE ALL ON FUNCTION private.frequencia_porta_reconhecida(text, boolean) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.trocar_uma_vez('public.prescrever(uuid, jsonb)'::regprocedure,
  $old$  IF v_presc IS NULL THEN RAISE EXCEPTION 'O paciente não tem episódio aberto nem internação ativa.'; END IF;$old$,
  $new$  IF v_presc IS NULL THEN RAISE EXCEPTION 'O paciente não tem episódio aberto nem internação ativa.'; END IF;
  -- F1 (frequência da porta): na porta, só frequência que o servidor entende
  -- (Agora, Se necessário, Contínuo ou um intervalo); o leito segue livre
  IF v_tipo = 'medicamento' AND (SELECT internacao_id FROM public.prescricoes WHERE id = v_presc) IS NULL
     AND NOT private.frequencia_porta_reconhecida(p_item ->> 'posologia', coalesce((p_item ->> 'se_necessario')::boolean, false)) THEN
    RAISE EXCEPTION 'Frequência não reconhecida: use Agora, Se necessário ou um intervalo como 8/8h.';
  END IF;
  -- fim F1$new$);

-- ── F2 e F3: doses por horário ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.doses_do_item(p_item uuid)
RETURNS TABLE (horario text, previsto_em timestamptz, situacao text, em timestamptz, por uuid, motivo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH it AS (
    SELECT i.id, i.horarios, i.created_at,
           least(coalesce(i.suspenso_em, 'infinity'::timestamptz), coalesce(pr.encerrada_em, 'infinity'::timestamptz)) AS fim
      FROM public.prescricao_itens i
      JOIN public.prescricoes pr ON pr.id = i.prescricao_id
     WHERE i.id = p_item AND NOT i.se_necessario AND cardinality(coalesce(i.horarios, '{}'::text[])) > 0
  ), slots AS (
    SELECT it.id, it.created_at, it.fim, h.h, ((d.d::date + h.h::time) AT TIME ZONE 'America/Sao_Paulo') AS slot
      FROM it
      CROSS JOIN LATERAL unnest(it.horarios) h(h)
      CROSS JOIN LATERAL generate_series((it.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
                                         (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1, interval '1 day') d(d)
     WHERE h.h ~ '^([01]\d|2[0-3]):[0-5]\d$'
  )
  SELECT s.h, s.slot,
         coalesce(a.situacao, CASE WHEN s.slot <= now() THEN 'atrasada' ELSE 'pendente' END),
         a.registrado_em, a.registrado_por, a.motivo
    FROM slots s
    LEFT JOIN LATERAL (
      SELECT ad.situacao, ad.registrado_em, ad.registrado_por, ad.motivo FROM public.administracoes ad
       WHERE ad.item_id = s.id AND ad.horario_previsto = s.h
         AND ad.registrado_em >= s.slot - interval '2 hours' AND ad.registrado_em < s.slot + interval '22 hours'
       -- vale a checagem que resolve o horário: feito, depois não feito, depois recusado
       ORDER BY ad.situacao = 'feito' DESC, ad.situacao = 'nao_feito' DESC, ad.registrado_em DESC LIMIT 1) a ON true
   -- a partir do minuto da prescrição; antes dela, só o horário que já foi checado
   WHERE (s.slot >= date_trunc('minute', s.created_at)
          OR (a.situacao IS NOT NULL AND s.slot >= s.created_at - interval '2 hours'))
     AND s.slot <= s.fim
     AND s.slot < now() + interval '24 hours'
   ORDER BY s.slot
$$;
REVOKE ALL ON FUNCTION private.doses_do_item(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.doses_do_item_json(p_item uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'horario', d.horario, 'previsto_em', d.previsto_em, 'situacao', d.situacao,
           'em', d.em, 'por', pf.nome_completo, 'motivo', d.motivo) ORDER BY d.previsto_em), '[]'::jsonb)
    FROM private.doses_do_item(p_item) d
    LEFT JOIN public.perfis pf ON pf.id = d.por
$$;
REVOKE ALL ON FUNCTION private.doses_do_item_json(uuid) FROM PUBLIC, anon, authenticated;

-- F2: o painel da porta leva os horários e as doses de cada item
SELECT pg_temp.trocar_uma_vez('public.painel_atendimento_ps(uuid)'::regprocedure,
  $old$'suspenso_em', it.suspenso_em, 'motivo_suspensao', it.motivo_suspensao,$old$,
  $new$'suspenso_em', it.suspenso_em, 'motivo_suspensao', it.motivo_suspensao,
           'horarios', coalesce(to_jsonb(it.horarios), '[]'::jsonb), 'doses', private.doses_do_item_json(it.id),$new$);

-- F3: alta após medicação com as doses vencidas checadas
CREATE OR REPLACE FUNCTION private.medicacao_sem_checagem(p_episodio uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(it.descricao ORDER BY it.ordem), '{}')
  FROM public.prescricoes pr
  JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
  LEFT JOIN LATERAL (
    SELECT count(*) AS vencidas, count(*) FILTER (WHERE d.situacao NOT IN ('feito', 'nao_feito')) AS abertas
      FROM private.doses_do_item(it.id) d WHERE d.previsto_em <= now()) dv ON true
  WHERE pr.episodio_id = p_episodio AND pr.internacao_id IS NULL
    AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL AND NOT it.se_necessario
    AND CASE WHEN dv.vencidas > 0 THEN dv.abertas > 0
             -- sem horário, ou nenhum horário vencido ainda: uma dose feita (regra de antes)
             ELSE NOT EXISTS (SELECT 1 FROM public.administracoes a WHERE a.item_id = it.id AND a.situacao = 'feito') END
$$;
REVOKE ALL ON FUNCTION private.medicacao_sem_checagem(uuid) FROM PUBLIC, anon, authenticated;

-- ── F4: itens da porta que seguem ativos no leito ───────────────────────────
CREATE OR REPLACE FUNCTION public.prescricao_porta_ativa(p_paciente uuid)
RETURNS TABLE (id uuid, tipo text, descricao text, medicamento_id uuid, dose text, via text, posologia text, se_necessario boolean,
               observacao text, peso_kg numeric, diluicao_versao integer, diluicao_texto text, diluicao_divergente boolean,
               justificativa_divergencia text, vasoativo boolean, autor text, criado_em timestamptz, suspenso_em timestamptz,
               validacao text, validacao_motivo text, horarios text[], episodio_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- o mesmo acesso de prescricao_vigente
  IF NOT (private.paciente_no_meu_plantao(p_paciente)
          OR private.papel_na_unidade((SELECT unidade_id FROM public.pacientes WHERE pacientes.id = p_paciente)) = 'gestor'
          OR private.sou_farmaceutico()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  -- só quem está na observação ou na internação: na porta, a lista é a da porta
  RETURN QUERY
  SELECT i.id, i.tipo, i.descricao, i.medicamento_id, i.dose, i.via, i.posologia, i.se_necessario, i.observacao, i.peso_kg,
         i.diluicao_versao, i.diluicao_texto, i.diluicao_divergente, i.justificativa_divergencia,
         coalesce(m.vasoativo, false), pf.nome_completo, i.created_at, i.suspenso_em, v.situacao, v.motivo,
         coalesce(i.horarios, '{}'::text[]), pr.episodio_id
    FROM public.prescricoes pr
    JOIN public.prescricao_itens i ON i.prescricao_id = pr.id
    LEFT JOIN public.medicamento m ON m.id = i.medicamento_id
    LEFT JOIN public.perfis pf ON pf.id = i.autor_id
    LEFT JOIN LATERAL (SELECT vp.situacao, vp.motivo FROM public.validacoes_prescricao vp
                        WHERE vp.item_id = i.id ORDER BY vp.em DESC LIMIT 1) v ON true
   WHERE pr.paciente_id = p_paciente AND pr.status = 'ativa' AND pr.internacao_id IS NULL AND i.suspenso_em IS NULL
     AND EXISTS (SELECT 1 FROM public.internacoes n
                  WHERE n.paciente_id = p_paciente AND n.status IN ('admitido', 'em_observacao', 'internado')
                    AND (n.episodio_id IS NULL OR n.episodio_id = pr.episodio_id))
   ORDER BY pr.created_at, i.ordem;
END $$;
REVOKE ALL ON FUNCTION public.prescricao_porta_ativa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prescricao_porta_ativa(uuid) TO authenticated;

-- ── F5: "Agora" é dose única ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.checar(p_item uuid, p_situacao text, p_horario text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE it public.prescricao_itens; pr public.prescricoes; v_id uuid; v_dupla uuid; v_sem_liberacao boolean := false;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item suspenso: não se checa.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF NOT private.sou_enfermagem(pr.unidade_id) OR NOT private.paciente_em_cuidado_no_plantao(pr.paciente_id) THEN
    RAISE EXCEPTION 'A checagem é da enfermagem de plantão no setor do paciente.';
  END IF;
  IF p_situacao NOT IN ('feito', 'nao_feito', 'recusado') THEN RAISE EXCEPTION 'Situação desconhecida.'; END IF;
  IF p_situacao <> 'feito' AND length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Diga o motivo (não feito ou recusado).';
  END IF;
  IF p_horario IS NOT NULL AND p_horario !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido (use HH:MM).'; END IF;
  IF NOT it.se_necessario AND cardinality(coalesce(it.horarios, '{}'::text[])) > 0 THEN
    IF p_horario IS NULL THEN
      RAISE EXCEPTION 'Escolha o horário aprazado que está sendo checado.';
    END IF;
    IF NOT (p_horario = ANY (it.horarios)) THEN
      RAISE EXCEPTION 'O horário % não está no aprazamento deste item (%).', p_horario, array_to_string(it.horarios, ', ');
    END IF;
  END IF;
  -- F5 (frequência da porta): "Agora" é dose única; o 2º "feito" é recusado
  -- (a trava na linha do item segura duas checagens ao mesmo tempo)
  IF p_situacao = 'feito' AND lower(btrim(coalesce(it.posologia, ''))) = 'agora' THEN
    PERFORM 1 FROM public.prescricao_itens WHERE id = it.id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.administracoes a WHERE a.item_id = it.id AND a.situacao = 'feito') THEN
      RAISE EXCEPTION 'Item "Agora" é dose única e já foi feito.';
    END IF;
  END IF;
  -- alta vigilância: liberado pela farmácia, ou (transição) dupla conferência
  -- completa, ou administração com justificativa, marcada para conferir depois
  IF p_situacao = 'feito' AND it.medicamento_id IS NOT NULL AND private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id)
     AND NOT private.liberado_pela_farmacia(it.id) THEN
    SELECT id INTO v_dupla FROM public.duplas_checagens
     WHERE item_id = it.id AND horario_previsto IS NOT DISTINCT FROM p_horario AND usada_em IS NULL
       AND segundo_por IS NOT NULL AND primeiro_em > now() - interval '2 hours'
     ORDER BY primeiro_em DESC LIMIT 1 FOR UPDATE;
    IF v_dupla IS NOT NULL THEN
      UPDATE public.duplas_checagens SET usada_em = now() WHERE id = v_dupla;
    ELSIF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
      RAISE EXCEPTION 'Alta vigilância sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras). O farmacêutico confere depois.';
    ELSE
      v_sem_liberacao := true;
    END IF;
  END IF;
  INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, horario_previsto, situacao, motivo, registrado_por, sem_liberacao)
  VALUES (it.id, pr.paciente_id, pr.unidade_id, p_horario, p_situacao, nullif(btrim(p_motivo), ''), private.meu_perfil_id(), v_sem_liberacao)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;
REVOKE ALL ON FUNCTION public.checar(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checar(uuid, text, text, text) TO authenticated;

-- ── F6: horários aprazados para a folha impressa ────────────────────────────
-- O mesmo acesso de alteracoes_de_itens (segundo fator e membro da unidade).
CREATE OR REPLACE FUNCTION public.horarios_dos_itens(p_itens uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('item_id', it.id, 'horarios', coalesce(to_jsonb(it.horarios), '[]'::jsonb))), '[]'::jsonb)
    FROM public.prescricao_itens it
    JOIN public.prescricoes pr ON pr.id = it.prescricao_id
   WHERE it.id = ANY (p_itens) AND private.segundo_fator_ok() AND private.membro_da_unidade(pr.unidade_id);
$$;
REVOKE ALL ON FUNCTION public.horarios_dos_itens(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.horarios_dos_itens(uuid[]) TO authenticated;
