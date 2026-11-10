-- Rollback da migration 20270321000001_porta_exames_por_grupo.sql: volta a
-- public.pedir_exames à definição anterior (lida da homologação em 10/11/2026).
-- Rodar como postgres, junto com:
--   DROP FUNCTION IF EXISTS private.pedido_de_um_grupo(text, text, text);
CREATE OR REPLACE FUNCTION public.pedir_exames(p_episodio uuid, p_itens jsonb, p_urgencia text DEFAULT 'rotina'::text, p_observacao text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE e public.episodios; it jsonb; v_proc text; v_nome text; v_loinc text; n int := 0;
        v_obs text := nullif(btrim(coalesce(p_observacao, '')), ''); v_catalogo boolean;
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
      -- o mesmo exame ainda pendente neste atendimento não entra de novo
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.exames_pedidos WHERE episodio_id = e.id AND situacao IN ('pedido', 'coletado', 'em_analise', 'realizado') AND procedimento = v_proc);
    ELSE
      v_nome := btrim(coalesce(it ->> 'nome', '')); v_loinc := NULL;
      CONTINUE WHEN length(v_nome) < 2;
      IF length(v_nome) > 200 THEN RAISE EXCEPTION 'Nome de exame longo demais.'; END IF;
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.exames_pedidos WHERE episodio_id = e.id AND situacao IN ('pedido', 'coletado', 'em_analise', 'realizado') AND lower(exame) = lower(v_nome));
    END IF;
    INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, procedimento, loinc, urgencia, observacao, pedido_por)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_nome, v_proc, v_loinc, p_urgencia, v_obs, private.meu_perfil_id());
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Esses exames já estão pedidos e aguardam resultado.'; END IF;
  RETURN n;
END $function$;
