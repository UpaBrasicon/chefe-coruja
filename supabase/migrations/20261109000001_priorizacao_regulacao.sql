-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 3 — priorização clínica. Decisões do RT em 11/10/2026
-- (BACKLOG.md):
--
-- • A prioridade do regulador fica à parte da proposta do solicitante, com
--   quem, quando e motivo; a fila ordena por ela quando existir. Toda mudança
--   vai para o histórico e para a auditoria.
-- • Critérios: um texto por nível (emergência, urgência, prioritária,
--   eletiva), escrito pela central, mostrado ao solicitante e ao regulador.
--   O sistema não sugere nível.
-- • Vulnerabilidade (Portaria GM/MS 9.262/2025, art. 26: risco, tempo e
--   vulnerabilidade): marcadores que o solicitante marca e que aparecem como
--   selos na fila, sem pontuação.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.regulacao_solicitacoes
  ADD COLUMN IF NOT EXISTS prioridade_regulador text
    CHECK (prioridade_regulador IN ('emergencia', 'urgencia', 'prioritaria', 'eletiva')),
  ADD COLUMN IF NOT EXISTS prioridade_regulador_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS prioridade_regulador_em timestamptz,
  ADD COLUMN IF NOT EXISTS prioridade_regulador_motivo text,
  ADD COLUMN IF NOT EXISTS vulnerabilidades text[] NOT NULL DEFAULT '{}'
    CHECK (vulnerabilidades <@ ARRAY['gestante', 'idoso', 'crianca', 'pcd', 'situacao_rua', 'oncologico', 'judicializado']::text[]);

CREATE TABLE IF NOT EXISTS public.regulacao_criterios (
  central_id      uuid NOT NULL REFERENCES public.unidades(id),
  prioridade      text NOT NULL CHECK (prioridade IN ('emergencia', 'urgencia', 'prioritaria', 'eletiva')),
  texto           text NOT NULL CHECK (length(btrim(texto)) >= 10),
  atualizado_por  uuid NOT NULL REFERENCES public.perfis(id),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (central_id, prioridade)
);
ALTER TABLE public.regulacao_criterios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_criterios FROM anon, authenticated;

