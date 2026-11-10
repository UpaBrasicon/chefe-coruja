-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 5 do Portão de 11/10/2026: registro do óbito para o prontuário.
-- Diagnóstico e decisão do RT (10/11/2026, A em O1 a O8):
--   docs/porta/LACUNA-05-OBITO-DIAGNOSTICO.md
-- O registro é SÓ do prontuário. A Declaração de Óbito (D.O.) que vale é o
-- formulário do Ministério da Saúde, em 3 vias (branca, amarela e rosa). O app
-- não imprime nada parecido com a D.O.: guarda o número, as causas como o
-- médico escreveu e o destino de cada via.
--
-- Fontes (texto conferido em 10/11/2026):
--   - Portaria SVS/MS nº 116/2009: art. 13 (a unidade responde pela série de
--     D.O. recebida da SMS), art. 17 (emite o médico assistente ou substituto;
--     causa externa, o IML), art. 20 (óbito natural no estabelecimento: 1ª via,
--     branca, para a SMS; 2ª, amarela, para a família; 3ª, rosa, no
--     prontuário), arts. 22 (SVO), 25 e 26 (causa externa, IML).
--   - MS, "Declaração de Óbito: manual de instruções para preenchimento",
--     1ª ed., 2022: número de 9 algarismos, o último é dígito verificador (o
--     manual não dá o algoritmo: aqui só o tamanho é conferido); causas na
--     Parte I, linhas a a d, e na Parte II, em texto; o médico não codifica a
--     CID; sem SVO, a Parte I leva "causa da morte desconhecida".
--   - MS/CFM/CBCD, "A Declaração de Óbito: documento necessário e importante",
--     3ª ed., 2009: o médico não usa termos vagos como "parada cardíaca",
--     "parada cardiorrespiratória" ou "falência de múltiplos órgãos" (e, nos
--     exemplos de erro, "parada respiratória" e "falência múltipla dos
--     órgãos"). Aqui viram aviso, não bloqueio.
--   - Resolução CFM nº 1.779/2005, art. 2º: morte natural com assistência,
--     atesta o médico da unidade (assistente ou substituto); sem assistência,
--     o SVO (onde não há SVO, o médico do serviço público mais próximo); morte
--     violenta ou não natural, os serviços médico-legais (IML).
--   - Código de Ética Médica (Res. CFM 2.217/2018), art. 83: só atesta quem
--     verificou o óbito pessoalmente (o atestante é o login).
--   - Parecer COREN-SP 003/2016: o enfermeiro também comunica o óbito à
--     família, depois da constatação médica.
--
-- O que faz:
--   O1  public.obitos: um registro por óbito, o mesmo vindo da porta
--       (registrar_desfecho), da observação (finalizar_observacao, que chama
--       dar_alta) e da internação (dar_alta). Um validador só
--       (private.obito_validado) e um registro só (private.registrar_obito).
--       Os jsonb desfecho_detalhes e alta_detalhes continuam com hora_obito e
--       numero_do, como antes, e ganham obito_id, tipo_morte e encaminhamento.
--       public.conferir_obito devolve erro e avisos para a tela, sem gravar.
--   O2  o "Sumário de óbito" (documentos_clinicos, tipo sumario_obito) sai
--       sozinho no registro, com a frase de que é registro do prontuário.
--   O3  tipo de morte e caminho: natural com assistência (a unidade atesta;
--       D.O. obrigatória), natural sem assistência ou a esclarecer (SVO, ou
--       D.O. da unidade com "causa da morte desconhecida"), violenta ou
--       suspeita (IML; comunicação à polícia; a unidade não emite D.O.).
--   O4  public.obito_comunicacoes: quem comunicou à família (médico ou
--       enfermeiro), a quem, quando, como e testemunha. Leitura e escrita só
--       pelas RPCs; a auditoria leva só ids e códigos.
--   O5  conferência da identificação do corpo e liberação (funerária, SVO ou
--       IML). O leito do óbito fica "ocupado" com a marca
--       leitos.obito_aguardando_id ("aguardando liberação do corpo") e só vai
--       para a higienização quando o corpo é liberado. Não é um valor novo no
--       enum status_leito: o Postgres não deixa usar um valor de enum na mesma
--       transação em que nasce, e as telas e contas que leem 'ocupado' já
--       tratam o leito como indisponível.
--   O6  médico atesta e escolhe o tipo de morte; médico ou enfermeiro
--       comunicam à família e à polícia; enfermagem ou recepção conferem e
--       liberam o corpo; vias: médico, enfermagem ou recepção.
--   O7  prontuario_leitura ganha a chave obitos; obitos_pendentes lista o que
--       falta (comunicação, polícia, identificação, liberação, vias).
--   O8  cancelar_alta (até 24 h) anula o óbito, as comunicações e o sumário
--       (nada é apagado) e devolve o leito ao paciente.
--
-- Funções trocadas trecho a trecho pelo texto atual (pg_get_functiondef),
-- como em 20270325000001: trecho que sumiu para a migration com erro; trecho
-- já trocado é pulado (reaplicável). Conferido em 10/11/2026 na homologação:
-- registrar_desfecho, dar_alta, registrar_evento_adt, cancelar_alta,
-- situacao_leitos, liberar_leito_sem_paciente, mapa_leitos_gestor e
-- prontuario_leitura (mesma assinatura em todas).
--
-- Só expande: tabelas, coluna, funções e índices novos; a CHECK de
-- eventos_leito.tipo_evento fica maior.
-- Teste: supabase/tests/obito.sql
--
-- Rollback (testado na homologação, em transação desfeita; o md5 das funções
-- trocadas volta ao de antes): o bloco comentado no fim deste arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── O1: o registro ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.obitos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id             uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id            uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id            uuid REFERENCES public.episodios(id),
  internacao_id          uuid REFERENCES public.internacoes(id),
  origem                 text NOT NULL CHECK (origem IN ('porta', 'observacao', 'internacao')),
  setor_id               uuid REFERENCES public.setores(id),
  -- o leito em que o corpo ficou (vazio na porta)
  leito_id               uuid REFERENCES public.leitos(id),
  hora_obito             timestamptz NOT NULL,
  -- O3 (Res. CFM 1.779/2005, art. 2º)
  tipo_morte             text NOT NULL CHECK (tipo_morte IN ('natural_assistida', 'natural_sem_assistencia_ou_a_esclarecer', 'violenta_ou_suspeita')),
  -- unidade: a unidade atesta; svo: o SVO atesta; causa_desconhecida: sem SVO,
  -- a unidade atesta com "causa da morte desconhecida"; iml: o IML atesta
  encaminhamento         text NOT NULL CHECK (encaminhamento IN ('unidade', 'svo', 'causa_desconhecida', 'iml')),
  -- 9 algarismos (manual MS 2022); só quando a unidade emite a D.O.
  numero_do              text CHECK (numero_do ~ '^\d{9}$'),
  atestado_por           uuid REFERENCES public.perfis(id),
  atestado_condicao      text CHECK (atestado_condicao IN ('assistente', 'substituto')),
  causa_a                text CHECK (length(causa_a) <= 500),
  causa_b                text CHECK (length(causa_b) <= 500),
  causa_c                text CHECK (length(causa_c) <= 500),
  causa_d                text CHECK (length(causa_d) <= 500),
  parte2                 text CHECK (length(parte2) <= 1000),
  -- CID interno (faturamento e indicadores); não substitui as causas em texto
  cid_interno            text,
  avisos                 text[] NOT NULL DEFAULT '{}',
  relato                 text,
  policia_comunicada_em  timestamptz,
  policia_comunicada_por uuid REFERENCES public.perfis(id),
  policia_ocorrencia     text CHECK (length(policia_ocorrencia) <= 60),
  via_branca_em          timestamptz,
  via_branca_por         uuid REFERENCES public.perfis(id),
  via_amarela_em         timestamptz,
  via_amarela_por        uuid REFERENCES public.perfis(id),
  via_rosa_em            timestamptz,
  via_rosa_por           uuid REFERENCES public.perfis(id),
  identificacao_meio     text CHECK (identificacao_meio IN ('pulseira', 'documento', 'pulseira_e_documento')),
  identificacao_em       timestamptz,
  identificacao_por      uuid REFERENCES public.perfis(id),
  liberacao_destino      text CHECK (liberacao_destino IN ('funeraria', 'svo', 'iml')),
  liberado_em            timestamptz,
  liberado_por           uuid REFERENCES public.perfis(id),
  documento_id           uuid REFERENCES public.documentos_clinicos(id),
  registrado_por         uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em          timestamptz NOT NULL DEFAULT now(),
  anulado_em             timestamptz,
  anulado_por            uuid REFERENCES public.perfis(id),
  motivo_anulacao        text,
  CONSTRAINT obitos_caminho CHECK (
    (tipo_morte = 'natural_assistida' AND encaminhamento = 'unidade')
    OR (tipo_morte = 'natural_sem_assistencia_ou_a_esclarecer' AND encaminhamento IN ('svo', 'causa_desconhecida'))
    OR (tipo_morte = 'violenta_ou_suspeita' AND encaminhamento = 'iml')),
  -- a D.O. da unidade: número e atestante só quando a unidade atesta
  CONSTRAINT obitos_do_da_unidade CHECK (
    (encaminhamento IN ('unidade', 'causa_desconhecida')) = (numero_do IS NOT NULL AND atestado_por IS NOT NULL AND atestado_condicao IS NOT NULL)),
  CONSTRAINT obitos_policia CHECK (policia_comunicada_em IS NULL OR tipo_morte = 'violenta_ou_suspeita'),
  CONSTRAINT obitos_vias CHECK (numero_do IS NOT NULL OR (via_branca_em IS NULL AND via_amarela_em IS NULL AND via_rosa_em IS NULL)),
  CONSTRAINT obitos_liberacao CHECK (liberado_em IS NULL OR identificacao_em IS NOT NULL),
  CONSTRAINT obitos_anulacao CHECK (anulado_em IS NULL OR (anulado_por IS NOT NULL AND length(btrim(motivo_anulacao)) >= 10))
);
COMMENT ON TABLE public.obitos IS
  'Lacuna 5: o óbito para o prontuário (um por paciente, fora os anulados). A D.O. é o formulário do Ministério da Saúde; aqui ficam o número, as causas em texto e o destino das vias. Leitura e escrita só pelas RPCs.';
