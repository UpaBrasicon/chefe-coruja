-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 6 do Portão de 11/10/2026: prescrição vencida e renovação.
-- Diagnóstico e decisão do RT (10/11/2026, A em V1 a V9):
--   docs/porta/LACUNA-06-PRESCRICAO-VENCIDA-DIAGNOSTICO.md
--
-- Fonte (texto conferido em 10/11/2026):
--   - Resolução COFEN nº 689/2022, Art. 4º: a enfermagem não executa
--     prescrição fora da validade; §1º, I: nos serviços hospitalares, a
--     validade é de 24 horas. Sem exceção de urgência (a urgência é o "Agora").
--   - Nenhuma norma do MS, da ANVISA ou do CFM fixa outro prazo (Portaria MS
--     2.095/2013, Anexo 03, item 5.1 d; Portaria MS 4.283/2010).
--
-- O que faz:
--   V1  prescricao_itens.valida_ate: o gatilho de inserção grava now() + 24 h
--       (a renovação é uma versão nova, logo uma inserção). Vale na porta, na
--       observação e na internação. Transição: os itens ativos no dia da
--       publicação ganham 24 h a partir daquela hora (nada vence de uma vez);
--       a contenção ativa fica com o prazo que já tinha (criação + 24 h).
--       Só o servidor grava a validade (gatilho de guarda contra o UPDATE
--       direto pela API). prescricoes.valida_ate continua sem uso: a validade
--       é do item, não da prescrição (uma prescrição tem itens de horas
--       diferentes).
--   V2  vencido: checar recusa o "feito" (o "não feito" e o "recusado" seguem,
--       porque registram que não houve execução), dispensar_item recusa, e
--       private.doses_do_item não gera horário a partir do vencimento.
--       fila_checagem, fila_validacao, prescricao_vigente e
--       prescricao_porta_ativa ganham as colunas valida_ate e validade (e
--       renovacao_pedida_em nas três da enfermagem e do médico);
--       painel_atendimento_ps ganha as mesmas chaves. Colunas novas em
--       RETURNS TABLE pedem DROP e CREATE (mesmo nome, mesmos argumentos,
--       mesmos privilégios); as colunas antigas continuam, na mesma ordem.
--   V3  public.pedir_renovacao: a enfermagem pede a renovação do item vencido
--       ou a 2 h do fim; avisa o médico de plantão do setor, uma vez por item
--       e por médico.
--   V4  public.renovar_prescricao(paciente, decisões): manter, alterar ou
--       suspender, item a item, numa transação só. Manter cria a versão nova
--       idêntica pelo prescrever (as mesmas travas: alergia, peso, interação,
--       duplicidade), com o autor sendo quem renovou; a anterior é suspensa
--       com o motivo "Renovada"; os horários do aprazamento passam para a nova
--       e a validação da farmácia também, se nada mudou (linha nova em
--       validacoes_prescricao com herdada_de apontando a validação anterior;
--       o farmacêutico é o mesmo). Alterar usa alterar_item_prescricao;
--       suspender, suspender_item.
--   V5  quem renova: o médico de plantão em cuidado do paciente (como prescrever).
--   V6  job "prescricao-validade-avisos" (a cada 15 min): aviso ao médico de
--       plantão do setor a 2 h do fim e no vencimento, um por item, por
--       janela e por médico (a chave leva o id do item e a janela).
--   V7  "Agora" não vence (valida_ate nula); "Se necessário", "Contínuo" e
--       cuidados vencem em 24 h. Contenção: o prazo é o mesmo (24 h) e o item
--       também não se checa vencido, mas a renovação e os avisos são os dela
--       (private.contencao_avisar, lacuna 4): o job daqui, a renovação e o
--       pedido de renovação pulam o tipo 'contencao' (sem aviso em dobro).
--   V8  itens da porta valem 24 h desde a prescrição e entram na renovação na
--       observação e na internação (prescricao_porta_ativa); a versão nova vai
--       para a prescrição do leito (o prescrever escolhe a prescrição ativa).
--   V9  a impressão leva "válido até DD/MM HH:MM" (src/lib/folhas.ts).
--
-- Funções trocadas trecho a trecho pelo texto atual (pg_get_functiondef),
-- como em 20270326000001: trecho que sumiu para a migration com erro; trecho
-- já trocado é pulado (reaplicável); corpo CRLF continua CRLF. Conferido em
-- 10/11/2026 na homologação: checar, dispensar_item, doses_do_item,
-- painel_atendimento_ps (mesma assinatura) e fila_checagem, fila_validacao,
-- prescricao_vigente, prescricao_porta_ativa (colunas novas no fim).
--
-- Só expande: colunas, índices, funções, gatilhos e job novos; oito funções
-- com o corpo trocado.
-- Teste: supabase/tests/prescricao_vencida.sql
--
-- Rollback (testado na homologação, em transação desfeita; o md5 das funções
-- trocadas volta ao de antes): o bloco comentado no fim deste arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── V1: a validade do item ──────────────────────────────────────────────────
ALTER TABLE public.prescricao_itens ADD COLUMN IF NOT EXISTS valida_ate timestamptz;
ALTER TABLE public.prescricao_itens ADD COLUMN IF NOT EXISTS renovacao_pedida_em timestamptz;
ALTER TABLE public.prescricao_itens ADD COLUMN IF NOT EXISTS renovacao_pedida_por uuid REFERENCES public.perfis(id);
COMMENT ON COLUMN public.prescricao_itens.valida_ate IS
  'Validade do item: 24 h da prescrição ou da renovação (Resolução COFEN 689/2022, art. 4º). Nula no "Agora" (dose única). Só o servidor grava.';
