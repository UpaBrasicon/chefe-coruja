-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 7, pré-natal, parte 1, o banco (BACKLOG.md; decisões do RT em
-- 05/11/2026, K1 a K6 = A; diagnóstico em
-- docs/ubs/TAREFA7B-PRENATAL-PUERICULTURA-DIAGNOSTICO.md).
--
-- Régua: nota metodológica C3 (cuidado na gestação e puerpério) da SAPS/MS,
-- assinada em 19 a 22/06/2026 e lida na fonte em 05/11/2026. As janelas que a
-- nota não fixa em dias vêm do Caderno de Atenção Básica nº 32 (pré-natal de
-- baixo risco, MS, 2013), que a nota cita:
--   • gestação: da DUM até a data de desfecho ou, sem ela, DUM + 294 dias
--     (42 semanas), conforme o item 17 e a seção 4.1 da nota;
--   • puerpério: até 42 dias depois do fim da gestação (nota, itens 5 e 17);
--   • 1º trimestre: até a 13ª semana, ou seja, até DUM + 97 dias (13s6d)
--     (CAB 32: "primeiro trimestre da gestação (até a 13ª semana)");
--   • 3º trimestre: a partir da 28ª semana, ou seja, de DUM + 196 dias (28s0d)
--     (CAB 32: sífilis e HIV repetidos "no 3º trimestre", "com 28 semanas");
--   • os códigos CID-10 e CIAP-2 de gestação, de puerpério e de exclusão
--     (aborto) e os códigos SIGTAP dos testes rápidos e dos exames são os do
--     item 24 da nota, sem acréscimo.
--
-- 1. pre_natal_gestacoes: cada gestação acompanhada na UBS, com a DUM, o
--    desfecho (parto ou aborto) e a saída com motivo. Tabela própria: o
--    hiperdia (programa_participantes) não muda. Acesso só por RPC.
-- 2. Entrada pela consulta (K2): a consulta da UBS que encerra com o problema
--    "pré-natal" ou com o CID-10/CIAP-2 de gestação da nota abre a gestação,
--    com a DUM da classificação, se houver. Com o CID-10/CIAP-2 de aborto da
--    nota, a gestação ativa é encerrada como aborto (interrupção, item 15).
-- 3. À mão: o médico ou o enfermeiro incluem com a DUM, corrigem a DUM,
--    registram o desfecho e retiram com motivo.
-- 4. Saída sozinha (K2): a gestação sai do painel 42 dias depois do fim
--    (desfecho ou DUM + 294), sem rotina noturna: o painel só lista as ativas.
-- 5. Painel e paciente (K4, K5): por gestação ativa, a DUM, a DPP, o fim, e
--    o que o app registra de cada boa prática na janela certa. A regra de "em
--    dia" e dos pontos fica em src/domain/preNatal.ts. Quem vê é o mesmo do
--    hiperdia: médico, enfermeiro, técnico de enfermagem e gestor da UBS.
--    ACS, vacina e saúde bucal não existem no app (K3: "não registrado").
--
-- Idempotente. Teste: supabase/tests/5a_pre_natal.sql
--
-- Rollback (na ordem):
--   DROP TRIGGER IF EXISTS trg_pre_natal_consulta ON public.episodios;
--   DROP FUNCTION IF EXISTS public.pre_natal_incluir(uuid, date, uuid),
--     public.pre_natal_definir_dum(uuid, date), public.pre_natal_registrar_desfecho(uuid, text, date),
--     public.pre_natal_retirar(uuid, text), public.pre_natal_painel(uuid), public.pre_natal_do_paciente(uuid),
--     private.pre_natal_na_consulta(), private.pre_natal_registros(uuid),
--     private.pre_natal_ativa(timestamptz, text, date, date), private.pre_natal_fim(date, date),
--     private.pre_natal_gestacao_na_consulta(text[], text[], text[]),
--     private.pre_natal_puerperio_na_consulta(text[], text[], text[]),
--     private.pre_natal_aborto_na_consulta(text[], text[]), private.pre_natal_grupo_teste(text),
--     private.pre_natal_cid(text[], text[]), private.pre_natal_exigir_cuidador(uuid);
--   DROP TABLE IF EXISTS public.pre_natal_gestacoes;
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pre_natal_gestacoes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id              uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id             uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  origem                  text NOT NULL CHECK (origem IN ('consulta', 'manual')),
  episodio_id             uuid REFERENCES public.episodios(id),
  dum                     date,
  dum_por                 uuid REFERENCES public.perfis(id),
  dum_em                  timestamptz,
  entrada_em              timestamptz NOT NULL DEFAULT now(),
  entrada_por             uuid REFERENCES public.perfis(id),
  desfecho                text CHECK (desfecho IN ('parto', 'aborto')),
  desfecho_em             date,
  desfecho_por            uuid REFERENCES public.perfis(id),
  desfecho_registrado_em  timestamptz,
  saida_em                timestamptz,
  saida_por               uuid REFERENCES public.perfis(id),
  motivo_saida            text,
  CHECK ((desfecho IS NULL) = (desfecho_em IS NULL)),
  CHECK (desfecho_em IS NULL OR dum IS NULL OR desfecho_em >= dum),
  CHECK (saida_em IS NULL OR length(btrim(coalesce(motivo_saida, ''))) >= 5)
);
CREATE INDEX IF NOT EXISTS idx_pre_natal_gestacoes_unidade ON public.pre_natal_gestacoes (unidade_id) WHERE saida_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_pre_natal_gestacoes_paciente ON public.pre_natal_gestacoes (paciente_id, entrada_em DESC);

