-- Testes da migration 20261005000003_documentos_estados.sql. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_documentos_estados.sql
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002']::uuid[]) s,
     unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.v(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.v(text) TO authenticated;
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

-- paciente atendido e em observação (leito do plantonista)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Estados Documento Teste","data_nascimento":"1970-03-03"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
SELECT public.registrar_soap(pg_temp.u('ep'), 'dor', 'exame', 'avaliação', 'plano', 'R52');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'observacao');
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO t SELECT 'int', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('ep');
INSERT INTO t SELECT 'uni', unidade_id::text FROM public.pacientes WHERE id = pg_temp.u('pac');

-- ── 1. cancelar documento emitido ───────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'r1', public.salvar_rascunho(pg_temp.u('pac'), 'receita', '{"receita":{"itens":[{"medicamento":"dipirona"}]}}');
SELECT pg_temp.falha(format('SELECT public.cancelar_documento(%L, %L)', pg_temp.u('r1'), 'justificativa bem longa aqui'),
  'Só se cancela documento emitido', 'rascunho não se cancela: se descarta');
SELECT public.emitir_rascunho(pg_temp.u('r1'));
SELECT pg_temp.falha(format('SELECT public.cancelar_documento(%L, %L)', pg_temp.u('r1'), 'curta'),
  'Informe a justificativa do cancelamento', 'cancelar pede justificativa de 15 letras');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');   -- gestora
SELECT pg_temp.falha(format('SELECT public.cancelar_documento(%L, %L)', pg_temp.u('r1'), 'cancelado por outra pessoa'),
  'Só o autor cancela', 'só o autor cancela o próprio documento');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'c1', public.cancelar_documento(pg_temp.u('r1'), 'receita lançada no paciente errado')::text;
SELECT pg_temp.falha(format('SELECT public.cancelar_documento(%L, %L)', pg_temp.u('r1'), 'receita lançada no paciente errado'),
  'Este documento já está cancelado', 'cancelado não se cancela de novo');
SELECT pg_temp.falha(format('SELECT public.emitir_documento(%L, %L, %L, NULL, %L, %L)', pg_temp.u('pac'), 'receita', '{"x":1}',
  pg_temp.u('r1'), 'retificar documento cancelado'), 'Só se retifica documento ativo', 'cancelado não se retifica');
RESET ROLE;
DO $$
DECLARE d public.documentos_clinicos;
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = pg_temp.u('r1');
  IF d.estado <> 'cancelado' OR d.numero IS NULL OR d.cancelado_em IS NULL
     OR d.cancelado_por <> '10000000-0000-4000-8000-000000000002' OR d.motivo_cancelamento <> 'receita lançada no paciente errado'
     OR d.conteudo <> '{"receita":{"itens":[{"medicamento":"dipirona"}]}}' THEN
    RAISE EXCEPTION 'FALHOU: cancelamento (%)', d;
  END IF;
  RAISE NOTICE 'OK  cancelado continua no prontuário, com número, conteúdo, quem, quando e por quê';
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'cancelar_documento' AND entidade_id = d.id) THEN
    RAISE EXCEPTION 'FALHOU: cancelamento sem auditoria';
  END IF;
  RAISE NOTICE 'OK  cancelamento na auditoria';
END $$;
SELECT pg_temp.falha(format('DELETE FROM public.documentos_clinicos WHERE id = %L', pg_temp.u('r1')),
  'Registro clínico não se apaga', 'documento cancelado não se apaga');

-- pedido de exames cancelado cancela os exames sem resultado
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'ped', public.emitir_documento(pg_temp.u('pac'), 'pedido_exames', '{"pedido":{"texto":"hemograma\nureia"}}') ->> 'id';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.exames_pedidos WHERE documento_id = pg_temp.u('ped') AND situacao = 'pedido') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: pedido não virou exames';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.cancelar_documento(pg_temp.u('ped'), 'pedido duplicado, já feito na porta');
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.exames_pedidos WHERE documento_id = pg_temp.u('ped') AND situacao <> 'cancelado')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(private.impeditivos_alta(pg_temp.u('int'))) x WHERE x ->> 'tipo' = 'exame') THEN
    RAISE EXCEPTION 'FALHOU: exames do pedido cancelado';
  END IF;
  RAISE NOTICE 'OK  pedido de exames cancelado cancela os exames e deixa de impedir a alta';
END $$;

