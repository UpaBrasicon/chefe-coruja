-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 5 — regressão da ocupação por setor. Roda
-- depois de 01–04 e 10–20, no mesmo banco. Compara, setor por setor, o que o
-- gestor vê (ocupacao_setores) com as internações abertas no banco.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- o que o gestor vê, guardado para conferir como postgres
SELECT e2e.passo('T5.painel', NULL, 'gestor', '/indicadores', 'Ocupação por setor (gestor)',
  $q$SELECT jsonb_agg(to_jsonb(o))::text FROM public.ocupacao_setores('e1100000-0000-4000-8000-000000000001') o$q$, 'ok', 'ocupacao_t5');

WITH painel AS (
  SELECT (x ->> 'setor_id')::uuid AS setor_id, x ->> 'setor_nome' AS nome, (x ->> 'internados')::int AS internados,
         (x ->> 'sem_leito')::int AS sem_leito, (x ->> 'limite')::int AS limite
    FROM jsonb_array_elements(e2e.v('ocupacao_t5')::jsonb) x
), banco AS (
  SELECT s.id AS setor_id, s.nome, s.tipo,
         count(i.id) FILTER (WHERE i.id IS NOT NULL) AS internados,
         count(i.id) FILTER (WHERE i.id IS NOT NULL AND i.leito_atual_id IS NULL) AS sem_leito
    FROM public.setores s
    LEFT JOIN public.internacoes i ON i.setor_atual_id = s.id AND i.data_alta IS NULL
                                   AND i.status IN ('admitido', 'em_observacao', 'internado')
   WHERE s.unidade_id = 'e1100000-0000-4000-8000-000000000001' AND s.ativo
   GROUP BY s.id, s.nome, s.tipo
)
SELECT e2e.conferir('T5.setor_' || b.nome, NULL,
         'Painel = banco no setor ' || b.nome || ' (' || b.tipo || ')',
         CASE WHEN b.tipo IN ('internacao', 'observacao', 'isolamento', 'uti')
              THEN p.setor_id IS NOT NULL AND p.internados = b.internados AND p.sem_leito = b.sem_leito
              ELSE p.setor_id IS NULL END,
         'painel ' || coalesce(p.internados::text || '/' || p.limite || ' (' || p.sem_leito || ' sem leito)', 'fora da lista')
           || ' · banco ' || b.internados || ' (' || b.sem_leito || ' sem leito)')
  FROM banco b LEFT JOIN painel p ON p.setor_id = b.setor_id;

SELECT e2e.conferir('T5.isolamento_na_lista', NULL, 'Isolamento aparece na ocupação',
  EXISTS (SELECT 1 FROM jsonb_array_elements(e2e.v('ocupacao_t5')::jsonb) x WHERE x ->> 'setor_nome' = 'Isolamento'), NULL);

SELECT passo, situacao, left(coalesce(detalhe, ''), 110) FROM e2e.resultados WHERE passo LIKE 'T5.%' ORDER BY id;
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'T5.%' GROUP BY 1 ORDER BY 1;
