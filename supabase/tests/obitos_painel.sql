-- Testes da migration 20270328000001_obitos_painel.sql (lacuna 10 do Portão
-- de 11/10/2026; decisão do RT em 10/11/2026: A em P1 a P8).
--  P1/P2. indicador_obitos: total, por origem, por setor, por tipo de morte e
--         encaminhamento, adulto ou pediátrico, menos de 24 h ou 24 h ou mais
--         desde a chegada; óbitos sobre saídas com numerador e denominador
--         (saídas de porta, observação e internação, sem dupla contagem);
--  P3.    lista com nome para o gestor; a consulta vai para a trilha só com a
--         quantidade, no máximo uma vez a cada 15 min; quem não é gestor não vê;
--  P4.    dia do plantão: óbito às 2h conta no dia anterior; filtro de setor;
--  P5.    painel_organizacao conta os óbitos da observação e da internação e
--         mantém a supressão de 1 a 4;
--  P6.    registro anterior (só desfecho ou status) entra uma vez, marcado;
--         óbito anulado (cancelar_alta) não conta;
--  privilégios: anon não executa; os auxiliares são internos.
-- Os óbitos novos saem das RPCs reais da lacuna 5; os registros anteriores
-- são gravados direto (como o app gravava antes). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- médico e enfermeira no PS, na Observação e na Clínica Médica; recepção no PS
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001'::uuid, s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004']::uuid[]) p,
       unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000001']::uuid[]) s
UNION ALL
SELECT '21000000-0000-4000-8000-000000000001'::uuid, '22000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000005'::uuid,
       private.data_atual(), 'manha', now() - interval '1 hour', 360;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo) VALUES
  ('22000000-0000-4000-8000-000000000001', 'OP1', 'clinico'),
  ('22000000-0000-4000-8000-000000000001', 'OP2', 'clinico'),
  ('22000000-0000-4000-8000-000000000001', 'OP3', 'clinico');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.j(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.d(p text) RETURNS date LANGUAGE sql AS $$ SELECT valor::date FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.j(text), pg_temp.d(text) TO authenticated, anon;
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
  RAISE EXCEPTION 'FALHOU: % (passou sem erro)', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated, anon;
-- o óbito do painel do admin para a unidade de teste
CREATE FUNCTION pg_temp.painel(p_dias int) RETURNS bigint LANGUAGE sql AS $$
  SELECT p.obitos_periodo FROM public.painel_organizacao(p_dias) p WHERE p.unidade_id = '21000000-0000-4000-8000-000000000001' $$;
GRANT EXECUTE ON FUNCTION pg_temp.painel(int) TO authenticated;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';
INSERT INTO t SELECT x, id::text FROM public.leitos, unnest(ARRAY['OP1', 'OP2', 'OP3']) x
 WHERE identificador = x AND setor_id = '22000000-0000-4000-8000-000000000001';
INSERT INTO t VALUES ('obito', '{"tipo_morte":"natural_assistida","atestado_condicao":"substituto","causa_a":"Infarto agudo do miocárdio"}');
-- o dia do plantão de agora e um dia 40 dias antes (fora dos 30 dias do painel)
INSERT INTO t VALUES ('hoje', private.dia_do_plantao(now())::text), ('d0', (private.dia_do_plantao(now()) - 40)::text);
-- setores
INSERT INTO t VALUES ('CM', '22000000-0000-4000-8000-000000000001'), ('OBS', '22000000-0000-4000-8000-000000000002'),
                     ('PS', '22000000-0000-4000-8000-000000000003');

-- ── cadastros ──────────────────────────────────────────────────────────────
-- P, Ped: óbito na porta; A: alta da porta; O: óbito na observação;
-- I1: óbito na internação (chegou há 3 dias); I3: óbito anulado (cancelar_alta);
-- L1: registro anterior da porta; L2: registro anterior da internação;
-- N1, N2: registros anteriores da porta, 40 dias atrás, às 2h e às 8h.
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep' || x, public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor no peito', NULL,
  json_build_object('nome', 'Paciente Painel ' || x, 'data_nascimento', (current_date - interval '70 years')::date)::jsonb) ->> 'episodio_id'
  FROM unnest(ARRAY['P', 'Ped', 'A', 'O', 'I1', 'I3', 'L1', 'L2', 'N1', 'N2']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep' || x), 'amarelo',
  '{"frequencia-cardiaca":110,"frequencia-respiratoria":22,"temperatura":36.8,"saturacao-o2":95,"escala-dor":6,"pressao-arterial-sistolica":100,"pressao-arterial-diastolica":60}',
  pg_temp.u('flx'), 'Edema de face')
  FROM unnest(ARRAY['P', 'Ped', 'O', 'I1', 'I3', 'L2']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep' || x)),
       public.registrar_soap(pg_temp.u('ep' || x), 'Dor no peito', 'Sudorese', 'Síndrome coronariana aguda', 'Monitorar', 'R60')
  FROM unnest(ARRAY['P', 'Ped', 'O', 'I1', 'I3', 'L2']) x;
SELECT public.registrar_desfecho(pg_temp.u('epO'), 'observacao');
SELECT public.registrar_desfecho(pg_temp.u('ep' || x), 'internacao', NULL, json_build_object('setor_id', pg_temp.u('CM'), 'leito_id', pg_temp.u(l))::jsonb)
  FROM (VALUES ('I1', 'OP1'), ('I3', 'OP2'), ('L2', 'OP3')) v(x, l);
RESET ROLE;
INSERT INTO t SELECT x, paciente_id::text FROM public.episodios e, unnest(ARRAY['P', 'Ped', 'A', 'O', 'I1', 'I3', 'L1', 'L2', 'N1', 'N2']) x
 WHERE e.id = pg_temp.u('ep' || x);
INSERT INTO t SELECT 'i' || x, i.id::text FROM public.internacoes i, unnest(ARRAY['O', 'I1', 'I3', 'L2']) x WHERE i.episodio_id = pg_temp.u('ep' || x);
-- a criança (5 anos) e a chegada de I1 há 3 dias
UPDATE public.pacientes SET data_nascimento = current_date - interval '5 years' WHERE id = pg_temp.u('Ped');
UPDATE public.episodios SET chegada_em = now() - interval '3 days' WHERE id = pg_temp.u('epI1');

-- ── óbitos pelas RPCs da lacuna 5 ──────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'numero_do', '300000001', 'cid_obito', 'I46.9', 'obito', pg_temp.j('obito'))::jsonb);
SELECT public.registrar_desfecho(pg_temp.u('epPed'), 'obito', 'Chegou após queda de altura, PCR na sala vermelha',
  json_build_object('hora_obito', now(), 'cid_obito', 'I46.9', 'obito', '{"tipo_morte":"violenta_ou_suspeita"}'::jsonb)::jsonb);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
