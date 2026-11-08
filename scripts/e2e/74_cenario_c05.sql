-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário C05.
-- ERP: remuneração de plantões, versões da conta e reabertura pelo gestor.
-- Especificação: CENARIOS-C-farmacia-custos.md, seção C05.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs e pela tabela
-- que as telas usam (passos 'C05.NN.*', paciente 305). Nada é corrigido no
-- produto. Usa a conta do C01 (ids c01_* em e2e.vars): rode o 70 antes.
--
-- VALORES DE REMUNERAÇÃO: FICTÍCIOS, SÓ PARA TESTE. O gestor grava pela tela
-- de configuração (insert em remuneracoes_plantao, como Configuracao.tsx):
-- Pronto Socorro + manhã = 600; todos os setores + noite = 1.200; todos os
-- setores + todos os turnos = 500. A tabela não tem marca de "teste": a marca
-- fica no relatório (EXECUCAO-C01-C06.md). Nenhum outro valor é digitado: o
-- valor do plantão e o total vêm de private.plantao_erp_valor, e o da conta,
-- do SIGTAP.
--
-- O mês anterior (M-1) só tem plantão se o gestor escalar um: o passo 5 põe o
-- medico.upa.f5 no Pronto Socorro, manhã do último dia de M-1 (fica
-- 'sem_presenca', valor 0), pela RPC da escala (adicionar_plantao_escala).
-- O ERP só leva plantão de plantonista (decisão E2 do RT, 28/10/2026).
--
-- Rodar antes: 41, 47 e 70 (C01).
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/74_cenario_c05.sql <saida>.sql
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


