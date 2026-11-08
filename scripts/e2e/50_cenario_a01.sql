-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário A01.
-- Pré-natal na UBS → pré-eclâmpsia grave e eclâmpsia na UPA → regulação ao
-- hospital → contrarreferência e conta. Especificação: CENARIOS-A, seção A01.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs das telas; o
-- resultado fica em e2e.resultados (passos 'A01.NN.*'). Nada é corrigido
-- durante a rodada: o que o produto recusa fica registrado como falha, e o que
-- dependia do passo recusado vira lacuna "bloqueado pelo passo X".
--
-- Regras do teste:
--   • paciente fictícia nova a cada rodada ("Gestante A01 Teste", "... B", ...),
--     CNS gerado por e2e.cns;
--   • prescrição SEM dose de memória: a dose é o texto
--     'conforme protocolo — dado fictício de teste de fluxo' (a RPC aceita texto);
--   • a cor da classificação é a escolha da enfermeira de teste (vermelho, como o
--     cenário indica nos passos 7 e 11);
--   • custos: nada é gravado como valor; o sistema calcula pelo SIGTAP.
--
-- Rodar antes: 41_checkin_fase5.sql e 47_framework_ampliacao.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/50_cenario_a01.sql <saida>.sql
--                    npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── apoio do roteiro (idênticos aos dos roteiros anteriores; recriados aqui) ─
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
CREATE OR REPLACE FUNCTION e2e.conferir(p_passo text, p_n int, p_descricao text, p_ok boolean, p_detalhe text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, 'banco', NULL, p_descricao, 'ok', CASE WHEN p_ok THEN 'ok' ELSE 'falha' END, p_detalhe);
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

-- sinais vitais crus como a tela grava (sincronizar_registros), com o método do peso
CREATE OR REPLACE FUNCTION e2e.a01_sinais(p_pac uuid, p_sinais jsonb, p_internacao uuid DEFAULT NULL, p_metodo text DEFAULT NULL)
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT format($q$SELECT CASE WHEN bool_and(x ->> 'status' = 'gravado') THEN count(*)::text || ' sinais gravados'
                             ELSE e2e.falhar(string_agg(coalesce(x ->> 'motivo', x::text), '; ')) END
                     FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)::jsonb) x$q$,
    (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'observacao', 'hora', now(), 'sem_conexao', false,
              'aparelho_id', 'e2e-a01',
              'dados', jsonb_build_object('paciente_id', p_pac, 'internacao_id', p_internacao,
                         'conceito_id', (SELECT c.id FROM public.conceito c WHERE c.nome = k.key AND c.unidade_id IS NULL),
                         'valor_num', k.value, 'origem', 'manual', 'metodo', p_metodo)))
       FROM jsonb_each(p_sinais) k))
$$;

-- conferência no banco, como postgres (o que a tela não mostra)
CREATE OR REPLACE FUNCTION e2e.a01_banco(p_passo text, p_descricao text, p_sql text, p_guardar text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
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
  VALUES (p_passo, 1, 'banco', NULL, p_descricao, 'ok', v_sit, v_det);
  RETURN v_sit || ' — ' || p_passo || ' — ' || coalesce(v_det, '');
END $$;

-- passo que depende de um id de passo anterior: sem o id, vira lacuna "bloqueado"
CREATE OR REPLACE FUNCTION e2e.a01(p_dep text, p_dep_passo text, p_passo text, p_papel text, p_rota text, p_descricao text,
                                  p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_dep IS NOT NULL AND e2e.v(p_dep) IS NULL THEN
    RETURN e2e.lacuna(p_passo, 1, p_papel, p_descricao, 'bloqueado pelo passo ' || p_dep_passo || ' (sem ' || p_dep || ')');
  END IF;
  IF p_papel = 'banco' THEN   -- conferência no banco (como postgres), não um papel do app
    RETURN e2e.a01_banco(p_passo, p_descricao, p_sql, p_guardar);
  END IF;
  RETURN e2e.passo(p_passo, 1, p_papel, p_rota, p_descricao, p_sql, p_esperado, p_guardar);
END $$;

-- ajuste de ambiente (datas passadas do pré-natal) que não derruba a rodada se falhar
CREATE OR REPLACE FUNCTION e2e.a01_ajuste(p_passo text, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe)
    VALUES (p_passo, 1, p_descricao, 'ajuste', 'ajuste', left(p_sql, 400));
    RETURN 'ajuste — ' || p_passo;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe)
    VALUES (p_passo, 1, p_descricao, 'ajuste', 'falha', 'ajuste recusado: ' || SQLERRM);
    RETURN 'falha — ' || p_passo;
  END;
END $$;

-- SQL do ajuste que leva uma consulta da UBS (episódio e sinais de agora) para o passado
CREATE OR REPLACE FUNCTION e2e.a01_sql_passado(p_ep uuid, p_pac uuid, p_dias int) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format($q$UPDATE public.episodios SET chegada_em = chegada_em - %1$L::interval,
                     atendimento_iniciado_em = atendimento_iniciado_em - %1$L::interval,
                     classificado_em = classificado_em - %1$L::interval, desfecho_em = desfecho_em - %1$L::interval,
                     encerrado_em = encerrado_em - %1$L::interval WHERE id = %2$L;
                   UPDATE public.observacao SET aferido_em = aferido_em - %1$L::interval
                    WHERE paciente_id = %3$L AND aferido_em >= now() - interval '1 minute'$q$,
                p_dias || ' days', p_ep, p_pac)
$$;

-- ── rodada: nome, CNS e DUM da paciente ─────────────────────────────────────
SELECT e2e.guardar('a01_rodada', (coalesce(e2e.v('a01_rodada')::int, 0) + 1)::text);
SELECT e2e.guardar('a01_inicio', now()::text);
SELECT e2e.guardar('a01_nome', 'Gestante A01 Teste' || CASE WHEN e2e.v('a01_rodada')::int > 1 THEN ' ' || chr(63 + e2e.v('a01_rodada')::int + 1) ELSE '' END);
SELECT e2e.guardar('a01_cns', e2e.cns(9100 + e2e.v('a01_rodada')::int));
SELECT e2e.guardar('a01_dum', (private.data_atual() - 230)::text);
-- ids que a rodada anterior deixou não valem nesta
DELETE FROM e2e.vars WHERE nome LIKE 'a01\_%' AND nome NOT IN ('a01_rodada', 'a01_inicio', 'a01_nome', 'a01_cns', 'a01_dum');
SELECT e2e.guardar('a01_cadastro', jsonb_build_object('nome', e2e.v('a01_nome'), 'data_nascimento', '1997-05-10', 'sexo', 'F',
  'raca_cor', 'parda', 'cns', e2e.v('a01_cns'), 'nome_mae', 'Mãe Fictícia do Teste A01', 'endereco', 'Rua do Teste, 1',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);

-- ── 0. pré-condições do cenário ─────────────────────────────────────────────
SELECT e2e.passo('A01.00.agenda', 1, 'f5_ges_ubs', '/agenda-consultas (configuração)',
  'Gestor da UBS configura a agenda da médica (manhã, tarde e noite, 20 min), para haver horário ainda hoje',
  format($q$SELECT public.agenda_definir_configuracao(%L::uuid, %L::uuid,
    (SELECT jsonb_agg(h) FROM generate_series(0, 6) d, LATERAL (VALUES
       (jsonb_build_object('dia', d, 'periodo', 'manha', 'inicio', '07:00', 'fim', '12:00', 'duracao', 20)),
       (jsonb_build_object('dia', d, 'periodo', 'tarde', 'inicio', '13:00', 'fim', '19:00', 'duracao', 20)),
       (jsonb_build_object('dia', d, 'periodo', 'noite', 'inicio', '19:00', 'fim', '23:40', 'duracao', 20))) v(h)))::text$q$,
    'f5100000-0000-4000-8000-000000000001', 'f5200000-0000-4000-8000-000000000004'));
SELECT e2e.passo('A01.00.bpa_' || x.uso, 1, 'f5_fat', '/faturamento (BPA)', 'Faturamento associa o SIGTAP ' || x.cod || ' ao uso ' || x.uso || ' na UPA',
  format('SELECT public.associar_procedimento_bpa(%L::uuid, %L, %L)::text', 'f5100000-0000-4000-8000-000000000002', x.cod, x.uso))
  FROM (VALUES ('classificacao', '0301060118'), ('atendimento_medico', '0301060096'), ('medicacao', '0301100012')) x(uso, cod);
SELECT e2e.passo('A01.00.alta_vigilancia', 1, 'f5_farm', '/alta-vigilancia', 'Farmacêutico confere que o sulfato de magnésio é alta vigilância na UPA',
  format($q$SELECT e2e.confere(public.alta_vigilancia_da_unidade(%L::uuid, 'magn')::text ILIKE '%%Sulfato de magn%%', left(public.alta_vigilancia_da_unidade(%L::uuid, 'magn')::text, 300))$q$,
    'f5100000-0000-4000-8000-000000000002', 'f5100000-0000-4000-8000-000000000002'));

-- ── 1. recepção da UBS: cadastro e 1ª consulta do pré-natal ─────────────────
SELECT e2e.passo('A01.01.ficha', 1, 'f5_rec_ubs', '/recepcao (Nova ficha)', 'Recepção cadastra a gestante e abre a ficha consulta_programada (1ª consulta do pré-natal)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Primeira consulta do pré-natal', NULL, %L::jsonb || '{"tipo_atendimento":"consulta_programada"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.v('a01_cadastro')), 'ok', 'a01_ep1');
SELECT e2e.a01('a01_ep1', 'A01.01.ficha', 'A01.01.paciente', 'f5_rec_ubs', '/recepcao', 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a01_ep1')), 'ok', 'a01_pac');
SELECT e2e.a01('a01_ep1', 'A01.01.ficha', 'A01.01.tipo_aps', 'f5_rec_ubs', '/recepcao', 'Episódio aberto na UBS como consulta_programada',
  format($q$SELECT e2e.confere(tipo_atendimento_aps = 'consulta_programada', 'tipo ' || tipo_atendimento_aps || ', etapa ' || etapa) FROM public.episodios WHERE id = %L$q$, e2e.u('a01_ep1')));
SELECT e2e.a01('a01_ep1', 'A01.01.ficha', 'A01.01.ubs_sem_valor', 'f5_ges_ubs', '/faturamento', 'A conta da UBS (se houver) não ganha item com valor',
  format($q$SELECT e2e.confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND jsonb_array_length(public.conta_detalhe((c ->> 'id')::uuid) -> 'itens') > 0), 'UBS sem item com valor')$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('a01_nome')));

-- ── 2. escuta inicial (enfermagem da UBS) ───────────────────────────────────
SELECT e2e.a01('a01_ep1', 'A01.01.ficha', 'A01.02.tecnico_nao_escuta', 'f5_tec_ubs', '/escuta', 'Técnico tenta fazer a escuta (deve ser recusado)',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'verde', 'consulta')::text$q$, e2e.u('a01_ep1')), 'erro:A escuta inicial e a classificação são do enfermeiro');
SELECT e2e.a01('a01_ep1', 'A01.01.ficha', 'A01.02.escuta', 'f5_enf_ubs', '/escuta',
  'Enfermeira faz a escuta com sinais crus e saída consulta (cor verde: escolha da enfermeira de teste, o cenário não indica)',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'verde', 'consulta', 'Primeira consulta do pré-natal, sem queixas',
    '{"pressao-arterial-sistolica":110,"pressao-arterial-diastolica":70,"frequencia-cardiaca":82,"peso":62,"estatura":162}'::jsonb)::text$q$, e2e.u('a01_ep1')));

