-- Testes da migration 20261001000005_fase8_outbox_rnds.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase8_outbox.sql
BEGIN;

-- internação de teste do paciente criado aqui
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario)
VALUES ('23000000-0000-4000-8000-000000000096', '21000000-0000-4000-8000-000000000001', 'Paciente da Fila', 'T-096');
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao)
SELECT '24000000-0000-4000-8000-000000000096', u.organizacao_id, u.id, '23000000-0000-4000-8000-000000000096',
       'internado', '22000000-0000-4000-8000-000000000001', now() - interval '2 days'
FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';

DO $$ BEGIN
  UPDATE public.internacoes SET status = 'alta_melhorada' WHERE id = '24000000-0000-4000-8000-000000000096';
  UPDATE public.internacoes SET status = 'alta_pedido' WHERE id = '24000000-0000-4000-8000-000000000096';
  IF (SELECT count(*) FROM public.interop_outbox WHERE referencia_id = '24000000-0000-4000-8000-000000000096') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: duas mudanças de alta enfileiraram duas vezes';
  END IF;
  RAISE NOTICE 'OK  alta enfileira o sumário uma vez só';

  UPDATE public.internacoes SET status = 'internado' WHERE id = '24000000-0000-4000-8000-000000000096';
  IF (SELECT status FROM public.interop_outbox WHERE referencia_id = '24000000-0000-4000-8000-000000000096') <> 'descartado' THEN
    RAISE EXCEPTION 'FALHOU: alta cancelada não descartou o item';
  END IF;
  UPDATE public.internacoes SET status = 'alta_melhorada' WHERE id = '24000000-0000-4000-8000-000000000096';
  IF (SELECT count(*) FROM public.interop_outbox WHERE referencia_id = '24000000-0000-4000-8000-000000000096' AND status = 'pendente') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: nova alta não reenfileirou';
  END IF;
  RAISE NOTICE 'OK  alta cancelada descarta; nova alta enfileira de novo';
END $$;

-- RAC: episódio encerrado com alta entra; encerrado com internação não
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario)
VALUES ('23000000-0000-4000-8000-000000000095', '21000000-0000-4000-8000-000000000001', 'Outro Paciente da Fila', 'T-095');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por)
VALUES ('25000000-0000-4000-8000-000000000096', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000096',
        '22000000-0000-4000-8000-000000000003', 'atendimento', 'dor de cabeça', '10000000-0000-4000-8000-000000000002'),
       ('25000000-0000-4000-8000-000000000097', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000095',
        '22000000-0000-4000-8000-000000000003', 'atendimento', 'dor torácica', '10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now(), desfecho = 'alta'
   WHERE id = '25000000-0000-4000-8000-000000000096';
  UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now(), desfecho = 'internacao'
   WHERE id = '25000000-0000-4000-8000-000000000097';
  IF NOT EXISTS (SELECT 1 FROM public.interop_outbox WHERE tipo_documento = 'rac' AND referencia_id = '25000000-0000-4000-8000-000000000096') THEN
    RAISE EXCEPTION 'FALHOU: atendimento encerrado com alta não entrou como RAC';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interop_outbox WHERE referencia_id = '25000000-0000-4000-8000-000000000097') THEN
    RAISE EXCEPTION 'FALHOU: atendimento que virou internação entrou como RAC';
  END IF;
  RAISE NOTICE 'OK  RAC do atendimento encerrado com alta; internação fica com o sumário';
END $$;

ROLLBACK;
