-- ════════════════════════════════════════════════════════════════════════════
-- Pendências da 5B, L4: materiais (decisão do RT em 05/11/2026, "Sim, todas
-- A"; diagnóstico em docs/faturamento/PENDENCIAS-5B-DIAGNOSTICO.md).
--
-- Decisão L4 = A: cadastro simples da unidade (nome, unidade de consumo e
-- código SIGTAP do grupo 07, opcional) e lançamento à mão na conta pelo
-- faturamento, sem valor e sem estoque, como os medicamentos da 5B-3.
--
-- 1. materiais_unidade: o cadastro da unidade. Cadastra o faturamento ou o
--    gestor; desativar tira da lista de lançamento sem apagar o histórico.
-- 2. conta_materiais: o lançamento na conta (quantidade e observação), com a
--    retirada com motivo, enquanto a conta está aberta ou em conferência.
-- 3. A conta mostra os materiais (conta_detalhe) e os congela no fechamento
--    (contas.materiais_congelados), como os medicamentos.
-- 4. Pré-auditoria: material sem código SIGTAP só avisa; nunca bloqueia.
--
-- As funções já em produção (conta_detalhe, mudar_etapa_conta e
-- conta_pendencias) mudam por troca de trecho na definição viva: se o trecho
-- não existir, a migration para. Idempotente. Expand: nada sai.
-- Teste: supabase/tests/5b_materiais.sql
--
-- Rollback (na ordem):
--   reaplicar o CREATE OR REPLACE de public.conta_detalhe, public.mudar_etapa_conta
--     e private.conta_pendencias tirado da produção antes desta migration
--     (pg_get_functiondef), sem os trechos dos materiais;
--   DROP FUNCTION IF EXISTS public.materiais_da_unidade(uuid),
--     public.material_salvar(uuid, uuid, text, text, text, boolean),
--     public.conta_lancar_material(uuid, uuid, numeric, text),
--     public.conta_retirar_material(uuid, text), private.conta_materiais(public.contas);
--   ALTER TABLE public.contas DROP COLUMN IF EXISTS materiais_congelados;
--   DROP TABLE IF EXISTS public.conta_materiais, public.materiais_unidade;
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.materiais_unidade (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id),
  nome             text NOT NULL CHECK (length(btrim(nome)) BETWEEN 3 AND 120),
  unidade_consumo  text NOT NULL CHECK (length(btrim(unidade_consumo)) BETWEEN 1 AND 20),
  procedimento     text CHECK (procedimento IS NULL OR procedimento ~ '^07[0-9]{8}$'),
  ativo            boolean NOT NULL DEFAULT true,
  criado_por       uuid NOT NULL REFERENCES public.perfis(id),
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_por   uuid REFERENCES public.perfis(id),
  atualizado_em    timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_materiais_unidade_nome ON public.materiais_unidade (unidade_id, lower(btrim(nome))) WHERE ativo;

CREATE TABLE IF NOT EXISTS public.conta_materiais (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id         uuid NOT NULL REFERENCES public.contas(id),
  material_id      uuid NOT NULL REFERENCES public.materiais_unidade(id),
  quantidade       numeric(10, 2) NOT NULL CHECK (quantidade > 0),
  observacao       text CHECK (observacao IS NULL OR length(observacao) <= 300),
  lancado_por      uuid NOT NULL REFERENCES public.perfis(id),
  lancado_em       timestamptz NOT NULL DEFAULT now(),
  retirado_por     uuid REFERENCES public.perfis(id),
  retirado_em      timestamptz,
  motivo_retirada  text,
  CHECK ((retirado_em IS NULL) = (motivo_retirada IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_conta_materiais_conta ON public.conta_materiais (conta_id);

ALTER TABLE public.materiais_unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_materiais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.materiais_unidade, public.conta_materiais FROM anon, authenticated;
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.conta_materiais;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.conta_materiais FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();
COMMENT ON TABLE public.materiais_unidade IS 'Materiais da unidade (5B, L4): cadastro simples, sem valor e sem estoque. Acesso só por RPC.';
COMMENT ON TABLE public.conta_materiais IS 'Material lançado à mão na conta pelo faturamento (5B, L4), sem valor. Acesso só por RPC.';

ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS materiais_congelados jsonb;

-- ── os materiais da conta ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.conta_materiais(c public.contas)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'material_id', m.id, 'material', m.nome, 'unidade_consumo', m.unidade_consumo,
           'procedimento', m.procedimento, 'procedimento_nome', s.nome,
           'quantidade', l.quantidade, 'observacao', l.observacao,
           'lancado_por', (SELECT nome_completo FROM public.perfis WHERE id = l.lancado_por), 'lancado_em', l.lancado_em,
           'retirado_em', l.retirado_em, 'motivo_retirada', l.motivo_retirada,
           'retirado_por', (SELECT nome_completo FROM public.perfis WHERE id = l.retirado_por))
         ORDER BY l.lancado_em), '[]'::jsonb)
    FROM public.conta_materiais l
    JOIN public.materiais_unidade m ON m.id = l.material_id
    LEFT JOIN terminologia.sigtap_procedimento s ON s.codigo = m.procedimento
   WHERE l.conta_id = c.id
$$;
REVOKE ALL ON FUNCTION private.conta_materiais(public.contas) FROM PUBLIC, anon, authenticated;

-- ── cadastro da unidade ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.materiais_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF NOT private.pode_ver_contas(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os materiais são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', m.id, 'nome', m.nome, 'unidade_consumo', m.unidade_consumo, 'procedimento', m.procedimento,
      'procedimento_nome', s.nome, 'ativo', m.ativo,
      'lancamentos', (SELECT count(*) FROM public.conta_materiais l WHERE l.material_id = m.id AND l.retirado_em IS NULL))
      ORDER BY m.ativo DESC, lower(m.nome))
    FROM public.materiais_unidade m LEFT JOIN terminologia.sigtap_procedimento s ON s.codigo = m.procedimento
   WHERE m.unidade_id = p_unidade), '[]'::jsonb);
