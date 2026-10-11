-- Fase 4, tarefa 3 — migration 20261109000001_priorizacao_regulacao.sql:
-- priorização clínica. Cobre:
-- - prioridade do regulador à parte da proposta, com motivo, histórico e auditoria;
-- - a fila ordena e filtra pela prioridade efetiva;
-- - quem pode (só o regulador da central; não com pedido de outro regulador;
--   só pedido em aberto; não volta a "não classificada");
-- - critérios por nível, escritos pela central e lidos pela origem;
-- - marcadores de vulnerabilidade na solicitação.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303060190', 'TRATAMENTO DE IAM DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-000000000099', 'Rede da Priorização');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-000000000099', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-000000000991'::uuid, 'UPA Sul', '7654393'),
               ('21000000-0000-4000-8000-000000000993'::uuid, 'Central Sul', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000991', '21000000-0000-4000-8000-000000000991', 'Porta', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-000000000099', '21000000-0000-4000-8000-000000000993', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000991', 'plantonista'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000993', 'regulador'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000993', 'regulador'),
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000993', 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns, cpf) VALUES
  ('23000000-0000-4000-8000-000000000991', '21000000-0000-4000-8000-000000000991', 'Gestante Sul', '1995-01-01', 'S-1',
   '22000000-0000-4000-8000-000000000991', 'F', '798682828807290', NULL),
  ('23000000-0000-4000-8000-000000000992', '21000000-0000-4000-8000-000000000991', 'Senhor Sul', '1940-01-01', 'S-2',
   '22000000-0000-4000-8000-000000000991', 'M', NULL, '52998224725');

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
CREATE FUNCTION pg_temp.pedido(extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('tipo', 'leito', 'tipo_leito', 'clinico', 'procedimento', '0303060190', 'destino_tipo', 'a_definir',
    'carater', 'urgencia', 'prioridade', 'eletiva', 'cid', 'I21.9',
    'quadro_clinico', 'Quadro clínico do pedido de teste da priorização.') || extra $$;
GRANT EXECUTE ON FUNCTION pg_temp.pedido(jsonb) TO authenticated;
CREATE FUNCTION pg_temp.ordem() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(split_part(d->'paciente'->>'nome', ' ', 1), ',' ORDER BY i)
    FROM jsonb_array_elements(public.regulacao_fila('21000000-0000-4000-8000-000000000993')->'dados') WITH ORDINALITY x(d, i) $$;
GRANT EXECUTE ON FUNCTION pg_temp.ordem() TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. marcadores de vulnerabilidade ────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000991', '23000000-0000-4000-8000-000000000991',
  pg_temp.pedido('{"vulnerabilidades": ["vip"]}'))$$, 'Marcador de vulnerabilidade desconhecido', 'marcador fora da lista recusado');
-- a gestante pede antes (eletiva); o senhor depois (urgência)
INSERT INTO t SELECT 'g', public.regulacao_solicitar('21000000-0000-4000-8000-000000000991', '23000000-0000-4000-8000-000000000991',
  pg_temp.pedido('{"vulnerabilidades": ["gestante", "gestante"]}'))->>'id';
INSERT INTO t SELECT 's', public.regulacao_solicitar('21000000-0000-4000-8000-000000000991', '23000000-0000-4000-8000-000000000992',
  pg_temp.pedido('{"prioridade": "urgencia", "vulnerabilidades": ["idoso", "oncologico"]}'))->>'id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok((public.regulacao_detalhe(pg_temp.v('g')::uuid)->'vulnerabilidades') = '["gestante"]'::jsonb
              AND (public.regulacao_detalhe(pg_temp.v('s')::uuid)->'vulnerabilidades') = '["idoso", "oncologico"]'::jsonb,
  'marcadores gravados sem repetição e mostrados no detalhe');
SELECT pg_temp.ok(pg_temp.ordem() = 'Senhor,Gestante', 'antes da priorização: urgência na frente da eletiva');

-- ── 2. prioridade do regulador ──────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.regulacao_priorizar(%L, %L, %L)', pg_temp.v('g'), 'emergencia', 'Pré-eclâmpsia grave'),
  'Quem define a prioridade é o médico regulador', 'médico da origem não prioriza');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.regulacao_priorizar(%L, %L, %L)', pg_temp.v('g'), 'emergencia', 'curto'),
  'Escreva o motivo', 'priorizar pede motivo');
SELECT pg_temp.falha(format('SELECT public.regulacao_priorizar(%L, %L, %L)', pg_temp.v('g'), 'nao_classificada', 'Volta para a fila sem nível'),
  'Prioridade: emergência', 'regulador não devolve a "não classificada"');
