-- Fase 5B, tarefa 3, etapa 3.2: dispensação da farmácia, com baixa do estoque.
-- Decisões do RT em 17/10/2026 ("1b 2b 3b 4a 5a 6a"):
--
--  1b. Dispensa a partir dos itens de medicamento da prescrição vigente e,
--      avulso, sem prescrição (ex.: reposição do carrinho de emergência), com
--      motivo e destino — só o farmacêutico.
--  2b. Dispensa o farmacêutico; com a farmácia fechada, a enfermagem que cuida
--      do paciente retira com a marca "sem farmacêutico" e justificativa, e o
--      farmacêutico confere depois (mesmo modelo da alta vigilância).
--  3b. O sistema SUGERE a quantidade (vezes nas próximas 24 h × unidades por
--      vez); quem define é quem dispensa. A sugestão nunca muda a dose: só
--      conta embalagens, e quando não dá para contar com segurança diz por quê.
--  4a. Devolução do que não foi usado, com motivo; volta ao estoque.
--  5a. Estoque insuficiente não bloqueia: o saldo fica negativo e a farmácia
--      é avisada para conferir (sai a regra de saldo >= 0).
--  6a. Dispensar pelo farmacêutico já valida o item ("confere").
--
-- A conta (etapa 3.3) lê a dispensação e confere com a administração.

-- 5a. saldo pode ficar negativo (o estoque é ajustado à mão e pode estar defasado)
ALTER TABLE public.estoque_medicamento DROP CONSTRAINT IF EXISTS estoque_medicamento_quantidade_check;

CREATE TABLE public.dispensacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id      uuid REFERENCES public.pacientes(id),
  item_id          uuid REFERENCES public.prescricao_itens(id),
  medicamento_id   uuid NOT NULL REFERENCES public.medicamento(id),
  quantidade       integer NOT NULL CHECK (quantidade BETWEEN 1 AND 9999),
  unidade_consumo  text,
  tipo             text NOT NULL CHECK (tipo IN ('prescricao', 'avulsa')),
  destino          text,
  motivo           text,
  sem_farmaceutico boolean NOT NULL DEFAULT false,
  sugestao         jsonb,
  dispensada_por   uuid NOT NULL REFERENCES public.perfis(id),
  dispensada_em    timestamptz NOT NULL DEFAULT now(),
  conferida_por    uuid REFERENCES public.perfis(id),
  conferida_em     timestamptz,
  CONSTRAINT dispensacoes_origem CHECK ((tipo = 'prescricao' AND item_id IS NOT NULL AND paciente_id IS NOT NULL)
                                     OR (tipo = 'avulsa' AND item_id IS NULL AND length(btrim(coalesce(destino, ''))) >= 3))
);
CREATE INDEX dispensacoes_unidade_em ON public.dispensacoes (unidade_id, dispensada_em DESC);
CREATE INDEX dispensacoes_item ON public.dispensacoes (item_id) WHERE item_id IS NOT NULL;
CREATE INDEX dispensacoes_paciente ON public.dispensacoes (paciente_id, dispensada_em DESC) WHERE paciente_id IS NOT NULL;
CREATE INDEX dispensacoes_a_conferir ON public.dispensacoes (unidade_id) WHERE sem_farmaceutico AND conferida_em IS NULL;

CREATE TABLE public.dispensacao_devolucoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensacao_id uuid NOT NULL REFERENCES public.dispensacoes(id),
  quantidade     integer NOT NULL CHECK (quantidade >= 1),
  motivo         text NOT NULL,
  por            uuid NOT NULL REFERENCES public.perfis(id),
  em             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispensacao_devolucoes_disp ON public.dispensacao_devolucoes (dispensacao_id);

ALTER TABLE public.dispensacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensacao_devolucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY dispensacoes_leitura ON public.dispensacoes FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.farmaceutico_da(unidade_id) OR private.gestor_da_unidade(unidade_id)
         OR private.tenho_papel(unidade_id, 'faturamento')
         OR (paciente_id IS NOT NULL AND private.pode_atuar_no_paciente(paciente_id)));
CREATE POLICY dispensacao_devolucoes_leitura ON public.dispensacao_devolucoes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dispensacoes d WHERE d.id = dispensacao_id));
REVOKE ALL ON public.dispensacoes, public.dispensacao_devolucoes FROM anon, authenticated;
GRANT SELECT ON public.dispensacoes, public.dispensacao_devolucoes TO authenticated;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.dispensacoes FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.dispensacao_devolucoes FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

