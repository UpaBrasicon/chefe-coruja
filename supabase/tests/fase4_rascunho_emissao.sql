-- Testes da migration 20260929000001_fase4_rascunho_emissao.sql. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase4_rascunho_emissao.sql
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002']::uuid[]) s,
     unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.v(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.v(text) TO authenticated;
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

-- paciente atendido e em observação (para ver o impeditivo de alta)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Rascunho Teste","data_nascimento":"1975-05-05"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
SELECT public.registrar_soap(pg_temp.u('ep'), 'dor', 'exame', 'avaliação', 'plano', 'R52');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'observacao');
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO t SELECT 'int', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('ep');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'r1', public.salvar_rascunho(pg_temp.u('pac'), 'receita', '{"itens":["a"]}');
INSERT INTO t SELECT 'r1b', public.salvar_rascunho(pg_temp.u('pac'), 'receita', '{"itens":["a","b"]}');
SELECT public.salvar_rascunho(pg_temp.u('pac'), 'receita', '{"receita":{"itens":[{"medicamento":"a","posologia":"1 cp de 8/8 h"}]}}', pg_temp.u('r1'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.salvar_rascunho(%L, %L, %L, %L)', pg_temp.u('pac'), 'receita', '{"x":1}', pg_temp.u('r1')),
  'Só o autor edita', 'só o autor edita o próprio rascunho');
SELECT pg_temp.falha(format('SELECT public.emitir_rascunho(%L)', pg_temp.u('r1')), 'Só o autor emite', 'só o autor emite o próprio rascunho');
RESET ROLE;
INSERT INTO t SELECT 'imp', private.impeditivos_alta(pg_temp.u('int'))::text;
DO $$
DECLARE d public.documentos_clinicos;
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = pg_temp.u('r1');
  IF pg_temp.u('r1b') <> pg_temp.u('r1') OR d.estado <> 'rascunho' OR d.numero IS NOT NULL
     OR d.conteudo <> '{"receita":{"itens":[{"medicamento":"a","posologia":"1 cp de 8/8 h"}]}}' OR d.internacao_id <> pg_temp.u('int') THEN
    RAISE EXCEPTION 'FALHOU: rascunho (%)', d;
  END IF;
  RAISE NOTICE 'OK  rascunho no banco: um por autor/tipo/episódio, sem número, ligado à internação';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('imp')) x WHERE x ->> 'tipo' = 'documento'
                   AND x ->> 'descricao' LIKE '%receita de Plantonista de Teste') THEN
    RAISE EXCEPTION 'FALHOU: rascunho aberto não impede a alta (%)', pg_temp.v('imp');
  END IF;
  RAISE NOTICE 'OK  rascunho aberto impede a alta e diz de quem é';
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'e1', public.emitir_rascunho(pg_temp.u('r1'))::text;
INSERT INTO t SELECT 'e1b', public.emitir_rascunho(pg_temp.u('r1'))::text;
INSERT INTO t SELECT 'r2', public.salvar_rascunho(pg_temp.u('pac'), 'receita', '{"itens":["nova"]}');
SELECT public.descartar_rascunho(pg_temp.u('r2'));
SELECT pg_temp.falha(format('SELECT public.salvar_rascunho(%L, %L, %L, %L)', pg_temp.u('pac'), 'receita', '{"x":1}', pg_temp.u('r1')),
  'Rascunho não encontrado', 'documento emitido não volta a ser editado como rascunho');
