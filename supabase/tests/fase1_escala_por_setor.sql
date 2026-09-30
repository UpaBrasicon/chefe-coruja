-- Testes da migration 20260926000011_fase1_escala_por_setor.sql
-- Banco local com o seed, transação com ROLLBACK:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase1_escala_por_setor.sql
--
-- O plantonista do seed (…0002) fica escalado AGORA só na Clínica Médica
-- (setor …0001). O paciente Um está na Clínica Médica; a Criança Quatro, na
-- Observação (setor …0002), fora do plantão dele.
BEGIN;

DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

-- acesso pago ativo para o plantonista: não pode mais abrir nada
INSERT INTO public.acessos_plantonista (perfil_id, unidade_id)
VALUES ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

DO $$ BEGIN
  IF private.tem_acesso_atendimento('21000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: acesso pago ainda vale';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'FALHOU: paciente de outro setor visível (acesso pago ou unidade inteira)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: paciente do setor do plantão sumiu';
  END IF;
  RAISE NOTICE 'OK  acesso pago desligado; só o setor do plantão é visível';
END $$;

DO $$ BEGIN
  INSERT INTO public.pacientes (unidade_id, nome, setor_id)
  VALUES ('21000000-0000-4000-8000-000000000001', 'Paciente Fictício Cinco', '22000000-0000-4000-8000-000000000001');
  RAISE NOTICE 'OK  cadastra paciente no setor do plantão';
  BEGIN
    INSERT INTO public.pacientes (unidade_id, nome, setor_id)
    VALUES ('21000000-0000-4000-8000-000000000001', 'Paciente Fictício Seis', '22000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'FALHOU: cadastrou paciente no Pronto Socorro sem plantão lá';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK  cadastro em setor fora do plantão é recusado';
  END;
  BEGIN
    INSERT INTO public.pacientes (unidade_id, nome) VALUES ('21000000-0000-4000-8000-000000000001', 'Paciente Sem Setor');
    RAISE EXCEPTION 'FALHOU: plantonista cadastrou paciente sem setor';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK  paciente sem setor é recusado para o plantonista';
  END;
END $$;

DO $$ BEGIN
  PERFORM public.registrar_prescricao_itens('23000000-0000-4000-8000-000000000001', NULL, '[]');
  RAISE NOTICE 'OK  prescreve para paciente do setor do plantão';
  BEGIN
    PERFORM public.registrar_prescricao_itens('23000000-0000-4000-8000-000000000004', NULL, '[]');
    RAISE EXCEPTION 'FALHOU: prescreveu para paciente de outro setor';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  prescrição fora do setor recusada (%)', SQLERRM;
  END;
  BEGIN
    PERFORM public.salvar_documento('23000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000001', 'evolucao', 'texto');
    RAISE EXCEPTION 'FALHOU: documento para paciente de outro setor';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Acesso negado%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  documento fora do setor recusado';
  END;
  IF private.paciente_no_meu_plantao('23000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'FALHOU: observação/prescrição de outro setor liberada pela regra';
  END IF;
  RAISE NOTICE 'OK  regra de observação e prescrição por setor';
END $$;

-- gestor continua vendo a unidade toda
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'FALHOU: gestor perdeu a visão da unidade';
  END IF;
  RAISE NOTICE 'OK  gestor mantém a unidade inteira';
END $$;

RESET ROLE;
ROLLBACK;
