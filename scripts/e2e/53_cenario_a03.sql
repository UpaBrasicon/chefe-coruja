-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário A03.
-- Puericultura que vira bronquiolite na UPA, com observação pediátrica.
-- Especificação: CENARIOS-A, seção A03.
--
-- UBS (puericultura, escuta, envio) → UPA (triagem pediátrica, atendimento,
-- prescrição, farmácia, checagem, observação) → contrarreferência → conta e BPA.
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas;
-- resultado em e2e.resultados (passos 'A03.NN.*', paciente = 3). Nada é
-- corrigido no produto. Lactente fictício novo a cada rodada ("Théo A03 Teste").
-- Prescrição SEM dose de memória: dose = 'conforme protocolo — dado fictício de
-- teste de fluxo'; o item cita a ferramenta ped-bronquiolite. A cor é a escolha
-- da enfermeira de teste. O box da observação pediátrica usa as contas do 49a.
--
-- Rodar antes: 41_checkin_fase5.sql (e, uma vez, 49a_ambiente_bloco_a.sql).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/53_cenario_a03.sql <saida>.sql
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

-- ── rodada: nome e nascimento do lactente ───────────────────────────────────
SELECT e2e.guardar('a03_rodada', (coalesce(e2e.v('a03_rodada')::int, 0) + 1)::text);
SELECT e2e.guardar('a03_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'a03\_%' AND nome NOT IN ('a03_rodada', 'a03_inicio');
SELECT e2e.guardar('a03_sufixo', CASE WHEN e2e.v('a03_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('a03_rodada')::int) ELSE '' END);
SELECT e2e.guardar('a03_nome', 'Théo A03 Teste' || e2e.v('a03_sufixo'));
SELECT e2e.guardar('a03_nasc', (private.data_atual() - interval '4 months')::date::text);
-- sem CNS (só aviso no BPA); responsável = mãe
SELECT e2e.guardar('a03_cadastro', jsonb_build_object('nome', e2e.v('a03_nome'), 'data_nascimento', e2e.v('a03_nasc'), 'sexo', 'M',
  'raca_cor', 'parda', 'nome_mae', 'Carla A03 Teste' || e2e.v('a03_sufixo'), 'responsavel_nome', 'Carla A03 Teste' || e2e.v('a03_sufixo'),
  'responsavel_parentesco', 'mãe', 'endereco', 'Rua do Teste, 3', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);

-- ── 0. pré-condição: 1ª consulta da puericultura até o 30º dia ──────────────
SELECT e2e.ba(3, NULL, NULL, 'A03.00.ficha', 'f5_rec_ubs', '/recepcao (Nova ficha)', 'Recepção cadastra o lactente e abre a 1ª consulta da puericultura',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Primeira consulta do bebê', NULL, %L::jsonb || '{"tipo_atendimento":"consulta_programada"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.v('a03_cadastro')), 'ok', 'a03_ep0');
SELECT e2e.ba(3, 'a03_ep0', 'A03.00.ficha', 'A03.00.paciente', 'banco', NULL, 'Paciente da UBS',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a03_ep0')), 'ok', 'a03_pac');
SELECT e2e.ba(3, 'a03_ep0', 'A03.00.ficha', 'A03.00.atender', 'f5_med_ubs', '/atendimento (UBS)', 'Médica abre o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a03_ep0')));
SELECT e2e.ba(3, 'a03_pac', 'A03.00.paciente', 'A03.00.sinais', 'f5_med_ubs', '/atendimento (UBS)', 'Peso e comprimento crus (cm)',
  e2e.ba_sinais(e2e.u('a03_pac'), '{"peso":3.9,"estatura":53}'));
SELECT e2e.ba(3, 'a03_ep0', 'A03.00.ficha', 'A03.00.soap', 'f5_med_ubs', '/atendimento (UBS)', 'SOAP da 1ª consulta (Z00.1)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Primeira consulta, mamando bem (teste A03)', 'Peso 3,9 kg, comprimento 53 cm', 'Lactente hígido', 'Puericultura de rotina', 'Z00.1')::text$q$, e2e.u('a03_ep0')));
SELECT e2e.ba(3, 'a03_ep0', 'A03.00.ficha', 'A03.00.conduta', 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra com o problema puericultura e CID Z00.1',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'consulta_programada', '{puericultura}', '{Z00.1}', '{retorno_cuidado_continuado}', 'Puericultura (teste A03)', NULL)::text$q$, e2e.u('a03_ep0')));
SELECT e2e.ba_ajuste(3, 'A03.00.datas', '1ª consulta levada ao 20º dia de vida (episódio e sinais no passado)',
  e2e.ba_sql_passado(e2e.u('a03_ep0'), e2e.u('a03_pac'), (private.data_atual() - (e2e.v('a03_nasc')::date + 20))));

-- rodada anterior que ficou parada na triagem da UPA (rodada 1: a classificação
-- foi recusada por falta da escala de dor, erro do script) é encerrada pelo fluxo normal
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT e.id, e.paciente_id FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
            WHERE e.unidade_id = 'f5100000-0000-4000-8000-000000000002' AND p.nome LIKE 'Théo A03 Teste%' AND p.nome <> e2e.v('a03_nome')
              AND e.etapa = 'triagem' LOOP
    PERFORM e2e.ba_passo('A03.00.encerra_anterior_classificar', 3, 'f5_enf_upa', '/triagem', 'Rodada anterior: a enfermeira de teste classifica (verde) o lactente parado na triagem',
      format($q$SELECT public.classificar_risco(%L::uuid, 'verde', '{"frequencia-cardiaca":140,"frequencia-respiratoria":44,"temperatura":36.8,"saturacao-o2":96,"escala-dor":1}'::jsonb, %L::uuid, 'Rodada anterior (teste A03)', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true)::text$q$,
        r.id, 'e4af65b7-27ed-4e74-9fcd-5ebe93355db9'));
    PERFORM e2e.ba_passo('A03.00.encerra_anterior_iniciar', 3, 'f5_med_upa', '/atendimento', 'Rodada anterior: médico assume', format('SELECT public.iniciar_atendimento(%L::uuid)::text', r.id));
    PERFORM e2e.ba_passo('A03.00.encerra_anterior_soap', 3, 'f5_med_upa', '/atendimento', 'Rodada anterior: SOAP',
      format($q$SELECT public.registrar_soap(%L::uuid, 'Rodada anterior do teste A03', 'Estável', 'Bronquiolite aguda', 'Alta (encerramento da rodada anterior)', 'J21.9')::text$q$, r.id));
    PERFORM e2e.ba_passo('A03.00.encerra_anterior_alta', 3, 'f5_med_upa', '/atendimento (Desfecho)', 'Rodada anterior: alta',
      format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', 'Encerramento da rodada anterior do teste A03', '{}'::jsonb)::text$q$, r.id));
  END LOOP;
END $$;

-- ── 1. técnico da UBS lê o painel da puericultura ───────────────────────────
SELECT e2e.ba(3, 'a03_pac', 'A03.00.paciente', 'A03.01.painel', 'f5_tec_ubs', '/puericultura', 'Théo no painel (menos de 2 anos), 1ª consulta até o 30º dia, peso/altura com a data',
  format($q$SELECT e2e.confere((x ->> 'primeira_consulta')::date <= %L::date + 30 AND (x ->> 'consultas')::int = 1 AND (x ->> 'peso_altura')::int >= 1,
      'primeira ' || coalesce(x ->> 'primeira_consulta', 'nula') || ', consultas ' || coalesce(x ->> 'consultas', '?') || ', peso_altura ' || coalesce(x ->> 'peso_altura', '?'))
    FROM jsonb_array_elements(public.puericultura_painel(%L::uuid)) x WHERE x ->> 'paciente_id' = %L$q$,
    e2e.v('a03_nasc'), 'f5100000-0000-4000-8000-000000000001', e2e.v('a03_pac')));
SELECT e2e.lacuna('A03.01.vacina_acs', 3, 'f5_tec_ubs', 'Vacina, ACS e conduta na puericultura',
  'Lacuna (MAPA): puericultura sem vacina, ACS ou conduta (teto 60/100); o painel só mostra consultas e peso/altura.');

-- ── 2 e 3. escuta pediátrica na UBS ─────────────────────────────────────────
SELECT e2e.ba(3, 'a03_pac', 'A03.00.paciente', 'A03.02.ficha', 'f5_rec_ubs', '/recepcao', 'Ficha escuta_inicial: tosse, cansaço e dificuldade para mamar há 2 dias',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Tosse, cansaço e dificuldade para mamar há 2 dias', %L::uuid, '{"tipo_atendimento":"escuta_inicial"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.u('a03_pac')), 'ok', 'a03_ep2');
SELECT e2e.ba(3, 'a03_ep2', 'A03.02.ficha', 'A03.B.tecnico_nao_escuta', 'f5_tec_ubs', '/escuta', 'Técnico tenta a escuta (deve ser recusado)',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'amarelo', 'consulta')::text$q$, e2e.u('a03_ep2')), 'erro:A escuta inicial e a classificação são do enfermeiro');
SELECT e2e.ba(3, 'a03_ep2', 'A03.02.ficha', 'A03.03.escuta', 'f5_enf_ubs', '/escuta',
  'Escuta com sinais crus (FR, SpO2, temperatura, peso, comprimento); a enfermeira de teste classifica amarelo; saída consulta',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'amarelo', 'consulta', 'Tosse e cansaço, mama pouco',
    '{"frequencia-respiratoria":58,"saturacao-o2":93,"temperatura":37.8,"peso":6.1,"estatura":62}'::jsonb)::text$q$, e2e.u('a03_ep2')), 'ok', 'a03_escuta');
