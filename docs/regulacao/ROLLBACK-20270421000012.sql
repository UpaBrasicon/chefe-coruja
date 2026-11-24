-- ════════════════════════════════════════════════════════════════════════════
-- Volta da migration 20270421000012_regulacao_central_certa.sql.
--
-- Devolve o corpo ANTERIOR das 13 funções trocadas (tirado da homologação com
-- pg_get_functiondef em 24/11/2026, já com as migrations 20270421000010 e
-- 20270421000040 aplicadas) e apaga as 4 funções novas. Depois disso os
-- pedidos novos voltam a ir sempre à central principal da organização, e o
-- relógio da fila volta a usar só o prazo por prioridade.
--
-- Pedidos abertos numa central que não é a principal continuam com ela
-- (central_id não muda): o regulador dessa central ainda decide pelo
-- pedido (regulacao_pode_ver, regulacao_assumir e a decisão olham o
-- central_id do pedido), mas a fila, a lista e o painel dessa central voltam
-- a recusar a unidade. Antes de voltar, confira:
--   SELECT central_id, count(*) FROM public.regulacao_solicitacoes s
--    WHERE NOT EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = s.central_id)
--      AND s.status NOT IN ('realizada', 'falta', 'negada', 'cancelada', 'excluida')
--    GROUP BY 1;
-- e, se houver, peça à central principal que assuma esses pedidos (UPDATE do
-- central_id para a principal, com registro), ou não volte.
--
-- Idempotente. Testado na homologação em transação desfeita (migration,
-- depois esta volta, depois os testes antigos da regulação; BEGIN … ROLLBACK).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- public.regulacao_solicitar
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
  v_nao_ident := NOT private.paciente_tem_documento(pa.id);  -- Portão 2, tarefa 5: RN vinculado usa o documento da mãe
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
  v_neonato := pa.data_nascimento IS NOT NULL AND pa.data_nascimento > private.data_atual() - 28;
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

-- public.regulacao_contexto
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
    'unidades_rede', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'tipo', u.tipo) ORDER BY u.nome)
                       FROM public.unidades u
                      WHERE u.ativo AND u.organizacao_id = (SELECT organizacao_id FROM public.unidades WHERE id = p_unidade)
                        AND u.id IS DISTINCT FROM c.unidade_id), '[]'::jsonb));
END $function$
;

-- public.regulacao_lista
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