COMMENT ON COLUMN public.prescricao_itens.renovacao_pedida_em IS
  'Primeiro pedido de renovação da enfermagem (public.pedir_renovacao).';
CREATE INDEX IF NOT EXISTS prescricao_itens_validade ON public.prescricao_itens (valida_ate)
  WHERE suspenso_em IS NULL AND valida_ate IS NOT NULL;
CREATE INDEX IF NOT EXISTS prescricao_itens_renovacao_pedida_por_fk_idx ON public.prescricao_itens (renovacao_pedida_por);

-- V4: a validação da farmácia que passa para a versão renovada
ALTER TABLE public.validacoes_prescricao ADD COLUMN IF NOT EXISTS herdada_de uuid REFERENCES public.validacoes_prescricao(id);
COMMENT ON COLUMN public.validacoes_prescricao.herdada_de IS
  'Validação copiada na renovação sem mudança (lacuna 6): a validação do item anterior que ela repete.';
CREATE INDEX IF NOT EXISTS validacoes_prescricao_herdada_de_fk_idx ON public.validacoes_prescricao (herdada_de);

-- "Agora" é dose única: não vence (V7)
CREATE OR REPLACE FUNCTION private.item_e_agora(p_posologia text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT lower(btrim(coalesce(p_posologia, ''))) = 'agora'
$$;
REVOKE ALL ON FUNCTION private.item_e_agora(text) FROM PUBLIC, anon, authenticated;

-- Estado da validade, calculado no servidor: sem_prazo ("Agora"), em_dia,
-- vence_logo (a 2 h do fim) ou vencido.
CREATE OR REPLACE FUNCTION private.validade_item(p_valida_ate timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_valida_ate IS NULL THEN 'sem_prazo'
              WHEN now() >= p_valida_ate THEN 'vencido'
              WHEN now() >= p_valida_ate - interval '2 hours' THEN 'vence_logo'
              ELSE 'em_dia' END
$$;
REVOKE ALL ON FUNCTION private.validade_item(timestamptz) FROM PUBLIC, anon, authenticated;

-- Na inserção, o servidor grava a validade (a renovação é inserção).
CREATE OR REPLACE FUNCTION private.prescricao_item_validade()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.valida_ate := CASE WHEN private.item_e_agora(NEW.posologia) THEN NULL ELSE now() + interval '24 hours' END;
  NEW.renovacao_pedida_em := NULL;
  NEW.renovacao_pedida_por := NULL;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.prescricao_item_validade() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prescricao_item_validade ON public.prescricao_itens;
CREATE TRIGGER trg_prescricao_item_validade BEFORE INSERT ON public.prescricao_itens
  FOR EACH ROW EXECUTE FUNCTION private.prescricao_item_validade();

-- A tabela tem UPDATE para o médico pelo RLS: a validade e o pedido de
-- renovação só mudam pelo servidor (funções SECURITY DEFINER rodam como o dono).
CREATE OR REPLACE FUNCTION private.prescricao_item_validade_guarda()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.valida_ate IS DISTINCT FROM OLD.valida_ate OR NEW.renovacao_pedida_em IS DISTINCT FROM OLD.renovacao_pedida_em
          OR NEW.renovacao_pedida_por IS DISTINCT FROM OLD.renovacao_pedida_por) THEN
    RAISE EXCEPTION 'A validade do item é do servidor: renove pela tela "Renovar prescrição".' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.prescricao_item_validade_guarda() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prescricao_item_validade_guarda ON public.prescricao_itens;
CREATE TRIGGER trg_prescricao_item_validade_guarda BEFORE UPDATE ON public.prescricao_itens
  FOR EACH ROW EXECUTE FUNCTION private.prescricao_item_validade_guarda();

-- Transição (V1): item ativo sem validade ganha 24 h a partir de agora; a
-- contenção fica com o prazo que já tinha (criação + 24 h, lacuna 4). Só
-- toca validade nula: rodar de novo não estende nada.
CREATE OR REPLACE FUNCTION private.prescricao_validade_transicao()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k integer;
BEGIN
  UPDATE public.prescricao_itens i
     SET valida_ate = CASE WHEN i.tipo = 'contencao' THEN i.created_at + interval '24 hours' ELSE now() + interval '24 hours' END
   WHERE i.valida_ate IS NULL AND i.suspenso_em IS NULL AND NOT private.item_e_agora(i.posologia)
     AND EXISTS (SELECT 1 FROM public.prescricoes p WHERE p.id = i.prescricao_id AND p.status = 'ativa');
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $$;
REVOKE ALL ON FUNCTION private.prescricao_validade_transicao() FROM PUBLIC, anon, authenticated;
SELECT private.prescricao_validade_transicao();

-- ── onde o paciente está agora (avisos) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION private.prescricao_setor(pr public.prescricoes)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT i.setor_atual_id FROM public.internacoes i
      WHERE i.paciente_id = pr.paciente_id AND i.data_alta IS NULL AND i.status IN ('admitido', 'em_observacao', 'internado')
      ORDER BY i.data_admissao DESC LIMIT 1),
    (SELECT e.setor_id FROM public.episodios e WHERE e.id = pr.episodio_id),
    (SELECT pa.setor_id FROM public.pacientes pa WHERE pa.id = pr.paciente_id))
