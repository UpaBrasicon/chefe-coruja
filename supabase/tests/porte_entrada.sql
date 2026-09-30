-- Testes da migration 20261003000005_entrada.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_entrada.sql
--
-- Usa o plantonista do seed (…0002). O hook é chamado como o Auth chamaria
-- (papel supabase_auth_admin); a leitura da tela, como o próprio usuário.
-- Transação com ROLLBACK.
BEGIN;

DELETE FROM private.segundo_fator_tentativas WHERE user_id = '10000000-0000-4000-8000-000000000002';

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated', 'aal', 'aal1')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;

-- O Auth chama o hook como supabase_auth_admin; aqui o postgres não pode
-- assumir esse papel, então a permissão é conferida à parte (seção 4).
CREATE FUNCTION pg_temp.tentar(valido boolean) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  r := public.hook_segundo_fator_tentativa(json_build_object(
    'factor_id', '00000000-0000-4000-8000-00000000f000', 'factor_type', 'totp',
    'user_id', '10000000-0000-4000-8000-000000000002', 'valid', valido)::jsonb);
  RETURN r ->> 'decision';
END $$;

CREATE FUNCTION pg_temp.restantes() RETURNS int LANGUAGE plpgsql AS $$
DECLARE v int;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.como('10000000-0000-4000-8000-000000000002');
  SELECT restantes INTO v FROM public.segundo_fator_tentativas();
  RESET ROLE;
  RETURN v;
END $$;

-- ── 1. Contagem e bloqueio ──────────────────────────────────────────────────
DO $$ BEGIN
  IF pg_temp.restantes() <> 3 THEN RAISE EXCEPTION 'FALHOU: sem erro deveriam restar 3 tentativas'; END IF;

  IF pg_temp.tentar(false) <> 'continue' THEN RAISE EXCEPTION 'FALHOU: 1º erro não deveria bloquear'; END IF;
  IF pg_temp.restantes() <> 2 THEN RAISE EXCEPTION 'FALHOU: depois de 1 erro deveriam restar 2'; END IF;

  IF pg_temp.tentar(false) <> 'continue' THEN RAISE EXCEPTION 'FALHOU: 2º erro não deveria bloquear'; END IF;
  IF pg_temp.restantes() <> 1 THEN RAISE EXCEPTION 'FALHOU: depois de 2 erros deveria restar 1'; END IF;
  RAISE NOTICE 'OK  cada código errado desconta uma tentativa (3 → 2 → 1)';

  PERFORM pg_temp.tentar(false);
  IF pg_temp.restantes() <> 0 THEN RAISE EXCEPTION 'FALHOU: 3º erro deveria bloquear'; END IF;
  IF (SELECT bloqueado_ate FROM private.segundo_fator_tentativas WHERE user_id = '10000000-0000-4000-8000-000000000002')
     NOT BETWEEN now() + interval '14 minutes' AND now() + interval '16 minutes' THEN
    RAISE EXCEPTION 'FALHOU: bloqueio deveria durar 15 min';
  END IF;
  RAISE NOTICE 'OK  três erros bloqueiam o segundo fator por 15 min';

  IF pg_temp.tentar(true) <> 'reject' THEN RAISE EXCEPTION 'FALHOU: código certo passou durante o bloqueio'; END IF;
  RAISE NOTICE 'OK  durante o bloqueio nem o código certo passa (reject)';
END $$;