-- P5: dois óbitos na unidade: o painel do admin suprime (1 a 4)
INSERT INTO t SELECT 'painel2', coalesce(pg_temp.painel(30)::text, 'nulo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.finalizar_observacao(pg_temp.u('iO'), 'obito', 'I46.9', 'Parada cardiorrespiratória sem resposta à RCP',
  json_build_object('numero_do', '300000002', 'hora_obito', now(), 'obito', pg_temp.j('obito'))::jsonb);
SELECT public.dar_alta(pg_temp.u('iI1'), 'obito', 'I46.9', NULL, NULL, 'Óbito na enfermaria após PCR',
  json_build_object('numero_do', '300000003', 'obito', pg_temp.j('obito'))::jsonb);
SELECT public.dar_alta(pg_temp.u('iI3'), 'obito', 'I46.9', NULL, NULL, 'Óbito na enfermaria após PCR',
  json_build_object('numero_do', '300000004', 'obito', pg_temp.j('obito'))::jsonb);
SELECT public.cancelar_alta(pg_temp.u('iI3'), 'Óbito registrado no paciente errado');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 4 FROM public.obitos o WHERE o.unidade_id = '21000000-0000-4000-8000-000000000001' AND o.anulado_em IS NULL)
  AND (SELECT count(*) = 1 FROM public.obitos o WHERE o.paciente_id = pg_temp.u('I3') AND o.anulado_em IS NOT NULL)
  AND (SELECT status = 'internado' FROM public.internacoes WHERE id = pg_temp.u('iI3')),
  'quatro óbitos vigentes pelas RPCs; o de I3 anulado e a internação de volta');

