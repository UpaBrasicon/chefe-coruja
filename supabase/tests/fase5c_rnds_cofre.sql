-- Testes da migration 20270206000001_rnds_cofre_banco.sql (Fase 5C, tarefa 5,
-- etapa 5.4a): credencial com unidades filhas, cofre cifrado, leitura do
-- certificado pelo serviço, avisos de vencimento, bloqueio por CBO e as
-- funções do painel, com as permissões.
-- Não depende da semente local (roda também na homologação). ROLLBACK no fim.
BEGIN;
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
GRANT SELECT, INSERT ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.falha(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
CREATE FUNCTION pg_temp.como(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated', 'aal', 'aal2')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.ok(boolean, text), pg_temp.falha(text), pg_temp.como(uuid) TO authenticated;
CREATE FUNCTION pg_temp.avisos(p_prefixo text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.notificacoes_plantonista WHERE tipo LIKE p_prefixo || '%'
     AND perfil_id = '00000000-0000-4000-8000-0000000f5451' $$;

INSERT INTO t VALUES ('org', '00000000-0000-4000-8000-0000000f5401'), ('un', '00000000-0000-4000-8000-0000000f5402'),
  ('un2', '00000000-0000-4000-8000-0000000f5403'), ('un_sp', '00000000-0000-4000-8000-0000000f5404'),
  ('setor', '00000000-0000-4000-8000-0000000f5405'), ('pac', '00000000-0000-4000-8000-0000000f5411'),
  ('ep1', '00000000-0000-4000-8000-0000000f5421'), ('ep2', '00000000-0000-4000-8000-0000000f5422'),
  ('gestor', '00000000-0000-4000-8000-0000000f5451'), ('gestor_sp', '00000000-0000-4000-8000-0000000f5452'),
  ('medico', '00000000-0000-4000-8000-0000000f5453');
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT pg_temp.u(n), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'rnds54.' || n || '@exemplo.invalid', '{"origem": "admin"}', json_build_object('nome_completo', 'Ficticio ' || n)::jsonb, now(), now()
  FROM unnest(ARRAY['gestor', 'gestor_sp', 'medico']) n;
INSERT INTO public.perfis (id, nome_completo, cpf, cns, cbo)
SELECT pg_temp.u(n), 'Ficticio ' || n, CASE WHEN n = 'medico' THEN '11144477735' END,
       CASE WHEN n = 'medico' THEN '898001000000011' END, CASE WHEN n = 'medico' THEN '225125' END
  FROM unnest(ARRAY['gestor', 'gestor_sp', 'medico']) n
ON CONFLICT (id) DO UPDATE SET cpf = EXCLUDED.cpf, cns = EXCLUDED.cns, cbo = EXCLUDED.cbo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.u('org'), 'Rede RNDS Cofre Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, uf) VALUES
  (pg_temp.u('un'), pg_temp.u('org'), 'UPA Principal Cofre', 'upa', '9999985', 'GO'),
  (pg_temp.u('un2'), pg_temp.u('org'), 'UPA Filha Cofre', 'upa', '9999984', 'GO'),
  (pg_temp.u('un_sp'), pg_temp.u('org'), 'UPA Outra UF Cofre', 'upa', '9999983', 'SP');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.u('gestor'), pg_temp.u('un'), 'gestor'), (pg_temp.u('gestor'), pg_temp.u('un2'), 'gestor'),
  (pg_temp.u('gestor_sp'), pg_temp.u('un_sp'), 'gestor');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.u('setor'), pg_temp.u('un'), 'Porta Cofre', 'emergencia');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo, cpf)
VALUES (pg_temp.u('pac'), pg_temp.u('un'), 'Paciente Ficticio Cofre', '1960-01-01', 'COF-1', 'M', '52998224725');
-- dois atendimentos do mesmo médico, encerrados com alta
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, chegada_em,
  atendimento_medico_id, atendimento_iniciado_em, desfecho, desfecho_em, desfecho_por, encerrado_em, encerrado_por)
SELECT pg_temp.u(e), pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('setor'), 'Dor de garganta', pg_temp.u('medico'), 'encerrado',
       now() - interval '3 hours', pg_temp.u('medico'), now() - interval '170 minutes', 'alta', now() - interval '2 hours',
       pg_temp.u('medico'), now() - interval '2 hours', pg_temp.u('medico')
  FROM unnest(ARRAY['ep1', 'ep2']) e;
