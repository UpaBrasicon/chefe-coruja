# E3: conferência da ingestão dos livros

Trilha Hermes / Evidências, tarefa 3. A decisão do RT, de 12/11/2026, foi E3 = A: conferir no VPS a contagem de trechos de cada livro, registrar a evidência e corrigir o README (`docs/hermes/HERMES-EVIDENCIAS-DIAGNOSTICO.md`).

Conferido em 13/11/2026, só por leitura do Qdrant no VPS (`127.0.0.1:6333`). Nada foi ingerido nem apagado.

## Coleções

| Coleção | Trechos | Fontes distintas | Estado |
|---|---|---|---|
| `biblioteca` (produção) | 8.052 | 240 | green |
| `biblioteca_homolog` | 8.052 | mesma contagem por fonte | green |

O identificador da fonte é o sha1 do nome do arquivo, cortado em 12 caracteres (`ingest.py`, `fonte_id_de`).

## Livros e documentos em PDF (`fontes.yaml`)

| Arquivo | fonte_id | Trechos | Público | Licença |
|---|---|---|---|---|
| `ps_pediatria_icr_4ed_2023.pdf` | `bbcc85917c68` | 1.786 | pediátrico | sem licença |
| `manual_hcfmusp_3ed_2022.pdf` | `932b8dcf9062` | 1.467 | adulto | sem licença |
| `ms_gvs_vol2_2024.pdf` | `137eebefe268` | 791 | ambos | acesso aberto (governo) |
| `ms_gvs_vol1_2024.pdf` | `8f0833aa27ad` | 629 | ambos | acesso aberto (governo) |
| `ms_gvs_vol3_2024.pdf` | `567251fa3e11` | 314 | ambos | acesso aberto (governo) |
| `ms_chikungunya_2024.pdf` | `cc7041f1d031` | 93 | ambos | acesso aberto (governo) |
| `ms_dengue_2024.pdf` | `5bd256a4d3a5` | 78 | ambos | acesso aberto (governo) |

As outras 233 fontes são as fichas do corpus da Central, as referências e os artigos abertos, com de 2 a 204 trechos cada.

## Cobertura dos dois livros

| Livro | Trechos | Páginas com trecho | Faixa | Seções distintas | Trechos sem seção | tenant |
|---|---|---|---|---|---|---|
| ICr 2023 | 1.786 | 875 | 4 a 923 | 725 | 0 | global |
| HCFMUSP 2022 | 1.467 | 1.443 | 4 a 1.513 | 116 | **1.351 (92%)** | global |

**Os dois livros estão ingeridos e cobrem o livro inteiro.** A reingestão não duplica, porque os identificadores dos trechos são fixos e a fonte é apagada antes de ser regravada. Isso atende ao critério de aceite da tarefa 3.

## Achado: o HCFMUSP está quase todo sem seção

No HCFMUSP, 92% dos trechos chegam ao modelo como "sem seção". O ICr foi reingerido depois da correção da seção herdada (R2-14, 15/10/2026); o HCFMUSP, pelo jeito, não.

A regra 5 da resposta (`main.py`, `SYSTEM`) manda o modelo usar só o trecho cuja seção trata da condição perguntada. Sem a seção, o modelo perde essa trava no livro de adulto. É o mesmo tipo de erro que o R2-14 corrigiu no ICr (a insulina do estado hiperosmolar tomada como da cetoacidose).

Testei o leitor atual em 60 páginas do HCFMUSP (200 a 259), dentro do container da homologação e sem gravar nada: 48 de 59 trechos ganharam seção. Mas a seção que ele acha é só o número do capítulo ("14", "15", "16"), porque nesse PDF o número do capítulo vem numa linha separada do título. **Reingerir com o código de hoje não resolve.** Primeiro é preciso ajustar o leitor ao formato do HCFMUSP. Depois vem a reingestão na homologação (perto de 1 hora), as evals e, com o "ok produção", a reingestão na produção.

Isso não estava nas decisões E1 a E7. Fica como proposta para o RT (E3b).

## Correções de texto

- `biblioteca/README.md` e o cabeçalho de `biblioteca/fontes.yaml` diziam que a entrada dos livros e a ingestão "ficaram para o usuário". Os dois livros estão registrados e ingeridos. O texto passou a dizer isso, e o modelo da entrada ficou só como referência.
