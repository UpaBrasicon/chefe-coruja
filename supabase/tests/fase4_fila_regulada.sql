-- Fase 4, tarefa 2 — migration 20261108000001_fila_regulada.sql: fila
-- regulada. Cobre:
-- - ordem: "não classificada" no topo, depois prioridade e tempo de espera;
-- - filtros (tipo, prioridade, origem, status, caráter, tipo de leito,
--   isolamento) e busca (nome, nº, protocolo externo);
-- - resumo por prioridade e lista de origens;
-- - assumir (só regulador da central; um por vez) e devolver à fila;
-- - quem não vê a fila.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303060190', 'TRATAMENTO DE IAM DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0206010079', 'TOMOGRAFIA DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

-- rede de teste: UPA (origem) e central; regulador 006; o 002 é médico da UPA
INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-000000000098', 'Rede da Fila');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-000000000098', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-000000000981'::uuid, 'UPA Norte', '7654385'),
               ('21000000-0000-4000-8000-000000000983'::uuid, 'Central da Fila', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000981', '21000000-0000-4000-8000-000000000981', 'Porta', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-000000000098', '21000000-0000-4000-8000-000000000983', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000981', 'plantonista'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000983', 'regulador'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000983', 'regulador'),
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000983', 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
SELECT ('23000000-0000-4000-8000-00000000098' || n)::uuid, '21000000-0000-4000-8000-000000000981', 'Paciente Fila ' || n,
       '1970-01-01', 'F-' || n, '22000000-0000-4000-8000-000000000981', 'M'
  FROM generate_series(1, 5) n;

-- cinco pedidos, de propósito fora de ordem de chegada e de prioridade
INSERT INTO public.regulacao_solicitacoes (organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, tipo, procedimento,
  tipo_leito, isolamento, isolamento_tipo, destino_tipo, carater, modalidade, prioridade, cid, quadro_clinico,
  solicitante_id, solicitante_papel, criada_em, externo_protocolo)
SELECT '20000000-0000-4000-8000-000000000098', '21000000-0000-4000-8000-000000000983', '21000000-0000-4000-8000-000000000981', '7654385',
       ('23000000-0000-4000-8000-00000000098' || x.n)::uuid, x.tipo, x.proc, x.leito, x.iso, CASE WHEN x.iso THEN 'contato' END,
       'a_definir', x.car, CASE WHEN x.tipo = 'leito' THEN '04' ELSE '07' END, x.pri, 'I21.9', 'Quadro clínico do pedido de teste da fila.',
       '10000000-0000-4000-8000-000000000002', 'medico', now() - make_interval(mins => x.min), x.prot
  FROM (VALUES (1, 'leito', '0303060190', 'uti_adulto', false, 'urgencia', 'urgencia', 10, NULL),
               (2, 'leito', '0303060190', 'clinico', true, 'urgencia', 'emergencia', 5, 'SISREG-777'),
               (3, 'exame', '0206010079', NULL, false, 'eletivo', 'eletiva', 120, NULL),
               (4, 'leito', '0303060190', 'uti_adulto', false, 'urgencia', 'urgencia', 60, NULL),
               (5, 'exame', '0206010079', NULL, false, 'eletivo', 'nao_classificada', 1, NULL)) x(n, tipo, proc, leito, iso, car, pri, min, prot);

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
-- nomes dos pacientes na ordem da fila, para conferir
CREATE FUNCTION pg_temp.ordem(filtros jsonb DEFAULT '{}') RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(right(d->'paciente'->>'nome', 1), ',' ORDER BY i)
    FROM jsonb_array_elements(public.regulacao_fila('21000000-0000-4000-8000-000000000983', filtros)->'dados') WITH ORDINALITY x(d, i) $$;
GRANT EXECUTE ON FUNCTION pg_temp.ordem(jsonb) TO authenticated;
CREATE FUNCTION pg_temp.id(n int) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.regulacao_solicitacoes WHERE paciente_id = ('23000000-0000-4000-8000-00000000098' || n)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(int) TO authenticated;
CREATE FUNCTION pg_temp.status(n int) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT status || '/' || coalesce(assumida_por::text, '-') FROM public.regulacao_solicitacoes
   WHERE paciente_id = ('23000000-0000-4000-8000-00000000098' || n)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.status(int) TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. ordem, resumo e quem vê ──────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok(pg_temp.ordem() = '5,2,4,1,3',
  'não classificada no topo; depois emergência, urgências (a mais antiga primeiro) e eletiva');
SELECT pg_temp.ok((public.regulacao_fila('21000000-0000-4000-8000-000000000983')->'resumo'->>'urgencia')::int = 2
              AND jsonb_array_length(public.regulacao_fila('21000000-0000-4000-8000-000000000983')->'origens') = 1
              AND (public.regulacao_fila('21000000-0000-4000-8000-000000000983')->'dados'->1->>'espera_segundos')::int BETWEEN 290 AND 400,
  'resumo por prioridade, origens e tempo de espera');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_fila('21000000-0000-4000-8000-000000000983')$$, 'Acesso negado', 'médico da origem não vê a fila da central');
