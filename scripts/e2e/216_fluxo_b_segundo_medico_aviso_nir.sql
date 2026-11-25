-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B, B-06 (RT, 25/11/2026): segundo médico de teste na UPA
-- Homologação, para provar com gravação o aviso do NIR ao médico.
-- Conta usada: medico.internacao.f5@teste.local ("Médica da Internação F5",
-- conta de teste da rede F5, sem pessoa real e sem senha tocada). Ganha vínculo
-- de médico (plantonista) na UPA Homologação, escala de 25/11 na Clínica Médica
-- (manhã, tarde e noite) e presença. Os vínculos do teste.homolog NÃO são tocados:
-- o NIR age com o login como está, e a médica com a conta dela.
-- Grava de verdade (COMMIT). Reexecutável: o que já existe não se repete.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
DO $t$ BEGIN
  IF NOT coalesce((SELECT c.valor FROM public.configuracao_plataforma c WHERE c.chave = 'ambiente_teste'), false) THEN
    RAISE EXCEPTION 'Este banco não é de teste.'; END IF;
END $t$;
CREATE TEMP TABLE _r (o serial, txt text) ON COMMIT DROP;
CREATE TEMP TABLE _c ON COMMIT DROP AS
SELECT 'f5200000-0000-4000-8000-000000000015'::uuid AS medica, '757db1d9-589d-461c-bed6-24adfed1fa29'::uuid AS login,
       '31000000-0000-4000-8000-000000000001'::uuid AS upa, '32000000-0000-4000-8000-000000000003'::uuid AS cm,
       e2e.fbu(9, 'reg') AS reg, e2e.fbv(9, 'num') AS num;
GRANT SELECT ON _c TO authenticated;

-- preparo: vínculo, escala e presença da médica de teste
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo, criado_por)
SELECT c.medica, c.upa, 'plantonista', true, c.login FROM _c c
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = c.medica AND v.unidade_id = c.upa AND v.papel = 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel, observacao, criado_por)
SELECT c.upa, c.cm, c.medica, DATE '2026-11-25', t, 'plantonista', 'Teste de fluxo B-06: segundo médico de teste', c.login
  FROM _c c, unnest(ARRAY['manha', 'tarde', 'noite']) t
ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkin_dentro, observacao, criado_por)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio, true, 'Check-in de teste (fluxo B-06)', (SELECT login FROM _c)
  FROM public.escala_plantao e, _c c WHERE e.perfil_id = c.medica AND e.unidade_id = c.upa AND e.data = DATE '2026-11-25'
ON CONFLICT (perfil_id, unidade_id, data, turno) DO NOTHING;
INSERT INTO _r (txt)
SELECT 'ok — preparo: ' || (SELECT email FROM auth.users u WHERE u.id = c.medica) || ' com vínculo plantonista na UPA Homologação, '
       || (SELECT count(*) FROM public.escala_plantao e WHERE e.perfil_id = c.medica AND e.unidade_id = c.upa AND e.data = DATE '2026-11-25') || ' plantões na Clínica Médica e '
       || (SELECT count(*) FROM public.presenca_plantonista p WHERE p.perfil_id = c.medica AND p.unidade_id = c.upa AND p.data = DATE '2026-11-25') || ' presenças; vínculos ativos do teste.homolog: '
       || (SELECT count(*) FILTER (WHERE ativo) || ' de ' || count(*) FROM public.vinculos v WHERE v.perfil_id = c.login) FROM _c c;

-- 1. o NIR (login teste.homolog, como está) avisa o médico do setor do B09 (CM-8, pedido nº 414 com pergunta da central)
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT login FROM _c), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE _p ON COMMIT DROP AS
SELECT public.regulacao_pendencia_unidade_criar((SELECT reg FROM _c), 'evolucao', 'A central pede a evolução do quadro e a gasometria de controle', 'alta', NULL, 'medico') AS id;
RESET ROLE;
INSERT INTO _r (txt)
SELECT CASE WHEN p.status = 'medico_avisado' AND p.criada_por = c.login AND p.responsaveis = ARRAY[c.medica] AND p.avisos = 1 THEN 'ok' ELSE 'falha' END
       || ' — NIR avisa o médico: pendência ' || p.status || ', responsável = a médica de teste (' || cardinality(p.responsaveis) || '), criada pelo login do NIR'
  FROM public.regulacao_pendencias_unidade p, _c c WHERE p.id = (SELECT id FROM _p);
INSERT INTO _r (txt)
SELECT CASE WHEN count(*) = 1 AND NOT bool_or(n.mensagem ILIKE '%Teste Fluxo%') AND bool_and(n.data = private.data_atual()) THEN 'ok' ELSE 'falha' END
       || ' — aviso na caixa da médica: ' || coalesce(min(n.tipo || ' (data ' || n.data || '): ' || n.mensagem), 'nenhum')
  FROM public.notificacoes_plantonista n, _c c WHERE n.perfil_id = c.medica AND n.unidade_id = c.upa AND n.tipo = 'reg_nirmed_' || c.num;
