// Service worker: owns the right-click menu. The popup (popup.js) is the main
// surface; this exists so a highlighted paragraph can become a Terrafeed topic
// filter without opening anything.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'terrafeed-scan-page',
    title: 'Terrafeed: copy topic filter for this page',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'terrafeed-scan-selection',
    title: 'Terrafeed: copy topic filter for "%s"',
    contexts: ['selection'],
  });
});

/**
 * Runs inside the tab. places.js and detect.js are injected first, so
 * self.TerrafeedDetect already exists when this runs. Clipboard access needs
 * page context and a user gesture — a context-menu click satisfies both, a
 * background call from the service worker alone would not.
 */
function classifyAndCopy(selectionText) {
  const extract = () => {
    if (selectionText) return selectionText;
    const parts = [document.title];
    const meta = document.querySelector(
      'meta[name="description"], meta[property="og:description"]',
    );
    if (meta) parts.push(meta.content || '');
    for (const h of [...document.querySelectorAll('h1, h2')].slice(0, 6)) {
      parts.push(h.textContent || '');
    }
    for (const p of [...document.querySelectorAll('article p, main p, p')].slice(0, 40)) {
      parts.push(p.textContent || '');
    }
    return parts.join(' \n ');
  };

  const text = extract().replace(/\s+/g, ' ').trim().slice(0, 6000);
  const countries = self.TerrafeedDetect.detectCountries(text).map((c) => c.label);
  const topics = self.TerrafeedDetect.detectTopics(text).map((t) => t.label);
  const filter = [...new Set([...countries, ...topics])].join(', ');

  if (!filter) return { ok: false, reason: 'Nothing recognisable on this page.' };

  navigator.clipboard.writeText(filter);
  return { ok: true, filter, countries: countries.length, topics: topics.length };
}

async function runAndNotify(tabId, selectionText) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['places.js', 'detect.js'] });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: classifyAndCopy,
    args: [selectionText || ''],
  });

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: result?.ok ? 'Terrafeed topic filter copied' : 'Terrafeed Companion',
    message: result?.ok
      ? `${result.filter}`.slice(0, 180)
      : result?.reason || 'Could not read this page.',
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'terrafeed-scan-page') {
    void runAndNotify(tab.id, '');
  } else if (info.menuItemId === 'terrafeed-scan-selection') {
    void runAndNotify(tab.id, info.selectionText || '');
  }
});
