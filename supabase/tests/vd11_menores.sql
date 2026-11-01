-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000008_menores_datas.sql (VD11 do lote "Virada
-- de data", BACKLOG.md). Tudo em transação com ROLLBACK.
--
-- As funções contam o dia em Brasília, e o dia do censo vai até a meia-noite
-- seguinte, exclusiva. A data futura do treinamento tem teste de comportamento
-- em fase3_implantacao.sql.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  c record;
  s text;
BEGIN
  FOR c IN SELECT * FROM (VALUES
      ('public.implantacao_treinar(uuid, uuid, text, date, text)', 'private.data_atual()', 'current_date'),
      ('private.aplicar_primeiro_acesso(uuid, text, jsonb)', 'v_nasc > (private.data_atual() - interval ''16 years'')', 'current_date'),
      ('private.conteudo_pacote_alta(uuid)', '(coalesce(i.data_alta, now()) AT TIME ZONE ''America/Sao_Paulo'')::date', 'coalesce(i.data_alta, now())::date'),
      ('public.resumo_busca_ia(uuid, integer)', '(l.created_at AT TIME ZONE ''America/Sao_Paulo'')::date AS dia', 'l.created_at::date'),
      ('public.resumo_busca_ia(uuid, integer)', '((private.data_atual() - greatest(p_dias, 1) + 1)::text || '' 00:00:00-03'')::timestamptz', 'now() - make_interval'),
      ('public.censo_recente(uuid, integer)', 'c.data >= private.data_atual() - p_dias', 'current_date'),
      ('public.gerar_censo_todas_unidades(date)', 'coalesce(p_data, private.data_atual() - 1)', 'current_date'),
      ('private.gerar_censo_diario(uuid, date)', '((p_data + 1)::text || '' 00:00:00-03'')::timestamptz', '23:59:59'),
      ('private.gerar_censo_diario(uuid, date)', 'data_alta < v_dia_fim', '<= v_dia_fim')
    ) v(f, novo, antigo)
  LOOP
    SELECT prosrc INTO s FROM pg_proc WHERE oid = to_regprocedure(c.f);
    IF s IS NULL THEN RAISE EXCEPTION 'FALHOU: % não existe', c.f; END IF;
    IF s NOT LIKE '%' || c.novo || '%' THEN RAISE EXCEPTION 'FALHOU: % deveria ter %', c.f, c.novo; END IF;
    IF s LIKE '%' || c.antigo || '%' THEN RAISE EXCEPTION 'FALHOU: % ainda tem %', c.f, c.antigo; END IF;
  END LOOP;
  RAISE NOTICE 'OK  datas pelo dia de Brasília e censo até a meia-noite';
END $$;

-- o fim do dia do censo pega o último segundo e não pega a meia-noite seguinte
DO $$
DECLARE
  fim timestamptz := ((date '2026-12-31' + 1)::text || ' 00:00:00-03')::timestamptz;
BEGIN
  IF NOT (timestamptz '2026-12-31 23:59:59.5-03' < fim) OR (timestamptz '2027-01-01 00:00:00-03' < fim) THEN
    RAISE EXCEPTION 'FALHOU: fim do dia do censo';
  END IF;
  RAISE NOTICE 'OK  23:59:59,5 entra no dia; meia-noite seguinte, não';
END $$;

ROLLBACK;
