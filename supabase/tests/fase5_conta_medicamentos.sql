-- Testes da migration 20261201000001_conta_medicamentos.sql (Fase 5B, etapa 3.3):
-- a conta lê a dispensação (menos devolução) e confere com a administração;
-- avisos nos casos claros; porta × internação pelo momento da internação;
-- fora da conta e volta com motivo; congela no fechamento. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico'),
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000001', 'faturamento') ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('00000000-0000-4000-8000-0000000d3201', 'Ceftriaxona D', 'ceftriaxona d', 'Frasco 1 g po', 'teste-disp'),
  ('00000000-0000-4000-8000-0000000d3202', 'Dipirona D', 'dipirona d', 'Ampola 2 mL', 'teste-disp'),
  ('00000000-0000-4000-8000-0000000d3203', 'Ondansetrona D', 'ondansetrona d', 'Ampola 4 mL', 'teste-disp'),
  ('00000000-0000-4000-8000-0000000d3204', 'Insulina D', 'insulina d', 'Frasco 10 mL', 'teste-disp');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-0000000d3201', '21000000-0000-4000-8000-000000000001', 'Paciente Dispensa', '1970-01-01', 'D-1',
   '22000000-0000-4000-8000-000000000003', 'F');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, atendimento_medico_id, atendimento_iniciado_em)
VALUES ('25000000-0000-4000-8000-0000000d3201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d3201',
        '22000000-0000-4000-8000-000000000003', 'atendimento', 'Febre', '10000000-0000-4000-8000-000000000004', now() - interval '3 hours',
        '10000000-0000-4000-8000-000000000002', now() - interval '150 minutes');
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d3201', id, now() - interval '170 minutes', 70, 'manual'
  FROM public.conceito WHERE nome = 'peso' AND unidade_id IS NULL;
INSERT INTO public.prescricoes (id, unidade_id, paciente_id, medico_id, status, episodio_id, criada_por)
VALUES ('2a000000-0000-4000-8000-0000000d3201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d3201',
        '10000000-0000-4000-8000-000000000002', 'ativa', '25000000-0000-4000-8000-0000000d3201', '10000000-0000-4000-8000-000000000002');
INSERT INTO public.prescricao_itens (id, prescricao_id, medicamento_id, descricao, dose, via, posologia, se_necessario, tipo, ordem, autor_id) VALUES
  ('2b000000-0000-4000-8000-0000000d3201', '2a000000-0000-4000-8000-0000000d3201', '00000000-0000-4000-8000-0000000d3201', 'Ceftriaxona', '2 g', 'EV', '24/24h', false, 'medicamento', 1, '10000000-0000-4000-8000-000000000002'),
  ('2b000000-0000-4000-8000-0000000d3202', '2a000000-0000-4000-8000-0000000d3201', '00000000-0000-4000-8000-0000000d3202', 'Dipirona', '1 g', 'EV', '6/6h se dor', false, 'medicamento', 2, '10000000-0000-4000-8000-000000000002'),
  ('2b000000-0000-4000-8000-0000000d3203', '2a000000-0000-4000-8000-0000000d3201', '00000000-0000-4000-8000-0000000d3203', 'Ondansetrona', '2 ampolas', 'EV', '8/8h', false, 'medicamento', 3, '10000000-0000-4000-8000-000000000002'),
  ('2b000000-0000-4000-8000-0000000d3204', '2a000000-0000-4000-8000-0000000d3201', '00000000-0000-4000-8000-0000000d3204', 'Insulina', '3 UI/h', 'EV', 'contínuo em bomba', false, 'medicamento', 4, '10000000-0000-4000-8000-000000000002');

CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT v::uuid FROM t WHERE k = p $$;
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
CREATE FUNCTION pg_temp.med(p_conta uuid, p_item uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT x FROM jsonb_array_elements(public.conta_detalhe(p_conta) -> 'medicamentos') x WHERE (x ->> 'item_id')::uuid = p_item $$;
GRANT EXECUTE ON FUNCTION pg_temp.med(uuid, uuid) TO authenticated;
INSERT INTO t SELECT 'porta', id::text FROM public.contas WHERE episodio_id = '25000000-0000-4000-8000-0000000d3201';

-- na porta (há 2 h): ceftriaxona dispensada 3, voltou 1, administrada 1x; ondansetrona dispensada e
-- recusada (nunca dada); dipirona dada sem dispensação; insulina sem nada
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'd1', public.dispensar_item('2b000000-0000-4000-8000-0000000d3201', 3) ->> 'id';
SELECT public.devolver_dispensacao(pg_temp.u('d1'), 1, 'sobrou uma dose no posto');
SELECT public.dispensar_item('2b000000-0000-4000-8000-0000000d3203', 6);
RESET ROLE;
INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, horario_previsto, situacao, registrado_por, registrado_em) VALUES
  ('2b000000-0000-4000-8000-0000000d3201', '23000000-0000-4000-8000-0000000d3201', '21000000-0000-4000-8000-000000000001', '08:00', 'feito', '10000000-0000-4000-8000-000000000004', now() - interval '2 hours'),
  ('2b000000-0000-4000-8000-0000000d3202', '23000000-0000-4000-8000-0000000d3201', '21000000-0000-4000-8000-000000000001', NULL, 'feito', '10000000-0000-4000-8000-000000000004', now() - interval '2 hours'),
  ('2b000000-0000-4000-8000-0000000d3203', '23000000-0000-4000-8000-0000000d3201', '21000000-0000-4000-8000-000000000001', '08:00', 'recusado', '10000000-0000-4000-8000-000000000004', now() - interval '2 hours');
