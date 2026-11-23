-- Gerado por scripts/fichas-sql.mjs a partir de src/clinico. Não editar à mão.
-- Regra 1b do gate: agitacao.ts mudou no lote A2 da dose em mL; adulto-bars 2026-11-23.1, sem mudança de conteúdo.
SELECT private.registrar_versao_ferramenta('adulto-bars', 'BARS — escala de atividade comportamental (adulto)', '2026-11-23.1', 'adulto', '[{"citacao":"Brandão Neto RA, et al. (eds.). Manual de Medicina de Emergência — Disciplina de Emergências Clínicas, Hospital das Clínicas da FMUSP. 3ª ed. rev. e atual. Santana de Parnaíba: Manole; 2022. ISBN 9786555767827. cap. 76 O paciente agitado, p. 1005–1006 (Tabela 1)."}]'::jsonb);
-- Volta (testada na homologação em 23/11/2026 em transação desfeita):
--   DELETE FROM public.ferramenta_versoes WHERE ferramenta_id = 'adulto-bars' AND versao = '2026-11-23.1';
