-- Testes da migration 20270323000001_pulseira.sql (lacuna 2 do Portão de
-- 11/10/2026; decisão do RT em 10/11/2026: A em P1–P8).
--  P1. adulto: nome, nome social, nascimento real, prontuário e mãe; sem
--      leito, setor, diagnóstico nem alergia;
--  P2. não identificado: sexo aparente, raça/cor, idade estimada em meses
--      (nunca a data estimada) e sinais;
--  P3. recém-nascido: mãe atual, ordem do gêmeo, nascimento e sexo;
--  P7. a UBS não imprime; a unidade só imprime com usa_pulseira ligada
--      pelo gestor (opcional por unidade, RT 10/11/2026);
--  P8. impressão e reimpressão gravadas em log_acesso_prontuario com o
--      protocolo IMP-; a reimpressão exige o motivo, "outro" exige o texto;
--      quem não atua no paciente não imprime; anon não executa.
-- ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- médico (…0002), enfermeira (…0004) e recepção (…0005) de plantão agora no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.j(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.j(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
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

-- ── cadastros (como superusuário) ──────────────────────────────────────────
-- adulto com nome social, mãe e raça/cor; nascimento real (a ficha abre no PS, abaixo)
INSERT INTO t SELECT 'a', gen_random_uuid();
INSERT INTO public.pacientes (id, unidade_id, nome, nome_social, data_nascimento, sexo, raca_cor, nome_mae, prontuario)
VALUES (pg_temp.u('a'), '21000000-0000-4000-8000-000000000001', 'Maria Aparecida dos Santos Teste', 'Alex Teste',
        '1980-05-04', 'F', 'parda', 'Joana dos Santos Teste', 'PUL.000001');
-- adulto na Clínica Médica, internado em leito (ninguém deste teste está de plantão lá)
INSERT INTO t SELECT 'b', gen_random_uuid();
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id)
VALUES (pg_temp.u('b'), '21000000-0000-4000-8000-000000000001', 'Paciente da Enfermaria Teste', '1950-01-02', 'PUL.000002',
        '22000000-0000-4000-8000-000000000001');
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao)
VALUES ('20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', pg_temp.u('b'), 'internado',
        '22000000-0000-4000-8000-000000000001', now() - interval '2 days');

-- não identificados, pela recepção (registrar_nao_identificado)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ni1', public.registrar_nao_identificado('22000000-0000-4000-8000-000000000003',
  'Trazido inconsciente', 'M', 40, 'SAMU, ocorrência 123; tatuagem de âncora no braço direito, cicatriz no queixo, camiseta azul, tênis branco')
  ->> 'paciente_id';
INSERT INTO t SELECT 'ni2', public.registrar_nao_identificado('22000000-0000-4000-8000-000000000003',
  'Desacordado na via pública') ->> 'paciente_id';
RESET ROLE;
UPDATE public.pacientes SET raca_cor = 'preta' WHERE id = pg_temp.u('ni1');

-- mãe no PS e gêmeos (o RN nasce sem setor), pela recepção (cadastrar_rn)
INSERT INTO t SELECT 'mae', gen_random_uuid();
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, prontuario)
VALUES (pg_temp.u('mae'), '21000000-0000-4000-8000-000000000001', 'Rosa Maria Teste', '1995-03-03', 'F', 'PUL.000003');
-- a recepção abre a ficha da adulta e da mãe no PS (o cuidado na porta pede a ficha aberta)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor abdominal', pg_temp.u('a'), '{}'::jsonb);
SELECT public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Sangramento', pg_temp.u('mae'), '{}'::jsonb);
INSERT INTO t SELECT 'rn2', public.cadastrar_rn(pg_temp.u('mae'), private.data_atual() - 1, 'F', 2::smallint) ->> 'paciente_id';
RESET ROLE;

-- ── a pulseira é opcional por unidade (RT, 10/11/2026): desligada por padrão ──
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L)', pg_temp.u('a')),
  'Esta unidade não usa pulseira de identificação', 'unidade sem pulseira não imprime');
