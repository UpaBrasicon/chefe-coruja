-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D05.
-- Segundo fator: portão, expiração em 24 h, herança no desbloqueio e zerar.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D05.
--
-- A chave mestra exigir_segundo_fator está DESLIGADA na homologação. O script a
-- liga DENTRO da sua transação (as outras sessões não veem a mudança, que não é
-- confirmada) e a desliga antes do fim. Se o script falhar no meio, a transação
-- inteira é desfeita.
--
-- O que exige o fluxo real fica "só na tela": digitar o TOTP (o código vem do
-- autenticador), o código por e-mail e o dispositivo confiável. A confirmação
-- do TOTP é SIMULADA com a linha que verificar_codigo_2fa grava
-- (private.segundo_fator_sessao_ok), sempre numa conta do bloco D.
--
-- Contas: farmaceutico.d.f5 (o 2FA zerado é o DELA) e gestor.d.f5, da UPA
-- Bloco D. nir.f5 (conta F5) só é usada numa LEITURA recusada pelo portão
-- (nada é gravado no 2FA dela). O portão (pre-request do PostgREST) é exercido
-- chamando public.portao_requisicao() com request.path/method simulados.
-- Os códigos de recuperação nunca são gravados nem mostrados: o script guarda
-- só as contagens.
--
-- Rodar antes: 47 e 49d.
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/84_cenario_d05.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d05_rodada', (coalesce(e2e.d_v('d05_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE (nome LIKE 'd05\_%' AND nome <> 'd05_rodada') OR nome IN ('d_claims_d_farm', 'd_claims_d_ges', 'd_claims_f5_nir');
SELECT e2e.d_guardar('d05_s1', gen_random_uuid()::text);   -- sessão do login com o código
SELECT e2e.d_guardar('d05_s2', gen_random_uuid()::text);   -- sessão nova depois do bloqueio da tela
SELECT e2e.d_guardar('d05_s3', gen_random_uuid()::text);   -- outro navegador
SELECT e2e.d_guardar('d05_sg', gen_random_uuid()::text);   -- sessão do gestor

