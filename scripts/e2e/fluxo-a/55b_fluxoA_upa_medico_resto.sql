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

-- PASSO 6 (segunda parte) · UPA, médico: A07 a A10. Inclui a reclassificação pelo médico e o que a ficha da UPA
-- recebe do envio da UBS (a mesma leitura que a tela faz: encaminhamentos_upa_destino filtrado pela ficha).
CREATE FUNCTION pg_temp.m_iniciar(p_pac text, p_espera text DEFAULT NULL, p_nome text DEFAULT 'upa.medico.iniciar') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.iniciar_atendimento(%L::uuid)::text', pg_temp.epi(p_pac, pg_temp.upa())), p_espera) $$;
CREATE FUNCTION pg_temp.m_soap(p_pac text, s text, o text, a text, p text, p_cid text, p_espera text DEFAULT NULL, p_nome text DEFAULT 'upa.medico.soap') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', pg_temp.epi(p_pac, pg_temp.upa()), s, o, a, p, p_cid), p_espera) $$;
CREATE FUNCTION pg_temp.m_desfecho(p_pac text, p_desfecho text, p_relato text, p_det jsonb, p_espera text DEFAULT NULL, p_nome text DEFAULT 'upa.medico.desfecho') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', pg_temp.epi(p_pac, pg_temp.upa()), p_desfecho, p_relato, p_det), p_espera) $$;

-- o resumo da UBS que a ficha da UPA mostra (triagem e médico), um por paciente
SELECT pg_temp.passo(pac, 'upa.ficha.resumo_da_ubs', format($q$SELECT concat_ws(' · ', 'nº ' || (x ->> 'numero'), x ->> 'motivo', 'escuta=' || coalesce(x -> 'resumo' ->> 'cor_escuta', '-'),
    'sinais=' || coalesce((SELECT count(*) FROM jsonb_object_keys(coalesce(x -> 'resumo' -> 'sinais', '{}'::jsonb)))::text, '0'), 'soap=' || ((x -> 'resumo' -> 'soap') IS NOT NULL AND jsonb_typeof(x -> 'resumo' -> 'soap') = 'object'))
  FROM jsonb_array_elements(public.encaminhamentos_upa_destino(%L::uuid)) x WHERE x ->> 'situacao' = 'chegou' AND x ->> 'episodio_destino_id' = %L$q$, pg_temp.upa(), pg_temp.epi(pac, pg_temp.upa())))
  FROM unnest(ARRAY['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10']) pac;

-- A07 · convulsão febril → alta com orientação à UBS
SELECT pg_temp.m_iniciar('A07');
SELECT pg_temp.m_soap('A07', 'Lactente de 2 anos vinda da UBS depois de convulsão febril de cerca de 3 minutos.', 'T 39,4 na chegada e 37,8 depois do antitérmico. Ativa, sem rigidez de nuca, sem nova crise em 3 horas de observação.', 'Crise convulsiva febril simples.', 'Alta com a mãe orientada sobre a febre e os sinais de alerta.', 'R56.0');
SELECT pg_temp.m_desfecho('A07', 'alta', NULL, '{"cid_alta":"R56.0","orientacao_ubs":"Primeira crise febril: reavaliar na puericultura e orientar a família."}');

-- A08 · crise hipertensiva → o médico reclassifica (melhora) e dá alta
SELECT pg_temp.m_iniciar('A08');
SELECT pg_temp.passo('A08', 'erro.medico_baixa_prioridade_sem_justificativa', format('SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_motivo => %L)::text', pg_temp.epi('A08', pg_temp.upa()), 'verde',
  '{"pressao-arterial-sistolica":158,"pressao-arterial-diastolica":96,"frequencia-cardiaca":84,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2}', 'Pressão controlada depois da medicação'), 'justificativa');
SELECT pg_temp.passo('A08', 'upa.medico.reclassificar', format('SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_motivo => %L, p_justificativa => %L)::text', pg_temp.epi('A08', pg_temp.upa()), 'verde',
  '{"pressao-arterial-sistolica":158,"pressao-arterial-diastolica":96,"frequencia-cardiaca":84,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2}', 'Pressão controlada depois da medicação', 'PA 158x96 e sem cefaleia na reavaliação de 1 hora.'));
