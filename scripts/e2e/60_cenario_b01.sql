-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário B01.
-- Sepse: porta da UPA, observação, parecer, internação na UPA, AIH e regulação
-- de leito de UTI com destino FORA da rede, até o fechamento das duas contas.
-- Especificação: CENARIOS-B-urgencia-regulacao.md, seção B01.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas; os
-- resultados ficam em e2e.resultados (passos 'B01.NN.*'). Nada é corrigido no
-- produto: o que ele recusa fica como falha, e o que dependia do passo recusado
-- vira lacuna "bloqueado". Conferência do que a tela não mostra roda como
-- 'banco' (postgres), para o RLS não esconder a linha e dar "ok" falso.
--
-- Regras do teste: paciente fictício novo a cada rodada ("Severino Tavares da
-- Luz (teste B01)", depois "... B"), CNS gerado por e2e.b_cns; dose = texto
-- 'conforme protocolo — dado fictício de teste de fluxo'; a cor é a escolha da
-- enfermeira de teste; custos só os que o sistema calcula (SIGTAP).
-- Leitos: a observação usa o box que private.box_livre escolher (OA-01 e OA-02
-- estão ocupados/em higienização); a internação usa um leito INT livre.
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/60_cenario_b01.sql <saida>.sql
--                    npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on


-- ── apoio do bloco B (funções e2e.b_*; iguais nos scripts 60 a 65) ──────────
-- e2e.bpasso: roda o SQL COMO a conta do papel (role authenticated + claims do
-- JWT, RLS ligado) ou, com o papel 'banco', como postgres (conferência do que a
-- tela não mostra). Sem a variável de dependência, vira lacuna "bloqueado".
-- p_esperado: 'ok' | 'erro' | 'erro:<início da mensagem>' | 'registrar' (só anota
-- aceito/recusado). p_desfazer: roda e desfaz (borda que mudaria o cenário).
-- Passo 'ok' que deveria guardar um id e volta vazio é FALHA (evita o "ok falso"
-- do RLS que esconde a linha, visto no A01).
CREATE OR REPLACE FUNCTION e2e.b_confere(p boolean, p_msg text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p IS NOT TRUE THEN RAISE EXCEPTION 'confere: %', p_msg; END IF;
  RETURN 'ok: ' || p_msg;
END $$;
GRANT EXECUTE ON FUNCTION e2e.b_confere(boolean, text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.b_falhar(p text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '%', p; END $$;
GRANT EXECUTE ON FUNCTION e2e.b_falhar(text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.b_guardar(p_nome text, p_valor text) RETURNS text LANGUAGE sql AS $$
  INSERT INTO e2e.vars VALUES (p_nome, p_valor) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor RETURNING valor
$$;
-- CNS fictício com dígito verificador válido (mesma regra do e2e.cns do 50)
CREATE OR REPLACE FUNCTION e2e.b_cns(p_n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE base text; s int; d int; k int := 0; i int;
BEGIN
  LOOP
    base := '7' || lpad((90000000000 + p_n * 7 + k)::text, 13, '0');
    s := 0;
    FOR i IN 1..14 LOOP s := s + substr(base, i, 1)::int * (16 - i); END LOOP;
    d := (11 - s % 11) % 11;
    IF d < 10 THEN RETURN base || d; END IF;
    k := k + 1;
  END LOOP;
END $$;
-- sinais vitais crus como a tela grava (sincronizar_registros), com o método do peso
CREATE OR REPLACE FUNCTION e2e.b_sinais(p_pac uuid, p_sinais jsonb, p_internacao uuid DEFAULT NULL, p_metodo text DEFAULT NULL)
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT format($q$SELECT CASE WHEN bool_and(x ->> 'status' = 'gravado') THEN count(*)::text || ' sinais gravados'
                             ELSE e2e.b_falhar(string_agg(coalesce(x ->> 'motivo', x::text), '; ')) END
                     FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)::jsonb) x$q$,
    (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'observacao', 'hora', now(), 'sem_conexao', false,
              'aparelho_id', 'e2e-bloco-b',
              'dados', jsonb_build_object('paciente_id', p_pac, 'internacao_id', p_internacao,
                         'conceito_id', (SELECT c.id FROM public.conceito c WHERE c.nome = k.key AND c.unidade_id IS NULL),
                         'valor_num', k.value, 'origem', 'manual', 'metodo', p_metodo)))
       FROM jsonb_each(p_sinais) k))
$$;
CREATE OR REPLACE FUNCTION e2e.bpasso(p_dep text, p_passo text, p_papel text, p_rota text, p_descricao text, p_sql text,
                                     p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL, p_desfazer boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_res text; v_ok boolean; v_err text; v_sit text; v_det text; v_dep text;
BEGIN
  -- dependências separadas por vírgula: sem qualquer uma, o passo fica bloqueado
  FOREACH v_dep IN ARRAY string_to_array(coalesce(p_dep, ''), ',') LOOP
    IF btrim(v_dep) <> '' AND e2e.v(btrim(v_dep)) IS NULL THEN
      INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
      VALUES (p_passo, 1, p_papel, p_rota, p_descricao, 'existir', 'lacuna', 'bloqueado por passo anterior (sem ' || btrim(v_dep) || ')');
      RETURN 'lacuna — ' || p_passo || ' — bloqueado (sem ' || btrim(v_dep) || ')';
    END IF;
  END LOOP;
  BEGIN
    IF p_papel <> 'banco' THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta(p_papel), 'role', 'authenticated')::text, true);
      PERFORM set_config('role', 'authenticated', true);
    END IF;
    EXECUTE p_sql INTO v_res;
    PERFORM set_config('role', 'postgres', true);
    IF p_desfazer THEN RAISE EXCEPTION USING ERRCODE = 'P0E2E', MESSAGE = 'e2e_desfazer'; END IF;
    v_ok := true;
  EXCEPTION
    WHEN SQLSTATE 'P0E2E' THEN PERFORM set_config('role', 'postgres', true); v_ok := true;
    WHEN OTHERS THEN PERFORM set_config('role', 'postgres', true); v_ok := false; v_err := SQLERRM;
  END;
  IF p_esperado = 'registrar' THEN
    v_sit := 'ok';
    v_det := CASE WHEN v_ok THEN 'ACEITO' || CASE WHEN p_desfazer THEN ' (desfeito)' ELSE '' END || ': ' || left(coalesce(v_res, ''), 300)
                  ELSE 'RECUSADO: ' || v_err END;
  ELSIF p_esperado = 'ok' THEN
    IF v_ok AND p_guardar IS NOT NULL AND v_res IS NULL THEN
      v_sit := 'falha'; v_det := 'sem retorno (nada para guardar em ' || p_guardar || ')';
    ELSIF v_ok THEN
      v_sit := 'ok'; v_det := coalesce(left(v_res, 400), '(sem retorno: void)');
      IF p_guardar IS NOT NULL AND NOT p_desfazer THEN PERFORM e2e.b_guardar(p_guardar, v_res); END IF;
    ELSE
      v_sit := 'falha'; v_det := v_err;
    END IF;
  ELSE
    IF v_ok THEN
      v_sit := 'falha'; v_det := 'PASSOU sem erro (deveria ser recusado)' || CASE WHEN p_desfazer THEN ' (desfeito)' ELSE '' END || ': ' || left(coalesce(v_res, ''), 300);
    ELSIF p_esperado = 'erro' OR v_err LIKE substr(p_esperado, 6) || '%' THEN
      v_sit := 'ok'; v_det := 'recusado: ' || v_err;
    ELSE
      v_sit := 'falha'; v_det := 'recusado com outra mensagem: ' || v_err;
    END IF;
  END IF;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, 1, p_papel, p_rota, p_descricao, p_esperado, v_sit, v_det);
  RETURN v_sit || ' — ' || p_passo || ' — ' || coalesce(v_det, '');
