-- Fase 3.7 — pediatria: Phoenix para rastreio de sepse e gatilho do PELOD-2.
--
-- Processo da unidade (decisão do usuário, 27/09/2026):
--  * PEWS para todo paciente pediátrico (já em public.acuidade);
--  * PEWS em banda alta (total ≥ 7 ou zona azul) → pendência diária
--    "PELOD-2 do dia" no leito. O CÁLCULO do PELOD-2 só liga quando a tabela
--    original (Leteurtre, Crit Care Med 2013;41:1761-73, Tabela 2) for
--    conferida: o artigo é pago e não foi possível confirmar PAM e creatinina
--    por idade. Até lá a tela diz que a referência não foi carregada;
--  * pediatria com CID de infecção (lista aprovada em 27/09/2026) OU com
--    "suspeita de infecção" marcada pelo médico → Phoenix Sepsis Score sempre.
--
-- Phoenix: Schlapbach LJ et al., JAMA 2024;331(8):665-674 (Table) e
-- Sanchez-Pinto LN et al., JAMA 2024;331(8):675-686 (Table 2, eFigure 9).
-- Transcrição em produto/docs/pesquisa/escores-sepse-disfuncao-pediatrica.md.
-- Decisões de leitura (usuário, 27/09/2026): respiratório 2 pontos pela
-- tabela principal (P/F 100-200, S/F 148-220); valores decimais comparados
-- exatos, sem arredondar. Regras da fonte mantidas: variável não medida não
-- soma ponto; S/F só com SpO2 ≤ 97%; vasoativos = qualquer dose de
-- adrenalina, noradrenalina, dopamina, dobutamina, milrinona, vasopressina;
-- PAM medida de preferência, senão calculada (1/3 PAS + 2/3 PAD); idade não
-- corrigida por prematuridade; não se aplica à internação do nascimento nem
-- a idade pós-concepcional < 37 semanas (a tela avisa: o sistema não sabe).
-- Janela: último valor de cada variável nas últimas 24 horas.

-- ── conceitos novos ─────────────────────────────────────────────────────────
INSERT INTO public.conceito (unidade_id, nome, tipo, unidade_padrao, categoria, ordem_exibicao)
SELECT NULL, x.nome, x.tipo, x.un, x.cat, x.ordem
FROM (VALUES
  ('fio2', 'numerico', '%', 'sinal_vital', 15),
  ('suporte-respiratorio', 'categorico', NULL, 'sinal_vital', 16),
  ('glasgow', 'escore', NULL, 'sinal_vital', 17),
  ('pupilas', 'categorico', NULL, 'sinal_vital', 18),
  ('drogas-vasoativas', 'numerico', 'drogas', 'sinal_vital', 19),
  ('d-dimero', 'numerico', 'mg/L FEU', 'laboratorio', 400)
) x(nome, tipo, un, cat, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.conceito c WHERE c.unidade_id IS NULL AND c.nome = x.nome);

INSERT INTO public.conceito_opcao (conceito_id, rotulo, valor, ordem)
SELECT c.id, x.rotulo, x.valor, x.ordem
FROM public.conceito c
JOIN (VALUES
  ('suporte-respiratorio', 'Nenhum (ar ambiente)', 'nenhum', 1),
  ('suporte-respiratorio', 'Oxigênio (cateter/máscara)', 'o2', 2),
  ('suporte-respiratorio', 'Alto fluxo', 'alto_fluxo', 3),
  ('suporte-respiratorio', 'Ventilação não invasiva', 'vni', 4),
  ('suporte-respiratorio', 'Ventilação mecânica invasiva', 'vmi', 5),
  ('pupilas', 'Reativas', 'reativas', 1),
  ('pupilas', 'Fixas bilateralmente', 'fixas', 2),
  ('pupilas', 'Outra alteração', 'outra', 3)
) AS x(nome, rotulo, valor, ordem) ON x.nome = c.nome AND c.unidade_id IS NULL
ON CONFLICT (conceito_id, rotulo) DO NOTHING;

