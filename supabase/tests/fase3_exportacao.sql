-- Fase 3, tarefa 9 — migration 20261105000001_exportacao_estruturada.sql:
-- exportação estruturada (CSV/JSON). Cobre:
-- - quem pode (gestor da unidade, super admin; outros papéis não);
-- - período obrigatório e de até 12 meses (leitos, sem período);
-- - máscara por padrão (nome, CPF, CNS, nascimento) e campos do contrato da API;
-- - versão completa: motivo, segundo fator recente e log de acesso por paciente;
-- - lista de documentos sem o texto clínico;
-- - páginas só para quem abriu; conclusão; registro imutável e auditoria.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT '21000000-0000-4000-8000-000000000095', organizacao_id, 'UPA da Exportação', tipo, '7654326', 'Campinas', 'SP'
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000095', '21000000-0000-4000-8000-000000000095', 'PS da Exportação', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000095', 'gestor'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000095', 'enfermeiro');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns, cpf, municipio, uf)
VALUES
  ('23000000-0000-4000-8000-000000000951', '21000000-0000-4000-8000-000000000095', 'Maria da Silva Souza', '1975-03-04', 'E-1',
   '22000000-0000-4000-8000-000000000095', 'F', '798682828807290', '52998224725', 'Campinas', 'SP'),
  ('23000000-0000-4000-8000-000000000952', '21000000-0000-4000-8000-000000000095', 'João Sem Cns', '1990-01-01', 'E-2',
   '22000000-0000-4000-8000-000000000095', 'M', NULL, '11144477735', NULL, NULL);
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, cor_atual, classificado_em,
                              encerrado_em, desfecho, desfecho_em)
VALUES
  ('25000000-0000-4000-8000-000000000951', '21000000-0000-4000-8000-000000000095', '23000000-0000-4000-8000-000000000951',
   '22000000-0000-4000-8000-000000000095', 'encerrado', 'Dor', '10000000-0000-4000-8000-000000000004',
   now() - interval '2 days', 'amarelo', now() - interval '2 days', now() - interval '2 days' + interval '3 hours', 'alta', now() - interval '2 days' + interval '3 hours'),
  ('25000000-0000-4000-8000-000000000952', '21000000-0000-4000-8000-000000000095', '23000000-0000-4000-8000-000000000952',
   '22000000-0000-4000-8000-000000000095', 'atendimento', 'Febre', '10000000-0000-4000-8000-000000000004',
   now() - interval '1 hour', 'verde', now() - interval '1 hour', NULL, NULL, NULL);
INSERT INTO public.documentos_clinicos (id, documento_raiz_id, organizacao_id, unidade_id, paciente_id, episodio_id, tipo_documento,
                                        conteudo, conteudo_hash, autor_id, estado, emitido_em)
SELECT '26000000-0000-4000-8000-000000000951', '26000000-0000-4000-8000-000000000951', u.organizacao_id, u.id,
       '23000000-0000-4000-8000-000000000951', '25000000-0000-4000-8000-000000000951', 'atestado',
       'TEXTO CLÍNICO QUE NÃO PODE SAIR', 'h', '10000000-0000-4000-8000-000000000002', 'ativo', now() - interval '2 days'
  FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000095';

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated',
    'session_id', '29000000-0000-4000-8000-000000000095')::text, true);
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

-- ── 0. máscaras ─────────────────────────────────────────────────────────────
SELECT pg_temp.ok(private.mascarar_nome('Maria da Silva Souza') = 'M. S. S.', 'nome vira iniciais, sem "da"');
SELECT pg_temp.ok(private.mascarar_cpf('529.982.247-25') = '***.982.247-**', 'CPF mostra só os 6 do meio');
SELECT pg_temp.ok(private.mascarar_cns('798682828807290') = '***********7290', 'CNS mostra só os 4 últimos');
SELECT pg_temp.ok(private.mascarar_nome(NULL) IS NULL AND private.mascarar_cpf('123') IS NULL, 'vazio ou inválido sai nulo');

SET LOCAL ROLE authenticated;

-- ── 1. quem pode ────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', current_date - 7, current_date)$$,
  'Exporta o gestor da unidade', 'enfermeiro não exporta');
SELECT pg_temp.falha($$SELECT * FROM public.exportacoes$$, 'permission denied', 'tabela fechada para leitura direta');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'financeiro', 'csv', current_date - 7, current_date)$$,
  'Conjunto inválido', 'conjunto fora da lista');
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'xlsx', current_date - 7, current_date)$$,
  'Formato: csv ou json', 'formato fora da lista');
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', NULL, current_date)$$,
  'Informe o período', 'período obrigatório');
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', current_date, current_date - 1)$$,
  'Informe o período', 'fim antes do início');
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', '2026-01-01', '2027-01-01')$$,
  'O período vai até 12 meses', 'mais de 12 meses recusado');
