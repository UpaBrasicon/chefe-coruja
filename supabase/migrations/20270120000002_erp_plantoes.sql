-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 3 (ERP/financeiro), etapa 3.2: plantões para o ERP
-- (pedido do RT de 27/10/2026, "o ERP entra tudo: remédio, procedimento,
-- plantões"; decisões "1a 2a 3a" do mesmo dia).
--
-- 1a. Vai o plantão realizado, com o valor da tabela de remuneração da
--     unidade (Configuração): escala, presença (check-in e check-out, minutos
--     presentes), setor, turno e falta. Parte de plantão fracionado vale a
--     proporção das horas sobre as do turno (12 h à noite, 6 h nos outros),
--     como na tela de vagas. Só o realizado soma no total; falta justificada
--     e plantão sem presença vão na lista com valor zero.
-- 2a. Do profissional: nome, CPF, conselho, registro com UF e CBO.
-- 3a. Por mês, fechado pelo gestor da unidade, só depois de o mês acabar.
--     Correção depois do fechamento: o gestor reabre com motivo (a versão
--     vigente fica substituída) e fecha de novo, o que gera a versão seguinte.
--
-- A porta da API (o ERP busca e responde) entra na etapa 3.3, junto com a das
-- contas. As colunas do retorno já ficam aqui (expand), como nas contas.
--
-- expand: tabela e funções novas. Nada do que existe muda.
--
-- Rollback (testado na homologação):
--   DROP FUNCTION IF EXISTS public.reabrir_plantoes_erp(uuid, text, text),
--     public.fechar_plantoes_erp(uuid, text), public.plantoes_erp_previa(uuid, text),
--     private.plantoes_erp_dados(uuid, text), private.plantoes_erp_linhas(uuid, text),
--     private.plantao_erp_valor(uuid, uuid, text, integer, boolean), private.competencia_valida(text);
--   DROP TABLE IF EXISTS public.plantao_versoes_erp;
--   Os registros na auditoria ficam como histórico.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plantao_versoes_erp (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id),
  competencia       text NOT NULL CHECK (competencia ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  versao            integer NOT NULL CHECK (versao >= 1),
  situacao          text NOT NULL DEFAULT 'vigente' CHECK (situacao IN ('vigente', 'substituida')),
  dados             jsonb NOT NULL,
  total             numeric(12, 2) NOT NULL CHECK (total >= 0),
  gerada_em         timestamptz NOT NULL DEFAULT now(),
  gerada_por        uuid REFERENCES public.perfis(id),
  substituida_em    timestamptz,
  substituida_por   uuid REFERENCES public.perfis(id),
  motivo_reabertura text,
  -- muda quando a versão nasce ou é substituída (o ERP busca por aqui)
  alterada_em       timestamptz NOT NULL DEFAULT now(),
  conciliacao       text NOT NULL DEFAULT 'pendente' CHECK (conciliacao IN ('pendente', 'conciliada', 'divergente', 'estornada')),
  erp_id            text CHECK (length(erp_id) BETWEEN 1 AND 100),
  erp_recebida_em   timestamptz,
  valor_lancado     numeric(12, 2) CHECK (valor_lancado >= 0),
  retorno_em        timestamptz,
  retorno_chave     uuid REFERENCES public.api_chaves(id),
  CONSTRAINT plantao_versoes_erp_unica UNIQUE (unidade_id, competencia, versao),
  CONSTRAINT plantao_versoes_erp_substituida CHECK ((situacao = 'substituida') = (substituida_em IS NOT NULL)),
  CONSTRAINT plantao_versoes_erp_motivo CHECK (situacao = 'vigente' OR length(btrim(coalesce(motivo_reabertura, ''))) >= 10),
  CONSTRAINT plantao_versoes_erp_estorno CHECK (conciliacao <> 'estornada' OR situacao = 'substituida'),
  CONSTRAINT plantao_versoes_erp_retorno CHECK ((conciliacao = 'pendente') = (retorno_em IS NULL))
);
COMMENT ON TABLE public.plantao_versoes_erp IS 'Fase 5C-3: plantões do mês fechados pelo gestor para o ERP; reabrir substitui a vigente e o fechamento seguinte gera a próxima versão.';
CREATE UNIQUE INDEX IF NOT EXISTS plantao_versoes_erp_vigente ON public.plantao_versoes_erp (unidade_id, competencia) WHERE situacao = 'vigente';
CREATE INDEX IF NOT EXISTS plantao_versoes_erp_alteradas ON public.plantao_versoes_erp (unidade_id, alterada_em, id);

-- leitura: gestor da unidade (tem CPF de profissional); gravação só pelas funções
ALTER TABLE public.plantao_versoes_erp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plantao_versoes_erp_leitura ON public.plantao_versoes_erp;
CREATE POLICY plantao_versoes_erp_leitura ON public.plantao_versoes_erp FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.gestor_da_unidade(unidade_id));
REVOKE ALL ON public.plantao_versoes_erp FROM anon, authenticated;
GRANT SELECT ON public.plantao_versoes_erp TO authenticated;
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.plantao_versoes_erp;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.plantao_versoes_erp FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