END $$;
-- SQL da classificação: fluxograma adulto pelo nome; discriminador do protocolo
-- na cor escolhida pela enfermeira de teste ou, se o fluxograma não tiver, o
-- texto livre que ela escreve
CREATE OR REPLACE FUNCTION e2e.b_classificar_sql(p_ep uuid, p_unidade uuid, p_cor text, p_sinais jsonb, p_fluxo text, p_livre text,
                                                 p_avaliacao jsonb DEFAULT '{}'::jsonb)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format($q$SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L, %L::jsonb, NULL, NULL, NULL, NULL, false, %L::boolean)::text$q$,
    p_ep, p_cor, p_sinais, f.id, coalesce(e2e.disc(p_unidade, f.id, p_cor), p_livre), p_avaliacao, e2e.disc(p_unidade, f.id, p_cor) IS NULL)
  FROM (SELECT fl.id FROM public.protocolo_fluxogramas fl JOIN public.unidades u ON u.protocolo_classificacao_id = fl.protocolo_id
         WHERE u.id = p_unidade AND fl.nome = p_fluxo AND fl.publico = 'adulto') f
$$;
-- item de prescrição (dose: SEMPRE o texto de teste, nunca dose de memória)
CREATE OR REPLACE FUNCTION e2e.b_item(p_med uuid, p_via text, p_freq text, p_obs text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('tipo', 'medicamento', 'medicamento_id', p_med, 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                            'via', p_via, 'posologia', p_freq, 'observacao', p_obs)
$$;
-- conta do paciente numa unidade (como o faturamento vê), por nome e tipo
CREATE OR REPLACE FUNCTION e2e.b_conta_sql(p_unidade uuid, p_nome text, p_tipo text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = %L ORDER BY c ->> 'numero' DESC LIMIT 1), e2e.b_falhar('conta não achada'))$q$,
    p_unidade, p_nome, p_tipo)
$$;
-- resumo de uma conta (status, total, itens com código e valor, pendências)
CREATE OR REPLACE FUNCTION e2e.b_conta_resumo_sql(p_conta uuid) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT format($q$SELECT 'status ' || (d ->> 'status') || '; total ' || coalesce(d ->> 'total_referencia', 'nulo') || '; itens: '
      || coalesce((SELECT string_agg(coalesce(i ->> 'procedimento', '?') || ' qt ' || coalesce(i ->> 'quantidade', '?') || ' = ' || coalesce(i ->> 'valor_total', 'nulo'), ', ')
                     FROM jsonb_array_elements(d -> 'itens') i), 'nenhum')
      || '; medicamentos ' || coalesce(jsonb_array_length(d -> 'medicamentos'), 0) || '; pendências ' || coalesce(jsonb_array_length(d -> 'pendencias'), 0)
      || '; bloqueantes sem liberação ' || coalesce(d ->> 'bloqueantes_sem_liberacao', '?')
    FROM (SELECT public.conta_detalhe(%L::uuid) d) x$q$, p_conta)
$$;