-- public.regulacao_fila
CREATE OR REPLACE FUNCTION public.regulacao_fila(p_central uuid, p_filtros jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;

-- public.regulacao_criterios
CREATE OR REPLACE FUNCTION public.regulacao_criterios(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_central uuid;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT c.unidade_id INTO v_central FROM public.centrais_regulacao c JOIN public.unidades u ON u.organizacao_id = c.organizacao_id
   WHERE u.id = p_unidade;
  IF v_central IS NULL THEN RETURN '{}'::jsonb; END IF;
  RETURN coalesce((SELECT jsonb_object_agg(cr.prioridade, jsonb_build_object('texto', cr.texto, 'em', cr.atualizado_em,
            'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = cr.atualizado_por)))
    FROM public.regulacao_criterios cr WHERE cr.central_id = v_central), '{}'::jsonb);
END $function$
;

-- public.regulacao_definir_criterio
CREATE OR REPLACE FUNCTION public.regulacao_definir_criterio(p_central uuid, p_prioridade text, p_texto text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;

-- public.regulacao_prazos
CREATE OR REPLACE FUNCTION public.regulacao_prazos(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_central uuid;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT c.unidade_id INTO v_central FROM public.centrais_regulacao c JOIN public.unidades u ON u.organizacao_id = c.organizacao_id
   WHERE u.id = p_unidade;
  IF v_central IS NULL THEN RETURN NULL; END IF;
  RETURN private.regulacao_prazos_json(v_central);
END $function$
;

-- public.regulacao_definir_prazos
CREATE OR REPLACE FUNCTION public.regulacao_definir_prazos(p_central uuid, p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_antes jsonb;
  v_min integer[];
  v_evol integer; v_pend integer; v_sem integer; v_dest integer;
  v_hist uuid;
  k text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_central) THEN
    RAISE EXCEPTION 'Esta unidade não é uma central de regulação.';
  END IF;
  IF NOT (private.tenho_papel(p_central, 'regulador') OR private.tenho_papel(p_central, 'gestor')) THEN
    RAISE EXCEPTION 'Os prazos são ajustados pelo regulador ou pelo gestor da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  FOREACH k IN ARRAY ARRAY['emergencia', 'urgencia', 'prioritaria', 'eletiva'] LOOP
    IF d->'fila' ? k AND jsonb_typeof(d->'fila'->k) NOT IN ('null', 'number') THEN
      RAISE EXCEPTION 'Prazo da fila em minutos.';
    END IF;
    IF (d->'fila'->>k)::numeric IS NOT NULL AND ((d->'fila'->>k)::numeric <> floor((d->'fila'->>k)::numeric)
        OR (d->'fila'->>k)::numeric NOT BETWEEN 1 AND 43200) THEN
      RAISE EXCEPTION 'Prazo da fila: de 1 minuto a 30 dias.';
    END IF;
    v_min := v_min || (d->'fila'->>k)::integer;
  END LOOP;
  v_evol := coalesce((d->>'evolucao_h')::integer, 12);
  v_pend := coalesce((d->>'pendencia_h')::integer, 3);
  v_sem  := coalesce((d->>'sem_evolucao_h')::integer, 72);
  v_dest := coalesce((d->>'destino_h')::integer, 24);
  IF v_evol NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'Evolução: de 1 a 168 horas.'; END IF;
  IF v_pend NOT BETWEEN 1 AND 72 THEN RAISE EXCEPTION 'Resposta à pendência: de 1 a 72 horas.'; END IF;
  IF v_sem NOT BETWEEN 2 AND 720 OR v_sem <= v_evol THEN
    RAISE EXCEPTION 'Sem evolução: até 720 horas e maior que o prazo da evolução.';
  END IF;
  IF v_dest NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'Resposta do destino: de 1 a 168 horas.'; END IF;
  v_antes := private.regulacao_prazos_json(p_central);
  INSERT INTO public.regulacao_prazos (central_id, fila_emergencia_min, fila_urgencia_min, fila_prioritaria_min, fila_eletiva_min,
    evolucao_h, pendencia_h, sem_evolucao_h, destino_h, atualizado_por, atualizado_em)
  VALUES (p_central, v_min[1], v_min[2], v_min[3], v_min[4], v_evol, v_pend, v_sem, v_dest, private.meu_perfil_id(), now())
  ON CONFLICT (central_id) DO UPDATE SET
    fila_emergencia_min = excluded.fila_emergencia_min, fila_urgencia_min = excluded.fila_urgencia_min,
    fila_prioritaria_min = excluded.fila_prioritaria_min, fila_eletiva_min = excluded.fila_eletiva_min,
    evolucao_h = excluded.evolucao_h, pendencia_h = excluded.pendencia_h, sem_evolucao_h = excluded.sem_evolucao_h,
    destino_h = excluded.destino_h, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  INSERT INTO public.regulacao_prazos_historico (central_id, antes, depois, por)
  VALUES (p_central, v_antes - 'atualizado_por' - 'atualizado_em',
          private.regulacao_prazos_json(p_central) - 'atualizado_por' - 'atualizado_em', private.meu_perfil_id())
  RETURNING id INTO v_hist;
  PERFORM private.registrar_auditoria('regulacao_prazos_ajustados', 'regulacao_prazos_historico', v_hist, p_central, NULL);
  RETURN private.regulacao_prazos_json(p_central);
END $function$
;

-- private.regulacao_sla
CREATE OR REPLACE FUNCTION private.regulacao_sla(s regulacao_solicitacoes)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  p public.regulacao_prazos;
  v_ef text := coalesce(s.prioridade_regulador, s.prioridade);
  v_central_seg bigint;
  v_prazo integer;
  v_correndo boolean := s.status IN ('enviada', 'em_analise');
  v_fila_atrasada boolean;
  v_desde timestamptz;
  v_ultima timestamptz;
  v_pend jsonb;
  v_evol jsonb;
  v_dest jsonb;
BEGIN
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino') THEN RETURN NULL; END IF;
  p := private.regulacao_prazos_de(s.central_id);
  SELECT coalesce(sum(extract(epoch FROM coalesce(t.fim, now()) - t.inicio)), 0)::bigint INTO v_central_seg
    FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id AND t.status IN ('enviada', 'em_analise');
  v_prazo := CASE v_ef WHEN 'emergencia' THEN p.fila_emergencia_min WHEN 'urgencia' THEN p.fila_urgencia_min
                       WHEN 'prioritaria' THEN p.fila_prioritaria_min WHEN 'eletiva' THEN p.fila_eletiva_min END;
  v_fila_atrasada := v_prazo IS NOT NULL AND v_central_seg > v_prazo * 60;
  SELECT t.inicio INTO v_desde FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id AND t.fim IS NULL;

  IF s.status IN ('pendencia', 'devolvida') THEN
    v_desde := coalesce(v_desde, CASE s.status WHEN 'pendencia' THEN s.pendencia_em ELSE s.devolvida_em END, s.criada_em);
    v_pend := jsonb_build_object('desde', v_desde, 'prazo_h', p.pendencia_h,
      'vence_em', v_desde + make_interval(hours => p.pendencia_h),
      'atrasada', now() > v_desde + make_interval(hours => p.pendencia_h));
  END IF;

  IF s.status = 'aguardando_destino' THEN
    v_desde := coalesce(v_desde, s.destino_enviado_em, s.autorizada_em, s.criada_em);
    v_dest := jsonb_build_object('desde', v_desde, 'prazo_h', p.destino_h,
      'vence_em', v_desde + make_interval(hours => p.destino_h),
      'atrasado', now() > v_desde + make_interval(hours => p.destino_h));
  END IF;

  IF s.tipo IN ('leito', 'transferencia') THEN
    v_ultima := greatest(s.criada_em, s.reenviada_em,
      (SELECT max(e.em) FROM public.regulacao_evolucoes e WHERE e.solicitacao_id = s.id));
    v_evol := jsonb_build_object('ultima_em', v_ultima, 'prazo_h', p.evolucao_h,
      'vence_em', v_ultima + make_interval(hours => p.evolucao_h),
      'atrasada', now() > v_ultima + make_interval(hours => p.evolucao_h),
      'limite_h', p.sem_evolucao_h,
      'risco_cancelamento', now() > v_ultima + make_interval(hours => p.sem_evolucao_h));
  END IF;

  RETURN jsonb_build_object(
    'fila', jsonb_build_object('prazo_min', v_prazo, 'central_seg', v_central_seg, 'correndo', v_correndo, 'atrasado', v_fila_atrasada),
    'pendencia', v_pend, 'evolucao', v_evol, 'destino', v_dest,
    'atrasado_central', v_correndo AND v_fila_atrasada,
    'atrasado_origem', coalesce((v_pend->>'atrasada')::boolean, false) OR coalesce((v_evol->>'atrasada')::boolean, false),
    'atrasado_destino', coalesce((v_dest->>'atrasado')::boolean, false));
END $function$
;

-- public.regulacao_sla_painel
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

-- public.regulacao_mapa_vagas
CREATE OR REPLACE FUNCTION public.regulacao_mapa_vagas(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_org uuid; v_central uuid; v_rede boolean := false; v_consulta boolean := false;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT u.organizacao_id INTO v_org FROM public.unidades u WHERE u.id = p_unidade;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  SELECT c.unidade_id INTO v_central FROM public.centrais_regulacao c WHERE c.organizacao_id = v_org;
  IF EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade) THEN
    PERFORM private.rede_exigir(p_unidade, ARRAY['secretaria', 'regulacao_regional']);
    v_rede := true;
  ELSIF NOT (private.eh_super_admin()
          OR private.tenho_papel(p_unidade, 'gestor')
          OR (p_unidade = v_central AND private.tenho_papel(p_unidade, 'regulador'))) THEN
    -- médico e NIR da unidade: só consulta, sem dado de paciente (RT, 24/11/2026)
    IF private.tenho_papel(p_unidade, 'plantonista') IS TRUE OR private.tenho_papel(p_unidade, 'nir') IS TRUE THEN
      v_consulta := true;
    ELSE
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'unidades', coalesce((SELECT jsonb_agg(x.j ORDER BY x.nome) FROM (
        SELECT u.nome, jsonb_build_object(
          'id', u.id, 'nome', u.nome, 'cnes', u.cnes,
          'leitos', private.regulacao_leitos_unidade(u.id),
          'servicos', coalesce((SELECT jsonb_agg(private.regulacao_servico_json(v) ORDER BY v.tipo, v.nome)
                                  FROM public.regulacao_servicos v WHERE v.unidade_id = u.id AND v.ativo), '[]'::jsonb),
          'editavel', NOT v_rede AND private.tenho_papel(u.id, 'gestor'),
          'minha', u.id = p_unidade) AS j
          FROM public.unidades u
         WHERE u.organizacao_id = v_org AND u.id IS DISTINCT FROM v_central
           AND (NOT v_rede OR u.id IN (SELECT private.rede_unidades(v_org)))
           AND (u.id = p_unidade AND NOT v_rede
                OR EXISTS (SELECT 1 FROM public.setores st WHERE st.unidade_id = u.id AND st.ativo AND st.regulacao_tipo_leito IS NOT NULL)
                OR EXISTS (SELECT 1 FROM public.regulacao_servicos v WHERE v.unidade_id = u.id AND v.ativo))) x), '[]'::jsonb),
    'totais', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo_leito', t.tipo, 'livre', t.livre, 'higienizacao', t.hig, 'total', t.total) ORDER BY t.tipo)
        FROM (SELECT st.regulacao_tipo_leito AS tipo, count(*) FILTER (WHERE l.status = 'livre') AS livre,
                     count(*) FILTER (WHERE l.status = 'higienizacao') AS hig, count(*) AS total
                FROM public.setores st JOIN public.unidades u ON u.id = st.unidade_id AND u.organizacao_id = v_org
                JOIN public.leitos l ON l.setor_id = st.id AND l.ativo
               WHERE st.ativo AND st.regulacao_tipo_leito IS NOT NULL
                 AND (NOT v_rede OR u.id IN (SELECT private.rede_unidades(v_org)))
               GROUP BY st.regulacao_tipo_leito) t), '[]'::jsonb),
    'agora', now(),
    'so_consulta', v_consulta);
END $function$
;

-- private.reg_indicadores_escopo
CREATE OR REPLACE FUNCTION private.reg_indicadores_escopo(p_unidade uuid, OUT org uuid, OUT unidades uuid[], OUT rede boolean)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_central uuid;
BEGIN
  SELECT u.organizacao_id INTO org FROM public.unidades u WHERE u.id = p_unidade;
  IF org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  SELECT c.unidade_id INTO v_central FROM public.centrais_regulacao c WHERE c.organizacao_id = org;
  IF p_unidade = v_central AND (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'regulador') OR private.tenho_papel(p_unidade, 'gestor')) THEN
    rede := true; unidades := NULL; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade) THEN
    PERFORM private.rede_exigir(p_unidade, ARRAY['secretaria', 'regulacao_regional']);
    rede := false; unidades := ARRAY(SELECT private.rede_unidades(org)); RETURN;
  END IF;
  IF private.tenho_papel(p_unidade, 'gestor') THEN
    rede := false; unidades := ARRAY[p_unidade]; RETURN;
  END IF;
  RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
END $function$
;

-- public.regulacao_indicadores
CREATE OR REPLACE FUNCTION public.regulacao_indicadores(p_unidade uuid, p_filtros jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  e record;
  p public.regulacao_prazos;
  v_de date := coalesce(nullif(f->>'de', '')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date - 29);
  v_ate date := coalesce(nullif(f->>'ate', '')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_resultado jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM private.reg_indicadores_escopo(p_unidade);
  IF v_ate < v_de THEN RAISE EXCEPTION 'O fim do período vem depois do início.'; END IF;
  IF v_ate - v_de > 366 THEN RAISE EXCEPTION 'Período de até 366 dias.'; END IF;
  p := private.regulacao_prazos_de((SELECT c.unidade_id FROM public.centrais_regulacao c WHERE c.organizacao_id = e.org));

  WITH escopo AS (
    SELECT s.* FROM public.regulacao_solicitacoes s
     WHERE s.organizacao_id = e.org AND s.status <> 'excluida'
       AND (e.rede OR s.unidade_origem_id = ANY (e.unidades) OR s.destino_unidade_id = ANY (e.unidades))
       AND (NOT f ? 'tipo' OR s.tipo = f->>'tipo')
       AND (NOT f ? 'prioridade' OR coalesce(s.prioridade_regulador, s.prioridade) = f->>'prioridade')
       AND (NOT f ? 'origem_id' OR s.unidade_origem_id = (f->>'origem_id')::uuid)
       AND (NOT f ? 'destino_id' OR s.destino_unidade_id = (f->>'destino_id')::uuid)
  ), base AS (
    SELECT s.id, s.tipo, coalesce(s.prioridade_regulador, s.prioridade) AS pri, s.unidade_origem_id AS origem, s.destino_unidade_id AS destino,
           s.tipo_leito, s.status, s.criada_em, s.motivo_negacao,
           s.autorizada_em IS NOT NULL AS autorizada, s.status = 'negada' AS negada, s.devolvida_em IS NOT NULL AS devolvida,
           s.status = 'cancelada' AS cancelada, s.status = 'falta' AS falta, s.status = 'realizada' AS realizada,
           CASE WHEN s.autorizada_em IS NOT NULL OR s.negada_em IS NOT NULL THEN
             (SELECT sum(extract(epoch FROM coalesce(t.fim, now()) - t.inicio)) FROM public.regulacao_status_tempos t
               WHERE t.solicitacao_id = s.id AND t.status IN ('enviada', 'em_analise')) END AS dec_seg,
           CASE WHEN s.destino_resposta = 'aceita' AND s.destino_enviado_em IS NOT NULL
             THEN extract(epoch FROM s.destino_respondido_em - s.destino_enviado_em) END AS aceite_seg,
           CASE WHEN s.status = 'realizada' AND s.realizada_em IS NOT NULL THEN extract(epoch FROM s.realizada_em - s.criada_em) END AS chegada_seg,
           CASE coalesce(s.prioridade_regulador, s.prioridade) WHEN 'emergencia' THEN p.fila_emergencia_min WHEN 'urgencia' THEN p.fila_urgencia_min
                WHEN 'prioritaria' THEN p.fila_prioritaria_min WHEN 'eletiva' THEN p.fila_eletiva_min END AS prazo_fila_min,
           -- evolução: maior intervalo entre evoluções enquanto esperava decisão (leito e transferência)
           CASE WHEN s.tipo IN ('leito', 'transferencia') THEN (
             SELECT max(g) FROM (
               SELECT extract(epoch FROM lead(m) OVER (ORDER BY m) - m) AS g FROM (
                 SELECT s.criada_em AS m UNION SELECT s.reenviada_em WHERE s.reenviada_em IS NOT NULL
                 UNION SELECT ev.em FROM public.regulacao_evolucoes ev WHERE ev.solicitacao_id = s.id
                   AND ev.em <= coalesce(s.autorizada_em, s.negada_em, s.cancelada_em, now())
                 UNION SELECT coalesce(s.autorizada_em, s.negada_em, s.cancelada_em, now())) marcas) gaps) END AS evol_max_seg
      FROM escopo s
     WHERE s.criada_em >= (v_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND s.criada_em < ((v_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ), respostas AS (
    SELECT r.* FROM public.regulacao_destino_respostas r JOIN base b ON b.id = r.solicitacao_id
  ), pend AS (
    SELECT extract(epoch FROM t.fim - t.inicio) AS seg FROM public.regulacao_status_tempos t JOIN base b ON b.id = t.solicitacao_id
     WHERE t.status IN ('pendencia', 'devolvida') AND t.fim IS NOT NULL
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('de', v_de, 'ate', v_ate),
    'escopo', CASE WHEN e.rede THEN 'rede' ELSE 'unidades' END,
    'total', (SELECT count(*) FROM base),
    'tempos', jsonb_build_object(
      'decisao', jsonb_build_object(
        'geral', (SELECT private.reg_estat(array_agg(dec_seg)) FROM base WHERE dec_seg IS NOT NULL),
        'por_prioridade', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', pri) || private.reg_estat(v) ORDER BY pri)
            FROM (SELECT pri, array_agg(dec_seg) v FROM base WHERE dec_seg IS NOT NULL GROUP BY pri) x), '[]'::jsonb),
        'por_tipo', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', tipo) || private.reg_estat(v) ORDER BY tipo)
            FROM (SELECT tipo, array_agg(dec_seg) v FROM base WHERE dec_seg IS NOT NULL GROUP BY tipo) x), '[]'::jsonb)),
      'aceite', jsonb_build_object(
        'geral', (SELECT private.reg_estat(array_agg(aceite_seg)) FROM base WHERE aceite_seg IS NOT NULL),
        'por_prioridade', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', pri) || private.reg_estat(v) ORDER BY pri)
            FROM (SELECT pri, array_agg(aceite_seg) v FROM base WHERE aceite_seg IS NOT NULL GROUP BY pri) x), '[]'::jsonb),
        'por_tipo', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', tipo) || private.reg_estat(v) ORDER BY tipo)
            FROM (SELECT tipo, array_agg(aceite_seg) v FROM base WHERE aceite_seg IS NOT NULL GROUP BY tipo) x), '[]'::jsonb)),
      'chegada', jsonb_build_object(
        'geral', (SELECT private.reg_estat(array_agg(chegada_seg)) FROM base WHERE chegada_seg IS NOT NULL),
        'por_prioridade', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', pri) || private.reg_estat(v) ORDER BY pri)
            FROM (SELECT pri, array_agg(chegada_seg) v FROM base WHERE chegada_seg IS NOT NULL GROUP BY pri) x), '[]'::jsonb),
        'por_tipo', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', tipo) || private.reg_estat(v) ORDER BY tipo)
            FROM (SELECT tipo, array_agg(chegada_seg) v FROM base WHERE chegada_seg IS NOT NULL GROUP BY tipo) x), '[]'::jsonb))),
    -- fila agora (não depende do período)
    'fila_atual', jsonb_build_object(
      'por_tipo', coalesce((SELECT jsonb_object_agg(tipo, n) FROM (SELECT tipo, count(*) n FROM escopo
          WHERE status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino') GROUP BY tipo) x), '{}'::jsonb),
      'por_prioridade', coalesce((SELECT jsonb_object_agg(pri, n) FROM (SELECT coalesce(prioridade_regulador, prioridade) pri, count(*) n FROM escopo
          WHERE status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino') GROUP BY 1) x), '{}'::jsonb)),
    'volume', jsonb_build_object(
      'por_dia', coalesce((SELECT jsonb_agg(jsonb_build_object('dia', dia, 'n', n) ORDER BY dia)
          FROM (SELECT (criada_em AT TIME ZONE 'America/Sao_Paulo')::date dia, count(*) n FROM base GROUP BY 1) x), '[]'::jsonb),
      'por_tipo', coalesce((SELECT jsonb_object_agg(tipo, n) FROM (SELECT tipo, count(*) n FROM base GROUP BY tipo) x), '{}'::jsonb),
      'por_origem', coalesce((SELECT jsonb_agg(jsonb_build_object('unidade', u.nome, 'n', x.n) ORDER BY x.n DESC, u.nome)
          FROM (SELECT origem, count(*) n FROM base GROUP BY origem) x JOIN public.unidades u ON u.id = x.origem), '[]'::jsonb),
      'por_destino', coalesce((SELECT jsonb_agg(jsonb_build_object('unidade', u.nome, 'n', x.n) ORDER BY x.n DESC, u.nome)
          FROM (SELECT destino, count(*) n FROM base WHERE destino IS NOT NULL GROUP BY destino) x JOIN public.unidades u ON u.id = x.destino), '[]'::jsonb)),
    'desfechos', jsonb_build_object(
      'autorizadas', (SELECT count(*) FILTER (WHERE autorizada) FROM base),
      'negadas', (SELECT count(*) FILTER (WHERE negada) FROM base),
      'devolvidas', (SELECT count(*) FILTER (WHERE devolvida) FROM base),
      'canceladas', (SELECT count(*) FILTER (WHERE cancelada) FROM base),
      'realizadas', (SELECT count(*) FILTER (WHERE realizada) FROM base),
      'faltas', (SELECT count(*) FILTER (WHERE falta) FROM base),
      'negacao_por_motivo', coalesce((SELECT jsonb_object_agg(motivo_negacao, n) FROM (SELECT motivo_negacao, count(*) n FROM base
          WHERE negada AND motivo_negacao IS NOT NULL GROUP BY 1) x), '{}'::jsonb),
      'respostas_destino', (SELECT count(*) FROM respostas),
      'recusas_destino', (SELECT count(*) FROM respostas WHERE resposta = 'recusada'),
      'recusa_por_motivo', coalesce((SELECT jsonb_object_agg(motivo, n) FROM (SELECT motivo, count(*) n FROM respostas
          WHERE resposta = 'recusada' AND motivo IS NOT NULL GROUP BY 1) x), '{}'::jsonb)),
    'prazos', jsonb_build_object(
      'fila', (SELECT jsonb_build_object('n', count(*), 'no_prazo', count(*) FILTER (WHERE dec_seg <= prazo_fila_min * 60)) FROM base
                WHERE dec_seg IS NOT NULL AND prazo_fila_min IS NOT NULL),
      'pendencia', (SELECT jsonb_build_object('n', count(*), 'no_prazo', count(*) FILTER (WHERE seg <= p.pendencia_h * 3600)) FROM pend),
      'evolucao', (SELECT jsonb_build_object('n', count(*), 'no_prazo', count(*) FILTER (WHERE evol_max_seg <= p.evolucao_h * 3600)) FROM base
                    WHERE evol_max_seg IS NOT NULL),
      'destino', (SELECT jsonb_build_object('n', count(*), 'no_prazo', count(*) FILTER (WHERE r.em - s.destino_enviado_em <= make_interval(hours => p.destino_h)))
                    FROM respostas r JOIN public.regulacao_solicitacoes s ON s.id = r.solicitacao_id
                   WHERE s.destino_enviado_em IS NOT NULL AND r.em >= s.destino_enviado_em),
      'valores', jsonb_build_object('pendencia_h', p.pendencia_h, 'evolucao_h', p.evolucao_h, 'destino_h', p.destino_h,
                   'fila_min', jsonb_build_object('emergencia', p.fila_emergencia_min, 'urgencia', p.fila_urgencia_min,
                                                  'prioritaria', p.fila_prioritaria_min, 'eletiva', p.fila_eletiva_min))),
    'gargalos', jsonb_build_object(
      'por_origem', coalesce((SELECT jsonb_agg(jsonb_build_object('unidade', u.nome, 'n', x.n, 'decisao_mediana', (x.est->>'mediana')::bigint,
                                'devolvidas', x.dev, 'negadas', x.neg) ORDER BY (x.est->>'mediana')::bigint DESC NULLS LAST, x.n DESC)
          FROM (SELECT origem, count(*) n, private.reg_estat(array_agg(dec_seg) FILTER (WHERE dec_seg IS NOT NULL)) est,
                       count(*) FILTER (WHERE devolvida) dev, count(*) FILTER (WHERE negada) neg
                  FROM base GROUP BY origem) x JOIN public.unidades u ON u.id = x.origem), '[]'::jsonb),
      'por_destino', coalesce((SELECT jsonb_agg(jsonb_build_object('unidade', u.nome, 'respostas', x.n, 'recusas', x.rec,
                                'aceite_mediana', (x.est->>'mediana')::bigint) ORDER BY x.rec DESC, x.n DESC)
          FROM (SELECT r.destino_unidade_id d, count(*) n, count(*) FILTER (WHERE r.resposta = 'recusada') rec,
                       (SELECT private.reg_estat(array_agg(b.aceite_seg)) FROM base b WHERE b.destino = r.destino_unidade_id AND b.aceite_seg IS NOT NULL) est
                  FROM respostas r WHERE r.destino_unidade_id IS NOT NULL GROUP BY r.destino_unidade_id) x
          JOIN public.unidades u ON u.id = x.d), '[]'::jsonb),
      'por_tipo_leito', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo_leito', x.tl, 'n', x.n, 'decisao_mediana', (x.est->>'mediana')::bigint,
                                   'recusas', x.rec) ORDER BY x.n DESC)
          FROM (SELECT b.tipo_leito tl, count(*) n, private.reg_estat(array_agg(b.dec_seg) FILTER (WHERE b.dec_seg IS NOT NULL)) est,
                       (SELECT count(*) FROM respostas r JOIN base b2 ON b2.id = r.solicitacao_id WHERE b2.tipo_leito = b.tipo_leito AND r.resposta = 'recusada') rec
                  FROM base b WHERE b.tipo_leito IS NOT NULL GROUP BY b.tipo_leito) x), '[]'::jsonb)),
    'agora', now())
  INTO v_resultado;
  RETURN v_resultado;
END $function$
;

-- funções novas
DROP FUNCTION IF EXISTS public.regulacao_capacidades_reguladas(uuid);
DROP FUNCTION IF EXISTS private.regulacao_prazo_tipo(uuid, text);
DROP FUNCTION IF EXISTS private.regulacao_central_referencia(uuid);
DROP FUNCTION IF EXISTS private.regulacao_central_da_unidade(uuid);

COMMIT;
