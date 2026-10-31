-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000016_escala_saida_fixo.sql (médio M2 do teste
-- ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md; decisão do RT
-- em 31/10/2026: saída do fixo aprovada "Encerra a fixa")
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_saida_fixo.sql
--
--  * o pedido de saída do fixo só vale para plantão que veio da fixa (mesma
--    pessoa, setor, dia da semana e turno de uma linha ativa);
--  * aprovado, a linha da fixa é encerrada: o mês seguinte não gera mais o
--    plantão; os plantões já gerados ficam com a pessoa;
--  * recusado, a fixa continua.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',     '00000000-0000-4000-8000-00000000d201'),
  ('uni',     '00000000-0000-4000-8000-00000000d20a'),
  ('setor',   '00000000-0000-4000-8000-00000000d2a1'),
  ('setor2',  '00000000-0000-4000-8000-00000000d2a2'),
  ('gestor',  '00000000-0000-4000-8000-00000000d211'),
  ('med',     '00000000-0000-4000-8000-00000000d212'),
  ('fixa',    '00000000-0000-4000-8000-00000000d231'),
  ('fixa2',   '00000000-0000-4000-8000-00000000d232'),
  ('pFixa',   '00000000-0000-4000-8000-00000000d241'),
  ('pFixa2',  '00000000-0000-4000-8000-00000000d242'),
  ('pAvulso', '00000000-0000-4000-8000-00000000d243');
GRANT SELECT, INSERT ON ids TO authenticated;
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
GRANT ALL ON resultado TO authenticated;
GRANT USAGE ON SEQUENCE resultado_n_seq TO authenticated;
-- o dia do plantão da fixa: daqui a 10 dias; o mês de teste da geração: o de daqui a 60 dias
CREATE TEMP TABLE dias ON COMMIT DROP AS SELECT private.data_atual() + 10 AS d, (private.data_atual() + 60) AS depois;
GRANT SELECT ON dias TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
END $$;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok); RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok);
END $$;
CREATE FUNCTION pg_temp.pedir(p_plantao text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.solicitacoes_escala (unidade_id, escala_plantao_id, perfil_id, tipo, justificativa, criado_por)
  VALUES (pg_temp.id('uni'), pg_temp.id(p_plantao), pg_temp.id('med'), 'sair_fixo', 'Mudei de horário', pg_temp.id('med'))
$$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text),
  pg_temp.ok(boolean, text), pg_temp.pedir(text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@saida-fixo.local' FROM ids WHERE nome IN ('gestor', 'med');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gestor', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da saída do fixo');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da saída do fixo', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('setor'),  pg_temp.id('uni'), 'Pronto Socorro', 'outro'),
  (pg_temp.id('setor2'), pg_temp.id('uni'), 'Observação', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gestor'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),    pg_temp.id('uni'), 'plantonista');
-- duas linhas da fixa: manhã no PS e tarde na Observação, no dia da semana de d
INSERT INTO public.escala_fixa (id, unidade_id, setor_id, perfil_id, dia_semana, turno, papel) VALUES
  (pg_temp.id('fixa'),  pg_temp.id('uni'), pg_temp.id('setor'),  pg_temp.id('med'), extract(dow FROM (SELECT d FROM dias))::int, 'manha', 'plantonista'),
  (pg_temp.id('fixa2'), pg_temp.id('uni'), pg_temp.id('setor2'), pg_temp.id('med'), extract(dow FROM (SELECT d FROM dias))::int, 'tarde', 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno, papel) VALUES
  (pg_temp.id('pFixa'),   pg_temp.id('uni'), pg_temp.id('setor'),  pg_temp.id('med'), (SELECT d FROM dias),     'manha', 'plantonista'),
  (pg_temp.id('pFixa2'),  pg_temp.id('uni'), pg_temp.id('setor2'), pg_temp.id('med'), (SELECT d FROM dias),     'tarde', 'plantonista'),
  -- avulso: o dia seguinte não tem linha da fixa
  (pg_temp.id('pAvulso'), pg_temp.id('uni'), pg_temp.id('setor'),  pg_temp.id('med'), (SELECT d FROM dias) + 1, 'manha', 'plantonista');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.falha($$SELECT pg_temp.pedir('pAvulso')$$, 'Este plantão não veio da escala fixa',
  'M2: o pedido de saída do fixo não vale para plantão que não veio da fixa');
SELECT pg_temp.pedir('pFixa');
SELECT pg_temp.pedir('pFixa2');
SELECT pg_temp.ok((SELECT count(*) FROM public.solicitacoes_escala WHERE perfil_id = pg_temp.id('med') AND tipo = 'sair_fixo') = 2,
  'o pedido de saída do fixo de plantão da fixa continua valendo');

-- o gestor aprova a do PS e recusa a da Observação
SELECT pg_temp.como('gestor');
UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = pg_temp.id('gestor')
 WHERE escala_plantao_id = pg_temp.id('pFixa') AND tipo = 'sair_fixo';
UPDATE public.solicitacoes_escala SET status = 'recusado', decidido_por = pg_temp.id('gestor')
 WHERE escala_plantao_id = pg_temp.id('pFixa2') AND tipo = 'sair_fixo';

RESET ROLE;
SELECT pg_temp.ok((SELECT NOT ativo FROM public.escala_fixa WHERE id = pg_temp.id('fixa')),
  'M2: aprovada a saída do fixo, a linha da fixa é encerrada');
SELECT pg_temp.ok((SELECT ativo FROM public.escala_fixa WHERE id = pg_temp.id('fixa2')),
  'recusada a saída do fixo, a linha da fixa continua');
SELECT pg_temp.ok((SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id('pFixa')) = pg_temp.id('med'),
  'M2: o plantão já gerado fica com a pessoa (o gestor decide cada um)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.historico_escala
                           WHERE plantao_id = pg_temp.id('pFixa') AND acao = 'fixa_encerrada'),
  'M2: o histórico registra a linha da fixa encerrada');

-- o mês seguinte não gera mais o plantão da linha encerrada; a outra continua gerando
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gestor');
SELECT public.gerar_escala_mensal_detalhada(pg_temp.id('uni'), extract(year FROM (SELECT depois FROM dias))::int,
  extract(month FROM (SELECT depois FROM dias))::int);
RESET ROLE;
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.escala_plantao e, dias
                               WHERE e.setor_id = pg_temp.id('setor') AND e.perfil_id = pg_temp.id('med')
                                 AND date_trunc('month', e.data) = date_trunc('month', dias.depois)),
  'M2: o mês seguinte não gera o plantão da linha encerrada');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.escala_plantao e, dias
                           WHERE e.setor_id = pg_temp.id('setor2') AND e.perfil_id = pg_temp.id('med')
                             AND date_trunc('month', e.data) = date_trunc('month', dias.depois)),
  'a linha que continua ativa segue gerando o mês');

SELECT count(*) AS testes FROM resultado;
ROLLBACK;