-- ── rodada: nome, CNS, leito ────────────────────────────────────────────────
SELECT e2e.b_guardar('b01_rodada', (coalesce(e2e.v('b01_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'b01\_%' AND nome <> 'b01_rodada';
SELECT e2e.b_guardar('b01_inicio', now()::text);
SELECT e2e.b_guardar('b01_nome', 'Severino Tavares da Luz (teste B01)' || CASE WHEN e2e.v('b01_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('b01_rodada')::int) ELSE '' END);
SELECT e2e.b_guardar('b01_cadastro', jsonb_build_object('nome', e2e.v('b01_nome'), 'data_nascimento', '1958-04-20', 'sexo', 'M', 'raca_cor', 'parda',
  'cns', e2e.b_cns(6100 + e2e.v('b01_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste B01', 'endereco', 'Rua do Teste, 1', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.b_guardar('b01_leito_int', (SELECT l.id::text FROM public.leitos l WHERE l.setor_id = 'f5300000-0000-4000-8000-000000000013'
  AND l.status = 'livre' AND l.ativo ORDER BY l.identificador LIMIT 1));

-- ── 1. recepção ─────────────────────────────────────────────────────────────
SELECT e2e.bpasso(NULL, 'B01.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha no PS (febre, confusão e dor ao urinar)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Febre, confusão e dor ao urinar há dois dias', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('b01_cadastro')), 'ok', 'b01_ep');
SELECT e2e.bpasso('b01_ep', 'B01.01.paciente', 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('b01_ep')), 'ok', 'b01_pac');
SELECT e2e.bpasso('b01_ep', 'B01.01.conta', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial aberta pelo gatilho (o faturamento vê)',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000002', e2e.v('b01_nome'), 'ambulatorial'), 'ok', 'b01_conta_porta');

-- ── 2 e 3. triagem (o técnico não classifica) ───────────────────────────────
SELECT e2e.bpasso('b01_ep', 'B01.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('b01_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('b01_ep', 'B01.03.tecnico_nao_classifica', 'f5_tec_upa', '/triagem', 'Técnico de enfermagem tenta classificar (deve ser recusado)',
  e2e.b_classificar_sql(e2e.u('b01_ep'), 'f5100000-0000-4000-8000-000000000002', 'laranja',
    '{"frequencia-cardiaca":118,"pressao-arterial-sistolica":88,"pressao-arterial-diastolica":54,"frequencia-respiratoria":26,"saturacao-o2":93,"temperatura":38.9,"escala-dor":3}',
    'Mal-estar geral', 'Febre com confusão e disúria (texto da enfermeira de teste)', '{"glasgow":"14"}'), 'erro');
SELECT e2e.bpasso('b01_ep', 'B01.02.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica laranja (escolha da enfermeira de teste), sinais crus, Glasgow 14, fluxograma "Mal-estar geral"',
  e2e.b_classificar_sql(e2e.u('b01_ep'), 'f5100000-0000-4000-8000-000000000002', 'laranja',
    '{"frequencia-cardiaca":118,"pressao-arterial-sistolica":88,"pressao-arterial-diastolica":54,"frequencia-respiratoria":26,"saturacao-o2":93,"temperatura":38.9,"escala-dor":3}',
    'Mal-estar geral', 'Febre com confusão e disúria (texto da enfermeira de teste)', '{"glasgow":"14"}'), 'ok', 'b01_class');
SELECT e2e.bpasso('b01_class', 'B01.02.cor_banco', 'banco', NULL, 'Cor gravada = a da enfermeira, autora = login, sem campo de sugestão',
  format($q$SELECT e2e.b_confere(c.cor = 'laranja' AND c.autor_id = 'f5200000-0000-4000-8000-000000000007' AND NOT (to_jsonb(c) ?| ARRAY['cor_sugerida', 'sugestao', 'cor_sistema']),
      'cor ' || c.cor || ', fluxograma ' || coalesce(c.fluxograma_nome, '?') || ', discriminador ' || coalesce(c.discriminador, '?') || ' (livre ' || c.discriminador_livre || '), autor ' || right(c.autor_id::text, 2))
    FROM public.classificacoes_risco c WHERE c.id = %L$q$, e2e.u('b01_class')));

-- ── 4 a 6. atendimento, exames ──────────────────────────────────────────────
SELECT e2e.bpasso('b01_ep', 'B01.04.iniciar', 'f5_med_upa', '/atendimento (JanelaAtendimento)', 'Médico assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('b01_ep')));
SELECT e2e.bpasso('b01_ep', 'B01.04.soap', 'f5_med_upa', '/atendimento (AbaAtendimento)', 'SOAP com CID A41.9 (decisão pelas fichas sepse-adulto, news2 e adulto-ressuscitacao-volemica, na tela)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Febre, confusão e disúria há 2 dias (teste B01)', 'FC 118, PA 88x54, FR 26, SatO2 93%%, Tax 38,9, Glasgow 14', 'Sepse de foco urinário', 'Conduta conforme as fichas sepse-adulto e adulto-ressuscitacao-volemica (teste de fluxo)', 'A41.9')::text$q$,
    e2e.u('b01_ep')));
SELECT e2e.bpasso('b01_ep', 'B01.06.exames', 'f5_med_upa', '/atendimento (Exames)', 'Pede lactato, hemograma e hemocultura (urgente) pelo SIGTAP',
  format($q$SELECT public.pedir_exames(%L::uuid, '[{"procedimento":"0202010538"},{"procedimento":"0202020380"},{"procedimento":"0202080153"}]'::jsonb, 'urgente', 'Sepse (teste B01)')::text$q$,
    e2e.u('b01_ep')), 'ok', 'b01_exames');
SELECT e2e.bpasso('b01_exames', 'B01.06.resultados', 'f5_med_upa', '/atendimento (Exames)', 'Registra os resultados em texto',
  format($q$SELECT string_agg(public.resolver_exame(id, 'Resultado de teste em texto (dado fictício)', NULL)::text || 'ok', ',') FROM unnest(%L::uuid[]) id$q$,
    (SELECT array_agg(id) FROM public.exames_pedidos WHERE episodio_id = e2e.u('b01_ep'))));

-- ── 7 a 9. prescrição, farmácia, checagem ───────────────────────────────────
SELECT e2e.bpasso('b01_pac', 'B01.07.sem_peso', 'f5_med_upa', '/atendimento (Prescrição)', 'Prescrever sem peso do atendimento (deve ser recusado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b01_pac'),
    e2e.b_item('bb34963c-8e4f-4b4f-bfee-f4aefa30ac56', 'endovenosa', 'Agora', 'teste sem peso')), 'erro:Falta para prescrever');
SELECT e2e.bpasso('b01_pac', 'B01.07.peso', 'f5_med_upa', '/atendimento (Prescrição → peso)', 'Peso referido 70 kg',
  e2e.b_sinais(e2e.u('b01_pac'), '{"peso":70}', NULL, 'referido'));
SELECT e2e.bpasso('b01_pac', 'B01.07.antibiotico', 'f5_med_upa', '/atendimento (Prescrição)', 'Ceftriaxona "Agora" (dose: texto de teste, conforme sepse-adulto)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b01_pac'),
    e2e.b_item('bb34963c-8e4f-4b4f-bfee-f4aefa30ac56', 'endovenosa', 'Agora', 'Conforme a ficha sepse-adulto (teste de fluxo)')), 'ok', 'b01_item_atb');
SELECT e2e.bpasso('b01_pac', 'B01.07.volume', 'f5_med_upa', '/atendimento (Prescrição)', 'Ringer com lactato "Agora" (volume: texto de teste, conforme adulto-ressuscitacao-volemica)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b01_pac'),
    e2e.b_item('07b3c28e-88be-41a7-b22b-de9cb7e9111d', 'endovenosa', 'Agora', 'Conforme a ficha adulto-ressuscitacao-volemica (teste de fluxo)')), 'ok', 'b01_item_vol');
SELECT e2e.bpasso('b01_pac', 'B01.07.vasopressor', 'f5_med_upa', '/atendimento (Prescrição)', 'Noradrenalina (alta vigilância) "Agora" (texto de teste, conforme sepse-adulto)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b01_pac'),
    e2e.b_item('bf5b3fad-06bf-4bb4-8903-e8df67000812', 'endovenosa', 'Agora', 'Conforme a ficha sepse-adulto (teste de fluxo)')), 'ok', 'b01_item_nora');
SELECT e2e.bpasso('b01_item_nora', 'B01.08.fila', 'f5_farm', '/farmacia (fila de validação)', 'A noradrenalina aparece na fila como alta vigilância',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.fila_validacao(%L::uuid) f WHERE f.item_id = %L::uuid AND f.alta_vigilancia), 'na fila com alta vigilância')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b01_item_nora')));
SELECT e2e.bpasso('b01_item_nora', 'B01.08.validar', 'f5_farm', '/alta-vigilancia', 'Farmacêutico valida e libera (confere)',
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('b01_item_nora')));
SELECT e2e.bpasso(x.dep, 'B01.08.dispensar_' || x.k, 'f5_farm', '/dispensacao', 'Dispensa 1 unidade de consumo (' || x.k || ', sem valor)',
  format('SELECT left(public.dispensar_item(%L::uuid, 1, NULL)::text, 200)', e2e.u(x.dep)))
  FROM (VALUES (1, 'b01_item_atb', 'antibiotico'), (2, 'b01_item_vol', 'volume'), (3, 'b01_item_nora', 'vasopressor')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.b_guardar('b01_hora', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));
