-- Ponto 11 do plantonista (docs/plantonista/PONTO-11-PRESCRICAO.md, aprovado
-- pelo RT em 28/10/2026): a busca de medicamento passa para o servidor, com
-- sinônimos, várias palavras em qualquer ordem, apresentação e ordem por
-- relevância; e a tela pergunta o que falta para prescrever (peso, idade) antes
-- do item, em vez de descobrir pela recusa.
--
-- Expand: só cria. A tabela de sinônimos nasce vazia; a carga entra em
-- migration própria depois de o RT aprovar a lista
-- (docs/plantonista/PONTO-11-SINONIMOS.md).
--
-- Rollback (testado na homologação):
--   DROP FUNCTION IF EXISTS public.o_que_falta_para_prescrever(uuid);
--   DROP FUNCTION IF EXISTS public.buscar_medicamento(uuid, text);
--   DROP FUNCTION IF EXISTS private.norm_concentracao(text);
--   DROP TABLE IF EXISTS public.medicamento_sinonimo;

-- ── sinônimos ───────────────────────────────────────────────────────────────
-- Valem para o princípio ativo inteiro; com `concentracao`, só para aquela
-- concentração ("SF" é o cloreto de sódio 0,9 %, nunca a ampola a 20 %).
CREATE TABLE IF NOT EXISTS public.medicamento_sinonimo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principio_ativo_norm text NOT NULL,
  concentracao text,
  termo text NOT NULL,
  termo_norm text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('sigla', 'sinonimo', 'comercial')),
  fonte text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medicamento_sinonimo_unico UNIQUE NULLS NOT DISTINCT (principio_ativo_norm, concentracao, termo_norm)
);
CREATE INDEX IF NOT EXISTS medicamento_sinonimo_principio ON public.medicamento_sinonimo (principio_ativo_norm);
ALTER TABLE public.medicamento_sinonimo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS medicamento_sinonimo_select ON public.medicamento_sinonimo;
CREATE POLICY medicamento_sinonimo_select ON public.medicamento_sinonimo FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.medicamento_sinonimo FROM PUBLIC, anon, authenticated;

-- "0,9 %" e "0,9%" são a mesma concentração
CREATE OR REPLACE FUNCTION private.norm_concentracao(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(lower(regexp_replace(coalesce(t, ''), '\s+', '', 'g')), '')
$$;
REVOKE ALL ON FUNCTION private.norm_concentracao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.norm_concentracao(text) TO authenticated;

-- ── busca ───────────────────────────────────────────────────────────────────
-- Cada palavra digitada precisa estar no princípio ativo, na apresentação, na
-- concentração ou num sinônimo que vale para o item. Ordem: o princípio ativo
-- começa com a primeira palavra; depois, um sinônimo começa com ela; depois o
-- resto. `casou_por` é o sinônimo que achou o item, para a tela mostrar
-- "AAS = Ácido acetilsalicílico" sem trocar o nome do cadastro.
-- SECURITY INVOKER: vale a RLS de medicamento; o filtro da unidade é o mesmo
-- de src/lib/medicamentoCadastro.ts (filtroDaUnidade).
CREATE OR REPLACE FUNCTION public.buscar_medicamento(p_unidade uuid, p_termo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_norm text := private.norm_medicamento(left(p_termo, 120));
  v_palavras text[];
BEGIN
  IF length(coalesce(v_norm, '')) < 2 THEN RETURN '[]'::jsonb; END IF;
  v_palavras := string_to_array(v_norm, ' ');
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', x.id, 'principio_ativo', x.principio_ativo, 'apresentacao', x.apresentacao,
             'concentracao', x.concentracao, 'alta_vigilancia', x.alta_vigilancia, 'casou_por', x.casou_por)
             ORDER BY x.ordem, x.principio_ativo, x.apresentacao)
      FROM (
        SELECT m.id, m.principio_ativo, m.apresentacao, m.concentracao, m.alta_vigilancia,
               (SELECT s.termo FROM unnest(sin.termos, sin.normas) AS s(termo, norma)
                 WHERE EXISTS (SELECT 1 FROM unnest(v_palavras) p
                                WHERE length(p) >= 2 AND p !~ '^[0-9]+$'
                                  AND s.norma LIKE '%' || p || '%' AND m.principio_ativo_norm NOT LIKE '%' || p || '%')
                 ORDER BY length(s.termo) LIMIT 1) AS casou_por,
               CASE WHEN m.principio_ativo_norm LIKE v_palavras[1] || '%' THEN 0
                    WHEN EXISTS (SELECT 1 FROM unnest(sin.normas) n WHERE n LIKE v_palavras[1] || '%') THEN 1
                    ELSE 2 END AS ordem
          FROM public.medicamento m
          CROSS JOIN LATERAL (
            SELECT coalesce(array_agg(s.termo), '{}') AS termos, coalesce(array_agg(s.termo_norm), '{}') AS normas
              FROM public.medicamento_sinonimo s
             WHERE s.principio_ativo_norm = m.principio_ativo_norm
               AND (s.concentracao IS NULL
                    OR private.norm_concentracao(s.concentracao) = private.norm_concentracao(m.concentracao))) sin
         WHERE m.ativo
           AND (m.unidades_locais IS NULL OR (p_unidade IS NOT NULL AND p_unidade = ANY (m.unidades_locais)))
           AND NOT EXISTS (
             SELECT 1 FROM unnest(v_palavras) p
              WHERE (m.principio_ativo_norm || ' ' || coalesce(private.norm_medicamento(m.apresentacao), '') || ' '
                     || coalesce(private.norm_medicamento(m.concentracao), '') || ' ' || array_to_string(sin.normas, ' '))
                    NOT LIKE '%' || p || '%')
         ORDER BY ordem, m.principio_ativo, m.apresentacao
         LIMIT 20) x), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.buscar_medicamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_medicamento(uuid, text) TO authenticated;

