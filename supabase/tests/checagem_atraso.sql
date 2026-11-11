-- Testes da migration 20270331000001_checagem_atraso.sql (lacuna 9 do Portão
-- de 11/10/2026; decisão do RT em 10/11/2026: A em A1 a A9).
--  A1. janela de 2 h, ou o intervalo do item se menor; a mesma regra no painel
--      da enfermagem e no painel da porta; a trava da alta após medicação não
--      muda;
--  A2. o "feito" atrasado continua "feito", com atraso_min e atrasada gravados
--      pelo servidor (o valor de fora é ignorado); "não feito" leva o atraso
--      sem a marca;
--  A3. motivo da lista obrigatório no "feito" atrasado; "outro" pede texto;
--      a chamada antiga (sem o motivo) segue na dose sem atraso;
--  A4. job: omissão depois de 12 h, uma por horário, aviso ao enfermeiro e ao
--      médico, uma vez;
--  A5. dose atrasada: aviso ao enfermeiro uma vez; ciência só do enfermeiro,
--      uma vez; o médico não recebe aviso de atraso;
--  A6. fila_checagem com o atraso; atrasos_de_dose; indicador do gestor;
--  A8. vencido só "não feito"; dupla checagem de 2 h; horários seguintes iguais;
--  A9. "Agora", "Se necessário", contínuo, vasoativo e contenção fora;
--  privilégios, RLS e auditoria sem dado de pessoa.
-- Técnico de enfermagem: perfil criado aqui (o seed não tem). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE FUNCTION pg_temp.pesar() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
  SELECT p.unidade_id, p.id, c.id, now(), 70, 'manual'
    FROM public.pacientes p JOIN public.conceito c ON c.nome = 'peso' AND c.unidade_id IS NULL
   WHERE private.peso_do_atendimento(p.id) IS NULL $$;
GRANT EXECUTE ON FUNCTION pg_temp.pesar() TO authenticated;
-- técnico de enfermagem
INSERT INTO auth.users (id, email) VALUES ('10000000-0000-4000-8000-0000000000a7', 'tecnico.atraso@teste.local') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-0000000000a7', 'Técnico do Atraso') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-0000000000a7', '21000000-0000-4000-8000-000000000001', 'tecnico_enfermagem') ON CONFLICT DO NOTHING;
-- médico, enfermeira e técnico no PS e na Clínica Médica; recepção no PS
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-0000000000a7');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001'::uuid, s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-0000000000a7']::uuid[]) p,
       unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000001']::uuid[]) s
UNION ALL
SELECT '21000000-0000-4000-8000-000000000001'::uuid, '22000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000005'::uuid,
       private.data_atual(), 'manha', now() - interval '1 hour', 360;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.j(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.j(text) TO authenticated;
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
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated, anon;
-- horário HH:MM de Brasília a "agora + n minutos" e o instante desse horário
CREATE FUNCTION pg_temp.hm(n int) RETURNS text LANGUAGE sql AS $$
  SELECT to_char((now() + make_interval(mins => n)) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') $$;
GRANT EXECUTE ON FUNCTION pg_temp.hm(int) TO authenticated;
CREATE FUNCTION pg_temp.slot(n int) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT date_trunc('minute', now() + make_interval(mins => n)) $$;
-- item e checagem lidos como superusuário
CREATE FUNCTION pg_temp.it(p text) RETURNS public.prescricao_itens LANGUAGE sql AS $$
  SELECT * FROM public.prescricao_itens WHERE id = pg_temp.u(p) $$;
CREATE FUNCTION pg_temp.adm(p text) RETURNS public.administracoes LANGUAGE sql AS $$
  SELECT * FROM public.administracoes WHERE id = pg_temp.u(p) $$;
CREATE FUNCTION pg_temp.atraso(p text, n int) RETURNS public.doses_atrasadas LANGUAGE sql AS $$
  SELECT * FROM public.doses_atrasadas WHERE item_id = pg_temp.u(p) AND previsto_em = pg_temp.slot(n) $$;
CREATE FUNCTION pg_temp.avisos(p_tipo text, p_perfil uuid) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.notificacoes_plantonista WHERE tipo = p_tipo AND perfil_id = p_perfil $$;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

-- medicamentos do teste (um por item: a duplicidade do prescrever não pega);
-- a marca de vasoativo vem do nome (coluna calculada)
WITH novos AS (
  INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, fonte) VALUES
    ('Dipirona atraso', 'dipirona atraso', 'ampola (teste atraso)', '500 mg/mL', 'teste-atraso'),
    ('Cefalexina atraso', 'cefalexina atraso', 'cápsula (teste atraso)', '500 mg', 'teste-atraso'),
    ('Omeprazol atraso', 'omeprazol atraso', 'cápsula (teste atraso)', '20 mg', 'teste-atraso'),
    ('Ranitidina atraso', 'ranitidina atraso', 'ampola (teste atraso)', '25 mg/mL', 'teste-atraso'),
    ('Hidrocortisona atraso', 'hidrocortisona atraso', 'frasco (teste atraso)', '100 mg', 'teste-atraso'),
    ('Cetoprofeno atraso', 'cetoprofeno atraso', 'frasco (teste atraso)', '100 mg', 'teste-atraso'),
    ('Ondansetrona atraso', 'ondansetrona atraso', 'ampola (teste atraso)', '2 mg/mL', 'teste-atraso'),
    ('Paracetamol atraso', 'paracetamol atraso', 'comprimido (teste atraso)', '500 mg', 'teste-atraso'),
    ('Soro atraso', 'soro atraso', 'bolsa 500 mL (teste atraso)', '0,9%', 'teste-atraso'),
    ('Noradrenalina atraso', 'noradrenalina atraso', 'ampola (teste atraso)', '1 mg/mL', 'teste-atraso'),
    ('Amoxicilina atraso', 'amoxicilina atraso', 'cápsula (teste atraso)', '500 mg', 'teste-atraso')
  RETURNING id, principio_ativo_norm)
INSERT INTO t SELECT 'm_' || split_part(principio_ativo_norm, ' ', 1), id::text FROM novos;

-- ── paciente na porta, com o atendimento aberto ──────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor abdominal', NULL,
  json_build_object('nome', 'Paciente Atraso', 'data_nascimento', (current_date - interval '40 years')::date)::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":98,"frequencia-respiratoria":18,"temperatura":36.8,"saturacao-o2":97,"escala-dor":6,"pressao-arterial-sistolica":132,"pressao-arterial-diastolica":84}',
  pg_temp.u('flx'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep')),
       public.registrar_soap(pg_temp.u('ep'), 'Dor abdominal', 'Dor difusa', 'Dor abdominal a esclarecer', 'Analgesia e observação', 'R10.4');
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.pesar();
INSERT INTO t SELECT x.nome, public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u(x.med),
  'dose', '1 unidade', 'via', 'EV', 'posologia', x.pos, 'se_necessario', x.sn)::jsonb)
  FROM (VALUES ('i_dip', 'm_dipirona', '12/12h', false), ('i_cefa', 'm_cefalexina', '24/24h', false),
               ('i_ome', 'm_omeprazol', '24/24h', false), ('i_rani', 'm_ranitidina', '1/1h', false),
               ('i_hidro', 'm_hidrocortisona', '12/12h', false), ('i_ceto', 'm_cetoprofeno', '24/24h', false),
               ('i_agora', 'm_ondansetrona', 'Agora', false), ('i_sn', 'm_paracetamol', 'Se necessário', true),
               ('i_soro', 'm_soro', 'contínuo', false), ('i_vaso', 'm_noradrenalina', '6/6h', false),
               ('i_venc', 'm_amoxicilina', '8/8h', false)) x(nome, med, pos, sn);
