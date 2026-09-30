-- Testes do porte da página do pacote de alta (migration 20261003000006).
-- ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_pacote_alta.sql
-- O pacote traz identificação, sinais de retorno, retorno em partes, autor e
-- CRM dos documentos e exames com resultado; nada inventado; pacote no
-- formato antigo segue abrindo; a equipe vê sem código, só quem pode.
BEGIN;
-- médico (…0002) no PS, na Observação e na Clínica Médica; recepção (…0005) no PS.
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000001']::uuid[]) s;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.leitos (setor_id, identificador, tipo) VALUES ('22000000-0000-4000-8000-000000000002', 'Box 9', 'observacao');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
INSERT INTO t SELECT 'cid_desc', descricao FROM terminologia.cid10 WHERE codigo IN ('T78.3', 'T783') LIMIT 1;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

-- ── um adulto chega pela porta e fica em observação ─────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL,
  json_build_object('nome', 'Porte Pacote Silva', 'nome_social', 'Joana Porte',
                    'data_nascimento', (current_date - interval '71 years 2 months')::date)::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  pg_temp.u('flx'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep')), public.registrar_soap(pg_temp.u('ep'), 'queixa', 'exame', 'avaliacao', 'plano', 'R60');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'observacao');
RESET ROLE;
INSERT INTO t SELECT 'i', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('ep');
UPDATE public.internacoes SET data_admissao = now() - interval '5 hours' WHERE id = pg_temp.u('i');
UPDATE public.perfis SET crm = '128446', uf_crm = 'SP' WHERE id = '10000000-0000-4000-8000-000000000002';

-- documentos do episódio: receita e sumário emitidos; um atestado retificado não vai
INSERT INTO public.documentos_clinicos (documento_raiz_id, organizacao_id, unidade_id, paciente_id, internacao_id, tipo_documento,
                                        conteudo, conteudo_hash, autor_id, estado, numero, emitido_em, assinado_em)
SELECT gen_random_uuid(), organizacao_id, unidade_id, paciente_id, id, x.tipo, x.conteudo, 'x',
       '10000000-0000-4000-8000-000000000002', x.estado, x.numero, now() - interval '1 hour', now() - interval '1 hour'
  FROM public.internacoes, (VALUES
    ('receita', '{"receita":{"tipo":"branca","itens":[{"medicamento":"Dipirona","dose":"1 g","posologia":"de 6 em 6 horas se dor","quantidade":"10"}]}}', 'ativo', 'R-1'),
    ('sumario_alta', 'Edema de face que melhorou com antialérgico.', 'ativo', 'S-1'),
    ('atestado', '{"atestado":{"tipo":"repouso","dias":"3"}}', 'retificado', 'A-1')) x(tipo, conteudo, estado, numero)
 WHERE id = pg_temp.u('i');
-- exames: um com resultado entra; cancelado não entra
INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, internacao_id, exame, pedido_por, situacao, resultado, resolvido_por, resolvido_em)
SELECT unidade_id, paciente_id, episodio_id, id, x.exame, '10000000-0000-4000-8000-000000000002', x.situacao, x.resultado,
       '10000000-0000-4000-8000-000000000002', now() - interval '2 hours'
  FROM public.internacoes, (VALUES ('Potássio', 'resultado', '4,1 mEq/L'), ('Magnésio', 'cancelado', NULL)) x(exame, situacao, resultado)
 WHERE id = pg_temp.u('i');

-- ── alta e pacote com os campos novos ───────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.dar_alta(pg_temp.u('i'), 'alta_melhorada', 'T78.3');
SELECT pg_temp.falha(format('SELECT public.gerar_pacote_alta(%L, %L, NULL, %L)', pg_temp.v('i'), '[]', '{"x":1}'),
  'Sinais de retorno inválidos', 'sinais de retorno precisam ser lista');
