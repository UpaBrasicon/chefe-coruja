-- Portão 2, tarefa 6 (R2-03, R2-04, R2-05, R2-06, R2-07, R2-08): respostas do
-- "Pergunte à IA" do gestor. Decisões do RT em 16/10/2026 ("1a 2a 3a 4a 5a 6a"):
--
--  1a. Ocupação: uma taxa só, dizendo quantos estão sem leito agora e que a
--      média do censo conta quem estava sem leito (por isso passa de 100%).
--  2a. Permanência: alta anterior à admissão fica fora da média, com aviso
--      para corrigir o registro (vale também no painel do gestor).
--  3a. Check-in: uma linha por plantão, com turno e horário.
--  4a. Farmácia: cada falta aberta pelo nome, com a data e a situação, junto
--      com o estoque crítico.
--  5a. Porta: espera acima de 24 h em dias e horas, e alerta de ficha parada
--      (possível evasão) a partir de 24 h.
--  6a. Carga: o mesmo período não conta duas vezes (união dos intervalos) e
--      a resposta avisa quando havia plantões sobrepostos.
--
-- Corpos de perguntar_gestao e panorama_gestor conferidos (md5) iguais no
-- local e na produção em 16/10/2026. perguntar_gestao é reescrita inteira;
-- em panorama_gestor só se troca o trecho da permanência (procurado sem \r).

