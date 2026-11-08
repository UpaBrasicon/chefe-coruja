// Leitos de cada unidade da chave, com a situação de agora.
let
    PorUnidade = List.Transform(Unidades[id], (u) => CorujaLista("leitos", [unidade_id = u, limite = "100"])),
    Tabela = Table.FromRecords(List.Combine(PorUnidade),
        {"id", "unidade_id", "setor", "identificador", "tipo", "status", "paciente_id", "ocupado_desde"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"id", type text}, {"unidade_id", type text}, {"setor", type text}, {"identificador", type text},
        {"tipo", type text}, {"status", type text}, {"paciente_id", type text}, {"ocupado_desde", type datetimezone}})
in
    Tipos