INSERT INTO t SELECT 'i_cui', public.prescrever(pg_temp.u('pac'), '{"tipo":"cuidado","descricao":"Mudança de decúbito"}');
INSERT INTO t SELECT 'i_cont', public.prescrever(pg_temp.u('pac'),
  '{"tipo":"contencao","pontos":2,"periodo_h":4,"motivo":"Agitação com risco de queda do leito","criterios_retirada":"Paciente calmo e colaborativo por 30 min"}');
RESET ROLE;

-- prescritos há 14 h (o relógio da transação não anda); o 1/1h há 100 min.
-- Horários escolhidos para não haver outro horário vencido além dos do teste.
UPDATE public.prescricao_itens SET created_at = now() - interval '14 hours'
 WHERE id IN (SELECT valor::uuid FROM t WHERE nome LIKE 'i\_%' AND nome <> 'i_rani');
UPDATE public.prescricao_itens SET created_at = now() - interval '100 minutes' WHERE id = pg_temp.u('i_rani');
UPDATE public.prescricao_itens i SET horarios = x.h
  FROM (VALUES ('i_dip', ARRAY[pg_temp.hm(-180), pg_temp.hm(540)]), ('i_cefa', ARRAY[pg_temp.hm(-60)]),
               ('i_ome', ARRAY[pg_temp.hm(-300)]), ('i_hidro', ARRAY[pg_temp.hm(-240), pg_temp.hm(480)]),
               ('i_ceto', ARRAY[pg_temp.hm(-780)]), ('i_agora', ARRAY[pg_temp.hm(-180)]), ('i_sn', ARRAY[pg_temp.hm(-180)]),
               ('i_soro', ARRAY[pg_temp.hm(-180)]), ('i_vaso', ARRAY[pg_temp.hm(-780)]), ('i_venc', ARRAY[pg_temp.hm(-180)]),
               ('i_cui', ARRAY[pg_temp.hm(-240)]), ('i_cont', ARRAY[pg_temp.hm(-780)])) x(nome, h)
 WHERE i.id = pg_temp.u(x.nome);
UPDATE public.prescricao_itens SET horarios = ARRAY(SELECT pg_temp.hm(-90 + 60 * k) FROM generate_series(0, 23) k ORDER BY 1)
 WHERE id = pg_temp.u('i_rani');
UPDATE public.prescricao_itens SET valida_ate = now() - interval '1 minute' WHERE id = pg_temp.u('i_venc');

