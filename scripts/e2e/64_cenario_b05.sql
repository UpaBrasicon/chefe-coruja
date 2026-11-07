-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário B05.
-- UBS: escuta inicial (o técnico é recusado), consulta com CID e CIAP-2,
-- regulação de CONSULTA especializada (CBO), teleinterconsulta (aberta,
-- tentativa de aceite, cancelamento), aceite do hospital sem leito e chegada
-- direta de "autorizada" para "realizada". Especificação: CENARIOS-B, B05.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas; os
-- resultados ficam em e2e.resultados (passos 'B05.NN.*'). Nada é corrigido no
-- produto. Paciente fictícia nova a cada rodada ("Marlene Siqueira Pontes
-- (teste B05)", depois "... B").
-- Ordem ajustada ao produto: a ficha é de ESCUTA INICIAL (a consulta programada
-- ou do dia não passa pela escuta; achado P3-1 do A01) e a conduta, que encerra
-- a consulta da UBS, vem DEPOIS do pedido de regulação e da teleinterconsulta
-- (os dois exigem o atendimento aberto).
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/64_cenario_b05.sql <saida>.sql
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

-- ── rodada ──────────────────────────────────────────────────────────────────
SELECT e2e.b_guardar('b05_rodada', (coalesce(e2e.v('b05_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'b05\_%' AND nome <> 'b05_rodada';
SELECT e2e.b_guardar('b05_inicio', now()::text);
SELECT e2e.b_guardar('b05_nome', 'Marlene Siqueira Pontes (teste B05)' || CASE WHEN e2e.v('b05_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('b05_rodada')::int) ELSE '' END);
SELECT e2e.b_guardar('b05_cadastro', jsonb_build_object('nome', e2e.v('b05_nome'), 'data_nascimento', '1965-06-02', 'sexo', 'F', 'raca_cor', 'preta',
  'cns', e2e.b_cns(6500 + e2e.v('b05_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste B05', 'endereco', 'Rua do Teste, 5', 'municipio', 'Cidade Teste', 'uf', 'SP',
  'tipo_atendimento', 'escuta_inicial')::text);
SELECT e2e.b_guardar('b05_pedido', jsonb_build_object('tipo', 'consulta', 'especialidade', 'Neurologia', 'cbo', '225112', 'procedimento', '0301010072', 'cid', 'G45.9',
  'carater', 'eletivo', 'prioridade', 'prioritaria', 'destino_tipo', 'a_definir',
  'quadro_clinico', 'Episódio de 20 minutos de fala arrastada e dormência na mão esquerda ontem, hoje sem déficit; hipertensa (teste B05).',
  'hipotese', 'Ataque isquêmico transitório')::text);

-- ── 1 a 3. recepção e escuta inicial ────────────────────────────────────────
SELECT e2e.bpasso(NULL, 'B05.01.ficha', 'f5_rec_ubs', '/recepcao (UBS)', 'Recepção abre a ficha de escuta inicial no Consultório 1',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Fala enrolada ontem, hoje sem queixa', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.v('b05_cadastro')), 'ok', 'b05_ep');
SELECT e2e.bpasso('b05_ep', 'B05.01.paciente', 'banco', NULL, 'Paciente e tipo de atendimento da UBS',
  format($q$SELECT paciente_id::text FROM public.episodios WHERE id = %L AND tipo_atendimento_aps = 'escuta_inicial'$q$, e2e.u('b05_ep')), 'ok', 'b05_pac');
SELECT e2e.bpasso('b05_ep', 'B05.02.tecnico', 'f5_tec_ubs', '/escuta', 'Técnico de enfermagem tenta a escuta (deve ser recusado)',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'amarelo', 'consulta')::text$q$, e2e.u('b05_ep')), 'erro:A escuta inicial e a classificação são do enfermeiro');
SELECT e2e.bpasso('b05_ep', 'B05.03.escuta', 'f5_enf_ubs', '/escuta (EscutaInicial)', 'Enfermeira classifica amarelo (escolha da enfermeira de teste), sinais crus, saída consulta',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'amarelo', 'consulta', 'Fala arrastada e dormência na mão esquerda por 20 minutos ontem',
    '{"pressao-arterial-sistolica":162,"pressao-arterial-diastolica":98,"frequencia-cardiaca":78,"frequencia-respiratoria":16,"saturacao-o2":97,"temperatura":36.5,"peso":71,"estatura":160}'::jsonb)::text$q$,
    e2e.u('b05_ep')), 'ok', 'b05_escuta');
SELECT e2e.bpasso('b05_escuta', 'B05.03.escuta_banco', 'banco', NULL, 'Cor da enfermeira, saída consulta, autora = login',
  format($q$SELECT e2e.b_confere(cor = 'amarelo' AND saida_escuta = 'consulta' AND autor_id = 'f5200000-0000-4000-8000-000000000002', 'cor ' || cor || ', saída ' || coalesce(saida_escuta, '?') || ', autora ' || right(autor_id::text, 2))
    FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('b05_escuta')));

-- ── 4 e 5. consulta ─────────────────────────────────────────────────────────
SELECT e2e.bpasso('b05_ep', 'B05.04.iniciar', 'f5_med_ubs', '/atendimento (UBS)', 'Médica abre a consulta',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('b05_ep')));
SELECT e2e.bpasso('b05_ep', 'B05.04.soap', 'f5_med_ubs', '/atendimento (UBS)', 'SOAP com CID G45.9 (ramo da ficha abcd2 escolhido pela médica de teste: consulta especializada regulada)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Fala arrastada e dormência na mão esquerda por 20 min ontem (teste B05)', 'PA 162x98, sem déficit hoje', 'AIT provável', 'Consulta de neurologia pela regulação (decisão pela ficha abcd2, na tela)', 'G45.9')::text$q$,
    e2e.u('b05_ep')));

-- ── 7. regulação de consulta (bordas antes) ─────────────────────────────────
SELECT e2e.bpasso('b05_ep', 'B05.07.sem_cbo', 'f5_med_ubs', '/regulacao (NovaSolicitacao)', 'Consulta sem CBO (deve ser recusado)',
  format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, (%L::jsonb - 'cbo'))::text$q$, 'f5100000-0000-4000-8000-000000000001', e2e.u('b05_pac'), e2e.v('b05_pedido')),
  'erro:Na consulta, informe a especialidade pelo CBO');
-- pede e lê o CID gravado em dois comandos (o detalhe não enxerga a linha inserida no mesmo comando)
CREATE OR REPLACE FUNCTION e2e.b05_cid_gravado(p_unidade uuid, p_pac uuid, p_dados jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  v_id := (public.regulacao_solicitar(p_unidade, p_pac, p_dados) ->> 'id')::uuid;
  RETURN public.regulacao_detalhe(v_id) ->> 'cid';
END $$;
GRANT EXECUTE ON FUNCTION e2e.b05_cid_gravado(uuid, uuid, jsonb) TO authenticated;
SELECT e2e.bpasso('b05_ep', 'B05.07.cid_sem_ponto', 'f5_med_ubs', '/regulacao (NovaSolicitacao)', 'CID sem ponto (G459) é normalizado para G45.9 (desfeito)',
  format($q$SELECT e2e.b_confere(c = 'G45.9', 'gravado ' || coalesce(c, '?')) FROM (SELECT e2e.b05_cid_gravado(%L::uuid, %L::uuid, %L::jsonb || '{"cid":"G459"}'::jsonb) c) z$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('b05_pac'), e2e.v('b05_pedido')),
  'ok', NULL, true);
SELECT e2e.bpasso('b05_ep', 'B05.07.eletivo_emergencia', 'f5_med_ubs', '/regulacao (NovaSolicitacao)', 'Observação: caráter eletivo com prioridade emergência (o CHECK não cruza os dois; desfeito)',
  format($q$SELECT left(public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb || '{"prioridade":"emergencia"}'::jsonb)::text, 120)$q$, 'f5100000-0000-4000-8000-000000000001', e2e.u('b05_pac'), e2e.v('b05_pedido')),
  'registrar', NULL, true);
SELECT e2e.bpasso('b05_ep', 'B05.07.solicitar', 'f5_med_ubs', '/atendimento (Conduta) → /regulacao', 'Pede consulta de Neurologia (CBO 225112), 0301010072, G45.9, eletivo, prioritária',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb || jsonb_build_object('episodio_id', %L)) ->> 'id')$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('b05_pac'), e2e.v('b05_pedido'), e2e.v('b05_ep')), 'ok', 'b05_reg');
SELECT e2e.bpasso('b05_reg', 'B05.07.enviada', 'banco', NULL, 'enviada, modalidade 07, CBO e especialidade gravados',
  format($q$SELECT e2e.b_confere(status = 'enviada' AND modalidade = '07' AND cbo = '225112' AND carater = 'eletivo', 'nº ' || numero || ', modalidade ' || modalidade || ', CBO ' || cbo || ' (' || especialidade || ')')
    FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('b05_reg')));
