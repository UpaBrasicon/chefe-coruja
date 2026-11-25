-- Modelo da Regulação do RT (25/11/2026) — migration
-- 20270425000020_regulacao_isolamento_vagas.sql. Cobre:
-- - RG2: tipos novos (reverso, contato + aerossol), situação e agente pela
--   regulacao_definir_isolamento (quem pede e o regulador; o médico de fora,
--   não); validações; evento na linha do tempo; o paciente marcado não sai do
--   isolamento pela regulação;
-- - trava do leito com os tipos novos: aceite do destino só em leito de
--   isolamento, com o rótulo novo na recusa;
-- - RG3: leito com pressão negativa; mapa de vagas e vagas compatíveis com os
--   livres de isolamento comum e de pressão negativa; extras da fila;
-- - quem vê (regulador e gestor da central) e quem não vê.
-- ROLLBACK no fim (nada é gravado).
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-0000000009d0', 'Rede do Isolamento');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf, latitude, longitude)
SELECT x.id, '20000000-0000-4000-8000-0000000009d0', x.nome, u.tipo, x.cnes, x.mun, 'SP', x.lat, x.lon
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009d1'::uuid, 'UPA Isolamento', '7654501', 'Cidade Um', -22.9, -47.0),
               ('21000000-0000-4000-8000-0000000009d2'::uuid, 'Hospital Isolamento', '7654502', 'Cidade Dois', -22.8, -47.1),
               ('21000000-0000-4000-8000-0000000009d3'::uuid, 'Central Isolamento', NULL, 'Cidade Um', NULL, NULL)) x(id, nome, cnes, mun, lat, lon)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009d0', '21000000-0000-4000-8000-0000000009d3', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT x.id, x.un, x.nome, s.tipo
  FROM public.setores s, (VALUES ('22000000-0000-4000-8000-0000000009d1'::uuid, '21000000-0000-4000-8000-0000000009d1'::uuid, 'Porta'),
                                 ('22000000-0000-4000-8000-0000000009d2'::uuid, '21000000-0000-4000-8000-0000000009d2'::uuid, 'UTI')) x(id, un, nome)
 WHERE s.id = '22000000-0000-4000-8000-000000000001';
UPDATE public.setores SET regulacao_tipo_leito = 'uti_adulto' WHERE id = '22000000-0000-4000-8000-0000000009d2';
-- UTI do hospital: 2 comuns livres, 1 isolamento comum livre, 1 pressão negativa livre, 1 pressão negativa ocupado
INSERT INTO public.leitos (id, setor_id, identificador, status, tipo, pressao_negativa) VALUES
  ('24000000-0000-4000-8000-0000000009d1', '22000000-0000-4000-8000-0000000009d2', 'UTI-1', 'livre', 'clinico', false),
  ('24000000-0000-4000-8000-0000000009d2', '22000000-0000-4000-8000-0000000009d2', 'UTI-2', 'livre', 'clinico', false),
  ('24000000-0000-4000-8000-0000000009d3', '22000000-0000-4000-8000-0000000009d2', 'ISO-1', 'livre', 'isolamento', false),
  ('24000000-0000-4000-8000-0000000009d4', '22000000-0000-4000-8000-0000000009d2', 'PN-1', 'livre', 'isolamento', true),
  ('24000000-0000-4000-8000-0000000009d5', '22000000-0000-4000-8000-0000000009d2', 'PN-2', 'ocupado', 'isolamento', true);
-- 002 médico da UPA (pede); 004 médico do hospital (de fora); 006 regulador; 001 gestor da central
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009d1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009d2', 'plantonista'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009d3', 'regulador'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-0000000009d3', 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
VALUES ('23000000-0000-4000-8000-0000000009d1', '21000000-0000-4000-8000-0000000009d1', 'Paciente Isolamento', '1970-01-01', 'P-ISO',
        '22000000-0000-4000-8000-0000000009d1', 'M');
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, paciente_nao_identificado,
  tipo, procedimento, tipo_leito, destino_tipo, carater, modalidade, prioridade, cid, quadro_clinico, solicitante_id, solicitante_papel,
  isolamento, isolamento_tipo)
VALUES ('25000000-0000-4000-8000-0000000009d1', '20000000-0000-4000-8000-0000000009d0', '21000000-0000-4000-8000-0000000009d3',
        '21000000-0000-4000-8000-0000000009d1', '7654501', '23000000-0000-4000-8000-0000000009d1', true,
        'leito', '0303060190', 'uti_adulto', 'a_definir', 'urgencia', '04', 'urgencia', 'I21.9',
        'Quadro clínico do pedido de teste do isolamento.', '10000000-0000-4000-8000-000000000002', 'medico',
        true, 'contato_aerossol');

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
CREATE FUNCTION pg_temp.un(m jsonb, id text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT u FROM jsonb_array_elements(m->'unidades') u WHERE u->>'id' = id $$;
GRANT EXECUTE ON FUNCTION pg_temp.un(jsonb, text) TO authenticated;

-- ── RG2: CHECK alargado (o combinado entrou no INSERT acima) ────────────────
SELECT pg_temp.ok((SELECT isolamento_tipo FROM public.regulacao_solicitacoes WHERE id = '25000000-0000-4000-8000-0000000009d1') = 'contato_aerossol',
  'tipo combinado aceito pela tabela');
SELECT pg_temp.falha($$UPDATE public.regulacao_solicitacoes SET isolamento_tipo = 'qualquer' WHERE id = '25000000-0000-4000-8000-0000000009d1'$$,
  'new row for relation', 'tipo fora da lista recusado pelo CHECK');

SET LOCAL ROLE authenticated;
-- ── RG2: quem define ────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_isolamento('25000000-0000-4000-8000-0000000009d1', 'aerossol', 'confirmado', 'TB')$$,
  'O isolamento do pedido é definido', 'médico de outra unidade não define o isolamento');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_isolamento('25000000-0000-4000-8000-0000000009d1', 'outro', NULL, NULL)$$,
  'Tipo de isolamento', 'tipo inválido recusado');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_isolamento('25000000-0000-4000-8000-0000000009d1', 'contato', 'talvez', NULL)$$,
  'Situação do isolamento', 'situação inválida recusada');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_isolamento('25000000-0000-4000-8000-0000000009d1', 'contato', NULL, repeat('x', 121))$$,
  'O agente ou motivo vai até 120', 'agente longo recusado');
