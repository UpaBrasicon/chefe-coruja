-- Testes da Central do Farmacêutico (migration 20261009000001). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_farmacia.sql
-- Limites padrão da unidade e "voltar ao padrão"; a falta aberta na tela de
-- estoque; o registro do arquivo enviado (extensão, pasta da unidade, arquivo
-- presente no armazenamento, só inserção); "ajustar esta linha" e "voltar ao
-- modelo" da diluição, com flebite e alta vigilância, só pelo farmacêutico
-- da unidade dona da linha.
BEGIN;
-- …0003 é farmacêutico da Unidade Teste; …0004 é farmacêutico da UPA Centro
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 'farmaceutico'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000101', 'farmaceutico')
ON CONFLICT DO NOTHING;
-- o banco local pode ter padrão de limites de conferências anteriores
DELETE FROM public.farmacia_limites_padrao WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte, alta_vigilancia)
VALUES ('Vancomicina', 'vancomicina', 'pó 500 mg', 'teste-porte-farmacia', false);

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'van', id::text FROM public.medicamento WHERE fonte = 'teste-porte-farmacia';
-- o modelo da rede, publicado ontem
INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, diluicao_solucao, diluicao_volume_min_ml,
  tempo_infusao_min, fonte, revisor_crf, status, versao, vigente_desde, publicado_em)
SELECT id, 'Vancomicina', 'pó 500 mg', 'EV', ARRAY['SF 0,9%'], 100, 60, 'fonte de teste', 'CRF-SP 1', 'publicado', 1,
       now() - interval '1 day', now() - interval '1 day'
FROM public.medicamento WHERE fonte = 'teste-porte-farmacia';
INSERT INTO t SELECT 'modelo', id::text FROM public.diluicao WHERE fonte = 'fonte de teste';
-- o arquivo "subido" pelo cliente (o teste escreve direto no armazenamento)
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('farmacia', '21000000-0000-4000-8000-000000000001/lista_medicacoes/teste-lista.csv'),
  ('farmacia', '21000000-0000-4000-8000-000000000001/lista_medicacoes/teste-lista.exe');

CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated;
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
CREATE FUNCTION pg_temp.igual(p_obtido text, p_esperado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtido IS DISTINCT FROM p_esperado THEN RAISE EXCEPTION 'FALHOU: % (obtido %, esperado %)', p_ok, p_obtido, p_esperado; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.igual(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.sit() RETURNS text LANGUAGE sql AS $$
  SELECT situacao || ':' || limite_proprio FROM public.farmacia_estoque('21000000-0000-4000-8000-000000000001')
   WHERE medicamento_id = pg_temp.u('van') $$;
GRANT EXECUTE ON FUNCTION pg_temp.sit() TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. quem mexe ────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.definir_limites_padrao_farmacia('21000000-0000-4000-8000-000000000001', 10, 3)$$,
  'O padrão de limites é do farmacêutico', 'o plantonista não define o padrão de limites');
SELECT pg_temp.falha($$SELECT * FROM public.farmacia_estoque('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado: estoque', 'o plantonista não abre a tela de estoque');
SELECT pg_temp.falha($$SELECT public.padrao_diluicao_unidade('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado: padrão de diluição', 'o plantonista não abre o padrão da unidade pela farmácia');

-- ── 2. limites: padrão da unidade e o do item ───────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.atualizar_estoque('21000000-0000-4000-8000-000000000001', pg_temp.u('van'), 5);
SELECT pg_temp.igual(pg_temp.sit(), 'ok:false', 'sem limite nenhum o item fica ok');
SELECT public.definir_limites_padrao_farmacia('21000000-0000-4000-8000-000000000001', 10, 3);
SELECT pg_temp.igual(pg_temp.sit(), 'critico:false', 'o padrão da unidade vale para o item sem limite próprio');
SELECT pg_temp.igual((SELECT situacao FROM public.disponibilidade('21000000-0000-4000-8000-000000000001') WHERE medicamento_id = pg_temp.u('van')),
  'critico', 'a disponibilidade (fase 4.9) usa o mesmo selo');
SELECT public.atualizar_estoque('21000000-0000-4000-8000-000000000001', pg_temp.u('van'), 5, 4, 2);
SELECT pg_temp.igual(pg_temp.sit(), 'ok:true', 'o limite próprio do item vence o padrão');
SELECT public.atualizar_estoque('21000000-0000-4000-8000-000000000001', pg_temp.u('van'), 3);
SELECT pg_temp.igual(pg_temp.sit(), 'critico:true', 'salvar só a quantidade mantém o limite próprio');
SELECT public.limites_voltar_ao_padrao('21000000-0000-4000-8000-000000000001', pg_temp.u('van'));
SELECT pg_temp.igual(pg_temp.sit(), 'falta:false', 'voltar ao padrão apaga o limite próprio (3 ≤ falta 3 da unidade)');
SELECT pg_temp.falha($$SELECT public.definir_limites_padrao_farmacia('21000000-0000-4000-8000-000000000001', 2, 5)$$,
  'O limite de falta não pode ser maior', 'padrão com falta acima do crítico é recusado');

-- ── 3. sinalizar falta pela tela de estoque ─────────────────────────────────
INSERT INTO t SELECT 'falta', public.sinalizar_falta('21000000-0000-4000-8000-000000000001', pg_temp.u('van'), 'saldo zerado na satélite');
SELECT pg_temp.igual((SELECT falta_id::text || ':' || falta_situacao FROM public.farmacia_estoque('21000000-0000-4000-8000-000000000001')
                       WHERE medicamento_id = pg_temp.u('van')),
  pg_temp.v('falta') || ':registrada', 'a falta aberta aparece no item (a tela troca o botão por "Falta enviada")');

-- ── 4. arquivo enviado ──────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.registrar_arquivo_farmacia('21000000-0000-4000-8000-000000000001', 'lista_medicacoes',
  '21000000-0000-4000-8000-000000000001/lista_medicacoes/teste-lista.exe', 'lista.exe', 100)$$,
  'Envie planilha, documento ou PDF', 'arquivo fora dos formatos é recusado');
SELECT pg_temp.falha($$SELECT public.registrar_arquivo_farmacia('21000000-0000-4000-8000-000000000001', 'lista_medicacoes',
  '00000000-0000-0000-0000-000000000101/lista_medicacoes/teste-lista.csv', 'lista.csv', 100)$$,
  'Caminho do arquivo fora da pasta', 'arquivo em pasta de outra unidade é recusado');
SELECT pg_temp.falha($$SELECT public.registrar_arquivo_farmacia('21000000-0000-4000-8000-000000000001', 'lista_medicacoes',
  '21000000-0000-4000-8000-000000000001/lista_medicacoes/nao-subiu.csv', 'nao-subiu.csv', 100)$$,
  'O arquivo não chegou', 'arquivo que não está no armazenamento não é registrado');
INSERT INTO t SELECT 'arq', public.registrar_arquivo_farmacia('21000000-0000-4000-8000-000000000001', 'lista_medicacoes',
  '21000000-0000-4000-8000-000000000001/lista_medicacoes/teste-lista.csv', 'lista da central.csv', 2048, 'text/csv');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.arquivos_farmacia WHERE id = pg_temp.u('arq')), '1', 'o farmacêutico vê o arquivo registrado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.arquivos_farmacia WHERE id = pg_temp.u('arq')), '1', 'o gestor da unidade vê o arquivo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.arquivos_farmacia WHERE id = pg_temp.u('arq')), '0', 'o plantonista não vê o arquivo');
RESET ROLE;
SELECT pg_temp.falha(format('DELETE FROM public.arquivos_farmacia WHERE id = %L', pg_temp.u('arq')), '', 'o registro do arquivo não se apaga');

-- ── 5. ajustar a linha e voltar ao modelo ───────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.igual((SELECT (x ->> 'da_unidade') || ':' || (x ->> 'id') FROM jsonb_array_elements(public.padrao_diluicao_unidade('21000000-0000-4000-8000-000000000001')) x
                       WHERE x ->> 'medicamento_id' = pg_temp.v('van')),
  'false:' || pg_temp.v('modelo'), 'sem ajuste, vale para a unidade o modelo da rede');
INSERT INTO t SELECT 'r1', public.ajustar_diluicao_unidade(pg_temp.u('modelo'), '21000000-0000-4000-8000-000000000001');
SELECT pg_temp.igual(public.ajustar_diluicao_unidade(pg_temp.u('modelo'), '21000000-0000-4000-8000-000000000001')::text, pg_temp.v('r1'),
  'ajustar de novo continua no mesmo rascunho da unidade');
