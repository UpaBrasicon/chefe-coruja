# Conferência das telas novas na homologação (08/11/2026)

Esta conferência foi feita pelo Chrome do RT, em homolog.chefecoruja.com.br, com as contas `medico.upa.f5` e `medico.hospital.f5`.

**Versão conferida:** a branch `homolog` foi alinhada ao master de 08/11 (98fcd425), que é a árvore do master com o `BACKLOG.md` da homologação. Antes, foi conferido que a homologação não tinha nada que o master não tivesse.

**Cenário:** `scripts/e2e/105_conferencia_telas_08nov.sql`. O paciente novo "Tela Chegada Teste", da UPA F5, ficou em observação aberta pelo médico da porta, com uma regulação de transferência (nº 176) para o Hospital F5, aceita sem leito reservado.

## Resultado
| Item | Tela | Conta | Resultado |
|---|---|---|---|
| 12 (#496) | Central do Plantonista | `medico.upa.f5` | **Ok.** "Ninguém aguardando o médico na porta. 2 observações que você abriu seguem abertas." |
| 4 (#489) | Observação: "Observações que você abriu" | `medico.upa.f5` | **Ok.** As duas observações aparecem com Reavaliar, Pedir parecer e Encerrar observação. O painel do parecer abre e lista os pareceres sem erro de acesso. A reavaliação não foi exercida, porque esse paciente ainda não tinha o primeiro atendimento na observação. |
| 5 (#490) | Encerrar observação por transferência | `medico.upa.f5` | **Ok.** A tela oferece "Regulação nº 176 · Hospital Fase 5" já escolhida, sem o campo de destino. "Sem regulação" faz o campo "Serviço de destino" aparecer. Confirmada a alta, a regulação ficou "em trânsito", com a saída marcada pela alta (autor = login do médico, `…0008`), a origem encerrada e a alta gravando o número da regulação. |
| 6 (#491) | Regulação, "Paciente chegou" | `medico.hospital.f5` | **Ok.** A tela mostra "Sem leito reservado: escolha o leito livre", com a lista de leitos; "Confirmar chegada e internar" fica desligado até escolher. Com o UTI-01 escolhido, a regulação ficou "realizada" na hora da chegada (autor `…0011`). O paciente foi cadastrado no hospital e internado no UTI-01, com origem "outra_unidade" e o episódio em internação. Só a conta de internação foi aberta. |

## Achados
1. **P2: leitos fora da internação na chegada (e no aceite).**
   - A lista de `regulacao_leitos_destino` oferece todos os leitos livres da unidade, inclusive "EST-01/EST-02 · Porta do Hospital". Para o paciente homem do teste, também ofereceu Obstetrícia.
   - `private.regulacao_internar_chegada` não confere o tipo do setor. Por isso a chegada poderia internar num leito da porta.
   - **Sugestão:** a chegada e o aceite aceitam só setor de internação, UTI ou isolamento, como `registrar_desfecho` já faz na internação pela porta. Um filtro por público ou sexo fica para o RT decidir.
2. **P2: o app instalado segue com a versão antiga depois da publicação.**
   - A página continuou com `index-Dc4dOzTQ.js` até o service worker ser desregistrado, embora o servidor já servisse `index-BnhPK940.js`.
   - Quem está com o app aberto pode ficar com a tela velha.
   - **Sugestão:** conferir o aviso de versão nova do service worker, com o botão "Atualizar".
3. **P3: avisos empilhados (achado 4 da conferência de 07/11).**
   - **Origem localizada:** são os avisos flutuantes (`AvisosFlutuantesContext`). Ao entrar, cada aviso não lido vira um balão, e o tempo de cada um cresce com a posição na fila. Com dezenas de avisos, eles se empilham no topo até sumirem sozinhos.
   - **Sugestão:** mostrar até 3 e um balão "e mais N avisos", com link para a página de avisos.

## O que ficou gravado na homologação
- "Tela Chegada Teste":
  - na UPA F5, alta por transferência da observação;
  - no Hospital F5, cadastrado e internado no UTI-01;
  - regulação nº 176 realizada.
- `medico.hospital.f5`: com o ok do RT, recebeu o mesmo hash de senha de `medico.upa.f5`.
