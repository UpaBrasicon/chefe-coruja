-- Fase 3, tarefa 5: APAC, com as decisões do RT de 10/10/2026 no BACKLOG.
--
-- • Fluxo:
--   - O médico que atende solicita, com procedimento, CID, caráter, tipo e
--     justificativa.
--   - O médico regulador autoriza (número de 13 dígitos e validade) ou
--     rejeita, com motivo.
--   - O faturamento registra a execução por competência (procedimentos,
--     executante, tipo de atendimento, motivo de saída), fecha a competência
--     e gera o arquivo do APAC Magnético. A execução trava com a competência
--     fechada; reabrir pede motivo.
-- • Procedimento: só o que o SIGTAP registra em APAC (instrumento 06
--   principal, 07 secundário). As críticas de CID, sexo, idade, CNS e CBO são
--   as da AIH (private.criticas_aih), com o que bloqueia definido pelo gestor.
--   A compatibilidade com o CID só se confere quando o procedimento tem CID
--   no SIGTAP.
-- • Leiaute (produto/docs/pesquisa/apac-leiaute-oficial/leiaute-apac.md):
--   - cabeçalho "01" #APAC (139);
--   - corpo "14" (539);
--   - procedimento "13" (99);
--   - laudo geral "06" (39), para exames de alta complexidade.
--   Os códigos que o leiaute não lista (tipo de atendimento, motivo de saída,
--   órgão emissor, nacionalidade) são digitados.
--
-- Só aditiva (expand).

-- ── tabelas ─────────────────────────────────────────────────────────────────
ALTER TABLE public.bpa_config_unidade ADD COLUMN IF NOT EXISTS apac_orgao_emissor text
  CHECK (apac_orgao_emissor IS NULL OR length(apac_orgao_emissor) BETWEEN 1 AND 10);
COMMENT ON COLUMN public.bpa_config_unidade.apac_orgao_emissor IS 'Código do órgão emissor da APAC (Portaria SAS 637/2005), posições 349–358 do corpo.';

