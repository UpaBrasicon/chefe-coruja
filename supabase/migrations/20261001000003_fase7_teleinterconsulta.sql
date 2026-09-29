-- ════════════════════════════════════════════════════════════════════════════
-- Fase 7 — teleinterconsulta.
--
-- CONTEXT.md, Telemedicina: o médico remoto apoia o plantonista presencial; a
-- conduta fica com quem está com o paciente. PLANO: "entra por escala como os
-- demais e tem o registro nos dois lados". Resolução CFM 2.314/2022 (pesquisa
-- em produto/docs/pesquisa/cfm-2314-teleinterconsulta.md): consentimento do
-- art. 15 (exceção só emergência médica); identificação, data, hora, local e
-- menção à telemedicina do art. 13. A assinatura ICP-Brasil do art. 13 espera
-- a etapa 4.8 (provedor ainda não escolhido).
--
-- Como fica:
--   1. O médico de telemedicina é escalado num setor e faz check-in como os
--      demais, mas SEM cerca geográfica (está remoto; fica marcado).
--   2. A escala do papel telemedicina NÃO abre os pacientes do setor: ele não
--      entra em setores_na_escala_agora. Lê só o paciente de uma
--      teleinterconsulta que ELE aceitou, e só escreve o parecer.
--   3. O plantonista (quem pode atuar no paciente) solicita, com a pergunta e o
--      registro do consentimento. A solicitação vira documento numerado no
--      prontuário, autor o solicitante.
--   4. O teleconsultor aceita e responde. A resposta vira outro documento
--      numerado no prontuário, autor o teleconsultor. Registro nos dois lados.
--   5. A leitura do teleconsultor vale enquanto a interconsulta está em
--      atendimento e até 24 h depois da resposta.
-- ════════════════════════════════════════════════════════════════════════════

-- ── tipo de documento ───────────────────────────────────────────────────────
ALTER TABLE public.documentos_clinicos DROP CONSTRAINT IF EXISTS documentos_clinicos_tipo_documento_check;
ALTER TABLE public.documentos_clinicos ADD CONSTRAINT documentos_clinicos_tipo_documento_check CHECK (tipo_documento IN (
  'admissao_anamnese', 'evolucao', 'prescricao', 'sumario_alta', 'sumario_obito', 'atestado', 'termo_consentimento',
  'boletim_emergencia', 'partograma', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'teleinterconsulta'));

CREATE OR REPLACE FUNCTION private.gravar_documento_episodio(p_id uuid, p_paciente uuid, p_tipo text, p_conteudo text, p_episodio uuid, p_retifica uuid, p_motivo text, p_autor uuid, p_hora timestamp with time zone, p_sem_conexao boolean, p_aparelho text)
 RETURNS public.documentos_clinicos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_unidade uuid; v_org uuid; v_epi uuid := p_episodio;
  v_ant public.documentos_clinicos; r public.documentos_clinicos;
