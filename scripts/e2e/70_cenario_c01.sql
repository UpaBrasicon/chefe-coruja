-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário C01.
-- Conta de porta com BPA-I e BPA-C e fechamento da competência.
-- Especificação: CENARIOS-C-farmacia-custos.md, seção C01.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas; o
-- resultado fica em e2e.resultados (passos 'C01.NN.*', paciente 301). Nada é
-- corrigido no produto. Passo negativo espera 'erro'; o que o produto não tem
-- vira e2e.lacuna; o que dependia de passo recusado vira lacuna "bloqueado".
--
-- Regras do teste:
--   • paciente fictício novo a cada rodada ("Antônio C1 Corte na Mão", "... B"),
--     CNS gerado por e2e.c_cns (dígito verificador válido, começa com 7);
--   • prescrição SEM dose de memória: a dose é o texto
--     'conforme protocolo — dado fictício de teste de fluxo';
--   • a cor da classificação é a escolha do enfermeiro de teste (verde);
--   • valores: nenhum é gravado; o sistema calcula pelo SIGTAP carregado.
--
-- Muda configuração da UPA F5 (pelas RPCs do faturamento, como a tela):
--   • cabeçalho do BPA (definir_bpa_config), só se a UPA ainda não tiver;
--   • código 0401010058 (sutura) na lista da unidade (associar_procedimento_bpa);
--   • "sempre BPA-C" na medicação durante o cenário; o passo C01.17 desmarca;
--   • fecha e reabre a competência do mês (fica 'reaberta', não trava os outros).
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/70_cenario_c01.sql <saida>.sql
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

