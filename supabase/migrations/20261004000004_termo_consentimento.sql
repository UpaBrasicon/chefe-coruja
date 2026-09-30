-- Porte do frontend, onda 4 — termo de consentimento livre e esclarecido
-- (protótipo: leito › "Parecer e termos" e Unidade › Configurações ›
-- "Termos de consentimento"; ESTADO.md etapa 11).
--
-- 1. Modelos de termo da UNIDADE (public.termos_modelos): título,
--    procedimento, texto técnico com campos {paciente}, {procedimento},
--    {medico}… e a declaração jurídica. Editar cria VERSÃO NOVA (a antiga fica,
--    marcada como substituída); desativar tira o modelo da escolha do médico
--    sem apagar nada. Só o gestor da unidade escreve (RPC); os profissionais
--    clínicos da unidade leem os modelos ativos.
-- 2. O termo do paciente vira DOCUMENTO NUMERADO no prontuário
--    (documentos_clinicos, tipo termo_consentimento) pela mesma porta dos
--    outros documentos (private.gravar_documento_episodio): número da
--    unidade, hash, retificação que cria versão nova e deixa a anterior como
--    'retificado'. Quem assina: o paciente; ou, quando ele não tem condições
--    ou é menor de 14 anos, o responsável (nome, documento e vínculo); ou
--    ninguém presente — o menor sem responsável pode ser atendido (regra da
--    unidade), e o termo registra a ausência com o motivo.
-- 3. Cancelar pede justificativa (public.termos_cancelamentos); nada se apaga.
--
-- Impressão (folha do TCLE) e assinatura digital ficam para a onda 6.
-- Escritas com segundo fator (ADR 0010). Reaplicável.

-- ── modelos da unidade ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.termos_modelos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raiz_id            uuid NOT NULL,
  versao             integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  unidade_id         uuid NOT NULL REFERENCES public.unidades(id),
  titulo             text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 3 AND 120),
  procedimento       text NOT NULL CHECK (length(btrim(procedimento)) BETWEEN 3 AND 200),
  texto              text NOT NULL CHECK (length(btrim(texto)) BETWEEN 20 AND 20000),
  declaracao         text CHECK (declaracao IS NULL OR length(declaracao) <= 4000),
  ativo              boolean NOT NULL DEFAULT true,
  -- false: esta versão foi substituída por uma edição (fica para o histórico)
  vigente            boolean NOT NULL DEFAULT true,
  criado_por         uuid NOT NULL REFERENCES public.perfis(id),
  criado_em          timestamptz NOT NULL DEFAULT now(),
  ativo_alterado_em  timestamptz,
  ativo_alterado_por uuid REFERENCES public.perfis(id),
  UNIQUE (raiz_id, versao)
);
CREATE UNIQUE INDEX IF NOT EXISTS termos_modelos_vigente ON public.termos_modelos (raiz_id) WHERE vigente;
CREATE INDEX IF NOT EXISTS termos_modelos_unidade ON public.termos_modelos (unidade_id, titulo) WHERE vigente;

-- o conteúdo de uma versão não muda: editar é inserir a versão seguinte
CREATE OR REPLACE FUNCTION private.termos_modelos_conteudo_fixo()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.raiz_id, NEW.versao, NEW.unidade_id, NEW.titulo, NEW.procedimento, NEW.texto, NEW.declaracao,
      NEW.criado_por, NEW.criado_em)
     IS DISTINCT FROM
     (OLD.raiz_id, OLD.versao, OLD.unidade_id, OLD.titulo, OLD.procedimento, OLD.texto, OLD.declaracao,
      OLD.criado_por, OLD.criado_em) THEN
    RAISE EXCEPTION 'O texto de um modelo de termo não muda: editar cria versão nova.';
  END IF;
  IF OLD.vigente IS FALSE AND NEW.vigente IS TRUE THEN
    RAISE EXCEPTION 'Versão substituída não volta a valer.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_termos_modelos_conteudo_fixo ON public.termos_modelos;
