-- Portão 2, tarefa 5 (lacuna R2.6): recém-nascido vinculado à mãe. Decisões do
-- RT em 16/10/2026 ("1a 2a 3a 4a 5b 6a"); formato "RN de Maria da Silva"
-- decidido no relatório da Rodada 2 (pergunta 4).
--
--  1a. Cadastro "RN de" só até 27 dias de vida (a faixa de neonato da regulação).
--  2a. A mãe precisa ter cadastro na unidade; o RN fica ligado a ele (mae_id).
--  3a. Gêmeos: "RN 1 de Maria da Silva", "RN 2 de Maria da Silva".
--  4a. Na regulação, o RN conta como identificado quando a mãe tem CNS ou CPF
--      válido; a solicitação mostra o documento da mãe.
--  5b. Cadastro pela recepção e a partir do leito da mãe (quem está na escala
--      da unidade agora, ou o gestor).
--  6a. Quando o RN ganha nome e CNS próprios, edita-se o cadastro normal; o
--      vínculo com a mãe continua.
--
-- Os corpos de regulacao_solicitar, regulacao_vinculos_paciente e
-- private.regulacao_json foram conferidos (md5) iguais no local e na produção
-- em 16/10/2026. Os trechos trocados são procurados sem \r (lição da tarefa 2).

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS mae_id uuid REFERENCES public.pacientes(id),
  ADD COLUMN IF NOT EXISTS rn_ordem smallint CHECK (rn_ordem BETWEEN 1 AND 9);
COMMENT ON COLUMN public.pacientes.mae_id IS 'Cadastro da mãe (recém-nascido vinculado, Portão 2 tarefa 5). O vínculo continua depois que o RN ganha nome e documento próprios.';
COMMENT ON COLUMN public.pacientes.rn_ordem IS 'Ordem do gemelar no cadastro "RN N de <mãe>"; nulo = parto único.';
CREATE INDEX IF NOT EXISTS pacientes_mae_id_idx ON public.pacientes (mae_id) WHERE mae_id IS NOT NULL;

-- 4a. identificado: documento próprio ou, para quem está vinculado à mãe, o dela
CREATE OR REPLACE FUNCTION private.paciente_tem_documento(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.cns_valido(pa.cns), false) OR coalesce(private.cpf_valido(pa.cpf), false)
         OR coalesce((SELECT coalesce(private.cns_valido(m.cns), false) OR coalesce(private.cpf_valido(m.cpf), false)
                        FROM public.pacientes m WHERE m.id = pa.mae_id), false)
    FROM public.pacientes pa WHERE pa.id = p_paciente
$$;
REVOKE ALL ON FUNCTION private.paciente_tem_documento(uuid) FROM PUBLIC, anon, authenticated;