-- ── rodada: nome e CNS do paciente ──────────────────────────────────────────
SELECT e2e.c_guardar('c01_rodada', (coalesce(e2e.v('c01_rodada')::int, 0) + 1)::text);
SELECT e2e.c_guardar('c01_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'c01\_%' AND nome NOT IN ('c01_rodada', 'c01_inicio');
SELECT e2e.c_guardar('c01_nome', 'Antônio C1 Corte na Mão' || CASE WHEN e2e.v('c01_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('c01_rodada')::int) ELSE '' END);
SELECT e2e.c_guardar('c01_cns', e2e.c_cns(100 + e2e.v('c01_rodada')::int));
SELECT e2e.c_guardar('c01_comp', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'));
SELECT e2e.c_guardar('c01_cadastro', jsonb_build_object('nome', e2e.v('c01_nome'), 'data_nascimento', '1984-03-15', 'sexo', 'M',
  'raca_cor', 'parda', 'cns', e2e.v('c01_cns'), 'nome_mae', 'Mãe Fictícia do Teste C01', 'endereco', 'Rua do Teste, 101',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.c_guardar('c01_med', 'f5200000-0000-4000-8000-000000000008');   -- medico.upa.f5 (quem fez a sutura)

-- ── 0. pré-condições (faturamento, pelas RPCs de /faturamento) ──────────────
SELECT CASE WHEN EXISTS (SELECT 1 FROM public.bpa_config_unidade WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND orgao_origem IS NOT NULL
                          AND sigla IS NOT NULL AND cnpj IS NOT NULL AND orgao_destino IS NOT NULL AND destino IS NOT NULL)
  THEN e2e.lacuna('C01.00.cabecalho', 301, 'f5_fat', 'Cabeçalho do BPA da UPA', 'não precisou: a UPA já tem o cabeçalho completo')
  ELSE e2e.passo('C01.00.cabecalho', 301, 'f5_fat', '/faturamento (BPA, cabeçalho)', 'Faturamento preenche o cabeçalho do BPA (valores fictícios de teste)',
    format($q$SELECT public.definir_bpa_config(%L::uuid, %L::jsonb)::text$q$, 'f5100000-0000-4000-8000-000000000002',
      '{"orgao_origem":"Secretaria de Saúde F5 (teste)","sigla":"SMSF5","cnpj":"99999999000199","orgao_destino":"Secretaria de Saúde F5 (teste)","destino":"M"}')) END;
SELECT e2e.passo('C01.00.lista_sutura', 301, 'f5_fat', '/faturamento (BPA, lista)', 'Faturamento põe 0401010058 (excisão e/ou sutura de ferimento, registro 02) na lista da UPA',
  format('SELECT public.associar_procedimento_bpa(%L::uuid, %L, %L)::text', 'f5100000-0000-4000-8000-000000000002', '0401010058', 'lista'));
SELECT e2e.c_banco('C01.00.associacoes', 301, 'Códigos vigentes da UPA por fonte (classificação, consulta, medicação, lista)',
  $q$SELECT string_agg(uso || ' ' || procedimento || CASE WHEN sempre_bpa_c THEN ' (sempre BPA-C)' ELSE '' END, '; ' ORDER BY uso)
       FROM public.bpa_procedimentos_unidade WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND vigente_ate IS NULL$q$);
SELECT e2e.c_banco('C01.00.id_medicacao', 301, 'Associação vigente da medicação (a tela lista; o id vai para marcar "sempre BPA-C")',
  $q$SELECT id::text FROM public.bpa_procedimentos_unidade WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND uso = 'medicacao' AND vigente_ate IS NULL LIMIT 1$q$,
  'c01_assoc_med');
SELECT e2e.c('c01_assoc_med', 'C01.00.id_medicacao', 'C01.00.sempre_bpa_c', 301, 'f5_fat', '/faturamento (BPA, lista)', 'Faturamento marca a medicação 0301100012 como "sempre BPA-C" (só durante o cenário)',
  format('SELECT public.marcar_sempre_bpa_c(%L::uuid, true)::text', e2e.u('c01_assoc_med')));
SELECT e2e.c_banco('C01.00.cnes', 301, 'CNES da UPA já é 9995028 (definir_cnes_unidade não precisou)',
  $q$SELECT e2e.c_confere(cnes = '9995028', 'CNES ' || coalesce(cnes, 'nulo')) FROM public.unidades WHERE id = 'f5100000-0000-4000-8000-000000000002'$q$);
SELECT e2e.c_banco('C01.00.perfis', 301, 'Médico e enfermeiro da UPA com CNS válido e CBO (pré-condição 4)',
  $q$SELECT e2e.c_confere(bool_and(private.cns_valido(cns) AND cbo IS NOT NULL), string_agg(right(id::text, 2) || ' CBO ' || coalesce(cbo, '-'), ', '))
       FROM public.perfis WHERE id IN ('f5200000-0000-4000-8000-000000000007', 'f5200000-0000-4000-8000-000000000008')$q$);

-- ── 1. recepção: ficha e conta ──────────────────────────────────────────────
SELECT e2e.passo('C01.01.ficha', 301, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção cadastra Antônio (sexo, nascimento, raça/cor, CNS) e abre a ficha no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Corte na palma da mão com faca de cozinha', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('c01_cadastro')), 'ok', 'c01_ep');
SELECT e2e.c('c01_ep', 'C01.01.ficha', 'C01.01.paciente', 301, 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('c01_ep')), 'ok', 'c01_pac');
SELECT e2e.c('c01_ep', 'C01.01.ficha', 'C01.01.conta', 301, 'f5_fat', '/faturamento/contas', 'A conta ambulatorial nasce com a ficha: aberta, nº A-AAAA.nnnnnn, pagador sus, sem itens e total 0',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' AND c ->> 'status' = 'aberta'
        AND jsonb_array_length(public.conta_detalhe((c ->> 'id')::uuid) -> 'itens') = 0
        AND (public.conta_detalhe((c ->> 'id')::uuid) ->> 'total_referencia')::numeric = 0 LIMIT 1), e2e.c_falhar('conta aberta sem itens não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('c01_nome')), 'ok', 'c01_conta');
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.01.conta_banco', 301, 'banco', NULL, 'Conta ligada ao episódio, número e pagador',
  format($q$SELECT e2e.c_confere(c.episodio_id = %L AND c.numero ~ '^A-[0-9]{4}\.[0-9]{6}$' AND c.pagador = 'sus',
      'nº ' || c.numero || ', pagador ' || c.pagador || ', status ' || c.status) FROM public.contas c WHERE c.id = %L$q$, e2e.u('c01_ep'), e2e.u('c01_conta')));
SELECT e2e.passo('C01.01.recepcao_sem_contas', 301, 'f5_rec_upa', '/faturamento', 'Recepção não lê as contas (deve ser recusado)',
  format('SELECT public.contas_da_unidade(%L::uuid, NULL, NULL)::text', 'f5100000-0000-4000-8000-000000000002'), 'erro:Acesso negado');

-- ── 2. triagem: classificação (cor do enfermeiro de teste) ──────────────────
SELECT e2e.c('c01_ep', 'C01.01.ficha', 'C01.02.chamar', 301, 'f5_enf_upa', '/triagem (Fila)', 'Enfermeiro chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('c01_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.c('c01_ep', 'C01.01.ficha', 'C01.02.classificar', 301, 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica verde (escolha do enfermeiro de teste), sinais crus, fluxograma adulto "Alterações cutâneas", discriminador escrito pelo enfermeiro',
  format($q$SELECT public.classificar_risco(%L::uuid, 'verde',
    '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":5,"pressao-arterial-sistolica":128,"pressao-arterial-diastolica":82}'::jsonb,
    %L::uuid, 'Ferimento cortante pequeno na mão, sangramento controlado', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true, NULL, NULL, NULL)::text$q$, e2e.u('c01_ep'),
    'a2b48dca-f46e-4296-b73c-7f5cb253e30e'), 'ok', 'c01_class');
SELECT e2e.c('c01_class', 'C01.02.classificar', 'C01.02.cor', 301, 'banco', NULL, 'A cor gravada é a do enfermeiro',
  format($q$SELECT e2e.c_confere(cor = 'verde', 'cor ' || cor || ', discriminador ' || coalesce(discriminador, '?')) FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('c01_class')));
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.02.item_classificacao', 301, 'f5_fat', '/faturamento/contas', 'Item "acolhimento com classificação" (0301060118) nasce na conta no momento da classificação',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'origem' = 'classificacao' AND x ->> 'procedimento' = '0301060118'),
      e2e.c_resumo_conta(d)) FROM (SELECT public.conta_detalhe(%L::uuid) d) z$q$, e2e.u('c01_conta')));

-- ── 3 e 4. médico: assume, peso referido, SOAP com CID ──────────────────────
SELECT e2e.c('c01_ep', 'C01.01.ficha', 'C01.03.iniciar', 301, 'f5_med_upa', '/atendimento', 'Plantonista assume o paciente',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('c01_ep')));
SELECT e2e.c('c01_ep', 'C01.01.ficha', 'C01.03.atendimento_medico', 301, 'banco', NULL, 'episodios.atendimento_medico_id preenchido com o login do médico',
  format($q$SELECT e2e.c_confere(atendimento_medico_id = 'f5200000-0000-4000-8000-000000000008', 'médico ' || coalesce(right(atendimento_medico_id::text, 2), 'nulo'))
    FROM public.episodios WHERE id = %L$q$, e2e.u('c01_ep')));
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.03.item_consulta', 301, 'f5_fat', '/faturamento/contas', 'Item "consulta médica" (0301060096) nasce na conta quando o médico assume',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'origem' = 'atendimento' AND x ->> 'procedimento' = '0301060096'),
      e2e.c_resumo_conta(d)) FROM (SELECT public.conta_detalhe(%L::uuid) d) z$q$, e2e.u('c01_conta')));
