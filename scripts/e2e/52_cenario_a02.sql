-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário A02, parte 1.
-- Gestante hipertensa no hiperdia e no pré-natal com envio que "não chegou" em
-- 12 h. Especificação: CENARIOS-A, seção A02.
--
-- Parte 1 (este arquivo): pré-condição do hiperdia antigo, painéis, consulta
-- agendada, pré-natal, escuta vermelha, envio à UPA e o ajuste que antecipa o
-- prazo de 12 h. Depois do commit, o cron REAL "encaminhamento-upa-prazo"
-- (a cada 15 min) marca o envio como nao_chegou.
-- Parte 2: 52b_cenario_a02_prazo.sql, rodado depois do cron.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas;
-- resultado em e2e.resultados (passos 'A02.NN.*', paciente = 2). Nada é
-- corrigido no produto. Paciente fictícia nova a cada rodada ("Marta A02
-- Teste", "... B"). A cor é a escolha da enfermeira de teste.
--
-- Rodar antes: 41_checkin_fase5.sql (e, uma vez, 49a_ambiente_bloco_a.sql).
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/52_cenario_a02.sql <saida>.sql
--                    npx supabase db query --linked -f <saida>.sql
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

-- ── rodada: nome, CNS e DUM da paciente ─────────────────────────────────────
SELECT e2e.guardar('a02_rodada', (coalesce(e2e.v('a02_rodada')::int, 0) + 1)::text);
SELECT e2e.guardar('a02_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'a02\_%' AND nome NOT IN ('a02_rodada', 'a02_inicio');
SELECT e2e.guardar('a02_nome', 'Marta A02 Teste' || CASE WHEN e2e.v('a02_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('a02_rodada')::int) ELSE '' END);
SELECT e2e.guardar('a02_cns', e2e.cns(70200 + e2e.v('a02_rodada')::int));
SELECT e2e.guardar('a02_dum', (private.data_atual() - 170)::text);
SELECT e2e.guardar('a02_cadastro', jsonb_build_object('nome', e2e.v('a02_nome'), 'data_nascimento', '1990-08-15', 'sexo', 'F',
  'raca_cor', 'parda', 'cns', e2e.v('a02_cns'), 'nome_mae', 'Mãe Fictícia do Teste A02', 'endereco', 'Rua do Teste, 2',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);

-- ── 0. pré-condição: hipertensa no hiperdia, consulta e PA há mais de 6 meses ─
SELECT e2e.ba(2, NULL, NULL, 'A02.00.ficha_antiga', 'f5_rec_ubs', '/recepcao (Nova ficha)', 'Recepção cadastra a paciente e abre a consulta do hiperdia (vai para o passado)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Consulta de rotina do hiperdia', NULL, %L::jsonb || '{"tipo_atendimento":"consulta_programada"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.v('a02_cadastro')), 'ok', 'a02_ep0');
SELECT e2e.ba(2, 'a02_ep0', 'A02.00.ficha_antiga', 'A02.00.paciente', 'banco', NULL, 'Paciente da UBS',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a02_ep0')), 'ok', 'a02_pac');
SELECT e2e.ba(2, 'a02_ep0', 'A02.00.ficha_antiga', 'A02.00.atender', 'f5_med_ubs', '/atendimento (UBS)', 'Médica abre o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a02_ep0')));
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.00.sinais', 'f5_med_ubs', '/atendimento (UBS)', 'PA, peso e altura crus da consulta antiga',
  e2e.ba_sinais(e2e.u('a02_pac'), '{"pressao-arterial-sistolica":150,"pressao-arterial-diastolica":95,"peso":70,"estatura":160}'));
SELECT e2e.ba(2, 'a02_ep0', 'A02.00.ficha_antiga', 'A02.00.soap', 'f5_med_ubs', '/atendimento (UBS)', 'SOAP com CID de hipertensão (I10)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Hipertensa em acompanhamento (teste A02)', 'PA 150x95, peso 70 kg, altura 160 cm', 'Hipertensão arterial sistêmica', 'Hiperdia, retorno', 'I10')::text$q$, e2e.u('a02_ep0')));
SELECT e2e.ba(2, 'a02_ep0', 'A02.00.ficha_antiga', 'A02.00.conduta', 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra com problema hipertensão, CID I10 e CIAP K86',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'consulta_programada', '{hipertensao_arterial}', '{I10}', '{retorno_cuidado_continuado}', 'Hiperdia (teste A02)', '{K86}')::text$q$, e2e.u('a02_ep0')));
-- (rodada 1: a conduta com o problema "hipertensão" já inclui a paciente no
--  hiperdia, origem 'consulta'; o programa_incluir manual vira a borda de duplicidade)
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.00.hiperdia_pela_conduta', 'banco', NULL, 'A conduta com o problema hipertensão inclui a paciente no hiperdia (origem consulta)',
  format($q$SELECT (SELECT id::text FROM public.programa_participantes WHERE paciente_id = %L AND programa = 'hipertensao' AND saida_em IS NULL AND origem = 'consulta')$q$,
    e2e.v('a02_pac')), 'ok', 'a02_prog');
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.00.hiperdia_manual', 'f5_med_ubs', '/hiperdia (Incluir)', 'Médica tenta incluir de novo pelo painel (programa_incluir): duplicidade recusada',
  format($q$SELECT public.programa_incluir(%L::uuid, 'hipertensao')::text$q$, e2e.u('a02_pac')), 'erro:O paciente já está no programa');
SELECT e2e.ba_ajuste(2, 'A02.00.datas', 'Consulta, sinais e entrada no hiperdia levados 200 dias para trás (mais de 6 meses)',
  e2e.ba_sql_passado(e2e.u('a02_ep0'), e2e.u('a02_pac'), 200)
  || format($q$; UPDATE public.programa_participantes SET entrada_em = entrada_em - interval '200 days' WHERE paciente_id = %L$q$, e2e.v('a02_pac')));
-- agendamento que uma rodada anterior deixou em aberto (rodada 1: marcado para
-- o dia seguinte por causa da virada da meia-noite) é cancelado pela recepção
DO $$
DECLARE a record;
BEGIN
  FOR a IN SELECT g.id FROM public.agendamentos g JOIN public.pacientes p ON p.id = g.paciente_id
            WHERE p.nome LIKE 'Marta A02 Teste%' AND p.nome <> e2e.v('a02_nome') AND g.situacao = 'agendado' LOOP
    PERFORM e2e.ba_passo('A02.00.cancela_agenda_rodada_anterior', 2, 'f5_rec_ubs', '/agenda-consultas', 'Recepção cancela o agendamento deixado por uma rodada anterior',
      format($q$SELECT public.agenda_cancelar(%L::uuid, 'Rodada anterior do teste A02 descartada (virada da meia-noite)')::text$q$, a.id));
  END LOOP;
END $$;

-- ── 1. gestor da UBS: painel do hiperdia com pendências ─────────────────────
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.01.painel', 'f5_ges_ubs', '/hiperdia', 'Painel: Marta com consulta e PA vencidas (mais de 6 meses)',
  format($q$SELECT e2e.confere((x ->> 'ultima_consulta')::timestamptz < now() - interval '6 months' AND (x ->> 'ultima_pa')::timestamptz < now() - interval '6 months',
      'última consulta ' || coalesce(x ->> 'ultima_consulta', 'nula') || ', última PA ' || coalesce(x ->> 'ultima_pa', 'nula') || ', programas ' || (x -> 'programas')::text)
    FROM jsonb_array_elements(public.hiperdia_painel(%L::uuid)) x WHERE x ->> 'paciente_id' = %L$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('a02_pac')));
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.01.do_paciente', 'f5_ges_ubs', '/hiperdia (paciente)', 'hiperdia_do_paciente mostra o programa hipertensão',
  format($q$SELECT e2e.confere((public.hiperdia_do_paciente(%L::uuid) -> 'programas')::text LIKE '%%hipertensao%%', left(public.hiperdia_do_paciente(%L::uuid)::text, 300))$q$,
    e2e.u('a02_pac'), e2e.u('a02_pac')));