SELECT e2e.bpasso(x.dep, 'B01.09.checar_' || x.k, 'f5_enf_upa', '/checagem', 'Enfermeira (no lugar do técnico, que não está no PS) apraza e checa "feito": ' || x.k,
  format('SELECT public.aprazar(%1$L::uuid, %2$L::text[], NULL)::text || public.checar(%1$L::uuid, %3$L, %4$L, NULL)::text',
    e2e.u(x.dep), ARRAY[e2e.v('b01_hora')], 'feito', e2e.v('b01_hora')))
  FROM (VALUES (1, 'b01_item_atb', 'antibiotico'), (2, 'b01_item_vol', 'volume'), (3, 'b01_item_nora', 'vasopressor')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.bpasso('b01_pac', 'B01.09.autor', 'banco', NULL, 'Administrações com autor = login da enfermeira; a de alta vigilância com liberação',
  format($q$SELECT e2e.b_confere(count(*) = 3 AND bool_and(a.registrado_por = 'f5200000-0000-4000-8000-000000000007') AND NOT bool_or(a.sem_liberacao),
      count(*) || ' administrações, sem_liberacao ' || bool_or(a.sem_liberacao))
    FROM public.administracoes a JOIN public.prescricao_itens i ON i.id = a.item_id JOIN public.prescricoes p ON p.id = i.prescricao_id
   WHERE p.paciente_id = %L AND a.situacao = 'feito'$q$, e2e.u('b01_pac')));

-- ── 10 a 12. observação, enfermagem, alerta de sepse ────────────────────────
SELECT e2e.bpasso('b01_ep', 'B01.10.observacao', 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho observação (box livre da Observação Adulto)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.u('b01_ep')), 'ok', 'b01_desfecho_obs');
SELECT e2e.bpasso('b01_desfecho_obs', 'B01.10.box', 'banco', NULL, 'Internação de observação aberta (box livre, ou sem box se não houver; nunca OA-01/OA-02)',
  format($q$SELECT i.id::text FROM public.internacoes i JOIN public.episodios e ON e.id = i.episodio_id
    WHERE e.id = %L AND i.status = 'em_observacao' AND coalesce(i.leito_atual_id NOT IN (SELECT id FROM public.leitos WHERE identificador IN ('OA-01', 'OA-02')), true)$q$, e2e.u('b01_ep')),
  'ok', 'b01_obs');
SELECT e2e.bpasso('b01_obs', 'B01.10.box_qual', 'banco', NULL, 'Box escolhido por private.box_livre',
  format($q$SELECT coalesce(l.identificador, 'sem box (nenhum box livre)') || ' (' || s.nome || ')' FROM public.internacoes i LEFT JOIN public.leitos l ON l.id = i.leito_atual_id JOIN public.setores s ON s.id = i.setor_atual_id WHERE i.id = %L$q$, e2e.u('b01_obs')));
SELECT e2e.bpasso('b01_obs', 'B01.11.sinais_enf_porta', 'f5_enf_upa', '/enfermagem/pronto-socorro', 'Catálogo: a enfermeira da porta registra sinais no box (registro do resultado)',
  e2e.b_sinais(e2e.u('b01_pac'), '{"frequencia-cardiaca":124}', e2e.u('b01_obs')), 'registrar', NULL, true);
SELECT e2e.bpasso('b01_obs', 'B01.11.sinais', 'f5_enf_obs', '/enfermagem (Observação)', 'Enfermeira escalada na observação registra sinais crus (FC 124, PA 84x50, FR 28, SatO2 92%)',
  e2e.b_sinais(e2e.u('b01_pac'), '{"frequencia-cardiaca":124,"pressao-arterial-sistolica":84,"pressao-arterial-diastolica":50,"frequencia-respiratoria":28,"saturacao-o2":92}', e2e.u('b01_obs')));
SELECT e2e.bpasso('b01_obs', 'B01.11.acuidade', 'f5_enf_obs', '/enfermagem (Observação)', 'Acuidade recalculada (NEWS2 no leito)',
  format('SELECT left(public.acuidade(%L::uuid)::text, 300)', e2e.u('b01_pac')));