SELECT e2e.ba(3, 'a03_escuta', 'A03.03.escuta', 'A03.03.grupo', 'banco', NULL, 'Grupo pediátrico escolhido pela data de nascimento; cor da enfermeira',
  format($q$SELECT e2e.confere(cor = 'amarelo' AND publico = 'pediatrico' AND publico_pela_idade = 'pediatrico', 'cor ' || cor || ', público ' || publico || ', pela idade ' || coalesce(publico_pela_idade, '?'))
    FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('a03_escuta')));

-- ── 4. médica da UBS: SOAP e envio à UPA ────────────────────────────────────
SELECT e2e.ba(3, 'a03_ep2', 'A03.02.ficha', 'A03.04.atender', 'f5_med_ubs', '/atendimento (UBS)', 'Médica abre o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a03_ep2')));
SELECT e2e.ba(3, 'a03_ep2', 'A03.02.ficha', 'A03.04.soap', 'f5_med_ubs', '/atendimento (UBS)', 'SOAP com CID de bronquiolite (J21.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Tosse e cansaço há 2 dias, mama pouco (teste A03)', 'FR 58, SpO2 93%%, tiragem subcostal', 'Bronquiolite aguda', 'Envio à UPA pelos critérios de encaminhamento da ped-bronquiolite', 'J21.9')::text$q$, e2e.u('a03_ep2')));
SELECT e2e.ba(3, 'a03_ep2', 'A03.02.ficha', 'A03.04.enviar', 'f5_med_ubs', '/atendimento → EnviarUpa', 'Envia à UPA F5 por esforço respiratório (critérios da ped-bronquiolite)',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Lactente de 4 meses com esforço respiratório e SpO2 93%% (teste A03)')::text$q$,
    e2e.u('a03_ep2'), 'f5100000-0000-4000-8000-000000000002'), 'ok', 'a03_env');
