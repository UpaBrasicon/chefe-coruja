-- ════════════════════════════════════════════════════════════════════════════
-- Rede de demonstração — UBS e Central de Regulação (vídeo de venda, item 8
-- do backlog comercial).
--
-- SÓ NA HOMOLOGAÇÃO (mesma trava do 01). Rode depois do 01 e do 02, entre
-- 7h e 18h50 (horário de Brasília): a UBS funciona das 7h às 19h e as funções
-- só aceitam quem está de plantão agora. Rode de novo depois de cada 02: o 02
-- apaga os pacientes da UPA e, com eles, os pedidos de regulação da UPA.
--
-- Parte fixa (repetível, ON CONFLICT / NOT EXISTS):
--   • "UBS Vila Esperança" (CNES fictício 9998020), com o Consultório 1 e a
--     equipe de saúde da família: médica, enfermeira, técnica e recepção, com
--     escala de manhã e de tarde todos os dias do mês corrente e do seguinte,
--     publicada pela coordenadora, e a agenda de consultas da médica e da
--     enfermeira (7h–12h e 13h–17h, todos os dias). Não há papel de agente
--     comunitário de saúde no app;
--   • a coordenadora Simone Aparecida Prado (d0300000-…-0001) passa a ser
--     gestora também da UBS;
--   • "Hospital Regional Santa Aurora" (CNES fictício 9998039), com Clínica
--     Médica (10 leitos) e UTI Adulto (6 leitos) ofertadas à regulação, e um
--     gestor que responde pelo destino;
--   • "Central de Regulação de Santa Aurora", definida como a central da
--     rede, com uma médica reguladora;
--   • na UPA 24h Jardim Primavera, a Observação Adulto (clínico) e a
--     Observação Pediátrica (pediátrico) ficam ofertadas no mapa de vagas;
--   • no hospital, quatro serviços no mapa de vagas (cardiologia, oftalmologia,
--     ecocardiograma e ultrassom obstétrico).
--
-- Parte do dia (apaga o que o 04 gravou antes e grava de novo, como o 02):
--   • 21 pacientes da UBS, cadastrados pela recepção, com Cartão SUS fictício
--     válido: 8 do hiperdia, 4 gestantes, 4 crianças menores de 2 anos, 3 dos
--     envios à UPA e 2 de demanda; histórico de consultas pelas funções do banco (escuta inicial,
--     atendimento, SOAP, HbA1c, avaliação dos pés, conduta da ficha da
--     atenção primária, crescimento), que alimenta o hiperdia (notas C5 e C4),
--     o pré-natal e a puericultura;
--   • agenda de hoje e dos próximos 5 dias. Hoje, o que já passou sai
--     realizado ou falta, o horário de agora sai "presente" e o resto fica
--     agendado;
--   • três envios à UPA (aguardando a chegada, não chegou e cancelado);
--   • seis pedidos de regulação: quatro da UBS (consulta de cardiologia
--     realizada, ecocardiograma autorizado, oftalmologia aguardando na fila,
--     ultrassom obstétrico em análise) e dois da UPA, dos pacientes da Sala
--     Vermelha que o 02 criou (transferência para UTI autorizada pela central
--     e aguardando o aceite do hospital, leito de UTI aguardando com
--     prioridade elevada pela reguladora);
--   • horários recuados como postgres (passo "ajuste", como no 02).
--
-- Sem prescrição e sem dose: nenhum texto do roteiro traz medicamento.
-- Nomes, números de documento, sinais vitais e textos clínicos são fictícios.
--
-- Gravado direto (sem função do banco), como postgres:
--   • a central da rede (public.regulacao_definir_central é só do
--     administrador da plataforma, e a rede de demonstração não tem um);
--   • o check-in da equipe da UBS (como o 02 faz com a da UPA);
--   • a ocupação dos leitos do hospital (sem pacientes internados nele);
--   • os horários: consultas, envios, pedidos de regulação e o horário das
--     consultas de hoje que já passaram (a agenda só marca horário futuro).
--
-- IDs fixos: unidades d0100000-…-0002 (UBS), -0003 (hospital) e -0009
-- (central); setores d0200000-…-0011, -0021, -0022 e -0091; pessoas
-- d0300000-…-0061 a -0064, -0071 e -0081. O 99 apaga tudo junto com a rede.
--
-- Uso (homologação): npx supabase db query --linked -f scripts/demo/04_ubs_regulacao.sql
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── trava ───────────────────────────────────────────────────────────────────
DO $$
DECLARE v_hora time := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
BEGIN
  IF NOT coalesce((SELECT c.valor FROM public.configuracao_plataforma c WHERE c.chave = 'ambiente_teste'), false) THEN  -- S10 (H4): marca de ambiente
    RAISE EXCEPTION 'Este banco não é de teste: a marca ambiente_teste não está ligada (só a homologação e o banco local a têm; a produção tem a marca desligada). Confira o projeto ligado (kswurfyxxvfydpjfrivy).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = 'd0100000-0000-4000-8000-000000000001'
                   AND organizacao_id = 'd0000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'A UPA 24h Jardim Primavera não existe: rode antes scripts/demo/01_rede_demonstracao.sql.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.unidades WHERE id IN ('d0100000-0000-4000-8000-000000000002', 'd0100000-0000-4000-8000-000000000003',
                                                       'd0100000-0000-4000-8000-000000000009')
               AND organizacao_id <> 'd0000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Um dos ids d0100000-…-0002/0003/0009 já é de outra organização: nada foi gravado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.centrais_regulacao WHERE organizacao_id = 'd0000000-0000-4000-8000-000000000001'
               AND unidade_id <> 'd0100000-0000-4000-8000-000000000009') THEN
    RAISE EXCEPTION 'A rede de demonstração já tem outra Central de Regulação: nada foi gravado.';
  END IF;
  IF v_hora < time '07:00' OR v_hora >= time '18:50' THEN
    RAISE EXCEPTION 'A UBS funciona das 7h às 19h e agora são %: rode o 04 entre 7h e 18h50 (horário de Brasília).', to_char(v_hora, 'HH24:MI');
  END IF;
END $$;

-- ── 1. unidades, setores e leitos ───────────────────────────────────────────
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf) VALUES
  ('d0100000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'UBS Vila Esperança',                   'ubs',      '9998020', 'Santa Aurora', 'SP'),
  ('d0100000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'Hospital Regional Santa Aurora',       'hospital', '9998039', 'Santa Aurora', 'SP'),
  ('d0100000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000001', 'Central de Regulação de Santa Aurora', 'clinica',  NULL,      'Santa Aurora', 'SP')
ON CONFLICT (id) DO NOTHING;

-- cerca do check-in da UBS (ponto genérico, perto do da UPA, raio de 200 m)
UPDATE public.unidades SET latitude = -22.7489, longitude = -47.3247, raio_metros = 200
 WHERE id = 'd0100000-0000-4000-8000-000000000002' AND latitude IS NULL;

INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem, publico) VALUES
  ('d0200000-0000-4000-8000-000000000011', 'd0100000-0000-4000-8000-000000000002', 'Consultório 1',  'consultorio', 1, 'todos'),
  ('d0200000-0000-4000-8000-000000000021', 'd0100000-0000-4000-8000-000000000003', 'Clínica Médica', 'internacao',  1, 'adulto'),
  ('d0200000-0000-4000-8000-000000000022', 'd0100000-0000-4000-8000-000000000003', 'UTI Adulto',     'uti',         2, 'adulto'),
  ('d0200000-0000-4000-8000-000000000091', 'd0100000-0000-4000-8000-000000000009', 'Regulação',      'outro',       1, 'todos')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.leitos (setor_id, identificador, tipo, status)
SELECT s.id, x.prefixo || '-' || lpad(n::text, 2, '0'), 'clinico'::public.tipo_leito, 'livre'::public.status_leito
  FROM (VALUES ('d0200000-0000-4000-8000-000000000021'::uuid, 'CM', 10),
               ('d0200000-0000-4000-8000-000000000022'::uuid, 'UTI', 6)) x(setor, prefixo, qtd)
  JOIN public.setores s ON s.id = x.setor, generate_series(1, x.qtd) n
 WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = s.id);

-- ocupação do hospital (gravada direto: o hospital não tem pacientes na rede de
-- demonstração). Clínica Médica 7 ocupados e 1 em higienização de 10; UTI 4 de 6.
-- Só leito livre muda, então rodar de novo não mexe no que já está.
UPDATE public.leitos l SET status = CASE WHEN l.identificador = 'CM-08' THEN 'higienizacao'::public.status_leito
                                         ELSE 'ocupado'::public.status_leito END
 WHERE l.status = 'livre'
   AND ((l.setor_id = 'd0200000-0000-4000-8000-000000000021' AND l.identificador IN ('CM-01', 'CM-02', 'CM-03', 'CM-04', 'CM-05', 'CM-06', 'CM-07', 'CM-08'))
     OR (l.setor_id = 'd0200000-0000-4000-8000-000000000022' AND l.identificador IN ('UTI-01', 'UTI-02', 'UTI-03', 'UTI-04')));

-- ── 2. pessoas novas (sem senha utilizável, como no 01) ─────────────────────
CREATE TEMP TABLE demo_equipe4 (id uuid, email text, nome text, crm text, cbo text, papel text, unidade uuid) ON COMMIT DROP;
INSERT INTO demo_equipe4 VALUES
  -- UBS Vila Esperança: equipe de saúde da família
  ('d0300000-0000-4000-8000-000000000061', 'leticia.nogueira@demo.local',   'Letícia Camargo Nogueira', '990318', '225130', 'plantonista',        'd0100000-0000-4000-8000-000000000002'),
  ('d0300000-0000-4000-8000-000000000062', 'tatiana.fonseca@demo.local',    'Tatiana Brito Fonseca',    NULL,     '223505', 'enfermeiro',         'd0100000-0000-4000-8000-000000000002'),
  ('d0300000-0000-4000-8000-000000000063', 'elaine.paiva@demo.local',       'Elaine Cristina Paiva',    NULL,     '322205', 'tecnico_enfermagem', 'd0100000-0000-4000-8000-000000000002'),
  ('d0300000-0000-4000-8000-000000000064', 'marcio.albuquerque@demo.local', 'Márcio José Albuquerque',  NULL,     '422105', 'recepcao',           'd0100000-0000-4000-8000-000000000002'),
  -- Central de Regulação: médica reguladora
  ('d0300000-0000-4000-8000-000000000071', 'sandra.toledo@demo.local',      'Sandra Regina Toledo',     '991427', '225125', 'regulador',          'd0100000-0000-4000-8000-000000000009'),
  -- Hospital Regional: gestor (responde pelo destino na regulação)
  ('d0300000-0000-4000-8000-000000000081', 'eduardo.lins@demo.local',       'Eduardo Tavares Lins',     NULL,     '131210', 'gestor',             'd0100000-0000-4000-8000-000000000003');

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, banned_until,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email, '', now(), '2999-12-31 00:00:00+00',
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', c.nome)::jsonb, now(), now(), '', '', '', ''
  FROM demo_equipe4 c
