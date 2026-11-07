-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): ambiente PRÓPRIO
-- do bloco D (D01 a D12).
--
-- Por que existe: os cenários de escala, janela, check-in, raio e 2FA (D01 a
-- D05) mexem na escala, na coordenada e no segundo fator. As contas F5 são
-- usadas AO MESMO TEMPO pelos outros blocos; por isso o bloco D tem a sua
-- própria organização, unidade e contas, e só mexe nelas.
--
-- O que cria (idempotente, sem apagar nada):
--   • organização "Rede E2E Bloco D" (fd000000-…-0001) e a unidade
--     "UPA Bloco D" (fd100000-…-0001, tipo upa, SEM coordenada: o D03 põe e
--     retira a coordenada no próprio script), com o protocolo de classificação
--     da UPA F5;
--   • setores Pronto Socorro D (emergencia), Observação D e Internação D, com
--     2 leitos cada (PSD-, OBD-, INTD-);
--   • 11 contas *.d.f5@teste.local (prefixo de id fd200000, que o
--     41_checkin_fase5.sql NÃO pega: o check-in delas é só o dos cenários):
--       escala.d.f5 (plantonista A), escala2.d.f5 (plantonista B),
--       recepcao.d.f5, enfermeiro.d.f5, gestor.d.f5, faturamento.d.f5,
--       farmaceutico.d.f5, raio.d.f5 (plantonista C, D03), tele.d.f5
--       (telemedicina, D03), medico.obs.d.f5 e enfermeiro.obs.d.f5
--       (Observação D, D06 e D08) — todas com o MESMO hash de senha de medico.upa.f5,
--       copiado no banco (nenhuma senha aqui); CNS fictício com dígito válido;
--   • NENHUMA escala: cada cenário monta a sua pelas RPCs do gestor;
--   • as funções do roteiro do bloco D, todas com prefixo e2e.d_ (não
--     redefine nenhuma função compartilhada do esquema e2e).
--
-- Uso: SÓ homologação. node scripts/e2e/homolog/preparar.mjs scripts/e2e/49d_ambiente_bloco_d.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'medico.upa.f5@teste.local' AND encrypted_password <> '') THEN
    RAISE EXCEPTION 'Conta medico.upa.f5 sem senha: não há hash para copiar.';
  END IF;
END $$;

INSERT INTO public.organizacoes (id, nome) VALUES ('fd000000-0000-4000-8000-000000000001', 'Rede E2E Bloco D')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf) VALUES
  ('fd100000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-000000000001', 'UPA Bloco D', 'upa', NULL, 'Cidade Teste', 'SP')
ON CONFLICT (id) DO NOTHING;
UPDATE public.unidades SET protocolo_classificacao_id = (SELECT protocolo_classificacao_id FROM public.unidades WHERE id = 'f5100000-0000-4000-8000-000000000002')
 WHERE id = 'fd100000-0000-4000-8000-000000000001' AND protocolo_classificacao_id IS NULL;

INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem, publico, regulacao_tipo_leito) VALUES
  ('fd300000-0000-4000-8000-000000000011', 'fd100000-0000-4000-8000-000000000001', 'Pronto Socorro D', 'emergencia', 1, 'todos',  NULL),
  ('fd300000-0000-4000-8000-000000000012', 'fd100000-0000-4000-8000-000000000001', 'Observação D',     'observacao', 2, 'adulto', NULL),
  ('fd300000-0000-4000-8000-000000000013', 'fd100000-0000-4000-8000-000000000001', 'Internação D',     'internacao', 3, 'todos',  NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo, status)
SELECT s.id, x.prefixo || '-' || lpad(n::text, 2, '0'), x.tipo::public.tipo_leito, 'livre'
  FROM (VALUES ('fd300000-0000-4000-8000-000000000011'::uuid, 'PSD', 'clinico', 2), ('fd300000-0000-4000-8000-000000000012'::uuid, 'OBD', 'observacao', 2),
               ('fd300000-0000-4000-8000-000000000013'::uuid, 'INTD', 'clinico', 2)) x(setor, prefixo, tipo, qtd)
  JOIN public.setores s ON s.id = x.setor, generate_series(1, x.qtd) n
 WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = s.id);