SELECT e2e.ba(3, 'a03_ep2', 'A03.02.ficha', 'A03.04.conduta', 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra a consulta com encaminhamento para urgência (CIAP R78)',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'escuta_inicial', '{}', '{J21.9}', '{encaminhamento_urgencia}', 'Enviado à UPA F5 (teste A03)', '{R78}')::text$q$, e2e.u('a03_ep2')));

-- ── 5. recepção da UPA ──────────────────────────────────────────────────────
SELECT e2e.ba(3, 'a03_env', 'A03.04.enviar', 'A03.05.vindo', 'f5_rec_upa', '/recepcao → VindoDaUbs', 'Vê o lactente vindo da UBS com queixa, cor, SOAP e sinais',
  format($q$SELECT e2e.confere(e::text LIKE '%%amarelo%%' AND e::text LIKE '%%J21.9%%' AND e::text LIKE '%%saturacao-o2%%', left(e::text, 300))
    FROM jsonb_array_elements(public.encaminhamentos_upa_destino(%L::uuid)) e WHERE (e ->> 'id')::uuid = %L::uuid$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a03_env')));
SELECT e2e.ba_passo('A03.05.ficha', 3, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha no Pronto Socorro (criança de colo)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Lactente com cansaço e dificuldade para mamar (vindo da UBS)', NULL, %L::jsonb, '{lactante_crianca_colo}') ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('a03_cadastro')), 'ok', 'a03_epu');
SELECT e2e.ba(3, 'a03_epu', 'A03.05.ficha', 'A03.05.paciente', 'banco', NULL, 'Paciente da UPA',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a03_epu')), 'ok', 'a03_pacu');
SELECT e2e.ba(3, 'a03_epu,a03_env', 'A03.05.ficha', 'A03.05.chegou', 'f5_rec_upa', '/recepcao → VindoDaUbs', 'Marca "Chegou" com a ficha escolhida',
  format('SELECT left(public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid)::text, 120)', e2e.u('a03_env'), e2e.u('a03_epu')));
SELECT e2e.ba(3, 'a03_epu', 'A03.05.ficha', 'A03.05.conta', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial aberta, sem itens',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' AND c ->> 'status' = 'aberta'
        AND jsonb_array_length(public.conta_detalhe((c ->> 'id')::uuid) -> 'itens') = 0 LIMIT 1), e2e.falhar('conta aberta sem itens não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a03_nome')), 'ok', 'a03_conta');

-- ── 6. triagem da UPA: grupo pediátrico pela idade ──────────────────────────
SELECT e2e.ba(3, 'a03_epu', 'A03.05.ficha', 'A03.06.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('a03_epu'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.ba(3, 'a03_epu', 'A03.05.ficha', 'A03.06.fluxo_adulto_recusado', 'f5_enf_upa', '/triagem (Classificar)', 'Fluxograma adulto para o lactente (deve ser recusado)',
  format($q$SELECT public.classificar_risco(%L::uuid, 'laranja', '{"frequencia-respiratoria":60}'::jsonb, %L::uuid, 'Esforço respiratório (teste)', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true)::text$q$,
    e2e.u('a03_epu'), '8ec1567f-7aaa-4ae6-bd8b-eab1a65cd34c'), 'erro:Fluxograma de outro público');
SELECT e2e.ba(3, 'a03_epu', 'A03.05.ficha', 'A03.06.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Fluxograma pediátrico "Alterações respiratórias", sinais crus; a enfermeira de teste classifica laranja',
  format($q$SELECT public.classificar_risco(%L::uuid, 'laranja',
    '{"frequencia-cardiaca":162,"frequencia-respiratoria":60,"temperatura":37.9,"saturacao-o2":92,"escala-dor":3}'::jsonb, %L::uuid,
    %L, '{}'::jsonb, NULL, NULL, NULL, 'Lactente com cansaço e tiragem', false, %L::boolean)::text$q$,
    e2e.u('a03_epu'), 'e4af65b7-27ed-4e74-9fcd-5ebe93355db9',
    coalesce(e2e.disc('f5100000-0000-4000-8000-000000000002', 'e4af65b7-27ed-4e74-9fcd-5ebe93355db9', 'laranja'), 'Esforço respiratório importante (livre, teste A03)'),
    (e2e.disc('f5100000-0000-4000-8000-000000000002', 'e4af65b7-27ed-4e74-9fcd-5ebe93355db9', 'laranja') IS NULL)::text), 'ok', 'a03_class');
SELECT e2e.ba(3, 'a03_class', 'A03.06.classificar', 'A03.06.cor', 'banco', NULL, 'Cor da enfermeira, grupo pediátrico pela idade',
  format($q$SELECT e2e.confere(cor = 'laranja' AND publico = 'pediatrico', 'cor ' || cor || ', público ' || publico || ', pela idade ' || coalesce(publico_pela_idade, '?') || ', discriminador ' || coalesce(discriminador, '?'))
    FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('a03_class')));
SELECT e2e.ba(3, 'a03_conta', 'A03.05.conta', 'A03.06.conta_acolhimento', 'f5_fat', '/faturamento/contas', 'Item "acolhimento com classificação" na conta',
  format($q$SELECT e2e.confere((public.conta_detalhe(%L::uuid) -> 'itens')::text LIKE '%%0301060118%%', left((public.conta_detalhe(%L::uuid) -> 'itens')::text, 200))$q$,
    e2e.u('a03_conta'), e2e.u('a03_conta')));

-- ── 7. médico da UPA: assume, peso aferido, SOAP ────────────────────────────
SELECT e2e.ba(3, 'a03_epu', 'A03.05.ficha', 'A03.07.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a03_epu')));
SELECT e2e.ba(3, 'a03_pacu', 'A03.05.paciente', 'A03.07.sem_peso', 'f5_med_upa', '/atendimento (Prescrição)', 'Prescrição antes do peso do atendimento (deve ser recusado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a03_pacu'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '693126cf-c0be-4b77-b194-25f6925ca77e', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Contínuo')), 'erro:Falta para prescrever');
SELECT e2e.ba(3, 'a03_pacu', 'A03.05.paciente', 'A03.07.peso_aferido', 'f5_med_upa', '/atendimento (Prescrição → peso)', 'Peso aferido do lactente',
  e2e.ba_sinais(e2e.u('a03_pacu'), '{"peso":6.1}', NULL, 'aferido'));
SELECT e2e.ba(3, 'a03_epu', 'A03.05.ficha', 'A03.07.soap', 'f5_med_upa', '/atendimento', 'SOAP com CID de bronquiolite (J21.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Tosse e cansaço há 2 dias, mama pouco (teste A03)', 'FR 60, SpO2 92%%, tiragem; peso aferido 6,1 kg', 'Bronquiolite aguda', 'Suporte conforme a ferramenta ped-bronquiolite (teste de fluxo)', 'J21.9')::text$q$, e2e.u('a03_epu')));
SELECT e2e.ba(3, 'a03_conta', 'A03.05.conta', 'A03.07.conta_consulta', 'f5_fat', '/faturamento/contas', 'Item "consulta médica" na conta',
  format($q$SELECT e2e.confere((public.conta_detalhe(%L::uuid) -> 'itens')::text LIKE '%%0301060096%%', 'consulta na conta')$q$, e2e.u('a03_conta')));

