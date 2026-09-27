-- Testes da migration 20260926000012_fase1_consulta_impressao_servidor.sql
-- Banco local com o seed, transação com ROLLBACK:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase1_consulta_impressao.sql
BEGIN;

DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

-- aberturas reais feitas no banco local não podem contaminar o teste
ALTER TABLE public.log_acesso_prontuario DISABLE TRIGGER trg_acesso_so_insercao;
DELETE FROM public.log_acesso_prontuario WHERE acessado_por = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.log_acesso_prontuario ENABLE TRIGGER trg_acesso_so_insercao;

-- uma prescrição do plantonista para o paciente Um (Clínica Médica)
INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status)
VALUES ('21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002', 'ativa');

CREATE TEMP TABLE protocolo (p text) ON COMMIT DROP;
GRANT ALL ON protocolo TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"200.1.2.3, 10.0.0.1","user-agent":"Teste/1.0"}', true);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.prescricoes WHERE paciente_id = '23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: prescrição lida sem abrir o prontuário';
  END IF;
  RAISE NOTICE 'OK  sem abrir o prontuário, o conteúdo clínico não aparece';

  PERFORM public.abrir_prontuario('23000000-0000-4000-8000-000000000001');
  IF NOT EXISTS (SELECT 1 FROM public.prescricoes WHERE paciente_id = '23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: prontuário aberto e a prescrição não aparece';
  END IF;
  RAISE NOTICE 'OK  aberto o prontuário, o conteúdo aparece';

  PERFORM public.abrir_prontuario('23000000-0000-4000-8000-000000000001');  -- conferido no fim

  BEGIN
    PERFORM public.abrir_prontuario('23000000-0000-4000-8000-000000000004');
    RAISE EXCEPTION 'FALHOU: abriu prontuário de paciente de outro setor';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  prontuário de outro setor não abre';
  END;
END $$;

DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.registrar_impressao('23000000-0000-4000-8000-000000000001', 'Receituário');
  INSERT INTO protocolo VALUES (r.protocolo);

  BEGIN
    PERFORM public.registrar_impressao('23000000-0000-4000-8000-000000000004', 'Atestado');
    RAISE EXCEPTION 'FALHOU: imprimiu documento de paciente de outro setor';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  impressão de outro setor recusada';
  END;

  BEGIN
    PERFORM public.registrar_acesso_prontuario('23000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'impressao');
    RAISE EXCEPTION 'FALHOU: o registro antigo, a pedido do app, ainda roda';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK  registro antigo sem execução pelo app';
  END;

END $$;

RESET ROLE;

-- conferências do log como superusuário (o plantonista não lê o log)
DO $$
DECLARE l public.log_acesso_prontuario; v text := (SELECT p FROM protocolo);
BEGIN
  IF (SELECT count(*) FROM public.log_acesso_prontuario
      WHERE paciente_id = '23000000-0000-4000-8000-000000000001' AND tipo_acesso = 'leitura_prontuario') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: abertura repetida em 5 minutos duplicou o registro';
  END IF;
  RAISE NOTICE 'OK  abrir de novo em 5 minutos não duplica';
  SELECT * INTO l FROM public.log_acesso_prontuario WHERE tipo_acesso = 'impressao';
  IF v !~ '^IMP-[0-9A-F]{10}$' OR l.documento_tipo <> 'Receituário'
     OR 'IMP-' || upper(left(replace(l.id::text, '-', ''), 10)) <> v THEN
    RAISE EXCEPTION 'FALHOU: impressão sem protocolo ou sem tipo (%, %)', v, l.documento_tipo;
  END IF;
  IF l.ip <> '200.1.2.3'::inet OR l.user_agent <> 'Teste/1.0' THEN
    RAISE EXCEPTION 'FALHOU: IP/navegador não vieram da requisição (%, %)', l.ip, l.user_agent;
  END IF;
  RAISE NOTICE 'OK  impressão registrada com protocolo %, IP e navegador lidos no servidor', v;
  BEGIN
    UPDATE public.log_acesso_prontuario SET tipo_acesso = 'exportacao' WHERE id = l.id;
    RAISE EXCEPTION 'FALHOU: log de acesso foi alterado até pelo superusuário';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  log de acesso não se altera';
  END;
END $$;

ROLLBACK;
