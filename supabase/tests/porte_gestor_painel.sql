-- Testes do painel do gestor, do Olho de Gavião e dos avisos (migrations
-- 20261006000001 a …003). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_gestor_painel.sql
-- Auditoria de check-in (previsto × realizado, tolerância de 15 min, sem
-- escala), panorama (números e o que o gestor tira do carrossel), pedido de
-- medida, pergunta sobre a gestão, varredura do Gavião (sobrecarga, descanso,
-- presença), decisões com motivo, silêncio de 7 dias e desfazer, avisos
-- marcados em lote e reabertos. Só o gestor da unidade; segundo fator.
BEGIN;
-- gestora …0001; plantonista …0002; enfermeira …0004; recepção …0005; tele …0006
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006');
DELETE FROM public.presenca_plantonista WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
DELETE FROM public.chronos_alertas_escala WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
-- plantonista: hoje há 2 h (6 h) e cinco plantões de 12 h nos dias anteriores = 66 h em 7 dias
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
       private.data_atual() - k, 'manha', now() - interval '2 hours' - make_interval(days => k), CASE WHEN k = 0 THEN 360 ELSE 720 END
  FROM generate_series(0, 5) k;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  -- enfermeira: hoje há 2 h (fim em 4 h) e outro 6 h depois do fim (descanso < 11 h)
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '2 hours', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'noite', now() + interval '10 hours', 360),
  -- recepção: ontem sem check-in; hoje começou há 1 h, sem check-in
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', private.data_atual() - 1, 'manha', now() - interval '30 hours', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  -- tele: hoje à noite, ainda não começou
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', private.data_atual(), 'noite', now() + interval '2 hours', 720);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkin_dentro, checkin_distancia_m)
SELECT '21000000-0000-4000-8000-000000000001', e.id, e.perfil_id, e.data, e.turno,
       e.inicio + CASE WHEN e.perfil_id = '10000000-0000-4000-8000-000000000002' THEN interval '5 minutes' ELSE interval '30 minutes' END,
       e.perfil_id = '10000000-0000-4000-8000-000000000002',
       CASE WHEN e.perfil_id = '10000000-0000-4000-8000-000000000002' THEN 40 ELSE 840 END
  FROM public.escala_plantao e
 WHERE e.perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004')
   AND e.data = private.data_atual() AND e.turno = 'manha';
-- tele: check-in de manhã sem plantão de manhã na escala
INSERT INTO public.presenca_plantonista (unidade_id, perfil_id, data, turno, checkin_em, checkin_dentro)
VALUES ('21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', private.data_atual(), 'manha', now() - interval '3 hours', true);
-- avisos: dois não lidos da plantonista, um da enfermeira
DELETE FROM public.notificacoes_plantonista WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', private.data_atual(), 'teste_a', 'Aviso A'),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', private.data_atual(), 'teste_b', 'Aviso B'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000001', private.data_atual(), 'teste_c', 'Aviso C');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
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

