# Trilha de segurança, S6: borda e API de integração — diagnóstico

**Pedido.** Em 15/11/2026, depois do S5, o RT escolheu o S6 ("S6 segurança").

**Origem.** Auditoria Cloudflare (`docs/seguranca/auditoria-cloudflare-2026-11-15/RESUMO.md`, item 13 e as notas de endurecimento).

**Escopo.** Só diagnóstico. O código foi lido no repositório. O teste do cabeçalho foi feito na homologação:
- uma chamada anônima com `X-Forwarded-For` falso;
- uma função temporária, apagada em seguida, que listou só os nomes dos cabeçalhos e comparou os valores sem mostrá-los.

## Fato 3 do S0: o gateway aceita o `X-Forwarded-For` do cliente (conferido)

Na homologação, uma chamada anônima a `registrar_erro_cliente` com `X-Forwarded-For: 203.0.113.77` gravou **203.0.113.77** como IP do erro. A linha de teste foi apagada depois.

O que o banco recebe atrás do gateway do Supabase:
- `x-forwarded-for` vem como `<o que o cliente mandou>, <IP real>`. O gateway acrescenta o IP real no fim e mantém o que veio antes.
- `cf-connecting-ip` traz o IP real e é igual ao último item do `x-forwarded-for`.
  - O cliente não consegue trocá-lo: a borda recusa a chamada que tenta mandar esse cabeçalho.
- `x-real-ip` não chega.

Os três pontos do código pegam o **primeiro** item, justamente o que o cliente controla:

| Onde | Para que serve o IP | O que o IP falso permite |
|---|---|---|
| `private.requisicao_ip()` | Trava de enxurrada de `registrar_erro_cliente` (anônimo) e IP gravado em auditorias (impressão, pedido de acesso, parecer, folhas, pulseira etc.) | Furar a trava de 30 erros a cada 10 min trocando o IP a cada chamada; registrar auditoria com IP inventado |
| `ipDeOrigem` em `supabase/functions/api/contrato.ts`, quando `API_BORDA_SEGREDO` não está definido | Lista de IPs permitidos de cada chave da API | Quem tem uma chave vazada passa pela lista de IPs mandando um IP permitido |
| `enderecoDaRede` em `supabase/functions/pedir-demonstracao/regras.ts` | Limite de 3 pedidos por hora por endereço e o `remoteip` do Turnstile | Furar o limite por endereço (o Turnstile continua valendo) |

## As outras lacunas

1. **Comparação de segredo comum.**
   - `x-coruja-borda` é comparado com `===` (`contrato.ts:157`).
   - O segredo do motor de webhooks (`x-motor-segredo`) é comparado no banco com `=`.
   - O risco pela rede é baixo, mas a troca é barata.
2. **Limite do corpo só pelo `Content-Length`.**
   - A API confere o cabeçalho (64 KB no financeiro, 15 MB no FHIR) e depois lê o corpo inteiro com `req.json()`.
   - Um corpo enviado sem `Content-Length` (em partes) passa sem limite até o teto da plataforma.
3. **Limite de taxa sem trava.**
   - `api_v1` e as outras portas da API contam os acessos do último minuto e depois gravam. Chamadas simultâneas passam do limite juntas.
   - O mesmo vale para `contar_pedido_demonstracao`.
4. **Webhook confere só o nome do endereço.**
   - O banco (`private.webhook_url_valida`) e o motor (`enderecoSeguro`) recusam IP digitado, `localhost`, `.local`, `.internal` e outros nomes do tipo.
   - Um nome público que aponta para endereço privado (ex.: `127.0.0.1.nip.io`, ou um domínio próprio apontado para `169.254.169.254`) passa.
   - Quem cadastra destino é o admin. Mesmo assim, o motor guarda os primeiros 200 caracteres da resposta, que o admin lê na tela de entregas.

## Decisões para o RT

**B1. IP de origem.**
- **A (recomendada):** o IP passa a vir do `cf-connecting-ip` e, na falta dele, do **último** item do `x-forwarded-for`. Nunca do primeiro.
  - Vale para `private.requisicao_ip()`, `pedir-demonstracao` e a API.
  - Na API, o cabeçalho da borda (`X-Coruja-IP-Cliente` com `X-Coruja-Borda`) continua valendo primeiro quando o segredo confere.
  - Chave com lista de IPs e sem IP confiável na chamada é recusada.
- **B:** exigir `API_BORDA_SEGREDO` na API e recusar toda chamada que não venha pela borda, além do item A no banco e no formulário.

**B2. Comparação de segredo.**
- **A (recomendada):** comparação em tempo constante na API (cabeçalho da borda) e, no banco, comparação dos resumos sha256 do segredo do motor.
- **B:** deixar como está.

**B3. Tamanho do corpo.**
- **A (recomendada):** ler o corpo em partes e parar ao passar do limite (64 KB no financeiro, 15 MB no FHIR), com resposta 413 mesmo sem `Content-Length`.
- **B:** só recusar chamada sem `Content-Length`.

**B4. Limite de taxa.**
- **A (recomendada):** trava curta por chave (`pg_advisory_xact_lock`) antes de contar, em todas as portas da API e em `contar_pedido_demonstracao`. A conta passa a ser exata.
- **B:** deixar como está; o excesso possível é de poucas chamadas por minuto.

**B5. Webhook e endereço privado.**
- **A (recomendada):** antes de cada envio, o motor resolve o nome (A e AAAA) e recusa a entrega quando algum endereço é privado, de loopback, link-local, de documentação ou reservado.
  - A conferência fica registrada na entrega ("Endereço recusado pelo motor").
  - Se a resolução de nome não existir no runtime das Edge Functions, uso DNS sobre HTTPS e registro a limitação (o `fetch` resolve de novo).
- **B:** além do A, guardar só o código HTTP da resposta, sem o começo do texto.

**B6. Produção.**
- **A (recomendada):** com a sua autorização, uma leitura na produção só dos **nomes** dos segredos das Edge Functions e da lista de funções publicadas, sem ler nenhum valor.
  - Mostra se `API_BORDA_SEGREDO` está definido e se `api` e `webhooks` estão no ar.
  - A ordem de aplicação depende disso.
- **B:** não olhar a produção.

## Riscos

- **IP que muda nas auditorias:** a partir da mudança, o IP registrado passa a ser o real. Os registros antigos ficam como estão.
- **Integrador que chama a API sem passar pela borda e tem lista de IPs:** com B1 = A, passa a valer o IP real dele, o que é o comportamento esperado. Com B1 = B, a chamada direta seria recusada.
- **Webhook para um destino cujo nome aponte para rede privada:** passa a ser recusado. Não há destino cadastrado na produção que dependa disso (conferir com B6).
- **Rollback:**
  - banco: recriar as funções antigas, escritas na migration;
  - funções: publicar a versão anterior (o `x-cc-versao` mostra qual está no ar).

## Critérios de aceite

1. Na homologação, com `X-Forwarded-For` falso, `registrar_erro_cliente` grava o IP real.
2. Teste de unidade do IP de origem: primeiro item falso ignorado, cabeçalho da borda só com o segredo certo.
3. Corpo sem `Content-Length` acima do limite recebe 413.
4. Teste de banco: a trava de taxa existe nas portas da API.
5. O motor recusa um destino cujo nome resolve para `127.0.0.1`.
6. CI verde.

## Depois

Com as decisões, abro a tarefa e começo pela migration na homologação.