COMMENT ON COLUMN public.obitos.encaminhamento IS
  'unidade: a unidade atesta; svo: o SVO atesta; causa_desconhecida: sem SVO, a unidade atesta com "causa da morte desconhecida"; iml: o IML atesta (Res. CFM 1.779/2005, art. 2º).';
CREATE UNIQUE INDEX IF NOT EXISTS obitos_um_por_paciente ON public.obitos (paciente_id) WHERE anulado_em IS NULL;
-- a série é numerada e única (Portaria 116/2009, art. 12)
CREATE UNIQUE INDEX IF NOT EXISTS obitos_numero_do_vigente ON public.obitos (numero_do) WHERE numero_do IS NOT NULL AND anulado_em IS NULL;
CREATE INDEX IF NOT EXISTS obitos_unidade_pendentes ON public.obitos (unidade_id, hora_obito DESC) WHERE anulado_em IS NULL;
CREATE INDEX IF NOT EXISTS obitos_episodio_id_fk_idx ON public.obitos (episodio_id);
CREATE INDEX IF NOT EXISTS obitos_internacao_id_fk_idx ON public.obitos (internacao_id);
CREATE INDEX IF NOT EXISTS obitos_setor_id_fk_idx ON public.obitos (setor_id);
CREATE INDEX IF NOT EXISTS obitos_leito_id_fk_idx ON public.obitos (leito_id);
CREATE INDEX IF NOT EXISTS obitos_documento_id_fk_idx ON public.obitos (documento_id);
CREATE INDEX IF NOT EXISTS obitos_unidade_id_fk_idx ON public.obitos (unidade_id);

-- D.O. anulada ou rasurada (manual MS 2022: sem ressalva possível, o
-- formulário é anulado e devolvido à SMS): o número velho, o motivo e o novo
CREATE TABLE IF NOT EXISTS public.obito_do_anuladas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obito_id       uuid NOT NULL REFERENCES public.obitos(id),
  numero_anulado text NOT NULL CHECK (numero_anulado ~ '^\d{9}$'),
  numero_novo    text NOT NULL CHECK (numero_novo ~ '^\d{9}$'),
  motivo         text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  registrado_por uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS obito_do_anuladas_obito ON public.obito_do_anuladas (obito_id);

-- O4: comunicação à família. Nome e parentesco ficam aqui, nunca na auditoria.
CREATE TABLE IF NOT EXISTS public.obito_comunicacoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obito_id          uuid NOT NULL REFERENCES public.obitos(id),
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id),
  comunicado_por    uuid NOT NULL REFERENCES public.perfis(id),
  papel             text NOT NULL CHECK (papel IN ('plantonista', 'enfermeiro')),
  destinatario_nome text NOT NULL CHECK (length(btrim(destinatario_nome)) BETWEEN 3 AND 120),
  parentesco        text NOT NULL CHECK (length(btrim(parentesco)) BETWEEN 3 AND 60),
  comunicado_em     timestamptz NOT NULL,
  meio              text NOT NULL CHECK (meio IN ('presencial', 'telefone')),
  testemunha        text CHECK (length(testemunha) <= 120),
  registrado_em     timestamptz NOT NULL DEFAULT now(),
  anulado_em        timestamptz
);
COMMENT ON TABLE public.obito_comunicacoes IS
  'Lacuna 5 (O4): quem comunicou o óbito à família (médico ou enfermeiro, Parecer COREN-SP 003/2016), a quem, quando e como. Dado de pessoa: leitura só pelas RPCs.';
CREATE INDEX IF NOT EXISTS obito_comunicacoes_obito ON public.obito_comunicacoes (obito_id);
CREATE INDEX IF NOT EXISTS obito_comunicacoes_unidade_id_fk_idx ON public.obito_comunicacoes (unidade_id);

-- leitura e escrita só pelas RPCs (há nome de paciente, de familiar e de profissional)
ALTER TABLE public.obitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obito_do_anuladas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obito_comunicacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.obitos FROM anon, authenticated;
REVOKE ALL ON public.obito_do_anuladas FROM anon, authenticated;
REVOKE ALL ON public.obito_comunicacoes FROM anon, authenticated;

-- ── O5: o leito espera a liberação do corpo ─────────────────────────────────
ALTER TABLE public.leitos ADD COLUMN IF NOT EXISTS obito_aguardando_id uuid REFERENCES public.obitos(id);
COMMENT ON COLUMN public.leitos.obito_aguardando_id IS
  'Lacuna 5 (O5): o leito segue "ocupado" com o corpo até a liberação (aguardando liberação do corpo). Escrita só pelas RPCs do óbito.';
CREATE INDEX IF NOT EXISTS leitos_obito_aguardando ON public.leitos (obito_aguardando_id) WHERE obito_aguardando_id IS NOT NULL;
-- o evento do leito no óbito (a liberação usa o tipo 'liberacao', que já existe)
ALTER TABLE public.eventos_leito DROP CONSTRAINT IF EXISTS eventos_leito_tipo_evento_check;
ALTER TABLE public.eventos_leito ADD CONSTRAINT eventos_leito_tipo_evento_check CHECK (tipo_evento = ANY (ARRAY[
  'reserva', 'cancelamento_reserva', 'ocupacao', 'liberacao', 'higienizacao', 'higienizacao_concluida',
  'bloqueio', 'desbloqueio', 'aguardando_corpo'])) NOT VALID;
ALTER TABLE public.eventos_leito VALIDATE CONSTRAINT eventos_leito_tipo_evento_check;

