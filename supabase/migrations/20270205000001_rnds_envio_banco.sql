-- ════════════════════════════════════════════════════════════════════════════
-- Fase 5C, tarefa 5 (RNDS), etapa 5.3a: o banco do serviço de envio
-- (decisões do RT de 28/10/2026, "todas a").
--
-- O serviço de envio (VPS, 5.3b/5.3c) não lê tabela: chama três funções, só
-- com a chave de serviço.
--   rnds_pegar_lote(limite)          trava e devolve os itens a enviar
--   rnds_dados_documento(item)       a carga: os dados do RAC, do SA ou do MIRA,
--                                    no formato de src/interop/fhir/tipos.ts,
--                                    e o que o envio precisa (credencial, UF,
--                                    documento anterior, CNS de quem assina)
--   rnds_registrar_resultado(...)    grava o que a RNDS respondeu
--
-- Fila (interop_outbox):
--   - status novo 'retido': falta dado para um documento válido; o motivo fica
--     em ultimo_erro e o item volta a ser tentado de hora em hora;
--   - colunas novas: quem assina (MIRA), próxima tentativa, trava do lote, o
--     Bundle enviado e a resposta da RNDS (evidência e auditoria).
-- Configuração por unidade (rnds_config_unidade): ambiente, identificador do
--   solicitante, financiamento padrão e envio ligado. Nasce desligada; a tela
--   é a 5.4. Sem configuração ligada, nada da unidade sai.
-- Códigos da RNDS (CodeSystems oficiais, definições de 07/2026):
--   modalidade: porta e observação 06; internação 04
--   caráter: eletiva 01; o resto 02
--   procedência: internação vinda de outra unidade 12; o resto 99
--     ("informação ausente": a porta não registra a procedência)
--   desfecho: alta 01, a pedido 02, evasão 04, óbito 06, transferência 09
-- Medidas: PAS, PAD, peso e estatura ganham o LOINC da lista BRTipoObservacao-1.0.
-- Conferência noturna (01:00): o que mudou no dia anterior e não entrou na
--   fila entra agora (regulação, porta encerrada, alta).
--
-- Rollback:
--   SELECT cron.unschedule('rnds-conferencia-noturna');
--   DROP FUNCTION IF EXISTS public.rnds_pegar_lote(integer), public.rnds_dados_documento(uuid),
--     public.rnds_registrar_resultado(uuid, text, text, jsonb, jsonb, text),
--     private.rnds_conferencia_noturna(date), private.rnds_carga_rac(uuid), private.rnds_carga_sa(uuid),
--     private.rnds_carga_paciente(uuid), private.rnds_carga_estabelecimento(uuid),
--     private.rnds_carga_profissional(uuid), private.rnds_carga_observacoes(uuid),
--     private.rnds_codigo_desfecho(text);
--   DROP TABLE IF EXISTS private.rnds_conferencias, public.rnds_config_unidade;
--   UPDATE public.conceito SET loinc_codigo = NULL WHERE unidade_id IS NULL
--     AND (nome, loinc_codigo) IN (('pressao-arterial-sistolica', '8480-6'), ('pressao-arterial-diastolica', '8462-4'),
--                                  ('peso', '29463-7'), ('estatura', '8302-2'));
--   UPDATE public.interop_outbox SET status = 'pendente' WHERE status = 'retido';
--   ALTER TABLE public.interop_outbox DROP CONSTRAINT interop_outbox_status_check;
--   ALTER TABLE public.interop_outbox ADD CONSTRAINT interop_outbox_status_check
--     CHECK (status IN ('pendente', 'enviado', 'erro', 'descartado'));
--   Os quatro códigos LOINC inseridos ficam (são códigos oficiais da tabela de referência).
--   As colunas novas da fila ficam (nulas, sem uso; o contract fica para depois)
--   e as versões novas do enfileiramento também: só citam 'retido' em listas e
--   gravam profissional_id, então funcionam sem o resto.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Fila ─────────────────────────────────────────────────────────────────
ALTER TABLE public.interop_outbox
  ADD COLUMN IF NOT EXISTS profissional_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS travado_ate timestamptz,
  ADD COLUMN IF NOT EXISTS bundle_enviado jsonb,
  ADD COLUMN IF NOT EXISTS resposta jsonb,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz;

ALTER TABLE public.interop_outbox DROP CONSTRAINT IF EXISTS interop_outbox_status_check;
ALTER TABLE public.interop_outbox ADD CONSTRAINT interop_outbox_status_check
  CHECK (status IN ('pendente', 'retido', 'enviado', 'erro', 'descartado'));

