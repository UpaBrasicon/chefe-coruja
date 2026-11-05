-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270222000001_pre_natal.sql (5A, tarefa 7, pré-natal,
-- parte 1). Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. a consulta da UBS abre a gestação pelo problema, pelo CID-10 ou pela
--    CIAP-2 da nota C3, com a DUM da classificação; não duplica; consulta sem
--    a condição não abre;
-- 2. inclusão, DUM, desfecho e saída à mão: médico e enfermeiro (recepção não);
-- 3. o que o app registra, na janela da nota: consultas, pressão, peso e
--    altura no mesmo dia, testes do 1º trimestre (até DUM + 97) e do 3º
--    (de DUM + 196), consulta no puerpério;
-- 4. aborto pela consulta interrompe; a gestação sai sozinha 42 dias depois
--    do fim;
-- 5. painel e paciente: só médico, enfermagem e gestor; o hiperdia não muda.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000062a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000062a2'),
  ('cons', '00000000-0000-4000-8000-0000000062a3'),
  ('med',  '00000000-0000-4000-8000-0000000062b1'),
  ('enf',  '00000000-0000-4000-8000-0000000062b2'),
  ('rec',  '00000000-0000-4000-8000-0000000062b3'),
  ('tec',  '00000000-0000-4000-8000-0000000062b4');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.hoje() RETURNS date LANGUAGE sql AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;