-- ── 8. prescrição conforme a ped-bronquiolite (sem dose de memória) ─────────
SELECT e2e.ba(3, 'a03_pacu', 'A03.05.paciente', 'A03.08.hidratacao', 'f5_med_upa', '/atendimento (Prescrição)',
  'Hidratação EV (glicose), "Contínuo", conforme a ped-bronquiolite (Australásia 2025, rec. 20); dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a03_pacu'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '693126cf-c0be-4b77-b194-25f6925ca77e', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Contínuo', 'observacao', 'Hidratação conforme a ferramenta ped-bronquiolite, rec. 20 (teste de fluxo)')),
  'ok', 'a03_item_gli');
SELECT e2e.ba(3, 'a03_pacu', 'A03.05.paciente', 'A03.08.oxigenio', 'f5_med_upa', '/atendimento (Prescrição)',
  'Cuidado: O₂ suplementar pelo alvo de SpO₂ da ped-bronquiolite',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a03_pacu'),
    jsonb_build_object('tipo', 'cuidado', 'descricao', 'Oxigênio suplementar pelo alvo de SpO₂ da ferramenta ped-bronquiolite (teste de fluxo)')), 'ok', 'a03_item_o2');
SELECT e2e.ba(3, 'a03_item_gli', 'A03.08.hidratacao', 'A03.08.peso_no_item', 'banco', NULL, 'O item leva o peso aferido do atendimento',
  format($q$SELECT e2e.confere(peso_kg = 6.1, 'peso_kg ' || coalesce(peso_kg::text, 'nulo') || ', ' || descricao) FROM public.prescricao_itens WHERE id = %L$q$, e2e.u('a03_item_gli')));

