-- Fase 3, tarefa 10 — migration 20261106000001_implantacao.sql: playbook de
-- implantação. Cobre:
-- - quem abre (só o implantador/super admin), tipos aceitos e ambulatório "a construir";
-- - itens por tipo de unidade, prazos a partir do D0;
-- - conferências automáticas (CNES, setores, leitos, protocolo, usuários,
--   escala, treinamento, primeiro atendimento);
-- - item manual marcado e desmarcado; item automático não se marca;
-- - treinamento por papel (só papel que a pessoa tem; sem data futura);
-- - aceite conjunto: exige obrigatórios, um por lado, situação avança;
-- - gestor de outra unidade e enfermeiro sem acesso.
BEGIN;
-- Portão 2, tarefa 4: este teste escala a mesma pessoa em mais de um setor por
-- conveniência; a regra de sobreposição tem teste próprio (portao2_escala_sobreposicao.sql)
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT '21000000-0000-4000-8000-000000000096', organizacao_id, 'UPA da Implantação', tipo, NULL, 'Campinas', 'SP'
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000096', 'gestor'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000096', 'enfermeiro');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
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
-- item do painel pelo código
CREATE FUNCTION pg_temp.item(p_codigo text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT x FROM jsonb_array_elements(public.implantacao_painel('21000000-0000-4000-8000-000000000096')->'itens') x
   WHERE x->>'codigo' = p_codigo $$;
GRANT EXECUTE ON FUNCTION pg_temp.item(text) TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. abrir ────────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.implantacao_abrir('21000000-0000-4000-8000-000000000096', 'upa', current_date + 30)$$,
  'Quem abre a implantação é o implantador', 'gestor não abre');
SELECT pg_temp.ok(public.implantacao_painel('21000000-0000-4000-8000-000000000096')->'implantacao' = 'null'::jsonb,
  'gestor vê o painel vazio antes de abrir');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha($$SELECT public.implantacao_abrir('21000000-0000-4000-8000-000000000096', 'ambulatorio', current_date + 30)$$,
  'Ambulatório: o módulo ainda está a construir', 'ambulatório a construir');
SELECT pg_temp.falha($$SELECT public.implantacao_abrir('21000000-0000-4000-8000-000000000096', 'upa', NULL)$$,
  'Informe a data da virada', 'D0 obrigatório');
INSERT INTO t SELECT 'imp', public.implantacao_abrir('21000000-0000-4000-8000-000000000096', 'upa', current_date)::text;
SELECT pg_temp.falha($$SELECT public.implantacao_abrir('21000000-0000-4000-8000-000000000096', 'upa', current_date)$$,
  'Esta unidade já tem uma implantação aberta', 'uma implantação aberta por unidade');

-- ── 2. itens por tipo ───────────────────────────────────────────────────────
SELECT pg_temp.ok(pg_temp.item('P05') IS NOT NULL AND pg_temp.item('P12') IS NULL AND pg_temp.item('P13') IS NOT NULL
              AND (pg_temp.item('P09') IS NULL) AND (pg_temp.item('P10')->>'obrigatorio')::boolean = false,
  'UPA: protocolo de classificação, sem os itens só de hospital, estoque recomendado');
SELECT pg_temp.ok((pg_temp.item('P01')->>'prazo')::date = current_date - 30 AND (pg_temp.item('E01')->>'prazo')::date = current_date + 30,
  'prazos contados a partir do D0');

-- ── 3. conferências automáticas ─────────────────────────────────────────────
SELECT pg_temp.ok(NOT (pg_temp.item('P01')->>'ok')::boolean AND pg_temp.item('P01')->>'detalhe' = 'CNES não informado', 'sem CNES');
SELECT pg_temp.ok(pg_temp.item('P03')->>'detalhe' LIKE 'Falta setor de porta (emergência), observação', 'faltam setores da UPA');
SELECT pg_temp.ok(pg_temp.item('P06')->>'detalhe' = 'Falta papel: recepcao, plantonista', 'faltam papéis');
SELECT pg_temp.falha(format('SELECT public.implantacao_marcar(%L, true)', pg_temp.item('P01')->>'id'),
  'Este item o sistema confere sozinho', 'item automático não se marca à mão');

