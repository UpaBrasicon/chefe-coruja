-- Fase 1, tarefa 4 — migration 20261029000003_indicador_espera_medico.sql:
-- da 1ª classificação ao médico, cor/alvo da última classificação antes do
-- médico, alvos ajustáveis pela unidade, atrasados com nome (auditado).
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '00000000-0000-4000-8000-00000000b8a1', organizacao_id, 'Unidade do Indicador Médico', tipo
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('00000000-0000-4000-8000-00000000b8a2', '00000000-0000-4000-8000-00000000b8a1', 'PS', 'emergencia', 1);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000b8a1', 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome)
SELECT ('00000000-0000-4000-8000-0000000b80' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000000b8a1', 'Paciente M' || n
  FROM generate_series(1, 4) n;
CREATE TEMP TABLE base AS SELECT ((private.data_atual() - 1)::timestamp + time '09:00') AT TIME ZONE 'America/Sao_Paulo' AS t0;
-- 1: amarelo, médico em 30 min (alvo 60: no prazo)
-- 2: amarelo reclassificado laranja; médico 35 min depois da 1ª (alvo 10: atraso)
-- 3: verde, nunca viu o médico, evadiu 195 min depois (alvo 120: atraso, sem médico)
-- 4: azul, médico em 60 min (alvo 240: no prazo)
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, atendimento_iniciado_em, desfecho, encerrado_em)
SELECT ('00000000-0000-4000-8000-0000000b8e0' || x.n)::uuid, '00000000-0000-4000-8000-00000000b8a1',
       ('00000000-0000-4000-8000-0000000b80' || lpad(x.n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000000b8a2',
       x.etapa, 'Queixa', '10000000-0000-4000-8000-000000000004', (SELECT t0 FROM base),
       (SELECT t0 FROM base) + make_interval(mins => x.med), x.desf,
       CASE WHEN x.etapa = 'encerrado' THEN (SELECT t0 FROM base) + interval '200 minutes' END
  FROM (VALUES (1, 'atendimento', 35, NULL), (2, 'atendimento', 40, NULL), (3, 'encerrado', NULL, 'evasao'), (4, 'atendimento', 65, NULL))
       AS x(n, etapa, med, desf);
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, reclassificacao, criado_em)
SELECT ('00000000-0000-4000-8000-0000000b8e0' || x.n)::uuid, '00000000-0000-4000-8000-00000000b8a1',
       ('00000000-0000-4000-8000-0000000b80' || lpad(x.n::text, 2, '0'))::uuid, x.cor, 'adulto',
       '10000000-0000-4000-8000-000000000004', 'enfermeiro', x.rc, (SELECT t0 FROM base) + make_interval(mins => x.m)
  FROM (VALUES (1, 'amarelo', 5, false), (2, 'amarelo', 5, false), (2, 'laranja', 10, true),
               (3, 'verde', 5, false), (4, 'azul', 5, false)) x(n, cor, m, rc);

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE r (v jsonb);
GRANT ALL ON r, base TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO r SELECT public.indicador_espera_medico('00000000-0000-4000-8000-00000000b8a1', private.data_atual() - 1, private.data_atual());
RESET ROLE;
DO $$
DECLARE v jsonb := (SELECT v FROM r);
BEGIN
  IF (v ->> 'classificados')::int <> 4 OR (v ->> 'atendidos')::int <> 3 OR (v ->> 'sem_medico')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: contagens %', v; END IF;
  IF (v ->> 'mediana_min')::numeric <> 35.0 THEN RAISE EXCEPTION 'FALHOU: mediana de 30, 35 e 60 é 35; veio %', v ->> 'mediana_min'; END IF;
  IF (v ->> 'fora_alvo')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: 2 atrasos (laranja reclassificado e verde que evadiu); veio %', v ->> 'fora_alvo'; END IF;
  IF (v #>> '{por_cor,laranja,fora_alvo}')::int <> 1 OR (v #>> '{por_cor,amarelo,atendidos}')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: a cor que vale é a última antes do médico: %', v -> 'por_cor';
  END IF;
  IF (v #>> '{por_cor,verde,sem_medico}')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: verde sem médico'; END IF;
  IF jsonb_array_length(v -> 'atrasados') <> 2
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'atrasados') a WHERE a ->> 'nome' = 'Paciente M3' AND (a ->> 'sem_medico')::boolean) THEN
    RAISE EXCEPTION 'FALHOU: lista de atrasados com nome %', v -> 'atrasados';
  END IF;
  IF (SELECT count(*) FROM public.log_auditoria WHERE acao = 'ver_atrasos_medico' AND unidade_id = '00000000-0000-4000-8000-00000000b8a1') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: acesso aos nomes sem auditoria';
  END IF;
  RAISE NOTICE 'OK  mediana 35; 2 atrasos (reclassificado e evadido); cor da última classificação; atrasados com nome e auditoria';
END $$;

-- a unidade ajusta o amarelo para 20 min: o paciente 1 (30 min) passa a atrasar;
-- devolver ao valor do protocolo apaga o ajuste
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.salvar_alvos_medico('00000000-0000-4000-8000-00000000b8a1',
  '{"vermelho": 0, "laranja": 10, "amarelo": 20, "verde": 120, "azul": 240}');
DELETE FROM r;
INSERT INTO r SELECT public.indicador_espera_medico('00000000-0000-4000-8000-00000000b8a1', private.data_atual() - 1, private.data_atual());
RESET ROLE;
DO $$ BEGIN
  IF ((SELECT v FROM r) ->> 'fora_alvo')::int <> 3 THEN RAISE EXCEPTION 'FALHOU: alvo da unidade não aplicado'; END IF;
  IF (SELECT count(*) FROM public.configuracoes_unidade WHERE unidade_id = '00000000-0000-4000-8000-00000000b8a1' AND chave LIKE 'alvo_medico_%') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: só o amarelo difere do protocolo';
  END IF;
  IF (private.limites_unidade('00000000-0000-4000-8000-00000000b8a1') #>> '{alvos_medico,amarelo}')::int <> 20 THEN RAISE EXCEPTION 'FALHOU: limites sem o alvo novo'; END IF;
  RAISE NOTICE 'OK  alvos ajustáveis pela unidade; igual ao protocolo não grava';
END $$;

-- plantonista: recusado
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.indicador_espera_medico('00000000-0000-4000-8000-00000000b8a1', private.data_atual() - 1, private.data_atual());
  RAISE EXCEPTION 'FALHOU: plantonista viu o indicador';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista: recusado';
END $$;
DO $$ BEGIN
  PERFORM public.salvar_alvos_medico('00000000-0000-4000-8000-00000000b8a1', '{"vermelho": 0, "laranja": 10, "amarelo": 60, "verde": 120, "azul": 240}');
  RAISE EXCEPTION 'FALHOU: plantonista mudou os alvos';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  só o gestor muda os alvos';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.indicador_espera_medico(uuid, date, date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.salvar_alvos_medico(uuid, jsonb)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
