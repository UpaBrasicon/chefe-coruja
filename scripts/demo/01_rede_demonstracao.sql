-- ════════════════════════════════════════════════════════════════════════════
-- Unidade de demonstração (pedido 8, J4) — 1/4: a rede, a equipe e a escala.
--
-- SÓ NA HOMOLOGAÇÃO. A trava abaixo recusa rodar se o banco não tiver a
-- "UPA Homologação" (31000000-…-0001), como supabase/homolog/demo-preparar.sql.
--
-- Cria (decisões do RT em 12/11/2026, G1–G4):
--   • organização "Rede de Demonstração" e a "UPA 24h Jardim Primavera"
--     (CNES fictício 9998012, município genérico "Santa Aurora"/SP). A cerca
--     do check-in usa um ponto genérico no interior de SP com raio de 200 m,
--     que não aparece em tela; serve para a auditoria mostrar "confere";
--   • o protocolo de classificação já carregado no ambiente (o mesmo dos
--     roteiros e2e; prefere sms-aparecida-2025);
--   • setores: Pronto Socorro (porta, sem leito), Observação Adulto (6 leitos),
--     Observação Pediátrica (3) e Sala Vermelha (2, tipo 'uti', como no
--     seed-homolog, para a porta poder internar nela);
--   • 24 pessoas fictícias: coordenadora (gestor), farmacêutica e quatro
--     equipes de 12x36 (dia par, dia ímpar, noite par, noite ímpar), cada uma
--     com recepção, enfermagem da classificação, técnico da Observação Adulto,
--     médico do Pronto Socorro e médico da Sala Vermelha; mais dois pediatras
--     no diurno da Observação Pediátrica;
--   • contas em auth.users SEM senha utilizável: encrypted_password vazio (o
--     GoTrue recusa o login com hash vazio), banned_until em 2999, e-mail
--     @demo.local (nenhuma mensagem de recuperação chega) e sem auth.identities.
--     Elas existem só para o nome aparecer na escala e no prontuário;
--   • escala do mês corrente e do seguinte (e a noite da véspera do dia 1),
--     sem sobreposição, publicada pela coordenadora com public.publicar_escala.
--
-- Não cria paciente: o plantão em curso nasce no 02_plantao_agora.sql.
-- Repetível (ON CONFLICT / NOT EXISTS). Virou o mês: rode de novo.
-- IDs fixos com prefixo d0 (organização d000…, unidade d010…, setores d020…,
-- pessoas d030…), fora dos prefixos já usados (e1, e2, f5, 30–33).
--
-- Uso (homologação): npx supabase db query --linked -f scripts/demo/01_rede_demonstracao.sql
-- Apagar tudo: scripts/demo/99_limpar_rede_demonstracao.sql
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── trava: só na homologação ────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = '31000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a UPA Homologação). Confira o projeto ligado (kswurfyxxvfydpjfrivy).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizacoes WHERE id = 'd0000000-0000-4000-8000-000000000001' AND nome <> 'Rede de Demonstração') THEN
    RAISE EXCEPTION 'O id d0000000-…-0001 já é de outra organização: nada foi gravado.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.protocolos_classificacao) THEN
    RAISE EXCEPTION 'Nenhum protocolo de classificação carregado (supabase/dados/protocolo_aparecida_2025.sql): a triagem não teria fluxogramas.';
  END IF;
END $$;

