# Chave da fila sem conexão vinda do servidor: diagnóstico

Este é o achado guardado de 07/10/2026 (item 20 da Fase 0). O RT o abriu em 05/11/2026 como item 4 do lote de segurança.

## O problema

A fila sem conexão (`src/lib/offline/fila.ts`, ADR 0009) cifra cada registro com AES-GCM. A chave é **por pessoa**, gerada no próprio navegador e guardada no IndexedDB como **não exportável**.

Não exportável quer dizer que ninguém lê os bytes da chave. Mas qualquer script da mesma origem consegue **usar** a chave. Num computador compartilhado, alguém com as ferramentas de desenvolvedor abertas poderia decifrar a fila **ainda não sincronizada** de outra pessoa daquele navegador, mesmo depois que ela saiu da conta. A chave continua no IndexedDB para sempre.

## O que já existe e pode ser aproveitado

- **O padrão do servidor:** a chave do cofre dos rascunhos (`chave_rascunho()`, migration `20261026000001`) é entregue só depois do segundo fator, fica numa tabela em `private` e nunca vai para outra pessoa.
  - Ela é **por sessão** e é apagada quando a sessão acaba.
  - Para a fila, isso não serve: a fila pendente de uma sessão anterior ficaria ilegível e o registro clínico se perderia.
- **A cópia na aba:** o `sessionStorage` já guarda a chave do cofre para a recarga sem rede (parte 1 da recarga sem conexão).

## Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| O1 | Que chave | **Por pessoa, fixa**, criada e guardada no servidor (`private`), entregue por `chave_fila()` só depois do login com segundo fator. A mesma pessoa, em qualquer login, lê a sua fila pendente; outra pessoa nunca lê. | Por sessão, como o cofre dos rascunhos. A fila pendente de um login anterior fica ilegível e o registro se perde. |
| O2 | Recarga sem rede | Uma cópia da chave na aba (`sessionStorage`), com a mesma regra do cofre. Recarregar sem rede continua registrando. Sair ou fechar a aba apaga a cópia. | Só na memória: recarregar sem rede deixa de registrar até a rede voltar. |
| O3 | Fila já gravada com a chave do aparelho | No primeiro login com a chave nova, a fila é decifrada com a chave antiga, cifrada de novo com a nova, e a chave antiga é **apagada** do aparelho. | Esperar a fila esvaziar sozinha e só então apagar a chave antiga. |
| O4 | Aba fechada com registros pendentes, ainda sem rede | Os registros continuam no aparelho, cifrados. Ficam ilegíveis até **a mesma pessoa** entrar de novo, com rede, e então sobem. O aviso de saída mostra "N registros ainda no aparelho". | Proibir a saída com registros pendentes. |
| O5 | Troca da chave | Sem troca automática nesta entrega. Se um aparelho for perdido, o administrador gera uma chave nova para a pessoa; a fila que estava naquele aparelho fica ilegível de propósito. | Troca automática a cada 30 dias, recifrando a fila. |

## Plano com A em tudo

1. **Migration `chave_fila` (expand).**
   - `private.chave_fila (perfil_id pk, chave bytea default gen_random_bytes(32), criada_em)`;
   - `public.chave_fila()` exige o segundo fator e cria a chave na primeira vez;
   - `public.trocar_chave_fila(p_perfil)`, só para administrador, com auditoria.
   - O rollback fica escrito e testado na homologação. Para a produção, pedir o "ok produção".
2. **`fila.ts`.**
   - A chave passa a vir do servidor e é importada como não exportável, só na memória, com uma cópia na aba.
   - A fila antiga é migrada como em O3.
   - Sem a chave, não grava nada novo e mostra o aviso.
3. **Sair e o aviso de saída.** Sair apaga a cópia da chave. O aviso de saída mostra quantos registros estão pendentes.
4. **Testes.**
   - Unidade: cifrar e decifrar com a chave importada; sem chave, nada é lido; a migração da fila antiga.
   - Banco: `5x_chave_fila`. Outra pessoa não lê; sem segundo fator, é recusado; a troca da chave é só do administrador.
5. **Homologação.** Gravar sem rede, sair, entrar com outra conta: a fila não é lida. Entrar de novo com a primeira conta: a fila sobe.

## Riscos

- **Fila presa até a mesma pessoa voltar (O4).** É de propósito: segurança no computador compartilhado. O papel continua sendo a contingência.
- **Perda da chave no servidor.** Ela entra no backup e na recuperação do banco como qualquer outra tabela.