SELECT pg_temp.ok((public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', '2026-01-01', '2026-12-31')->>'total') IS NOT NULL,
  '12 meses exatos aceitos');

-- ── 2. atendimentos mascarados, no formato da API ───────────────────────────
INSERT INTO t SELECT 'e1', public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'json', current_date - 7, current_date)::text;
SELECT pg_temp.ok((pg_temp.v('e1')::jsonb->>'total')::int = 2, 'total de atendimentos no período');
INSERT INTO t SELECT 'p1', public.exportacao_pagina((pg_temp.v('e1')::jsonb->>'id')::uuid, 0)::text;
SELECT pg_temp.ok(jsonb_array_length(pg_temp.v('p1')::jsonb->'dados') = 2 AND pg_temp.v('p1')::jsonb->'proximo' = 'null'::jsonb,
  'uma página só, sem próxima');
SELECT pg_temp.ok((pg_temp.v('p1')::jsonb->'dados'->0->'paciente'->>'nome') = 'M. S. S.'
              AND (pg_temp.v('p1')::jsonb->'dados'->0->'paciente'->>'cns') = '***********7290',
  'paciente mascarado no atendimento');
SELECT pg_temp.ok(pg_temp.v('p1')::jsonb->'dados'->0 ?& ARRAY['id', 'situacao', 'classificacao', 'cid_principal', 'desfecho', 'chegada_em'],
  'mesmos campos do contrato da API');
SELECT pg_temp.ok((pg_temp.v('p1')::jsonb->'dados'->0->>'situacao') = 'encerrado' AND (pg_temp.v('p1')::jsonb->'dados'->0->>'desfecho') = 'alta',
  'situação e desfecho como na API');
SELECT pg_temp.ok(NOT (pg_temp.v('p1')::text LIKE '%Maria%' OR pg_temp.v('p1')::text LIKE '%52998224725%'),
  'nome e CPF completos não aparecem');

-- página de outra pessoa
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha(format('SELECT public.exportacao_pagina(%L, 0)', pg_temp.v('e1')::jsonb->>'id'),
  'Exportação não encontrada', 'só quem abriu pede as páginas');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.exportacao_concluir((pg_temp.v('e1')::jsonb->>'id')::uuid);
SELECT pg_temp.falha(format('SELECT public.exportacao_pagina(%L, 0)', pg_temp.v('e1')::jsonb->>'id'),
  'Esta exportação já terminou', 'exportação concluída não dá mais páginas');

-- ── 3. cadastro de pacientes mascarado ──────────────────────────────────────
INSERT INTO t SELECT 'e2', public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'pacientes', 'csv', current_date - 7, current_date)::text;
INSERT INTO t SELECT 'p2', public.exportacao_pagina((pg_temp.v('e2')::jsonb->>'id')::uuid, 0)::text;
SELECT pg_temp.ok(jsonb_array_length(pg_temp.v('p2')::jsonb->'dados') = 2, 'dois pacientes (atendidos no período)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('p2')::jsonb->'dados') d
                           WHERE d->>'nome' = 'J. S. C.' AND d->>'cpf' = '***.444.777-**' AND d->>'nascimento' = '1990' AND d->>'cns' IS NULL),
  'sem CNS: CPF mascarado e nascimento só com o ano');
SELECT pg_temp.ok(NOT (pg_temp.v('p2')::text LIKE '%telefone%' OR pg_temp.v('p2')::text LIKE '%nome_mae%'),
  'sem telefone nem nome da mãe (dados mínimos da API)');

-- ── 4. documentos sem o texto clínico ───────────────────────────────────────
INSERT INTO t SELECT 'e3', public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'documentos', 'json', current_date - 7, current_date)::text;
INSERT INTO t SELECT 'p3', public.exportacao_pagina((pg_temp.v('e3')::jsonb->>'id')::uuid, 0)::text;
SELECT pg_temp.ok(jsonb_array_length(pg_temp.v('p3')::jsonb->'dados') = 1
              AND (pg_temp.v('p3')::jsonb->'dados'->0->>'tipo') = 'atestado'
              AND (pg_temp.v('p3')::jsonb->'dados'->0->>'autor') IS NOT NULL,
  'documento listado com tipo e autor');
SELECT pg_temp.ok(pg_temp.v('p3')::text NOT LIKE '%TEXTO CLÍNICO%', 'o texto clínico não sai');

