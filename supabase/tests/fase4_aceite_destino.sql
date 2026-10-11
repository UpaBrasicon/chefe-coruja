-- Fase 4, tarefa 9 — migration 20261115000001_aceite_destino.sql: aceite pela
-- unidade destino. Cobre:
-- - autorizar manda o pedido ao destino ("aguardando o destino") e avisa;
-- - o destino (médico ou gestor) vê, aceita reservando o leito ou recusa com
--   motivo; a enfermagem não responde; na recusa o pedido volta à central e o
--   destino deixa de vê-lo;
-- - prazo de 24 h do destino, só alerta;
-- - saída (origem), chegada e falta (destino); a reserva é liberada na falta e
--   no cancelamento;
-- - destino fora da rede: a central registra a resposta e a chegada.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-0000000009c0', 'Rede do Destino');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-0000000009c0', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009c1'::uuid, 'UPA Origem', '7654504'),
               ('21000000-0000-4000-8000-0000000009c2'::uuid, 'Hospital Destino', '7654512'),
               ('21000000-0000-4000-8000-0000000009c3'::uuid, 'Central Destino', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009c0', '21000000-0000-4000-8000-0000000009c3', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT x.id, x.un, x.nome, tipo
  FROM public.setores, (VALUES ('22000000-0000-4000-8000-0000000009c1'::uuid, '21000000-0000-4000-8000-0000000009c1'::uuid, 'Porta'),
                               ('22000000-0000-4000-8000-0000000009c2'::uuid, '21000000-0000-4000-8000-0000000009c2'::uuid, 'UTI'),
                               ('22000000-0000-4000-8000-0000000009c3'::uuid, '21000000-0000-4000-8000-0000000009c2'::uuid, 'Enfermaria')) x(id, un, nome)
 WHERE setores.id = '22000000-0000-4000-8000-000000000001';
UPDATE public.setores SET regulacao_tipo_leito = 'uti_adulto' WHERE id = '22000000-0000-4000-8000-0000000009c2';
INSERT INTO public.leitos (id, setor_id, identificador, status) VALUES
  ('24000000-0000-4000-8000-0000000009c1', '22000000-0000-4000-8000-0000000009c2', 'UTI-1', 'livre'),
  ('24000000-0000-4000-8000-0000000009c2', '22000000-0000-4000-8000-0000000009c2', 'UTI-2', 'livre'),
  ('24000000-0000-4000-8000-0000000009c3', '22000000-0000-4000-8000-0000000009c3', 'ENF-1', 'livre');
-- 002 médico da UPA (solicitante); 004 médico do hospital; 003 gestor do hospital;
-- 005 enfermeiro do hospital; 006 regulador da central
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009c1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009c2', 'plantonista'),
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-0000000009c2', 'gestor'),
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-0000000009c2', 'enfermeiro'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009c3', 'regulador');
UPDATE public.perfis SET crm = '123456', uf_crm = 'SP' WHERE id = '10000000-0000-4000-8000-000000000004';
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
SELECT ('23000000-0000-4000-8000-0000000009c' || n)::uuid, '21000000-0000-4000-8000-0000000009c1', 'Paciente Destino ' || n,
       '1970-01-01', 'D-' || n, '22000000-0000-4000-8000-0000000009c1', 'M'
  FROM generate_series(1, 4) n;
-- 1 leito; 2 exame; 3 transferência para fora da rede; 4 leito (para cancelar)
INSERT INTO public.regulacao_solicitacoes (organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, paciente_nao_identificado,
  tipo, procedimento, tipo_leito, transporte, destino_tipo, carater, modalidade, prioridade, cid, quadro_clinico, solicitante_id, solicitante_papel)