SELECT pg_temp.falha($$SELECT public.definir_pulseira_unidade('21000000-0000-4000-8000-000000000001', true)$$,
  'Quem liga a pulseira da unidade é o gestor', 'só o gestor liga a pulseira');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.definir_pulseira_unidade('21000000-0000-4000-8000-000000000001', true);
RESET ROLE;
DO $$ BEGIN
  IF NOT (SELECT usa_pulseira FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001')
     OR NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'pulseira_unidade_definida') THEN
    RAISE EXCEPTION 'FALHOU: gestor liga a pulseira, com auditoria';
  END IF;
  RAISE NOTICE 'OK  gestor liga a pulseira da unidade, com auditoria';
END $$;

-- ── P1. adulto ──────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ra', public.registrar_impressao_pulseira(pg_temp.u('a'))::text;
SELECT pg_temp.ok((SELECT r ->> 'protocolo' ~ '^IMP-[0-9A-F]{10}$' AND (r ->> 'emitido_em') IS NOT NULL
                          AND NOT (r ->> 'reimpressao')::boolean
                     FROM (SELECT pg_temp.j('ra') r) x),
  'P8: a recepção imprime e recebe o protocolo IMP-');
SELECT pg_temp.ok((SELECT p ->> 'nome' = 'Maria Aparecida dos Santos Teste' AND p ->> 'nome_social' = 'Alex Teste'
                          AND p ->> 'data_nascimento' = '1980-05-04' AND p ->> 'prontuario' = 'PUL.000001'
                          AND p ->> 'nome_mae' = 'Joana dos Santos Teste' AND p -> 'idade_estimada_meses' = 'null'::jsonb
                          AND NOT (p ->> 'identidade_desconhecida')::boolean AND NOT (p ->> 'rn')::boolean
                     FROM (SELECT pg_temp.j('ra') -> 'pulseira' p) x),
  'P1: nome completo, nome social, nascimento real, prontuário e mãe');
SELECT pg_temp.ok((SELECT array_agg(k ORDER BY k COLLATE "C") = ARRAY['data_nascimento', 'idade_estimada_meses', 'identidade_desconhecida',
                            'nome', 'nome_mae', 'nome_social', 'prontuario', 'raca_cor', 'rn', 'rn_ordem',
                            'sexo', 'sinais_identificacao']
                     FROM jsonb_object_keys(pg_temp.j('ra') -> 'pulseira') k),
  'P1/P5: só os campos da pulseira (sem leito, setor, diagnóstico, alergia ou risco)');
SELECT pg_temp.ok((SELECT pg_temp.j('ra') -> 'pulseira' -> 'sinais_identificacao' = 'null'::jsonb),
  'P1: sinais só no não identificado');

-- o médico do PS reimprime; sem motivo, recusa
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L, true)', pg_temp.u('a')),
  'Informe o motivo da reimpressão', 'P8: reimpressão sem motivo é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L, true, %L)', pg_temp.u('a'), 'perdeu'),
  'Motivo da reimpressão: caiu, ilegível', 'P8: motivo fora da lista é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L, true, %L)', pg_temp.u('a'), 'outro'),
  'Motivo "outro": escreva qual é', 'P8: "outro" sem texto é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L, true, %L, %L)', pg_temp.u('a'), 'outro', ' a  '),
  'Motivo "outro": escreva qual é', 'P8: "outro" com texto curto é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L, true, %L, %L)', pg_temp.u('a'), 'outro', repeat('x', 201)),
  'Motivo "outro": no máximo 200 letras', 'P8: "outro" com mais de 200 letras é recusado');
INSERT INTO t SELECT 'rr1', public.registrar_impressao_pulseira(pg_temp.u('a'), true, 'caiu', 'texto ignorado')::text;
INSERT INTO t SELECT 'rr2', public.registrar_impressao_pulseira(pg_temp.u('a'), true, 'outro', '  pulseira   rasgou no banho ')::text;
SELECT pg_temp.ok((SELECT (pg_temp.j('rr1') ->> 'reimpressao')::boolean AND pg_temp.j('rr1') ->> 'protocolo' <> pg_temp.j('ra') ->> 'protocolo'
                          AND pg_temp.j('rr1') -> 'pulseira' = pg_temp.j('ra') -> 'pulseira'),
  'P8: a reimpressão tem protocolo próprio e os mesmos dados');
