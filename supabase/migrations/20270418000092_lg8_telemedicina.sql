-- LG8 (decisões do RT de 18/11/2026, M1–M4 = A; docs/regulatorio/LG8-TELEMEDICINA-DIAGNOSTICO.md):
-- teleinterconsulta conforme a Res. CFM 2.314/2022.
--   1. Endereços do art. 13: unidades.endereco e perfis.endereco_profissional,
--      gravados por funções que conferem quem pode (o perfil tem UPDATE travado).
--   2. private.identificacao_medico lê o registro pelos campos novos
--      (conselho, registro_numero, registro_uf), com os antigos de reserva.
--   3. Termo de consentimento de telemedicina (art. 15): texto padrão da
--      plataforma; public.solicitar_teleinterconsulta_com_termo grava o termo
--      como documento do prontuário, com a forma de concordância (assinatura no
--      papel ou verbal com testemunha) e liga à solicitação. Emergência segue
--      dispensada, com justificativa.
--   4. Solicitação e parecer passam a trazer o endereço profissional do médico
--      e o endereço do paciente (art. 13, a e b).
--
-- Expand: só acrescenta. A função antiga solicitar_teleinterconsulta continua
-- de pé até a tela nova ir à produção; sai numa contract seguinte.
-- Rollback (testado na homologação, dentro de transação):
--   docs/regulatorio/LG8-ROLLBACK-20270418000092.sql

