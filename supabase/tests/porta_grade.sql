-- Grade de ações do gestor — migration 20270104000001_porta_grade.sql: por
-- paciente da porta, a hora e a situação de cada etapa; atraso só onde há alvo;
-- só o gestor, com segundo fator; acesso auditado a cada 15 min.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- unidade só deste teste: nenhum episódio de outro teste entra na conta
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '00000000-0000-4000-8000-00000000a9a1', organizacao_id, 'Unidade da Grade', tipo
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
-- o setor de emergência já nasce com as salas (gatilho)
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('00000000-0000-4000-8000-00000000a9a2', '00000000-0000-4000-8000-00000000a9a1', 'PS da Grade', 'emergencia', 1);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000a9a1', 'gestor'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000a9a1', 'plantonista');
-- alvos da unidade: chegada → triagem 20 min (a classificação da grade usa este), exame 30 min, permanência 40 min; medicação sem alvo
INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor) VALUES
  ('00000000-0000-4000-8000-00000000a9a1', 'alvo_triagem_min', '20'),
  ('00000000-0000-4000-8000-00000000a9a1', 'alvo_exame_min', '30'),
  ('00000000-0000-4000-8000-00000000a9a1', 'alvo_permanencia_min', '40');

-- a prescrição exige idade e peso (gatilho): o 4 tem data de nascimento e, abaixo, o peso
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento) VALUES
  ('00000000-0000-4000-8000-0000000a9b01', '00000000-0000-4000-8000-00000000a9a1', 'Grade Triagem', NULL),
  ('00000000-0000-4000-8000-0000000a9b02', '00000000-0000-4000-8000-00000000a9a1', 'Grade Laranja Sem Chamada', NULL),
  ('00000000-0000-4000-8000-0000000a9b03', '00000000-0000-4000-8000-00000000a9a1', 'Grade Verde Chamado Duas Vezes', NULL),
  ('00000000-0000-4000-8000-0000000a9b04', '00000000-0000-4000-8000-00000000a9a1', 'Grade Em Atendimento', '1980-05-01');
-- 1: na triagem há 25 min, sem classificação (alvo 20: atrasada)
-- 2: laranja classificado há 30 min, sem chamada (alvo 10: chamada atrasada)
-- 3: verde classificado há 30 min, chamado duas vezes (alvo 120: no prazo)
-- 4: amarelo, chegou há 50 min, atendido há 10 min (permanência 40: atrasado)
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, cor_atual, classificado_em, atendimento_iniciado_em) VALUES
  ('00000000-0000-4000-8000-0000000a9e01', '00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-0000000a9b01', '00000000-0000-4000-8000-00000000a9a2',
   'triagem', 'Dor', '10000000-0000-4000-8000-000000000004', now() - interval '25 minutes', NULL, NULL, NULL),
  ('00000000-0000-4000-8000-0000000a9e02', '00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-0000000a9b02', '00000000-0000-4000-8000-00000000a9a2',
   'atendimento', 'Dor torácica', '10000000-0000-4000-8000-000000000004', now() - interval '40 minutes', 'laranja', now() - interval '30 minutes', NULL),
  ('00000000-0000-4000-8000-0000000a9e03', '00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-0000000a9b03', '00000000-0000-4000-8000-00000000a9a2',
   'atendimento', 'Tosse', '10000000-0000-4000-8000-000000000004', now() - interval '40 minutes', 'verde', now() - interval '30 minutes', NULL),
  ('00000000-0000-4000-8000-0000000a9e04', '00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-0000000a9b04', '00000000-0000-4000-8000-00000000a9a2',
   'atendimento', 'Febre', '10000000-0000-4000-8000-000000000004', now() - interval '50 minutes', 'amarelo', now() - interval '45 minutes', now() - interval '10 minutes');
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, reclassificacao, criado_em)
SELECT ('00000000-0000-4000-8000-0000000a9e0' || x.n)::uuid, '00000000-0000-4000-8000-00000000a9a1',
       ('00000000-0000-4000-8000-0000000a9b0' || x.n)::uuid, x.cor, 'adulto',
       '10000000-0000-4000-8000-000000000004', 'enfermeiro', x.reclass, now() - make_interval(mins => x.m)
  FROM (VALUES (2, 'laranja', 30, false), (3, 'verde', 30, false), (3, 'verde', 5, true), (4, 'amarelo', 45, false)) x(n, cor, m, reclass);
