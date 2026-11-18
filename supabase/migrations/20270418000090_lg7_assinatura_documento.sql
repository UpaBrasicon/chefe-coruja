-- LG7 (decisões do RT de 18/11/2026, A1–A7 = A; docs/regulatorio/LG7-DESENHO-TECNICO.md):
-- base do banco da assinatura qualificada ICP-Brasil dos documentos.
--   * private.sessoes_assinatura: a sessão do médico com o provedor (até o fim
--     do plantão, no máximo 12 h). SEM token: o token fica só no assinador (VPS).
--   * public.assinaturas_documento: a assinatura de cada documento (só de
--     inclusão). O documento continua 'ativo'; o selo vem de
--     documentos_clinicos.assinado_em (42 consultas procuram 'ativo').
--   * private.abrir_sessao_assinatura / private.registrar_assinatura_documento /
--     private.encerrar_sessao_assinatura: só o papel assinador_app executa.
--   * public.minha_sessao_assinatura(): o app mostra se a sessão vale.
--   * public.conferir_assinatura(codigo): conferência pública, sem dado do paciente.
--   * public.assinaturas (antiga, vazia, presa à prescrição): sai a escrita pelo
--     usuário; a leitura fica. Contract numa release seguinte.
--
-- Expand: só acrescenta e restringe a escrita de uma tabela vazia.
-- Rollback (testado na homologação, dentro de transação):
--   docs/regulatorio/LG7-ROLLBACK-20270418000090.sql

-- ------------------------------------------------------- 1. papel do assinador
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'assinador_app') THEN
    CREATE ROLE assinador_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE assinador_app LOGIN NOINHERIT NOCREATEDB NOCREATEROLE CONNECTION LIMIT 5;
ALTER ROLE assinador_app SET statement_timeout = '15s';
ALTER ROLE assinador_app SET lock_timeout = '5s';
ALTER ROLE assinador_app SET idle_in_transaction_session_timeout = '30s';
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'assinador_app'
             AND (rolsuper OR rolbypassrls OR rolreplication OR rolcreaterole OR rolcreatedb)) THEN
    RAISE EXCEPTION 'assinador_app não pode ser superuser, bypassar RLS, replicar nem criar papel/banco';
  END IF;
END $$;
GRANT USAGE ON SCHEMA private TO assinador_app;

-- ---------------------------------------------------- 2. sessões de assinatura
CREATE TABLE IF NOT EXISTS private.sessoes_assinatura (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES public.perfis(id),
  provedor        text NOT NULL CHECK (provedor IN ('vidaas', 'birdid', 'neoid', 'safeid', 'remoteid', 'outro')),
  cert_serial     text NOT NULL,
  cert_emissor    text NOT NULL,
  cert_cpf_final  text NOT NULL CHECK (cert_cpf_final ~ '^[0-9]{4}$'),  -- só os 4 últimos dígitos
  cert_valido_ate timestamptz NOT NULL,
  inicio          timestamptz NOT NULL DEFAULT now(),
  valida_ate      timestamptz NOT NULL,
  encerrada_em    timestamptz,
  motivo_fim      text,
  CHECK (valida_ate > inicio AND valida_ate <= inicio + interval '12 hours')
);
CREATE INDEX IF NOT EXISTS sessoes_assinatura_perfil_idx ON private.sessoes_assinatura (perfil_id, valida_ate DESC);
ALTER TABLE private.sessoes_assinatura ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.sessoes_assinatura FROM PUBLIC, anon, authenticated;

-- -------------------------------------------- 3. assinatura de cada documento
CREATE TABLE IF NOT EXISTS public.assinaturas_documento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id    uuid NOT NULL REFERENCES public.documentos_clinicos(id),
  medico_id       uuid NOT NULL REFERENCES public.perfis(id),
  sessao_id       uuid NOT NULL REFERENCES private.sessoes_assinatura(id),
  provedor        text NOT NULL,
  cert_serial     text NOT NULL,
  cert_emissor    text NOT NULL,
  politica        text NOT NULL DEFAULT 'AD-RB' CHECK (politica IN ('AD-RB', 'AD-RT')),
  pdf_sha256      text NOT NULL CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_caminho     text NOT NULL,
  codigo_sha256   text NOT NULL UNIQUE CHECK (codigo_sha256 ~ '^[0-9a-f]{64}$'),  -- código da conferência, só o hash
  em              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_documento_doc_uq ON public.assinaturas_documento (documento_id);
