-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário C04.
-- Farmácia: validação, alta vigilância, dispensação, estoque e conta sem valor.
-- Especificação: CENARIOS-C-farmacia-custos.md, seção C04.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas
-- (passos 'C04.NN.*', paciente 304). Nada é corrigido no produto.
--
-- Regras do teste: paciente fictícia nova a cada rodada ("Dalva C4
-- Observação", "... B"); a cor é do enfermeiro de teste (amarelo). Os
-- medicamentos vão pelo NOME do catálogo (Dipirona sódica injetável, ampola
-- 2 mL; Enoxaparina sódica, seringa 0,4 mL) e a dose é sempre o texto
-- 'conforme protocolo — dado fictício de teste de fluxo'. Frequências
-- ("Agora", "24/24h", "12/12h") são só do fluxo. Nenhum valor é gravado:
-- medicamento e material entram sem valor. Documento de entrada no estoque:
-- "NF-TESTE-C04-<rodada>" (fictício).
--
-- Mexe no estoque da UPA F5 (Dipirona: +10 de entrada, −2 dispensadas, +1
-- devolvida, −1 avulsa; Enoxaparina: −1 retirada sem farmacêutico) e cria o
-- material "Gaze estéril 7,5 cm (teste C04)" na UPA, se ainda não existir.
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/73_cenario_c04.sql <saida>.sql
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
SELECT e2e.c_guardar('c04_rodada', (coalesce(e2e.v('c04_rodada')::int, 0) + 1)::text);
SELECT e2e.c_guardar('c04_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'c04\_%' AND nome NOT IN ('c04_rodada', 'c04_inicio');
SELECT e2e.c_guardar('c04_nome', 'Dalva C4 Observação' || CASE WHEN e2e.v('c04_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('c04_rodada')::int) ELSE '' END);
SELECT e2e.c_guardar('c04_cns', e2e.c_cns(400 + e2e.v('c04_rodada')::int));
SELECT e2e.c_guardar('c04_cadastro', jsonb_build_object('nome', e2e.v('c04_nome'), 'data_nascimento', '1966-08-10', 'sexo', 'F',
  'raca_cor', 'parda', 'cns', e2e.v('c04_cns'), 'nome_mae', 'Mãe Fictícia do Teste C04', 'endereco', 'Rua do Teste, 404',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.c_guardar('c04_dipirona', '00bc3daf-b7e5-4410-99d4-2c7301dd1922');
SELECT e2e.c_guardar('c04_enoxa', '053c61f1-90f3-40d5-85df-cde00d30c862');
SELECT e2e.c_guardar('c04_doc', 'NF-TESTE-C04-' || e2e.v('c04_rodada'));
SELECT e2e.c_guardar('c04_material_nome', 'Gaze estéril 7,5 cm (teste C04)');
SELECT e2e.c_guardar('c04_saldo_dip_antes', coalesce((SELECT quantidade::text FROM public.estoque_medicamento
  WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND medicamento_id = e2e.u('c04_dipirona')), '0'));
SELECT e2e.c_guardar('c04_saldo_enoxa_antes', coalesce((SELECT quantidade::text FROM public.estoque_medicamento
  WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND medicamento_id = e2e.u('c04_enoxa')), '0'));

-- ── 0. pré-condições ────────────────────────────────────────────────────────
SELECT e2e.passo('C04.00.alta_vigilancia', 304, 'f5_farm', '/alta-vigilancia', 'A enoxaparina é alta vigilância ("exige") na UPA',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.alta_vigilancia_da_unidade(%L::uuid, 'enoxaparina')) x
      WHERE x ->> 'id' = %L AND (x ->> 'exige')::boolean), left(public.alta_vigilancia_da_unidade(%L::uuid, 'enoxaparina')::text, 300))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c04_enoxa'), 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.passo('C04.00.dipirona_comum', 304, 'f5_farm', '/alta-vigilancia', 'A dipirona injetável não é alta vigilância',
  format($q$SELECT e2e.c_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.alta_vigilancia_da_unidade(%L::uuid, 'dipirona')) x
      WHERE x ->> 'id' = %L AND (x ->> 'exige')::boolean), 'dipirona sem exigência')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_dipirona')));
SELECT e2e.c_banco('C04.00.unidade_consumo', 304, 'Unidade de consumo das duas já definida no cadastro (definir_unidade_consumo não precisou)',
  format($q$SELECT e2e.c_confere(bool_and(unidade_consumo IS NOT NULL), string_agg(principio_ativo || ': ' || unidade_consumo, '; '))
    FROM public.medicamento WHERE id IN (%L, %L)$q$, e2e.v('c04_dipirona'), e2e.v('c04_enoxa')));
SELECT e2e.c_banco('C04.00.saldos', 304, 'Saldos antes do cenário (podem ter movimento de outros cenários)',
  format($q$SELECT 'dipirona ' || %L || ', enoxaparina ' || %L$q$, e2e.v('c04_saldo_dip_antes'), e2e.v('c04_saldo_enoxa_antes')));

-- ── 1. porta: ficha, classificação, atendimento, peso ───────────────────────
SELECT e2e.passo('C04.01.ficha', 304, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção cadastra Dalva e abre a ficha no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor lombar intensa', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('c04_cadastro')), 'ok', 'c04_ep');
SELECT e2e.c('c04_ep', 'C04.01.ficha', 'C04.01.paciente', 304, 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('c04_ep')), 'ok', 'c04_pac');
SELECT e2e.c('c04_ep', 'C04.01.ficha', 'C04.01.conta', 304, 'f5_fat', '/faturamento/contas', 'Conta A aberta',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' LIMIT 1), e2e.c_falhar('conta A não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c04_nome')), 'ok', 'c04_conta');
SELECT e2e.c('c04_ep', 'C04.01.ficha', 'C04.01.chamar', 304, 'f5_enf_upa', '/triagem (Fila)', 'Enfermeiro chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('c04_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.c('c04_ep', 'C04.01.ficha', 'C04.01.classificar', 304, 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica amarelo (escolha do enfermeiro de teste), sinais crus, fluxograma "Dor na coluna", discriminador escrito pelo enfermeiro',
  format($q$SELECT public.classificar_risco(%L::uuid, 'amarelo',
    '{"frequencia-cardiaca":96,"frequencia-respiratoria":18,"temperatura":36.7,"saturacao-o2":98,"escala-dor":8,"pressao-arterial-sistolica":146,"pressao-arterial-diastolica":90}'::jsonb,
    %L::uuid, 'Dor lombar intensa, sem déficit motor', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true, NULL, NULL, NULL)::text$q$, e2e.u('c04_ep'),
    '63fce390-91be-4329-9b33-42479636d27e'));
SELECT e2e.c('c04_ep', 'C04.01.ficha', 'C04.01.iniciar', 304, 'f5_med_upa', '/atendimento', 'Plantonista assume',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('c04_ep')));
SELECT e2e.c('c04_pac', 'C04.01.paciente', 'C04.02.sem_peso', 304, 'f5_med_upa', '/atendimento (Prescrição)', 'Prescrever antes do peso (deve ser recusado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('c04_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.v('c04_dipirona'), 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora')), 'erro:Falta para prescrever');
SELECT e2e.c('c04_pac', 'C04.01.paciente', 'C04.01.peso', 304, 'f5_med_upa', '/atendimento (peso)', 'Peso referido pela paciente (valor cru)',
  e2e.c_sinais(e2e.u('c04_pac'), '{"peso":70}', NULL, 'referido'));
SELECT e2e.c('c04_ep', 'C04.01.ficha', 'C04.01.soap', 304, 'f5_med_upa', '/atendimento', 'SOAP com CID de dor lombar (M54.5)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor lombar intensa desde ontem (teste C04)', 'Sem déficit neurológico', 'Lombalgia aguda',
    'Analgesia e anticoagulação profilática conforme a prescrição (teste de fluxo)', 'M54.5')::text$q$, e2e.u('c04_ep')));

-- ── 2. prescrição: item 1 dipirona, item 2 enoxaparina (alta vigilância) ────
SELECT e2e.c('c04_pac', 'C04.01.paciente', 'C04.02.item1', 304, 'f5_med_upa', '/atendimento (Prescrição)', 'Item 1: Dipirona sódica injetável, "Agora"; dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('c04_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.v('c04_dipirona'), 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora')), 'ok', 'c04_item1');
SELECT e2e.c('c04_pac', 'C04.01.paciente', 'C04.02.item2', 304, 'f5_med_upa', '/atendimento (Prescrição)', 'Item 2: Enoxaparina sódica, "24/24h"; dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('c04_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.v('c04_enoxa'), 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'subcutanea', 'posologia', '24/24h')), 'ok', 'c04_item2');
SELECT e2e.c('c04_item2', 'C04.02.item2', 'C04.02.selo', 304, 'banco', NULL, 'O item 2 leva a regra de alta vigilância do cadastro (selo)',
  format($q$SELECT 'regra de alta vigilância do medicamento: ' || coalesce((SELECT alta_vigilancia_regra FROM public.medicamento WHERE id = %L), 'nenhuma')$q$, e2e.v('c04_enoxa')));

-- ── 3 e 4. farmácia: fila e validação do item 1 ─────────────────────────────
SELECT e2e.c('c04_item2', 'C04.02.item2', 'C04.03.fila', 304, 'f5_farm', '/farmacia (fila)', 'Fila de validação: os dois itens; o item 2 com alta_vigilancia = true',
  format($q$SELECT e2e.c_confere(count(*) = 2 AND bool_or(f.item_id = %L::uuid AND f.alta_vigilancia),
      string_agg(f.descricao || ' [alta vigilância ' || f.alta_vigilancia || ', posição ' || f.pos || ']', '; '))
    FROM (SELECT x.*, row_number() OVER () AS pos FROM public.fila_validacao(%L::uuid) x) f WHERE f.item_id IN (%L::uuid, %L::uuid)$q$,
    e2e.v('c04_item2'), 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_item1'), e2e.v('c04_item2')));
SELECT e2e.c('c04_item1', 'C04.02.item1', 'C04.04.enf_nao_valida', 304, 'f5_enf_upa', '/farmacia', 'Enfermeiro tenta validar (deve ser recusado; não há técnico na UPA para esta borda)',
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('c04_item1')), 'erro:A validação é do farmacêutico');
SELECT e2e.c('c04_item1', 'C04.02.item1', 'C04.04.validar1', 304, 'f5_farm', '/farmacia (fila)', 'Farmacêutico valida o item 1 (confere)',
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('c04_item1')));

-- ── 5 e 6. enfermagem: item 2 sem liberação ─────────────────────────────────
SELECT e2e.c('c04_item2', 'C04.02.item2', 'C04.05.sem_motivo', 304, 'f5_enf_upa', '/checagem', 'Checar o item 2 sem liberação e sem motivo (deve ser recusado)',
  format('SELECT public.checar(%L::uuid, %L, NULL, NULL)::text', e2e.u('c04_item2'), 'feito'), 'erro:Alta vigilância sem liberação');
SELECT e2e.c('c04_item2', 'C04.02.item2', 'C04.05.selo_tela', 304, 'f5_enf_upa', '/checagem', 'liberacao_farmacia do item 2: sem liberação',
  format($q$SELECT public.liberacao_farmacia(ARRAY[%L::uuid])::text$q$, e2e.u('c04_item2')));
SELECT e2e.c('c04_item2', 'C04.02.item2', 'C04.06.com_motivo', 304, 'f5_enf_upa', '/checagem', 'Checa o item 2 "feito" com justificativa de 10+ letras',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, 'Dor intensa e farmácia sem resposta no momento (teste C04)')::text$q$, e2e.u('c04_item2')), 'ok', 'c04_adm2');
SELECT e2e.c('c04_adm2', 'C04.06.com_motivo', 'C04.06.marcada', 304, 'banco', NULL, 'administracoes.sem_liberacao = true com o motivo',
  format($q$SELECT e2e.c_confere(sem_liberacao, 'sem_liberacao ' || sem_liberacao || ', motivo ' || coalesce(motivo, '-')) FROM public.administracoes WHERE id = %L$q$, e2e.u('c04_adm2')));