SELECT e2e.b_guardar('b05_numero', (SELECT numero::text FROM public.regulacao_solicitacoes WHERE id = e2e.u('b05_reg')));
SELECT e2e.bpasso('b05_reg', 'B05.07.lista', 'f5_med_ubs', '/regulacao (Lista)', 'regulacao_lista(UBS) mostra o pedido',
  format($q$SELECT e2e.b_confere(public.regulacao_lista(%L::uuid)::text LIKE '%%' || %L || '%%', 'na lista da UBS')$q$, 'f5100000-0000-4000-8000-000000000001', e2e.v('b05_reg')));

-- ── 8 a 11. teleinterconsulta ───────────────────────────────────────────────
SELECT e2e.bpasso('b05_ep', 'B05.08.tele_na_unidade', 'f5_med_ubs', '/teleinterconsulta', 'Quem está de telemedicina para a UBS',
  $q$SELECT coalesce(string_agg(nome || ' (' || coalesce(situacao, '?') || ', ' || coalesce(setor, '?') || ')', '; '), 'ninguém de telemedicina para a UBS') FROM public.telemedicina_na_unidade('f5100000-0000-4000-8000-000000000001')$q$);
SELECT e2e.bpasso('b05_pac', 'B05.08.pergunta_curta', 'f5_med_ubs', '/teleinterconsulta', 'Pergunta de 9 letras (deve ser recusado)',
  format($q$SELECT public.solicitar_teleinterconsulta(%L::uuid, 'AIT? Faz?', 'obtido', 'rotina', %L::uuid)::text$q$, e2e.u('b05_pac'), e2e.u('b05_ep')), 'erro:Escreva a pergunta');
