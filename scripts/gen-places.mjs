import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('C:/Users/Pc/Desktop/terrafeed/src/data/gazetteer.ts', 'utf8');

// Pull { name: '...', iso3: '...', ..., aliases: [...] } entries out of PLACES.
const placeBlock = src.slice(src.indexOf('export const PLACES'), src.indexOf('export const STOP_TERMS'));
const placeRe = /\{\s*name:\s*'([^']+)',\s*iso3:\s*'([^']+)'[^}]*?(?:aliases:\s*\[([^\]]*)\])?\s*\}/g;
const places = [];
let m;
while ((m = placeRe.exec(placeBlock))) {
  const aliases = m[3]
    ? [...m[3].matchAll(/'([^']+)'/g)].map((a) => a[1])
    : [];
  places.push({ name: m[1], iso3: m[2], aliases });
}

// Pull COUNTRY_ALIASES map.
const aliasBlock = src.slice(src.indexOf('export const COUNTRY_ALIASES'));
const aliasRe = /^\s*([A-Z]{3}):\s*\[([^\]]*)\]/gm;
const countryAliases = {};
while ((m = aliasRe.exec(aliasBlock))) {
  countryAliases[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((a) => a[1]);
}

// Pull STOP_TERMS — bare country names ambiguous with common English words
// ("Turkey" the bird, "Chad" the name, "Georgia" the US state) that the full
// app excludes from plain-name matching. Same exclusion applies here.
const stopBlock = src.slice(src.indexOf('export const STOP_TERMS'), src.indexOf('export const COUNTRY_ALIASES'));
const stopTerms = new Set([...stopBlock.matchAll(/'([^']+)'/g)].map((a) => a[1]));

// Full country names + iso3, from the bundled Natural Earth extract — this is
// what lets a headline that names a country but no city ("Germany raises
// rates") still resolve.
const geo = JSON.parse(readFileSync('C:/Users/Pc/Desktop/terrafeed/public/data/countries.geojson', 'utf8'));
// Both the short and long forms. Natural Earth abbreviates several short names
// ("S. Sudan", "Dem. Rep. Congo") in a way no headline ever writes, so without
// the long form "South Sudan" falls through and matches Sudan instead.
const countryNames = geo.features
  .flatMap((f) => {
    const { name, nameLong, iso3 } = f.properties;
    return [...new Set([name, nameLong])].map((value) => ({ name: value, iso3 }));
  })
  .filter((c) => c.name && c.iso3 && c.name.length >= 4 && !stopTerms.has(c.name.toLowerCase()));

const out = `// Condensed, standalone copy of Terrafeed's place index — no build step,
// no dependency on the desktop app. Regenerate from the source of truth with
// scripts/gen-places.mjs (kept alongside this file).
// Plain globals, not ES module exports, so this loads as a classic script in
// both the content script and the popup without a bundler.
self.TF_PLACES = ${JSON.stringify(places)};
self.TF_COUNTRY_ALIASES = ${JSON.stringify(countryAliases)};
self.TF_COUNTRY_NAMES = ${JSON.stringify(countryNames)};
`;

writeFileSync('C:/Users/Pc/Desktop/terrafeed-companion/places.js', out);
console.log(
  'places:', places.length,
  'countryAlias entries:', Object.keys(countryAliases).length,
  'country names:', countryNames.length,
  'stop terms:', stopTerms.size,
);
