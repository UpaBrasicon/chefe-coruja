// Chama o motor do validador local oficial da RNDS sem a janela.
//
// O aplicativo do DATASUS (SOA-RNDS_ValidadorLocal_Aplicativo.zip) só abre uma
// tela (ui.FhirValidacaoWindow), e o main de linha de comando dele tem caminhos
// fixos da máquina de quem o fez. O motor é público:
// fhir.val.ExecutarValidacao.executar(definicoes, json, saida, detalhar, tela, resumir).
// Esta classe só o chama, um arquivo por vez, e devolve 1 se algum falhar.
//
// Roda dentro do contêiner sem rede montado por scripts/interop/validar-fhir.ts
// (docs/rnds/VALIDADOR.md).

import fhir.val.ExecutarValidacao;

public class ValidarRnds {
  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      System.err.println("uso: ValidarRnds <pasta das definicoes> <bundle.json>...");
      System.exit(2);
    }
    int falhas = 0;
    for (int i = 1; i < args.length; i++) {
      // saída em arquivo desligada (""), sem tela (null), com o detalhe de cada mensagem
      String resultado = ExecutarValidacao.executar(args[0], args[i], "", true, null, false);
      System.out.println("=== " + args[i]);
      System.out.println(resultado);
      if (resultado.contains("COM FALHAS")) falhas++;
    }
    System.exit(falhas == 0 ? 0 : 1);
  }
}
