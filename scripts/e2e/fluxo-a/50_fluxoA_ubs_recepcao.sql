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

-- PASSO 1 · UBS, recepção: cadastra e põe na fila (tela Recepção → registrar_ficha)
CREATE FUNCTION pg_temp.ficha(p_pac text, p_setor uuid, p_queixa text, p_dados jsonb, p_prio text[] DEFAULT '{}') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, 'ubs.recepcao.ficha', format(
    'SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb, %L::text[], false)::text', p_setor, p_queixa,
    jsonb_build_object('nome', 'Teste Fluxo ' || p_pac, 'categoria', 'sus', 'municipio', 'Aparecida de Goiânia', 'uf', 'GO') || p_dados, p_prio)) $$;

-- caminhos errados antes (nada pode gravar)
SELECT pg_temp.passo('A01', 'erro.sem_tipo', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Dor no peito', '{"nome":"Teste Fluxo A01","data_nascimento":"1981-03-10"}'), 'tipo de atendimento');
SELECT pg_temp.passo('A01', 'erro.sem_nascimento', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Dor no peito', '{"nome":"Teste Fluxo A01","tipo_atendimento":"escuta_inicial"}'), 'data de nascimento');
SELECT pg_temp.passo('A01', 'erro.cpf_invalido', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Dor no peito', '{"nome":"Teste Fluxo A01","tipo_atendimento":"escuta_inicial","data_nascimento":"1981-03-10","cpf":"90002500199"}'), 'CPF inválido');
SELECT pg_temp.passo('A01', 'erro.setor_que_nao_e_porta', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', '32000000-0000-4000-8000-000000000002', 'Dor no peito', '{"nome":"Teste Fluxo A01","data_nascimento":"1981-03-10"}'), 'porta');
SELECT pg_temp.passo('A01', 'erro.nascimento_futuro', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Dor no peito', '{"nome":"Teste Fluxo A01","tipo_atendimento":"escuta_inicial","data_nascimento":"2027-03-10"}'), 'futuro');
SELECT pg_temp.passo('A01', 'erro.queixa_curta', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'a', '{"nome":"Teste Fluxo A01","tipo_atendimento":"escuta_inicial","data_nascimento":"1981-03-10"}'), 'queixa');

SELECT pg_temp.ficha('A01', pg_temp.c1(), 'Dor no peito há 40 minutos, com suor frio', '{"data_nascimento":"1981-03-10","sexo":"M","cpf":"90002500132","cns":"700251125000107","nome_mae":"Mãe Teste A01","telefone":"62999990001","raca_cor":"parda","tipo_atendimento":"escuta_inicial","destino":"medico"}');
SELECT pg_temp.ficha('A02', pg_temp.c1(), 'Falta de ar que piorou desde ontem', '{"data_nascimento":"1954-07-22","sexo":"F","cpf":"90002500213","cns":"700251125000204","nome_mae":"Mãe Teste A02","raca_cor":"branca","tipo_atendimento":"escuta_inicial","destino":"medico"}', '{idoso_60}');
SELECT pg_temp.ficha('A03', pg_temp.c1(), 'Febre há 3 dias e cansaço para respirar', '{"data_nascimento":"2020-05-14","sexo":"M","cns":"700251125000301","nome_mae":"Mãe Teste A03","responsavel_nome":"Mãe Teste A03","responsavel_parentesco":"mãe","raca_cor":"preta","tipo_atendimento":"escuta_inicial","destino":"medico","cpf_justificativa":"9"}');
SELECT pg_temp.ficha('A04', pg_temp.c1(), 'Gestante com sangramento e dor na barriga', '{"data_nascimento":"1998-09-02","sexo":"F","cpf":"90002500485","cns":"700251125000409","nome_mae":"Mãe Teste A04","raca_cor":"parda","tipo_atendimento":"escuta_inicial","destino":"medico"}', '{gestante}');
SELECT pg_temp.ficha('A05', pg_temp.c1(), 'Dor forte na barriga do lado direito desde a madrugada', '{"data_nascimento":"1992-01-30","sexo":"F","cpf":"90002500566","nome_mae":"Mãe Teste A05","raca_cor":"amarela","tipo_atendimento":"consulta_no_dia","destino":"medico"}');
SELECT pg_temp.ficha('A06', pg_temp.c1(), 'Familiar conta boca torta e fala enrolada há 1 hora', '{"data_nascimento":"1945-11-11","sexo":"M","cpf":"90002500647","cns":"700251125000603","nome_mae":"Mãe Teste A06","raca_cor":"branca","tipo_atendimento":"escuta_inicial","destino":"medico"}');
SELECT pg_temp.ficha('A07', pg_temp.c2(), 'Criança teve convulsão com febre em casa', '{"data_nascimento":"2024-08-19","sexo":"F","nome_mae":"Mãe Teste A07","responsavel_nome":"Mãe Teste A07","responsavel_parentesco":"mãe","raca_cor":"parda","tipo_atendimento":"atendimento_urgencia","destino":"medico","cpf_justificativa":"9"}', '{lactante_crianca_colo}');
SELECT pg_temp.ficha('A08', pg_temp.c2(), 'Dor de cabeça forte e pressão alta medida em casa', '{"data_nascimento":"1968-04-05","sexo":"M","cpf":"90002500809","cns":"700251125000808","nome_mae":"Mãe Teste A08","raca_cor":"preta","tipo_atendimento":"consulta_agendada","destino":"medico"}');
SELECT pg_temp.ficha('A09', pg_temp.c2(), 'Chiado no peito e tosse desde ontem à noite', '{"data_nascimento":"2012-11-27","sexo":"F","cpf":"90002500990","cns":"700251125000905","nome_mae":"Mãe Teste A09","responsavel_nome":"Mãe Teste A09","responsavel_parentesco":"mãe","raca_cor":"indigena","tipo_atendimento":"escuta_inicial","destino":"medico"}');
SELECT pg_temp.ficha('A10', pg_temp.c2(), 'Corte fundo na mão com faca há 2 horas', '{"data_nascimento":"2003-06-18","sexo":"M","cpf":"90002501023","nome_mae":"Mãe Teste A10","raca_cor":"sem_informacao","tipo_atendimento":"escuta_inicial","destino":"medico"}');

-- caminhos errados depois (ação repetida)
SELECT pg_temp.passo('A01', 'erro.ficha_repetida', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Dor no peito', '{"nome":"Teste Fluxo A01","tipo_atendimento":"escuta_inicial","data_nascimento":"1981-03-10"}'), 'FICHA_DUPLICATA_PROVAVEL');
SELECT pg_temp.passo('A01', 'erro.cpf_repetido', format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.c1(), 'Outra queixa', '{"nome":"Teste Fluxo A99","tipo_atendimento":"escuta_inicial","data_nascimento":"1990-01-01","cpf":"90002500132"}'), 'FICHA_DUPLICATA_DOCUMENTO');
SELECT pg_temp.passo('A01', 'erro.mesmo_paciente_de_novo', format('SELECT public.registrar_ficha(%L::uuid, %L, (SELECT paciente_id FROM public.episodios WHERE id = %L), %L::jsonb)::text', pg_temp.c1(), 'Outra queixa', pg_temp.epi('A01', pg_temp.ubs()), '{"tipo_atendimento":"consulta_no_dia"}'), 'FICHA_EPISODIO_ABERTO');

-- conferência
INSERT INTO _log (pac, passo, ok, saida)
SELECT replace(p.nome, 'Teste Fluxo ', ''), 'confere.episodio', true, concat_ws(' · ', e.etapa, e.tipo_atendimento_aps, e.destino_aps, s.nome, 'prio=' || array_to_string(e.prioridades_legais, ','), 'pront=' || p.prontuario, 'publico=' || coalesce(e.publico, '-'))
  FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id JOIN public.setores s ON s.id = e.setor_id
 WHERE e.unidade_id = pg_temp.ubs() AND p.nome LIKE 'Teste Fluxo A%' ORDER BY p.nome;

CREATE TEMP TABLE _res ON COMMIT DROP AS SELECT (to_jsonb(l) - 'n') res FROM _log l ORDER BY n;
--FIM
SELECT jsonb_agg(res) todos FROM _res;
COMMIT;
