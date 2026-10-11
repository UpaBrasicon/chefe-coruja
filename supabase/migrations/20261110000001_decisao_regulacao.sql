-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 4 — aceite, recusa e devolução. Decisões do RT em 11/10/2026
-- (BACKLOG.md):
--
-- • O regulador autoriza (só o destino é obrigatório; transporte, data e hora
--   prevista e observação são opcionais), nega (motivo da lista e texto),
--   devolve à origem para correção ou abre pendência (pergunta, sem tirar da
--   fila).
-- • A origem responde a pendência ou corrige e reenvia o devolvido — o
--   solicitante, o médico assistente ou o gestor, com o próprio login. O
--   reenvio mantém a posição na fila (a espera conta do pedido original).
-- • Cada decisão e a mudança de prioridade avisam o solicitante e o médico
--   assistente na tela "Avisos".
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.regulacao_solicitacoes
  ADD COLUMN IF NOT EXISTS autorizada_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS data_prevista timestamptz,
  ADD COLUMN IF NOT EXISTS observacao_decisao text,
  ADD COLUMN IF NOT EXISTS negada_em timestamptz,
  ADD COLUMN IF NOT EXISTS negada_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS motivo_negacao text
    CHECK (motivo_negacao IN ('sem_indicacao', 'sem_oferta', 'fora_escopo', 'duplicidade', 'ja_atendido_obito', 'outro')),
  ADD COLUMN IF NOT EXISTS devolvida_em timestamptz,
  ADD COLUMN IF NOT EXISTS devolvida_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS motivo_devolucao text,
  ADD COLUMN IF NOT EXISTS reenviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS pendencia_pergunta text,
  ADD COLUMN IF NOT EXISTS pendencia_em timestamptz,
  ADD COLUMN IF NOT EXISTS pendencia_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS pendencia_resposta text,
  ADD COLUMN IF NOT EXISTS pendencia_respondida_em timestamptz,
  ADD COLUMN IF NOT EXISTS pendencia_respondida_por uuid REFERENCES public.perfis(id);

