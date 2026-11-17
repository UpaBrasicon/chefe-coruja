-- Percurso da UBS, U7, PR 5 (plano docs/ubs/U6-U7-PLANO.md; RT, 17/11/2026):
-- procedimentos da UBS, com resultado nos testes rápidos.
--
-- Achados A3 e A4 do percurso: a consulta da UBS não tinha onde registrar
-- teste rápido, implante, DIU, preventivo ou curativo, e o procedimento não
-- tinha resultado. O teste rápido do pré-natal (nota C3) ficava sempre vazio, e
-- um teste reagente não sugeria notificação.
--
-- 1. procedimentos_realizados.resultado (expand): reagente, não reagente ou
--    inválido, só nos testes rápidos.
-- 2. private.ubs_procedimentos(): os procedimentos da UBS (SIGTAP conferido na
--    tabela da homologação em 17/11/2026), quem faz cada um e se tem resultado.
--    Quem faz segue o plano aprovado (P4 = A): o técnico faz curativo,
--    administração de medicamento e glicemia capilar; o enfermeiro, também os
--    testes rápidos e a coleta do preventivo; o médico, todos, inclusive implante
--    e DIU. A cópia da tela está em src/domain/procedimentosUbs.ts.
-- 3. registrar_procedimento_aps(p_episodio, p_procedimento, p_resultado): quem
--    está de plantão no consultório registra o procedimento da ficha aberta.
-- 4. notificacao_compulsoria_periodo: teste rápido reagente de sífilis, HIV ou
--    hepatites vira sugestão de notificação (nunca notifica sozinho), com o CID
--    de referência do item da LNNC:
--      sífilis, população geral ou parceria → A53.9; em gestante → O98.1
--      HIV, população geral ou parceria → Z21; em gestante → O98.7
--      hepatite B ou C → B19
--
-- Idempotente. Teste: supabase/tests/ubs_procedimentos.sql
--
-- Rollback (na ordem): a troca 4 invertida; DROP FUNCTION public.procedimentos_aps_do_episodio(uuid);
--   DROP FUNCTION public.registrar_procedimento_aps(uuid, text, text), private.ubs_procedimentos();
--   a coluna fica (expand); para tirá-la, com janela:
--   ALTER TABLE public.procedimentos_realizados DROP COLUMN resultado;

-- ── 1. resultado ────────────────────────────────────────────────────────────
ALTER TABLE public.procedimentos_realizados ADD COLUMN IF NOT EXISTS resultado text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'procedimentos_realizados_resultado_check'
                   AND conrelid = 'public.procedimentos_realizados'::regclass) THEN
    ALTER TABLE public.procedimentos_realizados ADD CONSTRAINT procedimentos_realizados_resultado_check
      CHECK (resultado IS NULL OR resultado IN ('reagente', 'nao_reagente', 'invalido'));
  END IF;
END $$;
COMMENT ON COLUMN public.procedimentos_realizados.resultado IS
  'Resultado do teste rápido (percurso da UBS, U7): reagente, nao_reagente ou invalido. Nulo nos outros procedimentos.';

-- ── 2. catálogo ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ubs_procedimentos()
RETURNS TABLE (codigo text, nome text, papeis text[], com_resultado boolean, cid_reagente text)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT * FROM (VALUES
    ('0214010074', 'Teste rápido de sífilis', ARRAY['plantonista', 'enfermeiro'], true, 'A53.9'),
    ('0214010252', 'Teste rápido de sífilis em gestante', ARRAY['plantonista', 'enfermeiro'], true, 'O98.1'),
    ('0214010260', 'Teste rápido de sífilis em parceria de gestante', ARRAY['plantonista', 'enfermeiro'], true, 'A53.9'),
    ('0214010058', 'Teste rápido de HIV', ARRAY['plantonista', 'enfermeiro'], true, 'Z21'),
    ('0214010279', 'Teste rápido de HIV em gestante', ARRAY['plantonista', 'enfermeiro'], true, 'O98.7'),
    ('0214010287', 'Teste rápido de HIV em parceria de gestante', ARRAY['plantonista', 'enfermeiro'], true, 'Z21'),
    ('0214010228', 'Teste rápido de hepatite B (HBsAg)', ARRAY['plantonista', 'enfermeiro'], true, 'B19'),
    ('0214010236', 'Teste rápido de hepatite B (HBsAg) em gestante', ARRAY['plantonista', 'enfermeiro'], true, 'B19'),
    ('0214010244', 'Teste rápido de hepatite B (HBsAg) em parceria de gestante', ARRAY['plantonista', 'enfermeiro'], true, 'B19'),
    ('0214010295', 'Teste rápido de hepatite C', ARRAY['plantonista', 'enfermeiro'], true, 'B19'),
    ('0214010309', 'Teste rápido de hepatite C em gestante', ARRAY['plantonista', 'enfermeiro'], true, 'B19'),
    ('0214010317', 'Teste rápido de hepatite C em parceria de gestante', ARRAY['plantonista', 'enfermeiro'], true, 'B19'),
    ('0214010066', 'Teste rápido de gravidez', ARRAY['plantonista', 'enfermeiro'], true, NULL),
    ('0201020033', 'Coleta de material do colo do útero (preventivo)', ARRAY['plantonista', 'enfermeiro'], false, NULL),
    ('0301040176', 'Inserção do implante de etonogestrel', ARRAY['plantonista'], false, NULL),
    ('0301040184', 'Retirada do implante de etonogestrel', ARRAY['plantonista'], false, NULL),
    ('0301040141', 'Inserção do DIU', ARRAY['plantonista'], false, NULL),
    ('0301040150', 'Retirada do DIU', ARRAY['plantonista'], false, NULL),
    ('0301100284', 'Curativo simples', ARRAY['plantonista', 'enfermeiro', 'tecnico_enfermagem'], false, NULL),
    ('0301100276', 'Curativo especial', ARRAY['plantonista', 'enfermeiro', 'tecnico_enfermagem'], false, NULL),
    ('0301100209', 'Administração de medicamento intramuscular', ARRAY['plantonista', 'enfermeiro', 'tecnico_enfermagem'], false, NULL),
    ('0301100225', 'Administração de medicamento subcutâneo', ARRAY['plantonista', 'enfermeiro', 'tecnico_enfermagem'], false, NULL),
    ('0301100217', 'Administração de medicamento oral', ARRAY['plantonista', 'enfermeiro', 'tecnico_enfermagem'], false, NULL),
    ('0301100233', 'Administração tópica de medicamento', ARRAY['plantonista', 'enfermeiro', 'tecnico_enfermagem'], false, NULL),
    ('0214010015', 'Glicemia capilar', ARRAY['plantonista', 'enfermeiro', 'tecnico_enfermagem'], false, NULL)
  ) AS t(codigo, nome, papeis, com_resultado, cid_reagente)
