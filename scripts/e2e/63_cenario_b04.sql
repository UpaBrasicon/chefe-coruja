-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário B04.
-- Trauma sem documento: pedido recusado sem CNS/CPF e aceito como "paciente não
-- identificado"; aceite do hospital com leito reservado; saída; o destino
-- registra que o paciente NÃO chegou (falta), a reserva é liberada e nada mais
-- muda o status. Especificação: CENARIOS-B-urgencia-regulacao.md, seção B04.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas; os
-- resultados ficam em e2e.resultados (passos 'B04.NN.*'). Nada é corrigido no
-- produto. Paciente fictício novo a cada rodada ("Rogério Lins Albuquerque
-- (teste B04)", depois "... B"), aberto SEM CNS e SEM CPF; o CNS fictício entra
-- depois pela recepção (como se a família trouxesse).
-- Leito reservado no hospital: o primeiro livre da UTI Adulto (UTI-*), que o
-- "não chegou" devolve a livre no mesmo passo.
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/63_cenario_b04.sql <saida>.sql
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
SELECT e2e.b_guardar('b04_rodada', (coalesce(e2e.v('b04_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'b04\_%' AND nome <> 'b04_rodada';
SELECT e2e.b_guardar('b04_inicio', now()::text);
SELECT e2e.b_guardar('b04_nome', 'Rogério Lins Albuquerque (teste B04)' || CASE WHEN e2e.v('b04_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('b04_rodada')::int) ELSE '' END);
-- sem CNS e sem CPF na chegada
SELECT e2e.b_guardar('b04_cadastro', jsonb_build_object('nome', e2e.v('b04_nome'), 'data_nascimento', '1992-08-15', 'sexo', 'M', 'raca_cor', 'parda',
  'nome_mae', 'Mãe Fictícia do Teste B04', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.b_guardar('b04_leito', (SELECT l.id::text FROM public.leitos l WHERE l.setor_id = 'f5300000-0000-4000-8000-000000000022' AND l.status = 'livre' AND l.ativo
  ORDER BY l.identificador LIMIT 1));

-- ── 1 a 7. porta ────────────────────────────────────────────────────────────
SELECT e2e.bpasso(NULL, 'B04.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha no PS sem CNS e sem CPF (queda de moto)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Queda de moto, trazido por terceiros', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('b04_cadastro')), 'ok', 'b04_ep');
SELECT e2e.bpasso('b04_ep', 'B04.01.paciente', 'banco', NULL, 'Paciente sem CNS e sem CPF',
  format($q$SELECT p.id::text FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id WHERE e.id = %L AND p.cns IS NULL AND p.cpf IS NULL$q$, e2e.u('b04_ep')), 'ok', 'b04_pac');
SELECT e2e.bpasso('b04_ep', 'B04.01.conta', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial aberta',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000002', e2e.v('b04_nome'), 'ambulatorial'), 'ok', 'b04_conta');
SELECT e2e.bpasso('b04_ep', 'B04.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('b04_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('b04_ep', 'B04.02.classificar', 'f5_enf_upa', '/triagem (Classificar)', 'Classifica vermelho (escolha da enfermeira de teste), "Politraumas", Glasgow 13, dor 7/10',
  e2e.b_classificar_sql(e2e.u('b04_ep'), 'f5100000-0000-4000-8000-000000000002', 'vermelho',
    '{"frequencia-cardiaca":128,"pressao-arterial-sistolica":92,"pressao-arterial-diastolica":60,"frequencia-respiratoria":24,"saturacao-o2":94,"temperatura":36.5,"escala-dor":7}',
    'Politraumas', 'Politrauma com choque compensado (texto da enfermeira de teste)', '{"glasgow":"13"}'), 'ok', 'b04_class');
SELECT e2e.bpasso('b04_ep', 'B04.03.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('b04_ep')));
SELECT e2e.bpasso('b04_ep', 'B04.03.soap', 'f5_med_upa', '/atendimento', 'SOAP com CID S06.9 (decisão pelas fichas de trauma do adulto, na tela)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Queda de moto, sem documento (teste B04)', 'FC 128, PA 92x60, Glasgow 13 (O3 V4 M6)', 'TCE e politrauma', 'Conduta pelas fichas adulto-trauma-inicial e escores; transferência (teste de fluxo)', 'S06.9')::text$q$,
    e2e.u('b04_ep')));
SELECT e2e.bpasso('b04_ep', 'B04.05.exames', 'f5_med_upa', '/atendimento (Exames)', 'Pede hemograma, RX de tórax (SIGTAP) e tipagem sanguínea (nome livre)',
  -- laboratório e imagem em pedidos separados (RT, 10/11/2026)
  format($q$SELECT (public.pedir_exames(%1$L::uuid, '[{"procedimento":"0202020380"},{"nome":"Tipagem sanguínea ABO/Rh","grupo":"laboratorio"}]'::jsonb, 'urgente', 'Trauma (teste B04)')
                 + public.pedir_exames(%1$L::uuid, '[{"procedimento":"0204030153"}]'::jsonb, 'urgente', 'Trauma (teste B04)'))::text$q$,
    e2e.u('b04_ep')), 'ok', 'b04_exames');
SELECT e2e.bpasso('b04_exames', 'B04.05.resultados', 'f5_med_upa', '/atendimento (Exames)', 'Resultados em texto',
  format($q$SELECT string_agg(public.resolver_exame(id, 'Resultado de teste em texto (dado fictício)', NULL)::text || 'ok', ',') FROM unnest(%L::uuid[]) id$q$,
    (SELECT array_agg(id) FROM public.exames_pedidos WHERE episodio_id = e2e.u('b04_ep'))));
SELECT e2e.bpasso('b04_pac', 'B04.06.peso', 'f5_med_upa', '/atendimento (Prescrição → peso)', 'Peso ESTIMADO 75 kg',
  e2e.b_sinais(e2e.u('b04_pac'), '{"peso":75}', NULL, 'estimado'));
SELECT e2e.bpasso('b04_pac', 'B04.06.volume', 'f5_med_upa', '/atendimento (Prescrição)', 'Ringer com lactato "Agora" (texto de teste, conforme adulto-trauma-inicial); peso estimado aceito',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b04_pac'),
    e2e.b_item('07b3c28e-88be-41a7-b22b-de9cb7e9111d', 'endovenosa', 'Agora', 'Conforme a ficha adulto-trauma-inicial (teste de fluxo)')), 'ok', 'b04_item_vol');
SELECT e2e.bpasso('b04_pac', 'B04.06.analgesia', 'f5_med_upa', '/atendimento (Prescrição)', 'Morfina (alta vigilância) "Agora" (texto de teste, conforme adulto-trauma-inicial)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b04_pac'),
    e2e.b_item('1df1791f-39e8-4f69-bef8-b22fb64bd570', 'endovenosa', 'Agora', 'Conforme a ficha adulto-trauma-inicial (teste de fluxo)')), 'ok', 'b04_item_mor');
SELECT e2e.bpasso('b04_item_mor', 'B04.07.validar', 'f5_farm', '/farmacia', 'Farmacêutico valida a morfina (alta vigilância)',
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('b04_item_mor')));
SELECT e2e.b_guardar('b04_hora', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));
SELECT e2e.bpasso(x.dep, 'B04.07.checar_' || x.k, 'f5_enf_upa', '/checagem', 'Enfermeira apraza e checa "feito": ' || x.k,
  format('SELECT public.aprazar(%1$L::uuid, %2$L::text[], NULL)::text || public.checar(%1$L::uuid, %3$L, %4$L, NULL)::text',
    e2e.u(x.dep), ARRAY[e2e.v('b04_hora')], 'feito', e2e.v('b04_hora')))
  FROM (VALUES (1, 'b04_item_vol', 'volume'), (2, 'b04_item_mor', 'analgesia')) x(o, dep, k) ORDER BY x.o;

-- ── 8 a 11. pedido sem documento, autorização e aceite com leito ────────────
SELECT e2e.b_guardar('b04_pedido', jsonb_build_object('tipo', 'transferencia', 'tipo_leito', 'clinico', 'transporte', 'ambulancia_avancada', 'procedimento', '0303040106',
  'cid', 'S06.9', 'carater', 'urgencia', 'prioridade', 'emergencia', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('b04_ep'),
  'quadro_clinico', 'Politrauma por queda de moto com TCE, Glasgow 13 e choque compensado (teste B04).')::text);
SELECT e2e.bpasso('b04_pac', 'B04.08.sem_documento', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Pedido sem CNS/CPF e sem a marca de não identificado (deve ser recusado)',
  format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('b04_pac'), e2e.v('b04_pedido')),
  'erro:O paciente está sem CNS e sem CPF');
SELECT e2e.bpasso('b04_pac', 'B04.09.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Repete com paciente_nao_identificado = true',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb || '{"paciente_nao_identificado":true}'::jsonb) ->> 'id')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b04_pac'), e2e.v('b04_pedido')), 'ok', 'b04_reg');
SELECT e2e.bpasso('b04_reg', 'B04.09.marca', 'banco', NULL, 'enviada com paciente_nao_identificado = true',
  format($q$SELECT e2e.b_confere(status = 'enviada' AND paciente_nao_identificado, 'nº ' || numero || ', ' || status || ', não identificado ' || paciente_nao_identificado) FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('b04_reg')));
