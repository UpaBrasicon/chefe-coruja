-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário C03.
-- APAC com competências executadas.
-- Especificação: CENARIOS-C-farmacia-custos.md, seção C03.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas
-- (passos 'C03.NN.*', paciente 303). Nada é corrigido no produto.
--
-- Regras do teste: paciente fictício novo a cada rodada ("Cícero C3 Sessões",
-- "... B"); a cor é do enfermeiro de teste (verde); nenhuma dose. Procedimento
-- da APAC escolhido no SIGTAP carregado (registro 06, CBO 225125 aceito, CID
-- da lista do próprio SIGTAP): 0301130051 com N18.0. Número da APAC fictício
-- (13 dígitos, único por rodada). Tipo de atendimento e motivo de saída da
-- execução: códigos de 2 dígitos FICTÍCIOS ('01' e '21'); a tela só confere o
-- formato. A execução da competência seguinte usa data de ocorrência no mês
-- seguinte, porque o teste não espera o mês virar.
--
-- Muda configuração da UPA F5: órgão emissor da APAC (fictício), só se faltar;
-- fecha e reabre a competência da APAC do mês (fica 'reaberta').
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/72_cenario_c03.sql <saida>.sql
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
SELECT e2e.c_guardar('c03_rodada', (coalesce(e2e.v('c03_rodada')::int, 0) + 1)::text);
SELECT e2e.c_guardar('c03_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'c03\_%' AND nome NOT IN ('c03_rodada', 'c03_inicio');
SELECT e2e.c_guardar('c03_nome', 'Cícero C3 Sessões' || CASE WHEN e2e.v('c03_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('c03_rodada')::int) ELSE '' END);
SELECT e2e.c_guardar('c03_cns', e2e.c_cns(300 + e2e.v('c03_rodada')::int));
SELECT e2e.c_guardar('c03_comp', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'));
SELECT e2e.c_guardar('c03_comp1', to_char((now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month', 'YYYYMM'));
SELECT e2e.c_guardar('c03_comp3', to_char((now() AT TIME ZONE 'America/Sao_Paulo') + interval '3 month', 'YYYYMM'));
SELECT e2e.c_guardar('c03_comp_menos1', to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYYMM'));
SELECT e2e.c_guardar('c03_val_ini', date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date::text);
SELECT e2e.c_guardar('c03_val_fim', (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '3 month' - interval '1 day')::date::text);
SELECT e2e.c_guardar('c03_hoje', private.data_atual()::text);
SELECT e2e.c_guardar('c03_data_m1', (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month' + interval '6 day')::date::text);
SELECT e2e.c_guardar('c03_num_apac', '2611' || lpad((300000000 + e2e.v('c03_rodada')::int)::text, 9, '0'));
SELECT e2e.c_guardar('c03_proc', '0301130051');
SELECT e2e.c_guardar('c03_cadastro', jsonb_build_object('nome', e2e.v('c03_nome'), 'data_nascimento', '1971-06-02', 'sexo', 'M',
  'raca_cor', 'preta', 'cns', e2e.v('c03_cns'), 'nome_mae', 'Mãe Fictícia do Teste C03', 'endereco', 'Rua do Teste, 303',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.c_guardar('c03_med', 'f5200000-0000-4000-8000-000000000008');

-- ── 0. pré-condições ────────────────────────────────────────────────────────
SELECT e2e.passo('C03.00.busca', 303, 'f5_med_upa', '/atendimento → Solicitar APAC (busca)', 'Busca SIGTAP da APAC (registro 06) acha 0301130051',
  $q$SELECT e2e.c_confere(public.buscar_sigtap_apac('0301130051')::text LIKE '%0301130051%', left(public.buscar_sigtap_apac('0301130051')::text, 200))$q$);
SELECT e2e.c_banco('C03.00.sigtap', 303, 'O procedimento no SIGTAP carregado: valor_sa, qt_maxima, CID aceito, CBO 225125 aceito',
  $q$SELECT 'valor_sa ' || coalesce(valor_sa::text, 'nulo') || ', qt_maxima ' || coalesce(qt_maxima::text, '-')
      || ', CIDs ' || (SELECT string_agg(cid, ',') FROM terminologia.sigtap_procedimento_cid WHERE procedimento = '0301130051')
      || ', CBO 225125 ' || EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_ocupacao WHERE procedimento = '0301130051' AND cbo = '225125')
     FROM terminologia.sigtap_procedimento WHERE codigo = '0301130051'$q$);

-- ── 1. porta: ficha, classificação, atendimento ─────────────────────────────
SELECT e2e.passo('C03.01.ficha', 303, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção cadastra Cícero e abre a ficha no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Acompanhamento pedido pelo médico da UPA', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('c03_cadastro')), 'ok', 'c03_ep');
SELECT e2e.c('c03_ep', 'C03.01.ficha', 'C03.01.paciente', 303, 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('c03_ep')), 'ok', 'c03_pac');
SELECT e2e.c('c03_pac', 'C03.01.paciente', 'C03.01.endereco_sus', 303, 'f5_rec_upa', '/recepcao (Endereço SUS)',
  'Recepção completa o endereço SUS (CEP, município IBGE, tipo de logradouro, número, bairro, nacionalidade; dados fictícios de teste): a APAC exige',
  format('SELECT public.salvar_endereco_sus(%L::uuid, %L::jsonb)::text', e2e.u('c03_pac'),
    '{"cep":"01000000","municipio_ibge":"355030","tipo_logradouro":"081","endereco":"Rua do Teste","numero_endereco":"303","bairro":"Bairro Teste","nacionalidade":"010"}'));
SELECT e2e.c('c03_ep', 'C03.01.ficha', 'C03.01.conta', 303, 'f5_fat', '/faturamento/contas', 'Conta A aberta',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' LIMIT 1), e2e.c_falhar('conta A não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c03_nome')), 'ok', 'c03_conta');
SELECT e2e.c('c03_ep', 'C03.01.ficha', 'C03.01.chamar', 303, 'f5_enf_upa', '/triagem (Fila)', 'Enfermeiro chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('c03_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.c('c03_ep', 'C03.01.ficha', 'C03.01.classificar', 303, 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica verde (escolha do enfermeiro de teste), sinais crus, fluxograma "Mal-estar geral", discriminador escrito pelo enfermeiro',
  format($q$SELECT public.classificar_risco(%L::uuid, 'verde',
    '{"frequencia-cardiaca":78,"frequencia-respiratoria":16,"temperatura":36.4,"saturacao-o2":97,"escala-dor":0,"pressao-arterial-sistolica":142,"pressao-arterial-diastolica":88}'::jsonb,
    %L::uuid, 'Sem queixa aguda, encaminhamento para acompanhamento', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true, NULL, NULL, NULL)::text$q$, e2e.u('c03_ep'),
    '5b981a47-948c-46e2-838f-403c7d27da81'));
SELECT e2e.c('c03_ep', 'C03.01.ficha', 'C03.01.iniciar', 303, 'f5_med_upa', '/atendimento', 'Plantonista assume',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('c03_ep')));
SELECT e2e.c('c03_ep', 'C03.01.ficha', 'C03.01.soap', 303, 'f5_med_upa', '/atendimento', 'SOAP com o CID da lista do procedimento (N18.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Doença renal crônica em acompanhamento (teste C03)', 'Sem sinais de descompensação',
    'Doença renal crônica', 'Pedido de APAC para acompanhamento multiprofissional (teste de fluxo)', 'N18.0')::text$q$, e2e.u('c03_ep')));

-- ── 2. médico solicita a APAC ───────────────────────────────────────────────
SELECT e2e.c('c03_pac', 'C03.01.paciente', 'C03.02.enfermeiro_nao', 303, 'f5_enf_upa', '/atendimento → Solicitar APAC', 'Enfermeiro (sem CRM) tenta solicitar (deve ser recusado)',
  format('SELECT public.solicitar_apac(%L::uuid, %L::jsonb)::text', e2e.u('c03_pac'),
    jsonb_build_object('procedimento', e2e.v('c03_proc'), 'cid', 'N18.0', 'tipo', '1', 'carater', '01',
      'justificativa', jsonb_build_object('justificativa', 'Acompanhamento multiprofissional (teste C03)'), 'episodio_id', e2e.v('c03_ep'))), 'erro');
SELECT e2e.c('c03_pac', 'C03.01.paciente', 'C03.02.tipo2_sem_anterior', 303, 'f5_med_upa', '/atendimento → Solicitar APAC', 'Tipo 2 (continuidade) sem APAC anterior (deve ser recusado)',
  format('SELECT public.solicitar_apac(%L::uuid, %L::jsonb)::text', e2e.u('c03_pac'),
    jsonb_build_object('procedimento', e2e.v('c03_proc'), 'cid', 'N18.0', 'tipo', '2', 'carater', '01',
      'justificativa', jsonb_build_object('justificativa', 'Acompanhamento multiprofissional (teste C03)'), 'episodio_id', e2e.v('c03_ep'))), 'erro:APAC de continuidade');
SELECT e2e.c('c03_pac', 'C03.01.paciente', 'C03.02.cid_invalido', 303, 'f5_med_upa', '/atendimento → Solicitar APAC', 'CID fora do formato (deve ser recusado)',
  format('SELECT public.solicitar_apac(%L::uuid, %L::jsonb)::text', e2e.u('c03_pac'),
    jsonb_build_object('procedimento', e2e.v('c03_proc'), 'cid', 'XYZ', 'tipo', '1', 'carater', '01',
      'justificativa', jsonb_build_object('justificativa', 'Acompanhamento multiprofissional (teste C03)'), 'episodio_id', e2e.v('c03_ep'))), 'erro:CID principal');
SELECT e2e.c('c03_pac', 'C03.01.paciente', 'C03.02.solicitar', 303, 'f5_med_upa', '/atendimento → Solicitar APAC', 'Médico pede APAC tipo 1, caráter 01, 0301130051, N18.0, ligada ao episódio',
  format('SELECT public.solicitar_apac(%L::uuid, %L::jsonb)::text', e2e.u('c03_pac'),
    jsonb_build_object('procedimento', e2e.v('c03_proc'), 'cid', 'N18.0', 'tipo', '1', 'carater', '01',
      'justificativa', jsonb_build_object('justificativa', 'Acompanhamento multiprofissional pré-diálise (teste C03)'), 'episodio_id', e2e.v('c03_ep'))), 'ok', 'c03_apac');
SELECT e2e.c('c03_apac', 'C03.02.solicitar', 'C03.02.banco', 303, 'banco', NULL, 'APAC solicitada, críticas sem bloqueante, SIGTAP da competência, evento e auditoria',
  format($q$SELECT e2e.c_confere(a.status = 'solicitada' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.criticas) x WHERE (x ->> 'bloqueante')::boolean)
        AND EXISTS (SELECT 1 FROM public.apac_eventos WHERE apac_id = a.id AND evento = 'solicitada')
        AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = a.id AND acao = 'apac_solicitada'),
      'status ' || a.status || ', sigtap ' || coalesce(a.sigtap_competencia, '?') || ', críticas ' || a.criticas::text) FROM public.apacs a WHERE a.id = %L$q$, e2e.u('c03_apac')));
SELECT e2e.lacuna('C03.02.sem_valor_apac', 303, 'banco', 'Valor gravado na APAC', 'Lacuna (MAPA): apacs e apac_execucoes não têm coluna de valor; a glosa é o único lugar em que a APAC vira reais (passo 13).');

-- ── 3. faturamento: a APAC na conta é documento, sem valor ──────────────────
SELECT e2e.c('c03_apac', 'C03.02.solicitar', 'C03.03.conta', 303, 'f5_fat', '/faturamento/contas (conta A)', 'APAC nos documentos SUS com aviso "APAC ainda não autorizada." não bloqueante; nenhum item apac',
  format($q$SELECT e2e.c_confere((d -> 'documentos_sus' -> 'apacs')::text LIKE '%%' || %L || '%%'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'pendencias') p WHERE p ->> 'codigo' = 'apac' AND NOT (p ->> 'bloqueante')::boolean)
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'origem' = 'apac'), e2e.c_resumo_conta(d))
    FROM (SELECT public.conta_detalhe(%L::uuid) d) z$q$, e2e.v('c03_apac'), e2e.u('c03_conta')));

-- ── 4. NIR cobra ────────────────────────────────────────────────────────────
SELECT e2e.c('c03_apac', 'C03.02.solicitar', 'C03.04.nir_ve', 303, 'f5_nir', '/nir', 'NIR vê a pendência apac_sem_decisao',
  format($q$SELECT e2e.c_confere(public.nir_pendencias(%L::uuid)::text LIKE '%%' || %L || '%%', 'na lista do NIR')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c03_apac')));
SELECT e2e.c('c03_apac', 'C03.02.solicitar', 'C03.04.nir_cobra', 303, 'f5_nir', '/nir', 'NIR cobra a APAC sem decisão',
  format($q$SELECT public.nir_cobrar(%L::uuid, 'apac_sem_decisao', %L::uuid)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('c03_apac')));

-- ── 5. regulador autoriza ───────────────────────────────────────────────────
SELECT e2e.c('c03_apac', 'C03.02.solicitar', 'C03.05.fim_antes', 303, 'f5_regulador', '/apac', 'Validade com o fim antes do início (deve ser recusado)',
  format('SELECT public.decidir_apac(%L::uuid, true, %L, %L::date, %L::date, NULL)::text', e2e.u('c03_apac'), e2e.v('c03_num_apac'), e2e.v('c03_val_fim'), e2e.v('c03_val_ini')),
  'erro:Validade');
SELECT e2e.c('c03_apac', 'C03.02.solicitar', 'C03.05.rejeita_curto', 303, 'f5_regulador', '/apac', 'Rejeitar com motivo curto (deve ser recusado)',
  format($q$SELECT public.decidir_apac(%L::uuid, false, NULL, NULL, NULL, 'curto')::text$q$, e2e.u('c03_apac')), 'erro:Escreva o motivo da rejeição');
SELECT e2e.c('c03_apac', 'C03.02.solicitar', 'C03.05.autorizar', 303, 'f5_regulador', '/apac', 'Autoriza com número fictício de 13 dígitos e validade do mês até M+2',
  format('SELECT public.decidir_apac(%L::uuid, true, %L, %L::date, %L::date, NULL)::text', e2e.u('c03_apac'), e2e.v('c03_num_apac'), e2e.v('c03_val_ini'), e2e.v('c03_val_fim')),
  'ok', 'c03_autorizada');
SELECT e2e.c('c03_autorizada', 'C03.05.autorizar', 'C03.05.banco', 303, 'banco', NULL, 'APAC autorizada com número, validade e evento',
  format($q$SELECT e2e.c_confere(status = 'autorizada' AND EXISTS (SELECT 1 FROM public.apac_eventos WHERE apac_id = a.id AND evento = 'autorizada'),
      'status ' || status || ', nº ' || numero || ', validade ' || validade_inicio || ' a ' || validade_fim) FROM public.apacs a WHERE id = %L$q$, e2e.u('c03_apac')));
SELECT e2e.c('c03_autorizada', 'C03.05.autorizar', 'C03.05.decidir_de_novo', 303, 'f5_regulador', '/apac', 'Decidir de novo (deve ser recusado)',
  format('SELECT public.decidir_apac(%L::uuid, true, %L, %L::date, %L::date, NULL)::text', e2e.u('c03_apac'), e2e.v('c03_num_apac'), e2e.v('c03_val_ini'), e2e.v('c03_val_fim')),
  'erro:Só APAC solicitada é decidida');

-- ── 6. alta ─────────────────────────────────────────────────────────────────
SELECT e2e.c('c03_ep', 'C03.01.ficha', 'C03.06.alta', 303, 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho alta',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{}'::jsonb)::text$q$, e2e.u('c03_ep')), 'ok', 'c03_alta');

-- ── 7 e 8. faturamento registra as execuções ────────────────────────────────
SELECT CASE WHEN (SELECT apac_orgao_emissor FROM public.bpa_config_unidade WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002') IS NOT NULL
  THEN e2e.lacuna('C03.07.orgao_emissor', 303, 'f5_fat', 'Órgão emissor da APAC', 'não precisou: a UPA já tem')
  ELSE e2e.passo('C03.07.orgao_emissor', 303, 'f5_fat', '/apac (Arquivo)', 'Faturamento define o órgão emissor da APAC (código fictício de teste)',
    format($q$SELECT public.definir_apac_orgao_emissor(%L::uuid, 'F5TESTE')::text$q$, 'f5100000-0000-4000-8000-000000000002')) END;
SELECT e2e.c('c03_autorizada', 'C03.05.autorizar', 'C03.07.fora_validade', 303, 'f5_fat', '/apac (Registrar execução)', 'Execução em competência fora da validade (deve ser recusado)',
  format('SELECT public.registrar_execucao_apac(%L::uuid, %L, %L, %L, %L::date, %L::uuid, %L::jsonb)::text', e2e.u('c03_apac'), e2e.v('c03_comp3'), '01', '21',
    e2e.v('c03_hoje'), e2e.u('c03_med'), jsonb_build_array(jsonb_build_object('procedimento', e2e.v('c03_proc'), 'quantidade', 1))), 'erro:Competência fora da validade');
SELECT e2e.c('c03_autorizada', 'C03.05.autorizar', 'C03.07.sem_instrumento', 303, 'f5_fat', '/apac (Registrar execução)', 'Procedimento sem registro 06/07 (0301060096) na execução (deve ser recusado)',
  format('SELECT public.registrar_execucao_apac(%L::uuid, %L, %L, %L, %L::date, %L::uuid, %L::jsonb)::text', e2e.u('c03_apac'), e2e.v('c03_comp'), '01', '21',
    e2e.v('c03_hoje'), e2e.u('c03_med'), jsonb_build_array(jsonb_build_object('procedimento', e2e.v('c03_proc'), 'quantidade', 1), jsonb_build_object('procedimento', '0301060096', 'quantidade', 1))),
  'erro:O SIGTAP não registra');
SELECT e2e.c('c03_autorizada', 'C03.05.autorizar', 'C03.07.qt_maxima', 303, 'f5_fat', '/apac (Registrar execução)', 'Quantidade acima do qt_maxima do SIGTAP (deve ser recusado)',
  format('SELECT public.registrar_execucao_apac(%L::uuid, %L, %L, %L, %L::date, %L::uuid, %L::jsonb)::text', e2e.u('c03_apac'), e2e.v('c03_comp'), '01', '21',
    e2e.v('c03_hoje'), e2e.u('c03_med'), jsonb_build_array(jsonb_build_object('procedimento', e2e.v('c03_proc'), 'quantidade', 2))), 'erro:Quantidade de');
SELECT e2e.c('c03_autorizada', 'C03.05.autorizar', 'C03.07.sem_principal', 303, 'f5_fat', '/apac (Registrar execução)', 'Execução com quantidade 0 (deve ser recusado)',
  format('SELECT public.registrar_execucao_apac(%L::uuid, %L, %L, %L, %L::date, %L::uuid, %L::jsonb)::text', e2e.u('c03_apac'), e2e.v('c03_comp'), '01', '21',
    e2e.v('c03_hoje'), e2e.u('c03_med'), jsonb_build_array(jsonb_build_object('procedimento', e2e.v('c03_proc'), 'quantidade', 0))), 'erro:Quantidade inválida');
SELECT e2e.c('c03_autorizada', 'C03.05.autorizar', 'C03.07.execucao_m', 303, 'f5_fat', '/apac (Registrar execução)', 'Execução da competência do mês: executante = médico, procedimento principal qt 1',
  format('SELECT public.registrar_execucao_apac(%L::uuid, %L, %L, %L, %L::date, %L::uuid, %L::jsonb)::text', e2e.u('c03_apac'), e2e.v('c03_comp'), '01', '21',
    e2e.v('c03_hoje'), e2e.u('c03_med'), jsonb_build_array(jsonb_build_object('procedimento', e2e.v('c03_proc'), 'quantidade', 1))), 'ok', 'c03_exec_m');
SELECT e2e.c('c03_autorizada', 'C03.05.autorizar', 'C03.08.execucao_m1', 303, 'f5_fat', '/apac (Registrar execução)', 'Execução da competência seguinte (dentro da validade; data de ocorrência no mês seguinte)',
  format('SELECT public.registrar_execucao_apac(%L::uuid, %L, %L, %L, %L::date, %L::uuid, %L::jsonb)::text', e2e.u('c03_apac'), e2e.v('c03_comp1'), '01', '21',
    e2e.v('c03_data_m1'), e2e.u('c03_med'), jsonb_build_array(jsonb_build_object('procedimento', e2e.v('c03_proc'), 'quantidade', 1))), 'ok', 'c03_exec_m1');
SELECT e2e.c('c03_exec_m', 'C03.07.execucao_m', 'C03.08.execucoes', 303, 'banco', NULL, 'Duas execuções válidas, sem valor; eventos execucao_registrada',
  format($q$SELECT e2e.c_confere(count(*) = 2, string_agg(competencia || ' ' || procedimentos::text || ' (data ' || data_ocorrencia || ')', '; ' ORDER BY competencia)
      || '; eventos ' || (SELECT count(*) FROM public.apac_eventos WHERE apac_id = %1$L AND evento = 'execucao_registrada'))
    FROM public.apac_execucoes WHERE apac_id = %1$L AND cancelado_em IS NULL$q$, e2e.u('c03_apac')));

-- ── 9 a 11. conferência, fechamento, arquivo, reabertura ────────────────────
SELECT e2e.passo('C03.09.conferencia', 303, 'f5_fat', '/apac (Arquivo)', 'Conferência da competência do mês: linha da APAC e globais',
  format($q$SELECT 'globais ' || (x -> 'globais')::text || '; linha: ' || coalesce((SELECT l::text FROM jsonb_array_elements(x -> 'linhas') l WHERE l ->> 'apac_id' = %L), 'não listada')
      || '; fechamento ' || coalesce((x -> 'fechamento')::text, 'nulo') FROM (SELECT public.apac_conferencia(%L::uuid, %L) x) z$q$,
    e2e.v('c03_apac'), 'f5100000-0000-4000-8000-000000000002', e2e.v('c03_comp')));
SELECT e2e.passo('C03.09.outra_rede', 303, 'faturamento', '/apac', 'Faturamento de outra rede lê a conferência da UPA F5 (deve ser recusado)',
  format('SELECT public.apac_conferencia(%L::uuid, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c03_comp')), 'erro');
SELECT e2e.passo('C03.10.sem_execucao', 303, 'f5_fat', '/apac (Arquivo)', 'Fechar competência sem execução (mês anterior) (deve ser recusado)',
  format('SELECT public.fechar_competencia_apac(%L::uuid, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c03_comp_menos1')), 'erro');
SELECT e2e.passo('C03.10.fechar', 303, 'f5_fat', '/apac (Arquivo)', 'Fecha a competência da APAC do mês',
  format('SELECT public.fechar_competencia_apac(%L::uuid, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c03_comp')), 'ok', 'c03_fech');
SELECT e2e.c('c03_fech', 'C03.10.fechar', 'C03.10.fechamento', 303, 'banco', NULL, 'apac_fechamentos: apacs, controle, excluídas, SIGTAP',
  format($q$SELECT 'apacs ' || apacs || ', controle ' || controle || ', excluídas ' || jsonb_array_length(excluidas) || ', sigtap ' || coalesce(sigtap_competencia, '?') || ', situação ' || situacao
    FROM public.apac_fechamentos WHERE id = %L$q$, e2e.u('c03_fech')));
SELECT e2e.c('c03_fech', 'C03.10.fechar', 'C03.10.arquivo', 303, 'f5_fat', '/apac (Arquivo, baixar)', 'Arquivo APAC_9995028_AAAAMM.txt com o número da APAC; sem valor (12200 não aparece)',
  format($q$SELECT e2e.c_confere(a ->> 'nome' = 'APAC_9995028_' || %L || '.txt' AND position(%L IN a ->> 'conteudo') > 0 AND position('12200' IN a ->> 'conteudo') = 0,
      a ->> 'nome' || ', ' || length(a ->> 'conteudo') || ' caracteres, ' || array_length(string_to_array(a ->> 'conteudo', E'\n'), 1) || ' linhas')
    FROM (SELECT public.arquivo_apac(%L::uuid) a) z$q$, e2e.v('c03_comp'), e2e.v('c03_num_apac'), e2e.u('c03_fech')));
SELECT e2e.c('c03_fech', 'C03.10.fechar', 'C03.10.auditoria', 303, 'banco', NULL, 'log_auditoria apac_competencia_fechada e apac_arquivo_baixado',
  format($q$SELECT e2e.c_confere(count(DISTINCT acao) = 2, string_agg(DISTINCT acao, ', ')) FROM public.log_auditoria
    WHERE entidade_id = %L::uuid AND acao IN ('apac_competencia_fechada', 'apac_arquivo_baixado')$q$, e2e.u('c03_fech')));
SELECT e2e.c('c03_fech', 'C03.10.fechar', 'C03.10.fechar_de_novo', 303, 'f5_fat', '/apac (Arquivo)', 'Fechar de novo (deve ser recusado)',
  format('SELECT public.fechar_competencia_apac(%L::uuid, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c03_comp')), 'erro:Competência da APAC já fechada');
SELECT e2e.c('c03_fech', 'C03.10.fechar', 'C03.10.execucao_fechada', 303, 'f5_fat', '/apac (Registrar execução)', 'Nova execução na competência fechada (deve ser recusado)',
  format('SELECT public.registrar_execucao_apac(%L::uuid, %L, %L, %L, %L::date, %L::uuid, %L::jsonb)::text', e2e.u('c03_apac'), e2e.v('c03_comp'), '01', '21',
    e2e.v('c03_hoje'), e2e.u('c03_med'), jsonb_build_array(jsonb_build_object('procedimento', e2e.v('c03_proc'), 'quantidade', 1))), 'erro:A competência');
SELECT e2e.c('c03_fech', 'C03.10.fechar', 'C03.11.reabrir', 303, 'f5_fat', '/apac (Arquivo)', 'Reabre a competência com motivo',
  format($q$SELECT public.reabrir_competencia_apac(%L::uuid, 'Teste C03: reabertura da competência da APAC')::text$q$, e2e.u('c03_fech')), 'ok', 'c03_reaberta');
SELECT e2e.c('c03_reaberta', 'C03.11.reabrir', 'C03.11.banco', 303, 'banco', NULL, 'situação reaberta e motivo',
  format($q$SELECT e2e.c_confere(situacao = 'reaberta', 'situação ' || situacao || ', motivo ' || coalesce(motivo_reabertura, '?')) FROM public.apac_fechamentos WHERE id = %L$q$, e2e.u('c03_fech')));

-- ── 12. conta A: fechar e faturar sem a APAC ────────────────────────────────
SELECT e2e.c('c03_conta', 'C03.01.conta', 'C03.12.conferencia', 303, 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c03_conta'), 'em_conferencia', 'status'));
SELECT e2e.c('c03_alta', 'C03.06.alta', 'C03.12.fechar', 303, 'f5_fat', '/faturamento/contas', 'Fechar (o aviso da APAC não bloqueia)',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c03_conta'), 'fechada', 'status'), 'ok', 'c03_fechada');
SELECT e2e.c('c03_fechada', 'C03.12.fechar', 'C03.12.faturar', 303, 'f5_fat', '/faturamento/contas', 'fechada → faturada',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c03_conta'), 'faturada', 'status'), 'ok', 'c03_faturada');
SELECT e2e.c('c03_fechada', 'C03.12.fechar', 'C03.12.congelado', 303, 'banco', NULL, 'itens_congelados só com classificação e consulta; nenhuma origem apac; total igual ao de antes',
  format($q$SELECT e2e.c_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.itens_congelados) x WHERE x ->> 'origem' = 'apac'),
      'congelados: ' || (SELECT string_agg((x ->> 'origem') || ' ' || coalesce(x ->> 'valor_total', 'nulo'), ', ') FROM jsonb_array_elements(c.itens_congelados) x)
      || '; ERP v' || coalesce((SELECT max(versao)::text || ' total ' || max(total)::text FROM public.conta_versoes_erp WHERE conta_id = c.id), ' nenhuma'))
    FROM public.contas c WHERE c.id = %L$q$, e2e.u('c03_conta')));

-- ── 13 e 14. glosa da APAC e cancelamento da execução de M+1 ────────────────
SELECT e2e.c('c03_faturada', 'C03.12.faturar', 'C03.13.glosaveis', 303, 'f5_fat', '/faturamento/glosas (Registrar glosa)', 'Glosáveis: "APAC <nº> · código · nome" com valor = valor_sa e competência = maior executada (M+1)',
  format($q$SELECT e2e.c_confere(x ->> 'competencia' = %L AND (x ->> 'valor')::numeric = (SELECT valor_sa FROM terminologia.sigtap_procedimento WHERE codigo = '0301130051'),
      (x ->> 'rotulo') || ' = ' || (x ->> 'valor') || ' (' || (x ->> 'competencia') || ')')
    FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'glosaveis') x WHERE x ->> 'origem' = 'apac'$q$, e2e.v('c03_comp1'), e2e.u('c03_conta')));
