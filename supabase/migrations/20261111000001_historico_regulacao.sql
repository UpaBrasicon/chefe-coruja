-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 5 — histórico de regulação no prontuário. Decisões do RT em
-- 11/10/2026 (BACKLOG.md):
--
-- • Aparece no Resumo do leito da internação e no "Prontuário completo".
-- • Alcance: toda a rede — os pedidos do mesmo paciente em outras unidades da
--   organização entram, ligados pelo CPF ou CNS válido (e pelos cadastros
--   unificados). O acesso ao detalhe de um pedido de outra unidade fica no
--   registro de acesso daquela unidade, à vista do gestor dela.
-- • Quem vê: o médico e o gestor da unidade do paciente (a enfermagem não).
-- • A lista não registra acesso; abrir o detalhe grava no registro de acesso
--   ao prontuário (log_acesso_prontuario), que aparece na Auditoria.
-- ════════════════════════════════════════════════════════════════════════════

-- Cadastros do mesmo paciente na organização: o próprio, os unificados com ele
-- e os de outras unidades com o mesmo CNS ou CPF válido.
CREATE OR REPLACE FUNCTION private.regulacao_mesmo_paciente(p_paciente uuid)
RETURNS TABLE (paciente_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH base AS (
    SELECT pa.id, pa.cns, pa.cpf, pa.unificado_em, u.organizacao_id
      FROM public.pacientes pa JOIN public.unidades u ON u.id = pa.unidade_id
     WHERE pa.id = p_paciente)
  SELECT x.id
    FROM public.pacientes x JOIN public.unidades ux ON ux.id = x.unidade_id, base b
   WHERE ux.organizacao_id = b.organizacao_id
     AND (x.id = b.id
          OR x.unificado_em = b.id OR x.id = b.unificado_em
          OR (coalesce(private.cns_valido(b.cns), false) AND x.cns = b.cns)
          OR (coalesce(private.cpf_valido(b.cpf), false) AND x.cpf = b.cpf))
$$;
REVOKE ALL ON FUNCTION private.regulacao_mesmo_paciente(uuid) FROM PUBLIC, anon, authenticated;

-- Médico ou gestor da unidade do paciente.
CREATE OR REPLACE FUNCTION private.regulacao_ve_historico(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.pacientes pa
                  WHERE pa.id = p_paciente
                    AND (private.tenho_papel(pa.unidade_id, 'plantonista') OR private.tenho_papel(pa.unidade_id, 'gestor')))
$$;
REVOKE ALL ON FUNCTION private.regulacao_ve_historico(uuid) FROM PUBLIC, anon, authenticated;

-- Lista (não registra acesso): nº, data, unidade, tipo, prioridade, status e destino.
CREATE OR REPLACE FUNCTION public.regulacao_historico_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.regulacao_ve_historico(p_paciente) THEN
    RAISE EXCEPTION 'O histórico de regulação é visto pelo médico e pelo gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'numero', s.numero, 'criada_em', s.criada_em, 'status', s.status, 'tipo', s.tipo,
      'especialidade', s.especialidade, 'procedimento', s.procedimento,
      'procedimento_nome', (SELECT p.nome FROM terminologia.sigtap_procedimento p WHERE p.codigo = s.procedimento),
      'tipo_leito', s.tipo_leito, 'transporte', s.transporte,
      'prioridade', coalesce(s.prioridade_regulador, s.prioridade), 'carater', s.carater, 'cid', s.cid,
      'origem', (SELECT u.nome FROM public.unidades u WHERE u.id = s.unidade_origem_id),
      'outra_unidade', s.unidade_origem_id <> v_unidade,
      'destino', CASE s.destino_tipo WHEN 'rede' THEN (SELECT u.nome FROM public.unidades u WHERE u.id = s.destino_unidade_id)
                                     WHEN 'externo' THEN s.destino_externo END)
      ORDER BY s.criada_em DESC)
    FROM (SELECT * FROM public.regulacao_solicitacoes
           WHERE paciente_id IN (SELECT paciente_id FROM private.regulacao_mesmo_paciente(p_paciente))
           ORDER BY criada_em DESC LIMIT 100) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_historico_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_historico_paciente(uuid) TO authenticated;

-- Detalhe: registra o acesso no prontuário do pedido (na unidade de origem dele).
CREATE OR REPLACE FUNCTION public.regulacao_historico_detalhe(p_paciente uuid, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_papel text; v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.regulacao_ve_historico(p_paciente) THEN
    RAISE EXCEPTION 'O histórico de regulação é visto pelo médico e pelo gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO s FROM public.regulacao_solicitacoes
   WHERE id = p_id AND paciente_id IN (SELECT paciente_id FROM private.regulacao_mesmo_paciente(p_paciente));
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada para este paciente.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  v_papel := CASE WHEN private.tenho_papel(v_unidade, 'plantonista') THEN 'plantonista' ELSE 'gestor' END;
  INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso)
  VALUES (s.organizacao_id, s.unidade_origem_id, s.paciente_id, private.meu_perfil_id(), v_papel, 'leitura_prontuario');
  RETURN private.regulacao_json(s) || jsonb_build_object(
    'outra_unidade', s.unidade_origem_id <> v_unidade,
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'evento', e.evento, 'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = e.por), 'em', e.em, 'detalhes', e.detalhes)
        ORDER BY e.em) FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_historico_detalhe(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_historico_detalhe(uuid, uuid) TO authenticated;