SELECT e2e.bpasso('b01_obs', 'B01.12.alerta_sepse', 'f5_ges_upa', '/gestao (painel de alertas)', 'Gestor vê o paciente em alertas_sepse',
  format($q$SELECT coalesce((SELECT 'nível ' || a.nivel || ', total ' || a.total FROM public.alertas_sepse(%L::uuid) a WHERE a.paciente_id = %L::uuid),
      e2e.b_falhar('paciente fora de alertas_sepse (' || (SELECT count(*) FROM public.alertas_sepse(%L::uuid)) || ' alerta(s) na unidade)'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b01_pac'), 'f5100000-0000-4000-8000-000000000002'));

-- ── 13 e 14. observação: atendimento, reavaliação, parecer ──────────────────
SELECT e2e.bpasso('b01_obs', 'B01.13.reavaliar_ps', 'f5_med_upa', '/plantao/observacao', 'Catálogo: o médico do PS marca a reavaliação no box (registro; desfeito)',
  format($q$SELECT public.observacao_reavaliar(%L::uuid, now() + interval '1 hour')::text$q$, e2e.u('b01_obs')), 'registrar', NULL, true);
SELECT e2e.bpasso('b01_obs', 'B01.13.atender', 'f5_med_obs', '/plantao/observacao', 'Médico escalado na observação registra o atendimento no box',
  format('SELECT public.observacao_atender(%L::uuid)::text', e2e.u('b01_obs')));
SELECT e2e.bpasso('b01_obs', 'B01.13.reavaliar', 'f5_med_obs', '/plantao/observacao', 'Marca reavaliação em 1 h',
  format($q$SELECT public.observacao_reavaliar(%L::uuid, now() + interval '1 hour')::text$q$, e2e.u('b01_obs')));
SELECT e2e.bpasso('b01_obs', 'B01.13.reavaliado', 'f5_med_obs', '/plantao/observacao', 'Registra a reavaliação feita',
  format('SELECT public.observacao_reavaliado(%L::uuid)::text', e2e.u('b01_obs')));
SELECT e2e.bpasso('b01_obs', 'B01.13.parecer', 'f5_med_upa', '/plantao/observacao (AbaParecer)', 'Médico do PS pede parecer de Clínica médica (urgência)',
  format($q$SELECT public.solicitar_parecer(%L::uuid, 'Clínica médica', 'Idoso com sepse urinária em observação: há indicação de UTI? (teste B01)', 'urgencia', NULL, %L::uuid, %L::uuid)::text$q$,
    e2e.u('b01_pac'), e2e.u('b01_ep'), e2e.u('b01_obs')), 'ok', 'b01_parecer');
SELECT CASE WHEN e2e.v('b01_parecer') IS NULL AND e2e.v('b01_obs') IS NOT NULL THEN
  e2e.bpasso('b01_obs', 'B01.13.parecer_obs', 'f5_med_obs', '/plantao/observacao (AbaParecer)', 'O pedido do PS foi recusado: o médico da observação pede o parecer',
    format($q$SELECT public.solicitar_parecer(%L::uuid, 'Clínica médica', 'Idoso com sepse urinária em observação: há indicação de UTI? (teste B01)', 'urgencia', NULL, %L::uuid, %L::uuid)::text$q$,
      e2e.u('b01_pac'), e2e.u('b01_ep'), e2e.u('b01_obs')), 'ok', 'b01_parecer') END;
SELECT e2e.bpasso('b01_parecer', 'B01.13.documento', 'banco', NULL, 'Parecer solicitado com documento clínico de solicitação e autor = login',
  format($q$SELECT e2e.b_confere(p.status = 'solicitado' AND p.documento_solicitacao_id IS NOT NULL, 'status ' || p.status || ', solicitante ' || right(p.solicitante_id::text, 2)
      || ', documento ' || coalesce((SELECT tipo_documento FROM public.documentos_clinicos d WHERE d.id = p.documento_solicitacao_id), 'nenhum'))
    FROM public.pareceres_medicos p WHERE p.id = %L$q$, e2e.u('b01_parecer')));
SELECT e2e.bpasso('b01_parecer', 'B01.14.especialidade', 'f5_med_int', '/pareceres', 'Médico da internação declara a especialidade Clínica médica',
  $q$SELECT public.definir_minhas_especialidades(ARRAY['Clínica médica'])::text$q$);
SELECT e2e.bpasso('b01_parecer', 'B01.14.fila', 'f5_med_int', '/pareceres', 'O parecer aparece na fila de quem responde',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.pareceres_fila(%L::uuid, 2) f WHERE f.id = %L::uuid AND f.posso_analisar), 'na fila, posso_analisar')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b01_parecer')));
SELECT e2e.bpasso('b01_parecer', 'B01.14.impede_alta', 'f5_med_obs', '/plantao/observacao (alta)', 'Com o parecer aberto, impeditivos_alta lista o parecer',
  format($q$SELECT e2e.b_confere(public.impeditivos_alta(%L::uuid)::text ILIKE '%%parecer%%', left(public.impeditivos_alta(%L::uuid)::text, 300))$q$, e2e.u('b01_obs'), e2e.u('b01_obs')));
SELECT e2e.bpasso('b01_parecer', 'B01.14.iniciar', 'f5_med_int', '/pareceres', 'Inicia a análise',
  format('SELECT public.iniciar_analise_parecer(%L::uuid)::text', e2e.u('b01_parecer')));
SELECT e2e.bpasso('b01_parecer', 'B01.14.solicitante_nao_responde', 'f5_med_upa', '/pareceres', 'Quem pediu tenta concluir (deve ser recusado)',
  format($q$SELECT public.concluir_parecer(%L::uuid, 'Resposta do próprio solicitante (teste)')::text$q$, e2e.u('b01_parecer')), 'erro');
SELECT e2e.bpasso('b01_parecer', 'B01.14.concluir', 'f5_med_int', '/pareceres', 'Conclui o parecer',
  format($q$SELECT public.concluir_parecer(%L::uuid, 'Sepse com hipotensão persistente: indicada UTI; manter conduta pelas fichas (teste B01)')::text$q$, e2e.u('b01_parecer')), 'ok', 'b01_parecer_ok');
SELECT e2e.bpasso('b01_parecer_ok', 'B01.14.realizado', 'banco', NULL, 'solicitado → em_analise → realizado, com documento de resposta',
  format($q$SELECT e2e.b_confere(status = 'realizado' AND documento_resposta_id IS NOT NULL AND analista_id = 'f5200000-0000-4000-8000-000000000015', 'status ' || status)
    FROM public.pareceres_medicos WHERE id = %L$q$, e2e.u('b01_parecer')));
SELECT e2e.bpasso('b01_parecer_ok', 'B01.14.alta_liberada', 'f5_med_obs', '/plantao/observacao (alta)', 'Depois do parecer, o parecer sai dos impeditivos',
  format($q$SELECT e2e.b_confere(public.impeditivos_alta(%L::uuid)::text NOT ILIKE '%%parecer%%', left(public.impeditivos_alta(%L::uuid)::text, 300))$q$, e2e.u('b01_obs'), e2e.u('b01_obs')));

-- ── 15. a observação vira internação (leito INT) ────────────────────────────
SELECT e2e.bpasso('b01_obs,b01_leito_int', 'B01.15.finalizar', 'f5_med_upa', '/plantao/observacao', 'Médico do PS (que abriu a observação) encerra: internação no leito INT, CID A41.9',
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'internacao', 'A41.9', 'Sepse com hipotensão: internação na UPA enquanto aguarda UTI (teste B01)', jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
    e2e.u('b01_obs'), 'f5300000-0000-4000-8000-000000000013', e2e.v('b01_leito_int')), 'ok', 'b01_finalizada');
SELECT CASE WHEN e2e.v('b01_finalizada') IS NULL AND e2e.v('b01_obs') IS NOT NULL THEN
  e2e.bpasso('b01_obs,b01_leito_int', 'B01.15.finalizar_obs', 'f5_med_obs', '/plantao/observacao', 'O médico do PS foi recusado: o médico da observação encerra com internação',
    format($q$SELECT public.finalizar_observacao(%L::uuid, 'internacao', 'A41.9', 'Sepse com hipotensão: internação na UPA enquanto aguarda UTI (teste B01)', jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
      e2e.u('b01_obs'), 'f5300000-0000-4000-8000-000000000013', e2e.v('b01_leito_int')), 'ok', 'b01_finalizada') END;
SELECT e2e.bpasso('b01_finalizada', 'B01.15.internacao', 'banco', NULL, 'Internado no leito INT (a mesma internação, convertida da observação)',
  format($q$SELECT i.id::text FROM public.internacoes i
    WHERE i.paciente_id = %L AND i.data_alta IS NULL AND i.internado_em IS NOT NULL AND i.setor_atual_id = 'f5300000-0000-4000-8000-000000000013'$q$,
    e2e.u('b01_pac')), 'ok', 'b01_int');
SELECT e2e.bpasso('b01_int', 'B01.15.conta_internacao', 'banco', NULL, 'Conta de internação aberta (gatilho trg_conta_da_internacao), com conta_origem_id = conta da porta',
  format($q$SELECT coalesce((SELECT c.numero || ', origem ' || coalesce(right(c.conta_origem_id::text, 4), '-') FROM public.contas c
      WHERE c.internacao_id = %L AND c.tipo = 'internacao' AND c.conta_origem_id = %L), e2e.b_falhar('nenhuma conta de internação para esta internação'))$q$,
    e2e.u('b01_int'), e2e.u('b01_conta_porta')));
SELECT e2e.bpasso('b01_finalizada', 'B01.15.internacao_registro', 'banco', NULL, 'Como ficou: internações do paciente e contas',
  format($q$SELECT string_agg(i.tipo_internacao || '/' || i.status || ' ' || coalesce(l.identificador, '-') || ' internado_em ' || coalesce(i.internado_em::text, 'nulo'), '; ')
      || ' | contas: ' || (SELECT string_agg(c.tipo || ' ' || c.numero || ' origem ' || coalesce(right(c.conta_origem_id::text, 4), '-'), ', ') FROM public.contas c WHERE c.paciente_id = %L)
    FROM public.internacoes i LEFT JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.paciente_id = %L$q$, e2e.u('b01_pac'), e2e.u('b01_pac')));

-- ── 16 e 17. leito: admissão, diagnóstico, AIH, reavaliação ─────────────────
SELECT e2e.bpasso('b01_int', 'B01.16.admissao', 'f5_med_int', '/plantao/internacao (caderno do leito)', 'Registra a admissão (ficha completa)',
  format($q$SELECT public.registrar_admissao(%L::uuid, 'Admissão de idoso com sepse urinária vindo da observação (teste B01)',
    '{"subjetivo":"Febre, confusão e disúria (teste B01)","objetivo":"PA 84x50 após volume, FC 124","cid":"A41.9","plano":"Conduta conforme as fichas; pedir UTI"}'::jsonb)::text$q$, e2e.u('b01_int')));
SELECT e2e.bpasso('b01_int', 'B01.16.diagnostico', 'f5_med_int', '/plantao/internacao', 'Diagnóstico primário A41.9 confirmado',
  format($q$SELECT public.registrar_diagnostico(%L::uuid, 'primario', 'A41.9', 'confirmado', NULL, NULL, NULL)::text$q$, e2e.u('b01_int')));
SELECT e2e.bpasso('b01_int', 'B01.16.vindos_da_porta', 'f5_med_int', '/plantao/internacao (prescrição)', 'A prescrição da porta aparece em "Vindos da porta"',
  format($q$SELECT e2e.b_confere(count(*) >= 1, count(*) || ' itens: ' || coalesce(string_agg(descricao, '; '), '-')) FROM public.prescricao_porta_ativa(%L::uuid)$q$, e2e.u('b01_pac')));
SELECT e2e.bpasso('b01_int', 'B01.16.buscar_sigtap', 'f5_med_int', '/plantao/internacao (laudo AIH)', 'buscar_sigtap oferece 0303010037 (outras doenças bacterianas)',
  $q$SELECT e2e.b_confere(public.buscar_sigtap('bacterianas')::text LIKE '%0303010037%', 'achou 0303010037')$q$);
SELECT e2e.bpasso('b01_int', 'B01.16.laudo_aih', 'f5_med_int', '/plantao/internacao (laudo AIH)', 'Laudo de AIH com 0303010037',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'laudo_aih', %L) ->> 'id')$q$, e2e.u('b01_pac'),
    jsonb_build_object('aih', jsonb_build_object('sinais', 'Febre, hipotensão e confusão (teste B01)', 'condicoes', 'Sepse de foco urinário em idoso',
      'diagnostico', 'Sepse', 'cid', 'A41.9', 'procCod', '0303010037', 'procDesc', 'TRATAMENTO DE OUTRAS DOENÇAS BACTERIANAS', 'clinica', 'Clínica médica'))::text),
  'ok', 'b01_laudo');
