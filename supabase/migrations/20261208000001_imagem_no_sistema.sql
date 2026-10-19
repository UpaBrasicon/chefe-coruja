-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 2 (imagem/RIS/PACS), etapa 2.1: imagem e métodos gráficos no
-- sistema (decisões do RT de 19/10/2026, "1a 2a 3a 4a 5a 6a 7a").
--
-- 2a. O catálogo da unidade aceita também imagem e métodos gráficos do SIGTAP:
--     02.04 radiologia, 02.05 ultrassonografia, 02.06 tomografia, 02.07
--     ressonância e 02.11 métodos diagnósticos em especialidades (ECG e outros).
--     O tipo (laboratório ou imagem) sai do código.
-- 3a. O sistema guarda o laudo (texto e arquivo) e o link para ver a imagem no
--     visualizador do PACS; a imagem DICOM fica no PACS.
-- 4a. Imagem: pedido → realizado (feito; a imagem já pode ser vista) →
--     resultado (laudado) ou cancelado. A alta segue impedida até o laudo ou o
--     registro à mão: "realizado" também é pendente.
-- 5a. Sem RIS integrado, a enfermagem marca "realizado" (provisório, até haver
--     papel próprio de imagem).
-- 6a. ECG e outros exames de imagem: o médico pode registrar a própria leitura,
--     com foto (JPG ou PNG) ou PDF do traçado.
-- 7a. Crítico só quando quem laudou marcar (já é a regra do resultado).
-- A porta do laboratório (5C-1) passa a tratar só os exames do grupo 02.02.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.exames_unidade DROP CONSTRAINT exames_unidade_procedimento_check;
ALTER TABLE public.exames_unidade ADD CONSTRAINT exames_unidade_procedimento_check
  CHECK (procedimento ~ '^(0202|0204|0205|0206|0207|0211)[0-9]{6}$');
ALTER TABLE public.exames_unidade
  ADD COLUMN IF NOT EXISTS tipo text GENERATED ALWAYS AS (CASE WHEN left(procedimento, 4) = '0202' THEN 'laboratorio' ELSE 'imagem' END) STORED;

ALTER TABLE public.exames_pedidos DROP CONSTRAINT exames_pedidos_procedimento;
ALTER TABLE public.exames_pedidos ADD CONSTRAINT exames_pedidos_procedimento
  CHECK (procedimento IS NULL OR procedimento ~ '^(0202|0204|0205|0206|0207|0211)[0-9]{6}$');
ALTER TABLE public.exames_pedidos DROP CONSTRAINT exames_pedidos_situacao_check;
ALTER TABLE public.exames_pedidos ADD CONSTRAINT exames_pedidos_situacao_check
  CHECK (situacao IN ('pedido', 'coletado', 'em_analise', 'realizado', 'resultado', 'cancelado'));
ALTER TABLE public.exames_pedidos
  ADD COLUMN IF NOT EXISTS tipo text GENERATED ALWAYS AS (CASE WHEN procedimento IS NULL THEN NULL
                                                               WHEN left(procedimento, 4) = '0202' THEN 'laboratorio' ELSE 'imagem' END) STORED,
  ADD COLUMN IF NOT EXISTS realizado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS realizado_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS imagem_url    text CHECK (imagem_url ~ '^https://');

-- 6a. traçado do ECG (e laudo de imagem) também em foto
UPDATE storage.buckets SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'] WHERE id = 'exames';
CREATE OR REPLACE FUNCTION private.exame_pode_subir_laudo(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exames_pedidos e
     WHERE e.id = private.exame_do_caminho(p_nome) AND e.situacao <> 'cancelado' AND private.pode_registrar_exame(e)
       AND (lower(p_nome) LIKE '%.pdf'
            OR (e.tipo = 'imagem' AND (lower(p_nome) LIKE '%.jpg' OR lower(p_nome) LIKE '%.jpeg' OR lower(p_nome) LIKE '%.png'))))
$$;

-- troca de trechos em funções, com guarda (o trecho tem de existir)
CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

-- a porta do laboratório trata só o grupo 02.02 (antes de mexer na lista de pendentes)
SELECT pg_temp.trocar('public.api_v1_laboratorio(text, text, text, text, jsonb)'::regprocedure,
  'AND x.procedimento IS NOT NULL', 'AND x.procedimento LIKE ''0202%''');
SELECT pg_temp.trocar('public.api_v1_laboratorio(text, text, text, text, jsonb)'::regprocedure,
  'OR e.procedimento IS NULL THEN', 'OR e.procedimento IS NULL OR e.procedimento NOT LIKE ''0202%'' THEN');
SELECT pg_temp.trocar('public.api_laboratorio_pode_anexar(text, uuid)'::regprocedure,
  'AND e.procedimento IS NOT NULL', 'AND e.procedimento LIKE ''0202%''');