-- ── copiar como novo ────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'cp', public.copiar_documento(pg_temp.u('r1'))::text;
SELECT pg_temp.falha(format('SELECT public.copiar_documento(%L)', pg_temp.u('r1')),
  'Já existe um rascunho seu deste tipo', 'copiar não sobrescreve rascunho aberto');
SELECT pg_temp.falha(format('SELECT public.copiar_documento(%L)', (pg_temp.v('cp') ->> 'id')::uuid),
  'Só se copia documento emitido', 'rascunho não se copia');
RESET ROLE;
DO $$
DECLARE d public.documentos_clinicos;
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = (pg_temp.v('cp') ->> 'id')::uuid;
  IF d.estado <> 'rascunho' OR d.numero IS NOT NULL OR d.copia_de <> pg_temp.u('r1') OR d.id = pg_temp.u('r1')
     OR d.conteudo <> '{"receita":{"itens":[{"medicamento":"dipirona"}]}}' OR pg_temp.v('cp') ->> 'conteudo' <> d.conteudo
     OR d.autor_id <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: copiar como novo (%)', d;
  END IF;
  RAISE NOTICE 'OK  copiar como novo abre rascunho novo com o conteúdo, sem número, apontando a origem';
END $$;

-- ── histórico do episódio ───────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');   -- gestora: atua, mas não abriu o prontuário
SELECT pg_temp.falha(format('SELECT public.documentos_do_paciente(%L, NULL, false, true)', pg_temp.u('pac')),
  'Abra o prontuário', 'conteúdo do histórico só com o prontuário aberto');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'h', public.documentos_do_paciente(pg_temp.u('pac'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'h4', public.documentos_do_paciente(pg_temp.u('pac'))::text;
RESET ROLE;
DO $$
DECLARE h jsonb := pg_temp.v('h'); h4 jsonb := pg_temp.v('h4');
BEGIN
  IF jsonb_array_length(h) <> 3
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(h) x WHERE x ->> 'id' = pg_temp.u('r1')::text AND x ->> 'estado' = 'cancelado'
                      AND x ->> 'motivo_cancelamento' IS NOT NULL AND x ->> 'cancelado_por' = 'Plantonista de Teste' AND x -> 'conteudo' = 'null')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(h) x WHERE x ->> 'estado' = 'rascunho' AND (x ->> 'meu')::boolean) THEN
    RAISE EXCEPTION 'FALHOU: histórico do autor (%)', h;
  END IF;
  IF jsonb_array_length(h4) <> 2 OR EXISTS (SELECT 1 FROM jsonb_array_elements(h4) x WHERE x ->> 'estado' = 'rascunho') THEN
    RAISE EXCEPTION 'FALHOU: histórico de outra pessoa mostra rascunho alheio (%)', h4;
  END IF;
  RAISE NOTICE 'OK  histórico do episódio: todos os profissionais; rascunho só o próprio; sem conteúdo por padrão';
END $$;

-- ── 2. pendências do PEP ────────────────────────────────────────────────────
INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, impeditiva, autor_id, prazo)
VALUES (pg_temp.u('uni'), pg_temp.u('pac'), pg_temp.u('int'), 'reavaliacao', 'Reavaliar dor às 14h', true,
        '10000000-0000-4000-8000-000000000004', now() + interval '2 hours');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'pp', public.pendencias_pep(pg_temp.u('uni'))::text;
RESET ROLE;
DO $$
DECLARE p jsonb := pg_temp.v('pp'); l jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'rascunhos') x WHERE x ->> 'id' = pg_temp.v('cp') ->> 'id'
                   AND x ->> 'paciente' = 'Estados Documento Teste' AND x ->> 'tipo' = 'receita') THEN
    RAISE EXCEPTION 'FALHOU: rascunho meu fora de "para emitir" (%)', p -> 'rascunhos';
  END IF;
  SELECT x INTO l FROM jsonb_array_elements(p -> 'impeditivos') x WHERE x ->> 'internacao_id' = pg_temp.u('int')::text;
  IF l IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'itens') i WHERE i ->> 'tipo' = 'pendencia')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'itens') i WHERE i ->> 'tipo' = 'documento') THEN
    RAISE EXCEPTION 'FALHOU: impeditivos por leito (%)', l;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'combinadas') x WHERE x ->> 'descricao' = 'Reavaliar dor às 14h'
                   AND x ->> 'autor' = 'Enfermeira de Teste' AND NOT (x ->> 'meu')::boolean) THEN
    RAISE EXCEPTION 'FALHOU: combinadas (%)', p -> 'combinadas';
  END IF;
  RAISE NOTICE 'OK  pendências do PEP: meus rascunhos, impeditivos do leito (sem repetir meu rascunho) e combinadas';