-- ── 3. médica da UBS: SOAP, pré-natal e conduta (IG 10 s) ───────────────────
SELECT e2e.a01('a01_ep1', 'A01.01.ficha', 'A01.03.atender', 'f5_med_ubs', '/atendimento (UBS)', 'Médica abre o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a01_ep1')));
SELECT e2e.a01('a01_pac', 'A01.01.paciente', 'A01.03.sinais', 'f5_med_ubs', '/atendimento (UBS)', 'Sinais crus da consulta: PA, peso e altura em cm',
  e2e.a01_sinais(e2e.u('a01_pac'), '{"pressao-arterial-sistolica":110,"pressao-arterial-diastolica":70,"peso":62,"estatura":162}'));
SELECT e2e.a01('a01_ep1', 'A01.01.ficha', 'A01.03.soap', 'f5_med_ubs', '/atendimento (UBS)', 'SOAP da 1ª consulta com CID de gestação (Z34.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'G2P1A0, sem queixas (teste A01)', 'PA 110x70, peso 62 kg, altura 162 cm', 'Gestação de 10 semanas, risco habitual', 'Pré-natal de rotina', 'Z34.9')::text$q$, e2e.u('a01_ep1')));
SELECT e2e.a01('a01_pac', 'A01.01.paciente', 'A01.03.pre_natal', 'f5_med_ubs', '/atendimento (UBS) → pré-natal', 'Inclui no pré-natal com a DUM, ligado à consulta',
  format('SELECT public.pre_natal_incluir(%L::uuid, %L::date, %L::uuid)::text', e2e.u('a01_pac'), e2e.v('a01_dum'), e2e.u('a01_ep1')), 'ok', 'a01_gest');
SELECT e2e.a01('a01_ep1', 'A01.01.ficha', 'A01.03.conduta', 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra com problema pré-natal, CID Z34.9 e CIAP W78',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'consulta_programada', '{pre_natal}', '{Z34.9}', '{retorno_cuidado_continuado}', 'Pré-natal de risco habitual (teste A01)', '{W78}')::text$q$, e2e.u('a01_ep1')));
SELECT CASE WHEN e2e.v('a01_ep1') IS NULL THEN e2e.lacuna('A01.03.datas', 1, NULL, 'Consulta 1 levada à IG de 10 semanas', 'bloqueado pelo passo A01.01.ficha')
  ELSE e2e.a01_ajuste('A01.03.datas', 'Consulta 1 levada à IG de 10 semanas (DUM + 70 d): datas do episódio e dos sinais no passado',
    e2e.a01_sql_passado(e2e.u('a01_ep1'), e2e.u('a01_pac'), 160)) END;
SELECT e2e.a01('a01_pac', 'A01.01.paciente', 'A01.03.primeira', 'f5_enf_ubs', '/pre-natal', 'pre_natal_do_paciente mostra a 1ª consulta até 12 semanas',
  format($q$SELECT e2e.confere((g ->> 'primeira_consulta')::date <= (g ->> 'dum')::date + 84, 'primeira ' || coalesce(g ->> 'primeira_consulta', 'nula') || ', DUM ' || coalesce(g ->> 'dum', 'nula'))
    FROM (SELECT public.pre_natal_do_paciente(%L::uuid) -> 'gestacao' g) x$q$, e2e.u('a01_pac')));

-- ── 4 e 5. consultas seguintes pela agenda (IG 16, 22 e 28 s) ───────────────
DO $$
DECLARE
  k int; ig int; v_slot timestamptz; v_base timestamptz; v_local timestamp;
  v_med uuid := 'f5200000-0000-4000-8000-000000000004';
BEGIN
  FOR k IN 1..3 LOOP
    ig := 10 + 6 * k;
    -- próximo horário da grade (20 min) depois de agora e de todo agendamento de hoje da médica
    -- (o realizado libera o horário, mas a agenda do dia mostra um agendamento por horário)
    v_base := greatest(now(), coalesce((SELECT max(fim) FROM public.agendamentos WHERE perfil_id = v_med AND situacao <> 'cancelado'
                                           AND (inicio AT TIME ZONE 'America/Sao_Paulo')::date = private.data_atual()), now()));
    v_local := v_base AT TIME ZONE 'America/Sao_Paulo';
    v_local := date_trunc('hour', v_local) + make_interval(mins => 20 * (floor(extract(minute FROM v_local) / 20)::int + 1));
    v_slot := v_local AT TIME ZONE 'America/Sao_Paulo';
    PERFORM e2e.a01('a01_pac', 'A01.01.paciente', 'A01.04.marcar_ig' || ig, 'f5_rec_ubs', '/agenda-consultas',
      'Recepção marca a consulta do pré-natal (IG ' || ig || ' s) para ' || to_char(v_local, 'HH24:MI'),
      format($q$SELECT public.agenda_marcar(%L::uuid, %L::uuid, %L::timestamptz, %L::uuid, 'consulta_programada', %L, NULL)::text$q$,
        'f5100000-0000-4000-8000-000000000001', v_med, v_slot, e2e.u('a01_pac'), 'Pré-natal IG ' || ig || ' s (teste A01)'),
      'ok', 'a01_ag' || ig);
    PERFORM e2e.a01('a01_ag' || ig, 'A01.04.marcar_ig' || ig, 'A01.04.chegada_ig' || ig, 'f5_rec_ubs', '/agenda-consultas',
      'Recepção registra a chegada (abre episódio consulta_agendada/programada)',
      format($q$SELECT (public.agenda_registrar_chegada(%L::uuid, %L::uuid, 'Consulta de pré-natal') ->> 'episodio_id')$q$,
        e2e.u('a01_ag' || ig), 'f5300000-0000-4000-8000-000000000001'), 'ok', 'a01_ep' || ig);
    PERFORM e2e.a01('a01_ep' || ig, 'A01.04.chegada_ig' || ig, 'A01.05.atender_ig' || ig, 'f5_med_ubs', '/atendimento (UBS)', 'Médica abre o atendimento',
      format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a01_ep' || ig)));
    PERFORM e2e.a01('a01_ep' || ig, 'A01.04.chegada_ig' || ig, 'A01.05.sinais_ig' || ig, 'f5_med_ubs', '/atendimento (UBS)', 'PA, peso e altura crus',
      e2e.a01_sinais(e2e.u('a01_pac'), jsonb_build_object('pressao-arterial-sistolica', 112 + 2 * k, 'pressao-arterial-diastolica', 72 + k,
                                                          'peso', 62 + 2 * k, 'estatura', 162)));
    PERFORM e2e.a01('a01_ep' || ig, 'A01.04.chegada_ig' || ig, 'A01.05.soap_ig' || ig, 'f5_med_ubs', '/atendimento (UBS)', 'SOAP com a PA no Objetivo',
      format($q$SELECT public.registrar_soap(%L::uuid, 'Sem queixas (teste A01)', %L, 'Gestação de %s semanas, risco habitual', 'Pré-natal de rotina', 'Z34.9')::text$q$,
        e2e.u('a01_ep' || ig), 'PA ' || (112 + 2 * k) || 'x' || (72 + k) || ', peso ' || (62 + 2 * k) || ' kg, altura 162 cm', ig));
    PERFORM e2e.a01('a01_ep' || ig, 'A01.04.chegada_ig' || ig, 'A01.05.conduta_ig' || ig, 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra a consulta do pré-natal',
      format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'consulta_programada', '{pre_natal}', '{Z34.9}', '{retorno_cuidado_continuado}', NULL, '{W78}')::text$q$,
        e2e.u('a01_ep' || ig)));
    PERFORM e2e.a01('a01_ag' || ig, 'A01.04.marcar_ig' || ig, 'A01.04.realizado_ig' || ig, 'f5_rec_ubs', '/agenda-consultas', 'O agendamento passa a realizado',
      format($q$SELECT e2e.confere(x ->> 'situacao' = 'realizado', 'situação ' || coalesce(x ->> 'situacao', 'não achada'))
        FROM (SELECT (SELECT y FROM jsonb_path_query(public.agenda_dia(%L::uuid, private.data_atual()), 'strict $.**') y
                       WHERE jsonb_typeof(y) = 'object' AND y ->> 'id' = %L LIMIT 1) x) z$q$,
        'f5100000-0000-4000-8000-000000000001', e2e.v('a01_ag' || ig)));
    IF e2e.v('a01_ep' || ig) IS NOT NULL THEN
      PERFORM e2e.a01_ajuste('A01.05.datas_ig' || ig, 'Consulta levada à IG de ' || ig || ' semanas (DUM + ' || ig * 7 || ' d)',
        e2e.a01_sql_passado(e2e.u('a01_ep' || ig), e2e.u('a01_pac'), 230 - ig * 7));
    END IF;
  END LOOP;
END $$;
SELECT e2e.a01('a01_pac', 'A01.01.paciente', 'A01.05.painel_paciente', 'f5_med_ubs', '/pre-natal', 'Painel da gestante: consultas, PA e peso/altura com as datas',
  format($q$SELECT e2e.confere((g ->> 'consultas')::int >= 4 AND (g ->> 'pa')::int >= 4 AND (g ->> 'peso_altura')::int >= 4,
      'consultas ' || coalesce(g ->> 'consultas', '?') || ', pa ' || coalesce(g ->> 'pa', '?') || ', peso_altura ' || coalesce(g ->> 'peso_altura', '?')
      || ', datas ' || coalesce(g ->> 'datas_consultas', '?'))
    FROM (SELECT public.pre_natal_do_paciente(%L::uuid) -> 'gestacao' g) x$q$, e2e.u('a01_pac')));

-- ── 6. gestor da UBS: painel do pré-natal ───────────────────────────────────
SELECT e2e.a01('a01_pac', 'A01.01.paciente', 'A01.06.painel', 'f5_ges_ubs', '/pre-natal', 'Gestor vê a gestante no painel do pré-natal da unidade',
  format($q$SELECT coalesce((SELECT left(y::text, 380) FROM jsonb_path_query(public.pre_natal_painel(%L::uuid), 'strict $.**') y
      WHERE jsonb_typeof(y) = 'object' AND y ->> 'paciente_id' = %L LIMIT 1), e2e.falhar('gestante fora do painel'))$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('a01_pac')));
SELECT e2e.passo('A01.06.recepcao_sem_painel', 1, 'f5_rec_ubs', '/pre-natal', 'Recepção não vê o painel do pré-natal (deve ser recusado)',
  format('SELECT public.pre_natal_painel(%L::uuid)::text', 'f5100000-0000-4000-8000-000000000001'), 'erro');

-- ── 7. consulta de hoje (IG ~33 s): escuta vermelha ─────────────────────────
SELECT e2e.a01('a01_pac', 'A01.01.paciente', 'A01.07.ficha', 'f5_rec_ubs', '/recepcao', 'Recepção abre a ficha de escuta inicial de hoje',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de cabeça forte e inchaço no rosto', %L::uuid, '{"tipo_atendimento":"escuta_inicial"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.u('a01_pac')), 'ok', 'a01_ep7');
SELECT e2e.a01('a01_ep7', 'A01.07.ficha', 'A01.07.escuta', 'f5_enf_ubs', '/escuta',
  'Escuta com PA elevada, cefaleia e edema (crus); a enfermeira de teste classifica vermelho; saída consulta',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'vermelho', 'consulta', 'Cefaleia intensa, edema de face e mãos, gestante de 33 semanas',
    '{"pressao-arterial-sistolica":168,"pressao-arterial-diastolica":112,"frequencia-cardiaca":96,"peso":74,"estatura":162}'::jsonb)::text$q$, e2e.u('a01_ep7')));

