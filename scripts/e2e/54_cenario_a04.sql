-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário A04.
-- Duas crianças no mesmo plantão: 13a 11m 29d (Luan) e 14a 0d (Bia) — o corte
-- de idade. Especificação: CENARIOS-A, seção A04.
--
-- Datas de nascimento calculadas NA RODADA, pelo dia civil de Brasília
-- (private.data_atual()): Luan = hoje − 14 anos + 1 dia; Bia = hoje − 14 anos.
-- O script inteiro roda numa transação só, então o dia não vira no meio.
-- Cada passo roda COMO a conta do papel (RLS ligado); resultado em
-- e2e.resultados (passos 'A04.NN.*', paciente = 4). Nada é corrigido no produto.
-- Prescrição SEM dose de memória: dose = 'conforme protocolo — dado fictício de
-- teste de fluxo'; o item cita a ficha (ped-bolus para Luan; a ficha de adulto
-- de dor e analgesia para Bia). A cor é a escolha da enfermeira de teste.
-- O Fugulin da internação usa o enfermeiro.internacao.f5 do 49a.
--
-- Rodar antes: 41_checkin_fase5.sql (e, uma vez, 49a_ambiente_bloco_a.sql).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/54_cenario_a04.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── apoio do roteiro (mesmo corpo do 50; recriados aqui) ────────────────────
CREATE OR REPLACE FUNCTION e2e.confere(p boolean, p_msg text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p IS NOT TRUE THEN RAISE EXCEPTION 'confere: %', p_msg; END IF;
  RETURN 'ok: ' || p_msg;
END $$;
GRANT EXECUTE ON FUNCTION e2e.confere(boolean, text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.falhar(p text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '%', p; END $$;
GRANT EXECUTE ON FUNCTION e2e.falhar(text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.guardar(p_nome text, p_valor text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO e2e.vars VALUES (p_nome, p_valor) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor
$$;
CREATE OR REPLACE FUNCTION e2e.cns(p_n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
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

-- ── apoio do bloco A (A02 a A06; mesmo corpo nos scripts 52 a 56) ──────────
-- sinais vitais crus como a tela grava (sincronizar_registros), com o método do peso
CREATE OR REPLACE FUNCTION e2e.ba_sinais(p_pac uuid, p_sinais jsonb, p_internacao uuid DEFAULT NULL, p_metodo text DEFAULT NULL)
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT format($q$SELECT CASE WHEN bool_and(x ->> 'status' = 'gravado') THEN count(*)::text || ' sinais gravados'
                             ELSE e2e.falhar(string_agg(coalesce(x ->> 'motivo', x::text), '; ')) END
                     FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)::jsonb) x$q$,
    (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'observacao', 'hora', now(), 'sem_conexao', false,
              'aparelho_id', 'e2e-bloco-a',
              'dados', jsonb_build_object('paciente_id', p_pac, 'internacao_id', p_internacao,
                         'conceito_id', (SELECT c.id FROM public.conceito c WHERE c.nome = k.key AND c.unidade_id IS NULL),
                         'valor_num', k.value, 'origem', 'manual', 'metodo', p_metodo)))
       FROM jsonb_each(p_sinais) k))
$$;
-- conferência no banco, como postgres (o que a tela não mostra)
CREATE OR REPLACE FUNCTION e2e.ba_banco(p_n int, p_passo text, p_descricao text, p_sql text, p_guardar text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; v_sit text; v_det text;
BEGIN
  BEGIN
    EXECUTE p_sql INTO r;
    IF p_guardar IS NOT NULL THEN
      IF r IS NULL THEN RAISE EXCEPTION 'nenhuma linha'; END IF;
      PERFORM e2e.guardar(p_guardar, r);
    END IF;
    v_sit := 'ok'; v_det := left(r, 400);
  EXCEPTION WHEN OTHERS THEN
    v_sit := 'falha'; v_det := SQLSTATE || ': ' || SQLERRM;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, 'banco', NULL, p_descricao, 'ok', v_sit, v_det);
  RETURN v_sit || ' — ' || p_passo || ' — ' || coalesce(v_det, '');
END $$;
-- passo que depende de ids de passos anteriores (lista separada por vírgula):
-- sem algum deles, vira lacuna "bloqueado pelo passo X"
CREATE OR REPLACE FUNCTION e2e.ba(p_n int, p_dep text, p_dep_passo text, p_passo text, p_papel text, p_rota text, p_descricao text,
                                 p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE d text;
BEGIN
  FOREACH d IN ARRAY string_to_array(coalesce(p_dep, ''), ',') LOOP
    IF btrim(d) <> '' AND e2e.v(btrim(d)) IS NULL THEN
      RETURN e2e.lacuna(p_passo, p_n, p_papel, p_descricao, 'bloqueado pelo passo ' || p_dep_passo || ' (sem ' || btrim(d) || ')');
    END IF;
  END LOOP;
  IF p_papel = 'banco' THEN RETURN e2e.ba_banco(p_n, p_passo, p_descricao, p_sql, p_guardar); END IF;
  RETURN e2e.ba_passo(p_passo, p_n, p_papel, p_rota, p_descricao, p_sql, p_esperado, p_guardar);
END $$;
-- ajuste de ambiente (datas, prazo) que não derruba a rodada se falhar
CREATE OR REPLACE FUNCTION e2e.ba_ajuste(p_n int, p_passo text, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_sql IS NULL THEN
    RETURN e2e.lacuna(p_passo, p_n, NULL, p_descricao, 'bloqueado: faltou o id de um passo anterior');
  END IF;
  BEGIN
    EXECUTE p_sql;
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe) VALUES (p_passo, p_n, p_descricao, 'ajuste', 'ajuste', left(p_sql, 400));
    RETURN 'ajuste — ' || p_passo;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe) VALUES (p_passo, p_n, p_descricao, 'ajuste', 'falha', 'ajuste recusado: ' || SQLERRM);
    RETURN 'falha — ' || p_passo;
  END;
END $$;
-- passo só de registro: roda como o papel, guarda "aceito" ou "recusado" e desfaz o que fez
CREATE OR REPLACE FUNCTION e2e.ba_registra(p_n int, p_passo text, p_papel text, p_rota text, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_det text;
BEGIN
  IF p_sql IS NULL THEN RETURN e2e.lacuna(p_passo, p_n, p_papel, p_descricao, 'bloqueado: faltou o id de um passo anterior'); END IF;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta_a(p_papel), 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE p_sql;
    PERFORM set_config('role', 'postgres', true);
    RAISE EXCEPTION 'e2e_desfazer';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    v_det := CASE WHEN SQLERRM = 'e2e_desfazer' THEN 'ACEITO (a ação foi desfeita para não mudar o cenário)' ELSE 'RECUSADO: ' || SQLERRM END;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, p_papel, p_rota, p_descricao, 'registrar', 'ok', v_det);
  RETURN 'registrado — ' || p_passo || ' — ' || v_det;
END $$;
-- SQL que leva um episódio da UBS (e os sinais de agora) para o passado
CREATE OR REPLACE FUNCTION e2e.ba_sql_passado(p_ep uuid, p_pac uuid, p_dias int) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_ep IS NULL OR p_pac IS NULL THEN NULL ELSE
    format($q$UPDATE public.episodios SET chegada_em = chegada_em - %1$L::interval,
                     atendimento_iniciado_em = atendimento_iniciado_em - %1$L::interval,
                     classificado_em = classificado_em - %1$L::interval, desfecho_em = desfecho_em - %1$L::interval,
                     encerrado_em = encerrado_em - %1$L::interval WHERE id = %2$L;
                   UPDATE public.observacao SET aferido_em = aferido_em - %1$L::interval
                    WHERE paciente_id = %3$L AND aferido_em >= now() - interval '1 minute'$q$,
           p_dias || ' days', p_ep, p_pac) END
$$;
-- contas do bloco A: as do framework (47) mais as três do 49a
CREATE OR REPLACE FUNCTION e2e.conta_a(p_papel text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_papel
    WHEN 'f5_med_obsped' THEN 'f5200000-0000-4000-8000-0000000000a1'::uuid
    WHEN 'f5_enf_obsped' THEN 'f5200000-0000-4000-8000-0000000000a2'::uuid
    WHEN 'f5_enf_int'    THEN 'f5200000-0000-4000-8000-0000000000a3'::uuid
    ELSE e2e.conta(p_papel) END
$$;
-- e2e.passo do 04 com as contas do bloco A (e2e.conta_a); o e2e.passo do 04 não é tocado
CREATE OR REPLACE FUNCTION e2e.ba_passo(p_passo text, p_paciente int, p_papel text, p_rota text, p_descricao text,
                                    p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_resultado text; v_situacao text; v_detalhe text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta_a(p_papel), 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE p_sql INTO v_resultado;
    PERFORM set_config('role', 'postgres', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'ok'; v_detalhe := left(v_resultado, 400);
      IF p_guardar IS NOT NULL THEN
        INSERT INTO e2e.vars VALUES (p_guardar, v_resultado) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor;
      END IF;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'PASSOU sem erro (deveria ser recusado): ' || left(coalesce(v_resultado, ''), 300);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'falha'; v_detalhe := SQLSTATE || ': ' || SQLERRM;
    ELSIF p_esperado = 'erro' OR SQLERRM LIKE substr(p_esperado, 6) || '%' THEN
      v_situacao := 'ok'; v_detalhe := 'recusado: ' || SQLERRM;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'recusado com outra mensagem: ' || SQLERRM;
    END IF;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_paciente, p_papel, p_rota, p_descricao, p_esperado, v_situacao, v_detalhe);
  RETURN v_situacao || ' — ' || p_passo || ' — ' || coalesce(v_detalhe, '');
END $$;

-- ── rodada: nomes e nascimentos ─────────────────────────────────────────────
SELECT e2e.guardar('a04_rodada', (coalesce(e2e.v('a04_rodada')::int, 0) + 1)::text);
SELECT e2e.guardar('a04_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'a04\_%' AND nome NOT IN ('a04_rodada', 'a04_inicio');
SELECT e2e.guardar('a04_sufixo', CASE WHEN e2e.v('a04_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('a04_rodada')::int) ELSE '' END);
SELECT e2e.guardar('a04_hoje', private.data_atual()::text);
SELECT e2e.guardar('a04_nomeL', 'Luan A04 Teste' || e2e.v('a04_sufixo'));
SELECT e2e.guardar('a04_nomeB', 'Bia A04 Teste' || e2e.v('a04_sufixo'));
SELECT e2e.guardar('a04_nascL', ((private.data_atual() - interval '14 years')::date + 1)::text);
SELECT e2e.guardar('a04_nascB', (private.data_atual() - interval '14 years')::date::text);
SELECT e2e.guardar('a04_cadL', jsonb_build_object('nome', e2e.v('a04_nomeL'), 'data_nascimento', e2e.v('a04_nascL'), 'sexo', 'M', 'raca_cor', 'branca',
  'cns', e2e.cns(70400 + 10 * e2e.v('a04_rodada')::int + 1), 'nome_mae', 'Mãe Fictícia de Luan A04', 'responsavel_nome', 'Pai Fictício de Luan A04',
  'responsavel_parentesco', 'pai', 'endereco', 'Rua do Teste, 4', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.guardar('a04_cadB', jsonb_build_object('nome', e2e.v('a04_nomeB'), 'data_nascimento', e2e.v('a04_nascB'), 'sexo', 'F', 'raca_cor', 'parda',
  'cns', e2e.cns(70400 + 10 * e2e.v('a04_rodada')::int + 2), 'nome_mae', 'Mãe Fictícia de Bia A04', 'responsavel_nome', 'Mãe Fictícia de Bia A04',
  'responsavel_parentesco', 'mãe', 'endereco', 'Rua do Teste, 40', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);

-- rodada anterior parada no atendimento do PS (rodada 1: sem leito livre na
-- Internação, a internação não abriu) é encerrada com alta pelo médico da porta
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT e.id FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
            WHERE e.unidade_id = 'f5100000-0000-4000-8000-000000000002' AND (p.nome LIKE 'Luan A04 Teste%' OR p.nome LIKE 'Bia A04 Teste%')
              AND p.nome NOT IN (e2e.v('a04_nomeL'), e2e.v('a04_nomeB')) AND e.etapa = 'atendimento' LOOP
    PERFORM e2e.ba_passo('A04.00.encerra_anterior_exame', 4, 'f5_med_upa', '/exames', 'Rodada anterior: resultado do exame pendente (a alta da porta exige)',
      format($q$SELECT string_agg(public.resolver_exame(x.id, 'Sem fratura (laudo fictício de teste A04)', NULL)::text, ',') FROM public.exames_pedidos x WHERE x.episodio_id = %L AND x.situacao IN ('pedido', 'coletado', 'em_analise', 'realizado')$q$, r.id));
    PERFORM e2e.ba_passo('A04.00.encerra_anterior_alta', 4, 'f5_med_upa', '/atendimento (Desfecho)', 'Rodada anterior: alta do paciente parado no atendimento',
      format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', 'Encerramento da rodada anterior do teste A04', '{}'::jsonb)::text$q$, r.id));
  END LOOP;
END $$;

-- ── 1. recepção: duas fichas no PS ──────────────────────────────────────────
SELECT e2e.ba_passo('A04.01.ficha_luan', 4, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Ficha de Luan (13a 11m 29d): queda de bicicleta, TCE leve e dor no punho',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Queda de bicicleta, bateu a cabeça e dor no punho', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('a04_cadL')), 'ok', 'a04_epL');
SELECT e2e.ba_passo('A04.01.ficha_bia', 4, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Ficha de Bia (14a 0d): a mesma queixa',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Queda de bicicleta, bateu a cabeça e dor no punho', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('a04_cadB')), 'ok', 'a04_epB');
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.01.paciente_luan', 'banco', NULL, 'Paciente Luan', format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a04_epL')), 'ok', 'a04_pacL');
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.01.paciente_bia', 'banco', NULL, 'Paciente Bia', format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a04_epB')), 'ok', 'a04_pacB');
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.01.conta_luan', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial de Luan aberta',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' AND c ->> 'status' = 'aberta' LIMIT 1), e2e.falhar('conta não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a04_nomeL')), 'ok', 'a04_contaL');
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.01.conta_bia', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial de Bia aberta',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' AND c ->> 'status' = 'aberta' LIMIT 1), e2e.falhar('conta não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a04_nomeB')), 'ok', 'a04_contaB');

-- ── 2. triagem de Luan: grupo pediátrico ────────────────────────────────────
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.02.chamar_luan', 'f5_enf_upa', '/triagem (Fila)', 'Chama Luan',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('a04_epL'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.02.luan_fluxo_adulto', 'f5_enf_upa', '/triagem (Classificar)', 'Fluxograma adulto "Politraumas" para Luan (deve ser recusado)',
  format($q$SELECT public.classificar_risco(%L::uuid, 'amarelo', '{"frequencia-cardiaca":96}'::jsonb, %L::uuid, 'Trauma (teste)', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true)::text$q$,
    e2e.u('a04_epL'), 'd7773908-bf4a-48ee-8b08-db1493fc62b7'), 'erro:Fluxograma de outro público');
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.02.classificar_luan', 'f5_enf_upa', '/triagem (Classificar)',
  'Fluxograma pediátrico "Trauma e quedas", sinais crus; a enfermeira de teste classifica amarelo',
  format($q$SELECT public.classificar_risco(%L::uuid, 'amarelo', '{"frequencia-cardiaca":96,"frequencia-respiratoria":20,"temperatura":36.6,"saturacao-o2":98,"escala-dor":6,"pressao-arterial-sistolica":112,"pressao-arterial-diastolica":70}'::jsonb,
    %L::uuid, %L, '{}'::jsonb, NULL, NULL, NULL, 'Queda de bicicleta com TCE leve', false, %L::boolean)::text$q$,
    e2e.u('a04_epL'), 'f256f26e-2c52-4618-919e-de8d1e0c8f64',
    coalesce(e2e.disc('f5100000-0000-4000-8000-000000000002', 'f256f26e-2c52-4618-919e-de8d1e0c8f64', 'amarelo'), 'TCE leve com dor moderada (livre, teste A04)'),
    (e2e.disc('f5100000-0000-4000-8000-000000000002', 'f256f26e-2c52-4618-919e-de8d1e0c8f64', 'amarelo') IS NULL)::text), 'ok', 'a04_classL');
SELECT e2e.ba(4, 'a04_classL', 'A04.02.classificar_luan', 'A04.02.grupo_luan', 'banco', NULL, 'Luan: grupo pediátrico pela idade; cor da enfermeira',
  format($q$SELECT e2e.confere(cor = 'amarelo' AND publico = 'pediatrico' AND publico_pela_idade = 'pediatrico', 'cor ' || cor || ', público ' || publico || ', pela idade ' || coalesce(publico_pela_idade, '?'))
    FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('a04_classL')));

-- ── 3. triagem de Bia: grupo adulto ─────────────────────────────────────────
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.03.chamar_bia', 'f5_enf_upa', '/triagem (Fila)', 'Chama Bia',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('a04_epB'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.03.bia_fluxo_pediatrico', 'f5_enf_upa', '/triagem (Classificar)', 'Fluxograma pediátrico "Trauma e quedas" para Bia (deve ser recusado)',
  format($q$SELECT public.classificar_risco(%L::uuid, 'amarelo', '{"frequencia-cardiaca":92}'::jsonb, %L::uuid, 'Trauma (teste)', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true)::text$q$,
    e2e.u('a04_epB'), 'f256f26e-2c52-4618-919e-de8d1e0c8f64'), 'erro:Fluxograma de outro público');
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.03.classificar_bia', 'f5_enf_upa', '/triagem (Classificar)',
  'Fluxograma adulto "Politraumas", mesma queixa; a enfermeira de teste classifica amarelo',
  format($q$SELECT public.classificar_risco(%L::uuid, 'amarelo', '{"frequencia-cardiaca":92,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":6,"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":74}'::jsonb,
    %L::uuid, %L, '{}'::jsonb, NULL, NULL, NULL, 'Queda de bicicleta com TCE leve', false, %L::boolean)::text$q$,
    e2e.u('a04_epB'), 'd7773908-bf4a-48ee-8b08-db1493fc62b7',
    coalesce(e2e.disc('f5100000-0000-4000-8000-000000000002', 'd7773908-bf4a-48ee-8b08-db1493fc62b7', 'amarelo'), 'TCE leve com dor moderada (livre, teste A04)'),
    (e2e.disc('f5100000-0000-4000-8000-000000000002', 'd7773908-bf4a-48ee-8b08-db1493fc62b7', 'amarelo') IS NULL)::text), 'ok', 'a04_classB');
