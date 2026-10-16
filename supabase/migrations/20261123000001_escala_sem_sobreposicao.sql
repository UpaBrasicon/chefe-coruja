-- Portão 2, tarefa 4 (R2-07): a escala recusa sobreposição. Decisões do RT em
-- 16/10/2026 ("1b 2b 3a 4a 5a 6b"):
--
--  1b. Vale para qualquer profissional da escala (médico, enfermagem, técnico,
--      recepção...).
--  2b. Compara em todas as unidades: a mesma pessoa não fica em duas unidades
--      no mesmo horário.
--  3a. Plantões que só se encostam (um termina 19h, o outro começa 19h) passam.
--  4a. Trava no banco, em todos os caminhos que gravam escala (criar plantão,
--      gerar o mês, passar, trocar, aprovar candidatura, desfazer
--      fracionamento); a mensagem diz com qual plantão conflita.
--  5a. O que já está gravado fica como está; a trava vale daqui para a frente.
--      Levantamento de 16/10 na produção: 1.740 pares, uma só pessoa, todos
--      passados, nenhum entre unidades.
--  6b. A geração do mês grava o resto e deixa o plantão em conflito como vaga
--      aberta, avisando quais foram (gerar_escala_mensal_detalhada).
--
-- A trava é um gatilho de restrição imediato (confere ao fim de cada comando),
-- que pode ser adiado: a troca de plantão (private.aplicar_troca) grava os dois
-- lados em dois UPDATEs e, no meio, a pessoa apareceria nos dois lugares; ela
-- adia a checagem para o fim da transação.

