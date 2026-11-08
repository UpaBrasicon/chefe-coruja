-- ════════════════════════════════════════════════════════════════════════════
-- Conferência da tela do Dini na homologação (07/11/2026).
--
-- O Dini aparece para a enfermagem escalada no setor da criança internada. O
-- único paciente pediátrico internado da rede F5 é o "RN de Joana A06 Teste",
-- na Clínica Médica do Hospital Fase 5, e nenhum enfermeiro está escalado lá
-- no turno de agora. A escala não aceita sobreposição, então este script MOVE o
-- plantão de agora do enfermeiro.hospital.f5 da Porta do Hospital para a
-- Clínica Médica (o check-in segue o mesmo plantão). Só dados de teste da
-- homologação.
-- Desfazer (devolve à porta):
--   UPDATE public.escala_plantao e SET setor_id = s.id, observacao = NULL
--     FROM public.setores s
--    WHERE e.observacao = 'conferência do Dini (93)' AND s.unidade_id = e.unidade_id
--      AND s.nome = 'Porta do Hospital';
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

UPDATE public.escala_plantao e
   SET setor_id = cm.setor_id, observacao = 'conferência do Dini (93)'
  FROM (SELECT i.setor_atual_id AS setor_id FROM public.internacoes i JOIN public.pacientes p ON p.id = i.paciente_id
         WHERE p.nome = 'RN de Joana A06 Teste' AND i.data_alta IS NULL LIMIT 1) cm,
       public.setores s, auth.users u
 WHERE s.id = e.setor_id AND u.id = e.perfil_id
   AND u.email = 'enfermeiro.hospital.f5@teste.local' AND s.nome = 'Porta do Hospital'
   AND e.ativo AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min);

SELECT s.nome AS setor, e.turno, e.ativo,
       EXISTS (SELECT 1 FROM public.presenca_plantonista p WHERE p.escala_plantao_id = e.id AND p.checkin_em IS NOT NULL) AS checkin
  FROM public.escala_plantao e JOIN public.setores s ON s.id = e.setor_id
 WHERE e.observacao = 'conferência do Dini (93)';
