-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend, onda 4 — encaminhamento interno e avaliação/curva de
-- crescimento (protótipo, etapas 9 e 10: manual 3.11, 3.12 e 3.13).
--
-- 1. Aferição antropométrica: conceitos globais 'estatura' e
--    'perimetro-cefalico' (o 'peso' já existia) e a RPC que lança peso,
--    estatura e PC em public.observacao, que é de onde a curva lê.
-- 2. Avaliação por escala: NIPS e FLACC (pediatria), Braden e Morse (adulto).
--    O servidor refaz a soma e a leitura pela faixa da própria escala
--    (private.escala_avaliacao — os mesmos itens de
--    src/clinico/crescimento/escalasAvaliacao.ts). Fugulin fica fora (faixas do
--    protótipo divergem do artigo; o protótipo manda conferir). Cancelar pede
--    motivo; nada se apaga.
-- 3. Encaminhamento interno: o médico passa o paciente para outra
--    especialidade, médico ou serviço DA UNIDADE. Pendente → aceito (quem
--    recebe assume o atendimento) ou recusado (motivo ≥ 10) → atendido; ou
--    cancelado por quem encaminhou (motivo ≥ 10; é o "excluir" do protótipo,
--    que aqui não apaga). Exames sem resultado, medicação sem checagem e
--    pendência impeditiva da internação IMPEDEM encaminhar (protótipo,
--    pendAtd). Um pendente por paciente.
--    Quem responde: o médico de destino, se foi escolhido; senão qualquer
--    plantonista que esteja com o paciente no plantão, menos quem encaminhou.
--
-- Tabelas novas: RLS, escrita só por RPC (SECURITY DEFINER, search_path
-- vazio, segundo fator), sem DELETE (guarda de 20 anos, 20261001000004).
-- Reaplicável: IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR REPLACE.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. conceitos da curva de crescimento ────────────────────────────────────
INSERT INTO public.conceito (id, unidade_id, nome, tipo, unidade_padrao, ref_min, ref_max, ordem_exibicao, categoria)
VALUES
  (private.uuid_conceito('estatura'), NULL, 'estatura', 'numerico', 'cm', NULL, NULL, 91, 'sinal_vital'),
  (private.uuid_conceito('perimetro-cefalico'), NULL, 'perimetro-cefalico', 'numerico', 'cm', NULL, NULL, 92, 'sinal_vital')
ON CONFLICT DO NOTHING;  -- unidade_id nulo: a UNIQUE (unidade_id, nome) não pega; o id fixo, sim
-- LOINC só se o código estiver carregado (a FK exige): 8302-2 estatura, 9843-4 PC
UPDATE public.conceito c SET loinc_codigo = v.cod
  FROM (VALUES ('estatura', '8302-2'), ('perimetro-cefalico', '9843-4')) v(nome, cod)
 WHERE c.nome = v.nome AND c.unidade_id IS NULL AND c.loinc_codigo IS NULL
   AND EXISTS (SELECT 1 FROM terminologia.loinc l WHERE l.codigo = v.cod);

