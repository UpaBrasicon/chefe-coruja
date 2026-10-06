-- Fase 0, tarefa 1 do BACKLOG.md — migration 20261023000001_segundo_fator_servidor.sql.
-- Portão antes de toda requisição, Storage, códigos de recuperação, reset pelo
-- gestor/super admin e registro de eventos. Banco local com o seed (gestor 01,
-- plantonista 02, admin 03, enfermeiro 04, mesma unidade). Transação com ROLLBACK.
BEGIN;

-- Sessão simulada: usuário, aal e sessão; o caminho/método da API vêm do PostgREST.
CREATE FUNCTION pg_temp.como(p_user text, p_aal text, p_sessao text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated', 'aal', p_aal, 'session_id', p_sessao,
    'amr', json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch FROM now())::bigint)))::text, true);
END $$;
CREATE FUNCTION pg_temp.api(p_caminho text, p_metodo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.path', p_caminho, true);
  PERFORM set_config('request.method', p_metodo, true);
END $$;
-- true se o portão deixa passar
CREATE FUNCTION pg_temp.passa() RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.portao_requisicao();
  RETURN true;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text, text, text), pg_temp.api(text, text), pg_temp.passa() TO authenticated;

-- 0. Configuração do PostgREST aponta para o portão.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
                  WHERE r.rolname = 'authenticator' AND 'pgrst.db_pre_request=public.portao_requisicao' = ANY (s.setconfig)) THEN
    RAISE EXCEPTION 'FALHOU: authenticator sem pgrst.db_pre_request = public.portao_requisicao';
  END IF;
  RAISE NOTICE 'OK  PostgREST chama public.portao_requisicao antes de toda requisição';
END $$;

-- 1. Chave desligada: o portão não barra nada.
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', 'aal1', '00000000-0000-4000-8000-0000000000a1');
SELECT pg_temp.api('/rpc/abrir_prontuario', 'POST');
DO $$ BEGIN
  IF NOT pg_temp.passa() THEN RAISE EXCEPTION 'FALHOU: com a chave desligada o portão barrou'; END IF;
  RAISE NOTICE 'OK  chave desligada: nada muda';
END $$;
RESET ROLE;

-- 2. Chave ligada, sessão só com senha.
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', 'aal1', '00000000-0000-4000-8000-0000000000a1');
DO $$
DECLARE c text;
BEGIN
  -- RPCs que passavam por cima da RLS sem pedir 2FA (amostra do diagnóstico)
  FOREACH c IN ARRAY ARRAY['abrir_prontuario', 'admissao_ficha', 'painel_atendimento_ps', 'mapa_leitos_gestor',
                           'gerar_convite', 'gerar_codigos_recuperacao', 'uma_rpc_que_ainda_nao_existe'] LOOP
    PERFORM pg_temp.api('/rpc/' || c, 'POST');
    IF pg_temp.passa() THEN RAISE EXCEPTION 'FALHOU: sem 2FA a RPC % passou', c; END IF;
  END LOOP;
  PERFORM pg_temp.api('/rpc/abrir_prontuario', 'GET');
  IF pg_temp.passa() THEN RAISE EXCEPTION 'FALHOU: RPC por GET passou sem 2FA'; END IF;
  RAISE NOTICE 'OK  sem 2FA: RPC barrada (inclusive as que pulavam a RLS e as futuras)';

  FOREACH c IN ARRAY ARRAY['POST', 'PATCH', 'DELETE', 'PUT'] LOOP
    PERFORM pg_temp.api('/vinculos', c);
    IF pg_temp.passa() THEN RAISE EXCEPTION 'FALHOU: sem 2FA a gravação % em tabela passou', c; END IF;
  END LOOP;
  RAISE NOTICE 'OK  sem 2FA: nenhuma gravação em tabela';

  PERFORM pg_temp.api('/vinculos', 'GET');
  IF NOT pg_temp.passa() THEN RAISE EXCEPTION 'FALHOU: leitura de tabela barrada (a casca precisa ler perfil e vínculos)'; END IF;
  RAISE NOTICE 'OK  sem 2FA: leitura de tabela segue para a RLS';

  FOREACH c IN ARRAY ARRAY['segundo_fator_status', 'segundo_fator_tentativas', 'verificar_codigo_2fa',
                           'verificar_dispositivo_2fa', 'herdar_segundo_fator', 'usar_codigo_recuperacao',
                           'conferir_convite', 'aceitar_convite', 'horario_servidor', 'data_atual',
                           'registrar_erro_cliente'] LOOP
    PERFORM pg_temp.api('/rpc/' || c, 'POST');
    IF NOT pg_temp.passa() THEN RAISE EXCEPTION 'FALHOU: a RPC % do fluxo de confirmação foi barrada', c; END IF;
  END LOOP;
  RAISE NOTICE 'OK  sem 2FA: só o fluxo de confirmação passa';