CREATE INDEX IF NOT EXISTS interop_outbox_a_enviar_idx
  ON public.interop_outbox (proxima_tentativa_em, created_at) WHERE status IN ('pendente', 'retido');

-- ── 2. Configuração por unidade ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rnds_config_unidade (
  unidade_id                uuid PRIMARY KEY REFERENCES public.unidades(id) ON DELETE CASCADE,
  ambiente                  text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  -- dado pela RNDS na aprovação da credencial (Bundle.identifier: BRRNDS-{id})
  identificador_solicitante text CHECK (identificador_solicitante ~ '^[0-9A-Za-z]+$'),
  -- BRFinanciamento: 01 Federal SUS … 07 Municipal SUS, 08 Programas federais
  financiamento             text CHECK (financiamento IN ('01', '02', '03', '04', '05', '06', '07', '08')),
  envio_ligado              boolean NOT NULL DEFAULT false,
  -- a RNDS recusou a credencial (401, ERR88x): o envio da unidade para até alguém olhar
  pausado_em                timestamptz,
  pausa_motivo              text,
  atualizado_em             timestamptz NOT NULL DEFAULT now(),
  atualizado_por            uuid REFERENCES public.perfis(id) ON DELETE SET NULL
);

ALTER TABLE public.rnds_config_unidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rnds_config_unidade_select ON public.rnds_config_unidade;
CREATE POLICY rnds_config_unidade_select ON public.rnds_config_unidade
  FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor');
REVOKE ALL ON public.rnds_config_unidade FROM anon, authenticated;
GRANT SELECT ON public.rnds_config_unidade TO authenticated;

-- ── 3. LOINC das medidas que a RNDS aceita ──────────────────────────────────
-- Base sem a tabela LOINC carregada (local, CI) recebe só estes quatro códigos;
-- onde ela está carregada, nada muda.
INSERT INTO terminologia.loinc (codigo, nome_longo) VALUES
  ('8480-6', 'Systolic blood pressure'), ('8462-4', 'Diastolic blood pressure'),
  ('29463-7', 'Body weight'), ('8302-2', 'Body height')
ON CONFLICT (codigo) DO NOTHING;
UPDATE public.conceito c SET loinc_codigo = v.loinc
  FROM (VALUES ('pressao-arterial-sistolica', '8480-6'), ('pressao-arterial-diastolica', '8462-4'),
               ('peso', '29463-7'), ('estatura', '8302-2')) AS v(nome, loinc)
 WHERE c.nome = v.nome AND c.unidade_id IS NULL AND c.loinc_codigo IS NULL
   AND EXISTS (SELECT 1 FROM terminologia.loinc l WHERE l.codigo = v.loinc);

