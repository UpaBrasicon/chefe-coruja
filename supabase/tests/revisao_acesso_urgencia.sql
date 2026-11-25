-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000075_acesso_urgencia_prontuario.sql.
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. sem urgência, o médico fora do plantão não lê o prontuário;
-- 2. justificativa curta é recusada; enfermeiro e conta de outra unidade
--    também;
-- 3. com justificativa, o médico abre na hora: lê o prontuário, a linha fica
--    em pedidos com status 'urgencia' e prazo de 2 h, vai à auditoria e o
--    gestor recebe aviso sem o nome do paciente;
-- 4. não abre duas vezes seguidas; vencido o prazo, a leitura fecha;
-- 5. a leitura continua sendo só leitura (nenhuma escrita passa a valer);
-- 6. a CHECK recusa urgência com decisão do gestor; anon não executa.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000007e4001'),
  ('upa',  '00000000-0000-4000-8000-0000007e4002'),
  ('upa2', '00000000-0000-4000-8000-0000007e4003'),
  ('pac',  '00000000-0000-4000-8000-0000007e4011'),
  ('gest', '00000000-0000-4000-8000-0000007e4021'),
  ('med',  '00000000-0000-4000-8000-0000007e4022'),
  ('enf',  '00000000-0000-4000-8000-0000007e4023'),
  ('fora', '00000000-0000-4000-8000-0000007e4024');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % (passou sem erro)', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
-- lidos como postgres
CREATE FUNCTION pg_temp.auditoria() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.log_auditoria
   WHERE unidade_id = pg_temp.id('upa') AND acao = 'abrir_acesso_urgencia' AND ator_id = pg_temp.id('med') $$;
CREATE FUNCTION pg_temp.aviso() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT string_agg(mensagem, ' | ') FROM public.notificacoes_plantonista
   WHERE perfil_id = pg_temp.id('gest') AND tipo LIKE 'acesso_urgencia_%' $$;
GRANT EXECUTE ON FUNCTION pg_temp.auditoria(), pg_temp.aviso() TO authenticated;
CREATE TEMP TABLE v (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@revisao-urgencia.local' FROM ids WHERE nome IN ('gest', 'med', 'enf', 'fora');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('gest', 'med', 'enf', 'fora')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da urgência da revisão');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA da urgência', 'upa'),
  (pg_temp.id('upa2'), pg_temp.id('org'), 'UPA vizinha da urgência', 'upa');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('upa'), 'gestor'),
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('enf'), pg_temp.id('upa'), 'enfermeiro'),
  (pg_temp.id('fora'), pg_temp.id('upa2'), 'plantonista');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento)
VALUES (pg_temp.id('pac'), pg_temp.id('upa'), 'Paciente Sigiloso da Urgência', '1950-02-02');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok(private.pode_ler_prontuario(pg_temp.id('pac')) IS NOT TRUE, 'sem urgência, o médico fora do plantão não lê');
SELECT pg_temp.falha(format('SELECT public.abrir_acesso_urgencia(%L, %L)', pg_temp.id('pac'), 'urgente agora 123'),
  'Escreva a justificativa da urgência', 'justificativa com menos de 20 letras recusada');
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.abrir_acesso_urgencia(%L, %L)', pg_temp.id('pac'), 'Paciente chegou grave e preciso do histórico'),
  'Acesso negado', 'enfermeiro não abre urgência');
SELECT pg_temp.como('fora');
SELECT pg_temp.falha(format('SELECT public.abrir_acesso_urgencia(%L, %L)', pg_temp.id('pac'), 'Paciente chegou grave e preciso do histórico'),
  'Acesso negado', 'médico de outra unidade não abre urgência');

SELECT pg_temp.como('med');
INSERT INTO v SELECT 'u', public.abrir_acesso_urgencia(pg_temp.id('pac'), '  Paciente voltou em parada, preciso das alergias e do último atendimento  ');
SELECT pg_temp.ok(private.pode_ler_prontuario(pg_temp.id('pac')), 'com a urgência, o médico lê o prontuário na hora');
SELECT pg_temp.ok((SELECT m.status = 'urgencia' AND m.vigente AND m.valido_ate BETWEEN now() + interval '119 minutes' AND now() + interval '121 minutes'
                     FROM public.meus_pedidos_acesso(pg_temp.id('upa')) m WHERE m.id = (SELECT id FROM v WHERE k = 'u')),
  'a urgência aparece em meus pedidos, vigente por 2 h');
SELECT pg_temp.ok(pg_temp.auditoria() = 1, 'a urgência vai à auditoria');
SELECT pg_temp.ok(pg_temp.aviso() ILIKE '%Pessoa med%urgência%' AND pg_temp.aviso() NOT ILIKE '%Sigiloso%',
  'o gestor recebe aviso, sem o nome do paciente');
SELECT pg_temp.falha(format('SELECT public.abrir_acesso_urgencia(%L, %L)', pg_temp.id('pac'), 'Paciente voltou em parada, preciso das alergias'),
  'Você já tem acesso vigente', 'não abre duas vezes seguidas');
SELECT pg_temp.ok(private.pode_atuar_no_paciente(pg_temp.id('pac')) IS NOT TRUE,
  'a urgência não dá atuação no paciente: só leitura');
SELECT pg_temp.como('gest');
SELECT pg_temp.ok((SELECT p.status FROM public.pedidos_acesso_da_unidade(pg_temp.id('upa'), 30) p WHERE p.id = (SELECT id FROM v WHERE k = 'u')) = 'urgencia',
  'o gestor vê a urgência na lista de pedidos da unidade');
RESET ROLE;

-- vencido o prazo, a leitura fecha
UPDATE public.pedidos_acesso_prontuario SET valido_ate = now() - interval '1 minute' WHERE id = (SELECT id FROM v WHERE k = 'u');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok(private.pode_ler_prontuario(pg_temp.id('pac')) IS NOT TRUE, 'vencidas as 2 h, a leitura fecha');
RESET ROLE;

DO $$ BEGIN
  INSERT INTO public.pedidos_acesso_prontuario (organizacao_id, unidade_id, paciente_id, solicitante_id, papel, motivo, status, decidido_por, valido_ate)
  VALUES (pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac'), pg_temp.id('med'), 'plantonista',
          'Urgência com decisão do gestor não existe', 'urgencia', pg_temp.id('gest'), now() + interval '2 hours');
  RAISE EXCEPTION 'FALHOU: CHECK aceitou urgência decidida';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'OK  a CHECK recusa urgência com decisão do gestor';
END $$;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.abrir_acesso_urgencia(uuid, text)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