-- ── 8. médica da UBS: hipótese de pré-eclâmpsia grave e envio à UPA ─────────
SELECT e2e.a01('a01_ep7', 'A01.07.ficha', 'A01.08.atender', 'f5_med_ubs', '/atendimento (UBS)', 'Médica abre o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a01_ep7')));
SELECT e2e.a01('a01_ep7', 'A01.07.ficha', 'A01.08.soap', 'f5_med_ubs', '/atendimento (UBS)', 'SOAP com hipótese de pré-eclâmpsia grave (O14.1)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Cefaleia intensa e edema desde ontem (teste A01)', 'PA 168x112, edema de face e mãos', 'Pré-eclâmpsia grave provável', 'Envio à UPA', 'O14.1')::text$q$, e2e.u('a01_ep7')));
SELECT e2e.a01('a01_ep7', 'A01.07.ficha', 'A01.08.enviar', 'f5_med_ubs', '/atendimento → EnviarUpa', 'Envia à UPA F5 com motivo',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Suspeita de pré-eclâmpsia grave: PA 168x112, cefaleia e edema (teste A01)')::text$q$,
    e2e.u('a01_ep7'), 'f5100000-0000-4000-8000-000000000002'), 'ok', 'a01_env');
SELECT e2e.a01('a01_ep7', 'A01.07.ficha', 'A01.08.conduta', 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra a consulta da UBS com encaminhamento para urgência (CIAP W81)',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'escuta_inicial', '{pre_natal}', '{O14.1}', '{encaminhamento_urgencia}', 'Enviada à UPA F5 (teste A01)', '{W81}')::text$q$, e2e.u('a01_ep7')));

-- ── 9. gestor da UBS acompanha o envio ──────────────────────────────────────
SELECT e2e.a01('a01_env', 'A01.08.enviar', 'A01.09.encaminhados', 'f5_ges_ubs', '/encaminhados', 'Linha "enviado" com hora',
  format($q$SELECT e2e.confere(e ->> 'situacao' = 'enviado', 'situação ' || coalesce(e ->> 'situacao', '?') || ', enviado em ' || coalesce(e ->> 'enviado_em', '?'))
    FROM jsonb_array_elements(public.encaminhamentos_upa_origem(%L::uuid, 7)) e WHERE (e ->> 'id')::uuid = %L::uuid$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('a01_env')));

-- ── 10. recepção da UPA: vinda da UBS, ficha e "Chegou" ─────────────────────
SELECT e2e.a01('a01_env', 'A01.08.enviar', 'A01.10.vindo', 'f5_rec_upa', '/recepcao → VindoDaUbs', 'Vê a gestante vinda da UBS com queixa, cor da escuta, SOAP e sinais',
  format($q$SELECT e2e.confere(e::text LIKE '%%vermelho%%' AND e::text LIKE '%%O14.1%%' AND e::text LIKE '%%pressao-arterial-sistolica%%' AND e::text LIKE '%%Dor de cabeça%%',
      left(e::text, 300))
    FROM jsonb_array_elements(public.encaminhamentos_upa_destino(%L::uuid)) e WHERE (e ->> 'id')::uuid = %L::uuid$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a01_env')));
SELECT e2e.passo('A01.10.ficha', 1, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção da UPA abre a ficha no Pronto Socorro (prioridade gestante)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Gestante com dor de cabeça e pressão alta (vinda da UBS)', NULL, %L::jsonb, '{gestante}') ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('a01_cadastro')), 'ok', 'a01_epu');
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.10.paciente', 'f5_rec_upa', '/recepcao', 'Paciente da UPA',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a01_epu')), 'ok', 'a01_pacu');
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.10.chegou', 'f5_rec_upa', '/recepcao → VindoDaUbs', 'Marca "Chegou" com a ficha escolhida',
  format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid)::text', e2e.u('a01_env'), e2e.u('a01_epu')));
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.10.conta', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial aberta, sem itens',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' AND c ->> 'status' = 'aberta'
        AND jsonb_array_length(public.conta_detalhe((c ->> 'id')::uuid) -> 'itens') = 0 LIMIT 1), e2e.falhar('conta aberta sem itens não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a01_nome')), 'ok', 'a01_conta');