-- ── o que falta para prescrever ─────────────────────────────────────────────
-- Mesma regra da trava (private.falta_para_prescrever, migration
-- 20261121000001): data de nascimento (ou idade estimada) e peso deste
-- atendimento. Também devolve o último peso de antes do atendimento, para a
-- tela dizer "peso de outro atendimento" em vez de mostrá-lo como válido.
-- Quem pode ver a prescrição do paciente (mesma regra de prescricao_vigente).
CREATE OR REPLACE FUNCTION public.o_que_falta_para_prescrever(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_inicio timestamptz;
  v_atual jsonb;
  v_anterior jsonb;
  v_falta text[] := '{}';
BEGIN
  IF NOT (private.paciente_no_meu_plantao(p_paciente)
          OR private.papel_na_unidade((SELECT unidade_id FROM public.pacientes WHERE pacientes.id = p_paciente)) = 'gestor'
          OR private.sou_farmaceutico()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  v_inicio := private.inicio_do_atendimento(p_paciente);
  SELECT jsonb_build_object('valor', o.valor_num, 'metodo', o.metodo, 'em', o.aferido_em) INTO v_atual
    FROM public.observacao o
    JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'peso' AND c.unidade_id IS NULL
   WHERE o.paciente_id = p_paciente AND o.aferido_em >= v_inicio AND o.valor_num > 0
   ORDER BY o.aferido_em DESC LIMIT 1;
  IF v_atual IS NULL THEN
    SELECT jsonb_build_object('valor', o.valor_num, 'metodo', o.metodo, 'em', o.aferido_em) INTO v_anterior
      FROM public.observacao o
      JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'peso' AND c.unidade_id IS NULL
     WHERE o.paciente_id = p_paciente AND o.aferido_em < v_inicio AND o.valor_num > 0
     ORDER BY o.aferido_em DESC LIMIT 1;
  END IF;
  IF (SELECT data_nascimento FROM public.pacientes WHERE id = p_paciente) IS NULL THEN v_falta := v_falta || 'idade'::text; END IF;
  IF private.peso_do_atendimento(p_paciente) IS NULL THEN v_falta := v_falta || 'peso'::text; END IF;
  RETURN jsonb_build_object('falta', to_jsonb(v_falta), 'peso', v_atual, 'peso_anterior', v_anterior);
END $$;
REVOKE ALL ON FUNCTION public.o_que_falta_para_prescrever(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.o_que_falta_para_prescrever(uuid) TO authenticated;