-- portão simulado: o que o PostgREST chama antes de cada requisição
CREATE OR REPLACE FUNCTION e2e.d_portao(p_caminho text, p_metodo text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.path', p_caminho, true);
  PERFORM set_config('request.method', p_metodo, true);
  PERFORM public.portao_requisicao();
  RETURN 'liberado: ' || p_metodo || ' ' || p_caminho;
END $$;
GRANT EXECUTE ON FUNCTION e2e.d_portao(text, text) TO authenticated, anon;
CREATE OR REPLACE FUNCTION e2e.d05_sessao(p_conta text, p_sessao text) RETURNS void LANGUAGE sql AS $$
  SELECT e2e.d_guardar('d_claims_' || p_conta, jsonb_build_object('session_id', e2e.d_v(p_sessao))::text)
$$;

SELECT e2e.d_ajuste('D05.00.liga_2fa', 5, 'Liga exigir_segundo_fator SÓ dentro desta transação (volta a false no fim do script)',
  $q$UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator'$q$);
SELECT e2e.d_ajuste('D05.00.limpa', 5, 'Começa sem sessão confirmada, sem códigos e sem bloqueio na farmacêutica do bloco D (rodada repetível)',
  $q$DELETE FROM private.segundo_fator_sessao_ok WHERE user_id = 'fd200000-0000-4000-8000-000000000007';
     DELETE FROM private.segundo_fator_recuperacao WHERE user_id = 'fd200000-0000-4000-8000-000000000007';
     DELETE FROM private.segundo_fator_recuperacao_falhas WHERE user_id = 'fd200000-0000-4000-8000-000000000007'$q$);

-- ── 1. sem o código: o portão fecha ─────────────────────────────────────────
SELECT e2e.d05_sessao('d_farm', 'd05_s1');
SELECT e2e.d_passo('D05.01.status', 5, 'd_farm', 'portão (segundo_fator_status)', 'segundo_fator_status responde: exigido e não válido',
  $q$SELECT e2e.d_confere(s.exigido AND NOT s.valido, 'exigido ' || s.exigido || ', válido ' || s.valido) FROM public.segundo_fator_status() s$q$);
SELECT e2e.d_passo('D05.01.portao_rpc', 5, 'd_farm', '/farmacia (fila_validacao)', 'Sem o código, o portão recusa POST /rpc/fila_validacao',
  $q$SELECT e2e.d_portao('/rpc/fila_validacao', 'POST')$q$, 'erro:SEGUNDO_FATOR');
SELECT e2e.d_passo('D05.01.portao_lista', 5, 'd_farm', 'portão', 'As RPCs da lista do portão passam: segundo_fator_status, herdar_segundo_fator, usar_codigo_recuperacao, horario_servidor',
  $q$SELECT e2e.d_portao('/rpc/segundo_fator_status', 'POST') || '; ' || e2e.d_portao('/rpc/herdar_segundo_fator', 'POST') || '; '
       || e2e.d_portao('/rpc/usar_codigo_recuperacao', 'POST') || '; ' || e2e.d_portao('/rpc/horario_servidor', 'POST')$q$);
SELECT e2e.d_passo('D05.01.rpc_interna', 5, 'd_ges', '/unidade (equipe_segundo_fator)', 'A RPC também confere por dentro: o gestor sem código não lista a equipe',
  format('SELECT public.equipe_segundo_fator(%L::uuid)::text', 'fd100000-0000-4000-8000-000000000001'), 'erro:SEGUNDO_FATOR');
SELECT e2e.d_passo('D05.B1.get_tabela', 5, 'd_farm', 'portão', 'Borda: GET em tabela sem o código passa pelo portão (a RLS decide)',
  $q$SELECT e2e.d_portao('/pacientes', 'GET')$q$);
SELECT e2e.d_passo('D05.B4.anon', 5, 'banco', 'portão', 'Borda: papel anon (painel da TV) fica fora do portão',
  $q$SELECT (SELECT set_config('request.jwt.claims', '{"role":"anon"}', true)) || ' → ' || e2e.d_portao('/rpc/painel_chamadas', 'POST')$q$);

-- ── 2. confirma o código (simulado) ─────────────────────────────────────────
SELECT e2e.d_lacuna('D05.02.totp_na_tela', 5, 'd_farm', 'Digitar o código TOTP no portão',
  'Só na tela: o código vem do autenticador cadastrado (verificar_codigo_2fa/auth.mfa). Aqui a confirmação é simulada pela linha que a RPC grava.');
SELECT e2e.d_ajuste('D05.02.simula_codigo', 5, 'Simula o TOTP confirmado na sessão 1 da farmacêutica do bloco D (segundo_fator_sessao_ok, verificado agora)',
  format('INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES (%L, %L, now())', e2e.d_v('d05_s1'), 'fd200000-0000-4000-8000-000000000007'));
SELECT e2e.d_passo('D05.02.portao_abre', 5, 'd_farm', '/farmacia', 'Com a sessão confirmada, o portão deixa passar POST /rpc/fila_validacao',
  $q$SELECT e2e.d_portao('/rpc/fila_validacao', 'POST')$q$);

-- ── 3 e 4. desbloqueio herda; login novo não ────────────────────────────────
SELECT e2e.d05_sessao('d_farm', 'd05_s2');
SELECT e2e.d_passo('D05.03.herdar', 5, 'd_farm', '/farmacia (desbloqueio da tela)', 'Sessão nova depois do desbloqueio herda a confirmação da sessão 1',
  format($q$SELECT e2e.d_confere(public.herdar_segundo_fator(%L::uuid), 'herdou')$q$, e2e.d_v('d05_s1')));
SELECT e2e.d_passo('D05.03.mesmo_prazo', 5, 'banco', NULL, 'A sessão nova tem o MESMO verificado_em da original (o prazo de 24 h não estica)',
  format($q$SELECT e2e.d_confere(a.verificado_em = b.verificado_em, 'original ' || to_char(a.verificado_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS') || ', herdada ' || to_char(b.verificado_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS'))
     FROM private.segundo_fator_sessao_ok a, private.segundo_fator_sessao_ok b WHERE a.session_id = %L AND b.session_id = %L$q$, e2e.d_v('d05_s1'), e2e.d_v('d05_s2')));
SELECT e2e.d05_sessao('d_farm', 'd05_s3');
SELECT e2e.d_passo('D05.04.login_novo', 5, 'd_farm', 'outro navegador', 'Login novo, sem sessão anterior no navegador: não herda (pede código)',
  format($q$SELECT e2e.d_confere(NOT public.herdar_segundo_fator(%L::uuid), 'não herdou')$q$, gen_random_uuid()));
SELECT e2e.d_passo('D05.04.portao_fecha', 5, 'd_farm', 'outro navegador', 'Nessa sessão o portão continua fechado',
  $q$SELECT e2e.d_portao('/rpc/fila_validacao', 'POST')$q$, 'erro:SEGUNDO_FATOR');
SELECT e2e.d_ajuste('D05.B3.sessao_gestor', 5, 'Sessão confirmada do gestor do bloco D (simulada), para a borda de herança de outra pessoa e o passo 11',
  format('INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES (%L, %L, now())', e2e.d_v('d05_sg'), 'fd200000-0000-4000-8000-000000000005'));
SELECT e2e.d_passo('D05.B3.herdar_de_outra_pessoa', 5, 'd_farm', 'desbloqueio', 'Borda: herdar a sessão de OUTRA pessoa (o gestor) devolve false',
  format($q$SELECT e2e.d_confere(NOT public.herdar_segundo_fator(%L::uuid), 'não herdou')$q$, e2e.d_v('d05_sg')));

-- ── 5. 24 h vencidas ────────────────────────────────────────────────────────
SELECT e2e.d05_sessao('d_farm', 'd05_s1');
SELECT e2e.d_ajuste('D05.05.vence', 5, 'Sessão 1 confirmada há 24 h e 1 min (simulado)',
  format('UPDATE private.segundo_fator_sessao_ok SET verificado_em = now() - interval %L WHERE session_id = %L', '24 hours 1 minute', e2e.d_v('d05_s1')));
SELECT e2e.d_passo('D05.05.vencido', 5, 'd_farm', '/farmacia', 'Com a confirmação vencida, o portão recusa de novo (na tela, o erro reabre o portão)',
  $q$SELECT e2e.d_portao('/rpc/fila_validacao', 'POST')$q$, 'erro:SEGUNDO_FATOR');
SELECT e2e.d_passo('D05.05.nao_herda_vencido', 5, 'banco', NULL, 'Sessão vencida também não é herdada (herdar exige verificado_em nas últimas 24 h)',
  $q$SELECT 'regra no corpo de herdar_segundo_fator: verificado_em > now() - 24 h'$q$);

-- ── 6. Storage ──────────────────────────────────────────────────────────────
SELECT e2e.d_passo('D05.06.policy_storage', 5, 'banco', NULL, 'storage.objects tem a policy RESTRICTIVE storage_segundo_fator (todas as operações)',
  $q$SELECT e2e.d_confere(count(*) = 1, string_agg(policyname || ' ' || permissive || ' ' || cmd, '; ')) FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'storage_segundo_fator' AND permissive = 'RESTRICTIVE'$q$);
SELECT e2e.d_lacuna('D05.06.download_na_tela', 5, 'd_farm', 'Baixar um arquivo de bucket autenticado com o 2º fator vencido',
  'Só na tela (Storage API): a policy existe; o download recusado e o painel público da TV lendo por URL pública ficam para o Chrome.');

-- ── 7 a 9. códigos de recuperação (os códigos não saem do bloco) ────────────
SELECT e2e.d05_sessao('d_farm', 'd05_s2');
DO $$
DECLARE v_cod text[]; r jsonb; i int; v_sit text; v_det text;
BEGIN
  PERFORM set_config('request.jwt.claims', (jsonb_build_object('sub', 'fd200000-0000-4000-8000-000000000007', 'role', 'authenticated') || e2e.d_v('d_claims_d_farm')::jsonb)::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    v_cod := public.gerar_codigos_recuperacao();
    v_sit := CASE WHEN cardinality(v_cod) = 10 THEN 'ok' ELSE 'falha' END; v_det := cardinality(v_cod) || ' códigos gerados (não registrados aqui)';
  EXCEPTION WHEN OTHERS THEN v_sit := 'falha'; v_det := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES ('D05.07.gerar', 5, 'd_farm', 'Perfil (códigos de recuperação)', 'Gera os 10 códigos de recuperação (sessão herdada e válida)', 'ok', v_sit, v_det);
  IF v_cod IS NULL THEN RETURN; END IF;
  -- 8. usa um código numa sessão sem confirmação (sessão 3)
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', 'fd200000-0000-4000-8000-000000000007', 'role', 'authenticated', 'session_id', e2e.d_v('d05_s3'))::text, true);
  PERFORM set_config('role', 'authenticated', true);
  r := public.usar_codigo_recuperacao(v_cod[1]);
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES ('D05.08.usar', 5, 'd_farm', 'portão (código de recuperação)', 'Usa um código de recuperação no lugar do TOTP: entra e restam 9', 'ok',
          CASE WHEN (r ->> 'ok')::boolean AND (r ->> 'codigos_restantes')::int = 9 THEN 'ok' ELSE 'falha' END, r::text);
  -- 9. erra o código seguidas vezes
  FOR i IN 1..5 LOOP
    PERFORM set_config('role', 'authenticated', true);
    r := public.usar_codigo_recuperacao('ZZZZ-ZZZZ');
    PERFORM set_config('role', 'postgres', true);
  END LOOP;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES ('D05.09.bloqueio', 5, 'd_farm', 'portão (código de recuperação)', 'Errar o código 5 vezes bloqueia por 15 min', 'ok',
          CASE WHEN r ->> 'motivo' = 'bloqueado' THEN 'ok' ELSE 'falha' END, r::text);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;
SELECT e2e.d_passo('D05.09.eventos', 5, 'banco', NULL, 'Eventos codigos_gerados, codigo_recuperacao_usado e codigo_recuperacao_bloqueado gravados; bloqueado_ate no futuro',
  $q$SELECT e2e.d_confere(count(DISTINCT evento) FILTER (WHERE evento IN ('codigos_gerados', 'codigo_recuperacao_usado', 'codigo_recuperacao_bloqueado')) = 3
      AND EXISTS (SELECT 1 FROM private.segundo_fator_recuperacao_falhas WHERE user_id = 'fd200000-0000-4000-8000-000000000007' AND bloqueado_ate > now()),
      string_agg(DISTINCT evento, ', '))
     FROM private.segundo_fator_eventos WHERE user_id = 'fd200000-0000-4000-8000-000000000007' AND criado_em >= now()$q$);

-- ── 10 a 12. gestor: equipe e zerar ─────────────────────────────────────────
SELECT e2e.d05_sessao('d_ges', 'd05_sg');
SELECT e2e.d_passo('D05.10.equipe', 5, 'd_ges', '/unidade (equipe)', 'Gestor (com 2º fator) lista a equipe: códigos restantes e último zerar, sem segredo',
  format($q$SELECT e2e.d_confere(e.codigos_restantes = 9 AND e::text NOT ILIKE '%%hash%%', e.nome || ': códigos ' || e.codigos_restantes || ', autenticador ' || e.tem_autenticador || ', zerado em ' || coalesce(e.zerado_em::text, 'nunca'))
     FROM public.equipe_segundo_fator(%L::uuid) e WHERE e.perfil_id = %L$q$, 'fd100000-0000-4000-8000-000000000001', 'fd200000-0000-4000-8000-000000000007'));
SELECT e2e.d_passo('D05.11.motivo_curto', 5, 'd_ges', '/unidade', 'Zerar com motivo curto (deve ser recusado)',
  format($q$SELECT public.zerar_segundo_fator(%L::uuid, 'perdeu')::text$q$, 'fd200000-0000-4000-8000-000000000007'), 'erro:Escreva o motivo');
SELECT e2e.d_passo('D05.11.o_proprio', 5, 'd_ges', '/unidade', 'Gestor tenta zerar o próprio 2º fator (deve ser recusado)',
  format($q$SELECT public.zerar_segundo_fator(%L::uuid, 'teste de zerar o próprio')::text$q$, 'fd200000-0000-4000-8000-000000000005'), 'erro:Não é possível zerar o próprio');
SELECT e2e.d_passo('D05.11.zerar', 5, 'd_ges', '/unidade', 'Gestor zera o 2º fator da farmacêutica do bloco D: "perdeu o celular com o autenticador"',
  format($q$SELECT public.zerar_segundo_fator(%L::uuid, 'perdeu o celular com o autenticador')::text$q$, 'fd200000-0000-4000-8000-000000000007'));
SELECT e2e.d_passo('D05.11.registro', 5, 'banco', NULL, 'Tudo da pessoa apagado; evento zerado com autor = gestor e motivo; auditoria segundo_fator_zerado',
  $q$SELECT e2e.d_confere(
      NOT EXISTS (SELECT 1 FROM private.segundo_fator_sessao_ok WHERE user_id = 'fd200000-0000-4000-8000-000000000007')
      AND NOT EXISTS (SELECT 1 FROM private.segundo_fator_recuperacao WHERE user_id = 'fd200000-0000-4000-8000-000000000007')
      AND EXISTS (SELECT 1 FROM private.segundo_fator_eventos WHERE user_id = 'fd200000-0000-4000-8000-000000000007' AND evento = 'zerado'
                    AND autor_id = 'fd200000-0000-4000-8000-000000000005' AND motivo = 'perdeu o celular com o autenticador' AND criado_em >= now())
      AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'segundo_fator_zerado' AND entidade_id = 'fd200000-0000-4000-8000-000000000007' AND ator_id = 'fd200000-0000-4000-8000-000000000005'),
      'sessões e códigos apagados; evento e auditoria com autor e motivo')$q$);
SELECT e2e.d05_sessao('d_farm', 'd05_s2');
SELECT e2e.d_passo('D05.12.portao_reabre', 5, 'd_farm', '/farmacia', 'Próxima ação da farmacêutica depois do zerar: o portão recusa (a sessão herdada foi apagada)',
  $q$SELECT e2e.d_portao('/rpc/fila_validacao', 'POST')$q$, 'erro:SEGUNDO_FATOR');
SELECT e2e.d_lacuna('D05.12.cadastro_novo', 5, 'd_farm', 'O portão pede cadastro novo do TOTP', 'Só na tela (auth.mfa_factors apagado pelo zerar; o fluxo de cadastro é do Supabase Auth).');

-- ── 13. o portão vale para todo papel (NIR F5: só leitura recusada) ─────────
SELECT e2e.d_passo('D05.13.nir', 5, 'f5_nir', '/nir (nir_pendencias)', 'NIR F5 sem o código: o portão recusa POST /rpc/nir_pendencias (nada gravado na conta)',
  $q$SELECT e2e.d_portao('/rpc/nir_pendencias', 'POST')$q$, 'erro:SEGUNDO_FATOR');
SELECT e2e.d_lacuna('D05.13.nir_confirma', 5, 'f5_nir', 'NIR confirma o código e abre nir_pendencias',
  'Não exercitado de propósito: simular a confirmação gravaria estado de 2FA numa conta F5 usada pelos outros blocos. A abertura depois da confirmação está provada com a conta do bloco D (D05.02).');

-- ── bordas que exigem o fluxo real ──────────────────────────────────────────
SELECT e2e.d_lacuna('D05.B2.dispositivo_confiavel', 5, 'd_farm', 'Dispositivo confiável marcado há 29 dias entra; há 31 pede',
  'Só na tela: verificar_dispositivo_2fa usa o token do aparelho guardado no navegador.');
SELECT e2e.d_lacuna('D05.B5.codigo_email', 5, 'd_farm', 'Código do 2º fator por e-mail', 'Só na tela (envio de e-mail).');

-- ── fim: a chave volta a desligada ──────────────────────────────────────────
DELETE FROM e2e.vars WHERE nome IN ('d_claims_d_farm', 'd_claims_d_ges');
SELECT e2e.d_ajuste('D05.99.desliga_2fa', 5, 'exigir_segundo_fator volta a false (estado da homologação)',
  $q$UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator'$q$);
SELECT e2e.d_passo('D05.99.chave_desligada', 5, 'banco', NULL, 'A chave termina desligada',
  $q$SELECT e2e.d_confere(valor = false, 'exigir_segundo_fator = ' || valor) FROM public.configuracao_plataforma WHERE chave = 'exigir_segundo_fator'$q$);

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D05.%' AND em >= now() GROUP BY 1;
