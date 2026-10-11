-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 11 — NIR (Núcleo Interno de Regulação), decisões do RT de
-- 11/10/2026 (BACKLOG.md).
--
-- • Papel próprio "nir" na unidade, dado pelo gestor (convite), com escala.
-- • Na regulação, operacional, sem ato médico: abre pedido (como NIR, com o
--   médico assistente), anexa documentos, responde pendência administrativa e
--   marca saída (na origem) e chegada (no destino). Aceite ou recusa como
--   destino, evolução clínica, correção do devolvido e cancelamento ficam com
--   médico e gestor.
-- • Painel de pendências da unidade: AIH (internação sem AIH, AIH sem decisão,
--   rejeitada sem nova), APAC (sem decisão, rejeitada sem nova) e regulações
--   (pendência e evolução vencidas, destino sem resposta, chegada sem
--   registro), cada uma com o responsável e o tempo parado.
-- • "Cobrar" manda aviso ao responsável, na categoria do assunto, e fica
--   registrado quem cobrou e quando.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.regulacao_solicitacoes DROP CONSTRAINT IF EXISTS regulacao_solicitacoes_solicitante_papel_check;
ALTER TABLE public.regulacao_solicitacoes ADD CONSTRAINT regulacao_solicitacoes_solicitante_papel_check
  CHECK (solicitante_papel IN ('medico', 'gestor', 'nir'));

