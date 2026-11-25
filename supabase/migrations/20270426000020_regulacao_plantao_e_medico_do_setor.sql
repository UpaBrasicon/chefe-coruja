-- Decisões do RT de 25/11/2026 sobre o teste de fluxo B (achados B-05 e B-07).
--
-- B-05: o médico de plantão no setor do paciente responde por todas as
--   regulações do setor: atualiza a evolução, responde à central, reenvia o
--   devolvido, muda o isolamento do pedido e cancela, mesmo quando o pedido foi
--   aberto por outro médico. O autor é sempre quem fez.
-- B-07: médico e NIR da origem só agem no pedido de regulação de plantão: o
--   médico com o paciente num setor do seu plantão agora; o NIR com escala ativa
--   na unidade (sem check-out). Fora disso o servidor recusa com mensagem clara.
--   O gestor da unidade e o médico regulador da central não dependem do plantão.
--   Paciente que já saiu da origem (alta dada): vale a escala ativa na unidade.
--
-- Só funções (expand): nenhuma tabela muda. Idempotente: cada troca confere se
-- já foi feita. Rollback no fim.

CREATE OR REPLACE FUNCTION private.regulacao_exigir_plantao(p_unidade uuid, p_paciente uuid, p_central uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_med boolean; v_nir boolean; v_escala boolean; v_aberto boolean;
BEGIN
  IF p_central IS NOT NULL AND coalesce(private.tenho_papel(p_central, 'regulador'), false) THEN RETURN; END IF;
  IF coalesce(private.tenho_papel(p_unidade, 'gestor'), false) THEN RETURN; END IF;
  v_med := coalesce(private.tenho_papel(p_unidade, 'plantonista'), false);
  v_nir := coalesce(private.sou_nir(p_unidade), false);
  -- quem não é médico nem NIR da origem é recusado pelo papel, na própria função
  IF NOT (v_med OR v_nir) THEN RETURN; END IF;
  v_escala := coalesce(private.na_escala_agora(p_unidade), false);
  IF v_nir AND v_escala THEN RETURN; END IF;
  IF v_med THEN
    v_aberto := p_paciente IS NOT NULL AND (
         EXISTS (SELECT 1 FROM public.episodios e WHERE e.paciente_id = p_paciente AND e.unidade_id = p_unidade AND e.encerrado_em IS NULL)
      OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente AND i.unidade_id = p_unidade AND i.data_alta IS NULL));
    IF v_aberto AND coalesce(private.paciente_em_cuidado_no_plantao(p_paciente), false) THEN RETURN; END IF;
    IF NOT v_aberto AND v_escala THEN RETURN; END IF;
  END IF;
  RAISE EXCEPTION '%', CASE
      WHEN v_escala THEN 'Fora do plantão neste setor: o paciente não está num setor do seu plantão agora.'
      ELSE 'Fora do plantão: você não está de plantão agora nesta unidade (sem escala ativa ou com o check-out feito).' END
    USING ERRCODE = 'insufficient_privilege', HINT = 'fora_do_plantao';
END $$;
REVOKE ALL ON FUNCTION private.regulacao_exigir_plantao(uuid, uuid, uuid) FROM PUBLIC, anon;

