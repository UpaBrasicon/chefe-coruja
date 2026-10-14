-- ════════════════════════════════════════════════════════════════════════════
-- Rodada 2 (Portão 2) — coorte 2: observação, internação, enfermagem, técnico,
-- farmácia, notificações, correção de identidade, retorno, óbito esperado,
-- isolamento, regulação e transferência para as unidades novas (etapas 4 a
-- 10). Roda depois de 32. Local ou homologação.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION e2e.r2_item(p_n int, p_principio text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT i.id FROM public.prescricao_itens i JOIN public.prescricoes p ON p.id = i.prescricao_id
    JOIN public.medicamento m ON m.id = i.medicamento_id
   WHERE p.paciente_id = e2e.u('r2pac' || p_n) AND m.principio_ativo = p_principio AND i.suspenso_em IS NULL
   ORDER BY i.created_at DESC LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION e2e.r2_item(int, text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.r2_dados_reg(p_n int, p_extra jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('carater', 'urgencia', 'prioridade', 'urgencia', 'destino_tipo', 'a_definir',
           'cid', (SELECT cid FROM e2e.coorte2 WHERE n = p_n), 'internacao_id', e2e.v('r2int' || p_n),
           'quadro_clinico', 'Quadro clínico de teste E2E (coorte 2) do paciente ' || p_n || ': ' || (SELECT queixa FROM e2e.coorte2 WHERE n = p_n) || '.',
           'tempo_evolucao', 'Horas', 'telefone_contato', '(11) 0000-0000') || p_extra
$$;

-- ── 4. observação: #16 RN, #17 criança intoxicada, #26 anafilaxia ───────────
DO $$
DECLARE n int;
BEGIN
  FOREACH n IN ARRAY ARRAY[16, 17, 26] LOOP
    PERFORM e2e.passo('R2.4.atender_observacao', n, 'plantonista2', '/observacao', 'Médico da observação assume',
      format('SELECT public.observacao_atender(%L::uuid)::text', e2e.u('r2int' || n)));
    PERFORM e2e.passo('R2.4.evolucao', n, 'plantonista2', '/observacao', 'Evolução médica na observação',
      format('SELECT public.registrar_evolucao(%L::uuid, %L, %L)::text', e2e.u('r2int' || n), 'evolucao', 'Evolução médica de teste E2E (coorte 2): reavaliado na observação.'));
  END LOOP;
END $$;
-- #17: monitorização seriada pelo técnico (bradicardia e hipotensão do anlodipino)
SELECT e2e.passo('R2.9.sinal', 17, 'tecnico', '/enfermagem/pronto-socorro', 'FC 62 na 1ª hora', e2e.sql_sinal(e2e.u('r2pac17'), 'frequencia-cardiaca', 62, e2e.u('r2int17')));
SELECT e2e.passo('R2.9.sinal', 17, 'tecnico', '/enfermagem/pronto-socorro', 'PA sistólica 78 na 1ª hora', e2e.sql_sinal(e2e.u('r2pac17'), 'pressao-arterial-sistolica', 78, e2e.u('r2int17')));
SELECT e2e.passo('R2.9.sinal', 17, 'tecnico', '/enfermagem/pronto-socorro', 'FC 98 na 4ª hora', e2e.sql_sinal(e2e.u('r2pac17'), 'frequencia-cardiaca', 98, e2e.u('r2int17')));
-- #16: bilirrubina e tipagem resultadas; o nomograma é calculadora da Central Clínica (fora do fluxo do banco)
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT e.id, e.exame, c.n FROM public.exames_pedidos e JOIN (VALUES (16), (17)) c(n) ON e.paciente_id = e2e.u('r2pac' || c.n) WHERE e.situacao = 'pedido' LOOP
    PERFORM e2e.passo('R2.4.resultado_exame', x.n, 'plantonista2', '/observacao', 'Resultado na observação: ' || x.exame,
      format('SELECT public.resolver_exame(%L::uuid, %L)::text', x.id, CASE WHEN x.exame LIKE 'Bilirrubina%' THEN 'BT 19,0 mg/dL (teste E2E)' ELSE 'Resultado de teste E2E' END));
  END LOOP;
END $$;
-- #26: a alergia nova bloqueia o agente no mesmo episódio (já na porta) e segue no cadastro
SELECT e2e.passo('R2.4.alergia_bloqueia_observacao', 26, 'plantonista2', '/observacao', 'Dipirona de novo na observação (deve ser recusada pela alergia)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('r2pac26'),
         jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Dipirona sódica', 'ampola'), 'dose', '1 g', 'via', 'endovenosa', 'posologia', 'dose única')), 'erro:ALERGIA');
SELECT e2e.conferir('R2.4.alergia_no_cadastro', 26, 'A alergia aparece no cadastro do paciente (estado_alergia)',
  public.estado_alergia(e2e.u('r2pac26')) = 'tem'
  AND EXISTS (SELECT 1 FROM public.alergias_paciente a JOIN public.medicamento m ON m.id = a.medicamento_id WHERE a.paciente_id = e2e.u('r2pac26') AND a.inativada_em IS NULL AND m.principio_ativo ILIKE '%dipirona%'),
  'estado: ' || public.estado_alergia(e2e.u('r2pac26')));
SELECT e2e.passo('R2.4.alta_observacao', 26, 'plantonista2', '/observacao', 'Alta da observação depois de 6 h sem recorrência',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, %L)::text', e2e.u('r2int26'), 'alta_medica', 'T78.2'));
SELECT e2e.passo('R2.4.alta_bloqueada_agravo', 17, 'plantonista2', '/observacao', 'Alta da observação com agravo suspeito sem notificação (deve travar)',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, %L)::text', e2e.u('r2int17'), 'alta_medica', 'T46.5'), 'erro:Existe(m) pendência(s) em aberto: Agravo');
SELECT e2e.passo('R2.5.sinan', 17, 'plantonista2', '/notificacao-compulsoria', 'Registra o número do SINAN da intoxicação exógena',
  format('SELECT public.resolver_agravo(%L::uuid, true, %L, NULL)::text', e2e.u('r2agravo17'), '1700001'));
SELECT e2e.passo('R2.4.alta_observacao', 17, 'plantonista2', '/observacao', 'Alta da observação prolongada (criança estável, depois da notificação)',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, %L)::text', e2e.u('r2int17'), 'alta_medica', 'T46.5'));
-- #26 retorna 2 dias depois: a alergia continua bloqueando o agente no episódio novo
SELECT e2e.passo('R2.1.retorno_anafilaxia', 26, 'recepcao', '/recepcao', 'Retorno do #26 (cefaleia): ficha no mesmo cadastro',
  format('SELECT (public.registrar_ficha(%L, %L, %L::uuid, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Dor de cabeça', e2e.u('r2pac26'), '{}'), 'ok', 'r2ep26b');
SELECT e2e.passo('R2.2.classificar', 26, 'enfermeiro', '/triagem', 'Classifica o retorno (verde)',
  format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text', e2e.u('r2ep26b'), 'verde',
         '{"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":4,"pressao-arterial-sistolica":126,"pressao-arterial-diastolica":80}',
         (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Dor de cabeça' AND publico = 'adulto'),
         e2e.disc('e1100000-0000-4000-8000-000000000001', (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Dor de cabeça' AND publico = 'adulto'), 'verde')));
SELECT e2e.passo('R2.3.iniciar', 26, 'plantonista', '/plantao/porta', 'Inicia o retorno', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('r2ep26b')));
SELECT e2e.passo('R2.3.alergia_bloqueia_retorno', 26, 'plantonista', '/plantao/porta', 'Dipirona no retorno (deve ser recusada pela alergia registrada no episódio anterior)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('r2pac26'),
         jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Dipirona sódica', 'ampola'), 'dose', '1 g', 'via', 'endovenosa', 'posologia', 'dose única')), 'erro:ALERGIA');
SELECT e2e.passo('R2.3.soap', 26, 'plantonista', '/plantao/porta', 'SOAP do retorno',
  format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', e2e.u('r2ep26b'), 'Cefaleia tensional (teste E2E).', 'Sem sinais de alarme.', 'Cefaleia tensional.', 'Analgesia sem dipirona.', 'G44.2'));
SELECT e2e.passo('R2.3.alta', 26, 'plantonista', '/plantao/porta', 'Alta do retorno', format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep26b'), 'alta', '{"cid_alta":"G44.2"}'));

-- ── 5. internação: evolução, prescrição, enfermagem, técnico, farmácia ───────
DO $$
DECLARE n int;
BEGIN
  FOREACH n IN ARRAY ARRAY[18, 19, 20, 23, 24, 25, 28, 29, 30, 31] LOOP
    PERFORM e2e.passo('R2.5.evolucao_diaria', n, 'plantonista2', '/internacao', 'Evolução diária',
      format('SELECT public.registrar_evolucao(%L::uuid, %L, %L)::text', e2e.u('r2int' || n), 'evolucao', 'Evolução diária de teste E2E (coorte 2).'));
  END LOOP;
END $$;
-- aprazamento, farmácia e checagem
SELECT e2e.passo('R2.5.aprazar', 18, 'enfermeiro', '/checagem', 'Apraza insulina contínua (checagem a cada hora)',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.r2_item(18, 'Insulina humana regular'), '{08:00,09:00,10:00,11:00,12:00,13:00}'));
SELECT e2e.passo('R2.5.aprazar', 23, 'enfermeiro', '/checagem', 'Apraza o soro antibotrópico (dose única)',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.r2_item(23, 'Soro antibotrópico'), '{10:00}'));
SELECT e2e.passo('R2.5.aprazar', 30, 'enfermeiro', '/checagem', 'Apraza morfina 4/4h do paliativo',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.r2_item(30, 'Morfina'), '{02:00,06:00,10:00,14:00,18:00,22:00}'));
SELECT e2e.passo('R2.5.aprazar', 31, 'enfermeiro', '/checagem', 'Apraza o esquema RIPE (1x ao dia)',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.r2_item(31, 'Rifampicina + isoniazida + pirazinamida + etambutol'), '{06:00}'));
SELECT e2e.passo('R2.10.liberar', 23, 'farmaceutico', '/farmacia', 'Farmácia libera o soro antibotrópico (alta vigilância)',
  format('SELECT public.validar_item(%L::uuid, true)::text', e2e.r2_item(23, 'Soro antibotrópico')));
SELECT e2e.passo('R2.10.liberar', 18, 'farmaceutico', '/farmacia', 'Farmácia libera a insulina (alta vigilância)',
  format('SELECT public.validar_item(%L::uuid, true)::text', e2e.r2_item(18, 'Insulina humana regular')));
SELECT e2e.passo('R2.10.devolver', 30, 'farmaceutico', '/farmacia', 'Farmácia devolve a morfina do paliativo (conferir via e intervalo)',
  format('SELECT public.validar_item(%L::uuid, false, %L)::text', e2e.r2_item(30, 'Morfina'), 'Confirmar via subcutânea e intervalo de resgate (teste E2E)'));
SELECT e2e.conferir('R2.10.aviso_devolucao', 30, 'Prescritor avisado da devolução (correção da tarefa 7)',
  EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'farm_devolvido_' || e2e.r2_item(30, 'Morfina')), NULL);
SELECT e2e.passo('R2.9.checar', 23, 'tecnico', '/checagem', 'Técnico checa o soro antibotrópico como feito',
  format('SELECT public.checar(%L::uuid, %L, %L)::text', e2e.r2_item(23, 'Soro antibotrópico'), 'feito', '10:00'));
SELECT e2e.passo('R2.9.checar', 18, 'tecnico', '/checagem', 'Técnico checa a insulina das 08:00',
  format('SELECT public.checar(%L::uuid, %L, %L)::text', e2e.r2_item(18, 'Insulina humana regular'), 'feito', '08:00'));
SELECT e2e.passo('R2.9.checar_devolvido', 30, 'tecnico', '/checagem', 'Técnico tenta checar item devolvido pela farmácia (pede justificativa)',
  format('SELECT public.checar(%L::uuid, %L, %L)::text', e2e.r2_item(30, 'Morfina'), 'feito', '10:00'), 'erro');
-- técnico: glicemia horária e balanço horário do #18, Glasgow seriado do #24
SELECT e2e.passo('R2.9.glicemia', 18, 'tecnico', '/enfermagem/internacao', 'Glicemia 380 (1ª hora)', e2e.sql_sinal(e2e.u('r2pac18'), 'glicemia-capilar', 380, e2e.u('r2int18')));
SELECT e2e.passo('R2.9.glicemia', 18, 'tecnico', '/enfermagem/internacao', 'Glicemia 300 (2ª hora)', e2e.sql_sinal(e2e.u('r2pac18'), 'glicemia-capilar', 300, e2e.u('r2int18')));
SELECT e2e.passo('R2.9.glicemia', 18, 'tecnico', '/enfermagem/internacao', 'Glicemia 240 (3ª hora)', e2e.sql_sinal(e2e.u('r2pac18'), 'glicemia-capilar', 240, e2e.u('r2int18')));
SELECT e2e.passo('R2.9.balanco', 18, 'tecnico', '/enfermagem/internacao', 'Balanço: entrada 300 mL (1ª hora)',
  format('SELECT public.lancar_balanco(%L::uuid, %L, %L, %s, NULL, NULL, %L::uuid)::text', e2e.u('r2pac18'), 'entrada', 'Soro fisiológico', 300, e2e.u('r2int18')));
SELECT e2e.passo('R2.9.balanco', 18, 'tecnico', '/enfermagem/internacao', 'Balanço: diurese 150 mL',
  format('SELECT public.lancar_balanco(%L::uuid, %L, %L, %s, NULL, NULL, %L::uuid)::text', e2e.u('r2pac18'), 'saida', 'Diurese', 150, e2e.u('r2int18')));
SELECT e2e.passo('R2.9.glasgow', 24, 'tecnico', '/enfermagem/internacao', 'Glasgow 13 (1ª hora)', e2e.sql_sinal(e2e.u('r2pac24'), 'glasgow', 13, e2e.u('r2int24')));
SELECT e2e.passo('R2.9.glasgow', 24, 'tecnico', '/enfermagem/internacao', 'Glasgow 14 (2ª hora)', e2e.sql_sinal(e2e.u('r2pac24'), 'glasgow', 14, e2e.u('r2int24')));
-- enfermagem: Morse no idoso, dispositivo e curativo, Fugulin do politrauma
SELECT e2e.passo('R2.8.morse', 29, 'enfermeiro', '/enfermagem/internacao', 'Escala de Morse (risco de queda) do idoso com fratura',
  format('SELECT public.registrar_avaliacao(%L::uuid, %L, %L::jsonb, NULL, %L::uuid)::text', e2e.u('r2pac29'), 'morse',
         '{"quedas":25,"diagnostico":15,"auxilio":15,"terapia_ev":20,"marcha":20,"estado_mental":0}', e2e.u('r2int29')));
SELECT e2e.passo('R2.8.dispositivo', 24, 'enfermeiro', '/enfermagem/internacao', 'Dois acessos calibrosos no politrauma',
  format('SELECT public.registrar_dispositivo(%L::uuid, %L, %L, %L, %L::date, NULL, NULL, NULL, %L::uuid)::text', e2e.u('r2pac24'), 'Acesso venoso periférico', 'MSD', '14G', private.data_atual(), e2e.u('r2int24')));
SELECT e2e.passo('R2.8.curativo', 25, 'enfermeiro', '/enfermagem/internacao', 'Curativo da queimadura',
  format('SELECT public.registrar_curativo(%L::uuid, %L, %L, %L, NULL, NULL, NULL, %L::uuid)::text', e2e.u('r2pac25'), 'Tronco e braços', 'Sulfadiazina de prata', 'limpo', e2e.u('r2int25')));
SELECT e2e.passo('R2.8.fugulin', 24, 'enfermeiro', '/enfermagem/internacao', 'Fugulin do politrauma',
  format('SELECT public.registrar_fugulin(%L::uuid, %L::jsonb)::text', e2e.u('r2int24'), (SELECT jsonb_object_agg(a, 3) FROM jsonb_array_elements_text(private.fugulin_definicao() -> 'areas') a)));
SELECT e2e.lacuna('R2.8.tracao', 29, 'enfermeiro', 'Registro de tração cutânea/esquelética como dispositivo', 'A lista de dispositivos de enfermagem não tem tração; só texto livre na evolução.');
SELECT e2e.lacuna('R2.5.transfusao', 24, 'plantonista', 'Solicitação de hemocomponente, tipagem e checagem dupla à beira-leito', 'Não há RPC nem tela de transfusão (solicitar_hemocomponente não existe); a tipagem foi pedida como exame comum e não há checagem dupla técnico + enfermeiro.');
SELECT e2e.lacuna('R2.5.pps_ecog', 30, 'plantonista', 'PPS / ECOG como avaliação registrada', 'registrar_avaliacao não tem escala PPS nem ECOG; as escalas disponíveis são as de enfermagem (Morse, Fugulin, Braden) e os escores clínicos.');
SELECT e2e.lacuna('R2.5.diretiva_antecipada', 30, 'plantonista', 'Diretiva antecipada de vontade / decisão de não intubar registrada', 'Não há registro estruturado de diretiva antecipada nem de limitação de suporte; o termo de consentimento é o mais próximo.');

-- ── notificações compulsórias (SINAN) ────────────────────────────────────────
SELECT e2e.passo('R2.5.sinan', 23, 'plantonista2', '/notificacao-compulsoria', 'Registra o número do SINAN do acidente ofídico',
  format('SELECT public.resolver_agravo(%L::uuid, true, %L, NULL)::text', e2e.u('r2agravo23'), '2300001'));
SELECT e2e.passo('R2.5.sinan', 31, 'plantonista2', '/notificacao-compulsoria', 'Registra o número do SINAN da tuberculose',
  format('SELECT public.resolver_agravo(%L::uuid, true, %L, NULL)::text', e2e.u('r2agravo31'), '3100001'));
SELECT e2e.passo('R2.11.notificacoes_periodo', NULL, 'gestor', '/notificacao-compulsoria', 'Gestor vê as notificações do período (3 da coorte 2)',
  format($q$SELECT CASE WHEN n >= 3 THEN n::text ELSE e2e.falhar('só ' || n || ' notificações') END FROM (SELECT count(*) n FROM public.notificacao_compulsoria_periodo(%L, current_date - 1, current_date + 1) x WHERE x::text LIKE '%%E2E%%') q$q$, 'e1100000-0000-4000-8000-000000000001'));

-- ── #33: correção de identidade (ficha aberta no cadastro do #3) ────────────
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT e.id, e.exame FROM public.exames_pedidos e WHERE e.episodio_id = e2e.u('r2ep33') AND e.situacao = 'pedido' LOOP
    PERFORM e2e.passo('R2.3.resultado_exame', 33, 'plantonista', '/plantao/porta', 'Resultado: ' || x.exame,
      format('SELECT public.resolver_exame(%L::uuid, %L)::text', x.id, 'Resultado de teste E2E'));
  END LOOP;
END $$;
SELECT e2e.passo('R2.3.alta_engano', 33, 'plantonista', '/plantao/porta', 'Médico encerra o episódio aberto no cadastro errado (alta com relato do engano)',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', e2e.u('r2ep33'), 'alta', 'Ficha aberta no cadastro de outra pessoa; atendimento registrado no cadastro correto (teste E2E).', '{"cid_alta":"R07.4"}'));
SELECT e2e.passo('R2.1.ficha_correta', 33, 'recepcao', '/recepcao', 'Recepção abre a ficha no cadastro correto (CPF próprio)',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Dor no peito ao esforço',
         jsonb_build_object('nome', 'E2E Paciente Correto', 'cpf', e2e.cpf('900000033'), 'data_nascimento', '1972-02-02', 'sexo', 'M')), 'ok', 'r2ep33b');
SELECT e2e.guardar('r2pac33b', (SELECT paciente_id::text FROM public.episodios WHERE id = e2e.u('r2ep33b')));
SELECT e2e.lacuna('R2.11.mover_episodio', 33, 'gestor', 'Mover o episódio (classificação, SOAP, prescrição) do cadastro errado para o correto', 'Não há função para reatribuir um episódio a outro paciente; a unificação de cadastros (pedir_unificacao) funde duas pessoas, o que aqui seria errado. O episódio fica no cadastro do #3 com o relato do engano.');
SELECT e2e.passo('R2.11.unificacao_errada', 33, 'gestor', '/prontuarios', 'Gestor pede a unificação de dois cadastros de pessoas diferentes, CPFs diferentes (o roteiro espera recusa ou alerta)',
  format('SELECT public.pedir_unificacao(%L::uuid, %L::uuid, %L)::text', e2e.u('r2pac33b'), e2e.u('pac3'), 'Teste: são pessoas diferentes, a ficha foi aberta no cadastro errado'), 'erro');
SELECT e2e.ajuste('R2.11.cancela_unificacao', 'Cancela o pedido de unificação indevido criado pelo passo anterior',
  format('UPDATE public.pedidos_unificacao SET status = ''cancelado'' WHERE principal_id = %L AND absorvido_id = %L AND status = ''pendente''', e2e.u('r2pac33b'), e2e.u('pac3')));
SELECT e2e.conferir('R2.11.auditoria_engano', 33, 'Auditoria tem a ficha e o desfecho do episódio aberto no cadastro errado',
  (SELECT count(*) FROM public.log_auditoria WHERE entidade = 'episodios' AND entidade_id = e2e.u('r2ep33')) >= 2,
  (SELECT string_agg(acao, ',') FROM public.log_auditoria WHERE entidade = 'episodios' AND entidade_id = e2e.u('r2ep33')));
SELECT e2e.conferir('R2.11.historico_fantasma', 33, 'O cadastro do #3 ficou com um episódio que não é dele (histórico fantasma)',
  (SELECT count(*) FROM public.episodios WHERE paciente_id = e2e.u('pac3')) = 2,
  'episódios no cadastro do #3: ' || (SELECT count(*) FROM public.episodios WHERE paciente_id = e2e.u('pac3')) || ' (o da Rodada 1 e o aberto por engano, encerrado com relato; não há como mover)');

-- ── #34: retorno em 48 h — episódio novo × histórico ─────────────────────────
-- regra do produto (Fase 3): quem cuida do paciente agora abre o histórico encerrado com motivo, auditado; o gestor faz o pedido.
-- O roteiro do RT pedia o contrário (plantonista não vê, gestor vê): fica como pergunta de produto.
SELECT e2e.passo('R2.3.historico_plantonista', 34, 'plantonista', '/plantao/porta', 'Plantonista que atende o retorno abre a alta anterior da #11 com motivo (regra do produto)',
  format('SELECT public.abrir_historico_encerrado(%L::uuid, %L)::text', e2e.u('pac11'), 'Retorno em 48 h: rever antibiótico e exames da internação anterior (teste E2E).'));
SELECT e2e.conferir('R2.3.historico_auditado', 34, 'A abertura do histórico pelo plantonista fica no registro de acessos',
  EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE paciente_id = e2e.u('pac11') AND acessado_por = e2e.conta('plantonista') AND created_at > now() - interval '10 minutes'), NULL);
SELECT e2e.passo('R2.3.historico_sem_motivo', 34, 'plantonista', '/plantao/porta', 'Sem motivo o histórico não abre (deve recusar)',
  format('SELECT public.abrir_historico_encerrado(%L::uuid, %L)::text', e2e.u('pac11'), 'curto'), 'erro');
SELECT e2e.passo('R2.11.historico_gestor', 34, 'gestor', '/prontuarios', 'Gestor tenta abrir o histórico direto (regra do produto: o gestor faz o pedido)',
  format('SELECT public.abrir_historico_encerrado(%L::uuid, %L)::text', e2e.u('pac11'), 'Auditoria do retorno em 48 h (teste E2E).'), 'erro');
SELECT e2e.passo('R2.3.desfecho_observacao', 34, 'plantonista', '/plantao/porta', 'Retorno vai para a observação adulto',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep34'), 'observacao', jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000003', 'leito_id', e2e.leito('OA-07'))));

-- ── #30: cuidados paliativos e óbito esperado ────────────────────────────────
SELECT e2e.passo('R2.5.evolucao_paliativa', 30, 'plantonista2', '/internacao', 'Evolução: conforto, família ciente, sem IOT (texto livre)',
  format('SELECT public.registrar_evolucao(%L::uuid, %L, %L)::text', e2e.u('r2int30'), 'evolucao', 'Cuidados paliativos exclusivos; família ciente e de acordo; sem intubação nem RCP (teste E2E).'));
SELECT e2e.passo('R2.5.termo_familia', 30, 'plantonista2', '/internacao', 'Termo de consentimento assinado pela filha (cuidados de conforto)',
  format('SELECT public.emitir_termo_consentimento(%L::uuid, %L::jsonb, NULL, %L::uuid)::text', e2e.u('r2pac30'),
         '{"procedimento":"Cuidados paliativos exclusivos, sem intubação nem reanimação","texto":"A família foi orientada e concorda com os cuidados de conforto (teste E2E).","assinante":"responsavel","sem_condicoes_motivo":"Paciente sonolento, em cuidados de conforto, sem condições de assinar (teste E2E).","responsavel":{"nome":"E2E Filha do Trinta","documento":"RG 90.000.030-X","vinculo":"filha"}}', e2e.u('r2int30')));
SELECT e2e.passo('R2.5.obito_esperado', 30, 'plantonista2', '/internacao', 'Óbito esperado (sem exame pendente, morfina devolvida pela farmácia fica aberta)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L, NULL, NULL, %L, %L::jsonb)::text', e2e.u('r2int30'), 'obito', 'C34.9',
         'Óbito esperado em cuidados paliativos, família presente (teste E2E).', jsonb_build_object('numero_do', '300000030', 'hora_obito', to_char(now(), 'HH24:MI'))));
SELECT e2e.passo('R2.5.sumario_obito', 30, 'plantonista2', '/internacao', 'Sumário de óbito',
  format('SELECT (public.emitir_documento(%L::uuid, %L, %L) ->> ''id'')', e2e.u('r2pac30'), 'sumario_obito', 'Sumário de óbito de teste E2E: neoplasia pulmonar terminal, cuidados paliativos.'));
SELECT e2e.conferir('R2.5.obito_encerra', 30, 'Prescrições do paliativo encerradas no óbito',
  NOT EXISTS (SELECT 1 FROM public.prescricoes WHERE paciente_id = e2e.u('r2pac30') AND status = 'ativa'), NULL);

-- ── #31: isolamento (o #4 da Rodada 1 sai do ISO-01, o #31 entra) ───────────
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT e.id, e.exame FROM public.exames_pedidos e WHERE e.paciente_id = e2e.u('pac4') AND e.situacao = 'pedido' LOOP
    PERFORM e2e.passo('R2.5.resultado_exame', 4, 'plantonista2', '/internacao', 'Resultado antes da alta do #4: ' || x.exame,
      format('SELECT public.resolver_exame(%L::uuid, %L)::text', x.id, 'Resultado de teste E2E'));
  END LOOP;
END $$;
SELECT e2e.passo('R2.5.alta_libera_isolamento', 4, 'plantonista2', '/internacao', 'Alta do #4 (Rodada 1) libera o ISO-01',
  format('SELECT public.dar_alta(%L::uuid, %L, %L)::text', e2e.u('int4'), 'alta_melhorada', 'G00.9'));
SELECT e2e.passo('R2.8.higienizacao', NULL, 'tecnico', '/enfermagem/internacao', 'Técnico conclui a higienização do ISO-01',
  format('SELECT public.concluir_higienizacao(%L::uuid)::text', e2e.leito('ISO-01')));
SELECT e2e.conferir('R2.8.aviso_leito', NULL, 'NIR avisado do ISO-01 liberado (correção da tarefa 7)',
  EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = e2e.conta('nir') AND tipo = 'leito_livre_' || e2e.leito('ISO-01')), NULL);
