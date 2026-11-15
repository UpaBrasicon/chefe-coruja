# Trilha de segurança, S4: documentos, impressão e reenvio offline — diagnóstico

**Pedido.** Em 15/11/2026, depois do S2, o RT escolheu o S4 ("S4 documentos").

**Origem.** Auditoria Cloudflare (`docs/seguranca/auditoria-cloudflare-2026-11-15/`): passadas 1 e 2 (impressão), 2 (reenvio offline e janela do anexo) e 3 (tipos de documento).

**Escopo.** Só diagnóstico, pelo código e pelas migrations. Nada muda antes das decisões.

## As quatro lacunas

### 1. Impressão: texto do usuário vira HTML, e a janela fica presa à aba do sistema

O cabeçalho de toda folha impressa é montado por `cabecalho(doc, sub)`. Ele existe em duas cópias iguais: `supabase/functions/_shared/folhas.ts:243-246` e `src/lib/folhas.ts:242-245`. O `sub` entra no HTML sem escape, e cada chamada confia que quem chamou já escapou.

O termo de consentimento passa o título do modelo sem escape (`folhas.ts:733-734`). Esse título é gravado como veio, por qualquer pessoa que pode atuar no paciente (pelo `emitir_documento`) ou pelo gestor (no modelo). Quando outra pessoa clica em "Imprimir", o HTML é escrito numa janela da mesma origem (`src/lib/prontuario.ts:82`). A CSP bloqueia script inline, mas ainda dá para:
- esconder com CSS a faixa de alergia ou a marca CANCELADO na folha impressa;
- usar meta refresh para mandar a janela a um site de fora.

Também:
- **Erro escrito cru:** o texto de erro vai sem escape para essas janelas (`prontuario.ts:167, 232, 270, 301, 316`, `LaudoAih.tsx:153`, `FichaAdmissao.tsx:229`, `ReavaliacaoQuadro.tsx:53, 59`).
- **Janela presa à aba:** nenhuma janela de impressão nem a do anexo (`ImpressaoProntuario.tsx:236-243`) zera o `window.opener`. Só o `abrirEmJanela` faz isso.

### 2. Documentos de fluxo próprio saindo pelos caminhos genéricos

Termo de consentimento, sumário de óbito, parecer e teleinterconsulta têm telas e regras próprias, como o papel de quem emite e o médico preenchido pelo servidor. Todos gravam por `private.gravar_documento_episodio`, que aceita qualquer tipo da lista (`20261001000003_fase7_teleinterconsulta.sql:43-45`).

Três caminhos genéricos chegam nessa função sem as regras do fluxo próprio. Só conferem se a pessoa pode atuar no paciente, o que não depende do papel:
- `emitir_documento`;
- `salvar_rascunho` e `emitir_rascunho`, que deixam passar o termo;
- a sincronização offline (`sincronizar_documento`).

No termo emitido pelo caminho genérico, o nome e o CRM do médico vêm do conteúdo que o cliente mandou.

### 3. Conferência de itens obrigatórios só em parte dos caminhos

A conferência de itens que faltam (`faltas_documento`) bloqueia, por exemplo:
- receita com alergia que trava;
- atestado retroativo;
- laudo de AIH incompleto.

Ela roda no `emitir_rascunho` para todos os tipos. No `emitir_documento`, roda só para o laudo de AIH (`20261102000002_aih_ciclo.sql:346`). Na sincronização offline, não roda nunca.

Pela sincronização, um laudo de AIH incompleto entra direto e o gatilho abre uma AIH "solicitada" para o regulador (`20261102000002:153`).

### 4. O reenvio offline confia no "estava sem conexão" do navegador

O reenvio (`sincronizar_registros`) aceita que o aparelho diga que estava sem conexão (`sem_conexao`) e desde quando (`ultimo_contato`). O servidor não confere isso com nada. Com essa declaração:
- registros com até 2 h de atraso, contadas desde o último contato declarado, entram direto no prontuário, sem ir para a revisão do gestor;
- quem autoriza é a escala daquele momento (`podia_atuar_no_paciente_em`), que confere o setor atual do paciente sem limite de tempo e não confere vínculo ativo nem papel.

