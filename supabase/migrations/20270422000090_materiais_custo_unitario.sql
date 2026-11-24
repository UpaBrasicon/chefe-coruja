-- ════════════════════════════════════════════════════════════════════════════
-- Custo unitário dos materiais (decisão do RT em 24/11/2026).
--
-- Até aqui o material era cadastrado e lançado na conta sem valor (5B, L4,
-- migration 20270226000001). O RT quer que cada material tenha um custo
-- unitário em R$, para a conta (e depois o BI) mostrar quantidade × custo.
--
--   • materiais_unidade.custo_unitario: o custo de hoje, em R$. Vazio = sem
--     custo (o material continua lançável).
--   • conta_materiais.custo_unitario: o custo congelado no lançamento. Mudar o
--     custo do cadastro depois não reescreve conta já lançada nem fechada.
--   • public.material_definir_custo(material, custo): define ou limpa o custo.
--     Podem o administrador geral, o gestor e o farmacêutico da unidade (a
--     mesma regra de private.pode_cadastrar_material da 20270421000073, escrita
--     aqui por extenso para valer com ou sem a 073). O faturamento só lança.
--     Até 2 casas decimais (é moeda), de 0 a 99.999.999. Grava na auditoria o
--     custo anterior e o novo.
--   • conta_lancar_material copia o custo do cadastro para o lançamento.
--   • private.conta_materiais devolve custo_unitario e valor (quantidade ×
--     custo, 2 casas; nulo quando o lançamento não tem custo); conta_detalhe
--     devolve materiais_total (soma dos lançamentos não retirados com custo;
--     nulo quando nenhum tem custo); materiais_da_unidade devolve o custo.
--   • private.payload_auditoria passa a deixar 'custo_anterior' e 'custo_novo'
--     (valor de material, nenhum dado de pessoa).
--
-- Expand: só acrescenta colunas e trechos. As funções já em uso mudam por
-- troca de trecho na definição viva (o corpo é o mesmo no master e na
-- homologação, com ou sem a 073, que só troca a checagem de acesso de
-- material_salvar e materiais_da_unidade); se o trecho não existir, para.
-- Reaplicável. Teste: supabase/tests/materiais_custo_unitario.sql
-- ROLLBACK: docs/banco/ROLLBACK-20270422000090.sql
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.materiais_unidade
  ADD COLUMN IF NOT EXISTS custo_unitario numeric(14, 4)
    CONSTRAINT materiais_unidade_custo_unitario_check CHECK (custo_unitario IS NULL OR custo_unitario >= 0);
ALTER TABLE public.conta_materiais
  ADD COLUMN IF NOT EXISTS custo_unitario numeric(14, 4)
    CONSTRAINT conta_materiais_custo_unitario_check CHECK (custo_unitario IS NULL OR custo_unitario >= 0);
COMMENT ON COLUMN public.materiais_unidade.custo_unitario IS 'Custo unitário de hoje, em R$ (nulo = sem custo). Muda só por material_definir_custo.';
COMMENT ON COLUMN public.conta_materiais.custo_unitario IS 'Custo unitário do material no momento do lançamento, em R$ (nulo = sem custo). Não muda depois.';

-- ── troca de trecho reaplicável ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.custo_trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;  -- já aplicada
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

-- auditoria: o custo do material (sem dado de pessoa) passa pela lista fechada
SELECT pg_temp.custo_trocar('private.payload_auditoria(text, jsonb)'::regprocedure,
  $old$'situacao','gravidade','versao','horario','exige','cor','escala','anterior','retifica'];$old$,
  $new$'situacao','gravidade','versao','horario','exige','cor','escala','anterior','retifica',
                             -- custo unitário de material (R$), sem dado de pessoa
                             'custo_anterior','custo_novo'];$new$);

