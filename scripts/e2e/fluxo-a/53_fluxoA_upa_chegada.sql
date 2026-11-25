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

-- PASSO 4 · UPA Homologação: vê o painel "Vindo da UBS" (encaminhamentos_upa_destino) e a recepção dá entrada
-- (Recepção → registrar_ficha na porta Pronto Socorro). O app não tem "aceitar": o envio fica "enviado" até a chegada.
-- A chegada liga sozinha pela ficha (gatilho: CNS, CPF ou nome + nascimento) ou à mão no painel (encaminhamento_upa_marcar_chegada).
CREATE FUNCTION pg_temp.ficha_upa(p_pac text, p_queixa text, p_dados jsonb, p_prio text[] DEFAULT '{}') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, 'upa.recepcao.ficha', format(
    'SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb, %L::text[], false)::text', pg_temp.ps(), p_queixa,
    jsonb_build_object('nome', 'Teste Fluxo ' || p_pac, 'categoria', 'sus') || p_dados, p_prio)) $$;

-- o que a UPA vê antes da chegada
SELECT pg_temp.passo('-', 'upa.painel.vindo_da_ubs', format($q$SELECT string_agg((x ->> 'numero') || ':' || (x -> 'resumo' -> 'paciente' ->> 'nome') || ':' || (x ->> 'situacao'), ' | ' ORDER BY (x ->> 'numero')::int)
  FROM jsonb_array_elements(public.encaminhamentos_upa_destino(%L::uuid)) x WHERE x -> 'resumo' -> 'paciente' ->> 'nome' LIKE 'Teste Fluxo A%%'$q$, pg_temp.upa()));

-- caminhos errados da chegada
SELECT pg_temp.passo('A09', 'erro.chegou_sem_ficha', format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, NULL, NULL)::text', pg_temp.env('A09')), 'ficha');
SELECT pg_temp.passo('A09', 'erro.chegou_com_ficha_da_ubs', format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid, NULL)::text', pg_temp.env('A09'), pg_temp.epi('A09', pg_temp.ubs())), 'não é desta unidade');
SELECT pg_temp.passo('A09', 'erro.nao_chegou_sem_motivo', format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, false, NULL, %L)::text', pg_temp.env('A09'), 'sumiu'), 'mínimo de 10');
SELECT pg_temp.passo('A08', 'erro.chegada_de_envio_cancelado', format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, false, NULL, %L)::text', (SELECT id FROM public.encaminhamentos_upa WHERE episodio_origem_id = pg_temp.epi('A08', pg_temp.ubs()) AND situacao = 'cancelado'), 'Paciente não apareceu aqui'), 'Marca a chegada a unidade de destino');
-- (o login de teste não tem papel de porta no Hospital de Referência, destino do envio cancelado)

-- recepção da UPA: a ficha liga a chegada sozinha
SELECT pg_temp.ficha_upa('A01', 'Veio da UBS com dor no peito', '{"data_nascimento":"1981-03-10","sexo":"M","cpf":"90002500132","cns":"700251125000107","nome_mae":"Mãe Teste A01"}');
SELECT pg_temp.ficha_upa('A02', 'Veio da UBS com falta de ar', '{"data_nascimento":"1954-07-22","sexo":"F","cpf":"90002500213","cns":"700251125000204","nome_mae":"Mãe Teste A02"}');
SELECT pg_temp.ficha_upa('A03', 'Veio da UBS com febre e cansaço', '{"data_nascimento":"2020-05-14","sexo":"M","cns":"700251125000301","nome_mae":"Mãe Teste A03","responsavel_nome":"Mãe Teste A03","responsavel_parentesco":"mãe"}');
SELECT pg_temp.ficha_upa('A04', 'Gestante vinda da UBS com sangramento', '{"data_nascimento":"1998-09-02","sexo":"F","cpf":"90002500485","nome_mae":"Mãe Teste A04"}', '{gestante}');
SELECT pg_temp.ficha_upa('A05', 'Veio da UBS com dor na barriga', '{"data_nascimento":"1992-01-30","sexo":"F","cpf":"90002500566","nome_mae":"Mãe Teste A05"}');
SELECT pg_temp.ficha_upa('A06', 'Veio da UBS com boca torta e fala enrolada', '{"data_nascimento":"1945-11-11","sexo":"M","cns":"700251125000603","nome_mae":"Mãe Teste A06"}');
-- A07: sem documento nos dois lados; liga pelo nome + nascimento
SELECT pg_temp.ficha_upa('A07', 'Criança vinda da UBS depois de convulsão', '{"data_nascimento":"2024-08-19","sexo":"F","nome_mae":"Mãe Teste A07","responsavel_nome":"Mãe Teste A07","responsavel_parentesco":"mãe"}', '{lactante_crianca_colo}');
-- A08: tem um envio cancelado (hospital) e um em andamento (UPA)
SELECT pg_temp.ficha_upa('A08', 'Veio da UBS com pressão alta e dor de cabeça', '{"data_nascimento":"1968-04-05","sexo":"M","cpf":"90002500809","cns":"700251125000808","nome_mae":"Mãe Teste A08"}');
-- A09: a recepção erra o dia do nascimento e não pede documento → não liga sozinho; liga à mão no painel
SELECT pg_temp.ficha_upa('A09', 'Veio da UBS com chiado no peito', '{"data_nascimento":"2012-11-28","sexo":"F","nome_mae":"Mãe Teste A09","responsavel_nome":"Mãe Teste A09","responsavel_parentesco":"mãe"}');
SELECT pg_temp.ficha_upa('A10', 'Veio da UBS com corte na mão', '{"data_nascimento":"2003-06-18","sexo":"M","cpf":"90002501023","nome_mae":"Mãe Teste A10"}');

