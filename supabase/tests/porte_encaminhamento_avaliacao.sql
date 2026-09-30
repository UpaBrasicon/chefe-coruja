-- Testes da migration 20261004000003 (encaminhamento interno, avaliação por
-- escala e aferição da curva de crescimento). ROLLBACK no fim. Estilo de
-- porte_alergias.sql.
BEGIN;
-- plantão: plantonista (0002), enfermeira (0004), recepção (0005) e um
-- segundo médico (0006, que ganha vínculo de plantonista só aqui)
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'plantonista')
ON CONFLICT DO NOTHING;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
                  '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

-- ── pacientes: um adulto que chega ao médico e uma criança ──────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL,
  '{"nome":"Encaminha Adulto","data_nascimento":"1970-01-01","sexo":"M"}') ->> 'episodio_id';
INSERT INTO t SELECT 'epc', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  jsonb_build_object('nome', 'Curva Criança', 'data_nascimento', (private.data_atual() - interval '2 years')::date, 'sexo', 'F')) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  pg_temp.u('flx'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO t SELECT 'cri', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('epc');

-- ══ 1. aferição e curva ═════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.registrar_afericao_crescimento(%L, %L)', pg_temp.u('cri'), private.data_atual()),
  'Informe ao menos peso', 'aferição vazia é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_afericao_crescimento(%L, %L, 12)', pg_temp.u('cri'), private.data_atual() + 1),
  'A data da aferição não pode ser futura', 'data futura é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_afericao_crescimento(%L, %L, 3.2)', pg_temp.u('cri'), private.data_atual() - interval '3 years'),
  'A data da aferição é anterior ao nascimento', 'antes do nascimento é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_afericao_crescimento(%L, %L, 0)', pg_temp.u('cri'), private.data_atual()),
  'Peso fora do possível', 'peso zero é recusado');
SELECT pg_temp.confere(public.registrar_afericao_crescimento(pg_temp.u('cri'), private.data_atual(), 12.1, 86.5, 48) = 3,
  'lança peso, estatura e PC de hoje: três observações');
SELECT pg_temp.confere(public.registrar_afericao_crescimento(pg_temp.u('cri'), (private.data_atual() - interval '1 year')::date, 9.1, NULL, 46) = 2,
  'aferição da caderneta com data passada (só peso e PC)');
RESET ROLE;
SELECT pg_temp.confere((SELECT count(*) FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
    WHERE o.paciente_id = pg_temp.u('cri') AND c.nome IN ('peso', 'estatura', 'perimetro-cefalico') AND c.unidade_id IS NULL
      AND o.registrado_por = '10000000-0000-4000-8000-000000000004' AND o.episodio_id = pg_temp.u('epc')) = 5,
  'as aferições ficam em observacao (conceitos globais), com autor do login e o atendimento aberto');
SELECT pg_temp.confere((SELECT (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::time = '12:00' FROM public.observacao o
    JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'perimetro-cefalico'
    WHERE o.paciente_id = pg_temp.u('cri') ORDER BY o.aferido_em LIMIT 1),
  'dia anterior grava 12h (a caderneta traz o dia, não a hora)');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.registrar_afericao_crescimento(%L, %L, 10, NULL, NULL, %L)', pg_temp.u('cri'), private.data_atual(), pg_temp.u('ep')),
  'O atendimento informado não é deste paciente', 'atendimento de outro paciente é recusado');

-- ══ 2. avaliação por escala ═════════════════════════════════════════════════
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.registrar_avaliacao(%L, %L, %L)', pg_temp.u('cri'), 'fugulin', '{}'),
  'Escala desconhecida', 'Fugulin não entra (faixas a conferir)');
SELECT pg_temp.falha(format('SELECT public.registrar_avaliacao(%L, %L, %L)', pg_temp.u('cri'), 'braden',
  '{"percepcao":1,"umidade":1,"atividade":1,"mobilidade":1,"nutricao":1,"friccao":1}'),
  'Braden e Morse são escalas do adulto', 'escala de adulto na criança é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_avaliacao(%L, %L, %L)', pg_temp.u('pac'), 'nips',
  '{"face":1,"choro":1,"resp":1,"bracos":1,"pernas":1,"alerta":1}'),
  'NIPS e FLACC são escalas da pediatria', 'escala pediátrica no adulto é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_avaliacao(%L, %L, %L)', pg_temp.u('cri'), 'flacc', '{"face":1,"pernas":1}'),
  'Responda todas as perguntas', 'resposta incompleta é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_avaliacao(%L, %L, %L)', pg_temp.u('cri'), 'flacc',
  '{"face":3,"pernas":1,"atividade":1,"choro":1,"consolo":1}'), 'Resposta fora das opções em face', 'valor fora das opções é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_avaliacao(%L, %L, %L)', pg_temp.u('cri'), 'flacc',
  '{"face":1,"pernas":1,"atividade":1,"choro":1,"consolo":1,"extra":0}'), 'Pergunta que não é da escala', 'pergunta a mais é recusada');
