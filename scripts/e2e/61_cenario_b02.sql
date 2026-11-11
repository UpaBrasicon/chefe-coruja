-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário B02.
-- AVC: pendência respondida, destino da rede recusa, central nega, novo pedido
-- devolvido e reenviado, autorização para serviço FORA da rede, desfecho
-- transferência na porta. Especificação: CENARIOS-B-urgencia-regulacao.md, B02.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas; os
-- resultados ficam em e2e.resultados (passos 'B02.NN.*'). Nada é corrigido no
-- produto. Conferências do que a tela não mostra rodam como 'banco'.
-- Paciente fictícia nova a cada rodada ("Dalva Rocha Mendonça (teste B02)",
-- depois "... B"). Dose: só o texto de teste. A cor é da enfermeira de teste; o
-- protocolo não tem fluxograma de déficit neurológico, então ela usa "Mal-estar
-- geral" e escreve o discriminador (livre).
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/61_cenario_b02.sql <saida>.sql
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


-- status de um pedido, conferido no banco
CREATE OR REPLACE FUNCTION e2e.b_status_sql(p_reg uuid, p_status text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT format($q$SELECT e2e.b_confere(status = %L, 'nº ' || numero || ' ' || status || coalesce(', destino ' || destino_tipo, '') || coalesce(' / ' || destino_externo, '')
      || ', assumida_por ' || coalesce(right(assumida_por::text, 2), 'nulo')) FROM public.regulacao_solicitacoes WHERE id = %L$q$, p_status, p_reg)
$$;

-- ── rodada ──────────────────────────────────────────────────────────────────
SELECT e2e.b_guardar('b02_rodada', (coalesce(e2e.v('b02_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'b02\_%' AND nome <> 'b02_rodada';
SELECT e2e.b_guardar('b02_inicio', now()::text);
SELECT e2e.b_guardar('b02_nome', 'Dalva Rocha Mendonça (teste B02)' || CASE WHEN e2e.v('b02_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('b02_rodada')::int) ELSE '' END);
SELECT e2e.b_guardar('b02_cadastro', jsonb_build_object('nome', e2e.v('b02_nome'), 'data_nascimento', '1954-02-11', 'sexo', 'F', 'raca_cor', 'branca',
  'cns', e2e.b_cns(6200 + e2e.v('b02_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste B02', 'endereco', 'Rua do Teste, 2', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);

-- ── 1 a 7. porta ────────────────────────────────────────────────────────────
SELECT e2e.bpasso(NULL, 'B02.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha no PS (fraqueza súbita e fala enrolada)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Fraqueza súbita no braço e na perna direitos e fala enrolada há 50 minutos', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('b02_cadastro')), 'ok', 'b02_ep');
SELECT e2e.bpasso('b02_ep', 'B02.01.paciente', 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('b02_ep')), 'ok', 'b02_pac');
SELECT e2e.bpasso('b02_ep', 'B02.01.conta', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial aberta',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000002', e2e.v('b02_nome'), 'ambulatorial'), 'ok', 'b02_conta');
SELECT e2e.bpasso('b02_ep', 'B02.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('b02_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('b02_ep', 'B02.02.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica vermelho (escolha da enfermeira de teste): "Mal-estar geral" com discriminador escrito por ela (não há fluxograma de déficit neurológico)',
  format($q$SELECT public.classificar_risco(%L::uuid, 'vermelho',
    '{"frequencia-cardiaca":92,"pressao-arterial-sistolica":178,"pressao-arterial-diastolica":104,"frequencia-respiratoria":18,"saturacao-o2":96,"temperatura":36.6,"escala-dor":0}'::jsonb,
    (SELECT f.id FROM public.protocolo_fluxogramas f JOIN public.unidades u ON u.protocolo_classificacao_id = f.protocolo_id WHERE u.id = %L AND f.nome = 'Mal-estar geral' AND f.publico = 'adulto'),
    'Déficit neurológico focal súbito há menos de 1 h (texto da enfermeira de teste)', '{"glasgow":"14"}'::jsonb, NULL, NULL, NULL, NULL, false, true)::text$q$,
    e2e.u('b02_ep'), 'f5100000-0000-4000-8000-000000000002'), 'ok', 'b02_class');
SELECT e2e.bpasso('b02_class', 'B02.02.cor_banco', 'banco', NULL, 'Cor, fluxograma e discriminador livre gravados como a enfermeira escolheu',
  format($q$SELECT e2e.b_confere(cor = 'vermelho' AND discriminador_livre AND autor_id = 'f5200000-0000-4000-8000-000000000007',
      'cor ' || cor || ', ' || fluxograma_nome || ', discriminador "' || discriminador || '" (livre)') FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('b02_class')));
SELECT e2e.bpasso('b02_ep', 'B02.03.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('b02_ep')));
SELECT e2e.bpasso('b02_ep', 'B02.03.soap', 'f5_med_upa', '/atendimento', 'SOAP com CID I63.9 e hora do início dos sintomas (decisão pelas fichas adulto-nihss, glasgow e adulto-trombolise-avc, na tela)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Fraqueza à direita e disartria desde 07:40 (teste B02)', 'PA 178x104, Glasgow 14, glicemia capilar 112', 'AVC isquêmico provável em janela', 'UPA sem TC: regulação para serviço com TC e trombólise (teste de fluxo)', 'I63.9')::text$q$,
    e2e.u('b02_ep')));
SELECT e2e.bpasso('b02_ep', 'B02.05.exames', 'f5_med_upa', '/atendimento (Exames)', 'Pede ECG (SIGTAP) e glicemia capilar (nome livre: o grupo 02.14 não é aceito)',
  format($q$SELECT public.pedir_exames(%L::uuid, '[{"procedimento":"0211020036"},{"nome":"Glicemia capilar"}]'::jsonb, 'urgente', 'AVC (teste B02)')::text$q$, e2e.u('b02_ep')), 'ok', 'b02_exames');
SELECT e2e.bpasso('b02_exames', 'B02.05.resultados', 'f5_med_upa', '/atendimento (Exames)', 'Resultados em texto',
  format($q$SELECT string_agg(public.resolver_exame(id, 'Resultado de teste em texto (dado fictício)', NULL)::text || 'ok', ',') FROM unnest(%L::uuid[]) id$q$,
    (SELECT array_agg(id) FROM public.exames_pedidos WHERE episodio_id = e2e.u('b02_ep'))));
SELECT e2e.bpasso('b02_pac', 'B02.06.peso', 'f5_med_upa', '/atendimento (Prescrição → peso)', 'Peso referido 62 kg',
  e2e.b_sinais(e2e.u('b02_pac'), '{"peso":62}', NULL, 'referido'));
SELECT e2e.bpasso('b02_pac', 'B02.06.prescrever', 'f5_med_upa', '/atendimento (Prescrição)', 'Cloreto de sódio 0,9% bolsa "Agora" (medidas gerais; texto de teste, conforme adulto-trombolise-avc)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b02_pac'),
    e2e.b_item('9b38746a-ae39-448c-91c7-68a5c5cb3524', 'endovenosa', 'Agora', 'Medidas gerais conforme a ficha adulto-trombolise-avc (teste de fluxo)')), 'ok', 'b02_item');
SELECT e2e.b_guardar('b02_hora', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));
SELECT e2e.bpasso('b02_item', 'B02.07.checar', 'f5_enf_upa', '/checagem', 'Enfermeira apraza e checa "feito"',
  format('SELECT public.aprazar(%1$L::uuid, %2$L::text[], NULL)::text || public.checar(%1$L::uuid, %3$L, %4$L, NULL)::text',
    e2e.u('b02_item'), ARRAY[e2e.v('b02_hora')], 'feito', e2e.v('b02_hora')));

-- ── 8 a 10. pedido 1 (leito clínico), pendência e resposta ──────────────────
SELECT e2e.bpasso('b02_ep', 'B02.08.pedido1', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Pedido 1: leito clínico, emergência, idoso, 0303040149, I63.9',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('b02_pac'),
    jsonb_build_object('tipo', 'leito', 'tipo_leito', 'clinico', 'procedimento', '0303040149', 'cid', 'I63.9', 'carater', 'urgencia', 'prioridade', 'emergencia',
      'destino_tipo', 'a_definir', 'vulnerabilidades', jsonb_build_array('idoso'), 'episodio_id', e2e.v('b02_ep'),
      'quadro_clinico', 'Idosa de 72 anos com hemiparesia direita e disartria súbitas há 50 minutos (teste B02).')), 'ok', 'b02_n1');
SELECT e2e.bpasso('b02_n1', 'B02.08.n1_enviada', 'banco', NULL, 'N1 enviada, sem aviso de duplicidade', e2e.b_status_sql(e2e.u('b02_n1'), 'enviada'));
SELECT e2e.b_guardar('b02_num1', (SELECT numero::text FROM public.regulacao_solicitacoes WHERE id = e2e.u('b02_n1')));
SELECT e2e.bpasso('b02_n1', 'B02.09.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume N1',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 120)', e2e.u('b02_n1')));
SELECT e2e.bpasso('b02_n1', 'B02.09.pendencia', 'f5_regulador', '/regulacao (PainelDecisao)', 'Pendência: hora exata do ictus, NIHSS e glicemia',
  format($q$SELECT left(public.regulacao_pendencia(%L::uuid, 'Informe hora exata do ictus, NIHSS e glicemia')::text, 120)$q$, e2e.u('b02_n1')), 'ok', 'b02_pend');
SELECT e2e.bpasso('b02_pend', 'B02.09.pendencia_repetida', 'f5_regulador', '/regulacao (PainelDecisao)', 'Segunda pergunta com a primeira sem resposta (deve ser recusado)',
  format($q$SELECT public.regulacao_pendencia(%L::uuid, 'Outra pergunta de teste B02')::text$q$, e2e.u('b02_n1')), 'erro:Já há uma pergunta');
SELECT e2e.bpasso('b02_pend', 'B02.09.aviso', 'banco', NULL, 'Aviso reg_pendencia_N1 ao médico solicitante',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'reg_pendencia_' || %L AND perfil_id = 'f5200000-0000-4000-8000-000000000008'), 'aviso reg_pendencia_' || %L)$q$,
    e2e.v('b02_num1'), e2e.v('b02_num1')));
