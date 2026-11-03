-- ════════════════════════════════════════════════════════════════════════════
-- VD6 do lote "Virada de data" (BACKLOG.md, decisão do RT em 01/11/2026, P1):
-- o fixo quinzenal (15/15) reiniciava a contagem a cada mês.
--
-- gerar_escala_mensal_detalhada escolhia as semanas do quinzenal pela semana do
-- mês, (dia - 1) / 7, e gerava nas semanas pares (dias 1–7, 15–21 e 29–31).
-- Quem caía nos dias 29–31 caía de novo nos dias 1–7 do mês seguinte: duas
-- semanas seguidas, e depois a alternância trocava de lado.
--
-- Correção (decisão do RT: calendário único): private.semana_quinzenal(dia)
-- conta as semanas de segunda a domingo a partir de uma segunda-feira fixa,
-- 03/01/2000, e diz se a semana do dia é de trabalho (as pares). Não quebra na
-- virada de mês nem de ano. Todo quinzenal trabalha nas mesmas semanas, como
-- antes. Dias antes de 2000 não ocorrem na escala.
-- Corpo de gerar_escala_mensal_detalhada copiado de
-- 20270202000003_escala_gestor_categorias.sql (md5 igual ao da produção em
-- 01/11/2026), trocada só a regra do quinzenal. gerar_escala_mensal chama esta.
-- Expand: mesma assinatura e grants. Idempotente. Sem tela.
-- Teste: supabase/tests/vd6_quinzenal_continuo.sql
--
-- Rollback: reaplicar gerar_escala_mensal_detalhada de 20270202000003 e
-- DROP FUNCTION private.semana_quinzenal(date).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.semana_quinzenal(p_dia date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $function$
  SELECT ((p_dia - date '2000-01-03') / 7) % 2 = 0
$function$;
REVOKE ALL ON FUNCTION private.semana_quinzenal(date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gerar_escala_mensal_detalhada(p_unidade uuid, p_ano integer, p_mes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_ini date := make_date(p_ano, p_mes, 1);
  v_fim date := (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date;
  v_dia date;
  v_dow int;
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

    FOR f IN
      SELECT x.unidade_id, x.setor_id, x.perfil_id, x.turno, x.quinzenal, x.papel, s.nome AS setor, pf.nome_completo AS profissional
        FROM public.escala_fixa x
        LEFT JOIN public.setores s ON s.id = x.setor_id
        LEFT JOIN public.perfis pf ON pf.id = x.perfil_id
       WHERE x.unidade_id = p_unidade
         AND x.ativo
         AND x.dia_semana = v_dow
         -- VD6: 15/15 alterna semana sim, semana não, sem reiniciar no dia 1
         AND (x.quinzenal = false OR private.semana_quinzenal(v_dia))
    LOOP
      -- já gerado antes (mesma pessoa, setor, dia e turno): nada a fazer
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.setor_id = f.setor_id AND e.data = v_dia
                              AND e.turno = f.turno AND e.perfil_id = f.perfil_id);
      v_conflito := private.conflito_escala(f.perfil_id, private.inicio_do_turno(v_dia, f.turno), private.duracao_padrao(f.turno));
      IF v_conflito IS NULL THEN
        INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, quinzenal, ativo, papel)
        VALUES (f.unidade_id, f.setor_id, f.perfil_id, v_dia, f.turno, f.quinzenal, true, f.papel)
        ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING;
        v_gerados := v_gerados + 1;
      ELSE
        -- vaga aberta no lugar, da mesma categoria, como em marcar_vaga_escala (sem
        -- duplicar se o mês for gerado de novo); quem tem o papel é avisado
        IF NOT EXISTS (SELECT 1 FROM public.escala_vagas v WHERE v.setor_id = f.setor_id AND v.data = v_dia
                        AND v.turno = f.turno AND v.fechada_em IS NULL AND v.papel IS NOT DISTINCT FROM f.papel) THEN
          INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, observacao, aberta_por, papel)
          VALUES (f.unidade_id, f.setor_id, v_dia, f.turno,
                  'Vaga aberta na geração do mês: ' || coalesce(f.profissional, 'o profissional') || ' já estava escalado(a) ' || v_conflito || '.',
                  private.meu_perfil_id(), f.papel)
          RETURNING id INTO v_vaga;
          FOR v_perfil IN SELECT DISTINCT vi.perfil_id FROM public.vinculos vi
                           WHERE vi.unidade_id = f.unidade_id AND vi.papel = coalesce(f.papel, 'plantonista') AND vi.ativo LOOP
            INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
            VALUES (v_perfil, f.unidade_id, v_dia, 'vaga_' || v_vaga,
                    'Vaga aberta em ' || coalesce(f.setor, 'setor') || ' em ' || to_char(v_dia, 'DD/MM') || ' (' || f.turno || '). Candidate-se pela escala.')
            ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
          END LOOP;
          INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
          VALUES (f.unidade_id, private.meu_perfil_id(), 'marcar_vaga',
                  coalesce(f.setor, 'setor') || ' · ' || to_char(v_dia, 'DD/MM') || ' · ' || f.turno || ' (conflito na geração do mês)',
                  jsonb_build_object('vaga_id', v_vaga, 'setor_id', f.setor_id, 'data', v_dia, 'turno', f.turno, 'papel', f.papel,
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
