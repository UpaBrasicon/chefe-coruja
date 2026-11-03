-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 7, parte 7.1 (BACKLOG.md; decisões do RT em 03/11/2026, J1 a J5 =
-- A): hiperdia, o acompanhamento da pessoa com hipertensão e com diabetes na
-- UBS, pela régua das notas metodológicas C5 e C4 da SAPS/MS (junho de 2026).
--
-- 1. programa_participantes: o paciente da UBS no programa (hipertensão ou
--    diabetes), com a origem (consulta ou manual), a entrada e a saída com
--    motivo. Acesso só por RPC.
-- 2. Entrada automática (J2): a consulta da UBS que encerra com o problema
--    "hipertensão arterial" ou "diabetes", ou com o CID-10/CIAP-2 elegível da
--    nota (C5: K86, K87, I10–I13, I15, O10, O11; C4: T89, T90, E10, E11, E14),
--    inclui o paciente (gatilho). Médico e enfermeiro incluem e retiram à mão.
-- 3. Avaliação dos pés (J4, C4-F): registro na consulta da UBS (sem ou com
--    alteração), por médico ou enfermeiro de plantão no consultório.
-- 4. Painel (J3, J5): por participante, as datas das boas práticas que o app
--    registra (consulta, pressão, peso e altura no mesmo dia, hemoglobina
--    glicada pedida ou com resultado, avaliação dos pés) e a próxima consulta
--    marcada. A regra de "em dia" e dos pontos fica em src/domain/hiperdia.ts,
--    com a nota. Só médico, enfermeiro, técnico de enfermagem e gestor da UBS.
--    A visita do ACS não existe no app (fica "não registrada").
--
-- Idempotente. Teste: supabase/tests/5a_hiperdia.sql
--
-- Rollback (na ordem):
--   DROP TRIGGER trg_hiperdia_consulta ON public.episodios;
--   DROP FUNCTION das RPCs hiperdia_*, programa_* e registrar_avaliacao_pes, e
--     de private.hiperdia_*;
--   DROP TABLE public.avaliacoes_pes, public.programa_participantes;
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.programa_participantes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  programa      text NOT NULL CHECK (programa IN ('hipertensao', 'diabetes')),
  origem        text NOT NULL CHECK (origem IN ('consulta', 'manual')),
  episodio_id   uuid REFERENCES public.episodios(id),
  entrada_em    timestamptz NOT NULL DEFAULT now(),
  entrada_por   uuid REFERENCES public.perfis(id),
  saida_em      timestamptz,
  saida_por     uuid REFERENCES public.perfis(id),
  motivo_saida  text,
  CHECK (saida_em IS NULL OR length(btrim(coalesce(motivo_saida, ''))) >= 5)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_programa_participantes_ativo ON public.programa_participantes (paciente_id, programa) WHERE saida_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_programa_participantes_unidade ON public.programa_participantes (unidade_id, programa) WHERE saida_em IS NULL;

CREATE TABLE IF NOT EXISTS public.avaliacoes_pes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  episodio_id    uuid NOT NULL REFERENCES public.episodios(id),
  resultado      text NOT NULL CHECK (resultado IN ('sem_alteracao', 'com_alteracao')),
  observacao     text,
  registrado_por uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (resultado = 'sem_alteracao' OR length(btrim(coalesce(observacao, ''))) >= 5)
);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_pes_paciente ON public.avaliacoes_pes (paciente_id, registrado_em DESC);

ALTER TABLE public.programa_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes_pes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programa_participantes, public.avaliacoes_pes FROM anon, authenticated;

-- ── apoio ───────────────────────────────────────────────────────────────────
-- programas que a consulta indica (J2): problema da ficha, CID-10 ou CIAP-2 da nota
CREATE OR REPLACE FUNCTION private.hiperdia_programas_da_consulta(p_problemas text[], p_cids text[], p_ciaps text[])
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ARRAY(SELECT x FROM (VALUES ('hipertensao'), ('diabetes')) v(x)
    WHERE (x = 'hipertensao' AND ('hipertensao_arterial' = ANY (coalesce(p_problemas, '{}'))
             OR coalesce(p_ciaps, '{}') && ARRAY['K86', 'K87']
             OR EXISTS (SELECT 1 FROM unnest(coalesce(p_cids, '{}')) c
                         WHERE left(upper(replace(c, '.', '')), 3) IN ('I10', 'I11', 'I12', 'I13', 'I15', 'O10', 'O11'))))
       OR (x = 'diabetes' AND ('diabetes' = ANY (coalesce(p_problemas, '{}'))
             OR coalesce(p_ciaps, '{}') && ARRAY['T89', 'T90']
             OR EXISTS (SELECT 1 FROM unnest(coalesce(p_cids, '{}')) c
                         WHERE left(upper(replace(c, '.', '')), 3) IN ('E10', 'E11', 'E14')))))
$$;