SELECT pg_temp.ok((public.regulacao_priorizar(pg_temp.v('g')::uuid, 'emergencia', 'Pré-eclâmpsia grave, PA 170x110')->>'prioridade_efetiva') = 'emergencia',
  'regulador define a prioridade');
SELECT pg_temp.ok((public.regulacao_detalhe(pg_temp.v('g')::uuid)->>'prioridade') = 'eletiva'
              AND (public.regulacao_detalhe(pg_temp.v('g')::uuid)->>'prioridade_regulador') = 'emergencia'
              AND (public.regulacao_detalhe(pg_temp.v('g')::uuid)->>'prioridade_regulador_motivo') LIKE 'Pré-eclâmpsia%'
              AND (public.regulacao_detalhe(pg_temp.v('g')::uuid)->>'prioridade_regulador_por') IS NOT NULL,
  'a proposta do solicitante fica; a do regulador vem com quem e motivo');
SELECT pg_temp.ok(pg_temp.ordem() = 'Gestante,Senhor', 'a fila passa a ordenar pela prioridade do regulador');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_fila('21000000-0000-4000-8000-000000000993', '{"prioridade": "emergencia"}')->'dados') = 1
              AND (public.regulacao_fila('21000000-0000-4000-8000-000000000993')->'resumo'->>'emergencia')::int = 1,
  'filtro e resumo pela prioridade efetiva');
SELECT pg_temp.ok((SELECT e->'detalhes'->>'de' = 'eletiva' AND e->'detalhes'->>'para' = 'emergencia'
                     FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.v('g')::uuid)->'eventos') e
                    WHERE e->>'evento' = 'prioridade_regulador'), 'histórico guarda de, para e motivo');

-- a origem vê a prioridade do regulador e o motivo
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok((SELECT x->>'prioridade_regulador' = 'emergencia' AND x->>'prioridade_regulador_motivo' IS NOT NULL
                     FROM jsonb_array_elements(public.regulacao_lista('21000000-0000-4000-8000-000000000991')) x WHERE x->>'id' = pg_temp.v('g')),
  'a origem vê a prioridade do regulador e o motivo na lista');

-- pedido com outro regulador não muda; pedido fechado não muda
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.regulacao_assumir(pg_temp.v('s')::uuid);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.regulacao_priorizar(%L, %L, %L)', pg_temp.v('s'), 'prioritaria', 'Estável, pode aguardar'),
  'Este pedido está com', 'não prioriza pedido assumido por outro regulador');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.regulacao_cancelar(pg_temp.v('g')::uuid, 'Paciente transferida por conta própria');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.regulacao_priorizar(%L, %L, %L)', pg_temp.v('g'), 'urgencia', 'Mudança depois de cancelada'),
  'A prioridade só muda com o pedido em aberto', 'pedido cancelado não muda de prioridade');

-- ── 3. critérios por nível ──────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_criterio('21000000-0000-4000-8000-000000000993', 'emergencia', 'Risco de vida imediato')$$,
  'Os critérios são escritos pelo regulador ou pelo gestor', 'médico da origem não escreve critério');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_criterio('21000000-0000-4000-8000-000000000993', 'emergencia', 'curto')$$,
  'Escreva o critério', 'critério curto recusado');
SELECT public.regulacao_definir_criterio('21000000-0000-4000-8000-000000000993', 'emergencia', 'Risco de vida imediato: choque, IAM com supra, AVC na janela.');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.regulacao_definir_criterio('21000000-0000-4000-8000-000000000993', 'emergencia', 'Risco de vida imediato: choque, IAM com supra, AVC na janela, eclâmpsia.');
SELECT public.regulacao_definir_criterio('21000000-0000-4000-8000-000000000993', 'eletiva', 'Pode aguardar a fila comum sem risco de piora.');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok((public.regulacao_criterios('21000000-0000-4000-8000-000000000991')->'emergencia'->>'texto') LIKE '%eclâmpsia.'
              AND (public.regulacao_criterios('21000000-0000-4000-8000-000000000991') ? 'eletiva')
              AND NOT (public.regulacao_criterios('21000000-0000-4000-8000-000000000991') ? 'urgencia'),
  'a origem lê os critérios da central; o gestor da central também edita');
SELECT pg_temp.ok(public.regulacao_criterios('21000000-0000-4000-8000-000000000001') = '{}'::jsonb, 'rede sem central: sem critérios');

RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE acao IN ('regulacao_priorizada', 'regulacao_criterio_definido')
                    AND unidade_id = '21000000-0000-4000-8000-000000000993') = 4, 'auditoria registra priorização e critérios');

ROLLBACK;