SELECT e2e.ba(4, 'a04_classB', 'A04.03.classificar_bia', 'A04.03.grupo_bia', 'banco', NULL, 'Bia: grupo adulto pela idade; cor da enfermeira',
  format($q$SELECT e2e.confere(cor = 'amarelo' AND publico = 'adulto' AND publico_pela_idade = 'adulto', 'cor ' || cor || ', público ' || publico || ', pela idade ' || coalesce(publico_pela_idade, '?'))
    FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('a04_classB')));

-- ── 4 e 5. médico: assume, peso aferido, SOAP ───────────────────────────────
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.04.iniciar_luan', 'f5_med_upa', '/atendimento (Luan)', 'Médico assume Luan', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a04_epL')));
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.05.iniciar_bia', 'f5_med_upa', '/atendimento (Bia)', 'Médico assume Bia', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a04_epB')));
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.B.reclassificar_luan', 'f5_enf_upa', '/triagem', 'Enfermagem tenta reclassificar Luan depois que o médico assumiu (deve ser recusado)',
  format($q$SELECT public.classificar_risco(%L::uuid, 'verde', '{"frequencia-cardiaca":90}'::jsonb, NULL, NULL, '{}'::jsonb, NULL, 'Reclassificação de teste depois do médico')::text$q$, e2e.u('a04_epL')),
  'erro:O atendimento médico já começou');
