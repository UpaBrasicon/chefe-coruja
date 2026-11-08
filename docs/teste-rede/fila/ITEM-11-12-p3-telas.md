# Itens 11 e 12: P3 da conferência das telas (CONFERENCIA-TELAS.md)

Situação em 08/11/2026. Em 08/11/2026 o RT delegou as próximas ações e ficou com o "ok produção" e o merge.

## Item 11: CID sugerido fora da idade (P3-1) — fica com o RT
- **O que aconteceu:** para uma paciente de 68 anos, "Pneumonia comunitaria" sugeriu também P23.9 (pneumonia congênita, do capítulo XVI, perinatal).
- **Por que não foi feito:** decidir quais capítulos da CID não servem para cada idade é regra clínica e precisa de fonte citada, por regra do projeto: "nada de memória".
  - A CID-10 do DATASUS que está carregada não traz restrição por idade.
  - Segundo a OMS, o capítulo XVI também vale para condição de origem perinatal que aparece mais tarde. Então "esconder P para adulto" não é uma regra evidente; é uma escolha clínica.
- **Para o RT decidir, indicando a fonte:**
  - **A:** rebaixar na lista, sem esconder, os códigos do capítulo XVI (P00–P96) para quem tem 28 dias ou mais.
  - **B:** esconder esses códigos nessa idade.
  - **C:** deixar como está.

## Item 12: telas
1. **Central do Plantonista dizia "ninguém em observação no seu acesso"** quando o médico tinha observações que abriu pela porta. **Feito** (branch `correcoes/central-observacoes-que-abri`):
   - `CartaoTurno` passa a contar `observacoes_que_abri`;
   - com alguma aberta, a mensagem fica "Ninguém aguardando o médico na porta. N observações que você abriu seguem abertas.";
   - o atalho "Ver observação" ganha o título certo;
   - não há migration.
2. **"Finalizados no plantão" não mostra a observação encerrada por "Observações que você abriu".** **Fica com o RT:**
   - a lista vem do painel da observação, que lê só os setores da escala;
   - mostrar ao autor as observações que ele encerrou amplia a leitura de paciente já encerrado, o mesmo assunto de privacidade do D P1-1 (#484);
   - **opção A (recomendada):** mostrar só ao autor, só no plantão e só com o nome, o box e o desfecho, sem texto clínico;
   - **opção B:** deixar como está.
3. **39 avisos empilhados no topo da Central.** **Não feito nesta rodada:**
   - os avisos flutuantes (`AvisosFlutuantesContext`) já se fecham sozinhos, então o empilhamento vem de outra lista;
   - ainda falta localizar o componente e decidir o limite e o botão "fechar todos";
   - fica para a próxima sessão.
4. **A gestante do A01 em observação há cerca de 18 h** é sobra de teste. Entra na limpeza da homologação.