-- ── 11. triagem da UPA: chamada e classificação vermelha ────────────────────
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.11.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('a01_epu'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.lacuna('A01.11.fluxograma_gestante', 1, 'f5_enf_upa', 'Fluxograma "Gestante" na triagem',
  'Lacuna (MAPA): o protocolo Aparecida 2025 não tem fluxograma obstétrico; a enfermeira usa "Dor de cabeça" (adulto) e escreve o discriminador (livre), porque os vermelhos do fluxograma são só "Convulsão ativa" e "Sinais de choque".');
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.11.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica vermelho (escolha da enfermeira de teste), sinais crus, fluxograma adulto e bloco de gestação G2P1A0 com DUM',
  format($q$SELECT public.classificar_risco(%L::uuid, 'vermelho',
    '{"frequencia-cardiaca":98,"frequencia-respiratoria":20,"temperatura":36.6,"saturacao-o2":97,"escala-dor":8,"pressao-arterial-sistolica":170,"pressao-arterial-diastolica":112}'::jsonb,
    (SELECT f.id FROM public.protocolo_fluxogramas f JOIN public.unidades u ON u.protocolo_classificacao_id = f.protocolo_id
      WHERE u.id = %L AND f.nome = 'Dor de cabeça' AND f.publico = 'adulto'),
    'Gestante com PA 170x112, cefaleia intensa e edema: suspeita de pré-eclâmpsia grave', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true, NULL, NULL,
    %L::jsonb)::text$q$, e2e.u('a01_epu'), 'f5100000-0000-4000-8000-000000000002',
    jsonb_build_object('tipo', 'gestacao_unica', 'g', 2, 'p', 1, 'a', 0, 'dum', e2e.v('a01_dum'), 'intercorrencias', true,
                       'intercorrencias_texto', 'PA elevada, cefaleia e edema na UBS hoje')), 'ok', 'a01_class');
SELECT e2e.a01('a01_class', 'A01.11.classificar', 'A01.11.cor', 'banco', NULL, 'A cor gravada é a da enfermeira e o bloco de gestação calcula a IG',
  format($q$SELECT e2e.confere(cor = 'vermelho' AND gestacao ->> 'ig_semanas' = '32', 'cor ' || cor || ', gestação ' || coalesce(gestacao::text, 'nula'))
    FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('a01_class')));
SELECT e2e.a01('a01_conta', 'A01.10.conta', 'A01.11.conta_acolhimento', 'f5_fat', '/faturamento/contas', 'Item "acolhimento com classificação" nasce na conta',
  format($q$SELECT e2e.confere(public.conta_detalhe(%L::uuid) -> 'itens' @> '[{"procedimento":"0301060118"}]' OR (public.conta_detalhe(%L::uuid) -> 'itens')::text LIKE '%%0301060118%%',
      left((public.conta_detalhe(%L::uuid) -> 'itens')::text, 300))$q$, e2e.u('a01_conta'), e2e.u('a01_conta'), e2e.u('a01_conta')));

-- ── 12. médico da UPA: assume, peso referido, SOAP ──────────────────────────
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.12.iniciar', 'f5_med_upa', '/atendimento (JanelaAtendimento)', 'Médico assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a01_epu')));
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.12.enf_nao_reclassifica', 'f5_enf_upa', '/triagem', 'Enfermeira tenta reclassificar depois que o médico assumiu (deve ser recusado)',
  format($q$SELECT public.classificar_risco(%L::uuid, 'vermelho', '{"frequencia-cardiaca":98,"frequencia-respiratoria":20,"temperatura":36.6,"saturacao-o2":97,"escala-dor":8,"pressao-arterial-sistolica":170,"pressao-arterial-diastolica":112}'::jsonb,
    NULL, NULL, '{}'::jsonb, NULL, 'Reclassificação de teste depois do médico')::text$q$, e2e.u('a01_epu')), 'erro:O atendimento médico já começou');
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.12.sem_peso', 'f5_med_upa', '/atendimento (Prescrição)', 'Prescrição sem peso do atendimento é recusada pelo servidor',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a01_pacu'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '0b13f981-90da-4237-93d7-d118d2055cfa', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora')), 'erro:Falta para prescrever');
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.12.peso_referido', 'f5_med_upa', '/atendimento (Prescrição → peso)', 'Médico registra o peso referido pela paciente',
  e2e.a01_sinais(e2e.u('a01_pacu'), '{"peso":74}', NULL, 'referido'));
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.12.soap', 'f5_med_upa', '/atendimento (AbaAtendimento)', 'SOAP com CID de pré-eclâmpsia grave (O14.1)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Gestante de 33 semanas, cefaleia e edema (teste A01)', 'PA 170x112, sem convulsão', 'Pré-eclâmpsia grave', 'Conduta conforme a ficha adulto-emergencia-hipertensiva (teste de fluxo)', 'O14.1')::text$q$,
    e2e.u('a01_epu')));
SELECT e2e.lacuna('A01.12.ficha_obstetrica', 1, 'f5_med_upa', 'Ficha própria de pré-eclâmpsia, eclâmpsia ou sulfato de magnésio na Central',
  'Lacuna (MAPA): só o bloco dentro de adulto-emergencia-hipertensiva (/plantonista/emergencias/emergencia-hipertensiva-adulto); conferência na tela.');
SELECT e2e.lacuna('A01.12.meows', 1, 'f5_med_upa', 'Escore obstétrico (MEOWS)', 'Lacuna (MAPA): não existe; news2 diz que não se aplica à gestante (conferir a mensagem na tela).');
SELECT e2e.a01('a01_conta', 'A01.10.conta', 'A01.12.conta_consulta', 'f5_fat', '/faturamento/contas', 'Item "consulta médica" nasce na conta',
  format($q$SELECT e2e.confere((public.conta_detalhe(%L::uuid) -> 'itens')::text LIKE '%%0301060096%%', left((public.conta_detalhe(%L::uuid) -> 'itens')::text, 300))$q$,
    e2e.u('a01_conta'), e2e.u('a01_conta')));

-- ── 13. prescrição (dose: texto de teste, nunca dose de memória) ────────────
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.13.magnesio_ataque', 'f5_med_upa', '/atendimento (Prescrição)',
  'Sulfato de magnésio, ataque, "Agora"; dose = texto de teste (conforme adulto-emergencia-hipertensiva)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a01_pacu'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '0b13f981-90da-4237-93d7-d118d2055cfa', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora', 'observacao', 'Ataque conforme a ficha adulto-emergencia-hipertensiva (teste de fluxo)')),
  'ok', 'a01_item_mg');
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.13.magnesio_manutencao', 'f5_med_upa', '/atendimento (Prescrição)',
  'Sulfato de magnésio, manutenção, "Contínuo", junto com o ataque (mesma via)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a01_pacu'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '0b13f981-90da-4237-93d7-d118d2055cfa', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Contínuo', 'observacao', 'Manutenção conforme a ficha adulto-emergencia-hipertensiva (teste de fluxo)')),
  'ok', 'a01_item_mg_manut');
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.13.hidralazina', 'f5_med_upa', '/atendimento (Prescrição)',
  'Hidralazina "Se necessário"; dose = texto de teste (conforme adulto-emergencia-hipertensiva)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a01_pacu'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', 'b46fb4dd-f671-4a72-b73d-42066d2538da', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Se necessário', 'se_necessario', true,
                       'observacao', 'Conforme a ficha adulto-emergencia-hipertensiva (teste de fluxo)')),
  'ok', 'a01_item_hid');
-- (prescricao_porta_ativa só lista para quem já está na observação ou na internação: na porta, confere-se a tabela)
SELECT e2e.a01('a01_item_mg', 'A01.13.magnesio_ataque', 'A01.13.itens_ativos', 'banco', NULL, 'Itens ativos na prescrição da porta, com o peso referido do atendimento',
  format($q$SELECT e2e.confere(count(*) >= 2 AND bool_and(i.peso_kg = 74), count(*) || ' itens: ' || string_agg(i.descricao || ' [' || coalesce(i.posologia, '') || ', ' || i.dose || ']', '; '))
    FROM public.prescricao_itens i JOIN public.prescricoes p ON p.id = i.prescricao_id
   WHERE p.paciente_id = %L AND p.status = 'ativa' AND i.suspenso_em IS NULL$q$, e2e.u('a01_pacu')));

