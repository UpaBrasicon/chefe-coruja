-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20260926000006_fase1_auditoria_so_insercao.sql
-- Banco local apenas. Transação com ROLLBACK.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- 1. Payload: lista fechada, escalares, aninhado vira nomes de campo.
DO $$
DECLARE v jsonb;
BEGIN
  v := private.payload_auditoria('setores',
    '{"nome":"Clínica","tipo":"internacao","campos":{"nome":"X","limite":10},"cpf":"52998224725","paciente_nome":"Fulano"}');
  IF v <> '{"nome":"Clínica","tipo":"internacao","campos_alterados":["limite","nome"]}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: payload filtrado veio %', v;
  END IF;
  IF private.payload_auditoria('pacientes', '{"nome":"Fulano de Tal"}') <> '{}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: nome de pessoa não pode entrar na trilha';
  END IF;
  RAISE NOTICE 'OK  payload só leva chaves permitidas; nome de pessoa e documento saem';
END $$;

-- 2. Inserção: hora do servidor, elo da cadeia.
INSERT INTO public.log_auditoria (acao, entidade, created_at) VALUES ('teste_a', 'setores', '2000-01-01');
INSERT INTO public.log_auditoria (acao, entidade) VALUES ('teste_b', 'setores');
DO $$
DECLARE a public.log_auditoria%ROWTYPE; b public.log_auditoria%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.log_auditoria WHERE acao = 'teste_a';
  SELECT * INTO b FROM public.log_auditoria WHERE acao = 'teste_b';
  IF a.created_at < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'FALHOU: created_at do cliente foi aceito (%)', a.created_at;
  END IF;
  IF b.hash_anterior IS DISTINCT FROM a.hash OR b.hash IS NULL THEN
    RAISE EXCEPTION 'FALHOU: a linha b não aponta para o hash da linha a';
  END IF;
  IF private.verificar_cadeia_auditoria() IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: cadeia íntegra acusada como quebrada em %', private.verificar_cadeia_auditoria();
  END IF;
  RAISE NOTICE 'OK  hora do servidor e cadeia íntegra';
END $$;

-- 3. Só inserção.
DO $$ BEGIN
  UPDATE public.log_auditoria SET acao = 'adulterado' WHERE acao = 'teste_a';
  RAISE EXCEPTION 'FALHOU: UPDATE no log foi aceito';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  UPDATE recusado';
END $$;
DO $$ BEGIN
  DELETE FROM public.log_auditoria WHERE acao = 'teste_a';
  RAISE EXCEPTION 'FALHOU: DELETE no log foi aceito';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  DELETE recusado';
END $$;
-- log de acesso ao prontuário (usa a unidade e o paciente do seed local)
INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, acessado_por, tipo_acesso)
VALUES ('20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
        '23000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'leitura_prontuario');
DO $$ BEGIN
  DELETE FROM public.log_acesso_prontuario WHERE acessado_por = '10000000-0000-4000-8000-000000000002';
  RAISE EXCEPTION 'FALHOU: DELETE no log de acesso ao prontuário foi aceito';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  log de acesso ao prontuário também é só-inserção';
END $$;

-- 4. Adulteração por quem desliga a trava (superusuário): a cadeia acusa.
ALTER TABLE public.log_auditoria DISABLE TRIGGER trg_auditoria_so_insercao;
UPDATE public.log_auditoria SET payload = '{"tipo":"forjado"}' WHERE acao = 'teste_a';
ALTER TABLE public.log_auditoria ENABLE TRIGGER trg_auditoria_so_insercao;
DO $$
DECLARE quebra bigint := private.verificar_cadeia_auditoria();
BEGIN
  IF quebra IS DISTINCT FROM (SELECT seq FROM public.log_auditoria WHERE acao = 'teste_a') THEN
    RAISE EXCEPTION 'FALHOU: adulteração não foi localizada (veio %)', quebra;
  END IF;
  RAISE NOTICE 'OK  adulteração localizada na linha %', quebra;
END $$;

ROLLBACK;