INSERT INTO _r (txt)
SELECT CASE WHEN count(*) = 0 THEN 'ok' ELSE 'falha' END || ' — o login do NIR não avisou a si mesmo (' || count(*) || ' avisos reg_nirmed para ele)'
  FROM public.notificacoes_plantonista n, _c c WHERE n.perfil_id = c.login AND n.tipo = 'reg_nirmed_' || c.num;

-- 2. a médica de teste (conta dela) vê a pendência e o pedido
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT medica FROM _c), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE _v ON COMMIT DROP AS
SELECT (SELECT count(*) FROM jsonb_array_elements(public.regulacao_pendencias_da_unidade((SELECT upa FROM _c))) x WHERE x ->> 'status' = 'medico_avisado' AND (x ->> 'numero') = (SELECT num FROM _c)) AS pendencias,
       public.regulacao_por_que_nao_ajo((SELECT upa FROM _c), e2e.fbu(9, 'pac')) AS motivo,
       (public.regulacao_detalhe((SELECT reg FROM _c)) ->> 'status') AS status;
-- 3. B-05: ela não pediu a vaga, mas está de plantão no setor do paciente: atualiza a evolução e responde à central
CREATE TEMP TABLE _e ON COMMIT DROP AS
SELECT public.regulacao_atualizar_evolucao((SELECT reg FROM _c), 'Médica do plantão: mantém SatO2 90% com cateter, gasometria colhida, sem piora (teste de fluxo B-06).', 'FC 104, PA 136x82, FR 26, SatO2 90% com cateter 2 L/min') AS id;
SELECT public.regulacao_responder_pendencia((SELECT reg FROM _c), 'Evolução atualizada no pedido; gasometria colhida e RX de controle pedido (teste de fluxo B-06).');
RESET ROLE;
INSERT INTO _r (txt)
SELECT CASE WHEN v.pendencias = 1 AND v.motivo IS NULL AND v.status = 'pendencia' THEN 'ok' ELSE 'falha' END
       || ' — a médica vê a pendência "médico avisado" (' || v.pendencias || '), pode agir (' || coalesce(v.motivo, 'de plantão no setor') || ') e abre o pedido (' || v.status || ')' FROM _v v;
INSERT INTO _r (txt)
SELECT CASE WHEN ev.autor_id = c.medica AND ev.autor_papel = 'medico' THEN 'ok' ELSE 'falha' END || ' — evolução gravada com autor = a médica de teste, papel ' || ev.autor_papel
  FROM public.regulacao_evolucoes ev, _c c WHERE ev.id = (SELECT id FROM _e);
INSERT INTO _r (txt)
SELECT CASE WHEN p.status = 'resolvida' AND p.resolvida_por = c.medica THEN 'ok' ELSE 'falha' END || ' — a pendência do NIR fechou sozinha com a evolução: ' || p.status || ', resolvida pela médica'
  FROM public.regulacao_pendencias_unidade p, _c c WHERE p.id = (SELECT id FROM _p);
INSERT INTO _r (txt)
SELECT CASE WHEN s.status = 'em_analise' AND s.pendencia_respondida_por = c.medica THEN 'ok' ELSE 'falha' END || ' — pergunta da central respondida pela médica: pedido nº ' || s.numero || ' em ' || s.status
  FROM public.regulacao_solicitacoes s, _c c WHERE s.id = c.reg;
-- 4. fica uma pendência "médico avisado" aberta para a tela do NIR (motivo exame não fecha com a evolução)
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT login FROM _c), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE _p2 ON COMMIT DROP AS
SELECT public.regulacao_pendencia_unidade_criar((SELECT reg FROM _c), 'exame', 'Anexar ao pedido a gasometria e o RX de controle que a central pediu', 'normal', NULL, 'medico') AS id;
RESET ROLE;
INSERT INTO _r (txt)
SELECT CASE WHEN p.status = 'medico_avisado' AND p.responsaveis = ARRAY[c.medica] THEN 'ok' ELSE 'falha' END || ' — segunda pendência (exame) fica aberta como "' || p.status || '" para a tela do NIR'
  FROM public.regulacao_pendencias_unidade p, _c c WHERE p.id = (SELECT id FROM _p2);
INSERT INTO _r (txt)
SELECT CASE WHEN count(*) = 23 AND count(*) FILTER (WHERE NOT ativo) = 0 THEN 'ok' ELSE 'falha' END || ' — vínculos do teste.homolog intactos: ' || count(*) FILTER (WHERE ativo) || ' de ' || count(*) || ' ativos'
  FROM public.vinculos v, _c c WHERE v.perfil_id = c.login;
SELECT txt FROM _r ORDER BY o;
--FIM
COMMIT;
