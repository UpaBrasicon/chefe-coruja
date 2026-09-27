-- ════════════════════════════════════════════════════════════════════════════
-- Fase 2.1 — paciente completo, ficha e episódio (CONTEXT.md: Ficha, Episódio,
-- Responsável legal, Prioridade legal).
--
-- • Paciente ganha identificação completa e responsável legal OPCIONAL (menor
--   sem responsável é cadastrável: abrigo, escola). Número de prontuário
--   gerado por unidade (AAAA.000001). CPF e CNS não se repetem na unidade.
-- • Episódio = uma vinda, da ficha ao desfecho. Nasce da ficha, feita pela
--   Recepção (ou por quem está de plantão na porta). Um paciente tem no máximo
--   um episódio aberto por vez; reentrada é episódio novo.
-- • Checagem de duplicata no servidor: mesmo CPF/CNS bloqueia; mesmo nome +
--   nascimento exige confirmar que é outra pessoa.
-- • Prioridade legal: 60+/80+ calculadas pela idade no servidor; as demais
--   (gestante, lactante/criança de colo, PcD, TEA) informadas na ficha.
-- • Escrita só por RPC; o autor é o login.
-- ════════════════════════════════════════════════════════════════════════════

-- ── paciente ────────────────────────────────────────────────────────────────
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS nome_social text,
  ADD COLUMN IF NOT EXISTS nome_mae text,
  ADD COLUMN IF NOT EXISTS cns text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_parentesco text,
  ADD COLUMN IF NOT EXISTS responsavel_documento text,
  ADD COLUMN IF NOT EXISTS responsavel_telefone text;

CREATE UNIQUE INDEX IF NOT EXISTS pacientes_unidade_cpf_unico
  ON public.pacientes (unidade_id, cpf) WHERE nullif(cpf, '') IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_unidade_cns_unico
  ON public.pacientes (unidade_id, cns) WHERE nullif(cns, '') IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_unidade_prontuario_unico
  ON public.pacientes (unidade_id, prontuario) WHERE prontuario IS NOT NULL;

-- Porta adulta, pediátrica ou mista: a ficha pré-seleciona pela idade.
ALTER TABLE public.setores
  ADD COLUMN IF NOT EXISTS publico text NOT NULL DEFAULT 'todos'
  CHECK (publico IN ('todos', 'adulto', 'pediatrico'));

-- ── número de prontuário ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.prontuario_sequencia (
  unidade_id uuid NOT NULL,
  ano integer NOT NULL,
  ultimo integer NOT NULL,
  PRIMARY KEY (unidade_id, ano)
);