-- ── apoio ───────────────────────────────────────────────────────────────────
-- Aviso na tela "Avisos" (notificacoes_plantonista) para o solicitante e o
-- médico assistente, na unidade de origem. A tabela guarda um aviso por tipo,
-- pessoa e dia: o tipo leva o nº do pedido, e o aviso repetido no mesmo dia é
-- atualizado e volta a "não lido".
CREATE OR REPLACE FUNCTION private.regulacao_avisar(s public.regulacao_solicitacoes, p_tipo text, p_mensagem text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT q, s.unidade_origem_id, current_date, p_tipo || '_' || s.numero, p_mensagem
    FROM unnest(ARRAY[s.solicitante_id, s.medico_assistente_id]) q
   WHERE q IS NOT NULL
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
    SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now()
$$;
REVOKE ALL ON FUNCTION private.regulacao_avisar(public.regulacao_solicitacoes, text, text) FROM PUBLIC, anon, authenticated;

-- Quem responde pela origem: o solicitante, o médico assistente ou o gestor da origem.
CREATE OR REPLACE FUNCTION private.regulacao_origem_pode(s public.regulacao_solicitacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.solicitante_id = private.meu_perfil_id()
      OR s.medico_assistente_id IS NOT DISTINCT FROM private.meu_perfil_id() AND s.medico_assistente_id IS NOT NULL
      OR private.tenho_papel(s.unidade_origem_id, 'gestor')
$$;
REVOKE ALL ON FUNCTION private.regulacao_origem_pode(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;


-- o JSON do pedido traz a decisão e se quem consulta pode responder pela origem
CREATE OR REPLACE FUNCTION private.regulacao_json(s public.regulacao_solicitacoes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'numero', s.numero, 'status', s.status, 'tipo', s.tipo,
    'carater', s.carater, 'modalidade', s.modalidade, 'prioridade', s.prioridade,
    'prioridade_central', s.prioridade_central, 'prioridade_central_em', s.prioridade_central_em,
    'procedimento', s.procedimento,
    'procedimento_nome', (SELECT p.nome FROM terminologia.sigtap_procedimento p WHERE p.codigo = s.procedimento),
    'especialidade', s.especialidade, 'cbo', s.cbo,
    'tipo_leito', s.tipo_leito, 'internacao_psiquiatrica', s.internacao_psiquiatrica,
    'isolamento', s.isolamento, 'isolamento_tipo', s.isolamento_tipo,
    'transporte', s.transporte, 'transporte_central', s.transporte_central, 'incubadora', s.incubadora,
    'destino_tipo', s.destino_tipo,
    'destino_unidade', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.destino_unidade_id),
    'destino_externo', s.destino_externo,
    'cid', s.cid, 'cid_descricao', (SELECT c.descricao FROM terminologia.cid10 c WHERE c.codigo = s.cid),
    'quadro_clinico', s.quadro_clinico, 'tempo_evolucao', s.tempo_evolucao, 'sinais_vitais', s.sinais_vitais,
    'exames', s.exames, 'medicacoes', s.medicacoes, 'hipotese', s.hipotese, 'telefone_contato', s.telefone_contato,
    'paciente', (SELECT jsonb_build_object('id', pa.id, 'nome', coalesce(pa.nome_social, pa.nome), 'nascimento', pa.data_nascimento,
                                           'sexo', pa.sexo, 'cns', pa.cns) FROM public.pacientes pa WHERE pa.id = s.paciente_id),
    'paciente_nao_identificado', s.paciente_nao_identificado,
    'episodio_id', s.episodio_id, 'internacao_id', s.internacao_id,
    'origem', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.unidade_origem_id),
    'cnes_solicitante', s.cnes_solicitante,
    'central', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.central_id),
    'solicitante', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.solicitante_id),
    'solicitante_papel', s.solicitante_papel,
    'medico_assistente', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.medico_assistente_id),
    'externo_sistema', s.externo_sistema, 'externo_protocolo', s.externo_protocolo,
    'criada_em', s.criada_em, 'cancelada_em', s.cancelada_em, 'cancelamento_origem', s.cancelamento_origem,
    'motivo_cancelamento', s.motivo_cancelamento)
  -- jsonb_build_object aceita até 100 argumentos: a priorização vai num segundo objeto
  || jsonb_build_object(
    'prioridade_regulador', s.prioridade_regulador, 'prioridade_regulador_em', s.prioridade_regulador_em,
    'prioridade_regulador_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.prioridade_regulador_por),
    'prioridade_regulador_motivo', s.prioridade_regulador_motivo,
    'prioridade_efetiva', coalesce(s.prioridade_regulador, s.prioridade),
    'vulnerabilidades', to_jsonb(s.vulnerabilidades))
  -- decisão da central e respostas da origem (tarefa 4)
  || jsonb_build_object(
    'autorizada_em', s.autorizada_em,
    'autorizada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.autorizada_por),
    'data_prevista', s.data_prevista, 'observacao_decisao', s.observacao_decisao,
    'negada_em', s.negada_em, 'negada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.negada_por),
    'motivo_negacao', s.motivo_negacao,
    'devolvida_em', s.devolvida_em, 'devolvida_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.devolvida_por),
    'motivo_devolucao', s.motivo_devolucao, 'reenviada_em', s.reenviada_em,
    'pendencia_pergunta', s.pendencia_pergunta, 'pendencia_em', s.pendencia_em,
    'pendencia_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.pendencia_por),
    'pendencia_resposta', s.pendencia_resposta, 'pendencia_respondida_em', s.pendencia_respondida_em,
    'pendencia_respondida_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.pendencia_respondida_por),
    'origem_pode_responder', private.regulacao_origem_pode(s))
