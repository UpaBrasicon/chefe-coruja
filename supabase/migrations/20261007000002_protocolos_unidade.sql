-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 8 — Protocolos do gestor (P/index.html 8078–8160):
-- classificação de risco e protocolos de prescrição da unidade.
--
-- Conteúdo clínico nunca entra sem fonte (ADR 0007). O protocolo da unidade
-- é referência: o sistema não o inventa, não sugere cor e não troca a do
-- enfermeiro.
--
-- 1. CLASSIFICAÇÃO — revisão dos fluxogramas pela unidade. Os fluxogramas
--    são os transcritos do documento (protocolo_fluxogramas, carga em
--    supabase/dados/). A unidade revisa cada um: "mantido" (vale o original)
--    ou "alterado" (vale a lista de discriminadores da unidade). Alterar
--    exige a FONTE: o documento da unidade que traz a mudança (nome, versão,
--    data). Sem revisão, vale o original ("em revisão"). Cada decisão é uma
--    linha nova; a anterior sai de vigência e não se apaga. A triagem passa a
--    ler os discriminadores efetivos da unidade, e classificar_risco confere
--    o discriminador contra eles.
--    A idade da pediatria na triagem NÃO é configurável por unidade (o
--    protótipo tinha o campo): no produto é uma regra só, do nascimento até
--    antes dos 14 anos, em toda regra que dependa de idade (produto/
--    CONTEXT.md, "Pediatria"; src/domain/idade.ts).
--
-- 2. PRESCRIÇÃO — os protocolos de receita (receita_protocolos, onda 6)
--    ganham a FONTE e a versão obrigatórias para publicar (ativo); rascunho
--    (inativo) pode ficar sem. Cada gravação guarda uma versão (só inserção),
--    para "Publicar nova versão" não apagar a anterior.
--
-- SECURITY DEFINER, search_path vazio, segundo fator na escrita. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. revisão dos fluxogramas pela unidade ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classificacao_fluxograma_unidade (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  fluxograma_id   uuid NOT NULL REFERENCES public.protocolo_fluxogramas(id) ON DELETE CASCADE,
  estado          text NOT NULL CHECK (estado IN ('mantido', 'alterado')),
  -- só quando alterado: {"vermelho":[["discriminador","descrição"],…], …}
  discriminadores jsonb,
  fonte           text,
  definido_por    uuid NOT NULL REFERENCES public.perfis(id),
  definido_em     timestamptz NOT NULL DEFAULT clock_timestamp(),
  vigente_ate     timestamptz,
  CHECK ((estado = 'alterado') = (discriminadores IS NOT NULL)),
  CHECK (estado <> 'alterado' OR length(btrim(coalesce(fonte, ''))) >= 10)
);
CREATE UNIQUE INDEX IF NOT EXISTS classificacao_fluxograma_unidade_vigente
  ON public.classificacao_fluxograma_unidade (unidade_id, fluxograma_id) WHERE vigente_ate IS NULL;
ALTER TABLE public.classificacao_fluxograma_unidade ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.classificacao_fluxograma_unidade FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.classificacao_fluxograma_unidade FROM authenticated;
GRANT SELECT ON public.classificacao_fluxograma_unidade TO authenticated;
DROP POLICY IF EXISTS classificacao_fluxograma_unidade_select ON public.classificacao_fluxograma_unidade;
CREATE POLICY classificacao_fluxograma_unidade_select ON public.classificacao_fluxograma_unidade
  FOR SELECT TO authenticated USING (private.membro_da_unidade(unidade_id));
DROP TRIGGER IF EXISTS trg_classificacao_fluxograma_sem_delete ON public.classificacao_fluxograma_unidade;
CREATE TRIGGER trg_classificacao_fluxograma_sem_delete BEFORE DELETE ON public.classificacao_fluxograma_unidade
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
COMMENT ON TABLE public.classificacao_fluxograma_unidade IS
  'Revisão de cada fluxograma do protocolo de classificação pela unidade: mantido (vale o original) ou alterado (vale a lista da unidade, com a fonte). Só inserção; vigente_ate fecha a anterior.';

-- discriminadores que valem na unidade para um fluxograma
CREATE OR REPLACE FUNCTION private.discriminadores_efetivos(p_unidade uuid, p_fluxograma uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT r.discriminadores FROM public.classificacao_fluxograma_unidade r
      WHERE r.unidade_id = p_unidade AND r.fluxograma_id = p_fluxograma AND r.vigente_ate IS NULL AND r.estado = 'alterado'),
    (SELECT f.discriminadores FROM public.protocolo_fluxogramas f WHERE f.id = p_fluxograma))