END $$;

-- cria (p_id nulo) ou altera; desativar tira da lista de lançamento
CREATE OR REPLACE FUNCTION public.material_salvar(p_unidade uuid, p_id uuid, p_nome text, p_unidade_consumo text,
  p_procedimento text DEFAULT NULL, p_ativo boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_nome text := btrim(coalesce(p_nome, ''));
  v_uc text := btrim(coalesce(p_unidade_consumo, ''));
  v_proc text := nullif(regexp_replace(coalesce(p_procedimento, ''), '\D', '', 'g'), '');
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF NOT private.pode_ver_contas(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os materiais são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(v_nome) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nome do material: de 3 a 120 letras.'; END IF;
  IF length(v_uc) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Informe a unidade de consumo (ex.: unidade, par, metro).'; END IF;
  IF v_proc IS NOT NULL THEN
    IF v_proc !~ '^07[0-9]{8}$' THEN RAISE EXCEPTION 'O código SIGTAP de material é do grupo 07 (10 dígitos).'; END IF;
    IF NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = v_proc) THEN
      RAISE EXCEPTION 'Código % não está no SIGTAP carregado.', v_proc;
    END IF;
  END IF;
  IF coalesce(p_ativo, true) AND EXISTS (SELECT 1 FROM public.materiais_unidade
       WHERE unidade_id = p_unidade AND ativo AND lower(btrim(nome)) = lower(v_nome) AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Já existe um material ativo com esse nome.';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.materiais_unidade (unidade_id, nome, unidade_consumo, procedimento, ativo, criado_por)
    VALUES (p_unidade, v_nome, v_uc, v_proc, coalesce(p_ativo, true), v_eu)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.materiais_unidade
       SET nome = v_nome, unidade_consumo = v_uc, procedimento = v_proc, ativo = coalesce(p_ativo, true),
           atualizado_por = v_eu, atualizado_em = now()
     WHERE id = p_id AND unidade_id = p_unidade
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Material não encontrado nesta unidade.'; END IF;
  END IF;
  PERFORM private.registrar_auditoria(CASE WHEN p_id IS NULL THEN 'material_criado' ELSE 'material_alterado' END,
    'materiais_unidade', v_id, p_unidade, jsonb_build_object('ativo', coalesce(p_ativo, true)));
  RETURN v_id;
END $$;

-- ── lançamento na conta (faturamento, conta aberta ou em conferência) ───────
CREATE OR REPLACE FUNCTION public.conta_lancar_material(p_conta uuid, p_material uuid, p_quantidade numeric, p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; m public.materiais_unidade; v_eu uuid := private.meu_perfil_id(); v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO c FROM public.contas WHERE id = p_conta FOR UPDATE;
  IF c.id IS NULL OR NOT (private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento')) THEN
    RAISE EXCEPTION 'Acesso negado: o lançamento na conta é do faturamento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status NOT IN ('aberta', 'em_conferencia') THEN RAISE EXCEPTION 'Conta fechada: o gestor reabre antes de ajustar.'; END IF;
  SELECT * INTO m FROM public.materiais_unidade WHERE id = p_material;
  IF m.id IS NULL OR m.unidade_id <> c.unidade_id OR NOT m.ativo THEN RAISE EXCEPTION 'Material não está ativo nesta unidade.'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 OR p_quantidade > 99999999 OR p_quantidade <> round(p_quantidade, 2) THEN
    RAISE EXCEPTION 'Quantidade maior que zero, com até 2 casas decimais.';
  END IF;
  IF length(coalesce(v_obs, '')) > 300 THEN RAISE EXCEPTION 'Observação de até 300 letras.'; END IF;
  INSERT INTO public.conta_materiais (conta_id, material_id, quantidade, observacao, lancado_por)
  VALUES (c.id, m.id, p_quantidade, v_obs, v_eu);
  INSERT INTO public.conta_eventos (conta_id, evento, de, motivo, por)
  VALUES (c.id, 'material_lancado', m.nome, p_quantidade::text || ' ' || m.unidade_consumo, v_eu);
  PERFORM private.registrar_auditoria('conta_material_lancado', 'contas', c.id, c.unidade_id,
    jsonb_build_object('numero', c.numero, 'quantidade', p_quantidade));
  RETURN public.conta_detalhe(c.id);
END $$;

CREATE OR REPLACE FUNCTION public.conta_retirar_material(p_lancamento uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE l public.conta_materiais; c public.contas; v_eu uuid := private.meu_perfil_id(); v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO l FROM public.conta_materiais WHERE id = p_lancamento FOR UPDATE;
  SELECT * INTO c FROM public.contas WHERE id = l.conta_id FOR UPDATE;
  IF c.id IS NULL OR NOT (private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento')) THEN
    RAISE EXCEPTION 'Acesso negado: o ajuste da conta é do faturamento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status NOT IN ('aberta', 'em_conferencia') THEN RAISE EXCEPTION 'Conta fechada: o gestor reabre antes de ajustar.'; END IF;
  IF l.retirado_em IS NOT NULL THEN RAISE EXCEPTION 'Este material já foi retirado da conta.'; END IF;
  IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.conta_materiais SET retirado_em = now(), retirado_por = v_eu, motivo_retirada = v_motivo WHERE id = l.id;
  INSERT INTO public.conta_eventos (conta_id, evento, de, motivo, por)
  VALUES (c.id, 'material_retirado', (SELECT nome FROM public.materiais_unidade WHERE id = l.material_id), v_motivo, v_eu);
  PERFORM private.registrar_auditoria('conta_material_retirado', 'contas', c.id, c.unidade_id,
    jsonb_build_object('numero', c.numero, 'motivo', v_motivo));
  RETURN public.conta_detalhe(c.id);
END $$;

REVOKE ALL ON FUNCTION public.materiais_da_unidade(uuid), public.material_salvar(uuid, uuid, text, text, text, boolean),
  public.conta_lancar_material(uuid, uuid, numeric, text), public.conta_retirar_material(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materiais_da_unidade(uuid), public.material_salvar(uuid, uuid, text, text, text, boolean),
  public.conta_lancar_material(uuid, uuid, numeric, text), public.conta_retirar_material(uuid, text) TO authenticated;

-- ── a conta mostra, congela e avisa (troca de trecho na definição viva) ─────
CREATE OR REPLACE FUNCTION pg_temp.mat_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(p_pares[k + 1] IN novo) > 0;  -- já aplicada
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

SELECT pg_temp.mat_trocar('public.conta_detalhe(uuid)'::regprocedure,
  '    ''documentos_sus'', v_docs,',
  '    ''documentos_sus'', v_docs,
    -- pendências da 5B, L4: materiais lançados à mão, sem valor
    ''materiais'', coalesce(c.materiais_congelados, private.conta_materiais(c)),');

SELECT pg_temp.mat_trocar('public.mudar_etapa_conta(uuid, text, text)'::regprocedure,
  '         medicamentos_congelados = CASE WHEN p_para = ''fechada'' THEN private.conta_medicamentos(c) WHEN p_para = ''aberta'' THEN NULL ELSE medicamentos_congelados END,',
  '         medicamentos_congelados = CASE WHEN p_para = ''fechada'' THEN private.conta_medicamentos(c) WHEN p_para = ''aberta'' THEN NULL ELSE medicamentos_congelados END,
         materiais_congelados = CASE WHEN p_para = ''fechada'' THEN private.conta_materiais(c) WHEN p_para = ''aberta'' THEN NULL ELSE materiais_congelados END,');

SELECT pg_temp.mat_trocar('private.conta_pendencias(public.contas, jsonb, jsonb, jsonb)'::regprocedure,
  '    UNION ALL
    -- medicamentos: só aviso',
  '    UNION ALL
    -- pendências da 5B, L4: material sem código SIGTAP só avisa
    SELECT ''material'', ''material_sem_sigtap'', (x ->> ''material'') || '': sem código SIGTAP no cadastro de materiais.'', false
      FROM jsonb_array_elements(private.conta_materiais(c)) x
     WHERE x ->> ''retirado_em'' IS NULL AND x ->> ''procedimento'' IS NULL
    UNION ALL
    -- medicamentos: só aviso');