SELECT e2e.bpasso('b02_pend', 'B02.10.enfermeira_nao_responde', 'f5_enf_upa', '/regulacao (ResponderPendencia)', 'Enfermeira tenta responder a pendência (deve ser recusado)',
  format($q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Resposta da enfermeira (teste)')::text$q$, e2e.u('b02_n1')), 'erro');
SELECT e2e.bpasso('b02_pend', 'B02.10.responder', 'f5_med_upa', '/regulacao (ResponderPendencia)', 'Médico responde: ictus 07:40, NIHSS 9, glicemia 112',
  format($q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Ictus 07:40, NIHSS 9, glicemia 112 (teste B02)')::text$q$, e2e.u('b02_n1')), 'ok', 'b02_resp');
SELECT e2e.bpasso('b02_resp', 'B02.10.em_analise', 'banco', NULL, 'Volta a em_analise (continua com o regulador)', e2e.b_status_sql(e2e.u('b02_n1'), 'em_analise'));
SELECT e2e.bpasso('b02_resp', 'B02.10.aviso_central', 'banco', NULL, 'Aviso reg_resposta_N1 ao regulador, na central',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'reg_resposta_' || %L AND perfil_id = 'f5200000-0000-4000-8000-000000000012' AND unidade_id = 'f5100000-0000-4000-8000-000000000009'), 'aviso reg_resposta_' || %L)$q$,
    e2e.v('b02_num1'), e2e.v('b02_num1')));

-- ── 11 a 13. destino da rede recusa; central nega ───────────────────────────
SELECT e2e.bpasso('b02_resp', 'B02.11.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza N1 para o Hospital F5 (ambulância avançada)',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', NULL, 'Leito clínico (teste B02)')::text, 120)$q$,
    e2e.u('b02_n1'), 'f5100000-0000-4000-8000-000000000003'), 'ok', 'b02_aut1');
