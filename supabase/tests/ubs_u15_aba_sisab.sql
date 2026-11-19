-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000024_ubs_u15_aba_sisab.sql (percurso da UBS,
-- U15, PR 5). Tudo em transação com ROLLBACK; o cenário é o mesmo do teste dos
-- indicadores da APS, criado aqui.
--
-- 1. o painel traz a configuração, o CNES e a contagem por situação;
-- 2. a lista traz as fichas sem dado do paciente;
-- 3. reenviar: a ficha com erro volta à fila do zero; a enviada não volta;
-- 4. só o gestor vê e reenvia.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000093a1'), ('ubs', '00000000-0000-4000-8000-0000000093a2'),
  ('cons', '00000000-0000-4000-8000-0000000093a3'),
  ('ges', '00000000-0000-4000-8000-0000000093b1'), ('med', '00000000-0000-4000-8000-0000000093b2'),
  ('enf', '00000000-0000-4000-8000-0000000093b3'), ('rec', '00000000-0000-4000-8000-0000000093b4'),
  ('idoso', '00000000-0000-4000-8000-0000000093c1'), ('m30', '00000000-0000-4000-8000-0000000093c2'),
  ('m55', '00000000-0000-4000-8000-0000000093c3'), ('h40', '00000000-0000-4000-8000-0000000093c4');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE TEMP TABLE r (j jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15f.local' FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 PR5');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15 PR5', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor'), (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'),
  (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'), (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao');
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento) VALUES
  (pg_temp.id('idoso'), pg_temp.id('ubs'), 'Idoso U13', 'U13-1', 'M', private.data_atual() - interval '70 years'),
  (pg_temp.id('m30'), pg_temp.id('ubs'), 'Mulher Trinta', 'U13-2', 'F', private.data_atual() - interval '30 years'),
  (pg_temp.id('m55'), pg_temp.id('ubs'), 'Mulher Cinquenta', 'U13-3', 'F', private.data_atual() - interval '55 years'),
  (pg_temp.id('h40'), pg_temp.id('ubs'), 'Homem Quarenta', 'U13-4', 'M', private.data_atual() - interval '40 years');

-- consultas encerradas: idoso programada (médico); m30 agendada com saúde sexual (enfermeiro);
-- h40 consulta no dia (médico) e escuta (enfermeiro); m55 ficha vencida (sem profissional)
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, tipo_atendimento_aps,
                              desfecho_por, encerrado_por, encerrado_em, conduta_aps, problemas_aps)
VALUES
  (pg_temp.id('ubs'), pg_temp.id('idoso'), pg_temp.id('cons'), 'Retorno', pg_temp.id('rec'), 'encerrado', 'consulta_programada',
   pg_temp.id('med'), pg_temp.id('med'), now() - interval '10 days', '{retorno_cuidado_continuado}', '{hipertensao_arterial}'),
  (pg_temp.id('ubs'), pg_temp.id('m30'), pg_temp.id('cons'), 'Planejamento', pg_temp.id('rec'), 'encerrado', 'consulta_agendada',
   pg_temp.id('enf'), pg_temp.id('enf'), now() - interval '20 days', '{alta_episodio}', '{saude_sexual_reprodutiva}'),
  (pg_temp.id('ubs'), pg_temp.id('h40'), pg_temp.id('cons'), 'Dor', pg_temp.id('rec'), 'encerrado', 'consulta_no_dia',
   pg_temp.id('med'), pg_temp.id('med'), now() - interval '5 days', '{alta_episodio}', '{}'),
  (pg_temp.id('ubs'), pg_temp.id('h40'), pg_temp.id('cons'), 'Orientação', pg_temp.id('rec'), 'encerrado', 'escuta_inicial',
   pg_temp.id('enf'), pg_temp.id('enf'), now() - interval '4 days', NULL, '{}'),
  (pg_temp.id('ubs'), pg_temp.id('m55'), pg_temp.id('cons'), 'Ficha que venceu', pg_temp.id('rec'), 'encerrado', 'consulta_no_dia',
   NULL, NULL, now() - interval '3 days', NULL, '{}');

-- peso e altura do idoso no mesmo dia
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, valor_num, aferido_em, origem)
SELECT pg_temp.id('ubs'), pg_temp.id('idoso'), c.id, v, now() - interval '10 days', 'manual'
  FROM public.conceito c JOIN (VALUES ('peso', 70), ('estatura', 170)) x(n, v) ON x.n = c.nome;

