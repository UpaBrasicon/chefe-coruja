-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B, fase 2: o médico chama no pronto-socorro, atende, prescreve,
-- pede exames e decide internar (leito direto ou observação).
-- Dose: SEMPRE o texto de teste, nunca dose de memória.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE TEMP TABLE _r (o serial, txt text) ON COMMIT DROP;

INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.enfermeiro_nao_inicia', 'enf', 'Enfermeiro tenta abrir o atendimento médico: deve recusar',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.fbu(c.n, 'ep')), 'erro', NULL, false, 'class')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.chamar', 'med', 'Médico chama para o Consultório 1',
  format('SELECT left(public.chamar_paciente(%L::uuid, %L::uuid)::text, 200)', e2e.fbu(c.n, 'ep'), '8607b21e-54fe-48d5-9552-abc5881522a4'), 'ok', NULL, false, 'class')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.prescrever_antes_de_abrir', 'med', 'Prescrever antes de abrir o atendimento: deve recusar',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.fbu(c.n, 'pac'),
    jsonb_build_object('tipo', 'cuidado', 'descricao', 'Monitorização contínua (teste de fluxo)')), 'erro', NULL, false, 'class')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.iniciar', 'med', 'Médico abre o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.fbu(c.n, 'ep')), 'ok', NULL, false, 'class')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.desfecho_sem_soap', 'med', 'Desfecho sem registro do atendimento: deve recusar',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.fbu(c.n, 'ep')), 'erro:Registre o atendimento', NULL, false, 'class')
  FROM e2e.fb_coorte c WHERE c.n = 5;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.soap', 'med', 'SOAP com CID ' || c.cid,
  format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', e2e.fbu(c.n, 'ep'),
    c.queixa || ' (teste de fluxo)', 'Sinais vitais da triagem conferidos; exame dirigido (teste de fluxo)', c.hipotese,
    'Exames, medicação conforme a ficha da Central e internação (teste de fluxo)', c.cid), 'ok', 'soap', false, 'class')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.medicamento_sem_peso', 'med', 'Medicamento sem peso do atendimento: deve recusar',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.fbu(c.n, 'pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', (SELECT m.id FROM public.medicamento m WHERE m.ativo AND m.principio_ativo ILIKE 'dipirona%' ORDER BY m.principio_ativo, m.id LIMIT 1),
      'dose', 'conforme protocolo — dado fictício de teste de fluxo', 'via', 'endovenosa', 'posologia', 'Agora')), 'erro:Falta para prescrever', NULL, false, 'soap')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.peso', 'med', 'Peso do atendimento (' || CASE WHEN c.publico = 'pediatrico' THEN 'aferido 23 kg' ELSE 'referido' END || ')',
  e2e.fb_sinais_sql(e2e.fbu(c.n, 'pac'), jsonb_build_object('peso', CASE WHEN c.publico = 'pediatrico' THEN 23 ELSE 60 + c.n * 2 END), NULL,
    CASE WHEN c.publico = 'pediatrico' THEN 'aferido' ELSE 'referido' END), 'ok', NULL, false, 'soap')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.prescrever', 'med', 'Prescreve dipirona "Agora" (dose: texto de teste) e um cuidado',
  format('SELECT public.prescrever(%1$L::uuid, %2$L::jsonb)::text || %3$L || public.prescrever(%1$L::uuid, %4$L::jsonb)::text', e2e.fbu(c.n, 'pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', (SELECT m.id FROM public.medicamento m WHERE m.ativo AND m.principio_ativo ILIKE 'dipirona%' ORDER BY m.principio_ativo, m.id LIMIT 1),
      'dose', 'conforme protocolo — dado fictício de teste de fluxo', 'via', 'endovenosa', 'posologia', 'Agora', 'observacao', 'Teste de fluxo B'),
    ' + ', jsonb_build_object('tipo', 'cuidado', 'descricao', 'Monitorização e reavaliação em 1 hora (teste de fluxo)')), 'ok', 'presc', false, 'soap')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.enfermeiro_nao_prescreve', 'enf', 'Enfermeiro tenta prescrever: deve recusar',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.fbu(c.n, 'pac'),
    jsonb_build_object('tipo', 'cuidado', 'descricao', 'Cuidado prescrito pela enfermagem (teste)')), 'erro:A prescrição é do médico', NULL, false, 'soap')
  FROM e2e.fb_coorte c WHERE c.n = 2;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.exames_porta', 'med', 'Pede exames de laboratório na porta (hemograma, PCR' || CASE WHEN c.n = 1 THEN ' e troponina' ELSE '' END || ')',
  format($q$SELECT public.pedir_exames(%L::uuid, %L::jsonb, 'urgente', 'Teste de fluxo B')::text$q$, e2e.fbu(c.n, 'ep'),
    '[{"procedimento":"0202020380"},{"procedimento":"0202030202"}]'::jsonb
    || CASE WHEN c.n = 1 THEN '[{"procedimento":"0202031209"}]'::jsonb ELSE '[]'::jsonb END),
  'ok', 'exames_porta', false, 'soap')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.exames_porta_misturados', 'med', 'Laboratório e imagem no mesmo pedido: deve recusar (vão em pedidos separados)',
  format($q$SELECT public.pedir_exames(%L::uuid, '[{"procedimento":"0202010473"},{"procedimento":"0204030153"}]'::jsonb, 'urgente', NULL)::text$q$, e2e.fbu(c.n, 'ep')),
  'erro:vão em pedidos separados', NULL, false, 'soap')
  FROM e2e.fb_coorte c WHERE c.n = 2;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.exames_porta_imagem', 'med', CASE WHEN c.n = 1 THEN 'Pede ECG na porta' ELSE 'Pede RX de tórax na porta' END,
  format($q$SELECT public.pedir_exames(%L::uuid, %L::jsonb, 'urgente', 'Teste de fluxo B')::text$q$, e2e.fbu(c.n, 'ep'),
    CASE WHEN c.n = 1 THEN '[{"procedimento":"0211020036"}]'::jsonb ELSE '[{"procedimento":"0204030153"}]'::jsonb END),
  'ok', NULL, false, 'soap')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 9) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.3.exame_fora_da_lista', 'med', 'Exame fora da lista da unidade (TSH): deve recusar',
  format($q$SELECT public.pedir_exames(%L::uuid, '[{"procedimento":"0202060250"}]'::jsonb, 'rotina', NULL)::text$q$, e2e.fbu(c.n, 'ep')), 'erro', NULL, false, 'soap')
  FROM e2e.fb_coorte c WHERE c.n = 1;