SELECT e2e.bpasso('b02_aut1', 'B02.11.aviso_destino', 'banco', NULL, 'Aviso reg_destino_N1 ao hospital',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'reg_destino_' || %L AND unidade_id = 'f5100000-0000-4000-8000-000000000003'), 'aviso reg_destino_' || %L)$q$,
    e2e.v('b02_num1'), e2e.v('b02_num1')));
SELECT e2e.bpasso('b02_aut1', 'B02.14.n2_antes_de_negar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Borda do catálogo: abrir N2 (transferência, outro procedimento) antes de negar N1 daria aviso_duplicidade = true (desfeito)',
  format($q$SELECT e2e.b_confere((x ->> 'aviso_duplicidade')::boolean, x::text) FROM (SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) x) z$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('b02_pac'),
    jsonb_build_object('tipo', 'transferencia', 'transporte', 'ambulancia_avancada', 'procedimento', '0303040300', 'cid', 'I63.9', 'carater', 'urgencia', 'prioridade', 'emergencia',
      'destino_tipo', 'a_definir', 'episodio_id', e2e.v('b02_ep'), 'quadro_clinico', 'AVC isquêmico agudo em janela, precisa de TC e trombólise (teste B02).')), 'ok', NULL, true);
SELECT e2e.bpasso('b02_aut1', 'B02.12.lista_destino', 'f5_med_hosp', '/regulacao (destino)', 'N1 aparece na lista do destino',
  format($q$SELECT e2e.b_confere(public.regulacao_destino_lista(%L::uuid)::text LIKE '%%' || %L || '%%', 'na lista do destino')$q$, 'f5100000-0000-4000-8000-000000000003', e2e.v('b02_n1')));