-- preventivo da m30 e mamografia da m55
INSERT INTO public.exames_pedidos (unidade_id, paciente_id, exame, procedimento, pedido_por, pedido_em) VALUES
  (pg_temp.id('ubs'), pg_temp.id('m30'), 'Citopatológico', '0203010086', pg_temp.id('enf'), now() - interval '100 days'),
  (pg_temp.id('ubs'), pg_temp.id('m55'), 'Mamografia', '0204030188', pg_temp.id('med'), now() - interval '200 days');

UPDATE public.unidades SET cnes = '9912345' WHERE id = pg_temp.id('ubs');
CREATE FUNCTION pg_temp.ep(p text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.episodios WHERE paciente_id = pg_temp.id(p) LIMIT 1 $$;
UPDATE public.episodios SET etapa = 'atendimento', encerrado_em = NULL WHERE id = pg_temp.ep('idoso');
UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now() - interval '10 days' WHERE id = pg_temp.ep('idoso');
UPDATE public.episodios SET etapa = 'atendimento', encerrado_em = NULL WHERE id = pg_temp.ep('m30');
UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now() - interval '20 days' WHERE id = pg_temp.ep('m30');
INSERT INTO ids SELECT 'erro', id FROM public.ledi_fila WHERE referencia_id = pg_temp.ep('idoso');
INSERT INTO ids SELECT 'ok', id FROM public.ledi_fila WHERE referencia_id = pg_temp.ep('m30');
UPDATE public.ledi_fila SET status = 'erro', tentativas = 3, ultimo_erro = 'o PEC recusou a ficha (400)' WHERE id = pg_temp.id('erro');
UPDATE public.ledi_fila SET status = 'enviado', enviado_em = now() WHERE id = pg_temp.id('ok');
INSERT INTO public.ledi_config_unidade (unidade_id, codigo_ibge, pec_url) VALUES (pg_temp.id('ubs'), '3550308', 'https://pec.exemplo.gov.br');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
DO $$ BEGIN
  PERFORM public.ledi_painel(pg_temp.id('ubs'));
  RAISE EXCEPTION 'FALHOU: 4. o enfermeiro vê o painel — passou sem erro';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  4. só o gestor vê o painel do SISAB';
END $$;
DO $$ BEGIN
  PERFORM public.ledi_reenviar(pg_temp.id('erro'));
  RAISE EXCEPTION 'FALHOU: 4. o enfermeiro reenvia — passou sem erro';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  4. só o gestor reenvia';
END $$;
SELECT pg_temp.como('ges');
INSERT INTO r SELECT jsonb_build_object('painel', public.ledi_painel(pg_temp.id('ubs')));
INSERT INTO r SELECT jsonb_build_object('itens', public.ledi_itens(pg_temp.id('ubs'), NULL, 50));
INSERT INTO r SELECT jsonb_build_object('erros', public.ledi_itens(pg_temp.id('ubs'), 'erro', 50));
DO $$ BEGIN
  PERFORM public.ledi_reenviar(pg_temp.id('ok'));
  RAISE EXCEPTION 'FALHOU: 3. reenviou a ficha enviada — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Só ficha com erro%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  3. a ficha enviada não volta à fila';
END $$;
SELECT public.ledi_reenviar(pg_temp.id('erro'));
RESET ROLE;

SELECT pg_temp.ok((SELECT j -> 'painel' @> '{"ubs": true, "cnes": "9912345", "config": {"codigo_ibge": "3550308", "envio_ligado": false}, "contagem": {"erro": 1, "enviado": 1}}' FROM r WHERE j ? 'painel'),
  '1. o painel traz a configuração, o CNES e a contagem');
SELECT pg_temp.ok((SELECT jsonb_array_length(j -> 'itens') = 2 AND NOT (j::text LIKE '%paciente%') FROM r WHERE j ? 'itens')
                  AND (SELECT jsonb_array_length(j -> 'erros') = 1 AND j -> 'erros' -> 0 ->> 'ultimo_erro' LIKE 'o PEC recusou%' FROM r WHERE j ? 'erros'),
  '2. a lista traz as fichas, com filtro, sem dado do paciente');
SELECT pg_temp.ok((SELECT status = 'pendente' AND tentativas = 0 AND proxima_tentativa_em <= now() FROM public.ledi_fila WHERE id = pg_temp.id('erro')),
  '3. a ficha com erro volta à fila, do zero');

ROLLBACK;