SELECT e2e.c('c04_adm2', 'C04.06.com_motivo', 'C04.06.farm_ve', 304, 'f5_farm', '/alta-vigilancia', 'A administração aparece em administracoes_sem_liberacao para o farmacêutico',
  format($q$SELECT e2e.c_confere(public.administracoes_sem_liberacao(%L::uuid)::text LIKE '%%' || %L || '%%', 'na lista')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_adm2')));

-- ── 7. farmacêutico devolve o item 2 ────────────────────────────────────────
SELECT e2e.c('c04_item2', 'C04.02.item2', 'C04.07.devolver_curto', 304, 'f5_farm', '/farmacia (fila)', 'Devolver com motivo curto (deve ser recusado)',
  format($q$SELECT public.validar_item(%L::uuid, false, 'curto')::text$q$, e2e.u('c04_item2')), 'erro');
SELECT e2e.c('c04_item2', 'C04.02.item2', 'C04.07.devolver', 304, 'f5_farm', '/farmacia (fila)', 'Devolve o item 2 para correção com motivo',
  format($q$SELECT public.validar_item(%L::uuid, false, 'Ajustar o horário da anticoagulação (teste C04)')::text$q$, e2e.u('c04_item2')), 'ok', 'c04_devolvido');
SELECT e2e.c('c04_devolvido', 'C04.07.devolver', 'C04.07.banco', 304, 'banco', NULL, 'validacoes_prescricao devolvido; aviso ao prescritor em notificacoes_plantonista',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM public.validacoes_prescricao WHERE item_id = %1$L AND situacao = 'devolvido'),
      'devolvido; avisos ao prescritor com o item: ' || (SELECT count(*) FROM public.notificacoes_plantonista n WHERE to_jsonb(n)::text LIKE '%%' || %1$L || '%%'))$q$, e2e.v('c04_item2')));
