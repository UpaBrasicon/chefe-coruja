-- Testes da migration 20261003000001_convites_primeiro_acesso.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_convites.sql
--
-- Gestora (…0001) gera convites na Unidade Teste; o plantonista (…0002) não.
-- Contas novas nascem por INSERT em auth.users com o metadado que a tela manda
-- no signUp (é o que o Supabase Auth faz): o gatilho consome o convite.
BEGIN;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.anonimo(ip text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('request.headers', json_build_object('x-forwarded-for', ip)::text, true);
END $$;
CREATE FUNCTION pg_temp.negado(sql text, rotulo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN raise_exception OR insufficient_privilege OR check_violation THEN
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: %', rotulo;
END $$;
-- signUp simulado (roda como o dono do banco, como o Auth)
CREATE FUNCTION pg_temp.cadastrar(id uuid, email text, meta jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, '', NULL,
          '{}', meta, now(), now());
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text), pg_temp.anonimo(text), pg_temp.negado(text, text) TO anon, authenticated;

-- ── 1. gestor gera; plantonista não; gestão não entra por convite ───────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.gerar_convite('21000000-0000-4000-8000-000000000001', 'plantonista',
    (SELECT id FROM public.setores WHERE unidade_id = '21000000-0000-4000-8000-000000000001' LIMIT 1),
    'Dra. Teste Convidada', now() + interval '2 days', now() + interval '2 days 12 hours');
  IF r.codigo !~ '^CC-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$' THEN
    RAISE EXCEPTION 'FALHOU: código fora do formato: %', r.codigo;
  END IF;
  IF r.expira_em < now() + interval '6 days 23 hours' OR r.expira_em > now() + interval '7 days 1 minute' THEN
    RAISE EXCEPTION 'FALHOU: validade padrão não é 7 dias';
  END IF;
  PERFORM set_config('teste.cod1', r.codigo, true);
  SELECT * INTO r FROM public.gerar_convite('21000000-0000-4000-8000-000000000001', 'enfermeiro');
  PERFORM set_config('teste.cod_exp', r.codigo, true);
  SELECT * INTO r FROM public.gerar_convite('21000000-0000-4000-8000-000000000001', 'farmaceutico');
  PERFORM set_config('teste.cod_rev', r.codigo, true);
  PERFORM set_config('teste.id_rev', r.id::text, true);
  SELECT * INTO r FROM public.gerar_convite('21000000-0000-4000-8000-000000000001', 'telemedicina');
  PERFORM set_config('teste.cod_tele', r.codigo, true);
  IF (SELECT count(*) FROM public.convites_da_unidade('21000000-0000-4000-8000-000000000001')
       WHERE codigo IN (current_setting('teste.cod1'), current_setting('teste.cod_exp'), current_setting('teste.cod_rev'))) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: gestor não vê os convites da unidade';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.convites WHERE codigo = current_setting('teste.cod1')) THEN
    RAISE EXCEPTION 'FALHOU: RLS escondeu o convite do gestor';
  END IF;
  RAISE NOTICE 'OK  gestor gera (CC-XXXXX, 7 dias) e lista os convites da unidade';
END $$;
SELECT pg_temp.negado($$SELECT public.gerar_convite('21000000-0000-4000-8000-000000000001', 'gestor')$$,
  'convite de gestor');
SELECT pg_temp.negado($$SELECT public.gerar_convite('21000000-0000-4000-8000-000000000001', 'plantonista', '00000000-0000-0000-0000-000000000201')$$,
  'convite com setor de outra unidade');
SELECT pg_temp.negado($$SELECT public.gerar_convite('00000000-0000-0000-0000-000000000101', 'plantonista')$$,
  'convite em unidade de que não é gestor');
SELECT public.revogar_convite(current_setting('teste.id_rev')::uuid);

SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.negado($$SELECT public.gerar_convite('21000000-0000-4000-8000-000000000001', 'plantonista')$$,
  'plantonista gerou convite');
SELECT pg_temp.negado($$SELECT public.convites_da_unidade('21000000-0000-4000-8000-000000000001')$$,
  'plantonista listou convites');
SELECT pg_temp.negado(format('SELECT public.revogar_convite(%L)', current_setting('teste.id_rev')),
  'plantonista revogou convite');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.convites) THEN
    RAISE EXCEPTION 'FALHOU: plantonista lê convite alheio';
  END IF;
  RAISE NOTICE 'OK  plantonista não gera, não lista, não revoga e não lê convites';
