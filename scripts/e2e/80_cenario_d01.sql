-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D01.
-- Acesso pela escala: fora da janela, tolerância de 30 min e check-in atrasado.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D01.
--
-- Roda na UPA Bloco D, com as contas próprias do bloco (49d): a escala das
-- contas F5 NÃO é tocada (os outros blocos a usam ao mesmo tempo).
-- O script inteiro roda numa transação só: now() é o mesmo em todos os passos.
-- "O tempo passa" movendo o INÍCIO do plantão das contas do bloco D (ajuste
-- registrado como 'ajuste'); no fim, o início volta ao do turno.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs reais.
-- Paciente fictícia nova por rodada ("Ana Teste Janela"). A cor da
-- classificação é a escolha da enfermeira de teste (verde).
--
-- Rodar antes: 41_checkin_fase5.sql, 47_framework_ampliacao.sql e 49d_ambiente_bloco_d.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/80_cenario_d01.sql <saida>.sql
--                    npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── rodada ──────────────────────────────────────────────────────────────────
SELECT e2e.d_guardar('d01_rodada', (coalesce(e2e.d_v('d01_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'd01\_%' AND nome <> 'd01_rodada';
SELECT e2e.d_guardar('d01_nome', 'Ana Teste Janela' || CASE WHEN e2e.d_v('d01_rodada')::int > 1 THEN ' ' || chr(64 + e2e.d_v('d01_rodada')::int) ELSE '' END);
SELECT e2e.d_guardar('d01_cadastro', jsonb_build_object('nome', e2e.d_v('d01_nome'), 'data_nascimento', '1985-02-03', 'sexo', 'F',
  'raca_cor', 'branca', 'cns', e2e.d_cns(9810 + e2e.d_v('d01_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste D01', 'endereco', 'Rua do Teste, 1',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);
-- turno em curso pela hora de Brasília (grade de 12 h: 07–19 manhã/tarde de 6 h, 19–07 noite)
SELECT e2e.d_guardar('d01_data', private.data_do_turno(now())::text);
SELECT e2e.d_guardar('d01_turno', CASE WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '07:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '13:00' THEN 'manha'
                                       WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '13:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '19:00' THEN 'tarde'
                                       ELSE 'noite' END);

-- plantão do bloco D no turno em curso: cria pela RPC do gestor ou, numa nova rodada, reaproveita o da rodada anterior
CREATE OR REPLACE FUNCTION e2e.d01_plantao(p_passo text, p_conta text, p_papel text, p_setor uuid, p_guardar text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  r := e2e.d_passo(p_passo, 1, 'd_ges', '/escala (EscalaMes)', 'Gestor escala ' || p_conta || ' (' || p_papel || ') no turno em curso, ' || e2e.d_v('d01_turno') || ' de ' || e2e.d_v('d01_data'),
    format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, %L, NULL, false, %L)::text$q$,
      'fd100000-0000-4000-8000-000000000001', p_setor, e2e.d_conta(p_conta), e2e.d_v('d01_data'), e2e.d_v('d01_turno'), p_papel), 'ok', p_guardar);
  IF e2e.d_v(p_guardar) IS NULL THEN   -- rodada repetida: o plantão já existe
    PERFORM e2e.d_guardar(p_guardar, (SELECT id::text FROM public.escala_plantao WHERE perfil_id = e2e.d_conta(p_conta) AND setor_id = p_setor
                                         AND data = e2e.d_v('d01_data')::date AND turno = e2e.d_v('d01_turno')));
    PERFORM e2e.d_ajuste(p_passo || '_reuso', 1, 'Rodada repetida: reativa o plantão da rodada anterior e apaga a presença dele (só conta do bloco D)',
      format('UPDATE public.escala_plantao SET ativo = true WHERE id = %L; DELETE FROM public.presenca_plantonista WHERE escala_plantao_id = %L OR (perfil_id = %L AND data = %L AND turno = %L)',
        e2e.d_v(p_guardar), e2e.d_v(p_guardar), e2e.d_conta(p_conta), e2e.d_v('d01_data'), e2e.d_v('d01_turno')));
  END IF;
  RETURN r;
END $$;
-- "o tempo passa": o início do plantão vai para agora − N minutos (só contas do bloco D)
CREATE OR REPLACE FUNCTION e2e.d01_inicio(p_passo text, p_var text, p_min int) RETURNS text LANGUAGE sql AS $$
  SELECT e2e.d_ajuste(p_passo, 1, 'Início do plantão (' || p_var || ') levado para agora − ' || p_min || ' min (simula o tempo passado)',
    format('UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => %s) WHERE id = %L AND perfil_id::text LIKE %L', p_min, e2e.d_v(p_var), 'fd200000%'))
$$;

-- ── 0. pré-condições ────────────────────────────────────────────────────────
SELECT e2e.d_passo('D01.00.tolerancia', 1, 'd_ges', '/unidade (salvar_limites_unidade)', 'Gestor deixa a tolerância do check-in no padrão (30 min)',
  format('SELECT public.salvar_limites_unidade(%L::uuid, false, 11, 60, 85, 30)::text', 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_passo('D01.00.bpa_classificacao', 1, 'd_fat', '/faturamento (BPA)', 'Faturamento associa o SIGTAP 0301060118 ao uso classificacao na UPA Bloco D',
  format($q$SELECT public.associar_procedimento_bpa(%L::uuid, '0301060118', 'classificacao')::text$q$, 'fd100000-0000-4000-8000-000000000001'));

-- ── 1. enfermagem escalada; recepção sem plantão (vaga aberta) ──────────────
SELECT e2e.d01_plantao('D01.01.enf_escala', 'd_enf', 'enfermeiro', 'fd300000-0000-4000-8000-000000000011', 'd01_pl_enf');
SELECT e2e.d01_inicio('D01.01.enf_inicio_10', 'd01_pl_enf', 10);
SELECT e2e.d_passo('D01.01.vaga_recepcao', 1, 'd_ges', '/escala (marcar_vaga_escala)', 'Gestor abre vaga de recepção no turno em curso: a recepção fica sem plantão agora',
  format($q$SELECT public.marcar_vaga_escala(%L::uuid, %L::date, %L, 'Vaga de recepção aberta para o teste D01', 'recepcao')::text$q$,
    'fd300000-0000-4000-8000-000000000011', e2e.d_v('d01_data'), e2e.d_v('d01_turno')));

-- ── 2. recepção fora da escala ──────────────────────────────────────────────
SELECT e2e.d_passo('D01.02.rec_situacao', 1, 'd_rec', '/recepcao (AppShell → situacao_checkin)', 'Recepção sem plantão agora: fora da janela, não liberada',
  format($q$SELECT e2e.d_confere((s ->> 'na_janela')::boolean IS FALSE AND (s ->> 'liberado')::boolean IS FALSE, s::text) FROM (SELECT public.situacao_checkin(%L::uuid) s) x$q$,
    'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_passo('D01.02.rec_ficha_recusada', 1, 'd_rec', '/recepcao (Nova ficha)', 'Recepção fora da escala tenta abrir a ficha (deve ser recusado)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de cabeça há 2 dias', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'fd300000-0000-4000-8000-000000000011', e2e.d_v('d01_cadastro')), 'erro:Acesso negado: você não está de plantão');

-- ── 3. enfermagem dentro da tolerância, sem check-in ────────────────────────
SELECT e2e.d_passo('D01.03.enf_tolerancia', 1, 'd_enf', '/triagem (GateCheckIn)', 'Enfermeira 10 min depois do início, sem check-in: liberada pela tolerância e avisada do check-in pendente',
  format($q$SELECT e2e.d_confere((s ->> 'liberado')::boolean AND s -> 'pendente' IS NOT NULL AND s -> 'pendente' <> 'null'::jsonb, s::text) FROM (SELECT public.situacao_checkin(%L::uuid) s) x$q$,
    'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_passo('D01.03.enf_sem_presenca', 1, 'banco', NULL, 'Nenhuma presença da enfermeira no plantão',
  format($q$SELECT e2e.d_confere(NOT EXISTS (SELECT 1 FROM public.presenca_plantonista WHERE escala_plantao_id = %L), 'sem linha em presenca_plantonista')$q$, e2e.d_v('d01_pl_enf')));

-- ── 4. gestor fecha a vaga escalando a recepção ─────────────────────────────
SELECT e2e.d01_plantao('D01.04.rec_escala', 'd_rec', 'recepcao', 'fd300000-0000-4000-8000-000000000011', 'd01_pl_rec');
SELECT e2e.d01_inicio('D01.04.rec_inicio_1', 'd01_pl_rec', 1);
SELECT e2e.d_passo('D01.04.sobreposicao', 1, 'd_ges', '/escala', 'Escalar a mesma recepção em outro setor no mesmo turno (deve ser recusado)',
  format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, %L, NULL, false, 'recepcao')::text$q$,
    'fd100000-0000-4000-8000-000000000001', 'fd300000-0000-4000-8000-000000000013', 'fd200000-0000-4000-8000-000000000003', e2e.d_v('d01_data'), e2e.d_v('d01_turno')),
  'erro:Conflito');

-- ── 5. recepção com check-in abre a ficha ───────────────────────────────────
SELECT e2e.d_passo('D01.05.rec_checkin', 1, 'd_rec', '/plantao/check-in', 'Recepção faz o check-in (unidade sem coordenada: sem posição)',
  format($q$SELECT public.registrar_checkin(%L::uuid, NULL, NULL, NULL, NULL)::text$q$, 'fd100000-0000-4000-8000-000000000001'), 'ok', 'd01_pres_rec');
SELECT e2e.d_passo('D01.05.ficha', 1, 'd_rec', '/recepcao (Nova ficha)', 'A mesma recepção, agora escalada, abre a ficha de Ana no Pronto Socorro D',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de cabeça há 2 dias', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'fd300000-0000-4000-8000-000000000011', e2e.d_v('d01_cadastro')), 'ok', 'd01_ep');
SELECT e2e.d_dep('d01_ep', 'D01.05.ficha', 'D01.05.conta', 1, 'banco', NULL, 'Conta ambulatorial aberta pelo gatilho, sem itens; autor da ficha = login da recepção',
  format($q$SELECT c.id::text FROM public.contas c JOIN public.episodios e ON e.id = c.episodio_id
     WHERE c.episodio_id = %L AND c.tipo = 'ambulatorial' AND c.status = 'aberta' AND e.aberto_por = %L$q$, e2e.d_v('d01_ep'), 'fd200000-0000-4000-8000-000000000003'), 'ok', 'd01_conta');

-- ── 6. passa a tolerância sem check-in: a porta fecha ───────────────────────
SELECT e2e.d01_inicio('D01.06.enf_inicio_31', 'd01_pl_enf', 31);
SELECT e2e.d_passo('D01.06.enf_bloqueada', 1, 'd_enf', '/triagem (GateCheckIn)', '31 min depois do início, sem check-in: na janela, mas bloqueada',
  format($q$SELECT e2e.d_confere((s ->> 'bloqueado')::boolean, s::text) FROM (SELECT public.situacao_checkin(%L::uuid) s) x$q$, 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_dep('d01_ep', 'D01.05.ficha', 'D01.06.chamar_recusado', 1, 'd_enf', '/triagem (Fila)', 'Enfermeira sem check-in depois da tolerância tenta chamar Ana (deve ser recusado)',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.d_v('d01_ep'), 'fd400000-0000-4000-8000-000000000001'), 'erro:Acesso negado: você não está de plantão');

-- ── 7. check-in atrasado reabre sem o gestor ────────────────────────────────
SELECT e2e.d_passo('D01.07.checkin_atrasado', 1, 'd_enf', '/plantao/check-in (FormularioCheckin)', 'Enfermeira faz o check-in atrasado: entra na hora, sem liberação do gestor',
  format($q$SELECT public.registrar_checkin(%L::uuid, NULL, NULL, NULL, NULL)::text$q$, 'fd100000-0000-4000-8000-000000000001'), 'ok', 'd01_pres_enf');
SELECT e2e.d_dep('d01_pres_enf', 'D01.07.checkin_atrasado', 'D01.07.atraso', 1, 'banco', NULL, 'checkin_em fica 31 min depois do início do plantão',
  format($q$SELECT e2e.d_confere(p.checkin_em - e.inicio = interval '31 minutes' AND p.escala_plantao_id = e.id, 'atraso ' || (p.checkin_em - e.inicio)::text)
     FROM public.presenca_plantonista p JOIN public.escala_plantao e ON e.id = %L WHERE p.id = %L$q$, e2e.d_v('d01_pl_enf'), e2e.d_v('d01_pres_enf')));

-- ── 8. triagem: chamada e classificação (cor da enfermeira) ─────────────────
SELECT e2e.d_dep('d01_ep', 'D01.05.ficha', 'D01.08.chamar', 1, 'd_enf', '/triagem (Fila)', 'Enfermeira chama Ana para a Triagem D',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.d_v('d01_ep'), 'fd400000-0000-4000-8000-000000000001'));
SELECT e2e.d_dep('d01_ep', 'D01.05.ficha', 'D01.08.classificar', 1, 'd_enf', '/triagem (Classificar)',
  'Classifica: fluxograma "Dor de cabeça" (adulto), sinais crus; cor verde = escolha da enfermeira de teste',
  format($q$SELECT public.classificar_risco(%L::uuid, 'verde',
    '{"frequencia-cardiaca":78,"frequencia-respiratoria":16,"temperatura":36.4,"saturacao-o2":98,"escala-dor":4,"pressao-arterial-sistolica":124,"pressao-arterial-diastolica":80}'::jsonb,
    %L::uuid, e2e.disc(%L::uuid, %L::uuid, 'verde'), '{}'::jsonb)::text$q$,
    e2e.d_v('d01_ep'), '5cad8e39-22e4-4732-893a-3313e2329103', 'fd100000-0000-4000-8000-000000000001', '5cad8e39-22e4-4732-893a-3313e2329103'), 'ok', 'd01_class');
SELECT e2e.d_dep('d01_class', 'D01.08.classificar', 'D01.08.cor', 1, 'banco', NULL, 'A cor gravada é a da enfermeira e o autor é o login dela',
  format($q$SELECT e2e.d_confere(cor = 'verde' AND autor_id = %L, 'cor ' || cor || ', autor ' || autor_id) FROM public.classificacoes_risco WHERE id = %L$q$,
    'fd200000-0000-4000-8000-000000000004', e2e.d_v('d01_class')));

-- ── 9. faturamento sem escala ───────────────────────────────────────────────
SELECT e2e.d_dep('d01_conta', 'D01.05.conta', 'D01.09.faturamento', 1, 'd_fat', '/faturamento/contas', 'Faturamento, sem escala nem check-in, abre a conta de Ana: aberta com o item da classificação',
  format($q$SELECT e2e.d_confere(c::text LIKE '%%' || %L || '%%' AND (public.conta_detalhe(%L::uuid) -> 'itens')::text LIKE '%%0301060118%%',
      left((public.conta_detalhe(%L::uuid) -> 'itens')::text, 300))
     FROM (SELECT public.contas_da_unidade(%L::uuid, NULL, NULL) c) x$q$,
    e2e.d_v('d01_nome'), e2e.d_v('d01_conta'), e2e.d_v('d01_conta'), 'fd100000-0000-4000-8000-000000000001'));

-- ── 10. presenças do dia ────────────────────────────────────────────────────
SELECT e2e.d_passo('D01.10.presencas', 1, 'd_ges', '/escala → PresencasDoDia', 'Gestor (sem escala) lê as presenças: recepção com check-in 1 min depois do início; enfermeira 31 min depois',
  format($q$SELECT e2e.d_confere(count(*) FILTER (WHERE p.perfil_id = %L AND p.checkin_em IS NOT NULL) = 1 AND count(*) FILTER (WHERE p.perfil_id = %L AND p.checkin_em IS NOT NULL) = 1,
      string_agg(p.nome || ' ' || coalesce(to_char(p.checkin_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), 'sem check-in'), '; '))
     FROM public.presencas_do_dia_gestor(%L::uuid) p$q$,
    'fd200000-0000-4000-8000-000000000003', 'fd200000-0000-4000-8000-000000000004', 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_lacuna('D01.10.atraso_na_tela', 1, 'd_ges', 'PresencasDoDia marca o check-in atrasado',
  'Só na tela: presencas_do_dia_gestor devolve checkin_em, sem o início do plantão nem a marca de atraso; a marca, se houver, é calculada na tela.');

-- ── 11. check-in antes do início do plantão ─────────────────────────────────
SELECT e2e.d_passo('D01.11.escala_seguinte', 1, 'd_ges', '/escala', 'Gestor escala a plantonista B no turno SEGUINTE (Internação D)',
  format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, %L, NULL, false, 'plantonista')::text$q$,
    'fd100000-0000-4000-8000-000000000001', 'fd300000-0000-4000-8000-000000000013', 'fd200000-0000-4000-8000-000000000002',
    CASE e2e.d_v('d01_turno') WHEN 'noite' THEN e2e.d_v('d01_data')::date + 1 ELSE e2e.d_v('d01_data')::date END,
    CASE e2e.d_v('d01_turno') WHEN 'manha' THEN 'tarde' WHEN 'tarde' THEN 'noite' ELSE 'manha' END), 'ok', 'd01_pl_seguinte');
SELECT CASE WHEN e2e.d_v('d01_pl_seguinte') IS NOT NULL THEN e2e.d_ajuste('D01.11.inicio_em_20', 1, 'Plantão seguinte da plantonista B começa daqui a 20 min (simulado)',
  format('UPDATE public.escala_plantao SET inicio = now() + interval %L WHERE id = %L', '20 minutes', e2e.d_v('d01_pl_seguinte'))) END;
SELECT e2e.d_passo('D01.11.checkin_antes', 1, 'd_plant_b', '/plantao/check-in', 'Check-in 20 min antes do início do plantão (deve ser recusado: não há janela antes do início)',
  format($q$SELECT public.registrar_checkin(%L::uuid, NULL, NULL, NULL, NULL)::text$q$, 'fd100000-0000-4000-8000-000000000001'), 'erro:Você não está em escala');
SELECT e2e.d_lacuna('D01.11.janela_antes', 1, 'd_plant_b', 'Janela de check-in antes do início do plantão', 'Lacuna (MAPA): não existe; a recusa acima é o comportamento atual.');

-- ── bordas: tolerância 121, 120 e 0 ─────────────────────────────────────────
SELECT e2e.d_passo('D01.B1.tolerancia_121', 1, 'd_ges', '/unidade', 'Tolerância de 121 min (deve ser recusada)',
  format('SELECT public.salvar_limites_unidade(%L::uuid, false, 11, 60, 85, 121)::text', 'fd100000-0000-4000-8000-000000000001'), 'erro:Tolerância do check-in entre 0 e 120');
SELECT e2e.d_passo('D01.B2.tolerancia_120', 1, 'd_ges', '/unidade', 'Tolerância de 120 min (limite superior aceito)',
  format('SELECT public.salvar_limites_unidade(%L::uuid, false, 11, 60, 85, 120)::text', 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d01_plantao('D01.B3.farm_escala', 'd_farm', 'farmaceutico', 'fd300000-0000-4000-8000-000000000011', 'd01_pl_farm');
SELECT e2e.d01_inicio('D01.B3.farm_inicio_1', 'd01_pl_farm', 1);
SELECT e2e.d_passo('D01.B3.tolerancia_0', 1, 'd_ges', '/unidade', 'Tolerância 0',
  format('SELECT public.salvar_limites_unidade(%L::uuid, false, 11, 60, 85, 0)::text', 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_passo('D01.B3.zero_exige_checkin', 1, 'd_farm', '/farmacia (GateCheckIn)', 'Com tolerância 0, 1 min depois do início e sem check-in: bloqueada',
  format($q$SELECT e2e.d_confere((s ->> 'bloqueado')::boolean, s::text) FROM (SELECT public.situacao_checkin(%L::uuid) s) x$q$, 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_passo('D01.B3.volta_30', 1, 'd_ges', '/unidade', 'Tolerância volta ao padrão (30)',
  format('SELECT public.salvar_limites_unidade(%L::uuid, false, 11, 60, 85, 30)::text', 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_passo('D01.B3.trinta_libera', 1, 'd_farm', '/farmacia (GateCheckIn)', 'Com tolerância 30, a mesma farmacêutica sem check-in entra',
  format($q$SELECT e2e.d_confere((s ->> 'liberado')::boolean, s::text) FROM (SELECT public.situacao_checkin(%L::uuid) s) x$q$, 'fd100000-0000-4000-8000-000000000001'));

-- ── fim: o início dos plantões do bloco D volta ao do turno ─────────────────
SELECT e2e.d_ajuste('D01.99.inicio_volta', 1, 'O início dos plantões do bloco D volta ao do turno (escala_janela recalcula)',
  format('UPDATE public.escala_plantao SET turno = turno WHERE id IN (%L, %L, %L, %L)',
    coalesce(e2e.d_v('d01_pl_enf'), gen_random_uuid()::text), coalesce(e2e.d_v('d01_pl_rec'), gen_random_uuid()::text),
    coalesce(e2e.d_v('d01_pl_seguinte'), gen_random_uuid()::text), coalesce(e2e.d_v('d01_pl_farm'), gen_random_uuid()::text)));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D01.%' AND em >= now() GROUP BY 1;
