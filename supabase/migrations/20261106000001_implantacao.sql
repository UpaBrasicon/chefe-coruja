-- ════════════════════════════════════════════════════════════════════════════
-- Fase 3, tarefa 10 — playbook de implantação. Decisões do RT em 10/10/2026
-- (BACKLOG.md). O roteiro escrito fica em docs/implantacao/.
--
-- • Uma implantação por unidade (UPA 24h, pronto-socorro ou hospital pequeno),
--   aberta pelo implantador (super admin) com a data da virada (D0).
-- • Itens por fase: preparação (D-30 a D-7), virada (D0), operação assistida
--   (D+1 a D+14) e encerramento (D+30). Cada item tem responsável e prazo.
-- • O que o sistema confere sozinho (CNES, setores, leitos, protocolo de
--   classificação, usuários por papel, escala, estoque, treinamento, primeiro
--   atendimento) não se marca à mão: o painel calcula na hora.
-- • Treinamento: quem foi treinado, em qual papel e quando. Não bloqueia acesso.
-- • Aceite conjunto, por etapa: na virada a unidade passa a "em operação"; no
--   encerramento, a implantação fecha. Implantador e gestor registram cada um o
--   seu aceite, com as pendências aceitas. O sistema não trava nada.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.implantacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  tipo            text NOT NULL CHECK (tipo IN ('upa', 'ps', 'hospital')),
  d0              date NOT NULL,
  situacao        text NOT NULL DEFAULT 'em_implantacao' CHECK (situacao IN ('em_implantacao', 'em_operacao', 'encerrada')),
  implantador_id  uuid NOT NULL REFERENCES public.perfis(id),
  criada_em       timestamptz NOT NULL DEFAULT now(),
  em_operacao_em  timestamptz,
  encerrada_em    timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_implantacao_aberta ON public.implantacoes (unidade_id) WHERE situacao <> 'encerrada';

CREATE TABLE IF NOT EXISTS public.implantacao_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id  uuid NOT NULL REFERENCES public.implantacoes(id),
  codigo          text NOT NULL,
  fase            text NOT NULL CHECK (fase IN ('preparacao', 'virada', 'assistida', 'encerramento')),
  ordem           integer NOT NULL,
  titulo          text NOT NULL,
  descricao       text,
  obrigatorio     boolean NOT NULL,
  responsavel     text NOT NULL CHECK (responsavel IN ('implantador', 'gestor', 'ambos')),
  prazo_dia       integer NOT NULL,
  verificacao     text,            -- código da conferência automática; NULL = marcado à mão
  feito_em        timestamptz,
  feito_por       uuid REFERENCES public.perfis(id),
  observacao      text,
  UNIQUE (implantacao_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.implantacao_treinamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id  uuid NOT NULL REFERENCES public.implantacoes(id),
  perfil_id       uuid NOT NULL REFERENCES public.perfis(id),
  papel           text NOT NULL,
  treinado_em     date NOT NULL,
  observacao      text,
  registrado_por  uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (implantacao_id, perfil_id, papel)
);

CREATE TABLE IF NOT EXISTS public.implantacao_aceites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id  uuid NOT NULL REFERENCES public.implantacoes(id),
  etapa           text NOT NULL CHECK (etapa IN ('virada', 'encerramento')),
  lado            text NOT NULL CHECK (lado IN ('implantador', 'gestor')),
  perfil_id       uuid NOT NULL REFERENCES public.perfis(id),
  pendencias      text,
  em              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (implantacao_id, etapa, lado)
);
DROP TRIGGER IF EXISTS trg_implantacao_aceites_so_insercao ON public.implantacao_aceites;
CREATE TRIGGER trg_implantacao_aceites_so_insercao BEFORE UPDATE OR DELETE ON public.implantacao_aceites
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

ALTER TABLE public.implantacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implantacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implantacao_treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implantacao_aceites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.implantacoes, public.implantacao_itens, public.implantacao_treinamentos, public.implantacao_aceites
  FROM anon, authenticated;
-- leitura e escrita só pelas RPCs abaixo

