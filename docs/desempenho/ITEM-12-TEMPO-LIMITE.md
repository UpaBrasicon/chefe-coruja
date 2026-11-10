# Item 12: tempo-limite em serviço externo

Trilha de desempenho (kit de 31 passos). Decisão do RT em 09/11/2026: B, tempo-limite só na Resend (`enviar-codigo-2fa`), sem limite global nas chamadas do navegador ao banco; rever com os dados do item 30.

## Diagnóstico

Serviços externos chamados pelo sistema:

| Chamada | Tempo-limite |
|---|---|
| `clinical-search` → Hermes (Pergunte à IA) | já tinha: 120 s para pergunta, 45 s para busca |
| `webhooks` → destinos dos integradores | já tinha |
| `enviar-codigo-2fa` → Resend (código do segundo fator por e-mail) | não tinha |

Sem limite, uma Resend lenta deixava a pessoa esperando o código até a função cair.

## Correção

`supabase/functions/enviar-codigo-2fa/index.ts`: a chamada à Resend leva `AbortSignal.timeout(10 s)`. Estourou (ou caiu a rede), a função relata o erro ao Sentry (`resend_demorou` ou `resend_sem_rede`) e responde 504 com "o envio do código demorou; tente de novo em instantes". O caminho normal não muda.

## Teste

`src/lib/tempoLimiteResend.test.ts`: a chamada à Resend tem `AbortSignal.timeout(LIMITE_RESEND_MS)` de 10 s, e o estouro responde 504 e relata `resend_demorou`. Falha no master. A função foi empacotada e publicada na homologação em 09/11/2026 (`supabase functions deploy enviar-codigo-2fa`, só ela).

## Produção

O merge do PR (#518) não publica a função. Com o ok do RT (09/11/2026, "Ok produção nas duas"), a sessão principal publicou só a `enviar-codigo-2fa` na produção: versão 15, `verify_jwt` ligado, versão do commit gravada. Concluído.

## Como reverter

Reverter o commit e publicar a função de novo.
