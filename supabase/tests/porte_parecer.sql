-- Testes da migration 20261004000002_parecer_medico.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_parecer.sql
--
-- O plantonista (…0002) está escalado agora na Clínica Médica, onde está o
-- paciente internado criado no teste (…0097), e pede o parecer. Dois médicos
-- com vínculo de plantonista na unidade e SEM escala agora: a cirurgiã
-- (…0007, declara Cirurgia geral) e o cardiologista (…0008, declara
-- Cardiologia). Só a cirurgiã vê e responde o parecer de Cirurgia geral.
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'cirurgia-teste@teste.local', '', now(), '{}', '{"nome_completo":"Cirurgiã de Teste"}', now(), now()),
       ('10000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'cardio-teste@teste.local', '', now(), '{}', '{"nome_completo":"Cardiologista de Teste"}', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm) VALUES
  ('10000000-0000-4000-8000-000000000007', 'Cirurgiã de Teste', '77777', 'SP'),
  ('10000000-0000-4000-8000-000000000008', 'Cardiologista de Teste', '88888', 'SP')
ON CONFLICT (id) DO UPDATE SET crm = EXCLUDED.crm, uf_crm = EXCLUDED.uf_crm, nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo)
SELECT p, '21000000-0000-4000-8000-000000000001', 'plantonista', true
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000008']::uuid[]) p
WHERE NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p AND v.unidade_id = '21000000-0000-4000-8000-000000000001');

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id)
VALUES ('23000000-0000-4000-8000-000000000097', '21000000-0000-4000-8000-000000000001', 'Paciente do Teste de Parecer',
        '1958-03-03', 'T-097', '22000000-0000-4000-8000-000000000001');
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao)
SELECT '24000000-0000-4000-8000-000000000097', u.organizacao_id, u.id, '23000000-0000-4000-8000-000000000097',
       'internado', '22000000-0000-4000-8000-000000000001', now() - interval '1 day'
FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';

DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000008');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual(), private.turno_atual(), now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.negado(sql text, rotulo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN raise_exception OR check_violation THEN
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: %', rotulo;
END $$;

SET LOCAL ROLE authenticated;

-- ── 1. especialistas declaram a especialidade ───────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000007');
SELECT pg_temp.negado($$SELECT public.definir_minhas_especialidades(ARRAY['Astrologia'])$$, 'declarou especialidade fora da lista');
SELECT public.definir_minhas_especialidades(ARRAY['Cirurgia geral', 'Cirurgia geral']);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000008');
SELECT public.definir_minhas_especialidades(ARRAY['Cardiologia']);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.especialidades_perfil) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: especialista vê especialidades de outro';
  END IF;
  RAISE NOTICE 'OK  especialistas declaram (lista fechada; cada um vê a sua)';
END $$;

-- ── 2. plantonista pede o parecer ───────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000007');
SELECT pg_temp.negado($$SELECT public.solicitar_parecer('23000000-0000-4000-8000-000000000097', 'Cirurgia geral', 'Quem não está com o paciente pede parecer')$$,
  'especialista fora do plantão pediu parecer');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.negado($$SELECT public.solicitar_parecer('23000000-0000-4000-8000-000000000097', 'Cirurgia geral', 'Curta demais')$$,
  'pergunta com menos de 15 letras');
SELECT pg_temp.negado($$SELECT public.solicitar_parecer('23000000-0000-4000-8000-000000000097', 'Astrologia', 'Especialidade que não existe na lista')$$,
  'especialidade fora da lista');
DO $$
DECLARE v uuid;
BEGIN
  v := public.solicitar_parecer('23000000-0000-4000-8000-000000000097', 'Cirurgia geral',
         'Dor em fossa ilíaca direita há 24 h com leucocitose: abdome cirúrgico?', 'urgencia');
  PERFORM set_config('teste.par', v::text, true);
  IF (SELECT internacao_id FROM public.pareceres_medicos WHERE id = v) IS DISTINCT FROM '24000000-0000-4000-8000-000000000097' THEN
    RAISE EXCEPTION 'FALHOU: parecer não ficou ligado à internação ativa';
  END IF;
  IF (SELECT impeditivos_alta FROM public.impeditivos_alta('24000000-0000-4000-8000-000000000097')) @> '[{"tipo":"parecer"}]'::jsonb IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: parecer solicitado não impede a alta';
  END IF;
  RAISE NOTICE 'OK  plantonista pede (validações; ligado à internação; impede a alta)';
END $$;
SELECT pg_temp.negado(format('SELECT public.iniciar_analise_parecer(%L)', current_setting('teste.par')), 'solicitante analisou o próprio');

-- ── 3. fila: só quem declarou a especialidade ───────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000008');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pareceres_fila('21000000-0000-4000-8000-000000000001') WHERE id = current_setting('teste.par')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: cardiologista vê parecer de cirurgia';
  END IF;
  RAISE NOTICE 'OK  outra especialidade não vê o pedido';
