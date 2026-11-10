-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 1 do Portão de 11/10/2026: paciente não identificado na recepção.
-- Decisão do RT em 10/11/2026: A em N1, N2, N3 e N4
-- (docs/porta/LACUNA-01-NAO-IDENTIFICADO-DIAGNOSTICO.md).
--
-- N1. O nome provisório sai do servidor: "Não identificado <prontuário>"
--     (ex.: "Não identificado 2026.000123"), como o "RN 1 de <mãe>".
-- N2. A recepção registra o que se sabe: sexo aparente (F/M, opcional), idade
--     estimada em anos (opcional) e "sinais e quem trouxe" (texto, até 500
--     letras). A idade estimada usa o mecanismo que já existe
--     (data_nascimento + data_nascimento_estimada, 20261121000001): a triagem
--     escolhe adulto/pediatria por ela e a prescrição a aceita como idade. Sem
--     idade estimada, o nascimento fica vazio e valem as travas de hoje (a
--     triagem escolhe o grupo à mão; a prescrição pede idade e peso).
-- N3. Marca própria no cadastro, pacientes.identidade_desconhecida, separada
--     do "sem documento" da regulação (private.paciente_tem_documento não
--     muda; RNDS, API e regulação também não). As filas da triagem e do PS e a
--     lista de internados leem as colunas novas direto de pacientes (select
--     do PostgREST com RLS); nenhuma RPC de fila muda.
-- N4. "Identificar paciente" (public.identificar_paciente): nome (3 letras ou
--     mais) e, se houver, nascimento, sexo, CPF e CNS. Antes de gravar,
--     procura outro cadastro da unidade com o mesmo CPF ou CNS (sempre
--     bloqueia) ou com o mesmo nome e nascimento (bloqueia até a pessoa
--     confirmar que é outra). Achou: não grava e devolve os candidatos, para a
--     tela oferecer o pedido de unificação que já existe (pedir_unificacao;
--     outro gestor aprova). Não achou: grava, tira a marca, apaga os sinais do
--     cadastro e a marca de idade estimada quando vem a data real.
--     Histórico da identidade provisória: public.pacientes_identidade_provisoria
--     guarda o nome provisório, os sinais, o prontuário, o sexo aparente e a
--     idade estimada (gravados no cadastro provisório) e, na identificação,
--     quem identificou, quando e se a pessoa confirmou "é outra pessoa". RLS:
--     lê quem lê o paciente (mesmas políticas de SELECT de pacientes, pelo
--     EXISTS); ninguém grava direto, só as duas funções.
--     A auditoria (private.registrar_auditoria) continua sem dado de pessoa:
--     'cadastrar_nao_identificado' e 'identificar_paciente', com o id do
--     paciente (entidade_id), o setor e os nomes dos campos alterados.
--     salvar_cadastro_paciente passa a recusar troca de nome de quem está
--     marcado, para o nome provisório não se perder pela edição comum.
--
-- Só aditiva: duas colunas, uma tabela, dois índices, três funções novas e uma
-- troca de trecho em salvar_cadastro_paciente (feita no texto atual da função,
-- sem \r; trecho já trocado é pulado, trecho ausente para com erro).
-- Idempotente. Teste: supabase/tests/paciente_nao_identificado.sql
--
-- Rollback (na ordem):
--   1. desfazer a troca em salvar_cadastro_paciente: reaplicar a função de
--      20261003000003_cadastro_paciente.sql (o texto de hoje é o daquela
--      migration; md5 b62abbc4db8824dfd2e25391158e9ae9 na homologação em
--      10/11/2026, sem \r);
--   2. DROP FUNCTION IF EXISTS public.registrar_nao_identificado(uuid, text, text, numeric, text, text[]),
--        public.identificar_paciente(uuid, jsonb, boolean),
--        public.pacientes_nao_identificados(uuid);
--   3. DROP INDEX IF EXISTS public.pacientes_nao_identificados_idx;
--   4. DROP TABLE IF EXISTS public.pacientes_identidade_provisoria;
--      (apaga o histórico das identidades provisórias: exportar antes se já
--      houver linhas de uso real);
--   5. as colunas podem ficar (expand/contract). Para tirá-las de vez, numa
--      janela declarada e só depois de a tela sair do ar:
--      ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_sinais_identificacao_tamanho,
--        DROP COLUMN IF EXISTS sinais_identificacao, DROP COLUMN IF EXISTS identidade_desconhecida;
-- ════════════════════════════════════════════════════════════════════════════

