-- Testes da migration 20260928000007_fase3_phoenix_pelod2.sql. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase3_phoenix_pelod2.sql
-- O cálculo do Phoenix é conferido contra as duas vinhetas clínicas da
-- própria fonte (Sanchez-Pinto et al., JAMA 2024, Supplement 1, eAppendix 2).
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002']::uuid[]) s,
     unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT '22000000-0000-4000-8000-000000000002', 'Box P' || n, 'observacao' FROM generate_series(1, 5) n
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.v(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
-- grava aferições cruas (valor numérico ou código da opção) como a enfermagem
CREATE FUNCTION pg_temp.aferir(p_paciente uuid, p jsonb) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, valor_num, valor_conceito_id, aferido_em, registrado_por)
  SELECT '21000000-0000-4000-8000-000000000001', p_paciente, c.id,
         CASE WHEN jsonb_typeof(e.value) = 'number' THEN (e.value #>> '{}')::numeric END,
         CASE WHEN jsonb_typeof(e.value) = 'string' THEN (SELECT o.id FROM public.conceito_opcao o WHERE o.conceito_id = c.id AND o.valor = e.value #>> '{}') END,
         clock_timestamp(), '10000000-0000-4000-8000-000000000004'
  FROM jsonb_each(p) e JOIN public.conceito c ON c.nome = e.key AND c.unidade_id IS NULL
$$;

-- ── quatro pacientes chegam à porta, são triados e atendidos ────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'e3a', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  json_build_object('nome', 'Phoenix Tres Anos', 'data_nascimento', (current_date - interval '3 years 2 months')::date)::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'e6a', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  json_build_object('nome', 'Phoenix Seis Anos', 'data_nascimento', (current_date - interval '6 years 2 months')::date)::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'esus', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Prostração', NULL,
  json_build_object('nome', 'Phoenix Sem CID', 'data_nascimento', (current_date - interval '5 years')::date)::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'eadu', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse', NULL,
  '{"nome":"Phoenix Adulto","data_nascimento":"1980-01-01"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u(x), 'amarelo',
  '{"frequencia-cardiaca":120,"frequencia-respiratoria":30,"temperatura":39.0,"saturacao-o2":97,"escala-dor":2}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE publico = 'pediatrico' AND nome = 'Alterações cardíacas'), 'História de lipotimia')
FROM unnest(ARRAY['e3a', 'e6a', 'esus']) x;
SELECT public.classificar_risco(pg_temp.u('eadu'), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u(x)) FROM unnest(ARRAY['e3a', 'e6a', 'esus', 'eadu']) x;
SELECT public.registrar_soap(pg_temp.u('e3a'), 'febre', 'hipotensa', 'sepse?', 'ATB', 'A41.9');
SELECT public.registrar_soap(pg_temp.u('e6a'), 'febre, tosse', 'crepitações', 'pneumonia', 'ATB', 'j189');
SELECT public.registrar_soap(pg_temp.u('esus'), 'prostração', 'sem foco', 'a esclarecer', 'observar', 'R53');
SELECT public.registrar_soap(pg_temp.u('eadu'), 'tosse', 'crepitações', 'pneumonia', 'ATB', 'J18.9');
SELECT public.registrar_desfecho(pg_temp.u(x), 'observacao') FROM unnest(ARRAY['e3a', 'e6a', 'esus', 'eadu']) x;
RESET ROLE;
INSERT INTO t SELECT 'p3a', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('e3a');
INSERT INTO t SELECT 'p6a', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('e6a');
INSERT INTO t SELECT 'psus', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('esus');
INSERT INTO t SELECT 'padu', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('eadu');

-- Vinheta 1 (3 anos, Lima): PAM 43, noradrenalina, plaquetas 95 K/μL, irritável (Glasgow ~14)
SELECT pg_temp.aferir(pg_temp.u('p3a'), '{"pressao-arterial-media":43,"drogas-vasoativas":1,"plaquetas":95000,
  "glasgow":14,"pupilas":"reativas","suporte-respiratorio":"nenhum"}');
-- Vinheta 2 (6 anos, Tucson): VMI, FiO2 0,45, SpO2 92 (S/F 204), PAM 52, lactato 2,9,
-- plaquetas 120 K/μL, INR 1,7, D-dímero 4,4 mg/L, fibrinogênio 120 mg/dL, Glasgow 8
SELECT pg_temp.aferir(pg_temp.u('p6a'), '{"suporte-respiratorio":"vmi","fio2":45,"saturacao-o2":92,"pressao-arterial-media":52,
  "lactato":2.9,"plaquetas":120000,"inr":1.7,"d-dimero":4.4,"fibrinogenio":120,"glasgow":8,"pupilas":"reativas","drogas-vasoativas":0}');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'a3a', public.acuidade(pg_temp.u('p3a'))::text;
INSERT INTO t SELECT 'a6a', public.acuidade(pg_temp.u('p6a'))::text;
INSERT INTO t SELECT 'asus', public.acuidade(pg_temp.u('psus'))::text;
INSERT INTO t SELECT 'aadu', public.acuidade(pg_temp.u('padu'))::text;
RESET ROLE;

DO $$
DECLARE a jsonb := pg_temp.v('a3a') -> 'phoenix'; b jsonb := pg_temp.v('a6a') -> 'phoenix';
BEGIN
  IF private.cid_normalizado('j189') <> 'J18.9' OR private.grupo_infeccao('N39.0') IS NULL
     OR private.grupo_infeccao('N39.1') IS NOT NULL OR private.grupo_infeccao('B91') IS NOT NULL
     OR private.grupo_infeccao('R50') IS NOT NULL OR private.grupo_infeccao('T84.6') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: lista de CIDs de infecção';
  END IF;
  RAISE NOTICE 'OK  lista aprovada: N39.0 e T84.6 entram; N39.1, sequela B91 e febre R50 não';
  IF a IS NULL OR (a ->> 'total')::int <> 3 OR (a ->> 'cardiovascular')::int <> 2 OR NOT (a ->> 'choque')::boolean
     OR a -> 'gatilho' ->> 'cid' <> 'A41.9' THEN
    RAISE EXCEPTION 'FALHOU: vinheta 1 (%)', a;
  END IF;
  RAISE NOTICE 'OK  vinheta 1 da fonte: 3 pontos (2 cardiovasculares + 1 coagulação) = choque séptico';
  IF b IS NULL OR (b ->> 'total')::int <> 5 OR (b ->> 'cardiovascular')::int <> 0 OR NOT (b ->> 'sepse')::boolean
     OR (b ->> 'choque')::boolean OR b -> 'gatilho' ->> 'cid' <> 'J18.9' THEN
    RAISE EXCEPTION 'FALHOU: vinheta 2 (%)', b;
  END IF;
  RAISE NOTICE 'OK  vinheta 2 da fonte: 5 pontos (2 resp + 2 coag + 1 neuro) = sepse sem choque; CID digitado sem ponto';
  IF NOT (a ->> 'parcial')::boolean OR NOT (a -> 'faltando') ? 'Lactato' THEN RAISE EXCEPTION 'FALHOU: faltantes'; END IF;
  RAISE NOTICE 'OK  variável não medida não soma ponto e é listada';
  IF pg_temp.v('asus') ? 'phoenix' THEN RAISE EXCEPTION 'FALHOU: Phoenix sem CID nem suspeita'; END IF;
  RAISE NOTICE 'OK  criança sem CID de infecção e sem suspeita: sem Phoenix';
  IF pg_temp.v('aadu') ? 'phoenix' OR pg_temp.v('aadu') ->> 'escala' <> 'NEWS2' THEN RAISE EXCEPTION 'FALHOU: adulto'; END IF;
  RAISE NOTICE 'OK  adulto com pneumonia: NEWS2, sem Phoenix (só pediatria)';
END $$;

-- suspeita de infecção: só o médico marca
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  PERFORM public.marcar_suspeita_infeccao(pg_temp.u('psus'), true);
  RAISE EXCEPTION 'FALHOU: enfermeira marcou suspeita';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'A suspeita de infecção é marcada pelo médico%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  a suspeita de infecção é marcada pelo médico';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.marcar_suspeita_infeccao(pg_temp.u('psus'), true);
INSERT INTO t SELECT 'asus2', public.acuidade(pg_temp.u('psus'))::text;
SELECT public.marcar_suspeita_infeccao(pg_temp.u('psus'), false);
INSERT INTO t SELECT 'asus3', public.acuidade(pg_temp.u('psus'))::text;
INSERT INTO t SELECT 'alertas', (SELECT jsonb_agg(to_jsonb(x)) FROM public.alertas_sepse('21000000-0000-4000-8000-000000000001') x)::text;
RESET ROLE;
DO $$
DECLARE al jsonb := pg_temp.v('alertas');
BEGIN
  IF pg_temp.v('asus2') -> 'phoenix' -> 'gatilho' ->> 'motivo' <> 'suspeita' OR pg_temp.v('asus3') ? 'phoenix' THEN
    RAISE EXCEPTION 'FALHOU: suspeita liga e desliga o Phoenix';
  END IF;
  RAISE NOTICE 'OK  suspeita marcada liga o Phoenix sem CID; retirada desliga';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(al) x WHERE (x ->> 'paciente_id')::uuid = pg_temp.u('p3a') AND x ->> 'nivel' = 'choque')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(al) x WHERE (x ->> 'paciente_id')::uuid = pg_temp.u('p6a') AND x ->> 'nivel' = 'sepse')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(al) x WHERE (x ->> 'paciente_id')::uuid = pg_temp.u('padu')) THEN
    RAISE EXCEPTION 'FALHOU: alertas do painel (%)', al;
  END IF;
  RAISE NOTICE 'OK  painel lista possível choque séptico e possível sepse; adulto fora';