-- ── organização e unidade ───────────────────────────────────────────────────
INSERT INTO public.organizacoes (id, nome) VALUES ('d0000000-0000-4000-8000-000000000001', 'Rede de Demonstração')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf) VALUES
  ('d0100000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'UPA 24h Jardim Primavera', 'upa', '9998012', 'Santa Aurora', 'SP')
ON CONFLICT (id) DO NOTHING;

-- cerca do check-in (o 02 faz o check-in da equipe dentro dela)
UPDATE public.unidades SET latitude = -22.7412, longitude = -47.3318, raio_metros = 200
 WHERE id = 'd0100000-0000-4000-8000-000000000001' AND latitude IS NULL;

-- protocolo de classificação já carregado no ambiente (como os e2e)
UPDATE public.unidades
   SET protocolo_classificacao_id = coalesce(
         (SELECT id FROM public.protocolos_classificacao WHERE codigo = 'sms-aparecida-2025'),
         (SELECT id FROM public.protocolos_classificacao ORDER BY codigo LIMIT 1))
 WHERE id = 'd0100000-0000-4000-8000-000000000001' AND protocolo_classificacao_id IS NULL;

-- ── setores e leitos (todos livres: a ocupação nasce pelos fluxos, no 02) ───
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem, publico) VALUES
  ('d0200000-0000-4000-8000-000000000001', 'd0100000-0000-4000-8000-000000000001', 'Pronto Socorro',        'emergencia', 1, 'todos'),
  ('d0200000-0000-4000-8000-000000000002', 'd0100000-0000-4000-8000-000000000001', 'Observação Adulto',     'observacao', 2, 'adulto'),
  ('d0200000-0000-4000-8000-000000000003', 'd0100000-0000-4000-8000-000000000001', 'Observação Pediátrica', 'observacao', 3, 'pediatrico'),
  ('d0200000-0000-4000-8000-000000000004', 'd0100000-0000-4000-8000-000000000001', 'Sala Vermelha',         'uti',        4, 'todos')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.leitos (setor_id, identificador, tipo, status)
SELECT s.id, x.prefixo || '-' || lpad(n::text, 2, '0'), x.tipo::public.tipo_leito, 'livre'::public.status_leito
  FROM (VALUES ('d0200000-0000-4000-8000-000000000002'::uuid, 'OA', 'observacao',    6),
               ('d0200000-0000-4000-8000-000000000003'::uuid, 'OP', 'observacao',    3),
               ('d0200000-0000-4000-8000-000000000004'::uuid, 'SV', 'estabilizacao', 2)) x(setor, prefixo, tipo, qtd)
  JOIN public.setores s ON s.id = x.setor, generate_series(1, x.qtd) n
 WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = s.id);