INSERT INTO public.diagnosticos_episodio (unidade_id, paciente_id, episodio_id, tipo, cid, status, registrado_por)
SELECT pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u(e), 'primario', 'J06.9', 'confirmado', pg_temp.u('medico')
  FROM unnest(ARRAY['ep1', 'ep2']) e;
INSERT INTO public.procedimentos_realizados (unidade_id, paciente_id, episodio_id, procedimento, quantidade, realizado_em,
  profissional_id, cbo, via, registrado_por)
SELECT pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u(e), '0301060096', 1, now() - interval '160 minutes', pg_temp.u('medico'),
       '225125', 'quem_fez', pg_temp.u('medico')
  FROM unnest(ARRAY['ep1', 'ep2']) e;
SELECT private.enfileirar_documento(pg_temp.u('un'), 'rac', pg_temp.u(e),
  jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'rac'))
  FROM unnest(ARRAY['ep1', 'ep2']) e;
INSERT INTO t SELECT 'i1', id::text FROM public.interop_outbox WHERE referencia_id = pg_temp.u('ep1');
INSERT INTO t SELECT 'i2', id::text FROM public.interop_outbox WHERE referencia_id = pg_temp.u('ep2');

-- ── credencial e configuração, como gestor ─────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT pg_temp.ok(pg_temp.falha(format('SELECT public.rnds_salvar_credencial(NULL, %L, %L, %L, ARRAY[%L]::uuid[])',
  'Credencial teste', pg_temp.u('un'), '99999', pg_temp.u('un_sp'))) LIKE 'Só quem é gestor de todas as unidades%',
  'credencial com unidade que não é dele: recusada');