-- ── quem abre ───────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT * FROM public.auditoria_checkin('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'a plantonista não abre a auditoria de check-in');
SELECT pg_temp.falha($$SELECT public.panorama_gestor('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'a plantonista não abre o panorama');
SELECT pg_temp.falha($$SELECT * FROM public.gaviao_apontamentos('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'a plantonista não abre o Olho de Gavião');
SELECT pg_temp.falha($$SELECT public.pedir_medida('21000000-0000-4000-8000-000000000001', 'Tempo até a primeira prescrição')$$,
  'Acesso negado', 'a plantonista não pede medida');
SELECT pg_temp.falha($$SELECT public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Qual a ocupação?')$$,
  'Acesso negado', 'a plantonista não pergunta sobre a gestão');

-- ── gestora: auditoria de check-in, panorama, pergunta ──────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'ck', jsonb_agg(to_jsonb(x))::text FROM public.auditoria_checkin('21000000-0000-4000-8000-000000000001') x;
INSERT INTO t SELECT 'pano', public.panorama_gestor('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.falha($$SELECT public.definir_panorama('21000000-0000-4000-8000-000000000001', ARRAY['qualquer coisa'])$$,
  'Escolha do panorama inválida', 'o que sai do carrossel é painel (p:) ou medida (c:)');
SELECT public.definir_panorama('21000000-0000-4000-8000-000000000001', ARRAY['p:giro', 'c:agora|estoque', 'p:giro']);
INSERT INTO t SELECT 'pano2', public.panorama_gestor('21000000-0000-4000-8000-000000000001')::text;
INSERT INTO t SELECT 'perg_ocup', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Qual foi a taxa de ocupação no último mês?')::text;
INSERT INTO t SELECT 'perg_carga', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Quem está com mais plantões que o limite?')::text;
INSERT INTO t SELECT 'perg_ck', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Quem chegou atrasado hoje?')::text;
INSERT INTO t SELECT 'perg_nao', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Qual a cor preferida da equipe?')::text;
-- pedido de medida: registrar, retirar, desfazer o retirar
SELECT pg_temp.falha($$SELECT public.pedir_medida('21000000-0000-4000-8000-000000000001', 'abc')$$,
  'Descreva a medida', 'medida precisa de texto');
INSERT INTO t SELECT 'medida', public.pedir_medida('21000000-0000-4000-8000-000000000001', 'Reinternação em 7 dias por setor', 'Internações')::text;
INSERT INTO t SELECT 'med1', count(*)::text FROM public.medidas_pedidas_da_unidade('21000000-0000-4000-8000-000000000001') x
  WHERE x.id = pg_temp.v('medida')::uuid AND x.minha AND x.painel = 'Internações';
SELECT public.retirar_medida(pg_temp.v('medida')::uuid);
INSERT INTO t SELECT 'med2', count(*)::text FROM public.medidas_pedidas_da_unidade('21000000-0000-4000-8000-000000000001');
SELECT public.retirar_medida(pg_temp.v('medida')::uuid, false);
INSERT INTO t SELECT 'med3', count(*)::text FROM public.medidas_pedidas_da_unidade('21000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$INSERT INTO public.medidas_pedidas (unidade_id, autor_id, texto) VALUES ('21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'direto na tabela')$$,
  'permission denied', 'o cliente não grava pedido de medida direto na tabela');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'med_plant', count(*)::text FROM public.medidas_pedidas;
INSERT INTO t SELECT 'pref_plant', count(*)::text FROM public.panorama_preferencias;
RESET ROLE;

DO $$
DECLARE
  ck jsonb := pg_temp.v('ck')::jsonb;
  n jsonb := pg_temp.v('pano')::jsonb -> 'n';
  sit text;
BEGIN
  SELECT x ->> 'situacao' INTO sit FROM jsonb_array_elements(ck) x WHERE x ->> 'perfil_id' = '10000000-0000-4000-8000-000000000002';
  IF sit <> 'confere' THEN RAISE EXCEPTION 'FALHOU: check-in 5 min depois, dentro do raio (%)', sit; END IF;
  RAISE NOTICE 'OK  check-in até 15 minutos depois e dentro do raio confere';
  SELECT x ->> 'situacao' INTO sit FROM jsonb_array_elements(ck) x
   WHERE x ->> 'perfil_id' = '10000000-0000-4000-8000-000000000004' AND x ->> 'turno' = 'manha';
  IF sit <> 'atraso_fora_do_raio' THEN RAISE EXCEPTION 'FALHOU: 30 min de atraso e fora do raio (%)', sit; END IF;
  IF (SELECT (x ->> 'diferenca_min')::int FROM jsonb_array_elements(ck) x
       WHERE x ->> 'perfil_id' = '10000000-0000-4000-8000-000000000004' AND x ->> 'turno' = 'manha') <> 30 THEN
    RAISE EXCEPTION 'FALHOU: a diferença previsto × realizado';
  END IF;
  RAISE NOTICE 'OK  atraso e fora do raio, com a diferença em minutos';
  SELECT x ->> 'situacao' INTO sit FROM jsonb_array_elements(ck) x
   WHERE x ->> 'perfil_id' = '10000000-0000-4000-8000-000000000004' AND x ->> 'turno' = 'noite';
  IF sit <> 'a_comecar' THEN RAISE EXCEPTION 'FALHOU: plantão que não começou (%)', sit; END IF;
  SELECT x ->> 'situacao' INTO sit FROM jsonb_array_elements(ck) x WHERE x ->> 'perfil_id' = '10000000-0000-4000-8000-000000000005';
  IF sit <> 'sem_checkin' THEN RAISE EXCEPTION 'FALHOU: começou há 1 hora sem check-in (%)', sit; END IF;
  RAISE NOTICE 'OK  sem check-in depois dos 15 minutos; o que não começou não é divergência';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ck) x WHERE x ->> 'perfil_id' = '10000000-0000-4000-8000-000000000006'
                   AND x ->> 'situacao' = 'sem_escala' AND x ->> 'plantao_id' IS NULL)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ck) x WHERE x ->> 'perfil_id' = '10000000-0000-4000-8000-000000000006'
                   AND x ->> 'situacao' = 'a_comecar') THEN
    RAISE EXCEPTION 'FALHOU: check-in sem plantão na escala (%)', ck;
  END IF;
  RAISE NOTICE 'OK  check-in sem plantão na escala aparece à parte';
  IF (n ->> 'checkin_divergentes')::int <> 3 OR (n ->> 'checkin_total')::int <> 4 OR (n ->> 'sem_checkin')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: contagem do check-in no panorama (%)', n;
  END IF;
  RAISE NOTICE 'OK  o panorama conta 3 divergências em 4 (o que não começou fica fora)';
  IF (n ->> 'leitos')::int < 1 OR (n ->> 'internados')::int < 3 OR n ->> 'escalados_hoje' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: números do panorama (%)', n;
  END IF;
  RAISE NOTICE 'OK  o panorama traz leitos, internados e escala da unidade';
  IF pg_temp.v('pano')::jsonb -> 'fora' <> '[]'::jsonb
     OR pg_temp.v('pano2')::jsonb -> 'fora' <> '["c:agora|estoque", "p:giro"]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: o que sai do carrossel fica gravado, sem repetição (%)', pg_temp.v('pano2')::jsonb -> 'fora';
  END IF;
  RAISE NOTICE 'OK  o que o gestor tira do carrossel fica no banco';
  IF pg_temp.v('pref_plant')::int <> 0 OR pg_temp.v('med_plant')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: a plantonista leu preferências ou medidas do gestor';
  END IF;
  RAISE NOTICE 'OK  preferências e medidas não aparecem para a plantonista';
  IF pg_temp.v('med1')::int <> 1 OR pg_temp.v('med2')::int <> 0 OR pg_temp.v('med3')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: pedir, retirar e desfazer a medida (% % %)', pg_temp.v('med1'), pg_temp.v('med2'), pg_temp.v('med3');
  END IF;
  RAISE NOTICE 'OK  a medida pedida fica em preparo, sai ao retirar e volta ao desfazer';
  IF pg_temp.v('perg_ocup')::jsonb ->> 'tema' <> 'ocupacao' OR pg_temp.v('perg_carga')::jsonb ->> 'tema' <> 'carga'
     OR pg_temp.v('perg_ck')::jsonb ->> 'tema' <> 'checkin' OR (pg_temp.v('perg_nao')::jsonb ->> 'entendida')::boolean THEN
    RAISE EXCEPTION 'FALHOU: temas da pergunta';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('perg_carga')::jsonb -> 'itens') x
                  WHERE x ->> 'rotulo' = 'Plantonista de Teste' AND x ->> 'valor' LIKE '66,0 h%acima de 60 h') THEN
    RAISE EXCEPTION 'FALHOU: a carga de 66 h aparece na resposta (%)', pg_temp.v('perg_carga');
  END IF;
  RAISE NOTICE 'OK  a pergunta responde pelo banco por tema e diz quando não sabe';
