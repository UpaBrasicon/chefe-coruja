-- Testes das migrations 20260929000004 (diluição versionada) e 20260929000005
-- (prescrição estruturada). ROLLBACK no fim. O banco local não traz o cadastro
-- de medicamentos: o teste usa uma amostra própria.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
-- o admin de teste também é farmacêutico nesta unidade
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 'farmaceutico') ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Ceftriaxona', 'ceftriaxona', 'pó 1 g', 'teste'),
  ('Dipirona', 'dipirona', 'solução 500 mg/mL 2 mL', 'teste'),
  ('Noradrenalina (norepinefrina)', 'noradrenalina norepinefrina', 'solução 1 mg/mL 4 mL', 'teste');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'cef', id::text FROM public.medicamento WHERE principio_ativo_norm = 'ceftriaxona' AND fonte = 'teste';
INSERT INTO t SELECT 'dip', id::text FROM public.medicamento WHERE principio_ativo_norm = 'dipirona' AND fonte = 'teste';
INSERT INTO t SELECT 'nor', id::text FROM public.medicamento WHERE principio_ativo_norm = 'noradrenalina norepinefrina' AND fonte = 'teste';
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
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

-- ── 4.5: o farmacêutico publica; a publicada não se edita ───────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.salvar_diluicao(NULL, %L)', json_build_object('medicamento_id', pg_temp.u('cef'), 'via', 'EV')),
  'Diluição é do farmacêutico', 'só o farmacêutico mexe em diluição');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
INSERT INTO t SELECT 'd1', public.salvar_diluicao(NULL, json_build_object('medicamento_id', pg_temp.u('cef'), 'via', 'EV',
  'fonte', 'Manual de diluição da unidade, v1', 'reconstituicao_diluente', 'AD', 'reconstituicao_volume_ml', '10',
  'diluicao_solucao', json_build_array('SF 0,9%'), 'diluicao_volume_min_ml', '100')::jsonb);
SELECT pg_temp.falha(format('SELECT public.publicar_diluicao_versao(%L)', pg_temp.u('d1')), 'Sem o CRF do revisor', 'sem CRF do revisor não publica');
SELECT public.salvar_diluicao(pg_temp.u('d1'), '{"revisor_crf":"CRF-GO 12345"}');
SELECT pg_temp.falha(format('SELECT public.publicar_diluicao_versao(%L)', pg_temp.u('d1')), 'Via EV: sem volume mínimo e tempo de infusão',
  'via EV sem tempo de infusão não publica');
SELECT public.salvar_diluicao(pg_temp.u('d1'), '{"tempo_infusao_min":"30"}');
SELECT public.publicar_diluicao_versao(pg_temp.u('d1'));
RESET ROLE;
-- a v1 passa a valer "em janeiro"
ALTER TABLE public.diluicao DISABLE TRIGGER trg_diluicao_imutavel;
UPDATE public.diluicao SET vigente_desde = '2026-01-01' WHERE id = pg_temp.u('d1');
ALTER TABLE public.diluicao ENABLE TRIGGER trg_diluicao_imutavel;

-- ── 4.4: paciente na porta, prescrição do médico ────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Prescricao Adulto","data_nascimento":"1970-03-03"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'epc', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  json_build_object('nome', 'Prescricao Crianca', 'data_nascimento', (current_date - interval '4 years')::date)::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO t SELECT 'crianca', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('epc');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('cef'), 'dose', '1 g', 'via', 'EV', 'posologia', '24/24h')),
  'A prescrição é do médico', 'enfermagem não prescreve');
