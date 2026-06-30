// Map FBref's 3-letter nation codes (FIFA/IOC-ish) to ISO-2 for flagcdn.
// Unmapped codes fall back to showing the 3-letter code (no flag).

const ISO2: Record<string, string> = {
  ALG: "dz", AUS: "au", AUT: "at", BEL: "be", BFA: "bf", BIH: "ba", BRA: "br",
  BUL: "bg", CHI: "cl", CMR: "cm", COL: "co", CRC: "cr", CRO: "hr", CZE: "cz",
  DEN: "dk", ECU: "ec", EGY: "eg", ENG: "gb-eng", EQG: "gq", FIN: "fi",
  FRA: "fr", FRO: "fo", GAM: "gm", GEO: "ge", GER: "de", GHA: "gh", GNB: "gw",
  GRE: "gr", GUI: "gn", IRQ: "iq", ISL: "is", JAM: "jm", JPN: "jp", KEN: "ke",
  KOR: "kr", KVX: "xk", MAD: "mg", MAR: "ma", MEX: "mx", MKD: "mk", NED: "nl",
  NGA: "ng", NOR: "no", NZL: "nz", PER: "pe", POL: "pl", POR: "pt", ROU: "ro",
  RSA: "za", RUS: "ru", SEN: "sn", SUI: "ch", SUR: "sr", SVN: "si", SWE: "se",
  TOG: "tg", TUN: "tn", UGA: "ug", USA: "us", ZAM: "zm", ZIM: "zw",
  // a few common extras
  ARG: "ar", ESP: "es", ITA: "it", SCO: "gb-sct", WAL: "gb-wls", NIR: "gb-nir",
  IRL: "ie", TUR: "tr", UKR: "ua", SRB: "rs", SVK: "sk", HUN: "hu", CAN: "ca",
};

export function flagUrl(nation: string | null): string | null {
  if (!nation) return null;
  const iso = ISO2[nation.toUpperCase()];
  return iso ? `https://flagcdn.com/h20/${iso}.png` : null;
}