SELECT public.salvar_diluicao(pg_temp.u('r1'), '{"tempo_infusao_min": "120", "risco_flebite": true, "alta_vigilancia": true,
  "revisor_crf": "CRF-SP 12345", "motivo_alteracao": "infusão em 2 horas pelo protocolo da unidade"}'::jsonb);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.salvar_diluicao(%L, %L)', pg_temp.u('r1'), '{"tempo_infusao_min": "30"}'),
  'Esta linha é do padrão de outra unidade', 'farmacêutico de outra unidade não mexe no rascunho da unidade');
SELECT pg_temp.falha(format('SELECT public.publicar_diluicao_versao(%L)', pg_temp.u('r1')),
  'Esta linha é do padrão de outra unidade', 'farmacêutico de outra unidade não publica a linha da unidade');
SELECT pg_temp.falha(format('SELECT public.ajustar_diluicao_unidade(%L, %L)', pg_temp.u('modelo'), '21000000-0000-4000-8000-000000000001'),
  'Ajustar o padrão da unidade é do farmacêutico dela', 'farmacêutico de outra unidade não ajusta a linha dela');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.publicar_diluicao_versao(pg_temp.u('r1'));
SELECT pg_temp.igual((SELECT id::text FROM public.diluicao_vigente(pg_temp.u('van'), 'EV', now(), '21000000-0000-4000-8000-000000000001')),
  pg_temp.v('r1'), 'publicada, a prescrição da unidade recebe a linha da unidade');
SELECT pg_temp.igual((SELECT id::text FROM public.diluicao_vigente(pg_temp.u('van'), 'EV', now(), '00000000-0000-0000-0000-000000000101')),
  pg_temp.v('modelo'), 'as outras unidades continuam com o modelo');
SELECT pg_temp.igual((SELECT concat_ws(':', x ->> 'da_unidade', x ->> 'risco_flebite', x ->> 'alta_vigilancia', x -> 'modelo' ->> 'id',
                                       x -> 'modelo' -> 'campos' ->> 'tempo_infusao_min', x -> 'campos' ->> 'tempo_infusao_min')
                        FROM jsonb_array_elements(public.padrao_diluicao_unidade('21000000-0000-4000-8000-000000000001')) x
                       WHERE x ->> 'medicamento_id' = pg_temp.v('van')),
  'true:true:true:' || pg_temp.v('modelo') || ':60:120', 'o padrão mostra a linha da unidade, flebite, alta vigilância e o modelo ao lado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.diluicao_voltar_ao_modelo(%L, %L)', pg_temp.u('r1'), 'motivo bem explicado aqui'),
  'Ajustar o padrão da unidade é do farmacêutico dela', 'farmacêutico de outra unidade não volta a linha dela ao modelo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha(format('SELECT public.diluicao_voltar_ao_modelo(%L, %L)', pg_temp.u('r1'), 'curto'),
  'Diga por que volta ao modelo', 'voltar ao modelo pede o motivo');
SELECT pg_temp.falha(format('SELECT public.diluicao_voltar_ao_modelo(%L, %L)', pg_temp.u('modelo'), 'motivo bem explicado aqui'),
  'Só volta ao modelo a linha da unidade', 'o modelo da rede não "volta ao modelo"');
SELECT public.diluicao_voltar_ao_modelo(pg_temp.u('r1'), 'a comissão decidiu seguir o modelo da rede');
SELECT pg_temp.igual((SELECT id::text FROM public.diluicao_vigente(pg_temp.u('van'), 'EV', now() + interval '1 second', '21000000-0000-4000-8000-000000000001')),
  pg_temp.v('modelo'), 'depois de voltar ao modelo, a unidade recebe o modelo da rede');
SELECT pg_temp.igual((SELECT id::text FROM public.diluicao_vigente(pg_temp.u('van'), 'EV', now() - interval '1 second', '21000000-0000-4000-8000-000000000001')),
  pg_temp.v('modelo'), 'antes de publicar valia o modelo (a prescrição guarda a versão dela)');
RESET ROLE;
SELECT pg_temp.igual((SELECT status FROM public.diluicao WHERE id = pg_temp.u('r1')), 'substituido', 'a linha da unidade fica no histórico como substituída');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.log_auditoria WHERE entidade = 'diluicao' AND entidade_id = pg_temp.u('r1')
                        AND acao = 'diluicao_voltar_ao_modelo')
                     || ':' || (SELECT motivo FROM public.diluicao_encerramentos WHERE diluicao_id = pg_temp.u('r1')),
  '1:a comissão decidiu seguir o modelo da rede', 'voltar ao modelo fica na auditoria, com o motivo guardado ao lado');
ROLLBACK;
