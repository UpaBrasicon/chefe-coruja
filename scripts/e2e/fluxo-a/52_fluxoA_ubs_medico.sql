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

-- PASSO 3 · UBS, médico: abre o atendimento, registra o SOAP, envia à UPA Homologação e encerra pela conduta.
-- Telas: Fila do consultório → JanelaAtendimento (iniciar_atendimento), aba Atendimento (registrar_soap),
-- aba Conduta → "Enviar à UPA" (encaminhar_upa) e "Encerrar consulta" (registrar_conduta_aps).
CREATE FUNCTION pg_temp.iniciar(p_pac text, p_espera text DEFAULT NULL, p_nome text DEFAULT 'ubs.medico.iniciar') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.iniciar_atendimento(%L::uuid)::text', pg_temp.epi(p_pac, pg_temp.ubs())), p_espera) $$;
CREATE FUNCTION pg_temp.soap(p_pac text, s text, o text, a text, p text, p_cid text, p_espera text DEFAULT NULL, p_nome text DEFAULT 'ubs.medico.soap') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', pg_temp.epi(p_pac, pg_temp.ubs()), s, o, a, p, p_cid), p_espera) $$;
CREATE FUNCTION pg_temp.enviar(p_pac text, p_motivo text, p_destino uuid DEFAULT pg_temp.upa(), p_espera text DEFAULT NULL, p_nome text DEFAULT 'ubs.medico.enviar_upa') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.encaminhar_upa(%L::uuid, %L::uuid, %L)::text', pg_temp.epi(p_pac, pg_temp.ubs()), p_destino, p_motivo), p_espera) $$;
CREATE FUNCTION pg_temp.conduta(p_pac text, p_tipo text, p_prob text[], p_obs text, p_condutas text[] DEFAULT '{encaminhamento_urgencia}', p_espera text DEFAULT NULL, p_nome text DEFAULT 'ubs.medico.conduta') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.registrar_conduta_aps(%L::uuid, %L, %L::text[], %L::text[], %L::text[], %L, %L::text[])::text',
    pg_temp.epi(p_pac, pg_temp.ubs()), p_tipo, p_prob, '{}'::text[], p_condutas, p_obs, '{}'::text[]), p_espera) $$;

-- caminhos errados antes
SELECT pg_temp.soap('A01', 's', 'o', 'a', 'p', NULL, 'Abra o atendimento', 'erro.soap_sem_abrir');
SELECT pg_temp.conduta('A01', 'escuta_inicial', '{hipertensao_arterial}', NULL, '{encaminhamento_urgencia}', 'Abra o atendimento', 'erro.conduta_sem_abrir');
SELECT pg_temp.iniciar('A06', 'não está aguardando atendimento', 'erro.iniciar_quem_esta_na_escuta');