-- NIR da unidade (origem ou destino do pedido)
CREATE OR REPLACE FUNCTION private.sou_nir(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_unidade IS NOT NULL AND private.tenho_papel(p_unidade, 'nir')
$$;
REVOKE ALL ON FUNCTION private.sou_nir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.sou_nir(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.regulacao_solicitar(p_unidade uuid, p_paciente uuid, p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  u public.unidades; c public.centrais_regulacao; s public.regulacao_solicitacoes; pa public.pacientes;
  v_papel text; v_medico uuid; v_ep uuid; v_int uuid; v_dest uuid; v_cid text; v_proc text; v_cbo text;
  v_nao_ident boolean; v_carater text; v_modalidade text; v_neonato boolean; v_dup boolean; v_vuln text[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade inexistente.'; END IF;
  IF private.tenho_papel(p_unidade, 'plantonista') THEN v_papel := 'medico';
  ELSIF private.tenho_papel(p_unidade, 'gestor') THEN v_papel := 'gestor';
  ELSIF private.sou_nir(p_unidade) THEN v_papel := 'nir';
  ELSE RAISE EXCEPTION 'Abre a solicitação o médico, o gestor ou o NIR da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO c FROM public.centrais_regulacao WHERE organizacao_id = u.organizacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'A rede ainda não tem Central de Regulação. Fale com a administração da plataforma.'; END IF;
  IF c.unidade_id = p_unidade THEN RAISE EXCEPTION 'A central não solicita regulação para si mesma.'; END IF;
  -- MIRA: CNES da unidade solicitante
  IF coalesce(u.cnes, '') !~ '^\d{7}$' THEN
    RAISE EXCEPTION 'A unidade precisa do CNES (Unidade › Configurações) para solicitar regulação.';
  END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente AND unidade_id = p_unidade AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado nesta unidade.'; END IF;
  -- MIRA: CNS ou CPF; sem nenhum dos dois, só com a marca de não identificado
  v_nao_ident := NOT (coalesce(private.cns_valido(pa.cns), false) OR coalesce(private.cpf_valido(pa.cpf), false));
  IF v_nao_ident AND NOT coalesce((d->>'paciente_nao_identificado')::boolean, false) THEN
    RAISE EXCEPTION 'O paciente está sem CNS e sem CPF válidos. Complete o cadastro ou marque como paciente não identificado.';
  END IF;

  -- vínculo opcional com atendimento ou internação aberta do mesmo paciente
  v_ep := nullif(d->>'episodio_id', '')::uuid;
  v_int := nullif(d->>'internacao_id', '')::uuid;
  IF v_ep IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = v_ep AND e.paciente_id = p_paciente
                                         AND e.unidade_id = p_unidade AND e.etapa <> 'encerrado') THEN
    RAISE EXCEPTION 'O atendimento informado não está aberto para este paciente.';
  END IF;
  IF v_int IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = v_int AND i.paciente_id = p_paciente
                                          AND i.unidade_id = p_unidade AND i.data_alta IS NULL) THEN
    RAISE EXCEPTION 'A internação informada não está aberta para este paciente.';
  END IF;

  -- médico assistente: o próprio médico; o gestor pode informar um médico da unidade
  IF v_papel = 'medico' THEN
    v_medico := private.meu_perfil_id();
  ELSE
    v_medico := nullif(d->>'medico_assistente_id', '')::uuid;
    IF v_medico IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = v_medico
                                              AND v.unidade_id = p_unidade AND v.ativo AND v.papel = 'plantonista') THEN
      RAISE EXCEPTION 'O médico assistente precisa ser médico da unidade.';
    END IF;
    -- o NIR não faz ato médico: abre o pedido em nome do médico assistente
    IF v_papel = 'nir' AND v_medico IS NULL THEN
      RAISE EXCEPTION 'O NIR abre o pedido com o médico assistente.';
    END IF;
  END IF;

  -- CID como na tabela (J18.9); aceita também sem o ponto (J189)
  v_cid := upper(btrim(coalesce(d->>'cid', '')));
  IF v_cid ~ '^[A-Z]\d{3}$' THEN v_cid := left(v_cid, 3) || '.' || right(v_cid, 1); END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.cid10 x WHERE x.codigo = v_cid) THEN
    RAISE EXCEPTION 'Informe um CID-10 válido.';
  END IF;
  -- MIRA: procedimento SIGTAP em todo pedido
  v_proc := regexp_replace(coalesce(d->>'procedimento', ''), '\D', '', 'g');
  IF NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento p WHERE p.codigo = v_proc) THEN
    RAISE EXCEPTION 'Informe o procedimento do SIGTAP (no leito, o procedimento da internação).';
  END IF;
  IF d->>'tipo' = 'consulta' THEN
    v_cbo := regexp_replace(coalesce(d->>'cbo', ''), '\D', '', 'g');
    IF NOT EXISTS (SELECT 1 FROM terminologia.cbo x WHERE x.codigo = v_cbo) THEN
      RAISE EXCEPTION 'Na consulta, informe a especialidade pelo CBO.';
    END IF;
  END IF;
  IF d->>'destino_tipo' = 'rede' THEN
    v_dest := nullif(d->>'destino_unidade_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.unidades x WHERE x.id = v_dest AND x.ativo AND x.organizacao_id = u.organizacao_id
                     AND x.id <> c.unidade_id) THEN
      RAISE EXCEPTION 'O destino precisa ser uma unidade ativa da rede.';
    END IF;
    IF v_dest = p_unidade THEN RAISE EXCEPTION 'O destino não pode ser a própria unidade.'; END IF;
  END IF;
  -- transporte de recém-nascido: incubadora precisa ser informada (Portaria 2.048/2002)
  v_neonato := pa.data_nascimento IS NOT NULL AND pa.data_nascimento > current_date - 28;
  IF d->>'tipo' = 'transferencia' AND v_neonato AND (d->>'incubadora') IS NULL THEN
    RAISE EXCEPTION 'Recém-nascido: informe se a transferência precisa de incubadora.';
  END IF;

  -- marcadores de vulnerabilidade (selos, sem pontuação)
  v_vuln := CASE WHEN jsonb_typeof(d->'vulnerabilidades') = 'array'
                 THEN ARRAY(SELECT DISTINCT jsonb_array_elements_text(d->'vulnerabilidades') ORDER BY 1) ELSE '{}' END;
  IF NOT v_vuln <@ ARRAY['gestante', 'idoso', 'crianca', 'pcd', 'situacao_rua', 'oncologico', 'judicializado'] THEN
    RAISE EXCEPTION 'Marcador de vulnerabilidade desconhecido.';
  END IF;

  v_carater := d->>'carater';
  -- MIRA, modalidade: leito e transferência são hospitalares; urgência é 06; o resto, ambulatorial especializada
  v_modalidade := CASE WHEN d->>'tipo' IN ('leito', 'transferencia') THEN '04'
                       WHEN v_carater = 'urgencia' THEN '06' ELSE '07' END;

  -- aviso de duplicidade: pedido aberto do mesmo paciente para o mesmo procedimento ou tipo de leito
  v_dup := EXISTS (SELECT 1 FROM public.regulacao_solicitacoes x
                    WHERE x.paciente_id = p_paciente
                      AND x.status IN ('rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida', 'autorizada', 'agendada', 'em_transito')
                      AND (x.procedimento = v_proc OR (d->>'tipo' = 'leito' AND x.tipo_leito = d->>'tipo_leito')));

  BEGIN
    INSERT INTO public.regulacao_solicitacoes (organizacao_id, central_id, unidade_origem_id, cnes_solicitante,
      paciente_id, paciente_nao_identificado, episodio_id, internacao_id,
      tipo, procedimento, especialidade, cbo, tipo_leito, internacao_psiquiatrica, isolamento, isolamento_tipo,
      transporte, incubadora, destino_tipo, destino_unidade_id, destino_externo,
      carater, modalidade, prioridade, cid,
      quadro_clinico, tempo_evolucao, sinais_vitais, exames, medicacoes, hipotese, telefone_contato,
      medico_assistente_id, solicitante_id, solicitante_papel, vulnerabilidades)
    VALUES (u.organizacao_id, c.unidade_id, p_unidade, u.cnes,
      p_paciente, v_nao_ident, v_ep, v_int,
      d->>'tipo', v_proc,
      CASE WHEN d->>'tipo' = 'consulta' THEN nullif(btrim(coalesce(d->>'especialidade', '')), '') END,
      CASE WHEN d->>'tipo' = 'consulta' THEN v_cbo END,
      CASE WHEN d->>'tipo' IN ('leito', 'transferencia') THEN nullif(d->>'tipo_leito', '') END,
      CASE WHEN d->>'tipo_leito' = 'psiquiatrico' THEN nullif(d->>'internacao_psiquiatrica', '') END,
      coalesce((d->>'isolamento')::boolean, false),
      CASE WHEN coalesce((d->>'isolamento')::boolean, false) THEN nullif(d->>'isolamento_tipo', '') END,
      CASE WHEN d->>'tipo' = 'transferencia' THEN nullif(d->>'transporte', '') END,
      CASE WHEN d->>'tipo' = 'transferencia' THEN (d->>'incubadora')::boolean END,
      d->>'destino_tipo', v_dest,
      CASE WHEN d->>'destino_tipo' = 'externo' THEN btrim(coalesce(d->>'destino_externo', '')) END,
      v_carater, v_modalidade, d->>'prioridade', v_cid,
      btrim(coalesce(d->>'quadro_clinico', '')),
      nullif(btrim(coalesce(d->>'tempo_evolucao', '')), ''), nullif(btrim(coalesce(d->>'sinais_vitais', '')), ''),
      nullif(btrim(coalesce(d->>'exames', '')), ''), nullif(btrim(coalesce(d->>'medicacoes', '')), ''),
      nullif(btrim(coalesce(d->>'hipotese', '')), ''), nullif(btrim(coalesce(d->>'telefone_contato', '')), ''),
      v_medico, private.meu_perfil_id(), v_papel, v_vuln)
    RETURNING * INTO s;
  EXCEPTION WHEN check_violation OR not_null_violation THEN
    RAISE EXCEPTION 'Confira o pedido: tipo e o campo do tipo (especialidade, tipo de leito, transporte), isolamento, internação psiquiátrica, destino, caráter, prioridade e quadro clínico (mínimo de 20 letras).';
  END;
  PERFORM private.regulacao_evento(s.id, 'enviada', jsonb_build_object('papel', v_papel, 'duplicidade', v_dup));
  PERFORM private.registrar_auditoria('regulacao_solicitada', 'regulacao_solicitacoes', s.id, p_unidade,
    jsonb_build_object('tipo', s.tipo, 'prioridade', s.prioridade, 'carater', s.carater, 'central', c.unidade_id));
  RETURN jsonb_build_object('id', s.id, 'numero', s.numero, 'aviso_duplicidade', v_dup);
