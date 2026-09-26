-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — consulta e impressão registradas pelo SERVIDOR (NGS2 / ADR 0004).
--
-- Antes, o registro de acesso era um pedido opcional do app: bastava não
-- chamar para não deixar rastro, e nenhuma impressão era registrada.
--
-- Consulta: o conteúdo clínico (documentos, observações, prescrições,
--   checklist de admissão, alta) só é lido com o prontuário ABERTO. Abrir é
--   a RPC abrir_prontuario(), que grava o acesso. Uma policy restritiva de
--   leitura exige esse registro — sem ele, a tabela devolve vazio. Um app
--   alterado não tem como ler sem deixar o rastro.
--   Aberturas repetidas do mesmo paciente em 5 minutos contam como uma; a
--   abertura vale por 12 horas (um plantão).
--
-- Impressão: registrar_impressao() grava o evento e devolve um protocolo
--   que sai no rodapé do papel. Papel sem protocolo não saiu do sistema.
--
-- IP e navegador vêm dos cabeçalhos da requisição, lidos no servidor.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.log_acesso_prontuario ADD COLUMN IF NOT EXISTS documento_tipo text;

CREATE INDEX IF NOT EXISTS idx_log_acesso_aberto
  ON public.log_acesso_prontuario (acessado_por, paciente_id, created_at DESC)
  WHERE tipo_acesso = 'leitura_prontuario';

-- ── cabeçalhos da requisição (PostgREST) ────────────────────────────────────
CREATE OR REPLACE FUNCTION private.requisicao_ip()
RETURNS inet
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE v text;
BEGIN
  v := nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for';
  v := btrim(split_part(coalesce(v, ''), ',', 1));
  RETURN nullif(v, '')::inet;
EXCEPTION WHEN others THEN
  RETURN NULL;  -- cabeçalho malformado não impede o registro
END $$;

CREATE OR REPLACE FUNCTION private.requisicao_navegador()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT left(nullif(current_setting('request.headers', true), '')::json ->> 'user-agent', 300);
$$;

-- ── gravação comum ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.gravar_acesso(
  p_paciente uuid, p_internacao uuid, p_tipo text, p_documento uuid, p_documento_tipo text)
RETURNS public.log_acesso_prontuario
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  r public.log_acesso_prontuario;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF p_internacao IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.internacoes WHERE id = p_internacao AND paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'Internação não pertence ao paciente.';
  END IF;

  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel,
     tipo_acesso, documento_id, documento_tipo, ip, user_agent)
  VALUES
    ((SELECT organizacao_id FROM public.unidades WHERE id = v_unidade),
     v_unidade, p_paciente, p_internacao, v_perfil,
     nullif(private.papel_na_unidade(v_unidade), ''), p_tipo, p_documento, p_documento_tipo,
     private.requisicao_ip(), private.requisicao_navegador())
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.gravar_acesso(uuid, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- ── consulta ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.abrir_prontuario(p_paciente uuid, p_internacao uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.log_acesso_prontuario
    WHERE acessado_por = private.meu_perfil_id()
      AND paciente_id = p_paciente
      AND tipo_acesso = 'leitura_prontuario'
      AND internacao_id IS NOT DISTINCT FROM p_internacao
      AND created_at > now() - interval '5 minutes'
  ) THEN
    -- ainda confere o acesso: sem isso, a janela viraria atalho
    IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
      RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
    END IF;
    RETURN;
  END IF;
  PERFORM private.gravar_acesso(p_paciente, p_internacao, 'leitura_prontuario', NULL, NULL);
END $$;
REVOKE ALL ON FUNCTION public.abrir_prontuario(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_prontuario(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.prontuario_aberto(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.log_acesso_prontuario
    WHERE acessado_por = private.meu_perfil_id()
      AND paciente_id = p_paciente
      AND tipo_acesso = 'leitura_prontuario'
      AND created_at > now() - interval '12 hours'
  );
$$;
REVOKE ALL ON FUNCTION private.prontuario_aberto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.prontuario_aberto(uuid) TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documentos_clinicos', 'observacao', 'prescricoes', 'checklist_admissao', 'alta_paciente'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_prontuario_aberto ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY %1$s_prontuario_aberto ON public.%1$I AS RESTRICTIVE FOR SELECT TO authenticated
         USING (private.prontuario_aberto(paciente_id))', t);
  END LOOP;
END $$;

-- itens seguem a prescrição (que já exige setor e prontuário aberto)
DO $$
DECLARE
  cmd text;
  regra text := $r$(EXISTS (
    SELECT 1 FROM public.prescricoes p
    WHERE p.id = prescricao_itens.prescricao_id
      AND (private.eh_super_admin()
           OR private.papel_na_unidade(p.unidade_id) = 'gestor'
           OR (p.medico_id = private.meu_perfil_id()
               AND private.papel_na_unidade(p.unidade_id) = 'plantonista'
               AND private.paciente_no_meu_plantao(p.paciente_id)))))$r$;
BEGIN
  FOREACH cmd IN ARRAY ARRAY['select', 'update', 'delete'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS prescricao_itens_%s ON public.prescricao_itens', cmd);
    EXECUTE format('CREATE POLICY prescricao_itens_%1$s ON public.prescricao_itens FOR %2$s TO authenticated USING %3$s',
      cmd, upper(cmd), regra);
  END LOOP;
END $$;

-- ── impressão ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_impressao(
  p_paciente uuid, p_documento_tipo text, p_internacao uuid DEFAULT NULL, p_documento uuid DEFAULT NULL)
RETURNS TABLE (protocolo text, emitido_em timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.log_acesso_prontuario;
BEGIN
  IF nullif(btrim(p_documento_tipo), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o tipo de documento impresso.';
  END IF;
  r := private.gravar_acesso(p_paciente, p_internacao, 'impressao', p_documento, left(btrim(p_documento_tipo), 60));
  RETURN QUERY SELECT 'IMP-' || upper(left(replace(r.id::text, '-', ''), 10)), r.created_at;
END $$;
REVOKE ALL ON FUNCTION public.registrar_impressao(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_impressao(uuid, text, uuid, uuid) TO authenticated;

-- ── o registro antigo, feito a pedido do app, sai ───────────────────────────
-- Ele aceitava qualquer tipo (inclusive 'impressao') de quem só fosse membro
-- da unidade. Fica no banco para o histórico, sem execução pelo app.
REVOKE EXECUTE ON FUNCTION public.registrar_acesso_prontuario(uuid, uuid, text, uuid, uuid) FROM authenticated;
