-- Decisões do RT de 25/11/2026 sobre o teste de fluxo B (achados B-03 e B-04).
--
-- B-04: os isolamentos se somam. Pedido "reverso" de paciente marcado em
--   gotícula fica com gotícula E reverso. O pedido de regulação guarda todos os
--   tipos em isolamento_tipos (o tipo principal segue em isolamento_tipo, para
--   quem ainda lê só ele). A marca do paciente no atendimento aceita "reverso".
-- B-03: o isolamento segue o paciente até o hospital de destino: ao registrar a
--   chegada na rede, o cadastro do destino recebe as mesmas marcas (tipo,
--   situação e agente), com a unidade de origem, o autor e a hora originais
--   guardados. A marca continua até um médico retirar, dizendo o porquê
--   (o enfermeiro deixa de retirar; segue marcando).
--
-- Expand: colunas novas nulas ou com default; nenhuma coluna sai. Idempotente.
-- Rollback no fim.

-- ── tabelas (expand) ────────────────────────────────────────────────────────
ALTER TABLE public.regulacao_solicitacoes ADD COLUMN IF NOT EXISTS isolamento_tipos text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.isolamentos_paciente
  ADD COLUMN IF NOT EXISTS situacao text,
  ADD COLUMN IF NOT EXISTS agente text,
  ADD COLUMN IF NOT EXISTS origem_unidade_id uuid REFERENCES public.unidades(id),
  ADD COLUMN IF NOT EXISTS origem_marcado_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS origem_marcado_em timestamptz,
  ADD COLUMN IF NOT EXISTS regulacao_id uuid REFERENCES public.regulacao_solicitacoes(id);
DO $c$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'isolamentos_paciente_situacao_check') THEN
    ALTER TABLE public.isolamentos_paciente ADD CONSTRAINT isolamentos_paciente_situacao_check
      CHECK (situacao IS NULL OR situacao IN ('suspeito', 'confirmado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'isolamentos_paciente_agente_check') THEN
    ALTER TABLE public.isolamentos_paciente ADD CONSTRAINT isolamentos_paciente_agente_check
      CHECK (agente IS NULL OR length(agente) <= 120);
  END IF;
  IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'isolamentos_paciente_tipo_check')) NOT LIKE '%reverso%' THEN
    ALTER TABLE public.isolamentos_paciente DROP CONSTRAINT isolamentos_paciente_tipo_check;
    ALTER TABLE public.isolamentos_paciente ADD CONSTRAINT isolamentos_paciente_tipo_check
      CHECK (tipo IN ('contato', 'goticula', 'aerossol', 'reverso'));
  END IF;
END $c$;
CREATE INDEX IF NOT EXISTS isolamentos_paciente_origem_unidade_fk_idx ON public.isolamentos_paciente (origem_unidade_id) WHERE origem_unidade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS isolamentos_paciente_origem_marcado_por_fk_idx ON public.isolamentos_paciente (origem_marcado_por) WHERE origem_marcado_por IS NOT NULL;
CREATE INDEX IF NOT EXISTS isolamentos_paciente_regulacao_fk_idx ON public.isolamentos_paciente (regulacao_id) WHERE regulacao_id IS NOT NULL;

-- ── B-04: o pedido soma a marca do paciente e o que o médico pediu ──────────
CREATE OR REPLACE FUNCTION private.regulacao_leva_isolamento()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_marcas text[]; v_pedido text[];
BEGIN
  v_marcas := CASE WHEN NEW.paciente_id IS NULL THEN '{}'::text[] ELSE private.isolamento_ativo(NEW.paciente_id) END;
  -- o que o médico pediu, antes de o tipo principal subir para a marca (contato + aerossol vale pelos dois)
  v_pedido := CASE WHEN coalesce(NEW.isolamento, false) AND NEW.isolamento_tipo IS NOT NULL
                   THEN CASE NEW.isolamento_tipo WHEN 'contato_aerossol' THEN ARRAY['contato', 'aerossol'] ELSE ARRAY[NEW.isolamento_tipo] END
                   ELSE '{}'::text[] END;
  IF cardinality(v_marcas) > 0 THEN
    IF NOT coalesce(NEW.isolamento, false) THEN
      NEW.isolamento := true;
      NEW.isolamento_tipo := v_marcas[1];
    ELSIF NEW.isolamento_tipo IN ('aerossol', 'goticula', 'contato') AND v_marcas[1] IN ('aerossol', 'goticula', 'contato')
          AND array_position(ARRAY['aerossol', 'goticula', 'contato'], v_marcas[1]) < array_position(ARRAY['aerossol', 'goticula', 'contato'], NEW.isolamento_tipo) THEN
      NEW.isolamento_tipo := v_marcas[1];   -- o tipo principal não fica abaixo da marca
    END IF;
  END IF;
  -- todos os tipos: o pedido mais as marcas ativas do paciente
  SELECT coalesce(array_agg(t ORDER BY CASE t WHEN 'aerossol' THEN 1 WHEN 'goticula' THEN 2 WHEN 'contato' THEN 3 ELSE 4 END), '{}'::text[])
    INTO NEW.isolamento_tipos
    FROM (SELECT DISTINCT unnest(v_pedido || v_marcas) AS t) x;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_regulacao_leva_isolamento ON public.regulacao_solicitacoes;