END $$;

-- ── 3. anexos e impressão de prontuário ─────────────────────────────────────
INSERT INTO t VALUES ('arq', pg_temp.u('uni')::text || '/' || pg_temp.u('pac')::text || '/prontuario/teste-exame.pdf');
INSERT INTO storage.objects (bucket_id, name) VALUES ('atendimento', (SELECT valor FROM t WHERE nome = 'arq'));
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_anexo_prontuario(%L, %L, %L, %L, %s)', pg_temp.u('pac'),
  pg_temp.u('uni')::text || '/outro/prontuario/x.pdf', 'x.pdf', 'application/pdf', 1000),
  'Caminho do anexo fora da pasta', 'anexo só na pasta do prontuário do paciente');
SELECT pg_temp.falha(format('SELECT public.registrar_anexo_prontuario(%L, %L, %L, %L, %s)', pg_temp.u('pac'),
  (SELECT valor FROM t WHERE nome = 'arq'), 'x.exe', 'application/x-msdownload', 1000), 'Anexo só em PDF ou imagem', 'anexo só PDF ou imagem');
INSERT INTO t SELECT 'anx', public.registrar_anexo_prontuario(pg_temp.u('pac'), (SELECT valor FROM t WHERE nome = 'arq'),
  'teste-exame.pdf', 'application/pdf', 20480);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');   -- gestora sem o prontuário aberto
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_prontuario(%L, ARRAY[%L]::uuid[], NULL, %L, NULL, %L, %L)',
  pg_temp.u('pac'), pg_temp.u('r1'), 'Direção clínica', 'Maria Filha', 'RG 123'),
  'Abra o prontuário', 'imprimir prontuário exige o prontuário aberto');
-- sigilo reforçado: sem o prontuário aberto, o arquivo não aparece
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE name = (SELECT valor FROM t WHERE nome = 'arq'))
     OR EXISTS (SELECT 1 FROM public.anexos_prontuario WHERE id = pg_temp.u('anx')) THEN
    RAISE EXCEPTION 'FALHOU: anexo visível sem o prontuário aberto';
  END IF;
  RAISE NOTICE 'OK  sigilo reforçado: anexo e arquivo só com o prontuário aberto';
END $$;
SELECT public.abrir_prontuario(pg_temp.u('pac'));   -- a gestora abre (acesso registrado)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = (SELECT valor FROM t WHERE nome = 'arq'))
     OR NOT EXISTS (SELECT 1 FROM public.anexos_prontuario WHERE id = pg_temp.u('anx')) THEN
    RAISE EXCEPTION 'FALHOU: anexo invisível com o prontuário aberto';
  END IF;
  RAISE NOTICE 'OK  com o prontuário aberto, o anexo aparece';
END $$;
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_prontuario(%L, ARRAY[%L]::uuid[], NULL, %L, NULL, %L, %L)',
  pg_temp.u('pac'), pg_temp.u('r1'), '', 'Maria Filha', 'RG 123'), 'Informe quem autorizou', 'autorizador obrigatório');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_prontuario(%L, ARRAY[%L]::uuid[], NULL, %L, NULL, %L, %L)',
  pg_temp.u('pac'), pg_temp.u('r1'), 'Direção clínica', 'Maria Filha', ''), 'Informe o nome e o documento', 'quem recebe é obrigatório');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_prontuario(%L, ARRAY[%L]::uuid[], NULL, %L, NULL, %L, %L)',
  pg_temp.u('pac'), (pg_temp.v('cp') ->> 'id')::uuid, 'Direção clínica', 'Maria Filha', 'RG 123'),
  'Só entram documentos emitidos', 'rascunho não entra na cópia do prontuário');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_prontuario(%L, NULL, NULL, %L, NULL, %L, %L)',
  pg_temp.u('pac'), 'Direção clínica', 'Maria Filha', 'RG 123'), 'Marque ao menos um', 'sem itens não imprime');
INSERT INTO t SELECT 'imp', public.registrar_impressao_prontuario(pg_temp.u('pac'), ARRAY[pg_temp.u('r1'), pg_temp.u('ped')],
  ARRAY[pg_temp.u('anx')], 'Direção clínica', 'Ofício 12/2026', 'Maria Filha', 'RG 123')::text;
