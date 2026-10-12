-- ════════════════════════════════════════════════════════════════════════════
-- Rodada 2 (Portão 2) — cenários extras: troca de unidade no meio do
-- atendimento, segundo fator no lado do banco, "Pergunte à IA" do gestor
-- (perguntar_gestao), lote de 40 fichas na porta e exportações do gestor.
-- Roda depois do 33. Ambiente local ou homologação; nunca produção.
-- O que só existe nas telas (expiração de sessão, leitor de tela, teclado,
-- PDF, webhook do prescreve.com) fica registrado como lacuna para o RT.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION e2e.cronometrar(p_passo text, p_papel text, p_rota text, p_sql text, p_limite_ms int) RETURNS text LANGUAGE plpgsql AS $$
DECLARE t0 timestamptz; ms numeric; r text;
BEGIN
  t0 := clock_timestamp();
  r := e2e.passo(p_passo, NULL, p_papel, p_rota, 'Tempo da tela (limite ' || p_limite_ms || ' ms)', p_sql);
  ms := round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  UPDATE e2e.resultados SET detalhe = ms || ' ms; ' || coalesce(detalhe, ''),
         situacao = CASE WHEN situacao = 'ok' AND ms > p_limite_ms THEN 'falha' ELSE situacao END
   WHERE id = (SELECT max(id) FROM e2e.resultados);
  RETURN ms || ' ms — ' || p_passo;
END $$;

-- roda uma consulta como um papel (sem registrar passo), para conferências
CREATE OR REPLACE FUNCTION e2e.como(p_papel text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta(p_papel), 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  EXECUTE p_sql INTO r;
  PERFORM set_config('role', 'postgres', true);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('role', 'postgres', true);
  RETURN 'erro: ' || SQLERRM;
END $$;

-- ── X1. troca de unidade no meio do atendimento ─────────────────────────────
-- O plantonista da porta ganha um segundo vínculo (Hospital Infantil, setor Pediatria) e escala hoje.
SELECT e2e.ajuste('X1.segundo_vinculo', 'plantonista vinculado também ao Hospital Infantil (coorte 2), com escala hoje na Pediatria',
  $q$INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
     SELECT 'e2000000-0000-4000-8000-000000000004', 'e1100000-0000-4000-8000-000000000005', 'plantonista'::public.papel
      WHERE NOT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = 'e2000000-0000-4000-8000-000000000004' AND unidade_id = 'e1100000-0000-4000-8000-000000000005');
     UPDATE public.vinculos SET ativo = true WHERE perfil_id = 'e2000000-0000-4000-8000-000000000004' AND unidade_id = 'e1100000-0000-4000-8000-000000000005';
     INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, rotulo)
     SELECT 'e1100000-0000-4000-8000-000000000005', 'e1200000-0000-4000-8000-000000000051', 'e2000000-0000-4000-8000-000000000004', d::date, t, 'E2E troca de unidade'
       FROM generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1, interval '1 day') d,
            unnest(ARRAY['manha', 'tarde', 'noite']) t
      WHERE NOT EXISTS (SELECT 1 FROM public.escala_plantao x WHERE x.perfil_id = 'e2000000-0000-4000-8000-000000000004' AND x.setor_id = 'e1200000-0000-4000-8000-000000000051' AND x.data = d::date AND x.turno = t)$q$);

