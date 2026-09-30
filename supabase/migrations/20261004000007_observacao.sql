-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo — a sala de observação (Bloco 3).
--
-- O que já existia (fase 3): o desfecho "observação" abre a internação do
-- episódio no primeiro box livre com a pendência de 6 horas; a saída (alta ou
-- internação) resolve a pendência; passagem de plantão com aceite; alta com
-- impeditivos. Aqui entra o que o protótipo mostra no card do box:
--
--  * ESTADOS, todos derivados do banco (nada é marcado à mão):
--      Não atendido    — sem registro médico desde a entrada na observação;
--      Em atendimento  — com o primeiro registro médico (o "Atender" do card,
--                        ou a primeira admissão/evolução escrita por médico);
--      Em reavaliação  — com reavaliação marcada (pendência "reavaliacao"
--                        aberta, com hora; a mesma lista do leito aberto);
--      Encaminhado     — com encaminhamento interno aguardando o colega
--                        (encaminhamentos_internos, pendente) ou pendência de
--                        regulação aberta (aguarda vaga ou transferência);
--      Finalizado      — a observação terminou (alta, transferência, óbito
--                        ou internação), visível até o fim do meu plantão.
--  * os dois relógios: permanência contra as 6 horas (prazo da pendência) e
--    espera até o primeiro registro médico da observação;
--  * "Reavaliar às" → Em reavaliação; "Reavaliado" conclui;
--  * desfecho da observação no card (finalizar_observacao): alta médica, alta
--    após medicação, internação, transferência, evasão, alta a pedido e
--    óbito, usando dar_alta e registrar_evento_adt, que já existem. O relato
--    de 15 letras vale onde o protótipo pede (evasão, alta a pedido, óbito);
--    óbito pede a hora do óbito e o número da DO;
--  * protocolo no card: SÓ os que têm sequência com fonte. Do PROTO_OBS do
--    protótipo (DT, AVC, ASM, ASMp, CAD, DEN), cujas etapas eram "modelo de
--    processo, o gestor substitui", entra apenas a dengue, pelo manual do MS
--    2024 que o app já usa (src/clinico/dengue.ts). Cada etapa concluída fica
--    registrada (quem, quando); encerrar pede motivo de 15 letras.
--
-- Fora (decisão registrada): o PEWS de Brighton manual do protótipo. O app
-- decidiu o Bedside PEWS / HQSC 2023 (RETOMADA, "Suas decisões desta fase"),
-- calculado no servidor (acuidade); o card mostra esse.
--
-- Tabelas novas entram na guarda de 20 anos (sem DELETE). Escrita só pelas
-- RPCs, todas com segundo fator. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. catálogo de protocolos da observação (só com fonte) ──────────────────
CREATE TABLE IF NOT EXISTS public.protocolos_observacao (
  sigla   text PRIMARY KEY,
  nome    text NOT NULL,
  publico text NOT NULL CHECK (publico IN ('todos', 'adulto', 'pediatrico')),
  -- [{ "texto": "...", "referencia": "p. 27" }]: etapas de processo, sem dose
  etapas  jsonb NOT NULL CHECK (jsonb_typeof(etapas) = 'array' AND jsonb_array_length(etapas) >= 2),
  fonte   text NOT NULL CHECK (length(btrim(fonte)) >= 20),
  url     text,
  versao  text NOT NULL,
  ativo   boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE public.protocolos_observacao IS
  'Protocolos que marcam o paciente na observação. Só entra protocolo cuja sequência tem fonte declarada.';
ALTER TABLE public.protocolos_observacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.protocolos_observacao FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.protocolos_observacao FROM authenticated;
GRANT SELECT ON public.protocolos_observacao TO authenticated;
DROP POLICY IF EXISTS protocolos_observacao_select ON public.protocolos_observacao;
CREATE POLICY protocolos_observacao_select ON public.protocolos_observacao FOR SELECT TO authenticated USING (true);

-- Dengue: a sequência do fluxograma do manual (classificar no grupo, conduzir
-- a hidratação do grupo, reavaliar com os exames do grupo, decidir alta ou
-- internação pelos critérios do manual). Doses e volumes ficam na ficha da
-- dengue (Ferramentas), não aqui.
INSERT INTO public.protocolos_observacao (sigla, nome, publico, etapas, fonte, url, versao)
VALUES ('DEN', 'Dengue', 'todos',
  '[{"texto": "Classificação no grupo A, B, C ou D", "referencia": "Figura 2, p. 27"},
    {"texto": "Hidratação conforme o grupo", "referencia": "Quadro 3, p. 30; p. 33–36"},
    {"texto": "Reavaliação clínica e exames conforme o grupo", "referencia": "p. 28–37"},
    {"texto": "Decisão: alta, internação ou transferência", "referencia": "Critérios de internação e alta, p. 43"}]'::jsonb,
  'Ministério da Saúde. Dengue: diagnóstico e manejo clínico — adulto e criança. 6ª ed. Brasília: MS/SVSA; 2024.',
  'https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/svsa/dengue/dengue-diagnostico-e-manejo-clinico-adulto-e-crianca',
  '2026-10-04.1')
