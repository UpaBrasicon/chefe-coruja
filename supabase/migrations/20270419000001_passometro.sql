-- ════════════════════════════════════════════════════════════════════════════
-- Pedido 8 do RT (17/11/2026), "Meu plantão": passômetro do médico.
-- Decisões do RT em 23/11/2026 (docs/plantonista/PASSOMETRO-DIAGNOSTICO.md):
--   PS1 = A: a lista sai do prontuário, com os pacientes que o médico cuida
--            (observação e internação dos setores da escala dele agora, a
--            mesma regra de cuido_da_internacao). Ninguém digita nome.
--   PS2 = A: as pendências seguem com o paciente. Já existem desde a Fase 3.1
--            (public.pendencias, registrar_pendencia, concluir_pendencia,
--            desfazer_pendencia): aqui só se lê; nada muda nelas.
--   PS3 = A: folha A4 do passômetro; cada impressão grava, paciente a
--            paciente, no registro de acesso ao prontuário (tipo impressao,
--            documento "Passômetro"). Sem registro, a tela não imprime.
--
-- • public.passometro(unidade): para o médico (vínculo plantonista ativo),
--   com segundo fator. Devolve os pacientes e, de cada um, as pendências
--   abertas e as resolvidas nas últimas 24 horas (para o "desfazer").
-- • public.registrar_impressao_passometro(unidade): grava a impressão e
--   devolve quantos pacientes foram e a hora, para o rodapé da folha.
--
-- Expand: duas funções novas, sem tabela. Idempotente.
-- Volta: supabase/snippets/passometro_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.passometro_internacoes(p_unidade uuid)
RETURNS SETOF public.internacoes
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.*
    FROM public.internacoes i
   WHERE i.unidade_id = p_unidade
     AND i.status IN ('admitido', 'em_observacao', 'internado')
     AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
$$;
REVOKE ALL ON FUNCTION private.passometro_internacoes(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.passometro(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_unidade IS NULL OR NOT private.tenho_papel(p_unidade, 'plantonista') THEN
    RAISE EXCEPTION 'Acesso negado: o passômetro é do médico de plantão na unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'internacao_id', i.id,
             'paciente_id', i.paciente_id,
             'nome', coalesce(pa.nome_social, pa.nome),
             'data_nascimento', pa.data_nascimento,
             'sexo', pa.sexo,
             'setor_id', i.setor_atual_id,
             'setor', s.nome,
             'leito', l.identificador,
             'status', i.status,
             'desde', coalesce(i.data_entrada_setor, i.data_admissao),
             'data_admissao', i.data_admissao,
             'cid_principal', i.cid_principal,
             'queixa', ep.queixa,
             'pendencias', coalesce((
               SELECT jsonb_agg(jsonb_build_object(
                        'id', p.id, 'tipo', p.tipo, 'descricao', p.descricao, 'prazo', p.prazo,
                        'impeditiva', p.impeditiva, 'situacao', p.situacao, 'criada_em', p.criada_em,
                        'autor_id', p.autor_id, 'resolvida_por', p.resolvida_por, 'resolvida_em', p.resolvida_em)
                      ORDER BY p.prazo NULLS LAST, p.criada_em)
                 FROM public.pendencias p
                WHERE p.internacao_id = i.id
                  AND (p.situacao = 'aberta' OR p.resolvida_em > now() - interval '24 hours')), '[]'::jsonb))
           ORDER BY s.nome, l.identificador NULLS LAST, coalesce(pa.nome_social, pa.nome))
      FROM private.passometro_internacoes(p_unidade) i
      JOIN public.pacientes pa ON pa.id = i.paciente_id
      JOIN public.setores s ON s.id = i.setor_atual_id
      LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
      LEFT JOIN public.episodios ep ON ep.id = i.episodio_id), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.registrar_impressao_passometro(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org uuid;
  v_papel text;
  n int;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_unidade IS NULL OR NOT private.tenho_papel(p_unidade, 'plantonista') THEN
    RAISE EXCEPTION 'Acesso negado: o passômetro é do médico de plantão na unidade.' USING ERRCODE = '42501';
  END IF;
  SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = p_unidade;
  v_papel := nullif(private.papel_na_unidade(p_unidade), '');
  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel,
     tipo_acesso, documento_tipo, ip, user_agent)
  SELECT v_org, p_unidade, i.paciente_id, i.id, private.meu_perfil_id(), v_papel,
         'impressao', 'Passômetro', private.requisicao_ip(), private.requisicao_navegador()
    FROM private.passometro_internacoes(p_unidade) i;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('pacientes', n, 'emitido_em', now());
END $$;

REVOKE ALL ON FUNCTION public.passometro(uuid), public.registrar_impressao_passometro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.passometro(uuid), public.registrar_impressao_passometro(uuid) TO authenticated;