END $$;

-- anon (painel da TV) e service_role não passam pelo portão
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.api('/rpc/painel_chamadas', 'POST');
DO $$ BEGIN
  IF NOT pg_temp.passa() THEN RAISE EXCEPTION 'FALHOU: portão barrou o anon'; END IF;
  RAISE NOTICE 'OK  anon fora do portão (as RPCs dele têm controle próprio)';
END $$;
RESET ROLE;

-- 3. Storage: sem 2FA, nenhum arquivo.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                  AND policyname = 'storage_segundo_fator' AND permissive = 'RESTRICTIVE' AND cmd = 'ALL'
                  AND qual LIKE '%segundo_fator_ok%' AND with_check LIKE '%segundo_fator_ok%') THEN
    RAISE EXCEPTION 'FALHOU: storage.objects sem policy restritiva de 2FA';
  END IF;
  RAISE NOTICE 'OK  Storage: policy restritiva de 2FA em leitura e gravação';
END $$;
INSERT INTO storage.objects (bucket_id, name) VALUES ('atendimento', '21000000-0000-4000-8000-000000000001/teste-2fa.txt');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001', 'aal1', '00000000-0000-4000-8000-0000000000b1');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE name LIKE '%teste-2fa.txt') THEN
    RAISE EXCEPTION 'FALHOU: gestor sem 2FA viu arquivo do bucket atendimento';
  END IF;
  RAISE NOTICE 'OK  Storage: gestor sem 2FA não vê o arquivo';
END $$;
RESET ROLE;
-- com 2FA (sessão confirmada por email) o mesmo gestor vê
INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id) VALUES ('00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001', 'aal1', '00000000-0000-4000-8000-0000000000b1');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE name LIKE '%teste-2fa.txt') THEN
    RAISE EXCEPTION 'FALHOU: gestor com 2FA não viu o arquivo';
  END IF;
  PERFORM pg_temp.api('/rpc/abrir_prontuario', 'POST');
  IF NOT pg_temp.passa() THEN RAISE EXCEPTION 'FALHOU: com 2FA válido o portão barrou'; END IF;
  RAISE NOTICE 'OK  com 2FA: Storage e RPC liberados';
END $$;

-- 4. Códigos de recuperação (plantonista confirma por email, gera, perde o celular, usa).
RESET ROLE;
INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id) VALUES ('00000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-000000000002');
CREATE TEMP TABLE codigos (c text[]);
GRANT ALL ON codigos TO authenticated;
SET LOCAL ROLE authenticated;

SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', 'aal1', '00000000-0000-4000-8000-0000000000a1');
DO $$ BEGIN
  PERFORM public.gerar_codigos_recuperacao();
  RAISE EXCEPTION 'FALHOU: gerou códigos sem 2FA';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  sem 2FA não gera códigos';
END $$;

SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', 'aal1', '00000000-0000-4000-8000-0000000000a2');
INSERT INTO pg_temp.codigos SELECT public.gerar_codigos_recuperacao();
DO $$
DECLARE v text[] := (SELECT c FROM pg_temp.codigos);
BEGIN
  IF cardinality(v) <> 10 THEN RAISE EXCEPTION 'FALHOU: % códigos (esperado 10)', cardinality(v); END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(v) x) <> 10 THEN RAISE EXCEPTION 'FALHOU: códigos repetidos'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v) x WHERE x !~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$') THEN
    RAISE EXCEPTION 'FALHOU: formato de código inesperado: %', v;
  END IF;
  IF (SELECT restantes FROM public.codigos_recuperacao_status()) <> 10 THEN RAISE EXCEPTION 'FALHOU: status não mostra 10'; END IF;
  RAISE NOTICE 'OK  10 códigos distintos, formato XXXX-XXXX';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM private.segundo_fator_recuperacao r, pg_temp.codigos c
              WHERE r.codigo_hash = ANY (c.c) OR r.codigo_hash LIKE '%-%') THEN
    RAISE EXCEPTION 'FALHOU: código guardado em claro';
  END IF;
  RAISE NOTICE 'OK  banco guarda só o hash';
END $$;
SET LOCAL ROLE authenticated;

-- sessão nova (outro aparelho), sem 2FA: usa um código
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', 'aal1', '00000000-0000-4000-8000-0000000000a3');
DO $$
DECLARE v text[] := (SELECT c FROM pg_temp.codigos); r jsonb;
BEGIN
  IF (SELECT valido FROM public.segundo_fator_status()) THEN RAISE EXCEPTION 'FALHOU: sessão nova já nasceu válida'; END IF;
  r := public.usar_codigo_recuperacao(lower(replace(v[1], '-', ' ')));   -- digitado em minúscula e com espaço
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FALHOU: código certo recusado: %', r; END IF;
  IF (r->>'codigos_restantes')::int <> 9 THEN RAISE EXCEPTION 'FALHOU: restantes % (esperado 9)', r; END IF;
  IF NOT (SELECT valido FROM public.segundo_fator_status()) THEN RAISE EXCEPTION 'FALHOU: código usado não liberou a sessão'; END IF;
  RAISE NOTICE 'OK  código de recuperação libera a sessão (aceita minúscula e espaço)';
END $$;

-- o mesmo código numa terceira sessão: não vale mais
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', 'aal1', '00000000-0000-4000-8000-0000000000a4');
DO $$
DECLARE v text[] := (SELECT c FROM pg_temp.codigos); r jsonb;
BEGIN
  r := public.usar_codigo_recuperacao(v[1]);
  IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'FALHOU: código reutilizado'; END IF;
  IF r->>'motivo' <> 'invalido' OR (r->>'restantes')::int <> 4 THEN RAISE EXCEPTION 'FALHOU: resposta inesperada %', r; END IF;
  RAISE NOTICE 'OK  código é de uso único';
END $$;

-- 5 erros: bloqueia, e nem o código certo passa durante o bloqueio
DO $$
DECLARE v text[] := (SELECT c FROM pg_temp.codigos); r jsonb;
BEGIN
  FOR i IN 1..4 LOOP r := public.usar_codigo_recuperacao('ZZZZ-ZZZZ'); END LOOP;
  IF r->>'motivo' <> 'bloqueado' THEN RAISE EXCEPTION 'FALHOU: 5º erro não bloqueou: %', r; END IF;
  r := public.usar_codigo_recuperacao(v[2]);
  IF (r->>'ok')::boolean OR r->>'motivo' <> 'bloqueado' THEN RAISE EXCEPTION 'FALHOU: código certo passou durante o bloqueio: %', r; END IF;
  RAISE NOTICE 'OK  5 erros bloqueiam por 15 min (nem o código certo passa)';