END $$;

-- ── Olho de Gavião ──────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'ap', jsonb_agg(to_jsonb(x))::text FROM public.gaviao_apontamentos('21000000-0000-4000-8000-000000000001') x;
INSERT INTO t SELECT 'k_horas', x.chave FROM public.gaviao_apontamentos('21000000-0000-4000-8000-000000000001') x
  WHERE x.chave LIKE 'horas:10000000-0000-4000-8000-000000000002:ultimos:%';
INSERT INTO t SELECT 'k_desc', x.chave FROM public.gaviao_apontamentos('21000000-0000-4000-8000-000000000001') x
  WHERE x.chave LIKE 'descanso:10000000-0000-4000-8000-000000000004:%';
INSERT INTO t SELECT 'k_aus', x.chave FROM public.gaviao_apontamentos('21000000-0000-4000-8000-000000000001') x
  WHERE x.chave LIKE 'ausencia:10000000-0000-4000-8000-000000000005:%';
SELECT pg_temp.falha(format('SELECT public.decidir_apontamento_gaviao(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', pg_temp.v('k_aus'), 'descartado'),
  'Diga por que o apontamento não procede', 'descartar exige motivo');
SELECT pg_temp.falha($$SELECT public.decidir_apontamento_gaviao('21000000-0000-4000-8000-000000000001', 'horas:inventada', 'tratado')$$,
  'Este apontamento não está mais na varredura', 'não se decide apontamento que a varredura não trouxe');