-- duas chamadas do 3 (a última há 5 min) e uma do 4
INSERT INTO public.chamadas (unidade_id, setor_id, episodio_id, sala_id, etapa, numero, chamado_por, criado_em)
SELECT '00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-00000000a9a2', ('00000000-0000-4000-8000-0000000a9e0' || x.n)::uuid,
       (SELECT id FROM public.salas WHERE setor_id = '00000000-0000-4000-8000-00000000a9a2' ORDER BY nome LIMIT 1),
       'atendimento', x.num, '10000000-0000-4000-8000-000000000002', now() - make_interval(mins => x.m)
  FROM (VALUES (3, 1, 15), (3, 2, 5), (4, 1, 12)) x(n, num, m);
-- exames do 4: um com resultado, um pedido há 40 min (alvo 30: atrasado), um cancelado (não conta)
INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, pedido_por, situacao, pedido_em) VALUES
  ('00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-0000000a9b04', '00000000-0000-4000-8000-0000000a9e04', 'Hemograma', '10000000-0000-4000-8000-000000000002', 'resultado', now() - interval '9 minutes'),
  ('00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-0000000a9b04', '00000000-0000-4000-8000-0000000a9e04', 'PCR', '10000000-0000-4000-8000-000000000002', 'pedido', now() - interval '40 minutes'),
  ('00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-0000000a9b04', '00000000-0000-4000-8000-0000000a9e04', 'Ureia', '10000000-0000-4000-8000-000000000002', 'cancelado', now() - interval '45 minutes');
-- medicação do 4: dipirona feita há 5 min; ondansetrona pendente (sem alvo de medicação: não atrasa);
-- o "se necessário" e o cuidado não entram
CREATE FUNCTION pg_temp.pesar() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
  SELECT p.unidade_id, p.id, c.id, now(), 70, 'manual'
    FROM public.pacientes p JOIN public.conceito c ON c.nome = 'peso' AND c.unidade_id IS NULL
   WHERE p.id = '00000000-0000-4000-8000-0000000a9b04' AND private.peso_do_atendimento(p.id) IS NULL $$;
SELECT pg_temp.pesar();
INSERT INTO public.prescricoes (id, unidade_id, paciente_id, medico_id, status, episodio_id, assinada_em)
VALUES ('00000000-0000-4000-8000-0000000a9c01', '00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-0000000a9b04',
        '10000000-0000-4000-8000-000000000002', 'ativa', '00000000-0000-4000-8000-0000000a9e04', now() - interval '8 minutes');
INSERT INTO public.prescricao_itens (id, prescricao_id, descricao, tipo, se_necessario, ordem) VALUES
  ('00000000-0000-4000-8000-0000000a9d01', '00000000-0000-4000-8000-0000000a9c01', 'Dipirona 1 g IV', 'medicamento', false, 1),
  ('00000000-0000-4000-8000-0000000a9d02', '00000000-0000-4000-8000-0000000a9c01', 'Ondansetrona 4 mg IV', 'medicamento', false, 2),
  ('00000000-0000-4000-8000-0000000a9d03', '00000000-0000-4000-8000-0000000a9c01', 'Tramadol 50 mg IV', 'medicamento', true, 3),
  ('00000000-0000-4000-8000-0000000a9d04', '00000000-0000-4000-8000-0000000a9c01', 'Cabeceira elevada', 'cuidado', false, 4);
INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, situacao, registrado_por, registrado_em) VALUES
  ('00000000-0000-4000-8000-0000000a9d01', '00000000-0000-4000-8000-0000000a9b04', '00000000-0000-4000-8000-00000000a9a1', 'feito',
   '10000000-0000-4000-8000-000000000004', now() - interval '5 minutes');