SELECT e2e.b_guardar('b04_numero', (SELECT numero::text FROM public.regulacao_solicitacoes WHERE id = e2e.u('b04_reg')));
SELECT e2e.bpasso('b04_reg', 'B04.10.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 120)', e2e.u('b04_reg')));
SELECT e2e.bpasso('b04_reg', 'B04.10.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5, ambulância avançada, previsto +1 h',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', now() + interval '1 hour', 'Trauma (teste B04)')::text, 120)$q$,
    e2e.u('b04_reg'), 'f5100000-0000-4000-8000-000000000003'), 'ok', 'b04_aut');
SELECT e2e.bpasso('b04_aut', 'B04.10.saida_antes_do_aceite', 'f5_nir', '/regulacao (Detalhe)', 'Marcar a saída antes do aceite do destino (deve ser recusado)',
  format('SELECT public.regulacao_marcar_saida(%L::uuid)::text', e2e.u('b04_reg')), 'erro:Só sai o paciente');
SELECT e2e.bpasso('b04_aut,b04_leito', 'B04.11.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Hospital aceita e reserva um leito da UTI',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, %L::uuid, 'Aceito (teste B04)')::text, 120)$q$, e2e.u('b04_reg'), e2e.u('b04_leito')), 'ok', 'b04_aceita');
SELECT e2e.bpasso('b04_aceita', 'B04.11.reserva', 'banco', NULL, 'autorizada; leito reservado; evento de reserva',
  format($q$SELECT e2e.b_confere(s.status = 'autorizada' AND l.status = 'reservado' AND EXISTS (SELECT 1 FROM public.eventos_leito e WHERE e.leito_id = l.id AND e.tipo_evento = 'reserva' AND e.motivo LIKE '%%' || s.numero || '%%'),
      'status ' || s.status || ', leito ' || l.identificador || ' ' || l.status || ', reserva até ' || r.expira_em)
    FROM public.regulacao_solicitacoes s JOIN public.reservas_leito r ON r.id = s.reserva_id JOIN public.leitos l ON l.id = r.leito_id WHERE s.id = %L$q$, e2e.u('b04_reg')));