INSERT INTO t SELECT 'av1', public.registrar_avaliacao(pg_temp.u('cri'), 'flacc', '{"face":2,"pernas":1,"atividade":1,"choro":2,"consolo":1}');
SELECT pg_temp.confere((SELECT total = 7 AND interpretacao = 'Dor intensa (7 a 10)' AND versao = '2026-09-29.1' AND episodio_id = pg_temp.u('epc')
    FROM public.avaliacoes_escala WHERE id = pg_temp.u('av1')), 'FLACC 7: soma e leitura refeitas no servidor ("Dor intensa")');
INSERT INTO t SELECT 'av2', public.registrar_avaliacao(pg_temp.u('cri'), 'nips', '{"face":1,"choro":1,"resp":1,"bracos":0,"pernas":0,"alerta":0}');
SELECT pg_temp.confere((SELECT interpretacao FROM public.avaliacoes_escala WHERE id = pg_temp.u('av2')) = 'Sem dor pela NIPS (0 a 3)', 'NIPS 3: sem dor');
INSERT INTO t SELECT 'av3', public.registrar_avaliacao(pg_temp.u('pac'), 'morse', '{"quedas":25,"diagnostico":15,"auxilio":0,"terapia_ev":20,"marcha":0,"estado_mental":0}');
SELECT pg_temp.confere((SELECT total = 60 AND interpretacao = 'Risco alto (45 ou mais)' FROM public.avaliacoes_escala WHERE id = pg_temp.u('av3')),
  'Morse 60 no adulto: risco alto');
INSERT INTO t SELECT 'av4', public.registrar_avaliacao(pg_temp.u('pac'), 'braden', '{"percepcao":3,"umidade":3,"atividade":2,"mobilidade":2,"nutricao":2,"friccao":2}');
SELECT pg_temp.confere((SELECT total = 14 AND interpretacao = 'Risco moderado (13 a 14)' FROM public.avaliacoes_escala WHERE id = pg_temp.u('av4')),
  'Braden 14: risco moderado');
SELECT pg_temp.falha(format('SELECT public.cancelar_avaliacao(%L, %L)', pg_temp.u('av2'), 'errado'), 'Diga por que', 'cancelar exige motivo');
SELECT public.cancelar_avaliacao(pg_temp.u('av2'), 'lançada no paciente errado');
SELECT pg_temp.falha(format('SELECT public.cancelar_avaliacao(%L, %L)', pg_temp.u('av2'), 'de novo, outra vez'), 'Avaliação não encontrada ou já cancelada', 'não se cancela duas vezes');
INSERT INTO t SELECT 'hist', public.avaliacoes_do_paciente(pg_temp.u('cri'))::text;
SELECT pg_temp.confere((SELECT jsonb_array_length(h) = 2 AND h -> 0 ->> 'autor' = 'Enfermeira de Teste'
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(h) x WHERE x ->> 'cancelada_por' = 'Enfermeira de Teste' AND x ->> 'motivo_cancelamento' = 'lançada no paciente errado')
  FROM (SELECT valor::jsonb h FROM t WHERE nome = 'hist') y), 'histórico com autor; a cancelada fica, com quem e por quê');

-- ══ 3. encaminhamento interno ═══════════════════════════════════════════════
SELECT pg_temp.falha(format('SELECT public.encaminhar_interno(%L, %L, %L)', pg_temp.u('pac'), 'Cirurgia geral', 'abdome agudo a esclarecer'),
  'O encaminhamento é do médico', 'enfermagem não encaminha');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.encaminhar_interno(%L, %L, %L)', pg_temp.u('pac'), 'Cirurgia geral', 'curta'),
  'Escreva a justificativa', 'justificativa curta é recusada');
SELECT pg_temp.falha(format('SELECT public.encaminhar_interno(%L, %L, %L, NULL, %L)', pg_temp.u('pac'), 'Cirurgia geral', 'abdome agudo a esclarecer', 'Cozinha'),
  'Serviço fora da lista', 'serviço fora da lista é recusado');
SELECT pg_temp.falha(format('SELECT public.encaminhar_interno(%L, %L, %L, %L)', pg_temp.u('pac'), 'Cirurgia geral', 'abdome agudo a esclarecer', '10000000-0000-4000-8000-000000000004'),
  'O médico de destino não é plantonista desta unidade', 'destino precisa ser médico da unidade');
