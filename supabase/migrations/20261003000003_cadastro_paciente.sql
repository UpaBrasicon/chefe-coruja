-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend — cadastro do paciente e recepção (protótipo: rec-cadastro,
-- rec-fila-enf, rec-fila-med, rec-painel; cadastro completo da porta).
--
-- • Paciente ganha raça/cor (categorias do IBGE usadas pelo SUS; obrigatória
--   no laudo de AIH, "sem informação" é resposta válida), categoria (SUS,
--   convênio, particular) e convênio. Estado civil já existia (Fase 2.1).
-- • CPF e CNS conferidos no servidor (dígitos verificadores; CNS pelo
--   algoritmo do Ministério da Saúde). Só vale para valor NOVO ou ALTERADO:
--   cadastro antigo com documento fora da regra continua gravável.
-- • registrar_ficha grava os campos novos (mesma assinatura).
-- • salvar_cadastro_paciente: cadastrar ou completar/corrigir o cadastro fora
--   da ficha (a porta, "Salvar e usar neste atendimento"), com as mesmas
--   checagens de duplicata da ficha. Substitui o INSERT direto da tela.
-- • fila_da_porta / ultimas_chamadas_porta: o que a Recepção acompanha — as
--   duas filas com cor, espera e situação da chamada, e as últimas chamadas com
--   quem chamou (nome de quem chamou não é legível pela RLS de perfis).
-- • atendimentos_do_paciente: vindas anteriores, só as que a RLS de episódios
--   deixaria ver, com o nome do médico.
-- Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── colunas ─────────────────────────────────────────────────────────────────
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS raca_cor text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS convenio text;

ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_raca_cor_check;
ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_raca_cor_check
  CHECK (raca_cor IS NULL OR raca_cor IN ('branca', 'preta', 'parda', 'amarela', 'indigena', 'sem_informacao'));
ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_categoria_check;
ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_categoria_check
  CHECK (categoria IS NULL OR categoria IN ('sus', 'convenio', 'particular'));

COMMENT ON COLUMN public.pacientes.raca_cor IS
  'IBGE/SUS: branca (01), preta (02), parda (03), amarela (04), indigena (05), sem_informacao (99).';

-- ── documentos ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.cpf_valido(p text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  s int; t int; i int;
BEGIN
  IF length(d) <> 11 OR d = repeat(left(d, 1), 11) THEN RETURN false; END IF;
  FOR t IN 9..10 LOOP
    s := 0;
    FOR i IN 1..t LOOP s := s + substr(d, i, 1)::int * (t + 2 - i); END LOOP;
    IF (s * 10) % 11 % 10 <> substr(d, t + 1, 1)::int THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

-- CNS (Ministério da Saúde): definitivo começa com 1 ou 2 e é gerado do PIS
-- (11 primeiros dígitos + "000" + DV, ou "001" + DV quando o DV daria 10);
-- provisório começa com 7, 8 ou 9 e a soma ponderada (15..1) é múltipla de 11.
CREATE OR REPLACE FUNCTION private.cns_valido(p text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  pis text; soma int := 0; dv int; i int;
BEGIN
  IF length(d) <> 15 THEN RETURN false; END IF;
  IF left(d, 1) IN ('1', '2') THEN
    pis := left(d, 11);
    FOR i IN 1..11 LOOP soma := soma + substr(pis, i, 1)::int * (16 - i); END LOOP;
    dv := 11 - soma % 11;
    IF dv = 11 THEN dv := 0; END IF;
    IF dv = 10 THEN
      soma := soma + 2;
      dv := 11 - soma % 11;
      RETURN d = pis || '001' || dv::text;
    END IF;
    RETURN d = pis || '000' || dv::text;
  ELSIF left(d, 1) IN ('7', '8', '9') THEN
    FOR i IN 1..15 LOOP soma := soma + substr(d, i, 1)::int * (16 - i); END LOOP;
    RETURN soma % 11 = 0;
  END IF;
  RETURN false;
END $$;

-- Toda gravação (RPC ou escrita direta permitida pela RLS): documento guardado
-- só com dígitos; conferido quando é novo ou mudou.
CREATE OR REPLACE FUNCTION private.pacientes_conferir_documentos() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.cpf := private.so_digitos(NEW.cpf);
  NEW.cns := private.so_digitos(NEW.cns);
  IF NEW.cpf IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.cpf IS DISTINCT FROM private.so_digitos(OLD.cpf))
     AND NOT private.cpf_valido(NEW.cpf) THEN
    RAISE EXCEPTION 'CPF inválido: os dígitos verificadores não conferem.';
  END IF;
  IF NEW.cns IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.cns IS DISTINCT FROM private.so_digitos(OLD.cns))
     AND NOT private.cns_valido(NEW.cns) THEN
    RAISE EXCEPTION 'Cartão SUS inválido: são 15 dígitos e o número não confere.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pacientes_documentos ON public.pacientes;
