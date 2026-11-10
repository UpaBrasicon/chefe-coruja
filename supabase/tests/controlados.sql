-- Testes da migration 20270324000001_controlados.sql (lacuna 3 do Portão de
-- 11/10/2026; decisão do RT em 10/11/2026: A em C1 a C6).
--  C2. o catálogo é marcado pela tabela de substâncias da RDC 1.036/2026:
--      gatilho no cadastro (haloperidol C1, midazolam B1, sal/éster pelo nome
--      inteiro), remarcação do catálogo (backfill), ninguém grava a marca à
--      mão; prometazina (excetuada pelo adendo 10 da C1) e dipirona sem marca;
--      só o super admin define ou retira substância, com auditoria sem dado
--      de pessoa, e o catálogo se remarca; a linha não se apaga;
--  C5. o controlado só é "feito" com a liberação da farmácia ou com
--      justificativa (e entra na lista do farmacêutico), como a alta
--      vigilância; midazolam EV (controlado e alta vigilância) passa por uma
--      liberação só; a unidade desmarca a alta vigilância, mas não o controle;
--      a fila de validação põe o controlado na frente;
--  telas: liberacao_farmacia e controle_dos_itens dizem a lista;
--  privilégios: anon não lê nem executa; authenticated só lê a tabela.
-- O farmacêutico é o perfil …0006 (o seed não tem farmacêutico; o teste o
-- vincula, como em fase2_liberacao_farmacia.sql) e o super admin é o …0003.
-- ROLLBACK no fim.
BEGIN;
-- Portão 2, tarefa 2: medicamento exige peso deste atendimento
CREATE FUNCTION pg_temp.pesar() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
  SELECT p.unidade_id, p.id, c.id, now(), 70, 'manual'
    FROM public.pacientes p JOIN public.conceito c ON c.nome = 'peso' AND c.unidade_id IS NULL
   WHERE private.peso_do_atendimento(p.id) IS NULL $$;
GRANT EXECUTE ON FUNCTION pg_temp.pesar() TO authenticated;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
-- farmacêutico (…0006) e super admin (…0003)
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico')
ON CONFLICT DO NOTHING;
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
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
CREATE FUNCTION pg_temp.lista(p text) RETURNS text LANGUAGE sql AS $$
  SELECT controlado_lista FROM public.medicamento WHERE id = pg_temp.u(p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.lista(text) TO authenticated;

-- ── C2: o gatilho marca o cadastro ─────────────────────────────────────────
WITH novos AS (
  INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, fonte) VALUES
    ('Haloperidol', 'haloperidol', 'solução injetável, ampola 1 mL (teste controlados)', '5 mg/mL', 'teste-controlados'),
    ('Midazolam', 'midazolam', 'solução injetável, ampola 3 mL (teste controlados)', '5 mg/mL', 'teste-controlados'),
    ('Dipirona', 'dipirona', 'comprimido (teste controlados)', '500 mg', 'teste-controlados'),
    ('Decanoato de haloperidol', 'decanoato de haloperidol', 'solução injetável (teste controlados)', '50 mg/mL', 'teste-controlados'),
    ('Prometazina', 'prometazina', 'solução injetável (teste controlados)', '25 mg/mL', 'teste-controlados'),
    ('Clorpromazina', 'clorpromazina', 'comprimido (teste controlados)', '25 mg', 'teste-controlados')
  RETURNING id, principio_ativo_norm)
INSERT INTO t SELECT replace(principio_ativo_norm, ' ', '_'), id::text FROM novos;

SELECT pg_temp.ok(pg_temp.lista('haloperidol') = 'C1'
  AND (SELECT controlado_substancia = 'Haloperidol' AND controlado_receita = 'controle_especial' FROM public.medicamento WHERE id = pg_temp.u('haloperidol')),
  'gatilho: haloperidol na lista C1 (item 83), Receita de Controle Especial');
SELECT pg_temp.ok(pg_temp.lista('midazolam') = 'B1'
  AND (SELECT controlado_receita = 'notificacao_b' FROM public.medicamento WHERE id = pg_temp.u('midazolam')),
  'gatilho: midazolam na lista B1 (item 64), Notificação de Receita B');
