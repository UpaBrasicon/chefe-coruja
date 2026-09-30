-- Porte do frontend — estados do documento, pendências do PEP e impressão de
-- prontuário (protótipo: "Barra do Documento", Bloco 1 item 1, Bloco 4 item
-- 4, Bloco 5 item 5; index.html 2367–2398 e 2523–2601; ESTADO.md etapa 13).
--
-- 1. ESTADOS DO DOCUMENTO. O protótipo tem Aberto → Assinado → Cancelado. No
--    app, "Aberto" é o rascunho do banco (fase 4.1) e "Assinado" ainda não
--    existe: a assinatura ICP-Brasil (etapa 4.8) espera a escolha do provedor.
--    Até lá o documento vale pela EMISSÃO numerada (estado 'ativo'). O estado
--    'assinado' continua no CHECK da tabela como gancho da 4.8: cancelar e
--    copiar já o aceitam, e nada aqui o grava.
--      * cancelar_documento: documento emitido (ativo ou assinado) é
--        cancelado com justificativa de 15+ letras, por quem o escreveu. Ele
--        continua no prontuário, marcado cancelado, com quem, quando e por
--        quê. Nada se apaga. Pedido de exames cancelado cancela os exames
--        ainda sem resultado (senão eles seguiriam impedindo a alta).
--      * copiar_documento: "Copiar como novo" abre um RASCUNHO novo do mesmo
--        tipo com o conteúdo do documento (emitido ou cancelado), no episódio
--        aberto, para quem copia. Não sobrescreve rascunho já aberto.
--      * documentos_do_paciente: histórico do episódio (todos os
--        profissionais), para a barra do documento e a impressão.
--    Descartar rascunho (fase 4.1) já grava 'cancelado' sem número: é
--    diferente do cancelamento de documento emitido (esse tem número e
--    justificativa) e fica fora do histórico.
-- 2. PENDÊNCIAS DO PEP (pendencias_pep): rascunhos meus não emitidos,
--    impeditivos de alta por leito (private.impeditivos_alta, sem alterá-la)
--    e pendências combinadas nos leitos que eu cuido.
-- 3. IMPRESSÃO DE PRONTUÁRIO: anexos do prontuário (tabela nova; arquivo no
--    bucket "atendimento", caminho {unidade}/{paciente}/prontuario/…, lido
--    só com o prontuário aberto — sigilo reforçado) e impressões de
--    prontuário (tabela nova): documentos e anexos marcados, autorizador,
--    observação, quem recebe (nome e documento) e cancelamento com
--    justificativa de 10+ letras.
--
-- Escritas com segundo fator (ADR 0010). Tabelas novas com RLS e no gatilho
-- da guarda de 20 anos. Reaplicável.

-- ── 1. estados do documento ─────────────────────────────────────────────────
ALTER TABLE public.documentos_clinicos
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS copia_de uuid REFERENCES public.documentos_clinicos(id);
CREATE INDEX IF NOT EXISTS idx_documentos_clinicos_cancelado_por ON public.documentos_clinicos (cancelado_por);
CREATE INDEX IF NOT EXISTS idx_documentos_clinicos_copia_de ON public.documentos_clinicos (copia_de);
CREATE INDEX IF NOT EXISTS idx_documentos_rascunho_autor ON public.documentos_clinicos (autor_id, unidade_id) WHERE estado = 'rascunho';

ALTER TABLE public.documentos_clinicos DROP CONSTRAINT IF EXISTS documentos_cancelamento_justificado;
ALTER TABLE public.documentos_clinicos ADD CONSTRAINT documentos_cancelamento_justificado
  CHECK (cancelado_em IS NULL OR (estado = 'cancelado' AND cancelado_por IS NOT NULL AND length(btrim(motivo_cancelamento)) >= 15));

