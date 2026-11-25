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

-- PASSO 5 · UPA, enfermeiro: classificação de risco (tela Triagem → Triar → classificar_risco).
-- Na UPA o técnico de enfermagem não tem ação na triagem (a classificação é privativa do enfermeiro, COFEN 661/2021).
CREATE FUNCTION pg_temp.flx(p_nome text, p_publico text) RETURNS uuid LANGUAGE sql AS $$
  SELECT f.id FROM public.protocolo_fluxogramas f WHERE f.protocolo_id = '57074ec9-8d8e-4d1f-8b44-b81f2e3215bd' AND f.nome = p_nome AND f.publico = p_publico $$;
-- primeiro discriminador da cor no fluxograma, como a tela lista (os que valem na unidade)
CREATE FUNCTION pg_temp.disc(p_flx uuid, p_cor text) RETURNS text LANGUAGE sql AS $$
  SELECT d ->> 0 FROM jsonb_each(private.discriminadores_efetivos(pg_temp.upa(), p_flx)) c, jsonb_array_elements(c.value) d WHERE c.key = p_cor LIMIT 1 $$;
CREATE FUNCTION pg_temp.triar(p_pac text, p_cor text, p_flx uuid, p_sinais jsonb, p_aval jsonb DEFAULT '{}', p_disc text DEFAULT NULL, p_livre boolean DEFAULT false,
                              p_gest jsonb DEFAULT NULL, p_espera text DEFAULT NULL, p_nome text DEFAULT 'upa.enfermeiro.classificar') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format(
    'SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_fluxograma => %L::uuid, p_discriminador => %L, p_avaliacao => %L::jsonb, p_publico => NULL, p_queixa => NULL, p_grupo_trocado => false, p_discriminador_livre => %L::boolean, p_dor => %L::jsonb, p_oxigenio => %L::jsonb, p_gestacao => %L::jsonb)::text',
    pg_temp.epi(p_pac, pg_temp.upa()), p_cor, p_sinais, p_flx, coalesce(p_disc, pg_temp.disc(p_flx, p_cor)), p_aval, p_livre,
    CASE WHEN p_sinais ? 'pressao-arterial-sistolica' THEN '{"escala":"numerica"}'::jsonb END, '{"modo":"ar_ambiente"}'::jsonb, p_gest), p_espera) $$;

-- (segunda parte: A09 e A10, classificados depois da conferência da tela de triagem)
SELECT pg_temp.triar('A09', 'amarelo', pg_temp.flx('Alterações respiratórias', 'pediatrico'), '{"frequencia-cardiaca":120,"frequencia-respiratoria":30,"temperatura":36.8,"saturacao-o2":92,"escala-dor":1,"peso":49}', '{}', 'Chiado/sibilância');
SELECT pg_temp.triar('A10', 'verde', pg_temp.flx('Alterações cutâneas', 'adulto'), '{"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":78,"frequencia-cardiaca":82,"frequencia-respiratoria":16,"temperatura":36.4,"saturacao-o2":99,"escala-dor":3}', '{}', 'Dor leve (1-3/10)');
SELECT pg_temp.triar('A10', 'amarelo', pg_temp.flx('Alterações cutâneas', 'adulto'), '{"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":78,"frequencia-cardiaca":82,"frequencia-respiratoria":16,"temperatura":36.4,"saturacao-o2":99,"escala-dor":5}', '{}', NULL, false, NULL, 'motivo da reclassificação', 'erro.reclassificar_sem_motivo');
INSERT INTO _log (pac, passo, ok, saida)
SELECT replace(p.nome, 'Teste Fluxo ', ''), 'confere.upa', e.etapa = 'atendimento' AND e.cor_atual IS NOT NULL,
       concat_ws(' · ', e.etapa, 'cor=' || e.cor_atual, 'publico=' || e.publico, (SELECT c.fluxograma_nome || ' / ' || c.discriminador || ' (cor do discriminador: ' || coalesce(c.discriminador_cor, 'livre') || ')' FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1))
  FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
 WHERE e.unidade_id = pg_temp.upa() AND p.nome LIKE 'Teste Fluxo A%' ORDER BY p.nome;

CREATE TEMP TABLE _res ON COMMIT DROP AS SELECT (to_jsonb(l) - 'n') res FROM _log l ORDER BY n;
--FIM
SELECT jsonb_agg(res) todos FROM _res;
COMMIT;