SELECT e2e.bpasso('b05_pac', 'B05.08.sem_consentimento', 'f5_med_ubs', '/teleinterconsulta', 'Consentimento fora da lista (deve ser recusado)',
  format($q$SELECT public.solicitar_teleinterconsulta(%L::uuid, 'Paciente com AIT provável: antiagregar já na UBS?', 'verbal', 'rotina', %L::uuid)::text$q$, e2e.u('b05_pac'), e2e.u('b05_ep')), 'erro:Registre o consentimento');
SELECT e2e.bpasso('b05_pac', 'B05.08.solicitar', 'f5_med_ubs', '/teleinterconsulta', 'Solicita teleinterconsulta (consentimento obtido, rotina)',
  format($q$SELECT public.solicitar_teleinterconsulta(%L::uuid, 'Paciente com AIT provável; há indicação de antiagregação já na UBS? (teste B05)', 'obtido', 'rotina', %L::uuid)::text$q$,
    e2e.u('b05_pac'), e2e.u('b05_ep')), 'ok', 'b05_tele1');
SELECT e2e.bpasso('b05_tele1', 'B05.08.aberta', 'banco', NULL, 'aberta, com documento clínico assinado pelo login da médica e auditoria',
  format($q$SELECT e2e.b_confere(t.status = 'aberta' AND d.tipo_documento = 'teleinterconsulta' AND d.autor_id = 'f5200000-0000-4000-8000-000000000004',
      'status ' || t.status || ', documento ' || d.tipo_documento || ' nº ' || coalesce(d.numero::text, '?') || ', auditoria ' ||
      (SELECT count(*) FROM public.log_auditoria a WHERE a.entidade_id = t.id))
    FROM public.teleinterconsultas t JOIN public.documentos_clinicos d ON d.id = t.documento_solicitacao_id WHERE t.id = %L$q$, e2e.u('b05_tele1')));
SELECT e2e.bpasso('b05_tele1', 'B05.09.medica_nao_aceita', 'f5_med_ubs', '/teleinterconsulta', 'A médica que pediu tenta aceitar (deve ser recusado)',
  format('SELECT public.aceitar_teleinterconsulta(%L::uuid)::text', e2e.u('b05_tele1')), 'erro');
SELECT e2e.bpasso('b05_tele1', 'B05.10.tele_lista', 'f5_med_ubs', '/teleinterconsulta', 'teleinterconsultas_da_unidade(UBS) lista a aberta',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.teleinterconsultas_da_unidade(%L::uuid, 2) t WHERE t.id = %L::uuid AND t.status = 'aberta'), 'na lista, aberta')$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('b05_tele1')));
SELECT e2e.bpasso('b05_tele1', 'B05.10.tele_aceita', 'f5_tele', '/teleinterconsulta', 'A conta de telemedicina (escalada na UPA) tenta aceitar a teleinterconsulta da UBS',
  format('SELECT public.aceitar_teleinterconsulta(%L::uuid)::text', e2e.u('b05_tele1')), 'ok', 'b05_tele_aceita');
