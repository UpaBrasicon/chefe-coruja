-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 1 (laboratório/LIS), etapa 1.2: resultado e situação do
-- exame (decisões do RT de 18/10/2026 para a tarefa e de 19/10/2026 para a
-- etapa, "1a 2a 3a 4a 5a 6a 7a").
--
-- Situação: pedido → coletado (a enfermagem marca, com a hora) → em análise
-- (vem do laboratório, etapa 1.3) → resultado (liberado) ou cancelado.
--
-- Resultado em versões. Cada versão guarda a origem (manual ou laboratório), o
-- texto, o laudo em PDF opcional e, quando vier do laboratório, os analitos
-- como ele mandou: valor em texto (e em número quando for número), unidade,
-- faixa e marca do laboratório. O sistema não interpreta nem marca nada; o
-- crítico vem só do laboratório. Retificação abre uma versão nova e a anterior
-- fica no histórico, com o motivo.
--
-- 3a. O resultado à mão continua texto livre, com PDF opcional, marcado manual.
-- 4a. Laudo só em PDF, até 10 MB, em área privada; abre só para quem vê o
--     exame, por uma liberação curta como nos anexos da regulação.
-- 5a. Resultado liberado avisa quem pediu e o médico atual (o do atendimento
--     na porta; na internação, os médicos de plantão no setor). Fica marcado
--     "novo" até alguém abrir. Crítico: aviso também à enfermagem de plantão
--     no setor, e o médico registra a ciência.
-- 6a. A alta continua impedida com exame sem resultado: agora pedido, coletado
--     ou em análise.
-- 7a. Tabela do resultado e histórico de versões; o gráfico fica para depois.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.exames_pedidos DROP CONSTRAINT exames_pedidos_situacao_check;
ALTER TABLE public.exames_pedidos ADD CONSTRAINT exames_pedidos_situacao_check
  CHECK (situacao IN ('pedido', 'coletado', 'em_analise', 'resultado', 'cancelado'));
ALTER TABLE public.exames_pedidos
  ADD COLUMN IF NOT EXISTS coletado_em        timestamptz,
  ADD COLUMN IF NOT EXISTS coletado_por       uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS em_analise_em      timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_origem   text CHECK (resultado_origem IN ('manual', 'laboratorio')),
  ADD COLUMN IF NOT EXISTS critico            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resultado_visto_em timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_visto_por uuid REFERENCES public.perfis(id);

CREATE TABLE public.exame_resultados (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exame_id            uuid NOT NULL REFERENCES public.exames_pedidos(id),
  versao              int NOT NULL,
  origem              text NOT NULL CHECK (origem IN ('manual', 'laboratorio')),
  texto               text,
  pdf_caminho         text,
  pdf_nome            text,
  critico             boolean NOT NULL DEFAULT false,
  laboratorio_ref     text,
  liberado_em         timestamptz NOT NULL DEFAULT now(),
  registrado_por      uuid REFERENCES public.perfis(id),
  vigente             boolean NOT NULL DEFAULT true,
  retificado_em       timestamptz,
  motivo_retificacao  text,
  UNIQUE (exame_id, versao),
  CONSTRAINT exame_resultados_conteudo CHECK (texto IS NOT NULL OR pdf_caminho IS NOT NULL OR origem = 'laboratorio')
);
CREATE UNIQUE INDEX exame_resultados_vigente ON public.exame_resultados (exame_id) WHERE vigente;

CREATE TABLE public.exame_resultado_itens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resultado_id  uuid NOT NULL REFERENCES public.exame_resultados(id),
  ordem         int NOT NULL DEFAULT 0,
  analito       text NOT NULL,
  loinc         text,
  valor_texto   text,
  valor_num     numeric,
  unidade       text,
  referencia    text,
  marca         text,
  critico       boolean NOT NULL DEFAULT false
);
CREATE INDEX exame_resultado_itens_resultado ON public.exame_resultado_itens (resultado_id);