CREATE TRIGGER trg_pacientes_documentos BEFORE INSERT OR UPDATE OF cpf, cns ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION private.pacientes_conferir_documentos();

-- Conferência do que veio no p_dados, antes das checagens de duplicata (a
-- mensagem sai clara). Compara com o cadastro atual: o que não mudou não é
-- conferido de novo.
CREATE OR REPLACE FUNCTION private.conferir_cadastro(p_dados jsonb, p_atual public.pacientes DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_cpf text := private.so_digitos(p_dados ->> 'cpf');
  v_cns text := private.so_digitos(p_dados ->> 'cns');
  v_nasc date;
  v text;
BEGIN
  IF v_cpf IS NOT NULL AND v_cpf IS DISTINCT FROM private.so_digitos(p_atual.cpf) AND NOT private.cpf_valido(v_cpf) THEN
    RAISE EXCEPTION 'CPF inválido: os dígitos verificadores não conferem.';
  END IF;
  IF v_cns IS NOT NULL AND v_cns IS DISTINCT FROM private.so_digitos(p_atual.cns) AND NOT private.cns_valido(v_cns) THEN
    RAISE EXCEPTION 'Cartão SUS inválido: são 15 dígitos e o número não confere.';
  END IF;
  BEGIN
    v_nasc := nullif(p_dados ->> 'data_nascimento', '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Data de nascimento inválida.';
  END;
  IF v_nasc IS NOT NULL AND v_nasc IS DISTINCT FROM p_atual.data_nascimento THEN
    IF v_nasc > private.data_atual() THEN RAISE EXCEPTION 'Data de nascimento no futuro.'; END IF;
    IF v_nasc < private.data_atual() - interval '130 years' THEN
      RAISE EXCEPTION 'Data de nascimento com mais de 130 anos. Confira o ano.';
    END IF;
  END IF;
  v := nullif(btrim(p_dados ->> 'uf'), '');
  IF v IS NOT NULL AND v !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'UF com duas letras maiúsculas.'; END IF;
  v := nullif(btrim(p_dados ->> 'sexo'), '');
  IF v IS NOT NULL AND v IS DISTINCT FROM p_atual.sexo AND v NOT IN ('F', 'M') THEN
    RAISE EXCEPTION 'Sexo: F (feminino) ou M (masculino).';
  END IF;
  v := nullif(btrim(p_dados ->> 'raca_cor'), '');
  IF v IS NOT NULL AND v NOT IN ('branca', 'preta', 'parda', 'amarela', 'indigena', 'sem_informacao') THEN
    RAISE EXCEPTION 'Raça/cor: branca, preta, parda, amarela, indígena ou sem informação.';
  END IF;
  v := nullif(btrim(p_dados ->> 'categoria'), '');
  IF v IS NOT NULL AND v NOT IN ('sus', 'convenio', 'particular') THEN
    RAISE EXCEPTION 'Categoria: SUS, convênio ou particular.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.conferir_cadastro(jsonb, public.pacientes) FROM PUBLIC, anon, authenticated;

-- ── ficha ───────────────────────────────────────────────────────────────────
-- Mesma assinatura e mesmos códigos de erro da Fase 2.1; grava raça/cor,
-- categoria e convênio e confere os documentos antes das duplicatas.
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
  v_atual public.pacientes;
  v_dup uuid;
  v_cpf text := private.so_digitos(p_dados ->> 'cpf');
  v_cns text := private.so_digitos(p_dados ->> 'cns');
  v_nasc date;
  v_epi uuid;
  v_prio text[];
  v_novo boolean := p_paciente IS NULL;
  campos text[] := ARRAY['nome', 'nome_social', 'nome_mae', 'sexo', 'estado_civil', 'raca_cor', 'categoria',
                         'convenio', 'telefone', 'endereco', 'municipio', 'uf', 'responsavel_nome',
                         'responsavel_parentesco', 'responsavel_documento', 'responsavel_telefone'];
  k text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  p_dados := coalesce(p_dados, '{}'::jsonb);

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

  IF NOT v_novo THEN
    SELECT * INTO v_atual FROM public.pacientes WHERE id = p_paciente AND unidade_id = v_unidade AND ativo;
  END IF;
  PERFORM private.conferir_cadastro(p_dados, v_atual);
  v_nasc := nullif(p_dados ->> 'data_nascimento', '')::date;

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

-- ── cadastrar / completar / corrigir fora da ficha ─────────────────────────
-- p_paciente NULL = pessoa nova no setor p_setor (quem está de plantão nele,
-- gestor ou super admin). Com p_paciente, quem pode atuar no paciente grava
-- só os campos enviados (vazio apaga; nome nunca fica vazio).
-- Erros com código, como na ficha:
--   CADASTRO_DUPLICATA_DOCUMENTO:<id>  mesmo CPF/CNS em outro cadastro
--   CADASTRO_DUPLICATA_PROVAVEL:<id>   mesmo nome + nascimento (confirme p_outra_pessoa)
CREATE OR REPLACE FUNCTION public.salvar_cadastro_paciente(
  p_paciente uuid DEFAULT NULL,
  p_dados jsonb DEFAULT '{}'::jsonb,
  p_setor uuid DEFAULT NULL,
  p_outra_pessoa boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  v_pac public.pacientes;
  v_dup uuid;
  v_cpf text := private.so_digitos(p_dados ->> 'cpf');
  v_cns text := private.so_digitos(p_dados ->> 'cns');
  v_nasc date;
  v_novo boolean := p_paciente IS NULL;
  v_alterados jsonb := '{}'::jsonb;
  v_n integer;
  campos text[] := ARRAY['nome', 'nome_social', 'nome_mae', 'sexo', 'estado_civil', 'raca_cor', 'categoria',
                         'convenio', 'telefone', 'endereco', 'municipio', 'uf', 'responsavel_nome',
                         'responsavel_parentesco', 'responsavel_documento', 'responsavel_telefone'];
  k text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  p_dados := coalesce(p_dados, '{}'::jsonb);

  IF v_novo THEN
    SELECT unidade_id INTO v_unidade FROM public.setores WHERE id = p_setor AND ativo;
    IF v_unidade IS NULL THEN RAISE EXCEPTION 'Informe o setor em que o paciente está.'; END IF;
    IF (private.eh_super_admin() OR private.papel_na_unidade(v_unidade) = 'gestor'
        OR p_setor IN (SELECT private.setores_na_escala_agora())) IS NOT TRUE THEN
      RAISE EXCEPTION 'Acesso negado: você não está de plantão neste setor.';
    END IF;
    IF length(btrim(coalesce(p_dados ->> 'nome', ''))) < 3 THEN RAISE EXCEPTION 'Informe o nome do paciente.'; END IF;
  ELSE
    SELECT * INTO v_pac FROM public.pacientes WHERE id = p_paciente AND ativo FOR UPDATE;
    IF NOT FOUND OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
      RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.';
    END IF;
    v_unidade := v_pac.unidade_id;
    IF p_dados ? 'nome' AND length(btrim(coalesce(p_dados ->> 'nome', ''))) < 3 THEN
      RAISE EXCEPTION 'O nome do paciente não pode ficar vazio.';
    END IF;
  END IF;

  PERFORM private.conferir_cadastro(p_dados, v_pac);
  v_nasc := nullif(p_dados ->> 'data_nascimento', '')::date;

  SELECT id INTO v_dup FROM public.pacientes
   WHERE unidade_id = v_unidade AND id IS DISTINCT FROM p_paciente
     AND ((v_cpf IS NOT NULL AND cpf = v_cpf) OR (v_cns IS NOT NULL AND cns = v_cns))
   LIMIT 1;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'CADASTRO_DUPLICATA_DOCUMENTO:% Já existe cadastro com este CPF ou Cartão SUS.', v_dup;
  END IF;

  IF v_novo THEN
    IF NOT p_outra_pessoa AND v_nasc IS NOT NULL THEN
      SELECT id INTO v_dup FROM public.pacientes
       WHERE unidade_id = v_unidade AND data_nascimento = v_nasc
         AND private.nome_comparavel(nome) = private.nome_comparavel(p_dados ->> 'nome')
       LIMIT 1;
      IF v_dup IS NOT NULL THEN
        RAISE EXCEPTION 'CADASTRO_DUPLICATA_PROVAVEL:% Já existe cadastro com o mesmo nome e nascimento.', v_dup;
      END IF;
    END IF;
    INSERT INTO public.pacientes (unidade_id, nome, prontuario, setor_id, cpf, cns)
    VALUES (v_unidade, btrim(p_dados ->> 'nome'), private.gerar_prontuario(v_unidade), p_setor, v_cpf, v_cns)
    RETURNING * INTO v_pac;
  ELSE
    IF p_dados ? 'cpf' AND v_cpf IS DISTINCT FROM v_pac.cpf THEN
      UPDATE public.pacientes SET cpf = v_cpf WHERE id = v_pac.id;
      v_alterados := v_alterados || '{"cpf": true}';
    END IF;
    IF p_dados ? 'cns' AND v_cns IS DISTINCT FROM v_pac.cns THEN
      UPDATE public.pacientes SET cns = v_cns WHERE id = v_pac.id;
      v_alterados := v_alterados || '{"cns": true}';
    END IF;
  END IF;

  FOREACH k IN ARRAY campos LOOP
    CONTINUE WHEN NOT (p_dados ? k);
    EXECUTE format('UPDATE public.pacientes SET %I = $1 WHERE id = $2 AND %I IS DISTINCT FROM $1', k, k)
      USING nullif(btrim(p_dados ->> k), ''), v_pac.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;  -- EXECUTE não mexe em FOUND
    IF v_n > 0 THEN v_alterados := v_alterados || jsonb_build_object(k, true); END IF;
  END LOOP;
  IF p_dados ? 'data_nascimento' AND v_nasc IS DISTINCT FROM v_pac.data_nascimento THEN
    UPDATE public.pacientes SET data_nascimento = v_nasc WHERE id = v_pac.id;
    v_alterados := v_alterados || '{"data_nascimento": true}';
  END IF;
  UPDATE public.pacientes SET updated_at = now() WHERE id = v_pac.id RETURNING * INTO v_pac;

  IF v_novo THEN
    PERFORM private.registrar_auditoria('criar', 'pacientes', v_pac.id, v_unidade, jsonb_build_object('setor_id', p_setor));
  ELSIF v_alterados <> '{}'::jsonb THEN
    -- só os NOMES dos campos alterados; valores não vão para a auditoria
    PERFORM private.registrar_auditoria('editar', 'pacientes', v_pac.id, v_unidade, jsonb_build_object('campos', v_alterados));
  END IF;

  RETURN jsonb_build_object('paciente_id', v_pac.id, 'prontuario', v_pac.prontuario, 'setor_id', v_pac.setor_id);
END $$;
REVOKE ALL ON FUNCTION public.salvar_cadastro_paciente(uuid, jsonb, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_cadastro_paciente(uuid, jsonb, uuid, boolean) TO authenticated;

-- ── o que a Recepção acompanha ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.acompanha_porta(p_setor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.setores s
     WHERE s.id = p_setor AND s.tipo = 'emergencia'
       AND (private.eh_super_admin() OR private.papel_na_unidade(s.unidade_id) = 'gestor'
            OR p_setor IN (SELECT private.setores_na_escala_agora())))
$$;
REVOKE ALL ON FUNCTION private.acompanha_porta(uuid) FROM PUBLIC, anon, authenticated;

-- As duas filas da porta: triagem (desde a chegada) e médica (desde a
-- classificação). Identificação, queixa referida, prioridade, cor e a última
-- chamada da etapa (sala e quem chamou). Nada de conteúdo clínico.
CREATE OR REPLACE FUNCTION public.fila_da_porta(p_setor uuid)
RETURNS TABLE (episodio_id uuid, etapa text, chegada_em timestamptz, classificado_em timestamptz, cor_atual text,
               queixa text, prioridades_legais text[], nome text, nome_social text, data_nascimento date,
               atendimento_iniciado_em timestamptz, medico text, chamadas integer, ultima_sala text,
               ultimo_chamador text, ultima_chamada_em timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF private.acompanha_porta(p_setor) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  RETURN QUERY
  SELECT e.id, e.etapa, e.chegada_em, e.classificado_em, e.cor_atual, e.queixa, e.prioridades_legais,
         p.nome, p.nome_social, p.data_nascimento, e.atendimento_iniciado_em, med.nome_completo,
         coalesce(ch.numero, 0), ch.sala, ch.quem, ch.criado_em
  FROM public.episodios e
  JOIN public.pacientes p ON p.id = e.paciente_id
  LEFT JOIN public.perfis med ON med.id = e.atendimento_medico_id
  LEFT JOIN LATERAL (
    SELECT c.numero, sa.nome AS sala, pf.nome_completo AS quem, c.criado_em
      FROM public.chamadas c
      JOIN public.salas sa ON sa.id = c.sala_id
      LEFT JOIN public.perfis pf ON pf.id = c.chamado_por
     WHERE c.episodio_id = e.id AND c.etapa = e.etapa
     ORDER BY c.criado_em DESC LIMIT 1) ch ON true
  WHERE e.setor_id = p_setor AND e.etapa IN ('triagem', 'atendimento')
  ORDER BY e.chegada_em;
END $$;
REVOKE ALL ON FUNCTION public.fila_da_porta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fila_da_porta(uuid) TO authenticated;

-- Últimas chamadas da porta (o que a TV mostra, mais quem chamou).
CREATE OR REPLACE FUNCTION public.ultimas_chamadas_porta(p_setor uuid, p_limite integer DEFAULT 8)
RETURNS TABLE (id uuid, criado_em timestamptz, nome text, sala text, quem text, etapa text, numero integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF private.acompanha_porta(p_setor) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  RETURN QUERY
  SELECT c.id, c.criado_em, coalesce(nullif(p.nome_social, ''), p.nome), sa.nome, pf.nome_completo, c.etapa, c.numero
  FROM public.chamadas c
  JOIN public.episodios e ON e.id = c.episodio_id
  JOIN public.pacientes p ON p.id = e.paciente_id
  JOIN public.salas sa ON sa.id = c.sala_id
  LEFT JOIN public.perfis pf ON pf.id = c.chamado_por
  WHERE c.setor_id = p_setor AND c.criado_em > now() - interval '12 hours'
  ORDER BY c.criado_em DESC
  LIMIT greatest(1, least(coalesce(p_limite, 8), 30));
END $$;
REVOKE ALL ON FUNCTION public.ultimas_chamadas_porta(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ultimas_chamadas_porta(uuid, integer) TO authenticated;

-- ── atendimentos anteriores do paciente ─────────────────────────────────────
-- Só as vindas que as políticas de SELECT de episodios deixariam ver
-- (plantão no setor, gestor, super admin, pedido de acesso ou
-- teleinterconsulta vigentes); o definer serve para ler o nome do médico.
CREATE OR REPLACE FUNCTION public.atendimentos_do_paciente(p_paciente uuid)
RETURNS TABLE (id uuid, setor text, etapa text, chegada_em timestamptz, encerrado_em timestamptz,
               desfecho text, cor_atual text, prestador text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  RETURN QUERY
  SELECT e.id, s.nome, e.etapa, e.chegada_em, e.encerrado_em, e.desfecho, e.cor_atual, pf.nome_completo
  FROM public.episodios e
  JOIN public.setores s ON s.id = e.setor_id
  LEFT JOIN public.perfis pf ON pf.id = e.atendimento_medico_id
  WHERE e.paciente_id = p_paciente
    AND (   private.eh_super_admin()
         OR private.papel_na_unidade(e.unidade_id) = 'gestor'
         OR e.setor_id IN (SELECT private.setores_na_escala_agora())
         OR private.acesso_encerrado_vigente(e.paciente_id)
         OR private.teleinterconsulta_vigente(e.paciente_id))
  ORDER BY e.chegada_em DESC
  LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION public.atendimentos_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atendimentos_do_paciente(uuid) TO authenticated;

-- ── atendimento aberto (a Recepção avisa antes de tentar a ficha) ───────────
-- Um paciente tem no máximo um episódio aberto (episodios_um_aberto_por_paciente;
-- a regra não muda). A busca já diz a etapa; aqui vem desde quando e onde,
-- para o aviso — só identificação administrativa, nada clínico. Mesmo acesso
-- da busca: quem está de plantão na unidade, gestor ou super admin.
CREATE OR REPLACE FUNCTION public.atendimento_aberto_do_paciente(p_paciente uuid)
RETURNS TABLE (episodio_id uuid, chegada_em timestamptz, setor text, etapa text,
               em_atendimento boolean, na_minha_porta boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR (private.eh_super_admin() OR private.papel_na_unidade(v_unidade) = 'gestor'
      OR private.na_escala_agora(v_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: só para quem está de plantão na unidade.';
  END IF;
  RETURN QUERY
  SELECT e.id, e.chegada_em, s.nome, e.etapa, e.atendimento_iniciado_em IS NOT NULL,
         e.setor_id IN (SELECT private.setores_na_escala_agora())
  FROM public.episodios e
  JOIN public.setores s ON s.id = e.setor_id
  WHERE e.paciente_id = p_paciente AND e.etapa <> 'encerrado'
  LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.atendimento_aberto_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atendimento_aberto_do_paciente(uuid) TO authenticated;
