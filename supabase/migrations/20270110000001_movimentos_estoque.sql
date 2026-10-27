-- Telas do farmacêutico, ponto 5 (pedido do RT em 27/10/2026, aprovado no mesmo
-- dia; docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md): "na dispensação avulsa,
-- como fica o controle do que sai e do que entra no estoque?". A saída já baixa
-- o saldo; a entrada não existia como movimento: o saldo era sobrescrito na
-- Disponibilidade, sem motivo, sem histórico e sem auditoria.
-- Decisão do RT em 27/10/2026: lote e validade ficam para depois (item próprio).
--
-- Como fica:
--   • public.movimentos_estoque, só de inserção: cada mudança de saldo, com o
--     tipo (saldo inicial, entrada, saída por prescrição, saída avulsa,
--     devolução, ajuste de inventário), a quantidade com sinal, o saldo depois,
--     o documento, o motivo, a dispensação e quem fez.
--   • Quem escreve o livro é um gatilho no próprio saldo (estoque_medicamento):
--     nenhuma mudança escapa. O tipo vem do contexto da transação
--     (estoque.movimento), marcado pelos gatilhos da dispensação e da devolução
--     e pelas funções novas; sem contexto, é ajuste "sem motivo" (a tela antiga).
--     A dispensação e a devolução não mudam de corpo.
--   • registrar_entrada_estoque: entrada com documento (nota ou requisição).
--   • ajustar_estoque: o novo saldo contado, com motivo (ajuste de inventário).
--   • extrato_estoque: os movimentos do item, do mais novo para o mais antigo.
--   • Saldo inicial: uma linha por item que já tem saldo, para o extrato fechar.
--
-- ROLLBACK: DROP dos gatilhos trg_estoque_movimento, trg_dispensacao_movimento,
--   trg_devolucao_movimento e das funções novas. A tabela fica (só inserção,
--   trilha); sai só numa janela declarada (contract).

CREATE TABLE IF NOT EXISTS public.movimentos_estoque (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  medicamento_id  uuid NOT NULL REFERENCES public.medicamento(id),
  tipo            text NOT NULL CHECK (tipo IN ('saldo_inicial', 'entrada', 'saida_prescricao', 'saida_avulsa', 'devolucao', 'ajuste_inventario')),
  quantidade      numeric NOT NULL,
  saldo_depois    numeric NOT NULL,
  documento       text,
  motivo          text,
  dispensacao_id  uuid REFERENCES public.dispensacoes(id),
  por             uuid REFERENCES public.perfis(id),
  em              timestamptz NOT NULL DEFAULT clock_timestamp()   -- a hora de cada movimento, mesmo dentro da mesma transação
);
CREATE INDEX IF NOT EXISTS movimentos_estoque_item ON public.movimentos_estoque (unidade_id, medicamento_id, em DESC);
CREATE INDEX IF NOT EXISTS movimentos_estoque_dispensacao ON public.movimentos_estoque (dispensacao_id) WHERE dispensacao_id IS NOT NULL;
ALTER TABLE public.movimentos_estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS movimentos_estoque_leitura ON public.movimentos_estoque;
CREATE POLICY movimentos_estoque_leitura ON public.movimentos_estoque FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.farmaceutico_da(unidade_id) OR private.gestor_da_unidade(unidade_id));
REVOKE ALL ON public.movimentos_estoque FROM anon, authenticated;
GRANT SELECT ON public.movimentos_estoque TO authenticated;
DROP TRIGGER IF EXISTS trg_movimentos_estoque_so_insercao ON public.movimentos_estoque;
CREATE TRIGGER trg_movimentos_estoque_so_insercao BEFORE UPDATE OR DELETE ON public.movimentos_estoque
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
COMMENT ON TABLE public.movimentos_estoque IS 'Livro do estoque da farmácia (ponto 5, 27/10/2026): cada mudança de saldo, só de inserção. Escrito pelo gatilho de estoque_medicamento.';

