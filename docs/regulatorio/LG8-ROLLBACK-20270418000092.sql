-- Rollback da migration 20270418000092 (LG8: telemedicina).
-- Volta às funções da 20261001000003. Atenção: apaga os endereços gravados e
-- a ligação do termo com a solicitação (os termos continuam no prontuário como
-- documentos). Na produção, exporte antes. Testado na homologação em transação.
BEGIN;
DROP FUNCTION IF EXISTS public.solicitar_teleinterconsulta_com_termo(uuid, text, text, text, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.definir_meu_endereco_profissional(text);
DROP FUNCTION IF EXISTS public.definir_endereco_unidade(uuid, text);

-- funções como na 20261001000003
CREATE OR REPLACE FUNCTION private.identificacao_medico(p_perfil uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pf.nome_completo || coalesce(' — CRM ' || pf.crm || coalesce('/' || pf.uf_crm, ''), ' — CRM não cadastrado')
  FROM public.perfis pf WHERE pf.id = p_perfil;
$$;

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


DROP FUNCTION IF EXISTS private.endereco_profissional(uuid, uuid);
DROP FUNCTION IF EXISTS private.endereco_paciente(uuid);
DROP FUNCTION IF EXISTS private.texto_tcle_telemedicina();
DROP INDEX IF EXISTS public.teleinterconsultas_termo_idx;
ALTER TABLE public.teleinterconsultas DROP CONSTRAINT IF EXISTS teleinterconsultas_consentimento_forma;
ALTER TABLE public.teleinterconsultas DROP COLUMN IF EXISTS termo_documento_id, DROP COLUMN IF EXISTS justificativa_emergencia,
  DROP COLUMN IF EXISTS representante, DROP COLUMN IF EXISTS testemunha, DROP COLUMN IF EXISTS consentimento_forma;
ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_endereco_profissional_tamanho;
ALTER TABLE public.perfis DROP COLUMN IF EXISTS endereco_profissional;
ALTER TABLE public.unidades DROP CONSTRAINT IF EXISTS unidades_endereco_tamanho;
ALTER TABLE public.unidades DROP COLUMN IF EXISTS endereco;
COMMIT;
