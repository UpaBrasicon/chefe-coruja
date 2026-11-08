-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário B06.
-- SLA estourado (só alerta), cobrança do NIR e cancelamento pela origem.
-- Especificação: CENARIOS-B-urgencia-regulacao.md, seção B06.
--
-- O relógio NÃO é mexido: os prazos curtos vêm da RPC do produto
-- (regulacao_definir_prazos, passo 0) e o tempo passa de verdade. Por isso o
-- script roda em QUATRO FASES, sempre o mesmo arquivo; cada execução faz a fase
-- que já está madura e diz quando rodar de novo:
--   fase 1 — prazos curtos, porta, internação na UPA, AIH e o pedido (enviada);
--   fase 2 — depois do prazo da fila (5 min) e de um ciclo do cron (15 min):
--            fila atrasada, aviso reg_prazo_fila_N, assumir e pendência;
--   fase 3 — 1 h depois da pendência: NIR vê e cobra reg_pendencia, avisos de
--            pendência e de evolução, a origem responde, o regulador autoriza;
--   fase 4 — 2 h depois do pedido e 1 h depois da autorização: risco de
--            cancelamento (sem evolução), destino atrasado, evolução, tentativa
--            de cancelamento por quem não pode, cancelamento pela origem,
--            prazos de volta ao padrão, alta e contas.
-- Entre as fases o status só pode mudar pelas pessoas: o prazo só avisa.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas; os
-- resultados ficam em e2e.resultados (passos 'B06.NN.*'). Nada é corrigido no
-- produto. Paciente fictício novo a cada rodada ("Antônio Cardoso Peixoto
-- (teste B06)", depois "... B", "... C"). Dose: só o texto de teste.
--
-- ATENÇÃO: os prazos curtos valem para a Central F5 inteira enquanto o B06 roda
-- (os outros pedidos abertos da central também ganham avisos); a fase 4 devolve
-- os padrões. Se o B06 for abandonado no meio, rodar como gestor da central:
--   regulacao_definir_prazos('f5100000-0000-4000-8000-000000000009', '{}').
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/65_cenario_b06.sql <saida>.sql
--                    npx supabase db query --linked -f <saida>.sql      (4 vezes, nas horas indicadas)
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


-- passo de uma fase: fora da fase desta execução, não faz nada
CREATE OR REPLACE FUNCTION e2e.b06(p_fase int, p_dep text, p_passo text, p_papel text, p_rota text, p_descricao text, p_sql text,
                                  p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL, p_desfazer boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(e2e.v('b06_fase_agora'), '0') <> p_fase::text THEN RETURN NULL; END IF;
  RETURN e2e.bpasso(p_dep, p_passo, p_papel, p_rota, p_descricao, p_sql, p_esperado, p_guardar, p_desfazer);
END $$;
CREATE OR REPLACE FUNCTION e2e.b06_lacuna(p_fase int, p_passo text, p_papel text, p_descricao text, p_detalhe text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(e2e.v('b06_fase_agora'), '0') <> p_fase::text THEN RETURN NULL; END IF;
  RETURN e2e.lacuna(p_passo, 1, p_papel, p_descricao, p_detalhe);
END $$;
-- aviso (notificacoes_plantonista) de um tipo para uma conta, conferido no banco
CREATE OR REPLACE FUNCTION e2e.b06_aviso_sql(p_tipo text, p_perfil text, p_unidade text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format($q$SELECT e2e.b_confere(count(*) = 1, %L || ' para ' || %L || ': ' || count(*) || ' aviso(s) — ' || coalesce(max(mensagem), 'nenhum'))
    FROM public.notificacoes_plantonista WHERE tipo = %L AND perfil_id = %L::uuid AND unidade_id = %L::uuid$q$,
    p_tipo, right(p_perfil, 2), p_tipo, p_perfil, p_unidade)
$$;

-- ── qual fase roda agora ────────────────────────────────────────────────────
SELECT e2e.b_guardar('b06_fase_agora', CASE
  WHEN e2e.v('b06_fase_feita') IS NULL OR e2e.v('b06_fase_feita') = '4' THEN '1'
  WHEN e2e.v('b06_fase_feita') = '1' AND now() >= e2e.v('b06_t2')::timestamptz THEN '2'
  WHEN e2e.v('b06_fase_feita') = '2' AND now() >= e2e.v('b06_t3')::timestamptz THEN '3'
  WHEN e2e.v('b06_fase_feita') = '3' AND now() >= e2e.v('b06_t4')::timestamptz THEN '4'
  ELSE '0' END);
-- rodada nova (fase 1): nome, CNS e ids limpos
SELECT CASE WHEN e2e.v('b06_fase_agora') = '1' THEN e2e.b_guardar('b06_rodada', (coalesce(e2e.v('b06_rodada')::int, 0) + 1)::text) END;
DELETE FROM e2e.vars WHERE e2e.v('b06_fase_agora') = '1' AND nome LIKE 'b06\_%' AND nome NOT IN ('b06_rodada', 'b06_fase_agora');
SELECT CASE WHEN e2e.v('b06_fase_agora') = '1' THEN e2e.b_guardar('b06_inicio', now()::text) END;
SELECT CASE WHEN e2e.v('b06_fase_agora') = '1' THEN e2e.b_guardar('b06_nome',
  'Antônio Cardoso Peixoto (teste B06)' || CASE WHEN e2e.v('b06_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('b06_rodada')::int) ELSE '' END) END;
SELECT CASE WHEN e2e.v('b06_fase_agora') = '1' THEN e2e.b_guardar('b06_cadastro', jsonb_build_object('nome', e2e.v('b06_nome'),
  'data_nascimento', '1947-03-12', 'sexo', 'M', 'raca_cor', 'branca', 'cns', e2e.b_cns(6600 + e2e.v('b06_rodada')::int),
  'nome_mae', 'Mãe Fictícia do Teste B06', 'endereco', 'Rua do Teste, 6', 'municipio', 'Cidade Teste', 'uf', 'SP')::text) END;
SELECT CASE WHEN e2e.v('b06_fase_agora') = '1' THEN e2e.b_guardar('b06_leito_int',
  (SELECT l.id::text FROM public.leitos l WHERE l.setor_id = 'f5300000-0000-4000-8000-000000000013' AND l.status = 'livre' AND l.ativo
    ORDER BY l.identificador DESC LIMIT 1)) END;

-- ═══ FASE 1 ═════════════════════════════════════════════════════════════════
-- ── 0. prazos curtos na central (bordas antes) ──────────────────────────────
SELECT e2e.b06(1, NULL, 'B06.00.nir_nao_define', 'f5_nir', '/regulacao (Criterios / prazos)', 'NIR tenta ajustar os prazos da central (deve ser recusado)',
  $q$SELECT public.regulacao_definir_prazos('f5100000-0000-4000-8000-000000000009', '{"evolucao_h":1,"sem_evolucao_h":2}')::text$q$, 'erro');
SELECT e2e.b06(1, NULL, 'B06.00.sem_evolucao_igual', 'f5_ges_upa', '/regulacao (Criterios / prazos)', 'Sem evolução 1 h com evolução 1 h (deve ser recusado)',
  $q$SELECT public.regulacao_definir_prazos('f5100000-0000-4000-8000-000000000009', '{"evolucao_h":1,"sem_evolucao_h":1}')::text$q$, 'erro:Sem evolução');
SELECT e2e.b06(1, NULL, 'B06.00.fila_fora_da_faixa', 'f5_ges_upa', '/regulacao (Criterios / prazos)', 'Prazo da fila de 0 min (deve ser recusado)',
  $q$SELECT public.regulacao_definir_prazos('f5100000-0000-4000-8000-000000000009', '{"fila":{"urgencia":0}}')::text$q$, 'erro:Prazo da fila');
SELECT e2e.b06(1, NULL, 'B06.00.regulador_define', 'f5_regulador', '/regulacao (Criterios / prazos)', 'O regulador também ajusta os prazos (passa; desfeito)',
  $q$SELECT public.regulacao_definir_prazos('f5100000-0000-4000-8000-000000000009', '{"evolucao_h":1,"sem_evolucao_h":2}')::text$q$, 'ok', NULL, true);
SELECT e2e.b06(1, NULL, 'B06.00.prazos', 'f5_ges_upa', '/regulacao (Criterios / prazos)',
  'Gestor da central grava prazos curtos: fila 1/5/10/30 min, evolução 1 h, pendência 1 h, sem evolução 2 h, destino 1 h',
  $q$SELECT public.regulacao_definir_prazos('f5100000-0000-4000-8000-000000000009',
     '{"fila":{"emergencia":1,"urgencia":5,"prioritaria":10,"eletiva":30},"evolucao_h":1,"pendencia_h":1,"sem_evolucao_h":2,"destino_h":1}')::text$q$, 'ok', 'b06_prazos');
SELECT e2e.b06(1, 'b06_prazos', 'B06.00.historico', 'banco', NULL, 'Histórico com antes/depois e auditoria regulacao_prazos_ajustados',
  $q$SELECT e2e.b_confere(h.depois ->> 'evolucao_h' = '1' AND EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.acao = 'regulacao_prazos_ajustados' AND a.entidade_id = h.id),
      'antes ' || h.antes::text || ' → depois ' || h.depois::text)
    FROM public.regulacao_prazos_historico h WHERE h.central_id = 'f5100000-0000-4000-8000-000000000009' ORDER BY h.em DESC LIMIT 1$q$);
SELECT e2e.b06(1, 'b06_prazos', 'B06.00.prazos_lidos', 'f5_regulador', '/regulacao', 'regulacao_prazos(central) devolve os novos',
  $q$SELECT e2e.b_confere((p ->> 'evolucao_h') = '1' AND (p ->> 'destino_h') = '1', p::text) FROM (SELECT public.regulacao_prazos('f5100000-0000-4000-8000-000000000009') p) x$q$);

-- ── 1 a 3. porta: ficha, classificação laranja, atendimento ─────────────────
SELECT e2e.b06(1, NULL, 'B06.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha no Pronto Socorro (falta de ar e febre)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Falta de ar e febre há três dias', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('b06_cadastro')), 'ok', 'b06_ep');
SELECT e2e.b06(1, 'b06_ep', 'B06.01.paciente', 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('b06_ep')), 'ok', 'b06_pac');
SELECT e2e.b06(1, 'b06_ep', 'B06.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('b06_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.b06(1, 'b06_ep', 'B06.02.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica laranja (escolha da enfermeira de teste), sinais crus, fluxograma "Queixas respiratórias"',
  e2e.b_classificar_sql(e2e.u('b06_ep'), 'f5100000-0000-4000-8000-000000000002', 'laranja',
    '{"frequencia-cardiaca":104,"pressao-arterial-sistolica":136,"pressao-arterial-diastolica":84,"frequencia-respiratoria":28,"saturacao-o2":89,"temperatura":38.2,"escala-dor":2}',
    'Queixas respiratórias', 'Desconforto respiratório com febre (texto da enfermeira de teste)'), 'ok', 'b06_class');
SELECT e2e.b06(1, 'b06_ep', 'B06.03.iniciar', 'f5_med_upa', '/atendimento (JanelaAtendimento)', 'Médico assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('b06_ep')));
SELECT e2e.b06(1, 'b06_ep', 'B06.03.soap', 'f5_med_upa', '/atendimento (AbaAtendimento)', 'SOAP com CID J18.9; conduta conforme curb-65, adulto-pac-antibiotico, adulto-ic-aguda e news2 (na tela)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Falta de ar e febre há 3 dias; IC conhecida (teste B06)', 'FC 104, PA 136x84, FR 28, SatO2 89%%, Tax 38,2', 'Pneumonia comunitária em idoso com IC', 'Internar na UPA e pedir leito clínico (decisão do médico de teste pelas fichas)', 'J18.9')::text$q$,
    e2e.u('b06_ep')));

-- ── 5. prescrição, checagem e internação na UPA ─────────────────────────────
SELECT e2e.b06(1, 'b06_pac', 'B06.05.peso', 'f5_med_upa', '/atendimento (Prescrição → peso)', 'Peso referido 68 kg',
  e2e.b_sinais(e2e.u('b06_pac'), '{"peso":68}', NULL, 'referido'));
SELECT e2e.b06(1, 'b06_pac', 'B06.05.antibiotico', 'f5_med_upa', '/atendimento (Prescrição)', 'Ceftriaxona "Agora" (dose: texto de teste, conforme adulto-pac-antibiotico)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b06_pac'),
    e2e.b_item('bb34963c-8e4f-4b4f-bfee-f4aefa30ac56', 'endovenosa', 'Agora', 'Conforme a ficha adulto-pac-antibiotico (teste de fluxo)')), 'ok', 'b06_item1');
SELECT e2e.b06(1, 'b06_pac', 'B06.05.diuretico', 'f5_med_upa', '/atendimento (Prescrição)', 'Furosemida "Agora" (dose: texto de teste, conforme adulto-ic-aguda)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('b06_pac'),
    e2e.b_item('8c0ce09e-aae6-4469-afa5-d71e19118892', 'endovenosa', 'Agora', 'Conforme a ficha adulto-ic-aguda (teste de fluxo)')), 'ok', 'b06_item2');