$$;
REVOKE ALL ON FUNCTION private.discriminadores_efetivos(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.discriminadores_efetivos(uuid, uuid) TO authenticated;

-- lista de discriminadores válida: só as cinco cores, cada item [texto, descrição];
-- o mesmo discriminador pode aparecer em cores diferentes (o documento tem casos assim)
CREATE OR REPLACE FUNCTION private.normalizar_discriminadores(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  cores text[] := ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul'];
  c text; it jsonb; lista jsonb; saida jsonb := '{}'::jsonb; total int := 0; txt text; vistos text[] := '{}';
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RAISE EXCEPTION 'Discriminadores em formato inválido.'; END IF;
  FOR c IN SELECT jsonb_object_keys(p) LOOP
    IF NOT (c = ANY (cores)) THEN RAISE EXCEPTION 'Cor desconhecida: %.', c; END IF;
  END LOOP;
  FOREACH c IN ARRAY cores LOOP
    lista := '[]'::jsonb;
    vistos := '{}';
    IF p ? c THEN
      IF jsonb_typeof(p -> c) <> 'array' THEN RAISE EXCEPTION 'Discriminadores em formato inválido (%).', c; END IF;
      FOR it IN SELECT * FROM jsonb_array_elements(p -> c) LOOP
        txt := btrim(CASE WHEN jsonb_typeof(it) = 'array' THEN it ->> 0 ELSE it #>> '{}' END);
        IF txt IS NULL OR txt = '' THEN CONTINUE; END IF;
        IF length(txt) < 3 OR length(txt) > 200 THEN RAISE EXCEPTION 'Discriminador deve ter de 3 a 200 letras: "%".', txt; END IF;
        IF lower(txt) = ANY (vistos) THEN RAISE EXCEPTION 'Discriminador repetido na mesma cor: "%".', txt; END IF;
        vistos := vistos || lower(txt);
        lista := lista || jsonb_build_array(jsonb_build_array(txt,
                   CASE WHEN jsonb_typeof(it) = 'array' THEN left(coalesce(btrim(it ->> 1), ''), 600) ELSE '' END));
        total := total + 1;
      END LOOP;
    END IF;
    IF jsonb_array_length(lista) > 0 THEN saida := saida || jsonb_build_object(c, lista); END IF;
  END LOOP;
  IF total = 0 THEN RAISE EXCEPTION 'O fluxograma precisa de ao menos um discriminador.'; END IF;
  RETURN saida;
END $$;

-- o protocolo como a unidade o usa (triagem e tela do gestor)
CREATE OR REPLACE FUNCTION public.protocolo_classificacao_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_prot public.protocolos_classificacao;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT (private.eh_super_admin() OR private.membro_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT p.* INTO v_prot FROM public.protocolos_classificacao p
    JOIN public.unidades u ON u.protocolo_classificacao_id = p.id WHERE u.id = p_unidade;
  IF v_prot.id IS NULL THEN
    RETURN jsonb_build_object('protocolo', NULL, 'fluxogramas', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'protocolo', jsonb_build_object('id', v_prot.id, 'codigo', v_prot.codigo, 'fonte', v_prot.fonte, 'tempos', v_prot.tempos),
    'fluxogramas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', f.id, 'protocolo_id', f.protocolo_id, 'ordem', f.ordem, 'nome', f.nome, 'publico', f.publico, 'inclui', f.inclui,
               'discriminadores', CASE WHEN r.estado = 'alterado' THEN r.discriminadores ELSE f.discriminadores END,
               'original', f.discriminadores,
               'estado', coalesce(r.estado, 'revisao'),
               'fonte_alteracao', r.fonte,
               'definido_por', pr.nome_completo, 'definido_em', r.definido_em)
             ORDER BY f.publico, f.ordem)
        FROM public.protocolo_fluxogramas f
        LEFT JOIN public.classificacao_fluxograma_unidade r
               ON r.fluxograma_id = f.id AND r.unidade_id = p_unidade AND r.vigente_ate IS NULL
        LEFT JOIN public.perfis pr ON pr.id = r.definido_por
       WHERE f.protocolo_id = v_prot.id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.protocolo_classificacao_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protocolo_classificacao_da_unidade(uuid) TO authenticated;

-- p_acao: 'manter' (vale o original), 'alterar' (vale p_discriminadores, com
-- p_fonte) ou 'reabrir' (volta a "em revisão", vale o original)
CREATE OR REPLACE FUNCTION public.revisar_fluxograma(
  p_unidade uuid, p_fluxograma uuid, p_acao text, p_discriminadores jsonb DEFAULT NULL, p_fonte text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_flx public.protocolo_fluxogramas;
  v_disc jsonb;
  v_estado text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade revisa o protocolo de classificação.'; END IF;
  SELECT f.* INTO v_flx FROM public.protocolo_fluxogramas f
    JOIN public.unidades u ON u.protocolo_classificacao_id = f.protocolo_id
   WHERE f.id = p_fluxograma AND u.id = p_unidade;
  IF v_flx.id IS NULL THEN RAISE EXCEPTION 'Fluxograma não pertence ao protocolo da unidade.'; END IF;
  IF p_acao NOT IN ('manter', 'alterar', 'reabrir') THEN RAISE EXCEPTION 'Ação desconhecida: %.', p_acao; END IF;

  IF p_acao = 'alterar' THEN
    v_disc := private.normalizar_discriminadores(p_discriminadores);
    IF v_disc = private.normalizar_discriminadores(v_flx.discriminadores) THEN
      v_estado := 'mantido';   -- igual ao original: é manter
      v_disc := NULL;
    ELSE
      IF length(btrim(coalesce(p_fonte, ''))) < 10 THEN
        RAISE EXCEPTION 'Alterar o fluxograma exige a fonte: o documento da unidade com nome, versão e data (mínimo de 10 letras).';
      END IF;
      v_estado := 'alterado';
    END IF;
  ELSIF p_acao = 'manter' THEN
    v_estado := 'mantido';
  END IF;

  UPDATE public.classificacao_fluxograma_unidade SET vigente_ate = clock_timestamp()
   WHERE unidade_id = p_unidade AND fluxograma_id = p_fluxograma AND vigente_ate IS NULL;
  IF p_acao <> 'reabrir' THEN
    INSERT INTO public.classificacao_fluxograma_unidade (unidade_id, fluxograma_id, estado, discriminadores, fonte, definido_por)
    VALUES (p_unidade, p_fluxograma, v_estado, v_disc, CASE WHEN v_estado = 'alterado' THEN btrim(p_fonte) END, private.meu_perfil_id());
  END IF;
  PERFORM private.registrar_auditoria('revisar_fluxograma', 'protocolo_fluxogramas', p_fluxograma, p_unidade,
    jsonb_build_object('status', coalesce(v_estado, 'revisao')));
  RETURN coalesce(v_estado, 'revisao');
END $$;
REVOKE ALL ON FUNCTION public.revisar_fluxograma(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revisar_fluxograma(uuid, uuid, text, jsonb, text) TO authenticated;

-- ── classificar_risco passa a conferir o discriminador contra a unidade ────
-- Igual à da migration 20261003000004, com uma diferença: o discriminador e a
-- cor de referência vêm de private.discriminadores_efetivos (a revisão da
-- unidade), não do texto original.
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
  -- Os discriminadores são os que valem NA UNIDADE (revisão do gestor).
  -- Discriminador escrito pelo enfermeiro só entra com p_discriminador_livre.
  IF p_fluxograma IS NOT NULL THEN
    SELECT * INTO v_flx FROM public.protocolo_fluxogramas WHERE id = p_fluxograma;
    IF NOT FOUND THEN RAISE EXCEPTION 'Fluxograma não encontrado.'; END IF;
    IF v_flx.publico <> v_publico THEN RAISE EXCEPTION 'Fluxograma de outro público (%).', v_flx.publico; END IF;
    SELECT c.key INTO v_disc_cor
      FROM jsonb_each(private.discriminadores_efetivos(e.unidade_id, v_flx.id)) c, jsonb_array_elements(c.value) d
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
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.classificar_risco(uuid, text, jsonb, uuid, text, jsonb, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classificar_risco(uuid, text, jsonb, uuid, text, jsonb, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb) TO authenticated;

-- ── 2. protocolos de prescrição: fonte e versões ───────────────────────────
ALTER TABLE public.receita_protocolos ADD COLUMN IF NOT EXISTS fonte text
  CHECK (fonte IS NULL OR length(fonte) <= 300);

CREATE TABLE IF NOT EXISTS public.receita_protocolos_versoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id  uuid NOT NULL REFERENCES public.receita_protocolos(id) ON DELETE CASCADE,
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  indicacao     text,
  versao        text,
  fonte         text,
  itens         jsonb NOT NULL,
  ativo         boolean NOT NULL,
  gravado_por   uuid REFERENCES public.perfis(id),
  gravado_em    timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS receita_protocolos_versoes_prot ON public.receita_protocolos_versoes (protocolo_id, gravado_em DESC);
ALTER TABLE public.receita_protocolos_versoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.receita_protocolos_versoes FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_receita_protocolos_versoes_so_insercao ON public.receita_protocolos_versoes;
CREATE TRIGGER trg_receita_protocolos_versoes_so_insercao BEFORE UPDATE OR DELETE ON public.receita_protocolos_versoes
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

CREATE OR REPLACE FUNCTION public.receita_protocolos_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'indicacao', r.indicacao, 'versao', r.versao,
                                                       'fonte', r.fonte, 'itens', r.itens, 'ativo', r.ativo,
                                                       'atualizado_em', r.atualizado_em,
                                                       'atualizado_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = r.atualizado_por),
                                                       'versoes', (SELECT count(*) FROM public.receita_protocolos_versoes v WHERE v.protocolo_id = r.id))
                                    ORDER BY r.nome)
                     FROM public.receita_protocolos r WHERE r.unidade_id = p_unidade), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.receita_protocolos_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receita_protocolos_da_unidade(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.salvar_receita_protocolo(uuid, text, text, jsonb, uuid, boolean, text);
CREATE OR REPLACE FUNCTION public.salvar_receita_protocolo(
  p_unidade uuid, p_nome text, p_indicacao text, p_itens jsonb, p_protocolo uuid DEFAULT NULL, p_ativo boolean DEFAULT true,
  p_versao text DEFAULT NULL, p_fonte text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  it jsonb;
  v_itens jsonb := '[]'::jsonb;
  v_id uuid;
  r public.receita_protocolos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade escreve os protocolos de receita.'; END IF;
  IF length(btrim(coalesce(p_nome, ''))) < 2 THEN RAISE EXCEPTION 'Dê um nome ao protocolo.'; END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'O protocolo precisa de ao menos um medicamento.';
  END IF;
  IF coalesce(p_ativo, true) THEN
    IF length(btrim(coalesce(p_fonte, ''))) < 10 THEN
      RAISE EXCEPTION 'Publicar exige a fonte: o protocolo ou a diretriz da unidade, com versão e data (mínimo de 10 letras).';
    END IF;
    IF length(btrim(coalesce(p_versao, ''))) = 0 THEN RAISE EXCEPTION 'Publicar exige a versão do protocolo.'; END IF;
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    IF length(btrim(coalesce(it ->> 'medicamento', ''))) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Medicamento do protocolo sem nome.'; END IF;
    IF length(btrim(coalesce(it ->> 'posologia', ''))) NOT BETWEEN 3 AND 300 THEN
      RAISE EXCEPTION 'Escreva a posologia de %.', it ->> 'medicamento';
    END IF;
    IF length(coalesce(it ->> 'quantidade', '')) > 80 THEN RAISE EXCEPTION 'Quantidade longa demais.'; END IF;
    v_itens := v_itens || jsonb_build_object('medicamento', btrim(it ->> 'medicamento'), 'posologia', btrim(it ->> 'posologia'),
                                             'quantidade', coalesce(btrim(it ->> 'quantidade'), ''));
  END LOOP;
  IF p_protocolo IS NULL THEN
    INSERT INTO public.receita_protocolos (unidade_id, nome, indicacao, versao, fonte, itens, ativo, atualizado_por)
    VALUES (p_unidade, btrim(p_nome), nullif(btrim(p_indicacao), ''), nullif(btrim(p_versao), ''), nullif(btrim(p_fonte), ''),
            v_itens, coalesce(p_ativo, true), private.meu_perfil_id())
    ON CONFLICT (unidade_id, nome) DO UPDATE SET indicacao = EXCLUDED.indicacao, versao = EXCLUDED.versao, fonte = EXCLUDED.fonte,
      itens = EXCLUDED.itens, ativo = EXCLUDED.ativo, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()
    RETURNING * INTO r;
  ELSE
    UPDATE public.receita_protocolos
       SET nome = btrim(p_nome), indicacao = nullif(btrim(p_indicacao), ''), versao = nullif(btrim(p_versao), ''),
           fonte = nullif(btrim(p_fonte), ''), itens = v_itens,
           ativo = coalesce(p_ativo, true), atualizado_por = private.meu_perfil_id(), atualizado_em = now()
     WHERE id = p_protocolo AND unidade_id = p_unidade
    RETURNING * INTO r;
    IF r.id IS NULL THEN RAISE EXCEPTION 'Protocolo não encontrado nesta unidade.'; END IF;
  END IF;
  INSERT INTO public.receita_protocolos_versoes (protocolo_id, unidade_id, nome, indicacao, versao, fonte, itens, ativo, gravado_por)
  VALUES (r.id, r.unidade_id, r.nome, r.indicacao, r.versao, r.fonte, r.itens, r.ativo, private.meu_perfil_id());
  RETURN r.id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_receita_protocolo(uuid, text, text, jsonb, uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_receita_protocolo(uuid, text, text, jsonb, uuid, boolean, text, text) TO authenticated;