-- ── CIDs de infecção (lista aprovada pelo usuário em 27/09/2026) ────────────
CREATE TABLE IF NOT EXISTS public.cid_infeccao_regras (
  de    text NOT NULL,
  ate   text NOT NULL,
  grupo text NOT NULL,
  PRIMARY KEY (de, ate)
);
ALTER TABLE public.cid_infeccao_regras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cid_infeccao_leitura ON public.cid_infeccao_regras;
CREATE POLICY cid_infeccao_leitura ON public.cid_infeccao_regras FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.cid_infeccao_regras FROM anon, authenticated;
GRANT SELECT ON public.cid_infeccao_regras TO authenticated;

INSERT INTO public.cid_infeccao_regras (de, ate, grupo) VALUES
  ('A00', 'B89', 'Doenças infecciosas e parasitárias'),
  ('B95', 'B99', 'Agentes infecciosos'),
  ('G00', 'G07', 'SNC — meningites, encefalites, abscessos'),
  ('H66', 'H66', 'Otite média supurativa'),
  ('H70', 'H70', 'Mastoidite'),
  ('I33', 'I33', 'Endocardite aguda e subaguda'),
  ('J00', 'J06', 'Infecções agudas das vias aéreas superiores'),
  ('J09', 'J18', 'Influenza e pneumonias'),
  ('J20', 'J22', 'Bronquite aguda, bronquiolite, IVAI'),
  ('J36', 'J36', 'Abscesso periamigdaliano'),
  ('J85', 'J86', 'Abscesso pulmonar e empiema'),
  ('K35', 'K35', 'Apendicite aguda'),
  ('K61', 'K61', 'Abscesso anal e retal'),
  ('K65', 'K65', 'Peritonite'),
  ('L00', 'L08', 'Infecções da pele e do subcutâneo'),
  ('M00', 'M01', 'Artrite piogênica e infecciosa'),
  ('M86', 'M86', 'Osteomielite'),
  ('N10', 'N10', 'Pielonefrite aguda'),
  ('N30.0', 'N30.0', 'Cistite aguda'),
  ('N39.0', 'N39.0', 'Infecção do trato urinário'),
  ('P35', 'P39', 'Infecções do período perinatal'),
  ('T80.2', 'T80.2', 'Infecção após infusão/transfusão'),
  ('T81.4', 'T81.4', 'Infecção subsequente a procedimento'),
  ('T82.6', 'T82.7', 'Infecção por dispositivo cardíaco/vascular'),
  ('T83.5', 'T83.6', 'Infecção por dispositivo urinário/genital'),
  ('T84.5', 'T84.7', 'Infecção por dispositivo ortopédico'),
  ('T85.7', 'T85.7', 'Infecção por outros dispositivos')
ON CONFLICT (de, ate) DO UPDATE SET grupo = EXCLUDED.grupo;