SELECT CASE WHEN e2e.v('b06_fase_agora') = '1' THEN e2e.b_guardar('b06_hora', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')) END;
SELECT e2e.b06(1, 'b06_item1', 'B06.05.checar_antibiotico', 'f5_enf_upa', '/checagem', 'Enfermeira apraza e checa "feito" a ceftriaxona',
  format('SELECT public.aprazar(%1$L::uuid, %2$L::text[], NULL)::text || public.checar(%1$L::uuid, %3$L, %4$L, NULL)::text',
    e2e.u('b06_item1'), ARRAY[e2e.v('b06_hora')], 'feito', e2e.v('b06_hora')));
SELECT e2e.b06(1, 'b06_item2', 'B06.05.checar_diuretico', 'f5_enf_upa', '/checagem', 'Enfermeira apraza e checa "feito" a furosemida',
  format('SELECT public.aprazar(%1$L::uuid, %2$L::text[], NULL)::text || public.checar(%1$L::uuid, %3$L, %4$L, NULL)::text',
    e2e.u('b06_item2'), ARRAY[e2e.v('b06_hora')], 'feito', e2e.v('b06_hora')));
SELECT e2e.b06(1, 'b06_ep,b06_leito_int', 'B06.05.internar', 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho internação no leito INT livre da UPA',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', NULL, jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
    e2e.u('b06_ep'), 'f5300000-0000-4000-8000-000000000013', e2e.v('b06_leito_int')));
