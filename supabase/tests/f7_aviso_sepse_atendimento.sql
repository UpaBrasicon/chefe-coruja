-- Testes da migration 20270416000001_f7_aviso_sepse_atendimento.sql (F7 das
-- ferramentas pelo CID; decisões AV1–AV8 = A do RT em 17/11/2026): aviso
-- "pensar em sepse" no atendimento pela mesma regra do alerta da internação
-- (14 anos ou mais, gatilho de infecção, NEWS2 de 5 ou mais), com os vitais das
-- últimas 6 h do episódio; o CID do rascunho conta; a unidade pode desligar;
-- registro só de inserção. O preparo é o de sepse_adulto_alerta.sql.
-- ROLLBACK no fim.
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002']::uuid[]) s,
     unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.v(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;

-- ── dois adultos e uma criança chegam à porta e são triados ────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'e_inf', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre e tosse', NULL,
  '{"nome":"Aviso Sepse Febril","data_nascimento":"1960-05-05"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'e_bem', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Disúria', NULL,
  '{"nome":"Aviso Sepse Estavel","data_nascimento":"1962-07-07"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'e_cri', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Aviso Sepse Crianca","data_nascimento":"2018-03-03"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
-- FR 30 (3), FC 120 (2), T 39,0 (1), SpO2 97 (0), PAS 120 (0): NEWS2 6, parcial (sem O2 e consciência)
SELECT public.classificar_risco(pg_temp.u('e_inf'), 'amarelo',
  '{"frequencia-cardiaca":120,"frequencia-respiratoria":30,"temperatura":39.0,"saturacao-o2":97,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT public.classificar_risco(pg_temp.u('e_bem'), 'verde',
  '{"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":36.8,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u(x)) FROM unnest(ARRAY['e_inf', 'e_bem']) x;
-- sem SOAP registrado: o CID está só no rascunho da tela
INSERT INTO t SELECT 'a_sem_cid', coalesce(public.aviso_sepse_atendimento(pg_temp.u('e_inf'), NULL), 'null'::jsonb)::text;
INSERT INTO t SELECT 'a_j18', coalesce(public.aviso_sepse_atendimento(pg_temp.u('e_inf'), ARRAY['J18.9']), 'null'::jsonb)::text;
INSERT INTO t SELECT 'a_r07', coalesce(public.aviso_sepse_atendimento(pg_temp.u('e_inf'), ARRAY['R07.4']), 'null'::jsonb)::text;
INSERT INTO t SELECT 'a_bem', coalesce(public.aviso_sepse_atendimento(pg_temp.u('e_bem'), ARRAY['N39.0']), 'null'::jsonb)::text;
RESET ROLE;
INSERT INTO t SELECT 'p_inf', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('e_inf');
INSERT INTO t SELECT 'p_cri', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('e_cri');

DO $$
DECLARE a jsonb := pg_temp.v('a_j18');
BEGIN
  IF pg_temp.v('a_sem_cid') <> 'null'::jsonb THEN RAISE EXCEPTION 'FALHOU: aviso sem CID nem suspeita (%)', pg_temp.v('a_sem_cid'); END IF;
  IF a ->> 'nivel' IS DISTINCT FROM 'news2_rastreio' OR (a ->> 'total')::int <> 6 OR (a ->> 'parcial')::boolean IS NOT TRUE
     OR a -> 'gatilho' ->> 'cid' IS DISTINCT FROM 'J18.9' OR (a ->> 'dispensado')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: J18.9 do rascunho com NEWS2 6 parcial não deu o aviso de rastreio (%)', a;
  END IF;
  IF pg_temp.v('a_r07') <> 'null'::jsonb THEN RAISE EXCEPTION 'FALHOU: CID fora da lista de infecção deu aviso (%)', pg_temp.v('a_r07'); END IF;
  IF pg_temp.v('a_bem') <> 'null'::jsonb THEN RAISE EXCEPTION 'FALHOU: NEWS2 baixo deu aviso (%)', pg_temp.v('a_bem'); END IF;
  RAISE NOTICE 'OK  CID infeccioso do rascunho com NEWS2 6 parcial dá rastreio; sem CID, CID não infeccioso ou NEWS2 baixo, nada';
END $$;

-- janela: só vitais do episódio e desde o corte; criança nunca
DO $$
BEGIN
  IF private.sepse_adulto_regra(pg_temp.u('p_inf'), now() + interval '1 minute', pg_temp.u('e_inf'), ARRAY['J18.9']) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: vitais fora da janela contaram';
  END IF;
  IF private.sepse_adulto_regra(pg_temp.u('p_inf'), now() - interval '6 hours', pg_temp.u('e_bem'), ARRAY['J18.9']) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: vitais de outro episódio contaram';
  END IF;
  IF private.sepse_adulto_regra(pg_temp.u('p_cri'), now() - interval '6 hours', pg_temp.u('e_cri'), ARRAY['J18.9']) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: criança recebeu o aviso do adulto';
  END IF;
  RAISE NOTICE 'OK  janela de 6 h do episódio respeitada; criança fora';
END $$;

-- registro: exibido uma vez por episódio e nível; dispensado com autor e motivo; só o médico grava
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_aviso_sepse(pg_temp.u('e_inf'), 'exibido', ARRAY['J18.9']);
SELECT public.registrar_aviso_sepse(pg_temp.u('e_inf'), 'exibido', ARRAY['J18.9']);
SELECT public.registrar_aviso_sepse(pg_temp.u('e_inf'), 'dispensado', ARRAY['J18.9'], 'Quadro viral, sem sinais de gravidade');
INSERT INTO t SELECT 'a_disp', public.aviso_sepse_atendimento(pg_temp.u('e_inf'), ARRAY['J18.9'])::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$
BEGIN
  PERFORM public.registrar_aviso_sepse(pg_temp.u('e_inf'), 'dispensado', ARRAY['J18.9'], 'enfermagem');
  RAISE EXCEPTION 'FALHOU: enfermagem registrou o aviso';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
END $$;
RESET ROLE;
DO $$
DECLARE n_exib int; n_disp int; d record;
BEGIN
  SELECT count(*) FILTER (WHERE evento = 'exibido'), count(*) FILTER (WHERE evento = 'dispensado') INTO n_exib, n_disp
    FROM public.avisos_sepse_atendimento WHERE episodio_id = pg_temp.u('e_inf');
  IF n_exib <> 1 OR n_disp <> 1 THEN RAISE EXCEPTION 'FALHOU: registro exibido %, dispensado % (esperado 1 e 1)', n_exib, n_disp; END IF;
  SELECT * INTO d FROM public.avisos_sepse_atendimento WHERE episodio_id = pg_temp.u('e_inf') AND evento = 'dispensado';
  IF d.autor_id <> '10000000-0000-4000-8000-000000000002' OR d.motivo <> 'Quadro viral, sem sinais de gravidade'
     OR d.news2_total <> 6 OR d.cid <> 'J18.9' THEN
    RAISE EXCEPTION 'FALHOU: dispensa sem autor, motivo ou números do servidor (%)', to_jsonb(d);
  END IF;
  IF (pg_temp.v('a_disp') ->> 'dispensado')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: aviso não sabe que foi dispensado'; END IF;
  BEGIN
    UPDATE public.avisos_sepse_atendimento SET motivo = 'x' WHERE id = d.id;
    RAISE EXCEPTION 'FALHOU: registro aceitou alteração';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  exibido uma vez, dispensado com autor e motivo, só o médico grava, registro não muda';
END $$;

-- a unidade desliga a ficha sepse-adulto: o aviso some
INSERT INTO public.ferramenta_unidade (unidade_id, ferramenta_id, oculta, motivo, definida_por)
VALUES ('21000000-0000-4000-8000-000000000001', 'sepse-adulto', true, 'Teste do aviso desligado na unidade', '10000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'a_off', coalesce(public.aviso_sepse_atendimento(pg_temp.u('e_inf'), ARRAY['J18.9']), 'null'::jsonb)::text;
RESET ROLE;
DO $$
BEGIN
  IF pg_temp.v('a_off') <> 'null'::jsonb THEN RAISE EXCEPTION 'FALHOU: aviso apareceu com a ficha desligada na unidade (%)', pg_temp.v('a_off'); END IF;
  RAISE NOTICE 'OK  desligada na unidade, o aviso não aparece';
END $$;
ROLLBACK;
