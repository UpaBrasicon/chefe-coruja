-- Ponto 10 do plantonista (docs/plantonista/PONTO-10-ADMISSAO.md; o RT
-- escolheu em 31/10/2026 o modelo B, "uma admissão + reavaliação").
--
-- 1. Uma admissão por internação, com trava no banco: índice único do
--    documento (versão 1) e da ficha vigente. Antes, só registrar_evolucao
--    conferia.
-- 2. Corrigir a admissão: public.corrigir_admissao corrige o texto pelo
--    caminho de sempre (corrigir_evolucao: só o autor, com justificativa) e
--    grava a ficha nova como vigente. A ficha anterior fica guardada, ligada à
--    versão antiga do documento (a folha da versão antiga continua igual).
--    Uma correção da admissão que tem ficha sem levar a ficha é recusada
--    (gatilho de restrição, conferido no fim da transação).
-- 3. Reavaliação do quadro: documento novo (tipo 'reavaliacao_quadro'),
--    ligado à admissão, para mudança importante do quadro: o que mudou,
--    história, exame, hipótese diagnóstica e plano. A admissão não muda.
--    public.registrar_reavaliacao_quadro grava; public.reavaliacoes_do_quadro
--    lê.
--
-- Expand: colunas, índices, tabela, funções e gatilho novos; registrar_admissao
-- passa a chamar a validação que agora mora em private.validar_ficha_admissao
-- (a mesma regra, sem mudança); o tipo do documento ganha um valor.
-- Rollback (testado na homologação):
--   DROP FUNCTION IF EXISTS public.reavaliacoes_do_quadro(uuid);
--   DROP FUNCTION IF EXISTS public.registrar_reavaliacao_quadro(uuid, text, jsonb);
--   DROP FUNCTION IF EXISTS public.corrigir_admissao(uuid, text, jsonb, text);
--   DROP TRIGGER IF EXISTS trg_admissao_corrigida_com_ficha ON public.documentos_clinicos;
--   DROP FUNCTION IF EXISTS private.admissao_corrigida_com_ficha();
--   (registrar_admissao volta à versão de 20261022000005, com a validação dentro)
--   DROP FUNCTION IF EXISTS private.validar_ficha_admissao(public.internacoes, jsonb);
--   DROP TABLE IF EXISTS public.reavaliacoes_quadro;
--   (o CHECK de tipo_documento volta sem 'reavaliacao_quadro', se não houver nenhum)
--   DROP INDEX IF EXISTS public.uq_admissao_por_internacao;
--   DROP INDEX IF EXISTS public.uq_admissao_ficha_vigente;
--   ALTER TABLE public.admissao_fichas DROP COLUMN IF EXISTS justificativa, DROP COLUMN IF EXISTS vigente;

-- ── 1. uma admissão por internação ─────────────────────────────────────────
ALTER TABLE public.admissao_fichas ADD COLUMN IF NOT EXISTS vigente boolean NOT NULL DEFAULT true;
ALTER TABLE public.admissao_fichas ADD COLUMN IF NOT EXISTS justificativa text;
COMMENT ON COLUMN public.admissao_fichas.vigente IS 'A ficha da versão em vigor da admissão. A corrigida fica com false, ligada à versão antiga do documento.';
COMMENT ON COLUMN public.admissao_fichas.justificativa IS 'Motivo da correção (a ficha da primeira versão não tem).';
CREATE UNIQUE INDEX IF NOT EXISTS uq_admissao_ficha_vigente ON public.admissao_fichas (internacao_id) WHERE vigente;
CREATE UNIQUE INDEX IF NOT EXISTS uq_admissao_por_internacao ON public.documentos_clinicos (internacao_id)
  WHERE tipo_documento = 'admissao_anamnese' AND versao = 1;

-- ── tipo novo de documento ─────────────────────────────────────────────────
ALTER TABLE public.documentos_clinicos DROP CONSTRAINT IF EXISTS documentos_clinicos_tipo_documento_check;
ALTER TABLE public.documentos_clinicos ADD CONSTRAINT documentos_clinicos_tipo_documento_check CHECK (tipo_documento = ANY (ARRAY[
  'admissao_anamnese', 'evolucao', 'prescricao', 'sumario_alta', 'sumario_obito', 'atestado', 'termo_consentimento',
  'boletim_emergencia', 'partograma', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'teleinterconsulta',
  'parecer', 'evolucao_enfermagem', 'anotacao_enfermagem', 'evolucao_fisioterapia', 'evolucao_nutricao', 'evolucao_outros',
  'reavaliacao_quadro'])) NOT VALID;