SELECT e2e.ba(4, 'a04_pacL', 'A04.01.paciente_luan', 'A04.B.sem_peso_luan', 'f5_med_upa', '/atendimento (Prescrição)', 'Prescrever para Luan antes do peso (deve ser recusado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a04_pacL'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '1df1791f-39e8-4f69-bef8-b22fb64bd570', 'dose', 'conforme protocolo — dado fictício de teste de fluxo', 'via', 'endovenosa', 'posologia', 'Agora')),
  'erro:Falta para prescrever');
SELECT e2e.ba(4, 'a04_pacB', 'A04.01.paciente_bia', 'A04.B.sem_peso_bia', 'f5_med_upa', '/atendimento (Prescrição)', 'Prescrever para Bia antes do peso (deve ser recusado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a04_pacB'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '00bc3daf-b7e5-4410-99d4-2c7301dd1922', 'dose', 'conforme protocolo — dado fictício de teste de fluxo', 'via', 'endovenosa', 'posologia', 'Agora')),
  'erro:Falta para prescrever');
SELECT e2e.ba(4, 'a04_pacL', 'A04.01.paciente_luan', 'A04.04.peso_luan', 'f5_med_upa', '/atendimento (peso)', 'Peso aferido de Luan', e2e.ba_sinais(e2e.u('a04_pacL'), '{"peso":48}', NULL, 'aferido'));
SELECT e2e.ba(4, 'a04_pacB', 'A04.01.paciente_bia', 'A04.05.peso_bia', 'f5_med_upa', '/atendimento (peso)', 'Peso aferido de Bia', e2e.ba_sinais(e2e.u('a04_pacB'), '{"peso":52}', NULL, 'aferido'));
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.04.soap_luan', 'f5_med_upa', '/atendimento (Luan)', 'SOAP de Luan com CID de TCE (S06.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Queda de bicicleta, bateu a cabeça, dor no punho (teste A04)', 'Glasgow pela ficha ped-glasgow-icr na tela; punho com dor', 'TCE leve', 'Conduta pelas fichas pediátricas (PECARN 2 anos ou mais) — teste de fluxo', 'S06.0')::text$q$, e2e.u('a04_epL')));
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.05.soap_bia', 'f5_med_upa', '/atendimento (Bia)', 'SOAP de Bia com CID de TCE (S06.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Queda de bicicleta, bateu a cabeça, dor no punho (teste A04)', 'Glasgow pela ficha glasgow na tela; punho com dor', 'TCE leve', 'Conduta pelas fichas de adulto (Canadian CT Head) — teste de fluxo', 'S06.0')::text$q$, e2e.u('a04_epB')));

-- ── 6 e 7. prescrição pela ficha do público de cada um ──────────────────────
SELECT e2e.ba(4, 'a04_pacL', 'A04.01.paciente_luan', 'A04.06.prescricao_luan', 'f5_med_upa', '/atendimento (Prescrição Luan)',
  'Analgesia de Luan conforme a ficha pediátrica ped-bolus (Morfina — IV/IM, ICr Apêndice); dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a04_pacL'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '1df1791f-39e8-4f69-bef8-b22fb64bd570', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora', 'observacao', 'Conforme a ferramenta pediátrica ped-bolus (ICr Apêndice), peso aferido — teste de fluxo')),
  'ok', 'a04_itemL');
SELECT e2e.ba(4, 'a04_pacB', 'A04.01.paciente_bia', 'A04.07.prescricao_bia', 'f5_med_upa', '/atendimento (Prescrição Bia)',
  'Analgesia de Bia conforme a ficha de adulto de dor e analgesia (degrau 1); dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a04_pacB'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '00bc3daf-b7e5-4410-99d4-2c7301dd1922', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora', 'observacao', 'Conforme a ficha de adulto de dor e analgesia, degrau 1 — teste de fluxo')),
  'ok', 'a04_itemB');
SELECT e2e.ba(4, 'a04_itemL,a04_itemB', 'A04.06.prescricao_luan', 'A04.06.itens', 'banco', NULL, 'Cada item leva o peso aferido do seu atendimento e cita a ficha do seu público',
  format($q$SELECT e2e.confere(count(*) = 2 AND bool_and(peso_kg IS NOT NULL), string_agg(descricao || ' peso ' || coalesce(peso_kg::text, 'nulo') || ' [' || coalesce(observacao, '') || ']', '; '))
    FROM public.prescricao_itens WHERE id IN (%L, %L)$q$, e2e.v('a04_itemL'), e2e.v('a04_itemB')));
-- (morfina é alta vigilância na UPA: a farmácia libera antes da checagem; papel a mais no A04)
SELECT e2e.ba(4, 'a04_itemL', 'A04.06.prescricao_luan', 'A04.06.farmacia_luan', 'f5_farm', '/alta-vigilancia', 'Farmacêutico valida e dispensa a morfina de Luan (alta vigilância)',
  format($q$SELECT public.validar_item(%L::uuid, true, NULL)::text || ' ' || public.dispensar_item(%L::uuid, 1, NULL)::text$q$, e2e.u('a04_itemL'), e2e.u('a04_itemL')));
SELECT e2e.ba(4, 'a04_itemB', 'A04.07.prescricao_bia', 'A04.07.farmacia_bia', 'f5_farm', '/dispensacao', 'Farmacêutico dispensa a dipirona de Bia',
  format('SELECT public.dispensar_item(%L::uuid, 1, NULL)::text', e2e.u('a04_itemB')));

-- ── 8. exames ───────────────────────────────────────────────────────────────
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.08.rx_luan', 'f5_med_upa', '/atendimento (Exames)', 'Radiografia do punho de Luan (SIGTAP 0204040124)',
  format($q$SELECT public.pedir_exames(%L::uuid, '[{"procedimento":"0204040124"}]'::jsonb, 'urgente', 'Queda com dor no punho (teste A04)')::text$q$, e2e.u('a04_epL')));
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.08.rx_bia', 'f5_med_upa', '/atendimento (Exames)', 'Radiografia do punho de Bia (SIGTAP 0204040124)',
  format($q$SELECT public.pedir_exames(%L::uuid, '[{"procedimento":"0204040124"}]'::jsonb, 'urgente', 'Queda com dor no punho (teste A04)')::text$q$, e2e.u('a04_epB')));
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.08.exame_luan', 'banco', NULL, 'Pedido de Luan', format($q$SELECT id::text FROM public.exames_pedidos WHERE episodio_id = %L LIMIT 1$q$, e2e.v('a04_epL')), 'ok', 'a04_exL');
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.08.exame_bia', 'banco', NULL, 'Pedido de Bia', format($q$SELECT id::text FROM public.exames_pedidos WHERE episodio_id = %L LIMIT 1$q$, e2e.v('a04_epB')), 'ok', 'a04_exB');