-- ── A1: janela, horário previsto e o que entra na regra ─────────────────────
SELECT pg_temp.ok(private.janela_atraso(ARRAY['08:00']) = interval '2 hours'
  AND private.janela_atraso(ARRAY['00:00', '06:00', '12:00', '18:00']) = interval '2 hours'
  AND private.janela_atraso(ARRAY['08:00', '09:00', '10:00']) = interval '1 hour'
  AND private.janela_atraso(ARRAY['23:30', '00:15']) = interval '45 minutes'
  AND private.janela_atraso(ARRAY['08:00', '08:00', 'xx']) = interval '2 hours',
  'janela: 2 h, ou o menor intervalo entre horários (dando a volta no dia)');
SELECT pg_temp.ok(private.horario_previsto('08:00', '2026-11-10 10:00-03') = '2026-11-10 08:00-03'
  AND private.horario_previsto('08:00', '2026-11-10 06:30-03') = '2026-11-10 08:00-03'
  AND private.horario_previsto('08:00', '2026-11-10 05:00-03') = '2026-11-09 08:00-03'
  AND private.horario_previsto('00:30', '2026-11-10 23:30-03') = '2026-11-11 00:30-03'
  AND private.horario_previsto('25:00', '2026-11-10 10:00-03') IS NULL,
  'horário previsto: de 2 h antes a 22 h depois (como a dose por horário da porta)');
SELECT pg_temp.ok(private.referencia_atraso('2026-11-10 08:00-03', '2026-11-10 07:00-03') = '2026-11-10 08:00-03'
  AND private.referencia_atraso('2026-11-10 08:00-03', '2026-11-10 14:20:30-03') = '2026-11-10 14:20-03',
  'o atraso conta da prescrição quando o horário é anterior a ela');
SELECT pg_temp.ok(private.duracao_texto(interval '190 minutes') = '3 h 10 min' AND private.duracao_texto(interval '45 minutes') = '45 min'
  AND private.duracao_texto(interval '2 hours') = '2 h', 'duração em texto');
SELECT pg_temp.ok(private.item_conta_atraso(pg_temp.it('i_dip')) AND private.item_conta_atraso(pg_temp.it('i_rani'))
  AND private.item_conta_atraso(pg_temp.it('i_cui')),
  'medicamento aprazado e cuidado aprazado entram na regra');
SELECT pg_temp.ok(NOT private.item_conta_atraso(pg_temp.it('i_agora')) AND NOT private.item_conta_atraso(pg_temp.it('i_sn'))
  AND NOT private.item_conta_atraso(pg_temp.it('i_soro')) AND NOT private.item_conta_atraso(pg_temp.it('i_vaso'))
  AND NOT private.item_conta_atraso(pg_temp.it('i_cont')),
  'A9: "Agora", "Se necessário", contínuo, vasoativo e contenção ficam fora');
DO $$
DECLARE a public.prescricao_itens := pg_temp.it('i_dip'); b public.prescricao_itens := pg_temp.it('i_dip');
BEGIN
  a.posologia := 'BIC a 10 mL/h';
  b.horarios := NULL;
  PERFORM pg_temp.ok(NOT private.item_conta_atraso(a) AND NOT private.item_conta_atraso(b), 'infusão em bomba (BIC) e item sem horário ficam fora');
END $$;

-- ── A1: painéis antes da checagem ───────────────────────────────────────────
INSERT INTO t SELECT 'painel1', (SELECT jsonb_agg(jsonb_build_array(a.item_id, a.horario) ORDER BY a.item_id, a.horario)
                                   FROM private.aprazamentos_atrasados(ARRAY[pg_temp.u('pac')]) a)::text;
SELECT pg_temp.ok(pg_temp.j('painel1') = (SELECT jsonb_agg(jsonb_build_array(pg_temp.u(x.n), pg_temp.hm(x.m)) ORDER BY pg_temp.u(x.n), pg_temp.hm(x.m))
                                            FROM (VALUES ('i_dip', -180), ('i_ome', -300), ('i_rani', -90), ('i_hidro', -240),
                                                         ('i_cui', -240), ('i_venc', -180)) x(n, m)),
  'painel da enfermagem: só o que passou da janela (o 1/1h com 90 min sim, com 30 min não; o 24/24h com 1 h não; contínuo, vasoativo e contenção fora; 13 h fora)');
SELECT pg_temp.ok((SELECT situacao FROM private.doses_do_item(pg_temp.u('i_rani')) WHERE previsto_em = pg_temp.slot(-90)) = 'atrasada'
  AND (SELECT situacao FROM private.doses_do_item(pg_temp.u('i_rani')) WHERE previsto_em = pg_temp.slot(-30)) = 'pendente'
  AND (SELECT situacao FROM private.doses_do_item(pg_temp.u('i_cefa')) WHERE previsto_em = pg_temp.slot(-60)) = 'pendente'
  AND (SELECT situacao FROM private.doses_do_item(pg_temp.u('i_dip')) WHERE previsto_em = pg_temp.slot(-180)) = 'atrasada'
  AND (SELECT situacao FROM private.doses_do_item(pg_temp.u('i_soro')) WHERE previsto_em = pg_temp.slot(-180)) = 'pendente',
  'painel da porta: "atrasada" só depois da janela; antes, "pendente"; contínuo nunca atrasa');
SELECT pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest(private.medicacao_sem_checagem(pg_temp.u('ep'))) x)
                  @> ARRAY[(pg_temp.it('i_rani')).descricao, (pg_temp.it('i_cefa')).descricao],
  'trava da alta após medicação igual: dose com horário passado ainda dentro da janela continua pendente para a alta');