SELECT e2e.c('c01_pac', 'C01.01.paciente', 'C01.04.peso', 301, 'f5_med_upa', '/atendimento (Prescrição → peso)', 'Médico registra o peso referido pelo paciente (valor cru)',
  e2e.c_sinais(e2e.u('c01_pac'), '{"peso":80}', NULL, 'referido'));
SELECT e2e.c('c01_ep', 'C01.01.ficha', 'C01.04.soap', 301, 'f5_med_upa', '/atendimento (Atendimento)', 'SOAP com CID de ferimento da mão (S61.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Corte na palma da mão direita com faca de cozinha há 1 hora (teste C01)', 'Ferimento linear na palma da mão, sangramento controlado',
    'Ferimento da mão', 'Sutura, curativo e analgesia conforme a prescrição (teste de fluxo)', 'S61.9')::text$q$, e2e.u('c01_ep')));

-- ── 5 e 6. prescrição (dose: texto de teste) e checagem ─────────────────────
SELECT e2e.c('c01_pac', 'C01.01.paciente', 'C01.05.prescrever', 301, 'f5_med_upa', '/atendimento (Prescrição)', 'Dipirona sódica injetável, "Agora"; dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('c01_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '00bc3daf-b7e5-4410-99d4-2c7301dd1922', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora')), 'ok', 'c01_item');
SELECT e2e.c_guardar('c01_hora', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));
SELECT e2e.c('c01_item', 'C01.05.prescrever', 'C01.06.aprazar', 301, 'f5_enf_upa', '/checagem', 'Enfermeiro apraza a dose "Agora" para o horário atual',
  format('SELECT public.aprazar(%L::uuid, %L::text[], NULL)::text', e2e.u('c01_item'), ARRAY[e2e.v('c01_hora')]));
SELECT e2e.c('c01_item', 'C01.05.prescrever', 'C01.06.checar', 301, 'f5_enf_upa', '/checagem', 'Checa "feito" no horário',
  format('SELECT public.checar(%L::uuid, %L, %L, NULL)::text', e2e.u('c01_item'), 'feito', e2e.v('c01_hora')), 'ok', 'c01_adm');
