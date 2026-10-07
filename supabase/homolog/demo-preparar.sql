-- Demo (Fase 0, item 17): prepara a HOMOLOGAÇÃO para a demonstração ao gestor
-- de UPA, apresentada por uma pessoa só (usuário com todos os papéis).
--
--   • escala do usuário da demo HOJE e AMANHÃ, nos 3 turnos, no Pronto Socorro
--     (porta: fila do médico e triagem), na Observação (checagem, alta e leito)
--     e na Clínica Médica (internação);
--   • o check-in fica para a demo (é uma das telas mostradas);
--   • o catálogo de medicamentos vem de demo-medicamentos.sql (rode antes).
--
-- Não apaga nada. Rodar no SQL Editor da HOMOLOGAÇÃO, trocando o e-mail.
-- Uso: npm run homolog:copiar -- 10 <email>   (copia já com o e-mail)
DO $$
DECLARE
  v_email   text := 'TROQUE-PELO-SEU-EMAIL@exemplo.com';
  v_unidade uuid := '31000000-0000-4000-8000-000000000001';  -- UPA Homologação
  v_setores uuid[] := ARRAY['32000000-0000-4000-8000-000000000001',   -- Pronto Socorro
                            '32000000-0000-4000-8000-000000000002',   -- Observação
                            '32000000-0000-4000-8000-000000000003']::uuid[];  -- Clínica Médica
  v_id      uuid;
  v_n       int;
BEGIN
  IF v_email LIKE 'TROQUE%' THEN RAISE EXCEPTION 'Troque o e-mail antes de rodar.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = v_unidade) THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a UPA Homologação). Confira a URL do painel.';
  END IF;
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_id IS NULL THEN RAISE EXCEPTION 'Usuário % não existe na homologação.', v_email; END IF;
  IF (SELECT count(DISTINCT papel) FROM public.vinculos WHERE perfil_id = v_id AND unidade_id = v_unidade AND ativo) < 8 THEN
    RAISE EXCEPTION 'O usuário não tem os 8 papéis na UPA Homologação: rode antes vincular-usuario-teste.sql.';
  END IF;

  INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, observacao)
  SELECT v_unidade, s, v_id, d::date, t, 'demo-gestor-upa'
    FROM unnest(v_setores) s,
         generate_series(private.data_atual(), private.data_atual() + 1, interval '1 day') d,
         unnest(ARRAY['manha', 'tarde', 'noite']) t
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RAISE NOTICE 'Escala da demo: % plantão(ões) novo(s) para % (PS, Observação e Clínica Médica, hoje e amanhã). Medicamentos no catálogo: %.',
    v_n, v_email, (SELECT count(*) FROM public.medicamento WHERE ativo);
END $$;