-- 2a. catálogo, busca, pedido e pedido impresso aceitam os grupos de imagem
SELECT pg_temp.trocar('private.exame_do_catalogo(uuid, text)'::regprocedure,
  'sp.codigo LIKE ''0202%''', 'sp.codigo ~ ''^(0202|0204|0205|0206|0207|0211)''');
SELECT pg_temp.trocar('public.buscar_exames(uuid, text, boolean)'::regprocedure,
  'sp.codigo LIKE ''0202%''', 'sp.codigo ~ ''^(0202|0204|0205|0206|0207|0211)''');
SELECT pg_temp.trocar('private.pedido_emitido_vira_exames()'::regprocedure,
  'sp.codigo LIKE ''0202%''', 'sp.codigo ~ ''^(0202|0204|0205|0206|0207|0211)''');
SELECT pg_temp.trocar('public.definir_exame_unidade(uuid, text, text, text, boolean, integer)'::regprocedure,
  'codigo LIKE ''0202%''', 'codigo ~ ''^(0202|0204|0205|0206|0207|0211)''');
SELECT pg_temp.trocar('public.definir_exame_unidade(uuid, text, text, text, boolean, integer)'::regprocedure,
  'não está no grupo 02.02 (laboratório clínico) do SIGTAP carregado.',
  'não é de laboratório (02.02), imagem (02.04 a 02.07) ou métodos gráficos (02.11) no SIGTAP carregado.');
SELECT pg_temp.trocar('public.pedir_exames(uuid, jsonb, text, text)'::regprocedure,
  'fora do grupo 02.02 do SIGTAP.', 'fora dos grupos de exame do SIGTAP (02.02, 02.04 a 02.07, 02.11).');