INSERT INTO public.salas (id, setor_id, nome, tipo, ordem) VALUES
  ('fd400000-0000-4000-8000-000000000001', 'fd300000-0000-4000-8000-000000000011', 'Triagem D',      'triagem',     1),
  ('fd400000-0000-4000-8000-000000000002', 'fd300000-0000-4000-8000-000000000011', 'Consultório D',  'consultorio', 2)
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE d_contas (id uuid, email text, nome text, crm text, papel text, cns text, cbo text) ON COMMIT DROP;
INSERT INTO d_contas VALUES
  ('fd200000-0000-4000-8000-000000000001', 'escala.d.f5@teste.local',       'Plantonista A Bloco D', '950901', 'plantonista', '709950000900109', '225125'),
  ('fd200000-0000-4000-8000-000000000002', 'escala2.d.f5@teste.local',      'Plantonista B Bloco D', '950902', 'plantonista', '709950000900206', '225125'),
  ('fd200000-0000-4000-8000-000000000003', 'recepcao.d.f5@teste.local',     'Recepção Bloco D',      NULL,     'recepcao',    '709950000900303', '422105'),
  ('fd200000-0000-4000-8000-000000000004', 'enfermeiro.d.f5@teste.local',   'Enfermeira Bloco D',    NULL,     'enfermeiro',  '709950000900400', '223505'),
  ('fd200000-0000-4000-8000-000000000005', 'gestor.d.f5@teste.local',       'Gestor Bloco D',        NULL,     'gestor',      '709950000900508', '131210'),
  ('fd200000-0000-4000-8000-000000000006', 'faturamento.d.f5@teste.local',  'Faturamento Bloco D',   NULL,     'faturamento', '709950000900605', '411010'),
  ('fd200000-0000-4000-8000-000000000007', 'farmaceutico.d.f5@teste.local', 'Farmacêutica Bloco D',  NULL,     'farmaceutico','709950000900702', '223405'),
  ('fd200000-0000-4000-8000-000000000008', 'raio.d.f5@teste.local',         'Plantonista C Bloco D', '950908', 'plantonista', '709950000900818', '225125'),
  ('fd200000-0000-4000-8000-000000000009', 'tele.d.f5@teste.local',         'Telemedicina Bloco D',  '950909', 'telemedicina','709950000900907', '225125'),
  ('fd200000-0000-4000-8000-000000000010', 'medico.obs.d.f5@teste.local',   'Médica da Observação D', '950910', 'plantonista', '709950000901008', '225125'),
  ('fd200000-0000-4000-8000-000000000011', 'enfermeiro.obs.d.f5@teste.local','Enfermeiro da Observação D', NULL,  'enfermeiro',  '709950000901105', '223505');

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email,
       (SELECT u.encrypted_password FROM auth.users u WHERE u.email = 'medico.upa.f5@teste.local'), now(),
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', c.nome)::jsonb, now(), now(), '', '', '', ''
  FROM d_contas c
ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), c.id, c.id::text, json_build_object('sub', c.id::text, 'email', c.email, 'email_verified', true)::jsonb,
       'email', now(), now(), now()
  FROM d_contas c WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = c.id);
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm, email)
SELECT c.id, c.nome, c.crm, CASE WHEN c.crm IS NOT NULL THEN 'SP' END, c.email FROM d_contas c
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo, crm = excluded.crm, uf_crm = excluded.uf_crm;
UPDATE public.perfis p SET cns = c.cns, cbo = c.cbo FROM d_contas c
 WHERE p.id = c.id AND EXISTS (SELECT 1 FROM terminologia.cbo t WHERE t.codigo = c.cbo);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT c.id, 'fd100000-0000-4000-8000-000000000001', c.papel::public.papel FROM d_contas c
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos x WHERE x.perfil_id = c.id AND x.unidade_id = 'fd100000-0000-4000-8000-000000000001' AND x.papel = c.papel::public.papel);

