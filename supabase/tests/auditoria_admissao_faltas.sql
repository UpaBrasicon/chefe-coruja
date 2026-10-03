-- Testes das migrations 20261022000012_admissao_numerada.sql e
-- 20261022000013_faltas_documento.sql (auditoria do frontend 03/10/2026:
-- defeito 8 e risco R5). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/auditoria_admissao_faltas.sql
--
-- Plantonista (…0002) escalado agora na Clínica Médica (…22…0001), onde fica
-- o paciente internado criado aqui (…0097).
BEGIN;

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
VALUES ('23000000-0000-4000-8000-000000000097', '21000000-0000-4000-8000-000000000001', 'Paciente da Auditoria de Documentos',
        '1968-04-04', 'T-097', '22000000-0000-4000-8000-000000000001', 'M');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES ('25000000-0000-4000-8000-000000000097', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000097',
        '22000000-0000-4000-8000-000000000001', 'atendimento', 'Dispneia', '10000000-0000-4000-8000-000000000004', now() - interval '3 hours');
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, episodio_id)
SELECT '24000000-0000-4000-8000-000000000097', u.organizacao_id, u.id, '23000000-0000-4000-8000-000000000097',
       'internado', '22000000-0000-4000-8000-000000000001', now() - interval '1 hour', '25000000-0000-4000-8000-000000000097'
FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';

DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual(), private.turno_atual(), now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
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

-- ── A. ficha de admissão: registra, imprime e reimprime ─────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'adm', public.registrar_admissao('24000000-0000-4000-8000-000000000097', 'FICHA DE ADMISSÃO MÉDICA — texto do teste de impressão',
  '{"procedencia":"Porta","subjetivo":"Dispneia há 2 dias","objetivo":"Taquipneico, MV reduzido em base D","cid":"J18.9 — Pneumonia","plano":"Antibiótico e reavaliação"}');
INSERT INTO t SELECT 'f1', public.folha_documento(pg_temp.u('adm'), 'Ficha de admissão médica')::text;
INSERT INTO t SELECT 'f2', public.folha_documento(pg_temp.u('adm'), 'Ficha de admissão médica · reimpressão')::text;
INSERT INTO t SELECT 'adm2', public.corrigir_evolucao(pg_temp.u('adm'),
  'FICHA DE ADMISSÃO MÉDICA — texto do teste de impressão, corrigido', 'CID trocado após raio-x de tórax');
INSERT INTO t SELECT 'f3', public.folha_documento(pg_temp.u('adm2'), 'Ficha de admissão médica · reimpressão')::text;
RESET ROLE;
DO $$
DECLARE d public.documentos_clinicos; d2 public.documentos_clinicos; f jsonb := pg_temp.v('f1');
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = pg_temp.u('adm');
  IF d.numero !~ '^\d{4}/\d{6}$' OR d.emitido_em IS NULL OR d.autor_id <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: admissão sem número/emissão ou com outro autor (%)', d;
  END IF;
  RAISE NOTICE 'OK  admissão registrada recebe número da unidade (%) e o autor é o usuário do login', d.numero;
  IF f ->> 'tipo' <> 'admissao_anamnese' OR f ->> 'numero' <> d.numero OR f ->> 'autor' <> 'Plantonista de Teste'
     OR f ->> 'codigo' !~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' OR f ->> 'protocolo' !~ '^IMP-'
     OR f #>> '{estruturado,procedencia}' <> 'Porta' THEN
    RAISE EXCEPTION 'FALHOU: folha da admissão (%)', f;
  END IF;
  RAISE NOTICE 'OK  folha_documento imprime a admissão (número, código de conferência, protocolo, ficha estruturada)';
  IF pg_temp.v('f2') ->> 'numero' <> d.numero OR pg_temp.v('f2') ->> 'protocolo' = f ->> 'protocolo' THEN
    RAISE EXCEPTION 'FALHOU: reimpressão da admissão (%)', pg_temp.v('f2');
  END IF;
  RAISE NOTICE 'OK  reimpressão sai com o mesmo número e protocolo de impressão novo';
  SELECT * INTO d2 FROM public.documentos_clinicos WHERE id = pg_temp.u('adm2');
  IF d2.numero IS NULL OR d2.numero = d.numero OR d2.versao <> 2 OR pg_temp.v('f3') ->> 'numero' <> d2.numero
     OR (SELECT estado FROM public.documentos_clinicos WHERE id = d.id) <> 'retificado' THEN
    RAISE EXCEPTION 'FALHOU: admissão corrigida não imprime (% / %)', d2, pg_temp.v('f3');
  END IF;
  RAISE NOTICE 'OK  admissão corrigida (versão 2) também recebe número e imprime';
END $$;

-- ── B. emitir rascunho confere os campos obrigatórios ───────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'enc', public.salvar_rascunho('23000000-0000-4000-8000-000000000097', 'encaminhamento',
  '{"encaminhamento":{"especialidade":"Pneumologia","cid":"","motivo":""}}');
