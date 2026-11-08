-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do trecho do magnésio do A01 (passos 13 a 15) depois da
-- 20270307000002_ataque_manutencao.sql (achado P2-1 do A01, 07/11/2026).
--
-- Na rodada 2 do A01, a manutenção foi recusada com o ataque já prescrito, e o
-- contorno foi checar o ataque e depois alterar o item. Aqui, sem contorno:
-- ataque ("Agora") e manutenção ("Contínuo") como dois itens; liberação da
-- farmácia de cada um; dispensação; checagem de cada um; o segundo "Agora"
-- sem a dose feita é recusado.
--
-- Paciente: "Rosa Teste Arquivo" (já cadastrada na UPA F5, do 92), numa ficha
-- nova no PS. Cada passo roda como a conta do papel (e2e.bpasso, do 60).
-- Dose: só texto de teste, nunca dose de memória. A cor é da enfermeira de
-- teste; sinais crus. No fim, alta da porta com os itens checados.
-- Rodar antes: 41_checkin_fase5.sql.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'atq\_%';
SELECT e2e.b_guardar('atq_inicio', now()::text);
SELECT e2e.b_guardar('atq_pac', '8e06379f-5191-448c-9f03-b0b188bd4bef');

SELECT e2e.bpasso(NULL, 'ATQ.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Rosa no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Cefaleia e pressão alta (teste do ataque e manutenção)', %L::uuid, NULL) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', '8e06379f-5191-448c-9f03-b0b188bd4bef'), 'ok', 'atq_ep');
SELECT e2e.bpasso('atq_ep', 'ATQ.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('atq_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('atq_ep', 'ATQ.03.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica laranja (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('atq_ep'), 'f5100000-0000-4000-8000-000000000002', 'laranja',
    '{"frequencia-cardiaca":96,"pressao-arterial-sistolica":178,"pressao-arterial-diastolica":112,"frequencia-respiratoria":18,"saturacao-o2":97,"temperatura":36.6,"escala-dor":6}',
    'Mal-estar geral', 'Cefaleia intensa e PA elevada (texto da enfermeira de teste)'), 'ok', 'atq_class');
SELECT e2e.bpasso('atq_ep', 'ATQ.04.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('atq_ep')));
SELECT e2e.bpasso('atq_ep', 'ATQ.04.peso', 'f5_med_upa', '/atendimento (Prescrição)', 'Peso referido deste atendimento',
  e2e.b_sinais(e2e.u('atq_pac'), '{"peso":68}', NULL, 'referido'));

-- ── 13. ataque e manutenção como dois itens ─────────────────────────────────
SELECT e2e.bpasso('atq_ep', 'ATQ.13.magnesio_ataque', 'f5_med_upa', '/atendimento (Prescrição)',
  'Sulfato de magnésio, ataque, "Agora"; dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('atq_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '0b13f981-90da-4237-93d7-d118d2055cfa', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora')), 'ok', 'atq_mg');
SELECT e2e.bpasso('atq_mg', 'ATQ.13.magnesio_manutencao', 'f5_med_upa', '/atendimento (Prescrição)',
  'Sulfato de magnésio, manutenção, "Contínuo", junto com o ataque (antes: recusado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('atq_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '0b13f981-90da-4237-93d7-d118d2055cfa', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Contínuo')), 'ok', 'atq_mg_manut');
SELECT e2e.bpasso('atq_mg', 'ATQ.13.segundo_agora', 'f5_med_upa', '/atendimento (Prescrição)',
  'Segundo "Agora" do magnésio antes da dose feita (deve ser recusado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('atq_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '0b13f981-90da-4237-93d7-d118d2055cfa', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora')), 'erro:Já há um "Agora" deste medicamento');
SELECT e2e.bpasso('atq_mg_manut', 'ATQ.13.itens_ativos', 'banco', NULL, 'Dois itens ativos do magnésio, nenhum suspenso por alteração',
  format($q$SELECT e2e.b_confere(count(*) = 2 AND count(*) FILTER (WHERE i.suspenso_em IS NOT NULL) = 0,
      string_agg(i.posologia, ' + ' ORDER BY i.created_at))
    FROM public.prescricao_itens i JOIN public.prescricoes p ON p.id = i.prescricao_id
   WHERE p.episodio_id = %L AND i.medicamento_id = '0b13f981-90da-4237-93d7-d118d2055cfa'$q$, e2e.u('atq_ep')));

-- ── 14. farmácia: cada item com a sua liberação ─────────────────────────────
SELECT e2e.bpasso(x.dep, 'ATQ.14.validar_' || x.k, 'f5_farm', '/alta-vigilancia', 'Farmacêutico valida e libera o ' || x.k,
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u(x.dep)))
  FROM (VALUES (1, 'atq_mg', 'ataque'), (2, 'atq_mg_manut', 'manutencao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.bpasso(x.dep, 'ATQ.14.dispensar_' || x.k, 'f5_farm', '/dispensacao', 'Dispensa o ' || x.k || ' (1 unidade de consumo)',
  format('SELECT public.dispensar_item(%L::uuid, 1, NULL)::text', e2e.u(x.dep)))
  FROM (VALUES (1, 'atq_mg', 'ataque'), (2, 'atq_mg_manut', 'manutencao')) x(o, dep, k) ORDER BY x.o;

-- ── 15. checagem de cada item ───────────────────────────────────────────────
SELECT e2e.bpasso('atq_mg', 'ATQ.15.checar_ataque', 'f5_enf_upa', '/checagem', 'Checa "feito" o ataque',
  format('SELECT public.checar(%L::uuid, %L, NULL, NULL)::text', e2e.u('atq_mg'), 'feito'));
SELECT e2e.bpasso('atq_mg_manut', 'ATQ.15.checar_manutencao', 'f5_enf_upa', '/checagem', 'Checa "feito" a 1ª dose da manutenção',
  format('SELECT public.checar(%L::uuid, %L, NULL, NULL)::text', e2e.u('atq_mg_manut'), 'feito'));
SELECT e2e.bpasso('atq_mg_manut', 'ATQ.15.administracoes', 'banco', NULL, 'Uma administração por item',
  format($q$SELECT e2e.b_confere(count(DISTINCT a.item_id) = 2 AND count(*) = 2, count(*) || ' administrações em ' || count(DISTINCT a.item_id) || ' itens')
    FROM public.administracoes a WHERE a.item_id IN (%L, %L) AND a.situacao = 'feito'$q$, e2e.u('atq_mg'), e2e.u('atq_mg_manut')));

-- ── fim: alta da porta ──────────────────────────────────────────────────────
SELECT e2e.bpasso('atq_ep', 'ATQ.99.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Cefaleia e PA elevada (teste do ataque e manutenção)', 'PA 178x112', 'Crise hipertensiva', 'Conduta de teste de fluxo', 'I10')::text$q$, e2e.u('atq_ep')));
SELECT e2e.bpasso('atq_ep', 'ATQ.99.alta', 'f5_med_upa', '/atendimento (Desfecho)', 'Alta da porta (encerra o cenário)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', 'Alta ao fim do teste do ataque e manutenção', '{}'::jsonb)::text$q$, e2e.u('atq_ep')));

SELECT passo, situacao, left(coalesce(detalhe, ''), 160) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'ATQ.%' AND em >= e2e.v('atq_inicio')::timestamptz ORDER BY id;