SELECT pg_temp.ok(pg_temp.lista('decanoato_de_haloperidol') = 'C1', 'gatilho: éster (decanoato de haloperidol) casa pelo nome inteiro');
SELECT pg_temp.ok(pg_temp.lista('dipirona') IS NULL AND pg_temp.lista('prometazina') IS NULL AND pg_temp.lista('clorpromazina') IS NULL,
  'gatilho: dipirona, prometazina (excetuada) e clorpromazina (fora da tabela) sem marca');
SELECT pg_temp.ok((SELECT controlado_lista FROM public.medicamento WHERE id = pg_temp.u('haloperidol')) = 'C1'
  AND (SELECT count(*) FROM public.substancias_controladas WHERE vigente) >= 25,
  'tabela: 25 substâncias da RDC 1.036/2026 vigentes');

-- ── C2: remarcação do catálogo (backfill) ──────────────────────────────────
ALTER TABLE public.medicamento DISABLE TRIGGER medicamento_marca_controlado;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, fonte)
VALUES ('Diazepam', 'diazepam', 'comprimido (teste controlados)', '10 mg', 'teste-controlados');
INSERT INTO t SELECT 'diazepam', id::text FROM public.medicamento WHERE fonte = 'teste-controlados' AND principio_ativo_norm = 'diazepam';
UPDATE public.medicamento SET controlado_lista = NULL, controlado_substancia = NULL, controlado_receita = NULL WHERE id = pg_temp.u('haloperidol');
ALTER TABLE public.medicamento ENABLE TRIGGER medicamento_marca_controlado;
SELECT pg_temp.ok(pg_temp.lista('diazepam') IS NULL AND pg_temp.lista('haloperidol') IS NULL, 'antes da remarcação: sem marca');
INSERT INTO t SELECT 'remarcados', private.remarcar_controlados()::text;
SELECT pg_temp.ok((SELECT valor::int FROM t WHERE nome = 'remarcados') >= 2 AND pg_temp.lista('diazepam') = 'B1' AND pg_temp.lista('haloperidol') = 'C1',
  'remarcação: diazepam B1 e haloperidol C1 de volta');
SELECT pg_temp.ok(private.remarcar_controlados() = 0, 'remarcação de novo não muda nada');

-- ninguém grava a marca à mão: o gatilho recalcula
UPDATE public.medicamento SET controlado_lista = NULL WHERE id = pg_temp.u('haloperidol');
UPDATE public.medicamento SET controlado_lista = 'C1' WHERE id = pg_temp.u('dipirona');
SELECT pg_temp.ok(pg_temp.lista('haloperidol') = 'C1' AND pg_temp.lista('dipirona') IS NULL, 'a marca gravada à mão não fica');

-- ── C2: a unidade não desmarca; só o super admin muda a tabela ─────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');   -- gestor
DO $$ BEGIN
  UPDATE public.medicamento SET controlado_lista = NULL WHERE id = pg_temp.u('haloperidol');
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
SELECT pg_temp.ok(pg_temp.lista('haloperidol') = 'C1', 'gestor não desmarca o controlado no catálogo');
SELECT pg_temp.falha(format('SELECT public.retirar_substancia_controlada(%L, %L, %L)',
  (SELECT id FROM public.substancias_controladas WHERE chave = 'haloperidol' AND vigente), 'RDC de teste 01/01/2027', 'Unidade quer desmarcar'),
  'Só o super admin', 'gestor não retira substância');
SELECT pg_temp.falha($q$SELECT public.definir_substancia_controlada('Clorpromazina', 'C1', 40, 'RDC ANVISA nº 1.036, de 09/07/2026')$q$,
  'Só o super admin', 'gestor não define substância');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');   -- farmacêutico
SELECT pg_temp.falha($q$SELECT public.definir_substancia_controlada('Clorpromazina', 'C1', 40, 'RDC ANVISA nº 1.036, de 09/07/2026')$q$,
  'Só o super admin', 'farmacêutico não define substância');
