-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D03.
-- Check-in fora do raio e sem localização.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D03.
--
-- A regra do raio só vale em unidade COM coordenada, e nenhuma unidade da rede
-- F5 tem (de propósito). Este script põe uma coordenada FICTÍCIA na UPA Bloco D
-- (unidade só do bloco D, criada pelo 49d), confere a regra pela RPC com
-- posições de teste e RETIRA a coordenada no fim do mesmo script. Não existe
-- RPC para gravar coordenada: o ajuste é feito no banco e fica registrado.
--
-- Contas: raio.d.f5 (plantonista C), tele.d.f5 (telemedicina) e gestor.d.f5.
-- Nenhuma conta F5 e nenhuma unidade F5 é tocada. Sem paciente.
--
-- Rodar antes: 47 e 49d.
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/82_cenario_d03.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d03_rodada', (coalesce(e2e.d_v('d03_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'd03\_%' AND nome <> 'd03_rodada';
SELECT e2e.d_guardar('d03_data', private.data_do_turno(now())::text);
SELECT e2e.d_guardar('d03_turno', CASE WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '07:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '13:00' THEN 'manha'
                                       WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '13:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '19:00' THEN 'tarde'
                                       ELSE 'noite' END);
-- coordenada fictícia da UPA Bloco D e posições de teste (1° de latitude ≈ 111,2 km)
SELECT e2e.d_guardar('d03_lat', '-23.5000'), e2e.d_guardar('d03_lng', '-46.6000');

CREATE OR REPLACE FUNCTION e2e.d03_plantao(p_passo text, p_conta text, p_papel text, p_guardar text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  SELECT id::text INTO r FROM public.escala_plantao WHERE perfil_id = e2e.d_conta(p_conta) AND setor_id = 'fd300000-0000-4000-8000-000000000011'
     AND data = e2e.d_v('d03_data')::date AND turno = e2e.d_v('d03_turno') AND ativo;
  IF r IS NULL THEN
    RETURN e2e.d_passo(p_passo, 3, 'd_ges', '/escala (EscalaMes)', 'Gestor escala ' || p_conta || ' (' || p_papel || ') no turno em curso',
      format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, %L, NULL, false, %L)::text$q$,
        'fd100000-0000-4000-8000-000000000001', 'fd300000-0000-4000-8000-000000000011', e2e.d_conta(p_conta), e2e.d_v('d03_data'), e2e.d_v('d03_turno'), p_papel), 'ok', p_guardar);
  END IF;
  PERFORM e2e.d_guardar(p_guardar, r);
  RETURN 'reaproveitado';
END $$;
-- apaga a presença da conta do bloco D no turno (para repetir o check-in)
CREATE OR REPLACE FUNCTION e2e.d03_sem_presenca(p_passo text, p_conta text) RETURNS text LANGUAGE sql AS $$
  SELECT e2e.d_ajuste(p_passo, 3, 'Apaga a presença de ' || p_conta || ' no turno (conta do bloco D), para a próxima tentativa começar sem check-in',
    format('DELETE FROM public.presenca_plantonista WHERE perfil_id = %L AND unidade_id = %L AND data = %L AND turno = %L',
      e2e.d_conta(p_conta), 'fd100000-0000-4000-8000-000000000001', e2e.d_v('d03_data'), e2e.d_v('d03_turno')))
