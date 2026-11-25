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

-- PASSO 6 · UPA, médico: abre o atendimento, registra o SOAP e dá o desfecho (Fila médica → JanelaAtendimento:
-- iniciar_atendimento, registrar_soap, aba Desfecho → registrar_desfecho). A alta devolve a contrarreferência à UBS.
CREATE FUNCTION pg_temp.m_iniciar(p_pac text, p_espera text DEFAULT NULL, p_nome text DEFAULT 'upa.medico.iniciar') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.iniciar_atendimento(%L::uuid)::text', pg_temp.epi(p_pac, pg_temp.upa())), p_espera) $$;
CREATE FUNCTION pg_temp.m_soap(p_pac text, s text, o text, a text, p text, p_cid text, p_espera text DEFAULT NULL, p_nome text DEFAULT 'upa.medico.soap') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', pg_temp.epi(p_pac, pg_temp.upa()), s, o, a, p, p_cid), p_espera) $$;
CREATE FUNCTION pg_temp.m_desfecho(p_pac text, p_desfecho text, p_relato text, p_det jsonb, p_espera text DEFAULT NULL, p_nome text DEFAULT 'upa.medico.desfecho') RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.passo(p_pac, p_nome, format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', pg_temp.epi(p_pac, pg_temp.upa()), p_desfecho, p_relato, p_det), p_espera) $$;

-- A01 · dor torácica → observação
SELECT pg_temp.m_soap('A01', 's', 'o', 'a', 'p', NULL, 'Abra o atendimento', 'erro.soap_sem_abrir');
SELECT pg_temp.m_iniciar('A01');
SELECT pg_temp.m_desfecho('A01', 'alta', NULL, '{"cid_alta":"I20.0"}', 'SOAP', 'erro.desfecho_sem_soap');
SELECT pg_temp.m_soap('A01', 'Veio da UBS com dor precordial em aperto há cerca de 1 hora, irradiada para o braço esquerdo.', 'PA 164x98, FC 108, SpO2 95%. ECG sem supra de ST. Aguardando troponina.', 'Dor torácica a esclarecer; síndrome coronariana aguda sem supra em investigação.', 'Monitorização, troponina seriada e observação.', NULL);
SELECT pg_temp.m_desfecho('A01', 'alta', NULL, '{}', 'diagnóstico de alta', 'erro.alta_sem_cid');
SELECT pg_temp.m_desfecho('A01', 'alta', NULL, format('{"cid_alta":"I20.0","alta_em":"%s"}', (now() + interval '2 hours')::text)::jsonb, 'futuro', 'erro.alta_no_futuro');
SELECT pg_temp.m_desfecho('A01', 'alta', NULL, format('{"cid_alta":"I20.0","alta_em":"%s"}', (now() - interval '2 days')::text)::jsonb, 'antes da chegada', 'erro.alta_antes_da_chegada');
SELECT pg_temp.m_desfecho('A01', 'evasao', 'curto', '{}', 'mínimo de 15', 'erro.evasao_relato_curto');
SELECT pg_temp.m_desfecho('A01', 'internacao', NULL, '{}', 'setor de internação', 'erro.internacao_sem_setor');
SELECT pg_temp.m_desfecho('A01', 'transferencia', NULL, '{"destino":"Hospital de Referência","cid_alta":"I20.0"}', 'documento de transferência', 'erro.transferencia_sem_documento');
SELECT pg_temp.m_desfecho('A01', 'cura', NULL, '{}', 'desconhecido', 'erro.desfecho_inventado');
SELECT pg_temp.m_desfecho('A01', 'observacao', NULL, '{}');
SELECT pg_temp.m_desfecho('A01', 'alta', NULL, '{"cid_alta":"I20.0"}', 'não está em atendimento', 'erro.desfecho_repetido');

-- A02 · DPOC → alta após medicação, com orientação à UBS
SELECT pg_temp.m_iniciar('A02');
SELECT pg_temp.m_soap('A02', 'Veio da UBS com dispneia há 2 dias. DPOC conhecida.', 'SpO2 88% em ar ambiente na chegada; 94% depois de nebulização e oxigênio. Sibilos difusos, sem tiragem.', 'Exacerbação de DPOC, com melhora depois da medicação.', 'Alta com orientações; seguimento na UBS.', 'J44.1');
SELECT pg_temp.m_desfecho('A02', 'alta_apos_medicacao', NULL, '{"cid_alta":"J44.1"}', 'não há medicação prescrita', 'erro.alta_apos_medicacao_sem_prescricao');
SELECT pg_temp.m_desfecho('A02', 'alta', NULL, '{"cid_alta":"J44.1","orientacao_ubs":"Reavaliar em 48 horas na UBS e conferir a técnica do inalador."}');

-- A03 · pneumonia na criança → alta com orientação à UBS
SELECT pg_temp.m_iniciar('A03');
SELECT pg_temp.m_soap('A03', 'Criança de 6 anos vinda da UBS, febre há 3 dias e cansaço.', 'Radiografia com condensação em base direita. SpO2 95% depois de oxigênio; sem tiragem na reavaliação.', 'Pneumonia adquirida na comunidade.', 'Alta com a mãe orientada; retorno na UBS.', 'J18.9');
SELECT pg_temp.m_desfecho('A03', 'alta', NULL, '{"cid_alta":"J18.9","orientacao_ubs":"Reavaliar em 48 horas. Voltar antes se piorar o cansaço.","observacoes_alta":"Mãe orientada sobre sinais de alerta."}');

-- A04 · gestante com sangramento → fica em atendimento (a transferência obstétrica segue pela regulação, Fluxo B)
SELECT pg_temp.m_iniciar('A04');
SELECT pg_temp.m_soap('A04', 'Gestante de 30 semanas vinda da UBS, sangramento vaginal há cerca de 2 horas.', 'PA 156x100, FC 112, útero hipertônico, BCF 128.', 'Sangramento do terceiro trimestre; suspeita de descolamento prematuro de placenta.', 'Acesso venoso, monitorização e pedido de transferência para maternidade pela regulação.', 'O46.9');

-- A05 · dor abdominal → alta a pedido
SELECT pg_temp.m_iniciar('A05');
SELECT pg_temp.m_soap('A05', 'Veio da UBS com dor em fossa ilíaca direita desde a madrugada.', 'T 38,4, dor à descompressão em FID. Hemograma pedido.', 'Abdome agudo inflamatório; suspeita de apendicite.', 'Indicada avaliação cirúrgica.', 'K35.9');
SELECT pg_temp.m_desfecho('A05', 'alta_a_pedido', 'Paciente recusa aguardar a avaliação cirúrgica e pede para sair; orientada sobre os riscos.', '{"cid_alta":"K35.9","orientacao_ubs":"Saiu a pedido com suspeita de apendicite: fazer busca ativa hoje."}');

-- A06 · suspeita de AVC → observação
SELECT pg_temp.m_iniciar('A06');
SELECT pg_temp.m_soap('A06', 'Idoso vindo da UBS com desvio de rima e fala enrolada há cerca de 2 horas.', 'PA 190x108, Glasgow 14, disartria e paresia em membro superior direito. Glicemia 128.', 'Acidente vascular cerebral a esclarecer.', 'Observação monitorizada e pedido de transferência para tomografia.', 'I64');
SELECT pg_temp.m_desfecho('A06', 'observacao', NULL, '{}');

INSERT INTO _log (pac, passo, ok, saida)
SELECT replace(p.nome, 'Teste Fluxo ', ''), 'confere.upa', true,
       concat_ws(' · ', e.etapa, 'desfecho=' || coalesce(e.desfecho, '-'), 'cid=' || coalesce(e.desfecho_detalhes ->> 'cid_alta', '-'),
         'soap=' || (SELECT count(*) FROM public.atendimento_registros r WHERE r.episodio_id = e.id),
         'internacao=' || coalesce((SELECT i.status::text FROM public.internacoes i WHERE i.episodio_id = e.id LIMIT 1), '-'))
  FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
 WHERE e.unidade_id = pg_temp.upa() AND p.nome LIKE 'Teste Fluxo A%' ORDER BY p.nome;
INSERT INTO _log (pac, passo, ok, saida)
SELECT right(pu.nome, 3), 'confere.contrarreferencia', c.unidade_ubs_id = pg_temp.ubs() AND c.encaminhamento_upa_id IS NOT NULL,
       concat_ws(' · ', 'nº ' || c.numero, c.situacao, c.desfecho, 'ligada ao envio=' || (c.encaminhamento_upa_id IS NOT NULL), 'orientação=' || coalesce(c.orientacao, '-'))
  FROM public.contrarreferencias c JOIN public.pacientes pu ON pu.id = c.paciente_origem_id
 WHERE c.unidade_origem_id = pg_temp.upa() AND pu.nome LIKE 'Teste Fluxo A%' ORDER BY 1;
INSERT INTO _log (pac, passo, ok, saida)
SELECT '-', 'confere.avisos_retorno', true, n.tipo || ' · ' || left(n.mensagem, 120)
  FROM public.notificacoes_plantonista n WHERE n.tipo LIKE 'ubs_retorno_%' AND n.unidade_id = pg_temp.ubs() AND n.created_at > now() - interval '5 minutes' ORDER BY n.created_at;

CREATE TEMP TABLE _res ON COMMIT DROP AS SELECT (to_jsonb(l) - 'n') res FROM _log l ORDER BY n;
--FIM
SELECT jsonb_agg(res) todos FROM _res;
COMMIT;
