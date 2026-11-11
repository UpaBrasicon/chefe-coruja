-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário B03.
-- SCA: transferência regulada da UPA para o Hospital F5 com leito reservado;
-- saída pelo NIR, chegada pelo hospital, ficha na porta do hospital, internação
-- no leito reservado, laudo de AIH e contas. Especificação: CENARIOS-B, B03.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas; os
-- resultados ficam em e2e.resultados (passos 'B03.NN.*'). Nada é corrigido no
-- produto. Paciente fictício novo a cada rodada ("Joaquim Ferraz Bittencourt
-- (teste B03)", depois "... B"), com CPF fictício válido (e2e.cpf).
-- Leito do hospital: o primeiro livre da Clínica Médica fora de CM-01 e CM-02
-- (ocupados/reservados pelo A01); sem nenhum, um leito da UTI.
-- No hospital a ficha abre na "Porta do Hospital" (48): recepção, enfermeira e
-- médico da porta; a admissão e o laudo são do médico da Clínica Médica.
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/62_cenario_b03.sql <saida>.sql
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


-- status de um pedido, conferido no banco (mesma do 61)
CREATE OR REPLACE FUNCTION e2e.b_status_sql(p_reg uuid, p_status text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT format($q$SELECT e2e.b_confere(status = %L, 'nº ' || numero || ' ' || status || coalesce(', destino ' || destino_tipo, '') || coalesce(' / ' || destino_externo, '')
      || ', assumida_por ' || coalesce(right(assumida_por::text, 2), 'nulo')) FROM public.regulacao_solicitacoes WHERE id = %L$q$, p_status, p_reg)
$$;
-- prescrição com fallback: se a interação crítica travar, o médico justifica (como na tela)
CREATE OR REPLACE FUNCTION e2e.b03_prescrever(p_passo text, p_dep text, p_item jsonb, p_desc text, p_guardar text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  r := e2e.bpasso(p_dep, p_passo, 'f5_med_upa', '/atendimento (Prescrição)', p_desc,
         format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b03_pac'), p_item), 'ok', p_guardar);
  IF e2e.v(p_guardar) IS NULL AND e2e.v('b03_pac') IS NOT NULL THEN
    r := e2e.bpasso(p_dep, p_passo || '_justificada', 'f5_med_upa', '/atendimento (Prescrição → interacoes_justificadas)', p_desc || ' com justificativa da interação',
           format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b03_pac'),
             p_item || '{"justificativa_interacao":"Dupla antiagregação e anticoagulação na SCA conforme a ficha adulto-sca-inicial (teste de fluxo)"}'::jsonb), 'ok', p_guardar);
  END IF;
  RETURN r;
END $$;

-- ── rodada ──────────────────────────────────────────────────────────────────
SELECT e2e.b_guardar('b03_rodada', (coalesce(e2e.v('b03_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'b03\_%' AND nome <> 'b03_rodada';
SELECT e2e.b_guardar('b03_inicio', now()::text);
SELECT e2e.b_guardar('b03_nome', 'Joaquim Ferraz Bittencourt (teste B03)' || CASE WHEN e2e.v('b03_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('b03_rodada')::int) ELSE '' END);
SELECT e2e.b_guardar('b03_cadastro', jsonb_build_object('nome', e2e.v('b03_nome'), 'data_nascimento', '1971-05-03', 'sexo', 'M', 'raca_cor', 'branca',
  'cpf', e2e.cpf(lpad((631000000 + e2e.v('b03_rodada')::int * 7)::text, 9, '0')), 'nome_mae', 'Mãe Fictícia do Teste B03', 'endereco', 'Rua do Teste, 3',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.b_guardar('b03_leito', (SELECT l.id::text FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
  WHERE s.unidade_id = 'f5100000-0000-4000-8000-000000000003' AND l.status = 'livre' AND l.ativo AND l.identificador NOT IN ('CM-01', 'CM-02')
    AND s.id IN ('f5300000-0000-4000-8000-000000000021', 'f5300000-0000-4000-8000-000000000022')
  ORDER BY (s.id = 'f5300000-0000-4000-8000-000000000022'), l.identificador LIMIT 1));
SELECT e2e.b_guardar('b03_setor_leito', (SELECT setor_id::text FROM public.leitos WHERE id = e2e.u('b03_leito')));
SELECT e2e.b_guardar('b03_leito_nome', (SELECT identificador FROM public.leitos WHERE id = e2e.u('b03_leito')));

-- ── 0. o gestor da UPA oferta a Internação no mapa ──────────────────────────
SELECT e2e.bpasso(NULL, 'B03.00.ofertar', 'f5_ges_upa', '/regulacao (MapaVagas)', 'Gestor da UPA oferta o setor Internação como leito clínico',
  $q$SELECT public.regulacao_ofertar_setor('f5300000-0000-4000-8000-000000000013', 'clinico')::text$q$);

-- ── 1 a 8. porta da UPA ─────────────────────────────────────────────────────
SELECT e2e.bpasso(NULL, 'B03.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha no PS (dor no peito), cadastro com CPF',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor no peito em aperto há 40 minutos, com suor', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('b03_cadastro')), 'ok', 'b03_ep');
SELECT e2e.bpasso('b03_ep', 'B03.01.paciente', 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('b03_ep')), 'ok', 'b03_pac');
SELECT e2e.bpasso('b03_ep', 'B03.01.conta', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial aberta',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000002', e2e.v('b03_nome'), 'ambulatorial'), 'ok', 'b03_conta');
SELECT e2e.bpasso('b03_ep', 'B03.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('b03_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('b03_ep', 'B03.02.classificar', 'f5_enf_upa', '/triagem (Classificar)', 'Classifica vermelho (escolha da enfermeira de teste), fluxograma "Dor torácica", dor 8/10',
  e2e.b_classificar_sql(e2e.u('b03_ep'), 'f5100000-0000-4000-8000-000000000002', 'vermelho',
    '{"frequencia-cardiaca":96,"pressao-arterial-sistolica":150,"pressao-arterial-diastolica":92,"frequencia-respiratoria":20,"saturacao-o2":95,"temperatura":36.4,"escala-dor":8}',
    'Dor torácica', 'Dor torácica em aperto com sudorese (texto da enfermeira de teste)'), 'ok', 'b03_class');
SELECT e2e.bpasso('b03_ep', 'B03.03.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('b03_ep')));
SELECT e2e.bpasso('b03_ep', 'B03.03.soap', 'f5_med_upa', '/atendimento', 'SOAP com CID I21.9 (decisão pelas fichas adulto-sca-inicial, heart, grace, killip e adulto-fibrinoliticos, na tela)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor torácica em aperto há 40 min, sudorese, tabagista (teste B03)', 'FC 96, PA 150x92, SatO2 95%%', 'Síndrome coronariana aguda', 'Transferir pela regulação (decisão do médico de teste pelas fichas)', 'I21.9')::text$q$,
    e2e.u('b03_ep')));
SELECT e2e.bpasso('b03_ep', 'B03.04.exames', 'f5_med_upa', '/atendimento (Exames)', 'Pede ECG e troponina (urgente)',
  -- ECG e laboratório em pedidos separados (RT, 10/11/2026)
  format($q$SELECT (public.pedir_exames(%1$L::uuid, '[{"procedimento":"0211020036"}]'::jsonb, 'urgente', 'SCA (teste B03)')
                 + public.pedir_exames(%1$L::uuid, '[{"procedimento":"0202031209"}]'::jsonb, 'urgente', 'SCA (teste B03)'))::text$q$, e2e.u('b03_ep')), 'ok', 'b03_exames');
SELECT e2e.bpasso('b03_exames', 'B03.04.resultados', 'f5_med_upa', '/atendimento (Exames)', 'Resultados em texto (ECG com supra de ST — dado fictício)',
  format($q$SELECT string_agg(public.resolver_exame(id, 'Resultado de teste em texto (dado fictício)', NULL)::text || 'ok', ',') FROM unnest(%L::uuid[]) id$q$,
    (SELECT array_agg(id) FROM public.exames_pedidos WHERE episodio_id = e2e.u('b03_ep'))));
SELECT e2e.bpasso('b03_pac', 'B03.06.peso', 'f5_med_upa', '/atendimento (Prescrição → peso)', 'Peso referido 84 kg',
  e2e.b_sinais(e2e.u('b03_pac'), '{"peso":84}', NULL, 'referido'));
SELECT e2e.b03_prescrever('B03.06.aas', 'b03_pac', e2e.b_item('dab2ec72-5ff6-4dca-99a8-c66460736bc6', 'oral', 'Agora', 'Conforme a ficha adulto-sca-inicial (teste de fluxo)'),
  'AAS "Agora" (texto de teste, conforme adulto-sca-inicial)', 'b03_item_aas');
SELECT e2e.b03_prescrever('B03.06.clopidogrel', 'b03_pac', e2e.b_item('70251c72-df43-485c-bc11-0cea64f52463', 'oral', 'Agora', 'Conforme a ficha adulto-sca-inicial (teste de fluxo)'),
  'Clopidogrel "Agora" (texto de teste)', 'b03_item_clo');
SELECT e2e.b03_prescrever('B03.06.enoxaparina', 'b03_pac', e2e.b_item('053c61f1-90f3-40d5-85df-cde00d30c862', 'subcutanea', 'Agora', 'Conforme a ficha adulto-sca-inicial (teste de fluxo)'),
  'Enoxaparina (alta vigilância) "Agora" (texto de teste)', 'b03_item_eno');
SELECT e2e.bpasso('b03_pac', 'B03.06.interacoes', 'banco', NULL, 'Interações registradas com justificativa (alertas_interacao)',
  format($q$SELECT count(*) || ' alerta(s): ' || coalesce(string_agg(left(coalesce(a.justificativa, 'sem justificativa'), 60), '; '), 'nenhum')
    FROM public.alertas_interacao a JOIN public.prescricao_itens i ON i.id = a.item_id JOIN public.prescricoes p ON p.id = i.prescricao_id WHERE p.paciente_id = %L$q$, e2e.u('b03_pac')));
SELECT e2e.bpasso('b03_item_eno', 'B03.07.validar', 'f5_farm', '/farmacia (fila de validação)', 'Farmacêutico valida a enoxaparina (alta vigilância)',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.fila_validacao(%L::uuid) f WHERE f.item_id = %L::uuid AND f.alta_vigilancia), 'na fila com alta vigilância') || ' / ' || public.validar_item(%L::uuid, true, NULL)::text$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b03_item_eno'), e2e.u('b03_item_eno')));
SELECT e2e.b_guardar('b03_hora', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));
SELECT e2e.bpasso(x.dep, 'B03.08.checar_' || x.k, 'f5_enf_upa', '/checagem', 'Enfermeira apraza e checa "feito": ' || x.k,
  format('SELECT public.aprazar(%1$L::uuid, %2$L::text[], NULL)::text || public.checar(%1$L::uuid, %3$L, %4$L, NULL)::text',
    e2e.u(x.dep), ARRAY[e2e.v('b03_hora')], 'feito', e2e.v('b03_hora')))
  FROM (VALUES (1, 'b03_item_aas', 'aas'), (2, 'b03_item_clo', 'clopidogrel'), (3, 'b03_item_eno', 'enoxaparina')) x(o, dep, k) ORDER BY x.o;

-- ── 9 a 13. pedido, fila, mapa e autorização ────────────────────────────────
SELECT e2e.bpasso('b03_ep', 'B03.09.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Transferência: leito clínico, ambulância avançada, 0303060190, I21.9, emergência',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('b03_pac'),
    jsonb_build_object('tipo', 'transferencia', 'tipo_leito', 'clinico', 'transporte', 'ambulancia_avancada', 'procedimento', '0303060190', 'cid', 'I21.9',
      'carater', 'urgencia', 'prioridade', 'emergencia', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('b03_ep'),
      'quadro_clinico', 'Dor torácica típica há 40 minutos com sudorese; ECG com supra de ST (dado fictício, teste B03).',
      'exames', 'ECG: supra de ST em parede inferior (texto de teste); troponina pedida', 'telefone_contato', '(11) 0000-0003')), 'ok', 'b03_reg');
SELECT e2e.bpasso('b03_reg', 'B03.09.enviada', 'banco', NULL, 'enviada', e2e.b_status_sql(e2e.u('b03_reg'), 'enviada'));
SELECT e2e.b_guardar('b03_numero', (SELECT numero::text FROM public.regulacao_solicitacoes WHERE id = e2e.u('b03_reg')));
SELECT e2e.bpasso('b03_reg', 'B03.10.fila_gestor', 'f5_ges_upa', '/regulacao (Fila)', 'Gestor da central vê o pedido na fila (não decide)',
  format($q$SELECT e2e.b_confere(public.regulacao_fila(%L::uuid, '{}'::jsonb)::text LIKE '%%' || %L || '%%', 'na fila')$q$, 'f5100000-0000-4000-8000-000000000009', e2e.v('b03_reg')));
SELECT e2e.bpasso('b03_reg', 'B03.10.gestor_nao_decide', 'f5_ges_upa', '/regulacao (PainelDecisao)', 'Gestor da central tenta assumir (deve ser recusado)',
  format('SELECT public.regulacao_assumir(%L::uuid)::text', e2e.u('b03_reg')), 'erro');
SELECT e2e.bpasso('b03_reg', 'B03.11.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 120)', e2e.u('b03_reg')));
SELECT e2e.bpasso('b03_reg', 'B03.11.priorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Prioriza como emergência',
  format($q$SELECT left(public.regulacao_priorizar(%L::uuid, 'emergencia', 'IAM com supra de ST (teste B03)')::text, 120)$q$, e2e.u('b03_reg')));
SELECT e2e.bpasso('b03_reg', 'B03.12.mapa', 'f5_regulador', '/regulacao (MapaVagas)', 'Mapa de vagas: Clínica Médica do hospital e Internação da UPA ofertada',
  $q$SELECT e2e.b_confere(m::text LIKE '%Hospital Fase 5%' AND m::text LIKE '%UPA Fase 5%', left(m::text, 350)) FROM (SELECT public.regulacao_mapa_vagas('f5100000-0000-4000-8000-000000000009') m) x$q$);
SELECT e2e.bpasso('b03_reg', 'B03.13.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5, ambulância avançada, previsto +2 h, leito monitorado',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', now() + interval '2 hours', 'leito monitorado')::text, 120)$q$,
    e2e.u('b03_reg'), 'f5100000-0000-4000-8000-000000000003'), 'ok', 'b03_aut');
SELECT e2e.bpasso('b03_aut', 'B03.13.aviso_destino', 'banco', NULL, 'Aviso reg_destino_N aos plantonistas e ao gestor do hospital',
  format($q$SELECT e2e.b_confere(count(*) >= 2, count(*) || ' aviso(s): ' || string_agg(right(perfil_id::text, 2), ',')) FROM public.notificacoes_plantonista
    WHERE tipo = 'reg_destino_' || %L AND unidade_id = 'f5100000-0000-4000-8000-000000000003'$q$, e2e.v('b03_numero')));

-- ── 14 e 15. aceite com reserva (bordas antes) ──────────────────────────────
SELECT e2e.bpasso('b03_aut', 'B03.14.lista', 'f5_med_hosp', '/regulacao (destino)', 'Pedido na lista do destino',
  format($q$SELECT e2e.b_confere(public.regulacao_destino_lista(%L::uuid)::text LIKE '%%' || %L || '%%', 'na lista')$q$, 'f5100000-0000-4000-8000-000000000003', e2e.v('b03_reg')));
SELECT e2e.bpasso('b03_aut,b03_leito', 'B03.14.leitos', 'f5_med_hosp', '/regulacao (destino)', 'regulacao_leitos_destino oferece o leito escolhido',
  format($q$SELECT e2e.b_confere(l::text LIKE '%%' || %L || '%%', left(l::text, 300)) FROM (SELECT public.regulacao_leitos_destino(%L::uuid) l) x$q$, e2e.v('b03_leito'), e2e.u('b03_reg')));
SELECT e2e.bpasso('b03_aut', 'B03.15.leito_de_outra_unidade', 'f5_med_hosp', '/regulacao (destino)', 'Aceitar com leito de outra unidade (INT da UPA) (deve ser recusado)',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid, NULL)::text', e2e.u('b03_reg'),
    (SELECT id FROM public.leitos WHERE setor_id = 'f5300000-0000-4000-8000-000000000013' ORDER BY identificador LIMIT 1)), 'erro:Leito não encontrado nesta unidade');
SELECT e2e.bpasso('b03_aut', 'B03.15.sem_leito_transferencia', 'f5_med_hosp', '/regulacao (destino)', 'Transferência aceita sem leito passa (desfeito: o cenário escolhe o leito)',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, NULL, 'teste sem leito')::text, 80)$q$, e2e.u('b03_reg')), 'ok', NULL, true);
SELECT e2e.bpasso('b03_aut,b03_leito', 'B03.15.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Hospital aceita e reserva o leito (leito monitorado)',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, %L::uuid, 'aceito, leito monitorado')::text, 120)$q$, e2e.u('b03_reg'), e2e.u('b03_leito')), 'ok', 'b03_aceita');
SELECT e2e.bpasso('b03_aceita', 'B03.15.reserva', 'banco', NULL, 'autorizada; leito reservado; reserva até max(agora + 24 h, previsto + 8 h), paciente nulo; evento de leito',
  format($q$SELECT e2e.b_confere(s.status = 'autorizada' AND l.status = 'reservado' AND r.paciente_id IS NULL AND r.expira_em = greatest(now() + interval '24 hours', s.data_prevista + interval '8 hours')
      AND EXISTS (SELECT 1 FROM public.eventos_leito e WHERE e.leito_id = l.id AND e.tipo_evento = 'reserva' AND e.motivo LIKE '%%' || s.numero || '%%'),
      'status ' || s.status || ', leito ' || l.identificador || ' ' || l.status || ', reserva até ' || r.expira_em || ' (' || r.motivo || ')')
    FROM public.regulacao_solicitacoes s JOIN public.reservas_leito r ON r.id = s.reserva_id JOIN public.leitos l ON l.id = r.leito_id WHERE s.id = %L$q$, e2e.u('b03_reg')), 'ok');
