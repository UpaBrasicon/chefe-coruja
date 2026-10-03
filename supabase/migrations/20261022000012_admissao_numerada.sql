-- Ficha de admissão: número da unidade no registro (auditoria do frontend
-- 03/10/2026, defeito 8).
--
-- registrar_admissao → registrar_evolucao grava a admissão 'ativo' SEM número,
-- e folha_documento só imprime documento emitido (com número): a ficha não
-- saía nem na hora do registro nem na reimpressão ("a folha não pôde ser
-- montada"). O modelo de documento já trata a admissão como documento
-- numerado (cancelar_documento aceita admissao_anamnese e exige número).
--
-- DECISÃO: a admissão recebe o número definitivo da unidade (AAAA/000001,
-- private.gerar_numero_documento) e emitido_em quando é gravada ativa — no
-- registro e em cada correção (corrigir_evolucao grava nova versão ativa, como
-- a retificação dos outros documentos, que também ganha número próprio). O
-- código de conferência continua saindo do conteudo_hash. Autor continua sendo
-- o usuário do login (as funções de gravação não mudam).
--
-- Um gatilho BEFORE INSERT cobre os dois caminhos sem reescrever as funções.
-- As admissões já gravadas sem número recebem número agora (ordem de criação).
-- Reaplicável.

CREATE OR REPLACE FUNCTION private.numerar_admissao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.tipo_documento = 'admissao_anamnese' AND NEW.estado = 'ativo' AND NEW.numero IS NULL THEN
    NEW.numero := private.gerar_numero_documento(NEW.unidade_id);
    NEW.emitido_em := coalesce(NEW.emitido_em, now());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.numerar_admissao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_admissao_numerada ON public.documentos_clinicos;
CREATE TRIGGER trg_admissao_numerada
  BEFORE INSERT ON public.documentos_clinicos
  FOR EACH ROW WHEN (NEW.tipo_documento = 'admissao_anamnese')
  EXECUTE FUNCTION private.numerar_admissao();

-- admissões já registradas sem número (versões em vigor e as retificadas)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, unidade_id FROM public.documentos_clinicos
            WHERE tipo_documento = 'admissao_anamnese' AND numero IS NULL AND estado IN ('ativo', 'retificado')
            ORDER BY created_at, versao
  LOOP
    UPDATE public.documentos_clinicos
       SET numero = private.gerar_numero_documento(r.unidade_id),
           emitido_em = coalesce(emitido_em, created_at)
     WHERE id = r.id;
  END LOOP;
END $$;