SELECT '20000000-0000-4000-8000-0000000009c0', '21000000-0000-4000-8000-0000000009c3', '21000000-0000-4000-8000-0000000009c1', '7654504',
       ('23000000-0000-4000-8000-0000000009c' || n)::uuid, true, x.tipo, '0303060190', x.leito, x.transporte, 'a_definir', 'urgencia', '04',
       'urgencia', 'I21.9', 'Quadro clínico do pedido de teste do destino.', '10000000-0000-4000-8000-000000000002', 'medico'
  FROM (VALUES (1, 'leito', 'uti_adulto', NULL), (2, 'exame', NULL, NULL), (3, 'transferencia', NULL, 'ambulancia_avancada'),
               (4, 'leito', 'uti_adulto', NULL)) x(n, tipo, leito, transporte);

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
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
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE FUNCTION pg_temp.id(n int) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.regulacao_solicitacoes WHERE paciente_id = ('23000000-0000-4000-8000-0000000009c' || n)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(int) TO authenticated;
CREATE FUNCTION pg_temp.campo(n int, c text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT to_jsonb(s)->>c FROM public.regulacao_solicitacoes s WHERE id = pg_temp.id(n) $$;
GRANT EXECUTE ON FUNCTION pg_temp.campo(int, text) TO authenticated;
CREATE FUNCTION pg_temp.leito(i text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT status::text FROM public.leitos WHERE id = i::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.leito(text) TO authenticated;
CREATE FUNCTION pg_temp.avisos(perfil text, prefixo text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.notificacoes_plantonista WHERE perfil_id = perfil::uuid AND tipo LIKE prefixo || '%' $$;
GRANT EXECUTE ON FUNCTION pg_temp.avisos(text, text) TO authenticated;

SET LOCAL ROLE authenticated;
-- ── 1. autorizar manda ao destino ───────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.regulacao_autorizar(pg_temp.id(1), 'rede', '21000000-0000-4000-8000-0000000009c2');
SELECT pg_temp.ok(pg_temp.campo(1, 'status') = 'aguardando_destino' AND pg_temp.campo(1, 'destino_enviado_em') IS NOT NULL,
  'autorizado, o pedido fica aguardando o destino');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000004', 'reg_destino_') = 1
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000003', 'reg_destino_') = 1
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000005', 'reg_destino_') = 0
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000002', 'reg_autorizada_') = 1,
  'avisos: médico e gestor do destino; a origem sabe que espera o destino');

-- ── 2. o destino vê; a enfermagem não ───────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_destino_lista('21000000-0000-4000-8000-0000000009c2')) = 1
              AND (public.regulacao_detalhe(pg_temp.id(1))->>'sou_destino')::boolean,
  'médico do destino vê o pedido recebido');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT public.regulacao_destino_lista('21000000-0000-4000-8000-0000000009c2')$$, 'Acesso negado', 'enfermagem não vê a lista do destino');
SELECT pg_temp.falha(format('SELECT public.regulacao_destino_aceitar(%L, %L)', pg_temp.id(1), '24000000-0000-4000-8000-0000000009c1'),
  'Responde pelo destino o médico plantonista ou o gestor', 'enfermagem não responde pelo destino');

-- ── 3. prazo do destino (24 h, só alerta) ───────────────────────────────────
RESET ROLE;
UPDATE public.regulacao_status_tempos SET inicio = now() - interval '25 hours' WHERE solicitacao_id = pg_temp.id(1) AND fim IS NULL;
SELECT pg_temp.ok((private.regulacao_sla((SELECT s FROM public.regulacao_solicitacoes s WHERE id = pg_temp.id(1)))->>'atrasado_destino')::boolean
              AND (private.regulacao_sla((SELECT s FROM public.regulacao_solicitacoes s WHERE id = pg_temp.id(1)))->'destino'->>'prazo_h')::int = 24,
  'destino sem resposta há 25 h: atrasado (prazo de 24 h)');
SELECT private.regulacao_sla_avisar();
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000004', 'reg_prazo_destino_') = 1
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000006', 'reg_prazo_destino_') = 1
              AND pg_temp.campo(1, 'status') = 'aguardando_destino',
  'avisa o destino e a central; nada automático');