SELECT e2e.c('c04_devolvido', 'C04.07.devolver', 'C04.07.sai_da_lista', 304, 'f5_farm', '/alta-vigilancia', 'A administração do passo 6 sai de administracoes_sem_liberacao (há validação depois dela)',
  format($q$SELECT e2e.c_confere(public.administracoes_sem_liberacao(%L::uuid)::text NOT LIKE '%%' || %L || '%%', 'fora da lista')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_adm2')));

-- ── 8 a 10. alteração = item novo; liberação; checagem liberada ─────────────
SELECT e2e.c('c04_item2', 'C04.02.item2', 'C04.08.alterar', 304, 'f5_med_upa', '/atendimento (Prescrição)', 'Médico altera o item 2 (frequência 12/12h): vira item 2''',
  format($q$SELECT public.alterar_item_prescricao(%L::uuid, '{"posologia":"12/12h"}'::jsonb, 'Ajuste do horário pedido pela farmácia (teste C04)')::text$q$, e2e.u('c04_item2')), 'ok', 'c04_item2b');
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.08.fila', 304, 'f5_farm', '/farmacia (fila)', 'O item 2'' aparece na fila sem validação',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM public.fila_validacao(%L::uuid) f WHERE f.item_id = %L::uuid AND f.ultima_situacao IS NULL), 'item novo na fila')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c04_item2b')));
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.09.validar2b', 304, 'f5_farm', '/farmacia (fila)', 'Farmacêutico valida o item 2'' (confere = liberação da alta vigilância)',
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('c04_item2b')));
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.09.liberado', 304, 'banco', NULL, 'private.liberado_pela_farmacia(item 2'') = true',
  format('SELECT e2e.c_confere(private.liberado_pela_farmacia(%L::uuid), %L)', e2e.u('c04_item2b'), 'liberado'));
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.10.checar', 304, 'f5_enf_upa', '/checagem', 'Enfermeiro checa o item 2'' "feito" sem motivo',
  format('SELECT public.checar(%L::uuid, %L, NULL, NULL)::text', e2e.u('c04_item2b'), 'feito'), 'ok', 'c04_adm2b');