-- atendimento do paciente: o episódio/internação informados precisam ser dele
-- e estar abertos; sem nenhum, usa o episódio aberto ou a internação aberta.
CREATE OR REPLACE FUNCTION private.atendimento_do_paciente(p_paciente uuid, p_episodio uuid, p_internacao uuid, p_exigir boolean)
RETURNS TABLE (episodio_id uuid, internacao_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ep uuid := p_episodio; v_int uuid := p_internacao;
BEGIN
  IF v_ep IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = v_ep AND e.paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'O atendimento informado não é deste paciente.';
  END IF;
  IF v_int IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = v_int AND i.paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'A internação informada não é deste paciente.';
  END IF;
  IF v_ep IS NULL AND v_int IS NULL THEN
    SELECT e.id INTO v_ep FROM public.episodios e WHERE e.paciente_id = p_paciente AND e.etapa <> 'encerrado';
    IF v_ep IS NULL THEN
      SELECT i.id INTO v_int FROM public.internacoes i WHERE i.paciente_id = p_paciente AND i.data_alta IS NULL
       ORDER BY i.data_admissao DESC LIMIT 1;
    END IF;
  END IF;
  IF v_ep IS NULL AND v_int IS NULL AND p_exigir THEN
    RAISE EXCEPTION 'O paciente não tem atendimento nem internação em aberto.';
  END IF;
  RETURN QUERY SELECT v_ep, v_int;
END $$;
REVOKE ALL ON FUNCTION private.atendimento_do_paciente(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ── 2. aferição de peso, estatura e PC ──────────────────────────────────────
-- Data do dia (protótipo: "Data"): hoje grava a hora de agora; dia anterior
-- grava 12h (a caderneta traz o dia, não a hora). Não aceita data futura nem
-- anterior ao nascimento. Limites só de digitação (não são faixa clínica).
CREATE OR REPLACE FUNCTION public.registrar_afericao_crescimento(
  p_paciente uuid, p_data date, p_peso numeric DEFAULT NULL, p_estatura numeric DEFAULT NULL, p_pc numeric DEFAULT NULL,
  p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes; v_em timestamptz; v_ep uuid; v_int uuid; n int := 0; r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data da aferição.'; END IF;
  IF p_data > private.data_atual() THEN RAISE EXCEPTION 'A data da aferição não pode ser futura.'; END IF;
  IF pa.data_nascimento IS NOT NULL AND p_data < pa.data_nascimento THEN
    RAISE EXCEPTION 'A data da aferição é anterior ao nascimento.';
  END IF;
  IF p_peso IS NULL AND p_estatura IS NULL AND p_pc IS NULL THEN
    RAISE EXCEPTION 'Informe ao menos peso, estatura ou perímetro cefálico.';
  END IF;
  IF p_peso IS NOT NULL AND NOT (p_peso > 0 AND p_peso <= 300) THEN RAISE EXCEPTION 'Peso fora do possível (kg).'; END IF;
  IF p_estatura IS NOT NULL AND NOT (p_estatura > 0 AND p_estatura <= 250) THEN RAISE EXCEPTION 'Estatura fora do possível (cm).'; END IF;
  IF p_pc IS NOT NULL AND NOT (p_pc > 0 AND p_pc <= 80) THEN RAISE EXCEPTION 'Perímetro cefálico fora do possível (cm).'; END IF;
  SELECT a.episodio_id, a.internacao_id INTO v_ep, v_int FROM private.atendimento_do_paciente(p_paciente, p_episodio, p_internacao, false) a;
  v_em := CASE WHEN p_data = private.data_atual() THEN now()
               ELSE (p_data + time '12:00') AT TIME ZONE 'America/Sao_Paulo' END;
  FOR r IN SELECT * FROM (VALUES ('peso', p_peso), ('estatura', p_estatura), ('perimetro-cefalico', p_pc)) v(nome, valor) WHERE v.valor IS NOT NULL LOOP
    INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, internacao_id, conceito_id, aferido_em, registrado_por, valor_num, origem)
    VALUES (pa.unidade_id, p_paciente, v_ep, v_int, private.uuid_conceito(r.nome), v_em, private.meu_perfil_id(), r.valor, 'manual');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.registrar_afericao_crescimento(uuid, date, numeric, numeric, numeric, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_afericao_crescimento(uuid, date, numeric, numeric, numeric, uuid, uuid) TO authenticated;

-- ── 3. avaliação por escala ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.avaliacoes_escala (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id         uuid REFERENCES public.episodios(id),
  internacao_id       uuid REFERENCES public.internacoes(id),
  escala              text NOT NULL CHECK (escala IN ('nips', 'flacc', 'braden', 'morse')),
  versao              text NOT NULL,
  respostas           jsonb NOT NULL,
  total               int NOT NULL,
  interpretacao       text NOT NULL,
  registrado_por      uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em       timestamptz NOT NULL DEFAULT now(),
  cancelada_em        timestamptz,
  cancelada_por       uuid REFERENCES public.perfis(id),
  motivo_cancelamento text,
  CONSTRAINT avaliacoes_escala_cancelamento CHECK (
    cancelada_em IS NULL OR (cancelada_por IS NOT NULL AND length(btrim(coalesce(motivo_cancelamento, ''))) >= 10))
);
CREATE INDEX IF NOT EXISTS avaliacoes_escala_paciente ON public.avaliacoes_escala (paciente_id, registrado_em DESC);
COMMENT ON TABLE public.avaliacoes_escala IS
  'Porte (etapa 9): avaliação por escala com soma e leitura refeitas no servidor (private.escala_avaliacao). Cancelar pede motivo; nada se apaga.';

-- Itens, pontos e faixas: os mesmos de src/clinico/crescimento/escalasAvaliacao.ts
-- (NIPS e FLACC são os da dor na triagem, private.validar_dor_triagem).
CREATE OR REPLACE FUNCTION private.escala_avaliacao(p_escala text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_escala
    WHEN 'nips' THEN '{"publico":"pediatrico","versao":"2026-09-29.1",
      "itens":{"face":[0,1],"choro":[0,1,2],"resp":[0,1],"bracos":[0,1],"pernas":[0,1],"alerta":[0,1]},
      "faixas":[[0,"Sem dor pela NIPS (0 a 3)"],[4,"Dor (4 ou mais)"]]}'::jsonb
    WHEN 'flacc' THEN '{"publico":"pediatrico","versao":"2026-09-29.1",
      "itens":{"face":[0,1,2],"pernas":[0,1,2],"atividade":[0,1,2],"choro":[0,1,2],"consolo":[0,1,2]},
      "faixas":[[0,"Relaxado e confortável (0)"],[1,"Desconforto leve (1 a 3)"],[4,"Dor moderada (4 a 6)"],[7,"Dor intensa (7 a 10)"]]}'::jsonb
    WHEN 'braden' THEN '{"publico":"adulto","versao":"2026-09-29.1",
      "itens":{"percepcao":[1,2,3,4],"umidade":[1,2,3,4],"atividade":[1,2,3,4],"mobilidade":[1,2,3,4],"nutricao":[1,2,3,4],"friccao":[1,2,3]},
      "faixas":[[0,"Risco muito alto (9 ou menos)"],[10,"Risco alto (10 a 12)"],[13,"Risco moderado (13 a 14)"],[15,"Risco baixo (15 a 18)"],[19,"Sem risco (19 a 23)"]]}'::jsonb
    WHEN 'morse' THEN '{"publico":"adulto","versao":"2026-09-29.1",
      "itens":{"quedas":[0,25],"diagnostico":[0,15],"auxilio":[0,15,30],"terapia_ev":[0,20],"marcha":[0,10,20],"estado_mental":[0,15]},
      "faixas":[[0,"Risco baixo (0 a 24)"],[25,"Risco moderado (25 a 44)"],[45,"Risco alto (45 ou mais)"]]}'::jsonb
  END
