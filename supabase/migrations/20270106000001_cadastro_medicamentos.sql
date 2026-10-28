-- Telas do farmacêutico, ponto 4 (pedido do RT em 27/10/2026, aprovado no mesmo
-- dia; docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md): a farmácia cadastra
-- medicamento. Decisões do RT em 27/10/2026:
--
--  • O item novo vale primeiro SÓ na unidade de quem cadastrou. Outra unidade
--    passa a usá-lo quando o farmacêutico ou o gestor dela escolhe "Usar nesta
--    unidade", ou quando o super admin o leva para a rede.
--  • A forma farmacêutica vira campo próprio (lista fixa com "outra"),
--    obrigatória no item novo; os itens que já existem ficam em branco para a
--    farmácia preencher.
--
-- Como fica:
--   • medicamento.unidades_locais: NULL = rede (todos os itens de hoje);
--     preenchido = as unidades que usam o item. A leitura da tabela continua
--     aberta a todos (alergias e prescrições antigas apontam para o item e
--     precisam do nome em qualquer unidade); o que filtra por unidade é a busca
--     (telas) e as listas da farmácia (funções abaixo).
--   • Gatilhos barram GRAVAR um item de outra unidade: prescrição, estoque,
--     falta, dispensação, ajuste de alta vigilância e diluição.
--   • A diluição de item da unidade também é da unidade: a "Nova diluição" de
--     hoje cria modelo da rede, e por isso recusa item da unidade até o ponto 2.
--   • Cadastro, correção e inativação: farmacêutico ou gestor da unidade de
--     origem, com motivo e o antes e o depois em revisoes_cadastro (lote
--     "tela"). Forma do item da rede: farmacêutico ou gestor, como a unidade de
--     consumo (decisão "4a" de 17/10/2026).
--
-- Só aditiva: colunas, funções e gatilhos novos; quatro funções de lista
-- ganham o filtro da unidade, com a mesma assinatura. Com todos os itens de
-- hoje na rede, nada muda para o que já existe.
--
-- ROLLBACK: reaplicar farmacia_estoque de 20261009000001, disponibilidade de
--   20260929000008, alta_vigilancia_da_unidade de 20261031000001 e
--   medicamentos_unidade_consumo de 20261129000001; DROP dos gatilhos
--   trg_medicamento_da_unidade_* e das funções novas. As colunas novas saem só
--   numa janela declarada (contract) e depois de inativar os itens da unidade;
--   até lá ficam sem uso.

-- ── colunas ─────────────────────────────────────────────────────────────────
ALTER TABLE public.medicamento
  ADD COLUMN IF NOT EXISTS forma_farmaceutica text CHECK (forma_farmaceutica IN (
    'solucao_injetavel', 'po_para_solucao_injetavel', 'suspensao_injetavel', 'emulsao_injetavel',
    'comprimido', 'comprimido_revestido', 'capsula', 'dragea', 'solucao_oral', 'solucao_oral_gotas',
    'suspensao_oral', 'po_para_suspensao_oral', 'xarope', 'creme', 'pomada', 'gel', 'solucao_topica',
    'colirio', 'adesivo_transdermico', 'supositorio', 'aerossol', 'solucao_para_nebulizacao', 'spray_nasal', 'outra')),
  ADD COLUMN IF NOT EXISTS forma_farmaceutica_outra text,
  ADD COLUMN IF NOT EXISTS unidades_locais uuid[],
  ADD COLUMN IF NOT EXISTS cadastrado_na_unidade uuid REFERENCES public.unidades(id),
  ADD COLUMN IF NOT EXISTS cadastrado_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS cadastrado_em timestamptz;
ALTER TABLE public.medicamento DROP CONSTRAINT IF EXISTS medicamento_forma_outra;
ALTER TABLE public.medicamento ADD CONSTRAINT medicamento_forma_outra
  CHECK (forma_farmaceutica IS DISTINCT FROM 'outra' OR length(btrim(coalesce(forma_farmaceutica_outra, ''))) >= 3);
ALTER TABLE public.medicamento DROP CONSTRAINT IF EXISTS medicamento_unidades_locais;
ALTER TABLE public.medicamento ADD CONSTRAINT medicamento_unidades_locais
  CHECK (unidades_locais IS NULL OR cardinality(unidades_locais) >= 1);
CREATE INDEX IF NOT EXISTS idx_medicamento_unidades_locais ON public.medicamento USING gin (unidades_locais)
  WHERE unidades_locais IS NOT NULL;
