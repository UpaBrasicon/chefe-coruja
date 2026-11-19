-- ════════════════════════════════════════════════════════════════════════════
-- SP1, decisões S1–S6 = A do RT (18/11/2026,
-- docs/clinico/SP1-DESEMPENHO-ALERTA-SEPSE-DIAGNOSTICO.md): medir o alerta de
-- sepse por regra.
--   S1: sepse pelo método de Seymour 2016 (JAMA 315:762, PMID 26903335):
--       suspeita de infecção = antimicrobiano e cultura (antimicrobiano antes:
--       cultura em até 24 h; cultura antes: antimicrobiano em até 72 h); início
--       = o primeiro dos dois; sepse = SOFA original de 2 ou mais de 48 h antes
--       a 24 h depois (Singer 2016, JAMA 315:801, tabela 1; H11 = A). Item sem
--       dado conta zero. Adulto (18+) mede; 14 a 17 anos fica à parte.
--   S2: o alerta da internação passa a registrar o primeiro disparo exibido
--       (por internação e nível); o aviso da porta já registra (AV6).
--   S3: painel por mês: sensibilidade (alerta até 6 h depois do início), valor
--       preditivo, alertas por 100 atendimentos, antecedência, dispensas, NEWS2
--       parcial à parte, sempre com o número de casos.
--   S4: gestor e RT veem o agregado; só o RT abre a lista de casos, com motivo
--       e registro de acesso.
--   S5: "publicável" só com 30 sepses ou mais e 50% ou mais das suspeitas com
--       plaquetas e creatinina medidas.
--   S6: construído antes de haver dado real; validado com casos montados.
-- Simplificações (documentadas na nota do método): o cardiovascular do SOFA
-- usa a presença de vasoativo (noradrenalina, adrenalina, vasopressina ou
-- dopamina = 3; só dobutamina ou milrinona = 2), sem a dose por kg; o renal
-- usa só a creatinina (sem a diurese de 24 h); FiO2 sem registro = 0,21.
--
-- Expand: cria uma tabela e funções; não muda as funções do alerta.
-- Volta: docs/clinico/SP1-ROLLBACK-20270418000095.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. registro do alerta da internação (S2) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.alertas_sepse_internacao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  internacao_id uuid NOT NULL REFERENCES public.internacoes(id),
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id),
  nivel         text NOT NULL CHECK (nivel IN ('news2_rastreio', 'news2_alto')),
  news2_total   int NOT NULL,
  parcial       boolean NOT NULL,
  autor_id      uuid NOT NULL REFERENCES public.perfis(id),
  exibido_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (internacao_id, nivel)
);
CREATE INDEX IF NOT EXISTS alertas_sepse_internacao_unidade ON public.alertas_sepse_internacao (unidade_id, exibido_em);
ALTER TABLE public.alertas_sepse_internacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alertas_sepse_internacao FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_alertas_sepse_internacao_so_insercao ON public.alertas_sepse_internacao;
CREATE TRIGGER trg_alertas_sepse_internacao_so_insercao BEFORE UPDATE ON public.alertas_sepse_internacao
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