RESET ROLE;
UPDATE public.unidades SET cnes = '7654334', protocolo_classificacao_id = (SELECT id FROM public.protocolos_classificacao LIMIT 1)
 WHERE id = '21000000-0000-4000-8000-000000000096';
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  ('22000000-0000-4000-8000-000000000961', '21000000-0000-4000-8000-000000000096', 'Porta', 'emergencia'),
  ('22000000-0000-4000-8000-000000000962', '21000000-0000-4000-8000-000000000096', 'Observação', 'observacao');
INSERT INTO public.leitos (setor_id, identificador, tipo, status)
SELECT '22000000-0000-4000-8000-000000000962', 'OBS-0' || n, (SELECT tipo FROM public.leitos LIMIT 1), 'livre' FROM generate_series(1, 3) n;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000096', 'recepcao'),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000096', 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000096', '22000000-0000-4000-8000-000000000961', '10000000-0000-4000-8000-000000000002',
       current_date + n, 'manha', (current_date + n)::timestamptz + interval '10 hours', 360 FROM generate_series(0, 5) n;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.ok((pg_temp.item('P01')->>'ok')::boolean AND (pg_temp.item('P03')->>'ok')::boolean AND (pg_temp.item('P04')->>'ok')::boolean
              AND (pg_temp.item('P05')->>'ok')::boolean AND (pg_temp.item('P06')->>'ok')::boolean,
  'CNES, setores, leitos, protocolo e papéis conferidos');
SELECT pg_temp.ok(pg_temp.item('P04')->>'detalhe' = '3 leito(s) ativo(s)', 'contagem de leitos');
SELECT pg_temp.ok(NOT (pg_temp.item('P08')->>'ok')::boolean AND pg_temp.item('P08')->>'detalhe' = '6 plantão(ões) em 6 de 7 dias (D0 a D+6)',
  'escala com um dia sem plantão não passa');
RESET ROLE;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000096', '22000000-0000-4000-8000-000000000961', '10000000-0000-4000-8000-000000000002',
        current_date + 6, 'manha', (current_date + 6)::timestamptz + interval '10 hours', 360);
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((pg_temp.item('P08')->>'ok')::boolean, 'escala de D0 a D+6 completa');

-- ── 4. treinamento ──────────────────────────────────────────────────────────
SELECT pg_temp.ok(pg_temp.item('P15')->>'detalhe' = '0 de 4 vínculo(s) treinado(s)', 'ninguém treinado ainda');
SELECT pg_temp.falha(format('SELECT public.implantacao_treinar(%L, %L, %L)', pg_temp.v('imp'), '10000000-0000-4000-8000-000000000005', 'enfermeiro'),
  'Esta pessoa não tem esse papel na unidade', 'treinamento só no papel que a pessoa tem');
SELECT pg_temp.falha(format('SELECT public.implantacao_treinar(%L, %L, %L, current_date + 1)', pg_temp.v('imp'), '10000000-0000-4000-8000-000000000005', 'recepcao'),
  'O treinamento não pode ter data futura', 'sem data futura');
SELECT public.implantacao_treinar(pg_temp.v('imp')::uuid, p::uuid, papel)
  FROM (VALUES ('10000000-0000-4000-8000-000000000001', 'gestor'), ('10000000-0000-4000-8000-000000000004', 'enfermeiro'),
               ('10000000-0000-4000-8000-000000000005', 'recepcao'), ('10000000-0000-4000-8000-000000000002', 'plantonista')) x(p, papel);
SELECT pg_temp.ok((pg_temp.item('P15')->>'ok')::boolean AND pg_temp.item('P15')->>'detalhe' = '4 de 4 vínculo(s) treinado(s)', 'todos treinados');
SELECT pg_temp.ok(jsonb_array_length(public.implantacao_painel('21000000-0000-4000-8000-000000000096')->'pessoas') = 4
              AND public.implantacao_painel('21000000-0000-4000-8000-000000000096')->'pessoas'->0->>'treinado_em' IS NOT NULL,
  'painel lista as pessoas com a data do treinamento');

-- ── 5. itens manuais e aceite da virada ─────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.implantacao_aceitar(%L, %L)', pg_temp.v('imp'), 'virada'),
  'Faltam itens obrigatórios: P02', 'aceite da virada exige os obrigatórios');