SELECT pg_temp.falha(format('SELECT public.gerar_pacote_alta(%L, %L, NULL, %L, %L)', pg_temp.v('i'), '[]', '[]', '["x"]'),
  'Retorno inválido', 'retorno em partes precisa ser objeto');
-- formato antigo (três argumentos) continua valendo
INSERT INTO t SELECT 'antigo', public.gerar_pacote_alta(pg_temp.u('i'), '["Beber água"]', 'UBS em 7 dias')::text;
INSERT INTO t SELECT 'pac', public.gerar_pacote_alta(pg_temp.u('i'), '["Beber água"]', NULL,
  '["a febre passar de 38 °C", "  ", "faltar ar em repouso"]',
  '{"onde":"UBS Vila Nova","quando":"31/08 às 9h","exame_controle":"","levar":"esta alta e as caixas dos remédios","outro":"ignorado"}')::text;
RESET ROLE;

-- ── o paciente abre com o código ────────────────────────────────────────────
SET LOCAL ROLE anon;
DO $$
DECLARE tok text := pg_temp.v('pac')::jsonb ->> 'token'; cod text := pg_temp.v('pac')::jsonb ->> 'codigo';
        velho text := pg_temp.v('antigo')::jsonb ->> 'token'; r jsonb; rec jsonb;
BEGIN
  IF public.abrir_pacote_alta(velho, '000000') ->> 'situacao' <> 'revogado' THEN
    RAISE EXCEPTION 'FALHOU: gerar de novo revoga o anterior';
  END IF;
  r := public.abrir_pacote_alta(tok, cod);
  IF r ->> 'situacao' <> 'ok' OR r ->> 'primeiro_nome' <> 'Joana' OR r ->> 'nome' <> 'Joana Porte'
     OR (r ->> 'idade_anos')::int <> 71 OR r ->> 'setor' IS NULL OR r ->> 'leito' <> 'Box 9'
     OR r ->> 'internado_em' IS NULL OR r ->> 'alta_em' IS NULL OR r ->> 'expira_em' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: identificação (%)', r;
  END IF;
  RAISE NOTICE 'OK  identificação: nome social, idade, setor, leito da alta e datas';
  IF r -> 'sinais_retorno' <> '["a febre passar de 38 °C", "faltar ar em repouso"]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: sinais de retorno (%)', r -> 'sinais_retorno';
  END IF;
  IF r -> 'retorno_detalhes' <> '{"onde":"UBS Vila Nova","quando":"31/08 às 9h","levar":"esta alta e as caixas dos remédios"}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: retorno em partes (%)', r -> 'retorno_detalhes';
  END IF;
  RAISE NOTICE 'OK  sinais e retorno em partes gravados sem linha vazia nem chave estranha';
  IF jsonb_array_length(r -> 'documentos') <> 2 OR r -> 'documentos' @> '[{"tipo":"atestado"}]' THEN
    RAISE EXCEPTION 'FALHOU: documentos (%)', r -> 'documentos';
  END IF;
  SELECT d INTO rec FROM jsonb_array_elements(r -> 'documentos') d WHERE d ->> 'tipo' = 'receita';
  IF rec ->> 'crm' <> '128446' OR rec ->> 'uf_crm' <> 'SP' OR rec ->> 'autor' IS NULL OR rec ->> 'assinado_em' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: autor e CRM do documento (%)', rec;
  END IF;
  IF r -> 'medico' ->> 'crm' <> '128446' THEN RAISE EXCEPTION 'FALHOU: médico que montou (%)', r -> 'medico'; END IF;
  RAISE NOTICE 'OK  documentos ativos do episódio com autor, CRM e hora da assinatura';
  IF r -> 'exames' <> jsonb_build_array(jsonb_build_object('exame', 'Potássio', 'resultado', '4,1 mEq/L', 'quando', r -> 'exames' -> 0 -> 'quando')) THEN
    RAISE EXCEPTION 'FALHOU: exames (%)', r -> 'exames';
  END IF;
  RAISE NOTICE 'OK  só exame com resultado entra na tabela';
  -- a unidade não tem telefone público no banco; o CID só vira texto se a tabela tiver
  IF r ? 'telefone_unidade' OR r ->> 'diagnostico_cid' IS DISTINCT FROM
       (SELECT valor FROM t WHERE nome = 'cid_desc') THEN
    RAISE EXCEPTION 'FALHOU: dado que o banco não tem apareceu (%)', r;
  END IF;
  RAISE NOTICE 'OK  sem telefone da unidade; descrição do CID só se a tabela CID-10 tiver';
