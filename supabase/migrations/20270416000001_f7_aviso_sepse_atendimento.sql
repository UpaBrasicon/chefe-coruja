-- ════════════════════════════════════════════════════════════════════════════
-- F7 das ferramentas pelo CID: aviso "pensar em sepse" no atendimento
-- (urgência e UBS). Pedido do RT de 17/11/2026; decisões AV1–AV8 = A
-- (docs/clinico/F7-AVISO-SEPSE-PORTA-DIAGNOSTICO.md) e condições da sessão de
-- obrigatórios legais (mesma regra e mesma ficha do alerta de sepse do adulto).
--
-- 1. private.ultimos_vitais_janela / private.calcular_acuidade_janela: o mesmo
--    cálculo de sempre, com a janela dos vitais como parâmetro (desde quando e,
--    se dado, só do episódio). As versões antigas passam a chamar estas com a
--    janela de sempre (24 h, qualquer episódio): resultado igual (regressão
--    testada na homologação comparando todos os pacientes antes e depois).
-- 2. private.sepse_adulto_regra: a regra do alerta da internação (14 anos ou
--    mais, gatilho de infecção e NEWS2 de 5 ou mais; decisão A do RT de
--    11/11/2026), agora numa função só. AV2: aceita também os CIDs que a tela
--    manda (rascunho do SOAP e problemas da Conduta da UBS), conferidos na
--    mesma lista public.cid_infeccao_regras; nada é gravado.
-- 3. public.alertas_sepse: o laço do adulto chama a regra (24 h, como antes).
-- 4. public.aviso_sepse_atendimento: só leitura; vitais das últimas 6 h do
--    episódio (RT); nada se a unidade desligou a ficha sepse-adulto (AV5).
-- 5. public.avisos_sepse_atendimento + public.registrar_aviso_sepse: registro
--    só de inserção de quando o aviso apareceu e foi dispensado (AV6).
-- 6. Versão 2026-11-17.1 da ficha sepse-adulto (texto do aviso e cortes),
--    aguardando aprovação do RT.
--
-- Expand: só funções e tabela novas; as antigas mantêm assinatura e saída.
-- Idempotente. Rollback (testado na homologação, em transação desfeita):
--   DROP FUNCTION IF EXISTS public.registrar_aviso_sepse(uuid, text, text[], text);
--   DROP FUNCTION IF EXISTS public.aviso_sepse_atendimento(uuid, text[]);
--   DROP TABLE IF EXISTS public.avisos_sepse_atendimento;
--   reaplicar public.alertas_sepse de 20270405000002_sepse_adulto_alerta.sql;
--   reaplicar private.calcular_acuidade de 20270209000002_escores_pediatricos_data.sql
--   e private.ultimos_vitais de 20260928000002_fase3_vitais_crus_acuidade.sql;
--   DROP FUNCTION IF EXISTS private.sepse_adulto_regra(uuid, timestamptz, uuid, text[]);
--   DROP FUNCTION IF EXISTS private.calcular_acuidade_janela(uuid, timestamptz, uuid);
--   DROP FUNCTION IF EXISTS private.ultimos_vitais_janela(uuid, timestamptz, uuid);
--   DELETE FROM public.ferramenta_versoes WHERE ferramenta_id = 'sepse-adulto' AND versao = '2026-11-17.1';
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. vitais e acuidade com janela ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ultimos_vitais_janela(p_paciente uuid, p_desde timestamptz, p_episodio uuid)
RETURNS TABLE (nome text, valor_num numeric, codigo text, rotulo text, aferido_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT ON (c.nome) c.nome, o.valor_num, op.valor, op.rotulo, o.aferido_em
  FROM public.observacao o
  JOIN public.conceito c ON c.id = o.conceito_id AND c.categoria = 'sinal_vital'
  LEFT JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
  WHERE o.paciente_id = p_paciente AND o.aferido_em > p_desde
    AND (p_episodio IS NULL OR o.episodio_id = p_episodio)
  ORDER BY c.nome, o.aferido_em DESC
$$;
REVOKE ALL ON FUNCTION private.ultimos_vitais_janela(uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ultimos_vitais(p_paciente uuid)
RETURNS TABLE (nome text, valor_num numeric, codigo text, rotulo text, aferido_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT * FROM private.ultimos_vitais_janela(p_paciente, now() - interval '24 hours', NULL)
$$;

-- Corpo de 20270209000002_escores_pediatricos_data.sql, com a janela como parâmetro.
CREATE OR REPLACE FUNCTION private.calcular_acuidade_janela(p_paciente uuid, p_desde timestamptz, p_episodio uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_nasc date;
  v_meses int;
  v_grupo int;
  v jsonb := '{}'::jsonb;   -- nome → {n, c, r}
  r record;
  itens jsonb := '[]'::jsonb;
  faltando text[] := '{}';
  azul text[] := '{}';
  total int := 0;
  maior int := 0;
  pt int;
  v_ultima timestamptz;
  v_escala text;
  v_banda int;
BEGIN
  SELECT data_nascimento INTO v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_nasc IS NULL THEN
    RETURN jsonb_build_object('escala', NULL, 'motivo', 'Sem data de nascimento: não dá para escolher entre NEWS2 e PEWS.');
  END IF;
  v_meses := (extract(year FROM age(private.data_atual(), v_nasc)) * 12 + extract(month FROM age(private.data_atual(), v_nasc)))::int;

  FOR r IN SELECT * FROM private.ultimos_vitais_janela(p_paciente, p_desde, p_episodio) LOOP
    v := v || jsonb_build_object(r.nome, jsonb_build_object('n', r.valor_num, 'c', r.codigo, 'r', r.rotulo));
    v_ultima := greatest(v_ultima, r.aferido_em);
  END LOOP;

  IF v_meses < 14 * 12 THEN
    -- ── PEWS ──
    v_escala := 'PEWS';
    v_grupo := CASE WHEN v_meses < 12 THEN 0 WHEN v_meses < 60 THEN 1 WHEN v_meses < 144 THEN 2 ELSE 3 END;
    -- numéricos por matriz de idade
    FOR r IN SELECT * FROM (VALUES ('Frequência respiratória', 'frequencia-respiratoria', 'fr', ' irpm'),
                                    ('Frequência cardíaca', 'frequencia-cardiaca', 'fc', ' bpm'),
                                    ('Pressão sistólica', 'pressao-arterial-sistolica', 'pas', ' mmHg')) x(rotulo, nome, param, un) LOOP
      IF v -> r.nome ->> 'n' IS NULL THEN faltando := faltando || r.rotulo; CONTINUE; END IF;
      pt := private.pews_faixa((v -> r.nome ->> 'n')::numeric, private.pews_limites(r.param, v_grupo));
      IF pt = -1 THEN
        azul := azul || r.rotulo;
        itens := itens || jsonb_build_object('rotulo', r.rotulo, 'valor', (v -> r.nome ->> 'n') || r.un, 'pontos', 0, 'azul', true);
      ELSE
        total := total + pt;
        itens := itens || jsonb_build_object('rotulo', r.rotulo, 'valor', (v -> r.nome ->> 'n') || r.un, 'pontos', pt);
      END IF;
    END LOOP;
    -- esforço respiratório 0/1/2/4
    IF v -> 'esforco-respiratorio' ->> 'c' IS NULL THEN faltando := faltando || 'Esforço respiratório'::text;
    ELSE
      pt := (ARRAY[0, 1, 2, 4])[(v -> 'esforco-respiratorio' ->> 'c')::int + 1];
      total := total + pt;
      itens := itens || jsonb_build_object('rotulo', 'Esforço respiratório', 'valor', v -> 'esforco-respiratorio' ->> 'r', 'pontos', pt);
    END IF;
    -- oxigênio 0/2/4
    IF v -> 'oxigenio-suplementar' ->> 'c' IS NULL THEN faltando := faltando || 'Oxigênio'::text;
    ELSE
      pt := CASE v -> 'oxigenio-suplementar' ->> 'c' WHEN 'ar' THEN 0 WHEN '<4' THEN 2 ELSE 4 END;
      total := total + pt;
      itens := itens || jsonb_build_object('rotulo', 'Oxigênio', 'valor', v -> 'oxigenio-suplementar' ->> 'r', 'pontos', pt);
    END IF;
    -- saturação 0/1/2
    IF v -> 'saturacao-o2' ->> 'n' IS NULL THEN faltando := faltando || 'Saturação de O₂'::text;
    ELSE
      pt := CASE WHEN (v -> 'saturacao-o2' ->> 'n')::numeric >= 95 THEN 0 WHEN (v -> 'saturacao-o2' ->> 'n')::numeric >= 91 THEN 1 ELSE 2 END;
      total := total + pt;
      itens := itens || jsonb_build_object('rotulo', 'Saturação de O₂', 'valor', (v -> 'saturacao-o2' ->> 'n') || '%', 'pontos', pt);
    END IF;
    -- enchimento capilar central 0/4
    IF v -> 'enchimento-capilar' ->> 'c' IS NULL THEN faltando := faltando || 'Enchimento capilar central'::text;
    ELSE
      pt := CASE WHEN v -> 'enchimento-capilar' ->> 'c' = '>=3' THEN 4 ELSE 0 END;
      total := total + pt;
      itens := itens || jsonb_build_object('rotulo', 'Enchimento capilar central', 'valor', v -> 'enchimento-capilar' ->> 'r', 'pontos', pt);
    END IF;
    v_banda := CASE WHEN cardinality(azul) > 0 OR total >= 7 THEN 2 WHEN total >= 1 THEN 1 ELSE 0 END;
    RETURN jsonb_build_object(
      'escala', v_escala, 'total', total, 'banda', v_banda, 'itens', itens, 'faltando', to_jsonb(faltando),
      'azul', to_jsonb(azul), 'parcial', cardinality(faltando) > 0, 'aferido_em', v_ultima,
      'grupo', (ARRAY['0 a 11 meses', '1 a 4 anos', '5 a 11 anos', '12 a 13 anos'])[v_grupo + 1],
      'fonte', 'PEWS: matriz da HQSC Nova Zelândia (2023), derivada do Bedside PEWS (Parshuram 2009). Limiar de alerta 7 (Parshuram 2011). Ação por faixa: protocolo da unidade.');
  END IF;

  -- ── NEWS2 (escala 1) ──
  v_escala := 'NEWS2';
  FOR r IN SELECT * FROM (VALUES
      ('Frequência respiratória', 'frequencia-respiratoria', ' irpm', 1),
      ('Saturação de O₂', 'saturacao-o2', '%', 2),
      ('Temperatura', 'temperatura', ' °C', 3),
      ('Pressão sistólica', 'pressao-arterial-sistolica', ' mmHg', 4),
      ('Frequência cardíaca', 'frequencia-cardiaca', ' bpm', 5)) x(rotulo, nome, un, k) LOOP
    IF v -> r.nome ->> 'n' IS NULL THEN faltando := faltando || r.rotulo; CONTINUE; END IF;
    DECLARE x numeric := (v -> r.nome ->> 'n')::numeric;
    BEGIN
      pt := CASE r.k
        WHEN 1 THEN CASE WHEN x <= 8 THEN 3 WHEN x <= 11 THEN 1 WHEN x <= 20 THEN 0 WHEN x <= 24 THEN 2 ELSE 3 END
        WHEN 2 THEN CASE WHEN x <= 91 THEN 3 WHEN x <= 93 THEN 2 WHEN x <= 95 THEN 1 ELSE 0 END
        WHEN 3 THEN CASE WHEN x <= 35 THEN 3 WHEN x <= 36 THEN 1 WHEN x <= 38 THEN 0 WHEN x <= 39 THEN 1 ELSE 2 END
        WHEN 4 THEN CASE WHEN x <= 90 THEN 3 WHEN x <= 100 THEN 2 WHEN x <= 110 THEN 1 WHEN x <= 219 THEN 0 ELSE 3 END
        WHEN 5 THEN CASE WHEN x <= 40 THEN 3 WHEN x <= 50 THEN 1 WHEN x <= 90 THEN 0 WHEN x <= 110 THEN 1 WHEN x <= 130 THEN 2 ELSE 3 END
      END;
    END;
    total := total + pt; maior := greatest(maior, pt);
    itens := itens || jsonb_build_object('rotulo', r.rotulo, 'valor', replace(v -> r.nome ->> 'n', '.', ',') || r.un, 'pontos', pt);
  END LOOP;
  IF v -> 'oxigenio-suplementar' ->> 'c' IS NULL THEN faltando := faltando || 'Suplementação de O₂'::text;
  ELSE
    pt := CASE WHEN v -> 'oxigenio-suplementar' ->> 'c' = 'ar' THEN 0 ELSE 2 END;
    total := total + pt; maior := greatest(maior, pt);
    itens := itens || jsonb_build_object('rotulo', 'Suplementação de O₂', 'valor', v -> 'oxigenio-suplementar' ->> 'r', 'pontos', pt);
  END IF;
  IF v -> 'nivel-consciencia' ->> 'c' IS NULL THEN faltando := faltando || 'Nível de consciência'::text;
  ELSE
    pt := CASE WHEN v -> 'nivel-consciencia' ->> 'c' = 'A' THEN 0 ELSE 3 END;
    total := total + pt; maior := greatest(maior, pt);
    itens := itens || jsonb_build_object('rotulo', 'Nível de consciência', 'valor', v -> 'nivel-consciencia' ->> 'r', 'pontos', pt);
  END IF;
  v_banda := CASE WHEN total >= 7 THEN 2 WHEN total >= 5 OR maior = 3 THEN 1 ELSE 0 END;
  RETURN jsonb_build_object(
    'escala', v_escala, 'total', total, 'banda', v_banda, 'itens', itens, 'faltando', to_jsonb(faltando),
    'azul', '[]'::jsonb, 'parcial', cardinality(faltando) > 0, 'aferido_em', v_ultima,
    'fonte', 'NEWS2: Royal College of Physicians, 2017 (escala 1). Referência geral, conferir contra o protocolo institucional.');
END $$;
REVOKE ALL ON FUNCTION private.calcular_acuidade_janela(uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.calcular_acuidade(p_paciente uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.calcular_acuidade_janela(p_paciente, now() - interval '24 hours', NULL)
$$;

-- ── 2. a regra do adulto, numa função só ────────────────────────────────────
-- Corte do NEWS2 = 5 e corte de idade = 14 anos: os mesmos da ficha
-- sepse-adulto (CORTE_NEWS2_SEPSE, src/clinico/escores/sepseAdulto.ts).
CREATE OR REPLACE FUNCTION private.sepse_adulto_regra(p_paciente uuid, p_desde timestamptz, p_episodio uuid, p_cids text[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_nasc date; g jsonb; a jsonb; c text; v_total int;
BEGIN
  SELECT data_nascimento INTO v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_nasc IS NULL OR v_nasc > private.data_atual() - interval '14 years' THEN RETURN NULL; END IF;
  g := private.gatilho_infeccao(p_paciente);
  IF g IS NULL AND p_cids IS NOT NULL THEN
    FOREACH c IN ARRAY p_cids LOOP
      IF private.grupo_infeccao(c) IS NOT NULL THEN
        g := jsonb_build_object('motivo', 'cid', 'cid', private.cid_normalizado(c),
                                'descricao', 'CID ' || private.cid_normalizado(c) || ' · ' || private.grupo_infeccao(c));
        EXIT;
      END IF;
    END LOOP;
  END IF;
  IF g IS NULL THEN RETURN NULL; END IF;
  a := private.calcular_acuidade_janela(p_paciente, p_desde, p_episodio);
  IF a ->> 'escala' IS DISTINCT FROM 'NEWS2' THEN RETURN NULL; END IF;
  v_total := coalesce((a ->> 'total')::int, 0);
  IF v_total < 5 THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'nivel', CASE WHEN v_total >= 7 THEN 'news2_alto' ELSE 'news2_rastreio' END,
    'total', v_total, 'parcial', a -> 'parcial', 'faltando', a -> 'faltando', 'aferido_em', a -> 'aferido_em',
    'gatilho', g);
END $$;
REVOKE ALL ON FUNCTION private.sepse_adulto_regra(uuid, timestamptz, uuid, text[]) FROM PUBLIC, anon, authenticated;

-- ── 3. alerta da internação pela mesma regra (24 h, como antes) ─────────────
CREATE OR REPLACE FUNCTION public.alertas_sepse(p_unidade uuid)
 RETURNS TABLE(paciente_id uuid, nivel text, total integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r record; ph jsonb; g jsonb; v_meses int; a jsonb;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  -- criança: Phoenix (sem mudança)
  FOR r IN
    SELECT DISTINCT p.id, p.data_nascimento FROM public.internacoes i
    JOIN public.pacientes p ON p.id = i.paciente_id
    WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
      AND p.data_nascimento > private.data_atual() - interval '14 years'
      AND (private.papel_na_unidade(p_unidade) = 'gestor' OR private.paciente_em_cuidado_no_plantao(p.id))
  LOOP
    g := private.gatilho_infeccao(r.id);
    CONTINUE WHEN g IS NULL;
    v_meses := (extract(year FROM age(private.data_atual(), r.data_nascimento)) * 12 + extract(month FROM age(private.data_atual(), r.data_nascimento)))::int;
    ph := private.calcular_phoenix(r.id, v_meses, g);
    paciente_id := r.id;
    total := (ph ->> 'total')::int;
    nivel := CASE WHEN (ph ->> 'choque')::boolean THEN 'choque' WHEN (ph ->> 'sepse')::boolean THEN 'sepse' ELSE 'rastreio' END;
    RETURN NEXT;
  END LOOP;
  -- adulto: private.sepse_adulto_regra (gatilho de infecção e NEWS2 de 5 ou mais, 24 h)
  FOR r IN
    SELECT DISTINCT p.id FROM public.internacoes i
    JOIN public.pacientes p ON p.id = i.paciente_id
    WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
      AND p.data_nascimento <= private.data_atual() - interval '14 years'
      AND (private.papel_na_unidade(p_unidade) = 'gestor' OR private.paciente_em_cuidado_no_plantao(p.id))
  LOOP
    a := private.sepse_adulto_regra(r.id, now() - interval '24 hours', NULL, NULL);
    CONTINUE WHEN a IS NULL;
    paciente_id := r.id;
    total := (a ->> 'total')::int;
    nivel := a ->> 'nivel';
    RETURN NEXT;
  END LOOP;
END $function$;

-- ── 4. aviso no atendimento (só leitura) ────────────────────────────────────
-- Tabela de registro (AV6): só de inserção; leitura pelas regras do prontuário.
CREATE TABLE IF NOT EXISTS public.avisos_sepse_atendimento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id   uuid NOT NULL REFERENCES public.episodios(id),
  evento        text NOT NULL CHECK (evento IN ('exibido', 'dispensado')),
  nivel         text NOT NULL CHECK (nivel IN ('news2_rastreio', 'news2_alto')),
  news2_total   int NOT NULL,
  parcial       boolean NOT NULL,
  cid           text,
  motivo        text CHECK (motivo IS NULL OR length(motivo) <= 300),
  autor_id      uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS avisos_sepse_atendimento_exibido_uma_vez
  ON public.avisos_sepse_atendimento (episodio_id, nivel) WHERE evento = 'exibido';
CREATE INDEX IF NOT EXISTS avisos_sepse_atendimento_unidade ON public.avisos_sepse_atendimento (unidade_id, registrado_em);
DROP TRIGGER IF EXISTS trg_avisos_sepse_atendimento_so_insercao ON public.avisos_sepse_atendimento;
CREATE TRIGGER trg_avisos_sepse_atendimento_so_insercao BEFORE UPDATE ON public.avisos_sepse_atendimento
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.avisos_sepse_atendimento;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.avisos_sepse_atendimento
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();
ALTER TABLE public.avisos_sepse_atendimento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.avisos_sepse_atendimento FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.avisos_sepse_atendimento FROM authenticated;
GRANT SELECT ON public.avisos_sepse_atendimento TO authenticated;
DROP POLICY IF EXISTS avisos_sepse_atendimento_select ON public.avisos_sepse_atendimento;
CREATE POLICY avisos_sepse_atendimento_select ON public.avisos_sepse_atendimento FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS avisos_sepse_atendimento_segundo_fator ON public.avisos_sepse_atendimento;
CREATE POLICY avisos_sepse_atendimento_segundo_fator ON public.avisos_sepse_atendimento AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());

-- Episódio que a pessoa pode atender: gestor da unidade ou paciente no plantão dela.
CREATE OR REPLACE FUNCTION private.episodio_para_aviso_sepse(p_episodio uuid)
RETURNS public.episodios LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF NOT (private.papel_na_unidade(e.unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(e.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN e;
END $$;
REVOKE ALL ON FUNCTION private.episodio_para_aviso_sepse(uuid) FROM PUBLIC, anon, authenticated;

-- A regra com a janela do atendimento (vitais das últimas 6 h do episódio; RT),
-- ou nada se a unidade desligou a ficha sepse-adulto (AV5).
CREATE OR REPLACE FUNCTION private.aviso_sepse_do_episodio(e public.episodios, p_cids text[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ferramenta_unidade fu
              WHERE fu.unidade_id = e.unidade_id AND fu.ferramenta_id = 'sepse-adulto'
                AND fu.vigente_ate IS NULL AND fu.oculta) THEN
    RETURN NULL;
  END IF;
  RETURN private.sepse_adulto_regra(e.paciente_id, now() - interval '6 hours', e.id, p_cids);
END $$;
REVOKE ALL ON FUNCTION private.aviso_sepse_do_episodio(public.episodios, text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.aviso_sepse_atendimento(p_episodio uuid, p_cids text[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios; r jsonb;
BEGIN
  e := private.episodio_para_aviso_sepse(p_episodio);
  r := private.aviso_sepse_do_episodio(e, p_cids);
  IF r IS NULL THEN RETURN NULL; END IF;
  RETURN r || jsonb_build_object('dispensado', EXISTS (
    SELECT 1 FROM public.avisos_sepse_atendimento x
     WHERE x.episodio_id = e.id AND x.nivel = r ->> 'nivel' AND x.evento = 'dispensado'));
END $$;
REVOKE ALL ON FUNCTION public.aviso_sepse_atendimento(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aviso_sepse_atendimento(uuid, text[]) TO authenticated;

-- ── 5. registro: exibido (uma vez por episódio e nível) e dispensado ───────
-- O servidor refaz a regra: nada do que a tela mandar vira número no registro.
CREATE OR REPLACE FUNCTION public.registrar_aviso_sepse(p_episodio uuid, p_evento text, p_cids text[] DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios; r jsonb; v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF p_evento NOT IN ('exibido', 'dispensado') THEN RAISE EXCEPTION 'Evento inválido.'; END IF;
  e := private.episodio_para_aviso_sepse(p_episodio);
  IF private.tenho_papel(e.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O aviso é registrado pelo médico.';
  END IF;
  r := private.aviso_sepse_do_episodio(e, p_cids);
  IF r IS NULL THEN
    IF p_evento = 'exibido' THEN RETURN; END IF;
    RAISE EXCEPTION 'O aviso de sepse não se aplica agora a este atendimento.';
  END IF;
  INSERT INTO public.avisos_sepse_atendimento
    (unidade_id, paciente_id, episodio_id, evento, nivel, news2_total, parcial, cid, motivo, autor_id)
  VALUES (e.unidade_id, e.paciente_id, e.id, p_evento, r ->> 'nivel', (r ->> 'total')::int,
          coalesce((r ->> 'parcial')::boolean, true), r -> 'gatilho' ->> 'cid',
          CASE WHEN p_evento = 'dispensado' THEN left(v_motivo, 300) END, private.meu_perfil_id())
  ON CONFLICT (episodio_id, nivel) WHERE evento = 'exibido' DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.registrar_aviso_sepse(uuid, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_aviso_sepse(uuid, text, text[], text) TO authenticated;

-- ── 6. versão nova da ficha sepse-adulto (texto do aviso e cortes) ─────────
SELECT private.registrar_versao_ferramenta('sepse-adulto', 'Sepse no adulto — SOFA, choque e lactato (Sepsis-3 · SSC 2026 · ILAS 2026)', '2026-11-17.1', 'adulto', '[{"citacao":"Singer M, Deutschman CS, Seymour CW, et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016;315(8):801–810.","url":"https://doi.org/10.1001/jama.2016.0287"},{"citacao":"Prescott HC, Antonelli M, Alhazzani W, et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026. Crit Care Med. 2026;54(4):725–812. Rec. 4 (p. 15), 51 e 52 (p. 39–40).","url":"https://doi.org/10.1097/CCM.0000000000007075"},{"citacao":"Instituto Latino Americano de Sepse (ILAS). Implementação de protocolo gerenciado de sepse — protocolo clínico, adulto. Revisado em julho de 2026. Definições (p. 3 e 5), triagem (p. 5 e 7), lactato (p. 8 e 14).","url":"https://ilas.org.br/wp-content/uploads/2022/02/Protocolo-de-tratamento-da-sepse-adulto-Revisao-julho-2026.pdf"},{"citacao":"Meyer NJ, Prescott HC. Sepsis and septic shock. N Engl J Med. 2024;391(22):2133–2146.","url":"https://doi.org/10.1056/NEJMra2403213"},{"citacao":"ANDROMEDA-SHOCK-2 Investigators. Peripheral perfusion-targeted resuscitation in septic shock. JAMA. 2025.","url":"https://doi.org/10.1001/jama.2025.0084"},{"citacao":"Ranzani OT, Singer M, Salluh JIF, et al. Development and Validation of the Sequential Organ Failure Assessment (SOFA)-2 Score. JAMA. 2025;334(23):2090–2103 (PMID 41159833).","url":"https://doi.org/10.1001/jama.2025.20516"},{"citacao":"Ahn S, Kim SM, Park JH, et al. Validation of the updated sequential organ failure assessment (SOFA)-2 score in emergency department septic shock. J Intensive Care. 2026;14(1) (PMID 42687193). Resumo: duas coortes coreanas de choque séptico no pronto-socorro (2.669 e 1.443 pacientes); AUROC da mortalidade hospitalar 0,734 × 0,702 e 0,719 × 0,671 (SOFA-2 × SOFA-1).","url":"https://doi.org/10.1186/s40560-026-00921-3"},{"citacao":"Yen CC, ZhangJian SJ, Ma CY, et al. Predictive validity of SOFA-2 score for in-hospital mortality among patients with suspected infection presenting to the emergency department. Int J Infect Dis. 2026;171:109030 (PMID 42542312). Resumo: 173.079 atendimentos em 6 hospitais de Taiwan; AUROC 0,78 nos dois escores; o SOFA-2 pontuou menos que o SOFA-1 em 62,3%.","url":"https://doi.org/10.1016/j.ijid.2026.109030"}]'::jsonb);