SELECT e2e.b_guardar('b03_exp1', (SELECT r.expira_em::text FROM public.regulacao_solicitacoes s JOIN public.reservas_leito r ON r.id = s.reserva_id WHERE s.id = e2e.u('b03_reg')));
SELECT e2e.bpasso('b03_aceita', 'B03.15.avisos', 'banco', NULL, 'Avisos reg_destino_aceitou_N à origem e ao regulador',
  format($q$SELECT e2e.b_confere(count(DISTINCT unidade_id) = 2, count(*) || ' aviso(s)') FROM public.notificacoes_plantonista WHERE tipo = 'reg_destino_aceitou_' || %L$q$, e2e.v('b03_numero')));
SELECT e2e.bpasso('b03_aceita', 'B03.16.nir', 'f5_nir', '/nir', 'NIR: nada parado neste pedido',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i WHERE i ->> 'ref_id' = %L), 'nada parado')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('b03_reg')));

-- ── 17 a 19. desfecho, saída e chegada ──────────────────────────────────────
SELECT e2e.bpasso('b03_ep,b03_pac', 'B03.17.doc_transferencia', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico emite o documento de transferência (lacuna 7: sem ele a transferência externa é recusada)',
  format($q$SELECT left(public.emitir_documento_transferencia(%L::uuid, jsonb_build_object('resumo_clinico', 'Resumo clínico de teste (B03, dado fictício).', 'condutas', 'Condutas de teste conforme o roteiro (B03, dado fictício).', 'motivo', 'Leito clínico no Hospital F5 pela regulação (teste B03).'))::text, 120)$q$, e2e.u('b03_pac')));