-- ── N3. a marca e os sinais ─────────────────────────────────────────────────
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS identidade_desconhecida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sinais_identificacao text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pacientes_sinais_identificacao_tamanho'
                   AND conrelid = 'public.pacientes'::regclass) THEN
    ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_sinais_identificacao_tamanho
      CHECK (char_length(sinais_identificacao) <= 500);
  END IF;
END $$;
COMMENT ON COLUMN public.pacientes.identidade_desconhecida IS
  'Paciente sem identidade conhecida, cadastrado com nome provisório "Não identificado <prontuário>" (lacuna 1, RT 10/11/2026). Sai em identificar_paciente. Não é o "sem documento" da regulação.';
COMMENT ON COLUMN public.pacientes.sinais_identificacao IS
  'Sinais e quem trouxe o paciente não identificado (até 500 letras). Fica em pacientes_identidade_provisoria e sai do cadastro quando o paciente é identificado.';
CREATE INDEX IF NOT EXISTS pacientes_nao_identificados_idx ON public.pacientes (unidade_id)
  WHERE identidade_desconhecida AND ativo;

-- ── histórico da identidade provisória ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pacientes_identidade_provisoria (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id             uuid NOT NULL REFERENCES public.pacientes(id),
  unidade_id              uuid NOT NULL REFERENCES public.unidades(id),
  prontuario              text,
  nome_provisorio         text NOT NULL,
  sinais_identificacao    text CHECK (char_length(sinais_identificacao) <= 500),
  sexo_aparente           text CHECK (sexo_aparente IN ('F', 'M')),
  idade_estimada          numeric CHECK (idade_estimada BETWEEN 0 AND 130),
  criado_em               timestamptz NOT NULL DEFAULT now(),
  criado_por              uuid REFERENCES public.perfis(id),
  identificado_em         timestamptz,
  identificado_por        uuid REFERENCES public.perfis(id),
  outra_pessoa_confirmada boolean NOT NULL DEFAULT false
);
COMMENT ON TABLE public.pacientes_identidade_provisoria IS
  'Identidade provisória do paciente não identificado (lacuna 1, RT 10/11/2026): nome provisório, sinais, prontuário, quem cadastrou e quem identificou. Uma linha por cadastro; só as RPCs gravam.';
-- uma linha por cadastro provisório (e o índice de paciente_id)
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_identidade_provisoria_paciente
  ON public.pacientes_identidade_provisoria (paciente_id);
ALTER TABLE public.pacientes_identidade_provisoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pacientes_identidade_provisoria FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pacientes_identidade_provisoria TO authenticated;
-- lê quem lê o paciente: o EXISTS passa pelas políticas de SELECT de pacientes
-- (plantão, gestor, acesso ao atendimento, pedido de acesso, teleinterconsulta,
-- segundo fator), sem copiar o critério
DROP POLICY IF EXISTS pacientes_identidade_provisoria_select ON public.pacientes_identidade_provisoria;
CREATE POLICY pacientes_identidade_provisoria_select ON public.pacientes_identidade_provisoria
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id));