ON CONFLICT (id) DO NOTHING;
UPDATE auth.users SET encrypted_password = '', banned_until = '2999-12-31 00:00:00+00'
 WHERE id IN (SELECT id FROM demo_equipe4)
   AND (coalesce(encrypted_password, '') <> '' OR banned_until IS DISTINCT FROM '2999-12-31 00:00:00+00'::timestamptz);

INSERT INTO public.perfis (id, nome_completo, crm, uf_crm, email, cbo)
SELECT c.id, c.nome, c.crm, CASE WHEN c.crm IS NOT NULL THEN 'SP' END, c.email, c.cbo FROM demo_equipe4 c
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo, crm = excluded.crm, uf_crm = excluded.uf_crm, cbo = excluded.cbo;

-- vínculos: a equipe nova e a coordenadora como gestora da UBS
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT v.perfil, v.unidade, v.papel::public.papel
  FROM (SELECT c.id AS perfil, c.unidade, c.papel FROM demo_equipe4 c
        UNION ALL
        SELECT 'd0300000-0000-4000-8000-000000000001'::uuid, 'd0100000-0000-4000-8000-000000000002'::uuid, 'gestor') v
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos x WHERE x.perfil_id = v.perfil AND x.unidade_id = v.unidade AND x.papel = v.papel::public.papel);
UPDATE public.vinculos SET ativo = true
 WHERE NOT ativo AND perfil_id = 'd0300000-0000-4000-8000-000000000001'
   AND unidade_id = 'd0100000-0000-4000-8000-000000000002' AND papel = 'gestor';

-- ── 3. Central de Regulação da rede (gravada direto, ver o cabeçalho) ──────
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
SELECT 'd0000000-0000-4000-8000-000000000001', 'd0100000-0000-4000-8000-000000000009', 'd0300000-0000-4000-8000-000000000001'
 WHERE NOT EXISTS (SELECT 1 FROM public.centrais_regulacao WHERE organizacao_id = 'd0000000-0000-4000-8000-000000000001');

-- ── 4. escala da UBS: manhã e tarde, do dia anterior ao 1º até o fim do mês seguinte
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel, criado_por)
SELECT 'd0100000-0000-4000-8000-000000000002', 'd0200000-0000-4000-8000-000000000011', c.id, d::date, t, c.papel::public.papel,
       'd0300000-0000-4000-8000-000000000001'
  FROM demo_equipe4 c
 CROSS JOIN generate_series(date_trunc('month', private.data_atual())::date - 1,
                            (date_trunc('month', private.data_atual()) + interval '2 months' - interval '1 day')::date,
                            interval '1 day') d
 CROSS JOIN unnest(ARRAY['manha', 'tarde']) t
 WHERE c.unidade = 'd0100000-0000-4000-8000-000000000002'
ON CONFLICT DO NOTHING;

-- roda a função do banco como a conta (claims do JWT + role authenticated),
-- como no 01 e no 02, parando no erro
CREATE OR REPLACE FUNCTION pg_temp.demo_como(p_perfil uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_perfil, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  EXECUTE p_sql INTO v;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END $f$;

-- publicação da escala da UBS (como a coordenadora)
DO $$
DECLARE v_mes date;
BEGIN
  FOREACH v_mes IN ARRAY ARRAY[date_trunc('month', private.data_atual())::date,
                               (date_trunc('month', private.data_atual()) + interval '1 month')::date] LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.escala_publicacoes
                           WHERE unidade_id = 'd0100000-0000-4000-8000-000000000002' AND competencia = v_mes);
    PERFORM pg_temp.demo_como('d0300000-0000-4000-8000-000000000001',
      format('SELECT public.publicar_escala(%L::uuid, %s, %s, %L)::text', 'd0100000-0000-4000-8000-000000000002',
             extract(year FROM v_mes)::int, extract(month FROM v_mes)::int, 'Escala da equipe de saúde da família.'));
  END LOOP;
END $$;

-- check-in dos plantões da UBS que já começaram (como o 02 faz na UPA)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em,
                                         checkin_lat, checkin_lng, checkin_dentro, checkin_distancia_m)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno,
       least(e.inicio + make_interval(mins => hashtext(e.id::text) & 7), now()),
       u.latitude, u.longitude, true, (hashtext(e.id::text) >> 3) & 63
  FROM public.escala_plantao e
  JOIN public.unidades u ON u.id = e.unidade_id
 WHERE e.ativo AND e.unidade_id = 'd0100000-0000-4000-8000-000000000002' AND e.perfil_id::text LIKE 'd0300000%'
   AND e.inicio <= now() AND e.inicio > now() - interval '24 hours'
ON CONFLICT DO NOTHING;

-- ── 5. agenda, oferta à regulação e serviços (pelas funções do banco) ───────
DO $$
DECLARE
  v_simone constant uuid := 'd0300000-0000-4000-8000-000000000001';
  v_hgest  constant uuid := 'd0300000-0000-4000-8000-000000000081';
  v_ubs    constant uuid := 'd0100000-0000-4000-8000-000000000002';
  v_hosp   constant uuid := 'd0100000-0000-4000-8000-000000000003';
  p record; s record;
BEGIN
  -- grade da agenda: médica de 20 em 20 min, enfermeira de 30 em 30 min
  FOR p IN SELECT * FROM (VALUES ('d0300000-0000-4000-8000-000000000061'::uuid, 20),
                                 ('d0300000-0000-4000-8000-000000000062'::uuid, 30)) x(perfil, duracao) LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.agenda_configuracoes WHERE unidade_id = v_ubs AND perfil_id = p.perfil);
    PERFORM pg_temp.demo_como(v_simone, format('SELECT public.agenda_definir_configuracao(%L::uuid, %L::uuid, %L::jsonb)::text', v_ubs, p.perfil,
      (SELECT jsonb_agg(jsonb_build_object('dia', d, 'periodo', h.periodo, 'inicio', h.inicio, 'fim', h.fim, 'duracao', p.duracao))
         FROM generate_series(0, 6) d,
              (VALUES ('manha', '07:00', '12:00'), ('tarde', '13:00', '17:00')) h(periodo, inicio, fim))));
  END LOOP;

  -- setores ofertados à regulação (mapa de vagas)
  FOR s IN SELECT * FROM (VALUES
             ('d0200000-0000-4000-8000-000000000002'::uuid, 'clinico',    v_simone),   -- UPA, Observação Adulto
             ('d0200000-0000-4000-8000-000000000003'::uuid, 'pediatrico', v_simone),   -- UPA, Observação Pediátrica
             ('d0200000-0000-4000-8000-000000000021'::uuid, 'clinico',    v_hgest),    -- hospital, Clínica Médica
             ('d0200000-0000-4000-8000-000000000022'::uuid, 'uti_adulto', v_hgest)) x(setor, tipo, quem) LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.setores WHERE id = s.setor AND regulacao_tipo_leito = s.tipo);
    PERFORM pg_temp.demo_como(s.quem, format('SELECT public.regulacao_ofertar_setor(%L::uuid, %L)::text', s.setor, s.tipo));
  END LOOP;

  -- serviços do hospital no mapa de vagas
  FOR s IN SELECT * FROM (VALUES
             ('Consulta de cardiologia',       'consulta', '0301010072', 'restrito',     '4',  'Ambulatório às terças e quintas.'),
             ('Consulta de oftalmologia',      'consulta', '0301010072', 'indisponivel', NULL, 'Sem oftalmologista neste mês.'),
             ('Ecocardiografia transtorácica', 'exame',    '0205010032', 'disponivel',   '6',  NULL),
             ('Ultrassonografia obstétrica',   'exame',    '0205020143', 'disponivel',   '10', NULL)) x(nome, tipo, proc, situacao, vagas, obs) LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.regulacao_servicos WHERE unidade_id = v_hosp AND nome = s.nome AND ativo);
    PERFORM pg_temp.demo_como(v_hgest, format('SELECT public.regulacao_salvar_servico(%L::uuid, NULL, %L::jsonb)::text', v_hosp,
      jsonb_strip_nulls(jsonb_build_object('nome', s.nome, 'tipo', s.tipo, 'procedimento', s.proc, 'situacao', s.situacao,
                                           'vagas', s.vagas, 'observacao', s.obs))));
  END LOOP;
END $$;

-- ── 6. limpeza do que o 04 gravou antes ─────────────────────────────────────
-- pacientes da UBS (e tudo o que aponta para eles), pedidos de regulação da
-- central, agenda da UBS e avisos de regulação e de envio da rede. Mesma
-- função de limpeza do 02 (segue as chaves estrangeiras pelo catálogo).
SET LOCAL session_replication_role = replica;

CREATE TEMP TABLE demo_marca (rel oid NOT NULL, linha tid NOT NULL, PRIMARY KEY (rel, linha)) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.demo_apagar_marcados(p_preservar regclass[], p_esquemas text[]) RETURNS bigint LANGUAGE plpgsql AS $f$
DECLARE
  fk record; r record; n bigint; v_novas bigint; v_total bigint := 0;
BEGIN
  LOOP
    v_novas := 0;
    FOR fk IN
      SELECT c.conrelid::regclass AS filho, c.confrelid::regclass AS pai, c.confrelid AS pai_oid,
             (SELECT string_agg(format('f.%I', a.attname), ', ' ORDER BY k.i)
                FROM unnest(c.conkey) WITH ORDINALITY k(num, i) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num) AS cols_f,
             (SELECT string_agg(format('%I = NULL', a.attname), ', ' ORDER BY k.i)
                FROM unnest(c.conkey) WITH ORDINALITY k(num, i) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num) AS anular,
             (SELECT string_agg(format('p.%I', a.attname), ', ' ORDER BY k.i)
                FROM unnest(c.confkey) WITH ORDINALITY k(num, i) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num) AS cols_p
        FROM pg_constraint c
        JOIN pg_class cf ON cf.oid = c.conrelid
        JOIN pg_namespace nf ON nf.oid = cf.relnamespace
       WHERE c.contype = 'f' AND cf.relkind = 'r' AND nf.nspname = ANY (p_esquemas)
         AND c.confrelid IN (SELECT DISTINCT m.rel FROM demo_marca m)
    LOOP
      IF fk.filho = ANY (p_preservar) THEN
        EXECUTE format('UPDATE %s f SET %s WHERE (%s) IN (SELECT %s FROM %s p WHERE p.ctid = ANY ($1))',
                       fk.filho, fk.anular, fk.cols_f, fk.cols_p, fk.pai)
          USING ARRAY(SELECT m.linha FROM demo_marca m WHERE m.rel = fk.pai_oid);
      ELSE
        EXECUTE format('INSERT INTO pg_temp.demo_marca (rel, linha) SELECT %s, f.ctid FROM %s f WHERE (%s) IN (SELECT %s FROM %s p WHERE p.ctid = ANY ($1)) ON CONFLICT DO NOTHING',
                       fk.filho::oid, fk.filho, fk.cols_f, fk.cols_p, fk.pai)
          USING ARRAY(SELECT m.linha FROM demo_marca m WHERE m.rel = fk.pai_oid);
        GET DIAGNOSTICS n = ROW_COUNT;
        v_novas := v_novas + n;
      END IF;
    END LOOP;
    EXIT WHEN v_novas = 0;
  END LOOP;
  FOR r IN SELECT m.rel, array_agg(m.linha) AS linhas FROM demo_marca m GROUP BY m.rel LOOP
    EXECUTE format('DELETE FROM %s WHERE ctid = ANY ($1)', r.rel::regclass) USING r.linhas;
    GET DIAGNOSTICS n = ROW_COUNT;
    v_total := v_total + n;
  END LOOP;
  RETURN v_total;
