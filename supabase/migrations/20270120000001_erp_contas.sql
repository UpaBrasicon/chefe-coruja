-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 3 (ERP/financeiro), subtarefa 1: a conta faturada vira uma
-- versão para o ERP, e o ERP responde por versão (decisões do RT de
-- 27/10/2026, "1a 2a 3a 4a 5a").
--
-- 1a. O ERP busca pela API v1, com o recurso novo "financeiro" na chave da
--     unidade. A tela do faturamento baixa o mesmo conteúdo (subtarefa 3).
-- 2a. Vai a conta faturada: cabeçalho, itens guardados no fechamento, total e
--     glosas. Do paciente, só o prontuário (sem nome, CPF, CNS nem CID).
--     Ajuste do RT no mesmo dia ("entra tudo: remédio, procedimento,
--     plantões"): a versão leva também o consumo de medicamentos guardado no
--     fechamento (quantidades, sem valor). Os plantões não são da conta e
--     entram numa subtarefa própria.
-- 3a. JSON no contrato da API v1; o CSV da tela usa os mesmos campos.
-- 4a. O ERP responde por versão: "lancada" (id no ERP, data e valor lançado)
--     marca conciliada (valor igual ao total) ou divergente. Nada muda a conta.
-- 5a. Cada faturamento gera uma versão. Reabrir a conta marca a versão vigente
--     como substituída; o ERP estorna e responde "estornada"; o faturamento
--     seguinte gera a versão nova.
--
-- O total da versão soma só os itens que vão ao SUS: a linha do BPA com
-- destino "fora" (fora do arquivo, liberada pelo gestor) vem na lista com
-- faturavel = false e fica em total_referencia, que é o total da tela.
--
-- expand: tabela nova, gatilhos novos, porta nova da API (só service_role) e
-- o recurso "financeiro" na lista da chave. Nada sai; o que existe não muda.
--
-- Rollback (nesta ordem; testado na homologação):
--   DROP FUNCTION IF EXISTS public.api_v1_financeiro(text, text, text, text, jsonb);
--   DROP TRIGGER IF EXISTS trg_erp_versao ON public.contas;
--   DROP TRIGGER IF EXISTS trg_erp_glosa ON public.conta_glosas;
--   DROP FUNCTION IF EXISTS private.trg_erp_versao(), private.trg_erp_glosa(),
--     private.erp_versao_json(public.conta_versoes_erp), private.erp_glosas(uuid),
--     private.erp_conta_dados(public.contas), private.erp_reais(numeric);
--   DROP TABLE IF EXISTS public.conta_versoes_erp;
--   e, se nenhuma chave tiver o recurso "financeiro", a restrição
--   api_chaves_recursos_check e a mensagem da api_criar_chave como na
--   20261211000001_api_imagem.sql. Os eventos erp_* em conta_eventos e na
--   auditoria ficam como histórico.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── versões da conta para o ERP ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conta_versoes_erp (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id        uuid NOT NULL REFERENCES public.contas(id),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  versao          integer NOT NULL CHECK (versao >= 1),
  situacao        text NOT NULL DEFAULT 'vigente' CHECK (situacao IN ('vigente', 'substituida')),
  dados           jsonb NOT NULL,
  total           numeric(12, 2) NOT NULL CHECK (total >= 0),
  gerada_em       timestamptz NOT NULL DEFAULT now(),
  substituida_em  timestamptz,
  -- muda quando a versão nasce, é substituída ou uma glosa da conta muda (o ERP busca por aqui)
  alterada_em     timestamptz NOT NULL DEFAULT now(),
  conciliacao     text NOT NULL DEFAULT 'pendente' CHECK (conciliacao IN ('pendente', 'conciliada', 'divergente', 'estornada')),
  erp_id          text CHECK (length(erp_id) BETWEEN 1 AND 100),
  erp_recebida_em timestamptz,
  valor_lancado   numeric(12, 2) CHECK (valor_lancado >= 0),
  retorno_em      timestamptz,
  retorno_chave   uuid REFERENCES public.api_chaves(id),
  CONSTRAINT conta_versoes_erp_unica UNIQUE (conta_id, versao),
  CONSTRAINT conta_versoes_erp_substituida CHECK ((situacao = 'substituida') = (substituida_em IS NOT NULL)),
  CONSTRAINT conta_versoes_erp_estorno CHECK (conciliacao <> 'estornada' OR situacao = 'substituida'),
  CONSTRAINT conta_versoes_erp_retorno CHECK ((conciliacao = 'pendente') = (retorno_em IS NULL))
);
COMMENT ON TABLE public.conta_versoes_erp IS 'Fase 5C-3: cada faturamento da conta vira uma versão para o ERP; reabrir a conta substitui a vigente. Retorno e conciliação por versão.';
CREATE UNIQUE INDEX IF NOT EXISTS conta_versoes_erp_vigente ON public.conta_versoes_erp (conta_id) WHERE situacao = 'vigente';
CREATE INDEX IF NOT EXISTS conta_versoes_erp_alteradas ON public.conta_versoes_erp (unidade_id, alterada_em, id);

-- leitura: faturamento e gestor da unidade (gravação só pelos gatilhos e pela porta)
ALTER TABLE public.conta_versoes_erp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conta_versoes_erp_leitura ON public.conta_versoes_erp;
CREATE POLICY conta_versoes_erp_leitura ON public.conta_versoes_erp FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.tenho_papel(unidade_id, 'faturamento') OR private.gestor_da_unidade(unidade_id));
REVOKE ALL ON public.conta_versoes_erp FROM anon, authenticated;
GRANT SELECT ON public.conta_versoes_erp TO authenticated;
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.conta_versoes_erp;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.conta_versoes_erp FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

