-- Testes da migration 20261001000003_fase7_teleinterconsulta.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase7_teleinterconsulta.sql
--
-- Cria um médico de telemedicina (…0006) escalado AGORA na Clínica Médica,
-- onde está o paciente criado no teste (…0098). A escala dele não abre o setor: ele só lê o
-- paciente da teleinterconsulta que aceitou, e só escreve o parecer.
-- O plantonista (…0002) está escalado agora na Clínica Médica e solicita.
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'tele-teste@teste.local', '', now(), '{}', '{"nome_completo":"Teleconsultor de Teste"}', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm)
VALUES ('10000000-0000-4000-8000-000000000006', 'Teleconsultor de Teste', '99999', 'SP')
ON CONFLICT (id) DO UPDATE SET crm = '99999', uf_crm = 'SP';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo)
SELECT '10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'telemedicina', true
WHERE NOT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = '10000000-0000-4000-8000-000000000006');

-- paciente criado aqui, na Clínica Médica, com um sinal vital: nenhuma
-- teleinterconsulta ou abertura antiga dele no banco local
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id)
VALUES ('23000000-0000-4000-8000-000000000098', '21000000-0000-4000-8000-000000000001', 'Paciente do Teste de Tele',
        '1960-02-02', 'T-098', '22000000-0000-4000-8000-000000000001');
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000098', c.id, now(), 38.2, 'manual'
FROM public.conceito c WHERE c.nome = 'temperatura' AND c.unidade_id IS NULL LIMIT 1;

DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual(), private.turno_atual(), now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006',
   private.data_atual(), private.turno_atual(), now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.negado(sql text, rotulo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN raise_exception THEN
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: %', rotulo;
END $$;

SET LOCAL ROLE authenticated;

-- ── 1. telemedicina: escala não abre o setor; check-in sem cerca ────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'FALHOU: escala da telemedicina abriu o paciente do setor';
  END IF;
  IF private.pode_atuar_no_paciente('23000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'FALHOU: telemedicina pode atuar no paciente pela escala';
  END IF;
  -- sem coordenadas e sem justificativa: passa (é remoto)
  PERFORM public.registrar_checkin('21000000-0000-4000-8000-000000000001');
  RAISE NOTICE 'OK  telemedicina: escala sem acesso ao setor; check-in remoto sem cerca';
END $$;
SELECT pg_temp.negado($$SELECT public.solicitar_teleinterconsulta('23000000-0000-4000-8000-000000000098', 'Pergunta de quem não está com o paciente', 'obtido')$$,
  'telemedicina solicitou teleinterconsulta');
SELECT pg_temp.negado($$SELECT public.emitir_documento('23000000-0000-4000-8000-000000000098', 'evolucao', 'evolução escrita pela telemedicina')$$,
  'telemedicina emitiu evolução');

-- ── 2. plantonista solicita; consentimento obrigatório ──────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.negado($$SELECT public.solicitar_teleinterconsulta('23000000-0000-4000-8000-000000000098', 'Dúvida sobre o antibiótico', 'nao_sei')$$,
  'solicitação sem consentimento válido');
DO $$
DECLARE v uuid;
BEGIN
  v := public.solicitar_teleinterconsulta('23000000-0000-4000-8000-000000000098',
         'Febre persistente no 3º dia de ceftriaxona: escalono o antibiótico?', 'obtido', 'urgente');
  PERFORM set_config('teste.tele', v::text, true);
  RAISE NOTICE 'OK  plantonista solicita com consentimento';
END $$;
SELECT pg_temp.negado(format('SELECT public.aceitar_teleinterconsulta(%L)', current_setting('teste.tele')), 'plantonista aceitou a própria');

-- ── 3. telemedicina vê a fila, aceita, lê, responde ─────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
DO $$
DECLARE doc uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teleinterconsultas_da_unidade('21000000-0000-4000-8000-000000000001')
                 WHERE id = current_setting('teste.tele')::uuid AND status = 'aberta') THEN
    RAISE EXCEPTION 'FALHOU: telemedicina de plantão não vê a teleinterconsulta aberta';
  END IF;
  BEGIN
    PERFORM public.responder_teleinterconsulta(current_setting('teste.tele')::uuid, 'Parecer antes de aceitar a interconsulta');
    RAISE EXCEPTION 'FALHOU: respondeu sem aceitar';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  PERFORM public.aceitar_teleinterconsulta(current_setting('teste.tele')::uuid);
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'FALHOU: teleconsultor não lê o paciente depois de aceitar';
  END IF;
  PERFORM public.abrir_prontuario('23000000-0000-4000-8000-000000000098');
  IF NOT EXISTS (SELECT 1 FROM public.observacao WHERE paciente_id = '23000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'FALHOU: teleconsultor não lê os sinais vitais depois de abrir';
  END IF;
  IF private.pode_atuar_no_paciente('23000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'FALHOU: aceitar deu escrita geral ao teleconsultor';
  END IF;
  doc := public.responder_teleinterconsulta(current_setting('teste.tele')::uuid,
           'Sem foco novo e hemodinâmica estável: manter por 48 h e colher culturas antes de escalonar.');
  RAISE NOTICE 'OK  telemedicina vê, aceita, lê após abrir e responde';
END $$;
SELECT pg_temp.negado(format('SELECT public.responder_teleinterconsulta(%L, %L)', current_setting('teste.tele'), 'Segundo parecer na mesma teleinterconsulta'),
  'respondeu duas vezes');

-- ── 4. registro nos dois lados, no mesmo prontuário ─────────────────────────
RESET ROLE;
DO $$
DECLARE ds record; dr record;
BEGIN
  SELECT dc.* INTO ds FROM public.documentos_clinicos dc
    JOIN public.teleinterconsultas t ON t.documento_solicitacao_id = dc.id WHERE t.id = current_setting('teste.tele')::uuid;
  SELECT dc.* INTO dr FROM public.documentos_clinicos dc
    JOIN public.teleinterconsultas t ON t.documento_resposta_id = dc.id WHERE t.id = current_setting('teste.tele')::uuid;
  IF ds.id IS NULL OR ds.tipo_documento <> 'teleinterconsulta' OR ds.numero IS NULL
     OR ds.autor_id <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: solicitação sem documento numerado do solicitante';
  END IF;
  IF ds.conteudo NOT LIKE '%Res. CFM 2.314/2022%' OR ds.conteudo NOT LIKE '%consentimento do paciente obtido%'
     OR ds.conteudo NOT LIKE '%Local do paciente: %' THEN
    RAISE EXCEPTION 'FALHOU: solicitação sem telemedicina, consentimento ou local';
  END IF;
  IF dr.autor_id <> '10000000-0000-4000-8000-000000000006' OR dr.numero IS NULL OR dr.conteudo NOT LIKE '%CRM 99999/SP%'
     OR dr.conteudo NOT LIKE '%médico assistente presencial%' OR dr.conteudo NOT LIKE '%' || ds.numero || '%' THEN
    RAISE EXCEPTION 'FALHOU: parecer sem documento numerado do teleconsultor com CRM e referência à solicitação';
  END IF;
  IF (SELECT count(DISTINCT autor_id) FROM public.documentos_clinicos
       WHERE paciente_id = '23000000-0000-4000-8000-000000000098' AND tipo_documento = 'teleinterconsulta') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: sem os dois registros (solicitante e teleconsultor)';
  END IF;
  IF (SELECT count(*) FROM public.log_auditoria WHERE entidade = 'teleinterconsultas'
        AND entidade_id = current_setting('teste.tele')::uuid) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: trilha sem solicitar, aceitar e responder';
  END IF;
  RAISE NOTICE 'OK  dois documentos (dois autores) e trilha com as três ações';
END $$;

-- ── 5. passadas 24 h da resposta, a leitura do teleconsultor fecha ──────────
UPDATE public.teleinterconsultas SET respondida_em = now() - interval '25 hours' WHERE id = current_setting('teste.tele')::uuid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'FALHOU: leitura do teleconsultor não fechou 24 h depois da resposta';
  END IF;
  RAISE NOTICE 'OK  leitura do teleconsultor fecha 24 h depois da resposta';
END $$;

-- ── 6. plantonista continua vendo o setor (a mudança não o afetou) ──────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'FALHOU: plantonista perdeu o paciente do setor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teleinterconsultas_da_unidade('21000000-0000-4000-8000-000000000001')
                 WHERE id = current_setting('teste.tele')::uuid AND status = 'respondida' AND resposta IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHOU: plantonista não vê a resposta';
  END IF;
  RAISE NOTICE 'OK  plantonista segue com o setor e vê a resposta';
END $$;

ROLLBACK;