END $f$;

DO $$
DECLARE
  v_ubs     constant uuid := 'd0100000-0000-4000-8000-000000000002';
  v_central constant uuid := 'd0100000-0000-4000-8000-000000000009';
  v_preservar regclass[] := ARRAY['public.organizacoes', 'public.unidades', 'public.setores', 'public.leitos', 'public.perfis',
                                  'public.vinculos', 'public.escala_plantao', 'public.presenca_plantonista',
                                  'public.escala_publicacoes', 'public.historico_escala', 'public.log_auditoria',
                                  'public.agenda_configuracoes', 'public.centrais_regulacao',
                                  'public.regulacao_servicos', 'public.regulacao_servicos_historico']::regclass[];
  v_pac uuid[];
  v_ep uuid[];
  t record;
  v_ids uuid[];
  v_apagadas bigint;
BEGIN
  v_pac := ARRAY(SELECT id FROM public.pacientes WHERE unidade_id = v_ubs);
  v_ep  := ARRAY(SELECT id FROM public.episodios WHERE unidade_id = v_ubs OR paciente_id = ANY (v_pac));

  INSERT INTO demo_marca SELECT 'public.pacientes'::regclass::oid, ctid FROM public.pacientes WHERE id = ANY (v_pac);
  INSERT INTO demo_marca SELECT 'public.episodios'::regclass::oid, ctid FROM public.episodios WHERE id = ANY (v_ep) ON CONFLICT DO NOTHING;
  INSERT INTO demo_marca SELECT 'public.regulacao_solicitacoes'::regclass::oid, ctid FROM public.regulacao_solicitacoes
   WHERE central_id = v_central OR organizacao_id = 'd0000000-0000-4000-8000-000000000001' ON CONFLICT DO NOTHING;
  INSERT INTO demo_marca SELECT 'public.agendamentos'::regclass::oid, ctid FROM public.agendamentos WHERE unidade_id = v_ubs ON CONFLICT DO NOTHING;
  INSERT INTO demo_marca SELECT 'public.notificacoes_plantonista'::regclass::oid, ctid FROM public.notificacoes_plantonista
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE organizacao_id = 'd0000000-0000-4000-8000-000000000001')
     AND (tipo LIKE 'reg\_%' OR tipo LIKE 'ubs\_%') ON CONFLICT DO NOTHING;
  -- e o que guarda paciente ou episódio da UBS sem chave estrangeira
  FOR t IN SELECT c.table_schema, c.table_name, c.column_name
             FROM information_schema.columns c
             JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
                                              AND tb.table_type = 'BASE TABLE'
            WHERE c.table_schema IN ('public', 'private') AND c.data_type = 'uuid'
              AND c.column_name IN ('paciente_id', 'episodio_id') LOOP
    CONTINUE WHEN format('%I.%I', t.table_schema, t.table_name)::regclass = ANY (v_preservar);
    v_ids := CASE t.column_name WHEN 'paciente_id' THEN v_pac ELSE v_ep END;
    CONTINUE WHEN cardinality(v_ids) = 0;
    EXECUTE format('INSERT INTO pg_temp.demo_marca (rel, linha) SELECT %s, ctid FROM %I.%I WHERE %I = ANY ($1) ON CONFLICT DO NOTHING',
                   format('%I.%I', t.table_schema, t.table_name)::regclass::oid, t.table_schema, t.table_name, t.column_name)
      USING v_ids;
  END LOOP;

  v_apagadas := pg_temp.demo_apagar_marcados(v_preservar, ARRAY['public', 'private']);
  RAISE NOTICE 'Limpeza: % paciente(s) da UBS e % linha(s) apagadas no total.', cardinality(v_pac), v_apagadas;
END $$;

SET LOCAL session_replication_role = origin;