CREATE TABLE IF NOT EXISTS public.apacs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id     uuid REFERENCES public.episodios(id),
  internacao_id   uuid REFERENCES public.internacoes(id),
  tipo            text NOT NULL DEFAULT '3' CHECK (tipo IN ('1', '2', '3')),
  procedimento    text NOT NULL CHECK (procedimento ~ '^[0-9]{10}$'),
  cid_principal   text NOT NULL,
  cid_secundario  text,
  cid_causa       text,
  carater         text NOT NULL CHECK (carater IN ('01', '02', '03', '04', '05', '06')),
  apac_anterior   text CHECK (apac_anterior ~ '^[0-9]{13}$'),
  justificativa   jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada', 'autorizada', 'rejeitada', 'cancelada')),
  numero          text CHECK (numero ~ '^[0-9]{13}$'),
  validade_inicio date,
  validade_fim    date,
  solicitada_por  uuid NOT NULL REFERENCES public.perfis(id),
  solicitada_em   timestamptz NOT NULL DEFAULT now(),
  decidida_por    uuid REFERENCES public.perfis(id),
  decidida_em     timestamptz,
  motivo          text,
  criticas        jsonb NOT NULL DEFAULT '[]'::jsonb,
  sigtap_competencia text,
  atualizada_em   timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'autorizada' OR (numero IS NOT NULL AND validade_inicio IS NOT NULL AND validade_fim IS NOT NULL)),
  CHECK (validade_fim IS NULL OR validade_fim >= validade_inicio),
  CHECK (tipo <> '2' OR apac_anterior IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS apacs_numero_unico ON public.apacs (numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS apacs_unidade_status ON public.apacs (unidade_id, status, solicitada_em DESC);
CREATE INDEX IF NOT EXISTS apacs_paciente ON public.apacs (paciente_id, solicitada_em DESC);

CREATE TABLE IF NOT EXISTS public.apac_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apac_id       uuid NOT NULL REFERENCES public.apacs(id),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  evento        text NOT NULL CHECK (evento IN ('solicitada', 'autorizada', 'rejeitada', 'cancelada', 'execucao_registrada', 'execucao_cancelada')),
  status_antes  text,
  status_depois text NOT NULL,
  detalhes      jsonb NOT NULL DEFAULT '{}'::jsonb,
  motivo        text,
  por           uuid REFERENCES public.perfis(id),
  em            timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS apac_eventos_apac ON public.apac_eventos (apac_id, em);
DROP TRIGGER IF EXISTS trg_apac_eventos_so_insercao ON public.apac_eventos;
CREATE TRIGGER trg_apac_eventos_so_insercao BEFORE UPDATE OR DELETE ON public.apac_eventos
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

-- execução por competência: o que entra no arquivo
CREATE TABLE IF NOT EXISTS public.apac_execucoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apac_id          uuid NOT NULL REFERENCES public.apacs(id),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id),
  competencia      text NOT NULL CHECK (competencia ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  tipo_atendimento text NOT NULL CHECK (tipo_atendimento ~ '^[0-9]{2}$'),
  motivo_saida     text NOT NULL CHECK (motivo_saida ~ '^[0-9]{2}$'),
  data_ocorrencia  date,
  executante_id    uuid NOT NULL REFERENCES public.perfis(id),
  procedimentos    jsonb NOT NULL,
  registrado_por   uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em    timestamptz NOT NULL DEFAULT now(),
  cancelado_em     timestamptz,
  cancelado_por    uuid REFERENCES public.perfis(id),
  motivo_cancelamento text,
  CHECK ((cancelado_em IS NULL) = (motivo_cancelamento IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS apac_execucoes_uma_por_competencia ON public.apac_execucoes (apac_id, competencia)
  WHERE cancelado_em IS NULL;

CREATE TABLE IF NOT EXISTS public.apac_fechamentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id),
  competencia       text NOT NULL CHECK (competencia ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  situacao          text NOT NULL DEFAULT 'fechada' CHECK (situacao IN ('fechada', 'reaberta')),
  apacs             integer NOT NULL,
  controle          integer NOT NULL CHECK (controle BETWEEN 1111 AND 2221),
  arquivo           text NOT NULL,
  excluidas         jsonb NOT NULL DEFAULT '[]'::jsonb,
  sigtap_competencia text,
  fechado_por       uuid NOT NULL REFERENCES public.perfis(id),
  fechado_em        timestamptz NOT NULL DEFAULT now(),
  reaberto_por      uuid REFERENCES public.perfis(id),
  reaberto_em       timestamptz,
  motivo_reabertura text,
  CHECK ((situacao = 'reaberta') = (reaberto_em IS NOT NULL AND motivo_reabertura IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS apac_fechamentos_um_fechado ON public.apac_fechamentos (unidade_id, competencia)
  WHERE situacao = 'fechada';

ALTER TABLE public.apacs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apac_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apac_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apac_fechamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apacs, public.apac_eventos, public.apac_execucoes, public.apac_fechamentos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.apacs, public.apac_eventos, public.apac_execucoes, public.apac_fechamentos FROM authenticated;
GRANT SELECT ON public.apacs, public.apac_eventos, public.apac_execucoes, public.apac_fechamentos TO authenticated;
DROP POLICY IF EXISTS apacs_select ON public.apacs;
CREATE POLICY apacs_select ON public.apacs FOR SELECT TO authenticated
  USING (private.tenho_papel(unidade_id, 'regulador') OR private.e_faturamento(unidade_id) OR private.pode_atuar_no_paciente(paciente_id));
DROP POLICY IF EXISTS apac_eventos_select ON public.apac_eventos;
CREATE POLICY apac_eventos_select ON public.apac_eventos FOR SELECT TO authenticated
  USING (private.tenho_papel(unidade_id, 'regulador') OR private.e_faturamento(unidade_id));
DROP POLICY IF EXISTS apac_execucoes_select ON public.apac_execucoes;
CREATE POLICY apac_execucoes_select ON public.apac_execucoes FOR SELECT TO authenticated
  USING (private.e_faturamento(unidade_id) OR private.tenho_papel(unidade_id, 'regulador'));
DROP POLICY IF EXISTS apac_fechamentos_select ON public.apac_fechamentos;
CREATE POLICY apac_fechamentos_select ON public.apac_fechamentos FOR SELECT TO authenticated
  USING (private.e_faturamento(unidade_id));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['apacs', 'apac_eventos', 'apac_execucoes', 'apac_fechamentos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_segundo_fator', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok())',
                   t || '_segundo_fator', t);
  END LOOP;
END $$;

-- ── apoio ───────────────────────────────────────────────────────────────────
-- Código IBGE da UF (tabela de unidades da federação do IBGE).
CREATE OR REPLACE FUNCTION private.uf_ibge(p_uf text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE upper(btrim(coalesce(p_uf, '')))
    WHEN 'RO' THEN '11' WHEN 'AC' THEN '12' WHEN 'AM' THEN '13' WHEN 'RR' THEN '14' WHEN 'PA' THEN '15'
    WHEN 'AP' THEN '16' WHEN 'TO' THEN '17' WHEN 'MA' THEN '21' WHEN 'PI' THEN '22' WHEN 'CE' THEN '23'
    WHEN 'RN' THEN '24' WHEN 'PB' THEN '25' WHEN 'PE' THEN '26' WHEN 'AL' THEN '27' WHEN 'SE' THEN '28'
    WHEN 'BA' THEN '29' WHEN 'MG' THEN '31' WHEN 'ES' THEN '32' WHEN 'RJ' THEN '33' WHEN 'SP' THEN '35'
    WHEN 'PR' THEN '41' WHEN 'SC' THEN '42' WHEN 'RS' THEN '43' WHEN 'MS' THEN '50' WHEN 'MT' THEN '51'
    WHEN 'GO' THEN '52' WHEN 'DF' THEN '53' END
$$;

CREATE OR REPLACE FUNCTION private.apac_evento(a public.apacs, p_evento text, p_antes text, p_detalhes jsonb, p_motivo text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.apac_eventos (apac_id, unidade_id, evento, status_antes, status_depois, detalhes, motivo, por)
  VALUES (a.id, a.unidade_id, p_evento, p_antes, a.status, coalesce(p_detalhes, '{}'::jsonb), p_motivo, private.meu_perfil_id())
$$;
REVOKE ALL ON FUNCTION private.apac_evento(public.apacs, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;

-- Críticas da APAC: as da AIH (CID, sexo, idade, CNS, CBO; bloqueio do
-- gestor) + o procedimento precisa ser de APAC no SIGTAP.
CREATE OR REPLACE FUNCTION private.criticas_apac(p_unidade uuid, p_paciente uuid, p_procedimento text,
  p_cid text, p_cid_sec text, p_cid_causa text, p_autor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_proc text := private.so_digitos(p_procedimento);
  c jsonb;
BEGIN
  c := private.criticas_aih(p_unidade, p_paciente,
         jsonb_build_object('cid', coalesce(p_cid, ''), 'cidSec', coalesce(p_cid_sec, ''), 'cidAssoc', coalesce(p_cid_causa, ''),
                            'procCod', coalesce(v_proc, '')), p_autor);
  -- compatibilidade com o CID só quando o procedimento tem lista de CID no SIGTAP
  IF NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_cid WHERE procedimento = v_proc) THEN
    c := (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM jsonb_array_elements(c) x WHERE x->>'codigo' <> 'cid_procedimento');
  END IF;
  IF v_proc IS NOT NULL AND EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro)
     AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro WHERE procedimento = v_proc AND registro = '06') THEN
    c := c || jsonb_build_object('codigo', 'instrumento_apac', 'campo', '—', 'bloqueante', true,
      'texto', 'O SIGTAP não registra este procedimento como principal de APAC.');
  END IF;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION private.criticas_apac(uuid, uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- ── solicitação (médico que atende) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.conferir_apac(p_paciente uuid, p_procedimento text, p_cid text,
  p_cid_sec text DEFAULT NULL, p_cid_causa text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  RETURN jsonb_build_object('criticas', private.criticas_apac(v_unidade, p_paciente, p_procedimento, p_cid, p_cid_sec, p_cid_causa, private.meu_perfil_id()),
                            'competencia', private.sigtap_competencia());
END $$;
REVOKE ALL ON FUNCTION public.conferir_apac(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conferir_apac(uuid, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.solicitar_apac(p_paciente uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_unidade uuid; v_proc text := private.so_digitos(d->>'procedimento');
  v_cid text := private.cid_normalizado(upper(btrim(coalesce(d->>'cid', ''))));
  v_sec text := nullif(private.cid_normalizado(upper(btrim(coalesce(d->>'cid_secundario', '')))), '');
  v_causa text := nullif(private.cid_normalizado(upper(btrim(coalesce(d->>'cid_causa', '')))), '');
  v_tipo text := coalesce(nullif(d->>'tipo', ''), '3');
  v_carater text := d->>'carater';
  v_ant text := private.so_digitos(d->>'apac_anterior');
  v_ep uuid := nullif(d->>'episodio_id', '')::uuid;
  v_int uuid := nullif(d->>'internacao_id', '')::uuid;
  c jsonb; v_bloq text; a public.apacs;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF (SELECT p.crm FROM public.perfis p WHERE p.id = private.meu_perfil_id()) IS NULL THEN
    RAISE EXCEPTION 'A APAC é solicitada pelo médico (CRM no cadastro).';
  END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_proc IS NULL OR length(v_proc) <> 10 THEN RAISE EXCEPTION 'Procedimento SIGTAP com 10 dígitos.'; END IF;
  IF v_cid IS NULL THEN RAISE EXCEPTION 'CID principal ausente ou fora do formato (ex.: C50.9).'; END IF;
  IF v_tipo NOT IN ('1', '2', '3') THEN RAISE EXCEPTION 'Tipo de APAC: 1 inicial, 2 continuidade ou 3 única.'; END IF;
  IF v_carater IS NULL OR v_carater NOT IN ('01', '02', '03', '04', '05', '06') THEN RAISE EXCEPTION 'Caráter do atendimento: 01 a 06.'; END IF;
  IF v_tipo = '2' AND (v_ant IS NULL OR length(v_ant) <> 13) THEN RAISE EXCEPTION 'APAC de continuidade pede o número da APAC anterior (13 dígitos).'; END IF;
  IF length(btrim(coalesce(d->'justificativa'->>'justificativa', ''))) < 10 THEN
    RAISE EXCEPTION 'Escreva a justificativa do procedimento (mínimo de 10 letras).';
  END IF;
  IF v_ep IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = v_ep AND paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'O atendimento não é deste paciente.';
  END IF;
  IF v_int IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes WHERE id = v_int AND paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'A internação não é deste paciente.';
  END IF;
  c := private.criticas_apac(v_unidade, p_paciente, v_proc, v_cid, v_sec, v_causa, private.meu_perfil_id());
  SELECT string_agg(x->>'texto', ' ') INTO v_bloq FROM jsonb_array_elements(c) x WHERE (x->>'bloqueante')::boolean;
  IF v_bloq IS NOT NULL THEN RAISE EXCEPTION 'Crítica bloqueante da APAC: %', v_bloq; END IF;
  INSERT INTO public.apacs (unidade_id, paciente_id, episodio_id, internacao_id, tipo, procedimento, cid_principal, cid_secundario,
                            cid_causa, carater, apac_anterior, justificativa, solicitada_por, criticas, sigtap_competencia)
  VALUES (v_unidade, p_paciente, v_ep, v_int, v_tipo, v_proc, v_cid, v_sec, v_causa, v_carater, CASE WHEN v_tipo = '2' THEN v_ant END,
          coalesce(d->'justificativa', '{}'::jsonb), private.meu_perfil_id(), c, private.sigtap_competencia())
  RETURNING * INTO a;
  PERFORM private.apac_evento(a, 'solicitada', NULL, jsonb_build_object('procedimento', v_proc, 'cid', v_cid), NULL);
  PERFORM private.registrar_auditoria('apac_solicitada', 'apacs', a.id, v_unidade, jsonb_build_object('procedimento', v_proc));
  RETURN a.id;
END $$;
REVOKE ALL ON FUNCTION public.solicitar_apac(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_apac(uuid, jsonb) TO authenticated;

-- ── decisão (médico regulador) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decidir_apac(p_apac uuid, p_autorizar boolean, p_numero text DEFAULT NULL,
  p_validade_inicio date DEFAULT NULL, p_validade_fim date DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.apacs; v_num text := private.so_digitos(p_numero); v_antes text;
BEGIN
  SELECT * INTO a FROM public.apacs WHERE id = p_apac FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APAC não encontrada.'; END IF;
  PERFORM private.exigir_segundo_fator();
  IF NOT private.tenho_papel(a.unidade_id, 'regulador') THEN
    RAISE EXCEPTION 'A decisão da APAC é do médico regulador da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (SELECT p.crm FROM public.perfis p WHERE p.id = private.meu_perfil_id()) IS NULL THEN
    RAISE EXCEPTION 'Regulador sem CRM no cadastro: complete o registro profissional antes de decidir APAC.';
  END IF;
  IF a.status <> 'solicitada' THEN RAISE EXCEPTION 'Só APAC solicitada é decidida (está %).', a.status; END IF;
  v_antes := a.status;
  IF p_autorizar THEN
    IF v_num IS NULL OR length(v_num) <> 13 THEN RAISE EXCEPTION 'Número da APAC com 13 dígitos.'; END IF;
    IF EXISTS (SELECT 1 FROM public.apacs WHERE numero = v_num AND id <> a.id) THEN RAISE EXCEPTION 'Este número de APAC já foi usado.'; END IF;
    IF p_validade_inicio IS NULL OR p_validade_fim IS NULL OR p_validade_fim < p_validade_inicio THEN
      RAISE EXCEPTION 'Validade: início e fim, com o fim depois do início.';
    END IF;
    UPDATE public.apacs SET status = 'autorizada', numero = v_num, validade_inicio = p_validade_inicio, validade_fim = p_validade_fim,
           decidida_por = private.meu_perfil_id(), decidida_em = now(), motivo = nullif(btrim(p_motivo), ''), atualizada_em = now()
     WHERE id = a.id RETURNING * INTO a;
    PERFORM private.apac_evento(a, 'autorizada', v_antes,
      jsonb_build_object('numero', v_num, 'validade_inicio', p_validade_inicio, 'validade_fim', p_validade_fim), a.motivo);
  ELSE
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo da rejeição (mínimo de 10 letras).'; END IF;
    UPDATE public.apacs SET status = 'rejeitada', decidida_por = private.meu_perfil_id(), decidida_em = now(),
           motivo = btrim(p_motivo), atualizada_em = now()
     WHERE id = a.id RETURNING * INTO a;
    PERFORM private.apac_evento(a, 'rejeitada', v_antes, '{}'::jsonb, a.motivo);
  END IF;
  PERFORM private.registrar_auditoria('apac_decidida', 'apacs', a.id, a.unidade_id, jsonb_build_object('status', a.status));
END $$;
REVOKE ALL ON FUNCTION public.decidir_apac(uuid, boolean, text, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decidir_apac(uuid, boolean, text, date, date, text) TO authenticated;

-- cancela quem solicitou (ainda solicitada) ou o regulador; nunca com execução registrada
CREATE OR REPLACE FUNCTION public.cancelar_apac(p_apac uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.apacs; v_antes text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.apacs WHERE id = p_apac FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APAC não encontrada.'; END IF;
  IF a.status NOT IN ('solicitada', 'autorizada') THEN RAISE EXCEPTION 'Esta APAC já está %.', a.status; END IF;
  IF NOT (private.tenho_papel(a.unidade_id, 'regulador') OR (a.status = 'solicitada' AND a.solicitada_por = private.meu_perfil_id())) THEN
    RAISE EXCEPTION 'Cancela o médico regulador, ou quem solicitou enquanto não foi decidida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM public.apac_execucoes WHERE apac_id = a.id AND cancelado_em IS NULL) THEN
    RAISE EXCEPTION 'A APAC tem execução registrada pelo faturamento: cancele a execução antes.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  v_antes := a.status;
  UPDATE public.apacs SET status = 'cancelada', motivo = btrim(p_motivo), atualizada_em = now() WHERE id = a.id RETURNING * INTO a;
  PERFORM private.apac_evento(a, 'cancelada', v_antes, '{}'::jsonb, a.motivo);
  PERFORM private.registrar_auditoria('apac_cancelada', 'apacs', a.id, a.unidade_id, '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.cancelar_apac(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_apac(uuid, text) TO authenticated;

-- ── leitura ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.apac_json(a public.apacs)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', a.id, 'status', a.status, 'tipo', a.tipo, 'numero', a.numero,
    'validade_inicio', a.validade_inicio, 'validade_fim', a.validade_fim,
    'paciente_id', a.paciente_id, 'paciente', coalesce(pa.nome_social, pa.nome), 'nascimento', pa.data_nascimento, 'sexo', pa.sexo, 'cns', pa.cns,
    'procedimento', a.procedimento, 'procedimento_nome', sp.nome, 'cid_principal', a.cid_principal, 'cid_secundario', a.cid_secundario,
    'cid_causa', a.cid_causa, 'carater', a.carater, 'apac_anterior', a.apac_anterior, 'justificativa', a.justificativa,
    'solicitada_por', ps.nome_completo, 'solicitada_em', a.solicitada_em, 'solicitada_por_mim', a.solicitada_por = private.meu_perfil_id(),
    'decidida_por', pd.nome_completo, 'decidida_em', a.decidida_em, 'motivo', a.motivo,
    'criticas', a.criticas, 'sigtap_competencia', a.sigtap_competencia,
    'execucoes', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'competencia', e.competencia, 'motivo_saida', e.motivo_saida,
                    'tipo_atendimento', e.tipo_atendimento, 'data_ocorrencia', e.data_ocorrencia, 'procedimentos', e.procedimentos,
                    'executante', pe.nome_completo, 'registrado_em', e.registrado_em) ORDER BY e.competencia), '[]'::jsonb)
                    FROM public.apac_execucoes e LEFT JOIN public.perfis pe ON pe.id = e.executante_id
                   WHERE e.apac_id = a.id AND e.cancelado_em IS NULL))
  FROM public.pacientes pa
  LEFT JOIN terminologia.sigtap_procedimento sp ON sp.codigo = a.procedimento
  LEFT JOIN public.perfis ps ON ps.id = a.solicitada_por
  LEFT JOIN public.perfis pd ON pd.id = a.decidida_por
  WHERE pa.id = a.paciente_id
$$;
REVOKE ALL ON FUNCTION private.apac_json(public.apacs) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apacs_da_unidade(p_unidade uuid, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'regulador') OR private.e_faturamento(p_unidade)) THEN
    RAISE EXCEPTION 'APAC da unidade: regulador, faturamento ou gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.apac_json(a) ORDER BY a.solicitada_em DESC)
    FROM public.apacs a WHERE a.unidade_id = p_unidade AND (p_status IS NULL OR a.status = p_status)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.apacs_da_unidade(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apacs_da_unidade(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apacs_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR NOT (private.pode_atuar_no_paciente(p_paciente) OR private.e_faturamento(v_unidade)
                               OR private.tenho_papel(v_unidade, 'regulador')) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.apac_json(a) ORDER BY a.solicitada_em DESC)
    FROM public.apacs a WHERE a.paciente_id = p_paciente), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.apacs_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apacs_do_paciente(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.eventos_apac(p_apac uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.apacs;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.apacs WHERE id = p_apac;
  IF NOT FOUND OR NOT (private.tenho_papel(a.unidade_id, 'regulador') OR private.e_faturamento(a.unidade_id)
                       OR private.pode_atuar_no_paciente(a.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('evento', e.evento, 'status_antes', e.status_antes, 'status_depois', e.status_depois,
      'detalhes', e.detalhes, 'motivo', e.motivo, 'por', p.nome_completo, 'em', e.em) ORDER BY e.em)
    FROM public.apac_eventos e LEFT JOIN public.perfis p ON p.id = e.por WHERE e.apac_id = p_apac), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.eventos_apac(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eventos_apac(uuid) TO authenticated;

-- busca no SIGTAP só entre os procedimentos de APAC (instrumento 06)
CREATE OR REPLACE FUNCTION public.buscar_sigtap_apac(p_termo text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('codigo', x.codigo, 'nome', x.nome)), '[]'::jsonb) FROM (
    SELECT sp.codigo, sp.nome FROM terminologia.sigtap_procedimento sp
     WHERE private.meu_perfil_id() IS NOT NULL AND length(btrim(coalesce(p_termo, ''))) >= 3
       AND EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro r WHERE r.procedimento = sp.codigo AND r.registro = '06')
       AND ((private.so_digitos(p_termo) IS NOT NULL AND sp.codigo LIKE private.so_digitos(p_termo) || '%')
            OR upper(terminologia.unaccent_text(sp.nome)) LIKE '%' || upper(terminologia.unaccent_text(btrim(p_termo))) || '%')
     ORDER BY sp.codigo LIMIT 20) x
$$;
REVOKE ALL ON FUNCTION public.buscar_sigtap_apac(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_sigtap_apac(text) TO authenticated;

-- ── execução (faturamento) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.apac_competencia_fechada(p_unidade uuid, p_competencia text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.apac_fechamentos f
                  WHERE f.unidade_id = p_unidade AND f.competencia = p_competencia AND f.situacao = 'fechada')
$$;
REVOKE ALL ON FUNCTION private.apac_competencia_fechada(uuid, text) FROM PUBLIC, anon, authenticated;

-- p_procedimentos: [{"procedimento": "0000000000", "quantidade": 1}, ...]; o principal da APAC entra sempre.
CREATE OR REPLACE FUNCTION public.registrar_execucao_apac(p_apac uuid, p_competencia text, p_tipo_atendimento text,
  p_motivo_saida text, p_data_ocorrencia date, p_executante uuid, p_procedimentos jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.apacs; v_id uuid; p jsonb; v_proc text; v_qt integer; v_cbo text; v_lista jsonb := '[]'::jsonb;
  v_tem_principal boolean := false;
BEGIN
  SELECT * INTO a FROM public.apacs WHERE id = p_apac FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APAC não encontrada.'; END IF;
  PERFORM private.exigir_faturamento(a.unidade_id);
  PERFORM private.conferir_competencia_texto(p_competencia);
  IF a.status <> 'autorizada' THEN RAISE EXCEPTION 'Só APAC autorizada tem execução.'; END IF;
  IF p_competencia < to_char(a.validade_inicio, 'YYYYMM') OR p_competencia > to_char(a.validade_fim, 'YYYYMM') THEN
    RAISE EXCEPTION 'Competência fora da validade da APAC (% a %).', to_char(a.validade_inicio, 'MM/YYYY'), to_char(a.validade_fim, 'MM/YYYY');
  END IF;
  IF private.apac_competencia_fechada(a.unidade_id, p_competencia) THEN
    RAISE EXCEPTION 'A competência % da APAC já foi fechada pelo faturamento; peça a reabertura.', p_competencia;
  END IF;
  IF coalesce(p_tipo_atendimento, '') !~ '^[0-9]{2}$' THEN RAISE EXCEPTION 'Tipo de atendimento: código de 2 dígitos.'; END IF;
  IF coalesce(p_motivo_saida, '') !~ '^[0-9]{2}$' THEN RAISE EXCEPTION 'Motivo de saída/permanência: código de 2 dígitos (Portaria SAS 719/2007).'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = p_executante AND unidade_id = a.unidade_id AND ativo) THEN
    RAISE EXCEPTION 'O executante não tem vínculo ativo na unidade.';
  END IF;
  SELECT cbo INTO v_cbo FROM public.perfis WHERE id = p_executante;
  IF v_cbo IS NULL THEN RAISE EXCEPTION 'O executante não tem CBO no perfil (vai em cada procedimento da APAC).'; END IF;
  IF jsonb_typeof(p_procedimentos) <> 'array' OR jsonb_array_length(p_procedimentos) = 0 THEN
    RAISE EXCEPTION 'Informe os procedimentos executados.';
  END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(p_procedimentos) LOOP
    v_proc := private.so_digitos(p->>'procedimento');
    v_qt := nullif(p->>'quantidade', '')::integer;
    IF v_proc IS NULL OR length(v_proc) <> 10 THEN RAISE EXCEPTION 'Procedimento SIGTAP com 10 dígitos.'; END IF;
    IF v_qt IS NULL OR v_qt < 1 OR v_qt > 9999999 THEN RAISE EXCEPTION 'Quantidade inválida para %.', v_proc; END IF;
    IF NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = v_proc) THEN
      RAISE EXCEPTION 'Procedimento % não existe no SIGTAP carregado.', v_proc;
    END IF;
    IF EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro)
       AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro WHERE procedimento = v_proc AND registro IN ('06', '07')) THEN
      RAISE EXCEPTION 'O SIGTAP não registra % em APAC.', v_proc;
    END IF;
    IF (SELECT qt_maxima FROM terminologia.sigtap_procedimento WHERE codigo = v_proc) < v_qt THEN
      RAISE EXCEPTION 'Quantidade de % acima do máximo do SIGTAP.', v_proc;
    END IF;
    IF v_cbo IS NOT NULL AND EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_ocupacao WHERE procedimento = v_proc)
       AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_ocupacao WHERE procedimento = v_proc AND cbo = v_cbo) THEN
      RAISE EXCEPTION 'O CBO % do executante não é aceito pelo procedimento % no SIGTAP.', v_cbo, v_proc;
    END IF;
    IF v_proc = a.procedimento THEN v_tem_principal := true; END IF;
    v_lista := v_lista || jsonb_build_object('procedimento', v_proc, 'quantidade', v_qt);
  END LOOP;
  IF NOT v_tem_principal THEN RAISE EXCEPTION 'A execução inclui o procedimento principal da APAC (%).', a.procedimento; END IF;
  IF EXISTS (SELECT 1 FROM public.apac_execucoes WHERE apac_id = a.id AND competencia = p_competencia AND cancelado_em IS NULL) THEN
    RAISE EXCEPTION 'Já há execução desta APAC na competência; cancele a anterior para corrigir.';
  END IF;
  INSERT INTO public.apac_execucoes (apac_id, unidade_id, competencia, tipo_atendimento, motivo_saida, data_ocorrencia,
                                     executante_id, procedimentos, registrado_por)
  VALUES (a.id, a.unidade_id, p_competencia, p_tipo_atendimento, p_motivo_saida, p_data_ocorrencia, p_executante, v_lista, private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.apac_evento(a, 'execucao_registrada', a.status, jsonb_build_object('competencia', p_competencia, 'procedimentos', v_lista), NULL);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_execucao_apac(uuid, text, text, text, date, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_execucao_apac(uuid, text, text, text, date, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_execucao_apac(p_execucao uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.apac_execucoes; a public.apacs;
BEGIN
  SELECT * INTO e FROM public.apac_execucoes WHERE id = p_execucao AND cancelado_em IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Execução não encontrada.'; END IF;
  PERFORM private.exigir_faturamento(e.unidade_id);
  IF private.apac_competencia_fechada(e.unidade_id, e.competencia) THEN
    RAISE EXCEPTION 'A competência % da APAC já foi fechada; peça a reabertura.', e.competencia;
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.apac_execucoes SET cancelado_em = now(), cancelado_por = private.meu_perfil_id(), motivo_cancelamento = btrim(p_motivo)
   WHERE id = e.id;
  SELECT * INTO a FROM public.apacs WHERE id = e.apac_id;
  PERFORM private.apac_evento(a, 'execucao_cancelada', a.status, jsonb_build_object('competencia', e.competencia), btrim(p_motivo));
END $$;
REVOKE ALL ON FUNCTION public.cancelar_execucao_apac(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_execucao_apac(uuid, text) TO authenticated;

-- ── arquivo do APAC Magnético ───────────────────────────────────────────────
-- Linhas da competência, com as críticas que tiram a APAC do arquivo.
CREATE OR REPLACE FUNCTION private.apac_linhas(p_unidade uuid, p_competencia text)
RETURNS TABLE (execucao_id uuid, apac_id uuid, numero text, paciente text, criticas jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.id, a.id, a.numero, coalesce(pa.nome_social, pa.nome),
    (SELECT coalesce(jsonb_agg(x.c), '[]'::jsonb) FROM (VALUES
       (CASE WHEN NOT private.cns_valido(pa.cns) THEN jsonb_build_object('codigo', 'cns_paciente', 'texto', 'Paciente sem CNS válido (obrigatório na APAC).') END),
       (CASE WHEN pa.nome_mae IS NULL THEN jsonb_build_object('codigo', 'nome_mae', 'texto', 'Nome da mãe ausente.') END),
       (CASE WHEN pa.endereco IS NULL OR pa.numero_endereco IS NULL OR pa.cep IS NULL OR pa.municipio_ibge IS NULL
             THEN jsonb_build_object('codigo', 'endereco', 'texto', 'Endereço incompleto (logradouro, número, CEP, município IBGE).') END),
       (CASE WHEN pa.data_nascimento IS NULL OR pa.sexo NOT IN ('M', 'F') OR pa.sexo IS NULL
             THEN jsonb_build_object('codigo', 'paciente', 'texto', 'Nascimento ou sexo do paciente ausente.') END),
       (CASE WHEN pa.nacionalidade IS NULL THEN jsonb_build_object('codigo', 'nacionalidade', 'texto', 'Nacionalidade ausente.') END),
       (CASE WHEN pa.raca_cor = 'indigena' AND pa.etnia IS NULL THEN jsonb_build_object('codigo', 'etnia', 'texto', 'Raça/cor indígena pede a etnia.') END),
       (CASE WHEN NOT private.cns_valido(ps.cns) THEN jsonb_build_object('codigo', 'cns_solicitante', 'texto', 'Médico solicitante sem CNS válido.') END),
       (CASE WHEN NOT private.cns_valido(pd.cns) THEN jsonb_build_object('codigo', 'cns_autorizador', 'texto', 'Autorizador sem CNS válido.') END),
       (CASE WHEN NOT private.cns_valido(px.cns) THEN jsonb_build_object('codigo', 'cns_executante', 'texto', 'Executante sem CNS válido.') END),
       (CASE WHEN px.cbo IS NULL THEN jsonb_build_object('codigo', 'cbo_executante', 'texto', 'Executante sem CBO.') END)
     ) AS x(c) WHERE x.c IS NOT NULL)
  FROM public.apac_execucoes e
  JOIN public.apacs a ON a.id = e.apac_id
  JOIN public.pacientes pa ON pa.id = a.paciente_id
  LEFT JOIN public.perfis ps ON ps.id = a.solicitada_por
  LEFT JOIN public.perfis pd ON pd.id = a.decidida_por
  LEFT JOIN public.perfis px ON px.id = e.executante_id
  WHERE e.unidade_id = p_unidade AND e.competencia = p_competencia AND e.cancelado_em IS NULL AND a.status = 'autorizada'
$$;
REVOKE ALL ON FUNCTION private.apac_linhas(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.apac_globais(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.unidades; c public.bpa_config_unidade; r jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade;
  SELECT * INTO c FROM public.bpa_config_unidade WHERE unidade_id = p_unidade;
  IF u.cnes IS NULL OR u.cnes !~ '^[0-9]{7}$' THEN
    r := r || jsonb_build_object('tipo', 'bloqueio', 'codigo', 'cnes', 'texto', 'CNES da unidade ausente (o gestor preenche em Unidade › Configurações).');
  END IF;
  IF private.uf_ibge(u.uf) IS NULL THEN
    r := r || jsonb_build_object('tipo', 'bloqueio', 'codigo', 'uf', 'texto', 'UF da unidade ausente ou inválida.');
  END IF;
  IF c.orgao_origem IS NULL OR c.sigla IS NULL OR c.cnpj IS NULL OR c.orgao_destino IS NULL OR c.destino IS NULL THEN
    r := r || jsonb_build_object('tipo', 'bloqueio', 'codigo', 'cabecalho', 'texto', 'Cabeçalho incompleto (Faturamento › Configuração).');
  END IF;
  IF c.apac_orgao_emissor IS NULL THEN
    r := r || jsonb_build_object('tipo', 'bloqueio', 'codigo', 'orgao_emissor', 'texto', 'Código do órgão emissor da APAC não configurado (Faturamento › Configuração).');
  END IF;
  IF p_competencia > private.competencia_de(now()) THEN
    r := r || jsonb_build_object('tipo', 'bloqueio', 'codigo', 'futura', 'texto', 'Competência no futuro.');
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.apac_globais(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.apac_arquivo(p_unidade uuid, p_competencia text,
  OUT arquivo text, OUT apacs integer, OUT controle integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u public.unidades; c public.bpa_config_unidade; l record; e public.apac_execucoes; a public.apacs; pa public.pacientes;
  ps public.perfis; pd public.perfis; px public.perfis; p jsonb;
  v_corpo text := ''; v_soma numeric := 0; v_tel text; v_resp text; v_hoje text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD');
BEGIN
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade;
  SELECT * INTO c FROM public.bpa_config_unidade WHERE unidade_id = p_unidade;
  apacs := 0;
  FOR l IN SELECT * FROM private.apac_linhas(p_unidade, p_competencia) x WHERE jsonb_array_length(x.criticas) = 0 ORDER BY x.numero LOOP
    SELECT * INTO e FROM public.apac_execucoes WHERE id = l.execucao_id;
    SELECT * INTO a FROM public.apacs WHERE id = l.apac_id;
    SELECT * INTO pa FROM public.pacientes WHERE id = a.paciente_id;
    SELECT * INTO ps FROM public.perfis WHERE id = a.solicitada_por;
    SELECT * INTO pd FROM public.perfis WHERE id = a.decidida_por;
    SELECT * INTO px FROM public.perfis WHERE id = e.executante_id;
    apacs := apacs + 1;
    v_soma := v_soma + a.numero::numeric;
    v_tel := CASE WHEN length(private.so_digitos(pa.telefone)) BETWEEN 10 AND 11 THEN private.so_digitos(pa.telefone) END;
    -- responsável: o próprio paciente se maior de 18 anos; senão o responsável, ou a mãe
    v_resp := CASE WHEN extract(year FROM age(current_date, pa.data_nascimento)) >= 18 THEN pa.nome
                   ELSE coalesce(pa.responsavel_nome, pa.nome_mae) END;
    v_corpo := v_corpo || '14' || private.bpa_num(p_competencia, 6) || private.bpa_num(a.numero, 13)
      || private.bpa_num(private.uf_ibge(u.uf), 2) || private.bpa_num(u.cnes, 7) || private.bpa_num(v_hoje, 8)
      || private.bpa_num(to_char(a.validade_inicio, 'YYYYMMDD'), 8) || private.bpa_num(to_char(a.validade_fim, 'YYYYMMDD'), 8)
      || private.bpa_num(e.tipo_atendimento, 2) || a.tipo
      || private.bpa_alfa(pa.nome, 30) || private.bpa_alfa(pa.nome_mae, 30) || private.bpa_alfa(pa.endereco, 30)
      || private.bpa_alfa(pa.numero_endereco, 5) || private.bpa_alfa(pa.complemento, 10) || private.bpa_num(pa.cep, 8)
      || private.bpa_num(pa.municipio_ibge, 6) || ' '
      || private.bpa_num(to_char(pa.data_nascimento, 'YYYYMMDD'), 8) || private.bpa_alfa(pa.sexo, 1)
      || private.bpa_alfa(ps.nome_completo, 30) || private.bpa_num(a.procedimento, 10)
      || private.bpa_num(e.motivo_saida, 2) || private.bpa_alfa(to_char(e.data_ocorrencia, 'YYYYMMDD'), 8)
      || private.bpa_alfa(pd.nome_completo, 30) || private.bpa_num(pa.cns, 15) || private.bpa_num(ps.cns, 15) || private.bpa_num(pd.cns, 15)
      || private.bpa_alfa(replace(a.cid_causa, '.', ''), 4)
      || CASE WHEN length(coalesce(private.so_digitos(pa.prontuario), '')) <= 10 THEN private.bpa_num(pa.prontuario, 10) ELSE repeat(' ', 10) END
      || private.bpa_num(u.cnes, 7)
      || private.bpa_num(to_char(a.solicitada_em AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD'), 8)
      || private.bpa_num(to_char(a.decidida_em AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD'), 8)
      || private.bpa_alfa(c.apac_orgao_emissor, 10) || a.carater || private.bpa_num(a.apac_anterior, 13)
      || coalesce(private.bpa_raca(pa.raca_cor), '99') || private.bpa_alfa(v_resp, 30)
      || private.bpa_num(pa.nacionalidade, 3) || private.bpa_num(CASE WHEN pa.raca_cor = 'indigena' THEN pa.etnia END, 4)
      || private.bpa_num(pa.tipo_logradouro, 3) || private.bpa_alfa(pa.bairro, 30)
      || private.bpa_num(left(v_tel, 2), 2) || private.bpa_num(substr(v_tel, 3), 9) || private.bpa_alfa(NULL, 40)
      || private.bpa_num(px.cns, 15) || private.bpa_num(CASE WHEN private.cpf_valido(pa.cpf) THEN pa.cpf END, 11)
      || private.bpa_num(c.ine, 10) || CASE WHEN pa.situacao_rua THEN 'S' ELSE 'N' END
      || '  ' || ' ' || CASE WHEN pa.sem_documento THEN 'S' ELSE 'N' END
      || E'\r\n';
    FOR p IN SELECT * FROM jsonb_array_elements(e.procedimentos) LOOP
      v_soma := v_soma + (p->>'procedimento')::numeric + (p->>'quantidade')::numeric;
      v_corpo := v_corpo || '13' || private.bpa_num(p_competencia, 6) || private.bpa_num(a.numero, 13)
        || private.bpa_num(p->>'procedimento', 10) || private.bpa_num(px.cbo, 6) || private.bpa_num(p->>'quantidade', 7)
        || repeat(' ', 14) || repeat(' ', 6) || repeat(' ', 4) || repeat(' ', 4)
        || repeat(' ', 3) || repeat(' ', 3) || repeat(' ', 8) || repeat(' ', 4) || repeat(' ', 7)
        || E'\r\n';
    END LOOP;
    -- laudo geral (06): CID principal e secundário; data de identificação patológica em branco
    v_corpo := v_corpo || '06' || private.bpa_num(p_competencia, 6) || private.bpa_num(a.numero, 13)
      || private.bpa_alfa(replace(a.cid_principal, '.', ''), 4) || private.bpa_alfa(replace(a.cid_secundario, '.', ''), 4)
      || repeat(' ', 8) || E'\r\n';
  END LOOP;
  controle := (v_soma % 1111)::integer + 1111;
  arquivo := '01#APAC' || private.bpa_num(p_competencia, 6) || private.bpa_num(apacs::text, 6) || controle::text
    || private.bpa_alfa(c.orgao_origem, 30) || private.bpa_alfa(c.sigla, 6) || private.bpa_num(c.cnpj, 14)
    || private.bpa_alfa(c.orgao_destino, 40) || coalesce(c.destino, ' ') || private.bpa_num(v_hoje, 8)
    || private.bpa_alfa('CORUJA 1.0', 15) || E'\r\n' || v_corpo;
END $$;
REVOKE ALL ON FUNCTION private.apac_arquivo(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apac_conferencia(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.apac_fechamentos;
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  PERFORM private.conferir_competencia_texto(p_competencia);
  SELECT * INTO f FROM public.apac_fechamentos WHERE unidade_id = p_unidade AND competencia = p_competencia ORDER BY fechado_em DESC LIMIT 1;
  RETURN jsonb_build_object(
    'competencia', p_competencia,
    'globais', private.apac_globais(p_unidade, p_competencia),
    'linhas', (SELECT coalesce(jsonb_agg(jsonb_build_object('execucao_id', l.execucao_id, 'apac_id', l.apac_id, 'numero', l.numero,
                 'paciente', l.paciente, 'criticas', l.criticas) ORDER BY jsonb_array_length(l.criticas) DESC, l.numero), '[]'::jsonb)
                 FROM private.apac_linhas(p_unidade, p_competencia) l),
    'fechamento', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object('id', f.id, 'situacao', f.situacao, 'apacs', f.apacs,
                    'controle', f.controle, 'fechado_em', f.fechado_em,
                    'fechado_por', (SELECT nome_completo FROM public.perfis WHERE id = f.fechado_por),
                    'reaberto_em', f.reaberto_em, 'motivo_reabertura', f.motivo_reabertura) END);
END $$;
REVOKE ALL ON FUNCTION public.apac_conferencia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apac_conferencia(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fechar_competencia_apac(p_unidade uuid, p_competencia text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_bloq text; a record; v_id uuid;
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  PERFORM private.conferir_competencia_texto(p_competencia);
  PERFORM pg_advisory_xact_lock(hashtext('apac:' || p_unidade::text || ':' || p_competencia));
  IF private.apac_competencia_fechada(p_unidade, p_competencia) THEN
    RAISE EXCEPTION 'Competência da APAC já fechada. Reabra com motivo para gerar de novo.';
  END IF;
  SELECT string_agg(g->>'texto', ' ') INTO v_bloq FROM jsonb_array_elements(private.apac_globais(p_unidade, p_competencia)) g WHERE g->>'tipo' = 'bloqueio';
  IF v_bloq IS NOT NULL THEN RAISE EXCEPTION 'Não dá para fechar: %', v_bloq; END IF;
  SELECT * INTO a FROM private.apac_arquivo(p_unidade, p_competencia);
  IF a.apacs = 0 THEN RAISE EXCEPTION 'Nenhuma APAC sem crítica com execução nesta competência.'; END IF;
  INSERT INTO public.apac_fechamentos (unidade_id, competencia, apacs, controle, arquivo, excluidas, sigtap_competencia, fechado_por)
  VALUES (p_unidade, p_competencia, a.apacs, a.controle, a.arquivo,
          (SELECT coalesce(jsonb_agg(jsonb_build_object('numero', l.numero, 'paciente', l.paciente, 'criticas', l.criticas)), '[]'::jsonb)
             FROM private.apac_linhas(p_unidade, p_competencia) l WHERE jsonb_array_length(l.criticas) > 0),
          private.sigtap_competencia(), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('apac_competencia_fechada', 'apac_fechamentos', v_id, p_unidade,
    jsonb_build_object('competencia', p_competencia, 'apacs', a.apacs));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.fechar_competencia_apac(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_competencia_apac(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reabrir_competencia_apac(p_fechamento uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.apac_fechamentos;
BEGIN
  SELECT * INTO f FROM public.apac_fechamentos WHERE id = p_fechamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fechamento não encontrado.'; END IF;
  PERFORM private.exigir_faturamento(f.unidade_id);
  IF f.situacao <> 'fechada' THEN RAISE EXCEPTION 'Esta competência já foi reaberta.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.apac_fechamentos SET situacao = 'reaberta', reaberto_por = private.meu_perfil_id(), reaberto_em = now(),
         motivo_reabertura = btrim(p_motivo) WHERE id = f.id;
  PERFORM private.registrar_auditoria('apac_competencia_reaberta', 'apac_fechamentos', f.id, f.unidade_id, jsonb_build_object('competencia', f.competencia));
END $$;
REVOKE ALL ON FUNCTION public.reabrir_competencia_apac(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_competencia_apac(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.arquivo_apac(p_fechamento uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.apac_fechamentos; v_cnes text;
BEGIN
  SELECT * INTO f FROM public.apac_fechamentos WHERE id = p_fechamento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fechamento não encontrado.'; END IF;
  PERFORM private.exigir_faturamento(f.unidade_id);
  SELECT cnes INTO v_cnes FROM public.unidades WHERE id = f.unidade_id;
  PERFORM private.registrar_auditoria('apac_arquivo_baixado', 'apac_fechamentos', f.id, f.unidade_id, jsonb_build_object('competencia', f.competencia));
  RETURN jsonb_build_object('nome', 'APAC_' || coalesce(v_cnes, 'SEMCNES') || '_' || f.competencia || '.txt',
                            'conteudo', f.arquivo, 'situacao', f.situacao, 'excluidas', f.excluidas);
END $$;
REVOKE ALL ON FUNCTION public.arquivo_apac(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arquivo_apac(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apac_fechamentos_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'competencia', f.competencia, 'situacao', f.situacao,
      'apacs', f.apacs, 'controle', f.controle, 'excluidas', jsonb_array_length(f.excluidas),
      'fechado_por', pf.nome_completo, 'fechado_em', f.fechado_em, 'reaberto_em', f.reaberto_em, 'motivo_reabertura', f.motivo_reabertura)
      ORDER BY f.competencia DESC, f.fechado_em DESC)
    FROM public.apac_fechamentos f LEFT JOIN public.perfis pf ON pf.id = f.fechado_por
   WHERE f.unidade_id = p_unidade), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.apac_fechamentos_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apac_fechamentos_da_unidade(uuid) TO authenticated;

-- configuração: o órgão emissor da APAC entra no mesmo cartão do cabeçalho
CREATE OR REPLACE FUNCTION public.definir_apac_orgao_emissor(p_unidade uuid, p_codigo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text := nullif(upper(btrim(coalesce(p_codigo, ''))), '');
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  IF v IS NOT NULL AND length(v) > 10 THEN RAISE EXCEPTION 'Código do órgão emissor: até 10 caracteres.'; END IF;
  INSERT INTO public.bpa_config_unidade AS c (unidade_id, apac_orgao_emissor, atualizado_por, atualizado_em)
  VALUES (p_unidade, v, private.meu_perfil_id(), now())
  ON CONFLICT (unidade_id) DO UPDATE SET apac_orgao_emissor = EXCLUDED.apac_orgao_emissor,
    atualizado_por = EXCLUDED.atualizado_por, atualizado_em = EXCLUDED.atualizado_em;
  PERFORM private.registrar_auditoria('apac_orgao_emissor_definido', 'bpa_config_unidade', NULL, p_unidade, jsonb_build_object('codigo', v));
END $$;
REVOKE ALL ON FUNCTION public.definir_apac_orgao_emissor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_apac_orgao_emissor(uuid, text) TO authenticated;

-- configuração do faturamento devolve também o órgão emissor da APAC
CREATE OR REPLACE FUNCTION public.bpa_config(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.bpa_config_unidade;
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  SELECT * INTO c FROM public.bpa_config_unidade WHERE unidade_id = p_unidade;
  RETURN jsonb_build_object(
    'cnes', (SELECT cnes FROM public.unidades WHERE id = p_unidade),
    'orgao_origem', c.orgao_origem, 'sigla', c.sigla, 'cnpj', c.cnpj, 'orgao_destino', c.orgao_destino,
    'destino', c.destino, 'carater_atendimento', c.carater_atendimento, 'ine', c.ine,
    'apac_orgao_emissor', c.apac_orgao_emissor,
    'atualizado_por', (SELECT nome_completo FROM public.perfis WHERE id = c.atualizado_por), 'atualizado_em', c.atualizado_em,
    'sigtap_competencia', private.sigtap_competencia(),
    'procedimentos', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'procedimento', b.procedimento, 'uso', b.uso, 'nome', sp.nome, 'no_sigtap', sp.codigo IS NOT NULL,
        'sempre_bpa_c', b.sempre_bpa_c,
        'instrumentos', (SELECT coalesce(jsonb_agg(r.registro ORDER BY r.registro), '[]'::jsonb)
                           FROM terminologia.sigtap_procedimento_registro r WHERE r.procedimento = b.procedimento),
        'definido_por', pf.nome_completo, 'definido_em', b.definido_em) ORDER BY b.uso, b.procedimento)
      FROM public.bpa_procedimentos_unidade b
      LEFT JOIN terminologia.sigtap_procedimento sp ON sp.codigo = b.procedimento
      LEFT JOIN public.perfis pf ON pf.id = b.definido_por
     WHERE b.unidade_id = p_unidade AND b.vigente_ate IS NULL), '[]'::jsonb));
END $$;
