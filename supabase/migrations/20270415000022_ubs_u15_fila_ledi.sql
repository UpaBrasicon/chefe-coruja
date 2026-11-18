-- Percurso da UBS, U15, PR 2 (diagnóstico docs/ubs/U15-DIAGNOSTICO.md; RT,
-- 18/11/2026: V1 a V5 = A): a fila das fichas do LEDI APS para o SISAB.
--
-- O dado da UBS chega ao SISAB pelo PEC e-SUS APS do município, em fichas no
-- Layout e-SUS APS de Dados e Interface (LEDI APS 8.7.0). Este PR prepara o
-- banco: o que entra na fila, a configuração da unidade e a carga de cada ficha.
-- A montagem no LEDI (PR 3), o envio à API do PEC (PR 4) e a tela (PR 5) vêm
-- depois. Nada sai do banco agora.
--
-- 1. public.ledi_config_unidade: código IBGE do município (7 dígitos, exigido
--    pela ficha), INE da equipe (10 dígitos, opcional) e o endereço HTTPS do
--    PEC. O envio nasce desligado. Só o gestor da UBS e o super admin leem;
--    grava public.ledi_salvar_config, com segundo fator e auditoria.
-- 2. public.ledi_fila: uma linha por ficha. Fila própria, e não a
--    interop_outbox da RNDS, porque o serviço da RNDS pega qualquer item da
--    outbox sem olhar o tipo (rnds_pegar_lote) e o painel da RNDS a conta.
--    - 'fai' (Ficha de Atendimento Individual): o atendimento da UBS encerrado
--      com consulta de médico ou enfermeiro, ou escuta inicial. Ficam fora a
--      ficha que venceu, a evasão ("não aguardou") e o cancelado.
--    - 'fp' (Ficha de Procedimentos): cada procedimento registrado na UBS. O
--      cancelado antes do envio é descartado.
--    - uuid_ficha: o CNES da unidade e um UUID (o LEDI recomenda o prefixo do
--      CNES), fixo para a ficha não ser contada duas vezes no PEC.
-- 3. private.ledi_carga_fai(episódio) e private.ledi_carga_fp(procedimento): os
--    dados do app para a ficha (as medições são as do atendimento ou do mesmo dia
--    na unidade), com o que retém (prefixo "retido:"): unidade sem
--    CNES ou sem IBGE; profissional sem CNS de 15 dígitos ou sem CBO; cidadão
--    sem CNS e sem CPF; atendimento sem problema, CID nem CIAP. A tradução para
--    os códigos do LEDI fica no mapper (PR 3).
-- 4. Conferência noturna (01:10 de Brasília): põe na fila o que mudou no dia e
--    não entrou pelos gatilhos.
--
-- Idempotente. Teste: supabase/tests/ubs_u15_fila_ledi.sql
--
-- Rollback (na ordem):
--   SELECT cron.unschedule('ledi-conferencia-noturna');
--   DROP TRIGGER IF EXISTS trg_ledi_fai ON public.episodios;
--   DROP TRIGGER IF EXISTS trg_ledi_fp ON public.procedimentos_realizados;
--   DROP FUNCTION IF EXISTS private.ledi_conferencia_noturna(date), private.trg_ledi_fai(), private.trg_ledi_fp(),
--     private.ledi_enfileirar(uuid, text, uuid), private.ledi_carga_fai(uuid), private.ledi_carga_fp(uuid),
--     private.ledi_carga_profissional(uuid), private.ledi_carga_cidadao(uuid), private.ledi_carga_unidade(uuid), private.ledi_fai_cabe(uuid),
--     public.ledi_salvar_config(uuid, text, text, text);
--   DROP TABLE IF EXISTS public.ledi_fila, public.ledi_config_unidade;
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. configuração da unidade ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ledi_config_unidade (
  unidade_id     uuid PRIMARY KEY REFERENCES public.unidades(id) ON DELETE CASCADE,
  codigo_ibge    text CHECK (codigo_ibge ~ '^[0-9]{7}$'),
  ine            text CHECK (ine ~ '^[0-9]{10}$'),
  pec_url        text CHECK (pec_url ~ '^https://[^\s/]+'),
  envio_ligado   boolean NOT NULL DEFAULT false,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.ledi_config_unidade IS
  'U15: envio das fichas do LEDI APS ao PEC e-SUS APS do município (SISAB). Nasce desligado.';
ALTER TABLE public.ledi_config_unidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ledi_config_le ON public.ledi_config_unidade;
CREATE POLICY ledi_config_le ON public.ledi_config_unidade FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.tenho_papel(unidade_id, 'gestor'));
REVOKE INSERT, UPDATE, DELETE ON public.ledi_config_unidade FROM anon, authenticated;

