-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 8 — Olho de Gavião do gestor, com decisões
-- (P/index.html 7023–7117; valsGaviao 22054–22140).
--
-- O protótipo tinha seis apontamentos fixos e o registro das decisões no
-- estado da tela. Aqui os apontamentos saem de uma VARREDURA feita na hora,
-- sobre os dados da unidade, e a decisão do gestor fica em gaviao_decisoes,
-- com autor, hora e motivo, sem apagar.
--
-- Regras da varredura (operacionais, não clínicas):
--  * SOBRECARGA — horas escaladas NESTA unidade acima de 60 horas em 7 dias
--    corridos (os últimos 7 dias; e, separado, os próximos 7). 60 horas é o
--    "limite interno" do protótipo; vira configuração da unidade quando houver
--    a tela. Outras unidades não entram na conta (o banco não cruza vínculos
--    de organizações diferentes).
--  * DESCANSO — menos de 11 horas entre o fim de um plantão e o início do
--    seguinte do mesmo profissional, nos últimos 7 e nos próximos 7 dias.
--    11 horas é o descanso mínimo entre duas jornadas da CLT (Decreto-Lei
--    5.452/1943, art. 66). Plantões emendados (intervalo zero) contam como
--    jornada contínua e não entram aqui.
--  * PRESENÇA — check-in sem plantão na escala (30 dias) e plantão que passou
--    sem check-in (30 dias, fora os que têm falta ou justificativa aprovada).
--  * DOCUMENTAÇÃO — internado há mais de 24 horas sem evolução nas últimas 24
--    horas, contado por setor (sem nome de paciente).
--  * OPERAÇÃO — setor com 85% ou mais dos leitos ocupados agora (o limite dos
--    Indicadores); observação com o prazo vencido (a pendência do sistema).
--  * ESCALA — os alertas do Sentinela (chronos_alertas_escala) da unidade.
--
-- Cada apontamento tem uma CHAVE estável enquanto a situação é a mesma (o
-- profissional e a semana; o par de plantões; o setor e o dia). A decisão vale
-- para a chave: "tratado" e "descartado" ficam; "silenciado" vale 7 dias e
-- depois o apontamento volta aberto. Descartar exige motivo. O desfazer é do
-- autor, em até 10 minutos, e marca a decisão como desfeita (não apaga).
--
-- Acesso: gestor da unidade, com segundo fator. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gaviao_decisoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  chave           text NOT NULL CHECK (length(chave) BETWEEN 3 AND 200),
  titulo          text NOT NULL,
  tipo            text NOT NULL,
  severidade      text NOT NULL CHECK (severidade IN ('alta', 'media', 'baixa')),
  decisao         text NOT NULL CHECK (decisao IN ('tratado', 'silenciado', 'descartado')),
  motivo          text CHECK (motivo IS NULL OR length(motivo) <= 300),
  silenciado_ate  timestamptz,
  autor_id        uuid NOT NULL REFERENCES public.perfis(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  desfeita_em     timestamptz,
  CONSTRAINT gaviao_descartar_com_motivo CHECK (decisao <> 'descartado' OR length(btrim(coalesce(motivo, ''))) >= 3),
  CONSTRAINT gaviao_silencio_com_prazo CHECK ((decisao = 'silenciado') = (silenciado_ate IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS gaviao_decisoes_chave_idx ON public.gaviao_decisoes (unidade_id, chave, criado_em DESC);
ALTER TABLE public.gaviao_decisoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gaviao_decisoes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.gaviao_decisoes FROM authenticated;
GRANT SELECT ON public.gaviao_decisoes TO authenticated;
DROP POLICY IF EXISTS gaviao_decisoes_select ON public.gaviao_decisoes;
CREATE POLICY gaviao_decisoes_select ON public.gaviao_decisoes FOR SELECT TO authenticated
  USING (private.gestor_da_unidade(unidade_id));
DROP POLICY IF EXISTS gaviao_decisoes_segundo_fator ON public.gaviao_decisoes;
CREATE POLICY gaviao_decisoes_segundo_fator ON public.gaviao_decisoes AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());

-- ── a varredura ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.gaviao_varredura(p_unidade uuid)
RETURNS TABLE (chave text, tipo text, severidade text, titulo text, evidencia text, recomendacao text, icone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH hoje AS (SELECT private.data_atual() AS d),
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
    HAVING sum(extract(epoch FROM bl.fim - bl.ini)) > 60 * 3600
  ),
  -- descanso: intervalo entre jornadas consecutivas do mesmo profissional
  seq AS (
    SELECT bl.*, lead(bl.ini) OVER w AS prox_inicio
      FROM blocos bl WINDOW w AS (PARTITION BY bl.perfil_id ORDER BY bl.ini)
  ),
  descanso AS (
    SELECT s.* FROM seq s, hoje
     WHERE s.prox_inicio IS NOT NULL AND s.prox_inicio < s.fim + interval '11 hours'
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
    HAVING count(*) FILTER (WHERE l.status = 'ocupado') >= 0.85 * count(*)
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
           || '. Limite interno: 60 horas em 7 dias.',
         CASE h.janela WHEN 'ultimos' THEN 'Evitar novos plantões extras nesta semana e rever a escala fixa.'
                       ELSE 'Redistribuir um dos plantões da semana ou abrir vaga para cobertura.' END,
         'stethoscope'
    FROM horas h JOIN public.perfis pf ON pf.id = h.perfil_id, hoje
  UNION ALL
  SELECT 'descanso:' || d.perfil_id || ':' || floor(extract(epoch FROM d.fim))::bigint, 'Sobrecarga', 'media',
         pf.nome_completo || ' sem descanso de 11 horas entre jornadas',
         'Sai às ' || to_char(d.fim AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI "de" DD/MM') || ' e volta às '
           || to_char(d.prox_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI "de" DD/MM') || ': '
           || floor(extract(epoch FROM d.prox_inicio - d.fim) / 3600) || ' h '
           || lpad((floor(extract(epoch FROM d.prox_inicio - d.fim) / 60)::int % 60)::text, 2, '0') || ' min de intervalo.',
         'Ajustar a escala: o descanso mínimo entre duas jornadas é de 11 horas (CLT, art. 66).',
         'clock'
    FROM descanso d JOIN public.perfis pf ON pf.id = d.perfil_id
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
         o.ocup || ' de ' || o.total || ' leitos ocupados agora. Limite de atenção: 85%.',
         'Avaliar altas previstas, remanejamento ou leito extra temporário.',
         'trending-up'
    FROM ocupacao o, hoje
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

-- decisão vigente da chave: a mais recente não desfeita, e o silêncio só no prazo
CREATE OR REPLACE FUNCTION private.gaviao_decisao_vigente(p_unidade uuid, p_chave text)
RETURNS public.gaviao_decisoes
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.* FROM public.gaviao_decisoes d
   WHERE d.unidade_id = p_unidade AND d.chave = p_chave AND d.desfeita_em IS NULL
     AND (d.decisao <> 'silenciado' OR d.silenciado_ate > now())
   ORDER BY d.criado_em DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.gaviao_apontamentos(p_unidade uuid)
RETURNS TABLE (chave text, tipo text, severidade text, titulo text, evidencia text, recomendacao text, icone text,
               decisao_id uuid, decisao text, motivo text, decidido_em timestamptz, decidido_por text, silenciado_ate timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o Olho de Gavião é do gestor da unidade.';
  END IF;
  RETURN QUERY
  SELECT v.chave, v.tipo, v.severidade, v.titulo, v.evidencia, v.recomendacao, v.icone,
         d.id, d.decisao, d.motivo, d.criado_em, pf.nome_completo, d.silenciado_ate
    FROM private.gaviao_varredura(p_unidade) v
    LEFT JOIN LATERAL private.gaviao_decisao_vigente(p_unidade, v.chave) d ON d.id IS NOT NULL
    LEFT JOIN public.perfis pf ON pf.id = d.autor_id
   ORDER BY (d.id IS NULL) DESC,
            CASE v.severidade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, v.tipo, v.titulo;
END $$;

CREATE OR REPLACE FUNCTION public.decidir_apontamento_gaviao(p_unidade uuid, p_chave text, p_decisao text, p_motivo text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v record;
  v_id uuid;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o Olho de Gavião é do gestor da unidade.';
  END IF;
  IF p_decisao NOT IN ('tratado', 'silenciado', 'descartado') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
  IF p_decisao = 'descartado' AND (v_motivo IS NULL OR length(v_motivo) < 3) THEN
    RAISE EXCEPTION 'Diga por que o apontamento não procede.';
  END IF;
  IF length(coalesce(v_motivo, '')) > 300 THEN RAISE EXCEPTION 'O motivo tem no máximo 300 caracteres.'; END IF;

  -- o título, o tipo e a severidade vêm da varredura, não da tela
  SELECT * INTO v FROM private.gaviao_varredura(p_unidade) x WHERE x.chave = p_chave;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este apontamento não está mais na varredura.'; END IF;
  IF (private.gaviao_decisao_vigente(p_unidade, p_chave)).id IS NOT NULL THEN
    RAISE EXCEPTION 'Este apontamento já tem decisão.';
  END IF;

  INSERT INTO public.gaviao_decisoes (unidade_id, chave, titulo, tipo, severidade, decisao, motivo, silenciado_ate, autor_id)
  VALUES (p_unidade, p_chave, v.titulo, v.tipo, v.severidade, p_decisao, v_motivo,
          CASE WHEN p_decisao = 'silenciado' THEN now() + interval '7 days' END, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.desfazer_decisao_gaviao(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.gaviao_decisoes%ROWTYPE;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.gaviao_decisoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT private.gestor_da_unidade(d.unidade_id) THEN RAISE EXCEPTION 'Decisão não encontrada.'; END IF;
  IF d.autor_id IS DISTINCT FROM private.meu_perfil_id() THEN RAISE EXCEPTION 'Só quem decidiu desfaz a decisão.'; END IF;
  IF d.desfeita_em IS NOT NULL THEN RAISE EXCEPTION 'Esta decisão já foi desfeita.'; END IF;
  IF d.criado_em < now() - interval '10 minutes' THEN RAISE EXCEPTION 'O desfazer vale por 10 minutos depois da decisão.'; END IF;
  UPDATE public.gaviao_decisoes SET desfeita_em = now() WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.gaviao_registro(p_unidade uuid)
RETURNS TABLE (id uuid, criado_em timestamptz, titulo text, tipo text, decisao text, motivo text,
               silenciado_ate timestamptz, autor_nome text, meu boolean, desfeita_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o Olho de Gavião é do gestor da unidade.';
  END IF;
  RETURN QUERY
  SELECT d.id, d.criado_em, d.titulo, d.tipo, d.decisao, d.motivo, d.silenciado_ate, pf.nome_completo,
         d.autor_id = private.meu_perfil_id(), d.desfeita_em
    FROM public.gaviao_decisoes d JOIN public.perfis pf ON pf.id = d.autor_id
   WHERE d.unidade_id = p_unidade
   ORDER BY d.criado_em DESC
   LIMIT 300;
END $$;

REVOKE ALL ON FUNCTION private.gaviao_varredura(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gaviao_decisao_vigente(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gaviao_apontamentos(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decidir_apontamento_gaviao(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.desfazer_decisao_gaviao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gaviao_registro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gaviao_apontamentos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decidir_apontamento_gaviao(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_decisao_gaviao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gaviao_registro(uuid) TO authenticated;