-- ── N1 e N2. cadastro provisório + ficha ────────────────────────────────────
-- Cria o cadastro com o nome provisório e abre a ficha por registrar_ficha
-- (mesmas regras: setor de emergência, plantão na porta ou gestor, queixa,
-- prioridades legais, episódio na fila da triagem).
CREATE OR REPLACE FUNCTION public.registrar_nao_identificado(
  p_setor uuid,
  p_queixa text,
  p_sexo text DEFAULT NULL,
  p_idade_estimada numeric DEFAULT NULL,
  p_sinais text DEFAULT NULL,
  p_prioridades text[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unidade uuid;
  v_tipo text;
  v_sexo text := nullif(btrim(coalesce(p_sexo, '')), '');
  v_sinais text := nullif(btrim(coalesce(p_sinais, '')), '');
  v_nasc date;
  v_pront text;
  v_pac public.pacientes;
  v_ficha jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT unidade_id, tipo INTO v_unidade, v_tipo FROM public.setores WHERE id = p_setor AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  IF v_tipo <> 'emergencia' THEN
    RAISE EXCEPTION 'A ficha de paciente não identificado abre numa porta (setor de emergência).';
  END IF;
  IF (private.eh_super_admin() OR private.papel_na_unidade(v_unidade) = 'gestor'
      OR p_setor IN (SELECT private.setores_na_escala_agora())) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  IF length(btrim(coalesce(p_queixa, ''))) < 3 THEN RAISE EXCEPTION 'Informe a queixa referida.'; END IF;
  IF v_sexo IS NOT NULL AND v_sexo NOT IN ('F', 'M') THEN
    RAISE EXCEPTION 'Sexo aparente: F (feminino), M (masculino) ou em branco.';
  END IF;
  IF p_idade_estimada IS NOT NULL AND (p_idade_estimada < 0 OR p_idade_estimada > 130) THEN
    RAISE EXCEPTION 'Informe a idade estimada em anos (de 0 a 130).';
  END IF;
  IF char_length(v_sinais) > 500 THEN
    RAISE EXCEPTION 'Sinais e quem trouxe: no máximo 500 letras.';
  END IF;

  -- mesma conta de registrar_idade_estimada (20261121000001)
  IF p_idade_estimada IS NOT NULL THEN
    v_nasc := ((now() AT TIME ZONE 'America/Sao_Paulo')::date
               - make_interval(months => round(p_idade_estimada * 12)::int))::date;
  END IF;

  v_pront := private.gerar_prontuario(v_unidade);
  -- INSERT: o gatilho da idade estimada só age no UPDATE, a marca entra aqui
  INSERT INTO public.pacientes (unidade_id, nome, prontuario, setor_id, sexo, data_nascimento,
                                data_nascimento_estimada, identidade_desconhecida, sinais_identificacao)
  VALUES (v_unidade, 'Não identificado ' || v_pront, v_pront, p_setor, v_sexo, v_nasc,
          v_nasc IS NOT NULL, true, v_sinais)
  RETURNING * INTO v_pac;
  INSERT INTO public.pacientes_identidade_provisoria
    (paciente_id, unidade_id, prontuario, nome_provisorio, sinais_identificacao, sexo_aparente, idade_estimada, criado_por)
  VALUES (v_pac.id, v_unidade, v_pront, v_pac.nome, v_sinais, v_sexo, p_idade_estimada, private.meu_perfil_id());
  -- auditoria sem dado de pessoa: o id do paciente (entidade_id) e o setor
  PERFORM private.registrar_auditoria('cadastrar_nao_identificado', 'pacientes', v_pac.id, v_unidade,
    jsonb_build_object('setor_id', p_setor));

  -- a ficha: cadastro existente, sem dados de identificação (a idade estimada
  -- já está no cadastro e entra na prioridade 60+/80+)
  v_ficha := public.registrar_ficha(p_setor, p_queixa, v_pac.id, '{}'::jsonb, coalesce(p_prioridades, '{}'), true);

  RETURN v_ficha || jsonb_build_object('nome', v_pac.nome, 'data_nascimento', v_nasc,
                                       'data_nascimento_estimada', v_nasc IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.registrar_nao_identificado(uuid, text, text, numeric, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_nao_identificado(uuid, text, text, numeric, text, text[]) TO authenticated;

-- ── N4. identificar ─────────────────────────────────────────────────────────
-- p_dados: nome (obrigatório), data_nascimento, sexo, cpf, cns (opcionais).
-- Devolve {identificado: true, ...} quando grava, ou {identificado: false,
-- motivo: 'documento' | 'nome_nascimento', candidatos: [...]} quando acha
-- outro cadastro. 'documento' sempre bloqueia; 'nome_nascimento' passa com
-- p_outra_pessoa = true (a pessoa confirmou que é outra).
CREATE OR REPLACE FUNCTION public.identificar_paciente(
  p_paciente uuid,
  p_dados jsonb,
  p_outra_pessoa boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pac public.pacientes;
  v_novo public.pacientes;
  v_dados jsonb;
  v_nome text;
  v_cpf text;
  v_cns text;
  v_sexo text;
  v_nasc date;
  v_cand jsonb;
  v_campos text[] := ARRAY['nome'];
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  p_dados := coalesce(p_dados, '{}'::jsonb);

  SELECT * INTO v_pac FROM public.pacientes WHERE id = p_paciente AND ativo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  -- quem cuida do paciente agora, a recepção e o gestor da unidade (como registrar_idade_estimada)
  IF (private.eh_super_admin() OR private.pode_atuar_no_paciente(v_pac.id)
      OR private.tenho_papel(v_pac.unidade_id, 'recepcao') OR private.tenho_papel(v_pac.unidade_id, 'gestor')) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.';
  END IF;
  IF NOT v_pac.identidade_desconhecida THEN
    RAISE EXCEPTION 'Este paciente já está identificado. Para corrigir o nome, use o cadastro.';
  END IF;

  v_nome := regexp_replace(btrim(coalesce(p_dados ->> 'nome', '')), '\s+', ' ', 'g');
  IF length(regexp_replace(coalesce(private.nome_comparavel(v_nome), ''), '[^a-z]', '', 'g')) < 3 THEN
    RAISE EXCEPTION 'Informe o nome do paciente (ao menos 3 letras).';
  END IF;
  IF private.nome_comparavel(v_nome) LIKE 'nao identificado%' THEN
    RAISE EXCEPTION 'Informe o nome verdadeiro do paciente.';
  END IF;
  v_cpf := private.so_digitos(p_dados ->> 'cpf');
  v_cns := private.so_digitos(p_dados ->> 'cns');
  v_sexo := nullif(btrim(coalesce(p_dados ->> 'sexo', '')), '');
  -- só o que esta ação grava passa pela conferência de sempre
  v_dados := jsonb_strip_nulls(jsonb_build_object('nome', v_nome, 'cpf', v_cpf, 'cns', v_cns, 'sexo', v_sexo,
                                                  'data_nascimento', nullif(btrim(coalesce(p_dados ->> 'data_nascimento', '')), '')));
  PERFORM private.conferir_cadastro(v_dados, v_pac);
  v_nasc := (v_dados ->> 'data_nascimento')::date;

  -- mesmo CPF ou CNS: sempre bloqueia (o índice único da unidade não aceita dois)
  SELECT jsonb_agg(jsonb_build_object(
           'id', c.id, 'nome', c.nome, 'nome_social', c.nome_social, 'data_nascimento', c.data_nascimento,
           'nome_mae', c.nome_mae, 'prontuario', c.prontuario, 'ativo', c.ativo,
           'aberto', EXISTS (SELECT 1 FROM public.episodios e WHERE e.paciente_id = c.id AND e.etapa <> 'encerrado'),
           'regra', 'documento') ORDER BY c.created_at)
    INTO v_cand
    FROM public.pacientes c
   WHERE c.unidade_id = v_pac.unidade_id AND c.id <> v_pac.id
     AND ((v_cpf IS NOT NULL AND c.cpf = v_cpf) OR (v_cns IS NOT NULL AND c.cns = v_cns));
  IF v_cand IS NOT NULL THEN
    RETURN jsonb_build_object('identificado', false, 'motivo', 'documento', 'candidatos', v_cand);
  END IF;

  -- mesmo nome e nascimento (sem acento e sem maiúscula, como na ficha): até confirmar que é outra pessoa
  IF v_nasc IS NOT NULL AND p_outra_pessoa IS NOT TRUE THEN
    SELECT jsonb_agg(jsonb_build_object(
             'id', c.id, 'nome', c.nome, 'nome_social', c.nome_social, 'data_nascimento', c.data_nascimento,
             'nome_mae', c.nome_mae, 'prontuario', c.prontuario, 'ativo', c.ativo,
             'aberto', EXISTS (SELECT 1 FROM public.episodios e WHERE e.paciente_id = c.id AND e.etapa <> 'encerrado'),
             'regra', 'nome_nascimento') ORDER BY c.created_at)
      INTO v_cand
      FROM public.pacientes c
     WHERE c.unidade_id = v_pac.unidade_id AND c.id <> v_pac.id AND c.ativo
       AND c.data_nascimento = v_nasc
       AND private.nome_comparavel(c.nome) = private.nome_comparavel(v_nome);
    IF v_cand IS NOT NULL THEN
      RETURN jsonb_build_object('identificado', false, 'motivo', 'nome_nascimento', 'candidatos', v_cand);
    END IF;
  END IF;

  IF v_nasc IS NOT NULL THEN v_campos := v_campos || 'data_nascimento'::text; END IF;
  IF v_sexo IS NOT NULL AND v_sexo IS DISTINCT FROM v_pac.sexo THEN v_campos := v_campos || 'sexo'::text; END IF;
  IF v_cpf IS NOT NULL THEN v_campos := v_campos || 'cpf'::text; END IF;
  IF v_cns IS NOT NULL THEN v_campos := v_campos || 'cns'::text; END IF;

  -- a marca de idade estimada é decidida aqui: data real informada apaga a marca
  PERFORM set_config('chefe.idade_estimada', '1', true);
  UPDATE public.pacientes
     SET nome = v_nome,
         data_nascimento = coalesce(v_nasc, data_nascimento),
         data_nascimento_estimada = CASE WHEN v_nasc IS NOT NULL THEN false ELSE data_nascimento_estimada END,
         sexo = coalesce(v_sexo, sexo),
         cpf = coalesce(v_cpf, cpf),
         cns = coalesce(v_cns, cns),
         identidade_desconhecida = false,
         sinais_identificacao = NULL,
         updated_at = now()
   WHERE id = v_pac.id
  RETURNING * INTO v_novo;
  PERFORM set_config('chefe.idade_estimada', '', true);

  -- histórico: a linha do cadastro provisório ganha quem identificou e quando
  -- (cadastro marcado sem linha, por exemplo à mão, ganha a linha agora)
  UPDATE public.pacientes_identidade_provisoria
     SET identificado_em = now(), identificado_por = private.meu_perfil_id(),
         outra_pessoa_confirmada = coalesce(p_outra_pessoa, false)
   WHERE paciente_id = v_pac.id AND identificado_em IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.pacientes_identidade_provisoria
      (paciente_id, unidade_id, prontuario, nome_provisorio, sinais_identificacao, sexo_aparente, criado_por,
       identificado_em, identificado_por, outra_pessoa_confirmada)
    VALUES (v_pac.id, v_pac.unidade_id, v_pac.prontuario, v_pac.nome, v_pac.sinais_identificacao,
            CASE WHEN v_pac.sexo IN ('F', 'M') THEN v_pac.sexo END, NULL,
            now(), private.meu_perfil_id(), coalesce(p_outra_pessoa, false))
    ON CONFLICT (paciente_id) DO UPDATE
      SET identificado_em = EXCLUDED.identificado_em, identificado_por = EXCLUDED.identificado_por,
          outra_pessoa_confirmada = EXCLUDED.outra_pessoa_confirmada;
  END IF;

  -- auditoria sem dado de pessoa: o id do paciente (entidade_id) e os nomes dos
  -- campos alterados (payload_auditoria transforma o objeto em campos_alterados)
  PERFORM private.registrar_auditoria('identificar_paciente', 'pacientes', v_pac.id, v_pac.unidade_id,
    jsonb_build_object('campos', (SELECT jsonb_object_agg(c, true) FROM unnest(v_campos || ARRAY['identidade_desconhecida', 'sinais_identificacao']) c)));

  RETURN jsonb_build_object('identificado', true, 'paciente_id', v_novo.id, 'prontuario', v_novo.prontuario,
                            'nome', v_novo.nome);
END $$;
REVOKE ALL ON FUNCTION public.identificar_paciente(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.identificar_paciente(uuid, jsonb, boolean) TO authenticated;

-- ── a lista da recepção ─────────────────────────────────────────────────────
-- Cadastros ativos da unidade ainda marcados, com onde estão agora. Só
-- identificação provisória (nada clínico), para a recepção ou o gestor.
CREATE OR REPLACE FUNCTION public.pacientes_nao_identificados(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF (private.eh_super_admin() OR private.pode_pedir_unificacao(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: recepção ou gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', p.id, 'nome', p.nome, 'prontuario', p.prontuario, 'sexo', p.sexo,
             'data_nascimento', p.data_nascimento, 'data_nascimento_estimada', p.data_nascimento_estimada,
             'sinais_identificacao', p.sinais_identificacao, 'criado_em', p.created_at,
             'setor', s.nome, 'episodio_id', ep.id, 'etapa', ep.etapa) ORDER BY p.created_at)
      FROM public.pacientes p
      LEFT JOIN public.setores s ON s.id = p.setor_id
      LEFT JOIN LATERAL (SELECT e.id, e.etapa FROM public.episodios e
                          WHERE e.paciente_id = p.id AND e.etapa <> 'encerrado'
                          ORDER BY e.chegada_em DESC LIMIT 1) ep ON true
     WHERE p.unidade_id = p_unidade AND p.ativo AND p.identidade_desconhecida), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.pacientes_nao_identificados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pacientes_nao_identificados(uuid) TO authenticated;

-- ── edição comum não troca o nome de quem está marcado ──────────────────────
-- Trecho trocado no texto atual (sem \r). Já trocado: pula. Ausente: para.
CREATE OR REPLACE FUNCTION pg_temp.trocar_ni(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(replace(p_pares[k + 1], chr(13), '') IN novo) > 0;
    IF position(replace(p_pares[k], chr(13), '') IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, replace(p_pares[k], chr(13), ''), replace(p_pares[k + 1], chr(13), ''));
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

SELECT pg_temp.trocar_ni('public.salvar_cadastro_paciente(uuid, jsonb, uuid, boolean)',
$a$    IF p_dados ? 'nome' AND length(btrim(coalesce(p_dados ->> 'nome', ''))) < 3 THEN
      RAISE EXCEPTION 'O nome do paciente não pode ficar vazio.';
    END IF;$a$,
$b$    IF p_dados ? 'nome' AND length(btrim(coalesce(p_dados ->> 'nome', ''))) < 3 THEN
      RAISE EXCEPTION 'O nome do paciente não pode ficar vazio.';
    END IF;
    -- lacuna 1 (RT 10/11/2026): o nome provisório só sai por identificar_paciente
    IF v_pac.identidade_desconhecida AND p_dados ? 'nome' AND btrim(p_dados ->> 'nome') IS DISTINCT FROM v_pac.nome THEN
      RAISE EXCEPTION 'Paciente não identificado: use "Identificar paciente" para gravar o nome.';
    END IF;$b$);

DROP FUNCTION pg_temp.trocar_ni(regprocedure, text[]);
