-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário C02.
-- Internação com AIH, pré-auditoria e glosa com recurso.
-- Especificação: CENARIOS-C-farmacia-custos.md, seção C02.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas
-- (passos 'C02.NN.*', paciente 302). Nada é corrigido no produto.
--
-- Regras do teste: paciente fictícia nova a cada rodada ("Benedita C2
-- Pneumonia", "... B"); a cor é do enfermeiro de teste (amarelo); nenhuma
-- dose; os valores são os do SIGTAP carregado (SH + SP do procedimento do
-- laudo e do lançamento). O valor recuperado da glosa NÃO é digitado: o
-- faturamento deixa o campo vazio e o sistema assume o valor glosado (nenhum
-- valor inventado). A AIH recebe um número fictício de 13 dígitos.
--
-- Leito: o primeiro INT livre de trás para frente (INT-04, INT-03…); nunca
-- OA-01, OA-02, CM-01 nem CM-02.
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/71_cenario_c02.sql <saida>.sql
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


-- ── rodada: nome e CNS da paciente ──────────────────────────────────────────
SELECT e2e.c_guardar('c02_rodada', (coalesce(e2e.v('c02_rodada')::int, 0) + 1)::text);
SELECT e2e.c_guardar('c02_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'c02\_%' AND nome NOT IN ('c02_rodada', 'c02_inicio');
SELECT e2e.c_guardar('c02_nome', 'Benedita C2 Pneumonia' || CASE WHEN e2e.v('c02_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('c02_rodada')::int) ELSE '' END);
SELECT e2e.c_guardar('c02_cns', e2e.c_cns(200 + e2e.v('c02_rodada')::int));
SELECT e2e.c_guardar('c02_comp', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'));
SELECT e2e.c_guardar('c02_comp_mais1', to_char((now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month', 'YYYYMM'));
SELECT e2e.c_guardar('c02_comp_menos1', to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYYMM'));
-- número fictício da AIH: 13 dígitos, único por rodada
SELECT e2e.c_guardar('c02_num_aih', '352611' || lpad((7000000 + e2e.v('c02_rodada')::int)::text, 7, '0'));
SELECT e2e.c_guardar('c02_cadastro', jsonb_build_object('nome', e2e.v('c02_nome'), 'data_nascimento', '1958-04-20', 'sexo', 'F',
  'raca_cor', 'branca', 'cns', e2e.v('c02_cns'), 'nome_mae', 'Mãe Fictícia do Teste C02', 'endereco', 'Rua do Teste, 202',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.c_guardar('c02_med_int', 'f5200000-0000-4000-8000-000000000015');   -- medico.internacao.f5

-- ── 0. pré-condições ────────────────────────────────────────────────────────
SELECT e2e.c_banco('C02.00.regulador_na_upa', 302, 'regulador.f5 tem vínculo regulador na UPA (pré-condição 2, dada pelo 46)',
  $q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = 'f5200000-0000-4000-8000-000000000012'
      AND unidade_id = 'f5100000-0000-4000-8000-000000000002' AND papel = 'regulador' AND ativo), 'vínculo regulador na UPA')$q$);
SELECT e2e.c_banco('C02.00.criticas_aih', 302, 'Críticas da AIH da UPA: padrão do catálogo (nenhuma regra própria da unidade)',
  $q$SELECT 'regras próprias da UPA: ' || count(*) FROM public.aih_criticas_unidade WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002'$q$);

-- ── 1 a 3. porta: ficha, classificação, atendimento ─────────────────────────
SELECT e2e.passo('C02.01.ficha', 302, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção cadastra Benedita e abre a ficha no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Tosse com febre há 3 dias', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('c02_cadastro')), 'ok', 'c02_ep');
SELECT e2e.c('c02_ep', 'C02.01.ficha', 'C02.01.paciente', 302, 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('c02_ep')), 'ok', 'c02_pac');
SELECT e2e.c('c02_ep', 'C02.01.ficha', 'C02.01.conta_a', 302, 'f5_fat', '/faturamento/contas', 'Conta ambulatorial A aberta com a ficha',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' AND c ->> 'status' = 'aberta' LIMIT 1), e2e.c_falhar('conta A não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c02_nome')), 'ok', 'c02_conta_a');
SELECT e2e.c('c02_ep', 'C02.01.ficha', 'C02.02.chamar', 302, 'f5_enf_upa', '/triagem (Fila)', 'Enfermeiro chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('c02_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.c('c02_ep', 'C02.01.ficha', 'C02.02.classificar', 302, 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica amarelo (escolha do enfermeiro de teste), sinais crus, fluxograma "Queixas respiratórias", discriminador escrito pelo enfermeiro',
  format($q$SELECT public.classificar_risco(%L::uuid, 'amarelo',
    '{"frequencia-cardiaca":104,"frequencia-respiratoria":24,"temperatura":38.6,"saturacao-o2":93,"escala-dor":3,"pressao-arterial-sistolica":132,"pressao-arterial-diastolica":84}'::jsonb,
    %L::uuid, 'Febre e tosse produtiva há 3 dias, dispneia leve', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true, NULL, NULL, NULL)::text$q$, e2e.u('c02_ep'),
    '8ec1567f-7aaa-4ae6-bd8b-eab1a65cd34c'), 'ok', 'c02_class');
SELECT e2e.c('c02_ep', 'C02.01.ficha', 'C02.03.iniciar', 302, 'f5_med_upa', '/atendimento', 'Plantonista do PS assume',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('c02_ep')));
SELECT e2e.c('c02_pac', 'C02.01.paciente', 'C02.03.peso', 302, 'f5_med_upa', '/atendimento (peso)', 'Peso referido pela paciente (valor cru)',
  e2e.c_sinais(e2e.u('c02_pac'), '{"peso":64}', NULL, 'referido'));
SELECT e2e.c('c02_ep', 'C02.01.ficha', 'C02.03.soap', 302, 'f5_med_upa', '/atendimento', 'SOAP com CID de pneumonia (J18.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Tosse produtiva e febre há 3 dias (teste C02)', 'FR 24, SpO2 93%%, estertores em base direita',
    'Pneumonia adquirida na comunidade', 'Internação para tratamento conforme protocolo (teste de fluxo)', 'J18.9')::text$q$, e2e.u('c02_ep')));
SELECT e2e.c('c02_conta_a', 'C02.01.conta_a', 'C02.03.conta_a_itens', 302, 'f5_fat', '/faturamento/contas', 'Conta A com classificação e consulta',
  format($q$SELECT e2e.c_resumo_conta(public.conta_detalhe(%L::uuid))$q$, e2e.u('c02_conta_a')));

-- ── 4. desfecho internação no leito INT ─────────────────────────────────────
SELECT e2e.c('c02_pac', 'C02.01.paciente', 'C02.04.leitos', 302, 'f5_med_upa', '/atendimento (Desfecho)', 'leitos_para_ocupar da Internação: escolhe o último INT livre',
  format($q$SELECT coalesce((SELECT id::text FROM public.leitos_para_ocupar(%L::uuid, %L::uuid) WHERE identificador LIKE 'INT-%%' AND NOT reservado ORDER BY identificador DESC LIMIT 1),
      e2e.c_falhar('nenhum leito INT livre'))$q$, 'f5300000-0000-4000-8000-000000000013', e2e.u('c02_pac')), 'ok', 'c02_leito');
SELECT e2e.c('c02_leito', 'C02.04.leitos', 'C02.04.internar', 302, 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho internação no leito INT escolhido',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', NULL, jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
    e2e.u('c02_ep'), 'f5300000-0000-4000-8000-000000000013', e2e.v('c02_leito')));
SELECT e2e.c('c02_leito', 'C02.04.leitos', 'C02.04.internacao', 302, 'banco', NULL, 'Internação criada (id do desfecho)',
  format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L$q$, e2e.u('c02_ep')), 'ok', 'c02_int');
SELECT e2e.c('c02_int', 'C02.04.internacao', 'C02.04.leito_banco', 302, 'banco', NULL, 'Internação com internado_em, leito ocupado',
  format($q$SELECT e2e.c_confere(i.internado_em IS NOT NULL AND l.status = 'ocupado', 'leito ' || l.identificador || ' ' || l.status || ', internação ' || i.status)
    FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = %L$q$, e2e.u('c02_int')));
SELECT e2e.c('c02_int', 'C02.04.internacao', 'C02.04.conta_i', 302, 'f5_fat', '/faturamento/contas', 'Conta de internação I nasce ligada à conta A (origem)',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'internacao' LIMIT 1), e2e.c_falhar('conta de internação não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c02_nome')), 'ok', 'c02_conta_i');
SELECT e2e.c('c02_conta_i', 'C02.04.conta_i', 'C02.04.origem_derivadas', 302, 'f5_fat', '/faturamento/contas', 'Conta I aponta a A (origem) e a A mostra a I em derivadas',
  format($q$SELECT e2e.c_confere(i -> 'origem' ->> 'id' = %L AND (a -> 'derivadas')::text LIKE '%%' || %L || '%%',
      'I nº ' || (i ->> 'numero') || ' ← origem ' || (i -> 'origem' ->> 'numero') || '; derivadas da A: ' || (a -> 'derivadas')::text)
    FROM (SELECT public.conta_detalhe(%L::uuid) i, public.conta_detalhe(%L::uuid) a) z$q$, e2e.v('c02_conta_a'), e2e.v('c02_conta_i'), e2e.u('c02_conta_i'), e2e.u('c02_conta_a')));

-- ── 5 e 6. internação: admissão, diagnóstico, laudo → AIH ───────────────────
SELECT e2e.c('c02_int', 'C02.04.internacao', 'C02.05.admissao', 302, 'f5_med_int', '/plantao/internacao (caderno do leito)', 'Médico da Internação registra a admissão',
  format($q$SELECT public.registrar_admissao(%L::uuid, 'Admissão de paciente com pneumonia adquirida na comunidade (teste C02)',
    '{"subjetivo":"Tosse produtiva e febre há 3 dias (teste C02)","objetivo":"FR 24, SpO2 93%%, estertores em base direita","cid":"J18.9","plano":"Tratamento conforme protocolo (teste de fluxo)"}'::jsonb)::text$q$, e2e.u('c02_int')));
SELECT e2e.c('c02_int', 'C02.04.internacao', 'C02.05.diagnostico', 302, 'f5_med_int', '/plantao/internacao', 'Diagnóstico primário confirmado J18.9',
  format($q$SELECT public.registrar_diagnostico(%L::uuid, 'primario', 'J18.9', 'confirmado', NULL, NULL, NULL)::text$q$, e2e.u('c02_int')));
SELECT e2e.c('c02_int', 'C02.04.internacao', 'C02.06.conferir', 302, 'f5_med_int', '/plantao/internacao (laudo AIH)', 'Conferência do laudo: 0303140151 (tratamento de pneumonias) com J18.9',
  format($q$SELECT left(public.conferir_aih(%L::uuid, 'J18.9', NULL, NULL, '0303140151')::text, 400)$q$, e2e.u('c02_pac')));
SELECT e2e.c('c02_int', 'C02.04.internacao', 'C02.06.laudo', 302, 'f5_med_int', '/plantao/internacao (laudo AIH)', 'Emite o laudo de AIH com o procedimento principal 0303140151',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'laudo_aih', %L) ->> 'id')$q$, e2e.u('c02_pac'),
    jsonb_build_object('aih', jsonb_build_object('sinais', 'Febre, tosse produtiva, FR 24, SpO2 93% (teste C02)', 'condicoes', 'Pneumonia com necessidade de internação',
      'diagnostico', 'Pneumonia adquirida na comunidade', 'cid', 'J18.9', 'procCod', '0303140151', 'procDesc', 'TRATAMENTO DE PNEUMONIAS OU INFLUENZA (GRIPE)',
      'clinica', 'Clínica médica'))::text), 'ok', 'c02_laudo');
SELECT e2e.c('c02_laudo', 'C02.06.laudo', 'C02.06.aih', 302, 'banco', NULL, 'AIH nasce solicitada pelo gatilho do laudo; evento solicitada',
  format($q$SELECT a.id::text FROM public.aihs a WHERE a.laudo_id = %L AND a.status = 'solicitada'
      AND EXISTS (SELECT 1 FROM public.aih_eventos ev WHERE ev.aih_id = a.id AND ev.evento = 'solicitada')$q$, e2e.u('c02_laudo')), 'ok', 'c02_aih');
SELECT e2e.c('c02_aih', 'C02.06.aih', 'C02.06.aih_sem_valor', 302, 'banco', NULL, 'aihs não tem coluna de valor',
  $q$SELECT e2e.c_confere(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'aihs' AND column_name LIKE 'valor%'), 'sem coluna valor em aihs')$q$);

-- ── 7. faturamento: conta I com a AIH solicitada ────────────────────────────
SELECT e2e.c('c02_conta_i', 'C02.04.conta_i', 'C02.07.item_aih', 302, 'f5_fat', '/faturamento/contas (conta I)', 'Item origem aih com valor = SH + SP do SIGTAP; pendência bloqueante "AIH ainda não aprovada"',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'origem' = 'aih' AND x -> 'aih' ->> 'status' = 'solicitada'
          AND (x ->> 'valor_unitario')::numeric = (SELECT coalesce(valor_sh, 0) + coalesce(valor_sp, 0) FROM terminologia.sigtap_procedimento WHERE codigo = '0303140151'))
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'pendencias') p WHERE p ->> 'grupo' = 'documento' AND (p ->> 'bloqueante')::boolean),
      e2e.c_resumo_conta(d) || ' | ' || coalesce((SELECT string_agg((p ->> 'grupo') || '/' || (p ->> 'codigo') || CASE WHEN (p ->> 'bloqueante')::boolean THEN ' (BLOQ)' ELSE '' END || ': ' || left(p ->> 'texto', 60), ' | ')
        FROM jsonb_array_elements(d -> 'pendencias') p), ''))
    FROM (SELECT public.conta_detalhe(%L::uuid) d) z$q$, e2e.u('c02_conta_i')));
