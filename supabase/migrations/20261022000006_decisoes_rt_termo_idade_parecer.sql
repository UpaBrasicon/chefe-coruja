-- ════════════════════════════════════════════════════════════════════════════
-- Decisões do usuário (RT) em 02/10/2026, sobre a revisão das mudanças de
-- 29/09 a 02/10. Gerado a partir das definições em vigor.
--
-- 2.1 A — quem assina o termo de consentimento (Código Civil, arts. 3º, 4º e
--     1.690): abaixo de 16 anos assina o responsável legal; de 16 a 17 assina o
--     paciente, ASSISTIDO pelo responsável (que também assina) ou com o motivo
--     da ausência registrado; a partir de 18 assina o paciente. A pediatria
--     clínica continua até 13a11m29d — este corte é só da assinatura.
-- 2.2 A — idade desconhecida não vira adulto: o termo e os protocolos de
--     observação pedem a data de nascimento; a prescrição exige o peso como na
--     criança. (A classificação de risco NÃO trava: quem chega sem documento
--     precisa ser triado.)
-- 2.3 A — telemedicina não é parecerista: lê o paciente só pela
--     teleinterconsulta aceita (fase 7). A lista de pareceres para quem só
--     pediu ou analisou vale até 24 h depois de concluído ou cancelado.
-- 2.4 B e 2.5 B — mantidos (administrador registra evolução; alta após
--     medicação na observação sem conferência da administração).
-- ════════════════════════════════════════════════════════════════════════════