SELECT pg_temp.falha($q$INSERT INTO public.substancias_controladas (substancia, chave, lista, item, receita, rdc)
  VALUES ('Clorpromazina', 'clorpromazina', 'C1', 40, 'controle_especial', 'RDC de teste 01/01/2027')$q$,
  'permission denied', 'authenticated não grava direto na tabela');
SELECT pg_temp.falha($q$UPDATE public.substancias_controladas SET lista = 'C5' WHERE chave = 'haloperidol'$q$,
  'permission denied', 'authenticated não altera a tabela');
SELECT pg_temp.ok((SELECT count(*) FROM public.substancias_controladas WHERE chave = 'midazolam') = 1, 'authenticated lê a tabela');

-- super admin: nova substância (clorpromazina, C1 item 40 da RDC) remarca o catálogo
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha($q$SELECT public.definir_substancia_controlada('Clorpromazina', 'C9', 40, 'RDC ANVISA nº 1.036, de 09/07/2026')$q$,
  'Lista inválida', 'lista fora da Portaria é recusada');
SELECT pg_temp.falha($q$SELECT public.definir_substancia_controlada('Clorpromazina', 'C1', 40, 'RDC')$q$,
  'Informe a RDC', 'RDC sem número e data é recusada');
INSERT INTO t SELECT 'def', public.definir_substancia_controlada('Clorpromazina', 'C1', 40, 'RDC ANVISA nº 1.036, de 09/07/2026',
  ARRAY['Cloridrato de clorpromazina'])::text;
RESET ROLE;
SELECT pg_temp.ok(pg_temp.lista('clorpromazina') = 'C1' AND (pg_temp.j('def') ->> 'remarcados')::int >= 1
  AND (SELECT receita FROM public.substancias_controladas WHERE id = (pg_temp.j('def') ->> 'id')::uuid) = 'controle_especial',
  'super admin define substância: o catálogo se remarca, receita pela lista');
SELECT pg_temp.ok((SELECT a.payload ?& ARRAY['tipo', 'quantidade'] AND NOT (a.payload ?| ARRAY['substancia', 'nome', 'paciente'])
                     FROM public.log_auditoria a
                    WHERE a.acao = 'definir_substancia_controlada' AND a.entidade_id = (pg_temp.j('def') ->> 'id')::uuid),
  'auditoria da definição, sem dado de pessoa');

-- super admin redefine o haloperidol: a linha antiga sai para o histórico
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.definir_substancia_controlada('Haloperidol', 'C1', 83, 'RDC ANVISA nº 1.036, de 09/07/2026', NULL, NULL, NULL);
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FILTER (WHERE vigente) = 1 AND count(*) FILTER (WHERE NOT vigente) = 1
                     FROM public.substancias_controladas WHERE chave = 'haloperidol') AND pg_temp.lista('haloperidol') = 'C1',
  'redefinir guarda a linha antiga no histórico e mantém a marca');

-- super admin retira a clorpromazina: o catálogo se desmarca
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha(format('SELECT public.retirar_substancia_controlada(%L, %L, %L)', (pg_temp.j('def') ->> 'id'), 'RDC de teste 01/01/2027', 'curto'),
  'Escreva o motivo', 'retirar pede motivo');
SELECT public.retirar_substancia_controlada((pg_temp.j('def') ->> 'id')::uuid, 'RDC de teste 01/01/2027', 'Teste: retirada da lista C1');
SELECT pg_temp.falha(format('SELECT public.retirar_substancia_controlada(%L, %L, %L)', (pg_temp.j('def') ->> 'id'), 'RDC de teste 01/01/2027', 'Teste: retirada de novo'),
  'Substância não encontrada ou já retirada', 'não retira duas vezes');
RESET ROLE;
SELECT pg_temp.ok(pg_temp.lista('clorpromazina') IS NULL
  AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'retirar_substancia_controlada' AND entidade_id = (pg_temp.j('def') ->> 'id')::uuid),
  'retirada: catálogo desmarcado e auditado');
SELECT pg_temp.falha($q$DELETE FROM public.substancias_controladas WHERE chave = 'clorpromazina'$q$,
  'Substância controlada não se apaga', 'a linha não se apaga nem pelo dono do banco');
