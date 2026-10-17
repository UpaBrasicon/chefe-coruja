-- Testes da migration 20261129000001_unidade_consumo.sql (Fase 5B, etapa 3.1):
-- unidade de consumo sugerida pela apresentação, conferida e corrigida pela
-- farmácia ou pelo gestor, com histórico. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('00000000-0000-4000-8000-0000000c3101', 'Ceftriaxona Teste', 'ceftriaxona teste', 'Frasco 1 g po', 'teste-unidade'),
  ('00000000-0000-4000-8000-0000000c3102', 'Dipirona Teste', 'dipirona teste', 'Ampola 2 mL', 'teste-unidade'),
  ('00000000-0000-4000-8000-0000000c3103', 'Xarope Teste', 'xarope teste', 'Xarope 100 mL', 'teste-unidade');
DO $$ BEGIN
  IF (SELECT string_agg(coalesce(unidade_consumo, '—'), ',' ORDER BY id) FROM public.medicamento WHERE fonte = 'teste-unidade')
     <> 'frasco_ampola,ampola,—' THEN
    RAISE EXCEPTION 'FALHOU: sugestão pela apresentação';
  END IF;
  RAISE NOTICE 'OK  2a: medicamento novo nasce com a unidade sugerida pela apresentação (pó = frasco-ampola; sem palavra conhecida, em branco)';
END $$;

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

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.definir_unidade_consumo('00000000-0000-4000-8000-0000000c3102', 'frasco')$$,
  'Acesso negado', 'plantonista não muda a unidade de consumo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE l jsonb := public.medicamentos_unidade_consumo('teste', true);
BEGIN
  IF jsonb_array_length(l -> 'itens') <> 3 OR (l ->> 'a_conferir')::int < 3 THEN RAISE EXCEPTION 'FALHOU: lista a conferir: %', l; END IF;
  RAISE NOTICE 'OK  gestor vê a lista a conferir';
END $$;
SELECT pg_temp.falha($$SELECT public.definir_unidade_consumo('00000000-0000-4000-8000-0000000c3103', 'garrafa')$$,
  'Escolha a unidade de consumo da lista', 'unidade fora da lista recusada');
SELECT pg_temp.falha($$SELECT public.definir_unidade_consumo('00000000-0000-4000-8000-0000000c3103', 'outra', 'x')$$,
  'Escreva qual é a unidade', '"outra" pede o nome');
SELECT public.definir_unidade_consumo('00000000-0000-4000-8000-0000000c3103', 'outra', 'frasco conta-gotas');
SELECT public.definir_unidade_consumo('00000000-0000-4000-8000-0000000c3102', 'ampola');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT unidade_consumo || '|' || unidade_consumo_outra || '|' || (unidade_consumo_conferida_em IS NOT NULL)::text
        FROM public.medicamento WHERE id = '00000000-0000-4000-8000-0000000c3103') <> 'outra|frasco conta-gotas|true'
     OR (SELECT unidade_consumo_conferida_por FROM public.medicamento WHERE id = '00000000-0000-4000-8000-0000000c3102')
        <> '10000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'FALHOU: definir/confirmar';
  END IF;
  IF (SELECT count(*) FROM public.medicamento_unidade_historico WHERE medicamento_id IN
        ('00000000-0000-4000-8000-0000000c3102', '00000000-0000-4000-8000-0000000c3103')) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: histórico';
  END IF;
  IF has_table_privilege('authenticated', 'public.medicamento_unidade_historico', 'INSERT') THEN RAISE EXCEPTION 'FALHOU: histórico gravável por fora'; END IF;
  RAISE NOTICE 'OK  4a: gestor define ou confirma, com histórico de quem mudou';
END $$;
ROLLBACK;