SELECT e2e.bpasso('b05_tele_aceita', 'B05.10.tele_responde', 'f5_tele', '/teleinterconsulta', 'Telemedicina responde (parecer ≥ 20 letras)',
  format($q$SELECT public.responder_teleinterconsulta(%L::uuid, 'Parecer de teste: seguir a ficha abcd2 e o protocolo da unidade (teste de fluxo B05)')::text$q$, e2e.u('b05_tele1')));
SELECT e2e.bpasso('b05_pac', 'B05.11.solicitar_outra', 'f5_med_ubs', '/teleinterconsulta', 'Segunda teleinterconsulta, para provar o cancelamento antes do aceite',
  format($q$SELECT public.solicitar_teleinterconsulta(%L::uuid, 'Segunda pergunta: precisa de exame de imagem antes da consulta? (teste B05)', 'obtido', 'rotina', %L::uuid)::text$q$,
    e2e.u('b05_pac'), e2e.u('b05_ep')), 'ok', 'b05_tele2');
SELECT e2e.bpasso('b05_tele2', 'B05.11.cancelar', 'f5_med_ubs', '/teleinterconsulta', 'A médica cancela antes do aceite',
  format('SELECT public.cancelar_teleinterconsulta(%L::uuid)::text', e2e.u('b05_tele2')), 'ok', 'b05_tele2_cancelada');
SELECT e2e.bpasso('b05_tele2_cancelada', 'B05.11.cancelada', 'banco', NULL, 'Teleinterconsulta cancelada',
  format($q$SELECT e2e.b_confere(status = 'cancelada' AND cancelada_em IS NOT NULL, 'status ' || status) FROM public.teleinterconsultas WHERE id = %L$q$, e2e.u('b05_tele2')));
SELECT e2e.bpasso('b05_tele1', 'B05.11.cancelar_depois_do_aceite', 'f5_med_ubs', '/teleinterconsulta', 'Cancelar a primeira (já aceita ou respondida, se a telemedicina aceitou) (registro)',
  format('SELECT public.cancelar_teleinterconsulta(%L::uuid)::text', e2e.u('b05_tele1')), 'registrar', NULL, true);

-- ── 6/12. conduta da UBS (encerra a consulta) ───────────────────────────────
SELECT e2e.bpasso('b05_ep', 'B05.12.conduta', 'f5_med_ubs', '/atendimento (Conduta)', 'Conduta: hipertensão, G45.9, CIAP K89, encaminhamento especializado; encerra a consulta',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'escuta_inicial', '{hipertensao_arterial}', '{G45.9}', '{encaminhamento_especializado}', 'AIT provável: consulta de neurologia regulada (teste B05)', '{K89}')::text$q$,
    e2e.u('b05_ep')), 'ok', 'b05_conduta');
SELECT e2e.bpasso('b05_conduta', 'B05.12.encerrado', 'banco', NULL, 'Episódio da UBS encerrado; conduta com encaminhamento especializado',
  format($q$SELECT e2e.b_confere(etapa = 'encerrado', 'etapa ' || etapa) FROM public.episodios WHERE id = %L$q$, e2e.u('b05_ep')));
SELECT e2e.bpasso('b05_conduta', 'B05.12.ubs_sem_valor', 'f5_ges_ubs', '/faturamento', 'Nenhuma conta com valor na UBS para a paciente',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND jsonb_array_length(public.conta_detalhe((c ->> 'id')::uuid) -> 'itens') > 0), 'UBS sem item com valor')$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('b05_nome')));
SELECT e2e.bpasso('b05_conduta', 'B05.12.ubs_sem_bpa', 'f5_ges_ubs', '/faturamento (BPA)', 'A UBS não gera linha de BPA',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.bpa_conferencia(%L::uuid, %L) -> 'linhas') x WHERE x ->> 'paciente' = %L), 'UBS sem linha')$q$,
    'f5100000-0000-4000-8000-000000000001', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), e2e.v('b05_nome')));

-- ── 13 a 19. gestor da UBS, central, destino e chegada ──────────────────────
SELECT e2e.bpasso('b05_reg', 'B05.13.gestor_lista', 'f5_ges_ubs', '/regulacao (Lista)', 'Gestor da UBS vê o pedido',
  format($q$SELECT e2e.b_confere(public.regulacao_lista(%L::uuid)::text LIKE '%%' || %L || '%%', 'na lista')$q$, 'f5100000-0000-4000-8000-000000000001', e2e.v('b05_reg')));
SELECT e2e.bpasso('b05_reg', 'B05.13.historico', 'f5_ges_ubs', '/regulacao (Historico)', 'Histórico da paciente',
  format($q$SELECT left(public.regulacao_historico_paciente(%L::uuid)::text, 150)$q$, e2e.u('b05_pac')));