$$;
CREATE OR REPLACE FUNCTION e2e.d03_checkin_sql(p_dlat numeric, p_lat_nula boolean, p_just text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format('SELECT public.registrar_checkin(%L::uuid, %s, %s, NULL, %L)::text', 'fd100000-0000-4000-8000-000000000001',
    CASE WHEN p_lat_nula THEN 'NULL' ELSE (e2e.d_v('d03_lat')::numeric + p_dlat)::text END,
    CASE WHEN p_lat_nula THEN 'NULL' ELSE e2e.d_v('d03_lng') END, p_just)
$$;

-- ── 0. pré-condições ────────────────────────────────────────────────────────
SELECT e2e.d03_plantao('D03.00.escala_c', 'd_plant_c', 'plantonista', 'd03_pl_c');
SELECT e2e.d03_plantao('D03.00.escala_tele', 'd_tele', 'telemedicina', 'd03_pl_tele');
SELECT e2e.d03_sem_presenca('D03.00.limpa_c', 'd_plant_c');
SELECT e2e.d03_sem_presenca('D03.00.limpa_tele', 'd_tele');
SELECT e2e.d_ajuste('D03.00.coordenada', 3, 'Coordenada FICTÍCIA na UPA Bloco D (−23,5; −46,6), raio padrão 500 m — retirada no fim deste script',
  format('UPDATE public.unidades SET latitude = %s, longitude = %s, raio_metros = 500 WHERE id = %L', e2e.d_v('d03_lat'), e2e.d_v('d03_lng'), 'fd100000-0000-4000-8000-000000000001'));

-- ── 1 a 4. fora do raio ─────────────────────────────────────────────────────
SELECT e2e.d_passo('D03.01.fora_do_raio', 3, 'd_plant_c', '/plantao/check-in (geolocalizacao.ts)', 'Check-in a ~2 km da unidade, sem justificativa (deve ser recusado)',
  e2e.d03_checkin_sql(0.018, false, NULL), 'erro:CHECKIN_FORA_DO_RAIO');
SELECT e2e.d_passo('D03.02.justificativa_curta', 3, 'd_plant_c', '/plantao/check-in', '2ª tentativa, mesma posição, justificativa de 5 letras (deve ser recusado)',
  e2e.d03_checkin_sql(0.018, false, 'longe'), 'erro:CHECKIN_JUSTIFICATIVA_CURTA');
SELECT e2e.d_passo('D03.02.sem_linha', 3, 'banco', NULL, 'As duas recusas não gravaram presença',
  format($q$SELECT e2e.d_confere(NOT EXISTS (SELECT 1 FROM public.presenca_plantonista WHERE perfil_id = %L AND data = %L AND turno = %L), 'sem linha')$q$,
    'fd200000-0000-4000-8000-000000000008', e2e.d_v('d03_data'), e2e.d_v('d03_turno')));
SELECT e2e.d_passo('D03.03.com_justificativa', 3, 'd_plant_c', '/plantao/check-in', '2ª tentativa com "GPS do celular marcou a rua errada": aceito, marcado fora do raio',
  e2e.d03_checkin_sql(0.018, false, 'GPS do celular marcou a rua errada'), 'ok', 'd03_pres_fora');
SELECT e2e.d_dep('d03_pres_fora', 'D03.03.com_justificativa', 'D03.03.marca', 3, 'banco', NULL, 'Presença com checkin_dentro = false, distância e justificativa; autor = login',
  format($q$SELECT e2e.d_confere(checkin_dentro IS FALSE AND checkin_distancia_m BETWEEN 1900 AND 2100 AND checkin_justificativa LIKE 'GPS%%' AND criado_por = %L,
      'dentro ' || coalesce(checkin_dentro::text, 'nulo') || ', ' || checkin_distancia_m || ' m, "' || checkin_justificativa || '"')
     FROM public.presenca_plantonista WHERE id = %L$q$, 'fd200000-0000-4000-8000-000000000008', e2e.d_v('d03_pres_fora')));
SELECT e2e.d_passo('D03.04.gestor_ve', 3, 'd_ges', '/escala → PresencasDoDia', 'Gestor vê o check-in fora do raio com a justificativa',
  format($q$SELECT e2e.d_confere(checkin_dentro IS FALSE AND checkin_justificativa IS NOT NULL, nome || ': dentro ' || coalesce(checkin_dentro::text, 'nulo') || ', ' || coalesce(checkin_distancia_m::text, '?') || ' m, ' || coalesce(checkin_justificativa, ''))
     FROM public.presencas_do_dia_gestor(%L::uuid) WHERE perfil_id = %L$q$, 'fd100000-0000-4000-8000-000000000001', 'fd200000-0000-4000-8000-000000000008'));
SELECT e2e.d_passo('D03.07.raio_nao_bloqueia', 3, 'd_plant_c', '/atendimento (usePlantao)', 'Depois do check-in fora do raio a porta abre: só a falta de check-in bloqueia',
  format($q$SELECT e2e.d_confere((s ->> 'liberado')::boolean AND (s ->> 'bloqueado')::boolean IS FALSE, s::text) FROM (SELECT public.situacao_checkin(%L::uuid) s) x$q$,
    'fd100000-0000-4000-8000-000000000001'));

-- ── 5 e 6. sem localização ──────────────────────────────────────────────────
SELECT e2e.d03_sem_presenca('D03.05.limpa', 'd_plant_c');
SELECT e2e.d_passo('D03.05.sem_localizacao', 3, 'd_plant_c', '/plantao/check-in', 'Navegador sem localização e sem justificativa (deve ser recusado)',
  e2e.d03_checkin_sql(0, true, NULL), 'erro:CHECKIN_SEM_LOCALIZACAO');
SELECT e2e.d_passo('D03.05.sem_localizacao_curta', 3, 'd_plant_c', '/plantao/check-in', 'Sem localização, justificativa de 6 letras (deve ser recusado)',
  e2e.d03_checkin_sql(0, true, 'sem gps'), 'erro:CHECKIN_JUSTIFICATIVA_CURTA');
SELECT e2e.d_passo('D03.06.sem_localizacao_ok', 3, 'd_plant_c', '/plantao/check-in', 'Com "navegador sem permissão de localização": aceito, marcado sem localização',
  e2e.d03_checkin_sql(0, true, 'navegador sem permissão de localização'), 'ok', 'd03_pres_sem');
SELECT e2e.d_dep('d03_pres_sem', 'D03.06.sem_localizacao_ok', 'D03.06.marca', 3, 'banco', NULL, 'Presença sem posição: checkin_dentro e distância nulos, justificativa gravada',
  format($q$SELECT e2e.d_confere(checkin_lat IS NULL AND checkin_dentro IS NULL AND checkin_distancia_m IS NULL AND checkin_justificativa IS NOT NULL,
      'dentro ' || coalesce(checkin_dentro::text, 'nulo') || ', justificativa "' || coalesce(checkin_justificativa, '') || '"')
     FROM public.presenca_plantonista WHERE id = %L$q$, e2e.d_v('d03_pres_sem')));
SELECT e2e.d_lacuna('D03.06.marca_sem_localizacao', 3, 'd_ges', 'Marca "sem localização" distinta de "fora do raio" para o gestor',
  'Só na tela: no banco o check-in sem posição fica com checkin_dentro nulo + justificativa; o de fora do raio, com checkin_dentro = false + distância. A tela é que diferencia.');

-- ── bordas ──────────────────────────────────────────────────────────────────
SELECT e2e.d03_sem_presenca('D03.B1.limpa', 'd_plant_c');
SELECT e2e.d_passo('D03.B1.dentro_490', 3, 'd_plant_c', '/plantao/check-in', 'Posição a ~490 m (dentro do raio de 500 m), sem justificativa: aceito, dentro',
  e2e.d03_checkin_sql(0.0044, false, NULL), 'ok', 'd03_pres_dentro');
SELECT e2e.d_dep('d03_pres_dentro', 'D03.B1.dentro_490', 'D03.B1.marca', 3, 'banco', NULL, 'checkin_dentro = true, distância até 500 m',
  format($q$SELECT e2e.d_confere(checkin_dentro AND checkin_distancia_m <= 500, 'dentro, ' || checkin_distancia_m || ' m') FROM public.presenca_plantonista WHERE id = %L$q$, e2e.d_v('d03_pres_dentro')));
SELECT e2e.d03_sem_presenca('D03.B2.limpa', 'd_plant_c');
SELECT e2e.d_ajuste('D03.B2.raio_1000', 3, 'Raio da UPA Bloco D alterado para 1000 m', format('UPDATE public.unidades SET raio_metros = 1000 WHERE id = %L', 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_passo('D03.B2.mensagem_raio_novo', 3, 'd_plant_c', '/plantao/check-in', 'A ~2 km com raio de 1000 m: a mensagem mostra o raio novo',
  e2e.d03_checkin_sql(0.018, false, NULL), 'erro:CHECKIN_FORA_DO_RAIO');
SELECT e2e.d_passo('D03.B2.mensagem', 3, 'banco', NULL, 'Texto da recusa traz "o raio é de 1000 m"',
  $q$SELECT e2e.d_confere(detalhe LIKE '%raio é de 1000 m%', detalhe) FROM e2e.resultados WHERE passo = 'D03.B2.mensagem_raio_novo' ORDER BY id DESC LIMIT 1$q$);
SELECT e2e.d_passo('D03.B3.telemedicina', 3, 'd_tele', '/plantao/check-in', 'Telemedicina a ~2 km, sem justificativa: aceita, remota, sem cerca geográfica',
  e2e.d03_checkin_sql(0.018, false, NULL), 'ok', 'd03_pres_tele');
SELECT e2e.d_dep('d03_pres_tele', 'D03.B3.telemedicina', 'D03.B3.remoto', 3, 'banco', NULL, 'Presença da telemedicina sem posição gravada e marcada "Telemedicina (remoto)"',
  format($q$SELECT e2e.d_confere(checkin_lat IS NULL AND checkin_dentro IS NULL AND observacao LIKE 'Telemedicina (remoto)%%', coalesce(observacao, '')) FROM public.presenca_plantonista WHERE id = %L$q$, e2e.d_v('d03_pres_tele')));

-- ── fim: a coordenada SAI da unidade ────────────────────────────────────────
SELECT e2e.d_ajuste('D03.99.retira_coordenada', 3, 'Coordenada retirada da UPA Bloco D; raio de volta a 500 m',
  format('UPDATE public.unidades SET latitude = NULL, longitude = NULL, raio_metros = 500 WHERE id = %L', 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d03_sem_presenca('D03.B4.limpa', 'd_plant_c');
SELECT e2e.d_passo('D03.B4.sem_coordenada', 3, 'd_plant_c', '/plantao/check-in', 'Unidade SEM coordenada (como as da F5): posição a ~2 km passa sem marca de raio',
  e2e.d03_checkin_sql(0.018, false, NULL), 'ok', 'd03_pres_semcoord');
SELECT e2e.d_dep('d03_pres_semcoord', 'D03.B4.sem_coordenada', 'D03.B4.marca', 3, 'banco', NULL, 'checkin_dentro e distância nulos (raio não conferido)',
  format($q$SELECT e2e.d_confere(checkin_dentro IS NULL AND checkin_distancia_m IS NULL, 'dentro ' || coalesce(checkin_dentro::text, 'nulo')) FROM public.presenca_plantonista WHERE id = %L$q$, e2e.d_v('d03_pres_semcoord')));
SELECT e2e.d_passo('D03.99.sem_coordenada_f5', 3, 'banco', NULL, 'Nenhuma unidade F5 nem a do bloco D ficou com coordenada',
  $q$SELECT e2e.d_confere(count(*) = 0, count(*) || ' unidade(s) com coordenada') FROM public.unidades
      WHERE (id::text LIKE 'f51%' OR id::text LIKE 'fd1%') AND (latitude IS NOT NULL OR longitude IS NOT NULL)$q$);

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D03.%' AND em >= now() GROUP BY 1;
