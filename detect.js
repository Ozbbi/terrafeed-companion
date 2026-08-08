// Place and topic detection, shared by the content script and the popup's
// fallback path. No build step: relies on the globals from places.js, loaded
// as a preceding classic script.

(function () {
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function buildMatchers() {
    const terms = [];
    for (const place of self.TF_PLACES) {
      terms.push({ re: wordRe(place.name), text: place.name, iso3: place.iso3, label: place.name, weight: 2 });
      for (const alias of place.aliases || []) {
        terms.push({ re: wordRe(alias), text: alias, iso3: place.iso3, label: alias, weight: 3 });
      }
    }
    for (const [iso3, aliases] of Object.entries(self.TF_COUNTRY_ALIASES)) {
      for (const alias of aliases) {
        terms.push({ re: wordRe(alias), text: alias, iso3, label: alias, weight: 1 });
      }
    }
    // Bare country names ("Germany raises rates") — the ones excluded here
    // (Turkey, Chad, Georgia…) collide with common English words and are
    // deliberately left to resolve only via a city or demonym instead.
    for (const country of self.TF_COUNTRY_NAMES) {
      terms.push({ re: wordRe(country.name), text: country.name, iso3: country.iso3, label: country.name, weight: 1 });
    }
    // Longest pattern first, so "South Korea" outranks "Korea".
    terms.sort((a, b) => b.re.source.length - a.re.source.length);
    return terms;
  }

  function wordRe(text) {
    return new RegExp(`(^|[^\\p{L}])(${escapeRe(text)})([^\\p{L}]|$)`, 'iu');
  }

  const MATCHERS = buildMatchers();

  /**
   * Countries mentioned in the text, ranked by how strongly they matched.
   *
   * Matchers run longest-first and each claims the characters it consumed, so a
   * country name sitting inside a longer one cannot also fire: "South Sudan"
   * must not additionally report Sudan, and "Papua New Guinea" must not report
   * Guinea.
   */
  function detectCountries(text, max = 6) {
    const claimed = [];
    const hits = new Map(); // iso3 -> { count, label }

    for (const term of MATCHERS) {
      const found = term.re.exec(text);
      if (!found) continue;

      // Group 1 is the leading boundary character; the literal follows it.
      const start = found.index + found[1].length;
      const end = start + term.text.length;
      if (claimed.some(([from, to]) => start < to && end > from)) continue;
      claimed.push([start, end]);

      const entry = hits.get(term.iso3) || { count: 0, label: term.label };
      entry.count += term.weight;
      hits.set(term.iso3, entry);
    }

    return [...hits.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, max)
      .map(([iso3, v]) => ({ iso3, label: v.label }));
  }

  // Same escalation vocabulary Terrafeed's own feed adapters score on, kept in
  // sync by hand — it is nine lines, not worth a build step to share.
  const TOPIC_KEYWORDS = [
    { id: 'conflict', label: 'Conflict & strikes', re: /\b(airstrike|air strike|drone strike|missile|shelling|offensive|invasion|coup|bombard)\w*/i, weight: 0.9 },
    { id: 'casualties', label: 'Casualties', re: /\b(kill|dead|casualt|fatalit)\w*/i, weight: 0.8 },
    { id: 'emergency', label: 'Emergency measures', re: /\b(evacuat|state of emergency|martial law|curfew)\w*/i, weight: 0.7 },
    { id: 'sanctions', label: 'Sanctions & trade', re: /\b(sanction|embargo|blockade|export ban|tariff)\w*/i, weight: 0.65 },
    { id: 'diplomacy', label: 'Diplomacy', re: /\b(ceasefire|truce|peace deal|summit|treaty)\w*/i, weight: 0.55 },
    { id: 'unrest', label: 'Protest & unrest', re: /\b(protest|riot|unrest|strike action|clash)\w*/i, weight: 0.5 },
    { id: 'cyber', label: 'Cyber & outages', re: /\b(outage|blackout|cyberattack|ransomware|breach)\w*/i, weight: 0.5 },
    { id: 'economy', label: 'Economy', re: /\b(inflation|default|devaluation|recession|central bank)\w*/i, weight: 0.45 },
    { id: 'disaster', label: 'Natural hazard', re: /\b(earthquake|flood|wildfire|cyclone|hurricane|eruption)\w*/i, weight: 0.6 },
    { id: 'politics', label: 'Politics', re: /\b(election|referendum|resign|impeach)\w*/i, weight: 0.35 },
  ];

  function detectTopics(text) {
    const found = [];
    for (const topic of TOPIC_KEYWORDS) {
      if (topic.re.test(text)) found.push(topic);
    }
    return found.sort((a, b) => b.weight - a.weight);
  }

  function severity(topics) {
    return topics.length ? Math.max(...topics.map((t) => t.weight)) : 0.2;
  }

  self.TerrafeedDetect = { detectCountries, detectTopics, severity };
})();