-- ── o que vai ao ERP (2a) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.erp_reais(p numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 'R$ ' || replace(to_char(coalesce(p, 0), 'FM999999990.00'), '.', ',')
$$;

-- itens guardados no fechamento; do paciente, só o prontuário
CREATE OR REPLACE FUNCTION private.erp_conta_dados(c public.contas)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH it AS (
    SELECT x, coalesce(x ->> 'destino', '') <> 'fora' AS faturavel
      FROM jsonb_array_elements(coalesce(c.itens_congelados, private.conta_itens(c))) x)
  SELECT jsonb_build_object(
    'conta_id', c.id, 'numero', c.numero, 'tipo', c.tipo, 'pagador', c.pagador,
    'unidade', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome, 'cnes', u.cnes) FROM public.unidades u WHERE u.id = c.unidade_id),
    'prontuario', (SELECT p.prontuario FROM public.pacientes p WHERE p.id = c.paciente_id),
    'conta_origem', (SELECT o.numero FROM public.contas o WHERE o.id = c.conta_origem_id),
    'atendimento_inicio', CASE c.tipo WHEN 'ambulatorial' THEN (SELECT e.chegada_em FROM public.episodios e WHERE e.id = c.episodio_id)
                                      ELSE (SELECT i.internado_em FROM public.internacoes i WHERE i.id = c.internacao_id) END,
    'atendimento_fim', CASE c.tipo WHEN 'ambulatorial' THEN (SELECT coalesce(e.encerrado_em, e.desfecho_em) FROM public.episodios e WHERE e.id = c.episodio_id)
                                   ELSE (SELECT i.data_alta FROM public.internacoes i WHERE i.id = c.internacao_id) END,
    'fechada_em', c.congelada_em,
    'faturada_em', c.status_em,
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'origem', x ->> 'origem', 'procedimento', x ->> 'procedimento', 'nome', x ->> 'nome',
        'quantidade', x -> 'quantidade', 'realizado_em', x -> 'em',
        -- a linha do BPA cai na competência do fato; a AIH tem a dela
        'competencia', coalesce(x -> 'aih' ->> 'competencia',
                                to_char((x ->> 'em')::timestamptz AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
        'valor_unitario', round((x ->> 'valor_unitario')::numeric, 2),
        'valor_total', round((x ->> 'valor_total')::numeric, 2),
        'faturavel', faturavel) ORDER BY x ->> 'em') FROM it), '[]'::jsonb),
    -- consumo de medicamentos, sem valor (decisão da 5B-3); sem a prescrição
    'medicamentos', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'medicamento', m ->> 'medicamento', 'unidade_consumo', m ->> 'unidade_consumo',
        'dispensado', m -> 'dispensado', 'devolvido', m -> 'devolvido', 'liquido', m -> 'liquido',
        'administrado', m -> 'administrado', 'fora_da_conta', coalesce((m ->> 'fora_da_conta')::boolean, false))
        ORDER BY m ->> 'medicamento')
      FROM jsonb_array_elements(coalesce(c.medicamentos_congelados, private.conta_medicamentos(c))) m), '[]'::jsonb),
    'total_referencia', round(coalesce((SELECT sum((x ->> 'valor_total')::numeric) FROM it), 0), 2),
    'total', round(coalesce((SELECT sum((x ->> 'valor_total')::numeric) FROM it WHERE faturavel), 0), 2))
