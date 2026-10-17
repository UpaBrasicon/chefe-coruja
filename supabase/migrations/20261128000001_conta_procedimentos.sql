-- Fase 5B, tarefa 2: procedimentos faturáveis entram na conta. Decisões do RT
-- em 16/10/2026 ("1a 2a 3a 4a 5a 6a"):
--
--  1a. Conta da porta: as mesmas linhas do BPA (private.bpa_linhas), filtradas
--      pelo atendimento — consulta médica, acolhimento com classificação,
--      medicação administrada e procedimentos registrados. Conta e BPA não
--      divergem.
--  2a. Enquanto aberta, a conta acompanha o atendimento; ao fechar, a lista
--      fica congelada (contas.itens_congelados); reaberta, volta a acompanhar.
--  3a. Conta de internação: o procedimento principal da AIH (do laudo) e os
--      procedimentos especiais que a AIH aceita à parte, lançados pelo
--      faturamento (public.conta_lancamentos).
--  4a. O faturamento lança e retira com motivo. Na conta da porta o
--      lançamento é o mesmo do BPA (public.registrar_procedimento /
--      cancelar_procedimento_realizado), para não divergir.
--  5a. Valor de referência do SIGTAP: porta = SA; internação = SH + SP.
--  6a. Item com problema leva o aviso (críticas do BPA e da AIH); a trava do
--      fechamento fica para a tarefa 5 (pré-auditoria).

ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS itens_congelados jsonb,
  ADD COLUMN IF NOT EXISTS congelada_em timestamptz;
COMMENT ON COLUMN public.contas.itens_congelados IS 'Itens da conta como estavam no fechamento (Fase 5B, tarefa 2); nulo enquanto a conta acompanha o atendimento.';

-- 3a/4a. procedimentos especiais da internação, lançados pelo faturamento
CREATE TABLE public.conta_lancamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id        uuid NOT NULL REFERENCES public.contas(id),
  procedimento    text NOT NULL CHECK (procedimento ~ '^[0-9]{10}$'),
  quantidade      integer NOT NULL CHECK (quantidade BETWEEN 1 AND 999),
  profissional_id uuid NOT NULL REFERENCES public.perfis(id),
  cbo             text,
  realizado_em    timestamptz NOT NULL,
  lancado_por     uuid NOT NULL REFERENCES public.perfis(id),
  lancado_em      timestamptz NOT NULL DEFAULT now(),
  retirado_em     timestamptz,
  retirado_por    uuid REFERENCES public.perfis(id),
  motivo_retirada text
);
CREATE INDEX conta_lancamentos_conta ON public.conta_lancamentos (conta_id) WHERE retirado_em IS NULL;
ALTER TABLE public.conta_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY conta_lancamentos_leitura ON public.conta_lancamentos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contas c WHERE c.id = conta_id AND private.pode_ver_contas(c.unidade_id)));
REVOKE ALL ON public.conta_lancamentos FROM anon, authenticated;
GRANT SELECT ON public.conta_lancamentos TO authenticated;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.conta_lancamentos FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

-- críticas de um procedimento especial/secundário da AIH (mesmas regras do BPA e da AIH)
CREATE OR REPLACE FUNCTION private.criticas_lancamento_aih(p_procedimento text, p_quantidade integer, p_cbo text, p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  sp terminologia.sigtap_procedimento;
  pa public.pacientes;
  r jsonb := '[]'::jsonb;
  v_meses integer;
BEGIN
  SELECT * INTO sp FROM terminologia.sigtap_procedimento WHERE codigo = p_procedimento;
  IF sp.codigo IS NULL THEN
    RETURN jsonb_build_array(jsonb_build_object('codigo', 'procedimento_sigtap', 'texto', 'Procedimento ' || p_procedimento || ' não existe no SIGTAP carregado.'));
  END IF;
  IF EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro)
     AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro x WHERE x.procedimento = p_procedimento AND x.registro IN ('04', '05')) THEN
    r := r || jsonb_build_object('codigo', 'instrumento', 'texto', 'O SIGTAP não registra este procedimento como especial ou secundário da AIH.');
  END IF;
  IF p_cbo IS NOT NULL AND EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_ocupacao o WHERE o.procedimento = p_procedimento)
     AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_ocupacao o WHERE o.procedimento = p_procedimento AND o.cbo = p_cbo) THEN
    r := r || jsonb_build_object('codigo', 'cbo_nao_aceito', 'texto', 'O CBO ' || p_cbo || ' não está entre os aceitos pelo procedimento no SIGTAP.');
  END IF;
  IF sp.qt_maxima IS NOT NULL AND sp.qt_maxima < p_quantidade THEN
    r := r || jsonb_build_object('codigo', 'quantidade_maxima', 'texto', 'Quantidade ' || p_quantidade || ' acima do máximo do SIGTAP (' || sp.qt_maxima || ').');
  END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF sp.sexo IN ('M', 'F') AND pa.sexo IN ('M', 'F') AND sp.sexo <> pa.sexo THEN
    r := r || jsonb_build_object('codigo', 'sexo', 'texto', 'Procedimento do SIGTAP só para o sexo ' || sp.sexo || '.');
  END IF;
  IF pa.data_nascimento IS NOT NULL THEN
    v_meses := (extract(year FROM age(pa.data_nascimento)) * 12 + extract(month FROM age(pa.data_nascimento)))::integer;
    IF (sp.idade_min IS NOT NULL AND v_meses < sp.idade_min) OR (sp.idade_max IS NOT NULL AND sp.idade_max > 0 AND v_meses > sp.idade_max) THEN
      r := r || jsonb_build_object('codigo', 'idade', 'texto', 'Idade do paciente fora da faixa do procedimento no SIGTAP ('
        || coalesce(sp.idade_min, 0) || ' a ' || coalesce(sp.idade_max, 0) || ' meses).');
    END IF;
  END IF;
  RETURN r;