END $$;
SELECT pg_temp.negado(format('SELECT public.iniciar_analise_parecer(%L)', current_setting('teste.par')), 'outra especialidade iniciou análise');

SELECT pg_temp.como('10000000-0000-4000-8000-000000000007');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pareceres_fila('21000000-0000-4000-8000-000000000001')
                  WHERE id = current_setting('teste.par')::uuid AND status = 'solicitado' AND posso_analisar) THEN
    RAISE EXCEPTION 'FALHOU: cirurgiã não vê o pedido na fila';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000097') THEN
    RAISE EXCEPTION 'FALHOU: a fila abriu o paciente antes da análise';
  END IF;
  BEGIN
    PERFORM public.parecer_dados_paciente(current_setting('teste.par')::uuid);
    RAISE EXCEPTION 'FALHOU: resumo do paciente antes de iniciar a análise';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.concluir_parecer(current_setting('teste.par')::uuid, 'Resposta antes de iniciar a análise');
    RAISE EXCEPTION 'FALHOU: concluiu sem iniciar';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  especialista vê o pedido; sem dados do paciente antes de iniciar';
END $$;

-- ── 4. inicia, lê, salva rascunho, cancela análise, reinicia, conclui ───────
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM public.iniciar_analise_parecer(current_setting('teste.par')::uuid);
  j := public.parecer_dados_paciente(current_setting('teste.par')::uuid);
  IF j -> 'paciente' ->> 'nome' <> 'Paciente do Teste de Parecer'
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j -> 'documentos') d WHERE d ->> 'tipo' = 'parecer') THEN
    RAISE EXCEPTION 'FALHOU: resumo do paciente sem identificação ou sem a solicitação';
  END IF;
  PERFORM public.salvar_rascunho_parecer(current_setting('teste.par')::uuid, 'Rascunho: examinar o abdome');
  IF (SELECT rascunho FROM public.pareceres_fila('21000000-0000-4000-8000-000000000001') WHERE id = current_setting('teste.par')::uuid)
     IS DISTINCT FROM 'Rascunho: examinar o abdome' THEN
    RAISE EXCEPTION 'FALHOU: rascunho não voltou para quem analisa';
  END IF;
  RAISE NOTICE 'OK  inicia análise, lê o resumo (log gravado) e salva rascunho';
END $$;