END $$;
RESET ROLE;
UPDATE private.segundo_fator_recuperacao_falhas SET bloqueado_ate = now() - interval '1 second'
 WHERE user_id = '10000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', 'aal1', '00000000-0000-4000-8000-0000000000a4');
DO $$
DECLARE v text[] := (SELECT c FROM pg_temp.codigos); r jsonb;
BEGIN
  r := public.usar_codigo_recuperacao(v[2]);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FALHOU: depois do bloqueio o código certo não passou: %', r; END IF;
  RAISE NOTICE 'OK  passado o bloqueio, o código certo volta a valer';
END $$;

-- gerar de novo anula os antigos
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', 'aal1', '00000000-0000-4000-8000-0000000000a2');
SELECT public.gerar_codigos_recuperacao();
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', 'aal1', '00000000-0000-4000-8000-0000000000a5');
DO $$
DECLARE v text[] := (SELECT c FROM pg_temp.codigos); r jsonb;
BEGIN
  r := public.usar_codigo_recuperacao(v[3]);
  IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'FALHOU: código antigo valeu depois de gerar novos'; END IF;
  RAISE NOTICE 'OK  gerar de novo anula os códigos anteriores';
END $$;
RESET ROLE;

-- 5. Zerar o 2FA.
-- O plantonista ganha um "autenticador" e um aparelho confiável para ver o reset apagar.
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('00000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000002', 'teste', 'totp', 'verified', now(), now(), 'SEGREDO-DE-TESTE');
INSERT INTO public.dispositivos_confiaveis (user_id, token_hash, rotulo, expira_em)
VALUES ('10000000-0000-4000-8000-000000000002', 'hash-teste', 'celular', now() + interval '30 days');
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003');
INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id) VALUES ('00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000004');

SET LOCAL ROLE authenticated;
-- enfermeiro (não gestor) tenta zerar o plantonista
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004', 'aal1', '00000000-0000-4000-8000-0000000000c1');
DO $$ BEGIN
  PERFORM public.zerar_segundo_fator('10000000-0000-4000-8000-000000000002', 'perdeu o celular no plantão');
  RAISE EXCEPTION 'FALHOU: enfermeiro zerou o 2FA de outro';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  quem não é gestor não zera';
END $$;

-- gestor sem 2FA válido
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001', 'aal1', '00000000-0000-4000-8000-0000000000b9');
DO $$ BEGIN
  PERFORM public.zerar_segundo_fator('10000000-0000-4000-8000-000000000002', 'perdeu o celular no plantão');
  RAISE EXCEPTION 'FALHOU: gestor sem 2FA zerou';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  gestor sem 2FA não zera';
END $$;

SELECT pg_temp.como('10000000-0000-4000-8000-000000000001', 'aal1', '00000000-0000-4000-8000-0000000000b1');
DO $$ BEGIN
  BEGIN
    PERFORM public.zerar_segundo_fator('10000000-0000-4000-8000-000000000001', 'quero zerar o meu mesmo');
    RAISE EXCEPTION 'FALHOU: zerou o próprio';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.zerar_segundo_fator('10000000-0000-4000-8000-000000000002', 'curto');
    RAISE EXCEPTION 'FALHOU: aceitou motivo curto';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.zerar_segundo_fator('10000000-0000-4000-8000-000000000003', 'super admin perdeu o celular');
    RAISE EXCEPTION 'FALHOU: gestor zerou um super admin';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'OK  ninguém zera o próprio; motivo obrigatório; super admin só por super admin';

  PERFORM public.zerar_segundo_fator('10000000-0000-4000-8000-000000000002', 'perdeu o celular no plantão');
  RAISE NOTICE 'OK  gestor da unidade zerou o 2FA do plantonista';
END $$;
RESET ROLE;

