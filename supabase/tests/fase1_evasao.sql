-- Fase 1, tarefa 6 — migration 20261029000006_evasao.sql: evasão pelo
-- momento e pelo motivo, alta a pedido separada, casos com nome (auditado),
-- motivo registrado na retirada da fila.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '00000000-0000-4000-8000-00000000d6a1', organizacao_id, 'Unidade da Evasão', tipo
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('00000000-0000-4000-8000-00000000d6a2', '00000000-0000-4000-8000-00000000d6a1', 'PS', 'emergencia', 1),
  ('00000000-0000-4000-8000-00000000d6a3', '00000000-0000-4000-8000-00000000d6a1', 'Observação', 'observacao', 2);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000d6a1', 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome)
SELECT ('00000000-0000-4000-8000-0000000d60' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000000d6a1', 'Paciente E' || n
  FROM generate_series(1, 6) n;
CREATE TEMP TABLE base AS SELECT ((private.data_atual() - 1)::timestamp + time '10:00') AT TIME ZONE 'America/Sao_Paulo' AS t0;
-- 1: evadiu antes da triagem (retirada da fila), motivo "demora"
-- 2: evadiu esperando o médico (amarelo), sem motivo (antigo) → sem informação
-- 3: evadiu durante o atendimento, motivo "melhorou"
-- 4: evadiu da observação, motivo "outro serviço"
-- 5: alta a pedido (não é evasão)
-- 6: alta comum
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em,
                              atendimento_iniciado_em, desfecho, desfecho_motivo, desfecho_detalhes, encerrado_em)
SELECT ('00000000-0000-4000-8000-0000000d6e0' || x.n)::uuid, '00000000-0000-4000-8000-00000000d6a1',
       ('00000000-0000-4000-8000-0000000d60' || lpad(x.n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000000d6a2',
       'encerrado', 'Queixa', '10000000-0000-4000-8000-000000000004', (SELECT t0 FROM base),
       CASE WHEN x.atend THEN (SELECT t0 FROM base) + interval '40 minutes' END,
       x.desf, x.dm, x.det::jsonb, (SELECT t0 FROM base) + interval '90 minutes'
  FROM (VALUES (1, false, 'evasao', 'evasao: cansou de esperar na recepção', '{"motivo_evasao": "demora"}'),
               (2, false, 'evasao', 'evasao: saiu sem avisar', NULL),
               (3, true,  'evasao', 'Saiu durante a reavaliação', '{"motivo_evasao": "melhorou"}'),
               (4, true,  'observacao', NULL, NULL),
               (5, true,  'alta_a_pedido', 'Pediu para sair', NULL),
               (6, true,  'alta', NULL, NULL)) x(n, atend, desf, dm, det);
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, criado_em)
SELECT ('00000000-0000-4000-8000-0000000d6e0' || n)::uuid, '00000000-0000-4000-8000-00000000d6a1',
       ('00000000-0000-4000-8000-0000000d60' || lpad(n::text, 2, '0'))::uuid, 'amarelo', 'adulto',
       '10000000-0000-4000-8000-000000000004', 'enfermeiro', (SELECT t0 FROM base) + interval '5 minutes'
  FROM generate_series(2, 6) n;
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, data_alta, episodio_id, alta_detalhes, alta_observacoes)
SELECT u.organizacao_id, u.id, '00000000-0000-4000-8000-0000000d6004', 'alta_evasao', '00000000-0000-4000-8000-00000000d6a3',
       (SELECT t0 FROM base) + interval '60 minutes', (SELECT t0 FROM base) + interval '3 hours',
       '00000000-0000-4000-8000-0000000d6e04', '{"motivo_evasao": "outro_servico"}', 'Foi ao hospital particular'
  FROM public.unidades u WHERE u.id = '00000000-0000-4000-8000-00000000d6a1';

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
  u uuid := '00000000-0000-4000-8000-00000000d6a1';
  v jsonb := public.indicador_evasao(u, private.data_atual() - 1, private.data_atual());
BEGIN
  IF (v ->> 'chegadas')::int <> 6 OR (v ->> 'evasoes')::int <> 4 OR (v ->> 'alta_a_pedido')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: contagens % % %', v ->> 'chegadas', v ->> 'evasoes', v ->> 'alta_a_pedido';
  END IF;
  IF v -> 'por_momento' <> '{"antes_triagem": 1, "aguardando_medico": 1, "durante_atendimento": 1, "observacao": 1}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: momento %', v -> 'por_momento';
  END IF;
  IF v -> 'por_motivo' <> '{"demora": 1, "melhorou": 1, "outro_servico": 1, "sem_informacao": 1, "outro": 0}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: motivo %', v -> 'por_motivo';
  END IF;
  IF (v #>> '{por_cor,sem_classificacao}')::int <> 1 OR (v #>> '{por_cor,amarelo}')::int <> 3 THEN RAISE EXCEPTION 'FALHOU: cor %', v -> 'por_cor'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'casos') c
                  WHERE c ->> 'nome' = 'Paciente E1' AND c ->> 'justificativa' = 'cansou de esperar na recepção') THEN
    RAISE EXCEPTION 'FALHOU: caso com nome e justificativa %', v -> 'casos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'casos') c WHERE c ->> 'momento' = 'observacao' AND c ->> 'justificativa' = 'Foi ao hospital particular') THEN
    RAISE EXCEPTION 'FALHOU: evasão da observação';
  END IF;
  RAISE NOTICE 'OK  4 evasões em 6 chegadas, alta a pedido à parte, por momento, motivo e cor; casos com nome e justificativa';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.log_auditoria WHERE acao = 'ver_evasoes' AND unidade_id = '00000000-0000-4000-8000-00000000d6a1') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: acesso aos nomes sem auditoria';
  END IF;
  RAISE NOTICE 'OK  acesso aos casos na auditoria';
END $$;

-- motivo na retirada da fila: só em evasão, recente, da lista
UPDATE public.episodios SET encerrado_em = now() - interval '10 minutes' WHERE id = '00000000-0000-4000-8000-0000000d6e02';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.registrar_motivo_evasao('00000000-0000-4000-8000-0000000d6e02', 'outro');
DO $$
DECLARE v jsonb := public.indicador_evasao('00000000-0000-4000-8000-00000000d6a1', private.data_atual() - 1, private.data_atual());
BEGIN
  IF (v #>> '{por_motivo,outro}')::int <> 1 OR (v #>> '{por_motivo,sem_informacao}')::int <> 0 THEN RAISE EXCEPTION 'FALHOU: motivo registrado %', v -> 'por_motivo'; END IF;
  BEGIN
    PERFORM public.registrar_motivo_evasao('00000000-0000-4000-8000-0000000d6e06', 'demora');
    RAISE EXCEPTION 'FALHOU: aceitou motivo em alta comum';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.registrar_motivo_evasao('00000000-0000-4000-8000-0000000d6e01', 'demora');  -- evasão de ontem
    RAISE EXCEPTION 'FALHOU: aceitou motivo depois de 2 horas';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  motivo registrado na evasão recente; recusado em alta comum e depois de 2 h';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.indicador_evasao('00000000-0000-4000-8000-00000000d6a1', private.data_atual() - 1, private.data_atual());
  RAISE EXCEPTION 'FALHOU: plantonista viu o indicador';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  plantonista: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.indicador_evasao(uuid, date, date, uuid, text, text, text, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.registrar_motivo_evasao(uuid, text)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