-- ── A2/A3: checagem no horário e atrasada ───────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
-- a chamada antiga (sem o motivo do atraso) segue na dose sem atraso
INSERT INTO t SELECT 'adm_cefa', public.checar(pg_temp.u('i_cefa'), 'feito', pg_temp.hm(-60))::text;
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, %L)', pg_temp.u('i_dip'), 'feito', pg_temp.hm(-180)),
  'Dose atrasada: 3 h', 'feito 3 h depois sem motivo é recusado');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, %L, NULL, %L)', pg_temp.u('i_dip'), 'feito', pg_temp.hm(-180), 'qualquer'),
  'Dose atrasada', 'motivo fora da lista é recusado');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, %L, NULL, %L, %L)', pg_temp.u('i_dip'), 'feito', pg_temp.hm(-180), 'outro', 'abc'),
  'Motivo do atraso "outro"', '"outro" pede texto de 5 letras');
INSERT INTO t SELECT 'adm_dip', public.checar(p_item => pg_temp.u('i_dip'), p_situacao => 'feito', p_horario => pg_temp.hm(-180),
  p_motivo_atraso => 'falta_medicamento')::text;
-- 1/1h: 90 min passa da janela de 1 h (com 2 h não passaria); 30 min não
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, %L)', pg_temp.u('i_rani'), 'feito', pg_temp.hm(-90)),
  'Dose atrasada: 1 h 3_ min depois do horário das ' || pg_temp.hm(-90) || ' (tolerância de 1 h)', 'item 1/1h: a janela é o intervalo (1 h)');
INSERT INTO t SELECT 'adm_rani90', public.checar(pg_temp.u('i_rani'), 'feito', pg_temp.hm(-90), NULL, 'outro', 'Paciente dormindo, família pediu')::text;
INSERT INTO t SELECT 'adm_rani30', public.checar(pg_temp.u('i_rani'), 'feito', pg_temp.hm(-30), NULL, 'intercorrencia')::text;
-- "não feito" atrasado: grava o atraso, sem a marca e sem pedir o motivo do atraso
INSERT INTO t SELECT 'adm_ome', public.checar(pg_temp.u('i_ome'), 'nao_feito', pg_temp.hm(-300), 'Paciente em jejum para exame')::text;
-- A9: fora da regra, o "feito" não pede motivo
INSERT INTO t SELECT 'adm_agora', public.checar(pg_temp.u('i_agora'), 'feito', pg_temp.hm(-180))::text;
INSERT INTO t SELECT 'adm_sn', public.checar(pg_temp.u('i_sn'), 'feito', pg_temp.hm(-180))::text;
INSERT INTO t SELECT 'adm_soro', public.checar(pg_temp.u('i_soro'), 'feito', pg_temp.hm(-180))::text;
-- A8: vencido segue só com "não feito", mesmo com o motivo do atraso
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, %L, NULL, %L)', pg_temp.u('i_venc'), 'feito', pg_temp.hm(-180), 'falta_medicamento'),
  'Prescrição vencida às', 'A8: item vencido não aceita "feito" atrasado');
INSERT INTO t SELECT 'adm_venc', public.checar(pg_temp.u('i_venc'), 'nao_feito', pg_temp.hm(-180), 'Prescrição vencida, renovação pedida')::text;
INSERT INTO t SELECT 'fila', (SELECT por_horario::text FROM public.fila_checagem() WHERE item_id = pg_temp.u('i_dip'));
-- o técnico checa, mas não dá ciência
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000a7');
INSERT INTO t SELECT 'adm_tec', public.checar(pg_temp.u('i_cefa'), 'feito', pg_temp.hm(-60))::text;
RESET ROLE;

SELECT pg_temp.ok((pg_temp.adm('adm_cefa')).situacao = 'feito' AND NOT (pg_temp.adm('adm_cefa')).atrasada
  AND (pg_temp.adm('adm_cefa')).atraso_min BETWEEN 60 AND 62 AND (pg_temp.adm('adm_cefa')).previsto_em = pg_temp.slot(-60)
  AND (pg_temp.adm('adm_cefa')).motivo_atraso IS NULL AND (pg_temp.adm('adm_cefa')).setor_id = '22000000-0000-4000-8000-000000000003',
  'no horário (1 h depois, dentro das 2 h): feito sem a marca, com o atraso e o setor gravados');
SELECT pg_temp.ok((pg_temp.adm('adm_dip')).situacao = 'feito' AND (pg_temp.adm('adm_dip')).atrasada
  AND (pg_temp.adm('adm_dip')).atraso_min BETWEEN 180 AND 182 AND (pg_temp.adm('adm_dip')).previsto_em = pg_temp.slot(-180)
  AND (pg_temp.adm('adm_dip')).motivo_atraso = 'falta_medicamento' AND (pg_temp.adm('adm_dip')).motivo_atraso_texto IS NULL,
  'A2: atrasado continua "feito", com atraso_min, a marca e o motivo');
SELECT pg_temp.ok((pg_temp.adm('adm_rani90')).atrasada AND (pg_temp.adm('adm_rani90')).motivo_atraso = 'outro'
  AND (pg_temp.adm('adm_rani90')).motivo_atraso_texto = 'Paciente dormindo, família pediu'
  AND NOT (pg_temp.adm('adm_rani30')).atrasada AND (pg_temp.adm('adm_rani30')).motivo_atraso IS NULL,
  '"outro" com texto; motivo mandado na dose sem atraso não se grava');