A sincronização depois do turno é proposital (ADR 0009). O problema é só a declaração sem prova.

## Decisões para o RT

**D1. Impressão.**
- **A (recomendada):**
  - `cabecalho()` passa a escapar `doc` e `sub` dentro dela, nas duas cópias. As chamadas param de escapar antes, para não escapar duas vezes.
  - O texto de erro nas janelas passa a sair escapado.
  - Toda janela de impressão e a do anexo passam a abrir com `opener` zerado, por um auxiliar único.
- **B:** só escapar o título do termo.

**D2. Tipos de fluxo próprio.**
- **A (recomendada):** termo de consentimento, sumário de óbito, parecer e teleinterconsulta só pelo fluxo próprio.
  - `emitir_documento`, `salvar_rascunho`/`emitir_rascunho` e a sincronização offline recusam esses tipos, com a mensagem "use a tela própria".
  - Nenhuma tela atual usa o caminho genérico para eles; isso é conferido no código antes.
- **B:** manter os caminhos genéricos e copiar neles as regras de cada fluxo.

**D3. Itens obrigatórios.**
- **A (recomendada):** `faltas_documento` em todos os caminhos e para todos os tipos.
  - No `emitir_documento`, recusa como o rascunho já faz.
  - Na sincronização offline, o item volta como "recusado", com o motivo. É o mesmo comportamento que a fila do aparelho já tem para outros erros.
- **B:** só o laudo de AIH na sincronização.

**D4. Prova do "sem conexão".**
- **A (recomendada):** o servidor confere a declaração com a última renovação da sessão da pessoa (`auth.sessions`), sinal que o painel de uso já usa.
  - Se a sessão foi renovada depois do "último contato" declarado (com 5 minutos de folga), a pessoa estava conectada, e o registro atrasado vai para a revisão do gestor em vez de entrar direto.
  - Nada é recusado: o registro só deixa de pular a revisão.
  - O momento do registro também passa a exigir vínculo ativo com a unidade.
- **B:** um sinal novo de "estou conectado", gravado pelo aparelho a cada minuto. É mais preciso e mais trabalhoso.

**D5. Ordem.**
- **A (recomendada):** um PR com as migrations (expand, sem retirar nada) e as telas. Conferido na homologação com os testes de banco, e a produção só com o seu ok.
- **B:** um PR por item.

**Decisão do RT, 15/11/2026:** D1 a D5 = A ("Todas A"). Conferido no código antes da migration: nenhuma tela emite os quatro tipos de fluxo próprio pelo caminho genérico; a tela do termo não usa rascunho no servidor, e o servidor já recusava copiar termo (o "Copiar" do termo saiu também da tela).

## Riscos

- **Folhas impressas:** o escape dentro de `cabecalho()` pode escapar duas vezes onde a chamada já escapava (por exemplo, "&amp;" na tela). O caminho é conferir todas as chamadas e tirar o escape delas, comparando as folhas antes e depois na homologação.
- **Emissão:** pode haver tela que ainda usa o caminho genérico para um tipo de fluxo próprio. Isso é conferido no código antes da migration.
- **Offline:** com a D4 A, mais registros tardios vão para a revisão do gestor. Isso aumenta o trabalho da revisão, mas nenhum registro se perde.
- **Rollback:** as definições anteriores das funções, escritas na migration; as telas voltam pela versão anterior.

## Critérios de aceite

1. Um título de modelo com `<b>` ou `<style>` aparece como texto na folha impressa, nas duas cópias. Erro com HTML aparece como texto.
2. Toda janela de impressão e a do anexo abrem com `opener` nulo.
3. `emitir_documento`, o rascunho e a sincronização recusam os quatro tipos de fluxo próprio.
4. `faltas_documento` bloqueia no `emitir_documento` (todos os tipos) e na sincronização.
5. Um registro offline com "último contato" anterior a uma renovação da sessão vai para revisão. O registro sem vínculo ativo é recusado.
6. Testes de banco no CI cobrindo 3 a 5, e teste do escape das folhas no frontend.

## Depois

Com as decisões, abro a tarefa e começo pela homologação.
