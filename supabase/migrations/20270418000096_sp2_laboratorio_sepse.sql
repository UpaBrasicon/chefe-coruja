-- ════════════════════════════════════════════════════════════════════════════
-- SP2, decisões L1–L5 = A do RT (18/11/2026,
-- docs/clinico/SP2-LABORATORIO-PARCEIRO-DIAGNOSTICO.md): laboratório do
-- parceiro para a sepse.
--   L1: a porta FHIR R4 da Fase 5C é a padrão (nada muda aqui).
--   L2: tabela de referência dos exames da sepse, com SIGTAP e LOINC conferidos
--       nas tabelas oficiais carregadas (terminologia.sigtap_procedimento e
--       terminologia.loinc, 18/11/2026); o gestor aplica ao catálogo da unidade.
--       O sistema continua sem deduzir LOINC (1a da Fase 5C).
--   L3: o número do laudo é lido com separador de milhar, vírgula decimal e o
--       sinal (< > <= >=) à parte; o SOFA do SP1 usa a hora da coleta.
--   L4: laudo sem pedido continua recusado (5a); o gestor vê quantos por semana.
--   L5: o kit para o fornecedor fica em docs/api/LIS-KIT-INTEGRACAO.md.
--
-- Expand: tabela, coluna, gatilho e funções novas; troca private.sofa_janela
-- (só a hora do exame). Volta: docs/clinico/SP2-ROLLBACK-20270418000096.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── L2. exames da sepse ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exames_referencia_sepse (
  procedimento  text PRIMARY KEY CHECK (procedimento ~ '^0202[0-9]{6}$'),
  nome_curto    text NOT NULL,
  loinc_pedido  text NOT NULL CHECK (loinc_pedido ~ '^[0-9]{1,7}-[0-9]$'),
  analitos      jsonb NOT NULL,
  ordem         int NOT NULL,
  conferido_em  date NOT NULL
);
ALTER TABLE public.exames_referencia_sepse ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exames_referencia_sepse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.exames_referencia_sepse TO authenticated;
DROP POLICY IF EXISTS exames_referencia_sepse_leitura ON public.exames_referencia_sepse;
CREATE POLICY exames_referencia_sepse_leitura ON public.exames_referencia_sepse FOR SELECT TO authenticated USING (true);

INSERT INTO public.exames_referencia_sepse (procedimento, nome_curto, loinc_pedido, analitos, ordem, conferido_em) VALUES
  ('0202020380', 'Hemograma completo', '58410-2',
   '[{"loinc":"777-3","nome":"Plaquetas"},{"loinc":"6690-2","nome":"Leucócitos"}]', 1, '2026-11-18'),
  ('0202010317', 'Creatinina', '2160-0', '[{"loinc":"2160-0","nome":"Creatinina"}]', 2, '2026-11-18'),
  ('0202010201', 'Bilirrubina total e frações', '1975-2',
   '[{"loinc":"1975-2","nome":"Bilirrubina total"},{"loinc":"1968-7","nome":"Bilirrubina direta"},{"loinc":"1971-1","nome":"Bilirrubina indireta"}]', 3, '2026-11-18'),
  ('0202010732', 'Gasometria arterial', '24336-0',
   '[{"loinc":"2703-7","nome":"PaO2"},{"loinc":"2019-8","nome":"PaCO2"}]', 4, '2026-11-18'),
  ('0202010538', 'Lactato', '2524-7', '[{"loinc":"2524-7","nome":"Lactato (soro ou plasma)"},{"loinc":"32693-4","nome":"Lactato (sangue)"}]', 5, '2026-11-18'),
  ('0202030202', 'Proteína C reativa', '1988-5', '[{"loinc":"1988-5","nome":"Proteína C reativa"}]', 6, '2026-11-18'),
  ('0202080153', 'Hemocultura', '600-7', '[{"loinc":"600-7","nome":"Bactérias identificadas no sangue por cultura"}]', 7, '2026-11-18')
ON CONFLICT (procedimento) DO NOTHING;

