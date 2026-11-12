-- ════════════════════════════════════════════════════════════════════════════
-- Unidade de demonstração (pedido 8, J4) — 3/4: acesso de uma conta real.
--
-- Decisão G2 do RT (12/11/2026): a captura usa a conta do próprio RT, sem conta
-- nova e sem senha nova. Este roteiro dá a ela, na UPA 24h Jardim Primavera:
--   • os papéis gestor (porta, painel e escala do gestor) e plantonista;
--   • a escala de hoje no Pronto Socorro, nos três turnos (e a noite de ontem,
--     se ainda estiver em curso), para ver os pacientes na porta do médico.
--     Turno em que a conta já está escalada em outro lugar fica de fora (a
--     escala recusa sobreposição) e aparece no aviso.
-- O check-in fica para quem entra (como em demo-preparar.sql): sem ele, passada
-- a tolerância de 30 min, a porta do médico fecha. As telas do gestor não
-- dependem da escala.
--
-- SÓ NA HOMOLOGAÇÃO. Troque o e-mail antes de rodar (o roteiro para se não
-- trocar). Não apaga nada; repetível. O 99 tira estes acessos junto com a rede.
--
-- Uso (homologação): npx supabase db query --linked -f scripts/demo/03_acesso_conta.sql
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_email   text := 'TROQUE-PELO-SEU-EMAIL@exemplo.com';
  v_unidade constant uuid := 'd0100000-0000-4000-8000-000000000001';  -- UPA 24h Jardim Primavera
  v_ps      constant uuid := 'd0200000-0000-4000-8000-000000000001';  -- Pronto Socorro
  v_hoje    date := private.data_atual();
  v_id      uuid;
  v_papel   text;
  p         record;
  v_conflito text;
  v_novos   int := 0;
  v_n       int;
  v_fora    text[] := '{}';
BEGIN
  IF v_email LIKE 'TROQUE%' THEN RAISE EXCEPTION 'Troque o e-mail antes de rodar.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = '31000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a UPA Homologação). Confira o projeto ligado (kswurfyxxvfydpjfrivy).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = v_unidade) THEN
    RAISE EXCEPTION 'A UPA 24h Jardim Primavera não existe: rode antes scripts/demo/01_rede_demonstracao.sql.';
  END IF;
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_id IS NULL THEN RAISE EXCEPTION 'Usuário % não existe na homologação.', v_email; END IF;
  IF v_id::text LIKE 'd0300000%' THEN RAISE EXCEPTION 'Esta é uma conta da equipe fictícia: use uma conta real.'; END IF;

  -- papéis (religa o vínculo se estava desligado)
  FOREACH v_papel IN ARRAY ARRAY['gestor', 'plantonista'] LOOP
    UPDATE public.vinculos SET ativo = true
     WHERE perfil_id = v_id AND unidade_id = v_unidade AND papel = v_papel::public.papel AND NOT ativo;
    INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
    SELECT v_id, v_unidade, v_papel::public.papel
     WHERE NOT EXISTS (SELECT 1 FROM public.vinculos
                        WHERE perfil_id = v_id AND unidade_id = v_unidade AND papel = v_papel::public.papel);
  END LOOP;

  -- escala de hoje no Pronto Socorro, como plantonista
  FOR p IN SELECT x.data, x.turno FROM (VALUES (v_hoje - 1, 'noite'), (v_hoje, 'manha'), (v_hoje, 'tarde'), (v_hoje, 'noite')) x(data, turno)
            WHERE now() < private.inicio_do_turno(x.data, x.turno) + make_interval(mins => private.duracao_padrao(x.turno)) LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.perfil_id = v_id AND e.setor_id = v_ps
                            AND e.data = p.data AND e.turno = p.turno AND e.ativo);
    v_conflito := private.conflito_escala(v_id, private.inicio_do_turno(p.data, p.turno), private.duracao_padrao(p.turno), NULL);
    IF v_conflito IS NOT NULL THEN
      v_fora := v_fora || (p.turno || ' de ' || to_char(p.data, 'DD/MM') || ': já escalado(a) ' || v_conflito);
      CONTINUE;
    END IF;
    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel, observacao)
    VALUES (v_unidade, v_ps, v_id, p.data, p.turno, 'plantonista', 'demonstração (J4)')
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_novos := v_novos + v_n;
  END LOOP;

  RAISE NOTICE 'Acesso de % na UPA 24h Jardim Primavera: gestor e plantonista; % plantão(ões) novo(s) no Pronto Socorro.', v_email, v_novos;
  IF cardinality(v_fora) > 0 THEN
    RAISE NOTICE 'Fora da escala da demonstração (sobreposição): %', array_to_string(v_fora, '; ');
  END IF;
END $$;

SELECT 'acesso da conta' AS situacao, v.papel, v.ativo
  FROM public.vinculos v JOIN auth.users u ON u.id = v.perfil_id
 WHERE v.unidade_id = 'd0100000-0000-4000-8000-000000000001' AND v.perfil_id::text NOT LIKE 'd0300000%'
 ORDER BY v.papel;
