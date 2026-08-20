# Validador local de perfis FHIR R4 do Ministério da Saúde (RNDS)

> Aplicação Java distribuída na página da RNDS no Portal de Serviços do DATASUS.
> Usada por `npm run fhir:validar` para validar os Bundles gerados na Fase 4A
> (sem nenhum envio — validação 100% local).

## Como obter o validador

1. Acesse o **Portal de Serviços do DATASUS** → RNDS → seção de documentos/
   downloads da integração.
   - URL de referência (sujeita a mudança): https://servicos-datasus.saude.gov.br/
   - Procure por "Validador de perfis FHIR" / "validador RNDS" / "ferramenta de
     validação de mensagens FHIR".
2. Baixe a **aplicação Java** (JAR) e coloque em:

   ```
   tools/rnds/validador-rnds.jar
   ```

3. Pré-requisito: **Java 17+** (`java -version`).

> ⚠️ O artefato oficial ainda não está no repositório (`tools/rnds/` vazio).
> Assim que o arquivo do Portal de Serviços for baixado, documente aqui o nome
> exato e a versão.

## Como usar

```bash
# valida todos os Bundles gerados (snapshots + saída do processador)
npm run fhir:validar

# valida um arquivo específico
node scripts/interop/validar-fhir.mjs --arquivo scripts/interop/__snapshots__/rac-alta-para-casa.json
```

O script executa o JAR com o Bundle como entrada e reporta o retorno
(pass/fail + mensagens do validador).

## Bundles gerados (Fase 4A)

- `scripts/interop/__snapshots__/rac-alta-para-casa.json`
- `scripts/interop/__snapshots__/rac-com-internacao.json`
- `scripts/interop/__snapshots__/rac-com-evasao.json`
- `scripts/interop/__snapshots__/sumario-alta-para-casa.json`

## Status atual

- [ ] Validador baixado para `tools/rnds/validador-rnds.jar`
- [ ] Execução local confirmada
- [ ] Bundles passando na validação (critério de aceite da Fase 4A)