-- A09 à mão: primeiro os erros (ficha de outro paciente já ligada a outro envio), depois o certo
SELECT pg_temp.passo('A09', 'erro.chegou_com_ficha_de_outro_paciente', format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid, NULL)::text', pg_temp.env('A09'), pg_temp.epi('A01', pg_temp.upa())), 'ficha');
SELECT pg_temp.passo('A09', 'upa.recepcao.chegou_no_painel', format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid, NULL) ->> %L', pg_temp.env('A09'), pg_temp.epi('A09', pg_temp.upa()), 'situacao'));
SELECT pg_temp.passo('A09', 'erro.chegou_de_novo', format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid, NULL)::text', pg_temp.env('A09'), pg_temp.epi('A09', pg_temp.upa())), 'não está esperando');
SELECT pg_temp.passo('A01', 'erro.nao_chegou_depois_de_chegar', format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, false, NULL, %L)::text', pg_temp.env('A01'), 'Marcado por engano depois da chegada'), 'não está esperando');
-- a UBS tenta cancelar depois da chegada
SELECT pg_temp.passo('A01', 'erro.cancelar_depois_de_chegar', format('SELECT public.encaminhamento_upa_cancelar(%L::uuid, %L)::text', pg_temp.env('A01'), 'Cancelar depois de chegar'), 'ainda espera');

INSERT INTO _log (pac, passo, ok, saida)
SELECT right(x.resumo -> 'paciente' ->> 'nome', 3), 'confere.envio', x.situacao = 'chegou' AND x.episodio_destino_id = pg_temp.epi(right(x.resumo -> 'paciente' ->> 'nome', 3), pg_temp.upa()),
       concat_ws(' · ', 'nº ' || x.numero, x.situacao, 'ficha UPA=' || coalesce(x.episodio_destino_id::text, '-'), x.observacao_chegada,
         'etapa UPA=' || (SELECT e.etapa FROM public.episodios e WHERE e.id = x.episodio_destino_id),
         'min até chegar=' || round(extract(epoch FROM (x.chegada_em - x.enviado_em)) / 60))
  FROM public.encaminhamentos_upa x WHERE x.unidade_origem_id = pg_temp.ubs() AND x.unidade_destino_id = pg_temp.upa() ORDER BY 1;
INSERT INTO _log (pac, passo, ok, saida)
SELECT '-', 'confere.avisos_ubs', true, n.tipo || ' · ' || left(n.mensagem, 110) || ' · unidade=' || (SELECT left(nome, 8) FROM public.unidades WHERE id = n.unidade_id)
  FROM public.notificacoes_plantonista n WHERE n.tipo LIKE 'ubs_upa_%' AND n.created_at > now() - interval '5 minutes' ORDER BY n.created_at;

CREATE TEMP TABLE _res ON COMMIT DROP AS SELECT (to_jsonb(l) - 'n') res FROM _log l ORDER BY n;
--FIM
SELECT jsonb_agg(res) todos FROM _res;
COMMIT;