SELECT e2e.ba(4, 'a04_exL,a04_exB', 'A04.08.exame_luan', 'A04.08.lista', 'f5_med_upa', '/exames', 'Os dois pedidos aparecem em exames_da_unidade',
  format($q$SELECT e2e.confere(public.exames_da_unidade(%L::uuid)::text LIKE '%%' || %L || '%%' AND public.exames_da_unidade(%L::uuid)::text LIKE '%%' || %L || '%%', left(public.exames_da_unidade(%L::uuid)::text, 200))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a04_exL'), 'f5100000-0000-4000-8000-000000000002', e2e.v('a04_exB'), 'f5100000-0000-4000-8000-000000000002'));

-- ── 9. checagem ─────────────────────────────────────────────────────────────
SELECT e2e.ba(4, 'a04_itemL', 'A04.06.prescricao_luan', 'A04.09.checar_luan', 'f5_enf_upa', '/checagem', 'Checa "feito" a analgesia de Luan (liberada pela farmácia)',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, NULL)::text$q$, e2e.u('a04_itemL')), 'ok', 'a04_admL');
SELECT e2e.ba(4, 'a04_itemB', 'A04.07.prescricao_bia', 'A04.09.checar_bia', 'f5_enf_upa', '/checagem', 'Checa "feito" a analgesia de Bia',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, NULL)::text$q$, e2e.u('a04_itemB')), 'ok', 'a04_admB');
SELECT e2e.ba(4, 'a04_contaL,a04_contaB', 'A04.01.conta_luan', 'A04.09.contas_porta', 'f5_fat', '/faturamento/contas', 'Cada conta da porta: classificação, consulta e medicação',
  format($q$SELECT e2e.confere(public.conta_detalhe(%L::uuid) -> 'itens' @> '[{"procedimento":"0301100012"}]' AND public.conta_detalhe(%L::uuid) -> 'itens' @> '[{"procedimento":"0301100012"}]'
      OR ((public.conta_detalhe(%L::uuid) -> 'itens')::text LIKE '%%0301100012%%' AND (public.conta_detalhe(%L::uuid) -> 'itens')::text LIKE '%%0301100012%%'),
      'Luan ' || jsonb_array_length(public.conta_detalhe(%L::uuid) -> 'itens') || ' itens, total ' || coalesce(public.conta_detalhe(%L::uuid) ->> 'total_referencia', 'nulo')
      || '; Bia ' || jsonb_array_length(public.conta_detalhe(%L::uuid) -> 'itens') || ' itens, total ' || coalesce(public.conta_detalhe(%L::uuid) ->> 'total_referencia', 'nulo'))$q$,
    e2e.u('a04_contaL'), e2e.u('a04_contaB'), e2e.u('a04_contaL'), e2e.u('a04_contaB'), e2e.u('a04_contaL'), e2e.u('a04_contaL'), e2e.u('a04_contaB'), e2e.u('a04_contaB')));