SELECT e2e.c('c01_adm', 'C01.06.checar', 'C01.06.administracao', 301, 'banco', NULL, 'administracoes.situacao = feito, autor = login do enfermeiro',
  format($q$SELECT e2e.c_confere(situacao = 'feito' AND registrado_por = 'f5200000-0000-4000-8000-000000000007', 'situação ' || situacao || ', por ' || right(registrado_por::text, 2))
    FROM public.administracoes WHERE id = %L$q$, e2e.u('c01_adm')));
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.06.item_medicacao', 301, 'f5_fat', '/faturamento/contas', 'Item "administração de medicamentos" (0301100012) nasce na checagem, destino BPA-C',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'origem' = 'medicacao' AND x ->> 'procedimento' = '0301100012'),
      e2e.c_resumo_conta(d)) FROM (SELECT public.conta_detalhe(%L::uuid) d) z$q$, e2e.u('c01_conta')));

-- ── 7. faturamento lança a sutura em nome do médico ─────────────────────────
SELECT e2e.c('c01_pac', 'C01.01.paciente', 'C01.07.fora_da_lista', 301, 'f5_fat', '/faturamento/contas (Lançar procedimento)', 'Código fora da lista da unidade (0301100284, curativo simples) é recusado',
  format('SELECT public.registrar_procedimento(%L::uuid, %L, 1, %L::uuid, NULL, %L::uuid)::text', e2e.u('c01_pac'), '0301100284', e2e.u('c01_ep'), e2e.u('c01_med')),
  'erro:Procedimento fora da lista da unidade');
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.07.sutura', 301, 'f5_fat', '/faturamento/contas (Lançar procedimento)', 'Lança 0401010058 em nome do médico (quem fez), quantidade 1',
  format($q$SELECT (SELECT x ->> 'origem_id' FROM jsonb_array_elements(public.lancar_procedimento_conta(%L::uuid, '0401010058', 1, %L::uuid, NULL) -> 'itens') x
      WHERE x ->> 'origem' = 'registro' LIMIT 1)$q$, e2e.u('c01_conta'), e2e.u('c01_med')), 'ok', 'c01_reg');
SELECT e2e.c('c01_reg', 'C01.07.sutura', 'C01.07.registro', 301, 'banco', NULL, 'procedimentos_realizados: via faturamento, profissional = médico, registrado_por = faturamento',
  format($q$SELECT e2e.c_confere(via = 'faturamento' AND profissional_id = 'f5200000-0000-4000-8000-000000000008' AND registrado_por = 'f5200000-0000-4000-8000-000000000010',
      'via ' || via || ', profissional ' || right(profissional_id::text, 2) || ', registrado por ' || right(registrado_por::text, 2) || ', CBO ' || coalesce(cbo, '-'))
    FROM public.procedimentos_realizados WHERE id = %L$q$, e2e.u('c01_reg')));
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.07.retiravel', 301, 'f5_fat', '/faturamento/contas', 'Item da sutura com origem registro e retiravel = true',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'itens') x
      WHERE x ->> 'origem' = 'registro' AND (x ->> 'retiravel')::boolean), 'registro retirável')$q$, e2e.u('c01_conta')));

