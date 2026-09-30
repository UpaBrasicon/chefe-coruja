-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 8 — Escala do gestor (P/index.html 7121–7230):
-- o mês em calendário com uma barra por setor em cada dia (coberto, vaga
-- aberta, sem plantão), o marcador de vagas do dia e "Publicar escala".
--
-- O modelo da escala continua o mesmo (ADR 0003): escala_plantao é a porta,
-- turno é início + duração, a fixa gera o mês, 15/15, fracionar, passar
-- plantão, trocas e candidaturas ficam como estão. Nada aqui muda acesso.
--
--  * SLOT: setor × dia × faixa (manhã 07–13, tarde 13–19, noite 19–07). A
--    faixa está COBERTA se algum plantão ativo do setor cruza a janela dela
--    (um plantão de 12 h diurno cobre manhã e tarde).
--  * PREVISTO: a escala fixa tem alguém naquele setor, dia da semana e faixa
--    (o 15/15 conta como previsto toda semana: na semana em que o fixo não
--    vem, a faixa precisa de outra pessoa).
--  * VAGA ABERTA: faixa prevista (ou marcada pelo gestor) sem ninguém. O
--    gestor MARCA uma vaga numa faixa que a fixa não prevê (escala_vagas);
--    a marcação avisa os plantonistas da unidade e some sozinha da contagem
--    quando alguém é escalado ali (a vaga coberta não é vaga).
--  * PUBLICAR: registra a versão do mês (só inserção), com a contagem de
--    plantões e de vagas naquele instante, entra no histórico da escala e
--    avisa quem está escalado no mês. Publicar não trava nem libera acesso:
--    a escala vale pelo que está em escala_plantao. Mudança feita depois da
--    publicação aparece como "alterada depois de publicar", até a próxima.
--
-- SECURITY DEFINER, search_path vazio, segundo fator na escrita. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── tabelas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escala_vagas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  setor_id    uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  data        date NOT NULL,
  turno       text NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
  observacao  text CHECK (observacao IS NULL OR length(observacao) <= 300),
  aberta_por  uuid NOT NULL REFERENCES public.perfis(id),
  aberta_em   timestamptz NOT NULL DEFAULT clock_timestamp(),
  fechada_por uuid REFERENCES public.perfis(id),
  fechada_em  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS escala_vagas_aberta
  ON public.escala_vagas (setor_id, data, turno) WHERE fechada_em IS NULL;
CREATE INDEX IF NOT EXISTS escala_vagas_unidade_data ON public.escala_vagas (unidade_id, data);
ALTER TABLE public.escala_vagas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.escala_vagas FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.escala_vagas FROM authenticated;
GRANT SELECT ON public.escala_vagas TO authenticated;
DROP POLICY IF EXISTS escala_vagas_select ON public.escala_vagas;
CREATE POLICY escala_vagas_select ON public.escala_vagas FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
DROP TRIGGER IF EXISTS trg_escala_vagas_sem_delete ON public.escala_vagas;
CREATE TRIGGER trg_escala_vagas_sem_delete BEFORE DELETE ON public.escala_vagas
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

CREATE TABLE IF NOT EXISTS public.escala_publicacoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  competencia   date NOT NULL CHECK (extract(day FROM competencia) = 1),
  versao        int NOT NULL CHECK (versao >= 1),
  plantoes      int NOT NULL,
  vagas         int NOT NULL,
  observacao    text CHECK (observacao IS NULL OR length(observacao) <= 500),
  publicada_por uuid NOT NULL REFERENCES public.perfis(id),
  publicada_em  timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (unidade_id, competencia, versao)
);
ALTER TABLE public.escala_publicacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.escala_publicacoes FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.escala_publicacoes FROM authenticated;
GRANT SELECT ON public.escala_publicacoes TO authenticated;
DROP POLICY IF EXISTS escala_publicacoes_select ON public.escala_publicacoes;
CREATE POLICY escala_publicacoes_select ON public.escala_publicacoes FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
DROP TRIGGER IF EXISTS trg_escala_publicacoes_so_insercao ON public.escala_publicacoes;
CREATE TRIGGER trg_escala_publicacoes_so_insercao BEFORE UPDATE OR DELETE ON public.escala_publicacoes
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

-- ── as faixas do mês ────────────────────────────────────────────────────────
-- Uma linha por setor ativo × dia × faixa, com quem cobre, se a fixa prevê e
-- a vaga marcada. Base do calendário, do detalhe do dia e da publicação.
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
    LEFT JOIN public.escala_vagas v ON v.setor_id = f.setor_id AND v.data = f.data AND v.turno = f.turno AND v.fechada_em IS NULL
