-- Testes da migration 20260926000014_fase1_revisao_registro_tardio.sql
-- Banco local com o seed, transação com ROLLBACK:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase1_revisao_tardia.sql
--
-- O plantonista (…0002) esteve de plantão de now()-31h a now()-25h e só
-- agora o aparelho sincroniza. Gestor: …0001.
BEGIN;

DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002', private.data_atual() - 1, 'manha', now() - interval '31 hours', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

CREATE TEMP TABLE r (caso text, saida jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;
CREATE FUNCTION pg_temp.item(p_id text, p_hora interval) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('id', p_id, 'tipo', 'observacao', 'hora', now() - p_hora, 'sem_conexao', true,
    'ultimo_contato', now() - p_hora - interval '1 hour', 'aparelho_id', 'aparelho-teste',
    'dados', jsonb_build_object('paciente_id', '23000000-0000-4000-8000-000000000001',
                                'conceito_id', '8d3ff6a6-6240-8c0d-bcd2-09186f3b518a', 'valor_num', 77))
$$;
GRANT EXECUTE ON FUNCTION pg_temp.item(text, interval) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
INSERT INTO r SELECT 'tardio', public.sincronizar_registros(jsonb_build_array(
  pg_temp.item('b0000000-0000-4000-8000-000000000001', '26 hours'),    -- durante o plantão, chega 26 h depois
  pg_temp.item('b0000000-0000-4000-8000-000000000002', '30 hours 30 minutes')  -- início do plantão, chega 30 h depois
));
INSERT INTO r SELECT 'fora', public.sincronizar_registros(jsonb_build_array(
  pg_temp.item('b0000000-0000-4000-8000-000000000003', '40 hours')));  -- antes do plantão: recusa, não revisão
INSERT INTO r SELECT 'reenvio', public.sincronizar_registros(jsonb_build_array(
  pg_temp.item('b0000000-0000-4000-8000-000000000001', '26 hours')));

DO $$ BEGIN
  PERFORM public.decidir_revisao_sincronizacao('b0000000-0000-4000-8000-000000000001', true, 'eu mesmo aceito');
  RAISE EXCEPTION 'FALHOU: o próprio autor decidiu a revisão';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  o autor não decide a própria revisão';
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.decidir_revisao_sincronizacao('b0000000-0000-4000-8000-000000000001', true, 'ok');
    RAISE EXCEPTION 'FALHOU: decisão sem motivo aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  decisão exige motivo';
  END;
  PERFORM public.decidir_revisao_sincronizacao('b0000000-0000-4000-8000-000000000001', true, 'Conferido com a folha de enfermagem do plantão');
  PERFORM public.decidir_revisao_sincronizacao('b0000000-0000-4000-8000-000000000002', false, 'Duplicado: já lançado à mão no dia');
  BEGIN
    PERFORM public.decidir_revisao_sincronizacao('b0000000-0000-4000-8000-000000000002', true, 'mudei de ideia agora');
    RAISE EXCEPTION 'FALHOU: revisão decidida duas vezes';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  a decisão é única';
  END;
END $$;

RESET ROLE;

DO $$
DECLARE o public.observacao; st text;
BEGIN
  SELECT string_agg(e ->> 'status', ',' ORDER BY e ->> 'id') INTO st FROM r, jsonb_array_elements(saida) e WHERE caso = 'tardio';
  IF st <> 'em_revisao,em_revisao' THEN RAISE EXCEPTION 'FALHOU: tardios deveriam ir para revisão, veio %', st; END IF;
  RAISE NOTICE 'OK  chegou mais de 24 h depois: vai para revisão, não entra sozinho';

  IF (SELECT saida -> 0 ->> 'motivo' FROM r WHERE caso = 'fora') NOT LIKE 'SYNC_FORA_DO_PLANTAO%' THEN
    RAISE EXCEPTION 'FALHOU: tardio fora do plantão deveria ser recusado';
  END IF;
  RAISE NOTICE 'OK  tardio continua passando pelas regras (fora do plantão é recusado)';

  IF (SELECT saida -> 0 ->> 'status' FROM r WHERE caso = 'reenvio') <> 'em_revisao'
     OR (SELECT count(*) FROM public.sincronizacao_revisao WHERE id = 'b0000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: reenvio do tardio duplicou';
  END IF;
  RAISE NOTICE 'OK  reenvio do tardio não duplica (em_revisao)';

  SELECT * INTO o FROM public.observacao WHERE id = 'b0000000-0000-4000-8000-000000000001';
  IF NOT FOUND OR o.registrado_por <> '10000000-0000-4000-8000-000000000002' OR NOT o.sem_conexao
     OR o.aferido_em > now() - interval '25 hours' THEN
    RAISE EXCEPTION 'FALHOU: aceito deveria entrar com autor e hora do fato';
  END IF;
  IF EXISTS (SELECT 1 FROM public.observacao WHERE id = 'b0000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'FALHOU: descartado entrou no prontuário';
  END IF;
  IF (SELECT decidido_por FROM public.sincronizacao_revisao WHERE id = 'b0000000-0000-4000-8000-000000000002')
     <> '10000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'FALHOU: decisão sem autor';
  END IF;
  RAISE NOTICE 'OK  aceito entra com autor e hora do fato; descartado fica só na revisão, com quem decidiu';
END $$;

ROLLBACK;