-- A01 · dor torácica
SELECT pg_temp.iniciar('A01');
SELECT pg_temp.conduta('A01', 'escuta_inicial', '{hipertensao_arterial}', NULL, '{encaminhamento_urgencia}', 'SOAP', 'erro.conduta_sem_soap');
SELECT pg_temp.soap('A01', 'x', 'y', 'z', 'w', 'Z99.99', 'CID', 'erro.cid_inexistente');
SELECT pg_temp.soap('A01', 'Dor precordial em aperto há 40 min, irradia para o braço esquerdo, com sudorese. Hipertenso, tabagista.', 'PA 168x102, FC 112, SpO2 94%. Sudoreico, ausculta cardíaca sem sopros. Sem ECG na unidade.', 'Dor torácica com suspeita de síndrome coronariana aguda.', 'Encaminhar à UPA com urgência para ECG e avaliação. Paciente em repouso até o transporte.', 'I20.0');
SELECT pg_temp.enviar('A01', 'curto', pg_temp.upa(), 'mínimo de 10', 'erro.envio_motivo_curto');
SELECT pg_temp.enviar('A01', 'Dor torácica com suspeita de síndrome coronariana', pg_temp.ubs(), 'UPA ou um hospital', 'erro.envio_para_a_propria_ubs');
SELECT pg_temp.enviar('A01', 'Dor torácica com suspeita de síndrome coronariana', '31000000-0000-4000-8000-0000000000c1', 'UPA ou um hospital', 'erro.envio_para_a_central_de_regulacao');
SELECT pg_temp.enviar('A01', 'Dor torácica com suspeita de síndrome coronariana', 'f5100000-0000-4000-8000-000000000002', 'UPA ou um hospital', 'erro.envio_para_upa_de_outra_rede');
SELECT pg_temp.enviar('A01', 'Dor torácica com suspeita de síndrome coronariana aguda: precisa de ECG e troponina.');
SELECT pg_temp.enviar('A01', 'Dor torácica com suspeita de síndrome coronariana aguda', pg_temp.upa(), 'Já há um envio', 'erro.envio_repetido');
SELECT pg_temp.passo('A01', 'erro.alta_pela_porta_na_ubs', format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', pg_temp.epi('A01', pg_temp.ubs()), 'alta', '{"cid_alta":"I20.0"}'), 'encerra pela conduta');
SELECT pg_temp.conduta('A01', 'escuta_inicial', '{hipertensao_arterial}', NULL, '{mandar_para_casa}', 'fora da lista', 'erro.conduta_fora_da_lista');
SELECT pg_temp.conduta('A01', 'escuta_inicial', '{hipertensao_arterial,tabagismo}', 'Enviado à UPA Homologação com acompanhante.');
SELECT pg_temp.conduta('A01', 'escuta_inicial', '{hipertensao_arterial}', NULL, '{encaminhamento_urgencia}', 'já foi encerrada', 'erro.conduta_repetida');
SELECT pg_temp.enviar('A01', 'Segundo envio depois de encerrar a consulta', pg_temp.upa(), 'já foi encerrada', 'erro.envio_depois_de_encerrar');

-- A02 · DPOC exacerbada (idosa)
SELECT pg_temp.iniciar('A02');
SELECT pg_temp.soap('A02', 'Dispneia progressiva há 2 dias, tosse com catarro amarelado. DPOC, ex-tabagista.', 'FR 28, SpO2 89% em ar ambiente, sibilos difusos, uso de musculatura acessória.', 'Exacerbação de DPOC com hipoxemia.', 'Encaminhar à UPA para oxigênio, broncodilatador e avaliação.', 'J44.1');
SELECT pg_temp.enviar('A02', 'Exacerbação de DPOC com SpO2 89% em ar ambiente; precisa de oxigênio e avaliação.');
SELECT pg_temp.conduta('A02', 'escuta_inicial', '{dpoc}', NULL);

-- A03 · criança com pneumonia
SELECT pg_temp.iniciar('A03');
SELECT pg_temp.soap('A03', 'Febre há 3 dias, tosse e cansaço. Mãe conta que mama pouco hoje.', 'T 39,2, FR 44, SpO2 91%, tiragem subcostal, estertores em base direita.', 'Pneumonia com sinais de gravidade (tiragem e hipoxemia).', 'Encaminhar à UPA para radiografia, oxigênio e avaliação pediátrica.', 'J18.9');
SELECT pg_temp.enviar('A03', 'Criança de 6 anos com pneumonia, tiragem subcostal e SpO2 91%.');
SELECT pg_temp.conduta('A03', 'escuta_inicial', '{}', 'Mãe acompanha a criança.');

-- A04 · gestante com sangramento
SELECT pg_temp.iniciar('A04');
SELECT pg_temp.soap('A04', 'Gestante de 30 semanas pela DUM, sangramento vaginal vermelho vivo há 1 hora, dor abdominal.', 'PA 152x98, FC 108, útero hipertônico, BCF 132.', 'Sangramento do terceiro trimestre; afastar descolamento de placenta.', 'Encaminhar com urgência para avaliação obstétrica.', 'O46.9');
SELECT pg_temp.enviar('A04', 'Gestante de 30 semanas com sangramento vaginal e hipertonia uterina; PA 152x98.');
SELECT pg_temp.conduta('A04', 'escuta_inicial', '{pre_natal}', NULL);

-- A05 · dor abdominal (consulta no dia, sem escuta)
SELECT pg_temp.iniciar('A05');
SELECT pg_temp.soap('A05', 'Dor em fossa ilíaca direita desde a madrugada, náusea, 1 episódio de vômito.', 'T 38,3, FC 102, dor à descompressão em FID.', 'Abdome agudo; suspeita de apendicite.', 'Encaminhar à UPA para avaliação cirúrgica; jejum.', 'K35.9');
SELECT pg_temp.enviar('A05', 'Suspeita de apendicite aguda: dor em FID com descompressão dolorosa e febre.');
SELECT pg_temp.conduta('A05', 'consulta_no_dia', '{}', NULL);

-- A06 · suspeita de AVC: o médico envia direto da escuta (a ficha da UBS encerra no envio)
SELECT pg_temp.enviar('A06', 'Suspeita de AVC: desvio de rima e disartria há 1 hora, PA 188x106, glicemia 132.');
SELECT pg_temp.conduta('A06', 'escuta_inicial', '{hipertensao_arterial}', NULL, '{encaminhamento_urgencia}', 'já foi encerrada', 'erro.conduta_depois_do_envio_pela_escuta');

-- A07 · convulsão febril (atendimento de urgência, Consultório 2)
SELECT pg_temp.iniciar('A07');
SELECT pg_temp.soap('A07', 'Convulsão tônico-clônica de cerca de 3 minutos em casa, com febre. Primeira vez.', 'T 39,6, FC 158, sonolenta, sem rigidez de nuca, glicemia 92.', 'Crise convulsiva febril.', 'Encaminhar à UPA para observação e avaliação pediátrica.', 'R56.0');
SELECT pg_temp.enviar('A07', 'Lactente de 2 anos com convulsão febril há menos de 1 hora, sonolenta.');
SELECT pg_temp.conduta('A07', 'atendimento_urgencia', '{}', NULL);

-- A08 · crise hipertensiva: envia, cancela (destino errado) e envia de novo
SELECT pg_temp.iniciar('A08');
SELECT pg_temp.soap('A08', 'Cefaleia occipital forte há 4 horas, visão turva. Hipertenso, sem tomar o remédio há 1 semana.', 'PA 212x124 nas duas medidas, FC 92, sem déficit focal.', 'Crise hipertensiva com sintomas.', 'Encaminhar à UPA para controle pressórico e avaliação.', 'I10');
SELECT pg_temp.enviar('A08', 'Crise hipertensiva com cefaleia e visão turva: PA 212x124.', '31000000-0000-4000-8000-0000000000d1', NULL, 'ubs.medico.enviar_hospital_por_engano');
SELECT pg_temp.passo('A08', 'erro.cancelar_motivo_curto', format('SELECT public.encaminhamento_upa_cancelar(%L::uuid, %L)::text', pg_temp.env('A08'), 'x'), 'motivo');
SELECT pg_temp.passo('A08', 'ubs.medico.cancelar_envio', format('SELECT public.encaminhamento_upa_cancelar(%L::uuid, %L)::text', pg_temp.env('A08'), 'Destino errado: o paciente vai à UPA.'));
SELECT pg_temp.passo('A08', 'erro.cancelar_de_novo', format('SELECT public.encaminhamento_upa_cancelar(%L::uuid, %L)::text', pg_temp.env('A08'), 'Cancelando outra vez'), 'ainda espera');
SELECT pg_temp.enviar('A08', 'Crise hipertensiva com cefaleia e visão turva: PA 212x124.');
SELECT pg_temp.conduta('A08', 'consulta_agendada', '{hipertensao_arterial}', NULL);

-- A09 · asma (13 anos e 11 meses: ainda pediatria)
SELECT pg_temp.iniciar('A09');
SELECT pg_temp.soap('A09', 'Chiado e tosse desde ontem à noite, usou a bombinha 3 vezes sem melhora.', 'FR 30, SpO2 92%, sibilos difusos, fala frases curtas.', 'Crise de asma moderada sem resposta ao broncodilatador em casa.', 'Encaminhar à UPA para nebulização seriada e corticoide.', 'J45.9');
SELECT pg_temp.enviar('A09', 'Crise de asma moderada, SpO2 92%, sem resposta ao broncodilatador em casa.');
SELECT pg_temp.conduta('A09', 'escuta_inicial', '{asma}', NULL);

-- A10 · ferimento na mão (azul, atender hoje)
SELECT pg_temp.iniciar('A10');
SELECT pg_temp.soap('A10', 'Corte na palma da mão direita com faca há 2 horas, sangramento contido com pano.', 'Ferimento de 4 cm, profundo, com dificuldade para fletir o 3º dedo. Perfusão preservada.', 'Ferimento cortante profundo da mão com suspeita de lesão de tendão.', 'Encaminhar à UPA para sutura e avaliação; curativo compressivo.', 'S61.0');
SELECT pg_temp.enviar('A10', 'Ferimento cortante profundo na mão com suspeita de lesão de tendão; precisa de sutura.');
SELECT pg_temp.conduta('A10', 'escuta_inicial', '{}', NULL);

INSERT INTO _log (pac, passo, ok, saida)
SELECT replace(p.nome, 'Teste Fluxo ', ''), 'confere.ubs', e.etapa = 'encerrado' AND (SELECT count(*) FROM public.encaminhamentos_upa x WHERE x.episodio_origem_id = e.id AND x.situacao = 'enviado' AND x.unidade_destino_id = pg_temp.upa()) = 1,
       concat_ws(' · ', e.etapa, 'cid=' || array_to_string(e.cid_aps, ','), 'conduta=' || array_to_string(e.conduta_aps, ','), 'motivo=' || left(e.desfecho_motivo, 50),
        'envios=' || (SELECT string_agg(x.numero || ':' || x.situacao || '>' || (SELECT left(nome, 12) FROM public.unidades WHERE id = x.unidade_destino_id), ', ' ORDER BY x.enviado_em) FROM public.encaminhamentos_upa x WHERE x.episodio_origem_id = e.id))
  FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
 WHERE e.unidade_id = pg_temp.ubs() AND p.nome LIKE 'Teste Fluxo A%' ORDER BY p.nome;
INSERT INTO _log (pac, passo, ok, saida)
SELECT '-', 'confere.avisos_upa', true, n.tipo || ' · ' || left(n.mensagem, 110) || ' · lida=' || (n.lida_em IS NOT NULL) || ' · data=' || n.data
  FROM public.notificacoes_plantonista n WHERE n.tipo LIKE 'ubs_upa_%' AND n.created_at > now() - interval '10 minutes' ORDER BY n.created_at;

CREATE TEMP TABLE _res ON COMMIT DROP AS SELECT (to_jsonb(l) - 'n') res FROM _log l ORDER BY n;
--FIM
SELECT jsonb_agg(res) todos FROM _res;
COMMIT;