END $$;

-- vencer um convite (dono do banco)
RESET ROLE;
UPDATE public.convites SET criado_em = now() - interval '10 days', expira_em = now() - interval '1 day'
 WHERE codigo = current_setting('teste.cod_exp');

-- ── 2. anônimo confere: válido, errado, expirado, revogado ──────────────────
SET LOCAL ROLE anon;
SELECT pg_temp.anonimo('198.51.100.1');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.conferir_convite(lower(current_setting('teste.cod1')));
  IF r.situacao <> 'valido' OR r.unidade <> 'Unidade Teste' OR r.papel <> 'plantonista'
     OR r.convidou <> 'Gestora de Teste' OR r.convidou_papel <> 'gestor' OR r.setor IS NULL
     OR r.primeiro_plantao_inicio IS NULL THEN
    RAISE EXCEPTION 'FALHOU: cartão do convite válido incompleto: %', row_to_json(r);
  END IF;
  SELECT * INTO r FROM public.conferir_convite('CC-ZZZZZ');
  IF r.situacao <> 'nao_existe' OR r.unidade IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: código inexistente'; END IF;
  SELECT * INTO r FROM public.conferir_convite('qualquer coisa');
  IF r.situacao <> 'nao_existe' THEN RAISE EXCEPTION 'FALHOU: formato errado'; END IF;
  SELECT * INTO r FROM public.conferir_convite(current_setting('teste.cod_exp'));
  IF r.situacao <> 'expirado' OR r.unidade IS NOT NULL OR r.convidou <> 'Gestora de Teste' OR r.expira_em IS NULL THEN
    RAISE EXCEPTION 'FALHOU: expirado: %', row_to_json(r);
  END IF;
  SELECT * INTO r FROM public.conferir_convite(current_setting('teste.cod_rev'));
  IF r.situacao <> 'revogado' OR r.unidade IS NOT NULL OR r.convidou IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: revogado vazou dados: %', row_to_json(r);
  END IF;
  SELECT * INTO r FROM public.pedir_novo_convite(current_setting('teste.cod_exp'));
  IF r.convidou <> 'Gestora de Teste' OR r.pedido_em IS NULL THEN RAISE EXCEPTION 'FALHOU: pedir novo convite'; END IF;
  RAISE NOTICE 'OK  anônimo confere: válido (cartão), inexistente, formato, expirado (pede novo), revogado';
END $$;
-- 20261022000003: convite válido não renova e devolve vazio (sem RAISE, para a
-- tentativa ficar contada)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pedir_novo_convite(current_setting('teste.cod1'))) THEN
    RAISE EXCEPTION 'FALHOU: pediu novo convite de um convite válido';
  END IF;
  RAISE NOTICE 'OK  convite válido não renova (resposta vazia)';
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.convites;
    RAISE EXCEPTION 'FALHOU: anônimo lê a tabela de convites';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.gerar_convite('21000000-0000-4000-8000-000000000001', 'plantonista');
    RAISE EXCEPTION 'FALHOU: anônimo gerou convite';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  anônimo não lê a tabela nem gera convite';
END $$;