SELECT e2e.b06(1, 'b06_ep', 'B06.05.internacao', 'banco', NULL, 'Internação aberta pelo desfecho, conta de internação ligada à conta da porta',
  format($q$SELECT i.id::text FROM public.internacoes i JOIN public.episodios e ON e.id = i.episodio_id
    WHERE e.id = %L AND i.internado_em IS NOT NULL AND EXISTS (SELECT 1 FROM public.contas c WHERE c.internacao_id = i.id AND c.tipo = 'internacao' AND c.conta_origem_id IS NOT NULL)$q$,
    e2e.u('b06_ep')), 'ok', 'b06_int');

-- ── 6. internação: admissão, diagnóstico, laudo de AIH ──────────────────────
SELECT e2e.b06(1, 'b06_int', 'B06.06.admissao', 'f5_med_int', '/plantao/internacao (caderno do leito)', 'Médico da internação registra a admissão',
  format($q$SELECT public.registrar_admissao(%L::uuid, 'Admissão de idoso com pneumonia e IC, vindo da porta da UPA (teste B06)',
    '{"subjetivo":"Falta de ar e febre há 3 dias (teste B06)","objetivo":"FR 28, SatO2 89%%, Tax 38,2","cid":"J18.9","plano":"Conduta conforme as fichas (teste de fluxo); pedir leito clínico na regulação"}'::jsonb)::text$q$,
    e2e.u('b06_int')));
SELECT e2e.b06(1, 'b06_int', 'B06.06.diagnostico', 'f5_med_int', '/plantao/internacao', 'Diagnóstico primário J18.9 confirmado',
  format($q$SELECT public.registrar_diagnostico(%L::uuid, 'primario', 'J18.9', 'confirmado', NULL, NULL, NULL)::text$q$, e2e.u('b06_int')));
SELECT e2e.b06(1, 'b06_int', 'B06.06.buscar_sigtap', 'f5_med_int', '/plantao/internacao (laudo AIH)', 'buscar_sigtap(pneumonia) oferece 0303140151',
  $q$SELECT e2e.b_confere(public.buscar_sigtap('pneumonia')::text LIKE '%0303140151%', 'achou 0303140151')$q$);
SELECT e2e.b06(1, 'b06_int', 'B06.06.laudo_aih', 'f5_med_int', '/plantao/internacao (laudo AIH)', 'Laudo de AIH com o procedimento 0303140151',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'laudo_aih', %L) ->> 'id')$q$, e2e.u('b06_pac'),
    jsonb_build_object('aih', jsonb_build_object('sinais', 'Falta de ar, febre, SatO2 89%% (teste B06)', 'condicoes', 'Pneumonia em idoso com IC',
      'diagnostico', 'Pneumonia', 'cid', 'J18.9', 'procCod', '0303140151', 'procDesc', 'TRATAMENTO DE PNEUMONIAS OU INFLUENZA (GRIPE)', 'clinica', 'Clínica médica'))::text),
  'ok', 'b06_laudo');