-- outro já analisa: o solicitante vê quem; um segundo especialista não toma
SELECT pg_temp.como('10000000-0000-4000-8000-000000000008');
SELECT public.definir_minhas_especialidades(ARRAY['Cardiologia', 'Cirurgia geral']);
DO $$ BEGIN
  BEGIN
    PERFORM public.iniciar_analise_parecer(current_setting('teste.par')::uuid);
    RAISE EXCEPTION 'FALHOU: segundo especialista tomou a análise';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%Cirurgiã de Teste já está analisando%' THEN RAISE; END IF;
  END;
  IF (SELECT rascunho FROM public.pareceres_fila('21000000-0000-4000-8000-000000000001') WHERE id = current_setting('teste.par')::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: rascunho de outro vazou na fila';
  END IF;
  RAISE NOTICE 'OK  "outro já analisa" (com o nome); rascunho não vaza';
END $$;

SELECT pg_temp.como('10000000-0000-4000-8000-000000000007');
DO $$
DECLARE doc uuid;
BEGIN
  PERFORM public.cancelar_analise_parecer(current_setting('teste.par')::uuid);
  IF (SELECT status FROM public.pareceres_fila('21000000-0000-4000-8000-000000000001') WHERE id = current_setting('teste.par')::uuid) <> 'solicitado' THEN
    RAISE EXCEPTION 'FALHOU: cancelar análise não voltou para solicitado';
  END IF;
  PERFORM public.iniciar_analise_parecer(current_setting('teste.par')::uuid);
  doc := public.concluir_parecer(current_setting('teste.par')::uuid,
           'Abdome com defesa em FID, Blumberg positivo. Apendicite provável: jejum, TC de abdome e levo ao centro cirúrgico.');
  IF NOT EXISTS (SELECT 1 FROM public.pareceres_fila('21000000-0000-4000-8000-000000000001')
                  WHERE id = current_setting('teste.par')::uuid AND status = 'realizado' AND minha) THEN
    RAISE EXCEPTION 'FALHOU: concluído não aparece como realizado para quem respondeu';
  END IF;
  RAISE NOTICE 'OK  cancela análise (volta à fila), reinicia e conclui';
END $$;
SELECT pg_temp.negado(format('SELECT public.concluir_parecer(%L, %L)', current_setting('teste.par'), 'Segunda resposta ao mesmo parecer'),
  'concluiu duas vezes');
SELECT pg_temp.negado(format('SELECT public.cancelar_parecer(%L, %L)', current_setting('teste.par'), 'Cancelar parecer já respondido'),
  'cancelou parecer respondido');

-- ── 5. registro nos dois lados; alta liberada; trilha ───────────────────────
RESET ROLE;
DO $$
DECLARE ds record; dr record;
BEGIN
  SELECT dc.* INTO ds FROM public.documentos_clinicos dc
    JOIN public.pareceres_medicos p ON p.documento_solicitacao_id = dc.id WHERE p.id = current_setting('teste.par')::uuid;
  SELECT dc.* INTO dr FROM public.documentos_clinicos dc
    JOIN public.pareceres_medicos p ON p.documento_resposta_id = dc.id WHERE p.id = current_setting('teste.par')::uuid;
  IF ds.id IS NULL OR ds.tipo_documento <> 'parecer' OR ds.numero IS NULL OR ds.autor_id <> '10000000-0000-4000-8000-000000000002'
     OR ds.conteudo NOT LIKE '%Especialidade: Cirurgia geral%' OR ds.conteudo NOT LIKE '%Prioridade: Urgência%'
     OR ds.internacao_id IS DISTINCT FROM '24000000-0000-4000-8000-000000000097' THEN
    RAISE EXCEPTION 'FALHOU: solicitação sem documento numerado do solicitante';
  END IF;
  IF dr.autor_id <> '10000000-0000-4000-8000-000000000007' OR dr.numero IS NULL OR dr.conteudo NOT LIKE '%CRM 77777/SP%'
     OR dr.conteudo NOT LIKE '%' || ds.numero || '%' THEN
    RAISE EXCEPTION 'FALHOU: resposta sem documento numerado da parecerista com CRM e referência à solicitação';
  END IF;
  IF private.impeditivos_alta('24000000-0000-4000-8000-000000000097') @> '[{"tipo":"parecer"}]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: parecer realizado ainda impede a alta';
  END IF;
  IF (SELECT count(*) FROM public.log_auditoria WHERE entidade = 'pareceres_medicos'
        AND entidade_id = current_setting('teste.par')::uuid) <> 5 THEN
    RAISE EXCEPTION 'FALHOU: trilha sem solicitar, iniciar, cancelar análise, iniciar e concluir';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE acessado_por = '10000000-0000-4000-8000-000000000007'
                  AND paciente_id = '23000000-0000-4000-8000-000000000097') THEN
    RAISE EXCEPTION 'FALHOU: leitura da parecerista sem log de acesso';
  END IF;
  BEGIN
    DELETE FROM public.pareceres_medicos WHERE id = current_setting('teste.par')::uuid;
    RAISE EXCEPTION 'FALHOU: parecer apagado';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  dois documentos (dois autores), alta liberada, trilha e log; não se apaga';
END $$;

-- ── 6. 24 h depois, a leitura da parecerista fecha ──────────────────────────
UPDATE public.pareceres_medicos SET respondido_em = now() - interval '25 hours' WHERE id = current_setting('teste.par')::uuid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000007');
SELECT pg_temp.negado(format('SELECT public.parecer_dados_paciente(%L)', current_setting('teste.par')), 'leitura da parecerista não fechou em 24 h');

-- ── 7. cancelar o pedido: com motivo, entra no prontuário ───────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE v uuid;
BEGIN
  v := public.solicitar_parecer('23000000-0000-4000-8000-000000000097', 'Cardiologia',
         'Fibrilação atrial nova: anticoagular antes da cirurgia?', 'normal', 'Dr. Fulano');
  PERFORM set_config('teste.par2', v::text, true);
  BEGIN
    PERFORM public.cancelar_parecer(v, 'curto');
    RAISE EXCEPTION 'FALHOU: cancelou sem motivo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  PERFORM public.cancelar_parecer(v, 'Ritmo sinusal revertido espontaneamente.');
  IF NOT EXISTS (SELECT 1 FROM public.pareceres_do_paciente('23000000-0000-4000-8000-000000000097')
                  WHERE id = v AND status = 'cancelado' AND motivo_cancelamento LIKE 'Ritmo sinusal%' AND prestador = 'Dr. Fulano') THEN
    RAISE EXCEPTION 'FALHOU: histórico sem o cancelamento';
  END IF;
  IF (SELECT count(*) FROM public.pareceres_do_paciente('23000000-0000-4000-8000-000000000097')) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: histórico do paciente incompleto';
  END IF;
  RAISE NOTICE 'OK  cancelamento com motivo; histórico do paciente';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.documentos_clinicos dc JOIN public.pareceres_medicos p ON p.documento_cancelamento_id = dc.id
                  WHERE p.id = current_setting('teste.par2')::uuid AND dc.conteudo LIKE '%Ritmo sinusal%') THEN
    RAISE EXCEPTION 'FALHOU: cancelamento sem documento no prontuário';
  END IF;
  RAISE NOTICE 'OK  cancelamento vira documento';
END $$;

ROLLBACK;