-- ── 2. técnico da UBS: só lê ────────────────────────────────────────────────
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.02.tecnico_le_hiperdia', 'f5_tec_ubs', '/hiperdia', 'Técnico lê o painel do hiperdia',
  format($q$SELECT e2e.confere(public.hiperdia_painel(%L::uuid)::text LIKE '%%' || %L || '%%', 'Marta no painel lido pelo técnico')$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('a02_pac')));
SELECT e2e.ba_passo('A02.02.tecnico_le_pre_natal', 2, 'f5_tec_ubs', '/pre-natal', 'Técnico lê o painel do pré-natal',
  format('SELECT left(public.pre_natal_painel(%L::uuid)::text, 120)', 'f5100000-0000-4000-8000-000000000001'));
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.02.tecnico_nao_inclui', 'f5_tec_ubs', '/hiperdia (Incluir)', 'Técnico tenta incluir no programa (deve ser recusado)',
  format($q$SELECT public.programa_incluir(%L::uuid, 'diabetes')::text$q$, e2e.u('a02_pac')), 'erro:Acesso negado: inclui o médico ou o enfermeiro');

-- ── 3. recepção da UBS: consulta agendada de hoje ───────────────────────────
DO $$
DECLARE v_med uuid := 'f5200000-0000-4000-8000-000000000004'; v_base timestamptz; v_local timestamp; v_slot timestamptz;
BEGIN
  v_base := greatest(now(), coalesce((SELECT max(fim) FROM public.agendamentos WHERE perfil_id = v_med AND situacao <> 'cancelado'
                                         AND (inicio AT TIME ZONE 'America/Sao_Paulo')::date = private.data_atual()), now()));
  v_local := v_base AT TIME ZONE 'America/Sao_Paulo';
  v_local := date_trunc('hour', v_local) + make_interval(mins => 20 * (floor(extract(minute FROM v_local) / 20)::int + 1));
  -- antes das 7h a agenda (configurada pelo A01) só abre às 07:00
  IF v_local::time < time '07:00' THEN v_local := v_local::date + time '07:00'; END IF;
  v_slot := v_local AT TIME ZONE 'America/Sao_Paulo';
  PERFORM e2e.guardar('a02_slot', v_slot::text);
  PERFORM e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.03.marcar', 'f5_rec_ubs', '/agenda-consultas',
    'Recepção marca a consulta do hiperdia/pré-natal de hoje às ' || to_char(v_local, 'HH24:MI'),
    format($q$SELECT public.agenda_marcar(%L::uuid, %L::uuid, %L::timestamptz, %L::uuid, 'consulta_programada', 'Hiperdia e pré-natal (teste A02)', NULL)::text$q$,
      'f5100000-0000-4000-8000-000000000001', v_med, v_slot, e2e.u('a02_pac')), 'ok', 'a02_ag');
