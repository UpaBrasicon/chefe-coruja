-- Testes da migration 20261005000004_notificacao_compulsoria.sql. ROLLBACK no fim.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002']::uuid[]) s,
     unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

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

-- catálogo e contrato (sem login: é leitura do catálogo)
DO $$ BEGIN
  IF (SELECT count(*) FROM public.lnnc_agravos) <> 70 OR EXISTS (SELECT 1 FROM public.lnnc_agravos WHERE conferido_em IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.lnnc_cids WHERE conferido_em IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHOU: catálogo com 70 itens, todos a conferir pela vigilância';
  END IF;
  RAISE NOTICE 'OK  catálogo LNNC com 70 itens e mapeamento a conferir (conferido_em nulo)';
  IF NOT EXISTS (SELECT 1 FROM public.notificacao_compulsoria_dos_cids(ARRAY['A90 — Dengue'])
                  WHERE cid = 'A90' AND item = 10 AND agravo = 'Dengue' AND NOT imediata AND destino = 'MS, SES e SMS' AND condicao = 'óbito') THEN
    RAISE EXCEPTION 'FALHOU: contrato notificacao_compulsoria_dos_cids para A90';
  END IF;
  IF (SELECT agravo FROM public.notificacao_compulsoria_dos_cids(ARRAY['G00.0'])) <> 'Doença Invasiva por "Haemophilus Influenza"'
     OR (SELECT agravo FROM public.notificacao_compulsoria_dos_cids(ARRAY['g01'])) <> 'Doença Meningocócica e outras meningites'
     OR (SELECT agravo FROM public.notificacao_compulsoria_dos_cids(ARRAY['X25.0'])) <> 'Acidente por animal peçonhento'
     OR (SELECT agravo FROM public.notificacao_compulsoria_dos_cids(ARRAY['B573'])) <> 'Doença de Chagas Crônica'
     OR EXISTS (SELECT 1 FROM public.notificacao_compulsoria_dos_cids(ARRAY['J18.9', 'B57', 'texto', NULL])) THEN
    RAISE EXCEPTION 'FALHOU: faixas, ordem da portaria e CID não notificável';
  END IF;
  RAISE NOTICE 'OK  detecção por CID: código, faixa, ordem da portaria; J18.9 não é notificável';
  IF has_function_privilege('anon', 'public.notificacao_compulsoria_dos_cids(text[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.notificacao_compulsoria_periodo(uuid, date, date, text[])', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.lnnc_agravos', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHOU: anon sem as funções; catálogo só leitura';
  END IF;
  RAISE NOTICE 'OK  anon sem acesso; catálogo só leitura para o app';
END $$;

-- paciente com dengue (A90) no atendimento da porta
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL, '{"nome":"Notifica Dengue","data_nascimento":"1990-05-05"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'verde',
  '{"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":38.6,"saturacao-o2":98,"escala-dor":3,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep')), public.registrar_soap(pg_temp.u('ep'), 'febre', 'exantema', 'dengue?', 'hidratar', 'A90');
RESET ROLE;
INSERT INTO t SELECT 'pa', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');

-- a lista sugere, não registra
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'n_sug', count(*)::text FROM public.notificacao_compulsoria_periodo('21000000-0000-4000-8000-000000000001', private.data_atual(), NULL, NULL)
 WHERE paciente_id = pg_temp.u('pa') AND situacao = 'sugerido' AND cid = 'A90' AND item = '10' AND origem = 'CID do atendimento' AND no_acesso;
INSERT INTO t SELECT 'n_filtro', count(*)::text FROM public.notificacao_compulsoria_periodo('21000000-0000-4000-8000-000000000001', NULL, NULL, ARRAY['A15'])
 WHERE paciente_id = pg_temp.u('pa');
INSERT INTO t SELECT 'n_filtro2', count(*)::text FROM public.notificacao_compulsoria_periodo('21000000-0000-4000-8000-000000000001', NULL, NULL, ARRAY['a90'])
 WHERE paciente_id = pg_temp.u('pa');
INSERT INTO t SELECT 'n_periodo', count(*)::text FROM public.notificacao_compulsoria_periodo('21000000-0000-4000-8000-000000000001', private.data_atual() + 1, private.data_atual() + 2, NULL)
 WHERE paciente_id = pg_temp.u('pa');