END $$;

-- ── PELOD-2: PEWS alto gera a pendência do dia, uma só ──────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pendencias WHERE paciente_id = pg_temp.u('psus') AND chave LIKE 'pelod2:%') THEN
    RAISE EXCEPTION 'FALHOU: pendência de PELOD-2 sem PEWS alto';
  END IF;
  RAISE NOTICE 'OK  PEWS fora da banda alta não gera PELOD-2';
END $$;
SELECT pg_temp.aferir(pg_temp.u('psus'), '{"frequencia-respiratoria":3}');   -- 5 anos: FR ≤ 4 é zona azul
SELECT pg_temp.aferir(pg_temp.u('psus'), '{"frequencia-cardiaca":170}');
SELECT private.pelod2_rotina();
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'apelod', public.acuidade(pg_temp.u('psus'))::text;
RESET ROLE;
DO $$
DECLARE n int; pe public.pendencias; a jsonb := pg_temp.v('apelod');
BEGIN
  SELECT count(*) INTO n FROM public.pendencias WHERE paciente_id = pg_temp.u('psus') AND chave LIKE 'pelod2:%';
  SELECT * INTO pe FROM public.pendencias WHERE paciente_id = pg_temp.u('psus') AND chave LIKE 'pelod2:%';
  IF n <> 1 OR pe.origem <> 'sistema' OR pe.autor_id IS NOT NULL OR pe.situacao <> 'aberta' OR pe.prazo IS NULL THEN
    RAISE EXCEPTION 'FALHOU: pendência do PELOD-2 (n=%, %)', n, pe;
  END IF;
  RAISE NOTICE 'OK  PEWS alto gera UMA pendência "PELOD-2 do dia", do sistema, mesmo com várias aferições e a rotina';
  IF NOT (a -> 'pelod2' ->> 'indicado')::boolean OR NOT (a -> 'pelod2' ->> 'referencia_carregada')::boolean
     OR (a -> 'pelod2' ->> 'completo')::boolean THEN
    RAISE EXCEPTION 'FALHOU: situação do PELOD-2 (%)', a -> 'pelod2';
  END IF;
  RAISE NOTICE 'OK  PELOD-2 indicado e calculado (Tabela 6), ainda incompleto';
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.concluir_pendencia((SELECT id FROM public.pendencias WHERE paciente_id = pg_temp.u('psus') AND chave LIKE 'pelod2:%'),
  'Exames colhidos; PELOD-2 aguardando referência');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT situacao FROM public.pendencias WHERE paciente_id = pg_temp.u('psus') AND chave LIKE 'pelod2:%') <> 'concluida' THEN
    RAISE EXCEPTION 'FALHOU: concluir PELOD-2';
  END IF;
  PERFORM private.pelod2_rotina();
  IF (SELECT count(*) FROM public.pendencias WHERE paciente_id = pg_temp.u('psus') AND chave LIKE 'pelod2:%') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: concluída no dia não pode renascer no mesmo dia';
  END IF;
  RAISE NOTICE 'OK  o médico conclui com o motivo; no mesmo dia não volta';