-- o primeiro plantão ativo da pessoa que se sobrepõe ao intervalo; nulo = livre
CREATE OR REPLACE FUNCTION private.conflito_escala(p_perfil uuid, p_inicio timestamptz, p_duracao_min int, p_ignorar uuid DEFAULT NULL)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'no setor ' || coalesce(s.nome, 'sem nome') || ' (' || coalesce(u.nome, 'unidade') || ') de '
         || to_char(e.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI "de" DD/MM') || ' a '
         || to_char((e.inicio + make_interval(mins => e.duracao_min)) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI "de" DD/MM')
    FROM public.escala_plantao e
    LEFT JOIN public.setores s ON s.id = e.setor_id
    LEFT JOIN public.unidades u ON u.id = e.unidade_id
   WHERE e.perfil_id = p_perfil AND e.ativo AND e.id IS DISTINCT FROM p_ignorar
     -- 3a: encostar não é sobrepor (intervalos semiabertos)
     AND e.inicio < p_inicio + make_interval(mins => p_duracao_min)
     AND p_inicio < e.inicio + make_interval(mins => e.duracao_min)
   ORDER BY e.inicio LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.conflito_escala(uuid, timestamptz, int, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.trg_escala_sem_sobreposicao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.escala_plantao; v_conflito text;
BEGIN
  -- confere a linha como está agora (na troca, como ficou no fim da transação)
  SELECT * INTO e FROM public.escala_plantao WHERE id = NEW.id;
  IF e.id IS NULL OR NOT e.ativo OR e.perfil_id IS NULL OR e.inicio IS NULL THEN RETURN NULL; END IF;
  v_conflito := private.conflito_escala(e.perfil_id, e.inicio, e.duracao_min, e.id);
  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION 'Escala sobreposta: % já está escalado(a) %.',
      coalesce((SELECT nome_completo FROM public.perfis WHERE id = e.perfil_id), 'o profissional'), v_conflito
      USING HINT = 'escala_sobreposta';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_escala_sem_sobreposicao ON public.escala_plantao;
CREATE CONSTRAINT TRIGGER trg_escala_sem_sobreposicao
  AFTER INSERT OR UPDATE OF perfil_id, inicio, duracao_min, ativo, data, turno ON public.escala_plantao
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW WHEN (NEW.ativo AND NEW.perfil_id IS NOT NULL)
  EXECUTE FUNCTION private.trg_escala_sem_sobreposicao();

-- troca: os dois UPDATEs passam e a sobreposição é conferida no fim. Corpo
-- conferido igual no local e na produção (md5 f8638312…) em 16/10/2026; só
-- entra o SET CONSTRAINTS.
CREATE OR REPLACE FUNCTION private.aplicar_troca(p_troca public.trocas_plantao)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_a public.escala_plantao%ROWTYPE;
  v_b public.escala_plantao%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.escala_plantao WHERE id = p_troca.plantao_a_id AND ativo;
  SELECT * INTO v_b FROM public.escala_plantao WHERE id = p_troca.plantao_b_id AND ativo;
  IF v_a.id IS NULL OR v_b.id IS NULL THEN
    RAISE EXCEPTION 'Um dos plantões da troca não está mais ativo';
  END IF;

  -- conflito do B assumindo A
  IF private.tem_conflito_plantao(v_b.perfil_id, v_a.unidade_id, v_a.setor_id, v_a.data, v_a.turno, v_a.id) THEN
    RAISE EXCEPTION 'Conflito de horário: o plantonista do plantão B já tem plantão no mesmo horário';
  END IF;
  -- conflito do A assumindo B
  IF private.tem_conflito_plantao(v_a.perfil_id, v_b.unidade_id, v_b.setor_id, v_b.data, v_b.turno, v_b.id) THEN
    RAISE EXCEPTION 'Conflito de horário: o plantonista do plantão A já tem plantão no mesmo horário';
  END IF;

  -- Portão 2, tarefa 4: a sobreposição se confere com os dois lados gravados
  SET CONSTRAINTS public.trg_escala_sem_sobreposicao DEFERRED;
  UPDATE public.escala_plantao SET perfil_id = v_b.perfil_id, updated_at = now() WHERE id = v_a.id;
  UPDATE public.escala_plantao SET perfil_id = v_a.perfil_id, updated_at = now() WHERE id = v_b.id;
  SET CONSTRAINTS public.trg_escala_sem_sobreposicao IMMEDIATE;
END; $function$;

-- 6b. geração do mês: o plantão em conflito vira vaga aberta, e a resposta diz
-- quais foram. O corpo antigo de gerar_escala_mensal (conferido igual no local
-- e na produção, md5 07ccb7ad…, em 16/10/2026) está reproduzido aqui linha a
-- linha, com a checagem antes de cada inserção.
CREATE OR REPLACE FUNCTION public.gerar_escala_mensal_detalhada(p_unidade uuid, p_ano integer, p_mes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_ini date := make_date(p_ano, p_mes, 1);
  v_fim date := (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date;
  v_dia date;
  v_dow int;
  v_semana_do_mes int;
  v_count int := 0;
  v_gerados int := 0;
  v_vagas jsonb := '[]'::jsonb;
  f record;
  v_conflito text;
  v_vaga uuid;
  v_perfil uuid;
BEGIN
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor gera a escala da unidade.';
  END IF;

  FOR v_dia IN SELECT generate_series(v_ini, v_fim, interval '1 day')::date LOOP
    v_dow := EXTRACT(ISODOW FROM v_dia)::int % 7;
    v_semana_do_mes := (EXTRACT(day FROM v_dia)::int - 1) / 7;

    FOR f IN
      SELECT x.unidade_id, x.setor_id, x.perfil_id, x.turno, x.quinzenal, s.nome AS setor, pf.nome_completo AS profissional
        FROM public.escala_fixa x
        LEFT JOIN public.setores s ON s.id = x.setor_id
        LEFT JOIN public.perfis pf ON pf.id = x.perfil_id
       WHERE x.unidade_id = p_unidade
         AND x.ativo
         AND x.dia_semana = v_dow
         AND (x.quinzenal = false OR v_semana_do_mes % 2 = 0)
    LOOP
      -- já gerado antes (mesma pessoa, setor, dia e turno): nada a fazer
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.setor_id = f.setor_id AND e.data = v_dia
                              AND e.turno = f.turno AND e.perfil_id = f.perfil_id);
      v_conflito := private.conflito_escala(f.perfil_id, private.inicio_do_turno(v_dia, f.turno), private.duracao_padrao(f.turno));
      IF v_conflito IS NULL THEN
        INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, quinzenal, ativo)
        VALUES (f.unidade_id, f.setor_id, f.perfil_id, v_dia, f.turno, f.quinzenal, true)
        ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING;
        v_gerados := v_gerados + 1;
      ELSE
        -- vaga aberta no lugar, como em marcar_vaga_escala (sem duplicar se o
        -- mês for gerado de novo); os plantonistas da unidade são avisados
        IF NOT EXISTS (SELECT 1 FROM public.escala_vagas v WHERE v.setor_id = f.setor_id AND v.data = v_dia
                        AND v.turno = f.turno AND v.fechada_em IS NULL) THEN
          INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, observacao, aberta_por)
          VALUES (f.unidade_id, f.setor_id, v_dia, f.turno,
                  'Vaga aberta na geração do mês: ' || coalesce(f.profissional, 'o profissional') || ' já estava escalado(a) ' || v_conflito || '.',
                  private.meu_perfil_id())
          RETURNING id INTO v_vaga;
          FOR v_perfil IN SELECT DISTINCT vi.perfil_id FROM public.vinculos vi
                           WHERE vi.unidade_id = f.unidade_id AND vi.papel = 'plantonista' AND vi.ativo LOOP
            INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
            VALUES (v_perfil, f.unidade_id, v_dia, 'vaga_' || v_vaga,
                    'Vaga aberta em ' || coalesce(f.setor, 'setor') || ' em ' || to_char(v_dia, 'DD/MM') || ' (' || f.turno || '). Candidate-se pela escala.')
            ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
          END LOOP;
          INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
          VALUES (f.unidade_id, private.meu_perfil_id(), 'marcar_vaga',
                  coalesce(f.setor, 'setor') || ' · ' || to_char(v_dia, 'DD/MM') || ' · ' || f.turno || ' (conflito na geração do mês)',
                  jsonb_build_object('vaga_id', v_vaga, 'setor_id', f.setor_id, 'data', v_dia, 'turno', f.turno,
                                     'perfil_em_conflito', f.perfil_id, 'conflito', v_conflito));
        END IF;
        v_vagas := v_vagas || jsonb_build_object('data', v_dia, 'turno', f.turno, 'setor', f.setor,
                                                 'profissional', f.profissional, 'conflito', v_conflito);
      END IF;
    END LOOP;

    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('dias', v_count, 'gerados', v_gerados, 'vagas', v_vagas);
END;
$function$;
REVOKE ALL ON FUNCTION public.gerar_escala_mensal_detalhada(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_escala_mensal_detalhada(uuid, integer, integer) TO authenticated;

-- a versão anterior do app chama gerar_escala_mensal e espera o número de dias:
-- continua respondendo igual, com a mesma regra de conflito
CREATE OR REPLACE FUNCTION public.gerar_escala_mensal(p_unidade uuid, p_ano integer, p_mes integer)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $function$
  SELECT (public.gerar_escala_mensal_detalhada(p_unidade, p_ano, p_mes) ->> 'dias')::int
$function$;