-- ── estoque ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.mover_estoque(p_unidade uuid, p_medicamento uuid, p_delta numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_saldo numeric;
BEGIN
  INSERT INTO public.estoque_medicamento (unidade_id, medicamento_id, quantidade, atualizado_por, atualizado_em)
  VALUES (p_unidade, p_medicamento, p_delta, private.meu_perfil_id(), now())
  ON CONFLICT (unidade_id, medicamento_id) DO UPDATE
     SET quantidade = public.estoque_medicamento.quantidade + p_delta, atualizado_por = private.meu_perfil_id(), atualizado_em = now()
  RETURNING quantidade INTO v_saldo;
  RETURN v_saldo;
END $$;

-- ── 3b. sugestão: vezes nas próximas 24 h × unidades por vez ───────────────
-- número escrito em pt-BR ("1.000", "0,5") para numeric
CREATE OR REPLACE FUNCTION private.numero_ptbr(p text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(replace(regexp_replace(coalesce(p, ''), '\.(?=\d{3}(\D|$))', '', 'g'), ',', '.'), '')::numeric
$$;

-- quantidade com unidade de massa (em mg) ou volume (em mL): {valor, familia}
CREATE OR REPLACE FUNCTION private.quantidade_medida(p text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE m text[];
BEGIN
  m := regexp_match(lower(coalesce(p, '')), '(\d[\d.,]*)\s*(mcg|µg|mg|g|ml)\M');
  IF m IS NULL THEN RETURN NULL; END IF;
  RETURN CASE m[2]
    WHEN 'mcg' THEN jsonb_build_object('valor', private.numero_ptbr(m[1]) / 1000, 'familia', 'massa')
    WHEN 'µg' THEN jsonb_build_object('valor', private.numero_ptbr(m[1]) / 1000, 'familia', 'massa')
    WHEN 'mg' THEN jsonb_build_object('valor', private.numero_ptbr(m[1]), 'familia', 'massa')
    WHEN 'g' THEN jsonb_build_object('valor', private.numero_ptbr(m[1]) * 1000, 'familia', 'massa')
    ELSE jsonb_build_object('valor', private.numero_ptbr(m[1]), 'familia', 'volume') END;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.sugestao_dispensacao(p_item uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  it public.prescricao_itens;
  m public.medicamento;
  pos text; dose text;
  v_vezes integer; v_por_vez integer;
  v_origem_vezes text; v_origem_por_vez text;
  notas text[] := '{}';
  x text[]; d jsonb; c jsonb;
BEGIN
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  SELECT * INTO m FROM public.medicamento WHERE id = it.medicamento_id;
  pos := translate(lower(coalesce(it.posologia, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc');
  dose := translate(lower(coalesce(it.dose, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc');

  -- vezes nas próximas 24 h
  IF cardinality(coalesce(it.horarios, '{}')) > 0 THEN
    v_vezes := cardinality(it.horarios); v_origem_vezes := v_vezes || ' horário(s) no aprazamento';
  ELSIF pos ~ '(continuo|bomba|correr|infusao)' THEN
    notas := notas || 'Infusão contínua: a quantidade depende da vazão; quem dispensa define.'::text;
  ELSIF pos ~ '(\d+)\s*/\s*\d+\s*h' AND (regexp_match(pos, '(\d+)\s*/\s*\d+\s*h'))[1]::int BETWEEN 1 AND 24 THEN
    x := regexp_match(pos, '(\d+)\s*/\s*\d+\s*h');
    v_vezes := ceil(24.0 / x[1]::int)::int; v_origem_vezes := 'de ' || x[1] || '/' || x[1] || 'h, ' || v_vezes || ' vez(es) em 24 h';
  ELSIF pos ~ 'por\s*(\d+)\s*vez' THEN
    x := regexp_match(pos, 'por\s*(\d+)\s*vez');
    v_vezes := x[1]::int; v_origem_vezes := x[1] || ' vez(es) na posologia';
  ELSIF pos ~ '(\d+)\s*(x|vez|vezes)\s*(ao|por)?\s*dia' THEN
    x := regexp_match(pos, '(\d+)\s*(x|vez|vezes)\s*(ao|por)?\s*dia');
    v_vezes := x[1]::int; v_origem_vezes := x[1] || ' vez(es) ao dia';
  ELSIF pos ~ '(dose unica|\munica\M|agora)' THEN
    v_vezes := 1; v_origem_vezes := 'dose única';
  ELSE
    notas := notas || 'A posologia não diz quantas vezes em 24 h; quem dispensa define.'::text;
  END IF;
  IF it.se_necessario OR pos ~ '\mse\s+(dor|febre|necess|nausea|vomito|agitac)' THEN
    v_vezes := 1; v_origem_vezes := 'se necessário: sugestão de 1 vez';
  END IF;

  -- unidades por vez
  x := regexp_match(dose, '^\s*(\d+)\s*(ampola|frasco|comprimido|capsula|drageia|dragea|sache|envelope|bisnaga|adesivo|supositorio|seringa|caneta|flaconete|bolsa)');
  IF x IS NOT NULL THEN
    v_por_vez := x[1]::int; v_origem_por_vez := 'dose escrita em ' || x[2] || '(s)';
  ELSE
    d := private.quantidade_medida(dose);
    c := coalesce(private.quantidade_medida(m.apresentacao), CASE WHEN m.unidade_consumo IN ('comprimido', 'capsula', 'dragea') THEN private.quantidade_medida(m.concentracao) END);
    IF d IS NOT NULL AND c IS NOT NULL AND d ->> 'familia' = c ->> 'familia' AND (c ->> 'valor')::numeric > 0 THEN
      v_por_vez := greatest(1, ceil((d ->> 'valor')::numeric / (c ->> 'valor')::numeric))::int;
      v_origem_por_vez := 'dose ' || it.dose || ' ÷ ' || CASE
        WHEN c ->> 'familia' = 'massa' AND (c ->> 'valor')::numeric >= 1000 THEN replace(trim_scale((c ->> 'valor')::numeric / 1000)::text, '.', ',') || ' g'
        WHEN c ->> 'familia' = 'massa' THEN replace(trim_scale((c ->> 'valor')::numeric)::text, '.', ',') || ' mg'
        ELSE replace(trim_scale((c ->> 'valor')::numeric)::text, '.', ',') || ' mL' END || ' por unidade';
    ELSE
      v_por_vez := 1;
      notas := notas || 'Não deu para comparar a dose com a apresentação: conferir quantas unidades por vez.'::text;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'quantidade', CASE WHEN v_vezes IS NOT NULL THEN v_vezes * v_por_vez END,
    'vezes', v_vezes, 'por_vez', v_por_vez,
    'explicacao', concat_ws(' × ', v_origem_vezes, CASE WHEN v_por_vez IS NOT NULL THEN v_por_vez || ' por vez' || coalesce(' (' || v_origem_por_vez || ')', '') END),
    'notas', to_jsonb(notas));
END $$;
REVOKE ALL ON FUNCTION private.mover_estoque(uuid, uuid, numeric), private.sugestao_dispensacao(uuid),
  private.numero_ptbr(text), private.quantidade_medida(text) FROM PUBLIC, anon, authenticated;

-- ── leitura ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.dispensacao_json(d public.dispensacoes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', d.id, 'tipo', d.tipo, 'quantidade', d.quantidade, 'unidade_consumo', d.unidade_consumo,
    'devolvido', coalesce((SELECT sum(v.quantidade) FROM public.dispensacao_devolucoes v WHERE v.dispensacao_id = d.id), 0),
    'medicamento', (SELECT m.principio_ativo || coalesce(' ' || m.apresentacao, '') FROM public.medicamento m WHERE m.id = d.medicamento_id),
    'paciente', (SELECT coalesce(p.nome_social, p.nome) FROM public.pacientes p WHERE p.id = d.paciente_id),
    'destino', d.destino, 'motivo', d.motivo, 'sem_farmaceutico', d.sem_farmaceutico,
    'dispensada_por', (SELECT nome_completo FROM public.perfis WHERE id = d.dispensada_por), 'dispensada_em', d.dispensada_em,
    'conferida_por', (SELECT nome_completo FROM public.perfis WHERE id = d.conferida_por), 'conferida_em', d.conferida_em)
$$;
REVOKE ALL ON FUNCTION private.dispensacao_json(public.dispensacoes) FROM PUBLIC, anon, authenticated;

-- itens de medicamento das prescrições vigentes da unidade, com a sugestão
CREATE OR REPLACE FUNCTION public.itens_para_dispensar(p_unidade uuid, p_busca text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_farm boolean; v_busca text := nullif(private.nome_comparavel(p_busca), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_farm := private.eh_super_admin() OR private.farmaceutico_da(p_unidade);
  IF NOT (v_farm OR private.tenho_papel(p_unidade, 'enfermeiro') OR private.tenho_papel(p_unidade, 'tecnico_enfermagem')) THEN
    RAISE EXCEPTION 'Acesso negado: dispensação é da farmácia (ou da enfermagem com a farmácia fechada).' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'farmaceutico', v_farm,
    'itens', coalesce((SELECT jsonb_agg(x ORDER BY x ->> 'paciente', x ->> 'medicamento') FROM (
      SELECT jsonb_build_object(
        'item_id', it.id, 'paciente_id', pr.paciente_id,
        'paciente', coalesce(pa.nome_social, pa.nome), 'prontuario', pa.prontuario,
        'setor', (SELECT s.nome FROM public.setores s WHERE s.id = coalesce(i.setor_atual_id, e.setor_id)),
        'medicamento', m.principio_ativo || coalesce(' ' || m.apresentacao, ''), 'medicamento_id', m.id,
        'unidade_consumo', m.unidade_consumo, 'unidade_consumo_outra', m.unidade_consumo_outra,
        'dose', it.dose, 'via', it.via, 'posologia', it.posologia, 'se_necessario', it.se_necessario,
        'validacao', (SELECT v.situacao FROM public.validacoes_prescricao v WHERE v.item_id = it.id ORDER BY v.em DESC LIMIT 1),
        'dispensado_24h', coalesce((SELECT sum(d.quantidade) - coalesce(sum((SELECT sum(v.quantidade) FROM public.dispensacao_devolucoes v WHERE v.dispensacao_id = d.id)), 0)
                                      FROM public.dispensacoes d WHERE d.item_id = it.id AND d.dispensada_em > now() - interval '24 hours'), 0),
        'saldo_estoque', (SELECT em.quantidade FROM public.estoque_medicamento em WHERE em.unidade_id = p_unidade AND em.medicamento_id = m.id),
        'sugestao', private.sugestao_dispensacao(it.id)) AS x
        FROM public.prescricao_itens it
        JOIN public.prescricoes pr ON pr.id = it.prescricao_id AND pr.status = 'ativa' AND pr.unidade_id = p_unidade
        JOIN public.pacientes pa ON pa.id = pr.paciente_id
        JOIN public.medicamento m ON m.id = it.medicamento_id
        LEFT JOIN public.internacoes i ON i.id = pr.internacao_id
        LEFT JOIN public.episodios e ON e.id = pr.episodio_id
       WHERE it.tipo = 'medicamento' AND it.suspenso_em IS NULL
         AND (v_farm OR private.pode_atuar_no_paciente(pr.paciente_id))
         AND (v_busca IS NULL OR private.nome_comparavel(pa.nome) LIKE '%' || v_busca || '%' OR m.principio_ativo_norm LIKE '%' || v_busca || '%')
       LIMIT 300) s), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.dispensacoes_da_unidade(p_unidade uuid, p_horas integer DEFAULT 72)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.farmaceutico_da(p_unidade) OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: a lista de dispensações é da farmácia e do gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'dispensacoes', coalesce((SELECT jsonb_agg(private.dispensacao_json(d) ORDER BY d.dispensada_em DESC) FROM (
                      SELECT * FROM public.dispensacoes d WHERE d.unidade_id = p_unidade
                         AND (d.dispensada_em > now() - make_interval(hours => least(greatest(coalesce(p_horas, 72), 1), 720))
                              OR (d.sem_farmaceutico AND d.conferida_em IS NULL))
                       ORDER BY d.dispensada_em DESC LIMIT 500) d), '[]'::jsonb),
    'a_conferir', (SELECT count(*) FROM public.dispensacoes d WHERE d.unidade_id = p_unidade AND d.sem_farmaceutico AND d.conferida_em IS NULL),
    -- 5a: saldo negativo para a farmácia conferir
    'estoque_negativo', coalesce((SELECT jsonb_agg(jsonb_build_object('medicamento', m.principio_ativo || coalesce(' ' || m.apresentacao, ''),
                            'saldo', em.quantidade) ORDER BY em.quantidade)
                          FROM public.estoque_medicamento em JOIN public.medicamento m ON m.id = em.medicamento_id
                         WHERE em.unidade_id = p_unidade AND em.quantidade < 0), '[]'::jsonb));
END $$;

-- ── gravação ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dispensar_item(p_item uuid, p_quantidade integer, p_justificativa text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  it public.prescricao_itens; pr public.prescricoes; m public.medicamento;
  v_eu uuid := private.meu_perfil_id(); v_farm boolean; v_just text := nullif(btrim(coalesce(p_justificativa, '')), '');
  v_id uuid; v_saldo numeric; v_valida text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF it.id IS NULL OR it.tipo <> 'medicamento' OR it.medicamento_id IS NULL THEN RAISE EXCEPTION 'Item de medicamento não encontrado.'; END IF;
  IF pr.status <> 'ativa' OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'O item não está vigente (prescrição encerrada ou item suspenso).'; END IF;
  v_farm := private.eh_super_admin() OR private.farmaceutico_da(pr.unidade_id);
  IF NOT v_farm THEN
    -- 2b: enfermagem que cuida do paciente, farmácia fechada
    IF NOT ((private.tenho_papel(pr.unidade_id, 'enfermeiro') OR private.tenho_papel(pr.unidade_id, 'tecnico_enfermagem'))
            AND private.pode_atuar_no_paciente(pr.paciente_id)) THEN
      RAISE EXCEPTION 'Acesso negado: dispensa o farmacêutico; com a farmácia fechada, a enfermagem que cuida do paciente.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF length(coalesce(v_just, '')) < 10 THEN
      RAISE EXCEPTION 'Retirada sem farmacêutico: escreva a justificativa (mínimo de 10 letras).';
    END IF;
  END IF;
  IF coalesce(p_quantidade, 0) < 1 OR p_quantidade > 9999 THEN RAISE EXCEPTION 'Informe a quantidade (unidades de consumo).'; END IF;
  SELECT * INTO m FROM public.medicamento WHERE id = it.medicamento_id;

  INSERT INTO public.dispensacoes (unidade_id, paciente_id, item_id, medicamento_id, quantidade, unidade_consumo, tipo, motivo,
                                   sem_farmaceutico, sugestao, dispensada_por)
  VALUES (pr.unidade_id, pr.paciente_id, it.id, m.id, p_quantidade, coalesce(m.unidade_consumo_outra, m.unidade_consumo), 'prescricao',
          CASE WHEN NOT v_farm THEN v_just END, NOT v_farm, private.sugestao_dispensacao(it.id), v_eu)
  RETURNING id INTO v_id;
  v_saldo := private.mover_estoque(pr.unidade_id, m.id, -p_quantidade);

  -- 6a: farmacêutico dispensando valida o item, se ainda não validou
  IF v_farm THEN
    SELECT v.situacao INTO v_valida FROM public.validacoes_prescricao v WHERE v.item_id = it.id ORDER BY v.em DESC LIMIT 1;
    IF v_valida IS DISTINCT FROM 'confere' THEN PERFORM public.validar_item(it.id, true); END IF;
  END IF;
  PERFORM private.registrar_auditoria('dispensar', 'dispensacoes', v_id, pr.unidade_id,
    jsonb_build_object('item', it.id, 'medicamento', m.id, 'quantidade', p_quantidade, 'sem_farmaceutico', NOT v_farm, 'saldo', v_saldo));
  RETURN jsonb_build_object('id', v_id, 'saldo', v_saldo, 'estoque_negativo', v_saldo < 0, 'sem_farmaceutico', NOT v_farm);
END $$;

-- 1b. avulsa (sem prescrição): só farmacêutico, com destino e motivo
CREATE OR REPLACE FUNCTION public.dispensar_avulso(p_unidade uuid, p_medicamento uuid, p_quantidade integer, p_destino text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.medicamento; v_id uuid; v_saldo numeric; v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.farmaceutico_da(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: a dispensação avulsa é do farmacêutico.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO m FROM public.medicamento WHERE id = p_medicamento AND ativo;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Escolha o medicamento do cadastro.'; END IF;
  IF coalesce(p_quantidade, 0) < 1 OR p_quantidade > 9999 THEN RAISE EXCEPTION 'Informe a quantidade (unidades de consumo).'; END IF;
  IF length(btrim(coalesce(p_destino, ''))) < 3 THEN RAISE EXCEPTION 'Informe o destino (ex.: carrinho de emergência do PS).'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  INSERT INTO public.dispensacoes (unidade_id, medicamento_id, quantidade, unidade_consumo, tipo, destino, motivo, dispensada_por)
  VALUES (p_unidade, m.id, p_quantidade, coalesce(m.unidade_consumo_outra, m.unidade_consumo), 'avulsa', btrim(p_destino), btrim(p_motivo), v_eu)
  RETURNING id INTO v_id;
  v_saldo := private.mover_estoque(p_unidade, m.id, -p_quantidade);
  PERFORM private.registrar_auditoria('dispensar_avulso', 'dispensacoes', v_id, p_unidade,
    jsonb_build_object('medicamento', m.id, 'quantidade', p_quantidade, 'destino', btrim(p_destino), 'saldo', v_saldo));
  RETURN jsonb_build_object('id', v_id, 'saldo', v_saldo, 'estoque_negativo', v_saldo < 0);
END $$;

-- 4a. devolução com motivo: volta ao estoque
CREATE OR REPLACE FUNCTION public.devolver_dispensacao(p_dispensacao uuid, p_quantidade integer, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.dispensacoes; v_resta integer; v_saldo numeric;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.dispensacoes WHERE id = p_dispensacao FOR UPDATE;
  IF d.id IS NULL OR NOT (private.eh_super_admin() OR private.farmaceutico_da(d.unidade_id)) THEN
    RAISE EXCEPTION 'Acesso negado: a devolução é recebida pelo farmacêutico.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_resta := d.quantidade - coalesce((SELECT sum(quantidade) FROM public.dispensacao_devolucoes WHERE dispensacao_id = d.id), 0);
  IF coalesce(p_quantidade, 0) < 1 OR p_quantidade > v_resta THEN
    RAISE EXCEPTION 'Quantidade a devolver entre 1 e % (o que ainda não voltou).', v_resta;
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  INSERT INTO public.dispensacao_devolucoes (dispensacao_id, quantidade, motivo, por)
  VALUES (d.id, p_quantidade, btrim(p_motivo), private.meu_perfil_id());
  v_saldo := private.mover_estoque(d.unidade_id, d.medicamento_id, p_quantidade);
  PERFORM private.registrar_auditoria('devolver_dispensacao', 'dispensacoes', d.id, d.unidade_id,
    jsonb_build_object('quantidade', p_quantidade, 'motivo', btrim(p_motivo), 'saldo', v_saldo));
  RETURN jsonb_build_object('saldo', v_saldo, 'resta', v_resta - p_quantidade);
END $$;

-- 2b. farmacêutico confere a retirada sem farmacêutico
CREATE OR REPLACE FUNCTION public.conferir_dispensacao(p_dispensacao uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.dispensacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.dispensacoes WHERE id = p_dispensacao FOR UPDATE;
  IF d.id IS NULL OR NOT (private.eh_super_admin() OR private.farmaceutico_da(d.unidade_id)) THEN
    RAISE EXCEPTION 'Acesso negado: quem confere é o farmacêutico.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT d.sem_farmaceutico THEN RAISE EXCEPTION 'Esta dispensação foi feita pelo farmacêutico.'; END IF;
  IF d.conferida_em IS NOT NULL THEN RAISE EXCEPTION 'Já conferida.'; END IF;
  UPDATE public.dispensacoes SET conferida_por = private.meu_perfil_id(), conferida_em = now() WHERE id = d.id;
  PERFORM private.registrar_auditoria('conferir_dispensacao', 'dispensacoes', d.id, d.unidade_id, '{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.itens_para_dispensar(uuid, text), public.dispensacoes_da_unidade(uuid, integer),
  public.dispensar_item(uuid, integer, text), public.dispensar_avulso(uuid, uuid, integer, text, text),
  public.devolver_dispensacao(uuid, integer, text), public.conferir_dispensacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.itens_para_dispensar(uuid, text), public.dispensacoes_da_unidade(uuid, integer),
  public.dispensar_item(uuid, integer, text), public.dispensar_avulso(uuid, uuid, integer, text, text),
  public.devolver_dispensacao(uuid, integer, text), public.conferir_dispensacao(uuid) TO authenticated;