-- ── registros anteriores à lacuna 5 (só desfecho ou status) e a alta ───────
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'alta', desfecho_em = now(), encerrado_em = now() WHERE id = pg_temp.u('epA');
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'obito', desfecho_em = now(), encerrado_em = now(),
       desfecho_detalhes = jsonb_build_object('hora_obito', now(), 'numero_do', '123456', 'cid_obito', 'I46.9')
 WHERE id = pg_temp.u('epL1');
UPDATE public.internacoes SET status = 'obito', data_alta = now(), alta_detalhes = jsonb_build_object('hora_obito', now(), 'numero_do', '654321')
 WHERE id = pg_temp.u('iL2');
-- N1: chegou à 1h e morreu às 2h do dia d0 + 1 (plantão do dia d0); N2: às 8h do dia d0 + 1
UPDATE public.episodios e SET chegada_em = v.chegada, etapa = 'encerrado', desfecho = 'obito', desfecho_em = v.hora, encerrado_em = v.hora,
       desfecho_detalhes = jsonb_build_object('hora_obito', v.hora)
  FROM (VALUES ('N1', ((pg_temp.d('d0') + 1) + time '01:00') AT TIME ZONE 'America/Sao_Paulo', ((pg_temp.d('d0') + 1) + time '02:00') AT TIME ZONE 'America/Sao_Paulo'),
               ('N2', ((pg_temp.d('d0') + 1) + time '07:30') AT TIME ZONE 'America/Sao_Paulo', ((pg_temp.d('d0') + 1) + time '08:00') AT TIME ZONE 'America/Sao_Paulo')) v(x, chegada, hora)
 WHERE e.id = pg_temp.u('ep' || v.x);

-- ── P1/P2/P6: os números de hoje ───────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
-- P3: sem caso no período, nada vai para a trilha
INSERT INTO t SELECT 'vazio', public.indicador_obitos('21000000-0000-4000-8000-000000000001', pg_temp.d('d0') - 10, pg_temp.d('d0') - 10)::text;
INSERT INTO t SELECT 'r', public.indicador_obitos('21000000-0000-4000-8000-000000000001', pg_temp.d('hoje'), pg_temp.d('hoje'))::text;
INSERT INTO t SELECT 'r2', public.indicador_obitos('21000000-0000-4000-8000-000000000001', pg_temp.d('hoje'), pg_temp.d('hoje'))::text;
INSERT INTO t SELECT 'cm', public.indicador_obitos('21000000-0000-4000-8000-000000000001', pg_temp.d('hoje'), pg_temp.d('hoje'), pg_temp.u('CM'))::text;
INSERT INTO t SELECT 'n1', public.indicador_obitos('21000000-0000-4000-8000-000000000001', pg_temp.d('d0'), pg_temp.d('d0'))::text;
INSERT INTO t SELECT 'n2', public.indicador_obitos('21000000-0000-4000-8000-000000000001', pg_temp.d('d0') + 1, pg_temp.d('d0') + 1)::text;
INSERT INTO t SELECT 'n12', public.indicador_obitos('21000000-0000-4000-8000-000000000001', pg_temp.d('d0'), pg_temp.d('d0') + 1)::text;
RESET ROLE;

SELECT pg_temp.ok((pg_temp.j('vazio') ->> 'total')::int = 0 AND jsonb_array_length(pg_temp.j('vazio') -> 'casos') = 0
  AND pg_temp.j('vazio') -> 'obitos_sobre_saidas' = '{"numerador":0,"denominador":0,"percentual":null}',
  'período sem óbito: zero, sem percentual');
SELECT pg_temp.ok((pg_temp.j('r') ->> 'total')::int = 6, 'total de hoje: P, Ped, O, I1, L1 e L2 (I3 anulado fica fora)');
SELECT pg_temp.ok(pg_temp.j('r') -> 'por_origem' = '{"porta":3,"observacao":1,"internacao":2}', 'por origem: porta 3, observação 1, internação 2');
SELECT pg_temp.ok((pg_temp.j('r') ->> 'registro_anterior')::int = 2
  AND pg_temp.j('r') -> 'por_tipo' = '{"natural_assistida":3,"natural_sem_assistencia_ou_a_esclarecer":0,"violenta_ou_suspeita":1,"registro_anterior":2}',
  'P6: os registros anteriores entram uma vez, como "registro anterior" no tipo de morte');