-- Tipos cujo cancelamento mora em outro fluxo: sumário de alta/óbito (a alta),
-- termo (termos_cancelamentos), parecer, teleinterconsulta, evolução
-- estruturada e prescrição (suspensão de itens).
CREATE OR REPLACE FUNCTION public.cancelar_documento(p_documento uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
  v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF d.estado = 'cancelado' AND d.numero IS NOT NULL THEN
    RAISE EXCEPTION 'Este documento já está cancelado.';
  END IF;
  IF d.estado NOT IN ('ativo', 'assinado') OR d.numero IS NULL THEN
    RAISE EXCEPTION 'Só se cancela documento emitido e em vigor. Rascunho se descarta; versão retificada já foi substituída.';
  END IF;
  IF d.tipo_documento NOT IN ('atestado', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'boletim_emergencia',
                              'admissao_anamnese') THEN
    RAISE EXCEPTION 'Este tipo de documento tem cancelamento próprio (alta, termo, parecer, prescrição ou evolução).';
  END IF;
  IF (SELECT x.autor_id FROM public.documentos_clinicos x
       WHERE x.documento_raiz_id = d.documento_raiz_id ORDER BY x.versao LIMIT 1) IS DISTINCT FROM v_perfil THEN
    RAISE EXCEPTION 'Só o autor cancela o próprio documento.';
  END IF;
  IF length(v_motivo) < 15 THEN
    RAISE EXCEPTION 'Informe a justificativa do cancelamento (mínimo de 15 letras).';
  END IF;

  UPDATE public.documentos_clinicos
     SET estado = 'cancelado', cancelado_em = now(), cancelado_por = v_perfil, motivo_cancelamento = v_motivo, updated_at = now()
   WHERE id = d.id
  RETURNING * INTO d;

  IF d.tipo_documento = 'pedido_exames' THEN
    UPDATE public.exames_pedidos
       SET situacao = 'cancelado', motivo_cancelamento = left('Pedido cancelado: ' || v_motivo, 500),
           resolvido_por = v_perfil, resolvido_em = now()
     WHERE documento_id = d.id AND situacao = 'pedido';
  END IF;

  PERFORM private.registrar_auditoria('cancelar_documento', 'documentos_clinicos', d.id, d.unidade_id,
    jsonb_build_object('tipo', d.tipo_documento, 'numero', d.numero, 'motivo', v_motivo));
  RETURN jsonb_build_object('id', d.id, 'numero', d.numero, 'estado', d.estado, 'cancelado_em', d.cancelado_em);
END $$;

CREATE OR REPLACE FUNCTION public.copiar_documento(p_documento uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
  v_epi uuid;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF d.numero IS NULL OR d.estado NOT IN ('ativo', 'assinado', 'cancelado', 'retificado') THEN
    RAISE EXCEPTION 'Só se copia documento emitido (em vigor, retificado ou cancelado).';
  END IF;
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(d.paciente_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF d.tipo_documento NOT IN ('atestado', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'prescricao',
                              'sumario_alta', 'termo_consentimento', 'boletim_emergencia') THEN
    RAISE EXCEPTION 'Este tipo de documento não se copia como rascunho.';
  END IF;
  v_epi := private.episodio_aberto(d.paciente_id);
  IF EXISTS (SELECT 1 FROM public.documentos_clinicos x
              WHERE x.paciente_id = d.paciente_id AND x.tipo_documento = d.tipo_documento AND x.autor_id = v_perfil
                AND x.estado = 'rascunho' AND x.episodio_id IS NOT DISTINCT FROM v_epi) THEN
    RAISE EXCEPTION 'Já existe um rascunho seu deste tipo para o paciente. Emita ou descarte antes de copiar.';
  END IF;
  v_id := public.salvar_rascunho(d.paciente_id, d.tipo_documento, d.conteudo);
  UPDATE public.documentos_clinicos SET copia_de = d.id WHERE id = v_id;
  PERFORM private.registrar_auditoria('copiar_documento', 'documentos_clinicos', v_id, d.unidade_id,
    jsonb_build_object('tipo', d.tipo_documento, 'copia_de', d.id, 'numero_origem', d.numero));
  RETURN jsonb_build_object('id', v_id, 'tipo', d.tipo_documento, 'conteudo', d.conteudo, 'copia_de', d.id);
END $$;

-- Histórico: sem p_tudo, só o episódio (o informado, ou o aberto, ou o
-- último). Rascunho só aparece o de quem pergunta; rascunho descartado não
-- aparece. Conteúdo só com o prontuário aberto (acesso registrado).
CREATE OR REPLACE FUNCTION public.documentos_do_paciente(
  p_paciente uuid, p_episodio uuid DEFAULT NULL, p_tudo boolean DEFAULT false, p_com_conteudo boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_epi uuid := p_episodio;
  v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF p_com_conteudo AND private.prontuario_aberto(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Abra o prontuário do paciente antes (o acesso fica registrado).';
  END IF;
  IF NOT p_tudo AND v_epi IS NULL THEN
    v_epi := coalesce(private.episodio_aberto(p_paciente),
                      (SELECT e.id FROM public.episodios e WHERE e.paciente_id = p_paciente ORDER BY e.chegada_em DESC LIMIT 1));
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x ->> 'criado_em' DESC), '[]'::jsonb) INTO v FROM (
    SELECT jsonb_build_object(
      'id', d.id, 'raiz_id', d.documento_raiz_id, 'versao', d.versao, 'tipo', d.tipo_documento, 'estado', d.estado,
      'numero', d.numero, 'episodio_id', d.episodio_id, 'internacao_id', d.internacao_id,
      'episodio_chegada', (SELECT e.chegada_em FROM public.episodios e WHERE e.id = d.episodio_id),
      'autor_id', d.autor_id, 'autor', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = d.autor_id),
      'meu', d.autor_id = v_perfil,
      'criado_em', d.created_at, 'atualizado_em', d.updated_at, 'emitido_em', d.emitido_em,
      'cancelado_em', d.cancelado_em, 'motivo_cancelamento', d.motivo_cancelamento,
      'cancelado_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = d.cancelado_por),
      'retificacao_de', d.retificacao_de, 'motivo_retificacao', d.motivo_retificacao, 'copia_de', d.copia_de,
      'assinado_em', d.assinado_em,
      'conteudo', CASE WHEN p_com_conteudo THEN d.conteudo END) x
      FROM public.documentos_clinicos d
     WHERE d.paciente_id = p_paciente
       AND (p_tudo OR d.episodio_id IS NOT DISTINCT FROM v_epi)
       AND NOT (d.estado = 'rascunho' AND d.autor_id <> v_perfil)
       AND NOT (d.estado = 'cancelado' AND d.numero IS NULL)
  ) s;
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.cancelar_documento(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.copiar_documento(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.documentos_do_paciente(uuid, uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_documento(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copiar_documento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documentos_do_paciente(uuid, uuid, boolean, boolean) TO authenticated;

-- ── 2. pendências do PEP ────────────────────────────────────────────────────
-- Leitos que eu cuido agora: internação ativa no setor da minha escala.
CREATE OR REPLACE FUNCTION public.pendencias_pep(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_rasc jsonb; v_imp jsonb; v_comb jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR NOT (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'tipo', d.tipo_documento, 'paciente_id', d.paciente_id, 'paciente', p.nome,
      'episodio_id', d.episodio_id, 'internacao_id', d.internacao_id,
      'leito', (SELECT l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = d.internacao_id),
      'criado_em', d.created_at, 'atualizado_em', d.updated_at, 'copia_de', d.copia_de)
      ORDER BY d.updated_at), '[]'::jsonb)
    INTO v_rasc
    FROM public.documentos_clinicos d JOIN public.pacientes p ON p.id = d.paciente_id
   WHERE d.autor_id = v_perfil AND d.unidade_id = p_unidade AND d.estado = 'rascunho';

  WITH meus AS (
    SELECT i.id, i.paciente_id, p.nome, l.identificador AS leito
      FROM public.internacoes i
      JOIN public.pacientes p ON p.id = i.paciente_id
      LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
       AND private.cuido_da_internacao(i)
  ), imp AS (
    SELECT m.*, (SELECT coalesce(jsonb_agg(x), '[]'::jsonb)
                   FROM jsonb_array_elements(private.impeditivos_alta(m.id)) x
                  -- meu rascunho já aparece em "para emitir"
                  WHERE NOT (x ->> 'tipo' = 'documento' AND x ->> 'autor_id' = v_perfil::text)) AS itens
      FROM meus m
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('internacao_id', imp.id, 'paciente_id', imp.paciente_id, 'paciente', imp.nome,
                                               'leito', imp.leito, 'itens', imp.itens) ORDER BY imp.leito NULLS LAST, imp.nome), '[]'::jsonb),
         (SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', pe.id, 'tipo', pe.tipo, 'descricao', pe.descricao, 'prazo', pe.prazo, 'impeditiva', pe.impeditiva,
             'criada_em', pe.criada_em, 'origem', pe.origem, 'meu', pe.autor_id = v_perfil,
             'autor', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = pe.autor_id),
             'internacao_id', m.id, 'paciente_id', m.paciente_id, 'paciente', m.nome, 'leito', m.leito)
             ORDER BY pe.prazo NULLS LAST, pe.criada_em), '[]'::jsonb)
            FROM public.pendencias pe JOIN meus m ON m.id = pe.internacao_id
           WHERE pe.situacao = 'aberta' AND pe.tipo <> 'observacao')
    INTO v_imp, v_comb
    FROM imp WHERE jsonb_array_length(imp.itens) > 0;

  RETURN jsonb_build_object('rascunhos', v_rasc, 'impeditivos', coalesce(v_imp, '[]'::jsonb), 'combinadas', coalesce(v_comb, '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.pendencias_pep(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pendencias_pep(uuid) TO authenticated;

-- ── 3a. anexos do prontuário ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anexos_prontuario (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id      uuid NOT NULL REFERENCES public.organizacoes(id),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id         uuid REFERENCES public.episodios(id),
  caminho             text NOT NULL UNIQUE,
  nome                text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 200),
  tipo_mime           text NOT NULL CHECK (tipo_mime = 'application/pdf' OR tipo_mime LIKE 'image/%'),
  tamanho             integer NOT NULL CHECK (tamanho > 0 AND tamanho <= 10485760),
  autor_id            uuid NOT NULL REFERENCES public.perfis(id),
  criado_em           timestamptz NOT NULL DEFAULT now(),
  cancelado_em        timestamptz,
  cancelado_por       uuid REFERENCES public.perfis(id),
  motivo_cancelamento text,
  CHECK (cancelado_em IS NULL OR (cancelado_por IS NOT NULL AND length(btrim(motivo_cancelamento)) >= 10))
);
CREATE INDEX IF NOT EXISTS anexos_prontuario_paciente ON public.anexos_prontuario (paciente_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_anexos_prontuario_unidade ON public.anexos_prontuario (unidade_id);
CREATE INDEX IF NOT EXISTS idx_anexos_prontuario_org ON public.anexos_prontuario (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_anexos_prontuario_episodio ON public.anexos_prontuario (episodio_id);
CREATE INDEX IF NOT EXISTS idx_anexos_prontuario_autor ON public.anexos_prontuario (autor_id);
CREATE INDEX IF NOT EXISTS idx_anexos_prontuario_cancelado_por ON public.anexos_prontuario (cancelado_por);

-- ── 3b. impressões de prontuário ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.impressoes_prontuario (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id       uuid NOT NULL REFERENCES public.organizacoes(id),
  unidade_id           uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id          uuid NOT NULL REFERENCES public.pacientes(id),
  protocolo            text NOT NULL UNIQUE,
  impresso_por         uuid NOT NULL REFERENCES public.perfis(id),
  impresso_em          timestamptz NOT NULL DEFAULT now(),
  documentos           uuid[] NOT NULL DEFAULT '{}',
  anexos               uuid[] NOT NULL DEFAULT '{}',
  -- retrato do que saiu (tipo, número e estado de cada item na hora)
  itens                jsonb NOT NULL,
  autorizador          text NOT NULL CHECK (length(btrim(autorizador)) BETWEEN 3 AND 200),
  observacao           text CHECK (observacao IS NULL OR length(observacao) <= 1000),
  recebedor_nome       text NOT NULL CHECK (length(btrim(recebedor_nome)) BETWEEN 3 AND 200),
  recebedor_documento  text NOT NULL CHECK (length(btrim(recebedor_documento)) BETWEEN 3 AND 60),
  estado               text NOT NULL DEFAULT 'impressa' CHECK (estado IN ('impressa', 'cancelada')),
  cancelada_em         timestamptz,
  cancelada_por        uuid REFERENCES public.perfis(id),
  motivo_cancelamento  text,
  CHECK (estado = 'impressa' OR (cancelada_em IS NOT NULL AND cancelada_por IS NOT NULL AND length(btrim(motivo_cancelamento)) >= 10))
);
CREATE INDEX IF NOT EXISTS impressoes_prontuario_paciente ON public.impressoes_prontuario (paciente_id, impresso_em DESC);
CREATE INDEX IF NOT EXISTS idx_impressoes_prontuario_unidade ON public.impressoes_prontuario (unidade_id, impresso_em DESC);
CREATE INDEX IF NOT EXISTS idx_impressoes_prontuario_org ON public.impressoes_prontuario (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_impressoes_prontuario_por ON public.impressoes_prontuario (impresso_por);
CREATE INDEX IF NOT EXISTS idx_impressoes_prontuario_cancelada_por ON public.impressoes_prontuario (cancelada_por);

-- O que foi registrado não muda; só o cancelamento (uma vez) se acrescenta.
CREATE OR REPLACE FUNCTION private.registro_so_cancela()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE a jsonb := to_jsonb(OLD); b jsonb := to_jsonb(NEW); k text;
BEGIN
  FOREACH k IN ARRAY ARRAY['estado', 'cancelado_em', 'cancelado_por', 'cancelada_em', 'cancelada_por', 'motivo_cancelamento'] LOOP
    a := a - k; b := b - k;
  END LOOP;
  IF a IS DISTINCT FROM b THEN
    RAISE EXCEPTION 'Registro de prontuário não se altera: só se cancela, com justificativa.';
  END IF;
  IF coalesce(to_jsonb(OLD) ->> 'cancelado_em', to_jsonb(OLD) ->> 'cancelada_em') IS NOT NULL THEN
    RAISE EXCEPTION 'Já cancelado.';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['anexos_prontuario', 'impressoes_prontuario'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_so_cancela ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_so_cancela BEFORE UPDATE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION private.registro_so_cancela()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, PUBLIC', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_segundo_fator', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE TO authenticated
                      USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok())', t || '_segundo_fator', t);
  END LOOP;
END $$;

-- anexo: só com o prontuário aberto (sigilo reforçado), e de quem atua no
-- paciente ou é gestor da unidade
DROP POLICY IF EXISTS anexos_prontuario_select ON public.anexos_prontuario;
CREATE POLICY anexos_prontuario_select ON public.anexos_prontuario FOR SELECT TO authenticated
  USING (private.eh_super_admin()
         OR (private.prontuario_aberto(paciente_id)
             AND (private.papel_na_unidade(unidade_id) = 'gestor' OR private.pode_atuar_no_paciente(paciente_id))));

DROP POLICY IF EXISTS impressoes_prontuario_select ON public.impressoes_prontuario;
CREATE POLICY impressoes_prontuario_select ON public.impressoes_prontuario FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor'
         OR private.pode_atuar_no_paciente(paciente_id));

-- Arquivo do anexo no bucket: além da regra por unidade que já existe, ler o
-- arquivo de {unidade}/{paciente}/prontuario/… exige o prontuário aberto.
DROP POLICY IF EXISTS atendimento_prontuario_sigilo ON storage.objects;
CREATE POLICY atendimento_prontuario_sigilo ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'atendimento'
         OR name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/prontuario/'
         OR private.eh_super_admin()
         OR private.prontuario_aberto(split_part(name, '/', 2)::uuid));

CREATE OR REPLACE FUNCTION public.registrar_anexo_prontuario(
  p_paciente uuid, p_caminho text, p_nome text, p_tipo_mime text, p_tamanho integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid; v_org uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  SELECT p.unidade_id, u.organizacao_id INTO v_unidade, v_org
    FROM public.pacientes p JOIN public.unidades u ON u.id = p.unidade_id WHERE p.id = p_paciente;
  IF p_caminho IS NULL OR NOT starts_with(p_caminho, v_unidade::text || '/' || p_paciente::text || '/prontuario/')
     OR p_caminho ~ '\.\.' THEN
    RAISE EXCEPTION 'Caminho do anexo fora da pasta do prontuário do paciente.';
  END IF;
  IF NOT (p_tipo_mime = 'application/pdf' OR p_tipo_mime LIKE 'image/%') THEN
    RAISE EXCEPTION 'Anexo só em PDF ou imagem.';
  END IF;
  IF p_tamanho IS NULL OR p_tamanho <= 0 OR p_tamanho > 10485760 THEN
    RAISE EXCEPTION 'Anexo acima de 10 MB. Reduza o arquivo.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'atendimento' AND o.name = p_caminho) THEN
    RAISE EXCEPTION 'Arquivo não encontrado no armazenamento. Envie de novo.';
  END IF;
  INSERT INTO public.anexos_prontuario (organizacao_id, unidade_id, paciente_id, episodio_id, caminho, nome, tipo_mime, tamanho, autor_id)
  VALUES (v_org, v_unidade, p_paciente, private.episodio_aberto(p_paciente), p_caminho, left(btrim(p_nome), 200), p_tipo_mime,
          p_tamanho, v_perfil)
  ON CONFLICT (caminho) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Este arquivo já está anexado.'; END IF;
  PERFORM private.registrar_auditoria('anexar_prontuario', 'anexos_prontuario', v_id, v_unidade,
    jsonb_build_object('tipo_mime', p_tipo_mime, 'tamanho', p_tamanho));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancelar_anexo_prontuario(p_anexo uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.anexos_prontuario; v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.anexos_prontuario WHERE id = p_anexo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anexo não encontrado.'; END IF;
  IF a.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Este anexo já está cancelado.'; END IF;
  IF NOT (a.autor_id = v_perfil OR private.papel_na_unidade(a.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Só quem anexou ou o gestor da unidade cancela o anexo.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Informe a justificativa (mínimo de 10 letras).';
  END IF;
  UPDATE public.anexos_prontuario
     SET cancelado_em = now(), cancelado_por = v_perfil, motivo_cancelamento = btrim(p_motivo)
   WHERE id = a.id;
  PERFORM private.registrar_auditoria('cancelar_anexo_prontuario', 'anexos_prontuario', a.id, a.unidade_id,
    jsonb_build_object('motivo', btrim(p_motivo)));
END $$;

CREATE OR REPLACE FUNCTION public.registrar_impressao_prontuario(
  p_paciente uuid, p_documentos uuid[], p_anexos uuid[], p_autorizador text, p_observacao text,
  p_recebedor_nome text, p_recebedor_documento text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid; v_org uuid; v_id uuid := gen_random_uuid(); v_protocolo text;
  v_docs uuid[] := coalesce(p_documentos, '{}'); v_anx uuid[] := coalesce(p_anexos, '{}');
  v_itens jsonb; r public.impressoes_prontuario;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF private.prontuario_aberto(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Abra o prontuário do paciente antes (o acesso fica registrado).';
  END IF;
  IF cardinality(v_docs) + cardinality(v_anx) = 0 THEN RAISE EXCEPTION 'Marque ao menos um documento ou anexo.'; END IF;
  IF length(btrim(coalesce(p_autorizador, ''))) < 3 THEN RAISE EXCEPTION 'Informe quem autorizou a cópia do prontuário.'; END IF;
  IF length(btrim(coalesce(p_recebedor_nome, ''))) < 3 OR length(btrim(coalesce(p_recebedor_documento, ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o nome e o documento de quem recebe a cópia.';
  END IF;
  IF (SELECT count(*) FROM public.documentos_clinicos d
       WHERE d.id = ANY (v_docs) AND d.paciente_id = p_paciente AND d.numero IS NOT NULL AND d.estado <> 'rascunho')
     <> cardinality(ARRAY(SELECT DISTINCT unnest(v_docs))) THEN
    RAISE EXCEPTION 'Só entram documentos emitidos deste paciente.';
  END IF;
  IF (SELECT count(*) FROM public.anexos_prontuario a WHERE a.id = ANY (v_anx) AND a.paciente_id = p_paciente AND a.cancelado_em IS NULL)
     <> cardinality(ARRAY(SELECT DISTINCT unnest(v_anx))) THEN
    RAISE EXCEPTION 'Só entram anexos em vigor deste paciente.';
  END IF;

  SELECT p.unidade_id, u.organizacao_id INTO v_unidade, v_org
    FROM public.pacientes p JOIN public.unidades u ON u.id = p.unidade_id WHERE p.id = p_paciente;
  v_protocolo := 'PRO-' || upper(left(replace(v_id::text, '-', ''), 10));
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_itens FROM (
    SELECT jsonb_build_object('tipo', 'documento', 'id', d.id, 'documento', d.tipo_documento, 'numero', d.numero,
                              'versao', d.versao, 'estado', d.estado, 'criado_em', d.created_at) x
      FROM public.documentos_clinicos d WHERE d.id = ANY (v_docs)
    UNION ALL
    SELECT jsonb_build_object('tipo', 'anexo', 'id', a.id, 'nome', a.nome, 'tipo_mime', a.tipo_mime, 'criado_em', a.criado_em)
      FROM public.anexos_prontuario a WHERE a.id = ANY (v_anx)
  ) s;

  INSERT INTO public.impressoes_prontuario (id, organizacao_id, unidade_id, paciente_id, protocolo, impresso_por, documentos, anexos,
    itens, autorizador, observacao, recebedor_nome, recebedor_documento)
  VALUES (v_id, v_org, v_unidade, p_paciente, v_protocolo, v_perfil,
          ARRAY(SELECT DISTINCT unnest(v_docs)), ARRAY(SELECT DISTINCT unnest(v_anx)), v_itens,
          btrim(p_autorizador), nullif(btrim(coalesce(p_observacao, '')), ''), btrim(p_recebedor_nome), btrim(p_recebedor_documento))
  RETURNING * INTO r;

  -- a cópia inteira entra no registro de acessos ao prontuário (tipo impressão)
  PERFORM private.gravar_acesso(p_paciente, NULL, 'impressao', NULL, left('Cópia do prontuário ' || v_protocolo, 60));
  PERFORM private.registrar_auditoria('imprimir_prontuario', 'impressoes_prontuario', v_id, v_unidade,
    jsonb_build_object('protocolo', v_protocolo, 'documentos', cardinality(r.documentos), 'anexos', cardinality(r.anexos)));
  RETURN jsonb_build_object('id', r.id, 'protocolo', r.protocolo, 'impresso_em', r.impresso_em);
END $$;

CREATE OR REPLACE FUNCTION public.cancelar_impressao_prontuario(p_impressao uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.impressoes_prontuario; v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.impressoes_prontuario WHERE id = p_impressao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Impressão não encontrada.'; END IF;
  IF r.estado = 'cancelada' THEN RAISE EXCEPTION 'Esta impressão já está cancelada.'; END IF;
  IF NOT (r.impresso_por = v_perfil OR private.papel_na_unidade(r.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Só quem imprimiu ou o gestor da unidade cancela a impressão.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Informe a justificativa (mínimo de 10 letras).';
  END IF;
  UPDATE public.impressoes_prontuario
     SET estado = 'cancelada', cancelada_em = now(), cancelada_por = v_perfil, motivo_cancelamento = btrim(p_motivo)
   WHERE id = r.id;
  PERFORM private.registrar_auditoria('cancelar_impressao_prontuario', 'impressoes_prontuario', r.id, r.unidade_id,
    jsonb_build_object('protocolo', r.protocolo, 'motivo', btrim(p_motivo)));
END $$;

-- histórico de impressões com os nomes (a tabela guarda ids)
CREATE OR REPLACE FUNCTION public.impressoes_do_prontuario(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'protocolo', r.protocolo, 'impresso_em', r.impresso_em,
      'impresso_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = r.impresso_por),
      'meu', r.impresso_por = private.meu_perfil_id(),
      'documentos', to_jsonb(r.documentos), 'anexos', to_jsonb(r.anexos), 'itens', r.itens,
      'autorizador', r.autorizador, 'observacao', r.observacao,
      'recebedor_nome', r.recebedor_nome, 'recebedor_documento', r.recebedor_documento,
      'estado', r.estado, 'cancelada_em', r.cancelada_em, 'motivo_cancelamento', r.motivo_cancelamento,
      'cancelada_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = r.cancelada_por))
      ORDER BY r.impresso_em DESC), '[]'::jsonb)
    INTO v FROM public.impressoes_prontuario r WHERE r.paciente_id = p_paciente;
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.registrar_anexo_prontuario(uuid, text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_anexo_prontuario(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_impressao_prontuario(uuid, uuid[], uuid[], text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_impressao_prontuario(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.impressoes_do_prontuario(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.registro_so_cancela() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_anexo_prontuario(uuid, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_anexo_prontuario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_impressao_prontuario(uuid, uuid[], uuid[], text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_impressao_prontuario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.impressoes_do_prontuario(uuid) TO authenticated;
