-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da migration 20270422000090_materiais_custo_unitario.sql (custo
-- unitário dos materiais, RT em 24/11/2026). Rodar numa transação, primeiro na
-- homologação.
--
-- As funções trocadas por texto voltam pela troca inversa (mesma função de
-- troca da migration), o que devolve o corpo anterior exato, com ou sem a
-- 20270421000073. A ordem importa: primeiro as funções deixam de ler as
-- colunas novas; por último as colunas saem.
--
-- ATENÇÃO: o último passo (DROP COLUMN) apaga os custos cadastrados e os
-- custos congelados nos lançamentos. Se a volta for só do comportamento,
-- pare antes dele: as colunas paradas não atrapalham nada (expand).
-- As contas fechadas com o custo já congelado em contas.materiais_congelados
-- guardam as chaves custo_unitario e valor no JSON; a tela anterior as ignora.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.custo_trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;  -- já desfeita
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

-- o cadastro deixa de mostrar o custo
SELECT pg_temp.custo_trocar('public.materiais_da_unidade(uuid)'::regprocedure,
  $new$'procedimento_nome', s.nome, 'ativo', m.ativo, 'custo_unitario', m.custo_unitario,$new$,
  $old$'procedimento_nome', s.nome, 'ativo', m.ativo,$old$);

-- a conta deixa de somar os materiais
SELECT pg_temp.custo_trocar('public.conta_detalhe(uuid)'::regprocedure,
  $new$    'materiais', coalesce(c.materiais_congelados, private.conta_materiais(c)),
    -- custo unitário dos materiais (RT, 24/11/2026): soma de quantidade × custo
    'materiais_total', private.materiais_total(coalesce(c.materiais_congelados, private.conta_materiais(c))),$new$,
  $old$    'materiais', coalesce(c.materiais_congelados, private.conta_materiais(c)),$old$);
DROP FUNCTION IF EXISTS private.materiais_total(jsonb);

-- a linha da conta deixa de mostrar custo e valor
SELECT pg_temp.custo_trocar('private.conta_materiais(public.contas)'::regprocedure,
  $new$'quantidade', l.quantidade, 'custo_unitario', l.custo_unitario,
           'valor', round(l.quantidade * l.custo_unitario, 2), 'observacao', l.observacao,$new$,
  $old$'quantidade', l.quantidade, 'observacao', l.observacao,$old$);

-- o lançamento deixa de copiar o custo
SELECT pg_temp.custo_trocar('public.conta_lancar_material(uuid, uuid, numeric, text)'::regprocedure,
  $new$  INSERT INTO public.conta_materiais (conta_id, material_id, quantidade, observacao, lancado_por, custo_unitario)
  VALUES (c.id, m.id, p_quantidade, v_obs, v_eu, m.custo_unitario);$new$,
  $old$  INSERT INTO public.conta_materiais (conta_id, material_id, quantidade, observacao, lancado_por)
  VALUES (c.id, m.id, p_quantidade, v_obs, v_eu);$old$);

DROP FUNCTION IF EXISTS public.material_definir_custo(uuid, numeric);

-- a auditoria volta à lista anterior (as linhas já gravadas ficam como estão)
SELECT pg_temp.custo_trocar('private.payload_auditoria(text, jsonb)'::regprocedure,
  $new$'situacao','gravidade','versao','horario','exige','cor','escala','anterior','retifica',
                             -- custo unitário de material (R$), sem dado de pessoa
                             'custo_anterior','custo_novo'];$new$,
  $old$'situacao','gravidade','versao','horario','exige','cor','escala','anterior','retifica'];$old$);

-- conferência: nenhuma função viva lê mais as colunas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname IN ('public', 'private') AND p.prosrc LIKE '%custo_unitario%') THEN
    RAISE EXCEPTION 'Ainda há função lendo custo_unitario; confira antes de tirar as colunas.';
  END IF;
END $$;

-- apaga os custos (ver ATENÇÃO no topo)
ALTER TABLE public.conta_materiais DROP COLUMN IF EXISTS custo_unitario;
ALTER TABLE public.materiais_unidade DROP COLUMN IF EXISTS custo_unitario;

COMMIT;