-- ── 10. internação de 24 h (sem setor pediátrico: o mesmo setor para os dois)
-- pré-condição de leito: com menos de 2 leitos livres na Internação (outros cenários
-- deixam leitos em higienização), o enfermeiro da Internação conclui a higienização
DO $$
DECLARE l record;
BEGIN
  IF (SELECT count(*) FROM public.leitos WHERE setor_id = 'f5300000-0000-4000-8000-000000000013' AND status = 'livre' AND ativo) < 2 THEN
    FOR l IN SELECT id, identificador FROM public.leitos WHERE setor_id = 'f5300000-0000-4000-8000-000000000013' AND status = 'higienizacao' AND ativo
              ORDER BY identificador LIMIT 2 - (SELECT count(*) FROM public.leitos WHERE setor_id = 'f5300000-0000-4000-8000-000000000013' AND status = 'livre' AND ativo) LOOP
      PERFORM e2e.ba_passo('A04.10.higienizacao_' || l.identificador, 4, 'f5_enf_int', '/enfermagem/internacao (leitos)', 'Pré-condição: a enfermagem conclui a higienização do leito ' || l.identificador,
        format('SELECT public.concluir_higienizacao(%L::uuid)::text', l.id));
    END LOOP;
  END IF;
END $$;
SELECT e2e.guardar('a04_leitoL', (SELECT l.id::text FROM public.leitos l WHERE l.setor_id = 'f5300000-0000-4000-8000-000000000013' AND l.status = 'livre' AND l.ativo ORDER BY l.identificador LIMIT 1));
SELECT e2e.guardar('a04_leitoB', (SELECT l.id::text FROM public.leitos l WHERE l.setor_id = 'f5300000-0000-4000-8000-000000000013' AND l.status = 'livre' AND l.ativo AND l.id::text <> coalesce(e2e.v('a04_leitoL'), '') ORDER BY l.identificador LIMIT 1));
SELECT e2e.ba(4, 'a04_epL,a04_leitoL', 'A04.01.ficha_luan', 'A04.10.internar_luan', 'f5_med_upa', '/atendimento (Desfecho)', 'Luan: desfecho internação na Internação da UPA, com leito',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', 'Observação de 24 h por TCE leve (teste A04)', jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
    e2e.u('a04_epL'), 'f5300000-0000-4000-8000-000000000013', e2e.v('a04_leitoL')));