-- A tela chama ao mostrar o alerta; o servidor recalcula a regra (a tela não
-- informa o nível) e grava só o primeiro de cada internação e nível.
CREATE OR REPLACE FUNCTION public.registrar_alerta_sepse_internacao(p_unidade uuid, p_paciente uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_int uuid; a jsonb; n int;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  IF NOT (private.papel_na_unidade(p_unidade) = 'gestor' OR private.paciente_em_cuidado_no_plantao(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;
  SELECT i.id INTO v_int FROM public.internacoes i
   WHERE i.unidade_id = p_unidade AND i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado')
   ORDER BY i.created_at DESC LIMIT 1;
  IF v_int IS NULL THEN RETURN false; END IF;
  a := private.sepse_adulto_regra(p_paciente, now() - interval '24 hours', NULL, NULL);
  IF a IS NULL THEN RETURN false; END IF;
  INSERT INTO public.alertas_sepse_internacao (unidade_id, internacao_id, paciente_id, nivel, news2_total, parcial, autor_id)
  VALUES (p_unidade, v_int, p_paciente, a ->> 'nivel', (a ->> 'total')::int, coalesce((a ->> 'parcial')::boolean, false),
          private.meu_perfil_id())
  ON CONFLICT (internacao_id, nivel) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- ── 2. SOFA original numa janela, com o que o banco tem (S1) ───────────────
-- Cortes: Singer 2016, tabela 1 (os mesmos da ficha sepse-adulto).
CREATE OR REPLACE FUNCTION private.sofa_janela(p_paciente uuid, p_de timestamptz, p_ate timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plaq numeric; v_creat numeric; v_bili numeric; v_pf numeric; v_suporte boolean;
  v_pam numeric; v_glasgow numeric; v_vaso int;
  p_resp int; p_coag int; p_hep int; p_cv int; p_snc int; p_renal int;
BEGIN
  -- exames com resultado vigente liberado na janela
  WITH it AS (
    SELECT i.loinc, private.norm(i.analito) AS an, i.valor_num AS v, lower(coalesce(i.unidade, '')) AS un, r.liberado_em AS em
      FROM public.exame_resultado_itens i
      JOIN public.exame_resultados r ON r.id = i.resultado_id AND r.vigente
      JOIN public.exames_pedidos x ON x.id = r.exame_id
     WHERE x.paciente_id = p_paciente AND r.liberado_em >= p_de AND r.liberado_em <= p_ate AND i.valor_num IS NOT NULL)
  SELECT
    min(CASE WHEN loinc IN ('777-3', '26515-7') OR an ~ 'plaquet' THEN CASE WHEN v > 2000 THEN v / 1000 ELSE v END END),
    max(CASE WHEN loinc = '2160-0' OR an ~ 'creatinin' THEN CASE WHEN un ~ 'mol' THEN v / 88.4 ELSE v END END),
    max(CASE WHEN loinc = '1975-2' OR an ~ 'bilirrubina total' THEN CASE WHEN un ~ 'mol' THEN v / 17.1 ELSE v END END),
    min(CASE WHEN loinc = '2703-7' OR an ~ '^(pao2|po2|pressao parcial de o)' THEN
          (CASE WHEN un ~ 'kpa' THEN v * 7.5 ELSE v END) /
          coalesce((SELECT CASE WHEN o.valor_num > 1 THEN o.valor_num / 100 ELSE o.valor_num END
                      FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'fio2'
                     WHERE o.paciente_id = p_paciente AND o.aferido_em <= it.em AND o.aferido_em >= it.em - interval '6 hours'
                       AND o.valor_num > 0
                     ORDER BY o.aferido_em DESC LIMIT 1), 0.21) END)
    INTO v_plaq, v_creat, v_bili, v_pf
    FROM it;

  -- sinais vitais na janela
  SELECT
    min(CASE WHEN c.nome = 'glasgow' THEN o.valor_num END),
    max(CASE WHEN c.nome = 'drogas-vasoativas' THEN o.valor_num END),
    bool_or(c.nome = 'suporte-respiratorio' AND op.valor IN ('vni', 'vmi'))
    INTO v_glasgow, v_vaso, v_suporte
    FROM public.observacao o
    JOIN public.conceito c ON c.id = o.conceito_id
    LEFT JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
   WHERE o.paciente_id = p_paciente AND o.aferido_em >= p_de AND o.aferido_em <= p_ate;
  -- PAM: a registrada ou (PAS + 2 PAD) / 3 da mesma aferição
  SELECT min(coalesce(pam, (pas + 2 * pad) / 3)) INTO v_pam FROM (
    SELECT max(CASE WHEN c.nome = 'pressao-arterial-media' THEN o.valor_num END) pam,
           max(CASE WHEN c.nome = 'pressao-arterial-sistolica' THEN o.valor_num END) pas,
           max(CASE WHEN c.nome = 'pressao-arterial-diastolica' THEN o.valor_num END) pad
      FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
     WHERE o.paciente_id = p_paciente AND o.aferido_em >= p_de AND o.aferido_em <= p_ate
       AND c.nome IN ('pressao-arterial-media', 'pressao-arterial-sistolica', 'pressao-arterial-diastolica')
     GROUP BY o.aferido_em) x;

  p_resp := CASE WHEN v_pf IS NULL THEN 0 WHEN v_pf < 100 AND v_suporte THEN 4 WHEN v_pf < 200 AND v_suporte THEN 3
                 WHEN v_pf < 300 THEN 2 WHEN v_pf < 400 THEN 1 ELSE 0 END;
  p_coag := CASE WHEN v_plaq IS NULL THEN 0 WHEN v_plaq < 20 THEN 4 WHEN v_plaq < 50 THEN 3 WHEN v_plaq < 100 THEN 2
                 WHEN v_plaq < 150 THEN 1 ELSE 0 END;
  p_hep := CASE WHEN v_bili IS NULL THEN 0 WHEN v_bili >= 12 THEN 4 WHEN v_bili >= 6 THEN 3 WHEN v_bili >= 2 THEN 2
                WHEN v_bili >= 1.2 THEN 1 ELSE 0 END;
  -- vasoativo: pelo sinal vital (número de drogas) ou pela prescrição ativa na janela
  p_cv := CASE
    WHEN coalesce(v_vaso, 0) >= 1 OR EXISTS (
      SELECT 1 FROM public.prescricao_itens pi JOIN public.prescricoes pr ON pr.id = pi.prescricao_id
        LEFT JOIN public.medicamento m ON m.id = pi.medicamento_id
       WHERE pr.paciente_id = p_paciente AND pi.created_at <= p_ate AND (pi.suspenso_em IS NULL OR pi.suspenso_em >= p_de)
         AND private.norm(coalesce(m.principio_ativo, '') || ' ' || pi.descricao) ~ '(noradrenalina|norepinefrina|adrenalina|epinefrina|vasopressina|dopamina)')
      THEN 3
    WHEN EXISTS (
      SELECT 1 FROM public.prescricao_itens pi JOIN public.prescricoes pr ON pr.id = pi.prescricao_id
        LEFT JOIN public.medicamento m ON m.id = pi.medicamento_id
       WHERE pr.paciente_id = p_paciente AND pi.created_at <= p_ate AND (pi.suspenso_em IS NULL OR pi.suspenso_em >= p_de)
         AND private.norm(coalesce(m.principio_ativo, '') || ' ' || pi.descricao) ~ '(dobutamina|milrinona)')
      THEN 2
    WHEN v_pam < 70 THEN 1 ELSE 0 END;
  p_snc := CASE WHEN v_glasgow IS NULL THEN 0 WHEN v_glasgow < 6 THEN 4 WHEN v_glasgow < 10 THEN 3 WHEN v_glasgow < 13 THEN 2
                WHEN v_glasgow < 15 THEN 1 ELSE 0 END;
  p_renal := CASE WHEN v_creat IS NULL THEN 0 WHEN v_creat >= 5 THEN 4 WHEN v_creat >= 3.5 THEN 3 WHEN v_creat >= 2 THEN 2
                  WHEN v_creat >= 1.2 THEN 1 ELSE 0 END;

  RETURN jsonb_build_object(
    'total', p_resp + p_coag + p_hep + p_cv + p_snc + p_renal,
    'respiratorio', p_resp, 'coagulacao', p_coag, 'hepatico', p_hep, 'cardiovascular', p_cv, 'neurologico', p_snc, 'renal', p_renal,
    'tem_plaquetas', v_plaq IS NOT NULL, 'tem_creatinina', v_creat IS NOT NULL, 'tem_bilirrubina', v_bili IS NOT NULL,
    'tem_pao2', v_pf IS NOT NULL, 'tem_glasgow', v_glasgow IS NOT NULL, 'tem_pam', v_pam IS NOT NULL);
END $$;

-- ── 3. um caso por atendimento (episódio) do período ───────────────────────
CREATE OR REPLACE FUNCTION private.sepse_casos(p_unidade uuid, p_de timestamptz, p_ate timestamptz)
RETURNS TABLE (
  episodio_id uuid, paciente_id uuid, chegada_em timestamptz, faixa text,
  suspeita_em timestamptz, antimicrobiano_sem_cultura boolean, sofa jsonb, sepse boolean,
  alerta_em timestamptz, alerta_nivel text, alerta_parcial boolean, alerta_origem text,
  dispensado boolean, motivo_dispensa text, detectado boolean, antecedencia_h numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH ep AS (
    SELECT e.id, e.paciente_id, coalesce(e.chegada_em, e.created_at) AS chegada,
           CASE WHEN p.data_nascimento <= (coalesce(e.chegada_em, e.created_at))::date - interval '18 years' THEN 'adulto' ELSE '14_17' END AS faixa
      FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id
     WHERE e.unidade_id = p_unidade AND coalesce(e.chegada_em, e.created_at) >= p_de AND coalesce(e.chegada_em, e.created_at) < p_ate
       AND p.data_nascimento IS NOT NULL AND p.data_nascimento <= (coalesce(e.chegada_em, e.created_at))::date - interval '14 years'),
  intern AS (SELECT i.id, i.episodio_id FROM public.internacoes i JOIN ep ON ep.id = i.episodio_id),
  abx AS (
    SELECT DISTINCT ep.id AS ep_id, coalesce(pr.assinada_em, pi.created_at) AS em
      FROM ep JOIN public.prescricoes pr ON pr.episodio_id = ep.id OR pr.internacao_id IN (SELECT n.id FROM intern n WHERE n.episodio_id = ep.id)
      JOIN public.prescricao_itens pi ON pi.prescricao_id = pr.id
      LEFT JOIN public.medicamento m ON m.id = pi.medicamento_id
     WHERE private.eh_antimicrobiano(coalesce(m.principio_ativo, '') || ' ' || pi.descricao)),
  cult AS (
    SELECT DISTINCT ep.id AS ep_id, coalesce(x.coletado_em, x.pedido_em) AS em
      FROM ep JOIN public.exames_pedidos x ON x.episodio_id = ep.id OR x.internacao_id IN (SELECT n.id FROM intern n WHERE n.episodio_id = ep.id)
     WHERE x.situacao <> 'cancelado' AND private.norm(x.exame) ~ 'cultura'),
  inicio AS (
    SELECT a.ep_id, min(CASE WHEN a.em <= c.em AND c.em <= a.em + interval '24 hours' THEN a.em
                             WHEN c.em < a.em AND a.em <= c.em + interval '72 hours' THEN c.em END) AS em
      FROM abx a JOIN cult c ON c.ep_id = a.ep_id GROUP BY a.ep_id),
  alerta AS (
    SELECT DISTINCT ON (q.ep_id) q.ep_id, q.em, q.nivel, q.parcial, q.origem FROM (
      SELECT s.episodio_id AS ep_id, s.registrado_em AS em, s.nivel, s.parcial, 'porta' AS origem
        FROM public.avisos_sepse_atendimento s JOIN ep ON ep.id = s.episodio_id WHERE s.evento = 'exibido'
      UNION ALL
      SELECT n.episodio_id, s.exibido_em, s.nivel, s.parcial, 'internacao'
        FROM public.alertas_sepse_internacao s JOIN intern n ON n.id = s.internacao_id) q
     ORDER BY q.ep_id, q.em),
  disp AS (
    SELECT DISTINCT ON (s.episodio_id) s.episodio_id AS ep_id, s.motivo
      FROM public.avisos_sepse_atendimento s JOIN ep ON ep.id = s.episodio_id WHERE s.evento = 'dispensado'
     ORDER BY s.episodio_id, s.registrado_em)
  SELECT ep.id, ep.paciente_id, ep.chegada, ep.faixa, i.em,
         EXISTS (SELECT 1 FROM abx WHERE abx.ep_id = ep.id) AND NOT EXISTS (SELECT 1 FROM cult WHERE cult.ep_id = ep.id),
         s.sofa, coalesce(i.em IS NOT NULL AND (s.sofa ->> 'total')::int >= 2, false),
         al.em, al.nivel, al.parcial, al.origem,
         d.ep_id IS NOT NULL, d.motivo,
         coalesce(i.em IS NOT NULL AND (s.sofa ->> 'total')::int >= 2 AND al.em IS NOT NULL AND al.em <= i.em + interval '6 hours', false),
         CASE WHEN i.em IS NOT NULL AND al.em IS NOT NULL THEN round((extract(epoch FROM i.em - al.em) / 3600)::numeric, 1) END
    FROM ep
    LEFT JOIN inicio i ON i.ep_id = ep.id
    LEFT JOIN LATERAL (SELECT CASE WHEN i.em IS NULL THEN NULL
                                   ELSE private.sofa_janela(ep.paciente_id, i.em - interval '48 hours', i.em + interval '24 hours') END AS sofa) s ON true
    LEFT JOIN alerta al ON al.ep_id = ep.id
    LEFT JOIN disp d ON d.ep_id = ep.id
$$;

-- ── 4. painel (S3, S4, S5) ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.sepse_agregado(p_casos jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH c AS (SELECT * FROM jsonb_to_recordset(coalesce(p_casos, '[]'::jsonb)) AS x(
    sepse boolean, suspeita boolean, alerta boolean, detectado boolean, parcial boolean, dispensado boolean,
    antecedencia_h numeric, plaq_creat boolean, abx_sem_cultura boolean)),
  n AS (SELECT count(*) AS atendimentos,
               count(*) FILTER (WHERE suspeita) AS suspeitas,
               count(*) FILTER (WHERE sepse) AS sepses,
               count(*) FILTER (WHERE alerta) AS alertas,
               count(*) FILTER (WHERE alerta AND sepse) AS alertas_com_sepse,
               count(*) FILTER (WHERE detectado) AS detectadas,
               count(*) FILTER (WHERE dispensado) AS dispensados,
               count(*) FILTER (WHERE alerta AND parcial) AS alertas_parciais,
               count(*) FILTER (WHERE alerta AND parcial AND sepse) AS parciais_com_sepse,
               count(*) FILTER (WHERE alerta AND NOT parcial) AS alertas_completos,
               count(*) FILTER (WHERE alerta AND NOT parcial AND sepse) AS completos_com_sepse,
               count(*) FILTER (WHERE suspeita AND plaq_creat) AS suspeitas_com_laboratorio,
               count(*) FILTER (WHERE abx_sem_cultura) AS antimicrobiano_sem_cultura,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY antecedencia_h) FILTER (WHERE detectado) AS antecedencia_mediana_h
          FROM c)
  SELECT to_jsonb(n) || jsonb_build_object(
    'sensibilidade', CASE WHEN sepses > 0 THEN round(detectadas::numeric / sepses, 3) END,
    'valor_preditivo', CASE WHEN alertas > 0 THEN round(alertas_com_sepse::numeric / alertas, 3) END,
    'alertas_por_100', CASE WHEN atendimentos > 0 THEN round(alertas * 100.0 / atendimentos, 1) END,
    'cobertura_laboratorio', CASE WHEN suspeitas > 0 THEN round(suspeitas_com_laboratorio::numeric / suspeitas, 3) END,
    'publicavel', sepses >= 30 AND suspeitas > 0 AND suspeitas_com_laboratorio::numeric / suspeitas >= 0.5,
    'motivo_nao_publicavel', CASE WHEN sepses < 30 THEN 'amostra pequena (menos de 30 sepses)'
                                  WHEN suspeitas = 0 OR suspeitas_com_laboratorio::numeric / suspeitas < 0.5 THEN 'dados de laboratório insuficientes' END)
    FROM n
$$;

CREATE OR REPLACE FUNCTION public.desempenho_alerta_sepse(p_unidade uuid, p_meses int DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ini timestamptz; casos jsonb;
BEGIN
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.sou_rt_medico() OR private.eh_super_admin() IS TRUE) THEN
    RAISE EXCEPTION 'O desempenho do alerta é do gestor da unidade e do responsável técnico.' USING ERRCODE = '42501';
  END IF;
  v_ini := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
           - make_interval(months => greatest(least(coalesce(p_meses, 6), 24), 1) - 1);
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'mes', to_char(c.chegada_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'), 'faixa', c.faixa,
           'sepse', c.sepse, 'suspeita', c.suspeita_em IS NOT NULL, 'alerta', c.alerta_em IS NOT NULL,
           'detectado', c.detectado, 'parcial', coalesce(c.alerta_parcial, false), 'dispensado', c.dispensado,
           'antecedencia_h', CASE WHEN c.detectado THEN c.antecedencia_h END,
           'plaq_creat', coalesce((c.sofa ->> 'tem_plaquetas')::boolean AND (c.sofa ->> 'tem_creatinina')::boolean, false),
           'abx_sem_cultura', c.antimicrobiano_sem_cultura)), '[]'::jsonb)
    INTO casos
    FROM private.sepse_casos(p_unidade, v_ini, now()) c;
  RETURN jsonb_build_object(
    'desde', v_ini,
    'adulto', private.sepse_agregado((SELECT jsonb_agg(x) FROM jsonb_array_elements(casos) x WHERE x ->> 'faixa' = 'adulto')),
    'de_14_a_17', private.sepse_agregado((SELECT jsonb_agg(x) FROM jsonb_array_elements(casos) x WHERE x ->> 'faixa' = '14_17')),
    'meses', (SELECT coalesce(jsonb_agg(jsonb_build_object('mes', m.mes, 'adulto', private.sepse_agregado(m.casos)) ORDER BY m.mes), '[]'::jsonb)
                FROM (SELECT x ->> 'mes' AS mes, jsonb_agg(x) AS casos FROM jsonb_array_elements(casos) x
                       WHERE x ->> 'faixa' = 'adulto' GROUP BY x ->> 'mes') m),
    'motivos_dispensa', (SELECT coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'quantos', n) ORDER BY n DESC), '[]'::jsonb)
                           FROM (SELECT coalesce(nullif(btrim(c.motivo_dispensa), ''), 'sem motivo escrito') AS motivo, count(*) AS n
                                   FROM private.sepse_casos(p_unidade, v_ini, now()) c WHERE c.dispensado GROUP BY 1) d));
