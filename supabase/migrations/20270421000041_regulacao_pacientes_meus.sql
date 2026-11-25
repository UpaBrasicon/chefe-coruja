-- ════════════════════════════════════════════════════════════════════════════
-- Regulação: "Meus" na lista do médico (pergunta do RT de 24/11/2026: "todo
-- mundo vai ver todos os pacientes, ou cada um vê o paciente que regulou?").
--
-- A lista "Em regulação" de Atendimento abre, para o médico, só nos pacientes
-- dele: os pedidos que ele fez (solicitante = o perfil logado) ou os pacientes
-- dos setores do plantão dele agora; com a escolha "Toda a unidade" ao lado.
-- NIR e gestor abrem em "Toda a unidade". O filtro é feito na tela; aqui a
-- RPC public.regulacao_pacientes só acrescenta dois campos ao JSON:
--   • na linha do paciente, 'no_meu_plantao': o setor atual da internação
--     está entre os setores do meu plantão agora
--     (private.setores_em_plantao_em(now()), com a tolerância do fim);
--   • em cada pedido, 'sou_solicitante': eu abri o pedido.
-- Nada sai do JSON e o acesso não muda (mesmas checagens de antes).
--
-- Número 041 (e não 014): a 20270421000040 cria esta função; numa base nova
-- as migrations rodam em ordem e a 040 apagaria o que viesse antes dela.
-- Na homologação e na produção a 040 já está aplicada e há números maiores,
-- então o push precisa de --include-all.
--
-- Idempotente (CREATE OR REPLACE). Volta: docs/regulacao/ROLLBACK-20270421000041.sql
-- (o corpo anterior, tirado da homologação com pg_get_functiondef).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.regulacao_pacientes(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_exigir_unidade(p_unidade);
  RETURN coalesce((
    WITH inter AS (
      SELECT DISTINCT ON (i.paciente_id) i.*
        FROM public.internacoes i
       WHERE i.unidade_id = p_unidade AND i.data_alta IS NULL
       ORDER BY i.paciente_id, i.data_admissao DESC
    ), regs AS (
      SELECT s.* FROM public.regulacao_solicitacoes s
       WHERE s.unidade_origem_id = p_unidade AND private.regulacao_em_aberto(s.status)
    ), pac AS (
      SELECT paciente_id FROM inter UNION SELECT paciente_id FROM regs
    ), meus_setores AS (
      SELECT x AS setor_id FROM private.setores_em_plantao_em(now()) x
    ), linhas AS (
      SELECT pa.id, coalesce(pa.nome_social, pa.nome) AS nome, pa.data_nascimento,
             i.id AS internacao_id, i.tipo_internacao, i.data_admissao, i.episodio_id,
             se.id AS setor_id, se.nome AS setor_nome, le.identificador AS leito
        FROM pac
        JOIN public.pacientes pa ON pa.id = pac.paciente_id
        LEFT JOIN inter i ON i.paciente_id = pa.id
        LEFT JOIN public.setores se ON se.id = i.setor_atual_id
        LEFT JOIN public.leitos le ON le.id = i.leito_atual_id
    )
    SELECT jsonb_agg(jsonb_build_object(
        'paciente', jsonb_build_object('id', l.id, 'nome', l.nome, 'nascimento', l.data_nascimento),
        'internacao', CASE WHEN l.internacao_id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', l.internacao_id, 'tipo', l.tipo_internacao, 'admissao', l.data_admissao, 'episodio_id', l.episodio_id) END,
        'setor', CASE WHEN l.setor_id IS NULL THEN NULL ELSE jsonb_build_object('id', l.setor_id, 'nome', l.setor_nome) END,
        'leito', l.leito,
        'no_meu_plantao', l.setor_id IS NOT NULL AND EXISTS (SELECT 1 FROM meus_setores m WHERE m.setor_id = l.setor_id),
        'pedidos', coalesce((SELECT jsonb_agg(private.regulacao_resumo(r)
                                              || jsonb_build_object('sou_solicitante', v_eu IS NOT NULL AND r.solicitante_id = v_eu)
                                              ORDER BY r.criada_em DESC)
                               FROM regs r WHERE r.paciente_id = l.id), '[]'::jsonb))
      ORDER BY l.setor_nome NULLS LAST, l.leito NULLS LAST, l.nome)
      FROM linhas l), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_pacientes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_pacientes(uuid) TO authenticated;
