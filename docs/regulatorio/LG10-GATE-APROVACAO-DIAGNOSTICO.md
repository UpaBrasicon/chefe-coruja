# LG10: aprovação clínica antes de publicar (diagnóstico, 17/11/2026)

Trilha de obrigatórios legais e regulatórios, item LG10 (P0). Base: `docs/regulatorio/SAMD-CAMINHO-1-DIAGNOSTICO.md`, passo 3 da ordem sugerida.

O que se quer: a ficha nova só aparece para quem usa depois de aprovada pelo responsável técnico. Até lá, a tela mostra a versão anterior. Hoje acontece o contrário: a regra vai ao ar e a aprovação vem depois.

Este documento não muda código nem banco.

## Como é hoje

### Onde mora a regra

- **A regra de cada ferramenta está no código.** Ela fica em `src/clinico`, com a ficha (`id`, `versao`, `publico`, `fontes`) e os testes.
- **O texto clínico das telas também está no código.** Próximos passos, armadilhas, listas de dose e o "modelo completo" ficam em `src/pages/plantonista/**` e `src/components/plantonista/**`. O topo de cada ferramenta fica em `src/clinico/topos.ts`.
- **O banco guarda só o registro.** `ferramenta_versoes` (migration `20260930000001`) guarda cada versão, o status e quem decidiu. O status é `aguardando_aprovacao`, `aprovada`, `reprovada` ou `substituida`.
- **A migration de cada lote registra as versões.** Ela é gerada por `npm run fichas:sql`. Versão já registrada não muda; regra alterada precisa de versão nova.

### Como a aprovação funciona

- **Quem decide:** só o responsável técnico médico nomeado pela rede, em `/revisao-clinica`. A decisão passa por `decidir_versao_ferramenta`, uma versão por vez, com o CRM e a auditoria. A aprovação em lote chama a mesma função para cada versão.
- **Aprovar substitui a anterior:** a versão aprovada antes passa a `substituida`.
- **O que a tela mostra:** `ToolLayout` lê `situacao_ferramenta` e mostra uma faixa.
  - aprovada: "Versão X aprovada por… (CRM…) em…";
  - aguardando: "Regra (versão X) aguardando aprovação do responsável técnico";
  - reprovada: aviso vermelho com a correção pedida;
  - substituída: "Atualize a página".

### O que falta para o gate