-- saldo inicial: o que já existe, para o extrato fechar com o saldo
INSERT INTO public.movimentos_estoque (unidade_id, medicamento_id, tipo, quantidade, saldo_depois, motivo, por, em)
SELECT e.unidade_id, e.medicamento_id, 'saldo_inicial', e.quantidade, e.quantidade, 'saldo antes do livro do estoque', e.atualizado_por, now()
  FROM public.estoque_medicamento e
 WHERE NOT EXISTS (SELECT 1 FROM public.movimentos_estoque x WHERE x.unidade_id = e.unidade_id AND x.medicamento_id = e.medicamento_id);

-- ── contexto do próximo movimento (vale na transação, uma vez) ──────────────
CREATE OR REPLACE FUNCTION private.marcar_movimento(p_contexto jsonb) RETURNS void
LANGUAGE sql SET search_path = '' AS $$
  SELECT set_config('estoque.movimento', p_contexto::text, true)
$$;
REVOKE ALL ON FUNCTION private.marcar_movimento(jsonb) FROM PUBLIC, anon, authenticated;

-- o livro: cada mudança de quantidade vira uma linha
CREATE OR REPLACE FUNCTION private.trg_estoque_movimento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_delta numeric := NEW.quantidade - coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.quantidade END, 0);
  v_ctx jsonb := nullif(current_setting('estoque.movimento', true), '')::jsonb;
BEGIN
  IF v_delta = 0 THEN RETURN NEW; END IF;
  INSERT INTO public.movimentos_estoque (unidade_id, medicamento_id, tipo, quantidade, saldo_depois, documento, motivo, dispensacao_id, por)
  VALUES (NEW.unidade_id, NEW.medicamento_id, coalesce(v_ctx ->> 'tipo', 'ajuste_inventario'), v_delta, NEW.quantidade,
          v_ctx ->> 'documento', CASE WHEN v_ctx IS NULL THEN 'saldo informado sem motivo' ELSE v_ctx ->> 'motivo' END,
          (v_ctx ->> 'dispensacao_id')::uuid, coalesce(private.meu_perfil_id(), NEW.atualizado_por));
  PERFORM set_config('estoque.movimento', '', true);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_estoque_movimento ON public.estoque_medicamento;
CREATE TRIGGER trg_estoque_movimento AFTER INSERT OR UPDATE OF quantidade ON public.estoque_medicamento
  FOR EACH ROW EXECUTE FUNCTION private.trg_estoque_movimento();

-- a dispensação e a devolução marcam o movimento que vem logo depois (mover_estoque)
CREATE OR REPLACE FUNCTION private.trg_dispensacao_movimento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.marcar_movimento(jsonb_build_object(
    'tipo', CASE NEW.tipo WHEN 'avulsa' THEN 'saida_avulsa' ELSE 'saida_prescricao' END,
    'dispensacao_id', NEW.id,
    'motivo', CASE WHEN NEW.tipo = 'avulsa' THEN concat_ws(' · ', NEW.destino, NEW.motivo)
                   WHEN NEW.sem_farmaceutico THEN 'retirada sem farmacêutico' END));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dispensacao_movimento ON public.dispensacoes;
CREATE TRIGGER trg_dispensacao_movimento AFTER INSERT ON public.dispensacoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_dispensacao_movimento();

CREATE OR REPLACE FUNCTION private.trg_devolucao_movimento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.marcar_movimento(jsonb_build_object('tipo', 'devolucao', 'dispensacao_id', NEW.dispensacao_id, 'motivo', NEW.motivo));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_devolucao_movimento ON public.dispensacao_devolucoes;
CREATE TRIGGER trg_devolucao_movimento AFTER INSERT ON public.dispensacao_devolucoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_devolucao_movimento();
REVOKE ALL ON FUNCTION private.trg_estoque_movimento(), private.trg_dispensacao_movimento(), private.trg_devolucao_movimento()
  FROM PUBLIC, anon, authenticated;