SELECT e2e.passo('R2.5.mover_isolamento', 31, 'plantonista2', '/internacao', 'Tuberculose sai da enfermaria comum para o ISO-01',
  format('SELECT public.registrar_evento_adt(%L::uuid, %L, %L::uuid, %L::uuid, %L)::text', e2e.u('r2int31'), 'transferencia_leito', 'e1200000-0000-4000-8000-000000000006', e2e.leito('ISO-01'), 'Isolamento respiratório (tuberculose bacilífera)'));
SELECT e2e.conferir('R2.5.no_isolamento', 31, 'O #31 está no setor Isolamento',
  (SELECT setor_atual_id = 'e1200000-0000-4000-8000-000000000006' FROM public.internacoes WHERE id = e2e.u('r2int31')), NULL);

-- ── 6/7. regulação e transferência para as unidades da coorte 2 ─────────────
SELECT e2e.passo('R2.6.solicitar_rn_sem_cns', 16, 'plantonista2', '/regulacao', 'RN sem CNS/CPF: a regulação recusa sem a marca de "não identificado" (regra MIRA)',
  format('SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> ''id'')', 'e1100000-0000-4000-8000-000000000001',
         e2e.u('r2pac16'), e2e.r2_dados_reg(16, '{"tipo":"leito","tipo_leito":"uti_neonatal","procedimento":"0303010037","prioridade":"emergencia"}'::jsonb)), 'erro:O paciente está sem CNS e sem CPF');
