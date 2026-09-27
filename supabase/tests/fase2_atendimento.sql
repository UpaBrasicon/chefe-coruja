-- Testes da migration 20260927000004_fase2_atendimento_desfecho.sql
-- Banco local com o seed e a carga do protocolo. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase2_atendimento.sql
BEGIN;

-- enfermeira (…0004), recepção (…0005) e médico (…0002) de plantão AGORA no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

SET LOCAL ROLE authenticated;
-- três pacientes: A (alta), B (óbito), C (evasão antes do médico)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'a', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL, '{"nome":"Atendimento A Teste","data_nascimento":"1970-01-01"}') ->> 'episodio_id';
INSERT INTO t SELECT 'b', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL, '{"nome":"Atendimento B Teste","data_nascimento":"1950-01-01"}') ->> 'episodio_id';
INSERT INTO t SELECT 'c', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL, '{"nome":"Atendimento C Teste","data_nascimento":"1985-01-01"}') ->> 'episodio_id';

SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$
DECLARE s jsonb := '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}';
BEGIN
  PERFORM public.classificar_risco(pg_temp.v(x), 'amarelo', s, pg_temp.v('flx'), 'Edema de face') FROM unnest(ARRAY['a', 'b', 'c']) x;
  BEGIN
    PERFORM public.iniciar_atendimento(pg_temp.v('a'));
    RAISE EXCEPTION 'FALHOU: enfermeira abriu atendimento médico';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'O atendimento é do médico%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  atendimento é do médico';
  END;
END $$;

SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  BEGIN
    PERFORM public.registrar_soap(pg_temp.v('a'), 'dor', NULL, NULL, NULL);
    RAISE EXCEPTION 'FALHOU: SOAP sem abrir o atendimento';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Abra o atendimento%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  SOAP só depois de abrir o atendimento';
  END;
  PERFORM public.iniciar_atendimento(pg_temp.v('a'));
  PERFORM public.iniciar_atendimento(pg_temp.v('b'));
  BEGIN
    PERFORM public.registrar_desfecho(pg_temp.v('a'), 'alta');
    RAISE EXCEPTION 'FALHOU: alta sem SOAP';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Registre o atendimento%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  desfecho exige SOAP';
  END;
  BEGIN
    PERFORM public.registrar_soap(pg_temp.v('a'), 'edema', 'estável', 'angioedema leve', 'anti-histamínico', 'T78.3X');
    RAISE EXCEPTION 'FALHOU: CID inválido aceito';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK  CID com formato inválido é recusado';
  END;
  PERFORM public.registrar_soap(pg_temp.v('a'), 'Edema labial há 2 h', 'Sem estridor, SpO2 98%', 'Angioedema leve', 'Anti-histamínico e observação da resposta', 'T78.3');
  PERFORM public.registrar_soap(pg_temp.v('a'), NULL, 'Reavaliado: edema regrediu', NULL, 'Alta com orientações');
  PERFORM public.registrar_desfecho(pg_temp.v('a'), 'alta');

  PERFORM public.registrar_soap(pg_temp.v('b'), 'Rebaixamento', 'PCR em AESP', 'PCR', 'RCP conforme protocolo');
  BEGIN
    PERFORM public.registrar_desfecho(pg_temp.v('b'), 'transferencia', NULL, '{}');
    RAISE EXCEPTION 'FALHOU: transferência sem destino';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Informe o destino%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  transferência exige destino';
  END;
  BEGIN
    PERFORM public.registrar_desfecho(pg_temp.v('b'), 'obito', 'PCR refratária após 40 minutos de RCP', jsonb_build_object('hora_obito', now() - interval '5 minutes'));
    RAISE EXCEPTION 'FALHOU: óbito sem número da DO';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%Declaração de Óbito%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  óbito exige hora e número da Declaração de Óbito';
  END;
  PERFORM public.registrar_desfecho(pg_temp.v('b'), 'obito', 'PCR refratária após 40 minutos de RCP',
    jsonb_build_object('hora_obito', now() - interval '5 minutes', 'numero_do', '123456789'));
END $$;

-- depois de o médico abrir, a recepção não "retira da fila"
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.v('c'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  PERFORM public.retirar_da_fila(pg_temp.v('c'), 'evasao', 'paciente saiu sem avisar ninguém');
  RAISE EXCEPTION 'FALHOU: retirou da fila com atendimento aberto';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Atendimento já aberto%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  com atendimento aberto, saída é desfecho do médico';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.v('c'), 'evasao', 'Chamado no consultório, não retornou do raio-x');

RESET ROLE;
DO $$
DECLARE a public.episodios; b public.episodios; c public.episodios;
BEGIN
  SELECT * INTO a FROM public.episodios WHERE id = pg_temp.v('a');
  SELECT * INTO b FROM public.episodios WHERE id = pg_temp.v('b');
  SELECT * INTO c FROM public.episodios WHERE id = pg_temp.v('c');
  IF a.etapa <> 'encerrado' OR a.desfecho <> 'alta' OR a.atendimento_medico_id <> '10000000-0000-4000-8000-000000000002'
     OR a.desfecho_por <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: alta (%, %)', a.etapa, a.desfecho;
  END IF;
  IF (SELECT count(*) FROM public.atendimento_registros WHERE episodio_id = a.id) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: os dois SOAP deveriam ficar';
  END IF;
  RAISE NOTICE 'OK  alta encerra; os dois SOAP ficam, com autor';
  IF b.desfecho <> 'obito' OR b.desfecho_detalhes ->> 'numero_do' <> '123456789' THEN RAISE EXCEPTION 'FALHOU: óbito'; END IF;
  IF c.desfecho <> 'evasao' OR c.etapa <> 'encerrado' THEN RAISE EXCEPTION 'FALHOU: evasão'; END IF;
  RAISE NOTICE 'OK  óbito e evasão encerram com relato e detalhes';
  BEGIN
    UPDATE public.atendimento_registros SET plano = 'x' WHERE episodio_id = a.id;
    RAISE EXCEPTION 'FALHOU: SOAP alterado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  SOAP não se altera';
  END;
END $$;

-- observação e internação seguem para a Fase 3 (episódio não encerra)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'd', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dispneia', NULL, '{"nome":"Atendimento D Teste","data_nascimento":"1960-01-01"}') ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.v('d'), 'laranja', '{"frequencia-cardiaca":110,"frequencia-respiratoria":26,"temperatura":37,"saturacao-o2":90,"escala-dor":3,"pressao-arterial-sistolica":140,"pressao-arterial-diastolica":90}', pg_temp.v('flx'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.v('d'));
SELECT public.registrar_soap(pg_temp.v('d'), 'Dispneia', 'SpO2 90%', 'Insuficiência respiratória', 'Observação com O2');
SELECT public.registrar_desfecho(pg_temp.v('d'), 'observacao');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT etapa FROM public.episodios WHERE id = pg_temp.v('d')) <> 'observacao'
     OR (SELECT encerrado_em FROM public.episodios WHERE id = pg_temp.v('d')) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: observação deveria manter o episódio aberto';
  END IF;
  RAISE NOTICE 'OK  observação mantém o episódio aberto, para a Fase 3';
END $$;

ROLLBACK;