CREATE OR REPLACE FUNCTION private.gerar_prontuario(p_unidade uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ano integer := extract(year FROM private.data_atual())::integer;
  v_n integer;
  v_num text;
BEGIN
  -- avança até um número livre: números já dados à mão (importação) são pulados
  LOOP
    INSERT INTO private.prontuario_sequencia (unidade_id, ano, ultimo) VALUES (p_unidade, v_ano, 1)
    ON CONFLICT (unidade_id, ano) DO UPDATE SET ultimo = private.prontuario_sequencia.ultimo + 1
    RETURNING ultimo INTO v_n;
    v_num := v_ano || '.' || lpad(v_n::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pacientes WHERE unidade_id = p_unidade AND prontuario = v_num);
  END LOOP;
  RETURN v_num;
END $$;
REVOKE ALL ON FUNCTION private.gerar_prontuario(uuid) FROM PUBLIC, anon, authenticated;

-- quem já existe recebe número
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, unidade_id FROM public.pacientes WHERE prontuario IS NULL ORDER BY created_at LOOP
    UPDATE public.pacientes SET prontuario = private.gerar_prontuario(r.unidade_id) WHERE id = r.id;
  END LOOP;
END $$;

-- ── auxiliares ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.so_digitos(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT nullif(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '') $$;

CREATE OR REPLACE FUNCTION private.nome_comparavel(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(btrim(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION private.mascarar(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t IS NULL OR length(t) < 4 THEN NULL ELSE repeat('•', length(t) - 4) || right(t, 4) END
$$;

-- ── episódio ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.episodios (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id         uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id        uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  setor_id           uuid NOT NULL REFERENCES public.setores(id),
  etapa              text NOT NULL DEFAULT 'triagem'
                     CHECK (etapa IN ('triagem', 'atendimento', 'observacao', 'internacao', 'encerrado')),
  queixa             text NOT NULL CHECK (length(btrim(queixa)) >= 3),
  prioridades_legais text[] NOT NULL DEFAULT '{}'
                     CHECK (prioridades_legais <@ ARRAY['idoso_60', 'idoso_80', 'gestante', 'lactante_crianca_colo', 'pcd', 'tea']),
  chegada_em         timestamptz NOT NULL DEFAULT now(),
  aberto_por         uuid NOT NULL REFERENCES public.perfis(id),
  desfecho           text,
  encerrado_em       timestamptz,
  encerrado_por      uuid REFERENCES public.perfis(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK ((etapa = 'encerrado') = (encerrado_em IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS episodios_um_aberto_por_paciente
  ON public.episodios (paciente_id) WHERE etapa <> 'encerrado';
CREATE INDEX IF NOT EXISTS episodios_fila ON public.episodios (setor_id, etapa, chegada_em) WHERE etapa <> 'encerrado';
CREATE INDEX IF NOT EXISTS episodios_paciente ON public.episodios (paciente_id, chegada_em DESC);

ALTER TABLE public.episodios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.episodios FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.episodios FROM authenticated;
GRANT SELECT ON public.episodios TO authenticated;

DROP POLICY IF EXISTS episodios_select ON public.episodios;
CREATE POLICY episodios_select ON public.episodios FOR SELECT TO authenticated
USING (
  private.eh_super_admin()
  OR private.papel_na_unidade(unidade_id) = 'gestor'
  OR setor_id IN (SELECT private.setores_na_escala_agora())
);
DROP POLICY IF EXISTS episodios_segundo_fator ON public.episodios;
CREATE POLICY episodios_segundo_fator ON public.episodios AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- ── prioridade legal pela idade ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.prioridades_por_idade(p_nascimento date, p_em timestamptz)
RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_nascimento IS NULL THEN '{}'::text[]
    WHEN extract(year FROM age((p_em AT TIME ZONE 'America/Sao_Paulo')::date, p_nascimento)) >= 80 THEN ARRAY['idoso_60', 'idoso_80']
    WHEN extract(year FROM age((p_em AT TIME ZONE 'America/Sao_Paulo')::date, p_nascimento)) >= 60 THEN ARRAY['idoso_60']
    ELSE '{}'::text[]
  END
$$;

-- ── busca antes de cadastrar ────────────────────────────────────────────────
-- Devolve só identificação, com CPF e CNS mascarados: é para achar a pessoa,
-- não para ler o prontuário.
CREATE OR REPLACE FUNCTION public.buscar_pacientes(p_unidade uuid, p_termo text)
RETURNS TABLE (id uuid, nome text, nome_social text, data_nascimento date, nome_mae text,
               cpf_final text, cns_final text, prontuario text, episodio_etapa text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dig text := private.so_digitos(p_termo);
  v_nome text := private.nome_comparavel(p_termo);
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor'
      OR private.na_escala_agora(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: busca só para quem está de plantão na unidade.';
  END IF;
  IF length(coalesce(v_nome, '')) < 3 AND length(coalesce(v_dig, '')) < 4 THEN
    RAISE EXCEPTION 'Digite ao menos 3 letras do nome ou 4 números do documento.';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nome, p.nome_social, p.data_nascimento, p.nome_mae,
         private.mascarar(p.cpf), private.mascarar(p.cns), p.prontuario,
         (SELECT e.etapa FROM public.episodios e WHERE e.paciente_id = p.id AND e.etapa <> 'encerrado')
  FROM public.pacientes p
  WHERE p.unidade_id = p_unidade AND p.ativo
    AND (   (v_dig IS NOT NULL AND length(v_dig) >= 4 AND (p.cpf = v_dig OR p.cns = v_dig OR private.so_digitos(p.prontuario) = v_dig))
         OR (length(coalesce(v_nome, '')) >= 3 AND (private.nome_comparavel(p.nome) LIKE '%' || v_nome || '%'
                                                     OR private.nome_comparavel(p.nome_social) LIKE '%' || v_nome || '%'
                                                     OR private.nome_comparavel(p.nome_mae) LIKE '%' || v_nome || '%')))
  ORDER BY p.nome
  LIMIT 20;
END $$;
REVOKE ALL ON FUNCTION public.buscar_pacientes(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_pacientes(uuid, text) TO authenticated;

-- ── ficha ───────────────────────────────────────────────────────────────────
-- p_paciente NULL = pessoa nova, dados em p_dados. Com p_paciente, p_dados
-- atualiza só os campos enviados (telefone, endereço, responsável…).
-- Erros com código no começo, para a tela reagir:
--   FICHA_DUPLICATA_DOCUMENTO:<id>  mesmo CPF/CNS já cadastrado
--   FICHA_DUPLICATA_PROVAVEL:<id>   mesmo nome + nascimento (confirme p_outra_pessoa)
--   FICHA_EPISODIO_ABERTO           o paciente já está na unidade
--   FICHA_INTERNADO                 o paciente tem internação ativa
CREATE OR REPLACE FUNCTION public.registrar_ficha(
  p_setor uuid,
  p_queixa text,
  p_paciente uuid DEFAULT NULL,
  p_dados jsonb DEFAULT '{}'::jsonb,
  p_prioridades text[] DEFAULT '{}',
  p_outra_pessoa boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  v_tipo text;
  v_pac public.pacientes;
  v_dup uuid;
  v_cpf text := private.so_digitos(p_dados ->> 'cpf');
  v_cns text := private.so_digitos(p_dados ->> 'cns');
  v_nasc date := nullif(p_dados ->> 'data_nascimento', '')::date;
  v_epi uuid;
  v_prio text[];
  v_novo boolean := p_paciente IS NULL;
  campos text[] := ARRAY['nome', 'nome_social', 'nome_mae', 'sexo', 'estado_civil', 'telefone',
                         'endereco', 'municipio', 'uf', 'responsavel_nome', 'responsavel_parentesco',
                         'responsavel_documento', 'responsavel_telefone'];
  k text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT unidade_id, tipo INTO v_unidade, v_tipo FROM public.setores WHERE id = p_setor AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  IF v_tipo <> 'emergencia' THEN RAISE EXCEPTION 'A ficha abre numa porta (setor de emergência).'; END IF;
  IF (private.eh_super_admin() OR private.papel_na_unidade(v_unidade) = 'gestor'
      OR p_setor IN (SELECT private.setores_na_escala_agora())) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  IF length(btrim(coalesce(p_queixa, ''))) < 3 THEN RAISE EXCEPTION 'Informe a queixa referida.'; END IF;
  IF NOT (coalesce(p_prioridades, '{}') <@ ARRAY['gestante', 'lactante_crianca_colo', 'pcd', 'tea', 'idoso_60', 'idoso_80']) THEN
    RAISE EXCEPTION 'Prioridade legal desconhecida.';
  END IF;
  IF p_dados ? 'uf' AND nullif(p_dados ->> 'uf', '') IS NOT NULL AND (p_dados ->> 'uf') !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'UF com duas letras maiúsculas.';
  END IF;
  IF v_nasc IS NOT NULL AND v_nasc > private.data_atual() THEN
    RAISE EXCEPTION 'Data de nascimento no futuro.';
  END IF;

  -- documentos: nunca dois cadastros com o mesmo CPF/CNS na unidade
  SELECT id INTO v_dup FROM public.pacientes
   WHERE unidade_id = v_unidade AND id IS DISTINCT FROM p_paciente
     AND ((v_cpf IS NOT NULL AND cpf = v_cpf) OR (v_cns IS NOT NULL AND cns = v_cns))
   LIMIT 1;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'FICHA_DUPLICATA_DOCUMENTO:% Já existe cadastro com este CPF ou Cartão SUS.', v_dup;
  END IF;

  IF v_novo THEN
    IF length(btrim(coalesce(p_dados ->> 'nome', ''))) < 3 THEN RAISE EXCEPTION 'Informe o nome do paciente.'; END IF;
    IF NOT p_outra_pessoa AND v_nasc IS NOT NULL THEN
      SELECT id INTO v_dup FROM public.pacientes
       WHERE unidade_id = v_unidade AND data_nascimento = v_nasc
         AND private.nome_comparavel(nome) = private.nome_comparavel(p_dados ->> 'nome')
       LIMIT 1;
      IF v_dup IS NOT NULL THEN
        RAISE EXCEPTION 'FICHA_DUPLICATA_PROVAVEL:% Já existe cadastro com o mesmo nome e nascimento.', v_dup;
      END IF;
    END IF;
    INSERT INTO public.pacientes (unidade_id, nome, prontuario, setor_id, cpf, cns)
    VALUES (v_unidade, btrim(p_dados ->> 'nome'), private.gerar_prontuario(v_unidade), p_setor, v_cpf, v_cns)
    RETURNING * INTO v_pac;
    PERFORM private.registrar_auditoria('criar', 'pacientes', v_pac.id, v_unidade, NULL);
  ELSE
    SELECT * INTO v_pac FROM public.pacientes WHERE id = p_paciente AND unidade_id = v_unidade AND ativo FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado nesta unidade.'; END IF;
    IF v_cpf IS NOT NULL THEN UPDATE public.pacientes SET cpf = v_cpf WHERE id = v_pac.id; END IF;
    IF v_cns IS NOT NULL THEN UPDATE public.pacientes SET cns = v_cns WHERE id = v_pac.id; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.episodios WHERE paciente_id = v_pac.id AND etapa <> 'encerrado') THEN
    RAISE EXCEPTION 'FICHA_EPISODIO_ABERTO: o paciente já está em atendimento nesta unidade.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes WHERE paciente_id = v_pac.id AND data_alta IS NULL) THEN
    RAISE EXCEPTION 'FICHA_INTERNADO: o paciente tem internação ativa.';
  END IF;

  -- identificação: grava só o que veio (vazio apaga o campo)
  FOREACH k IN ARRAY campos LOOP
    CONTINUE WHEN NOT (p_dados ? k) OR (k = 'nome' AND NOT v_novo AND length(btrim(coalesce(p_dados ->> k, ''))) < 3);
    EXECUTE format('UPDATE public.pacientes SET %I = $1 WHERE id = $2', k)
      USING nullif(btrim(p_dados ->> k), ''), v_pac.id;
  END LOOP;
  IF p_dados ? 'data_nascimento' THEN
    UPDATE public.pacientes SET data_nascimento = v_nasc WHERE id = v_pac.id;
  END IF;
  UPDATE public.pacientes SET setor_id = p_setor, updated_at = now() WHERE id = v_pac.id RETURNING * INTO v_pac;

  v_prio := ARRAY(SELECT DISTINCT x FROM unnest(
              array_remove(array_remove(coalesce(p_prioridades, '{}'), 'idoso_60'), 'idoso_80')
              || private.prioridades_por_idade(v_pac.data_nascimento, now())) x ORDER BY x);

  INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, prioridades_legais, aberto_por)
  VALUES (v_unidade, v_pac.id, p_setor, btrim(p_queixa), v_prio, v_perfil)
  RETURNING id INTO v_epi;
  PERFORM private.registrar_auditoria('criar', 'episodios', v_epi, v_unidade,
    jsonb_build_object('setor_id', p_setor, 'status', 'triagem'));

  RETURN jsonb_build_object('episodio_id', v_epi, 'paciente_id', v_pac.id, 'prontuario', v_pac.prontuario,
                            'prioridades_legais', to_jsonb(v_prio));
END $$;
REVOKE ALL ON FUNCTION public.registrar_ficha(uuid, text, uuid, jsonb, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ficha(uuid, text, uuid, jsonb, text[], boolean) TO authenticated;
