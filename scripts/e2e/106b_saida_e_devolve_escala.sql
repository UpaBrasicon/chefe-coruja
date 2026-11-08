-- ════════════════════════════════════════════════════════════════════════════
-- Segunda parte da conferência do item 16 (106): com a Internação da
-- enfermagem aberta na conta enfermeiro.hospital.f5, a origem marca a saída
-- do paciente, para a tela mostrar o aviso de saída e "saiu às HH:MM".
-- Depois da conferência, a última parte devolve o plantão da enfermeira à
-- Porta do Hospital (rodar só ela, no fim).
-- ════════════════════════════════════════════════════════════════════════════

-- parte 1: a saída
SELECT e2e.bpasso('ce8_reg', 'CE8.09.saida', 'f5_med_upa', '/regulacao (origem)', 'A origem marca a saída do paciente',
  format('SELECT left(public.regulacao_marcar_saida(%L::uuid)::text, 40)', e2e.u('ce8_reg')));
SELECT passo, situacao, left(coalesce(detalhe, ''), 120) AS detalhe
  FROM e2e.resultados WHERE passo = 'CE8.09.saida' ORDER BY id DESC LIMIT 1;

-- parte 2 (no fim): devolve o plantão da enfermeira à Porta do Hospital
-- UPDATE public.escala_plantao SET setor_id = e2e.v('ce8_setor_antes')::uuid WHERE id = e2e.v('ce8_escala')::uuid;