-- ---------------------------------------------------------------- 1. endereços
ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS endereco_profissional text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unidades_endereco_tamanho') THEN
    ALTER TABLE public.unidades ADD CONSTRAINT unidades_endereco_tamanho
      CHECK (endereco IS NULL OR length(btrim(endereco)) BETWEEN 5 AND 300);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'perfis_endereco_profissional_tamanho') THEN
    ALTER TABLE public.perfis ADD CONSTRAINT perfis_endereco_profissional_tamanho
      CHECK (endereco_profissional IS NULL OR length(btrim(endereco_profissional)) BETWEEN 5 AND 300);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.definir_meu_endereco_profissional(p_endereco text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Sem sessão' USING ERRCODE = '42501'; END IF;
  IF p_endereco IS NOT NULL AND length(btrim(p_endereco)) NOT BETWEEN 5 AND 300 THEN
    RAISE EXCEPTION 'Endereço profissional: de 5 a 300 caracteres';
  END IF;
  UPDATE public.perfis SET endereco_profissional = nullif(btrim(p_endereco), '') WHERE id = v_perfil;
  PERFORM private.registrar_auditoria('definir_endereco_profissional', 'perfis', v_perfil, NULL, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.definir_endereco_unidade(p_unidade uuid, p_endereco text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Só o gestor da unidade define o endereço' USING ERRCODE = '42501';
  END IF;
  IF p_endereco IS NOT NULL AND length(btrim(p_endereco)) NOT BETWEEN 5 AND 300 THEN
    RAISE EXCEPTION 'Endereço da unidade: de 5 a 300 caracteres';
  END IF;
  UPDATE public.unidades SET endereco = nullif(btrim(p_endereco), '') WHERE id = p_unidade;
  PERFORM private.registrar_auditoria('definir_endereco_unidade', 'unidades', p_unidade, p_unidade, NULL);
END $$;

-- ----------------------------------------- 2. identificação pelo registro novo
CREATE OR REPLACE FUNCTION private.identificacao_medico(p_perfil uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pf.nome_completo || coalesce(
           ' — ' || coalesce(nullif(btrim(pf.conselho), ''), 'CRM') || ' '
             || coalesce(nullif(btrim(pf.registro_numero), ''), nullif(btrim(pf.crm), ''))
             || coalesce('/' || coalesce(nullif(btrim(pf.registro_uf), ''), nullif(btrim(pf.uf_crm), '')), ''),
           ' — CRM não cadastrado')
  FROM public.perfis pf WHERE pf.id = p_perfil;
$$;

-- endereço profissional (art. 13, a): o do cadastro do médico; sem ele, o da unidade
CREATE OR REPLACE FUNCTION private.endereco_profissional(p_perfil uuid, p_unidade uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT nullif(btrim(endereco_profissional), '') FROM public.perfis WHERE id = p_perfil),
    (SELECT u.nome || coalesce(', ' || nullif(btrim(u.endereco), ''), '') || coalesce(' — ' || u.municipio, '') || coalesce('/' || u.uf, '')
       FROM public.unidades u WHERE u.id = p_unidade),
    'não informado')
$$;

-- endereço do paciente (art. 13, b), do cadastro
CREATE OR REPLACE FUNCTION private.endereco_paciente(p_paciente uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(nullif(btrim(concat_ws(', ',
           nullif(btrim(concat_ws(' ', p.tipo_logradouro, p.endereco)), ''),
           nullif(btrim(p.numero_endereco), ''),
           nullif(btrim(p.complemento), ''),
           nullif(btrim(p.bairro), ''),
           nullif(btrim(concat_ws('/', p.municipio, p.uf)), ''),
           CASE WHEN nullif(btrim(p.cep), '') IS NOT NULL THEN 'CEP ' || btrim(p.cep) END)), ''),
         'não informado no cadastro')
    FROM public.pacientes p WHERE p.id = p_paciente
$$;

-- ------------------------------------------------- 3. termo de telemedicina
CREATE OR REPLACE FUNCTION private.texto_tcle_telemedicina()
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 'TERMO DE CONSENTIMENTO PARA TELEMEDICINA (TELEINTERCONSULTA)' || E'\n' ||
    'Res. CFM 2.314/2022, art. 15; Lei 14.510/2022.' || E'\n\n' ||
    'O médico que está atendendo vai pedir a opinião de outro médico, que está em outro lugar, por meio da plataforma Chefe Coruja. '
    || 'Para isso, ele vai compartilhar com esse médico os dados e as imagens do seu atendimento que forem necessários.' || E'\n'
    || 'O médico à distância dá a opinião; quem decide o seu tratamento continua sendo o médico que está com você.' || E'\n'
    || 'Os dados ficam no seu prontuário, protegidos pela Lei Geral de Proteção de Dados, e só os médicos envolvidos têm acesso.' || E'\n'
    || 'Você pode recusar. Se recusar, o atendimento continua, sem a opinião do médico à distância.'
$$;

ALTER TABLE public.teleinterconsultas ADD COLUMN IF NOT EXISTS consentimento_forma text;
ALTER TABLE public.teleinterconsultas ADD COLUMN IF NOT EXISTS testemunha text;
ALTER TABLE public.teleinterconsultas ADD COLUMN IF NOT EXISTS representante text;
ALTER TABLE public.teleinterconsultas ADD COLUMN IF NOT EXISTS justificativa_emergencia text;
ALTER TABLE public.teleinterconsultas ADD COLUMN IF NOT EXISTS termo_documento_id uuid REFERENCES public.documentos_clinicos(id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teleinterconsultas_consentimento_forma') THEN
    ALTER TABLE public.teleinterconsultas ADD CONSTRAINT teleinterconsultas_consentimento_forma
      CHECK (consentimento_forma IS NULL OR consentimento_forma IN ('assinatura_papel', 'verbal_testemunha', 'emergencia'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS teleinterconsultas_termo_idx ON public.teleinterconsultas (termo_documento_id);

-- ------------------------------- 4. solicitação e parecer com os endereços
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
    'Endereço do paciente: ' || private.endereco_paciente(p_paciente) || E'\n' ||
    'Solicitante: ' || private.identificacao_medico(v_perfil) || E'\n' ||
    'Endereço profissional do solicitante: ' || private.endereco_profissional(v_perfil, v_unidade) || E'\n' ||
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

-- Solicitar com o termo (M1). Grava o termo como documento do prontuário,
-- depois a solicitação (pela função acima, que confere acesso e 2FA), e liga os dois.
CREATE OR REPLACE FUNCTION public.solicitar_teleinterconsulta_com_termo(
  p_paciente uuid, p_pergunta text, p_consentimento text, p_forma text,
  p_testemunha text DEFAULT NULL, p_representante text DEFAULT NULL, p_justificativa text DEFAULT NULL,
  p_urgencia text DEFAULT 'rotina', p_episodio uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_id uuid;
  termo public.documentos_clinicos;
BEGIN
  IF p_forma IS NULL OR p_forma NOT IN ('assinatura_papel', 'verbal_testemunha', 'emergencia') THEN
    RAISE EXCEPTION 'Diga como o consentimento foi dado: assinatura no papel, verbal com testemunha ou emergência.';
  END IF;
  IF (p_forma = 'emergencia') <> (p_consentimento = 'emergencia_sem_condicao') THEN
    RAISE EXCEPTION 'Emergência sem condição de consentir só com a forma "emergência".';
  END IF;
  IF p_forma = 'emergencia' AND length(btrim(coalesce(p_justificativa, ''))) < 15 THEN
    RAISE EXCEPTION 'Na emergência, escreva por que não houve consentimento (pelo menos 15 caracteres).';
  END IF;
  IF p_forma = 'verbal_testemunha' AND length(btrim(coalesce(p_testemunha, ''))) < 5 THEN
    RAISE EXCEPTION 'Consentimento verbal pede o nome da testemunha da equipe.';
  END IF;
  IF p_consentimento = 'representante_legal' AND length(btrim(coalesce(p_representante, ''))) < 5 THEN
    RAISE EXCEPTION 'Diga o nome e o vínculo do representante legal.';
  END IF;

  IF p_forma <> 'emergencia' THEN
    -- o acesso é conferido de novo na solicitação; aqui o termo só nasce se ela puder seguir
    IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
      RAISE EXCEPTION 'Acesso negado: só o médico que está com o paciente solicita teleinterconsulta.';
    END IF;
    termo := private.gravar_documento_episodio(NULL, p_paciente, 'termo_consentimento',
      private.texto_tcle_telemedicina() || E'\n\n' ||
      'Concordância: ' || CASE p_consentimento WHEN 'representante_legal' THEN 'do representante legal (' || btrim(p_representante) || ')' ELSE 'do paciente' END || E'\n' ||
      'Forma: ' || CASE p_forma WHEN 'assinatura_papel' THEN 'assinatura no termo impresso' ELSE 'verbal, com a testemunha ' || btrim(p_testemunha) END || E'\n' ||
      'Médico que obteve o consentimento: ' || private.identificacao_medico(v_perfil) || E'\n' ||
      'Data e hora: ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' (Brasília)',
      p_episodio, NULL, NULL, v_perfil, now(), false, NULL);
  END IF;

  v_id := public.solicitar_teleinterconsulta(p_paciente, p_pergunta, p_consentimento, p_urgencia, p_episodio);

  UPDATE public.teleinterconsultas
     SET consentimento_forma = p_forma,
         testemunha = nullif(btrim(p_testemunha), ''),
         representante = nullif(btrim(p_representante), ''),
         justificativa_emergencia = CASE WHEN p_forma = 'emergencia' THEN btrim(p_justificativa) END,
         termo_documento_id = termo.id
   WHERE id = v_id;
  RETURN v_id;
END $$;

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
    'Endereço do paciente: ' || private.endereco_paciente(t.paciente_id) || E'\n' ||
    'Teleconsultor: ' || private.identificacao_medico(v_perfil) || E'\n' ||
    'Endereço profissional do teleconsultor: ' || private.endereco_profissional(v_perfil, t.unidade_id) || E'\n' ||
    'Em resposta a: ' || private.identificacao_medico(t.solicitante_id) ||
      coalesce(' — solicitação nº ' || (SELECT numero FROM public.documentos_clinicos WHERE id = t.documento_solicitacao_id), '') || E'\n' ||
    'Solicitada em: ' || to_char(t.criada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') ||
    ' · respondida em: ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' (Brasília)' || E'\n' ||
    'Consentimento: ' || private.rotulo_consentimento(t.consentimento) ||
      coalesce(' — termo nº ' || (SELECT numero FROM public.documentos_clinicos WHERE id = t.termo_documento_id), '') || E'\n' ||
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

-- ----------------------------------------------------------------- grants
REVOKE ALL ON FUNCTION private.endereco_profissional(uuid, uuid), private.endereco_paciente(uuid), private.texto_tcle_telemedicina()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.definir_meu_endereco_profissional(text), public.definir_endereco_unidade(uuid, text),
  public.solicitar_teleinterconsulta_com_termo(uuid, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_meu_endereco_profissional(text), public.definir_endereco_unidade(uuid, text),
  public.solicitar_teleinterconsulta_com_termo(uuid, text, text, text, text, text, text, text, uuid) TO authenticated;
