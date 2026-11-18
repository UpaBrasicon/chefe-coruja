-- Testes da migration 20270418000095 (SP1: desempenho do alerta de sepse).
-- Casos montados com resposta conhecida (S6). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
UPDATE public.responsaveis_tecnicos SET ativo = false, encerrado_em = now() WHERE ativo AND tipo = 'medico';
INSERT INTO public.responsaveis_tecnicos (perfil_id, tipo, conselho, registro, uf)
VALUES ('10000000-0000-4000-8000-000000000002', 'medico', 'CRM', '12345', 'SP');

CREATE TEMP TABLE k (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON k TO authenticated;
CREATE FUNCTION pg_temp.k(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM k WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.k(text) TO authenticated;
INSERT INTO k SELECT 'unidade', s.unidade_id FROM public.setores s JOIN public.unidades u ON u.id = s.unidade_id ORDER BY s.unidade_id, s.id LIMIT 1;
INSERT INTO k SELECT 'setor', s.id FROM public.setores s WHERE s.unidade_id = pg_temp.k('unidade') ORDER BY s.id LIMIT 1;
INSERT INTO k VALUES ('medico', '10000000-0000-4000-8000-000000000002');
-- a gestora (...001) é gestora da unidade do teste
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
VALUES ('10000000-0000-4000-8000-000000000001', pg_temp.k('unidade'), 'gestor', '10000000-0000-4000-8000-000000000001')
ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true;

CREATE FUNCTION pg_temp.conceito(p text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.conceito WHERE nome = p AND categoria = 'sinal_vital' ORDER BY id LIMIT 1 $$;

-- um atendimento por caso; T0 = 2 dias atrás
CREATE FUNCTION pg_temp.caso(p_nome text, p_nasc date) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_pac uuid; v_ep uuid;
BEGIN
  INSERT INTO public.pacientes (unidade_id, nome, data_nascimento) VALUES (pg_temp.k('unidade'), 'SP1 ' || p_nome, p_nasc)
  RETURNING id INTO v_pac;
  INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, aberto_por, chegada_em)
  VALUES (pg_temp.k('unidade'), v_pac, pg_temp.k('setor'), 'Febre', pg_temp.k('medico'), now() - interval '2 days' - interval '3 hours')
  RETURNING id INTO v_ep;
  INSERT INTO k VALUES ('p_' || p_nome, v_pac), ('e_' || p_nome, v_ep);
  -- a prescrição pede o peso do atendimento
  INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, valor_num, registrado_por)
  VALUES (pg_temp.k('unidade'), v_pac, v_ep, pg_temp.conceito('peso'), now() - interval '2 days' - interval '3 hours', 70, pg_temp.k('medico'));
END $$;
CREATE FUNCTION pg_temp.antimicrobiano(p_nome text, p_horas numeric) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_pr uuid;
BEGIN
  INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, episodio_id, assinada_em)
  VALUES (pg_temp.k('unidade'), pg_temp.k('p_' || p_nome), pg_temp.k('medico'), pg_temp.k('e_' || p_nome),
          now() - interval '2 days' + make_interval(secs => p_horas * 3600))
  RETURNING id INTO v_pr;
  INSERT INTO public.prescricao_itens (prescricao_id, descricao, dose, via, peso_kg, created_at)
  VALUES (v_pr, 'Ceftriaxona 1 g', '1 g', 'EV', 70, now() - interval '2 days' + make_interval(secs => p_horas * 3600));
END $$;
CREATE FUNCTION pg_temp.cultura(p_nome text, p_horas numeric) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, pedido_por, pedido_em, coletado_em)
  VALUES (pg_temp.k('unidade'), pg_temp.k('p_' || p_nome), pg_temp.k('e_' || p_nome), 'Hemocultura', pg_temp.k('medico'),
          now() - interval '2 days' + make_interval(secs => p_horas * 3600), now() - interval '2 days' + make_interval(secs => p_horas * 3600)) $$;
