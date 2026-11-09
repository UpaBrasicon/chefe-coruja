-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência na homologação da migration 20270308000008 (decisão do RT em
-- 08/11/2026: quem abriu a observação registra alergia enquanto ela está
-- aberta). Usa o paciente "Chegada Enfermagem Teste" do 106, em observação na
-- UPA F5, aberta por medico.upa.f5. Antes da migration, o mesmo passo voltou
-- "Acesso negado" (CE8.05.alergia, 08/11).
--   • o médico da porta que abriu lê e registra a alergia;
--   • a enfermeira da porta continua sem registrar (não abriu nem está
--     escalada na observação).
-- ════════════════════════════════════════════════════════════════════════════

SELECT e2e.b_guardar('al8_inicio', now()::text);
SELECT e2e.bpasso('ce8_pac', 'AL8.01.ler', 'f5_med_upa', '/observacao (Observações que você abriu → Alergias)', 'Quem abriu lê as alergias',
  format($q$SELECT (public.alergias_do_paciente(%L::uuid) ->> 'estado')$q$, e2e.u('ce8_pac')));
SELECT e2e.bpasso('ce8_pac', 'AL8.02.registrar', 'f5_med_upa', '/observacao (Observações que você abriu → Alergias)', 'Quem abriu registra Dipirona',
  format('SELECT public.registrar_alergia(%L::uuid, %L, %L, %L, %L)::text', e2e.u('ce8_pac'), 'Dipirona', 'Urticária', 'medicamento', 'grave'));
SELECT e2e.bpasso('ce8_pac', 'AL8.03.enf_porta', 'f5_enf_upa', '/triagem', 'A enfermeira da porta continua sem registrar',
  format('SELECT public.registrar_alergia(%L::uuid, %L)::text', e2e.u('ce8_pac'), 'Látex'), 'erro');

SELECT passo, situacao, left(coalesce(detalhe, ''), 120) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'AL8.%' AND em >= e2e.v('al8_inicio')::timestamptz ORDER BY id;