-- 1a, 2a, 3a, 5b. cadastro do recém-nascido a partir do cadastro da mãe
CREATE OR REPLACE FUNCTION public.cadastrar_rn(p_mae uuid, p_data_nascimento date, p_sexo text DEFAULT NULL,
                                               p_gemelar smallint DEFAULT NULL, p_setor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  m public.pacientes;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_nome text;
  v_rn public.pacientes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO m FROM public.pacientes WHERE id = p_mae AND ativo;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Cadastro da mãe não encontrado.'; END IF;
  IF (private.eh_super_admin() OR private.papel_na_unidade(m.unidade_id) = 'gestor'
      OR private.na_escala_agora(m.unidade_id)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: cadastro de recém-nascido só para quem está de plantão na unidade.';
  END IF;
  IF p_data_nascimento IS NULL OR p_data_nascimento > v_hoje THEN
    RAISE EXCEPTION 'Informe a data de nascimento do recém-nascido (não pode ser futura).';
  END IF;
  IF p_data_nascimento < v_hoje - 27 THEN
    RAISE EXCEPTION 'O cadastro "RN de" é só até 27 dias de vida. Cadastre com o nome da criança.';
  END IF;
  IF p_sexo IS NOT NULL AND p_sexo NOT IN ('F', 'M') THEN RAISE EXCEPTION 'Sexo: F ou M (ou em branco).'; END IF;
  IF p_setor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.setores WHERE id = p_setor AND unidade_id = m.unidade_id AND ativo) THEN
    RAISE EXCEPTION 'Setor não encontrado nesta unidade.';
  END IF;
  IF m.mae_id IS NOT NULL AND m.data_nascimento > v_hoje - 28 THEN
    RAISE EXCEPTION 'O cadastro escolhido como mãe é de um recém-nascido.';
  END IF;
  -- mesmo parto: um RN sem ordem, ou a mesma ordem, não se repete
  IF EXISTS (SELECT 1 FROM public.pacientes r WHERE r.mae_id = m.id AND r.ativo AND r.data_nascimento = p_data_nascimento
              AND (p_gemelar IS NULL OR r.rn_ordem IS NULL OR r.rn_ordem = p_gemelar)) THEN
    RAISE EXCEPTION 'Já existe recém-nascido de % nascido em %. Para gêmeos, informe a ordem de cada um (RN 1, RN 2).',
      m.nome, to_char(p_data_nascimento, 'DD/MM/YYYY');
  END IF;

  v_nome := 'RN ' || coalesce(p_gemelar::text || ' ', '') || 'de ' || btrim(m.nome);
  INSERT INTO public.pacientes (unidade_id, nome, prontuario, setor_id, data_nascimento, sexo, nome_mae,
                                responsavel_nome, responsavel_parentesco, mae_id, rn_ordem)
  VALUES (m.unidade_id, v_nome, private.gerar_prontuario(m.unidade_id), p_setor, p_data_nascimento, p_sexo, btrim(m.nome),
          btrim(m.nome), 'mãe', m.id, p_gemelar)
  RETURNING * INTO v_rn;
  PERFORM private.registrar_auditoria('cadastrar_rn', 'pacientes', v_rn.id, m.unidade_id,
    jsonb_build_object('mae', m.id, 'gemelar', p_gemelar, 'data_nascimento', p_data_nascimento));
  RETURN jsonb_build_object('paciente_id', v_rn.id, 'nome', v_rn.nome, 'prontuario', v_rn.prontuario,
                            'mae_tem_documento', coalesce(private.cns_valido(m.cns), false) OR coalesce(private.cpf_valido(m.cpf), false));
END $function$;
REVOKE ALL ON FUNCTION public.cadastrar_rn(uuid, date, text, smallint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cadastrar_rn(uuid, date, text, smallint, uuid) TO authenticated;

-- 4a. regulação: troca de trechos no corpo atual (para se não bater)
DO $$
DECLARE
  def text;
  antigo text;
  novo text;
BEGIN
  -- regulacao_solicitar: a marca de não identificado considera o documento da mãe
  def := replace(pg_get_functiondef('public.regulacao_solicitar(uuid, uuid, jsonb)'::regprocedure), E'\r', '');
  antigo := 'v_nao_ident := NOT (coalesce(private.cns_valido(pa.cns), false) OR coalesce(private.cpf_valido(pa.cpf), false));';
  novo := 'v_nao_ident := NOT private.paciente_tem_documento(pa.id);  -- Portão 2, tarefa 5: RN vinculado usa o documento da mãe';
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'regulacao_solicitar mudou: trecho da marca de não identificado não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);

  -- regulacao_vinculos_paciente: mesma regra para a tela, e os dados da mãe
  def := replace(pg_get_functiondef('public.regulacao_vinculos_paciente(uuid)'::regprocedure), E'\r', '');
  antigo := replace($t$    'tem_documento', (SELECT coalesce(private.cns_valido(pa.cns), false) OR coalesce(private.cpf_valido(pa.cpf), false)
                        FROM public.pacientes pa WHERE pa.id = p_paciente),$t$, E'\r', '');
  novo := replace($t$    'tem_documento', private.paciente_tem_documento(p_paciente),
    -- Portão 2, tarefa 5: recém-nascido vinculado à mãe
    'mae', (SELECT jsonb_build_object('id', m.id, 'nome', m.nome, 'cns', m.cns, 'cpf', m.cpf)
              FROM public.pacientes pa JOIN public.pacientes m ON m.id = pa.mae_id WHERE pa.id = p_paciente),$t$, E'\r', '');
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'regulacao_vinculos_paciente mudou: trecho de tem_documento não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);

  -- private.regulacao_json: a solicitação mostra o documento da mãe
  def := replace(pg_get_functiondef('private.regulacao_json(public.regulacao_solicitacoes)'::regprocedure), E'\r', '');
  antigo := replace($t$                                           'sexo', pa.sexo, 'cns', pa.cns) FROM public.pacientes pa WHERE pa.id = s.paciente_id),$t$, E'\r', '');
  novo := replace($t$                                           'sexo', pa.sexo, 'cns', pa.cns,
                                           -- Portão 2, tarefa 5: recém-nascido vinculado à mãe
                                           'mae', (SELECT jsonb_build_object('nome', m.nome, 'cns', m.cns, 'cpf', m.cpf)
                                                     FROM public.pacientes m WHERE m.id = pa.mae_id))
                 FROM public.pacientes pa WHERE pa.id = s.paciente_id),$t$, E'\r', '');
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'regulacao_json mudou: trecho do paciente não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;