END $$;

-- 1a/3a/5a/6a. itens da conta, calculados agora
CREATE OR REPLACE FUNCTION private.conta_itens(c public.contas)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_comp text;
  v_ini date;
  v_fim date;
  itens jsonb := '[]'::jsonb;
BEGIN
  IF c.tipo = 'ambulatorial' THEN
    SELECT * INTO e FROM public.episodios WHERE id = c.episodio_id;
    v_ini := date_trunc('month', (coalesce(e.chegada_em, c.aberta_em) AT TIME ZONE 'America/Sao_Paulo'))::date;
    v_fim := date_trunc('month', (coalesce(e.encerrado_em, e.desfecho_em, now()) AT TIME ZONE 'America/Sao_Paulo'))::date;
    -- a linha do BPA cai na competência do fato; o atendimento pode atravessar o mês
    FOR v_comp IN SELECT to_char(m, 'YYYYMM') FROM generate_series(v_ini, v_fim, interval '1 month') m LOOP
      itens := itens || coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'origem', l.origem, 'origem_id', l.origem_id, 'procedimento', l.procedimento,
                 'nome', (SELECT sp.nome FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = l.procedimento),
                 'quantidade', l.quantidade, 'profissional', l.profissional, 'cbo', l.prof_cbo, 'em', l.em,
                 'valor_unitario', (SELECT sp.valor_sa FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = l.procedimento),
                 'valor_total', l.quantidade * (SELECT sp.valor_sa FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = l.procedimento),
                 'criticas', l.criticas, 'avisos', l.avisos, 'destino', l.destino,
                 'retiravel', l.origem = 'registro') ORDER BY l.em)
          FROM private.bpa_linhas(c.unidade_id, v_comp) l WHERE l.episodio_id = c.episodio_id), '[]'::jsonb);
    END LOOP;
  ELSE
    -- procedimento principal da AIH da internação (a mais recente que não foi cancelada nem rejeitada)
    itens := itens || coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'origem', 'aih', 'origem_id', a.id, 'procedimento', x.proc,
               'nome', (SELECT sp.nome FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = x.proc),
               'quantidade', 1, 'profissional', (SELECT nome_completo FROM public.perfis WHERE id = a.solicitada_por), 'cbo', NULL,
               'em', a.solicitada_em,
               'valor_unitario', (SELECT coalesce(sp.valor_sh, 0) + coalesce(sp.valor_sp, 0) FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = x.proc),
               'valor_total', (SELECT coalesce(sp.valor_sh, 0) + coalesce(sp.valor_sp, 0) FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = x.proc),
               'criticas', coalesce(a.criticas, '[]'::jsonb), 'avisos', '[]'::jsonb,
               'aih', jsonb_build_object('status', a.status, 'numero', a.numero, 'competencia', a.competencia),
               'retiravel', false))
        FROM (SELECT * FROM public.aihs a WHERE a.internacao_id = c.internacao_id AND a.status IN ('solicitada', 'aprovada')
               ORDER BY a.solicitada_em DESC LIMIT 1) a
        JOIN public.documentos_clinicos d ON d.id = a.laudo_id
        CROSS JOIN LATERAL (SELECT nullif(regexp_replace(coalesce(private.json_seguro(d.conteudo) -> 'aih' ->> 'procCod', ''), '\D', '', 'g'), '') AS proc) x
       WHERE x.proc IS NOT NULL), '[]'::jsonb);
    -- especiais lançados pelo faturamento
    itens := itens || coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'origem', 'lancamento', 'origem_id', l.id, 'procedimento', l.procedimento,
               'nome', sp.nome, 'quantidade', l.quantidade,
               'profissional', (SELECT nome_completo FROM public.perfis WHERE id = l.profissional_id), 'cbo', l.cbo, 'em', l.realizado_em,
               'valor_unitario', coalesce(sp.valor_sh, 0) + coalesce(sp.valor_sp, 0),
               'valor_total', l.quantidade * (coalesce(sp.valor_sh, 0) + coalesce(sp.valor_sp, 0)),
               'criticas', private.criticas_lancamento_aih(l.procedimento, l.quantidade, l.cbo, c.paciente_id), 'avisos', '[]'::jsonb,
               'retiravel', true) ORDER BY l.realizado_em)
        FROM public.conta_lancamentos l LEFT JOIN terminologia.sigtap_procedimento sp ON sp.codigo = l.procedimento
       WHERE l.conta_id = c.id AND l.retirado_em IS NULL), '[]'::jsonb);
  END IF;
  RETURN itens;