END $$;
SELECT pg_temp.falha(format('SELECT public.ver_pacote_alta_equipe(%L)', pg_temp.v('pac')::jsonb ->> 'id'),
  'permission denied', 'anônimo não usa a visão da equipe');
RESET ROLE;

-- pacote gravado antes desta migration (colunas novas nos valores padrão)
DO $$
DECLARE r jsonb;
BEGIN
  UPDATE public.pacotes_alta SET sinais_retorno = DEFAULT, retorno_detalhes = NULL WHERE id = (pg_temp.v('pac')::jsonb ->> 'id')::uuid;
  r := public.abrir_pacote_alta(pg_temp.v('pac')::jsonb ->> 'token', pg_temp.v('pac')::jsonb ->> 'codigo');
  IF r ->> 'situacao' <> 'ok' OR r -> 'sinais_retorno' <> '[]'::jsonb OR r -> 'retorno_detalhes' <> 'null'::jsonb
     OR r -> 'orientacoes' ->> 0 <> 'Beber água' THEN
    RAISE EXCEPTION 'FALHOU: pacote antigo (%)', r;
  END IF;
  RAISE NOTICE 'OK  pacote no formato antigo segue abrindo';
END $$;

-- ── a equipe vê sem código ──────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'eq', public.ver_pacote_alta_equipe((pg_temp.v('pac')::jsonb ->> 'id')::uuid)::text;
INSERT INTO t SELECT 'eq_velho', public.ver_pacote_alta_equipe((pg_temp.v('antigo')::jsonb ->> 'id')::uuid)::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.ver_pacote_alta_equipe(%L)', pg_temp.v('pac')::jsonb ->> 'id'),
  'Acesso negado', 'quem não gerou, não cuida do setor nem é gestor não vê');
RESET ROLE;
DO $$
DECLARE r jsonb := pg_temp.v('eq')::jsonb; velho jsonb := pg_temp.v('eq_velho')::jsonb;
BEGIN
  IF r ->> 'situacao' <> 'ok' OR r ->> 'situacao_link' <> 'ativo' OR r ->> 'nome' <> 'Joana Porte' OR r ? 'token' OR r ? 'codigo' THEN
    RAISE EXCEPTION 'FALHOU: visão da equipe (%)', r;
  END IF;
  IF velho ->> 'situacao_link' <> 'revogado' THEN RAISE EXCEPTION 'FALHOU: situação do link revogado (%)', velho ->> 'situacao_link'; END IF;
  IF (SELECT count(*) FROM public.pacotes_alta_acessos WHERE pacote_id = (pg_temp.v('pac')::jsonb ->> 'id')::uuid) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: a visão da equipe não conta como abertura pelo paciente';
  END IF;
  RAISE NOTICE 'OK  quem gerou vê o pacote (inclusive revogado) sem código, sem token e sem contar tentativa';
END $$;
DO $x$ BEGIN
  IF has_column_privilege('authenticated', 'public.pacotes_alta', 'token', 'SELECT')
     OR has_column_privilege('authenticated', 'public.pacotes_alta', 'codigo_hash', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.pacotes_alta', 'sinais_retorno', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: permissões de coluna do pacote';
  END IF;
  RAISE NOTICE 'OK  token e hash seguem fora da equipe; colunas novas legíveis';
END $x$;
ROLLBACK;