SELECT e2e.bpasso('b03_ep', 'B03.17.desfecho', 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho transferência (Hospital F5)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'transferencia', 'Transferido ao Hospital F5 pela regulação (teste B03)', '{"destino":"Hospital Fase 5"}'::jsonb)::text$q$, e2e.u('b03_ep')), 'ok', 'b03_desfecho');
SELECT e2e.bpasso('b03_aceita', 'B03.18.enfermeira_nao_marca', 'f5_enf_upa', '/regulacao (Detalhe)', 'Enfermeira tenta marcar a saída (deve ser recusado)',
  format('SELECT public.regulacao_marcar_saida(%L::uuid)::text', e2e.u('b03_reg')), 'erro:Marca a saída');
SELECT e2e.bpasso('b03_aceita', 'B03.18.saida', 'f5_nir', '/regulacao (Detalhe)', 'NIR marca a saída (em trânsito)',
  format('SELECT left(public.regulacao_marcar_saida(%L::uuid)::text, 120)', e2e.u('b03_reg')), 'ok', 'b03_saiu');
SELECT e2e.bpasso('b03_saiu', 'B03.18.reserva_estendida', 'banco', NULL, 'Catálogo: na saída a reserva é estendida em 8 h (compara expira_em com o do aceite)',
  format($q$SELECT e2e.b_confere(r.expira_em > %L::timestamptz, 'antes ' || %L || ', depois ' || r.expira_em) FROM public.regulacao_solicitacoes s JOIN public.reservas_leito r ON r.id = s.reserva_id WHERE s.id = %L$q$,
    e2e.v('b03_exp1'), e2e.v('b03_exp1'), e2e.u('b03_reg')));
