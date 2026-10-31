/* corrector.js — Writing workspace logic */

(function () {
  'use strict';

  /* ---- Mobile nav toggle ---- */
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', e => {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- DOM refs ---- */
  const textarea      = document.getElementById('text-input');
  const charCounter   = document.getElementById('char-counter');
  const clearBtn      = document.getElementById('clear-btn');
  const sampleBtn     = document.getElementById('sample-btn');
  const modeSelect    = document.getElementById('mode-select');
  const improveBtn    = document.getElementById('improve-btn');
  const errorMsg      = document.getElementById('error-msg');
  const loadingState  = document.getElementById('loading-state');
  const loadingText   = document.getElementById('loading-text');
  const resultsSection = document.getElementById('results-section');
  const copyBtn       = document.getElementById('copy-btn');
  const downloadBtn   = document.getElementById('download-btn');

  // Result targets
  const improvedOutput   = document.getElementById('improved-output');
  const altBlock         = document.getElementById('alternatives-block');
  const altList          = document.getElementById('alternatives-list');
  const statsGrid        = document.getElementById('stats-grid');
  const diffOriginal     = document.getElementById('diff-original');
  const diffImproved     = document.getElementById('diff-improved');
  const grammarTbody     = document.getElementById('grammar-tbody');
  const spellingTbody    = document.getElementById('spelling-tbody');

  let improvedText = '';

  /* ---- Sample text ---- */
  const SAMPLE = 'i has went to the market yesterday and buyed some vegitables. Me and my friend was very happy becuase the prices is low. She dont like to waste time on a unnecessary things.';

  sampleBtn && sampleBtn.addEventListener('click', () => {
    textarea.value = SAMPLE;
    updateCounter();
    textarea.focus();
  });

  /* ---- Character counter ---- */
  function updateCounter() {
    const len = textarea.value.length;
    charCounter.textContent = `${len.toLocaleString()} / 5,000`;
    charCounter.style.color = len > 4500 ? '#a33' : '';
  }
  textarea && textarea.addEventListener('input', updateCounter);

  /* ---- Clear ---- */
  clearBtn && clearBtn.addEventListener('click', () => {
    textarea.value = '';
    updateCounter();
    hideResults();
    hideError();
    textarea.focus();
  });

  /* ---- Escape helper ---- */
  function esc(s) {
    return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  /* ---- UI helpers ---- */
  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    errorMsg.classList.add('visible');
  }
  function hideError() {
    errorMsg.textContent = '';
    errorMsg.style.display = 'none';
    errorMsg.classList.remove('visible');
  }
  function showLoading(mode) {
    loadingState.hidden = false;
    const labels = {
      basic: 'Correcting grammar and spelling…',
      professional: 'Rewriting in a professional tone…',
      academic: 'Rewriting in academic style…',
      formal: 'Applying formal tone…',
      simple: 'Simplifying the text…',
      concise: 'Making text more concise…',
      vocabulary: 'Enhancing vocabulary…'
    };
    loadingText.textContent = labels[mode] || 'Analyzing your writing…';
  }
  function hideLoading() {
    loadingState.hidden = true;
  }
  function hideResults() {
    resultsSection.hidden = true;
  }

  /* ---- Stats config ---- */
  const STAT_DEFS = [
    { key: 'original_words',   label: 'Original Words' },
    { key: 'improved_words',   label: 'Corrected Words' },
    { key: 'characters',       label: 'Characters' },
    { key: 'sentences',        label: 'Sentences' },
    { key: 'grammar_errors',   label: 'Grammar Errors' },
    { key: 'spelling_errors',  label: 'Spelling Errors' },
    { key: 'readability_before', label: 'Readability Before' },
    { key: 'readability_after',  label: 'Readability After' },
    { key: 'improvement_score',  label: 'Improvement Score', suffix: '/100', score: true },
  ];

  /* ---- Render results ---- */
  function render(data) {
    const d = data;

    // --- Improved text ---
    improvedText = d.improved || '';
    improvedOutput.textContent = improvedText;

    // --- Alternatives ---
    if (d.alternatives && d.alternatives.length > 0) {
      altList.innerHTML = d.alternatives.map(a =>
        `<div class="alternative-item">${esc(a)}</div>`
      ).join('');
      altBlock.hidden = false;
    } else {
      altBlock.hidden = true;
    }

    // --- Stats ---
    const s = d.stats || {};
    statsGrid.innerHTML = STAT_DEFS.map(def => {
      const val = s[def.key] !== undefined ? s[def.key] : '—';
      const suffix = def.suffix || '';
      const cls = def.score ? ' stat-score' : '';
      return `<div class="stat-card${cls}">
        <span class="stat-value">${esc(val)}${esc(suffix)}</span>
        <span class="stat-label">${esc(def.label)}</span>
      </div>`;
    }).join('');

    // --- Diff ---
    const L = [], R = [];
    (d.diff || []).forEach(op => {
      if (op.op === 'equal') {
        L.push(esc(op.a));
        R.push(esc(op.b));
      } else {
        if (op.a) L.push(`<span class="diff-del">${esc(op.a)}</span>`);
        if (op.b) R.push(`<span class="diff-ins">${esc(op.b)}</span>`);
      }
    });
    diffOriginal.innerHTML = L.join(' ');
    diffImproved.innerHTML = R.join(' ');

    // --- Grammar table ---
    const issues = d.issues || [];
    grammarTbody.innerHTML = issues.length > 0
      ? issues.map(i => `<tr>
          <td><span class="td-incorrect">${esc(i.incorrect)}</span></td>
          <td><span class="td-correct">${esc(i.correct)}</span></td>
          <td><span class="td-type">${esc(i.type)}</span></td>
          <td>${esc(i.explanation)}</td>
        </tr>`).join('')
      : `<tr><td colspan="4" class="td-empty">No grammar issues found.</td></tr>`;

    // --- Spelling table ---
    const spelling = d.spelling || [];
    spellingTbody.innerHTML = spelling.length > 0
      ? spelling.map(x => `<tr>
          <td><span class="td-wrong">${esc(x.wrong)}</span></td>
          <td><span class="td-suggestion">${esc(x.suggestion)}</span></td>
        </tr>`).join('')
      : `<tr><td colspan="2" class="td-empty">No spelling errors found.</td></tr>`;

    // --- Show results ---
    resultsSection.hidden = false;

    // Scroll to results
    setTimeout(() => {
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  /* ---- Improve button ---- */
  improveBtn && improveBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) {
      showError('Please enter some text before clicking Improve Text.');
      textarea.focus();
      return;
    }
    if (text.length > 5000) {
      showError('Text is too long. Please keep it under 5,000 characters.');
      return;
    }

    hideError();
    hideResults();
    const mode = modeSelect.value;
    showLoading(mode);
    improveBtn.disabled = true;
    improveBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="40" stroke-dashoffset="15" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite"/></circle></svg>
      Analyzing…
    `;

    try {
      const resp = await fetch('/api/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      render(data);
    } catch (err) {
      showError(err.message);
    } finally {
      hideLoading();
      improveBtn.disabled = false;
      improveBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Improve Text
      `;
    }
  });

  /* ---- Copy button ---- */
  copyBtn && copyBtn.addEventListener('click', () => {
    if (!improvedText) return;
    navigator.clipboard.writeText(improvedText).then(() => {
      copyBtn.textContent = '✓ Copied!';
      copyBtn.classList.add('copy-success');
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy
        `;
        copyBtn.classList.remove('copy-success');
      }, 2000);
    }).catch(() => {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = improvedText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
  });

  /* ---- Download button ---- */
  downloadBtn && downloadBtn.addEventListener('click', () => {
    if (!improvedText) return;
    const blob = new Blob([improvedText], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'improved_text.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  /* ---- Keyboard shortcut: Ctrl/Cmd + Enter to submit ---- */
  textarea && textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      improveBtn && improveBtn.click();
    }
  });

  /* ---- Init counter ---- */
  updateCounter();

})();