CREATE FUNCTION pg_temp.laboratorio(p_nome text, p_horas numeric, p_analito text, p_loinc text, p_valor numeric) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_x uuid; v_r uuid;
BEGIN
  INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, pedido_por, pedido_em)
  VALUES (pg_temp.k('unidade'), pg_temp.k('p_' || p_nome), pg_temp.k('e_' || p_nome), p_analito, pg_temp.k('medico'),
          now() - interval '2 days' + make_interval(secs => p_horas * 3600))
  RETURNING id INTO v_x;
  INSERT INTO public.exame_resultados (exame_id, versao, origem, texto, liberado_em)
  VALUES (v_x, 1, 'manual', p_analito || ' ' || p_valor, now() - interval '2 days' + make_interval(secs => p_horas * 3600)) RETURNING id INTO v_r;
  INSERT INTO public.exame_resultado_itens (resultado_id, analito, loinc, valor_num) VALUES (v_r, p_analito, p_loinc, p_valor);
END $$;
CREATE FUNCTION pg_temp.vital(p_nome text, p_horas numeric, p_conceito text, p_valor numeric) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, valor_num, registrado_por)
  VALUES (pg_temp.k('unidade'), pg_temp.k('p_' || p_nome), pg_temp.k('e_' || p_nome), pg_temp.conceito(p_conceito),
          now() - interval '2 days' + make_interval(secs => p_horas * 3600), p_valor, pg_temp.k('medico')) $$;
CREATE FUNCTION pg_temp.aviso(p_nome text, p_horas numeric, p_evento text, p_parcial boolean, p_motivo text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.avisos_sepse_atendimento (unidade_id, paciente_id, episodio_id, evento, nivel, news2_total, parcial, motivo, autor_id, registrado_em)
  VALUES (pg_temp.k('unidade'), pg_temp.k('p_' || p_nome), pg_temp.k('e_' || p_nome), p_evento, 'news2_rastreio', 6, p_parcial, p_motivo,
          pg_temp.k('medico'), now() - interval '2 days' + make_interval(secs => p_horas * 3600)) $$;

-- 1. sepse com alerta: antimicrobiano em T0, cultura em T0+2h (início T0); plaquetas 80 e creatinina 2,5 (SOFA 4); aviso em T0-1h
SELECT pg_temp.caso('com_alerta', '1960-01-01');
SELECT pg_temp.antimicrobiano('com_alerta', 0); SELECT pg_temp.cultura('com_alerta', 2);
SELECT pg_temp.laboratorio('com_alerta', 1, 'Plaquetas', '777-3', 80000);
SELECT pg_temp.laboratorio('com_alerta', 1, 'Creatinina', '2160-0', 2.5);
SELECT pg_temp.aviso('com_alerta', -1, 'exibido', false, NULL);
-- 2. sepse sem alerta a tempo: cultura em T0, antimicrobiano em T0+10h (início T0); Glasgow 9 (3); alerta da internação em T0+10h
SELECT pg_temp.caso('sem_alerta', '1955-02-02');
SELECT pg_temp.cultura('sem_alerta', 0); SELECT pg_temp.antimicrobiano('sem_alerta', 10);
SELECT pg_temp.vital('sem_alerta', 1, 'glasgow', 9);
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, episodio_id, status)
SELECT u.organizacao_id, u.id, pg_temp.k('p_sem_alerta'), pg_temp.k('e_sem_alerta'), 'internado' FROM public.unidades u WHERE u.id = pg_temp.k('unidade');
INSERT INTO public.alertas_sepse_internacao (unidade_id, internacao_id, paciente_id, nivel, news2_total, parcial, autor_id, exibido_em)
SELECT pg_temp.k('unidade'), i.id, i.paciente_id, 'news2_alto', 8, false, pg_temp.k('medico'), now() - interval '2 days' + interval '10 hours'
  FROM public.internacoes i WHERE i.episodio_id = pg_temp.k('e_sem_alerta');
