-- ════════════════════════════════════════════════════════════════════════════
-- Decisões de 30/09/2026: limites da unidade, chamado técnico do gestor e o
-- fracionamento de plantão que funciona.
--
-- 1. LIMITES DA UNIDADE (configuracoes_unidade, chave → valor, a tabela de
--    configuração não secreta que já existia). O gestor escolhe:
--      descanso_minimo_ativo   'true'/'false'  padrão false (a maioria dos
--                              contratos não é CLT; desligado, o Olho de
--                              Gavião não aponta descanso curto)
--      descanso_minimo_horas   1–24            padrão 11
--      sobrecarga_horas_7d     12–168          padrão 60 (horas em 7 dias)
--      ocupacao_limite_pct     50–100          padrão 85 (% de leitos)
--      checkin_tolerancia_min  0–120           padrão 30 (para a regra do
--                              check-in obrigatório; lida por
--                              private.config_unidade_int)
--    Leitura: private.limites_unidade (servidor) e public.limites_unidade
--    (qualquer membro da unidade; nada aqui é segredo). Escrita:
--    public.salvar_limites_unidade, só o gestor da unidade, com segundo fator.
--    Valor fora da faixa (gravado direto na tabela) vale como o padrão.
--    Quem usa: a varredura do Gavião, a pergunta sobre a gestão (carga) e o
--    mapa de leitos (limite de ocupação); as telas leem limites_unidade.
--
-- 2. CHAMADO TÉCNICO DO GESTOR. O gestor abre chamado DA SUA UNIDADE, lista e
--    acompanha os chamados dela e escreve nota no andamento. Situação e
--    responsável continuam do administrador (atualizar_chamado_tecnico não
--    muda). Chamado da rede toda (sem unidade) continua só do administrador.
--
-- 3. FRACIONAR PLANTÃO. A versão antiga criava as partes com perfil nulo (a
--    coluna é NOT NULL: nunca funcionou) e copiava o horário inteiro. Agora a
--    JANELA do plantão (inicio + duracao_min) é dividida em 2 a 4 partes
--    iguais. A 1ª parte é o PRÓPRIO registro, encurtado: o check-in, a
--    presença e o histórico já ligados a ele continuam valendo. As demais
--    viram VAGAS MARCADAS (escala_vagas, com a janela da parte e o plantão de
--    origem) e avisam os plantonistas da unidade. A candidatura à parte leva a
--    vaga (candidaturas_escala.vaga_id); aprovada, vira um plantão com a
--    janela da parte e a vaga fecha. Quem fraciona: o plantonista escalado ou
--    o gestor (como antes). Desfazer: só o gestor, e só enquanto nenhuma parte
--    foi assumida.
--    Para caber no modelo de turno como janela (ADR 0003), a parte de
--    plantão fracionado guarda a própria janela: o gatilho escala_janela não
--    recalcula o início dela e a duração pode ser de 60 a 720 minutos.
--
-- SECURITY DEFINER, search_path vazio, segundo fator nas escritas do gestor.
-- Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. limites da unidade ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.config_unidade_int(p_unidade uuid, p_chave text, p_padrao int, p_min int, p_max int)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT CASE WHEN btrim(c.valor) ~ '^\d{1,6}$' AND btrim(c.valor)::int BETWEEN p_min AND p_max THEN btrim(c.valor)::int END
      FROM public.configuracoes_unidade c
     WHERE c.unidade_id = p_unidade AND c.chave = p_chave), p_padrao)
$$;

CREATE OR REPLACE FUNCTION private.limites_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'descanso_ativo', coalesce((SELECT lower(btrim(c.valor)) = 'true' FROM public.configuracoes_unidade c
                                 WHERE c.unidade_id = p_unidade AND c.chave = 'descanso_minimo_ativo'), false),
    'descanso_horas', private.config_unidade_int(p_unidade, 'descanso_minimo_horas', 11, 1, 24),
    'sobrecarga_horas', private.config_unidade_int(p_unidade, 'sobrecarga_horas_7d', 60, 12, 168),
    'ocupacao_pct', private.config_unidade_int(p_unidade, 'ocupacao_limite_pct', 85, 50, 100),
    'checkin_tolerancia_min', private.config_unidade_int(p_unidade, 'checkin_tolerancia_min', 30, 0, 120),
    'atualizado_em', (SELECT max(c.updated_at) FROM public.configuracoes_unidade c
                       WHERE c.unidade_id = p_unidade
                         AND c.chave IN ('descanso_minimo_ativo', 'descanso_minimo_horas', 'sobrecarga_horas_7d',
                                         'ocupacao_limite_pct', 'checkin_tolerancia_min')))
$$;

CREATE OR REPLACE FUNCTION public.limites_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.membro_da_unidade(p_unidade) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: limites de outra unidade.';
  END IF;
  RETURN private.limites_unidade(p_unidade);
END $$;