-- ── 12 a 16. cadastro completado, desfecho, saída e "não chegou" ────────────
SELECT e2e.bpasso('b04_pac', 'B04.12.cns', 'f5_rec_upa', '/recepcao (cadastro)', 'Recepção completa o cadastro com o CNS trazido pela família',
  format($q$SELECT left(public.salvar_cadastro_paciente(%L::uuid, %L::jsonb, %L::uuid, false)::text, 120)$q$, e2e.u('b04_pac'),
    e2e.v('b04_cadastro')::jsonb || jsonb_build_object('cns', e2e.b_cns(6400 + e2e.v('b04_rodada')::int)), 'f5300000-0000-4000-8000-000000000011'), 'ok', 'b04_cns');
SELECT e2e.bpasso('b04_cns', 'B04.12.marca_mantida', 'banco', NULL, 'Paciente com CNS; o pedido guarda paciente_nao_identificado = true (histórico)',
  format($q$SELECT e2e.b_confere(p.cns IS NOT NULL AND s.paciente_nao_identificado, 'CNS ' || p.cns || ', pedido não identificado ' || s.paciente_nao_identificado)
    FROM public.regulacao_solicitacoes s JOIN public.pacientes p ON p.id = s.paciente_id WHERE s.id = %L$q$, e2e.u('b04_reg')));