SELECT e2e.ba(4, 'a04_epB,a04_leitoB', 'A04.01.ficha_bia', 'A04.10.internar_bia', 'f5_med_upa', '/atendimento (Desfecho)', 'Bia: desfecho internação no mesmo setor, com leito',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', 'Observação de 24 h por TCE leve (teste A04)', jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
    e2e.u('a04_epB'), 'f5300000-0000-4000-8000-000000000013', e2e.v('a04_leitoB')));
SELECT e2e.ba(4, 'a04_epL', 'A04.01.ficha_luan', 'A04.10.int_luan', 'banco', NULL, 'Internação de Luan', format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L AND etapa = 'internacao'$q$, e2e.u('a04_epL')), 'ok', 'a04_intL');
SELECT e2e.ba(4, 'a04_epB', 'A04.01.ficha_bia', 'A04.10.int_bia', 'banco', NULL, 'Internação de Bia', format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L AND etapa = 'internacao'$q$, e2e.u('a04_epB')), 'ok', 'a04_intB');
SELECT e2e.ba(4, 'a04_intL,a04_intB', 'A04.10.int_luan', 'A04.10.contas_internacao', 'banco', NULL, 'Cada criança tem conta de internação ligada à conta da porta (conta_origem_id)',
  format($q$SELECT e2e.confere(count(*) = 2 AND bool_and(k.conta_origem_id IS NOT NULL), string_agg(p.nome || ': ' || k.numero || ' ' || k.tipo || ' ' || k.status || ', origem ' || coalesce(o.numero, 'nenhuma'), '; '))
    FROM public.contas k JOIN public.pacientes p ON p.id = k.paciente_id LEFT JOIN public.contas o ON o.id = k.conta_origem_id
   WHERE k.internacao_id IN (%L, %L)$q$, e2e.v('a04_intL'), e2e.v('a04_intB')));