SELECT e2e.bpasso('b01_laudo', 'B01.16.aih', 'banco', NULL, 'AIH solicitada pelo gatilho do laudo',
  format($q$SELECT a.id::text FROM public.aihs a WHERE a.laudo_id = %L AND a.status = 'solicitada'$q$, e2e.u('b01_laudo')), 'ok', 'b01_aih');
SELECT e2e.bpasso('b01_int', 'B01.17.reavaliacao', 'f5_med_int', '/plantao/internacao', 'Reavaliação do quadro com piora (sinais crus)',
  format($q$SELECT public.registrar_reavaliacao_quadro(%L::uuid, 'Piora: PA 82x48 apesar do volume, mais confuso (teste B01)',
    '{"motivo":"Hipotensão persistente","subjetivo":"Mais sonolento","objetivo":"PA 82x48, FC 128, FR 30, SatO2 91%%","cid":"A41.9","plano":"Pedir UTI pela regulação"}'::jsonb)::text$q$, e2e.u('b01_int')));
SELECT e2e.bpasso('b01_int', 'B01.17.acuidade', 'f5_med_int', '/plantao/internacao', 'Acuidade do leito',
  format('SELECT left(public.acuidade(%L::uuid)::text, 300)', e2e.u('b01_pac')));

-- ── 18. pedido de UTI (bordas antes) ────────────────────────────────────────
SELECT e2e.b_guardar('b01_pedido', jsonb_build_object('tipo', 'leito', 'tipo_leito', 'uti_adulto', 'procedimento', '0303010037', 'cid', 'A41.9',
  'carater', 'urgencia', 'prioridade', 'emergencia', 'destino_tipo', 'a_definir', 'vulnerabilidades', jsonb_build_array('idoso'), 'internacao_id', e2e.v('b01_int'),
  'quadro_clinico', 'Idoso de 68 anos com sepse de foco urinário, hipotensão persistente após volume e confusão (teste B01).',
  'sinais_vitais', 'PA 82x48, FC 128, FR 30, SatO2 91%', 'exames', 'Lactato, hemograma e hemocultura colhidos (resultados de teste)',
  'medicacoes', 'Ceftriaxona, ringer com lactato e noradrenalina conforme as fichas (teste de fluxo)')::text);
SELECT e2e.bpasso('b01_int', 'B01.18.quadro_curto', 'f5_med_int', '/regulacao (NovaSolicitacao)', 'Quadro com 19 letras (deve ser recusado)',
  format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb || '{"quadro_clinico":"Sepse de foco urina"}'::jsonb)::text$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b01_pac'), e2e.v('b01_pedido')), 'erro:Confira o pedido');
SELECT e2e.bpasso('b01_int', 'B01.18.internacao_invalida', 'f5_med_int', '/regulacao (NovaSolicitacao)', 'internacao_id que não é do paciente (deve ser recusado)',
  format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb || jsonb_build_object('internacao_id', gen_random_uuid()))::text$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b01_pac'), e2e.v('b01_pedido')), 'erro:A internação informada');
SELECT e2e.bpasso('b01_int', 'B01.18.solicitar', 'f5_med_int', '/regulacao (NovaSolicitacao)', 'Pede leito de UTI adulto: emergência, idoso, SIGTAP do laudo, CID A41.9',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b01_pac'), e2e.v('b01_pedido')), 'ok', 'b01_reg');
SELECT e2e.bpasso('b01_reg', 'B01.18.enviada', 'banco', NULL, 'enviada, modalidade 04, sem aviso de duplicidade, evento e auditoria',
  format($q$SELECT e2e.b_confere(s.status = 'enviada' AND s.modalidade = '04' AND s.central_id = 'f5100000-0000-4000-8000-000000000009'
      AND (SELECT (e.detalhes ->> 'duplicidade')::boolean FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id AND e.evento = 'enviada') = false
      AND EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.acao = 'regulacao_solicitada' AND a.entidade_id = s.id),
      'nº ' || s.numero || ', ' || s.status || ', modalidade ' || s.modalidade) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.u('b01_reg')));