END $$;
SELECT e2e.ba(2, 'a02_ag', 'A02.03.marcar', 'A02.03.chegada', 'f5_rec_ubs', '/agenda-consultas', 'Recepção registra a chegada (episódio da consulta agendada)',
  format($q$SELECT (public.agenda_registrar_chegada(%L::uuid, %L::uuid, 'Consulta do hiperdia e pré-natal') ->> 'episodio_id')$q$,
    e2e.u('a02_ag'), 'f5300000-0000-4000-8000-000000000001'), 'ok', 'a02_ep3');
SELECT e2e.ba(2, 'a02_ep3', 'A02.03.chegada', 'A02.02.tecnico_nao_avalia_pes', 'f5_tec_ubs', '/atendimento (UBS)', 'Técnico tenta registrar a avaliação dos pés (deve ser recusado)',
  format($q$SELECT public.registrar_avaliacao_pes(%L::uuid, 'sem_alteracao', NULL)::text$q$, e2e.u('a02_ep3')), 'erro:Acesso negado: registra o médico ou o enfermeiro');

-- ── 4. médica da UBS: consulta que alimenta hiperdia e pré-natal ────────────
SELECT e2e.ba(2, 'a02_ep3', 'A02.03.chegada', 'A02.04.atender', 'f5_med_ubs', '/atendimento (UBS)', 'Médica abre o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a02_ep3')));
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.04.sinais', 'f5_med_ubs', '/atendimento (UBS) → HiperdiaNaConsulta', 'PA, peso e altura crus no "O"',
  e2e.ba_sinais(e2e.u('a02_pac'), '{"pressao-arterial-sistolica":146,"pressao-arterial-diastolica":92,"peso":72,"estatura":160}'));