SELECT e2e.bpasso('b02_aut1', 'B02.12.recusa_curta', 'f5_med_hosp', '/regulacao (destino)', 'Recusa com texto de 9 letras (deve ser recusado)',
  format($q$SELECT public.regulacao_destino_recusar(%L::uuid, 'perfil_incompativel', 'Sem TC ok')::text$q$, e2e.u('b02_n1')), 'erro');
SELECT e2e.bpasso('b02_aut1', 'B02.12.recusar', 'f5_med_hosp', '/regulacao (destino)', 'Hospital recusa: perfil incompatível (sem TC nem trombólise)',
  format($q$SELECT left(public.regulacao_destino_recusar(%L::uuid, 'perfil_incompativel', 'AVC em janela precisa de TC e trombólise; a Clínica Médica não tem')::text, 120)$q$, e2e.u('b02_n1')), 'ok', 'b02_recusou');
SELECT e2e.bpasso('b02_recusou', 'B02.12.volta', 'banco', NULL, 'N1 volta a em_analise (estava assumido), destino a_definir, resposta guardada com CRM',
  format($q$SELECT e2e.b_confere(s.status = 'em_analise' AND s.destino_unidade_id IS NULL AND r.resposta = 'recusada' AND r.motivo = 'perfil_incompativel' AND r.por_registro IS NOT NULL,
      'status ' || s.status || ', destino_tipo ' || coalesce(s.destino_tipo, 'nulo') || ', resposta ' || r.resposta || ' (' || r.motivo || ', registro ' || coalesce(r.por_registro, '?') || ')')
    FROM public.regulacao_solicitacoes s JOIN public.regulacao_destino_respostas r ON r.solicitacao_id = s.id WHERE s.id = %L$q$, e2e.u('b02_n1')));
SELECT e2e.bpasso('b02_recusou', 'B02.12.avisos', 'banco', NULL, 'Avisos reg_destino_recusou_N1 à origem e ao regulador',
  format($q$SELECT e2e.b_confere(count(DISTINCT unidade_id) = 2, count(*) || ' aviso(s) em ' || count(DISTINCT unidade_id) || ' unidade(s)') FROM public.notificacoes_plantonista WHERE tipo = 'reg_destino_recusou_' || %L$q$,
    e2e.v('b02_num1')));
SELECT e2e.bpasso('b02_recusou', 'B02.13.motivo_invalido', 'f5_regulador', '/regulacao (PainelDecisao)', 'Negar com motivo fora da lista (deve ser recusado)',
  format($q$SELECT public.regulacao_negar(%L::uuid, 'sem_leito', 'Motivo fora da lista (teste B02)')::text$q$, e2e.u('b02_n1')), 'erro');
SELECT e2e.bpasso('b02_recusou', 'B02.13.negar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Central nega N1: fora do escopo (refazer como transferência de urgência)',
  format($q$SELECT left(public.regulacao_negar(%L::uuid, 'fora_escopo', 'Leito clínico não atende AVC em janela; refazer como transferência de urgência para serviço com TC')::text, 120)$q$, e2e.u('b02_n1')), 'ok', 'b02_negada');