DO $$
DECLARE u constant uuid := '10000000-0000-4000-8000-000000000002';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = u) THEN RAISE EXCEPTION 'FALHOU: autenticador ficou'; END IF;
  IF EXISTS (SELECT 1 FROM public.dispositivos_confiaveis WHERE user_id = u) THEN RAISE EXCEPTION 'FALHOU: aparelho confiável ficou'; END IF;
  IF EXISTS (SELECT 1 FROM private.segundo_fator_recuperacao WHERE user_id = u) THEN RAISE EXCEPTION 'FALHOU: códigos ficaram'; END IF;
  IF EXISTS (SELECT 1 FROM private.segundo_fator_sessao_ok WHERE user_id = u) THEN RAISE EXCEPTION 'FALHOU: sessão confirmada ficou'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.segundo_fator_eventos
                  WHERE user_id = u AND evento = 'zerado' AND autor_id = '10000000-0000-4000-8000-000000000001'
                    AND motivo = 'perdeu o celular no plantão') THEN
    RAISE EXCEPTION 'FALHOU: reset sem registro de quem fez e do motivo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria
                  WHERE acao = 'segundo_fator_zerado' AND entidade_id = u AND ator_id = '10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: reset fora da trilha de auditoria';
  END IF;
  RAISE NOTICE 'OK  reset apaga autenticador, aparelhos, códigos e sessões, e registra autor e motivo';

  -- eventos do caminho todo
  IF (SELECT array_agg(DISTINCT evento ORDER BY evento) FROM private.segundo_fator_eventos WHERE user_id = u)
     <> ARRAY['codigo_recuperacao_bloqueado', 'codigo_recuperacao_errado', 'codigo_recuperacao_usado', 'codigos_gerados',
              'dispositivo_confiado', 'dispositivo_removido', 'totp_ativado', 'totp_removido', 'zerado'] THEN
    RAISE EXCEPTION 'FALHOU: eventos registrados: %',
      (SELECT array_agg(DISTINCT evento ORDER BY evento) FROM private.segundo_fator_eventos WHERE user_id = u);
  END IF;
  IF EXISTS (SELECT 1 FROM private.segundo_fator_eventos WHERE motivo LIKE '%SEGREDO%')
     OR EXISTS (SELECT 1 FROM public.log_auditoria WHERE payload::text LIKE '%SEGREDO%') THEN
    RAISE EXCEPTION 'FALHOU: segredo TOTP apareceu em log';
  END IF;
  RAISE NOTICE 'OK  eventos: ativação, aparelho, códigos, uso, erro, bloqueio, reset — sem segredo TOTP em log';
END $$;

-- tela do gestor: lista a equipe com o estado do 2FA; quem não é gestor não vê
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001', 'aal1', '00000000-0000-4000-8000-0000000000b1');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.equipe_segundo_fator('21000000-0000-4000-8000-000000000001')
   WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
  IF r IS NULL OR r.tem_autenticador OR r.codigos_restantes <> 0 OR r.zerado_em IS NULL THEN
    RAISE EXCEPTION 'FALHOU: estado do plantonista na tela do gestor: %', r;
  END IF;
  RAISE NOTICE 'OK  tela do gestor mostra o plantonista zerado, sem autenticador e sem códigos';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004', 'aal1', '00000000-0000-4000-8000-0000000000c1');
DO $$ BEGIN
  PERFORM public.equipe_segundo_fator('21000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FALHOU: enfermeiro viu a tela do gestor';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  só o gestor vê a segurança da equipe';
END $$;
RESET ROLE;

-- super admin zera qualquer um, inclusive outro super admin
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000006');
INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id) VALUES ('00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003', 'aal1', '00000000-0000-4000-8000-0000000000d1');
DO $$ BEGIN
  PERFORM public.zerar_segundo_fator('10000000-0000-4000-8000-000000000006', 'super admin trocou de celular');
  RAISE NOTICE 'OK  super admin zera outro super admin';
END $$;
RESET ROLE;

ROLLBACK;
