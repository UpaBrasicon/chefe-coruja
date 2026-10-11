-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 6 — anexos e laudos da regulação. Decisões do RT em
-- 11/10/2026 (BACKLOG.md):
--
-- • Arquivos PDF, JPG e PNG, até 10 MB cada e até 10 por pedido, em área
--   privada (bucket "regulacao"); abrir gera link temporário de 60 s.
-- • Também se anexa um documento já emitido no prontuário do paciente.
-- • Anexam, com o pedido em aberto: o solicitante, o médico assistente e o
--   gestor da origem, e o regulador da central.
-- • Retirar: sai da lista com motivo, mas continua guardado; quem retirou e o
--   motivo ficam na auditoria.
-- • Abrem: quem vê o pedido (origem e central) e, pelo histórico do
--   prontuário, o médico e o gestor da rede. Toda abertura entra no registro de
--   acesso ao prontuário. Para isso o arquivo não se lê direto do armazenamento:
--   a RPC regulacao_anexo_abrir registra o acesso e libera a leitura por 2 min.
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('regulacao', 'regulacao', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

CREATE TABLE IF NOT EXISTS public.regulacao_anexos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id   uuid NOT NULL REFERENCES public.regulacao_solicitacoes(id),
  tipo             text NOT NULL CHECK (tipo IN ('arquivo', 'documento')),
  caminho          text UNIQUE,
  nome             text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 200),
  tamanho          integer CHECK (tamanho IS NULL OR (tamanho > 0 AND tamanho <= 10485760)),
  tipo_mime        text CHECK (tipo_mime IS NULL OR tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png')),
  documento_id     uuid REFERENCES public.documentos_clinicos(id),
  enviado_por      uuid NOT NULL REFERENCES public.perfis(id),
  enviado_em       timestamptz NOT NULL DEFAULT now(),
  retirado_em      timestamptz,
  retirado_por     uuid REFERENCES public.perfis(id),
  motivo_retirada  text,
  CHECK ((tipo = 'arquivo' AND caminho IS NOT NULL AND documento_id IS NULL)
      OR (tipo = 'documento' AND documento_id IS NOT NULL AND caminho IS NULL)),
  CHECK (retirado_em IS NULL OR length(btrim(coalesce(motivo_retirada, ''))) >= 10)
);
CREATE INDEX IF NOT EXISTS idx_regulacao_anexos ON public.regulacao_anexos (solicitacao_id, enviado_em);
ALTER TABLE public.regulacao_anexos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_anexos FROM anon, authenticated;

-- só a retirada muda o registro; nunca se apaga
CREATE OR REPLACE FUNCTION private.regulacao_anexo_imutavel()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Anexo da regulação não se apaga; retire com motivo.'; END IF;
  IF (NEW.id, NEW.solicitacao_id, NEW.tipo, NEW.caminho, NEW.nome, NEW.tamanho, NEW.tipo_mime, NEW.documento_id, NEW.enviado_por, NEW.enviado_em)
     IS DISTINCT FROM
     (OLD.id, OLD.solicitacao_id, OLD.tipo, OLD.caminho, OLD.nome, OLD.tamanho, OLD.tipo_mime, OLD.documento_id, OLD.enviado_por, OLD.enviado_em)
     OR OLD.retirado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Do anexo só se registra a retirada.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_regulacao_anexos_imutavel ON public.regulacao_anexos;
CREATE TRIGGER trg_regulacao_anexos_imutavel BEFORE UPDATE OR DELETE ON public.regulacao_anexos
  FOR EACH ROW EXECUTE FUNCTION private.regulacao_anexo_imutavel();

-- liberação de leitura de um arquivo, criada por regulacao_anexo_abrir
CREATE TABLE IF NOT EXISTS private.regulacao_anexo_liberacao (
  perfil_id  uuid NOT NULL,
  caminho    text NOT NULL,
  ate        timestamptz NOT NULL,
  PRIMARY KEY (perfil_id, caminho)
);