-- ── 4. aceite com reserva do leito ──────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.regulacao_destino_aceitar(%L)', pg_temp.id(1)),
  'Escolha o leito que fica reservado', 'pedido de leito pede o leito');
SELECT pg_temp.ok((public.regulacao_leitos_destino(pg_temp.id(1))->0->>'do_tipo')::boolean
              AND jsonb_array_length(public.regulacao_leitos_destino(pg_temp.id(1))) = 3,
  'leitos livres do destino, os do tipo pedido primeiro');
SELECT public.regulacao_destino_aceitar(pg_temp.id(1), '24000000-0000-4000-8000-0000000009c1', 'Leito pronto, equipe avisada.');
SELECT pg_temp.ok(pg_temp.campo(1, 'status') = 'autorizada' AND pg_temp.campo(1, 'destino_resposta') = 'aceita'
              AND pg_temp.leito('24000000-0000-4000-8000-0000000009c1') = 'reservado'
              AND (public.regulacao_detalhe(pg_temp.id(1))->'reserva'->>'leito') = 'UTI-1'
              AND (public.regulacao_detalhe(pg_temp.id(1))->'ultimo_aceite'->>'registro') = 'CRM 123456/SP',
  'aceite reserva o leito e guarda o CRM de quem aceitou');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000002', 'reg_destino_aceitou_') = 1
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000006', 'reg_destino_aceitou_') = 1,
  'origem e regulador avisados do aceite');

-- ── 5. saída e chegada ──────────────────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.regulacao_marcar_saida(%L)', pg_temp.id(1)),
  'Marca a saída a equipe médica ou o gestor da origem', 'destino não marca a saída');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.regulacao_marcar_saida(pg_temp.id(1));
SELECT pg_temp.ok(pg_temp.campo(1, 'status') = 'em_transito' AND pg_temp.campo(1, 'saida_em') IS NOT NULL, 'origem marca a saída');
SELECT pg_temp.falha(format('SELECT public.regulacao_marcar_chegada(%L, true)', pg_temp.id(1)),
  'Marca a chegada a unidade destino', 'origem não marca a chegada');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.regulacao_marcar_chegada(pg_temp.id(1), true);
SELECT pg_temp.ok(pg_temp.campo(1, 'status') = 'realizada' AND pg_temp.campo(1, 'realizada_em') IS NOT NULL
              AND pg_temp.leito('24000000-0000-4000-8000-0000000009c1') = 'reservado',
  'chegou: realizada, e a reserva fica para ocupar o leito');

-- ── 6. recusa volta à central ───────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.regulacao_autorizar(pg_temp.id(2), 'rede', '21000000-0000-4000-8000-0000000009c2');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha(format('SELECT public.regulacao_destino_recusar(%L, %L, %L)', pg_temp.id(2), 'cansado', 'Sem tomógrafo funcionando hoje.'),
  'Motivo: sem leito ou vaga', 'motivo fora da lista');
SELECT pg_temp.falha(format('SELECT public.regulacao_destino_recusar(%L, %L, %L)', pg_temp.id(2), 'sem_recurso', 'curto'),
  'Escreva a justificativa', 'recusa pede texto');
SELECT public.regulacao_destino_recusar(pg_temp.id(2), 'sem_recurso', 'Tomógrafo em manutenção até amanhã.');
SELECT pg_temp.ok(pg_temp.campo(2, 'status') = 'em_analise' AND pg_temp.campo(2, 'destino_unidade_id') IS NULL
              AND pg_temp.campo(2, 'destino_tipo') = 'a_definir',
  'recusado pelo gestor do destino, volta à central para outro destino');
SELECT pg_temp.falha(format('SELECT public.regulacao_detalhe(%L)', pg_temp.id(2)), 'Solicitação não encontrada', 'destino que recusou deixa de ver o pedido');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok((public.regulacao_detalhe(pg_temp.id(2))->'ultima_recusa'->>'motivo') = 'sem_recurso'
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000006', 'reg_destino_recusou_') = 1,
  'central vê a recusa e é avisada');