SELECT e2e.b06(1, 'b06_laudo', 'B06.06.aih', 'banco', NULL, 'AIH solicitada pelo gatilho do laudo',
  format($q$SELECT a.id::text FROM public.aihs a WHERE a.laudo_id = %L AND a.status = 'solicitada'$q$, e2e.u('b06_laudo')), 'ok', 'b06_aih');

-- ── 7. pedido de leito clínico ──────────────────────────────────────────────
SELECT e2e.b06(1, 'b06_int', 'B06.07.solicitar', 'f5_med_int', '/regulacao (NovaSolicitacao)', 'Pede leito clínico: urgência, idoso, SIGTAP do laudo, CID J18.9',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('b06_pac'),
    jsonb_build_object('tipo', 'leito', 'tipo_leito', 'clinico', 'procedimento', '0303140151', 'cid', 'J18.9', 'carater', 'urgencia', 'prioridade', 'urgencia',
      'destino_tipo', 'a_definir', 'vulnerabilidades', jsonb_build_array('idoso'), 'internacao_id', e2e.v('b06_int'),
      'quadro_clinico', 'Idoso de 79 anos com IC e pneumonia, SatO2 89% em ar ambiente, internado na UPA (teste B06).',
      'sinais_vitais', 'FC 104, PA 136x84, FR 28, SatO2 89%, Tax 38,2', 'hipotese', 'Pneumonia comunitária')), 'ok', 'b06_reg');
SELECT e2e.b06(1, 'b06_reg', 'B06.07.enviada', 'banco', NULL, 'enviada, com o relógio da fila em 0 e nada atrasado',
  format($q$SELECT e2e.b_confere(s.status = 'enviada' AND NOT (private.regulacao_sla(s) ->> 'atrasado_central')::boolean,
      'nº ' || s.numero || ', status ' || s.status || ', sla ' || (private.regulacao_sla(s) -> 'fila')::text) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.u('b06_reg')));
SELECT CASE WHEN e2e.v('b06_fase_agora') = '1' AND e2e.v('b06_reg') IS NOT NULL THEN e2e.b_guardar('b06_numero',
  (SELECT numero::text FROM public.regulacao_solicitacoes WHERE id = e2e.u('b06_reg'))) END;
-- fase 2 só depois do prazo da fila (5 min) com folga
SELECT CASE WHEN e2e.v('b06_fase_agora') = '1' THEN e2e.b_guardar('b06_t2', (now() + interval '6 minutes')::text) END;

-- ═══ FASE 2 — fila estourada ════════════════════════════════════════════════
SELECT e2e.b06(2, 'b06_reg', 'B06.08.continua_enviada', 'banco', NULL, 'Ninguém assumiu por mais de 5 min: status continua enviada',
  format($q$SELECT e2e.b_confere(status = 'enviada', 'status ' || status || ' depois de ' || round(extract(epoch FROM now() - criada_em) / 60) || ' min')
    FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('b06_reg')));
SELECT e2e.b06(2, 'b06_reg', 'B06.09.sla_central', 'f5_ges_upa', '/regulacao (SlaRegulacao)', 'Painel de SLA da central: pedido com fila atrasada',
  format($q$SELECT e2e.b_confere(coalesce((x -> 'sla' ->> 'atrasado_central')::boolean, false), 'sla ' || coalesce((x -> 'sla')::text, 'pedido fora do painel'))
    FROM (SELECT (SELECT y FROM jsonb_array_elements(public.regulacao_sla_painel('f5100000-0000-4000-8000-000000000009', '{}') -> 'dados') y WHERE y ->> 'id' = %L) x) z$q$,
    e2e.v('b06_reg')));
SELECT e2e.b06(2, 'b06_numero', 'B06.10.aviso_fila', 'banco', NULL, 'Cron: aviso reg_prazo_fila_N para o regulador da central (ninguém assumiu)',
  e2e.b06_aviso_sql('reg_prazo_fila_' || e2e.v('b06_numero'), 'f5200000-0000-4000-8000-000000000012', 'f5100000-0000-4000-8000-000000000009'));
SELECT e2e.b06(2, 'b06_reg', 'B06.11.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 200)', e2e.u('b06_reg')));
SELECT e2e.b06(2, 'b06_reg', 'B06.11.pendencia', 'f5_regulador', '/regulacao (PainelDecisao)', 'Pendência: gasometria arterial e RX de tórax',
  format($q$SELECT left(public.regulacao_pendencia(%L::uuid, 'Envie gasometria arterial e RX de tórax')::text, 200)$q$, e2e.u('b06_reg')), 'ok', 'b06_pendencia');
SELECT e2e.b06(2, 'b06_pendencia', 'B06.11.pendencia_repetida', 'f5_regulador', '/regulacao (PainelDecisao)', 'Segunda pergunta com a primeira sem resposta (deve ser recusado)',
  format($q$SELECT public.regulacao_pendencia(%L::uuid, 'Outra pergunta de teste B06')::text$q$, e2e.u('b06_reg')), 'erro:Já há uma pergunta');
SELECT e2e.b06(2, 'b06_pendencia', 'B06.11.nir_antes_do_prazo', 'f5_nir', '/nir', 'Antes de 1 h, o NIR não vê reg_pendencia deste pedido',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i
      WHERE i ->> 'ref_id' = %L AND i ->> 'tipo' = 'reg_pendencia'), 'sem reg_pendencia')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('b06_reg')));
