-- Testes da migration 20261206000001_resultado_exames.sql (Fase 5C, tarefa 1,
-- etapa 1.2): coleta pela enfermagem; pendência até o resultado; resultado à
-- mão e do laboratório em versões; retificação com motivo; laudo em PDF;
-- avisos, "novo" e ciência. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- médico (…0002), enfermeira (…0004) e recepção (…0005) de plantão agora no PS
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

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
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

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'a', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  json_build_object('nome', 'Paciente Exames Teste', 'data_nascimento', '1980-04-04')::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('a'), 'verde',
  '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":38.1,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('a'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('a');
CREATE FUNCTION pg_temp.ex(p text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.exames_pedidos WHERE episodio_id = (SELECT valor::uuid FROM t WHERE nome = 'a') AND exame = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.ex(text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.pedir_exames(pg_temp.u('a'), '[{"nome":"Hemograma"},{"nome":"Glicemia"},{"nome":"Ureia"}]');

-- 2a. coleta é da enfermagem
SELECT pg_temp.falha(format('SELECT public.marcar_exame_coletado(%L)', pg_temp.ex('Hemograma')),
  'Acesso negado: a coleta é marcada pela enfermagem', 'médico não marca coleta');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.marcar_exame_coletado(pg_temp.ex('Hemograma'));
SELECT public.marcar_exame_coletado(pg_temp.ex('Ureia'));
SELECT pg_temp.falha(format('SELECT public.marcar_exame_coletado(%L)', pg_temp.ex('Hemograma')),
  'Só exame pedido pode ser marcado como coletado', 'coleta uma vez só');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE h jsonb;
BEGIN
  SELECT x INTO h FROM jsonb_array_elements(public.painel_atendimento_ps(pg_temp.u('a')) -> 'exames') x WHERE x ->> 'exame' = 'Hemograma';
  IF h ->> 'situacao' <> 'coletado' OR h ->> 'coletado_em' IS NULL THEN RAISE EXCEPTION 'FALHOU: coleta no painel: %', h; END IF;
  RAISE NOTICE 'OK  2a: enfermagem marca a coleta com a hora; aparece no painel';
END $$;
SELECT pg_temp.falha(format('SELECT public.pedir_exames(%L, %L)', pg_temp.u('a'), '[{"nome":"Hemograma"}]'),
  'Esses exames já estão pedidos', 'coletado conta como pendente no "já pedido"');
RESET ROLE;
DO $$ BEGIN
  IF array_to_string(private.pendencias_atendimento(pg_temp.u('a')), ' ') NOT LIKE '%Hemograma%' THEN
    RAISE EXCEPTION 'FALHOU: coletado deveria impedir a alta';
  END IF;
  RAISE NOTICE 'OK  6a: exame coletado continua pendente para a alta';
END $$;
SET LOCAL ROLE authenticated;

-- 3a. resultado à mão pelo caminho de antes; versão manual; aviso a quem pediu
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.resolver_exame(pg_temp.ex('Glicemia'), '98 mg/dL');
RESET ROLE;
DO $$
DECLARE e public.exames_pedidos;
BEGIN
  SELECT * INTO e FROM public.exames_pedidos WHERE id = pg_temp.ex('Glicemia');
  IF e.situacao <> 'resultado' OR e.resultado_origem <> 'manual' OR e.resultado <> '98 mg/dL'
     OR (SELECT count(*) FROM public.exame_resultados WHERE exame_id = e.id AND vigente AND origem = 'manual' AND versao = 1) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: resultado à mão: %', e;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000002'
                  AND tipo = 'exame_resultado_' || e.id AND mensagem LIKE 'Resultado liberado: Glicemia%') THEN
    RAISE EXCEPTION 'FALHOU: aviso de resultado';
  END IF;
  RAISE NOTICE 'OK  3a/5a: resultado à mão vira versão manual e avisa quem pediu';
END $$;
SET LOCAL ROLE authenticated;

-- retificação: só com motivo, e a anterior fica no histórico
SELECT pg_temp.falha(format('SELECT public.registrar_resultado_exame(%L, %L)', pg_temp.ex('Glicemia'), '89 mg/dL'),
  'Este exame já tem resultado', 'mudar resultado pede retificação');
SELECT pg_temp.falha(format('SELECT public.registrar_resultado_exame(%L, %L, NULL, NULL, %L)', pg_temp.ex('Glicemia'), '89 mg/dL', 'erro'),
  'Retificação: diga o motivo', 'retificação pede motivo');
SELECT public.registrar_resultado_exame(pg_temp.ex('Glicemia'), '89 mg/dL', NULL, NULL, 'valor digitado errado na primeira vez');
DO $$
DECLARE d jsonb := public.exame_detalhe(pg_temp.ex('Glicemia'));
BEGIN
  IF jsonb_array_length(d -> 'versoes') <> 2 OR d -> 'versoes' -> 0 ->> 'texto' <> '89 mg/dL' OR NOT (d -> 'versoes' -> 0 ->> 'vigente')::boolean
     OR (d -> 'versoes' -> 1 ->> 'vigente')::boolean OR d -> 'versoes' -> 1 ->> 'motivo_retificacao' NOT LIKE 'valor digitado errado%' THEN
    RAISE EXCEPTION 'FALHOU: retificação: %', d -> 'versoes';
  END IF;
  RAISE NOTICE 'OK  6a: retificação abre versão nova; a anterior fica com o motivo';
END $$;

-- 3a/4a. laudo em PDF: tem de ser deste exame e ter sido enviado
RESET ROLE;
INSERT INTO storage.objects (bucket_id, name) VALUES ('exames', pg_temp.ex('Ureia') || '/laudo-ureia.pdf');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  IF NOT private.exame_pode_subir_laudo(pg_temp.ex('Ureia') || '/outro.pdf') OR private.exame_pode_subir_laudo(pg_temp.ex('Ureia') || '/outro.png') THEN
    RAISE EXCEPTION 'FALHOU: regra de envio do laudo';
  END IF;
  RAISE NOTICE 'OK  4a: enfermagem com o paciente envia laudo, só PDF';
END $$;
SELECT pg_temp.falha(format('SELECT public.registrar_resultado_exame(%L, NULL, %L, %L)', pg_temp.ex('Ureia'), pg_temp.ex('Glicemia') || '/x.pdf', 'x.pdf'),
  'O laudo não é deste exame', 'laudo de outro exame');
SELECT pg_temp.falha(format('SELECT public.registrar_resultado_exame(%L, NULL, %L, %L)', pg_temp.ex('Ureia'), pg_temp.ex('Ureia') || '/nao-enviado.pdf', 'x.pdf'),
  'O laudo não foi enviado', 'laudo que não subiu');
SELECT public.registrar_resultado_exame(pg_temp.ex('Ureia'), NULL, pg_temp.ex('Ureia') || '/laudo-ureia.pdf', 'laudo-ureia.pdf');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE d jsonb := public.exame_detalhe(pg_temp.ex('Ureia')); a jsonb;
BEGIN
  IF NOT (d -> 'versoes' -> 0 ->> 'tem_pdf')::boolean THEN RAISE EXCEPTION 'FALHOU: laudo na versão'; END IF;
  a := public.exame_laudo_abrir((d -> 'versoes' -> 0 ->> 'id')::uuid);
  IF a ->> 'caminho' NOT LIKE '%/laudo-ureia.pdf' OR NOT private.exame_laudo_liberado(a ->> 'caminho') THEN
    RAISE EXCEPTION 'FALHOU: abrir laudo: %', a;
  END IF;
  RAISE NOTICE 'OK  4a: laudo só em PDF; abre por liberação curta para quem vê o exame';
END $$;

-- 5a. resultado do laboratório (caminho da etapa 1.3): analitos como vieram; crítico do laboratório avisa a enfermagem
RESET ROLE;
SELECT private.gravar_resultado_exame(pg_temp.ex('Hemograma'), 'laboratorio', NULL, NULL, NULL,
  '[{"analito":"Hemoglobina","loinc":"718-7","valor":"6,9","unidade":"g/dL","referencia":"12,0 a 16,0","marca":"LL","critico":true},
    {"analito":"Leucócitos","valor":">50000","unidade":"/mm³","referencia":"4000 a 11000","marca":"H"}]',
  false, 'LAB-123', NULL, NULL);