CREATE INDEX IF NOT EXISTS assinaturas_documento_medico_idx ON public.assinaturas_documento (medico_id);
CREATE INDEX IF NOT EXISTS assinaturas_documento_sessao_idx ON public.assinaturas_documento (sessao_id);

ALTER TABLE public.assinaturas_documento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assinaturas_documento FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.assinaturas_documento TO authenticated;
-- lê quem pode ler o documento (a RLS de documentos_clinicos vale dentro do EXISTS)
DROP POLICY IF EXISTS assinaturas_documento_select ON public.assinaturas_documento;
CREATE POLICY assinaturas_documento_select ON public.assinaturas_documento FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documentos_clinicos d WHERE d.id = documento_id));
DROP TRIGGER IF EXISTS trg_assinaturas_documento_so_insercao ON public.assinaturas_documento;
CREATE TRIGGER trg_assinaturas_documento_so_insercao
  BEFORE UPDATE OR DELETE ON public.assinaturas_documento
  FOR EACH ROW EXECUTE FUNCTION private.recusar_alteracao_de_registro();

-- --------------------------------------------- 4. tabela antiga: sem escrita
DROP POLICY IF EXISTS "assinaturas_insert" ON public.assinaturas;
DROP POLICY IF EXISTS "assinaturas_update" ON public.assinaturas;
DROP POLICY IF EXISTS "assinaturas_delete" ON public.assinaturas;
REVOKE INSERT, UPDATE, DELETE ON public.assinaturas FROM anon, authenticated;