END $function$
;

CREATE OR REPLACE FUNCTION public.regulacao_contexto(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.centrais_regulacao;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT cr.* INTO c FROM public.centrais_regulacao cr JOIN public.unidades u ON u.organizacao_id = cr.organizacao_id
   WHERE u.id = p_unidade;
  RETURN jsonb_build_object(
    'central', CASE WHEN c.unidade_id IS NULL THEN NULL
                    ELSE (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = c.unidade_id) END,
    'sou_central', c.unidade_id = p_unidade,
    'pode_solicitar', private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor') OR private.sou_nir(p_unidade),
    'sou_nir', private.sou_nir(p_unidade),
    'sou_regulador', c.unidade_id IS NOT NULL AND private.tenho_papel(c.unidade_id, 'regulador'),
    'sou_super_admin', private.eh_super_admin(),
    -- unidades da rede, para o destino
    'unidades_rede', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) ORDER BY u.nome)
                       FROM public.unidades u
                      WHERE u.ativo AND u.organizacao_id = (SELECT organizacao_id FROM public.unidades WHERE id = p_unidade)
                        AND u.id IS DISTINCT FROM c.unidade_id), '[]'::jsonb));
END $function$
;

CREATE OR REPLACE FUNCTION public.regulacao_vinculos_paciente(p_paciente uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_unidade uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR NOT (private.tenho_papel(v_unidade, 'plantonista') OR private.tenho_papel(v_unidade, 'gestor') OR private.sou_nir(v_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    -- MIRA: sem CNS nem CPF válidos, o pedido sai marcado como paciente não identificado
    'tem_documento', (SELECT coalesce(private.cns_valido(pa.cns), false) OR coalesce(private.cpf_valido(pa.cpf), false)
                        FROM public.pacientes pa WHERE pa.id = p_paciente),
    'nascimento', (SELECT pa.data_nascimento FROM public.pacientes pa WHERE pa.id = p_paciente),
    'episodio', (SELECT jsonb_build_object('id', e.id, 'chegada_em', e.chegada_em, 'etapa', e.etapa) FROM public.episodios e
                  WHERE e.paciente_id = p_paciente AND e.unidade_id = v_unidade AND e.etapa <> 'encerrado'
                  ORDER BY e.chegada_em DESC LIMIT 1),
    'internacao', (SELECT jsonb_build_object('id', i.id, 'admissao_em', i.data_admissao,
                     'leito', (SELECT l.identificador FROM public.leitos l WHERE l.id = i.leito_atual_id)) FROM public.internacoes i
                    WHERE i.paciente_id = p_paciente AND i.unidade_id = v_unidade AND i.data_alta IS NULL
                    ORDER BY i.data_admissao DESC LIMIT 1),
    'medicos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome_completo) ORDER BY p.nome_completo)
                  FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
                 WHERE v.unidade_id = v_unidade AND v.ativo AND v.papel = 'plantonista'), '[]'::jsonb));
END $function$
;