CREATE OR REPLACE FUNCTION public.salvar_limites_unidade(
  p_unidade uuid, p_descanso_ativo boolean, p_descanso_horas int, p_sobrecarga_horas int,
  p_ocupacao_pct int, p_checkin_tolerancia_min int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  k text;
  v text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os limites são do gestor da unidade.';
  END IF;
  IF p_descanso_ativo IS NULL THEN RAISE EXCEPTION 'Diga se a unidade exige descanso mínimo.'; END IF;
  IF p_descanso_horas IS NULL OR p_descanso_horas NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'Descanso mínimo entre 1 e 24 horas.';
  END IF;
  IF p_sobrecarga_horas IS NULL OR p_sobrecarga_horas NOT BETWEEN 12 AND 168 THEN
    RAISE EXCEPTION 'Limite de sobrecarga entre 12 e 168 horas em 7 dias.';
  END IF;
  IF p_ocupacao_pct IS NULL OR p_ocupacao_pct NOT BETWEEN 50 AND 100 THEN
    RAISE EXCEPTION 'Limite de ocupação entre 50%% e 100%%.';
  END IF;
  IF p_checkin_tolerancia_min IS NULL OR p_checkin_tolerancia_min NOT BETWEEN 0 AND 120 THEN
    RAISE EXCEPTION 'Tolerância do check-in entre 0 e 120 minutos.';
  END IF;

  FOR k, v IN SELECT * FROM (VALUES
      ('descanso_minimo_ativo', p_descanso_ativo::text),
      ('descanso_minimo_horas', p_descanso_horas::text),
      ('sobrecarga_horas_7d', p_sobrecarga_horas::text),
      ('ocupacao_limite_pct', p_ocupacao_pct::text),
      ('checkin_tolerancia_min', p_checkin_tolerancia_min::text)) x(chave, valor) LOOP
    INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
    VALUES (p_unidade, k, v, CASE k
      WHEN 'descanso_minimo_ativo' THEN 'A unidade exige descanso mínimo entre jornadas (true/false)'
      WHEN 'descanso_minimo_horas' THEN 'Descanso mínimo entre jornadas, em horas'
      WHEN 'sobrecarga_horas_7d' THEN 'Limite de horas escaladas em 7 dias (sobrecarga)'
      WHEN 'ocupacao_limite_pct' THEN 'Limite de atenção da ocupação de leitos, em %'
      ELSE 'Tolerância do check-in depois do início do plantão, em minutos' END)
    ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao, updated_at = now()
    WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
  END LOOP;

  PERFORM private.registrar_auditoria('salvar_limites_unidade', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('valores', private.limites_unidade(p_unidade)));
  RETURN private.limites_unidade(p_unidade);
END $$;

REVOKE ALL ON FUNCTION private.config_unidade_int(uuid, text, int, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.limites_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.config_unidade_int(uuid, text, int, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION private.limites_unidade(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.limites_unidade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_limites_unidade(uuid, boolean, int, int, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limites_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_limites_unidade(uuid, boolean, int, int, int, int) TO authenticated;

-- ── 2. a varredura do Gavião com os limites da unidade ──────────────────────
-- Igual à de 20261006000002, com três mudanças: a sobrecarga usa o limite da
-- unidade; o descanso só entra se a unidade o exige, com as horas dela; a
-- ocupação usa o limite de atenção da unidade.
CREATE OR REPLACE FUNCTION private.gaviao_varredura(p_unidade uuid)
RETURNS TABLE (chave text, tipo text, severidade text, titulo text, evidencia text, recomendacao text, icone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH hoje AS (SELECT private.data_atual() AS d),
  lim AS (
    SELECT (l ->> 'descanso_ativo')::boolean AS descanso_ativo, (l ->> 'descanso_horas')::int AS descanso_horas,
           (l ->> 'sobrecarga_horas')::int AS sobrecarga_horas, (l ->> 'ocupacao_pct')::int AS ocupacao_pct
      FROM private.limites_unidade(p_unidade) l
  ),
  pl AS (
    SELECT e.id, e.perfil_id, e.data, e.turno, e.inicio, e.inicio + make_interval(mins => e.duracao_min) AS fim, e.duracao_min
      FROM public.escala_plantao e, hoje
     WHERE e.unidade_id = p_unidade AND e.ativo AND e.perfil_id IS NOT NULL
       AND e.data BETWEEN hoje.d - 30 AND hoje.d + 7
  ),
  -- jornadas: os plantões do profissional fundidos no tempo (dois setores ao
  -- mesmo tempo contam uma vez; plantões emendados viram uma jornada só)
  blocos AS (
    SELECT x.perfil_id, lower(b) AS ini, upper(b) AS fim,
           (lower(b) AT TIME ZONE 'America/Sao_Paulo')::date AS dia
      FROM (SELECT pl.perfil_id, range_agg(tstzrange(pl.inicio, pl.fim)) AS m FROM pl GROUP BY pl.perfil_id) x,
           unnest(x.m) b
  ),
  -- sobrecarga: 7 dias para trás e 7 para a frente
  horas AS (
    SELECT bl.perfil_id, j.janela, sum(extract(epoch FROM bl.fim - bl.ini)) / 3600.0 AS h, count(*) AS n,
           min(bl.dia) AS de, max(bl.dia) AS ate
      FROM blocos bl, hoje,
           LATERAL (SELECT CASE WHEN bl.dia BETWEEN hoje.d - 6 AND hoje.d THEN 'ultimos'
                                WHEN bl.dia BETWEEN hoje.d + 1 AND hoje.d + 7 THEN 'proximos' END AS janela) j
     WHERE j.janela IS NOT NULL
     GROUP BY bl.perfil_id, j.janela
    HAVING sum(extract(epoch FROM bl.fim - bl.ini)) > (SELECT lim.sobrecarga_horas FROM lim) * 3600
  ),
  -- descanso: intervalo entre jornadas consecutivas do mesmo profissional,
  -- só quando a unidade exige descanso mínimo
  seq AS (
    SELECT bl.*, lead(bl.ini) OVER w AS prox_inicio
      FROM blocos bl WINDOW w AS (PARTITION BY bl.perfil_id ORDER BY bl.ini)
  ),
  descanso AS (
    SELECT s.* FROM seq s, hoje, lim
     WHERE lim.descanso_ativo
       AND s.prox_inicio IS NOT NULL AND s.prox_inicio < s.fim + make_interval(hours => lim.descanso_horas)
       AND s.dia BETWEEN hoje.d - 7 AND hoje.d + 7
  ),
  -- presença, 30 dias
  sem_escala AS (
    SELECT x.perfil_id, count(*) AS n, max(x.checkin_em) AS ultimo, (array_agg(x.id ORDER BY x.checkin_em DESC))[1] AS ultimo_id
      FROM public.presenca_plantonista x, hoje
     WHERE x.unidade_id = p_unidade AND x.checkin_em IS NOT NULL AND x.data BETWEEN hoje.d - 30 AND hoje.d
       AND NOT EXISTS (SELECT 1 FROM public.escala_plantao e
                        WHERE e.unidade_id = p_unidade AND e.ativo
                          AND (e.id = x.escala_plantao_id OR (e.perfil_id = x.perfil_id AND e.data = x.data AND e.turno = x.turno)))
     GROUP BY x.perfil_id
  ),
  ausencias AS (
    SELECT pl.perfil_id, count(DISTINCT (pl.data, pl.turno)) AS n,
           (SELECT string_agg(to_char(dd, 'DD/MM'), ', ' ORDER BY dd) FROM unnest(array_agg(DISTINCT pl.data)) dd) AS datas,
           (array_agg(pl.id ORDER BY pl.inicio DESC))[1] AS ultimo_id
      FROM pl, hoje
     WHERE pl.fim < now() AND pl.data >= hoje.d - 30
       AND NOT EXISTS (SELECT 1 FROM public.presenca_plantonista x
                        WHERE x.unidade_id = p_unidade AND x.checkin_em IS NOT NULL
                          AND (x.escala_plantao_id = pl.id
                               OR (x.perfil_id = pl.perfil_id AND x.data = pl.data AND x.turno = pl.turno)))
       AND NOT EXISTS (SELECT 1 FROM public.solicitacoes_escala so
                        WHERE so.escala_plantao_id = pl.id AND so.status = 'aprovado'
                          AND so.tipo IN ('falta', 'justificar_falta', 'passar_plantao', 'sair_fixo'))
     GROUP BY pl.perfil_id
  ),
  -- documentação, por setor
  sem_evolucao AS (
    SELECT i.setor_atual_id AS setor_id, count(*) AS n
      FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
       AND NOT private.setor_de_observacao(i.setor_atual_id)
       AND i.data_admissao < now() - interval '24 hours'
       AND NOT EXISTS (SELECT 1 FROM public.evolucoes_estruturadas ev
                        WHERE ev.internacao_id = i.id AND ev.created_at > now() - interval '24 hours')
     GROUP BY i.setor_atual_id
  ),
  -- operação
  ocupacao AS (
    SELECT s.id AS setor_id, s.nome, count(*) AS total, count(*) FILTER (WHERE l.status = 'ocupado') AS ocup
      FROM public.setores s JOIN public.leitos l ON l.setor_id = s.id AND l.ativo
     WHERE s.unidade_id = p_unidade AND s.ativo
     GROUP BY s.id, s.nome
    HAVING count(*) FILTER (WHERE l.status = 'ocupado') >= (SELECT lim.ocupacao_pct FROM lim) / 100.0 * count(*)
  ),
  obs_vencida AS (
    SELECT count(*) AS n, floor(extract(epoch FROM now() - min(pe.prazo)) / 60)::int AS min_atraso
      FROM public.pendencias pe
     WHERE pe.unidade_id = p_unidade AND pe.tipo = 'observacao' AND pe.situacao = 'aberta' AND pe.prazo < now()
    HAVING count(*) > 0
  )
  SELECT 'horas:' || h.perfil_id || ':' || h.janela || ':' || to_char(hoje.d, 'IYYY-IW'),
         'Sobrecarga', 'alta',
         pf.nome_completo || CASE h.janela WHEN 'ultimos' THEN ' acumulou ' ELSE ' está escalado(a) para ' END
           || replace(round(h.h)::text, '.', ',') || ' horas em 7 dias',
         h.n || CASE WHEN h.n = 1 THEN ' jornada' ELSE ' jornadas' END || ' nesta unidade'
           || CASE WHEN h.de = h.ate THEN ' começando em ' || to_char(h.de, 'DD/MM') ELSE ' entre ' || to_char(h.de, 'DD/MM') || ' e ' || to_char(h.ate, 'DD/MM') END
           || CASE h.janela WHEN 'ultimos' THEN ' (últimos 7 dias)' ELSE ' (próximos 7 dias)' END
           || '. Limite interno da unidade: ' || lim.sobrecarga_horas || ' horas em 7 dias.',
         CASE h.janela WHEN 'ultimos' THEN 'Evitar novos plantões extras nesta semana e rever a escala fixa.'
                       ELSE 'Redistribuir um dos plantões da semana ou abrir vaga para cobertura.' END,
         'stethoscope'
    FROM horas h JOIN public.perfis pf ON pf.id = h.perfil_id, hoje, lim
  UNION ALL
  SELECT 'descanso:' || d.perfil_id || ':' || floor(extract(epoch FROM d.fim))::bigint, 'Sobrecarga', 'media',
         pf.nome_completo || ' sem descanso de ' || lim.descanso_horas || ' horas entre jornadas',
         'Sai às ' || to_char(d.fim AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI "de" DD/MM') || ' e volta às '
           || to_char(d.prox_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI "de" DD/MM') || ': '
           || floor(extract(epoch FROM d.prox_inicio - d.fim) / 3600) || ' h '
           || lpad((floor(extract(epoch FROM d.prox_inicio - d.fim) / 60)::int % 60)::text, 2, '0') || ' min de intervalo.',
         'Ajustar a escala: a unidade exige descanso mínimo de ' || lim.descanso_horas || ' horas entre duas jornadas.',
         'clock'
    FROM descanso d JOIN public.perfis pf ON pf.id = d.perfil_id, lim
  UNION ALL
  SELECT 'sem_escala:' || x.perfil_id || ':' || x.ultimo_id, 'Presença', CASE WHEN x.n >= 3 THEN 'alta' ELSE 'media' END,
         'Check-in sem plantão na escala — ' || pf.nome_completo,
         x.n || ' check-in(s) nos últimos 30 dias sem plantão correspondente na escala; o último em '
           || to_char(x.ultimo AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') || '.',
         'Confirmar se houve troca informal não registrada e acertar a escala.',
         'map-pin'
    FROM sem_escala x JOIN public.perfis pf ON pf.id = x.perfil_id
  UNION ALL
  SELECT 'ausencia:' || a.perfil_id || ':' || a.ultimo_id, 'Presença', CASE WHEN a.n >= 2 THEN 'media' ELSE 'baixa' END,
         pf.nome_completo || ' com ' || a.n || CASE WHEN a.n = 1 THEN ' plantão' ELSE ' plantões' END || ' sem check-in no mês',
         'Plantões de ' || a.datas || ' sem check-in e sem falta ou troca aprovada.',
         'Conversar com o profissional e registrar a falta ou a troca na escala.',
         'alert-triangle'
    FROM ausencias a JOIN public.perfis pf ON pf.id = a.perfil_id
  UNION ALL
  SELECT 'evolucao:' || se.setor_id || ':' || hoje.d, 'Documentação', CASE WHEN se.n >= 5 THEN 'alta' ELSE 'media' END,
         se.n || CASE WHEN se.n = 1 THEN ' evolução em atraso' ELSE ' evoluções em atraso' END || ' — ' || s.nome,
         se.n || CASE WHEN se.n = 1 THEN ' internado há mais de 24 horas está' ELSE ' internados há mais de 24 horas estão' END
           || ' sem evolução nas últimas 24 horas.',
         'Cobrar na passagem de plantão e verificar a carga do setor.',
         'clipboard-list'
    FROM sem_evolucao se JOIN public.setores s ON s.id = se.setor_id, hoje
  UNION ALL
  SELECT 'ocupacao:' || o.setor_id || ':' || hoje.d, 'Operação',
         CASE WHEN o.ocup >= 0.95 * o.total THEN 'alta' ELSE 'media' END,
         o.nome || ' com ' || round(100.0 * o.ocup / o.total) || '% de ocupação',
         o.ocup || ' de ' || o.total || ' leitos ocupados agora. Limite de atenção da unidade: ' || lim.ocupacao_pct || '%.',
         'Avaliar altas previstas, remanejamento ou leito extra temporário.',
         'trending-up'
    FROM ocupacao o, hoje, lim
  UNION ALL
  SELECT 'observacao:' || hoje.d, 'Operação', 'alta',
         ov.n || CASE WHEN ov.n = 1 THEN ' paciente passou' ELSE ' pacientes passaram' END || ' do prazo da observação',
         'O atraso mais antigo é de ' || ov.min_atraso || ' min além do prazo.',
         'Definir conduta: internar, dar alta ou transferir.',
         'hourglass'
    FROM obs_vencida ov, hoje
  UNION ALL
  SELECT 'chronos:' || c.id, 'Escala', 'media',
         CASE c.metrica WHEN 'taxa_repasse' THEN 'Repasses' WHEN 'faltas' THEN 'Faltas'
                        WHEN 'cancelamento_tardio' THEN 'Cancelamentos tardios' WHEN 'trocas_iniciadas' THEN 'Trocas iniciadas'
                        ELSE 'Concentração de destino' END || ' fora do padrão — ' || pf.nome_completo,
         'Valor ' || replace(c.valor::text, '.', ',') || ' na janela de ' || c.janela || '; mediana da unidade '
           || replace(c.mediana_unidade::text, '.', ',') || ' (Sentinela, IQR).',
         'Conferir o histórico da escala do profissional.',
         'calendar-clock'
    FROM public.chronos_alertas_escala c JOIN public.perfis pf ON pf.id = c.medico_id
   WHERE c.unidade_id = p_unidade AND c.status IN ('novo', 'visto', 'em_acompanhamento')
$$;
REVOKE ALL ON FUNCTION private.gaviao_varredura(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. chamado técnico do gestor ────────────────────────────────────────────
-- Abrir: administrador (como antes) ou gestor da unidade do chamado. O
-- responsável é do administrador: o que o gestor mandar nesse campo é
-- ignorado. Chamado da rede toda (sem unidade) continua só do administrador.
CREATE OR REPLACE FUNCTION public.abrir_chamado_tecnico(
  p_unidade uuid, p_titulo text, p_categoria text, p_severidade text,
  p_descricao text DEFAULT NULL, p_responsavel text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org uuid;
  v_id uuid;
  v_admin boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_unidade IS NOT NULL THEN
    SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = p_unidade;
    IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  ELSE
    -- chamado da rede toda: a organização do administrador (uma só)
    SELECT min(o::text)::uuid INTO v_org FROM private.orgs_admin() o;
    IF (SELECT count(*) FROM private.orgs_admin()) > 1 THEN
      RAISE EXCEPTION 'Escolha a unidade do chamado.';
    END IF;
  END IF;
  v_admin := v_org IS NOT NULL AND private.admin_do_chamado(v_org);
  IF NOT v_admin AND NOT (p_unidade IS NOT NULL AND private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: chamado técnico é do administrador ou do gestor da unidade.';
  END IF;
  IF length(btrim(coalesce(p_titulo, ''))) < 5 THEN
    RAISE EXCEPTION 'Descreva o chamado em pelo menos 5 letras.';
  END IF;
  IF length(btrim(p_titulo)) > 140 THEN RAISE EXCEPTION 'O título tem no máximo 140 caracteres.'; END IF;
  IF p_categoria IS NULL OR p_categoria NOT IN ('servidor', 'aplicativo', 'integracao', 'seguranca') THEN
    RAISE EXCEPTION 'Escolha a categoria.';
  END IF;
  IF p_severidade IS NULL OR p_severidade NOT IN ('alta', 'media', 'baixa') THEN
    RAISE EXCEPTION 'Escolha a severidade.';
  END IF;
  INSERT INTO public.chamados_tecnicos (organizacao_id, unidade_id, titulo, descricao, categoria, severidade, responsavel, aberto_por)
  VALUES (v_org, p_unidade, btrim(p_titulo), nullif(btrim(coalesce(p_descricao, '')), ''), p_categoria, p_severidade,
          CASE WHEN v_admin THEN nullif(btrim(coalesce(p_responsavel, '')), '') END, private.meu_perfil_id())
  RETURNING id INTO v_id;
  INSERT INTO public.chamados_tecnicos_andamento (chamado_id, situacao, nota, autor_id)
  VALUES (v_id, 'aberto', nullif(btrim(coalesce(p_descricao, '')), ''), private.meu_perfil_id());
  PERFORM private.registrar_auditoria('abrir_chamado_tecnico', 'chamados_tecnicos', v_id, p_unidade,
    jsonb_build_object('categoria', p_categoria, 'severidade', p_severidade));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.abrir_chamado_tecnico(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_chamado_tecnico(uuid, text, text, text, text, text) TO authenticated;

-- quem acompanha um chamado: o administrador da organização ou, se o chamado
-- é de uma unidade, o gestor dela
CREATE OR REPLACE FUNCTION private.acompanha_chamado(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT private.admin_do_chamado(c.organizacao_id)
                          OR (c.unidade_id IS NOT NULL AND private.gestor_da_unidade(c.unidade_id))
                     FROM public.chamados_tecnicos c WHERE c.id = p_id), false)
$$;
REVOKE ALL ON FUNCTION private.acompanha_chamado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.acompanha_chamado(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.chamados_tecnicos_da_unidade(p_unidade uuid, p_incluir_resolvidos boolean DEFAULT false)
RETURNS TABLE (id uuid, unidade_id uuid, unidade_nome text, titulo text, descricao text, categoria text,
               severidade text, responsavel text, situacao text, aberto_por text, aberto_em timestamptz,
               atualizado_em timestamptz, resolvido_em timestamptz, meu boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: chamados técnicos da unidade são do gestor.';
  END IF;
  RETURN QUERY
  SELECT c.id, c.unidade_id, u.nome, c.titulo, c.descricao, c.categoria, c.severidade, c.responsavel,
         c.situacao, p.nome_completo, c.aberto_em, c.atualizado_em, c.resolvido_em, c.aberto_por = private.meu_perfil_id()
    FROM public.chamados_tecnicos c
    JOIN public.unidades u ON u.id = c.unidade_id
    LEFT JOIN public.perfis p ON p.id = c.aberto_por
   WHERE c.unidade_id = p_unidade
     AND (coalesce(p_incluir_resolvidos, false) OR c.situacao <> 'resolvido')
   ORDER BY (c.situacao = 'resolvido'), CASE c.severidade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, c.aberto_em;
END $$;
REVOKE ALL ON FUNCTION public.chamados_tecnicos_da_unidade(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamados_tecnicos_da_unidade(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.andamento_chamado_tecnico(p_id uuid)
RETURNS TABLE (id uuid, situacao text, nota text, autor text, em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.acompanha_chamado(p_id) THEN
    RAISE EXCEPTION 'Acesso negado: chamado técnico é do administrador ou do gestor da unidade.';
  END IF;
  RETURN QUERY
  SELECT a.id, a.situacao, a.nota, p.nome_completo, a.em
    FROM public.chamados_tecnicos_andamento a
    LEFT JOIN public.perfis p ON p.id = a.autor_id
   WHERE a.chamado_id = p_id
   ORDER BY a.em DESC;
END $$;
REVOKE ALL ON FUNCTION public.andamento_chamado_tecnico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.andamento_chamado_tecnico(uuid) TO authenticated;

-- Nota no andamento, sem mudar situação nem responsável (útil quando o
-- administrador deixou o chamado "aguardando a unidade").
CREATE OR REPLACE FUNCTION public.comentar_chamado_tecnico(p_id uuid, p_nota text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.chamados_tecnicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.chamados_tecnicos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT private.acompanha_chamado(p_id) THEN
    RAISE EXCEPTION 'Acesso negado: chamado técnico é do administrador ou do gestor da unidade.';
  END IF;
  IF c.situacao = 'resolvido' THEN RAISE EXCEPTION 'Este chamado já foi resolvido: abra outro se o problema voltou.'; END IF;
  IF length(btrim(coalesce(p_nota, ''))) < 3 THEN RAISE EXCEPTION 'Escreva a nota.'; END IF;
  IF length(btrim(p_nota)) > 1000 THEN RAISE EXCEPTION 'A nota tem no máximo 1000 caracteres.'; END IF;
  INSERT INTO public.chamados_tecnicos_andamento (chamado_id, situacao, nota, autor_id)
  VALUES (p_id, c.situacao, btrim(p_nota), private.meu_perfil_id());
  UPDATE public.chamados_tecnicos SET atualizado_em = now() WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.comentar_chamado_tecnico(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comentar_chamado_tecnico(uuid, text) TO authenticated;

-- ── 4. fracionar plantão ────────────────────────────────────────────────────

-- 4.1 a parte de plantão fracionado guarda a própria janela
CREATE OR REPLACE FUNCTION private.escala_janela()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.fracionado THEN
    IF TG_OP = 'UPDATE' AND (NEW.data IS DISTINCT FROM OLD.data OR NEW.turno IS DISTINCT FROM OLD.turno) THEN
      RAISE EXCEPTION 'Parte de plantão fracionado não muda de dia nem de turno: desfaça o fracionamento antes.';
    END IF;
    NEW.inicio := coalesce(NEW.inicio, private.inicio_do_turno(NEW.data, NEW.turno));
    NEW.duracao_min := coalesce(NEW.duracao_min, private.duracao_padrao(NEW.turno));
    RETURN NEW;
  END IF;
  NEW.inicio := private.inicio_do_turno(NEW.data, NEW.turno);
  NEW.duracao_min := coalesce(NEW.duracao_min, private.duracao_padrao(NEW.turno));
  IF NEW.turno IN ('manha', 'tarde', 'madrugada') AND NEW.duracao_min <> 360 THEN
    RAISE EXCEPTION 'O turno % tem 6 horas.', NEW.turno;
  END IF;
  RETURN NEW;
END; $$;

-- o gatilho passa a olhar também a marca de fracionado
DROP TRIGGER IF EXISTS trg_escala_janela ON public.escala_plantao;
CREATE TRIGGER trg_escala_janela
  BEFORE INSERT OR UPDATE OF data, turno, duracao_min, fracionado ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION private.escala_janela();

ALTER TABLE public.escala_plantao DROP CONSTRAINT IF EXISTS escala_plantao_duracao_check;
ALTER TABLE public.escala_plantao
  ADD CONSTRAINT escala_plantao_duracao_check
  CHECK (duracao_min IN (360, 720) OR (fracionado AND duracao_min BETWEEN 60 AND 720));

-- 4.2 a vaga de uma parte: a janela, a parte e o plantão de origem
ALTER TABLE public.escala_vagas
  ADD COLUMN IF NOT EXISTS inicio timestamptz,
  ADD COLUMN IF NOT EXISTS duracao_min integer,
  ADD COLUMN IF NOT EXISTS plantao_origem_id uuid REFERENCES public.escala_plantao(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parte smallint,
  ADD COLUMN IF NOT EXISTS partes smallint;
ALTER TABLE public.escala_vagas DROP CONSTRAINT IF EXISTS escala_vagas_parte_check;
ALTER TABLE public.escala_vagas ADD CONSTRAINT escala_vagas_parte_check CHECK (
  (plantao_origem_id IS NULL AND inicio IS NULL AND duracao_min IS NULL AND parte IS NULL AND partes IS NULL)
  OR (plantao_origem_id IS NOT NULL AND inicio IS NOT NULL AND duracao_min BETWEEN 60 AND 720
      AND partes BETWEEN 2 AND 4 AND parte BETWEEN 2 AND partes));
-- a marcação do gestor continua uma por faixa; as partes, uma por parte
DROP INDEX IF EXISTS public.escala_vagas_aberta;
CREATE UNIQUE INDEX escala_vagas_aberta
  ON public.escala_vagas (setor_id, data, turno) WHERE fechada_em IS NULL AND plantao_origem_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS escala_vagas_parte_aberta
  ON public.escala_vagas (plantao_origem_id, parte) WHERE fechada_em IS NULL AND plantao_origem_id IS NOT NULL;

-- a faixa mostra uma vaga só (a marcada pelo gestor primeiro), mesmo quando
-- duas partes de um plantão caem na mesma faixa
CREATE OR REPLACE FUNCTION private.escala_faixas(p_unidade uuid, p_inicio date, p_fim date)
RETURNS TABLE (data date, setor_id uuid, turno text, escalados jsonb, previsto boolean, vaga_id uuid, vaga_obs text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH faixas AS (
    SELECT d::date AS data, s.id AS setor_id, t.turno,
           private.inicio_do_turno(d::date, t.turno) AS ini,
           private.inicio_do_turno(d::date, t.turno) + make_interval(hours => t.horas) AS fim
      FROM generate_series(p_inicio, p_fim, interval '1 day') d
     CROSS JOIN public.setores s
     CROSS JOIN (VALUES ('manha', 6), ('tarde', 6), ('noite', 12)) t(turno, horas)
     WHERE s.unidade_id = p_unidade AND s.ativo
  )
  SELECT f.data, f.setor_id, f.turno,
         coalesce((SELECT jsonb_agg(jsonb_build_object('plantao_id', e.id, 'perfil_id', e.perfil_id, 'nome', p.nome_completo,
                                                       'turno', e.turno, 'duracao_min', e.duracao_min, 'quinzenal', e.quinzenal,
                                                       'rotulo', e.rotulo) ORDER BY e.inicio, p.nome_completo)
                     FROM public.escala_plantao e JOIN public.perfis p ON p.id = e.perfil_id
                    WHERE e.setor_id = f.setor_id AND e.ativo
                      AND e.inicio < f.fim AND e.inicio + make_interval(mins => e.duracao_min) > f.ini), '[]'::jsonb),
         EXISTS (SELECT 1 FROM public.escala_fixa x
                  WHERE x.setor_id = f.setor_id AND x.ativo AND x.turno = f.turno
                    AND x.dia_semana = extract(dow FROM f.data)::int),
         v.id, v.observacao
    FROM faixas f
    LEFT JOIN LATERAL (SELECT ev.id, ev.observacao FROM public.escala_vagas ev
                        WHERE ev.setor_id = f.setor_id AND ev.data = f.data AND ev.turno = f.turno AND ev.fechada_em IS NULL
                        ORDER BY (ev.plantao_origem_id IS NOT NULL), ev.inicio NULLS FIRST
                        LIMIT 1) v ON true
$$;
REVOKE ALL ON FUNCTION private.escala_faixas(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.escala_faixas(uuid, date, date) TO authenticated;

-- 4.3 a candidatura pode apontar a vaga (obrigatório para a parte)
ALTER TABLE public.candidaturas_escala
  ADD COLUMN IF NOT EXISTS vaga_id uuid REFERENCES public.escala_vagas(id) ON DELETE CASCADE;
ALTER TABLE public.candidaturas_escala DROP CONSTRAINT IF EXISTS candidaturas_escala_setor_id_data_turno_perfil_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS candidaturas_escala_faixa_perfil
  ON public.candidaturas_escala (setor_id, data, turno, perfil_id) WHERE vaga_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS candidaturas_escala_vaga_perfil
  ON public.candidaturas_escala (vaga_id, perfil_id) WHERE vaga_id IS NOT NULL;

-- a faixa (manhã, tarde, noite) em que um instante cai, contada a partir das
-- 07h do dia do plantão: a noite que passa da meia-noite continua no dia dela
CREATE OR REPLACE FUNCTION private.faixa_do_instante(p_dia date, p_instante timestamptz)
RETURNS TABLE (data date, turno text) LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH x AS (SELECT floor(extract(epoch FROM p_instante - private.inicio_do_turno(p_dia, 'manha')) / 3600)::int AS h)
  SELECT p_dia + floor(x.h / 24.0)::int,
         CASE WHEN x.h - 24 * floor(x.h / 24.0)::int < 6 THEN 'manha'
              WHEN x.h - 24 * floor(x.h / 24.0)::int < 12 THEN 'tarde' ELSE 'noite' END
    FROM x
$$;
REVOKE ALL ON FUNCTION private.faixa_do_instante(date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.faixa_do_instante(date, timestamptz) TO authenticated;

-- 4.4 fracionar
CREATE OR REPLACE FUNCTION public.fracionar_plantao(p_plantao uuid, p_partes integer DEFAULT 2)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_pl public.escala_plantao%ROWTYPE;
  v_setor text;
  v_parte int;
  v_ini timestamptz;
  v_faixa record;
  v_vaga uuid;
  v_aviso uuid;
BEGIN
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = p_plantao AND ativo FOR UPDATE;
  IF v_pl.id IS NULL THEN RAISE EXCEPTION 'Plantão não encontrado ou inativo.'; END IF;
  IF NOT (private.gestor_da_unidade(v_pl.unidade_id) OR v_pl.perfil_id = v_perfil) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o plantonista escalado ou o gestor podem fracionar.';
  END IF;
  IF p_partes IS NULL OR p_partes < 2 OR p_partes > 4 THEN
    RAISE EXCEPTION 'O número de partes deve ser entre 2 e 4.';
  END IF;
  IF v_pl.fracionado OR v_pl.plantao_origem_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este plantão já foi fracionado.';
  END IF;
  IF v_pl.duracao_min % p_partes <> 0 OR v_pl.duracao_min / p_partes < 60 THEN
    RAISE EXCEPTION 'Este plantão não se divide em % partes iguais de pelo menos 1 hora.', p_partes;
  END IF;
  IF v_pl.inicio + make_interval(mins => v_pl.duracao_min / p_partes) <= now() THEN
    RAISE EXCEPTION 'A segunda parte deste plantão já começou: não dá mais para fracionar.';
  END IF;

  SELECT nome INTO v_setor FROM public.setores WHERE id = v_pl.setor_id;

  -- 1ª parte: o próprio registro, encurtado (check-in e presença continuam nele)
  UPDATE public.escala_plantao
     SET fracionado = true, duracao_min = v_pl.duracao_min / p_partes
   WHERE id = v_pl.id;

  -- demais partes: vagas marcadas com a janela de cada uma
  FOR v_parte IN 2..p_partes LOOP
    v_ini := v_pl.inicio + make_interval(mins => (v_parte - 1) * (v_pl.duracao_min / p_partes));
    SELECT * INTO v_faixa FROM private.faixa_do_instante(v_pl.data, v_ini);
    INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, observacao, aberta_por,
                                     inicio, duracao_min, plantao_origem_id, parte, partes)
    VALUES (v_pl.unidade_id, v_pl.setor_id, v_faixa.data, v_faixa.turno,
            'Parte ' || v_parte || ' de ' || p_partes || ' do plantão de ' || to_char(v_pl.data, 'DD/MM'),
            v_perfil, v_ini, v_pl.duracao_min / p_partes, v_pl.id, v_parte, p_partes)
    RETURNING id INTO v_vaga;
    FOR v_aviso IN SELECT DISTINCT vi.perfil_id FROM public.vinculos vi
                    WHERE vi.unidade_id = v_pl.unidade_id AND vi.papel = 'plantonista' AND vi.ativo
                      AND vi.perfil_id IS DISTINCT FROM v_pl.perfil_id LOOP
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      VALUES (v_aviso, v_pl.unidade_id, v_faixa.data, 'vaga_' || v_vaga,
              'Vaga aberta em ' || coalesce(v_setor, 'setor') || ': parte ' || v_parte || ' de ' || p_partes
                || ' do plantão de ' || to_char(v_pl.data, 'DD/MM') || ', '
                || to_char(v_ini AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '–'
                || to_char((v_ini + make_interval(mins => v_pl.duracao_min / p_partes)) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
                || '. Candidate-se em Vagas.')
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
    END LOOP;
  END LOOP;

  INSERT INTO public.historico_escala (unidade_id, plantao_id, perfil_id, acao, detalhe, dados)
  VALUES (v_pl.unidade_id, v_pl.id, v_perfil, 'fracionar',
          coalesce(v_setor, 'Setor') || ' · ' || to_char(v_pl.data, 'DD/MM') || ' · ' || v_pl.turno || ' em ' || p_partes || ' partes',
          jsonb_build_object('plantao_id', v_pl.id, 'partes', p_partes, 'duracao_original_min', v_pl.duracao_min));
  RETURN p_partes;
END $$;
REVOKE ALL ON FUNCTION public.fracionar_plantao(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fracionar_plantao(uuid, integer) TO authenticated;

-- 4.5 desfazer: só o gestor, e só se nenhuma parte foi assumida
CREATE OR REPLACE FUNCTION public.remover_fracionamento(p_plantao uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_pl public.escala_plantao%ROWTYPE;
  v_partes int;
BEGIN
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = p_plantao;
  IF v_pl.id IS NULL THEN RAISE EXCEPTION 'Plantão não encontrado.'; END IF;
  IF v_pl.plantao_origem_id IS NOT NULL THEN
    SELECT * INTO v_pl FROM public.escala_plantao WHERE id = v_pl.plantao_origem_id;
  END IF;
  IF NOT private.gestor_da_unidade(v_pl.unidade_id) THEN
    RAISE EXCEPTION 'Apenas o gestor pode remover fracionamentos.';
  END IF;
  PERFORM 1 FROM public.escala_plantao WHERE id = v_pl.id FOR UPDATE;
  IF NOT v_pl.fracionado THEN RAISE EXCEPTION 'Este plantão não está fracionado.'; END IF;
  IF EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.plantao_origem_id = v_pl.id AND e.ativo) THEN
    RAISE EXCEPTION 'Uma parte já foi assumida por outro plantonista: retire esse plantão antes de desfazer o fracionamento.';
  END IF;
  SELECT max(v.partes) INTO v_partes FROM public.escala_vagas v WHERE v.plantao_origem_id = v_pl.id;
  UPDATE public.escala_vagas SET fechada_em = clock_timestamp(), fechada_por = private.meu_perfil_id()
   WHERE plantao_origem_id = v_pl.id AND fechada_em IS NULL;
  UPDATE public.candidaturas_escala SET status = 'recusado', decidido_por = private.meu_perfil_id()
   WHERE status = 'pendente' AND vaga_id IN (SELECT v.id FROM public.escala_vagas v WHERE v.plantao_origem_id = v_pl.id);
  UPDATE public.escala_plantao
     SET fracionado = false, duracao_min = v_pl.duracao_min * coalesce(v_partes, 1)
   WHERE id = v_pl.id;
  INSERT INTO public.historico_escala (unidade_id, plantao_id, perfil_id, acao, detalhe, dados)
  VALUES (v_pl.unidade_id, v_pl.id, private.meu_perfil_id(), 'remover_fracionamento',
          'Fracionamento desfeito (' || to_char(v_pl.data, 'DD/MM') || ' · ' || v_pl.turno || ')',
          jsonb_build_object('plantao_id', v_pl.id, 'partes', v_partes));
END $$;
REVOKE ALL ON FUNCTION public.remover_fracionamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remover_fracionamento(uuid) TO authenticated;

-- 4.6 candidatar-se a uma vaga marcada (parte de plantão ou faixa marcada)
CREATE OR REPLACE FUNCTION public.candidatar_vaga(p_vaga uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.escala_vagas%ROWTYPE;
  v_perfil uuid := private.meu_perfil_id();
  v_ini timestamptz;
  v_fim timestamptz;
  v_id uuid;
BEGIN
  SELECT * INTO v FROM public.escala_vagas WHERE id = p_vaga;
  IF v.id IS NULL OR private.membro_da_unidade(v.unidade_id) IS NOT TRUE THEN RAISE EXCEPTION 'Vaga não encontrada.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos vi
                  WHERE vi.perfil_id = v_perfil AND vi.unidade_id = v.unidade_id AND vi.papel = 'plantonista' AND vi.ativo) THEN
    RAISE EXCEPTION 'Só plantonista da unidade se candidata a vaga.';
  END IF;
  IF v.fechada_em IS NOT NULL THEN RAISE EXCEPTION 'Esta vaga já foi preenchida ou retirada.'; END IF;
  v_ini := coalesce(v.inicio, private.inicio_do_turno(v.data, v.turno));
  v_fim := v_ini + make_interval(mins => coalesce(v.duracao_min, private.duracao_padrao(v.turno)));
  IF v_fim <= now() THEN RAISE EXCEPTION 'Esta vaga já passou.'; END IF;
  IF v.plantao_origem_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.id = v.plantao_origem_id AND e.perfil_id = v_perfil) THEN
    RAISE EXCEPTION 'Esta parte é do seu próprio plantão.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.escala_plantao e
              WHERE e.perfil_id = v_perfil AND e.ativo
                AND e.inicio < v_fim AND e.inicio + make_interval(mins => e.duracao_min) > v_ini) THEN
    RAISE EXCEPTION 'Você já tem plantão nesse horário.';
  END IF;
  SELECT c.id INTO v_id FROM public.candidaturas_escala c WHERE c.vaga_id = v.id AND c.perfil_id = v_perfil;
  IF v_id IS NOT NULL THEN RAISE EXCEPTION 'Você já se candidatou a esta vaga.'; END IF;
  INSERT INTO public.candidaturas_escala (unidade_id, setor_id, data, turno, perfil_id, status, criado_por, vaga_id)
  VALUES (v.unidade_id, v.setor_id, v.data, v.turno, v_perfil, 'pendente', v_perfil, v.id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.candidatar_vaga(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidatar_vaga(uuid) TO authenticated;

-- vagas abertas das unidades do usuário, para a tela Vagas: as partes de
-- plantão (com a janela) e as faixas marcadas pelo gestor que ainda estão
-- sem ninguém; com a situação da minha candidatura
CREATE OR REPLACE FUNCTION public.vagas_abertas()
RETURNS TABLE (id uuid, unidade_id uuid, unidade_nome text, latitude double precision, longitude double precision,
               setor_id uuid, setor_nome text, especialidade text, data date, turno text,
               inicio timestamptz, fim timestamptz, parte smallint, partes smallint, observacao text,
               minha_candidatura text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.id, v.unidade_id, u.nome, u.latitude, u.longitude, v.setor_id, s.nome, s.especialidade, v.data, v.turno,
         j.ini, j.fim, v.parte, v.partes, v.observacao,
         (SELECT c.status FROM public.candidaturas_escala c
           WHERE c.perfil_id = private.meu_perfil_id()
             AND (c.vaga_id = v.id
                  OR (c.vaga_id IS NULL AND v.plantao_origem_id IS NULL
                      AND c.setor_id = v.setor_id AND c.data = v.data AND c.turno = v.turno))
           ORDER BY c.created_at DESC LIMIT 1)
    FROM public.escala_vagas v
    JOIN public.unidades u ON u.id = v.unidade_id
    JOIN public.setores s ON s.id = v.setor_id AND s.ativo
    CROSS JOIN LATERAL (
      SELECT coalesce(v.inicio, private.inicio_do_turno(v.data, v.turno)) AS ini,
             coalesce(v.inicio, private.inicio_do_turno(v.data, v.turno))
               + make_interval(mins => coalesce(v.duracao_min, CASE v.turno WHEN 'noite' THEN 720 ELSE 360 END)) AS fim) j
   WHERE v.fechada_em IS NULL
     AND private.membro_da_unidade(v.unidade_id)
     AND j.fim > now()
     -- a faixa marcada que já tem alguém escalado não é mais vaga
     AND (v.plantao_origem_id IS NOT NULL
          OR NOT EXISTS (SELECT 1 FROM public.escala_plantao e
                          WHERE e.setor_id = v.setor_id AND e.ativo
                            AND e.inicio < j.fim AND e.inicio + make_interval(mins => e.duracao_min) > j.ini))
   ORDER BY j.ini, s.nome
$$;
REVOKE ALL ON FUNCTION public.vagas_abertas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vagas_abertas() TO authenticated;

-- 4.7 aprovar: a candidatura à vaga de uma parte vira plantão com a janela da
-- parte; a vaga fecha e as outras candidaturas a ela são recusadas
CREATE OR REPLACE FUNCTION public.aprovar_candidatura(p_candidatura uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_candidatura public.candidaturas_escala%ROWTYPE;
  v_vaga public.escala_vagas%ROWTYPE;
  v_orig public.escala_plantao%ROWTYPE;
  v_plantao uuid;
BEGIN
  SELECT * INTO v_candidatura
  FROM public.candidaturas_escala
  WHERE id = p_candidatura
  FOR UPDATE;

  IF v_candidatura.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  IF (private.eh_super_admin() OR private.papel_na_unidade(v_candidatura.unidade_id) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor da unidade aprova candidaturas.';
  END IF;
  IF v_candidatura.perfil_id = private.meu_perfil_id() AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Ninguém aprova a própria candidatura.';
  END IF;
  IF v_candidatura.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta candidatura já foi decidida.';
  END IF;

  IF v_candidatura.vaga_id IS NOT NULL THEN
    SELECT * INTO v_vaga FROM public.escala_vagas WHERE id = v_candidatura.vaga_id FOR UPDATE;
    IF v_vaga.fechada_em IS NOT NULL THEN
      RAISE EXCEPTION 'Esta vaga já foi preenchida ou retirada.';
    END IF;
  END IF;

  IF v_vaga.plantao_origem_id IS NOT NULL THEN
    -- parte de plantão fracionado
    SELECT * INTO v_orig FROM public.escala_plantao WHERE id = v_vaga.plantao_origem_id;
    IF v_orig.id IS NULL OR NOT v_orig.ativo THEN
      RAISE EXCEPTION 'O plantão desta parte não está mais na escala.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.escala_plantao e
                WHERE e.perfil_id = v_candidatura.perfil_id AND e.ativo
                  AND e.inicio < v_vaga.inicio + make_interval(mins => v_vaga.duracao_min)
                  AND e.inicio + make_interval(mins => e.duracao_min) > v_vaga.inicio) THEN
      RAISE EXCEPTION 'O candidato já tem plantão nesse horário.';
    END IF;
    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, rotulo,
                                       quinzenal, fracionado, plantao_origem_id, ativo, criado_por)
    VALUES (v_orig.unidade_id, v_orig.setor_id, v_candidatura.perfil_id, v_orig.data, v_orig.turno,
            v_vaga.inicio, v_vaga.duracao_min, 'Parte ' || v_vaga.parte || '/' || v_vaga.partes,
            false, true, v_orig.id, true, auth.uid())
    RETURNING id INTO v_plantao;
  ELSE
    SELECT e.id INTO v_plantao
    FROM public.escala_plantao e
    WHERE e.setor_id = v_candidatura.setor_id
      AND e.data = v_candidatura.data
      AND e.turno = v_candidatura.turno
      AND e.ativo
    LIMIT 1;

    IF v_plantao IS NOT NULL THEN
      RAISE EXCEPTION 'Este plantão já foi preenchido por outro plantonista.';
    END IF;

    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, ativo, criado_por)
    VALUES (v_candidatura.unidade_id, v_candidatura.setor_id, v_candidatura.perfil_id,
            v_candidatura.data, v_candidatura.turno, true, auth.uid())
    RETURNING id INTO v_plantao;
  END IF;

  UPDATE public.candidaturas_escala
  SET status = 'aprovado', decidido_por = auth.uid()
  WHERE id = p_candidatura;

  IF v_vaga.id IS NOT NULL THEN
    UPDATE public.escala_vagas SET fechada_em = clock_timestamp(), fechada_por = private.meu_perfil_id() WHERE id = v_vaga.id;
    UPDATE public.candidaturas_escala SET status = 'recusado', decidido_por = auth.uid()
     WHERE vaga_id = v_vaga.id AND status = 'pendente' AND id <> p_candidatura;
  END IF;

  RETURN v_plantao;
END;
$$;
REVOKE ALL ON FUNCTION public.aprovar_candidatura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_candidatura(uuid) TO authenticated;

-- ── 5. a pergunta sobre a gestão e o mapa de leitos com os limites ──────────
-- Iguais às de 20261006000001 e 20261007000001, trocando só os números fixos
-- (60 horas; 85%) pelos limites da unidade.
CREATE OR REPLACE FUNCTION public.perguntar_gestao(p_unidade uuid, p_pergunta text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  q text := translate(lower(btrim(coalesce(p_pergunta, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_hoje date := private.data_atual();
  n jsonb;
  itens jsonb;
  v_media numeric;
  v_taxa numeric;
  v_limite int := (private.limites_unidade(p_unidade) ->> 'sobrecarga_horas')::int;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a pergunta sobre a gestão é do gestor da unidade.';
  END IF;
  IF length(q) < 3 THEN RAISE EXCEPTION 'Escreva a pergunta.'; END IF;
  IF length(q) > 300 THEN RAISE EXCEPTION 'A pergunta tem no máximo 300 caracteres.'; END IF;

  n := public.panorama_gestor(p_unidade) -> 'n';

  -- check-in e presença
  IF q ~ '(check|presenc|atras|raio|chegou|chegad)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', a.nome || coalesce(' · ' || a.setor, ''),
             'valor', CASE a.situacao WHEN 'sem_checkin' THEN 'sem check-in' WHEN 'sem_escala' THEN 'check-in sem plantão na escala'
                        WHEN 'atraso' THEN 'atraso de ' || a.diferenca_min || ' min' WHEN 'fora_do_raio' THEN 'fora do raio'
                        ELSE 'atraso de ' || a.diferenca_min || ' min e fora do raio' END) ORDER BY a.previsto NULLS LAST), '[]'::jsonb)
      INTO itens FROM public.auditoria_checkin(p_unidade, v_hoje) a WHERE a.divergente;
    RETURN jsonb_build_object('entendida', true, 'tema', 'checkin', 'titulo', 'Check-in de hoje',
      'resposta', (n ->> 'checkin_divergentes') || ' de ' || (n ->> 'checkin_total') || ' com divergência hoje: '
        || (n ->> 'checkin_atrasos') || ' com atraso, ' || (n ->> 'checkin_fora_do_raio') || ' fora do raio, '
        || (n ->> 'sem_checkin') || ' sem check-in e ' || (n ->> 'checkin_sem_escala') || ' sem plantão na escala.',
      'itens', itens, 'link', '/gestao');
  END IF;

  -- ocupação
  IF q ~ '(ocupa|leito|lotad|lotac|censo|vaga de intern)' THEN
    v_taxa := CASE WHEN (n ->> 'leitos')::int > 0 THEN round(100.0 * (n ->> 'leitos_ocupados')::int / (n ->> 'leitos')::int) END;
    SELECT round(avg(c.taxa_ocupacao), 1) INTO v_media FROM public.censo_ocupacao c
     WHERE c.unidade_id = p_unidade AND c.data >= v_hoje - 30 AND c.taxa_ocupacao IS NOT NULL;
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.nome, 'valor', x.ocup || ' de ' || x.total || ' leitos') ORDER BY x.ordem, x.nome), '[]'::jsonb)
      INTO itens FROM (
        SELECT s.nome, s.ordem, count(*) FILTER (WHERE l.status = 'ocupado') AS ocup, count(*) AS total
          FROM public.setores s JOIN public.leitos l ON l.setor_id = s.id AND l.ativo
         WHERE s.unidade_id = p_unidade AND s.ativo GROUP BY s.id, s.nome, s.ordem) x;
    RETURN jsonb_build_object('entendida', true, 'tema', 'ocupacao', 'titulo', 'Ocupação de leitos',
      'resposta', 'Agora: ' || coalesce(v_taxa || '%', 'sem leito ativo') || ' (' || (n ->> 'leitos_ocupados') || ' de ' || (n ->> 'leitos') || ' leitos). '
        || CASE WHEN v_media IS NULL THEN 'Não há censo gravado nos últimos 30 dias para dar a média do mês.'
                ELSE 'Média dos censos gravados nos últimos 30 dias: ' || replace(v_media::text, '.', ',') || '%.' END,
      'itens', itens, 'link', '/indicadores');
  END IF;

  -- farmácia
  IF q ~ '(medicament|falt|estoque|farmac|remedio|repor)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', m.principio_ativo || coalesce(' ' || m.apresentacao, ''),
             'valor', 'saldo ' || trim(to_char(em.quantidade, 'FM999999990.##'), '.')
                      || CASE WHEN em.limite_falta IS NOT NULL AND em.quantidade <= em.limite_falta THEN ' · em falta' ELSE ' · crítico' END)
             ORDER BY em.quantidade), '[]'::jsonb)
      INTO itens FROM public.estoque_medicamento em JOIN public.medicamento m ON m.id = em.medicamento_id
     WHERE em.unidade_id = p_unidade AND em.limite_critico IS NOT NULL AND em.quantidade <= em.limite_critico;
    RETURN jsonb_build_object('entendida', true, 'tema', 'farmacia', 'titulo', 'Estoque e faltas',
      'resposta', (n ->> 'estoque_critico') || ' item(ns) no limite crítico ou abaixo, ' || (n ->> 'estoque_falta')
        || ' no limite de falta, e ' || (n ->> 'faltas_abertas') || ' falta(s) sinalizada(s) ainda sem reposição. '
        || 'O saldo e os limites são os que a farmácia registrou; a previsão de consumo não está no banco.',
      'itens', itens, 'link', NULL);
  END IF;

  -- alta, permanência e giro
  IF q ~ '(\malta|gargal|permanen|giro|desospital)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.nome,
             'valor', x.n || ' internado(s) · permanência atual média de ' || replace(x.dias::text, '.', ',') || ' dia(s)') ORDER BY x.dias DESC), '[]'::jsonb)
      INTO itens FROM (
        SELECT s.nome, count(*) AS n, round(avg(extract(epoch FROM now() - i.data_admissao) / 86400)::numeric, 1) AS dias
          FROM private.internacao_ativa_fora_observacao(p_unidade) i JOIN public.setores s ON s.id = i.setor_atual_id
         WHERE i.data_admissao IS NOT NULL GROUP BY s.id, s.nome) x;
    RETURN jsonb_build_object('entendida', true, 'tema', 'alta', 'titulo', 'Altas e permanência',
      'resposta', coalesce('Permanência média de ' || replace((n ->> 'permanencia_media_d'), '.', ',') || ' dia(s) nas altas dos últimos 30 dias. ',
                           'Sem alta de internação nos últimos 30 dias. ')
        || (n ->> 'altas_7d') || ' alta(s) e ' || (n ->> 'admissoes_7d') || ' admissão(ões) em 7 dias; '
        || (n ->> 'obs_acima_prazo') || ' paciente(s) passaram do prazo da observação. Por setor, a permanência de quem está internado agora:',
      'itens', itens, 'link', '/internacao');
  END IF;

  -- carga de plantões
  IF q ~ '(plant|limite|carga|hora|sobrecarg|escala|cansad|descanso)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.nome,
             'valor', replace(round(x.horas, 1)::text, '.', ',') || ' h em ' || x.n || ' plantão(ões)'
                      || CASE WHEN x.horas > v_limite THEN ' · acima de ' || v_limite || ' h' ELSE '' END) ORDER BY x.horas DESC), '[]'::jsonb)
      INTO itens FROM (
        SELECT pf.nome_completo AS nome, sum(e.duracao_min) / 60.0 AS horas, count(*) AS n
          FROM public.escala_plantao e JOIN public.perfis pf ON pf.id = e.perfil_id
         WHERE e.unidade_id = p_unidade AND e.ativo AND e.data BETWEEN v_hoje - 6 AND v_hoje
         GROUP BY pf.id, pf.nome_completo
         ORDER BY sum(e.duracao_min) DESC LIMIT 8) x;
    RETURN jsonb_build_object('entendida', true, 'tema', 'carga', 'titulo', 'Carga de plantões nos últimos 7 dias',
      'resposta', 'Horas escaladas por profissional nesta unidade de ' || to_char(v_hoje - 6, 'DD/MM') || ' a ' || to_char(v_hoje, 'DD/MM')
        || '. O limite interno da unidade é ' || v_limite || ' horas em 7 dias; outras unidades não entram na conta.',
      'itens', itens, 'link', '/gestao/gaviao');
  END IF;

  -- porta e observação
  IF q ~ '(porta|espera|triag|fila|observa|atendiment|evas)' THEN
    RETURN jsonb_build_object('entendida', true, 'tema', 'porta', 'titulo', 'Porta e observação',
      'resposta', (n ->> 'porta_agora') || ' na porta agora' || coalesce(', espera média de ' || (n ->> 'espera_media_min') || ' min', '')
        || coalesce(' (a mais longa, ' || (n ->> 'espera_max_min') || ' min)', '') || '. '
        || (n ->> 'em_observacao') || ' em observação, ' || (n ->> 'obs_acima_prazo') || ' acima do prazo. '
        || (n ->> 'atendimentos_7d') || ' chegadas e ' || (n ->> 'evasoes_7d') || ' evasão(ões) em 7 dias.',
      'itens', '[]'::jsonb, 'link', '/observacao');
  END IF;

  RETURN jsonb_build_object('entendida', false, 'tema', NULL, 'titulo', 'Ainda sem resposta para isso',
    'resposta', 'Esta pergunta ainda não tem consulta no banco da unidade. Hoje respondo sobre ocupação, carga de plantões, altas e permanência, estoque e faltas, check-in e porta. Se é algo que você quer acompanhar, peça como medida em Indicadores.',
    'itens', '[]'::jsonb, 'link', '/indicadores');
END $$;
REVOKE ALL ON FUNCTION public.perguntar_gestao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perguntar_gestao(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mapa_leitos_gestor(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: tela do gestor da unidade.';
  END IF;

  WITH ativas AS (
    SELECT i.id, i.paciente_id, i.setor_atual_id AS setor_id, i.leito_atual_id AS leito_id,
           coalesce(i.data_entrada_setor, i.data_admissao) AS desde
      FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.data_alta IS NULL AND i.status IN ('internado', 'em_observacao')
  ), vencidas AS (
    SELECT pe.internacao_id, pe.descricao, pe.tipo, pe.prazo
      FROM public.pendencias pe
     WHERE pe.unidade_id = p_unidade AND pe.situacao = 'aberta' AND pe.prazo IS NOT NULL AND pe.prazo < now()
  ), escores AS (
    SELECT DISTINCT ON (a.paciente_id) a.paciente_id, a.escala, a.total, a.banda, a.aferido_em
      FROM public.acuidade_afericoes a
     WHERE a.unidade_id = p_unidade AND a.aferido_em > now() - interval '24 hours'
     ORDER BY a.paciente_id, a.aferido_em DESC
  ), setores AS (
    SELECT s.id, s.nome, s.tipo::text AS tipo, s.ordem
      FROM public.setores s
     WHERE s.unidade_id = p_unidade AND s.ativo AND s.tipo IN ('internacao', 'observacao')
  ), leitos AS (
    SELECT l.id, l.setor_id, l.identificador, l.status::text AS status, at.id AS internacao_id, at.paciente_id, at.desde
      FROM public.leitos l
      JOIN setores s ON s.id = l.setor_id
      LEFT JOIN ativas at ON at.leito_id = l.id
     WHERE l.ativo
  )
  SELECT jsonb_build_object(
    'gerado_em', now(),
    'limite', (private.limites_unidade(p_unidade) ->> 'ocupacao_pct')::numeric / 100,
    'setores', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id, 'nome', s.nome, 'tipo', s.tipo,
               'leitos_total', (SELECT count(*) FROM leitos l WHERE l.setor_id = s.id),
               'leitos_ocupados', (SELECT count(*) FROM leitos l WHERE l.setor_id = s.id AND (l.status = 'ocupado' OR l.internacao_id IS NOT NULL)),
               'pacientes', (SELECT count(*) FROM ativas a WHERE a.setor_id = s.id),
               'sem_leito', (SELECT count(*) FROM ativas a WHERE a.setor_id = s.id AND a.leito_id IS NULL),
               'leitos', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                     'id', l.id, 'identificador', l.identificador, 'status', l.status,
                                     'ocupado', l.status = 'ocupado' OR l.internacao_id IS NOT NULL,
                                     'internacao_id', l.internacao_id, 'paciente_id', l.paciente_id, 'desde', l.desde,
                                     'vencidas', (SELECT count(*) FROM vencidas vv WHERE vv.internacao_id = l.internacao_id),
                                     'banda', (SELECT e.banda FROM escores e WHERE e.paciente_id = l.paciente_id))
                                   ORDER BY l.identificador)
                                   FROM leitos l WHERE l.setor_id = s.id), '[]'::jsonb))
             ORDER BY s.ordem, s.nome)
        FROM setores s), '[]'::jsonb),
    -- quem está escalado agora nos setores de internação e observação, e
    -- quantos pacientes ativos o setor tem
    'plantonistas', coalesce((
      SELECT jsonb_agg(x ORDER BY (x ->> 'pacientes')::int DESC, x ->> 'nome')
        FROM (SELECT DISTINCT ON (e.perfil_id, e.setor_id)
                     jsonb_build_object('perfil_id', e.perfil_id, 'nome', p.nome_completo, 'setor', s.nome,
                                        'ate', e.inicio + make_interval(mins => e.duracao_min),
                                        'pacientes', (SELECT count(*) FROM ativas a WHERE a.setor_id = e.setor_id)) AS x
                FROM public.escala_plantao e
                JOIN setores s ON s.id = e.setor_id
                JOIN public.perfis p ON p.id = e.perfil_id
                JOIN public.vinculos vi ON vi.perfil_id = e.perfil_id AND vi.unidade_id = p_unidade AND vi.ativo AND vi.papel = 'plantonista'
               WHERE e.ativo AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
               ORDER BY e.perfil_id, e.setor_id) q), '[]'::jsonb),
    'alertas', coalesce((
      SELECT jsonb_agg(al ORDER BY (al ->> 'ordem')::int, al ->> 'leito')
        FROM (
          SELECT jsonb_build_object('ordem', 0, 'leito', coalesce(l.identificador, 'sem leito'), 'setor', s.nome,
                                    'internacao_id', a.id, 'paciente_id', a.paciente_id,
                                    'texto', vv.descricao, 'nota', vv.tipo, 'prazo', vv.prazo, 'selo', 'Vencida') AS al
            FROM vencidas vv
            JOIN ativas a ON a.id = vv.internacao_id
            JOIN setores s ON s.id = a.setor_id
            LEFT JOIN public.leitos l ON l.id = a.leito_id
          UNION ALL
          SELECT jsonb_build_object('ordem', CASE WHEN e.banda = 2 THEN 1 ELSE 2 END,
                                    'leito', coalesce(l.identificador, 'sem leito'), 'setor', s.nome,
                                    'internacao_id', a.id, 'paciente_id', a.paciente_id,
                                    'texto', e.escala || ' ' || e.total, 'nota', 'aferido em ' || to_char(e.aferido_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
                                    'selo', CASE WHEN e.banda = 2 THEN 'Escore alto' ELSE 'Escore médio' END)
            FROM escores e
            JOIN ativas a ON a.paciente_id = e.paciente_id
            JOIN setores s ON s.id = a.setor_id
            LEFT JOIN public.leitos l ON l.id = a.leito_id
           WHERE e.banda >= 1) z), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.mapa_leitos_gestor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mapa_leitos_gestor(uuid) TO authenticated;