-- ── 14. farmácia: valida, libera e dispensa ─────────────────────────────────
SELECT e2e.a01('a01_item_mg', 'A01.13.magnesio_ataque', 'A01.14.fila', 'f5_farm', '/farmacia (fila de validação)', 'O magnésio aparece na fila como alta vigilância',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.fila_validacao(%L::uuid) f WHERE f.item_id = %L::uuid AND f.alta_vigilancia), 'na fila com alta vigilância')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a01_item_mg')));
SELECT e2e.a01('a01_item_mg', 'A01.13.magnesio_ataque', 'A01.14.enf_nao_valida', 'f5_enf_upa', '/farmacia', 'Enfermeira tenta validar (deve ser recusado)',
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('a01_item_mg')), 'erro:A validação é do farmacêutico');
SELECT e2e.a01('a01_item_mg', 'A01.13.magnesio_ataque', 'A01.14.validar_mg', 'f5_farm', '/alta-vigilancia', 'Farmacêutico valida e libera o magnésio (confere)',
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('a01_item_mg')));
SELECT e2e.a01('a01_item_hid', 'A01.13.hidralazina', 'A01.14.validar_hid', 'f5_farm', '/farmacia', 'Farmacêutico valida a hidralazina (confere)',
  format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('a01_item_hid')));
SELECT e2e.a01('a01_item_mg', 'A01.13.magnesio_ataque', 'A01.14.dispensar_mg', 'f5_farm', '/dispensacao', 'Dispensa o magnésio (1 unidade de consumo, sem valor)',
  format('SELECT public.dispensar_item(%L::uuid, 1, NULL)::text', e2e.u('a01_item_mg')));
SELECT e2e.a01('a01_item_hid', 'A01.13.hidralazina', 'A01.14.dispensar_hid', 'f5_farm', '/dispensacao', 'Dispensa a hidralazina (1 unidade de consumo, sem valor)',
  format('SELECT public.dispensar_item(%L::uuid, 1, NULL)::text', e2e.u('a01_item_hid')));
SELECT e2e.a01('a01_item_mg', 'A01.13.magnesio_ataque', 'A01.14.validacao', 'banco', NULL, 'validacoes_prescricao registra confere para o magnésio',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.validacoes_prescricao WHERE item_id = %L), 'validação gravada')$q$, e2e.u('a01_item_mg')));
SELECT e2e.a01('a01_conta', 'A01.10.conta', 'A01.14.conta_medicamentos', 'f5_fat', '/faturamento/contas', 'Medicamentos dispensados entram na conta da porta sem valor',
  format($q$SELECT e2e.confere((public.conta_detalhe(%L::uuid) -> 'medicamentos')::text ILIKE '%%magn%%', left((public.conta_detalhe(%L::uuid) -> 'medicamentos')::text, 300))$q$,
    e2e.u('a01_conta'), e2e.u('a01_conta')));

-- ── 15. checagem pela enfermagem ────────────────────────────────────────────
SELECT e2e.guardar('a01_hora', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));
SELECT e2e.a01('a01_item_mg', 'A01.13.magnesio_ataque', 'A01.15.aprazar', 'f5_enf_upa', '/checagem', 'Enfermeira apraza a dose de ataque para agora',
  format('SELECT public.aprazar(%L::uuid, %L::text[], NULL)::text', e2e.u('a01_item_mg'), ARRAY[e2e.v('a01_hora')]));
SELECT e2e.a01('a01_item_mg', 'A01.13.magnesio_ataque', 'A01.15.checar_ataque', 'f5_enf_upa', '/checagem', 'Checa "feito" a dose de ataque (liberada pela farmácia)',
  format('SELECT public.checar(%L::uuid, %L, %L, NULL)::text', e2e.u('a01_item_mg'), 'feito', e2e.v('a01_hora')), 'ok', 'a01_adm1');
SELECT e2e.a01('a01_item_mg_manut', 'A01.13.magnesio_manutencao', 'A01.15.checar_manutencao', 'f5_enf_upa', '/checagem', 'Checa "feito" a 1ª dose de manutenção',
  format('SELECT public.checar(%L::uuid, %L, NULL, NULL)::text', e2e.u('a01_item_mg_manut'), 'feito'));
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.15.sinais', 'f5_enf_upa', '/checagem', 'Sinais crus de monitoramento (PA, FR, diurese)',
  e2e.a01_sinais(e2e.u('a01_pacu'), '{"pressao-arterial-sistolica":160,"pressao-arterial-diastolica":104,"frequencia-respiratoria":18,"diurese":60}'));
SELECT e2e.lacuna('A01.15.dupla_checagem', 1, 'f5_enf_upa', 'Dupla checagem com tela', 'Lacuna (MAPA 2.7): conferir_alta_vigilancia existe no banco, sem tela; substituída pela liberação da farmácia.');
SELECT e2e.a01('a01_adm1', 'A01.15.checar_ataque', 'A01.15.autor', 'banco', NULL, 'A administração tem autor = login da enfermeira',
  format($q$SELECT e2e.confere(registrado_por = 'f5200000-0000-4000-8000-000000000007' AND NOT sem_liberacao, 'autor ' || registrado_por || ', sem_liberacao ' || sem_liberacao) FROM public.administracoes WHERE id = %L$q$, e2e.u('a01_adm1')));
SELECT e2e.a01('a01_conta', 'A01.10.conta', 'A01.15.conta_medicacao', 'f5_fat', '/faturamento/contas', 'Item "administração de medicamento" nasce na conta',
  format($q$SELECT e2e.confere((public.conta_detalhe(%L::uuid) -> 'itens')::text LIKE '%%0301100012%%', left((public.conta_detalhe(%L::uuid) -> 'itens')::text, 300))$q$,
    e2e.u('a01_conta'), e2e.u('a01_conta')));

-- ── 17. eclâmpsia: reavaliação, SOAP e ajuste da prescrição ─────────────────
-- (o 16 roda depois do 17: o único item de alta vigilância sem liberação é o
--  item alterado aqui, que a farmácia ainda não viu)
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.17.reavaliacao', 'f5_med_upa', '/atendimento (Reavaliação)', 'Reavaliação: crise convulsiva (eclâmpsia), sinais crus',
  format($q$SELECT public.registrar_reavaliacao(%L::uuid, 'Crise convulsiva tônico-clônica generalizada às %s, PA 176x114, FR 22 (teste A01). Glasgow pela ficha glasgow na tela.')::text$q$,
    e2e.u('a01_epu'), e2e.v('a01_hora')));
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.17.sinais', 'f5_med_upa', '/atendimento (Reavaliação)', 'Sinais crus da reavaliação',
  e2e.a01_sinais(e2e.u('a01_pacu'), '{"pressao-arterial-sistolica":176,"pressao-arterial-diastolica":114,"frequencia-respiratoria":22,"glasgow":13}'));
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.17.soap', 'f5_med_upa', '/atendimento', 'SOAP atualizado para eclâmpsia (O15.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Crise convulsiva na UPA (teste A01)', 'PA 176x114 após a crise', 'Eclâmpsia', 'Conduta conforme a ficha adulto-emergencia-hipertensiva (teste de fluxo)', 'O15.0')::text$q$,
    e2e.u('a01_epu')));
SELECT e2e.a01('a01_item_mg', 'A01.13.magnesio_ataque', 'A01.17.alterar', 'f5_med_upa', '/atendimento (Prescrição)',
  'Ajusta o magnésio para manutenção contínua (texto de teste, conforme TOXICIDADE_MAGNESIO da ficha); vira item novo para a farmácia',
  format($q$SELECT public.alterar_item_prescricao(%L::uuid, %L::jsonb, 'Ajuste depois da crise convulsiva, conforme a ficha (teste)')::text$q$,
    e2e.u('a01_item_mg'), jsonb_build_object('posologia', 'Contínuo', 'dose', 'manutenção conforme protocolo — dado fictício de teste de fluxo')),
  'ok', 'a01_item_mg2');
SELECT e2e.a01('a01_item_mg2', 'A01.17.alterar', 'A01.17.autor', 'banco', NULL, 'O item novo tem autor = login do médico',
  format($q$SELECT e2e.confere(autor_id = 'f5200000-0000-4000-8000-000000000008', 'autor ' || autor_id) FROM public.prescricao_itens WHERE id = %L$q$, e2e.u('a01_item_mg2')));

-- ── 16. borda: checar alta vigilância sem liberação ─────────────────────────
SELECT e2e.a01('a01_item_mg2', 'A01.17.alterar', 'A01.16.sem_motivo', 'f5_enf_upa', '/checagem', 'Checar o item novo sem liberação e sem motivo (deve ser recusado)',
  format('SELECT public.checar(%L::uuid, %L, NULL, NULL)::text', e2e.u('a01_item_mg2'), 'feito'), 'erro:Alta vigilância sem liberação');
