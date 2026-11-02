-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 2, parte 2.1 (BACKLOG.md; decisões do RT em 02/11/2026, D1 a D7
-- = A; diagnóstico em docs/ubs/TAREFA2-ATENDIMENTO-UBS-DIAGNOSTICO.md):
-- atendimento da UBS no mesmo episodios da porta.
--
-- Fonte das listas: Ministério da Saúde, e-SUS AB, Manual do CDS 2.1 (2016),
-- Ficha de Atendimento Individual: tipo de atendimento (p. 57 e 58),
-- problema/condição avaliada (p. 62 a 65) e conduta (p. 69 a 71).
--
-- 1. episodios: tipo_atendimento_aps, problemas_aps, cid_aps e conduta_aps,
--    anuláveis, com CHECK pelas listas da ficha. Só a UBS grava. O episódio da
--    UBS é o que tem tipo_atendimento_aps.
-- 2. private.lista_aps: as listas da ficha, para as RPCs. Os CHECKs repetem os
--    valores (o authenticated não executa função do schema private); o teste
--    confere que as duas listas são iguais.
-- 3. registrar_ficha: numa UBS, a ficha abre no setor 'consultorio', exige o
--    tipo de atendimento e cria o episódio direto em 'atendimento' (sem
--    classificação obrigatória, D3). Fora da UBS, nada muda.
-- 4. registrar_conduta_aps (nova): o médico de plantão no consultório encerra
--    a consulta com o tipo de atendimento, ao menos um problema/condição (lista
--    da ficha ou CID-10), ao menos uma conduta e o SOAP com Avaliação.
--    Auditoria 'consulta_aps_encerrada'.
-- 5. registrar_desfecho: recusa o episódio da UBS, menos a evasão (o paciente
--    que sai sem a consulta). A consulta da UBS encerra pela conduta.
-- 6. bpa_i_linhas: a unidade UBS não gera linha de BPA (D6); a produção dela
--    vai ao SISAB pelo e-SUS APS, decisão futura.
--
-- As trocas 3, 5 e 6 são feitas na definição atual da função, lida sem o CR do
-- fim de linha, como em 20270209000011. Mesma assinatura, dono e grants.
-- Idempotente: troca já feita não muda; função mudada para com erro.
-- Teste: supabase/tests/5a_atendimento_ubs.sql
--
-- Rollback (na ordem):
--   DROP FUNCTION IF EXISTS public.registrar_conduta_aps(uuid, text, text[], text[], text[], text);
--   as trocas 3, 5 e 6 invertidas (pg_temp.aps_trocar com os pares ao contrário);
--   DROP FUNCTION IF EXISTS private.lista_aps(text);
--   ALTER TABLE public.episodios DROP COLUMN IF EXISTS conduta_aps, DROP COLUMN IF EXISTS cid_aps,
--     DROP COLUMN IF EXISTS problemas_aps, DROP COLUMN IF EXISTS tipo_atendimento_aps;
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. colunas da ficha da atenção primária ─────────────────────────────────
ALTER TABLE public.episodios
  ADD COLUMN IF NOT EXISTS tipo_atendimento_aps text,
  ADD COLUMN IF NOT EXISTS problemas_aps text[],
  ADD COLUMN IF NOT EXISTS cid_aps text[],
  ADD COLUMN IF NOT EXISTS conduta_aps text[];

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'episodios_tipo_atendimento_aps_check'
                    AND conrelid = 'public.episodios'::regclass) THEN
    ALTER TABLE public.episodios ADD CONSTRAINT episodios_tipo_atendimento_aps_check CHECK (
      tipo_atendimento_aps IN ('consulta_programada', 'consulta_agendada', 'escuta_inicial',
                               'consulta_no_dia', 'atendimento_urgencia'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'episodios_problemas_aps_check'
                    AND conrelid = 'public.episodios'::regclass) THEN
    ALTER TABLE public.episodios ADD CONSTRAINT episodios_problemas_aps_check CHECK (
      problemas_aps <@ ARRAY['asma', 'desnutricao', 'diabetes', 'dpoc', 'hipertensao_arterial', 'obesidade',
                             'pre_natal', 'puericultura', 'puerperio', 'saude_sexual_reprodutiva', 'tabagismo',
                             'uso_alcool', 'uso_outras_drogas', 'saude_mental', 'reabilitacao', 'tuberculose',
                             'hanseniase', 'dengue', 'dst', 'rastreamento_cancer_colo_utero',
                             'rastreamento_cancer_mama', 'rastreamento_risco_cardiovascular']);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'episodios_conduta_aps_check'
                    AND conrelid = 'public.episodios'::regclass) THEN
    ALTER TABLE public.episodios ADD CONSTRAINT episodios_conduta_aps_check CHECK (
      conduta_aps <@ ARRAY['retorno_consulta_agendada', 'retorno_cuidado_continuado', 'agendamento_grupos',
                           'agendamento_nasf', 'alta_episodio', 'encaminhamento_interno',
                           'encaminhamento_especializado', 'encaminhamento_caps', 'encaminhamento_internacao',
                           'encaminhamento_urgencia', 'encaminhamento_atencao_domiciliar',
                           'encaminhamento_intersetorial']);
  END IF;