$$;
REVOKE ALL ON FUNCTION private.ubs_procedimentos() FROM PUBLIC, anon, authenticated;

-- ── 3. registro ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_procedimento_aps(p_episodio uuid, p_procedimento text, p_resultado text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  c record;
  v_eu uuid := private.meu_perfil_id();
  v_codigo text := regexp_replace(coalesce(p_procedimento, ''), '\D', '', 'g');
  v_resultado text := nullif(btrim(coalesce(p_resultado, '')), '');
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'Os procedimentos por aqui são da UBS.'; END IF;
  IF e.etapa NOT IN ('triagem', 'atendimento') THEN RAISE EXCEPTION 'A ficha já foi encerrada.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão neste consultório.';
  END IF;
  SELECT * INTO c FROM private.ubs_procedimentos() p WHERE p.codigo = v_codigo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Procedimento fora da lista da UBS.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(c.papeis) r WHERE private.tenho_papel(e.unidade_id, r) IS TRUE) THEN
    RAISE EXCEPTION 'Este procedimento não é do seu papel.';
  END IF;
  IF c.com_resultado AND (v_resultado IS NULL OR v_resultado NOT IN ('reagente', 'nao_reagente', 'invalido')) THEN
    RAISE EXCEPTION 'Informe o resultado do teste rápido: reagente, não reagente ou inválido.';
  END IF;
  IF NOT c.com_resultado AND v_resultado IS NOT NULL THEN
    RAISE EXCEPTION 'Este procedimento não tem resultado.';
  END IF;
  INSERT INTO public.procedimentos_realizados (unidade_id, paciente_id, episodio_id, procedimento, quantidade, realizado_em,
                                               profissional_id, via, registrado_por, resultado)
  VALUES (e.unidade_id, e.paciente_id, e.id, v_codigo, 1, now(), v_eu, 'quem_fez', v_eu, v_resultado)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('procedimento_aps_registrado', 'procedimentos_realizados', v_id, e.unidade_id,
    jsonb_build_object('procedimento', v_codigo, 'resultado', v_resultado, 'episodio_id', e.id));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_procedimento_aps(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_procedimento_aps(uuid, text, text) TO authenticated;

-- ── 4. teste reagente sugere notificação ────────────────────────────────────
DO $$
DECLARE
  def text := replace(pg_get_functiondef('public.notificacao_compulsoria_periodo(uuid, date, date, text[])'::regprocedure), chr(13), '');
  antigo text := '     WHERE i.unidade_id = p_unidade AND i.cid_alta IS NOT NULL';
  novo text := '     WHERE i.unidade_id = p_unidade AND i.cid_alta IS NOT NULL
    UNION ALL
    -- U7, PR 5: teste rápido reagente (sugestão; CID de referência do item)
    SELECT pr.paciente_id, pr.episodio_id, NULL::uuid, c.cid_reagente, c.nome || '' reagente'', pr.realizado_em, ''Teste rápido reagente''
      FROM public.procedimentos_realizados pr JOIN private.ubs_procedimentos() c ON c.codigo = pr.procedimento
     WHERE pr.unidade_id = p_unidade AND pr.resultado = ''reagente'' AND pr.cancelado_em IS NULL AND c.cid_reagente IS NOT NULL';
BEGIN
  IF position('U7, PR 5: teste rápido reagente' IN def) > 0 THEN RETURN; END IF;
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'notificacao_compulsoria_periodo mudou: trecho não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

-- ── 5. leitura dos procedimentos da ficha ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.procedimentos_aps_do_episodio(p_episodio uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF private.pode_atuar_no_paciente(e.paciente_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'procedimento', pr.procedimento, 'resultado', pr.resultado,
                                                       'realizado_em', pr.realizado_em) ORDER BY pr.realizado_em DESC)
                     FROM public.procedimentos_realizados pr
                    WHERE pr.episodio_id = e.id AND pr.cancelado_em IS NULL), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.procedimentos_aps_do_episodio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procedimentos_aps_do_episodio(uuid) TO authenticated;