$$;

-- glosas da conta como estão agora (sem o texto livre do motivo)
CREATE OR REPLACE FUNCTION private.erp_glosas(p_conta uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'item', g.item_rotulo, 'item_origem', g.item_origem, 'competencia', g.competencia,
           'valor', g.valor, 'motivo', g.motivo_codigo, 'situacao', g.status,
           'competencia_recurso', g.competencia_recurso, 'valor_recuperado', g.valor_recuperado,
           'registrada_em', g.registrada_em, 'situacao_em', g.status_em) ORDER BY g.registrada_em, g.id), '[]'::jsonb)
    FROM public.conta_glosas g WHERE g.conta_id = p_conta
$$;

CREATE OR REPLACE FUNCTION private.erp_versao_json(v public.conta_versoes_erp)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.dados || jsonb_build_object(
    'id', v.id, 'versao', v.versao, 'situacao', v.situacao, 'total', v.total,
    'gerada_em', v.gerada_em, 'substituida_em', v.substituida_em, 'alterada_em', v.alterada_em,
    'glosas', private.erp_glosas(v.conta_id),
    'conciliacao', v.conciliacao,
    'retorno', CASE WHEN v.retorno_em IS NOT NULL THEN jsonb_build_object(
                 'erp_id', v.erp_id, 'recebida_em', v.erp_recebida_em, 'valor_lancado', v.valor_lancado, 'em', v.retorno_em) END)
$$;
REVOKE ALL ON FUNCTION private.erp_reais(numeric), private.erp_conta_dados(public.contas), private.erp_glosas(uuid),
  private.erp_versao_json(public.conta_versoes_erp) FROM PUBLIC, anon, authenticated;

-- ── 5a. faturar gera a versão; reabrir substitui a vigente ──────────────────
CREATE OR REPLACE FUNCTION private.trg_erp_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.conta_versoes_erp; v_dados jsonb; v_versao integer;
BEGIN
  -- a conta saiu de faturada (reaberta) ou vai faturar de novo: a vigente deixa de valer
  IF OLD.status = 'faturada' OR NEW.status = 'faturada' THEN
    UPDATE public.conta_versoes_erp SET situacao = 'substituida', substituida_em = now(), alterada_em = now()
     WHERE conta_id = NEW.id AND situacao = 'vigente'
    RETURNING * INTO v;
    IF FOUND THEN
      -- clock_timestamp: o evento do ERP aparece depois do evento da etapa (gravado depois, com now())
      INSERT INTO public.conta_eventos (conta_id, evento, motivo, por, em)
      VALUES (NEW.id, 'erp_substituida', 'Versão ' || v.versao || ' do ERP substituída: a conta foi reaberta.', NEW.status_por, clock_timestamp());
      PERFORM private.registrar_auditoria('conta_erp_substituida', 'contas', NEW.id, NEW.unidade_id,
        jsonb_build_object('numero', NEW.numero, 'versao', v.versao));
    END IF;
  END IF;
  IF NEW.status = 'faturada' THEN
    v_dados := private.erp_conta_dados(NEW);
    SELECT coalesce(max(x.versao), 0) + 1 INTO v_versao FROM public.conta_versoes_erp x WHERE x.conta_id = NEW.id;
    INSERT INTO public.conta_versoes_erp (conta_id, unidade_id, versao, dados, total)
    VALUES (NEW.id, NEW.unidade_id, v_versao, v_dados, (v_dados ->> 'total')::numeric)
    RETURNING * INTO v;
    INSERT INTO public.conta_eventos (conta_id, evento, motivo, por, em)
    VALUES (NEW.id, 'erp_disponivel', 'Versão ' || v.versao || ' disponível para o ERP (total ' || private.erp_reais(v.total) || ').', NEW.status_por, clock_timestamp());
    PERFORM private.registrar_auditoria('conta_erp_disponivel', 'contas', NEW.id, NEW.unidade_id,
      jsonb_build_object('numero', NEW.numero, 'versao', v.versao, 'total', v.total));
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.trg_erp_versao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_erp_versao ON public.contas;
CREATE TRIGGER trg_erp_versao AFTER UPDATE OF status ON public.contas
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION private.trg_erp_versao();

