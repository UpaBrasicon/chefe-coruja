-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000007_faturamento_datas.sql (VD10 do lote
-- "Virada de data", BACKLOG.md). Tudo em transação com ROLLBACK.
--
-- A idade da crítica do procedimento lançado é a da data do procedimento, não
-- a de hoje; a competência da APAC, a crítica da AIH e o responsável da APAC
-- usam o dia de Brasília (ou o início da validade), não o dia UTC.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. idade na data do procedimento ────────────────────────────────────────
-- procedimento de teste até 11 meses; paciente nascido em 15/01/2026
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, idade_min, idade_max)
VALUES ('0000000991', 'Procedimento de teste VD10', 0, 11);
CREATE TEMP TABLE t AS SELECT id FROM public.pacientes ORDER BY id LIMIT 1;
UPDATE public.pacientes SET data_nascimento = date '2026-01-15' WHERE id = (SELECT id FROM t);

DO $$
DECLARE
  v_pac uuid := (SELECT id FROM t);
  c jsonb;
BEGIN
  IF v_pac IS NULL THEN RAISE EXCEPTION 'FALHOU: nenhum paciente para o teste'; END IF;
  -- 10/12/2026: 10 meses, dentro da faixa
  c := private.criticas_lancamento_aih('0000000991', 1, NULL, v_pac, date '2026-12-10');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(c) x WHERE x ->> 'codigo' = 'idade') THEN
    RAISE EXCEPTION 'FALHOU: procedimento aos 10 meses criticado por idade: %', c;
  END IF;
  -- 20/01/2027: 12 meses, fora da faixa
  c := private.criticas_lancamento_aih('0000000991', 1, NULL, v_pac, date '2027-01-20');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c) x WHERE x ->> 'codigo' = 'idade') THEN
    RAISE EXCEPTION 'FALHOU: procedimento aos 12 meses deveria ter crítica de idade: %', c;
  END IF;
  RAISE NOTICE 'OK  crítica de idade pela data do procedimento';
END $$;

-- ── 2. as trocas estão nas funções ──────────────────────────────────────────
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
      ('public.rede_faturamento(uuid, text)', '(ap.solicitada_em AT TIME ZONE ''America/Sao_Paulo'')::date', 'ap.solicitada_em::date'),
      ('private.criticas_aih(uuid, uuid, jsonb, uuid)', 'age(private.data_atual(), pa.data_nascimento)', 'current_date'),
      ('private.apac_arquivo(uuid, text)', 'age(coalesce(a.validade_inicio, private.data_atual()), pa.data_nascimento)', 'current_date'),
      ('private.criticas_lancamento_aih(text, integer, text, uuid)', 'age(private.data_atual(), pa.data_nascimento)', 'age(pa.data_nascimento)'),
      ('private.criticas_lancamento_aih(text, integer, text, uuid, date)', 'age(coalesce(p_data, private.data_atual()), pa.data_nascimento)', 'age(pa.data_nascimento)'),
      ('private.conta_itens(public.contas)', 'c.paciente_id, (l.realizado_em AT TIME ZONE ''America/Sao_Paulo'')::date)', 'l.cbo, c.paciente_id)')
    ) v(f, novo, antigo)
  LOOP
    IF to_regprocedure(c.f) IS NULL THEN
      RAISE EXCEPTION 'FALHOU: % não existe', c.f;
    END IF;
    IF (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure(c.f)) NOT LIKE '%' || c.novo || '%' THEN
      RAISE EXCEPTION 'FALHOU: % deveria ter %', c.f, c.novo;
    END IF;
    IF (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure(c.f)) LIKE '%' || c.antigo || '%' THEN
      RAISE EXCEPTION 'FALHOU: % ainda tem %', c.f, c.antigo;
    END IF;
  END LOOP;
  IF has_function_privilege('authenticated', 'private.criticas_lancamento_aih(text, integer, text, uuid, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated não deveria executar a crítica nova direto';
  END IF;
  RAISE NOTICE 'OK  competência, críticas e responsável da APAC pelo dia certo';
END $$;

ROLLBACK;