SELECT public.registrar_alergia(pg_temp.u('pac'), 'Dipirona', 'urticária');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('cef'), 'via', 'EV', 'posologia', '24/24h')), 'Informe a dose', 'sem dose não prescreve (nada é sugerido)');
INSERT INTO t SELECT 'i1', public.prescrever(pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('cef'), 'dose', '1 g', 'via', 'ev', 'posologia', '24/24h')::jsonb);
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('cef'), 'dose', '2 g', 'via', 'EV', 'posologia', '24/24h')),
  'Este medicamento já está prescrito', 'o mesmo medicamento pela mesma via não se repete');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('dip'), 'dose', '1 g', 'via', 'EV', 'posologia', '6/6h', 'se_necessario', true)),
  'ALERGIA', 'alergia registrada trava o item');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('nor'), 'dose', '0,1 mcg/kg/min', 'via', 'EV', 'posologia', 'contínuo',
                    'diluicao_divergente', '4 mg em 250 mL SG 5%')), 'Diluição diferente do padrão só com justificativa',
  'diluição fora do padrão exige justificativa');
INSERT INTO t SELECT 'i2', public.prescrever(pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('nor'), 'dose', '0,1 mcg/kg/min', 'via', 'EV', 'posologia', 'contínuo',
                    'diluicao_divergente', '4 mg em 250 mL SG 5%', 'justificativa_divergencia', 'restrição hídrica, concentração dobrada')::jsonb);
INSERT INTO t SELECT 'i3', public.prescrever(pg_temp.u('pac'), '{"tipo":"cuidado","descricao":"Cabeceira elevada 30°"}');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('crianca'),
  json_build_object('medicamento_id', pg_temp.u('cef'), 'dose', '50 mg/kg', 'via', 'EV', 'posologia', '24/24h')),
  'Criança: registre o peso', 'criança sem peso aferido no atendimento não recebe medicamento');
RESET ROLE;
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, valor_num, aferido_em)
SELECT '21000000-0000-4000-8000-000000000001', pg_temp.u('crianca'), id, 16.4, clock_timestamp() FROM public.conceito WHERE nome = 'peso' AND unidade_id IS NULL;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'i4', public.prescrever(pg_temp.u('crianca'),
  json_build_object('medicamento_id', pg_temp.u('cef'), 'dose', '50 mg/kg (820 mg)', 'via', 'EV', 'posologia', '24/24h')::jsonb);
RESET ROLE;
DO $$
DECLARE a public.prescricao_itens; b public.prescricao_itens; c public.prescricao_itens;
BEGIN
  SELECT * INTO a FROM public.prescricao_itens WHERE id = pg_temp.u('i1');
  SELECT * INTO b FROM public.prescricao_itens WHERE id = pg_temp.u('i2');
  SELECT * INTO c FROM public.prescricao_itens WHERE id = pg_temp.u('i4');
  IF a.diluicao_versao <> 1 OR a.diluicao_texto NOT LIKE 'Reconstituir em 10 mL de AD; Diluir em SF 0,9% (mín. 100 mL)%infundir em 30 min%'
     OR a.via <> 'EV' OR a.autor_id <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: item com a diluição vigente (%)', a;
  END IF;
  RAISE NOTICE 'OK  o item guarda a diluição vigente (versão 1) e o autor do login';
  IF NOT b.diluicao_divergente OR b.diluicao_texto <> '4 mg em 250 mL SG 5%' THEN RAISE EXCEPTION 'FALHOU: divergência (%)', b; END IF;
  RAISE NOTICE 'OK  diluição fora do padrão fica marcada, com a justificativa';
  IF c.peso_kg <> 16.4 THEN RAISE EXCEPTION 'FALHOU: peso da criança no item (%)', c.peso_kg; END IF;
  RAISE NOTICE 'OK  com o peso aferido, a criança recebe o item e o peso fica gravado nele';
END $$;

-- ── o farmacêutico muda a diluição: a prescrição de janeiro não muda ────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
INSERT INTO t SELECT 'd2', public.salvar_diluicao(pg_temp.u('d1'), '{"tempo_infusao_min":"60"}');
SELECT pg_temp.falha(format('SELECT public.publicar_diluicao_versao(%L)', pg_temp.u('d2')), 'Sem o CRF do revisor',
  'a nova versão pede nova revisão (o CRF não é herdado)');