GRANT EXECUTE ON FUNCTION pg_temp.hoje() TO authenticated;
-- a gestação ativa da paciente, como o bloco da consulta vê (lida como o enfermeiro)
CREATE FUNCTION pg_temp.gest(p_pac text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT nullif(public.pre_natal_do_paciente(pg_temp.v(p_pac)) -> 'gestacao', 'null'::jsonb) $$;
GRANT EXECUTE ON FUNCTION pg_temp.gest(text) TO authenticated;
-- uma consulta da UBS do começo ao fim, como na tela
CREATE FUNCTION pg_temp.consulta(p_ep text, p_prob text[], p_cids text[], p_ciaps text[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.iniciar_atendimento(pg_temp.v(p_ep));
  PERFORM public.registrar_soap(pg_temp.v(p_ep), 'Acompanhamento', 'Sem alterações', 'Gestação em acompanhamento', 'Manter', NULL);
  PERFORM public.registrar_conduta_aps(pg_temp.v(p_ep), 'consulta_programada', p_prob, p_cids, '{retorno_cuidado_continuado}', NULL, p_ciaps);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.consulta(text, text[], text[], text[]) TO authenticated;
-- nova ficha para a mesma paciente
CREATE FUNCTION pg_temp.ficha(p_ep text, p_pac text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO v SELECT p_ep, (public.registrar_ficha(pg_temp.id('cons'), 'Retorno do pré-natal', pg_temp.v(p_pac),
    '{"tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ficha(text, text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a7pn.local' FROM ids WHERE nome IN ('med', 'enf', 'rec', 'tec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf', 'rec', 'tec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do pré-natal');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do pré-natal', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['med', 'rec']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep' || n, (public.registrar_ficha(pg_temp.id('cons'), 'Consulta de pré-natal', NULL,
  jsonb_build_object('nome', 'Paciente Pré-natal ' || n, 'data_nascimento', '1995-01-0' || n, 'tipo_atendimento', 'consulta_programada')) ->> 'episodio_id')::uuid
  FROM generate_series(1, 5) n;
RESET ROLE;
INSERT INTO v SELECT 'p' || substr(v.nome, 3), e.paciente_id FROM v JOIN public.episodios e ON e.id = v.id
 WHERE v.nome IN ('ep1', 'ep2', 'ep3', 'ep4', 'ep5');
-- a classificação da consulta 1 registrou a DUM (70 dias atrás)
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, gestacao)
VALUES (pg_temp.v('ep1'), pg_temp.id('ubs'), pg_temp.v('p1'), 'verde', 'adulto', pg_temp.id('enf'), 'enfermeiro',
        jsonb_build_object('tipo', 'gestacao_unica', 'dum', pg_temp.hoje() - 70));
SET LOCAL ROLE authenticated;

-- ── 1. entrada pela consulta ────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.consulta('ep1', '{pre_natal}', '{}', '{}');
SELECT pg_temp.consulta('ep2', '{}', '{Z34.0}', '{}');
SELECT pg_temp.consulta('ep3', '{}', '{}', '{W78}');
SELECT pg_temp.consulta('ep4', '{tabagismo}', '{}', '{}');
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((pg_temp.gest('p1') ->> 'origem') = 'consulta' AND (pg_temp.gest('p1') ->> 'dum')::date = pg_temp.hoje() - 70
                  AND (pg_temp.gest('p1') ->> 'dpp')::date = pg_temp.hoje() - 70 + 280,
  'problema "pré-natal" abre a gestação com a DUM da classificação e a DPP de Naegele');
SELECT pg_temp.ok(pg_temp.gest('p2') IS NOT NULL AND (pg_temp.gest('p2') ->> 'dum') IS NULL, 'CID Z34.0 abre a gestação, sem DUM');
SELECT pg_temp.ok(pg_temp.gest('p3') IS NOT NULL, 'CIAP W78 abre a gestação');
SELECT pg_temp.ok(pg_temp.gest('p4') IS NULL, 'consulta sem a condição não abre');
SELECT pg_temp.como('rec');
SELECT pg_temp.ficha('ep6', 'p1');
SELECT pg_temp.como('med');
SELECT pg_temp.consulta('ep6', '{pre_natal}', '{Z34.0}', '{}');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.pre_natal_gestacoes WHERE paciente_id = pg_temp.v('p1')) = 1, 'nova consulta não duplica a gestação');
SET LOCAL ROLE authenticated;

-- ── 2. à mão ────────────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha(format('SELECT public.pre_natal_incluir(%L, %L)', pg_temp.v('p4'), pg_temp.hoje() - 200), 'Acesso negado: o pré-natal', 'recepção não inclui');
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.pre_natal_incluir(%L, %L)', pg_temp.v('p4'), pg_temp.hoje() + 1), 'A DUM tem de ser', 'DUM no futuro não entra');
INSERT INTO v SELECT 'g4', public.pre_natal_incluir(pg_temp.v('p4'), pg_temp.hoje() - 200);
SELECT pg_temp.ok((pg_temp.gest('p4') ->> 'origem') = 'manual', 'o enfermeiro inclui à mão com a DUM');
SELECT pg_temp.falha(format('SELECT public.pre_natal_incluir(%L)', pg_temp.v('p4')), 'A paciente já está no pré-natal', 'não inclui duas vezes');
SELECT pg_temp.como('med');
SELECT public.pre_natal_definir_dum((pg_temp.gest('p2') ->> 'id')::uuid, pg_temp.hoje() - 30);
SELECT pg_temp.ok((pg_temp.gest('p2') ->> 'dum')::date = pg_temp.hoje() - 30, 'o médico registra a DUM que faltava');
SELECT pg_temp.falha(format('SELECT public.pre_natal_registrar_desfecho(%L, %L, %L)', pg_temp.gest('p2') ->> 'id', 'parto', pg_temp.hoje() - 31),
  'A data do desfecho não pode ser antes da DUM', 'desfecho antes da DUM não entra');

-- ── 3. registros na janela da nota ──────────────────────────────────────────
RESET ROLE;
-- paciente 1 (DUM há 70 dias): duas pressões e um peso com altura na gestação, e
-- uma pressão de antes da DUM, que não conta
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT pg_temp.id('ubs'), pg_temp.v('p1'), c.id, now() - x.dias * interval '1 day', x.val, 'manual'
  FROM (VALUES ('pressao-arterial-sistolica', 110, 10), ('pressao-arterial-sistolica', 112, 40), ('pressao-arterial-sistolica', 118, 90),
               ('peso', 62, 10), ('estatura', 160, 10), ('peso', 61, 40)) x(nome, val, dias)
  JOIN public.conceito c ON c.nome = x.nome AND c.unidade_id IS NULL;
-- teste rápido de sífilis no 1º trimestre e anti-HIV com resultado; hepatite B fora (pedido sem resultado)
INSERT INTO public.procedimentos_realizados (unidade_id, paciente_id, procedimento, realizado_em, profissional_id, via, registrado_por)
VALUES (pg_temp.id('ubs'), pg_temp.v('p1'), '0214010074', now() - interval '60 days', pg_temp.id('enf'), 'quem_fez', pg_temp.id('enf'));
INSERT INTO public.exames_pedidos (id, unidade_id, paciente_id, exame, procedimento, pedido_por, pedido_em, situacao) VALUES
  ('00000000-0000-4000-8000-0000000062c1', pg_temp.id('ubs'), pg_temp.v('p1'), 'Anti-HIV', '0202030300', pg_temp.id('med'), now() - interval '65 days', 'resultado'),
  ('00000000-0000-4000-8000-0000000062c2', pg_temp.id('ubs'), pg_temp.v('p1'), 'HBsAg', '0202030970', pg_temp.id('med'), now() - interval '65 days', 'pedido');
INSERT INTO public.exame_resultados (exame_id, versao, origem, texto, liberado_em)
VALUES ('00000000-0000-4000-8000-0000000062c1', 1, 'manual', 'Não reagente', now() - interval '58 days');
-- paciente 4 (DUM há 200 dias): sífilis com 195 dias (2º trimestre) e HIV com 196 (3º)
INSERT INTO public.procedimentos_realizados (unidade_id, paciente_id, procedimento, realizado_em, profissional_id, via, registrado_por)
VALUES (pg_temp.id('ubs'), pg_temp.v('p4'), '0214010074', now() - interval '5 days', pg_temp.id('enf'), 'quem_fez', pg_temp.id('enf')),
       (pg_temp.id('ubs'), pg_temp.v('p4'), '0214010040', now() - interval '4 days', pg_temp.id('enf'), 'quem_fez', pg_temp.id('enf'));
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((pg_temp.gest('p1') ->> 'consultas')::int = 2 AND (pg_temp.gest('p1') ->> 'primeira_consulta')::date = pg_temp.hoje()
                  AND (pg_temp.gest('p1') ->> 'pa')::int = 2 AND (pg_temp.gest('p1') ->> 'peso_altura')::int = 1,
  'paciente 1: duas consultas, duas pressões na gestação, um peso com altura');
-- 20270223000001: as datas das consultas, para a linha do tempo
SELECT pg_temp.ok(pg_temp.gest('p1') -> 'datas_consultas' = jsonb_build_array(pg_temp.hoje(), pg_temp.hoje())
                  AND pg_temp.gest('p4') -> 'datas_consultas' = '[]'::jsonb,
  'paciente 1: as datas das duas consultas; paciente 4, incluída à mão, nenhuma');
SELECT pg_temp.ok(pg_temp.gest('p1') -> 'testes_1tri' = jsonb_build_object('sifilis', pg_temp.hoje() - 60, 'hiv', pg_temp.hoje() - 58)
                  AND pg_temp.gest('p1') -> 'testes_3tri' = '{}'::jsonb,
  'paciente 1: sífilis e HIV no 1º trimestre; hepatite B só pedida não conta');
SELECT pg_temp.ok(pg_temp.gest('p4') -> 'testes_3tri' = jsonb_build_object('hiv', pg_temp.hoje() - 4)
                  AND pg_temp.gest('p4') -> 'testes_1tri' = '{}'::jsonb,
  'paciente 4: HIV com 28 semanas conta no 3º trimestre; sífilis com 27s6d não');

-- desfecho e puerpério: parto ontem na paciente 2, consulta de puerpério hoje
SELECT pg_temp.como('med');
SELECT public.pre_natal_registrar_desfecho((pg_temp.gest('p2') ->> 'id')::uuid, 'parto', pg_temp.hoje() - 1);
SELECT pg_temp.como('rec');
SELECT pg_temp.ficha('ep7', 'p2');
SELECT pg_temp.como('med');
SELECT pg_temp.consulta('ep7', '{puerperio}', '{}', '{}');
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((pg_temp.gest('p2') ->> 'desfecho') = 'parto' AND (pg_temp.gest('p2') ->> 'fim_gestacao')::date = pg_temp.hoje() - 1
                  AND (pg_temp.gest('p2') ->> 'puerperio_ate')::date = pg_temp.hoje() + 41
                  AND (pg_temp.gest('p2') ->> 'consulta_puerperio')::date = pg_temp.hoje(),
  'parto abre o puerpério de 42 dias e a consulta de puerpério conta');

-- ── 4. aborto pela consulta e saída sozinha ─────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.ficha('ep8', 'p3');
SELECT pg_temp.como('med');
SELECT pg_temp.consulta('ep8', '{}', '{O03.9}', '{}');
SELECT pg_temp.como('enf');
SELECT pg_temp.ok(pg_temp.gest('p3') IS NULL, 'CID de aborto da nota interrompe o acompanhamento');
RESET ROLE;
SELECT pg_temp.ok((SELECT desfecho = 'aborto' FROM public.pre_natal_gestacoes WHERE paciente_id = pg_temp.v('p3')), 'a gestação fica com o desfecho aborto');
-- paciente 5: gestação antiga (DUM há 337 dias: fim há 43 dias) já saiu sozinha
INSERT INTO public.pre_natal_gestacoes (unidade_id, paciente_id, origem, dum)
VALUES (pg_temp.id('ubs'), pg_temp.v('p5'), 'manual', pg_temp.hoje() - 337);
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.ok(pg_temp.gest('p5') IS NULL, 'gestação sai sozinha 42 dias depois do fim');
INSERT INTO v SELECT 'g5', public.pre_natal_incluir(pg_temp.v('p5'), pg_temp.hoje() - 20);
SELECT pg_temp.ok((pg_temp.gest('p5') ->> 'dum')::date = pg_temp.hoje() - 20, 'nova gestação depois da antiga');

-- ── 5. painel, saída e permissões ───────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha(format('SELECT public.pre_natal_painel(%L)', pg_temp.id('ubs')), 'O pré-natal é visto', 'a recepção não vê o painel');
SELECT pg_temp.falha(format('SELECT public.pre_natal_do_paciente(%L)', pg_temp.v('p1')), 'O pré-natal é visto', 'a recepção não vê a paciente');
SELECT pg_temp.como('tec');
SELECT pg_temp.ok(jsonb_array_length(public.pre_natal_painel(pg_temp.id('ubs'))) = 4, 'o técnico vê as quatro gestações ativas (1, 2, 4, 5)');
SELECT pg_temp.falha(format('SELECT public.pre_natal_retirar(%L, %L)', pg_temp.v('g4'), 'Mudou de cidade'), 'Acesso negado: o pré-natal', 'o técnico não retira');
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.pre_natal_retirar(%L, %L)', pg_temp.v('g4'), 'Ok'), 'Escreva o motivo da saída', 'saída pede motivo');
SELECT public.pre_natal_retirar(pg_temp.v('g4'), 'Mudou de território');
SELECT pg_temp.ok(jsonb_array_length(public.pre_natal_painel(pg_temp.id('ubs'))) = 3 AND pg_temp.gest('p4') IS NULL, 'o enfermeiro retira com motivo');
SELECT pg_temp.ok(public.hiperdia_painel(pg_temp.id('ubs')) = '[]'::jsonb, 'o hiperdia não muda');
RESET ROLE;
SELECT pg_temp.ok(has_table_privilege('authenticated', 'public.pre_natal_gestacoes', 'SELECT') IS FALSE, 'sem acesso direto à tabela');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE entidade = 'pre_natal_gestacoes') >= 5, 'inclusão, DUM, desfecho e saída auditados');

ROLLBACK;