CREATE TRIGGER trg_regulacao_leva_isolamento BEFORE INSERT OR UPDATE OF isolamento, isolamento_tipo ON public.regulacao_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION private.regulacao_leva_isolamento();
-- pedidos que já existem: os tipos são o tipo do pedido (a marca da época não se reconstrói)
UPDATE public.regulacao_solicitacoes
   SET isolamento_tipos = CASE isolamento_tipo WHEN 'contato_aerossol' THEN ARRAY['aerossol', 'contato'] ELSE ARRAY[isolamento_tipo] END
 WHERE isolamento AND isolamento_tipo IS NOT NULL AND isolamento_tipos = '{}';

CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_novo IN def) > 0 THEN RETURN; END IF;  -- já trocado (idempotente)
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

-- a tela lê todos os tipos
SELECT pg_temp.trocar('private.regulacao_json(public.regulacao_solicitacoes)'::regprocedure,
  E'''isolamento'', s.isolamento, ''isolamento_tipo'', s.isolamento_tipo,',
  E'''isolamento'', s.isolamento, ''isolamento_tipo'', s.isolamento_tipo, ''isolamento_tipos'', to_jsonb(s.isolamento_tipos),');
SELECT pg_temp.trocar('public.regulacao_definir_isolamento(uuid, text, text, text)'::regprocedure,
  E'RETURN jsonb_build_object(''id'', s.id, ''isolamento'', s.isolamento, ''isolamento_tipo'', s.isolamento_tipo,',
  E'RETURN jsonb_build_object(''id'', s.id, ''isolamento'', s.isolamento, ''isolamento_tipo'', s.isolamento_tipo, ''isolamento_tipos'', to_jsonb(s.isolamento_tipos),');

-- a marca do paciente aceita "reverso" (soma com as outras: uma linha por tipo)
SELECT pg_temp.trocar('public.marcar_isolamento(uuid, text, text)'::regprocedure,
  E'IF p_tipo IS NULL OR p_tipo NOT IN (''contato'', ''goticula'', ''aerossol'') THEN',
  E'IF p_tipo IS NULL OR p_tipo NOT IN (''contato'', ''goticula'', ''aerossol'', ''reverso'') THEN   -- B-04: reverso soma');
SELECT pg_temp.trocar('public.marcar_isolamento(uuid, text, text)'::regprocedure,
  'Escolha o tipo de isolamento: contato, gotícula ou aerossol.',
  'Escolha o tipo de isolamento: contato, gotícula, aerossol ou reverso (protetor).');

-- ── B-03: só o médico retira, dizendo o porquê ──────────────────────────────
SELECT pg_temp.trocar('public.retirar_isolamento(uuid, text)'::regprocedure,
  E'IF NOT (coalesce(private.tenho_papel(r.unidade_id, ''plantonista''), false) OR coalesce(private.tenho_papel(r.unidade_id, ''enfermeiro''), false)) THEN',
  E'IF NOT coalesce(private.tenho_papel(r.unidade_id, ''plantonista''), false) THEN   -- B-03 (RT, 25/11/2026): só o médico retira');
SELECT pg_temp.trocar('public.retirar_isolamento(uuid, text)'::regprocedure,
  'O isolamento é retirado pelo médico ou pelo enfermeiro.',
  'O isolamento é retirado pelo médico, dizendo o porquê.');

-- ── B-03: na chegada pela rede, as marcas vêm junto ─────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_isolamento_no_destino(s public.regulacao_solicitacoes, p_paciente uuid, p_episodio uuid, p_internacao uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_tipos text[]; v_n integer; v_origem text;
BEGIN
  -- os tipos do pedido mais as marcas que a origem tinha quando o paciente saiu
  SELECT coalesce(array_agg(DISTINCT t), '{}'::text[]) INTO v_tipos FROM (
    SELECT unnest(CASE WHEN cardinality(s.isolamento_tipos) > 0 THEN s.isolamento_tipos
                       WHEN s.isolamento AND s.isolamento_tipo = 'contato_aerossol' THEN ARRAY['contato', 'aerossol']
                       WHEN s.isolamento AND s.isolamento_tipo IS NOT NULL THEN ARRAY[s.isolamento_tipo] ELSE '{}'::text[] END) AS t
    UNION
    SELECT ip.tipo FROM public.isolamentos_paciente ip
     WHERE ip.paciente_id = s.paciente_id AND ip.unidade_id = s.unidade_origem_id
       AND (ip.retirado_em IS NULL OR (ip.retirado_por IS NULL AND ip.motivo_retirada LIKE 'Encerrado com a alta%'))) x;
  IF cardinality(v_tipos) = 0 THEN RETURN 0; END IF;
  SELECT nome INTO v_origem FROM public.unidades WHERE id = s.unidade_origem_id;
  INSERT INTO public.isolamentos_paciente (unidade_id, paciente_id, episodio_id, internacao_id, tipo, motivo, marcado_por,
                                           situacao, agente, origem_unidade_id, origem_marcado_por, origem_marcado_em, regulacao_id)
  SELECT s.destino_unidade_id, p_paciente, p_episodio, p_internacao, t.tipo,
         left('Veio com o paciente pela regulação nº ' || s.numero || ' (' || coalesce(v_origem, 'origem') || ')'
              || coalesce(': ' || coalesce(o.motivo, s.isolamento_agente), ''), 500),
         private.meu_perfil_id(), s.isolamento_situacao, left(coalesce(s.isolamento_agente, o.motivo), 120),
         s.unidade_origem_id, coalesce(o.marcado_por, s.solicitante_id), coalesce(o.marcado_em, s.criada_em), s.id
    FROM unnest(v_tipos) AS t(tipo)
    LEFT JOIN LATERAL (SELECT ip.motivo, ip.marcado_por, ip.marcado_em FROM public.isolamentos_paciente ip
                        WHERE ip.paciente_id = s.paciente_id AND ip.unidade_id = s.unidade_origem_id AND ip.tipo = t.tipo
                        ORDER BY ip.marcado_em DESC LIMIT 1) o ON true
   WHERE NOT EXISTS (SELECT 1 FROM public.isolamentos_paciente x WHERE x.paciente_id = p_paciente AND x.tipo = t.tipo AND x.retirado_em IS NULL);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    PERFORM private.registrar_auditoria('isolamento_veio_com_o_paciente', 'internacoes', p_internacao, s.destino_unidade_id,
      jsonb_build_object('regulacao', s.numero, 'tipos', to_jsonb(v_tipos), 'origem', s.unidade_origem_id));
  END IF;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_isolamento_no_destino(public.regulacao_solicitacoes, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.trocar('private.regulacao_internar_chegada(public.regulacao_solicitacoes, uuid, uuid)'::regprocedure,
  E'  RETURN v_int;\nEND',
  E'  PERFORM private.regulacao_isolamento_no_destino(s, p_paciente, v_epi, v_int);   -- B-03: o isolamento segue o paciente\n'
  || E'  RETURN v_int;\nEND');

-- ── Rollback (na ordem) ─────────────────────────────────────────────────────
-- 1. Trocas inversas em private.regulacao_internar_chegada, public.retirar_isolamento,
--    public.marcar_isolamento, public.regulacao_definir_isolamento e private.regulacao_json.
-- 2. DROP FUNCTION IF EXISTS private.regulacao_isolamento_no_destino(public.regulacao_solicitacoes, uuid, uuid, uuid);
-- 3. private.regulacao_leva_isolamento como em 20270425000020 e o gatilho só BEFORE INSERT.
-- 4. Contract, só quando nenhuma versão do app ler as colunas e sem marca "reverso" ativa:
--    ALTER TABLE public.isolamentos_paciente DROP CONSTRAINT isolamentos_paciente_tipo_check,
--      ADD CONSTRAINT isolamentos_paciente_tipo_check CHECK (tipo IN ('contato', 'goticula', 'aerossol'));
--    ALTER TABLE public.isolamentos_paciente DROP COLUMN regulacao_id, DROP COLUMN origem_marcado_em,
--      DROP COLUMN origem_marcado_por, DROP COLUMN origem_unidade_id, DROP COLUMN agente, DROP COLUMN situacao;
--    ALTER TABLE public.regulacao_solicitacoes DROP COLUMN isolamento_tipos;
