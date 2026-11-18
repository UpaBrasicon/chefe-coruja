-- Testes da migration 20270418000092 (LG8: telemedicina). ROLLBACK no fim.
-- Preparo copiado de fase7_teleinterconsulta.sql: plantonista (…0002) e teleconsultor (…0006)
-- escalados agora na Clínica Médica; paciente …0098 internado lá.
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'tele-lg8@teste.local', '', now(), '{}', '{"nome_completo":"Teleconsultor de Teste"}', now(), now())
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
-- em cuidado = internação aberta no setor (20270306000001), não só o setor do cadastro
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, setor_atual_id, status)
VALUES ((SELECT organizacao_id FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001'), '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000098', '22000000-0000-4000-8000-000000000001', 'internado');
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
-- endereço do paciente e do teleconsultor; o teleconsultor só com o registro novo
UPDATE public.pacientes SET endereco = 'Rua das Flores', numero_endereco = '10', bairro = 'Centro', municipio = 'Campinas', uf = 'SP'
 WHERE id = '23000000-0000-4000-8000-000000000098';
UPDATE public.perfis SET crm = NULL, uf_crm = NULL, conselho = 'CRM', registro_numero = '77777', registro_uf = 'RJ'
 WHERE id = '10000000-0000-4000-8000-000000000006';

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.definir_meu_endereco_profissional('Av. Telemedicina, 500 — Rio de Janeiro/RJ');
DO $$ BEGIN
  BEGIN
    PERFORM public.definir_endereco_unidade('21000000-0000-4000-8000-000000000001', 'Rua da UPA, 1');
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  só o gestor define o endereço da unidade'; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: teleconsultor definiu o endereço da unidade';
END $$;

-- 1. regras do termo
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.negado($$SELECT public.solicitar_teleinterconsulta_com_termo('23000000-0000-4000-8000-000000000098', 'Dúvida sobre antibiótico', 'obtido', 'verbal_testemunha')$$,
  'verbal sem testemunha');
SELECT pg_temp.negado($$SELECT public.solicitar_teleinterconsulta_com_termo('23000000-0000-4000-8000-000000000098', 'Dúvida sobre antibiótico', 'emergencia_sem_condicao', 'emergencia', NULL, NULL, 'curta')$$,
  'emergência sem justificativa');
SELECT pg_temp.negado($$SELECT public.solicitar_teleinterconsulta_com_termo('23000000-0000-4000-8000-000000000098', 'Dúvida sobre antibiótico', 'obtido', 'emergencia', NULL, NULL, 'paciente inconsciente na chegada')$$,
  'forma emergência com consentimento obtido');
SELECT pg_temp.negado($$SELECT public.solicitar_teleinterconsulta_com_termo('23000000-0000-4000-8000-000000000098', 'Dúvida sobre antibiótico', 'representante_legal', 'assinatura_papel')$$,
  'representante sem nome e vínculo');

-- 2. solicitar com termo verbal: o termo vira documento ligado à solicitação
DO $$
DECLARE v uuid; t public.teleinterconsultas; termo text; sol text;
BEGIN
  v := public.solicitar_teleinterconsulta_com_termo('23000000-0000-4000-8000-000000000098',
         'Febre persistente no 3º dia de ceftriaxona: escalono o antibiótico?', 'obtido', 'verbal_testemunha', 'Enf. Maria da Silva');
  SELECT * INTO t FROM public.teleinterconsultas WHERE id = v;
  IF t.consentimento_forma <> 'verbal_testemunha' OR t.testemunha <> 'Enf. Maria da Silva' OR t.termo_documento_id IS NULL THEN
    RAISE EXCEPTION 'FALHOU: solicitação sem o termo ligado';
  END IF;
  SELECT conteudo INTO termo FROM public.documentos_clinicos WHERE id = t.termo_documento_id AND tipo_documento = 'termo_consentimento';
  IF termo NOT LIKE 'TERMO DE CONSENTIMENTO PARA TELEMEDICINA%' OR termo NOT LIKE '%Você pode recusar%' OR termo NOT LIKE '%testemunha Enf. Maria da Silva%' THEN
    RAISE EXCEPTION 'FALHOU: texto do termo';
  END IF;
  SELECT conteudo INTO sol FROM public.documentos_clinicos WHERE id = t.documento_solicitacao_id;
  IF sol NOT LIKE '%Endereço do paciente: Rua das Flores, 10, Centro, Campinas/SP%' OR sol NOT LIKE '%Endereço profissional do solicitante:%' THEN
    RAISE EXCEPTION 'FALHOU: endereços na solicitação: %', sol;
  END IF;
  PERFORM set_config('teste.tele', v::text, true);
  RAISE NOTICE 'OK  termo verbal com testemunha ligado à solicitação; endereços na solicitação';
END $$;

-- 3. parecer com o registro novo, o endereço do teleconsultor e o número do termo
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
DO $$
DECLARE doc uuid; c text;
BEGIN
  PERFORM public.aceitar_teleinterconsulta(current_setting('teste.tele')::uuid);
  doc := public.responder_teleinterconsulta(current_setting('teste.tele')::uuid,
           'Sem foco novo e hemodinâmica estável: manter por 48 h e colher culturas antes de escalonar.');
  SELECT conteudo INTO c FROM public.documentos_clinicos WHERE id = doc;
  IF c NOT LIKE '%Teleconsultor: Teleconsultor de Teste — CRM 77777/RJ%' THEN RAISE EXCEPTION 'FALHOU: CRM pelo registro novo: %', c; END IF;
  IF c NOT LIKE '%Endereço profissional do teleconsultor: Av. Telemedicina, 500%' THEN RAISE EXCEPTION 'FALHOU: endereço do teleconsultor'; END IF;
  IF c NOT LIKE '%termo nº%' THEN RAISE EXCEPTION 'FALHOU: número do termo no parecer'; END IF;
  RAISE NOTICE 'OK  parecer com o registro novo, o endereço profissional e o termo';
END $$;

-- 4. emergência: sem termo, com a justificativa
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE v uuid; t public.teleinterconsultas;
BEGIN
  v := public.solicitar_teleinterconsulta_com_termo('23000000-0000-4000-8000-000000000098',
         'Rebaixamento súbito: conduta imediata?', 'emergencia_sem_condicao', 'emergencia', NULL, NULL, 'Paciente inconsciente e sem acompanhante na chegada');
  SELECT * INTO t FROM public.teleinterconsultas WHERE id = v;
  IF t.termo_documento_id IS NOT NULL OR t.justificativa_emergencia IS NULL THEN RAISE EXCEPTION 'FALHOU: emergência'; END IF;
  RAISE NOTICE 'OK  emergência sem termo, com justificativa';
END $$;
RESET ROLE;
ROLLBACK;