SELECT public.implantacao_marcar((pg_temp.item(c)->>'id')::uuid, true, CASE WHEN c = 'P02' THEN 'Contrato assinado em 01/10' END)
  FROM unnest(ARRAY['P02', 'P07', 'P14', 'P16', 'P17', 'V01', 'V02', 'V03']) c;
SELECT pg_temp.ok(pg_temp.item('P02')->>'feito_por' IS NOT NULL AND pg_temp.item('P02')->>'observacao' = 'Contrato assinado em 01/10',
  'item manual marcado, com quem e observação');
SELECT pg_temp.falha(format('SELECT public.implantacao_aceitar(%L, %L)', pg_temp.v('imp'), 'virada'),
  'Faltam itens obrigatórios: V04', 'falta o primeiro atendimento');
RESET ROLE;
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
VALUES ('23000000-0000-4000-8000-000000000961', '21000000-0000-4000-8000-000000000096', 'Primeiro Paciente', '1980-01-01', 'I-1',
        '22000000-0000-4000-8000-000000000961', 'F');
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, encerrado_em, desfecho, desfecho_em)
VALUES ('21000000-0000-4000-8000-000000000096', '23000000-0000-4000-8000-000000000961', '22000000-0000-4000-8000-000000000961',
        'encerrado', 'Dor', '10000000-0000-4000-8000-000000000004', now(), now(), 'alta', now());
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok((public.implantacao_aceitar(pg_temp.v('imp')::uuid, 'virada', 'Interações críticas a revisar na 1ª semana')->>'situacao') = 'em_implantacao',
  'aceite do gestor sozinho não vira a unidade');
SELECT pg_temp.falha(format('SELECT public.implantacao_aceitar(%L, %L)', pg_temp.v('imp'), 'virada'),
  'O aceite do gestor já foi registrado', 'um aceite por lado');
SELECT pg_temp.falha(format('SELECT public.implantacao_aceitar(%L, %L)', pg_temp.v('imp'), 'encerramento'),
  'O encerramento vem depois da virada', 'encerramento só depois da virada');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.ok((public.implantacao_aceitar(pg_temp.v('imp')::uuid, 'virada')->>'situacao') = 'em_operacao',
  'com o aceite do implantador, a unidade fica em operação');
SELECT pg_temp.falha(format('SELECT public.implantacao_mudar_d0(%L, current_date + 3, %L)', pg_temp.v('imp'), 'Mudança de data qualquer'),
  'A virada já aconteceu', 'D0 não muda depois da virada');

-- ── 6. encerramento ─────────────────────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.implantacao_aceitar(%L, %L)', pg_temp.v('imp'), 'encerramento'),
  'Faltam itens obrigatórios: O01', 'encerramento exige os itens da operação assistida e do fim');
SELECT public.implantacao_marcar((pg_temp.item(c)->>'id')::uuid, true)
  FROM unnest(ARRAY['O01', 'O02', 'O03', 'E01', 'E02']) c;
SELECT public.implantacao_aceitar(pg_temp.v('imp')::uuid, 'encerramento');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok((public.implantacao_aceitar(pg_temp.v('imp')::uuid, 'encerramento')->>'situacao') = 'encerrada',
  'com os dois aceites, a implantação fecha');
SELECT pg_temp.falha(format('SELECT public.implantacao_marcar(%L, false)', pg_temp.item('P02')->>'id'),
  'A implantação já foi encerrada', 'implantação encerrada não muda');
SELECT pg_temp.ok(jsonb_array_length(public.implantacao_painel('21000000-0000-4000-8000-000000000096')->'aceites') = 4
              AND public.implantacao_painel('21000000-0000-4000-8000-000000000096')->'aceites'->0->>'pendencias' LIKE 'Interações%',
  'aceites registrados, com as pendências aceitas');

-- ── 7. quem não pode ────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.implantacao_painel('21000000-0000-4000-8000-000000000096')$$, 'Acesso negado', 'enfermeiro não vê o painel');
SELECT pg_temp.falha($$SELECT * FROM public.implantacoes$$, 'permission denied', 'tabela fechada para leitura direta');
RESET ROLE;
SELECT pg_temp.falha($$UPDATE public.implantacao_aceites SET pendencias = 'outra'$$, '', 'aceite não se altera');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE acao LIKE 'implantacao%'
                    AND unidade_id = '21000000-0000-4000-8000-000000000096') >= 20, 'auditoria registra cada passo');

ROLLBACK;