CREATE TABLE public.exame_cientes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resultado_id  uuid NOT NULL REFERENCES public.exame_resultados(id),
  perfil_id     uuid NOT NULL REFERENCES public.perfis(id),
  em            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resultado_id, perfil_id)
);

CREATE TABLE private.exame_laudo_liberacao (
  perfil_id uuid NOT NULL,
  caminho   text NOT NULL,
  ate       timestamptz NOT NULL,
  PRIMARY KEY (perfil_id, caminho)
);

ALTER TABLE public.exame_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exame_resultado_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exame_cientes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exame_resultados, public.exame_resultado_itens, public.exame_cientes FROM anon, authenticated;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.exame_resultados FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.exame_resultado_itens FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.exame_cientes FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

-- 4a. laudo em PDF: área privada
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exames', 'exames', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- quem pode ver o resultado: o gestor da unidade, ou médico e enfermagem com o
-- paciente no plantão (a recepção não abre resultado nem laudo)
CREATE OR REPLACE FUNCTION private.pode_ver_exame(e public.exames_pedidos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR private.papel_na_unidade(e.unidade_id) = 'gestor'
      OR (private.paciente_no_meu_plantao(e.paciente_id)
          AND (private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE OR private.sou_enfermagem(e.unidade_id)))
$$;
-- quem registra resultado à mão: médico ou enfermagem com o paciente no plantão
CREATE OR REPLACE FUNCTION private.pode_registrar_exame(e public.exames_pedidos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.paciente_em_cuidado_no_plantao(e.paciente_id)
     AND (private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE OR private.sou_enfermagem(e.unidade_id))
$$;
REVOKE ALL ON FUNCTION private.pode_ver_exame(public.exames_pedidos) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pode_registrar_exame(public.exames_pedidos) FROM PUBLIC, anon, authenticated;

-- caminho do laudo: <exame_id>/<nome>.pdf
CREATE OR REPLACE FUNCTION private.exame_do_caminho(p_nome text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN split_part(p_nome, '/', 1) ~ '^[0-9a-f-]{36}$' THEN split_part(p_nome, '/', 1)::uuid END
$$;
CREATE OR REPLACE FUNCTION private.exame_pode_subir_laudo(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT lower(p_nome) LIKE '%.pdf' AND EXISTS (
    SELECT 1 FROM public.exames_pedidos e
     WHERE e.id = private.exame_do_caminho(p_nome) AND e.situacao <> 'cancelado' AND private.pode_registrar_exame(e))
$$;
CREATE OR REPLACE FUNCTION private.exame_laudo_liberado(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.exame_laudo_liberacao l WHERE l.perfil_id = auth.uid() AND l.caminho = p_nome AND l.ate > now())
$$;
GRANT EXECUTE ON FUNCTION private.exame_pode_subir_laudo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.exame_laudo_liberado(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.exame_do_caminho(text) TO authenticated;
CREATE POLICY exames_laudo_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exames' AND private.exame_pode_subir_laudo(name));
CREATE POLICY exames_laudo_leitura ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exames' AND private.exame_laudo_liberado(name));

-- 5a. avisos do resultado liberado
CREATE OR REPLACE FUNCTION private.avisar_resultado_exame(e public.exames_pedidos, p_critico boolean, p_retificado boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_setor uuid; v_pac text; v_msg text; v_tipo text;
BEGIN
  SELECT nome INTO v_pac FROM public.pacientes WHERE id = e.paciente_id;
  v_setor := coalesce((SELECT i.setor_atual_id FROM public.internacoes i WHERE i.id = e.internacao_id),
                      (SELECT ep.setor_id FROM public.episodios ep WHERE ep.id = e.episodio_id),
                      (SELECT pa.setor_id FROM public.pacientes pa WHERE pa.id = e.paciente_id));
  v_msg := CASE WHEN p_critico THEN 'Resultado CRÍTICO (marcado pelo laboratório): ' ELSE 'Resultado ' END
        || CASE WHEN p_retificado THEN 'retificado' ELSE 'liberado' END || ': ' || e.exame || ' · ' || coalesce(v_pac, 'paciente');
  v_tipo := CASE WHEN p_critico THEN 'exame_critico_' ELSE 'exame_resultado_' END || e.id::text;
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT d.perfil_id, e.unidade_id, private.data_atual(), v_tipo, v_msg
    FROM (
      SELECT e.pedido_por AS perfil_id
      UNION SELECT ep.atendimento_medico_id FROM public.episodios ep WHERE ep.id = e.episodio_id AND ep.etapa <> 'encerrado' AND e.internacao_id IS NULL
      UNION SELECT es.perfil_id FROM public.escala_plantao es
             WHERE es.ativo AND es.unidade_id = e.unidade_id AND es.setor_id = v_setor AND e.internacao_id IS NOT NULL
               AND es.inicio <= now() AND now() < es.inicio + make_interval(mins => es.duracao_min)
               AND EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = es.perfil_id AND v.unidade_id = e.unidade_id AND v.papel = 'plantonista')
      UNION SELECT es.perfil_id FROM public.escala_plantao es
             WHERE p_critico AND es.ativo AND es.unidade_id = e.unidade_id AND es.setor_id = v_setor
               AND es.inicio <= now() AND now() < es.inicio + make_interval(mins => es.duracao_min)
               AND EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = es.perfil_id AND v.unidade_id = e.unidade_id
                             AND v.papel IN ('enfermeiro', 'tecnico_enfermagem'))
    ) d
   WHERE d.perfil_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = d.perfil_id AND v.unidade_id = e.unidade_id)
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = EXCLUDED.mensagem, lida_em = NULL;
END $$;
REVOKE ALL ON FUNCTION private.avisar_resultado_exame(public.exames_pedidos, boolean, boolean) FROM PUBLIC, anon, authenticated;

-- grava uma versão do resultado; usada à mão (aqui) e pelo laboratório (etapa 1.3).
-- p_itens: [{"analito","loinc","valor","unidade","referencia","marca","critico"}]
CREATE OR REPLACE FUNCTION private.gravar_resultado_exame(p_exame uuid, p_origem text, p_texto text, p_pdf_caminho text, p_pdf_nome text,
                                                        p_itens jsonb, p_critico boolean, p_laboratorio_ref text, p_motivo_retificacao text, p_por uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos; v_ant public.exame_resultados; v_id uuid; v_versao int; it jsonb; n int := 0;
        v_texto text := nullif(btrim(coalesce(p_texto, '')), ''); v_critico boolean; v_resumo text;
BEGIN
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exame não encontrado.'; END IF;
  SELECT * INTO v_ant FROM public.exame_resultados WHERE exame_id = e.id AND vigente FOR UPDATE;
  IF v_ant.id IS NOT NULL THEN
    IF length(btrim(coalesce(p_motivo_retificacao, ''))) < 10 THEN RAISE EXCEPTION 'Retificação: diga o motivo (mínimo de 10 letras).'; END IF;
    UPDATE public.exame_resultados SET vigente = false, retificado_em = now(), motivo_retificacao = btrim(p_motivo_retificacao) WHERE id = v_ant.id;
  ELSIF e.situacao NOT IN ('pedido', 'coletado', 'em_analise') THEN
    RAISE EXCEPTION 'Exame não está aguardando resultado.';
  END IF;
  IF p_pdf_caminho IS NOT NULL AND private.exame_do_caminho(p_pdf_caminho) IS DISTINCT FROM e.id THEN
    RAISE EXCEPTION 'O laudo não é deste exame.';
  END IF;
  IF p_pdf_caminho IS NOT NULL AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'exames' AND o.name = p_pdf_caminho) THEN
    RAISE EXCEPTION 'O laudo não foi enviado.';
  END IF;
  v_versao := coalesce((SELECT max(versao) FROM public.exame_resultados WHERE exame_id = e.id), 0) + 1;
  v_critico := coalesce(p_critico, false)
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) x WHERE coalesce((x ->> 'critico')::boolean, false));
  INSERT INTO public.exame_resultados (exame_id, versao, origem, texto, pdf_caminho, pdf_nome, critico, laboratorio_ref, registrado_por)
  VALUES (e.id, v_versao, p_origem, v_texto, p_pdf_caminho, left(p_pdf_nome, 200), v_critico, p_laboratorio_ref, p_por)
  RETURNING id INTO v_id;
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) LOOP
    n := n + 1;
    INSERT INTO public.exame_resultado_itens (resultado_id, ordem, analito, loinc, valor_texto, valor_num, unidade, referencia, marca, critico)
    VALUES (v_id, n, left(btrim(it ->> 'analito'), 200), nullif(btrim(coalesce(it ->> 'loinc', '')), ''), left(it ->> 'valor', 500),
            CASE WHEN replace(btrim(coalesce(it ->> 'valor', '')), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$'
                 THEN replace(btrim(it ->> 'valor'), ',', '.')::numeric END,
            left(it ->> 'unidade', 50), left(it ->> 'referencia', 200), left(it ->> 'marca', 20), coalesce((it ->> 'critico')::boolean, false));
  END LOOP;
  -- o texto no pedido segue o resultado vigente (pacote de alta, parecer)
  v_resumo := coalesce(v_texto, (SELECT string_agg(concat_ws(' ', i.analito, i.valor_texto, i.unidade), '; ' ORDER BY i.ordem)
                                   FROM public.exame_resultado_itens i WHERE i.resultado_id = v_id), 'Laudo em PDF');
  UPDATE public.exames_pedidos SET situacao = 'resultado', resultado = left(v_resumo, 2000), resultado_origem = p_origem, critico = v_critico,
         resolvido_por = coalesce(p_por, resolvido_por), resolvido_em = now(), resultado_visto_em = NULL, resultado_visto_por = NULL
   WHERE id = e.id RETURNING * INTO e;
  PERFORM private.avisar_resultado_exame(e, v_critico, v_ant.id IS NOT NULL);
  PERFORM private.registrar_auditoria(CASE WHEN v_ant.id IS NULL THEN 'exame_resultado' ELSE 'exame_resultado_retificado' END,
    'exames_pedidos', e.id, e.unidade_id,
    jsonb_build_object('exame', e.exame, 'versao', v_versao, 'origem', p_origem, 'critico', v_critico, 'pdf', p_pdf_caminho IS NOT NULL,
                       'motivo', p_motivo_retificacao));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.gravar_resultado_exame(uuid, text, text, text, text, jsonb, boolean, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- 3a. resultado à mão (o caminho de antes continua: texto, ou cancelamento com motivo)
CREATE OR REPLACE FUNCTION public.resolver_exame(p_exame uuid, p_resultado text DEFAULT NULL::text, p_motivo_cancelamento text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE e public.exames_pedidos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame FOR UPDATE;
  IF NOT FOUND OR e.situacao NOT IN ('pedido', 'coletado', 'em_analise') THEN RAISE EXCEPTION 'Exame não encontrado ou já resolvido.'; END IF;
  IF NOT private.pode_registrar_exame(e) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.';
  END IF;
  IF p_resultado IS NOT NULL AND length(btrim(p_resultado)) >= 1 THEN
    PERFORM private.gravar_resultado_exame(e.id, 'manual', p_resultado, NULL, NULL, NULL, false, NULL, NULL, private.meu_perfil_id());
  ELSIF length(btrim(coalesce(p_motivo_cancelamento, ''))) >= 10 THEN
    UPDATE public.exames_pedidos SET situacao = 'cancelado', motivo_cancelamento = btrim(p_motivo_cancelamento),
           resolvido_por = private.meu_perfil_id(), resolvido_em = now()
     WHERE id = e.id;
  ELSE
    RAISE EXCEPTION 'Registre o resultado, ou cancele com motivo (mínimo de 10 letras).';
  END IF;
END $function$;

-- 3a/4a. resultado à mão com laudo em PDF opcional; retificar abre versão nova
CREATE OR REPLACE FUNCTION public.registrar_resultado_exame(p_exame uuid, p_texto text DEFAULT NULL, p_pdf_caminho text DEFAULT NULL,
                                                          p_pdf_nome text DEFAULT NULL, p_motivo_retificacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame;
  IF e.id IS NULL OR NOT private.pode_registrar_exame(e) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF e.situacao = 'cancelado' THEN RAISE EXCEPTION 'Exame cancelado.'; END IF;
  IF nullif(btrim(coalesce(p_texto, '')), '') IS NULL AND p_pdf_caminho IS NULL THEN
    RAISE EXCEPTION 'Escreva o resultado ou anexe o laudo em PDF.';
  END IF;
  IF e.situacao = 'resultado' AND p_motivo_retificacao IS NULL THEN
    RAISE EXCEPTION 'Este exame já tem resultado: para mudar, retifique com motivo.';
  END IF;
  PERFORM private.gravar_resultado_exame(e.id, 'manual', p_texto, p_pdf_caminho, p_pdf_nome, NULL, false, NULL, p_motivo_retificacao, private.meu_perfil_id());
  RETURN public.exame_detalhe(e.id);
END $$;

-- 2a. a enfermagem marca a coleta
CREATE OR REPLACE FUNCTION public.marcar_exame_coletado(p_exame uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame FOR UPDATE;
  IF e.id IS NULL OR NOT private.paciente_em_cuidado_no_plantao(e.paciente_id) OR NOT private.sou_enfermagem(e.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: a coleta é marcada pela enfermagem com o paciente no plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF e.situacao <> 'pedido' THEN RAISE EXCEPTION 'Só exame pedido pode ser marcado como coletado.'; END IF;
  UPDATE public.exames_pedidos SET situacao = 'coletado', coletado_em = now(), coletado_por = private.meu_perfil_id() WHERE id = e.id;
  PERFORM private.registrar_auditoria('exame_coletado', 'exames_pedidos', e.id, e.unidade_id, jsonb_build_object('exame', e.exame));
END $$;

-- 7a. detalhe: versões, analitos e ciência
CREATE OR REPLACE FUNCTION public.exame_detalhe(p_exame uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame;
  IF e.id IS NULL OR NOT private.pode_ver_exame(e) THEN
    RAISE EXCEPTION 'Acesso negado: exame fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'id', e.id, 'exame', e.exame, 'procedimento', e.procedimento, 'situacao', e.situacao, 'urgencia', e.urgencia, 'observacao', e.observacao,
    'pedido_em', e.pedido_em, 'pedido_por', (SELECT nome_completo FROM public.perfis WHERE id = e.pedido_por),
    'coletado_em', e.coletado_em, 'coletado_por', (SELECT nome_completo FROM public.perfis WHERE id = e.coletado_por),
    'em_analise_em', e.em_analise_em, 'critico', e.critico, 'origem', e.resultado_origem,
    'visto_em', e.resultado_visto_em, 'visto_por', (SELECT nome_completo FROM public.perfis WHERE id = e.resultado_visto_por),
    'versoes', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'versao', r.versao, 'origem', r.origem, 'texto', r.texto, 'tem_pdf', r.pdf_caminho IS NOT NULL, 'pdf_nome', r.pdf_nome,
        'critico', r.critico, 'liberado_em', r.liberado_em, 'registrado_por', (SELECT nome_completo FROM public.perfis WHERE id = r.registrado_por),
        'vigente', r.vigente, 'retificado_em', r.retificado_em, 'motivo_retificacao', r.motivo_retificacao,
        'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('analito', i.analito, 'loinc', i.loinc, 'valor', i.valor_texto, 'valor_num', i.valor_num,
                   'unidade', i.unidade, 'referencia', i.referencia, 'marca', i.marca, 'critico', i.critico) ORDER BY i.ordem)
                 FROM public.exame_resultado_itens i WHERE i.resultado_id = r.id), '[]'::jsonb),
        'cientes', coalesce((SELECT jsonb_agg(jsonb_build_object('por', p.nome_completo, 'em', c.em) ORDER BY c.em)
                 FROM public.exame_cientes c JOIN public.perfis p ON p.id = c.perfil_id WHERE c.resultado_id = r.id), '[]'::jsonb))
      ORDER BY r.versao DESC) FROM public.exame_resultados r WHERE r.exame_id = e.id), '[]'::jsonb),
    'pode_registrar', private.pode_registrar_exame(e),
    'pode_coletar', e.situacao = 'pedido' AND private.paciente_em_cuidado_no_plantao(e.paciente_id) AND private.sou_enfermagem(e.unidade_id),
    'pode_dar_ciencia', private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE AND private.paciente_no_meu_plantao(e.paciente_id),
    'ja_ciente', EXISTS (SELECT 1 FROM public.exame_cientes c JOIN public.exame_resultados r ON r.id = c.resultado_id
                          WHERE r.exame_id = e.id AND r.vigente AND c.perfil_id = private.meu_perfil_id()));
