-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — etapas 5 (AIH, APAC, óbito, alta), 6 (regulação)
-- e 7 (vaga, transferência, leito volta ao censo); casos-limite de cadastro.
-- Procedimentos SIGTAP escolhidos pelo nome na tabela oficial carregada.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION e2e.leito_em(p_unidade uuid, p_ident text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT l.id FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id WHERE s.unidade_id = p_unidade AND l.identificador = p_ident
$$;
CREATE OR REPLACE FUNCTION e2e.fmt_sigtap(c text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT substr(c, 1, 2) || '.' || substr(c, 3, 2) || '.' || substr(c, 5, 2) || '.' || substr(c, 7, 3) || '-' || substr(c, 10, 1)
$$;

-- CNS provisório válido (fictício): começa com 7 e a soma ponderada fecha em múltiplo de 11
CREATE OR REPLACE FUNCTION e2e.cns(p_n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE base text; s int; d int; k int := 0; i int;
BEGIN
  LOOP
    base := '7' || lpad((90000000000 + p_n * 7 + k)::text, 13, '0');
    s := 0;
    FOR i IN 1..14 LOOP s := s + substr(base, i, 1)::int * (16 - i); END LOOP;
    d := (11 - s % 11) % 11;
    IF d < 10 THEN RETURN base || d; END IF;
    k := k + 1;
  END LOOP;
END $$;
-- a AIH exige CNS e endereço no cadastro: o gestor completa (dados completos, fictícios)
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM e2e.coorte WHERE n IN (4, 5, 7, 8, 9, 10, 13) ORDER BY n LOOP
    PERFORM e2e.passo('5.completar_cadastro', c.n, 'gestor', '/prontuarios', 'Completa CNS e endereço do cadastro',
      format('SELECT public.salvar_cadastro_paciente(%L::uuid, %L::jsonb)::text', e2e.u('pac' || c.n),
             jsonb_build_object('nome', c.nome, 'data_nascimento', c.nascimento, 'sexo', c.sexo, 'cpf', c.cpf, 'cns', e2e.cns(c.n),
                                'nome_mae', 'E2E Mãe de ' || c.nome, 'endereco', 'Rua de Teste E2E', 'numero_endereco', '100', 'bairro', 'Centro',
                                'cep', '01001000', 'municipio', 'Cidade Teste', 'municipio_ibge', '3550308', 'uf', 'SP', 'categoria', 'sus', 'raca_cor', 'sem_informacao')));
  END LOOP;
END $$;

-- ── 5. laudos de AIH (o laudo emitido cria a AIH) ───────────────────────────
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT * FROM (VALUES
      (4,  'G00.9', '0303010037', 'Meningite bacteriana presumida', 'Cefaleia, febre e rigidez de nuca'),
      (5,  'K35.9', '0407020039', 'Apendicite aguda', 'Dor em fossa ilíaca direita com defesa'),
      (7,  'I21.9', '0303060190', 'Infarto agudo do miocárdio', 'Dor torácica típica com alteração de ECG'),
      (8,  'N18.0', '0305010174', 'Doença renal crônica dialítica com hipercalemia', 'Fraqueza, bradicardia, falta à hemodiálise'),
      (9,  'I63.9', '0303040300', 'AVC isquêmico', 'Hemiparesia direita e afasia de início súbito'),
      (10, 'J18.9', '0303140151', 'Pneumonia com insuficiência respiratória', 'Febre, tosse e dessaturação'),
      (13, 'A41.9', '0303010037', 'Choque séptico', 'Febre, hipotensão refratária e confusão')) v(n, cid, proc, diag, sinais) LOOP
    PERFORM e2e.passo('5.laudo_aih', x.n, 'plantonista2', '/internacao (Laudo AIH)', 'Emite laudo de AIH (' || x.proc || ')',
      format('SELECT (public.emitir_documento(%L::uuid, %L, %L) ->> ''id'')', e2e.u('pac' || x.n), 'laudo_aih',
             json_build_object('aih', json_build_object('cid', x.cid, 'procCod', e2e.fmt_sigtap(x.proc),
               'procDesc', (SELECT nome FROM terminologia.sigtap_procedimento WHERE codigo = x.proc), 'sinais', x.sinais,
               'condicoes', 'Necessita internação hospitalar (teste E2E)', 'diagnostico', x.diag, 'clinica', 'Clínica médica'))::text),
      'ok', 'laudo' || x.n);
    PERFORM e2e.guardar('aih' || x.n, (SELECT id::text FROM public.aihs WHERE paciente_id = e2e.u('pac' || x.n) ORDER BY solicitada_em DESC LIMIT 1));
  END LOOP;
END $$;
SELECT e2e.passo('5.aih_aprovar', 7, 'regulador', '/aih', 'Médico regulador aprova a AIH do #7 (número e competência)',
  format('SELECT public.decidir_aih(%L::uuid, true, %L, %L)::text', e2e.u('aih7'), '3526100000017', to_char(now(), 'YYYYMM')));
SELECT e2e.passo('5.aih_rejeitar', 10, 'regulador', '/aih', 'Médico regulador rejeita a AIH do #10 com motivo',
  format('SELECT public.decidir_aih(%L::uuid, false, NULL, NULL, %L)::text', e2e.u('aih10'), 'Faltam dados de gravidade no laudo'));
SELECT e2e.passo('5.plantonista_aprova_aih', 5, 'plantonista2', '/aih', 'Plantonista tenta aprovar AIH (deve ser negado)',
  format('SELECT public.decidir_aih(%L::uuid, true, %L, %L)::text', e2e.u('aih5'), '3526100000025', to_char(now(), 'YYYYMM')), 'erro');
-- APAC do #8 (hemodiálise)
SELECT e2e.passo('5.apac', 8, 'plantonista2', '/internacao (APAC)', 'Solicita APAC de hemodiálise',
  format('SELECT public.solicitar_apac(%L::uuid, %L::jsonb)::text', e2e.u('pac8'),
         jsonb_build_object('procedimento', '0305010107', 'cid', 'N18.0', 'carater', '01', 'tipo', '1',
                            'justificativa', jsonb_build_object('justificativa', 'Doença renal crônica em hemodiálise (teste E2E).'))), 'ok', 'apac8');

-- ── 6. regulação ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION e2e.dados_reg(p_n int, p_extra jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('carater', 'urgencia', 'prioridade', 'urgencia', 'destino_tipo', 'a_definir',
           'cid', (SELECT cid FROM e2e.coorte WHERE n = p_n), 'internacao_id', e2e.v('int' || p_n),
           'quadro_clinico', 'Quadro clínico de teste E2E do paciente ' || p_n || ': ' || (SELECT queixa FROM e2e.coorte WHERE n = p_n) || '.',
           'tempo_evolucao', 'Horas', 'telefone_contato', '(11) 0000-0000') || p_extra
$$;
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT * FROM (VALUES
      (1,  'plantonista2', '{"tipo":"leito","tipo_leito":"uti_pediatrica","procedimento":"0303010037","prioridade":"emergencia"}'),
      (4,  'nir',          '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303040297","medico_assistente_id":"e2000000-0000-4000-8000-000000000005","isolamento":true,"isolamento_tipo":"goticula"}'),
      (5,  'plantonista2', '{"tipo":"leito","tipo_leito":"cirurgico","procedimento":"0407020039","cid":"K35.9"}'),
      (6,  'plantonista2', '{"tipo":"leito","tipo_leito":"obstetrico","procedimento":"0303100044","prioridade":"emergencia"}'),
      (7,  'plantonista2', '{"tipo":"transferencia","tipo_leito":"unidade_coronariana","procedimento":"0303060190","transporte":"ambulancia_avancada","prioridade":"emergencia"}'),
      (9,  'plantonista2', '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303040149","prioridade":"emergencia"}'),
      (10, 'plantonista2', '{"tipo":"leito","tipo_leito":"uti_adulto","procedimento":"0303140151","prioridade":"emergencia"}'),
      (12, 'plantonista2', '{"tipo":"leito","tipo_leito":"psiquiatrico","internacao_psiquiatrica":"involuntaria","procedimento":"0303170093"}')) v(n, quem, extra) LOOP
    PERFORM e2e.passo('6.solicitar', x.n, x.quem, '/regulacao', 'Solicita regulação (' || (x.extra::jsonb ->> 'tipo_leito') || ')',
      format('SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> ''id'')', 'e1100000-0000-4000-8000-000000000001',
             e2e.u('pac' || x.n), e2e.dados_reg(x.n, x.extra::jsonb)), 'ok', 'reg' || x.n);
  END LOOP;
END $$;
-- anexo: laudo do #7 (documento do prontuário); arquivo e imagem precisam do armazenamento
SELECT e2e.passo('6.anexar_documento', 7, 'plantonista2', '/regulacao', 'Anexa o laudo de AIH do prontuário ao pedido',
  format('SELECT public.regulacao_anexar_documento(%L::uuid, %L::uuid)::text', e2e.u('reg7'), e2e.u('laudo7')));
SELECT e2e.lacuna('6.anexo_arquivo', 7, 'plantonista', 'Anexar exame/imagem/ECG como arquivo', 'Não testado no ambiente local: o armazenamento local recusa envio (esquema do banco mais novo que o serviço de storage, erro 42P10). Testar na homologação.');
-- pendência e resposta (#5); priorização (#9); devolução e reenvio (#12)
SELECT e2e.passo('6.assumir', 5, 'regulador', '/regulacao', 'Regulador assume o pedido', format('SELECT public.regulacao_assumir(%L::uuid)::text', e2e.u('reg5')));
SELECT e2e.passo('6.pendencia', 5, 'regulador', '/regulacao', 'Regulador pede informação complementar',
  format('SELECT public.regulacao_pendencia(%L::uuid, %L)::text', e2e.u('reg5'), 'Enviar resultado do hemograma e do ultrassom.'));
SELECT e2e.passo('6.responder_pendencia', 5, 'nir', '/regulacao', 'NIR responde a pendência',
  format('SELECT public.regulacao_responder_pendencia(%L::uuid, %L)::text', e2e.u('reg5'), 'Hemograma com leucocitose; ultrassom sugestivo de apendicite.'));
SELECT e2e.passo('6.priorizar', 9, 'regulador', '/regulacao', 'Regulador reclassifica a prioridade',
  format('SELECT public.regulacao_priorizar(%L::uuid, %L, %L)::text', e2e.u('reg9'), 'emergencia', 'Janela terapêutica do AVC'));
SELECT e2e.passo('6.devolver', 12, 'regulador', '/regulacao', 'Regulador devolve para correção',
  format('SELECT public.regulacao_devolver(%L::uuid, %L)::text', e2e.u('reg12'), 'Informar risco de auto e heteroagressão e o tipo de internação.'));
SELECT e2e.passo('6.reenviar', 12, 'plantonista2', '/regulacao', 'Origem corrige e reenvia (reapresentação)',
  format('SELECT public.regulacao_reenviar(%L::uuid, %L::jsonb)::text', e2e.u('reg12'),
         e2e.dados_reg(12, '{"tipo":"leito","tipo_leito":"psiquiatrico","internacao_psiquiatrica":"involuntaria","procedimento":"0303170093"}'::jsonb)
           || '{"quadro_clinico":"Agitação psicomotora após ingestão de comprimidos, risco alto de auto e heteroagressão; internação involuntária (teste E2E)."}'::jsonb));
-- negativa com justificativa (#9) e nova solicitação (reapresentação)
SELECT e2e.passo('6.negar', 9, 'regulador', '/regulacao', 'Regulador nega com justificativa',
  format('SELECT public.regulacao_negar(%L::uuid, %L, %L)::text', e2e.u('reg9'), 'sem_oferta', 'Sem leito de neurologia na rede hoje; reapresentar amanhã.'));
SELECT e2e.passo('6.reapresentar', 9, 'plantonista2', '/regulacao', 'Origem abre nova solicitação depois da negativa',
  format('SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> ''id'')', 'e1100000-0000-4000-8000-000000000001', e2e.u('pac9'),
         e2e.dados_reg(9, '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303040149","prioridade":"emergencia"}'::jsonb)), 'ok', 'reg9b');
-- cancelamento por melhora (#4)
SELECT e2e.passo('6.cancelar_melhora', 4, 'plantonista2', '/regulacao', 'Médico assistente cancela por melhora',
  format('SELECT public.regulacao_cancelar(%L::uuid, %L)::text', e2e.u('reg4'), 'Paciente melhorou e segue tratamento na unidade.'));
SELECT e2e.passo('6.nir_nao_cancela', 4, 'nir', '/regulacao', 'NIR não cancela (deve ser negado)',
  format('SELECT public.regulacao_cancelar(%L::uuid, %L)::text', e2e.u('reg9b'), 'Teste de permissão do NIR'), 'erro');

-- ── 7. vaga, aceite, transferência ──────────────────────────────────────────
-- #7: autoriza → hospital aceita com leito → sai → chega
SELECT e2e.passo('7.autorizar', 7, 'regulador', '/regulacao', 'Central autoriza para o Hospital Terciário',
  format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid, NULL, %L)::text', e2e.u('reg7'), 'rede', 'e1100000-0000-4000-8000-000000000002', 'ambulancia_avancada'));
SELECT e2e.passo('7.destino_aceita', 7, 'medico_hospital', '/regulacao', 'Hospital aceita e reserva leito na unidade coronariana',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid, %L)::text', e2e.u('reg7'), e2e.leito_em('e1100000-0000-4000-8000-000000000002', 'UCO-01'), 'Equipe de hemodinâmica avisada'));
SELECT e2e.lacuna('7.resumo_transferencia', 7, 'plantonista', 'Resumo de transferência e checklist de transferência', 'Não há documento de resumo de transferência nem checklist (o laudo e o encaminhamento são os mais próximos).');
SELECT e2e.passo('7.saida', 7, 'nir', '/regulacao', 'NIR marca a saída do paciente', format('SELECT public.regulacao_marcar_saida(%L::uuid)::text', e2e.u('reg7')));
SELECT e2e.passo('7.alta_transferencia', 7, 'plantonista2', '/internacao', 'Alta por transferência externa na origem (libera o leito)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L, NULL, NULL, %L, %L::jsonb)::text', e2e.u('int7'), 'transferencia_externa', 'I21.9',
         'Transferido para o Hospital Terciário E2E pela regulação.', '{"destino":"Hospital Terciário E2E"}'));
SELECT e2e.passo('7.chegada', 7, 'medico_hospital', '/regulacao', 'Hospital marca a chegada', format('SELECT public.regulacao_marcar_chegada(%L::uuid, true)::text', e2e.u('reg7')));
SELECT e2e.passo('7.leito_origem_higienizacao', 7, 'gestor', '/unidade', 'Leito de origem (INT-03) conclui a higienização',
  format('SELECT public.concluir_higienizacao(%L::uuid)::text', e2e.leito('INT-03')));
SELECT e2e.passo('7.censo_leito_livre', 7, 'gestor', '/unidade', 'Leito INT-03 aparece livre na situação de leitos',
  format($q$SELECT CASE WHEN (SELECT status::text FROM public.leitos WHERE id = %L) = 'livre' THEN 'livre' ELSE e2e.falhar('leito não está livre: ' || (SELECT status::text FROM public.leitos WHERE id = %L)) END$q$, e2e.leito('INT-03'), e2e.leito('INT-03')));
-- #6: maternidade aceita
SELECT e2e.passo('7.autorizar', 6, 'regulador', '/regulacao', 'Central autoriza para a Maternidade',
  format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid)::text', e2e.u('reg6'), 'rede', 'e1100000-0000-4000-8000-000000000003'));
SELECT e2e.passo('7.destino_aceita', 6, 'medico_maternidade', '/regulacao', 'Maternidade aceita com leito',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid)::text', e2e.u('reg6'), e2e.leito_em('e1100000-0000-4000-8000-000000000003', 'OBS-01')));
-- #10: UTI recusa sem vaga, volta à central
SELECT e2e.passo('7.autorizar', 10, 'regulador', '/regulacao', 'Central autoriza para a UTI de referência',
  format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid)::text', e2e.u('reg10'), 'rede', 'e1100000-0000-4000-8000-000000000004'));
SELECT e2e.passo('7.destino_recusa', 10, 'medico_uti', '/regulacao', 'UTI recusa: sem vaga',
  format('SELECT public.regulacao_destino_recusar(%L::uuid, %L, %L)::text', e2e.u('reg10'), 'sem_vaga', 'UTI lotada, sem previsão de alta nas próximas horas.'));
-- #5: autorizado depois da pendência, hospital aceita
SELECT e2e.passo('7.autorizar', 5, 'regulador', '/regulacao', 'Central autoriza o cirúrgico',
  format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid)::text', e2e.u('reg5'), 'rede', 'e1100000-0000-4000-8000-000000000002'));
SELECT e2e.passo('7.destino_aceita', 5, 'medico_hospital', '/regulacao', 'Hospital aceita na clínica cirúrgica',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid)::text', e2e.u('reg5'), e2e.leito_em('e1100000-0000-4000-8000-000000000002', 'CC-01')));
-- #1: espera > 24 h pelo destino (simulada) e os avisos
SELECT e2e.passo('7.autorizar', 1, 'regulador', '/regulacao', 'Central autoriza a UTI pediátrica',
  format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid)::text', e2e.u('reg1'), 'rede', 'e1100000-0000-4000-8000-000000000004'));
SELECT e2e.ajuste('6.espera_24h', 'Simula 25 h de espera pelo destino no pedido do #1',
  format('UPDATE public.regulacao_status_tempos SET inicio = now() - interval ''25 hours'' WHERE solicitacao_id = %L AND fim IS NULL', e2e.u('reg1')));
SELECT e2e.ajuste('6.job_avisos', 'Roda o job de avisos de prazo da regulação', 'SELECT private.regulacao_sla_avisar()');
SELECT e2e.passo('6.aviso_destino_24h', 1, 'medico_uti', '/notificacoes', 'Destino recebe aviso de prazo vencido',
  $q$SELECT CASE WHEN count(*) > 0 THEN count(*)::text ELSE e2e.falhar('sem aviso') END FROM public.notificacoes_plantonista WHERE perfil_id = private.meu_perfil_id() AND tipo LIKE 'reg_prazo_destino_%'$q$);
SELECT e2e.passo('6.aviso_gestor_24h', 1, 'gestor', '/notificacoes', 'Gestor da unidade de origem recebe alerta da espera > 24 h',
  $q$SELECT CASE WHEN count(*) > 0 THEN count(*)::text ELSE e2e.falhar('nenhum aviso ao gestor da origem') END FROM public.notificacoes_plantonista WHERE perfil_id = private.meu_perfil_id() AND tipo LIKE 'reg_prazo%'$q$);

-- ── 5. óbito (#13) e altas ──────────────────────────────────────────────────
-- Correção da tarefa 1 (PR #100): o óbito não espera exame; o exame pedido é cancelado no desfecho.
SELECT e2e.passo('5.obito', 13, 'plantonista2', '/internacao', 'Óbito na unidade com exame ainda sem resultado (com número da D.O.)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L, NULL, NULL, %L, %L::jsonb)::text', e2e.u('int13'), 'obito', 'A41.9',
         'Óbito às 03h10 após choque refratário (teste E2E).', jsonb_build_object('numero_do', '123456789', 'hora_obito', to_char(now(), 'HH24:MI'))));
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT e.id, e.exame, e.paciente_id FROM public.exames_pedidos e WHERE e.paciente_id IN (e2e.u('pac13'), e2e.u('pac11')) AND e.situacao = 'pedido' LOOP
    PERFORM e2e.passo('5.resultado_exame', NULL, 'plantonista2', '/internacao', 'Resultado antes da saída: ' || x.exame,
      format('SELECT public.resolver_exame(%L::uuid, %L)::text', x.id, 'Resultado de teste E2E'));
  END LOOP;
END $$;
SELECT e2e.conferir('5.obito_cancela_exames', 13, 'Os exames do #13 sem resultado foram cancelados no óbito (correção da tarefa 1)',
  NOT EXISTS (SELECT 1 FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac13') AND situacao = 'pedido'),
  (SELECT string_agg(exame || ':' || situacao, ', ') FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac13')));
SELECT e2e.passo('5.sumario_obito', 13, 'plantonista2', '/internacao', 'Sumário de óbito',
  format('SELECT (public.emitir_documento(%L::uuid, %L, %L) ->> ''id'')', e2e.u('pac13'), 'sumario_obito', 'Sumário de óbito de teste E2E: choque séptico refratário.'));
SELECT e2e.lacuna('5.declaracao_obito', 13, 'plantonista', 'Declaração de óbito (D.O.) e comunicação à família/serviços', 'Não há documento de D.O. (só o número dentro do desfecho) nem registro de comunicação do óbito.');
SELECT e2e.passo('5.alta_internacao', 11, 'plantonista2', '/internacao', 'Alta melhorada da idosa (ITU + delirium)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L)::text', e2e.u('int11'), 'alta_melhorada', 'N39.0'));
SELECT e2e.passo('5.pacote_alta', 11, 'plantonista2', '/internacao', 'Pacote de alta com orientações',
  format('SELECT public.gerar_pacote_alta(%L::uuid, %L::jsonb, %L)::text', e2e.u('int11'), '["Manter antibiótico até completar 7 dias","Voltar se febre ou confusão"]', 'UBS em 7 dias'));

-- ── casos-limite: reidentificação do #15, menor desacompanhado, gêmeos, estrangeiro, 29/02 ──
SELECT e2e.passo('C.reidentificar', 15, 'gestor', '/prontuarios', 'Reidentifica o desconhecido (nome, CPF, nascimento)',
  format('SELECT public.salvar_cadastro_paciente(%L::uuid, %L::jsonb)::text', e2e.u('pac15'),
         jsonb_build_object('nome', 'E2E José Reidentificado', 'cpf', e2e.cpf('900000015'), 'data_nascimento', '1971-07-15', 'sexo', 'M')));
SELECT e2e.passo('C.menor_desacompanhado', NULL, 'recepcao', '/recepcao', 'Menor desacompanhado (trazido pela escola, sem responsável)',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Queda no recreio',
         jsonb_build_object('nome', 'E2E Menor Desacompanhado', 'data_nascimento', (current_date - interval '9 years')::date, 'sexo', 'F')), 'ok', 'ep_menor');
SELECT e2e.passo('C.gemeo1', NULL, 'recepcao', '/recepcao', 'Gêmeo 1 (mesmo nome e nascimento)',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Febre',
         '{"nome":"E2E Gêmeo Silva","data_nascimento":"2022-03-10","sexo":"M"}'));
SELECT e2e.passo('C.gemeo2_aviso', NULL, 'recepcao', '/recepcao', 'Gêmeo 2 sem marcar "outra pessoa": deve avisar duplicidade provável',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Febre',
         '{"nome":"E2E Gêmeo Silva","data_nascimento":"2022-03-10","sexo":"M"}'), 'erro:FICHA_DUPLICATA_PROVAVEL');
SELECT e2e.passo('C.gemeo2_outra_pessoa', NULL, 'recepcao', '/recepcao', 'Gêmeo 2 confirmado como outra pessoa',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb, %L::text[], true) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Febre',
         '{"nome":"E2E Gêmeo Silva","data_nascimento":"2022-03-10","sexo":"M"}', '{}'));
SELECT e2e.passo('C.estrangeiro', NULL, 'recepcao', '/recepcao', 'Estrangeiro sem CPF',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Dor de garganta',
         '{"nome":"E2E Juan Estrangero","data_nascimento":"1990-08-08","sexo":"M","nacionalidade":"Venezuela","nome_social":"Juan"}'));
SELECT e2e.passo('C.nascido_29_02', NULL, 'recepcao', '/recepcao', 'Nascido em 29/02',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Tosse',
         '{"nome":"E2E Bissexto","data_nascimento":"2016-02-29","sexo":"F"}'));

SELECT 'regulação, AIH, alta' AS etapa, situacao, count(*) FROM e2e.resultados WHERE passo ~ '^(5\.(laudo|aih|plant|apac|obito|sumario|declaracao|alta|pacote)|6\.|7\.|C\.)' GROUP BY situacao ORDER BY situacao;