-- o JSON do pedido passa a trazer a priorização e os marcadores
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
$$;
REVOKE ALL ON FUNCTION private.regulacao_json(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- a solicitação passa a aceitar os marcadores de vulnerabilidade
CREATE OR REPLACE FUNCTION public.regulacao_solicitar(p_unidade uuid, p_paciente uuid, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
  ELSE RAISE EXCEPTION 'Abre a solicitação o médico ou o gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
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
END $$;
REVOKE ALL ON FUNCTION public.regulacao_solicitar(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_solicitar(uuid, uuid, jsonb) TO authenticated;

-- fila: ordem, filtro e resumo pela prioridade efetiva (a do regulador, se houver)
CREATE OR REPLACE FUNCTION public.regulacao_fila(p_central uuid, p_filtros jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_status text[];
  v_busca text := nullif(btrim(coalesce(f->>'busca', '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_central) THEN
    RAISE EXCEPTION 'Esta unidade não é uma central de regulação.';
  END IF;
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_central, 'regulador') OR private.tenho_papel(p_central, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_status := CASE WHEN jsonb_typeof(f->'status') = 'array' AND jsonb_array_length(f->'status') > 0
                   THEN ARRAY(SELECT jsonb_array_elements_text(f->'status'))
                   ELSE ARRAY['enviada', 'em_analise', 'pendencia'] END;

  RETURN jsonb_build_object(
    'dados', coalesce((
      SELECT jsonb_agg(private.regulacao_json_fila(s) ORDER BY
               (coalesce(s.prioridade_regulador, s.prioridade) = 'nao_classificada') DESC,
               CASE coalesce(s.prioridade_regulador, s.prioridade)
                 WHEN 'emergencia' THEN 1 WHEN 'urgencia' THEN 2 WHEN 'prioritaria' THEN 3 WHEN 'eletiva' THEN 4 ELSE 5 END,
               s.criada_em, s.numero)
        FROM (SELECT x.* FROM public.regulacao_solicitacoes x
               LEFT JOIN public.pacientes pa ON pa.id = x.paciente_id
              WHERE x.central_id = p_central
                AND x.status = ANY (v_status)
                AND (NOT f ? 'tipo' OR x.tipo = f->>'tipo')
                AND (NOT f ? 'prioridade' OR coalesce(x.prioridade_regulador, x.prioridade) = f->>'prioridade')
                AND (NOT f ? 'unidade_origem_id' OR x.unidade_origem_id = (f->>'unidade_origem_id')::uuid)
                AND (NOT f ? 'carater' OR x.carater = f->>'carater')
                AND (NOT f ? 'tipo_leito' OR x.tipo_leito = f->>'tipo_leito')
                AND (NOT f ? 'isolamento' OR x.isolamento = (f->>'isolamento')::boolean)
                AND (v_busca IS NULL
                     OR x.numero::text = v_busca
                     OR x.externo_protocolo ILIKE '%' || v_busca || '%'
                     OR coalesce(pa.nome_social, pa.nome) ILIKE '%' || v_busca || '%')
              ORDER BY x.criada_em
              LIMIT 500) s), '[]'::jsonb),
    -- contagem do que está em aberto na central, por prioridade (sem filtros)
    'resumo', coalesce((SELECT jsonb_object_agg(prioridade, n) FROM (
        SELECT coalesce(prioridade_regulador, prioridade) AS prioridade, count(*) AS n FROM public.regulacao_solicitacoes
         WHERE central_id = p_central AND status IN ('enviada', 'em_analise', 'pendencia')
         GROUP BY 1) r), '{}'::jsonb),
    -- unidades que já mandaram pedido, para o filtro de origem
    'origens', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) ORDER BY u.nome)
        FROM public.unidades u WHERE u.id IN (SELECT DISTINCT unidade_origem_id FROM public.regulacao_solicitacoes WHERE central_id = p_central)), '[]'::jsonb),
    'agora', now());
END $$;
REVOKE ALL ON FUNCTION public.regulacao_fila(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_fila(uuid, jsonb) TO authenticated;

-- ── prioridade do regulador ─────────────────────────────────────────────────
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
  RETURN private.regulacao_json_fila(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_priorizar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_priorizar(uuid, text, text) TO authenticated;

-- ── critérios por nível, escritos pela central ──────────────────────────────
-- Para a tela: os critérios da central da organização de uma unidade (origem
-- ou central). Sem texto, o nível aparece só com o nome.
CREATE OR REPLACE FUNCTION public.regulacao_criterios(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_central uuid;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT c.unidade_id INTO v_central FROM public.centrais_regulacao c JOIN public.unidades u ON u.organizacao_id = c.organizacao_id
   WHERE u.id = p_unidade;
  IF v_central IS NULL THEN RETURN '{}'::jsonb; END IF;
  RETURN coalesce((SELECT jsonb_object_agg(cr.prioridade, jsonb_build_object('texto', cr.texto, 'em', cr.atualizado_em,
            'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = cr.atualizado_por)))
    FROM public.regulacao_criterios cr WHERE cr.central_id = v_central), '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_criterios(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_criterios(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_definir_criterio(p_central uuid, p_prioridade text, p_texto text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_central) THEN
    RAISE EXCEPTION 'Esta unidade não é uma central de regulação.';
  END IF;
  IF NOT (private.tenho_papel(p_central, 'regulador') OR private.tenho_papel(p_central, 'gestor')) THEN
    RAISE EXCEPTION 'Os critérios são escritos pelo regulador ou pelo gestor da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_prioridade IS NULL OR p_prioridade NOT IN ('emergencia', 'urgencia', 'prioritaria', 'eletiva') THEN
    RAISE EXCEPTION 'Prioridade: emergência, urgência, prioritária ou eletiva.';
  END IF;
  IF length(btrim(coalesce(p_texto, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o critério (mínimo de 10 letras).'; END IF;
  INSERT INTO public.regulacao_criterios (central_id, prioridade, texto, atualizado_por)
  VALUES (p_central, p_prioridade, btrim(p_texto), private.meu_perfil_id())
  ON CONFLICT (central_id, prioridade) DO UPDATE
    SET texto = excluded.texto, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  PERFORM private.registrar_auditoria('regulacao_criterio_definido', 'regulacao_criterios', NULL, p_central,
    jsonb_build_object('prioridade', p_prioridade, 'texto', btrim(p_texto)));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_definir_criterio(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_definir_criterio(uuid, text, text) TO authenticated;
