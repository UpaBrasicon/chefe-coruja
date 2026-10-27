-- Fila do PS com dados novos — migration 20270131000001_fila_ps_detalhes.sql: por
-- episódio da porta nos setores da escala de quem chama, alergia, sala, médico, exames,
-- medicação (só contagem, sem remédio) e o alvo da cor da unidade.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- unidade e setor só deste teste; o 0003 (sem escala em outro lugar) é o plantonista na escala do setor agora
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '00000000-0000-4000-8000-00000000aac1', organizacao_id, 'Unidade da Fila', tipo
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('00000000-0000-4000-8000-00000000aac2', '00000000-0000-4000-8000-00000000aac1', 'PS da Fila', 'emergencia', 1);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000aac1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000aac1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-00000000aac1', 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT '00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-00000000aac2', '10000000-0000-4000-8000-000000000003', d, t
  FROM generate_series(private.data_atual() - 1, private.data_atual() + 1, interval '1 day') d, unnest(ARRAY['manha', 'tarde', 'noite']) t;
-- check-in feito: a escala só vale para a fila com o plantonista presente (plantoes_agora)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, now() - interval '1 minute'
  FROM public.escala_plantao e WHERE e.unidade_id = '00000000-0000-4000-8000-00000000aac1' AND e.perfil_id = '10000000-0000-4000-8000-000000000003';
-- o alvo do amarelo nesta unidade é 30 min (o de Manchester é 60)
INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor) VALUES ('00000000-0000-4000-8000-00000000aac1', 'alvo_medico_amarelo', '30');

-- 1: aguardando, alérgico (dipirona grave, látex leve), chamado duas vezes
-- 2: em atendimento com outro médico, nega alergia, 1 de 2 exames, 1 de 2 medicações checada
-- 3: na triagem, sem registro de alergia
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento) VALUES
  ('00000000-0000-4000-8000-0000000acb01', '00000000-0000-4000-8000-00000000aac1', 'Fila Alérgico', NULL),
  ('00000000-0000-4000-8000-0000000acb02', '00000000-0000-4000-8000-00000000aac1', 'Fila Em Atendimento', '1980-05-01'),
  ('00000000-0000-4000-8000-0000000acb03', '00000000-0000-4000-8000-00000000aac1', 'Fila Triagem', NULL);
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, cor_atual, classificado_em, atendimento_iniciado_em, atendimento_medico_id) VALUES
  ('00000000-0000-4000-8000-0000000ace01', '00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb01', '00000000-0000-4000-8000-00000000aac2',
   'atendimento', 'Dor abdominal', '10000000-0000-4000-8000-000000000004', now() - interval '40 minutes', 'amarelo', now() - interval '35 minutes', NULL, NULL),
  ('00000000-0000-4000-8000-0000000ace02', '00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb02', '00000000-0000-4000-8000-00000000aac2',
   'atendimento', 'Febre alta', '10000000-0000-4000-8000-000000000004', now() - interval '60 minutes', 'verde', now() - interval '55 minutes', now() - interval '20 minutes', '10000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-0000000ace03', '00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb03', '00000000-0000-4000-8000-00000000aac2',
   'triagem', 'Tosse seca', '10000000-0000-4000-8000-000000000004', now() - interval '5 minutes', NULL, NULL, NULL, NULL);
INSERT INTO public.alergias_paciente (unidade_id, paciente_id, substancia, substancia_norm, tipo, gravidade, registrado_por, registrado_em) VALUES
  ('00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb01', 'Látex', 'latex', 'latex', 'leve', '10000000-0000-4000-8000-000000000004', now() - interval '2 days'),
  ('00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb01', 'Dipirona', 'dipirona', 'medicamento', 'grave', '10000000-0000-4000-8000-000000000004', now() - interval '1 day');
INSERT INTO public.alergias_negacoes (unidade_id, paciente_id, tipo, registrado_por) VALUES
  ('00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb02', 'nega', '10000000-0000-4000-8000-000000000004');
INSERT INTO public.chamadas (unidade_id, setor_id, episodio_id, sala_id, etapa, numero, chamado_por, criado_em)
SELECT '00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-00000000aac2', '00000000-0000-4000-8000-0000000ace01', s.id,
       'atendimento', k, '10000000-0000-4000-8000-000000000003', now() - make_interval(mins => 20 - k)
  FROM (SELECT id FROM public.salas WHERE setor_id = '00000000-0000-4000-8000-00000000aac2' ORDER BY nome LIMIT 1) s, generate_series(1, 2) k;
INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, pedido_por, situacao, pedido_em) VALUES
  ('00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb02', '00000000-0000-4000-8000-0000000ace02', 'Hemograma', '10000000-0000-4000-8000-000000000006', 'resultado', now() - interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb02', '00000000-0000-4000-8000-0000000ace02', 'PCR', '10000000-0000-4000-8000-000000000006', 'pedido', now() - interval '15 minutes'),
  ('00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb02', '00000000-0000-4000-8000-0000000ace02', 'Ureia', '10000000-0000-4000-8000-000000000006', 'cancelado', now() - interval '15 minutes');
-- a prescrição é do outro médico (0006): pela política, o 0003 não a vê; pela fila, vê a contagem
CREATE FUNCTION pg_temp.pesar() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
  SELECT p.unidade_id, p.id, c.id, now(), 70, 'manual'
    FROM public.pacientes p JOIN public.conceito c ON c.nome = 'peso' AND c.unidade_id IS NULL
   WHERE p.id = '00000000-0000-4000-8000-0000000acb02' AND private.peso_do_atendimento(p.id) IS NULL $$;
SELECT pg_temp.pesar();
INSERT INTO public.prescricoes (id, unidade_id, paciente_id, medico_id, status, episodio_id, assinada_em)
VALUES ('00000000-0000-4000-8000-0000000acc01', '00000000-0000-4000-8000-00000000aac1', '00000000-0000-4000-8000-0000000acb02',
        '10000000-0000-4000-8000-000000000006', 'ativa', '00000000-0000-4000-8000-0000000ace02', now() - interval '15 minutes');
INSERT INTO public.prescricao_itens (id, prescricao_id, descricao, tipo, se_necessario, ordem) VALUES
  ('00000000-0000-4000-8000-0000000acd01', '00000000-0000-4000-8000-0000000acc01', 'Dipirona 1 g IV', 'medicamento', false, 1),
  ('00000000-0000-4000-8000-0000000acd02', '00000000-0000-4000-8000-0000000acc01', 'Ondansetrona 4 mg IV', 'medicamento', false, 2);
INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, situacao, registrado_por, registrado_em) VALUES
  ('00000000-0000-4000-8000-0000000acd01', '00000000-0000-4000-8000-0000000acb02', '00000000-0000-4000-8000-00000000aac1', 'feito',
   '10000000-0000-4000-8000-000000000004', now() - interval '5 minutes');

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE r (n int, v jsonb);
GRANT ALL ON r TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');  -- plantonista na escala do setor
INSERT INTO r SELECT 1, public.fila_ps_detalhes();
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');  -- plantonista da unidade, fora da escala do setor
INSERT INTO r SELECT 2, public.fila_ps_detalhes();
RESET ROLE;

DO $$
DECLARE
  ep jsonb := (SELECT r.v -> 'episodios' FROM r WHERE r.n = 1);
  fora jsonb := (SELECT r.v -> 'episodios' FROM r WHERE r.n = 2);
  a jsonb := ep -> '00000000-0000-4000-8000-0000000ace01';
  b jsonb := ep -> '00000000-0000-4000-8000-0000000ace02';
  c jsonb := ep -> '00000000-0000-4000-8000-0000000ace03';
BEGIN
  IF a IS NULL OR b IS NULL OR c IS NULL THEN RAISE EXCEPTION 'FALHOU: os três episódios do setor deveriam vir: %', ep; END IF;
  IF a #>> '{alergia,situacao}' <> 'tem' OR a #>> '{alergia,itens,0,substancia}' <> 'Dipirona'
     OR a #>> '{alergia,itens,0,gravidade}' <> 'grave' OR jsonb_array_length(a #> '{alergia,itens}') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: alergias com a grave primeiro: %', a -> 'alergia';
  END IF;
  RAISE NOTICE 'OK  alergias, a grave primeiro';
  IF b #>> '{alergia,situacao}' <> 'nega' OR c #>> '{alergia,situacao}' <> 'nao_perguntado' THEN
    RAISE EXCEPTION 'FALHOU: nega e não perguntado: % / %', b -> 'alergia', c -> 'alergia';
  END IF;
  RAISE NOTICE 'OK  nega e não perguntado';
  IF a ->> 'sala' IS NULL OR b ->> 'sala' IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: sala da última chamada: % / %', a ->> 'sala', b ->> 'sala'; END IF;
  RAISE NOTICE 'OK  sala da última chamada';
  IF b ->> 'medico' IS DISTINCT FROM (SELECT nome_completo FROM public.perfis WHERE id = '10000000-0000-4000-8000-000000000006') OR a ->> 'medico' IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: médico responsável: %', b ->> 'medico';
  END IF;
  RAISE NOTICE 'OK  médico responsável';
  IF (b #>> '{exames,feitos}')::int <> 1 OR (b #>> '{exames,total}')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: exames 1 de 2: %', b -> 'exames'; END IF;
  RAISE NOTICE 'OK  exames, sem o cancelado';
  IF (b #>> '{medicacao,pendentes}')::int <> 1 OR b #>> '{medicacao,ultima_em}' IS NULL THEN RAISE EXCEPTION 'FALHOU: medicação de outro médico: %', b -> 'medicacao'; END IF;
  IF ep::text ILIKE '%Ondansetrona%' OR ep::text ILIKE '%Dipirona 1 g%' THEN RAISE EXCEPTION 'FALHOU: nome de remédio saiu da fila'; END IF;
  RAISE NOTICE 'OK  medicação de outro médico em contagem, sem o remédio';
  IF (a ->> 'alvo_min')::int <> 30 OR (b ->> 'alvo_min')::int <> 120 OR c ->> 'alvo_min' IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: alvo da cor da unidade: % / % / %', a ->> 'alvo_min', b ->> 'alvo_min', c ->> 'alvo_min';
  END IF;
  RAISE NOTICE 'OK  alvo da cor da unidade (amarelo 30, não 60)';
  IF fora ? '00000000-0000-4000-8000-0000000ace01' THEN RAISE EXCEPTION 'FALHOU: quem está fora da escala do setor viu a fila'; END IF;
  RAISE NOTICE 'OK  fora da escala do setor: nada';
END $$;

-- 2FA ligado, sem segundo fator: recusado
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
DO $$ BEGIN
  PERFORM public.fila_ps_detalhes();
  RAISE EXCEPTION 'FALHOU: rodou sem segundo fator';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  sem segundo fator: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.fila_ps_detalhes()', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