INSERT INTO t SELECT 'd_horas', public.decidir_apontamento_gaviao('21000000-0000-4000-8000-000000000001', pg_temp.v('k_horas'), 'tratado')::text;
SELECT pg_temp.falha(format('SELECT public.decidir_apontamento_gaviao(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', pg_temp.v('k_horas'), 'silenciado'),
  'Este apontamento já tem decisão', 'uma decisão vigente por apontamento');
INSERT INTO t SELECT 'd_aus', public.decidir_apontamento_gaviao('21000000-0000-4000-8000-000000000001', pg_temp.v('k_aus'), 'descartado', 'A escala já foi refeita')::text;
INSERT INTO t SELECT 'd_desc', public.decidir_apontamento_gaviao('21000000-0000-4000-8000-000000000001', pg_temp.v('k_desc'), 'silenciado')::text;
-- desfazer o descarte: o apontamento volta aberto
SELECT public.desfazer_decisao_gaviao(pg_temp.v('d_aus')::uuid);
SELECT pg_temp.falha(format('SELECT public.desfazer_decisao_gaviao(%L)', pg_temp.v('d_aus')), 'Esta decisão já foi desfeita', 'desfaz-se uma vez');
INSERT INTO t SELECT 'ap2', jsonb_agg(to_jsonb(x))::text FROM public.gaviao_apontamentos('21000000-0000-4000-8000-000000000001') x;
INSERT INTO t SELECT 'reg', jsonb_agg(to_jsonb(x))::text FROM public.gaviao_registro('21000000-0000-4000-8000-000000000001') x;
SELECT pg_temp.falha($$INSERT INTO public.gaviao_decisoes (unidade_id, chave, titulo, tipo, severidade, decisao, autor_id)
  VALUES ('21000000-0000-4000-8000-000000000001', 'x:y', 't', 'Presença', 'baixa', 'tratado', '10000000-0000-4000-8000-000000000001')$$,
  'permission denied', 'o cliente não grava decisão direto na tabela');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'dec_plant', count(*)::text FROM public.gaviao_decisoes;
