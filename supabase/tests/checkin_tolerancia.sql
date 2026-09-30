-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20261014000001_checkin_tolerancia_porta.sql
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/checkin_tolerancia.sql
--
-- A escala é a porta, e o check-in fecha a porta depois da tolerância:
--  * antes da tolerância, sem check-in, entra (e a situação mostra o prazo);
--  * passada a tolerância sem check-in, a porta fecha (paciente some);
--  * o check-in continua possível com a porta fechada e, atrasado, destrava
--    na hora, com o atraso registrado;
--  * fora do raio (com justificativa) ou sem GPS também faz check-in e entra;
--  * a tolerância é da unidade (configuracoes_unidade, padrão 30).
-- As janelas são montadas em volta de now(), com o gatilho desligado só aqui.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-00000000c001'),
  ('uni',    '00000000-0000-4000-8000-00000000c00a'),
  ('uni2',   '00000000-0000-4000-8000-00000000c00b'),
  ('setor',  '00000000-0000-4000-8000-00000000c0a1'),
  ('setor2', '00000000-0000-4000-8000-00000000c0b1'),
  ('pac',    '00000000-0000-4000-8000-00000000c0f1'),
  ('novo',   '00000000-0000-4000-8000-00000000c101'),  -- plantonista, começou há 10 min
  ('atraso', '00000000-0000-4000-8000-00000000c102'),  -- enfermeiro, começou há 1 h, sem check-in
  ('longe',  '00000000-0000-4000-8000-00000000c103'),  -- recepção, check-in fora do raio
  ('semgps', '00000000-0000-4000-8000-00000000c104'),  -- técnico de enfermagem, sem GPS
  ('folga',  '00000000-0000-4000-8000-00000000c105');  -- plantonista na unidade de 90 min
GRANT SELECT ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
END $$;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
-- a porta vista pela pessoa: unidade, setor, pacientes do setor
CREATE FUNCTION pg_temp.porta(p_uni text, p_setor text) RETURNS boolean LANGUAGE sql AS $$
  SELECT private.na_escala_agora(pg_temp.id(p_uni)) AND private.tem_plantao_agora(pg_temp.id(p_setor))
     AND pg_temp.id(p_setor) IN (SELECT private.setores_na_escala_agora())
     AND EXISTS (SELECT 1 FROM public.meu_plantao_agora())
$$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text),
  pg_temp.ok(boolean, text), pg_temp.porta(text, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@tolerancia.local' FROM ids WHERE nome IN ('novo', 'atraso', 'longe', 'semgps', 'folga');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('novo', 'atraso', 'longe', 'semgps', 'folga') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da tolerância');
-- unidade com cerca: raio de 300 m
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, latitude, longitude, raio_metros) VALUES
  (pg_temp.id('uni'),  pg_temp.id('org'), 'UPA da tolerância', 'hospital', -16.6869, -49.2648, 300),
  (pg_temp.id('uni2'), pg_temp.id('org'), 'UPA da folga',      'hospital', NULL, NULL, 500);
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('setor'),  pg_temp.id('uni'),  'Clínica', 'internacao'),
  (pg_temp.id('setor2'), pg_temp.id('uni2'), 'Clínica', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('novo'),   pg_temp.id('uni'),  'plantonista'),
  (pg_temp.id('atraso'), pg_temp.id('uni'),  'enfermeiro'),
  (pg_temp.id('longe'),  pg_temp.id('uni'),  'recepcao'),
  (pg_temp.id('semgps'), pg_temp.id('uni'),  'tecnico_enfermagem'),
  (pg_temp.id('folga'),  pg_temp.id('uni2'), 'plantonista');
INSERT INTO public.pacientes (id, unidade_id, nome, setor_id) VALUES
  (pg_temp.id('pac'), pg_temp.id('uni'), 'Paciente da tolerância', pg_temp.id('setor'));