-- 3. alerta sem sepse: aviso parcial dispensado, sem antimicrobiano
SELECT pg_temp.caso('falso_alarme', '1970-03-03');
SELECT pg_temp.aviso('falso_alarme', 0, 'exibido', true, NULL);
SELECT pg_temp.aviso('falso_alarme', 1, 'dispensado', true, 'Sem foco infeccioso');
-- 4. infecção sem disfunção: plaquetas 200 e creatinina 0,8
SELECT pg_temp.caso('sem_disfuncao', '1980-04-04');
SELECT pg_temp.antimicrobiano('sem_disfuncao', 0); SELECT pg_temp.cultura('sem_disfuncao', 1);
SELECT pg_temp.laboratorio('sem_disfuncao', 1, 'Plaquetas', '777-3', 200);
SELECT pg_temp.laboratorio('sem_disfuncao', 1, 'Creatinina', '2160-0', 0.8);
-- 5. antimicrobiano sem cultura
SELECT pg_temp.caso('sem_cultura', '1975-05-05');
SELECT pg_temp.antimicrobiano('sem_cultura', 0);
-- 6. fora da janela: cultura em T0, antimicrobiano 4 dias depois
SELECT pg_temp.caso('fora_janela', '1965-06-06');
SELECT pg_temp.cultura('fora_janela', -96); SELECT pg_temp.antimicrobiano('fora_janela', 0);
-- 7. adolescente de 16 anos com sepse (linha à parte)
SELECT pg_temp.caso('adolescente', (current_date - interval '16 years')::date);
SELECT pg_temp.antimicrobiano('adolescente', 0); SELECT pg_temp.cultura('adolescente', 1);
SELECT pg_temp.laboratorio('adolescente', 1, 'Plaquetas', '777-3', 40);
-- 8. criança de 10 anos: fora do SP1
SELECT pg_temp.caso('crianca', (current_date - interval '10 years')::date);
SELECT pg_temp.antimicrobiano('crianca', 0); SELECT pg_temp.cultura('crianca', 1);

CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(p_ok, false) THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;
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

-- casos, um a um
CREATE TEMP TABLE c ON COMMIT DROP AS
SELECT k.nome, x.* FROM private.sepse_casos(pg_temp.k('unidade'), now() - interval '5 days', now()) x
JOIN k ON k.id = x.episodio_id;
SELECT pg_temp.confere((SELECT sepse AND detectado AND antecedencia_h = 1 AND (sofa ->> 'total')::int = 4 AND alerta_origem = 'porta'
  FROM c WHERE nome = 'e_com_alerta'), 'sepse com alerta: detectada, 1 h antes, SOFA 4 (plaquetas 80 mil e creatinina 2,5)');
SELECT pg_temp.confere((SELECT sepse AND NOT detectado AND suspeita_em = now() - interval '2 days' AND (sofa ->> 'neurologico')::int = 3
  AND alerta_origem = 'internacao' FROM c WHERE nome = 'e_sem_alerta'), 'sepse com alerta 10 h depois: não detectada; início na cultura; Glasgow 9 = 3');
SELECT pg_temp.confere((SELECT NOT sepse AND suspeita_em IS NULL AND alerta_em IS NOT NULL AND alerta_parcial AND dispensado
  AND motivo_dispensa = 'Sem foco infeccioso' FROM c WHERE nome = 'e_falso_alarme'), 'alerta sem sepse, parcial e dispensado com motivo');
SELECT pg_temp.confere((SELECT suspeita_em IS NOT NULL AND NOT sepse AND (sofa ->> 'total')::int = 0 AND (sofa ->> 'tem_plaquetas')::boolean
  FROM c WHERE nome = 'e_sem_disfuncao'), 'infecção sem disfunção: suspeita sem sepse');
