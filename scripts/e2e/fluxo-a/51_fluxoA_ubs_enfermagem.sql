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

-- PASSO 2 · UBS, enfermagem.
-- Técnico de enfermagem: sinais vitais (tela Sinais vitais → registrar_sinais_aps). COFEN: o técnico afere, não classifica.
-- Enfermeiro: escuta inicial com a classificação do CAB 28 (tela Escuta inicial → registrar_escuta_aps).
CREATE FUNCTION pg_temp.sinais(p_pac text, p_sinais jsonb) RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, 'ubs.tecnico.sinais', format('SELECT public.registrar_sinais_aps(%L::uuid, %L::jsonb)::text', pg_temp.epi(p_pac, pg_temp.ubs()), p_sinais)) $$;
CREATE FUNCTION pg_temp.escuta(p_pac text, p_cor text, p_saida text, p_sinais jsonb DEFAULT '{}', p_obs text DEFAULT NULL, p_dum date DEFAULT NULL, p_espera text DEFAULT NULL, p_nome text DEFAULT 'ubs.enfermeiro.escuta') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.registrar_escuta_aps(%L::uuid, %L, %L, NULL, %L::jsonb, NULL, %L, %L::date)::text', pg_temp.epi(p_pac, pg_temp.ubs()), p_cor, p_saida, p_sinais, p_obs, p_dum), p_espera) $$;

-- técnico: sinais de todos
SELECT pg_temp.sinais('A01', '{"pressao-arterial-sistolica":168,"pressao-arterial-diastolica":102,"frequencia-cardiaca":112,"frequencia-respiratoria":22,"temperatura":36.4,"saturacao-o2":94,"peso":88,"estatura":172}');
SELECT pg_temp.sinais('A02', '{"pressao-arterial-sistolica":138,"pressao-arterial-diastolica":84,"frequencia-cardiaca":104,"frequencia-respiratoria":28,"temperatura":37.1,"saturacao-o2":89,"peso":61,"estatura":156}');
SELECT pg_temp.sinais('A03', '{"frequencia-cardiaca":142,"frequencia-respiratoria":44,"temperatura":39.2,"saturacao-o2":91,"peso":21.5,"estatura":116}');
SELECT pg_temp.sinais('A04', '{"pressao-arterial-sistolica":152,"pressao-arterial-diastolica":98,"frequencia-cardiaca":108,"frequencia-respiratoria":20,"temperatura":36.8,"saturacao-o2":97,"peso":74,"estatura":162}');
SELECT pg_temp.sinais('A05', '{"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":76,"frequencia-cardiaca":102,"frequencia-respiratoria":18,"temperatura":38.3,"saturacao-o2":98,"peso":63,"estatura":165}');
SELECT pg_temp.sinais('A06', '{"pressao-arterial-sistolica":188,"pressao-arterial-diastolica":106,"frequencia-cardiaca":88,"frequencia-respiratoria":18,"temperatura":36.2,"saturacao-o2":95,"glicemia-capilar":132}');
SELECT pg_temp.sinais('A07', '{"frequencia-cardiaca":158,"frequencia-respiratoria":36,"temperatura":39.6,"saturacao-o2":96,"peso":11.2,"estatura":84,"glicemia-capilar":92}');
SELECT pg_temp.sinais('A08', '{"pressao-arterial-sistolica":212,"pressao-arterial-diastolica":124,"frequencia-cardiaca":92,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":97,"peso":94,"estatura":176,"circunferencia-abdominal":108}');
SELECT pg_temp.sinais('A09', '{"pressao-arterial-sistolica":108,"pressao-arterial-diastolica":66,"frequencia-cardiaca":118,"frequencia-respiratoria":30,"temperatura":36.9,"saturacao-o2":92,"peso":49,"estatura":158}');
SELECT pg_temp.sinais('A10', '{"pressao-arterial-sistolica":124,"pressao-arterial-diastolica":80,"frequencia-cardiaca":84,"frequencia-respiratoria":16,"temperatura":36.3,"saturacao-o2":99}');

