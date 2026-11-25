-- ════════════════════════════════════════════════════════════════════════════
-- Aba Exames do leito no modelo do RT (25/11/2026): anexar e planilha.
--
-- 1. Laudo em PDF ou imagem (decisão do RT de 25/11/2026, que muda a 4a de
--    19/10/2026): PDF, JPG, PNG ou WEBP, até 10 MB, em qualquer exame. O
--    bucket privado `exames` passa a aceitar image/webp (PDF, JPG e PNG já
--    estavam), e private.exame_pode_subir_laudo aceita imagem em todo exame
--    (antes, só nos de imagem). A leitura continua por exame_laudo_abrir.
-- 2. "Alterado" marcado pelo médico (decisão do RT de 25/11/2026): na versão
--    vigente do resultado, com autor (login) e hora; desmarcar também fica
--    registrado na auditoria. NÃO é o crítico: o crítico continua só do
--    laboratório (19/10/2026), e o médico não o marca.
--    public.marcar_resultado_alterado(exame, alterado).
-- 3. Lançamento manual estruturado (EXM10): public.registrar_resultado_estruturado
--    grava o resultado à mão com os analitos (nome e valor, como estão no papel)
--    e a data e hora da coleta. Por que a extensão: o banco já guardava analitos
--    em resultado manual (private.gravar_resultado_exame recebe os itens, e o
--    exame feito fora da UBS usa isso), mas nenhuma função pública deixava o
--    médico do leito gravar itens; e o resultado não tinha onde guardar a hora
--    da coleta informada. O item manual vai SEM unidade, faixa, marca e crítico
--    (o app não calcula nem traz faixa; marca e crítico são do laboratório).
--    Coluna nova e nula public.exame_resultados.coleta_em.
-- 4. public.resultados_da_internacao(internação): as versões vigentes dos
--    exames da internação que quem chama pode ver, com o arquivo, a marca de
--    alterado e os analitos. Alimenta "Laudos e arquivos anexados" e a planilha
--    (analito × data da coleta) sem uma chamada por exame.
-- 5. public.exame_detalhe passa a levar alterado_em, alterado_por e coleta_em
--    em cada versão e `pode_marcar_alterado` (troca de trechos, com guarda).
--
-- Expand: três colunas nulas, uma lista de tipos maior, uma condição mais
-- larga e funções novas. Idempotente. Sem DROP/RENAME.
-- Rollback: no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. laudo em PDF ou imagem ───────────────────────────────────────────────
UPDATE storage.buckets SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] WHERE id = 'exames';

