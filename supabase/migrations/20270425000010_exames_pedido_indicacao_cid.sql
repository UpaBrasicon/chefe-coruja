-- ════════════════════════════════════════════════════════════════════════════
-- Aba Exames do leito no modelo do RT (25/11/2026), EXM3 e EXM4.
--
-- EXM3. Indicação clínica e CID-10 no pedido, opcionais: duas colunas novas e
--       nulas em public.exames_pedidos (expand). Saem na folha do pedido.
-- EXM4. Observação por exame: a coluna public.exames_pedidos.observacao já é
--       por linha (uma linha por exame); só o pedido do leito passa a aceitar
--       a observação de cada item. A observação geral (p_observacao) continua
--       valendo para o item que não traz a sua.
--
-- public.pedir_exames_internacao mantém a assinatura de 5 argumentos (uma
-- assinatura nova com argumentos a mais criaria duas funções com o mesmo nome
-- e o PostgREST não saberia escolher). Os campos novos vêm em cada item de
-- p_itens, todos opcionais:
--   {"procedimento": "0202020380", "obs": "jejum", "indicacao": "…", "cid": "A41.9"}
-- Quem chama do jeito antigo ({"procedimento"} ou {"nome"}) segue igual. A
-- porta (pedir_exames) e a UBS não mudam.
--
-- O corpo é o de 20270203000004_exames_por_grupo.sql com as trocas do
-- citopatológico de 20270415000012_ubs_citopatologico.sql, mais as três
-- leituras novas (obs, indicacao, cid) e as conferências de tamanho.
--
-- Expand: duas colunas nulas, duas restrições só sobre elas e o CREATE OR
-- REPLACE de uma função com a mesma assinatura. Idempotente. Sem DROP/RENAME.
-- Rollback: no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.exames_pedidos
  ADD COLUMN IF NOT EXISTS indicacao text,
  ADD COLUMN IF NOT EXISTS cid       text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exames_pedidos_indicacao_tamanho') THEN
    ALTER TABLE public.exames_pedidos ADD CONSTRAINT exames_pedidos_indicacao_tamanho
      CHECK (indicacao IS NULL OR length(indicacao) BETWEEN 1 AND 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exames_pedidos_cid_formato') THEN
    ALTER TABLE public.exames_pedidos ADD CONSTRAINT exames_pedidos_cid_formato
      CHECK (cid IS NULL OR cid ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$');
  END IF;
END $$;

COMMENT ON COLUMN public.exames_pedidos.indicacao IS 'Indicação clínica do pedido (opcional, EXM3; quem pediu escreveu).';
COMMENT ON COLUMN public.exames_pedidos.cid IS 'CID-10 do pedido (opcional, EXM3), no formato A41 ou A41.9.';

-- CID como digitado ("a419", "A41.9 — Sepse") → "A41.9"; vazio → NULL; fora do formato → erro
CREATE OR REPLACE FUNCTION private.cid_do_pedido(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v text := upper(split_part(btrim(coalesce(p, '')), ' ', 1));
BEGIN
  IF v = '' THEN RETURN NULL; END IF;
  v := replace(v, '.', '');
  IF v !~ '^[A-Z][0-9]{2}[0-9A-Z]{0,2}$' THEN RAISE EXCEPTION 'CID-10 no formato A41 ou A41.9.'; END IF;
  RETURN CASE WHEN length(v) > 3 THEN left(v, 3) || '.' || substr(v, 4) ELSE v END;
END $$;
REVOKE ALL ON FUNCTION private.cid_do_pedido(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pedir_exames_internacao(p_internacao uuid, p_itens jsonb, p_grupo text,
  p_urgencia text DEFAULT 'rotina', p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  it jsonb;
  v_proc text; v_nome text; v_loinc text; v_grupo_item text;
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_obs_item text; v_indicacao text; v_cid text;
  v_catalogo boolean;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_rotulo constant jsonb := '{"laboratorio": "laboratório", "imagem": "imagem", "grafico": "ECG / métodos gráficos", "citopatologia": "citopatológico"}';
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
  -- quem pede exame é o médico que evolui a internação (ponto 9, regra B)
  IF NOT private.evoluo_internacao(i) OR private.tenho_papel(i.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: o pedido de exames é do médico de plantão com o paciente.';
  END IF;
  IF coalesce(p_grupo, '') NOT IN ('laboratorio', 'imagem', 'grafico', 'citopatologia') THEN RAISE EXCEPTION 'Grupo do pedido: laboratório, imagem, ECG ou citopatológico.'; END IF;
  IF coalesce(p_urgencia, '') NOT IN ('rotina', 'urgente') THEN RAISE EXCEPTION 'Urgência: rotina ou urgente.'; END IF;
  IF length(coalesce(v_obs, '')) > 300 THEN RAISE EXCEPTION 'Observação longa demais (até 300 letras).'; END IF;
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Escolha ao menos um exame.'; END IF;
  v_catalogo := private.unidade_tem_catalogo_exames(i.unidade_id);

  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_proc := nullif(regexp_replace(coalesce(it ->> 'procedimento', ''), '\D', '', 'g'), '');
    IF v_proc IS NOT NULL THEN
      SELECT c.procedimento, c.nome, c.loinc INTO v_proc, v_nome, v_loinc FROM private.exame_do_catalogo(i.unidade_id, v_proc) c;
      IF v_nome IS NULL THEN RAISE EXCEPTION 'Exame % fora dos grupos de exame do SIGTAP (02.02, 02.03.01, 02.04 a 02.07, 02.11).', it ->> 'procedimento'; END IF;
      IF v_catalogo AND NOT EXISTS (SELECT 1 FROM public.exames_unidade WHERE unidade_id = i.unidade_id AND procedimento = v_proc AND vigente_ate IS NULL) THEN
        RAISE EXCEPTION 'O exame % não está na lista da unidade.', v_nome;
      END IF;
      v_grupo_item := private.grupo_do_procedimento(v_proc);
    ELSE
      v_nome := btrim(coalesce(it ->> 'nome', '')); v_loinc := NULL; v_grupo_item := p_grupo;
      CONTINUE WHEN length(v_nome) < 2;
      IF length(v_nome) > 200 THEN RAISE EXCEPTION 'Nome de exame longo demais.'; END IF;
    END IF;
    IF v_grupo_item IS DISTINCT FROM p_grupo THEN
      RAISE EXCEPTION 'Laboratório, imagem e ECG vão em pedidos separados: % é de %, e este pedido é de %.',
        v_nome, v_rotulo ->> v_grupo_item, v_rotulo ->> p_grupo;
    END IF;
    -- EXM4: observação do item; sem ela, a geral. EXM3: indicação e CID, opcionais
    v_obs_item := coalesce(nullif(btrim(coalesce(it ->> 'obs', '')), ''), v_obs);
    IF length(coalesce(v_obs_item, '')) > 300 THEN RAISE EXCEPTION 'Observação de % longa demais (até 300 letras).', v_nome; END IF;
    v_indicacao := nullif(btrim(coalesce(it ->> 'indicacao', '')), '');
    IF length(coalesce(v_indicacao, '')) > 500 THEN RAISE EXCEPTION 'Indicação clínica longa demais (até 500 letras).'; END IF;
    v_cid := private.cid_do_pedido(it ->> 'cid');
    -- o mesmo exame ainda pendente nesta internação não entra de novo
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.exames_pedidos ep
                           WHERE ep.internacao_id = i.id AND ep.situacao IN ('pedido', 'coletado', 'em_analise', 'realizado')
                             AND (CASE WHEN v_proc IS NOT NULL THEN ep.procedimento = v_proc ELSE lower(ep.exame) = lower(v_nome) END));
    INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, internacao_id, exame, procedimento, loinc, urgencia, observacao,
                                       pedido_por, grupo, indicacao, cid)
    VALUES (i.unidade_id, i.paciente_id, i.episodio_id, i.id, v_nome, v_proc, v_loinc, p_urgencia, v_obs_item,
            private.meu_perfil_id(), p_grupo, v_indicacao, v_cid)
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;
  IF cardinality(v_ids) = 0 THEN RAISE EXCEPTION 'Esses exames já estão pedidos e aguardam resultado.'; END IF;
  RETURN jsonb_build_object('pedidos', cardinality(v_ids), 'grupo', p_grupo, 'ids', to_jsonb(v_ids));
END $$;
REVOKE ALL ON FUNCTION public.pedir_exames_internacao(uuid, jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_exames_internacao(uuid, jsonb, text, text, text) TO authenticated;

-- ── Rollback (na ordem) ─────────────────────────────────────────────────────
-- 1. Recriar public.pedir_exames_internacao sem as leituras novas: o mesmo
--    corpo acima, tirando as linhas de v_obs_item, v_indicacao e v_cid, com
--    `observacao` = v_obs e o INSERT sem as colunas indicacao e cid (é a
--    versão de 20270203000004 com as trocas de 20270415000012).
-- 2. DROP FUNCTION IF EXISTS private.cid_do_pedido(text);
-- 3. ALTER TABLE public.exames_pedidos DROP CONSTRAINT IF EXISTS exames_pedidos_cid_formato,
--      DROP CONSTRAINT IF EXISTS exames_pedidos_indicacao_tamanho;
-- 4. ALTER TABLE public.exames_pedidos DROP COLUMN IF EXISTS cid, DROP COLUMN IF EXISTS indicacao;
--    (só depois que nenhuma versão do app ler as colunas: é o passo "contract")