-- ── 8. desfecho alta ────────────────────────────────────────────────────────
SELECT e2e.c('c01_ep', 'C01.01.ficha', 'C01.08.desfecho', 301, 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho alta (CID do SOAP)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{}'::jsonb)::text$q$, e2e.u('c01_ep')), 'ok', 'c01_alta');
SELECT e2e.c('c01_alta', 'C01.08.desfecho', 'C01.08.encerrado', 301, 'banco', NULL, 'Episódio encerrado com desfecho_em',
  format($q$SELECT e2e.c_confere(etapa = 'encerrado' AND desfecho_em IS NOT NULL, 'etapa ' || etapa || ', desfecho ' || coalesce(desfecho, '?')) FROM public.episodios WHERE id = %L$q$, e2e.u('c01_ep')));

-- ── 9. detalhe da conta: 4 itens, total e pendências ────────────────────────
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.09.detalhe', 301, 'f5_fat', '/faturamento/contas (detalhe)', 'Conta com os itens, o total de referência e as pendências',
  format($q$SELECT e2e.c_resumo_conta(public.conta_detalhe(%L::uuid))$q$, e2e.u('c01_conta')));
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.09.soma', 301, 'f5_fat', '/faturamento/contas (detalhe)', 'total_referencia = Σ itens[].valor_total; 4 itens; medicamento fora da soma',
  format($q$SELECT e2e.c_confere(jsonb_array_length(d -> 'itens') = 4
        AND (d ->> 'total_referencia')::numeric = (SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(d -> 'itens') x),
      'itens ' || jsonb_array_length(d -> 'itens') || ', total ' || (d ->> 'total_referencia'))
    FROM (SELECT public.conta_detalhe(%L::uuid) d) z$q$, e2e.u('c01_conta')));
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.09.total', 301, 'banco', NULL, 'Total de referência antes de fechar (guardado para a conferência)',
  format($q$SELECT (public.conta_detalhe(%L::uuid) ->> 'total_referencia')$q$, e2e.u('c01_conta')), 'ok', 'c01_total_antes');
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.09.pendencias', 301, 'f5_fat', '/faturamento/contas (detalhe)', 'Painel de pendências por grupo',
  format($q$SELECT coalesce((SELECT string_agg((p ->> 'grupo') || '/' || (p ->> 'codigo') || CASE WHEN (p ->> 'bloqueante')::boolean THEN ' (BLOQUEANTE)' ELSE '' END
      || ': ' || left(p ->> 'texto', 70), ' | ') FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'pendencias') p), 'nenhuma pendência')$q$, e2e.u('c01_conta')));
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.09.medicamento_sem_valor', 301, 'f5_fat', '/faturamento/contas (detalhe)', 'Dipirona aparece em medicamentos, sem campo de valor',
  format($q$SELECT e2e.c_confere(jsonb_array_length(m) >= 1 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m) x WHERE x ? 'valor' OR x ? 'valor_total' OR x ? 'valor_unitario'),
      left(m::text, 300)) FROM (SELECT public.conta_detalhe(%L::uuid) -> 'medicamentos' m) z$q$, e2e.u('c01_conta')));