INSERT INTO t SELECT 'at', public.salvar_rascunho('23000000-0000-4000-8000-000000000097', 'atestado',
  '{"atestado":{"tipo":"afastamento","dias":"","inicio":""}}');
INSERT INTO t SELECT 'pep', public.pendencias_pep('21000000-0000-4000-8000-000000000001')::text;
INSERT INTO t SELECT 'fr', public.faltas_rascunho(pg_temp.u('enc'))::text;
SELECT pg_temp.falha(format('SELECT public.emitir_rascunho(%L)', pg_temp.u('enc')),
  'Falta para emitir: CID-10; Motivo do encaminhamento', 'encaminhamento sem CID e motivo não é emitido');
SELECT pg_temp.falha(format('SELECT public.emitir_rascunho(%L)', pg_temp.u('at')),
  'Falta para emitir: Dias de afastamento', 'atestado de afastamento sem dias não é emitido');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.faltas_rascunho(%L)', pg_temp.u('enc')), 'Só o autor', 'faltas do rascunho só para o autor');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.salvar_rascunho('23000000-0000-4000-8000-000000000097', 'encaminhamento',
  '{"encaminhamento":{"especialidade":"Pneumologia","cid":"J18.9","motivo":"Pneumonia de repetição, investigar"}}', pg_temp.u('enc'));
INSERT INTO t SELECT 'e1', public.emitir_rascunho(pg_temp.u('enc'))::text;
RESET ROLE;
DO $$
DECLARE r jsonb;
BEGIN
  SELECT x INTO r FROM jsonb_array_elements(pg_temp.v('pep') -> 'rascunhos') x WHERE (x ->> 'id')::uuid = pg_temp.u('enc');
  IF r -> 'faltas' <> '["CID-10", "Motivo do encaminhamento"]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: pendencias_pep não diz o que falta (%)', r;
  END IF;
  IF pg_temp.v('fr') <> r -> 'faltas' THEN RAISE EXCEPTION 'FALHOU: faltas_rascunho (%)', pg_temp.v('fr'); END IF;
  RAISE NOTICE 'OK  Pendências do PEP e faltas_rascunho listam o que falta em cada rascunho';
  IF (SELECT estado FROM public.documentos_clinicos WHERE id = pg_temp.u('at')) <> 'rascunho' THEN
    RAISE EXCEPTION 'FALHOU: rascunho incompleto mudou de estado';
  END IF;
  IF pg_temp.v('e1') ->> 'numero' !~ '^\d{4}/\d{6}$'
     OR (SELECT estado FROM public.documentos_clinicos WHERE id = pg_temp.u('enc')) <> 'ativo' THEN
    RAISE EXCEPTION 'FALHOU: rascunho completo não foi emitido (%)', pg_temp.v('e1');
  END IF;
  RAISE NOTICE 'OK  rascunho completo é emitido com número (%)', pg_temp.v('e1') ->> 'numero';
  -- regras por tipo (espelho das telas)
  IF cardinality(private.faltas_documento('receita', '{"receita":{"itens":[]}}', NULL, NULL)) <> 1
     OR private.faltas_documento('receita', '{"receita":{"itens":[{"medicamento":"Dipirona","posologia":""}]}}', NULL, NULL)
        <> ARRAY['Como tomar Dipirona']
     OR private.faltas_documento('pedido_exames', '{"exames":{"texto":"- Hemograma"}}', NULL, NULL) <> '{}'::text[]
     OR private.faltas_documento('atestado', '{"atestado":{"tipo":"comparecimento","hentrada":"10:00","hsaida":"09:00"}}', NULL, NULL)
        <> ARRAY['Hora de saída igual ou anterior à de entrada']
     OR private.faltas_documento('atestado', '{"atestado":{"tipo":"comparecimento","dias":""}}', NULL, NULL) <> '{}'::text[]
     OR private.faltas_documento('sumario_alta', 'texto livre', NULL, NULL) <> '{}'::text[]
     OR private.faltas_documento('encaminhamento', 'não é json', NULL, NULL) = '{}'::text[] THEN
    RAISE EXCEPTION 'FALHOU: regras por tipo';
  END IF;
  RAISE NOTICE 'OK  regras por tipo (receita, pedido da internação, horário do atestado, porta sem horário, conteúdo ilegível)';
  IF NOT EXISTS (SELECT 1 FROM unnest(private.faltas_documento('laudo_aih',
       '{"aih":{"sinais":"Febre","condicoes":"Hipotensão","diagnostico":"Dengue","cid":"A91","procDesc":"Tratamento de dengue","procCod":"03.03.01.006-6","clinica":"Clínica médica"}}',
       '23000000-0000-4000-8000-000000000097', NULL)) x WHERE x LIKE 'Completar o cadastro: CNS%') THEN
    RAISE EXCEPTION 'FALHOU: laudo de AIH não cobra o cadastro do paciente';
  END IF;
  RAISE NOTICE 'OK  laudo de AIH cobra o cadastro do paciente';
END $$;

ROLLBACK;
