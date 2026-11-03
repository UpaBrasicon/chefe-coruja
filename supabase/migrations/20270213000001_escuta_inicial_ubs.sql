-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 2, parte 2.4 (BACKLOG.md; decisões do RT em 02/11/2026): escuta
-- inicial da UBS com a classificação da demanda espontânea do Caderno de
-- Atenção Básica nº 28 (MS; vol. I, p. 34 e 35; vol. II, p. 18 e 19):
--   azul     situação não aguda: orientação ou agendamento;
--   vermelho atendimento imediato (alto risco de vida);
--   amarelo  atendimento prioritário (risco moderado);
--   verde    atendimento no dia (risco baixo ou vulnerabilidade importante).
-- A fonte não dá tempo-alvo em minutos; não há laranja nem fluxograma.
--
-- 1. classificacoes_risco.protocolo ('cab28'; nulo = Manchester, da porta) e
--    classificacoes_risco.saida_escuta (orientacao | agendamento | consulta),
--    anuláveis, com CHECK. A escuta grava na mesma tabela da classificação
--    (só inserção, auditada), e os sinais vitais em observacao, como na porta.
-- 2. registrar_ficha: na UBS, o tipo "escuta_inicial" nasce em 'triagem' (fila
--    da enfermagem); os outros tipos seguem em 'atendimento' (decisão "pela
--    ficha"). Troca na definição atual, sem o CR do fim de linha.
-- 3. registrar_escuta_aps (nova): só o enfermeiro de plantão no consultório;
--    sinais vitais opcionais; azul encerra com a orientação ou o agendamento
--    escrito; vermelho, amarelo e verde vão para a fila do médico com a cor.
--
-- Idempotente. Teste: supabase/tests/5a_escuta_inicial.sql
--
-- Rollback (na ordem):
--   DROP FUNCTION public.registrar_escuta_aps(uuid, text, text, text, jsonb, text, text);
--   a troca 2 invertida;
--   as colunas da 1 ficam (expand), sem uso; para tirá-las, com janela:
--   ALTER TABLE public.classificacoes_risco DROP COLUMN saida_escuta, DROP COLUMN protocolo;
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. classificação do CAB 28 ──────────────────────────────────────────────
ALTER TABLE public.classificacoes_risco
  ADD COLUMN IF NOT EXISTS protocolo text,
  ADD COLUMN IF NOT EXISTS saida_escuta text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classificacoes_risco_protocolo_check'
                   AND conrelid = 'public.classificacoes_risco'::regclass) THEN
    ALTER TABLE public.classificacoes_risco ADD CONSTRAINT classificacoes_risco_protocolo_check CHECK (
      protocolo IS NULL
      OR (protocolo = 'cab28' AND cor IN ('vermelho', 'amarelo', 'verde', 'azul')
          AND saida_escuta IS NOT NULL
          AND (saida_escuta IN ('orientacao', 'agendamento')) = (cor = 'azul')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classificacoes_risco_saida_escuta_check'
                   AND conrelid = 'public.classificacoes_risco'::regclass) THEN
    ALTER TABLE public.classificacoes_risco ADD CONSTRAINT classificacoes_risco_saida_escuta_check CHECK (
      saida_escuta IS NULL OR (coalesce(protocolo, '') = 'cab28' AND saida_escuta IN ('orientacao', 'agendamento', 'consulta')));
  END IF;
END $$;

COMMENT ON COLUMN public.classificacoes_risco.protocolo IS
  'Escala da classificação: nulo = Manchester (porta); ''cab28'' = demanda espontânea da UBS (CAB 28 do MS).';
COMMENT ON COLUMN public.classificacoes_risco.saida_escuta IS
  'Saída da escuta inicial da UBS: orientacao ou agendamento (azul, encerra) ou consulta (vermelho, amarelo, verde).';

-- ── 2. ficha: "escuta inicial" vai para a fila da enfermagem ────────────────
CREATE OR REPLACE FUNCTION pg_temp.aps_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(p_pares[k + 1] IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

SELECT pg_temp.aps_trocar('public.registrar_ficha(uuid, text, uuid, jsonb, text[], boolean)',
  'CASE WHEN v_ubs THEN ''atendimento'' ELSE ''triagem'' END',
  'CASE WHEN v_ubs AND v_tipo_aps IS DISTINCT FROM ''escuta_inicial'' THEN ''atendimento'' ELSE ''triagem'' END');

DROP FUNCTION pg_temp.aps_trocar(regprocedure, text[]);

-- ── 3. escuta inicial ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_escuta_aps(
  p_episodio uuid, p_cor text, p_saida text, p_queixa text DEFAULT NULL, p_sinais jsonb DEFAULT '{}',
  p_publico text DEFAULT NULL, p_obs text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_eu uuid := private.meu_perfil_id();
  v_nasc date;
  v_pub_idade text;
  v_publico text;
  v_obs text := nullif(btrim(p_obs), '');
  v_conceito uuid;
  v_id uuid;
  k text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'A escuta inicial do CAB 28 é só da UBS.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão neste consultório.';
  END IF;
  IF private.tenho_papel(e.unidade_id, 'enfermeiro') IS NOT TRUE THEN
    RAISE EXCEPTION 'A escuta inicial e a classificação são do enfermeiro.';
  END IF;
  IF e.etapa <> 'triagem' THEN RAISE EXCEPTION 'Este paciente não está aguardando a escuta inicial.'; END IF;
  IF p_cor IS NULL OR p_cor NOT IN ('vermelho', 'amarelo', 'verde', 'azul') THEN
    RAISE EXCEPTION 'Escolha a classificação do CAB 28 (vermelho, amarelo, verde ou azul).';
  END IF;
  IF p_cor = 'azul' AND p_saida IS DISTINCT FROM 'orientacao' AND p_saida IS DISTINCT FROM 'agendamento' THEN
    RAISE EXCEPTION 'Situação não aguda (azul): orientação ou agendamento.';
  END IF;
  IF p_cor <> 'azul' AND p_saida IS DISTINCT FROM 'consulta' THEN
    RAISE EXCEPTION 'Situação aguda (vermelho, amarelo ou verde) vai para a consulta.';
  END IF;
  IF p_cor = 'azul' AND length(coalesce(v_obs, '')) < 10 THEN
    RAISE EXCEPTION 'Escreva a orientação dada ou o agendamento (mínimo de 10 letras).';
  END IF;

  -- grupo pela idade (pediatria até 13a 11m 29d); sem data de nascimento,
  -- vale o informado
  SELECT data_nascimento INTO v_nasc FROM public.pacientes WHERE id = e.paciente_id;
  IF v_nasc IS NOT NULL THEN
    v_pub_idade := CASE WHEN private.pediatrico_em(v_nasc, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date)
                        THEN 'pediatrico' ELSE 'adulto' END;
  END IF;
  v_publico := coalesce(v_pub_idade, p_publico, e.publico);
  IF v_publico IS NULL OR v_publico NOT IN ('adulto', 'pediatrico') THEN
    RAISE EXCEPTION 'Sem data de nascimento: informe se é adulto ou pediatria.';
  END IF;

  -- sinais vitais opcionais (decisão do RT): os que vierem, numéricos e
  -- conhecidos, ficam como aferidos agora por quem escutou
  FOR k IN SELECT jsonb_object_keys(coalesce(p_sinais, '{}')) LOOP
    IF jsonb_typeof(p_sinais -> k) <> 'number' THEN RAISE EXCEPTION 'Sinal vital sem número: %.', replace(k, '-', ' '); END IF;
    SELECT id INTO v_conceito FROM public.conceito WHERE nome = k AND (unidade_id IS NULL OR unidade_id = e.unidade_id) LIMIT 1;
    IF v_conceito IS NULL THEN RAISE EXCEPTION 'Sinal vital desconhecido: %.', k; END IF;
    INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, registrado_por, valor_num, origem)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_conceito, now(), v_eu, (p_sinais ->> k)::numeric, 'manual');
  END LOOP;

  INSERT INTO public.classificacoes_risco
    (episodio_id, unidade_id, paciente_id, cor, publico, avaliacao, reclassificacao, motivo, autor_id, autor_papel,
     queixa, publico_pela_idade, protocolo, saida_escuta)
  VALUES
    (e.id, e.unidade_id, e.paciente_id, p_cor, v_publico, '{}', false, v_obs, v_eu, 'enfermeiro',
     coalesce(nullif(btrim(p_queixa), ''), e.queixa), v_pub_idade, 'cab28', p_saida)
  RETURNING id INTO v_id;

  IF p_cor = 'azul' THEN
    -- não aguda: a escuta resolve (orientação) ou deixa o agendamento escrito;
    -- o episódio encerra sem desfecho da porta e sem conduta médica
    UPDATE public.episodios
       SET cor_atual = p_cor, publico = v_publico, classificado_em = now(), etapa = 'encerrado',
           desfecho_motivo = v_obs, desfecho_em = now(), desfecho_por = v_eu, encerrado_em = now(), encerrado_por = v_eu,
           updated_at = now()
     WHERE id = e.id;
  ELSE
    UPDATE public.episodios
       SET cor_atual = p_cor, publico = v_publico, classificado_em = now(), etapa = 'atendimento', updated_at = now()
     WHERE id = e.id;
  END IF;

  PERFORM private.registrar_auditoria('escuta_aps_registrada', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('cor', p_cor, 'status', p_saida, 'escala', 'cab28'));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_escuta_aps(uuid, text, text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_escuta_aps(uuid, text, text, text, jsonb, text, text) TO authenticated;