END $$;

COMMENT ON COLUMN public.episodios.tipo_atendimento_aps IS
  'UBS: tipo de atendimento da Ficha de Atendimento Individual do e-SUS APS. Preenchido só no episódio da UBS.';
COMMENT ON COLUMN public.episodios.problemas_aps IS 'UBS: problema/condição avaliada (lista da ficha).';
COMMENT ON COLUMN public.episodios.cid_aps IS 'UBS: problema/condição avaliada fora da lista, em CID-10 (a CIAP-2 vem na tarefa 4).';
COMMENT ON COLUMN public.episodios.conduta_aps IS 'UBS: conduta/desfecho da ficha.';

-- ── 2. listas da ficha ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.lista_aps(p_lista text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_lista
    WHEN 'tipo_atendimento' THEN ARRAY['consulta_programada', 'consulta_agendada', 'escuta_inicial',
                                       'consulta_no_dia', 'atendimento_urgencia']
    WHEN 'problema' THEN ARRAY['asma', 'desnutricao', 'diabetes', 'dpoc', 'hipertensao_arterial', 'obesidade',
                               'pre_natal', 'puericultura', 'puerperio', 'saude_sexual_reprodutiva', 'tabagismo',
                               'uso_alcool', 'uso_outras_drogas', 'saude_mental', 'reabilitacao', 'tuberculose',
                               'hanseniase', 'dengue', 'dst', 'rastreamento_cancer_colo_utero',
                               'rastreamento_cancer_mama', 'rastreamento_risco_cardiovascular']
    WHEN 'conduta' THEN ARRAY['retorno_consulta_agendada', 'retorno_cuidado_continuado', 'agendamento_grupos',
                              'agendamento_nasf', 'alta_episodio', 'encaminhamento_interno',
                              'encaminhamento_especializado', 'encaminhamento_caps', 'encaminhamento_internacao',
                              'encaminhamento_urgencia', 'encaminhamento_atencao_domiciliar',
                              'encaminhamento_intersetorial']
  END
$$;
REVOKE ALL ON FUNCTION private.lista_aps(text) FROM PUBLIC, anon, authenticated;

-- ── trocas na definição atual ───────────────────────────────────────────────
-- p_pares: antigo, novo, antigo, novo... Troca já feita (o novo já está no
-- corpo) é pulada; antigo ausente para com erro.
CREATE OR REPLACE FUNCTION pg_temp.aps_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(p_pares[k + 1] IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 3. ficha: consultório da UBS ────────────────────────────────────────────
SELECT pg_temp.aps_trocar('public.registrar_ficha(uuid, text, uuid, jsonb, text[], boolean)',
  '  v_tipo text;',
  '  v_tipo text; v_ubs boolean; v_tipo_aps text;',
  'SELECT unidade_id, tipo INTO v_unidade, v_tipo FROM public.setores WHERE id = p_setor AND ativo;',
  'SELECT s.unidade_id, s.tipo, u.tipo = ''ubs'' INTO v_unidade, v_tipo, v_ubs FROM public.setores s JOIN public.unidades u ON u.id = s.unidade_id WHERE s.id = p_setor AND s.ativo;',
  'IF v_tipo <> ''emergencia'' THEN RAISE EXCEPTION ''A ficha abre numa porta (setor de emergência).''; END IF;',
  'IF v_ubs THEN IF v_tipo <> ''consultorio'' THEN RAISE EXCEPTION ''Na UBS, a ficha abre num consultório.''; END IF; v_tipo_aps := nullif(btrim(p_dados ->> ''tipo_atendimento''), ''''); IF v_tipo_aps IS NULL OR NOT (v_tipo_aps = ANY (private.lista_aps(''tipo_atendimento''))) THEN RAISE EXCEPTION ''Informe o tipo de atendimento da UBS.''; END IF; ELSIF v_tipo <> ''emergencia'' THEN RAISE EXCEPTION ''A ficha abre numa porta (setor de emergência).''; END IF;',
  'INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, prioridades_legais, aberto_por)',
  'INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, prioridades_legais, aberto_por, etapa, tipo_atendimento_aps)',
  'VALUES (v_unidade, v_pac.id, p_setor, btrim(p_queixa), v_prio, v_perfil)',
  'VALUES (v_unidade, v_pac.id, p_setor, btrim(p_queixa), v_prio, v_perfil, CASE WHEN v_ubs THEN ''atendimento'' ELSE ''triagem'' END, v_tipo_aps)',
  'jsonb_build_object(''setor_id'', p_setor, ''status'', ''triagem''));',
  'jsonb_build_object(''setor_id'', p_setor, ''status'', CASE WHEN v_ubs THEN ''atendimento'' ELSE ''triagem'' END));');

-- ── 5. desfecho da porta: não na UBS, menos a evasão ────────────────────────
SELECT pg_temp.aps_trocar('public.registrar_desfecho(uuid, text, text, jsonb)',
  'IF e.etapa <> ''atendimento'' THEN RAISE EXCEPTION ''O episódio não está em atendimento.''; END IF;',
  'IF e.etapa <> ''atendimento'' THEN RAISE EXCEPTION ''O episódio não está em atendimento.''; END IF; IF e.tipo_atendimento_aps IS NOT NULL AND p_desfecho IS DISTINCT FROM ''evasao'' THEN RAISE EXCEPTION ''Na UBS, a consulta encerra pela conduta.''; END IF;');

-- ── 6. BPA: a UBS não gera linha ────────────────────────────────────────────
SELECT pg_temp.aps_trocar('private.bpa_i_linhas(uuid, text)',
  '    FROM base b',
  '    FROM base b WHERE NOT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = p_unidade AND u.tipo = ''ubs'')');

DROP FUNCTION pg_temp.aps_trocar(regprocedure, text[]);

-- ── 4. conduta: encerra a consulta da UBS ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_conduta_aps(
  p_episodio uuid, p_tipo text, p_problemas text[], p_cids text[], p_condutas text[], p_obs text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_eu uuid := private.meu_perfil_id();
  v_prob text[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_problemas, '{}')) x WHERE nullif(btrim(x), '') IS NOT NULL ORDER BY x);
  v_cond text[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_condutas, '{}')) x WHERE nullif(btrim(x), '') IS NOT NULL ORDER BY x);
  v_cids text[] := '{}';
  c text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'A conduta da ficha da atenção primária é só da consulta da UBS.'; END IF;
  IF e.etapa = 'encerrado' THEN RAISE EXCEPTION 'A consulta já foi encerrada.'; END IF;
  IF e.etapa <> 'atendimento' OR e.atendimento_iniciado_em IS NULL THEN
    RAISE EXCEPTION 'Abra o atendimento antes de registrar a conduta.';
  END IF;
  IF p_tipo IS NULL OR NOT (p_tipo = ANY (private.lista_aps('tipo_atendimento'))) THEN
    RAISE EXCEPTION 'Informe o tipo de atendimento.';
  END IF;
  IF NOT (v_prob <@ private.lista_aps('problema')) THEN RAISE EXCEPTION 'Problema/condição avaliada fora da lista da ficha.'; END IF;
  FOREACH c IN ARRAY coalesce(p_cids, '{}') LOOP
    CONTINUE WHEN nullif(btrim(c), '') IS NULL;
    v_cids := array_append(v_cids, private.cid_existente(c));
  END LOOP;
  v_cids := ARRAY(SELECT DISTINCT x FROM unnest(v_cids) x ORDER BY x);
  IF cardinality(v_prob) + cardinality(v_cids) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um problema ou condição avaliada (lista da ficha ou CID-10).';
  END IF;
  IF cardinality(v_cond) = 0 THEN RAISE EXCEPTION 'Informe ao menos uma conduta.'; END IF;
  IF NOT (v_cond <@ private.lista_aps('conduta')) THEN RAISE EXCEPTION 'Conduta fora da lista da ficha.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.atendimento_registros
                  WHERE episodio_id = e.id AND length(btrim(coalesce(avaliacao, ''))) > 0) THEN
    RAISE EXCEPTION 'Registre o atendimento (SOAP) com a Avaliação antes da conduta.';
  END IF;

  UPDATE public.episodios
     SET etapa = 'encerrado', tipo_atendimento_aps = p_tipo, problemas_aps = v_prob, cid_aps = v_cids,
         conduta_aps = v_cond, desfecho_motivo = nullif(btrim(p_obs), ''),
         desfecho_em = now(), desfecho_por = v_eu, encerrado_em = now(), encerrado_por = v_eu,
         reavaliar_em = NULL, updated_at = now()
   WHERE id = e.id;
  -- como no desfecho da porta: a prescrição da unidade para de valer e o
  -- parecer pendente é cancelado com motivo
  PERFORM private.encerrar_prescricoes(NULL, e.id, 'Encerrada com a conduta da consulta da UBS.');
  PERFORM private.cancelar_pareceres_do_episodio(e, v_eu, 'Consulta da UBS encerrada com o parecer ainda pendente.');
  DELETE FROM public.atendimento_rascunhos WHERE episodio_id = e.id;
  PERFORM private.registrar_auditoria('consulta_aps_encerrada', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', 'encerrado', 'tipo', p_tipo));
END $$;
REVOKE ALL ON FUNCTION public.registrar_conduta_aps(uuid, text, text[], text[], text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_conduta_aps(uuid, text, text[], text[], text[], text) TO authenticated;