INSERT INTO t SELECT 'cred', public.rnds_salvar_credencial(NULL, 'Credencial teste', pg_temp.u('un'), '99999', ARRAY[pg_temp.u('un2')])::text;
SELECT pg_temp.ok((public.rnds_painel(pg_temp.u('un2')) #>> '{credencial,id}')::uuid = pg_temp.u('cred')
  AND jsonb_array_length(public.rnds_painel(pg_temp.u('un')) #> '{credencial,unidades}') = 2
  AND public.rnds_painel(pg_temp.u('un')) #>> '{credencial,ambiente}' = 'homologacao',
  'credencial cobre a principal e a filha, e nasce na homologação');
SELECT pg_temp.ok(pg_temp.falha(format('SELECT public.rnds_salvar_config(%L, NULL, true)', pg_temp.u('un')))
  LIKE 'Para ligar o envio%', 'sem financiamento não liga');
SELECT public.rnds_salvar_config(pg_temp.u('un'), '07', true);
SELECT pg_temp.ok((public.rnds_painel(pg_temp.u('un')) #>> '{config,envio_ligado}')::boolean, 'envio ligado com credencial e financiamento');
SELECT pg_temp.ok(pg_temp.falha(format('SELECT public.rnds_definir_ambiente(%L, %L)', pg_temp.u('cred'), 'producao'))
  LIKE 'Só a administração da plataforma%', 'gestor não passa a credencial para a produção');
SELECT pg_temp.ok(pg_temp.falha('SELECT * FROM public.rnds_credenciais') LIKE 'permission denied%',
  'a tabela da credencial (com o cifrado) não é lida pela API');
-- gestor de outra unidade não vê nada
SELECT pg_temp.como(pg_temp.u('gestor_sp'));
SELECT pg_temp.ok(pg_temp.falha(format('SELECT public.rnds_painel(%L)', pg_temp.u('un'))) LIKE 'Só o gestor da unidade%'
  AND pg_temp.falha(format('SELECT public.rnds_itens(%L)', pg_temp.u('un'))) LIKE 'Só o gestor da unidade%',
  'gestor de outra unidade não vê o painel nem a fila');
RESET ROLE;

-- ── cofre: o serviço publica a chave; o gestor envia o cifrado ─────────────
SELECT public.rnds_registrar_chave_publica('chave-teste-1', '{"kty": "RSA", "n": "abc", "e": "AQAB", "alg": "RSA-OAEP-256"}');
SELECT pg_temp.ok(pg_temp.falha($q$SELECT public.rnds_registrar_chave_publica('chave-com-privada', '{"kty": "RSA", "n": "a", "e": "AQAB", "d": "x"}')$q$)
  IS NOT NULL, 'chave com a parte privada é recusada');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT pg_temp.ok(public.rnds_chave_publica() ->> 'id' = 'chave-teste-1', 'o navegador acha a chave pública ativa');
SELECT pg_temp.ok(pg_temp.falha(format($q$SELECT public.rnds_enviar_certificado(%L, '{"versao": 1, "chave_id": "outra", "chave": "a", "iv": "b", "dados": "c"}')$q$,
  pg_temp.u('cred'))) LIKE 'A chave do serviço mudou%', 'cifrado com chave que não é a ativa: recusado');
SELECT pg_temp.ok(pg_temp.falha(format($q$SELECT public.rnds_enviar_certificado(%L, '{"versao": 1, "chave_id": "chave-teste-1"}')$q$,
  pg_temp.u('cred'))) LIKE 'Certificado cifrado em formato inválido%', 'cifrado incompleto: recusado');
SELECT public.rnds_enviar_certificado(pg_temp.u('cred'), '{"versao": 1, "chave_id": "chave-teste-1", "chave": "a", "iv": "b", "dados": "c"}');
SELECT pg_temp.ok(public.rnds_painel(pg_temp.u('un')) #>> '{credencial,certificado,situacao}' = 'aguardando'
  AND NOT (public.rnds_painel(pg_temp.u('un')) #> '{credencial,certificado}') ? 'cifrado',
  'certificado aguardando a leitura; o painel não mostra o cifrado');
RESET ROLE;
SELECT pg_temp.ok(public.rnds_certificado_da_unidade(pg_temp.u('un2')) ->> 'credencial_id' = pg_temp.u('cred')::text
  AND public.rnds_certificado_da_unidade(pg_temp.u('un2')) #>> '{certificado_cifrado,chave_id}' = 'chave-teste-1',
  'o serviço acha o certificado pela unidade filha');

-- ── leitura pelo serviço e avisos de vencimento ────────────────────────────
SELECT public.rnds_registrar_certificado(pg_temp.u('cred'), 'valido', 'UPA PRINCIPAL COFRE', '12345678000199',
  now() + interval '7 days', 'AB:CD:EF');
SELECT pg_temp.ok((SELECT certificado_situacao = 'valido' AND certificado_titular = 'UPA PRINCIPAL COFRE'
  FROM public.rnds_credenciais WHERE id = pg_temp.u('cred')), 'titular e validade gravados');
SELECT pg_temp.ok(private.rnds_avisos_certificado() >= 1 AND pg_temp.avisos('rnds_certificado_7d_') = 2,
  'a 7 dias do vencimento: aviso aos gestores da principal e da filha');
UPDATE public.rnds_credenciais SET certificado_valido_ate = now() - interval '1 minute' WHERE id = pg_temp.u('cred');
SELECT private.rnds_avisos_certificado();
SELECT pg_temp.ok((SELECT certificado_situacao FROM public.rnds_credenciais WHERE id = pg_temp.u('cred')) = 'vencido'
  AND (SELECT count(*) FROM public.rnds_config_unidade WHERE credencial_id = pg_temp.u('cred') AND pausa_motivo LIKE 'certificado vencido%') = 2
  AND pg_temp.avisos('rnds_certificado_vencido_') = 2,
  'vencido: as duas unidades pausam e os gestores são avisados');
SELECT public.rnds_registrar_certificado(pg_temp.u('cred'), 'senha_incorreta', p_erro => 'mac verify failure');
SELECT pg_temp.ok(pg_temp.avisos('rnds_certificado_senha_incorreta_') = 2, 'senha errada avisa');
SELECT public.rnds_registrar_certificado(pg_temp.u('cred'), 'valido', 'UPA PRINCIPAL COFRE', '12345678000199',
  now() + interval '200 days', 'AB:CD:EF');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT public.rnds_retomar(pg_temp.u('un'));
SELECT pg_temp.ok(public.rnds_painel(pg_temp.u('un')) #>> '{config,pausado_em}' IS NULL, 'o gestor retoma o envio');
RESET ROLE;

-- ── bloqueio por CBO ───────────────────────────────────────────────────────
SELECT pg_temp.ok(public.rnds_dados_documento(pg_temp.u('i1')) #>> '{envio,credencial_id}' = pg_temp.u('cred')::text
  AND public.rnds_dados_documento(pg_temp.u('i1')) #>> '{envio,identificador_solicitante}' = '99999',
  'a carga leva a credencial e o identificador dela');
SELECT public.rnds_registrar_resultado(pg_temp.u('i1'), 'erro', p_erro =>
  'RNDS recusou o documento (422) (EHR-ERR906) Profissional 898001000000011 não autorizado');
SELECT pg_temp.ok((SELECT count(*) FROM public.rnds_bloqueios WHERE cns = '898001000000011' AND desbloqueado_em IS NULL) = 2,
  'ERR906 bloqueia o médico na principal e na filha');
SELECT pg_temp.ok(pg_temp.avisos('rnds_bloqueio_') = 2, 'o gestor é avisado do bloqueio');
SELECT pg_temp.ok(pg_temp.falha(format('SELECT public.rnds_dados_documento(%L)', pg_temp.u('i2')))
  LIKE 'retido: profissional bloqueado pela RNDS (ERR906)%', 'o documento seguinte do médico fica retido');
SELECT public.rnds_registrar_resultado(pg_temp.u('i2'), 'retido', p_erro => 'retido: profissional bloqueado pela RNDS (ERR906) desde hoje');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT pg_temp.ok(jsonb_array_length(public.rnds_painel(pg_temp.u('un')) -> 'bloqueios') = 1
  AND (public.rnds_painel(pg_temp.u('un')) #>> '{contagem,erro}')::int = 1
  AND jsonb_array_length(public.rnds_itens(pg_temp.u('un'), 'retido')) = 1,
  'o painel mostra o bloqueio, o erro e o retido');
INSERT INTO t SELECT 'bloq', public.rnds_painel(pg_temp.u('un')) #>> '{bloqueios,0,id}';
SELECT pg_temp.ok(public.rnds_desbloquear(pg_temp.u('bloq')) = 2, 'desbloqueio tira o bloqueio da principal e da filha');
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'pendente' AND tentativas = 0 FROM public.interop_outbox WHERE id = pg_temp.u('i1')),
  'o documento recusado volta à fila');
SELECT pg_temp.ok((SELECT proxima_tentativa_em <= now() FROM public.interop_outbox WHERE id = pg_temp.u('i2')),
  'o retido pelo bloqueio tenta agora');
SELECT pg_temp.ok(public.rnds_dados_documento(pg_temp.u('i2')) ->> 'tipo' = 'rac', 'sem bloqueio, a carga volta a sair');

-- ── reenviar à mão ─────────────────────────────────────────────────────────
SELECT public.rnds_registrar_resultado(pg_temp.u('i1'), 'erro', p_erro => 'RNDS recusou o documento (422) (EHR-ERR802) código fora da competência');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT pg_temp.ok(public.rnds_reenviar(pg_temp.u('i1')) = 'pendente', 'erro volta à fila pelo painel');
SELECT pg_temp.como(pg_temp.u('gestor_sp'));
SELECT pg_temp.ok(pg_temp.falha(format('SELECT public.rnds_reenviar(%L)', pg_temp.u('i2'))) LIKE 'Só o gestor da unidade%',
  'gestor de outra unidade não reenvia');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE acao IN ('rnds_credencial_salva', 'rnds_config_salva',
  'rnds_certificado_enviado', 'rnds_envio_retomado', 'rnds_bloqueio_tirado', 'rnds_item_reenviado')) >= 6,
  'as ações do painel ficam na auditoria');

-- ── chave nova no serviço: o certificado precisa ser enviado de novo ───────
SELECT public.rnds_registrar_chave_publica('chave-teste-2', '{"kty": "RSA", "n": "def", "e": "AQAB"}');
SELECT pg_temp.ok((SELECT certificado_situacao FROM public.rnds_credenciais WHERE id = pg_temp.u('cred')) = 'chave_trocada'
  AND (SELECT count(*) FROM public.rnds_chaves_publicas WHERE ativa) = 1, 'chave trocada marca o certificado para reenvio');

-- ── permissões ─────────────────────────────────────────────────────────────
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', 'public.rnds_registrar_certificado(uuid, text, text, text, timestamptz, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.rnds_certificado_da_unidade(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.rnds_registrar_chave_publica(text, jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.rnds_painel(uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.rnds_certificado_da_unidade(uuid)', 'EXECUTE'),
  'o cofre só sai para a chave de serviço; anônimo não vê o painel');
SELECT pg_temp.ok((SELECT count(*) FROM cron.job WHERE jobname = 'rnds-avisos-certificado' AND schedule = '0 11 * * *') = 1,
  'avisos de vencimento às 08:00 de Brasília');

ROLLBACK;