SELECT e2e.a01('a01_item_mg2', 'A01.17.alterar', 'A01.16.com_motivo', 'f5_enf_upa', '/checagem', 'Checar com motivo de 10+ letras: passa marcado sem liberação',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, 'Crise convulsiva em curso, farmácia avisada por telefone (teste)')::text$q$, e2e.u('a01_item_mg2')), 'ok', 'a01_adm2');
SELECT e2e.a01('a01_adm2', 'A01.16.com_motivo', 'A01.16.marcado', 'banco', NULL, 'A administração fica sem_liberacao = true',
  format($q$SELECT e2e.confere(sem_liberacao, 'sem_liberacao ' || sem_liberacao) FROM public.administracoes WHERE id = %L$q$, e2e.u('a01_adm2')));
SELECT e2e.a01('a01_adm2', 'A01.16.com_motivo', 'A01.16.farmaceutico_ve', 'f5_farm', '/alta-vigilancia', 'O farmacêutico vê a administração sem liberação',
  format($q$SELECT e2e.confere(public.administracoes_sem_liberacao(%L::uuid)::text LIKE '%%' || %L || '%%', 'na lista do farmacêutico')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a01_adm2')));

-- ── 18. desfecho: observação ────────────────────────────────────────────────
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.18.observacao', 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho observação (box livre da Observação Adulto)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.u('a01_epu')));
SELECT e2e.a01('a01_epu', 'A01.10.ficha', 'A01.18.internacao', 'f5_med_upa', '/atendimento', 'Internação de observação aberta pelo desfecho',
  format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L AND etapa = 'observacao'$q$, e2e.u('a01_epu')), 'ok', 'a01_int');
SELECT e2e.a01('a01_int', 'A01.18.internacao', 'A01.18.pendencia_6h', 'banco', NULL, 'Box da Observação Adulto e pendência de 6 h',
  format($q$SELECT e2e.confere(s.nome = 'Observação Adulto' AND EXISTS (SELECT 1 FROM public.pendencias p WHERE p.internacao_id = i.id AND p.tipo = 'observacao'),
      'setor ' || s.nome || ', box ' || coalesce(l.identificador, 'nenhum'))
    FROM public.internacoes i JOIN public.setores s ON s.id = i.setor_atual_id LEFT JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = %L$q$, e2e.u('a01_int')));
SELECT e2e.a01('a01_int', 'A01.18.internacao', 'A01.18.painel', 'f5_med_upa', '/plantao/observacao', 'Painel da observação mostra a gestante com prazo',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.painel_observacao(%L::uuid) p WHERE p.internacao_id = %L::uuid), 'no painel')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a01_int')));

-- ── 19. enfermagem na observação ────────────────────────────────────────────
SELECT e2e.a01('a01_int', 'A01.18.internacao', 'A01.19.sinais', 'f5_enf_upa', '/plantao/observacao', 'Sinais vitais seriados crus no box',
  e2e.a01_sinais(e2e.u('a01_pacu'), '{"pressao-arterial-sistolica":158,"pressao-arterial-diastolica":102,"frequencia-respiratoria":18}', e2e.u('a01_int')));
SELECT e2e.a01('a01_int', 'A01.18.internacao', 'A01.19.sae', 'f5_enf_upa', '/enfermagem/pronto-socorro', 'SAE da gestante em observação',
  format('SELECT public.registrar_sae(%L::uuid, %L, %L::jsonb, %L::jsonb, %L::jsonb, %L, NULL, %L::uuid)::text', e2e.u('a01_pacu'),
    'Gestante de 33 semanas após crise convulsiva (teste A01)', '[{"titulo":"Risco de lesão"}]', '[{"titulo":"Monitorar sinais e diurese"}]',
    '[{"titulo":"Cuidados conforme prescrição"}]', 'Evolução de teste A01', e2e.u('a01_int')));
SELECT e2e.a01('a01_int', 'A01.18.internacao', 'A01.19.balanco', 'f5_enf_upa', '/enfermagem', 'Balanço: diurese (valor cru)',
  format('SELECT public.lancar_balanco(%L::uuid, %L, %L, %s, NULL, NULL, %L::uuid)::text', e2e.u('a01_pacu'), 'saida', 'Diurese', 60, e2e.u('a01_int')));
SELECT e2e.a01('a01_int', 'A01.18.internacao', 'A01.19.balanco_tecnico', 'f5_tec_upa', '/enfermagem', 'Técnico escalado na Observação Adulto lança a diurese (conferência de escala)',
  format('SELECT public.lancar_balanco(%L::uuid, %L, %L, %s, NULL, NULL, %L::uuid)::text', e2e.u('a01_pacu'), 'saida', 'Diurese', 50, e2e.u('a01_int')));

-- ── 20. médico da UPA solicita a regulação ──────────────────────────────────
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.20.sem_transporte', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Transferência sem transporte (deve ser recusada)',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('a01_pacu'),
    jsonb_build_object('tipo', 'transferencia', 'procedimento', '0303100028', 'cid', 'O15.0', 'carater', 'urgencia', 'prioridade', 'emergencia',
      'destino_tipo', 'a_definir', 'tipo_leito', 'clinico', 'vulnerabilidades', jsonb_build_array('gestante'),
      'quadro_clinico', 'Gestante de 33 semanas com eclâmpsia na UPA (teste A01).')), 'erro');
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.20.quadro_curto', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Quadro clínico com menos de 20 letras (deve ser recusado)',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('a01_pacu'),
    jsonb_build_object('tipo', 'transferencia', 'procedimento', '0303100028', 'cid', 'O15.0', 'carater', 'urgencia', 'prioridade', 'emergencia',
      'destino_tipo', 'a_definir', 'tipo_leito', 'clinico', 'transporte', 'ambulancia_avancada', 'vulnerabilidades', jsonb_build_array('gestante'),
      'quadro_clinico', 'Eclâmpsia.')), 'erro');
SELECT e2e.a01('a01_pacu', 'A01.10.paciente', 'A01.20.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)',
  'Solicita transferência: emergência, gestante, SIGTAP 0303100028, CID O15.0, transporte avançado',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('a01_pacu'),
    jsonb_build_object('tipo', 'transferencia', 'procedimento', '0303100028', 'cid', 'O15.0', 'carater', 'urgencia', 'prioridade', 'emergencia',
      'destino_tipo', 'a_definir', 'tipo_leito', 'clinico', 'transporte', 'ambulancia_avancada', 'vulnerabilidades', jsonb_build_array('gestante'),
      'episodio_id', e2e.v('a01_epu'), 'internacao_id', e2e.v('a01_int'),
      'quadro_clinico', 'Gestante de 33 semanas, pré-eclâmpsia grave que evoluiu com crise convulsiva na UPA (eclâmpsia). Teste A01.',
      'tempo_evolucao', 'Horas', 'hipotese', 'Eclâmpsia', 'medicacoes', 'Sulfato de magnésio e hidralazina conforme a ficha (teste de fluxo)',
      'telefone_contato', '(11) 0000-0000')), 'ok', 'a01_reg');
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.20.enviada', 'banco', NULL, 'Solicitação enviada para a Central F5, com o evento',
  format($q$SELECT e2e.confere(status = 'enviada' AND central_id = 'f5100000-0000-4000-8000-000000000009'
      AND EXISTS (SELECT 1 FROM public.regulacao_eventos ev WHERE ev.solicitacao_id = s.id), 'status ' || status || ', nº ' || numero)
    FROM public.regulacao_solicitacoes s WHERE id = %L$q$, e2e.u('a01_reg')));

-- ── 21. regulador ───────────────────────────────────────────────────────────
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.21.fila', 'f5_regulador', '/regulacao (Fila)', 'O pedido está na fila da central',
  format($q$SELECT e2e.confere(public.regulacao_fila(%L::uuid, '{}'::jsonb)::text LIKE '%%' || %L || '%%', 'na fila')$q$,
    'f5100000-0000-4000-8000-000000000009', e2e.v('a01_reg')));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.21.assumir', 'f5_regulador', '/regulacao (Detalhe)', 'Regulador assume',
  format('SELECT public.regulacao_assumir(%L::uuid)::text', e2e.u('a01_reg')));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.21.priorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Prioriza como emergência',
  format($q$SELECT public.regulacao_priorizar(%L::uuid, 'emergencia', 'Eclâmpsia em gestante de 33 semanas (teste A01)')::text$q$, e2e.u('a01_reg')));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.21.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza com destino Hospital F5',
  format($q$SELECT public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', NULL, 'Destino Hospital F5 (teste A01)')::text$q$,
    e2e.u('a01_reg'), 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.21.prioridades', 'banco', NULL, 'aguardando_destino; prioridade do regulador separada da proposta',
  format($q$SELECT e2e.confere(status = 'aguardando_destino' AND prioridade = 'emergencia' AND prioridade_regulador = 'emergencia',
      'status ' || status || ', proposta ' || prioridade || ', regulador ' || coalesce(prioridade_regulador, 'nula')) FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('a01_reg')));