-- ── 2. Fim do bloqueio: recomeça do zero; código certo zera ─────────────────
UPDATE private.segundo_fator_tentativas SET bloqueado_ate = now() - interval '1 second'
WHERE user_id = '10000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  IF pg_temp.restantes() <> 3 THEN RAISE EXCEPTION 'FALHOU: bloqueio vencido deveria devolver as 3 tentativas'; END IF;
  PERFORM pg_temp.tentar(false);
  IF pg_temp.restantes() <> 2 THEN RAISE EXCEPTION 'FALHOU: erro depois do bloqueio deveria contar do zero'; END IF;
  IF pg_temp.tentar(true) <> 'continue' THEN RAISE EXCEPTION 'FALHOU: código certo fora do bloqueio foi recusado'; END IF;
  IF EXISTS (SELECT 1 FROM private.segundo_fator_tentativas WHERE user_id = '10000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'FALHOU: código certo deveria zerar a contagem';
  END IF;
  RAISE NOTICE 'OK  bloqueio vencido recomeça do zero; código certo zera a contagem';
END $$;

-- ── 3. Erros espaçados além da janela não se somam ──────────────────────────
DO $$ BEGIN
  PERFORM pg_temp.tentar(false);
  PERFORM pg_temp.tentar(false);
  UPDATE private.segundo_fator_tentativas SET ultima_falha = now() - interval '20 minutes'
  WHERE user_id = '10000000-0000-4000-8000-000000000002';
  IF pg_temp.restantes() <> 3 THEN RAISE EXCEPTION 'FALHOU: erros de 20 min atrás ainda contam'; END IF;
  PERFORM pg_temp.tentar(false);
  IF pg_temp.restantes() <> 2 THEN RAISE EXCEPTION 'FALHOU: erro novo depois da janela deveria ser o 1º'; END IF;
  RAISE NOTICE 'OK  erros com mais de 15 min não se somam aos novos';
END $$;

-- ── 4. Permissões: o hook só para o Auth; a tabela não é legível ──────────
DO $$ BEGIN
  IF NOT has_function_privilege('supabase_auth_admin', 'public.hook_segundo_fator_tentativa(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: o Auth (supabase_auth_admin) não consegue chamar o hook';
  END IF;
  IF has_function_privilege('anon', 'public.hook_segundo_fator_tentativa(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon consegue chamar o hook';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  BEGIN
    PERFORM public.hook_segundo_fator_tentativa('{"user_id":"10000000-0000-4000-8000-000000000002","valid":true}'::jsonb);
    RAISE EXCEPTION 'FALHOU: usuário comum chamou o hook (poderia zerar o próprio bloqueio)';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM private.segundo_fator_tentativas;
    RAISE EXCEPTION 'FALHOU: usuário comum leu a tabela de tentativas';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  hook e tabela fora do alcance do app';
END $$;
RESET ROLE;

-- ── 5. Próximo plantão ──────────────────────────────────────────────────────
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, ativo) VALUES
  -- já começou: não é "próximo"
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual(), private.turno_atual(), now() - interval '1 hour', 360, true),
  -- inativo (desistência): não conta
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual() + 1, 'manha', now() + interval '2 hours', 360, false),
  -- este é o próximo
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual() + 2, 'manha', now() + interval '2 days', 720, true),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual() + 3, 'manha', now() + interval '3 days', 720, true);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- ids do plantonista, guardados fora da RLS para a checagem da seção seguinte
CREATE TEMP TABLE escala_do_plantonista ON COMMIT DROP AS
  SELECT id FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
GRANT SELECT ON escala_do_plantonista TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.meu_proximo_plantao();
  IF r.escala_id IS NULL THEN RAISE EXCEPTION 'FALHOU: próximo plantão não encontrado'; END IF;
  IF r.inicio < now() + interval '47 hours' OR r.inicio > now() + interval '49 hours' THEN
    RAISE EXCEPTION 'FALHOU: próximo plantão deveria ser o de daqui a 2 dias (veio %)', r.inicio;
  END IF;
  IF r.fim - r.inicio <> interval '12 hours' THEN RAISE EXCEPTION 'FALHOU: fim deveria ser início + duração'; END IF;
  IF r.setor_nome IS NULL OR r.unidade_nome IS NULL THEN RAISE EXCEPTION 'FALHOU: setor e unidade deveriam vir com nome'; END IF;
  RAISE NOTICE 'OK  próximo plantão: ignora o em curso e o inativo (% · %)', r.setor_nome, r.unidade_nome;
END $$;

-- outro usuário não vê o plantão deste
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.meu_proximo_plantao() WHERE escala_id IN (SELECT id FROM escala_do_plantonista)) THEN
    RAISE EXCEPTION 'FALHOU: outro usuário viu o próximo plantão do plantonista';
  END IF;
  RAISE NOTICE 'OK  cada um vê só o próprio próximo plantão';
END $$;
RESET ROLE;

ROLLBACK;