-- emitir_termo_consentimento(uuid,jsonb,uuid,uuid,uuid,text)
CREATE OR REPLACE FUNCTION public.emitir_termo_consentimento(p_paciente uuid, p_dados jsonb, p_episodio uuid DEFAULT NULL::uuid, p_internacao uuid DEFAULT NULL::uuid, p_retifica uuid DEFAULT NULL::uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  pc public.pacientes;
  v_unidade_nome text;
  v_med public.perfis;
  v_epi uuid := p_episodio;
  v_ant public.documentos_clinicos;
  m public.termos_modelos;
  v_idade int;
  v_menor boolean;
  v_assistido boolean;
  v_assinante text := coalesce(p_dados ->> 'assinante', '');
  v_proc text := btrim(coalesce(p_dados ->> 'procedimento', ''));
  v_texto text := btrim(coalesce(p_dados ->> 'texto', ''));
  v_info text := nullif(btrim(coalesce(p_dados ->> 'informacoes', '')), '');
  v_sem_cond text := nullif(btrim(coalesce(p_dados ->> 'sem_condicoes_motivo', '')), '');
  v_ausencia text := nullif(btrim(coalesce(p_dados ->> 'ausencia_motivo', '')), '');
  v_resp jsonb;
  v_test jsonb;
  v_decl text;
  v_campos jsonb;
  v_conteudo text;
  r public.documentos_clinicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN RAISE EXCEPTION 'Dados do termo inválidos.'; END IF;
  SELECT * INTO pc FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF private.tenho_papel(pc.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O termo de consentimento é do médico.';
  END IF;

  -- episódio: o do termo corrigido, o informado ou o da internação
  IF p_retifica IS NOT NULL THEN
    SELECT * INTO v_ant FROM public.documentos_clinicos WHERE id = p_retifica;
    IF NOT FOUND OR v_ant.paciente_id <> p_paciente OR v_ant.tipo_documento <> 'termo_consentimento' THEN
      RAISE EXCEPTION 'Termo a retificar não encontrado para este paciente.';
    END IF;
    v_epi := v_ant.episodio_id;
  ELSIF v_epi IS NULL AND p_internacao IS NOT NULL THEN
    SELECT i.episodio_id INTO v_epi FROM public.internacoes i WHERE i.id = p_internacao AND i.paciente_id = p_paciente;
    IF NOT FOUND THEN RAISE EXCEPTION 'A internação informada não é deste paciente.'; END IF;
  END IF;

  -- modelo (opcional): da unidade do paciente; novo termo só com modelo ativo
  IF nullif(p_dados ->> 'modelo_id', '') IS NOT NULL THEN
    SELECT * INTO m FROM public.termos_modelos WHERE id = (p_dados ->> 'modelo_id')::uuid;
    IF NOT FOUND OR m.unidade_id <> pc.unidade_id THEN RAISE EXCEPTION 'Modelo de termo não encontrado nesta unidade.'; END IF;
    IF p_retifica IS NULL AND NOT m.ativo THEN RAISE EXCEPTION 'Este modelo foi desativado pelo gestor.'; END IF;
  END IF;

  IF length(v_proc) < 3 THEN RAISE EXCEPTION 'Informe o procedimento.'; END IF;
  IF length(v_texto) < 20 THEN
    RAISE EXCEPTION 'Escreva as informações sobre o procedimento: o que é, benefícios, riscos e alternativas.';
  END IF;

  -- quem assina (Código Civil, arts. 3º, 4º e 1.690; decisão do RT 02/10/2026):
  -- < 16 representado (assina o responsável); 16 e 17 assistido (assina o
  -- paciente com o responsável); >= 18 assina o paciente. Sem nascimento, não sai.
  IF pc.data_nascimento IS NULL THEN
    RAISE EXCEPTION 'Cadastre a data de nascimento do paciente antes de emitir o termo: ela define quem assina.';
  END IF;
  v_idade := extract(year FROM age(private.data_atual(), pc.data_nascimento))::int;
  v_menor := v_idade < 16;
  v_assistido := v_idade >= 16 AND v_idade < 18;
  IF v_assinante NOT IN ('paciente', 'responsavel', 'ninguem_presente') THEN
    RAISE EXCEPTION 'Diga quem assina o termo.';
  END IF;
  IF v_assinante = 'paciente' AND v_menor THEN
    RAISE EXCEPTION 'Paciente com menos de 16 anos: o termo é assinado pelo responsável legal.';
  END IF;
  IF v_assinante <> 'paciente' AND NOT v_menor AND coalesce(length(v_sem_cond), 0) < 5 THEN
    RAISE EXCEPTION 'Diga por que o paciente não tem condições de assinar.';
  END IF;
  IF v_menor OR v_assinante = 'paciente' THEN v_sem_cond := NULL; END IF;

  IF v_assinante = 'responsavel' THEN
    v_resp := jsonb_build_object(
      'nome', btrim(coalesce(p_dados #>> '{responsavel,nome}', '')),
      'documento', btrim(coalesce(p_dados #>> '{responsavel,documento}', '')),
      'vinculo', btrim(coalesce(p_dados #>> '{responsavel,vinculo}', '')));
    IF length(v_resp ->> 'nome') < 3 THEN RAISE EXCEPTION 'Informe o nome do responsável.'; END IF;
    IF length(v_resp ->> 'documento') < 3 THEN RAISE EXCEPTION 'Informe o documento do responsável.'; END IF;
    IF length(v_resp ->> 'vinculo') < 2 THEN RAISE EXCEPTION 'Informe o vínculo do responsável com o paciente.'; END IF;
  END IF;
  -- 16 e 17 anos: o paciente assina assistido pelo responsável (que também
  -- assina) ou fica registrado por que o responsável não está presente
  IF v_assistido AND v_assinante = 'paciente' THEN
    IF nullif(btrim(coalesce(p_dados #>> '{responsavel,nome}', '')), '') IS NOT NULL THEN
      v_resp := jsonb_build_object(
        'nome', btrim(coalesce(p_dados #>> '{responsavel,nome}', '')),
        'documento', btrim(coalesce(p_dados #>> '{responsavel,documento}', '')),
        'vinculo', btrim(coalesce(p_dados #>> '{responsavel,vinculo}', '')));
      IF length(v_resp ->> 'nome') < 3 THEN RAISE EXCEPTION 'Informe o nome do responsável.'; END IF;
      IF length(v_resp ->> 'documento') < 3 THEN RAISE EXCEPTION 'Informe o documento do responsável.'; END IF;
      IF length(v_resp ->> 'vinculo') < 2 THEN RAISE EXCEPTION 'Informe o vínculo do responsável com o paciente.'; END IF;
      v_ausencia := NULL;
    ELSIF coalesce(length(v_ausencia), 0) < 10 THEN
      RAISE EXCEPTION 'Paciente de 16 ou 17 anos assina assistido pelo responsável: informe o responsável ou registre por que ele não está presente (mínimo de 10 letras).';
    END IF;
  ELSIF v_assinante = 'ninguem_presente' THEN
    IF coalesce(length(v_ausencia), 0) < 10 THEN
      RAISE EXCEPTION 'Registre por que não há responsável presente para assinar (mínimo de 10 letras).';
    END IF;
  ELSE
    v_ausencia := NULL;
  END IF;

  IF nullif(btrim(coalesce(p_dados #>> '{testemunha,nome}', '')), '') IS NOT NULL THEN
    v_test := jsonb_build_object('nome', btrim(p_dados #>> '{testemunha,nome}'),
                                 'documento', nullif(btrim(coalesce(p_dados #>> '{testemunha,documento}', '')), ''));
    IF length(v_test ->> 'nome') < 3 THEN RAISE EXCEPTION 'Nome da testemunha incompleto.'; END IF;
  END IF;

  -- campos preenchidos no servidor (o que sobrar de {campo} no texto editado)
  SELECT * INTO v_med FROM public.perfis WHERE id = v_perfil;
  SELECT u.nome INTO v_unidade_nome FROM public.unidades u WHERE u.id = pc.unidade_id;
  v_campos := jsonb_build_object(
    'paciente', coalesce(nullif(btrim(pc.nome_social), ''), pc.nome),
    'idade', CASE WHEN v_idade IS NULL THEN '' WHEN v_idade = 1 THEN '1 ano' ELSE v_idade || ' anos' END,
    'procedimento', v_proc,
    'medico', v_med.nome_completo,
    'crm', coalesce(v_med.crm || coalesce('/' || v_med.uf_crm, ''), ''),
    'unidade', v_unidade_nome,
    'data', to_char(private.data_atual(), 'DD/MM/YYYY'),
    'responsavel', coalesce(v_resp ->> 'nome', ''),
    'vinculo', coalesce(v_resp ->> 'vinculo', ''));
  v_texto := private.preencher_campos_termo(v_texto, v_campos);
  v_info := private.preencher_campos_termo(v_info, v_campos);
  v_decl := private.preencher_campos_termo(coalesce(nullif(btrim(m.declaracao), ''), private.declaracao_padrao_termo()), v_campos);

  v_conteudo := jsonb_build_object('termo', jsonb_build_object(
    'modelo', CASE WHEN m.id IS NOT NULL THEN jsonb_build_object('id', m.id, 'titulo', m.titulo, 'versao', m.versao) END,
    'procedimento', v_proc,
    'texto', v_texto,
    'informacoes', v_info,
    'declaracao', v_decl,
    'paciente', jsonb_build_object('nome', v_campos ->> 'paciente', 'idade_anos', v_idade, 'menor_14', v_idade < 14,
                                   'faixa', CASE WHEN v_menor THEN 'representado' WHEN v_assistido THEN 'assistido' ELSE 'capaz' END,
                                   'assistido', v_assistido AND v_assinante = 'paciente'),
    'assinante', v_assinante,
    'sem_condicoes_motivo', v_sem_cond,
    'responsavel', v_resp,
    'ausencia_motivo', v_ausencia,
    'testemunha', v_test,
    'medico', jsonb_build_object('nome', v_med.nome_completo, 'crm', v_med.crm, 'uf_crm', v_med.uf_crm)
    -- ONDA 6: 'assinatura' (assinatura digital do médico e coleta da assinatura do paciente/responsável)
  ))::text;

  -- duplo clique: o mesmo termo do mesmo autor em 2 min → o mesmo documento
  IF p_retifica IS NULL THEN
    SELECT * INTO r FROM public.documentos_clinicos
     WHERE paciente_id = p_paciente AND tipo_documento = 'termo_consentimento' AND autor_id = v_perfil AND estado = 'ativo'
       AND conteudo_hash = encode(extensions.digest(convert_to(v_conteudo, 'UTF8'), 'sha256'), 'hex')
       AND created_at > now() - interval '2 minutes'
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF r.id IS NULL THEN
    r := private.gravar_documento_episodio(NULL, p_paciente, 'termo_consentimento', v_conteudo, v_epi, p_retifica, p_motivo,
                                           v_perfil, now(), false, NULL);
    PERFORM private.registrar_auditoria(CASE WHEN p_retifica IS NULL THEN 'emitir_documento' ELSE 'retificar_documento' END,
      'documentos_clinicos', r.id, r.unidade_id, jsonb_build_object('tipo', 'termo_consentimento', 'assinante', v_assinante));
  END IF;
  RETURN jsonb_build_object('id', r.id, 'numero', r.numero, 'episodio_id', r.episodio_id, 'versao', r.versao);
END $function$;

-- public.termos_consentimento_do_paciente
CREATE OR REPLACE FUNCTION public.termos_consentimento_do_paciente(p_paciente uuid, p_episodio uuid DEFAULT NULL::uuid, p_internacao uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  pc public.pacientes;
  v_perfil uuid := private.meu_perfil_id();
  v_epi uuid := p_episodio;
  v_idade int;
  v_filtra boolean := p_episodio IS NOT NULL OR p_internacao IS NOT NULL;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pc FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.pode_atuar_no_paciente(p_paciente) IS TRUE
          OR private.acesso_encerrado_vigente(p_paciente) IS TRUE
          OR private.teleinterconsulta_vigente(p_paciente) IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF private.prontuario_aberto(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Abra o prontuário do paciente para ver os termos.';
  END IF;
  IF v_epi IS NULL AND p_internacao IS NOT NULL THEN
    SELECT i.episodio_id INTO v_epi FROM public.internacoes i WHERE i.id = p_internacao AND i.paciente_id = p_paciente;
  END IF;
  IF pc.data_nascimento IS NOT NULL THEN
    v_idade := extract(year FROM age(private.data_atual(), pc.data_nascimento))::int;
  END IF;

  RETURN jsonb_build_object(
    'paciente', jsonb_build_object(
      'nome', coalesce(nullif(btrim(pc.nome_social), ''), pc.nome),
      'idade_anos', v_idade,
      'menor_14', coalesce(v_idade < 14, false),
      -- quem assina o termo (decisão 2.1): representado < 16, assistido 16–17, capaz >= 18; null sem nascimento
      'faixa', CASE WHEN v_idade IS NULL THEN NULL WHEN v_idade < 16 THEN 'representado' WHEN v_idade < 18 THEN 'assistido' ELSE 'capaz' END,
      'responsavel', CASE WHEN nullif(btrim(pc.responsavel_nome), '') IS NOT NULL THEN jsonb_build_object(
        'nome', pc.responsavel_nome, 'vinculo', pc.responsavel_parentesco, 'documento', pc.responsavel_documento) END),
    'unidade', (SELECT u.nome FROM public.unidades u WHERE u.id = pc.unidade_id),
    'medico', (SELECT jsonb_build_object('id', f.id, 'nome', f.nome_completo, 'crm', f.crm, 'uf_crm', f.uf_crm)
                 FROM public.perfis f WHERE f.id = v_perfil),
    'pode_emitir', private.pode_atuar_no_paciente(p_paciente) IS TRUE AND private.tenho_papel(pc.unidade_id, 'plantonista'),
    'sou_gestor', private.eh_super_admin() OR private.tenho_papel(pc.unidade_id, 'gestor'),
    'declaracao_padrao', private.declaracao_padrao_termo(),
    'modelos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'procedimento', m.procedimento,
                                          'texto', m.texto, 'declaracao', m.declaracao, 'versao', m.versao)
             ORDER BY lower(m.titulo))
        FROM public.termos_modelos m
       WHERE m.unidade_id = pc.unidade_id AND m.vigente AND m.ativo), '[]'::jsonb),
    'termos', coalesce((
      SELECT jsonb_agg(t ORDER BY t ->> 'emitido_em' DESC)
        FROM (
          SELECT jsonb_build_object(
                   'id', d.id, 'raiz_id', d.documento_raiz_id, 'versao', d.versao, 'numero', d.numero,
                   'estado', d.estado, 'emitido_em', coalesce(d.emitido_em, d.created_at),
                   'primeira_emissao_em', (SELECT coalesce(p.emitido_em, p.created_at) FROM public.documentos_clinicos p
                                            WHERE p.documento_raiz_id = d.documento_raiz_id ORDER BY p.versao LIMIT 1),
                   'autor_id', d.autor_id,
                   'autor_original_id', (SELECT p.autor_id FROM public.documentos_clinicos p
                                          WHERE p.documento_raiz_id = d.documento_raiz_id ORDER BY p.versao LIMIT 1),
                   'autor', a.nome_completo, 'crm', a.crm, 'uf_crm', a.uf_crm,
                   'motivo_retificacao', d.motivo_retificacao,
                   'conteudo', CASE WHEN d.conteudo ~ '^\s*\{' THEN (d.conteudo::jsonb -> 'termo') END,
                   'cancelamento', (SELECT jsonb_build_object('motivo', c.motivo, 'em', c.cancelado_em,
                                                              'por', (SELECT f.nome_completo FROM public.perfis f WHERE f.id = c.cancelado_por))
                                      FROM public.termos_cancelamentos c WHERE c.documento_id = d.id),
                   'versoes', (SELECT jsonb_agg(jsonb_build_object('id', v.id, 'versao', v.versao, 'numero', v.numero,
                                                'estado', v.estado, 'emitido_em', coalesce(v.emitido_em, v.created_at),
                                                'motivo_retificacao', v.motivo_retificacao,
                                                'autor', (SELECT f.nome_completo FROM public.perfis f WHERE f.id = v.autor_id))
                                               ORDER BY v.versao)
                                 FROM public.documentos_clinicos v WHERE v.documento_raiz_id = d.documento_raiz_id)) t
            FROM public.documentos_clinicos d
            LEFT JOIN public.perfis a ON a.id = d.autor_id
           WHERE d.paciente_id = p_paciente
             AND d.tipo_documento = 'termo_consentimento'
             AND d.estado IN ('ativo', 'cancelado')  -- a versão em vigor (ou a cancelada) de cada termo
             AND (NOT v_filtra
                  OR (v_epi IS NOT NULL AND d.episodio_id = v_epi)
                  OR (p_internacao IS NOT NULL AND d.internacao_id = p_internacao))
        ) s), '[]'::jsonb));
END $function$;

-- public.observacao_iniciar_protocolo
CREATE OR REPLACE FUNCTION public.observacao_iniciar_protocolo(p_internacao uuid, p_sigla text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE i public.internacoes; pr public.protocolos_observacao; v_publico text; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM 1 FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  i := private.observacao_para_mim(p_internacao, true);
  SELECT * INTO pr FROM public.protocolos_observacao WHERE sigla = p_sigla AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo desconhecido.'; END IF;
  IF pr.publico <> 'todos' THEN
    SELECT CASE WHEN pa.data_nascimento IS NULL THEN 'desconhecido'
                WHEN pa.data_nascimento > (now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '14 years'
                THEN 'pediatrico' ELSE 'adulto' END
      INTO v_publico FROM public.pacientes pa WHERE pa.id = i.paciente_id;
    IF v_publico = 'desconhecido' THEN
      RAISE EXCEPTION 'Cadastre a data de nascimento do paciente: este protocolo depende da idade.';
    END IF;
    IF v_publico IS DISTINCT FROM pr.publico THEN RAISE EXCEPTION 'Este protocolo não é para a idade do paciente.'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.observacao_protocolos WHERE internacao_id = i.id AND encerrado_em IS NULL) THEN
    RAISE EXCEPTION 'Já há protocolo aberto para este paciente. Encerre-o antes.';
  END IF;
  INSERT INTO public.observacao_protocolos (unidade_id, paciente_id, internacao_id, sigla, nome, versao, fonte, etapas, iniciado_por)
  VALUES (i.unidade_id, i.paciente_id, i.id, pr.sigla, pr.nome, pr.versao, pr.fonte, pr.etapas, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- public.prescrever
CREATE OR REPLACE FUNCTION public.prescrever(p_paciente uuid, p_item jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_alergia text;
  v_presc uuid; v_unidade uuid; v_nasc date; v_peso numeric; v_desde timestamptz; v_id uuid;
  v_tipo text := coalesce(p_item ->> 'tipo', 'medicamento');
  m public.medicamento; dv record; al record;
  v_dil_id uuid; v_dil_versao int; v_dil_texto text;
  v_via text := upper(nullif(btrim(p_item ->> 'via'), ''));
  v_dil_div text := nullif(btrim(p_item ->> 'diluicao_divergente'), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, data_nascimento INTO v_unidade, v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT private.paciente_no_meu_plantao(p_paciente) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'A prescrição é do médico de plantão no setor do paciente.';
  END IF;

  IF v_tipo = 'cuidado' THEN
    IF length(btrim(coalesce(p_item ->> 'descricao', ''))) < 3 THEN RAISE EXCEPTION 'Descreva o cuidado.'; END IF;
  ELSIF v_tipo = 'medicamento' THEN
    SELECT * INTO m FROM public.medicamento WHERE id = nullif(p_item ->> 'medicamento_id', '')::uuid AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Escolha o medicamento do cadastro.'; END IF;
    IF length(btrim(coalesce(p_item ->> 'dose', ''))) = 0 THEN RAISE EXCEPTION 'Informe a dose.'; END IF;
    IF v_via IS NULL THEN RAISE EXCEPTION 'Informe a via.'; END IF;
    IF length(btrim(coalesce(p_item ->> 'posologia', ''))) = 0 THEN RAISE EXCEPTION 'Informe a frequência.'; END IF;
    -- alergia trava o item (e nada a contorna): mesmo medicamento, mesmo
    -- princípio ativo ou a classe (ATC) dele — private.alergia_que_trava
    v_alergia := private.alergia_que_trava(p_paciente, m.id);
    IF v_alergia IS NOT NULL THEN
      RAISE EXCEPTION 'ALERGIA: o paciente tem alergia registrada a "%". Este item não foi prescrito.', v_alergia;
    END IF;
    -- pediatria: peso aferido no episódio
    -- criança (até 13a11m29d) ou idade desconhecida: peso aferido no episódio
    IF v_nasc IS NULL OR v_nasc > (now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '14 years' THEN
      SELECT coalesce((SELECT chegada_em FROM public.episodios WHERE id = private.episodio_aberto(p_paciente)), now() - interval '24 hours') INTO v_desde;
      SELECT o.valor_num INTO v_peso FROM public.observacao o
        JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'peso' AND c.unidade_id IS NULL
       WHERE o.paciente_id = p_paciente AND o.aferido_em >= v_desde AND o.valor_num > 0
       ORDER BY o.aferido_em DESC LIMIT 1;
      IF v_peso IS NULL THEN
        RAISE EXCEPTION '%', CASE WHEN v_nasc IS NULL
          THEN 'Idade desconhecida: registre o peso aferido neste atendimento (ou a data de nascimento) antes de prescrever medicamento.'
          ELSE 'Criança: registre o peso aferido neste atendimento antes de prescrever medicamento.' END;
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo de item desconhecido.';
  END IF;

  v_presc := private.prescricao_do_paciente(p_paciente, true);
  IF v_presc IS NULL THEN RAISE EXCEPTION 'O paciente não tem episódio aberto nem internação ativa.'; END IF;
  IF v_tipo = 'medicamento' AND EXISTS (
       SELECT 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc AND medicamento_id = m.id AND upper(via) = v_via AND suspenso_em IS NULL) THEN
    RAISE EXCEPTION 'Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar.';
  END IF;

  -- diluição vigente agora (a da unidade tem preferência)
  IF v_tipo = 'medicamento' THEN
    SELECT * INTO dv FROM public.diluicao_vigente(m.id, v_via, now(), v_unidade);
    IF FOUND THEN v_dil_id := dv.id; v_dil_versao := dv.versao; v_dil_texto := dv.texto; END IF;
    IF v_dil_div IS NOT NULL AND length(btrim(coalesce(p_item ->> 'justificativa_divergencia', ''))) < 10 THEN
      RAISE EXCEPTION 'Diluição diferente do padrão só com justificativa (mínimo de 10 letras).';
    END IF;
  END IF;

  INSERT INTO public.prescricao_itens (prescricao_id, medicamento_id, descricao, dose, via, posologia, se_necessario, observacao,
    tipo, peso_kg, diluicao_id, diluicao_versao, diluicao_texto, diluicao_divergente, justificativa_divergencia, autor_id, ordem)
  VALUES (v_presc, m.id,
          CASE WHEN v_tipo = 'cuidado' THEN btrim(p_item ->> 'descricao') ELSE m.principio_ativo || coalesce(' ' || m.apresentacao, '') END,
          nullif(btrim(p_item ->> 'dose'), ''), v_via, nullif(btrim(p_item ->> 'posologia'), ''),
          coalesce((p_item ->> 'se_necessario')::boolean, false), nullif(btrim(p_item ->> 'observacao'), ''),
          v_tipo, v_peso, v_dil_id, v_dil_versao, coalesce(v_dil_div, v_dil_texto), v_dil_div IS NOT NULL,
          CASE WHEN v_dil_div IS NOT NULL THEN btrim(p_item ->> 'justificativa_divergencia') END,
          private.meu_perfil_id(),
          coalesce((SELECT max(ordem) + 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc), 1))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- private.sou_parecerista
CREATE OR REPLACE FUNCTION private.sou_parecerista(p_unidade uuid, p_especialidade text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = private.meu_perfil_id() AND v.unidade_id = p_unidade AND v.ativo
                    AND v.papel::text = 'plantonista')  -- 2.3: telemedicina lê só pela teleinterconsulta
     AND EXISTS (SELECT 1 FROM public.especialidades_perfil e
                  WHERE e.perfil_id = private.meu_perfil_id() AND e.especialidade = p_especialidade);
$function$;

-- public.pareceres_do_paciente
CREATE OR REPLACE FUNCTION public.pareceres_do_paciente(p_paciente uuid)
 RETURNS TABLE(id uuid, especialidade text, prestador text, prioridade text, pergunta text, status text, solicitante_nome text, solicitado_em timestamp with time zone, analista_nome text, analise_iniciada_em timestamp with time zone, resposta text, respondido_em timestamp with time zone, cancelado_nome text, cancelado_em timestamp with time zone, motivo_cancelamento text, documento_solicitacao_numero text, documento_resposta_numero text, episodio_id uuid, internacao_id uuid, meu_pedido boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_perfil uuid := private.meu_perfil_id(); v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE pacientes.id = p_paciente;
  IF v_perfil IS NULL OR v_unidade IS NULL OR NOT (
       private.pode_atuar_no_paciente(p_paciente) IS TRUE
    OR private.papel_na_unidade(v_unidade) = 'gestor'
    -- quem só pediu ou analisou vê enquanto o parecer está aberto e até 24 h depois
    OR EXISTS (SELECT 1 FROM public.pareceres_medicos x WHERE x.paciente_id = p_paciente
                AND (x.solicitante_id = v_perfil OR x.analista_id = v_perfil)
                AND (x.status IN ('solicitado', 'em_analise')
                     OR coalesce(x.respondido_em, x.cancelado_em) > now() - interval '24 hours'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT pm.id, pm.especialidade, pm.prestador, pm.prioridade, pm.pergunta, pm.status,
         ps.nome_completo, pm.solicitado_em, pa.nome_completo, pm.analise_iniciada_em,
         pm.resposta, pm.respondido_em, pc.nome_completo, pm.cancelado_em, pm.motivo_cancelamento,
         ds.numero, dr.numero, pm.episodio_id, pm.internacao_id, pm.solicitante_id = v_perfil
  FROM public.pareceres_medicos pm
  JOIN public.perfis ps ON ps.id = pm.solicitante_id
  LEFT JOIN public.perfis pa ON pa.id = pm.analista_id
  LEFT JOIN public.perfis pc ON pc.id = pm.cancelado_por
  LEFT JOIN public.documentos_clinicos ds ON ds.id = pm.documento_solicitacao_id
  LEFT JOIN public.documentos_clinicos dr ON dr.id = pm.documento_resposta_id
  WHERE pm.paciente_id = p_paciente
  ORDER BY pm.solicitado_em DESC;
END $function$;