SELECT e2e.b_guardar('b03_exp2', (SELECT r.expira_em::text FROM public.regulacao_solicitacoes s JOIN public.reservas_leito r ON r.id = s.reserva_id WHERE s.id = e2e.u('b03_reg')));
SELECT e2e.bpasso('b03_saiu', 'B03.18.aviso_saiu', 'banco', NULL, 'Aviso reg_saiu_N ao hospital',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'reg_saiu_' || %L AND unidade_id = 'f5100000-0000-4000-8000-000000000003'), 'aviso reg_saiu_' || %L)$q$,
    e2e.v('b03_numero'), e2e.v('b03_numero')));
SELECT e2e.bpasso('b03_saiu', 'B03.19.chegada', 'f5_med_hosp', '/regulacao (destino)', 'Hospital marca a chegada (realizada)',
  format($q$SELECT left(public.regulacao_marcar_chegada(%L::uuid, true, 'Chegou 10:35 (teste B03)')::text, 120)$q$, e2e.u('b03_reg')), 'ok', 'b03_chegou');
SELECT e2e.bpasso('b03_chegou', 'B03.19.reserva_estendida', 'banco', NULL, 'Catálogo: na chegada a reserva é estendida de novo em 8 h ("pronta para ocupar")',
  format($q$SELECT e2e.b_confere(r.expira_em > %L::timestamptz, 'antes ' || %L || ', depois ' || r.expira_em || ', situação ' || r.situacao) FROM public.regulacao_solicitacoes s JOIN public.reservas_leito r ON r.id = s.reserva_id WHERE s.id = %L$q$,
    e2e.v('b03_exp2'), e2e.v('b03_exp2'), e2e.u('b03_reg')));