ALTER TABLE public.pre_natal_gestacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pre_natal_gestacoes FROM anon, authenticated;
COMMENT ON TABLE public.pre_natal_gestacoes IS
  'Pré-natal da UBS (5A, tarefa 7; nota C3 da SAPS/MS): uma linha por gestação acompanhada. Acesso só pelas RPCs pre_natal_*.';

-- ── apoio: códigos da nota C3, item 24 ──────────────────────────────────────
-- CID-10 normalizado (sem ponto, maiúsculo) que casa com a lista: código de 3
-- caracteres pega a categoria; de 4, só a subcategoria.
CREATE OR REPLACE FUNCTION private.pre_natal_cid(p_cids text[], p_lista text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM unnest(coalesce(p_cids, '{}')) c, unnest(p_lista) l
                  WHERE left(upper(replace(btrim(c), '.', '')), length(l)) = l)
$$;

-- f) gestação: problema "pré-natal" da ficha, CIAP-2 ou CID-10 da nota
CREATE OR REPLACE FUNCTION private.pre_natal_gestacao_na_consulta(p_problemas text[], p_cids text[], p_ciaps text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 'pre_natal' = ANY (coalesce(p_problemas, '{}'))
      OR coalesce(p_ciaps, '{}') && ARRAY['W03', 'W78', 'W79', 'W81', 'W84', 'W85']
      OR private.pre_natal_cid(p_cids, ARRAY[
           'O10', 'O11', 'O12', 'O13', 'O14', 'O15', 'O16', 'O20', 'O21', 'O22', 'O23', 'O24', 'O25', 'O26', 'O28', 'O29',
           'O30', 'O31', 'O32', 'O33', 'O34', 'O35', 'O36', 'O40', 'O41', 'O43', 'O44', 'O46', 'O47', 'O48', 'O752', 'O753', 'O98',
           'O990', 'O991', 'O992', 'O993', 'O994', 'O995', 'O996', 'O997', 'Z321', 'Z33', 'Z34', 'Z35', 'Z36', 'Z640'])
$$;

-- f) puerpério: problema "puerpério" da ficha, CIAP-2 ou CID-10 da nota
CREATE OR REPLACE FUNCTION private.pre_natal_puerperio_na_consulta(p_problemas text[], p_cids text[], p_ciaps text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 'puerperio' = ANY (coalesce(p_problemas, '{}'))
      OR coalesce(p_ciaps, '{}') && ARRAY['48', '49', 'P29', 'W18', 'W19', 'W70', 'W90', 'W91', 'W92', 'W93', 'W94', 'W95', 'W96']
      OR private.pre_natal_cid(p_cids, ARRAY[
           'F53', 'M830', 'O10', 'O152', 'O266', 'O722', 'O723', 'O85', 'O86', 'O87', 'O90', 'O91', 'O92', 'O94', 'O98', 'O99',
           'Z370', 'Z371', 'Z372', 'Z373', 'Z374', 'Z375', 'Z376', 'Z377', 'Z379', 'Z38', 'Z39'])
$$;

-- g) exclusão (aborto): CIAP-2 W82, W83; CID-10 O02, O02.1, O03 a O06, Z30.3
CREATE OR REPLACE FUNCTION private.pre_natal_aborto_na_consulta(p_cids text[], p_ciaps text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(p_ciaps, '{}') && ARRAY['W82', 'W83']
      OR private.pre_natal_cid(p_cids, ARRAY['O02', 'O03', 'O04', 'O05', 'O06', 'Z303'])
$$;

-- h) teste rápido ou exame da nota, pelo agravo (o HTLV da lista não entra em G nem H)
CREATE OR REPLACE FUNCTION private.pre_natal_grupo_teste(p_codigo text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g')
    WHEN '0214010040' THEN 'hiv' WHEN '0214010279' THEN 'hiv' WHEN '0214010058' THEN 'hiv'
    WHEN '0213010780' THEN 'hiv' WHEN '0213010500' THEN 'hiv' WHEN '0202030300' THEN 'hiv'
    WHEN '0214010074' THEN 'sifilis' WHEN '0214010082' THEN 'sifilis' WHEN '0214010252' THEN 'sifilis'
    WHEN '0202031098' THEN 'sifilis' WHEN '0202031110' THEN 'sifilis' WHEN '0202031179' THEN 'sifilis'
    WHEN '0214010104' THEN 'hepatite_b' WHEN '0214010236' THEN 'hepatite_b' WHEN '0202030784' THEN 'hepatite_b'
    WHEN '0202030970' THEN 'hepatite_b' WHEN '0213010208' THEN 'hepatite_b'
    WHEN '0214010090' THEN 'hepatite_c' WHEN '0214010309' THEN 'hepatite_c' WHEN '0202030059' THEN 'hepatite_c'
    WHEN '0202030679' THEN 'hepatite_c'
  END
$$;

-- fim da gestação: desfecho ou DUM + 294 dias (nota, item 17)
CREATE OR REPLACE FUNCTION private.pre_natal_fim(p_dum date, p_desfecho_em date)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(p_desfecho_em, p_dum + 294)
$$;

-- ativa: sem saída, sem aborto e até 42 dias depois do fim (sem DUM nem
-- desfecho, continua ativa até alguém registrar)
CREATE OR REPLACE FUNCTION private.pre_natal_ativa(p_saida timestamptz, p_desfecho text, p_dum date, p_desfecho_em date)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT p_saida IS NULL AND p_desfecho IS DISTINCT FROM 'aborto'
     AND (private.pre_natal_fim(p_dum, p_desfecho_em) IS NULL
          OR private.data_atual() <= private.pre_natal_fim(p_dum, p_desfecho_em) + 42)
$$;

-- quem inclui, corrige e retira: o médico ou o enfermeiro da UBS
CREATE OR REPLACE FUNCTION private.pre_natal_exigir_cuidador(p_unidade uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = p_unidade AND tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'O pré-natal é da UBS.';
  END IF;
  IF NOT (private.tenho_papel(p_unidade, 'plantonista') IS TRUE OR private.tenho_papel(p_unidade, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: o pré-natal é registrado pelo médico ou pelo enfermeiro da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

-- ── o que o app registra de cada boa prática, na janela da nota ─────────────
CREATE OR REPLACE FUNCTION private.pre_natal_registros(p_gestacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g public.pre_natal_gestacoes;
  v_fim date;
  v_out jsonb;
  v_primeira date; v_consultas int; v_puerperio date; v_pa int; v_peso_altura int;
  v_t1 jsonb; v_t3 jsonb;
BEGIN
  SELECT * INTO g FROM public.pre_natal_gestacoes WHERE id = p_gestacao;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_fim := private.pre_natal_fim(g.dum, g.desfecho_em);
  v_out := jsonb_build_object(
    'id', g.id, 'origem', g.origem, 'entrada_em', g.entrada_em,
    'dum', g.dum, 'dpp', g.dum + 280, 'fim_gestacao', v_fim, 'puerperio_ate', v_fim + 42,
    'desfecho', g.desfecho, 'desfecho_em', g.desfecho_em,
    'proxima_consulta', (SELECT min(a.inicio) FROM public.agendamentos a
                          WHERE a.paciente_id = g.paciente_id AND a.tipo = 'consulta' AND a.situacao = 'agendado' AND a.inicio > now()));
  -- sem DUM não há janela: o painel pede a DUM
  IF g.dum IS NULL THEN RETURN v_out; END IF;

  -- (A), (B), (I): consulta da UBS por médico ou enfermeiro, com a condição da nota
  SELECT min(c.d) FILTER (WHERE c.gest AND c.d BETWEEN g.dum AND v_fim),
         count(*) FILTER (WHERE c.gest AND c.d BETWEEN g.dum AND v_fim),
         min(c.d) FILTER (WHERE c.puerp AND c.d > v_fim AND c.d <= v_fim + 42)
    INTO v_primeira, v_consultas, v_puerperio
    FROM (SELECT (e.encerrado_em AT TIME ZONE 'America/Sao_Paulo')::date AS d,
                 private.pre_natal_gestacao_na_consulta(e.problemas_aps, e.cid_aps, e.ciap_aps) AS gest,
                 private.pre_natal_puerperio_na_consulta(e.problemas_aps, e.cid_aps, e.ciap_aps) AS puerp
            FROM public.episodios e
           WHERE e.paciente_id = g.paciente_id AND e.tipo_atendimento_aps IS NOT NULL
             AND e.conduta_aps IS NOT NULL AND e.encerrado_em IS NOT NULL) c;

  -- (C) aferições de pressão arterial na gestação
  SELECT count(*) INTO v_pa
    FROM public.observacao o JOIN public.conceito k ON k.id = o.conceito_id
   WHERE o.paciente_id = g.paciente_id AND k.nome = 'pressao-arterial-sistolica'
     AND (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN g.dum AND v_fim;

  -- (D) peso e altura no mesmo dia, na gestação (um por dia)
  SELECT count(DISTINCT (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date) INTO v_peso_altura
    FROM public.observacao o JOIN public.conceito k ON k.id = o.conceito_id
   WHERE o.paciente_id = g.paciente_id AND k.nome = 'peso'
     AND (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN g.dum AND v_fim
     AND EXISTS (SELECT 1 FROM public.observacao o2 JOIN public.conceito k2 ON k2.id = o2.conceito_id
                  WHERE o2.paciente_id = g.paciente_id AND k2.nome = 'estatura'
                    AND (o2.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date = (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date);

  -- (G) e (H): teste rápido realizado ou exame com resultado, pelo código da nota
  WITH t AS (
    SELECT private.pre_natal_grupo_teste(p.procedimento) AS grupo, (p.realizado_em AT TIME ZONE 'America/Sao_Paulo')::date AS d
      FROM public.procedimentos_realizados p
     WHERE p.paciente_id = g.paciente_id AND p.cancelado_em IS NULL
    UNION ALL
    SELECT private.pre_natal_grupo_teste(x.procedimento), (r.liberado_em AT TIME ZONE 'America/Sao_Paulo')::date
      FROM public.exames_pedidos x JOIN public.exame_resultados r ON r.exame_id = x.id AND r.vigente
     WHERE x.paciente_id = g.paciente_id AND x.situacao IS DISTINCT FROM 'cancelado')
  SELECT coalesce(jsonb_object_agg(grupo, d1) FILTER (WHERE d1 IS NOT NULL), '{}'::jsonb),
         coalesce(jsonb_object_agg(grupo, d3) FILTER (WHERE d3 IS NOT NULL AND grupo IN ('sifilis', 'hiv')), '{}'::jsonb)
    INTO v_t1, v_t3
    FROM (SELECT grupo,
                 min(d) FILTER (WHERE d BETWEEN g.dum AND least(g.dum + 97, v_fim)) AS d1,
                 min(d) FILTER (WHERE d BETWEEN g.dum + 196 AND v_fim) AS d3
            FROM t WHERE grupo IS NOT NULL GROUP BY grupo) s;

  RETURN v_out || jsonb_build_object(
    'primeira_consulta', v_primeira, 'consultas', v_consultas, 'pa', v_pa, 'peso_altura', v_peso_altura,
    'testes_1tri', v_t1, 'testes_3tri', v_t3, 'consulta_puerperio', v_puerperio);
END $$;

REVOKE ALL ON FUNCTION private.pre_natal_cid(text[], text[]), private.pre_natal_gestacao_na_consulta(text[], text[], text[]),
  private.pre_natal_puerperio_na_consulta(text[], text[], text[]), private.pre_natal_aborto_na_consulta(text[], text[]),
  private.pre_natal_grupo_teste(text), private.pre_natal_fim(date, date), private.pre_natal_ativa(timestamptz, text, date, date),
  private.pre_natal_exigir_cuidador(uuid), private.pre_natal_registros(uuid) FROM PUBLIC, anon, authenticated;

-- ── entrada e aborto pela consulta (K2) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION private.pre_natal_na_consulta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.pre_natal_gestacoes; v_dia date; v_dum date;
BEGIN
  IF NEW.etapa = 'encerrado' AND OLD.etapa IS DISTINCT FROM 'encerrado' AND NEW.tipo_atendimento_aps IS NOT NULL THEN
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtextextended('pre_natal:' || NEW.paciente_id::text, 0));
      v_dia := (coalesce(NEW.encerrado_em, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
      SELECT * INTO g FROM public.pre_natal_gestacoes x
       WHERE x.paciente_id = NEW.paciente_id AND private.pre_natal_ativa(x.saida_em, x.desfecho, x.dum, x.desfecho_em)
       ORDER BY x.entrada_em DESC LIMIT 1;
      IF private.pre_natal_aborto_na_consulta(NEW.cid_aps, NEW.ciap_aps) THEN
        -- interrupção do acompanhamento (nota, item 15)
        IF g.id IS NOT NULL AND g.desfecho IS NULL AND (g.dum IS NULL OR v_dia >= g.dum) THEN
          UPDATE public.pre_natal_gestacoes
             SET desfecho = 'aborto', desfecho_em = v_dia, desfecho_por = NEW.desfecho_por, desfecho_registrado_em = now()
           WHERE id = g.id;
          PERFORM private.registrar_auditoria('pre_natal_desfecho', 'pre_natal_gestacoes', g.id, g.unidade_id,
            jsonb_build_object('tipo', 'aborto', 'situacao', 'consulta'));
        END IF;
      ELSIF g.id IS NULL AND private.pre_natal_gestacao_na_consulta(NEW.problemas_aps, NEW.cid_aps, NEW.ciap_aps) THEN
        -- a DUM da classificação desta consulta, se a enfermagem registrou
        SELECT (c.gestacao ->> 'dum')::date INTO v_dum
          FROM public.classificacoes_risco c
         WHERE c.episodio_id = NEW.id AND nullif(c.gestacao ->> 'dum', '') IS NOT NULL
         ORDER BY c.criado_em DESC LIMIT 1;
        IF v_dum IS NOT NULL AND (v_dum > v_dia OR v_dia - v_dum > 336) THEN v_dum := NULL; END IF;
        INSERT INTO public.pre_natal_gestacoes (unidade_id, paciente_id, origem, episodio_id, dum, dum_por, dum_em, entrada_por)
        VALUES (NEW.unidade_id, NEW.paciente_id, 'consulta', NEW.id, v_dum,
                CASE WHEN v_dum IS NOT NULL THEN NEW.desfecho_por END, CASE WHEN v_dum IS NOT NULL THEN now() END, NEW.desfecho_por);
      END IF;
    EXCEPTION WHEN others THEN
      -- a consulta nunca trava pelo pré-natal
      RAISE WARNING 'pré-natal: consulta % não registrada: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.pre_natal_na_consulta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pre_natal_consulta ON public.episodios;
CREATE TRIGGER trg_pre_natal_consulta AFTER UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.pre_natal_na_consulta();

-- ── à mão: incluir, DUM, desfecho, retirar ──────────────────────────────────
-- p_episodio: a consulta aberta de onde a inclusão foi feita (origem "consulta")
CREATE OR REPLACE FUNCTION public.pre_natal_incluir(p_paciente uuid, p_dum date DEFAULT NULL, p_episodio uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes; v_id uuid; v_hoje date := private.data_atual();
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  PERFORM private.pre_natal_exigir_cuidador(pa.unidade_id);
  IF p_dum IS NOT NULL AND (p_dum > v_hoje OR v_hoje - p_dum > 336) THEN
    RAISE EXCEPTION 'A DUM tem de ser de hoje para trás, até 48 semanas.';
  END IF;
  IF p_episodio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = p_episodio AND paciente_id = pa.id) THEN
    RAISE EXCEPTION 'A consulta não é desta paciente.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pre_natal:' || pa.id::text, 0));
  IF EXISTS (SELECT 1 FROM public.pre_natal_gestacoes x
              WHERE x.paciente_id = pa.id AND private.pre_natal_ativa(x.saida_em, x.desfecho, x.dum, x.desfecho_em)) THEN
    RAISE EXCEPTION 'A paciente já está no pré-natal.';
  END IF;
  INSERT INTO public.pre_natal_gestacoes (unidade_id, paciente_id, origem, episodio_id, dum, dum_por, dum_em, entrada_por)
  VALUES (pa.unidade_id, pa.id, CASE WHEN p_episodio IS NULL THEN 'manual' ELSE 'consulta' END, p_episodio, p_dum,
          CASE WHEN p_dum IS NOT NULL THEN private.meu_perfil_id() END, CASE WHEN p_dum IS NOT NULL THEN now() END,
          private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('pre_natal_incluido', 'pre_natal_gestacoes', v_id, pa.unidade_id,
    jsonb_build_object('tipo', CASE WHEN p_episodio IS NULL THEN 'manual' ELSE 'consulta' END));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pre_natal_definir_dum(p_gestacao uuid, p_dum date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.pre_natal_gestacoes; v_hoje date := private.data_atual();
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO g FROM public.pre_natal_gestacoes WHERE id = p_gestacao FOR UPDATE;
  IF NOT FOUND OR NOT private.pre_natal_ativa(g.saida_em, g.desfecho, g.dum, g.desfecho_em) THEN
    RAISE EXCEPTION 'A gestação não está no pré-natal.';
  END IF;
  PERFORM private.pre_natal_exigir_cuidador(g.unidade_id);
  IF p_dum IS NULL OR p_dum > v_hoje OR v_hoje - p_dum > 336 THEN
    RAISE EXCEPTION 'A DUM tem de ser de hoje para trás, até 48 semanas.';
  END IF;
  IF g.desfecho_em IS NOT NULL AND p_dum > g.desfecho_em THEN
    RAISE EXCEPTION 'A DUM não pode ser depois do desfecho.';
  END IF;
  UPDATE public.pre_natal_gestacoes SET dum = p_dum, dum_por = private.meu_perfil_id(), dum_em = now() WHERE id = g.id;
  PERFORM private.registrar_auditoria('pre_natal_dum', 'pre_natal_gestacoes', g.id, g.unidade_id,
    jsonb_build_object('anterior', g.dum IS NOT NULL));
END $$;

-- desfecho: parto (abre o puerpério de 42 dias) ou aborto (interrompe)
CREATE OR REPLACE FUNCTION public.pre_natal_registrar_desfecho(p_gestacao uuid, p_desfecho text, p_data date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.pre_natal_gestacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO g FROM public.pre_natal_gestacoes WHERE id = p_gestacao FOR UPDATE;
  IF NOT FOUND OR NOT private.pre_natal_ativa(g.saida_em, g.desfecho, g.dum, g.desfecho_em) THEN
    RAISE EXCEPTION 'A gestação não está no pré-natal.';
  END IF;
  PERFORM private.pre_natal_exigir_cuidador(g.unidade_id);
  IF p_desfecho IS NULL OR p_desfecho NOT IN ('parto', 'aborto') THEN RAISE EXCEPTION 'Desfecho: parto ou aborto.'; END IF;
  IF p_data IS NULL OR p_data > private.data_atual() THEN RAISE EXCEPTION 'A data do desfecho tem de ser de hoje para trás.'; END IF;
  IF g.dum IS NOT NULL AND p_data < g.dum THEN RAISE EXCEPTION 'A data do desfecho não pode ser antes da DUM.'; END IF;
  UPDATE public.pre_natal_gestacoes
     SET desfecho = p_desfecho, desfecho_em = p_data, desfecho_por = private.meu_perfil_id(), desfecho_registrado_em = now()
   WHERE id = g.id;
  PERFORM private.registrar_auditoria('pre_natal_desfecho', 'pre_natal_gestacoes', g.id, g.unidade_id,
    jsonb_build_object('tipo', p_desfecho, 'situacao', 'manual'));
END $$;

CREATE OR REPLACE FUNCTION public.pre_natal_retirar(p_gestacao uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.pre_natal_gestacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO g FROM public.pre_natal_gestacoes WHERE id = p_gestacao FOR UPDATE;
  IF NOT FOUND OR g.saida_em IS NOT NULL THEN RAISE EXCEPTION 'A gestação não está no pré-natal.'; END IF;
  PERFORM private.pre_natal_exigir_cuidador(g.unidade_id);
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Escreva o motivo da saída (mínimo de 5 letras).'; END IF;
  UPDATE public.pre_natal_gestacoes SET saida_em = now(), saida_por = private.meu_perfil_id(), motivo_saida = btrim(p_motivo)
   WHERE id = g.id;
  PERFORM private.registrar_auditoria('pre_natal_retirado', 'pre_natal_gestacoes', g.id, g.unidade_id, NULL);
END $$;

-- ── painel e paciente (K4, K5) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pre_natal_painel(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.hiperdia_ve(p_unidade) THEN
    RAISE EXCEPTION 'O pré-natal é visto pelo médico, pela enfermagem e pelo gestor da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('paciente_id', pa.id, 'nome', pa.nome, 'nome_social', pa.nome_social,
                                        'data_nascimento', pa.data_nascimento) || private.pre_natal_registros(x.id)
           ORDER BY coalesce(nullif(btrim(pa.nome_social), ''), pa.nome))
      FROM public.pre_natal_gestacoes x JOIN public.pacientes pa ON pa.id = x.paciente_id
     WHERE x.unidade_id = p_unidade AND private.pre_natal_ativa(x.saida_em, x.desfecho, x.dum, x.desfecho_em)), '[]'::jsonb);
END $$;

-- bloco da consulta: a gestação ativa da paciente, ou null
CREATE OR REPLACE FUNCTION public.pre_natal_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF private.segundo_fator_ok() IS NOT TRUE OR v_unidade IS NULL OR NOT private.hiperdia_ve(v_unidade) THEN
    RAISE EXCEPTION 'O pré-natal é visto pelo médico, pela enfermagem e pelo gestor da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object('gestacao', (
    SELECT private.pre_natal_registros(x.id) FROM public.pre_natal_gestacoes x
     WHERE x.paciente_id = p_paciente AND private.pre_natal_ativa(x.saida_em, x.desfecho, x.dum, x.desfecho_em)
     ORDER BY x.entrada_em DESC LIMIT 1));
END $$;

REVOKE ALL ON FUNCTION public.pre_natal_incluir(uuid, date, uuid), public.pre_natal_definir_dum(uuid, date),
  public.pre_natal_registrar_desfecho(uuid, text, date), public.pre_natal_retirar(uuid, text),
  public.pre_natal_painel(uuid), public.pre_natal_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pre_natal_incluir(uuid, date, uuid), public.pre_natal_definir_dum(uuid, date),
  public.pre_natal_registrar_desfecho(uuid, text, date), public.pre_natal_retirar(uuid, text),
  public.pre_natal_painel(uuid), public.pre_natal_do_paciente(uuid) TO authenticated;