-- ── 4. Enfileiramento: 'retido' conta como item vivo ────────────────────────
CREATE OR REPLACE FUNCTION private.enfileirar_documento(
  p_unidade_id   uuid,
  p_tipo         text,
  p_referencia_id uuid,
  p_payload      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text := 'pendente';
  v_erro   text := NULL;
BEGIN
  -- idempotência: já há item vivo para esta referência e este tipo
  IF EXISTS (SELECT 1 FROM public.interop_outbox o
             WHERE o.tipo_documento = p_tipo AND o.referencia_id = p_referencia_id
               AND o.status IN ('pendente', 'retido', 'enviado')) THEN
    RETURN;
  END IF;

  IF p_payload IS NULL OR p_tipo IS NULL OR p_referencia_id IS NULL OR p_unidade_id IS NULL THEN
    v_status := 'erro';
    v_erro := 'payload/tipo/referencia/unidade ausentes';
  END IF;

  BEGIN
    IF v_status = 'pendente' AND NOT (
      p_tipo IN ('rac','sumario_alta')
      AND jsonb_typeof(p_payload) = 'object'
      AND p_payload->>'resourceType' = 'Bundle'
    ) THEN
      v_status := 'erro';
      v_erro := 'payload não é um Bundle FHIR válido';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_status := 'erro';
    v_erro := SQLERRM;
  END;

  INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, ultimo_erro)
  VALUES (p_unidade_id, p_tipo, p_referencia_id, p_payload, v_status, v_erro);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, ultimo_erro)
    VALUES (p_unidade_id, p_tipo, p_referencia_id, COALESCE(p_payload, '{}'::jsonb), 'erro', SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION private.enfileirar_na_alta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  altas text[] := ARRAY['alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito'];
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = ANY (altas) THEN
      PERFORM private.enfileirar_documento(NEW.unidade_id, 'sumario_alta', NEW.id,
        jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'sumario_alta',
                           'internacao_id', NEW.id, 'paciente_id', NEW.paciente_id));
    ELSIF OLD.status = ANY (altas) THEN
      -- alta cancelada: o sumário ainda não enviado sai da fila
      UPDATE public.interop_outbox SET status = 'descartado', ultimo_erro = 'alta cancelada', atualizado_em = now()
       WHERE tipo_documento = 'sumario_alta' AND referencia_id = NEW.id AND status IN ('pendente', 'retido');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- MIRA: grava quem mudou o status (assina o envio: header Authorization com
-- o CNS dele). Na falta de usuário (rotina), o autor do último evento.
CREATE OR REPLACE FUNCTION private.rnds_enfileirar_regulacao(p_solicitacao uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.regulacao_solicitacoes;
  v_mira jsonb;
  v_ultimo text;
  v_quem uuid;
BEGIN
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao;
  IF NOT FOUND THEN RETURN; END IF;
  v_mira := private.rnds_mira_regulacao(s);
  IF v_mira IS NULL THEN RETURN; END IF;

  SELECT o.payload -> 'mira' ->> 'status' INTO v_ultimo
    FROM public.interop_outbox o
   WHERE o.tipo_documento = 'regulacao' AND o.referencia_id = s.id AND o.status IN ('pendente', 'retido', 'enviado')
   ORDER BY o.created_at DESC LIMIT 1;
  IF v_ultimo = v_mira ->> 'status' THEN RETURN; END IF;

  SELECT p.id INTO v_quem FROM public.perfis p WHERE p.id = auth.uid();
  IF v_quem IS NULL THEN
    SELECT e.por INTO v_quem FROM public.regulacao_eventos e
     WHERE e.solicitacao_id = s.id AND e.por IS NOT NULL ORDER BY e.em DESC LIMIT 1;
  END IF;

  UPDATE public.interop_outbox
     SET status = 'descartado', ultimo_erro = 'substituído por status mais novo', atualizado_em = now()
   WHERE tipo_documento = 'regulacao' AND referencia_id = s.id AND status IN ('pendente', 'retido');

  INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, profissional_id)
  VALUES (s.unidade_origem_id, 'regulacao', s.id,
          jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'regulacao', 'mira', v_mira),
          'pendente', v_quem);
END;
$$;