$$;
REVOKE ALL ON FUNCTION private.prescricao_setor(public.prescricoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.prescricao_local(pr public.prescricoes)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT 'leito ' || l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id
      WHERE i.paciente_id = pr.paciente_id AND i.data_alta IS NULL AND i.status IN ('admitido', 'em_observacao', 'internado')
      ORDER BY i.data_admissao DESC LIMIT 1),
    (SELECT s.nome FROM public.setores s WHERE s.id = private.prescricao_setor(pr)),
    'sem setor')
$$;
REVOKE ALL ON FUNCTION private.prescricao_local(public.prescricoes) FROM PUBLIC, anon, authenticated;

-- Aviso ao médico de plantão do setor (os destinatários da contenção: os
-- escalados agora no setor; sem ninguém no setor, os da unidade). Uma vez por
-- item, por janela e por médico, mesmo virando o dia (a chave do aviso tem a
-- data; o NOT EXISTS segura a repetição no dia seguinte).
CREATE OR REPLACE FUNCTION private.avisar_validade_item(p_item uuid, p_janela text, p_mensagem text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pr public.prescricoes; v_tipo text := 'presc_' || p_janela || '_' || p_item; k integer;
BEGIN
  SELECT p.* INTO pr FROM public.prescricoes p JOIN public.prescricao_itens i ON i.prescricao_id = p.id WHERE i.id = p_item;
  IF pr.id IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT d, pr.unidade_id, private.data_atual(), v_tipo, p_mensagem
    FROM private.contencao_destinatarios(pr.unidade_id, private.prescricao_setor(pr), 'plantonista') d
   WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.perfil_id = d AND n.unidade_id = pr.unidade_id AND n.tipo = v_tipo)
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $$;
REVOKE ALL ON FUNCTION private.avisar_validade_item(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- "Dipirona 1 g de Fulano (leito 12A)": o item e o paciente do aviso.
CREATE OR REPLACE FUNCTION private.validade_item_rotulo(p_item uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.descricao || coalesce(' ' || nullif(btrim(i.dose), ''), '') || ' de ' || coalesce(pa.nome_social, pa.nome)
         || ' (' || private.prescricao_local(pr) || ')'
    FROM public.prescricao_itens i
    JOIN public.prescricoes pr ON pr.id = i.prescricao_id
    JOIN public.pacientes pa ON pa.id = pr.paciente_id
   WHERE i.id = p_item
$$;
REVOKE ALL ON FUNCTION private.validade_item_rotulo(uuid) FROM PUBLIC, anon, authenticated;

-- ── V6: job dos avisos (a cada 15 min) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION private.prescricao_validade_avisar()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT i.id, i.valida_ate, now() >= i.valida_ate AS vencido
      FROM public.prescricao_itens i
      JOIN public.prescricoes pr ON pr.id = i.prescricao_id
     WHERE i.suspenso_em IS NULL AND i.valida_ate IS NOT NULL AND i.tipo <> 'contencao'
       AND pr.status = 'ativa' AND now() >= i.valida_ate - interval '2 hours'
       -- só quem ainda está na unidade (atendimento aberto ou internação ativa)
       AND (EXISTS (SELECT 1 FROM public.internacoes n WHERE n.paciente_id = pr.paciente_id AND n.data_alta IS NULL
                      AND n.status IN ('admitido', 'em_observacao', 'internado'))
            OR EXISTS (SELECT 1 FROM public.episodios e WHERE e.paciente_id = pr.paciente_id AND e.encerrado_em IS NULL))
  LOOP
    n := n + private.avisar_validade_item(r.id, CASE WHEN r.vencido THEN 'vencida' ELSE 'vence' END,
      CASE WHEN r.vencido
           THEN 'Prescrição vencida às ' || to_char(r.valida_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || ': '
                || private.validade_item_rotulo(r.id) || '. A enfermagem não administra até a renovação (COFEN 689/2022).'
           ELSE 'Renovar a prescrição: ' || private.validade_item_rotulo(r.id) || ' vence às '
                || to_char(r.valida_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || ' (vale 24 h).' END);
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.prescricao_validade_avisar() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'prescricao-validade-avisos';
SELECT cron.schedule('prescricao-validade-avisos', '*/15 * * * *', 'SELECT private.prescricao_validade_avisar();');

-- ── V3: a enfermagem pede a renovação ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pedir_renovacao(p_item uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes; v_estado text; k integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item FOR UPDATE;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF it.id IS NULL OR it.suspenso_em IS NOT NULL OR pr.status IS DISTINCT FROM 'ativa' THEN
    RAISE EXCEPTION 'Item não encontrado ou suspenso.';
  END IF;
  IF NOT coalesce(private.sou_enfermagem(pr.unidade_id), false) OR NOT coalesce(private.paciente_em_cuidado_no_plantao(pr.paciente_id), false) THEN
    RAISE EXCEPTION 'O pedido de renovação é da enfermagem de plantão com o paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF it.tipo = 'contencao' THEN
    RAISE EXCEPTION 'A contenção mecânica tem renovação própria: o médico já é avisado pelo registro da contenção.';
  END IF;
  v_estado := private.validade_item(it.valida_ate);
  IF v_estado = 'sem_prazo' THEN RAISE EXCEPTION 'Item "Agora" (dose única) não vence.'; END IF;
  IF v_estado = 'em_dia' THEN
    RAISE EXCEPTION 'O item vale até %: o pedido de renovação abre 2 horas antes do vencimento.',
      to_char(it.valida_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI');
  END IF;
  UPDATE public.prescricao_itens
     SET renovacao_pedida_em = coalesce(renovacao_pedida_em, now()), renovacao_pedida_por = coalesce(renovacao_pedida_por, private.meu_perfil_id())
   WHERE id = it.id
  RETURNING * INTO it;
  k := private.avisar_validade_item(it.id, 'pedido',
    'A enfermagem pede a renovação: ' || private.validade_item_rotulo(it.id)
    || CASE WHEN v_estado = 'vencido' THEN ', vencida às ' ELSE ', vence às ' END
    || to_char(it.valida_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.');
  PERFORM private.registrar_auditoria('renovacao_pedida', 'prescricao_itens', it.id, pr.unidade_id,
    jsonb_build_object('situacao', v_estado, 'quantidade', k));
  RETURN jsonb_build_object('avisados', k, 'pedida_em', it.renovacao_pedida_em);
END $$;
REVOKE ALL ON FUNCTION public.pedir_renovacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_renovacao(uuid) TO authenticated;

-- ── V4/V5: renovar (manter, alterar ou suspender, tudo de uma vez) ──────────
-- p_decisoes: [{item_id, acao: manter|alterar|suspender, mudancas?: {dose, via,
--   posologia, se_necessario, observacao}, motivo?}]. Cada item marcado; não
--   há "renovar tudo" no servidor nem na tela.
CREATE OR REPLACE FUNCTION public.renovar_prescricao(p_paciente uuid, p_decisoes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid; d jsonb; it public.prescricao_itens; pr public.prescricoes; novo public.prescricao_itens;
  val public.validacoes_prescricao; v_item jsonb; v_acao text; v_motivo text; v_novo uuid; v_presc uuid;
  v_res jsonb := '[]'::jsonb; n_m integer := 0; n_a integer := 0; n_s integer := 0;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  -- V5: o médico de plantão com o paciente, como no prescrever
  IF NOT coalesce(private.paciente_em_cuidado_no_plantao(p_paciente), false) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'A renovação é do médico de plantão no setor do paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF jsonb_typeof(p_decisoes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_decisoes) = 0 THEN
    RAISE EXCEPTION 'Marque manter, alterar ou suspender em cada item.';
  END IF;
  IF (SELECT count(DISTINCT x ->> 'item_id') FROM jsonb_array_elements(p_decisoes) x) <> jsonb_array_length(p_decisoes) THEN
    RAISE EXCEPTION 'Cada item entra uma vez só na renovação.';
  END IF;

  FOR d IN SELECT x FROM jsonb_array_elements(p_decisoes) x LOOP
    v_acao := d ->> 'acao';
    v_motivo := btrim(coalesce(d ->> 'motivo', ''));
    SELECT * INTO it FROM public.prescricao_itens WHERE id = nullif(d ->> 'item_id', '')::uuid FOR UPDATE;
    SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
    IF it.id IS NULL OR pr.paciente_id IS DISTINCT FROM p_paciente OR pr.status IS DISTINCT FROM 'ativa' THEN
      RAISE EXCEPTION 'Item fora da prescrição ativa deste paciente.';
    END IF;
    IF it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION '%: o item já foi suspenso.', it.descricao; END IF;
    -- V7: a contenção se renova pela própria ordem; o "Agora" não vence
    IF it.tipo = 'contencao' THEN
      RAISE EXCEPTION 'A contenção mecânica se renova pela própria ordem: prescreva a contenção de novo.';
    END IF;
    IF it.valida_ate IS NULL THEN RAISE EXCEPTION '%: item "Agora" (dose única) não vence.', it.descricao; END IF;
    v_presc := coalesce(v_presc, it.prescricao_id);

    IF v_acao = 'manter' THEN
      -- a anterior sai (fica guardada) e a nova passa pelas travas do prescrever
      UPDATE public.prescricao_itens
         SET suspenso_em = now(), suspenso_por = private.meu_perfil_id(), motivo_suspensao = 'Renovada: nova versão sem mudança'
       WHERE id = it.id;
      v_item := jsonb_build_object('tipo', it.tipo, 'medicamento_id', it.medicamento_id, 'descricao', it.descricao, 'dose', it.dose,
                                   'via', it.via, 'posologia', it.posologia, 'se_necessario', it.se_necessario, 'observacao', it.observacao);
      -- interação crítica já justificada: a justificativa segue (como no alterar)
      v_item := v_item || coalesce((SELECT jsonb_build_object('justificativa_interacao', 'Mantida da versão anterior: ' || a.justificativa)
                                      FROM public.alertas_interacao a WHERE a.item_id = it.id ORDER BY a.em DESC LIMIT 1), '{}'::jsonb);
      IF it.diluicao_divergente THEN
        v_item := v_item || jsonb_build_object('diluicao_divergente', it.diluicao_texto, 'justificativa_divergencia', it.justificativa_divergencia);
      END IF;
      v_novo := public.prescrever(pr.paciente_id, v_item);
      UPDATE public.prescricao_itens
         SET substitui_item_id = it.id, versao = it.versao + 1, motivo_alteracao = 'Renovada sem mudança',
             ordem = CASE WHEN prescricao_id = it.prescricao_id THEN it.ordem ELSE ordem END,
             horarios = it.horarios
       WHERE id = v_novo
      RETURNING * INTO novo;
      -- a validação da farmácia segue se nada mudou (a diluição vigente pode ter mudado)
      SELECT * INTO val FROM public.validacoes_prescricao WHERE item_id = it.id ORDER BY em DESC LIMIT 1;
      IF val.situacao = 'confere'
         AND novo.medicamento_id IS NOT DISTINCT FROM it.medicamento_id AND novo.dose IS NOT DISTINCT FROM it.dose
         AND upper(novo.via) IS NOT DISTINCT FROM upper(it.via) AND novo.posologia IS NOT DISTINCT FROM it.posologia
         AND novo.se_necessario = it.se_necessario AND novo.observacao IS NOT DISTINCT FROM it.observacao
         AND novo.diluicao_id IS NOT DISTINCT FROM it.diluicao_id AND novo.diluicao_versao IS NOT DISTINCT FROM it.diluicao_versao
         AND novo.diluicao_texto IS NOT DISTINCT FROM it.diluicao_texto AND novo.diluicao_divergente = it.diluicao_divergente THEN
        INSERT INTO public.validacoes_prescricao (item_id, unidade_id, situacao, motivo, farmaceutico_id, herdada_de)
        VALUES (novo.id, val.unidade_id, 'confere', NULL, val.farmaceutico_id, val.id);
      END IF;
      PERFORM private.registrar_auditoria('prescricao_item_renovado', 'prescricao_itens', novo.id, pr.unidade_id,
        jsonb_build_object('anterior', it.id, 'versao', novo.versao, 'situacao', 'mantido'));
      n_m := n_m + 1;
    ELSIF v_acao = 'alterar' THEN
      IF jsonb_typeof(d -> 'mudancas') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '%: diga o que muda.', it.descricao; END IF;
      v_novo := public.alterar_item_prescricao(it.id, d -> 'mudancas', v_motivo);
      n_a := n_a + 1;
    ELSIF v_acao = 'suspender' THEN
      PERFORM public.suspender_item(it.id, v_motivo);
      v_novo := NULL;
      n_s := n_s + 1;
    ELSE
      RAISE EXCEPTION 'Marque manter, alterar ou suspender em cada item.';
    END IF;
    v_res := v_res || jsonb_build_array(jsonb_build_object('item_id', it.id, 'acao', v_acao, 'novo_id', v_novo));
  END LOOP;
  PERFORM private.registrar_auditoria('renovar_prescricao', 'prescricoes', v_presc, v_unidade,
    jsonb_build_object('quantidade', jsonb_array_length(p_decisoes), 'situacao', 'renovacao'));
  RETURN jsonb_build_object('mantidos', n_m, 'alterados', n_a, 'suspensos', n_s, 'itens', v_res);
END $$;
REVOKE ALL ON FUNCTION public.renovar_prescricao(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renovar_prescricao(uuid, jsonb) TO authenticated;

-- ── funções trocadas trecho a trecho ────────────────────────────────────────
-- pula o que já foi trocado; trecho que sumiu (ou aparece mais de uma vez) para com erro.
-- Corpo gravado com quebra de linha CRLF continua CRLF (o rollback volta ao mesmo md5).
-- p_recriar: colunas novas no RETURNS TABLE pedem DROP e CREATE (os
-- privilégios voltam logo abaixo, como estavam).
CREATE OR REPLACE FUNCTION pg_temp.trocar_validade(f regprocedure, trechos text[], p_recriar boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
  v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
  v_nome text := f::text;
BEGIN
  FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
    v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
    v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
    IF position(v_novo IN def) > 0 THEN CONTINUE; END IF;
    IF position(v_ant IN def) = 0 THEN
      RAISE EXCEPTION '%: trecho não encontrado: %', f, v_ant;
    END IF;
    IF (length(def) - length(replace(def, v_ant, ''))) / length(v_ant) <> 1 THEN
      RAISE EXCEPTION '%: trecho aparece mais de uma vez: %', f, v_ant;
    END IF;
    def := replace(def, v_ant, v_novo);
    mudou := true;
  END LOOP;
  IF mudou THEN
    IF p_recriar THEN EXECUTE 'DROP FUNCTION ' || v_nome; END IF;
    EXECUTE def;
  END IF;
END $$;

-- checar (V2): o "feito" do item vencido é recusado
SELECT pg_temp.trocar_validade('public.checar(uuid, text, text, text)'::regprocedure, ARRAY[
  $a$  -- F5 (frequência da porta): "Agora" é dose única; o 2º "feito" é recusado
$a$,
  $b$  -- lacuna 6 (V2): prescrição vencida não se executa (Resolução COFEN 689/2022,
  -- art. 4º; serviço hospitalar: 24 h). "Não feito" e "recusado" seguem: não
  -- são execução, e fecham o horário que ficou para trás
  IF p_situacao = 'feito' AND it.valida_ate IS NOT NULL AND now() >= it.valida_ate THEN
    RAISE EXCEPTION 'Prescrição vencida às %: a enfermagem não executa prescrição fora da validade (Resolução COFEN 689/2022, art. 4º). Peça a renovação ao médico.',
      to_char(it.valida_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') USING ERRCODE = 'check_violation';
  END IF;
  -- F5 (frequência da porta): "Agora" é dose única; o 2º "feito" é recusado
$b$]);

-- dispensar_item (V2): item vencido não se dispensa
SELECT pg_temp.trocar_validade('public.dispensar_item(uuid, integer, text)'::regprocedure, ARRAY[
  $a$  IF pr.status <> 'ativa' OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'O item não está vigente (prescrição encerrada ou item suspenso).'; END IF;
$a$,
  $b$  IF pr.status <> 'ativa' OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'O item não está vigente (prescrição encerrada ou item suspenso).'; END IF;
  -- lacuna 6 (V2): item vencido não se dispensa (Resolução COFEN 689/2022, art. 4º)
  IF it.valida_ate IS NOT NULL AND now() >= it.valida_ate THEN
    RAISE EXCEPTION 'Prescrição vencida às %: não se dispensa item fora da validade (Resolução COFEN 689/2022, art. 4º). Peça a renovação ao médico.',
      to_char(it.valida_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') USING ERRCODE = 'check_violation';
  END IF;
$b$]);

-- doses_do_item (V2): nenhum horário a partir do vencimento
SELECT pg_temp.trocar_validade('private.doses_do_item(uuid)'::regprocedure, ARRAY[
  $a$    SELECT i.id, i.horarios, i.created_at,
$a$,
  $b$    SELECT i.id, i.horarios, i.created_at, i.valida_ate,
$b$,
  $a$    SELECT it.id, it.created_at, it.fim, h.h,$a$,
  $b$    SELECT it.id, it.created_at, it.fim, it.valida_ate, h.h,$b$,
  $a$     AND s.slot <= s.fim
$a$,
  $b$     AND s.slot <= s.fim
     -- lacuna 6 (V2): depois do vencimento não há horário (COFEN 689/2022, art. 4º)
     AND (s.valida_ate IS NULL OR s.slot < s.valida_ate)
$b$]);

-- painel_atendimento_ps (V6): a validade de cada item da porta
SELECT pg_temp.trocar_validade('public.painel_atendimento_ps(uuid)'::regprocedure, ARRAY[
  $a$           'horarios', coalesce(to_jsonb(it.horarios), '[]'::jsonb), 'doses', private.doses_do_item_json(it.id),
$a$,
  $b$           'horarios', coalesce(to_jsonb(it.horarios), '[]'::jsonb), 'doses', private.doses_do_item_json(it.id),
           'valida_ate', it.valida_ate, 'validade', private.validade_item(it.valida_ate), 'renovacao_pedida_em', it.renovacao_pedida_em,
$b$]);

-- fila_checagem (V2, V6): validade e pedido de renovação de cada item
SELECT pg_temp.trocar_validade('public.fila_checagem()'::regprocedure, ARRAY[
  $a$prescrito_em timestamp with time zone, por_horario jsonb)$a$,
  $b$prescrito_em timestamp with time zone, por_horario jsonb, valida_ate timestamp with time zone, validade text, renovacao_pedida_em timestamp with time zone)$b$,
  $a$                           ORDER BY a.registrado_em DESC LIMIT 1) ah ON true)
  FROM public.prescricoes pr
$a$,
  $b$                           ORDER BY a.registrado_em DESC LIMIT 1) ah ON true),
         -- lacuna 6 (V2): validade do item (COFEN 689/2022, art. 4º)
         it.valida_ate, private.validade_item(it.valida_ate), it.renovacao_pedida_em
  FROM public.prescricoes pr
$b$], true);
REVOKE ALL ON FUNCTION public.fila_checagem() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fila_checagem() TO authenticated, service_role;

-- fila_validacao (V2): validade de cada item
SELECT pg_temp.trocar_validade('public.fila_validacao(uuid)'::regprocedure, ARRAY[
  $a$ultima_situacao text, ultimo_motivo text)$a$,
  $b$ultima_situacao text, ultimo_motivo text, valida_ate timestamp with time zone, validade text)$b$,
  $a$         pf.nome_completo, it.created_at, v.situacao, v.motivo
  FROM public.prescricoes pr
$a$,
  $b$         pf.nome_completo, it.created_at, v.situacao, v.motivo,
         -- lacuna 6 (V2): validade do item (COFEN 689/2022, art. 4º)
         it.valida_ate, private.validade_item(it.valida_ate)
  FROM public.prescricoes pr
$b$], true);
REVOKE ALL ON FUNCTION public.fila_validacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fila_validacao(uuid) TO authenticated, service_role;

-- prescricao_vigente (V4, V6): validade e pedido de renovação
SELECT pg_temp.trocar_validade('public.prescricao_vigente(uuid, timestamptz)'::regprocedure, ARRAY[
  $a$validacao text, validacao_motivo text)$a$,
  $b$validacao text, validacao_motivo text, valida_ate timestamp with time zone, validade text, renovacao_pedida_em timestamp with time zone)$b$,
  $a$         coalesce(m.vasoativo, false), pf.nome_completo, i.created_at, i.suspenso_em, v.situacao, v.motivo
  FROM public.prescricao_itens i
$a$,
  $b$         coalesce(m.vasoativo, false), pf.nome_completo, i.created_at, i.suspenso_em, v.situacao, v.motivo,
         -- lacuna 6 (V2): validade do item (COFEN 689/2022, art. 4º)
         i.valida_ate, private.validade_item(i.valida_ate), i.renovacao_pedida_em
  FROM public.prescricao_itens i
$b$], true);
REVOKE ALL ON FUNCTION public.prescricao_vigente(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prescricao_vigente(uuid, timestamptz) TO authenticated, service_role;

-- prescricao_porta_ativa (V8): os itens da porta com a validade
SELECT pg_temp.trocar_validade('public.prescricao_porta_ativa(uuid)'::regprocedure, ARRAY[
  $a$horarios text[], episodio_id uuid)$a$,
  $b$horarios text[], episodio_id uuid, valida_ate timestamp with time zone, validade text, renovacao_pedida_em timestamp with time zone)$b$,
  $a$         coalesce(i.horarios, '{}'::text[]), pr.episodio_id
    FROM public.prescricoes pr
$a$,
  $b$         coalesce(i.horarios, '{}'::text[]), pr.episodio_id,
         -- lacuna 6 (V8): os itens da porta valem 24 h desde a prescrição
         i.valida_ate, private.validade_item(i.valida_ate), i.renovacao_pedida_em
    FROM public.prescricoes pr
$b$], true);
REVOKE ALL ON FUNCTION public.prescricao_porta_ativa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prescricao_porta_ativa(uuid) TO authenticated, service_role;

DROP FUNCTION pg_temp.trocar_validade(regprocedure, text[], boolean);

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (rodar inteiro; testado na homologação em transação desfeita):
--
-- CREATE OR REPLACE FUNCTION pg_temp.desfazer_validade(f regprocedure, trechos text[], p_recriar boolean DEFAULT false)
-- RETURNS void LANGUAGE plpgsql AS $$
-- DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
--   v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
--   v_nome text := f::text;
-- BEGIN
--   FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
--     v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
--     v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
--     IF position(v_novo IN def) > 0 THEN
--       def := replace(def, v_novo, v_ant);
--       mudou := true;
--     END IF;
--   END LOOP;
--   IF mudou THEN
--     IF p_recriar THEN EXECUTE 'DROP FUNCTION ' || v_nome; END IF;
--     EXECUTE def;
--   END IF;
-- END $$;
-- -- as oito chamadas pg_temp.trocar_validade acima, iguais, com o nome
-- -- pg_temp.desfazer_validade (os mesmos pares: ele troca o novo pelo antigo),
-- -- e os REVOKE/GRANT logo depois de cada uma das quatro recriadas
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'prescricao-validade-avisos';
-- DROP TRIGGER IF EXISTS trg_prescricao_item_validade ON public.prescricao_itens;
-- DROP TRIGGER IF EXISTS trg_prescricao_item_validade_guarda ON public.prescricao_itens;
-- DROP FUNCTION IF EXISTS public.renovar_prescricao(uuid, jsonb), public.pedir_renovacao(uuid),
--   private.prescricao_validade_avisar(), private.validade_item_rotulo(uuid), private.avisar_validade_item(uuid, text, text),
--   private.prescricao_local(public.prescricoes), private.prescricao_setor(public.prescricoes),
--   private.prescricao_validade_transicao(), private.prescricao_item_validade_guarda(), private.prescricao_item_validade(),
--   private.validade_item(timestamptz), private.item_e_agora(text);
-- -- colunas e índices: ficam (dado clínico: a validade de cada item e a
-- -- validação herdada) até uma janela declarada (contract).
-- ════════════════════════════════════════════════════════════════════════════