-- ── equipe fictícia ─────────────────────────────────────────────────────────
-- equipe: A = dia par, B = dia ímpar, C = noite par, D = noite ímpar (12x36),
-- P0/P1 = pediatra no dia par/ímpar; NULL = sem escala. Paridade pelo número
-- de dias desde 03/01/2000, para não quebrar na virada do mês.
CREATE TEMP TABLE demo_equipe (id uuid, email text, nome text, crm text, papel text, setor uuid, equipe text) ON COMMIT DROP;
INSERT INTO demo_equipe VALUES
  ('d0300000-0000-4000-8000-000000000001', 'simone.prado@demo.local',      'Simone Aparecida Prado',   NULL,     'gestor',             NULL,                                   NULL),
  ('d0300000-0000-4000-8000-000000000002', 'claudia.machado@demo.local',   'Cláudia Regina Machado',   NULL,     'farmaceutico',       NULL,                                   NULL),
  -- equipe A (dia, dias pares)
  ('d0300000-0000-4000-8000-000000000011', 'juliana.lima@demo.local',      'Juliana Ferreira Lima',    NULL,     'recepcao',           'd0200000-0000-4000-8000-000000000001', 'A'),
  ('d0300000-0000-4000-8000-000000000012', 'adriana.moreira@demo.local',   'Adriana Alves Moreira',    NULL,     'enfermeiro',         'd0200000-0000-4000-8000-000000000001', 'A'),
  ('d0300000-0000-4000-8000-000000000013', 'marcos.soares@demo.local',     'Marcos Vinícius Soares',   NULL,     'tecnico_enfermagem', 'd0200000-0000-4000-8000-000000000002', 'A'),
  ('d0300000-0000-4000-8000-000000000014', 'rafael.andrade@demo.local',    'Rafael Costa Andrade',     '981204', 'plantonista',        'd0200000-0000-4000-8000-000000000001', 'A'),
  ('d0300000-0000-4000-8000-000000000015', 'camila.duarte@demo.local',     'Camila Ribeiro Duarte',    '982317', 'plantonista',        'd0200000-0000-4000-8000-000000000004', 'A'),
  -- equipe B (dia, dias ímpares)
  ('d0300000-0000-4000-8000-000000000021', 'thiago.barbosa@demo.local',    'Thiago Martins Barbosa',   NULL,     'recepcao',           'd0200000-0000-4000-8000-000000000001', 'B'),
  ('d0300000-0000-4000-8000-000000000022', 'lucas.teixeira@demo.local',    'Lucas Henrique Teixeira',  NULL,     'enfermeiro',         'd0200000-0000-4000-8000-000000000001', 'B'),
  ('d0300000-0000-4000-8000-000000000023', 'aline.souza@demo.local',       'Aline Cristina Souza',     NULL,     'tecnico_enfermagem', 'd0200000-0000-4000-8000-000000000002', 'B'),
  ('d0300000-0000-4000-8000-000000000024', 'fernanda.cardoso@demo.local',  'Fernanda Lopes Cardoso',   '983046', 'plantonista',        'd0200000-0000-4000-8000-000000000001', 'B'),
  ('d0300000-0000-4000-8000-000000000025', 'bruno.mendes@demo.local',      'Bruno Carvalho Mendes',    '984152', 'plantonista',        'd0200000-0000-4000-8000-000000000004', 'B'),
  -- equipe C (noite, dias pares)
  ('d0300000-0000-4000-8000-000000000031', 'vanessa.gomes@demo.local',     'Vanessa Pereira Gomes',    NULL,     'recepcao',           'd0200000-0000-4000-8000-000000000001', 'C'),
  ('d0300000-0000-4000-8000-000000000032', 'renata.campos@demo.local',     'Renata Oliveira Campos',   NULL,     'enfermeiro',         'd0200000-0000-4000-8000-000000000001', 'C'),
  ('d0300000-0000-4000-8000-000000000033', 'diego.araujo@demo.local',      'Diego Santos Araújo',      NULL,     'tecnico_enfermagem', 'd0200000-0000-4000-8000-000000000002', 'C'),
  ('d0300000-0000-4000-8000-000000000034', 'gustavo.pinto@demo.local',     'Gustavo Nogueira Pinto',   '985263', 'plantonista',        'd0200000-0000-4000-8000-000000000001', 'C'),
  ('d0300000-0000-4000-8000-000000000035', 'larissa.freitas@demo.local',   'Larissa Monteiro Freitas', '986378', 'plantonista',        'd0200000-0000-4000-8000-000000000004', 'C'),
  -- equipe D (noite, dias ímpares)
  ('d0300000-0000-4000-8000-000000000041', 'rodrigo.batista@demo.local',   'Rodrigo Silva Batista',    NULL,     'recepcao',           'd0200000-0000-4000-8000-000000000001', 'D'),
  ('d0300000-0000-4000-8000-000000000042', 'daniela.castro@demo.local',    'Daniela Rezende Castro',   NULL,     'enfermeiro',         'd0200000-0000-4000-8000-000000000001', 'D'),
  ('d0300000-0000-4000-8000-000000000043', 'priscila.dias@demo.local',     'Priscila Fernandes Dias',  NULL,     'tecnico_enfermagem', 'd0200000-0000-4000-8000-000000000002', 'D'),
  ('d0300000-0000-4000-8000-000000000044', 'andre.vieira@demo.local',      'André Luiz Vieira',        '987481', 'plantonista',        'd0200000-0000-4000-8000-000000000001', 'D'),
  ('d0300000-0000-4000-8000-000000000045', 'mariana.correia@demo.local',   'Mariana Azevedo Correia',  '988590', 'plantonista',        'd0200000-0000-4000-8000-000000000004', 'D'),
  -- pediatras (diurno da Observação Pediátrica)
  ('d0300000-0000-4000-8000-000000000051', 'beatriz.cunha@demo.local',     'Beatriz Moraes Cunha',     '989027', 'plantonista',        'd0200000-0000-4000-8000-000000000003', 'P0'),
  ('d0300000-0000-4000-8000-000000000052', 'felipe.ramos@demo.local',      'Felipe Augusto Ramos',     '980736', 'plantonista',        'd0200000-0000-4000-8000-000000000003', 'P1');

-- contas sem senha utilizável (ver o cabeçalho); o gatilho cria o perfil
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, banned_until,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email, '', now(), '2999-12-31 00:00:00+00',
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', c.nome)::jsonb, now(), now(), '', '', '', ''
  FROM demo_equipe c