SELECT e2e.bpasso('b04_ep,b04_pac', 'B04.13.doc_transferencia', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico emite o documento de transferência (lacuna 7: sem ele a transferência externa é recusada)',
  format($q$SELECT left(public.emitir_documento_transferencia(%L::uuid, jsonb_build_object('resumo_clinico', 'Resumo clínico de teste (B04, dado fictício).', 'condutas', 'Condutas de teste conforme o roteiro (B04, dado fictício).', 'motivo', 'Leito clínico no Hospital F5 pela regulação (teste B04).'))::text, 120)$q$, e2e.u('b04_pac')));
SELECT e2e.bpasso('b04_ep', 'B04.13.desfecho', 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho transferência SEM relato (o relato só é exigido em evasão, alta a pedido e óbito)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'transferencia', NULL, '{"destino":"Hospital Fase 5"}'::jsonb)::text$q$, e2e.u('b04_ep')), 'ok', 'b04_desfecho');
SELECT e2e.bpasso('b04_aceita', 'B04.14.saida', 'f5_nir', '/regulacao (Detalhe)', 'NIR marca a saída (em trânsito)',
  format('SELECT left(public.regulacao_marcar_saida(%L::uuid)::text, 120)', e2e.u('b04_reg')), 'ok', 'b04_saiu');
SELECT e2e.bpasso('b04_saiu', 'B04.14.aviso_saiu', 'banco', NULL, 'Aviso reg_saiu_N ao hospital',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'reg_saiu_' || %L AND unidade_id = 'f5100000-0000-4000-8000-000000000003'), 'aviso reg_saiu_' || %L)$q$,
    e2e.v('b04_numero'), e2e.v('b04_numero')));
SELECT e2e.bpasso('b04_saiu', 'B04.15.nir_upa', 'f5_nir', '/nir', 'O item reg_chegada é do destino: o NIR da UPA não o vê',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i WHERE i ->> 'ref_id' = %L AND i ->> 'tipo' = 'reg_chegada'), 'sem reg_chegada na UPA')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('b04_reg')));
SELECT e2e.bpasso('b04_saiu', 'B04.15.gestor_hospital', 'f5_ges_hosp', '/nir (Hospital)', 'O gestor do hospital vê reg_chegada ("paciente a caminho sem registro de chegada")',
  format($q$SELECT coalesce((SELECT e2e.b_confere(true, i ->> 'titulo') FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i WHERE i ->> 'ref_id' = %L AND i ->> 'tipo' = 'reg_chegada'),
      e2e.b_falhar('reg_chegada não listado no hospital'))$q$, 'f5100000-0000-4000-8000-000000000003', e2e.v('b04_reg')));
SELECT e2e.bpasso('b04_saiu', 'B04.16.obs_curta', 'f5_med_hosp', '/regulacao (destino)', '"Não chegou" com observação de 8 letras (deve ser recusado)',
  format($q$SELECT public.regulacao_marcar_chegada(%L::uuid, false, 'não veio')::text$q$, e2e.u('b04_reg')), 'erro:Escreva o que aconteceu');
SELECT e2e.bpasso('b04_saiu', 'B04.16.nao_chegou', 'f5_med_hosp', '/regulacao (destino)', 'Hospital registra que o paciente não chegou (desviado pelo SAMU)',
  format($q$SELECT left(public.regulacao_marcar_chegada(%L::uuid, false, 'Ambulância desviada pelo SAMU para hospital de trauma fora da rede')::text, 120)$q$, e2e.u('b04_reg')), 'ok', 'b04_falta');