-- ── 5. leitos, sem período ──────────────────────────────────────────────────
INSERT INTO t SELECT 'e4', public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'leitos', 'csv', NULL, NULL)::text;
SELECT pg_temp.ok((pg_temp.v('e4')::jsonb->>'total') IS NOT NULL, 'leitos exportam sem período');

-- ── 6. versão completa ──────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', current_date - 7, current_date, false, 'curto')$$,
  'Para exportar sem máscara, escreva o motivo', 'sem máscara pede motivo');
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', current_date - 7, current_date, false, 'Auditoria do SUS pediu a lista nominal')$$,
  'CONFIRMACAO', 'sem máscara pede o segundo fator');
RESET ROLE;
-- sessão verificada agora, mas pelo dispositivo confiável (sem código): não vale
INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em)
VALUES ('29000000-0000-4000-8000-000000000095', '10000000-0000-4000-8000-000000000001', now());
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', current_date - 7, current_date, false, 'Auditoria do SUS pediu a lista nominal')$$,
  'CONFIRMACAO', 'dispositivo confiável não substitui o código');
RESET ROLE;
UPDATE private.segundo_fator_sessao_ok SET codigo_em = now() - interval '10 minutes' WHERE session_id = '29000000-0000-4000-8000-000000000095';
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha($$SELECT public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', current_date - 7, current_date, false, 'Auditoria do SUS pediu a lista nominal')$$,
  'CONFIRMACAO', 'código de 10 minutos atrás não vale');
RESET ROLE;
UPDATE private.segundo_fator_sessao_ok SET codigo_em = now() WHERE session_id = '29000000-0000-4000-8000-000000000095';
SET LOCAL ROLE authenticated;
INSERT INTO t SELECT 'e5', public.exportacao_iniciar('21000000-0000-4000-8000-000000000095', 'atendimentos', 'csv', current_date - 7, current_date, false, 'Auditoria do SUS pediu a lista nominal')::text;
INSERT INTO t SELECT 'p5', public.exportacao_pagina((pg_temp.v('e5')::jsonb->>'id')::uuid, 0)::text;
SELECT pg_temp.ok(pg_temp.v('p5')::jsonb->'dados'->0->'paciente'->>'nome' = 'Maria da Silva Souza'
              AND pg_temp.v('p5')::jsonb->'dados'->0->'paciente'->>'cns' = '798682828807290',
  'com código recente e motivo: nome e CNS completos');
SELECT public.exportacao_concluir((pg_temp.v('e5')::jsonb->>'id')::uuid);

RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.log_acesso_prontuario
                    WHERE tipo_acesso = 'exportacao' AND unidade_id = '21000000-0000-4000-8000-000000000095'
                      AND acessado_por = '10000000-0000-4000-8000-000000000001') = 2,
  'versão completa: cada paciente entra no log de acesso');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_acesso_prontuario
                    WHERE tipo_acesso = 'exportacao' AND unidade_id = '21000000-0000-4000-8000-000000000095') = 2,
  'versão mascarada não gera log por paciente');
SELECT pg_temp.ok((SELECT linhas = 2 AND concluida_em IS NOT NULL AND motivo LIKE 'Auditoria%' AND NOT mascarado
                     FROM public.exportacoes WHERE id = (pg_temp.v('e5')::jsonb->>'id')::uuid),
  'registro com linhas, motivo e conclusão');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria
                    WHERE acao IN ('exportacao_iniciada', 'exportacao_concluida') AND unidade_id = '21000000-0000-4000-8000-000000000095') >= 7,
  'auditoria registra início e conclusão');
SELECT pg_temp.falha(format('UPDATE public.exportacoes SET motivo = %L WHERE id = %L', 'outro motivo qualquer', pg_temp.v('e5')::jsonb->>'id'),
  'Só o andamento da exportação muda', 'motivo não se altera depois');
SELECT pg_temp.falha(format('DELETE FROM public.exportacoes WHERE id = %L', pg_temp.v('e5')::jsonb->>'id'),
  'Registro de exportação não se apaga', 'registro não se apaga');

-- ── 7. lista na tela ────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok(jsonb_array_length(public.exportacoes_lista('21000000-0000-4000-8000-000000000095')) = 6
              AND (public.exportacoes_lista('21000000-0000-4000-8000-000000000095')->0->>'solicitada_por') IS NOT NULL,
  'gestor vê as exportações da unidade, com quem pediu');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.exportacoes_lista('21000000-0000-4000-8000-000000000095')$$, 'Acesso negado', 'enfermeiro não vê a lista');

ROLLBACK;
