-- ════════════════════════════════════════════════════════════════════════════
-- O médico da porta vê as observações que ele abriu, só para encerrá-las
-- (decisão do RT em 06/11/2026: "Sim, mostrar"; continua a 20270305000001,
-- achado P1-2 do teste de rede A01).
--
-- A 20270305000001 deixou o autor do desfecho "observação" encerrar a
-- observação (finalizar_observacao) sem escala no setor, mas a tela não
-- mostrava o paciente: painel_observacao só lista os setores da escala.
--
-- public.observacoes_que_abri(p_unidade): as internações da unidade em que
-- private.abriu_a_observacao(i) é verdadeira para o login (autor do desfecho
-- 'observacao' da porta, plantonista na unidade, de plantão agora na unidade,
-- paciente em observação). Mesma regra que libera o encerramento; quem não a
-- cumpre recebe a lista vazia.
-- Campos: só o que o cartão e o diálogo de encerramento usam: internação,
-- paciente (id, nome, nome social, nascimento para a idade), setor, box,
-- entrada e prazo de 6 horas. Nada de prescrição, evolução, sinais, alergia,
-- queixa ou protocolo.
-- Leituras do diálogo: setores_internacao e leitos_para_ocupar já liberam por
-- membro_da_unidade (não pedem escala); o CID e o destino são digitados. Não
-- precisou ampliar mais nada.
--
-- Só expande: uma função nova, com segundo fator, sem EXECUTE para anon.
-- Reaplicável. Teste: supabase/tests/fix_observacoes_que_abri.sql.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.observacoes_que_abri(uuid);
--   (a tela trata a falta da função como lista vazia: a seção some)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.observacoes_que_abri(p_unidade uuid)
RETURNS TABLE(internacao_id uuid, paciente_id uuid, nome text, nome_social text, data_nascimento date,
              setor_nome text, box text, entrada timestamptz, prazo timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  PERFORM private.exigir_segundo_fator();
  RETURN QUERY
  SELECT i.id, i.paciente_id, pa.nome, pa.nome_social, pa.data_nascimento,
         s.nome, l.identificador,
         coalesce(po.criada_em, i.data_entrada_setor, i.data_admissao),
         coalesce(po.prazo, coalesce(po.criada_em, i.data_entrada_setor, i.data_admissao) + interval '6 hours')
    FROM public.internacoes i
    JOIN public.pacientes pa ON pa.id = i.paciente_id
    JOIN public.setores s ON s.id = i.setor_atual_id
    LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
    -- o prazo é o da pendência da observação, como em painel_observacao
    LEFT JOIN LATERAL (
      SELECT x.criada_em, x.prazo FROM public.pendencias x
       WHERE x.internacao_id = i.id AND x.tipo = 'observacao'
       ORDER BY (x.situacao = 'aberta') DESC, x.criada_em DESC LIMIT 1) po ON true
   WHERE i.unidade_id = p_unidade
     AND i.status = 'em_observacao'
     AND private.abriu_a_observacao(i)
   ORDER BY coalesce(po.prazo, i.data_admissao + interval '6 hours');
END $$;
REVOKE ALL ON FUNCTION public.observacoes_que_abri(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.observacoes_que_abri(uuid) TO authenticated;