SELECT pg_temp.falha($q$UPDATE public.substancias_controladas SET item = 84 WHERE chave = 'haloperidol' AND vigente$q$,
  'Substância controlada não se reescreve', 'a linha não se reescreve');

-- o cadastro local da farmácia (20270106000001) também é marcado; o sal casa pelo nome
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'local', public.cadastrar_medicamento('21000000-0000-4000-8000-000000000001',
  '{"principio_ativo":"Cloridrato de tramadol","apresentacao":"Cápsula 50 mg (teste controlados)","forma_farmaceutica":"capsula","unidade_consumo":"capsula"}'::jsonb) ->> 'id';
RESET ROLE;
SELECT pg_temp.ok((SELECT controlado_lista = 'A2' AND controlado_receita = 'controle_especial' FROM public.medicamento WHERE id = pg_temp.u('local')),
  'cadastro local: cloridrato de tramadol na lista A2, Receita de Controle Especial (adendo 3)');

-- ── C5: liberação da farmácia antes de administrar ─────────────────────────
-- o fluxograma é lido antes de trocar de papel (a leitura dele segue o protocolo em uso na unidade)
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Agitação', NULL,
  '{"nome":"Controlados Teste","data_nascimento":"1975-04-04"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":98,"frequencia-respiratoria":18,"temperatura":36.8,"saturacao-o2":97,"escala-dor":2,"pressao-arterial-sistolica":132,"pressao-arterial-diastolica":84}',
  pg_temp.u('flx'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.pesar();
-- a dipirona é prescrita antes: na fila de validação o controlado passa na frente
INSERT INTO t SELECT 'i_dip', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('dipirona'),
  'dose', '1 comprimido', 'via', 'VO', 'posologia', '6/6h')::jsonb);
INSERT INTO t SELECT 'i_hal', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('haloperidol'),
  'dose', '5 mg', 'via', 'IM', 'posologia', '6/6h')::jsonb);
INSERT INTO t SELECT 'i_mid', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('midazolam'),
  'dose', '5 mg', 'via', 'EV', 'posologia', '6/6h')::jsonb);

-- enfermagem: sem liberação e sem justificativa, o controlado não é "feito"
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('i_hal'), 'feito'),
  'Medicamento controlado sem liberação da farmácia', 'controlado sem liberação pede justificativa');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, NULL, %L)', pg_temp.u('i_hal'), 'feito', 'curta'),
  'Medicamento controlado sem liberação da farmácia', 'justificativa curta é recusada');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('i_mid'), 'feito'),
  'Alta vigilância sem liberação da farmácia', 'midazolam EV (controlado e alta vigilância) sem liberação pede justificativa');
SELECT public.checar(pg_temp.u('i_dip'), 'feito');
-- a Checagem e as telas sabem a lista
INSERT INTO t SELECT 'lib', public.liberacao_farmacia(ARRAY[pg_temp.u('i_dip'), pg_temp.u('i_hal'), pg_temp.u('i_mid')])::text;
INSERT INTO t SELECT 'ctl', public.controle_dos_itens(ARRAY[pg_temp.u('i_dip'), pg_temp.u('i_hal'), pg_temp.u('i_mid')])::text;
-- sem farmacêutico de plantão: administra com justificativa e fica para conferir
INSERT INTO t SELECT 'adm_hal', public.checar(pg_temp.u('i_hal'), 'feito', NULL, 'Sem farmacêutico de plantão na madrugada')::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'pend', public.administracoes_sem_liberacao('21000000-0000-4000-8000-000000000001')::text;
INSERT INTO t SELECT 'fila', (SELECT string_agg(f.item_id::text, ',' ORDER BY f.ord) FROM (
  SELECT q.item_id, row_number() OVER () AS ord FROM public.fila_validacao('21000000-0000-4000-8000-000000000001') q
   WHERE q.item_id IN (pg_temp.u('i_dip'), pg_temp.u('i_hal'))) f);
-- uma liberação só para o midazolam EV
SELECT public.validar_item(pg_temp.u('i_mid'), true);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'adm_mid', public.checar(pg_temp.u('i_mid'), 'feito')::text;
RESET ROLE;