COMMENT ON COLUMN public.medicamento.unidades_locais IS 'NULL = item da rede. Preenchido = unidades que usam o item cadastrado pela farmácia (ponto 4, 27/10/2026).';
COMMENT ON COLUMN public.medicamento.forma_farmaceutica IS 'Forma farmacêutica (lista fixa com "outra"). Obrigatória no cadastro pela farmácia; em branco nos itens que vieram do ETL.';

-- ── regras ──────────────────────────────────────────────────────────────────
-- mesmo texto que a busca das telas compara (normalizarMedicamento em src/lib/search.ts)
CREATE OR REPLACE FUNCTION private.norm_medicamento(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(btrim(regexp_replace(regexp_replace(coalesce(private.nome_comparavel(t), ''), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION private.medicamento_na_unidade(p_medicamento uuid, p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT m.unidades_locais IS NULL OR p_unidade = ANY (m.unidades_locais)
                     FROM public.medicamento m WHERE m.id = p_medicamento), true)
$$;

-- a lista da farmácia (sem unidade na chamada): rede ou alguma unidade minha
CREATE OR REPLACE FUNCTION private.medicamento_visivel_para_mim(p_unidades uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_unidades IS NULL OR private.eh_super_admin()
      OR EXISTS (SELECT 1 FROM unnest(p_unidades) u WHERE private.membro_da_unidade(u))
$$;

CREATE OR REPLACE FUNCTION private.pode_cadastrar_medicamento(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_unidade IS NOT NULL AND (private.farmaceutico_da(p_unidade) OR private.gestor_da_unidade(p_unidade))
$$;

REVOKE ALL ON FUNCTION private.norm_medicamento(text), private.medicamento_na_unidade(uuid, uuid),
  private.medicamento_visivel_para_mim(uuid[]), private.pode_cadastrar_medicamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.norm_medicamento(text), private.medicamento_na_unidade(uuid, uuid),
  private.medicamento_visivel_para_mim(uuid[]), private.pode_cadastrar_medicamento(uuid) TO authenticated;

-- ── gatilhos: item de outra unidade não se grava ────────────────────────────
CREATE OR REPLACE FUNCTION private.trg_medicamento_da_unidade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.medicamento_id IS NOT NULL AND NOT private.medicamento_na_unidade(NEW.medicamento_id, NEW.unidade_id) THEN
    RAISE EXCEPTION 'Este medicamento é de outra unidade. Para usar aqui, a farmácia escolhe "Usar nesta unidade" em Unidade de consumo.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.trg_medicamento_da_unidade_prescricao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.medicamento_id IS NOT NULL AND NOT private.medicamento_na_unidade(NEW.medicamento_id,
       (SELECT p.unidade_id FROM public.prescricoes p WHERE p.id = NEW.prescricao_id)) THEN
    RAISE EXCEPTION 'Este medicamento é de outra unidade e não pode ser prescrito aqui.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- a diluição de item da unidade é da unidade (o modelo da rede chegaria a todas)
CREATE OR REPLACE FUNCTION private.trg_medicamento_da_unidade_diluicao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_locais uuid[];
BEGIN
  IF NEW.medicamento_id IS NULL THEN RETURN NEW; END IF;
  SELECT m.unidades_locais INTO v_locais FROM public.medicamento m WHERE m.id = NEW.medicamento_id;
  IF v_locais IS NULL THEN RETURN NEW; END IF;
  IF NEW.unidade_id IS NULL THEN
    RAISE EXCEPTION 'Este medicamento é da unidade: a diluição dele também é da unidade, e não modelo da rede.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT NEW.unidade_id = ANY (v_locais) THEN
    RAISE EXCEPTION 'Este medicamento é de outra unidade.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.trg_medicamento_da_unidade(), private.trg_medicamento_da_unidade_prescricao(),
  private.trg_medicamento_da_unidade_diluicao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_medicamento_da_unidade_estoque ON public.estoque_medicamento;
CREATE TRIGGER trg_medicamento_da_unidade_estoque BEFORE INSERT OR UPDATE OF medicamento_id, unidade_id
  ON public.estoque_medicamento FOR EACH ROW EXECUTE FUNCTION private.trg_medicamento_da_unidade();
DROP TRIGGER IF EXISTS trg_medicamento_da_unidade_falta ON public.faltas_medicamento;
CREATE TRIGGER trg_medicamento_da_unidade_falta BEFORE INSERT OR UPDATE OF medicamento_id, unidade_id
  ON public.faltas_medicamento FOR EACH ROW EXECUTE FUNCTION private.trg_medicamento_da_unidade();
DROP TRIGGER IF EXISTS trg_medicamento_da_unidade_dispensacao ON public.dispensacoes;
CREATE TRIGGER trg_medicamento_da_unidade_dispensacao BEFORE INSERT OR UPDATE OF medicamento_id, unidade_id
  ON public.dispensacoes FOR EACH ROW EXECUTE FUNCTION private.trg_medicamento_da_unidade();
DROP TRIGGER IF EXISTS trg_medicamento_da_unidade_alta_vigilancia ON public.alta_vigilancia_unidade;
CREATE TRIGGER trg_medicamento_da_unidade_alta_vigilancia BEFORE INSERT OR UPDATE OF medicamento_id, unidade_id
  ON public.alta_vigilancia_unidade FOR EACH ROW EXECUTE FUNCTION private.trg_medicamento_da_unidade();
DROP TRIGGER IF EXISTS trg_medicamento_da_unidade_prescricao ON public.prescricao_itens;
CREATE TRIGGER trg_medicamento_da_unidade_prescricao BEFORE INSERT OR UPDATE OF medicamento_id
  ON public.prescricao_itens FOR EACH ROW EXECUTE FUNCTION private.trg_medicamento_da_unidade_prescricao();
DROP TRIGGER IF EXISTS trg_medicamento_da_unidade_diluicao ON public.diluicao;
CREATE TRIGGER trg_medicamento_da_unidade_diluicao BEFORE INSERT OR UPDATE OF medicamento_id, unidade_id
  ON public.diluicao FOR EACH ROW EXECUTE FUNCTION private.trg_medicamento_da_unidade_diluicao();

-- ── registro das mudanças (revisoes_cadastro, lote "tela") ──────────────────
CREATE OR REPLACE FUNCTION private.registrar_revisao_medicamento(p_id uuid, p_campo text, p_anterior text, p_novo text, p_motivo text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.revisoes_cadastro (lote, tabela, registro_id, campo, anterior, novo, fonte, aprovacao)
  SELECT 'tela', 'medicamento', p_id, p_campo, p_anterior, p_novo, coalesce(nullif(btrim(p_motivo), ''), 'tela da farmácia'),
         coalesce((SELECT nome_completo FROM public.perfis WHERE id = private.meu_perfil_id()), 'sistema')
   WHERE p_anterior IS DISTINCT FROM p_novo
$$;
REVOKE ALL ON FUNCTION private.registrar_revisao_medicamento(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- forma e unidade de consumo válidas (texto da exceção para a tela)
CREATE OR REPLACE FUNCTION private.validar_forma(p_forma text, p_outra text) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_forma IS NULL OR p_forma NOT IN ('solucao_injetavel', 'po_para_solucao_injetavel', 'suspensao_injetavel', 'emulsao_injetavel',
      'comprimido', 'comprimido_revestido', 'capsula', 'dragea', 'solucao_oral', 'solucao_oral_gotas',
      'suspensao_oral', 'po_para_suspensao_oral', 'xarope', 'creme', 'pomada', 'gel', 'solucao_topica',
      'colirio', 'adesivo_transdermico', 'supositorio', 'aerossol', 'solucao_para_nebulizacao', 'spray_nasal', 'outra') THEN
    RAISE EXCEPTION 'Escolha a forma farmacêutica da lista.';
  END IF;
  IF p_forma = 'outra' AND length(btrim(coalesce(p_outra, ''))) < 3 THEN
    RAISE EXCEPTION 'Escreva qual é a forma farmacêutica (mínimo de 3 letras).';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.validar_forma(text, text) FROM PUBLIC, anon, authenticated;

-- ── parecidos: o que já existe com esse nome, antes de cadastrar ────────────
CREATE OR REPLACE FUNCTION public.medicamentos_parecidos(p_unidade uuid, p_termo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_norm text := private.norm_medicamento(p_termo);
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_cadastrar_medicamento(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o cadastro de medicamentos é do farmacêutico e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(coalesce(v_norm, '')) < 3 THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', m.id, 'principio_ativo', m.principio_ativo, 'apresentacao', m.apresentacao, 'concentracao', m.concentracao,
             'forma_farmaceutica', m.forma_farmaceutica, 'forma_farmaceutica_outra', m.forma_farmaceutica_outra,
             'unidade_consumo', m.unidade_consumo, 'unidade_consumo_outra', m.unidade_consumo_outra,
             'na_unidade', m.unidades_locais IS NULL OR p_unidade = ANY (m.unidades_locais),
             'da_rede', m.unidades_locais IS NULL,
             'origem', (SELECT u.nome FROM public.unidades u WHERE u.id = m.cadastrado_na_unidade))
             ORDER BY m.principio_ativo, m.apresentacao)
      FROM (SELECT * FROM public.medicamento m
             WHERE m.ativo AND m.principio_ativo_norm LIKE '%' || v_norm || '%'
             ORDER BY m.principio_ativo, m.apresentacao LIMIT 20) m), '[]'::jsonb);
END $$;

-- ── cadastrar ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cadastrar_medicamento(p_unidade uuid, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_principio text := nullif(btrim(regexp_replace(coalesce(p_dados ->> 'principio_ativo', ''), '\s+', ' ', 'g')), '');
  v_apres text := nullif(btrim(regexp_replace(coalesce(p_dados ->> 'apresentacao', ''), '\s+', ' ', 'g')), '');
  v_conc text := nullif(btrim(coalesce(p_dados ->> 'concentracao', '')), '');
  v_forma text := nullif(btrim(coalesce(p_dados ->> 'forma_farmaceutica', '')), '');
  v_forma_outra text := nullif(btrim(coalesce(p_dados ->> 'forma_farmaceutica_outra', '')), '');
  v_uc text := nullif(btrim(coalesce(p_dados ->> 'unidade_consumo', '')), '');
  v_uc_outra text := nullif(btrim(coalesce(p_dados ->> 'unidade_consumo_outra', '')), '');
  v_norm text;
  v_eu uuid := private.meu_perfil_id();
  e public.medicamento;
  m public.medicamento;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_cadastrar_medicamento(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o cadastro de medicamentos é do farmacêutico e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_norm := private.norm_medicamento(v_principio);
  IF length(coalesce(v_norm, '')) < 3 THEN RAISE EXCEPTION 'Escreva o princípio ativo (mínimo de 3 letras).'; END IF;
  IF length(coalesce(v_apres, '')) < 3 THEN RAISE EXCEPTION 'Escreva a apresentação (ex.: Ampola 2 mL).'; END IF;
  PERFORM private.validar_forma(v_forma, v_forma_outra);
  IF v_forma <> 'outra' THEN v_forma_outra := NULL; END IF;
  IF v_uc IS NULL OR v_uc NOT IN ('ampola', 'frasco_ampola', 'frasco', 'bolsa', 'comprimido', 'capsula', 'dragea', 'sache', 'envelope',
                                  'bisnaga', 'adesivo', 'supositorio', 'seringa_preenchida', 'caneta', 'flaconete', 'outra') THEN
    RAISE EXCEPTION 'Escolha a unidade de consumo da lista.';
  END IF;
  IF v_uc = 'outra' AND length(coalesce(v_uc_outra, '')) < 3 THEN RAISE EXCEPTION 'Escreva qual é a unidade de consumo (mínimo de 3 letras).'; END IF;
  IF v_uc <> 'outra' THEN v_uc_outra := NULL; END IF;

  SELECT * INTO e FROM public.medicamento
   WHERE principio_ativo_norm = v_norm AND lower(btrim(coalesce(apresentacao, ''))) = lower(v_apres) LIMIT 1;
  IF e.id IS NOT NULL THEN
    IF e.unidades_locais IS NULL OR p_unidade = ANY (e.unidades_locais) THEN
      RAISE EXCEPTION 'Este medicamento já está no cadastro: % · %.', e.principio_ativo, e.apresentacao;
    END IF;
    RAISE EXCEPTION 'Este medicamento já foi cadastrado pela farmácia de %: escolha "Usar nesta unidade" na lista de parecidos.',
      coalesce((SELECT nome FROM public.unidades WHERE id = e.cadastrado_na_unidade), 'outra unidade');
  END IF;

  INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, forma_farmaceutica,
    forma_farmaceutica_outra, unidade_consumo, unidade_consumo_outra, unidade_consumo_conferida_em, unidade_consumo_conferida_por,
    unidades_locais, cadastrado_na_unidade, cadastrado_por, cadastrado_em, fonte)
  VALUES (v_principio, v_norm, v_apres, v_conc, v_forma, v_forma_outra, v_uc, v_uc_outra, now(), v_eu,
    ARRAY[p_unidade], p_unidade, v_eu, now(), 'farmacia')
  RETURNING * INTO m;
  PERFORM private.registrar_auditoria('cadastrar_medicamento', 'medicamento', m.id, p_unidade, '{}'::jsonb);
  RETURN jsonb_build_object('id', m.id, 'alta_vigilancia', m.alta_vigilancia, 'regra', m.alta_vigilancia_regra);
END $$;

-- ── usar nesta unidade (item que outra unidade cadastrou) ───────────────────
CREATE OR REPLACE FUNCTION public.usar_medicamento_na_unidade(p_medicamento uuid, p_unidade uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.medicamento;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_cadastrar_medicamento(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o cadastro de medicamentos é do farmacêutico e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO m FROM public.medicamento WHERE id = p_medicamento FOR UPDATE;
  IF m.id IS NULL OR NOT m.ativo THEN RAISE EXCEPTION 'Medicamento não encontrado.'; END IF;
  IF m.unidades_locais IS NULL OR p_unidade = ANY (m.unidades_locais) THEN RAISE EXCEPTION 'Este medicamento já vale nesta unidade.'; END IF;
  UPDATE public.medicamento SET unidades_locais = array_append(m.unidades_locais, p_unidade), updated_at = now() WHERE id = m.id;
  PERFORM private.registrar_revisao_medicamento(m.id, 'unidades_locais', array_to_string(m.unidades_locais, ','),
    array_to_string(array_append(m.unidades_locais, p_unidade), ','), 'usar nesta unidade');
  PERFORM private.registrar_auditoria('usar_medicamento_na_unidade', 'medicamento', m.id, p_unidade, '{}'::jsonb);
END $$;

-- ── corrigir e inativar (só o item da unidade, pela unidade de origem) ──────
CREATE OR REPLACE FUNCTION public.corrigir_medicamento(p_medicamento uuid, p_dados jsonb, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  m public.medicamento;
  v_principio text; v_apres text; v_conc text; v_forma text; v_forma_outra text; v_norm text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO m FROM public.medicamento WHERE id = p_medicamento FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Medicamento não encontrado.'; END IF;
  IF m.cadastrado_na_unidade IS NULL OR m.unidades_locais IS NULL THEN
    RAISE EXCEPTION 'Este medicamento é do cadastro da rede: a correção é pela revisão do cadastro.';
  END IF;
  IF NOT private.pode_cadastrar_medicamento(m.cadastrado_na_unidade) THEN
    RAISE EXCEPTION 'Só o farmacêutico ou o gestor da unidade que cadastrou corrige o item.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  v_principio := coalesce(nullif(btrim(regexp_replace(coalesce(p_dados ->> 'principio_ativo', ''), '\s+', ' ', 'g')), ''), m.principio_ativo);
  v_apres := coalesce(nullif(btrim(regexp_replace(coalesce(p_dados ->> 'apresentacao', ''), '\s+', ' ', 'g')), ''), m.apresentacao);
  v_conc := CASE WHEN p_dados ? 'concentracao' THEN nullif(btrim(p_dados ->> 'concentracao'), '') ELSE m.concentracao END;
  v_forma := coalesce(nullif(btrim(coalesce(p_dados ->> 'forma_farmaceutica', '')), ''), m.forma_farmaceutica);
  v_forma_outra := CASE WHEN p_dados ? 'forma_farmaceutica_outra' THEN nullif(btrim(p_dados ->> 'forma_farmaceutica_outra'), '') ELSE m.forma_farmaceutica_outra END;
  v_norm := private.norm_medicamento(v_principio);
  IF length(coalesce(v_norm, '')) < 3 THEN RAISE EXCEPTION 'Escreva o princípio ativo (mínimo de 3 letras).'; END IF;
  IF length(coalesce(v_apres, '')) < 3 THEN RAISE EXCEPTION 'Escreva a apresentação (ex.: Ampola 2 mL).'; END IF;
  PERFORM private.validar_forma(v_forma, v_forma_outra);
  IF v_forma <> 'outra' THEN v_forma_outra := NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.medicamento WHERE id <> m.id AND principio_ativo_norm = v_norm
               AND lower(btrim(coalesce(apresentacao, ''))) = lower(v_apres)) THEN
    RAISE EXCEPTION 'Já existe outro medicamento com esse princípio ativo e essa apresentação.';
  END IF;
  UPDATE public.medicamento SET principio_ativo = v_principio, principio_ativo_norm = v_norm, apresentacao = v_apres,
         concentracao = v_conc, forma_farmaceutica = v_forma, forma_farmaceutica_outra = v_forma_outra, updated_at = now()
   WHERE id = m.id;
  PERFORM private.registrar_revisao_medicamento(m.id, 'principio_ativo', m.principio_ativo, v_principio, p_motivo);
  PERFORM private.registrar_revisao_medicamento(m.id, 'apresentacao', m.apresentacao, v_apres, p_motivo);
  PERFORM private.registrar_revisao_medicamento(m.id, 'concentracao', m.concentracao, v_conc, p_motivo);
  PERFORM private.registrar_revisao_medicamento(m.id, 'forma_farmaceutica',
    concat_ws(': ', m.forma_farmaceutica, m.forma_farmaceutica_outra), concat_ws(': ', v_forma, v_forma_outra), p_motivo);
  PERFORM private.registrar_auditoria('corrigir_medicamento', 'medicamento', m.id, m.cadastrado_na_unidade, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.inativar_medicamento(p_medicamento uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.medicamento;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO m FROM public.medicamento WHERE id = p_medicamento FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Medicamento não encontrado.'; END IF;
  IF m.cadastrado_na_unidade IS NULL OR m.unidades_locais IS NULL THEN
    RAISE EXCEPTION 'Este medicamento é do cadastro da rede: a inativação é pela revisão do cadastro.';
  END IF;
  IF NOT private.pode_cadastrar_medicamento(m.cadastrado_na_unidade) THEN
    RAISE EXCEPTION 'Só o farmacêutico ou o gestor da unidade que cadastrou inativa o item.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT m.ativo THEN RAISE EXCEPTION 'Este medicamento já está inativo.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.medicamento SET ativo = false, updated_at = now() WHERE id = m.id;
  PERFORM private.registrar_revisao_medicamento(m.id, 'ativo', 'true', 'false', p_motivo);
  PERFORM private.registrar_auditoria('inativar_medicamento', 'medicamento', m.id, m.cadastrado_na_unidade, '{}'::jsonb);
END $$;

-- ── forma do item que já existe (farmacêutico ou gestor, como a unidade de consumo) ──
CREATE OR REPLACE FUNCTION public.definir_forma_farmaceutica(p_medicamento uuid, p_forma text, p_outra text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.medicamento; v_outra text := nullif(btrim(coalesce(p_outra, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_definir_unidade_consumo() THEN
    RAISE EXCEPTION 'Acesso negado: a forma farmacêutica é da farmácia e do gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO m FROM public.medicamento WHERE id = p_medicamento FOR UPDATE;
  IF m.id IS NULL OR NOT private.medicamento_visivel_para_mim(m.unidades_locais) THEN RAISE EXCEPTION 'Medicamento não encontrado.'; END IF;
  PERFORM private.validar_forma(p_forma, v_outra);
  IF p_forma <> 'outra' THEN v_outra := NULL; END IF;
  UPDATE public.medicamento SET forma_farmaceutica = p_forma, forma_farmaceutica_outra = v_outra, updated_at = now() WHERE id = m.id;
  PERFORM private.registrar_revisao_medicamento(m.id, 'forma_farmaceutica',
    concat_ws(': ', m.forma_farmaceutica, m.forma_farmaceutica_outra), concat_ws(': ', p_forma, v_outra), 'forma farmacêutica');
  PERFORM private.registrar_auditoria('definir_forma_farmaceutica', 'medicamento', m.id, NULL, '{}'::jsonb);
END $$;

-- ── levar para a rede (super admin) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.levar_medicamento_para_rede(p_medicamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.medicamento;
BEGIN
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só o super admin leva um medicamento da unidade para a rede.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO m FROM public.medicamento WHERE id = p_medicamento FOR UPDATE;
  IF m.id IS NULL OR m.unidades_locais IS NULL THEN RAISE EXCEPTION 'Este medicamento já é da rede.'; END IF;
  UPDATE public.medicamento SET unidades_locais = NULL, updated_at = now() WHERE id = m.id;
  PERFORM private.registrar_revisao_medicamento(m.id, 'unidades_locais', array_to_string(m.unidades_locais, ','), 'rede', 'levado para a rede');
  PERFORM private.registrar_auditoria('levar_medicamento_para_rede', 'medicamento', m.id, NULL, '{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.medicamentos_parecidos(uuid, text), public.cadastrar_medicamento(uuid, jsonb),
  public.usar_medicamento_na_unidade(uuid, uuid), public.corrigir_medicamento(uuid, jsonb, text),
  public.inativar_medicamento(uuid, text), public.definir_forma_farmaceutica(uuid, text, text),
  public.levar_medicamento_para_rede(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medicamentos_parecidos(uuid, text), public.cadastrar_medicamento(uuid, jsonb),
  public.usar_medicamento_na_unidade(uuid, uuid), public.corrigir_medicamento(uuid, jsonb, text),
  public.inativar_medicamento(uuid, text), public.definir_forma_farmaceutica(uuid, text, text),
  public.levar_medicamento_para_rede(uuid) TO authenticated;

-- ── listas da farmácia com o filtro da unidade (mesma assinatura) ───────────
CREATE OR REPLACE FUNCTION public.farmacia_estoque(p_unidade uuid)
RETURNS TABLE (medicamento_id uuid, principio_ativo text, apresentacao text, alta_vigilancia boolean, quantidade numeric,
               limite_critico numeric, limite_falta numeric, limite_proprio boolean, situacao text,
               atualizado_em timestamptz, atualizado_por text, falta_id uuid, falta_situacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (private.farmaceutico_da(p_unidade) OR private.papel_na_unidade(p_unidade) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado: estoque da farmácia.';
  END IF;
  RETURN QUERY
  WITH l AS (
    SELECT m.id, m.principio_ativo, m.apresentacao, m.alta_vigilancia, e.quantidade, e.atualizado_em, e.atualizado_por,
           (e.limite_critico IS NOT NULL OR e.limite_falta IS NOT NULL) AS proprio,
           coalesce(e.limite_critico, p.limite_critico) AS critico, coalesce(e.limite_falta, p.limite_falta) AS falta
    FROM public.medicamento m
    LEFT JOIN public.estoque_medicamento e ON e.medicamento_id = m.id AND e.unidade_id = p_unidade
    LEFT JOIN public.farmacia_limites_padrao p ON p.unidade_id = p_unidade
    WHERE m.ativo AND (m.unidades_locais IS NULL OR p_unidade = ANY (m.unidades_locais))
  )
  SELECT l.id, l.principio_ativo, l.apresentacao, l.alta_vigilancia, l.quantidade, l.critico, l.falta, coalesce(l.proprio, false),
         CASE WHEN l.quantidade IS NULL THEN 'nao_informado'
              WHEN l.falta IS NOT NULL AND l.quantidade <= l.falta THEN 'falta'
              WHEN l.critico IS NOT NULL AND l.quantidade <= l.critico THEN 'critico'
              ELSE 'ok' END,
         l.atualizado_em, pf.nome_completo, f.id, f.situacao
  FROM l
  LEFT JOIN public.perfis pf ON pf.id = l.atualizado_por
  LEFT JOIN public.faltas_medicamento f ON f.unidade_id = p_unidade AND f.medicamento_id = l.id AND f.situacao <> 'reposta'
  ORDER BY CASE WHEN f.id IS NOT NULL THEN 0 WHEN l.quantidade IS NULL THEN 4
                WHEN l.falta IS NOT NULL AND l.quantidade <= l.falta THEN 1
                WHEN l.critico IS NOT NULL AND l.quantidade <= l.critico THEN 2 ELSE 3 END, l.principio_ativo;
END $$;

CREATE OR REPLACE FUNCTION public.disponibilidade(p_unidade uuid)
RETURNS TABLE (medicamento_id uuid, principio_ativo text, apresentacao text, quantidade numeric, limite_critico numeric,
               limite_falta numeric, situacao text, atualizado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH l AS (
    SELECT m.id, m.principio_ativo, m.apresentacao, e.quantidade, e.atualizado_em,
           coalesce(e.limite_critico, p.limite_critico) AS critico, coalesce(e.limite_falta, p.limite_falta) AS falta
    FROM public.medicamento m
    LEFT JOIN public.estoque_medicamento e ON e.medicamento_id = m.id AND e.unidade_id = p_unidade
    LEFT JOIN public.farmacia_limites_padrao p ON p.unidade_id = p_unidade
    WHERE m.ativo AND private.membro_da_unidade(p_unidade)
      AND (m.unidades_locais IS NULL OR p_unidade = ANY (m.unidades_locais))
  )
  SELECT l.id, l.principio_ativo, l.apresentacao, l.quantidade, l.critico, l.falta,
         CASE WHEN l.quantidade IS NULL THEN 'nao_informado'
              WHEN l.falta IS NOT NULL AND l.quantidade <= l.falta THEN 'falta'
              WHEN l.critico IS NOT NULL AND l.quantidade <= l.critico THEN 'critico'
              ELSE 'ok' END,
         l.atualizado_em
  FROM l
  ORDER BY CASE WHEN l.quantidade IS NULL THEN 3 WHEN l.falta IS NOT NULL AND l.quantidade <= l.falta THEN 0
                WHEN l.critico IS NOT NULL AND l.quantidade <= l.critico THEN 1 ELSE 2 END, l.principio_ativo
$$;

CREATE OR REPLACE FUNCTION public.alta_vigilancia_da_unidade(p_unidade uuid, p_busca text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.membro_da_unidade(p_unidade) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', m.id, 'principio_ativo', m.principio_ativo, 'apresentacao', m.apresentacao, 'concentracao', m.concentracao,
             'cadastro', m.alta_vigilancia, 'regra', m.alta_vigilancia_regra,
             'exige', private.exige_dupla_checagem(p_unidade, m.id),
             'ajuste', (SELECT jsonb_build_object('exige', a.exige, 'motivo', a.motivo, 'por', p.nome_completo, 'em', a.definido_em)
                          FROM public.alta_vigilancia_unidade a LEFT JOIN public.perfis p ON p.id = a.definido_por
                         WHERE a.unidade_id = p_unidade AND a.medicamento_id = m.id AND a.vigente_ate IS NULL))
             ORDER BY m.principio_ativo, m.apresentacao)
      FROM public.medicamento m
     WHERE m.ativo
       AND (m.unidades_locais IS NULL OR p_unidade = ANY (m.unidades_locais))
       AND (CASE WHEN nullif(btrim(coalesce(p_busca, '')), '') IS NULL
                 THEN private.exige_dupla_checagem(p_unidade, m.id)
                   OR EXISTS (SELECT 1 FROM public.alta_vigilancia_unidade a WHERE a.unidade_id = p_unidade AND a.medicamento_id = m.id AND a.vigente_ate IS NULL)
                 ELSE m.principio_ativo_norm LIKE '%' || private.nome_comparavel(p_busca) || '%' END)
     LIMIT 400), '[]'::jsonb);
END $$;

-- a lista da Unidade de consumo, agora também a do cadastro: forma, origem e o
-- que é da unidade; só a rede e as unidades de quem chama
CREATE OR REPLACE FUNCTION public.medicamentos_unidade_consumo(p_busca text DEFAULT NULL, p_a_conferir boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_definir_unidade_consumo() THEN
    RAISE EXCEPTION 'Acesso negado: a unidade de consumo é da farmácia e do gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
               'id', m.id, 'principio_ativo', m.principio_ativo, 'apresentacao', m.apresentacao, 'concentracao', m.concentracao,
               'unidade_consumo', m.unidade_consumo, 'unidade_consumo_outra', m.unidade_consumo_outra,
               'conferida_em', m.unidade_consumo_conferida_em,
               'conferida_por', (SELECT nome_completo FROM public.perfis WHERE id = m.unidade_consumo_conferida_por),
               'forma_farmaceutica', m.forma_farmaceutica, 'forma_farmaceutica_outra', m.forma_farmaceutica_outra,
               'unidades_locais', m.unidades_locais, 'cadastrado_na_unidade', m.cadastrado_na_unidade,
               'origem', (SELECT u.nome FROM public.unidades u WHERE u.id = m.cadastrado_na_unidade),
               'cadastrado_por', (SELECT nome_completo FROM public.perfis WHERE id = m.cadastrado_por),
               'cadastrado_em', m.cadastrado_em)
             ORDER BY m.principio_ativo, m.apresentacao)
             FROM (SELECT * FROM public.medicamento m WHERE m.ativo
                     AND private.medicamento_visivel_para_mim(m.unidades_locais)
                     AND (v_busca IS NULL OR m.principio_ativo_norm LIKE '%' || private.nome_comparavel(v_busca) || '%'
                          OR lower(coalesce(m.apresentacao, '')) LIKE '%' || lower(v_busca) || '%')
                     AND (NOT p_a_conferir OR m.unidade_consumo_conferida_em IS NULL OR m.forma_farmaceutica IS NULL)
                   ORDER BY m.principio_ativo, m.apresentacao LIMIT 300) m), '[]'::jsonb),
    'a_conferir', (SELECT count(*) FROM public.medicamento m WHERE m.ativo AND private.medicamento_visivel_para_mim(m.unidades_locais)
                     AND (m.unidade_consumo_conferida_em IS NULL OR m.forma_farmaceutica IS NULL)),
    'sem_unidade', (SELECT count(*) FROM public.medicamento m WHERE m.ativo AND private.medicamento_visivel_para_mim(m.unidades_locais)
                     AND m.unidade_consumo IS NULL),
    'sem_forma', (SELECT count(*) FROM public.medicamento m WHERE m.ativo AND private.medicamento_visivel_para_mim(m.unidades_locais)
                     AND m.forma_farmaceutica IS NULL));
END $$;