ALTER TABLE public.documentos_clinicos VALIDATE CONSTRAINT documentos_clinicos_tipo_documento_check;

-- ── validação da ficha (a de registrar_admissao, sem mudança) ──────────────
CREATE OR REPLACE FUNCTION private.validar_ficha_admissao(i public.internacoes, p_ficha jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_det jsonb := coalesce(p_ficha -> 'detalhes', '[]'::jsonb);
  v_falta text[] := '{}';
  d jsonb;
  v_setor_nome text;
BEGIN
  IF p_ficha IS NULL OR jsonb_typeof(p_ficha) <> 'object' THEN RAISE EXCEPTION 'Ficha de admissão inválida.'; END IF;
  IF octet_length(p_ficha::text) > 65536 THEN RAISE EXCEPTION 'Ficha de admissão grande demais.'; END IF;
  IF jsonb_typeof(v_det) <> 'array' THEN RAISE EXCEPTION 'Detalhes da admissão inválidos.'; END IF;
  -- pendências do protótipo (admPendencias), conferidas aqui também
  IF length(btrim(coalesce(p_ficha ->> 'subjetivo', ''))) = 0 THEN v_falta := array_append(v_falta, 'Subjetivo'); END IF;
  IF length(btrim(coalesce(p_ficha ->> 'objetivo', ''))) = 0 THEN v_falta := array_append(v_falta, 'Objetivo'); END IF;
  IF length(btrim(coalesce(p_ficha ->> 'cid', ''))) = 0 THEN v_falta := array_append(v_falta, 'Hipótese diagnóstica'); END IF;
  IF length(btrim(coalesce(p_ficha ->> 'plano', ''))) = 0 THEN v_falta := array_append(v_falta, 'Avaliação inicial e plano de tratamento'); END IF;
  IF jsonb_array_length(v_det) = 0
     AND EXISTS (SELECT 1 FROM public.admissao_detalhes_obrigatorio o WHERE o.setor_id = i.setor_atual_id)
     AND EXISTS (SELECT 1 FROM public.admissao_detalhes_esquemas e WHERE e.unidade_id = i.unidade_id AND e.ativo) THEN
    SELECT nome INTO v_setor_nome FROM public.setores WHERE id = i.setor_atual_id;
    v_falta := array_append(v_falta, 'Detalhes da admissão (obrigatório no setor ' || coalesce(v_setor_nome, '') || ')');
  END IF;
  IF cardinality(v_falta) > 0 THEN
    RAISE EXCEPTION 'Falta para registrar a admissão: %.', array_to_string(v_falta, ', ');
  END IF;
  -- cada detalhe precisa existir na configuração ativa da unidade
  FOR d IN SELECT * FROM jsonb_array_elements(v_det) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.admissao_detalhes_esquemas e
                    WHERE e.unidade_id = i.unidade_id AND e.ativo AND e.nome = d ->> 'esquema' AND (d ->> 'item') = ANY (e.itens)) THEN
      RAISE EXCEPTION 'Detalhe da admissão fora da configuração da unidade: %.', coalesce(d ->> 'esquema', '') || ' · ' || coalesce(d ->> 'item', '');
    END IF;
  END LOOP;
  RETURN v_det;
