// Short display labels for leagues (client-safe, pure data). The league icon is
// its country flag — see leagueFlagUrl in ./flags.

export const LEAGUE_LABEL: Record<string, string> = {
  "DEN-Superliga": "Superliga",
  "NOR-Eliteserien": "Eliteserien",
  "SWE-Allsvenskan": "Allsvenskan",
  "NED-Eredivisie": "Eredivisie",
  "POR-PrimeiraLiga": "Primeira Liga",
  "ENG-Championship": "Championship",
  "GER-2Bundesliga": "2. Bundesliga",
  "BEL-ProLeague": "Pro League",
  "AUT-Bundesliga": "Bundesliga (AUT)",
  "SUI-SuperLeague": "Super League",
  "SCO-Premiership": "Premiership",
  "POL-Ekstraklasa": "Ekstraklasa",
  "CRO-HNL": "HNL",
  "CZE-FirstLeague": "1. liga (CZE)",
  "FIN-Veikkausliiga": "Veikkausliiga",
  "ISL-Bestadeild": "Besta deild",
};

export const leagueLabel = (k: string) => LEAGUE_LABEL[k] ?? k;