-- ── 9. farmácia: entrada, validação e dispensação ───────────────────────────
SELECT e2e.ba_passo('A03.09.entrada', 3, 'f5_farm', '/estoque', 'Entrada de estoque da glicose (10 bolsas, nota fiscal de teste)',
  format($q$SELECT public.registrar_entrada_estoque(%L::uuid, %L::uuid, 10, 'NF teste A03', 'Entrada de teste do cenário A03')::text$q$,
    'f5100000-0000-4000-8000-000000000002', '693126cf-c0be-4b77-b194-25f6925ca77e'), 'ok', 'a03_saldo_entrada');
SELECT e2e.ba(3, 'a03_item_gli', 'A03.08.hidratacao', 'A03.09.fila', 'f5_farm', '/farmacia (fila de validação)', 'O item aparece na fila de validação',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.fila_validacao(%L::uuid) f WHERE f.item_id = %L::uuid), 'na fila')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a03_item_gli')));
SELECT e2e.ba(3, 'a03_item_gli', 'A03.08.hidratacao', 'A03.09.validar', 'f5_farm', '/farmacia', 'Farmacêutico valida (confere)',
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('a03_item_gli')));
SELECT e2e.ba(3, 'a03_item_gli', 'A03.08.hidratacao', 'A03.09.para_dispensar', 'f5_farm', '/dispensacao', 'O item aparece em itens_para_dispensar',
  format($q$SELECT e2e.confere(public.itens_para_dispensar(%L::uuid, NULL)::text LIKE '%%' || %L || '%%', 'na lista de dispensação')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a03_item_gli')));
SELECT e2e.ba(3, 'a03_item_gli', 'A03.08.hidratacao', 'A03.09.dispensar', 'f5_farm', '/dispensacao', 'Dispensa 2 bolsas para 24 h (quantidade de teste)',
  format('SELECT public.dispensar_item(%L::uuid, 2, NULL)::text', e2e.u('a03_item_gli')), 'ok', 'a03_disp');
SELECT e2e.ba(3, 'a03_disp', 'A03.09.dispensar', 'A03.09.extrato', 'f5_farm', '/estoque (extrato)', 'O extrato mostra a entrada e a saída por prescrição',
  format($q$SELECT e2e.confere(public.extrato_estoque(%L::uuid, %L::uuid, 1)::text LIKE '%%saida_prescricao%%', left(public.extrato_estoque(%L::uuid, %L::uuid, 1)::text, 300))$q$,
    'f5100000-0000-4000-8000-000000000002', '693126cf-c0be-4b77-b194-25f6925ca77e', 'f5100000-0000-4000-8000-000000000002', '693126cf-c0be-4b77-b194-25f6925ca77e'));
SELECT e2e.ba(3, 'a03_conta', 'A03.05.conta', 'A03.09.conta_medicamento', 'f5_fat', '/faturamento/contas', 'A dispensação entra na conta sem valor',
  format($q$SELECT e2e.confere((public.conta_detalhe(%L::uuid) -> 'medicamentos')::text ILIKE '%%glicose%%', left((public.conta_detalhe(%L::uuid) -> 'medicamentos')::text, 250))$q$,
    e2e.u('a03_conta'), e2e.u('a03_conta')));

-- ── 10. checagem e sinais ───────────────────────────────────────────────────
SELECT e2e.ba(3, 'a03_item_gli', 'A03.08.hidratacao', 'A03.10.checar', 'f5_enf_upa', '/checagem', 'Enfermeira checa "feito" a hidratação',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, NULL)::text$q$, e2e.u('a03_item_gli')), 'ok', 'a03_adm');
SELECT e2e.ba(3, 'a03_pacu', 'A03.05.paciente', 'A03.10.sinais', 'f5_enf_upa', '/checagem', 'SpO2 e FR crus',
  e2e.ba_sinais(e2e.u('a03_pacu'), '{"saturacao-o2":94,"frequencia-respiratoria":54}'));
