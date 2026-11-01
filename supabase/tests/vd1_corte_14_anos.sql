-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000001_corte_14_anos.sql (VD1 do lote "Virada de
-- data", BACKLOG.md; P0 clínico por decisão do RT em 01/11/2026).
-- Tudo em transação com ROLLBACK.
--
-- Na véspera dos 14 anos a criança (13a 11m 29d) continua pediátrica; no dia
-- do aniversário já é adulto. Antes, `age(dia, nascimento) < interval
-- '14 years'` dava falso na véspera para quem nasceu do dia 2 em diante de mês
-- de 31 dias (age = '13 years 11 mons 30 days', igual a 14 anos na comparação).
-- Usa as internações de demonstração da Clínica Médica do banco local/CI, como
-- fase2_fugulin.sql.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. Fugulin: recusado na véspera dos 14 anos, aceito no aniversário ──────
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000004';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id = '10000000-0000-4000-8000-000000000004'
   AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
-- duas internações ativas da Clínica Médica: uma faz 14 anos amanhã, outra hoje
INSERT INTO t SELECT 'vespera', i.id::text FROM public.internacoes i
 WHERE i.setor_atual_id = '22000000-0000-4000-8000-000000000001' AND i.status IN ('admitido', 'em_observacao', 'internado')
 ORDER BY i.id LIMIT 1;
INSERT INTO t SELECT 'aniversario', i.id::text FROM public.internacoes i
 WHERE i.setor_atual_id = '22000000-0000-4000-8000-000000000001' AND i.status IN ('admitido', 'em_observacao', 'internado')
 ORDER BY i.id OFFSET 1 LIMIT 1;
UPDATE public.pacientes SET data_nascimento = (private.data_atual() - interval '14 years' + interval '1 day')::date
 WHERE id = (SELECT paciente_id FROM public.internacoes WHERE id = (SELECT valor::uuid FROM t WHERE nome = 'vespera'));
UPDATE public.pacientes SET data_nascimento = (private.data_atual() - interval '14 years')::date
 WHERE id = (SELECT paciente_id FROM public.internacoes WHERE id = (SELECT valor::uuid FROM t WHERE nome = 'aniversario'));
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.resp(v int) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_object_agg(a, v) FROM jsonb_array_elements_text(private.fugulin_definicao() -> 'areas') a $$;
GRANT EXECUTE ON FUNCTION pg_temp.resp(int) TO authenticated;
GRANT EXECUTE ON FUNCTION private.fugulin_definicao() TO authenticated;
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

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '10000000-0000-4000-8000-000000000004', 'role', 'authenticated')::text, true);
SELECT pg_temp.falha(format('SELECT public.registrar_fugulin(%L, %L)', pg_temp.u('vespera'), pg_temp.resp(2)),
  'Fugulin é instrumento do adulto', 'véspera dos 14 anos: ainda criança, Fugulin recusado');
DO $$
BEGIN
  IF public.registrar_fugulin(pg_temp.u('aniversario'), pg_temp.resp(2)) IS NULL THEN
    RAISE EXCEPTION 'FALHOU: aniversário de 14 anos: o Fugulin deveria ser aceito';
  END IF;
  RAISE NOTICE 'OK  aniversário de 14 anos: adulto, Fugulin aceito';
END $$;
RESET ROLE;

-- ── 2. a regra, com datas fixas ─────────────────────────────────────────────
DO $$
DECLARE
  c record;
BEGIN
  -- o defeito de antes, para registro: na véspera, age() empata com 14 anos
  IF age('2026-12-30'::date, '2012-12-31'::date) < interval '14 years' THEN
    RAISE EXCEPTION 'FALHOU: o Postgres mudou a comparação de intervalos; rever o VD1';
  END IF;
  FOR c IN SELECT * FROM (VALUES
      ('2012-12-31'::date, '2026-12-30'::date, true,  'véspera dos 14 anos, nascido em 31/12'),
      ('2012-12-31',       '2026-12-31',       false, 'aniversário de 14 anos: adulto'),
      ('2012-10-31',       '2026-10-30',       true,  'véspera, nascido no dia 31 de mês de 31 dias'),
      ('2012-11-02',       '2026-11-01',       true,  'véspera, mês anterior de 31 dias'),
      ('2012-03-01',       '2026-02-28',       true,  'véspera, nascido em 01/03'),
      ('2012-03-01',       '2026-03-01',       false, 'aniversário em 01/03'),
      ('2012-02-29',       '2026-02-28',       true,  'nascido em 29/02, ainda não completou'),
      ('2012-02-29',       '2026-03-01',       false, 'nascido em 29/02 completa em 01/03 (igual a idadeEm)'),
      ('2012-01-01',       '2025-12-31',       true,  'véspera, virada do ano'),
      ('2012-01-01',       '2026-01-01',       false, 'aniversário no 1º do ano'),
      ('2026-10-31',       '2026-11-01',       true,  'recém-nascido'),
      ('1970-01-01',       '2026-11-01',       false, 'adulto')
    ) v(nasc, dia, esperado, caso)
  LOOP
    IF private.pediatrico_em(c.nasc, c.dia) IS DISTINCT FROM c.esperado THEN
      RAISE EXCEPTION 'FALHOU: % (% em %): esperado %, veio %', c.caso, c.nasc, c.dia, c.esperado,
        private.pediatrico_em(c.nasc, c.dia);
    END IF;
    RAISE NOTICE 'OK  %', c.caso;
  END LOOP;
  IF private.pediatrico_em(NULL, '2026-11-01') IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: sem nascimento a idade é desconhecida (nulo), como antes';
  END IF;
  RAISE NOTICE 'OK  sem nascimento: nulo';
END $$;

-- ── 3. nenhuma função compara age() com 14 anos; as três usam a regra ───────
DO $$
DECLARE
  v_resto text;
  v_falta text;
BEGIN
  SELECT string_agg(n.nspname || '.' || p.proname, ', ') INTO v_resto
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'private')
     AND p.prosrc ~ 'age\([^;]*\)\s*<\s*interval\s*''14 years''';
  IF v_resto IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: ainda comparam age() com 14 anos: %', v_resto;
  END IF;
  SELECT string_agg(f, ', ') INTO v_falta
    FROM unnest(ARRAY['classificar_risco', 'registrar_avaliacao', 'registrar_fugulin']) f
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                      WHERE n.nspname = 'public' AND p.proname = f AND p.prosrc LIKE '%private.pediatrico_em(%');
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: não usam private.pediatrico_em: %', v_falta;
  END IF;
  RAISE NOTICE 'OK  classificar_risco, registrar_avaliacao e registrar_fugulin usam a regra';
END $$;

ROLLBACK;
