-- Fase 1, tarefa 2 — migration 20261029000001_porta_agora.sql: Dashboard
-- PS/UPA do gestor, por etapa, com nome, setor e leito; acesso auditado.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- o banco local pode ter episódios de outros testes: a conta é pela diferença
CREATE TEMP TABLE antes AS
  SELECT public.porta_agora('21000000-0000-4000-8000-000000000001') AS r
   WHERE set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) IS NOT NULL;

INSERT INTO public.pacientes (id, unidade_id, nome) VALUES
  ('00000000-0000-4000-8000-0000000f0001', '21000000-0000-4000-8000-000000000001', 'Porta Triagem'),
  ('00000000-0000-4000-8000-0000000f0002', '21000000-0000-4000-8000-000000000001', 'Porta Laranja Atrasado'),
  ('00000000-0000-4000-8000-0000000f0003', '21000000-0000-4000-8000-000000000001', 'Porta Verde No Prazo'),
  ('00000000-0000-4000-8000-0000000f0004', '21000000-0000-4000-8000-000000000001', 'Porta Em Atendimento');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, cor_atual, classificado_em, atendimento_iniciado_em) VALUES
  ('00000000-0000-4000-8000-0000000fe001', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000f0001', '22000000-0000-4000-8000-000000000003',
   'triagem', 'Dor', '10000000-0000-4000-8000-000000000004', now() - interval '25 minutes', NULL, NULL, NULL),
  ('00000000-0000-4000-8000-0000000fe002', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000f0002', '22000000-0000-4000-8000-000000000003',
   'atendimento', 'Dor torácica', '10000000-0000-4000-8000-000000000004', now() - interval '40 minutes', 'laranja', now() - interval '30 minutes', NULL),
  ('00000000-0000-4000-8000-0000000fe003', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000f0003', '22000000-0000-4000-8000-000000000003',
   'atendimento', 'Tosse', '10000000-0000-4000-8000-000000000004', now() - interval '40 minutes', 'verde', now() - interval '30 minutes', NULL),
  ('00000000-0000-4000-8000-0000000fe004', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000f0004', '22000000-0000-4000-8000-000000000003',
   'atendimento', 'Febre', '10000000-0000-4000-8000-000000000004', now() - interval '50 minutes', 'amarelo', now() - interval '45 minutes', now() - interval '10 minutes');

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE r (v jsonb);
GRANT ALL ON r, antes TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');  -- gestor
INSERT INTO r SELECT public.porta_agora('21000000-0000-4000-8000-000000000001');
INSERT INTO r SELECT public.porta_agora('21000000-0000-4000-8000-000000000001');  -- 2ª leitura (atualização automática)
RESET ROLE;

DO $$
DECLARE
  v jsonb := (SELECT v FROM r LIMIT 1);
  a jsonb := (SELECT r FROM antes);
  lar jsonb;
BEGIN
  IF (v #>> '{etapas,triagem,n}')::int - (a #>> '{etapas,triagem,n}')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: aguardando triagem'; END IF;
  IF (v #>> '{etapas,aguardando_medico,n}')::int - (a #>> '{etapas,aguardando_medico,n}')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: aguardando médico'; END IF;
  IF (v #>> '{etapas,em_atendimento,n}')::int - (a #>> '{etapas,em_atendimento,n}')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: em atendimento'; END IF;
  IF (v #>> '{aguardando_por_cor,laranja,fora_alvo}')::int - (a #>> '{aguardando_por_cor,laranja,fora_alvo}')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: laranja há 30 min deveria passar do alvo de 10'; END IF;
  IF (v #>> '{aguardando_por_cor,verde,fora_alvo}')::int <> (a #>> '{aguardando_por_cor,verde,fora_alvo}')::int THEN RAISE EXCEPTION 'FALHOU: verde há 30 min está no prazo de 120'; END IF;
  IF (v #>> '{etapas,triagem,espera_max_min}')::int < 25 THEN RAISE EXCEPTION 'FALHOU: espera mais antiga da triagem'; END IF;
  SELECT x INTO lar FROM jsonb_array_elements(v -> 'pacientes') x WHERE x ->> 'nome' = 'Porta Laranja Atrasado';
  IF lar IS NULL OR lar ->> 'etapa' <> 'aguardando_medico' OR lar ->> 'setor' <> 'Pronto Socorro' OR (lar ->> 'fora_alvo')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: lista sem nome/etapa/setor/atraso do paciente: %', lar;
  END IF;
  RAISE NOTICE 'OK  etapas, cor fora do alvo, espera mais antiga e lista com nome e setor';
  IF (SELECT count(*) FROM public.log_auditoria WHERE acao = 'ver_porta_agora' AND ator_id = '10000000-0000-4000-8000-000000000001'
        AND created_at > now() - interval '15 minutes') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: acesso a dado de paciente deveria ficar na trilha uma vez a cada 15 min';
  END IF;
  RAISE NOTICE 'OK  acesso na auditoria, sem repetir a cada atualização';
END $$;

-- quem não é gestor não vê
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');  -- plantonista
DO $$ BEGIN
  PERFORM public.porta_agora('21000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FALHOU: plantonista viu a porta do gestor';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista: recusado';
END $$;
RESET ROLE;

-- 2FA ligado, sem segundo fator: recusado
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  PERFORM public.porta_agora('21000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FALHOU: rodou sem segundo fator';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  sem segundo fator: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.porta_agora(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
