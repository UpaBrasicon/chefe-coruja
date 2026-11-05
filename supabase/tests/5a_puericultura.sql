-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270224000001_puericultura.sql (5A, tarefa 7,
-- puericultura, parte 1). Tudo em transação com ROLLBACK.
--
-- 1. o painel lista as crianças da UBS com menos de 2 anos (nota C2, item 14),
--    sem as de 2 anos ou mais e sem os adultos;
-- 2. consulta com o problema "Puericultura" conta (Quadro 02); consulta sem
--    ele não; peso e altura só no mesmo dia (Quadro 03);
-- 3. saída à mão com motivo (item 15) pelo médico ou enfermeiro, e desfeita;
-- 4. permissões: painel e criança para médico, enfermagem e gestor.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000063a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000063a2'),
  ('cons', '00000000-0000-4000-8000-0000000063a3'),
  ('med',  '00000000-0000-4000-8000-0000000063b1'),
  ('enf',  '00000000-0000-4000-8000-0000000063b2'),
  ('rec',  '00000000-0000-4000-8000-0000000063b3'),
  ('tec',  '00000000-0000-4000-8000-0000000063b4');
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
CREATE FUNCTION pg_temp.cri(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.puericultura_do_paciente(pg_temp.v(p)) $$;
GRANT EXECUTE ON FUNCTION pg_temp.cri(text) TO authenticated;
CREATE FUNCTION pg_temp.no_painel(p text) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(public.puericultura_painel(pg_temp.id('ubs'))) x WHERE (x ->> 'paciente_id')::uuid = pg_temp.v(p)) $$;
GRANT EXECUTE ON FUNCTION pg_temp.no_painel(text) TO authenticated;
CREATE FUNCTION pg_temp.consulta(p_ep text, p_prob text[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.iniciar_atendimento(pg_temp.v(p_ep));
  PERFORM public.registrar_soap(pg_temp.v(p_ep), 'Puericultura', 'Bom estado geral', 'Crescimento adequado', 'Retorno', NULL);
  PERFORM public.registrar_conduta_aps(pg_temp.v(p_ep), 'consulta_programada', p_prob, '{}', '{retorno_cuidado_continuado}', NULL, '{}');
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.consulta(text, text[]) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a7pu.local' FROM ids WHERE nome IN ('med', 'enf', 'rec', 'tec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf', 'rec', 'tec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da puericultura');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS da puericultura', 'ubs');
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

-- c1 com 20 dias, c2 com 400 dias, c3 com 2 anos completos, c4 recém-nascida, a1 adulto
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO v SELECT x.ep, (public.registrar_ficha(pg_temp.id('cons'), 'Consulta de puericultura', NULL,
  jsonb_build_object('nome', x.nome, 'data_nascimento', x.nasc, 'tipo_atendimento', 'consulta_programada',
                     'nome_mae', 'Mãe Teste')) ->> 'episodio_id')::uuid
  FROM (VALUES ('ep1', 'Criança Teste Um', pg_temp.hoje() - 20), ('ep2', 'Criança Teste Dois', pg_temp.hoje() - 400),
               ('ep3', 'Criança Teste Três', (pg_temp.hoje() - interval '2 years')::date),
               ('ep4', 'Criança Teste Quatro', pg_temp.hoje()), ('ep5', 'Adulto Teste', '1990-01-01'::date)) x(ep, nome, nasc);
RESET ROLE;
INSERT INTO v SELECT 'c' || substr(v.nome, 3), e.paciente_id FROM v JOIN public.episodios e ON e.id = v.id
 WHERE v.nome IN ('ep1', 'ep2', 'ep3', 'ep4', 'ep5');
SET LOCAL ROLE authenticated;

-- ── 1. quem entra ───────────────────────────────────────────────────────────
SELECT pg_temp.como('tec');
SELECT pg_temp.ok(pg_temp.no_painel('c1') AND pg_temp.no_painel('c2') AND pg_temp.no_painel('c4'), 'crianças com menos de 2 anos no painel');
SELECT pg_temp.ok(NOT pg_temp.no_painel('c3') AND NOT pg_temp.no_painel('c5'), 'com 2 anos completos ou adulto, fora');
SELECT pg_temp.ok((pg_temp.cri('c3') ->> 'crianca')::boolean IS FALSE AND (pg_temp.cri('c5') ->> 'crianca')::boolean IS FALSE
                  AND (pg_temp.cri('c1') ->> 'crianca')::boolean, 'o bloco da consulta só vale até os 2 anos');

-- ── 2. consultas e peso com altura ──────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.consulta('ep1', '{puericultura}');
SELECT pg_temp.consulta('ep2', '{asma}');
RESET ROLE;
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT pg_temp.id('ubs'), pg_temp.v('c1'), c.id, now() - x.dias * interval '1 day', x.val, 'manual'
  FROM (VALUES ('peso', 3.9, 0), ('estatura', 53, 0), ('peso', 3.6, 6)) x(nome, val, dias)
  JOIN public.conceito c ON c.nome = x.nome AND c.unidade_id IS NULL;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((pg_temp.cri('c1') ->> 'primeira_consulta')::date = pg_temp.hoje() AND (pg_temp.cri('c1') ->> 'consultas')::int = 1
                  AND pg_temp.cri('c1') -> 'datas_consultas' = jsonb_build_array(pg_temp.hoje()),
  'consulta com o problema "Puericultura" conta, com a data');
SELECT pg_temp.ok((pg_temp.cri('c1') ->> 'peso_altura')::int = 1 AND pg_temp.cri('c1') -> 'datas_peso_altura' = jsonb_build_array(pg_temp.hoje()),
  'peso com altura no mesmo dia conta; peso sozinho não');
SELECT pg_temp.ok((pg_temp.cri('c2') ->> 'consultas')::int = 0 AND (pg_temp.cri('c2') ->> 'primeira_consulta') IS NULL,
  'consulta sem o problema "Puericultura" não conta');

-- ── 3. saída à mão ──────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha(format('SELECT public.puericultura_retirar(%L, %L)', pg_temp.v('c4'), 'Mudou de território'), 'Acesso negado: a puericultura', 'recepção não retira');
SELECT pg_temp.como('tec');
SELECT pg_temp.falha(format('SELECT public.puericultura_retirar(%L, %L)', pg_temp.v('c4'), 'Mudou de território'), 'Acesso negado: a puericultura', 'técnico não retira');
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.puericultura_retirar(%L, %L)', pg_temp.v('c4'), 'Ok'), 'Escreva o motivo', 'saída pede motivo');
SELECT pg_temp.falha(format('SELECT public.puericultura_retirar(%L, %L)', pg_temp.v('c3'), 'Mudou de território'), 'A puericultura vai até os 2 anos', 'não retira quem já passou dos 2 anos');
SELECT public.puericultura_retirar(pg_temp.v('c4'), 'Mudou de território');
SELECT pg_temp.ok(NOT pg_temp.no_painel('c4') AND (pg_temp.cri('c4') -> 'saida' ->> 'motivo') = 'Mudou de território', 'o enfermeiro retira com motivo');
SELECT pg_temp.falha(format('SELECT public.puericultura_retirar(%L, %L)', pg_temp.v('c4'), 'Mudou de território'), 'A criança já saiu', 'não retira duas vezes');
SELECT pg_temp.como('med');
SELECT public.puericultura_desfazer_saida(pg_temp.v('c4'));
SELECT pg_temp.ok(pg_temp.no_painel('c4') AND (pg_temp.cri('c4') -> 'saida') = 'null'::jsonb, 'o médico desfaz a saída');

-- ── 4. permissões ───────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha(format('SELECT public.puericultura_painel(%L)', pg_temp.id('ubs')), 'A puericultura é vista', 'a recepção não vê o painel');
SELECT pg_temp.falha(format('SELECT public.puericultura_do_paciente(%L)', pg_temp.v('c1')), 'A puericultura é vista', 'a recepção não vê a criança');
SELECT pg_temp.como('tec');
SELECT pg_temp.ok(jsonb_array_length(public.puericultura_painel(pg_temp.id('ubs'))) = 3, 'o técnico vê as três crianças');
RESET ROLE;
SELECT pg_temp.ok(has_table_privilege('authenticated', 'public.puericultura_saidas', 'SELECT') IS FALSE, 'sem acesso direto à tabela');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE entidade = 'puericultura_saidas') = 2, 'saída e desfazer auditados');

ROLLBACK;