-- ── O1: termos vagos (aviso, MS/CFM 2009) ───────────────────────────────────
-- Só os termos citados na fonte: "parada cardíaca", "parada respiratória",
-- "parada cardiorrespiratória" e "falência de múltiplos órgãos" (também
-- escrito "falência múltipla dos órgãos").
CREATE OR REPLACE FUNCTION private.obito_termos_vagos(p_texto text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(array_agg(r.rotulo ORDER BY r.ordem), '{}')
    FROM (SELECT translate(lower(coalesce(p_texto, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') AS x) t,
         (VALUES (1, 'parada cardiorrespiratória', 'parada\s+cardio\s*-?\s*r?respiratoria'),
                 (2, 'parada cardíaca', 'parada\s+cardiaca'),
                 (3, 'parada respiratória', 'parada\s+respiratoria'),
                 (4, 'falência de múltiplos órgãos', 'falencia\s+(de\s+)?multipl[ao]s?\s+(de\s+|dos\s+)?orgaos')) r(ordem, rotulo, padrao)
   WHERE t.x ~ r.padrao
$$;
REVOKE ALL ON FUNCTION private.obito_termos_vagos(text) FROM PUBLIC, anon, authenticated;

-- ── O1/O3: o validador único ────────────────────────────────────────────────
-- d: o jsonb do desfecho ou da alta. hora_obito e numero_do no primeiro nível
-- (como antes); o resto em d -> 'obito': tipo_morte, encaminhamento (só sem
-- assistência: svo ou causa_desconhecida), atestado_condicao, causa_a a
-- causa_d, parte2, policia_comunicada_em e policia_ocorrencia.
-- p_desde: chegada (porta) ou admissão (observação e internação).
CREATE OR REPLACE FUNCTION private.obito_validado(d jsonb, p_desde timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  o jsonb := CASE WHEN jsonb_typeof(d -> 'obito') = 'object' THEN d -> 'obito' ELSE '{}'::jsonb END;
  v_hora timestamptz;
  v_tipo text := nullif(btrim(coalesce(o ->> 'tipo_morte', '')), '');
  v_enc text := nullif(btrim(coalesce(o ->> 'encaminhamento', '')), '');
  v_do text := regexp_replace(coalesce(nullif(d ->> 'numero_do', ''), o ->> 'numero_do', ''), '\D', '', 'g');
  v_cond text := nullif(btrim(coalesce(o ->> 'atestado_condicao', '')), '');
  v_a text := nullif(btrim(coalesce(o ->> 'causa_a', '')), '');
  v_b text := nullif(btrim(coalesce(o ->> 'causa_b', '')), '');
  v_c text := nullif(btrim(coalesce(o ->> 'causa_c', '')), '');
  v_d text := nullif(btrim(coalesce(o ->> 'causa_d', '')), '');
  v_p2 text := nullif(btrim(coalesce(o ->> 'parte2', '')), '');
  v_pol timestamptz;
  v_ocor text := nullif(btrim(coalesce(o ->> 'policia_ocorrencia', '')), '');
  v_avisos text[] := '{}';
  r record;
  t text;
BEGIN
  IF nullif(btrim(coalesce(d ->> 'hora_obito', '')), '') IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
  BEGIN
    v_hora := (d ->> 'hora_obito')::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Óbito: hora do óbito inválida.';
  END;
  IF v_hora > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
  IF p_desde IS NOT NULL AND v_hora < p_desde THEN RAISE EXCEPTION 'Hora do óbito antes da entrada.'; END IF;

  IF v_tipo IS NULL OR v_tipo NOT IN ('natural_assistida', 'natural_sem_assistencia_ou_a_esclarecer', 'violenta_ou_suspeita') THEN
    RAISE EXCEPTION 'Óbito: escolha o tipo de morte (natural com assistência, natural sem assistência ou a esclarecer, violenta ou suspeita).';
  END IF;
  -- O3: o caminho de cada tipo (Res. CFM 1.779/2005, art. 2º)
  IF v_tipo = 'natural_assistida' THEN
    v_enc := 'unidade';
  ELSIF v_tipo = 'violenta_ou_suspeita' THEN
    v_enc := 'iml';
  ELSIF v_enc IS NULL OR v_enc NOT IN ('svo', 'causa_desconhecida') THEN
    RAISE EXCEPTION 'Óbito sem assistência ou a esclarecer: diga se o corpo vai ao SVO ou, onde não há SVO, se a unidade emite a D.O. com "causa da morte desconhecida".';
  END IF;

  IF v_enc IN ('unidade', 'causa_desconhecida') THEN
    -- a unidade emite a D.O.: 9 algarismos, o último é o dígito verificador
    -- (o manual MS 2022 não dá o algoritmo: só o tamanho é conferido)
    IF v_do !~ '^\d{9}$' THEN RAISE EXCEPTION 'Óbito: o número da Declaração de Óbito tem 9 dígitos.'; END IF;
    IF v_cond IS NULL OR v_cond NOT IN ('assistente', 'substituto') THEN
      RAISE EXCEPTION 'Óbito: diga se você atesta como médico assistente ou como substituto (plantonista).';
    END IF;
  ELSE
    IF v_do <> '' THEN
      RAISE EXCEPTION '%', CASE v_enc
        WHEN 'iml' THEN 'Morte violenta ou suspeita: a D.O. é emitida pelo IML, não pela unidade. Deixe o número em branco.'
        ELSE 'Óbito encaminhado ao SVO: a D.O. é emitida pelo SVO, não pela unidade. Deixe o número em branco.' END;
    END IF;
    v_do := NULL;
    v_cond := NULL;
  END IF;

  IF v_enc = 'causa_desconhecida' THEN
    -- manual MS 2022 e MS/CFM 2009: a Parte I leva "causa da morte desconhecida";
    -- a Parte II pode trazer o que os acompanhantes referiram
    v_a := 'Causa da morte desconhecida';
    v_b := NULL; v_c := NULL; v_d := NULL;
  ELSIF v_enc = 'unidade' AND length(coalesce(v_a, '')) < 3 THEN
    RAISE EXCEPTION 'Óbito: escreva na linha a da Parte I a doença ou lesão que causou a morte.';
  END IF;
  IF length(v_a) > 500 OR length(v_b) > 500 OR length(v_c) > 500 OR length(v_d) > 500 THEN
    RAISE EXCEPTION 'Óbito: cada linha da Parte I cabe em 500 letras.';
  END IF;
  IF length(v_p2) > 1000 THEN RAISE EXCEPTION 'Óbito: a Parte II cabe em 1000 letras.'; END IF;

  IF nullif(btrim(coalesce(o ->> 'policia_comunicada_em', '')), '') IS NOT NULL THEN
    IF v_tipo <> 'violenta_ou_suspeita' THEN RAISE EXCEPTION 'Óbito: a comunicação à polícia é da morte violenta ou suspeita.'; END IF;
    BEGIN
      v_pol := (o ->> 'policia_comunicada_em')::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Óbito: hora da comunicação à polícia inválida.';
    END;
    IF v_pol > now() + interval '1 minute' THEN RAISE EXCEPTION 'Óbito: a comunicação à polícia está no futuro.'; END IF;
  ELSIF v_ocor IS NOT NULL THEN
    RAISE EXCEPTION 'Óbito: diga quando a polícia foi comunicada.';
  END IF;
  IF length(v_ocor) > 60 THEN RAISE EXCEPTION 'Óbito: o número da ocorrência cabe em 60 letras.'; END IF;

  -- termos vagos: aviso, não bloqueio (MS/CFM 2009)
  FOR r IN SELECT * FROM (VALUES ('linha a', v_a), ('linha b', v_b), ('linha c', v_c), ('linha d', v_d), ('Parte II', v_p2)) x(linha, texto) LOOP
    FOREACH t IN ARRAY private.obito_termos_vagos(r.texto) LOOP
      v_avisos := v_avisos || format('%s: "%s" é modo de morrer, não causa (MS/CFM, A Declaração de Óbito, 2009). Escreva a doença ou lesão que levou a ele.', r.linha, t);
    END LOOP;
  END LOOP;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'hora_obito', v_hora, 'tipo_morte', v_tipo, 'encaminhamento', v_enc, 'numero_do', v_do,
    'atestado_condicao', v_cond, 'causa_a', v_a, 'causa_b', v_b, 'causa_c', v_c, 'causa_d', v_d, 'parte2', v_p2,
    'policia_comunicada_em', v_pol, 'policia_ocorrencia', CASE WHEN v_pol IS NOT NULL THEN v_ocor END))
    || jsonb_build_object('avisos', to_jsonb(v_avisos));
END $$;
REVOKE ALL ON FUNCTION private.obito_validado(jsonb, timestamptz) FROM PUBLIC, anon, authenticated;

-- a tela confere antes de enviar: erro (o primeiro) e avisos, sem gravar nada
CREATE OR REPLACE FUNCTION public.conferir_obito(p_dados jsonb, p_desde timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  BEGIN
    v := private.obito_validado(coalesce(p_dados, '{}'::jsonb), p_desde);
  EXCEPTION WHEN raise_exception THEN
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM, 'avisos', '[]'::jsonb);
  END;
  RETURN jsonb_build_object('ok', true, 'erro', NULL, 'avisos', v -> 'avisos', 'encaminhamento', v ->> 'encaminhamento');
END $$;
REVOKE ALL ON FUNCTION public.conferir_obito(jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conferir_obito(jsonb, timestamptz) TO authenticated;

-- o que o desfecho e a alta guardam no jsonb (como antes, mais as chaves novas)
CREATE OR REPLACE FUNCTION private.obito_detalhes(v jsonb, p_id uuid)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object('hora_obito', v ->> 'hora_obito', 'numero_do', v ->> 'numero_do', 'obito_id', p_id,
                                              'tipo_morte', v ->> 'tipo_morte', 'encaminhamento', v ->> 'encaminhamento'))
$$;
REVOKE ALL ON FUNCTION private.obito_detalhes(jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- ── O2: o conteúdo do Sumário de óbito (documento do prontuário) ────────────
CREATE OR REPLACE FUNCTION private.obito_sumario(o public.obitos)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'formato', 'obito',
    'aviso', 'Registro para o prontuário. A Declaração de Óbito é o formulário oficial do Ministério da Saúde.',
    'hora_obito', o.hora_obito, 'origem', o.origem,
    'setor', (SELECT s.nome FROM public.setores s WHERE s.id = o.setor_id),
    'leito', (SELECT l.identificador FROM public.leitos l WHERE l.id = o.leito_id),
    'tipo_morte', o.tipo_morte, 'encaminhamento', o.encaminhamento,
    'numero_do', o.numero_do, 'atestado_condicao', o.atestado_condicao,
    'causas', jsonb_strip_nulls(jsonb_build_object('a', o.causa_a, 'b', o.causa_b, 'c', o.causa_c, 'd', o.causa_d, 'parte2', o.parte2)),
    'cid_interno', o.cid_interno, 'relato', o.relato,
    'policia_comunicada_em', o.policia_comunicada_em, 'policia_ocorrencia', o.policia_ocorrencia))
$$;
REVOKE ALL ON FUNCTION private.obito_sumario(public.obitos) FROM PUBLIC, anon, authenticated;

-- ── O1/O2/O5: o registro único ──────────────────────────────────────────────
-- Chamado por registrar_desfecho (porta) e por dar_alta (observação e
-- internação), depois de private.obito_validado e antes de a internação
-- fechar (o sumário fica ligado a ela).
CREATE OR REPLACE FUNCTION private.registrar_obito(p_paciente uuid, p_unidade uuid, p_episodio uuid, p_internacao uuid,
                                                   p_origem text, p_setor uuid, p_leito uuid, v jsonb, p_relato text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_perfil uuid := private.meu_perfil_id();
  v_emite boolean := (v ->> 'encaminhamento') IN ('unidade', 'causa_desconhecida');
  o public.obitos;
  v_doc public.documentos_clinicos;
BEGIN
  IF EXISTS (SELECT 1 FROM public.obitos WHERE paciente_id = p_paciente AND anulado_em IS NULL) THEN
    RAISE EXCEPTION 'Este paciente já tem óbito registrado.';
  END IF;
  IF v ->> 'numero_do' IS NOT NULL AND EXISTS (SELECT 1 FROM public.obitos WHERE numero_do = v ->> 'numero_do' AND anulado_em IS NULL) THEN
    RAISE EXCEPTION 'Óbito: este número de Declaração de Óbito já está em outro registro.';
  END IF;
  INSERT INTO public.obitos (id, unidade_id, paciente_id, episodio_id, internacao_id, origem, setor_id, leito_id, hora_obito,
                             tipo_morte, encaminhamento, numero_do, atestado_por, atestado_condicao,
                             causa_a, causa_b, causa_c, causa_d, parte2, cid_interno, avisos, relato,
                             policia_comunicada_em, policia_comunicada_por, policia_ocorrencia, registrado_por)
  VALUES (v_id, p_unidade, p_paciente, p_episodio, p_internacao, p_origem, p_setor,
          CASE WHEN p_leito IS NOT NULL AND EXISTS (SELECT 1 FROM public.leitos WHERE id = p_leito AND status = 'ocupado') THEN p_leito END,
          (v ->> 'hora_obito')::timestamptz, v ->> 'tipo_morte', v ->> 'encaminhamento', v ->> 'numero_do',
          CASE WHEN v_emite THEN v_perfil END, v ->> 'atestado_condicao',
          v ->> 'causa_a', v ->> 'causa_b', v ->> 'causa_c', v ->> 'causa_d', v ->> 'parte2', nullif(v ->> 'cid_interno', ''),
          ARRAY(SELECT jsonb_array_elements_text(coalesce(v -> 'avisos', '[]'::jsonb))), nullif(btrim(coalesce(p_relato, '')), ''),
          (v ->> 'policia_comunicada_em')::timestamptz,
          CASE WHEN v ? 'policia_comunicada_em' THEN v_perfil END, v ->> 'policia_ocorrencia', v_perfil)
  RETURNING * INTO o;

  -- O2: o Sumário de óbito, documento do prontuário (nunca a D.O.)
  v_doc := private.gravar_documento_episodio(NULL, p_paciente, 'sumario_obito', private.obito_sumario(o)::text, p_episodio,
                                             NULL, NULL, v_perfil, now(), false, NULL);
  UPDATE public.obitos SET documento_id = v_doc.id WHERE id = v_id;

  -- O5: o leito segue ocupado com o corpo até a liberação
  IF o.leito_id IS NOT NULL THEN
    UPDATE public.leitos SET obito_aguardando_id = v_id WHERE id = o.leito_id;
    INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (o.leito_id, p_unidade, 'aguardando_corpo', 'ocupado', 'ocupado', p_internacao, v_perfil, 'Óbito: aguardando liberação do corpo');
  END IF;

  -- sem dado de pessoa na auditoria (lição da lacuna 1)
  PERFORM private.registrar_auditoria('obito_registrado', 'obitos', v_id, p_unidade,
    jsonb_build_object('tipo', v ->> 'tipo_morte', 'situacao', v ->> 'encaminhamento'));
  PERFORM private.registrar_auditoria('emitir_documento', 'documentos_clinicos', v_doc.id, v_doc.unidade_id,
    jsonb_build_object('tipo', 'sumario_obito'));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.registrar_obito(uuid, uuid, uuid, uuid, text, uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;

-- ── O7: pendências e leitura ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.obito_pendencias(o public.obitos)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN o.anulado_em IS NOT NULL THEN '{}'::text[] ELSE array_remove(ARRAY[
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.obito_comunicacoes c WHERE c.obito_id = o.id AND c.anulado_em IS NULL) THEN 'comunicacao_familia' END,
    CASE WHEN o.tipo_morte = 'violenta_ou_suspeita' AND o.policia_comunicada_em IS NULL THEN 'policia' END,
    CASE WHEN o.identificacao_em IS NULL THEN 'identificacao' END,
    CASE WHEN o.liberado_em IS NULL THEN 'liberacao' END,
    CASE WHEN o.numero_do IS NOT NULL AND o.via_branca_em IS NULL THEN 'via_branca' END,
    CASE WHEN o.numero_do IS NOT NULL AND o.via_amarela_em IS NULL THEN 'via_amarela' END,
    CASE WHEN o.numero_do IS NOT NULL AND o.via_rosa_em IS NULL THEN 'via_rosa' END], NULL) END
$$;
REVOKE ALL ON FUNCTION private.obito_pendencias(public.obitos) FROM PUBLIC, anon, authenticated;

-- quem lê: gestor da unidade, quem está de plantão na unidade (fora a
-- telemedicina) ou quem tem acesso ao prontuário encerrado
CREATE OR REPLACE FUNCTION private.obito_pode_ler(o public.obitos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.sou_gestor_da_unidade(o.unidade_id), false)
      OR (coalesce(private.membro_da_unidade(o.unidade_id), false) AND coalesce(private.na_escala_agora(o.unidade_id), false)
          AND coalesce(private.papel_na_unidade(o.unidade_id), '') NOT IN ('', 'telemedicina'))
      OR coalesce(private.acesso_encerrado_vigente(o.paciente_id), false)
$$;
REVOKE ALL ON FUNCTION private.obito_pode_ler(public.obitos) FROM PUBLIC, anon, authenticated;

-- O6: o que cada um faz (de plantão na unidade)
CREATE OR REPLACE FUNCTION private.obito_pode(o public.obitos)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH p AS (
    SELECT o.anulado_em IS NULL AND coalesce(private.na_escala_agora(o.unidade_id), false) AS ativo,
           coalesce(private.tenho_papel(o.unidade_id, 'plantonista'), false) AS med,
           coalesce(private.tenho_papel(o.unidade_id, 'enfermeiro'), false) AS enf,
           coalesce(private.sou_enfermagem(o.unidade_id), false) AS enfermagem,
           coalesce(private.tenho_papel(o.unidade_id, 'recepcao'), false) AS rec)
  SELECT jsonb_build_object(
    'comunicar', ativo AND (med OR enf),
    'policia', ativo AND (med OR enf) AND o.tipo_morte = 'violenta_ou_suspeita',
    'corpo', ativo AND (enfermagem OR rec),
    'vias', ativo AND (med OR enfermagem OR rec) AND o.numero_do IS NOT NULL,
    'anular_do', ativo AND med AND o.numero_do IS NOT NULL)
  FROM p
$$;
REVOKE ALL ON FUNCTION private.obito_pode(public.obitos) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.obito_json(o public.obitos, p_completo boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', o.id, 'paciente_id', o.paciente_id, 'episodio_id', o.episodio_id, 'internacao_id', o.internacao_id,
    'origem', o.origem, 'setor', (SELECT s.nome FROM public.setores s WHERE s.id = o.setor_id),
    'leito_id', o.leito_id, 'leito', (SELECT l.identificador FROM public.leitos l WHERE l.id = o.leito_id),
    'leito_aguardando', EXISTS (SELECT 1 FROM public.leitos l WHERE l.obito_aguardando_id = o.id),
    'hora_obito', o.hora_obito, 'tipo_morte', o.tipo_morte, 'encaminhamento', o.encaminhamento,
    'numero_do', o.numero_do, 'atestado_condicao', o.atestado_condicao,
    'atestado_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = o.atestado_por),
    'causas', jsonb_build_object('a', o.causa_a, 'b', o.causa_b, 'c', o.causa_c, 'd', o.causa_d, 'parte2', o.parte2),
    'cid_interno', o.cid_interno, 'avisos', to_jsonb(o.avisos),
    'policia', CASE WHEN o.policia_comunicada_em IS NOT NULL THEN jsonb_build_object('em', o.policia_comunicada_em,
                 'por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = o.policia_comunicada_por), 'ocorrencia', o.policia_ocorrencia) END,
    'vias', jsonb_build_object(
      'branca', CASE WHEN o.via_branca_em IS NOT NULL THEN jsonb_build_object('em', o.via_branca_em, 'por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = o.via_branca_por)) END,
      'amarela', CASE WHEN o.via_amarela_em IS NOT NULL THEN jsonb_build_object('em', o.via_amarela_em, 'por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = o.via_amarela_por)) END,
      'rosa', CASE WHEN o.via_rosa_em IS NOT NULL THEN jsonb_build_object('em', o.via_rosa_em, 'por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = o.via_rosa_por)) END),
    'identificacao', CASE WHEN o.identificacao_em IS NOT NULL THEN jsonb_build_object('meio', o.identificacao_meio, 'em', o.identificacao_em,
                       'por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = o.identificacao_por)) END,
    'liberacao', CASE WHEN o.liberado_em IS NOT NULL THEN jsonb_build_object('destino', o.liberacao_destino, 'em', o.liberado_em,
                   'por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = o.liberado_por)) END,
    'comunicada_familia', EXISTS (SELECT 1 FROM public.obito_comunicacoes c WHERE c.obito_id = o.id AND c.anulado_em IS NULL),
    'documento_id', o.documento_id, 'registrado_em', o.registrado_em,
    'registrado_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = o.registrado_por),
    'anulado_em', o.anulado_em, 'motivo_anulacao', o.motivo_anulacao,
    'pendencias', to_jsonb(private.obito_pendencias(o)))
  || CASE WHEN p_completo THEN jsonb_build_object(
       'comunicacoes', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'por', pf.nome_completo, 'papel', c.papel,
                                   'destinatario_nome', c.destinatario_nome, 'parentesco', c.parentesco, 'em', c.comunicado_em,
                                   'meio', c.meio, 'testemunha', c.testemunha) ORDER BY c.comunicado_em)
                                  FROM public.obito_comunicacoes c LEFT JOIN public.perfis pf ON pf.id = c.comunicado_por
                                 WHERE c.obito_id = o.id AND c.anulado_em IS NULL), '[]'::jsonb),
       'do_anuladas', coalesce((SELECT jsonb_agg(jsonb_build_object('numero_anulado', a.numero_anulado, 'numero_novo', a.numero_novo,
                                  'motivo', a.motivo, 'em', a.registrado_em, 'por', pf.nome_completo) ORDER BY a.registrado_em)
                                 FROM public.obito_do_anuladas a LEFT JOIN public.perfis pf ON pf.id = a.registrado_por
                                WHERE a.obito_id = o.id), '[]'::jsonb),
       'pode', private.obito_pode(o)) ELSE '{}'::jsonb END
$$;
REVOKE ALL ON FUNCTION private.obito_json(public.obitos, boolean) FROM PUBLIC, anon, authenticated;

-- o óbito do paciente (o vigente; sem ele, o último anulado), para a tela
CREATE OR REPLACE FUNCTION public.obito_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.obitos; v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO o FROM public.obitos WHERE paciente_id = p_paciente ORDER BY (anulado_em IS NULL) DESC, registrado_em DESC LIMIT 1;
  IF o.id IS NULL THEN
    SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
    IF v_unidade IS NULL OR NOT coalesce(private.membro_da_unidade(v_unidade), false) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
    RETURN jsonb_build_object('obito', NULL);
  END IF;
  IF NOT private.obito_pode_ler(o) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN jsonb_build_object('obito', private.obito_json(o, true));
END $$;
REVOKE ALL ON FUNCTION public.obito_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obito_do_paciente(uuid) TO authenticated;

-- O7: os óbitos da unidade com o que falta (a lista da enfermagem e da porta)
CREATE OR REPLACE FUNCTION public.obitos_pendentes(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (coalesce(private.sou_gestor_da_unidade(p_unidade), false)
          OR (coalesce(private.membro_da_unidade(p_unidade), false) AND coalesce(private.na_escala_agora(p_unidade), false)
              AND coalesce(private.papel_na_unidade(p_unidade), '') NOT IN ('', 'telemedicina'))) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(private.obito_json(o, false) || jsonb_build_object('paciente', pa.nome, 'pode', private.obito_pode(o))
                     ORDER BY o.hora_obito DESC)
      FROM public.obitos o JOIN public.pacientes pa ON pa.id = o.paciente_id
     WHERE o.unidade_id = p_unidade AND o.anulado_em IS NULL
       AND cardinality(private.obito_pendencias(o)) > 0), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.obitos_pendentes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obitos_pendentes(uuid) TO authenticated;

-- ── as ações depois do registro ─────────────────────────────────────────────
-- o óbito vigente, travado, com quem age de plantão na unidade
CREATE OR REPLACE FUNCTION private.obito_para_agir(p_obito uuid)
RETURNS public.obitos LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.obitos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO o FROM public.obitos WHERE id = p_obito FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Óbito não encontrado.'; END IF;
  IF o.anulado_em IS NOT NULL THEN RAISE EXCEPTION 'Este óbito foi desfeito com o cancelamento da alta.'; END IF;
  IF NOT (coalesce(private.membro_da_unidade(o.unidade_id), false) AND coalesce(private.na_escala_agora(o.unidade_id), false)) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta unidade.';
  END IF;
  RETURN o;
END $$;
REVOKE ALL ON FUNCTION private.obito_para_agir(uuid) FROM PUBLIC, anon, authenticated;

-- hora de um registro: vazia é agora; não no futuro nem antes do óbito
CREATE OR REPLACE FUNCTION private.obito_hora(p text, o public.obitos, p_rotulo text)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v timestamptz;
BEGIN
  IF nullif(btrim(coalesce(p, '')), '') IS NULL THEN RETURN now(); END IF;
  BEGIN
    v := p::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION '%: hora inválida.', p_rotulo;
  END;
  IF v > now() + interval '1 minute' THEN RAISE EXCEPTION '%: hora no futuro.', p_rotulo; END IF;
  IF v < o.hora_obito THEN RAISE EXCEPTION '%: hora antes do óbito.', p_rotulo; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION private.obito_hora(text, public.obitos, text) FROM PUBLIC, anon, authenticated;

-- O4: comunicação à família (médico ou enfermeiro)
CREATE OR REPLACE FUNCTION public.comunicar_obito_familia(p_obito uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.obitos := private.obito_para_agir(p_obito);
  v_papel text;
  v_nome text := btrim(coalesce(p_dados ->> 'destinatario_nome', ''));
  v_par text := btrim(coalesce(p_dados ->> 'parentesco', ''));
  v_meio text := coalesce(p_dados ->> 'meio', '');
  v_test text := nullif(btrim(coalesce(p_dados ->> 'testemunha', '')), '');
  v_id uuid;
BEGIN
  v_papel := CASE WHEN private.tenho_papel(o.unidade_id, 'plantonista') THEN 'plantonista'
                  WHEN private.tenho_papel(o.unidade_id, 'enfermeiro') THEN 'enfermeiro' END;
  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'A comunicação do óbito à família é registrada pelo médico ou pelo enfermeiro.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(v_nome) < 3 THEN RAISE EXCEPTION 'Diga o nome de quem recebeu a notícia.'; END IF;
  IF length(v_nome) > 120 THEN RAISE EXCEPTION 'O nome cabe em 120 letras.'; END IF;
  IF length(v_par) < 3 THEN RAISE EXCEPTION 'Diga o parentesco ou a relação com o paciente.'; END IF;
  IF length(v_par) > 60 THEN RAISE EXCEPTION 'O parentesco cabe em 60 letras.'; END IF;
  IF v_meio NOT IN ('presencial', 'telefone') THEN RAISE EXCEPTION 'Diga como foi a comunicação: presencial ou por telefone.'; END IF;
  IF length(v_test) > 120 THEN RAISE EXCEPTION 'O nome da testemunha cabe em 120 letras.'; END IF;
  INSERT INTO public.obito_comunicacoes (obito_id, unidade_id, comunicado_por, papel, destinatario_nome, parentesco, comunicado_em, meio, testemunha)
  VALUES (o.id, o.unidade_id, private.meu_perfil_id(), v_papel, v_nome, v_par,
          private.obito_hora(p_dados ->> 'comunicado_em', o, 'Comunicação à família'), v_meio, v_test)
  RETURNING id INTO v_id;
  -- só ids e códigos: o nome e o parentesco ficam na tabela protegida
  PERFORM private.registrar_auditoria('obito_comunicado_familia', 'obitos', o.id, o.unidade_id,
    jsonb_build_object('tipo', v_meio, 'papel', v_papel));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.comunicar_obito_familia(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comunicar_obito_familia(uuid, jsonb) TO authenticated;

-- O3: comunicação à polícia na morte violenta ou suspeita (médico ou enfermeiro)
CREATE OR REPLACE FUNCTION public.comunicar_obito_policia(p_obito uuid, p_dados jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.obitos := private.obito_para_agir(p_obito);
  v_ocor text := nullif(btrim(coalesce(p_dados ->> 'ocorrencia', '')), '');
BEGIN
  IF NOT (private.tenho_papel(o.unidade_id, 'plantonista') OR private.tenho_papel(o.unidade_id, 'enfermeiro')) THEN
    RAISE EXCEPTION 'A comunicação à polícia é registrada pelo médico ou pelo enfermeiro.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF o.tipo_morte <> 'violenta_ou_suspeita' THEN RAISE EXCEPTION 'A comunicação à polícia é da morte violenta ou suspeita.'; END IF;
  IF o.policia_comunicada_em IS NOT NULL THEN RAISE EXCEPTION 'A comunicação à polícia já foi registrada.'; END IF;
  IF length(v_ocor) > 60 THEN RAISE EXCEPTION 'O número da ocorrência cabe em 60 letras.'; END IF;
  UPDATE public.obitos
     SET policia_comunicada_em = private.obito_hora(p_dados ->> 'comunicada_em', o, 'Comunicação à polícia'),
         policia_comunicada_por = private.meu_perfil_id(), policia_ocorrencia = v_ocor
   WHERE id = o.id;
  PERFORM private.registrar_auditoria('obito_comunicado_policia', 'obitos', o.id, o.unidade_id, jsonb_build_object('situacao', 'comunicada'));
END $$;
REVOKE ALL ON FUNCTION public.comunicar_obito_policia(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comunicar_obito_policia(uuid, jsonb) TO authenticated;

-- O5: conferência da identificação do corpo (enfermagem ou recepção)
CREATE OR REPLACE FUNCTION public.conferir_identificacao_corpo(p_obito uuid, p_dados jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.obitos := private.obito_para_agir(p_obito);
  v_meio text := coalesce(p_dados ->> 'meio', '');
BEGIN
  IF NOT (private.sou_enfermagem(o.unidade_id) OR private.tenho_papel(o.unidade_id, 'recepcao')) THEN
    RAISE EXCEPTION 'A identificação do corpo é conferida pela enfermagem ou pela recepção.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF o.identificacao_em IS NOT NULL THEN RAISE EXCEPTION 'A identificação do corpo já foi conferida.'; END IF;
  IF v_meio NOT IN ('pulseira', 'documento', 'pulseira_e_documento') THEN
    RAISE EXCEPTION 'Diga como a identificação foi conferida: pulseira, documento ou os dois.';
  END IF;
  UPDATE public.obitos
     SET identificacao_meio = v_meio, identificacao_em = private.obito_hora(p_dados ->> 'em', o, 'Identificação do corpo'),
         identificacao_por = private.meu_perfil_id()
   WHERE id = o.id;
  PERFORM private.registrar_auditoria('obito_identificacao', 'obitos', o.id, o.unidade_id, jsonb_build_object('tipo', v_meio));
END $$;
REVOKE ALL ON FUNCTION public.conferir_identificacao_corpo(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conferir_identificacao_corpo(uuid, jsonb) TO authenticated;

-- O5: liberação do corpo (enfermagem ou recepção). O destino segue o caminho
-- do óbito; o leito que esperava o corpo vai para a higienização.
CREATE OR REPLACE FUNCTION public.liberar_corpo(p_obito uuid, p_dados jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.obitos := private.obito_para_agir(p_obito);
  v_destino text := coalesce(p_dados ->> 'destino', '');
  v_certo text;
  v_em timestamptz;
  v_perfil uuid := private.meu_perfil_id();
  v_leito uuid;
BEGIN
  IF NOT (private.sou_enfermagem(o.unidade_id) OR private.tenho_papel(o.unidade_id, 'recepcao')) THEN
    RAISE EXCEPTION 'A liberação do corpo é registrada pela enfermagem ou pela recepção.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF o.liberado_em IS NOT NULL THEN RAISE EXCEPTION 'O corpo já foi liberado.'; END IF;
  IF o.identificacao_em IS NULL THEN RAISE EXCEPTION 'Confira a identificação do corpo antes da liberação.'; END IF;
  v_certo := CASE o.encaminhamento WHEN 'iml' THEN 'iml' WHEN 'svo' THEN 'svo' ELSE 'funeraria' END;
  IF v_destino NOT IN ('funeraria', 'svo', 'iml') THEN RAISE EXCEPTION 'Diga o destino do corpo: funerária, SVO ou IML.'; END IF;
  IF v_destino <> v_certo THEN
    RAISE EXCEPTION '%', CASE v_certo
      WHEN 'iml' THEN 'Morte violenta ou suspeita: o corpo vai ao IML.'
      WHEN 'svo' THEN 'Óbito encaminhado ao SVO: o corpo vai ao SVO.'
      ELSE 'A unidade atestou o óbito: o corpo vai à funerária.' END;
  END IF;
  v_em := private.obito_hora(p_dados ->> 'liberado_em', o, 'Liberação do corpo');
  IF v_em < o.identificacao_em THEN RAISE EXCEPTION 'Liberação do corpo: hora antes da conferência da identificação.'; END IF;
  UPDATE public.obitos
     SET liberacao_destino = v_destino, liberado_em = v_em, liberado_por = v_perfil,
         via_amarela_em = CASE WHEN coalesce((p_dados ->> 'via_amarela_entregue')::boolean, false) AND numero_do IS NOT NULL AND via_amarela_em IS NULL
                               THEN v_em ELSE via_amarela_em END,
         via_amarela_por = CASE WHEN coalesce((p_dados ->> 'via_amarela_entregue')::boolean, false) AND numero_do IS NOT NULL AND via_amarela_em IS NULL
                                THEN v_perfil ELSE via_amarela_por END
   WHERE id = o.id;
  FOR v_leito IN SELECT id FROM public.leitos WHERE obito_aguardando_id = o.id FOR UPDATE LOOP
    UPDATE public.leitos SET obito_aguardando_id = NULL, status = 'higienizacao' WHERE id = v_leito;
    INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (v_leito, o.unidade_id, 'liberacao', 'ocupado', 'higienizacao', o.internacao_id, v_perfil,
            'Corpo liberado (' || CASE v_destino WHEN 'iml' THEN 'IML' WHEN 'svo' THEN 'SVO' ELSE 'funerária' END || ')');
  END LOOP;
  PERFORM private.registrar_auditoria('obito_corpo_liberado', 'obitos', o.id, o.unidade_id, jsonb_build_object('tipo', v_destino));
END $$;
REVOKE ALL ON FUNCTION public.liberar_corpo(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_corpo(uuid, jsonb) TO authenticated;

-- O1: destino de cada via da D.O. da unidade (Portaria 116/2009, art. 20)
CREATE OR REPLACE FUNCTION public.registrar_via_do(p_obito uuid, p_via text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.obitos := private.obito_para_agir(p_obito); v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF NOT (private.tenho_papel(o.unidade_id, 'plantonista') OR private.sou_enfermagem(o.unidade_id) OR private.tenho_papel(o.unidade_id, 'recepcao')) THEN
    RAISE EXCEPTION 'As vias da D.O. são registradas pelo médico, pela enfermagem ou pela recepção.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF o.numero_do IS NULL THEN RAISE EXCEPTION 'A unidade não emitiu D.O. neste óbito.'; END IF;
  IF p_via NOT IN ('branca', 'amarela', 'rosa') THEN RAISE EXCEPTION 'Via desconhecida.'; END IF;
  IF (p_via = 'branca' AND o.via_branca_em IS NOT NULL) OR (p_via = 'amarela' AND o.via_amarela_em IS NOT NULL)
     OR (p_via = 'rosa' AND o.via_rosa_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Esta via já foi registrada.';
  END IF;
  UPDATE public.obitos
     SET via_branca_em = CASE WHEN p_via = 'branca' THEN now() ELSE via_branca_em END,
         via_branca_por = CASE WHEN p_via = 'branca' THEN v_perfil ELSE via_branca_por END,
         via_amarela_em = CASE WHEN p_via = 'amarela' THEN now() ELSE via_amarela_em END,
         via_amarela_por = CASE WHEN p_via = 'amarela' THEN v_perfil ELSE via_amarela_por END,
         via_rosa_em = CASE WHEN p_via = 'rosa' THEN now() ELSE via_rosa_em END,
         via_rosa_por = CASE WHEN p_via = 'rosa' THEN v_perfil ELSE via_rosa_por END
   WHERE id = o.id;
  PERFORM private.registrar_auditoria('obito_via_do', 'obitos', o.id, o.unidade_id, jsonb_build_object('tipo', p_via));
END $$;
REVOKE ALL ON FUNCTION public.registrar_via_do(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_via_do(uuid, text) TO authenticated;

-- O1: D.O. anulada ou rasurada: guarda o número velho e o motivo; o novo
-- formulário recomeça as vias (médico)
CREATE OR REPLACE FUNCTION public.anular_do(p_obito uuid, p_numero_novo text, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.obitos := private.obito_para_agir(p_obito);
  v_novo text := regexp_replace(coalesce(p_numero_novo, ''), '\D', '', 'g');
BEGIN
  IF NOT private.tenho_papel(o.unidade_id, 'plantonista') THEN
    RAISE EXCEPTION 'A D.O. anulada é registrada pelo médico.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF o.numero_do IS NULL THEN RAISE EXCEPTION 'A unidade não emitiu D.O. neste óbito.'; END IF;
  IF v_novo !~ '^\d{9}$' THEN RAISE EXCEPTION 'O número da nova Declaração de Óbito tem 9 dígitos.'; END IF;
  IF v_novo = o.numero_do THEN RAISE EXCEPTION 'O número novo é igual ao anulado.'; END IF;
  IF EXISTS (SELECT 1 FROM public.obitos WHERE numero_do = v_novo AND anulado_em IS NULL) THEN
    RAISE EXCEPTION 'Este número de Declaração de Óbito já está em outro registro.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Diga o motivo da anulação (mínimo de 10 letras).'; END IF;
  INSERT INTO public.obito_do_anuladas (obito_id, numero_anulado, numero_novo, motivo, registrado_por)
  VALUES (o.id, o.numero_do, v_novo, btrim(p_motivo), private.meu_perfil_id());
  UPDATE public.obitos
     SET numero_do = v_novo, via_branca_em = NULL, via_branca_por = NULL, via_amarela_em = NULL, via_amarela_por = NULL,
         via_rosa_em = NULL, via_rosa_por = NULL
   WHERE id = o.id;
  PERFORM private.registrar_auditoria('obito_do_anulada', 'obitos', o.id, o.unidade_id, jsonb_build_object('situacao', 'anulada'));
END $$;
REVOKE ALL ON FUNCTION public.anular_do(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anular_do(uuid, text, text) TO authenticated;

-- ── O8: o óbito desfeito com a alta cancelada ───────────────────────────────
-- Nada é apagado: o óbito, as comunicações e o sumário ficam anulados. O leito
-- que ainda esperava o corpo e não voltou ao paciente vai para a higienização.
CREATE OR REPLACE FUNCTION private.anular_obito(p_obito uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.obitos; v_perfil uuid := private.meu_perfil_id(); v_leito uuid;
BEGIN
  UPDATE public.obitos SET anulado_em = now(), anulado_por = v_perfil, motivo_anulacao = btrim(p_motivo)
   WHERE id = p_obito AND anulado_em IS NULL
  RETURNING * INTO o;
  IF o.id IS NULL THEN RETURN; END IF;
  UPDATE public.obito_comunicacoes SET anulado_em = now() WHERE obito_id = o.id AND anulado_em IS NULL;
  UPDATE public.documentos_clinicos
     SET estado = 'cancelado', cancelado_em = now(), cancelado_por = v_perfil,
         motivo_cancelamento = 'Óbito desfeito com o cancelamento da alta: ' || btrim(p_motivo), updated_at = now()
   WHERE id = o.documento_id AND estado = 'ativo';
  FOR v_leito IN SELECT id FROM public.leitos WHERE obito_aguardando_id = o.id FOR UPDATE LOOP
    UPDATE public.leitos SET obito_aguardando_id = NULL WHERE id = v_leito;
    IF NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.leito_atual_id = v_leito AND i.status IN ('admitido', 'em_observacao', 'internado')) THEN
      UPDATE public.leitos SET status = 'higienizacao' WHERE id = v_leito;
      INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
      VALUES (v_leito, o.unidade_id, 'liberacao', 'ocupado', 'higienizacao', o.internacao_id, v_perfil, 'Óbito desfeito: leito sem paciente');
    END IF;
  END LOOP;
  PERFORM private.registrar_auditoria('obito_anulado', 'obitos', o.id, o.unidade_id, jsonb_build_object('situacao', 'anulado'));
END $$;
REVOKE ALL ON FUNCTION private.anular_obito(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── O7: linha do tempo do prontuário ────────────────────────────────────────
-- Chamada por prontuario_leitura (SECURITY INVOKER) com os atendimentos e as
-- internações que o RLS deixou passar, como private.prontuario_contencoes.
-- Sem nome de familiar (isso fica em obito_do_paciente).
CREATE OR REPLACE FUNCTION private.prontuario_obitos(p_paciente uuid, p_eps uuid[], p_ints uuid[], p_vis uuid[],
                                                     p_vis_ints uuid[], p_avulsos boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes; v_fam uuid[];
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF pa.id IS NULL OR NOT (coalesce(private.gestor_da_unidade(pa.unidade_id), false) OR coalesce(private.pode_atuar_no_paciente(pa.id), false)
                           OR coalesce(private.acesso_encerrado_vigente(pa.id), false)
                           OR (coalesce(private.membro_da_unidade(pa.unidade_id), false) AND coalesce(private.na_escala_agora(pa.unidade_id), false)
                               AND coalesce(private.papel_na_unidade(pa.unidade_id), '') NOT IN ('', 'telemedicina'))) THEN
    RETURN jsonb_build_object('obitos', '[]'::jsonb);
  END IF;
  v_fam := ARRAY(SELECT private.familia_paciente(p_paciente));
  RETURN jsonb_build_object('obitos', coalesce((
    SELECT jsonb_agg(private.obito_json(x, false) ORDER BY x.hora_obito)
      FROM public.obitos x
     WHERE x.paciente_id = ANY (v_fam)
       AND (x.episodio_id = ANY (p_eps) OR (x.episodio_id IS NULL AND x.internacao_id = ANY (p_ints))
            OR (p_avulsos AND NOT (coalesce(x.episodio_id = ANY (p_vis), false)
                                   OR (x.episodio_id IS NULL AND coalesce(x.internacao_id = ANY (p_vis_ints), false)))))), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION private.prontuario_obitos(uuid, uuid[], uuid[], uuid[], uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.prontuario_obitos(uuid, uuid[], uuid[], uuid[], uuid[], boolean) TO authenticated;

-- ── funções trocadas trecho a trecho ────────────────────────────────────────
-- pula o que já foi trocado; trecho que sumiu (ou aparece mais de uma vez) para com erro.
-- Corpo gravado com quebra de linha CRLF continua CRLF (o rollback volta ao mesmo md5).
CREATE OR REPLACE FUNCTION pg_temp.trocar_obito(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
  v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
BEGIN
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
  IF mudou THEN EXECUTE def; END IF;
END $$;

-- registrar_desfecho (porta): o validador e o registro únicos (O1, O2)
SELECT pg_temp.trocar_obito('public.registrar_desfecho(uuid, text, text, jsonb)'::regprocedure, ARRAY[
  $a$  v_do text;
$a$,
  $b$  v_do text;
  v_obito jsonb;     -- lacuna 5: os dados do óbito, conferidos
  v_obito_id uuid;
$b$,
  $a$  IF p_desfecho = 'obito' THEN
    IF nullif(d ->> 'hora_obito', '') IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
    IF (d ->> 'hora_obito')::timestamptz > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
    IF length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN RAISE EXCEPTION 'Informe o número da Declaração de Óbito.'; END IF;
  END IF;
$a$,
  $b$  IF p_desfecho = 'obito' THEN
    -- lacuna 5 (O1, O3): os mesmos dados da observação e da internação
    v_obito := private.obito_validado(d, e.chegada_em);
  END IF;
$b$,
  $a$    v_do := regexp_replace(coalesce(d ->> 'numero_do', ''), '\D', '', 'g');
    IF v_do !~ '^\d{6,12}$' THEN RAISE EXCEPTION 'Óbito: o número da Declaração de Óbito tem de 6 a 12 dígitos.'; END IF;
    d := d || jsonb_build_object('cid_obito', private.cid_existente(d ->> 'cid_obito'), 'numero_do', v_do);
  END IF;
$a$,
  $b$    d := d || jsonb_build_object('cid_obito', private.cid_existente(d ->> 'cid_obito'));
    -- lacuna 5 (O1, O2): o registro único e o Sumário de óbito; o CID do óbito é o CID interno
    v_obito := v_obito || jsonb_build_object('cid_interno', d ->> 'cid_obito');
    v_obito_id := private.registrar_obito(e.paciente_id, e.unidade_id, e.id, NULL, 'porta', e.setor_id, NULL, v_obito, p_relato);
    d := (d - 'obito' - 'numero_do') || private.obito_detalhes(v_obito, v_obito_id);
  END IF;
$b$]);

-- dar_alta (internação e, pela finalizar_observacao, observação) (O1, O2, O5)
SELECT pg_temp.trocar_obito('public.dar_alta(uuid, text, text, timestamptz, text, text, jsonb)'::regprocedure, ARRAY[
  $a$  v_imp jsonb;
$a$,
  $b$  v_imp jsonb;
  v_obito jsonb;     -- lacuna 5: os dados do óbito, conferidos
  v_obito_id uuid;
$b$,
  $a$  IF p_tipo = 'obito' AND length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o número da Declaração de Óbito.';
  END IF;
$a$,
  $b$  IF p_tipo = 'obito' THEN
    -- lacuna 5 (O1, O3): os mesmos dados da porta; sem hora do óbito, vale a da alta (como antes)
    IF nullif(d ->> 'hora_obito', '') IS NULL THEN d := d || jsonb_build_object('hora_obito', v_quando); END IF;
    v_obito := private.obito_validado(d, i.data_admissao);
  END IF;
$b$,
  $a$  PERFORM public.registrar_evento_adt(i.id, p_tipo, NULL, NULL, nullif(btrim(p_observacoes), ''),
$a$,
  $b$  IF p_tipo = 'obito' THEN
    -- lacuna 5 (O1, O2, O5): o registro único, o Sumário de óbito e o leito que espera o corpo
    v_obito := v_obito || jsonb_build_object('cid_interno', v_cid);
    v_obito_id := private.registrar_obito(i.paciente_id, i.unidade_id, i.episodio_id, i.id,
      CASE WHEN i.status = 'em_observacao' THEN 'observacao' ELSE 'internacao' END,
      i.setor_atual_id, i.leito_atual_id, v_obito, p_observacoes);
    d := (d - 'obito' - 'numero_do') || private.obito_detalhes(v_obito, v_obito_id);
  END IF;
  PERFORM public.registrar_evento_adt(i.id, p_tipo, NULL, NULL, nullif(btrim(p_observacoes), ''),
$b$]);

-- registrar_evento_adt: o leito do óbito espera a liberação do corpo (O5)
SELECT pg_temp.trocar_obito('public.registrar_evento_adt(uuid, text, uuid, uuid, text, jsonb)'::regprocedure, ARRAY[
  $a$  IF p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito')
     AND v_leito_origem IS NOT NULL THEN
$a$,
  $b$  IF p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito')
     AND v_leito_origem IS NOT NULL
     -- lacuna 5 (O5): no óbito, o leito segue ocupado até a liberação do corpo
     AND NOT (p_tipo_evento = 'obito' AND EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito_origem AND obito_aguardando_id IS NOT NULL)) THEN
$b$]);

-- cancelar_alta: o óbito desfeito anula os registros novos e devolve o leito (O8)
SELECT pg_temp.trocar_obito('public.cancelar_alta(uuid, text)'::regprocedure, ARRAY[
  $a$  v_estado jsonb;
$a$,
  $b$  v_estado jsonb;
  v_obito uuid;      -- lacuna 5: o óbito desta alta
$b$,
  $a$  IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND status IN ('livre', 'higienizacao')) THEN
$a$,
  $b$  -- lacuna 5 (O8): o leito que ainda esperava o corpo volta ao paciente
  SELECT o.id INTO v_obito FROM public.obitos o WHERE o.internacao_id = i.id AND o.anulado_em IS NULL;
  IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito
       AND (status IN ('livre', 'higienizacao') OR (v_obito IS NOT NULL AND obito_aguardando_id = v_obito))) THEN
$b$,
  $a$    UPDATE public.leitos SET status = 'ocupado' WHERE id = v_leito;
$a$,
  $b$    IF v_status_leito = 'ocupado' THEN
      -- lacuna 5 (O8): o leito ainda esperava o corpo; sai só a marca
      UPDATE public.leitos SET obito_aguardando_id = NULL WHERE id = v_leito;
    ELSE
      UPDATE public.leitos SET status = 'ocupado' WHERE id = v_leito;
    END IF;
$b$,
  $a$  UPDATE public.pacientes SET setor_id = i.setor_atual_id, updated_at = now() WHERE id = i.paciente_id;
$a$,
  $b$  UPDATE public.pacientes SET setor_id = i.setor_atual_id, updated_at = now() WHERE id = i.paciente_id;
  -- lacuna 5 (O8): óbito, comunicações e sumário ficam anulados (nada é apagado)
  IF v_obito IS NOT NULL THEN PERFORM private.anular_obito(v_obito, btrim(p_justificativa)); END IF;
$b$]);

-- situacao_leitos: o leito do óbito aparece como "aguardando liberação do corpo" (O5, O7)
SELECT pg_temp.trocar_obito('public.situacao_leitos(uuid)'::regprocedure, ARRAY[
  $a$             WHERE e.leito_id = l.id AND e.tipo_evento = 'bloqueio' ORDER BY e.created_at DESC LIMIT 1) END,$a$,
  $b$             WHERE e.leito_id = l.id AND e.tipo_evento = 'bloqueio' ORDER BY e.created_at DESC LIMIT 1)
              -- lacuna 5 (O5): o leito segue ocupado com o corpo
              WHEN l.obito_aguardando_id IS NOT NULL THEN 'aguardando_corpo' END,$b$]);

-- liberar_leito_sem_paciente: o leito que espera o corpo sai pela liberação do corpo (O5)
SELECT pg_temp.trocar_obito('public.liberar_leito_sem_paciente(uuid, text)'::regprocedure, ARRAY[
  $a$  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN
$a$,
  $b$  IF EXISTS (SELECT 1 FROM public.leitos WHERE id = p_leito AND obito_aguardando_id IS NOT NULL) THEN
    -- lacuna 5 (O5)
    RAISE EXCEPTION 'Leito % aguarda a liberação do corpo: registre a liberação no óbito.', (r.leito).identificador
      USING ERRCODE = 'check_violation';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN
$b$]);

-- mapa_leitos_gestor: a marca no leito (O5)
SELECT pg_temp.trocar_obito('public.mapa_leitos_gestor(uuid)'::regprocedure, ARRAY[
  $a$    SELECT l.id, l.setor_id, l.identificador, l.status::text AS status, at.id AS internacao_id, at.paciente_id, at.desde
$a$,
  $b$    SELECT l.id, l.setor_id, l.identificador, l.status::text AS status, at.id AS internacao_id, at.paciente_id, at.desde,
           l.obito_aguardando_id IS NOT NULL AS aguardando_corpo  -- lacuna 5 (O5)
$b$,
  $a$                                     'ocupado', l.status = 'ocupado' OR l.internacao_id IS NOT NULL,
$a$,
  $b$                                     'ocupado', l.status = 'ocupado' OR l.internacao_id IS NOT NULL,
                                     'aguardando_corpo', l.aguardando_corpo,
$b$]);

-- prontuario_leitura: a chave obitos (O7)
SELECT pg_temp.trocar_obito('public.prontuario_leitura(uuid, timestamptz, integer)'::regprocedure, ARRAY[
  $a$    || private.prontuario_contencoes(p_paciente, v_eps, v_ints, v_vis, ARRAY(SELECT jsonb_object_keys(v_int_ep))::uuid[], v_avulsos)
$a$,
  $b$    || private.prontuario_contencoes(p_paciente, v_eps, v_ints, v_vis, ARRAY(SELECT jsonb_object_keys(v_int_ep))::uuid[], v_avulsos)
    -- lacuna 5 (O7): o óbito na linha do tempo
    || private.prontuario_obitos(p_paciente, v_eps, v_ints, v_vis, ARRAY(SELECT jsonb_object_keys(v_int_ep))::uuid[], v_avulsos)
$b$]);

DROP FUNCTION pg_temp.trocar_obito(regprocedure, text[]);

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (rodar inteiro; testado na homologação em transação desfeita):
--
-- CREATE OR REPLACE FUNCTION pg_temp.desfazer_obito(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
-- DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
--   v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
-- BEGIN
--   FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
--     v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
--     v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
--     IF position(v_novo IN def) > 0 THEN
--       def := replace(def, v_novo, v_ant);
--       mudou := true;
--     END IF;
--   END LOOP;
--   IF mudou THEN EXECUTE def; END IF;
-- END $$;
-- -- as oito chamadas pg_temp.trocar_obito acima, iguais, com o nome
-- -- pg_temp.desfazer_obito (os mesmos pares: ele troca o novo pelo antigo)
-- -- antes de tirar as funções, o leito que ainda espera o corpo vai para a higienização:
-- UPDATE public.leitos SET obito_aguardando_id = NULL, status = 'higienizacao' WHERE obito_aguardando_id IS NOT NULL;
-- DROP FUNCTION IF EXISTS public.conferir_obito(jsonb, timestamptz), public.obito_do_paciente(uuid), public.obitos_pendentes(uuid),
--   public.comunicar_obito_familia(uuid, jsonb), public.comunicar_obito_policia(uuid, jsonb),
--   public.conferir_identificacao_corpo(uuid, jsonb), public.liberar_corpo(uuid, jsonb), public.registrar_via_do(uuid, text),
--   public.anular_do(uuid, text, text), private.anular_obito(uuid, text), private.prontuario_obitos(uuid, uuid[], uuid[], uuid[], uuid[], boolean),
--   private.obito_para_agir(uuid), private.obito_hora(text, public.obitos, text), private.obito_json(public.obitos, boolean),
--   private.obito_pode(public.obitos), private.obito_pode_ler(public.obitos), private.obito_pendencias(public.obitos),
--   private.registrar_obito(uuid, uuid, uuid, uuid, text, uuid, uuid, jsonb, text), private.obito_sumario(public.obitos),
--   private.obito_detalhes(jsonb, uuid), private.obito_validado(jsonb, timestamptz), private.obito_termos_vagos(text);
-- -- tabelas e coluna: ficam (dado clínico) até uma janela declarada (contract);
-- -- a CHECK maior de eventos_leito também fica enquanto houver evento 'aguardando_corpo'.
-- ════════════════════════════════════════════════════════════════════════════