-- desfecho: leito direto ou observação
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.4.enfermeiro_nao_decide', 'enf', 'Enfermeiro tenta registrar o desfecho: deve recusar',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.fbu(c.n, 'ep')), 'erro', NULL, false, 'soap')
  FROM e2e.fb_coorte c WHERE c.n = 6;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.4.leito_ocupado', 'med', 'Internar num leito ocupado (CM-1): deve recusar',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', NULL, %L::jsonb)::text$q$, e2e.fbu(c.n, 'ep'),
    jsonb_build_object('setor_id', '32000000-0000-4000-8000-000000000003', 'leito_id', '4c57d4ca-e48f-40c9-a728-65fdb86a9feb')), 'erro:O leito escolhido não está livre', NULL, false, 'soap')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.4.desfecho', 'med', CASE c.via WHEN 'internacao' THEN 'Decide internar no leito ' || c.leito ELSE 'Decide observação (box livre)' END,
  CASE c.via WHEN 'internacao' THEN
    format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', NULL, %L::jsonb)::text || 'internação pedida'$q$, e2e.fbu(c.n, 'ep'),
      jsonb_build_object('setor_id', c.setor, 'leito_id', (SELECT l.id FROM public.leitos l WHERE l.setor_id = c.setor AND l.identificador = c.leito)))
  ELSE format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text || 'observação pedida'$q$, e2e.fbu(c.n, 'ep')) END,
  'ok', 'desfecho', false, 'soap')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.4.internacao', 'banco', 'Internação aberta no lugar certo (leito ocupado pelo paciente)',
  format($q$SELECT i.id::text FROM public.internacoes i LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
    WHERE i.paciente_id = %L AND i.data_alta IS NULL AND i.status = %L AND (%L::text IS NULL OR (l.identificador = %L AND l.status = 'ocupado'))$q$,
    e2e.fbu(c.n, 'pac'), CASE c.via WHEN 'internacao' THEN 'internado' ELSE 'em_observacao' END,
    CASE c.via WHEN 'internacao' THEN c.leito END, c.leito), 'ok', 'int', false, 'desfecho')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.4.onde_ficou', 'banco', 'Onde ficou: setor e leito',
  format($q$SELECT s.nome || ' / ' || coalesce(l.identificador, 'sem leito') || ' / ' || i.status || ' / etapa ' || (SELECT e.etapa FROM public.episodios e WHERE e.id = i.episodio_id)
    FROM public.internacoes i JOIN public.setores s ON s.id = i.setor_atual_id LEFT JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = %L$q$, e2e.fbu(c.n, 'int')),
  'registrar', NULL, false, 'int')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.4.desfecho_repetido', 'med', 'Ação repetida: desfecho de novo no mesmo atendimento: deve recusar',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.fbu(c.n, 'ep')), 'erro:O episódio não está em atendimento', NULL, false, 'desfecho')
  FROM e2e.fb_coorte c WHERE c.n = 2;

SELECT txt FROM _r ORDER BY o;
--FIM
COMMIT;