END $$;

-- ── PELOD-2 calculado (Leteurtre 2013, Tabela 6) ────────────────────────────
-- Caso montado pela tabela: 3 anos e 2 meses (faixa 24-59 meses).
-- Glasgow pior 8 (1) · pupilas reativas (0) · lactato 6 (1) · PAM 40 (3) ·
-- creatinina 0,7 mg/dL = 61,9 µmol/L ≥ 51 (2) · P/F 60/1,00 = 60 (2) ·
-- PaCO2 70 (1) · VMI (3) · leucócitos 1.500 = 1,5 ×10⁹/L (2) ·
-- plaquetas 100.000 = 100 ×10⁹/L (1) → 16 pontos; logit = 0,91 → 0,7130.
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'epel', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  json_build_object('nome', 'Pelod Tres Anos', 'data_nascimento', (current_date - interval '3 years 2 months')::date)::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('epel'), 'amarelo',
  '{"frequencia-cardiaca":120,"frequencia-respiratoria":30,"temperatura":39.0,"saturacao-o2":97,"escala-dor":2}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE publico = 'pediatrico' AND nome = 'Alterações cardíacas'), 'História de lipotimia');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('epel'));
SELECT public.registrar_soap(pg_temp.u('epel'), 'febre', 'grave', 'choque?', 'UTI', 'A41.9');
SELECT public.registrar_desfecho(pg_temp.u('epel'), 'observacao');
RESET ROLE;
INSERT INTO t SELECT 'ppel', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('epel');
SELECT pg_temp.aferir(pg_temp.u('ppel'), '{"frequencia-respiratoria":3}');         -- zona azul → PEWS alto → pendência
SELECT pg_temp.aferir(pg_temp.u('ppel'), '{"glasgow":14}');
SELECT pg_temp.aferir(pg_temp.u('ppel'), '{"fio2":100}');
SELECT pg_temp.aferir(pg_temp.u('ppel'), '{"glasgow":8,"pupilas":"reativas","lactato":6,"pressao-arterial-media":40,"creatinina":0.7}');
DO $$ BEGIN
  IF (SELECT situacao FROM public.pendencias WHERE paciente_id = pg_temp.u('ppel') AND chave LIKE 'pelod2:%') <> 'aberta' THEN
    RAISE EXCEPTION 'FALHOU: pendência fechou com o PELOD-2 incompleto';
  END IF;
  RAISE NOTICE 'OK  com variáveis faltando, a pendência do PELOD-2 segue aberta';