END $$;

-- lista de revisão (S4): só o RT, com segundo fator e motivo; cada paciente
-- listado entra no registro de acesso ao prontuário
CREATE OR REPLACE FUNCTION public.casos_revisao_alerta_sepse(p_unidade uuid, p_meses int, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ini timestamptz; r jsonb;
BEGIN
  IF NOT private.sou_rt_medico() THEN
    RAISE EXCEPTION 'A lista de casos é do responsável técnico.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.exigir_segundo_fator();
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Escreva o motivo para abrir a lista de casos (mínimo de 10 letras).';
  END IF;
  v_ini := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
           - make_interval(months => greatest(least(coalesce(p_meses, 6), 24), 1) - 1);
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'episodio_id', c.episodio_id, 'paciente_id', c.paciente_id,
           'paciente', (SELECT p.nome FROM public.pacientes p WHERE p.id = c.paciente_id),
           'chegada_em', c.chegada_em, 'faixa', c.faixa,
           'categoria', CASE WHEN c.sepse AND NOT c.detectado THEN 'sepse_sem_alerta' ELSE 'alerta_sem_sepse' END,
           'suspeita_em', c.suspeita_em, 'sofa', c.sofa, 'alerta_em', c.alerta_em, 'alerta_nivel', c.alerta_nivel,
           'alerta_parcial', c.alerta_parcial, 'alerta_origem', c.alerta_origem,
           'dispensado', c.dispensado, 'motivo_dispensa', c.motivo_dispensa) ORDER BY c.chegada_em DESC), '[]'::jsonb)
    INTO r
    FROM private.sepse_casos(p_unidade, v_ini, now()) c
   WHERE (c.sepse AND NOT c.detectado) OR (c.alerta_em IS NOT NULL AND NOT c.sepse);
  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso, motivo, ip, user_agent)
  SELECT u.organizacao_id, u.id, s.paciente_id, private.meu_perfil_id(), nullif(private.papel_na_unidade(u.id), ''),
         'leitura_prontuario', 'Revisão do alerta de sepse (SP1): ' || btrim(p_motivo), private.requisicao_ip(), private.requisicao_navegador()
    FROM (SELECT DISTINCT (x ->> 'paciente_id')::uuid AS paciente_id FROM jsonb_array_elements(r) x) s
    CROSS JOIN public.unidades u WHERE u.id = p_unidade;
  PERFORM private.registrar_auditoria('casos_revisao_alerta_sepse', 'avisos_sepse_atendimento', NULL, p_unidade,
    jsonb_build_object('quantidade', jsonb_array_length(r)));
  RETURN r;
END $$;

-- ── 5. permissões ───────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.sofa_janela(uuid, timestamptz, timestamptz),
  private.sepse_casos(uuid, timestamptz, timestamptz), private.sepse_agregado(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_alerta_sepse_internacao(uuid, uuid), public.desempenho_alerta_sepse(uuid, int),
  public.casos_revisao_alerta_sepse(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_alerta_sepse_internacao(uuid, uuid), public.desempenho_alerta_sepse(uuid, int),
  public.casos_revisao_alerta_sepse(uuid, int, text) TO authenticated;