-- glosa registrada ou mudada: a versão vigente volta para a lista do ERP
CREATE OR REPLACE FUNCTION private.trg_erp_glosa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.conta_versoes_erp SET alterada_em = now() WHERE conta_id = NEW.conta_id AND situacao = 'vigente';
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.trg_erp_glosa() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_erp_glosa ON public.conta_glosas;
CREATE TRIGGER trg_erp_glosa AFTER INSERT OR UPDATE ON public.conta_glosas
  FOR EACH ROW EXECUTE FUNCTION private.trg_erp_glosa();

-- contas que já estavam faturadas ganham a versão 1 (sem evento: é a carga inicial)
INSERT INTO public.conta_versoes_erp (conta_id, unidade_id, versao, dados, total, gerada_em, alterada_em)
SELECT c.id, c.unidade_id, 1, d.dados, (d.dados ->> 'total')::numeric, c.status_em, c.status_em
  FROM public.contas c CROSS JOIN LATERAL (SELECT private.erp_conta_dados(c) AS dados) d
 WHERE c.status = 'faturada' AND NOT EXISTS (SELECT 1 FROM public.conta_versoes_erp x WHERE x.conta_id = c.id);

-- ── recurso "financeiro" na chave ───────────────────────────────────────────
ALTER TABLE public.api_chaves DROP CONSTRAINT IF EXISTS api_chaves_recursos_check;
ALTER TABLE public.api_chaves ADD CONSTRAINT api_chaves_recursos_check CHECK (cardinality(recursos) >= 1
  AND recursos <@ ARRAY['pacientes', 'atendimentos', 'leitos', 'producao', 'laboratorio', 'imagem', 'financeiro']::text[]);

DO $$
DECLARE def text;
  antigo text := 'os recursos (pacientes, atendimentos, leitos, producao, laboratorio, imagem)';
  novo text := 'os recursos (pacientes, atendimentos, leitos, producao, laboratorio, imagem, financeiro)';
BEGIN
  def := replace(pg_get_functiondef('public.api_criar_chave(text, text, uuid[], text[], text[], integer, integer)'::regprocedure), E'\r', '');
  IF position(novo IN def) > 0 THEN RETURN; END IF;  -- já aplicada
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'api_criar_chave mudou: trecho "%" não encontrado', antigo; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