SELECT e2e.ba(2, 'a02_ep3', 'A02.03.chegada', 'A02.04.soap', 'f5_med_ubs', '/atendimento (UBS)', 'SOAP: hipertensão prévia na gestação (O10.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Hipertensa, gestante de cerca de 24 semanas (teste A02)', 'PA 146x92, peso 72 kg, altura 160 cm', 'Hipertensão pré-existente complicando a gravidez', 'Hiperdia e pré-natal', 'O10.0')::text$q$, e2e.u('a02_ep3')));
SELECT e2e.ba(2, 'a02_pac,a02_ep3', 'A02.03.chegada', 'A02.04.pre_natal', 'f5_med_ubs', '/atendimento → pré-natal', 'Inclui no pré-natal com a DUM (hoje − 170 dias), ligado à consulta',
  format('SELECT public.pre_natal_incluir(%L::uuid, %L::date, %L::uuid)::text', e2e.u('a02_pac'), e2e.v('a02_dum'), e2e.u('a02_ep3')), 'ok', 'a02_gest');
SELECT e2e.ba(2, 'a02_ep3', 'A02.03.chegada', 'A02.04.conduta', 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra com problemas hipertensão e pré-natal, CID O10.0, CIAP K86 e W78; avaliação dos pés em branco',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'consulta_programada', '{hipertensao_arterial,pre_natal}', '{O10.0}', '{retorno_cuidado_continuado}', 'Hiperdia e pré-natal (teste A02)', '{K86,W78}')::text$q$, e2e.u('a02_ep3')));
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.04.hiperdia_hoje', 'f5_med_ubs', '/hiperdia (paciente)', 'hiperdia_do_paciente: consulta, PA e peso/altura com a data de hoje; pés sem registro',
  format($q$SELECT e2e.confere((h ->> 'ultima_consulta')::timestamptz >= now() - interval '1 minute' AND (h ->> 'ultima_pa')::timestamptz >= now() - interval '1 minute'
      AND (h ->> 'ultimo_peso_altura')::timestamptz >= now() - interval '1 minute' AND h ->> 'ultima_avaliacao_pes' IS NULL,
      'consulta ' || coalesce(h ->> 'ultima_consulta', '?') || ', PA ' || coalesce(h ->> 'ultima_pa', '?') || ', peso/altura ' || coalesce(h ->> 'ultimo_peso_altura', '?') || ', pés ' || coalesce(h ->> 'ultima_avaliacao_pes', 'sem registro'))
    FROM (SELECT public.hiperdia_do_paciente(%L::uuid) h) x$q$, e2e.u('a02_pac')));
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.04.pre_natal_hoje', 'f5_med_ubs', '/pre-natal (paciente)', 'pre_natal_do_paciente: a mesma consulta conta (consulta, PA e peso/altura de hoje)',
  format($q$SELECT e2e.confere((g ->> 'consultas')::int >= 1 AND (g ->> 'pa')::int >= 1 AND (g ->> 'peso_altura')::int >= 1 AND (g -> 'datas_consultas') ? private.data_atual()::text,
      'DUM ' || coalesce(g ->> 'dum', '?') || ', consultas ' || coalesce(g ->> 'consultas', '?') || ', pa ' || coalesce(g ->> 'pa', '?') || ', peso_altura ' || coalesce(g ->> 'peso_altura', '?') || ', datas ' || coalesce(g ->> 'datas_consultas', '?'))
    FROM (SELECT public.pre_natal_do_paciente(%L::uuid) -> 'gestacao' g) x$q$, e2e.u('a02_pac')));