END $$;
REVOKE ALL ON FUNCTION private.criticas_lancamento_aih(text, integer, text, uuid), private.conta_itens(public.contas) FROM PUBLIC, anon, authenticated;

-- 2a. congelar ao fechar; voltar a acompanhar ao reabrir (trecho da função da tarefa 1)
DO $$
DECLARE def text; antigo text; novo text;
BEGIN
  def := replace(pg_get_functiondef('public.mudar_etapa_conta(uuid, text, text)'::regprocedure), E'\r', '');
  antigo := '  UPDATE public.contas SET status = p_para, status_em = now(), status_por = v_eu WHERE id = c.id;';
  novo := '  UPDATE public.contas SET status = p_para, status_em = now(), status_por = v_eu,' || E'\n'
       || '         -- Fase 5B, tarefa 2: a lista congela no fechamento e volta a acompanhar na reabertura' || E'\n'
       || '         itens_congelados = CASE WHEN p_para = ''fechada'' THEN private.conta_itens(c) WHEN p_para = ''aberta'' THEN NULL ELSE itens_congelados END,' || E'\n'
       || '         congelada_em = CASE WHEN p_para = ''fechada'' THEN now() WHEN p_para = ''aberta'' THEN NULL ELSE congelada_em END' || E'\n'
       || '   WHERE id = c.id;';
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'mudar_etapa_conta mudou: trecho da gravação da etapa não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

-- detalhe com os itens e o total de referência
CREATE OR REPLACE FUNCTION public.conta_detalhe(p_conta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_itens jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta;
  IF c.id IS NULL OR NOT private.pode_ver_contas(c.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_itens := coalesce(c.itens_congelados, private.conta_itens(c));
  RETURN private.conta_json(c) || jsonb_build_object(
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object('evento', ev.evento, 'de', ev.de, 'para', ev.para, 'motivo', ev.motivo,
                               'por', (SELECT nome_completo FROM public.perfis WHERE id = ev.por), 'em', ev.em) ORDER BY ev.em)
                          FROM public.conta_eventos ev WHERE ev.conta_id = c.id), '[]'::jsonb),
    'pode_conduzir', private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento'),
    'pode_reabrir', private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id),
    'itens', v_itens,
    'congelada_em', c.congelada_em,
    'total_referencia', (SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(v_itens) x),
    'itens_com_aviso', (SELECT count(*) FROM jsonb_array_elements(v_itens) x WHERE jsonb_array_length(coalesce(x -> 'criticas', '[]'::jsonb)) > 0));
END $$;