CREATE OR REPLACE FUNCTION private.competencia_valida(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(p ~ '^[0-9]{4}(0[1-9]|1[0-2])$', false)
$$;

-- 1a. valor da tabela de remuneração: setor e turno exatos antes do genérico
CREATE OR REPLACE FUNCTION private.plantao_erp_valor(p_unidade uuid, p_setor uuid, p_turno text, p_duracao integer, p_fracionado boolean)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT round(r.valor * CASE WHEN p_fracionado
                              THEN p_duracao::numeric / CASE WHEN p_turno = 'noite' THEN 720 ELSE 360 END
                              ELSE 1 END, 2)
    FROM (SELECT x.valor FROM public.remuneracoes_plantao x
           WHERE x.unidade_id = p_unidade AND x.ativo
             AND (x.setor_id = p_setor OR x.setor_id IS NULL) AND (x.turno = p_turno OR x.turno IS NULL)
           ORDER BY (x.setor_id IS NULL), (x.turno IS NULL), x.created_at DESC
           LIMIT 1) r
$$;

-- os plantões da escala do mês, com presença, falta justificada e valor
CREATE OR REPLACE FUNCTION private.plantoes_erp_linhas(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(l.j ORDER BY l.inicio, l.id), '[]'::jsonb) FROM (
    SELECT e.id, e.inicio, jsonb_build_object(
      'plantao_id', e.id, 'data', e.data, 'turno', e.turno,
      'setor', jsonb_build_object('id', s.id, 'nome', s.nome),
      'inicio', e.inicio, 'duracao_min', e.duracao_min, 'fracionado', f.fr,
      'profissional', jsonb_build_object('id', p.id, 'nome', p.nome_completo, 'cpf', p.cpf, 'conselho', p.conselho,
                        'registro', coalesce(p.registro_numero, p.crm), 'registro_uf', coalesce(p.registro_uf, p.uf_crm), 'cbo', p.cbo),
      'checkin_em', pr.checkin_em, 'checkout_em', pr.checkout_em, 'checkout_automatico', coalesce(pr.checkout_automatico, false),
      'minutos_presentes', CASE WHEN pr.checkout_em IS NOT NULL THEN floor(extract(epoch FROM pr.checkout_em - pr.checkin_em) / 60)::int END,
      'situacao', st.sit, 'tipo_falta', fj.tipo_falta,
      'valor_referencia', v.vr,
      'valor', CASE WHEN st.sit = 'realizado' THEN v.vr ELSE 0 END) AS j
      FROM public.escala_plantao e
      JOIN public.setores s ON s.id = e.setor_id
      JOIN public.perfis p ON p.id = e.perfil_id
      LEFT JOIN LATERAL (SELECT x.checkin_em, x.checkout_em, x.checkout_automatico FROM public.presenca_plantonista x
                          WHERE x.escala_plantao_id = e.id AND x.checkin_em IS NOT NULL ORDER BY x.checkin_em LIMIT 1) pr ON true
      LEFT JOIN LATERAL (SELECT true AS justificada, x.tipo_falta FROM public.solicitacoes_escala x
                          WHERE x.escala_plantao_id = e.id AND x.tipo = 'justificar_falta' AND x.status = 'aprovado'
                          ORDER BY x.updated_at DESC LIMIT 1) fj ON true
      CROSS JOIN LATERAL (SELECT e.fracionado OR e.plantao_origem_id IS NOT NULL AS fr) f
      CROSS JOIN LATERAL (SELECT private.plantao_erp_valor(e.unidade_id, e.setor_id, e.turno, e.duracao_min, f.fr) AS vr) v
      CROSS JOIN LATERAL (SELECT CASE WHEN pr.checkin_em IS NOT NULL THEN 'realizado'
                                      WHEN fj.justificada THEN 'falta_justificada'
                                      ELSE 'sem_presenca' END AS sit) st
     WHERE e.unidade_id = p_unidade AND e.ativo AND e.perfil_id IS NOT NULL
       AND e.data >= to_date(p_competencia, 'YYYYMM') AND e.data < to_date(p_competencia, 'YYYYMM') + interval '1 month') l
$$;

CREATE OR REPLACE FUNCTION private.plantoes_erp_dados(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH l AS (SELECT private.plantoes_erp_linhas(p_unidade, p_competencia) AS linhas),
       x AS (SELECT y FROM l, jsonb_array_elements(l.linhas) y)
  SELECT jsonb_build_object(
    'unidade', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome, 'cnes', u.cnes) FROM public.unidades u WHERE u.id = p_unidade),
    'competencia', p_competencia,
    'plantoes', (SELECT linhas FROM l),
    'totais', jsonb_build_object(
      'plantoes', (SELECT count(*) FROM x),
      'realizados', (SELECT count(*) FROM x WHERE y ->> 'situacao' = 'realizado'),
      'faltas_justificadas', (SELECT count(*) FROM x WHERE y ->> 'situacao' = 'falta_justificada'),
      'sem_presenca', (SELECT count(*) FROM x WHERE y ->> 'situacao' = 'sem_presenca'),
      'realizados_sem_valor', (SELECT count(*) FROM x WHERE y ->> 'situacao' = 'realizado' AND y -> 'valor_referencia' = 'null'::jsonb),
      'sem_checkout', (SELECT count(*) FROM x WHERE y ->> 'situacao' = 'realizado' AND y -> 'checkout_em' = 'null'::jsonb)),
    'total', round(coalesce((SELECT sum((y ->> 'valor')::numeric) FROM x), 0), 2))
