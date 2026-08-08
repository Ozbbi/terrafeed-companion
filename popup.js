// Runs in the extension popup. Extraction happens inside the page (via
// chrome.scripting.executeScript, one user-gesture call, nothing persistent);
// everything after that — matching against places.js / detect.js — runs here,
// in the extension's own context, not the page's.

/** Injected into the tab. Must be self-contained: no outer-scope references. */
function extractPageText() {
  const parts = [document.title];

  const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
  if (meta) parts.push(meta.content || '');

  const headings = [...document.querySelectorAll('h1, h2')].slice(0, 6);
  for (const h of headings) parts.push(h.textContent || '');

  const paragraphs = [...document.querySelectorAll('article p, main p, p')].slice(0, 40);
  for (const p of paragraphs) parts.push(p.textContent || '');

  return parts.join(' \n ').replace(/\s+/g, ' ').trim().slice(0, 6000);
}

const scanBtn = document.getElementById('scan');
const copyBtn = document.getElementById('copy');
const resultEl = document.getElementById('result');
const emptyEl = document.getElementById('empty');
const countriesEl = document.getElementById('countries');
const topicsEl = document.getElementById('topics');
const meterFill = document.getElementById('meterFill');
const copyHint = document.getElementById('copyHint');

let lastFilter = '';

function renderChips(container, items, className) {
  container.innerHTML = '';
  if (!items.length) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.textContent = 'none detected';
    container.appendChild(span);
    return;
  }
  for (const item of items) {
    const span = document.createElement('span');
    span.className = `chip ${className}`;
    span.textContent = item;
    container.appendChild(span);
  }
}

async function scan() {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  copyHint.textContent = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || '')) {
      throw new Error('Open a regular web page first.');
    }

    const [{ result: text }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageText,
    });

    const countries = TerrafeedDetect.detectCountries(text || '');
    const topics = TerrafeedDetect.detectTopics(text || '');
    const sev = TerrafeedDetect.severity(topics);

    renderChips(countriesEl, countries.map((c) => c.label), 'country');
    renderChips(topicsEl, topics.map((t) => t.label), 'topic');
    meterFill.style.width = `${Math.round(sev * 100)}%`;

    lastFilter = [...new Set([...countries.map((c) => c.label), ...topics.map((t) => t.label)])].join(
      ', ',
    );
    copyBtn.disabled = !lastFilter;

    resultEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
  } catch (error) {
    emptyEl.textContent = error instanceof Error ? error.message : String(error);
    emptyEl.classList.remove('hidden');
    resultEl.classList.add('hidden');
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan this page';
  }
}

async function copyFilter() {
  if (!lastFilter) return;
  await navigator.clipboard.writeText(lastFilter);
  copyHint.textContent = 'Copied — paste it into Terrafeed.';
  window.setTimeout(() => {
    copyHint.textContent = '';
  }, 2500);
}

scanBtn.addEventListener('click', () => void scan());
copyBtn.addEventListener('click', () => void copyFilter());
