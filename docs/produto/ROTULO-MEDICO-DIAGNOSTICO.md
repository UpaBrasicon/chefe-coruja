# "Médico" no lugar de "Plantonista" na tela — diagnóstico

**Pedido do RT, 16/11/2026:** "no lugar de plantonista coloque como médico". O RT confirmou o escopo: **só o nome na tela**. O papel no banco continua `plantonista`, então as permissões, a escala e os testes não mudam.

**Escopo.** Só diagnóstico, lido no código. Nada mudou.

## Onde o nome aparece

1. **Rótulo do papel** (`src/lib/constants.ts`, `PAPEL_LABEL.plantonista = 'Plantonista'`). Uma linha, que aparece em:
   - "Trocar perfil";
   - o menu do usuário;
   - Pessoas;
   - Convites;
   - os selos de papel;
   - os filtros do gestor.
2. **Textos fixos das telas.** "Plantonista" aparece em 25 arquivos de `src/`. Os que mais concentram são:
   - `Escala.tsx` (25 vezes);
   - `AppShell.tsx` (8);
   - `useFontesDoBanco.ts` (7);
   - `UnidadeContext.tsx` (4).
   - Inclui o nome da área **"Central do Plantonista"** (11 vezes).
3. **Mensagens do servidor.** São 19 mensagens de erro nas funções do banco com a palavra "plantonista".
   - Na **escala**, a palavra quase sempre quer dizer "quem está de plantão", de qualquer categoria. Por exemplo: "Conflito de horário: o plantonista de destino já tem plantão…".
   - Fora da escala, quer dizer o médico. Por exemplo: "apenas o plantonista escalado ou o gestor podem fracionar".
4. **Já está certo:** contenção, intercorrência e folhas já escrevem "médico", e a implantação escreve "Médico plantonista".
5. **Não aparece como texto:** a rota `/plantonista`, os nomes de arquivos e de funções, o tipo `papel` do banco.

O site público (`landing/`) não tem a palavra.

## Decisões para o RT

**R1. Rótulo do papel.**
- **A (recomendada):** "Plantonista" passa a "Médico" no `PAPEL_LABEL`. Uma linha, e vale em todas as telas que mostram o papel.
- **B:** "Médico plantonista".

**R2. "Central do Plantonista".**
- **A (recomendada):** passa a "Central do Médico".
- **B:** manter o nome atual da área.

**R3. Textos fixos das telas.**
- **A (recomendada):** trocar por "médico" onde a frase fala do papel médico. Onde fala de quem está de plantão, de qualquer categoria (comum na Escala), usar "profissional" ou "quem está de plantão". "Plantão", o turno, fica.
- **B:** só R1 e R2.

**R4. Mensagens do servidor.**
- **A (recomendada):** a mesma regra do R3 nas 19 mensagens, numa migration que só troca o texto (`CREATE OR REPLACE` das funções), com teste das mensagens que os testes antigos conferem.
- **B:** deixar as mensagens do servidor como estão.

**R5. Rota e nomes internos.**
- **A (recomendada):** manter `/plantonista` e os nomes no código. A tela não mostra, e mudar a rota quebra favoritos e atalhos.

## Riscos

- **Testes de tela e de banco** que conferem o texto exato ("Plantonista") precisam ser ajustados. O CI aponta cada um.
- **Telas do vídeo e do pitch** mostram "Plantonista" e ficam diferentes do app até a próxima gravação.
- **Rollback:** voltar o PR (frontend) e a migration das mensagens, que tem a volta escrita.

## Critérios de aceite

1. Nenhuma tela mostra "Plantonista" como nome do papel (conferido por busca no código e na homologação).
2. A escala mostra "profissional" onde a frase vale para qualquer categoria.
3. CI verde.
