-- A versão .1 da sepse no adulto (rastreio pelo qSOFA) foi trocada pela .2,
-- alinhada à Surviving Sepsis Campaign 2026 (rastreio pelo NEWS2), antes de o
-- responsável técnico decidir. Sai da fila sem ter sido aprovada.
UPDATE public.ferramenta_versoes
   SET status = 'substituida',
       decisao_nota = 'Substituída pela versão 2026-09-27.2 antes da decisão (alinhamento à SSC 2026)'
 WHERE ferramenta_id = 'sepse-adulto' AND versao = '2026-09-27.1' AND status = 'aguardando_aprovacao';
