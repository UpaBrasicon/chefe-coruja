-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 6 — trilha da visão da equipe do pacote de alta
-- (P2-05 do teste de ponta a ponta de 11/10/2026; decisões do RT de
-- 11/10/2026, BACKLOG.md).
--
-- • Cada abertura da visão da equipe grava leitura de documento (tipo
--   "Pacote de alta") no registro de acesso ao prontuário.
-- • Cada impressão pela equipe passa por registrar_impressao_pacote_alta:
--   grava a impressão (pacote inteiro ou o documento escolhido) e devolve o
--   protocolo do rodapé, como as outras impressões. Sem registro, a tela não
--   imprime.
-- • Quem abre: quem gerou o pacote e a equipe do setor, até 24 horas depois da
--   alta (a mesma regra da tarefa 1); o gestor sempre, com registro. Depois,
--   só pelo pedido de acesso ao gestor.
-- • O acesso do próprio paciente pelo link continua com o registro próprio
--   (pacotes_alta_acessos).
-- ════════════════════════════════════════════════════════════════════════════

-- quem vê o pacote pela equipe, agora
CREATE OR REPLACE FUNCTION private.pode_ver_pacote_equipe(pa public.pacotes_alta)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.papel_na_unidade(pa.unidade_id) = 'gestor'
      OR EXISTS (
        SELECT 1 FROM public.internacoes i
         WHERE i.id = pa.internacao_id
           AND (pa.criado_por = private.meu_perfil_id() OR private.cuido_da_internacao(i))
           AND (i.data_alta IS NULL OR coalesce(i.alta_registrada_em, i.data_alta) > now() - interval '24 hours'))
$$;
REVOKE ALL ON FUNCTION private.pode_ver_pacote_equipe(public.pacotes_alta) FROM PUBLIC, anon, authenticated;

-- grava no registro de acesso ao prontuário (leitura ou impressão do pacote)
CREATE OR REPLACE FUNCTION private.registrar_acesso_pacote(pa public.pacotes_alta, p_tipo text, p_documento_tipo text)
RETURNS public.log_acesso_prontuario LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.log_acesso_prontuario;
BEGIN
  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel,
     tipo_acesso, documento_tipo, ip, user_agent)
  VALUES
    ((SELECT organizacao_id FROM public.unidades WHERE id = pa.unidade_id),
     pa.unidade_id, pa.paciente_id, pa.internacao_id, private.meu_perfil_id(),
     nullif(private.papel_na_unidade(pa.unidade_id), ''), p_tipo, left(p_documento_tipo, 60),
     private.requisicao_ip(), private.requisicao_navegador())
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.registrar_acesso_pacote(public.pacotes_alta, text, text) FROM PUBLIC, anon, authenticated;

-- abrir: deixa de ser STABLE (grava a leitura)
CREATE OR REPLACE FUNCTION public.ver_pacote_alta_equipe(p_pacote uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacotes_alta;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacotes_alta WHERE id = p_pacote;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado.'; END IF;
  IF private.meu_perfil_id() IS NULL OR NOT private.pode_ver_pacote_equipe(pa) THEN
    RAISE EXCEPTION 'Acesso negado: a equipe vê o pacote até 24 horas depois da alta; depois, peça acesso ao gestor.';
  END IF;
  PERFORM private.registrar_acesso_pacote(pa, 'leitura_documento', 'Pacote de alta');
  RETURN jsonb_build_object(
      'situacao', 'ok',
      'situacao_link', CASE WHEN pa.situacao = 'ativo' AND pa.expira_em < now() THEN 'expirado' ELSE pa.situacao END)
    || private.conteudo_pacote_alta(pa.id);
END $$;
REVOKE ALL ON FUNCTION public.ver_pacote_alta_equipe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ver_pacote_alta_equipe(uuid) TO authenticated, service_role;

-- imprimir: o pacote inteiro (p_documento nulo) ou um documento dele
CREATE OR REPLACE FUNCTION public.registrar_impressao_pacote_alta(p_pacote uuid, p_documento text DEFAULT NULL)
RETURNS TABLE(protocolo text, emitido_em timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacotes_alta; r public.log_acesso_prontuario;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacotes_alta WHERE id = p_pacote;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado.'; END IF;
  IF private.meu_perfil_id() IS NULL OR NOT private.pode_ver_pacote_equipe(pa) THEN
    RAISE EXCEPTION 'Acesso negado: a equipe imprime o pacote até 24 horas depois da alta; depois, peça acesso ao gestor.';
  END IF;
  r := private.registrar_acesso_pacote(pa, 'impressao',
         'Pacote de alta' || coalesce(': ' || nullif(btrim(p_documento), ''), ' (inteiro)'));
  RETURN QUERY SELECT 'IMP-' || upper(left(replace(r.id::text, '-', ''), 10)), r.created_at;
END $$;
REVOKE ALL ON FUNCTION public.registrar_impressao_pacote_alta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_impressao_pacote_alta(uuid, text) TO authenticated, service_role;