-- ── 3. limite de tentativas por origem ──────────────────────────────────────
SELECT pg_temp.anonimo('203.0.113.9');
DO $$
DECLARE r record; i int;
BEGIN
  FOR i IN 1..10 LOOP PERFORM public.conferir_convite('CC-' || lpad(i::text, 5, 'Q')); END LOOP;
  SELECT * INTO r FROM public.conferir_convite(current_setting('teste.cod1'));
  IF r.situacao <> 'muitas_tentativas' OR r.unidade IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: 10 erros não bloquearam a origem';
  END IF;
  PERFORM pg_temp.anonimo('203.0.113.10');
  SELECT * INTO r FROM public.conferir_convite(current_setting('teste.cod1'));
  IF r.situacao <> 'valido' THEN RAISE EXCEPTION 'FALHOU: bloqueio vazou para outra origem'; END IF;
  RAISE NOTICE 'OK  10 erros em 15 min bloqueiam só a origem que errou';
END $$;

-- ── 4. signUp com convite: perfil, termo, vínculo ativo, convite usado ──────
RESET ROLE;
-- quem grava em auth.users é o papel do Auth (supabase_auth_admin), que não
-- enxerga o schema private: gatilho de lá sem SECURITY DEFINER derruba o signUp
DO $$
DECLARE nomes text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO nomes
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal
     AND p.pronamespace = 'private'::regnamespace AND NOT p.prosecdef;
  IF nomes IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: gatilho de auth.users sem SECURITY DEFINER: %', nomes;
  END IF;
  RAISE NOTICE 'OK  gatilhos de auth.users rodam como dono (o papel do Auth não vê private)';
END $$;
SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c1', 'convidada@teste.local', jsonb_build_object(
  'nome_completo', 'Dra. Teste Convidada', 'codigo_convite', lower(current_setting('teste.cod1')),
  'cpf', '987.650.001-53', 'data_nascimento', '1990-05-04', 'conselho', 'CRM',
  'registro_numero', '123456', 'registro_uf', 'SP', 'termo_versao', 'termo-uso-sigilo-2026-10',
  -- as escolhas do passo 2 vão no mesmo signUp
  'avisos', jsonb_build_object('leito_novo', true, 'item_abaixo_minimo', false, 'fim_turno_30min', true),
  'canal_aviso', 'aparelho'));
-- o Auth regrava o metadado depois do INSERT: as chaves pessoais não podem voltar
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"cpf":"98765000153","sub":"x"}'
 WHERE id = '10000000-0000-4000-8000-0000000000c1';
DO $$
DECLARE p public.perfis%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.perfis WHERE id = '10000000-0000-4000-8000-0000000000c1';
  IF p.cpf <> '98765000153' OR p.conselho <> 'CRM' OR p.registro_numero <> '123456' OR p.registro_uf <> 'SP'
     OR p.crm <> '123456' OR p.uf_crm <> 'SP' OR p.data_nascimento <> '1990-05-04' THEN
    RAISE EXCEPTION 'FALHOU: perfil sem os dados do primeiro acesso: %', row_to_json(p);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = p.id AND unidade_id = '21000000-0000-4000-8000-000000000001'
                   AND papel = 'plantonista' AND ativo AND criado_por = '10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: vínculo ativo não criado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.convites WHERE codigo = current_setting('teste.cod1') AND usado_por = p.id AND usado_em IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHOU: convite não marcado como usado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.aceites_termo WHERE perfil_id = p.id AND versao = 'termo-uso-sigilo-2026-10' AND origem = 'convite') THEN
    RAISE EXCEPTION 'FALHOU: aceite do termo não registrado';
  END IF;
  IF (SELECT raw_user_meta_data ?| ARRAY['cpf', 'data_nascimento', 'registro_numero', 'avisos'] FROM auth.users WHERE id = p.id)
     OR (SELECT raw_user_meta_data ->> 'sub' FROM auth.users WHERE id = p.id) IS DISTINCT FROM 'x' THEN
    RAISE EXCEPTION 'FALHOU: dado pessoal ficou (ou voltou) no metadado do Auth';
  END IF;
  IF EXISTS (SELECT 1 FROM private.primeiro_acesso_pendente WHERE user_id = p.id) THEN
    RAISE EXCEPTION 'FALHOU: dados do signUp ficaram estacionados';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'aceitar_convite' AND ator_id = p.id) THEN
    RAISE EXCEPTION 'FALHOU: aceite sem trilha de auditoria';
  END IF;
  BEGIN
    UPDATE public.aceites_termo SET versao = 'outra' WHERE perfil_id = p.id;
    RAISE EXCEPTION 'FALHOU: aceite do termo alterado';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  signUp com convite: perfil + CRM coerente, termo, vínculo ativo, convite usado, metadado limpo';