SELECT pg_temp.falha(format('SELECT * FROM public.notificacao_compulsoria_periodo(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', private.data_atual() + 1, private.data_atual()),
  'Período: a data inicial é depois da final', 'período invertido é recusado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT * FROM public.notificacao_compulsoria_periodo(%L)', '21000000-0000-4000-8000-000000000001'),
  'A lista de notificação compulsória é da equipe', 'recepção não vê a lista');
SELECT pg_temp.falha(format('SELECT public.abrir_notificacao(%L, NULL, %L, %L)', pg_temp.u('pa'), 'A90', pg_temp.u('ep')),
  'A notificação é aberta pela equipe', 'recepção não abre notificação');
RESET ROLE;
DO $$ BEGIN
  IF pg_temp.u('pa') IS NULL OR (SELECT valor FROM t WHERE nome = 'n_sug') <> '1' THEN RAISE EXCEPTION 'FALHOU: caso sugerido pelo CID do atendimento'; END IF;
  IF EXISTS (SELECT 1 FROM public.agravos_notificacao WHERE paciente_id = pg_temp.u('pa')) THEN RAISE EXCEPTION 'FALHOU: a detecção registrou sozinha'; END IF;
  RAISE NOTICE 'OK  CID notificável aparece como sugerido e nada é registrado sozinho';
  IF (SELECT valor FROM t WHERE nome = 'n_filtro') <> '0' OR (SELECT valor FROM t WHERE nome = 'n_filtro2') <> '1'
     OR (SELECT valor FROM t WHERE nome = 'n_periodo') <> '0' THEN
    RAISE EXCEPTION 'FALHOU: filtros de CID e de período';
  END IF;
  RAISE NOTICE 'OK  filtros por CID (prefixo) e pela data do atendimento';
END $$;

-- a enfermeira abre, preenche, registra, reabre
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'ag', public.abrir_notificacao(pg_temp.u('pa'), NULL, 'A90', pg_temp.u('ep'));
INSERT INTO t SELECT 'ag2', public.abrir_notificacao(pg_temp.u('pa'), '10', NULL, pg_temp.u('ep'));
SELECT pg_temp.falha(format('SELECT public.abrir_notificacao(%L, %L)', pg_temp.u('pa'), '99'), 'Agravo fora da lista', 'agravo fora da LNNC é recusado');
INSERT INTO t SELECT 'n_areg', count(*)::text FROM public.notificacao_compulsoria_periodo('21000000-0000-4000-8000-000000000001')
 WHERE paciente_id = pg_temp.u('pa') AND situacao = 'a_registrar' AND agravo_id = pg_temp.u('ag') AND 'Campo 7: data dos primeiros sintomas.' = ANY (pendencias);
INSERT INTO t SELECT 'n_sug2', count(*)::text FROM public.notificacao_compulsoria_periodo('21000000-0000-4000-8000-000000000001')
 WHERE paciente_id = pg_temp.u('pa') AND situacao = 'sugerido';
INSERT INTO t SELECT 'ficha_nome', public.notificacao_ficha(pg_temp.u('ag')) -> 'ficha' ->> 'nome';
SELECT pg_temp.falha(format('SELECT public.registrar_notificacao(%L, %L)', pg_temp.u('ag'), '{"nome":"Notifica Dengue"}'),
  'Falta para registrar: Campo 7', 'registrar exige o que falta na ficha');
SELECT pg_temp.falha(format('SELECT public.registrar_notificacao(%L, %L)', pg_temp.u('ag'),
  jsonb_build_object('nome', 'Notifica Dengue', 'data_sintomas', (private.data_atual() + 3)::text, 'nascimento', '1990-05-05', 'sexo', 'M')),
  'Falta para registrar: Campo 7: data dos primeiros sintomas inválida', 'data dos sintomas no futuro é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_notificacao(%L, %L)', pg_temp.u('ag'),
  jsonb_build_object('nome', 'Notifica Dengue', 'data_sintomas', private.data_atual()::text, 'nascimento', '1990-05-05', 'sexo', 'F')),
  'Falta para registrar: Campo 12', 'sexo feminino exige o campo gestante');