SELECT pg_temp.ok(pg_temp.j('r') -> 'por_encaminhamento' = '{"unidade":3,"svo":0,"causa_desconhecida":0,"iml":1,"registro_anterior":2}',
  'por encaminhamento: unidade 3, IML 1, registro anterior 2');
SELECT pg_temp.ok(pg_temp.j('r') -> 'por_faixa' = '{"adulto":5,"pediatrico":1,"sem_data_nascimento":0}', 'adulto 5, pediátrico 1 (5 anos)');
SELECT pg_temp.ok(pg_temp.j('r') -> 'por_tempo' = '{"menos_de_24h":5,"de_24h_ou_mais":1,"sem_chegada":0}',
  'menos de 24 h desde a chegada: 5; 24 h ou mais: I1 (chegou há 3 dias)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('r') -> 'por_setor') s
                           WHERE (s ->> 'setor_id')::uuid = pg_temp.u('PS') AND (s ->> 'obitos')::int = 3)
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('r') -> 'por_setor') s
               WHERE (s ->> 'setor_id')::uuid = pg_temp.u('CM') AND (s ->> 'obitos')::int = 2 AND s ->> 'setor' = 'Clínica Médica')
  AND (SELECT sum((s ->> 'obitos')::int) = 6 FROM jsonb_array_elements(pg_temp.j('r') -> 'por_setor') s),
  'por setor do óbito: PS 3, Clínica Médica 2, observação 1');
SELECT pg_temp.ok(pg_temp.j('r') -> 'saidas' = '{"porta":4,"observacao":1,"internacao":2,"total":7}',
  'saídas: porta 4 (P, Ped, L1 e a alta A), observação 1, internação 2; quem foi para observação ou internação sai só por lá');
SELECT pg_temp.ok(pg_temp.j('r') -> 'obitos_sobre_saidas' = '{"numerador":6,"denominador":7,"percentual":85.7}',
  'óbitos sobre saídas: 6 de 7 (85,7%)');
SELECT pg_temp.ok((pg_temp.j('r') ->> 'total')::int = jsonb_array_length(pg_temp.j('r') -> 'casos')
  AND (SELECT count(*) = 2 FROM jsonb_array_elements(pg_temp.j('r') -> 'casos') c
        WHERE (c ->> 'registro_anterior')::boolean AND c ->> 'tipo_morte' IS NULL AND c ->> 'encaminhamento' IS NULL)
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('r') -> 'casos') c
               WHERE c ->> 'nome' = 'Paciente Painel Ped' AND c ->> 'faixa' = 'pediatrico' AND c ->> 'encaminhamento' = 'iml')
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('r') -> 'casos') c WHERE c ->> 'nome' = 'Paciente Painel I3'),
  'P3: a lista com nome traz os 6, marca o registro anterior e deixa o anulado de fora');
SELECT pg_temp.ok((pg_temp.j('cm') ->> 'total')::int = 2 AND pg_temp.j('cm') -> 'por_origem' = '{"porta":0,"observacao":0,"internacao":2}'
  AND pg_temp.j('cm') -> 'obitos_sobre_saidas' = '{"numerador":2,"denominador":2,"percentual":100.0}',
  'filtro do setor do óbito (Clínica Médica): 2 óbitos sobre 2 saídas do setor');

-- ── P4: dia do plantão ─────────────────────────────────────────────────────
SELECT pg_temp.ok((pg_temp.j('n1') ->> 'total')::int = 1 AND pg_temp.j('n1') -> 'por_dia' -> 0 ->> 'dia' = pg_temp.d('d0')::text
  AND pg_temp.j('n1') -> 'casos' -> 0 ->> 'nome' = 'Paciente Painel N1',
  'P4: o óbito às 2h conta no dia do plantão anterior');
SELECT pg_temp.ok((pg_temp.j('n2') ->> 'total')::int = 1 AND pg_temp.j('n2') -> 'casos' -> 0 ->> 'nome' = 'Paciente Painel N2',
  'P4: o óbito às 8h conta no próprio dia (o das 2h não)');
