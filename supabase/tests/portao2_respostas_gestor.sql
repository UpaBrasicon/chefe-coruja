-- Testes da migration 20261125000001_respostas_gestor.sql (Portão 2, tarefa 6:
-- R2-03, R2-04, R2-05, R2-06, R2-07, R2-08): o "Pergunte à IA" do gestor
-- responde sem os achados da Rodada 2. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005');
DELETE FROM public.presenca_plantonista WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
-- escala antiga, de antes da trava: a mesma plantonista em dois setores no mesmo horário
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual() - 1, 'manha', now() - interval '30 hours', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   private.data_atual() - 1, 'manha', now() - interval '30 hours', 360),
  -- recepção: plantão de hoje começou há 1 h, sem check-in
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005',
   private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_sem_sobreposicao;

-- pacientes do teste
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario) VALUES
  ('23000000-0000-4000-8000-0000000e6001', '21000000-0000-4000-8000-000000000001', 'Parado Na Triagem', '1970-01-01', 'G6-1'),
  ('23000000-0000-4000-8000-0000000e6002', '21000000-0000-4000-8000-000000000001', 'Alta Invertida', '1970-01-01', 'G6-2'),
  ('23000000-0000-4000-8000-0000000e6003', '21000000-0000-4000-8000-000000000001', 'Internado Sem Leito', '1970-01-01', 'G6-3');
-- R2-08: ficha na triagem há 3 dias e 12 horas
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES ('21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000e6001', '22000000-0000-4000-8000-000000000003',
        'triagem', 'Dor', '10000000-0000-4000-8000-000000000005', now() - interval '84 hours 5 minutes');
-- R2-04: alta registrada antes da admissão; R2-03: internado sem leito
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, data_alta)
VALUES ('20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000e6002',
        'alta_melhorada', '22000000-0000-4000-8000-000000000001', now() - interval '2 days', now() - interval '3 days'),
       ('20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000e6003',
        'internado', '22000000-0000-4000-8000-000000000001', now() - interval '1 day', NULL);
-- R2-06: falta aberta de Ceftriaxona desde 8 dias atrás
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte)
VALUES ('00000000-0000-4000-8000-0000000e6010', 'Ceftriaxona Teste', 'ceftriaxona teste', 'pó 1 g', 'teste-gestor');
INSERT INTO public.faltas_medicamento (unidade_id, medicamento_id, situacao, sinalizada_por, sinalizada_em)
VALUES ('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000e6010', 'registrada',
        '10000000-0000-4000-8000-000000000001', now() - interval '8 days');

CREATE TEMP TABLE t (k text PRIMARY KEY, v jsonb);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.r(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT v FROM t WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.r(text) TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
INSERT INTO t SELECT 'ocup', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Como está a ocupação dos leitos agora?');
INSERT INTO t SELECT 'alta', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Qual a permanência média e onde está o gargalo da alta?');
INSERT INTO t SELECT 'ck', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Quem está atrasado no check-in hoje?');
INSERT INTO t SELECT 'farm', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Quais medicamentos estão em falta na farmácia?');
INSERT INTO t SELECT 'carga', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Alguém passou do limite de horas de plantão?');
INSERT INTO t SELECT 'porta', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Quantos esperam na porta e qual a espera máxima?');
INSERT INTO t SELECT 'pano', public.panorama_gestor('21000000-0000-4000-8000-000000000001');
RESET ROLE;

DO $$ BEGIN
  IF pg_temp.r('ocup') ->> 'resposta' NOT LIKE '%paciente(s) internado(s) ou em observação sem leito%' THEN
    RAISE EXCEPTION 'FALHOU: ocupação não diz quantos estão sem leito: %', pg_temp.r('ocup') ->> 'resposta';
  END IF;
  RAISE NOTICE 'OK  R2-03: ocupação diz quantos estão sem leito';
END $$;
DO $$ BEGIN
  IF (pg_temp.r('pano') -> 'n' ->> 'permanencia_media_d')::numeric < 0
     OR (pg_temp.r('pano') -> 'n' ->> 'altas_antes_da_admissao_30d')::int < 1
     OR pg_temp.r('alta') ->> 'resposta' NOT LIKE '%internação(ões) com alta antes da admissão ficaram fora da conta; corrija o registro%' THEN
    RAISE EXCEPTION 'FALHOU: permanência: % / %', pg_temp.r('pano') -> 'n' -> 'permanencia_media_d', pg_temp.r('alta') ->> 'resposta';
  END IF;
  RAISE NOTICE 'OK  R2-04: alta antes da admissão fora da média, com aviso (painel e pergunta)';
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.r('ck') -> 'itens') x
                  WHERE x ->> 'rotulo' LIKE 'Recepção de Teste · Pronto Socorro · manhã (__:__–__:__)') THEN
    RAISE EXCEPTION 'FALHOU: check-in sem turno e horário: %', pg_temp.r('ck') -> 'itens';
  END IF;
  RAISE NOTICE 'OK  R2-05: cada linha do check-in diz o turno e o horário';
END $$;
DO $$ BEGIN
  IF (pg_temp.r('farm') -> 'itens' -> 0 ->> 'rotulo') <> 'Ceftriaxona Teste pó 1 g'
     OR (pg_temp.r('farm') -> 'itens' -> 0 ->> 'valor') <> 'em falta desde ' || to_char((now() - interval '8 days') AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || ' · sem reposição' THEN
    RAISE EXCEPTION 'FALHOU: falta aberta sem nome ou data: %', pg_temp.r('farm') -> 'itens';
  END IF;
  RAISE NOTICE 'OK  R2-06: a falta aberta aparece pelo nome, com a data';
END $$;
DO $$
DECLARE i jsonb;
BEGIN
  SELECT x INTO i FROM jsonb_array_elements(pg_temp.r('carga') -> 'itens') x WHERE x ->> 'rotulo' = 'Plantonista de Teste';
  IF i ->> 'valor' NOT LIKE '6,0 h em 2 plantão(ões)%havia plantões sobrepostos%'
     OR pg_temp.r('carga') ->> 'resposta' NOT LIKE '%Havia plantões sobrepostos no período%' THEN
    RAISE EXCEPTION 'FALHOU: carga somou duas vezes ou não avisou: %', i;
  END IF;
  RAISE NOTICE 'OK  R2-07: o mesmo período conta uma vez e a sobreposição é avisada';
END $$;
DO $$ BEGIN
  IF pg_temp.r('porta') ->> 'resposta' NOT LIKE '%a mais longa, 3 d 12 h%'
     OR pg_temp.r('porta') ->> 'resposta' NOT LIKE '%1 ficha(s) parada(s) há mais de 24 h%possível evasão%'
     OR pg_temp.r('porta') ->> 'resposta' LIKE '%5045 min%' THEN
    RAISE EXCEPTION 'FALHOU: espera: %', pg_temp.r('porta') ->> 'resposta';
  END IF;
  RAISE NOTICE 'OK  R2-08: espera em dias e horas e alerta de ficha parada';
END $$;
ROLLBACK;
