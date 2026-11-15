# Trilha de segurança, S1: vínculos e perfis entre organizações — diagnóstico

**Pedido.** Em 15/11/2026, depois do S3, o RT escolheu o S1 ("S1 vínculos"). A origem é a auditoria Cloudflare, passadas 1 e 3: `docs/seguranca/auditoria-cloudflare-2026-11-15/`.

**Escopo.** Só diagnóstico. As políticas foram lidas na homologação, só a estrutura, e as telas no código.

## Como está hoje

### Vínculos: o admin da organização escreve direto na tabela

As políticas de `vinculos` (`20260815000003_fase1_rls.sql:137-175`, iguais na homologação) dizem:
- **`vinculos_insert`:** o admin da organização da unidade pode inserir um vínculo para qualquer `perfil_id`, menos o próprio, com qualquer papel.
- **`vinculos_update`:** a mesma regra, para reativar ou mudar o papel.

A tela que usa isso é **Pessoas**, do admin (`src/pages/Pessoas.tsx` e `criarOuReativarVinculo` em `src/lib/api.ts:24-56`). O botão "Novo vínculo" deixa escolher:
- qualquer pessoa da lista;
- qualquer unidade da organização;
- qualquer papel.

A gravação é um `upsert` direto em `vinculos`.

### A lista de pessoas inclui gente de fora da organização

O ramo (b) da política `perfis_select` (`20260823000002_auditoria_partes_ab.sql:79-100`) deixa qualquer admin de qualquer organização ler todo perfil sem vínculo ativo, da plataforma inteira. A leitura traz todas as colunas: nome, e-mail, CPF, nascimento e registro profissional. A tela Pessoas usa esse ramo para mostrar quem está "sem vínculo".

### O que isso permite

1. **Ler dados pessoais de outras redes.** Um admin da rede A lê CPF e contatos de qualquer profissional da rede B que esteja sem vínculo ativo, por exemplo quem saiu da unidade ou espera adesão.
2. **Vincular sem consentimento e sem as regras do convite.**
   - O admin da rede A vincula, sem a pessoa pedir, alguém da rede B a uma unidade dele.
   - Com isso, passa a ler o perfil dela pelo ramo (a), que continua valendo mesmo depois de desativar o vínculo.
   - Esse vínculo direto ignora as regras do convite (`gerar_convite`, `20261116000002_papeis_rede.sql:121-133`): gestor e admin só entram pelo contrato, e papel de rede só pelo super admin.
   - O admin também pode dar um papel clínico a uma conta que ele controla, o que contraria a regra "admin não lê dado de paciente".
3. **Zerar o 2FA de outra rede.** Com esse vínculo, o admin passa na checagem de `zerar_segundo_fator` (`20261023000001_segundo_fator_servidor.sql:284-327`), apaga os fatores da pessoa e derruba todas as sessões dela. É o achado da passada 1.

O caminho certo para gente nova já existe: o convite (gerado pelo gestor, com código, validade e as regras de papel) e o contrato (admin e gestor da rede).

## Decisões para o RT

**V1. Escrita de vínculo.**
- **A (recomendada):**
  - tirar o INSERT e o UPDATE diretos de `vinculos` para quem não é super admin;
  - a tela Pessoas passa a usar duas RPCs:
    - `revogar_vinculo`: desativa um vínculo da própria organização;
    - `reativar_vinculo`: reativa um vínculo que já existiu, com o mesmo papel;
  - as duas exigem o 2FA e registram auditoria;
  - pessoa nova ou papel novo só entram pelo convite (gestor) ou pelo contrato (admin e gestor).
- **B:** manter o INSERT direto, com um gatilho que aplica as regras do convite e só aceita quem já teve vínculo na organização.

**V2. "Novo vínculo" na tela Pessoas.**
- **A (recomendada):** o botão vira "Gerar convite" e leva para a tela de convites da unidade. A tela Pessoas lista só quem tem ou teve vínculo nas unidades da organização.
- **B:** manter o botão, mas listar só quem já teve vínculo na organização (com a V1 B).

**V3. Leitura de perfis sem vínculo.**
- **A (recomendada):** o ramo (b) de `perfis_select` passa a valer só para quem tem adesão pendente a um contrato da própria organização. É a pessoa que o admin precisa ver para concluir a entrada.
- **B:** tirar o ramo (b) inteiro.

**V4. Leitura de perfil depois de desativar o vínculo.**
- **A (recomendada):** manter. O ramo (a) mostra quem já passou pela organização: é o histórico da equipe, e os registros clínicos dessas pessoas continuam lá. Com a V1 A, ninguém de fora entra nesse ramo sem convite ou contrato.
- **B:** só vínculo ativo, e o histórico de quem saiu vem por RPC.

**V5. Vínculos que já existem.**
- **A (recomendada):** uma leitura só de estrutura na produção, com a sua autorização e sem dado de paciente. Conta os vínculos criados por admin (não por convite nem por contrato) para pessoas que também têm vínculo em outra organização. O resultado vem para você, e nada é desfeito automaticamente.
- **B:** não olhar o passado.

**V6. `zerar_segundo_fator`.**
- **A (recomendada):** nenhuma mudança na função. Com a V1, o único caminho que a contornava, o vínculo sem consentimento, deixa de existir.
- **B:** exigir também que o vínculo da pessoa na unidade de quem zera tenha vindo de convite ou contrato.

## Riscos

- **Tela Pessoas e Plataformas:** mudam de comportamento. Conferir na homologação com o admin da rede de demonstração.
- **Fluxo de contrato:** o admin precisa continuar vendo quem aderiu e concluindo o vínculo. A V3 A preserva isso. Conferir a tela que conclui a adesão.
- **Super admin:** continua com escrita direta.
- **Migration:** expand e contract em duas etapas. Primeiro as RPCs novas e a tela usando elas; depois a retirada das políticas de escrita, com rollback escrito (as políticas antigas).

## Critérios de aceite

1. Um admin da rede A não lê o perfil de alguém da rede B sem vínculo nem adesão à rede A.
2. Um admin não cria vínculo novo nem muda papel direto na tabela. Só revoga e reativa vínculos da própria organização, pelas RPCs.
3. `zerar_segundo_fator` continua funcionando para o gestor da unidade da pessoa e falha para quem não tem vínculo legítimo com ela.
4. Teste de banco no CI cobrindo 1 a 3.

## Depois

Com as decisões, abro a tarefa e começo pela migration na homologação.