CREATE TRIGGER trg_termos_modelos_conteudo_fixo BEFORE UPDATE ON public.termos_modelos
  FOR EACH ROW EXECUTE FUNCTION private.termos_modelos_conteudo_fixo();
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.termos_modelos;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.termos_modelos
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

ALTER TABLE public.termos_modelos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.termos_modelos FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.termos_modelos FROM authenticated;
GRANT SELECT ON public.termos_modelos TO authenticated;

-- gestor (e admin) da unidade veem tudo, com o histórico; quem é clínico na
-- unidade vê só a versão vigente dos modelos ativos (o que o médico escolhe)
DROP POLICY IF EXISTS termos_modelos_select ON public.termos_modelos;
CREATE POLICY termos_modelos_select ON public.termos_modelos FOR SELECT TO authenticated
  USING (private.eh_super_admin()
         OR private.tenho_papel(unidade_id, 'gestor')
         OR private.tenho_papel(unidade_id, 'admin')
         OR (vigente AND ativo AND (private.tenho_papel(unidade_id, 'plantonista')
                                    OR private.tenho_papel(unidade_id, 'enfermeiro')
                                    OR private.tenho_papel(unidade_id, 'tecnico_enfermagem')
                                    OR private.tenho_papel(unidade_id, 'telemedicina'))));
DROP POLICY IF EXISTS termos_modelos_segundo_fator ON public.termos_modelos;
CREATE POLICY termos_modelos_segundo_fator ON public.termos_modelos AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- ── cancelamento do termo (a justificativa fica; o documento não se apaga) ─
CREATE TABLE IF NOT EXISTS public.termos_cancelamentos (
  documento_id  uuid PRIMARY KEY REFERENCES public.documentos_clinicos(id),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id),
  motivo        text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  cancelado_por uuid NOT NULL REFERENCES public.perfis(id),
  cancelado_em  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.termos_cancelamentos ENABLE ROW LEVEL SECURITY;
-- lido só pela RPC do painel (que confere acesso e prontuário aberto)
REVOKE ALL ON public.termos_cancelamentos FROM anon, authenticated, PUBLIC;
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.termos_cancelamentos;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.termos_cancelamentos
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

