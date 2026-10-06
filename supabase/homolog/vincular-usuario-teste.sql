-- ════════════════════════════════════════════════════════════════════════════
-- Vínculos e escala do usuário de TESTE da homologação (Fase 0, tarefa 2).
--
-- Dá ao usuário todos os papéis na "UPA Homologação" (troca pelo menu
-- "Trocar perfil") e escala no Pronto Socorro de hoje até daqui a 7 dias, nos
-- três turnos — a escala é a porta de acesso de plantonista, enfermagem e
-- recepção (ADR 0003). Gestor e admin não precisam de escala.
--
-- Gerado com o e-mail por: npm run homolog:copiar -- 8 <email>
-- Rodar no SQL Editor do projeto kswurfyxxvfydpjfrivy. Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_email   text := 'TROQUE-PELO-SEU-EMAIL@exemplo.com';
  v_unidade uuid := '31000000-0000-4000-8000-000000000001';  -- UPA Homologação
  v_ps      uuid := '32000000-0000-4000-8000-000000000001';  -- Pronto Socorro
  v_id      uuid;
BEGIN
  IF v_email LIKE 'TROQUE%' THEN RAISE EXCEPTION 'Troque o e-mail antes de rodar.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = v_unidade) THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a UPA Homologação). Confira a URL do painel.';
  END IF;
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_id IS NULL THEN RAISE EXCEPTION 'Usuário % não existe na homologação.', v_email; END IF;

  INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
  SELECT v_id, v_unidade, p, v_id
    FROM unnest(enum_range(NULL::public.papel)) AS p
  ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true;

  INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, observacao)
  SELECT v_unidade, v_ps, v_id, d::date, t, 'usuario-teste-homologacao'
    FROM generate_series(private.data_atual(), private.data_atual() + 7, interval '1 day') d,
         unnest(ARRAY['manha', 'tarde', 'noite']) t
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Vínculos (% papéis) e escala no Pronto Socorro para %',
    (SELECT count(*) FROM public.vinculos WHERE perfil_id = v_id AND unidade_id = v_unidade AND ativo), v_email;
END $$;
