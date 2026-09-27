-- ════════════════════════════════════════════════════════════════════════════
-- Fase 2.2 — triagem e classificação de risco (CONTEXT.md; ADR 0007).
--
-- • O protocolo da unidade fica NO BANCO, lido por quem tem vínculo — não no
--   código do site, que é público. O texto é do protocolo; o sistema não o
--   inventa (carga em supabase/dados/, fora das migrations).
-- • A cor é do ENFERMEIRO. O sistema recebe a cor escolhida e guarda, ao lado,
--   a cor que o discriminador tem no protocolo — nunca sugere nem troca.
-- • Só o MÉDICO reclassifica: motivo, sinais vitais novos e, se baixar a
--   prioridade, justificativa.
-- • Sinais vitais obrigatórios: PA, FC, FR, temperatura, SpO₂ e dor. Na
--   pediatria (até 13 anos, 11 meses e 29 dias) a PA é opcional.
-- • Histórico só de inserção; o episódio guarda a cor atual para a fila.
-- ════════════════════════════════════════════════════════════════════════════

-- ── protocolo ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolos_classificacao (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  fonte  text NOT NULL,
  -- tempo-alvo até o atendimento médico, em minutos, por cor
  tempos jsonb NOT NULL DEFAULT '{"vermelho":0,"laranja":10,"amarelo":60,"verde":120,"azul":240}'
);
CREATE TABLE IF NOT EXISTS public.protocolo_fluxogramas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id    uuid NOT NULL REFERENCES public.protocolos_classificacao(id) ON DELETE CASCADE,
  ordem           integer NOT NULL,
  nome            text NOT NULL,
  publico         text NOT NULL CHECK (publico IN ('adulto', 'pediatrico')),
  inclui          text,
  -- {"vermelho":[["discriminador","descrição"],…], "laranja":[…], …}
  discriminadores jsonb NOT NULL,
  UNIQUE (protocolo_id, publico, nome)
);
ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS protocolo_classificacao_id uuid REFERENCES public.protocolos_classificacao(id);

ALTER TABLE public.protocolos_classificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_fluxogramas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.protocolos_classificacao, public.protocolo_fluxogramas FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.protocolos_classificacao, public.protocolo_fluxogramas FROM authenticated;
GRANT SELECT ON public.protocolos_classificacao, public.protocolo_fluxogramas TO authenticated;

