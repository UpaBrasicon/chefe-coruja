-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário C06.
-- Leitura dos números pela API e pelo arquivo do ERP.
-- Especificação: CENARIOS-C-farmacia-custos.md, seção C06.
--
-- Só leitura: nenhum paciente novo. Usa as contas do C01 a C04 e os plantões
-- do C05 (ids c01_* a c05_* em e2e.vars). Compara tela (conta_detalhe,
-- glosas_da_unidade, plantoes_erp_previa) × arquivo (erp_baixar) e, onde dá,
-- a API (/financeiro/*). Passos 'C06.NN.*', paciente 306.
--
-- API: a homologação não tem chave ativa com o recurso financeiro, e nenhuma
-- foi criada (instrução da rodada). As chamadas HTTP feitas fora do SQL (sem
-- chave → 401 "Mande a chave…"; chave bem formada e inexistente → 401 "A chave
-- não existe.") estão no relatório; aqui só se confere o rastro delas em
-- api_acessos. A chave de teste do Power BI não foi usada.
--
-- Rodar antes: 70 a 74.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/75_cenario_c06.sql <saida>.sql
--                    npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── apoio do bloco C (mesmo corpo nos scripts 70 a 75) ──────────────────────
CREATE OR REPLACE FUNCTION e2e.c_confere(p boolean, p_msg text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p IS NOT TRUE THEN RAISE EXCEPTION 'confere: %', p_msg; END IF;
  RETURN 'ok: ' || p_msg;
END $$;
GRANT EXECUTE ON FUNCTION e2e.c_confere(boolean, text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.c_falhar(p text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '%', p; END $$;
GRANT EXECUTE ON FUNCTION e2e.c_falhar(text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.c_guardar(p_nome text, p_valor text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO e2e.vars VALUES (p_nome, p_valor) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor
$$;
CREATE OR REPLACE FUNCTION e2e.c_cns(p_n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE base text; s int; d int; k int := 0; i int;
BEGIN
  LOOP
    base := '7' || lpad((93000000000 + p_n * 7 + k)::text, 13, '0');
    s := 0;
    FOR i IN 1..14 LOOP s := s + substr(base, i, 1)::int * (16 - i); END LOOP;
    d := (11 - s % 11) % 11;
    IF d < 10 THEN RETURN base || d; END IF;
    k := k + 1;
  END LOOP;
END $$;
-- sinais crus como a tela grava (sincronizar_registros), com o método do peso
CREATE OR REPLACE FUNCTION e2e.c_sinais(p_pac uuid, p_sinais jsonb, p_internacao uuid DEFAULT NULL, p_metodo text DEFAULT NULL)
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT format($q$SELECT CASE WHEN bool_and(x ->> 'status' = 'gravado') THEN count(*)::text || ' sinais gravados'
                             ELSE e2e.c_falhar(string_agg(coalesce(x ->> 'motivo', x::text), '; ')) END
                     FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)::jsonb) x$q$,
    (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'observacao', 'hora', now(), 'sem_conexao', false,
              'aparelho_id', 'e2e-bloco-c',
              'dados', jsonb_build_object('paciente_id', p_pac, 'internacao_id', p_internacao,
                         'conceito_id', (SELECT c.id FROM public.conceito c WHERE c.nome = k.key AND c.unidade_id IS NULL),
                         'valor_num', k.value, 'origem', 'manual', 'metodo', p_metodo)))
       FROM jsonb_each(p_sinais) k))
$$;
-- conferência no banco, como postgres (o que a tela não mostra)
CREATE OR REPLACE FUNCTION e2e.c_banco(p_passo text, p_n int, p_descricao text, p_sql text, p_guardar text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; v_sit text; v_det text;
BEGIN
  BEGIN
    EXECUTE p_sql INTO r;
    IF p_guardar IS NOT NULL THEN
      IF r IS NULL THEN RAISE EXCEPTION 'nenhuma linha'; END IF;
      PERFORM e2e.c_guardar(p_guardar, r);
    END IF;
    v_sit := 'ok'; v_det := left(r, 600);
  EXCEPTION WHEN OTHERS THEN
    v_sit := 'falha'; v_det := SQLSTATE || ': ' || SQLERRM;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, 'banco', NULL, p_descricao, 'ok', v_sit, v_det);
  RETURN v_sit || ' — ' || p_passo || ' — ' || coalesce(v_det, '');
END $$;
-- passo que depende de um id de passo anterior: sem o id, vira lacuna "bloqueado"
CREATE OR REPLACE FUNCTION e2e.c(p_dep text, p_dep_passo text, p_passo text, p_n int, p_papel text, p_rota text, p_descricao text,
                                p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_dep IS NOT NULL AND e2e.v(p_dep) IS NULL THEN
    RETURN e2e.lacuna(p_passo, p_n, p_papel, p_descricao, 'bloqueado pelo passo ' || p_dep_passo || ' (sem ' || p_dep || ')');
  END IF;
  IF p_papel = 'banco' THEN RETURN e2e.c_banco(p_passo, p_n, p_descricao, p_sql, p_guardar); END IF;
  RETURN e2e.passo(p_passo, p_n, p_papel, p_rota, p_descricao, p_sql, p_esperado, p_guardar);
END $$;
-- detalhe da conta em uma linha (o que a tela de contas mostra)
CREATE OR REPLACE FUNCTION e2e.c_resumo_conta(d jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'nº ' || coalesce(d ->> 'numero', '?') || ', ' || coalesce(d ->> 'status', '?') || ', pagador ' || coalesce(d ->> 'pagador', '?')
    || '; total_referencia ' || coalesce(d ->> 'total_referencia', '?') || '; itens: '
    || coalesce((SELECT string_agg((x ->> 'origem') || ' ' || coalesce(x ->> 'procedimento', '-') || ' qt ' || coalesce(x ->> 'quantidade', '?')
         || ' × ' || coalesce(x ->> 'valor_unitario', 'nulo') || ' = ' || coalesce(x ->> 'valor_total', 'nulo')
         || coalesce(' [' || (x ->> 'destino') || ']', ''), '; ' ORDER BY x ->> 'em') FROM jsonb_array_elements(d -> 'itens') x), 'nenhum')
    || '; pendências ' || coalesce(jsonb_array_length(d -> 'pendencias'), 0)
    || ' (bloqueantes ' || coalesce((SELECT count(*) FROM jsonb_array_elements(d -> 'pendencias') p WHERE (p ->> 'bloqueante')::boolean), 0) || ')'
$$;
GRANT EXECUTE ON FUNCTION e2e.c_resumo_conta(jsonb) TO authenticated;


-- versão de uma conta no arquivo do ERP, em uma linha
CREATE OR REPLACE FUNCTION e2e.c_versao(v jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT (v ->> 'numero') || ' v' || (v ->> 'versao') || ' ' || (v ->> 'situacao') || ': total ' || (v ->> 'total') || ', total_referencia ' || (v ->> 'total_referencia')
    || ', Σ itens ' || coalesce((SELECT sum((i ->> 'valor_total')::numeric)::text FROM jsonb_array_elements(v -> 'itens') i), '0')
    || ', Σ faturáveis ' || coalesce((SELECT sum((i ->> 'valor_total')::numeric)::text FROM jsonb_array_elements(v -> 'itens') i WHERE (i ->> 'faturavel')::boolean), '0')
    || ', itens ' || jsonb_array_length(v -> 'itens') || ', medicamentos ' || jsonb_array_length(v -> 'medicamentos')
    || ', glosas ' || jsonb_array_length(v -> 'glosas') || ', conciliação ' || (v ->> 'conciliacao')
$$;
GRANT EXECUTE ON FUNCTION e2e.c_versao(jsonb) TO authenticated;

DO $$ BEGIN
  IF e2e.v('c01_conta') IS NULL OR e2e.v('c02_conta_i') IS NULL OR e2e.v('c03_conta') IS NULL OR e2e.v('c04_conta') IS NULL OR e2e.v('c05_m1') IS NULL THEN
    RAISE EXCEPTION 'Faltam ids do C01 a C05 em e2e.vars (rode o 70 a 74).';
  END IF;
END $$;
SELECT e2e.c_guardar('c06_rodada', (coalesce(e2e.v('c06_rodada')::int, 0) + 1)::text);
SELECT e2e.c_guardar('c06_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'c06\_%' AND nome NOT IN ('c06_rodada', 'c06_inicio');

-- ── 1 e 2. arquivo JSON das contas ──────────────────────────────────────────
SELECT e2e.passo('C06.01.baixar_json', 306, 'f5_fat', '/faturamento/erp → Baixar JSON', 'Faturamento baixa as versões das contas (13 meses)',
  format($q$SELECT jsonb_array_length(public.erp_baixar(%L::uuid, 'contas', 'json', NULL)) || ' versões no arquivo'$q$, 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.passo('C06.01.c01', 306, 'f5_fat', '/faturamento/erp → arquivo', 'Conta do C01: v1 substituída e v2 vigente',
  format($q$SELECT e2e.c_confere(count(*) = 2 AND bool_or(v ->> 'situacao' = 'substituida' AND (v ->> 'versao')::int = 1) AND bool_or(v ->> 'situacao' = 'vigente' AND (v ->> 'versao')::int = 2),
      string_agg(e2e.c_versao(v), ' | ' ORDER BY (v ->> 'versao')::int))
    FROM jsonb_array_elements(public.erp_baixar(%L::uuid, 'contas', 'json', NULL)) v WHERE v ->> 'conta_id' = %L$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c01_conta')));
SELECT e2e.passo('C06.01.c02', 306, 'f5_fat', '/faturamento/erp → arquivo', 'Conta I do C02: v1 com 2 itens e 2 glosas (valor, recuperado, situação)',
  format($q$SELECT e2e.c_confere(count(*) = 1 AND bool_and(jsonb_array_length(v -> 'glosas') = 2),
      string_agg(e2e.c_versao(v) || '; conta_origem ' || coalesce(v ->> 'conta_origem', '-') || '; glosas ' || (v -> 'glosas')::text, ' | '))
    FROM jsonb_array_elements(public.erp_baixar(%L::uuid, 'contas', 'json', NULL)) v WHERE v ->> 'conta_id' = %L$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c02_conta_i')));
SELECT e2e.passo('C06.01.c03', 306, 'f5_fat', '/faturamento/erp → arquivo', 'Conta A do C03: nenhum item apac; a glosa da APAC aparece em glosas[]',
  format($q$SELECT e2e.c_confere(bool_and(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'itens') i WHERE i ->> 'origem' = 'apac')),
      string_agg(e2e.c_versao(v) || '; glosas ' || (v -> 'glosas')::text, ' | '))
    FROM jsonb_array_elements(public.erp_baixar(%L::uuid, 'contas', 'json', NULL)) v WHERE v ->> 'conta_id' = %L$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c03_conta')));
SELECT e2e.passo('C06.01.c04', 306, 'f5_fat', '/faturamento/erp → arquivo', 'Conta A do C04: medicamentos[] só com quantidades, sem campo de valor',
  format($q$SELECT e2e.c_confere(bool_and(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'medicamentos') m WHERE m ? 'valor' OR m ? 'valor_total' OR m ? 'valor_unitario')),
      string_agg(e2e.c_versao(v) || '; medicamentos ' || (SELECT string_agg(left(m ->> 'medicamento', 20) || ' disp ' || (m ->> 'dispensado') || '/dev ' || (m ->> 'devolvido')
        || '/líq ' || (m ->> 'liquido') || '/adm ' || (m ->> 'administrado'), ', ') FROM jsonb_array_elements(v -> 'medicamentos') m), ' | '))
    FROM jsonb_array_elements(public.erp_baixar(%L::uuid, 'contas', 'json', NULL)) v WHERE v ->> 'conta_id' = %L$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_conta')));
SELECT e2e.passo('C06.02.paciente', 306, 'f5_fat', '/faturamento/erp → arquivo', 'Dado do paciente nas versões do bloco C: só prontuário; nenhum nome, CPF, CNS ou CID',
  format($q$SELECT e2e.c_confere(bool_and(v ? 'prontuario' AND NOT (v ? 'paciente')
        AND NOT EXISTS (SELECT 1 FROM unnest(%L::text[]) t WHERE v::text LIKE '%%' || t || '%%')
        AND NOT EXISTS (SELECT 1 FROM jsonb_path_query(v, 'strict $.**') y WHERE jsonb_typeof(y) = 'object' AND (y ? 'cid' OR y ? 'cpf' OR y ? 'cns'))),
      count(*) || ' versões conferidas; prontuários ' || string_agg(DISTINCT v ->> 'prontuario', ', '))
    FROM jsonb_array_elements(public.erp_baixar(%L::uuid, 'contas', 'json', NULL)) v
   WHERE v ->> 'conta_id' IN (%L, %L, %L, %L)$q$,
    (SELECT array_agg(x) FROM (SELECT p.nome FROM public.contas c JOIN public.pacientes p ON p.id = c.paciente_id
       WHERE c.id IN (e2e.u('c01_conta'), e2e.u('c02_conta_i'), e2e.u('c03_conta'), e2e.u('c04_conta'))
      UNION SELECT p.cns FROM public.contas c JOIN public.pacientes p ON p.id = c.paciente_id
       WHERE c.id IN (e2e.u('c01_conta'), e2e.u('c02_conta_i'), e2e.u('c03_conta'), e2e.u('c04_conta')) AND p.cns IS NOT NULL) z(x)),
    'f5100000-0000-4000-8000-000000000002',
    e2e.v('c01_conta'), e2e.v('c02_conta_i'), e2e.v('c03_conta'), e2e.v('c04_conta')));
SELECT e2e.c_banco('C06.02.auditoria', 306, 'log_auditoria erp_baixado da UPA nesta leitura (payload filtrado pela lista de chaves permitidas)',
  $q$SELECT 'registros ' || count(*) || ', payload ' || coalesce(min(payload::text), '-') FROM public.log_auditoria
      WHERE acao = 'erp_baixado' AND created_at >= now() AND entidade_id = 'f5100000-0000-4000-8000-000000000002'$q$);

-- ── 3 a 8. API /financeiro ──────────────────────────────────────────────────
SELECT e2e.c_banco('C06.03.chave', 306, 'Chave ativa com o recurso financeiro na homologação',
  $q$SELECT 'chaves ativas com financeiro: ' || count(*) FROM public.api_chaves WHERE 'financeiro' = ANY (recursos) AND revogada_em IS NULL AND (expira_em IS NULL OR expira_em > now())$q$);
SELECT e2e.lacuna('C06.03.api_contas', 306, 'ERP', 'GET /financeiro/contas?unidade_id=<UPA> (lista paginada igual ao JSON)', 'Lacuna de ambiente: sem chave ativa com o recurso financeiro; nenhuma foi criada (instrução da rodada).');
SELECT e2e.lacuna('C06.04.api_desde', 306, 'ERP', 'GET /financeiro/contas?desde=<alterada_em da conta I>', 'Lacuna de ambiente: sem chave com o recurso financeiro.');
SELECT e2e.lacuna('C06.05.api_conta', 306, 'ERP', 'GET /financeiro/contas/{conta do C01} (v1 substituída, v2 vigente)', 'Lacuna de ambiente: sem chave com o recurso financeiro; o arquivo (C06.01.c01) mostra as duas versões.');
SELECT e2e.lacuna('C06.06.api_plantoes', 306, 'ERP', 'GET /financeiro/plantoes?competencia=M-1', 'Lacuna de ambiente: sem chave com o recurso financeiro; o arquivo (C06.09) mostra as versões.');
SELECT e2e.lacuna('C06.07.api_plantoes_retorno', 306, 'ERP', 'POST /financeiro/plantoes/{versao}/retorno (lancada → conciliada)', 'Lacuna de ambiente: sem chave com o recurso financeiro; a v2 de M-1 fica pendente.');
SELECT e2e.lacuna('C06.08.api_403', 306, 'ERP', 'Chave de outro recurso em /financeiro/contas → 403', 'Não exercido: a chave de teste do Power BI (atendimentos, leitos, producao) está em scripts/powerbi/.chave-homolog, e o uso dela foi barrado pela permissão desta sessão. O código (api_v1_financeiro) devolve 403 "A chave não libera o recurso financeiro."');
SELECT e2e.c_banco('C06.08.api_401', 306, 'GET /financeiro/contas com chave bem formada e inexistente: 401 gravado em api_acessos (chave_id nulo, recurso financeiro_contas)',
  $q$SELECT e2e.c_confere(count(*) >= 1, 'acessos 401 sem chave conhecida na última hora: ' || count(*) || ', última requisição ' || coalesce(max(requisicao), '-'))
       FROM public.api_acessos WHERE recurso = 'financeiro_contas' AND status = 401 AND chave_id IS NULL AND em > now() - interval '1 hour'$q$);

-- ── 9. plantões: tela × arquivo ─────────────────────────────────────────────
SELECT e2e.passo('C06.09.plantoes', 306, 'f5_ges_upa', '/faturamento/erp (Plantões, Baixar CSV)', 'Arquivo dos plantões de M-1 = versões da tela (mesmos total e linhas; CPF do profissional no arquivo)',
  format($q$SELECT e2e.c_confere(
        (SELECT string_agg((x ->> 'versao') || ':' || (x ->> 'situacao') || ':' || (x ->> 'total'), ',' ORDER BY (x ->> 'versao')::int) FROM jsonb_array_elements(public.erp_baixar(%1$L::uuid, 'plantoes', 'csv', %2$L)) x)
        = (SELECT string_agg((x ->> 'versao') || ':' || (x ->> 'situacao') || ':' || (x ->> 'total'), ',' ORDER BY (x ->> 'versao')::int) FROM jsonb_array_elements(public.plantoes_erp_previa(%1$L::uuid, %2$L) -> 'versoes') x),
      'arquivo ' || (SELECT string_agg('v' || (x ->> 'versao') || ' ' || (x ->> 'situacao') || ' total ' || (x ->> 'total') || ' linhas ' || coalesce(jsonb_array_length(x -> 'plantoes')::text, jsonb_array_length(x -> 'dados' -> 'plantoes')::text, '?')
                                     || ' cpf presente: ' || ((x::text) LIKE '%%"cpf"%%'), '; ') FROM jsonb_array_elements(public.erp_baixar(%1$L::uuid, 'plantoes', 'csv', %2$L)) x))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')));

-- ── 10. tela × arquivo, conta a conta ───────────────────────────────────────
SELECT e2e.passo('C06.10.contas', 306, 'f5_fat', '/faturamento/contas × /faturamento/erp', 'Para cada conta: total_referencia da tela = do arquivo = Σ itens; total = Σ faturáveis',
  format($q$SELECT e2e.c_confere(bool_and(
        (public.conta_detalhe((v ->> 'conta_id')::uuid) ->> 'total_referencia')::numeric = (v ->> 'total_referencia')::numeric
        AND (v ->> 'total_referencia')::numeric = coalesce((SELECT sum((i ->> 'valor_total')::numeric) FROM jsonb_array_elements(v -> 'itens') i), 0)
        AND (v ->> 'total')::numeric = coalesce((SELECT sum((i ->> 'valor_total')::numeric) FROM jsonb_array_elements(v -> 'itens') i WHERE (i ->> 'faturavel')::boolean), 0)),
      string_agg((v ->> 'numero') || ': tela ' || (public.conta_detalhe((v ->> 'conta_id')::uuid) ->> 'total_referencia') || ' / arquivo ' || (v ->> 'total_referencia') || ' / total ' || (v ->> 'total'), '; ' ORDER BY v ->> 'numero'))
    FROM jsonb_array_elements(public.erp_baixar(%L::uuid, 'contas', 'json', NULL)) v
   WHERE v ->> 'situacao' = 'vigente' AND v ->> 'conta_id' IN (%L, %L, %L, %L)$q$, 'f5100000-0000-4000-8000-000000000002',
    e2e.v('c01_conta'), e2e.v('c02_conta_i'), e2e.v('c03_conta'), e2e.v('c04_conta')));
SELECT e2e.passo('C06.10.glosas', 306, 'f5_fat', '/faturamento/glosas × /faturamento/erp', 'Glosas da conta I: tela (glosas_da_unidade) = arquivo (glosas[] da versão), estado atual',
  format($q$SELECT e2e.c_confere(
        (SELECT string_agg((g ->> 'status') || ':' || (g ->> 'valor') || ':' || coalesce(g ->> 'valor_recuperado', '-'), ',' ORDER BY g ->> 'valor')
           FROM jsonb_array_elements(public.glosas_da_unidade(%1$L::uuid, NULL, NULL) -> 'glosas') g WHERE g ->> 'conta_id' = %2$L)
        = (SELECT string_agg(coalesce(x ->> 'situacao', x ->> 'status') || ':' || (x ->> 'valor') || ':' || coalesce(x ->> 'valor_recuperado', '-'), ',' ORDER BY x ->> 'valor')
             FROM jsonb_array_elements(public.erp_baixar(%1$L::uuid, 'contas', 'json', NULL)) v, jsonb_array_elements(v -> 'glosas') x WHERE v ->> 'conta_id' = %2$L),
      'tela ' || (SELECT string_agg((g ->> 'status') || ' ' || (g ->> 'valor') || ' rec ' || coalesce(g ->> 'valor_recuperado', '-'), ', ') FROM jsonb_array_elements(public.glosas_da_unidade(%1$L::uuid, NULL, NULL) -> 'glosas') g WHERE g ->> 'conta_id' = %2$L)
      || ' | arquivo ' || (SELECT string_agg(left(x::text, 160), ', ') FROM jsonb_array_elements(public.erp_baixar(%1$L::uuid, 'contas', 'json', NULL)) v, jsonb_array_elements(v -> 'glosas') x WHERE v ->> 'conta_id' = %2$L))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c02_conta_i')));
SELECT e2e.passo('C06.10.totais_glosas', 306, 'f5_fat', '/faturamento/glosas', 'Totais de glosas da UPA (todas as competências)',
  format($q$SELECT (public.glosas_da_unidade(%L::uuid, NULL, NULL) -> 'totais')::text || '; por competência ' || (public.glosas_da_unidade(%L::uuid, NULL, NULL) -> 'por_competencia')::text$q$,
    'f5100000-0000-4000-8000-000000000002', 'f5100000-0000-4000-8000-000000000002'));

-- ── 11. arquivos de BPA fechados ────────────────────────────────────────────
SELECT e2e.passo('C06.11.bpa_unidade', 306, 'f5_fat', '/faturamento (BPA)', 'Fechamentos de BPA da UPA (os dois do C01, reabertos)',
  format($q$SELECT left(public.bpa_fechamentos_da_unidade(%L::uuid)::text, 500)$q$, 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.passo('C06.11.rede', 306, 'f5_fat_rede', '/rede (faturamento da rede)', 'faturamento.rede.f5 lê o faturamento da rede na competência (Secretaria F5)',
  format($q$SELECT left(public.rede_faturamento(%L::uuid, %L)::text, 500)$q$, 'f5100000-0000-4000-8000-000000000008', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')));

-- ── lacunas ─────────────────────────────────────────────────────────────────
SELECT e2e.lacuna('C06.99.powerbi', 306, 'ERP', 'Modelo do Power BI com o financeiro', 'Escopo (PR #479, decisão B2): o modelo não lê /financeiro; conferido pelo arquivo do ERP.');
SELECT e2e.lacuna('C06.99.webhook', 306, 'ERP', 'Webhook de conta, glosa ou ERP; SISAIH01; retorno SIA/SIH', 'Lacuna (MAPA): o ERP busca pela API.');

SELECT passo, papel, situacao, left(detalhe, 220) AS detalhe FROM e2e.resultados
 WHERE passo LIKE 'C06.%' AND em >= e2e.v('c06_inicio')::timestamptz ORDER BY id;