-- a unidade da folga dá 90 min de tolerância
INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor)
VALUES (pg_temp.id('uni2'), 'checkin_tolerancia_min', '90');

ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  (pg_temp.id('uni'),  pg_temp.id('setor'),  pg_temp.id('novo'),   private.data_atual(), 'manha', now() - interval '10 minutes', 360),
  (pg_temp.id('uni'),  pg_temp.id('setor'),  pg_temp.id('atraso'), private.data_atual(), 'manha', now() - interval '1 hour', 360),
  (pg_temp.id('uni'),  pg_temp.id('setor'),  pg_temp.id('longe'),  private.data_atual(), 'manha', now() - interval '45 minutes', 360),
  (pg_temp.id('uni'),  pg_temp.id('setor'),  pg_temp.id('semgps'), private.data_atual(), 'manha', now() - interval '2 hours', 360),
  (pg_temp.id('uni2'), pg_temp.id('setor2'), pg_temp.id('folga'),  private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

SET LOCAL ROLE authenticated;

-- ── 1. antes da tolerância, sem check-in: entra, com o prazo à vista ────────
SELECT pg_temp.como('novo');
SELECT pg_temp.ok(pg_temp.porta('uni', 'setor'), 'antes da tolerância, sem check-in, a escala abre a porta');
SELECT pg_temp.ok((SELECT count(*) FROM public.pacientes WHERE id = pg_temp.id('pac')) = 1,
  'antes da tolerância o paciente do setor aparece');
SELECT pg_temp.ok((SELECT s->>'bloqueado' = 'false' AND s->>'liberado' = 'true' AND s->'pendente' IS NOT NULL
                          AND (s->>'tolerancia_min')::int = 30
                          AND (s->'pendente'->>'prazo')::timestamptz > now()
                     FROM public.situacao_checkin(pg_temp.id('uni')) s),
  'situacao_checkin: check-in pendente, prazo à frente, tolerância padrão de 30 min');

-- ── 2. passada a tolerância sem check-in: porta fechada ────────────────────
SELECT pg_temp.como('atraso');
SELECT pg_temp.ok(NOT private.na_escala_agora(pg_temp.id('uni')), 'passada a tolerância sem check-in, na_escala_agora é falso');
SELECT pg_temp.ok(NOT private.tem_plantao_agora(pg_temp.id('setor')), 'passada a tolerância, tem_plantao_agora é falso');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM private.setores_na_escala_agora()), 'passada a tolerância, nenhum setor na escala');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.meu_plantao_agora()), 'passada a tolerância, meu_plantao_agora vazio');
SELECT pg_temp.ok((SELECT count(*) FROM public.pacientes WHERE id = pg_temp.id('pac')) = 0,
  'passada a tolerância, o paciente do setor some');
SELECT pg_temp.ok((SELECT s->>'bloqueado' = 'true' AND s->>'liberado' = 'false' AND s->>'na_janela' = 'true'
                          AND (s->'pendente'->>'prazo')::timestamptz <= now()
                     FROM public.situacao_checkin(pg_temp.id('uni')) s),
  'situacao_checkin: bloqueado, com o prazo vencido');

-- ── 3. o check-in continua possível com a porta fechada, e destrava ────────
DO $$
DECLARE v uuid; r public.presenca_plantonista%ROWTYPE;
BEGIN
  v := public.registrar_checkin(pg_temp.id('uni'), -16.6870, -49.2649);
  SELECT * INTO r FROM public.presenca_plantonista WHERE id = v;
  IF r.escala_plantao_id IS NULL OR r.checkin_dentro IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: check-in atrasado deveria ficar no plantão, dentro do raio';
  END IF;
  IF r.checkin_em - (SELECT e.inicio FROM public.escala_plantao e WHERE e.id = r.escala_plantao_id) < interval '59 minutes' THEN
    RAISE EXCEPTION 'FALHOU: o atraso do check-in deveria ficar registrado';
  END IF;
  RAISE NOTICE 'OK  com a porta fechada o check-in passa, ligado ao plantão, com o atraso registrado';
END $$;
SELECT pg_temp.ok(pg_temp.porta('uni', 'setor'), 'feito o check-in atrasado, a porta abre na hora');
SELECT pg_temp.ok((SELECT count(*) FROM public.pacientes WHERE id = pg_temp.id('pac')) = 1,
  'feito o check-in, o paciente do setor volta');
SELECT pg_temp.ok((SELECT s->>'bloqueado' = 'false' AND s->'pendente' = 'null'::jsonb
                     FROM public.situacao_checkin(pg_temp.id('uni')) s),
  'situacao_checkin: liberado e sem pendência depois do check-in');

-- ── 4. fora do raio: registra (com justificativa) e entra ──────────────────
SELECT pg_temp.como('longe');
SELECT pg_temp.ok(NOT pg_temp.porta('uni', 'setor'), 'recepção 45 min depois do início, sem check-in: porta fechada');
SELECT pg_temp.falha($$SELECT public.registrar_checkin(pg_temp.id('uni'), -16.7200, -49.3000)$$,
  'CHECKIN_FORA_DO_RAIO', 'fora do raio sem justificativa o check-in pede a justificativa');
DO $$
DECLARE v uuid; r public.presenca_plantonista%ROWTYPE;
BEGIN
  v := public.registrar_checkin(pg_temp.id('uni'), -16.7200, -49.3000, NULL, 'GPS marcando outro bairro');
  SELECT * INTO r FROM public.presenca_plantonista WHERE id = v;
  IF r.checkin_dentro IS NOT FALSE OR r.checkin_justificativa IS NULL OR r.checkin_distancia_m < 300 THEN
    RAISE EXCEPTION 'FALHOU: check-in fora do raio deveria registrar fora, a distância e a justificativa';
  END IF;
  RAISE NOTICE 'OK  fora do raio o check-in registra fora, a distância e a justificativa';
END $$;
SELECT pg_temp.ok(pg_temp.porta('uni', 'setor'), 'check-in fora do raio também abre a porta (o raio não é exigido)');