-- ── entrada (compra, transferência, reposição) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_entrada_estoque(p_unidade uuid, p_medicamento uuid, p_quantidade numeric,
  p_documento text, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_saldo numeric; v_doc text := nullif(btrim(coalesce(p_documento, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.farmaceutico_da(p_unidade) THEN RAISE EXCEPTION 'A entrada no estoque é do farmacêutico da unidade.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.medicamento WHERE id = p_medicamento) THEN RAISE EXCEPTION 'Medicamento não encontrado.'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'A quantidade da entrada é maior que zero.'; END IF;
  IF length(coalesce(v_doc, '')) < 3 THEN RAISE EXCEPTION 'Informe o documento da entrada (nota fiscal, requisição ou transferência).'; END IF;
  PERFORM private.marcar_movimento(jsonb_build_object('tipo', 'entrada', 'documento', v_doc, 'motivo', nullif(btrim(coalesce(p_motivo, '')), '')));
  v_saldo := private.mover_estoque(p_unidade, p_medicamento, p_quantidade);
  PERFORM private.registrar_auditoria('entrada_estoque', 'medicamento', p_medicamento, p_unidade,
    jsonb_build_object('quantidade', p_quantidade, 'saldo', v_saldo));
  RETURN jsonb_build_object('saldo', v_saldo);
END $$;

-- ── ajuste de inventário: o saldo contado, com motivo ──────────────────────
CREATE OR REPLACE FUNCTION public.ajustar_estoque(p_unidade uuid, p_medicamento uuid, p_quantidade numeric, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atual numeric;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.farmaceutico_da(p_unidade) THEN RAISE EXCEPTION 'O ajuste do estoque é do farmacêutico da unidade.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.medicamento WHERE id = p_medicamento) THEN RAISE EXCEPTION 'Medicamento não encontrado.'; END IF;
  IF p_quantidade IS NULL OR p_quantidade < 0 THEN RAISE EXCEPTION 'Informe o saldo contado (zero ou mais).'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo do ajuste (mínimo de 10 letras).'; END IF;
  SELECT quantidade INTO v_atual FROM public.estoque_medicamento WHERE unidade_id = p_unidade AND medicamento_id = p_medicamento FOR UPDATE;
  IF v_atual = p_quantidade THEN RAISE EXCEPTION 'O saldo contado é igual ao saldo atual: nada a ajustar.'; END IF;
  PERFORM private.marcar_movimento(jsonb_build_object('tipo', 'ajuste_inventario', 'motivo', btrim(p_motivo)));
  INSERT INTO public.estoque_medicamento (unidade_id, medicamento_id, quantidade, atualizado_por)
  VALUES (p_unidade, p_medicamento, p_quantidade, private.meu_perfil_id())
  ON CONFLICT (unidade_id, medicamento_id) DO UPDATE SET quantidade = EXCLUDED.quantidade,
    atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now();
  PERFORM private.registrar_auditoria('ajuste_estoque', 'medicamento', p_medicamento, p_unidade,
    jsonb_build_object('quantidade', p_quantidade - coalesce(v_atual, 0), 'saldo', p_quantidade));
  RETURN jsonb_build_object('saldo', p_quantidade, 'anterior', v_atual);
END $$;

-- ── extrato do item ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.extrato_estoque(p_unidade uuid, p_medicamento uuid, p_dias integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.farmaceutico_da(p_unidade) OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: o extrato do estoque é da farmácia e do gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', x.id, 'em', x.em, 'tipo', x.tipo, 'quantidade', x.quantidade, 'saldo_depois', x.saldo_depois,
             'documento', x.documento, 'motivo', x.motivo, 'por', p.nome_completo,
             'paciente', (SELECT pa.nome FROM public.dispensacoes d JOIN public.pacientes pa ON pa.id = d.paciente_id WHERE d.id = x.dispensacao_id))
             ORDER BY x.em DESC, x.id)
      FROM (SELECT * FROM public.movimentos_estoque m
             WHERE m.unidade_id = p_unidade AND m.medicamento_id = p_medicamento
               AND m.em > now() - make_interval(days => least(greatest(coalesce(p_dias, 90), 1), 3650))
             ORDER BY m.em DESC LIMIT 300) x
      LEFT JOIN public.perfis p ON p.id = x.por), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.registrar_entrada_estoque(uuid, uuid, numeric, text, text), public.ajustar_estoque(uuid, uuid, numeric, text),
  public.extrato_estoque(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_estoque(uuid, uuid, numeric, text, text), public.ajustar_estoque(uuid, uuid, numeric, text),
  public.extrato_estoque(uuid, uuid, integer) TO authenticated;