SELECT e2e.bpasso('b03_chegou', 'B03.19.segunda_chegada', 'f5_med_hosp', '/regulacao (destino)', 'Segunda chegada depois de realizada (deve ser recusado)',
  format('SELECT public.regulacao_marcar_chegada(%L::uuid, true, NULL)::text', e2e.u('b03_reg')), 'erro:Este pedido não está esperando');
SELECT e2e.bpasso('b03_chegou', 'B03.19.sem_internacao', 'banco', NULL, 'A chegada regulada não cria internação no hospital',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM public.internacoes i JOIN public.pacientes p ON p.id = i.paciente_id WHERE i.unidade_id = 'f5100000-0000-4000-8000-000000000003' AND p.nome = %L), 'nenhuma internação no hospital')$q$,
    e2e.v('b03_nome')));

-- ── 20 a 22. hospital: porta, internação no leito reservado, AIH ────────────
SELECT e2e.bpasso('b03_chegou', 'B03.20.ficha', 'f5_rec_hosp', '/recepcao (Porta do Hospital)', 'Recepção do hospital abre a ficha na porta (transferido da UPA, IAM)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Transferido da UPA pela regulação, IAM (teste B03)', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000024', e2e.v('b03_cadastro')), 'ok', 'b03_eph');
SELECT e2e.bpasso('b03_eph', 'B03.20.paciente', 'banco', NULL, 'Paciente do hospital',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('b03_eph')), 'ok', 'b03_pach');
SELECT e2e.bpasso('b03_eph', 'B03.20.chamar', 'f5_enf_hosp', '/triagem (Porta do Hospital)', 'Enfermeira do hospital chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('b03_eph'), 'c88d5813-249e-48ac-93b7-2cd2e791636d'));
SELECT e2e.bpasso('b03_eph', 'B03.20.classificar', 'f5_enf_hosp', '/triagem (Porta do Hospital)', 'Classifica vermelho (escolha da enfermeira de teste), "Dor torácica"',
  e2e.b_classificar_sql(e2e.u('b03_eph'), 'f5100000-0000-4000-8000-000000000003', 'vermelho',
    '{"frequencia-cardiaca":88,"pressao-arterial-sistolica":138,"pressao-arterial-diastolica":86,"frequencia-respiratoria":18,"saturacao-o2":96,"temperatura":36.3,"escala-dor":4}',
    'Dor torácica', 'IAM transferido em uso de antiagregantes (texto da enfermeira de teste)'));
SELECT e2e.bpasso('b03_eph', 'B03.21.iniciar', 'f5_med_porta_hosp', '/atendimento (Porta do Hospital)', 'Médico da porta assume',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('b03_eph')));
SELECT e2e.bpasso('b03_eph', 'B03.21.soap', 'f5_med_porta_hosp', '/atendimento', 'SOAP de chegada (I21.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Transferido da UPA F5 com SCA (teste B03)', 'FC 88, PA 138x86, sem dor intensa', 'IAM', 'Internar no leito reservado', 'I21.9')::text$q$, e2e.u('b03_eph')));
SELECT e2e.bpasso('b03_pach', 'B03.21.leitos', 'f5_med_porta_hosp', '/atendimento (Desfecho)', 'leitos_para_ocupar oferece o leito reservado pela regulação',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.leitos_para_ocupar(%L::uuid, %L::uuid) l WHERE l.id = %L::uuid),
      coalesce((SELECT string_agg(identificador || CASE WHEN reservado THEN ' (reservado)' ELSE '' END, ', ') FROM public.leitos_para_ocupar(%L::uuid, %L::uuid)), 'nenhum'))$q$,
    e2e.v('b03_setor_leito'), e2e.u('b03_pach'), e2e.u('b03_leito'), e2e.v('b03_setor_leito'), e2e.u('b03_pach')));