-- caminhos errados da enfermagem
SELECT pg_temp.passo('A01', 'erro.sinal_desconhecido', format('SELECT public.registrar_sinais_aps(%L::uuid, %L::jsonb)::text', pg_temp.epi('A01', pg_temp.ubs()), '{"pressao":120}'), 'desconhecido');
SELECT pg_temp.passo('A01', 'erro.sinal_texto', format('SELECT public.registrar_sinais_aps(%L::uuid, %L::jsonb)::text', pg_temp.epi('A01', pg_temp.ubs()), '{"temperatura":"36,5"}'), 'sem número');
SELECT pg_temp.passo('A01', 'erro.sinais_vazio', format('SELECT public.registrar_sinais_aps(%L::uuid, %L::jsonb)::text', pg_temp.epi('A01', pg_temp.ubs()), '{}'), 'ao menos um');
SELECT pg_temp.escuta('A01', 'azul', 'consulta', '{}', NULL, NULL, 'azul', 'erro.azul_com_consulta');
SELECT pg_temp.escuta('A01', 'vermelho', 'orientacao', '{}', 'Orientado a voltar se piorar.', NULL, 'vai para a consulta', 'erro.vermelho_com_orientacao');
SELECT pg_temp.escuta('A01', 'laranja', 'consulta', '{}', NULL, NULL, 'CAB 28', 'erro.cor_fora_do_cab28');
SELECT pg_temp.escuta('A01', 'amarelo', 'consulta', '{}', NULL, (now() AT TIME ZONE 'America/Sao_Paulo')::date - 60, 'masculino', 'erro.dum_em_homem');
SELECT pg_temp.escuta('A10', 'azul', 'orientacao', '{}', 'curta', NULL, 'mínimo de 10', 'erro.azul_orientacao_curta');
SELECT pg_temp.escuta('A05', 'verde', 'consulta', '{}', NULL, NULL, 'não está aguardando a escuta', 'erro.escuta_de_quem_nao_esta_na_escuta');
SELECT pg_temp.escuta('A04', 'vermelho', 'consulta', '{}', NULL, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 3, 'futuro', 'erro.dum_futura');

-- enfermeiro: escuta inicial (A06 fica sem escuta: o médico é chamado e envia direto da escuta; A05, A07 e A08 não passam pela escuta)
SELECT pg_temp.escuta('A01', 'vermelho', 'consulta', '{"escala-dor":9}');
SELECT pg_temp.escuta('A02', 'amarelo', 'consulta', '{"escala-dor":2}');
SELECT pg_temp.escuta('A03', 'amarelo', 'consulta');
SELECT pg_temp.escuta('A04', 'vermelho', 'consulta', '{"escala-dor":7}', NULL, (now() AT TIME ZONE 'America/Sao_Paulo')::date - 212);
SELECT pg_temp.escuta('A09', 'verde', 'consulta');
SELECT pg_temp.escuta('A10', 'azul', 'atender_hoje', '{"escala-dor":4}');

-- ação repetida
SELECT pg_temp.escuta('A01', 'verde', 'consulta', '{}', NULL, NULL, 'não está aguardando a escuta', 'erro.escuta_repetida');

INSERT INTO _log (pac, passo, ok, saida)
SELECT replace(p.nome, 'Teste Fluxo ', ''), 'confere.episodio', true, concat_ws(' · ', e.etapa, 'cor=' || coalesce(e.cor_atual, '-'), 'publico=' || coalesce(e.publico, '-'),
        'sinais=' || (SELECT count(*) FROM public.observacao o WHERE o.episodio_id = e.id),
        'classif=' || (SELECT count(*) FROM public.classificacoes_risco c WHERE c.episodio_id = e.id),
        'gest=' || coalesce((SELECT c.gestacao::text FROM public.classificacoes_risco c WHERE c.episodio_id = e.id LIMIT 1), '-'))
  FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
 WHERE e.unidade_id = pg_temp.ubs() AND p.nome LIKE 'Teste Fluxo A%' ORDER BY p.nome;

CREATE TEMP TABLE _res ON COMMIT DROP AS SELECT (to_jsonb(l) - 'n') res FROM _log l ORDER BY n;
--FIM
SELECT jsonb_agg(res) todos FROM _res;
COMMIT;