RESET ROLE;
-- o silêncio venceu e a decisão de horas passou de 10 minutos
UPDATE public.gaviao_decisoes SET silenciado_ate = now() - interval '1 minute' WHERE id = pg_temp.v('d_desc')::uuid;
UPDATE public.gaviao_decisoes SET criado_em = now() - interval '11 minutes' WHERE id = pg_temp.v('d_horas')::uuid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'ap3', jsonb_agg(to_jsonb(x))::text FROM public.gaviao_apontamentos('21000000-0000-4000-8000-000000000001') x;
SELECT pg_temp.falha(format('SELECT public.desfazer_decisao_gaviao(%L)', pg_temp.v('d_horas')),
  'O desfazer vale por 10 minutos', 'o desfazer vale por 10 minutos');
RESET ROLE;

DO $$
DECLARE
  ap jsonb := pg_temp.v('ap')::jsonb;
  ap2 jsonb := pg_temp.v('ap2')::jsonb;
  ap3 jsonb := pg_temp.v('ap3')::jsonb;
  reg jsonb := pg_temp.v('reg')::jsonb;
BEGIN
  IF pg_temp.v('k_horas') IS NULL OR (SELECT x ->> 'severidade' FROM jsonb_array_elements(ap) x WHERE x ->> 'chave' = pg_temp.v('k_horas')) <> 'alta' THEN
    RAISE EXCEPTION 'FALHOU: 66 horas em 7 dias viram sobrecarga alta (%)', ap;
  END IF;
  RAISE NOTICE 'OK  sobrecarga: mais de 60 horas escaladas em 7 dias';
  IF pg_temp.v('k_desc') IS NULL THEN RAISE EXCEPTION 'FALHOU: descanso de 6 horas entre jornadas (%)', ap; END IF;
  RAISE NOTICE 'OK  descanso menor que 11 horas entre jornadas';
  IF pg_temp.v('k_aus') IS NULL
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ap) x WHERE x ->> 'chave' LIKE 'sem_escala:10000000-0000-4000-8000-000000000006:%') THEN
    RAISE EXCEPTION 'FALHOU: presença — plantão sem check-in e check-in sem escala (%)', ap;
  END IF;
  -- a plantonista: os cinco dias anteriores sem check-in; o de hoje tem check-in
  IF (SELECT x ->> 'titulo' FROM jsonb_array_elements(ap) x WHERE x ->> 'chave' LIKE 'ausencia:10000000-0000-4000-8000-000000000002:%')
     NOT LIKE '% com 5 plantões sem check-in%' THEN
    RAISE EXCEPTION 'FALHOU: plantão com check-in (ou que não terminou) não é ausência (%)', ap;
  END IF;
  RAISE NOTICE 'OK  presença: plantão passado sem check-in e check-in sem plantão';
  IF (SELECT x ->> 'decisao' FROM jsonb_array_elements(ap2) x WHERE x ->> 'chave' = pg_temp.v('k_horas')) <> 'tratado'
     OR (SELECT x ->> 'decidido_por' FROM jsonb_array_elements(ap2) x WHERE x ->> 'chave' = pg_temp.v('k_horas')) <> 'Gestora de Teste'
     OR (SELECT x ->> 'decisao' FROM jsonb_array_elements(ap2) x WHERE x ->> 'chave' = pg_temp.v('k_desc')) <> 'silenciado' THEN
    RAISE EXCEPTION 'FALHOU: decisão vigente no apontamento (%)', ap2;
  END IF;
  IF (SELECT x ->> 'decisao' FROM jsonb_array_elements(ap2) x WHERE x ->> 'chave' = pg_temp.v('k_aus')) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: o descarte desfeito devolve o apontamento aberto';
  END IF;
  RAISE NOTICE 'OK  a decisão fica no apontamento com autor; o desfeito volta aberto';
  IF jsonb_array_length(reg) <> 3
     OR (SELECT x ->> 'motivo' FROM jsonb_array_elements(reg) x WHERE x ->> 'id' = pg_temp.v('d_aus')) <> 'A escala já foi refeita'
     OR (SELECT x ->> 'desfeita_em' FROM jsonb_array_elements(reg) x WHERE x ->> 'id' = pg_temp.v('d_aus')) IS NULL THEN
    RAISE EXCEPTION 'FALHOU: o registro guarda as decisões, o motivo e o desfazer (%)', reg;
  END IF;
  RAISE NOTICE 'OK  o registro guarda toda decisão, com motivo, e marca a desfeita sem apagar';
  IF (SELECT x ->> 'decisao' FROM jsonb_array_elements(ap3) x WHERE x ->> 'chave' = pg_temp.v('k_desc')) IS NOT NULL
     OR (SELECT x ->> 'decisao' FROM jsonb_array_elements(ap3) x WHERE x ->> 'chave' = pg_temp.v('k_horas')) <> 'tratado' THEN
    RAISE EXCEPTION 'FALHOU: silêncio vencido volta aberto; tratado fica (%)', ap3;
  END IF;
  RAISE NOTICE 'OK  o silêncio vale até o prazo; o tratado continua';
  IF pg_temp.v('dec_plant')::int <> 0 THEN RAISE EXCEPTION 'FALHOU: a plantonista leu as decisões do Gavião'; END IF;
  RAISE NOTICE 'OK  as decisões do Gavião não aparecem para a plantonista';