SELECT e2e.c('c04_adm2b', 'C04.10.checar', 'C04.10.sem_liberacao_false', 304, 'banco', NULL, 'sem_liberacao = false',
  format($q$SELECT e2e.c_confere(NOT sem_liberacao, 'sem_liberacao ' || sem_liberacao) FROM public.administracoes WHERE id = %L$q$, e2e.u('c04_adm2b')));
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.10.selo', 304, 'f5_enf_upa', '/checagem', 'A tela mostra "Liberado pela farmácia" (liberacao_farmacia: confere e por)',
  format($q$SELECT public.liberacao_farmacia(ARRAY[%L::uuid])::text$q$, e2e.u('c04_item2b')));
SELECT e2e.c('c04_item2', 'C04.02.item2', 'C04.11.dupla_vazia', 304, 'banco', NULL, 'duplas_checagens fica vazia para os itens do cenário',
  format($q$SELECT e2e.c_confere(NOT EXISTS (SELECT 1 FROM public.duplas_checagens WHERE item_id IN (%L, %L)), 'sem dupla checagem')$q$, e2e.u('c04_item2'), coalesce(e2e.v('c04_item2b'), e2e.v('c04_item2'))));
SELECT e2e.lacuna('C04.11.dupla_checagem', 304, 'f5_enf_upa', 'Dupla checagem com tela', 'Lacuna (MAPA 2.7): conferir_alta_vigilancia, estado_dupla_checagem e duplas_pendentes sem tela; substituídas pela liberação da farmácia.');

-- ── 12 a 15. estoque: entrada, dispensação, devolução, extrato ──────────────
SELECT e2e.passo('C04.12.doc_curto', 304, 'f5_farm', '/farmacia (estoque)', 'Entrada com documento de 2 letras (deve ser recusado)',
  format($q$SELECT public.registrar_entrada_estoque(%L::uuid, %L::uuid, 10, 'NF')::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_dipirona')), 'erro:Informe o documento');
SELECT e2e.passo('C04.12.entrada', 304, 'f5_farm', '/farmacia (estoque)', 'Entrada de 10 ampolas de Dipirona com documento fictício',
  format('SELECT (public.registrar_entrada_estoque(%L::uuid, %L::uuid, 10, %L) ->> %L)', 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_dipirona'), e2e.v('c04_doc'), 'saldo'),
  'ok', 'c04_saldo_entrada');
SELECT e2e.c('c04_saldo_entrada', 'C04.12.entrada', 'C04.12.movimento', 304, 'banco', NULL, 'movimentos_estoque: entrada +10 com documento; auditoria entrada_estoque',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'entrada_estoque' AND entidade_id = %L::uuid AND created_at >= now()),
      (SELECT tipo || ' ' || quantidade || ' → saldo ' || saldo_depois || ', documento ' || coalesce(documento, '-') FROM public.movimentos_estoque
        WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND medicamento_id = %L AND documento = %L ORDER BY em DESC LIMIT 1))$q$,
    e2e.v('c04_dipirona'), e2e.v('c04_dipirona'), e2e.v('c04_doc')));
