-- Testes da migration 20270207000001_rnds_cofre_leitura.sql (Fase 5C, tarefa 5,
-- etapa 5.4b): o serviço acha o certificado que acabou de chegar.
-- Não depende da semente local (roda também na homologação). ROLLBACK no fim.
BEGIN;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.listado(p uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(public.rnds_certificados_aguardando(50)) x
                  WHERE x ->> 'credencial_id' = p::text) $$;

INSERT INTO public.organizacoes (id, nome) VALUES ('00000000-0000-4000-8000-0000000f5501', 'Rede RNDS Leitura Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, uf) VALUES
  ('00000000-0000-4000-8000-0000000f5502', '00000000-0000-4000-8000-0000000f5501', 'UPA Leitura Cofre', 'upa', '9999975', 'GO');
INSERT INTO public.rnds_credenciais (id, nome, unidade_principal_id, certificado_cifrado, certificado_enviado_em, certificado_situacao)
VALUES
  ('00000000-0000-4000-8000-0000000f5511', 'Aguardando', '00000000-0000-4000-8000-0000000f5502',
   '{"versao": 1, "chave_id": "chave-leitura", "chave": "a", "iv": "b", "dados": "c"}', now(), 'aguardando'),
  ('00000000-0000-4000-8000-0000000f5512', 'Ja lida', '00000000-0000-4000-8000-0000000f5502',
   '{"versao": 1, "chave_id": "chave-leitura", "chave": "a", "iv": "d", "dados": "c"}', now(), 'valido'),
  ('00000000-0000-4000-8000-0000000f5513', 'Sem certificado', '00000000-0000-4000-8000-0000000f5502', NULL, NULL, 'sem_certificado');

SELECT pg_temp.ok(pg_temp.listado('00000000-0000-4000-8000-0000000f5511'),
  'o certificado que acabou de chegar vai para a leitura, com o cifrado');
SELECT pg_temp.ok(NOT pg_temp.listado('00000000-0000-4000-8000-0000000f5512')
  AND NOT pg_temp.listado('00000000-0000-4000-8000-0000000f5513'),
  'o já lido e a credencial sem certificado ficam de fora');
SELECT pg_temp.ok((SELECT x #>> '{certificado_cifrado,chave_id}' FROM jsonb_array_elements(public.rnds_certificados_aguardando(50)) x
                    WHERE x ->> 'credencial_id' = '00000000-0000-4000-8000-0000000f5511') = 'chave-leitura',
  'o serviço recebe o cifrado inteiro');
SELECT pg_temp.ok(jsonb_array_length(public.rnds_certificados_aguardando(1)) = 1, 'o limite vale');

-- lido, sai da lista
SELECT public.rnds_registrar_certificado('00000000-0000-4000-8000-0000000f5511', 'senha_incorreta', p_erro => 'teste');
SELECT pg_temp.ok(NOT pg_temp.listado('00000000-0000-4000-8000-0000000f5511'), 'depois da leitura sai da lista');

SELECT pg_temp.ok(has_function_privilege('service_role', 'public.rnds_certificados_aguardando(integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.rnds_certificados_aguardando(integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.rnds_certificados_aguardando(integer)', 'EXECUTE'),
  'só a chave de serviço vê o cifrado');

ROLLBACK;