-- a tela pergunta antes de oferecer o botão: nulo = pode agir; senão, o motivo
CREATE OR REPLACE FUNCTION public.regulacao_por_que_nao_ajo(p_unidade uuid, p_paciente uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM private.regulacao_exigir_plantao(p_unidade, p_paciente, NULL);
  RETURN NULL;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_por_que_nao_ajo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_por_que_nao_ajo(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_novo IN def) > 0 THEN RETURN; END IF;  -- já trocado (idempotente)
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

-- ── B-05: o médico de plantão no setor do paciente entra em "a origem pode" ──
SELECT pg_temp.trocar('private.regulacao_origem_pode(public.regulacao_solicitacoes)'::regprocedure,
  E'OR private.tenho_papel(s.unidade_origem_id, ''gestor'')',
  E'OR private.tenho_papel(s.unidade_origem_id, ''gestor'')\n'
  || E'      -- B-05 (RT, 25/11/2026): o médico de plantão no setor do paciente\n'
  || E'      OR (s.paciente_id IS NOT NULL AND private.tenho_papel(s.unidade_origem_id, ''plantonista'')\n'
  || E'          AND private.paciente_em_cuidado_no_plantao(s.paciente_id))');
SELECT pg_temp.trocar('private.regulacao_papel_evolucao(public.regulacao_solicitacoes)'::regprocedure,
  E'WHEN private.tenho_papel(s.unidade_origem_id, ''gestor'') THEN ''gestor''',
  E'WHEN private.tenho_papel(s.unidade_origem_id, ''plantonista'') THEN ''medico''   -- B-05: médico de plantão que não pediu\n'
  || E'    WHEN private.tenho_papel(s.unidade_origem_id, ''gestor'') THEN ''gestor''');
SELECT pg_temp.trocar('public.regulacao_cancelar(uuid, text)'::regprocedure,
  E'OR private.tenho_papel(s.unidade_origem_id, ''gestor'')) THEN',
  E'OR private.tenho_papel(s.unidade_origem_id, ''gestor'')\n'
  || E'          OR (s.paciente_id IS NOT NULL AND private.tenho_papel(s.unidade_origem_id, ''plantonista'')\n'
  || E'              AND private.paciente_em_cuidado_no_plantao(s.paciente_id))) THEN   -- B-05');
SELECT pg_temp.trocar('public.regulacao_cancelar(uuid, text)'::regprocedure,
  'Cancela quem solicitou ou o gestor da unidade de origem.',
  'Cancela quem solicitou, o médico de plantão no setor do paciente ou o gestor da unidade de origem.');
SELECT pg_temp.trocar('public.regulacao_atualizar_evolucao(uuid, text, text)'::regprocedure,
  'Atualizam a evolução o solicitante, o médico assistente, o gestor e o NIR da origem.',
  'Atualizam a evolução o solicitante, o médico assistente, o médico de plantão no setor do paciente, o gestor e o NIR da origem.');
SELECT pg_temp.trocar('public.regulacao_responder_pendencia(uuid, text)'::regprocedure,
  'Responde o solicitante, o médico assistente, o gestor ou o NIR da origem.',
  'Responde o solicitante, o médico assistente, o médico de plantão no setor do paciente, o gestor ou o NIR da origem.');
SELECT pg_temp.trocar('public.regulacao_reenviar(uuid, jsonb)'::regprocedure,
  'Reenvia o solicitante, o médico assistente ou o gestor da origem.',
  'Reenvia o solicitante, o médico assistente, o médico de plantão no setor do paciente ou o gestor da origem.');

-- ── B-07: fora do plantão, o médico e o NIR da origem não agem no pedido ─────
SELECT pg_temp.trocar(f::regprocedure,
  E'IF NOT FOUND THEN RAISE EXCEPTION ''Solicitação não encontrada.''; END IF;',
  E'IF NOT FOUND THEN RAISE EXCEPTION ''Solicitação não encontrada.''; END IF;\n'
  || E'  PERFORM private.regulacao_exigir_plantao(s.unidade_origem_id, s.paciente_id, s.central_id);   -- B-07')
  FROM unnest(ARRAY['public.regulacao_atualizar_evolucao(uuid, text, text)', 'public.regulacao_responder_pendencia(uuid, text)',
                    'public.regulacao_cancelar(uuid, text)', 'public.regulacao_reenviar(uuid, jsonb)',
                    'public.regulacao_definir_isolamento(uuid, text, text, text)', 'public.regulacao_marcar_saida(uuid)']) f;
SELECT pg_temp.trocar(f::regprocedure,
  E'IF NOT FOUND OR NOT private.regulacao_pode_ver(s) THEN RAISE EXCEPTION ''Solicitação não encontrada.''; END IF;',
  E'IF NOT FOUND OR NOT private.regulacao_pode_ver(s) THEN RAISE EXCEPTION ''Solicitação não encontrada.''; END IF;\n'
  || E'  PERFORM private.regulacao_exigir_plantao(s.unidade_origem_id, s.paciente_id, s.central_id);   -- B-07')
  FROM unnest(ARRAY['public.regulacao_conversa_enviar(uuid, text, text)',
                    'public.regulacao_pendencia_unidade_criar(uuid, text, text, text, uuid[], text)']) f;
SELECT pg_temp.trocar(f::regprocedure,
  E'IF NOT FOUND THEN RAISE EXCEPTION ''Pendência não encontrada.''; END IF;',
  E'IF NOT FOUND THEN RAISE EXCEPTION ''Pendência não encontrada.''; END IF;\n'
  || E'  PERFORM private.regulacao_exigir_plantao(p.unidade_id, p.paciente_id, NULL);   -- B-07')
  FROM unnest(ARRAY['public.regulacao_pendencia_unidade_reavisar(uuid)', 'public.regulacao_pendencia_unidade_resolver(uuid, text)']) f;
SELECT pg_temp.trocar('public.regulacao_solicitar(uuid, uuid, jsonb)'::regprocedure,
  E'  v_central := private.regulacao_central_da_unidade(p_unidade);',
  E'  PERFORM private.regulacao_exigir_plantao(p_unidade, p_paciente, NULL);   -- B-07\n'
  || E'  v_central := private.regulacao_central_da_unidade(p_unidade);');

-- ── Rollback ────────────────────────────────────────────────────────────────
-- As trocas inversas, na ordem contrária: tirar a linha "PERFORM
-- private.regulacao_exigir_plantao(...)" das 11 funções; devolver os textos de
-- recusa; tirar o "médico de plantão no setor" de regulacao_cancelar,
-- regulacao_papel_evolucao e regulacao_origem_pode. Depois:
--   DROP FUNCTION IF EXISTS public.regulacao_por_que_nao_ajo(uuid, uuid);
--   DROP FUNCTION IF EXISTS private.regulacao_exigir_plantao(uuid, uuid, uuid);
