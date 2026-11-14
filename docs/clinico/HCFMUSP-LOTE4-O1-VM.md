# Revisão do HCFMUSP, lote 4, O1: cap. 37, ventilação mecânica

O RT decidiu O1 a O4 = A em 14/11/2026 ("Pode seguir"). O diagnóstico está em `HCFMUSP-LOTE4-DIAGNOSTICO.md`.

## O que foi feito

- **Nota `nota-hcfmusp-cap37-vm`:** 13 itens, tirados do que a ficha da SDRA já tinha, conferido nos lotes anteriores:
  - `DIRETRIZ_SDRA_2024`, 10 temas da ATS 2024 e da ESICM 2023, lidas no texto integral, e da definição global de 2024;
  - a nota da SCCM 2026 sobre bloqueio neuromuscular;
  - a nota da AARC 2024 sobre o teste de respiração espontânea;
  - a nota da ATS 2026 sobre o pós-extubação.
- Nenhuma ficha, dose ou parâmetro muda.
- O lote 4 começa aqui (`NOTAS_HCFMUSP_LOTE4`).
- **Migration** `20270414000014`.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| corticoide na SDRA | "não encontrei" | ATS 2024: sugere corticoide (condicional) |
| bloqueio neuromuscular | SCCM 2026 (nota da ficha) | igual |
| manobra de recrutamento | manual: condicional, sem protocolo | ATS/ESICM: contra a manobra prolongada; contra a breve de rotina |
| PEEP alta ou baixa | "não traz comparação" | ATS 2024: PEEP mais alta, sem recrutamento |
| CNAF depois da extubação | ATS 2026 (nota da ficha) | igual |
| IRRS no TRE | AARC 2024 (nota da ficha) | igual |

As seis respostas abrem pela diretriz. Três mudaram; as outras três já abriam pela nota da ficha.

## Homologação

- Migration aplicada.
- `nota-hcfmusp-cap37-vm.md` (14 trechos) ingerido. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.237, sem falha) e typecheck limpos.
- A nota não tem tela própria. A tela da SDRA não mudou.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000014`.
2. Copiar e ingerir `nota-hcfmusp-cap37-vm.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.

## Produção (14/11/2026, com o "ok produção" do RT)

- A migration `20270414000014` foi aplicada antes do merge. O #684 foi mesclado com o CI verde.
- A nota foi gerada do master e ingerida. A API foi reiniciada.
- Refiz as perguntas na produção: as seis abrem pela diretriz, como na homologação.
