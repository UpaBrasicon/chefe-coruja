-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 8 — Central do Farmacêutico (P/index.html 9600–9800).
--
-- O que o protótipo guardava no navegador e aqui vira banco:
--
--  1. LIMITES DA DISPONIBILIDADE COM PADRÃO DA UNIDADE. O protótipo tinha um
--     limite "padrão" por item e o botão "Voltar ao padrão". No app o padrão é
--     da UNIDADE (farmacia_limites_padrao: crítico ≤ e em falta ≤), definido
--     pelo farmacêutico; o item pode ter limite próprio (estoque_medicamento,
--     fase 4.9) e "voltar ao padrão" apaga o próprio. O selo continua sendo a
--     comparação (disponibilidade), agora com o limite do item ou, sem ele, o
--     da unidade. Não há número clínico aqui: são quantidades de estoque.
--  2. SINALIZAR FALTA pela tela de estoque: sinalizar_falta (fase 4.9) já
--     aceita o farmacêutico; farmacia_estoque devolve a falta aberta do item
--     para a tela mostrar "Falta enviada" em vez do botão.
--  3. ENVIAR LISTA / ENVIAR PADRÃO: o arquivo da farmácia central (lista de
--     medicações) e o padrão de diluição da unidade, no formato em que a
--     farmácia mantém (.xlsx, .xls, .csv, .doc, .docx, .pdf), vão para o
--     bucket privado "farmacia" ({unidade}/{tipo}/…) e ficam registrados em
--     arquivos_farmacia (quem, quando, nome, tamanho). O app não lê o
--     conteúdo: é o comprovante do que a farmácia enviou.
--  4. AJUSTAR LINHA / VOLTAR AO MODELO (diluição por unidade). O "modelo" é a
--     diluição publicada para a rede (unidade_id nulo, fase 4.5). Ajustar
--     cria um rascunho da UNIDADE a partir do modelo (origem_id = modelo), que
--     segue as regras de publicação de sempre (CRF, fonte, EV com volume e
--     tempo, e o que mudou); publicado, diluicao_vigente já prefere a linha
--     da unidade. Voltar ao modelo encerra a linha da unidade (substituída,
--     com motivo na auditoria) e a prescrição volta a receber o modelo.
--     Só o farmacêutico DAQUELA unidade mexe na linha da unidade.
--  5. RISCO DE FLEBITE e ALTA VIGILÂNCIA na linha de diluição: o farmacêutico
--     marca no rascunho, e só publica com a fonte da linha (a mesma exigência
--     de sempre). Nada é preenchido a partir do protótipo: coluna nova começa
--     vazia ("não informado").
--
-- Escritas só por RPC, com segundo fator. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. limites padrão da unidade ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.farmacia_limites_padrao (
  unidade_id     uuid PRIMARY KEY REFERENCES public.unidades(id),
  limite_critico numeric CHECK (limite_critico >= 0),
  limite_falta   numeric CHECK (limite_falta >= 0),
  atualizado_por uuid NOT NULL REFERENCES public.perfis(id),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (limite_falta IS NULL OR limite_critico IS NULL OR limite_falta <= limite_critico)
);
CREATE INDEX IF NOT EXISTS idx_farmacia_limites_padrao_por ON public.farmacia_limites_padrao (atualizado_por);
ALTER TABLE public.farmacia_limites_padrao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farmacia_limites_padrao_select ON public.farmacia_limites_padrao;
CREATE POLICY farmacia_limites_padrao_select ON public.farmacia_limites_padrao FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
REVOKE ALL ON public.farmacia_limites_padrao FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.farmacia_limites_padrao FROM authenticated;
GRANT SELECT ON public.farmacia_limites_padrao TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_limites_padrao_farmacia(p_unidade uuid, p_limite_critico numeric, p_limite_falta numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.farmaceutico_da(p_unidade) THEN RAISE EXCEPTION 'O padrão de limites é do farmacêutico da unidade.'; END IF;
  IF (p_limite_critico IS NOT NULL AND p_limite_critico < 0) OR (p_limite_falta IS NOT NULL AND p_limite_falta < 0) THEN
    RAISE EXCEPTION 'Limite inválido.';
  END IF;
  IF p_limite_falta IS NOT NULL AND p_limite_critico IS NOT NULL AND p_limite_falta > p_limite_critico THEN
    RAISE EXCEPTION 'O limite de falta não pode ser maior que o de crítico.';
  END IF;
  INSERT INTO public.farmacia_limites_padrao (unidade_id, limite_critico, limite_falta, atualizado_por)
  VALUES (p_unidade, p_limite_critico, p_limite_falta, private.meu_perfil_id())
  ON CONFLICT (unidade_id) DO UPDATE SET limite_critico = EXCLUDED.limite_critico, limite_falta = EXCLUDED.limite_falta,
    atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now();
  PERFORM private.registrar_auditoria('definir_limites_padrao_farmacia', 'farmacia_limites_padrao', p_unidade, p_unidade,
    jsonb_build_object('critico', p_limite_critico, 'falta', p_limite_falta));
END $$;

-- "Voltar ao padrão": o item deixa de ter limite próprio e segue o da unidade
CREATE OR REPLACE FUNCTION public.limites_voltar_ao_padrao(p_unidade uuid, p_medicamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.farmaceutico_da(p_unidade) THEN RAISE EXCEPTION 'Estoque é do farmacêutico da unidade.'; END IF;
  UPDATE public.estoque_medicamento
     SET limite_critico = NULL, limite_falta = NULL, atualizado_por = private.meu_perfil_id(), atualizado_em = now()
   WHERE unidade_id = p_unidade AND medicamento_id = p_medicamento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este item ainda não tem saldo informado.'; END IF;
END $$;

-- o selo é a comparação: limite do item ou, sem ele, o padrão da unidade
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

-- a tela de estoque: o selo, de onde vem o limite, e a falta aberta do item
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
    WHERE m.ativo
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

-- ── 3. arquivos enviados pela farmácia ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('farmacia', 'farmacia', false, 20971520)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 20971520;

CREATE TABLE IF NOT EXISTS public.arquivos_farmacia (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id),
  tipo        text NOT NULL CHECK (tipo IN ('lista_medicacoes', 'padrao_diluicao')),
  caminho     text NOT NULL UNIQUE,
  nome        text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 200),
  tamanho     integer NOT NULL CHECK (tamanho > 0 AND tamanho <= 20971520),
  tipo_mime   text,
  enviado_por uuid NOT NULL REFERENCES public.perfis(id),
  enviado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arquivos_farmacia_unidade ON public.arquivos_farmacia (unidade_id, tipo, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_arquivos_farmacia_por ON public.arquivos_farmacia (enviado_por);
DROP TRIGGER IF EXISTS trg_arquivos_farmacia_so_insercao ON public.arquivos_farmacia;
CREATE TRIGGER trg_arquivos_farmacia_so_insercao BEFORE UPDATE OR DELETE ON public.arquivos_farmacia
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.arquivos_farmacia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arquivos_farmacia_select ON public.arquivos_farmacia;
CREATE POLICY arquivos_farmacia_select ON public.arquivos_farmacia FOR SELECT TO authenticated
  USING (private.farmaceutico_da(unidade_id) OR private.papel_na_unidade(unidade_id) = 'gestor');
REVOKE ALL ON public.arquivos_farmacia FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.arquivos_farmacia FROM authenticated;
GRANT SELECT ON public.arquivos_farmacia TO authenticated;

-- a pasta de cima é a unidade; sobe só o farmacêutico dela; lê ele e o gestor
CREATE OR REPLACE FUNCTION private.unidade_do_caminho(p_nome text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  RETURN (regexp_match(p_nome, '^([0-9a-fA-F-]{36})/'))[1]::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP POLICY IF EXISTS "farmacia_upload" ON storage.objects;
CREATE POLICY "farmacia_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'farmacia' AND private.farmaceutico_da(private.unidade_do_caminho(name)));
DROP POLICY IF EXISTS "farmacia_read" ON storage.objects;
CREATE POLICY "farmacia_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'farmacia' AND (private.farmaceutico_da(private.unidade_do_caminho(name))
                                     OR private.papel_na_unidade(private.unidade_do_caminho(name)) = 'gestor'));

CREATE OR REPLACE FUNCTION public.registrar_arquivo_farmacia(p_unidade uuid, p_tipo text, p_caminho text, p_nome text,
  p_tamanho integer, p_tipo_mime text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_ext text := lower(substring(coalesce(p_nome, '') from '\.([A-Za-z0-9]+)$'));
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.farmaceutico_da(p_unidade) THEN RAISE EXCEPTION 'Enviar arquivo da farmácia é do farmacêutico da unidade.'; END IF;
  IF p_tipo NOT IN ('lista_medicacoes', 'padrao_diluicao') THEN RAISE EXCEPTION 'Tipo de arquivo desconhecido.'; END IF;
  IF v_ext IS NULL OR v_ext NOT IN ('xlsx', 'xls', 'csv', 'doc', 'docx', 'pdf') THEN
    RAISE EXCEPTION 'Envie planilha, documento ou PDF (.xlsx, .xls, .csv, .doc, .docx, .pdf).';
  END IF;
  IF coalesce(p_caminho, '') NOT LIKE p_unidade::text || '/' || p_tipo || '/%' THEN
    RAISE EXCEPTION 'Caminho do arquivo fora da pasta da unidade.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'farmacia' AND o.name = p_caminho) THEN
    RAISE EXCEPTION 'O arquivo não chegou ao armazenamento. Envie de novo.';
  END IF;
  INSERT INTO public.arquivos_farmacia (unidade_id, tipo, caminho, nome, tamanho, tipo_mime, enviado_por)
  VALUES (p_unidade, p_tipo, p_caminho, btrim(p_nome), p_tamanho, left(p_tipo_mime, 120), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('enviar_arquivo_farmacia', 'arquivos_farmacia', v_id, p_unidade,
    jsonb_build_object('tipo', p_tipo, 'nome', btrim(p_nome), 'tamanho', p_tamanho));
  RETURN v_id;
END $$;

-- ── 4 e 5. diluição da unidade, flebite e alta vigilância ───────────────────
ALTER TABLE public.diluicao ADD COLUMN IF NOT EXISTS risco_flebite boolean;
COMMENT ON COLUMN public.diluicao.risco_flebite IS
  'Risco de flebite em acesso periférico, marcado pelo farmacêutico conforme a fonte da linha. Nulo = não informado.';
CREATE INDEX IF NOT EXISTS idx_diluicao_unidade ON public.diluicao (unidade_id) WHERE unidade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diluicao_origem ON public.diluicao (origem_id);
CREATE INDEX IF NOT EXISTS idx_diluicao_publicado_por ON public.diluicao (publicado_por);

-- quem mexe na linha: a da rede, qualquer farmacêutico (fase 4.5); a da
-- unidade, só o farmacêutico daquela unidade
CREATE OR REPLACE FUNCTION private.pode_editar_diluicao(p_unidade uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p_unidade IS NULL THEN private.sou_farmaceutico() OR private.eh_super_admin()
              ELSE private.farmaceutico_da(p_unidade) END
$$;

CREATE OR REPLACE FUNCTION public.salvar_diluicao(p_id uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.diluicao; v_id uuid; m public.medicamento;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.sou_farmaceutico() OR private.eh_super_admin()) THEN RAISE EXCEPTION 'Diluição é do farmacêutico.'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO d FROM public.diluicao WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Diluição não encontrada.'; END IF;
    IF NOT private.pode_editar_diluicao(d.unidade_id) THEN
      RAISE EXCEPTION 'Esta linha é do padrão de outra unidade: só o farmacêutico dela ajusta.';
    END IF;
  END IF;
  IF p_id IS NULL OR d.status IN ('publicado', 'substituido') THEN
    IF p_id IS NULL THEN
      SELECT * INTO m FROM public.medicamento WHERE id = (p_dados ->> 'medicamento_id')::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Escolha o medicamento do cadastro.'; END IF;
      IF nullif(btrim(p_dados ->> 'via'), '') IS NULL THEN RAISE EXCEPTION 'Informe a via.'; END IF;
      INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, fonte, status)
      VALUES (m.id, m.principio_ativo, coalesce(m.apresentacao, ''), upper(btrim(p_dados ->> 'via')),
              coalesce(nullif(btrim(p_dados ->> 'fonte'), ''), 'a definir'), 'rascunho')
      RETURNING id INTO v_id;
    ELSE
      INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, reconstituicao_diluente, reconstituicao_volume_ml,
        reconstituicao_concentracao, diluicao_solucao, diluicao_volume_min_ml, concentracao_maxima, tempo_infusao_min, velocidade_max,
        bolus_permitido, estabilidade_ta_h, estabilidade_refrig_h, fotossensivel, acesso, ajuste_renal, ajuste_renal_regra,
        incompatibilidades, alta_vigilancia, risco_flebite, observacoes, fonte, data_revisao, revisor_crf, status, versao, unidade_id, origem_id)
      SELECT medicamento_id, principio_ativo, apresentacao, via, reconstituicao_diluente, reconstituicao_volume_ml,
        reconstituicao_concentracao, diluicao_solucao, diluicao_volume_min_ml, concentracao_maxima, tempo_infusao_min, velocidade_max,
        bolus_permitido, estabilidade_ta_h, estabilidade_refrig_h, fotossensivel, acesso, ajuste_renal, ajuste_renal_regra,
        incompatibilidades, alta_vigilancia, risco_flebite, observacoes, fonte, NULL, NULL, 'rascunho', versao + 1, unidade_id, id
      FROM public.diluicao WHERE id = p_id
      RETURNING id INTO v_id;
    END IF;
  ELSE
    v_id := p_id;
  END IF;
  UPDATE public.diluicao SET
    reconstituicao_diluente = CASE WHEN p_dados ? 'reconstituicao_diluente' THEN nullif(btrim(p_dados ->> 'reconstituicao_diluente'), '') ELSE reconstituicao_diluente END,
    reconstituicao_volume_ml = CASE WHEN p_dados ? 'reconstituicao_volume_ml' THEN nullif(p_dados ->> 'reconstituicao_volume_ml', '')::numeric ELSE reconstituicao_volume_ml END,
    reconstituicao_concentracao = CASE WHEN p_dados ? 'reconstituicao_concentracao' THEN nullif(btrim(p_dados ->> 'reconstituicao_concentracao'), '') ELSE reconstituicao_concentracao END,
    diluicao_solucao = CASE WHEN p_dados ? 'diluicao_solucao' THEN ARRAY(SELECT jsonb_array_elements_text(p_dados -> 'diluicao_solucao')) ELSE diluicao_solucao END,
    diluicao_volume_min_ml = CASE WHEN p_dados ? 'diluicao_volume_min_ml' THEN nullif(p_dados ->> 'diluicao_volume_min_ml', '')::numeric ELSE diluicao_volume_min_ml END,
    concentracao_maxima = CASE WHEN p_dados ? 'concentracao_maxima' THEN nullif(btrim(p_dados ->> 'concentracao_maxima'), '') ELSE concentracao_maxima END,
    tempo_infusao_min = CASE WHEN p_dados ? 'tempo_infusao_min' THEN nullif(p_dados ->> 'tempo_infusao_min', '')::int ELSE tempo_infusao_min END,
    velocidade_max = CASE WHEN p_dados ? 'velocidade_max' THEN nullif(btrim(p_dados ->> 'velocidade_max'), '') ELSE velocidade_max END,
    bolus_permitido = CASE WHEN p_dados ? 'bolus_permitido' THEN (p_dados ->> 'bolus_permitido')::boolean ELSE bolus_permitido END,
    estabilidade_ta_h = CASE WHEN p_dados ? 'estabilidade_ta_h' THEN nullif(p_dados ->> 'estabilidade_ta_h', '')::numeric ELSE estabilidade_ta_h END,
    estabilidade_refrig_h = CASE WHEN p_dados ? 'estabilidade_refrig_h' THEN nullif(p_dados ->> 'estabilidade_refrig_h', '')::numeric ELSE estabilidade_refrig_h END,
    fotossensivel = CASE WHEN p_dados ? 'fotossensivel' THEN (p_dados ->> 'fotossensivel')::boolean ELSE fotossensivel END,
    acesso = CASE WHEN p_dados ? 'acesso' THEN nullif(btrim(p_dados ->> 'acesso'), '') ELSE acesso END,
    alta_vigilancia = CASE WHEN p_dados ? 'alta_vigilancia' THEN coalesce((p_dados ->> 'alta_vigilancia')::boolean, false) ELSE alta_vigilancia END,
    risco_flebite = CASE WHEN p_dados ? 'risco_flebite' THEN (p_dados ->> 'risco_flebite')::boolean ELSE risco_flebite END,
    observacoes = CASE WHEN p_dados ? 'observacoes' THEN nullif(btrim(p_dados ->> 'observacoes'), '') ELSE observacoes END,
    fonte = CASE WHEN p_dados ? 'fonte' THEN coalesce(nullif(btrim(p_dados ->> 'fonte'), ''), fonte) ELSE fonte END,
    revisor_crf = CASE WHEN p_dados ? 'revisor_crf' THEN nullif(btrim(p_dados ->> 'revisor_crf'), '') ELSE revisor_crf END,
    motivo_alteracao = CASE WHEN p_dados ? 'motivo_alteracao' THEN nullif(btrim(p_dados ->> 'motivo_alteracao'), '') ELSE motivo_alteracao END
  WHERE id = v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.publicar_diluicao_versao(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.diluicao; v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_farmaceutico() THEN RAISE EXCEPTION 'Publicar diluição é do farmacêutico.'; END IF;
  SELECT * INTO d FROM public.diluicao WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR d.status NOT IN ('rascunho', 'revisado') THEN RAISE EXCEPTION 'Só se publica rascunho.'; END IF;
  IF NOT private.pode_editar_diluicao(d.unidade_id) THEN
    RAISE EXCEPTION 'Esta linha é do padrão de outra unidade: só o farmacêutico dela publica.';
  END IF;
  IF d.medicamento_id IS NULL THEN RAISE EXCEPTION 'Ligue a diluição a um medicamento do cadastro antes de publicar.'; END IF;
  IF nullif(btrim(d.revisor_crf), '') IS NULL THEN RAISE EXCEPTION 'Sem o CRF do revisor não publica.'; END IF;
  IF nullif(btrim(d.fonte), '') IS NULL OR d.fonte = 'a definir' THEN RAISE EXCEPTION 'Informe a fonte da diluição.'; END IF;
  IF upper(d.via) = 'EV' AND (d.diluicao_volume_min_ml IS NULL OR d.tempo_infusao_min IS NULL) THEN
    RAISE EXCEPTION 'Via EV: sem volume mínimo e tempo de infusão não publica.';
  END IF;
  IF d.origem_id IS NOT NULL AND length(btrim(coalesce(d.motivo_alteracao, ''))) < 10 THEN
    RAISE EXCEPTION 'Nova versão: diga o que mudou (mínimo de 10 letras).';
  END IF;
  UPDATE public.diluicao SET vigente_ate = now(), status = 'substituido'
   WHERE medicamento_id = d.medicamento_id AND upper(via) = upper(d.via) AND unidade_id IS NOT DISTINCT FROM d.unidade_id
     AND status = 'publicado' AND id <> d.id;
  UPDATE public.diluicao
     SET status = 'publicado', vigente_desde = now(), publicado_em = now(), publicado_por = v_perfil, data_revisao = current_date
   WHERE id = d.id;
  PERFORM private.registrar_auditoria('publicar_diluicao', 'diluicao', d.id, d.unidade_id,
    jsonb_build_object('medicamento', d.principio_ativo, 'via', d.via, 'versao', d.versao, 'unidade_id', d.unidade_id));
END $$;

-- "Ajustar esta linha": rascunho da unidade a partir do que vale para ela
CREATE OR REPLACE FUNCTION public.ajustar_diluicao_unidade(p_diluicao uuid, p_unidade uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.diluicao; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.farmaceutico_da(p_unidade) THEN RAISE EXCEPTION 'Ajustar o padrão da unidade é do farmacêutico dela.'; END IF;
  SELECT * INTO d FROM public.diluicao WHERE id = p_diluicao;
  IF NOT FOUND OR d.status <> 'publicado' THEN RAISE EXCEPTION 'Só se ajusta a linha que está valendo.'; END IF;
  IF d.unidade_id IS NOT NULL AND d.unidade_id <> p_unidade THEN RAISE EXCEPTION 'Esta linha é do padrão de outra unidade.'; END IF;
  -- rascunho já aberto para esta linha na unidade: continua nele
  SELECT x.id INTO v_id FROM public.diluicao x
   WHERE x.medicamento_id = d.medicamento_id AND upper(x.via) = upper(d.via) AND x.unidade_id = p_unidade
     AND x.status IN ('rascunho', 'revisado')
   ORDER BY x.created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF d.unidade_id = p_unidade THEN
    RETURN public.salvar_diluicao(d.id, '{}'::jsonb);  -- nova versão da linha da unidade
  END IF;
  IF EXISTS (SELECT 1 FROM public.diluicao x WHERE x.medicamento_id = d.medicamento_id AND upper(x.via) = upper(d.via)
               AND x.unidade_id = p_unidade AND x.status = 'publicado') THEN
    RAISE EXCEPTION 'A unidade já tem ajuste publicado desta linha: ajuste a linha da unidade.';
  END IF;
  INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, reconstituicao_diluente, reconstituicao_volume_ml,
    reconstituicao_concentracao, diluicao_solucao, diluicao_volume_min_ml, concentracao_maxima, tempo_infusao_min, velocidade_max,
    bolus_permitido, estabilidade_ta_h, estabilidade_refrig_h, fotossensivel, acesso, ajuste_renal, ajuste_renal_regra,
    incompatibilidades, alta_vigilancia, risco_flebite, observacoes, fonte, status, versao, unidade_id, origem_id)
  SELECT medicamento_id, principio_ativo, apresentacao, via, reconstituicao_diluente, reconstituicao_volume_ml,
    reconstituicao_concentracao, diluicao_solucao, diluicao_volume_min_ml, concentracao_maxima, tempo_infusao_min, velocidade_max,
    bolus_permitido, estabilidade_ta_h, estabilidade_refrig_h, fotossensivel, acesso, ajuste_renal, ajuste_renal_regra,
    incompatibilidades, alta_vigilancia, risco_flebite, observacoes, fonte, 'rascunho', 1, p_unidade, id
  FROM public.diluicao WHERE id = d.id
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- "Voltar ao modelo": a linha da unidade deixa de valer; volta a da rede. O
-- motivo fica ao lado (a linha publicada não se edita e a auditoria só guarda
-- chaves da lista branca).
CREATE TABLE IF NOT EXISTS public.diluicao_encerramentos (
  diluicao_id   uuid PRIMARY KEY REFERENCES public.diluicao(id),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  motivo        text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  encerrado_por uuid NOT NULL REFERENCES public.perfis(id),
  encerrado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diluicao_encerramentos_unidade ON public.diluicao_encerramentos (unidade_id);
CREATE INDEX IF NOT EXISTS idx_diluicao_encerramentos_por ON public.diluicao_encerramentos (encerrado_por);
DROP TRIGGER IF EXISTS trg_diluicao_encerramentos_so_insercao ON public.diluicao_encerramentos;
CREATE TRIGGER trg_diluicao_encerramentos_so_insercao BEFORE UPDATE OR DELETE ON public.diluicao_encerramentos
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.diluicao_encerramentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS diluicao_encerramentos_select ON public.diluicao_encerramentos;
CREATE POLICY diluicao_encerramentos_select ON public.diluicao_encerramentos FOR SELECT TO authenticated
  USING (private.sou_farmaceutico() OR private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor');
REVOKE ALL ON public.diluicao_encerramentos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.diluicao_encerramentos FROM authenticated;
GRANT SELECT ON public.diluicao_encerramentos TO authenticated;

CREATE OR REPLACE FUNCTION public.diluicao_voltar_ao_modelo(p_diluicao uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.diluicao;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.diluicao WHERE id = p_diluicao FOR UPDATE;
  IF NOT FOUND OR d.status <> 'publicado' OR d.unidade_id IS NULL THEN
    RAISE EXCEPTION 'Só volta ao modelo a linha da unidade que está valendo.';
  END IF;
  IF NOT private.farmaceutico_da(d.unidade_id) THEN RAISE EXCEPTION 'Ajustar o padrão da unidade é do farmacêutico dela.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Diga por que volta ao modelo (mínimo de 10 letras).'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.diluicao x WHERE x.medicamento_id = d.medicamento_id AND upper(x.via) = upper(d.via)
                   AND x.unidade_id IS NULL AND x.status = 'publicado') THEN
    RAISE EXCEPTION 'Não há modelo da rede publicado para esta linha: a unidade ficaria sem diluição padrão.';
  END IF;
  UPDATE public.diluicao SET status = 'substituido', vigente_ate = now() WHERE id = d.id;
  INSERT INTO public.diluicao_encerramentos (diluicao_id, unidade_id, motivo, encerrado_por)
  VALUES (d.id, d.unidade_id, btrim(p_motivo), private.meu_perfil_id());
  PERFORM private.registrar_auditoria('diluicao_voltar_ao_modelo', 'diluicao', d.id, d.unidade_id,
    jsonb_build_object('tipo', 'voltar_ao_modelo', 'unidade_id', d.unidade_id));
END $$;

-- o padrão que vale para a unidade, linha a linha, com o modelo ao lado
CREATE OR REPLACE FUNCTION public.padrao_diluicao_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_res jsonb;
BEGIN
  IF NOT (private.farmaceutico_da(p_unidade) OR private.papel_na_unidade(p_unidade) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado: padrão de diluição da unidade.';
  END IF;
  WITH vig AS (
    SELECT DISTINCT ON (d.medicamento_id, upper(d.via)) d.*
      FROM public.diluicao d
     WHERE d.status = 'publicado' AND d.medicamento_id IS NOT NULL AND (d.unidade_id IS NULL OR d.unidade_id = p_unidade)
     ORDER BY d.medicamento_id, upper(d.via), (d.unidade_id IS NOT NULL) DESC, d.vigente_desde DESC
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id, 'medicamento_id', v.medicamento_id, 'principio_ativo', v.principio_ativo, 'apresentacao', v.apresentacao,
      'via', v.via, 'versao', v.versao, 'da_unidade', v.unidade_id IS NOT NULL, 'texto', private.diluicao_texto(v),
      'campos', to_jsonb(v) - ARRAY['id', 'created_at', 'updated_at', 'unidade_id', 'origem_id', 'publicado_por', 'status'],
      'modelo', (SELECT jsonb_build_object('id', g.id, 'versao', g.versao, 'texto', private.diluicao_texto(g),
                                           'campos', to_jsonb(g) - ARRAY['id', 'created_at', 'updated_at', 'unidade_id', 'origem_id', 'publicado_por', 'status'])
                   FROM public.diluicao g
                  WHERE v.unidade_id IS NOT NULL AND g.medicamento_id = v.medicamento_id AND upper(g.via) = upper(v.via)
                    AND g.unidade_id IS NULL AND g.status = 'publicado' LIMIT 1),
      'alta_vigilancia', coalesce(v.alta_vigilancia, false) OR coalesce(m.alta_vigilancia, false),
      'risco_flebite', v.risco_flebite, 'fonte', v.fonte, 'revisor_crf', v.revisor_crf, 'motivo_alteracao', v.motivo_alteracao,
      'publicado_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = v.publicado_por), 'vigente_desde', v.vigente_desde,
      'rascunho_id', (SELECT r.id FROM public.diluicao r WHERE r.medicamento_id = v.medicamento_id AND upper(r.via) = upper(v.via)
                        AND r.unidade_id = p_unidade AND r.status IN ('rascunho', 'revisado') ORDER BY r.created_at DESC LIMIT 1))
      ORDER BY v.principio_ativo, v.via), '[]'::jsonb)
    INTO v_res
    FROM vig v LEFT JOIN public.medicamento m ON m.id = v.medicamento_id;
  RETURN v_res;
END $$;

REVOKE ALL ON FUNCTION public.definir_limites_padrao_farmacia(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.limites_voltar_ao_padrao(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.disponibilidade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.farmacia_estoque(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_arquivo_farmacia(uuid, text, text, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_diluicao(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publicar_diluicao_versao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ajustar_diluicao_unidade(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.diluicao_voltar_ao_modelo(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.padrao_diluicao_unidade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.pode_editar_diluicao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.unidade_do_caminho(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_limites_padrao_farmacia(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.limites_voltar_ao_padrao(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disponibilidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.farmacia_estoque(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_arquivo_farmacia(uuid, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_diluicao(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_diluicao_versao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ajustar_diluicao_unidade(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diluicao_voltar_ao_modelo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.padrao_diluicao_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.pode_editar_diluicao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.unidade_do_caminho(text) TO authenticated;
