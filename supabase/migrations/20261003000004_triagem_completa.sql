-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend · triagem completa (classificação de risco do protótipo).
--
-- O que a triagem passa a guardar JUNTO da classificação (classificacoes_risco):
--   • queixa         — a queixa principal revista pelo enfermeiro (a da
--                      recepção continua no episódio, intocada);
--   • grupo_trocado  — o enfermeiro usou o protocolo do outro grupo
--                      (adulto ↔ pediatria) mesmo sabendo a idade;
--                      publico_pela_idade guarda o grupo que a idade daria;
--   • discriminador_livre — discriminador escrito pelo enfermeiro, fora da
--                      lista do fluxograma (sem cor de referência);
--   • dor            — escala usada (NIPS, FLACC ou numérica), itens e total;
--   • oxigenio       — SpO₂ medida em ar ambiente ou com O₂ (e L/min);
--   • gestacao       — tipo, G/P/A, DUM ou "não informada", IG e DPP (Naegele,
--                      calculadas aqui pela DUM), intercorrências.
--
-- A cor continua sendo a do enfermeiro: nada aqui sugere, calcula ou troca cor
-- (CLAUDE.md, ADR 0007). Reclassificação continua só do médico.
-- classificar_risco ganha parâmetros OPCIONAIS: quem chamava com os 9 antigos
-- continua funcionando igual. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── colunas novas ───────────────────────────────────────────────────────────
ALTER TABLE public.classificacoes_risco
  ADD COLUMN IF NOT EXISTS queixa text,
  ADD COLUMN IF NOT EXISTS publico_pela_idade text,
  ADD COLUMN IF NOT EXISTS grupo_trocado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discriminador_livre boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dor jsonb,
  ADD COLUMN IF NOT EXISTS oxigenio jsonb,
  ADD COLUMN IF NOT EXISTS gestacao jsonb;

ALTER TABLE public.classificacoes_risco DROP CONSTRAINT IF EXISTS classificacoes_publico_pela_idade_check;
ALTER TABLE public.classificacoes_risco ADD CONSTRAINT classificacoes_publico_pela_idade_check
  CHECK (publico_pela_idade IS NULL OR publico_pela_idade IN ('adulto', 'pediatrico'));
ALTER TABLE public.classificacoes_risco DROP CONSTRAINT IF EXISTS classificacoes_dor_escala_check;
ALTER TABLE public.classificacoes_risco ADD CONSTRAINT classificacoes_dor_escala_check
  CHECK (dor IS NULL OR dor ->> 'escala' IN ('nips', 'flacc', 'numerica'));
ALTER TABLE public.classificacoes_risco DROP CONSTRAINT IF EXISTS classificacoes_oxigenio_modo_check;
ALTER TABLE public.classificacoes_risco ADD CONSTRAINT classificacoes_oxigenio_modo_check
  CHECK (oxigenio IS NULL OR oxigenio ->> 'modo' IN ('ar_ambiente', 'o2_suplementar'));

COMMENT ON COLUMN public.classificacoes_risco.dor IS
  'Escala de dor da triagem: {"escala":"nips|flacc|numerica","itens":{…},"total":n}. NIPS (Lawrence 1993), FLACC (Merkel 1997), numérica = Anexo I do protocolo. Registro da enfermagem; não define cor.';
COMMENT ON COLUMN public.classificacoes_risco.gestacao IS
  'Gestação informada na triagem. Com DUM, IG e DPP são calculadas aqui (Naegele: DPP = DUM + 280 dias; ACOG CO 700, 2017).';

-- ── dor: mesmas escalas de src/clinico/triagem/dor.ts ───────────────────────
-- Máximo de pontos por item. NIPS: choro 0–2, demais 0–1 (total 0–7).
-- FLACC: cinco itens de 0–2 (total 0–10). Numérica: 0–10 dita pelo paciente.
CREATE OR REPLACE FUNCTION private.validar_dor_triagem(p_dor jsonb, p_sinal numeric, p_publico text)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_escala text := p_dor ->> 'escala';
  v_def jsonb;
  v_itens jsonb := coalesce(p_dor -> 'itens', '{}'::jsonb);
  v_total int := 0;
  k text;
  v jsonb;