SELECT e2e.b_guardar('b01_numero', (SELECT numero::text FROM public.regulacao_solicitacoes WHERE id = e2e.u('b01_reg')));

-- ── 19 a 21. central: fila, priorização, mapa, autorização para fora ────────
SELECT e2e.bpasso('b01_reg', 'B01.19.fila', 'f5_regulador', '/regulacao (Fila)', 'O pedido está na fila da central',
  format($q$SELECT e2e.b_confere(public.regulacao_fila(%L::uuid, '{}'::jsonb)::text LIKE '%%' || %L || '%%', 'na fila')$q$, 'f5100000-0000-4000-8000-000000000009', e2e.v('b01_reg')));
SELECT e2e.bpasso('b01_reg', 'B01.19.assumir', 'f5_regulador', '/regulacao (Detalhe)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 150)', e2e.u('b01_reg')));
SELECT e2e.bpasso('b01_reg', 'B01.19.priorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Prioriza como emergência',
  format($q$SELECT left(public.regulacao_priorizar(%L::uuid, 'emergencia', 'Sepse com hipotensão persistente (teste B01)')::text, 150)$q$, e2e.u('b01_reg')));
SELECT e2e.bpasso('b01_reg', 'B01.19.criterios', 'f5_regulador', '/regulacao (Criterios)', 'Critérios da central',
  $q$SELECT left(public.regulacao_criterios('f5100000-0000-4000-8000-000000000009')::text, 200)$q$);
SELECT e2e.bpasso('b01_reg', 'B01.19.duplicidade_em_analise', 'f5_med_int', '/regulacao (NovaSolicitacao)', 'Segundo pedido de UTI com o primeiro em análise: aviso_duplicidade = true (desfeito)',
  format($q$SELECT e2e.b_confere((x ->> 'aviso_duplicidade')::boolean, x::text) FROM (SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) x) z$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b01_pac'), e2e.v('b01_pedido')), 'ok', NULL, true);
SELECT e2e.bpasso('b01_reg', 'B01.20.mapa_vagas', 'f5_regulador', '/regulacao (MapaVagas)', 'Catálogo: o mapa mostra só leito clínico (sem UTI na rede)',
  $q$SELECT e2e.b_confere(m::text NOT ILIKE '%uti%', left(m::text, 350)) FROM (SELECT public.regulacao_mapa_vagas('f5100000-0000-4000-8000-000000000009') m) x$q$);
SELECT e2e.bpasso('b01_reg', 'B01.21.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para UTI fora da rede, ambulância avançada, previsto +3 h',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'externo', NULL, 'UTI Hospital Regional (fora da rede)', 'ambulancia_avancada', now() + interval '3 hours', 'Sem UTI na rede F5 (teste B01)')::text, 150)$q$,
    e2e.u('b01_reg')), 'ok', 'b01_autorizada');
SELECT e2e.bpasso('b01_autorizada', 'B01.21.aviso_origem', 'banco', NULL, 'Aviso reg_autorizada_N na origem (solicitante)',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'reg_autorizada_' || %L AND perfil_id = 'f5200000-0000-4000-8000-000000000015'), 'aviso reg_autorizada_' || %L)$q$,
    e2e.v('b01_numero'), e2e.v('b01_numero')));
SELECT e2e.bpasso('b01_autorizada', 'B01.21.hospital_nao_aceita_externo', 'f5_med_hosp', '/regulacao (destino)', 'Aceite pela unidade num destino externo (deve ser recusado)',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, NULL, NULL)::text', e2e.u('b01_reg')), 'erro:Este pedido não está aguardando o aceite da unidade');
SELECT e2e.bpasso('b01_autorizada', 'B01.21.saida_antes', 'f5_med_int', '/regulacao (Detalhe)', 'Marcar a saída antes da resposta externa (deve ser recusado)',
  format('SELECT public.regulacao_marcar_saida(%L::uuid)::text', e2e.u('b01_reg')), 'erro:Só sai o paciente');
SELECT e2e.bpasso('b01_autorizada', 'B01.21.duplicidade_aguardando', 'f5_med_int', '/regulacao (NovaSolicitacao)', 'Segundo pedido de UTI com o primeiro aguardando o destino: aviso_duplicidade = true (desfeito)',
  format($q$SELECT e2e.b_confere((x ->> 'aviso_duplicidade')::boolean, x::text) FROM (SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) x) z$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b01_pac'), e2e.v('b01_pedido')), 'ok', NULL, true);
SELECT e2e.bpasso('b01_autorizada', 'B01.22.resposta_externa', 'f5_regulador', '/regulacao (Detalhe)', 'Registra o aceite do serviço de fora (plantonista da UTI, telefone)',
  format($q$SELECT left(public.regulacao_registrar_resposta_externa(%L::uuid, true, 'plantonista da UTI', 'telefone')::text, 150)$q$, e2e.u('b01_reg')), 'ok', 'b01_aceita');
SELECT e2e.bpasso('b01_aceita', 'B01.22.resposta_banco', 'banco', NULL, 'autorizada; resposta externa guardada com quem e meio',
  format($q$SELECT e2e.b_confere(s.status = 'autorizada' AND r.destino_tipo = 'externo' AND r.externo_quem = 'plantonista da UTI' AND r.externo_meio = 'telefone' AND s.reserva_id IS NULL,
      'status ' || s.status || ', resposta ' || r.resposta || ' (' || r.destino_externo || ')') FROM public.regulacao_solicitacoes s JOIN public.regulacao_destino_respostas r ON r.solicitacao_id = s.id WHERE s.id = %L$q$,
    e2e.u('b01_reg')));

-- ── 23 a 27. evolução, NIR, alta, saída e chegada ───────────────────────────
SELECT e2e.bpasso('b01_aceita', 'B01.23.evolucao', 'f5_med_int', '/regulacao (Detalhe)', 'Catálogo: a origem atualiza a evolução com o pedido já autorizado',
  format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Mantém PA 90x56 com noradrenalina, aguardando ambulância (teste B01)', 'PA 90x56, FC 112, FR 24, SatO2 94%%')::text$q$, e2e.u('b01_reg')));
SELECT e2e.bpasso('b01_reg', 'B01.24.nir', 'f5_nir', '/nir', 'NIR: nenhum item de regulação deste pedido',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i WHERE i ->> 'ref_id' = %L), 'nada parado neste pedido')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('b01_reg')));
SELECT e2e.bpasso('b01_int', 'B01.25.impeditivos', 'f5_med_int', '/plantao/internacao (alta)', 'impeditivos_alta antes da alta',
  format('SELECT left(public.impeditivos_alta(%L::uuid)::text, 300)', e2e.u('b01_int')));
