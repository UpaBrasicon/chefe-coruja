-- Fase 5B, tarefa 3, etapa 3.1: unidade de consumo no cadastro de
-- medicamentos. Decisões do RT em 17/10/2026 ("1a 2a 3a 4a"):
--
--  1a. Vale no cadastro geral do medicamento (o catálogo é um só).
--  2a. Preenchida automaticamente pela primeira palavra da apresentação
--      ("Ampola 10 mL" → ampola; "Frasco 1 g pó" → frasco-ampola); a farmácia
--      confere e corrige.
--  3a. Lista fixa, com "outra" e texto.
--  4a. Altera o farmacêutico ou o gestor de qualquer unidade, com histórico
--      (vale para todas as unidades).
--
-- A dispensação (etapa 3.2) e a conta (3.3) usam esta unidade.

ALTER TABLE public.medicamento
  ADD COLUMN IF NOT EXISTS unidade_consumo text CHECK (unidade_consumo IN (
    'ampola', 'frasco_ampola', 'frasco', 'bolsa', 'comprimido', 'capsula', 'dragea', 'sache', 'envelope',
    'bisnaga', 'adesivo', 'supositorio', 'seringa_preenchida', 'caneta', 'flaconete', 'outra')),
  ADD COLUMN IF NOT EXISTS unidade_consumo_outra text,
  ADD COLUMN IF NOT EXISTS unidade_consumo_conferida_em timestamptz,
  ADD COLUMN IF NOT EXISTS unidade_consumo_conferida_por uuid REFERENCES public.perfis(id);
ALTER TABLE public.medicamento ADD CONSTRAINT medicamento_unidade_outra
  CHECK (unidade_consumo IS DISTINCT FROM 'outra' OR length(btrim(coalesce(unidade_consumo_outra, ''))) >= 3);
COMMENT ON COLUMN public.medicamento.unidade_consumo IS 'Unidade em que o medicamento é dispensado e contado na conta (Fase 5B, etapa 3.1). Sugerida pela apresentação; conferida pela farmácia.';

-- 2a. sugestão pela primeira palavra da apresentação
CREATE OR REPLACE FUNCTION private.sugerir_unidade_consumo(p_apresentacao text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH a AS (SELECT translate(lower(btrim(coalesce(p_apresentacao, ''))), 'áàâãéêíóôõúç', 'aaaaeeiooouc') AS t)
  SELECT CASE
    WHEN t ~ '^ampola' THEN 'ampola'
    WHEN t ~ '^frasco[- ]ampola' THEN 'frasco_ampola'
    -- frasco de pó para reconstituir é frasco-ampola
    WHEN t ~ '^frasco' AND t ~ '\m(po|liofilizado)\M' THEN 'frasco_ampola'
    WHEN t ~ '^frasco' THEN 'frasco'
    WHEN t ~ '^bolsa' THEN 'bolsa'
    WHEN t ~ '^comprimido' THEN 'comprimido'
    WHEN t ~ '^capsula' THEN 'capsula'
    WHEN t ~ '^dragea' THEN 'dragea'
    WHEN t ~ '^sache' THEN 'sache'
    WHEN t ~ '^envelope' THEN 'envelope'
    WHEN t ~ '^bisnaga' THEN 'bisnaga'
    WHEN t ~ '^adesivo' THEN 'adesivo'
    WHEN t ~ '^supositorio' THEN 'supositorio'
    WHEN t ~ '^seringa' THEN 'seringa_preenchida'
    WHEN t ~ '^caneta' THEN 'caneta'
    WHEN t ~ '^flaconete' THEN 'flaconete'
  END FROM a
$$;

UPDATE public.medicamento SET unidade_consumo = private.sugerir_unidade_consumo(apresentacao)
 WHERE unidade_consumo IS NULL;

-- medicamento novo (carga do catálogo) já nasce com a sugestão
CREATE OR REPLACE FUNCTION private.trg_medicamento_unidade_consumo()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.unidade_consumo IS NULL THEN NEW.unidade_consumo := private.sugerir_unidade_consumo(NEW.apresentacao); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_medicamento_unidade_consumo ON public.medicamento;
CREATE TRIGGER trg_medicamento_unidade_consumo BEFORE INSERT ON public.medicamento
  FOR EACH ROW EXECUTE FUNCTION private.trg_medicamento_unidade_consumo();

-- 4a. histórico de quem mudou
CREATE TABLE public.medicamento_unidade_historico (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id uuid NOT NULL REFERENCES public.medicamento(id),
  de             text,
  de_outra       text,
  para           text NOT NULL,
  para_outra     text,
  por            uuid NOT NULL REFERENCES public.perfis(id),
  em             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX medicamento_unidade_historico_med ON public.medicamento_unidade_historico (medicamento_id, em DESC);
ALTER TABLE public.medicamento_unidade_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY medicamento_unidade_historico_leitura ON public.medicamento_unidade_historico FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.medicamento_unidade_historico FROM anon, authenticated;
GRANT SELECT ON public.medicamento_unidade_historico TO authenticated;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.medicamento_unidade_historico FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

CREATE OR REPLACE FUNCTION private.pode_definir_unidade_consumo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR EXISTS (
    SELECT 1 FROM public.vinculos v WHERE v.perfil_id = private.meu_perfil_id() AND v.ativo AND v.papel::text IN ('farmaceutico', 'gestor'))
$$;
REVOKE ALL ON FUNCTION private.pode_definir_unidade_consumo(), private.sugerir_unidade_consumo(text) FROM PUBLIC, anon, authenticated;

-- lista para a farmácia conferir
CREATE OR REPLACE FUNCTION public.medicamentos_unidade_consumo(p_busca text DEFAULT NULL, p_a_conferir boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_definir_unidade_consumo() THEN
    RAISE EXCEPTION 'Acesso negado: a unidade de consumo é da farmácia e do gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
               'id', m.id, 'principio_ativo', m.principio_ativo, 'apresentacao', m.apresentacao, 'concentracao', m.concentracao,
               'unidade_consumo', m.unidade_consumo, 'unidade_consumo_outra', m.unidade_consumo_outra,
               'conferida_em', m.unidade_consumo_conferida_em,
               'conferida_por', (SELECT nome_completo FROM public.perfis WHERE id = m.unidade_consumo_conferida_por))
             ORDER BY m.principio_ativo, m.apresentacao)
             FROM (SELECT * FROM public.medicamento m WHERE m.ativo
                     AND (v_busca IS NULL OR m.principio_ativo_norm LIKE '%' || private.nome_comparavel(v_busca) || '%'
                          OR lower(coalesce(m.apresentacao, '')) LIKE '%' || lower(v_busca) || '%')
                     AND (NOT p_a_conferir OR m.unidade_consumo_conferida_em IS NULL)
                   ORDER BY m.principio_ativo, m.apresentacao LIMIT 300) m), '[]'::jsonb),
    'a_conferir', (SELECT count(*) FROM public.medicamento WHERE ativo AND unidade_consumo_conferida_em IS NULL),
    'sem_unidade', (SELECT count(*) FROM public.medicamento WHERE ativo AND unidade_consumo IS NULL));