$$;
REVOKE ALL ON FUNCTION private.competencia_valida(text), private.plantao_erp_valor(uuid, uuid, text, integer, boolean),
  private.plantoes_erp_linhas(uuid, text), private.plantoes_erp_dados(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── tela do gestor (etapa 3.4) ──────────────────────────────────────────────
-- prévia do mês (como está agora) e as versões já fechadas
CREATE OR REPLACE FUNCTION public.plantoes_erp_previa(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atual text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: os plantões para o ERP são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT private.competencia_valida(p_competencia) THEN RAISE EXCEPTION 'Competência no formato AAAAMM.'; END IF;
  RETURN private.plantoes_erp_dados(p_unidade, p_competencia) || jsonb_build_object(
    'mes_encerrado', p_competencia < v_atual,
    'fechado', EXISTS (SELECT 1 FROM public.plantao_versoes_erp x WHERE x.unidade_id = p_unidade AND x.competencia = p_competencia AND x.situacao = 'vigente'),
    'versoes', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'versao', x.versao, 'situacao', x.situacao, 'total', x.total, 'gerada_em', x.gerada_em,
        'gerada_por', (SELECT nome_completo FROM public.perfis WHERE id = x.gerada_por),
        'substituida_em', x.substituida_em, 'substituida_por', (SELECT nome_completo FROM public.perfis WHERE id = x.substituida_por),
        'motivo_reabertura', x.motivo_reabertura, 'conciliacao', x.conciliacao, 'valor_lancado', x.valor_lancado) ORDER BY x.versao)
      FROM public.plantao_versoes_erp x WHERE x.unidade_id = p_unidade AND x.competencia = p_competencia), '[]'::jsonb));