CREATE OR REPLACE FUNCTION public.regulacao_documentos_do_paciente(p_paciente uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR NOT (private.tenho_papel(v_unidade, 'plantonista') OR private.tenho_papel(v_unidade, 'gestor') OR private.sou_nir(v_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'tipo', d.tipo_documento, 'numero', d.numero, 'versao', d.versao,
      'emitido_em', coalesce(d.emitido_em, d.created_at), 'autor', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = d.autor_id))
      ORDER BY coalesce(d.emitido_em, d.created_at) DESC)
    FROM (SELECT DISTINCT ON (dc.documento_raiz_id) dc.* FROM public.documentos_clinicos dc
           WHERE dc.paciente_id = p_paciente AND dc.estado NOT IN ('rascunho', 'cancelado')
           ORDER BY dc.documento_raiz_id, dc.versao DESC) d), '[]'::jsonb);
END $function$
;

CREATE OR REPLACE FUNCTION private.regulacao_pode_ver(s regulacao_solicitacoes)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT private.eh_super_admin()
      OR private.tenho_papel(s.unidade_origem_id, 'plantonista') OR private.tenho_papel(s.unidade_origem_id, 'gestor')
      OR private.sou_nir(s.unidade_origem_id)
      OR private.tenho_papel(s.central_id, 'regulador') OR private.tenho_papel(s.central_id, 'gestor')
      OR (s.status IN ('aguardando_destino', 'autorizada', 'agendada', 'em_transito', 'realizada', 'falta')
          AND (private.regulacao_sou_destino(s) OR private.sou_nir(s.destino_unidade_id)))
$function$
;

CREATE OR REPLACE FUNCTION public.regulacao_lista(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_central boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_central := EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_unidade);
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor') OR private.tenho_papel(p_unidade, 'plantonista') OR private.sou_nir(p_unidade)
          OR (v_central AND private.tenho_papel(p_unidade, 'regulador'))) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.regulacao_json(s) ORDER BY s.criada_em DESC)
    FROM (SELECT * FROM public.regulacao_solicitacoes
           WHERE (v_central AND central_id = p_unidade) OR (NOT v_central AND unidade_origem_id = p_unidade)
           ORDER BY criada_em DESC LIMIT 200) s), '[]'::jsonb);
END $function$
;

CREATE OR REPLACE FUNCTION private.regulacao_pode_anexar(s regulacao_solicitacoes)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT private.regulacao_origem_pode(s) OR private.sou_nir(s.unidade_origem_id) OR private.tenho_papel(s.central_id, 'regulador')
$function$
;