RESET ROLE;

-- o registro: mesma linha de registrar_impressao, com quem e quando, sem dado de pessoa
SELECT pg_temp.ok((SELECT count(*) = 3 FROM public.log_acesso_prontuario l
                    WHERE l.paciente_id = pg_temp.u('a') AND l.tipo_acesso = 'impressao'),
  'P8: as três impressões entram em log_acesso_prontuario');
SELECT pg_temp.ok((SELECT l.documento_tipo = 'Pulseira' AND l.acessado_por = '10000000-0000-4000-8000-000000000005'
                          AND l.papel = 'recepcao' AND l.internacao_id IS NULL AND l.created_at IS NOT NULL
                          AND 'IMP-' || upper(left(replace(l.id::text, '-', ''), 10)) = pg_temp.j('ra') ->> 'protocolo'
                     FROM public.log_acesso_prontuario l
                     JOIN public.impressoes_pulseira i ON i.acesso_id = l.id
                    WHERE l.paciente_id = pg_temp.u('a') AND NOT i.reimpressao),
  'P8: impressão com o protocolo, o login (recepção) e a hora');
SELECT pg_temp.ok((SELECT l.documento_tipo = 'Pulseira (reimpressão: caiu)' AND l.acessado_por = '10000000-0000-4000-8000-000000000002'
                          AND i.motivo = 'caiu' AND i.detalhe IS NULL AND i.impresso_por = l.acessado_por AND i.impresso_em = l.created_at
                     FROM public.log_acesso_prontuario l JOIN public.impressoes_pulseira i ON i.acesso_id = l.id
                    WHERE 'IMP-' || upper(left(replace(l.id::text, '-', ''), 10)) = pg_temp.j('rr1') ->> 'protocolo'),
  'P8: reimpressão com o motivo (o texto só vale para "outro")');
SELECT pg_temp.ok((SELECT i.motivo = 'outro' AND i.detalhe = 'pulseira rasgou no banho' AND l.documento_tipo = 'Pulseira (reimpressão: outro)'
                     FROM public.log_acesso_prontuario l JOIN public.impressoes_pulseira i ON i.acesso_id = l.id
                    WHERE 'IMP-' || upper(left(replace(l.id::text, '-', ''), 10)) = pg_temp.j('rr2') ->> 'protocolo'),
  'P8: "outro" guarda o texto na tabela da pulseira, fora do registro de acesso');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.log_acesso_prontuario l
                    WHERE l.paciente_id IN (pg_temp.u('a'), pg_temp.u('ni1'), pg_temp.u('rn2'))
                      AND (l.documento_tipo LIKE '%Teste%' OR l.documento_tipo LIKE '%PUL.%' OR l.documento_tipo LIKE '%banho%')),
  'P8: o registro de acesso não traz nome, prontuário nem o texto do motivo');
SELECT pg_temp.falha(format('UPDATE public.impressoes_pulseira SET motivo = %L WHERE paciente_id = %L', 'ilegivel', pg_temp.u('a')),
  'impressoes_pulseira é só-inserção', 'P8: o motivo não se altera depois');

-- ── P2. não identificado ────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'rni1', (public.registrar_impressao_pulseira(pg_temp.u('ni1')) -> 'pulseira')::text;
INSERT INTO t SELECT 'rni2', (public.registrar_impressao_pulseira(pg_temp.u('ni2')) -> 'pulseira')::text;
RESET ROLE;
SELECT pg_temp.ok((SELECT p ->> 'nome' = 'Não identificado ' || pa.prontuario AND p ->> 'prontuario' = pa.prontuario
                          AND (p ->> 'identidade_desconhecida')::boolean AND p ->> 'sexo' = 'M' AND p ->> 'raca_cor' = 'preta'
                          AND p -> 'data_nascimento' = 'null'::jsonb AND (p ->> 'idade_estimada_meses')::int = 480
                          AND p ->> 'sinais_identificacao' LIKE 'SAMU, ocorrência 123;%'
                     FROM (SELECT pg_temp.j('rni1') p) x JOIN public.pacientes pa ON pa.id = pg_temp.u('ni1')),
  'P2: nome provisório, prontuário, sexo aparente, raça/cor, idade estimada (480 meses) e sinais; a data estimada não sai');