END $$;

-- 3a. fechar o mês: gera a versão seguinte
CREATE OR REPLACE FUNCTION public.fechar_plantoes_erp(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dados jsonb; v_versao integer; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: quem fecha os plantões do mês é o gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT private.competencia_valida(p_competencia) THEN RAISE EXCEPTION 'Competência no formato AAAAMM.'; END IF;
  IF p_competencia >= to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM') THEN
    RAISE EXCEPTION 'O mês só fecha depois de acabar.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('plantoes_erp:' || p_unidade || ':' || p_competencia));
  IF EXISTS (SELECT 1 FROM public.plantao_versoes_erp x WHERE x.unidade_id = p_unidade AND x.competencia = p_competencia AND x.situacao = 'vigente') THEN
    RAISE EXCEPTION 'Os plantões deste mês já estão fechados: reabra antes de fechar de novo.';
  END IF;
  v_dados := private.plantoes_erp_dados(p_unidade, p_competencia);
  IF (v_dados -> 'totais' ->> 'plantoes')::int = 0 THEN RAISE EXCEPTION 'Não há plantão na escala deste mês.'; END IF;
  SELECT coalesce(max(x.versao), 0) + 1 INTO v_versao FROM public.plantao_versoes_erp x
   WHERE x.unidade_id = p_unidade AND x.competencia = p_competencia;
  INSERT INTO public.plantao_versoes_erp (unidade_id, competencia, versao, dados, total, gerada_por)
  VALUES (p_unidade, p_competencia, v_versao, v_dados, (v_dados ->> 'total')::numeric, private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('plantoes_erp_fechados', 'plantao_versoes_erp', v_id, p_unidade,
    jsonb_build_object('competencia', p_competencia, 'versao', v_versao, 'total', (v_dados ->> 'total')::numeric,
                       'plantoes', (v_dados -> 'totais' ->> 'plantoes')::int));
  RETURN public.plantoes_erp_previa(p_unidade, p_competencia);
END $$;

-- 3a. reabrir com motivo: a versão vigente fica substituída
CREATE OR REPLACE FUNCTION public.reabrir_plantoes_erp(p_unidade uuid, p_competencia text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.plantao_versoes_erp;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: quem reabre os plantões do mês é o gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Diga por que o mês é reaberto (mínimo de 10 letras).'; END IF;
  UPDATE public.plantao_versoes_erp SET situacao = 'substituida', substituida_em = now(), substituida_por = private.meu_perfil_id(),
         motivo_reabertura = btrim(p_motivo), alterada_em = now()
   WHERE unidade_id = p_unidade AND competencia = p_competencia AND situacao = 'vigente'
  RETURNING * INTO v;
  IF NOT FOUND THEN RAISE EXCEPTION 'Os plantões deste mês não estão fechados.'; END IF;
  PERFORM private.registrar_auditoria('plantoes_erp_reabertos', 'plantao_versoes_erp', v.id, p_unidade,
    jsonb_build_object('competencia', p_competencia, 'versao', v.versao, 'motivo', v.motivo_reabertura));
  RETURN public.plantoes_erp_previa(p_unidade, p_competencia);
END $$;
REVOKE ALL ON FUNCTION public.plantoes_erp_previa(uuid, text), public.fechar_plantoes_erp(uuid, text),
  public.reabrir_plantoes_erp(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plantoes_erp_previa(uuid, text), public.fechar_plantoes_erp(uuid, text),
  public.reabrir_plantoes_erp(uuid, text, text) TO authenticated;