CREATE OR REPLACE FUNCTION public.regulacao_responder_pendencia(p_id uuid, p_resposta text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT (private.regulacao_origem_pode(s) OR private.sou_nir(s.unidade_origem_id)) THEN
    RAISE EXCEPTION 'Responde o solicitante, o médico assistente, o gestor ou o NIR da origem.' USING ERRCODE = 'insufficient_privilege';
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
END $function$
;

CREATE OR REPLACE FUNCTION public.regulacao_marcar_saida(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT (private.regulacao_origem_pode(s) OR private.tenho_papel(s.unidade_origem_id, 'plantonista') OR private.sou_nir(s.unidade_origem_id)) THEN
    RAISE EXCEPTION 'Marca a saída a equipe médica, o gestor ou o NIR da origem.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('autorizada', 'agendada') THEN RAISE EXCEPTION 'Só sai o paciente com o pedido aceito pelo destino.'; END IF;
  UPDATE public.regulacao_solicitacoes SET status = 'em_transito', saida_em = now(), saida_por = private.meu_perfil_id()
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_estender_reserva(s, 8);
  PERFORM private.regulacao_evento(s.id, 'saiu', NULL);
  PERFORM private.regulacao_avisar_destino(s, 'reg_saiu', 'Regulação nº ' || s.numero || ': o paciente saiu da origem.');
  RETURN private.regulacao_json(s);
END $function$
;

CREATE OR REPLACE FUNCTION public.regulacao_marcar_chegada(p_id uuid, p_chegou boolean, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.regulacao_solicitacoes; v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT ((s.destino_tipo = 'rede' AND (private.regulacao_sou_destino(s) OR private.sou_nir(s.destino_unidade_id)))
          OR (s.destino_tipo = 'externo' AND private.tenho_papel(s.central_id, 'regulador'))) THEN
    RAISE EXCEPTION 'Marca a chegada a unidade destino (ou a central, se o destino é de fora da rede).' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('autorizada', 'agendada', 'em_transito') THEN RAISE EXCEPTION 'Este pedido não está esperando a chegada do paciente.'; END IF;
  IF NOT p_chegou AND length(coalesce(v_obs, '')) < 10 THEN RAISE EXCEPTION 'Escreva o que aconteceu (mínimo de 10 letras).'; END IF;
  IF p_chegou THEN
    UPDATE public.regulacao_solicitacoes SET status = 'realizada', realizada_em = now(), chegada_por = private.meu_perfil_id(),
           chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
    PERFORM private.regulacao_estender_reserva(s, 8);   -- pronta para ocupar o leito
    PERFORM private.regulacao_evento(s.id, 'chegou', jsonb_build_object('observacao', v_obs));
  ELSE
    UPDATE public.regulacao_solicitacoes SET status = 'falta', falta_em = now(), chegada_por = private.meu_perfil_id(),
           chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
    PERFORM private.regulacao_liberar_reserva(s, 'Regulação nº ' || s.numero || ': paciente não chegou');
    PERFORM private.regulacao_evento(s.id, 'nao_chegou', jsonb_build_object('observacao', v_obs));
    PERFORM private.regulacao_avisar(s, 'reg_nao_chegou', 'Regulação nº ' || s.numero || ': o destino registrou que o paciente não chegou — ' || v_obs);
  END IF;
  PERFORM private.registrar_auditoria('regulacao_chegada', 'regulacao_solicitacoes', s.id, coalesce(s.destino_unidade_id, s.central_id),
    jsonb_build_object('status', s.status));
  RETURN private.regulacao_json(s);
END $function$
;

CREATE OR REPLACE FUNCTION public.regulacao_destino_lista(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor') OR private.sou_nir(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.regulacao_json(s)
           ORDER BY (s.status = 'aguardando_destino') DESC, (s.status IN ('autorizada', 'agendada', 'em_transito')) DESC,
                    coalesce(s.destino_enviado_em, s.autorizada_em, s.criada_em) DESC)
    FROM (SELECT * FROM public.regulacao_solicitacoes
           WHERE destino_unidade_id = p_unidade
             AND status IN ('aguardando_destino', 'autorizada', 'agendada', 'em_transito', 'realizada', 'falta')
           ORDER BY coalesce(destino_enviado_em, autorizada_em, criada_em) DESC LIMIT 200) s), '[]'::jsonb);
END $function$
;

CREATE OR REPLACE FUNCTION public.regulacao_sla_painel(p_unidade uuid, p_filtros jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_central boolean;
  v_so_atrasados boolean := coalesce((f->>'so_atrasados')::boolean, false);
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_central := EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_unidade);
  IF v_central THEN
    IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'regulador') OR private.tenho_papel(p_unidade, 'gestor')) THEN
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NOT (private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor') OR private.sou_nir(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN (
    WITH base AS (
      SELECT s, private.regulacao_sla(s) AS sla
        FROM public.regulacao_solicitacoes s
       WHERE s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino')
         AND ((v_central AND s.central_id = p_unidade) OR (NOT v_central AND s.unidade_origem_id = p_unidade))
    ), filtrada AS (
      SELECT b.* FROM base b
       WHERE (NOT f ? 'tipo' OR (b.s).tipo = f->>'tipo')
         AND (NOT f ? 'prioridade' OR coalesce((b.s).prioridade_regulador, (b.s).prioridade) = f->>'prioridade')
         AND (NOT v_so_atrasados OR (b.sla->>'atrasado_central')::boolean OR (b.sla->>'atrasado_origem')::boolean
              OR (b.sla->>'atrasado_destino')::boolean)
    )
    SELECT jsonb_build_object(
      'central', v_central,
      'dados', coalesce((SELECT jsonb_agg(private.regulacao_json_fila(x.s) ORDER BY
                 CASE WHEN v_central THEN (x.sla->>'atrasado_central')::boolean OR (x.sla->>'atrasado_destino')::boolean
                      ELSE (x.sla->>'atrasado_origem')::boolean END DESC,
                 ((x.sla->>'atrasado_central')::boolean OR (x.sla->>'atrasado_origem')::boolean OR (x.sla->>'atrasado_destino')::boolean) DESC,
                 CASE coalesce((x.s).prioridade_regulador, (x.s).prioridade)
                   WHEN 'emergencia' THEN 1 WHEN 'urgencia' THEN 2 WHEN 'prioritaria' THEN 3 WHEN 'eletiva' THEN 4 ELSE 5 END,
                 (x.s).criada_em)
          FROM (SELECT * FROM filtrada LIMIT 500) x), '[]'::jsonb),
      'resumo', (SELECT jsonb_build_object(
          'abertos', count(*),
          'fila_atrasada', count(*) FILTER (WHERE (b.sla->>'atrasado_central')::boolean),
          'fila_sem_prazo', count(*) FILTER (WHERE b.sla->'fila'->'prazo_min' = 'null'::jsonb),
          'pendencia_atrasada', count(*) FILTER (WHERE (b.sla->'pendencia'->>'atrasada')::boolean),
          'evolucao_atrasada', count(*) FILTER (WHERE (b.sla->'evolucao'->>'atrasada')::boolean),
          'risco_cancelamento', count(*) FILTER (WHERE (b.sla->'evolucao'->>'risco_cancelamento')::boolean),
          'destino_atrasado', count(*) FILTER (WHERE (b.sla->>'atrasado_destino')::boolean))
        FROM base b),
      'prazos', private.regulacao_prazos_json(CASE WHEN v_central THEN p_unidade
                  ELSE (SELECT c.unidade_id FROM public.centrais_regulacao c JOIN public.unidades u ON u.organizacao_id = c.organizacao_id
                         WHERE u.id = p_unidade) END),
      'agora', now()));
END $function$
;