END $$;

-- 5a. visto e ciência
CREATE OR REPLACE FUNCTION public.marcar_resultado_visto(p_exame uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame;
  IF e.id IS NULL OR NOT private.pode_ver_exame(e) THEN
    RAISE EXCEPTION 'Acesso negado: exame fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.exames_pedidos SET resultado_visto_em = now(), resultado_visto_por = private.meu_perfil_id()
   WHERE id = e.id AND situacao = 'resultado' AND resultado_visto_em IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.dar_ciencia_resultado(p_exame uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos; v_res uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame;
  IF e.id IS NULL OR NOT (private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE AND private.paciente_no_meu_plantao(e.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado: a ciência é do médico com o paciente no plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT id INTO v_res FROM public.exame_resultados WHERE exame_id = e.id AND vigente;
  IF v_res IS NULL THEN RAISE EXCEPTION 'Este exame ainda não tem resultado.'; END IF;
  INSERT INTO public.exame_cientes (resultado_id, perfil_id) VALUES (v_res, private.meu_perfil_id()) ON CONFLICT DO NOTHING;
  UPDATE public.exames_pedidos SET resultado_visto_em = coalesce(resultado_visto_em, now()),
         resultado_visto_por = coalesce(resultado_visto_por, private.meu_perfil_id()) WHERE id = e.id;
  PERFORM private.registrar_auditoria('exame_ciencia', 'exames_pedidos', e.id, e.unidade_id,
    jsonb_build_object('exame', e.exame, 'critico', e.critico));
  RETURN public.exame_detalhe(e.id);
END $$;

-- 4a. abrir o laudo: liberação curta para o arquivo, como nos anexos da regulação
CREATE OR REPLACE FUNCTION public.exame_laudo_abrir(p_resultado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.exame_resultados; e public.exames_pedidos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.exame_resultados WHERE id = p_resultado;
  SELECT * INTO e FROM public.exames_pedidos WHERE id = r.exame_id;
  IF r.id IS NULL OR r.pdf_caminho IS NULL OR NOT private.pode_ver_exame(e) THEN
    RAISE EXCEPTION 'Acesso negado: laudo fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO private.exame_laudo_liberacao (perfil_id, caminho, ate) VALUES (auth.uid(), r.pdf_caminho, now() + interval '2 minutes')
  ON CONFLICT (perfil_id, caminho) DO UPDATE SET ate = EXCLUDED.ate;
  PERFORM private.registrar_auditoria('exame_laudo_aberto', 'exames_pedidos', e.id, e.unidade_id,
    jsonb_build_object('exame', e.exame, 'versao', r.versao));
  RETURN jsonb_build_object('caminho', r.pdf_caminho, 'nome', r.pdf_nome);
END $$;

REVOKE ALL ON FUNCTION public.registrar_resultado_exame(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marcar_exame_coletado(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.exame_detalhe(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marcar_resultado_visto(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dar_ciencia_resultado(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.exame_laudo_abrir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_resultado_exame(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_exame_coletado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exame_detalhe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_resultado_visto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dar_ciencia_resultado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exame_laudo_abrir(uuid) TO authenticated;

-- 6a. pendente agora é pedido, coletado ou em análise: alta, desfecho, pendências,
-- cancelamento automático e o "já pedido" do pedido
CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;
SELECT pg_temp.trocar('private.impeditivos_alta(uuid)'::regprocedure,
  'e.situacao = ''pedido''', 'e.situacao IN (''pedido'', ''coletado'', ''em_analise'')');
SELECT pg_temp.trocar('private.desfecho_confere_pendencias()'::regprocedure,
  'AND situacao = ''pedido''', 'AND situacao IN (''pedido'', ''coletado'', ''em_analise'')');
SELECT pg_temp.trocar('private.pendencias_atendimento(uuid)'::regprocedure,
  'AND situacao = ''pedido''', 'AND situacao IN (''pedido'', ''coletado'', ''em_analise'')');
SELECT pg_temp.trocar('private.pendencias_do_atendimento(uuid, uuid)'::regprocedure,
  'WHERE situacao = ''pedido'' AND', 'WHERE situacao IN (''pedido'', ''coletado'', ''em_analise'') AND');
SELECT pg_temp.trocar('public.cancelar_documento(uuid, text)'::regprocedure,
  'AND situacao = ''pedido''', 'AND situacao IN (''pedido'', ''coletado'', ''em_analise'')');
SELECT pg_temp.trocar('private.cancelar_exames_pedidos(uuid, uuid, text)'::regprocedure,
  'WHERE situacao = ''pedido''', 'WHERE situacao IN (''pedido'', ''coletado'', ''em_analise'')');
SELECT pg_temp.trocar('public.pedir_exames_atendimento(uuid, text[])'::regprocedure,
  'AND situacao = ''pedido''', 'AND situacao IN (''pedido'', ''coletado'', ''em_analise'')');
SELECT pg_temp.trocar('public.pedir_exames(uuid, jsonb, text, text)'::regprocedure,
  'situacao = ''pedido'' AND procedimento = v_proc', 'situacao IN (''pedido'', ''coletado'', ''em_analise'') AND procedimento = v_proc');
SELECT pg_temp.trocar('public.pedir_exames(uuid, jsonb, text, text)'::regprocedure,
  'situacao = ''pedido'' AND lower(exame) = lower(v_nome)', 'situacao IN (''pedido'', ''coletado'', ''em_analise'') AND lower(exame) = lower(v_nome)');
-- o painel do atendimento leva coleta, crítico, origem e "novo"
SELECT pg_temp.trocar('public.painel_atendimento_ps(uuid)'::regprocedure,
  '''procedimento'', x.procedimento, ''urgencia'', x.urgencia, ''observacao'', x.observacao)',
  '''procedimento'', x.procedimento, ''urgencia'', x.urgencia, ''observacao'', x.observacao,'
  || ' ''coletado_em'', x.coletado_em, ''critico'', x.critico, ''origem'', x.resultado_origem,'
  || ' ''novo'', x.situacao = ''resultado'' AND x.resultado_visto_em IS NULL)');