SELECT pg_temp.ok((public.regulacao_definir_isolamento('25000000-0000-4000-8000-0000000009d1', 'contato_aerossol', 'suspeito', 'KPC e TB'))->>'isolamento_situacao' = 'suspeito',
  'quem pede grava situação e agente logo depois do envio');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok((public.regulacao_definir_isolamento('25000000-0000-4000-8000-0000000009d1', 'reverso', 'confirmado', 'Neutropenia'))->>'isolamento_tipo' = 'reverso',
  'regulador muda para reverso (protetor)');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.regulacao_eventos WHERE solicitacao_id = '25000000-0000-4000-8000-0000000009d1' AND evento = 'isolamento_alterado') = 2,
  'cada mudança fica na linha do tempo');
SELECT pg_temp.ok(private.rotulo_isolamento(ARRAY['contato_aerossol']) = 'contato e aerossol' AND private.rotulo_isolamento(ARRAY['reverso']) = 'reverso (protetor)',
  'rótulo dos tipos novos');
-- o paciente marcado no atendimento não sai do isolamento pela regulação
INSERT INTO public.isolamentos_paciente (unidade_id, paciente_id, tipo, motivo, marcado_por)
VALUES ('21000000-0000-4000-8000-0000000009d1', '23000000-0000-4000-8000-0000000009d1', 'aerossol', 'Suspeita de TB', '10000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_isolamento('25000000-0000-4000-8000-0000000009d1', NULL, NULL, NULL)$$,
  'O paciente está marcado em isolamento', 'marca do paciente segura o isolamento do pedido');

-- ── RG3: vagas compatíveis e extras da fila ─────────────────────────────────
SELECT pg_temp.ok((SELECT (l->>'livre')::int = 4 AND (l->>'livre_isolamento')::int = 1 AND (l->>'livre_pressao_negativa')::int = 1
                     FROM jsonb_array_elements(pg_temp.un(public.regulacao_vagas_compativeis('21000000-0000-4000-8000-0000000009d3'),
                       '21000000-0000-4000-8000-0000000009d2')->'leitos') l WHERE l->>'tipo_leito' = 'uti_adulto'),
  'saldo do hospital: 4 livres, 1 de isolamento comum, 1 com pressão negativa');
SELECT pg_temp.ok(pg_temp.un(public.regulacao_vagas_compativeis('21000000-0000-4000-8000-0000000009d3'), '21000000-0000-4000-8000-0000000009d3') IS NULL,
  'a central não aparece como destino');
SELECT pg_temp.ok((public.regulacao_fila_extras('21000000-0000-4000-8000-0000000009d3')->0->>'isolamento_agente') = 'Neutropenia'
              AND (public.regulacao_fila_extras('21000000-0000-4000-8000-0000000009d3')->0->>'origem_municipio') = 'Cidade Um',
  'extras da fila: agente e município da origem');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_fila_extras('21000000-0000-4000-8000-0000000009d3')) = 1, 'gestor da central vê os extras');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_vagas_compativeis('21000000-0000-4000-8000-0000000009d3')$$, 'Acesso negado', 'médico da origem não vê as vagas da central');
SELECT pg_temp.falha($$SELECT public.regulacao_fila_extras('21000000-0000-4000-8000-0000000009d3')$$, 'Acesso negado', 'médico da origem não vê os extras');
SELECT pg_temp.falha($$SELECT public.regulacao_fila_extras('21000000-0000-4000-8000-0000000009d1')$$, 'Esta unidade não é uma central', 'só central');
RESET ROLE;

-- ── trava do leito com os tipos novos ───────────────────────────────────────
UPDATE public.regulacao_solicitacoes SET status = 'autorizada', destino_tipo = 'rede', destino_unidade_id = '21000000-0000-4000-8000-0000000009d2'
 WHERE id = '25000000-0000-4000-8000-0000000009d1';
SELECT pg_temp.falha($$INSERT INTO public.regulacao_destino_respostas (solicitacao_id, destino_tipo, destino_unidade_id, resposta, leito_id, por)
  VALUES ('25000000-0000-4000-8000-0000000009d1', 'rede', '21000000-0000-4000-8000-0000000009d2', 'aceita', '24000000-0000-4000-8000-0000000009d1',
          '10000000-0000-4000-8000-000000000004')$$,
  'A regulação pede isolamento por reverso (protetor)', 'aceite em leito comum recusado com o tipo novo');

ROLLBACK;