-- 'j189' / 'J18.9' / ' j18 ' → 'J18.9' / 'J18'
CREATE OR REPLACE FUNCTION private.cid_normalizado(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN c ~ '^[A-Z][0-9]{2}$' THEN c
    WHEN c ~ '^[A-Z][0-9]{2}\.[0-9A-Z]{1,2}$' THEN c
    WHEN c ~ '^[A-Z][0-9]{3,4}$' THEN left(c, 3) || '.' || substr(c, 4)
    ELSE NULL END
  FROM (SELECT upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')) AS c) s
$$;

CREATE OR REPLACE FUNCTION private.grupo_infeccao(p_cid text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.grupo FROM public.cid_infeccao_regras r, (SELECT private.cid_normalizado(p_cid) AS c) n
  WHERE n.c IS NOT NULL AND left(n.c, length(r.de)) BETWEEN r.de AND r.ate
  LIMIT 1
$$;

-- ── suspeita de infecção (marcada pelo médico no episódio) ──────────────────
ALTER TABLE public.episodios
  ADD COLUMN IF NOT EXISTS suspeita_infeccao_em timestamptz,
  ADD COLUMN IF NOT EXISTS suspeita_infeccao_por uuid REFERENCES public.perfis(id);

CREATE OR REPLACE FUNCTION private.episodio_aberto(p_paciente uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT id FROM public.episodios
  WHERE paciente_id = p_paciente AND etapa <> 'encerrado'
  ORDER BY chegada_em DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.marcar_suspeita_infeccao(p_paciente uuid, p_ativa boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ep uuid; v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_ep := private.episodio_aberto(p_paciente);
  IF v_ep IS NULL THEN RAISE EXCEPTION 'O paciente não tem episódio aberto.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.episodios WHERE id = v_ep;
  IF NOT private.paciente_no_meu_plantao(p_paciente) THEN RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.'; END IF;
  IF private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN RAISE EXCEPTION 'A suspeita de infecção é marcada pelo médico.'; END IF;
  UPDATE public.episodios
     SET suspeita_infeccao_em = CASE WHEN p_ativa THEN coalesce(suspeita_infeccao_em, now()) END,
         suspeita_infeccao_por = CASE WHEN p_ativa THEN coalesce(suspeita_infeccao_por, private.meu_perfil_id()) END,
         updated_at = now()
   WHERE id = v_ep;
  PERFORM private.registrar_auditoria(CASE WHEN p_ativa THEN 'suspeita_infeccao' ELSE 'suspeita_infeccao_retirada' END,
    'episodios', v_ep, v_unidade, '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.marcar_suspeita_infeccao(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_suspeita_infeccao(uuid, boolean) TO authenticated;

-- O que liga o Phoenix: suspeita marcada no episódio aberto, ou CID de
-- infecção no atendimento do episódio aberto ou na internação ativa.
CREATE OR REPLACE FUNCTION private.gatilho_infeccao(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ep uuid := private.episodio_aberto(p_paciente); r record;
BEGIN
  IF v_ep IS NOT NULL AND EXISTS (SELECT 1 FROM public.episodios WHERE id = v_ep AND suspeita_infeccao_em IS NOT NULL) THEN
    RETURN jsonb_build_object('motivo', 'suspeita', 'descricao', 'Suspeita de infecção marcada pelo médico');
  END IF;
  FOR r IN
    SELECT a.cid FROM public.atendimento_registros a WHERE a.episodio_id = v_ep AND a.cid IS NOT NULL
    UNION ALL
    SELECT i.cid_principal FROM public.internacoes i
     WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado') AND i.cid_principal IS NOT NULL
  LOOP
    IF private.grupo_infeccao(r.cid) IS NOT NULL THEN
      RETURN jsonb_build_object('motivo', 'cid', 'cid', private.cid_normalizado(r.cid),
                                'descricao', 'CID ' || private.cid_normalizado(r.cid) || ' · ' || private.grupo_infeccao(r.cid));
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

-- Último valor (24 h) de cada conceito pedido, de qualquer categoria.
CREATE OR REPLACE FUNCTION private.ultimos_valores(p_paciente uuid, p_nomes text[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(nome, jsonb_build_object('n', valor_num, 'c', codigo, 'r', rotulo, 'em', aferido_em)), '{}'::jsonb)
  FROM (
    SELECT DISTINCT ON (c.nome) c.nome, o.valor_num, op.valor AS codigo, op.rotulo, o.aferido_em
    FROM public.observacao o
    JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = ANY (p_nomes)
    LEFT JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
    WHERE o.paciente_id = p_paciente AND o.aferido_em > now() - interval '24 hours'
    ORDER BY c.nome, o.aferido_em DESC
  ) s
$$;

-- ── Phoenix Sepsis Score ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.calcular_phoenix(p_paciente uuid, p_meses int, p_gatilho jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v jsonb := private.ultimos_valores(p_paciente, ARRAY['po2', 'fio2', 'saturacao-o2', 'suporte-respiratorio',
    'drogas-vasoativas', 'lactato', 'pressao-arterial-media', 'pressao-arterial-sistolica', 'pressao-arterial-diastolica',
    'plaquetas', 'inr', 'd-dimero', 'fibrinogenio', 'glasgow', 'pupilas']);
  itens jsonb := '[]'::jsonb;
  faltando text[] := '{}';
  num numeric; pf numeric; sf numeric; pam numeric; pam_origem text;
  suporte text := v -> 'suporte-respiratorio' ->> 'c';
  fio2 numeric := (v -> 'fio2' ->> 'n')::numeric;
  resp int := 0; cv int := 0; coag int := 0; neuro int := 0; pt int;
  g int; lim_baixo numeric; lim_alto numeric;
BEGIN
  -- Respiratório (0-3)
  IF (v -> 'po2' ->> 'n') IS NOT NULL AND fio2 > 0 THEN pf := (v -> 'po2' ->> 'n')::numeric / (fio2 / 100); END IF;
  IF (v -> 'saturacao-o2' ->> 'n')::numeric <= 97 AND fio2 > 0 THEN sf := (v -> 'saturacao-o2' ->> 'n')::numeric / (fio2 / 100); END IF;
  IF suporte IS NULL THEN
    faltando := faltando || 'Suporte respiratório'::text;
  ELSIF suporte = 'vmi' THEN
    resp := CASE WHEN pf < 100 OR sf < 148 THEN 3
                 WHEN pf <= 200 OR sf <= 220 THEN 2
                 WHEN pf < 400 OR sf < 292 THEN 1 ELSE 0 END;
  ELSIF suporte <> 'nenhum' THEN
    resp := CASE WHEN pf < 400 OR sf < 292 THEN 1 ELSE 0 END;
  END IF;
  IF suporte IS NOT NULL AND suporte <> 'nenhum' AND pf IS NULL AND sf IS NULL THEN
    faltando := faltando || 'PaO₂/FiO₂ ou SpO₂/FiO₂ (FiO₂ e PaO₂, ou SpO₂ ≤ 97%)'::text;
  END IF;
  itens := itens || jsonb_build_object('sistema', 'Respiratório', 'pontos', resp, 'maximo', 3,
    'detalhe', concat_ws(' · ', v -> 'suporte-respiratorio' ->> 'r',
      CASE WHEN pf IS NOT NULL THEN 'P/F ' || round(pf) END, CASE WHEN sf IS NOT NULL THEN 'S/F ' || round(sf) END));

  -- Cardiovascular (0-6): vasoativos, lactato, PAM por idade
  IF (v -> 'drogas-vasoativas' ->> 'n') IS NULL THEN faltando := faltando || 'Drogas vasoativas (número)'::text;
  ELSE
    num := (v -> 'drogas-vasoativas' ->> 'n')::numeric;
    cv := cv + CASE WHEN num >= 2 THEN 2 WHEN num >= 1 THEN 1 ELSE 0 END;
  END IF;
  IF (v -> 'lactato' ->> 'n') IS NULL THEN faltando := faltando || 'Lactato'::text;
  ELSE
    num := (v -> 'lactato' ->> 'n')::numeric;
    cv := cv + CASE WHEN num >= 11 THEN 2 WHEN num >= 5 THEN 1 ELSE 0 END;
  END IF;
  IF (v -> 'pressao-arterial-media' ->> 'n') IS NOT NULL THEN
    pam := (v -> 'pressao-arterial-media' ->> 'n')::numeric; pam_origem := 'PAM medida';
  ELSIF (v -> 'pressao-arterial-sistolica' ->> 'n') IS NOT NULL AND (v -> 'pressao-arterial-diastolica' ->> 'n') IS NOT NULL THEN
    pam := (v -> 'pressao-arterial-sistolica' ->> 'n')::numeric / 3 + 2 * (v -> 'pressao-arterial-diastolica' ->> 'n')::numeric / 3;
    pam_origem := 'PAM calculada';
  END IF;
  IF pam IS NULL THEN faltando := faltando || 'PAM (ou PAS e PAD)'::text;
  ELSE
    g := CASE WHEN p_meses < 1 THEN 0 WHEN p_meses < 12 THEN 1 WHEN p_meses < 24 THEN 2
              WHEN p_meses < 60 THEN 3 WHEN p_meses < 144 THEN 4 ELSE 5 END;
    lim_baixo := (ARRAY[17, 25, 31, 32, 36, 38])[g + 1];
    lim_alto := (ARRAY[30, 38, 43, 44, 48, 51])[g + 1];
    cv := cv + CASE WHEN pam < lim_baixo THEN 2 WHEN pam <= lim_alto THEN 1 ELSE 0 END;
  END IF;
  itens := itens || jsonb_build_object('sistema', 'Cardiovascular', 'pontos', cv, 'maximo', 6,
    'detalhe', concat_ws(' · ',
      CASE WHEN (v -> 'drogas-vasoativas' ->> 'n') IS NOT NULL THEN (v -> 'drogas-vasoativas' ->> 'n') || ' vasoativa(s)' END,
      CASE WHEN (v -> 'lactato' ->> 'n') IS NOT NULL THEN 'lactato ' || (v -> 'lactato' ->> 'n') END,
      CASE WHEN pam IS NOT NULL THEN pam_origem || ' ' || round(pam, 1) END));

  -- Coagulação (0-2): 1 ponto cada, máximo 2
  pt := 0;
  IF (v -> 'plaquetas' ->> 'n') IS NULL THEN faltando := faltando || 'Plaquetas'::text;
  ELSIF (v -> 'plaquetas' ->> 'n')::numeric < 100000 THEN pt := pt + 1; END IF;   -- 100 × 10³/μL = 100.000/mm³
  IF (v -> 'inr' ->> 'n') IS NULL THEN faltando := faltando || 'INR'::text;
  ELSIF (v -> 'inr' ->> 'n')::numeric > 1.3 THEN pt := pt + 1; END IF;
  IF (v -> 'd-dimero' ->> 'n') IS NULL THEN faltando := faltando || 'D-dímero (mg/L FEU)'::text;
  ELSIF (v -> 'd-dimero' ->> 'n')::numeric > 2 THEN pt := pt + 1; END IF;
  IF (v -> 'fibrinogenio' ->> 'n') IS NULL THEN faltando := faltando || 'Fibrinogênio'::text;
  ELSIF (v -> 'fibrinogenio' ->> 'n')::numeric < 100 THEN pt := pt + 1; END IF;
  coag := least(pt, 2);
  itens := itens || jsonb_build_object('sistema', 'Coagulação', 'pontos', coag, 'maximo', 2,
    'detalhe', concat_ws(' · ',
      CASE WHEN (v -> 'plaquetas' ->> 'n') IS NOT NULL THEN 'plaquetas ' || (v -> 'plaquetas' ->> 'n') END,
      CASE WHEN (v -> 'inr' ->> 'n') IS NOT NULL THEN 'INR ' || (v -> 'inr' ->> 'n') END,
      CASE WHEN (v -> 'd-dimero' ->> 'n') IS NOT NULL THEN 'D-dímero ' || (v -> 'd-dimero' ->> 'n') END,
      CASE WHEN (v -> 'fibrinogenio' ->> 'n') IS NOT NULL THEN 'fibrinogênio ' || (v -> 'fibrinogenio' ->> 'n') END));

  -- Neurológico (0-2): pupilas fixas bilateralmente = 2; Glasgow ≤ 10 = 1
  IF (v -> 'glasgow' ->> 'n') IS NULL THEN faltando := faltando || 'Glasgow'::text; END IF;
  IF (v -> 'pupilas' ->> 'c') IS NULL THEN faltando := faltando || 'Pupilas'::text; END IF;
  neuro := CASE WHEN v -> 'pupilas' ->> 'c' = 'fixas' THEN 2
                WHEN (v -> 'glasgow' ->> 'n')::numeric <= 10 THEN 1 ELSE 0 END;
  itens := itens || jsonb_build_object('sistema', 'Neurológico', 'pontos', neuro, 'maximo', 2,
    'detalhe', concat_ws(' · ',
      CASE WHEN (v -> 'glasgow' ->> 'n') IS NOT NULL THEN 'Glasgow ' || (v -> 'glasgow' ->> 'n') END,
      v -> 'pupilas' ->> 'r'));

  RETURN jsonb_build_object(
    'total', resp + cv + coag + neuro,
    'cardiovascular', cv,
    'sepse', resp + cv + coag + neuro >= 2,
    'choque', resp + cv + coag + neuro >= 2 AND cv >= 1,
    'itens', itens,
    'faltando', to_jsonb(faltando),
    'parcial', cardinality(faltando) > 0,
    'gatilho', p_gatilho,
    'fonte', 'Phoenix Sepsis Score: Schlapbach et al., JAMA 2024;331(8):665-674 (Table); Sanchez-Pinto et al., JAMA 2024;331(8):675-686. Sepse = infecção suspeita ou confirmada com escore ≥ 2; choque séptico = sepse com ≥ 1 ponto cardiovascular.',
    'notas', 'Último valor de cada variável nas últimas 24 h; variável não medida não soma ponto. Não se aplica à internação do nascimento nem a idade pós-concepcional < 37 semanas. Diagnóstico e conduta são da equipe.');
END $$;

-- ── acuidade passa a trazer o Phoenix e a situação do PELOD-2 ───────────────
CREATE OR REPLACE FUNCTION public.acuidade(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid; v_nasc date; v_meses int; r jsonb; g jsonb;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  SELECT unidade_id, data_nascimento INTO v_unidade, v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.papel_na_unidade(v_unidade) = 'gestor' OR private.paciente_no_meu_plantao(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  r := private.calcular_acuidade(p_paciente);
  IF r ->> 'escala' = 'PEWS' THEN
    v_meses := (extract(year FROM age(current_date, v_nasc)) * 12 + extract(month FROM age(current_date, v_nasc)))::int;
    g := private.gatilho_infeccao(p_paciente);
    IF g IS NOT NULL THEN r := r || jsonb_build_object('phoenix', private.calcular_phoenix(p_paciente, v_meses, g)); END IF;
    r := r || jsonb_build_object('pelod2', jsonb_build_object(
      'indicado', (r ->> 'banda')::int = 2,
      'referencia_carregada', false,
      'mensagem', 'PELOD-2: referência ainda não carregada — aguardando conferência da tabela original (Leteurtre et al., Crit Care Med 2013;41:1761-73). Validado em UTI pediátrica; o uso na enfermaria por PEWS alto é processo da unidade.'));
  END IF;
  RETURN r;
END $$;

-- ── pendência diária "PELOD-2 do dia" quando o PEWS está em banda alta ──────
ALTER TABLE public.pendencias
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'sistema')),
  ADD COLUMN IF NOT EXISTS chave text;
ALTER TABLE public.pendencias ALTER COLUMN autor_id DROP NOT NULL;
ALTER TABLE public.pendencias DROP CONSTRAINT IF EXISTS pendencias_autor_ou_sistema;
ALTER TABLE public.pendencias ADD CONSTRAINT pendencias_autor_ou_sistema CHECK (origem = 'sistema' OR autor_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pendencia_chave ON public.pendencias (internacao_id, chave) WHERE chave IS NOT NULL;

-- Cria (uma vez por dia civil de Brasília) a pendência do PELOD-2 se o
-- paciente é pediátrico, está internado/em observação e o PEWS está alto.
CREATE OR REPLACE FUNCTION private.pelod2_do_dia(p_paciente uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes; a jsonb; v_chave text;
BEGIN
  SELECT * INTO i FROM public.internacoes
   WHERE paciente_id = p_paciente AND status IN ('admitido', 'em_observacao', 'internado')
   ORDER BY data_admissao DESC LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  a := private.calcular_acuidade(p_paciente);
  IF a ->> 'escala' IS DISTINCT FROM 'PEWS' OR coalesce((a ->> 'banda')::int, 0) < 2 THEN RETURN false; END IF;
  v_chave := 'pelod2:' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD');
  INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, prazo, impeditiva, autor_id, origem, chave)
  VALUES (i.unidade_id, i.paciente_id, i.id, 'reavaliacao',
          'PELOD-2 do dia (PEWS alto): colher e registrar as variáveis de disfunção orgânica.',
          now() + interval '24 hours', false, NULL, 'sistema', v_chave)
  ON CONFLICT (internacao_id, chave) WHERE chave IS NOT NULL DO NOTHING;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION private.observacao_dispara_pelod2() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.conceito c WHERE c.id = NEW.conceito_id AND c.categoria = 'sinal_vital')
     AND EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = NEW.paciente_id
                   AND p.data_nascimento > current_date - interval '14 years') THEN
    PERFORM private.pelod2_do_dia(NEW.paciente_id);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_observacao_pelod2 ON public.observacao;
CREATE TRIGGER trg_observacao_pelod2 AFTER INSERT ON public.observacao
  FOR EACH ROW EXECUTE FUNCTION private.observacao_dispara_pelod2();

-- Rotina diária (07:00 de Brasília): quem segue com PEWS alto ganha a do dia,
-- mesmo sem aferição nova.
CREATE OR REPLACE FUNCTION private.pelod2_rotina()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; r record;
BEGIN
  FOR r IN
    SELECT DISTINCT i.paciente_id FROM public.internacoes i
    JOIN public.pacientes p ON p.id = i.paciente_id
    WHERE i.status IN ('admitido', 'em_observacao', 'internado')
      AND p.data_nascimento > current_date - interval '14 years'
  LOOP
    IF private.pelod2_do_dia(r.paciente_id) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'pelod2-do-dia';
  PERFORM cron.schedule('pelod2-do-dia', '0 10 * * *', 'SELECT private.pelod2_rotina()');
END $$;

-- ── alertas de sepse para a lista do painel ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.alertas_sepse(p_unidade uuid)
RETURNS TABLE (paciente_id uuid, nivel text, total int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; ph jsonb; g jsonb; v_meses int;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  FOR r IN
    SELECT DISTINCT p.id, p.data_nascimento FROM public.internacoes i
    JOIN public.pacientes p ON p.id = i.paciente_id
    WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
      AND p.data_nascimento > current_date - interval '14 years'
      AND (private.papel_na_unidade(p_unidade) = 'gestor' OR private.paciente_no_meu_plantao(p.id))
  LOOP
    g := private.gatilho_infeccao(r.id);
    CONTINUE WHEN g IS NULL;
    v_meses := (extract(year FROM age(current_date, r.data_nascimento)) * 12 + extract(month FROM age(current_date, r.data_nascimento)))::int;
    ph := private.calcular_phoenix(r.id, v_meses, g);
    paciente_id := r.id;
    total := (ph ->> 'total')::int;
    nivel := CASE WHEN (ph ->> 'choque')::boolean THEN 'choque' WHEN (ph ->> 'sepse')::boolean THEN 'sepse' ELSE 'rastreio' END;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.alertas_sepse(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alertas_sepse(uuid) TO authenticated;

REVOKE ALL ON FUNCTION private.calcular_phoenix(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gatilho_infeccao(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ultimos_valores(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pelod2_do_dia(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pelod2_rotina() FROM PUBLIC, anon, authenticated;

-- ── Almanaque do Hermes ─────────────────────────────────────────────────────
INSERT INTO public.hermes_almanaque (pergunta, palavras, resposta) VALUES
('Como funciona o rastreio de sepse na pediatria?', 'sepse phoenix pelod pelod-2 choque séptico infecção criança pediatria suspeita',
 'Toda criança (antes dos 14 anos) tem PEWS. Com CID de infecção no episódio, ou com "suspeita de infecção" marcada pelo médico, o leito calcula o Phoenix Sepsis Score (JAMA 2024): 2 pontos ou mais indicam critérios de sepse; com ponto cardiovascular, de choque séptico. O painel mostra o alerta na linha do paciente. PEWS em banda alta abre a pendência diária "PELOD-2 do dia"; o cálculo do PELOD-2 liga quando a tabela original for conferida. Diagnóstico e conduta são da equipe.')
ON CONFLICT (pergunta) DO UPDATE SET palavras = EXCLUDED.palavras, resposta = EXCLUDED.resposta, atualizado_em = now();