-- ── porta do ERP (só service_role: a Edge Function `api` chama com a chave) ─
-- p_acao: contas | conta | retorno
--   contas:  p_dados {unidade_id?, desde?, situacao?, conciliacao?, limite?, cursor?}
--   conta:   p_dados {conta_id}
--   retorno: p_dados {conta_id, versao, acao: lancada | estornada, erp_id, recebida_em?, valor_lancado}
CREATE OR REPLACE FUNCTION public.api_v1_financeiro(p_chave text, p_ip text, p_requisicao text, p_acao text, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.api_chaves; d jsonb := coalesce(p_dados, '{}'::jsonb); v_ip inet; v_usados int; v_limite jsonb;
  v_status int := 200; v_corpo jsonb; v_unidade uuid; v public.conta_versoes_erp;
  v_lim int := least(greatest(coalesce(nullif(d ->> 'limite', '')::int, 50), 1), 100); v_desloc int; v_desde timestamptz;
  v_acao text; v_erp text; v_valor numeric; v_quando timestamptz; v_conc text;
BEGIN
  BEGIN v_ip := nullif(p_ip, '')::inet; EXCEPTION WHEN others THEN v_ip := NULL; END;
  SELECT * INTO c FROM public.api_chaves WHERE hash = private.api_hash(p_chave);
  IF NOT FOUND OR c.revogada_em IS NOT NULL OR c.expira_em <= now() THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'financeiro_' || p_acao, 401, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 401, 'codigo', 'chave_invalida',
      'detalhe', CASE WHEN c.id IS NULL THEN 'A chave não existe.' WHEN c.revogada_em IS NOT NULL THEN 'A chave foi revogada.' ELSE 'A chave venceu.' END);
  END IF;
  SELECT count(*) INTO v_usados FROM public.api_acessos WHERE chave_id = c.id AND em > clock_timestamp() - interval '60 seconds';
  v_limite := jsonb_build_object('limite', c.limite_por_minuto, 'restante', greatest(c.limite_por_minuto - v_usados - 1, 0), 'reinicio', 60);
  IF v_usados >= c.limite_por_minuto THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'financeiro_' || p_acao, 429, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 429, 'codigo', 'limite_excedido', 'detalhe', 'Limite de chamadas por minuto excedido.',
                              'limite', v_limite || jsonb_build_object('restante', 0));
  END IF;
  IF cardinality(c.ips) > 0 AND (v_ip IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(c.ips) i WHERE v_ip <<= i)) THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'financeiro_' || p_acao, 403, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 403, 'codigo', 'fora_do_escopo', 'detalhe', 'IP de origem não liberado nesta chave.', 'limite', v_limite);
  END IF;
  IF NOT 'financeiro' = ANY (c.recursos) THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'financeiro_' || p_acao, 403, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 403, 'codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera o recurso financeiro.', 'limite', v_limite);
  END IF;
  UPDATE public.api_chaves SET ultimo_uso_em = now() WHERE id = c.id;

  BEGIN
    IF p_acao = 'contas' THEN
      v_unidade := nullif(d ->> 'unidade_id', '')::uuid;
      v_desde := nullif(d ->> 'desde', '')::timestamptz;
      v_desloc := private.api_cursor(d ->> 'cursor');
      IF v_unidade IS NOT NULL AND NOT v_unidade = ANY (c.unidades) THEN
        v_status := 403; v_corpo := jsonb_build_object('codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera esta unidade.');
      ELSE
        WITH f AS (
          SELECT x.* FROM public.conta_versoes_erp x
           WHERE x.unidade_id = ANY (CASE WHEN v_unidade IS NULL THEN c.unidades ELSE ARRAY[v_unidade] END)
             AND (v_desde IS NULL OR x.alterada_em >= v_desde)
             AND (NOT d ? 'situacao' OR x.situacao = d ->> 'situacao')
             AND (NOT d ? 'conciliacao' OR x.conciliacao = d ->> 'conciliacao')
           ORDER BY x.alterada_em, x.id OFFSET v_desloc LIMIT v_lim + 1)
        SELECT jsonb_build_object('dados', coalesce((SELECT jsonb_agg(private.erp_versao_json(f) ORDER BY f.alterada_em, f.id)
                                                       FROM (SELECT * FROM f ORDER BY alterada_em, id LIMIT v_lim) f), '[]'::jsonb),
                                  'proximo_cursor', private.api_proximo(v_desloc, v_lim, (SELECT count(*)::int FROM f)))
          INTO v_corpo;
      END IF;

    ELSIF p_acao = 'conta' THEN
      SELECT x.unidade_id INTO v_unidade FROM public.conta_versoes_erp x WHERE x.conta_id = nullif(d ->> 'conta_id', '')::uuid LIMIT 1;
      IF v_unidade IS NULL OR NOT v_unidade = ANY (c.unidades) THEN
        v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Conta sem versão para o ERP.');
      ELSE
        v_corpo := jsonb_build_object('dados', (SELECT jsonb_agg(private.erp_versao_json(x) ORDER BY x.versao)
                                                  FROM public.conta_versoes_erp x WHERE x.conta_id = (d ->> 'conta_id')::uuid));
      END IF;

    ELSIF p_acao = 'retorno' THEN
      SELECT * INTO v FROM public.conta_versoes_erp
       WHERE conta_id = nullif(d ->> 'conta_id', '')::uuid AND versao = nullif(d ->> 'versao', '')::int FOR UPDATE;
      v_unidade := v.unidade_id;
      v_acao := d ->> 'acao';
      v_erp := nullif(btrim(coalesce(d ->> 'erp_id', '')), '');
      v_quando := coalesce(nullif(d ->> 'recebida_em', '')::timestamptz, now());
      IF v.id IS NULL OR NOT v.unidade_id = ANY (c.unidades) THEN
        v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Versão da conta não encontrada.');
      ELSIF v_acao IS NULL OR v_acao NOT IN ('lancada', 'estornada') THEN
        v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'acao: lancada ou estornada.');
      ELSIF v_quando > now() + interval '5 minutes' THEN
        v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'recebida_em está no futuro.');
      ELSIF v_erp IS NOT NULL AND length(v_erp) > 100 THEN
        v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'erp_id de 1 a 100 letras.');

      ELSIF v_acao = 'lancada' THEN
        v_valor := round(nullif(d ->> 'valor_lancado', '')::numeric, 2);
        IF v_erp IS NULL THEN
          v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Informe erp_id (o identificador do lançamento no ERP).');
        ELSIF v_valor IS NULL OR v_valor < 0 THEN
          v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Informe valor_lancado (zero ou mais).');
        ELSIF v.situacao = 'substituida' THEN
          v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito',
            'detalhe', 'Esta versão foi substituída (a conta foi reaberta): estorne no ERP e mande acao "estornada".');
        ELSE
          v_conc := CASE WHEN v_valor = v.total THEN 'conciliada' ELSE 'divergente' END;
          -- reenvio igual não muda nada nem repete o evento
          IF NOT (v.conciliacao = v_conc AND v.erp_id = v_erp AND v.valor_lancado = v_valor) THEN
            UPDATE public.conta_versoes_erp SET conciliacao = v_conc, erp_id = v_erp, erp_recebida_em = v_quando,
                   valor_lancado = v_valor, retorno_em = now(), retorno_chave = c.id
             WHERE id = v.id RETURNING * INTO v;
            INSERT INTO public.conta_eventos (conta_id, evento, motivo)
            VALUES (v.conta_id, 'erp_' || v_conc, 'Versão ' || v.versao || ': o ERP lançou ' || private.erp_reais(v_valor)
                    || ' (total ' || private.erp_reais(v.total) || '; lançamento ' || v_erp || ').');
            PERFORM private.registrar_auditoria('conta_erp_' || v_conc, 'contas', v.conta_id, v.unidade_id,
              jsonb_build_object('versao', v.versao, 'total', v.total, 'valor_lancado', v_valor, 'chave', c.prefixo));
          END IF;
          v_corpo := jsonb_build_object('conta_id', v.conta_id, 'versao', v.versao, 'conciliacao', v.conciliacao,
                                        'total', v.total, 'valor_lancado', v.valor_lancado, 'erp_id', v.erp_id);
        END IF;

      ELSE  -- estornada
        IF v.situacao = 'vigente' THEN
          v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito',
            'detalhe', 'A versão vigente não se estorna: ela só é substituída quando o gestor reabre a conta.');
        ELSE
          IF v.conciliacao <> 'estornada' THEN
            UPDATE public.conta_versoes_erp SET conciliacao = 'estornada', erp_id = coalesce(v_erp, erp_id),
                   erp_recebida_em = v_quando, retorno_em = now(), retorno_chave = c.id
             WHERE id = v.id RETURNING * INTO v;
            INSERT INTO public.conta_eventos (conta_id, evento, motivo)
            VALUES (v.conta_id, 'erp_estornada', 'Versão ' || v.versao || ' estornada no ERP'
                    || coalesce(' (lançamento ' || v.erp_id || ')', '') || '.');
            PERFORM private.registrar_auditoria('conta_erp_estornada', 'contas', v.conta_id, v.unidade_id,
              jsonb_build_object('versao', v.versao, 'chave', c.prefixo));
          END IF;
          v_corpo := jsonb_build_object('conta_id', v.conta_id, 'versao', v.versao, 'conciliacao', v.conciliacao,
                                        'total', v.total, 'valor_lancado', v.valor_lancado, 'erp_id', v.erp_id);
        END IF;
      END IF;

    ELSE
      v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Ação inexistente.');
    END IF;
  EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
      v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Parâmetro fora do formato.');
    WHEN raise_exception THEN
      v_status := 422; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', SQLERRM);
  END;

  INSERT INTO public.api_acessos (chave_id, recurso, unidade_id, status, ip, requisicao)
  VALUES (c.id, 'financeiro_' || p_acao, v_unidade, v_status, v_ip, p_requisicao);
  IF v_status = 200 THEN
    RETURN jsonb_build_object('status', 200, 'corpo', v_corpo, 'limite', v_limite);
  END IF;
  RETURN jsonb_build_object('status', v_status, 'codigo', v_corpo ->> 'codigo', 'detalhe', v_corpo ->> 'detalhe', 'limite', v_limite);
END $$;
REVOKE ALL ON FUNCTION public.api_v1_financeiro(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_v1_financeiro(text, text, text, text, jsonb) TO service_role;