SELECT e2e.c('c04_item1', 'C04.02.item1', 'C04.13.a_dispensar', 304, 'f5_farm', '/dispensacao', 'itens_para_dispensar traz o item 1 com sugestão e saldo',
  format($q$SELECT coalesce((SELECT left(y::text, 300) FROM jsonb_path_query(public.itens_para_dispensar(%L::uuid, NULL), 'strict $.**') y WHERE jsonb_typeof(y) = 'object' AND y::text LIKE '%%' || %L || '%%' AND NOT y ? 'itens' ORDER BY length(y::text) LIMIT 1),
      e2e.c_falhar('item 1 fora da lista'))$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_item1')));
SELECT e2e.c('c04_item1', 'C04.02.item1', 'C04.13.dispensar', 304, 'f5_farm', '/dispensacao', 'Dispensa 2 ampolas do item 1',
  format('SELECT (public.dispensar_item(%L::uuid, 2, NULL) ->> %L)', e2e.u('c04_item1'), 'id'), 'ok', 'c04_disp1');
SELECT e2e.c('c04_disp1', 'C04.13.dispensar', 'C04.13.banco', 304, 'banco', NULL, 'dispensacoes: prescricao, qt 2, sem_farmaceutico false; movimento saida_prescricao −2 ligado; auditoria dispensar',
  format($q$SELECT e2e.c_confere(d.tipo = 'prescricao' AND d.quantidade = 2 AND NOT d.sem_farmaceutico
        AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'dispensar' AND entidade_id = d.id),
      'tipo ' || d.tipo || ', qt ' || d.quantidade || ', sugestão ' || coalesce(d.sugestao::text, '-') || '; movimento '
      || coalesce((SELECT tipo || ' ' || quantidade || ' → saldo ' || saldo_depois FROM public.movimentos_estoque WHERE dispensacao_id = d.id LIMIT 1), 'NENHUM'))
    FROM public.dispensacoes d WHERE d.id = %L$q$, e2e.u('c04_disp1')));
SELECT e2e.c('c04_disp1', 'C04.13.dispensar', 'C04.14.devolver_demais', 304, 'f5_farm', '/dispensacao', 'Devolver 3 de 2 (deve ser recusado)',
  format($q$SELECT public.devolver_dispensacao(%L::uuid, 3, 'Sobra de ampola devolvida (teste C04)')::text$q$, e2e.u('c04_disp1')), 'erro:Quantidade a devolver entre 1 e 2');
SELECT e2e.c('c04_disp1', 'C04.13.dispensar', 'C04.14.devolver', 304, 'f5_farm', '/dispensacao', 'Recebe a devolução de 1 ampola com motivo',
  format($q$SELECT public.devolver_dispensacao(%L::uuid, 1, 'Sobra de ampola devolvida (teste C04)')::text$q$, e2e.u('c04_disp1')));
SELECT e2e.passo('C04.15.extrato', 304, 'f5_farm', '/farmacia (extrato)', 'Extrato da Dipirona: entrada, saída por prescrição e devolução, com saldo depois',
  format($q$SELECT string_agg(coalesce(x ->> 'tipo', '?') || ' ' || coalesce(x ->> 'quantidade', '?') || ' → ' || coalesce(x ->> 'saldo_depois', '?')
      || coalesce(' (' || (x ->> 'paciente') || ')', ''), '; ') FROM (SELECT y AS x FROM jsonb_path_query(public.extrato_estoque(%L::uuid, %L::uuid, 1), 'strict $.**') y WHERE jsonb_typeof(y) = 'object' AND y ? 'saldo_depois' LIMIT 6) z$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c04_dipirona')));
SELECT e2e.c_banco('C04.15.movimentos', 304, 'movimentos_estoque da Dipirona neste cenário (só inserção)',
  format($q$SELECT string_agg(tipo || ' ' || quantidade || ' → ' || saldo_depois, '; ' ORDER BY em, id) FROM public.movimentos_estoque
    WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND medicamento_id = %L AND em >= now()$q$, e2e.v('c04_dipirona')));
SELECT e2e.passo('C04.15.saldo', 304, 'f5_farm', '/farmacia (estoque)', 'farmacia_estoque: saldo da Dipirona',
  format($q$SELECT 'saldo ' || quantidade || ' (antes do cenário ' || %L || ')' FROM public.farmacia_estoque(%L::uuid) WHERE medicamento_id = %L::uuid$q$,
    e2e.v('c04_saldo_dip_antes'), 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_dipirona')));

-- ── 16 e 17. retirada sem farmacêutico e conferência ────────────────────────
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.16.sem_justificativa', 304, 'f5_enf_upa', '/dispensacao (farmácia fechada)', 'Enfermeiro retira sem justificativa (deve ser recusado)',
  format('SELECT public.dispensar_item(%L::uuid, 1, NULL)::text', e2e.u('c04_item2b')), 'erro:Retirada sem farmacêutico');
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.16.retirar', 304, 'f5_enf_upa', '/dispensacao (farmácia fechada)', 'Enfermeiro retira 1 seringa do item 2'' com justificativa',
  format($q$SELECT public.dispensar_item(%L::uuid, 1, 'Farmácia fechada no horário da dose (teste C04)')::text$q$, e2e.u('c04_item2b')), 'ok', 'c04_disp2_json');
SELECT e2e.c('c04_disp2_json', 'C04.16.retirar', 'C04.16.disp2', 304, 'banco', NULL, 'Dispensação sem_farmaceutico = true; estoque_negativo na resposta',
  format($q$SELECT (%L::jsonb ->> 'id')$q$, e2e.v('c04_disp2_json')), 'ok', 'c04_disp2');
SELECT e2e.c('c04_disp2', 'C04.16.disp2', 'C04.16.lista', 304, 'f5_farm', '/dispensacao', 'dispensacoes_da_unidade: a conferir e estoque negativo da enoxaparina',
  format($q$SELECT 'a_conferir ' || coalesce(x ->> 'a_conferir', '?') || '; estoque_negativo ' || left(coalesce((x -> 'estoque_negativo')::text, '?'), 200)
      || '; esta dispensação listada: ' || (x::text LIKE '%%' || %L || '%%') FROM (SELECT public.dispensacoes_da_unidade(%L::uuid, 24) x) z$q$,
    e2e.v('c04_disp2'), 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.c('c04_disp2', 'C04.16.disp2', 'C04.17.conferir', 304, 'f5_farm', '/dispensacao', 'Farmacêutico confere a retirada sem farmacêutico',
  format('SELECT public.conferir_dispensacao(%L::uuid)::text', e2e.u('c04_disp2')));
SELECT e2e.c('c04_disp2', 'C04.16.disp2', 'C04.17.de_novo', 304, 'f5_farm', '/dispensacao', 'Conferir de novo (deve ser recusado)',
  format('SELECT public.conferir_dispensacao(%L::uuid)::text', e2e.u('c04_disp2')), 'erro:Já conferida');
SELECT e2e.c('c04_disp2', 'C04.16.disp2', 'C04.17.banco', 304, 'banco', NULL, 'conferida_em e conferida_por = farmacêutico',
  format($q$SELECT e2e.c_confere(conferida_em IS NOT NULL AND conferida_por = 'f5200000-0000-4000-8000-000000000014', 'conferida por ' || coalesce(right(conferida_por::text, 2), '-'))
    FROM public.dispensacoes WHERE id = %L$q$, e2e.u('c04_disp2')));

-- ── bordas da farmácia ──────────────────────────────────────────────────────
SELECT e2e.passo('C04.98.avulso_enf', 304, 'f5_enf_upa', '/dispensacao', 'Dispensação avulsa pelo enfermeiro (deve ser recusado)',
  format($q$SELECT public.dispensar_avulso(%L::uuid, %L::uuid, 1, 'Sala de sutura', 'Reposição do carrinho (teste C04)')::text$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c04_dipirona')), 'erro');
SELECT e2e.passo('C04.98.avulso', 304, 'f5_farm', '/dispensacao', 'Dispensação avulsa pelo farmacêutico (destino e motivo): saida_avulsa',
  format($q$SELECT public.dispensar_avulso(%L::uuid, %L::uuid, 1, 'Sala de sutura', 'Reposição do carrinho (teste C04)')::text$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c04_dipirona')));
SELECT e2e.passo('C04.98.ajuste_igual', 304, 'f5_farm', '/farmacia (estoque)', 'Ajuste de inventário com o saldo atual (deve ser recusado: nada a ajustar)',
  format($q$SELECT public.ajustar_estoque(%L::uuid, %L::uuid, %s, 'Inventário de conferência (teste C04)')::text$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c04_dipirona'),
    coalesce((SELECT quantidade::text FROM public.estoque_medicamento WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND medicamento_id = e2e.u('c04_dipirona')), '0')), 'erro');
SELECT e2e.passo('C04.98.ajuste_motivo', 304, 'f5_farm', '/farmacia (estoque)', 'Ajuste com motivo curto (deve ser recusado)',
  format($q$SELECT public.ajustar_estoque(%L::uuid, %L::uuid, 50, 'curto')::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_dipirona')), 'erro');

-- ── 18. checagem do item 1 ──────────────────────────────────────────────────
SELECT e2e.c('c04_item1', 'C04.02.item1', 'C04.18.checar1', 304, 'f5_enf_upa', '/checagem', 'Enfermeiro checa o item 1 "feito"',
  format('SELECT public.checar(%L::uuid, %L, NULL, NULL)::text', e2e.u('c04_item1'), 'feito'), 'ok', 'c04_adm1');

-- ── 19 e 20. material ───────────────────────────────────────────────────────
SELECT CASE WHEN EXISTS (SELECT 1 FROM public.materiais_unidade WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND ativo AND nome = e2e.v('c04_material_nome'))
  THEN e2e.c_banco('C04.19.material', 304, 'Material já cadastrado numa rodada anterior: reaproveitado',
         format($q$SELECT id::text FROM public.materiais_unidade WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND ativo AND nome = %L LIMIT 1$q$, e2e.v('c04_material_nome')), 'c04_material')
  ELSE e2e.passo('C04.19.material', 304, 'f5_fat', '/faturamento/materiais', 'Faturamento cadastra "Gaze estéril 7,5 cm (teste C04)", unidade de consumo pacote, sem SIGTAP',
         format($q$SELECT public.material_salvar(%L::uuid, NULL, %L, 'pacote', NULL, true)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('c04_material_nome')), 'ok', 'c04_material') END;
SELECT e2e.c('c04_material', 'C04.19.material', 'C04.20.lancar_errado', 304, 'f5_fat', '/faturamento/contas (Lançar material)', 'Lança 1 pacote por engano (para provar a retirada)',
  format($q$SELECT public.conta_lancar_material(%L::uuid, %L::uuid, 1, 'lançado por engano (teste C04)')::text$q$, e2e.u('c04_conta'), e2e.u('c04_material')));
SELECT e2e.c('c04_material', 'C04.19.material', 'C04.20.id_errado', 304, 'banco', NULL, 'Lançamento a retirar',
  format($q$SELECT id::text FROM public.conta_materiais WHERE conta_id = %L AND retirado_em IS NULL AND quantidade = 1 ORDER BY id DESC LIMIT 1$q$, e2e.u('c04_conta')), 'ok', 'c04_mat_errado');
SELECT e2e.c('c04_mat_errado', 'C04.20.id_errado', 'C04.20.retirar', 304, 'f5_fat', '/faturamento/contas', 'Retira o lançamento com motivo',
  format($q$SELECT left(public.conta_retirar_material(%L::uuid, 'Lançado por engano no teste C04')::text, 100)$q$, e2e.u('c04_mat_errado')));
SELECT e2e.c('c04_material', 'C04.19.material', 'C04.20.lancar', 304, 'f5_fat', '/faturamento/contas (Lançar material)', 'Lança 3 pacotes, observação "curativo"',
  format($q$SELECT left(public.conta_lancar_material(%L::uuid, %L::uuid, 3, 'curativo')::text, 100)$q$, e2e.u('c04_conta'), e2e.u('c04_material')));
SELECT e2e.c('c04_material', 'C04.19.material', 'C04.20.eventos', 304, 'banco', NULL, 'conta_eventos material_lancado (2) e material_retirado (1); retirado_em gravado',
  format($q$SELECT e2e.c_confere((SELECT count(*) FROM public.conta_eventos WHERE conta_id = %1$L AND evento = 'material_lancado') = 2
        AND (SELECT count(*) FROM public.conta_eventos WHERE conta_id = %1$L AND evento = 'material_retirado') = 1,
      'lançados ' || (SELECT count(*) FROM public.conta_eventos WHERE conta_id = %1$L AND evento = 'material_lancado')
      || ', retirados ' || (SELECT count(*) FROM public.conta_eventos WHERE conta_id = %1$L AND evento = 'material_retirado'))$q$, e2e.u('c04_conta')));

-- ── 21 e 22. a conta: medicamentos e materiais sem valor ────────────────────
SELECT e2e.c('c04_conta', 'C04.01.conta', 'C04.21.medicamentos', 304, 'f5_fat', '/faturamento/contas (detalhe)', 'Medicamentos da conta: dispensado, devolvido, líquido, administrado; nenhum campo de valor',
  format($q$SELECT e2e.c_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m) x WHERE x ? 'valor' OR x ? 'valor_total' OR x ? 'valor_unitario'),
      (SELECT string_agg(left(x ->> 'medicamento', 30) || ': disp ' || (x ->> 'dispensado') || ', dev ' || (x ->> 'devolvido') || ', líq ' || (x ->> 'liquido')
         || ', adm ' || (x ->> 'administrado') || ', sem_farm ' || (x ->> 'sem_farmaceutico') || coalesce(', aviso: ' || (x ->> 'aviso'), ''), ' | ') FROM jsonb_array_elements(m) x))
    FROM (SELECT public.conta_detalhe(%L::uuid) -> 'medicamentos' m) z$q$, e2e.u('c04_conta')));
SELECT e2e.c('c04_conta', 'C04.01.conta', 'C04.21.materiais', 304, 'f5_fat', '/faturamento/contas (detalhe)', 'Materiais da conta: 3 pacotes ativos, sem valor',
  format($q$SELECT e2e.c_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m) x WHERE x ? 'valor' OR x ? 'valor_total'),
      (SELECT string_agg((x ->> 'material') || ' ' || (x ->> 'quantidade') || ' ' || coalesce(x ->> 'unidade_consumo', '') || CASE WHEN x ->> 'retirado_em' IS NOT NULL THEN ' (retirado)' ELSE '' END, '; ') FROM jsonb_array_elements(m) x))
    FROM (SELECT public.conta_detalhe(%L::uuid) -> 'materiais' m) z$q$, e2e.u('c04_conta')));
SELECT e2e.c('c04_conta', 'C04.01.conta', 'C04.21.total', 304, 'f5_fat', '/faturamento/contas (detalhe)', 'total_referencia só com os procedimentos (classificação, consulta, medicação)',
  format($q$SELECT e2e.c_resumo_conta(public.conta_detalhe(%L::uuid))$q$, e2e.u('c04_conta')));
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.22.fora', 304, 'f5_fat', '/faturamento/contas', 'Marca a enoxaparina (item 2'') fora da conta com motivo',
  format($q$SELECT left(public.medicamento_fora_da_conta(%L::uuid, %L::uuid, true, 'Medicamento de outro protocolo (teste C04)')::text, 80)$q$, e2e.u('c04_conta'), e2e.u('c04_item2b')));
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.22.volta', 304, 'f5_fat', '/faturamento/contas', 'Traz a enoxaparina de volta com motivo',
  format($q$SELECT left(public.medicamento_fora_da_conta(%L::uuid, %L::uuid, false, 'Conferido: fica na conta (teste C04)')::text, 80)$q$, e2e.u('c04_conta'), e2e.u('c04_item2b')));
SELECT e2e.c('c04_item2b', 'C04.08.alterar', 'C04.22.eventos', 304, 'banco', NULL, 'Eventos medicamento_fora e medicamento_volta; voltou_em gravado',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM public.conta_eventos WHERE conta_id = %1$L AND evento = 'medicamento_fora')
        AND EXISTS (SELECT 1 FROM public.conta_eventos WHERE conta_id = %1$L AND evento = 'medicamento_volta')
        AND EXISTS (SELECT 1 FROM public.conta_medicamentos_fora WHERE conta_id = %1$L AND voltou_em IS NOT NULL), 'fora e volta')$q$, e2e.u('c04_conta')));