DO $$
DECLARE e public.exames_pedidos; r public.exame_resultados;
BEGIN
  SELECT * INTO e FROM public.exames_pedidos WHERE id = pg_temp.ex('Hemograma');
  SELECT * INTO r FROM public.exame_resultados WHERE exame_id = e.id AND vigente;
  IF NOT e.critico OR e.resultado_origem <> 'laboratorio' OR r.laboratorio_ref <> 'LAB-123'
     OR (SELECT valor_num FROM public.exame_resultado_itens WHERE resultado_id = r.id AND analito = 'Hemoglobina') <> 6.9
     OR (SELECT valor_num FROM public.exame_resultado_itens WHERE resultado_id = r.id AND analito = 'Leucócitos') IS NOT NULL
     OR (SELECT valor_texto FROM public.exame_resultado_itens WHERE resultado_id = r.id AND analito = 'Leucócitos') <> '>50000'
     OR e.resultado NOT LIKE 'Hemoglobina 6,9 g/dL;%' THEN
    RAISE EXCEPTION 'FALHOU: resultado do laboratório: % / %', e, r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000004'
                  AND tipo = 'exame_critico_' || e.id AND mensagem LIKE 'Resultado CRÍTICO%') THEN
    RAISE EXCEPTION 'FALHOU: aviso de crítico à enfermagem';
  END IF;
  RAISE NOTICE 'OK  1a/5a: analitos como o laboratório mandou (texto e número quando é número); crítico avisa a enfermagem do setor';