SELECT pg_temp.ok((SELECT p -> 'data_nascimento' = 'null'::jsonb AND p -> 'idade_estimada_meses' = 'null'::jsonb
                          AND p -> 'sexo' = 'null'::jsonb AND p -> 'raca_cor' = 'null'::jsonb AND p -> 'sinais_identificacao' = 'null'::jsonb
                     FROM (SELECT pg_temp.j('rni2') p) x),
  'P2: sem idade, sexo, raça/cor ou sinais, nada é inventado');

-- depois de identificar: a data real substitui a estimativa; a reimpressão leva o motivo
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.identificar_paciente(pg_temp.u('ni1'), '{"nome": "João Identificado Pulseira", "data_nascimento": "1985-01-02"}');
INSERT INTO t SELECT 'rid', public.registrar_impressao_pulseira(pg_temp.u('ni1'), true, 'paciente_identificado')::text;
RESET ROLE;
SELECT pg_temp.ok((SELECT p ->> 'nome' = 'João Identificado Pulseira' AND p ->> 'data_nascimento' = '1985-01-02'
                          AND p -> 'idade_estimada_meses' = 'null'::jsonb AND NOT (p ->> 'identidade_desconhecida')::boolean
                          AND p -> 'sinais_identificacao' = 'null'::jsonb
                     FROM (SELECT pg_temp.j('rid') -> 'pulseira' p) x),
  'P2: identificado, a nova pulseira sai com o nome e a data real, sem sinais');
SELECT pg_temp.ok((SELECT i.motivo = 'paciente_identificado' FROM public.impressoes_pulseira i JOIN public.log_acesso_prontuario l ON l.id = i.acesso_id
                    WHERE 'IMP-' || upper(left(replace(l.id::text, '-', ''), 10)) = pg_temp.j('rid') ->> 'protocolo'),
  'P8: reimpressão por paciente identificado registrada');

-- ── P3. recém-nascido ───────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'rrn', (public.registrar_impressao_pulseira(pg_temp.u('rn2')) -> 'pulseira')::text;
RESET ROLE;
SELECT pg_temp.ok((SELECT (p ->> 'rn')::boolean AND (p ->> 'rn_ordem')::int = 2 AND p ->> 'nome_mae' = 'Rosa Maria Teste'
                          AND p ->> 'nome' = 'RN 2 de Rosa Maria Teste' AND p ->> 'sexo' = 'F'
                          AND (p ->> 'data_nascimento')::date = private.data_atual() - 1 AND p ->> 'prontuario' = pa.prontuario
                     FROM (SELECT pg_temp.j('rrn') p) x JOIN public.pacientes pa ON pa.id = pg_temp.u('rn2')),
  'P3: RN com a mãe, a ordem do gêmeo, prontuário próprio, nascimento e sexo');
-- a enfermagem que cuida da mãe imprime a do RN (que nasceu sem setor)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.ok((public.registrar_impressao_pulseira(pg_temp.u('rn2')) -> 'pulseira' ->> 'rn')::boolean,
  'permissão: quem atua na mãe imprime a pulseira do RN');
RESET ROLE;
-- a mãe é identificada depois: o RN mostra o nome atual dela
UPDATE public.pacientes SET nome = 'Rosa Maria Atual Teste' WHERE id = pg_temp.u('mae');
SELECT pg_temp.ok((private.dados_pulseira(pg_temp.u('rn2')) ->> 'nome_mae') = 'Rosa Maria Atual Teste',
  'P3: o RN leva o nome atual da mãe');