1. **A aprovação não segura nada.** Merge no `master` publica na Vercel na hora (memória "merge no master sobe à produção"). A versão nova aparece antes de qualquer decisão, só com a faixa "aguardando".
2. **A versão anterior não existe no pacote.** O app publicado só tem o código da versão atual. Não há como "mostrar a anterior" sem mudar isso.
3. **Texto clínico muda sem versão nova.** Exemplos: os topos (#830–#834) e o modelo completo das condutas, lote 1 (#840). O #840 diz "sem mudança de dose, ficha ou migration", mas mudou próximos passos, armadilhas e alertas em 12 telas. Um gate que olha só a versão deixaria essas mudanças passarem.
4. **Quase nada está aprovado.** Na homologação, em 17/11/2026: 331 ferramentas, 598 versões aguardando, 8 substituídas e **nenhuma aprovada**. Esta sessão não leu a contagem da produção (a consulta foi bloqueada pela permissão); fica para o primeiro passo da implementação, ou o RT vê na própria Revisão Clínica. Nas notas da sessão das calculadoras, "aprovação das fichas na Revisão Clínica" aparece como pendente.

## O que a norma e a boa prática pedem

- **Controle de mudança.** RDC 657/2022 e RDC 665/2022, no espírito da IEC 62304 e da ISO 13485. Toda mudança no software clínico é avaliada e aprovada antes do release. A versão em uso é sempre uma versão aprovada, rastreável até a fonte e até quem aprovou.
- **Gestão de risco.** ISO 14971: a regra errada não pode chegar ao usuário por falta de passo no processo.
- **Vale em qualquer cenário.** O gate vale mesmo que o consultor diga que parte da Central fica fora de SaMD (LG11). Ele fecha o terceiro risco da trilha: "regra clínica publicada antes de aprovada".

## Decisões para o RT

**G1. Onde fica o gate**
- **A (recomendada):** na publicação.
  - O PR para o `master` não passa no CI se alguma ficha nova, ou com versão nova, ainda não estiver `aprovada` na produção.
  - Como o código novo não entra, a tela continua com a versão anterior, que já está no ar.
  - O RT confere a tela nova na homologação e aprova na Revisão Clínica da produção.
- **B:** na tela, com o app em funcionamento.
  - O pacote leva junto o código da versão anterior de cada ficha alterada, e a tela escolhe pela aprovação.
  - Isso duplica código clínico (331 ferramentas) e cria um caminho a mais para erro de dose.
  - Também não resolve a ficha nova, que não tem versão anterior.

**G2. Versão nova obrigatória quando o conteúdo clínico muda**
Além da ficha, há texto clínico com fonte citada fora dela: o topo (`TOPOS[id]` em `src/clinico/topos.ts`, 227 ferramentas) e o guia de próximos passos, armadilhas e evidências (`GUIAS[id]` em `src/clinico/guias.ts`, 34 ferramentas). Os dois são guardados pelo id da ficha e hoje mudam sem versão nova. As telas em `src/pages/plantonista/**` também têm texto clínico, como as listas de dose.

- **A (recomendada):** guarda no CI, com duas regras.
  - **Conteúdo puro:** a guarda compara, para cada id, a ficha, o `TOPOS[id]` e o `GUIAS[id]` do PR com os do `master`. Se algum mudou e a versão da ficha não, o CI falha. Não há linha que dispense, porque esses arquivos só têm conteúdo.
  - **Telas:** se mudou o arquivo de uma tela ligada a uma ficha e a versão não subiu, o CI falha. A exceção é a mudança só de interface (abas, faixa, "Copiar", estilo), que passa com a linha `Sem mudança clínica: <motivo>` no corpo do PR. O RT vê a linha antes de dar o "ok produção".
  - A ligação entre tela e ficha sai do `ROTA_DA_FICHA` (`src/clinico/indice.ts`) e do `registry.tsx`, como já faz o `scripts/rotas-fichas.mjs`.
- **B:** a guarda olha só a ficha. Topo, guia e telas ficam na disciplina de cada PR, como hoje.

O custo do G2 = A é reaprovar a ficha quando muda o topo ou o guia dela. Hoje esse custo é quase zero, porque nenhuma versão está aprovada na homologação: a primeira aprovação de cada ferramenta já cobre o topo e o guia atuais.

Efeito nos lotes que faltam das calculadoras (pediatria, 50 telas): pela sessão das calculadoras, o modelo completo só reorganiza a interface, sem mudar o texto clínico. Nesse caso o lote passa com a linha "Sem mudança clínica", sem versão nova. Se um lote mudar texto, topo ou guia, a versão sobe, entra na migration e espera a aprovação. A aprovação em lote já existe.

Opção considerada e deixada de lado: uma versão própria para o topo e o guia, aprovada à parte. São duas filas para a mesma ferramenta, e a tela teria de juntar as duas aprovações.

**G3. Ferramentas que nunca tiveram versão aprovada (o estado de hoje)**
- **A (recomendada):**
  - continuam no ar com a faixa "aguardando aprovação", como hoje;
  - o gate vale para toda versão nova e toda ferramenta nova, a partir do dia em que entrar;
  - a fila antiga sai na Revisão Clínica, no ritmo do RT;
  - o BACKLOG ganha uma linha com a contagem e o prazo que o RT escolher.
- **B:** tirar da tela tudo o que não tem versão aprovada. A Central fica quase vazia até o RT aprovar a fila inteira.

**G4. A tela entre a aprovação e a publicação**

Com G1 = A, o RT aprova a versão nova antes do merge. Hoje isso marca a anterior como `substituida`, e a tela (ainda na anterior) diria "Atualize a página" por alguns minutos.
- **A (recomendada):** só muda o texto da faixa. A tela segue mostrando "Versão X aprovada por… em…", com uma linha a mais: "A versão nova já foi aprovada e entra na próxima publicação." Não muda nada no banco.
- **B:** a anterior só vira `substituida` quando a nova for publicada. Precisa de um passo a mais no banco a cada merge.

**G5. Correção urgente (erro de dose no ar)**
- **A (recomendada):** sem atalho.
  - A correção também passa pela aprovação, que o RT faz pelo celular em minutos.
  - Se o erro for grave, o gestor da unidade já pode suspender a ferramenta na hora, na tela Ferramentas da unidade (`ferramenta_unidade.oculta`).
  - Registrar no LG13 que o comitê precisa de suplente.
- **B:** etiqueta "urgência clínica" no PR que pula o gate. A versão fica no ar aguardando, com registro na auditoria.

**G6. Como o CI lê a aprovação da produção**
- **A (recomendada):** uma função nova, só de leitura, chamada com a chave publicável da produção (ela já é pública no pacote do site).
  - Recebe a lista `(ferramenta, versão)` do PR e devolve o status de cada uma. Não devolve nome, CRM nem dado de paciente.
  - Se a função não responder, o CI falha. Na dúvida, não publica.
- **B:** guardar no GitHub a chave de serviço da produção. Dá acesso total ao banco a partir do CI; é pior.

**G7. Alcance deste item**
- **A (recomendada):** as ferramentas da Central (`src/clinico` e as telas delas).
  - Ficam para o LG11 e o LG13: os alertas que rodam no banco (sepse do adulto, interações críticas, acuidade por NEWS2 e PEWS) e o conteúdo do Hermes.
  - Esses alertas mudam por migration e já passam pelo "ok produção".
- **B:** incluir já os alertas do banco. Cada migration que mude regra de alerta passaria a exigir versão registrada e aprovada.

## Como fica o fluxo de um lote, com G1 a G6 = A

1. Código e migration das fichas vão para a homologação. O CI roda a guarda do G2.
2. O RT confere as telas na homologação.
3. O RT dá o "ok produção". A migration vai à produção e registra as versões novas como `aguardando_aprovacao`.
4. O RT aprova as versões na Revisão Clínica da produção. A fila ganha o link "ver na homologação" para as versões que ainda não estão no ar.
5. O CI roda de novo. O gate fica verde, e só então o PR é mesclado e a versão nova vai ao ar.

Os passos 3 e 4 continuam separados. O "ok produção" é sobre o banco; a aprovação é sobre a regra clínica, com o CRM.

## Plano da implementação (depois das decisões)

| Parte | O que muda |
|---|---|
| Banco | Migration expand, idempotente: função de leitura do G6, com `search_path` vazio, `grant` só do necessário e teste em `supabase/tests`. A volta é `DROP FUNCTION`. |
| Script | `scripts/gate-fichas.mjs`: compara as fichas do PR com as do `master` (como o `fichas:sql`), aplica a guarda do G2 e consulta a produção (G6). Testes de unidade em `node --test`. |
| CI | Dois passos no job `web`: guarda (G2) e gate (G1). Não muda os 4 checks obrigatórios do `master`. |
| Tela | Faixa do `ToolLayout` (G4); link "ver na homologação" na fila da Revisão Clínica. |
| Ensaio | Na homologação, um PR de teste com versão nova de uma ficha real: o gate apontado para a homologação fica vermelho; depois de aprovar lá, fica verde. Evidência registrada no PR. |
| Registro | BACKLOG e memória do projeto. |

**Antes de mexer no código:** combinar com a sessão das calculadoras, que ainda edita as telas. Ela respondeu em 17/11/2026: o lote de emergências (64 telas, branch `feat/calculadoras-modelo-condutas-lote2`) não mexe em `src/clinico`, ficha nem migration; o `ToolLayout.tsx` está livre, partindo do `master` atual.

## Riscos

- **O gate atrasa a publicação.** Cada lote de fichas espera a aprovação do RT. É o efeito pretendido. Com um aprovador só, o RT vira o gargalo, e o LG13 trata disso.
- **A guarda erra.** Ela pode pedir versão para mudança só de forma (tem saída: a linha "Sem mudança clínica") ou deixar passar texto clínico de um arquivo que ela não liga a nenhuma ficha. Na implementação, a lista de arquivos não ligados fica impressa no log do CI, para conferência.
- **A produção fica fora do ar no momento do merge.** O gate falha e espera; nada é publicado sem aprovação confirmada.