SELECT e2e.bpasso('b02_negada', 'B02.13.negada', 'banco', NULL, 'negada, auditoria regulacao_negada e aviso reg_negada_N1',
  format($q$SELECT e2e.b_confere(s.status = 'negada' AND EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.acao = 'regulacao_negada' AND a.entidade_id = s.id)
      AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.tipo = 'reg_negada_' || s.numero), 'status ' || s.status) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.u('b02_n1')));

-- ── 14 a 17. pedido 2: devolvido e reenviado ────────────────────────────────
SELECT e2e.bpasso('b02_ep', 'B02.14.sem_transporte', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Transferência sem transporte (deve ser recusado)',
  format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('b02_pac'),
    jsonb_build_object('tipo', 'transferencia', 'procedimento', '0303040300', 'cid', 'I63.9', 'carater', 'urgencia', 'prioridade', 'emergencia',
      'destino_tipo', 'a_definir', 'quadro_clinico', 'AVC isquêmico agudo, precisa de TC e trombólise (teste B02).')), 'erro:Confira o pedido');
SELECT e2e.bpasso('b02_ep', 'B02.14.pedido2', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Pedido 2: transferência de urgência, ambulância avançada, 0303040300, sem a hora do ictus no quadro',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb))::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('b02_pac'),
    jsonb_build_object('tipo', 'transferencia', 'transporte', 'ambulancia_avancada', 'procedimento', '0303040300', 'cid', 'I63.9', 'carater', 'urgencia', 'prioridade', 'emergencia',
      'destino_tipo', 'a_definir', 'episodio_id', e2e.v('b02_ep'), 'quadro_clinico', 'AVC isquêmico agudo em idosa, precisa de TC e trombólise (teste B02).')), 'ok', 'b02_n2_json');
SELECT e2e.b_guardar('b02_n2', e2e.v('b02_n2_json')::jsonb ->> 'id');
SELECT e2e.bpasso('b02_n2', 'B02.14.sem_duplicidade', 'banco', NULL, 'N2 sem aviso de duplicidade (N1 negada); modalidade 04; transporte preenchido',
  format($q$SELECT e2e.b_confere(NOT (%L::jsonb ->> 'aviso_duplicidade')::boolean AND s.modalidade = '04' AND s.transporte = 'ambulancia_avancada', 'nº ' || s.numero || ', aviso ' || (%L::jsonb ->> 'aviso_duplicidade'))
    FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.v('b02_n2_json'), e2e.v('b02_n2_json'), e2e.u('b02_n2')));
SELECT e2e.b_guardar('b02_num2', (SELECT numero::text FROM public.regulacao_solicitacoes WHERE id = e2e.u('b02_n2')));
SELECT e2e.b_guardar('b02_n2_criada', (SELECT criada_em::text FROM public.regulacao_solicitacoes WHERE id = e2e.u('b02_n2')));
SELECT e2e.bpasso('b02_n2', 'B02.15.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume N2',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 120)', e2e.u('b02_n2')));
SELECT e2e.bpasso('b02_n2', 'B02.15.devolver', 'f5_regulador', '/regulacao (PainelDecisao)', 'Devolve: faltam hora do ictus e NIHSS no quadro clínico',
  format($q$SELECT left(public.regulacao_devolver(%L::uuid, 'Faltam hora do ictus e NIHSS no quadro clínico')::text, 120)$q$, e2e.u('b02_n2')), 'ok', 'b02_devolvida');
SELECT e2e.bpasso('b02_devolvida', 'B02.15.devolvida', 'banco', NULL, 'devolvida, assumida_por limpo, aviso reg_devolvida_N2',
  format($q$SELECT e2e.b_confere(s.status = 'devolvida' AND s.assumida_por IS NULL AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.tipo = 'reg_devolvida_' || s.numero),
      'status ' || s.status || ', assumida_por ' || coalesce(s.assumida_por::text, 'nulo')) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.u('b02_n2')));