END $$;
REVOKE ALL ON FUNCTION private.validar_ficha_admissao(public.internacoes, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.validar_ficha_admissao(public.internacoes, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_admissao(p_internacao uuid, p_conteudo text, p_ficha jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  i public.internacoes;
  v_id uuid;
  v_det jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_ficha IS NULL OR jsonb_typeof(p_ficha) <> 'object' THEN RAISE EXCEPTION 'Ficha de admissão inválida.'; END IF;
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  v_det := private.validar_ficha_admissao(i, p_ficha);

  -- o texto vai para o prontuário pelo caminho de sempre (acesso, plantão, 1 admissão)
  v_id := public.registrar_evolucao(p_internacao, 'admissao_anamnese', p_conteudo);
  INSERT INTO public.admissao_fichas (documento_id, documento_raiz_id, internacao_id, unidade_id, paciente_id, setor_id, autor_id, dados, detalhes)
  VALUES (v_id, v_id, i.id, i.unidade_id, i.paciente_id, i.setor_atual_id, private.meu_perfil_id(), p_ficha - 'detalhes', v_det);
  RETURN v_id;
END $$;

-- ── 2. corrigir a admissão ─────────────────────────────────────────────────
-- A correção da admissão que tem ficha leva a ficha junto (corrigir_admissao).
CREATE OR REPLACE FUNCTION private.admissao_corrigida_com_ficha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admissao_fichas WHERE documento_raiz_id = NEW.documento_raiz_id)
     AND NOT EXISTS (SELECT 1 FROM public.admissao_fichas WHERE documento_id = NEW.id) THEN
    RAISE EXCEPTION 'Corrija a admissão pela aba Admissão (Corrigir): a ficha vai junto com o texto.';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.admissao_corrigida_com_ficha() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_admissao_corrigida_com_ficha ON public.documentos_clinicos;
CREATE CONSTRAINT TRIGGER trg_admissao_corrigida_com_ficha
  AFTER INSERT ON public.documentos_clinicos
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (NEW.tipo_documento = 'admissao_anamnese' AND NEW.versao > 1)
  EXECUTE FUNCTION private.admissao_corrigida_com_ficha();

-- p_documento: a versão em vigor da admissão. Só o autor corrige, com
-- justificativa (as regras de corrigir_evolucao).
CREATE OR REPLACE FUNCTION public.corrigir_admissao(p_documento uuid, p_conteudo text, p_ficha jsonb, p_justificativa text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d public.documentos_clinicos;
  i public.internacoes;
  f public.admissao_fichas;
  v_det jsonb;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento;
  IF NOT FOUND OR d.tipo_documento <> 'admissao_anamnese' THEN RAISE EXCEPTION 'Admissão não encontrada.'; END IF;
  SELECT * INTO i FROM public.internacoes WHERE id = d.internacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  v_det := private.validar_ficha_admissao(i, p_ficha);

  v_id := public.corrigir_evolucao(p_documento, p_conteudo, p_justificativa, NULL);

  SELECT * INTO f FROM public.admissao_fichas WHERE internacao_id = i.id AND vigente FOR UPDATE;
  UPDATE public.admissao_fichas SET vigente = false WHERE internacao_id = i.id AND vigente;
  INSERT INTO public.admissao_fichas (documento_id, documento_raiz_id, internacao_id, unidade_id, paciente_id, setor_id, autor_id,
    dados, detalhes, vigente, justificativa)
  VALUES (v_id, d.documento_raiz_id, i.id, i.unidade_id, i.paciente_id, coalesce(f.setor_id, i.setor_atual_id), private.meu_perfil_id(),
          p_ficha - 'detalhes', v_det, true, btrim(p_justificativa));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.corrigir_admissao(uuid, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corrigir_admissao(uuid, text, jsonb, text) TO authenticated;

-- a ficha lida na tela é a vigente
CREATE OR REPLACE FUNCTION public.admissao_ficha(p_internacao uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  i public.internacoes;
  f public.admissao_fichas;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF private.segundo_fator_ok() IS NOT TRUE OR private.pode_atuar_no_paciente(i.paciente_id) IS NOT TRUE
     OR NOT private.prontuario_aberto(i.paciente_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT * INTO f FROM public.admissao_fichas WHERE internacao_id = p_internacao ORDER BY vigente DESC, criado_em DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN f.dados || jsonb_build_object('detalhes', f.detalhes, 'documento_id', f.documento_id, 'criado_em', f.criado_em);
END $$;

-- ── 3. reavaliação do quadro ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reavaliacoes_quadro (
  documento_id uuid PRIMARY KEY REFERENCES public.documentos_clinicos(id),
  admissao_raiz_id uuid NOT NULL REFERENCES public.documentos_clinicos(id),
  internacao_id uuid NOT NULL REFERENCES public.internacoes(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id),
  autor_id uuid NOT NULL REFERENCES public.perfis(id),
  dados jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.reavaliacoes_quadro IS 'Reavaliação do quadro (ponto 10 do plantonista): mudança importante do quadro, ligada à admissão. Lida e gravada só pelas funções.';
CREATE INDEX IF NOT EXISTS reavaliacoes_quadro_internacao ON public.reavaliacoes_quadro (internacao_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_reavaliacoes_quadro_admissao ON public.reavaliacoes_quadro (admissao_raiz_id);
CREATE INDEX IF NOT EXISTS idx_reavaliacoes_quadro_unidade ON public.reavaliacoes_quadro (unidade_id);
CREATE INDEX IF NOT EXISTS idx_reavaliacoes_quadro_paciente ON public.reavaliacoes_quadro (paciente_id);
CREATE INDEX IF NOT EXISTS idx_reavaliacoes_quadro_autor ON public.reavaliacoes_quadro (autor_id);
ALTER TABLE public.reavaliacoes_quadro ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reavaliacoes_quadro FROM PUBLIC, anon, authenticated;

-- p_dados: {motivo, subjetivo, objetivo, cid, plano}; p_conteudo: o texto legível.
CREATE OR REPLACE FUNCTION public.registrar_reavaliacao_quadro(p_internacao uuid, p_conteudo text, p_dados jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  i public.internacoes;
  v_adm uuid;
  v_id uuid := gen_random_uuid();
  v_falta text[] := '{}';
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  -- é registro do médico (o mesmo papel da admissão)
  IF NOT private.pode_registrar_evolucao(i.unidade_id, 'admissao_anamnese') THEN
    RAISE EXCEPTION 'Acesso negado: a reavaliação do quadro é do médico.';
  END IF;
  SELECT documento_raiz_id INTO v_adm FROM public.documentos_clinicos
   WHERE internacao_id = i.id AND tipo_documento = 'admissao_anamnese' AND versao = 1;
  IF v_adm IS NULL THEN RAISE EXCEPTION 'Registre a admissão antes da reavaliação do quadro.'; END IF;

  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN RAISE EXCEPTION 'Reavaliação inválida.'; END IF;
  IF octet_length(p_dados::text) > 65536 THEN RAISE EXCEPTION 'Reavaliação grande demais.'; END IF;
  IF length(btrim(coalesce(p_dados ->> 'motivo', ''))) = 0 THEN v_falta := array_append(v_falta, 'O que mudou no quadro'); END IF;
  IF length(btrim(coalesce(p_dados ->> 'subjetivo', ''))) = 0 THEN v_falta := array_append(v_falta, 'História'); END IF;
  IF length(btrim(coalesce(p_dados ->> 'objetivo', ''))) = 0 THEN v_falta := array_append(v_falta, 'Exame'); END IF;
  IF length(btrim(coalesce(p_dados ->> 'cid', ''))) = 0 THEN v_falta := array_append(v_falta, 'Hipótese diagnóstica'); END IF;
  IF length(btrim(coalesce(p_dados ->> 'plano', ''))) = 0 THEN v_falta := array_append(v_falta, 'Plano'); END IF;
  IF cardinality(v_falta) > 0 THEN
    RAISE EXCEPTION 'Falta para registrar a reavaliação: %.', array_to_string(v_falta, ', ');
  END IF;
  IF length(btrim(coalesce(p_conteudo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva a reavaliação.'; END IF;

  INSERT INTO public.documentos_clinicos (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
    episodio_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado, numero, emitido_em)
  VALUES (v_id, v_id, 1, i.organizacao_id, i.unidade_id, i.paciente_id, i.id, i.episodio_id, 'reavaliacao_quadro', p_conteudo,
          encode(sha256(convert_to(p_conteudo, 'UTF8')), 'hex'), private.meu_perfil_id(), 'ativo',
          private.gerar_numero_documento(i.unidade_id), now());
  INSERT INTO public.reavaliacoes_quadro (documento_id, admissao_raiz_id, internacao_id, unidade_id, paciente_id, autor_id, dados)
  VALUES (v_id, v_adm, i.id, i.unidade_id, i.paciente_id, private.meu_perfil_id(), p_dados);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_reavaliacao_quadro(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_reavaliacao_quadro(uuid, text, jsonb) TO authenticated;

-- as reavaliações da internação, em ordem (mesmo acesso da ficha da admissão)
CREATE OR REPLACE FUNCTION public.reavaliacoes_do_quadro(p_internacao uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  i public.internacoes;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF private.segundo_fator_ok() IS NOT TRUE OR private.pode_atuar_no_paciente(i.paciente_id) IS NOT TRUE
     OR NOT private.prontuario_aberto(i.paciente_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(r.dados || jsonb_build_object('documento_id', r.documento_id, 'criado_em', r.criado_em,
             'numero', d.numero, 'estado', d.estado, 'autor', p.nome_completo) ORDER BY r.criado_em)
      FROM public.reavaliacoes_quadro r
      JOIN public.documentos_clinicos d ON d.id = r.documento_id
      LEFT JOIN public.perfis p ON p.id = r.autor_id
     WHERE r.internacao_id = p_internacao), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.reavaliacoes_do_quadro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reavaliacoes_do_quadro(uuid) TO authenticated;