-- ── 10 e 11. conferência e fechamento (caminho A ou B) ──────────────────────
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.10.conferencia', 301, 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c01_conta'), 'em_conferencia', 'status'));
SELECT e2e.c('c01_alta', 'C01.08.desfecho', 'C01.11.fechar', 301, 'f5_fat', '/faturamento/contas', 'Faturamento fecha (caminho A: sem pendência bloqueante)',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c01_conta'), 'fechada', 'status'), 'ok', 'c01_fechada');
SELECT CASE WHEN e2e.v('c01_alta') IS NULL THEN e2e.lacuna('C01.11b.liberar', 301, 'f5_ges_upa', 'Caminho B', 'bloqueado pelo passo C01.08.desfecho')
            WHEN e2e.v('c01_fechada') IS NOT NULL THEN e2e.lacuna('C01.11b.liberar', 301, 'f5_ges_upa', 'Caminho B (liberação do gestor)', 'não precisou: a conta fechou pelo caminho A')
  ELSE e2e.passo('C01.11b.fat_nao_libera', 301, 'f5_fat', '/faturamento/contas', 'Faturamento tenta liberar (deve ser recusado)',
         format($q$SELECT public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo C01: pendência conhecida da rede de teste')::text$q$, e2e.u('c01_conta')), 'erro:Acesso negado: só o gestor')
    || ' / ' || e2e.passo('C01.11b.liberar', 301, 'f5_ges_upa', '/faturamento/contas', 'Gestor libera o fechamento com justificativa',
         format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo C01: pendência conhecida da rede de teste')::text, 200)$q$, e2e.u('c01_conta')))
    || ' / ' || e2e.passo('C01.11b.fechar', 301, 'f5_fat', '/faturamento/contas', 'Faturamento fecha a conta liberada',
         format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c01_conta'), 'fechada', 'status'), 'ok', 'c01_fechada') END;
SELECT e2e.c('c01_fechada', 'C01.11.fechar', 'C01.11.congelado', 301, 'banco', NULL, 'itens_congelados com valor_unitario e valor_total; soma igual à de antes; congelada_em e pendências guardadas',
  format($q$SELECT e2e.c_confere(c.congelada_em IS NOT NULL AND c.pendencias_fechamento IS NOT NULL
        AND (SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(c.itens_congelados) x) = %s::numeric,
      'congelados ' || jsonb_array_length(c.itens_congelados) || ', soma ' || (SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(c.itens_congelados) x)
      || ' (antes ' || %L || ')') FROM public.contas c WHERE c.id = %L$q$, coalesce(e2e.v('c01_total_antes'), '-1'), e2e.v('c01_total_antes'), e2e.u('c01_conta')));
SELECT e2e.c('c01_fechada', 'C01.11.fechar', 'C01.11.auditoria', 301, 'banco', NULL, 'log_auditoria conta_fechada e conta_eventos fechada',
  format($q$SELECT e2e.c_confere(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'conta_fechada' AND entidade_id =%1$L::uuid)
        AND EXISTS (SELECT 1 FROM public.conta_eventos WHERE conta_id = %1$L::uuid AND evento = 'fechada'), 'auditoria e evento')$q$, e2e.u('c01_conta')));

-- ── 12. faturar: versão 1 para o ERP ────────────────────────────────────────
SELECT e2e.c('c01_fechada', 'C01.11.fechar', 'C01.12.faturar', 301, 'f5_fat', '/faturamento/contas', 'fechada → faturada',
  format('SELECT (public.mudar_etapa_conta(%L::uuid, %L, NULL) ->> %L)', e2e.u('c01_conta'), 'faturada', 'status'), 'ok', 'c01_faturada');
SELECT e2e.c('c01_faturada', 'C01.12.faturar', 'C01.12.erp_v1', 301, 'banco', NULL, 'conta_versoes_erp versão 1 vigente; total (só faturáveis) e total_referencia; evento erp_disponivel',
  format($q$SELECT e2e.c_confere(v.versao = 1 AND v.situacao = 'vigente' AND EXISTS (SELECT 1 FROM public.conta_eventos WHERE conta_id = v.conta_id AND evento = 'erp_disponivel'),
      'versão ' || v.versao || ', ' || v.situacao || ', total ' || v.total || ', total_referencia ' || (v.dados ->> 'total_referencia') || ', conciliação ' || v.conciliacao)
    FROM public.conta_versoes_erp v WHERE v.conta_id = %L ORDER BY v.versao DESC LIMIT 1$q$, e2e.u('c01_conta')));
SELECT e2e.c('c01_faturada', 'C01.12.faturar', 'C01.12.fat_nao_reabre', 301, 'f5_fat', '/faturamento/contas', 'Faturamento não reabre conta faturada (deve ser recusado)',
  format($q$SELECT public.mudar_etapa_conta(%L::uuid, 'aberta', 'Teste de permissão do faturamento C01')::text$q$, e2e.u('c01_conta')), 'erro:Reabrir conta fechada é do gestor');

-- ── 13. BPA da competência ──────────────────────────────────────────────────
SELECT e2e.c('c01_conta', 'C01.01.conta', 'C01.13.destinos', 301, 'f5_fat', '/faturamento (BPA)', 'Destino de cada linha do paciente: classificação, consulta e sutura em BPA-I; medicação em BPA-C',
  format($q$SELECT e2e.c_confere(
        (SELECT count(*) FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'destino' = 'bpa_i') = 3
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'origem' = 'medicacao' AND x ->> 'destino' = 'bpa_c'),
      (SELECT string_agg((x ->> 'origem') || ' → ' || coalesce(x ->> 'destino', '?'), '; ') FROM jsonb_array_elements(d -> 'itens') x))
    FROM (SELECT public.conta_detalhe(%L::uuid) d) z$q$, e2e.u('c01_conta')));
SELECT e2e.passo('C01.13.conferencia', 301, 'f5_fat', '/faturamento (BPA)', 'Conferência da competência: linha da medicação do paciente com o motivo "sempre BPA-C"; totais da UPA',
  format($q$SELECT 'UPA: total ' || (b ->> 'total') || ', bpa_i ' || (b ->> 'bpa_i') || ', bpa_c ' || (b ->> 'bpa_c') || ', com crítica ' || (b ->> 'com_critica')
      || '; por origem ' || (b -> 'por_origem')::text || '; paciente: '
      || coalesce((SELECT string_agg((x ->> 'origem') || ' ' || (x ->> 'destino') || coalesce(' (' || (x ->> 'motivo_c') || ')', ''), '; ')
                     FROM jsonb_array_elements(b -> 'linhas') x WHERE x ->> 'paciente' = %L), 'nenhuma linha listada')
    FROM (SELECT public.bpa_conferencia(%L::uuid, %L) b) z$q$, e2e.v('c01_nome'), 'f5100000-0000-4000-8000-000000000002', e2e.v('c01_comp')));

-- ── 14. fechar a competência e baixar o arquivo ─────────────────────────────
SELECT e2e.passo('C01.14.fechar_competencia', 301, 'f5_fat', '/faturamento (BPA)', 'Fecha a competência do mês (processamento = mês)',
  format('SELECT public.fechar_competencia_bpa(%L::uuid, %L, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c01_comp'), e2e.v('c01_comp')), 'ok', 'c01_fech');
SELECT e2e.c('c01_fech', 'C01.14.fechar_competencia', 'C01.14.fechamento', 301, 'banco', NULL, 'bpa_fechamentos: linhas, linhas_bpa_c, folhas, controle, excluídas, avisos, SIGTAP',
  format($q$SELECT 'linhas ' || linhas || ', linhas_bpa_c ' || linhas_bpa_c || ', folhas ' || folhas || ', controle ' || controle
      || ', excluídas ' || jsonb_array_length(excluidas) || ', avisos ' || jsonb_array_length(avisos) || ', sigtap ' || coalesce(sigtap_competencia, '?')
      || ', situação ' || situacao FROM public.bpa_fechamentos WHERE id = %L$q$, e2e.u('c01_fech')));
SELECT e2e.c('c01_fech', 'C01.14.fechar_competencia', 'C01.14.arquivo', 301, 'f5_fat', '/faturamento (BPA, baixar)', 'Arquivo BPA_9995028_AAAAMM.txt: o CNS do paciente aparece; nenhuma coluna de valor',
  format($q$SELECT e2e.c_confere(a ->> 'nome' = 'BPA_9995028_' || %L || '.txt' AND position(%L IN a ->> 'conteudo') > 0,
      a ->> 'nome' || ', ' || length(a ->> 'conteudo') || ' caracteres, ' || array_length(string_to_array(a ->> 'conteudo', E'\n'), 1) || ' linhas; linhas do paciente: '
      || coalesce((SELECT string_agg(left(l, 2) || ' (' || length(l) || ' col.)', ', ') FROM unnest(string_to_array(a ->> 'conteudo', E'\n')) l WHERE position(%L IN l) > 0), 'nenhuma'))
    FROM (SELECT public.arquivo_bpa(%L::uuid) a) z$q$, e2e.v('c01_comp'), e2e.v('c01_cns'), e2e.v('c01_cns'), e2e.u('c01_fech')));
SELECT e2e.c('c01_fech', 'C01.14.fechar_competencia', 'C01.14.arquivo_sem_valor', 301, 'banco', NULL, 'O leiaute do arquivo não tem campo de valor: a linha do paciente não traz 2316 (R$ 23,16 da sutura) nem 1100 (R$ 11,00)',
  format($q$SELECT e2e.c_confere(NOT EXISTS (SELECT 1 FROM unnest(string_to_array(f.arquivo, E'\n')) l WHERE position(%L IN l) > 0
        AND (position('2316' IN l) > 0 OR position('0000001100' IN l) > 0)), 'sem valor nas linhas do paciente')
    FROM public.bpa_fechamentos f WHERE f.id = %L$q$, e2e.v('c01_cns'), e2e.u('c01_fech')));
SELECT e2e.c('c01_fech', 'C01.14.fechar_competencia', 'C01.14.auditoria', 301, 'banco', NULL, 'log_auditoria bpa_competencia_fechada e bpa_arquivo_baixado',
  format($q$SELECT e2e.c_confere(count(DISTINCT acao) = 2, string_agg(DISTINCT acao, ', ')) FROM public.log_auditoria
    WHERE entidade_id =%L::uuid AND acao IN ('bpa_competencia_fechada', 'bpa_arquivo_baixado')$q$, e2e.u('c01_fech')));

-- ── 15. trava: competência fechada ──────────────────────────────────────────
SELECT e2e.c('c01_fech', 'C01.14.fechar_competencia', 'C01.15.trava', 301, 'f5_fat', '/faturamento/contas', 'Lançar outro procedimento com a competência fechada (deve ser recusado)',
  format('SELECT public.registrar_procedimento(%L::uuid, %L, 1, %L::uuid, NULL, %L::uuid)::text', e2e.u('c01_pac'), '0401010058', e2e.u('c01_ep'), e2e.u('c01_med')),
  'erro:A competência');
SELECT e2e.c('c01_fech', 'C01.14.fechar_competencia', 'C01.15.fechar_de_novo', 301, 'f5_fat', '/faturamento (BPA)', 'Fechar de novo a mesma competência (deve ser recusado)',
  format('SELECT public.fechar_competencia_bpa(%L::uuid, %L, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c01_comp'), e2e.v('c01_comp')), 'erro:Competência já fechada');
SELECT e2e.passo('C01.15.futura', 301, 'f5_fat', '/faturamento (BPA)', 'Fechar competência futura (deve ser recusado)',
  format('SELECT public.fechar_competencia_bpa(%L::uuid, %L, %L)::text', 'f5100000-0000-4000-8000-000000000002',
    to_char((now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month', 'YYYYMM'), to_char((now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month', 'YYYYMM')), 'erro');

-- ── 16. reabrir; fechar de novo gera outro fechamento; reabrir de novo ──────
SELECT e2e.c('c01_fech', 'C01.14.fechar_competencia', 'C01.16.motivo_curto', 301, 'f5_fat', '/faturamento (BPA)', 'Reabrir com motivo curto (deve ser recusado)',
  format($q$SELECT public.reabrir_competencia_bpa(%L::uuid, 'curto')::text$q$, e2e.u('c01_fech')), 'erro:Escreva o motivo');
SELECT e2e.c('c01_fech', 'C01.14.fechar_competencia', 'C01.16.reabrir', 301, 'f5_fat', '/faturamento (BPA)', 'Reabre com motivo',
  format($q$SELECT public.reabrir_competencia_bpa(%L::uuid, 'Teste C01: reabertura para conferir o refechamento')::text$q$, e2e.u('c01_fech')), 'ok', 'c01_reaberta');
SELECT e2e.c('c01_reaberta', 'C01.16.reabrir', 'C01.16.reaberta', 301, 'banco', NULL, 'situação reaberta, motivo gravado, auditoria bpa_competencia_reaberta',
  format($q$SELECT e2e.c_confere(f.situacao = 'reaberta' AND f.motivo_reabertura IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id =f.id AND acao = 'bpa_competencia_reaberta'), 'situação ' || f.situacao || ', motivo: ' || f.motivo_reabertura)
    FROM public.bpa_fechamentos f WHERE f.id = %L$q$, e2e.u('c01_fech')));
SELECT e2e.c('c01_reaberta', 'C01.16.reabrir', 'C01.16.refechar', 301, 'f5_fat', '/faturamento (BPA)', 'Fechar de novo gera outro fechamento',
  format('SELECT public.fechar_competencia_bpa(%L::uuid, %L, %L)::text', 'f5100000-0000-4000-8000-000000000002', e2e.v('c01_comp'), e2e.v('c01_comp')), 'ok', 'c01_fech2');
SELECT e2e.c('c01_fech2', 'C01.16.refechar', 'C01.16.dois_fechamentos', 301, 'banco', NULL, 'Dois fechamentos da competência: o 1º reaberto, o 2º fechado',
  format($q$SELECT e2e.c_confere(count(*) FILTER (WHERE id IN (%L, %L)) = 2, string_agg(situacao || ' ' || linhas || ' linhas', '; ' ORDER BY fechado_em))
    FROM public.bpa_fechamentos WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND competencia = %L$q$, e2e.u('c01_fech'), e2e.u('c01_fech2'), e2e.v('c01_comp')));
SELECT e2e.c('c01_fech2', 'C01.16.refechar', 'C01.16.reabrir_de_novo', 301, 'f5_fat', '/faturamento (BPA)', 'Reabre de novo, para não travar os outros cenários da UPA no mês',
  format($q$SELECT public.reabrir_competencia_bpa(%L::uuid, 'Teste C01: devolve a competência aberta para os demais cenários')::text$q$, e2e.u('c01_fech2')));

-- ── 17. desfaz o "sempre BPA-C" (configuração só do cenário) ────────────────
SELECT e2e.c('c01_assoc_med', 'C01.00.id_medicacao', 'C01.17.desmarca_bpa_c', 301, 'f5_fat', '/faturamento (BPA, lista)', 'Faturamento desmarca "sempre BPA-C" da medicação (volta ao que era)',
  format('SELECT public.marcar_sempre_bpa_c(%L::uuid, false)::text', e2e.u('c01_assoc_med')));

-- ── lacunas tocadas ─────────────────────────────────────────────────────────
SELECT e2e.lacuna('C01.99.valor_medicamento', 301, 'f5_fat', 'Valor de medicamento na conta', 'Lacuna (MAPA): a Dipirona aparece só com quantidades (C01.09.medicamento_sem_valor).');
SELECT e2e.lacuna('C01.99.tiss', 301, 'f5_fat', 'TISS/TUSS e tabela de convênio', 'Lacuna (MAPA): trocar_pagador_conta muda só o rótulo; o valor segue SIGTAP (não exercido aqui).');

SELECT passo, papel, situacao, left(detalhe, 220) AS detalhe FROM e2e.resultados
 WHERE passo LIKE 'C01.%' AND em >= e2e.v('c01_inicio')::timestamptz ORDER BY id;