SELECT pg_temp.m_soap('A08', 'Veio da UBS com cefaleia e PA 212x124; sem tomar o anti-hipertensivo há 1 semana.', 'PA 158x96 na reavaliação, sem déficit focal, fundo de olho sem papiledema.', 'Hipertensão arterial descompensada por abandono do tratamento, sem lesão de órgão-alvo.', 'Alta com retorno na UBS para ajuste do tratamento.', 'I10');
SELECT pg_temp.m_desfecho('A08', 'alta', NULL, '{"cid_alta":"I10","orientacao_ubs":"Retomar o acompanhamento do hiperdia; conferir a adesão em 7 dias."}');

-- A09 · asma → alta
SELECT pg_temp.m_iniciar('A09');
SELECT pg_temp.m_soap('A09', 'Adolescente de 13 anos vinda da UBS com crise de asma sem resposta ao broncodilatador em casa.', 'SpO2 92% na chegada e 97% depois de três nebulizações; sibilos esparsos, fala frases completas.', 'Crise de asma moderada, revertida.', 'Alta com a mãe orientada; plano de ação por escrito.', 'J45.9');
SELECT pg_temp.m_desfecho('A09', 'alta', NULL, '{"cid_alta":"J45.9","orientacao_ubs":"Rever o tratamento de manutenção e a técnica do inalador."}');

-- A10 · ferimento da mão → alta (sem orientação à UBS)
SELECT pg_temp.m_iniciar('A10');
SELECT pg_temp.m_soap('A10', 'Veio da UBS com ferimento cortante na palma da mão direita há cerca de 4 horas.', 'Ferimento de 4 cm; flexão do 3º dedo preservada na reavaliação, sem lesão de tendão. Sutura com 5 pontos.', 'Ferimento cortante da mão, sem lesão tendínea.', 'Alta; retirar os pontos em 10 dias. Vacina antitetânica conferida.', 'S61.0');
SELECT pg_temp.m_desfecho('A10', 'alta', NULL, '{"cid_alta":"S61.0","observacoes_alta":"Retirar os pontos em 10 dias."}');

INSERT INTO _log (pac, passo, ok, saida)
SELECT replace(p.nome, 'Teste Fluxo ', ''), 'confere.upa', (SELECT count(*) FROM public.atendimento_registros r WHERE r.episodio_id = e.id) >= 1,
       concat_ws(' · ', e.etapa, 'cor=' || e.cor_atual, 'desfecho=' || coalesce(e.desfecho, '-'), 'cid=' || coalesce(e.desfecho_detalhes ->> 'cid_alta', '-'),
         'soap=' || (SELECT count(*) FROM public.atendimento_registros r WHERE r.episodio_id = e.id),
         'min na UPA=' || round(extract(epoch FROM (coalesce(e.encerrado_em, now()) - e.chegada_em)) / 60))
  FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
 WHERE e.unidade_id = pg_temp.upa() AND p.nome LIKE 'Teste Fluxo A%' ORDER BY p.nome;
INSERT INTO _log (pac, passo, ok, saida)
SELECT right(pu.nome, 3), 'confere.contrarreferencia', c.unidade_ubs_id = pg_temp.ubs() AND c.encaminhamento_upa_id IS NOT NULL AND c.paciente_ubs_id IS NOT NULL,
       concat_ws(' · ', 'nº ' || c.numero, c.situacao, c.desfecho, 'paciente da UBS ligado=' || (c.paciente_ubs_id IS NOT NULL), 'orientação=' || coalesce(c.orientacao, '-'))
  FROM public.contrarreferencias c JOIN public.pacientes pu ON pu.id = c.paciente_origem_id
 WHERE c.unidade_origem_id = pg_temp.upa() AND pu.nome LIKE 'Teste Fluxo A%' ORDER BY 1;
-- a UBS lê os retornos (tela Encaminhados → Retornos)
SELECT pg_temp.passo('-', 'ubs.retornos.lista', format($q$SELECT string_agg((x ->> 'numero') || ':' || coalesce(x ->> 'nome', x ->> 'paciente', '?') || ':' || (x ->> 'situacao'), ' | ') FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid, 30)) x$q$, pg_temp.ubs()));

CREATE TEMP TABLE _res ON COMMIT DROP AS SELECT (to_jsonb(l) - 'n') res FROM _log l ORDER BY n;
--FIM
SELECT jsonb_agg(res) todos FROM _res;
COMMIT;
