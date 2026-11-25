-- Teste de fluxo A (UBS → UPA), homologação, 25/11/2026. SÓ HOMOLOGAÇÃO.
-- Cada passo roda como o login teste.homolog (JWT simulado, role authenticated), chamando as RPCs das telas.
-- Os passos GRAVAM (o RT autorizou). Ensaio: troque a linha "--FIM" por um RAISE EXCEPTION (transação desfeita).
BEGIN;
DO $trava$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.configuracao_plataforma WHERE chave='ambiente_teste' AND valor::text='true') THEN
    RAISE EXCEPTION 'Só na homologação.'; END IF;
END $trava$;
CREATE TEMP TABLE _log (n serial, pac text, passo text, ok boolean, saida text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.eu() RETURNS uuid LANGUAGE sql AS $$ SELECT '757db1d9-589d-461c-bed6-24adfed1fa29'::uuid $$;
CREATE FUNCTION pg_temp.ubs() RETURNS uuid LANGUAGE sql AS $$ SELECT 'f2aa0e11-e57d-4f45-871d-12bedb152bec'::uuid $$;
CREATE FUNCTION pg_temp.upa() RETURNS uuid LANGUAGE sql AS $$ SELECT '31000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION pg_temp.c1() RETURNS uuid LANGUAGE sql AS $$ SELECT '4f86c512-06be-4663-b121-80c9fe773f78'::uuid $$;
CREATE FUNCTION pg_temp.c2() RETURNS uuid LANGUAGE sql AS $$ SELECT '225b35d5-a973-45ac-b729-95e9057f5b58'::uuid $$;
CREATE FUNCTION pg_temp.ps() RETURNS uuid LANGUAGE sql AS $$ SELECT '32000000-0000-4000-8000-000000000001'::uuid $$;
-- episódio mais recente do paciente de teste numa unidade
CREATE FUNCTION pg_temp.epi(p_pac text, p_unidade uuid) RETURNS uuid LANGUAGE sql AS $$
  SELECT e.id FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
   WHERE p.nome = 'Teste Fluxo ' || p_pac AND e.unidade_id = p_unidade ORDER BY e.chegada_em DESC LIMIT 1 $$;
-- envio à UPA mais recente do paciente de teste
CREATE FUNCTION pg_temp.env(p_pac text) RETURNS uuid LANGUAGE sql AS $$
  SELECT x.id FROM public.encaminhamentos_upa x WHERE x.resumo -> 'paciente' ->> 'nome' = 'Teste Fluxo ' || p_pac
     AND x.unidade_origem_id = pg_temp.ubs() ORDER BY x.enviado_em DESC LIMIT 1 $$;
-- roda um passo como o usuário; p_espera = trecho do erro esperado (caminho errado) ou NULL (tem de passar)
CREATE FUNCTION pg_temp.passo(p_pac text, p_passo text, p_sql text, p_espera text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.eu(), 'role', 'authenticated', 'email', 'teste.homolog@chefecoruja.com.br')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE p_sql INTO v;
    PERFORM set_config('role', 'postgres', true);
    -- caminho errado que passou: desfaz o que ele gravou e registra a falha
    IF p_espera IS NOT NULL THEN RAISE EXCEPTION 'PASSOU_SEM_ERRO (esperava: %) · %', p_espera, left(coalesce(v, ''), 200); END IF;
    INSERT INTO _log (pac, passo, ok, saida) VALUES (p_pac, p_passo, true, left(coalesce(v, ''), 400));
  EXCEPTION WHEN others THEN
    PERFORM set_config('role', 'postgres', true);
    INSERT INTO _log (pac, passo, ok, saida) VALUES (p_pac, p_passo, p_espera IS NOT NULL AND SQLERRM NOT LIKE 'PASSOU_SEM_ERRO%' AND SQLERRM ILIKE '%' || p_espera || '%', left(SQLERRM, 400));
  END;
END $$;
-- deixa o login só com os papéis dados na unidade (para caminho errado de perfil); só em passo de ensaio, é desfeito pelo chamador
CREATE FUNCTION pg_temp.so_papeis(p_unidade uuid, p_papeis text[]) RETURNS void LANGUAGE sql AS $$
  UPDATE public.vinculos SET ativo = (papel::text = ANY (p_papeis)) WHERE perfil_id = pg_temp.eu() AND unidade_id = p_unidade $$;

-- CAMINHOS ERRADOS DE PERFIL E DE PLANTÃO · SÓ ENSAIO (transação desfeita; nunca rodar com COMMIT).
-- O login de teste tem todos os papéis; aqui cada bloco deixa ativo só o papel testado (pg_temp.so_papeis) e tenta
-- o que não é dele. Pacientes A91 a A93 existem só dentro desta transação.
DO $$ BEGIN IF current_setting('fluxoa.ensaio', true) IS DISTINCT FROM '1' THEN NULL; END IF; END $$;

-- preparo (com todos os papéis): duas fichas na UBS e uma na UPA
SELECT pg_temp.passo('A91', 'prep.ficha_ubs_escuta', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Tosse há 2 dias', '{"nome":"Teste Fluxo A91","data_nascimento":"1990-02-02","sexo":"F","tipo_atendimento":"escuta_inicial","cpf_justificativa":"8"}'));
SELECT pg_temp.passo('A92', 'prep.ficha_ubs_consulta', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Renovar receita', '{"nome":"Teste Fluxo A92","data_nascimento":"1985-03-03","sexo":"M","tipo_atendimento":"consulta_no_dia","cpf_justificativa":"8"}'));
SELECT pg_temp.passo('A93', 'prep.ficha_upa', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.ps(), 'Dor de garganta', '{"nome":"Teste Fluxo A93","data_nascimento":"1979-04-04","sexo":"M"}'));

-- o login de teste é super admin: dentro do ensaio deixa de ser, para os papéis valerem sozinhos
DELETE FROM public.super_admins WHERE perfil_id = pg_temp.eu();
-- ── UBS · só RECEPÇÃO ──
SELECT pg_temp.so_papeis(pg_temp.ubs(), '{recepcao}');
SELECT pg_temp.passo('A91', 'ubs.recepcao.tenta_escuta', format('SELECT public.registrar_escuta_aps(%L::uuid, %L, %L)::text', pg_temp.epi('A91', pg_temp.ubs()), 'verde', 'consulta'), 'do enfermeiro');
SELECT pg_temp.passo('A91', 'ubs.recepcao.tenta_sinais', format('SELECT public.registrar_sinais_aps(%L::uuid, %L::jsonb)::text', pg_temp.epi('A91', pg_temp.ubs()), '{"temperatura":36.5}'), 'registrados pelo');
SELECT pg_temp.passo('A92', 'ubs.recepcao.tenta_atender', format('SELECT public.iniciar_atendimento(%L::uuid)::text', pg_temp.epi('A92', pg_temp.ubs())), 'do médico');
SELECT pg_temp.passo('A91', 'ubs.recepcao.tenta_enviar_upa', format('SELECT public.encaminhar_upa(%L::uuid, %L::uuid, %L)::text', pg_temp.epi('A91', pg_temp.ubs()), pg_temp.upa(), 'Recepção tentando enviar à UPA'), 'médico de plantão');
SELECT pg_temp.passo('A01', 'ubs.recepcao.tenta_cancelar_envio', format('SELECT public.encaminhamento_upa_cancelar(%L::uuid, %L)::text', pg_temp.env('A01'), 'Recepção tentando cancelar'), 'Acesso negado');
-- o que a recepção da UBS lê direto das tabelas clínicas (RLS)
SELECT pg_temp.passo('-', 'ubs.recepcao.le_soap', format('SELECT count(*)::text FROM public.atendimento_registros WHERE unidade_id = %L', pg_temp.ubs()));
SELECT pg_temp.passo('-', 'ubs.recepcao.le_classificacao', format('SELECT count(*)::text FROM public.classificacoes_risco WHERE unidade_id = %L', pg_temp.ubs()));
SELECT pg_temp.passo('-', 'ubs.recepcao.le_sinais', format('SELECT count(*)::text FROM public.observacao WHERE unidade_id = %L', pg_temp.ubs()));
SELECT pg_temp.passo('-', 'ubs.recepcao.le_envios_da_unidade', format('SELECT jsonb_array_length(public.encaminhamentos_upa_origem(%L::uuid, 30))::text', pg_temp.ubs()));
SELECT pg_temp.passo('-', 'ubs.recepcao.le_retornos', format('SELECT jsonb_array_length(public.contrarreferencias_da_unidade(%L::uuid, 30))::text', pg_temp.ubs()));

-- ── UBS · só TÉCNICO DE ENFERMAGEM ──
SELECT pg_temp.so_papeis(pg_temp.ubs(), '{tecnico_enfermagem}');
SELECT pg_temp.passo('A91', 'ubs.tecnico.sinais', format('SELECT public.registrar_sinais_aps(%L::uuid, %L::jsonb)::text', pg_temp.epi('A91', pg_temp.ubs()), '{"temperatura":36.5}'));
SELECT pg_temp.passo('A91', 'ubs.tecnico.tenta_escuta', format('SELECT public.registrar_escuta_aps(%L::uuid, %L, %L)::text', pg_temp.epi('A91', pg_temp.ubs()), 'verde', 'consulta'), 'do enfermeiro');
SELECT pg_temp.passo('A92', 'ubs.tecnico.tenta_atender', format('SELECT public.iniciar_atendimento(%L::uuid)::text', pg_temp.epi('A92', pg_temp.ubs())), 'do médico');
SELECT pg_temp.passo('A93', 'ubs.tecnico.tenta_ficha', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Ficha pelo técnico', '{"nome":"Teste Fluxo A94","data_nascimento":"1990-02-02","tipo_atendimento":"consulta_no_dia"}'));

-- ── UBS · só ENFERMEIRO ──
SELECT pg_temp.so_papeis(pg_temp.ubs(), '{enfermeiro}');
SELECT pg_temp.passo('A91', 'ubs.enfermeiro.tenta_enviar_upa', format('SELECT public.encaminhar_upa(%L::uuid, %L::uuid, %L)::text', pg_temp.epi('A91', pg_temp.ubs()), pg_temp.upa(), 'Enfermeiro tentando enviar à UPA'), 'médico de plantão');
SELECT pg_temp.passo('A92', 'ubs.enfermeiro.tenta_atender_ficha_do_medico', format('SELECT public.iniciar_atendimento(%L::uuid)::text', pg_temp.epi('A92', pg_temp.ubs())), 'do médico');
SELECT pg_temp.passo('A91', 'ubs.enfermeiro.escuta', format('SELECT public.registrar_escuta_aps(%L::uuid, %L, %L)::text', pg_temp.epi('A91', pg_temp.ubs()), 'verde', 'consulta'));

-- ── UBS · só MÉDICO ──
SELECT pg_temp.so_papeis(pg_temp.ubs(), '{plantonista}');
SELECT pg_temp.passo('A91', 'ubs.medico.tenta_reclassificar_escuta', format('SELECT public.registrar_escuta_aps(%L::uuid, %L, %L)::text', pg_temp.epi('A91', pg_temp.ubs()), 'amarelo', 'consulta'), 'enfermeiro');
SELECT pg_temp.passo('-', 'ubs.medico.tenta_montar_escala', format('SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, current_date + 3, %L)::text', pg_temp.ubs(), pg_temp.c1(), pg_temp.eu(), 'manha'), 'apenas o gestor');
-- sem papel nenhum na UPA, o médico da UBS tenta ver a UPA
SELECT pg_temp.so_papeis(pg_temp.upa(), '{}');
SELECT pg_temp.passo('-', 'ubs.medico.tenta_ver_painel_da_upa', format('SELECT public.encaminhamentos_upa_destino(%L::uuid)::text', pg_temp.upa()), 'Acesso negado');
SELECT pg_temp.passo('A01', 'ubs.medico.tenta_marcar_chegada_na_upa', format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, false, NULL, %L)::text', pg_temp.env('A01'), 'UBS marcando a chegada da UPA'), 'unidade de destino');
SELECT pg_temp.passo('A93', 'ubs.medico.tenta_atender_na_upa', format('SELECT public.iniciar_atendimento(%L::uuid)::text', pg_temp.epi('A93', pg_temp.upa())), 'Acesso negado');
SELECT pg_temp.passo('-', 'ubs.medico.le_pacientes_da_upa', format('SELECT count(*)::text FROM public.pacientes WHERE unidade_id = %L', pg_temp.upa()));
SELECT pg_temp.passo('-', 'ubs.medico.le_episodios_da_upa', format('SELECT count(*)::text FROM public.episodios WHERE unidade_id = %L', pg_temp.upa()));
SELECT pg_temp.passo('-', 'ubs.medico.le_soap_da_upa', format('SELECT count(*)::text FROM public.atendimento_registros WHERE unidade_id = %L', pg_temp.upa()));

-- ── UPA · só RECEPÇÃO (e nada na UBS) ──
SELECT pg_temp.so_papeis(pg_temp.ubs(), '{}');
SELECT pg_temp.so_papeis(pg_temp.upa(), '{recepcao}');
SELECT pg_temp.passo('-', 'upa.recepcao.ve_painel', format('SELECT jsonb_array_length(public.encaminhamentos_upa_destino(%L::uuid))::text', pg_temp.upa()));
SELECT pg_temp.passo('A93', 'upa.recepcao.tenta_classificar', format('SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_fluxograma => %L::uuid, p_discriminador => %L)::text', pg_temp.epi('A93', pg_temp.upa()), 'verde',
  '{"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80,"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2}', (SELECT id FROM public.protocolo_fluxogramas WHERE protocolo_id = '57074ec9-8d8e-4d1f-8b44-b81f2e3215bd' AND nome = 'Dor de garganta' AND publico = 'adulto'), 'x'), 'do enfermeiro');
SELECT pg_temp.passo('-', 'upa.recepcao.tenta_ver_envios_da_ubs', format('SELECT public.encaminhamentos_upa_origem(%L::uuid, 30)::text', pg_temp.ubs()), 'Acesso negado');
SELECT pg_temp.passo('-', 'upa.recepcao.tenta_ver_retornos_da_ubs', format('SELECT public.contrarreferencias_da_unidade(%L::uuid, 30)::text', pg_temp.ubs()), 'negado');
SELECT pg_temp.passo('-', 'upa.recepcao.le_pacientes_da_ubs', format('SELECT count(*)::text FROM public.pacientes WHERE unidade_id = %L', pg_temp.ubs()));
SELECT pg_temp.passo('-', 'upa.recepcao.le_soap_da_upa', format('SELECT count(*)::text FROM public.atendimento_registros WHERE unidade_id = %L', pg_temp.upa()));

-- ── UPA · só TÉCNICO ──
SELECT pg_temp.so_papeis(pg_temp.upa(), '{tecnico_enfermagem}');
SELECT pg_temp.passo('A93', 'upa.tecnico.tenta_classificar', format('SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_fluxograma => %L::uuid, p_discriminador => %L)::text', pg_temp.epi('A93', pg_temp.upa()), 'verde',
  '{"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80,"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2}', (SELECT id FROM public.protocolo_fluxogramas WHERE protocolo_id = '57074ec9-8d8e-4d1f-8b44-b81f2e3215bd' AND nome = 'Dor de garganta' AND publico = 'adulto'), 'x'), 'do enfermeiro');
SELECT pg_temp.passo('A93', 'upa.tecnico.tenta_chamar_para_triagem', format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', pg_temp.epi('A93', pg_temp.upa()), 'b92dc5f6-9ba4-4968-8e7b-eaa997bf36ac'), 'enfermagem');

-- ── UPA · só FATURAMENTO ──
SELECT pg_temp.so_papeis(pg_temp.upa(), '{faturamento}');
SELECT pg_temp.passo('-', 'upa.faturamento.tenta_ver_painel', format('SELECT public.encaminhamentos_upa_destino(%L::uuid)::text', pg_temp.upa()), 'Acesso negado');

-- ── FORA DO PLANTÃO: recepção da UBS sem escala hoje ──
SELECT pg_temp.so_papeis(pg_temp.ubs(), '{recepcao,enfermeiro,plantonista}');
UPDATE public.escala_plantao SET ativo = false WHERE unidade_id = pg_temp.ubs() AND perfil_id = pg_temp.eu();
SELECT pg_temp.passo('-', 'fora_do_plantao.ficha', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Fora do plantão', '{"nome":"Teste Fluxo A95","data_nascimento":"1990-02-02","tipo_atendimento":"consulta_no_dia"}'), 'não está de plantão');
SELECT pg_temp.passo('A92', 'fora_do_plantao.atender', format('SELECT public.iniciar_atendimento(%L::uuid)::text', pg_temp.epi('A92', pg_temp.ubs())), 'não está de plantão');
SELECT pg_temp.passo('A92', 'fora_do_plantao.sinais', format('SELECT public.registrar_sinais_aps(%L::uuid, %L::jsonb)::text', pg_temp.epi('A92', pg_temp.ubs()), '{"temperatura":36.5}'), 'não está de plantão');
SELECT pg_temp.passo('A92', 'fora_do_plantao.enviar_upa', format('SELECT public.encaminhar_upa(%L::uuid, %L::uuid, %L)::text', pg_temp.epi('A92', pg_temp.ubs()), pg_temp.upa(), 'Fora do plantão tentando enviar'), 'médico de plantão');

CREATE TEMP TABLE _res ON COMMIT DROP AS SELECT (to_jsonb(l) - 'n') res FROM _log l ORDER BY n;
--FIM
SELECT jsonb_agg(res) todos FROM _res;
ROLLBACK; -- este arquivo nunca grava: mexe nos vínculos e no super admin do login de teste