-- ── 5. sem GPS também faz check-in ─────────────────────────────────────────
SELECT pg_temp.como('semgps');
SELECT pg_temp.ok(NOT pg_temp.porta('uni', 'setor'), 'técnico 2 h depois do início, sem check-in: porta fechada');
SELECT public.registrar_checkin(pg_temp.id('uni'), NULL, NULL, NULL, 'Celular sem GPS hoje, estou na sala de medicação');
SELECT pg_temp.ok(pg_temp.porta('uni', 'setor'), 'check-in sem GPS (com justificativa) abre a porta');

-- ── 6. a tolerância é da unidade ───────────────────────────────────────────
SELECT pg_temp.como('folga');
SELECT pg_temp.ok(pg_temp.porta('uni2', 'setor2'), 'com tolerância de 90 min, 1 h depois do início ainda entra sem check-in');
SELECT pg_temp.ok((SELECT (s->>'tolerancia_min')::int = 90 FROM public.situacao_checkin(pg_temp.id('uni2')) s),
  'situacao_checkin devolve a tolerância da unidade');
RESET ROLE;
UPDATE public.configuracoes_unidade SET valor = '45' WHERE unidade_id = pg_temp.id('uni2') AND chave = 'checkin_tolerancia_min';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('folga');
SELECT pg_temp.ok(NOT pg_temp.porta('uni2', 'setor2'), 'o gestor baixa a tolerância para 45 min: 1 h depois sem check-in fecha');
RESET ROLE;
UPDATE public.configuracoes_unidade SET valor = 'abc' WHERE unidade_id = pg_temp.id('uni2') AND chave = 'checkin_tolerancia_min';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('folga');
SELECT pg_temp.ok((SELECT (s->>'tolerancia_min')::int = 30 FROM public.situacao_checkin(pg_temp.id('uni2')) s),
  'valor inválido na configuração vale o padrão de 30 min');

-- ── 7. dois setores ao mesmo tempo: um check-in só; turno seguinte: outro ──
RESET ROLE;
INSERT INTO ids VALUES ('setor3', '00000000-0000-4000-8000-00000000c0a3'), ('seguido', '00000000-0000-4000-8000-00000000c106');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor3'), pg_temp.id('uni'), 'Observação', 'observacao');
INSERT INTO auth.users (id, email) VALUES (pg_temp.id('seguido'), 'seguido@tolerancia.local');
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('seguido'), 'seguido') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('seguido'), pg_temp.id('uni'), 'plantonista');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  -- o técnico sem GPS também está na Observação, noutro rótulo, desde 50 min atrás
  (pg_temp.id('uni'), pg_temp.id('setor3'), pg_temp.id('semgps'),  private.data_atual(), 'tarde', now() - interval '50 minutes', 360),
  -- turnos seguidos: a manhã acabou há 1 h (com check-in), a tarde começou há 1 h
  (pg_temp.id('uni'), pg_temp.id('setor'),  pg_temp.id('seguido'), private.data_atual(), 'manha', now() - interval '7 hours', 360),
  (pg_temp.id('uni'), pg_temp.id('setor'),  pg_temp.id('seguido'), private.data_atual(), 'tarde', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio + interval '5 minutes'
  FROM public.escala_plantao e WHERE e.perfil_id = pg_temp.id('seguido') AND e.turno = 'manha';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('semgps');
SELECT pg_temp.ok(pg_temp.porta('uni', 'setor3'), 'o check-in feito dentro da janela vale para o outro setor do mesmo horário');
SELECT pg_temp.como('seguido');
SELECT pg_temp.ok(NOT pg_temp.porta('uni', 'setor'), 'o check-in da manhã não vale para a tarde seguinte: passada a tolerância, fecha');
SELECT public.registrar_checkin(pg_temp.id('uni'), -16.6870, -49.2649);
SELECT pg_temp.ok(pg_temp.porta('uni', 'setor'), 'o check-in da tarde abre a porta da tarde');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.presenca_plantonista WHERE perfil_id = pg_temp.id('seguido')),
  'cada turno fica com a sua presença');

-- ── 8. o check-in exige estar na janela (antes do plantão, nada) ───────────
RESET ROLE;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
UPDATE public.escala_plantao SET inicio = now() + interval '2 hours' WHERE perfil_id = pg_temp.id('novo');
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('novo');
SELECT pg_temp.falha($$SELECT public.registrar_checkin(pg_temp.id('uni'), -16.6870, -49.2649)$$,
  'Você não está em escala', 'antes da janela o check-in continua recusado');
SELECT pg_temp.ok((SELECT s->>'na_janela' = 'false' AND s->>'bloqueado' = 'false'
                     FROM public.situacao_checkin(pg_temp.id('uni')) s),
  'fora da janela a situação não é bloqueio (é fora do expediente)');

RESET ROLE;
ROLLBACK;
