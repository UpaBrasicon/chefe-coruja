-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 4 do Portão de 11/10/2026: registro de contenção mecânica.
-- Diagnóstico e decisão do RT (10/11/2026, A em K1 a K10):
--   docs/porta/LACUNA-04-CONTENCAO-DIAGNOSTICO.md
--
-- Fontes (texto conferido em 10/11/2026):
--   - Resolução COFEN nº 746/2024, de 20/03/2024 (DOU de 03/04/2024), a regra:
--       Art. 1º a contenção mecânica só quando é o único meio de prevenir dano
--         imediato ou iminente; §1º sob a supervisão direta do enfermeiro;
--       Art. 2º todo paciente contido é monitorado pela enfermagem;
--       Art. 3º o prontuário registra razões, duração, avaliações, eventos
--         adversos e o monitoramento clínico;
--       Art. 4º revoga a Resolução COFEN nº 427/2012.
--   - Nota Técnica GVIMS/GGTES/DIRE5/ANVISA nº 07/2026 (08/10/2026), padrão da
--     unidade (K1): a contenção requer prescrição; o médico prescreve com
--     justificativa, período previsto e critérios de suspensão e renova a cada
--     24 horas; a enfermagem monitora em intervalos que não passem de 1 hora
--     (consciência, sinais vitais, pele e circulação nos membros contidos);
--     família informada; formulário de Registro e Monitoramento da Contenção
--     Mecânica; indicadores (taxa de uso, tempo médio, reavaliação no prazo e
--     eventos adversos).
--   Nenhuma das duas traz regra própria para criança (K9): vale a mesma regra,
--   sem conteúdo clínico pediátrico; o registro mostra que é pediátrico.
--
-- O que faz:
--   K4  prescricao_itens.tipo aceita 'contencao' (a CHECK é trocada por uma
--       maior: nada que valia deixa de valer) e a coluna contencao (jsonb:
--       pontos, período previsto em horas, motivo e critérios de retirada).
--       prescrever() aceita o tipo novo; a descrição e a observação do item
--       saem montadas desses campos (as telas que já mostram o item mostram a
--       ordem inteira). Uma ordem de contenção vigente por paciente: a nova é
--       a renovação e suspende a anterior. A ordem vale 24 h.
--   K5  public.contencoes (início, prescrição ligada, família, retirada; uma
--       ativa por paciente; encerra sozinha na alta, como o isolamento) e
--       public.contencao_revisoes (só inserção; corrigir é retificar). Leitura
--       só pelas RPCs (como as intercorrências), escrita só pelas RPCs.
--   K2  inicia: enfermeiro ou médico. Revisão: enfermeiro ou técnico de
--       enfermagem. Retirada: enfermeiro, técnico ou médico. Família: os três.
--   K3  sem prescrição ligada, a contenção fica com o alerta "sem prescrição"
--       e o médico de plantão do setor do paciente é avisado na hora (e de
--       novo uma vez por dia enquanto faltar).
--   K6  revisão de no máximo 1 h: o atraso é calculado no servidor
--       (private.contencao_estado) e o job "contencao-avisos" (a cada 15 min)
--       avisa o enfermeiro do setor uma vez por janela atrasada; a renovação
--       de 24 h avisa o médico (a 2 h do fim e no vencimento).
--   K8  vale na porta, na observação e na internação; a linha do tempo do
--       prontuário (prontuario_leitura) ganha as chaves contencoes e
--       intercorrencias; relatório do gestor (relatorio_contencoes).
--   K10 folha "Registro de contenção mecânica" pelo folha_relatorio (tipo
--       'contencao'), com o protocolo da impressão como os demais relatórios.
--
-- prescrever, folha_relatorio e prontuario_leitura são trocadas pelo texto
-- atual (pg_get_functiondef), trecho a trecho, como em 20270324000001: trecho
-- que não existe mais para a migration com erro; trecho já trocado é pulado
-- (reaplicável). Conferido em 10/11/2026 na homologação.
--
-- Só expande: tabelas, coluna, funções, gatilhos e job novos; a CHECK do tipo
-- fica maior; três funções com o corpo trocado e a mesma assinatura.
-- Teste: supabase/tests/contencao.sql
--
-- Rollback (testado na homologação, em transação desfeita; o md5 das três
-- funções trocadas volta ao de antes): o bloco comentado no fim deste arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── K4: o tipo novo de item da prescrição ───────────────────────────────────
ALTER TABLE public.prescricao_itens ADD COLUMN IF NOT EXISTS contencao jsonb;
COMMENT ON COLUMN public.prescricao_itens.contencao IS
  'Ordem de contenção mecânica (tipo = contencao): {pontos, periodo_h, motivo, criterios_retirada}. Vale 24 h (Nota Técnica ANVISA 07/2026).';
ALTER TABLE public.prescricao_itens DROP CONSTRAINT IF EXISTS prescricao_itens_tipo_check;
ALTER TABLE public.prescricao_itens ADD CONSTRAINT prescricao_itens_tipo_check
  CHECK (tipo = ANY (ARRAY['medicamento', 'cuidado', 'contencao'])) NOT VALID;
ALTER TABLE public.prescricao_itens VALIDATE CONSTRAINT prescricao_itens_tipo_check;
ALTER TABLE public.prescricao_itens DROP CONSTRAINT IF EXISTS prescricao_itens_contencao_check;
ALTER TABLE public.prescricao_itens ADD CONSTRAINT prescricao_itens_contencao_check
  CHECK (contencao IS NULL OR tipo = 'contencao') NOT VALID;
ALTER TABLE public.prescricao_itens VALIDATE CONSTRAINT prescricao_itens_contencao_check;
CREATE INDEX IF NOT EXISTS prescricao_itens_contencao_vigente ON public.prescricao_itens (prescricao_id)
  WHERE tipo = 'contencao' AND suspenso_em IS NULL;