-- ── quem pode ───────────────────────────────────────────────────────────────
-- Anexar ou retirar: origem (solicitante, médico assistente, gestor) e o regulador da central.
CREATE OR REPLACE FUNCTION private.regulacao_pode_anexar(s public.regulacao_solicitacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.regulacao_origem_pode(s) OR private.tenho_papel(s.central_id, 'regulador')
$$;
REVOKE ALL ON FUNCTION private.regulacao_pode_anexar(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- Abrir: quem vê o pedido, ou o médico/gestor da rede pelo histórico do prontuário.
CREATE OR REPLACE FUNCTION private.regulacao_pode_abrir_anexo(s public.regulacao_solicitacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.regulacao_pode_ver(s)
      OR EXISTS (SELECT 1 FROM private.regulacao_mesmo_paciente(s.paciente_id) m
                  WHERE private.regulacao_ve_historico(m.paciente_id))
$$;
REVOKE ALL ON FUNCTION private.regulacao_pode_abrir_anexo(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.regulacao_do_caminho(p_nome text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  RETURN (regexp_match(p_nome, '^([0-9a-fA-F-]{36})/'))[1]::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.regulacao_pode_subir(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.regulacao_solicitacoes s
                  WHERE s.id = private.regulacao_do_caminho(p_nome)
                    AND s.status IN ('rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida')
                    AND private.regulacao_pode_anexar(s))
$$;
REVOKE ALL ON FUNCTION private.regulacao_pode_subir(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.regulacao_pode_subir(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.regulacao_leitura_liberada(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.regulacao_anexo_liberacao l
                  WHERE l.perfil_id = auth.uid() AND l.caminho = p_nome AND l.ate > now())
$$;
REVOKE ALL ON FUNCTION private.regulacao_leitura_liberada(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.regulacao_leitura_liberada(text) TO authenticated;

DROP POLICY IF EXISTS "regulacao_upload" ON storage.objects;
CREATE POLICY "regulacao_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'regulacao' AND private.regulacao_pode_subir(name));
DROP POLICY IF EXISTS "regulacao_read" ON storage.objects;
CREATE POLICY "regulacao_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'regulacao' AND private.regulacao_leitura_liberada(name));

-- ── RPCs ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_anexo_conferir(s public.regulacao_solicitacoes)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.regulacao_pode_anexar(s) THEN
    RAISE EXCEPTION 'Anexam o solicitante, o médico assistente e o gestor da origem, e o regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida') THEN
    RAISE EXCEPTION 'Só se anexa com o pedido em aberto.';
  END IF;
  IF (SELECT count(*) FROM public.regulacao_anexos a WHERE a.solicitacao_id = s.id AND a.retirado_em IS NULL) >= 10 THEN
    RAISE EXCEPTION 'O pedido já tem 10 anexos. Retire um para incluir outro.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_anexo_conferir(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- Registra o arquivo já enviado ao bucket (caminho "<id do pedido>/...").
CREATE OR REPLACE FUNCTION public.regulacao_registrar_anexo(p_solicitacao uuid, p_caminho text, p_nome text,
  p_tamanho integer, p_tipo_mime text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  PERFORM private.regulacao_anexo_conferir(s);
  IF private.regulacao_do_caminho(p_caminho) IS DISTINCT FROM s.id THEN RAISE EXCEPTION 'O arquivo não é deste pedido.'; END IF;
  IF p_tipo_mime IS NULL OR p_tipo_mime NOT IN ('application/pdf', 'image/jpeg', 'image/png') THEN
    RAISE EXCEPTION 'Envie PDF, JPG ou PNG.';
  END IF;
  IF p_tamanho IS NULL OR p_tamanho <= 0 OR p_tamanho > 10485760 THEN RAISE EXCEPTION 'O arquivo vai até 10 MB.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'regulacao' AND o.name = p_caminho) THEN
    RAISE EXCEPTION 'O arquivo não chegou ao armazenamento. Envie de novo.';
  END IF;
  INSERT INTO public.regulacao_anexos (solicitacao_id, tipo, caminho, nome, tamanho, tipo_mime, enviado_por)
  VALUES (s.id, 'arquivo', p_caminho, btrim(p_nome), p_tamanho, p_tipo_mime, private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.regulacao_evento(s.id, 'anexo_incluido', jsonb_build_object('nome', btrim(p_nome)));
  PERFORM private.registrar_auditoria('regulacao_anexo_incluido', 'regulacao_anexos', v_id, s.unidade_origem_id,
    jsonb_build_object('solicitacao', s.id, 'nome', btrim(p_nome)));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_registrar_anexo(uuid, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_registrar_anexo(uuid, text, text, integer, text) TO authenticated;

-- Documentos do prontuário do paciente que podem ir como anexo (versão mais recente).
CREATE OR REPLACE FUNCTION public.regulacao_documentos_anexaveis(p_solicitacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao;
  IF NOT FOUND OR NOT private.regulacao_pode_anexar(s) THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'tipo', d.tipo_documento, 'numero', d.numero, 'versao', d.versao,
      'emitido_em', coalesce(d.emitido_em, d.created_at), 'autor', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = d.autor_id))
      ORDER BY coalesce(d.emitido_em, d.created_at) DESC)
    FROM (SELECT DISTINCT ON (dc.documento_raiz_id) dc.* FROM public.documentos_clinicos dc
           WHERE dc.paciente_id = s.paciente_id AND dc.estado NOT IN ('rascunho', 'cancelado')
           ORDER BY dc.documento_raiz_id, dc.versao DESC) d), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_documentos_anexaveis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_documentos_anexaveis(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_anexar_documento(p_solicitacao uuid, p_documento uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; d public.documentos_clinicos; v_id uuid; v_nome text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  PERFORM private.regulacao_anexo_conferir(s);
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento;
  IF NOT FOUND OR d.paciente_id <> s.paciente_id OR d.estado IN ('rascunho', 'cancelado') THEN
    RAISE EXCEPTION 'Documento não encontrado no prontuário deste paciente.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.regulacao_anexos a WHERE a.solicitacao_id = s.id AND a.documento_id = d.id AND a.retirado_em IS NULL) THEN
    RAISE EXCEPTION 'Este documento já está anexado.';
  END IF;
  v_nome := initcap(replace(d.tipo_documento, '_', ' ')) || coalesce(' nº ' || d.numero, '') || ' (versão ' || d.versao || ')';
  INSERT INTO public.regulacao_anexos (solicitacao_id, tipo, nome, documento_id, enviado_por)
  VALUES (s.id, 'documento', v_nome, d.id, private.meu_perfil_id()) RETURNING id INTO v_id;
  PERFORM private.regulacao_evento(s.id, 'anexo_incluido', jsonb_build_object('nome', v_nome));
  PERFORM private.registrar_auditoria('regulacao_anexo_incluido', 'regulacao_anexos', v_id, s.unidade_origem_id,
    jsonb_build_object('solicitacao', s.id, 'documento', d.id));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_anexar_documento(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_anexar_documento(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_anexos(p_solicitacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao;
  IF NOT FOUND OR NOT private.regulacao_pode_abrir_anexo(s) THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN jsonb_build_object(
    'pode_anexar', private.regulacao_pode_anexar(s) AND s.status IN ('rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida'),
    'anexos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'tipo', a.tipo, 'nome', a.nome, 'tamanho', a.tamanho,
        'tipo_mime', a.tipo_mime, 'enviado_em', a.enviado_em,
        'enviado_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = a.enviado_por)) ORDER BY a.enviado_em)
      FROM public.regulacao_anexos a WHERE a.solicitacao_id = s.id AND a.retirado_em IS NULL), '[]'::jsonb),
    'retirados', (SELECT count(*) FROM public.regulacao_anexos a WHERE a.solicitacao_id = s.id AND a.retirado_em IS NOT NULL));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_anexos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_anexos(uuid) TO authenticated;

-- Abre um anexo: registra o acesso e devolve o que mostrar. Arquivo: libera a
-- leitura do caminho por 2 min (o navegador gera o link de 60 s). Documento:
-- devolve o texto da versão anexada.
CREATE OR REPLACE FUNCTION public.regulacao_anexo_abrir(p_anexo uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.regulacao_anexos; s public.regulacao_solicitacoes; d public.documentos_clinicos; v_papel text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.regulacao_anexos WHERE id = p_anexo;
  IF NOT FOUND OR a.retirado_em IS NOT NULL THEN RAISE EXCEPTION 'Anexo não encontrado.'; END IF;
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = a.solicitacao_id;
  IF NOT private.regulacao_pode_abrir_anexo(s) THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  v_papel := CASE WHEN private.tenho_papel(s.central_id, 'regulador') THEN 'regulador'
                  WHEN private.tenho_papel(s.unidade_origem_id, 'plantonista') THEN 'plantonista'
                  WHEN private.tenho_papel(s.unidade_origem_id, 'gestor') THEN 'gestor' ELSE 'rede' END;
  INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso, documento_id)
  VALUES (s.organizacao_id, s.unidade_origem_id, s.paciente_id, private.meu_perfil_id(), v_papel, 'leitura_documento', a.documento_id);
  PERFORM private.regulacao_evento(s.id, 'anexo_aberto', jsonb_build_object('nome', a.nome));
  IF a.tipo = 'arquivo' THEN
    INSERT INTO private.regulacao_anexo_liberacao (perfil_id, caminho, ate)
    VALUES (private.meu_perfil_id(), a.caminho, now() + interval '2 minutes')
    ON CONFLICT (perfil_id, caminho) DO UPDATE SET ate = excluded.ate;
    RETURN jsonb_build_object('tipo', 'arquivo', 'caminho', a.caminho, 'nome', a.nome, 'tipo_mime', a.tipo_mime);
  END IF;
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = a.documento_id;
  RETURN jsonb_build_object('tipo', 'documento', 'nome', a.nome, 'tipo_documento', d.tipo_documento, 'versao', d.versao,
    'emitido_em', coalesce(d.emitido_em, d.created_at), 'conteudo', d.conteudo,
    'autor', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = d.autor_id));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_anexo_abrir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_anexo_abrir(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_retirar_anexo(p_anexo uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.regulacao_anexos; s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.regulacao_anexos WHERE id = p_anexo FOR UPDATE;
  IF NOT FOUND OR a.retirado_em IS NOT NULL THEN RAISE EXCEPTION 'Anexo não encontrado.'; END IF;
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = a.solicitacao_id;
  IF NOT private.regulacao_pode_anexar(s) THEN
    RAISE EXCEPTION 'Retiram o solicitante, o médico assistente e o gestor da origem, e o regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.regulacao_anexos SET retirado_em = now(), retirado_por = private.meu_perfil_id(), motivo_retirada = btrim(p_motivo)
   WHERE id = a.id;
  PERFORM private.regulacao_evento(s.id, 'anexo_retirado', jsonb_build_object('nome', a.nome, 'motivo', btrim(p_motivo)));
  PERFORM private.registrar_auditoria('regulacao_anexo_retirado', 'regulacao_anexos', a.id, s.unidade_origem_id,
    jsonb_build_object('nome', a.nome, 'motivo', btrim(p_motivo)));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_retirar_anexo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_retirar_anexo(uuid, text) TO authenticated;
