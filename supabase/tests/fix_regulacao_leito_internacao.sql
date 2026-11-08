-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270308000006_regulacao_leito_internacao.sql (achado 1
-- da conferência das telas de 08/11/2026). Tudo em transação com ROLLBACK. O
-- cenário é criado aqui.
--
-- 1. a lista de leitos do destino traz só internação, UTI e isolamento (não a
--    porta);
-- 2. o aceite não reserva leito da porta;
-- 3. a chegada não interna em leito da porta; num leito de internação, interna.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000ab001'),
  ('upa',   '00000000-0000-4000-8000-0000000ab002'),
  ('hosp',  '00000000-0000-4000-8000-0000000ab003'),
  ('cent',  '00000000-0000-4000-8000-0000000ab004'),
  ('porta', '00000000-0000-4000-8000-0000000ab011'),
  ('pth',   '00000000-0000-4000-8000-0000000ab012'),  -- porta do hospital
  ('cm',    '00000000-0000-4000-8000-0000000ab013'),
  ('est',   '00000000-0000-4000-8000-0000000ab021'),  -- leito da porta do hospital
  ('cm1',   '00000000-0000-4000-8000-0000000ab022'),
  ('cm2',   '00000000-0000-4000-8000-0000000ab023'),
  ('med',   '00000000-0000-4000-8000-0000000ab031'),
  ('medh',  '00000000-0000-4000-8000-0000000ab032'),
  ('pA',    '00000000-0000-4000-8000-0000000ab041'),
  ('rA',    '00000000-0000-4000-8000-0000000ab051'),
  ('rB',    '00000000-0000-4000-8000-0000000ab052');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
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
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@leitoint.local' FROM ids WHERE nome IN ('med', 'medh');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'medh')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
UPDATE public.perfis SET crm = '654322', uf_crm = 'SP' WHERE id = pg_temp.id('medh');
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do leito de internação');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do teste do leito', 'upa', '7654901'),
  (pg_temp.id('hosp'), pg_temp.id('org'), 'Hospital do teste do leito', 'hospital', '7654902'),
  (pg_temp.id('cent'), pg_temp.id('org'), 'Central do teste do leito', 'hospital', NULL);
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('pth'), pg_temp.id('hosp'), 'Porta do Hospital', 'emergencia'),
  (pg_temp.id('cm'), pg_temp.id('hosp'), 'Clínica Médica', 'internacao');
INSERT INTO public.leitos (id, setor_id, identificador) VALUES
  (pg_temp.id('est'), pg_temp.id('pth'), 'EST-01'),
  (pg_temp.id('cm1'), pg_temp.id('cm'), 'CM-01'),
  (pg_temp.id('cm2'), pg_temp.id('cm'), 'CM-02');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medh'), pg_temp.id('hosp'), 'plantonista');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo)
VALUES (pg_temp.id('pA'), pg_temp.id('upa'), 'Paciente Leito Teste', '1960-01-01', 'M');
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  tipo, procedimento, tipo_leito, transporte, destino_tipo, destino_unidade_id, carater, modalidade, prioridade, cid, quadro_clinico,
  solicitante_id, solicitante_papel, status, autorizada_em, destino_enviado_em)
SELECT pg_temp.id(x.r), pg_temp.id('org'), pg_temp.id('cent'), pg_temp.id('upa'), '7654901', pg_temp.id('pA'),
       x.tipo, '0303060190', x.leito, x.transp, 'rede', pg_temp.id('hosp'), 'urgencia', '04', 'urgencia', 'I21.9',
       'Quadro clínico do pedido de teste do leito de internação.', pg_temp.id('med'), 'medico', x.st, now(), now()
  FROM (VALUES ('rA', 'leito', 'clinico', NULL, 'aguardando_destino'),
               ('rB', 'transferencia', NULL, 'ambulancia_avancada', 'autorizada')) x(r, tipo, leito, transp, st);

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('medh');

-- ── 1. a lista ──────────────────────────────────────────────────────────────
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_leitos_destino(pg_temp.id('rA'))) x
                               WHERE x ->> 'id' = pg_temp.id('est')::text)
                  AND EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_leitos_destino(pg_temp.id('rA'))) x
                               WHERE x ->> 'id' = pg_temp.id('cm1')::text),
  'a lista de leitos do destino traz a internação e não a porta');

-- ── 2. o aceite ─────────────────────────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.regulacao_destino_aceitar(%L, %L, NULL)', pg_temp.id('rA'), pg_temp.id('est')),
  'Escolha um leito de internação, UTI ou isolamento', 'o aceite não reserva leito da porta');
SELECT public.regulacao_destino_aceitar(pg_temp.id('rA'), pg_temp.id('cm1'), NULL);

-- ── 3. a chegada ────────────────────────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.regulacao_marcar_chegada(%L, true, NULL, %L)', pg_temp.id('rB'), pg_temp.id('est')),
  'Escolha um leito de internação, UTI ou isolamento', 'a chegada não interna em leito da porta');
SELECT public.regulacao_marcar_chegada(pg_temp.id('rB'), true, NULL, pg_temp.id('cm2'));
RESET ROLE;
SELECT pg_temp.ok((SELECT i.leito_atual_id = pg_temp.id('cm2') FROM public.regulacao_solicitacoes s
                     JOIN public.internacoes i ON i.id = s.destino_internacao_id WHERE s.id = pg_temp.id('rB')),
  'num leito de internação, a chegada interna');
ROLLBACK;
