# Histórico encerrado com muitos atendimentos: diagnóstico

Este é o achado guardado de 08/10/2026. O RT o abriu em 06/11/2026 como item 7 da frente "Achados guardados".

## O que acontece hoje
- **Onde aparece:** o cartão "Histórico na unidade" (`src/components/prontuario/HistoricoEncerrado.tsx`, Fase 1, tarefa 8) fica no Resumo do leito da internação (`LeitoAberto.tsx`) e na janela de atendimento da porta (`JanelaAtendimento.tsx`).
- **Quem vê:** quem cuida do paciente agora, sem pedir ao gestor. O cartão mostra só o resumo de cada atendimento encerrado nesta unidade: data, setor e médico, cor, CID e desfecho, sem texto clínico. O detalhe abre com motivo, por 12 horas, e fica no registro de acesso.
- **Os dados** vêm da RPC `historico_encerrado`, que devolve até 200 atendimentos (`LIMIT 200`), do mais recente ao mais antigo.
- **O problema:** a tela mostra todos, um por linha, numa lista com rolagem dentro do cartão (`max-h-[320px]`). Com dezenas de atendimentos, a lista vira um rolo dentro de outro, e o que importa (os mais recentes e o padrão de idas e vindas) se perde.

## Ligação com o item 6
O Prontuário completo (#477) adotou a linha do tempo com o mais recente primeiro, separadores de data e "ver mais", seguindo a referência do Refero escolhida pelo RT (Visitors, c43c04b2). Este item usa o mesmo padrão no cartão do resumo, sem mudar o que o cartão pode mostrar.

## Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| H1 | Quantos aparecem de início | Os 5 mais recentes. Embaixo, "Ver todos os N", que mostra o resto agrupado por ano | Todos, agrupados por ano |
| H2 | Resumo no topo do cartão | Uma linha de contagem: total de atendimentos, quantos por desfecho, com os mesmos rótulos que o cartão já usa (Alta, Transferência, Evasão, Óbito e os outros), e a data do último | Sem resumo |
| H3 | Rolagem | Sem rolagem dentro do cartão: a lista cresce na página quando a pessoa pede "ver todos" | Manter a rolagem interna |
| H4 | Separador de ano | Cabeçalho "2026 · 12 atendimentos" entre os anos, quando a lista está aberta | Sem separador |
| H5 | Banco | Nada muda: a RPC já devolve tudo (até 200) e o cartão só reorganiza. O texto clínico continua fora, e o detalhe continua com motivo | Paginar no banco |

## Plano com A em tudo
1. **Testes antes:**
   - uma função pura em `src/lib/historico.ts` que agrupa por ano e conta por desfecho, com os casos lista vazia, 1, 5, 6, virada de ano e desfecho nulo;
   - teste de fonte do cartão: sem `max-h` com rolagem e com "Ver todos".
2. **Cartão:** a linha de resumo, os 5 mais recentes, "Ver todos os N" e os separadores de ano. O botão do detalhe com motivo e o rodapé "Resumo sem texto clínico" ficam como estão.
3. **Homologação:** conferir no Chrome, na porta e no Resumo do leito, com um paciente de teste que tenha mais de 5 atendimentos encerrados.

## Riscos
- **Esconder um atendimento importante atrás de "ver todos":** a linha de resumo mostra que existem outros e quantos são de cada desfecho, então nada fica invisível.