-- ── rodada ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF e2e.v('c01_conta') IS NULL OR e2e.v('c01_reg') IS NULL THEN RAISE EXCEPTION 'Faltam os ids do C01 em e2e.vars (rode o 70).'; END IF;
END $$;
SELECT e2e.c_guardar('c05_rodada', (coalesce(e2e.v('c05_rodada')::int, 0) + 1)::text);
SELECT e2e.c_guardar('c05_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'c05\_%' AND nome NOT IN ('c05_rodada', 'c05_inicio');
SELECT e2e.c_guardar('c05_m', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'));
SELECT e2e.c_guardar('c05_m1', to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYYMM'));
SELECT e2e.c_guardar('c05_m2', to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '2 month', 'YYYYMM'));
SELECT e2e.c_guardar('c05_dia_m1', (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 day')::date::text);

-- ── 1. gestor cadastra a remuneração (valores FICTÍCIOS de teste) ───────────
SELECT CASE WHEN EXISTS (SELECT 1 FROM public.remuneracoes_plantao WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND ativo
                          AND setor_id = 'f5300000-0000-4000-8000-000000000011' AND turno = 'manha')
  THEN e2e.lacuna('C05.01.ps_manha', 305, 'f5_ges_upa', 'Remuneração PS + manhã', 'já cadastrada numa rodada anterior')
  ELSE e2e.passo('C05.01.ps_manha', 305, 'f5_ges_upa', '/unidade?aba=configuracoes (Remuneração de plantão)', 'Gestor cadastra Pronto Socorro + manhã = 600 (FICTÍCIO, teste)',
    $q$INSERT INTO public.remuneracoes_plantao (unidade_id, setor_id, turno, valor, criado_por)
       VALUES ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'manha', 600, NULL) RETURNING id::text$q$, 'ok', 'c05_rem_ps_manha') END;
SELECT CASE WHEN EXISTS (SELECT 1 FROM public.remuneracoes_plantao WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND ativo AND setor_id IS NULL AND turno = 'noite')
  THEN e2e.lacuna('C05.01.noite', 305, 'f5_ges_upa', 'Remuneração todos os setores + noite', 'já cadastrada numa rodada anterior')
  ELSE e2e.passo('C05.01.noite', 305, 'f5_ges_upa', '/unidade?aba=configuracoes (Remuneração de plantão)', 'Gestor cadastra todos os setores + noite = 1.200 (FICTÍCIO, teste)',
    $q$INSERT INTO public.remuneracoes_plantao (unidade_id, setor_id, turno, valor, criado_por)
       VALUES ('f5100000-0000-4000-8000-000000000002', NULL, 'noite', 1200, NULL) RETURNING id::text$q$) END;
SELECT CASE WHEN EXISTS (SELECT 1 FROM public.remuneracoes_plantao WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND ativo AND setor_id IS NULL AND turno IS NULL)
  THEN e2e.lacuna('C05.01.geral', 305, 'f5_ges_upa', 'Remuneração geral', 'já cadastrada numa rodada anterior')
  ELSE e2e.passo('C05.01.geral', 305, 'f5_ges_upa', '/unidade?aba=configuracoes (Remuneração de plantão)', 'Gestor cadastra todos os setores + todos os turnos = 500 (FICTÍCIO, teste)',
    $q$INSERT INTO public.remuneracoes_plantao (unidade_id, setor_id, turno, valor, criado_por)
       VALUES ('f5100000-0000-4000-8000-000000000002', NULL, NULL, 500, NULL) RETURNING id::text$q$) END;
SELECT e2e.passo('C05.01.madrugada', 305, 'f5_ges_upa', '/unidade?aba=configuracoes', 'Turno "madrugada" na remuneração (deve ser recusado pelo CHECK; a tela só oferece manhã, tarde e noite)',
  $q$INSERT INTO public.remuneracoes_plantao (unidade_id, setor_id, turno, valor, criado_por)
     VALUES ('f5100000-0000-4000-8000-000000000002', NULL, 'madrugada', 1, NULL) RETURNING id::text$q$, 'erro');
SELECT e2e.passo('C05.01.lista', 305, 'f5_ges_upa', '/unidade?aba=configuracoes', 'Linhas ativas da remuneração (como a tela lê)',
  $q$SELECT string_agg(coalesce(s.nome, 'todos os setores') || ' + ' || coalesce(r.turno, 'todos os turnos') || ' = ' || r.valor, '; ' ORDER BY r.valor)
       FROM public.remuneracoes_plantao r LEFT JOIN public.setores s ON s.id = r.setor_id
      WHERE r.unidade_id = 'f5100000-0000-4000-8000-000000000002' AND r.ativo$q$);
SELECT e2e.c_banco('C05.01.criado_por', 305, 'criado_por das linhas novas (a tela manda nulo)',
  $q$SELECT string_agg(coalesce(right(criado_por::text, 2), 'nulo'), ', ') FROM public.remuneracoes_plantao
      WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND created_at >= now()$q$);

-- ── 2 a 4. prévia de M ──────────────────────────────────────────────────────
SELECT e2e.passo('C05.02.previa_m', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M)', 'Prévia do mês corrente: totais, total e mês ainda aberto',
  format($q$SELECT 'plantões ' || (x -> 'totais' ->> 'plantoes') || ', realizados ' || (x -> 'totais' ->> 'realizados') || ', sem_presenca ' || (x -> 'totais' ->> 'sem_presenca')
      || ', faltas_justificadas ' || (x -> 'totais' ->> 'faltas_justificadas') || ', realizados_sem_valor ' || (x -> 'totais' ->> 'realizados_sem_valor')
      || ', sem_checkout ' || (x -> 'totais' ->> 'sem_checkout') || '; total ' || (x ->> 'total') || '; mes_encerrado ' || (x ->> 'mes_encerrado') || '; fechado ' || (x ->> 'fechado')
    FROM (SELECT public.plantoes_erp_previa(%L::uuid, %L) x) z$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m')), 'ok');
SELECT e2e.passo('C05.02.precedencia', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M)', 'valor_referencia por setor e turno (precedência setor+turno → setor → turno → geral)',
  format($q$SELECT string_agg(k, '; ' ORDER BY k) FROM (SELECT DISTINCT coalesce(p -> 'setor' ->> 'nome', '?') || ' ' || coalesce(p ->> 'turno', '?') || ' → ' || coalesce(p ->> 'valor_referencia', 'nulo') AS k
      FROM jsonb_array_elements(public.plantoes_erp_previa(%L::uuid, %L) -> 'plantoes') p) z$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m')));
SELECT e2e.passo('C05.02.precedencia_confere', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M)', 'PS manhã = 600; qualquer setor à noite = 1.200; PS tarde = 500 (geral)',
  format($q$SELECT e2e.c_confere(
        bool_and((p ->> 'valor_referencia')::numeric = CASE WHEN p ->> 'turno' = 'noite' THEN 1200
                                                         WHEN p ->> 'turno' = 'manha' AND coalesce(p ->> 'setor_id', p -> 'setor' ->> 'id') = 'f5300000-0000-4000-8000-000000000011' THEN 600
                                                         ELSE 500 END),
      count(*) || ' plantões conferidos')
    FROM jsonb_array_elements(public.plantoes_erp_previa(%L::uuid, %L) -> 'plantoes') p$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m')));
SELECT e2e.passo('C05.02.valor_por_situacao', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M)', 'valor = valor_referencia só em realizado; 0 em sem_presenca e falta_justificada; Σ valor = total',
  format($q$SELECT e2e.c_confere(bool_and(CASE WHEN p ->> 'situacao' = 'realizado' THEN (p ->> 'valor')::numeric = (p ->> 'valor_referencia')::numeric OR (p ->> 'fracionado')::boolean
                                          ELSE (p ->> 'valor')::numeric = 0 END)
        AND sum((p ->> 'valor')::numeric) = (SELECT (public.plantoes_erp_previa(%1$L::uuid, %2$L) ->> 'total')::numeric),
      (SELECT string_agg(s || ': ' || n || ' plantões, Σ valor ' || v, '; ') FROM (SELECT p2 ->> 'situacao' s, count(*) n, sum((p2 ->> 'valor')::numeric) v
         FROM jsonb_array_elements(public.plantoes_erp_previa(%1$L::uuid, %2$L) -> 'plantoes') p2 GROUP BY 1) g))
    FROM jsonb_array_elements(public.plantoes_erp_previa(%1$L::uuid, %2$L) -> 'plantoes') p$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m')));
SELECT e2e.passo('C05.02.amostra', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M)', 'Uma linha de plantão realizado (campos que vão ao ERP)',
  format($q$SELECT coalesce((SELECT left(p::text, 600) FROM jsonb_array_elements(public.plantoes_erp_previa(%L::uuid, %L) -> 'plantoes') p WHERE p ->> 'situacao' = 'realizado' LIMIT 1), 'nenhum realizado')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m')));
SELECT e2e.c_banco('C05.02.turnos_da_escala', 305, 'Turnos da escala da UPA em M (há "madrugada"?)',
  format($q$SELECT string_agg(DISTINCT turno, ', ') FROM public.escala_plantao WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND ativo AND to_char(data, 'YYYYMM') = %L$q$, e2e.v('c05_m')));
SELECT e2e.passo('C05.03.fat_nao_ve', 305, 'f5_fat', '/faturamento/erp (Plantões)', 'Faturamento abre a prévia dos plantões (deve ser recusado)',
  format('SELECT public.plantoes_erp_previa(%L::uuid, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m')), 'erro:Acesso negado: os plantões para o ERP são do gestor');
SELECT e2e.passo('C05.04.fechar_m', 305, 'f5_ges_upa', '/faturamento/erp (Plantões)', 'Fechar o mês corrente (deve ser recusado)',
  format('SELECT public.fechar_plantoes_erp(%L::uuid, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m')), 'erro:O mês só fecha depois de acabar');

-- ── 5 a 8. mês anterior: plantão escalado, fechar, reabrir, fechar, baixar ──
SELECT e2e.passo('C05.05.sem_plantao', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M-2)', 'Fechar um mês sem plantão na escala (deve ser recusado)',
  format('SELECT public.fechar_plantoes_erp(%L::uuid, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m2')), 'erro:Não há plantão na escala deste mês');
SELECT CASE WHEN EXISTS (SELECT 1 FROM public.escala_plantao WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND ativo AND to_char(data, 'YYYYMM') = e2e.v('c05_m1'))
  THEN e2e.lacuna('C05.05.escalar', 305, 'f5_ges_upa', 'Plantão em M-1', 'não precisou: já há plantão da UPA em M-1')
  ELSE e2e.passo('C05.05.escalar', 305, 'f5_ges_upa', '/escala', 'Gestor escala o medico.upa.f5 no PS, manhã do último dia de M-1 (acerto retroativo; o ERP só leva plantão de plantonista)',
    format('SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, %L, NULL, false, NULL)::text', 'f5100000-0000-4000-8000-000000000002',
      'f5300000-0000-4000-8000-000000000011', 'f5200000-0000-4000-8000-000000000008', e2e.v('c05_dia_m1'), 'manha'), 'ok', 'c05_plantao_m1') END;
SELECT e2e.passo('C05.05.previa_m1', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M-1)', 'Prévia de M-1: o plantão escalado fica sem_presenca, valor 0',
  format($q$SELECT 'plantões ' || (x -> 'totais' ->> 'plantoes') || ', total ' || (x ->> 'total') || ', mes_encerrado ' || (x ->> 'mes_encerrado') || '; linhas: '
      || (SELECT string_agg(coalesce(p ->> 'turno', '?') || ' ' || coalesce(p ->> 'situacao', '?') || ' ref ' || coalesce(p ->> 'valor_referencia', 'nulo') || ' valor ' || coalesce(p ->> 'valor', '?'), '; ')
            FROM jsonb_array_elements(x -> 'plantoes') p)
    FROM (SELECT public.plantoes_erp_previa(%L::uuid, %L) x) z$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')));
SELECT e2e.passo('C05.05.fechar_m1', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M-1)', 'Gestor fecha M-1: versão 1 vigente',
  format($q$SELECT (public.fechar_plantoes_erp(%L::uuid, %L) -> 'versoes')::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')), 'ok', 'c05_v1');
SELECT e2e.c('c05_v1', 'C05.05.fechar_m1', 'C05.05.v1_banco', 305, 'banco', NULL, 'plantao_versoes_erp v1: vigente, total = Σ valor, conciliação pendente; auditoria plantoes_erp_fechados',
  format($q$SELECT e2e.c_confere(v.situacao = 'vigente' AND v.conciliacao = 'pendente' AND v.total = (v.dados ->> 'total')::numeric
        AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = v.id AND acao = 'plantoes_erp_fechados'),
      'versão ' || v.versao || ', ' || v.situacao || ', total ' || v.total || ', conciliação ' || v.conciliacao)
    FROM public.plantao_versoes_erp v WHERE v.unidade_id = 'f5100000-0000-4000-8000-000000000002' AND v.competencia = %L ORDER BY v.versao DESC LIMIT 1$q$, e2e.v('c05_m1')));
SELECT e2e.c('c05_v1', 'C05.05.fechar_m1', 'C05.06.motivo_curto', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M-1)', 'Reabrir com motivo curto (deve ser recusado)',
  format($q$SELECT public.reabrir_plantoes_erp(%L::uuid, %L, 'curto')::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')), 'erro:Diga por que o mês é reaberto');
SELECT e2e.c('c05_v1', 'C05.05.fechar_m1', 'C05.06.reabrir', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M-1)', 'Gestor reabre M-1 com motivo',
  format($q$SELECT (public.reabrir_plantoes_erp(%L::uuid, %L, 'Teste C05: plantão conferido de novo') -> 'versoes')::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')), 'ok', 'c05_reaberto');
SELECT e2e.c('c05_reaberto', 'C05.06.reabrir', 'C05.06.de_novo', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M-1)', 'Reabrir mês não fechado (deve ser recusado)',
  format($q$SELECT public.reabrir_plantoes_erp(%L::uuid, %L, 'Teste C05: segunda reabertura')::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')), 'erro:Os plantões deste mês não estão fechados');
SELECT e2e.c('c05_reaberto', 'C05.06.reabrir', 'C05.06.v1_substituida', 305, 'banco', NULL, 'v1 substituída, motivo e substituida_por = gestor; auditoria plantoes_erp_reabertos',
  format($q$SELECT e2e.c_confere(v.situacao = 'substituida' AND v.substituida_por = 'f5200000-0000-4000-8000-000000000009'
        AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = v.id AND acao = 'plantoes_erp_reabertos'),
      'versão ' || v.versao || ' ' || v.situacao || ', motivo ' || v.motivo_reabertura)
    FROM public.plantao_versoes_erp v WHERE v.unidade_id = 'f5100000-0000-4000-8000-000000000002' AND v.competencia = %L ORDER BY v.versao DESC LIMIT 1$q$, e2e.v('c05_m1')));
SELECT e2e.c('c05_reaberto', 'C05.06.reabrir', 'C05.07.fechar_de_novo', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M-1)', 'Gestor fecha M-1 de novo: versão 2 vigente, a 1 segue como substituída',
  format($q$SELECT (public.fechar_plantoes_erp(%L::uuid, %L) -> 'versoes')::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')), 'ok', 'c05_v2');
SELECT e2e.c('c05_v2', 'C05.07.fechar_de_novo', 'C05.07.duas_versoes', 305, 'banco', NULL, 'Duas versões de M-1; total da v2 igual ao da v1',
  format($q$SELECT e2e.c_confere(count(*) >= 2 AND count(DISTINCT total) = 1, string_agg('v' || versao || ' ' || situacao || ' total ' || total, '; ' ORDER BY versao))
    FROM public.plantao_versoes_erp WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND competencia = %L$q$, e2e.v('c05_m1')), 'ok', 'c05_versoes_m1');
SELECT e2e.c('c05_v2', 'C05.07.fechar_de_novo', 'C05.08.baixar', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, Baixar CSV)', 'Gestor baixa os plantões de M-1: versões e CPF do profissional',
  format($q$SELECT jsonb_array_length(x) || ' versões; profissional da 1ª linha: ' || coalesce((x -> 0 -> 'plantoes' -> 0 -> 'profissional')::text, (x -> 0 -> 'dados' -> 'plantoes' -> 0 -> 'profissional')::text, '?')
    FROM (SELECT public.erp_baixar(%L::uuid, 'plantoes', 'csv', %L) x) z$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')));
SELECT e2e.c('c05_v2', 'C05.07.fechar_de_novo', 'C05.08.auditoria', 305, 'banco', NULL, 'log_auditoria erp_baixado da UPA (o payload passa pela lista de chaves permitidas de private.payload_auditoria)',
  $q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'erp_baixado' AND created_at >= now() AND entidade_id = 'f5100000-0000-4000-8000-000000000002'),
      coalesce((SELECT left(payload::text, 300) FROM public.log_auditoria WHERE acao = 'erp_baixado' AND created_at >= now() ORDER BY seq DESC LIMIT 1), 'nenhum erp_baixado nesta transação'))$q$);
SELECT e2e.passo('C05.08.fat_nao_baixa', 305, 'f5_fat', '/faturamento/erp (Plantões)', 'Faturamento baixa os plantões (deve ser recusado)',
  format($q$SELECT public.erp_baixar(%L::uuid, 'plantoes', 'csv', %L)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')), 'erro:Acesso negado: os plantões para o ERP são do gestor');
SELECT e2e.passo('C05.08.nao_fechado', 305, 'f5_ges_upa', '/faturamento/erp (Plantões)', 'Baixar mês não fechado (deve ser recusado)',
  format($q$SELECT public.erp_baixar(%L::uuid, 'plantoes', 'csv', %L)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m2')), 'erro:Os plantões deste mês ainda não foram fechados');

-- ── bordas: desativar uma linha muda a prévia, não a versão; fracionado ─────
SELECT e2e.c_banco('C05.98.id_ps_manha', 305, 'Linha PS + manhã ativa (a tela lista; o id vai para "remover")',
  $q$SELECT id::text FROM public.remuneracoes_plantao WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND ativo
      AND setor_id = 'f5300000-0000-4000-8000-000000000011' AND turno = 'manha' ORDER BY created_at DESC LIMIT 1$q$, 'c05_rem_ativa');
SELECT e2e.c('c05_rem_ativa', 'C05.98.id_ps_manha', 'C05.98.desativar', 305, 'f5_ges_upa', '/unidade?aba=configuracoes', 'Gestor remove (desativa) a linha PS + manhã',
  format($q$UPDATE public.remuneracoes_plantao SET ativo = false WHERE id = %L RETURNING ativo::text$q$, e2e.u('c05_rem_ativa')));
SELECT e2e.c('c05_v2', 'C05.07.fechar_de_novo', 'C05.98.previa_muda', 305, 'f5_ges_upa', '/faturamento/erp (Plantões, M-1)', 'A prévia de M-1 passa a mostrar o valor geral (500) no plantão PS manhã; a versão fechada não muda',
  format($q$SELECT e2e.c_confere((SELECT (p ->> 'valor_referencia')::numeric FROM jsonb_array_elements(public.plantoes_erp_previa(%1$L::uuid, %2$L) -> 'plantoes') p LIMIT 1) = 500
        AND (SELECT (v.dados -> 'plantoes' -> 0 ->> 'valor_referencia')::numeric FROM public.plantao_versoes_erp v
              WHERE v.unidade_id = %1$L::uuid AND v.competencia = %2$L AND v.situacao = 'vigente') = 600,
      'prévia ' || (SELECT p ->> 'valor_referencia' FROM jsonb_array_elements(public.plantoes_erp_previa(%1$L::uuid, %2$L) -> 'plantoes') p LIMIT 1)
      || ', versão vigente ' || coalesce((SELECT v.dados -> 'plantoes' -> 0 ->> 'valor_referencia' FROM public.plantao_versoes_erp v
              WHERE v.unidade_id = %1$L::uuid AND v.competencia = %2$L AND v.situacao = 'vigente'), '?'))$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c05_m1')));
SELECT e2e.passo('C05.98.recadastrar', 305, 'f5_ges_upa', '/unidade?aba=configuracoes', 'Gestor cadastra de novo PS + manhã = 600 (FICTÍCIO, teste), para a tabela voltar a ter as três linhas',
  $q$INSERT INTO public.remuneracoes_plantao (unidade_id, setor_id, turno, valor, criado_por)
     VALUES ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'manha', 600, NULL) RETURNING id::text$q$);
SELECT e2e.c_banco('C05.98.fracionado', 305, 'Fracionado (private.plantao_erp_valor): 6 h de noite (base 720) e 12 h numa manhã (base 360), para o RT decidir',
  $q$SELECT 'noite 360 min: ' || coalesce(private.plantao_erp_valor('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000012', 'noite', 360, true)::text, 'nulo')
      || '; PS manhã 720 min: ' || coalesce(private.plantao_erp_valor('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'manha', 720, true)::text, 'nulo')
      || '; PS manhã 360 min: ' || coalesce(private.plantao_erp_valor('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'manha', 360, true)::text, 'nulo')
      || '; madrugada (sem linha própria): ' || coalesce(private.plantao_erp_valor('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'madrugada', 360, false)::text, 'nulo')$q$);

-- ── 9 a 12. conta do C01: versões do ERP e reabertura ───────────────────────
SELECT e2e.passo('C05.09.lista_versoes', 305, 'f5_fat', '/faturamento/erp (contas)', 'Lista das versões: conta do C01 v1 vigente, total, itens com competência, medicamentos sem valor, glosas [], conciliação pendente, só o prontuário do paciente',
  format($q$SELECT e2e.c_confere(v ->> 'situacao' = 'vigente' AND v ->> 'conciliacao' = 'pendente' AND jsonb_array_length(v -> 'glosas') = 0 AND v ? 'prontuario'
        AND NOT (v ? 'paciente') AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'medicamentos') m WHERE m ? 'valor'),
      'v' || (v ->> 'versao') || ' ' || (v ->> 'situacao') || ', total ' || (v ->> 'total') || ', total_referencia ' || (v ->> 'total_referencia')
      || ', competências ' || (SELECT string_agg(DISTINCT i ->> 'competencia', ',') FROM jsonb_array_elements(v -> 'itens') i)
      || ', prontuário ' || (v ->> 'prontuario') || ', chaves ' || (SELECT string_agg(k, ',') FROM jsonb_object_keys(v) k))
    FROM jsonb_array_elements(public.erp_contas_da_unidade(%L::uuid)) v WHERE v ->> 'conta_id' = %L AND (v ->> 'versao')::int = 1$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c01_conta')));
SELECT e2e.passo('C05.10.fat_nao_reabre', 305, 'f5_fat', '/faturamento/contas', 'Faturamento reabre a conta faturada (deve ser recusado)',
  format($q$SELECT public.mudar_etapa_conta(%L::uuid, 'aberta', 'Teste C05: retirar a sutura lançada')::text$q$, e2e.u('c01_conta')), 'erro:Reabrir conta fechada é do gestor');
SELECT e2e.passo('C05.10.reabrir', 305, 'f5_ges_upa', '/faturamento/contas', 'Gestor reabre a conta faturada do C01 com motivo',
  format($q$SELECT (public.mudar_etapa_conta(%L::uuid, 'aberta', 'Teste C05: retirar a sutura lançada') ->> 'status')$q$, e2e.u('c01_conta')), 'ok', 'c05_reaberta');
SELECT e2e.c('c05_reaberta', 'C05.10.reabrir', 'C05.10.banco', 305, 'banco', NULL, 'itens_congelados nulo, liberação desfeita, v1 substituída; eventos reaberta e erp_substituida; auditoria conta_reaberta e conta_erp_substituida',
  format($q$SELECT e2e.c_confere(c.itens_congelados IS NULL AND c.liberada_em IS NULL
        AND (SELECT situacao FROM public.conta_versoes_erp WHERE conta_id = c.id AND versao = 1) = 'substituida'
        AND EXISTS (SELECT 1 FROM public.conta_eventos WHERE conta_id = c.id AND evento = 'reaberta')
        AND EXISTS (SELECT 1 FROM public.conta_eventos WHERE conta_id = c.id AND evento = 'erp_substituida'),
      'status ' || c.status || '; v1 ' || (SELECT situacao FROM public.conta_versoes_erp WHERE conta_id = c.id AND versao = 1)
      || '; auditoria: ' || coalesce((SELECT string_agg(DISTINCT acao, ', ') FROM public.log_auditoria WHERE entidade_id = c.id AND acao IN ('conta_reaberta', 'conta_erp_substituida')), 'nenhuma'))
    FROM public.contas c WHERE c.id = %L$q$, e2e.u('c01_conta')));
SELECT e2e.c('c05_reaberta', 'C05.10.reabrir', 'C05.11.retirar', 305, 'f5_fat', '/faturamento/contas', 'Faturamento retira o procedimento lançado (sutura) com motivo',
  format($q$SELECT e2e.c_resumo_conta(public.retirar_procedimento_conta(%L::uuid, 'registro', %L::uuid, 'Sutura lançada em duplicidade (teste C05)'))$q$,
    e2e.u('c01_conta'), e2e.u('c01_reg')));
SELECT e2e.c('c05_reaberta', 'C05.10.reabrir', 'C05.11.evento', 305, 'banco', NULL, 'conta_eventos retirada; procedimento cancelado',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM public.conta_eventos WHERE conta_id = %L AND evento = 'retirada')
        AND (SELECT cancelado_em IS NOT NULL FROM public.procedimentos_realizados WHERE id = %L), 'retirada e cancelado')$q$, e2e.u('c01_conta'), e2e.u('c01_reg')));
SELECT e2e.c('c05_reaberta', 'C05.10.reabrir', 'C05.12.conferencia', 305, 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c01_conta'), 'em_conferencia', 'status'));
SELECT e2e.c('c05_reaberta', 'C05.10.reabrir', 'C05.12.fechar', 305, 'f5_fat', '/faturamento/contas', 'Fechar',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c01_conta'), 'fechada', 'status'), 'ok', 'c05_fechada');
SELECT e2e.c('c05_fechada', 'C05.12.fechar', 'C05.12.faturar', 305, 'f5_fat', '/faturamento/contas', 'Faturar de novo',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c01_conta'), 'faturada', 'status'), 'ok', 'c05_faturada');
SELECT e2e.c('c05_faturada', 'C05.12.faturar', 'C05.12.v2', 305, 'banco', NULL, 'v2 vigente com o total novo; v1 substituída; evento erp_disponivel "Versão 2"',
  format($q$SELECT e2e.c_confere((SELECT situacao FROM public.conta_versoes_erp WHERE conta_id = %1$L AND versao = 2) = 'vigente'
        AND (SELECT situacao FROM public.conta_versoes_erp WHERE conta_id = %1$L AND versao = 1) = 'substituida'
        AND EXISTS (SELECT 1 FROM public.conta_eventos WHERE conta_id = %1$L AND evento = 'erp_disponivel' AND coalesce(motivo, '') || coalesce(para, '') LIKE '%%2%%'),
      (SELECT string_agg('v' || versao || ' ' || situacao || ' total ' || total || ' (ref ' || (dados ->> 'total_referencia') || ')', '; ' ORDER BY versao) FROM public.conta_versoes_erp WHERE conta_id = %1$L))$q$,
    e2e.u('c01_conta')));

-- ── 13. retorno do ERP pela API ─────────────────────────────────────────────
SELECT e2e.c_banco('C05.13.chave_financeiro', 305, 'Chave da API com o recurso financeiro, ativa, na homologação',
  $q$SELECT 'chaves ativas com financeiro: ' || count(*) FROM public.api_chaves WHERE 'financeiro' = ANY (recursos) AND revogada_em IS NULL AND (expira_em IS NULL OR expira_em > now())$q$);
SELECT e2e.lacuna('C05.13.retorno_api', 305, 'ERP', 'POST /financeiro/contas/{conta}/versoes/2/retorno (lancada → conciliada)',
  'Lacuna de ambiente: não há chave ativa com o recurso financeiro na homologação (a única, "ERP teste ponta a ponta", foi revogada em 27/10/2026); por instrução, nenhuma chave foi criada. A versão 2 fica com conciliação pendente.');

SELECT passo, papel, situacao, left(detalhe, 220) AS detalhe FROM e2e.resultados
 WHERE passo LIKE 'C05.%' AND em >= e2e.v('c05_inicio')::timestamptz ORDER BY id;