-- quem vê e cuida do programa (J5)
CREATE OR REPLACE FUNCTION private.hiperdia_ve(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.eh_super_admin(), false)
      OR EXISTS (SELECT 1 FROM unnest(ARRAY['plantonista', 'enfermeiro', 'tecnico_enfermagem', 'gestor']) r
                  WHERE private.tenho_papel(p_unidade, r) IS TRUE)
$$;

-- as datas das boas práticas registradas no app, por paciente da UBS
CREATE OR REPLACE FUNCTION private.hiperdia_registros(p_paciente uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'ultima_consulta', (SELECT max(e.encerrado_em) FROM public.episodios e
                         WHERE e.paciente_id = p_paciente AND e.tipo_atendimento_aps IS NOT NULL AND e.conduta_aps IS NOT NULL),
    'ultima_pa', (SELECT max(o.aferido_em) FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
                   WHERE o.paciente_id = p_paciente AND c.nome = 'pressao-arterial-sistolica'),
    'ultimo_peso_altura', (SELECT max(o.aferido_em) FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
                            WHERE o.paciente_id = p_paciente AND c.nome = 'peso'
                              AND EXISTS (SELECT 1 FROM public.observacao o2 JOIN public.conceito c2 ON c2.id = o2.conceito_id
                                           WHERE o2.paciente_id = p_paciente AND c2.nome = 'estatura'
                                             AND (o2.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date = (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date)),
    'ultima_hba1c', greatest(
       (SELECT max(x.pedido_em) FROM public.exames_pedidos x
         WHERE x.paciente_id = p_paciente AND x.situacao IS DISTINCT FROM 'cancelado'
           AND (regexp_replace(coalesce(x.procedimento, ''), '\D', '', 'g') = '0202010503' OR x.exame ~* '(hba1c|glicad|glicosilad)')),
       (SELECT max(r.liberado_em) FROM public.exame_resultado_itens i
          JOIN public.exame_resultados r ON r.id = i.resultado_id JOIN public.exames_pedidos x ON x.id = r.exame_id
         WHERE x.paciente_id = p_paciente AND (i.loinc = '4548-4' OR i.analito ~* '(hba1c|glicad|glicosilad)'))),
    'ultima_avaliacao_pes', (SELECT max(a.registrado_em) FROM public.avaliacoes_pes a WHERE a.paciente_id = p_paciente),
    'pes_com_alteracao', (SELECT a.resultado = 'com_alteracao' FROM public.avaliacoes_pes a
                           WHERE a.paciente_id = p_paciente ORDER BY a.registrado_em DESC LIMIT 1),
    'proxima_consulta', (SELECT min(g.inicio) FROM public.agendamentos g
                          WHERE g.paciente_id = p_paciente AND g.tipo = 'consulta' AND g.situacao = 'agendado' AND g.inicio > now()))
$$;

REVOKE ALL ON FUNCTION private.hiperdia_programas_da_consulta(text[], text[], text[]), private.hiperdia_ve(uuid),
  private.hiperdia_registros(uuid) FROM PUBLIC, anon, authenticated;

-- ── entrada automática pela consulta (J2) ───────────────────────────────────
CREATE OR REPLACE FUNCTION private.hiperdia_na_consulta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p text;
BEGIN
  IF NEW.etapa = 'encerrado' AND OLD.etapa IS DISTINCT FROM 'encerrado' AND NEW.tipo_atendimento_aps IS NOT NULL THEN
    BEGIN
      FOREACH p IN ARRAY private.hiperdia_programas_da_consulta(NEW.problemas_aps, NEW.cid_aps, NEW.ciap_aps) LOOP
        INSERT INTO public.programa_participantes (unidade_id, paciente_id, programa, origem, episodio_id, entrada_por)
        SELECT NEW.unidade_id, NEW.paciente_id, p, 'consulta', NEW.id, NEW.desfecho_por
         WHERE NOT EXISTS (SELECT 1 FROM public.programa_participantes
                            WHERE paciente_id = NEW.paciente_id AND programa = p AND saida_em IS NULL);
      END LOOP;
    EXCEPTION WHEN others THEN
      -- a consulta nunca trava pelo programa
      RAISE WARNING 'hiperdia: consulta % não incluída: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.hiperdia_na_consulta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_hiperdia_consulta ON public.episodios;
CREATE TRIGGER trg_hiperdia_consulta AFTER UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.hiperdia_na_consulta();

-- ── incluir e retirar à mão ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.programa_incluir(p_paciente uuid, p_programa text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = pa.unidade_id AND tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'O hiperdia é da UBS.';
  END IF;
  IF NOT (private.tenho_papel(pa.unidade_id, 'plantonista') IS TRUE OR private.tenho_papel(pa.unidade_id, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: inclui o médico ou o enfermeiro da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_programa IS NULL OR p_programa NOT IN ('hipertensao', 'diabetes') THEN RAISE EXCEPTION 'Programa: hipertensão ou diabetes.'; END IF;
  IF EXISTS (SELECT 1 FROM public.programa_participantes WHERE paciente_id = pa.id AND programa = p_programa AND saida_em IS NULL) THEN
    RAISE EXCEPTION 'O paciente já está no programa.';
  END IF;
  INSERT INTO public.programa_participantes (unidade_id, paciente_id, programa, origem, entrada_por)
  VALUES (pa.unidade_id, pa.id, p_programa, 'manual', private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('programa_incluido', 'programa_participantes', v_id, pa.unidade_id,
    jsonb_build_object('tipo', p_programa));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.programa_retirar(p_participante uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x public.programa_participantes;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO x FROM public.programa_participantes WHERE id = p_participante FOR UPDATE;
  IF NOT FOUND OR x.saida_em IS NOT NULL THEN RAISE EXCEPTION 'O paciente não está no programa.'; END IF;
  IF NOT (private.tenho_papel(x.unidade_id, 'plantonista') IS TRUE OR private.tenho_papel(x.unidade_id, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: retira o médico ou o enfermeiro da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Escreva o motivo da saída (mínimo de 5 letras).'; END IF;
  UPDATE public.programa_participantes SET saida_em = now(), saida_por = private.meu_perfil_id(), motivo_saida = btrim(p_motivo)
   WHERE id = x.id;
  PERFORM private.registrar_auditoria('programa_retirado', 'programa_participantes', x.id, x.unidade_id,
    jsonb_build_object('tipo', x.programa));
END $$;

-- ── avaliação dos pés (J4, C4-F) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_avaliacao_pes(p_episodio uuid, p_resultado text, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'A avaliação dos pés é da consulta da UBS.'; END IF;
  IF e.etapa NOT IN ('triagem', 'atendimento') THEN RAISE EXCEPTION 'A consulta já foi encerrada.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora())
     OR NOT (private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE OR private.tenho_papel(e.unidade_id, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: registra o médico ou o enfermeiro de plantão no consultório.';
  END IF;
  IF p_resultado IS NULL OR p_resultado NOT IN ('sem_alteracao', 'com_alteracao') THEN
    RAISE EXCEPTION 'Resultado: sem alteração ou com alteração.';
  END IF;
  IF p_resultado = 'com_alteracao' AND length(btrim(coalesce(p_observacao, ''))) < 5 THEN
    RAISE EXCEPTION 'Descreva a alteração (mínimo de 5 letras).';
  END IF;
  INSERT INTO public.avaliacoes_pes (unidade_id, paciente_id, episodio_id, resultado, observacao, registrado_por)
  VALUES (e.unidade_id, e.paciente_id, e.id, p_resultado, nullif(btrim(coalesce(p_observacao, '')), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('avaliacao_pes', 'avaliacoes_pes', v_id, e.unidade_id, jsonb_build_object('status', p_resultado));
  RETURN v_id;
END $$;

-- ── painel e paciente (J3, J5) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hiperdia_painel(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.hiperdia_ve(p_unidade) THEN
    RAISE EXCEPTION 'O hiperdia é visto pelo médico, pela enfermagem e pelo gestor da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'paciente_id', pa.id, 'nome', pa.nome, 'nome_social', pa.nome_social, 'data_nascimento', pa.data_nascimento,
             'programas', g.programas, 'desde', g.desde) || private.hiperdia_registros(pa.id)
           ORDER BY coalesce(nullif(btrim(pa.nome_social), ''), pa.nome))
      FROM (SELECT x.paciente_id,
                   jsonb_agg(jsonb_build_object('id', x.id, 'programa', x.programa, 'origem', x.origem, 'entrada_em', x.entrada_em)
                             ORDER BY x.programa DESC) AS programas,
                   min(x.entrada_em) AS desde
              FROM public.programa_participantes x
             WHERE x.unidade_id = p_unidade AND x.saida_em IS NULL
             GROUP BY x.paciente_id) g
      JOIN public.pacientes pa ON pa.id = g.paciente_id), '[]'::jsonb);
END $$;

-- janela da consulta: os programas do paciente e as datas
CREATE OR REPLACE FUNCTION public.hiperdia_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF private.segundo_fator_ok() IS NOT TRUE OR v_unidade IS NULL OR NOT private.hiperdia_ve(v_unidade) THEN
    RAISE EXCEPTION 'O hiperdia é visto pelo médico, pela enfermagem e pelo gestor da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'programas', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'programa', x.programa, 'origem', x.origem, 'entrada_em', x.entrada_em)
                                            ORDER BY x.programa DESC)
                             FROM public.programa_participantes x WHERE x.paciente_id = p_paciente AND x.saida_em IS NULL), '[]'::jsonb))
    || private.hiperdia_registros(p_paciente);
END $$;

REVOKE ALL ON FUNCTION public.programa_incluir(uuid, text), public.programa_retirar(uuid, text),
  public.registrar_avaliacao_pes(uuid, text, text), public.hiperdia_painel(uuid), public.hiperdia_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programa_incluir(uuid, text), public.programa_retirar(uuid, text),
  public.registrar_avaliacao_pes(uuid, text, text), public.hiperdia_painel(uuid), public.hiperdia_do_paciente(uuid) TO authenticated;