SELECT pg_temp.ok(jsonb_array_length(pg_temp.j('lib')) = 2
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('lib')) e
               WHERE e ->> 'item_id' = pg_temp.u('i_hal')::text AND e ->> 'controlado' = 'C1' AND (e ->> 'alta_vigilancia')::boolean IS FALSE
                 AND e ->> 'regra' LIKE 'Medicamento controlado, lista C1%')
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('lib')) e
               WHERE e ->> 'item_id' = pg_temp.u('i_mid')::text AND e ->> 'controlado' = 'B1' AND (e ->> 'alta_vigilancia')::boolean),
  'liberacao_farmacia: haloperidol (C1) e midazolam (B1 e alta vigilância); dipirona fora');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.j('ctl')) = 2
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('ctl')) e WHERE e ->> 'item_id' = pg_temp.u('i_hal')::text AND e ->> 'lista' = 'C1'),
  'controle_dos_itens: a lista dos itens controlados');
SELECT pg_temp.ok((SELECT sem_liberacao FROM public.administracoes WHERE id = (SELECT valor::uuid FROM t WHERE nome = 'adm_hal'))
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('pend')) e WHERE e ->> 'item_id' = pg_temp.u('i_hal')::text),
  'controlado com justificativa: marcado e na lista do farmacêutico');
SELECT pg_temp.ok(NOT (SELECT sem_liberacao FROM public.administracoes WHERE id = (SELECT valor::uuid FROM t WHERE nome = 'adm_mid')),
  'midazolam EV: uma liberação da farmácia basta');
SELECT pg_temp.ok((SELECT valor FROM t WHERE nome = 'fila') = pg_temp.u('i_hal')::text || ',' || pg_temp.u('i_dip')::text,
  'fila de validação: controlado na frente da dipirona prescrita antes');

-- a unidade desmarca a alta vigilância do midazolam, mas o controle continua
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.definir_alta_vigilancia('21000000-0000-4000-8000-000000000001', pg_temp.u('midazolam'), false, 'Teste: unidade desmarca a alta vigilância');
RESET ROLE;
SELECT pg_temp.ok(NOT private.exige_dupla_checagem('21000000-0000-4000-8000-000000000001', pg_temp.u('midazolam'))
  AND private.exige_liberacao_farmacia('21000000-0000-4000-8000-000000000001', pg_temp.u('midazolam')),
  'sem a alta vigilância da unidade, o midazolam controlado ainda exige liberação');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.validar_item(pg_temp.u('i_hal'), false, 'Dose acima do protocolo da unidade');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('i_hal'), 'feito'),
  'Medicamento controlado sem liberação da farmácia', 'controlado devolvido deixa de estar liberado');
RESET ROLE;

-- ── privilégios ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.definir_substancia_controlada(text, text, integer, text, text[], text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.retirar_substancia_controlada(uuid, text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.controle_dos_itens(uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'private.exige_liberacao_farmacia(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon executa';
  END IF;
  IF has_function_privilege('authenticated', 'private.remarcar_controlados()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated remarca o catálogo direto';
  END IF;
  IF has_table_privilege('anon', 'public.substancias_controladas', 'SELECT')
     OR has_table_privilege('authenticated', 'public.substancias_controladas', 'INSERT')
     OR has_table_privilege('authenticated', 'public.substancias_controladas', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.substancias_controladas', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.substancias_controladas', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: privilégios da tabela';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.substancias_controladas'::regclass) THEN
    RAISE EXCEPTION 'FALHOU: tabela sem RLS';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE (n.nspname, p.proname) IN (('public', 'definir_substancia_controlada'), ('public', 'retirar_substancia_controlada'),
                                               ('public', 'controle_dos_itens'), ('private', 'exige_liberacao_farmacia'))
                AND (NOT p.prosecdef OR NOT (p.proconfig @> ARRAY['search_path=""']))) THEN
    RAISE EXCEPTION 'FALHOU: RPC sem SECURITY DEFINER ou search_path vazio';
  END IF;
  RAISE NOTICE 'OK  anon fora; authenticated só lê a tabela; RLS ligada; RPCs com search_path vazio';
END $$;
ROLLBACK;