END $$;

-- convite usado, CPF inválido, sem termo, CPF repetido: o signUp cai inteiro
SELECT pg_temp.negado(format($f$SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c2', 'outra@teste.local', %L)$f$,
  jsonb_build_object('nome_completo', 'Outra Pessoa', 'codigo_convite', current_setting('teste.cod1'), 'cpf', '98765000234',
    'data_nascimento', '1990-01-01', 'conselho', 'CRM', 'registro_numero', '1', 'registro_uf', 'SP',
    'termo_versao', 'termo-uso-sigilo-2026-10')), 'convite usado duas vezes');
SELECT pg_temp.negado(format($f$SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c2', 'outra@teste.local', %L)$f$,
  jsonb_build_object('nome_completo', 'Outra Pessoa', 'codigo_convite', current_setting('teste.cod_exp'), 'cpf', '98765000234',
    'data_nascimento', '1990-01-01', 'conselho', 'COREN', 'registro_numero', '12', 'registro_uf', 'SP',
    'termo_versao', 'termo-uso-sigilo-2026-10')), 'convite expirado aceito');
SELECT pg_temp.negado(format($f$SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c2', 'outra@teste.local', %L)$f$,
  jsonb_build_object('nome_completo', 'Outra Pessoa', 'codigo_convite', current_setting('teste.cod_rev'), 'cpf', '98765000234',
    'data_nascimento', '1990-01-01', 'conselho', 'CRF', 'registro_numero', '12', 'registro_uf', 'SP',
    'termo_versao', 'termo-uso-sigilo-2026-10')), 'convite revogado aceito');
SELECT pg_temp.negado(format($f$SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c2', 'outra@teste.local', %L)$f$,
  jsonb_build_object('nome_completo', 'Outra Pessoa', 'codigo_convite', current_setting('teste.cod_tele'), 'cpf', '98765000235',
    'data_nascimento', '1990-01-01', 'conselho', 'CRM', 'registro_numero', '12', 'registro_uf', 'SP',
    'termo_versao', 'termo-uso-sigilo-2026-10')), 'CPF com dígito errado');
SELECT pg_temp.negado(format($f$SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c2', 'outra@teste.local', %L)$f$,
  jsonb_build_object('nome_completo', 'Outra Pessoa', 'codigo_convite', current_setting('teste.cod_tele'), 'cpf', '98765000234',
    'data_nascimento', '1990-01-01', 'conselho', 'CRM', 'registro_numero', '12', 'registro_uf', 'SP')), 'sem aceite do termo');
SELECT pg_temp.negado(format($f$SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c2', 'outra@teste.local', %L)$f$,
  jsonb_build_object('nome_completo', 'Outra Pessoa', 'codigo_convite', current_setting('teste.cod_tele'), 'cpf', '98765000153',
    'data_nascimento', '1990-01-01', 'conselho', 'CRM', 'registro_numero', '12', 'registro_uf', 'SP',
    'termo_versao', 'termo-uso-sigilo-2026-10')), 'CPF que já tem conta');
SELECT pg_temp.negado(format($f$SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c2', 'outra@teste.local', %L)$f$,
  jsonb_build_object('nome_completo', 'Outra Pessoa', 'codigo_convite', current_setting('teste.cod_tele'), 'cpf', '98765000234',
    'data_nascimento', '1990-01-01', 'termo_versao', 'termo-uso-sigilo-2026-10')), 'papel clínico sem registro profissional');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '10000000-0000-4000-8000-0000000000c2') THEN
    RAISE EXCEPTION 'FALHOU: sobrou conta de signUp recusado';
  END IF;
  RAISE NOTICE 'OK  convite usado/expirado/revogado, CPF errado ou repetido, sem termo, sem registro: sem conta';