-- ── catálogo de itens ───────────────────────────────────────────────────────
-- (código, fase, ordem, título, descrição, obrigatório, responsável, prazo em
--  dias a partir do D0, verificação automática, tipos de unidade)
CREATE OR REPLACE FUNCTION private.implantacao_catalogo()
RETURNS TABLE (codigo text, fase text, ordem integer, titulo text, descricao text, obrigatorio boolean,
               responsavel text, prazo_dia integer, verificacao text, tipos text[])
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  VALUES
  ('P01', 'preparacao', 1, 'CNES da unidade', 'Gestor informa o CNES em Unidade › Configurações (7 dígitos). Sem ele não há faturamento SUS nem RNDS.', true, 'gestor', -30, 'cnes', ARRAY['upa', 'ps', 'hospital']),
  ('P02', 'preparacao', 2, 'Contrato e termo de tratamento de dados (LGPD)', 'Contrato assinado, com o Chefe Coruja como operador dos dados e a unidade (ou a secretaria) como controladora.', true, 'gestor', -30, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('P03', 'preparacao', 3, 'Setores criados', 'UPA: porta (emergência) e observação. Pronto-socorro: porta. Hospital: internação. Os demais conforme a planta da unidade.', true, 'implantador', -25, 'setores', ARRAY['upa', 'ps', 'hospital']),
  ('P04', 'preparacao', 4, 'Leitos cadastrados', 'Cada leito com identificador e tipo, no setor certo. Conferir com a planta e com o CNES.', true, 'implantador', -25, 'leitos', ARRAY['upa', 'ps', 'hospital']),
  ('P05', 'preparacao', 5, 'Protocolo de classificação de risco', 'Escolhido pela enfermagem e pelo responsável técnico. O sistema mostra a referência; a cor é decisão do enfermeiro.', true, 'gestor', -25, 'protocolo', ARRAY['upa', 'ps']),
  ('P06', 'preparacao', 6, 'Usuários criados e vinculados por papel', 'No mínimo gestor, recepção, enfermeiro e médico plantonista (hospital: também farmacêutico). Cada pessoa com o seu login; nada de login compartilhado.', true, 'ambos', -21, 'usuarios', ARRAY['upa', 'ps', 'hospital']),
  ('P07', 'preparacao', 7, 'Segundo fator testado com cada usuário', 'Cada pessoa entra uma vez e recebe o código no e-mail cadastrado. E-mail errado se corrige antes da virada.', true, 'implantador', -21, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('P08', 'preparacao', 8, 'Escala da primeira semana lançada', 'Plantões de D0 a D+6 em Escala, com médico e enfermagem em todos os turnos.', true, 'gestor', -14, 'escala', ARRAY['upa', 'ps', 'hospital']),
  ('P09', 'preparacao', 9, 'Medicamentos e estoque inicial', 'Farmácia cadastra o estoque e os limites de falta dos medicamentos padronizados da unidade.', true, 'gestor', -14, 'estoque', ARRAY['hospital']),
  ('P10', 'preparacao', 10, 'Medicamentos e estoque inicial', 'Recomendado na UPA e no PS: estoque e limites dos medicamentos da sala de emergência.', false, 'gestor', -14, 'estoque', ARRAY['upa', 'ps']),
  ('P11', 'preparacao', 11, 'Interações críticas e alta vigilância revisadas', 'Farmácia revisa a lista de interações críticas e os medicamentos de alta vigilância da unidade.', false, 'gestor', -14, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('P12', 'preparacao', 12, 'Dados do SUS dos profissionais e da produção', 'CNS e CBO no perfil de cada profissional; críticas da AIH e órgão emissor da APAC, se a unidade fatura AIH/APAC.', true, 'gestor', -14, NULL, ARRAY['hospital']),
  ('P13', 'preparacao', 13, 'Dados do SUS dos profissionais e da produção', 'CNS e CBO no perfil de cada profissional, para o BPA.', false, 'gestor', -14, NULL, ARRAY['upa', 'ps']),
  ('P14', 'preparacao', 14, 'Fluxo completo testado na homologação', 'Com dados de teste: ficha, classificação, atendimento médico, prescrição, desfecho, observação ou internação, alta e documentos.', true, 'implantador', -10, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('P15', 'preparacao', 15, 'Treinamento por papel', 'Cada pessoa com vínculo treinada no seu papel, pelo roteiro de docs/implantacao/treinamento. Registrar aqui quem foi treinado.', true, 'implantador', -7, 'treinamento', ARRAY['upa', 'ps', 'hospital']),
  ('P16', 'preparacao', 16, 'Computadores, impressoras e internet de reserva', 'Um computador por posto, impressora em cada setor que imprime, e uma segunda conexão (ou roteador 4G) testada.', true, 'gestor', -7, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('P17', 'preparacao', 17, 'Plano de contingência e formulários impressos', 'Plano e formulários de papel em cada setor, com o responsável por digitar depois da queda.', true, 'gestor', -7, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('V01', 'virada', 1, 'Ensaio de queda na véspera', 'Simular 15 minutos sem sistema: papel, depois digitação com registro tardio. Anotar o que falhou.', true, 'implantador', -1, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('V02', 'virada', 2, 'Implantador presente na virada', 'Apoio na unidade nas primeiras 24 horas, em todos os turnos.', true, 'implantador', 0, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('V03', 'virada', 3, 'Canal de suporte divulgado', 'Contato do suporte e "Chamados técnicos" mostrados a cada turno.', true, 'implantador', 0, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('V04', 'virada', 4, 'Primeiro atendimento completo no sistema', 'Um atendimento da chegada ao desfecho, registrado a partir do D0.', true, 'ambos', 0, 'primeiro_atendimento', ARRAY['upa', 'ps', 'hospital']),
  ('O01', 'assistida', 1, 'Ronda diária com o gestor', 'Dúvidas e erros do dia, de D+1 a D+14. O que não se resolve vira chamado técnico.', true, 'implantador', 14, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('O02', 'assistida', 2, 'Erros de tela revisados', 'Revisar os erros da unidade em "Erros e alertas" e corrigir o que for de cadastro ou de treinamento.', true, 'implantador', 3, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('O03', 'assistida', 3, 'Registros tardios e fila sem conexão conferidos', 'Nenhum registro feito sem conexão ficou sem sincronizar; os registros tardios têm justificativa.', true, 'implantador', 7, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('O04', 'assistida', 4, 'Treinamento de reforço', 'Para quem entrou na escala depois da virada e para quem errou mais na primeira semana.', false, 'gestor', 14, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('O05', 'assistida', 5, 'Primeira competência de produção revisada', 'Conferir com o faturamento o BPA e as AIH do período, antes do fechamento.', true, 'gestor', 14, NULL, ARRAY['hospital']),
  ('O06', 'assistida', 6, 'Primeira competência de produção revisada', 'Conferir o BPA do período com quem fatura, antes do fechamento.', false, 'gestor', 14, NULL, ARRAY['upa', 'ps']),
  ('E01', 'encerramento', 1, 'Indicadores do primeiro mês', 'Apresentar ao gestor: tempo até a classificação e até o médico, evasão, ocupação, permanência e erros de tela.', true, 'implantador', 30, NULL, ARRAY['upa', 'ps', 'hospital']),
  ('E02', 'encerramento', 2, 'Pendências com responsável e prazo', 'O que ficou em aberto, registrado no aceite do encerramento ou em chamado técnico.', true, 'ambos', 30, NULL, ARRAY['upa', 'ps', 'hospital'])
$$;
REVOKE ALL ON FUNCTION private.implantacao_catalogo() FROM PUBLIC, anon, authenticated;

-- ── conferências automáticas ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.implantacao_verificar(p_codigo text, i public.implantacoes)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_n integer; v_m integer; v_falta text;
BEGIN
  CASE p_codigo
  WHEN 'cnes' THEN
    RETURN (SELECT jsonb_build_object('ok', coalesce(u.cnes ~ '^\d{7}$', false),
              'detalhe', CASE WHEN u.cnes ~ '^\d{7}$' THEN 'CNES ' || u.cnes ELSE 'CNES não informado' END)
              FROM public.unidades u WHERE u.id = i.unidade_id);
  WHEN 'setores' THEN
    SELECT string_agg(t.rotulo, ', ') INTO v_falta
      FROM (VALUES ('emergencia', 'porta (emergência)', ARRAY['upa', 'ps']), ('observacao', 'observação', ARRAY['upa']),
                   ('internacao', 'internação', ARRAY['hospital'])) t(tipo, rotulo, tipos)
     WHERE i.tipo = ANY (t.tipos)
       AND NOT EXISTS (SELECT 1 FROM public.setores s WHERE s.unidade_id = i.unidade_id AND s.ativo AND s.tipo::text = t.tipo);
    SELECT count(*) INTO v_n FROM public.setores s WHERE s.unidade_id = i.unidade_id AND s.ativo;
    RETURN jsonb_build_object('ok', v_falta IS NULL AND v_n > 0,
      'detalhe', CASE WHEN v_falta IS NULL THEN v_n || ' setor(es) ativo(s)' ELSE 'Falta setor de ' || v_falta END);
  WHEN 'leitos' THEN
    SELECT count(*) INTO v_n FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
     WHERE s.unidade_id = i.unidade_id AND l.ativo AND s.ativo;
    RETURN jsonb_build_object('ok', v_n > 0, 'detalhe', v_n || ' leito(s) ativo(s)');
  WHEN 'protocolo' THEN
    RETURN (SELECT jsonb_build_object('ok', u.protocolo_classificacao_id IS NOT NULL,
              'detalhe', coalesce((SELECT p.codigo FROM public.protocolos_classificacao p WHERE p.id = u.protocolo_classificacao_id), 'Protocolo não escolhido'))
              FROM public.unidades u WHERE u.id = i.unidade_id);
  WHEN 'usuarios' THEN
    SELECT string_agg(p.papel, ', ' ORDER BY p.ordem) INTO v_falta
      FROM (VALUES (1, 'gestor'), (2, 'recepcao'), (3, 'enfermeiro'), (4, 'plantonista'), (5, 'farmaceutico')) p(ordem, papel)
     WHERE (p.papel <> 'farmaceutico' OR i.tipo = 'hospital')
       AND NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.unidade_id = i.unidade_id AND v.ativo AND v.papel::text = p.papel);
    SELECT count(DISTINCT v.perfil_id) INTO v_n FROM public.vinculos v WHERE v.unidade_id = i.unidade_id AND v.ativo;
    RETURN jsonb_build_object('ok', v_falta IS NULL,
      'detalhe', CASE WHEN v_falta IS NULL THEN v_n || ' pessoa(s) com vínculo' ELSE 'Falta papel: ' || v_falta END);
  WHEN 'escala' THEN
    SELECT count(*), count(DISTINCT e.data) INTO v_n, v_m FROM public.escala_plantao e
     WHERE e.unidade_id = i.unidade_id AND e.ativo AND e.data BETWEEN i.d0 AND i.d0 + 6;
    RETURN jsonb_build_object('ok', v_m = 7,
      'detalhe', v_n || ' plantão(ões) em ' || v_m || ' de 7 dias (D0 a D+6)');
  WHEN 'estoque' THEN
    SELECT count(*) INTO v_n FROM public.estoque_medicamento e WHERE e.unidade_id = i.unidade_id;
    RETURN jsonb_build_object('ok', v_n > 0, 'detalhe', v_n || ' medicamento(s) no estoque');
  WHEN 'treinamento' THEN
    SELECT count(*), count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.implantacao_treinamentos t
                                                     WHERE t.implantacao_id = i.id AND t.perfil_id = v.perfil_id AND t.papel = v.papel::text))
      INTO v_n, v_m
      FROM public.vinculos v WHERE v.unidade_id = i.unidade_id AND v.ativo AND v.papel::text <> 'admin';
    RETURN jsonb_build_object('ok', v_n > 0 AND v_m = v_n, 'detalhe', v_m || ' de ' || v_n || ' vínculo(s) treinado(s)');
  WHEN 'primeiro_atendimento' THEN
    SELECT count(*) INTO v_n FROM public.episodios e
     WHERE e.unidade_id = i.unidade_id AND e.chegada_em >= i.d0::timestamptz AND e.desfecho IS NOT NULL;
    RETURN jsonb_build_object('ok', v_n > 0, 'detalhe', v_n || ' atendimento(s) com desfecho desde o D0');
  ELSE
    RETURN jsonb_build_object('ok', false, 'detalhe', 'Conferência desconhecida');
  END CASE;
END $$;
REVOKE ALL ON FUNCTION private.implantacao_verificar(text, public.implantacoes) FROM PUBLIC, anon, authenticated;

-- Item cumprido: conferência automática ok, ou marcado à mão.
CREATE OR REPLACE FUNCTION private.implantacao_item_ok(it public.implantacao_itens, i public.implantacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN it.verificacao IS NOT NULL THEN (private.implantacao_verificar(it.verificacao, i)->>'ok')::boolean
              ELSE it.feito_em IS NOT NULL END
$$;
REVOKE ALL ON FUNCTION private.implantacao_item_ok(public.implantacao_itens, public.implantacoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.pode_implantacao(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')
$$;
REVOKE ALL ON FUNCTION private.pode_implantacao(uuid) FROM PUBLIC, anon, authenticated;

-- ── RPCs ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.implantacao_abrir(p_unidade uuid, p_tipo text, p_d0 date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Quem abre a implantação é o implantador (administração da plataforma).' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_tipo = 'ambulatorio' THEN RAISE EXCEPTION 'Ambulatório: o módulo ainda está a construir.'; END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('upa', 'ps', 'hospital') THEN RAISE EXCEPTION 'Tipo: UPA 24h, pronto-socorro ou hospital.'; END IF;
  IF p_d0 IS NULL THEN RAISE EXCEPTION 'Informe a data da virada (D0).'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = p_unidade AND ativo) THEN RAISE EXCEPTION 'Unidade inexistente ou inativa.'; END IF;
  IF EXISTS (SELECT 1 FROM public.implantacoes WHERE unidade_id = p_unidade AND situacao <> 'encerrada') THEN
    RAISE EXCEPTION 'Esta unidade já tem uma implantação aberta.';
  END IF;
  INSERT INTO public.implantacoes (unidade_id, tipo, d0, implantador_id)
  VALUES (p_unidade, p_tipo, p_d0, private.meu_perfil_id()) RETURNING id INTO v_id;
  INSERT INTO public.implantacao_itens (implantacao_id, codigo, fase, ordem, titulo, descricao, obrigatorio, responsavel, prazo_dia, verificacao)
  SELECT v_id, c.codigo, c.fase, c.ordem, c.titulo, c.descricao, c.obrigatorio, c.responsavel, c.prazo_dia, c.verificacao
    FROM private.implantacao_catalogo() c WHERE p_tipo = ANY (c.tipos);
  PERFORM private.registrar_auditoria('implantacao_aberta', 'implantacoes', v_id, p_unidade,
    jsonb_build_object('tipo', p_tipo, 'd0', p_d0));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.implantacao_abrir(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.implantacao_abrir(uuid, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.implantacao_mudar_d0(p_id uuid, p_d0 date, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.implantacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.implantacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Quem muda a data da virada é o implantador.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF i.situacao <> 'em_implantacao' THEN RAISE EXCEPTION 'A virada já aconteceu.'; END IF;
  IF p_d0 IS NULL THEN RAISE EXCEPTION 'Informe a nova data.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.implantacoes SET d0 = p_d0 WHERE id = i.id;
  PERFORM private.registrar_auditoria('implantacao_d0_mudou', 'implantacoes', i.id, i.unidade_id,
    jsonb_build_object('de', i.d0, 'para', p_d0, 'motivo', btrim(p_motivo)));
END $$;
REVOKE ALL ON FUNCTION public.implantacao_mudar_d0(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.implantacao_mudar_d0(uuid, date, text) TO authenticated;

-- Painel da unidade: a implantação mais recente, com os itens já conferidos.
CREATE OR REPLACE FUNCTION public.implantacao_painel(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.implantacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_unidade IS NULL OR NOT private.pode_implantacao(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO i FROM public.implantacoes WHERE unidade_id = p_unidade ORDER BY criada_em DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('implantacao', NULL, 'sou_implantador', private.eh_super_admin());
  END IF;
  RETURN jsonb_build_object(
    'sou_implantador', private.eh_super_admin(),
    'implantacao', jsonb_build_object('id', i.id, 'tipo', i.tipo, 'd0', i.d0, 'situacao', i.situacao,
       'implantador', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = i.implantador_id),
       'criada_em', i.criada_em, 'em_operacao_em', i.em_operacao_em, 'encerrada_em', i.encerrada_em),
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', it.id, 'codigo', it.codigo, 'fase', it.fase, 'titulo', it.titulo, 'descricao', it.descricao,
        'obrigatorio', it.obrigatorio, 'responsavel', it.responsavel, 'prazo', i.d0 + it.prazo_dia,
        'automatico', it.verificacao IS NOT NULL,
        'ok', private.implantacao_item_ok(it, i),
        'detalhe', CASE WHEN it.verificacao IS NOT NULL THEN private.implantacao_verificar(it.verificacao, i)->>'detalhe' END,
        'feito_em', it.feito_em, 'feito_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = it.feito_por),
        'observacao', it.observacao)
      ORDER BY CASE it.fase WHEN 'preparacao' THEN 1 WHEN 'virada' THEN 2 WHEN 'assistida' THEN 3 ELSE 4 END, it.ordem)
      FROM public.implantacao_itens it WHERE it.implantacao_id = i.id), '[]'::jsonb),
    'pessoas', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'perfil_id', v.perfil_id, 'nome', p.nome_completo, 'papel', v.papel,
        'treinado_em', t.treinado_em, 'treinamento_id', t.id,
        'registrado_por', (SELECT r.nome_completo FROM public.perfis r WHERE r.id = t.registrado_por))
      ORDER BY v.papel, p.nome_completo)
      FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
      LEFT JOIN public.implantacao_treinamentos t ON t.implantacao_id = i.id AND t.perfil_id = v.perfil_id AND t.papel = v.papel::text
      WHERE v.unidade_id = i.unidade_id AND v.ativo AND v.papel::text <> 'admin'), '[]'::jsonb),
    'aceites', coalesce((SELECT jsonb_agg(jsonb_build_object('etapa', a.etapa, 'lado', a.lado,
        'nome', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = a.perfil_id), 'pendencias', a.pendencias, 'em', a.em) ORDER BY a.em)
      FROM public.implantacao_aceites a WHERE a.implantacao_id = i.id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.implantacao_painel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.implantacao_painel(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.implantacao_marcar(p_item uuid, p_feito boolean, p_observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.implantacao_itens; i public.implantacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.implantacao_itens WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  SELECT * INTO i FROM public.implantacoes WHERE id = it.implantacao_id;
  IF NOT private.pode_implantacao(i.unidade_id) THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF i.situacao = 'encerrada' THEN RAISE EXCEPTION 'A implantação já foi encerrada.'; END IF;
  IF it.verificacao IS NOT NULL THEN RAISE EXCEPTION 'Este item o sistema confere sozinho.'; END IF;
  UPDATE public.implantacao_itens
     SET feito_em = CASE WHEN p_feito THEN now() END,
         feito_por = CASE WHEN p_feito THEN private.meu_perfil_id() END,
         observacao = nullif(btrim(coalesce(p_observacao, '')), '')
   WHERE id = it.id;
  PERFORM private.registrar_auditoria(CASE WHEN p_feito THEN 'implantacao_item_feito' ELSE 'implantacao_item_reaberto' END,
    'implantacao_itens', it.id, i.unidade_id, jsonb_build_object('codigo', it.codigo, 'observacao', p_observacao));
END $$;
REVOKE ALL ON FUNCTION public.implantacao_marcar(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.implantacao_marcar(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.implantacao_treinar(p_implantacao uuid, p_perfil uuid, p_papel text, p_data date DEFAULT NULL,
  p_observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.implantacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.implantacoes WHERE id = p_implantacao;
  IF NOT FOUND OR NOT private.pode_implantacao(i.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.unidade_id = i.unidade_id AND v.perfil_id = p_perfil
                    AND v.ativo AND v.papel::text = p_papel) THEN
    RAISE EXCEPTION 'Esta pessoa não tem esse papel na unidade.';
  END IF;
  IF coalesce(p_data, current_date) > current_date THEN RAISE EXCEPTION 'O treinamento não pode ter data futura.'; END IF;
  INSERT INTO public.implantacao_treinamentos (implantacao_id, perfil_id, papel, treinado_em, observacao, registrado_por)
  VALUES (i.id, p_perfil, p_papel, coalesce(p_data, current_date), nullif(btrim(coalesce(p_observacao, '')), ''), private.meu_perfil_id())
  ON CONFLICT (implantacao_id, perfil_id, papel) DO UPDATE
    SET treinado_em = excluded.treinado_em, observacao = excluded.observacao,
        registrado_por = excluded.registrado_por, registrado_em = now();
  PERFORM private.registrar_auditoria('implantacao_treinamento', 'implantacoes', i.id, i.unidade_id,
    jsonb_build_object('perfil_id', p_perfil, 'papel', p_papel, 'data', coalesce(p_data, current_date)));
END $$;
REVOKE ALL ON FUNCTION public.implantacao_treinar(uuid, uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.implantacao_treinar(uuid, uuid, text, date, text) TO authenticated;

-- Desfaz um registro de treinamento lançado por engano (fica na auditoria).
CREATE OR REPLACE FUNCTION public.implantacao_destreinar(p_treinamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t public.implantacao_treinamentos; i public.implantacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO t FROM public.implantacao_treinamentos WHERE id = p_treinamento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;
  SELECT * INTO i FROM public.implantacoes WHERE id = t.implantacao_id;
  IF NOT private.pode_implantacao(i.unidade_id) THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  DELETE FROM public.implantacao_treinamentos WHERE id = t.id;
  PERFORM private.registrar_auditoria('implantacao_treinamento_desfeito', 'implantacoes', i.id, i.unidade_id,
    jsonb_build_object('perfil_id', t.perfil_id, 'papel', t.papel, 'data', t.treinado_em));
END $$;
REVOKE ALL ON FUNCTION public.implantacao_destreinar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.implantacao_destreinar(uuid) TO authenticated;

-- Aceite de uma etapa. O implantador é o super admin; o gestor, o da unidade.
-- Exige os itens obrigatórios das fases até a etapa. Com os dois aceites, a
-- situação avança (virada: em operação; encerramento: encerrada).
CREATE OR REPLACE FUNCTION public.implantacao_aceitar(p_id uuid, p_etapa text, p_pendencias text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.implantacoes; v_lado text; v_faltam text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.implantacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT private.pode_implantacao(i.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_etapa NOT IN ('virada', 'encerramento') THEN RAISE EXCEPTION 'Etapa: virada ou encerramento.'; END IF;
  IF p_etapa = 'virada' AND i.situacao <> 'em_implantacao' THEN RAISE EXCEPTION 'A virada já foi aceita.'; END IF;
  IF p_etapa = 'encerramento' AND i.situacao <> 'em_operacao' THEN
    RAISE EXCEPTION 'O encerramento vem depois da virada.';
  END IF;
  v_lado := CASE WHEN private.eh_super_admin() THEN 'implantador' ELSE 'gestor' END;
  IF EXISTS (SELECT 1 FROM public.implantacao_aceites a WHERE a.implantacao_id = i.id AND a.etapa = p_etapa AND a.lado = v_lado) THEN
    RAISE EXCEPTION 'O aceite do % já foi registrado.', v_lado;
  END IF;
  SELECT string_agg(it.codigo || ' ' || it.titulo, '; ' ORDER BY CASE it.fase WHEN 'preparacao' THEN 1 WHEN 'virada' THEN 2 WHEN 'assistida' THEN 3 ELSE 4 END, it.ordem) INTO v_faltam
    FROM public.implantacao_itens it
   WHERE it.implantacao_id = i.id AND it.obrigatorio
     AND (it.fase IN ('preparacao', 'virada') OR p_etapa = 'encerramento')
     AND NOT private.implantacao_item_ok(it, i);
  IF v_faltam IS NOT NULL THEN
    RAISE EXCEPTION 'Faltam itens obrigatórios: %', v_faltam;
  END IF;
  INSERT INTO public.implantacao_aceites (implantacao_id, etapa, lado, perfil_id, pendencias)
  VALUES (i.id, p_etapa, v_lado, private.meu_perfil_id(), nullif(btrim(coalesce(p_pendencias, '')), ''));
  PERFORM private.registrar_auditoria('implantacao_aceite', 'implantacoes', i.id, i.unidade_id,
    jsonb_build_object('etapa', p_etapa, 'lado', v_lado, 'pendencias', p_pendencias));
  IF (SELECT count(*) FROM public.implantacao_aceites a WHERE a.implantacao_id = i.id AND a.etapa = p_etapa) = 2 THEN
    IF p_etapa = 'virada' THEN
      UPDATE public.implantacoes SET situacao = 'em_operacao', em_operacao_em = now() WHERE id = i.id;
    ELSE
      UPDATE public.implantacoes SET situacao = 'encerrada', encerrada_em = now() WHERE id = i.id;
    END IF;
  END IF;
  RETURN jsonb_build_object('lado', v_lado, 'situacao', (SELECT situacao FROM public.implantacoes WHERE id = i.id));
END $$;
REVOKE ALL ON FUNCTION public.implantacao_aceitar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.implantacao_aceitar(uuid, text, text) TO authenticated;