$$;
REVOKE ALL ON FUNCTION private.escala_faixas(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.escala_faixas(uuid, date, date) TO authenticated;

-- ── o mês para o gestor ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.escala_mes_gestor(p_unidade uuid, p_ano int, p_mes int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ini date;
  v_fim date;
  v_pub public.escala_publicacoes;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: escala do gestor da unidade.';
  END IF;
  IF p_mes NOT BETWEEN 1 AND 12 OR p_ano NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Mês inválido.'; END IF;
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  SELECT * INTO v_pub FROM public.escala_publicacoes
   WHERE unidade_id = p_unidade AND competencia = v_ini ORDER BY versao DESC LIMIT 1;
  RETURN jsonb_build_object(
    'setores', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'tipo', s.tipo) ORDER BY s.ordem, s.nome)
                           FROM public.setores s WHERE s.unidade_id = p_unidade AND s.ativo), '[]'::jsonb),
    'faixas', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                 'data', f.data, 'setor_id', f.setor_id, 'turno', f.turno, 'escalados', f.escalados,
                                 'previsto', f.previsto, 'vaga_id', f.vaga_id, 'vaga_obs', f.vaga_obs,
                                 'situacao', CASE WHEN jsonb_array_length(f.escalados) > 0 THEN 'coberto'
                                                  WHEN f.previsto OR f.vaga_id IS NOT NULL THEN 'vaga'
                                                  ELSE 'sem_plantao' END)
                               ORDER BY f.data, f.setor_id, f.turno)
                          FROM private.escala_faixas(p_unidade, v_ini, v_fim) f), '[]'::jsonb),
    'publicacao', CASE WHEN v_pub.id IS NULL THEN NULL ELSE jsonb_build_object(
       'versao', v_pub.versao, 'publicada_em', v_pub.publicada_em, 'plantoes', v_pub.plantoes, 'vagas', v_pub.vagas,
       'publicada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = v_pub.publicada_por),
       'alteracoes_depois', (SELECT count(*) FROM public.historico_escala h
                              WHERE h.unidade_id = p_unidade AND h.created_at > v_pub.publicada_em
                                AND h.acao IN ('criar', 'alterar', 'remover')
                                AND coalesce(h.dados -> 'depois' ->> 'data', h.dados -> 'antes' ->> 'data')::date BETWEEN v_ini AND v_fim)) END);