SELECT pg_temp.falha($$SELECT public.regulacao_fila('21000000-0000-4000-8000-000000000981')$$, 'Esta unidade não é uma central', 'fila só de central');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.ok(pg_temp.ordem() = '5,2,4,1,3', 'gestor da central vê a fila');

-- ── 2. filtros e busca ──────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok(pg_temp.ordem('{"tipo": "exame"}') = '5,3', 'filtro por tipo');
SELECT pg_temp.ok(pg_temp.ordem('{"prioridade": "urgencia"}') = '4,1', 'filtro por prioridade');
SELECT pg_temp.ok(pg_temp.ordem('{"carater": "eletivo"}') = '5,3', 'filtro por caráter');
SELECT pg_temp.ok(pg_temp.ordem('{"tipo_leito": "uti_adulto"}') = '4,1', 'filtro por tipo de leito');
SELECT pg_temp.ok(pg_temp.ordem('{"isolamento": true}') = '2', 'filtro por isolamento');
SELECT pg_temp.ok(pg_temp.ordem('{"unidade_origem_id": "21000000-0000-4000-8000-000000000981"}') = '5,2,4,1,3', 'filtro por origem');
SELECT pg_temp.ok(pg_temp.ordem('{"busca": "Fila 3"}') = '3' AND pg_temp.ordem('{"busca": "sisreg-777"}') = '2', 'busca por nome e protocolo externo');
SELECT pg_temp.ok(pg_temp.ordem(jsonb_build_object('busca', (SELECT x->>'numero' FROM jsonb_array_elements(
                     public.regulacao_fila('21000000-0000-4000-8000-000000000983')->'dados') x WHERE x->'paciente'->>'nome' = 'Paciente Fila 4'))) = '4',
  'busca pelo nº da solicitação');

-- ── 3. assumir e devolver ───────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.regulacao_assumir(%L)', pg_temp.id(2)), 'Assume o pedido o médico regulador', 'médico da origem não assume');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok((public.regulacao_assumir(pg_temp.id(2))->>'assumida_por_mim')::boolean, 'regulador assume');
SELECT pg_temp.ok(pg_temp.status(2) = 'em_analise/10000000-0000-4000-8000-000000000006', 'pedido assumido fica em análise com o regulador');
SELECT pg_temp.ok((public.regulacao_fila('21000000-0000-4000-8000-000000000983', '{"status": ["em_analise"]}')->'dados'->0->>'assumida_por') IS NOT NULL,
  'a fila mostra quem está com o pedido');
SELECT pg_temp.ok((public.regulacao_assumir(pg_temp.id(2))->>'assumida_por_mim')::boolean, 'assumir de novo o próprio pedido não dá erro');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.regulacao_assumir(%L)', pg_temp.id(2)), 'Este pedido está com', 'outro regulador não toma o pedido');
SELECT pg_temp.falha(format('SELECT public.regulacao_soltar(%L)', pg_temp.id(2)), 'Devolve à fila quem assumiu', 'outro regulador não devolve');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.regulacao_soltar(pg_temp.id(2), 'Troca de plantão');
SELECT pg_temp.ok(pg_temp.status(2) = 'enviada/-', 'devolvido à fila: volta a enviada, sem dono');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.regulacao_assumir(pg_temp.id(2));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.regulacao_soltar(pg_temp.id(2), 'Regulador saiu do plantão');
SELECT pg_temp.ok(pg_temp.status(2) = 'enviada/-', 'gestor da central devolve à fila');
SELECT pg_temp.falha(format('SELECT public.regulacao_soltar(%L)', pg_temp.id(2)), 'Este pedido não está com ninguém', 'devolver pedido sem dono');
SELECT pg_temp.ok((SELECT string_agg(e->>'evento', ',' ORDER BY e->>'em')
                     FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.id(2))->'eventos') e)
                  = 'assumida,assumida,devolvida_a_fila,assumida,devolvida_a_fila', 'histórico de assumir e devolver');

-- cancelada sai da fila padrão e não se assume
RESET ROLE;
UPDATE public.regulacao_solicitacoes SET status = 'cancelada', cancelada_em = now(), cancelamento_origem = 'solicitante',
       motivo_cancelamento = 'Cancelada no teste da fila' WHERE id = pg_temp.id(3);
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok(pg_temp.ordem() = '5,2,4,1' AND pg_temp.ordem('{"status": ["cancelada"]}') = '3', 'cancelada sai da fila padrão e aparece pelo filtro de status');
SELECT pg_temp.falha(format('SELECT public.regulacao_assumir(%L)', pg_temp.id(3)), 'Este pedido não está na fila', 'cancelada não se assume');

ROLLBACK;
