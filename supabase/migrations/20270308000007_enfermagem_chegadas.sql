-- ════════════════════════════════════════════════════════════════════════════
-- Item 16 do teste da rede: a enfermagem vê a chegada regulada no leito
-- reservado (docs/teste-rede/fila/ITEM-16-chegada-enfermagem.md). Decisão do RT
-- em 08/11/2026: opção B (o leito reservado na lista do setor, com "Paciente
-- chegou") e o aviso de saída; E2 = o enfermeiro não registra "não chegou";
-- E3 = sem leito reservado, a chegada não aparece para a enfermagem.
--
-- A confirmação já existe no banco (20270308000001, R5: o enfermeiro escalado
-- no setor do leito marca a chegada). Faltava a leitura:
--
-- enfermagem_chegadas(p_unidade): as regulações da rede que levam o paciente à
-- unidade, ainda esperando a chegada (autorizada, agendada ou em trânsito),
-- com reserva ativa num leito de setor em que a pessoa está escalada agora.
-- Só a enfermagem lê (sou_enfermagem); pode_confirmar = enfermeiro (R5).
-- Mostra o nome (social, se houver), nascimento e sexo do cadastro da origem,
-- a unidade de origem, a hora da saída e as alergias ativas da origem.
--
-- ROLLBACK: DROP FUNCTION public.enfermagem_chegadas(uuid);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enfermagem_chegadas(p_unidade uuid)
RETURNS TABLE(regulacao_id uuid, numero bigint, status text, leito_id uuid, leito text, setor_id uuid, setor_nome text,
              nome text, data_nascimento date, sexo text, origem text, saida_em timestamptz, reserva_expira_em timestamptz,
              alergias text[], pode_confirmar boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_setores uuid[]; v_enfermeiro boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_enfermagem(p_unidade) THEN RAISE EXCEPTION 'Acesso negado: tela da enfermagem.'; END IF;
  SELECT array_agg(x) INTO v_setores FROM private.setores_na_escala_agora() x
   WHERE EXISTS (SELECT 1 FROM public.setores s WHERE s.id = x AND s.unidade_id = p_unidade);
  IF v_setores IS NULL THEN RETURN; END IF;
  v_enfermeiro := coalesce(private.tenho_papel(p_unidade, 'enfermeiro'), false);

  RETURN QUERY
  SELECT s.id, s.numero, s.status::text, l.id, l.identificador, st.id, st.nome,
         coalesce(pa.nome_social, pa.nome, 'Paciente não identificado'), pa.data_nascimento, pa.sexo,
         uo.nome, s.saida_em, r.expira_em,
         coalesce((SELECT array_agg(a.substancia ORDER BY a.substancia) FROM public.alergias_paciente a
                    WHERE a.paciente_id = s.paciente_id AND a.inativada_em IS NULL), '{}'::text[]),
         v_enfermeiro
    FROM public.regulacao_solicitacoes s
    JOIN public.reservas_leito r ON r.id = s.reserva_id AND r.situacao = 'ativa' AND r.expira_em > now()
    JOIN public.leitos l ON l.id = r.leito_id
    JOIN public.setores st ON st.id = l.setor_id
    JOIN public.unidades uo ON uo.id = s.unidade_origem_id
    LEFT JOIN public.pacientes pa ON pa.id = s.paciente_id
   WHERE s.destino_unidade_id = p_unidade AND s.destino_tipo = 'rede'
     AND s.status IN ('autorizada', 'agendada', 'em_transito') AND s.chegada_em IS NULL
     AND private.regulacao_leva_paciente(s)
     AND l.setor_id = ANY (v_setores)
   ORDER BY st.nome, l.identificador;
END $$;
REVOKE ALL ON FUNCTION public.enfermagem_chegadas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enfermagem_chegadas(uuid) TO authenticated;
COMMENT ON FUNCTION public.enfermagem_chegadas(uuid) IS
  'Chegadas reguladas esperadas nos leitos reservados dos setores da escala de agora (item 16 do teste da rede). Só a enfermagem; pode_confirmar = enfermeiro (R5).';