-- ── 22. NIR da UPA ──────────────────────────────────────────────────────────
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.22.pendencia', 'f5_nir', '/nir', 'NIR da UPA vê a pendência reg_destino enquanto o hospital não responde',
  format($q$SELECT e2e.confere(public.nir_pendencias(%L::uuid)::text LIKE '%%' || %L || '%%', left(public.nir_pendencias(%L::uuid)::text, 300))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a01_reg'), 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.22.cobrar', 'f5_nir', '/nir', 'NIR cobra a pendência reg_destino',
  format($q$SELECT public.nir_cobrar(%L::uuid, 'reg_destino', %L::uuid)::text$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('a01_reg')));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.22.nir_nao_aceita', 'f5_nir', '/regulacao', 'NIR tenta aceitar pelo destino (deve ser recusado)',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, NULL, NULL)::text', e2e.u('a01_reg')), 'erro');

-- ── 23. médico do hospital aceita e reserva o leito CM ──────────────────────
SELECT e2e.guardar('a01_leito_cm', (SELECT l.id::text FROM public.leitos l WHERE l.setor_id = 'f5300000-0000-4000-8000-000000000021' AND l.status = 'livre' AND l.ativo ORDER BY l.identificador LIMIT 1));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.23.lista', 'f5_med_hosp', '/regulacao (destino)', 'O pedido aparece na lista do destino',
  format($q$SELECT e2e.confere(public.regulacao_destino_lista(%L::uuid)::text LIKE '%%' || %L || '%%', 'na lista do destino')$q$,
    'f5100000-0000-4000-8000-000000000003', e2e.v('a01_reg')));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.23.leitos', 'f5_med_hosp', '/regulacao (destino)', 'Leitos livres do destino incluem a Clínica Médica',
  format($q$SELECT e2e.confere(public.regulacao_leitos_destino(%L::uuid)::text LIKE '%%' || %L || '%%', left(public.regulacao_leitos_destino(%L::uuid)::text, 300))$q$,
    e2e.u('a01_reg'), e2e.v('a01_leito_cm'), e2e.u('a01_reg')));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.23.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Aceita e reserva o leito CM',
  format($q$SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid, 'Leito CM reservado para a gestante (teste A01)')::text$q$,
    e2e.u('a01_reg'), e2e.u('a01_leito_cm')));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.23.reserva', 'banco', NULL, 'autorizada; reserva até max(agora + 24 h, previsto + 8 h)',
  format($q$SELECT e2e.confere(s.status = 'autorizada' AND r.expira_em >= now() + interval '23 hours 59 minutes', 'status ' || s.status || ', reserva até ' || r.expira_em)
    FROM public.regulacao_solicitacoes s JOIN public.reservas_leito r ON r.id = s.reserva_id WHERE s.id = %L$q$, e2e.u('a01_reg')));

-- ── 24. médico da UPA encerra a observação com transferência ────────────────
SELECT e2e.a01('a01_int', 'A01.18.internacao', 'A01.24.finalizar', 'f5_med_upa', '/plantao/observacao', 'Encerra a observação: transferência, CID O15.0 e relato',
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'transferencia', 'O15.0', 'Transferida ao Hospital F5 pela regulação (teste A01)', '{"destino":"Hospital Fase 5"}'::jsonb)::text$q$,
    e2e.u('a01_int')), 'ok', 'a01_finalizada');
SELECT e2e.a01('a01_finalizada', 'A01.24.finalizar', 'A01.24.contrarreferencia', 'f5_med_ubs', '/encaminhados?aba=retornos', 'A contrarreferência chega à UBS',
  format($q$SELECT coalesce((SELECT r ->> 'id' FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid, 7)) r
      WHERE r -> 'paciente' ->> 'nome' = %L LIMIT 1), e2e.falhar('sem contrarreferência para a gestante'))$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('a01_nome')), 'ok', 'a01_ret');

-- ── 25. saída ───────────────────────────────────────────────────────────────
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.25.saida', 'f5_nir', '/nir', 'NIR marca a saída (em trânsito)',
  format('SELECT public.regulacao_marcar_saida(%L::uuid)::text', e2e.u('a01_reg')));

-- ── 26. hospital: chegada, ficha e internação ───────────────────────────────
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.26.chegada', 'f5_med_hosp', '/regulacao (destino)', 'Médico do hospital marca a chegada (realizada)',
  format('SELECT public.regulacao_marcar_chegada(%L::uuid, true, NULL)::text', e2e.u('a01_reg')));
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.26.sem_internacao', 'banco', NULL, 'A chegada regulada não cria internação no destino',
  format($q$SELECT e2e.confere(NOT EXISTS (SELECT 1 FROM public.internacoes i JOIN public.pacientes p ON p.id = i.paciente_id
      WHERE i.unidade_id = 'f5100000-0000-4000-8000-000000000003' AND p.nome = %L), 'nenhuma internação no hospital')$q$, e2e.v('a01_nome')));
SELECT e2e.lacuna('A01.26.chegada_cria_internacao', 1, 'f5_med_hosp', 'Chegada regulada vira internação no destino', 'Lacuna (MAPA): o destino abre a ficha e interna pelo fluxo normal.');
SELECT e2e.passo('A01.26.ficha', 1, 'f5_med_hosp', '/recepcao (sem recepção escalada)', 'Médico do hospital abre a ficha da gestante no hospital',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Gestante transferida pela regulação (eclâmpsia)', NULL, %L::jsonb, '{gestante}') ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000021', e2e.v('a01_cadastro')), 'ok', 'a01_eph');
SELECT e2e.a01('a01_eph', 'A01.26.ficha', 'A01.26.paciente', 'f5_med_hosp', '/recepcao', 'Paciente do hospital',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a01_eph')), 'ok', 'a01_pach');
SELECT e2e.a01('a01_eph', 'A01.26.ficha', 'A01.26.iniciar', 'f5_med_hosp', '/atendimento', 'Assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a01_eph')));
SELECT e2e.a01('a01_eph', 'A01.26.ficha', 'A01.26.soap', 'f5_med_hosp', '/atendimento', 'SOAP de admissão (O15.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Transferida da UPA F5 (teste A01)', 'Sinais na chegada (teste)', 'Eclâmpsia', 'Internação', 'O15.0')::text$q$, e2e.u('a01_eph')));
SELECT e2e.a01('a01_eph', 'A01.26.ficha', 'A01.26.internar', 'f5_med_hosp', '/atendimento (Desfecho)', 'Interna no leito CM reservado',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', NULL, jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
    e2e.u('a01_eph'), 'f5300000-0000-4000-8000-000000000021', e2e.v('a01_leito_cm')));
SELECT e2e.a01('a01_eph', 'A01.26.ficha', 'A01.26.internacao', 'f5_med_hosp', '/atendimento', 'Internação no hospital',
  format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L AND etapa = 'internacao'$q$, e2e.u('a01_eph')), 'ok', 'a01_inth');

-- ── 27 e 28. AIH ────────────────────────────────────────────────────────────
SELECT e2e.a01('a01_inth', 'A01.26.internacao', 'A01.27.admissao', 'f5_med_hosp', '/plantao/internacao (caderno do leito)', 'Registra a admissão',
  format($q$SELECT public.registrar_admissao(%L::uuid, 'Admissão de gestante com eclâmpsia transferida da UPA F5 (teste A01)', NULL)::text$q$, e2e.u('a01_inth')));
SELECT e2e.a01('a01_inth', 'A01.26.internacao', 'A01.27.diagnostico', 'f5_med_hosp', '/plantao/internacao', 'Registra o diagnóstico principal',
  format($q$SELECT public.registrar_diagnostico(%L::uuid, 'principal', 'O15.0', 'confirmado', NULL, NULL, NULL)::text$q$, e2e.u('a01_inth')));
SELECT e2e.a01('a01_inth', 'A01.26.internacao', 'A01.27.laudo_aih', 'f5_med_hosp', '/plantao/internacao (laudo AIH)', 'Emite o laudo de AIH com o procedimento principal 0303100028',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'laudo_aih', %L) ->> 'id')$q$, e2e.u('a01_pach'),
    jsonb_build_object('aih', jsonb_build_object('sinais', 'Crise convulsiva, PA elevada (teste A01)', 'condicoes', 'Eclâmpsia em gestante de 33 semanas',
      'diagnostico', 'Eclâmpsia', 'cid', 'O15.0', 'procCod', '0303100028', 'procDesc', 'TRATAMENTO DE ECLAMPSIA', 'clinica', 'Obstétrica'))::text), 'ok', 'a01_laudo');