BEGIN
  IF p_tipo NOT IN ('atestado', 'receita', 'encaminhamento', 'pedido_exames', 'boletim_emergencia', 'sumario_alta',
                    'sumario_obito', 'termo_consentimento', 'laudo_aih', 'evolucao', 'admissao_anamnese', 'prescricao',
                    'teleinterconsulta') THEN
    RAISE EXCEPTION 'Tipo de documento desconhecido.';
  END IF;
  IF length(btrim(coalesce(p_conteudo, ''))) = 0 THEN RAISE EXCEPTION 'Documento vazio.'; END IF;
  SELECT p.unidade_id, u.organizacao_id INTO v_unidade, v_org
    FROM public.pacientes p JOIN public.unidades u ON u.id = p.unidade_id WHERE p.id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;

  IF v_epi IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = v_epi AND paciente_id = p_paciente) THEN
      RAISE EXCEPTION 'Episódio não é deste paciente.';
    END IF;
  ELSE
    SELECT id INTO v_epi FROM public.episodios
     WHERE paciente_id = p_paciente AND (etapa <> 'encerrado' OR encerrado_em > p_hora - interval '12 hours')
     ORDER BY (etapa <> 'encerrado') DESC, chegada_em DESC LIMIT 1;
  END IF;

  IF p_retifica IS NOT NULL THEN
    SELECT * INTO v_ant FROM public.documentos_clinicos WHERE id = p_retifica FOR UPDATE;
    IF NOT FOUND OR v_ant.paciente_id <> p_paciente OR v_ant.tipo_documento <> p_tipo OR v_ant.estado <> 'ativo'
       OR v_ant.episodio_id IS DISTINCT FROM v_epi THEN
      RAISE EXCEPTION 'Só se retifica documento ativo do mesmo episódio e tipo.';
    END IF;
    IF (SELECT d.autor_id FROM public.documentos_clinicos d
         WHERE d.documento_raiz_id = v_ant.documento_raiz_id ORDER BY d.versao LIMIT 1) IS DISTINCT FROM p_autor THEN
      RAISE EXCEPTION 'Só o autor corrige o próprio documento. Emita um documento novo.';
    END IF;
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo da retificação (mínimo de 10 letras).'; END IF;
  END IF;

  INSERT INTO public.documentos_clinicos
    (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, episodio_id, internacao_id, tipo_documento, conteudo,
     conteudo_hash, autor_id, estado, retificacao_de, motivo_retificacao, numero, emitido_em, sem_conexao, aparelho_id)
  VALUES
    (coalesce(p_id, gen_random_uuid()), coalesce(v_ant.documento_raiz_id, gen_random_uuid()), coalesce(v_ant.versao, 0) + 1,
     v_org, v_unidade, p_paciente, v_epi,
     (SELECT i.id FROM public.internacoes i WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado') LIMIT 1),
     p_tipo, p_conteudo,
     encode(extensions.digest(convert_to(p_conteudo, 'UTF8'), 'sha256'), 'hex'), p_autor, 'ativo',
     v_ant.id, CASE WHEN v_ant.id IS NOT NULL THEN btrim(p_motivo) END,
     private.gerar_numero_documento(v_unidade), p_hora, p_sem_conexao, left(p_aparelho, 64))
  RETURNING * INTO r;
  IF v_ant.id IS NOT NULL THEN
    UPDATE public.documentos_clinicos SET estado = 'retificado', updated_at = now() WHERE id = v_ant.id;
  END IF;
  RETURN r;
END $function$;

-- ── a escala da telemedicina não abre o setor ───────────────────────────────
-- plantoes_agora() continua com todos os plantões (check-in, presença, fim de
-- plantão). O que dá acesso ao paciente pelo setor deixa de contar os da
-- telemedicina.
CREATE OR REPLACE FUNCTION private.setores_na_escala_agora()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT DISTINCT p.setor_id FROM private.plantoes_agora() p
  WHERE private.papel_na_unidade(p.unidade_id) <> 'telemedicina';
$function$;

CREATE OR REPLACE FUNCTION private.tem_plantao_agora(p_setor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(EXISTS (SELECT 1 FROM private.setores_na_escala_agora() s WHERE s = p_setor), false);
$function$;

-- telemedicina em plantão agora na unidade (para a fila de teleinterconsultas)
CREATE OR REPLACE FUNCTION private.telemedicina_de_plantao(p_unidade uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT private.papel_na_unidade(p_unidade) = 'telemedicina'
     AND EXISTS (SELECT 1 FROM private.plantoes_agora() p WHERE p.unidade_id = p_unidade);
$function$;
REVOKE ALL ON FUNCTION private.telemedicina_de_plantao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.telemedicina_de_plantao(uuid) TO authenticated;

-- ── check-in remoto ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_checkin(p_unidade uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_observacao text DEFAULT NULL::text, p_justificativa text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_escala public.escala_plantao%ROWTYPE;
  v_unidade public.unidades%ROWTYPE;
  v_dentro boolean;
  v_distancia_m integer;
  v_just text := nullif(trim(coalesce(p_justificativa, '')), '');
  v_reg uuid;
  v_data date;
  v_turno text;
  v_remoto boolean := private.papel_na_unidade(p_unidade) = 'telemedicina';
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT * INTO v_escala FROM private.plantoes_agora() p WHERE p.unidade_id = p_unidade ORDER BY p.inicio LIMIT 1;
  IF v_escala.id IS NULL AND (private.tem_acesso_atendimento(p_unidade) IS NOT TRUE) THEN
    RAISE EXCEPTION 'Você não está em escala ou não tem acesso de atendimento nesta unidade agora.';
  END IF;

  IF v_just IS NOT NULL AND length(v_just) < 10 THEN
    RAISE EXCEPTION 'CHECKIN_JUSTIFICATIVA_CURTA: descreva o problema com o GPS em pelo menos 10 caracteres.';
  END IF;

  SELECT * INTO v_unidade FROM public.unidades WHERE id = p_unidade;
  -- Fase 7: telemedicina é remota por definição; sem cerca geográfica.
  IF NOT v_remoto AND v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      IF v_just IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_SEM_LOCALIZACAO: não foi possível obter a sua localização.';
      END IF;
    ELSE
      v_distancia_m := round(private.distancia_km(v_unidade.latitude, v_unidade.longitude, p_lat, p_lng) * 1000);
      v_dentro := v_distancia_m <= v_unidade.raio_metros;
      IF NOT v_dentro AND v_just IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_FORA_DO_RAIO: você está a % m da unidade; o raio é de % m.', v_distancia_m, v_unidade.raio_metros;
      END IF;
    END IF;
  END IF;

  v_data := coalesce(v_escala.data, private.data_atual());
  v_turno := coalesce(v_escala.turno, private.turno_atual());

  INSERT INTO public.presenca_plantonista
    (unidade_id, escala_plantao_id, perfil_id, data, turno,
     checkin_em, checkin_lat, checkin_lng, checkin_dentro, checkin_distancia_m, checkin_justificativa,
     observacao, criado_por)
  VALUES
    (p_unidade, v_escala.id, v_perfil, v_data, v_turno,
     now(), CASE WHEN v_remoto THEN NULL ELSE p_lat END, CASE WHEN v_remoto THEN NULL ELSE p_lng END,
     v_dentro, v_distancia_m, CASE WHEN v_dentro IS TRUE OR v_remoto THEN NULL ELSE v_just END,
     CASE WHEN v_remoto THEN left('Telemedicina (remoto)' || coalesce(' · ' || p_observacao, ''), 500) ELSE p_observacao END, v_perfil)
  ON CONFLICT (perfil_id, unidade_id, data, turno)
  DO UPDATE SET checkin_em = EXCLUDED.checkin_em,
    checkin_lat = EXCLUDED.checkin_lat, checkin_lng = EXCLUDED.checkin_lng,
    checkin_dentro = EXCLUDED.checkin_dentro, checkin_distancia_m = EXCLUDED.checkin_distancia_m,
    checkin_justificativa = EXCLUDED.checkin_justificativa, observacao = EXCLUDED.observacao
  RETURNING id INTO v_reg;

  RETURN v_reg;
END; $function$;

-- ── a teleinterconsulta ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teleinterconsultas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id     uuid NOT NULL REFERENCES public.organizacoes(id),
  unidade_id         uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id        uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id        uuid REFERENCES public.episodios(id),
  solicitante_id     uuid NOT NULL REFERENCES public.perfis(id),
  pergunta           text NOT NULL CHECK (length(btrim(pergunta)) >= 10),
  urgencia           text NOT NULL DEFAULT 'rotina' CHECK (urgencia IN ('rotina', 'urgente')),
  consentimento      text NOT NULL CHECK (consentimento IN ('obtido', 'representante_legal', 'emergencia_sem_condicao')),
  status             text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_atendimento', 'respondida', 'cancelada')),
  consultor_id       uuid REFERENCES public.perfis(id),
  aceita_em          timestamptz,
  resposta           text,
  respondida_em      timestamptz,
  documento_solicitacao_id uuid REFERENCES public.documentos_clinicos(id),
  documento_resposta_id    uuid REFERENCES public.documentos_clinicos(id),
  criada_em          timestamptz NOT NULL DEFAULT now(),
  cancelada_em       timestamptz,
  CONSTRAINT teleinterconsulta_coerente CHECK (
    (status = 'aberta' AND consultor_id IS NULL)
 OR (status = 'em_atendimento' AND consultor_id IS NOT NULL AND aceita_em IS NOT NULL)
 OR (status = 'respondida' AND consultor_id IS NOT NULL AND respondida_em IS NOT NULL AND length(btrim(coalesce(resposta, ''))) >= 20)
 OR (status = 'cancelada' AND cancelada_em IS NOT NULL)
  ),
  CONSTRAINT teleinterconsulta_consultor_nao_solicitante CHECK (consultor_id IS NULL OR consultor_id <> solicitante_id)
);
CREATE INDEX IF NOT EXISTS teleinterconsultas_unidade_status ON public.teleinterconsultas (unidade_id, status, criada_em DESC);
CREATE INDEX IF NOT EXISTS teleinterconsultas_paciente ON public.teleinterconsultas (paciente_id);

ALTER TABLE public.teleinterconsultas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teleinterconsultas_select ON public.teleinterconsultas;
CREATE POLICY teleinterconsultas_select ON public.teleinterconsultas FOR SELECT TO authenticated
  USING (solicitante_id = private.meu_perfil_id() OR consultor_id = private.meu_perfil_id()
         OR private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor');
REVOKE ALL ON public.teleinterconsultas FROM anon;

-- leitura do teleconsultor: em atendimento, ou respondida há menos de 24 h
CREATE OR REPLACE FUNCTION private.teleinterconsulta_vigente(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teleinterconsultas t
    WHERE t.paciente_id = p_paciente
      AND t.consultor_id = private.meu_perfil_id()
      AND (t.status = 'em_atendimento' OR (t.status = 'respondida' AND t.respondida_em > now() - interval '24 hours'))
      AND private.papel_na_unidade(t.unidade_id) <> ''
  );
$$;
REVOKE ALL ON FUNCTION private.teleinterconsulta_vigente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.teleinterconsulta_vigente(uuid) TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['administracoes', 'agravos_notificacao', 'alergias_paciente', 'alta_paciente',
    'atendimento_registros', 'checklist_admissao', 'classificacoes_risco', 'documentos_clinicos', 'episodios',
    'eventos_adt', 'exames_pedidos', 'internacoes', 'observacao', 'pacotes_alta', 'pendencias', 'prescricoes',
    'sugestoes_prescricao'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_teleinterconsulta ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY %1$s_teleinterconsulta ON public.%1$I FOR SELECT TO authenticated
         USING (private.teleinterconsulta_vigente(paciente_id))', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS pacientes_teleinterconsulta ON public.pacientes;
CREATE POLICY pacientes_teleinterconsulta ON public.pacientes FOR SELECT TO authenticated
  USING (private.teleinterconsulta_vigente(id));
DROP POLICY IF EXISTS prescricao_itens_teleinterconsulta ON public.prescricao_itens;
CREATE POLICY prescricao_itens_teleinterconsulta ON public.prescricao_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prescricoes p
                 WHERE p.id = prescricao_itens.prescricao_id AND private.teleinterconsulta_vigente(p.paciente_id)));

-- abrir o prontuário também vale para a teleinterconsulta (leitura apenas)
CREATE OR REPLACE FUNCTION private.gravar_acesso(p_paciente uuid, p_internacao uuid, p_tipo text, p_documento uuid, p_documento_tipo text)
 RETURNS public.log_acesso_prontuario
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  r public.log_acesso_prontuario;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR NOT (
       private.pode_atuar_no_paciente(p_paciente) IS TRUE
    OR (p_tipo IN ('leitura_prontuario', 'leitura_documento')
        AND (private.acesso_encerrado_vigente(p_paciente) OR private.teleinterconsulta_vigente(p_paciente)))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF p_internacao IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.internacoes WHERE id = p_internacao AND paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'Internação não pertence ao paciente.';
  END IF;

  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel,
     tipo_acesso, documento_id, documento_tipo, ip, user_agent)
  VALUES
    ((SELECT organizacao_id FROM public.unidades WHERE id = v_unidade),
     v_unidade, p_paciente, p_internacao, v_perfil,
     nullif(private.papel_na_unidade(v_unidade), ''), p_tipo, p_documento, p_documento_tipo,
     private.requisicao_ip(), private.requisicao_navegador())
  RETURNING * INTO r;
  RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.abrir_prontuario(p_paciente uuid, p_internacao uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.log_acesso_prontuario
    WHERE acessado_por = private.meu_perfil_id()
      AND paciente_id = p_paciente
      AND tipo_acesso = 'leitura_prontuario'
      AND internacao_id IS NOT DISTINCT FROM p_internacao
      AND created_at > now() - interval '5 minutes'
  ) THEN
    IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE
       AND private.acesso_encerrado_vigente(p_paciente) IS NOT TRUE
       AND private.teleinterconsulta_vigente(p_paciente) IS NOT TRUE THEN
      RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
    END IF;
    RETURN;
  END IF;
  PERFORM private.gravar_acesso(p_paciente, p_internacao, 'leitura_prontuario', NULL, NULL);
END $$;
REVOKE ALL ON FUNCTION public.abrir_prontuario(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_prontuario(uuid, uuid) TO authenticated;

-- ── texto dos documentos ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.identificacao_medico(p_perfil uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pf.nome_completo || coalesce(' — CRM ' || pf.crm || coalesce('/' || pf.uf_crm, ''), ' — CRM não cadastrado')
  FROM public.perfis pf WHERE pf.id = p_perfil;
$$;

CREATE OR REPLACE FUNCTION private.rotulo_consentimento(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p
    WHEN 'obtido' THEN 'consentimento do paciente obtido'
    WHEN 'representante_legal' THEN 'consentimento do representante legal obtido'
    WHEN 'emergencia_sem_condicao' THEN 'emergência médica: consentimento dispensado (Res. CFM 2.314/2022, art. 15)'
  END;
$$;

-- ── solicitar (quem está com o paciente) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.solicitar_teleinterconsulta(
  p_paciente uuid, p_pergunta text, p_consentimento text, p_urgencia text DEFAULT 'rotina', p_episodio uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid; v_org uuid;
  v_id uuid := gen_random_uuid();
  d public.documentos_clinicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT p.unidade_id, u.organizacao_id INTO v_unidade, v_org
    FROM public.pacientes p JOIN public.unidades u ON u.id = p.unidade_id WHERE p.id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF v_perfil IS NULL OR private.papel_na_unidade(v_unidade) NOT IN ('plantonista', 'gestor')
     OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: só o médico que está com o paciente solicita teleinterconsulta.';
  END IF;
  IF length(btrim(coalesce(p_pergunta, ''))) < 10 THEN RAISE EXCEPTION 'Escreva a pergunta ao teleconsultor (pelo menos 10 caracteres).'; END IF;
  IF p_consentimento NOT IN ('obtido', 'representante_legal', 'emergencia_sem_condicao') THEN
    RAISE EXCEPTION 'Registre o consentimento do paciente para a teleinterconsulta.';
  END IF;
  IF coalesce(p_urgencia, 'rotina') NOT IN ('rotina', 'urgente') THEN RAISE EXCEPTION 'Urgência desconhecida.'; END IF;

  d := private.gravar_documento_episodio(NULL, p_paciente, 'teleinterconsulta',
    'SOLICITAÇÃO DE TELEINTERCONSULTA' || E'\n' ||
    'Atendimento por telemedicina, modalidade teleinterconsulta (Res. CFM 2.314/2022, art. 7º)' || E'\n' ||
    'Local do paciente: ' || (SELECT nome FROM public.unidades WHERE id = v_unidade) || E'\n' ||
    'Solicitante: ' || private.identificacao_medico(v_perfil) || E'\n' ||
    'Data e hora: ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' (Brasília)' || E'\n' ||
    'Urgência: ' || coalesce(p_urgencia, 'rotina') || E'\n' ||
    'Consentimento: ' || private.rotulo_consentimento(p_consentimento) || E'\n' ||
    'Meio: plataforma Chefe Coruja (registro escrito)' || E'\n\n' ||
    'Pergunta:' || E'\n' || btrim(p_pergunta),
    p_episodio, NULL, NULL, v_perfil, now(), false, NULL);

  INSERT INTO public.teleinterconsultas (id, organizacao_id, unidade_id, paciente_id, episodio_id, solicitante_id, pergunta,
                                         urgencia, consentimento, documento_solicitacao_id)
  VALUES (v_id, v_org, v_unidade, p_paciente, d.episodio_id, v_perfil, btrim(p_pergunta), coalesce(p_urgencia, 'rotina'),
          p_consentimento, d.id);

  PERFORM private.registrar_auditoria('solicitar_teleinterconsulta', 'teleinterconsultas', v_id, v_unidade,
    jsonb_build_object('status', 'aberta', 'tipo', coalesce(p_urgencia, 'rotina')));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.solicitar_teleinterconsulta(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_teleinterconsulta(uuid, text, text, text, uuid) TO authenticated;

-- ── aceitar (telemedicina de plantão na unidade) ────────────────────────────
CREATE OR REPLACE FUNCTION public.aceitar_teleinterconsulta(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.teleinterconsultas;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO t FROM public.teleinterconsultas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Teleinterconsulta não encontrada.'; END IF;
  IF NOT private.telemedicina_de_plantao(t.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: só o médico de telemedicina de plantão nesta unidade aceita.';
  END IF;
  IF t.status <> 'aberta' THEN RAISE EXCEPTION 'Esta teleinterconsulta já foi aceita, respondida ou cancelada.'; END IF;
  IF t.solicitante_id = private.meu_perfil_id() THEN RAISE EXCEPTION 'Quem solicitou não responde a própria teleinterconsulta.'; END IF;
  UPDATE public.teleinterconsultas SET status = 'em_atendimento', consultor_id = private.meu_perfil_id(), aceita_em = now()
   WHERE id = p_id;
  PERFORM private.registrar_auditoria('aceitar_teleinterconsulta', 'teleinterconsultas', p_id, t.unidade_id,
    jsonb_build_object('status', 'em_atendimento'));
END $$;
REVOKE ALL ON FUNCTION public.aceitar_teleinterconsulta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceitar_teleinterconsulta(uuid) TO authenticated;

-- ── responder (o consultor que aceitou) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.responder_teleinterconsulta(p_id uuid, p_resposta text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t public.teleinterconsultas;
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO t FROM public.teleinterconsultas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Teleinterconsulta não encontrada.'; END IF;
  IF t.consultor_id IS DISTINCT FROM v_perfil OR t.status <> 'em_atendimento' THEN
    RAISE EXCEPTION 'Só o teleconsultor que aceitou responde, e só enquanto está em atendimento.';
  END IF;
  IF length(btrim(coalesce(p_resposta, ''))) < 20 THEN RAISE EXCEPTION 'Escreva o parecer (pelo menos 20 caracteres).'; END IF;

  d := private.gravar_documento_episodio(NULL, t.paciente_id, 'teleinterconsulta',
    'PARECER DE TELEINTERCONSULTA' || E'\n' ||
    'Atendimento por telemedicina, modalidade teleinterconsulta (Res. CFM 2.314/2022, art. 7º)' || E'\n' ||
    'Local do paciente: ' || (SELECT nome FROM public.unidades WHERE id = t.unidade_id) || E'\n' ||
    'Teleconsultor: ' || private.identificacao_medico(v_perfil) || E'\n' ||
    'Em resposta a: ' || private.identificacao_medico(t.solicitante_id) ||
      coalesce(' — solicitação nº ' || (SELECT numero FROM public.documentos_clinicos WHERE id = t.documento_solicitacao_id), '') || E'\n' ||
    'Solicitada em: ' || to_char(t.criada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') ||
    ' · respondida em: ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' (Brasília)' || E'\n' ||
    'Consentimento: ' || private.rotulo_consentimento(t.consentimento) || E'\n' ||
    'Meio: plataforma Chefe Coruja (registro escrito)' || E'\n\n' ||
    'Pergunta:' || E'\n' || t.pergunta || E'\n\n' ||
    'Parecer:' || E'\n' || btrim(p_resposta) || E'\n\n' ||
    'A conduta é do médico assistente presencial (Res. CFM 2.314/2022, art. 7º, parágrafo único).',
    t.episodio_id, NULL, NULL, v_perfil, now(), false, NULL);

  UPDATE public.teleinterconsultas
     SET status = 'respondida', resposta = btrim(p_resposta), respondida_em = now(), documento_resposta_id = d.id
   WHERE id = p_id;
  PERFORM private.registrar_auditoria('responder_teleinterconsulta', 'teleinterconsultas', p_id, t.unidade_id,
    jsonb_build_object('status', 'respondida'));
  RETURN d.id;
END $$;
REVOKE ALL ON FUNCTION public.responder_teleinterconsulta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_teleinterconsulta(uuid, text) TO authenticated;

-- ── cancelar (quem solicitou, enquanto aberta) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_teleinterconsulta(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.teleinterconsultas;
BEGIN
  UPDATE public.teleinterconsultas SET status = 'cancelada', cancelada_em = now()
   WHERE id = p_id AND solicitante_id = private.meu_perfil_id() AND status = 'aberta'
  RETURNING * INTO t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Só quem solicitou cancela, e só enquanto ninguém aceitou.'; END IF;
  PERFORM private.registrar_auditoria('cancelar_teleinterconsulta', 'teleinterconsultas', p_id, t.unidade_id,
    jsonb_build_object('status', 'cancelada'));
END $$;
REVOKE ALL ON FUNCTION public.cancelar_teleinterconsulta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_teleinterconsulta(uuid) TO authenticated;

-- ── listas ──────────────────────────────────────────────────────────────────
-- Telemedicina de plantão: as abertas da unidade (com o mínimo para decidir)
-- e as suas. Plantonista: as que solicitou. Gestor: todas da unidade.
CREATE OR REPLACE FUNCTION public.teleinterconsultas_da_unidade(p_unidade uuid, p_dias int DEFAULT 7)
RETURNS TABLE (id uuid, paciente_id uuid, paciente_nome text, paciente_nascimento date, setor_nome text,
               solicitante_nome text, consultor_nome text, pergunta text, urgencia text, consentimento text,
               status text, criada_em timestamptz, aceita_em timestamptz, resposta text, respondida_em timestamptz,
               documento_solicitacao_numero text, documento_resposta_numero text, minha boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_papel text := private.papel_na_unidade(p_unidade);
  v_tele boolean := private.telemedicina_de_plantao(p_unidade);
BEGIN
  IF v_perfil IS NULL OR v_papel NOT IN ('plantonista', 'gestor', 'telemedicina') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT t.id, t.paciente_id, pa.nome, pa.data_nascimento, s.nome, ps.nome_completo, pc.nome_completo,
         t.pergunta, t.urgencia, t.consentimento, t.status, t.criada_em, t.aceita_em, t.resposta, t.respondida_em,
         ds.numero, dr.numero, (t.solicitante_id = v_perfil OR t.consultor_id = v_perfil)
  FROM public.teleinterconsultas t
  JOIN public.pacientes pa ON pa.id = t.paciente_id
  LEFT JOIN public.setores s ON s.id = pa.setor_id
  JOIN public.perfis ps ON ps.id = t.solicitante_id
  LEFT JOIN public.perfis pc ON pc.id = t.consultor_id
  LEFT JOIN public.documentos_clinicos ds ON ds.id = t.documento_solicitacao_id
  LEFT JOIN public.documentos_clinicos dr ON dr.id = t.documento_resposta_id
  WHERE t.unidade_id = p_unidade
    AND (t.status IN ('aberta', 'em_atendimento') OR t.criada_em > now() - make_interval(days => greatest(1, least(coalesce(p_dias, 7), 90))))
    AND (
      v_papel = 'gestor'
      OR t.solicitante_id = v_perfil
      OR t.consultor_id = v_perfil
      OR (v_tele AND t.status = 'aberta')
    )
  ORDER BY (t.status = 'aberta') DESC, (t.urgencia = 'urgente') DESC, t.criada_em DESC;
END $$;
REVOKE ALL ON FUNCTION public.teleinterconsultas_da_unidade(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teleinterconsultas_da_unidade(uuid, int) TO authenticated;

COMMENT ON TABLE public.teleinterconsultas IS
  'Fase 7: pedido de apoio do médico presencial ao médico de telemedicina. Solicitação e parecer viram documentos numerados no prontuário (registro nos dois lados).';