-- ── 2. a fila ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ledi_fila (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id           uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  tipo                 text NOT NULL CHECK (tipo IN ('fai', 'fp')),
  referencia_id        uuid NOT NULL,
  uuid_ficha           text NOT NULL CHECK (length(uuid_ficha) BETWEEN 36 AND 44),
  status               text NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente', 'retido', 'enviado', 'erro', 'descartado')),
  tentativas           integer NOT NULL DEFAULT 0,
  proxima_tentativa_em timestamptz,
  travado_ate          timestamptz,
  ultimo_erro          text,
  resposta             jsonb,
  enviado_em           timestamptz,
  criado_em            timestamptz NOT NULL DEFAULT now(),
  atualizado_em        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ledi_fila IS
  'U15: fichas do LEDI APS (fai = atendimento individual, fp = procedimentos) a enviar ao PEC e-SUS APS do município.';
CREATE UNIQUE INDEX IF NOT EXISTS ledi_fila_uma_viva ON public.ledi_fila (tipo, referencia_id) WHERE status <> 'descartado';
CREATE INDEX IF NOT EXISTS ledi_fila_a_enviar ON public.ledi_fila (unidade_id, coalesce(proxima_tentativa_em, criado_em))
  WHERE status IN ('pendente', 'retido');
ALTER TABLE public.ledi_fila ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ledi_fila_le ON public.ledi_fila;
CREATE POLICY ledi_fila_le ON public.ledi_fila FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.tenho_papel(unidade_id, 'gestor'));
REVOKE INSERT, UPDATE, DELETE ON public.ledi_fila FROM anon, authenticated;

-- ── 3. quem entra ───────────────────────────────────────────────────────────
-- atendimento da UBS que vira FAI: encerrado, sem ficha vencida, evasão nem cancelamento
CREATE OR REPLACE FUNCTION private.ledi_fai_cabe(p_episodio uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.episodios e JOIN public.unidades u ON u.id = e.unidade_id AND u.tipo::text = 'ubs'
     WHERE e.id = p_episodio AND e.etapa = 'encerrado'
       AND coalesce(e.desfecho, '') NOT IN ('evasao', 'cancelado')
       AND NOT coalesce((e.desfecho_detalhes ->> 'vencida')::boolean, false))
$$;