END $$;

-- ── avisos: marcar em lote e desfazer ───────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'marcados', array_to_string(public.marcar_avisos_lidos('21000000-0000-4000-8000-000000000001'), ',');
INSERT INTO t SELECT 'de_novo', cardinality(public.marcar_avisos_lidos('21000000-0000-4000-8000-000000000001'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'reabre_outro', public.reabrir_avisos(string_to_array(pg_temp.v('marcados'), ',')::uuid[])::text;
INSERT INTO t SELECT 'c_ainda', count(*)::text FROM public.minhas_notificacoes('21000000-0000-4000-8000-000000000001') x WHERE NOT x.lida;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'reabre', public.reabrir_avisos(string_to_array(pg_temp.v('marcados'), ',')::uuid[])::text;
INSERT INTO t SELECT 'nao_lidos', count(*)::text FROM public.minhas_notificacoes('21000000-0000-4000-8000-000000000001') x WHERE NOT x.lida;
RESET ROLE;
DO $$
BEGIN
  IF cardinality(string_to_array(pg_temp.v('marcados'), ',')) <> 2 OR pg_temp.v('de_novo')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: marcar todas devolve os dois não lidos, e só uma vez (% / %)', pg_temp.v('marcados'), pg_temp.v('de_novo');
  END IF;
  RAISE NOTICE 'OK  marcar todas como lidas devolve os avisos que mudaram';
  IF pg_temp.v('reabre_outro')::int <> 0 OR pg_temp.v('c_ainda')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: aviso de outra pessoa (% / %)', pg_temp.v('reabre_outro'), pg_temp.v('c_ainda');
  END IF;
  RAISE NOTICE 'OK  ninguém reabre nem marca aviso de outra pessoa';
  IF pg_temp.v('reabre')::int <> 2 OR pg_temp.v('nao_lidos')::int <> 2 THEN
    RAISE EXCEPTION 'FALHOU: o desfazer reabre os dois (% / %)', pg_temp.v('reabre'), pg_temp.v('nao_lidos');
  END IF;
  RAISE NOTICE 'OK  o desfazer volta os avisos a não lidos';
END $$;

-- ── segundo fator ligado: sem ele, nada abre ────────────────────────────────
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.panorama_gestor('21000000-0000-4000-8000-000000000001')$$,
  'SEGUNDO_FATOR', 'o panorama exige o segundo fator');
SELECT pg_temp.falha($$SELECT * FROM public.gaviao_apontamentos('21000000-0000-4000-8000-000000000001')$$,
  'SEGUNDO_FATOR', 'o Olho de Gavião exige o segundo fator');
RESET ROLE;
ROLLBACK;