SELECT e2e.bpasso('b02_devolvida', 'B02.16.nir', 'f5_nir', '/nir', 'NIR: devolução ainda no prazo não aparece como reg_pendencia',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i WHERE i ->> 'ref_id' = %L AND i ->> 'tipo' = 'reg_pendencia'), 'sem reg_pendencia')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('b02_n2')));
SELECT e2e.bpasso('b02_negada', 'B02.17.reenviar_negada', 'f5_med_upa', '/regulacao (Reenviar)', 'Reenviar N1 negada (deve ser recusado: só devolvida)',
  format($q$SELECT public.regulacao_reenviar(%L::uuid, '{"prioridade":"emergencia"}'::jsonb)::text$q$, e2e.u('b02_n1')), 'erro:Só se reenvia');
SELECT e2e.bpasso('b02_devolvida', 'B02.17.reenviar', 'f5_med_upa', '/regulacao (Reenviar)', 'Reenvia N2 com ictus 07:40 e NIHSS 9',
  format($q$SELECT public.regulacao_reenviar(%L::uuid, '{"quadro_clinico":"AVC isquêmico agudo: ictus 07:40, NIHSS 9, glicemia 112; precisa de TC e trombólise (teste B02).","prioridade":"emergencia"}'::jsonb)::text$q$,
    e2e.u('b02_n2')), 'ok', 'b02_reenviada');
SELECT e2e.bpasso('b02_reenviada', 'B02.17.posicao', 'banco', NULL, 'enviada; criada_em inalterado (posição na fila); reenviada_em preenchido; evento reenviada com os campos',
  format($q$SELECT e2e.b_confere(s.status = 'enviada' AND s.criada_em = %L::timestamptz AND s.reenviada_em IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id AND e.evento = 'reenviada'),
      'status ' || s.status || ', campos ' || coalesce((SELECT (e.detalhes -> 'campos')::text FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id AND e.evento = 'reenviada'), '?'))
    FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.v('b02_n2_criada'), e2e.u('b02_n2')));
SELECT e2e.bpasso('b02_reenviada', 'B02.17.auditoria', 'banco', NULL, 'Auditoria regulacao_reenviada',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.acao = 'regulacao_reenviada' AND a.entidade_id = %L), 'auditoria regulacao_reenviada')$q$, e2e.u('b02_n2')));

-- ── 18 a 22. autorização para fora da rede, desfecho, saída e chegada ───────
SELECT e2e.bpasso('b02_reenviada', 'B02.18.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume N2 de novo',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 120)', e2e.u('b02_n2')));
SELECT e2e.bpasso('b02_reenviada', 'B02.18.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para hospital com unidade de AVC (fora da rede), previsto +1 h',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'externo', NULL, 'Hospital com unidade de AVC (fora da rede)', 'ambulancia_avancada', now() + interval '1 hour', 'Trombólise no destino (teste B02)')::text, 120)$q$,
    e2e.u('b02_n2')), 'ok', 'b02_aut2');
SELECT e2e.bpasso('b02_aut2', 'B02.19.resposta_externa', 'f5_regulador', '/regulacao (Detalhe)', 'Aceite do serviço de fora (neurologista de plantão, telefone)',
  format($q$SELECT left(public.regulacao_registrar_resposta_externa(%L::uuid, true, 'neurologista de plantão', 'telefone')::text, 120)$q$, e2e.u('b02_n2')), 'ok', 'b02_aceita');
SELECT e2e.bpasso('b02_aceita', 'B02.19.autorizada', 'banco', NULL, 'autorizada (destino externo)', e2e.b_status_sql(e2e.u('b02_n2'), 'autorizada'));
SELECT e2e.bpasso('b02_ep,b02_pac', 'B02.20.doc_transferencia', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico emite o documento de transferência (lacuna 7: sem ele a transferência externa é recusada)',
  format($q$SELECT left(public.emitir_documento_transferencia(%L::uuid, jsonb_build_object('resumo_clinico', 'Resumo clínico de teste (B02, dado fictício).', 'condutas', 'Condutas de teste conforme o roteiro (B02, dado fictício).', 'motivo', 'Trombólise em hospital com unidade de AVC pela regulação (teste B02).'))::text, 120)$q$, e2e.u('b02_pac')));
SELECT e2e.bpasso('b02_ep', 'B02.20.desfecho', 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho transferência na porta (sem esperar a chegada)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'transferencia', 'Transferida ao hospital com unidade de AVC pela regulação (teste B02)', '{"destino":"Hospital com unidade de AVC (fora da rede)"}'::jsonb)::text$q$,
    e2e.u('b02_ep')), 'ok', 'b02_desfecho');