-- ── 23 e 24. alta e fechamento ──────────────────────────────────────────────
SELECT e2e.c('c04_ep', 'C04.01.ficha', 'C04.23.alta', 304, 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho alta após medicação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta_apos_medicacao', NULL, '{}'::jsonb)::text$q$, e2e.u('c04_ep')), 'ok', 'c04_alta');
SELECT e2e.c('c04_conta', 'C04.01.conta', 'C04.24.conferencia', 304, 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c04_conta'), 'em_conferencia', 'status'));
SELECT e2e.c('c04_conta', 'C04.01.conta', 'C04.24.pendencias', 304, 'f5_fat', '/faturamento/contas', 'Pendências: avisos de medicamento e de material sem SIGTAP, nenhum bloqueante',
  format($q$SELECT coalesce((SELECT string_agg((p ->> 'grupo') || '/' || (p ->> 'codigo') || CASE WHEN (p ->> 'bloqueante')::boolean THEN ' (BLOQ)' ELSE '' END
      || ': ' || left(p ->> 'texto', 70), ' | ') FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'pendencias') p), 'nenhuma')$q$, e2e.u('c04_conta')));
SELECT e2e.c('c04_alta', 'C04.23.alta', 'C04.24.fechar', 304, 'f5_fat', '/faturamento/contas', 'Fecha (avisos não bloqueiam)',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c04_conta'), 'fechada', 'status'), 'ok', 'c04_fechada');
SELECT e2e.c('c04_fechada', 'C04.24.fechar', 'C04.24.faturar', 304, 'f5_fat', '/faturamento/contas', 'fechada → faturada',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c04_conta'), 'faturada', 'status'), 'ok', 'c04_faturada');
SELECT e2e.c('c04_fechada', 'C04.24.fechar', 'C04.24.congelados', 304, 'banco', NULL, 'medicamentos_congelados e materiais_congelados gravados; ERP com medicamentos sem valor',
  format($q$SELECT e2e.c_confere(c.medicamentos_congelados IS NOT NULL AND c.materiais_congelados IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.conta_versoes_erp v, jsonb_array_elements(v.dados -> 'medicamentos') m WHERE v.conta_id = c.id AND (m ? 'valor' OR m ? 'valor_total')),
      'medicamentos congelados ' || jsonb_array_length(c.medicamentos_congelados) || ', materiais congelados ' || jsonb_array_length(c.materiais_congelados)
      || '; ERP v1 total ' || coalesce((SELECT total::text FROM public.conta_versoes_erp WHERE conta_id = c.id AND versao = 1), '-')
      || ', medicamentos no ERP ' || coalesce((SELECT (dados -> 'medicamentos')::text FROM public.conta_versoes_erp WHERE conta_id = c.id AND versao = 1), '-'))
    FROM public.contas c WHERE c.id = %L$q$, e2e.u('c04_conta')));

-- ── lacunas ─────────────────────────────────────────────────────────────────
SELECT e2e.lacuna('C04.99.lote_validade_preco', 304, 'f5_farm', 'Lote, validade, preço e custo do medicamento; estoque de materiais e OPME', 'Lacuna (MAPA): movimentos_estoque só com quantidade.');
SELECT e2e.lacuna('C04.99.valor_conta', 304, 'f5_fat', 'Valor de medicamento, material e exame na conta (CMED fora)', 'Lacuna (MAPA): conferido que os campos de valor não existem (C04.21 e C04.24).');
SELECT e2e.lacuna('C04.99.tecnico', 304, 'f5_tec_upa', 'Técnico da UPA validando item', 'Ambiente: há técnico da UPA desde o 46, mas está escalado na Observação Adulto; a borda foi provada com o enfermeiro (C04.04.enf_nao_valida).');

SELECT passo, papel, situacao, left(detalhe, 220) AS detalhe FROM e2e.resultados
 WHERE passo LIKE 'C04.%' AND em >= e2e.v('c04_inicio')::timestamptz ORDER BY id;