END $$;

SET LOCAL ROLE anon;
SELECT pg_temp.anonimo('198.51.100.2');
DO $$ BEGIN
  IF (SELECT situacao FROM public.conferir_convite(current_setting('teste.cod1'))) <> 'usado' THEN
    RAISE EXCEPTION 'FALHOU: convite usado ainda confere';
  END IF;
  RAISE NOTICE 'OK  convite usado deixa de conferir';
END $$;

-- ── 5. preferências de aviso ────────────────────────────────────────────────
-- sem sessão não se grava preferência (as do primeiro acesso vieram no signUp)
DO $$ BEGIN
  BEGIN
    PERFORM public.salvar_preferencias_aviso('{"leito_novo": false}', 'plataforma');
    RAISE EXCEPTION 'FALHOU: anônimo gravou preferências';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  salvar_preferencias_aviso fechado para anônimo';
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000c1');
SELECT pg_temp.negado($$SELECT public.salvar_preferencias_aviso('{"observacao_6h": false}', 'plataforma')$$,
  'desligou observação acima de 6 h');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.preferencias_aviso) <> 4
     OR NOT (SELECT ligado FROM public.preferencias_aviso WHERE chave = 'observacao_6h')
     OR (SELECT ligado FROM public.preferencias_aviso WHERE chave = 'item_abaixo_minimo')
     OR EXISTS (SELECT 1 FROM public.preferencias_aviso WHERE canal <> 'aparelho') THEN
    RAISE EXCEPTION 'FALHOU: preferências gravadas erradas';
  END IF;
  PERFORM public.salvar_preferencias_aviso('{"item_abaixo_minimo": true}', 'plataforma');
  IF NOT (SELECT ligado FROM public.preferencias_aviso WHERE chave = 'item_abaixo_minimo') THEN
    RAISE EXCEPTION 'FALHOU: dono não atualizou a preferência';
  END IF;
  RAISE NOTICE 'OK  preferências: gravadas no signUp, dono atualiza, observação sempre ligada';
END $$;
SELECT pg_temp.negado($$UPDATE public.preferencias_aviso SET ligado = false WHERE chave = 'observacao_6h'$$,
  'UPDATE direto desligou observação acima de 6 h');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.preferencias_aviso) THEN
    RAISE EXCEPTION 'FALHOU: preferências de outra pessoa visíveis';
  END IF;
  RAISE NOTICE 'OK  preferências só do dono';
END $$;

-- ── 6. quem já tem conta aceita convite para outro papel ────────────────────
SELECT pg_temp.negado(format('SELECT public.aceitar_convite(%L, %L)', current_setting('teste.cod_tele'), 'termo-uso-sigilo-2026-10'),
  'aceitou sem CPF/nascimento/registro no perfil');
DO $$ BEGIN
  PERFORM public.aceitar_convite(current_setting('teste.cod_tele'), 'termo-uso-sigilo-2026-10',
    NULL, '987.650.002-34', '1985-03-02', 'CRM', '654321', 'RJ');
  IF NOT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = '10000000-0000-4000-8000-000000000002'
                   AND papel = 'telemedicina' AND ativo) THEN
    RAISE EXCEPTION 'FALHOU: aceitar_convite não criou o vínculo';
  END IF;
  RAISE NOTICE 'OK  aceitar_convite (com sessão) cria o vínculo do convite';
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.anonimo('198.51.100.3');
DO $$ BEGIN
  BEGIN
    PERFORM public.aceitar_convite('CC-AAAAA', 'termo-uso-sigilo-2026-10');
    RAISE EXCEPTION 'FALHOU: anônimo chamou aceitar_convite';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  aceitar_convite fechado para anônimo';
END $$;

