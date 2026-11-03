-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000006_avisos_data_brasilia.sql (VD9 do lote
-- "Virada de data", BACKLOG.md). Tudo em transação com ROLLBACK.
--
-- O aviso (notificacoes_plantonista) leva a data de Brasília, não a UTC. Com o
-- relógio de Brasília fixo num dia que não é o de hoje em UTC, o aviso tem de
-- sair com esse dia.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION private.data_atual() RETURNS date LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT date '2001-01-01' $$;

-- ── 1. o aviso sai com o dia de Brasília ────────────────────────────────────
SELECT private.rnds_avisar(ARRAY['21000000-0000-4000-8000-000000000001']::uuid[], 'vd9_teste', 'aviso do teste');
DO $$
DECLARE
  v date;
BEGIN
  SELECT max(data) INTO v FROM public.notificacoes_plantonista
   WHERE unidade_id = '21000000-0000-4000-8000-000000000001' AND tipo = 'vd9_teste';
  IF v IS NULL THEN
    RAISE EXCEPTION 'FALHOU: rnds_avisar não gravou aviso para o gestor do seed';
  END IF;
  IF v <> date '2001-01-01' THEN
    RAISE EXCEPTION 'FALHOU: aviso com a data % em vez do dia de Brasília (2001-01-01)', v;
  END IF;
  RAISE NOTICE 'OK  aviso com o dia de Brasília';
END $$;

-- ── 2. nenhuma função de aviso usa current_date ─────────────────────────────
DO $$
DECLARE
  f regprocedure;
  s text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.enviar_mensagem(uuid, text)',
    'public.nir_cobrar(uuid, text, uuid)',
    'public.regulacao_atualizar_evolucao(uuid, text, text)',
    'public.regulacao_responder_pendencia(uuid, text)',
    'private.regulacao_avisar(public.regulacao_solicitacoes, text, text)',
    'private.regulacao_avisar_destino(public.regulacao_solicitacoes, text, text, boolean)',
    'private.regulacao_avisar_regulador(public.regulacao_solicitacoes, text, text)',
    'private.regulacao_sla_avisar()',
    'private.rnds_avisar(uuid[], text, text)',
    'private.webhook_manutencao()'
  ]::regprocedure[] LOOP
    SELECT prosrc INTO s FROM pg_proc WHERE oid = f;
    IF lower(s) LIKE '%current_date%' THEN
      RAISE EXCEPTION 'FALHOU: % ainda usa current_date', f;
    END IF;
    IF s NOT LIKE '%private.data_atual()%' THEN
      RAISE EXCEPTION 'FALHOU: % deveria usar private.data_atual()', f;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK  as 10 funções de aviso usam o dia de Brasília';
END $$;

ROLLBACK;