SELECT e2e.c('c02_conta_i', 'C02.04.conta_i', 'C02.07.total_antes', 302, 'banco', NULL, 'Total da conta I antes do lançamento (1 item)',
  format($q$SELECT (public.conta_detalhe(%L::uuid) ->> 'total_referencia')$q$, e2e.u('c02_conta_i')), 'ok', 'c02_total_1');

-- ── 8. NIR cobra a AIH sem decisão ──────────────────────────────────────────
SELECT e2e.c('c02_aih', 'C02.06.aih', 'C02.08.nir_ve', 302, 'f5_nir', '/nir', 'NIR vê a pendência aih_sem_decisao',
  format($q$SELECT e2e.c_confere(public.nir_pendencias(%L::uuid)::text LIKE '%%' || %L || '%%', left(public.nir_pendencias(%L::uuid)::text, 300))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c02_aih'), 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.c('c02_aih', 'C02.06.aih', 'C02.08.nir_cobra', 302, 'f5_nir', '/nir', 'NIR cobra a AIH sem decisão',
  format($q$SELECT public.nir_cobrar(%L::uuid, 'aih_sem_decisao', %L::uuid)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('c02_aih')));
SELECT e2e.c('c02_aih', 'C02.06.aih', 'C02.08.nir_nao_decide', 302, 'f5_nir', '/aih', 'NIR tenta decidir a AIH (deve ser recusado)',
  format($q$SELECT public.decidir_aih(%L::uuid, true, %L, %L, NULL)::text$q$, e2e.u('c02_aih'), e2e.v('c02_num_aih'), e2e.v('c02_comp')), 'erro');

-- ── 9. regulador decide ─────────────────────────────────────────────────────
SELECT e2e.c('c02_aih', 'C02.06.aih', 'C02.09.lista', 302, 'f5_regulador', '/aih', 'A AIH está na lista da UPA para o regulador',
  format($q$SELECT e2e.c_confere(public.aihs_da_unidade(%L::uuid, 'solicitada')::text LIKE '%%' || %L || '%%', 'na lista')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c02_aih')));
SELECT e2e.c('c02_aih', 'C02.06.aih', 'C02.09.doze_digitos', 302, 'f5_regulador', '/aih', 'Número com 12 dígitos (deve ser recusado)',
  format($q$SELECT public.decidir_aih(%L::uuid, true, '123456789012', %L, NULL)::text$q$, e2e.u('c02_aih'), e2e.v('c02_comp')), 'erro:Número da AIH');
SELECT e2e.c('c02_aih', 'C02.06.aih', 'C02.09.rejeita_curto', 302, 'f5_regulador', '/aih', 'Rejeitar com motivo curto (deve ser recusado)',
  format($q$SELECT public.decidir_aih(%L::uuid, false, NULL, NULL, 'curto')::text$q$, e2e.u('c02_aih')), 'erro');
SELECT e2e.c('c02_aih', 'C02.06.aih', 'C02.09.aprovar', 302, 'f5_regulador', '/aih', 'Regulador aprova com número fictício de 13 dígitos e competência do mês',
  format($q$SELECT public.decidir_aih(%L::uuid, true, %L, %L, NULL)::text$q$, e2e.u('c02_aih'), e2e.v('c02_num_aih'), e2e.v('c02_comp')), 'ok', 'c02_aih_ok');
SELECT e2e.c('c02_aih_ok', 'C02.09.aprovar', 'C02.09.aprovada', 302, 'banco', NULL, 'AIH aprovada, número, competência, evento aprovada',
  format($q$SELECT e2e.c_confere(status = 'aprovada' AND EXISTS (SELECT 1 FROM public.aih_eventos ev WHERE ev.aih_id = a.id AND ev.evento = 'aprovada'),
      'status ' || status || ', número ' || coalesce(numero, '?') || ', competência ' || coalesce(competencia, '?')) FROM public.aihs a WHERE id = %L$q$, e2e.u('c02_aih')));
SELECT e2e.c('c02_aih_ok', 'C02.09.aprovar', 'C02.09.decidir_de_novo', 302, 'f5_regulador', '/aih', 'Decidir de novo (deve ser recusado)',
  format($q$SELECT public.decidir_aih(%L::uuid, true, %L, %L, NULL)::text$q$, e2e.u('c02_aih'), e2e.v('c02_num_aih'), e2e.v('c02_comp')), 'erro:Só se decide AIH solicitada');
SELECT e2e.c('c02_aih_ok', 'C02.09.aprovar', 'C02.09.pendencia_some', 302, 'f5_fat', '/faturamento/contas (conta I)', 'Aprovada, a pendência "AIH ainda não aprovada" some',
  format($q$SELECT e2e.c_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'pendencias') p WHERE p ->> 'codigo' = 'aih'), 'sem pendência de AIH')$q$,
    e2e.u('c02_conta_i')));