SELECT e2e.bpasso('b03_eph', 'B03.21.internar', 'f5_med_porta_hosp', '/atendimento (Desfecho)', 'Interna no leito reservado',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', NULL, jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
    e2e.u('b03_eph'), e2e.v('b03_setor_leito'), e2e.v('b03_leito')));
SELECT e2e.bpasso('b03_eph', 'B03.21.internacao', 'banco', NULL, 'Internação no hospital',
  format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L AND etapa = 'internacao'$q$, e2e.u('b03_eph')), 'ok', 'b03_inth');
SELECT e2e.bpasso('b03_inth', 'B03.21.reserva_ocupada', 'banco', NULL, 'Leito ocupado; a reserva da regulação vira "ocupada" e liga à internação; conta de internação do hospital aberta',
  format($q$SELECT e2e.b_confere(l.status = 'ocupado' AND r.internacao_id = i.id AND EXISTS (SELECT 1 FROM public.contas c WHERE c.internacao_id = i.id AND c.tipo = 'internacao'),
      'leito ' || l.identificador || ' ' || l.status || '; reserva ' || coalesce(r.situacao, '?') || coalesce(' (' || r.motivo_encerramento || ')', ''))
    FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id
    LEFT JOIN public.reservas_leito r ON r.id = (SELECT reserva_id FROM public.regulacao_solicitacoes WHERE id = %L) WHERE i.id = %L$q$, e2e.u('b03_reg'), e2e.u('b03_inth')));