SELECT e2e.c('c03_faturada', 'C03.12.faturar', 'C03.13.glosa', 303, 'f5_fat', '/faturamento/glosas', 'Glosa na APAC, motivo documento, valor sugerido aceito',
  format($q$SELECT (public.registrar_glosa(%L::uuid, 'apac', %L::uuid, 'documento', 'Laudo da APAC sem assinatura legível (teste C03)', NULL, NULL) ->> 'id')$q$,
    e2e.u('c03_conta'), e2e.u('c03_apac')), 'ok', 'c03_glosa');
SELECT e2e.c('c03_glosa', 'C03.13.glosa', 'C03.13.glosa_banco', 303, 'banco', NULL, 'conta_glosas.valor_sugerido = valor_sa; competência da glosa',
  format($q$SELECT e2e.c_confere(valor_sugerido = (SELECT valor_sa FROM terminologia.sigtap_procedimento WHERE codigo = '0301130051'),
      'valor ' || valor || ', sugerido ' || valor_sugerido || ', competência ' || competencia || ', rótulo ' || item_rotulo) FROM public.conta_glosas WHERE id = %L$q$, e2e.u('c03_glosa')));
SELECT e2e.c('c03_exec_m1', 'C03.08.execucao_m1', 'C03.14.cancelar', 303, 'f5_fat', '/apac', 'Cancela a execução de M+1 com motivo',
  format($q$SELECT public.cancelar_execucao_apac(%L::uuid, 'Execução lançada por engano (teste C03)')::text$q$, e2e.u('c03_exec_m1')), 'ok', 'c03_cancelada');