END $$;

-- 5a. "novo" até alguém abrir; ciência do médico
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF NOT (SELECT (x ->> 'novo')::boolean FROM jsonb_array_elements(public.painel_atendimento_ps(pg_temp.u('a')) -> 'exames') x WHERE x ->> 'exame' = 'Hemograma') THEN
    RAISE EXCEPTION 'FALHOU: resultado novo';
  END IF;
END $$;
SELECT public.marcar_resultado_visto(pg_temp.ex('Hemograma'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.dar_ciencia_resultado(%L)', pg_temp.ex('Hemograma')),
  'Acesso negado: a ciência é do médico', 'ciência é do médico');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.dar_ciencia_resultado(pg_temp.ex('Hemograma'));
SELECT public.dar_ciencia_resultado(pg_temp.ex('Hemograma'));
DO $$
DECLARE d jsonb := public.exame_detalhe(pg_temp.ex('Hemograma'));
BEGIN
  IF (SELECT (x ->> 'novo')::boolean FROM jsonb_array_elements(public.painel_atendimento_ps(pg_temp.u('a')) -> 'exames') x WHERE x ->> 'exame' = 'Hemograma')
     OR NOT (d ->> 'ja_ciente')::boolean OR jsonb_array_length(d -> 'versoes' -> 0 -> 'cientes') <> 1
     OR jsonb_array_length(d -> 'versoes' -> 0 -> 'itens') <> 2 OR d -> 'versoes' -> 0 -> 'itens' -> 0 ->> 'marca' <> 'LL' THEN
    RAISE EXCEPTION 'FALHOU: visto e ciência: %', d;
  END IF;
  RAISE NOTICE 'OK  5a/7a: "novo" some quando alguém abre; ciência do médico registrada uma vez; detalhe com analitos';
END $$;

-- cancelar com motivo vale também depois da coleta; a recepção não vê o exame
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.pedir_exames(pg_temp.u('a'), '[{"nome":"PCR"}]');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.marcar_exame_coletado(pg_temp.ex('PCR'));
SELECT public.resolver_exame(pg_temp.ex('PCR'), NULL, 'amostra hemolisada, recoleta pedida');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.exame_detalhe(%L)', pg_temp.ex('PCR')), 'Acesso negado', 'recepção não abre o exame');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT situacao FROM public.exames_pedidos WHERE id = pg_temp.ex('PCR')) <> 'cancelado' THEN RAISE EXCEPTION 'FALHOU: cancelar coletado'; END IF;
  IF has_table_privilege('authenticated', 'public.exame_resultados', 'SELECT') OR has_table_privilege('authenticated', 'public.exame_resultado_itens', 'INSERT')
     OR has_function_privilege('authenticated', 'private.gravar_resultado_exame(uuid, text, text, text, text, jsonb, boolean, text, text, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.exame_detalhe(uuid)', 'EXECUTE')
     OR (SELECT public FROM storage.buckets WHERE id = 'exames') THEN
    RAISE EXCEPTION 'FALHOU: privilégios';
  END IF;
  RAISE NOTICE 'OK  cancelar depois da coleta; tabelas e gravação só pelas funções; área do laudo privada';
END $$;
ROLLBACK;
