-- Ponto 12 do plantonista (docs/plantonista/PONTO-12-EXAMES.md; o RT aprovou
-- em 28/10/2026 "3 e tela A"): laboratório, imagem e ECG em pedidos separados,
-- e o leito pedindo pelo catálogo da unidade, ligado à internação.
--
-- 1. exames_pedidos.grupo: 'laboratorio' (SIGTAP 02.02), 'imagem' (02.04 a
--    02.07) ou 'grafico' (02.11: ECG e outros métodos gráficos). Com código, o
--    grupo sai do código (gatilho); no texto livre, vem do pedido. A coluna
--    `tipo` (laboratório × imagem, 5C-2) não muda: quem a lê continua igual.
-- 2. public.pedir_exames_internacao: o pedido rápido da porta (pedir_exames)
--    para a internação. Um pedido leva exames de um grupo só.
--
-- Expand: coluna nova, função nova, gatilho novo; nada que existe muda.
-- Rollback (testado na homologação):
--   DROP FUNCTION IF EXISTS public.pedir_exames_internacao(uuid, jsonb, text, text, text);
--   DROP TRIGGER IF EXISTS trg_exame_grupo ON public.exames_pedidos;
--   DROP FUNCTION IF EXISTS private.trg_exame_grupo();
--   ALTER TABLE public.exames_pedidos DROP COLUMN IF EXISTS grupo;
--   DROP FUNCTION IF EXISTS private.grupo_do_procedimento(text);

CREATE OR REPLACE FUNCTION private.grupo_do_procedimento(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p IS NULL THEN NULL
              WHEN left(p, 4) = '0202' THEN 'laboratorio'
              WHEN left(p, 4) = '0211' THEN 'grafico'
              WHEN left(p, 4) IN ('0204', '0205', '0206', '0207') THEN 'imagem' END
$$;
REVOKE ALL ON FUNCTION private.grupo_do_procedimento(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.grupo_do_procedimento(text) TO authenticated;

ALTER TABLE public.exames_pedidos ADD COLUMN IF NOT EXISTS grupo text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exames_pedidos_grupo') THEN
    ALTER TABLE public.exames_pedidos ADD CONSTRAINT exames_pedidos_grupo
      CHECK (grupo IS NULL OR grupo IN ('laboratorio', 'imagem', 'grafico'));
  END IF;
END $$;

-- com código, o grupo é sempre o do código (o texto livre fica com o informado)
CREATE OR REPLACE FUNCTION private.trg_exame_grupo() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.grupo := coalesce(private.grupo_do_procedimento(NEW.procedimento), NEW.grupo);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_exame_grupo ON public.exames_pedidos;
CREATE TRIGGER trg_exame_grupo BEFORE INSERT OR UPDATE OF procedimento, grupo ON public.exames_pedidos
  FOR EACH ROW EXECUTE FUNCTION private.trg_exame_grupo();

-- os pedidos de antes, com código, ganham o grupo
UPDATE public.exames_pedidos SET grupo = private.grupo_do_procedimento(procedimento)
 WHERE grupo IS NULL AND procedimento IS NOT NULL;

-- ── pedido de exames na internação ──────────────────────────────────────────
-- p_itens: [{"procedimento": "0202010473"}] (do catálogo) ou [{"nome": "…"}]
-- (texto livre, no grupo p_grupo). Todos do mesmo grupo: laboratório, imagem e
-- ECG vão em pedidos separados.
CREATE OR REPLACE FUNCTION public.pedir_exames_internacao(p_internacao uuid, p_itens jsonb, p_grupo text,
  p_urgencia text DEFAULT 'rotina', p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  it jsonb;
  v_proc text; v_nome text; v_loinc text; v_grupo_item text;
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_catalogo boolean;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_rotulo constant jsonb := '{"laboratorio": "laboratório", "imagem": "imagem", "grafico": "ECG / métodos gráficos"}';
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
  -- quem pede exame é o médico que evolui a internação (ponto 9, regra B)
  IF NOT private.evoluo_internacao(i) OR private.tenho_papel(i.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: o pedido de exames é do médico de plantão com o paciente.';
  END IF;
  IF coalesce(p_grupo, '') NOT IN ('laboratorio', 'imagem', 'grafico') THEN RAISE EXCEPTION 'Grupo do pedido: laboratório, imagem ou ECG.'; END IF;
  IF coalesce(p_urgencia, '') NOT IN ('rotina', 'urgente') THEN RAISE EXCEPTION 'Urgência: rotina ou urgente.'; END IF;
  IF length(coalesce(v_obs, '')) > 300 THEN RAISE EXCEPTION 'Observação longa demais (até 300 letras).'; END IF;
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Escolha ao menos um exame.'; END IF;
  v_catalogo := private.unidade_tem_catalogo_exames(i.unidade_id);

  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_proc := nullif(regexp_replace(coalesce(it ->> 'procedimento', ''), '\D', '', 'g'), '');
    IF v_proc IS NOT NULL THEN
      SELECT c.procedimento, c.nome, c.loinc INTO v_proc, v_nome, v_loinc FROM private.exame_do_catalogo(i.unidade_id, v_proc) c;
      IF v_nome IS NULL THEN RAISE EXCEPTION 'Exame % fora dos grupos de exame do SIGTAP (02.02, 02.04 a 02.07, 02.11).', it ->> 'procedimento'; END IF;
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
    -- o mesmo exame ainda pendente nesta internação não entra de novo
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.exames_pedidos ep
                           WHERE ep.internacao_id = i.id AND ep.situacao IN ('pedido', 'coletado', 'em_analise', 'realizado')
                             AND (CASE WHEN v_proc IS NOT NULL THEN ep.procedimento = v_proc ELSE lower(ep.exame) = lower(v_nome) END));
    INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, internacao_id, exame, procedimento, loinc, urgencia, observacao, pedido_por, grupo)
    VALUES (i.unidade_id, i.paciente_id, i.episodio_id, i.id, v_nome, v_proc, v_loinc, p_urgencia, v_obs, private.meu_perfil_id(), p_grupo)
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;
  IF cardinality(v_ids) = 0 THEN RAISE EXCEPTION 'Esses exames já estão pedidos e aguardam resultado.'; END IF;
  RETURN jsonb_build_object('pedidos', cardinality(v_ids), 'grupo', p_grupo, 'ids', to_jsonb(v_ids));
END $$;
REVOKE ALL ON FUNCTION public.pedir_exames_internacao(uuid, jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_exames_internacao(uuid, jsonb, text, text, text) TO authenticated;