SELECT e2e.bpasso('b01_int', 'B01.25.alta', 'f5_med_int', '/plantao/internacao (alta)', 'Alta por transferência externa (UTI fora da rede), CID A41.9',
  format($q$SELECT public.dar_alta(%L::uuid, 'transferencia_externa', 'A41.9', now(), NULL, 'Transferido para UTI fora da rede pela regulação (teste B01)', '{"destino":"UTI Hospital Regional (fora da rede)"}'::jsonb)::text$q$,
    e2e.u('b01_int')), 'ok', 'b01_alta');
SELECT e2e.bpasso('b01_aceita', 'B01.26.saida', 'f5_med_int', '/regulacao (Detalhe)', 'Marca a saída (em trânsito)',
  format('SELECT left(public.regulacao_marcar_saida(%L::uuid)::text, 150)', e2e.u('b01_reg')), 'ok', 'b01_saiu');
SELECT e2e.bpasso('b01_saiu', 'B01.27.origem_nao_marca_chegada', 'f5_med_int', '/regulacao (Detalhe)', 'Origem tenta marcar a chegada de destino externo (deve ser recusado)',
  format('SELECT public.regulacao_marcar_chegada(%L::uuid, true, NULL)::text', e2e.u('b01_reg')), 'erro:Marca a chegada');
SELECT e2e.bpasso('b01_saiu', 'B01.27.chegada', 'f5_regulador', '/regulacao (Detalhe)', 'A central marca a chegada (destino de fora)',
  format($q$SELECT left(public.regulacao_marcar_chegada(%L::uuid, true, 'Chegou à UTI às 04:10 (teste B01)')::text, 150)$q$, e2e.u('b01_reg')), 'ok', 'b01_chegou');
SELECT e2e.bpasso('b01_chegou', 'B01.27.historico', 'f5_regulador', '/regulacao (Historico)', 'Catálogo: o regulador confere o histórico do paciente',
  format($q$SELECT e2e.b_confere(h::text LIKE '%%' || %L || '%%' AND h::text LIKE '%%realizada%%', left(h::text, 200)) FROM (SELECT public.regulacao_historico_paciente(%L::uuid) h) x$q$,
    e2e.v('b01_reg'), e2e.u('b01_pac')));

SELECT e2e.bpasso('b01_chegou', 'B01.27.historico_origem', 'f5_med_int', '/regulacao (Historico)', 'O médico da origem vê o histórico do paciente com o pedido realizado',
  format($q$SELECT e2e.b_confere(h::text LIKE '%%' || %L || '%%' AND h::text LIKE '%%realizada%%', left(h::text, 200)) FROM (SELECT public.regulacao_historico_paciente(%L::uuid) h) x$q$,
    e2e.v('b01_reg'), e2e.u('b01_pac')));

-- ── 28 e 29. AIH e contas ───────────────────────────────────────────────────
SELECT e2e.bpasso('b01_aih', 'B01.28.aih', 'f5_regulador', '/aih', 'Regulador aprova a AIH',
  format($q$SELECT public.decidir_aih(%L::uuid, true, %L, %L, NULL)::text$q$, e2e.u('b01_aih'),
    '35261' || lpad(coalesce(e2e.v('b01_numero'), '0'), 8, '0'), to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')), 'ok', 'b01_aih_ok');
SELECT e2e.bpasso('b01_int', 'B01.29.conta_int', 'f5_fat', '/faturamento/contas', 'Conta da internação',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000002', e2e.v('b01_nome'), 'internacao'), 'ok', 'b01_conta_int');
SELECT e2e.bpasso(x.dep, 'B01.29.' || x.k || '_conferencia', 'f5_fat', '/faturamento/contas', 'Conta ' || x.k || ': aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 150)', e2e.u(x.dep), 'em_conferencia'))
  FROM (VALUES (1, 'b01_conta_porta', 'porta'), (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.bpasso(x.dep, 'B01.29.' || x.k || '_custos', 'f5_fat', '/faturamento/contas', 'Custos e pré-auditoria da conta ' || x.k, e2e.b_conta_resumo_sql(e2e.u(x.dep)))
  FROM (VALUES (1, 'b01_conta_porta', 'porta'), (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.bpasso(x.dep, 'B01.29.' || x.k || '_fechar', 'f5_fat', '/faturamento/contas', 'Conta ' || x.k || ': em_conferencia → fechada',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 150)', e2e.u(x.dep), 'fechada'), 'ok', x.dep || '_fechada')
  FROM (VALUES (1, 'b01_conta_porta', 'porta'), (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
-- pendência bloqueante: o gestor libera e o faturamento fecha
SELECT CASE WHEN e2e.v(x.dep) IS NOT NULL AND e2e.v(x.dep || '_fechada') IS NULL THEN
  e2e.bpasso(x.dep, 'B01.29.' || x.k || '_liberar', 'f5_ges_upa', '/faturamento/contas', 'Gestor libera o fechamento com motivo',
    format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo B01: pendências conhecidas da rede de teste')::text, 200)$q$, e2e.u(x.dep))) END
  FROM (VALUES (1, 'b01_conta_porta', 'porta'), (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT CASE WHEN e2e.v(x.dep) IS NOT NULL AND e2e.v(x.dep || '_fechada') IS NULL THEN
  e2e.bpasso(x.dep, 'B01.29.' || x.k || '_fechar_liberada', 'f5_fat', '/faturamento/contas', 'Fecha a conta liberada',
    format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 150)', e2e.u(x.dep), 'fechada'), 'ok', x.dep || '_fechada') END
  FROM (VALUES (1, 'b01_conta_porta', 'porta'), (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.bpasso('b01_conta_int_fechada', 'B01.29.congelados', 'banco', NULL, 'Itens congelados: classificação, consulta e medicação na porta; AIH na internação',
  format($q$SELECT e2e.b_confere((SELECT itens_congelados::text FROM public.contas WHERE id = %1$L) LIKE '%%0303010037%%'
      AND (SELECT itens_congelados::text FROM public.contas WHERE id = %2$L) LIKE '%%0301060096%%',
      (SELECT string_agg(c.tipo || ' ' || c.status || ' ' || coalesce((SELECT string_agg((x ->> 'procedimento') || '=' || coalesce(x ->> 'valor_total', 'nulo'), ', ') FROM jsonb_array_elements(c.itens_congelados) x), '-'), ' | ')
         FROM public.contas c WHERE c.id IN (%1$L, %2$L)))$q$, e2e.u('b01_conta_int'), e2e.u('b01_conta_porta')));

-- ── conferência final ───────────────────────────────────────────────────────
SELECT e2e.bpasso('b01_reg', 'B01.99.eventos', 'banco', NULL, 'Um evento por transição em regulacao_eventos, autor = login',
  format($q$SELECT e2e.b_confere(count(*) >= 6, string_agg(ev.evento || ' por ' || coalesce(right(ev.por::text, 2), '?'), ' → ' ORDER BY ev.em, ev.ctid))
    FROM public.regulacao_eventos ev WHERE ev.solicitacao_id = %L$q$, e2e.u('b01_reg')));
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'B01.%' AND em >= e2e.v('b01_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