SELECT e2e.c('c03_cancelada', 'C03.14.cancelar', 'C03.14.banco', 303, 'banco', NULL, 'cancelado_em, motivo, evento execucao_cancelada; 1 execução válida',
  format($q$SELECT e2e.c_confere(e.cancelado_em IS NOT NULL AND EXISTS (SELECT 1 FROM public.apac_eventos WHERE apac_id = e.apac_id AND evento = 'execucao_cancelada')
        AND (SELECT count(*) FROM public.apac_execucoes WHERE apac_id = e.apac_id AND cancelado_em IS NULL) = 1,
      'cancelada em ' || e.cancelado_em || ', motivo ' || e.motivo_cancelamento) FROM public.apac_execucoes e WHERE e.id = %L$q$, e2e.u('c03_exec_m1')));
SELECT e2e.c('c03_cancelada', 'C03.14.cancelar', 'C03.14.competencia_volta', 303, 'f5_fat', '/faturamento/glosas', 'A competência glosável da APAC volta ao mês',
  format($q$SELECT e2e.c_confere(x ->> 'competencia' = %L, (x ->> 'rotulo') || ' (' || (x ->> 'competencia') || ')')
    FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'glosaveis') x WHERE x ->> 'origem' = 'apac'$q$, e2e.v('c03_comp'), e2e.u('c03_conta')));
SELECT e2e.c('c03_conta', 'C03.01.conta', 'C03.14.total_conta', 303, 'f5_fat', '/faturamento/contas', 'O total da conta A não mudou com a APAC',
  format($q$SELECT e2e.c_resumo_conta(public.conta_detalhe(%L::uuid))$q$, e2e.u('c03_conta')));

SELECT e2e.lacuna('C03.99.numero_repetido', 303, 'f5_regulador', 'Borda "número de APAC repetido"', 'Não exercida: pediria uma segunda APAC só para isso; a trava está em decidir_apac ("Este número de APAC já foi usado.").');

SELECT passo, papel, situacao, left(detalhe, 220) AS detalhe FROM e2e.resultados
 WHERE passo LIKE 'C03.%' AND em >= e2e.v('c03_inicio')::timestamptz ORDER BY id;