SELECT e2e.bpasso('b04_falta', 'B04.16.falta', 'banco', NULL, 'falta; falta_em; reserva liberada e leito livre; evento de leito; aviso reg_nao_chegou_N à origem',
  format($q$SELECT e2e.b_confere(s.status = 'falta' AND s.falta_em IS NOT NULL AND r.situacao <> 'ativa' AND l.status = 'livre'
      AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.tipo = 'reg_nao_chegou_' || s.numero AND n.unidade_id = 'f5100000-0000-4000-8000-000000000002'),
      'status ' || s.status || ', reserva ' || r.situacao || coalesce(' (' || r.motivo_encerramento || ')', '') || ', leito ' || l.identificador || ' ' || l.status
      || ', eventos do leito: ' || (SELECT string_agg(e.tipo_evento || ' ' || e.status_antes || '→' || e.status_depois, ', ' ORDER BY e.ctid) FROM public.eventos_leito e WHERE e.leito_id = l.id AND e.motivo LIKE '%%' || s.numero || '%%'))
    FROM public.regulacao_solicitacoes s JOIN public.reservas_leito r ON r.id = s.reserva_id JOIN public.leitos l ON l.id = r.leito_id WHERE s.id = %L$q$, e2e.u('b04_reg')));

-- ── 17 e 18. depois de "falta", nada muda o status ──────────────────────────
SELECT e2e.bpasso('b04_falta', 'B04.17.cancelar', 'f5_med_upa', '/regulacao (Detalhe)', 'Origem tenta cancelar depois da falta (deve ser recusado)',
  format($q$SELECT public.regulacao_cancelar(%L::uuid, 'Paciente foi a outro serviço (teste B04)')::text$q$, e2e.u('b04_reg')), 'erro:Esta solicitação não pode mais ser cancelada');
SELECT e2e.bpasso('b04_falta', 'B04.17.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Destino tenta aceitar depois da falta (deve ser recusado)',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, NULL, NULL)::text', e2e.u('b04_reg')), 'erro');
SELECT e2e.bpasso('b04_falta', 'B04.17.saida', 'f5_nir', '/regulacao (Detalhe)', 'NIR tenta marcar a saída depois da falta (deve ser recusado)',
  format('SELECT public.regulacao_marcar_saida(%L::uuid)::text', e2e.u('b04_reg')), 'erro');
SELECT e2e.bpasso('b04_falta', 'B04.18.indicadores', 'f5_ges_upa', '/regulacao (Indicadores)', 'Indicadores da central (falta contabilizada)',
  $q$SELECT left(public.regulacao_indicadores('f5100000-0000-4000-8000-000000000009', '{}')::text, 500)$q$);

-- ── 19. conta da porta ──────────────────────────────────────────────────────
SELECT e2e.bpasso('b04_conta', 'B04.19.conferencia', 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('b04_conta'), 'em_conferencia'));
SELECT e2e.bpasso('b04_conta', 'B04.19.custos', 'f5_fat', '/faturamento/contas', 'Custos e pré-auditoria (CNS já completado)', e2e.b_conta_resumo_sql(e2e.u('b04_conta')));
SELECT e2e.bpasso('b04_conta', 'B04.19.fechar', 'f5_fat', '/faturamento/contas', 'em_conferencia → fechada',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('b04_conta'), 'fechada'), 'ok', 'b04_fechada');
SELECT e2e.bpasso('b04_reg', 'B04.99.eventos', 'banco', NULL, 'Um evento por transição, autor = login',
  format($q$SELECT e2e.b_confere(count(*) >= 5, string_agg(ev.evento || ' por ' || coalesce(right(ev.por::text, 2), '?'), ' → ' ORDER BY ev.em, ev.ctid))
    FROM public.regulacao_eventos ev WHERE ev.solicitacao_id = %L$q$, e2e.u('b04_reg')));
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'B04.%' AND em >= e2e.v('b04_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