-- ── 7. pacientes da UBS (cadastro pela recepção) ────────────────────────────
-- Cartão SUS fictício: começa com 7998 e fecha a soma ponderada da regra do
-- CNS provisório (a mesma de private.cns_valido)
CREATE OR REPLACE FUNCTION pg_temp.demo_cns(p_semente int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE v_base text; v_soma int; v_dv int; i int; k int;
BEGIN
  FOR k IN 0..9 LOOP
    v_base := '7998' || lpad(p_semente::text, 6, '0') || k::text || '000';
    v_soma := 0;
    FOR i IN 1..14 LOOP v_soma := v_soma + substr(v_base, i, 1)::int * (16 - i); END LOOP;
    v_dv := (11 - v_soma % 11) % 11;
    IF v_dv < 10 THEN RETURN v_base || v_dv::text; END IF;
  END LOOP;
  RAISE EXCEPTION 'Sem Cartão SUS fictício para a semente %.', p_semente;
END $f$;

-- grupo: has (hipertensão), dm (diabetes), has_dm, pn (pré-natal), puer
-- (puericultura), env (envio à UPA), dem (demanda). idade em anos; para a
-- criança, dias de vida.
CREATE TEMP TABLE demo_ubs_pac (
  cod text PRIMARY KEY, seq int, nome text, sexo text, anos int, dias_vida int, grupo text, mae text, endereco text, id uuid
) ON COMMIT DROP;
INSERT INTO demo_ubs_pac (cod, seq, nome, sexo, anos, dias_vida, grupo, mae, endereco) VALUES
  ('H1',  1, 'Maria das Graças Oliveira', 'F', 64, NULL, 'has_dm', 'Benedita Alves de Oliveira',  'Rua das Acácias, 120'),
  ('H2',  2, 'José Aparecido Santos',     'M', 58, NULL, 'has',    'Aparecida Rosa dos Santos',   'Rua dos Ipês, 45'),
  ('H3',  3, 'Antônia Ferreira Lima',     'F', 71, NULL, 'has_dm', 'Joana Ferreira',              'Travessa Bela Vista, 12'),
  ('H4',  4, 'Benedito Carlos Moura',     'M', 67, NULL, 'dm',     'Conceição Moura',             'Rua São Jorge, 310'),
  ('H5',  5, 'Cleusa Aparecida Ribeiro',  'F', 55, NULL, 'has',    'Rita de Cássia Ribeiro',      'Rua das Acácias, 88'),
  ('H6',  6, 'Raimundo Nonato Silva',     'M', 62, NULL, 'has_dm', 'Francisca Nonato',            'Rua Esperança, 501'),
  ('H7',  7, 'Sueli Martins Costa',       'F', 49, NULL, 'dm',     'Lázara Martins',              'Rua dos Ipês, 230'),
  ('H8',  8, 'Wagner Luiz Pereira',       'M', 53, NULL, 'has',    'Odete Pereira',               'Avenida Primavera, 1020'),
  ('G1', 11, 'Natália Alves Rocha',       'F', 27, NULL, 'pn',     'Sandra Alves',                'Rua Esperança, 77'),
  ('G2', 12, 'Gabriela Souza Lima',       'F', 31, NULL, 'pn',     'Marta Souza',                 'Rua São Jorge, 18'),
  ('G3', 13, 'Tainá Moreira Dantas',      'F', 22, NULL, 'pn',     'Josefa Moreira',              'Travessa Bela Vista, 40'),
  ('G4', 14, 'Bruna Rodrigues Nunes',     'F', 34, NULL, 'pn',     'Cícera Rodrigues',            'Rua das Acácias, 260'),
  ('C1', 21, 'Davi Lucas Oliveira',       'M', 0,  62,   'puer',   'Kelly Cristina Oliveira',     'Rua dos Ipês, 92'),
  ('C2', 22, 'Isabela Cristina Souza',    'F', 0,  215,  'puer',   'Mônica Souza Freire',         'Avenida Primavera, 455'),
  ('C3', 23, 'Arthur Henrique Lima',      'M', 1,  400,  'puer',   'Daiane Lima Barros',          'Rua Esperança, 300'),
  ('C4', 24, 'Alice Vitória Santos',      'F', 1,  610,  'puer',   'Rafaela Santos Moura',        'Rua São Jorge, 141'),
  ('E1', 31, 'Valdir Gomes Ferreira',     'M', 61, NULL, 'env',    'Isaura Gomes',                'Rua das Acácias, 15'),
  ('E2', 32, 'Lourdes Aparecida Matos',   'F', 74, NULL, 'env',    'Benedita Matos',              'Travessa Bela Vista, 66'),
  ('E3', 33, 'Roberto Nunes Barreto',     'M', 45, NULL, 'env',    'Irene Nunes',                 'Avenida Primavera, 780'),
  ('D1', 41, 'Rosana Lopes Teixeira',     'F', 39, NULL, 'dem',    'Ivone Lopes',                 'Rua dos Ipês, 610'),
  ('D2', 42, 'Sérgio Ramos Pinheiro',     'M', 47, NULL, 'dem',    'Nair Ramos',                  'Rua Esperança, 19');

DO $$
DECLARE
  v_rec constant uuid := 'd0300000-0000-4000-8000-000000000064';
  v_c1  constant uuid := 'd0200000-0000-4000-8000-000000000011';
  p record; v_nasc date; v_r jsonb;
BEGIN
  FOR p IN SELECT * FROM demo_ubs_pac ORDER BY seq LOOP
    v_nasc := CASE WHEN p.dias_vida IS NOT NULL THEN private.data_atual() - p.dias_vida
                   ELSE (private.data_atual() - make_interval(years => p.anos) - (37 * p.seq % 300) * interval '1 day')::date END;
    v_r := pg_temp.demo_como(v_rec, format('SELECT public.salvar_cadastro_paciente(NULL, %L::jsonb, %L::uuid)::text',
      jsonb_strip_nulls(jsonb_build_object(
        'nome', p.nome, 'sexo', p.sexo, 'data_nascimento', v_nasc, 'cns', pg_temp.demo_cns(p.seq), 'nome_mae', p.mae,
        'categoria', 'sus', 'endereco', p.endereco || ' – Vila Esperança', 'municipio', 'Santa Aurora', 'uf', 'SP',
        'responsavel_nome', CASE WHEN p.grupo = 'puer' THEN p.mae END,
        'responsavel_parentesco', CASE WHEN p.grupo = 'puer' THEN 'mãe' END)), v_c1))::jsonb;
    UPDATE demo_ubs_pac SET id = (v_r ->> 'paciente_id')::uuid WHERE cod = p.cod;
  END LOOP;
END $$;

-- ── 8. consultas pelas funções do banco ─────────────────────────────────────
-- episódio → quando (o horário de verdade da consulta, para o ajuste)
CREATE TEMP TABLE demo_ep (ep uuid PRIMARY KEY, quando timestamptz, tipo text) ON COMMIT DROP;
-- pedidos de regulação → horários de cada passo
CREATE TEMP TABLE demo_reg (cod text PRIMARY KEY, id uuid, criada timestamptz, assumida timestamptz, priorizada timestamptz,
                            autorizada timestamptz, aceita timestamptz, chegada timestamptz) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.demo_arr(p jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT ARRAY(SELECT jsonb_array_elements_text(coalesce(p, '[]'::jsonb)))::text
$f$;

-- o médico atende a consulta já aberta: SOAP, crescimento da criança, HbA1c,
-- pés, regulação, envio à UPA e a conduta da ficha da atenção primária
CREATE OR REPLACE FUNCTION pg_temp.demo_atender(p_ep uuid, p_pac uuid, p_quando timestamptz, c jsonb) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
  v_med constant uuid := 'd0300000-0000-4000-8000-000000000061';
  v_ubs constant uuid := 'd0100000-0000-4000-8000-000000000002';
  v_upa constant uuid := 'd0100000-0000-4000-8000-000000000001';
  v_r jsonb; v_env uuid;
BEGIN
  PERFORM pg_temp.demo_como(v_med, format('SELECT public.iniciar_atendimento(%L::uuid)::text', p_ep));
  IF c ? 'peso' THEN
    PERFORM pg_temp.demo_como(v_med, format('SELECT public.registrar_afericao_crescimento(%L::uuid, %L::date, %s, %s, NULL, %L::uuid)::text',
      p_pac, private.data_atual(), c ->> 'peso', c ->> 'estatura', p_ep));
  END IF;
  PERFORM pg_temp.demo_como(v_med, format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text',
    p_ep, c ->> 's', c ->> 'o', c ->> 'a', c ->> 'p', c ->> 'cid'));
  IF coalesce((c ->> 'hba1c')::boolean, false) THEN
    PERFORM pg_temp.demo_como(v_med, format('SELECT public.pedir_exames(%L::uuid, %L::jsonb)::text', p_ep, '[{"procedimento":"0202010503"}]'));
  END IF;
  IF c ? 'pes' THEN
    PERFORM pg_temp.demo_como(v_med, format('SELECT public.registrar_avaliacao_pes(%L::uuid, %L, %L)::text', p_ep, c ->> 'pes', c ->> 'pes_obs'));
  END IF;
  IF c ? 'reg' THEN
    v_r := pg_temp.demo_como(v_med, format('SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb)::text', v_ubs, p_pac,
             (c -> 'reg' -> 'dados') || jsonb_build_object('episodio_id', p_ep)))::jsonb;
    INSERT INTO demo_reg (cod, id, criada) VALUES (c -> 'reg' ->> 'cod', (v_r ->> 'id')::uuid, p_quando + interval '14 minutes');
  END IF;
  IF c ? 'upa' THEN
    v_env := pg_temp.demo_como(v_med, format('SELECT public.encaminhar_upa(%L::uuid, %L::uuid, %L)::text', p_ep, v_upa, c ->> 'upa'))::uuid;
    IF c ? 'upa_cancelar' THEN
      PERFORM pg_temp.demo_como(v_med, format('SELECT public.encaminhamento_upa_cancelar(%L::uuid, %L)::text', v_env, c ->> 'upa_cancelar'));
    END IF;
  END IF;
  PERFORM pg_temp.demo_como(v_med, format('SELECT public.registrar_conduta_aps(%L::uuid, %L, %L::text[], %L::text[], %L::text[], %L, %L::text[])::text',
    p_ep, c ->> 'tipo', pg_temp.demo_arr(c -> 'problemas'), pg_temp.demo_arr(c -> 'cids'), pg_temp.demo_arr(c -> 'condutas'),
    c ->> 'obs', pg_temp.demo_arr(c -> 'ciaps')));
END $f$;

-- consultas já feitas: dias atrás e hora. Com "cor", a ficha é de escuta
-- inicial e a enfermeira faz a escuta com os sinais (pressão, peso e altura,
-- como no roteiro e2e 43); sem "cor", a ficha vai direto ao médico.
-- hora NULL = hoje, há cerca de 45 minutos.
CREATE TEMP TABLE demo_hist (n int PRIMARY KEY, cod text, dias int, hora time, spec jsonb) ON COMMIT DROP;
INSERT INTO demo_hist VALUES
  -- hiperdia
  (1, 'H1', 24, '08:20', '{"cor":"verde","queixa":"Consulta de acompanhamento da pressão e do diabetes",
       "sinais":{"pressao-arterial-sistolica":148,"pressao-arterial-diastolica":92,"frequencia-cardiaca":80,"glicemia-capilar":168,"peso":72.4,"estatura":158},
       "s":"Hipertensa e diabética há 10 anos. Refere cansaço aos esforços nos últimos três meses.","o":"PA 148x92 mmHg. Pés sem lesões, sensibilidade preservada.",
       "a":"Hipertensão e diabetes fora da meta; cansaço aos esforços a esclarecer.","p":"Ajuste do tratamento conforme o protocolo da unidade, HbA1c e avaliação da cardiologia pela regulação.",
       "cid":"I10","hba1c":true,"pes":"sem_alteracao",
       "reg":{"cod":"R1","dados":{"tipo":"consulta","especialidade":"Cardiologia","cbo":"225120","procedimento":"0301010072","cid":"I10",
              "carater":"eletivo","prioridade":"prioritaria","destino_tipo":"a_definir","tempo_evolucao":"Meses","hipotese":"Hipertensão de difícil controle",
              "quadro_clinico":"Hipertensa e diabética há 10 anos, com pressão acima da meta apesar do tratamento e cansaço aos esforços há três meses.",
              "vulnerabilidades":["idoso"]}},
       "tipo":"consulta_programada","problemas":["hipertensao_arterial","diabetes"],"cids":["I10","E11.9"],"ciaps":["K86","T90"],
       "condutas":["retorno_cuidado_continuado","encaminhamento_especializado"]}'),
  (2, 'H2', 40, '09:00', '{"cor":"verde","queixa":"Consulta de acompanhamento da pressão",
       "sinais":{"pressao-arterial-sistolica":146,"pressao-arterial-diastolica":92,"frequencia-cardiaca":76,"peso":84,"estatura":172},
       "s":"Hipertenso há 6 anos, sem queixas.","o":"PA 146x92 mmHg.","a":"Hipertensão arterial acima da meta.",
       "p":"Ajuste do tratamento conforme o protocolo da unidade e retorno com a pressão aferida.","cid":"I10",
       "tipo":"consulta_programada","problemas":["hipertensao_arterial"],"cids":["I10"],"ciaps":["K86"],"condutas":["retorno_cuidado_continuado"]}'),
  (3, 'H3', 245, '08:40', '{"cor":"verde","queixa":"Renovar o acompanhamento da pressão e do diabetes",
       "sinais":{"pressao-arterial-sistolica":152,"pressao-arterial-diastolica":90,"glicemia-capilar":182,"peso":69,"estatura":155},
       "s":"Hipertensa e diabética, veio renovar o acompanhamento.","o":"PA 152x90 mmHg.","a":"Hipertensão e diabetes sem controle ideal.",
       "p":"HbA1c e retorno em três meses.","cid":"E11.9","hba1c":true,
       "tipo":"consulta_programada","problemas":["hipertensao_arterial","diabetes"],"cids":["I10","E11.9"],"ciaps":["K86","T90"],"condutas":["retorno_cuidado_continuado"]}'),
  (4, 'H4', 29, '10:20', '{"cor":"verde","queixa":"Consulta de acompanhamento do diabetes",
       "sinais":{"pressao-arterial-sistolica":132,"pressao-arterial-diastolica":84,"glicemia-capilar":196,"peso":88,"estatura":170},
       "s":"Diabético há 12 anos. Refere visão embaçada e formigamento nos pés.","o":"PA 132x84 mmHg. Sensibilidade diminuída no pé esquerdo.",
       "a":"Diabetes com sinais de neuropatia periférica; sem avaliação oftalmológica há mais de dois anos.",
       "p":"HbA1c, cuidados com os pés e avaliação da oftalmologia pela regulação.","cid":"E11.9","hba1c":true,
       "pes":"com_alteracao","pes_obs":"Sensibilidade diminuída no pé esquerdo ao monofilamento.",
       "reg":{"cod":"R3","dados":{"tipo":"consulta","especialidade":"Oftalmologia","cbo":"225265","procedimento":"0301010072","cid":"E11.9",
              "carater":"eletivo","prioridade":"eletiva","destino_tipo":"a_definir","tempo_evolucao":"Anos",
              "quadro_clinico":"Diabético há 12 anos, com visão embaçada e sem avaliação oftalmológica há mais de dois anos. Rastreamento de retinopatia diabética.",
              "vulnerabilidades":["idoso"]}},
       "tipo":"consulta_programada","problemas":["diabetes"],"cids":["E11.9"],"ciaps":["T90"],
       "condutas":["retorno_cuidado_continuado","encaminhamento_especializado"]}'),
  (5, 'H5', 150, '14:00', '{"cor":"verde","queixa":"Consulta de acompanhamento da pressão",
       "sinais":{"pressao-arterial-sistolica":142,"pressao-arterial-diastolica":88,"frequencia-cardiaca":74,"peso":79},
       "s":"Hipertensa, sem queixas.","o":"PA 142x88 mmHg.","a":"Hipertensão arterial em acompanhamento.","p":"Retorno em três meses.","cid":"I10",
       "tipo":"consulta_programada","problemas":["hipertensao_arterial"],"cids":["I10"],"ciaps":["K86"],"condutas":["retorno_cuidado_continuado"]}'),
  (6, 'H6', 20, '09:40', '{"cor":"verde","queixa":"Consulta de acompanhamento; falta de ar ao subir escadas",
       "sinais":{"pressao-arterial-sistolica":150,"pressao-arterial-diastolica":94,"frequencia-cardiaca":84,"glicemia-capilar":174,"peso":91,"estatura":175},
       "s":"Hipertenso e diabético. Refere falta de ar ao subir escadas há dois meses.","o":"PA 150x94 mmHg. Sopro sistólico discreto.",
       "a":"Hipertensão e diabetes; falta de ar aos esforços a esclarecer.","p":"HbA1c e ecocardiograma pela regulação.","cid":"I10","hba1c":true,
       "reg":{"cod":"R2","dados":{"tipo":"exame","procedimento":"0205010032","cid":"I10","carater":"eletivo","prioridade":"prioritaria",
              "destino_tipo":"a_definir","tempo_evolucao":"Meses",
              "quadro_clinico":"Hipertenso e diabético com falta de ar aos esforços há dois meses e sopro sistólico discreto ao exame.",
              "vulnerabilidades":["idoso"]}},
       "tipo":"consulta_programada","problemas":["hipertensao_arterial","diabetes"],"cids":["I10","E11.9"],"ciaps":["K86","T90"],
       "condutas":["retorno_cuidado_continuado","encaminhamento_especializado"]}'),
  (7, 'H7', 400, '08:00', '{"cor":"verde","queixa":"Consulta de acompanhamento do diabetes",
       "sinais":{"pressao-arterial-sistolica":128,"pressao-arterial-diastolica":80,"glicemia-capilar":210,"peso":77,"estatura":160},
       "s":"Diabética há 5 anos.","o":"PA 128x80 mmHg.","a":"Diabetes tipo 2 sem controle ideal.","p":"HbA1c e retorno em três meses.","cid":"E11.9","hba1c":true,
       "tipo":"consulta_programada","problemas":["diabetes"],"cids":["E11.9"],"ciaps":["T90"],"condutas":["retorno_cuidado_continuado"]}'),
  (8, 'H8', 12, '10:00', '{"cor":"amarelo","queixa":"Dor de cabeça e pressão alta medida na farmácia",
       "sinais":{"pressao-arterial-sistolica":162,"pressao-arterial-diastolica":102,"frequencia-cardiaca":88,"peso":95,"estatura":178},
       "s":"Dor de cabeça há três dias; mediu a pressão na farmácia.","o":"PA 162x102 mmHg, sem sinais de alarme.","a":"Pressão elevada sem diagnóstico anterior.",
       "p":"Aferições da pressão durante a semana e retorno agendado.","cid":"R03.0",
       "tipo":"consulta_no_dia","problemas":[],"cids":["R03.0"],"ciaps":[],"condutas":["retorno_consulta_agendada"]}'),
  -- pré-natal (a DUM entra depois, no passo 8b)
  (11, 'G1', 154, '08:00', '{"cor":"verde","queixa":"Primeira consulta de pré-natal","sinais":{"pressao-arterial-sistolica":110,"pressao-arterial-diastolica":70,"peso":61,"estatura":163},
       "s":"Gestação confirmada por teste; sem queixas.","o":"PA 110x70 mmHg. Exame físico sem alterações.","a":"Gestação de baixo risco.","p":"Exames de rotina do pré-natal e retorno.","cid":"Z34.0",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.0"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (12, 'G1', 112, '08:00', '{"cor":"verde","queixa":"Consulta de pré-natal","sinais":{"pressao-arterial-sistolica":112,"pressao-arterial-diastolica":72,"peso":62.5,"estatura":163},
       "s":"Sem queixas.","o":"PA 112x72 mmHg. Exame obstétrico sem alterações.","a":"Gestação de baixo risco.","p":"Retorno conforme o calendário do pré-natal.","cid":"Z34.0",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.0"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (13, 'G1', 70, '08:20', '{"cor":"verde","queixa":"Consulta de pré-natal","sinais":{"pressao-arterial-sistolica":108,"pressao-arterial-diastolica":68,"peso":64.8,"estatura":163},
       "s":"Sem queixas; boa movimentação fetal.","o":"PA 108x68 mmHg. Exame obstétrico sem alterações.","a":"Gestação de baixo risco.","p":"Retorno conforme o calendário do pré-natal.","cid":"Z34.0",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.0"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (14, 'G1', 28, '08:20', '{"cor":"verde","queixa":"Consulta de pré-natal","sinais":{"pressao-arterial-sistolica":114,"pressao-arterial-diastolica":74,"peso":67.2,"estatura":163},
       "s":"Sem queixas; boa movimentação fetal.","o":"PA 114x74 mmHg. Exame obstétrico sem alterações.","a":"Gestação de baixo risco.","p":"Retorno conforme o calendário do pré-natal.","cid":"Z34.0",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.0"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (15, 'G2', 49, '09:20', '{"cor":"verde","queixa":"Primeira consulta de pré-natal","sinais":{"pressao-arterial-sistolica":104,"pressao-arterial-diastolica":66,"peso":58,"estatura":158},
       "s":"Gestação confirmada por teste; náuseas leves pela manhã.","o":"PA 104x66 mmHg. Exame físico sem alterações.","a":"Gestação de baixo risco.","p":"Exames de rotina do pré-natal e retorno.","cid":"Z34.9",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.9"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (16, 'G2', 14, '09:20', '{"cor":"verde","queixa":"Consulta de pré-natal","sinais":{"pressao-arterial-sistolica":108,"pressao-arterial-diastolica":70,"peso":59.5,"estatura":158},
       "s":"Sem queixas.","o":"PA 108x70 mmHg. Exame obstétrico sem alterações.","a":"Gestação de baixo risco, ainda sem ultrassonografia.","p":"Ultrassonografia obstétrica pela regulação e retorno.","cid":"Z34.9",
       "reg":{"cod":"R4","dados":{"tipo":"exame","procedimento":"0205020143","cid":"Z34.9","carater":"eletivo","prioridade":"prioritaria","destino_tipo":"a_definir",
              "tempo_evolucao":"Semanas","quadro_clinico":"Gestante de 14 semanas, sem ultrassonografia obstétrica até agora. Exame de rotina do pré-natal para datar a gestação.",
              "vulnerabilidades":["gestante"]}},
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.9"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado","encaminhamento_especializado"]}'),
  (17, 'G3', 21, '10:40', '{"cor":"verde","queixa":"Primeira consulta de pré-natal","sinais":{"pressao-arterial-sistolica":112,"pressao-arterial-diastolica":70,"peso":64,"estatura":166},
       "s":"Gestação confirmada por teste; sem queixas.","o":"PA 112x70 mmHg. Exame físico sem alterações.","a":"Gestação de baixo risco.","p":"Exames de rotina do pré-natal e retorno.","cid":"Z34.0",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.0"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (18, 'G4', 182, '13:20', '{"cor":"verde","queixa":"Primeira consulta de pré-natal","sinais":{"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":76,"peso":70,"estatura":160},
       "s":"Segunda gestação; sem queixas.","o":"PA 118x76 mmHg. Exame físico sem alterações.","a":"Gestação de baixo risco.","p":"Exames de rotina do pré-natal e retorno.","cid":"Z34.8",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.8"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (19, 'G4', 140, '13:20', '{"cor":"verde","queixa":"Consulta de pré-natal","sinais":{"pressao-arterial-sistolica":116,"pressao-arterial-diastolica":74,"peso":72,"estatura":160},
       "s":"Sem queixas.","o":"PA 116x74 mmHg. Exame obstétrico sem alterações.","a":"Gestação de baixo risco.","p":"Retorno conforme o calendário do pré-natal.","cid":"Z34.8",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.8"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (20, 'G4', 98, '13:40', '{"cor":"verde","queixa":"Consulta de pré-natal","sinais":{"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":78,"peso":75,"estatura":160},
       "s":"Sem queixas; boa movimentação fetal.","o":"PA 120x78 mmHg. Exame obstétrico sem alterações.","a":"Gestação de baixo risco.","p":"Retorno conforme o calendário do pré-natal.","cid":"Z34.8",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.8"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (21, 'G4', 56, '13:40', '{"cor":"verde","queixa":"Consulta de pré-natal","sinais":{"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":76,"peso":78,"estatura":160},
       "s":"Sem queixas; boa movimentação fetal.","o":"PA 118x76 mmHg. Exame obstétrico sem alterações.","a":"Gestação de baixo risco.","p":"Retorno conforme o calendário do pré-natal.","cid":"Z34.8",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.8"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (22, 'G4', 14, '14:00', '{"cor":"verde","queixa":"Consulta de pré-natal","sinais":{"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":78,"peso":80,"estatura":160},
       "s":"Sem queixas; boa movimentação fetal.","o":"PA 122x78 mmHg. Exame obstétrico sem alterações.","a":"Gestação de baixo risco no terceiro trimestre.","p":"Retorno semanal até o parto.","cid":"Z34.8",
       "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.8"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  -- puericultura (peso em kg e estatura em cm)
  (31, 'C1', 55, '08:40', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":3.4,"estatura":50.5}'),
  (32, 'C1', 30, '08:40', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":4.5,"estatura":54.5}'),
  (33, 'C2', 209, '09:00', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":3.3,"estatura":49.5}'),
  (34, 'C2', 180, '09:00', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":4.3,"estatura":54}'),
  (35, 'C2', 150, '09:00', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":5.3,"estatura":58}'),
  (36, 'C2', 90, '09:20', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":6.6,"estatura":63}'),
  (37, 'C2', 30, '09:20', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":7.4,"estatura":66}'),
  (38, 'C3', 392, '10:00', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":3.6,"estatura":51}'),
  (39, 'C3', 362, '10:00', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":4.9,"estatura":56}'),
  (40, 'C3', 332, '10:00', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":5.9,"estatura":59.5}'),
  (41, 'C3', 272, '10:20', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":7.3,"estatura":65}'),
  (42, 'C3', 212, '10:20', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":8.2,"estatura":69}'),
  (43, 'C3', 30, '10:20', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":10.0,"estatura":76}'),
  (44, 'C4', 600, '14:20', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":3.2,"estatura":49}'),
  (45, 'C4', 570, '14:20', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":4.4,"estatura":54}'),
  (46, 'C4', 485, '14:40', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":6.4,"estatura":62}'),
  (47, 'C4', 330, '14:40', '{"ficha":"consulta_programada","queixa":"Consulta de puericultura","peso":8.3,"estatura":70}'),
  -- envios à UPA
  (51, 'E3', 5, '14:20', '{"ficha":"consulta_no_dia","queixa":"Dor na barriga forte desde a manhã",
       "s":"Dor abdominal forte desde a manhã, sem vômitos.","o":"Abdome doloroso à palpação, sem sinais de irritação peritoneal.",
       "a":"Dor abdominal a esclarecer.","p":"Envio à UPA; reavaliado na unidade, segue com retorno.","cid":"R10.4",
       "upa":"Dor abdominal intensa desde a manhã, sem melhora na unidade; avaliar abdome agudo.",
       "upa_cancelar":"Reavaliado depois de uma hora: dor melhorou e abdome sem sinais de alarme; segue com retorno na UBS.",
       "tipo":"consulta_no_dia","problemas":[],"cids":["R10.4"],"ciaps":[],"condutas":["retorno_consulta_agendada"]}'),
  (52, 'E2', 2, '10:40', '{"ficha":"consulta_no_dia","queixa":"Tontura e fraqueza há dois dias",
       "s":"Tontura e fraqueza há dois dias, pior ao levantar.","o":"Pressão baixa ao levantar; mucosas descoradas.",
       "a":"Tontura a esclarecer, com pressão baixa.","p":"Encaminhada à UPA para avaliação e exames.","cid":"R42",
       "upa":"Tontura e fraqueza com pressão baixa ao levantar; precisa de avaliação e exames na urgência.",
       "tipo":"consulta_no_dia","problemas":[],"cids":["R42"],"ciaps":[],"condutas":["encaminhamento_urgencia"]}'),
  (53, 'E1', 0, NULL, '{"cor":"vermelho","queixa":"Dor no peito e falta de ar desde a manhã",
       "sinais":{"pressao-arterial-sistolica":168,"pressao-arterial-diastolica":98,"frequencia-cardiaca":112,"saturacao-o2":93},
       "s":"Dor no peito em aperto há duas horas, com falta de ar.","o":"PA 168x98 mmHg, FC 112 bpm, SpO2 93%. Sudoreico.",
       "a":"Dor torácica com sinais de alarme.","p":"Encaminhado à UPA Jardim Primavera para eletrocardiograma e avaliação.","cid":"R07.4",
       "upa":"Dor torácica típica há duas horas, com falta de ar; a UBS não tem eletrocardiograma.",
       "tipo":"consulta_no_dia","problemas":[],"cids":["R07.4"],"ciaps":[],"condutas":["encaminhamento_urgencia"]}');

-- texto e conduta padrão da puericultura
UPDATE demo_hist SET spec = spec || '{"s":"Consulta de puericultura; mãe sem queixas.","o":"Peso e estatura aferidos; exame físico sem alterações.",
  "a":"Crescimento e desenvolvimento adequados.","p":"Orientações de aleitamento e vacinas; retorno conforme o calendário.","cid":"Z00.1",
  "tipo":"consulta_programada","problemas":["puericultura"],"cids":["Z00.1"],"ciaps":["A98"],"condutas":["retorno_cuidado_continuado"]}'::jsonb
 WHERE cod LIKE 'C%';

DO $$
DECLARE
  v_rec constant uuid := 'd0300000-0000-4000-8000-000000000064';
  v_enf constant uuid := 'd0300000-0000-4000-8000-000000000062';
  v_c1  constant uuid := 'd0200000-0000-4000-8000-000000000011';
  h record; v_ep uuid; v_quando timestamptz;
BEGIN
  FOR h IN SELECT x.*, p.id AS pac FROM demo_hist x JOIN demo_ubs_pac p ON p.cod = x.cod ORDER BY x.n LOOP
    v_quando := CASE WHEN h.hora IS NULL
                     THEN least(greatest((private.data_atual() + time '07:02') AT TIME ZONE 'America/Sao_Paulo', now() - interval '45 minutes'),
                                now() - interval '20 minutes')
                     ELSE ((private.data_atual() - h.dias) + h.hora) AT TIME ZONE 'America/Sao_Paulo' END;
    -- recepção: ficha (escuta inicial ou direto à consulta)
    v_ep := (pg_temp.demo_como(v_rec, format('SELECT public.registrar_ficha(%L::uuid, %L, %L::uuid, %L::jsonb)::text', v_c1, h.spec ->> 'queixa', h.pac,
               jsonb_build_object('tipo_atendimento', CASE WHEN h.spec ? 'cor' THEN 'escuta_inicial' ELSE h.spec ->> 'ficha' END)))::jsonb ->> 'episodio_id')::uuid;
    -- enfermeira: escuta inicial (CAB 28) com os sinais
    IF h.spec ? 'cor' THEN
      PERFORM pg_temp.demo_como(v_enf, format('SELECT public.registrar_escuta_aps(%L::uuid, %L, %L, %L, %L::jsonb)::text',
        v_ep, h.spec ->> 'cor', 'consulta', h.spec ->> 'queixa', h.spec -> 'sinais'));
    END IF;
    -- médica: atendimento e conduta
    PERFORM pg_temp.demo_atender(v_ep, h.pac, v_quando, h.spec);
    INSERT INTO demo_ep VALUES (v_ep, v_quando, 'consulta');
  END LOOP;
END $$;

-- ── 8b. DUM das gestantes (médica) ──────────────────────────────────────────
-- G1 com 30 semanas, G2 com 16, G3 com 11 e G4 com 36
DO $$
DECLARE g record;
BEGIN
  FOR g IN SELECT x.id AS gestacao, d.dias
             FROM (VALUES ('G1', 210), ('G2', 112), ('G3', 77), ('G4', 252)) d(cod, dias)
             JOIN demo_ubs_pac p ON p.cod = d.cod
             JOIN public.pre_natal_gestacoes x ON x.paciente_id = p.id AND x.saida_em IS NULL LOOP
    PERFORM pg_temp.demo_como('d0300000-0000-4000-8000-000000000061',
      format('SELECT public.pre_natal_definir_dum(%L::uuid, %L::date)::text', g.gestacao, private.data_atual() - g.dias));
  END LOOP;
END $$;

-- ── 9. agenda de consultas: hoje e os próximos dias ─────────────────────────
-- Hoje, pelo horário em que o roteiro roda: horário que já acabou sai
-- realizado (ou falta, se marcado assim); o que começa em até 30 min sai
-- "presente" (o paciente chegou e espera); o resto fica agendado.
CREATE TEMP TABLE demo_agenda (n int PRIMARY KEY, cod text, prof text, dia int, hora time, tipo text, obs text, falta boolean, spec jsonb) ON COMMIT DROP;
INSERT INTO demo_agenda VALUES
  -- hoje, médica
  (1,  'H2', 'med', 0, '07:00', 'consulta_programada', 'Retorno do hiperdia', false,
       '{"s":"Retorno do acompanhamento da pressão; sem queixas.","o":"Bom estado geral.","a":"Hipertensão arterial em acompanhamento.","p":"Mantém o acompanhamento; retorno em três meses.","cid":"I10",
         "tipo":"consulta_programada","problemas":["hipertensao_arterial"],"cids":["I10"],"ciaps":["K86"],"condutas":["retorno_cuidado_continuado"]}'),
  (2,  'H3', 'med', 0, '07:20', 'consulta_programada', 'Retorno do hiperdia (busca ativa)', true, NULL),
  (3,  'G3', 'med', 0, '07:40', 'consulta_programada', 'Pré-natal', false,
       '{"s":"Sem queixas.","o":"Exame obstétrico sem alterações.","a":"Gestação de baixo risco.","p":"Retorno conforme o calendário do pré-natal.","cid":"Z34.0",
         "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.0"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  (4,  'C2', 'med', 0, '08:00', 'consulta_programada', 'Puericultura', false,
       '{"peso":7.6,"estatura":67,"s":"Consulta de puericultura; mãe sem queixas.","o":"Peso e estatura aferidos; exame físico sem alterações.","a":"Crescimento e desenvolvimento adequados.",
         "p":"Orientações de alimentação e vacinas; retorno conforme o calendário.","cid":"Z00.1",
         "tipo":"consulta_programada","problemas":["puericultura"],"cids":["Z00.1"],"ciaps":["A98"],"condutas":["retorno_cuidado_continuado"]}'),
  (5,  'D1', 'med', 0, '08:20', 'consulta_agendada', 'Dor nas costas', true, NULL),
  (6,  'H8', 'med', 0, '09:00', 'consulta_agendada', 'Retorno: pressão alta', false,
       '{"s":"Retorno com as aferições da semana, todas acima de 140x90 mmHg.","o":"Bom estado geral.","a":"Hipertensão arterial sistêmica.",
         "p":"Início do tratamento conforme o protocolo da unidade e entrada no hiperdia.","cid":"I10",
         "tipo":"consulta_agendada","problemas":["hipertensao_arterial"],"cids":["I10"],"ciaps":["K86"],"condutas":["retorno_cuidado_continuado"]}'),
  (7,  'H6', 'med', 0, '09:20', 'consulta_programada', 'Retorno com o resultado da HbA1c', false,
       '{"s":"Retorno com o resultado da HbA1c; aguarda o ecocardiograma.","o":"Pés sem lesões, sensibilidade preservada.","a":"Hipertensão e diabetes em acompanhamento.",
         "p":"Mantém o acompanhamento; retorno depois do ecocardiograma.","cid":"E11.9","pes":"sem_alteracao",
         "tipo":"consulta_programada","problemas":["hipertensao_arterial","diabetes"],"cids":["I10","E11.9"],"ciaps":["K86","T90"],"condutas":["retorno_cuidado_continuado"]}'),
  (8,  'H5', 'med', 0, '10:00', 'consulta_programada', 'Retorno do hiperdia', false,
       '{"s":"Retorno do acompanhamento da pressão; sem queixas.","o":"Bom estado geral.","a":"Hipertensão arterial em acompanhamento.","p":"Mantém o acompanhamento; retorno em três meses.","cid":"I10",
         "tipo":"consulta_programada","problemas":["hipertensao_arterial"],"cids":["I10"],"ciaps":["K86"],"condutas":["retorno_cuidado_continuado"]}'),
  (9,  'D2', 'med', 0, '10:40', 'consulta_agendada', 'Resultado de exames', false,
       '{"s":"Traz exames de rotina.","o":"Bom estado geral.","a":"Colesterol elevado.","p":"Orientação de dieta e atividade física; retorno em seis meses.","cid":"E78.5",
         "tipo":"consulta_agendada","problemas":["rastreamento_risco_cardiovascular"],"cids":["E78.5"],"ciaps":[],"condutas":["retorno_consulta_agendada"]}'),
  (10, 'H7', 'med', 0, '14:00', 'consulta_programada', 'Retorno do diabetes (atrasado)', false,
       '{"s":"Retorno do acompanhamento do diabetes depois de um ano sem consulta.","o":"Bom estado geral.","a":"Diabetes tipo 2.","p":"HbA1c e retorno em três meses.","cid":"E11.9","hba1c":true,
         "tipo":"consulta_programada","problemas":["diabetes"],"cids":["E11.9"],"ciaps":["T90"],"condutas":["retorno_cuidado_continuado"]}'),
  (11, 'G2', 'med', 0, '15:00', 'consulta_programada', 'Pré-natal', false,
       '{"s":"Sem queixas; aguarda a ultrassonografia.","o":"Exame obstétrico sem alterações.","a":"Gestação de baixo risco.","p":"Retorno conforme o calendário do pré-natal.","cid":"Z34.9",
         "tipo":"consulta_programada","problemas":["pre_natal"],"cids":["Z34.9"],"ciaps":["W78"],"condutas":["retorno_cuidado_continuado"]}'),
  -- próximos dias, médica
  (12, 'C1', 'med', 1, '07:40', 'consulta_programada', 'Puericultura (2 meses)', false, NULL),
  (13, 'H1', 'med', 1, '09:00', 'consulta_programada', 'Retorno com a avaliação da cardiologia', false, NULL),
  (14, 'G1', 'med', 2, '08:20', 'consulta_programada', 'Pré-natal', false, NULL),
  (15, 'D1', 'med', 2, '10:00', 'consulta_agendada', 'Dor nas costas (remarcada)', false, NULL),
  (16, 'C3', 'med', 3, '07:20', 'consulta_programada', 'Puericultura', false, NULL),
  (17, 'H4', 'med', 3, '09:40', 'consulta_programada', 'Retorno do diabetes', false, NULL),
  (18, 'G4', 'med', 4, '08:00', 'consulta_programada', 'Pré-natal', false, NULL),
  (19, 'C4', 'med', 5, '13:20', 'consulta_programada', 'Puericultura (retorno atrasado)', false, NULL),
  -- próximos dias, enfermeira
  (20, 'G2', 'enf', 1, '08:30', 'consulta_programada', 'Consulta de enfermagem do pré-natal', false, NULL),
  (21, 'C4', 'enf', 2, '13:30', 'consulta_programada', 'Consulta de enfermagem da puericultura', false, NULL),
  (22, 'H5', 'enf', 4, '08:00', 'consulta_programada', 'Consulta de enfermagem do hiperdia', false, NULL);

DO $$
DECLARE
  v_ubs constant uuid := 'd0100000-0000-4000-8000-000000000002';
  v_c1  constant uuid := 'd0200000-0000-4000-8000-000000000011';
  v_rec constant uuid := 'd0300000-0000-4000-8000-000000000064';
  a record; v_prof uuid; v_ini timestamptz; v_fim timestamptz; v_marca timestamptz; v_ag uuid; v_ep uuid; v_estado text;
BEGIN
  FOR a IN SELECT x.*, p.id AS pac FROM demo_agenda x JOIN demo_ubs_pac p ON p.cod = x.cod ORDER BY x.dia, x.hora LOOP
    v_prof := CASE a.prof WHEN 'med' THEN 'd0300000-0000-4000-8000-000000000061'::uuid ELSE 'd0300000-0000-4000-8000-000000000062'::uuid END;
    v_ini := ((private.data_atual() + a.dia) + a.hora) AT TIME ZONE 'America/Sao_Paulo';
    v_fim := v_ini + make_interval(mins => CASE a.prof WHEN 'med' THEN 20 ELSE 30 END);
    v_estado := CASE WHEN a.dia > 0 THEN 'agendado'
                     WHEN v_fim <= now() THEN CASE WHEN a.falta THEN 'falta' WHEN a.spec IS NULL THEN 'agendado' ELSE 'realizado' END
                     WHEN NOT a.falta AND v_ini <= now() + interval '30 minutes' THEN 'presente'
                     ELSE 'agendado' END;
    -- a agenda só marca horário futuro: o de hoje que já passou é marcado na
    -- semana que vem e trazido para hoje (gravado direto)
    v_marca := CASE WHEN v_ini > now() THEN v_ini ELSE v_ini + interval '7 days' END;
    v_ag := pg_temp.demo_como(v_rec, format('SELECT public.agenda_marcar(%L::uuid, %L::uuid, %L::timestamptz, %L::uuid, %L, %L, NULL)::text',
              v_ubs, v_prof, v_marca, a.pac, a.tipo, a.obs))::uuid;
    UPDATE public.agendamentos SET inicio = v_ini, fim = v_fim, marcado_em = least(v_ini, now()) - interval '7 days' WHERE id = v_ag;
    IF v_estado = 'falta' THEN
      PERFORM pg_temp.demo_como(v_rec, format('SELECT public.agenda_registrar_falta(%L::uuid)::text', v_ag));
      UPDATE public.agendamentos SET situacao_em = least(v_fim + interval '10 minutes', now()) WHERE id = v_ag;
    ELSIF v_estado IN ('realizado', 'presente') THEN
      v_ep := (pg_temp.demo_como(v_rec, format('SELECT public.agenda_registrar_chegada(%L::uuid, %L::uuid, %L)::text', v_ag, v_c1, a.obs))::jsonb ->> 'episodio_id')::uuid;
      IF v_estado = 'realizado' THEN
        PERFORM pg_temp.demo_atender(v_ep, a.pac, v_ini, a.spec);
        INSERT INTO demo_ep VALUES (v_ep, v_ini, 'consulta');
      ELSE
        INSERT INTO demo_ep VALUES (v_ep, least(v_ini - interval '10 minutes', now() - interval '3 minutes'), 'presente');
      END IF;
    END IF;
  END LOOP;
END $$;

-- ── 10. regulação ───────────────────────────────────────────────────────────
-- UBS: a central assume, autoriza para o Hospital Regional, o hospital aceita
-- e marca a chegada (R1 realizada; R2 autorizada; R3 aguardando; R4 em análise).
-- UPA: pedidos da médica que internou os pacientes da Sala Vermelha no 02.
DO $$
DECLARE
  v_reg    constant uuid := 'd0300000-0000-4000-8000-000000000071';   -- reguladora
  v_hgest  constant uuid := 'd0300000-0000-4000-8000-000000000081';   -- gestor do hospital
  v_simone constant uuid := 'd0300000-0000-4000-8000-000000000001';
  v_upa    constant uuid := 'd0100000-0000-4000-8000-000000000001';
  v_hosp   constant uuid := 'd0100000-0000-4000-8000-000000000003';
  v_r jsonb; v_id uuid; v_hoje date := private.data_atual();
  u record;
BEGIN
  -- R1: consulta de cardiologia, realizada há 4 dias
  SELECT id INTO v_id FROM demo_reg WHERE cod = 'R1';
  PERFORM pg_temp.demo_como(v_reg, format('SELECT public.regulacao_assumir(%L::uuid)::text', v_id));
  PERFORM pg_temp.demo_como(v_reg, format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid, NULL, NULL, %L::timestamptz, %L)::text', v_id, 'rede', v_hosp,
    ((v_hoje - 4) + time '14:00') AT TIME ZONE 'America/Sao_Paulo', 'Consulta no ambulatório de cardiologia do Hospital Regional.'));
  PERFORM pg_temp.demo_como(v_hgest, format('SELECT public.regulacao_destino_aceitar(%L::uuid, NULL, %L)::text', v_id, 'Consulta confirmada para a data prevista.'));
  PERFORM pg_temp.demo_como(v_hgest, format('SELECT public.regulacao_marcar_chegada(%L::uuid, true, %L)::text', v_id, 'Paciente atendida no ambulatório de cardiologia.'));
  UPDATE demo_reg SET assumida   = ((v_hoje - 23) + time '09:10') AT TIME ZONE 'America/Sao_Paulo',
                      autorizada = ((v_hoje - 23) + time '09:25') AT TIME ZONE 'America/Sao_Paulo',
                      aceita     = ((v_hoje - 22) + time '10:05') AT TIME ZONE 'America/Sao_Paulo',
                      chegada    = ((v_hoje - 4) + time '14:20') AT TIME ZONE 'America/Sao_Paulo' WHERE cod = 'R1';

  -- R2: ecocardiograma autorizado para daqui a 6 dias
  SELECT id INTO v_id FROM demo_reg WHERE cod = 'R2';
  PERFORM pg_temp.demo_como(v_reg, format('SELECT public.regulacao_assumir(%L::uuid)::text', v_id));
  PERFORM pg_temp.demo_como(v_reg, format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid, NULL, NULL, %L::timestamptz, %L)::text', v_id, 'rede', v_hosp,
    ((v_hoje + 6) + time '09:00') AT TIME ZONE 'America/Sao_Paulo', 'Ecocardiograma no Hospital Regional; levar os exames anteriores.'));
  PERFORM pg_temp.demo_como(v_hgest, format('SELECT public.regulacao_destino_aceitar(%L::uuid, NULL, %L)::text', v_id, 'Exame agendado para a data prevista.'));
  UPDATE demo_reg SET assumida   = ((v_hoje - 17) + time '10:00') AT TIME ZONE 'America/Sao_Paulo',
                      autorizada = ((v_hoje - 17) + time '10:15') AT TIME ZONE 'America/Sao_Paulo',
                      aceita     = ((v_hoje - 16) + time '11:00') AT TIME ZONE 'America/Sao_Paulo' WHERE cod = 'R2';

  -- R3: oftalmologia aguardando na fila (o hospital está sem oftalmologista)
  -- R4: ultrassom obstétrico em análise desde ontem
  SELECT id INTO v_id FROM demo_reg WHERE cod = 'R4';
  PERFORM pg_temp.demo_como(v_reg, format('SELECT public.regulacao_assumir(%L::uuid)::text', v_id));
  UPDATE demo_reg SET assumida = ((v_hoje - 1) + time '15:00') AT TIME ZONE 'America/Sao_Paulo' WHERE cod = 'R4';

  -- UPA: os pacientes da Sala Vermelha do 02 (Cartão SUS pela coordenadora)
  FOR u IN SELECT x.cod, x.seq, p.id AS pac, i.id AS internacao, e.atendimento_medico_id AS medico, x.dados
             FROM (VALUES
               ('R5', 101, 'Neusa Maria de Oliveira', jsonb_build_object(
                  'tipo', 'transferencia', 'tipo_leito', 'uti_adulto', 'transporte', 'ambulancia_avancada', 'procedimento', '0303040149', 'cid', 'I63.9',
                  'carater', 'urgencia', 'prioridade', 'emergencia', 'destino_tipo', 'a_definir', 'tempo_evolucao', 'Horas',
                  'hipotese', 'Déficit neurológico agudo',
                  'quadro_clinico', 'Fraqueza súbita de um lado do corpo, iniciada há cerca de duas horas. Em monitorização na Sala Vermelha; precisa de avaliação neurológica e leito de terapia intensiva.',
                  'sinais_vitais', 'PA 186x102 mmHg, FC 92 bpm, FR 20 irpm, SpO2 95%, Tax 36,6 °C', 'vulnerabilidades', jsonb_build_array('idoso'))),
               ('R6', 102, 'Geraldo Ferreira Campos', jsonb_build_object(
                  'tipo', 'leito', 'tipo_leito', 'uti_adulto', 'procedimento', '0303060280', 'cid', 'R07.4',
                  'carater', 'urgencia', 'prioridade', 'urgencia', 'destino_tipo', 'a_definir', 'tempo_evolucao', 'Horas',
                  'hipotese', 'Dor torácica a esclarecer',
                  'quadro_clinico', 'Dor no peito há uma hora, com pressão baixa e saturação de 90% na chegada. Em monitorização na Sala Vermelha; precisa de leito de terapia intensiva.',
                  'sinais_vitais', 'PA 88x54 mmHg, FC 118 bpm, FR 26 irpm, SpO2 90%', 'vulnerabilidades', jsonb_build_array('idoso')))) x(cod, seq, nome, dados)
             JOIN public.pacientes p ON p.unidade_id = v_upa AND p.nome = x.nome AND p.ativo
             JOIN public.internacoes i ON i.paciente_id = p.id AND i.data_alta IS NULL
             JOIN public.episodios e ON e.id = i.episodio_id
            ORDER BY x.cod LOOP
    PERFORM pg_temp.demo_como(v_simone, format('SELECT public.salvar_cadastro_paciente(%L::uuid, %L::jsonb)::text', u.pac,
      jsonb_build_object('cns', pg_temp.demo_cns(u.seq))));
    v_r := pg_temp.demo_como(u.medico, format('SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb)::text', v_upa, u.pac,
             u.dados || jsonb_build_object('internacao_id', u.internacao)))::jsonb;
    INSERT INTO demo_reg (cod, id, criada) VALUES (u.cod, (v_r ->> 'id')::uuid,
      now() - CASE u.cod WHEN 'R5' THEN interval '70 minutes' ELSE interval '38 minutes' END);
  END LOOP;

  SELECT id INTO v_id FROM demo_reg WHERE cod = 'R5';
  IF v_id IS NULL THEN
    RAISE NOTICE 'Sem os pacientes da Sala Vermelha do 02: pedidos da UPA não criados (rode o 02 e depois o 04).';
  ELSE
    -- R5: a central autoriza a transferência para a UTI do hospital; aguarda o aceite
    PERFORM pg_temp.demo_como(v_reg, format('SELECT public.regulacao_assumir(%L::uuid)::text', v_id));
    PERFORM pg_temp.demo_como(v_reg, format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid, NULL, %L, NULL, %L)::text', v_id, 'rede', v_hosp,
      'ambulancia_avancada', 'Vaga de UTI pedida ao Hospital Regional; aguardando o aceite.'));
    UPDATE demo_reg SET assumida = now() - interval '62 minutes', autorizada = now() - interval '50 minutes' WHERE cod = 'R5';
  END IF;
  SELECT id INTO v_id FROM demo_reg WHERE cod = 'R6';
  IF v_id IS NOT NULL THEN
    -- R6: na fila, com a prioridade elevada pela reguladora
    PERFORM pg_temp.demo_como(v_reg, format('SELECT public.regulacao_priorizar(%L::uuid, %L, %L)::text', v_id, 'emergencia',
      'Pressão baixa e saturação de 90% na chegada: instabilidade.'));
    UPDATE demo_reg SET priorizada = now() - interval '30 minutes' WHERE cod = 'R6';
  END IF;
END $$;

-- ── 11. ajuste dos horários (como postgres) ─────────────────────────────────
-- as funções gravam tudo em now(); aqui cada consulta, envio e pedido volta
-- para o seu dia e hora. Tabelas clínicas são só de inserção: modo replica,
-- como no 02.
SET LOCAL session_replication_role = replica;
DO $$
DECLARE e record; r record;
BEGIN
  FOR e IN SELECT * FROM demo_ep LOOP
    IF e.tipo = 'presente' THEN
      UPDATE public.episodios SET chegada_em = e.quando, created_at = e.quando, updated_at = e.quando WHERE id = e.ep;
      UPDATE public.agendamentos SET situacao_em = e.quando WHERE episodio_id = e.ep;
      CONTINUE;
    END IF;
    UPDATE public.episodios
       SET chegada_em              = e.quando - interval '20 minutes',
           created_at              = e.quando - interval '20 minutes',
           classificado_em         = CASE WHEN classificado_em IS NOT NULL THEN e.quando - interval '12 minutes' END,
           atendimento_iniciado_em = CASE WHEN atendimento_iniciado_em IS NOT NULL THEN e.quando END,
           desfecho_em             = CASE WHEN desfecho_em IS NOT NULL THEN e.quando + interval '18 minutes' END,
           encerrado_em            = CASE WHEN encerrado_em IS NOT NULL THEN e.quando + interval '18 minutes' END,
           updated_at              = e.quando + interval '18 minutes'
     WHERE id = e.ep;
    UPDATE public.classificacoes_risco SET criado_em = e.quando - interval '12 minutes' WHERE episodio_id = e.ep;
    UPDATE public.observacao SET aferido_em = e.quando - interval '10 minutes', created_at = e.quando - interval '10 minutes' WHERE episodio_id = e.ep;
    UPDATE public.atendimento_registros SET criado_em = e.quando + interval '8 minutes' WHERE episodio_id = e.ep;
    UPDATE public.exames_pedidos SET pedido_em = e.quando + interval '10 minutes' WHERE episodio_id = e.ep;
    UPDATE public.avaliacoes_pes SET registrado_em = e.quando + interval '6 minutes' WHERE episodio_id = e.ep;
    UPDATE public.programa_participantes SET entrada_em = e.quando + interval '18 minutes' WHERE episodio_id = e.ep;
    UPDATE public.pre_natal_gestacoes
       SET entrada_em = e.quando + interval '18 minutes',
           dum_em = CASE WHEN dum_em IS NOT NULL THEN e.quando + interval '18 minutes' END
     WHERE episodio_id = e.ep;
    UPDATE public.encaminhamentos_upa
       SET enviado_em   = e.quando + interval '12 minutes',
           prazo_em     = e.quando + interval '12 minutes' + interval '12 hours',
           cancelado_em = CASE WHEN cancelado_em IS NOT NULL THEN e.quando + interval '16 minutes' END
     WHERE episodio_origem_id = e.ep;
    UPDATE public.agendamentos SET situacao_em = e.quando + interval '18 minutes' WHERE episodio_id = e.ep;
  END LOOP;

  FOR r IN SELECT * FROM demo_reg WHERE id IS NOT NULL LOOP
    UPDATE public.regulacao_solicitacoes
       SET criada_em               = r.criada,
           assumida_em             = CASE WHEN assumida_em IS NOT NULL THEN coalesce(r.assumida, r.autorizada, assumida_em) END,
           prioridade_regulador_em = CASE WHEN prioridade_regulador_em IS NOT NULL THEN coalesce(r.priorizada, prioridade_regulador_em) END,
           autorizada_em           = CASE WHEN autorizada_em IS NOT NULL THEN coalesce(r.autorizada, autorizada_em) END,
           destino_enviado_em      = CASE WHEN destino_enviado_em IS NOT NULL THEN coalesce(r.autorizada, destino_enviado_em) END,
           destino_respondido_em   = CASE WHEN destino_respondido_em IS NOT NULL THEN coalesce(r.aceita, destino_respondido_em) END,
           chegada_em              = CASE WHEN chegada_em IS NOT NULL THEN coalesce(r.chegada, chegada_em) END,
           realizada_em            = CASE WHEN realizada_em IS NOT NULL THEN coalesce(r.chegada, realizada_em) END
     WHERE id = r.id;
    UPDATE public.regulacao_eventos
       SET em = coalesce(CASE evento WHEN 'enviada' THEN r.criada WHEN 'assumida' THEN r.assumida WHEN 'prioridade_regulador' THEN r.priorizada
                                     WHEN 'autorizada' THEN r.autorizada WHEN 'destino_aceitou' THEN r.aceita WHEN 'chegou' THEN r.chegada END, em)
     WHERE solicitacao_id = r.id;
    UPDATE public.regulacao_destino_respostas SET em = coalesce(r.aceita, em) WHERE solicitacao_id = r.id;
    UPDATE public.regulacao_status_tempos
       SET inicio = coalesce(CASE status WHEN 'enviada' THEN r.criada WHEN 'em_analise' THEN r.assumida WHEN 'aguardando_destino' THEN r.autorizada
                                         WHEN 'autorizada' THEN r.aceita WHEN 'realizada' THEN r.chegada END, inicio)
     WHERE solicitacao_id = r.id;
    UPDATE public.regulacao_status_tempos t
       SET fim = (SELECT min(t2.inicio) FROM public.regulacao_status_tempos t2 WHERE t2.solicitacao_id = t.solicitacao_id AND t2.inicio > t.inicio)
     WHERE t.solicitacao_id = r.id AND t.fim IS NOT NULL;
  END LOOP;
END $$;
SET LOCAL session_replication_role = origin;

-- o envio de 2 dias atrás passou do prazo de 12 h: o job do prazo marca "não chegou"
SELECT private.encaminhamentos_upa_prazo();

COMMIT;

-- ── conferência: o que cada tela vai mostrar ────────────────────────────────
SELECT 'UBS e regulação prontas' AS situacao,
       (SELECT count(*) FROM public.pacientes WHERE unidade_id = 'd0100000-0000-4000-8000-000000000002') AS pacientes_ubs,
       (SELECT string_agg(situacao || ' ' || n, ', ' ORDER BY situacao) FROM (
          SELECT situacao, count(*) AS n FROM public.agendamentos
           WHERE unidade_id = 'd0100000-0000-4000-8000-000000000002'
             AND (inicio AT TIME ZONE 'America/Sao_Paulo')::date = private.data_atual() GROUP BY 1) a) AS agenda_hoje,
       (SELECT count(*) FROM public.agendamentos WHERE unidade_id = 'd0100000-0000-4000-8000-000000000002'
           AND (inicio AT TIME ZONE 'America/Sao_Paulo')::date > private.data_atual() AND situacao = 'agendado') AS agenda_proximos_dias,
       (SELECT count(DISTINCT paciente_id) FROM public.programa_participantes
         WHERE unidade_id = 'd0100000-0000-4000-8000-000000000002' AND saida_em IS NULL) AS hiperdia,
       (SELECT count(*) FROM public.programa_participantes
         WHERE unidade_id = 'd0100000-0000-4000-8000-000000000002' AND saida_em IS NULL AND programa = 'hipertensao') AS hipertensao,
       (SELECT count(*) FROM public.programa_participantes
         WHERE unidade_id = 'd0100000-0000-4000-8000-000000000002' AND saida_em IS NULL AND programa = 'diabetes') AS diabetes,
       (SELECT count(*) FROM public.pre_natal_gestacoes x WHERE x.unidade_id = 'd0100000-0000-4000-8000-000000000002'
           AND private.pre_natal_ativa(x.saida_em, x.desfecho, x.dum, x.desfecho_em)) AS pre_natal,
       (SELECT count(*) FROM public.pacientes pa WHERE pa.unidade_id = 'd0100000-0000-4000-8000-000000000002' AND pa.ativo
           AND private.puericultura_crianca(pa.data_nascimento)) AS puericultura,
       (SELECT string_agg(situacao || ' ' || n, ', ' ORDER BY situacao) FROM (
          SELECT situacao, count(*) AS n FROM public.encaminhamentos_upa
           WHERE unidade_origem_id = 'd0100000-0000-4000-8000-000000000002' GROUP BY 1) x) AS envios_upa,
       (SELECT string_agg(u.nome || ': ' || s.status, '; ' ORDER BY s.numero)
          FROM public.regulacao_solicitacoes s JOIN public.unidades u ON u.id = s.unidade_origem_id
         WHERE s.organizacao_id = 'd0000000-0000-4000-8000-000000000001') AS regulacao;
