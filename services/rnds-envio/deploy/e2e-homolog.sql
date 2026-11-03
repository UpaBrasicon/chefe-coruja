-- ─────────────────────────────────────────────────────────────────────────────
-- Teste ponta a ponta da 5.3c: fila da HOMOLOGAÇÃO → serviço no VPS → simulador.
--
-- Cria, só na homologação, uma rede fictícia "Rede RNDS E2E" (unidade, médico,
-- paciente), um atendimento da porta com alta, uma observação com alta e uma
-- solicitação de regulação, liga o envio só dessa unidade e põe tudo na fila
-- pela conferência noturna. Idempotente: rodar de novo não duplica.
--
-- Rodar na homologação (nunca na produção):
--   npm run db:alvo   → homolog
--   npx supabase db query --linked -f services/rnds-envio/deploy/e2e-homolog.sql
-- Depois, no VPS, o certificado de teste da unidade (infra/rnds-envio.md).
-- Conferir com o SELECT do fim do arquivo.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  org   uuid := '00000000-0000-4000-8000-00000000e501';
  un    uuid := '00000000-0000-4000-8000-00000000e502';
  setor uuid := '00000000-0000-4000-8000-00000000e503';
  pac   uuid := '00000000-0000-4000-8000-00000000e504';
  med   uuid := '00000000-0000-4000-8000-00000000e505';
  ep    uuid := '00000000-0000-4000-8000-00000000e506';
  ep_obs uuid := '00000000-0000-4000-8000-00000000e507';
  int_  uuid := '00000000-0000-4000-8000-00000000e508';
  reg   uuid := '00000000-0000-4000-8000-00000000e509';
  central uuid := '00000000-0000-4000-8000-00000000e50a';
  dia date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  h0 timestamptz := (dia::timestamp AT TIME ZONE 'America/Sao_Paulo');
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (med, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'rnds.e2e.medico@exemplo.invalid', '{"origem": "admin"}', '{"nome_completo": "Medico Ficticio E2E"}', now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.perfis (id, nome_completo, cpf, cns, cbo)
  VALUES (med, 'Medico Ficticio E2E', '11144477735', '898001000000011', '225125')
  ON CONFLICT (id) DO UPDATE SET cpf = EXCLUDED.cpf, cns = EXCLUDED.cns, cbo = EXCLUDED.cbo;
  INSERT INTO public.organizacoes (id, nome) VALUES (org, 'Rede RNDS E2E (teste)') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, uf) VALUES
    (un, org, 'UPA RNDS E2E (teste)', 'upa', '9999991', 'GO'),
    (central, org, 'Central RNDS E2E (teste)', 'hospital', '9999990', 'GO')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
  SELECT org, central, med WHERE NOT EXISTS (SELECT 1 FROM public.centrais_regulacao WHERE unidade_id = central);
  INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (setor, un, 'Porta E2E', 'emergencia') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo, cpf)
  VALUES (pac, un, 'Paciente Ficticio E2E', '1960-01-01', 'E2E-1', 'M', '52998224725') ON CONFLICT (id) DO NOTHING;

  -- porta: alta
  IF NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = ep) THEN
    INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, chegada_em,
      atendimento_medico_id, atendimento_iniciado_em, desfecho, desfecho_em, desfecho_por, encerrado_em, encerrado_por)
    VALUES (ep, un, pac, setor, 'Dor de garganta', med, 'encerrado', h0 + interval '1 hour', med, h0 + interval '70 minutes',
      'alta', h0 + interval '2 hours', med, h0 + interval '2 hours', med);
    INSERT INTO public.diagnosticos_episodio (unidade_id, paciente_id, episodio_id, tipo, cid, status, registrado_por, registrado_em)
    VALUES (un, pac, ep, 'primario', 'J06.9', 'confirmado', med, h0 + interval '90 minutes');
    INSERT INTO public.procedimentos_realizados (unidade_id, paciente_id, episodio_id, procedimento, quantidade, realizado_em,
      profissional_id, cbo, via, registrado_por)
    VALUES (un, pac, ep, '0301060096', 1, h0 + interval '70 minutes', med, '225125', 'quem_fez', med);
    INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, registrado_por, valor_num, unidade, origem)
    SELECT un, pac, ep, c.id, h0 + interval '80 minutes', med, v.valor, 'mmHg', 'manual'
      FROM (VALUES ('pressao-arterial-sistolica', 128), ('pressao-arterial-diastolica', 82)) AS v(nome, valor)
      JOIN public.conceito c ON c.nome = v.nome AND c.unidade_id IS NULL;
  END IF;

  -- observação: alta (Sumário de Alta)
  IF NOT EXISTS (SELECT 1 FROM public.internacoes WHERE id = int_) THEN
    INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, chegada_em,
      atendimento_medico_id, atendimento_iniciado_em, desfecho, desfecho_em, desfecho_por, encerrado_em, encerrado_por)
    VALUES (ep_obs, un, pac, setor, 'Desidratação', med, 'encerrado', h0 + interval '30 minutes', med, h0 + interval '40 minutes',
      'observacao', h0 + interval '50 minutes', med, h0 + interval '50 minutes', med);
    INSERT INTO public.procedimentos_realizados (unidade_id, paciente_id, episodio_id, procedimento, quantidade, realizado_em,
      profissional_id, cbo, via, registrado_por)
    VALUES (un, pac, ep_obs, '0301060029', 1, h0 + interval '3 hours', med, '225125', 'quem_fez', med);
    INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, episodio_id, tipo_internacao, origem_admissao,
      status, data_admissao, data_alta, alta_por, cid_alta)
    VALUES (int_, org, un, pac, ep_obs, 'observacao', 'emergencia', 'alta_melhorada',
      h0 + interval '1 hour', h0 + interval '6 hours', med, 'E86');
    INSERT INTO public.resumos_clinicos (unidade_id, paciente_id, internacao_id, resumo, autor_id, criado_em)
    VALUES (un, pac, int_, 'Hidratado, aceitando dieta, alta para casa (teste ponta a ponta).', med, h0 + interval '5 hours');
  END IF;

  -- regulação: o envio. Pelo SQL não há usuário na sessão: quem assina é o médico
  IF NOT EXISTS (SELECT 1 FROM public.regulacao_solicitacoes WHERE id = reg) THEN
    INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
      paciente_nao_identificado, tipo, procedimento, tipo_leito, destino_tipo, destino_unidade_id, carater, modalidade, prioridade,
      cid, quadro_clinico, solicitante_id, solicitante_papel, status)
    VALUES (reg, org, central, un, '9999991', pac, false, 'leito', '0303060190', 'clinico', 'a_definir', NULL, 'urgencia', '04',
      'urgencia', 'E86', 'Quadro clínico do pedido de teste ponta a ponta da RNDS.', med, 'gestor', 'enviada');
  END IF;
  UPDATE public.interop_outbox SET profissional_id = med
   WHERE tipo_documento = 'regulacao' AND referencia_id = reg AND profissional_id IS NULL;

  -- envio ligado só nesta unidade, com o identificador de teste
  INSERT INTO public.rnds_config_unidade (unidade_id, ambiente, identificador_solicitante, financiamento, envio_ligado)
  VALUES (un, 'homologacao', '99999', '07', true)
  ON CONFLICT (unidade_id) DO UPDATE SET envio_ligado = true, pausado_em = NULL, pausa_motivo = NULL, atualizado_em = now();

  PERFORM private.rnds_conferencia_noturna(dia);
END $$;

-- conferir (rodar de novo depois de 1–2 min):
SELECT tipo_documento, status, id_rnds IS NOT NULL AS tem_id_rnds, tentativas, ultimo_erro, enviado_em
  FROM public.interop_outbox
 WHERE unidade_id = '00000000-0000-4000-8000-00000000e502'
 ORDER BY created_at;
