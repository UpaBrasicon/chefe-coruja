-- Hiperpotassemia .1 sai da fila antes da decisão: a .2 mantém a referência de
-- 2026 e mostra o manual do HCFMUSP como divergência (decisão do RT, 27/09/2026).
UPDATE public.ferramenta_versoes
   SET status = 'substituida',
       decisao_nota = 'Substituída pela versão 2026-09-27.2 antes da decisão (divergência com o manual HCFMUSP incluída)'
 WHERE ferramenta_id = 'hiperpotassemia' AND versao = '2026-09-27.1' AND status = 'aguardando_aprovacao';