SELECT e2e.lacuna('R2.6.rn_sem_cns', 16, 'plantonista2', 'Regulação de recém-nascido sem CNS', 'O RN identificado pela mãe só sai pela regulação marcado como "paciente não identificado"; não há CNS provisório nem vínculo com o cadastro da mãe.');
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT * FROM (VALUES
      (16, 'plantonista2', '{"tipo":"leito","tipo_leito":"uti_neonatal","procedimento":"0303010037","prioridade":"emergencia","paciente_nao_identificado":true}'),
      (18, 'plantonista2', '{"tipo":"leito","tipo_leito":"uti_pediatrica","procedimento":"0303010037","prioridade":"emergencia"}'),
      (19, 'plantonista2', '{"tipo":"leito","tipo_leito":"obstetrico","procedimento":"0303100044","prioridade":"urgencia"}'),
      (20, 'plantonista2', '{"tipo":"leito","tipo_leito":"obstetrico","procedimento":"0303100044","prioridade":"emergencia"}'),
      (23, 'plantonista2', '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303010037","prioridade":"emergencia"}'),
      (24, 'plantonista2', '{"tipo":"transferencia","tipo_leito":"cirurgico","procedimento":"0303010037","transporte":"ambulancia_avancada","prioridade":"emergencia"}'),
      (25, 'plantonista2', '{"tipo":"leito","tipo_leito":"uti_queimados","procedimento":"0303010037","prioridade":"emergencia"}'),
      (28, 'plantonista2', '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303010037","prioridade":"urgencia"}'),
      (29, 'plantonista2', '{"tipo":"leito","tipo_leito":"cirurgico","procedimento":"0303010037","prioridade":"urgencia"}'),
      (31, 'plantonista2', '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303010037","isolamento":true,"isolamento_tipo":"aerossol"}')) v(n, quem, extra) LOOP
    PERFORM e2e.passo('R2.6.solicitar', x.n, x.quem, '/regulacao', 'Solicita regulação (' || (x.extra::jsonb ->> 'tipo_leito') || ')',
      format('SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> ''id'')', 'e1100000-0000-4000-8000-000000000001',
             e2e.u('r2pac' || x.n), e2e.r2_dados_reg(x.n, x.extra::jsonb)), 'ok', 'r2reg' || x.n);
  END LOOP;
