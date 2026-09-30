-- Testes da migration 20261003000007_atendimentos_sem_desfecho.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_atendimentos_sem_desfecho.sql
--
-- Paciente (…0091) internado na Clínica Médica, onde o plantonista (…0002)
-- está escalado agora. Ele tem, no Pronto Socorro (setor que o plantonista
-- não vê pela RLS), um atendimento SEM desfecho (…0091) e um com alta (…0092).
-- O banco só admite um atendimento aberto por paciente
-- (episodios_um_aberto_por_paciente), então há no máximo um sem desfecho.
BEGIN;

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id)
VALUES ('23000000-0000-4000-8000-000000000091', '21000000-0000-4000-8000-000000000001', 'Paciente Sem Desfecho',
        '1970-03-03', 'T-091', '22000000-0000-4000-8000-000000000001');

INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES ('25000000-0000-4000-8000-000000000092', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000091',
        '22000000-0000-4000-8000-000000000003', 'atendimento', 'febre com alta', '10000000-0000-4000-8000-000000000002', now() - interval '5 days');
-- o de alta se encerra antes de o próximo abrir (um aberto por paciente)
UPDATE public.episodios SET desfecho = 'alta', desfecho_em = now() - interval '5 days', etapa = 'encerrado', encerrado_em = now() - interval '5 days'
WHERE id = '25000000-0000-4000-8000-000000000092';
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES ('25000000-0000-4000-8000-000000000091', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000091',
        '22000000-0000-4000-8000-000000000003', 'atendimento', 'dor abdominal sem desfecho', '10000000-0000-4000-8000-000000000002', now() - interval '3 days');
INSERT INTO public.atendimento_registros (episodio_id, unidade_id, paciente_id, subjetivo, plano, autor_id)
VALUES ('25000000-0000-4000-8000-000000000091', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000091',
        'Dor em fossa ilíaca direita', 'Aguardar ultrassom', '10000000-0000-4000-8000-000000000002');

-- plantonista escalado agora na Clínica Médica (não no Pronto Socorro)
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
        private.data_atual(), private.turno_atual(), now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

-- alguém sem vínculo com a unidade
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-000000000089', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'sem-vinculo@teste.local', '', now(), '{}', '{"nome_completo":"Sem Vínculo"}', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-000000000089', 'Sem Vínculo') ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;

-- ── 1. plantonista com o paciente: vê só o atendimento em aberto ────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE n int; v_texto text;
BEGIN
  -- a RLS sozinha não mostra o Pronto Socorro para ele: é por isso que existe a função
  IF EXISTS (SELECT 1 FROM public.episodios WHERE id = '25000000-0000-4000-8000-000000000091') THEN
    RAISE NOTICE 'aviso: a RLS já mostrava o episódio do outro setor';
  END IF;
  SELECT count(*) INTO n FROM public.atendimentos_sem_desfecho('23000000-0000-4000-8000-000000000091', NULL);
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: esperava 1 atendimento sem desfecho, veio %', n; END IF;
  SELECT ultimo_registro INTO v_texto FROM public.atendimentos_sem_desfecho('23000000-0000-4000-8000-000000000091', NULL);
  IF v_texto NOT LIKE 'S: Dor em fossa ilíaca direita%P: Aguardar ultrassom' THEN
    RAISE EXCEPTION 'FALHOU: último registro não veio: %', v_texto;
  END IF;
  IF EXISTS (SELECT 1 FROM public.atendimentos_sem_desfecho('23000000-0000-4000-8000-000000000091', NULL)
             WHERE episodio_id = '25000000-0000-4000-8000-000000000092') THEN
    RAISE EXCEPTION 'FALHOU: veio atendimento com desfecho';
  END IF;
  -- passado como exceção (é o atendimento que está na tela), some
  SELECT count(*) INTO n FROM public.atendimentos_sem_desfecho('23000000-0000-4000-8000-000000000091', '25000000-0000-4000-8000-000000000091');
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: a exceção não tirou o atendimento da tela (veio %)', n; END IF;
  RAISE NOTICE 'OK  plantonista vê o atendimento sem desfecho de outro setor, sem os que têm desfecho';
END $$;

-- ── 2. gestor da unidade também vê ──────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.atendimentos_sem_desfecho('23000000-0000-4000-8000-000000000091', NULL)) THEN
    RAISE EXCEPTION 'FALHOU: gestor não vê o atendimento sem desfecho';
  END IF;
  RAISE NOTICE 'OK  gestor vê';
END $$;

-- ── 3. quem não está com o paciente não vê ──────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000089');
DO $$ BEGIN
  BEGIN
    PERFORM public.atendimentos_sem_desfecho('23000000-0000-4000-8000-000000000091');
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'OK  sem vínculo: recusado';
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: pessoa sem vínculo leu os atendimentos';
END $$;

ROLLBACK;
