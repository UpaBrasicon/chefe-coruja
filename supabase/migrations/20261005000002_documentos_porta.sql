-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend · formulários dos documentos da porta e da internação.
--
-- O que o protótipo pede e o banco ainda não tinha:
--   1. triagem_recente_do_paciente — os vitais crus, a avaliação (comorbidades,
--      medicações, Glasgow) e o O₂ da última classificação do paciente: o
--      encaminhamento imprime os vitais "da classificação, como registrados" e
--      a ficha de admissão parte deles (o médico corrige se aferiu de novo).
--   2. "Detalhes da admissão" (manual 3.3): esquemas e itens da UNIDADE, que o
--      gestor cadastra, e em quais setores o preenchimento é obrigatório. Não
--      gera solicitação; serve só para estatística. Não sai na folha.
--   3. Ficha de admissão estruturada: o texto continua em documentos_clinicos
--      (registrar_evolucao — quem lê o prontuário lê texto), e os campos do
--      protótipo (procedência, vitais, S, O, CID, plano, detalhes) ficam em
--      admissao_fichas, ligados ao documento. registrar_admissao confere as
--      pendências no servidor.
--   4. Laudos de AIH emitidos por mim no plantão (últimas 12 h), para a lista
--      "Laudos emitidos neste plantão" com reimpressão.
--   5. Protocolos de receita da INSTITUIÇÃO (o gestor escreve; um protocolo
--      genérico na tela seria lido como o protocolo daqui — por isso nada vem
--      semeado). O médico só aplica; dose e posologia são do texto da unidade.
--
-- Leituras e escritas por RPC SECURITY DEFINER com search_path vazio; as
-- tabelas novas ficam com RLS ligada e sem política (só as RPCs entram).
-- Escritas exigem o segundo fator. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── utilitário: texto → jsonb sem estourar ─────────────────────────────────
CREATE OR REPLACE FUNCTION private.json_ou_nulo(p text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p IS NULL OR left(btrim(p), 1) <> '{' THEN RETURN NULL; END IF;
  RETURN p::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.json_ou_nulo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.json_ou_nulo(text) TO authenticated;

-- gestor (ou admin) da unidade
CREATE OR REPLACE FUNCTION private.sou_gestor_da_unidade(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR coalesce(private.papel_na_unidade(p_unidade) IN ('gestor', 'admin'), false)
$$;
REVOKE ALL ON FUNCTION private.sou_gestor_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.sou_gestor_da_unidade(uuid) TO authenticated;

-- ── 1. última classificação do paciente ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.triagem_recente_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.classificacoes_risco;
  v_sinais jsonb;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE
     OR NOT private.prontuario_aberto(p_paciente) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT cr.* INTO c
    FROM public.classificacoes_risco cr
    JOIN public.episodios e ON e.id = cr.episodio_id
   WHERE cr.paciente_id = p_paciente
   ORDER BY e.chegada_em DESC, cr.criado_em DESC
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT jsonb_object_agg(cc.nome, o.valor_num) INTO v_sinais
    FROM public.observacao o JOIN public.conceito cc ON cc.id = o.conceito_id
   WHERE o.episodio_id = c.episodio_id AND o.aferido_em = c.criado_em AND o.registrado_por = c.autor_id;
  RETURN jsonb_build_object(
    'id', c.id, 'episodio_id', c.episodio_id, 'criado_em', c.criado_em, 'cor', c.cor, 'publico', c.publico,
    'queixa', c.queixa, 'avaliacao', coalesce(c.avaliacao, '{}'::jsonb), 'oxigenio', c.oxigenio,
    'sinais', coalesce(v_sinais, '{}'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.triagem_recente_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.triagem_recente_do_paciente(uuid) TO authenticated;

-- ── 2. detalhes da admissão: configuração da unidade ────────────────────────
CREATE TABLE IF NOT EXISTS public.admissao_detalhes_esquemas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome           text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 80),
  itens          text[] NOT NULL CHECK (cardinality(itens) BETWEEN 1 AND 60),
  ativo          boolean NOT NULL DEFAULT true,
  atualizado_por uuid REFERENCES public.perfis(id),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, nome)
);
CREATE TABLE IF NOT EXISTS public.admissao_detalhes_obrigatorio (
  setor_id     uuid PRIMARY KEY REFERENCES public.setores(id) ON DELETE CASCADE,
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  definido_por uuid REFERENCES public.perfis(id),
  definido_em  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admissao_detalhes_esquemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissao_detalhes_obrigatorio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admissao_detalhes_esquemas, public.admissao_detalhes_obrigatorio FROM PUBLIC, anon;
COMMENT ON TABLE public.admissao_detalhes_esquemas IS
  'Detalhes da admissão (manual 3.3): esquemas e itens da unidade, cadastrados pelo gestor. Só estatística; não gera solicitação nem sai na folha.';

CREATE OR REPLACE FUNCTION public.admissao_detalhes_config(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN jsonb_build_object(
    'esquemas', coalesce((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'itens', to_jsonb(e.itens), 'ativo', e.ativo) ORDER BY e.nome)
                            FROM public.admissao_detalhes_esquemas e WHERE e.unidade_id = p_unidade), '[]'::jsonb),
    'obrigatorios', coalesce((SELECT jsonb_agg(o.setor_id) FROM public.admissao_detalhes_obrigatorio o WHERE o.unidade_id = p_unidade), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.admissao_detalhes_config(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admissao_detalhes_config(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_admissao_esquema(
  p_unidade uuid, p_nome text, p_itens text[], p_esquema uuid DEFAULT NULL, p_ativo boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_itens text[];
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade configura os detalhes da admissão.'; END IF;
  IF length(btrim(coalesce(p_nome, ''))) < 2 THEN RAISE EXCEPTION 'Dê um nome ao esquema.'; END IF;
  SELECT array_agg(DISTINCT btrim(x)) INTO v_itens FROM unnest(coalesce(p_itens, '{}')) x WHERE length(btrim(x)) BETWEEN 1 AND 120;
  IF coalesce(cardinality(v_itens), 0) = 0 THEN RAISE EXCEPTION 'O esquema precisa de ao menos um item.'; END IF;
  IF p_esquema IS NULL THEN
    INSERT INTO public.admissao_detalhes_esquemas (unidade_id, nome, itens, ativo, atualizado_por)
    VALUES (p_unidade, btrim(p_nome), v_itens, coalesce(p_ativo, true), private.meu_perfil_id())
    ON CONFLICT (unidade_id, nome) DO UPDATE SET itens = EXCLUDED.itens, ativo = EXCLUDED.ativo,
      atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.admissao_detalhes_esquemas
       SET nome = btrim(p_nome), itens = v_itens, ativo = coalesce(p_ativo, true), atualizado_por = private.meu_perfil_id(), atualizado_em = now()
     WHERE id = p_esquema AND unidade_id = p_unidade
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Esquema não encontrado nesta unidade.'; END IF;
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_admissao_esquema(uuid, text, text[], uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_admissao_esquema(uuid, text, text[], uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_admissao_detalhes_obrigatorio(p_setor uuid, p_obrigatorio boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.setores WHERE id = p_setor;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  IF NOT private.sou_gestor_da_unidade(v_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade configura os detalhes da admissão.'; END IF;
  IF p_obrigatorio THEN
    INSERT INTO public.admissao_detalhes_obrigatorio (setor_id, unidade_id, definido_por)
    VALUES (p_setor, v_unidade, private.meu_perfil_id())
    ON CONFLICT (setor_id) DO UPDATE SET definido_por = EXCLUDED.definido_por, definido_em = now();
  ELSE
    DELETE FROM public.admissao_detalhes_obrigatorio WHERE setor_id = p_setor;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.definir_admissao_detalhes_obrigatorio(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_admissao_detalhes_obrigatorio(uuid, boolean) TO authenticated;

-- ── 3. ficha de admissão estruturada ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admissao_fichas (
  documento_id      uuid PRIMARY KEY REFERENCES public.documentos_clinicos(id) ON DELETE CASCADE,
  documento_raiz_id uuid NOT NULL,
  internacao_id     uuid NOT NULL REFERENCES public.internacoes(id) ON DELETE CASCADE,
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id       uuid NOT NULL REFERENCES public.pacientes(id),
  setor_id          uuid REFERENCES public.setores(id),
  autor_id          uuid NOT NULL REFERENCES public.perfis(id),
  dados             jsonb NOT NULL,
  detalhes          jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admissao_fichas_internacao ON public.admissao_fichas (internacao_id);
CREATE INDEX IF NOT EXISTS admissao_fichas_unidade_setor ON public.admissao_fichas (unidade_id, setor_id, criado_em);
ALTER TABLE public.admissao_fichas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admissao_fichas FROM PUBLIC, anon;
COMMENT ON TABLE public.admissao_fichas IS
  'Campos da ficha de admissão médica com os nomes do protótipo (procedencia, acompanhante, comorb, meds, pa, fc, fr, tax, spo2, spo2Cond, o2L, hgt, glasgow, peso, subjetivo, objetivo, cid, plano, detalhes). O texto legível é o documentos_clinicos ligado.';

CREATE OR REPLACE FUNCTION public.registrar_admissao(p_internacao uuid, p_conteudo text, p_ficha jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_id uuid;
  v_det jsonb := coalesce(p_ficha -> 'detalhes', '[]'::jsonb);
  v_falta text[] := '{}';
  d jsonb;
  v_setor_nome text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_ficha IS NULL OR jsonb_typeof(p_ficha) <> 'object' THEN RAISE EXCEPTION 'Ficha de admissão inválida.'; END IF;
  IF octet_length(p_ficha::text) > 65536 THEN RAISE EXCEPTION 'Ficha de admissão grande demais.'; END IF;
  IF jsonb_typeof(v_det) <> 'array' THEN RAISE EXCEPTION 'Detalhes da admissão inválidos.'; END IF;
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;

  -- pendências do protótipo (admPendencias), conferidas aqui também
  IF length(btrim(coalesce(p_ficha ->> 'subjetivo', ''))) = 0 THEN v_falta := array_append(v_falta, 'Subjetivo'); END IF;
  IF length(btrim(coalesce(p_ficha ->> 'objetivo', ''))) = 0 THEN v_falta := array_append(v_falta, 'Objetivo'); END IF;
  IF length(btrim(coalesce(p_ficha ->> 'cid', ''))) = 0 THEN v_falta := array_append(v_falta, 'Hipótese diagnóstica'); END IF;
  IF length(btrim(coalesce(p_ficha ->> 'plano', ''))) = 0 THEN v_falta := array_append(v_falta, 'Avaliação inicial e plano de tratamento'); END IF;
  IF jsonb_array_length(v_det) = 0
     AND EXISTS (SELECT 1 FROM public.admissao_detalhes_obrigatorio o WHERE o.setor_id = i.setor_atual_id)
     AND EXISTS (SELECT 1 FROM public.admissao_detalhes_esquemas e WHERE e.unidade_id = i.unidade_id AND e.ativo) THEN
    SELECT nome INTO v_setor_nome FROM public.setores WHERE id = i.setor_atual_id;
    v_falta := array_append(v_falta, 'Detalhes da admissão (obrigatório no setor ' || coalesce(v_setor_nome, '') || ')');
  END IF;
  IF cardinality(v_falta) > 0 THEN
    RAISE EXCEPTION 'Falta para registrar a admissão: %.', array_to_string(v_falta, ', ');
  END IF;
  -- cada detalhe precisa existir na configuração ativa da unidade
  FOR d IN SELECT * FROM jsonb_array_elements(v_det) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.admissao_detalhes_esquemas e
                    WHERE e.unidade_id = i.unidade_id AND e.ativo AND e.nome = d ->> 'esquema' AND (d ->> 'item') = ANY (e.itens)) THEN
      RAISE EXCEPTION 'Detalhe da admissão fora da configuração da unidade: %.', coalesce(d ->> 'esquema', '') || ' · ' || coalesce(d ->> 'item', '');
    END IF;
  END LOOP;

  -- o texto vai para o prontuário pelo caminho de sempre (acesso, plantão, 1 admissão)
  v_id := public.registrar_evolucao(p_internacao, 'admissao_anamnese', p_conteudo);
  INSERT INTO public.admissao_fichas (documento_id, documento_raiz_id, internacao_id, unidade_id, paciente_id, setor_id, autor_id, dados, detalhes)
  VALUES (v_id, v_id, i.id, i.unidade_id, i.paciente_id, i.setor_atual_id, private.meu_perfil_id(), p_ficha - 'detalhes', v_det);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_admissao(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_admissao(uuid, text, jsonb) TO authenticated;

-- A ficha da internação (para a folha e para reabrir): quem pode atuar no
-- paciente, com o prontuário aberto.
CREATE OR REPLACE FUNCTION public.admissao_ficha(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  f public.admissao_fichas;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF private.segundo_fator_ok() IS NOT TRUE OR private.pode_atuar_no_paciente(i.paciente_id) IS NOT TRUE
     OR NOT private.prontuario_aberto(i.paciente_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT * INTO f FROM public.admissao_fichas WHERE internacao_id = p_internacao ORDER BY criado_em DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN f.dados || jsonb_build_object('detalhes', f.detalhes, 'documento_id', f.documento_id, 'criado_em', f.criado_em);
END $$;
REVOKE ALL ON FUNCTION public.admissao_ficha(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admissao_ficha(uuid) TO authenticated;

-- ── 4. laudos de AIH que eu emiti no plantão ────────────────────────────────
CREATE OR REPLACE FUNCTION public.meus_laudos_aih_do_plantao()
RETURNS TABLE (id uuid, numero text, paciente_id uuid, paciente text, emitido_em timestamptz, cid text, procedimento text, setor text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  RETURN QUERY
  SELECT d.id, d.numero, d.paciente_id, coalesce(pa.nome_social, pa.nome), coalesce(d.emitido_em, d.created_at),
         coalesce(j #>> '{aih,cid}', ''),
         concat_ws(' · ', nullif(j #>> '{aih,procCod}', ''), nullif(j #>> '{aih,procDesc}', '')),
         s.nome
    FROM public.documentos_clinicos d
    JOIN public.pacientes pa ON pa.id = d.paciente_id
    LEFT JOIN public.setores s ON s.id = pa.setor_id
    CROSS JOIN LATERAL (SELECT private.json_ou_nulo(d.conteudo) AS j) x
   WHERE d.autor_id = private.meu_perfil_id()
     AND d.tipo_documento = 'laudo_aih'
     AND d.estado = 'ativo'
     AND coalesce(d.emitido_em, d.created_at) > now() - interval '12 hours'
   ORDER BY coalesce(d.emitido_em, d.created_at) DESC
   LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.meus_laudos_aih_do_plantao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meus_laudos_aih_do_plantao() TO authenticated;

-- ── 5. protocolos de receita da instituição ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receita_protocolos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome           text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 80),
  indicacao      text CHECK (indicacao IS NULL OR length(indicacao) <= 160),
  versao         text CHECK (versao IS NULL OR length(versao) <= 40),
  itens          jsonb NOT NULL CHECK (jsonb_typeof(itens) = 'array' AND jsonb_array_length(itens) BETWEEN 1 AND 30),
  ativo          boolean NOT NULL DEFAULT true,
  atualizado_por uuid REFERENCES public.perfis(id),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, nome)
);
ALTER TABLE public.receita_protocolos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.receita_protocolos FROM PUBLIC, anon;
COMMENT ON TABLE public.receita_protocolos IS
  'Protocolos de receita da instituição, escritos pelo gestor. Itens: [{medicamento, posologia, quantidade}]. Nada é semeado: protocolo genérico seria lido como o da unidade.';

CREATE OR REPLACE FUNCTION public.receita_protocolos_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'indicacao', r.indicacao, 'versao', r.versao,
                                                       'itens', r.itens, 'ativo', r.ativo) ORDER BY r.nome)
                     FROM public.receita_protocolos r WHERE r.unidade_id = p_unidade), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.receita_protocolos_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receita_protocolos_da_unidade(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_receita_protocolo(
  p_unidade uuid, p_nome text, p_indicacao text, p_itens jsonb, p_protocolo uuid DEFAULT NULL, p_ativo boolean DEFAULT true, p_versao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  it jsonb;
  v_itens jsonb := '[]'::jsonb;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade escreve os protocolos de receita.'; END IF;
  IF length(btrim(coalesce(p_nome, ''))) < 2 THEN RAISE EXCEPTION 'Dê um nome ao protocolo.'; END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'O protocolo precisa de ao menos um medicamento.';
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    IF length(btrim(coalesce(it ->> 'medicamento', ''))) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Medicamento do protocolo sem nome.'; END IF;
    IF length(btrim(coalesce(it ->> 'posologia', ''))) NOT BETWEEN 3 AND 300 THEN
      RAISE EXCEPTION 'Escreva a posologia de %.', it ->> 'medicamento';
    END IF;
    IF length(coalesce(it ->> 'quantidade', '')) > 80 THEN RAISE EXCEPTION 'Quantidade longa demais.'; END IF;
    v_itens := v_itens || jsonb_build_object('medicamento', btrim(it ->> 'medicamento'), 'posologia', btrim(it ->> 'posologia'),
                                             'quantidade', coalesce(btrim(it ->> 'quantidade'), ''));
  END LOOP;
  IF p_protocolo IS NULL THEN
    INSERT INTO public.receita_protocolos (unidade_id, nome, indicacao, versao, itens, ativo, atualizado_por)
    VALUES (p_unidade, btrim(p_nome), nullif(btrim(p_indicacao), ''), nullif(btrim(p_versao), ''), v_itens, coalesce(p_ativo, true), private.meu_perfil_id())
    ON CONFLICT (unidade_id, nome) DO UPDATE SET indicacao = EXCLUDED.indicacao, versao = EXCLUDED.versao, itens = EXCLUDED.itens,
      ativo = EXCLUDED.ativo, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.receita_protocolos
       SET nome = btrim(p_nome), indicacao = nullif(btrim(p_indicacao), ''), versao = nullif(btrim(p_versao), ''), itens = v_itens,
           ativo = coalesce(p_ativo, true), atualizado_por = private.meu_perfil_id(), atualizado_em = now()
     WHERE id = p_protocolo AND unidade_id = p_unidade
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Protocolo não encontrado nesta unidade.'; END IF;
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_receita_protocolo(uuid, text, text, jsonb, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_receita_protocolo(uuid, text, text, jsonb, uuid, boolean, text) TO authenticated;
