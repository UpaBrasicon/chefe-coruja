-- Testes da migration 20270405000001_laudo_por_grupo.sql (pedido do RT de
-- 11/11/2026; G1 a G5 = A): um arquivo para vários exames do mesmo grupo.
-- Confere a lista dos exames que podem receber o laudo, as recusas (um exame só,
-- grupo misturado, arquivo de fora da lista, arquivo que não subiu, quem não
-- registra, exame que já tem resultado), o registro do mesmo arquivo em três
-- exames, a leitura por qualquer um deles e que o registro por exame continua
-- recusando o arquivo de outro grupo. O preparo é o de exames_por_grupo.sql.
-- ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia, valor_sa, valor_sh, valor_sp) VALUES
  ('0202990031', 'HEMOGRAMA TESTE GRUPO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 4.11, 0, 0),
  ('0202990032', 'CREATININA TESTE GRUPO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 1.85, 0, 0),
  ('0204990031', 'RADIOGRAFIA TESTE GRUPO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 9.50, 0, 0),
  ('0211990031', 'ELETROCARDIOGRAMA TESTE GRUPO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 5.15, 0, 0)
ON CONFLICT (codigo) DO NOTHING;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
-- médico (…0002) e enfermeira (…0004) de plantão na Observação; recepção (…0005) no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
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

-- o grupo sai do código
DO $$ BEGIN
  IF private.grupo_do_procedimento('0202010473') <> 'laboratorio' OR private.grupo_do_procedimento('0204030170') <> 'imagem'
     OR private.grupo_do_procedimento('0205020046') <> 'imagem' OR private.grupo_do_procedimento('0211020036') <> 'grafico'
     OR private.grupo_do_procedimento(NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: grupo do procedimento';
  END IF;
  RAISE NOTICE 'OK  grupo: 02.02 laboratório, 02.04-02.07 imagem, 02.11 ECG/métodos gráficos';
END $$;

-- paciente cadastrado no PS e internado na Observação
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Paciente Dos Exames","data_nascimento":"1972-03-03"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, episodio_id, setor_atual_id, status)
SELECT u.organizacao_id, u.id, pg_temp.u('pac'), pg_temp.u('ep'), '22000000-0000-4000-8000-000000000002', 'internado'
  FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO t SELECT 'int', id::text FROM public.internacoes WHERE paciente_id = pg_temp.u('pac') AND data_alta IS NULL;

-- o médico com o paciente pede um pedido por grupo
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE x jsonb;
BEGIN
  x := public.pedir_exames_internacao(pg_temp.u('int'), '[{"procedimento":"0202990031"},{"procedimento":"0202990032"},{"nome":"Dosagem livre de teste"}]', 'laboratorio', 'urgente');
  IF (x ->> 'pedidos')::int <> 3 OR x ->> 'grupo' <> 'laboratorio' THEN RAISE EXCEPTION 'FALHOU: pedido de laboratório — %', x; END IF;
  x := public.pedir_exames_internacao(pg_temp.u('int'), '[{"procedimento":"0204990031"}]', 'imagem');
  IF (x ->> 'pedidos')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: pedido de imagem — %', x; END IF;
  x := public.pedir_exames_internacao(pg_temp.u('int'), '[{"procedimento":"0211990031"}]', 'grafico');
  IF (x ->> 'pedidos')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: pedido de ECG — %', x; END IF;
  RAISE NOTICE 'OK  laboratório, imagem e ECG em três pedidos';
END $$;
RESET ROLE;
INSERT INTO t SELECT 'hemo', id::text FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND exame = 'HEMOGRAMA TESTE GRUPO';
INSERT INTO t SELECT 'crea', id::text FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND exame = 'CREATININA TESTE GRUPO';
INSERT INTO t SELECT 'livre', id::text FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND exame = 'Dosagem livre de teste';
INSERT INTO t SELECT 'rx', id::text FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND exame = 'RADIOGRAFIA TESTE GRUPO';
INSERT INTO t SELECT 'ecg', id::text FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND exame = 'ELETROCARDIOGRAMA TESTE GRUPO';
INSERT INTO storage.objects (bucket_id, name) VALUES ('exames', pg_temp.u('hemo') || '/laudo-laboratorio.pdf');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE x jsonb;
BEGIN
  x := public.exames_aguardando_laudo(pg_temp.u('pac'));
  IF jsonb_array_length(x) <> 5
     OR (SELECT count(*) FROM jsonb_array_elements(x) i WHERE i ->> 'grupo' = 'laboratorio') <> 3 THEN
    RAISE EXCEPTION 'FALHOU: exames aguardando laudo — %', x;
  END IF;
  RAISE NOTICE 'OK  os cinco exames aguardam laudo, três de laboratório';
END $$;
SELECT pg_temp.falha('SELECT public.exames_aguardando_laudo(NULL)', 'Informe o paciente', 'lista sem paciente é recusada');

-- recusas
SELECT pg_temp.falha(format('SELECT public.registrar_laudo_grupo(ARRAY[%L]::uuid[], %L, %L)', pg_temp.u('hemo'), pg_temp.u('hemo') || '/laudo-laboratorio.pdf', 'laudo.pdf'),
  'Escolha pelo menos dois exames', 'um exame só vai pelo registro do exame');
SELECT pg_temp.falha(format('SELECT public.registrar_laudo_grupo(ARRAY[%L, %L]::uuid[], %L, %L)', pg_temp.u('hemo'), pg_temp.u('rx'), pg_temp.u('hemo') || '/laudo-laboratorio.pdf', 'laudo.pdf'),
  'Os exames têm de ser do mesmo grupo', 'laboratório com imagem é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_laudo_grupo(ARRAY[%L, %L]::uuid[], %L, %L)', pg_temp.u('crea'), pg_temp.u('livre'), pg_temp.u('hemo') || '/laudo-laboratorio.pdf', 'laudo.pdf'),
  'O laudo tem de ser enviado num dos exames escolhidos', 'arquivo de exame fora da lista é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_laudo_grupo(ARRAY[%L, %L]::uuid[], %L, %L)', pg_temp.u('hemo'), pg_temp.u('crea'), pg_temp.u('hemo') || '/nao-enviado.pdf', 'laudo.pdf'),
  'O laudo não foi enviado', 'arquivo que não subiu é recusado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.registrar_laudo_grupo(ARRAY[%L, %L]::uuid[], %L, %L)', pg_temp.u('hemo'), pg_temp.u('crea'), pg_temp.u('hemo') || '/laudo-laboratorio.pdf', 'laudo.pdf'),
  'Acesso negado', 'recepção não registra laudo');
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.exame_resultados r JOIN public.exames_pedidos e ON e.id = r.exame_id WHERE e.internacao_id = pg_temp.u('int')) THEN
    RAISE EXCEPTION 'FALHOU: uma recusa deixou resultado gravado';
  END IF;
  RAISE NOTICE 'OK  recusa não grava nada';
END $$;

-- a enfermeira com o paciente registra o laudo do laboratório nos três exames
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$
DECLARE x jsonb;
BEGIN
  x := public.registrar_laudo_grupo(ARRAY[pg_temp.u('crea'), pg_temp.u('hemo'), pg_temp.u('livre'), pg_temp.u('hemo')],
                                    pg_temp.u('hemo') || '/laudo-laboratorio.pdf', 'laudo-laboratorio.pdf');
  IF (x ->> 'registrados')::int <> 3 OR x ->> 'grupo' <> 'laboratorio' THEN RAISE EXCEPTION 'FALHOU: registro do grupo — %', x; END IF;
  x := public.exames_aguardando_laudo(pg_temp.u('pac'));
  IF jsonb_array_length(x) <> 2 THEN RAISE EXCEPTION 'FALHOU: depois do laudo, aguardam %', x; END IF;
  RAISE NOTICE 'OK  o mesmo arquivo em três exames (repetido na lista conta uma vez); ficam imagem e ECG';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.exame_resultados r WHERE r.vigente AND r.versao = 1 AND r.pdf_caminho = pg_temp.u('hemo') || '/laudo-laboratorio.pdf'
        AND r.exame_id IN (pg_temp.u('hemo'), pg_temp.u('crea'), pg_temp.u('livre'))) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: versões do laudo do grupo';
  END IF;
  IF (SELECT count(*) FROM public.exames_pedidos WHERE id IN (pg_temp.u('hemo'), pg_temp.u('crea'), pg_temp.u('livre')) AND situacao = 'resultado') <> 3 THEN
    RAISE EXCEPTION 'FALHOU: situação dos exames do grupo';
  END IF;
  RAISE NOTICE 'OK  cada exame com a versão 1 do mesmo arquivo, em resultado';
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
-- o exame que já tem resultado não entra de novo: troca só por retificação
SELECT pg_temp.falha(format('SELECT public.registrar_laudo_grupo(ARRAY[%L, %L]::uuid[], %L, %L)', pg_temp.u('hemo'), pg_temp.u('crea'), pg_temp.u('hemo') || '/laudo-laboratorio.pdf', 'laudo.pdf'),
  'O exame', 'exame com resultado fica fora do laudo do grupo');
-- o médico abre o laudo pela creatinina: é o arquivo do grupo
DO $$
DECLARE a jsonb; d jsonb;
BEGIN
  d := public.exame_detalhe(pg_temp.u('crea'));
  a := public.exame_laudo_abrir((d -> 'versoes' -> 0 ->> 'id')::uuid);
  IF a ->> 'caminho' <> pg_temp.u('hemo') || '/laudo-laboratorio.pdf' THEN RAISE EXCEPTION 'FALHOU: laudo aberto pela creatinina — %', a; END IF;
  RAISE NOTICE 'OK  o laudo do grupo abre por qualquer um dos exames';
END $$;
-- o registro por exame continua recusando o arquivo de outro grupo
SELECT pg_temp.falha(format('SELECT public.registrar_resultado_exame(%L, NULL, %L, %L)', pg_temp.u('rx'), pg_temp.u('hemo') || '/laudo-laboratorio.pdf', 'laudo.pdf'),
  'O laudo não é deste exame', 'arquivo do laboratório não vira laudo da imagem');
RESET ROLE;
ROLLBACK;
