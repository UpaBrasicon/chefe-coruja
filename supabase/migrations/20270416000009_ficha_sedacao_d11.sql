-- Gerado por scripts/fichas-sql.mjs a partir de src/clinico. Não editar à mão.
-- Lote D11, achado depois da mesclagem (19/11/2026): a tela da sedação pediátrica mostra a nota da SBA 2024
-- na linha do propofol (vinda de bolus.ts); a ficha ped-sedacao-procedimento sobe e cita a SBA 2024. Dose sem mudança.
SELECT private.registrar_versao_ferramenta('ped-sedacao-procedimento', 'Sedação para procedimento — criança', '2026-11-19.1', 'pediatrico', '[{"citacao":"Schvartsman C, et al. (coords.). Pronto-Socorro — Pediatria ICr-HCFMUSP. 4ª ed. Santana de Parnaíba: Manole; 2023. ISBN 978-65-5576-759-9. cap. 78, p. 844–851; Apêndice, p. 894–897.","pediatrica":true},{"citacao":"Lima LC, et al. Recommendations from the Brazilian Society of Anesthesiology (SBA) for difficult airway management in pediatric care. Braz J Anesthesiol. 2024;74(1):744478 (PMID 38147975, PMC10877349). Tabela 7.","url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10877349/","pediatrica":true}]'::jsonb);
-- Volta (testada na homologação em transação desfeita):
--   DELETE FROM public.ferramenta_versoes WHERE versao = '2026-11-19.1' AND ferramenta_id = 'ped-sedacao-procedimento';