-- ── 7. contrato da rede: conta nasce, vínculo aguarda o administrador ──────
RESET ROLE;
INSERT INTO public.contratos_rede (codigo, organizacao_id, papel_padrao, dominio_email, vigente_ate)
VALUES ('CT-2099-001', '20000000-0000-4000-8000-000000000001', 'gestor', 'rede.teste', '2099-12-31');
INSERT INTO public.contratos_rede (codigo, organizacao_id, papel_padrao, ativo)
VALUES ('CT-2099-002', '20000000-0000-4000-8000-000000000001', 'gestor', false);
SET LOCAL ROLE anon;
SELECT pg_temp.anonimo('198.51.100.4');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.conferir_contrato('ct-2099-001', 'gestora@rede.teste');
  IF r.situacao <> 'valido' OR r.papel <> 'gestor' OR r.unidades < 1 OR r.organizacao IS NULL THEN
    RAISE EXCEPTION 'FALHOU: contrato válido: %', row_to_json(r);
  END IF;
  SELECT * INTO r FROM public.conferir_contrato('CT-2099-001', 'gestora@outro.dominio');
  IF r.situacao <> 'nao_confere' OR r.organizacao IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: domínio errado conferiu'; END IF;
  SELECT * INTO r FROM public.conferir_contrato('CT-2099-002', 'gestora@rede.teste');
  IF r.situacao <> 'nao_confere' THEN RAISE EXCEPTION 'FALHOU: contrato inativo conferiu'; END IF;
  SELECT * INTO r FROM public.conferir_contrato('CT-2099-999', 'gestora@rede.teste');
  IF r.situacao <> 'nao_confere' THEN RAISE EXCEPTION 'FALHOU: contrato inexistente conferiu'; END IF;
  RAISE NOTICE 'OK  contrato confere só com código ativo e e-mail do domínio';
END $$;
RESET ROLE;
SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c3', 'gestora@rede.teste', jsonb_build_object(
  'nome_completo', 'Gestora Contratada', 'codigo_contrato', 'CT-2099-001',
  'cpf', '98765000315', 'data_nascimento', '1980-01-01', 'termo_versao', 'termo-uso-sigilo-2026-10'));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.adesoes_contrato WHERE perfil_id = '10000000-0000-4000-8000-0000000000c3' AND papel = 'gestor') THEN
    RAISE EXCEPTION 'FALHOU: adesão ao contrato não registrada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = '10000000-0000-4000-8000-0000000000c3') THEN
    RAISE EXCEPTION 'FALHOU: contrato criou vínculo sem o administrador';
  END IF;
  RAISE NOTICE 'OK  signUp por contrato: adesão registrada, vínculo aguarda liberação';
END $$;
SELECT pg_temp.negado($f$SELECT pg_temp.cadastrar('10000000-0000-4000-8000-0000000000c4', 'fora@outro.dominio', '{"nome_completo":"Fora do Dominio","codigo_contrato":"CT-2099-001","cpf":"98765000234","data_nascimento":"1980-01-01","termo_versao":"termo-uso-sigilo-2026-10"}')$f$,
  'signUp por contrato com e-mail de outro domínio');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');  -- admin da organização
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.adesoes_contrato WHERE perfil_id = '10000000-0000-4000-8000-0000000000c3') THEN
    RAISE EXCEPTION 'FALHOU: admin da rede não vê a adesão';
  END IF;
  RAISE NOTICE 'OK  admin da rede vê quem aderiu ao contrato';
END $$;
SELECT pg_temp.negado($$INSERT INTO public.contratos_rede (codigo, organizacao_id) VALUES ('CT-2099-003', '20000000-0000-4000-8000-000000000001')$$,
  'admin criou contrato (só super-admin)');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.contratos_rede) OR EXISTS (SELECT 1 FROM public.adesoes_contrato) THEN
    RAISE EXCEPTION 'FALHOU: plantonista lê contrato/adesão';
  END IF;
  RAISE NOTICE 'OK  plantonista não lê contratos nem adesões';
END $$;

ROLLBACK;