-- reavaliação do 4: o médico marcou "aguardar" para 5 min atrás (atrasada)
INSERT INTO public.atendimento_reavaliacoes (episodio_id, unidade_id, paciente_id, tipo, autor_id, reavaliar_em, pendencia, criado_em) VALUES
  ('00000000-0000-4000-8000-0000000a9e04', '00000000-0000-4000-8000-00000000a9a1', '00000000-0000-4000-8000-0000000a9b04', 'aguardar',
   '10000000-0000-4000-8000-000000000002', now() - interval '5 minutes', 'exame: PCR', now() - interval '9 minutes');

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE r (v jsonb);
GRANT ALL ON r TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');  -- gestor
INSERT INTO r SELECT public.porta_grade('00000000-0000-4000-8000-00000000a9a1');
INSERT INTO r SELECT public.porta_grade('00000000-0000-4000-8000-00000000a9a1');  -- 2ª leitura (atualização automática)
RESET ROLE;

DO $$
DECLARE
  v jsonb := (SELECT v FROM r LIMIT 1);
  p1 jsonb; p2 jsonb; p3 jsonb; p4 jsonb;
BEGIN
  IF jsonb_array_length(v -> 'pacientes') <> 4 THEN RAISE EXCEPTION 'FALHOU: quatro pacientes na porta, veio %', jsonb_array_length(v -> 'pacientes'); END IF;
  IF (v #>> '{alvos,exame}')::int <> 30 OR (v #>> '{alvos,medicacao}') IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: alvos da unidade %', v -> 'alvos'; END IF;
  SELECT x INTO p1 FROM jsonb_array_elements(v -> 'pacientes') x WHERE x ->> 'nome' = 'Grade Triagem';
  SELECT x INTO p2 FROM jsonb_array_elements(v -> 'pacientes') x WHERE x ->> 'nome' = 'Grade Laranja Sem Chamada';
  SELECT x INTO p3 FROM jsonb_array_elements(v -> 'pacientes') x WHERE x ->> 'nome' = 'Grade Verde Chamado Duas Vezes';
  SELECT x INTO p4 FROM jsonb_array_elements(v -> 'pacientes') x WHERE x ->> 'nome' = 'Grade Em Atendimento';

  IF p1 #>> '{classificacao,em}' IS NOT NULL OR (p1 #>> '{classificacao,atrasada}')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: triagem há 25 min com alvo de 20 deveria estar atrasada: %', p1 -> 'classificacao';
  END IF;
  RAISE NOTICE 'OK  classificação atrasada pelo alvo da unidade';

  IF (p2 #>> '{chamada,atrasada}')::boolean IS NOT TRUE OR (p2 ->> 'no_ps_atrasado')::boolean IS NOT TRUE
     OR (p2 #>> '{atendimento,atrasado}')::boolean THEN
    RAISE EXCEPTION 'FALHOU: laranja há 30 min sem chamada: chamada e No PS atrasados, atendimento ainda não: %', p2;
  END IF;
  RAISE NOTICE 'OK  laranja sem chamada: chamada atrasada pelo alvo da cor';

  IF (p3 #>> '{chamada,vezes}')::int <> 2 OR (p3 #>> '{chamada,em}')::timestamptz < now() - interval '6 minutes'
     OR (p3 #>> '{chamada,atrasada}')::boolean OR (p3 #>> '{atendimento,atrasado}')::boolean OR (p3 ->> 'no_ps_atrasado')::boolean THEN
    RAISE EXCEPTION 'FALHOU: verde chamado duas vezes, no prazo: %', p3;
  END IF;
  -- a reclassificação de 5 min atrás não muda a hora da classificação
  IF (p3 #>> '{classificacao,em}')::timestamptz > now() - interval '29 minutes' THEN
    RAISE EXCEPTION 'FALHOU: a reclassificação zerou a hora da classificação: %', p3 -> 'classificacao';
  END IF;
  RAISE NOTICE 'OK  chamada repetida: duas vezes, a hora da última, no prazo da cor';

  IF (p4 #>> '{exames,feitos}')::int <> 1 OR (p4 #>> '{exames,total}')::int <> 2 OR (p4 #>> '{exames,atrasado}')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: exames 1 de 2, o pendente há 40 min com alvo de 30: %', p4 -> 'exames';
  END IF;
  RAISE NOTICE 'OK  exames: 1 de 2 (cancelado fora), pendente atrasado';
  IF (p4 #>> '{medicacao,pendentes}')::int <> 1 OR p4 #>> '{medicacao,ultima_em}' IS NULL OR (p4 #>> '{medicacao,atrasada}')::boolean THEN
    RAISE EXCEPTION 'FALHOU: medicação: 1 pendente, a última feita, sem alvo não atrasa: %', p4 -> 'medicacao';
  END IF;
  RAISE NOTICE 'OK  medicação: pendente sem "se necessário", sem alvo nunca atrasa';
  IF p4 #>> '{reavaliacao,prevista_em}' IS NULL OR (p4 #>> '{reavaliacao,atrasada}')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: reavaliação marcada para 5 min atrás: %', p4 -> 'reavaliacao';
  END IF;
  RAISE NOTICE 'OK  reavaliação atrasada pela hora marcada pelo médico';
  IF p4 #>> '{atendimento,em}' IS NULL OR (p4 ->> 'no_ps_atrasado')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: em atendimento há 50 min no PS com permanência de 40: %', p4;
  END IF;
  RAISE NOTICE 'OK  No PS depois do médico: alvo de permanência da unidade';

  IF (SELECT count(*) FROM public.log_auditoria WHERE acao = 'ver_porta_grade' AND ator_id = '10000000-0000-4000-8000-000000000001'
        AND unidade_id = '00000000-0000-4000-8000-00000000a9a1' AND created_at > now() - interval '15 minutes') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: acesso a dado de paciente deveria ficar na trilha uma vez a cada 15 min';
  END IF;
  RAISE NOTICE 'OK  acesso na auditoria, sem repetir a cada atualização';
END $$;

-- sem a chave de permanência, quem já foi atendido nunca fica atrasado no "No PS"
DELETE FROM public.configuracoes_unidade WHERE unidade_id = '00000000-0000-4000-8000-00000000a9a1' AND chave = 'alvo_permanencia_min';
TRUNCATE r;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO r SELECT public.porta_grade('00000000-0000-4000-8000-00000000a9a1');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT (x ->> 'no_ps_atrasado')::boolean FROM r, jsonb_array_elements(r.v -> 'pacientes') x WHERE x ->> 'nome' = 'Grade Em Atendimento') THEN
    RAISE EXCEPTION 'FALHOU: sem alvo de permanência, o atendido não atrasa';
  END IF;
  RAISE NOTICE 'OK  sem alvo de permanência: não atrasa';
END $$;

-- quem não é gestor não vê
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');  -- plantonista
DO $$ BEGIN
  PERFORM public.porta_grade('00000000-0000-4000-8000-00000000a9a1');
  RAISE EXCEPTION 'FALHOU: plantonista viu a grade do gestor';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista: recusado';
END $$;
-- gestor de outra unidade não vê
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');  -- enfermeira, sem vínculo nesta unidade
DO $$ BEGIN
  PERFORM public.porta_grade('00000000-0000-4000-8000-00000000a9a1');
  RAISE EXCEPTION 'FALHOU: quem não é da unidade viu a grade';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  fora da unidade: recusado';
END $$;
RESET ROLE;

-- 2FA ligado, sem segundo fator: recusado
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  PERFORM public.porta_grade('00000000-0000-4000-8000-00000000a9a1');
  RAISE EXCEPTION 'FALHOU: rodou sem segundo fator';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  sem segundo fator: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.porta_grade(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