SELECT public.salvar_diluicao(pg_temp.u('d2'), '{"revisor_crf":"CRF-GO 12345"}');
SELECT pg_temp.falha(format('SELECT public.publicar_diluicao_versao(%L)', pg_temp.u('d2')), 'Nova versão: diga o que mudou',
  'nova versão exige dizer o que mudou');
SELECT public.salvar_diluicao(pg_temp.u('d2'), '{"motivo_alteracao":"tempo de infusão revisto pela CCIH"}');
SELECT public.publicar_diluicao_versao(pg_temp.u('d2'));
RESET ROLE;
DO $$
BEGIN
  BEGIN
    UPDATE public.diluicao SET tempo_infusao_min = 15 WHERE id = pg_temp.u('d1');
    RAISE EXCEPTION 'FALHOU: publicada editada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Diluição publicada não se edita%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  diluição publicada não se edita: muda só por nova versão';
  IF (SELECT status FROM public.diluicao WHERE id = pg_temp.u('d1')) <> 'substituido'
     OR (SELECT versao FROM public.diluicao WHERE id = pg_temp.u('d2')) <> 2
     OR (SELECT versao FROM public.diluicao_vigente(pg_temp.u('cef'), 'EV', '2026-01-15')) <> 1
     OR (SELECT versao FROM public.diluicao_vigente(pg_temp.u('cef'), 'EV')) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: vigência das versões';
  END IF;
  RAISE NOTICE 'OK  a versão 1 fica visível como substituída; em 15/01 vale a 1, hoje vale a 2';
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'pv', (SELECT jsonb_agg(to_jsonb(x)) FROM public.prescricao_vigente(pg_temp.u('pac')) x)::text;
SELECT public.suspender_item(pg_temp.u('i1'), 'troca de antibiótico');
INSERT INTO t SELECT 'i5', public.prescrever(pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('cef'), 'dose', '2 g', 'via', 'EV', 'posologia', '24/24h')::jsonb);
INSERT INTO t SELECT 'pv2', (SELECT jsonb_agg(to_jsonb(x)) FROM public.prescricao_vigente(pg_temp.u('pac')) x)::text;
RESET ROLE;
DO $$
DECLARE antes jsonb := pg_temp.v('pv')::jsonb; depois jsonb := pg_temp.v('pv2')::jsonb; x jsonb;
BEGIN
  SELECT e INTO x FROM jsonb_array_elements(antes) e WHERE (e ->> 'id')::uuid = pg_temp.u('i1');
  IF (x ->> 'diluicao_versao')::int <> 1 OR x ->> 'diluicao_texto' NOT LIKE '%infundir em 30 min%' THEN
    RAISE EXCEPTION 'FALHOU: pronto quando (%)', x;
  END IF;
  RAISE NOTICE 'OK  PRONTO QUANDO: a prescrição feita sob a versão 1 continua mostrando a versão 1 depois de a diluição mudar';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(antes) e WHERE (e ->> 'id')::uuid = pg_temp.u('i2') AND (e ->> 'vasoativo')::boolean) THEN
    RAISE EXCEPTION 'FALHOU: noradrenalina marcada como vasoativa';
  END IF;
  RAISE NOTICE 'OK  noradrenalina sai marcada como vasoativa (lista do Phoenix)';
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(depois) e WHERE (e ->> 'id')::uuid = pg_temp.u('i1'))
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(depois) e WHERE (e ->> 'id')::uuid = pg_temp.u('i5') AND (e ->> 'diluicao_versao')::int = 2)
     OR (SELECT suspenso_em FROM public.prescricao_itens WHERE id = pg_temp.u('i1')) IS NULL THEN
    RAISE EXCEPTION 'FALHOU: suspender e prescrever de novo';
  END IF;
  RAISE NOTICE 'OK  suspenso não some do banco, sai da prescrição vigente; o novo item já pega a versão 2';
END $$;
ROLLBACK;
