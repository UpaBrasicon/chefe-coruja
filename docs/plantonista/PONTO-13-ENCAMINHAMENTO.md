# Ponto 13 — Encaminhamento para outra unidade, dentro do leito

Plano e registro da tarefa, no formato do "Plano de Trabalho — comando por
tarefa" do `BACKLOG.md`. O diagnóstico está em
`REVISAO-PLANTONISTA-2026-10.md`, no ponto 13.

**Decisão do RT (31/10/2026):** o destino é escolhido da lista de unidades da
rede. Se a unidade não estiver na lista, digita-se o nome. A decisão chegou
pela sessão principal.

**Estado:** a tela está no PR do branch
`fase-plantonista/encaminhamento-outra-unidade`, publicado na homologação.
Não há banco, então o merge publica direto.

## 1. Diagnóstico

- A aba Encaminhamento do leito só encaminhava dentro da unidade
  (`encaminhar_interno`).
- O formulário para fora (folha SMS003a) só existia na porta. O destino era
  texto livre, e o leito não levava a esse formulário.
- **A ligação com a internação já existia no banco:** `salvar_rascunho` grava
  no documento a internação aberta do paciente. Por isso o ponto não precisa
  de migration.

## 2. O que muda (só tela)

- **Formulário SMS003a numa peça comum:** o arquivo saiu de `pages` para
  `src/components/encaminhamento/EncaminhamentoSms003a.tsx`. A página da porta
  agora só reexporta o formulário.
- **O formulário ganhou `pacienteFixo` e `leito`:**
  - dentro do leito, o paciente não troca;
  - um aviso lembra que transferir o internado para outra unidade é
    regulação, com o botão "Abrir regulação".
- **Destino:**
  - a lista vem das unidades da rede, as mesmas da regulação
    (`regulacao_contexto`), sem a própria unidade;
  - se a unidade não estiver na lista, digita-se o nome, e a tela pede para
    conferir, sem impedir a emissão;
  - o conteúdo grava `destinoNaRede`;
  - a regra vale para a porta e para o leito.
- **Aba Encaminhamento do leito** (`AbaEncaminhamento.tsx`): duas sub-abas,
  "Dentro da unidade" (a de antes) e "Para outra unidade".

## 3. Banco, permissões e auditoria

Nada muda. A emissão segue pelo rascunho do banco (`salvar_rascunho` e
`emitir_rascunho`): o mesmo acesso e o autor pelo login.

## 4. Testes e aceite

| Critério | Evidência |
|---|---|
| "Para outra unidade" no leito, com o paciente fixo | O RT confere na homologação |
| Destino pela lista da rede ou digitado | O RT confere na homologação |
| Documento ligado à internação | `salvar_rascunho` grava a internação aberta (já existia) |
| O aviso de regulação aparece no leito | O RT confere na homologação |

Checagens: `tsc -b`, eslint, `padrao-frontend --ci`, os testes de `src/lib` e
o `test:clinico`.