SELECT e2e.bpasso('b02_desfecho', 'B02.20.encerrado', 'banco', NULL, 'Episódio encerrado por transferência',
  format($q$SELECT e2e.b_confere(etapa = 'encerrado' AND desfecho = 'transferencia', 'etapa ' || etapa || ', desfecho ' || coalesce(desfecho, '?')) FROM public.episodios WHERE id = %L$q$, e2e.u('b02_ep')));
SELECT e2e.bpasso('b02_aceita', 'B02.21.saida', 'f5_nir', '/regulacao (Detalhe)', 'NIR marca a saída (em trânsito)',
  format('SELECT left(public.regulacao_marcar_saida(%L::uuid)::text, 120)', e2e.u('b02_n2')), 'ok', 'b02_saiu');
SELECT e2e.bpasso('b02_saiu', 'B02.22.chegada', 'f5_regulador', '/regulacao (Detalhe)', 'A central marca a chegada (realizada)',
  format($q$SELECT left(public.regulacao_marcar_chegada(%L::uuid, true, 'Chegou ao hospital com unidade de AVC (teste B02)')::text, 120)$q$, e2e.u('b02_n2')), 'ok', 'b02_chegou');
SELECT e2e.bpasso('b02_chegou', 'B02.22.historico', 'f5_med_upa', '/regulacao (Historico)', 'Histórico do paciente: N1 negada e N2 realizada',
  format($q$SELECT e2e.b_confere(h::text LIKE '%%' || %L || '%%' AND h::text LIKE '%%' || %L || '%%' AND h::text LIKE '%%negada%%' AND h::text LIKE '%%realizada%%', 'N1 e N2 no histórico')
    FROM (SELECT public.regulacao_historico_paciente(%L::uuid) h) x$q$, e2e.v('b02_n1'), e2e.v('b02_n2'), e2e.u('b02_pac')));
SELECT e2e.bpasso('b02_chegou', 'B02.23.indicadores', 'f5_ges_upa', '/regulacao (Indicadores)', 'Indicadores da central',
  $q$SELECT left(public.regulacao_indicadores('f5100000-0000-4000-8000-000000000009', '{}')::text, 400)$q$);

-- ── 24. conta da porta ──────────────────────────────────────────────────────
SELECT e2e.bpasso('b02_conta', 'B02.24.conferencia', 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('b02_conta'), 'em_conferencia'));
SELECT e2e.bpasso('b02_conta', 'B02.24.custos', 'f5_fat', '/faturamento/contas', 'Custos e pré-auditoria', e2e.b_conta_resumo_sql(e2e.u('b02_conta')));
SELECT e2e.bpasso('b02_conta', 'B02.24.fechar', 'f5_fat', '/faturamento/contas', 'em_conferencia → fechada',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('b02_conta'), 'fechada'), 'ok', 'b02_fechada');
SELECT e2e.bpasso('b02_fechada', 'B02.24.congelados', 'banco', NULL, 'Itens congelados',
  format($q$SELECT e2e.b_confere(itens_congelados IS NOT NULL, coalesce((SELECT string_agg((x ->> 'procedimento') || '=' || coalesce(x ->> 'valor_total', 'nulo'), ', ') FROM jsonb_array_elements(itens_congelados) x), '-'))
    FROM public.contas WHERE id = %L$q$, e2e.u('b02_conta')));
SELECT e2e.bpasso(x.dep, 'B02.99.eventos_' || x.k, 'banco', NULL, 'Eventos do ' || x.k || ' (só inserção), autor = login',
  format($q$SELECT e2e.b_confere(count(*) >= 3, string_agg(ev.evento || ' por ' || coalesce(right(ev.por::text, 2), '?'), ' → ' ORDER BY ev.em, ev.ctid))
    FROM public.regulacao_eventos ev WHERE ev.solicitacao_id = %L$q$, e2e.u(x.dep)))
  FROM (VALUES (1, 'b02_n1', 'pedido1'), (2, 'b02_n2', 'pedido2')) x(o, dep, k) ORDER BY x.o;
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'B02.%' AND em >= e2e.v('b02_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