-- 5a. minutos em texto: até 2 h em minutos; até 24 h em horas e minutos; acima, em dias e horas
CREATE OR REPLACE FUNCTION private.duracao_legivel(p_min numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_min IS NULL THEN NULL
    WHEN p_min < 120 THEN round(p_min)::int || ' min'
    WHEN p_min < 1440 THEN floor(p_min / 60)::int || ' h' || CASE WHEN round(p_min)::int % 60 > 0 THEN ' ' || round(p_min)::int % 60 || ' min' ELSE '' END
    ELSE floor(p_min / 1440)::int || ' d' || CASE WHEN floor(p_min / 60)::int % 24 > 0 THEN ' ' || floor(p_min / 60)::int % 24 || ' h' ELSE '' END
  END
$$;

-- 2a. painel do gestor: a média de permanência ignora alta anterior à admissão e conta quantas são
DO $$
DECLARE def text; antigo text; novo text;
BEGIN
  def := replace(pg_get_functiondef('public.panorama_gestor(uuid)'::regprocedure), E'\r', '');
  antigo := replace($t$    'permanencia_media_d', (SELECT round(avg(extract(epoch FROM i.data_alta - coalesce(i.internado_em, i.data_admissao)) / 86400)::numeric, 1)
                              FROM public.internacoes i WHERE i.unidade_id = p_unidade
                               AND i.data_alta > now() - interval '30 days' AND i.data_admissao IS NOT NULL
                               AND NOT private.setor_de_observacao(i.setor_atual_id)),$t$, E'\r', '');
  novo := replace($t$    -- Portão 2, tarefa 6 (R2-04): alta anterior à admissão não entra na média
    'permanencia_media_d', (SELECT round(avg(extract(epoch FROM i.data_alta - coalesce(i.internado_em, i.data_admissao)) / 86400)::numeric, 1)
                              FROM public.internacoes i WHERE i.unidade_id = p_unidade
                               AND i.data_alta > now() - interval '30 days' AND i.data_admissao IS NOT NULL
                               AND i.data_alta >= coalesce(i.internado_em, i.data_admissao)
                               AND NOT private.setor_de_observacao(i.setor_atual_id)),
    'altas_antes_da_admissao_30d', (SELECT count(*) FROM public.internacoes i WHERE i.unidade_id = p_unidade
                               AND i.data_alta > now() - interval '30 days' AND i.data_admissao IS NOT NULL
                               AND i.data_alta < coalesce(i.internado_em, i.data_admissao)
                               AND NOT private.setor_de_observacao(i.setor_atual_id)),$t$, E'\r', '');
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'panorama_gestor mudou: trecho da permanência não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

CREATE OR REPLACE FUNCTION public.perguntar_gestao(p_unidade uuid, p_pergunta text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  q text := translate(lower(btrim(coalesce(p_pergunta, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_hoje date := private.data_atual();
  n jsonb;
  itens jsonb;
  faltas jsonb;
  v_media numeric;
  v_taxa numeric;
  v_sem_leito int;
  v_paradas int;
  v_sobreposto boolean;
  v_limite int := (private.limites_unidade(p_unidade) ->> 'sobrecarga_horas')::int;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a pergunta sobre a gestão é do gestor da unidade.';
  END IF;
  IF length(q) < 3 THEN RAISE EXCEPTION 'Escreva a pergunta.'; END IF;
  IF length(q) > 300 THEN RAISE EXCEPTION 'A pergunta tem no máximo 300 caracteres.'; END IF;

  n := public.panorama_gestor(p_unidade) -> 'n';

  -- check-in e presença (3a: uma linha por plantão, com turno e horário)
  IF q ~ '(check|presenc|atras|raio|chegou|chegad)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', a.nome || coalesce(' · ' || a.setor, '')
               || coalesce(' · ' || CASE a.turno WHEN 'manha' THEN 'manhã' ELSE a.turno END, '')
               || coalesce(' (' || to_char(a.previsto AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
                           || coalesce('–' || to_char(a.fim_previsto AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), '') || ')', ''),
             'valor', CASE a.situacao WHEN 'sem_checkin' THEN 'sem check-in' WHEN 'sem_escala' THEN 'check-in sem plantão na escala'
                        WHEN 'atraso' THEN 'atraso de ' || a.diferenca_min || ' min' WHEN 'fora_do_raio' THEN 'fora do raio'
                        ELSE 'atraso de ' || a.diferenca_min || ' min e fora do raio' END) ORDER BY a.previsto NULLS LAST), '[]'::jsonb)
      INTO itens FROM public.auditoria_checkin(p_unidade, v_hoje) a WHERE a.divergente;
    RETURN jsonb_build_object('entendida', true, 'tema', 'checkin', 'titulo', 'Check-in de hoje',
      'resposta', (n ->> 'checkin_divergentes') || ' de ' || (n ->> 'checkin_total') || ' com divergência hoje: '
        || (n ->> 'checkin_atrasos') || ' com atraso, ' || (n ->> 'checkin_fora_do_raio') || ' fora do raio, '
        || (n ->> 'sem_checkin') || ' sem check-in e ' || (n ->> 'checkin_sem_escala') || ' sem plantão na escala. Cada linha é um plantão.',
      'itens', itens, 'link', '/gestao');
  END IF;

  -- ocupação (1a: diz quantos estão sem leito e o que a média do censo conta)
  IF q ~ '(ocupa|leito|lotad|lotac|censo|vaga de intern)' THEN
    v_taxa := CASE WHEN (n ->> 'leitos')::int > 0 THEN round(100.0 * (n ->> 'leitos_ocupados')::int / (n ->> 'leitos')::int) END;
    SELECT round(avg(c.taxa_ocupacao), 1) INTO v_media FROM public.censo_ocupacao c
     WHERE c.unidade_id = p_unidade AND c.data >= v_hoje - 30 AND c.taxa_ocupacao IS NOT NULL;
    SELECT count(*) INTO v_sem_leito FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado') AND i.leito_atual_id IS NULL;
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.nome, 'valor', x.ocup || ' de ' || x.total || ' leitos') ORDER BY x.ordem, x.nome), '[]'::jsonb)
      INTO itens FROM (
        SELECT s.nome, s.ordem, count(*) FILTER (WHERE l.status = 'ocupado') AS ocup, count(*) AS total
          FROM public.setores s JOIN public.leitos l ON l.setor_id = s.id AND l.ativo
         WHERE s.unidade_id = p_unidade AND s.ativo GROUP BY s.id, s.nome, s.ordem) x;
    RETURN jsonb_build_object('entendida', true, 'tema', 'ocupacao', 'titulo', 'Ocupação de leitos',
      'resposta', 'Agora: ' || coalesce(v_taxa || '%', 'sem leito ativo') || ' (' || (n ->> 'leitos_ocupados') || ' de ' || (n ->> 'leitos') || ' leitos)'
        || CASE WHEN v_sem_leito > 0 THEN ', mais ' || v_sem_leito || ' paciente(s) internado(s) ou em observação sem leito. ' ELSE '. ' END
        || CASE WHEN v_media IS NULL THEN 'Não há censo gravado nos últimos 30 dias para dar a média do mês.'
                ELSE 'Média dos censos gravados nos últimos 30 dias: ' || replace(v_media::text, '.', ',')
                     || '%. O censo conta também quem estava sem leito, por isso a média pode passar de 100%.' END,
      'itens', itens, 'link', '/indicadores');
  END IF;

  -- farmácia (4a: cada falta aberta pelo nome, com data e situação)
  IF q ~ '(medicament|falt|estoque|farmac|remedio|repor)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', m.principio_ativo || coalesce(' ' || m.apresentacao, ''),
             'valor', 'em falta desde ' || to_char(f.sinalizada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')
                      || CASE f.situacao WHEN 'em_cotacao' THEN ' · em cotação' ELSE ' · sem reposição' END)
             ORDER BY f.sinalizada_em), '[]'::jsonb)
      INTO faltas FROM public.faltas_medicamento f JOIN public.medicamento m ON m.id = f.medicamento_id
     WHERE f.unidade_id = p_unidade AND f.situacao IN ('registrada', 'em_cotacao');
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', m.principio_ativo || coalesce(' ' || m.apresentacao, ''),
             'valor', 'saldo ' || trim(to_char(em.quantidade, 'FM999999990.##'), '.')
                      || CASE WHEN em.limite_falta IS NOT NULL AND em.quantidade <= em.limite_falta THEN ' · em falta' ELSE ' · crítico' END)
             ORDER BY em.quantidade), '[]'::jsonb)
      INTO itens FROM public.estoque_medicamento em JOIN public.medicamento m ON m.id = em.medicamento_id
     WHERE em.unidade_id = p_unidade AND em.limite_critico IS NOT NULL AND em.quantidade <= em.limite_critico;
    RETURN jsonb_build_object('entendida', true, 'tema', 'farmacia', 'titulo', 'Estoque e faltas',
      'resposta', (n ->> 'faltas_abertas') || ' falta(s) sinalizada(s) ainda sem reposição'
        || CASE WHEN jsonb_array_length(faltas) > 0 THEN ' (listadas primeiro)' ELSE '' END || ', '
        || (n ->> 'estoque_critico') || ' item(ns) no limite crítico ou abaixo e ' || (n ->> 'estoque_falta')
        || ' no limite de falta. O saldo e os limites são os que a farmácia registrou; a previsão de consumo não está no banco.',
      'itens', faltas || itens, 'link', NULL);
  END IF;

  -- alta, permanência e giro (2a: alta anterior à admissão fica fora, com aviso)
  IF q ~ '(\malta|gargal|permanen|giro|desospital)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.nome,
             'valor', x.n || ' internado(s) · permanência atual média de ' || replace(x.dias::text, '.', ',') || ' dia(s)') ORDER BY x.dias DESC), '[]'::jsonb)
      INTO itens FROM (
        SELECT s.nome, count(*) AS n, round(avg(extract(epoch FROM now() - coalesce(i.internado_em, i.data_admissao)) / 86400)::numeric, 1) AS dias
          FROM private.internacao_ativa_fora_observacao(p_unidade) i JOIN public.setores s ON s.id = i.setor_atual_id
         WHERE i.data_admissao IS NOT NULL GROUP BY s.id, s.nome) x;
    RETURN jsonb_build_object('entendida', true, 'tema', 'alta', 'titulo', 'Altas e permanência',
      'resposta', coalesce('Permanência média de ' || replace((n ->> 'permanencia_media_d'), '.', ',') || ' dia(s) nas altas dos últimos 30 dias. ',
                           'Sem alta de internação nos últimos 30 dias. ')
        || CASE WHEN coalesce((n ->> 'altas_antes_da_admissao_30d')::int, 0) > 0
                THEN (n ->> 'altas_antes_da_admissao_30d') || ' internação(ões) com alta antes da admissão ficaram fora da conta; corrija o registro. '
                ELSE '' END
        || (n ->> 'altas_7d') || ' alta(s) e ' || (n ->> 'admissoes_7d') || ' admissão(ões) em 7 dias; '
        || (n ->> 'obs_acima_prazo') || ' paciente(s) passaram do prazo da observação. Por setor, a permanência de quem está internado agora:',
      'itens', itens, 'link', '/internacao');
  END IF;

  -- carga de plantões (6a: o mesmo período conta uma vez; avisa sobreposição antiga)
  IF q ~ '(plant|limite|carga|hora|sobrecarg|escala|cansad|descanso)' THEN
    WITH porpessoa AS (
      SELECT e.perfil_id, count(*) AS n, sum(e.duracao_min) / 60.0 AS soma_h,
             range_agg(tstzrange(e.inicio, e.inicio + make_interval(mins => e.duracao_min))) AS uniao
        FROM public.escala_plantao e
       WHERE e.unidade_id = p_unidade AND e.ativo AND e.data BETWEEN v_hoje - 6 AND v_hoje AND e.inicio IS NOT NULL
       GROUP BY e.perfil_id
    ), horas AS (
      SELECT pp.perfil_id, pp.n, pp.soma_h,
             (SELECT coalesce(sum(extract(epoch FROM upper(r) - lower(r))), 0) / 3600.0 FROM unnest(pp.uniao) r) AS horas
        FROM porpessoa pp
    ), top AS (
      SELECT pf.nome_completo AS nome, h.horas, h.n, h.soma_h > h.horas + 0.01 AS sobreposto
        FROM horas h JOIN public.perfis pf ON pf.id = h.perfil_id
       ORDER BY h.horas DESC LIMIT 8
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', t.nome,
             'valor', replace(round(t.horas, 1)::text, '.', ',') || ' h em ' || t.n || ' plantão(ões)'
                      || CASE WHEN t.horas > v_limite THEN ' · acima de ' || v_limite || ' h' ELSE '' END
                      || CASE WHEN t.sobreposto THEN ' · havia plantões sobrepostos (o tempo em comum contou uma vez)' ELSE '' END)
             ORDER BY t.horas DESC), '[]'::jsonb),
           coalesce(bool_or(t.sobreposto), false)
      INTO itens, v_sobreposto FROM top t;
    RETURN jsonb_build_object('entendida', true, 'tema', 'carga', 'titulo', 'Carga de plantões nos últimos 7 dias',
      'resposta', 'Horas escaladas por profissional nesta unidade de ' || to_char(v_hoje - 6, 'DD/MM') || ' a ' || to_char(v_hoje, 'DD/MM')
        || '. O limite interno da unidade é ' || v_limite || ' horas em 7 dias; outras unidades não entram na conta.'
        || CASE WHEN v_sobreposto THEN ' Havia plantões sobrepostos no período (gravados antes da trava da escala): o tempo em comum contou uma vez.' ELSE '' END,
      'itens', itens, 'link', '/gestao/gaviao');
  END IF;

  -- porta e observação (5a: acima de 24 h em dias e horas; ficha parada)
  IF q ~ '(porta|espera|triag|fila|observa|atendiment|evas)' THEN
    SELECT count(*) INTO v_paradas FROM public.episodios e
     WHERE e.unidade_id = p_unidade AND e.etapa IN ('triagem', 'atendimento') AND e.atendimento_iniciado_em IS NULL
       AND e.chegada_em < now() - interval '24 hours';
    RETURN jsonb_build_object('entendida', true, 'tema', 'porta', 'titulo', 'Porta e observação',
      'resposta', (n ->> 'porta_agora') || ' na porta agora'
        || coalesce(', espera média de ' || private.duracao_legivel((n ->> 'espera_media_min')::numeric), '')
        || coalesce(' (a mais longa, ' || private.duracao_legivel((n ->> 'espera_max_min')::numeric) || ')', '') || '. '
        || CASE WHEN v_paradas > 0
                THEN 'Atenção: ' || v_paradas || ' ficha(s) parada(s) há mais de 24 h (a mais antiga, '
                     || private.duracao_legivel((n ->> 'espera_max_min')::numeric)
                     || '): confira se o paciente ainda está na unidade (possível evasão). '
                ELSE '' END
        || (n ->> 'em_observacao') || ' em observação, ' || (n ->> 'obs_acima_prazo') || ' acima do prazo. '
        || (n ->> 'atendimentos_7d') || ' chegadas e ' || (n ->> 'evasoes_7d') || ' evasão(ões) em 7 dias.',
      'itens', '[]'::jsonb, 'link', '/observacao');
  END IF;

  RETURN jsonb_build_object('entendida', false, 'tema', NULL, 'titulo', 'Ainda sem resposta para isso',
    'resposta', 'Esta pergunta ainda não tem consulta no banco da unidade. Hoje respondo sobre ocupação, carga de plantões, altas e permanência, estoque e faltas, check-in e porta. Se é algo que você quer acompanhar, peça como medida em Indicadores.',
    'itens', '[]'::jsonb, 'link', '/indicadores');
END $function$;