CREATE OR REPLACE FUNCTION private.exame_pode_subir_laudo(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT lower(p_nome) ~ '\.(pdf|jpe?g|png|webp)$' AND EXISTS (
    SELECT 1 FROM public.exames_pedidos e
     WHERE e.id = private.exame_do_caminho(p_nome) AND e.situacao <> 'cancelado' AND private.pode_registrar_exame(e))
$$;

-- ── 2 e 3. colunas novas na versão do resultado ─────────────────────────────
ALTER TABLE public.exame_resultados
  ADD COLUMN IF NOT EXISTS alterado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS alterado_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS coleta_em    timestamptz;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exame_resultados_alterado_autor') THEN
    ALTER TABLE public.exame_resultados ADD CONSTRAINT exame_resultados_alterado_autor
      CHECK ((alterado_em IS NULL) = (alterado_por IS NULL));
  END IF;
END $$;
COMMENT ON COLUMN public.exame_resultados.alterado_em IS 'Médico marcou o resultado como alterado (não é o crítico do laboratório).';
COMMENT ON COLUMN public.exame_resultados.coleta_em IS 'Data e hora da coleta informada no lançamento manual estruturado.';

-- ── 2. alterado, pelo médico ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_resultado_alterado(p_exame uuid, p_alterado boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos; r public.exame_resultados;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame;
  IF e.id IS NULL OR NOT (private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE AND private.paciente_no_meu_plantao(e.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado: quem marca o resultado como alterado é o médico com o paciente no plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO r FROM public.exame_resultados WHERE exame_id = e.id AND vigente FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Este exame ainda não tem resultado.'; END IF;
  IF coalesce(p_alterado, false) THEN
    UPDATE public.exame_resultados SET alterado_em = now(), alterado_por = private.meu_perfil_id() WHERE id = r.id AND alterado_em IS NULL;
  ELSE
    UPDATE public.exame_resultados SET alterado_em = NULL, alterado_por = NULL WHERE id = r.id AND alterado_em IS NOT NULL;
  END IF;
  IF FOUND THEN
    PERFORM private.registrar_auditoria(CASE WHEN coalesce(p_alterado, false) THEN 'exame_resultado_alterado' ELSE 'exame_resultado_alterado_desfeito' END,
      'exames_pedidos', e.id, e.unidade_id, jsonb_build_object('exame', e.exame, 'versao', r.versao));
  END IF;
  RETURN public.exame_detalhe(e.id);
END $$;
REVOKE ALL ON FUNCTION public.marcar_resultado_alterado(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_resultado_alterado(uuid, boolean) TO authenticated;

-- ── 3. lançamento manual estruturado ────────────────────────────────────────
-- p_itens: [{"analito": "Hemoglobina", "valor": "10,4"}]; outros campos são ignorados
CREATE OR REPLACE FUNCTION public.registrar_resultado_estruturado(p_exame uuid, p_coleta_em timestamptz, p_itens jsonb, p_texto text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos; it jsonb; v_itens jsonb := '[]'::jsonb; v_analito text; v_valor text; v_res uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame;
  IF e.id IS NULL OR NOT private.pode_registrar_exame(e) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF e.situacao = 'cancelado' THEN RAISE EXCEPTION 'Exame cancelado.'; END IF;
  IF e.situacao = 'resultado' THEN RAISE EXCEPTION 'Este exame já tem resultado: para mudar, retifique com motivo.'; END IF;
  IF p_coleta_em IS NULL THEN RAISE EXCEPTION 'Informe a data e a hora da coleta.'; END IF;
  IF p_coleta_em > now() + interval '5 minutes' THEN RAISE EXCEPTION 'A coleta não pode ser no futuro.'; END IF;
  IF p_coleta_em < e.pedido_em - interval '1 day' THEN RAISE EXCEPTION 'A coleta não pode ser de antes do pedido.'; END IF;
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Informe os valores.'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_analito := btrim(coalesce(it ->> 'analito', ''));
    v_valor := btrim(coalesce(it ->> 'valor', ''));
    CONTINUE WHEN v_analito = '' AND v_valor = '';
    IF length(v_analito) < 1 OR length(v_analito) > 80 THEN RAISE EXCEPTION 'Nome do parâmetro entre 1 e 80 letras.'; END IF;
    IF v_valor = '' THEN RAISE EXCEPTION 'Informe o valor de %.', v_analito; END IF;
    IF length(v_valor) > 60 THEN RAISE EXCEPTION 'Valor de % longo demais (até 60 letras).', v_analito; END IF;
    -- só nome e valor: unidade, faixa, marca e crítico não entram à mão
    v_itens := v_itens || jsonb_build_object('analito', v_analito, 'valor', v_valor);
  END LOOP;
  IF jsonb_array_length(v_itens) = 0 THEN RAISE EXCEPTION 'Informe ao menos um valor.'; END IF;
  IF jsonb_array_length(v_itens) > 60 THEN RAISE EXCEPTION 'No máximo 60 valores por lançamento.'; END IF;
  v_res := private.gravar_resultado_exame(e.id, 'manual', nullif(btrim(coalesce(p_texto, '')), ''), NULL, NULL, v_itens, false, NULL, NULL,
                                          private.meu_perfil_id());
  UPDATE public.exame_resultados SET coleta_em = p_coleta_em WHERE id = v_res;
  PERFORM private.registrar_auditoria('exame_resultado_estruturado', 'exames_pedidos', e.id, e.unidade_id,
    jsonb_build_object('exame', e.exame, 'valores', jsonb_array_length(v_itens), 'coleta_em', p_coleta_em));
  RETURN public.exame_detalhe(e.id);
END $$;
REVOKE ALL ON FUNCTION public.registrar_resultado_estruturado(uuid, timestamptz, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_resultado_estruturado(uuid, timestamptz, jsonb, text) TO authenticated;

-- ── 4. resultados vigentes da internação ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resultados_da_internacao(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_internacao IS NULL THEN RAISE EXCEPTION 'Informe a internação.'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'exame_id', e.id, 'exame', e.exame, 'grupo', e.grupo, 'tipo', e.tipo, 'resultado_id', r.id, 'versao', r.versao,
             'origem', r.origem, 'tem_arquivo', r.pdf_caminho IS NOT NULL, 'arquivo_nome', r.pdf_nome, 'liberado_em', r.liberado_em,
             'coleta_em', coalesce(r.coleta_em, e.coletado_em), 'critico', r.critico,
             'registrado_por', (SELECT nome_completo FROM public.perfis WHERE id = r.registrado_por),
             'alterado_em', r.alterado_em, 'alterado_por', (SELECT nome_completo FROM public.perfis WHERE id = r.alterado_por),
             'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('analito', i.analito, 'valor', i.valor_texto, 'valor_num', i.valor_num,
                         'unidade', i.unidade, 'referencia', i.referencia, 'marca', i.marca, 'critico', i.critico) ORDER BY i.ordem)
                       FROM public.exame_resultado_itens i WHERE i.resultado_id = r.id), '[]'::jsonb))
           ORDER BY coalesce(r.coleta_em, e.coletado_em, r.liberado_em) DESC, e.exame)
      FROM public.exames_pedidos e
      JOIN public.exame_resultados r ON r.exame_id = e.id AND r.vigente
     WHERE e.internacao_id = p_internacao AND private.pode_ver_exame(e)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.resultados_da_internacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resultados_da_internacao(uuid) TO authenticated;

-- ── 5. o detalhe leva alterado, coleta e quem pode marcar ───────────────────
CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_novo IN def) > 0 THEN RETURN; END IF;  -- já trocado (idempotente)
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;
SELECT pg_temp.trocar('public.exame_detalhe(uuid)'::regprocedure,
  '''vigente'', r.vigente, ''retificado_em'', r.retificado_em, ''motivo_retificacao'', r.motivo_retificacao,',
  '''vigente'', r.vigente, ''retificado_em'', r.retificado_em, ''motivo_retificacao'', r.motivo_retificacao,'
  || ' ''alterado_em'', r.alterado_em, ''alterado_por'', (SELECT nome_completo FROM public.perfis WHERE id = r.alterado_por), ''coleta_em'', r.coleta_em,');
SELECT pg_temp.trocar('public.exame_detalhe(uuid)'::regprocedure,
  '''pode_dar_ciencia'', private.tenho_papel(e.unidade_id, ''plantonista'') IS TRUE AND private.paciente_no_meu_plantao(e.paciente_id),',
  '''pode_marcar_alterado'', private.tenho_papel(e.unidade_id, ''plantonista'') IS TRUE AND private.paciente_no_meu_plantao(e.paciente_id),'
  || E'\n    ''pode_dar_ciencia'', private.tenho_papel(e.unidade_id, ''plantonista'') IS TRUE AND private.paciente_no_meu_plantao(e.paciente_id),');

-- ── Rollback (na ordem) ─────────────────────────────────────────────────────
-- 1. public.exame_detalhe: as trocas inversas dos dois trechos acima (tirar
--    alterado_em, alterado_por e coleta_em da versão e a linha pode_marcar_alterado).
-- 2. DROP FUNCTION IF EXISTS public.resultados_da_internacao(uuid);
--    DROP FUNCTION IF EXISTS public.registrar_resultado_estruturado(uuid, timestamptz, jsonb, text);
--    DROP FUNCTION IF EXISTS public.marcar_resultado_alterado(uuid, boolean);
-- 3. private.exame_pode_subir_laudo como em 20261208000001_imagem_no_sistema.sql
--    (PDF em todo exame; JPG e PNG só nos de imagem).
-- 4. UPDATE storage.buckets SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'] WHERE id = 'exames';
--    (laudo em WEBP já enviado continua no bucket e abre pela liberação curta)
-- 5. Contract, só quando nenhuma versão do app ler as colunas:
--    ALTER TABLE public.exame_resultados DROP CONSTRAINT IF EXISTS exame_resultados_alterado_autor,
--      DROP COLUMN IF EXISTS coleta_em, DROP COLUMN IF EXISTS alterado_por, DROP COLUMN IF EXISTS alterado_em;
