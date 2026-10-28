-- Testes da migration 20270203000004_exames_por_grupo.sql (ponto 12 do
-- plantonista): o grupo sai do código (02.02 laboratório, 02.04-02.07 imagem,
-- 02.11 ECG/métodos gráficos); pedir_exames_internacao liga o exame à
-- internação, aceita um grupo por pedido, recusa a mistura, não repete o
-- pendente e barra quem não é o médico com o paciente. ROLLBACK no fim.
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
DO $$
DECLARE v text;
BEGIN
  SELECT string_agg(exame || ':' || coalesce(grupo, '-') || ':' || coalesce(urgencia, '-'), ', ' ORDER BY exame) INTO v
    FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int');
  IF v <> 'CREATININA TESTE GRUPO:laboratorio:urgente, Dosagem livre de teste:laboratorio:urgente, ELETROCARDIOGRAMA TESTE GRUPO:grafico:rotina, HEMOGRAMA TESTE GRUPO:laboratorio:urgente, RADIOGRAFIA TESTE GRUPO:imagem:rotina' THEN
    RAISE EXCEPTION 'FALHOU: exames gravados — %', v;
  END IF;
  IF EXISTS (SELECT 1 FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND paciente_id <> pg_temp.u('pac')) THEN
    RAISE EXCEPTION 'FALHOU: exame de outro paciente na internação';
  END IF;
  RAISE NOTICE 'OK  cada exame ligado à internação, com o grupo (texto livre fica com o grupo do pedido)';
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
-- mistura é recusada, e nada do pedido misturado é gravado
SELECT pg_temp.falha(format($q$SELECT public.pedir_exames_internacao(%L, '[{"procedimento":"0202990032"},{"procedimento":"0204990031"}]', 'laboratorio')$q$, pg_temp.u('int')),
  'Laboratório, imagem e ECG vão em pedidos separados', 'laboratório com imagem no mesmo pedido é recusado');
SELECT pg_temp.falha(format($q$SELECT public.pedir_exames_internacao(%L, '[{"procedimento":"0211990031"}]', 'imagem')$q$, pg_temp.u('int')),
  'Laboratório, imagem e ECG vão em pedidos separados', 'ECG não entra no pedido de imagem');
-- o pendente igual não entra de novo
SELECT pg_temp.falha(format($q$SELECT public.pedir_exames_internacao(%L, '[{"procedimento":"0202990031"}]', 'laboratorio')$q$, pg_temp.u('int')),
  'Esses exames já estão pedidos', 'exame pendente igual não repete');
SELECT pg_temp.falha(format($q$SELECT public.pedir_exames_internacao(%L, '[{"procedimento":"0202990031"}]', 'qualquer')$q$, pg_temp.u('int')),
  'Grupo do pedido', 'grupo inválido é recusado');

-- a enfermeira (de plantão no setor) não pede exame; a recepção também não
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format($q$SELECT public.pedir_exames_internacao(%L, '[{"procedimento":"0202990032"}]', 'laboratorio')$q$, pg_temp.u('int')),
  'Acesso negado', 'enfermagem não pede exame');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format($q$SELECT public.pedir_exames_internacao(%L, '[{"procedimento":"0202990032"}]', 'laboratorio')$q$, pg_temp.u('int')),
  'Acesso negado', 'recepção não pede exame');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int')) <> 5 THEN
    RAISE EXCEPTION 'FALHOU: um pedido recusado deixou exame gravado';
  END IF;
  RAISE NOTICE 'OK  pedido recusado não grava nada';
END $$;
ROLLBACK;