END $$;
REVOKE ALL ON FUNCTION public.escala_mes_gestor(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escala_mes_gestor(uuid, int, int) TO authenticated;

-- ── marcar e retirar vaga ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_vaga_escala(p_setor uuid, p_data date, p_turno text, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid;
  v_setor_nome text;
  v_id uuid;
  v_perfil uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, nome INTO v_unidade, v_setor_nome FROM public.setores WHERE id = p_setor AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  IF NOT private.sou_gestor_da_unidade(v_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade marca vaga na escala.'; END IF;
  IF p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Faixa inválida: manhã, tarde ou noite.'; END IF;
  IF p_data < private.data_atual() THEN RAISE EXCEPTION 'Não se marca vaga em dia que já passou.'; END IF;
  IF EXISTS (SELECT 1 FROM private.escala_faixas(v_unidade, p_data, p_data) f
              WHERE f.setor_id = p_setor AND f.turno = p_turno AND jsonb_array_length(f.escalados) > 0) THEN
    RAISE EXCEPTION 'Esta faixa já tem plantonista escalado.';
  END IF;
  SELECT id INTO v_id FROM public.escala_vagas WHERE setor_id = p_setor AND data = p_data AND turno = p_turno AND fechada_em IS NULL;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;   -- já marcada: não duplica
  INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, observacao, aberta_por)
  VALUES (v_unidade, p_setor, p_data, p_turno, nullif(btrim(p_observacao), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  -- avisa os plantonistas da unidade (a candidatura continua pela escala)
  FOR v_perfil IN SELECT DISTINCT v.perfil_id FROM public.vinculos v
                   WHERE v.unidade_id = v_unidade AND v.papel = 'plantonista' AND v.ativo LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (v_perfil, v_unidade, p_data, 'vaga_' || v_id,
            'Vaga aberta em ' || v_setor_nome || ' em ' || to_char(p_data, 'DD/MM') || ' ('
              || CASE p_turno WHEN 'manha' THEN 'manhã' WHEN 'tarde' THEN 'tarde' ELSE 'noite' END || '). Candidate-se pela escala.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (v_unidade, private.meu_perfil_id(), 'marcar_vaga', v_setor_nome || ' · ' || to_char(p_data, 'DD/MM') || ' · ' || p_turno,
          jsonb_build_object('vaga_id', v_id, 'setor_id', p_setor, 'data', p_data, 'turno', p_turno));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.marcar_vaga_escala(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_vaga_escala(uuid, date, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirar_vaga_escala(p_vaga uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.escala_vagas;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO v FROM public.escala_vagas WHERE id = p_vaga FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Vaga não encontrada.'; END IF;
  IF NOT private.sou_gestor_da_unidade(v.unidade_id) THEN RAISE EXCEPTION 'Só o gestor da unidade retira vaga da escala.'; END IF;
  IF v.fechada_em IS NOT NULL THEN RETURN; END IF;
  UPDATE public.escala_vagas SET fechada_em = clock_timestamp(), fechada_por = private.meu_perfil_id() WHERE id = v.id;
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (v.unidade_id, private.meu_perfil_id(), 'retirar_vaga',
          (SELECT nome FROM public.setores WHERE id = v.setor_id) || ' · ' || to_char(v.data, 'DD/MM') || ' · ' || v.turno,
          jsonb_build_object('vaga_id', v.id, 'setor_id', v.setor_id, 'data', v.data, 'turno', v.turno));
END $$;
REVOKE ALL ON FUNCTION public.retirar_vaga_escala(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_vaga_escala(uuid) TO authenticated;

-- ── publicar ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.publicar_escala(p_unidade uuid, p_ano int, p_mes int, p_observacao text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ini date;
  v_fim date;
  v_versao int;
  v_plantoes int;
  v_vagas int;
  v_perfil uuid;
  v_rotulo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade publica a escala.'; END IF;
  IF p_mes NOT BETWEEN 1 AND 12 OR p_ano NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Mês inválido.'; END IF;
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  IF v_fim < private.data_atual() THEN RAISE EXCEPTION 'Este mês já terminou: a escala dele não se publica mais.'; END IF;
  SELECT count(*) INTO v_plantoes FROM public.escala_plantao
   WHERE unidade_id = p_unidade AND ativo AND data BETWEEN v_ini AND v_fim;
  IF v_plantoes = 0 THEN RAISE EXCEPTION 'Não há plantão neste mês para publicar.'; END IF;
  SELECT count(*) INTO v_vagas FROM private.escala_faixas(p_unidade, v_ini, v_fim) f
   WHERE jsonb_array_length(f.escalados) = 0 AND (f.previsto OR f.vaga_id IS NOT NULL);
  SELECT coalesce(max(versao), 0) + 1 INTO v_versao FROM public.escala_publicacoes
   WHERE unidade_id = p_unidade AND competencia = v_ini;
  INSERT INTO public.escala_publicacoes (unidade_id, competencia, versao, plantoes, vagas, observacao, publicada_por)
  VALUES (p_unidade, v_ini, v_versao, v_plantoes, v_vagas, nullif(btrim(p_observacao), ''), private.meu_perfil_id());
  v_rotulo := to_char(v_ini, 'MM/YYYY');
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (p_unidade, private.meu_perfil_id(), 'publicar',
          'Escala de ' || v_rotulo || ' publicada (versão ' || v_versao || ', ' || v_plantoes || ' plantões, ' || v_vagas || ' vagas abertas)',
          jsonb_build_object('competencia', v_ini, 'versao', v_versao, 'plantoes', v_plantoes, 'vagas', v_vagas));
  FOR v_perfil IN SELECT DISTINCT e.perfil_id FROM public.escala_plantao e
                   WHERE e.unidade_id = p_unidade AND e.ativo AND e.data BETWEEN v_ini AND v_fim LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (v_perfil, p_unidade, v_ini, 'escala_publicada_' || to_char(v_ini, 'YYYY_MM') || '_v' || v_versao,
            'A escala de ' || v_rotulo || ' foi publicada' || CASE WHEN v_versao > 1 THEN ' (versão ' || v_versao || ')' ELSE '' END
              || '. Confira seus plantões na agenda.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;
  PERFORM private.registrar_auditoria('publicar_escala', 'escala_publicacoes', NULL, p_unidade,
    jsonb_build_object('quantidade', v_plantoes, 'status', 'versao ' || v_versao));
  RETURN v_versao;
END $$;
REVOKE ALL ON FUNCTION public.publicar_escala(uuid, int, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_escala(uuid, int, int, text) TO authenticated;