-- nunca trava o fluxo clínico: o erro só deixa de enfileirar (a conferência noturna pega depois)
CREATE OR REPLACE FUNCTION private.ledi_enfileirar(p_unidade uuid, p_tipo text, p_referencia uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cnes text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ledi_fila f WHERE f.tipo = p_tipo AND f.referencia_id = p_referencia AND f.status <> 'descartado') THEN
    RETURN;
  END IF;
  SELECT nullif(regexp_replace(coalesce(u.cnes, ''), '\D', '', 'g'), '') INTO v_cnes FROM public.unidades u WHERE u.id = p_unidade;
  INSERT INTO public.ledi_fila (unidade_id, tipo, referencia_id, uuid_ficha)
  VALUES (p_unidade, p_tipo, p_referencia,
          CASE WHEN v_cnes IS NULL THEN gen_random_uuid()::text ELSE left(v_cnes, 7) || '-' || gen_random_uuid()::text END)
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ledi_enfileirar (%, %): %', p_tipo, p_referencia, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_ledi_fai()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.etapa = 'encerrado' AND OLD.etapa IS DISTINCT FROM 'encerrado' AND private.ledi_fai_cabe(NEW.id) THEN
    PERFORM private.ledi_enfileirar(NEW.unidade_id, 'fai', NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_ledi_fai ON public.episodios;
CREATE TRIGGER trg_ledi_fai AFTER UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.trg_ledi_fai();

CREATE OR REPLACE FUNCTION private.trg_ledi_fp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = NEW.unidade_id AND u.tipo::text = 'ubs') THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' AND NEW.cancelado_em IS NULL THEN
    PERFORM private.ledi_enfileirar(NEW.unidade_id, 'fp', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.cancelado_em IS NOT NULL AND OLD.cancelado_em IS NULL THEN
    UPDATE public.ledi_fila SET status = 'descartado', ultimo_erro = 'procedimento cancelado', atualizado_em = now()
     WHERE tipo = 'fp' AND referencia_id = NEW.id AND status IN ('pendente', 'retido', 'erro');
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_ledi_fp ON public.procedimentos_realizados;
CREATE TRIGGER trg_ledi_fp AFTER INSERT OR UPDATE OF cancelado_em ON public.procedimentos_realizados
  FOR EACH ROW EXECUTE FUNCTION private.trg_ledi_fp();

-- ── 4. a carga de cada ficha ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ledi_carga_profissional(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE f public.perfis; v_cns text; v_cbo text;
BEGIN
  SELECT * INTO f FROM public.perfis WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'retido: ficha sem profissional'; END IF;
  v_cns := regexp_replace(coalesce(f.cns, ''), '\D', '', 'g');
  v_cbo := regexp_replace(coalesce(f.cbo, ''), '\D', '', 'g');
  IF length(v_cns) <> 15 THEN RAISE EXCEPTION 'retido: profissional sem CNS (15 dígitos)'; END IF;
  IF length(v_cbo) <> 6 THEN RAISE EXCEPTION 'retido: profissional sem CBO'; END IF;
  RETURN jsonb_build_object('id', f.id, 'nome', f.nome_completo, 'cns', v_cns, 'cbo', v_cbo,
    'cpf', CASE WHEN length(regexp_replace(coalesce(f.cpf, ''), '\D', '', 'g')) = 11 THEN regexp_replace(f.cpf, '\D', '', 'g') END);
END;
$$;

CREATE OR REPLACE FUNCTION private.ledi_carga_cidadao(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE pa public.pacientes; v_cns text; v_cpf text;
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'retido: paciente não encontrado'; END IF;
  v_cns := nullif(regexp_replace(coalesce(pa.cns, ''), '\D', '', 'g'), '');
  v_cpf := nullif(regexp_replace(coalesce(pa.cpf, ''), '\D', '', 'g'), '');
  IF length(v_cns) IS DISTINCT FROM 15 THEN v_cns := NULL; END IF;
  IF length(v_cpf) IS DISTINCT FROM 11 THEN v_cpf := NULL; END IF;
  IF v_cns IS NULL AND v_cpf IS NULL THEN RAISE EXCEPTION 'retido: paciente sem CNS e sem CPF'; END IF;
  IF pa.data_nascimento IS NULL THEN RAISE EXCEPTION 'retido: paciente sem data de nascimento'; END IF;
  RETURN jsonb_build_object('id', pa.id, 'cns', v_cns, 'cpf', v_cpf, 'data_nascimento', pa.data_nascimento, 'sexo', pa.sexo);
END;
$$;

-- cabeçalho comum: CNES da unidade, IBGE e INE da configuração
CREATE OR REPLACE FUNCTION private.ledi_carga_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_cnes text; c public.ledi_config_unidade;
BEGIN
  SELECT nullif(regexp_replace(coalesce(u.cnes, ''), '\D', '', 'g'), '') INTO v_cnes FROM public.unidades u WHERE u.id = p_unidade;
  IF length(v_cnes) IS DISTINCT FROM 7 THEN RAISE EXCEPTION 'retido: unidade sem CNES'; END IF;
  SELECT * INTO c FROM public.ledi_config_unidade WHERE unidade_id = p_unidade;
  IF c.codigo_ibge IS NULL THEN RAISE EXCEPTION 'retido: unidade sem código IBGE do município'; END IF;
  RETURN jsonb_build_object('cnes', v_cnes, 'codigo_ibge', c.codigo_ibge, 'ine', c.ine);
END;
$$;

CREATE OR REPLACE FUNCTION private.ledi_carga_fai(p_episodio uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE e public.episodios; v_cids text[]; v_exames jsonb;
BEGIN
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'episódio % não encontrado', p_episodio; END IF;
  SELECT array_agg(DISTINCT d.cid ORDER BY d.cid) INTO v_cids
    FROM public.diagnosticos_episodio d WHERE d.episodio_id = e.id AND d.encerrado_em IS NULL;
  v_cids := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(v_cids, '{}') || coalesce(e.cid_aps, '{}')) x WHERE x IS NOT NULL ORDER BY x);
  IF cardinality(v_cids) = 0 AND cardinality(coalesce(e.ciap_aps, '{}')) = 0 AND cardinality(coalesce(e.problemas_aps, '{}')) = 0 THEN
    RAISE EXCEPTION 'retido: atendimento sem problema, CID nem CIAP';
  END IF;
  SELECT coalesce(jsonb_agg(DISTINCT p.procedimento), '[]') INTO v_exames
    FROM public.exames_pedidos p WHERE p.episodio_id = e.id AND p.procedimento IS NOT NULL AND p.situacao <> 'cancelado';
  RETURN jsonb_build_object(
    'unidade', private.ledi_carga_unidade(e.unidade_id),
    'profissional', private.ledi_carga_profissional(coalesce(e.atendimento_medico_id, e.desfecho_por, e.encerrado_por)),
    'cidadao', private.ledi_carga_cidadao(e.paciente_id),
    'atendimento', jsonb_build_object(
      'id', e.id, 'tipo_atendimento', e.tipo_atendimento_aps,
      'inicio', coalesce(e.atendimento_iniciado_em, e.chegada_em), 'fim', e.encerrado_em,
      'problemas', coalesce(to_jsonb(e.problemas_aps), '[]'), 'ciap', coalesce(to_jsonb(e.ciap_aps), '[]'),
      'cid', to_jsonb(v_cids), 'condutas', coalesce(to_jsonb(e.conduta_aps), '[]'),
      'exames_solicitados', v_exames),
    -- medições do atendimento ou do mesmo dia na unidade (na UBS, peso e altura são aferidos fora da consulta, U7)
    'medicoes', (SELECT coalesce(jsonb_agg(x.o ORDER BY x.nome), '[]') FROM (
       SELECT DISTINCT ON (c.id) c.nome, jsonb_build_object('conceito', c.nome, 'loinc', c.loinc_codigo,
              'valor', o.valor_num, 'unidade', coalesce(o.unidade, c.unidade_padrao), 'aferido_em', o.aferido_em) AS o
         FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
        WHERE o.valor_num IS NOT NULL AND o.paciente_id = e.paciente_id
          AND (o.episodio_id = e.id
               OR (o.unidade_id = e.unidade_id AND o.episodio_id IS NULL
                   AND (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date = (e.encerrado_em AT TIME ZONE 'America/Sao_Paulo')::date))
        ORDER BY c.id, o.aferido_em DESC) x));
END;
$$;

CREATE OR REPLACE FUNCTION private.ledi_carga_fp(p_procedimento uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE r public.procedimentos_realizados;
BEGIN
  SELECT * INTO r FROM public.procedimentos_realizados WHERE id = p_procedimento;
  IF NOT FOUND THEN RAISE EXCEPTION 'procedimento % não encontrado', p_procedimento; END IF;
  IF r.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'retido: procedimento cancelado'; END IF;
  RETURN jsonb_build_object(
    'unidade', private.ledi_carga_unidade(r.unidade_id),
    'profissional', private.ledi_carga_profissional(r.profissional_id),
    'cidadao', private.ledi_carga_cidadao(r.paciente_id),
    'procedimento', jsonb_build_object('id', r.id, 'codigo_sigtap', r.procedimento, 'quantidade', r.quantidade,
                                       'realizado_em', r.realizado_em, 'episodio_id', r.episodio_id));
END;
$$;

-- ── 5. conferência noturna ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ledi_conferencia_noturna(p_dia date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dia date := coalesce(p_dia, private.data_atual() - 1);
  v_ini timestamptz := v_dia::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim timestamptz := (v_dia + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_antes integer; v_fai integer; v_fp integer; r record;
BEGIN
  SELECT count(*) INTO v_antes FROM public.ledi_fila WHERE tipo = 'fai';
  FOR r IN
    SELECT e.id, e.unidade_id FROM public.episodios e JOIN public.unidades u ON u.id = e.unidade_id AND u.tipo::text = 'ubs'
     WHERE e.etapa = 'encerrado' AND e.encerrado_em >= v_ini AND e.encerrado_em < v_fim
  LOOP
    IF private.ledi_fai_cabe(r.id) THEN PERFORM private.ledi_enfileirar(r.unidade_id, 'fai', r.id); END IF;
  END LOOP;
  SELECT count(*) - v_antes INTO v_fai FROM public.ledi_fila WHERE tipo = 'fai';

  SELECT count(*) INTO v_antes FROM public.ledi_fila WHERE tipo = 'fp';
  FOR r IN
    SELECT p.id, p.unidade_id FROM public.procedimentos_realizados p JOIN public.unidades u ON u.id = p.unidade_id AND u.tipo::text = 'ubs'
     WHERE p.cancelado_em IS NULL AND p.registrado_em >= v_ini AND p.registrado_em < v_fim
  LOOP
    PERFORM private.ledi_enfileirar(r.unidade_id, 'fp', r.id);
  END LOOP;
  SELECT count(*) - v_antes INTO v_fp FROM public.ledi_fila WHERE tipo = 'fp';
  RETURN jsonb_build_object('dia', v_dia, 'fai', v_fai, 'fp', v_fp);
END;
$$;

DO $$ BEGIN
  PERFORM cron.unschedule('ledi-conferencia-noturna');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('ledi-conferencia-noturna', '10 4 * * *', 'SELECT private.ledi_conferencia_noturna();');

-- ── 6. o gestor da UBS configura ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ledi_salvar_config(p_unidade uuid, p_ibge text, p_ine text, p_pec_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ibge text := nullif(regexp_replace(coalesce(p_ibge, ''), '\D', '', 'g'), '');
  v_ine text := nullif(regexp_replace(coalesce(p_ine, ''), '\D', '', 'g'), '');
  v_url text := nullif(btrim(coalesce(p_pec_url, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade configura o envio ao SISAB.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = p_unidade AND u.tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'O envio ao SISAB é da UBS.';
  END IF;
  IF v_ibge IS NOT NULL AND v_ibge !~ '^[0-9]{7}$' THEN RAISE EXCEPTION 'Código IBGE do município: 7 dígitos.'; END IF;
  IF v_ine IS NOT NULL AND v_ine !~ '^[0-9]{10}$' THEN RAISE EXCEPTION 'INE da equipe: 10 dígitos.'; END IF;
  IF v_url IS NOT NULL AND v_url !~ '^https://[^\s/]+' THEN RAISE EXCEPTION 'Endereço do PEC: comece com https://.'; END IF;
  INSERT INTO public.ledi_config_unidade (unidade_id, codigo_ibge, ine, pec_url, atualizado_por)
  VALUES (p_unidade, v_ibge, v_ine, rtrim(v_url, '/'), private.meu_perfil_id())
  ON CONFLICT (unidade_id) DO UPDATE
    SET codigo_ibge = excluded.codigo_ibge, ine = excluded.ine, pec_url = excluded.pec_url,
        atualizado_por = excluded.atualizado_por, atualizado_em = now();
  PERFORM private.registrar_auditoria('ledi_config_salva', 'ledi_config_unidade', p_unidade, p_unidade,
    jsonb_build_object('ativo', false));
END;
$$;

REVOKE ALL ON FUNCTION private.ledi_fai_cabe(uuid), private.ledi_enfileirar(uuid, text, uuid), private.trg_ledi_fai(),
  private.trg_ledi_fp(), private.ledi_carga_profissional(uuid), private.ledi_carga_cidadao(uuid),
  private.ledi_carga_unidade(uuid), private.ledi_carga_fai(uuid), private.ledi_carga_fp(uuid),
  private.ledi_conferencia_noturna(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledi_salvar_config(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ledi_salvar_config(uuid, text, text, text) TO authenticated;