-- ── 10. lançamento especial (diária de acompanhante de idoso, registro 04) ──
SELECT e2e.c('c02_conta_i', 'C02.04.conta_i', 'C02.10.lancar', 302, 'f5_fat', '/faturamento/contas (Lançar procedimento)',
  'Lança 0802010040 (diária de acompanhante de idoso, especial da AIH) quantidade 2, em nome do médico da internação',
  format($q$SELECT (SELECT x ->> 'origem_id' FROM jsonb_array_elements(public.lancar_procedimento_conta(%L::uuid, '0802010040', 2, %L::uuid, NULL) -> 'itens') x
      WHERE x ->> 'origem' = 'lancamento' LIMIT 1)$q$, e2e.u('c02_conta_i'), e2e.u('c02_med_int')), 'ok', 'c02_lanc');
SELECT e2e.c('c02_lanc', 'C02.10.lancar', 'C02.10.item', 302, 'f5_fat', '/faturamento/contas (conta I)', 'Item lançamento: valor_total = 2 × (SH + SP), retirável, críticas do lançamento',
  format($q$SELECT e2e.c_confere((x ->> 'valor_total')::numeric = 2 * (SELECT coalesce(valor_sh, 0) + coalesce(valor_sp, 0) FROM terminologia.sigtap_procedimento WHERE codigo = '0802010040')
        AND (x ->> 'retiravel')::boolean, 'qt ' || (x ->> 'quantidade') || ' × ' || (x ->> 'valor_unitario') || ' = ' || (x ->> 'valor_total') || ', críticas ' || (x -> 'criticas')::text)
    FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'itens') x WHERE x ->> 'origem_id' = %L$q$, e2e.u('c02_conta_i'), e2e.v('c02_lanc')));