-- O gestor aplica: o que falta entra; o que está sem LOINC ganha o da tabela;
-- o que tem outro LOINC fica como está e volta na lista "mantidos".
CREATE OR REPLACE FUNCTION public.aplicar_exames_sepse(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ref record; atual public.exames_unidade; incluidos text[] := '{}'; com_loinc text[] := '{}'; mantidos jsonb := '[]'::jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: a lista de exames é do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  FOR ref IN SELECT * FROM public.exames_referencia_sepse ORDER BY ordem LOOP
    SELECT * INTO atual FROM public.exames_unidade
     WHERE unidade_id = p_unidade AND procedimento = ref.procedimento AND vigente_ate IS NULL;
    IF atual.id IS NULL THEN
      PERFORM public.definir_exame_unidade(p_unidade, ref.procedimento, ref.nome_curto, ref.loinc_pedido, false, 100 + ref.ordem);
      incluidos := incluidos || ref.nome_curto;
    ELSIF atual.loinc IS NULL THEN
      PERFORM public.definir_exame_unidade(p_unidade, ref.procedimento, atual.nome_curto, ref.loinc_pedido, atual.botao, atual.ordem);
      com_loinc := com_loinc || atual.nome_curto;
    ELSIF atual.loinc <> ref.loinc_pedido THEN
      mantidos := mantidos || jsonb_build_object('exame', atual.nome_curto, 'loinc_atual', atual.loinc, 'loinc_referencia', ref.loinc_pedido);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('incluidos', to_jsonb(incluidos), 'loinc_preenchido', to_jsonb(com_loinc), 'mantidos', mantidos);
END $$;

-- ── L3. número do laudo ─────────────────────────────────────────────────────
ALTER TABLE public.exame_resultado_itens ADD COLUMN IF NOT EXISTS comparador text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exame_resultado_itens_comparador') THEN
    ALTER TABLE public.exame_resultado_itens ADD CONSTRAINT exame_resultado_itens_comparador
      CHECK (comparador IS NULL OR comparador IN ('<', '>', '<=', '>='));
  END IF;
END $$;

-- "150.000" = 150000; "1.234,5" = 1234,5; "1,2" e "1.2" = 1,2; "<0,5" = 0,5 com "<".
-- A porta FHIR manda o número do valueQuantity com vírgula decimal, então
-- ponto seguido de grupos de 3 algarismos é sempre milhar.
CREATE OR REPLACE FUNCTION private.valor_do_laudo(p_texto text)
RETURNS TABLE (numero numeric, comparador text)
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE t text := btrim(coalesce(p_texto, '')); c text;
BEGIN
  c := substring(t FROM '^(<=|>=|≤|≥|<|>)');
  IF c IS NOT NULL THEN t := btrim(substr(t, length(c) + 1)); END IF;
  comparador := CASE c WHEN '≤' THEN '<=' WHEN '≥' THEN '>=' ELSE c END;
  numero := CASE
    WHEN t ~ '^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$' THEN replace(replace(t, '.', ''), ',', '.')::numeric
    WHEN t ~ '^-?[0-9]+(,[0-9]+)?$' THEN replace(t, ',', '.')::numeric
    WHEN t ~ '^-?[0-9]+\.[0-9]+$' THEN t::numeric
    END;
  IF numero IS NULL THEN comparador := NULL; END IF;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION private.trg_valor_do_laudo()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM private.valor_do_laudo(NEW.valor_texto);
  IF v.numero IS NOT NULL THEN
    NEW.valor_num := v.numero;
    NEW.comparador := v.comparador;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_exame_resultado_itens_valor ON public.exame_resultado_itens;
CREATE TRIGGER trg_exame_resultado_itens_valor BEFORE INSERT ON public.exame_resultado_itens
  FOR EACH ROW EXECUTE FUNCTION private.trg_valor_do_laudo();

-- SOFA do SP1 com a hora da coleta (do laboratório ou da enfermagem); sem ela, a da liberação.
CREATE OR REPLACE FUNCTION private.sofa_janela(p_paciente uuid, p_de timestamptz, p_ate timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plaq numeric; v_creat numeric; v_bili numeric; v_pf numeric; v_suporte boolean;
  v_pam numeric; v_glasgow numeric; v_vaso int;
  p_resp int; p_coag int; p_hep int; p_cv int; p_snc int; p_renal int;
BEGIN
  -- exames com resultado vigente, pela hora da coleta (SP2, L3) ou da liberação
  WITH it AS (
    SELECT i.loinc, private.norm(i.analito) AS an, i.valor_num AS v, lower(coalesce(i.unidade, '')) AS un,
           coalesce(x.coletado_em, r.liberado_em) AS em
      FROM public.exame_resultado_itens i
      JOIN public.exame_resultados r ON r.id = i.resultado_id AND r.vigente
      JOIN public.exames_pedidos x ON x.id = r.exame_id
     WHERE x.paciente_id = p_paciente AND coalesce(x.coletado_em, r.liberado_em) >= p_de
       AND coalesce(x.coletado_em, r.liberado_em) <= p_ate AND i.valor_num IS NOT NULL)
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

-- ── L4. laudos recusados por pedido não encontrado ──────────────────────────
-- Conta as chamadas de laudo do laboratório com 404 (pedido inexistente, de
-- outra unidade ou em texto livre), das chaves que atendem a unidade.
CREATE OR REPLACE FUNCTION public.recusas_laboratorio_sem_pedido(p_unidade uuid, p_semanas int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: as integrações da unidade são do gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('semana', s.semana, 'recusas', s.n) ORDER BY s.semana DESC)
      FROM (SELECT to_char(date_trunc('week', a.em AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS semana, count(*) AS n
              FROM public.api_acessos a JOIN public.api_chaves c ON c.id = a.chave_id
             WHERE p_unidade = ANY (c.unidades) AND a.recurso = 'laboratorio_laudo' AND a.status = 404
               AND a.em >= now() - make_interval(weeks => greatest(least(coalesce(p_semanas, 8), 52), 1))
             GROUP BY 1) s), '[]'::jsonb);
END $$;

-- ── permissões ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.valor_do_laudo(text), private.trg_valor_do_laudo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplicar_exames_sepse(uuid), public.recusas_laboratorio_sem_pedido(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_exames_sepse(uuid), public.recusas_laboratorio_sem_pedido(uuid, int) TO authenticated;