SELECT e2e.a01('a01_laudo', 'A01.27.laudo_aih', 'A01.27.aih', 'banco', NULL, 'AIH solicitada pelo gatilho do laudo',
  format($q$SELECT a.id::text FROM public.aihs a WHERE a.laudo_id = %L AND a.status = 'solicitada'$q$, e2e.u('a01_laudo')), 'ok', 'a01_aih');
SELECT e2e.a01('a01_aih', 'A01.27.aih', 'A01.28.decidir', 'f5_regulador', '/aih', 'Regulador aprova a AIH',
  format($q$SELECT public.decidir_aih(%L::uuid, true, '3526100000999', %L, NULL)::text$q$, e2e.u('a01_aih'), to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')));

-- ── 29. UBS abre a contrarreferência ────────────────────────────────────────
SELECT e2e.a01('a01_ret', 'A01.24.contrarreferencia', 'A01.29.abrir', 'f5_enf_ubs', '/encaminhados (Retornos)', 'Enfermeira da UBS abre a contrarreferência',
  format('SELECT left(public.contrarreferencia_abrir(%L::uuid)::text, 300)', e2e.u('a01_ret')));
SELECT e2e.a01('a01_ret', 'A01.24.contrarreferencia', 'A01.29.visto', 'f5_enf_ubs', '/encaminhados', 'a_ver → visto',
  format($q$SELECT e2e.confere(public.contrarreferencias_do_paciente(%L::uuid)::text LIKE '%%visto%%', left(public.contrarreferencias_do_paciente(%L::uuid)::text, 300))$q$,
    e2e.u('a01_pac'), e2e.u('a01_pac')));
SELECT e2e.a01('a01_pac', 'A01.01.paciente', 'A01.29.pre_natal_segue', 'f5_med_ubs', '/pre-natal', 'O pré-natal continua até o desfecho da gestação',
  format($q$SELECT e2e.confere(public.pre_natal_do_paciente(%L::uuid) -> 'gestacao' IS NOT NULL AND public.pre_natal_do_paciente(%L::uuid) -> 'gestacao' <> 'null'::jsonb, 'gestação ativa')$q$,
    e2e.u('a01_pac'), e2e.u('a01_pac')));

-- ── 30. faturamento da UPA conduz a conta ───────────────────────────────────
SELECT e2e.a01('a01_conta', 'A01.10.conta', 'A01.30.conferencia', 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia',
  format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('a01_conta'), 'em_conferencia'));
SELECT e2e.a01('a01_conta', 'A01.10.conta', 'A01.30.material', 'f5_fat', '/faturamento/contas', 'Lança material (2 unidades, sem valor)',
  format($q$SELECT public.conta_lancar_material(%L::uuid, %L::uuid, 2, 'Material do teste A01 (sem valor)')::text$q$,
    e2e.u('a01_conta'), (SELECT id FROM public.materiais_unidade WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002' AND ativo ORDER BY criado_em LIMIT 1)));
SELECT e2e.a01('a01_conta', 'A01.10.conta', 'A01.30.detalhe', 'f5_fat', '/faturamento/contas', 'Pré-auditoria e total de referência calculado',
  format($q$SELECT 'total ' || (d ->> 'total_referencia') || '; itens ' || jsonb_array_length(d -> 'itens') || '; pendências ' || jsonb_array_length(d -> 'pendencias')
      || '; bloqueantes sem liberação ' || (d ->> 'bloqueantes_sem_liberacao')
    FROM (SELECT public.conta_detalhe(%L::uuid) d) x$q$, e2e.u('a01_conta')));
SELECT e2e.lacuna('A01.30.valor_medicamento', 1, 'f5_fat', 'Valor de medicamento, material e transporte na conta; diária de leito',
  'Lacuna (MAPA): só o SIGTAP tem valor; medicamento e material entram sem valor.');

-- ── 31. gestor libera (se preciso) e faturamento fecha e fatura ─────────────
-- sem o encerramento da observação (passo 24) a conta não fecha: vira a borda
-- "fechar a conta antes do desfecho: recusado" e o resto fica bloqueado
SELECT CASE WHEN e2e.v('a01_conta') IS NULL OR e2e.v('a01_finalizada') IS NOT NULL THEN 'borda não se aplica'
  ELSE e2e.passo('A01.31.fechar_antes_do_desfecho', 1, 'f5_fat', '/faturamento/contas', 'Fechar a conta antes do desfecho (deve ser recusado)',
    format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('a01_conta'), 'fechada'), 'erro:O atendimento ainda não terminou') END;
SELECT e2e.a01('a01_finalizada', 'A01.24.finalizar', 'A01.31.fechar_antes_liberar', 'f5_fat', '/faturamento/contas', 'Faturamento tenta fechar a conta (sem liberação do gestor)',
  format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('a01_conta'), 'fechada'), 'ok', 'a01_fechada');
SELECT CASE WHEN e2e.v('a01_finalizada') IS NULL THEN e2e.lacuna('A01.31.liberar', 1, 'f5_ges_upa', 'Gestor libera o fechamento', 'bloqueado pelo passo A01.24.finalizar (sem a01_finalizada)')
            WHEN e2e.v('a01_fechada') IS NOT NULL THEN e2e.lacuna('A01.31.liberar', 1, 'f5_ges_upa', 'Gestor libera o fechamento', 'não precisou: a conta fechou sem pendência bloqueante')
  ELSE e2e.passo('A01.31.liberar', 1, 'f5_ges_upa', '/faturamento/contas', 'Gestor libera o fechamento com motivo',
    format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo A01: pendências conhecidas da rede de teste')::text, 300)$q$, e2e.u('a01_conta'))) END;
SELECT CASE WHEN e2e.v('a01_finalizada') IS NULL THEN e2e.lacuna('A01.31.fechar', 1, 'f5_fat', 'Faturamento fecha a conta', 'bloqueado pelo passo A01.24.finalizar (sem a01_finalizada)')
            WHEN e2e.v('a01_fechada') IS NOT NULL THEN 'fechar: já fechada'
  ELSE e2e.passo('A01.31.fechar', 1, 'f5_fat', '/faturamento/contas', 'Faturamento fecha a conta liberada',
    format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('a01_conta'), 'fechada'), 'ok', 'a01_fechada') END;
SELECT e2e.a01('a01_fechada', 'A01.31.fechar', 'A01.31.faturar', 'f5_fat', '/faturamento/contas', 'fechada → faturada',
  format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('a01_conta'), 'faturada'), 'ok', 'a01_faturada');
SELECT e2e.a01('a01_faturada', 'A01.31.faturar', 'A01.31.congelado', 'banco', NULL, 'Itens congelados e versão para o ERP',
  format($q$SELECT e2e.confere(c.itens_congelados IS NOT NULL AND EXISTS (SELECT 1 FROM public.conta_versoes_erp v WHERE v.conta_id = c.id),
      'congelados ' || coalesce(jsonb_array_length(c.itens_congelados), 0) || ', ERP ' || (SELECT count(*) FROM public.conta_versoes_erp v WHERE v.conta_id = c.id))
    FROM public.contas c WHERE c.id = %L$q$, e2e.u('a01_conta')));

-- ── 32. BPA ─────────────────────────────────────────────────────────────────
SELECT e2e.passo('A01.32.bpa_upa', 1, 'f5_fat', '/faturamento (BPA)', 'Três linhas BPA-I da gestante: classificação, consulta e medicação',
  format($q$SELECT e2e.confere(count(*) = 3, string_agg((x ->> 'origem') || ' ' || (x ->> 'procedimento') || ' ' || (x ->> 'destino') || ' qt ' || (x ->> 'quantidade') || ' críticas ' || (x -> 'criticas')::text, '; '))
    FROM jsonb_array_elements(public.bpa_conferencia(%L::uuid, %L) -> 'linhas') x WHERE x ->> 'paciente' = %L$q$,
    'f5100000-0000-4000-8000-000000000002', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), e2e.v('a01_nome')));
SELECT e2e.passo('A01.32.bpa_ubs', 1, 'f5_ges_ubs', '/faturamento (BPA)', 'A UBS não gera linha de BPA para a gestante',
  format($q$SELECT e2e.confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.bpa_conferencia(%L::uuid, %L) -> 'linhas') x WHERE x ->> 'paciente' = %L), 'UBS sem linha')$q$,
    'f5100000-0000-4000-8000-000000000001', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), e2e.v('a01_nome')));

-- ── conferências finais no banco ────────────────────────────────────────────
SELECT e2e.a01('a01_reg', 'A01.20.solicitar', 'A01.99.eventos_regulacao', 'banco', NULL, 'Um evento por transição em regulacao_eventos, autor = login',
  format($q$SELECT e2e.confere(count(*) >= 5, string_agg(ev.evento || ' por ' || coalesce(right(ev.por::text, 2), '?'), ' → ' ORDER BY ev.em))
    FROM public.regulacao_eventos ev WHERE ev.solicitacao_id = %L$q$, e2e.u('a01_reg')));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'A01.%' AND em >= e2e.v('a01_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