-- ── 5. Carga ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.rnds_codigo_desfecho(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p IN ('alta', 'alta_apos_medicacao', 'alta_melhorada') THEN '01'
    WHEN p IN ('alta_a_pedido', 'alta_pedido') THEN '02'
    WHEN p IN ('evasao', 'alta_evasao') THEN '04'
    WHEN p = 'obito' THEN '06'
    WHEN p IN ('transferencia', 'transferencia_externa') THEN '09'
  END
$$;

-- CPF com 11 dígitos e CNS com 15; o resto vira null (o mapper retém)
CREATE OR REPLACE FUNCTION private.rnds_carga_paciente(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'nome', p.nome, 'data_nascimento', p.data_nascimento, 'sexo', p.sexo,
    'cpf', CASE WHEN length(regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g')) = 11
                THEN regexp_replace(p.cpf, '\D', '', 'g') END,
    'cns', CASE WHEN length(regexp_replace(coalesce(p.cns, ''), '\D', '', 'g')) = 15
                THEN regexp_replace(p.cns, '\D', '', 'g') END,
    'telefone', NULL, 'prontuario', NULL)
  FROM public.pacientes p WHERE p.id = p_id
$$;

CREATE OR REPLACE FUNCTION private.rnds_carga_estabelecimento(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('id', u.id, 'nome', u.nome, 'cnes', u.cnes, 'municipio', u.municipio,
                            'uf', u.uf, 'organizacao_id', u.organizacao_id)
  FROM public.unidades u WHERE u.id = p_id
$$;

-- Sem profissional, o objeto vai com nulos: o mapper retém ("profissional sem CPF").
CREATE OR REPLACE FUNCTION private.rnds_carga_profissional(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
       'id', f.id, 'nome_completo', f.nome_completo,
       'cpf', CASE WHEN length(regexp_replace(coalesce(f.cpf, ''), '\D', '', 'g')) = 11
                   THEN regexp_replace(f.cpf, '\D', '', 'g') END,
       'crm', f.crm, 'uf_crm', f.uf_crm, 'cbo_codigo', f.cbo,
       'cns', CASE WHEN length(regexp_replace(coalesce(f.cns, ''), '\D', '', 'g')) = 15
                   THEN regexp_replace(f.cns, '\D', '', 'g') END)
       FROM public.perfis f WHERE f.id = p_id),
    jsonb_build_object('id', NULL, 'nome_completo', NULL, 'cpf', NULL, 'crm', NULL, 'uf_crm', NULL,
                       'cbo_codigo', NULL, 'cns', NULL))
$$;

-- A última aferição numérica de cada medida com LOINC no episódio; o mapper
-- deixa só as da lista BRTipoObservacao-1.0.
CREATE OR REPLACE FUNCTION private.rnds_carga_observacoes(p_episodio uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(x.o ORDER BY x.nome), '[]'::jsonb) FROM (
    SELECT DISTINCT ON (c.id) c.nome, jsonb_build_object(
      'id', o.id, 'conceito_id', c.id, 'conceito_nome', c.nome, 'conceito_tipo', c.tipo,
      'loinc_codigo', c.loinc_codigo, 'unidade_padrao', c.unidade_padrao,
      'valor_num', o.valor_num, 'valor_texto', o.valor_texto, 'unidade', o.unidade,
      'ref_min', o.ref_min, 'ref_max', o.ref_max, 'flag', o.flag,
      'aferido_em', o.aferido_em, 'origem', o.origem, 'registrado_por', o.registrado_por) AS o
    FROM public.observacao o
    JOIN public.conceito c ON c.id = o.conceito_id
    WHERE o.episodio_id = p_episodio AND c.loinc_codigo IS NOT NULL AND o.valor_num IS NOT NULL
    ORDER BY c.id, o.aferido_em DESC
  ) x
$$;

-- Procedimentos: um por código e dia (a RNDS recusa o repetido na mesma data,
-- ERR789), com a quantidade somada.
CREATE OR REPLACE FUNCTION private.rnds_carga_rac(p_episodio uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_fin text;
  v_fim timestamptz;
  v_desfecho text;
  v_condicoes jsonb;
  v_procedimentos jsonb;
BEGIN
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'episódio % não encontrado', p_episodio; END IF;
  SELECT c.financiamento INTO v_fin FROM public.rnds_config_unidade c WHERE c.unidade_id = e.unidade_id;
  IF v_fin IS NULL THEN RAISE EXCEPTION 'retido: unidade sem financiamento configurado para a RNDS'; END IF;
  v_desfecho := private.rnds_codigo_desfecho(e.desfecho);
  IF v_desfecho IS NULL THEN
    RAISE EXCEPTION 'retido: desfecho "%" sem correspondência na RNDS', coalesce(e.desfecho, 'vazio');
  END IF;
  -- alta lançada depois (retroativa) guarda a hora real em desfecho_detalhes
  v_fim := coalesce(nullif(e.desfecho_detalhes ->> 'alta_em', '')::timestamptz, e.desfecho_em, e.encerrado_em);

  SELECT jsonb_agg(jsonb_build_object(
           'id', d.id, 'paciente_id', d.paciente_id, 'encontro_id', e.id, 'codigo_cid', d.cid,
           'descricao', d.descricao, 'categoria', CASE WHEN d.tipo = 'primario' THEN 'principal' ELSE 'secundaria' END,
           'verificado', d.status = 'confirmado', 'data', d.registrado_em)
         ORDER BY d.tipo, d.registrado_em)
    INTO v_condicoes
    FROM (SELECT DISTINCT ON (dd.cid) dd.* FROM public.diagnosticos_episodio dd
           WHERE dd.episodio_id = e.id AND dd.encerrado_em IS NULL
           ORDER BY dd.cid, dd.tipo, dd.registrado_em) d;
  IF v_condicoes IS NULL AND nullif(e.desfecho_detalhes ->> 'cid_alta', '') IS NOT NULL THEN
    v_condicoes := jsonb_build_array(jsonb_build_object(
      'id', e.id, 'paciente_id', e.paciente_id, 'encontro_id', e.id, 'codigo_cid', e.desfecho_detalhes ->> 'cid_alta',
      'descricao', NULL, 'categoria', 'principal', 'verificado', true, 'data', v_fim));
  END IF;

  SELECT jsonb_agg(jsonb_build_object('id', p.id, 'codigo_sigtap', p.procedimento, 'realizado_em', p.realizado_em,
                                      'quantidade', p.quantidade, 'financiamento', v_fin) ORDER BY p.realizado_em)
    INTO v_procedimentos
    FROM (SELECT min(r.id::text) AS id, r.procedimento, min(r.realizado_em) AS realizado_em, sum(r.quantidade) AS quantidade
            FROM public.procedimentos_realizados r
           WHERE r.episodio_id = e.id AND r.cancelado_em IS NULL
           GROUP BY r.procedimento, (r.realizado_em AT TIME ZONE 'America/Sao_Paulo')::date) p;
  IF v_procedimentos IS NULL THEN
    SELECT jsonb_agg(jsonb_build_object('id', p.id, 'codigo_sigtap', p.procedimento, 'realizado_em', p.realizado_em,
                                        'quantidade', p.quantidade, 'financiamento', v_fin) ORDER BY p.realizado_em)
      INTO v_procedimentos
      FROM (SELECT min(l.id::text) AS id, l.procedimento, min(l.realizado_em) AS realizado_em, sum(l.quantidade) AS quantidade
              FROM public.conta_lancamentos l JOIN public.contas c ON c.id = l.conta_id
             WHERE c.episodio_id = e.id AND l.retirado_em IS NULL
             GROUP BY l.procedimento, (l.realizado_em AT TIME ZONE 'America/Sao_Paulo')::date) p;
  END IF;

  RETURN jsonb_build_object(
    'paciente', private.rnds_carga_paciente(e.paciente_id),
    'estabelecimento', private.rnds_carga_estabelecimento(e.unidade_id),
    'encontro', jsonb_build_object(
      'id', e.id, 'paciente_id', e.paciente_id, 'unidade_id', e.unidade_id, 'tipo_internacao', 'porta',
      'origem_admissao', NULL, 'status', e.desfecho, 'leito_atual_id', NULL, 'setor_atual_id', e.setor_id,
      'data_admissao', e.chegada_em, 'data_entrada_setor', NULL, 'data_alta', v_fim,
      'cid_principal', NULL, 'motivo_alta', e.desfecho_motivo),
    'contato', jsonb_build_object('modalidade', '06', 'carater', '02', 'procedencia', '99', 'desfecho', v_desfecho),
    'profissional', private.rnds_carga_profissional(coalesce(e.atendimento_medico_id, e.desfecho_por)),
    'condicoes', coalesce(v_condicoes, '[]'::jsonb),
    'procedimentos', coalesce(v_procedimentos, '[]'::jsonb),
    'observacoes', private.rnds_carga_observacoes(e.id));
END;
$$;

CREATE OR REPLACE FUNCTION private.rnds_carga_sa(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_fin text;
  v_desfecho text;
  v_condicoes jsonb;
  v_procedimentos jsonb;
  v_resumo text;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'internação % não encontrada', p_internacao; END IF;
  SELECT c.financiamento INTO v_fin FROM public.rnds_config_unidade c WHERE c.unidade_id = i.unidade_id;
  IF v_fin IS NULL THEN RAISE EXCEPTION 'retido: unidade sem financiamento configurado para a RNDS'; END IF;
  v_desfecho := private.rnds_codigo_desfecho(i.status);
  IF v_desfecho IS NULL THEN
    RAISE EXCEPTION 'retido: internação sem alta (status "%")', i.status;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'id', d.id, 'paciente_id', d.paciente_id, 'encontro_id', i.id, 'codigo_cid', d.cid,
           'descricao', d.descricao, 'categoria', CASE WHEN d.tipo = 'primario' THEN 'principal' ELSE 'secundaria' END,
           'verificado', d.status = 'confirmado', 'data', d.registrado_em)
         ORDER BY d.tipo, d.registrado_em)
    INTO v_condicoes
    FROM (SELECT DISTINCT ON (dd.cid) dd.* FROM public.diagnosticos_episodio dd
           WHERE dd.internacao_id = i.id AND dd.encerrado_em IS NULL
           ORDER BY dd.cid, dd.tipo, dd.registrado_em) d;
  IF v_condicoes IS NULL AND nullif(coalesce(i.cid_alta, i.cid_principal), '') IS NOT NULL THEN
    v_condicoes := jsonb_build_array(jsonb_build_object(
      'id', i.id, 'paciente_id', i.paciente_id, 'encontro_id', i.id, 'codigo_cid', coalesce(i.cid_alta, i.cid_principal),
      'descricao', NULL, 'categoria', 'principal', 'verificado', true, 'data', i.data_alta));
  END IF;

  -- a conta da internação; na falta, o que foi lançado no episódio depois da admissão
  SELECT jsonb_agg(jsonb_build_object('id', p.id, 'codigo_sigtap', p.procedimento, 'realizado_em', p.realizado_em,
                                      'quantidade', p.quantidade, 'financiamento', v_fin) ORDER BY p.realizado_em)
    INTO v_procedimentos
    FROM (SELECT min(l.id::text) AS id, l.procedimento, min(l.realizado_em) AS realizado_em, sum(l.quantidade) AS quantidade
            FROM public.conta_lancamentos l JOIN public.contas c ON c.id = l.conta_id
           WHERE c.internacao_id = i.id AND l.retirado_em IS NULL
           GROUP BY l.procedimento, (l.realizado_em AT TIME ZONE 'America/Sao_Paulo')::date) p;
  IF v_procedimentos IS NULL AND i.episodio_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('id', p.id, 'codigo_sigtap', p.procedimento, 'realizado_em', p.realizado_em,
                                        'quantidade', p.quantidade, 'financiamento', v_fin) ORDER BY p.realizado_em)
      INTO v_procedimentos
      FROM (SELECT min(r.id::text) AS id, r.procedimento, min(r.realizado_em) AS realizado_em, sum(r.quantidade) AS quantidade
              FROM public.procedimentos_realizados r
             WHERE r.episodio_id = i.episodio_id AND r.cancelado_em IS NULL AND r.realizado_em >= i.data_admissao
             GROUP BY r.procedimento, (r.realizado_em AT TIME ZONE 'America/Sao_Paulo')::date) p;
  END IF;

  SELECT r.resumo INTO v_resumo FROM public.resumos_clinicos r
   WHERE r.internacao_id = i.id ORDER BY r.criado_em DESC LIMIT 1;

  RETURN jsonb_build_object(
    'paciente', private.rnds_carga_paciente(i.paciente_id),
    'estabelecimento', private.rnds_carga_estabelecimento(i.unidade_id),
    'encontro', jsonb_build_object(
      'id', i.id, 'paciente_id', i.paciente_id, 'unidade_id', i.unidade_id, 'tipo_internacao', i.tipo_internacao,
      'origem_admissao', i.origem_admissao, 'status', i.status, 'leito_atual_id', i.leito_atual_id,
      'setor_atual_id', i.setor_atual_id, 'data_admissao', i.data_admissao,
      'data_entrada_setor', i.data_entrada_setor, 'data_alta', i.data_alta,
      'cid_principal', i.cid_principal, 'motivo_alta', i.motivo_alta),
    'contato', jsonb_build_object(
      'modalidade', CASE WHEN i.tipo_internacao = 'observacao' THEN '06' ELSE '04' END,
      'carater', CASE WHEN i.tipo_internacao = 'eletiva' THEN '01' ELSE '02' END,
      'procedencia', CASE WHEN i.origem_admissao = 'outra_unidade' THEN '12' ELSE '99' END,
      'desfecho', v_desfecho),
    'profissional', private.rnds_carga_profissional(i.alta_por),
    'condicoes', coalesce(v_condicoes, '[]'::jsonb),
    'procedimentos', coalesce(v_procedimentos, '[]'::jsonb),
    'resumo_evolucao', v_resumo);
