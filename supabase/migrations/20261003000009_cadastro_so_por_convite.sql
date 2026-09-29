-- ════════════════════════════════════════════════════════════════════════════
-- Conta nova só por convite ou contrato (porte do frontend, onda 2).
--
-- O primeiro acesso (20261003000001) cria a conta com o código de convite ou
-- de contrato no metadado do signUp. Mas quem chamasse o signUp direto pela
-- API, sem código, ainda criava uma conta sem vínculo. Agora o gatilho que
-- recebe o signUp recusa a conta quando:
--   · a criação vem do servidor de Auth (session_user supabase_auth_admin —
--     o caminho do signUp público), e
--   · não há código de convite nem de contrato, e
--   · a conta não foi marcada pelo servidor como criada pela administração
--     (raw_app_meta_data.origem = 'admin' — o app_metadata só a chave de
--     serviço escreve; o signUp público não consegue pôr).
-- Seed e testes, que inserem em auth.users como postgres, não passam por aqui.
--
-- DOWN: reaplicar private.primeiro_acesso_estacionar de 20261003000001.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.primeiro_acesso_estacionar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(NEW.raw_user_meta_data ->> 'codigo_convite', NEW.raw_user_meta_data ->> 'codigo_contrato', '') = '' THEN
    IF session_user = 'supabase_auth_admin' AND coalesce(NEW.raw_app_meta_data ->> 'origem', '') <> 'admin' THEN
      RAISE EXCEPTION 'Conta nova só com convite da unidade ou contrato da rede.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  INSERT INTO private.primeiro_acesso_pendente (user_id, dados)
  VALUES (NEW.id, NEW.raw_user_meta_data)
  ON CONFLICT (user_id) DO UPDATE SET dados = EXCLUDED.dados, em = now();
  NEW.raw_user_meta_data := NEW.raw_user_meta_data - private.primeiro_acesso_chaves_pessoais();
  RETURN NEW;
END $$;
