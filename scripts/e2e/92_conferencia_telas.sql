-- ════════════════════════════════════════════════════════════════════════════
-- Conferência das telas novas na homologação (07/11/2026): CID sugerido,
-- Histórico encerrado, Prontuário completo e "Observações que você abriu".
--
-- Deixa um paciente com histórico encerrado ("Rosa Teste Arquivo", 3
-- episódios encerrados na UPA F5) aguardando o médico na porta do PS da UPA
-- F5: recepção abre a ficha, a enfermeira chama e classifica. O resto
-- (assumir, SOAP com o CID sugerido, desfecho observação) é feito NA TELA,
-- logado como medico.upa.f5.
--
-- Cada passo roda como a conta do papel (e2e.bpasso, do 60_cenario_b01.sql).
-- A cor é a escolha da enfermeira de teste; sinais crus; nada de dose.
-- Rodar antes: 41_checkin_fase5.sql. As funções e2e.b_* já existem na
-- homologação (criadas pelo 60).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/92_conferencia_telas.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'tel\_%';

SELECT e2e.bpasso(NULL, 'TEL.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Rosa (paciente já cadastrada) no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Tosse e febre há três dias (teste de tela)', %L::uuid, NULL) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', '8e06379f-5191-448c-9f03-b0b188bd4bef'), 'ok', 'tel_ep');

SELECT e2e.bpasso('tel_ep', 'TEL.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('tel_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));

SELECT e2e.bpasso('tel_ep', 'TEL.03.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica amarelo (escolha da enfermeira de teste), sinais crus, fluxograma "Mal-estar geral"',
  e2e.b_classificar_sql(e2e.u('tel_ep'), 'f5100000-0000-4000-8000-000000000002', 'amarelo',
    '{"frequencia-cardiaca":104,"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":78,"frequencia-respiratoria":22,"saturacao-o2":95,"temperatura":38.4,"escala-dor":2}',
    'Mal-estar geral', 'Febre e tosse (texto da enfermeira de teste)'), 'ok', 'tel_class');

SELECT passo, situacao, left(coalesce(detalhe, ''), 160) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'TEL.%' ORDER BY id DESC LIMIT 3;