-- ficha nova na UPA (#35) atendida pelo plantonista2
SELECT e2e.passo('X1.ficha', 35, 'recepcao', '/recepcao', 'Ficha do #35 na UPA (dor de garganta)',
  format('SELECT (public.registrar_ficha(%L, %L, %L::uuid, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Dor de garganta há 3 dias',
         (SELECT id FROM public.pacientes WHERE nome = 'E2E Troca de Unidade' AND unidade_id = 'e1100000-0000-4000-8000-000000000001' LIMIT 1),
         jsonb_build_object('nome', 'E2E Troca de Unidade', 'cpf', e2e.cpf('900000035'), 'data_nascimento', '1980-05-05', 'sexo', 'M')), 'ok', 'r2ep35');
SELECT e2e.guardar('r2pac35', (SELECT paciente_id::text FROM public.episodios WHERE id = e2e.u('r2ep35')));
SELECT e2e.passo('X1.classificar', 35, 'enfermeiro', '/triagem', 'Enfermeira classifica (verde)',
  format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text', e2e.u('r2ep35'), 'verde',
         '{"frequencia-cardiaca": 80, "pressao-arterial-sistolica": 130, "pressao-arterial-diastolica": 85, "saturacao-o2": 97, "temperatura": 36.6, "frequencia-respiratoria": 16, "escala-dor": 4}',
         (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Dor de garganta' AND publico = 'adulto' LIMIT 1),
         e2e.disc('e1100000-0000-4000-8000-000000000001', (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Dor de garganta' AND publico = 'adulto' LIMIT 1), 'verde')));
SELECT e2e.passo('X1.iniciar', 35, 'plantonista', '/plantao/porta', 'plantonista (vinculado às duas unidades) inicia o atendimento na UPA',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('r2ep35')));
SELECT e2e.passo('X1.soap', 35, 'plantonista', '/plantao/porta', 'SOAP na UPA',
  format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', e2e.u('r2ep35'), 'Dor de garganta há 3 dias.', 'Orofaringe hiperemiada, sem exsudato.', 'Faringite aguda', 'Sintomáticos e orientação.', 'J02.9'));
-- "troca" para a outra unidade no meio do atendimento: os dados da UPA não aparecem na busca do Hospital Infantil
SELECT e2e.passo('X1.busca_nao_vaza', 35, 'plantonista', '/pacientes', 'A busca no Hospital Infantil não devolve pacientes da UPA',
  format($q$SELECT CASE WHEN count(*) = 0 THEN '0' ELSE e2e.falhar(count(*) || ' paciente(s) da UPA na busca da outra unidade') END
            FROM public.buscar_pacientes(%L::uuid, %L) b WHERE b.id IN (SELECT id FROM public.pacientes WHERE unidade_id = %L)$q$,
         'e1100000-0000-4000-8000-000000000005', 'E2E', 'e1100000-0000-4000-8000-000000000001'));
SELECT e2e.passo('X1.busca_propria', 35, 'plantonista', '/pacientes', 'A busca na UPA acha o #35',
  format($q$SELECT CASE WHEN count(*) >= 1 THEN count(*)::text ELSE e2e.falhar('não achou') END FROM public.buscar_pacientes(%L::uuid, %L) b WHERE b.id = %L$q$,
         'e1100000-0000-4000-8000-000000000001', 'Troca de Unidade', e2e.u('r2pac35')));
SELECT e2e.passo('X1.desfecho_setor_de_outra_unidade', 35, 'plantonista', '/plantao/porta', 'Desfecho internação com setor do Hospital Infantil num episódio da UPA (deve recusar)',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('r2ep35'), 'internacao',
         jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000051')), 'erro');
SELECT e2e.passo('X1.alta', 35, 'plantonista', '/plantao/porta', 'Alta do #35 na UPA (a troca de unidade não encerrou o atendimento)',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', e2e.u('r2ep35'), 'alta', 'Orientado; sintomáticos (teste E2E).', '{"cid_alta":"J02.9"}'));
SELECT e2e.passo('X1.sem_vinculo_prontuario', 16, 'medico_trauma', '/prontuarios', 'Médico sem vínculo com a UPA tenta abrir o prontuário do #16 (deve recusar)',
  format('SELECT public.abrir_prontuario(%L::uuid)::text', e2e.u('r2pac16')), 'erro');
SELECT e2e.passo('X1.sem_vinculo_fila', NULL, 'medico_trauma', '/plantao/porta', 'Médico sem vínculo não vê a fila da porta da UPA (deve recusar)',
  format('SELECT count(*)::text FROM public.fila_da_porta(%L::uuid)', 'e1200000-0000-4000-8000-000000000001'), 'erro:Acesso negado');
SELECT e2e.passo('X1.gestor_outra_unidade', NULL, 'gestor', '/gestao', 'Gestor da UPA tenta o panorama do Hospital Infantil (deve recusar)',
  format('SELECT length(public.panorama_gestor(%L::uuid)::text)::text', 'e1100000-0000-4000-8000-000000000005'), 'erro');
SELECT e2e.ajuste('X1.desfaz_vinculo', 'Segundo vínculo do plantonista desligado e escala extra removida',
  $q$DELETE FROM public.escala_plantao WHERE perfil_id = 'e2000000-0000-4000-8000-000000000004' AND rotulo = 'E2E troca de unidade';
     UPDATE public.vinculos SET ativo = false WHERE perfil_id = 'e2000000-0000-4000-8000-000000000004' AND unidade_id = 'e1100000-0000-4000-8000-000000000005'$q$);
SELECT e2e.lacuna('X1.sessao_expira', NULL, 'todos', 'Expiração de sessão nas telas', 'O tempo de sessão é do Supabase Auth (JWT) e do cliente; não há como testar por SQL. Fica com o RT na tela da homologação.');

-- ── X2. segundo fator (lado do banco) ───────────────────────────────────────
SELECT e2e.ajuste('X2.liga_2fa', 'Plataforma passa a exigir segundo fator',
  $q$INSERT INTO public.configuracao_plataforma (chave, valor) VALUES ('exigir_segundo_fator', true)
     ON CONFLICT (chave) DO UPDATE SET valor = true$q$);
SELECT e2e.passo('X2.gestao_bloqueada', NULL, 'gestor', '/gestao', 'Com 2FA exigido e sessão sem o segundo fator, a pergunta do gestor é bloqueada',
  format('SELECT public.perguntar_gestao(%L::uuid, %L)::text', 'e1100000-0000-4000-8000-000000000001', 'como está a ocupação?'), 'erro:SEGUNDO_FATOR');
SELECT e2e.passo('X2.exportacao_bloqueada', NULL, 'gestor', '/gestao/exportacoes', 'Exportação também bloqueada sem o segundo fator',
  format('SELECT public.exportacao_iniciar(%L::uuid, %L, %L, NULL, NULL)::text', 'e1100000-0000-4000-8000-000000000001', 'leitos', 'csv'), 'erro:SEGUNDO_FATOR');
-- ADR 0010: com o segundo fator exigido, toda chamada ao banco é bloqueada até a confirmação (porta e prescrição incluídas)
SELECT e2e.passo('X2.porta_bloqueada', NULL, 'recepcao', '/recepcao', 'A fila da porta também é bloqueada sem o segundo fator (ADR 0010)',
  format('SELECT count(*)::text FROM public.fila_da_porta(%L::uuid)', 'e1200000-0000-4000-8000-000000000001'), 'erro:SEGUNDO_FATOR');
SELECT e2e.passo('X2.prescricao_bloqueada', 34, 'plantonista', '/plantao/porta', 'A prescrição também é bloqueada sem o segundo fator (ADR 0010)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('pac11'), jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Dipirona sódica'), 'dose', '1 g', 'via', 'oral', 'posologia', '6/6h se dor')), 'erro:SEGUNDO_FATOR');
SELECT e2e.ajuste('X2.desliga_2fa', 'Plataforma volta a não exigir segundo fator (homologação)',
  $q$UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator'$q$);
SELECT e2e.lacuna('X2.2fa_tela', NULL, 'gestor', 'Cadastro do autenticador e confirmação do código na tela', 'Só na tela (TOTP). Fica com o RT na homologação, com 2FA ligado para a conta dele.');

-- ── X3. "Pergunte à IA" do gestor: perguntar_gestao (SQL, sem LLM) ──────────
CREATE OR REPLACE FUNCTION e2e.pergunta(p_tema text, p_pergunta text) RETURNS text LANGUAGE sql AS $$
  SELECT format($f$SELECT CASE WHEN (r ->> 'entendida')::boolean AND r ->> 'tema' = %L AND length(r ->> 'resposta') > 10 THEN left(r ->> 'resposta', 300)
                              ELSE e2e.falhar('tema=' || coalesce(r ->> 'tema', '?') || ' entendida=' || coalesce(r ->> 'entendida', '?') || ' ' || left(r::text, 200)) END
                   FROM public.perguntar_gestao('e1100000-0000-4000-8000-000000000001', %L) r$f$, p_tema, p_pergunta)
$$;
SELECT e2e.passo('X3.checkin', NULL, 'gestor', '/gestao', 'Pergunta sobre check-in', e2e.pergunta('checkin', 'Quem está atrasado no check-in hoje?'));
SELECT e2e.passo('X3.ocupacao', NULL, 'gestor', '/gestao', 'Pergunta sobre ocupação', e2e.pergunta('ocupacao', 'Como está a ocupação dos leitos agora?'));
SELECT e2e.passo('X3.estoque', NULL, 'gestor', '/gestao', 'Pergunta sobre medicamentos em falta', e2e.pergunta('farmacia', 'Quais medicamentos estão em falta na farmácia?'));
SELECT e2e.passo('X3.alta', NULL, 'gestor', '/gestao', 'Pergunta sobre permanência e altas', e2e.pergunta('alta', 'Qual a permanência média e onde está o gargalo da alta?'));
SELECT e2e.passo('X3.escala', NULL, 'gestor', '/gestao', 'Pergunta sobre sobrecarga de plantão', e2e.pergunta('carga', 'Alguém passou do limite de horas de plantão?'));
SELECT e2e.passo('X3.porta', NULL, 'gestor', '/gestao', 'Pergunta sobre a porta', e2e.pergunta('porta', 'Quantos esperam na porta e qual a espera máxima?'));
SELECT e2e.passo('X3.nao_entendida', NULL, 'gestor', '/gestao', 'Pergunta fora dos temas: responde que não entendeu, sem inventar',
  format($q$SELECT CASE WHEN (r ->> 'entendida')::boolean THEN e2e.falhar('entendeu: ' || left(r::text, 200)) ELSE left(r ->> 'resposta', 200) END FROM public.perguntar_gestao(%L, %L) r$q$,
         'e1100000-0000-4000-8000-000000000001', 'Qual a dose de amoxicilina para uma criança de 12 kg?'));
SELECT e2e.passo('X3.pt_br', NULL, 'gestor', '/gestao', 'Resposta em português, sem termos em inglês',
  format($q$SELECT CASE WHEN r ->> 'resposta' !~* '(\mbeds?\M|\mpatients?\M|\moccupancy\M|\mwaiting\M)' THEN 'pt-BR' ELSE e2e.falhar(left(r ->> 'resposta', 200)) END FROM public.perguntar_gestao(%L, %L) r$q$,
         'e1100000-0000-4000-8000-000000000001', 'Como está a ocupação dos leitos?'));
SELECT e2e.passo('X3.longa', NULL, 'gestor', '/gestao', 'Pergunta com mais de 300 caracteres é recusada',
  format('SELECT public.perguntar_gestao(%L::uuid, %L)::text', 'e1100000-0000-4000-8000-000000000001', repeat('ocupação ', 40)), 'erro');
SELECT e2e.passo('X3.plantonista_nega', NULL, 'plantonista', '/gestao', 'Plantonista não usa a pergunta do gestor (deve recusar)',
  format('SELECT public.perguntar_gestao(%L::uuid, %L)::text', 'e1100000-0000-4000-8000-000000000001', 'como está a ocupação?'), 'erro');
SELECT e2e.conferir('X3.ocupacao_bate', NULL, 'O número de internados do panorama (base da resposta) bate com as internações abertas da UPA',
  e2e.como('gestor', $q$SELECT (public.panorama_gestor('e1100000-0000-4000-8000-000000000001') -> 'n' ->> 'internados')$q$)
  = (SELECT count(*)::text FROM public.internacoes i WHERE i.unidade_id = 'e1100000-0000-4000-8000-000000000001' AND i.data_alta IS NULL
      AND i.status IN ('admitido', 'em_observacao', 'internado') AND NOT private.setor_de_observacao(i.setor_atual_id)),
  'panorama: ' || e2e.como('gestor', $q$SELECT (public.panorama_gestor('e1100000-0000-4000-8000-000000000001') -> 'n' ->> 'internados')$q$)
  || ' | banco (fora dos setores de observação): ' || (SELECT count(*) FROM public.internacoes i WHERE i.unidade_id = 'e1100000-0000-4000-8000-000000000001' AND i.data_alta IS NULL
      AND i.status IN ('admitido', 'em_observacao', 'internado') AND NOT private.setor_de_observacao(i.setor_atual_id)));

-- ── X4. lote de 40 fichas na porta ──────────────────────────────────────────
DO $$
DECLARE i int; t0 timestamptz := clock_timestamp(); ms numeric; v_flux uuid; v_disc text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE nome = 'E2E Lote 001') THEN RETURN; END IF;
  FOR i IN 1..40 LOOP
    PERFORM e2e.passo('X4.ficha_lote', NULL, 'recepcao', '/recepcao', 'Ficha do lote ' || lpad(i::text, 3, '0'),
      format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Lote 40: dor de garganta',
             jsonb_build_object('nome', 'E2E Lote ' || lpad(i::text, 3, '0'), 'cpf', e2e.cpf('9000004' || lpad(i::text, 2, '0')),
                                'data_nascimento', (date '1990-01-01' + (i * 97))::text, 'sexo', CASE WHEN i % 2 = 0 THEN 'F' ELSE 'M' END)),
      'ok', 'r2lote' || i);
  END LOOP;
  ms := round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  PERFORM e2e.conferir('X4.tempo_40_fichas', NULL, '40 fichas pela recepção em menos de 20 s', ms < 20000, ms || ' ms');
  SELECT id INTO v_flux FROM public.protocolo_fluxogramas WHERE nome = 'Dor de garganta' AND publico = 'adulto' LIMIT 1;
  v_disc := e2e.disc('e1100000-0000-4000-8000-000000000001', v_flux, 'verde');
  t0 := clock_timestamp();
  FOR i IN 1..40 LOOP
    PERFORM e2e.passo('X4.classificar_lote', NULL, 'enfermeiro', '/triagem', 'Classificação do lote ' || lpad(i::text, 3, '0') || ' (verde)',
      format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text', e2e.u('r2lote' || i), 'verde',
             '{"frequencia-cardiaca": 78, "pressao-arterial-sistolica": 120, "pressao-arterial-diastolica": 80, "saturacao-o2": 98, "temperatura": 37.2, "frequencia-respiratoria": 16, "escala-dor": 3}', v_flux, v_disc));
  END LOOP;
  ms := round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  PERFORM e2e.conferir('X4.tempo_40_triagens', NULL, '40 classificações pela enfermagem em menos de 20 s', ms < 20000, ms || ' ms');
END $$;
SELECT e2e.cronometrar('X4.fila_porta_40', 'enfermeiro', '/triagem', $q$SELECT count(*)::text FROM public.fila_da_porta('e1200000-0000-4000-8000-000000000001')$q$, 1500);
SELECT e2e.conferir('X4.fila_tem_lote', NULL, 'A fila da porta mostra os 40 do lote esperando o médico',
  e2e.como('enfermeiro', $q$SELECT count(*)::text FROM public.fila_da_porta('e1200000-0000-4000-8000-000000000001') f WHERE f.nome LIKE 'E2E Lote %'$q$) = '40',
  e2e.como('enfermeiro', $q$SELECT count(*)::text FROM public.fila_da_porta('e1200000-0000-4000-8000-000000000001') f WHERE f.nome LIKE 'E2E Lote %'$q$));
SELECT e2e.cronometrar('X4.porta_gestor_40', 'gestor', '/gestao/porta', $q$SELECT length(public.porta_agora('e1100000-0000-4000-8000-000000000001')::text)::text$q$, 1500);
SELECT e2e.cronometrar('X4.panorama_40', 'gestor', '/gestao', $q$SELECT length(public.panorama_gestor('e1100000-0000-4000-8000-000000000001')::text)::text$q$, 2000);
SELECT e2e.passo('X4.espera_na_pergunta', NULL, 'gestor', '/gestao', 'O gestor pergunta pela porta com 40 esperando: a resposta traz a espera',
  format($q$SELECT CASE WHEN (r ->> 'entendida')::boolean AND r ->> 'tema' = 'porta' THEN left(r ->> 'resposta', 300) ELSE e2e.falhar(left(r::text, 200)) END FROM public.perguntar_gestao(%L, %L) r$q$,
         'e1100000-0000-4000-8000-000000000001', 'Quantos estão esperando na porta agora?'));

-- ── X5. exportações do gestor ───────────────────────────────────────────────
SELECT e2e.passo('X5.atendimentos', NULL, 'gestor', '/gestao/exportacoes', 'Exportação de atendimentos dos últimos 60 dias (CSV, mascarada)',
  format('SELECT (public.exportacao_iniciar(%L::uuid, %L, %L, %L::date, %L::date) ->> ''id'')', 'e1100000-0000-4000-8000-000000000001', 'atendimentos', 'csv', current_date - 60, current_date), 'ok', 'r2exp_at');
SELECT e2e.conferir('X5.total_atendimentos_bate', NULL, 'O total da exportação bate com os episódios da UPA no período',
  (SELECT total FROM public.exportacoes WHERE id = e2e.u('r2exp_at'))
  = (SELECT count(*) FROM public.episodios WHERE unidade_id = 'e1100000-0000-4000-8000-000000000001' AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN current_date - 60 AND current_date),
  'exportação: ' || (SELECT total FROM public.exportacoes WHERE id = e2e.u('r2exp_at')) || ' | banco: '
  || (SELECT count(*) FROM public.episodios WHERE unidade_id = 'e1100000-0000-4000-8000-000000000001' AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN current_date - 60 AND current_date));
SELECT e2e.passo('X5.pagina_atendimentos', NULL, 'gestor', '/gestao/exportacoes', 'Primeira página da exportação de atendimentos',
  format($q$SELECT jsonb_array_length(public.exportacao_pagina(%L::uuid) -> 'dados')::text$q$, e2e.u('r2exp_at')));
SELECT e2e.passo('X5.concluir_atendimentos', NULL, 'gestor', '/gestao/exportacoes', 'Conclui a exportação',
  format('SELECT public.exportacao_concluir(%L::uuid)::text', e2e.u('r2exp_at')));
SELECT e2e.passo('X5.pacientes_mascarada', NULL, 'gestor', '/gestao/exportacoes', 'Exportação de pacientes mascarada (JSON)',
  format('SELECT (public.exportacao_iniciar(%L::uuid, %L, %L, %L::date, %L::date, true) ->> ''id'')', 'e1100000-0000-4000-8000-000000000001', 'pacientes', 'json', current_date - 60, current_date), 'ok', 'r2exp_pac');
SELECT e2e.passo('X5.mascara_cpf', NULL, 'gestor', '/gestao/exportacoes', 'A exportação mascarada não traz o CPF inteiro do #3 nem o nome da mãe do #16',
  format($q$SELECT CASE WHEN d !~ %L AND d !~ 'E2E Mãe do RN' THEN 'mascarado' ELSE e2e.falhar('dado pessoal aberto na exportação mascarada') END
            FROM (SELECT (public.exportacao_pagina(%L::uuid) -> 'dados')::text AS d) x$q$, e2e.cpf('900000003'), e2e.u('r2exp_pac')));
SELECT e2e.passo('X5.aberta_sem_motivo', NULL, 'gestor', '/gestao/exportacoes', 'Exportação sem máscara e sem motivo é recusada',
  format('SELECT public.exportacao_iniciar(%L::uuid, %L, %L, %L::date, %L::date, false)::text', 'e1100000-0000-4000-8000-000000000001', 'pacientes', 'csv', current_date - 60, current_date), 'erro');
SELECT e2e.passo('X5.aberta_com_motivo', NULL, 'gestor', '/gestao/exportacoes', 'Exportação sem máscara com motivo exige a confirmação do segundo fator (TOTP) mesmo com a plataforma sem 2FA',
  format('SELECT (public.exportacao_iniciar(%L::uuid, %L, %L, %L::date, %L::date, false, %L) ->> ''id'')', 'e1100000-0000-4000-8000-000000000001', 'pacientes', 'csv', current_date - 60, current_date,
         'Auditoria do teste de ponta a ponta (Rodada 2): conferência de cadastro.'), 'erro:CONFIRMACAO');
SELECT e2e.lacuna('X5.aberta_tela', NULL, 'gestor', 'Exportação sem máscara (com TOTP) e o registro de acesso por paciente', 'Exige o código do autenticador na hora; só na tela, com a conta do RT com 2FA. Conferir depois que log_acesso_prontuario recebe uma linha por paciente com tipo_acesso = exportacao.');
SELECT e2e.passo('X5.leitos', NULL, 'gestor', '/gestao/exportacoes', 'Exportação de leitos (sem período)',
  format('SELECT (public.exportacao_iniciar(%L::uuid, %L, %L, NULL, NULL) ->> ''total'')', 'e1100000-0000-4000-8000-000000000001', 'leitos', 'csv'));
SELECT e2e.passo('X5.formato_invalido', NULL, 'gestor', '/gestao/exportacoes', 'Formato fora de csv/json é recusado',
  format('SELECT public.exportacao_iniciar(%L::uuid, %L, %L, NULL, NULL)::text', 'e1100000-0000-4000-8000-000000000001', 'leitos', 'xml'), 'erro');
SELECT e2e.passo('X5.periodo_longo', NULL, 'gestor', '/gestao/exportacoes', 'Período acima de 12 meses é recusado',
  format('SELECT public.exportacao_iniciar(%L::uuid, %L, %L, %L::date, %L::date)::text', 'e1100000-0000-4000-8000-000000000001', 'internacoes', 'csv', current_date - 400, current_date), 'erro');
SELECT e2e.passo('X5.plantonista_nega', NULL, 'plantonista', '/gestao/exportacoes', 'Plantonista não exporta (deve recusar)',
  format('SELECT public.exportacao_iniciar(%L::uuid, %L, %L, NULL, NULL)::text', 'e1100000-0000-4000-8000-000000000001', 'leitos', 'csv'), 'erro');
SELECT e2e.passo('X5.lista', NULL, 'gestor', '/gestao/exportacoes', 'A lista de exportações da unidade mostra as desta rodada',
  format($q$SELECT CASE WHEN jsonb_array_length(l) >= 3 THEN jsonb_array_length(l)::text ELSE e2e.falhar(l::text) END FROM (SELECT public.exportacoes_lista(%L::uuid) AS l) x$q$, 'e1100000-0000-4000-8000-000000000001'));

-- ── X6. o que fica com o RT ou não existe ───────────────────────────────────
SELECT e2e.lacuna('X6.webhook_prescreve', NULL, 'admin', 'Webhook do prescreve.com com origem inválida', 'Não existe receptor de webhook nem integração com o prescreve.com no repositório (Edge Functions: clinical-search e afins). O cenário não tem o que testar; o RT aponta onde o webhook deveria existir.');
SELECT e2e.lacuna('X6.teclado_leitor', NULL, 'todos', 'Navegação por teclado e leitor de tela', 'Só nas telas. A conferência de foco/aria pela ferramenta local sai no relatório; o leitor de tela fica com o RT.');
SELECT e2e.lacuna('X6.pdf', NULL, 'plantonista', 'PDF impresso (atestado, receita, pacote de alta)', 'A impressão é window.print() no navegador; o protocolo e o registro de acesso são testados (T6). O PDF visual fica com o RT.');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'X%' GROUP BY situacao ORDER BY situacao;
SELECT passo, coalesce(paciente::text, '-') AS pac, left(detalhe, 150) AS detalhe FROM e2e.resultados WHERE passo LIKE 'X%' AND situacao = 'falha' ORDER BY id;
