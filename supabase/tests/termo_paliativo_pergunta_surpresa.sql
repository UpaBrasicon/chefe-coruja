-- Testes da migration 20270203000006_termo_paliativo_pergunta_surpresa.sql
-- (ponto 15 do plantonista): a categoria do modelo de termo (só o gestor
-- muda, vale para todas as versões, a versão nova herda) e a pergunta surpresa
-- (só no adulto, com a idade conhecida; 1 = triagem positiva). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- médico (…0002) e recepção (…0005) de plantão no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
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

-- ── categoria do modelo de termo ───────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'm1', public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'Cuidados paliativos — teste', 'Plano de cuidados paliativos',
  'Plano de cuidados de {paciente}, decidido com o paciente ou o responsável, com os limites de tratamento combinados.');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format($q$SELECT public.definir_categoria_modelo_termo(%L, 'cuidados_paliativos')$q$, pg_temp.u('m1')),
  'Acesso negado', 'médico não muda a categoria do modelo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format($q$SELECT public.definir_categoria_modelo_termo(%L, 'outra')$q$, pg_temp.u('m1')),
  'Categoria do modelo', 'categoria inválida é recusada');
SELECT public.definir_categoria_modelo_termo(pg_temp.u('m1'), 'cuidados_paliativos');
-- versão nova do modelo herda a categoria
INSERT INTO t SELECT 'm1v2', public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'Cuidados paliativos — teste', 'Plano de cuidados paliativos',
  'Plano de cuidados de {paciente} ({idade}), decidido com o paciente ou o responsável, com os limites de tratamento combinados.', NULL, pg_temp.u('m1'));
RESET ROLE;
INSERT INTO t SELECT 'raiz', raiz_id::text FROM public.termos_modelos WHERE id = pg_temp.u('m1');
DO $$
BEGIN
  IF (SELECT string_agg(versao || ':' || categoria, ',' ORDER BY versao) FROM public.termos_modelos WHERE raiz_id = pg_temp.u('raiz'))
     IS DISTINCT FROM '1:cuidados_paliativos,2:cuidados_paliativos' THEN
    RAISE EXCEPTION 'FALHOU: categoria das versões — %', (SELECT string_agg(versao || ':' || categoria, ',' ORDER BY versao) FROM public.termos_modelos WHERE raiz_id = pg_temp.u('raiz'));
  END IF;
  IF EXISTS (SELECT 1 FROM public.termos_modelos WHERE raiz_id <> pg_temp.u('raiz') AND categoria <> 'consentimento') THEN
    RAISE EXCEPTION 'FALHOU: modelo de antes saiu do consentimento';
  END IF;
  RAISE NOTICE 'OK  categoria vale para todas as versões, e a versão nova herda';
END $$;

-- ── pergunta surpresa ──────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ad', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dispneia', NULL,
  '{"nome":"Adulto Da Pergunta","data_nascimento":"1950-01-01"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'cr', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  format('{"nome":"Crianca Da Pergunta","data_nascimento":"%s"}', (current_date - interval '5 years')::date)::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pad', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ad');
INSERT INTO t SELECT 'pcr', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('cr');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'av', public.registrar_avaliacao(pg_temp.u('pad'), 'pergunta_surpresa', '{"surpreso":1}')::text;
SELECT pg_temp.falha(format($q$SELECT public.registrar_avaliacao(%L, 'pergunta_surpresa', '{"surpreso":1}')$q$, pg_temp.u('pcr')),
  'A pergunta surpresa é do adulto', 'pergunta surpresa na criança é recusada');
SELECT pg_temp.falha(format($q$SELECT public.registrar_avaliacao(%L, 'pergunta_surpresa', '{"surpreso":2}')$q$, pg_temp.u('pad')),
  'Resposta fora das opções', 'resposta fora das opções é recusada');
SELECT pg_temp.falha(format($q$SELECT public.registrar_avaliacao(%L, 'braden', '{"percepcao":1,"umidade":1,"atividade":1,"mobilidade":1,"nutricao":1,"friccao":1}')$q$, pg_temp.u('pcr')),
  'Braden e Morse são escalas do adulto', 'Braden na criança continua recusada');
RESET ROLE;
DO $$
DECLARE a public.avaliacoes_escala;
BEGIN
  SELECT * INTO a FROM public.avaliacoes_escala WHERE id = pg_temp.u('av');
  IF a.escala IS DISTINCT FROM 'pergunta_surpresa' OR a.total IS DISTINCT FROM 1 OR a.interpretacao NOT LIKE 'Positiva%' OR a.versao <> '2026-10-31.1' THEN
    RAISE EXCEPTION 'FALHOU: pergunta surpresa gravada — % % % %', a.escala, a.total, a.interpretacao, a.versao;
  END IF;
  RAISE NOTICE 'OK  pergunta surpresa positiva gravada no adulto, com a versão';
END $$;
ROLLBACK;