$$;
REVOKE ALL ON FUNCTION private.regulacao_json(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- a mudança de prioridade passa a avisar a origem
CREATE OR REPLACE FUNCTION public.regulacao_priorizar(p_id uuid, p_prioridade text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_quem text; v_de text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT private.tenho_papel(s.central_id, 'regulador') THEN
    RAISE EXCEPTION 'Quem define a prioridade é o médico regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.assumida_por IS NOT NULL AND s.assumida_por <> private.meu_perfil_id() THEN
    SELECT nome_completo INTO v_quem FROM public.perfis WHERE id = s.assumida_por;
    RAISE EXCEPTION 'Este pedido está com %.', coalesce(v_quem, 'outro regulador');
  END IF;
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia', 'devolvida') THEN
    RAISE EXCEPTION 'A prioridade só muda com o pedido em aberto.';
  END IF;
  IF p_prioridade IS NULL OR p_prioridade NOT IN ('emergencia', 'urgencia', 'prioritaria', 'eletiva') THEN
    RAISE EXCEPTION 'Prioridade: emergência, urgência, prioritária ou eletiva.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  v_de := coalesce(s.prioridade_regulador, s.prioridade);
  UPDATE public.regulacao_solicitacoes
     SET prioridade_regulador = p_prioridade, prioridade_regulador_por = private.meu_perfil_id(),
         prioridade_regulador_em = now(), prioridade_regulador_motivo = btrim(p_motivo)
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'prioridade_regulador',
    jsonb_build_object('de', v_de, 'para', p_prioridade, 'motivo', btrim(p_motivo)));
  PERFORM private.registrar_auditoria('regulacao_priorizada', 'regulacao_solicitacoes', s.id, s.central_id,
    jsonb_build_object('de', v_de, 'para', p_prioridade, 'motivo', btrim(p_motivo)));
  PERFORM private.regulacao_avisar(s, 'reg_prioridade',
    'Regulação nº ' || s.numero || ': a central definiu a prioridade como ' ||
    CASE p_prioridade WHEN 'emergencia' THEN 'emergência' WHEN 'urgencia' THEN 'urgência' WHEN 'prioritaria' THEN 'prioritária' ELSE 'eletiva' END
    || ' — ' || btrim(p_motivo));
  RETURN private.regulacao_json_fila(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_priorizar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_priorizar(uuid, text, text) TO authenticated;

-- Regulador da central, com o pedido livre ou com ele, e o pedido em aberto na central.
CREATE OR REPLACE FUNCTION private.regulacao_regulador_decide(s public.regulacao_solicitacoes)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_quem text;
BEGIN
  IF NOT private.tenho_papel(s.central_id, 'regulador') THEN
    RAISE EXCEPTION 'Quem decide é o médico regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.assumida_por IS NOT NULL AND s.assumida_por <> private.meu_perfil_id() THEN
    SELECT nome_completo INTO v_quem FROM public.perfis WHERE id = s.assumida_por;
    RAISE EXCEPTION 'Este pedido está com %.', coalesce(v_quem, 'outro regulador');
  END IF;
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia') THEN
    RAISE EXCEPTION 'Este pedido não está na fila da central.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_regulador_decide(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- ── decisões do regulador ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_autorizar(p_id uuid, p_destino_tipo text, p_destino_unidade_id uuid DEFAULT NULL,
  p_destino_externo text DEFAULT NULL, p_transporte text DEFAULT NULL, p_data_prevista timestamptz DEFAULT NULL,
  p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_destino text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  PERFORM private.regulacao_regulador_decide(s);
  -- só o destino é obrigatório (decisão do RT)
  IF p_destino_tipo = 'rede' THEN
    IF NOT EXISTS (SELECT 1 FROM public.unidades x WHERE x.id = p_destino_unidade_id AND x.ativo
                     AND x.organizacao_id = s.organizacao_id AND x.id <> s.central_id) THEN
      RAISE EXCEPTION 'O destino precisa ser uma unidade ativa da rede.';
    END IF;
    IF p_destino_unidade_id = s.unidade_origem_id THEN RAISE EXCEPTION 'O destino não pode ser a unidade de origem.'; END IF;
    v_destino := (SELECT nome FROM public.unidades WHERE id = p_destino_unidade_id);
  ELSIF p_destino_tipo = 'externo' THEN
    IF length(btrim(coalesce(p_destino_externo, ''))) < 3 THEN RAISE EXCEPTION 'Informe o serviço de destino.'; END IF;
    v_destino := btrim(p_destino_externo);
  ELSE
    RAISE EXCEPTION 'Para autorizar, defina o destino: unidade da rede ou serviço de fora.';
  END IF;
  IF p_transporte IS NOT NULL AND p_transporte NOT IN ('transporte_sanitario', 'ambulancia_basica', 'ambulancia_avancada',
                                                       'aereo', 'embarcacao', 'meios_proprios') THEN
    RAISE EXCEPTION 'Transporte inválido.';
  END IF;
  UPDATE public.regulacao_solicitacoes
     SET status = 'autorizada', autorizada_em = now(), autorizada_por = private.meu_perfil_id(),
         destino_tipo = p_destino_tipo,
         destino_unidade_id = CASE WHEN p_destino_tipo = 'rede' THEN p_destino_unidade_id END,
         destino_externo = CASE WHEN p_destino_tipo = 'externo' THEN btrim(p_destino_externo) END,
         transporte_central = coalesce(p_transporte, transporte_central),
         data_prevista = p_data_prevista,
         observacao_decisao = nullif(btrim(coalesce(p_observacao, '')), ''),
         assumida_por = coalesce(assumida_por, private.meu_perfil_id())
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'autorizada', jsonb_build_object('destino', v_destino, 'transporte', p_transporte,
    'data_prevista', p_data_prevista, 'observacao', nullif(btrim(coalesce(p_observacao, '')), '')));
  PERFORM private.registrar_auditoria('regulacao_autorizada', 'regulacao_solicitacoes', s.id, s.central_id,
    jsonb_build_object('destino', v_destino));
  PERFORM private.regulacao_avisar(s, 'reg_autorizada',
    'Regulação nº ' || s.numero || ' autorizada: destino ' || v_destino
    || CASE WHEN p_data_prevista IS NOT NULL THEN ', previsto para ' || to_char(p_data_prevista AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') ELSE '' END || '.');
  RETURN private.regulacao_json_fila(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_autorizar(uuid, text, uuid, text, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_autorizar(uuid, text, uuid, text, text, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_negar(p_id uuid, p_motivo text, p_texto text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  PERFORM private.regulacao_regulador_decide(s);
  IF p_motivo IS NULL OR p_motivo NOT IN ('sem_indicacao', 'sem_oferta', 'fora_escopo', 'duplicidade', 'ja_atendido_obito', 'outro') THEN
    RAISE EXCEPTION 'Escolha o motivo da negação.';
  END IF;
  IF length(btrim(coalesce(p_texto, ''))) < 10 THEN RAISE EXCEPTION 'Escreva a justificativa (mínimo de 10 letras).'; END IF;
  UPDATE public.regulacao_solicitacoes
     SET status = 'negada', negada_em = now(), negada_por = private.meu_perfil_id(),
         motivo_negacao = p_motivo, observacao_decisao = btrim(p_texto),
         assumida_por = coalesce(assumida_por, private.meu_perfil_id())
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'negada', jsonb_build_object('motivo', p_motivo, 'texto', btrim(p_texto)));
  PERFORM private.registrar_auditoria('regulacao_negada', 'regulacao_solicitacoes', s.id, s.central_id,
    jsonb_build_object('motivo', p_motivo, 'texto', btrim(p_texto)));
  PERFORM private.regulacao_avisar(s, 'reg_negada', 'Regulação nº ' || s.numero || ' negada: ' || btrim(p_texto));
  RETURN private.regulacao_json_fila(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_negar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_negar(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_devolver(p_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  PERFORM private.regulacao_regulador_decide(s);
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o que a origem precisa corrigir (mínimo de 10 letras).'; END IF;
  UPDATE public.regulacao_solicitacoes
     SET status = 'devolvida', devolvida_em = now(), devolvida_por = private.meu_perfil_id(),
         motivo_devolucao = btrim(p_motivo), assumida_por = NULL, assumida_em = NULL
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'devolvida', jsonb_build_object('motivo', btrim(p_motivo)));
  PERFORM private.registrar_auditoria('regulacao_devolvida', 'regulacao_solicitacoes', s.id, s.central_id,
    jsonb_build_object('motivo', btrim(p_motivo)));
  PERFORM private.regulacao_avisar(s, 'reg_devolvida', 'Regulação nº ' || s.numero || ' devolvida para correção: ' || btrim(p_motivo));
  RETURN private.regulacao_json_fila(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_devolver(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_devolver(uuid, text) TO authenticated;

-- Pendência: pergunta à origem; o pedido continua na fila (e com o regulador).
CREATE OR REPLACE FUNCTION public.regulacao_pendencia(p_id uuid, p_pergunta text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  PERFORM private.regulacao_regulador_decide(s);
  IF s.status = 'pendencia' THEN RAISE EXCEPTION 'Já há uma pergunta esperando resposta da origem.'; END IF;
  IF length(btrim(coalesce(p_pergunta, ''))) < 10 THEN RAISE EXCEPTION 'Escreva a pergunta (mínimo de 10 letras).'; END IF;
  UPDATE public.regulacao_solicitacoes
     SET status = 'pendencia', pendencia_pergunta = btrim(p_pergunta), pendencia_em = now(), pendencia_por = private.meu_perfil_id(),
         pendencia_resposta = NULL, pendencia_respondida_em = NULL, pendencia_respondida_por = NULL,
         assumida_por = coalesce(assumida_por, private.meu_perfil_id()), assumida_em = coalesce(assumida_em, now())
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'pendencia', jsonb_build_object('pergunta', btrim(p_pergunta)));
  PERFORM private.regulacao_avisar(s, 'reg_pendencia', 'Regulação nº ' || s.numero || ': a central pergunta — ' || btrim(p_pergunta));
  RETURN private.regulacao_json_fila(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_pendencia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_pendencia(uuid, text) TO authenticated;

-- ── a origem responde ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_responder_pendencia(p_id uuid, p_resposta text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT private.regulacao_origem_pode(s) THEN
    RAISE EXCEPTION 'Responde o solicitante, o médico assistente ou o gestor da origem.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status <> 'pendencia' THEN RAISE EXCEPTION 'Não há pergunta da central esperando resposta.'; END IF;
  IF length(btrim(coalesce(p_resposta, ''))) < 5 THEN RAISE EXCEPTION 'Escreva a resposta.'; END IF;
  UPDATE public.regulacao_solicitacoes
     SET status = CASE WHEN assumida_por IS NOT NULL THEN 'em_analise' ELSE 'enviada' END,
         pendencia_resposta = btrim(p_resposta), pendencia_respondida_em = now(), pendencia_respondida_por = private.meu_perfil_id()
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'pendencia_respondida', jsonb_build_object('resposta', btrim(p_resposta)));
  -- avisa o regulador que perguntou, na central
  IF s.pendencia_por IS NOT NULL THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (s.pendencia_por, s.central_id, current_date, 'reg_resposta_' || s.numero,
            'Regulação nº ' || s.numero || ': a origem respondeu — ' || btrim(p_resposta))
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
      SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_responder_pendencia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_responder_pendencia(uuid, text) TO authenticated;

-- Corrige e reenvia um pedido devolvido. Mantém a posição na fila: a espera
-- conta desde o pedido original (criada_em não muda).
-- p_dados: os blocos da justificativa, cid, prioridade, carater, telefone_contato.
CREATE OR REPLACE FUNCTION public.regulacao_reenviar(p_id uuid, p_dados jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; d jsonb := coalesce(p_dados, '{}'::jsonb); v_cid text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT private.regulacao_origem_pode(s) THEN
    RAISE EXCEPTION 'Reenvia o solicitante, o médico assistente ou o gestor da origem.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status <> 'devolvida' THEN RAISE EXCEPTION 'Só se reenvia pedido devolvido pela central.'; END IF;
  v_cid := upper(btrim(coalesce(d->>'cid', s.cid)));
  IF v_cid ~ '^[A-Z]\d{3}$' THEN v_cid := left(v_cid, 3) || '.' || right(v_cid, 1); END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.cid10 x WHERE x.codigo = v_cid) THEN RAISE EXCEPTION 'Informe um CID-10 válido.'; END IF;
  BEGIN
    UPDATE public.regulacao_solicitacoes
       SET status = 'enviada', reenviada_em = now(), cid = v_cid,
           prioridade = coalesce(nullif(d->>'prioridade', ''), prioridade),
           carater = coalesce(nullif(d->>'carater', ''), carater),
           quadro_clinico = coalesce(nullif(btrim(coalesce(d->>'quadro_clinico', '')), ''), quadro_clinico),
           tempo_evolucao = CASE WHEN d ? 'tempo_evolucao' THEN nullif(btrim(coalesce(d->>'tempo_evolucao', '')), '') ELSE tempo_evolucao END,
           sinais_vitais = CASE WHEN d ? 'sinais_vitais' THEN nullif(btrim(coalesce(d->>'sinais_vitais', '')), '') ELSE sinais_vitais END,
           exames = CASE WHEN d ? 'exames' THEN nullif(btrim(coalesce(d->>'exames', '')), '') ELSE exames END,
           medicacoes = CASE WHEN d ? 'medicacoes' THEN nullif(btrim(coalesce(d->>'medicacoes', '')), '') ELSE medicacoes END,
           hipotese = CASE WHEN d ? 'hipotese' THEN nullif(btrim(coalesce(d->>'hipotese', '')), '') ELSE hipotese END,
           telefone_contato = CASE WHEN d ? 'telefone_contato' THEN nullif(btrim(coalesce(d->>'telefone_contato', '')), '') ELSE telefone_contato END
     WHERE id = s.id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'Confira o caráter, a prioridade e o quadro clínico (mínimo de 20 letras).';
  END;
  PERFORM private.regulacao_evento(s.id, 'reenviada', jsonb_build_object('campos', (SELECT jsonb_agg(k) FROM jsonb_object_keys(d) k)));
  PERFORM private.registrar_auditoria('regulacao_reenviada', 'regulacao_solicitacoes', s.id, s.unidade_origem_id, NULL);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_reenviar(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_reenviar(uuid, jsonb) TO authenticated;