SELECT e2e.bpasso('b03_inth', 'B03.22.admissao', 'f5_med_hosp', '/plantao/internacao (caderno do leito)', 'Médico da Clínica Médica registra a admissão',
  format($q$SELECT public.registrar_admissao(%L::uuid, 'Admissão de SCA transferida da UPA F5 (teste B03)',
    '{"subjetivo":"Dor torácica há horas, transferido (teste B03)","objetivo":"FC 88, PA 138x86","cid":"I21.9","plano":"Conduta conforme a ficha adulto-sca-inicial (teste de fluxo)"}'::jsonb)::text$q$, e2e.u('b03_inth')));
SELECT e2e.bpasso('b03_inth', 'B03.22.laudo_aih', 'f5_med_hosp', '/plantao/internacao (laudo AIH)', 'Laudo de AIH com 0303060190',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'laudo_aih', %L) ->> 'id')$q$, e2e.u('b03_pach'),
    jsonb_build_object('aih', jsonb_build_object('sinais', 'Dor torácica típica, supra de ST (teste B03)', 'condicoes', 'IAM transferido da UPA',
      'diagnostico', 'Infarto agudo do miocárdio', 'cid', 'I21.9', 'procCod', '0303060190', 'procDesc', 'TRATAMENTO DE INFARTO AGUDO DO MIOCÁRDIO', 'clinica', 'Clínica médica'))::text),
  'ok', 'b03_laudo');
-- o laudo de AIH exige o CNS (o paciente veio só com CPF): a recepção do
-- hospital completa o cadastro e o médico emite o laudo de novo
SELECT CASE WHEN e2e.v('b03_laudo') IS NULL AND e2e.v('b03_pach') IS NOT NULL THEN
  e2e.bpasso('b03_pach', 'B03.22.cns_cadastro', 'f5_med_hosp', '/plantao/internacao (cadastro do paciente)', 'O laudo pediu o CNS: o médico da Clínica Médica completa o cadastro com o CNS (a recepção da porta já não alcança o internado)',
    format($q$SELECT left(public.salvar_cadastro_paciente(%L::uuid, %L::jsonb, %L::uuid, false)::text, 120)$q$, e2e.u('b03_pach'),
      e2e.v('b03_cadastro')::jsonb || jsonb_build_object('cns', e2e.b_cns(6300 + e2e.v('b03_rodada')::int)), 'f5300000-0000-4000-8000-000000000021'), 'ok', 'b03_cns') END;
SELECT CASE WHEN e2e.v('b03_laudo') IS NULL AND e2e.v('b03_cns') IS NOT NULL THEN
  e2e.bpasso('b03_inth', 'B03.22.laudo_aih_com_cns', 'f5_med_hosp', '/plantao/internacao (laudo AIH)', 'Laudo de AIH com 0303060190, depois do CNS',
    format($q$SELECT (public.emitir_documento(%L::uuid, 'laudo_aih', %L) ->> 'id')$q$, e2e.u('b03_pach'),
      jsonb_build_object('aih', jsonb_build_object('sinais', 'Dor torácica típica, supra de ST (teste B03)', 'condicoes', 'IAM transferido da UPA',
        'diagnostico', 'Infarto agudo do miocárdio', 'cid', 'I21.9', 'procCod', '0303060190', 'procDesc', 'TRATAMENTO DE INFARTO AGUDO DO MIOCÁRDIO', 'clinica', 'Clínica médica'))::text),
    'ok', 'b03_laudo') END;
SELECT e2e.bpasso('b03_laudo', 'B03.22.aih', 'banco', NULL, 'AIH solicitada pelo gatilho do laudo',
  format($q$SELECT a.id::text FROM public.aihs a WHERE a.laudo_id = %L AND a.status = 'solicitada'$q$, e2e.u('b03_laudo')), 'ok', 'b03_aih');