SELECT CASE WHEN e2e.v('b06_fase_agora') = '2' THEN e2e.b_guardar('b06_t3', (now() + interval '61 minutes')::text) END;

-- ═══ FASE 3 — pendência e evolução vencidas ═════════════════════════════════
SELECT e2e.b06(3, 'b06_reg', 'B06.12.continua_pendencia', 'banco', NULL, 'Origem não respondeu por mais de 1 h: status continua pendencia',
  format($q$SELECT e2e.b_confere(status = 'pendencia', 'status ' || status || ', pendência há ' || round(extract(epoch FROM now() - pendencia_em) / 60) || ' min')
    FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('b06_reg')));
SELECT e2e.b06(3, 'b06_reg', 'B06.13.nir_ve', 'f5_nir', '/nir', 'NIR vê reg_pendencia ("pergunta da central sem resposta") com os responsáveis',
  format($q$SELECT coalesce((SELECT e2e.b_confere(true, i::text) FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i
      WHERE i ->> 'ref_id' = %L AND i ->> 'tipo' = 'reg_pendencia'), e2e.b_falhar('reg_pendencia não listado'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('b06_reg')));
SELECT e2e.b06(3, 'b06_reg', 'B06.13.nir_resumo', 'f5_nir', '/nir', 'Resumo do NIR: regulação ≥ 1',
  format($q$SELECT e2e.b_confere(coalesce((public.nir_pendencias(%L::uuid) -> 'resumo' ->> 'regulacao')::int, 0) >= 1, (public.nir_pendencias(%L::uuid) -> 'resumo')::text)$q$,
    'f5100000-0000-4000-8000-000000000002', 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.b06(3, 'b06_reg', 'B06.14.cobrar', 'f5_nir', '/nir', 'NIR cobra a pendência (aviso aos responsáveis)',
  format($q$SELECT public.nir_cobrar(%L::uuid, 'reg_pendencia', %L::uuid)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('b06_reg')), 'ok', 'b06_cobrou');
SELECT e2e.b06(3, 'b06_cobrou', 'B06.14.cobranca', 'banco', NULL, 'nir_cobrancas com destinatários e autor = NIR; auditoria nir_cobranca',
  format($q$SELECT e2e.b_confere(c.por = 'f5200000-0000-4000-8000-000000000013' AND EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.acao = 'nir_cobranca' AND a.entidade_id = c.ref_id),
      'destinatários ' || c.destinatarios::text || ', por ' || right(c.por::text, 2)) FROM public.nir_cobrancas c WHERE c.ref_id = %L AND c.tipo = 'reg_pendencia' ORDER BY c.em DESC LIMIT 1$q$,
    e2e.u('b06_reg')));
SELECT e2e.b06(3, 'b06_cobrou', 'B06.15.aviso_cobranca', 'banco', NULL, 'Aviso reg_cobranca_N ao médico da internação',
  e2e.b06_aviso_sql('reg_cobranca_' || e2e.v('b06_numero'), 'f5200000-0000-4000-8000-000000000015', 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.b06(3, 'b06_numero', 'B06.15.aviso_pendencia', 'banco', NULL, 'Cron: aviso reg_prazo_pendencia_N ao médico da internação',
  e2e.b06_aviso_sql('reg_prazo_pendencia_' || e2e.v('b06_numero'), 'f5200000-0000-4000-8000-000000000015', 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.b06(3, 'b06_numero', 'B06.15.aviso_evolucao', 'banco', NULL, 'Cron: aviso reg_prazo_evolucao_N (1 h sem evolução) ao médico da internação',
  e2e.b06_aviso_sql('reg_prazo_evolucao_' || e2e.v('b06_numero'), 'f5200000-0000-4000-8000-000000000015', 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.b06(3, 'b06_reg', 'B06.16.responder', 'f5_med_int', '/regulacao (ResponderPendencia)', 'Origem responde: gasometria e RX anexados',
  format($q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Gasometria e RX de tórax anexados (teste B06)')::text$q$, e2e.u('b06_reg')), 'ok', 'b06_respondeu');
SELECT e2e.b06(3, 'b06_respondeu', 'B06.16.anexar', 'f5_med_int', '/regulacao (AnexosRegulacao)', 'Anexa o laudo de AIH ao pedido (documento do prontuário)',
  format('SELECT public.regulacao_anexar_documento(%L::uuid, %L::uuid)::text', e2e.u('b06_reg'), e2e.u('b06_laudo')));
SELECT e2e.b06(3, 'b06_respondeu', 'B06.16.em_analise', 'banco', NULL, 'Volta a em_analise (estava assumido), evento pendencia_respondida',
  format($q$SELECT e2e.b_confere(s.status = 'em_analise' AND EXISTS (SELECT 1 FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id AND e.evento = 'pendencia_respondida'),
      'status ' || s.status) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.u('b06_reg')));
SELECT e2e.b06(3, 'b06_respondeu', 'B06.16.cobrar_respondida', 'f5_nir', '/nir', 'Cobrar a pendência já respondida (deve ser recusado)',
  format($q$SELECT public.nir_cobrar(%L::uuid, 'reg_pendencia', %L::uuid)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('b06_reg')), 'erro:Esta pendência não está mais em aberto');
SELECT e2e.b06(3, 'b06_respondeu', 'B06.18.nir_evolucao', 'f5_nir', '/nir', 'NIR: reg_pendencia saiu; reg_evolucao ("evolução vencida") aparece',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(x -> 'itens') i WHERE i ->> 'ref_id' = %1$L AND i ->> 'tipo' = 'reg_pendencia')
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(x -> 'itens') i WHERE i ->> 'ref_id' = %1$L AND i ->> 'tipo' = 'reg_evolucao'),
      coalesce((SELECT string_agg(i ->> 'tipo' || ': ' || (i ->> 'titulo'), '; ') FROM jsonb_array_elements(x -> 'itens') i WHERE i ->> 'ref_id' = %1$L), 'nada deste pedido'))
    FROM (SELECT public.nir_pendencias(%2$L::uuid) x) z$q$, e2e.v('b06_reg'), 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.b06(3, 'b06_respondeu', 'B06.21.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5 (ambulância básica); o hospital não vai responder',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_basica', NULL, 'Leito clínico no Hospital F5 (teste B06)')::text, 200)$q$,
    e2e.u('b06_reg'), 'f5100000-0000-4000-8000-000000000003'), 'ok', 'b06_autorizada');
SELECT CASE WHEN e2e.v('b06_fase_agora') = '3' THEN e2e.b_guardar('b06_t4', greatest(
  (SELECT criada_em FROM public.regulacao_solicitacoes WHERE id = e2e.u('b06_reg')) + interval '121 minutes',
  now() + interval '61 minutes')::text) END;

-- ═══ FASE 4 — sem evolução, destino atrasado, cancelamento ══════════════════
SELECT e2e.b06(4, 'b06_reg', 'B06.17.continua', 'banco', NULL, 'Mais de 2 h sem evolução e 1 h sem resposta do destino: status continua aguardando_destino, sem cancelamento por prazo',
  format($q$SELECT e2e.b_confere(status = 'aguardando_destino' AND cancelamento_origem IS NULL, 'status ' || status || ', cancelamento_origem ' || coalesce(cancelamento_origem, 'nulo')
      || ', sem evolução há ' || round(extract(epoch FROM now() - criada_em) / 60) || ' min') FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('b06_reg')));
SELECT e2e.b06(4, 'b06_reg', 'B06.18.risco', 'f5_nir', '/nir', 'NIR: reg_evolucao "(risco de cancelamento)"',
  format($q$SELECT coalesce((SELECT e2e.b_confere(i ->> 'titulo' LIKE '%%risco de cancelamento%%', i ->> 'titulo') FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i
      WHERE i ->> 'ref_id' = %L AND i ->> 'tipo' = 'reg_evolucao'), e2e.b_falhar('reg_evolucao não listado'))$q$, 'f5100000-0000-4000-8000-000000000002', e2e.v('b06_reg')));
SELECT e2e.b06(4, 'b06_numero', 'B06.19.aviso_72h', 'banco', NULL, 'Cron: aviso reg_prazo_72h_N ("a central pode cancelar") ao médico da internação; só aviso',
  e2e.b06_aviso_sql('reg_prazo_72h_' || e2e.v('b06_numero'), 'f5200000-0000-4000-8000-000000000015', 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.b06(4, 'b06_reg', 'B06.23.sla_origem', 'f5_ges_upa', '/regulacao (SlaRegulacao da origem)', 'Painel de SLA da UPA: destino_atrasado ≥ 1 e este pedido atrasado no destino',
  format($q$SELECT e2e.b_confere((p -> 'resumo' ->> 'destino_atrasado')::int >= 1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'dados') y WHERE y ->> 'id' = %L AND (y -> 'sla' ->> 'atrasado_destino')::boolean),
      (p -> 'resumo')::text) FROM (SELECT public.regulacao_sla_painel(%L::uuid, '{}') p) x$q$, e2e.v('b06_reg'), 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.b06(4, 'b06_numero', 'B06.24.aviso_destino_hospital', 'banco', NULL, 'Cron: aviso reg_prazo_destino_N ao médico do hospital (unidade = hospital)',
  e2e.b06_aviso_sql('reg_prazo_destino_' || e2e.v('b06_numero'), 'f5200000-0000-4000-8000-000000000011', 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.b06(4, 'b06_numero', 'B06.24.aviso_destino_gestor_hospital', 'banco', NULL, 'Cron: aviso reg_prazo_destino_N ao gestor do hospital',
  e2e.b06_aviso_sql('reg_prazo_destino_' || e2e.v('b06_numero'), 'f5200000-0000-4000-8000-000000000023', 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.b06(4, 'b06_numero', 'B06.24.aviso_destino_regulador', 'banco', NULL, 'Cron: aviso reg_prazo_destino_N ao regulador que assumiu (unidade = central)',
  e2e.b06_aviso_sql('reg_prazo_destino_' || e2e.v('b06_numero'), 'f5200000-0000-4000-8000-000000000012', 'f5100000-0000-4000-8000-000000000009'));
SELECT e2e.b06(4, 'b06_reg', 'B06.25.nir_upa_sem_destino', 'f5_nir', '/nir', 'O item reg_destino é do hospital: o NIR da UPA não o vê',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i WHERE i ->> 'ref_id' = %L AND i ->> 'tipo' = 'reg_destino'), 'sem reg_destino na UPA')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('b06_reg')));
SELECT e2e.b06(4, 'b06_reg', 'B06.25.gestor_hospital_ve', 'f5_ges_hosp', '/nir (Hospital)', 'O gestor do hospital (o NIR do gestor vale sem escala) vê reg_destino',
  format($q$SELECT coalesce((SELECT e2e.b_confere(true, i::text) FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i
      WHERE i ->> 'ref_id' = %L AND i ->> 'tipo' = 'reg_destino'), e2e.b_falhar('reg_destino não listado no hospital'))$q$, 'f5100000-0000-4000-8000-000000000003', e2e.v('b06_reg')));
SELECT e2e.b06(4, 'b06_reg', 'B06.20.evolucao', 'f5_med_int', '/regulacao (Detalhe)', 'Origem atualiza a evolução (sinais crus)',
  format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Melhora parcial, SatO2 93%% em O2 (teste B06)', 'FC 92, PA 128x80, FR 22, SatO2 93%% em O2 2 L/min')::text$q$, e2e.u('b06_reg')), 'ok', 'b06_evoluiu');
SELECT e2e.b06(4, 'b06_evoluiu', 'B06.20.nir_sem_evolucao', 'f5_nir', '/nir', 'Depois da evolução, reg_evolucao sai do NIR',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i WHERE i ->> 'ref_id' = %L AND i ->> 'tipo' = 'reg_evolucao'), 'sem reg_evolucao')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('b06_reg')));
SELECT e2e.b06(4, 'b06_evoluiu', 'B06.20.aviso_regulador', 'banco', NULL, 'Aviso reg_evolucao_N ao regulador que assumiu',
  e2e.b06_aviso_sql('reg_evolucao_' || e2e.v('b06_numero'), 'f5200000-0000-4000-8000-000000000012', 'f5100000-0000-4000-8000-000000000009'));
SELECT e2e.b06(4, 'b06_reg', 'B06.26.ps_nao_cancela', 'f5_med_upa', '/regulacao (Detalhe)', 'Médico do PS (não solicitou) tenta cancelar (deve ser recusado)',
  format($q$SELECT public.regulacao_cancelar(%L::uuid, 'Paciente melhorou na UPA (teste B06)')::text$q$, e2e.u('b06_reg')), 'erro:Cancela quem solicitou');
SELECT e2e.b06(4, 'b06_reg', 'B06.27.cancelar', 'f5_med_int', '/regulacao (Detalhe)', 'Solicitante cancela: paciente melhorou, mantida a internação na UPA',
  format($q$SELECT public.regulacao_cancelar(%L::uuid, 'Paciente melhorou; mantida a internação na UPA (teste B06)')::text$q$, e2e.u('b06_reg')), 'ok', 'b06_cancelada');
SELECT e2e.b06(4, 'b06_cancelada', 'B06.27.cancelada', 'banco', NULL, 'cancelada, cancelamento_origem = solicitante, evento e auditoria; aviso reg_cancelada ao hospital',
  format($q$SELECT e2e.b_confere(s.status = 'cancelada' AND s.cancelamento_origem = 'solicitante' AND s.reserva_id IS NULL
      AND EXISTS (SELECT 1 FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id AND e.evento = 'cancelada')
      AND EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.acao = 'regulacao_cancelada' AND a.entidade_id = s.id)
      AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.tipo = 'reg_cancelada_' || s.numero AND n.unidade_id = 'f5100000-0000-4000-8000-000000000003'),
      'status ' || s.status || ', origem ' || coalesce(s.cancelamento_origem, '?')) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.u('b06_reg')));
SELECT e2e.b06(4, 'b06_reg', 'B06.28.sla_central', 'f5_ges_upa', '/regulacao (SlaRegulacao)', 'Cancelado sai dos painéis de SLA da central',
  format($q$SELECT e2e.b_confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_sla_painel('f5100000-0000-4000-8000-000000000009', '{}') -> 'dados') y WHERE y ->> 'id' = %L), 'fora do painel')$q$,
    e2e.v('b06_reg')));
SELECT e2e.b06(4, 'b06_reg', 'B06.28.indicadores', 'f5_ges_upa', '/regulacao (Indicadores)', 'Indicadores da central',
  $q$SELECT left(public.regulacao_indicadores('f5100000-0000-4000-8000-000000000009', '{}')::text, 400)$q$);
SELECT e2e.b06(4, 'b06_reg', 'B06.28.tempos', 'banco', NULL, 'Tempo em cada status (regulacao_status_tempos)',
  format($q$SELECT e2e.b_confere(count(*) >= 5, string_agg(status || ' ' || round(extract(epoch FROM coalesce(fim, now()) - inicio) / 60) || ' min', ' → ' ORDER BY inicio))
    FROM public.regulacao_status_tempos WHERE solicitacao_id = %L$q$, e2e.u('b06_reg')));
SELECT e2e.b06(4, 'b06_reg', 'B06.99.eventos', 'banco', NULL, 'Um evento por transição, autor = login',
  format($q$SELECT e2e.b_confere(count(*) >= 6, string_agg(ev.evento || ' por ' || coalesce(right(ev.por::text, 2), '?'), ' → ' ORDER BY ev.em, ev.id))
    FROM public.regulacao_eventos ev WHERE ev.solicitacao_id = %L$q$, e2e.u('b06_reg')));
SELECT e2e.b06(4, 'b06_numero', 'B06.99.sem_duplicar', 'banco', NULL, 'O cron não duplica aviso no mesmo dia (um por pessoa, unidade e tipo)',
  format($q$SELECT e2e.b_confere(coalesce(max(n), 0) <= 1, coalesce(string_agg(tipo || ' x' || n, ', '), 'nenhum'))
    FROM (SELECT tipo, perfil_id, unidade_id, data, count(*) n FROM public.notificacoes_plantonista WHERE tipo LIKE 'reg\_prazo\_%%\_' || %L GROUP BY 1, 2, 3, 4) x$q$,
    e2e.v('b06_numero')));
-- 29. prazos de volta ao padrão
SELECT e2e.b06(4, NULL, 'B06.29.prazos_padrao', 'f5_ges_upa', '/regulacao (Criterios / prazos)', 'Gestor volta aos padrões (12 h, 3 h, 72 h, 24 h; fila nula)',
  $q$SELECT public.regulacao_definir_prazos('f5100000-0000-4000-8000-000000000009', '{}')::text$q$, 'ok', 'b06_prazos_padrao');
SELECT e2e.b06(4, 'b06_prazos_padrao', 'B06.29.historico', 'banco', NULL, 'Histórico guarda a volta',
  $q$SELECT e2e.b_confere(h.depois ->> 'evolucao_h' = '12' AND h.antes ->> 'evolucao_h' = '1', h.antes::text || ' → ' || h.depois::text)
    FROM public.regulacao_prazos_historico h WHERE h.central_id = 'f5100000-0000-4000-8000-000000000009' ORDER BY h.em DESC LIMIT 1$q$);
-- 30 e 31. alta, AIH e contas
SELECT e2e.b06(4, 'b06_int', 'B06.30.alta', 'f5_med_int', '/plantao/internacao (alta)', 'Alta melhorada da internação na UPA',
  format($q$SELECT public.dar_alta(%L::uuid, 'alta_melhorada', 'J18.9', now(), NULL, 'Alta melhorada (teste B06)', '{}'::jsonb)::text$q$, e2e.u('b06_int')), 'ok', 'b06_alta');
SELECT e2e.b06(4, 'b06_aih', 'B06.31.aih', 'f5_regulador', '/aih', 'Regulador aprova a AIH',
  format($q$SELECT public.decidir_aih(%L::uuid, true, %L, %L, NULL)::text$q$, e2e.u('b06_aih'),
    '35261' || lpad(coalesce(e2e.v('b06_numero'), '0'), 8, '0'), to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')), 'ok', 'b06_aih_ok');
SELECT e2e.b06(4, 'b06_ep', 'B06.31.conta_porta', 'f5_fat', '/faturamento/contas', 'Conta da porta (ambulatorial) do paciente',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000002', e2e.v('b06_nome'), 'ambulatorial'), 'ok', 'b06_conta_porta');
SELECT e2e.b06(4, 'b06_int', 'B06.31.conta_int', 'f5_fat', '/faturamento/contas', 'Conta da internação do paciente',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000002', e2e.v('b06_nome'), 'internacao'), 'ok', 'b06_conta_int');
SELECT e2e.b06(4, x.dep || ',b06_alta', 'B06.31.' || x.k || '_conferencia', 'f5_fat', '/faturamento/contas', 'Conta ' || x.k || ': aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 150)', e2e.u(x.dep), 'em_conferencia'))
  FROM (VALUES (1, 'b06_conta_porta', 'porta'), (2, 'b06_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.b06(4, x.dep, 'B06.31.' || x.k || '_custos', 'f5_fat', '/faturamento/contas', 'Custos e pré-auditoria da conta ' || x.k, e2e.b_conta_resumo_sql(e2e.u(x.dep)))
  FROM (VALUES (1, 'b06_conta_porta', 'porta'), (2, 'b06_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.b06(4, x.dep || ',b06_alta', 'B06.31.' || x.k || '_fechar', 'f5_fat', '/faturamento/contas', 'Conta ' || x.k || ': em_conferencia → fechada',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 150)', e2e.u(x.dep), 'fechada'), 'ok', x.dep || '_fechada')
  FROM (VALUES (1, 'b06_conta_porta', 'porta'), (2, 'b06_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
-- pendência bloqueante: o gestor libera e o faturamento fecha
SELECT CASE WHEN e2e.v(x.dep) IS NOT NULL AND e2e.v(x.dep || '_fechada') IS NULL THEN
  e2e.b06(4, x.dep, 'B06.31.' || x.k || '_liberar', 'f5_ges_upa', '/faturamento/contas', 'Gestor libera o fechamento com motivo',
    format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo B06: pendências conhecidas da rede de teste')::text, 200)$q$, e2e.u(x.dep))) END
  FROM (VALUES (1, 'b06_conta_porta', 'porta'), (2, 'b06_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT CASE WHEN e2e.v(x.dep) IS NOT NULL AND e2e.v(x.dep || '_fechada') IS NULL THEN
  e2e.b06(4, x.dep, 'B06.31.' || x.k || '_fechar_liberada', 'f5_fat', '/faturamento/contas', 'Fecha a conta liberada',
    format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 150)', e2e.u(x.dep), 'fechada'), 'ok', x.dep || '_fechada') END
  FROM (VALUES (1, 'b06_conta_porta', 'porta'), (2, 'b06_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.b06(4, 'b06_conta_int_fechada', 'B06.31.congelados', 'banco', NULL, 'Itens congelados nas duas contas (AIH na internação)',
  format($q$SELECT e2e.b_confere((SELECT itens_congelados::text FROM public.contas WHERE id = %1$L) LIKE '%%0303140151%%',
      (SELECT string_agg(c.tipo || ' ' || c.numero || ' ' || c.status || ': ' || coalesce((SELECT string_agg((x ->> 'procedimento') || '=' || coalesce(x ->> 'valor_total', 'nulo'), ', ') FROM jsonb_array_elements(c.itens_congelados) x), '-'), ' | ')
         FROM public.contas c WHERE c.id IN (%1$L, %2$L)))$q$, e2e.u('b06_conta_int'), e2e.u('b06_conta_porta')));

-- ── fim da execução: marca a fase e diz quando rodar de novo ────────────────
SELECT CASE WHEN e2e.v('b06_fase_agora') <> '0' THEN e2e.b_guardar('b06_fase_feita', e2e.v('b06_fase_agora')) END;
SELECT 'B06: fase ' || e2e.v('b06_fase_agora') || ' feita' || CASE e2e.v('b06_fase_feita')
    WHEN '1' THEN '; rodar a fase 2 depois de ' || to_char(e2e.v('b06_t2')::timestamptz AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' e de um ciclo do cron (:00, :15, :30, :45)'
    WHEN '2' THEN '; rodar a fase 3 depois de ' || to_char(e2e.v('b06_t3')::timestamptz AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' e de um ciclo do cron'
    WHEN '3' THEN '; rodar a fase 4 depois de ' || to_char(e2e.v('b06_t4')::timestamptz AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' e de um ciclo do cron'
    ELSE '; cenário completo' END AS situacao
 WHERE e2e.v('b06_fase_agora') <> '0'
UNION ALL
SELECT 'B06: cedo demais para a próxima fase (feita: ' || coalesce(e2e.v('b06_fase_feita'), '-') || ')' WHERE e2e.v('b06_fase_agora') = '0';
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'B06.%' AND em >= e2e.v('b06_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