SELECT e2e.ba(3, 'a03_conta', 'A03.05.conta', 'A03.10.conta_medicacao', 'f5_fat', '/faturamento/contas', 'Item "administração de medicamento" na conta',
  format($q$SELECT e2e.confere((public.conta_detalhe(%L::uuid) -> 'itens')::text LIKE '%%0301100012%%', 'medicação na conta')$q$, e2e.u('a03_conta')));

-- ── 11. desfecho observação: qual box? ──────────────────────────────────────
SELECT e2e.ba(3, 'a03_epu', 'A03.05.ficha', 'A03.11.observacao', 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho observação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.u('a03_epu')));
SELECT e2e.ba(3, 'a03_epu', 'A03.05.ficha', 'A03.11.internacao', 'banco', NULL, 'Internação de observação aberta pelo desfecho',
  format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L AND etapa = 'observacao'$q$, e2e.u('a03_epu')), 'ok', 'a03_int');
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.11.box', 'banco', NULL, 'O box escolhido é da Observação Pediátrica (o catálogo previa a Observação Adulto)',
  format($q$SELECT e2e.confere(s.nome = 'Observação Pediátrica', 'setor ' || s.nome || ', box ' || coalesce(l.identificador, 'nenhum') || ', pendência 6 h ' ||
      (SELECT count(*) FROM public.pendencias p WHERE p.internacao_id = i.id AND p.tipo = 'observacao'))
    FROM public.internacoes i JOIN public.setores s ON s.id = i.setor_atual_id LEFT JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = %L$q$, e2e.u('a03_int')));

-- ── 12. enfermagem da observação pediátrica ─────────────────────────────────
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.12.enf_ps_fora', 'f5_enf_upa', '/enfermagem', 'Enfermeiro do PS, fora da escala da Observação Pediátrica, tenta os sinais do box (deve ser recusado)',
  e2e.ba_sinais(e2e.u('a03_pacu'), '{"saturacao-o2":95}', e2e.u('a03_int')), 'erro');
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.12.sinais', 'f5_enf_obsped', '/enfermagem/pronto-socorro (AbasRegistro)', 'Sinais vitais seriados crus no box',
  e2e.ba_sinais(e2e.u('a03_pacu'), '{"saturacao-o2":95,"frequencia-respiratoria":50,"frequencia-cardiaca":150,"temperatura":37.4}', e2e.u('a03_int')));
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.12.fugulin', 'f5_enf_obsped', '/enfermagem (Fugulin)', 'Tenta a Fugulin na criança (deve ser recusado: instrumento do adulto)',
  format('SELECT public.registrar_fugulin(%L::uuid, %L::jsonb, NULL)::text', e2e.u('a03_int'),
    (SELECT jsonb_object_agg(a, 2) FROM jsonb_array_elements_text(private.fugulin_definicao() -> 'areas') a)), 'erro:Fugulin é instrumento do adulto');
SELECT e2e.lacuna('A03.12.dini', 3, 'f5_enf_obsped', 'Instrumento pediátrico de classificação de enfermagem (Dini)',
  'Lacuna (MAPA): Dini não existe; a tela mostra a nota "Fugulin é instrumento do adulto… (Dini) ainda não está no produto" (conferir na tela).');