-- a lista da unidade mostra o tipo
SELECT pg_temp.trocar('public.exames_da_unidade(uuid)'::regprocedure,
  '''loinc'', eu.loinc, ''botao'', eu.botao,', '''loinc'', eu.loinc, ''tipo'', eu.tipo, ''botao'', eu.botao,');
SELECT pg_temp.trocar('public.buscar_exames(uuid, text, boolean)'::regprocedure,
  'jsonb_build_object(''procedimento'', x.codigo, ''nome'', x.nome, ''nome_sigtap'', x.nome)',
  'jsonb_build_object(''procedimento'', x.codigo, ''nome'', x.nome, ''nome_sigtap'', x.nome, ''tipo'', CASE WHEN left(x.codigo, 4) = ''0202'' THEN ''laboratorio'' ELSE ''imagem'' END)');
SELECT pg_temp.trocar('public.buscar_exames(uuid, text, boolean)'::regprocedure,
  'jsonb_build_object(''procedimento'', x.procedimento, ''nome'', x.nome_curto, ''nome_sigtap'', x.nome_sigtap)',
  'jsonb_build_object(''procedimento'', x.procedimento, ''nome'', x.nome_curto, ''nome_sigtap'', x.nome_sigtap, ''tipo'', CASE WHEN left(x.procedimento, 4) = ''0202'' THEN ''laboratorio'' ELSE ''imagem'' END)');

-- 4a. "realizado" também é pendente: alta, desfecho, pendências, cancelamento,
-- "já pedido", resultado à mão e gravação do resultado
DO $$
DECLARE f regprocedure; n int := 0;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p
            WHERE p.pronamespace IN ('public'::regnamespace, 'private'::regnamespace)
              AND p.prosrc LIKE '%''pedido'', ''coletado'', ''em_analise''%'
              AND p.proname <> 'api_v1_laboratorio' LOOP
    EXECUTE replace(replace(pg_get_functiondef(f), E'\r', ''), '''pedido'', ''coletado'', ''em_analise''',
                    '''pedido'', ''coletado'', ''em_analise'', ''realizado''');
    n := n + 1;
  END LOOP;
  IF n < 9 THEN RAISE EXCEPTION 'esperava ao menos 9 funções com a lista de pendentes, achei %', n; END IF;
END $$;

-- o painel do atendimento leva tipo, realizado e link da imagem
SELECT pg_temp.trocar('public.painel_atendimento_ps(uuid)'::regprocedure,
  '''novo'', x.situacao = ''resultado'' AND x.resultado_visto_em IS NULL)',
  '''novo'', x.situacao = ''resultado'' AND x.resultado_visto_em IS NULL,'
  || ' ''tipo'', x.tipo, ''realizado_em'', x.realizado_em, ''imagem_url'', x.imagem_url)');

-- 5a. a enfermagem marca o exame de imagem como realizado (provisório)
CREATE OR REPLACE FUNCTION public.marcar_exame_realizado(p_exame uuid, p_imagem_url text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos; v_url text := nullif(btrim(coalesce(p_imagem_url, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame FOR UPDATE;
  IF e.id IS NULL OR NOT private.paciente_em_cuidado_no_plantao(e.paciente_id) OR NOT private.sou_enfermagem(e.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: "realizado" é marcado pela enfermagem com o paciente no plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF e.tipo IS DISTINCT FROM 'imagem' THEN RAISE EXCEPTION 'Só exame de imagem ou método gráfico é marcado como realizado.'; END IF;
  IF e.situacao <> 'pedido' THEN RAISE EXCEPTION 'Só exame pedido pode ser marcado como realizado.'; END IF;
  IF v_url IS NOT NULL AND v_url !~ '^https://' THEN RAISE EXCEPTION 'O link da imagem precisa começar com https://.'; END IF;
  UPDATE public.exames_pedidos SET situacao = 'realizado', realizado_em = now(), realizado_por = private.meu_perfil_id(),
         imagem_url = coalesce(v_url, imagem_url)
   WHERE id = e.id;
  PERFORM private.registrar_auditoria('exame_realizado', 'exames_pedidos', e.id, e.unidade_id,
    jsonb_build_object('exame', e.exame, 'com_link', v_url IS NOT NULL));
END $$;
REVOKE ALL ON FUNCTION public.marcar_exame_realizado(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_exame_realizado(uuid, text) TO authenticated;

-- 3a. link da imagem no visualizador do PACS (médico ou enfermagem com o paciente)
CREATE OR REPLACE FUNCTION public.definir_link_imagem(p_exame uuid, p_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos; v_url text := nullif(btrim(coalesce(p_url, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame FOR UPDATE;
  IF e.id IS NULL OR NOT private.pode_registrar_exame(e) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF e.tipo IS DISTINCT FROM 'imagem' THEN RAISE EXCEPTION 'O link de imagem é só para exame de imagem ou método gráfico.'; END IF;
  IF e.situacao = 'cancelado' THEN RAISE EXCEPTION 'Exame cancelado.'; END IF;
  IF v_url IS NULL OR v_url !~ '^https://' OR length(v_url) > 2000 THEN RAISE EXCEPTION 'O link da imagem precisa começar com https://.'; END IF;
  UPDATE public.exames_pedidos SET imagem_url = v_url WHERE id = e.id;
  PERFORM private.registrar_auditoria('exame_link_imagem', 'exames_pedidos', e.id, e.unidade_id, jsonb_build_object('exame', e.exame));
END $$;
REVOKE ALL ON FUNCTION public.definir_link_imagem(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_link_imagem(uuid, text) TO authenticated;

-- detalhe com tipo, realizado e link (substitui a versão da etapa 1.2)
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
    'id', e.id, 'exame', e.exame, 'procedimento', e.procedimento, 'tipo', e.tipo, 'situacao', e.situacao, 'urgencia', e.urgencia,
    'observacao', e.observacao,
    'pedido_em', e.pedido_em, 'pedido_por', (SELECT nome_completo FROM public.perfis WHERE id = e.pedido_por),
    'coletado_em', e.coletado_em, 'coletado_por', (SELECT nome_completo FROM public.perfis WHERE id = e.coletado_por),
    'em_analise_em', e.em_analise_em,
    'realizado_em', e.realizado_em, 'realizado_por', (SELECT nome_completo FROM public.perfis WHERE id = e.realizado_por),
    'imagem_url', e.imagem_url,
    'critico', e.critico, 'origem', e.resultado_origem,
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
    'pode_coletar', e.situacao = 'pedido' AND e.tipo IS DISTINCT FROM 'imagem'
                    AND private.paciente_em_cuidado_no_plantao(e.paciente_id) AND private.sou_enfermagem(e.unidade_id),
    'pode_realizar', e.situacao = 'pedido' AND e.tipo = 'imagem'
                    AND private.paciente_em_cuidado_no_plantao(e.paciente_id) AND private.sou_enfermagem(e.unidade_id),
    'pode_dar_ciencia', private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE AND private.paciente_no_meu_plantao(e.paciente_id),
    'ja_ciente', EXISTS (SELECT 1 FROM public.exame_cientes c JOIN public.exame_resultados r ON r.id = c.resultado_id
                          WHERE r.exame_id = e.id AND r.vigente AND c.perfil_id = private.meu_perfil_id()));
END $$;

-- a coleta é só de exame de laboratório (ou de texto livre)
SELECT pg_temp.trocar('public.marcar_exame_coletado(uuid)'::regprocedure,
  'IF e.situacao <> ''pedido'' THEN RAISE EXCEPTION ''Só exame pedido pode ser marcado como coletado.''; END IF;',
  'IF e.tipo = ''imagem'' THEN RAISE EXCEPTION ''Exame de imagem não tem coleta: marque como realizado.''; END IF;'
  || E'\n  ' || 'IF e.situacao <> ''pedido'' THEN RAISE EXCEPTION ''Só exame pedido pode ser marcado como coletado.''; END IF;');