-- ── bordas do hiperdia e do pré-natal ───────────────────────────────────────
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.B.painel_sem_linha_dupla', 'f5_ges_ubs', '/hiperdia', 'Marta aparece uma vez só no painel do hiperdia',
  format($q$SELECT e2e.confere(count(*) = 1, count(*) || ' linha(s)') FROM jsonb_array_elements(public.hiperdia_painel(%L::uuid)) x WHERE x ->> 'paciente_id' = %L$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('a02_pac')));
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.B.pre_natal_dum_futura', 'f5_med_ubs', '/pre-natal (Incluir)', 'pre_natal_incluir com DUM futura (deve ser recusado)',
  format('SELECT public.pre_natal_incluir(%L::uuid, %L::date, NULL)::text', e2e.u('a02_pac'), (private.data_atual() + 10)::text), 'erro:A DUM tem de ser de hoje para trás');
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.B.pre_natal_duplicado', 'f5_med_ubs', '/pre-natal (Incluir)', 'pre_natal_incluir de novo, com a DUM certa (deve ser recusado)',
  format('SELECT public.pre_natal_incluir(%L::uuid, %L::date, NULL)::text', e2e.u('a02_pac'), e2e.v('a02_dum')), 'erro:A paciente já está no pré-natal');
SELECT e2e.ba(2, 'a02_gest', 'A02.04.pre_natal', 'A02.B.definir_dum_futura', 'f5_enf_ubs', '/pre-natal (DUM)', 'pre_natal_definir_dum com DUM futura (deve ser recusado)',
  format('SELECT public.pre_natal_definir_dum(%L::uuid, %L::date)::text', e2e.u('a02_gest'), (private.data_atual() + 3)::text), 'erro:A DUM tem de ser de hoje para trás');

-- ── borda: escuta azul com orientação encerra sem fila do médico ────────────
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.B.azul_ficha', 'f5_rec_ubs', '/recepcao', 'Ficha de escuta inicial (dúvida sobre a medicação)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dúvida sobre o horário do remédio da pressão', %L::uuid, '{"tipo_atendimento":"escuta_inicial"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.u('a02_pac')), 'ok', 'a02_ep_azul');
SELECT e2e.ba(2, 'a02_ep_azul', 'A02.B.azul_ficha', 'A02.B.azul_consulta', 'f5_enf_ubs', '/escuta', 'Escuta azul com saída consulta (deve ser recusado)',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'azul', 'consulta', NULL, '{}'::jsonb, NULL, 'Orientada sobre o horário do remédio')::text$q$, e2e.u('a02_ep_azul')),
  'erro:Situação não aguda (azul)');
SELECT e2e.ba(2, 'a02_ep_azul', 'A02.B.azul_ficha', 'A02.B.azul_orientacao', 'f5_enf_ubs', '/escuta', 'Escuta azul (escolha da enfermeira de teste) com saída orientação',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'azul', 'orientacao', NULL, '{}'::jsonb, NULL, 'Orientada sobre o horário do remédio da pressão (teste A02)')::text$q$, e2e.u('a02_ep_azul')));
SELECT e2e.ba(2, 'a02_ep_azul', 'A02.B.azul_ficha', 'A02.B.azul_encerrou', 'banco', NULL, 'A escuta azul encerra o episódio, sem fila do médico',
  format($q$SELECT e2e.confere(etapa = 'encerrado' AND atendimento_iniciado_em IS NULL, 'etapa ' || etapa || ', cor ' || coalesce(cor_atual, '?')) FROM public.episodios WHERE id = %L$q$, e2e.u('a02_ep_azul')));

-- ── 5 e 6. volta à tarde: escuta vermelha e envio à UPA ─────────────────────
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.05.ficha', 'f5_rec_ubs', '/recepcao', 'Marta volta com cefaleia e PA alta: ficha escuta_inicial',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de cabeça e pressão alta', %L::uuid, '{"tipo_atendimento":"escuta_inicial"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.u('a02_pac')), 'ok', 'a02_ep5');
SELECT e2e.ba(2, 'a02_ep5', 'A02.05.ficha', 'A02.06.escuta', 'f5_enf_ubs', '/escuta',
  'Escuta com sinais crus; a enfermeira de teste classifica vermelho; saída consulta',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'vermelho', 'consulta', 'Cefaleia intensa e PA alta, gestante de 24 semanas',
    '{"pressao-arterial-sistolica":172,"pressao-arterial-diastolica":114,"frequencia-cardiaca":98}'::jsonb)::text$q$, e2e.u('a02_ep5')), 'ok', 'a02_class');