-- ── campos do texto: {paciente}, {procedimento}, {medico}… ─────────────────
-- A mesma lista está em src/components/termo/termo.ts (pré-visualização).
CREATE OR REPLACE FUNCTION private.preencher_campos_termo(p_texto text, p_campos jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE r text := p_texto; k text; v text;
BEGIN
  IF r IS NULL THEN RETURN NULL; END IF;
  FOR k, v IN SELECT key, value FROM jsonb_each_text(coalesce(p_campos, '{}'::jsonb)) LOOP
    r := replace(r, '{' || k || '}', coalesce(v, ''));
  END LOOP;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.preencher_campos_termo(text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.declaracao_padrao_termo()
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 'declaro que recebi as informações acima, tive a oportunidade de fazer perguntas e autorizo a realização '
      || 'do procedimento descrito. Sei que posso retirar este consentimento antes do procedimento.'
$$;
REVOKE ALL ON FUNCTION private.declaracao_padrao_termo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.declaracao_padrao_termo() TO authenticated;

-- ── gestor: criar e editar (= versão nova) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.salvar_modelo_termo(
  p_unidade uuid, p_titulo text, p_procedimento text, p_texto text,
  p_declaracao text DEFAULT NULL, p_modelo uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_ant public.termos_modelos;
  v_id uuid;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_proc text := btrim(coalesce(p_procedimento, ''));
  v_texto text := btrim(coalesce(p_texto, ''));
  v_decl text := nullif(btrim(coalesce(p_declaracao, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado: os modelos de termo são do gestor da unidade.';
  END IF;
  IF length(v_titulo) < 3 THEN RAISE EXCEPTION 'Dê um nome ao modelo (mínimo de 3 letras).'; END IF;
  IF length(v_proc) < 3 THEN RAISE EXCEPTION 'Informe o procedimento do modelo.'; END IF;
  IF length(v_texto) < 20 THEN
    RAISE EXCEPTION 'Escreva o texto técnico: o que é, benefícios, riscos e alternativas (mínimo de 20 letras).';
  END IF;

  IF p_modelo IS NOT NULL THEN
    SELECT * INTO v_ant FROM public.termos_modelos WHERE id = p_modelo FOR UPDATE;
    IF NOT FOUND OR v_ant.unidade_id <> p_unidade THEN RAISE EXCEPTION 'Modelo não encontrado nesta unidade.'; END IF;
    IF NOT v_ant.vigente THEN
      RAISE EXCEPTION 'Este modelo já foi editado por outra pessoa. Recarregue a lista e edite a versão atual.';
    END IF;
    IF (v_ant.titulo, v_ant.procedimento, v_ant.texto, v_ant.declaracao) IS NOT DISTINCT FROM (v_titulo, v_proc, v_texto, v_decl) THEN
      RETURN v_ant.id;  -- nada mudou: não cria versão
    END IF;
    UPDATE public.termos_modelos SET vigente = false WHERE id = v_ant.id;
  ELSIF EXISTS (SELECT 1 FROM public.termos_modelos
                 WHERE unidade_id = p_unidade AND vigente AND lower(titulo) = lower(v_titulo)) THEN
    RAISE EXCEPTION 'Já existe um modelo com este nome nesta unidade. Edite o que existe.';
  END IF;

  INSERT INTO public.termos_modelos (raiz_id, versao, unidade_id, titulo, procedimento, texto, declaracao, ativo, criado_por)
  VALUES (coalesce(v_ant.raiz_id, gen_random_uuid()), coalesce(v_ant.versao, 0) + 1, p_unidade,
          v_titulo, v_proc, v_texto, v_decl, coalesce(v_ant.ativo, true), v_perfil)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria(CASE WHEN v_ant.id IS NULL THEN 'criar_modelo_termo' ELSE 'editar_modelo_termo' END,
    'termos_modelos', v_id, p_unidade, jsonb_build_object('titulo', v_titulo, 'versao', coalesce(v_ant.versao, 0) + 1));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.ativar_modelo_termo(p_modelo uuid, p_ativo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.termos_modelos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO m FROM public.termos_modelos WHERE id = p_modelo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado.'; END IF;
  IF NOT (private.eh_super_admin() OR private.tenho_papel(m.unidade_id, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado: os modelos de termo são do gestor da unidade.';
  END IF;
  IF NOT m.vigente THEN RAISE EXCEPTION 'Esta versão já foi substituída. Recarregue a lista.'; END IF;
  IF m.ativo = coalesce(p_ativo, false) THEN RETURN; END IF;
  UPDATE public.termos_modelos
     SET ativo = coalesce(p_ativo, false), ativo_alterado_em = now(), ativo_alterado_por = private.meu_perfil_id()
   WHERE id = m.id;
  PERFORM private.registrar_auditoria(CASE WHEN p_ativo THEN 'reativar_modelo_termo' ELSE 'desativar_modelo_termo' END,
    'termos_modelos', m.id, m.unidade_id, jsonb_build_object('titulo', m.titulo));
END $$;

-- ── médico: gerar (ou retificar) o termo do paciente ────────────────────────
-- p_dados: { modelo_id?, procedimento, texto, informacoes?,
--            assinante: 'paciente' | 'responsavel' | 'ninguem_presente',
--            sem_condicoes_motivo?  (adulto que não assina),
--            responsavel?: { nome, documento, vinculo },
--            ausencia_motivo?       (ninguém presente para assinar),
--            testemunha?: { nome, documento? } }
CREATE OR REPLACE FUNCTION public.emitir_termo_consentimento(
  p_paciente uuid, p_dados jsonb,
  p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL,
  p_retifica uuid DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  pc public.pacientes;
  v_unidade_nome text;
  v_med public.perfis;
  v_epi uuid := p_episodio;
  v_ant public.documentos_clinicos;
  m public.termos_modelos;
  v_idade int;
  v_menor boolean;
  v_assinante text := coalesce(p_dados ->> 'assinante', '');
  v_proc text := btrim(coalesce(p_dados ->> 'procedimento', ''));
  v_texto text := btrim(coalesce(p_dados ->> 'texto', ''));
  v_info text := nullif(btrim(coalesce(p_dados ->> 'informacoes', '')), '');
  v_sem_cond text := nullif(btrim(coalesce(p_dados ->> 'sem_condicoes_motivo', '')), '');
  v_ausencia text := nullif(btrim(coalesce(p_dados ->> 'ausencia_motivo', '')), '');
  v_resp jsonb;
  v_test jsonb;
  v_decl text;
  v_campos jsonb;
  v_conteudo text;
  r public.documentos_clinicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN RAISE EXCEPTION 'Dados do termo inválidos.'; END IF;
  SELECT * INTO pc FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF private.tenho_papel(pc.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O termo de consentimento é do médico.';
  END IF;

  -- episódio: o do termo corrigido, o informado ou o da internação
  IF p_retifica IS NOT NULL THEN
    SELECT * INTO v_ant FROM public.documentos_clinicos WHERE id = p_retifica;
    IF NOT FOUND OR v_ant.paciente_id <> p_paciente OR v_ant.tipo_documento <> 'termo_consentimento' THEN
      RAISE EXCEPTION 'Termo a retificar não encontrado para este paciente.';
    END IF;
    v_epi := v_ant.episodio_id;
  ELSIF v_epi IS NULL AND p_internacao IS NOT NULL THEN
    SELECT i.episodio_id INTO v_epi FROM public.internacoes i WHERE i.id = p_internacao AND i.paciente_id = p_paciente;
    IF NOT FOUND THEN RAISE EXCEPTION 'A internação informada não é deste paciente.'; END IF;
  END IF;

  -- modelo (opcional): da unidade do paciente; novo termo só com modelo ativo
  IF nullif(p_dados ->> 'modelo_id', '') IS NOT NULL THEN
    SELECT * INTO m FROM public.termos_modelos WHERE id = (p_dados ->> 'modelo_id')::uuid;
    IF NOT FOUND OR m.unidade_id <> pc.unidade_id THEN RAISE EXCEPTION 'Modelo de termo não encontrado nesta unidade.'; END IF;
    IF p_retifica IS NULL AND NOT m.ativo THEN RAISE EXCEPTION 'Este modelo foi desativado pelo gestor.'; END IF;
  END IF;

  IF length(v_proc) < 3 THEN RAISE EXCEPTION 'Informe o procedimento.'; END IF;
  IF length(v_texto) < 20 THEN
    RAISE EXCEPTION 'Escreva as informações sobre o procedimento: o que é, benefícios, riscos e alternativas.';
  END IF;

  -- quem assina (pediatria vai até 13 anos, 11 meses e 29 dias)
  IF pc.data_nascimento IS NOT NULL THEN
    v_idade := extract(year FROM age(private.data_atual(), pc.data_nascimento))::int;
  END IF;
  v_menor := coalesce(v_idade < 14, false);
  IF v_assinante NOT IN ('paciente', 'responsavel', 'ninguem_presente') THEN
    RAISE EXCEPTION 'Diga quem assina o termo.';
  END IF;
  IF v_assinante = 'paciente' AND v_menor THEN
    RAISE EXCEPTION 'Paciente menor de 14 anos: o termo é assinado pelo responsável legal.';
  END IF;
  IF v_assinante <> 'paciente' AND NOT v_menor AND coalesce(length(v_sem_cond), 0) < 5 THEN
    RAISE EXCEPTION 'Diga por que o paciente não tem condições de assinar.';
  END IF;
  IF v_menor OR v_assinante = 'paciente' THEN v_sem_cond := NULL; END IF;

  IF v_assinante = 'responsavel' THEN
    v_resp := jsonb_build_object(
      'nome', btrim(coalesce(p_dados #>> '{responsavel,nome}', '')),
      'documento', btrim(coalesce(p_dados #>> '{responsavel,documento}', '')),
      'vinculo', btrim(coalesce(p_dados #>> '{responsavel,vinculo}', '')));
    IF length(v_resp ->> 'nome') < 3 THEN RAISE EXCEPTION 'Informe o nome do responsável.'; END IF;
    IF length(v_resp ->> 'documento') < 3 THEN RAISE EXCEPTION 'Informe o documento do responsável.'; END IF;
    IF length(v_resp ->> 'vinculo') < 2 THEN RAISE EXCEPTION 'Informe o vínculo do responsável com o paciente.'; END IF;
  END IF;
  IF v_assinante = 'ninguem_presente' THEN
    IF coalesce(length(v_ausencia), 0) < 10 THEN
      RAISE EXCEPTION 'Registre por que não há responsável presente para assinar (mínimo de 10 letras).';
    END IF;
  ELSE
    v_ausencia := NULL;
  END IF;

  IF nullif(btrim(coalesce(p_dados #>> '{testemunha,nome}', '')), '') IS NOT NULL THEN
    v_test := jsonb_build_object('nome', btrim(p_dados #>> '{testemunha,nome}'),
                                 'documento', nullif(btrim(coalesce(p_dados #>> '{testemunha,documento}', '')), ''));
    IF length(v_test ->> 'nome') < 3 THEN RAISE EXCEPTION 'Nome da testemunha incompleto.'; END IF;
  END IF;

  -- campos preenchidos no servidor (o que sobrar de {campo} no texto editado)
  SELECT * INTO v_med FROM public.perfis WHERE id = v_perfil;
  SELECT u.nome INTO v_unidade_nome FROM public.unidades u WHERE u.id = pc.unidade_id;
  v_campos := jsonb_build_object(
    'paciente', coalesce(nullif(btrim(pc.nome_social), ''), pc.nome),
    'idade', CASE WHEN v_idade IS NULL THEN '' WHEN v_idade = 1 THEN '1 ano' ELSE v_idade || ' anos' END,
    'procedimento', v_proc,
    'medico', v_med.nome_completo,
    'crm', coalesce(v_med.crm || coalesce('/' || v_med.uf_crm, ''), ''),
    'unidade', v_unidade_nome,
    'data', to_char(private.data_atual(), 'DD/MM/YYYY'),
    'responsavel', coalesce(v_resp ->> 'nome', ''),
    'vinculo', coalesce(v_resp ->> 'vinculo', ''));
  v_texto := private.preencher_campos_termo(v_texto, v_campos);
  v_info := private.preencher_campos_termo(v_info, v_campos);
  v_decl := private.preencher_campos_termo(coalesce(nullif(btrim(m.declaracao), ''), private.declaracao_padrao_termo()), v_campos);

  v_conteudo := jsonb_build_object('termo', jsonb_build_object(
    'modelo', CASE WHEN m.id IS NOT NULL THEN jsonb_build_object('id', m.id, 'titulo', m.titulo, 'versao', m.versao) END,
    'procedimento', v_proc,
    'texto', v_texto,
    'informacoes', v_info,
    'declaracao', v_decl,
    'paciente', jsonb_build_object('nome', v_campos ->> 'paciente', 'idade_anos', v_idade, 'menor_14', v_menor),
    'assinante', v_assinante,
    'sem_condicoes_motivo', v_sem_cond,
    'responsavel', v_resp,
    'ausencia_motivo', v_ausencia,
    'testemunha', v_test,
    'medico', jsonb_build_object('nome', v_med.nome_completo, 'crm', v_med.crm, 'uf_crm', v_med.uf_crm)
    -- ONDA 6: 'assinatura' (assinatura digital do médico e coleta da assinatura do paciente/responsável)
  ))::text;

  -- duplo clique: o mesmo termo do mesmo autor em 2 min → o mesmo documento
  IF p_retifica IS NULL THEN
    SELECT * INTO r FROM public.documentos_clinicos
     WHERE paciente_id = p_paciente AND tipo_documento = 'termo_consentimento' AND autor_id = v_perfil AND estado = 'ativo'
       AND conteudo_hash = encode(extensions.digest(convert_to(v_conteudo, 'UTF8'), 'sha256'), 'hex')
       AND created_at > now() - interval '2 minutes'
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF r.id IS NULL THEN
    r := private.gravar_documento_episodio(NULL, p_paciente, 'termo_consentimento', v_conteudo, v_epi, p_retifica, p_motivo,
                                           v_perfil, now(), false, NULL);
    PERFORM private.registrar_auditoria(CASE WHEN p_retifica IS NULL THEN 'emitir_documento' ELSE 'retificar_documento' END,
      'documentos_clinicos', r.id, r.unidade_id, jsonb_build_object('tipo', 'termo_consentimento', 'assinante', v_assinante));
  END IF;
  RETURN jsonb_build_object('id', r.id, 'numero', r.numero, 'episodio_id', r.episodio_id, 'versao', r.versao);
END $$;

-- ── cancelar com justificativa ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_termo_consentimento(p_documento uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
  v_autor uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento FOR UPDATE;
  IF NOT FOUND OR d.tipo_documento <> 'termo_consentimento' THEN RAISE EXCEPTION 'Termo não encontrado.'; END IF;
  IF d.estado <> 'ativo' THEN RAISE EXCEPTION 'Só se cancela o termo em vigor (a versão atual, não cancelada).'; END IF;
  SELECT x.autor_id INTO v_autor FROM public.documentos_clinicos x
   WHERE x.documento_raiz_id = d.documento_raiz_id ORDER BY x.versao LIMIT 1;
  IF NOT (private.eh_super_admin() OR private.tenho_papel(d.unidade_id, 'gestor')
          OR (v_autor = v_perfil AND private.pode_atuar_no_paciente(d.paciente_id) IS TRUE)) THEN
    RAISE EXCEPTION 'Só o médico que emitiu o termo (de plantão) ou o gestor da unidade cancela.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Justifique o cancelamento (mínimo de 10 letras).';
  END IF;
  UPDATE public.documentos_clinicos SET estado = 'cancelado', updated_at = now() WHERE id = d.id;
  INSERT INTO public.termos_cancelamentos (documento_id, unidade_id, paciente_id, motivo, cancelado_por)
  VALUES (d.id, d.unidade_id, d.paciente_id, btrim(p_motivo), v_perfil);
  PERFORM private.registrar_auditoria('cancelar_documento', 'documentos_clinicos', d.id, d.unidade_id,
    jsonb_build_object('tipo', 'termo_consentimento', 'motivo', btrim(p_motivo)));
END $$;

-- ── o painel da aba: paciente, modelos e termos do episódio/internação ─────
CREATE OR REPLACE FUNCTION public.termos_consentimento_do_paciente(
  p_paciente uuid, p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pc public.pacientes;
  v_perfil uuid := private.meu_perfil_id();
  v_epi uuid := p_episodio;
  v_idade int;
  v_filtra boolean := p_episodio IS NOT NULL OR p_internacao IS NOT NULL;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pc FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.pode_atuar_no_paciente(p_paciente) IS TRUE
          OR private.acesso_encerrado_vigente(p_paciente) IS TRUE
          OR private.teleinterconsulta_vigente(p_paciente) IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF private.prontuario_aberto(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Abra o prontuário do paciente para ver os termos.';
  END IF;
  IF v_epi IS NULL AND p_internacao IS NOT NULL THEN
    SELECT i.episodio_id INTO v_epi FROM public.internacoes i WHERE i.id = p_internacao AND i.paciente_id = p_paciente;
  END IF;
  IF pc.data_nascimento IS NOT NULL THEN
    v_idade := extract(year FROM age(private.data_atual(), pc.data_nascimento))::int;
  END IF;

  RETURN jsonb_build_object(
    'paciente', jsonb_build_object(
      'nome', coalesce(nullif(btrim(pc.nome_social), ''), pc.nome),
      'idade_anos', v_idade,
      'menor_14', coalesce(v_idade < 14, false),
      'responsavel', CASE WHEN nullif(btrim(pc.responsavel_nome), '') IS NOT NULL THEN jsonb_build_object(
        'nome', pc.responsavel_nome, 'vinculo', pc.responsavel_parentesco, 'documento', pc.responsavel_documento) END),
    'unidade', (SELECT u.nome FROM public.unidades u WHERE u.id = pc.unidade_id),
    'medico', (SELECT jsonb_build_object('id', f.id, 'nome', f.nome_completo, 'crm', f.crm, 'uf_crm', f.uf_crm)
                 FROM public.perfis f WHERE f.id = v_perfil),
    'pode_emitir', private.pode_atuar_no_paciente(p_paciente) IS TRUE AND private.tenho_papel(pc.unidade_id, 'plantonista'),
    'sou_gestor', private.eh_super_admin() OR private.tenho_papel(pc.unidade_id, 'gestor'),
    'declaracao_padrao', private.declaracao_padrao_termo(),
    'modelos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'procedimento', m.procedimento,
                                          'texto', m.texto, 'declaracao', m.declaracao, 'versao', m.versao)
             ORDER BY lower(m.titulo))
        FROM public.termos_modelos m
       WHERE m.unidade_id = pc.unidade_id AND m.vigente AND m.ativo), '[]'::jsonb),
    'termos', coalesce((
      SELECT jsonb_agg(t ORDER BY t ->> 'emitido_em' DESC)
        FROM (
          SELECT jsonb_build_object(
                   'id', d.id, 'raiz_id', d.documento_raiz_id, 'versao', d.versao, 'numero', d.numero,
                   'estado', d.estado, 'emitido_em', coalesce(d.emitido_em, d.created_at),
                   'primeira_emissao_em', (SELECT coalesce(p.emitido_em, p.created_at) FROM public.documentos_clinicos p
                                            WHERE p.documento_raiz_id = d.documento_raiz_id ORDER BY p.versao LIMIT 1),
                   'autor_id', d.autor_id,
                   'autor_original_id', (SELECT p.autor_id FROM public.documentos_clinicos p
                                          WHERE p.documento_raiz_id = d.documento_raiz_id ORDER BY p.versao LIMIT 1),
                   'autor', a.nome_completo, 'crm', a.crm, 'uf_crm', a.uf_crm,
                   'motivo_retificacao', d.motivo_retificacao,
                   'conteudo', CASE WHEN d.conteudo ~ '^\s*\{' THEN (d.conteudo::jsonb -> 'termo') END,
                   'cancelamento', (SELECT jsonb_build_object('motivo', c.motivo, 'em', c.cancelado_em,
                                                              'por', (SELECT f.nome_completo FROM public.perfis f WHERE f.id = c.cancelado_por))
                                      FROM public.termos_cancelamentos c WHERE c.documento_id = d.id),
                   'versoes', (SELECT jsonb_agg(jsonb_build_object('id', v.id, 'versao', v.versao, 'numero', v.numero,
                                                'estado', v.estado, 'emitido_em', coalesce(v.emitido_em, v.created_at),
                                                'motivo_retificacao', v.motivo_retificacao,
                                                'autor', (SELECT f.nome_completo FROM public.perfis f WHERE f.id = v.autor_id))
                                               ORDER BY v.versao)
                                 FROM public.documentos_clinicos v WHERE v.documento_raiz_id = d.documento_raiz_id)) t
            FROM public.documentos_clinicos d
            LEFT JOIN public.perfis a ON a.id = d.autor_id
           WHERE d.paciente_id = p_paciente
             AND d.tipo_documento = 'termo_consentimento'
             AND d.estado IN ('ativo', 'cancelado')  -- a versão em vigor (ou a cancelada) de cada termo
             AND (NOT v_filtra
                  OR (v_epi IS NOT NULL AND d.episodio_id = v_epi)
                  OR (p_internacao IS NOT NULL AND d.internacao_id = p_internacao))
        ) s), '[]'::jsonb));
END $$;

-- ── permissões ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.termos_modelos_conteudo_fixo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salvar_modelo_termo(uuid, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ativar_modelo_termo(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.emitir_termo_consentimento(uuid, jsonb, uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_termo_consentimento(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.termos_consentimento_do_paciente(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_modelo_termo(uuid, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ativar_modelo_termo(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_termo_consentimento(uuid, jsonb, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_termo_consentimento(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.termos_consentimento_do_paciente(uuid, uuid, uuid) TO authenticated;