BEGIN
  IF jsonb_typeof(p_dor) <> 'object' OR v_escala IS NULL OR v_escala NOT IN ('nips', 'flacc', 'numerica') THEN
    RAISE EXCEPTION 'Escala de dor desconhecida.';
  END IF;
  IF p_sinal IS NULL THEN RAISE EXCEPTION 'Informe a dor nos sinais vitais.'; END IF;

  IF v_escala = 'numerica' THEN
    IF p_sinal <> trunc(p_sinal) OR p_sinal < 0 OR p_sinal > 10 THEN
      RAISE EXCEPTION 'Dor pela escala numérica vai de 0 a 10.';
    END IF;
    RETURN jsonb_build_object('escala', 'numerica', 'total', p_sinal::int);
  END IF;

  IF p_publico <> 'pediatrico' THEN
    RAISE EXCEPTION 'NIPS e FLACC são escalas pediátricas: no adulto use a escala numérica.';
  END IF;
  v_def := CASE v_escala
    WHEN 'nips'  THEN '{"face":1,"choro":2,"resp":1,"bracos":1,"pernas":1,"alerta":1}'::jsonb
    ELSE              '{"face":2,"pernas":2,"atividade":2,"choro":2,"consolo":2}'::jsonb END;

  IF jsonb_typeof(v_itens) <> 'object' THEN RAISE EXCEPTION 'Itens da escala de dor inválidos.'; END IF;
  FOR k IN SELECT jsonb_object_keys(v_itens) LOOP
    IF NOT v_def ? k THEN RAISE EXCEPTION 'Item % não existe na %.', k, upper(v_escala); END IF;
  END LOOP;
  FOR k, v IN SELECT * FROM jsonb_each(v_def) LOOP
    IF NOT v_itens ? k OR jsonb_typeof(v_itens -> k) <> 'number' THEN
      RAISE EXCEPTION 'Marque todos os itens da % (falta %).', upper(v_escala), k;
    END IF;
    IF (v_itens ->> k)::numeric <> trunc((v_itens ->> k)::numeric)
       OR (v_itens ->> k)::int < 0 OR (v_itens ->> k)::int > v::int THEN
      RAISE EXCEPTION 'Valor fora da escala no item % da %.', k, upper(v_escala);
    END IF;
    v_total := v_total + (v_itens ->> k)::int;
  END LOOP;
  IF v_total <> p_sinal THEN
    RAISE EXCEPTION 'A dor registrada (%) não é a soma dos itens da % (%).', p_sinal, upper(v_escala), v_total;
  END IF;
  RETURN jsonb_build_object('escala', v_escala, 'itens', v_itens, 'total', v_total);
END $$;