CREATE OR REPLACE FUNCTION private.regulacao_origem_pode(s regulacao_solicitacoes)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT (s.solicitante_id = private.meu_perfil_id() AND s.solicitante_papel <> 'nir')
      OR s.medico_assistente_id IS NOT DISTINCT FROM private.meu_perfil_id() AND s.medico_assistente_id IS NOT NULL
      OR private.tenho_papel(s.unidade_origem_id, 'gestor')
$function$
;

CREATE OR REPLACE FUNCTION public.regulacao_cancelar(p_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.regulacao_solicitacoes; v_tinha_destino boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT ((s.solicitante_id = private.meu_perfil_id() AND s.solicitante_papel <> 'nir')
          OR (s.solicitante_papel = 'nir' AND s.medico_assistente_id = private.meu_perfil_id())
          OR private.tenho_papel(s.unidade_origem_id, 'gestor')) THEN
    RAISE EXCEPTION 'Cancela quem solicitou ou o gestor da unidade de origem.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino', 'autorizada', 'agendada') THEN
    RAISE EXCEPTION 'Esta solicitação não pode mais ser cancelada.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  v_tinha_destino := s.status IN ('aguardando_destino', 'autorizada', 'agendada');
  UPDATE public.regulacao_solicitacoes SET status = 'cancelada', cancelada_em = now(), cancelada_por = private.meu_perfil_id(),
         cancelamento_origem = 'solicitante', motivo_cancelamento = btrim(p_motivo) WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_liberar_reserva(s, 'Regulação nº ' || s.numero || ' cancelada pela origem');
  PERFORM private.regulacao_evento(s.id, 'cancelada', jsonb_build_object('motivo', btrim(p_motivo)));
  PERFORM private.registrar_auditoria('regulacao_cancelada', 'regulacao_solicitacoes', s.id, s.unidade_origem_id,
    jsonb_build_object('motivo', btrim(p_motivo)));
  IF v_tinha_destino THEN
    PERFORM private.regulacao_avisar_destino(s, 'reg_cancelada', 'Regulação nº ' || s.numero || ' cancelada pela origem: ' || btrim(p_motivo));
    PERFORM private.regulacao_avisar_regulador(s, 'reg_cancelada', 'Regulação nº ' || s.numero || ' cancelada pela origem: ' || btrim(p_motivo));
  END IF;
END $function$
;

-- ── painel do NIR ───────────────────────────────────────────────────────────
-- cobranças feitas pelo NIR, só inserção
CREATE TABLE IF NOT EXISTS public.nir_cobrancas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  tipo           text NOT NULL,
  ref_id         uuid NOT NULL,
  destinatarios  uuid[] NOT NULL,
  por            uuid NOT NULL REFERENCES public.perfis(id),
  em             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nir_cobrancas ON public.nir_cobrancas (unidade_id, tipo, ref_id, em DESC);
DROP TRIGGER IF EXISTS trg_nir_cobrancas_so_insercao ON public.nir_cobrancas;
CREATE TRIGGER trg_nir_cobrancas_so_insercao BEFORE UPDATE OR DELETE ON public.nir_cobrancas
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.nir_cobrancas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nir_cobrancas FROM anon, authenticated;

-- Médicos no plantão agora (no setor, se informado); sem ninguém escalado,
-- os médicos da unidade.
CREATE OR REPLACE FUNCTION private.nir_medicos_plantao(p_unidade uuid, p_setor uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    nullif(ARRAY(SELECT DISTINCT e.perfil_id FROM public.escala_plantao e
                  JOIN public.vinculos v ON v.perfil_id = e.perfil_id AND v.unidade_id = e.unidade_id AND v.ativo AND v.papel = 'plantonista'
                 WHERE e.unidade_id = p_unidade AND e.ativo AND (p_setor IS NULL OR e.setor_id = p_setor)
                   AND now() >= e.inicio AND now() < e.inicio + make_interval(mins => e.duracao_min)), '{}'),
    ARRAY(SELECT DISTINCT v.perfil_id FROM public.vinculos v WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel = 'plantonista'))