END $$;
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT * FROM (VALUES
      (16, 'e1100000-0000-4000-8000-000000000005', 'medico_infantil',  'NEO-01'),
      (18, 'e1100000-0000-4000-8000-000000000005', 'medico_infantil',  'HUP-01'),
      (19, 'e1100000-0000-4000-8000-000000000006', 'medico_altorisco', 'OAR-01'),
      (20, 'e1100000-0000-4000-8000-000000000006', 'medico_altorisco', 'OAR-02'),
      (23, 'e1100000-0000-4000-8000-000000000011', 'toxicologista',    'TOX-01'),
      (24, 'e1100000-0000-4000-8000-000000000010', 'medico_trauma',    'TRA-01'),
      (25, 'e1100000-0000-4000-8000-000000000008', 'medico_queimados', 'QUE-01'),
      (28, 'e1100000-0000-4000-8000-000000000002', 'medico_hospital',  'CM-01'),
      (29, 'e1100000-0000-4000-8000-000000000002', 'medico_hospital',  'CC-02'),
      (31, 'e1100000-0000-4000-8000-000000000002', 'medico_hospital',  'CM-02')) v(n, unidade, quem, leito) LOOP
    PERFORM e2e.passo('R2.7.autorizar', x.n, 'regulador', '/regulacao', 'Central autoriza para ' || (SELECT nome FROM public.unidades WHERE id = x.unidade::uuid),
      format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid)::text', e2e.u('r2reg' || x.n), 'rede', x.unidade));
    PERFORM e2e.passo('R2.7.destino_aceita', x.n, x.quem, '/regulacao', 'Destino aceita com leito ' || x.leito,
      format('SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid)::text', e2e.u('r2reg' || x.n), e2e.leito_em(x.unidade::uuid, x.leito)));
  END LOOP;