RESET ROLE;
DO $$
DECLARE d public.documentos_clinicos;
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = pg_temp.u('r1');
  IF d.estado <> 'ativo' OR d.numero !~ '^\d{4}/\d{6}$' OR d.emitido_em IS NULL
     OR pg_temp.v('e1') ->> 'numero' <> d.numero OR pg_temp.v('e1b') ->> 'numero' <> d.numero THEN
    RAISE EXCEPTION 'FALHOU: emissão (%)', d;
  END IF;
  RAISE NOTICE 'OK  emitir dá número definitivo (%); duplo clique não gera outro', d.numero;
  IF pg_temp.u('r2') = pg_temp.u('r1') OR (SELECT estado FROM public.documentos_clinicos WHERE id = pg_temp.u('r2')) <> 'cancelado' THEN
    RAISE EXCEPTION 'FALHOU: novo rascunho após emitir / descartar';
  END IF;
  RAISE NOTICE 'OK  depois de emitir, o próximo rascunho é outro documento; descartar cancela';
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(private.impeditivos_alta(pg_temp.u('int'))) x WHERE x ->> 'tipo' = 'documento') THEN
    RAISE EXCEPTION 'FALHOU: impeditivo depois de emitir e descartar';
  END IF;
  RAISE NOTICE 'OK  emitido ou descartado, o rascunho deixa de impedir a alta';
END $$;

-- retificar: só o autor
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');   -- gestora
SELECT pg_temp.falha(format('SELECT public.emitir_documento(%L, %L, %L, NULL, %L, %L)', pg_temp.u('pac'), 'receita', '{"itens":["x"]}',
  pg_temp.u('r1'), 'correção feita por outra pessoa'), 'Só o autor corrige', 'retificar documento emitido é só do autor');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'ret', public.emitir_documento(pg_temp.u('pac'), 'receita', '{"itens":["a","b","d"]}', NULL, pg_temp.u('r1'),
  'item c trocado por d após reavaliação')::text;
RESET ROLE;
DO $$ BEGIN
  IF (pg_temp.v('ret') ->> 'versao')::int <> 2
     OR (SELECT estado FROM public.documentos_clinicos WHERE id = pg_temp.u('r1')) <> 'retificado' THEN
    RAISE EXCEPTION 'FALHOU: retificação pelo autor';
  END IF;
  RAISE NOTICE 'OK  o autor retifica: versão 2 com motivo, a anterior fica retificada';
END $$;

-- ── 4.2: folha do servidor (RPC folha_documento) ────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'r3', public.salvar_rascunho(pg_temp.u('pac'), 'atestado', '{"atestado":{"dias":"2"}}');
-- onda 6 (20261005000001): o rascunho sai só para o autor, marcado e sem número
INSERT INTO t SELECT 'fr', public.folha_documento(pg_temp.u('r3'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.folha_documento(%L)', pg_temp.u('r3')), 'Rascunho só é impresso por quem o escreve',
  'rascunho de outra pessoa não vai ao papel');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'fo', public.folha_documento((pg_temp.v('ret') ->> 'id')::uuid, 'Receituário')::text;
RESET ROLE;
DO $$
DECLARE f jsonb := pg_temp.v('fo');
BEGIN
  IF pg_temp.v('fr') ->> 'estado' <> 'rascunho' OR pg_temp.v('fr') ->> 'numero' IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: folha do rascunho (%)', pg_temp.v('fr');
  END IF;
  RAISE NOTICE 'OK  o autor imprime o próprio rascunho, sem número (a folha sai marcada RASCUNHO)';
  IF f ->> 'numero' IS NULL OR (f ->> 'versao')::int <> 2 OR f ->> 'codigo' !~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'
     OR f ->> 'protocolo' !~ '^IMP-' OR f ->> 'autor' <> 'Plantonista de Teste' OR f ->> 'conteudo' <> '{"itens":["a","b","d"]}' THEN
    RAISE EXCEPTION 'FALHOU: folha_documento (%)', f;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE documento_id = (pg_temp.v('ret') ->> 'id')::uuid AND tipo_acesso = 'impressao') THEN
    RAISE EXCEPTION 'FALHOU: impressão não registrada';
  END IF;
  RAISE NOTICE 'OK  a folha vem do conteúdo gravado, com número, versão, autor, protocolo e código de conferência; a impressão fica registrada';
END $$;
ROLLBACK;