END $$;

-- definir ou confirmar (confirmar = mesma unidade)
CREATE OR REPLACE FUNCTION public.definir_unidade_consumo(p_medicamento uuid, p_unidade text, p_outra text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.medicamento; v_eu uuid := private.meu_perfil_id(); v_outra text := nullif(btrim(coalesce(p_outra, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_definir_unidade_consumo() THEN
    RAISE EXCEPTION 'Acesso negado: a unidade de consumo é da farmácia e do gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO m FROM public.medicamento WHERE id = p_medicamento FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Medicamento não encontrado.'; END IF;
  IF p_unidade NOT IN ('ampola', 'frasco_ampola', 'frasco', 'bolsa', 'comprimido', 'capsula', 'dragea', 'sache', 'envelope',
                       'bisnaga', 'adesivo', 'supositorio', 'seringa_preenchida', 'caneta', 'flaconete', 'outra') THEN
    RAISE EXCEPTION 'Escolha a unidade de consumo da lista.';
  END IF;
  IF p_unidade = 'outra' AND length(coalesce(v_outra, '')) < 3 THEN RAISE EXCEPTION 'Escreva qual é a unidade (mínimo de 3 letras).'; END IF;
  IF p_unidade <> 'outra' THEN v_outra := NULL; END IF;
  UPDATE public.medicamento
     SET unidade_consumo = p_unidade, unidade_consumo_outra = v_outra,
         unidade_consumo_conferida_em = now(), unidade_consumo_conferida_por = v_eu, updated_at = now()
   WHERE id = m.id;
  INSERT INTO public.medicamento_unidade_historico (medicamento_id, de, de_outra, para, para_outra, por)
  VALUES (m.id, m.unidade_consumo, m.unidade_consumo_outra, p_unidade, v_outra, v_eu);
  PERFORM private.registrar_auditoria('unidade_consumo', 'medicamento', m.id, NULL,
    jsonb_build_object('de', m.unidade_consumo, 'para', p_unidade, 'outra', v_outra));
  RETURN jsonb_build_object('id', m.id, 'unidade_consumo', p_unidade, 'unidade_consumo_outra', v_outra);
END $$;

REVOKE ALL ON FUNCTION public.medicamentos_unidade_consumo(text, boolean), public.definir_unidade_consumo(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medicamentos_unidade_consumo(text, boolean), public.definir_unidade_consumo(uuid, text, text) TO authenticated;