SELECT pg_temp.ok((pg_temp.adm('adm_ome')).situacao = 'nao_feito' AND NOT (pg_temp.adm('adm_ome')).atrasada
  AND (pg_temp.adm('adm_ome')).atraso_min BETWEEN 300 AND 302,
  '"não feito" atrasado: atraso gravado, sem a marca de dose atrasada');
SELECT pg_temp.ok(NOT (pg_temp.adm('adm_agora')).atrasada AND NOT (pg_temp.adm('adm_sn')).atrasada AND (pg_temp.adm('adm_sn')).previsto_em IS NULL
  AND NOT (pg_temp.adm('adm_soro')).atrasada AND (pg_temp.adm('adm_soro')).atraso_min BETWEEN 180 AND 182,
  'A9: "Agora", "Se necessário" e contínuo não ficam atrasados');
SELECT pg_temp.ok((pg_temp.adm('adm_venc')).situacao = 'nao_feito', 'A8: o vencido aceita "não feito"');
SELECT pg_temp.ok((pg_temp.j('fila') -> pg_temp.hm(-180) ->> 'atrasada')::boolean
  AND pg_temp.j('fila') -> pg_temp.hm(-180) ->> 'motivo_atraso' = 'falta_medicamento'
  AND (pg_temp.j('fila') -> pg_temp.hm(-180) ->> 'atraso_min')::int BETWEEN 180 AND 182
  AND (pg_temp.j('fila') -> pg_temp.hm(-180) ->> 'previsto_em')::timestamptz = pg_temp.slot(-180),
  'A6: a fila da checagem leva o atraso de cada horário');
-- o servidor calcula: o que vem de fora é ignorado
INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, horario_previsto, situacao, registrado_por,
                                   previsto_em, atraso_min, atrasada, motivo_atraso, setor_id)
VALUES (pg_temp.u('i_cefa'), pg_temp.u('pac'), '21000000-0000-4000-8000-000000000001', pg_temp.hm(-60), 'feito',
        '10000000-0000-4000-8000-000000000004', now() + interval '10 days', 999, true, 'outro', '22000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'adm_forjada', id::text FROM public.administracoes WHERE item_id = pg_temp.u('i_cefa') AND atraso_min IS NOT NULL
  ORDER BY registrado_em DESC LIMIT 1;
SELECT pg_temp.ok((pg_temp.adm('adm_forjada')).atraso_min BETWEEN 60 AND 62 AND NOT (pg_temp.adm('adm_forjada')).atrasada
  AND (pg_temp.adm('adm_forjada')).motivo_atraso IS NULL AND (pg_temp.adm('adm_forjada')).previsto_em = pg_temp.slot(-60)
  AND (pg_temp.adm('adm_forjada')).setor_id = '22000000-0000-4000-8000-000000000003',
  'A2: atraso, marca, motivo, horário previsto e setor são do servidor');

-- ── A5: dose atrasada pela checagem ─────────────────────────────────────────
SELECT pg_temp.ok((pg_temp.atraso('i_dip', -180)).origem = 'checagem' AND (pg_temp.atraso('i_rani', -90)).origem = 'checagem'
  AND (pg_temp.atraso('i_dip', -180)).ciente_em IS NULL AND (pg_temp.atraso('i_dip', -180)).setor_id = '22000000-0000-4000-8000-000000000003'
  AND (SELECT count(*) FROM public.doses_atrasadas WHERE item_id IN (pg_temp.u('i_cefa'), pg_temp.u('i_ome'), pg_temp.u('i_soro'),
                                                                     pg_temp.u('i_sn'), pg_temp.u('i_agora'))) = 0
  AND (SELECT count(*) FROM public.doses_atrasadas WHERE item_id = pg_temp.u('i_rani')) = 1,
  'o "feito" atrasado vira dose atrasada (só ele)');
SELECT pg_temp.ok(pg_temp.avisos('dose_atrasada_' || (pg_temp.atraso('i_dip', -180)).id, '10000000-0000-4000-8000-000000000004') = 1
  AND pg_temp.avisos('dose_atrasada_' || (pg_temp.atraso('i_dip', -180)).id, '10000000-0000-4000-8000-000000000002') = 0
  AND pg_temp.avisos('dose_atrasada_' || (pg_temp.atraso('i_dip', -180)).id, '10000000-0000-4000-8000-0000000000a7') = 0
  AND (SELECT mensagem LIKE 'Dose atrasada: Dipirona atraso%falta do medicamento%Anexo 03, item IV%'
         FROM public.notificacoes_plantonista WHERE tipo = 'dose_atrasada_' || (pg_temp.atraso('i_dip', -180)).id),
  'A5: o enfermeiro do setor recebe o aviso (o médico e o técnico não)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'dose_atrasada_registrada' AND entidade_id = pg_temp.u('adm_dip')
                            AND payload ->> 'motivo_codigo' = 'falta_medicamento' AND (payload ->> 'quantidade')::int BETWEEN 180 AND 182),
  'auditoria da dose atrasada com o motivo e os minutos');

