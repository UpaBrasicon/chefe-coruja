-- Testes da migration 20260926000009_fase1_segundo_fator.sql
-- Banco local com o seed (plantonista escalado agora na Clínica Médica, onde
-- há pacientes). Transação com ROLLBACK.
BEGIN;

CREATE FUNCTION pg_temp.sessao(aal text, minutos_desde_totp int) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', '10000000-0000-4000-8000-000000000002', 'role', 'authenticated', 'aal', aal,
    'amr', CASE WHEN minutos_desde_totp IS NULL
                THEN json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch FROM now())::bigint))
                ELSE json_build_array(
                  json_build_object('method', 'password', 'timestamp', extract(epoch FROM now())::bigint),
                  json_build_object('method', 'totp', 'timestamp', extract(epoch FROM now() - make_interval(mins => minutos_desde_totp))::bigint))
           END)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.sessao(text, int) TO authenticated;

CREATE FUNCTION pg_temp.pacientes_visiveis() RETURNS int LANGUAGE sql AS $$ SELECT count(*)::int FROM public.pacientes $$;
GRANT EXECUTE ON FUNCTION pg_temp.pacientes_visiveis() TO authenticated;

-- 1. Chave desligada: nada muda.
SET LOCAL ROLE authenticated;
SELECT pg_temp.sessao('aal1', NULL);
DO $$ BEGIN
  IF pg_temp.pacientes_visiveis() = 0 THEN RAISE EXCEPTION 'FALHOU: com a chave desligada o plantonista deveria ver os pacientes'; END IF;
  RAISE NOTICE 'OK  chave desligada: sessão aal1 segue vendo os pacientes (%)', pg_temp.pacientes_visiveis();
END $$;
RESET ROLE;

-- 2. Chave ligada.
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;

SELECT pg_temp.sessao('aal1', NULL);
DO $$ BEGIN
  IF pg_temp.pacientes_visiveis() <> 0 THEN RAISE EXCEPTION 'FALHOU: sessão sem segundo fator viu pacientes'; END IF;
  RAISE NOTICE 'OK  sessão só com senha (aparelho novo ou login novo) não vê pacientes';
END $$;

SELECT pg_temp.sessao('aal2', 30);
DO $$ BEGIN
  IF pg_temp.pacientes_visiveis() = 0 THEN RAISE EXCEPTION 'FALHOU: código confirmado há 30 min deveria liberar'; END IF;
  RAISE NOTICE 'OK  código confirmado há 30 min libera';
END $$;

SELECT pg_temp.sessao('aal2', 25 * 60);
DO $$ BEGIN
  IF pg_temp.pacientes_visiveis() <> 0 THEN RAISE EXCEPTION 'FALHOU: código de 25 h atrás ainda liberou'; END IF;
  IF (SELECT valido FROM public.segundo_fator_status()) THEN RAISE EXCEPTION 'FALHOU: status deveria dizer inválido'; END IF;
  RAISE NOTICE 'OK  passadas 24 h, o código é pedido de novo';
END $$;

DO $$ BEGIN
  PERFORM private.exigir_segundo_fator();
  RAISE EXCEPTION 'FALHOU: exigir_segundo_fator deveria recusar';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  exigir_segundo_fator recusa para as RPCs';
END $$;

RESET ROLE;
ROLLBACK;

-- 3. RPC clínica com a chave ligada e sessão sem segundo fator é recusada.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
DO $$ BEGIN
  PERFORM public.dar_alta_internado('23000000-0000-4000-8000-000000000001', 'alta_melhorada');
  RAISE EXCEPTION 'FALHOU: alta sem segundo fator foi aceita';
EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM NOT LIKE 'SEGUNDO_FATOR:%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  RPC clínica recusa sessão sem segundo fator';
END $$;
RESET ROLE;
ROLLBACK;
