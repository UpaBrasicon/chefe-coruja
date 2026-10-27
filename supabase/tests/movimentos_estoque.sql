-- Testes da migration 20270110000001_movimentos_estoque.sql (telas do
-- farmacêutico, ponto 5, decisões do RT de 27/10/2026). Transação com ROLLBACK.
-- O cenário é criado aqui (rede, unidade, farmacêutico, gestor e um
-- medicamento), sem depender do seed; por isso o teste roda também na
-- homologação.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/movimentos_estoque.sql
BEGIN;

UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO auth.users (instance_id, id, aud, role, email)
SELECT '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', u::text || '@estoque.teste'
FROM unnest(ARRAY['4e000000-0000-4000-8000-000000000001', '4e000000-0000-4000-8000-000000000002']::uuid[]) u;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('4e000000-0000-4000-8000-000000000001', 'Farmacêutica do Estoque'),
  ('4e000000-0000-4000-8000-000000000002', 'Gestor do Estoque')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;   -- o gatilho do auth.users já cria o perfil
INSERT INTO public.organizacoes (id, nome) VALUES ('4e100000-0000-4000-8000-000000000001', 'Rede do Teste do Estoque');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('4e200000-0000-4000-8000-000000000001', '4e100000-0000-4000-8000-000000000001', 'Unidade do Estoque', 'hospital');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('4e000000-0000-4000-8000-000000000001', '4e200000-0000-4000-8000-000000000001', 'farmaceutico'),
  ('4e000000-0000-4000-8000-000000000002', '4e200000-0000-4000-8000-000000000001', 'gestor');
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte, unidade_consumo) VALUES
  ('4e400000-0000-4000-8000-000000000001', 'Estoqueteste', 'estoqueteste', 'Ampola 2 mL', 'teste', 'ampola');

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;

-- ── 1. a entrada é do farmacêutico, com documento ───────────────────────────
SELECT pg_temp.como('4e000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  BEGIN
    PERFORM public.registrar_entrada_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 10, 'NF 123');
    RAISE EXCEPTION 'FALHOU: gestor registrou entrada';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  gestor não registra entrada';
END $$;
SELECT pg_temp.como('4e000000-0000-4000-8000-000000000001');
DO $$
DECLARE r jsonb; v_disp uuid;
BEGIN
  BEGIN
    PERFORM public.registrar_entrada_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 10, '');
    RAISE EXCEPTION 'FALHOU: entrada sem documento';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.registrar_entrada_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 0, 'NF 123');
    RAISE EXCEPTION 'FALHOU: entrada com quantidade zero';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  r := public.registrar_entrada_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 10, 'NF 123', 'compra mensal');
  IF (r ->> 'saldo')::numeric <> 10 THEN RAISE EXCEPTION 'FALHOU: saldo depois da entrada (%)', r; END IF;

  -- ── 2. saída avulsa e devolução entram no livro com a dispensação ─────────
  r := public.dispensar_avulso('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 3,
         'carrinho de emergência do PS', 'reposição do carrinho após parada');
  v_disp := (r ->> 'id')::uuid;
  PERFORM set_config('teste.disp', v_disp::text, true);
  PERFORM public.devolver_dispensacao(v_disp, 1, 'uma ampola voltou lacrada do carrinho');

  -- ── 3. ajuste de inventário: com motivo, e não ajusta o que já está certo ─
  BEGIN
    PERFORM public.ajustar_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 6, 'curto');
    RAISE EXCEPTION 'FALHOU: ajuste sem motivo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ajustar_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 8, 'contagem igual ao sistema');
    RAISE EXCEPTION 'FALHOU: ajuste para o mesmo saldo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  PERFORM public.ajustar_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 6, 'contagem do inventário mensal');

  -- ── 4. a tela antiga (atualizar_estoque) também entra, como ajuste sem motivo
  PERFORM public.atualizar_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 9);
  -- só limites, mesmo saldo: não vira movimento
  PERFORM public.atualizar_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001', 9, 4, 2);
  RAISE NOTICE 'OK  entrada, avulsa, devolução, ajuste e tela antiga gravados';
END $$;

-- ── 5. o extrato fecha com o saldo ──────────────────────────────────────────
DO $$
DECLARE x jsonb := public.extrato_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001');
BEGIN
  IF jsonb_array_length(x) <> 5 THEN RAISE EXCEPTION 'FALHOU: extrato com % movimentos (esperado 5): %', jsonb_array_length(x), x; END IF;
  IF (SELECT string_agg(e ->> 'tipo', ',' ORDER BY i DESC) FROM jsonb_array_elements(x) WITH ORDINALITY AS t(e, i))
       <> 'entrada,saida_avulsa,devolucao,ajuste_inventario,ajuste_inventario' THEN
    RAISE EXCEPTION 'FALHOU: ordem ou tipos do extrato: %', x;
  END IF;
  IF (SELECT sum((e ->> 'quantidade')::numeric) FROM jsonb_array_elements(x) e) <> 9
     OR (x -> 0 ->> 'saldo_depois')::numeric <> 9
     OR (SELECT quantidade FROM public.estoque_medicamento WHERE unidade_id = '4e200000-0000-4000-8000-000000000001'
           AND medicamento_id = '4e400000-0000-4000-8000-000000000001') <> 9 THEN
    RAISE EXCEPTION 'FALHOU: a soma do extrato não fecha com o saldo: %', x;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(x) e WHERE e ->> 'tipo' = 'entrada' AND e ->> 'documento' = 'NF 123' AND e ->> 'por' = 'Farmacêutica do Estoque')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(x) e WHERE e ->> 'tipo' = 'saida_avulsa' AND (e ->> 'quantidade')::numeric = -3
                      AND e ->> 'motivo' LIKE 'carrinho de emergência do PS%')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(x) e WHERE e ->> 'motivo' = 'saldo informado sem motivo' AND (e ->> 'quantidade')::numeric = 3) THEN
    RAISE EXCEPTION 'FALHOU: documento, destino ou ajuste sem motivo fora do extrato: %', x;
  END IF;
  RAISE NOTICE 'OK  extrato com os 5 movimentos, fechando com o saldo 9';
END $$;

-- ── 6. o gestor lê o extrato; o livro é só de inserção ──────────────────────
SELECT pg_temp.como('4e000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF jsonb_array_length(public.extrato_estoque('4e200000-0000-4000-8000-000000000001', '4e400000-0000-4000-8000-000000000001')) <> 5 THEN
    RAISE EXCEPTION 'FALHOU: gestor não lê o extrato';
  END IF;
  RAISE NOTICE 'OK  gestor lê o extrato';
END $$;
RESET ROLE;
DO $$ BEGIN
  BEGIN
    UPDATE public.movimentos_estoque SET quantidade = 0 WHERE medicamento_id = '4e400000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'FALHOU: movimento alterado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  IF (SELECT dispensacao_id FROM public.movimentos_estoque WHERE tipo = 'devolucao' AND medicamento_id = '4e400000-0000-4000-8000-000000000001')
       IS DISTINCT FROM current_setting('teste.disp')::uuid THEN
    RAISE EXCEPTION 'FALHOU: devolução sem a dispensação de origem';
  END IF;
  RAISE NOTICE 'OK  livro só de inserção; devolução ligada à dispensação';
END $$;

CREATE TEMP TABLE resultado_teste ON COMMIT DROP AS SELECT 'todos os passos passaram'::text AS r;
SELECT * FROM resultado_teste;
ROLLBACK;