-- 4a. lançar procedimento na conta
CREATE OR REPLACE FUNCTION public.lancar_procedimento_conta(p_conta uuid, p_procedimento text, p_quantidade integer DEFAULT 1,
                                                            p_profissional uuid DEFAULT NULL, p_realizado_em timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.contas;
  v_eu uuid := private.meu_perfil_id();
  v_proc text := private.so_digitos(p_procedimento);
  v_prof uuid := coalesce(p_profissional, private.meu_perfil_id());
  v_em timestamptz := coalesce(p_realizado_em, now());
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta FOR UPDATE;
  IF c.id IS NULL OR NOT (private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento')) THEN
    RAISE EXCEPTION 'Acesso negado: o lançamento na conta é do faturamento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status NOT IN ('aberta', 'em_conferencia') THEN RAISE EXCEPTION 'Conta fechada: o gestor reabre antes de lançar.'; END IF;
  IF c.tipo = 'ambulatorial' THEN
    -- o mesmo lançamento do BPA: a conta e o BPA não divergem
    v_id := public.registrar_procedimento(c.paciente_id, v_proc, p_quantidade, c.episodio_id, v_em, v_prof);
  ELSE
    IF v_proc IS NULL OR length(v_proc) <> 10 THEN RAISE EXCEPTION 'Informe o código SIGTAP (10 números).'; END IF;
    IF EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento) AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = v_proc) THEN
      RAISE EXCEPTION 'Procedimento % não existe no SIGTAP carregado.', v_proc;
    END IF;
    IF coalesce(p_quantidade, 0) < 1 OR p_quantidade > 999 THEN RAISE EXCEPTION 'Quantidade inválida.'; END IF;
    IF v_em > now() + interval '5 minutes' THEN RAISE EXCEPTION 'Data do procedimento no futuro.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = v_prof AND unidade_id = c.unidade_id AND ativo) THEN
      RAISE EXCEPTION 'O profissional não tem vínculo ativo na unidade.';
    END IF;
    INSERT INTO public.conta_lancamentos (conta_id, procedimento, quantidade, profissional_id, cbo, realizado_em, lancado_por)
    VALUES (c.id, v_proc, p_quantidade, v_prof, (SELECT cbo FROM public.perfis WHERE id = v_prof), v_em, v_eu)
    RETURNING id INTO v_id;
  END IF;
  INSERT INTO public.conta_eventos (conta_id, evento, para, por) VALUES (c.id, 'lancamento', v_proc, v_eu);
  PERFORM private.registrar_auditoria('conta_lancamento', 'contas', c.id, c.unidade_id,
    jsonb_build_object('numero', c.numero, 'procedimento', v_proc, 'quantidade', p_quantidade, 'profissional', v_prof, 'registro', v_id));
  RETURN public.conta_detalhe(c.id);
END $$;

-- 4a. retirar com motivo (só o que foi lançado; o que vem do atendimento se corrige na origem)
CREATE OR REPLACE FUNCTION public.retirar_procedimento_conta(p_conta uuid, p_origem text, p_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_eu uuid := private.meu_perfil_id(); v_motivo text := nullif(btrim(coalesce(p_motivo, '')), ''); v_proc text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta FOR UPDATE;
  IF c.id IS NULL OR NOT (private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento')) THEN
    RAISE EXCEPTION 'Acesso negado: o lançamento na conta é do faturamento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status NOT IN ('aberta', 'em_conferencia') THEN RAISE EXCEPTION 'Conta fechada: o gestor reabre antes de retirar.'; END IF;
  IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  IF c.tipo = 'ambulatorial' AND p_origem = 'registro' THEN
    SELECT procedimento INTO v_proc FROM public.procedimentos_realizados WHERE id = p_id AND episodio_id = c.episodio_id;
    IF v_proc IS NULL THEN RAISE EXCEPTION 'Este procedimento não é desta conta.'; END IF;
    PERFORM public.cancelar_procedimento_realizado(p_id, v_motivo);
  ELSIF c.tipo = 'internacao' AND p_origem = 'lancamento' THEN
    UPDATE public.conta_lancamentos SET retirado_em = now(), retirado_por = v_eu, motivo_retirada = v_motivo
     WHERE id = p_id AND conta_id = c.id AND retirado_em IS NULL
    RETURNING procedimento INTO v_proc;
    IF v_proc IS NULL THEN RAISE EXCEPTION 'Este procedimento não é desta conta.'; END IF;
  ELSE
    RAISE EXCEPTION 'Este item vem do atendimento (consulta, classificação, medicação ou AIH): corrija na origem.';
  END IF;
  INSERT INTO public.conta_eventos (conta_id, evento, de, motivo, por) VALUES (c.id, 'retirada', v_proc, v_motivo, v_eu);
  PERFORM private.registrar_auditoria('conta_retirada', 'contas', c.id, c.unidade_id,
    jsonb_build_object('numero', c.numero, 'procedimento', v_proc, 'motivo', v_motivo, 'registro', p_id));
  RETURN public.conta_detalhe(c.id);
END $$;

REVOKE ALL ON FUNCTION public.lancar_procedimento_conta(uuid, text, integer, uuid, timestamptz),
  public.retirar_procedimento_conta(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lancar_procedimento_conta(uuid, text, integer, uuid, timestamptz),
  public.retirar_procedimento_conta(uuid, text, uuid, text) TO authenticated;