ON CONFLICT (id) DO NOTHING;
-- se a conta já existia, continua sem senha e bloqueada
UPDATE auth.users SET encrypted_password = '', banned_until = '2999-12-31 00:00:00+00'
 WHERE id IN (SELECT id FROM demo_equipe)
   AND (coalesce(encrypted_password, '') <> '' OR banned_until IS DISTINCT FROM '2999-12-31 00:00:00+00'::timestamptz);

INSERT INTO public.perfis (id, nome_completo, crm, uf_crm, email)
SELECT c.id, c.nome, c.crm, CASE WHEN c.crm IS NOT NULL THEN 'SP' END, c.email FROM demo_equipe c
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo, crm = excluded.crm, uf_crm = excluded.uf_crm;

-- ── vínculos (um papel por pessoa) ──────────────────────────────────────────
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT c.id, 'd0100000-0000-4000-8000-000000000001', c.papel::public.papel
  FROM demo_equipe c
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = c.id
                     AND v.unidade_id = 'd0100000-0000-4000-8000-000000000001' AND v.papel = c.papel::public.papel);

-- ── escala: do dia anterior ao 1º do mês até o fim do mês seguinte ──────────
-- dia = manhã + tarde (07–19), noite = 19–07; uma pessoa por horário, então a
-- trava de sobreposição (20261123000001) não dispara.
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel, criado_por)
SELECT 'd0100000-0000-4000-8000-000000000001', c.setor, c.id, d::date, t, c.papel::public.papel, 'd0300000-0000-4000-8000-000000000001'
  FROM demo_equipe c
 CROSS JOIN generate_series(date_trunc('month', private.data_atual())::date - 1,
                            (date_trunc('month', private.data_atual()) + interval '2 months' - interval '1 day')::date,
                            interval '1 day') d
 CROSS JOIN LATERAL unnest(CASE WHEN c.equipe IN ('C', 'D') THEN ARRAY['noite'] ELSE ARRAY['manha', 'tarde'] END) t
 WHERE c.equipe IS NOT NULL
   AND ((d::date - date '2000-01-03') % 2) = CASE WHEN c.equipe IN ('A', 'C', 'P0') THEN 0 ELSE 1 END
ON CONFLICT DO NOTHING;

-- ── publicação da escala (como a coordenadora, com RLS) ─────────────────────
-- roda a função do banco como a conta: claims do JWT + role authenticated,
-- como e2e.passo (scripts/e2e/04_framework_e2e.sql), mas parando no erro
CREATE OR REPLACE FUNCTION pg_temp.demo_como(p_perfil uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_perfil, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  EXECUTE p_sql INTO v;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END $f$;

DO $$
DECLARE
  v_mes date;
BEGIN
  FOREACH v_mes IN ARRAY ARRAY[date_trunc('month', private.data_atual())::date,
                               (date_trunc('month', private.data_atual()) + interval '1 month')::date] LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.escala_publicacoes
                           WHERE unidade_id = 'd0100000-0000-4000-8000-000000000001' AND competencia = v_mes);
    PERFORM pg_temp.demo_como('d0300000-0000-4000-8000-000000000001',
      format('SELECT public.publicar_escala(%L::uuid, %s, %s, %L)::text', 'd0100000-0000-4000-8000-000000000001',
             extract(year FROM v_mes)::int, extract(month FROM v_mes)::int, 'Escala 12x36 da equipe.'));
  END LOOP;
END $$;

COMMIT;

SELECT 'rede de demonstração pronta' AS situacao,
       (SELECT nome FROM public.unidades WHERE id = 'd0100000-0000-4000-8000-000000000001') AS unidade,
       (SELECT count(*) FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
         WHERE s.unidade_id = 'd0100000-0000-4000-8000-000000000001') AS leitos,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'd0300000%') AS pessoas,
       (SELECT count(*) FROM public.escala_plantao WHERE unidade_id = 'd0100000-0000-4000-8000-000000000001' AND ativo) AS plantoes,
       (SELECT count(*) FROM public.escala_publicacoes WHERE unidade_id = 'd0100000-0000-4000-8000-000000000001') AS publicacoes;