ON CONFLICT (sigla) DO UPDATE
  SET nome = EXCLUDED.nome, publico = EXCLUDED.publico, etapas = EXCLUDED.etapas,
      fonte = EXCLUDED.fonte, url = EXCLUDED.url, versao = EXCLUDED.versao, ativo = true;

-- ── 2. protocolo aberto no paciente e as etapas cumpridas ───────────────────
CREATE TABLE IF NOT EXISTS public.observacao_protocolos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id       uuid NOT NULL REFERENCES public.internacoes(id),
  sigla               text NOT NULL REFERENCES public.protocolos_observacao(sigla),
  -- retrato do catálogo no início: mudar o catálogo não reescreve a história
  nome                text NOT NULL,
  versao              text NOT NULL,
  fonte               text NOT NULL,
  etapas              jsonb NOT NULL,
  etapa_atual         int NOT NULL DEFAULT 0 CHECK (etapa_atual >= 0),
  iniciado_por        uuid NOT NULL REFERENCES public.perfis(id),
  iniciado_em         timestamptz NOT NULL DEFAULT now(),
  encerrado_em        timestamptz,
  encerrado_por       uuid REFERENCES public.perfis(id),
  motivo_encerramento text,
  CONSTRAINT observacao_protocolos_encerramento CHECK (
    encerrado_em IS NULL OR (encerrado_por IS NOT NULL AND length(btrim(coalesce(motivo_encerramento, ''))) >= 15))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_observacao_protocolo_aberto ON public.observacao_protocolos (internacao_id) WHERE encerrado_em IS NULL;

CREATE TABLE IF NOT EXISTS public.observacao_protocolo_etapas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id   uuid NOT NULL REFERENCES public.observacao_protocolos(id),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  etapa          int NOT NULL CHECK (etapa >= 0),
  texto          text NOT NULL,
  registrado_por uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (protocolo_id, etapa)
);
DROP TRIGGER IF EXISTS trg_observacao_protocolo_etapas_so_insercao ON public.observacao_protocolo_etapas;
CREATE TRIGGER trg_observacao_protocolo_etapas_so_insercao BEFORE UPDATE ON public.observacao_protocolo_etapas
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

-- ── 3. marcos da observação: atendimento e reavaliação ──────────────────────
CREATE TABLE IF NOT EXISTS public.observacao_eventos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id  uuid NOT NULL REFERENCES public.internacoes(id),
  tipo           text NOT NULL CHECK (tipo IN ('atendimento', 'reavaliacao_marcada', 'reavaliado')),
  reavaliar_em   timestamptz,
  pendencia_id   uuid REFERENCES public.pendencias(id),
  autor_id       uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS observacao_eventos_internacao ON public.observacao_eventos (internacao_id, tipo, registrado_em);