-- ------------------------------------------- 5. funções do assinador (VPS)
-- Abre a sessão depois do OAuth do provedor. O assinador já conferiu o login
-- do médico (JWT) e o CPF do certificado contra o perfil.
CREATE OR REPLACE FUNCTION private.abrir_sessao_assinatura(
  p_perfil uuid, p_provedor text, p_serial text, p_emissor text, p_cpf_final text,
  p_cert_valido_ate timestamptz, p_valida_ate timestamptz)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_ate timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE id = p_perfil) THEN
    RAISE EXCEPTION 'Perfil desconhecido';
  END IF;
  IF p_cert_valido_ate <= now() THEN
    RAISE EXCEPTION 'Certificado vencido';
  END IF;
  v_ate := least(p_valida_ate, now() + interval '12 hours', p_cert_valido_ate);
  IF v_ate <= now() THEN RAISE EXCEPTION 'Validade da sessão já passou'; END IF;
  -- uma sessão por médico: a anterior é encerrada
  UPDATE private.sessoes_assinatura SET encerrada_em = now(), motivo_fim = 'nova sessão'
   WHERE perfil_id = p_perfil AND encerrada_em IS NULL AND valida_ate > now();
  INSERT INTO private.sessoes_assinatura (perfil_id, provedor, cert_serial, cert_emissor, cert_cpf_final,
                                          cert_valido_ate, valida_ate)
  VALUES (p_perfil, p_provedor, trim(p_serial), trim(p_emissor), p_cpf_final, p_cert_valido_ate, v_ate)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('abrir_sessao_assinatura', 'sessoes_assinatura', v_id, NULL,
    jsonb_build_object('perfil', p_perfil, 'provedor', p_provedor, 'valida_ate', v_ate));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION private.encerrar_sessao_assinatura(p_sessao uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE private.sessoes_assinatura SET encerrada_em = now(), motivo_fim = left(coalesce(p_motivo, 'encerrada'), 80)
   WHERE id = p_sessao AND encerrada_em IS NULL;
  PERFORM private.registrar_auditoria('encerrar_sessao_assinatura', 'sessoes_assinatura', p_sessao, NULL,
    jsonb_build_object('motivo', p_motivo));
END $$;

-- Grava a assinatura de um documento emitido. Confere tudo de novo: o
-- documento está ativo e numerado, é do médico da sessão, e a sessão vale.
CREATE OR REPLACE FUNCTION private.registrar_assinatura_documento(
  p_documento uuid, p_sessao uuid, p_pdf_sha256 text, p_pdf_caminho text, p_codigo_sha256 text,
  p_politica text DEFAULT 'AD-RB')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d    public.documentos_clinicos;
  s    private.sessoes_assinatura;
  v_id uuid;
BEGIN
  SELECT * INTO s FROM private.sessoes_assinatura WHERE id = p_sessao;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Sessão de assinatura desconhecida'; END IF;
  IF s.encerrada_em IS NOT NULL OR s.valida_ate <= now() THEN
    RAISE EXCEPTION 'Sessão de assinatura encerrada ou vencida';
  END IF;
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Documento desconhecido'; END IF;
  IF d.estado <> 'ativo' OR d.numero IS NULL THEN
    RAISE EXCEPTION 'Só documento emitido e numerado é assinado (estado %)', d.estado;
  END IF;
  IF d.autor_id <> s.perfil_id THEN
    RAISE EXCEPTION 'Só o autor do documento o assina';
  END IF;
  IF d.assinado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Documento já assinado';
  END IF;
  INSERT INTO public.assinaturas_documento (documento_id, medico_id, sessao_id, provedor, cert_serial, cert_emissor,
                                            politica, pdf_sha256, pdf_caminho, codigo_sha256)
  VALUES (d.id, s.perfil_id, s.id, s.provedor, s.cert_serial, s.cert_emissor,
          p_politica, lower(p_pdf_sha256), p_pdf_caminho, lower(p_codigo_sha256))
  RETURNING id INTO v_id;
  UPDATE public.documentos_clinicos SET assinatura_id = v_id, assinado_em = now() WHERE id = d.id;
  PERFORM private.registrar_auditoria('assinar_documento', 'documentos_clinicos', d.id, NULL,
    jsonb_build_object('assinatura', v_id, 'provedor', s.provedor, 'politica', p_politica));
  RETURN v_id;
END $$;

-- -------------------------------------------- 6. funções para o app e público
CREATE OR REPLACE FUNCTION public.minha_sessao_assinatura()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('ativa', s.id IS NOT NULL, 'provedor', s.provedor, 'valida_ate', s.valida_ate,
                            'cert_cpf_final', s.cert_cpf_final)
    FROM (SELECT 1) x
    LEFT JOIN LATERAL (
      SELECT * FROM private.sessoes_assinatura
       WHERE perfil_id = private.meu_perfil_id() AND encerrada_em IS NULL AND valida_ate > now()
       ORDER BY inicio DESC LIMIT 1) s ON true
$$;

-- Conferência pública pelo QR code: só o necessário, nunca dado do paciente.
CREATE OR REPLACE FUNCTION public.conferir_assinatura(p_codigo text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN a.id IS NULL THEN jsonb_build_object('encontrada', false)
    ELSE jsonb_build_object(
      'encontrada', true,
      'tipo_documento', d.tipo_documento,
      'numero', d.numero,
      'estado', d.estado,
      'assinado_por', p.nome_completo,
      'registro', nullif(trim(coalesce(p.conselho, 'CRM') || ' ' || coalesce(p.registro_numero, p.crm, '') || '/'
                              || coalesce(p.registro_uf, p.uf_crm, '')), 'CRM /'),
      'assinado_em', a.em,
      'politica', a.politica,
      'pdf_sha256', a.pdf_sha256) END
    FROM (SELECT 1) x
    LEFT JOIN public.assinaturas_documento a
      ON length(coalesce(p_codigo, '')) >= 32
     AND a.codigo_sha256 = encode(extensions.digest(p_codigo, 'sha256'), 'hex')
    LEFT JOIN public.documentos_clinicos d ON d.id = a.documento_id
    LEFT JOIN public.perfis p ON p.id = a.medico_id
$$;

-- ----------------------------------------------------------------- 7. grants
REVOKE ALL ON FUNCTION private.abrir_sessao_assinatura(uuid, text, text, text, text, timestamptz, timestamptz),
  private.encerrar_sessao_assinatura(uuid, text),
  private.registrar_assinatura_documento(uuid, uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.abrir_sessao_assinatura(uuid, text, text, text, text, timestamptz, timestamptz),
  private.encerrar_sessao_assinatura(uuid, text),
  private.registrar_assinatura_documento(uuid, uuid, text, text, text, text)
  TO assinador_app;
REVOKE ALL ON FUNCTION public.minha_sessao_assinatura() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minha_sessao_assinatura() TO authenticated;
REVOKE ALL ON FUNCTION public.conferir_assinatura(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conferir_assinatura(text) TO anon, authenticated;