-- ── A7/A4: o job ────────────────────────────────────────────────────────────
INSERT INTO t SELECT 'job1', private.checagem_atraso_job()::text;
SELECT pg_temp.ok((pg_temp.atraso('i_hidro', -240)).origem = 'janela' AND (pg_temp.atraso('i_cui', -240)).origem = 'janela'
  AND (SELECT count(*) FROM public.doses_atrasadas WHERE item_id IN (pg_temp.u('i_ome'), pg_temp.u('i_venc'), pg_temp.u('i_cefa'),
                                                                     pg_temp.u('i_vaso'), pg_temp.u('i_cont'), pg_temp.u('i_ceto'))) = 0,
  'A7: horário sem checagem depois da janela vira dose atrasada (só os que não foram checados)');
SELECT pg_temp.ok((SELECT count(*) FROM public.omissoes_dose WHERE item_id = pg_temp.u('i_ceto') AND previsto_em = pg_temp.slot(-780)) = 1
  AND (SELECT count(*) FROM public.omissoes_dose WHERE paciente_id = pg_temp.u('pac')) = 1,
  'A4: 13 h sem checagem vira omissão, uma; vasoativo e contenção fora');
INSERT INTO t SELECT 'omi', id::text FROM public.omissoes_dose WHERE item_id = pg_temp.u('i_ceto');
SELECT pg_temp.ok(pg_temp.avisos('dose_omitida_' || pg_temp.u('omi'), '10000000-0000-4000-8000-000000000004') = 1
  AND pg_temp.avisos('dose_omitida_' || pg_temp.u('omi'), '10000000-0000-4000-8000-000000000002') = 1
  AND (SELECT mensagem LIKE 'Dose omitida: Cetoprofeno atraso%passou de 12 h sem checagem (Portaria MS 2.095/2013, Anexo 03, item 7.2).'
         FROM public.notificacoes_plantonista WHERE tipo = 'dose_omitida_' || pg_temp.u('omi') LIMIT 1),
  'A4: a omissão avisa o enfermeiro e o médico de plantão do setor');
SELECT pg_temp.ok(pg_temp.avisos('dose_atrasada_' || (pg_temp.atraso('i_hidro', -240)).id, '10000000-0000-4000-8000-000000000004') = 1
  AND pg_temp.avisos('dose_atrasada_' || (pg_temp.atraso('i_hidro', -240)).id, '10000000-0000-4000-8000-000000000002') = 0
  AND (SELECT mensagem LIKE '%sem checagem depois da tolerância%' FROM public.notificacoes_plantonista
        WHERE tipo = 'dose_atrasada_' || (pg_temp.atraso('i_hidro', -240)).id),
  'A5/A7: dose atrasada sem checagem avisa o enfermeiro, não o médico');
INSERT INTO t SELECT 'n_avisos', (SELECT count(*) FROM public.notificacoes_plantonista WHERE tipo LIKE 'dose\_%')::text;
INSERT INTO t SELECT 'job2', private.checagem_atraso_job()::text;
SELECT pg_temp.ok((SELECT valor::int FROM t WHERE nome = 'job2') = 0
  AND (SELECT count(*) FROM public.notificacoes_plantonista WHERE tipo LIKE 'dose\_%') = (SELECT valor::bigint FROM t WHERE nome = 'n_avisos')
  AND (SELECT count(*) FROM public.omissoes_dose WHERE paciente_id = pg_temp.u('pac')) = 1
  AND (SELECT count(*) FROM public.doses_atrasadas WHERE paciente_id = pg_temp.u('pac')) = 4,
  'job de novo: nada se repete (um registro e um aviso por item e horário)');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM cron.job WHERE jobname = 'checagem-atraso' AND schedule = '*/15 * * * *'),
  'A7: job a cada 15 min');

-- ── A1: painéis depois da checagem ──────────────────────────────────────────
SELECT pg_temp.ok((SELECT jsonb_agg(jsonb_build_array(a.item_id, a.horario) ORDER BY a.item_id, a.horario)
                     FROM private.aprazamentos_atrasados(ARRAY[pg_temp.u('pac')]) a)
                  = (SELECT jsonb_agg(jsonb_build_array(pg_temp.u(x.n), pg_temp.hm(x.m)) ORDER BY pg_temp.u(x.n), pg_temp.hm(x.m))
                       FROM (VALUES ('i_hidro', -240), ('i_cui', -240)) x(n, m)),
  'painel da enfermagem: a checagem resolve o atraso (feito ou não feito)');
-- A8: a dose atrasada não muda os horários seguintes
SELECT pg_temp.ok((pg_temp.it('i_dip')).horarios = ARRAY[pg_temp.hm(-180), pg_temp.hm(540)]
  AND EXISTS (SELECT 1 FROM private.doses_do_item(pg_temp.u('i_dip')) d WHERE d.previsto_em = pg_temp.slot(540) AND d.situacao = 'pendente'),
  'A8: o horário seguinte fica onde estava');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = 'public.checar(uuid, text, text, text, text, text)'::regprocedure
                            AND pg_get_functiondef(p.oid) LIKE '%primeiro_em > now() - interval ''2 hours''%'),
  'A8: a dupla checagem continua valendo 2 h');