$$;
REVOKE ALL ON FUNCTION private.nir_medicos_plantao(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.nir_com_papel(p_unidade uuid, p_papeis text[])
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ARRAY(SELECT DISTINCT v.perfil_id FROM public.vinculos v
                WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel::text = ANY (p_papeis))
$$;
REVOKE ALL ON FUNCTION private.nir_com_papel(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- Pendências da unidade: o que está parado, desde quando e de quem é.
CREATE OR REPLACE FUNCTION private.nir_itens(p_unidade uuid)
RETURNS TABLE (tipo text, grupo text, ref_id uuid, titulo text, paciente_id uuid, desde timestamptz,
               responsaveis uuid[], responsavel_rotulo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  -- AIH: internação aberta sem AIH (fora a observação)
  SELECT 'aih_sem_aih', 'aih', i.id, 'Internação sem AIH solicitada', i.paciente_id, i.data_admissao,
         private.nir_medicos_plantao(p_unidade, i.setor_atual_id), 'Médicos no plantão do setor'
    FROM public.internacoes i
   WHERE i.unidade_id = p_unidade AND i.data_alta IS NULL AND i.tipo_internacao <> 'observacao'
     AND NOT EXISTS (SELECT 1 FROM public.aihs a WHERE a.internacao_id = i.id AND a.status <> 'cancelada')
  UNION ALL
  -- AIH solicitada sem decisão
  SELECT 'aih_sem_decisao', 'aih', a.id, 'AIH solicitada sem decisão', a.paciente_id, a.solicitada_em,
         private.nir_com_papel(p_unidade, ARRAY['regulador']), 'Médico regulador da unidade'
    FROM public.aihs a WHERE a.unidade_id = p_unidade AND a.status = 'solicitada'
  UNION ALL
  -- AIH rejeitada sem nova solicitação para a mesma internação
  SELECT 'aih_rejeitada', 'aih', a.id, 'AIH rejeitada sem nova solicitação' || coalesce(' (' || a.motivo || ')', ''), a.paciente_id,
         coalesce(a.decidida_em, a.atualizada_em), ARRAY[a.solicitada_por], NULL
    FROM public.aihs a
   WHERE a.unidade_id = p_unidade AND a.status = 'rejeitada'
     AND NOT EXISTS (SELECT 1 FROM public.aihs b WHERE b.internacao_id IS NOT DISTINCT FROM a.internacao_id AND b.paciente_id = a.paciente_id
                       AND b.id <> a.id AND b.status IN ('solicitada', 'aprovada') AND b.solicitada_em > coalesce(a.decidida_em, a.solicitada_em))
  UNION ALL
  -- APAC solicitada sem decisão
  SELECT 'apac_sem_decisao', 'apac', p.id, 'APAC solicitada sem decisão (' || p.procedimento || ')', p.paciente_id, p.solicitada_em,
         private.nir_com_papel(p_unidade, ARRAY['regulador']), 'Médico regulador da unidade'
    FROM public.apacs p WHERE p.unidade_id = p_unidade AND p.status = 'solicitada'
  UNION ALL
  -- APAC rejeitada sem nova solicitação do mesmo procedimento
  SELECT 'apac_rejeitada', 'apac', p.id, 'APAC rejeitada sem nova solicitação (' || p.procedimento || ')', p.paciente_id,
         coalesce(p.decidida_em, p.atualizada_em), ARRAY[p.solicitada_por], NULL
    FROM public.apacs p
   WHERE p.unidade_id = p_unidade AND p.status = 'rejeitada'
     AND NOT EXISTS (SELECT 1 FROM public.apacs q WHERE q.paciente_id = p.paciente_id AND q.procedimento = p.procedimento AND q.id <> p.id
                       AND q.status IN ('solicitada', 'autorizada') AND q.solicitada_em > coalesce(p.decidida_em, p.solicitada_em))
  UNION ALL
  -- regulação na origem: pendência ou devolução sem resposta no prazo
  SELECT 'reg_pendencia', 'regulacao', s.id,
         'Regulação nº ' || s.numero || ': ' || CASE s.status WHEN 'pendencia' THEN 'pergunta da central' ELSE 'pedido devolvido' END || ' sem resposta',
         s.paciente_id, (x.sla->'pendencia'->>'desde')::timestamptz,
         ARRAY(SELECT DISTINCT q FROM unnest(ARRAY[s.solicitante_id, s.medico_assistente_id]) q WHERE q IS NOT NULL), NULL
    FROM public.regulacao_solicitacoes s CROSS JOIN LATERAL (SELECT private.regulacao_sla(s) AS sla) x
   WHERE s.unidade_origem_id = p_unidade AND s.status IN ('pendencia', 'devolvida') AND (x.sla->'pendencia'->>'atrasada')::boolean
  UNION ALL
  -- regulação na origem: evolução vencida
  SELECT 'reg_evolucao', 'regulacao', s.id,
         'Regulação nº ' || s.numero || ': evolução vencida' || CASE WHEN (x.sla->'evolucao'->>'risco_cancelamento')::boolean
           THEN ' (risco de cancelamento)' ELSE '' END,
         s.paciente_id, (x.sla->'evolucao'->>'ultima_em')::timestamptz,
         ARRAY(SELECT DISTINCT q FROM unnest(ARRAY[s.solicitante_id, s.medico_assistente_id]) q WHERE q IS NOT NULL), NULL
    FROM public.regulacao_solicitacoes s CROSS JOIN LATERAL (SELECT private.regulacao_sla(s) AS sla) x
   WHERE s.unidade_origem_id = p_unidade AND (x.sla->'evolucao'->>'atrasada')::boolean
  UNION ALL
  -- regulação no destino: sem resposta no prazo
  SELECT 'reg_destino', 'regulacao', s.id, 'Regulação nº ' || s.numero || ': pedido recebido sem resposta da unidade',
         s.paciente_id, (x.sla->'destino'->>'desde')::timestamptz,
         private.nir_medicos_plantao(p_unidade, NULL) || private.nir_com_papel(p_unidade, ARRAY['gestor']), 'Médicos no plantão e gestor'
    FROM public.regulacao_solicitacoes s CROSS JOIN LATERAL (SELECT private.regulacao_sla(s) AS sla) x
   WHERE s.destino_unidade_id = p_unidade AND s.status = 'aguardando_destino' AND (x.sla->>'atrasado_destino')::boolean
  UNION ALL
  -- regulação no destino: paciente a caminho sem registro de chegada
  SELECT 'reg_chegada', 'regulacao', s.id, 'Regulação nº ' || s.numero || ': paciente a caminho sem registro de chegada',
         s.paciente_id, s.saida_em,
         private.nir_medicos_plantao(p_unidade, NULL) || private.nir_com_papel(p_unidade, ARRAY['gestor']), 'Médicos no plantão e gestor'
    FROM public.regulacao_solicitacoes s
   WHERE s.destino_unidade_id = p_unidade AND s.status = 'em_transito'
$$;
REVOKE ALL ON FUNCTION private.nir_itens(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.nir_exigir(p_unidade uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.tenho_papel(p_unidade, 'gestor') THEN RETURN; END IF;
  IF NOT private.sou_nir(p_unidade) THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT private.na_escala_agora(p_unidade) THEN
    RAISE EXCEPTION 'Fora do plantão: o NIR entra pela escala.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.nir_exigir(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nir_pendencias(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.nir_exigir(p_unidade);
  RETURN (
    WITH it AS (SELECT * FROM private.nir_itens(p_unidade))
    SELECT jsonb_build_object(
      'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'tipo', it.tipo, 'grupo', it.grupo, 'ref_id', it.ref_id, 'titulo', it.titulo, 'desde', it.desde,
          'parado_seg', floor(extract(epoch FROM now() - it.desde))::bigint,
          'paciente', (SELECT coalesce(pa.nome_social, pa.nome) FROM public.pacientes pa WHERE pa.id = it.paciente_id),
          'responsavel', coalesce(it.responsavel_rotulo,
              (SELECT string_agg(p.nome_completo, ', ' ORDER BY p.nome_completo) FROM public.perfis p WHERE p.id = ANY (it.responsaveis))),
          'responsaveis', (SELECT coalesce(jsonb_agg(p.nome_completo ORDER BY p.nome_completo), '[]'::jsonb) FROM public.perfis p WHERE p.id = ANY (it.responsaveis)),
          'pode_cobrar', cardinality(it.responsaveis) > 0,
          'ultima_cobranca', (SELECT jsonb_build_object('em', c.em, 'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = c.por),
                                                       'vezes', (SELECT count(*) FROM public.nir_cobrancas c2
                                                                  WHERE c2.unidade_id = p_unidade AND c2.tipo = it.tipo AND c2.ref_id = it.ref_id))
                                FROM public.nir_cobrancas c WHERE c.unidade_id = p_unidade AND c.tipo = it.tipo AND c.ref_id = it.ref_id
                               ORDER BY c.em DESC LIMIT 1))
          ORDER BY it.desde) FROM it), '[]'::jsonb),
      'resumo', jsonb_build_object(
          'aih', (SELECT count(*) FROM it WHERE it.grupo = 'aih'),
          'apac', (SELECT count(*) FROM it WHERE it.grupo = 'apac'),
          'regulacao', (SELECT count(*) FROM it WHERE it.grupo = 'regulacao')),
      'agora', now()));
END $$;
REVOKE ALL ON FUNCTION public.nir_pendencias(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nir_pendencias(uuid) TO authenticated;

-- Cobra o responsável: aviso na categoria do assunto e registro de quem cobrou.
CREATE OR REPLACE FUNCTION public.nir_cobrar(p_unidade uuid, p_tipo text, p_ref uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it record; v_tipo_aviso text; v_n integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.nir_exigir(p_unidade);
  SELECT * INTO it FROM private.nir_itens(p_unidade) x WHERE x.tipo = p_tipo AND x.ref_id = p_ref LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta pendência não está mais em aberto.'; END IF;
  IF cardinality(it.responsaveis) = 0 THEN RAISE EXCEPTION 'Não há responsável para cobrar nesta pendência.'; END IF;
  v_tipo_aviso := CASE it.grupo
    WHEN 'regulacao' THEN 'reg_cobranca_' || (SELECT numero FROM public.regulacao_solicitacoes WHERE id = p_ref)
    WHEN 'aih' THEN 'nir_aih_' || left(p_ref::text, 8)
    ELSE 'nir_apac_' || left(p_ref::text, 8) END;
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT q, p_unidade, current_date, v_tipo_aviso,
         'NIR: ' || it.titulo || coalesce(' — ' || (SELECT coalesce(pa.nome_social, pa.nome) FROM public.pacientes pa WHERE pa.id = it.paciente_id), '')
         || '. Parado desde ' || to_char(it.desde AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.'
    FROM unnest(it.responsaveis) q
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO public.nir_cobrancas (unidade_id, tipo, ref_id, destinatarios, por)
  VALUES (p_unidade, p_tipo, p_ref, it.responsaveis, private.meu_perfil_id());
  PERFORM private.registrar_auditoria('nir_cobranca', 'nir_cobrancas', p_ref, p_unidade, jsonb_build_object('tipo', p_tipo, 'quantidade', v_n));
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.nir_cobrar(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nir_cobrar(uuid, text, uuid) TO authenticated;