DROP TRIGGER IF EXISTS trg_observacao_eventos_so_insercao ON public.observacao_eventos;
CREATE TRIGGER trg_observacao_eventos_so_insercao BEFORE UPDATE ON public.observacao_eventos
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

-- ── 4. leitura (as mesmas regras do prontuário) e guarda ────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['observacao_protocolos', 'observacao_protocolo_etapas', 'observacao_eventos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_select ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_select ON public.%1$I FOR SELECT TO authenticated
      USING (private.papel_na_unidade(unidade_id) = ''gestor'' OR private.paciente_no_meu_plantao(paciente_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_segundo_fator ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_segundo_fator ON public.%1$I AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok())', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_pedido_acesso ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_pedido_acesso ON public.%1$I FOR SELECT TO authenticated
      USING (private.acesso_encerrado_vigente(paciente_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_teleinterconsulta ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_teleinterconsulta ON public.%1$I FOR SELECT TO authenticated
      USING (private.teleinterconsulta_vigente(paciente_id))', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica()', t);
  END LOOP;
END $$;

-- ── 5. auxiliares ───────────────────────────────────────────────────────────
-- Setor de observação, pela mesma regra de setores_observacao (a sala
-- vermelha, mesmo com tipo observação, é do painel de internação).
CREATE OR REPLACE FUNCTION private.setor_de_observacao(p_setor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.setores s WHERE s.id = p_setor AND s.tipo = 'observacao'
                   AND NOT (position('verm' in lower(s.nome)) > 0))
$$;

-- A internação está na observação e eu cuido dela (escala no setor agora).
CREATE OR REPLACE FUNCTION private.observacao_para_mim(p_internacao uuid, p_medico boolean)
RETURNS public.internacoes LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') OR NOT private.setor_de_observacao(i.setor_atual_id) THEN
    RAISE EXCEPTION 'O paciente não está na observação.';
  END IF;
  IF NOT private.cuido_da_internacao(i) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.';
  END IF;
  IF p_medico AND private.tenho_papel(i.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'Esta ação é do médico.';
  END IF;
  RETURN i;
END $$;

-- Primeiro registro médico da observação: o "Atender" do card ou a primeira
-- admissão/evolução escrita por médico nesta internação.
CREATE OR REPLACE FUNCTION private.primeiro_registro_observacao(p_internacao uuid)
RETURNS TABLE (em timestamptz, autor_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT x.em, x.autor_id FROM (
    SELECT e.registrado_em AS em, e.autor_id
      FROM public.observacao_eventos e
     WHERE e.internacao_id = p_internacao AND e.tipo = 'atendimento'
    UNION ALL
    SELECT d.created_at, d.autor_id
      FROM public.documentos_clinicos d
      JOIN public.vinculos v ON v.perfil_id = d.autor_id AND v.unidade_id = d.unidade_id AND v.papel::text = 'plantonista'
     WHERE d.internacao_id = p_internacao AND d.versao = 1
       AND d.tipo_documento IN ('admissao_anamnese', 'evolucao')
  ) x ORDER BY x.em LIMIT 1
$$;

-- ── 6. atender, reavaliar, reavaliado ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.observacao_atender(p_internacao uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM 1 FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  i := private.observacao_para_mim(p_internacao, true);
  IF EXISTS (SELECT 1 FROM private.primeiro_registro_observacao(i.id)) THEN
    RAISE EXCEPTION 'O primeiro atendimento desta observação já foi registrado.';
  END IF;
  INSERT INTO public.observacao_eventos (unidade_id, paciente_id, internacao_id, tipo, autor_id)
  VALUES (i.unidade_id, i.paciente_id, i.id, 'atendimento', private.meu_perfil_id());
END $$;

CREATE OR REPLACE FUNCTION public.observacao_reavaliar(p_internacao uuid, p_quando timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes; v_pend uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM 1 FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  i := private.observacao_para_mim(p_internacao, true);
  IF p_quando IS NULL THEN RAISE EXCEPTION 'Informe a hora da reavaliação.'; END IF;
  IF p_quando <= now() THEN RAISE EXCEPTION 'A hora da reavaliação já passou.'; END IF;
  IF p_quando > now() + interval '12 hours' THEN RAISE EXCEPTION 'Reavaliação com mais de 12 horas: não é observação.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.primeiro_registro_observacao(i.id)) THEN
    RAISE EXCEPTION 'Registre o atendimento antes de marcar a reavaliação.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pendencias WHERE internacao_id = i.id AND tipo = 'reavaliacao' AND situacao = 'aberta') THEN
    RAISE EXCEPTION 'Já há reavaliação marcada para este paciente.';
  END IF;
  INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, prazo, impeditiva, autor_id)
  VALUES (i.unidade_id, i.paciente_id, i.id, 'reavaliacao',
          'Reavaliar às ' || to_char(p_quando AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), p_quando, false, private.meu_perfil_id())
  RETURNING id INTO v_pend;
  INSERT INTO public.observacao_eventos (unidade_id, paciente_id, internacao_id, tipo, reavaliar_em, pendencia_id, autor_id)
  VALUES (i.unidade_id, i.paciente_id, i.id, 'reavaliacao_marcada', p_quando, v_pend, private.meu_perfil_id());
  RETURN v_pend;
END $$;

CREATE OR REPLACE FUNCTION public.observacao_reavaliado(p_internacao uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes; v_pend uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM 1 FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  i := private.observacao_para_mim(p_internacao, true);
  SELECT id INTO v_pend FROM public.pendencias
   WHERE internacao_id = i.id AND tipo = 'reavaliacao' AND situacao = 'aberta' ORDER BY prazo NULLS LAST LIMIT 1;
  IF v_pend IS NULL THEN RAISE EXCEPTION 'Não há reavaliação marcada.'; END IF;
  UPDATE public.pendencias
     SET situacao = 'concluida', resolvida_em = now(), resolvida_por = private.meu_perfil_id(), motivo_resolucao = 'Reavaliado'
   WHERE internacao_id = i.id AND tipo = 'reavaliacao' AND situacao = 'aberta';
  INSERT INTO public.observacao_eventos (unidade_id, paciente_id, internacao_id, tipo, pendencia_id, autor_id)
  VALUES (i.unidade_id, i.paciente_id, i.id, 'reavaliado', v_pend, private.meu_perfil_id());
END $$;

-- ── 7. protocolo: iniciar, avançar, encerrar ────────────────────────────────
CREATE OR REPLACE FUNCTION public.observacao_iniciar_protocolo(p_internacao uuid, p_sigla text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes; pr public.protocolos_observacao; v_publico text; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM 1 FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  i := private.observacao_para_mim(p_internacao, true);
  SELECT * INTO pr FROM public.protocolos_observacao WHERE sigla = p_sigla AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo desconhecido.'; END IF;
  IF pr.publico <> 'todos' THEN
    SELECT CASE WHEN pa.data_nascimento > (now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '14 years'
                THEN 'pediatrico' ELSE 'adulto' END
      INTO v_publico FROM public.pacientes pa WHERE pa.id = i.paciente_id;
    IF v_publico IS DISTINCT FROM pr.publico THEN RAISE EXCEPTION 'Este protocolo não é para a idade do paciente.'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.observacao_protocolos WHERE internacao_id = i.id AND encerrado_em IS NULL) THEN
    RAISE EXCEPTION 'Já há protocolo aberto para este paciente. Encerre-o antes.';
  END IF;
  INSERT INTO public.observacao_protocolos (unidade_id, paciente_id, internacao_id, sigla, nome, versao, fonte, etapas, iniciado_por)
  VALUES (i.unidade_id, i.paciente_id, i.id, pr.sigla, pr.nome, pr.versao, pr.fonte, pr.etapas, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Cumprir a etapa atual: fica registrado quem e quando; a última etapa não
-- "avança": o protocolo se encerra com motivo (ou com o desfecho).
CREATE OR REPLACE FUNCTION public.observacao_avancar_protocolo(p_protocolo uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pr public.observacao_protocolos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pr FROM public.observacao_protocolos WHERE id = p_protocolo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo não encontrado.'; END IF;
  PERFORM private.observacao_para_mim(pr.internacao_id, false);
  IF pr.encerrado_em IS NOT NULL THEN RAISE EXCEPTION 'Protocolo encerrado.'; END IF;
  IF pr.etapa_atual >= jsonb_array_length(pr.etapas) - 1 THEN
    RAISE EXCEPTION 'Esta é a última etapa: encerre o protocolo com o motivo.';
  END IF;
  INSERT INTO public.observacao_protocolo_etapas (protocolo_id, unidade_id, paciente_id, etapa, texto, registrado_por)
  VALUES (pr.id, pr.unidade_id, pr.paciente_id, pr.etapa_atual, pr.etapas -> pr.etapa_atual ->> 'texto', private.meu_perfil_id());
  UPDATE public.observacao_protocolos SET etapa_atual = pr.etapa_atual + 1 WHERE id = pr.id;
END $$;

CREATE OR REPLACE FUNCTION public.observacao_encerrar_protocolo(p_protocolo uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pr public.observacao_protocolos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pr FROM public.observacao_protocolos WHERE id = p_protocolo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo não encontrado.'; END IF;
  PERFORM private.observacao_para_mim(pr.internacao_id, true);
  IF pr.encerrado_em IS NOT NULL THEN RAISE EXCEPTION 'Protocolo já encerrado.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 15 THEN
    RAISE EXCEPTION 'Para encerrar o protocolo, justifique (mínimo de 15 letras).';
  END IF;
  UPDATE public.observacao_protocolos
     SET encerrado_em = now(), encerrado_por = private.meu_perfil_id(), motivo_encerramento = btrim(p_motivo)
   WHERE id = pr.id;
END $$;

-- ── 8. desfecho da observação ───────────────────────────────────────────────
-- Os desfechos do protótipo (DESFECHOS_PS sem "Observação") sobre as RPCs que
-- já existem: alta → dar_alta (CID, impeditivos, DO no óbito); internação →
-- registrar_evento_adt (o gatilho resolve a observação e libera o box).
CREATE OR REPLACE FUNCTION public.finalizar_observacao(
  p_internacao uuid, p_desfecho text, p_cid text DEFAULT NULL, p_relato text DEFAULT NULL, p_detalhes jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_relato text := nullif(btrim(coalesce(p_relato, '')), '');
  v_tipo text;
  v_setor uuid;
  v_leito uuid;
  v_hora timestamptz;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM 1 FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  i := private.observacao_para_mim(p_internacao, true);
  IF p_desfecho NOT IN ('alta_medica', 'alta_apos_medicacao', 'internacao', 'transferencia', 'evasao', 'alta_a_pedido', 'obito') THEN
    RAISE EXCEPTION 'Desfecho desconhecido.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.passagens_plantao WHERE internacao_id = i.id AND situacao = 'aguardando') THEN
    RAISE EXCEPTION 'Há passagem de plantão aguardando aceite. Retire a passagem antes de finalizar.';
  END IF;
  IF p_desfecho IN ('evasao', 'alta_a_pedido', 'obito') AND length(coalesce(v_relato, '')) < 15 THEN
    RAISE EXCEPTION '%', CASE p_desfecho
      WHEN 'evasao' THEN 'Como e quando foi percebida a evasão: escreva ao menos 15 letras.'
      WHEN 'alta_a_pedido' THEN 'Riscos explicados e termo assinado: escreva ao menos 15 letras.'
      ELSE 'Circunstâncias do óbito e medidas realizadas: escreva ao menos 15 letras.' END;
  END IF;
  d := d || jsonb_build_object('desfecho_observacao', p_desfecho);

  -- quem sai da observação sai do protocolo junto
  UPDATE public.observacao_protocolos
     SET encerrado_em = now(), encerrado_por = private.meu_perfil_id(),
         motivo_encerramento = 'Encerrado com o desfecho da observação'
   WHERE internacao_id = i.id AND encerrado_em IS NULL;

  IF p_desfecho = 'internacao' THEN
    v_setor := nullif(d ->> 'setor_id', '')::uuid;
    v_leito := nullif(d ->> 'leito_id', '')::uuid;
    IF v_setor IS NULL OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = v_setor AND unidade_id = i.unidade_id
                                        AND ativo AND (tipo IN ('internacao', 'uti', 'isolamento')
                                          OR (tipo = 'observacao' AND position('verm' in lower(nome)) > 0))) THEN
      RAISE EXCEPTION 'Escolha o setor de internação.';
    END IF;
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status = 'livre') THEN
      RAISE EXCEPTION 'O leito escolhido não está livre neste setor.';
    END IF;
    PERFORM public.registrar_evento_adt(i.id, 'internacao', v_setor, v_leito, coalesce(v_relato, 'Desfecho da observação'), d);
    UPDATE public.pacientes SET setor_id = v_setor, updated_at = now() WHERE id = i.paciente_id;
    RETURN;
  END IF;

  v_tipo := CASE p_desfecho
    WHEN 'alta_medica' THEN 'alta_melhorada'
    WHEN 'alta_apos_medicacao' THEN 'alta_melhorada'
    WHEN 'transferencia' THEN 'transferencia_externa'
    WHEN 'evasao' THEN 'alta_evasao'
    WHEN 'alta_a_pedido' THEN 'alta_pedido'
    ELSE 'obito' END;
  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o serviço de destino.';
  END IF;
  IF p_desfecho = 'obito' THEN
    v_hora := nullif(d ->> 'hora_obito', '')::timestamptz;
    IF v_hora IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
    IF v_hora > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
    IF v_hora < i.data_admissao THEN RAISE EXCEPTION 'Hora do óbito antes da entrada.'; END IF;
  END IF;
  -- a alta é registrada agora; a hora do óbito vai nos detalhes, como na porta
  PERFORM public.dar_alta(i.id, v_tipo, p_cid, NULL, NULL, v_relato, d);
END $$;

-- ── 9. o painel: a lista da observação, com o estado derivado ───────────────
-- Gestor: todos os setores de observação da unidade, finalizados das últimas
-- 12 horas. Plantonista: os setores de observação da escala dele agora,
-- finalizados desde o começo do plantão em curso.
CREATE OR REPLACE FUNCTION public.painel_observacao(p_unidade uuid)
RETURNS TABLE (
  internacao_id uuid, paciente_id uuid, episodio_id uuid, nome text, data_nascimento date, sexo text,
  setor_id uuid, setor_nome text, box text, queixa text, cor text,
  entrada timestamptz, prazo timestamptz,
  primeiro_atendimento_em timestamptz, primeiro_atendimento_por text,
  reavaliar_em timestamptz, encaminhado boolean,
  estado text, finalizado_em timestamptz, desfecho text,
  protocolo jsonb, passagem jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_gestor boolean := private.papel_na_unidade(p_unidade) = 'gestor';
  v_setores uuid[];
  v_desde timestamptz;
BEGIN
  IF private.membro_da_unidade(p_unidade) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF v_gestor THEN
    SELECT array_agg(s.id) INTO v_setores FROM public.setores s
     WHERE s.unidade_id = p_unidade AND s.ativo AND private.setor_de_observacao(s.id);
    v_desde := now() - interval '12 hours';
  ELSE
    SELECT array_agg(DISTINCT p.setor_id), min(p.inicio) INTO v_setores, v_desde
      FROM private.plantoes_agora() p
     WHERE p.unidade_id = p_unidade AND private.setor_de_observacao(p.setor_id)
       AND p.setor_id IN (SELECT private.setores_na_escala_agora());
  END IF;
  IF v_setores IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH cand AS (
    -- ativos em setor de observação
    SELECT i.id, i.setor_atual_id AS setor_obs
      FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
       AND i.setor_atual_id = ANY (v_setores)
    UNION
    -- a observação terminou há pouco (o setor é o da entrada na observação)
    SELECT i.id, coalesce(ent.setor, i.setor_atual_id)
      FROM public.pendencias pe
      JOIN public.internacoes i ON i.id = pe.internacao_id
      LEFT JOIN LATERAL (
        SELECT (e.estado_depois ->> 'setor')::uuid AS setor FROM public.eventos_adt e
         WHERE e.internacao_id = i.id AND e.estado_depois ->> 'status' = 'em_observacao'
         ORDER BY e.seq DESC LIMIT 1) ent ON true
     WHERE pe.unidade_id = p_unidade AND pe.tipo = 'observacao' AND pe.situacao <> 'aberta'
       AND pe.resolvida_em >= v_desde
       AND coalesce(ent.setor, i.setor_atual_id) = ANY (v_setores)
       AND NOT (i.status IN ('admitido', 'em_observacao', 'internado') AND private.setor_de_observacao(i.setor_atual_id))
  ), base AS (
    SELECT i.*, c.setor_obs,
           (i.status IN ('admitido', 'em_observacao', 'internado') AND private.setor_de_observacao(i.setor_atual_id)) AS ativa,
           po.criada_em AS po_criada, po.prazo AS po_prazo, po.resolvida_em AS po_resolvida
      FROM cand c
      JOIN public.internacoes i ON i.id = c.id
      LEFT JOIN LATERAL (
        SELECT x.criada_em, x.prazo, x.resolvida_em FROM public.pendencias x
         WHERE x.internacao_id = i.id AND x.tipo = 'observacao'
         ORDER BY (x.situacao = 'aberta') DESC, x.criada_em DESC LIMIT 1) po ON true
  )
  SELECT b.id, b.paciente_id, b.episodio_id, pa.nome, pa.data_nascimento, pa.sexo,
         b.setor_obs, s.nome,
         CASE WHEN b.ativa THEN l.identificador
              ELSE (SELECT lx.identificador FROM public.eventos_adt ex JOIN public.leitos lx ON lx.id = (ex.estado_antes ->> 'leito')::uuid
                     WHERE ex.internacao_id = b.id AND ex.estado_antes ->> 'status' = 'em_observacao'
                     ORDER BY ex.seq DESC LIMIT 1) END,
         ep.queixa, ep.cor_atual,
         coalesce(b.po_criada, b.data_entrada_setor, b.data_admissao),
         coalesce(b.po_prazo, coalesce(b.po_criada, b.data_entrada_setor, b.data_admissao) + interval '6 hours'),
         pr.em, (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = pr.autor_id),
         rv.prazo,
         enc.sim,
         CASE WHEN NOT b.ativa THEN 'finalizado'
              WHEN enc.sim THEN 'encaminhado'
              WHEN rv.prazo IS NOT NULL OR rv.existe THEN 'reavaliacao'
              WHEN pr.em IS NOT NULL THEN 'atendimento'
              ELSE 'nao' END,
         CASE WHEN b.ativa THEN NULL ELSE coalesce(b.po_resolvida, b.data_alta) END,
         CASE WHEN b.ativa THEN NULL
              WHEN b.status = 'internado' OR b.status = 'admitido' THEN 'internacao'
              WHEN b.alta_detalhes ->> 'desfecho_observacao' IS NOT NULL THEN b.alta_detalhes ->> 'desfecho_observacao'
              ELSE CASE b.status WHEN 'alta_melhorada' THEN 'alta_medica' WHEN 'transferencia_externa' THEN 'transferencia'
                                 WHEN 'alta_evasao' THEN 'evasao' WHEN 'alta_pedido' THEN 'alta_a_pedido' ELSE b.status END END,
         (SELECT jsonb_build_object('id', op.id, 'sigla', op.sigla, 'nome', op.nome, 'versao', op.versao, 'fonte', op.fonte,
                   'etapas', op.etapas, 'etapa_atual', op.etapa_atual, 'iniciado_em', op.iniciado_em,
                   'iniciado_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = op.iniciado_por),
                   'historico', coalesce((SELECT jsonb_agg(jsonb_build_object('etapa', et.etapa, 'texto', et.texto, 'em', et.registrado_em,
                                   'por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = et.registrado_por)) ORDER BY et.etapa)
                                FROM public.observacao_protocolo_etapas et WHERE et.protocolo_id = op.id), '[]'::jsonb))
            FROM public.observacao_protocolos op WHERE op.internacao_id = b.id AND op.encerrado_em IS NULL),
         (SELECT jsonb_build_object('id', pp.id, 'situacao', pp.situacao, 'resumo', pp.resumo,
                   'de_perfil', pp.de_perfil, 'de_nome', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = pp.de_perfil),
                   'para_perfil', pp.para_perfil, 'para_nome', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = pp.para_perfil),
                   'enviada_em', pp.enviada_em, 'respondida_em', pp.respondida_em, 'motivo_recusa', pp.motivo_recusa)
            FROM public.passagens_plantao pp WHERE pp.internacao_id = b.id AND pp.situacao <> 'retirada'
            ORDER BY pp.enviada_em DESC LIMIT 1)
    FROM base b
    JOIN public.pacientes pa ON pa.id = b.paciente_id
    JOIN public.setores s ON s.id = b.setor_obs
    LEFT JOIN public.leitos l ON l.id = b.leito_atual_id
    LEFT JOIN public.episodios ep ON ep.id = b.episodio_id
    LEFT JOIN LATERAL (SELECT f.em, f.autor_id FROM private.primeiro_registro_observacao(b.id) f) pr ON true
    LEFT JOIN LATERAL (SELECT min(x.prazo) AS prazo, count(*) > 0 AS existe FROM public.pendencias x
                        WHERE x.internacao_id = b.id AND x.tipo = 'reavaliacao' AND x.situacao = 'aberta') rv ON true
    -- encaminhado: regulação aberta ou encaminhamento interno aguardando o colega
    LEFT JOIN LATERAL (SELECT (EXISTS (SELECT 1 FROM public.pendencias x WHERE x.internacao_id = b.id AND x.tipo = 'regulacao' AND x.situacao = 'aberta')
                            OR EXISTS (SELECT 1 FROM public.encaminhamentos_internos ei WHERE ei.estado = 'pendente'
                                         AND (ei.internacao_id = b.id OR (b.episodio_id IS NOT NULL AND ei.episodio_id = b.episodio_id)))) AS sim) enc ON true
   ORDER BY (NOT b.ativa), coalesce(b.po_prazo, b.data_admissao + interval '6 hours');
END $$;

-- ── 10. permissões ──────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.setor_de_observacao(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.observacao_para_mim(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.primeiro_registro_observacao(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.observacao_atender(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.observacao_reavaliar(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.observacao_reavaliado(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.observacao_iniciar_protocolo(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.observacao_avancar_protocolo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.observacao_encerrar_protocolo(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalizar_observacao(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.painel_observacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.observacao_atender(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.observacao_reavaliar(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.observacao_reavaliado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.observacao_iniciar_protocolo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.observacao_avancar_protocolo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.observacao_encerrar_protocolo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_observacao(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.painel_observacao(uuid) TO authenticated;