SELECT e2e.ba(2, 'a02_class', 'A02.06.escuta', 'A02.06.cor', 'banco', NULL, 'A cor gravada é a da enfermeira (vermelho, CAB 28, saída consulta)',
  format($q$SELECT e2e.confere(cor = 'vermelho' AND saida_escuta = 'consulta' AND autor_id = 'f5200000-0000-4000-8000-000000000002',
      'cor ' || cor || ', saída ' || coalesce(saida_escuta, '?') || ', protocolo ' || coalesce(protocolo, '?')) FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('a02_class')));
SELECT e2e.ba(2, 'a02_ep5', 'A02.05.ficha', 'A02.B.envio_propria_ubs', 'f5_enf_ubs', '/escuta → Enviar à UPA', 'Envio com a própria UBS como destino (deve ser recusado)',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Teste de destino inválido (A02)')::text$q$, e2e.u('a02_ep5'), 'f5100000-0000-4000-8000-000000000001'),
  'erro:Escolha uma UPA ou um hospital da rede');
SELECT e2e.ba(2, 'a02_ep5', 'A02.05.ficha', 'A02.06.enviar', 'f5_enf_ubs', '/escuta → Enviar à UPA', 'Enfermeira envia à UPA F5 pela própria escuta, com motivo',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Gestante hipertensa com cefaleia e PA 172x114 (teste A02)')::text$q$,
    e2e.u('a02_ep5'), 'f5100000-0000-4000-8000-000000000002'), 'ok', 'a02_env');
SELECT e2e.ba(2, 'a02_ep5', 'A02.05.ficha', 'A02.06.fila_medico', 'banco', NULL, 'Depois do envio, a ficha da escuta vermelha segue na fila do médico da UBS',
  format($q$SELECT e2e.confere(etapa = 'atendimento', 'etapa ' || etapa || ', encerrado ' || coalesce(encerrado_em::text, 'não')) FROM public.episodios WHERE id = %L$q$, e2e.u('a02_ep5')));

-- ── 7. gestor acompanha ─────────────────────────────────────────────────────
SELECT e2e.ba(2, 'a02_env', 'A02.06.enviar', 'A02.07.encaminhados', 'f5_ges_ubs', '/encaminhados', 'Linha "enviado" com a hora',
  format($q$SELECT e2e.confere(e ->> 'situacao' = 'enviado', 'situação ' || coalesce(e ->> 'situacao', '?') || ', enviado em ' || coalesce(e ->> 'enviado_em', '?') || ', prazo ' || coalesce(e ->> 'prazo_em', '?'))
    FROM jsonb_array_elements(public.encaminhamentos_upa_origem(%L::uuid, 7)) e WHERE (e ->> 'id')::uuid = %L::uuid$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('a02_env')));
SELECT e2e.ba(2, 'a02_env', 'A02.06.enviar', 'A02.07.do_paciente', 'f5_ges_ubs', '/encaminhados (paciente)', 'encaminhamentos_upa_do_paciente mostra o envio',
  format($q$SELECT e2e.confere(public.encaminhamentos_upa_do_paciente(%L::uuid)::text LIKE '%%' || %L || '%%', left(public.encaminhamentos_upa_do_paciente(%L::uuid)::text, 200))$q$,
    e2e.u('a02_pac'), e2e.v('a02_env'), e2e.u('a02_pac')));

-- ── 8. o prazo de 12 h: antecipado só na homologação; o cron real marca ─────
SELECT e2e.ba_ajuste(2, 'A02.08.antecipa_prazo', 'Envio levado 12 h 05 min para trás (enviado_em e prazo_em): o cron real encaminhamento-upa-prazo marca nao_chegou na próxima volta (*/15)',
  CASE WHEN e2e.v('a02_env') IS NULL THEN NULL ELSE
    format($q$UPDATE public.encaminhamentos_upa SET enviado_em = enviado_em - interval '12 hours 5 minutes', prazo_em = prazo_em - interval '12 hours 5 minutes' WHERE id = %L AND situacao = 'enviado'$q$, e2e.v('a02_env')) END);
SELECT e2e.guardar('a02_prazo_antecipado_em', now()::text);

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'A02.%' AND em >= e2e.v('a02_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