-- ── 13. médica da observação: painel, atendimento, reavaliação ──────────────
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.13.painel', 'f5_med_obsped', '/plantao/observacao', 'Painel da observação mostra o lactente, com prazo',
  format($q$SELECT coalesce((SELECT 'box ' || coalesce(p.box, '?') || ', setor ' || p.setor_nome || ', prazo ' || coalesce(p.prazo::text, '?') || ', estado ' || coalesce(p.estado, '?')
      FROM public.painel_observacao(%L::uuid) p WHERE p.internacao_id = %L::uuid), e2e.falhar('fora do painel'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a03_int')));
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.13.atender', 'f5_med_obsped', '/plantao/observacao', 'Primeiro atendimento no box',
  format('SELECT public.observacao_atender(%L::uuid)::text', e2e.u('a03_int')));
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.B.reavaliar_13h', 'f5_med_obsped', '/plantao/observacao', 'Reavaliação marcada para daqui a 13 h (deve ser recusado)',
  format($q$SELECT public.observacao_reavaliar(%L::uuid, now() + interval '13 hours')::text$q$, e2e.u('a03_int')), 'erro:Reavaliação com mais de 12 horas');
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.13.reavaliar', 'f5_med_obsped', '/plantao/observacao', 'Marca reavaliação para daqui a 2 h',
  format($q$SELECT public.observacao_reavaliar(%L::uuid, now() + interval '2 hours')::text$q$, e2e.u('a03_int')));
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.13.reavaliado', 'f5_med_obsped', '/plantao/observacao', 'Reavaliação feita (pendência resolvida)',
  format('SELECT public.observacao_reavaliado(%L::uuid)::text', e2e.u('a03_int')));
SELECT e2e.ba(3, 'a03_pacu', 'A03.05.paciente', 'A03.13.porta_ativa', 'f5_med_obsped', '/plantao/observacao (Vindos da porta)', 'A prescrição da porta aparece para quem cuida da observação',
  format($q$SELECT e2e.confere(count(*) >= 1, count(*) || ' itens: ' || string_agg(descricao || ' [' || coalesce(posologia, '') || ']', '; ')) FROM public.prescricao_porta_ativa(%L::uuid)$q$, e2e.u('a03_pacu')));

-- ── 14. alta da observação e contrarreferência ──────────────────────────────
SELECT e2e.ba(3, 'a03_int', 'A03.11.internacao', 'A03.14.finalizar', 'f5_med_obsped', '/plantao/observacao', 'Encerra com alta, orientações e CID J21.9',
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'alta_medica', 'J21.9', 'Melhora do esforço respiratório; orientações à mãe (teste A03)', '{}'::jsonb)::text$q$,
    e2e.u('a03_int')), 'ok', 'a03_finalizada');
SELECT e2e.ba(3, 'a03_finalizada', 'A03.14.finalizar', 'A03.14.encerrado', 'banco', NULL, 'Episódio encerrado e box liberado',
  format($q$SELECT e2e.confere(e.etapa = 'encerrado' AND i.data_alta IS NOT NULL, 'episódio ' || e.etapa || ', internação ' || i.status || ', box ' ||
      coalesce((SELECT string_agg(DISTINCT l.identificador || ' ' || l.status, ', ') FROM public.eventos_leito ev JOIN public.leitos l ON l.id = ev.leito_id WHERE ev.internacao_id = i.id), '?'))
    FROM public.internacoes i JOIN public.episodios e ON e.id = i.episodio_id WHERE i.id = %L$q$, e2e.u('a03_int')));
SELECT e2e.ba(3, 'a03_finalizada', 'A03.14.finalizar', 'A03.14.contrarreferencia', 'f5_enf_ubs', '/encaminhados?aba=retornos', 'A contrarreferência chega à UBS',
  format($q$SELECT coalesce((SELECT r ->> 'id' FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid, 7)) r
      WHERE r -> 'paciente' ->> 'nome' = %L LIMIT 1), e2e.falhar('sem contrarreferência para o lactente'))$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('a03_nome')), 'ok', 'a03_ret');

-- ── 15. a UBS abre a contrarreferência; a puericultura não muda ─────────────
SELECT e2e.ba(3, 'a03_ret', 'A03.14.contrarreferencia', 'A03.15.abrir', 'f5_enf_ubs', '/encaminhados (Retornos)', 'Enfermeira da UBS abre a contrarreferência',
  format('SELECT left(public.contrarreferencia_abrir(%L::uuid)::text, 250)', e2e.u('a03_ret')));