-- ── 11. médica da internação: admissão ──────────────────────────────────────
SELECT e2e.ba(4, 'a04_intL', 'A04.10.int_luan', 'A04.11.admissao_luan', 'f5_med_int', '/plantao/internacao/pacientes', 'Admissão de Luan (ficha completa)',
  format($q$SELECT public.registrar_admissao(%L::uuid, 'Admissão para observação de TCE leve (teste A04)',
    '{"subjetivo":"Queda de bicicleta, TCE leve (teste A04)","objetivo":"Glasgow pela ficha pediátrica na tela; punho com dor","cid":"S06.0","plano":"Observação de 24 h pelas fichas pediátricas (teste de fluxo)"}'::jsonb)::text$q$, e2e.u('a04_intL')));
SELECT e2e.ba(4, 'a04_intB', 'A04.10.int_bia', 'A04.11.admissao_bia', 'f5_med_int', '/plantao/internacao/pacientes', 'Admissão de Bia (ficha completa)',
  format($q$SELECT public.registrar_admissao(%L::uuid, 'Admissão para observação de TCE leve (teste A04)',
    '{"subjetivo":"Queda de bicicleta, TCE leve (teste A04)","objetivo":"Glasgow pela ficha de adulto na tela; punho com dor","cid":"S06.0","plano":"Observação de 24 h pelas fichas de adulto (teste de fluxo)"}'::jsonb)::text$q$, e2e.u('a04_intB')));

-- ── 12. Fugulin: Bia sim, Luan não ──────────────────────────────────────────
SELECT e2e.ba(4, 'a04_intB', 'A04.10.int_bia', 'A04.12.fugulin_enf_ps', 'f5_enf_upa', '/enfermagem/internacao', 'Enfermeiro do PS (fora da Internação) tenta o Fugulin de Bia (deve ser recusado)',
  format('SELECT public.registrar_fugulin(%L::uuid, %L::jsonb, NULL)::text', e2e.u('a04_intB'),
    (SELECT jsonb_object_agg(a, 1) FROM jsonb_array_elements_text(private.fugulin_definicao() -> 'areas') a)), 'erro:O Fugulin é do enfermeiro de plantão');
SELECT e2e.ba(4, 'a04_intB', 'A04.10.int_bia', 'A04.12.fugulin_bia', 'f5_enf_int', '/enfermagem/internacao (CartaoFugulin)', 'Fugulin de Bia (12 áreas, graduação de teste)',
  format('SELECT public.registrar_fugulin(%L::uuid, %L::jsonb, NULL)::text', e2e.u('a04_intB'),
    (SELECT jsonb_object_agg(a, 1) FROM jsonb_array_elements_text(private.fugulin_definicao() -> 'areas') a)), 'ok', 'a04_fugB');
SELECT e2e.ba(4, 'a04_fugB', 'A04.12.fugulin_bia', 'A04.12.fugulin_bia_banco', 'banco', NULL, 'Fugulin gravado com total e categoria, autor = login',
  format($q$SELECT e2e.confere(registrado_por = 'f5200000-0000-4000-8000-0000000000a3', 'total ' || total || ', ' || categoria || ', dia ' || dia) FROM public.classificacoes_fugulin WHERE id = %L$q$, e2e.u('a04_fugB')));
SELECT e2e.ba(4, 'a04_intL', 'A04.10.int_luan', 'A04.12.fugulin_luan', 'f5_enf_int', '/enfermagem/internacao', 'Fugulin de Luan (deve ser recusado: instrumento do adulto)',
  format('SELECT public.registrar_fugulin(%L::uuid, %L::jsonb, NULL)::text', e2e.u('a04_intL'),
    (SELECT jsonb_object_agg(a, 1) FROM jsonb_array_elements_text(private.fugulin_definicao() -> 'areas') a)), 'erro:Fugulin é instrumento do adulto');
SELECT e2e.lacuna('A04.12.dini', 4, 'f5_enf_int', 'Instrumento pediátrico de enfermagem (Dini) para Luan',
  'Lacuna (MAPA): Dini não existe; só a nota na tela (AbasRegistro.tsx).');