SELECT e2e.bpasso('b03_aih', 'B03.23.gestor_nao_decide', 'f5_ges_upa', '/aih', 'Gestor da UPA tenta decidir a AIH (deve ser recusado)',
  format($q$SELECT public.decidir_aih(%L::uuid, true, '3526100000003', %L, NULL)::text$q$, e2e.u('b03_aih'), to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')), 'erro');
SELECT e2e.bpasso('b03_aih', 'B03.23.decidir', 'f5_regulador', '/aih', 'Regulador aprova a AIH',
  format($q$SELECT public.decidir_aih(%L::uuid, true, %L, %L, NULL)::text$q$, e2e.u('b03_aih'),
    '35261' || lpad(coalesce(e2e.v('b03_numero'), '0'), 8, '0'), to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')), 'ok', 'b03_aih_ok');

-- ── 24 e 25. contas e indicadores ───────────────────────────────────────────
SELECT e2e.bpasso('b03_conta', 'B03.24.conferencia', 'f5_fat', '/faturamento/contas', 'Conta da UPA: aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('b03_conta'), 'em_conferencia'));
SELECT e2e.bpasso('b03_conta', 'B03.24.custos', 'f5_fat', '/faturamento/contas', 'Custos e pré-auditoria da conta da UPA', e2e.b_conta_resumo_sql(e2e.u('b03_conta')));
SELECT e2e.bpasso('b03_conta', 'B03.24.fechar', 'f5_fat', '/faturamento/contas', 'Conta da UPA: em_conferencia → fechada',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('b03_conta'), 'fechada'), 'ok', 'b03_fechada');
SELECT e2e.bpasso('b03_inth', 'B03.24.conta_int_hospital', 'f5_fat', '/faturamento/contas (Hospital)', 'Conta de internação do hospital (AIH 0303060190)',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000003', e2e.v('b03_nome'), 'internacao'), 'ok', 'b03_conta_int');
SELECT e2e.bpasso('b03_conta_int', 'B03.24.custos_int_hospital', 'f5_fat', '/faturamento/contas (Hospital)', 'Custos da internação no hospital', e2e.b_conta_resumo_sql(e2e.u('b03_conta_int')));
SELECT e2e.bpasso('b03_eph', 'B03.24.conta_porta_hospital', 'f5_fat', '/faturamento/contas (Hospital)', 'Conta da porta do hospital',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000003', e2e.v('b03_nome'), 'ambulatorial'), 'ok', 'b03_conta_ph');
SELECT e2e.bpasso('b03_conta_ph', 'B03.24.custos_porta_hospital', 'f5_fat', '/faturamento/contas (Hospital)', 'Custos da porta do hospital', e2e.b_conta_resumo_sql(e2e.u('b03_conta_ph')));
SELECT e2e.bpasso('b03_reg', 'B03.25.indicadores', 'f5_ges_upa', '/regulacao (Indicadores)', 'Indicadores da central', $q$SELECT left(public.regulacao_indicadores('f5100000-0000-4000-8000-000000000009', '{}')::text, 400)$q$);
SELECT e2e.bpasso('b03_reg', 'B03.25.sla', 'f5_ges_upa', '/regulacao (SlaRegulacao)', 'Painel de SLA da central: o pedido realizado não está nele',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_sla_painel('f5100000-0000-4000-8000-000000000009', '{}') -> 'dados') y WHERE y ->> 'id' = %L), 'fora do painel')$q$, e2e.v('b03_reg')));
SELECT e2e.bpasso('b03_reg', 'B03.25.tempos', 'banco', NULL, 'Tempos por status (regulacao_status_tempos)',
  format($q$SELECT e2e.b_confere(count(*) >= 4, string_agg(status, ' → ' ORDER BY inicio, ctid)) FROM public.regulacao_status_tempos WHERE solicitacao_id = %L$q$, e2e.u('b03_reg')));
SELECT e2e.lacuna('B03.99.reserva_vencida', 1, 'banco', 'Reserva vencida liberada por private.expirar_reservas',
  'Não executado: exigiria esperar o vencimento (1 h no mínimo) ou mexer no relógio; o cron expirar-reservas-leito roda a cada 5 min na homologação.');
SELECT e2e.bpasso('b03_reg', 'B03.99.eventos', 'banco', NULL, 'Um evento por transição, autor = login',
  format($q$SELECT e2e.b_confere(count(*) >= 6, string_agg(ev.evento || ' por ' || coalesce(right(ev.por::text, 2), '?'), ' → ' ORDER BY ev.em, ev.ctid))
    FROM public.regulacao_eventos ev WHERE ev.solicitacao_id = %L$q$, e2e.u('b03_reg')));
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'B03.%' AND em >= e2e.v('b03_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