END;
$$;

-- ── 6. As três funções do serviço ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rnds_pegar_lote(p_limite integer DEFAULT 20)
RETURNS TABLE (id uuid, tipo_documento text, unidade_id uuid, tentativas integer)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  WITH escolhidos AS (
    SELECT o.id FROM public.interop_outbox o
      JOIN public.rnds_config_unidade c ON c.unidade_id = o.unidade_id
     WHERE o.status IN ('pendente', 'retido')
       AND c.envio_ligado AND c.pausado_em IS NULL
       AND coalesce(o.proxima_tentativa_em, o.created_at) <= now()
       AND (o.travado_ate IS NULL OR o.travado_ate < now())
     ORDER BY coalesce(o.proxima_tentativa_em, o.created_at)
     LIMIT greatest(1, least(coalesce(p_limite, 20), 100))
     FOR UPDATE OF o SKIP LOCKED
  )
  UPDATE public.interop_outbox o
     SET travado_ate = now() + interval '5 minutes', atualizado_em = now()
    FROM escolhidos x
   WHERE o.id = x.id
  RETURNING o.id, o.tipo_documento, o.unidade_id, o.tentativas
$$;

CREATE OR REPLACE FUNCTION public.rnds_dados_documento(p_item uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.interop_outbox;
  c public.rnds_config_unidade;
  v_dados jsonb;
  v_prof uuid;
  v_uf text;
  v_anterior text;
BEGIN
  SELECT * INTO o FROM public.interop_outbox WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'item % não encontrado', p_item; END IF;
  SELECT * INTO c FROM public.rnds_config_unidade WHERE unidade_id = o.unidade_id;
  SELECT u.uf INTO v_uf FROM public.unidades u WHERE u.id = o.unidade_id;

  IF o.tipo_documento = 'rac' THEN
    v_dados := private.rnds_carga_rac(o.referencia_id);
    v_prof := nullif(v_dados -> 'profissional' ->> 'id', '')::uuid;
  ELSIF o.tipo_documento = 'sumario_alta' THEN
    v_dados := private.rnds_carga_sa(o.referencia_id);
    v_prof := nullif(v_dados -> 'profissional' ->> 'id', '')::uuid;
  ELSE
    v_dados := o.payload -> 'mira';
    IF v_dados IS NULL THEN RAISE EXCEPTION 'item de regulação sem o retrato MIRA'; END IF;
    v_prof := o.profissional_id;
  END IF;

  -- a RNDS liga a substituição pelo id do último documento aceito
  SELECT x.id_rnds INTO v_anterior FROM public.interop_outbox x
   WHERE x.tipo_documento = o.tipo_documento AND x.referencia_id = o.referencia_id
     AND x.status = 'enviado' AND x.id_rnds IS NOT NULL AND x.id <> o.id
   ORDER BY x.enviado_em DESC LIMIT 1;

  RETURN jsonb_build_object(
    'item_id', o.id,
    'tipo', o.tipo_documento,
    'dados', v_dados,
    'envio', jsonb_build_object(
      'ambiente', c.ambiente,
      'uf', v_uf,
      'identificador_solicitante', c.identificador_solicitante,
      'id_rnds_anterior', v_anterior,
      'profissional_id', v_prof,
      'profissional_cns', private.rnds_carga_profissional(v_prof) ->> 'cns'));
END;
$$;

-- p_resultado:
--   enviado     201 da RNDS (p_id_rnds obrigatório)
--   retido      falta dado; tenta de novo em 1 h
--   reenviar    falha passageira (rede, 5xx); espera crescente até 1 h, e
--               depois de 30 tentativas (cerca de 24 h) vira erro
--   erro        recusa definitiva (422): não tenta de novo
--   credencial  a RNDS recusou a credencial: o item volta à fila e a unidade pausa
CREATE OR REPLACE FUNCTION public.rnds_registrar_resultado(
  p_item uuid, p_resultado text, p_id_rnds text DEFAULT NULL,
  p_bundle jsonb DEFAULT NULL, p_resposta jsonb DEFAULT NULL, p_erro text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.interop_outbox;
  v_status text;
BEGIN
  SELECT * INTO o FROM public.interop_outbox WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item % não encontrado', p_item; END IF;
  IF o.status NOT IN ('pendente', 'retido') THEN
    RAISE EXCEPTION 'item % está %, não aceita resultado', p_item, o.status;
  END IF;

  IF p_resultado = 'enviado' THEN
    IF nullif(p_id_rnds, '') IS NULL THEN RAISE EXCEPTION 'enviado sem o id da RNDS'; END IF;
    UPDATE public.interop_outbox
       SET status = 'enviado', id_rnds = p_id_rnds, enviado_em = now(), tentativas = tentativas + 1,
           bundle_enviado = p_bundle, resposta = p_resposta, ultimo_erro = NULL,
           proxima_tentativa_em = NULL, travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
    v_status := 'enviado';
  ELSIF p_resultado = 'retido' THEN
    UPDATE public.interop_outbox
       SET status = 'retido', ultimo_erro = p_erro, proxima_tentativa_em = now() + interval '1 hour',
           travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
    v_status := 'retido';
  ELSIF p_resultado = 'reenviar' THEN
    v_status := CASE WHEN o.tentativas + 1 >= 30 THEN 'erro' ELSE 'pendente' END;
    UPDATE public.interop_outbox
       SET status = v_status, tentativas = tentativas + 1, bundle_enviado = coalesce(p_bundle, bundle_enviado),
           resposta = p_resposta,
           ultimo_erro = CASE WHEN v_status = 'erro' THEN 'sem resposta da RNDS depois de 30 tentativas: ' || coalesce(p_erro, '')
                              ELSE p_erro END,
           proxima_tentativa_em = CASE WHEN v_status = 'pendente'
                                       THEN now() + least(interval '1 minute' * power(2, o.tentativas), interval '1 hour') END,
           travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
  ELSIF p_resultado = 'erro' THEN
    UPDATE public.interop_outbox
       SET status = 'erro', tentativas = tentativas + 1, bundle_enviado = p_bundle, resposta = p_resposta,
           ultimo_erro = p_erro, proxima_tentativa_em = NULL, travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
    v_status := 'erro';
  ELSIF p_resultado = 'credencial' THEN
    UPDATE public.interop_outbox
       SET status = 'pendente', resposta = p_resposta, ultimo_erro = p_erro,
           proxima_tentativa_em = NULL, travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
    UPDATE public.rnds_config_unidade
       SET pausado_em = now(), pausa_motivo = coalesce(p_erro, 'credencial recusada pela RNDS'), atualizado_em = now()
     WHERE unidade_id = o.unidade_id;
    v_status := 'pendente';
  ELSE
    RAISE EXCEPTION 'resultado desconhecido: %', p_resultado;
  END IF;
  RETURN v_status;
END;
$$;

-- ── 7. Conferência noturna ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.rnds_conferencias (
  dia          date PRIMARY KEY,
  regulacao    integer NOT NULL,
  rac          integer NOT NULL,
  sumario_alta integer NOT NULL,
  feita_em     timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.rnds_conferencias FROM PUBLIC, anon, authenticated;

-- O que mudou no dia (horário de Brasília) e não está na fila entra agora.
-- Item com erro não volta (a recusa definitiva é olhada à mão).
CREATE OR REPLACE FUNCTION private.rnds_conferencia_noturna(
  p_dia date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1))
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ini timestamptz := p_dia::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim timestamptz := (p_dia + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_antes integer;
  v_reg integer;
  v_rac integer := 0;
  v_sa integer := 0;
  r record;
BEGIN
  SELECT count(*) INTO v_antes FROM public.interop_outbox WHERE tipo_documento = 'regulacao';
  FOR r IN
    SELECT e.solicitacao_id AS id FROM public.regulacao_eventos e WHERE e.em >= v_ini AND e.em < v_fim
    UNION
    SELECT s.id FROM public.regulacao_solicitacoes s WHERE s.criada_em >= v_ini AND s.criada_em < v_fim
  LOOP
    PERFORM private.rnds_enfileirar_regulacao(r.id);
  END LOOP;
  SELECT count(*) - v_antes INTO v_reg FROM public.interop_outbox WHERE tipo_documento = 'regulacao';

  FOR r IN
    SELECT e.id, e.unidade_id, e.paciente_id FROM public.episodios e
     WHERE e.etapa = 'encerrado' AND e.encerrado_em >= v_ini AND e.encerrado_em < v_fim
       AND coalesce(e.desfecho, '') NOT IN ('internacao', 'observacao', 'cancelado')
       AND NOT EXISTS (SELECT 1 FROM public.interop_outbox o
                        WHERE o.tipo_documento = 'rac' AND o.referencia_id = e.id AND o.status <> 'descartado')
  LOOP
    PERFORM private.enfileirar_documento(r.unidade_id, 'rac', r.id,
      jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'rac',
                         'episodio_id', r.id, 'paciente_id', r.paciente_id));
    v_rac := v_rac + 1;
  END LOOP;

  FOR r IN
    SELECT i.id, i.unidade_id, i.paciente_id FROM public.internacoes i
     WHERE i.status IN ('alta_melhorada', 'alta_pedido', 'alta_evasao', 'transferencia_externa', 'obito')
       AND i.data_alta >= v_ini AND i.data_alta < v_fim
       AND NOT EXISTS (SELECT 1 FROM public.interop_outbox o
                        WHERE o.tipo_documento = 'sumario_alta' AND o.referencia_id = i.id AND o.status <> 'descartado')
  LOOP
    PERFORM private.enfileirar_documento(r.unidade_id, 'sumario_alta', r.id,
      jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'sumario_alta',
                         'internacao_id', r.id, 'paciente_id', r.paciente_id));
    v_sa := v_sa + 1;
  END LOOP;

  INSERT INTO private.rnds_conferencias (dia, regulacao, rac, sumario_alta)
  VALUES (p_dia, v_reg, v_rac, v_sa)
  ON CONFLICT (dia) DO UPDATE
    SET regulacao = EXCLUDED.regulacao, rac = EXCLUDED.rac, sumario_alta = EXCLUDED.sumario_alta, feita_em = now();
  RETURN jsonb_build_object('dia', p_dia, 'regulacao', v_reg, 'rac', v_rac, 'sumario_alta', v_sa);
END;
$$;

-- ── 8. Permissões ───────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.rnds_codigo_desfecho(text), private.rnds_carga_paciente(uuid),
  private.rnds_carga_estabelecimento(uuid), private.rnds_carga_profissional(uuid),
  private.rnds_carga_observacoes(uuid), private.rnds_carga_rac(uuid), private.rnds_carga_sa(uuid),
  private.rnds_conferencia_noturna(date), private.rnds_enfileirar_regulacao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rnds_pegar_lote(integer), public.rnds_dados_documento(uuid),
  public.rnds_registrar_resultado(uuid, text, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rnds_pegar_lote(integer), public.rnds_dados_documento(uuid),
  public.rnds_registrar_resultado(uuid, text, text, jsonb, jsonb, text) TO service_role;

-- 01:00 em Brasília (04:00 UTC)
SELECT cron.schedule('rnds-conferencia-noturna', '0 4 * * *', 'SELECT private.rnds_conferencia_noturna();');