-- ── 13. virada do dia (Luan faz 14 anos amanhã) ─────────────────────────────
SELECT e2e.lacuna('A04.13.virada', 4, 'f5_med_int', 'No dia seguinte, Luan (14a 0d) passa a adulto na Central e na Fugulin; registros antigos não mudam',
  'Não executável na mesma rodada: exige o dia civil seguinte (' || coalesce(e2e.v('a04_hoje'), '?') || ' + 1), e o catálogo dá alta aos dois no passo 14. A conferência da virada fica para a tela ou para uma rodada própria.');

-- ── 14. alta dos dois ───────────────────────────────────────────────────────
SELECT e2e.ba(4, 'a04_exL', 'A04.08.exame_luan', 'A04.14.laudo_luan', 'f5_med_int', '/exames', 'Resultado da radiografia de Luan (texto fictício)',
  format($q$SELECT public.resolver_exame(%L::uuid, 'Sem fratura (laudo fictício de teste A04)', NULL)::text$q$, e2e.u('a04_exL')));
SELECT e2e.ba(4, 'a04_exB', 'A04.08.exame_bia', 'A04.14.laudo_bia', 'f5_med_int', '/exames', 'Resultado da radiografia de Bia (texto fictício)',
  format($q$SELECT public.resolver_exame(%L::uuid, 'Sem fratura (laudo fictício de teste A04)', NULL)::text$q$, e2e.u('a04_exB')));
SELECT e2e.ba(4, 'a04_intL', 'A04.10.int_luan', 'A04.14.impeditivos_luan', 'f5_med_int', '/plantao/internacao (FormularioAlta)', 'Impeditivos da alta de Luan',
  format('SELECT public.impeditivos_alta(%L::uuid)::text', e2e.u('a04_intL')));
SELECT e2e.ba(4, 'a04_intL', 'A04.10.int_luan', 'A04.14.alta_luan', 'f5_med_int', '/plantao/internacao (FormularioAlta)', 'Alta melhorada de Luan (S06.0)',
  format($q$SELECT public.dar_alta(%L::uuid, 'alta_melhorada', 'S06.0', NULL, NULL, 'Sem intercorrências na observação (teste A04)', '{}'::jsonb)::text$q$, e2e.u('a04_intL')), 'ok', 'a04_altaL');
SELECT e2e.ba(4, 'a04_intL', 'A04.10.int_luan', 'A04.14.pacote_luan', 'f5_med_int', '/alta/:token', 'Pacote de alta de Luan',
  format($q$SELECT (public.gerar_pacote_alta(%L::uuid, '["Orientações de TCE leve conforme a ficha pediátrica (teste)"]'::jsonb, 'UBS em 7 dias', '["Vômitos","Sonolência","Dor de cabeça forte"]'::jsonb, NULL) ->> 'expira_em')$q$, e2e.u('a04_intL')));
SELECT e2e.ba(4, 'a04_intB', 'A04.10.int_bia', 'A04.14.impeditivos_bia', 'f5_med_int', '/plantao/internacao (FormularioAlta)', 'Impeditivos da alta de Bia',
  format('SELECT public.impeditivos_alta(%L::uuid)::text', e2e.u('a04_intB')));
SELECT e2e.ba(4, 'a04_intB', 'A04.10.int_bia', 'A04.14.alta_bia', 'f5_med_int', '/plantao/internacao (FormularioAlta)', 'Alta melhorada de Bia (S06.0)',
  format($q$SELECT public.dar_alta(%L::uuid, 'alta_melhorada', 'S06.0', NULL, NULL, 'Sem intercorrências na observação (teste A04)', '{}'::jsonb)::text$q$, e2e.u('a04_intB')), 'ok', 'a04_altaB');
SELECT e2e.ba(4, 'a04_intB', 'A04.10.int_bia', 'A04.14.pacote_bia', 'f5_med_int', '/alta/:token', 'Pacote de alta de Bia',
  format($q$SELECT (public.gerar_pacote_alta(%L::uuid, '["Orientações de TCE leve conforme a ficha de adulto (teste)"]'::jsonb, 'UBS em 7 dias', '["Vômitos","Sonolência","Dor de cabeça forte"]'::jsonb, NULL) ->> 'expira_em')$q$, e2e.u('a04_intB')));

-- ── custos: as quatro contas ────────────────────────────────────────────────
SELECT e2e.ba(4, 'a04_pacL,a04_pacB', 'A04.01.paciente_luan', 'A04.99.custos', 'f5_fat', '/faturamento/contas', 'Custos que o sistema registrou (as quatro contas)',
  format($q$SELECT string_agg((c -> 'paciente' ->> 'nome') || ' ' || coalesce(c ->> 'numero', '?') || ' ' || (c ->> 'tipo') || ' ' || (c ->> 'status') || ': ' ||
      coalesce((SELECT string_agg((i ->> 'procedimento') || ' qt ' || coalesce(i ->> 'quantidade', '?') || ' = ' || coalesce(i ->> 'valor_total', 'nulo'), ', ')
                  FROM jsonb_array_elements(public.conta_detalhe((c ->> 'id')::uuid) -> 'itens') i), 'sem itens')
      || ', total ' || coalesce(public.conta_detalhe((c ->> 'id')::uuid) ->> 'total_referencia', 'nulo'), ' | ')
    FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c WHERE c -> 'paciente' ->> 'nome' IN (%L, %L)$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a04_nomeL'), e2e.v('a04_nomeB')));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'A04.%' AND em >= e2e.v('a04_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