INSERT INTO t SELECT 'hist', public.impressoes_do_prontuario(pg_temp.u('pac'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.cancelar_impressao_prontuario(%L, %L)', (pg_temp.v('imp') ->> 'id')::uuid, 'cancelada por outra pessoa'),
  'Só quem imprimiu', 'só quem imprimiu (ou o gestor) cancela a impressão');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.cancelar_impressao_prontuario(%L, %L)', (pg_temp.v('imp') ->> 'id')::uuid, 'curta'),
  'Informe a justificativa', 'cancelar impressão pede 10 letras');
SELECT public.cancelar_impressao_prontuario((pg_temp.v('imp') ->> 'id')::uuid, 'folha saiu com a impressora falhando');
SELECT pg_temp.falha(format('SELECT public.cancelar_impressao_prontuario(%L, %L)', (pg_temp.v('imp') ->> 'id')::uuid, 'de novo, cancelando'),
  'Esta impressão já está cancelada', 'impressão cancelada não se cancela de novo');
RESET ROLE;
DO $$
DECLARE r public.impressoes_prontuario; h jsonb := pg_temp.v('hist');
BEGIN
  SELECT * INTO r FROM public.impressoes_prontuario WHERE id = (pg_temp.v('imp') ->> 'id')::uuid;
  IF r.protocolo !~ '^PRO-[0-9A-F]{10}$' OR cardinality(r.documentos) <> 2 OR cardinality(r.anexos) <> 1
     OR jsonb_array_length(r.itens) <> 3 OR r.autorizador <> 'Direção clínica' OR r.recebedor_documento <> 'RG 123'
     OR r.estado <> 'cancelada' OR r.motivo_cancelamento <> 'folha saiu com a impressora falhando' THEN
    RAISE EXCEPTION 'FALHOU: impressão de prontuário (%)', r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE paciente_id = pg_temp.u('pac') AND tipo_acesso = 'impressao'
                   AND documento_tipo = 'Cópia do prontuário ' || r.protocolo) THEN
    RAISE EXCEPTION 'FALHOU: cópia do prontuário fora do registro de acessos';
  END IF;
  IF jsonb_array_length(h) <> 1 OR h -> 0 ->> 'impresso_por' <> 'Gestora de Teste' OR h -> 0 ->> 'recebedor_nome' <> 'Maria Filha' THEN
    RAISE EXCEPTION 'FALHOU: histórico de impressões (%)', h;
  END IF;
  RAISE NOTICE 'OK  impressão registrada (protocolo %, itens, autorizador, quem recebe), no registro de acessos, e cancelada com justificativa', r.protocolo;
END $$;
SELECT pg_temp.falha(format('UPDATE public.impressoes_prontuario SET autorizador = %L WHERE id = %L', 'outra pessoa', (pg_temp.v('imp') ->> 'id')::uuid),
  'Registro de prontuário não se altera', 'impressão registrada não se altera');
SELECT pg_temp.falha(format('DELETE FROM public.impressoes_prontuario WHERE id = %L', (pg_temp.v('imp') ->> 'id')::uuid),
  'Registro clínico não se apaga', 'impressão não se apaga');
SELECT pg_temp.falha(format('DELETE FROM public.anexos_prontuario WHERE id = %L', pg_temp.u('anx')),
  'Registro clínico não se apaga', 'anexo não se apaga');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.cancelar_anexo_prontuario(%L, %L)', pg_temp.u('anx'), 'arquivo ilegível trocado'),
  'Só quem anexou', 'só quem anexou (ou o gestor) cancela o anexo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.cancelar_anexo_prontuario(pg_temp.u('anx'), 'arquivo ilegível, substituído');
SELECT pg_temp.falha(format('SELECT public.registrar_impressao_prontuario(%L, NULL, ARRAY[%L]::uuid[], %L, NULL, %L, %L)',
  pg_temp.u('pac'), pg_temp.u('anx'), 'Direção clínica', 'Maria Filha', 'RG 123'),
  'Só entram anexos em vigor', 'anexo cancelado não entra na cópia');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT cancelado_em FROM public.anexos_prontuario WHERE id = pg_temp.u('anx')) IS NULL
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = (SELECT valor FROM t WHERE nome = 'arq')) THEN
    RAISE EXCEPTION 'FALHOU: cancelar anexo';
  END IF;
  RAISE NOTICE 'OK  anexo cancelado fica riscado e o arquivo não se apaga';
END $$;
ROLLBACK;
