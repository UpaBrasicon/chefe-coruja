-- ════════════════════════════════════════════════════════════════════════════
-- Guarda do B11 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md;
-- decisão do RT em 31/10/2026: "Libera só a aba Escala"). Sem migration: a
-- correção é da tela (o portão do check-in ganha "Ver minha escala"); este
-- teste prova que, com o portão fechado, o banco deixa a aba Escala funcionar
-- e continua fechando o clínico.
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_portao_checkin.sql
--
-- Quem passou da tolerância sem check-in:
--  * continua vendo a escala da unidade (o próprio plantão e o da equipe);
--  * justifica a falta do plantão;
--  * não vê o paciente do setor (o clínico segue fechado).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-00000000d101'),
  ('uni',    '00000000-0000-4000-8000-00000000d10a'),
  ('setor',  '00000000-0000-4000-8000-00000000d1a1'),
  ('pac',    '00000000-0000-4000-8000-00000000d1f1'),
  ('atraso', '00000000-0000-4000-8000-00000000d111'),  -- enfermeiro, começou há 1 h, sem check-in
  ('colega', '00000000-0000-4000-8000-00000000d112'),
  ('pAtraso','00000000-0000-4000-8000-00000000d121'),
  ('pColega','00000000-0000-4000-8000-00000000d122');
GRANT SELECT ON ids TO authenticated;
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
GRANT ALL ON resultado TO authenticated;
GRANT USAGE ON SEQUENCE resultado_n_seq TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.ok(boolean, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@portao-escala.local' FROM ids WHERE nome IN ('atraso', 'colega');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('atraso', 'colega')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org do portão');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA do portão', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Clínica', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('atraso'), pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('colega'), pg_temp.id('uni'), 'enfermeiro');
INSERT INTO public.pacientes (id, unidade_id, nome, setor_id) VALUES
  (pg_temp.id('pac'), pg_temp.id('uni'), 'Paciente do portão', pg_temp.id('setor'));

ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, papel) VALUES
  (pg_temp.id('pAtraso'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('atraso'), private.data_atual(), 'manha', now() - interval '1 hour', 360, 'enfermeiro'),
  (pg_temp.id('pColega'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('colega'), private.data_atual() + 2, 'manha', now() + interval '2 days', 360, 'enfermeiro');
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('atraso');
SELECT pg_temp.ok((SELECT s->>'bloqueado' = 'true' FROM public.situacao_checkin(pg_temp.id('uni')) s),
  'passada a tolerância sem check-in, o portão está fechado');
SELECT pg_temp.ok((SELECT count(*) FROM public.pacientes WHERE id = pg_temp.id('pac')) = 0,
  'B11: com o portão fechado, o paciente do setor continua fora');
SELECT pg_temp.ok((SELECT count(*) FROM public.escala_da_unidade(pg_temp.id('uni'), private.data_atual(), private.data_atual() + 7)
                    WHERE id IN (pg_temp.id('pAtraso'), pg_temp.id('pColega'))) = 2,
  'B11: com o portão fechado, a escala da unidade abre (o meu plantão e o da equipe)');
INSERT INTO public.solicitacoes_escala (unidade_id, escala_plantao_id, perfil_id, tipo, tipo_falta, justificativa, criado_por)
VALUES (pg_temp.id('uni'), pg_temp.id('pAtraso'), pg_temp.id('atraso'), 'justificar_falta', 'atestado_medico',
        'Atestado do dia', pg_temp.id('atraso'));
SELECT pg_temp.ok((SELECT count(*) FROM public.solicitacoes_escala
                    WHERE escala_plantao_id = pg_temp.id('pAtraso') AND tipo = 'justificar_falta' AND status = 'pendente') = 1,
  'B11: com o portão fechado, a falta do plantão é justificada');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