SELECT pg_temp.falha(format('SELECT public.registrar_notificacao(%L, %L, %L)', pg_temp.u('ag'),
  jsonb_build_object('nome', 'Notifica Dengue', 'data_sintomas', private.data_atual()::text, 'nascimento', '1990-05-05', 'sexo', 'M'), 'ABC'),
  'Nº da notificação no SINAN: só números', 'número do SINAN só com números');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L)', pg_temp.u('ep'), 'alta'),
  'Alta: agravo suspeito sem notificação registrada: Dengue', 'notificação aberta sem registro impede a alta');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.registrar_notificacao(pg_temp.u('ag'),
  jsonb_build_object('nome', 'Notifica Dengue', 'data_sintomas', private.data_atual()::text, 'nascimento', '1990-05-05', 'sexo', 'M', 'gestante', '6', 'lixo', 'x'), '1234567');
SELECT pg_temp.falha(format('SELECT public.reabrir_notificacao(%L, %L)', pg_temp.u('ag'), 'erro'),
  'Reabrir para correção exige motivo', 'reabrir exige motivo');
SELECT public.reabrir_notificacao(pg_temp.u('ag'), 'Data dos sintomas digitada errada');
INSERT INTO t SELECT 'n_reab', count(*)::text FROM public.notificacao_compulsoria_periodo('21000000-0000-4000-8000-000000000001')
 WHERE agravo_id = pg_temp.u('ag') AND situacao = 'reaberto' AND motivo_reabertura = 'Data dos sintomas digitada errada' AND numero_sinan = '1234567';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L)', pg_temp.u('ep'), 'alta'),
  'Alta: agravo suspeito sem notificação registrada', 'notificação reaberta volta a impedir a alta');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.registrar_notificacao(pg_temp.u('ag'),
  jsonb_build_object('nome', 'Notifica Dengue', 'data_sintomas', (private.data_atual() - 1)::text, 'idade', '36', 'sexo', 'M', 'gestante', '6'));
-- acidente de trabalho: sem CID próprio, aberto na hora para paciente do plantão
INSERT INTO t SELECT 'at', public.abrir_notificacao(pg_temp.u('pa'), '1b');
SELECT public.resolver_agravo(pg_temp.u('at'), false, NULL, 'Acidente de trajeto, fora do escopo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'alta');
RESET ROLE;
DO $$ BEGIN
  IF pg_temp.u('ag') IS DISTINCT FROM pg_temp.u('ag2') THEN RAISE EXCEPTION 'FALHOU: abrir de novo devolve a mesma notificação'; END IF;
  IF (SELECT valor FROM t WHERE nome = 'n_areg') <> '1' OR (SELECT valor FROM t WHERE nome = 'n_sug2') <> '0' THEN
    RAISE EXCEPTION 'FALHOU: aberta, a sugestão vira "a registrar" com o que falta';
  END IF;
  IF (SELECT valor FROM t WHERE nome = 'ficha_nome') <> 'Notifica Dengue' THEN RAISE EXCEPTION 'FALHOU: ficha pré-preenchida pelo cadastro'; END IF;
  RAISE NOTICE 'OK  abrir a notificação: sem duplicata, ficha com o cadastro, "falta para registrar" na lista';
  IF (SELECT valor FROM t WHERE nome = 'n_reab') <> '1' THEN RAISE EXCEPTION 'FALHOU: reaberto com motivo e número mantido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = pg_temp.u('ag') AND acao = 'notificacao_reaberta') THEN
    RAISE EXCEPTION 'FALHOU: reabertura na auditoria';
  END IF;
  RAISE NOTICE 'OK  reabrir para correção: motivo, número mantido e auditoria';
  IF NOT EXISTS (SELECT 1 FROM public.agravos_notificacao WHERE id = pg_temp.u('ag') AND situacao = 'notificado' AND numero_sinan = '1234567'
                   AND lnnc_item = '10' AND origem = 'cid' AND resolvido_por = '10000000-0000-4000-8000-000000000004'
                   AND NOT ficha ? 'lixo' AND ficha ->> 'idade' = '36') THEN
    RAISE EXCEPTION 'FALHOU: registro com notificador = login e ficha limpa';
  END IF;
  RAISE NOTICE 'OK  registrar: notificador é quem está logado; só campos da ficha SINAN';
  IF (SELECT origem FROM public.agravos_notificacao WHERE id = pg_temp.u('at')) <> 'manual'
     OR (SELECT desfecho FROM public.episodios WHERE id = pg_temp.u('ep')) <> 'alta' THEN
    RAISE EXCEPTION 'FALHOU: acidente de trabalho aberto à mão e alta liberada';
  END IF;
  RAISE NOTICE 'OK  acidente de trabalho aberto à mão; com tudo registrado ou descartado, a alta passa';
END $$;
ROLLBACK;
