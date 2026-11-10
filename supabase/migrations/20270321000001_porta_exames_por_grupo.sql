-- ════════════════════════════════════════════════════════════════════════════
-- Ponto 12 do plantonista, pergunta 3 (decisão do RT em 10/11/2026, bloco
-- rápido, item 3a): a regra do leito vale também no pedido rápido da porta.
-- Laboratório, imagem e ECG vão em pedidos separados (docs/plantonista/
-- PONTO-12-EXAMES.md; o leito segue a regra desde 20270203000004).
--
-- O que muda em public.pedir_exames (mesma assinatura, mesma permissão):
--   - os itens de um pedido são todos do mesmo grupo; com código, o grupo sai
--     do código (private.grupo_do_procedimento); misturar é recusado com a
--     mensagem do que separar;
--   - o texto livre pode trazer o grupo ({"nome": "…", "grupo": "imagem"}), e
--     a linha grava esse grupo; sem ele (tela antiga em cache), fica sem
--     grupo, como antes. Expand: nenhum pedido que funcionava passa a falhar,
--     exceto a mistura de grupos, que é a regra nova.
-- Função nova: private.pedido_de_um_grupo, a checagem da mistura.
--
-- Rollback (testado na homologação): docs/plantonista/PONTO-12-PORTA-ROLLBACK.sql
-- (a definição anterior de pedir_exames e o DROP da função nova).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.pedido_de_um_grupo(p_grupo_pedido text, p_grupo_item text, p_exame text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE r constant jsonb := '{"laboratorio": "laboratório", "imagem": "imagem", "grafico": "ECG / métodos gráficos"}';
BEGIN
  IF p_grupo_pedido IS NOT NULL AND p_grupo_item IS NOT NULL AND p_grupo_pedido <> p_grupo_item THEN
    RAISE EXCEPTION 'Laboratório, imagem e ECG vão em pedidos separados: % é de %, e este pedido é de %.',
      p_exame, r ->> p_grupo_item, r ->> p_grupo_pedido;
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.pedido_de_um_grupo(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pedido_de_um_grupo(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pedir_exames(p_episodio uuid, p_itens jsonb, p_urgencia text DEFAULT 'rotina'::text, p_observacao text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE e public.episodios; it jsonb; v_proc text; v_nome text; v_loinc text; n int := 0;
        v_obs text := nullif(btrim(coalesce(p_observacao, '')), ''); v_catalogo boolean;
        v_grupo_item text; v_grupo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  e := private.atendimento_aberto_na_porta(p_episodio);
  IF coalesce(p_urgencia, '') NOT IN ('rotina', 'urgente') THEN RAISE EXCEPTION 'Urgência: rotina ou urgente.'; END IF;
  IF length(coalesce(v_obs, '')) > 300 THEN RAISE EXCEPTION 'Observação longa demais (até 300 letras).'; END IF;
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Escolha ao menos um exame.'; END IF;
  v_catalogo := private.unidade_tem_catalogo_exames(e.unidade_id);
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_proc := nullif(regexp_replace(coalesce(it ->> 'procedimento', ''), '\D', '', 'g'), '');
    IF v_proc IS NOT NULL THEN
      SELECT c.procedimento, c.nome, c.loinc INTO v_proc, v_nome, v_loinc FROM private.exame_do_catalogo(e.unidade_id, v_proc) c;
      IF v_nome IS NULL THEN RAISE EXCEPTION 'Exame % fora dos grupos de exame do SIGTAP (02.02, 02.04 a 02.07, 02.11).', it ->> 'procedimento'; END IF;
      IF v_catalogo AND NOT EXISTS (SELECT 1 FROM public.exames_unidade WHERE unidade_id = e.unidade_id AND procedimento = v_proc AND vigente_ate IS NULL) THEN
        RAISE EXCEPTION 'O exame % não está na lista da unidade.', v_nome;
      END IF;
      v_grupo_item := private.grupo_do_procedimento(v_proc);
      PERFORM private.pedido_de_um_grupo(v_grupo, v_grupo_item, v_nome);
      v_grupo := coalesce(v_grupo, v_grupo_item);
      -- o mesmo exame ainda pendente neste atendimento não entra de novo
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.exames_pedidos WHERE episodio_id = e.id AND situacao IN ('pedido', 'coletado', 'em_analise', 'realizado') AND procedimento = v_proc);
    ELSE
      v_nome := btrim(coalesce(it ->> 'nome', '')); v_loinc := NULL;
      CONTINUE WHEN length(v_nome) < 2;
      IF length(v_nome) > 200 THEN RAISE EXCEPTION 'Nome de exame longo demais.'; END IF;
      -- texto livre: o grupo vem do pedido; sem ele (tela antiga), fica sem grupo, como antes
      v_grupo_item := nullif(btrim(coalesce(it ->> 'grupo', '')), '');
      IF v_grupo_item IS NOT NULL AND v_grupo_item NOT IN ('laboratorio', 'imagem', 'grafico') THEN
        RAISE EXCEPTION 'Grupo do exame: laboratório, imagem ou ECG.';
      END IF;
      PERFORM private.pedido_de_um_grupo(v_grupo, v_grupo_item, v_nome);
      v_grupo := coalesce(v_grupo, v_grupo_item);
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.exames_pedidos WHERE episodio_id = e.id AND situacao IN ('pedido', 'coletado', 'em_analise', 'realizado') AND lower(exame) = lower(v_nome));
    END IF;
    INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, procedimento, loinc, urgencia, observacao, pedido_por, grupo)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_nome, v_proc, v_loinc, p_urgencia, v_obs, private.meu_perfil_id(), v_grupo_item);
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Esses exames já estão pedidos e aguardam resultado.'; END IF;
  RETURN n;
END $function$;

REVOKE ALL ON FUNCTION public.pedir_exames(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_exames(uuid, jsonb, text, text) TO authenticated;
