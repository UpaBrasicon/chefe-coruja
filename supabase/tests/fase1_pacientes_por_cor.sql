-- Fase 1, tarefa 5 — migration 20261029000005_pacientes_por_cor.sql: cor
-- final, reclassificados (subiu/baixou), filtros de setor, grupo e turno.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '00000000-0000-4000-8000-00000000c9a1', organizacao_id, 'Unidade das Cores', tipo
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('00000000-0000-4000-8000-00000000c9a2', '00000000-0000-4000-8000-00000000c9a1', 'PS Adulto', 'emergencia', 1),
  ('00000000-0000-4000-8000-00000000c9a3', '00000000-0000-4000-8000-00000000c9a1', 'PS Infantil', 'emergencia', 2);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000c9a1', 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome)
SELECT ('00000000-0000-4000-8000-0000000c90' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000000c9a1', 'Paciente C' || n
  FROM generate_series(1, 5) n;
-- ontem, horário de Brasília:
--   1: 08h, PS Adulto, amarelo → reclassificado laranja (subiu)        [manhã]
--   2: 14h, PS Adulto, verde                                         [tarde]
--   3: 20h, PS Infantil, pediátrico, laranja → reclassificado verde (baixou) [noite]
--   4: 03h, PS Adulto, sem classificação (evadiu)                     [noite]
--   5: 10h, PS Adulto, vermelho                                       [manhã]
CREATE TEMP TABLE base AS SELECT (private.data_atual() - 1) AS d;
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
SELECT ('00000000-0000-4000-8000-0000000c9e0' || x.n)::uuid, '00000000-0000-4000-8000-00000000c9a1',
       ('00000000-0000-4000-8000-0000000c90' || lpad(x.n::text, 2, '0'))::uuid, x.setor::uuid,
       'atendimento', 'Queixa', '10000000-0000-4000-8000-000000000004',
       ((SELECT d FROM base)::timestamp + x.h) AT TIME ZONE 'America/Sao_Paulo'
  FROM (VALUES (1, '00000000-0000-4000-8000-00000000c9a2', time '08:00'), (2, '00000000-0000-4000-8000-00000000c9a2', time '14:00'),
               (3, '00000000-0000-4000-8000-00000000c9a3', time '20:00'), (4, '00000000-0000-4000-8000-00000000c9a2', time '03:00'),
               (5, '00000000-0000-4000-8000-00000000c9a2', time '10:00')) x(n, setor, h);
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, reclassificacao, criado_em)
SELECT ('00000000-0000-4000-8000-0000000c9e0' || x.n)::uuid, '00000000-0000-4000-8000-00000000c9a1',
       ('00000000-0000-4000-8000-0000000c90' || lpad(x.n::text, 2, '0'))::uuid, x.cor, x.pub,
       '10000000-0000-4000-8000-000000000004', 'enfermeiro', x.rc,
       (SELECT e.chegada_em FROM public.episodios e WHERE e.id = ('00000000-0000-4000-8000-0000000c9e0' || x.n)::uuid) + make_interval(mins => x.m)
  FROM (VALUES (1, 'amarelo', 'adulto', false, 5), (1, 'laranja', 'adulto', true, 20),
               (2, 'verde', 'adulto', false, 5),
               (3, 'laranja', 'pediatrico', false, 5), (3, 'verde', 'pediatrico', true, 30),
               (5, 'vermelho', 'adulto', false, 1)) x(n, cor, pub, rc, m);

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
GRANT ALL ON base TO authenticated;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE
  u uuid := '00000000-0000-4000-8000-00000000c9a1';
  d date := (SELECT d FROM base);
  v jsonb;
BEGIN
  v := public.pacientes_por_cor(u, d, d);
  IF (v ->> 'total')::int <> 5 THEN RAISE EXCEPTION 'FALHOU: total %', v ->> 'total'; END IF;
  IF v -> 'por_cor' <> '{"vermelho": 1, "laranja": 1, "amarelo": 0, "verde": 2, "azul": 0, "sem_classificacao": 1}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: cor final %', v -> 'por_cor';
  END IF;
  IF v -> 'reclassificados' <> '{"total": 2, "subiram": 1, "baixaram": 1}'::jsonb THEN RAISE EXCEPTION 'FALHOU: reclassificados %', v -> 'reclassificados'; END IF;
  IF jsonb_array_length(v -> 'setores') <> 2 THEN RAISE EXCEPTION 'FALHOU: setores do filtro %', v -> 'setores'; END IF;
  RAISE NOTICE 'OK  cor final (laranja do reclassificado, verde do que baixou), sem classificação, subiu/baixou';

  v := public.pacientes_por_cor(u, d, d, '00000000-0000-4000-8000-00000000c9a3');
  IF (v ->> 'total')::int <> 1 OR (v #>> '{por_cor,verde}')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: filtro de setor %', v; END IF;
  v := public.pacientes_por_cor(u, d, d, NULL, 'pediatrico');
  IF (v ->> 'total')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: filtro pediátrico %', v ->> 'total'; END IF;
  v := public.pacientes_por_cor(u, d, d, NULL, NULL, 'manha');
  IF (v ->> 'total')::int <> 2 OR (v #>> '{por_cor,vermelho}')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: turno manhã %', v; END IF;
  v := public.pacientes_por_cor(u, d, d, NULL, NULL, 'noite');
  IF (v ->> 'total')::int <> 2 OR (v #>> '{por_cor,sem_classificacao}')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: turno noite (20h e 3h) %', v; END IF;
  RAISE NOTICE 'OK  filtros de setor, grupo pediátrico e turno (noite inclui a madrugada)';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.pacientes_por_cor('00000000-0000-4000-8000-00000000c9a1', private.data_atual() - 1, private.data_atual());
  RAISE EXCEPTION 'FALHOU: plantonista viu o indicador';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.pacientes_por_cor(uuid, date, date, uuid, text, text)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