END $$;
-- transferências concluídas: politrauma (#24) e pré-eclâmpsia (#20)
DO $$
DECLARE v_n int; v_cid text;
BEGIN
  FOREACH v_n IN ARRAY ARRAY[24, 20] LOOP
    SELECT c.cid INTO v_cid FROM e2e.coorte2 c WHERE c.n = v_n;
    PERFORM e2e.passo('R2.7.saida', v_n, 'nir', '/regulacao', 'NIR marca a saída', format('SELECT public.regulacao_marcar_saida(%L::uuid)::text', e2e.u('r2reg' || v_n)));
    PERFORM e2e.passo('R2.7.alta_transferencia', v_n, 'plantonista2', '/internacao', 'Alta por transferência externa na origem',
      format('SELECT public.dar_alta(%L::uuid, %L, %L, NULL, NULL, %L, %L::jsonb)::text', e2e.u('r2int' || v_n), 'transferencia_externa', v_cid,
             'Transferido pela regulação (teste E2E).', jsonb_build_object('destino', (SELECT u.nome FROM public.regulacao_solicitacoes s JOIN public.unidades u ON u.id = s.destino_unidade_id WHERE s.id = e2e.u('r2reg' || v_n)))));
    PERFORM e2e.passo('R2.7.chegada', v_n, CASE v_n WHEN 24 THEN 'medico_trauma' ELSE 'medico_altorisco' END, '/regulacao', 'Destino marca a chegada',
      format('SELECT public.regulacao_marcar_chegada(%L::uuid, true)::text', e2e.u('r2reg' || v_n)));
  END LOOP;
END $$;
SELECT e2e.conferir('R2.7.transferencia_encerra', 24, 'Transferência externa encerrou as prescrições do politrauma (correção da tarefa 1)',
  NOT EXISTS (SELECT 1 FROM public.prescricoes WHERE paciente_id = e2e.u('r2pac24') AND status = 'ativa'), NULL);

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'R2.%' GROUP BY 1 ORDER BY 1;
SELECT passo, paciente, left(coalesce(detalhe, ''), 120) FROM e2e.resultados WHERE passo LIKE 'R2.%' AND situacao = 'falha' ORDER BY id;