-- ── 7. falta libera a reserva; cancelamento também ──────────────────────────
SELECT public.regulacao_autorizar(pg_temp.id(2), 'rede', '21000000-0000-4000-8000-0000000009c2');
SELECT public.regulacao_autorizar(pg_temp.id(4), 'rede', '21000000-0000-4000-8000-0000000009c2');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.regulacao_destino_aceitar(pg_temp.id(2));
SELECT pg_temp.falha(format('SELECT public.regulacao_marcar_chegada(%L, false)', pg_temp.id(2)), 'Escreva o que aconteceu', 'falta pede o que aconteceu');
SELECT public.regulacao_marcar_chegada(pg_temp.id(2), false, 'Paciente não compareceu até 18h.');
SELECT pg_temp.ok(pg_temp.campo(2, 'status') = 'falta' AND pg_temp.avisos('10000000-0000-4000-8000-000000000002', 'reg_nao_chegou_') = 1,
  'não chegou: falta, e a origem é avisada');
SELECT public.regulacao_destino_aceitar(pg_temp.id(4), '24000000-0000-4000-8000-0000000009c2');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.regulacao_cancelar(pg_temp.id(4), 'Paciente melhorou e teve alta.');
SELECT pg_temp.ok(pg_temp.campo(4, 'status') = 'cancelada' AND pg_temp.leito('24000000-0000-4000-8000-0000000009c2') = 'livre'
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000004', 'reg_cancelada_') = 1,
  'cancelado depois do aceite: leito liberado e destino avisado');

-- ── 8. destino fora da rede ─────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.regulacao_autorizar(pg_temp.id(3), 'externo', NULL, 'Hospital Estadual de Sumaré');
SELECT pg_temp.falha(format('SELECT public.regulacao_registrar_resposta_externa(%L, true, %L, %L)', pg_temp.id(3), '', 'telefone'),
  'Informe quem confirmou', 'resposta externa pede quem confirmou');
SELECT public.regulacao_registrar_resposta_externa(pg_temp.id(3), false, 'Dra. Plantonista do NIR', 'telefone', 'sem_vaga', 'Sem leito de UTI no momento.');
SELECT pg_temp.ok(pg_temp.campo(3, 'status') = 'em_analise', 'recusa do serviço de fora volta à central');
SELECT public.regulacao_autorizar(pg_temp.id(3), 'externo', NULL, 'Hospital Estadual de Sumaré');
SELECT public.regulacao_registrar_resposta_externa(pg_temp.id(3), true, 'Enf. Coordenadora do NIR', 'sistema_externo');
SELECT public.regulacao_marcar_chegada(pg_temp.id(3), true);
SELECT pg_temp.ok(pg_temp.campo(3, 'status') = 'realizada'
              AND (public.regulacao_detalhe(pg_temp.id(3))->'ultimo_aceite'->>'externo_meio') = 'sistema_externo',
  'serviço de fora: a central registra aceite e chegada');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.regulacao_marcar_chegada(%L, true)', pg_temp.id(3)), 'Marca a chegada a unidade destino',
  'médico de outra unidade não marca chegada do serviço de fora');

-- ── 9. prazo do destino ajustável ───────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_prazos('21000000-0000-4000-8000-0000000009c3', '{"destino_h":200}')$$,
  'Resposta do destino: de 1 a 168 horas', 'prazo do destino até 168 h');
SELECT pg_temp.ok((public.regulacao_definir_prazos('21000000-0000-4000-8000-0000000009c3', '{"destino_h":6}')->>'destino_h')::int = 6,
  'central ajusta o prazo do destino');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.regulacao_destino_respostas WHERE solicitacao_id IN (pg_temp.id(1), pg_temp.id(2), pg_temp.id(3))) = 5,
  'cada resposta do destino fica guardada');

ROLLBACK;