-- ── oxigênio: onde a SpO₂ foi medida ────────────────────────────────────────
-- O protocolo usa "em ar ambiente" nos discriminadores de saturação.
CREATE OR REPLACE FUNCTION private.validar_oxigenio_triagem(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v_modo text := p ->> 'modo'; v_l numeric;
BEGIN
  IF jsonb_typeof(p) <> 'object' OR v_modo IS NULL OR v_modo NOT IN ('ar_ambiente', 'o2_suplementar') THEN
    RAISE EXCEPTION 'Informe se a SpO₂ foi medida em ar ambiente ou com O₂.';
  END IF;
  IF v_modo = 'ar_ambiente' THEN
    IF p ? 'litros_min' AND p -> 'litros_min' <> 'null'::jsonb THEN
      RAISE EXCEPTION 'Fluxo de O₂ só se informa com O₂ suplementar.';
    END IF;
    RETURN jsonb_build_object('modo', 'ar_ambiente');
  END IF;
  IF p ? 'litros_min' AND p -> 'litros_min' <> 'null'::jsonb THEN
    IF jsonb_typeof(p -> 'litros_min') <> 'number' THEN RAISE EXCEPTION 'Fluxo de O₂ inválido.'; END IF;
    v_l := (p ->> 'litros_min')::numeric;
    IF v_l <= 0 THEN RAISE EXCEPTION 'Fluxo de O₂ tem de ser maior que zero.'; END IF;
    RETURN jsonb_build_object('modo', 'o2_suplementar', 'litros_min', v_l);
  END IF;
  RETURN jsonb_build_object('modo', 'o2_suplementar');
END $$;

-- ── gestação: IG e DPP pela DUM calculadas aqui (Naegele) ───────────────────
CREATE OR REPLACE FUNCTION private.normalizar_gestacao(p jsonb, p_hoje date)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_tipo text := p ->> 'tipo';
  v_out jsonb;
  v_dum date;
  v_dias int;
  k text;
BEGIN
  IF jsonb_typeof(p) <> 'object' OR v_tipo IS NULL
     OR v_tipo NOT IN ('nao_gestante', 'gestacao_unica', 'gestacao_gemelar', 'nao_informado') THEN
    RAISE EXCEPTION 'Tipo de gestação inválido.';
  END IF;
  v_out := jsonb_build_object('tipo', v_tipo);
  IF nullif(btrim(p ->> 'observacao'), '') IS NOT NULL THEN
    v_out := v_out || jsonb_build_object('observacao', btrim(p ->> 'observacao'));
  END IF;
  IF v_tipo IN ('nao_gestante', 'nao_informado') THEN RETURN v_out; END IF;

  FOREACH k IN ARRAY ARRAY['g', 'p', 'a'] LOOP
    IF p ? k AND p -> k <> 'null'::jsonb THEN
      IF jsonb_typeof(p -> k) <> 'number' OR (p ->> k)::numeric < 0 OR (p ->> k)::numeric <> trunc((p ->> k)::numeric) THEN
        RAISE EXCEPTION '% deve ser um número inteiro.', upper(k);
      END IF;
      v_out := v_out || jsonb_build_object(k, (p ->> k)::int);
    END IF;
  END LOOP;

  IF nullif(p ->> 'dum', '') IS NOT NULL THEN
    IF coalesce((p ->> 'dum_nao_informada')::boolean, false) THEN
      RAISE EXCEPTION 'Informe a DUM ou marque "DUM não informada", não os dois.';
    END IF;
    BEGIN
      v_dum := (p ->> 'dum')::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'DUM inválida.';
    END;
    IF v_dum > p_hoje THEN RAISE EXCEPTION 'A DUM não pode ser depois de hoje.'; END IF;
    v_dias := p_hoje - v_dum;
    -- Naegele: DPP = DUM + 280 dias; IG = dias desde a DUM
    v_out := v_out || jsonb_build_object('dum', v_dum, 'dum_nao_informada', false,
      'ig_semanas', v_dias / 7, 'ig_dias', v_dias % 7, 'ig_origem', 'dum', 'dpp', v_dum + 280);
  ELSE
    v_out := v_out || jsonb_build_object('dum_nao_informada', coalesce((p ->> 'dum_nao_informada')::boolean, false));
    IF p ? 'ig_semanas' AND p -> 'ig_semanas' <> 'null'::jsonb THEN
      IF jsonb_typeof(p -> 'ig_semanas') <> 'number' OR (p ->> 'ig_semanas')::numeric < 0
         OR (p ->> 'ig_semanas')::numeric <> trunc((p ->> 'ig_semanas')::numeric) THEN
        RAISE EXCEPTION 'IG em semanas deve ser um número inteiro.';
      END IF;
      v_out := v_out || jsonb_build_object('ig_semanas', (p ->> 'ig_semanas')::int, 'ig_origem', 'informada');
    END IF;
    IF p ? 'ig_dias' AND p -> 'ig_dias' <> 'null'::jsonb THEN
      IF jsonb_typeof(p -> 'ig_dias') <> 'number' OR (p ->> 'ig_dias')::numeric NOT IN (0, 1, 2, 3, 4, 5, 6) THEN
        RAISE EXCEPTION 'IG em dias vai de 0 a 6.';
      END IF;
      v_out := v_out || jsonb_build_object('ig_dias', (p ->> 'ig_dias')::int);
    END IF;
    IF nullif(p ->> 'dpp', '') IS NOT NULL THEN
      BEGIN
        v_out := v_out || jsonb_build_object('dpp', (p ->> 'dpp')::date);
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'DPP inválida.';
      END;
    END IF;
  END IF;

  IF coalesce((p ->> 'intercorrencias')::boolean, false) THEN
    IF nullif(btrim(p ->> 'intercorrencias_texto'), '') IS NULL THEN
      RAISE EXCEPTION 'Descreva as intercorrências da gestação.';
    END IF;
    v_out := v_out || jsonb_build_object('intercorrencias', true, 'intercorrencias_texto', btrim(p ->> 'intercorrencias_texto'));
  ELSE
    v_out := v_out || jsonb_build_object('intercorrencias', false);
  END IF;
  RETURN v_out;
END $$;

REVOKE ALL ON FUNCTION private.validar_dor_triagem(jsonb, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.validar_oxigenio_triagem(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.normalizar_gestacao(jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.validar_dor_triagem(jsonb, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.validar_oxigenio_triagem(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.normalizar_gestacao(jsonb, date) TO authenticated;

-- ── classificar / reclassificar (amplia a da Fase 2.2) ──────────────────────
DROP FUNCTION IF EXISTS public.classificar_risco(uuid, text, jsonb, uuid, text, jsonb, text, text, text);

CREATE OR REPLACE FUNCTION public.classificar_risco(
  p_episodio uuid,
  p_cor text,
  p_sinais jsonb,
  p_fluxograma uuid DEFAULT NULL,
  p_discriminador text DEFAULT NULL,
  p_avaliacao jsonb DEFAULT '{}'::jsonb,
  p_publico text DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_justificativa text DEFAULT NULL,
  -- novos (opcionais)
  p_queixa text DEFAULT NULL,
  p_grupo_trocado boolean DEFAULT false,
  p_discriminador_livre boolean DEFAULT false,
  p_dor jsonb DEFAULT NULL,
  p_oxigenio jsonb DEFAULT NULL,
  p_gestacao jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  e public.episodios;
  v_nasc date;
  v_sexo text;
  v_pub_idade text;
  v_publico text;
  v_trocado boolean := false;
  v_reclass boolean;
  v_papel text;
  v_flx public.protocolo_fluxogramas;
  v_disc_cor text;
  v_livre boolean := false;
  v_id uuid;
  v_ordem text[] := ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul'];
  obrig text[];
  k text;
  v_conceito uuid;
  v_dor jsonb;
  v_oxi jsonb;
  v_gest jsonb;
  v_queixa text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  IF p_cor IS NULL OR NOT (p_cor = ANY (v_ordem)) THEN RAISE EXCEPTION 'Escolha a cor da classificação.'; END IF;

  v_reclass := e.cor_atual IS NOT NULL;
  IF NOT v_reclass THEN
    IF e.etapa <> 'triagem' THEN RAISE EXCEPTION 'Este episódio não está aguardando triagem.'; END IF;
    IF private.tenho_papel(e.unidade_id, 'enfermeiro') IS NOT TRUE THEN
      RAISE EXCEPTION 'A classificação de risco é do enfermeiro.';
    END IF;
    IF p_fluxograma IS NULL OR length(btrim(coalesce(p_discriminador, ''))) = 0 THEN
      RAISE EXCEPTION 'Informe o fluxograma e o discriminador do protocolo.';
    END IF;
    v_papel := 'enfermeiro';
  ELSE
    IF e.etapa <> 'atendimento' THEN RAISE EXCEPTION 'Só se reclassifica antes do desfecho.'; END IF;
    IF private.tenho_papel(e.unidade_id, 'plantonista') IS NOT TRUE THEN
      RAISE EXCEPTION 'Só o médico reclassifica.';
    END IF;
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
      RAISE EXCEPTION 'Informe o motivo da reclassificação (mínimo de 10 letras).';
    END IF;
    IF array_position(v_ordem, p_cor) > array_position(v_ordem, e.cor_atual)
       AND length(btrim(coalesce(p_justificativa, ''))) < 20 THEN
      RAISE EXCEPTION 'Baixar a prioridade exige justificativa (mínimo de 20 letras).';
    END IF;
    v_papel := 'plantonista';
  END IF;

  -- grupo: pela idade quando se sabe (pediatria até 13a 11m 29d); o enfermeiro
  -- pode trocar à mão (p_grupo_trocado), e isso fica registrado. Sem data de
  -- nascimento, vale o que foi informado.
  SELECT data_nascimento, sexo INTO v_nasc, v_sexo FROM public.pacientes WHERE id = e.paciente_id;
  IF v_nasc IS NOT NULL THEN
    v_pub_idade := CASE WHEN age((e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date, v_nasc) < interval '14 years'
                        THEN 'pediatrico' ELSE 'adulto' END;
  END IF;
  IF v_pub_idade IS NULL THEN
    v_publico := coalesce(p_publico, e.publico);
  ELSIF coalesce(p_grupo_trocado, false) AND p_publico IS NOT NULL AND p_publico <> v_pub_idade THEN
    v_publico := p_publico;
    v_trocado := true;
  ELSE
    v_publico := v_pub_idade;
  END IF;
  IF v_publico IS NULL OR v_publico NOT IN ('adulto', 'pediatrico') THEN
    RAISE EXCEPTION 'Sem data de nascimento: informe se é adulto ou pediatria.';
  END IF;

  -- protocolo: só referência; guarda a cor do discriminador ao lado da escolhida.
  -- Discriminador escrito pelo enfermeiro só entra com p_discriminador_livre.
  IF p_fluxograma IS NOT NULL THEN
    SELECT * INTO v_flx FROM public.protocolo_fluxogramas WHERE id = p_fluxograma;
    IF NOT FOUND THEN RAISE EXCEPTION 'Fluxograma não encontrado.'; END IF;
    IF v_flx.publico <> v_publico THEN RAISE EXCEPTION 'Fluxograma de outro público (%).', v_flx.publico; END IF;
    SELECT c.key INTO v_disc_cor
      FROM jsonb_each(v_flx.discriminadores) c, jsonb_array_elements(c.value) d
     WHERE d ->> 0 = btrim(p_discriminador) LIMIT 1;
    IF v_disc_cor IS NULL THEN
      IF NOT coalesce(p_discriminador_livre, false) THEN
        RAISE EXCEPTION 'Discriminador não pertence ao fluxograma.';
      END IF;
      IF length(btrim(coalesce(p_discriminador, ''))) < 3 THEN
        RAISE EXCEPTION 'Escreva o discriminador (mínimo de 3 letras).';
      END IF;
      v_livre := true;
    END IF;
  END IF;

  -- sinais vitais: todos obrigatórios; PA opcional na triagem pediátrica
  obrig := ARRAY['frequencia-cardiaca', 'frequencia-respiratoria', 'temperatura', 'saturacao-o2', 'escala-dor'];
  IF v_publico = 'adulto' THEN
    obrig := obrig || ARRAY['pressao-arterial-sistolica', 'pressao-arterial-diastolica'];
  END IF;
  FOREACH k IN ARRAY obrig LOOP
    IF NOT (coalesce(p_sinais, '{}') ? k) OR jsonb_typeof(p_sinais -> k) <> 'number' THEN
      RAISE EXCEPTION 'Sinal vital obrigatório ausente: %.', replace(k, '-', ' ');
    END IF;
  END LOOP;

  -- Glasgow (Anexo II do protocolo): de 3 a 15
  IF coalesce(p_avaliacao, '{}') ? 'glasgow' AND nullif(p_avaliacao ->> 'glasgow', '') IS NOT NULL THEN
    IF NOT (p_avaliacao ->> 'glasgow') ~ '^\d{1,2}$' OR (p_avaliacao ->> 'glasgow')::int NOT BETWEEN 3 AND 15 THEN
      RAISE EXCEPTION 'Glasgow vai de 3 a 15.';
    END IF;
  END IF;

  -- dor, oxigênio e gestação (opcionais; validados quando vêm)
  IF p_dor IS NOT NULL THEN
    v_dor := private.validar_dor_triagem(p_dor, (p_sinais ->> 'escala-dor')::numeric, v_publico);
  END IF;
  IF p_oxigenio IS NOT NULL THEN
    v_oxi := private.validar_oxigenio_triagem(p_oxigenio);
  END IF;
  IF p_gestacao IS NOT NULL THEN
    IF v_sexo = 'M' THEN RAISE EXCEPTION 'Gestação não se aplica a este paciente (sexo masculino no cadastro).'; END IF;
    v_gest := private.normalizar_gestacao(p_gestacao, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  END IF;
  v_queixa := coalesce(nullif(btrim(p_queixa), ''), CASE WHEN NOT v_reclass THEN e.queixa END);

  FOR k IN SELECT jsonb_object_keys(p_sinais) LOOP
    SELECT id INTO v_conceito FROM public.conceito WHERE nome = k AND (unidade_id IS NULL OR unidade_id = e.unidade_id) LIMIT 1;
    IF v_conceito IS NULL THEN RAISE EXCEPTION 'Sinal vital desconhecido: %.', k; END IF;
    INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, registrado_por, valor_num, origem)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_conceito, now(), v_perfil, (p_sinais ->> k)::numeric, 'manual');
  END LOOP;

  INSERT INTO public.classificacoes_risco
    (episodio_id, unidade_id, paciente_id, cor, publico, fluxograma_id, fluxograma_nome, discriminador,
     discriminador_cor, avaliacao, reclassificacao, motivo, justificativa, autor_id, autor_papel,
     queixa, publico_pela_idade, grupo_trocado, discriminador_livre, dor, oxigenio, gestacao)
  VALUES
    (e.id, e.unidade_id, e.paciente_id, p_cor, v_publico, v_flx.id, v_flx.nome, nullif(btrim(p_discriminador), ''),
     v_disc_cor, coalesce(p_avaliacao, '{}'), v_reclass, nullif(btrim(p_motivo), ''), nullif(btrim(p_justificativa), ''),
     v_perfil, v_papel,
     v_queixa, v_pub_idade, v_trocado, v_livre, v_dor, v_oxi, v_gest)
  RETURNING id INTO v_id;

  -- o episódio guarda o grupo da IDADE (outras telas decidem modo pediátrico
  -- por ele); a troca à mão fica só na classificação
  UPDATE public.episodios
     SET cor_atual = p_cor, publico = coalesce(v_pub_idade, v_publico), etapa = 'atendimento',
         classificado_em = coalesce(classificado_em, now()), updated_at = now()
   WHERE id = e.id;

  PERFORM private.registrar_auditoria(CASE WHEN v_reclass THEN 'reclassificar' ELSE 'classificar' END,
    'episodios', e.id, e.unidade_id, jsonb_build_object('status', p_cor, 'tipo', v_publico));
  -- (a troca de grupo e o discriminador livre ficam na própria classificação,
  -- que é só de inserção; o payload da auditoria tem lista fechada de chaves)
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.classificar_risco(uuid, text, jsonb, uuid, text, jsonb, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classificar_risco(uuid, text, jsonb, uuid, text, jsonb, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb) TO authenticated;

-- ── histórico de classificações do episódio, com autor e sinais ─────────────
-- Mesmo acesso da leitura de classificacoes_risco (plantão na porta ou gestor,
-- segundo fator, prontuário aberto). Na triagem o enfermeiro ainda não abriu o
-- prontuário: enquanto o episódio aguarda triagem, basta estar de plantão na
-- porta (é quem vai classificar — classificar_risco também não pede).
CREATE OR REPLACE FUNCTION public.classificacoes_do_episodio(p_episodio uuid)
RETURNS TABLE(
  id uuid, cor text, publico text, publico_pela_idade text, grupo_trocado boolean,
  fluxograma_nome text, discriminador text, discriminador_cor text, discriminador_livre boolean,
  queixa text, reclassificacao boolean, motivo text, justificativa text,
  autor_nome text, autor_papel text, criado_em timestamptz,
  dor jsonb, oxigenio jsonb, gestacao jsonb, avaliacao jsonb, sinais jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.episodios;
BEGIN
  SELECT * INTO e FROM public.episodios WHERE episodios.id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF private.segundo_fator_ok() IS NOT TRUE
     OR NOT (private.eh_super_admin()
             OR private.papel_na_unidade(e.unidade_id) = 'gestor'
             OR e.setor_id IN (SELECT private.setores_na_escala_agora()))
     OR NOT (e.etapa = 'triagem' OR private.prontuario_aberto(e.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT c.id, c.cor, c.publico, c.publico_pela_idade, c.grupo_trocado,
         c.fluxograma_nome, c.discriminador, c.discriminador_cor, c.discriminador_livre,
         c.queixa, c.reclassificacao, c.motivo, c.justificativa,
         pf.nome_completo, c.autor_papel, c.criado_em,
         c.dor, c.oxigenio, c.gestacao, c.avaliacao,
         (SELECT jsonb_object_agg(cc.nome, o.valor_num)
            FROM public.observacao o JOIN public.conceito cc ON cc.id = o.conceito_id
           WHERE o.episodio_id = c.episodio_id AND o.aferido_em = c.criado_em AND o.registrado_por = c.autor_id)
    FROM public.classificacoes_risco c
    LEFT JOIN public.perfis pf ON pf.id = c.autor_id
   WHERE c.episodio_id = p_episodio
   ORDER BY c.criado_em DESC;
END $$;
REVOKE ALL ON FUNCTION public.classificacoes_do_episodio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classificacoes_do_episodio(uuid) TO authenticated;