-- Os campos da ordem, conferidos e normalizados (prescrever chama).
CREATE OR REPLACE FUNCTION private.contencao_item_validado(p_item jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_pontos int; v_periodo int;
  v_motivo text := btrim(coalesce(p_item ->> 'motivo', ''));
  v_criterios text := btrim(coalesce(p_item ->> 'criterios_retirada', ''));
BEGIN
  IF coalesce(p_item ->> 'pontos', '') !~ '^\d{1,2}$' OR coalesce(p_item ->> 'periodo_h', '') !~ '^\d{1,3}$' THEN
    RAISE EXCEPTION 'Contenção: informe os pontos (1 a 5) e o período previsto em horas (1 a 24).';
  END IF;
  v_pontos := (p_item ->> 'pontos')::int;
  v_periodo := (p_item ->> 'periodo_h')::int;
  IF v_pontos NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Contenção: os pontos vão de 1 a 5.'; END IF;
  -- a prescrição vale 24 h (Nota Técnica ANVISA 07/2026): o período previsto cabe nela
  IF v_periodo NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Contenção: o período previsto vai de 1 a 24 horas (a prescrição vale 24 h).'; END IF;
  IF length(v_motivo) < 10 THEN RAISE EXCEPTION 'Contenção: diga o motivo (o dano imediato ou iminente que ela previne).'; END IF;
  IF length(v_criterios) < 10 THEN RAISE EXCEPTION 'Contenção: diga os critérios de retirada.'; END IF;
  RETURN jsonb_build_object('pontos', v_pontos, 'periodo_h', v_periodo, 'motivo', v_motivo, 'criterios_retirada', v_criterios);
END $$;
REVOKE ALL ON FUNCTION private.contencao_item_validado(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.contencao_item_descricao(p jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 'Contenção mecânica em ' || (p ->> 'pontos') || CASE WHEN (p ->> 'pontos') = '1' THEN ' ponto' ELSE ' pontos' END
$$;
REVOKE ALL ON FUNCTION private.contencao_item_descricao(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.contencao_item_observacao(p jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 'Motivo: ' || rtrim(p ->> 'motivo', '. ') || '. Período previsto: até ' || (p ->> 'periodo_h') || ' h. Retirar quando: '
         || rtrim(p ->> 'criterios_retirada', '. ') || '. Vale 24 h; renovar se a contenção continuar.'
$$;
REVOKE ALL ON FUNCTION private.contencao_item_observacao(jsonb) FROM PUBLIC, anon, authenticated;

-- ── K5: o registro ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contencoes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id             uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id            uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id            uuid REFERENCES public.episodios(id),
  internacao_id          uuid REFERENCES public.internacoes(id),
  setor_id               uuid REFERENCES public.setores(id),
  pediatrico             boolean NOT NULL DEFAULT false,
  motivo                 text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  alternativas           text NOT NULL CHECK (length(btrim(alternativas)) >= 5),
  -- membros e locais contidos; os pontos são quantos foram marcados
  locais                 text[] NOT NULL CHECK (cardinality(locais) BETWEEN 1 AND 5
                                                AND locais <@ ARRAY['msd', 'mse', 'mid', 'mie', 'tronco']),
  iniciada_em            timestamptz NOT NULL,
  iniciada_por           uuid NOT NULL REFERENCES public.perfis(id),
  papel_inicio           text NOT NULL CHECK (papel_inicio IN ('enfermeiro', 'plantonista')),
  registrada_em          timestamptz NOT NULL DEFAULT now(),
  prescricao_item_id     uuid REFERENCES public.prescricao_itens(id),
  prescrita_em           timestamptz,
  familia_informada      boolean,
  familia_detalhe        text,
  familia_em             timestamptz,
  familia_registrado_por uuid REFERENCES public.perfis(id),
  retirada_em            timestamptz,
  retirada_por           uuid REFERENCES public.perfis(id),
  motivo_retirada        text,
  retirada_automatica    boolean NOT NULL DEFAULT false,
  CHECK (episodio_id IS NOT NULL OR internacao_id IS NOT NULL),
  CHECK (retirada_em IS NULL OR length(btrim(coalesce(motivo_retirada, ''))) >= 3),
  CHECK (familia_informada IS NULL OR length(btrim(coalesce(familia_detalhe, ''))) >= 3)
);
COMMENT ON TABLE public.contencoes IS
  'Contenção mecânica (lacuna 4; Resolução COFEN 746/2024, Nota Técnica ANVISA 07/2026). Uma ativa por paciente; grava só pelas RPCs.';
CREATE UNIQUE INDEX IF NOT EXISTS contencoes_uma_ativa ON public.contencoes (paciente_id) WHERE retirada_em IS NULL;
CREATE INDEX IF NOT EXISTS contencoes_unidade ON public.contencoes (unidade_id, iniciada_em DESC);
CREATE INDEX IF NOT EXISTS contencoes_ativas_unidade ON public.contencoes (unidade_id) WHERE retirada_em IS NULL;
CREATE INDEX IF NOT EXISTS contencoes_paciente ON public.contencoes (paciente_id, iniciada_em DESC);
CREATE INDEX IF NOT EXISTS contencoes_episodio_id_fk_idx ON public.contencoes (episodio_id);
CREATE INDEX IF NOT EXISTS contencoes_internacao_id_fk_idx ON public.contencoes (internacao_id);
CREATE INDEX IF NOT EXISTS contencoes_setor_id_fk_idx ON public.contencoes (setor_id);
CREATE INDEX IF NOT EXISTS contencoes_prescricao_item_id_fk_idx ON public.contencoes (prescricao_item_id);

CREATE TABLE IF NOT EXISTS public.contencao_revisoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contencao_id      uuid NOT NULL REFERENCES public.contencoes(id),
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id       uuid NOT NULL REFERENCES public.pacientes(id),
  revisada_em       timestamptz NOT NULL,
  consciencia       text NOT NULL CHECK (length(btrim(consciencia)) >= 3),
  rass              smallint CHECK (rass BETWEEN -5 AND 4),
  sinais_vitais     text NOT NULL CHECK (length(btrim(sinais_vitais)) >= 3),   -- como aferidos (crus)
  pele              text NOT NULL CHECK (length(btrim(pele)) >= 3),
  perfusao          text NOT NULL CHECK (length(btrim(perfusao)) >= 3),
  necessidades      text,
  intercorrencia_id uuid REFERENCES public.intercorrencias(id),
  observacao        text,
  retifica_id       uuid REFERENCES public.contencao_revisoes(id),
  registrado_por    uuid NOT NULL REFERENCES public.perfis(id),
  papel             text NOT NULL,
  registrado_em     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.contencao_revisoes IS
  'Revisões da contenção pela enfermagem (até 1 h, Nota Técnica ANVISA 07/2026). Só inserção: corrigir é retificar.';
CREATE INDEX IF NOT EXISTS contencao_revisoes_contencao ON public.contencao_revisoes (contencao_id, revisada_em DESC);
CREATE INDEX IF NOT EXISTS contencao_revisoes_unidade_id_fk_idx ON public.contencao_revisoes (unidade_id);
CREATE INDEX IF NOT EXISTS contencao_revisoes_paciente_id_fk_idx ON public.contencao_revisoes (paciente_id);
CREATE INDEX IF NOT EXISTS contencao_revisoes_intercorrencia_id_fk_idx ON public.contencao_revisoes (intercorrencia_id);
CREATE INDEX IF NOT EXISTS contencao_revisoes_retifica_id_fk_idx ON public.contencao_revisoes (retifica_id);

-- leitura e escrita só pelas RPCs (há nome de paciente e de profissional)
ALTER TABLE public.contencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contencao_revisoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contencoes FROM anon, authenticated;
REVOKE ALL ON public.contencao_revisoes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.contencao_revisao_so_insercao() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'A revisão da contenção é só de inserção: para corrigir, registre de novo retificando a anterior.'; END $$;
DROP TRIGGER IF EXISTS contencao_revisoes_so_insercao ON public.contencao_revisoes;
CREATE TRIGGER contencao_revisoes_so_insercao BEFORE UPDATE OR DELETE ON public.contencao_revisoes
  FOR EACH ROW EXECUTE FUNCTION private.contencao_revisao_so_insercao();

-- ── estado calculado no servidor (K3, K4, K6) ───────────────────────────────
-- Revisão: no máximo 1 h depois da última (ou do início). Prescrição: o item
-- ligado e não suspenso; vale 24 h, com aviso a 2 h do fim.
CREATE OR REPLACE FUNCTION private.contencao_estado(ct public.contencoes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH rv AS (
    SELECT max(r.revisada_em) AS ultima, count(*) AS n
      FROM public.contencao_revisoes r
     WHERE r.contencao_id = ct.id
       AND NOT EXISTS (SELECT 1 FROM public.contencao_revisoes x WHERE x.retifica_id = r.id)
  ), it AS (
    SELECT i.id, i.created_at, i.suspenso_em FROM public.prescricao_itens i WHERE i.id = ct.prescricao_item_id
  ), vale AS (
    SELECT (SELECT it.created_at + interval '24 hours' FROM it WHERE it.suspenso_em IS NULL) AS vence
  )
  SELECT jsonb_build_object(
    'ativa', ct.retirada_em IS NULL,
    'revisoes', rv.n,
    'ultima_revisao_em', rv.ultima,
    'proxima_revisao_em', CASE WHEN ct.retirada_em IS NULL THEN coalesce(rv.ultima, ct.iniciada_em) + interval '1 hour' END,
    'revisao_atrasada', ct.retirada_em IS NULL AND now() > coalesce(rv.ultima, ct.iniciada_em) + interval '1 hour',
    'sem_prescricao', ct.retirada_em IS NULL AND vale.vence IS NULL,
    'prescricao_vence_em', vale.vence,
    'renovacao', CASE WHEN ct.retirada_em IS NOT NULL OR vale.vence IS NULL THEN NULL
                      WHEN now() >= vale.vence THEN 'vencida'
                      WHEN now() >= vale.vence - interval '2 hours' THEN 'perto'
                      ELSE 'em_dia' END)
    FROM rv, vale
$$;
REVOKE ALL ON FUNCTION private.contencao_estado(public.contencoes) FROM PUBLIC, anon, authenticated;

-- Onde o paciente está agora: o setor e um rótulo (leito ou setor) para os avisos.
CREATE OR REPLACE FUNCTION private.contencao_setor(ct public.contencoes)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT i.setor_atual_id FROM public.internacoes i
      WHERE i.paciente_id = ct.paciente_id AND i.data_alta IS NULL AND i.status IN ('admitido', 'em_observacao', 'internado')
      ORDER BY i.data_admissao DESC LIMIT 1),
    (SELECT e.setor_id FROM public.episodios e WHERE e.id = ct.episodio_id),
    ct.setor_id)
$$;
REVOKE ALL ON FUNCTION private.contencao_setor(public.contencoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.contencao_local(ct public.contencoes)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT 'leito ' || l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id
      WHERE i.paciente_id = ct.paciente_id AND i.data_alta IS NULL AND i.status IN ('admitido', 'em_observacao', 'internado')
      ORDER BY i.data_admissao DESC LIMIT 1),
    (SELECT s.nome FROM public.setores s WHERE s.id = private.contencao_setor(ct)),
    'sem setor')
$$;
REVOKE ALL ON FUNCTION private.contencao_local(public.contencoes) FROM PUBLIC, anon, authenticated;

-- Quem recebe o aviso: os escalados agora no setor com o papel; sem ninguém
-- no setor, os da unidade com o papel.
CREATE OR REPLACE FUNCTION private.contencao_destinatarios(p_unidade uuid, p_setor uuid, p_papel text)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT x FROM private.escalados_agora(p_unidade, p_setor, p_papel) x
  UNION
  SELECT y FROM private.escalados_agora(p_unidade, NULL, p_papel) y
   WHERE NOT EXISTS (SELECT 1 FROM private.escalados_agora(p_unidade, p_setor, p_papel))
$$;
REVOKE ALL ON FUNCTION private.contencao_destinatarios(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- K3: aviso ao médico de plantão do setor (uma vez por dia por contenção).
CREATE OR REPLACE FUNCTION private.avisar_contencao_sem_prescricao(p_contencao uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ct public.contencoes; v_nome text; k integer;
BEGIN
  SELECT * INTO ct FROM public.contencoes WHERE id = p_contencao;
  IF ct.id IS NULL OR ct.retirada_em IS NOT NULL THEN RETURN 0; END IF;
  SELECT coalesce(nome_social, nome) INTO v_nome FROM public.pacientes WHERE id = ct.paciente_id;
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT d, ct.unidade_id, private.data_atual(), 'contencao_sem_presc_' || ct.id,
         'Contenção mecânica sem prescrição médica: ' || v_nome || ' (' || private.contencao_local(ct) || '), iniciada às '
         || to_char(ct.iniciada_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
         || CASE ct.papel_inicio WHEN 'plantonista' THEN ' pelo médico. ' ELSE ' pelo enfermeiro. ' END
         || 'Prescreva a contenção (item "Contenção mecânica" da prescrição) ou avalie a retirada.'
    FROM private.contencao_destinatarios(ct.unidade_id, private.contencao_setor(ct), 'plantonista') d
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $$;
REVOKE ALL ON FUNCTION private.avisar_contencao_sem_prescricao(uuid) FROM PUBLIC, anon, authenticated;

-- ── leitura ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.contencao_revisao_json(r public.contencao_revisoes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', r.id, 'revisada_em', r.revisada_em, 'consciencia', r.consciencia, 'rass', r.rass,
    'sinais_vitais', r.sinais_vitais, 'pele', r.pele, 'perfusao', r.perfusao, 'necessidades', r.necessidades,
    'observacao', r.observacao, 'intercorrencia_id', r.intercorrencia_id,
    'intercorrencia', (SELECT CASE WHEN x.tipo = 'outra' THEN x.tipo_outro ELSE t.rotulo END || ' (' || x.gravidade || ')'
                         FROM public.intercorrencias x JOIN public.tipos_intercorrencia t ON t.codigo = x.tipo
                        WHERE x.id = r.intercorrencia_id),
    'registrado_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = r.registrado_por),
    'papel', r.papel, 'registrado_em', r.registrado_em, 'retifica_id', r.retifica_id,
    'retificada', EXISTS (SELECT 1 FROM public.contencao_revisoes y WHERE y.retifica_id = r.id))
$$;
REVOKE ALL ON FUNCTION private.contencao_revisao_json(public.contencao_revisoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.contencao_json(ct public.contencoes, p_revisoes boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', ct.id, 'paciente_id', ct.paciente_id, 'episodio_id', ct.episodio_id, 'internacao_id', ct.internacao_id,
    'setor', (SELECT s.nome FROM public.setores s WHERE s.id = ct.setor_id),
    'pediatrico', ct.pediatrico, 'motivo', ct.motivo, 'alternativas', ct.alternativas,
    'locais', to_jsonb(ct.locais), 'pontos', cardinality(ct.locais),
    'iniciada_em', ct.iniciada_em, 'registrada_em', ct.registrada_em, 'papel_inicio', ct.papel_inicio,
    'iniciada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = ct.iniciada_por),
    'prescrita_em', ct.prescrita_em,
    'prescricao', (SELECT jsonb_build_object('id', it.id, 'descricao', it.descricao, 'observacao', it.observacao,
                                             'prescrita_em', it.created_at, 'suspenso_em', it.suspenso_em,
                                             'medico', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = it.autor_id))
                     FROM public.prescricao_itens it WHERE it.id = ct.prescricao_item_id),
    'familia_informada', ct.familia_informada, 'familia_detalhe', ct.familia_detalhe, 'familia_em', ct.familia_em,
    'familia_registrado_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = ct.familia_registrado_por),
    'retirada_em', ct.retirada_em, 'motivo_retirada', ct.motivo_retirada, 'retirada_automatica', ct.retirada_automatica,
    'retirada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = ct.retirada_por))
  || private.contencao_estado(ct)
  || CASE WHEN p_revisoes THEN jsonb_build_object('lista_revisoes', coalesce((
         SELECT jsonb_agg(private.contencao_revisao_json(r) ORDER BY r.revisada_em DESC, r.registrado_em DESC)
           FROM public.contencao_revisoes r WHERE r.contencao_id = ct.id), '[]'::jsonb))
     ELSE '{}'::jsonb END
$$;
REVOKE ALL ON FUNCTION private.contencao_json(public.contencoes, boolean) FROM PUBLIC, anon, authenticated;

-- A tela do paciente (leito, gaveta da enfermagem, atendimento): a ativa com
-- as revisões, as anteriores e o que quem chama pode fazer. Mesmo acesso das
-- intercorrências.
CREATE OR REPLACE FUNCTION public.contencao_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes; v_cuida boolean; v_ativa public.contencoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF pa.id IS NULL OR NOT (coalesce(private.gestor_da_unidade(pa.unidade_id), false) OR coalesce(private.pode_atuar_no_paciente(pa.id), false)
                           OR coalesce(private.acesso_encerrado_vigente(pa.id), false)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_cuida := coalesce(private.paciente_em_cuidado_no_plantao(pa.id), false);
  SELECT * INTO v_ativa FROM public.contencoes WHERE paciente_id = pa.id AND retirada_em IS NULL;
  RETURN jsonb_build_object(
    'pediatrico', pa.data_nascimento IS NOT NULL AND private.pediatrico_em(pa.data_nascimento, private.data_atual()),
    'pode_iniciar', v_cuida AND v_ativa.id IS NULL
                    AND (private.tenho_papel(pa.unidade_id, 'enfermeiro') IS TRUE OR private.tenho_papel(pa.unidade_id, 'plantonista') IS TRUE),
    'pode_revisar', v_cuida AND private.sou_enfermagem(pa.unidade_id) IS TRUE,
    'pode_retirar', v_cuida AND (private.sou_enfermagem(pa.unidade_id) IS TRUE OR private.tenho_papel(pa.unidade_id, 'plantonista') IS TRUE),
    'ativa', CASE WHEN v_ativa.id IS NOT NULL THEN private.contencao_json(v_ativa, true) END,
    'anteriores', coalesce((SELECT jsonb_agg(private.contencao_json(x, true) ORDER BY x.iniciada_em DESC)
                              FROM public.contencoes x
                             WHERE x.id IN (SELECT c.id FROM public.contencoes c
                                             WHERE c.paciente_id = pa.id AND c.retirada_em IS NOT NULL
                                             ORDER BY c.iniciada_em DESC LIMIT 20)), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.contencao_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contencao_do_paciente(uuid) TO authenticated;

-- As listas da enfermagem (PS, observação, internação): as ativas da unidade
-- dos pacientes que quem chama acompanha, com os selos.
CREATE OR REPLACE FUNCTION public.contencoes_ativas(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.membro_da_unidade(p_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('contencao_id', x.id, 'paciente_id', x.paciente_id, 'iniciada_em', x.iniciada_em,
                                        'pediatrico', x.pediatrico) || private.contencao_estado(x))
      FROM public.contencoes x
     WHERE x.unidade_id = p_unidade AND x.retirada_em IS NULL
       AND coalesce(private.pode_atuar_no_paciente(x.paciente_id), false)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.contencoes_ativas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contencoes_ativas(uuid) TO authenticated;

-- ── iniciar, revisar, família, retirar ──────────────────────────────────────
-- p_dados: {motivo, alternativas, locais: [msd, mse, mid, mie, tronco],
--           iniciada_em?, familia_informada?, familia_detalhe?}
CREATE OR REPLACE FUNCTION public.iniciar_contencao(p_paciente uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacientes;
  v_int uuid; v_ep uuid; v_unidade uuid; v_setor uuid; v_papel text; v_id uuid; v_item uuid; v_item_em timestamptz;
  v_motivo text := btrim(coalesce(p_dados ->> 'motivo', ''));
  v_alt text := btrim(coalesce(p_dados ->> 'alternativas', ''));
  v_locais text[];
  v_inicio timestamptz;
  v_fam boolean;
  v_fam_det text := nullif(btrim(coalesce(p_dados ->> 'familia_detalhe', '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF pa.id IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  SELECT i.id, i.unidade_id, i.setor_atual_id INTO v_int, v_unidade, v_setor FROM public.internacoes i
   WHERE i.paciente_id = pa.id AND i.data_alta IS NULL AND i.status IN ('admitido', 'em_observacao', 'internado')
   ORDER BY i.data_admissao DESC LIMIT 1;
  v_ep := private.episodio_aberto(pa.id);
  IF v_unidade IS NULL AND v_ep IS NOT NULL THEN
    SELECT e.unidade_id, e.setor_id INTO v_unidade, v_setor FROM public.episodios e WHERE e.id = v_ep;
  END IF;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'O paciente não tem atendimento nem internação aberta: a contenção vale para o atendimento atual.';
  END IF;
  -- K2: enfermeiro ou médico inicia; o técnico revisa e retira
  v_papel := CASE WHEN private.tenho_papel(v_unidade, 'enfermeiro') IS TRUE THEN 'enfermeiro'
                  WHEN private.tenho_papel(v_unidade, 'plantonista') IS TRUE THEN 'plantonista' END;
  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'A contenção é iniciada pelo enfermeiro ou pelo médico. O técnico de enfermagem registra as revisões e a retirada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT coalesce(private.paciente_em_cuidado_no_plantao(pa.id), false) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contencoes WHERE paciente_id = pa.id AND retirada_em IS NULL) THEN
    RAISE EXCEPTION 'O paciente já está em contenção mecânica: registre a revisão ou a retirada.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_motivo) < 10 THEN
    RAISE EXCEPTION 'Diga o motivo da contenção (o dano imediato ou iminente que ela previne).' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_alt) < 5 THEN
    RAISE EXCEPTION 'Diga as alternativas tentadas antes da contenção.' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_typeof(p_dados -> 'locais') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Marque os membros ou locais contidos.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_locais FROM jsonb_array_elements_text(p_dados -> 'locais') x;
  IF coalesce(cardinality(v_locais), 0) = 0 OR NOT v_locais <@ ARRAY['msd', 'mse', 'mid', 'mie', 'tronco'] THEN
    RAISE EXCEPTION 'Marque os membros ou locais contidos.' USING ERRCODE = 'check_violation';
  END IF;
  v_inicio := coalesce(nullif(p_dados ->> 'iniciada_em', '')::timestamptz, now());
  IF v_inicio > now() + interval '5 minutes' OR v_inicio < now() - interval '2 hours' THEN
    RAISE EXCEPTION 'Hora de início entre as últimas 2 horas e agora.' USING ERRCODE = 'check_violation';
  END IF;
  v_fam := nullif(p_dados ->> 'familia_informada', '')::boolean;
  IF v_fam IS NOT NULL AND length(coalesce(v_fam_det, '')) < 3 THEN
    RAISE EXCEPTION 'Diga quem da família foi informado ou por que não foi.' USING ERRCODE = 'check_violation';
  END IF;

  -- a ordem de contenção vigente do paciente, se o médico prescreveu antes
  SELECT it.id, it.created_at INTO v_item, v_item_em
    FROM public.prescricao_itens it JOIN public.prescricoes p ON p.id = it.prescricao_id
   WHERE p.paciente_id = pa.id AND p.status = 'ativa' AND it.tipo = 'contencao' AND it.suspenso_em IS NULL
     AND it.created_at > now() - interval '24 hours'
   ORDER BY it.created_at DESC LIMIT 1;

  INSERT INTO public.contencoes (unidade_id, paciente_id, episodio_id, internacao_id, setor_id, pediatrico, motivo, alternativas, locais,
                                 iniciada_em, iniciada_por, papel_inicio, prescricao_item_id, prescrita_em,
                                 familia_informada, familia_detalhe, familia_em, familia_registrado_por)
  VALUES (v_unidade, pa.id, v_ep, v_int, v_setor,
          pa.data_nascimento IS NOT NULL AND private.pediatrico_em(pa.data_nascimento, private.data_atual()),
          v_motivo, v_alt, v_locais, v_inicio, private.meu_perfil_id(), v_papel, v_item, v_item_em,
          v_fam, CASE WHEN v_fam IS NOT NULL THEN v_fam_det END, CASE WHEN v_fam IS NOT NULL THEN now() END,
          CASE WHEN v_fam IS NOT NULL THEN private.meu_perfil_id() END)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('contencao_iniciada', 'contencoes', v_id, v_unidade,
    jsonb_build_object('papel', v_papel, 'situacao', CASE WHEN v_item IS NULL THEN 'sem_prescricao' ELSE 'prescrita' END));
  -- K3: iniciada sem prescrição (urgência): o médico de plantão é avisado na hora
  IF v_item IS NULL THEN PERFORM private.avisar_contencao_sem_prescricao(v_id); END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.iniciar_contencao(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_contencao(uuid, jsonb) TO authenticated;

-- p_dados: {revisada_em?, consciencia, rass?, sinais_vitais, pele, perfusao,
--           necessidades?, intercorrencia_id?, observacao?}
CREATE OR REPLACE FUNCTION public.revisar_contencao(p_contencao uuid, p_dados jsonb, p_retifica uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  ct public.contencoes; ant public.contencao_revisoes; v_papel text; v_id uuid; v_quando timestamptz; v_rass smallint; v_inter uuid;
  v_consc text := btrim(coalesce(p_dados ->> 'consciencia', ''));
  v_sv text := btrim(coalesce(p_dados ->> 'sinais_vitais', ''));
  v_pele text := btrim(coalesce(p_dados ->> 'pele', ''));
  v_perf text := btrim(coalesce(p_dados ->> 'perfusao', ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO ct FROM public.contencoes WHERE id = p_contencao;
  IF ct.id IS NULL THEN RAISE EXCEPTION 'Contenção não encontrada.'; END IF;
  -- K2: a revisão é da enfermagem (COFEN 746/2024, Art. 2º)
  v_papel := CASE WHEN private.tenho_papel(ct.unidade_id, 'enfermeiro') IS TRUE THEN 'enfermeiro'
                  WHEN private.tenho_papel(ct.unidade_id, 'tecnico_enfermagem') IS TRUE THEN 'tecnico_enfermagem' END;
  IF v_papel IS NULL OR NOT coalesce(private.paciente_em_cuidado_no_plantao(ct.paciente_id), false) THEN
    RAISE EXCEPTION 'A revisão da contenção é da enfermagem (enfermeiro ou técnico) de plantão com o paciente.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_retifica IS NULL AND ct.retirada_em IS NOT NULL THEN RAISE EXCEPTION 'Esta contenção já foi retirada.'; END IF;
  IF p_retifica IS NOT NULL THEN
    SELECT * INTO ant FROM public.contencao_revisoes WHERE id = p_retifica;
    IF ant.id IS NULL OR ant.contencao_id <> ct.id THEN RAISE EXCEPTION 'A revisão a retificar não é desta contenção.'; END IF;
    IF EXISTS (SELECT 1 FROM public.contencao_revisoes WHERE retifica_id = p_retifica) THEN
      RAISE EXCEPTION 'Esta revisão já foi retificada: retifique a versão mais nova.';
    END IF;
  END IF;
  v_quando := coalesce(nullif(p_dados ->> 'revisada_em', '')::timestamptz, now());
  IF v_quando > now() + interval '5 minutes' OR v_quando < ct.iniciada_em
     OR (p_retifica IS NULL AND v_quando < now() - interval '2 hours') THEN
    RAISE EXCEPTION 'Hora da revisão entre o início da contenção (até 2 horas atrás) e agora.';
  END IF;
  IF length(v_consc) < 3 THEN RAISE EXCEPTION 'Descreva o nível de consciência.'; END IF;
  IF nullif(p_dados ->> 'rass', '') IS NOT NULL THEN
    IF (p_dados ->> 'rass') !~ '^[+-]?\d$' OR (p_dados ->> 'rass')::int NOT BETWEEN -5 AND 4 THEN
      RAISE EXCEPTION 'RASS vai de -5 a +4.';
    END IF;
    -- o RASS do app é escala de adulto (src/clinico/escores/rass.ts): na
    -- criança, só a descrição da consciência (K9, sem conteúdo pediátrico)
    IF ct.pediatrico THEN RAISE EXCEPTION 'O RASS é escala de adulto: no paciente pediátrico, descreva a consciência.'; END IF;
    v_rass := (p_dados ->> 'rass')::smallint;
  END IF;
  IF length(v_sv) < 3 THEN RAISE EXCEPTION 'Registre os sinais vitais como aferidos.'; END IF;
  IF length(v_pele) < 3 THEN RAISE EXCEPTION 'Descreva a pele nos locais contidos.'; END IF;
  IF length(v_perf) < 3 THEN RAISE EXCEPTION 'Descreva a circulação (perfusão) dos membros contidos.'; END IF;
  v_inter := nullif(p_dados ->> 'intercorrencia_id', '')::uuid;
  IF v_inter IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.intercorrencias x
                                          WHERE x.id = v_inter AND x.paciente_id = ct.paciente_id
                                            AND x.ocorrida_em >= ct.iniciada_em - interval '5 minutes') THEN
    RAISE EXCEPTION 'A intercorrência ligada tem de ser deste paciente e ter ocorrido durante a contenção.';
  END IF;
  INSERT INTO public.contencao_revisoes (contencao_id, unidade_id, paciente_id, revisada_em, consciencia, rass, sinais_vitais, pele,
                                         perfusao, necessidades, intercorrencia_id, observacao, retifica_id, registrado_por, papel)
  VALUES (ct.id, ct.unidade_id, ct.paciente_id, v_quando, v_consc, v_rass, v_sv, v_pele, v_perf,
          nullif(btrim(coalesce(p_dados ->> 'necessidades', '')), ''), v_inter,
          nullif(btrim(coalesce(p_dados ->> 'observacao', '')), ''), p_retifica, private.meu_perfil_id(), v_papel)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('contencao_revisada', 'contencoes', ct.id, ct.unidade_id,
    jsonb_build_object('papel', v_papel, 'retifica', p_retifica IS NOT NULL));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.revisar_contencao(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revisar_contencao(uuid, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.informar_familia_contencao(p_contencao uuid, p_informada boolean, p_detalhe text,
                                                             p_em timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ct public.contencoes; v_em timestamptz := coalesce(p_em, now());
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO ct FROM public.contencoes WHERE id = p_contencao FOR UPDATE;
  IF ct.id IS NULL THEN RAISE EXCEPTION 'Contenção não encontrada.'; END IF;
  IF NOT (private.sou_enfermagem(ct.unidade_id) IS TRUE OR private.tenho_papel(ct.unidade_id, 'plantonista') IS TRUE)
     OR NOT coalesce(private.paciente_em_cuidado_no_plantao(ct.paciente_id), false) THEN
    RAISE EXCEPTION 'A comunicação à família é registrada pela enfermagem ou pelo médico de plantão com o paciente.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_informada IS NULL THEN RAISE EXCEPTION 'Diga se a família foi informada.'; END IF;
  IF length(btrim(coalesce(p_detalhe, ''))) < 3 THEN RAISE EXCEPTION 'Diga quem da família foi informado ou por que não foi.'; END IF;
  IF v_em > now() + interval '5 minutes' OR v_em < ct.iniciada_em - interval '2 hours' THEN
    RAISE EXCEPTION 'Hora da comunicação entre o início da contenção e agora.';
  END IF;
  UPDATE public.contencoes
     SET familia_informada = p_informada, familia_detalhe = btrim(p_detalhe), familia_em = v_em,
         familia_registrado_por = private.meu_perfil_id()
   WHERE id = ct.id;
  PERFORM private.registrar_auditoria('contencao_familia', 'contencoes', ct.id, ct.unidade_id,
    jsonb_build_object('situacao', CASE WHEN p_informada THEN 'informada' ELSE 'nao_informada' END));
END $$;
REVOKE ALL ON FUNCTION public.informar_familia_contencao(uuid, boolean, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.informar_familia_contencao(uuid, boolean, text, timestamptz) TO authenticated;

-- A ordem de contenção do paciente sai junto com a contenção (a ordem já diz
-- os critérios de retirada) e na renovação (fica uma vigente).
CREATE OR REPLACE FUNCTION private.suspender_ordens_contencao(p_paciente uuid, p_exceto uuid, p_motivo text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.prescricao_itens x
     SET suspenso_em = now(), suspenso_por = private.meu_perfil_id(), motivo_suspensao = p_motivo
   WHERE x.tipo = 'contencao' AND x.suspenso_em IS NULL AND x.id IS DISTINCT FROM p_exceto
     AND x.prescricao_id IN (SELECT p.id FROM public.prescricoes p WHERE p.paciente_id = p_paciente AND p.status = 'ativa')
$$;
REVOKE ALL ON FUNCTION private.suspender_ordens_contencao(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.retirar_contencao(p_contencao uuid, p_motivo text, p_retirada_em timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ct public.contencoes; v_motivo text := btrim(coalesce(p_motivo, '')); v_em timestamptz := coalesce(p_retirada_em, now());
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO ct FROM public.contencoes WHERE id = p_contencao FOR UPDATE;
  IF ct.id IS NULL THEN RAISE EXCEPTION 'Contenção não encontrada.'; END IF;
  IF ct.retirada_em IS NOT NULL THEN RAISE EXCEPTION 'Esta contenção já foi retirada.'; END IF;
  IF NOT (private.sou_enfermagem(ct.unidade_id) IS TRUE OR private.tenho_papel(ct.unidade_id, 'plantonista') IS TRUE)
     OR NOT coalesce(private.paciente_em_cuidado_no_plantao(ct.paciente_id), false) THEN
    RAISE EXCEPTION 'A retirada é registrada pela enfermagem ou pelo médico de plantão com o paciente.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(v_motivo) < 5 THEN RAISE EXCEPTION 'Diga por que a contenção sai (o critério de retirada atingido).'; END IF;
  IF v_em > now() + interval '5 minutes' OR v_em < ct.iniciada_em OR v_em < now() - interval '2 hours' THEN
    RAISE EXCEPTION 'Hora da retirada entre o início da contenção (até 2 horas atrás) e agora.';
  END IF;
  UPDATE public.contencoes SET retirada_em = v_em, retirada_por = private.meu_perfil_id(), motivo_retirada = v_motivo
   WHERE id = ct.id;
  PERFORM private.suspender_ordens_contencao(ct.paciente_id, NULL, 'Contenção retirada: ' || v_motivo);
  PERFORM private.registrar_auditoria('contencao_retirada', 'contencoes', ct.id, ct.unidade_id, jsonb_build_object('situacao', 'retirada'));
END $$;
REVOKE ALL ON FUNCTION public.retirar_contencao(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_contencao(uuid, text, timestamptz) TO authenticated;

-- K4: a ordem nova liga na contenção ativa e é a renovação da anterior
-- (prescrever chama depois de gravar o item).
CREATE OR REPLACE FUNCTION private.contencao_prescrita(p_item uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_pac uuid; v_id uuid; v_unidade uuid;
BEGIN
  SELECT p.paciente_id INTO v_pac FROM public.prescricao_itens it JOIN public.prescricoes p ON p.id = it.prescricao_id
   WHERE it.id = p_item AND it.tipo = 'contencao';
  IF v_pac IS NULL THEN RETURN; END IF;
  PERFORM private.suspender_ordens_contencao(v_pac, p_item, 'Renovada: nova prescrição de contenção mecânica');
  UPDATE public.contencoes SET prescricao_item_id = p_item, prescrita_em = coalesce(prescrita_em, now())
   WHERE paciente_id = v_pac AND retirada_em IS NULL
  RETURNING id, unidade_id INTO v_id, v_unidade;
  IF v_id IS NOT NULL THEN
    PERFORM private.registrar_auditoria('contencao_prescrita', 'contencoes', v_id, v_unidade, jsonb_build_object('situacao', 'prescrita'));
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.contencao_prescrita(uuid) FROM PUBLIC, anon, authenticated;

-- ── fim na alta (como o isolamento) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.encerrar_contencao(p_paciente uuid, p_por uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record;
BEGIN
  FOR r IN
    UPDATE public.contencoes
       SET retirada_em = now(), retirada_por = coalesce(p_por, iniciada_por), motivo_retirada = p_motivo, retirada_automatica = true
     WHERE paciente_id = p_paciente AND retirada_em IS NULL
    RETURNING id, unidade_id
  LOOP
    PERFORM private.registrar_auditoria('contencao_retirada', 'contencoes', r.id, r.unidade_id,
      jsonb_build_object('situacao', 'retirada', 'motivo_codigo', 'alta'));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.encerrar_contencao(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.internacao_alta_encerra_contencao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.data_alta IS NULL AND NEW.data_alta IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = NEW.paciente_id AND i.id <> NEW.id
                       AND i.data_alta IS NULL AND i.status IN ('admitido', 'em_observacao', 'internado')) THEN
    PERFORM private.encerrar_contencao(NEW.paciente_id, coalesce(NEW.alta_por, private.meu_perfil_id()),
      'Encerrada com a alta da internação');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_internacao_alta_encerra_contencao ON public.internacoes;
CREATE TRIGGER trg_internacao_alta_encerra_contencao AFTER UPDATE OF data_alta ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.internacao_alta_encerra_contencao();

CREATE OR REPLACE FUNCTION private.episodio_fim_encerra_contencao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.etapa IS DISTINCT FROM 'encerrado' AND NEW.etapa = 'encerrado'
     AND coalesce(NEW.desfecho, '') NOT IN ('internacao', 'observacao')
     AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = NEW.paciente_id AND i.data_alta IS NULL
                       AND i.status IN ('admitido', 'em_observacao', 'internado')) THEN
    PERFORM private.encerrar_contencao(NEW.paciente_id, coalesce(NEW.desfecho_por, NEW.encerrado_por, private.meu_perfil_id()),
      'Encerrada com o desfecho do atendimento');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_episodio_fim_encerra_contencao ON public.episodios;
CREATE TRIGGER trg_episodio_fim_encerra_contencao AFTER UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.episodio_fim_encerra_contencao();

-- ── K6: avisos (job a cada 15 min) ──────────────────────────────────────────
-- Revisão atrasada: o enfermeiro do setor, uma vez por janela (a chave leva a
-- hora em que a revisão vencia). Sem prescrição: o médico, uma vez por dia.
-- Renovação: o médico, uma vez a 2 h do fim e uma vez no vencimento.
CREATE OR REPLACE FUNCTION private.contencao_avisar()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  ct public.contencoes; e jsonb; n integer := 0; k integer;
  v_setor uuid; v_local text; v_nome text; v_prox timestamptz; v_vence timestamptz;
BEGIN
  FOR ct IN SELECT * FROM public.contencoes WHERE retirada_em IS NULL LOOP
    e := private.contencao_estado(ct);
    v_setor := private.contencao_setor(ct);
    v_local := private.contencao_local(ct);
    SELECT coalesce(nome_social, nome) INTO v_nome FROM public.pacientes WHERE id = ct.paciente_id;
    IF (e ->> 'revisao_atrasada')::boolean THEN
      v_prox := (e ->> 'proxima_revisao_em')::timestamptz;
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      SELECT d, ct.unidade_id, private.data_atual(),
             'contencao_revisao_' || ct.id || '_' || to_char(v_prox AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS'),
             'Revisão da contenção atrasada: ' || v_nome || ' (' || v_local || '). Vencia às '
             || to_char(v_prox AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '; a revisão da enfermagem é de no máximo 1 hora.'
        FROM private.contencao_destinatarios(ct.unidade_id, v_setor, 'enfermeiro') d
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    END IF;
    IF (e ->> 'sem_prescricao')::boolean THEN
      n := n + private.avisar_contencao_sem_prescricao(ct.id);
    END IF;
    IF e ->> 'renovacao' IN ('perto', 'vencida') THEN
      v_vence := (e ->> 'prescricao_vence_em')::timestamptz;
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      SELECT d, ct.unidade_id, private.data_atual(),
             'contencao_' || (e ->> 'renovacao') || '_' || ct.prescricao_item_id,
             CASE WHEN e ->> 'renovacao' = 'vencida'
                  THEN 'Prescrição da contenção vencida: ' || v_nome || ' (' || v_local || '). Venceu às '
                       || to_char(v_vence AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '; renove (vale 24 h) ou avalie a retirada.'
                  ELSE 'Renovar a prescrição da contenção: ' || v_nome || ' (' || v_local || '). Vence às '
                       || to_char(v_vence AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' (vale 24 h).' END
        FROM private.contencao_destinatarios(ct.unidade_id, v_setor, 'plantonista') d
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.contencao_avisar() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'contencao-avisos';
SELECT cron.schedule('contencao-avisos', '*/15 * * * *', 'SELECT private.contencao_avisar();');

-- ── K8: relatório do gestor (indicadores da Nota Técnica ANVISA 07/2026) ────
-- Contenções iniciadas no período. Taxa de uso = pacientes contidos /
-- pacientes atendidos ou internados no período. Tempo médio = horas das
-- contenções encerradas / pacientes delas. Revisões no prazo: cada hora
-- inteira de contenção prevê uma revisão; conta no prazo a revisão que veio
-- até 1 h depois da anterior (ou do início). Eventos adversos: intercorrências
-- ligadas às revisões. Sem nome de paciente (não vai à trilha).
CREATE OR REPLACE FUNCTION public.relatorio_contencoes(p_unidade uuid, p_de date, p_ate date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ini timestamptz; v_fim timestamptz; v_res jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.gestor_da_unidade(p_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado: relatório do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de OR p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período inválido (até 1 ano).'; END IF;
  v_ini := p_de::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim := (p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
  WITH c AS (
    SELECT x.*, coalesce(x.retirada_em, now()) AS fim
      FROM public.contencoes x
     WHERE x.unidade_id = p_unidade AND x.iniciada_em >= v_ini AND x.iniciada_em < v_fim
  ), rv AS (
    SELECT r.contencao_id, r.intercorrencia_id, c.paciente_id,
           r.revisada_em - lag(r.revisada_em, 1, c.iniciada_em) OVER (PARTITION BY r.contencao_id ORDER BY r.revisada_em) AS intervalo
      FROM public.contencao_revisoes r JOIN c ON c.id = r.contencao_id
     WHERE r.revisada_em <= c.fim
       AND NOT EXISTS (SELECT 1 FROM public.contencao_revisoes y WHERE y.retifica_id = r.id)
  ), prazo AS (
    SELECT c.id, floor(extract(epoch FROM c.fim - c.iniciada_em) / 3600)::int AS previstas,
           (SELECT count(*) FROM rv WHERE rv.contencao_id = c.id AND rv.intervalo <= interval '1 hour')::int AS no_prazo
      FROM c
  ), atendidos AS (
    SELECT e.paciente_id FROM public.episodios e WHERE e.unidade_id = p_unidade AND e.chegada_em >= v_ini AND e.chegada_em < v_fim
    UNION
    SELECT i.paciente_id FROM public.internacoes i WHERE i.unidade_id = p_unidade AND i.data_admissao >= v_ini AND i.data_admissao < v_fim
  ), enc AS (
    SELECT count(*) AS n, count(DISTINCT paciente_id) AS pacientes,
           sum(extract(epoch FROM retirada_em - iniciada_em)) / 3600.0 AS horas
      FROM c WHERE retirada_em IS NOT NULL
  )
  SELECT jsonb_build_object(
    'contencoes', (SELECT count(*) FROM c),
    'pacientes', (SELECT count(DISTINCT paciente_id) FROM c),
    'pacientes_atendidos', (SELECT count(*) FROM atendidos),
    'pediatricas', (SELECT count(*) FROM c WHERE pediatrico),
    'em_curso', (SELECT count(*) FROM c WHERE retirada_em IS NULL),
    'encerradas', enc.n,
    'horas_encerradas', round(coalesce(enc.horas, 0)::numeric, 1),
    'tempo_medio_h', CASE WHEN enc.pacientes > 0 THEN round((enc.horas / enc.pacientes)::numeric, 1) END,
    'revisoes_previstas', (SELECT coalesce(sum(previstas), 0) FROM prazo),
    'revisoes_no_prazo', (SELECT coalesce(sum(least(no_prazo, previstas)), 0) FROM prazo),
    'eventos_adversos', (SELECT count(DISTINCT intercorrencia_id) FROM rv),
    'pacientes_com_evento', (SELECT count(DISTINCT paciente_id) FROM rv WHERE intercorrencia_id IS NOT NULL),
    'iniciadas_sem_prescricao', (SELECT count(*) FROM c WHERE prescrita_em IS NULL OR prescrita_em > registrada_em),
    'nunca_prescritas', (SELECT count(*) FROM c WHERE prescrita_em IS NULL),
    'por_setor', coalesce((SELECT jsonb_agg(jsonb_build_object('setor', a.nome, 'total', a.n) ORDER BY a.n DESC, a.nome)
                             FROM (SELECT coalesce(s.nome, '—') AS nome, count(*) AS n
                                     FROM c LEFT JOIN public.setores s ON s.id = c.setor_id GROUP BY 1) a), '[]'::jsonb))
    INTO v_res
    FROM enc;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.relatorio_contencoes(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_contencoes(uuid, date, date) TO authenticated;

-- ── K8: linha do tempo do prontuário (contenções e intercorrências) ─────────
-- Chamada por prontuario_leitura (SECURITY INVOKER) com os atendimentos e
-- internações que o RLS deixou passar. O acesso é o das intercorrências
-- (gestor, quem atua no paciente, pedido de acesso vigente); fora disso, as
-- listas vêm vazias. Só a versão vigente de cada intercorrência.
CREATE OR REPLACE FUNCTION private.prontuario_contencoes(p_paciente uuid, p_eps uuid[], p_ints uuid[], p_vis uuid[],
                                                         p_vis_ints uuid[], p_avulsos boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes; v_fam uuid[];
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF pa.id IS NULL OR NOT (coalesce(private.gestor_da_unidade(pa.unidade_id), false) OR coalesce(private.pode_atuar_no_paciente(pa.id), false)
                           OR coalesce(private.acesso_encerrado_vigente(pa.id), false)) THEN
    RETURN jsonb_build_object('contencoes', '[]'::jsonb, 'intercorrencias', '[]'::jsonb);
  END IF;
  v_fam := ARRAY(SELECT private.familia_paciente(p_paciente));
  RETURN jsonb_build_object(
    'contencoes', coalesce((
      SELECT jsonb_agg(private.contencao_json(x, false) ORDER BY x.iniciada_em)
        FROM public.contencoes x
       WHERE x.paciente_id = ANY (v_fam)
         AND (x.episodio_id = ANY (p_eps) OR (x.episodio_id IS NULL AND x.internacao_id = ANY (p_ints))
              OR (p_avulsos AND NOT (coalesce(x.episodio_id = ANY (p_vis), false)
                                     OR (x.episodio_id IS NULL AND coalesce(x.internacao_id = ANY (p_vis_ints), false)))))), '[]'::jsonb),
    'intercorrencias', coalesce((
      SELECT jsonb_agg(private.intercorrencia_json(x) ORDER BY x.ocorrida_em)
        FROM public.intercorrencias x
       WHERE x.paciente_id = ANY (v_fam)
         AND NOT EXISTS (SELECT 1 FROM public.intercorrencias y WHERE y.retifica_id = x.id)
         AND (x.episodio_id = ANY (p_eps) OR (x.episodio_id IS NULL AND x.internacao_id = ANY (p_ints))
              OR (p_avulsos AND NOT (coalesce(x.episodio_id = ANY (p_vis), false)
                                     OR (x.episodio_id IS NULL AND coalesce(x.internacao_id = ANY (p_vis_ints), false)))))), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION private.prontuario_contencoes(uuid, uuid[], uuid[], uuid[], uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.prontuario_contencoes(uuid, uuid[], uuid[], uuid[], uuid[], boolean) TO authenticated;

-- ── K10: dados da folha (folha_relatorio confere o acesso e registra) ───────
CREATE OR REPLACE FUNCTION private.contencao_folha(p_paciente uuid, p_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('contencoes', coalesce(jsonb_agg(
           private.contencao_json(x, true) || jsonb_build_object('prescricoes', coalesce((
             SELECT jsonb_agg(jsonb_build_object('descricao', it.descricao, 'observacao', it.observacao, 'prescrita_em', it.created_at,
                                                 'medico', pf.nome_completo, 'medico_registro', private.folha_registro(it.autor_id),
                                                 'suspenso_em', it.suspenso_em, 'motivo_suspensao', it.motivo_suspensao)
                              ORDER BY it.created_at)
               FROM public.prescricao_itens it
               JOIN public.prescricoes p ON p.id = it.prescricao_id
               LEFT JOIN public.perfis pf ON pf.id = it.autor_id
              WHERE p.paciente_id = x.paciente_id AND it.tipo = 'contencao'
                AND it.created_at >= x.iniciada_em - interval '24 hours'
                AND it.created_at <= coalesce(x.retirada_em, now())
                AND (it.suspenso_em IS NULL OR it.suspenso_em >= x.iniciada_em)), '[]'::jsonb),
             'iniciada_por_registro', private.folha_registro(x.iniciada_por))
           ORDER BY x.iniciada_em DESC), '[]'::jsonb))
    FROM public.contencoes x
   WHERE x.paciente_id = p_paciente AND (p_ids IS NULL OR x.id = ANY (p_ids))
$$;
REVOKE ALL ON FUNCTION private.contencao_folha(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- ── funções trocadas trecho a trecho ────────────────────────────────────────
-- pula o que já foi trocado; trecho que sumiu (ou aparece mais de uma vez) para com erro
CREATE OR REPLACE FUNCTION pg_temp.trocar_contencao(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := replace(pg_get_functiondef(f), E'\r', ''); i int; mudou boolean := false; v_ant text; v_novo text;
BEGIN
  FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
    v_ant := replace(trechos[i], E'\r', ''); v_novo := replace(trechos[i + 1], E'\r', '');
    IF position(v_novo IN def) > 0 THEN CONTINUE; END IF;
    IF position(v_ant IN def) = 0 THEN
      RAISE EXCEPTION '%: trecho não encontrado: %', f, v_ant;
    END IF;
    IF (length(def) - length(replace(def, v_ant, ''))) / length(v_ant) <> 1 THEN
      RAISE EXCEPTION '%: trecho aparece mais de uma vez: %', f, v_ant;
    END IF;
    def := replace(def, v_ant, v_novo);
    mudou := true;
  END LOOP;
  IF mudou THEN EXECUTE def; END IF;
END $$;

-- prescrever: o tipo contencao (K4)
SELECT pg_temp.trocar_contencao('public.prescrever(uuid, jsonb)'::regprocedure, ARRAY[
  $a$  v_tipo text := coalesce(p_item ->> 'tipo', 'medicamento');
$a$,
  $b$  v_tipo text := coalesce(p_item ->> 'tipo', 'medicamento');
  v_contencao jsonb;  -- lacuna 4: a ordem de contenção mecânica
$b$,
  $a$  ELSE
    RAISE EXCEPTION 'Tipo de item desconhecido.';
  END IF;
$a$,
  $b$  ELSIF v_tipo = 'contencao' THEN
    -- lacuna 4 (K4): pontos, período previsto, motivo e critérios de retirada;
    -- vale 24 h (Nota Técnica ANVISA 07/2026)
    v_contencao := private.contencao_item_validado(p_item);
  ELSE
    RAISE EXCEPTION 'Tipo de item desconhecido.';
  END IF;
$b$,
  $a$CASE WHEN v_tipo = 'cuidado' THEN btrim(p_item ->> 'descricao') ELSE m.principio_ativo$a$,
  $b$CASE WHEN v_tipo = 'cuidado' THEN btrim(p_item ->> 'descricao') WHEN v_tipo = 'contencao' THEN private.contencao_item_descricao(v_contencao) ELSE m.principio_ativo$b$,
  $a$coalesce((p_item ->> 'se_necessario')::boolean, false), nullif(btrim(p_item ->> 'observacao'), ''),$a$,
  $b$coalesce((p_item ->> 'se_necessario')::boolean, false),
          CASE WHEN v_tipo = 'contencao' THEN private.contencao_item_observacao(v_contencao) ELSE nullif(btrim(p_item ->> 'observacao'), '') END,$b$,
  $a$justificativa_divergencia, autor_id, ordem)$a$,
  $b$justificativa_divergencia, autor_id, ordem, contencao)$b$,
  $a$          coalesce((SELECT max(ordem) + 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc), 1))
  RETURNING id INTO v_id;
$a$,
  $b$          coalesce((SELECT max(ordem) + 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc), 1), v_contencao)
  RETURNING id INTO v_id;
  -- lacuna 4 (K3, K4): liga na contenção ativa; a ordem nova renova a anterior
  IF v_tipo = 'contencao' THEN PERFORM private.contencao_prescrita(v_id); END IF;
$b$]);

-- folha_relatorio: a folha "Registro de contenção mecânica" (K10)
SELECT pg_temp.trocar_contencao('public.folha_relatorio(text, uuid, uuid, uuid, uuid[])'::regprocedure, ARRAY[
  $a$p_tipo NOT IN ('classificacao', 'evolucao', 'alergias', 'avaliacao', 'pareceres', 'encaminhamento_interno')$a$,
  $b$p_tipo NOT IN ('classificacao', 'evolucao', 'alergias', 'avaliacao', 'pareceres', 'encaminhamento_interno', 'contencao')$b$,
  $a$    WHEN 'pareceres' THEN 'Parecer médico'
$a$,
  $b$    WHEN 'pareceres' THEN 'Parecer médico'
    WHEN 'contencao' THEN 'Registro de contenção mecânica'
$b$,
  $a$  ELSIF p_tipo = 'encaminhamento_interno' THEN
$a$,
  $b$  ELSIF p_tipo = 'contencao' THEN
    -- lacuna 4 (K10): início, prescrição, revisões e retirada
    v_dados := private.contencao_folha(v_pac, p_ids);
  ELSIF p_tipo = 'encaminhamento_interno' THEN
$b$]);

-- prontuario_leitura: as chaves contencoes e intercorrencias (K8)
SELECT pg_temp.trocar_contencao('public.prontuario_leitura(uuid, timestamptz, integer)'::regprocedure, ARRAY[
  $a$  RETURN v_dados || jsonb_build_object(
    'nomes', v_extra -> 'nomes',$a$,
  $b$  RETURN v_dados
    -- lacuna 4 (K8): contenções e intercorrências na linha do tempo
    || private.prontuario_contencoes(p_paciente, v_eps, v_ints, v_vis, ARRAY(SELECT jsonb_object_keys(v_int_ep))::uuid[], v_avulsos)
    || jsonb_build_object(
    'nomes', v_extra -> 'nomes',$b$]);

DROP FUNCTION pg_temp.trocar_contencao(regprocedure, text[]);

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (rodar inteiro; testado na homologação em transação desfeita):
--
-- CREATE OR REPLACE FUNCTION pg_temp.desfazer_contencao(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
-- DECLARE def text := replace(pg_get_functiondef(f), E'\r', ''); i int; mudou boolean := false;
-- BEGIN
--   FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
--     IF position(replace(trechos[i + 1], E'\r', '') IN def) > 0 THEN
--       def := replace(def, replace(trechos[i + 1], E'\r', ''), replace(trechos[i], E'\r', ''));
--       mudou := true;
--     END IF;
--   END LOOP;
--   IF mudou THEN EXECUTE def; END IF;
-- END $$;
-- -- as três chamadas pg_temp.trocar_contencao acima, iguais, com o nome
-- -- pg_temp.desfazer_contencao (os mesmos pares: ele troca o novo pelo antigo)
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'contencao-avisos';
-- DROP TRIGGER IF EXISTS trg_internacao_alta_encerra_contencao ON public.internacoes;
-- DROP TRIGGER IF EXISTS trg_episodio_fim_encerra_contencao ON public.episodios;
-- DROP FUNCTION IF EXISTS public.contencao_do_paciente(uuid), public.contencoes_ativas(uuid),
--   public.iniciar_contencao(uuid, jsonb), public.revisar_contencao(uuid, jsonb, uuid),
--   public.informar_familia_contencao(uuid, boolean, text, timestamptz), public.retirar_contencao(uuid, text, timestamptz),
--   public.relatorio_contencoes(uuid, date, date), private.contencao_avisar(), private.contencao_prescrita(uuid),
--   private.suspender_ordens_contencao(uuid, uuid, text), private.encerrar_contencao(uuid, uuid, text),
--   private.internacao_alta_encerra_contencao(), private.episodio_fim_encerra_contencao(),
--   private.prontuario_contencoes(uuid, uuid[], uuid[], uuid[], uuid[], boolean), private.contencao_folha(uuid, uuid[]),
--   private.contencao_json(public.contencoes, boolean), private.contencao_revisao_json(public.contencao_revisoes),
--   private.avisar_contencao_sem_prescricao(uuid), private.contencao_destinatarios(uuid, uuid, text),
--   private.contencao_local(public.contencoes), private.contencao_setor(public.contencoes),
--   private.contencao_estado(public.contencoes), private.contencao_item_validado(jsonb),
--   private.contencao_item_descricao(jsonb), private.contencao_item_observacao(jsonb);
-- -- tabelas e coluna: ficam (dado clínico) até uma janela declarada (contract);
-- -- a CHECK maior também fica enquanto houver item 'contencao' gravado.
-- -- Sem nenhum item 'contencao': ALTER TABLE public.prescricao_itens DROP CONSTRAINT prescricao_itens_tipo_check;
-- --   ALTER TABLE public.prescricao_itens ADD CONSTRAINT prescricao_itens_tipo_check CHECK (tipo IN ('medicamento', 'cuidado')) NOT VALID;
-- ════════════════════════════════════════════════════════════════════════════