-- ── A5: ciência ─────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.dar_ciencia_atraso(%L)', (pg_temp.atraso('i_dip', -180)).id),
  'A ciência da dose atrasada é do enfermeiro', 'médico não dá ciência');
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000a7');
SELECT pg_temp.falha(format('SELECT public.dar_ciencia_atraso(%L)', (pg_temp.atraso('i_dip', -180)).id),
  'A ciência da dose atrasada é do enfermeiro', 'técnico não dá ciência');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'ci1', public.dar_ciencia_atraso((pg_temp.atraso('i_dip', -180)).id)::text;
INSERT INTO t SELECT 'ci2', public.dar_ciencia_atraso((pg_temp.atraso('i_dip', -180)).id)::text;
SELECT pg_temp.falha(format('UPDATE public.doses_atrasadas SET ciente_em = now() WHERE id = %L', (pg_temp.atraso('i_hidro', -240)).id),
  'permission denied', 'a ciência não se grava direto pela API');
SELECT pg_temp.falha(format('INSERT INTO public.omissoes_dose (item_id, paciente_id, unidade_id, horario, previsto_em) VALUES (%L, %L, %L, %L, now())',
  pg_temp.u('i_dip'), pg_temp.u('pac'), '21000000-0000-4000-8000-000000000001', '08:00'),
  'permission denied', 'omissão não se grava direto pela API');
INSERT INTO t SELECT 'lista_enf', public.atrasos_de_dose(ARRAY[pg_temp.u('i_dip'), pg_temp.u('i_hidro'), pg_temp.u('i_ceto')])::text;
INSERT INTO t SELECT 'rls_enf', (SELECT count(*) FROM public.doses_atrasadas WHERE paciente_id = pg_temp.u('pac'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'lista_rec', public.atrasos_de_dose(ARRAY[pg_temp.u('i_dip'), pg_temp.u('i_hidro')])::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'rls_fora', ((SELECT count(*) FROM public.doses_atrasadas WHERE paciente_id = pg_temp.u('pac'))
                                 + (SELECT count(*) FROM public.omissoes_dose WHERE paciente_id = pg_temp.u('pac')))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'rls_gestor', ((SELECT count(*) FROM public.doses_atrasadas WHERE paciente_id = pg_temp.u('pac'))
                                   + (SELECT count(*) FROM public.omissoes_dose WHERE paciente_id = pg_temp.u('pac')))::text;
RESET ROLE;
SELECT pg_temp.ok((pg_temp.atraso('i_dip', -180)).ciente_por = '10000000-0000-4000-8000-000000000004'
  AND (pg_temp.atraso('i_dip', -180)).ciente_em = now()
  AND NOT (pg_temp.j('ci1') ->> 'ja_estava')::boolean AND (pg_temp.j('ci2') ->> 'ja_estava')::boolean
  AND pg_temp.j('ci2') ->> 'ciente_em' = pg_temp.j('ci1') ->> 'ciente_em' AND pg_temp.j('ci1') ->> 'ciente_por' = 'Enfermeira de Teste',
  'A5: ciência do enfermeiro grava quem e quando, uma vez');
SELECT pg_temp.falha(format('UPDATE public.doses_atrasadas SET ciente_em = now() - interval ''1 hour'' WHERE id = %L', (pg_temp.atraso('i_dip', -180)).id),
  'Dose atrasada: só se registra a ciência, uma vez', 'ciência não muda depois de dada');
SELECT pg_temp.falha(format('UPDATE public.doses_atrasadas SET horario = %L, ciente_em = now(), ciente_por = %L WHERE id = %L', '00:00',
  '10000000-0000-4000-8000-000000000004', (pg_temp.atraso('i_hidro', -240)).id),
  'Dose atrasada: só se registra a ciência, uma vez', 'só a ciência muda');
SELECT pg_temp.falha(format('DELETE FROM public.doses_atrasadas WHERE id = %L', (pg_temp.atraso('i_hidro', -240)).id),
  'Dose atrasada não se apaga', 'dose atrasada não se apaga');
SELECT pg_temp.falha(format('UPDATE public.omissoes_dose SET horario = %L WHERE id = %L', '00:00', pg_temp.u('omi')),
  'omissoes_dose é só de inserção', 'omissão é só de inserção');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'ciencia_dose_atrasada'
                            AND entidade_id = (pg_temp.atraso('i_dip', -180)).id AND payload ->> 'tipo' = 'checagem')
  AND NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao IN ('ciencia_dose_atrasada', 'dose_atrasada_registrada')
                    AND (payload::text LIKE '%Paciente Atraso%' OR payload ? 'paciente_id' OR payload::text LIKE '%Dipirona%'
                         OR payload::text LIKE '%dormindo%')),
  'auditoria da ciência e do atraso, sem dado de pessoa');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.j('lista_enf')) = 2
  AND (SELECT x ->> 'motivo_atraso' = 'falta_medicamento' AND x ->> 'ciente_por' = 'Enfermeira de Teste' AND x ->> 'origem' = 'checagem'
              AND (x ->> 'atraso_min')::int BETWEEN 180 AND 182 AND x ->> 'feito_em' IS NOT NULL
         FROM jsonb_array_elements(pg_temp.j('lista_enf')) x WHERE (x ->> 'item_id')::uuid = pg_temp.u('i_dip'))
  AND (SELECT x ->> 'origem' = 'janela' AND x ->> 'feito_em' IS NULL AND x ->> 'ciente_em' IS NULL AND NOT (x ->> 'omitida')::boolean
         FROM jsonb_array_elements(pg_temp.j('lista_enf')) x WHERE (x ->> 'item_id')::uuid = pg_temp.u('i_hidro')),
  'A6: atrasos_de_dose lista as doses atrasadas com o desfecho e a ciência');