UPDATE public.dispensacoes SET dispensada_em = now() - interval '2 hours' WHERE paciente_id = '23000000-0000-4000-8000-0000000d3201';

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE a jsonb := pg_temp.med(pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3201');
        b jsonb := pg_temp.med(pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3202');
        c jsonb := pg_temp.med(pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3203');
        d jsonb := pg_temp.med(pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3204');
BEGIN
  IF (a ->> 'liquido')::int <> 2 OR (a ->> 'administrado')::int <> 1 OR a ->> 'aviso' IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: ceftriaxona: %', a; END IF;
  IF b ->> 'aviso' NOT LIKE 'Administrado sem nada dispensado%' THEN RAISE EXCEPTION 'FALHOU: dipirona: %', b; END IF;
  IF c ->> 'aviso' NOT LIKE 'Dispensado e nunca administrado%' THEN RAISE EXCEPTION 'FALHOU: ondansetrona (recusado não conta como dado): %', c; END IF;
  IF d IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: insulina sem dispensação nem administração não entra'; END IF;
  IF (public.conta_detalhe(pg_temp.u('porta')) ->> 'medicamentos_com_aviso')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: contagem de avisos'; END IF;
  RAISE NOTICE 'OK  1a: dispensado (menos devolução) ao lado do administrado; avisos só nos casos claros';
END $$;

-- 3a. fora da conta e de volta, com motivo
SELECT pg_temp.falha(format('SELECT public.medicamento_fora_da_conta(%L, %L, true, %L)', pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3203', 'curto'),
  'Escreva o motivo', 'fora da conta pede motivo');
SELECT public.medicamento_fora_da_conta(pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3203', true, 'ampolas devolvidas fora do sistema');
DO $$ BEGIN
  IF NOT (pg_temp.med(pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3203') ->> 'fora_da_conta')::boolean
     OR (public.conta_detalhe(pg_temp.u('porta')) ->> 'medicamentos_com_aviso')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: fora da conta';
  END IF;
  RAISE NOTICE 'OK  3a: item fora da conta deixa de contar no aviso';
END $$;
SELECT public.medicamento_fora_da_conta(pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3203', false, 'achado o registro da administração');
SELECT pg_temp.falha(format('SELECT public.medicamento_fora_da_conta(%L, %L, false, %L)', pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3203', 'já voltou antes disso'),
  'Este medicamento não está fora da conta', 'não volta o que não saiu');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.medicamento_fora_da_conta(%L, %L, true, %L)', pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3203', 'gestor tentando ajustar'),
  'Acesso negado', 'gestor não ajusta a conta');
RESET ROLE;

-- internação há 1 h: o que vem depois vai na conta da internação; a da porta não muda
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, internado_em, episodio_id)
VALUES ('26000000-0000-4000-8000-0000000d3301', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
        '23000000-0000-4000-8000-0000000d3201', 'internado', '22000000-0000-4000-8000-000000000001', now() - interval '1 hour', now() - interval '1 hour',
        '25000000-0000-4000-8000-0000000d3201');
INSERT INTO t SELECT 'int', id::text FROM public.contas WHERE internacao_id = '26000000-0000-4000-8000-0000000d3301';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.dispensar_item('2b000000-0000-4000-8000-0000000d3201', 2);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  IF (pg_temp.med(pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3201') ->> 'liquido')::int <> 2
     OR (pg_temp.med(pg_temp.u('int'), '2b000000-0000-4000-8000-0000000d3201') ->> 'liquido')::int <> 2
     OR pg_temp.med(pg_temp.u('int'), '2b000000-0000-4000-8000-0000000d3203') IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: separação porta × internação';
  END IF;
  RAISE NOTICE 'OK  dispensação depois de internado vai na conta da internação; a da porta fica com o que veio antes';
END $$;

-- congela no fechamento
RESET ROLE;
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'internacao', desfecho_em = now() - interval '1 hour',
       desfecho_por = '10000000-0000-4000-8000-000000000002', encerrado_em = now() - interval '1 hour'
 WHERE id = '25000000-0000-4000-8000-0000000d3201';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('porta'), 'em_conferencia');
-- Fase 5B, tarefa 5: a conta de teste tem pendência bloqueante; o gestor libera
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.liberar_fechamento_conta(pg_temp.u('porta'), 'liberado no teste da tarefa anterior');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('porta'), 'fechada');
RESET ROLE;
-- depois do fechamento, a dispensação da internação é "puxada" para antes da internação
UPDATE public.dispensacoes SET dispensada_em = now() - interval '90 minutes'
 WHERE item_id = '2b000000-0000-4000-8000-0000000d3201' AND dispensada_em > now() - interval '30 minutes';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.medicamento_fora_da_conta(%L, %L, true, %L)', pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3203', 'conta já fechada antes'),
  'Conta fechada', 'conta fechada não se ajusta');
DO $$ BEGIN
  IF (pg_temp.med(pg_temp.u('porta'), '2b000000-0000-4000-8000-0000000d3201') ->> 'liquido')::int <> 2 THEN
    RAISE EXCEPTION 'FALHOU: conta fechada deveria manter os medicamentos do fechamento';
  END IF;
  RAISE NOTICE 'OK  medicamentos congelam no fechamento';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.conta_eventos WHERE conta_id = pg_temp.u('porta') AND evento IN ('medicamento_fora', 'medicamento_volta')) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: histórico do ajuste';
  END IF;
  IF has_table_privilege('authenticated', 'public.conta_medicamentos_fora', 'INSERT') THEN RAISE EXCEPTION 'FALHOU: gravável por fora'; END IF;
  RAISE NOTICE 'OK  ajustes no histórico; tabela só pelas funções';
END $$;
ROLLBACK;