$$;
REVOKE ALL ON FUNCTION private.escala_avaliacao(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_avaliacao(
  p_paciente uuid, p_escala text, p_respostas jsonb, p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := private.escala_avaliacao(p_escala); pa public.pacientes; k text; v jsonb;
  v_total int := 0; v_interp text; f jsonb; v_ped boolean; v_ep uuid; v_int uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF d IS NULL THEN RAISE EXCEPTION 'Escala desconhecida: use NIPS, FLACC, Braden ou Morse.'; END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  v_ped := CASE WHEN pa.data_nascimento IS NULL THEN NULL
                ELSE age(private.data_atual(), pa.data_nascimento) < interval '14 years' END;
  IF d ->> 'publico' = 'pediatrico' AND v_ped IS NOT TRUE THEN
    RAISE EXCEPTION 'NIPS e FLACC são escalas da pediatria (até 13 anos, 11 meses e 29 dias, com a data de nascimento no cadastro).';
  END IF;
  IF d ->> 'publico' = 'adulto' AND v_ped IS TRUE THEN
    RAISE EXCEPTION 'Braden e Morse são escalas do adulto: na criança não se usam (nada se converte do adulto).';
  END IF;
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' THEN RAISE EXCEPTION 'Responda todas as perguntas.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_respostas) LOOP
    IF NOT (d -> 'itens' ? k) THEN RAISE EXCEPTION 'Pergunta que não é da escala: %.', k; END IF;
  END LOOP;
  FOR k, v IN SELECT * FROM jsonb_each(d -> 'itens') LOOP
    IF NOT (p_respostas ? k) THEN RAISE EXCEPTION 'Responda todas as perguntas (falta %).', k; END IF;
    IF jsonb_typeof(p_respostas -> k) <> 'number' OR NOT (v @> jsonb_build_array(p_respostas -> k)) THEN
      RAISE EXCEPTION 'Resposta fora das opções em %.', k;
    END IF;
    v_total := v_total + (p_respostas ->> k)::int;
  END LOOP;
  FOR f IN SELECT * FROM jsonb_array_elements(d -> 'faixas') LOOP
    IF v_total >= (f ->> 0)::int THEN v_interp := f ->> 1; END IF;
  END LOOP;
  SELECT a.episodio_id, a.internacao_id INTO v_ep, v_int FROM private.atendimento_do_paciente(p_paciente, p_episodio, p_internacao, false) a;
  INSERT INTO public.avaliacoes_escala (unidade_id, paciente_id, episodio_id, internacao_id, escala, versao, respostas, total, interpretacao, registrado_por)
  VALUES (pa.unidade_id, p_paciente, v_ep, v_int, p_escala, d ->> 'versao', p_respostas, v_total, v_interp, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_avaliacao(uuid, text, jsonb, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_avaliacao(uuid, text, jsonb, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_avaliacao(p_avaliacao uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.avaliacoes_escala;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.avaliacoes_escala WHERE id = p_avaliacao FOR UPDATE;
  IF NOT FOUND OR a.cancelada_em IS NOT NULL THEN RAISE EXCEPTION 'Avaliação não encontrada ou já cancelada.'; END IF;
  IF private.pode_atuar_no_paciente(a.paciente_id) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Diga por que a avaliação é cancelada (mínimo de 10 letras).'; END IF;
  UPDATE public.avaliacoes_escala SET cancelada_em = now(), cancelada_por = private.meu_perfil_id(), motivo_cancelamento = btrim(p_motivo)
   WHERE id = a.id;
END $$;
REVOKE ALL ON FUNCTION public.cancelar_avaliacao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_avaliacao(uuid, text) TO authenticated;

-- ── 4. encaminhamento interno ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encaminhamentos_internos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id         uuid REFERENCES public.episodios(id),
  internacao_id       uuid REFERENCES public.internacoes(id),
  especialidade       text NOT NULL CHECK (length(btrim(especialidade)) >= 3),
  medico_destino_id   uuid REFERENCES public.perfis(id),
  servico             text CHECK (servico IS NULL OR servico IN
                        ('Consultório', 'Sala de emergência', 'Observação', 'Sala de procedimentos', 'Pediatria')),
  justificativa       text NOT NULL CHECK (length(btrim(justificativa)) >= 10),
  estado              text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'aceito', 'recusado', 'atendido', 'cancelado')),
  encaminhado_por     uuid NOT NULL REFERENCES public.perfis(id),
  encaminhado_em      timestamptz NOT NULL DEFAULT now(),
  respondido_por      uuid REFERENCES public.perfis(id),
  respondido_em       timestamptz,
  motivo_recusa       text,
  atendido_em         timestamptz,
  cancelado_por       uuid REFERENCES public.perfis(id),
  cancelado_em        timestamptz,
  motivo_cancelamento text,
  CONSTRAINT encaminhamentos_internos_atendimento CHECK (episodio_id IS NOT NULL OR internacao_id IS NOT NULL),
  -- pendente não tem resposta; aceito, recusado e atendido têm quem e quando;
  -- cancelado pode ter sido antes ou depois do aceite
  CONSTRAINT encaminhamentos_internos_resposta CHECK (
       (estado = 'pendente' AND respondido_em IS NULL AND respondido_por IS NULL)
    OR (estado IN ('aceito', 'recusado', 'atendido') AND respondido_em IS NOT NULL AND respondido_por IS NOT NULL)
    OR estado = 'cancelado'),
  CONSTRAINT encaminhamentos_internos_recusa CHECK (
    (estado = 'recusado') = (motivo_recusa IS NOT NULL) AND (motivo_recusa IS NULL OR length(btrim(motivo_recusa)) >= 10)),
  CONSTRAINT encaminhamentos_internos_atendido CHECK ((estado = 'atendido') = (atendido_em IS NOT NULL)),
  CONSTRAINT encaminhamentos_internos_cancelamento CHECK (
    (estado = 'cancelado') = (cancelado_em IS NOT NULL)
    AND (cancelado_em IS NULL OR (cancelado_por IS NOT NULL AND length(btrim(coalesce(motivo_cancelamento, ''))) >= 10)))
);
-- um encaminhamento aguardando aceite por paciente (protótipo: fluxo.enc)
CREATE UNIQUE INDEX IF NOT EXISTS encaminhamentos_internos_um_pendente ON public.encaminhamentos_internos (paciente_id) WHERE estado = 'pendente';
CREATE INDEX IF NOT EXISTS encaminhamentos_internos_paciente ON public.encaminhamentos_internos (paciente_id, encaminhado_em DESC);
CREATE INDEX IF NOT EXISTS encaminhamentos_internos_abertos ON public.encaminhamentos_internos (unidade_id, estado) WHERE estado IN ('pendente', 'aceito');
COMMENT ON TABLE public.encaminhamentos_internos IS
  'Porte (etapa 10): encaminhamento do paciente dentro da unidade. pendente → aceito | recusado (motivo ≥ 10) → atendido; cancelado por quem encaminhou (motivo ≥ 10).';

-- Pendências do atendimento que impedem encaminhar (protótipo, pendAtd:
-- exame sem resultado e medicação prescrita sem checagem; na internação,
-- também a pendência marcada como impeditiva).
CREATE OR REPLACE FUNCTION private.pendencias_do_atendimento(p_episodio uuid, p_internacao uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text[] := '{}'; x text;
BEGIN
  SELECT string_agg(exame, ', ' ORDER BY pedido_em) INTO x FROM public.exames_pedidos
   WHERE situacao = 'pedido' AND ((p_episodio IS NOT NULL AND episodio_id = p_episodio) OR (p_internacao IS NOT NULL AND internacao_id = p_internacao));
  IF x IS NOT NULL THEN v := v || ('Exame sem resultado: ' || x); END IF;
  IF p_episodio IS NOT NULL THEN
    x := array_to_string(private.medicacao_sem_checagem(p_episodio), ', ');
    IF x <> '' THEN v := v || ('Medicação sem checagem da enfermagem: ' || x); END IF;
  END IF;
  IF p_internacao IS NOT NULL THEN
    SELECT string_agg(descricao, ', ' ORDER BY criada_em) INTO x FROM public.pendencias
     WHERE internacao_id = p_internacao AND situacao = 'aberta' AND impeditiva;
    IF x IS NOT NULL THEN v := v || ('Pendência impeditiva: ' || x); END IF;
  END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION private.pendencias_do_atendimento(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- quem pode ler o paciente (as regras de leitura de alergias_do_paciente)
CREATE OR REPLACE FUNCTION private.pode_ler_paciente(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.pacientes pa WHERE pa.id = p_paciente
    AND (private.papel_na_unidade(pa.unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(p_paciente)
         OR private.acesso_encerrado_vigente(p_paciente) OR private.teleinterconsulta_vigente(p_paciente)))
$$;
REVOKE ALL ON FUNCTION private.pode_ler_paciente(uuid) FROM PUBLIC, anon, authenticated;

-- quem pode responder: o médico de destino; sem destino, plantonista com o
-- paciente no plantão, menos quem encaminhou
CREATE OR REPLACE FUNCTION private.pode_responder_encaminhamento(e public.encaminhamentos_internos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN e.medico_destino_id IS NOT NULL THEN
      e.medico_destino_id = private.meu_perfil_id() AND private.tenho_papel(e.unidade_id, 'plantonista')
    ELSE e.encaminhado_por <> private.meu_perfil_id() AND private.tenho_papel(e.unidade_id, 'plantonista')
         AND private.paciente_no_meu_plantao(e.paciente_id)
  END
$$;
REVOKE ALL ON FUNCTION private.pode_responder_encaminhamento(public.encaminhamentos_internos) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pendencias_para_encaminhar(p_paciente uuid, p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ep uuid; v_int uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_ler_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT a.episodio_id, a.internacao_id INTO v_ep, v_int FROM private.atendimento_do_paciente(p_paciente, p_episodio, p_internacao, false) a;
  RETURN private.pendencias_do_atendimento(v_ep, v_int);
END $$;
REVOKE ALL ON FUNCTION public.pendencias_para_encaminhar(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pendencias_para_encaminhar(uuid, uuid, uuid) TO authenticated;

-- médicos da unidade do paciente para o campo "Médico (opcional)"
CREATE OR REPLACE FUNCTION public.medicos_para_encaminhar(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome_completo,
             'registro', nullif(concat_ws(' ', coalesce(p.conselho, CASE WHEN p.crm IS NOT NULL THEN 'CRM' END),
                                          coalesce(p.registro_numero, p.crm), coalesce(p.registro_uf, p.uf_crm)), ''))
             ORDER BY p.nome_completo)
      FROM public.perfis p
     WHERE p.ativo AND p.id <> private.meu_perfil_id()
       AND EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p.id AND v.unidade_id = v_unidade AND v.ativo AND v.papel = 'plantonista')
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.medicos_para_encaminhar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medicos_para_encaminhar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.encaminhar_interno(
  p_paciente uuid, p_especialidade text, p_justificativa text, p_medico uuid DEFAULT NULL, p_servico text DEFAULT NULL,
  p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes; v_ep uuid; v_int uuid; v_pend text[]; v_id uuid; v_esp text := btrim(coalesce(p_especialidade, ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF private.tenho_papel(pa.unidade_id, 'plantonista') IS NOT TRUE THEN RAISE EXCEPTION 'O encaminhamento é do médico.'; END IF;
  IF length(v_esp) < 3 THEN RAISE EXCEPTION 'Informe a especialidade.'; END IF;
  IF length(btrim(coalesce(p_justificativa, ''))) < 10 THEN RAISE EXCEPTION 'Escreva a justificativa (mínimo de 10 letras).'; END IF;
  IF nullif(btrim(p_servico), '') IS NOT NULL AND btrim(p_servico) NOT IN ('Consultório', 'Sala de emergência', 'Observação', 'Sala de procedimentos', 'Pediatria') THEN
    RAISE EXCEPTION 'Serviço fora da lista.';
  END IF;
  IF p_medico IS NOT NULL THEN
    IF p_medico = private.meu_perfil_id() THEN RAISE EXCEPTION 'Não se encaminha o paciente para si mesmo.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
                    WHERE v.perfil_id = p_medico AND v.unidade_id = pa.unidade_id AND v.ativo AND v.papel = 'plantonista' AND p.ativo) THEN
      RAISE EXCEPTION 'O médico de destino não é plantonista desta unidade.';
    END IF;
  END IF;
  SELECT a.episodio_id, a.internacao_id INTO v_ep, v_int FROM private.atendimento_do_paciente(p_paciente, p_episodio, p_internacao, true) a;
  IF v_ep IS NOT NULL AND EXISTS (SELECT 1 FROM public.episodios WHERE id = v_ep AND etapa = 'encerrado') THEN
    RAISE EXCEPTION 'O atendimento já foi encerrado.';
  END IF;
  IF v_int IS NOT NULL AND EXISTS (SELECT 1 FROM public.internacoes WHERE id = v_int AND data_alta IS NOT NULL) THEN
    RAISE EXCEPTION 'A internação já teve alta.';
  END IF;
  -- uma escrita por paciente por vez (o índice único também segura)
  PERFORM pg_advisory_xact_lock(hashtextextended('encaminhamento:' || p_paciente::text, 0));
  IF EXISTS (SELECT 1 FROM public.encaminhamentos_internos WHERE paciente_id = p_paciente AND estado = 'pendente') THEN
    RAISE EXCEPTION 'Já há um encaminhamento aguardando aceite para este paciente.';
  END IF;
  v_pend := private.pendencias_do_atendimento(v_ep, v_int);
  IF cardinality(v_pend) > 0 THEN
    RAISE EXCEPTION 'Pendências em aberto impedem o encaminhamento: %.', array_to_string(v_pend, '; ');
  END IF;
  INSERT INTO public.encaminhamentos_internos (unidade_id, paciente_id, episodio_id, internacao_id, especialidade,
    medico_destino_id, servico, justificativa, encaminhado_por)
  VALUES (pa.unidade_id, p_paciente, v_ep, v_int, v_esp, p_medico, nullif(btrim(p_servico), ''), btrim(p_justificativa), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('encaminhar_interno', 'encaminhamentos_internos', v_id, pa.unidade_id,
    jsonb_build_object('especialidade', v_esp, 'medico_destino', p_medico, 'servico', nullif(btrim(p_servico), '')));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.encaminhar_interno(uuid, text, text, uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encaminhar_interno(uuid, text, text, uuid, text, uuid, uuid) TO authenticated;

-- aceitar: quem recebe assume o atendimento (protótipo: fluxo.medico = login)
CREATE OR REPLACE FUNCTION public.aceitar_encaminhamento(p_encaminhamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.encaminhamentos_internos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.encaminhamentos_internos WHERE id = p_encaminhamento FOR UPDATE;
  IF NOT FOUND OR e.estado <> 'pendente' THEN RAISE EXCEPTION 'Encaminhamento não encontrado ou já respondido.'; END IF;
  IF private.pode_responder_encaminhamento(e) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado: o encaminhamento não é para você.'; END IF;
  UPDATE public.encaminhamentos_internos SET estado = 'aceito', respondido_por = private.meu_perfil_id(), respondido_em = now()
   WHERE id = e.id;
  IF e.episodio_id IS NOT NULL THEN
    UPDATE public.episodios SET atendimento_medico_id = private.meu_perfil_id(), updated_at = now()
     WHERE id = e.episodio_id AND etapa = 'atendimento' AND atendimento_iniciado_em IS NOT NULL;
  END IF;
  PERFORM private.registrar_auditoria('aceitar_encaminhamento', 'encaminhamentos_internos', e.id, e.unidade_id,
    jsonb_build_object('episodio', e.episodio_id));
END $$;
REVOKE ALL ON FUNCTION public.aceitar_encaminhamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceitar_encaminhamento(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.recusar_encaminhamento(p_encaminhamento uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.encaminhamentos_internos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.encaminhamentos_internos WHERE id = p_encaminhamento FOR UPDATE;
  IF NOT FOUND OR e.estado <> 'pendente' THEN RAISE EXCEPTION 'Encaminhamento não encontrado ou já respondido.'; END IF;
  IF private.pode_responder_encaminhamento(e) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado: o encaminhamento não é para você.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Justifique a recusa (mínimo de 10 letras).'; END IF;
  UPDATE public.encaminhamentos_internos
     SET estado = 'recusado', respondido_por = private.meu_perfil_id(), respondido_em = now(), motivo_recusa = btrim(p_motivo)
   WHERE id = e.id;
  PERFORM private.registrar_auditoria('recusar_encaminhamento', 'encaminhamentos_internos', e.id, e.unidade_id, NULL);
END $$;
REVOKE ALL ON FUNCTION public.recusar_encaminhamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recusar_encaminhamento(uuid, text) TO authenticated;

-- atendido: quem aceitou marca que atendeu
CREATE OR REPLACE FUNCTION public.concluir_encaminhamento(p_encaminhamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.encaminhamentos_internos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.encaminhamentos_internos WHERE id = p_encaminhamento FOR UPDATE;
  IF NOT FOUND OR e.estado <> 'aceito' THEN RAISE EXCEPTION 'Só encaminhamento aceito vira atendido.'; END IF;
  IF e.respondido_por <> private.meu_perfil_id() THEN RAISE EXCEPTION 'Acesso negado: quem marca o atendimento é quem aceitou.'; END IF;
  UPDATE public.encaminhamentos_internos SET estado = 'atendido', atendido_em = now() WHERE id = e.id;
  PERFORM private.registrar_auditoria('concluir_encaminhamento', 'encaminhamentos_internos', e.id, e.unidade_id, NULL);
END $$;
REVOKE ALL ON FUNCTION public.concluir_encaminhamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_encaminhamento(uuid) TO authenticated;

-- cancelar: quem encaminhou (ou o gestor), pendente ou aceito, com motivo
CREATE OR REPLACE FUNCTION public.cancelar_encaminhamento(p_encaminhamento uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.encaminhamentos_internos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.encaminhamentos_internos WHERE id = p_encaminhamento FOR UPDATE;
  IF NOT FOUND OR e.estado NOT IN ('pendente', 'aceito') THEN RAISE EXCEPTION 'Só se cancela encaminhamento pendente ou aceito.'; END IF;
  IF NOT (e.encaminhado_por = private.meu_perfil_id() OR private.papel_na_unidade(e.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado: cancela quem encaminhou.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Diga por que o encaminhamento é cancelado (mínimo de 10 letras).'; END IF;
  UPDATE public.encaminhamentos_internos
     SET estado = 'cancelado', cancelado_por = private.meu_perfil_id(), cancelado_em = now(), motivo_cancelamento = btrim(p_motivo)
   WHERE id = e.id;
  PERFORM private.registrar_auditoria('cancelar_encaminhamento', 'encaminhamentos_internos', e.id, e.unidade_id, NULL);
END $$;
REVOKE ALL ON FUNCTION public.cancelar_encaminhamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_encaminhamento(uuid, text) TO authenticated;

-- ── 5. leitura, com os nomes (perfis não deixa ler o nome de outro) ─────────
CREATE OR REPLACE FUNCTION private.encaminhamento_json(e public.encaminhamentos_internos)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', e.id, 'paciente_id', e.paciente_id, 'episodio_id', e.episodio_id, 'internacao_id', e.internacao_id,
    'especialidade', e.especialidade, 'medico_destino_id', e.medico_destino_id,
    'medico_destino', (SELECT nome_completo FROM public.perfis WHERE id = e.medico_destino_id),
    'servico', e.servico, 'justificativa', e.justificativa, 'estado', e.estado,
    'encaminhado_por_id', e.encaminhado_por,
    'encaminhado_por', (SELECT nome_completo FROM public.perfis WHERE id = e.encaminhado_por), 'encaminhado_em', e.encaminhado_em,
    'respondido_por', (SELECT nome_completo FROM public.perfis WHERE id = e.respondido_por), 'respondido_em', e.respondido_em,
    'motivo_recusa', e.motivo_recusa, 'atendido_em', e.atendido_em,
    'cancelado_por', (SELECT nome_completo FROM public.perfis WHERE id = e.cancelado_por), 'cancelado_em', e.cancelado_em,
    'motivo_cancelamento', e.motivo_cancelamento,
    'sou_quem_encaminhou', e.encaminhado_por = private.meu_perfil_id(),
    'sou_quem_aceitou', e.estado = 'aceito' AND e.respondido_por = private.meu_perfil_id(),
    'posso_responder', e.estado = 'pendente' AND coalesce(private.pode_responder_encaminhamento(e), false))
$$;
REVOKE ALL ON FUNCTION private.encaminhamento_json(public.encaminhamentos_internos) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.encaminhamentos_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_ler_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN coalesce((SELECT jsonb_agg(private.encaminhamento_json(e) ORDER BY e.encaminhado_em DESC)
                     FROM public.encaminhamentos_internos e WHERE e.paciente_id = p_paciente), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.encaminhamentos_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encaminhamentos_do_paciente(uuid) TO authenticated;

-- Para quem recebe: pendentes que posso responder e os que aceitei e ainda
-- não marquei como atendidos, com o paciente (nome, nascimento, sexo).
CREATE OR REPLACE FUNCTION public.encaminhamentos_recebidos()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  RETURN coalesce((
    SELECT jsonb_agg(private.encaminhamento_json(e) || jsonb_build_object(
             'paciente', coalesce(nullif(btrim(pa.nome_social), ''), pa.nome), 'data_nascimento', pa.data_nascimento, 'sexo', pa.sexo)
             ORDER BY e.estado DESC, e.encaminhado_em)
      FROM public.encaminhamentos_internos e JOIN public.pacientes pa ON pa.id = e.paciente_id
     WHERE (e.estado = 'pendente' AND private.pode_responder_encaminhamento(e))
        OR (e.estado = 'aceito' AND e.respondido_por = private.meu_perfil_id())
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.encaminhamentos_recebidos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encaminhamentos_recebidos() TO authenticated;

CREATE OR REPLACE FUNCTION public.avaliacoes_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_ler_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', a.id, 'escala', a.escala, 'versao', a.versao, 'respostas', a.respostas, 'total', a.total,
             'interpretacao', a.interpretacao, 'registrado_em', a.registrado_em, 'autor', pr.nome_completo,
             'episodio_id', a.episodio_id, 'internacao_id', a.internacao_id,
             'cancelada_em', a.cancelada_em, 'cancelada_por', pc.nome_completo, 'motivo_cancelamento', a.motivo_cancelamento)
             ORDER BY a.registrado_em DESC)
      FROM public.avaliacoes_escala a
      LEFT JOIN public.perfis pr ON pr.id = a.registrado_por
      LEFT JOIN public.perfis pc ON pc.id = a.cancelada_por
     WHERE a.paciente_id = p_paciente), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.avaliacoes_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avaliacoes_do_paciente(uuid) TO authenticated;

-- ── 6. RLS e guarda ─────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['avaliacoes_escala', 'encaminhamentos_internos'] LOOP
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
    -- guarda de 20 anos: registro clínico não sai por DELETE
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica()', t);
  END LOOP;
END $$;
-- o médico de destino também lê o encaminhamento que é para ele
DROP POLICY IF EXISTS encaminhamentos_internos_destino ON public.encaminhamentos_internos;
CREATE POLICY encaminhamentos_internos_destino ON public.encaminhamentos_internos FOR SELECT TO authenticated
  USING (medico_destino_id = private.meu_perfil_id());
