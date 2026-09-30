-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend, onda 5 — evolução médica estruturada, resumo clínico do
-- internado e histórico multiprofissional (protótipo: ESTADO.md etapa 4;
-- index.html, aba Evolução do leito).
--
-- O que muda:
--   1. Tipos de documento novos na CHECK de documentos_clinicos (acrescentados
--      sem desfazer os de outras migrations: a CHECK é LIDA do banco):
--      evolucao_enfermagem, anotacao_enfermagem, evolucao_fisioterapia,
--      evolucao_nutricao e evolucao_outros.
--   2. evolucoes_estruturadas: uma linha por VERSÃO de cada evolução, com o
--      conteúdo estruturado (JSON), o dia de referência e o papel da evolução
--      no dia. A evolução continua sendo um documento de documentos_clinicos
--      (o texto legível); o JSON fica ao lado, ligado à versão.
--   3. Regra "uma por dia por profissional" NO SERVIDOR, por tipo:
--      a primeira evolução do dia (fuso da unidade, America/Sao_Paulo) de um
--      profissional numa internação é a "evolução do dia"; a segunda do mesmo
--      dia, do mesmo profissional e do mesmo tipo, entra como COMPLEMENTO
--      daquela (documento próprio, com o texto marcado como complemento e o
--      vínculo à do dia). Mudar o que já foi escrito continua sendo CORREÇÃO
--      (só o autor, com justificativa, vira nova versão). Anotação de
--      enfermagem não tem limite diário (é registro pontual por natureza).
--   4. registrar_evolucao e corrigir_evolucao ganham o parâmetro opcional
--      p_estruturado (jsonb): chamadas antigas, com três argumentos, seguem
--      iguais. Com o JSON da evolução médica, o TEXTO é montado pelo servidor
--      (private.evolucao_texto), para que texto e JSON nunca divirjam.
--      Quem registra cada tipo (private.pode_registrar_evolucao): médica e
--      admissão, papel plantonista/gestor/admin; evolução de enfermagem, o
--      enfermeiro; anotação, enfermeiro ou técnico; fisioterapia, nutrição e
--      outros ainda NÃO têm papel no sistema, então o tipo existe (lê-se no
--      histórico) mas ninguém registra até o papel ser criado.
--   5. resumos_clinicos: o texto livre do médico no "Resumo evoluções"
--      (resumo, previsão de alta e o movimento/motivo de cada antibiótico).
--      Só inserção: o resumo vigente é o mais recente, o anterior fica.
--   6. Leituras (SECURITY DEFINER, segundo fator, acesso conferido):
--      contexto_evolucao (DIH, antimicrobianos da prescrição com dia de uso,
--      últimos sinais vitais para o "Trazer SV da enfermagem", a evolução do
--      dia do usuário e a última estruturada para herdar lista de problemas,
--      antimicrobianos e CID), resumo_clinico e historico_evolucoes.
--   7. As duas tabelas novas entram no gatilho que impede DELETE (guarda de
--      20 anos, 20261001000004).
-- Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. tipos novos na CHECK (acrescenta sem desfazer) ───────────────────────
DO $$
DECLARE v_def text; v_tipos text[]; v_novo text; v_mudou boolean := false;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.documentos_clinicos'::regclass AND conname = 'documentos_clinicos_tipo_documento_check';
  IF v_def IS NULL THEN RAISE EXCEPTION 'CHECK de tipo de documento não encontrada.'; END IF;
  SELECT array_agg(m[1] ORDER BY n) INTO v_tipos
    FROM regexp_matches(v_def, '''([a-z_0-9]+)''::text', 'g') WITH ORDINALITY AS r(m, n);
  FOREACH v_novo IN ARRAY ARRAY['evolucao_enfermagem', 'anotacao_enfermagem', 'evolucao_fisioterapia',
                                'evolucao_nutricao', 'evolucao_outros'] LOOP
    IF NOT v_novo = ANY (v_tipos) THEN v_tipos := v_tipos || v_novo; v_mudou := true; END IF;
  END LOOP;
  IF v_mudou THEN
    EXECUTE 'ALTER TABLE public.documentos_clinicos DROP CONSTRAINT documentos_clinicos_tipo_documento_check';
    EXECUTE format('ALTER TABLE public.documentos_clinicos ADD CONSTRAINT documentos_clinicos_tipo_documento_check CHECK (tipo_documento IN (%s))',
      (SELECT string_agg(quote_literal(t), ', ') FROM unnest(v_tipos) t));
  END IF;
END $$;

-- ── 2. conteúdo estruturado e papel no dia ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evolucoes_estruturadas (
  documento_id      uuid PRIMARY KEY REFERENCES public.documentos_clinicos(id),
  documento_raiz_id uuid NOT NULL,
  versao            integer NOT NULL,
  tipo_documento    text NOT NULL,
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id       uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id     uuid NOT NULL REFERENCES public.internacoes(id),
  -- o profissional dono da evolução (autor da versão 1)
  autor_id          uuid NOT NULL REFERENCES public.perfis(id),
  dia               date NOT NULL,
  papel             text NOT NULL CHECK (papel IN ('do_dia', 'complemento', 'anotacao')),
  complemento_de    uuid,
  dados             jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(dados) = 'object'),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK ((papel = 'complemento') = (complemento_de IS NOT NULL))
);
-- a regra do dia: uma evolução "do dia" por profissional, tipo e internação
CREATE UNIQUE INDEX IF NOT EXISTS uq_evolucao_do_dia ON public.evolucoes_estruturadas (internacao_id, tipo_documento, autor_id, dia)
  WHERE papel = 'do_dia' AND versao = 1;
CREATE INDEX IF NOT EXISTS evolucoes_estruturadas_internacao ON public.evolucoes_estruturadas (internacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evolucoes_estruturadas_raiz ON public.evolucoes_estruturadas (documento_raiz_id, versao);
CREATE INDEX IF NOT EXISTS evolucoes_estruturadas_paciente ON public.evolucoes_estruturadas (paciente_id);
CREATE INDEX IF NOT EXISTS evolucoes_estruturadas_unidade ON public.evolucoes_estruturadas (unidade_id);
CREATE INDEX IF NOT EXISTS evolucoes_estruturadas_autor ON public.evolucoes_estruturadas (autor_id);

ALTER TABLE public.evolucoes_estruturadas ENABLE ROW LEVEL SECURITY;
-- quem lê o documento lê a estrutura dele (a RLS de documentos_clinicos vale
-- dentro da subconsulta)
DROP POLICY IF EXISTS evolucoes_estruturadas_select ON public.evolucoes_estruturadas;
CREATE POLICY evolucoes_estruturadas_select ON public.evolucoes_estruturadas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documentos_clinicos d WHERE d.id = documento_id));
DROP POLICY IF EXISTS evolucoes_estruturadas_segundo_fator ON public.evolucoes_estruturadas;
CREATE POLICY evolucoes_estruturadas_segundo_fator ON public.evolucoes_estruturadas AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());
REVOKE ALL ON public.evolucoes_estruturadas FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.evolucoes_estruturadas FROM authenticated;
GRANT SELECT ON public.evolucoes_estruturadas TO authenticated;

-- Evoluções registradas antes desta migration: ganham a linha (dados vazios),
-- com a primeira do dia de cada profissional como "do dia" e as demais como
-- complemento dela. Só entra quem ainda não tem linha.
WITH v1 AS (
  SELECT d.id, d.documento_raiz_id, d.tipo_documento, d.unidade_id, d.paciente_id, d.internacao_id, d.autor_id,
         (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia, d.created_at,
         row_number() OVER (PARTITION BY d.internacao_id, d.tipo_documento, d.autor_id,
                                         (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date
                            ORDER BY d.created_at, d.id) AS ordem
    FROM public.documentos_clinicos d
   WHERE d.versao = 1 AND d.internacao_id IS NOT NULL
     AND d.tipo_documento IN ('evolucao', 'evolucao_enfermagem', 'evolucao_fisioterapia', 'evolucao_nutricao', 'evolucao_outros', 'anotacao_enfermagem')
), papel AS (
  SELECT v1.*,
         CASE WHEN v1.tipo_documento = 'anotacao_enfermagem' THEN 'anotacao' WHEN v1.ordem = 1 THEN 'do_dia' ELSE 'complemento' END AS papel,
         CASE WHEN v1.tipo_documento <> 'anotacao_enfermagem' AND v1.ordem > 1 THEN
           (SELECT p.documento_raiz_id FROM v1 p WHERE p.internacao_id = v1.internacao_id AND p.tipo_documento = v1.tipo_documento
               AND p.autor_id = v1.autor_id AND p.dia = v1.dia AND p.ordem = 1) END AS complemento_de
    FROM v1
)
INSERT INTO public.evolucoes_estruturadas (documento_id, documento_raiz_id, versao, tipo_documento, unidade_id, paciente_id,
  internacao_id, autor_id, dia, papel, complemento_de, dados, created_at)
SELECT d.id, d.documento_raiz_id, d.versao, d.tipo_documento, d.unidade_id, d.paciente_id, d.internacao_id, p.autor_id,
       p.dia, p.papel, p.complemento_de, '{}'::jsonb, d.created_at
  FROM papel p
  JOIN public.documentos_clinicos d ON d.documento_raiz_id = p.documento_raiz_id
 WHERE NOT EXISTS (SELECT 1 FROM public.evolucoes_estruturadas e WHERE e.documento_id = d.id);

-- ── 3. resumo clínico (texto livre do médico) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.resumos_clinicos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id  uuid NOT NULL REFERENCES public.internacoes(id),
  resumo         text NOT NULL,
  previsao_alta  text,
  -- [{item_id, movimento: mantido|escalonado|descalonado, motivo}]
  antibioticos   jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(antibioticos) = 'array'),
  autor_id       uuid NOT NULL REFERENCES public.perfis(id),
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resumos_clinicos_internacao ON public.resumos_clinicos (internacao_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS resumos_clinicos_paciente ON public.resumos_clinicos (paciente_id);
CREATE INDEX IF NOT EXISTS resumos_clinicos_unidade ON public.resumos_clinicos (unidade_id);
CREATE INDEX IF NOT EXISTS resumos_clinicos_autor ON public.resumos_clinicos (autor_id);

ALTER TABLE public.resumos_clinicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resumos_clinicos_select ON public.resumos_clinicos;
CREATE POLICY resumos_clinicos_select ON public.resumos_clinicos FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id)
         OR private.acesso_encerrado_vigente(paciente_id) OR private.teleinterconsulta_vigente(paciente_id));
DROP POLICY IF EXISTS resumos_clinicos_prontuario_aberto ON public.resumos_clinicos;
CREATE POLICY resumos_clinicos_prontuario_aberto ON public.resumos_clinicos AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.prontuario_aberto(paciente_id));
DROP POLICY IF EXISTS resumos_clinicos_segundo_fator ON public.resumos_clinicos;
CREATE POLICY resumos_clinicos_segundo_fator ON public.resumos_clinicos AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());
REVOKE ALL ON public.resumos_clinicos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.resumos_clinicos FROM authenticated;
GRANT SELECT ON public.resumos_clinicos TO authenticated;

-- ── 4. guarda de 20 anos: nada sai por DELETE ───────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['evolucoes_estruturadas', 'resumos_clinicos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica()', t);
  END LOOP;
END $$;

-- ── 5. auxiliares ───────────────────────────────────────────────────────────
-- Antimicrobiano pelo nome (princípio ativo ou descrição livre do item). Lista
-- dos de uso hospitalar comum (antibacterianos, antifúngicos e antivirais
-- sistêmicos); o que não estiver aqui aparece como "medicação em curso".
CREATE OR REPLACE FUNCTION private.eh_antimicrobiano(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT private.norm(p) ~ ('(^|[^a-z])(amoxicilina|ampicilina|oxacilina|penicilina|benzilpenicilina|piperacilina|tazobactam|sulbactam'
    || '|clavulanato|cefalexina|cefazolina|cefalotina|cefuroxima|cefoxitina|ceftriaxona|cefotaxima|ceftazidima|cefepima|ceftarolina'
    || '|ceftolozano|avibactam|meropenem|imipenem|ertapenem|aztreonam|vancomicina|teicoplanina|linezolida|daptomicina|tigeciclina'
    || '|doxiciclina|minociclina|azitromicina|claritromicina|eritromicina|clindamicina|gentamicina|amicacina|tobramicina'
    || '|estreptomicina|ciprofloxacino|levofloxacino|moxifloxacino|norfloxacino|sulfametoxazol|trimetoprima|metronidazol'
    || '|nitrofurantoina|fosfomicina|polimixina|colistina|rifampicina|isoniazida|pirazinamida|etambutol|cloranfenicol'
    || '|fluconazol|voriconazol|itraconazol|posaconazol|anfotericina|micafungina|caspofungina|anidulafungina'
    || '|aciclovir|ganciclovir|valaciclovir|oseltamivir)')
$$;

-- Reposição de eletrólito na prescrição (potássio, magnésio, cálcio, fósforo,
-- sódio hipertônico e bicarbonato).
CREATE OR REPLACE FUNCTION private.eh_reposicao_eletrolito(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT private.norm(p) ~ ('(^|[^a-z])(kcl|cloreto de potassio|fosfato de potassio|xarope de kcl|sulfato de magnesio|gluconato de calcio'
    || '|cloreto de calcio|fosfato acido de potassio|glicerofosfato|bicarbonato de sodio|nacl 3%|nacl 20%|cloreto de sodio 20%|cloreto de sodio 3%)')
$$;

-- Quem registra cada tipo. Fisioterapia, nutrição e outros: sem papel no
-- sistema ainda — o tipo existe, o registro abre quando o papel for criado.
CREATE OR REPLACE FUNCTION private.pode_registrar_evolucao(p_unidade uuid, p_tipo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN p_tipo IN ('admissao_anamnese', 'evolucao') THEN private.papel_na_unidade(p_unidade) IN ('plantonista', 'gestor', 'admin')
    WHEN p_tipo = 'evolucao_enfermagem' THEN private.tenho_papel(p_unidade, 'enfermeiro') IS TRUE
    WHEN p_tipo = 'anotacao_enfermagem' THEN private.sou_enfermagem(p_unidade) IS TRUE
    ELSE false
  END
$$;
REVOKE ALL ON FUNCTION private.pode_registrar_evolucao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pode_registrar_evolucao(uuid, text) TO authenticated;

-- Leitura do prontuário da internação: quem cuida, o gestor, o pedido de
-- acesso aprovado e a teleinterconsulta vigente.
CREATE OR REPLACE FUNCTION private.leio_internacao(i public.internacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR private.cuido_da_internacao(i) OR private.papel_na_unidade(i.unidade_id) = 'gestor'
      OR private.paciente_no_meu_plantao(i.paciente_id)
      OR private.acesso_encerrado_vigente(i.paciente_id) OR private.teleinterconsulta_vigente(i.paciente_id)
$$;
REVOKE ALL ON FUNCTION private.leio_internacao(public.internacoes) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.leio_internacao(public.internacoes) TO authenticated;

CREATE OR REPLACE FUNCTION private.data_br(p date)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT to_char(p, 'DD/MM/YYYY') $$;

-- Texto legível da evolução médica estruturada (formato do protótipo:
-- montarEvolDiaHtml). p_dia é o dia de referência (conta o D do antimicrobiano).
CREATE OR REPLACE FUNCTION private.evolucao_texto(p jsonb, p_dia date)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  t text[] := ARRAY[]::text[];
  sv jsonb := coalesce(p -> 'sv', '{}'::jsonb);
  ef jsonb := coalesce(p -> 'exame_fisico', '{}'::jsonb);
  v text; linhas text[];
  a jsonb; n int;
BEGIN
  t := t || ('EVOLUÇÃO MÉDICA' || coalesce(' · D' || nullif(btrim(p ->> 'dih'), ''), '') || ' · ' || private.data_br(p_dia));
  v := nullif(btrim(coalesce(p ->> 'alergias', '')), '');
  IF v IS NOT NULL THEN t := t || v; END IF;

  v := nullif(btrim(coalesce(p ->> 'problemas', '')), '');
  IF v IS NOT NULL THEN t := t || ('Diagnósticos / lista de problemas:' || E'\n' || v); END IF;

  linhas := ARRAY[]::text[];
  FOR a IN SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p -> 'antimicrobianos') = 'array' THEN p -> 'antimicrobianos' ELSE '[]'::jsonb END) x LOOP
    CONTINUE WHEN nullif(btrim(coalesce(a ->> 'nome', '')), '') IS NULL;
    n := NULL;
    IF coalesce(a ->> 'inicio', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN n := p_dia - (a ->> 'inicio')::date + 1; END IF;
    linhas := linhas || ('- ' || btrim(a ->> 'nome') || ' · D' || coalesce(n::text, '?')
      || CASE WHEN n IS NOT NULL THEN ' (início ' || private.data_br((a ->> 'inicio')::date) || ')' ELSE '' END);
  END LOOP;
  t := t || ('Antimicrobianos:' || CASE WHEN cardinality(linhas) = 0 THEN ' nenhum em uso.' ELSE E'\n' || array_to_string(linhas, E'\n') END);

  linhas := ARRAY[]::text[];
  FOR a IN SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p -> 'dispositivos') = 'array' THEN p -> 'dispositivos' ELSE '[]'::jsonb END) x LOOP
    linhas := linhas || ('- ' || btrim(a #>> '{}'));
  END LOOP;
  IF cardinality(linhas) > 0 THEN t := t || ('Dispositivos:' || E'\n' || array_to_string(linhas, E'\n')); END IF;

  t := t || ('S: ' || coalesce(nullif(btrim(coalesce(p ->> 's', '')), ''), '—'));

  -- O: sinais vitais como digitados, sem marca de alterado (protótipo, 26/09)
  linhas := ARRAY[]::text[];
  IF nullif(btrim(coalesce(sv ->> 'pa', '')), '') IS NOT NULL THEN linhas := linhas || ('PA ' || btrim(sv ->> 'pa') || ' mmHg'); END IF;
  IF nullif(btrim(coalesce(sv ->> 'fc', '')), '') IS NOT NULL THEN linhas := linhas || ('FC ' || btrim(sv ->> 'fc') || ' bpm'); END IF;
  IF nullif(btrim(coalesce(sv ->> 'fr', '')), '') IS NOT NULL THEN linhas := linhas || ('FR ' || btrim(sv ->> 'fr') || ' irpm'); END IF;
  IF nullif(btrim(coalesce(sv ->> 'temp', '')), '') IS NOT NULL THEN linhas := linhas || ('Temp. ' || btrim(sv ->> 'temp') || ' °C'); END IF;
  IF nullif(btrim(coalesce(sv ->> 'spo2', '')), '') IS NOT NULL THEN
    linhas := linhas || ('SpO₂ ' || btrim(sv ->> 'spo2') || '%'
      || CASE p ->> 'sv_condicao' WHEN 'ar' THEN ' em ar ambiente'
           WHEN 'o2' THEN ' em O₂' || coalesce(' ' || nullif(btrim(coalesce(p ->> 'o2_litros', '')), '') || ' L/min', '')
           ELSE '' END);
  END IF;
  IF nullif(btrim(coalesce(sv ->> 'glic', '')), '') IS NOT NULL THEN linhas := linhas || ('Glicemia ' || btrim(sv ->> 'glic') || ' mg/dL'); END IF;
  t := t || ('O: ' || CASE WHEN cardinality(linhas) = 0 THEN 'sinais vitais não informados.' ELSE array_to_string(linhas, ' · ') END);
  linhas := ARRAY[]::text[];
  IF nullif(btrim(coalesce(sv ->> 'diurese', '')), '') IS NOT NULL THEN linhas := linhas || ('Diurese: ' || btrim(sv ->> 'diurese')); END IF;
  IF nullif(btrim(coalesce(sv ->> 'evacuacao', '')), '') IS NOT NULL THEN linhas := linhas || ('Evacuação: ' || btrim(sv ->> 'evacuacao')); END IF;
  IF nullif(btrim(coalesce(sv ->> 'dieta', '')), '') IS NOT NULL THEN linhas := linhas || ('Dieta: ' || btrim(sv ->> 'dieta')); END IF;
  IF cardinality(linhas) > 0 THEN t := t || array_to_string(linhas, ' · '); END IF;

  linhas := ARRAY[]::text[];
  SELECT coalesce(array_agg('- ' || r.rot || ': ' || btrim(ef ->> r.k) ORDER BY r.o), ARRAY[]::text[]) INTO linhas
    FROM (VALUES (1, 'geral', 'Geral'), (2, 'acv', 'ACV'), (3, 'ar', 'AR'), (4, 'abdome', 'Abdome'),
                 (5, 'extremidades', 'Extremidades'), (6, 'neuro', 'Neuro')) r(o, k, rot)
   WHERE nullif(btrim(coalesce(ef ->> r.k, '')), '') IS NOT NULL;
  IF cardinality(linhas) > 0 THEN t := t || ('Exame físico:' || E'\n' || array_to_string(linhas, E'\n')); END IF;
  v := nullif(btrim(coalesce(p ->> 'outros_achados', '')), '');
  IF v IS NOT NULL THEN t := t || ('Outros achados: ' || v); END IF;
  v := nullif(btrim(coalesce(p ->> 'exames', '')), '');
  IF v IS NOT NULL THEN t := t || ('Exames complementares:' || E'\n' || v); END IF;

  t := t || ('A: ' || coalesce(nullif(btrim(coalesce(p ->> 'a', '')), ''), '—'));
  t := t || ('P: ' || coalesce(nullif(btrim(coalesce(p ->> 'p', '')), ''), '—'));

  v := nullif(btrim(coalesce(p #>> '{cid,codigo}', '')), '');
  IF v IS NOT NULL THEN
    t := t || ('Diagnóstico principal (CID-10): ' || v
      || coalesce(' — ' || nullif(btrim(coalesce(p #>> '{cid,descricao}', '')), ''), '')
      || CASE p #>> '{cid,estado}' WHEN 'confirmado' THEN ' (confirmado)' WHEN 'hipotese' THEN ' (hipótese)' ELSE '' END);
  END IF;
  RETURN array_to_string(t, E'\n\n');
END $$;
REVOKE ALL ON FUNCTION private.evolucao_texto(jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.evolucao_texto(jsonb, date) TO authenticated;

-- A evolução médica é estruturada quando o JSON diz o formato.
CREATE OR REPLACE FUNCTION private.eh_estruturada(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(p ->> 'formato', '') = 'evolucao_medica_v1'
$$;

-- Confere o JSON recebido (tamanho, tipo e os campos de estado).
CREATE OR REPLACE FUNCTION private.validar_estruturado(p jsonb, p_tipo text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p IS NULL THEN RETURN; END IF;
  IF jsonb_typeof(p) <> 'object' THEN RAISE EXCEPTION 'Conteúdo estruturado inválido.'; END IF;
  IF octet_length(p::text) > 65536 THEN RAISE EXCEPTION 'Conteúdo estruturado grande demais.'; END IF;
  IF private.eh_estruturada(p) THEN
    IF p_tipo <> 'evolucao' THEN RAISE EXCEPTION 'O formulário estruturado é da evolução médica.'; END IF;
    IF coalesce(p ->> 'sv_condicao', '') NOT IN ('', 'ar', 'o2') THEN RAISE EXCEPTION 'SpO₂: informe ar ambiente ou O₂.'; END IF;
    IF coalesce(p #>> '{cid,estado}', '') NOT IN ('', 'hipotese', 'confirmado') THEN RAISE EXCEPTION 'Estado do CID: hipótese ou confirmado.'; END IF;
    IF p ? 'antimicrobianos' AND jsonb_typeof(p -> 'antimicrobianos') <> 'array' THEN RAISE EXCEPTION 'Antimicrobianos inválidos.'; END IF;
    IF length(btrim(coalesce(p ->> 's', '') || coalesce(p ->> 'a', '') || coalesce(p ->> 'p', ''))) < 10 THEN
      RAISE EXCEPTION 'Escreva a evolução: subjetivo, avaliação ou plano.';
    END IF;
  END IF;
  IF p_tipo = 'evolucao_outros' AND length(btrim(coalesce(p ->> 'especialidade', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe a especialidade da evolução.';
  END IF;
END $$;

-- ── 6. registrar e corrigir (ampliadas, compatíveis) ────────────────────────
DROP FUNCTION IF EXISTS public.registrar_evolucao(uuid, text, text);
CREATE OR REPLACE FUNCTION public.registrar_evolucao(p_internacao uuid, p_tipo text, p_conteudo text, p_estruturado jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  v_id uuid;
  v_dia date := private.data_atual();
  v_papel text;
  v_principal public.documentos_clinicos;
  v_conteudo text;
  v_dados jsonb := coalesce(p_estruturado, '{}'::jsonb);
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF p_tipo NOT IN ('admissao_anamnese', 'evolucao', 'evolucao_enfermagem', 'anotacao_enfermagem',
                    'evolucao_fisioterapia', 'evolucao_nutricao', 'evolucao_outros') THEN
    RAISE EXCEPTION 'Tipo desconhecido.';
  END IF;
  IF NOT private.pode_registrar_evolucao(i.unidade_id, p_tipo) THEN
    RAISE EXCEPTION '%', CASE WHEN p_tipo IN ('evolucao_fisioterapia', 'evolucao_nutricao', 'evolucao_outros')
      THEN 'Esta categoria profissional ainda não tem papel no sistema: o registro abre quando o papel for criado.'
      ELSE 'Acesso negado: este tipo de registro não é do seu papel na unidade.' END;
  END IF;
  PERFORM private.validar_estruturado(p_estruturado, p_tipo);

  v_conteudo := CASE WHEN private.eh_estruturada(p_estruturado) THEN private.evolucao_texto(p_estruturado, v_dia) ELSE p_conteudo END;
  IF length(btrim(coalesce(v_conteudo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o registro.'; END IF;
  IF p_tipo = 'admissao_anamnese' AND EXISTS (
       SELECT 1 FROM public.documentos_clinicos WHERE internacao_id = i.id AND tipo_documento = 'admissao_anamnese') THEN
    RAISE EXCEPTION 'A admissão desta internação já foi registrada. Para mudar, corrija a admissão.';
  END IF;

  -- uma por dia por profissional: a segunda do dia vira complemento da primeira
  IF p_tipo NOT IN ('admissao_anamnese', 'anotacao_enfermagem') THEN
    SELECT d.* INTO v_principal
      FROM public.evolucoes_estruturadas e
      JOIN public.documentos_clinicos d ON d.id = e.documento_raiz_id
     WHERE e.internacao_id = i.id AND e.tipo_documento = p_tipo AND e.autor_id = v_perfil
       AND e.dia = v_dia AND e.papel = 'do_dia' AND e.versao = 1
     LIMIT 1;
    IF v_principal.id IS NOT NULL THEN
      v_papel := 'complemento';
      v_conteudo := 'COMPLEMENTO à evolução de ' || to_char(v_principal.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
                    || E'\n\n' || v_conteudo;
    ELSE
      v_papel := 'do_dia';
    END IF;
  ELSIF p_tipo = 'anotacao_enfermagem' THEN
    v_papel := 'anotacao';
  END IF;

  v_id := gen_random_uuid();
  INSERT INTO public.documentos_clinicos (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
    episodio_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado)
  VALUES (v_id, v_id, 1, i.organizacao_id, i.unidade_id, i.paciente_id, i.id, i.episodio_id, p_tipo, v_conteudo,
          encode(sha256(convert_to(v_conteudo, 'UTF8')), 'hex'), v_perfil, 'ativo');
  IF v_papel IS NOT NULL THEN
    INSERT INTO public.evolucoes_estruturadas (documento_id, documento_raiz_id, versao, tipo_documento, unidade_id, paciente_id,
      internacao_id, autor_id, dia, papel, complemento_de, dados)
    VALUES (v_id, v_id, 1, p_tipo, i.unidade_id, i.paciente_id, i.id, v_perfil, v_dia, v_papel,
            CASE WHEN v_papel = 'complemento' THEN v_principal.documento_raiz_id END, v_dados);
  END IF;
  RETURN v_id;
END $$;

DROP FUNCTION IF EXISTS public.corrigir_evolucao(uuid, text, text);
CREATE OR REPLACE FUNCTION public.corrigir_evolucao(p_documento uuid, p_conteudo text, p_justificativa text, p_estruturado jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d public.documentos_clinicos;
  e public.evolucoes_estruturadas;
  v_autor uuid;
  v_perfil uuid := private.meu_perfil_id();
  v_id uuid;
  v_conteudo text;
  v_principal timestamptz;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento FOR UPDATE;
  IF NOT FOUND OR d.tipo_documento NOT IN ('admissao_anamnese', 'evolucao', 'evolucao_enfermagem', 'anotacao_enfermagem',
                                           'evolucao_fisioterapia', 'evolucao_nutricao', 'evolucao_outros') THEN
    RAISE EXCEPTION 'Registro não encontrado.';
  END IF;
  IF d.estado <> 'ativo' THEN RAISE EXCEPTION 'Corrija a versão mais recente.'; END IF;
  SELECT autor_id INTO v_autor FROM public.documentos_clinicos WHERE documento_raiz_id = d.documento_raiz_id AND versao = 1;
  IF v_autor IS DISTINCT FROM v_perfil THEN
    RAISE EXCEPTION 'Só o autor corrige o próprio registro. Registre uma nova evolução.';
  END IF;
  IF length(btrim(coalesce(p_justificativa, ''))) < 10 THEN RAISE EXCEPTION 'Justifique a correção (mínimo de 10 letras).'; END IF;
  SELECT * INTO e FROM public.evolucoes_estruturadas WHERE documento_id = d.id;
  IF private.eh_estruturada(e.dados) AND NOT private.eh_estruturada(p_estruturado) THEN
    RAISE EXCEPTION 'Esta evolução é estruturada: corrija pelo formulário.';
  END IF;
  PERFORM private.validar_estruturado(p_estruturado, d.tipo_documento);
  v_conteudo := CASE WHEN private.eh_estruturada(p_estruturado)
                     THEN private.evolucao_texto(p_estruturado, coalesce(e.dia, (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date))
                     ELSE p_conteudo END;
  IF e.papel = 'complemento' AND private.eh_estruturada(p_estruturado) THEN
    SELECT created_at INTO v_principal FROM public.documentos_clinicos WHERE id = e.complemento_de;
    v_conteudo := 'COMPLEMENTO à evolução de ' || to_char(v_principal AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
                  || E'\n\n' || v_conteudo;
  END IF;
  IF length(btrim(coalesce(v_conteudo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o registro.'; END IF;
  IF encode(sha256(convert_to(v_conteudo, 'UTF8')), 'hex') = d.conteudo_hash THEN RAISE EXCEPTION 'Nada mudou no texto.'; END IF;
  INSERT INTO public.documentos_clinicos (documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
    episodio_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado, retificacao_de, motivo_retificacao)
  VALUES (d.documento_raiz_id, d.versao + 1, d.organizacao_id, d.unidade_id, d.paciente_id, d.internacao_id, d.episodio_id,
          d.tipo_documento, v_conteudo, encode(sha256(convert_to(v_conteudo, 'UTF8')), 'hex'), v_perfil, 'ativo',
          d.id, btrim(p_justificativa))
  RETURNING id INTO v_id;
  UPDATE public.documentos_clinicos SET estado = 'retificado', updated_at = now() WHERE id = d.id;
  IF e.documento_id IS NOT NULL THEN
    INSERT INTO public.evolucoes_estruturadas (documento_id, documento_raiz_id, versao, tipo_documento, unidade_id, paciente_id,
      internacao_id, autor_id, dia, papel, complemento_de, dados)
    VALUES (v_id, e.documento_raiz_id, d.versao + 1, e.tipo_documento, e.unidade_id, e.paciente_id, e.internacao_id, e.autor_id,
            e.dia, e.papel, e.complemento_de, coalesce(p_estruturado, e.dados));
  END IF;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.registrar_evolucao(uuid, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.corrigir_evolucao(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_evolucao(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.corrigir_evolucao(uuid, text, text, jsonb) TO authenticated;

-- ── 7. contexto do formulário da evolução médica ────────────────────────────
CREATE OR REPLACE FUNCTION public.contexto_evolucao(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_hoje date := private.data_atual();
  v_perfil uuid := private.meu_perfil_id();
  v_sv jsonb;
  v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.leio_internacao(i) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  -- últimos sinais vitais das 24 h (lançados pela enfermagem ou por quem for),
  -- um valor por parâmetro, com a hora e quem aferiu o mais recente
  WITH ult AS (
    SELECT DISTINCT ON (c.nome) c.nome, o.valor_num, o.valor_texto, op.valor AS opcao, o.aferido_em, o.registrado_por
      FROM public.observacao o
      JOIN public.conceito c ON c.id = o.conceito_id
      LEFT JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
     WHERE o.paciente_id = i.paciente_id AND o.aferido_em > now() - interval '24 hours'
       AND c.nome IN ('pressao-arterial-sistolica', 'pressao-arterial-diastolica', 'frequencia-cardiaca', 'frequencia-respiratoria',
                      'temperatura', 'saturacao-o2', 'glicemia-capilar', 'oxigenio-suplementar')
     ORDER BY c.nome, o.aferido_em DESC
  ), num AS (
    SELECT nome, replace(trim_scale(valor_num)::text, '.', ',') AS t FROM ult
  ), mais_recente AS (
    SELECT u.aferido_em, pf.nome_completo FROM ult u LEFT JOIN public.perfis pf ON pf.id = u.registrado_por
     ORDER BY u.aferido_em DESC LIMIT 1
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM ult) THEN NULL ELSE jsonb_build_object(
    'pa', CASE WHEN EXISTS (SELECT 1 FROM num WHERE nome = 'pressao-arterial-sistolica')
               THEN (SELECT t FROM num WHERE nome = 'pressao-arterial-sistolica')
                    || coalesce('x' || (SELECT t FROM num WHERE nome = 'pressao-arterial-diastolica'), '') END,
    'fc', (SELECT t FROM num WHERE nome = 'frequencia-cardiaca'),
    'fr', (SELECT t FROM num WHERE nome = 'frequencia-respiratoria'),
    'temp', (SELECT t FROM num WHERE nome = 'temperatura'),
    'spo2', (SELECT t FROM num WHERE nome = 'saturacao-o2'),
    'glic', (SELECT t FROM num WHERE nome = 'glicemia-capilar'),
    'condicao', (SELECT CASE WHEN opcao = 'ar' THEN 'ar' WHEN opcao IS NOT NULL THEN 'o2' END FROM ult WHERE nome = 'oxigenio-suplementar'),
    'aferido_em', (SELECT aferido_em FROM mais_recente),
    'por', (SELECT nome_completo FROM mais_recente)) END
  INTO v_sv;

  SELECT jsonb_build_object(
    'internacao_id', i.id,
    'paciente_id', i.paciente_id,
    'ativa', i.status IN ('admitido', 'em_observacao', 'internado'),
    'data_admissao', i.data_admissao,
    'dih', greatest(1, v_hoje - (i.data_admissao AT TIME ZONE 'America/Sao_Paulo')::date + 1),
    'hoje', v_hoje,
    'cid_principal', i.cid_principal,
    'pode_registrar', i.status IN ('admitido', 'em_observacao', 'internado') AND private.cuido_da_internacao(i)
                      AND private.pode_registrar_evolucao(i.unidade_id, 'evolucao'),
    -- antimicrobianos em curso na prescrição da internação; o início é o do
    -- primeiro item do mesmo medicamento nesta internação (troca de dose não
    -- zera o dia de uso)
    'antimicrobianos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'item_id', it.id,
               'nome', btrim(it.descricao || coalesce(' ' || nullif(btrim(it.dose), ''), '')
                              || coalesce(' ' || nullif(btrim(it.via), ''), '') || coalesce(' ' || nullif(btrim(it.posologia), ''), '')),
               'inicio', (ini.inicio AT TIME ZONE 'America/Sao_Paulo')::date,
               'dia', v_hoje - (ini.inicio AT TIME ZONE 'America/Sao_Paulo')::date + 1)
             ORDER BY ini.inicio)
        FROM public.prescricoes pr
        JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
        LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
        CROSS JOIN LATERAL (
          SELECT min(i2.created_at) AS inicio FROM public.prescricoes p2 JOIN public.prescricao_itens i2 ON i2.prescricao_id = p2.id
           WHERE p2.internacao_id = i.id AND p2.status <> 'rascunho'
             AND coalesce(i2.medicamento_id::text, private.norm(i2.descricao)) = coalesce(it.medicamento_id::text, private.norm(it.descricao))) ini
       WHERE pr.internacao_id = i.id AND pr.status = 'ativa' AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL
         AND private.eh_antimicrobiano(coalesce(m.principio_ativo, '') || ' ' || it.descricao)), '[]'::jsonb),
    -- dispositivos: registrados pela enfermagem (onda 7). Enquanto não houver
    -- a tabela, a lista vem vazia e a tela diz "Nenhum registrado."
    'dispositivos', '[]'::jsonb,
    'sv_enfermagem', v_sv,
    -- a evolução médica do dia do usuário (se já houver, a próxima é complemento)
    'minha_do_dia', (
      SELECT jsonb_build_object('documento_id', dv.id, 'raiz_id', e.documento_raiz_id, 'criado_em', r.created_at, 'versao', dv.versao,
                                'estruturada', private.eh_estruturada(ev.dados), 'dados', ev.dados)
        FROM public.evolucoes_estruturadas e
        JOIN public.documentos_clinicos r ON r.id = e.documento_raiz_id
        JOIN public.documentos_clinicos dv ON dv.documento_raiz_id = e.documento_raiz_id AND dv.estado = 'ativo'
        LEFT JOIN public.evolucoes_estruturadas ev ON ev.documento_id = dv.id
       WHERE e.internacao_id = i.id AND e.tipo_documento = 'evolucao' AND e.autor_id = v_perfil
         AND e.dia = v_hoje AND e.papel = 'do_dia' AND e.versao = 1
       LIMIT 1),
    -- a última evolução estruturada vigente (qualquer autor): o formulário
    -- herda lista de problemas, antimicrobianos incluídos à mão e o CID
    'ultima_estruturada', (
      SELECT jsonb_build_object('documento_id', ev.documento_id, 'criado_em', dv.created_at, 'dados', ev.dados)
        FROM public.evolucoes_estruturadas ev
        JOIN public.documentos_clinicos dv ON dv.id = ev.documento_id AND dv.estado = 'ativo'
       WHERE ev.internacao_id = i.id AND ev.tipo_documento = 'evolucao' AND private.eh_estruturada(ev.dados)
       ORDER BY dv.created_at DESC LIMIT 1)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.contexto_evolucao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contexto_evolucao(uuid) TO authenticated;

-- ── 8. resumo clínico do internado ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_resumo_clinico(p_internacao uuid, p_resumo text, p_previsao_alta text DEFAULT NULL,
  p_antibioticos jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  a jsonb;
  v_lista jsonb := '[]'::jsonb;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF NOT private.pode_registrar_evolucao(i.unidade_id, 'evolucao') THEN RAISE EXCEPTION 'Acesso negado: o resumo clínico é do médico.'; END IF;
  IF length(btrim(coalesce(p_resumo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o resumo (mínimo de 10 letras).'; END IF;
  IF jsonb_typeof(coalesce(p_antibioticos, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Antibióticos inválidos.'; END IF;
  FOR a IN SELECT x FROM jsonb_array_elements(coalesce(p_antibioticos, '[]'::jsonb)) x LOOP
    IF coalesce(a ->> 'movimento', '') NOT IN ('mantido', 'escalonado', 'descalonado') THEN
      RAISE EXCEPTION 'Movimento do antibiótico: mantido, escalonado ou descalonado.';
    END IF;
    IF coalesce(a ->> 'item_id', '') !~ '^[0-9a-f-]{36}$' OR NOT EXISTS (
         SELECT 1 FROM public.prescricao_itens it JOIN public.prescricoes pr ON pr.id = it.prescricao_id
          WHERE it.id = (a ->> 'item_id')::uuid AND pr.internacao_id = i.id) THEN
      RAISE EXCEPTION 'Antibiótico fora da prescrição desta internação.';
    END IF;
    IF a ->> 'movimento' <> 'mantido' AND length(btrim(coalesce(a ->> 'motivo', ''))) < 5 THEN
      RAISE EXCEPTION 'Diga por que o antibiótico foi escalonado ou descalonado.';
    END IF;
    v_lista := v_lista || jsonb_build_array(jsonb_build_object('item_id', a ->> 'item_id', 'movimento', a ->> 'movimento',
                                                                'motivo', nullif(btrim(coalesce(a ->> 'motivo', '')), '')));
  END LOOP;
  INSERT INTO public.resumos_clinicos (unidade_id, paciente_id, internacao_id, resumo, previsao_alta, antibioticos, autor_id)
  VALUES (i.unidade_id, i.paciente_id, i.id, btrim(p_resumo), nullif(btrim(coalesce(p_previsao_alta, '')), ''), v_lista,
          private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_resumo_clinico(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_resumo_clinico(uuid, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.resumo_clinico(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  r public.resumos_clinicos;
  v_hoje date := private.data_atual();
  v_presc uuid;
  v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.leio_internacao(i) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO r FROM public.resumos_clinicos WHERE internacao_id = i.id ORDER BY criado_em DESC LIMIT 1;
  -- a prescrição vigente da internação (a mesma de public.prescricao_vigente
  -- enquanto a internação está aberta)
  SELECT id INTO v_presc FROM public.prescricoes
   WHERE internacao_id = i.id AND status = 'ativa' ORDER BY created_at DESC LIMIT 1;

  SELECT jsonb_build_object(
    'sexo', (SELECT sexo FROM public.pacientes WHERE id = i.paciente_id),
    'dih', greatest(1, coalesce((i.data_alta AT TIME ZONE 'America/Sao_Paulo')::date, v_hoje) - (i.data_admissao AT TIME ZONE 'America/Sao_Paulo')::date + 1),
    'data_admissao', i.data_admissao,
    'ativa', i.status IN ('admitido', 'em_observacao', 'internado'),
    'pode_registrar', i.status IN ('admitido', 'em_observacao', 'internado') AND private.cuido_da_internacao(i)
                      AND private.pode_registrar_evolucao(i.unidade_id, 'evolucao'),
    'resumo', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', r.id, 'texto', r.resumo, 'previsao_alta', r.previsao_alta, 'criado_em', r.criado_em,
      'autor', (SELECT nome_completo FROM public.perfis WHERE id = r.autor_id), 'antibioticos', r.antibioticos) END,
    -- antibióticos da internação (em curso e suspensos), com o dia de uso e o
    -- movimento/motivo anotados no resumo vigente
    'antibioticos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'item_id', it.id,
               'nome', btrim(it.descricao || coalesce(' ' || nullif(btrim(it.dose), ''), '')
                              || coalesce(' ' || nullif(btrim(it.via), ''), '') || coalesce(' ' || nullif(btrim(it.posologia), ''), '')),
               'inicio', ini.inicio,
               'suspenso_em', it.suspenso_em,
               'motivo_suspensao', it.motivo_suspensao,
               'em_curso', it.suspenso_em IS NULL AND pr.status = 'ativa',
               'dia', coalesce((it.suspenso_em AT TIME ZONE 'America/Sao_Paulo')::date, v_hoje) - (ini.inicio AT TIME ZONE 'America/Sao_Paulo')::date + 1,
               'movimento', an ->> 'movimento',
               'motivo', an ->> 'motivo')
             ORDER BY (it.suspenso_em IS NULL) DESC, ini.inicio)
        FROM public.prescricoes pr
        JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
        LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
        CROSS JOIN LATERAL (
          SELECT min(i2.created_at) AS inicio FROM public.prescricoes p2 JOIN public.prescricao_itens i2 ON i2.prescricao_id = p2.id
           WHERE p2.internacao_id = i.id AND p2.status <> 'rascunho'
             AND coalesce(i2.medicamento_id::text, private.norm(i2.descricao)) = coalesce(it.medicamento_id::text, private.norm(it.descricao))) ini
        LEFT JOIN LATERAL (
          SELECT x AS an FROM jsonb_array_elements(coalesce(r.antibioticos, '[]'::jsonb)) x WHERE x ->> 'item_id' = it.id::text LIMIT 1) ann ON true
       WHERE pr.internacao_id = i.id AND pr.status <> 'rascunho' AND it.tipo = 'medicamento'
         AND private.eh_antimicrobiano(coalesce(m.principio_ativo, '') || ' ' || it.descricao)), '[]'::jsonb),
    -- medicações em curso: a prescrição vigente, sem os antimicrobianos
    'medicacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'item_id', it.id,
               'nome', btrim(it.descricao || coalesce(' ' || nullif(btrim(it.dose), ''), '')),
               'via', concat_ws(' · ', nullif(btrim(coalesce(it.via, '')), ''), nullif(btrim(coalesce(it.posologia, '')), ''),
                                CASE WHEN it.se_necessario THEN 'se necessário' END),
               'desde', it.created_at,
               'reposicao', private.eh_reposicao_eletrolito(it.descricao))
             ORDER BY it.ordem, it.created_at)
        FROM public.prescricao_itens it
        LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
       WHERE it.prescricao_id = v_presc AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL
         AND NOT private.eh_antimicrobiano(coalesce(m.principio_ativo, '') || ' ' || it.descricao)), '[]'::jsonb),
    -- eletrólitos: os dois últimos valores de cada um nesta internação
    'eletrolitos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('nome', x.nome, 'valor', x.valor, 'unidade', x.unidade, 'flag', x.flag,
                                          'aferido_em', x.aferido_em) ORDER BY x.ordem, x.aferido_em DESC)
        FROM (
          SELECT c.nome, replace(trim_scale(o.valor_num)::text, '.', ',') AS valor, coalesce(o.unidade, c.unidade_padrao) AS unidade,
                 o.flag, o.aferido_em, c.ordem_exibicao AS ordem,
                 row_number() OVER (PARTITION BY c.nome ORDER BY o.aferido_em DESC) AS n
            FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
           WHERE o.paciente_id = i.paciente_id AND o.valor_num IS NOT NULL
             AND o.aferido_em >= i.data_admissao - interval '1 day'
             AND o.aferido_em <= coalesce(i.data_alta, 'infinity'::timestamptz)
             AND c.nome IN ('sodio', 'potassio', 'magnesio', 'calcio-total', 'cloro', 'fosforo', 'bicarbonato')
        ) x WHERE x.n <= 2), '[]'::jsonb),
    -- reposições de eletrólito prescritas nesta internação (em curso e as já suspensas)
    'reposicoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'item_id', it.id,
               'nome', btrim(it.descricao || coalesce(' ' || nullif(btrim(it.dose), ''), '')),
               'via', concat_ws(' · ', nullif(btrim(coalesce(it.via, '')), ''), nullif(btrim(coalesce(it.posologia, '')), '')),
               'desde', it.created_at, 'suspenso_em', it.suspenso_em) ORDER BY it.created_at DESC)
        FROM public.prescricoes pr JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
       WHERE pr.internacao_id = i.id AND pr.status <> 'rascunho' AND it.tipo = 'medicamento'
         AND private.eh_reposicao_eletrolito(it.descricao)), '[]'::jsonb),
    -- condutas: o "P" das evoluções médicas estruturadas vigentes, mais recentes primeiro
    'condutas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('texto', c.p, 'quando', c.created_at, 'quem', c.nome) ORDER BY c.created_at DESC)
        FROM (
          SELECT btrim(ev.dados ->> 'p') AS p, dv.created_at, pf.nome_completo AS nome
            FROM public.evolucoes_estruturadas ev
            JOIN public.documentos_clinicos dv ON dv.id = ev.documento_id AND dv.estado = 'ativo'
            LEFT JOIN public.perfis pf ON pf.id = ev.autor_id
           WHERE ev.internacao_id = i.id AND ev.tipo_documento = 'evolucao' AND private.eh_estruturada(ev.dados)
             AND length(btrim(coalesce(ev.dados ->> 'p', ''))) > 0
           ORDER BY dv.created_at DESC LIMIT 12) c), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.resumo_clinico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_clinico(uuid) TO authenticated;

-- ── 9. histórico multiprofissional ──────────────────────────────────────────
-- A versão vigente de cada registro da internação (admissão e os seis tipos
-- de evolução), com o autor original, a especialidade e o papel no dia.
CREATE OR REPLACE FUNCTION public.historico_evolucoes(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes; v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.leio_internacao(i) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'raiz_id', d.documento_raiz_id,
           'tipo', d.tipo_documento,
           'versao', d.versao,
           'estado', d.estado,
           'registrado_em', r.created_at,
           'corrigido_em', CASE WHEN d.versao > 1 THEN d.created_at END,
           'motivo_correcao', d.motivo_retificacao,
           'autor_id', r.autor_id,
           'autor', pf.nome_completo,
           'especialidade', CASE d.tipo_documento
               WHEN 'evolucao' THEN 'Médica' WHEN 'admissao_anamnese' THEN 'Médica'
               WHEN 'evolucao_enfermagem' THEN 'Enfermagem' WHEN 'anotacao_enfermagem' THEN 'Enfermagem'
               WHEN 'evolucao_fisioterapia' THEN 'Fisioterapia' WHEN 'evolucao_nutricao' THEN 'Nutrição'
               ELSE coalesce(nullif(btrim(coalesce(ev.dados ->> 'especialidade', '')), ''), 'Outros') END,
           'papel', ev.papel,
           'estruturada', coalesce(private.eh_estruturada(ev.dados), false),
           'texto', d.conteudo) ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v
    FROM public.documentos_clinicos d
    JOIN public.documentos_clinicos r ON r.id = d.documento_raiz_id
    LEFT JOIN public.perfis pf ON pf.id = r.autor_id
    LEFT JOIN public.evolucoes_estruturadas ev ON ev.documento_id = d.id
   WHERE d.internacao_id = i.id AND d.estado IN ('ativo', 'assinado', 'cancelado')
     AND d.tipo_documento IN ('admissao_anamnese', 'evolucao', 'evolucao_enfermagem', 'anotacao_enfermagem',
                              'evolucao_fisioterapia', 'evolucao_nutricao', 'evolucao_outros');
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.historico_evolucoes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.historico_evolucoes(uuid) TO authenticated;