END $$;
SELECT pg_temp.aferir(pg_temp.u('ppel'), '{"po2":60,"pco2":70,"suporte-respiratorio":"vmi","leucocitos":1500,"plaquetas":100000}');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'apel', public.acuidade(pg_temp.u('ppel'))::text;
RESET ROLE;
DO $$
DECLARE p jsonb := pg_temp.v('apel') -> 'pelod2'; pe public.pendencias;
BEGIN
  IF NOT (p ->> 'referencia_carregada')::boolean OR (p ->> 'total')::int <> 16 OR (p ->> 'mortalidade_prevista')::numeric <> 0.7130
     OR NOT (p ->> 'completo')::boolean THEN
    RAISE EXCEPTION 'FALHOU: PELOD-2 do caso da tabela (%)', p;
  END IF;
  RAISE NOTICE 'OK  PELOD-2 = 16 pelo caso da Tabela 6, com o pior valor de 24 h (Glasgow 8, não 14); mortalidade prevista 0,7130';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'itens') x WHERE x ->> 'grupo' = 'Renal' AND (x ->> 'pontos')::int = 2
                   AND x ->> 'valor' LIKE '0.7 mg/dL = 62 µmol/L%') THEN
    RAISE EXCEPTION 'FALHOU: creatinina convertida só para comparar (%)', p -> 'itens';
  END IF;
  RAISE NOTICE 'OK  creatinina em mg/dL comparada em µmol/L (×88,4), com os dois valores na tela';
  SELECT * INTO pe FROM public.pendencias WHERE paciente_id = pg_temp.u('ppel') AND chave LIKE 'pelod2:%';
  IF pe.situacao <> 'concluida' OR pe.motivo_resolucao <> 'PELOD-2 do dia completo: 16 pontos' OR pe.resolvida_por IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: pendência não se resolveu com o PELOD-2 completo (%)', pe;
  END IF;
  RAISE NOTICE 'OK  a pendência do dia se resolve sozinha quando as 10 variáveis estão registradas';
  IF (private.calcular_pelod2(pg_temp.u('ppel'), 200) -> 'itens' -> 4 ->> 'pontos')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: faixa ≥ 144 meses da creatinina (≥ 93 µmol/L)';
  END IF;
  RAISE NOTICE 'OK  a mesma creatinina (62 µmol/L) não pontua na faixa de 144 meses ou mais';
END $$;
ROLLBACK;