SELECT pg_temp.ok(pg_temp.j('lista_rec') = '[]'::jsonb, 'recepção não lê as doses atrasadas');
SELECT pg_temp.ok((SELECT valor::int FROM t WHERE nome = 'rls_enf') = 4 AND (SELECT valor::int FROM t WHERE nome = 'rls_fora') = 0
  AND (SELECT valor::int FROM t WHERE nome = 'rls_gestor') = 5,
  'RLS: enfermagem com o paciente e gestor leem; quem não está com o paciente, não');

-- ── A6: indicador do gestor ────────────────────────────────────────────────
INSERT INTO t VALUES ('hoje', ((now() AT TIME ZONE 'America/Sao_Paulo')::date)::text);
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.indicador_atraso_checagem(%L, %L, %L)', '21000000-0000-4000-8000-000000000001',
  (SELECT valor::date - 1 FROM t WHERE nome = 'hoje'), (SELECT valor FROM t WHERE nome = 'hoje')),
  'Acesso negado: indicador do gestor', 'indicador só do gestor');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'ind', public.indicador_atraso_checagem('21000000-0000-4000-8000-000000000001',
  (SELECT valor::date - 1 FROM t WHERE nome = 'hoje'), (SELECT valor::date FROM t WHERE nome = 'hoje'))::text;
SELECT pg_temp.falha(format('SELECT public.indicador_atraso_checagem(%L, %L, %L)', '21000000-0000-4000-8000-000000000001',
  '2026-01-01', '2027-06-01'), 'Período de no máximo um ano', 'período de no máximo um ano');
RESET ROLE;
-- medicamento na regra: cefalexina (no horário), dipirona (atrasada), omeprazol (não feito),
-- ranitidina 90 min (atrasada) e 30 min (no horário), amoxicilina vencida (não feito),
-- cetoprofeno (omissão). Fora: "Agora", "Se necessário", contínuo, vasoativo,
-- contenção, cuidado e a hidrocortisona ainda sem desfecho (atrasada, sem omissão).
SELECT pg_temp.ok((pg_temp.j('ind') -> 'total') = '{"previstas": 7, "feitas": 4, "atrasadas": 2, "omissoes": 1}'::jsonb,
  'A6: indicador: 7 doses previstas, 4 feitas, 2 com atraso, 1 omissão (' || (pg_temp.j('ind') ->> 'total') || ')');
SELECT pg_temp.ok((SELECT sum((l ->> 'previstas')::int) = 7 AND sum((l ->> 'omissoes')::int) = 1 AND bool_and(l ->> 'setor' = 'Pronto Socorro')
                     AND bool_and(l ->> 'mes' ~ '^\d{4}-\d{2}$')
                     FROM jsonb_array_elements(pg_temp.j('ind') -> 'linhas') l),
  'A6: linhas por mês e por setor, com numerador e denominador');

-- ── privilégios ────────────────────────────────────────────────────────────
SELECT pg_temp.ok(to_regprocedure('public.checar(uuid, text, text, text)') IS NULL, 'a assinatura antiga de checar saiu (sem ambiguidade no PostgREST)');
SELECT pg_temp.ok(NOT has_function_privilege('anon', f, 'EXECUTE') AND has_function_privilege('authenticated', f, 'EXECUTE'), 'anon não executa ' || f)
  FROM unnest(ARRAY['public.checar(uuid, text, text, text, text, text)', 'public.dar_ciencia_atraso(uuid)', 'public.atrasos_de_dose(uuid[])',
                    'public.indicador_atraso_checagem(uuid, date, date)', 'public.fila_checagem()']) f;
SELECT pg_temp.ok(has_function_privilege('service_role', 'public.checar(uuid, text, text, text, text, text)', 'EXECUTE'),
  'service_role continua executando checar');
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', f, 'EXECUTE'), 'authenticated não executa ' || f)
  FROM unnest(ARRAY['private.checagem_atraso_job()', 'private.janela_atraso(text[])', 'private.horario_previsto(text, timestamptz)',
                    'private.item_conta_atraso(public.prescricao_itens)', 'private.registrar_dose_atrasada(uuid, text, timestamptz, text)',
                    'private.registrar_omissao_dose(uuid, text, timestamptz)', 'private.avisar_dose_atrasada(uuid)',
                    'private.avisar_omissao_dose(uuid)', 'private.administracao_atraso()']) f;
SELECT pg_temp.ok(NOT has_table_privilege('anon', 'public.doses_atrasadas', 'SELECT') AND NOT has_table_privilege('anon', 'public.omissoes_dose', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.doses_atrasadas', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.omissoes_dose', 'DELETE'),
  'tabelas novas: anon não lê; ninguém grava pela API');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha('SELECT private.checagem_atraso_job()', 'permission denied', 'authenticated não roda o job');
RESET ROLE;

ROLLBACK;
