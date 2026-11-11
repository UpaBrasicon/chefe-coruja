-- Laudo por grupo (pedido do RT de 11/11/2026, P2; decisões G1 a G5 = A em
-- docs/porta/LAUDO-POR-GRUPO-DIAGNOSTICO.md): um único arquivo anexado de uma
-- vez a vários exames do mesmo grupo (laboratório, imagem ou ECG/gráficos) do
-- mesmo paciente.
--
-- 1. private.laudo_do_mesmo_grupo: o arquivo está no caminho de outro exame do
--    mesmo paciente, da mesma unidade e do mesmo grupo, e esse exame já tem o
--    resultado vigente com esse arquivo.
-- 2. private.gravar_resultado_exame passa a aceitar esse arquivo (troca de um
--    trecho só; o resto da função não muda).
-- 3. public.exames_aguardando_laudo: os exames do paciente (na porta, só os do
--    atendimento) que podem receber o laudo do grupo: aguardando resultado, com
--    grupo e que quem pede pode registrar.
-- 4. public.registrar_laudo_grupo: grava o mesmo arquivo em cada exame da lista,
--    primeiro no exame dono do caminho, com uma auditoria só.
--
-- Expand: funções novas e uma condição a mais numa verificação; o registro por
-- exame (registrar_resultado_exame) e a leitura (exame_laudo_abrir) não mudam.
-- Idempotente.
-- Rollback (testado na homologação):
--   a troca inversa do trecho em private.gravar_resultado_exame (bloco DO abaixo,
--   com v_velho e v_novo trocados);
--   DROP FUNCTION IF EXISTS public.registrar_laudo_grupo(uuid[], text, text);
--   DROP FUNCTION IF EXISTS public.exames_aguardando_laudo(uuid, uuid);
--   DROP FUNCTION IF EXISTS private.laudo_do_mesmo_grupo(text, uuid);

CREATE OR REPLACE FUNCTION private.laudo_do_mesmo_grupo(p_caminho text, p_exame uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.exames_pedidos e
      JOIN public.exames_pedidos d ON d.id = private.exame_do_caminho(p_caminho)
      JOIN public.exame_resultados r ON r.exame_id = d.id AND r.vigente AND r.pdf_caminho = p_caminho
     WHERE e.id = p_exame AND d.id <> e.id
       AND d.paciente_id = e.paciente_id AND d.unidade_id = e.unidade_id
       AND d.grupo IS NOT NULL AND d.grupo = e.grupo)
$$;
REVOKE ALL ON FUNCTION private.laudo_do_mesmo_grupo(text, uuid) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_def   text := pg_get_functiondef('private.gravar_resultado_exame(uuid,text,text,text,text,jsonb,boolean,text,text,uuid)'::regprocedure);
  v_velho text := 'IF p_pdf_caminho IS NOT NULL AND private.exame_do_caminho(p_pdf_caminho) IS DISTINCT FROM e.id THEN';
  v_novo  text := 'IF p_pdf_caminho IS NOT NULL AND private.exame_do_caminho(p_pdf_caminho) IS DISTINCT FROM e.id'
                  || ' AND NOT private.laudo_do_mesmo_grupo(p_pdf_caminho, e.id) THEN';
BEGIN
  IF position(v_novo IN v_def) > 0 THEN
    RETURN;
  END IF;
  IF position(v_velho IN v_def) = 0 THEN
    RAISE EXCEPTION 'gravar_resultado_exame: trecho do caminho do laudo não encontrado';
  END IF;
  EXECUTE replace(v_def, v_velho, v_novo);
END
$$;

CREATE OR REPLACE FUNCTION public.exames_aguardando_laudo(p_paciente uuid, p_episodio uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_paciente IS NULL THEN
    RAISE EXCEPTION 'Informe o paciente.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', e.id, 'exame', e.exame, 'grupo', e.grupo, 'situacao', e.situacao,
                                        'pedido_em', e.pedido_em, 'urgencia', e.urgencia, 'tipo', e.tipo)
                     ORDER BY e.grupo, e.pedido_em, e.exame)
      FROM public.exames_pedidos e
     WHERE e.paciente_id = p_paciente AND (p_episodio IS NULL OR e.episodio_id = p_episodio)
       AND e.grupo IS NOT NULL
       AND e.situacao IN ('pedido', 'coletado', 'em_analise', 'realizado')
       AND NOT EXISTS (SELECT 1 FROM public.exame_resultados r WHERE r.exame_id = e.id AND r.vigente)
       AND private.pode_registrar_exame(e)), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.registrar_laudo_grupo(p_exames uuid[], p_pdf_caminho text, p_pdf_nome text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ids  uuid[];
  v_dono uuid := private.exame_do_caminho(p_pdf_caminho);
  d      public.exames_pedidos;
  e      public.exames_pedidos;
  n      int := 0;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(p_exames) x WHERE x IS NOT NULL;
  IF coalesce(cardinality(v_ids), 0) < 2 THEN
    RAISE EXCEPTION 'Escolha pelo menos dois exames.';
  END IF;
  IF cardinality(v_ids) > 50 THEN
    RAISE EXCEPTION 'No máximo 50 exames por laudo.';
  END IF;
  IF p_pdf_caminho IS NULL OR v_dono IS NULL OR NOT (v_dono = ANY (v_ids)) THEN
    RAISE EXCEPTION 'O laudo tem de ser enviado num dos exames escolhidos.';
  END IF;
  SELECT * INTO d FROM public.exames_pedidos WHERE id = v_dono;
  FOR e IN SELECT * FROM public.exames_pedidos WHERE id = ANY (v_ids) ORDER BY (id = v_dono) DESC, pedido_em, id FOR UPDATE LOOP
    IF NOT private.pode_registrar_exame(e) THEN
      RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF e.paciente_id <> d.paciente_id OR e.unidade_id <> d.unidade_id THEN
      RAISE EXCEPTION 'Os exames têm de ser do mesmo paciente.';
    END IF;
    IF e.grupo IS NULL OR e.grupo IS DISTINCT FROM d.grupo THEN
      RAISE EXCEPTION 'Os exames têm de ser do mesmo grupo (laboratório, imagem ou ECG).';
    END IF;
    IF e.situacao = 'cancelado' THEN
      RAISE EXCEPTION 'O exame % está cancelado.', e.exame;
    END IF;
    IF EXISTS (SELECT 1 FROM public.exame_resultados r WHERE r.exame_id = e.id AND r.vigente) THEN
      RAISE EXCEPTION 'O exame % já tem resultado: para mudar, retifique só ele.', e.exame;
    END IF;
    PERFORM private.gravar_resultado_exame(e.id, 'manual', NULL, p_pdf_caminho, p_pdf_nome, NULL, false, NULL, NULL, private.meu_perfil_id());
    n := n + 1;
  END LOOP;
  IF n <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Exame não encontrado.';
  END IF;
  PERFORM private.registrar_auditoria('exame_laudo_grupo', 'exames_pedidos', d.id, d.unidade_id,
    jsonb_build_object('exames', to_jsonb(v_ids), 'grupo', d.grupo, 'pdf_nome', left(p_pdf_nome, 200)));
  RETURN jsonb_build_object('registrados', n, 'grupo', d.grupo);
END $$;

REVOKE ALL ON FUNCTION public.exames_aguardando_laudo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_laudo_grupo(uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exames_aguardando_laudo(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_laudo_grupo(uuid[], text, text) TO authenticated;
