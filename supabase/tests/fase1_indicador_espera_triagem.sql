-- Fase 1, tarefa 3 — migration 20261029000002_indicador_espera_triagem.sql:
-- chegada → triagem (1ª classificação; reclassificação não conta), espera até
-- a chamada ao lado, alvo da unidade (padrão 10 min).
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- unidade sem nenhum outro episódio no dia do teste: uma unidade nova
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '00000000-0000-4000-8000-00000000a7a1', organizacao_id, 'Unidade do Indicador', tipo
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('00000000-0000-4000-8000-00000000a7a2', '00000000-0000-4000-8000-00000000a7a1', 'PS', 'emergencia', 1);
-- o setor de emergência já nasce com as salas de triagem (gatilho)
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000a7a1', 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome)
SELECT ('00000000-0000-4000-8000-0000000a70' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000000a7a1', 'Paciente ' || n
  FROM generate_series(1, 4) n;
-- ontem à tarde (horário de Brasília): 4 chegadas
--   1: triado em 4 min (chamado em 2)   2: triado em 8 min
--   3: triado em 30 min (fora do alvo) e reclassificado depois (não conta)
--   4: chegou e não foi triado
CREATE TEMP TABLE base AS SELECT ((private.data_atual() - 1)::timestamp + time '15:00') AT TIME ZONE 'America/Sao_Paulo' AS t0;
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
SELECT ('00000000-0000-4000-8000-0000000a7e0' || n)::uuid, '00000000-0000-4000-8000-00000000a7a1',
       ('00000000-0000-4000-8000-0000000a70' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000000a7a2',
       'triagem', 'Queixa', '10000000-0000-4000-8000-000000000004', (SELECT t0 FROM base)
  FROM generate_series(1, 4) n;
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, reclassificacao, criado_em)
SELECT ('00000000-0000-4000-8000-0000000a7e0' || x.n)::uuid, '00000000-0000-4000-8000-00000000a7a1',
       ('00000000-0000-4000-8000-0000000a70' || lpad(x.n::text, 2, '0'))::uuid, 'amarelo', 'adulto',
       '10000000-0000-4000-8000-000000000004', 'enfermeiro', x.reclass, (SELECT t0 FROM base) + make_interval(mins => x.m)
  FROM (VALUES (1, 4, false), (2, 8, false), (3, 30, false), (3, 50, true)) x(n, m, reclass);
INSERT INTO public.chamadas (unidade_id, setor_id, episodio_id, sala_id, etapa, numero, chamado_por, criado_em)
VALUES ('00000000-0000-4000-8000-00000000a7a1', '00000000-0000-4000-8000-00000000a7a2', '00000000-0000-4000-8000-0000000a7e01',
        (SELECT id FROM public.salas WHERE setor_id = '00000000-0000-4000-8000-00000000a7a2' ORDER BY nome LIMIT 1), 'triagem', 1, '10000000-0000-4000-8000-000000000004', (SELECT t0 FROM base) + interval '2 minutes');

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE r (v jsonb);
GRANT ALL ON r, base TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO r SELECT public.indicador_espera_triagem('00000000-0000-4000-8000-00000000a7a1', private.data_atual() - 1, private.data_atual());
RESET ROLE;
DO $$
DECLARE v jsonb := (SELECT v FROM r);
BEGIN
  IF (v ->> 'chegadas')::int <> 4 OR (v ->> 'triados')::int <> 3 OR (v ->> 'sem_triagem')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: contagens %', v; END IF;
  IF (v ->> 'alvo_min')::int <> 10 THEN RAISE EXCEPTION 'FALHOU: alvo padrão deveria ser 10'; END IF;
  IF (v ->> 'media_min')::numeric <> 14.0 THEN RAISE EXCEPTION 'FALHOU: média (4+8+30)/3 = 14, veio % (reclassificação não conta)', v ->> 'media_min'; END IF;
  IF (v ->> 'mediana_min')::numeric <> 8.0 THEN RAISE EXCEPTION 'FALHOU: mediana deveria ser 8, veio %', v ->> 'mediana_min'; END IF;
  IF (v ->> 'fora_alvo')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: 1 fora do alvo de 10 min'; END IF;
  IF (v #>> '{chamada,chamados}')::int <> 1 OR (v #>> '{chamada,mediana_min}')::numeric <> 2.0 THEN RAISE EXCEPTION 'FALHOU: espera até a chamada %', v -> 'chamada'; END IF;
  IF jsonb_array_length(v -> 'por_dia') <> 1 OR (v #>> '{por_dia,0,triados}')::int <> 3 THEN RAISE EXCEPTION 'FALHOU: por dia %', v -> 'por_dia'; END IF;
  RAISE NOTICE 'OK  média 14, mediana 8, 1 fora do alvo, 1 sem triagem, chamada 2 min, reclassificação ignorada';
END $$;

-- alvo da unidade: o gestor muda para 5 min e o 8 também passa a ficar fora
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.salvar_alvo_triagem('00000000-0000-4000-8000-00000000a7a1', 5);
DELETE FROM r;
INSERT INTO r SELECT public.indicador_espera_triagem('00000000-0000-4000-8000-00000000a7a1', private.data_atual() - 1, private.data_atual());
RESET ROLE;
DO $$ BEGIN
  IF ((SELECT v FROM r) ->> 'fora_alvo')::int <> 2 OR ((SELECT v FROM r) ->> 'alvo_min')::int <> 5 THEN RAISE EXCEPTION 'FALHOU: alvo da unidade não aplicado'; END IF;
  RAISE NOTICE 'OK  alvo configurável pela unidade';
END $$;

-- período fora (anteontem): nada
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF (public.indicador_espera_triagem('00000000-0000-4000-8000-00000000a7a1', private.data_atual() - 3, private.data_atual() - 2) ->> 'chegadas')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: período errado contou chegadas';
  END IF;
  RAISE NOTICE 'OK  filtra pelo período (dia de Brasília)';
END $$;
-- plantonista e período inválido: recusados
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.indicador_espera_triagem('00000000-0000-4000-8000-00000000a7a1', private.data_atual() - 1, private.data_atual());
  RAISE EXCEPTION 'FALHOU: plantonista viu o indicador';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista: recusado';
END $$;
DO $$ BEGIN
  PERFORM public.salvar_alvo_triagem('00000000-0000-4000-8000-00000000a7a1', 3);
  RAISE EXCEPTION 'FALHOU: plantonista mudou o alvo';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  só o gestor muda o alvo';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.indicador_espera_triagem(uuid, date, date)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