SELECT e2e.ba(3, 'a03_ret', 'A03.14.contrarreferencia', 'A03.15.visto', 'banco', NULL, 'a_ver → visto, autor = login',
  format($q$SELECT e2e.confere(situacao = 'visto' AND visto_por = 'f5200000-0000-4000-8000-000000000002', 'situação ' || situacao || ', desfecho ' || coalesce(desfecho, '?'))
    FROM public.contrarreferencias WHERE id = %L$q$, e2e.u('a03_ret')));
SELECT e2e.ba(3, 'a03_pac', 'A03.00.paciente', 'A03.15.puericultura', 'f5_enf_ubs', '/puericultura', 'Théo segue na puericultura sem consulta nova (o episódio da UPA não conta)',
  format($q$SELECT e2e.confere((p ->> 'crianca')::boolean AND (p ->> 'consultas')::int = 1, 'criança ' || (p ->> 'crianca') || ', consultas ' || coalesce(p ->> 'consultas', '?') || ', datas ' || coalesce(p ->> 'datas_consultas', '?'))
    FROM (SELECT public.puericultura_do_paciente(%L::uuid) p) x$q$, e2e.u('a03_pac')));

-- ── 16. faturamento ─────────────────────────────────────────────────────────
SELECT e2e.ba(3, 'a03_conta', 'A03.05.conta', 'A03.16.detalhe', 'f5_fat', '/faturamento/contas', 'Três itens SIGTAP; total de referência; pendências',
  format($q$SELECT 'itens ' || jsonb_array_length(d -> 'itens') || ' (' || coalesce((SELECT string_agg((i ->> 'procedimento') || ' qt ' || coalesce(i ->> 'quantidade', '?') || ' = ' || coalesce(i ->> 'valor_total', 'nulo'), '; ') FROM jsonb_array_elements(d -> 'itens') i), '') || ')'
      || '; total ' || coalesce(d ->> 'total_referencia', 'nulo') || '; pendências ' || jsonb_array_length(d -> 'pendencias')
      || ' [' || coalesce((SELECT string_agg(left(p ->> 'texto', 60), ' | ') FROM jsonb_array_elements(d -> 'pendencias') p), '') || ']'
      || '; bloqueantes sem liberação ' || coalesce(d ->> 'bloqueantes_sem_liberacao', '?')
    FROM (SELECT public.conta_detalhe(%L::uuid) d) x$q$, e2e.u('a03_conta')));
SELECT e2e.ba(3, 'a03_conta', 'A03.05.conta', 'A03.16.conferencia', 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('a03_conta'), 'em_conferencia'));
SELECT e2e.ba(3, 'a03_conta,a03_finalizada', 'A03.14.finalizar', 'A03.16.fechar', 'f5_fat', '/faturamento/contas', 'Faturamento fecha a conta',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('a03_conta'), 'fechada'), 'ok', 'a03_fechada');
SELECT CASE WHEN e2e.v('a03_conta') IS NULL OR e2e.v('a03_finalizada') IS NULL OR e2e.v('a03_fechada') IS NOT NULL THEN 'liberar: não precisou'
  ELSE e2e.ba_passo('A03.16.liberar', 3, 'f5_ges_upa', '/faturamento/contas', 'Gestora libera o fechamento com motivo (havia pendência bloqueante)',
    format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo A03: pendências conhecidas da rede de teste')::text, 200)$q$, e2e.u('a03_conta'))) END;
SELECT CASE WHEN e2e.v('a03_conta') IS NULL OR e2e.v('a03_finalizada') IS NULL OR e2e.v('a03_fechada') IS NOT NULL THEN 'fechar: já fechada ou bloqueada'
  ELSE e2e.ba_passo('A03.16.fechar_liberada', 3, 'f5_fat', '/faturamento/contas', 'Faturamento fecha a conta liberada',
    format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('a03_conta'), 'fechada'), 'ok', 'a03_fechada') END;
SELECT e2e.ba_passo('A03.16.bpa', 3, 'f5_fat', '/faturamento (BPA)', 'BPA da UPA: linhas do lactente e o aviso (não crítica) por falta de CNS',
  format($q$SELECT e2e.confere(count(*) >= 3, count(*) || ' linhas: ' || string_agg((x ->> 'procedimento') || ' ' || coalesce(x ->> 'destino', '') || ' qt ' || coalesce(x ->> 'quantidade', '?')
      || ' críticas ' || coalesce((x -> 'criticas')::text, '[]') || ' avisos ' || coalesce((x -> 'avisos')::text, '[]'), '; '))
    FROM jsonb_array_elements(public.bpa_conferencia(%L::uuid, %L) -> 'linhas') x WHERE x ->> 'paciente' = %L$q$,
    'f5100000-0000-4000-8000-000000000002', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), e2e.v('a03_nome')));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'A03.%' AND em >= e2e.v('a03_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