SELECT pg_temp.falha(format('SELECT public.encaminhar_interno(%L, %L, %L, %L)', pg_temp.u('pac'), 'Cirurgia geral', 'abdome agudo a esclarecer', '10000000-0000-4000-8000-000000000002'),
  'Não se encaminha o paciente para si mesmo', 'não encaminha para si');
SELECT pg_temp.confere((SELECT jsonb_agg(x ->> 'nome') FROM jsonb_array_elements(public.medicos_para_encaminhar(pg_temp.u('pac'))) x) = '["Teleconsultor de Teste"]'::jsonb,
  'lista de médicos da unidade para o campo "Médico" (sem quem encaminha)');
-- pendência: exame sem resultado impede
RESET ROLE;
INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, pedido_por)
VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('pac'), pg_temp.u('ep'), 'Hemograma', '10000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.confere(public.pendencias_para_encaminhar(pg_temp.u('pac')) = ARRAY['Exame sem resultado: Hemograma'], 'pendências do atendimento: exame sem resultado');
SELECT pg_temp.falha(format('SELECT public.encaminhar_interno(%L, %L, %L)', pg_temp.u('pac'), 'Cirurgia geral', 'abdome agudo a esclarecer'),
  'Pendências em aberto impedem o encaminhamento: Exame sem resultado: Hemograma', 'pendência impede encaminhar');
RESET ROLE;
UPDATE public.exames_pedidos SET situacao = 'resultado', resultado = 'normal', resolvido_por = '10000000-0000-4000-8000-000000000002', resolvido_em = now()
 WHERE paciente_id = pg_temp.u('pac');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'e1', public.encaminhar_interno(pg_temp.u('pac'), 'Cirurgia geral', 'abdome agudo a esclarecer', NULL, 'Sala de procedimentos');
SELECT pg_temp.confere((SELECT estado = 'pendente' AND episodio_id = pg_temp.u('ep') AND encaminhado_por = '10000000-0000-4000-8000-000000000002'
    FROM public.encaminhamentos_internos WHERE id = pg_temp.u('e1')), 'encaminhado: pendente, no atendimento aberto, autor do login');
SELECT pg_temp.falha(format('SELECT public.encaminhar_interno(%L, %L, %L)', pg_temp.u('pac'), 'Ortopedia e traumatologia', 'dor em joelho após queda'),
  'Já há um encaminhamento aguardando aceite', 'um pendente por paciente');
SELECT pg_temp.falha(format('SELECT public.aceitar_encaminhamento(%L)', pg_temp.u('e1')), 'Acesso negado: o encaminhamento não é para você', 'quem encaminhou não aceita o próprio');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.aceitar_encaminhamento(%L)', pg_temp.u('e1')), 'Acesso negado', 'enfermagem não aceita encaminhamento');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.confere((SELECT count(*) FROM jsonb_array_elements(public.encaminhamentos_recebidos()) x
    WHERE x ->> 'id' = pg_temp.u('e1')::text AND (x ->> 'posso_responder')::boolean AND x ->> 'paciente' = 'Encaminha Adulto') = 1,
  'o outro médico do plantão vê o encaminhamento recebido, com o paciente');
SELECT pg_temp.falha(format('SELECT public.recusar_encaminhamento(%L, %L)', pg_temp.u('e1'), 'não'), 'Justifique a recusa', 'recusa exige justificativa (≥ 10)');
SELECT public.aceitar_encaminhamento(pg_temp.u('e1'));
SELECT pg_temp.confere((SELECT estado = 'aceito' AND respondido_por = '10000000-0000-4000-8000-000000000006' FROM public.encaminhamentos_internos WHERE id = pg_temp.u('e1')),
  'aceito, com quem e quando');
RESET ROLE;
SELECT pg_temp.confere((SELECT atendimento_medico_id FROM public.episodios WHERE id = pg_temp.u('ep')) = '10000000-0000-4000-8000-000000000006',
  'quem aceita assume o atendimento');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.concluir_encaminhamento(%L)', pg_temp.u('e1')), 'Acesso negado: quem marca o atendimento é quem aceitou', 'só quem aceitou marca atendido');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.concluir_encaminhamento(pg_temp.u('e1'));
SELECT pg_temp.confere((SELECT estado = 'atendido' AND atendido_em IS NOT NULL FROM public.encaminhamentos_internos WHERE id = pg_temp.u('e1')), 'aceito → atendido');
SELECT pg_temp.falha(format('SELECT public.cancelar_encaminhamento(%L, %L)', pg_temp.u('e1'), 'mudou a conduta do caso'),
  'Só se cancela encaminhamento pendente ou aceito', 'atendido não se cancela');