SELECT pg_temp.confere((SELECT antimicrobiano_sem_cultura AND suspeita_em IS NULL FROM c WHERE nome = 'e_sem_cultura'), 'antimicrobiano sem cultura');
SELECT pg_temp.confere((SELECT suspeita_em IS NULL FROM c WHERE nome = 'e_fora_janela'), 'cultura 4 dias antes do antimicrobiano: sem suspeita');
SELECT pg_temp.confere((SELECT faixa = '14_17' AND sepse FROM c WHERE nome = 'e_adolescente'), 'adolescente: faixa 14 a 17, com sepse');
SELECT pg_temp.confere(NOT EXISTS (SELECT 1 FROM c WHERE nome = 'e_crianca'), 'criança fora do SP1');

-- painel: gestora vê; o adulto bate com os casos
SELECT set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE d ON COMMIT DROP AS SELECT public.desempenho_alerta_sepse(pg_temp.k('unidade'), 2) AS j;
SELECT pg_temp.confere((SELECT (j -> 'adulto' ->> 'atendimentos')::int >= 6 AND (j -> 'adulto' ->> 'sepses')::int >= 2
  FROM d), 'painel do adulto conta os atendimentos e as sepses');
SELECT pg_temp.confere((SELECT (j -> 'de_14_a_17' ->> 'sepses')::int >= 1 FROM d), 'linha de 14 a 17 anos à parte');
SELECT pg_temp.confere((SELECT NOT (j -> 'adulto' ->> 'publicavel')::boolean AND j -> 'adulto' ->> 'motivo_nao_publicavel' LIKE 'amostra pequena%' FROM d),
  'menos de 30 sepses: não publicável');
SELECT pg_temp.confere((SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(j -> 'motivos_dispensa') x WHERE x ->> 'motivo' = 'Sem foco infeccioso') FROM d),
  'motivos de dispensa no painel');
SELECT pg_temp.falha($$SELECT public.casos_revisao_alerta_sepse(pg_temp.k('unidade'), 2, 'Revisão mensal do alerta')$$,
  'A lista de casos é do responsável técnico', 'gestora não abre a lista de casos');
-- o RT abre a lista com motivo, e o acesso fica registrado
SELECT set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
SELECT pg_temp.falha($$SELECT public.casos_revisao_alerta_sepse(pg_temp.k('unidade'), 2, 'curto')$$, 'Escreva o motivo', 'lista pede motivo');
CREATE TEMP TABLE l ON COMMIT DROP AS SELECT public.casos_revisao_alerta_sepse(pg_temp.k('unidade'), 2, 'Revisão mensal do alerta') AS j;
SELECT pg_temp.confere((SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE x ->> 'episodio_id' = pg_temp.k('e_sem_alerta')::text
  AND x ->> 'categoria' = 'sepse_sem_alerta') FROM l), 'lista traz a sepse sem alerta');
SELECT pg_temp.confere((SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE x ->> 'episodio_id' = pg_temp.k('e_falso_alarme')::text
  AND x ->> 'categoria' = 'alerta_sem_sepse') FROM l), 'lista traz o alerta sem sepse');
SELECT pg_temp.confere((SELECT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE x ->> 'episodio_id' = pg_temp.k('e_com_alerta')::text) FROM l),
  'lista não traz o acerto');
RESET ROLE;
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE paciente_id = pg_temp.k('p_sem_alerta')
  AND motivo LIKE 'Revisão do alerta de sepse (SP1)%'), 'acesso registrado com o motivo');
SELECT pg_temp.confere(NOT has_function_privilege('anon', 'public.desempenho_alerta_sepse(uuid,int)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.sepse_casos(uuid,timestamptz,timestamptz)', 'EXECUTE'), 'anônimo e usuário não chamam o cálculo');
SELECT pg_temp.falha($$UPDATE public.alertas_sepse_internacao SET news2_total = 1$$, '', 'registro do alerta é só de inclusão');

ROLLBACK;