-- ── funções do roteiro do bloco D (prefixo e2e.d_) ──────────────────────────
CREATE OR REPLACE FUNCTION e2e.d_conta(p_papel text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_papel
    WHEN 'd_plant_a' THEN 'fd200000-0000-4000-8000-000000000001'::uuid WHEN 'd_plant_b' THEN 'fd200000-0000-4000-8000-000000000002'::uuid
    WHEN 'd_rec' THEN 'fd200000-0000-4000-8000-000000000003'::uuid     WHEN 'd_enf' THEN 'fd200000-0000-4000-8000-000000000004'::uuid
    WHEN 'd_ges' THEN 'fd200000-0000-4000-8000-000000000005'::uuid     WHEN 'd_fat' THEN 'fd200000-0000-4000-8000-000000000006'::uuid
    WHEN 'd_farm' THEN 'fd200000-0000-4000-8000-000000000007'::uuid    WHEN 'd_plant_c' THEN 'fd200000-0000-4000-8000-000000000008'::uuid
    WHEN 'd_tele' THEN 'fd200000-0000-4000-8000-000000000009'::uuid
    WHEN 'd_med_obs' THEN 'fd200000-0000-4000-8000-000000000010'::uuid WHEN 'd_enf_obs' THEN 'fd200000-0000-4000-8000-000000000011'::uuid
    ELSE e2e.conta(p_papel) END
$$;
CREATE OR REPLACE FUNCTION e2e.d_v(p text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT valor FROM e2e.vars WHERE nome = p $$;
CREATE OR REPLACE FUNCTION e2e.d_u(p text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT valor::uuid FROM e2e.vars WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION e2e.d_v(text), e2e.d_u(text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.d_guardar(p_nome text, p_valor text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO e2e.vars VALUES (p_nome, p_valor) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor
$$;
CREATE OR REPLACE FUNCTION e2e.d_confere(p boolean, p_msg text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p IS NOT TRUE THEN RAISE EXCEPTION 'confere: %', p_msg; END IF;
  RETURN 'ok: ' || p_msg;
END $$;
GRANT EXECUTE ON FUNCTION e2e.d_confere(boolean, text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.d_falhar(p text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '%', p; END $$;
GRANT EXECUTE ON FUNCTION e2e.d_falhar(text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.d_cns(p_n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE base text; s int; d int; k int := 0; i int;
BEGIN
  LOOP
    base := '7' || lpad((90000000000 + p_n * 7 + k)::text, 13, '0');
    s := 0;
    FOR i IN 1..14 LOOP s := s + substr(base, i, 1)::int * (16 - i); END LOOP;
    d := (11 - s % 11) % 11;
    IF d < 10 THEN RETURN base || d; END IF;
    k := k + 1;
  END LOOP;
END $$;

-- passo do bloco D: como e2e.passo, mas conhece as contas fd200000 e o papel
-- 'banco' (conferência como postgres, do que a tela não mostra)
CREATE OR REPLACE FUNCTION e2e.d_passo(p_passo text, p_paciente int, p_papel text, p_rota text, p_descricao text,
                                      p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_resultado text; v_situacao text; v_detalhe text;
BEGIN
  BEGIN
    IF p_papel <> 'banco' THEN
      -- claims extras da conta (ex.: session_id do 2FA no D04/D05), guardadas em e2e.vars 'd_claims_<papel>'
      PERFORM set_config('request.jwt.claims', (jsonb_build_object('sub', e2e.d_conta(p_papel), 'role', 'authenticated')
        || coalesce((SELECT valor::jsonb FROM e2e.vars WHERE nome = 'd_claims_' || p_papel), '{}'::jsonb))::text, true);
      PERFORM set_config('role', 'authenticated', true);
    END IF;
    EXECUTE p_sql INTO v_resultado;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'ok'; v_detalhe := left(coalesce(v_resultado, '(sem retorno: void)'), 400);
      IF p_guardar IS NOT NULL THEN
        IF v_resultado IS NULL THEN RAISE EXCEPTION 'nada a guardar em %', p_guardar; END IF;
        INSERT INTO e2e.vars VALUES (p_guardar, v_resultado) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor;
      END IF;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'PASSOU sem erro (deveria ser recusado): ' || left(coalesce(v_resultado, ''), 300);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'falha'; v_detalhe := SQLSTATE || ': ' || SQLERRM;
    ELSIF p_esperado = 'erro' OR SQLERRM LIKE substr(p_esperado, 6) || '%' THEN
      v_situacao := 'ok'; v_detalhe := 'recusado: ' || SQLERRM;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'recusado com outra mensagem: ' || SQLERRM;
    END IF;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_paciente, p_papel, p_rota, p_descricao, p_esperado, v_situacao, v_detalhe);
  RETURN v_situacao || ' — ' || p_passo || ' — ' || coalesce(v_detalhe, '');
END $$;

-- passo que depende de um id anterior: sem ele, vira lacuna "bloqueado"
CREATE OR REPLACE FUNCTION e2e.d_dep(p_dep text, p_dep_passo text, p_passo text, p_paciente int, p_papel text, p_rota text, p_descricao text,
                                    p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_dep IS NOT NULL AND e2e.d_v(p_dep) IS NULL THEN
    INSERT INTO e2e.resultados (passo, paciente, papel, descricao, esperado, situacao, detalhe)
    VALUES (p_passo, p_paciente, p_papel, p_descricao, p_esperado, 'lacuna', 'bloqueado pelo passo ' || p_dep_passo || ' (sem ' || p_dep || ')');
    RETURN 'lacuna — ' || p_passo;
  END IF;
  RETURN e2e.d_passo(p_passo, p_paciente, p_papel, p_rota, p_descricao, p_sql, p_esperado, p_guardar);
END $$;

-- lacuna (o que o roteiro pede e o produto não tem, ou só se confere na tela)
CREATE OR REPLACE FUNCTION e2e.d_lacuna(p_passo text, p_paciente int, p_papel text, p_descricao text, p_detalhe text) RETURNS text LANGUAGE sql AS $$
  INSERT INTO e2e.resultados (passo, paciente, papel, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_paciente, p_papel, p_descricao, 'existir', 'lacuna', p_detalhe)
  RETURNING 'lacuna — ' || p_passo
$$;

-- ajuste de ambiente como postgres (só em dados do bloco D), registrado; não derruba a rodada
CREATE OR REPLACE FUNCTION e2e.d_ajuste(p_passo text, p_paciente int, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe)
    VALUES (p_passo, p_paciente, p_descricao, 'ajuste', 'ajuste', left(p_sql, 400));
    RETURN 'ajuste — ' || p_passo;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe)
    VALUES (p_passo, p_paciente, p_descricao, 'ajuste', 'falha', 'ajuste recusado: ' || SQLERRM);
    RETURN 'falha — ' || p_passo;
  END;
END $$;

-- sinais vitais crus como a tela grava (sincronizar_registros)
CREATE OR REPLACE FUNCTION e2e.d_sinais(p_pac uuid, p_sinais jsonb, p_internacao uuid DEFAULT NULL, p_metodo text DEFAULT NULL)
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT format($q$SELECT CASE WHEN bool_and(x ->> 'status' = 'gravado') THEN count(*)::text || ' sinais gravados'
                             ELSE e2e.d_falhar(string_agg(coalesce(x ->> 'motivo', x::text), '; ')) END
                     FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)::jsonb) x$q$,
    (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'observacao', 'hora', now(), 'sem_conexao', false,
              'aparelho_id', 'e2e-bloco-d',
              'dados', jsonb_build_object('paciente_id', p_pac, 'internacao_id', p_internacao,
                         'conceito_id', (SELECT c.id FROM public.conceito c WHERE c.nome = k.key AND c.unidade_id IS NULL),
                         'valor_num', k.value, 'origem', 'manual', 'metodo', p_metodo)))
       FROM jsonb_each(p_sinais) k))
$$;

SELECT 'ambiente do bloco D pronto' AS situacao,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'fd200000%') AS contas,
       (SELECT count(*) FROM public.vinculos WHERE unidade_id = 'fd100000-0000-4000-8000-000000000001') AS vinculos,
       (SELECT count(*) FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id WHERE s.unidade_id = 'fd100000-0000-4000-8000-000000000001') AS leitos,
       (SELECT count(*) FROM public.escala_plantao WHERE perfil_id::text LIKE 'fd200000%') AS plantoes;