-- recusa, com médico de destino escolhido
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'e2', public.encaminhar_interno(pg_temp.u('pac'), 'Neurologia', 'cefaleia com sinal de alarme', '10000000-0000-4000-8000-000000000006');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.recusar_encaminhamento(pg_temp.u('e2'), 'sem critério para avaliação da neurologia agora');
SELECT pg_temp.confere((SELECT estado = 'recusado' AND motivo_recusa LIKE 'sem critério%' FROM public.encaminhamentos_internos WHERE id = pg_temp.u('e2')),
  'recusado com a justificativa');
SELECT pg_temp.falha(format('SELECT public.aceitar_encaminhamento(%L)', pg_temp.u('e2')), 'Encaminhamento não encontrado ou já respondido', 'recusado não se aceita depois');

-- cancelar (o "excluir" do protótipo): quem encaminhou, com motivo
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'e3', public.encaminhar_interno(pg_temp.u('pac'), 'Clínica médica', 'reavaliação da hipertensão arterial');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.cancelar_encaminhamento(%L, %L)', pg_temp.u('e3'), 'não sou eu quem pediu'), 'Acesso negado: cancela quem encaminhou', 'só quem encaminhou cancela');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.cancelar_encaminhamento(%L, %L)', pg_temp.u('e3'), 'engano'), 'Diga por que', 'cancelar exige motivo');
SELECT public.cancelar_encaminhamento(pg_temp.u('e3'), 'encaminhado por engano, paciente estável');
INSERT INTO t SELECT 'lista', public.encaminhamentos_do_paciente(pg_temp.u('pac'))::text;
SELECT pg_temp.confere((SELECT jsonb_array_length(l) = 3
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(l) x WHERE x ->> 'estado' = 'cancelado' AND x ->> 'cancelado_por' = 'Plantonista de Teste')
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(l) x WHERE x ->> 'estado' = 'recusado' AND x ->> 'respondido_por' = 'Teleconsultor de Teste'
                AND x ->> 'medico_destino' = 'Teleconsultor de Teste')
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(l) x WHERE x ->> 'estado' = 'atendido' AND x ->> 'servico' = 'Sala de procedimentos'
                AND x ->> 'encaminhado_por' = 'Plantonista de Teste')
  FROM (SELECT valor::jsonb l FROM t WHERE nome = 'lista') y), 'histórico do paciente com os três desfechos e os nomes');

-- ── fora do plantão: não lê nem escreve ─────────────────────────────────────
RESET ROLE;
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000006';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.encaminhamentos_do_paciente(%L)', pg_temp.u('pac')), 'Acesso negado', 'fora do plantão não lê encaminhamentos');
SELECT pg_temp.falha(format('SELECT public.avaliacoes_do_paciente(%L)', pg_temp.u('cri')), 'Acesso negado', 'fora do plantão não lê avaliações');
SELECT pg_temp.falha(format('SELECT public.registrar_afericao_crescimento(%L, %L, 12)', pg_temp.u('cri'), private.data_atual()), 'Acesso negado', 'fora do plantão não afere');
SELECT pg_temp.confere((SELECT count(*) FROM public.avaliacoes_escala) = 0, 'fora do plantão não lê avaliações (RLS)');
SELECT pg_temp.confere((SELECT count(*) FROM public.encaminhamentos_internos) = 1, 'fora do plantão, só o encaminhamento em que é o médico de destino (RLS)');
SELECT pg_temp.falha(format('INSERT INTO public.encaminhamentos_internos (unidade_id, paciente_id, episodio_id, especialidade, justificativa, encaminhado_por) VALUES (%L, %L, %L, %L, %L, %L)',
  '21000000-0000-4000-8000-000000000001', pg_temp.u('pac'), pg_temp.u('ep'), 'Direto', 'escrita direta na tabela', '10000000-0000-4000-8000-000000000006'),
  'permission denied', 'escrita direta na tabela é negada: só pelas RPCs');
RESET ROLE;

-- ── nada se apaga ───────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['avaliacoes_escala', 'encaminhamentos_internos'] LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I', t);
      RAISE EXCEPTION 'FALHOU: DELETE em % passou', t;
    EXCEPTION WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE 'Registro clínico não se apaga%' THEN RAISE; END IF;
    END;
  END LOOP;
  RAISE NOTICE 'OK  avaliações e encaminhamentos não saem por DELETE (guarda de 20 anos)';
END $$;
ROLLBACK;
