// Hora da última atualização, para mostrar no painel (o painel não é ao vivo).
let
    Tabela = #table(type table [atualizado_em = datetimezone], {{DateTimeZone.FixedLocalNow()}})
in
    Tabela