SELECT pg_temp.ok((pg_temp.j('n12') ->> 'total')::int = 2 AND jsonb_array_length(pg_temp.j('n12') -> 'por_dia') = 2
  AND pg_temp.j('n12') -> 'obitos_sobre_saidas' = '{"numerador":2,"denominador":2,"percentual":100.0}',
  'dois dias: um óbito em cada dia do plantão, saídas no mesmo recorte');

-- ── P3: trilha ─────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria a
                    WHERE a.acao = 'ver_obitos' AND a.ator_id = '10000000-0000-4000-8000-000000000001'
                      AND a.unidade_id = '21000000-0000-4000-8000-000000000001'),
  'P3: uma linha na trilha a cada 15 min, só quando a lista tem nome');
SELECT pg_temp.ok((SELECT a.payload = '{"quantidade":6}'::jsonb AND a.entidade = 'obitos' AND a.entidade_id IS NULL
                     FROM public.log_auditoria a WHERE a.acao = 'ver_obitos' AND a.ator_id = '10000000-0000-4000-8000-000000000001'),
  'P3: a trilha leva só a quantidade, sem nome nem id de paciente');

-- ── quem pode ──────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.indicador_obitos(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', pg_temp.d('hoje'), pg_temp.d('hoje')),
  'Acesso negado: indicador do gestor da unidade', 'o médico não vê o indicador');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.indicador_obitos(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', pg_temp.d('hoje'), pg_temp.d('hoje')),
  'Acesso negado: indicador do gestor da unidade', 'a recepção não vê o indicador');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.indicador_obitos(%L, %L, %L, %L)', '21000000-0000-4000-8000-000000000001', pg_temp.d('hoje'), pg_temp.d('hoje'), gen_random_uuid()),
  'Setor de outra unidade', 'setor de outra unidade é recusado');
SELECT pg_temp.falha(format('SELECT public.indicador_obitos(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', pg_temp.d('hoje'), pg_temp.d('hoje') - 1),
  'Período inválido', 'período invertido é recusado');
SELECT pg_temp.falha(format('SELECT public.indicador_obitos(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', pg_temp.d('hoje') - 400, pg_temp.d('hoje')),
  'Período de no máximo um ano', 'período de mais de um ano é recusado');

-- ── P5: painel do administrador ────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
INSERT INTO t SELECT 'painel30', coalesce(pg_temp.painel(30)::text, 'nulo');
INSERT INTO t SELECT 'painel90', coalesce(pg_temp.painel(90)::text, 'nulo');
RESET ROLE;
SELECT pg_temp.ok((SELECT valor = 'nulo' FROM t WHERE nome = 'painel2'), 'P5: com 2 óbitos, o painel do admin suprime (1 a 4)');
SELECT pg_temp.ok((SELECT valor = '6' FROM t WHERE nome = 'painel30'),
  'P5: o painel do admin conta os 6 de hoje, com observação, internação e registros anteriores (antes: só os 3 da porta, suprimidos)');
SELECT pg_temp.ok((SELECT valor = '8' FROM t WHERE nome = 'painel90'), 'P5: em 90 dias entram N1 e N2');

-- ── privilégios ────────────────────────────────────────────────────────────
SELECT pg_temp.ok(NOT has_function_privilege('anon', 'public.indicador_obitos(uuid, date, date, uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.indicador_obitos(uuid, date, date, uuid)', 'EXECUTE'), 'anon não executa indicador_obitos');
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE'), 'interno: ' || f)
  FROM unnest(ARRAY['private.obitos_no_periodo(uuid, timestamptz, timestamptz, uuid)', 'private.saidas_no_periodo(uuid, timestamptz, timestamptz, uuid)',
                    'private.obito_instante(text)']) f;
SELECT pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = f::regprocedure), 'SECURITY DEFINER com search_path vazio: ' || f)
  FROM unnest(ARRAY['public.indicador_obitos(uuid, date, date, uuid)', 'public.painel_organizacao(integer)']) f;
SELECT pg_temp.ok(private.obito_instante('não é hora') IS NULL AND private.obito_instante('2026-01-01T10:00:00Z') = '2026-01-01T10:00:00Z'::timestamptz,
  'hora inválida no jsonb antigo vira nulo (vale o encerramento)');

ROLLBACK;
