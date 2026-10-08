-- Fase 1, tarefa 7 — migration 20261030000001_filtros_bi.sql: recorte único
-- (período, setor, cor final, turno, grupo, médico que atendeu) nos quatro
-- indicadores, e as opções da barra.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '00000000-0000-4000-8000-00000000f7a1', organizacao_id, 'Unidade dos Filtros', tipo
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('00000000-0000-4000-8000-00000000f7a2', '00000000-0000-4000-8000-00000000f7a1', 'PS', 'emergencia', 1);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000f7a1', 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome)
SELECT ('00000000-0000-4000-8000-0000000f70' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000000f7a1', 'Paciente F' || n
  FROM generate_series(1, 4) n;
-- ontem às 10h: 1 e 2 atendidos pelo médico A (…02), 3 pelo médico B (…03), 4 evadiu sem médico
--   cores finais: 1 amarelo, 2 verde, 3 amarelo, 4 verde
CREATE TEMP TABLE base AS SELECT ((private.data_atual() - 1)::timestamp + time '10:00') AT TIME ZONE 'America/Sao_Paulo' AS t0;
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em,
                              atendimento_medico_id, atendimento_iniciado_em, desfecho, encerrado_em)
SELECT ('00000000-0000-4000-8000-0000000f7e0' || x.n)::uuid, '00000000-0000-4000-8000-00000000f7a1',
       ('00000000-0000-4000-8000-0000000f70' || lpad(x.n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000000f7a2',
       CASE WHEN x.med IS NULL THEN 'encerrado' ELSE 'atendimento' END, 'Queixa', '10000000-0000-4000-8000-000000000004',
       (SELECT t0 FROM base), x.med::uuid,
       CASE WHEN x.med IS NOT NULL THEN (SELECT t0 FROM base) + interval '30 minutes' END,
       CASE WHEN x.med IS NULL THEN 'evasao' END,
       CASE WHEN x.med IS NULL THEN (SELECT t0 FROM base) + interval '50 minutes' END
  FROM (VALUES (1, '10000000-0000-4000-8000-000000000002'), (2, '10000000-0000-4000-8000-000000000002'),
               (3, '10000000-0000-4000-8000-000000000003'), (4, NULL)) x(n, med);
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, criado_em)
SELECT ('00000000-0000-4000-8000-0000000f7e0' || x.n)::uuid, '00000000-0000-4000-8000-00000000f7a1',
       ('00000000-0000-4000-8000-0000000f70' || lpad(x.n::text, 2, '0'))::uuid, x.cor, 'adulto',
       '10000000-0000-4000-8000-000000000004', 'enfermeiro', (SELECT t0 FROM base) + interval '5 minutes'
  FROM (VALUES (1, 'amarelo'), (2, 'verde'), (3, 'amarelo'), (4, 'verde')) x(n, cor);

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE
  u uuid := '00000000-0000-4000-8000-00000000f7a1';
  d date := private.data_atual() - 1;
  a uuid := '10000000-0000-4000-8000-000000000002';
  o jsonb;
BEGIN
  IF (public.indicador_espera_triagem(u, d, d) ->> 'chegadas')::int <> 4 THEN RAISE EXCEPTION 'FALHOU: sem filtro'; END IF;
  IF (public.indicador_espera_medico(u, d, d, p_medico => a) ->> 'atendidos')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: médico A atendeu 2'; END IF;
  IF (public.indicador_espera_triagem(u, d, d, p_cor => 'amarelo') ->> 'chegadas')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: 2 amarelos'; END IF;
  IF (public.indicador_evasao(u, d, d, p_cor => 'verde') ->> 'evasoes')::int <> 1
     OR (public.indicador_evasao(u, d, d, p_cor => 'verde') ->> 'chegadas')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: evasão entre os verdes'; END IF;
  IF (public.pacientes_por_cor(u, d, d, p_medico => a) ->> 'total')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: cores do médico A'; END IF;
  IF (public.indicador_espera_triagem(u, d, d, p_turno => 'tarde') ->> 'chegadas')::int <> 0 THEN RAISE EXCEPTION 'FALHOU: turno da tarde (chegaram às 10h)'; END IF;
  o := public.opcoes_filtros_bi(u, d, d);
  IF jsonb_array_length(o -> 'medicos') <> 2 OR jsonb_array_length(o -> 'setores') <> 1 THEN RAISE EXCEPTION 'FALHOU: opções da barra %', o; END IF;
  BEGIN
    PERFORM public.indicador_espera_triagem(u, d, d, p_cor => 'roxo');
    RAISE EXCEPTION 'FALHOU: aceitou cor inválida';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  o mesmo recorte nos quatro indicadores: médico, cor, turno; opções da barra; cor inválida recusada';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.opcoes_filtros_bi('00000000-0000-4000-8000-00000000f7a1', private.data_atual() - 1, private.data_atual());
  RAISE EXCEPTION 'FALHOU: plantonista viu os filtros do gestor';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.opcoes_filtros_bi(uuid, date, date)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