SELECT e2e.c('c02_lanc', 'C02.10.lancar', 'C02.10.evento', 302, 'banco', NULL, 'conta_eventos lancamento e conta_lancamentos com CBO do médico',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM public.conta_eventos WHERE conta_id = %L AND evento = 'lancamento'),
      'lançamento ' || l.procedimento || ' qt ' || l.quantidade || ', CBO ' || coalesce(l.cbo, '-') || ', lançado por ' || right(l.lancado_por::text, 2))
    FROM public.conta_lancamentos l WHERE l.id = %L$q$, e2e.u('c02_conta_i'), e2e.u('c02_lanc')));
SELECT e2e.c('c02_conta_i', 'C02.04.conta_i', 'C02.10.total_depois', 302, 'banco', NULL, 'Total da conta I depois do lançamento (2 itens)',
  format($q$SELECT (public.conta_detalhe(%L::uuid) ->> 'total_referencia')$q$, e2e.u('c02_conta_i')), 'ok', 'c02_total_2');

-- ── 11 e 12. borda (fechar antes da alta), alta, fechar e faturar ───────────
SELECT e2e.c('c02_conta_i', 'C02.04.conta_i', 'C02.12.conferencia', 302, 'f5_fat', '/faturamento/contas (conta I)', 'aberta → em_conferencia',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c02_conta_i'), 'em_conferencia', 'status'));
SELECT e2e.c('c02_conta_i', 'C02.04.conta_i', 'C02.12.fechar_antes_alta', 302, 'f5_fat', '/faturamento/contas (conta I)', 'Fechar antes da alta (deve ser recusado)',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c02_conta_i'), 'fechada', 'status'), 'erro:A internação ainda não teve alta');
SELECT e2e.c('c02_int', 'C02.04.internacao', 'C02.11.impeditivos', 302, 'f5_med_int', '/plantao/internacao (Alta)', 'Impeditivos da alta',
  format('SELECT public.impeditivos_alta(%L::uuid)::text', e2e.u('c02_int')));
SELECT e2e.c('c02_int', 'C02.04.internacao', 'C02.11.alta', 302, 'f5_med_int', '/plantao/internacao (Alta)', 'Alta melhorada com CID J18.9',
  format($q$SELECT public.dar_alta(%L::uuid, 'alta_melhorada', 'J18.9', NULL, NULL, NULL, '{}'::jsonb)::text$q$, e2e.u('c02_int')), 'ok', 'c02_alta');
SELECT e2e.c('c02_alta', 'C02.11.alta', 'C02.12.fechar', 302, 'f5_fat', '/faturamento/contas (conta I)', 'Fechar a conta I (AIH aprovada, sem bloqueante)',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c02_conta_i'), 'fechada', 'status'), 'ok', 'c02_fechada');
SELECT CASE WHEN e2e.v('c02_alta') IS NULL OR e2e.v('c02_fechada') IS NOT NULL THEN 'caminho B não precisou ou bloqueado'
  ELSE e2e.passo('C02.12b.liberar', 302, 'f5_ges_upa', '/faturamento/contas', 'Gestor libera o fechamento da conta I (caminho B)',
         format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo C02: pendência conhecida da rede de teste')::text, 200)$q$, e2e.u('c02_conta_i')))
    || ' / ' || e2e.passo('C02.12b.fechar', 302, 'f5_fat', '/faturamento/contas', 'Faturamento fecha a conta I liberada',
         format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c02_conta_i'), 'fechada', 'status'), 'ok', 'c02_fechada') END;
SELECT e2e.c('c02_fechada', 'C02.12.fechar', 'C02.12.congelado', 302, 'banco', NULL, 'itens_congelados com 2 itens e a mesma soma',
  format($q$SELECT e2e.c_confere(jsonb_array_length(itens_congelados) = 2 AND (SELECT sum((x ->> 'valor_total')::numeric) FROM jsonb_array_elements(itens_congelados) x) = %s::numeric,
      'congelados ' || jsonb_array_length(itens_congelados) || ', soma ' || (SELECT sum((x ->> 'valor_total')::numeric) FROM jsonb_array_elements(itens_congelados) x))
    FROM public.contas WHERE id = %L$q$, coalesce(e2e.v('c02_total_2'), '-1'), e2e.u('c02_conta_i')));
SELECT e2e.c('c02_fechada', 'C02.12.fechar', 'C02.12.faturar', 302, 'f5_fat', '/faturamento/contas (conta I)', 'fechada → faturada',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c02_conta_i'), 'faturada', 'status'), 'ok', 'c02_faturada');
SELECT e2e.c('c02_faturada', 'C02.12.faturar', 'C02.12.erp_v1', 302, 'banco', NULL, 'Versão 1 do ERP: total; dados.conta_origem = número da conta A',
  format($q$SELECT e2e.c_confere(v.versao = 1 AND v.dados ->> 'conta_origem' = (SELECT numero FROM public.contas WHERE id = %L),
      'versão ' || v.versao || ', total ' || v.total || ', conta_origem ' || coalesce(v.dados ->> 'conta_origem', 'nula') || ', gerada ' || v.gerada_em || ', alterada ' || v.alterada_em)
    FROM public.conta_versoes_erp v WHERE v.conta_id = %L ORDER BY v.versao DESC LIMIT 1$q$, e2e.u('c02_conta_a'), e2e.u('c02_conta_i')));
SELECT e2e.c('c02_conta_a', 'C02.01.conta_a', 'C02.12.conta_a_sem_aih', 302, 'f5_fat', '/faturamento/contas', 'A conta A (porta) não traz a AIH: só classificação e consulta',
  format($q$SELECT e2e.c_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'origem' IN ('aih', 'lancamento')), e2e.c_resumo_conta(d))
    FROM (SELECT public.conta_detalhe(%L::uuid) d) z$q$, e2e.u('c02_conta_a')));

-- ── 13 a 17. glosas ─────────────────────────────────────────────────────────
SELECT e2e.c('c02_faturada', 'C02.12.faturar', 'C02.13.glosaveis', 302, 'f5_fat', '/faturamento/glosas (Registrar glosa)', 'Itens glosáveis da conta I com valor sugerido',
  format($q$SELECT string_agg(coalesce(x ->> 'origem', 'conta') || ': ' || (x ->> 'rotulo') || ' = ' || (x ->> 'valor') || ' (' || (x ->> 'competencia') || ')', ' | ')
    FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'glosaveis') x$q$, e2e.u('c02_conta_i')));
SELECT e2e.c('c02_aih_ok', 'C02.09.aprovar', 'C02.13.glosa_aih', 302, 'f5_fat', '/faturamento/glosas', 'Glosa 1 no item da AIH, motivo cid, competência do mês, valor sugerido aceito',
  format($q$SELECT (public.registrar_glosa(%L::uuid, 'aih', %L::uuid, 'cid', 'CID principal questionado pelo auditor (teste C02)', NULL, %L) ->> 'id')$q$,
    e2e.u('c02_conta_i'), e2e.u('c02_aih'), e2e.v('c02_comp')), 'ok', 'c02_g1');
SELECT e2e.c('c02_g1', 'C02.13.glosa_aih', 'C02.13.g1_banco', 302, 'banco', NULL, 'Glosa 1 aberta: valor = valor_sugerido = SH + SP; rótulo; evento registrada; auditoria',
  format($q$SELECT e2e.c_confere(g.status = 'aberta' AND g.valor = g.valor_sugerido AND EXISTS (SELECT 1 FROM public.conta_glosa_eventos WHERE glosa_id = g.id AND evento = 'registrada')
        AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = g.id AND acao = 'glosa_registrada'),
      'valor ' || g.valor || ', sugerido ' || g.valor_sugerido || ', rótulo ' || g.item_rotulo || ', competência ' || g.competencia) FROM public.conta_glosas g WHERE g.id = %L$q$, e2e.u('c02_g1')));
SELECT e2e.c('c02_g1', 'C02.13.glosa_aih', 'C02.13.erp_alterada', 302, 'banco', NULL, 'Gatilho trg_erp_glosa: a versão do ERP marca alterada_em (no mesmo instante da transação)',
  format($q$SELECT e2e.c_confere(v.alterada_em >= v.gerada_em AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_erp_glosa'),
      'gerada ' || v.gerada_em || ', alterada ' || v.alterada_em) FROM public.conta_versoes_erp v WHERE v.conta_id = %L AND v.situacao = 'vigente'$q$, e2e.u('c02_conta_i')));
SELECT e2e.c('c02_g1', 'C02.13.glosa_aih', 'C02.14.recurso_antes', 302, 'f5_fat', '/faturamento/glosas', 'Recurso com competência anterior à da produção (deve ser recusado)',
  format($q$SELECT public.mudar_glosa(%L::uuid, 'em_recurso', 'Recurso com documentação do CID (teste C02)', %L)::text$q$, e2e.u('c02_g1'), e2e.v('c02_comp_menos1')),
  'erro:A competência do recurso não pode ser anterior');
SELECT e2e.c('c02_g1', 'C02.13.glosa_aih', 'C02.14.recurso', 302, 'f5_fat', '/faturamento/glosas', 'Glosa 1 → em recurso, competência do recurso = mês seguinte',
  format($q$SELECT (public.mudar_glosa(%L::uuid, 'em_recurso', 'Recurso com documentação do CID (teste C02)', %L) ->> 'status')$q$, e2e.u('c02_g1'), e2e.v('c02_comp_mais1')));
SELECT e2e.c('c02_g1', 'C02.13.glosa_aih', 'C02.15.recuperado_maior', 302, 'f5_fat', '/faturamento/glosas', 'Valor recuperado maior que o glosado (deve ser recusado)',
  format($q$SELECT public.mudar_glosa(%L::uuid, 'recuperada', 'Recurso aceito pelo gestor do SUS (teste C02)', NULL, %s)::text$q$, e2e.u('c02_g1'),
    (SELECT valor + 1 FROM public.conta_glosas WHERE id = e2e.u('c02_g1'))), 'erro:Valor recuperado entre zero');
SELECT e2e.c('c02_g1', 'C02.13.glosa_aih', 'C02.15.recuperada', 302, 'f5_fat', '/faturamento/glosas', 'Glosa 1 → recuperada, sem digitar valor (o sistema assume o valor glosado)',
  format($q$SELECT (public.mudar_glosa(%L::uuid, 'recuperada', 'Recurso aceito pelo gestor do SUS (teste C02)', NULL, NULL) ->> 'status')$q$, e2e.u('c02_g1')));
SELECT e2e.c('c02_lanc', 'C02.10.lancar', 'C02.16.glosa_lanc', 302, 'f5_fat', '/faturamento/glosas', 'Glosa 2 no lançamento especial, motivo quantidade',
  format($q$SELECT (public.registrar_glosa(%L::uuid, 'lancamento', %L::uuid, 'quantidade', 'Quantidade de diárias questionada (teste C02)', NULL, NULL) ->> 'id')$q$,
    e2e.u('c02_conta_i'), e2e.u('c02_lanc')), 'ok', 'c02_g2');
SELECT e2e.c('c02_g2', 'C02.16.glosa_lanc', 'C02.16.repetida', 302, 'f5_fat', '/faturamento/glosas', 'Registrar de novo no mesmo item (deve ser recusado)',
  format($q$SELECT public.registrar_glosa(%L::uuid, 'lancamento', %L::uuid, 'quantidade', NULL, NULL, NULL)::text$q$, e2e.u('c02_conta_i'), e2e.u('c02_lanc')),
  'erro:Já há glosa em andamento');
SELECT e2e.c('c02_g2', 'C02.16.glosa_lanc', 'C02.17.fat_nao_perde', 302, 'f5_fat', '/faturamento/glosas', 'Faturamento marca perdida (deve ser recusado)',
  format($q$SELECT public.mudar_glosa(%L::uuid, 'perdida', 'Sem documentação para recurso (teste C02)')::text$q$, e2e.u('c02_g2')), 'erro:Só o gestor');
SELECT e2e.c('c02_g2', 'C02.16.glosa_lanc', 'C02.17.perdida', 302, 'f5_ges_upa', '/faturamento/glosas', 'Gestor marca a glosa 2 como perdida',
  format($q$SELECT (public.mudar_glosa(%L::uuid, 'perdida', 'Sem documentação para recurso (teste C02)') ->> 'status')$q$, e2e.u('c02_g2')));

-- ── 18. painel de glosas ────────────────────────────────────────────────────
SELECT e2e.c('c02_g2', 'C02.16.glosa_lanc', 'C02.18.painel_conta', 302, 'f5_fat', '/faturamento/glosas', 'Glosas da conta I no painel: glosado, recuperado, perdido, em andamento',
  format($q$SELECT 'glosado ' || sum((g ->> 'valor')::numeric) || ', recuperado ' || coalesce(sum((g ->> 'valor_recuperado')::numeric), 0)
      || ', perdido ' || coalesce(sum((g ->> 'valor')::numeric) FILTER (WHERE g ->> 'status' = 'perdida'), 0)
      || ', em andamento ' || coalesce(sum((g ->> 'valor')::numeric) FILTER (WHERE g ->> 'status' IN ('aberta', 'em_recurso')), 0)
      || '; ' || string_agg((g ->> 'motivo_codigo') || ' ' || (g ->> 'status') || ' ' || (g ->> 'valor'), '; ')
    FROM jsonb_array_elements(public.glosas_da_unidade(%L::uuid, NULL, NULL) -> 'glosas') g WHERE g ->> 'conta_id' = %L$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c02_conta_i')));
SELECT e2e.passo('C02.18.painel_unidade', 302, 'f5_fat', '/faturamento/glosas', 'Totais da UPA na competência do mês e por motivo',
  format($q$SELECT 'totais ' || (x -> 'totais')::text || '; por motivo ' || (x -> 'por_motivo')::text FROM (SELECT public.glosas_da_unidade(%L::uuid, NULL, %L) x) z$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c02_comp')));
SELECT e2e.c('c02_faturada', 'C02.12.faturar', 'C02.18.conta_segue', 302, 'banco', NULL, 'A conta I continua faturada (a glosa não muda a etapa)',
  format($q$SELECT e2e.c_confere(status = 'faturada', 'status ' || status) FROM public.contas WHERE id = %L$q$, e2e.u('c02_conta_i')));

-- ── lacunas tocadas ─────────────────────────────────────────────────────────
SELECT e2e.lacuna('C02.99.sisaih01', 302, 'f5_fat', 'Exportação da AIH (SISAIH01)', 'Lacuna (MAPA): não existe; conferido aihs e a conta.');
SELECT e2e.lacuna('C02.99.retorno_sih', 302, 'f5_fat', 'Importação do retorno SIA/SIH', 'Lacuna (MAPA): glosa à mão.');
SELECT e2e.lacuna('C02.99.diaria_leito', 302, 'f5_fat', 'Diária de leito, permanência com valor e honorário automáticos', 'Lacuna (MAPA): nada nasce sozinho; a diária de acompanhante só entra lançada à mão pelo faturamento (passo 10).');

SELECT passo, papel, situacao, left(detalhe, 220) AS detalhe FROM e2e.resultados
 WHERE passo LIKE 'C02.%' AND em >= e2e.v('c02_inicio')::timestamptz ORDER BY id;