-- lê quem tem vínculo ativo numa unidade que usa o protocolo
CREATE OR REPLACE FUNCTION private.uso_protocolo(p_protocolo uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR EXISTS (
    SELECT 1 FROM public.vinculos v JOIN public.unidades u ON u.id = v.unidade_id
    WHERE v.perfil_id = private.meu_perfil_id() AND v.ativo AND u.protocolo_classificacao_id = p_protocolo)
$$;
DROP POLICY IF EXISTS protocolos_select ON public.protocolos_classificacao;
CREATE POLICY protocolos_select ON public.protocolos_classificacao FOR SELECT TO authenticated
  USING (private.uso_protocolo(id));
DROP POLICY IF EXISTS fluxogramas_select ON public.protocolo_fluxogramas;
CREATE POLICY fluxogramas_select ON public.protocolo_fluxogramas FOR SELECT TO authenticated
  USING (private.uso_protocolo(protocolo_id));

-- ── papel: "tenho este papel aqui", não só o mais forte ─────────────────────
CREATE OR REPLACE FUNCTION private.tenho_papel(p_unidade uuid, p_papel text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vinculos
                 WHERE perfil_id = private.meu_perfil_id() AND unidade_id = p_unidade
                   AND ativo AND papel::text = p_papel)
$$;
REVOKE ALL ON FUNCTION private.tenho_papel(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.tenho_papel(uuid, text) TO authenticated;

-- ── episódio guarda a cor atual (a fila lê daqui) ───────────────────────────
ALTER TABLE public.episodios
  ADD COLUMN IF NOT EXISTS cor_atual text CHECK (cor_atual IN ('vermelho', 'laranja', 'amarelo', 'verde', 'azul')),
  ADD COLUMN IF NOT EXISTS classificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS publico text CHECK (publico IN ('adulto', 'pediatrico'));

-- sinais vitais passam a poder pertencer ao episódio
ALTER TABLE public.observacao ADD COLUMN IF NOT EXISTS episodio_id uuid REFERENCES public.episodios(id);
CREATE INDEX IF NOT EXISTS observacao_episodio ON public.observacao (episodio_id, aferido_em) WHERE episodio_id IS NOT NULL;

-- ── histórico de classificação ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classificacoes_risco (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episodio_id        uuid NOT NULL REFERENCES public.episodios(id),
  unidade_id         uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id        uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  cor                text NOT NULL CHECK (cor IN ('vermelho', 'laranja', 'amarelo', 'verde', 'azul')),
  publico            text NOT NULL CHECK (publico IN ('adulto', 'pediatrico')),
  fluxograma_id      uuid REFERENCES public.protocolo_fluxogramas(id),
  fluxograma_nome    text,
  discriminador      text,
  discriminador_cor  text,  -- a cor que o discriminador tem NO PROTOCOLO (referência)
  avaliacao          jsonb NOT NULL DEFAULT '{}'::jsonb,
  reclassificacao    boolean NOT NULL DEFAULT false,
  motivo             text,
  justificativa      text,
  autor_id           uuid NOT NULL REFERENCES public.perfis(id),
  autor_papel        text NOT NULL,
  criado_em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classificacoes_episodio ON public.classificacoes_risco (episodio_id, criado_em);

CREATE OR REPLACE FUNCTION private.so_insercao() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION '% é só de inserção: não se altera nem se apaga.', TG_TABLE_NAME;
END $$;
DROP TRIGGER IF EXISTS trg_classificacao_so_insercao ON public.classificacoes_risco;
CREATE TRIGGER trg_classificacao_so_insercao BEFORE UPDATE OR DELETE ON public.classificacoes_risco
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

ALTER TABLE public.classificacoes_risco ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.classificacoes_risco FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.classificacoes_risco FROM authenticated;
GRANT SELECT ON public.classificacoes_risco TO authenticated;
DROP POLICY IF EXISTS classificacoes_select ON public.classificacoes_risco;
CREATE POLICY classificacoes_select ON public.classificacoes_risco FOR SELECT TO authenticated
USING (
  private.eh_super_admin()
  OR private.papel_na_unidade(unidade_id) = 'gestor'
  OR EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = episodio_id
             AND e.setor_id IN (SELECT private.setores_na_escala_agora()))
);
DROP POLICY IF EXISTS classificacoes_risco_prontuario_aberto ON public.classificacoes_risco;
CREATE POLICY classificacoes_risco_prontuario_aberto ON public.classificacoes_risco AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.prontuario_aberto(paciente_id));
DROP POLICY IF EXISTS classificacoes_segundo_fator ON public.classificacoes_risco;
CREATE POLICY classificacoes_segundo_fator ON public.classificacoes_risco AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- ── classificar / reclassificar ─────────────────────────────────────────────
-- p_sinais: {"pressao-arterial-sistolica":120, "frequencia-cardiaca":88, …}
-- p_avaliacao: campos livres da triagem (AVDI, Glasgow, peso, tempo dos
--   sintomas, comorbidades, medicações, condição da SpO₂, escala de dor…).
CREATE OR REPLACE FUNCTION public.classificar_risco(
  p_episodio uuid,
  p_cor text,
  p_sinais jsonb,
  p_fluxograma uuid DEFAULT NULL,
  p_discriminador text DEFAULT NULL,
  p_avaliacao jsonb DEFAULT '{}'::jsonb,
  p_publico text DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_justificativa text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  e public.episodios;
  v_nasc date;
  v_publico text;
  v_reclass boolean;
  v_papel text;
  v_flx public.protocolo_fluxogramas;
  v_disc_cor text;
  v_id uuid;
  v_ordem text[] := ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul'];
  obrig text[];
  k text;
  v_conceito uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  IF p_cor IS NULL OR NOT (p_cor = ANY (v_ordem)) THEN RAISE EXCEPTION 'Escolha a cor da classificação.'; END IF;

  v_reclass := e.cor_atual IS NOT NULL;
  IF NOT v_reclass THEN
    IF e.etapa <> 'triagem' THEN RAISE EXCEPTION 'Este episódio não está aguardando triagem.'; END IF;
    IF private.tenho_papel(e.unidade_id, 'enfermeiro') IS NOT TRUE THEN
      RAISE EXCEPTION 'A classificação de risco é do enfermeiro.';
    END IF;
    IF p_fluxograma IS NULL OR length(btrim(coalesce(p_discriminador, ''))) = 0 THEN
      RAISE EXCEPTION 'Informe o fluxograma e o discriminador do protocolo.';
    END IF;
    v_papel := 'enfermeiro';
  ELSE
    IF e.etapa <> 'atendimento' THEN RAISE EXCEPTION 'Só se reclassifica antes do desfecho.'; END IF;
    IF private.tenho_papel(e.unidade_id, 'plantonista') IS NOT TRUE THEN
      RAISE EXCEPTION 'Só o médico reclassifica.';
    END IF;
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
      RAISE EXCEPTION 'Informe o motivo da reclassificação (mínimo de 10 letras).';
    END IF;
    IF array_position(v_ordem, p_cor) > array_position(v_ordem, e.cor_atual)
       AND length(btrim(coalesce(p_justificativa, ''))) < 20 THEN
      RAISE EXCEPTION 'Baixar a prioridade exige justificativa (mínimo de 20 letras).';
    END IF;
    v_papel := 'plantonista';
  END IF;

  -- público: pela idade quando se sabe; senão, o que a enfermagem informou
  SELECT data_nascimento INTO v_nasc FROM public.pacientes WHERE id = e.paciente_id;
  IF v_nasc IS NOT NULL THEN
    v_publico := CASE WHEN age((e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date, v_nasc) < interval '14 years'
                      THEN 'pediatrico' ELSE 'adulto' END;
  ELSE
    v_publico := p_publico;
  END IF;
  IF v_publico IS NULL OR v_publico NOT IN ('adulto', 'pediatrico') THEN
    RAISE EXCEPTION 'Sem data de nascimento: informe se é adulto ou pediatria.';
  END IF;

  -- protocolo: só referência; guarda a cor do discriminador ao lado da escolhida
  IF p_fluxograma IS NOT NULL THEN
    SELECT * INTO v_flx FROM public.protocolo_fluxogramas WHERE id = p_fluxograma;
    IF NOT FOUND THEN RAISE EXCEPTION 'Fluxograma não encontrado.'; END IF;
    IF v_flx.publico <> v_publico THEN RAISE EXCEPTION 'Fluxograma de outro público (%).', v_flx.publico; END IF;
    SELECT c.key INTO v_disc_cor
      FROM jsonb_each(v_flx.discriminadores) c, jsonb_array_elements(c.value) d
     WHERE d ->> 0 = btrim(p_discriminador) LIMIT 1;
    IF v_disc_cor IS NULL THEN RAISE EXCEPTION 'Discriminador não pertence ao fluxograma.'; END IF;
  END IF;

  -- sinais vitais: todos obrigatórios; PA opcional na pediatria
  obrig := ARRAY['frequencia-cardiaca', 'frequencia-respiratoria', 'temperatura', 'saturacao-o2', 'escala-dor'];
  IF v_publico = 'adulto' THEN
    obrig := obrig || ARRAY['pressao-arterial-sistolica', 'pressao-arterial-diastolica'];
  END IF;
  FOREACH k IN ARRAY obrig LOOP
    IF NOT (coalesce(p_sinais, '{}') ? k) OR jsonb_typeof(p_sinais -> k) <> 'number' THEN
      RAISE EXCEPTION 'Sinal vital obrigatório ausente: %.', replace(k, '-', ' ');
    END IF;
  END LOOP;
  FOR k IN SELECT jsonb_object_keys(p_sinais) LOOP
    SELECT id INTO v_conceito FROM public.conceito WHERE nome = k AND (unidade_id IS NULL OR unidade_id = e.unidade_id) LIMIT 1;
    IF v_conceito IS NULL THEN RAISE EXCEPTION 'Sinal vital desconhecido: %.', k; END IF;
    INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, registrado_por, valor_num, origem)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_conceito, now(), v_perfil, (p_sinais ->> k)::numeric, 'manual');
  END LOOP;

  INSERT INTO public.classificacoes_risco
    (episodio_id, unidade_id, paciente_id, cor, publico, fluxograma_id, fluxograma_nome, discriminador,
     discriminador_cor, avaliacao, reclassificacao, motivo, justificativa, autor_id, autor_papel)
  VALUES
    (e.id, e.unidade_id, e.paciente_id, p_cor, v_publico, v_flx.id, v_flx.nome, nullif(btrim(p_discriminador), ''),
     v_disc_cor, coalesce(p_avaliacao, '{}'), v_reclass, nullif(btrim(p_motivo), ''), nullif(btrim(p_justificativa), ''),
     v_perfil, v_papel)
  RETURNING id INTO v_id;

  UPDATE public.episodios
     SET cor_atual = p_cor, publico = v_publico, etapa = 'atendimento',
         classificado_em = coalesce(classificado_em, now()), updated_at = now()
   WHERE id = e.id;

  PERFORM private.registrar_auditoria(CASE WHEN v_reclass THEN 'reclassificar' ELSE 'classificar' END,
    'episodios', e.id, e.unidade_id, jsonb_build_object('status', p_cor, 'tipo', v_publico));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.classificar_risco(uuid, text, jsonb, uuid, text, jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classificar_risco(uuid, text, jsonb, uuid, text, jsonb, text, text, text) TO authenticated;