-- ── definir o custo (farmácia, gestor ou administrador geral) ───────────────
CREATE OR REPLACE FUNCTION public.material_definir_custo(p_material uuid, p_custo numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE m public.materiais_unidade; v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO m FROM public.materiais_unidade WHERE id = p_material FOR UPDATE;
  IF m.id IS NULL OR NOT (coalesce(private.eh_super_admin(), false)
                          OR private.tenho_papel(m.unidade_id, 'gestor')
                          OR private.tenho_papel(m.unidade_id, 'farmaceutico')) THEN
    RAISE EXCEPTION 'Acesso negado: o custo do material é da farmácia e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_custo IS NOT NULL AND (p_custo < 0 OR p_custo > 99999999 OR p_custo <> round(p_custo, 2)) THEN
    RAISE EXCEPTION 'Custo unitário de R$ 0,00 a R$ 99.999.999,00, com até 2 casas decimais.';
  END IF;
  IF m.custo_unitario IS DISTINCT FROM p_custo THEN
    UPDATE public.materiais_unidade
       SET custo_unitario = p_custo, atualizado_por = v_eu, atualizado_em = now()
     WHERE id = m.id;
    PERFORM private.registrar_auditoria('material_custo_alterado', 'materiais_unidade', m.id, m.unidade_id,
      jsonb_build_object('custo_anterior', m.custo_unitario, 'custo_novo', p_custo));
  END IF;
  RETURN jsonb_build_object('id', m.id, 'custo_unitario', p_custo);
END $$;
REVOKE ALL ON FUNCTION public.material_definir_custo(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.material_definir_custo(uuid, numeric) TO authenticated;

-- ── o lançamento congela o custo de hoje ────────────────────────────────────
SELECT pg_temp.custo_trocar('public.conta_lancar_material(uuid, uuid, numeric, text)'::regprocedure,
  $old$  INSERT INTO public.conta_materiais (conta_id, material_id, quantidade, observacao, lancado_por)
  VALUES (c.id, m.id, p_quantidade, v_obs, v_eu);$old$,
  $new$  INSERT INTO public.conta_materiais (conta_id, material_id, quantidade, observacao, lancado_por, custo_unitario)
  VALUES (c.id, m.id, p_quantidade, v_obs, v_eu, m.custo_unitario);$new$);

-- ── a linha da conta mostra o custo e o valor ───────────────────────────────
SELECT pg_temp.custo_trocar('private.conta_materiais(public.contas)'::regprocedure,
  $old$'quantidade', l.quantidade, 'observacao', l.observacao,$old$,
  $new$'quantidade', l.quantidade, 'custo_unitario', l.custo_unitario,
           'valor', round(l.quantidade * l.custo_unitario, 2), 'observacao', l.observacao,$new$);

-- soma dos lançamentos não retirados com custo (nulo quando nenhum tem custo);
-- recebe a lista (viva ou congelada), como conta_detalhe a mostra
CREATE OR REPLACE FUNCTION private.materiais_total(p_materiais jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT sum((x ->> 'valor')::numeric)
    FROM jsonb_array_elements(coalesce(p_materiais, '[]'::jsonb)) x
   WHERE x ->> 'retirado_em' IS NULL AND x ->> 'valor' IS NOT NULL
$$;
REVOKE ALL ON FUNCTION private.materiais_total(jsonb) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.custo_trocar('public.conta_detalhe(uuid)'::regprocedure,
  $old$    'materiais', coalesce(c.materiais_congelados, private.conta_materiais(c)),$old$,
  $new$    'materiais', coalesce(c.materiais_congelados, private.conta_materiais(c)),
    -- custo unitário dos materiais (RT, 24/11/2026): soma de quantidade × custo
    'materiais_total', private.materiais_total(coalesce(c.materiais_congelados, private.conta_materiais(c))),$new$);

-- ── o cadastro mostra o custo ───────────────────────────────────────────────
SELECT pg_temp.custo_trocar('public.materiais_da_unidade(uuid)'::regprocedure,
  $old$'procedimento_nome', s.nome, 'ativo', m.ativo,$old$,
  $new$'procedimento_nome', s.nome, 'ativo', m.ativo, 'custo_unitario', m.custo_unitario,$new$);