SELECT e2e.bpasso('b05_reg', 'B05.14.fila', 'f5_regulador', '/regulacao (Fila)', 'Pedido na fila da central',
  format($q$SELECT e2e.b_confere(public.regulacao_fila(%L::uuid, '{}'::jsonb)::text LIKE '%%' || %L || '%%', 'na fila')$q$, 'f5100000-0000-4000-8000-000000000009', e2e.v('b05_reg')));
SELECT e2e.bpasso('b05_reg', 'B05.14.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 120)', e2e.u('b05_reg')));
SELECT e2e.bpasso('b05_reg', 'B05.15.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5, sem transporte, previsto +7 dias (ambulatório de neurologia)',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, NULL, now() + interval '7 days', 'ambulatório de neurologia')::text, 120)$q$,
    e2e.u('b05_reg'), 'f5100000-0000-4000-8000-000000000003'), 'ok', 'b05_aut');
SELECT e2e.bpasso('b05_aut', 'B05.15.ubs_nao_aceita', 'f5_med_ubs', '/regulacao', 'A médica da origem tenta aceitar pelo destino (deve ser recusado)',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, NULL, NULL)::text', e2e.u('b05_reg')), 'erro:Responde pelo destino');
SELECT e2e.bpasso('b05_aut', 'B05.16.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Hospital aceita sem leito: quarta-feira 9h, ambulatório',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, NULL, 'quarta-feira 9h, ambulatório (teste B05)')::text, 120)$q$, e2e.u('b05_reg')), 'ok', 'b05_aceita');
SELECT e2e.bpasso('b05_aceita', 'B05.16.sem_reserva', 'banco', NULL, 'autorizada sem reserva; resposta aceita com leito nulo; data prevista gravada',
  format($q$SELECT e2e.b_confere(s.status = 'autorizada' AND s.reserva_id IS NULL AND r.leito_id IS NULL AND r.resposta = 'aceita' AND s.data_prevista IS NOT NULL,
      'status ' || s.status || ', data prevista ' || s.data_prevista || ', observação do aceite ' || coalesce(r.texto, '-'))
    FROM public.regulacao_solicitacoes s JOIN public.regulacao_destino_respostas r ON r.solicitacao_id = s.id WHERE s.id = %L$q$, e2e.u('b05_reg')));
SELECT e2e.bpasso('b05_aceita', 'B05.17.gestor_ve', 'f5_ges_ubs', '/regulacao (Lista)', 'Gestor da UBS vê autorizada, destino e data prevista',
  format($q$SELECT coalesce((SELECT e2e.b_confere(x ->> 'status' = 'autorizada', 'status ' || (x ->> 'status') || ', destino ' || coalesce(x ->> 'destino', x ->> 'destino_nome', '?') || ', data ' || coalesce(x ->> 'data_prevista', '?'))
      FROM jsonb_array_elements(public.regulacao_lista(%L::uuid)) x WHERE x ->> 'id' = %L), e2e.b_falhar('pedido fora da lista'))$q$, 'f5100000-0000-4000-8000-000000000001', e2e.v('b05_reg')));
SELECT e2e.bpasso('b05_aceita', 'B05.18.chegada', 'f5_med_hosp', '/regulacao (destino)', 'No dia: compareceu à consulta (direto de autorizada, sem saída)',
  format($q$SELECT left(public.regulacao_marcar_chegada(%L::uuid, true, 'Compareceu à consulta (teste B05)')::text, 120)$q$, e2e.u('b05_reg')), 'ok', 'b05_chegou');
SELECT e2e.bpasso('b05_chegou', 'B05.18.realizada', 'banco', NULL, 'realizada', e2e.b_status_sql(e2e.u('b05_reg'), 'realizada'));
SELECT e2e.bpasso('b05_chegou', 'B05.19.indicadores', 'f5_ges_upa', '/regulacao (Indicadores)', 'Indicadores da central',
  $q$SELECT left(public.regulacao_indicadores('f5100000-0000-4000-8000-000000000009', '{}')::text, 400)$q$);
SELECT e2e.bpasso('b05_reg', 'B05.99.eventos', 'banco', NULL, 'Um evento por transição, autor = login',
  format($q$SELECT e2e.b_confere(count(*) >= 5, string_agg(ev.evento || ' por ' || coalesce(right(ev.por::text, 2), '?'), ' → ' ORDER BY ev.em, ev.ctid))
    FROM public.regulacao_eventos ev WHERE ev.solicitacao_id = %L$q$, e2e.u('b05_reg')));
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'B05.%' AND em >= e2e.v('b05_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