-- passados 27 dias, a pulseira é a comum (sem ordem de gêmeo)
UPDATE public.pacientes SET data_nascimento = private.data_atual() - 40 WHERE id = pg_temp.u('rn2');
SELECT pg_temp.ok((SELECT NOT (p ->> 'rn')::boolean AND p -> 'rn_ordem' = 'null'::jsonb FROM (SELECT private.dados_pulseira(pg_temp.u('rn2')) p) x),
  'P3: depois de 27 dias de vida, pulseira comum');

-- ── permissão ───────────────────────────────────────────────────────────────
-- o teleconsultor não está de plantão nem é recepção
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L)', pg_temp.u('a')),
  'Acesso negado: paciente fora do seu plantão', 'permissão: sem plantão no setor, não imprime');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L)', pg_temp.u('rn2')),
  'Acesso negado: paciente fora do seu plantão', 'permissão: sem plantão, não imprime a do RN');
-- a enfermeira do PS não atua no paciente da Clínica Médica
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L)', pg_temp.u('b')),
  'Acesso negado: paciente fora do seu plantão', 'permissão: enfermagem de outro setor não imprime');
-- a recepção de plantão na unidade imprime (pulseira que caiu na enfermaria)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.ok((public.registrar_impressao_pulseira(pg_temp.u('b'), true, 'caiu') -> 'pulseira' ->> 'prontuario') = 'PUL.000002',
  'permissão: a recepção de plantão na unidade reimprime');
-- o gestor imprime
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok((public.registrar_impressao_pulseira(pg_temp.u('b')) ->> 'protocolo') LIKE 'IMP-%',
  'permissão: o gestor imprime');
-- a tabela do motivo: o gestor lê tudo; a recepção, só o que imprimiu; o teleconsultor, nada
SELECT pg_temp.ok((SELECT count(*) >= 4 FROM public.impressoes_pulseira WHERE paciente_id = pg_temp.u('a') OR paciente_id = pg_temp.u('b')),
  'RLS: o gestor lê os motivos');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.ok((SELECT bool_and(impresso_por = '10000000-0000-4000-8000-000000000005') AND count(*) > 0 FROM public.impressoes_pulseira),
  'RLS: a recepção lê só o que imprimiu');
SELECT pg_temp.falha(format('INSERT INTO public.impressoes_pulseira (acesso_id, paciente_id, unidade_id, impresso_por, reimpressao) VALUES (gen_random_uuid(), %L, %L, %L, false)',
  pg_temp.u('a'), '21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005'),
  'permission denied', 'RLS: authenticated não grava direto');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.impressoes_pulseira), 'RLS: o teleconsultor não lê nada');
RESET ROLE;

-- ── P7. a UBS não imprime ───────────────────────────────────────────────────
UPDATE public.unidades SET tipo = 'ubs' WHERE id = '21000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_pulseira(%L)', pg_temp.u('a')),
  'A UBS não usa pulseira de identificação', 'P7: na UBS a impressão é recusada');
RESET ROLE;
UPDATE public.unidades SET tipo = 'hospital' WHERE id = '21000000-0000-4000-8000-000000000001';

-- ── privilégios ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.registrar_impressao_pulseira(uuid, boolean, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon executa';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.registrar_impressao_pulseira(uuid, boolean, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated sem EXECUTE';
  END IF;
  IF has_function_privilege('authenticated', 'private.dados_pulseira(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.pode_imprimir_pulseira(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated executa as funções privadas';
  END IF;
  IF has_table_privilege('anon', 'public.impressoes_pulseira', 'SELECT')
     OR has_table_privilege('authenticated', 'public.impressoes_pulseira', 'INSERT')
     OR has_table_privilege('authenticated', 'public.impressoes_pulseira', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.impressoes_pulseira', 'DELETE')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.impressoes_pulseira'::regclass) THEN
    RAISE EXCEPTION 'FALHOU: privilégios ou RLS da tabela da pulseira';
  END IF;
  RAISE NOTICE 'OK  privilégios';
END $$;
ROLLBACK;
