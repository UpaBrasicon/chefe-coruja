-- Fase 2, tarefa 5 — migration 20261031000006_fugulin.sql: enfermeiro de
-- plantão classifica a internação pelo Fugulin (12 áreas), uma vez por dia;
-- corrigir é retificar com motivo; criança não; servidor refaz a soma.
-- Usa as internações de demonstração da Clínica Médica do banco local/CI.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
-- duas internações ativas da Clínica Médica: uma de adulto, outra vira criança
INSERT INTO t SELECT 'int', i.id::text FROM public.internacoes i
 WHERE i.setor_atual_id = '22000000-0000-4000-8000-000000000001' AND i.status IN ('admitido', 'em_observacao', 'internado')
 ORDER BY i.id LIMIT 1;
INSERT INTO t SELECT 'crianca', i.id::text FROM public.internacoes i
 WHERE i.setor_atual_id = '22000000-0000-4000-8000-000000000001' AND i.status IN ('admitido', 'em_observacao', 'internado')
 ORDER BY i.id OFFSET 1 LIMIT 1;
UPDATE public.pacientes SET data_nascimento = private.data_atual() - interval '6 years'
 WHERE id = (SELECT paciente_id FROM public.internacoes WHERE id = (SELECT valor::uuid FROM t WHERE nome = 'crianca'));
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.resp(v int) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_object_agg(a, v) FROM jsonb_array_elements_text(private.fugulin_definicao() -> 'areas') a $$;
GRANT EXECUTE ON FUNCTION pg_temp.resp(int) TO authenticated;
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
GRANT EXECUTE ON FUNCTION private.fugulin_definicao() TO authenticated;

SET LOCAL ROLE authenticated;
-- médico não classifica
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_fugulin(%L, %L)', pg_temp.u('int'), pg_temp.resp(2)),
  'O Fugulin é do enfermeiro', 'médico não classifica pelo Fugulin');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.registrar_fugulin(%L, %L)', pg_temp.u('int'), pg_temp.resp(2) - 'curativo'),
  'Responda as 12 áreas com graduação de 1 a 4 (falta ou inválida: curativo)', 'falta área: recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_fugulin(%L, %L)', pg_temp.u('int'), pg_temp.resp(2) || '{"oxigenacao":5}'),
  'Responda as 12 áreas com graduação de 1 a 4 (falta ou inválida: oxigenacao)', 'graduação fora de 1 a 4: recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_fugulin(%L, %L)', pg_temp.u('int'), pg_temp.resp(2) || '{"glasgow":3}'),
  'Área que não é do Fugulin', 'área estranha: recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_fugulin(%L, %L)', pg_temp.u('crianca'), pg_temp.resp(2)),
  'Fugulin é instrumento do adulto', 'criança não se classifica pelo Fugulin');
-- 3 em todas = 36: intensivo; a segunda do dia pede motivo e retifica
INSERT INTO t SELECT 'f1', public.registrar_fugulin(pg_temp.u('int'), pg_temp.resp(3))::text;
SELECT pg_temp.falha(format('SELECT public.registrar_fugulin(%L, %L)', pg_temp.u('int'), pg_temp.resp(2)),
  'O Fugulin de hoje já foi feito', 'segunda classificação do dia sem motivo: recusada');
INSERT INTO t SELECT 'f2', public.registrar_fugulin(pg_temp.u('int'), pg_temp.resp(2) || '{"oxigenacao":4,"terapeutica":4,"sinais_vitais":4}',
  'Marquei oxigenação errada no primeiro registro')::text;
INSERT INTO t SELECT 'hist', public.fugulin_da_internacao(pg_temp.u('int'))::text;
INSERT INTO t SELECT 'hoje', public.fugulin_de_hoje(ARRAY[pg_temp.u('int'), pg_temp.u('crianca')])::text;
RESET ROLE;

DO $$
DECLARE h jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'hist'); hj jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'hoje');
BEGIN
  IF (SELECT total FROM public.classificacoes_fugulin WHERE id = pg_temp.u('f1')) <> 36
     OR (SELECT categoria FROM public.classificacoes_fugulin WHERE id = pg_temp.u('f1')) <> 'Cuidados intensivos (acima de 34)' THEN
    RAISE EXCEPTION 'FALHOU: soma e categoria (36)';
  END IF;
  IF (SELECT total FROM public.classificacoes_fugulin WHERE id = pg_temp.u('f2')) <> 30
     OR (SELECT categoria FROM public.classificacoes_fugulin WHERE id = pg_temp.u('f2')) <> 'Cuidados semi-intensivos (29 a 34)' THEN
    RAISE EXCEPTION 'FALHOU: soma e categoria (30)';
  END IF;
  RAISE NOTICE 'OK  servidor soma as 12 áreas e lê a categoria (36 intensivo; 30 semi-intensivo)';
  IF jsonb_array_length(h) <> 2 OR NOT (h -> 1 ->> 'retificada')::boolean OR h -> 0 ->> 'retifica_id' <> pg_temp.u('f1')::text THEN
    RAISE EXCEPTION 'FALHOU: histórico com retificação (%)', h;
  END IF;
  RAISE NOTICE 'OK  retificação guarda a anterior, com motivo; histórico mostra as duas';
  IF (hj -> pg_temp.u('int')::text ->> 'total')::int <> 30 OR jsonb_typeof(hj -> pg_temp.u('crianca')::text) <> 'null' THEN
    RAISE EXCEPTION 'FALHOU: Fugulin de hoje (%)', hj;
  END IF;
  RAISE NOTICE 'OK  Fugulin de hoje: vigente na internação classificada; pendente (nulo) na outra';
  BEGIN
    UPDATE public.classificacoes_fugulin SET total = 12 WHERE id = pg_temp.u('f2');
    RAISE EXCEPTION 'FALHOU: alterada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  só de inserção';
  IF has_table_privilege('authenticated', 'public.classificacoes_fugulin', 'INSERT')
     OR has_function_privilege('anon', 'public.registrar_fugulin(uuid, jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: exposto';
  END IF;
  RAISE NOTICE 'OK  só por RPC; fora do anon';
END $$;
ROLLBACK;
