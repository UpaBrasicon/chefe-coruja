-- Testes da migration 20270321000001_porta_exames_por_grupo.sql (ponto 12 do
-- plantonista, pergunta 3; decisão do RT em 10/11/2026): no pedido rápido da
-- porta (pedir_exames), laboratório, imagem e ECG vão em pedidos separados; o
-- texto livre leva o grupo escolhido; sem grupo (tela antiga), funciona como
-- antes. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia, valor_sa, valor_sh, valor_sp) VALUES
  ('0202990041', 'HEMOGRAMA TESTE PORTA', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 4.11, 0, 0),
  ('0202990042', 'CREATININA TESTE PORTA', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 1.85, 0, 0),
  ('0204990041', 'RADIOGRAFIA TESTE PORTA', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 9.50, 0, 0),
  ('0211990041', 'ELETROCARDIOGRAMA TESTE PORTA', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 5.15, 0, 0)
ON CONFLICT (codigo) DO NOTHING;
-- médico (…0002), enfermeira (…0004) e recepção (…0005) de plantão agora no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
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

SET LOCAL ROLE authenticated;
-- a lista da unidade com os 4 exames de teste (gestor)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', c, n)
  FROM (VALUES ('0202990041', 'Hemograma P'), ('0202990042', 'Creatinina P'), ('0204990041', 'RX P'), ('0211990041', 'ECG P')) v(c, n);
-- paciente na porta, em atendimento com o médico
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'a', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor torácica', NULL,
  json_build_object('nome', 'Paciente Porta Grupo Teste', 'data_nascimento', '1970-02-02')::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('a'), 'verde',
  '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('a'));

-- 1. mistura com código é recusada (laboratório + imagem; laboratório + ECG)
SELECT pg_temp.falha(format('SELECT public.pedir_exames(%L, %L)', pg_temp.u('a'), '[{"procedimento":"0202990041"},{"procedimento":"0204990041"}]'),
  'Laboratório, imagem e ECG vão em pedidos separados: RX P é de imagem, e este pedido é de laboratório', 'laboratório e imagem no mesmo pedido');
SELECT pg_temp.falha(format('SELECT public.pedir_exames(%L, %L)', pg_temp.u('a'), '[{"procedimento":"0211990041"},{"procedimento":"0202990041"}]'),
  'Laboratório, imagem e ECG vão em pedidos separados', 'ECG e laboratório no mesmo pedido');
-- 2. texto livre com grupo diferente do código também é mistura
SELECT pg_temp.falha(format('SELECT public.pedir_exames(%L, %L)', pg_temp.u('a'), '[{"procedimento":"0202990041"},{"nome":"Tomografia de crânio","grupo":"imagem"}]'),
  'Laboratório, imagem e ECG vão em pedidos separados', 'laboratório e imagem em texto livre no mesmo pedido');
-- 3. grupo fora da lista
SELECT pg_temp.falha(format('SELECT public.pedir_exames(%L, %L)', pg_temp.u('a'), '[{"nome":"Algo","grupo":"outro"}]'),
  'Grupo do exame: laboratório, imagem ou ECG', 'grupo inválido');

-- 4. um grupo por pedido passa; o texto livre grava o grupo; sem grupo, como antes
SELECT public.pedir_exames(pg_temp.u('a'), '[{"procedimento":"0202990041"},{"procedimento":"0202990042"},{"nome":"Troponina rápida","grupo":"laboratorio"}]');
SELECT public.pedir_exames(pg_temp.u('a'), '[{"procedimento":"0204990041"},{"nome":"Tomografia de crânio","grupo":"imagem"}]');
SELECT public.pedir_exames(pg_temp.u('a'), '[{"procedimento":"0211990041"}]');
SELECT public.pedir_exames(pg_temp.u('a'), '[{"nome":"Teste rápido de dengue"}]');
RESET ROLE;
DO $$
DECLARE r record; esperado constant jsonb := '{"Hemograma P": "laboratorio", "Creatinina P": "laboratorio", "Troponina rápida": "laboratorio",
  "RX P": "imagem", "Tomografia de crânio": "imagem", "ECG P": "grafico"}';
BEGIN
  FOR r IN SELECT exame, grupo FROM public.exames_pedidos WHERE episodio_id = pg_temp.u('a') LOOP
    IF r.exame = 'Teste rápido de dengue' THEN
      IF r.grupo IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: texto livre sem grupo ganhou %', r.grupo; END IF;
    ELSIF r.grupo IS DISTINCT FROM esperado ->> r.exame THEN
      RAISE EXCEPTION 'FALHOU: % ficou com grupo %', r.exame, r.grupo;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.exames_pedidos WHERE episodio_id = pg_temp.u('a')) <> 7 THEN
    RAISE EXCEPTION 'FALHOU: esperava 7 exames pedidos, há %', (SELECT count(*) FROM public.exames_pedidos WHERE episodio_id = pg_temp.u('a'));
  END IF;
  RAISE NOTICE 'OK  um grupo por pedido; texto livre grava o grupo; sem grupo (tela antiga) funciona como antes';
END $$;

-- 5. privilégios
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.pedir_exames(uuid, jsonb, text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'private.pedido_de_um_grupo(text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: privilégios';
  END IF;
  RAISE NOTICE 'OK  privilégios';
END $$;
ROLLBACK;
