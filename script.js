'use strict';

(() => {
  const SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.?/~|',
  };

  // Characters that are easy to confuse with each other.
  const SIMILAR = /[0Oo1lI|]/g;

  // Thresholds are in bits of entropy (length × log2 of the pool size).
  const LEVELS = [
    { minBits: 0, label: 'ضعيفة' },
    { minBits: 45, label: 'متوسطة' },
    { minBits: 65, label: 'قوية' },
    { minBits: 90, label: 'قوية جداً' },
  ];

  const COPY_LABEL = 'نسخ';
  const COPIED_LABEL = 'تم النسخ ✓';
  const COPY_FAILED_LABEL = 'تعذّر النسخ';

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $('options'),
    length: $('length'),
    lengthValue: $('length-value'),
    upper: $('upper'),
    lower: $('lower'),
    digits: $('digits'),
    symbols: $('symbols'),
    excludeSimilar: $('exclude-similar'),
    password: $('password'),
    strength: $('strength'),
    strengthLabel: $('strength-label'),
    strengthBits: $('strength-bits'),
    generate: $('generate'),
    copy: $('copy'),
    alert: $('alert'),
  };

  let currentPassword = '';
  let copyTimer = 0;

  // Uniform random integer in [0, max), using rejection sampling to avoid modulo bias.
  function randomInt(max) {
    const limit = Math.floor(0x100000000 / max) * max;
    const buffer = new Uint32Array(1);
    do {
      crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return buffer[0] % max;
  }

  function pick(chars) {
    return chars[randomInt(chars.length)];
  }

  // Fisher–Yates shuffle.
  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function selectedSets() {
    const exclude = els.excludeSimilar.checked;
    return Object.keys(SETS)
      .filter((key) => els[key].checked)
      .map((key) => (exclude ? SETS[key].replace(SIMILAR, '') : SETS[key]));
  }

  function createPassword(length, sets) {
    const pool = sets.join('');
    // One character from every selected type, then fill the rest from the full pool.
    const chars = sets.map(pick);
    while (chars.length < length) {
      chars.push(pick(pool));
    }
    return shuffle(chars).join('');
  }

  function renderPassword(password) {
    // A single wrapper keeps the characters in one line box so long passwords can wrap.
    const text = document.createElement('span');
    text.className = 'password-text';
    for (const ch of password) {
      const span = document.createElement('span');
      span.textContent = ch;
      if (/[0-9]/.test(ch)) {
        span.className = 'ch-digit';
      } else if (!/[A-Za-z]/.test(ch)) {
        span.className = 'ch-symbol';
      }
      text.append(span);
    }
    els.password.classList.remove('is-empty');
    els.password.replaceChildren(text);
  }

  function renderStrength(length, poolSize) {
    if (!poolSize) {
      els.strength.dataset.level = '0';
      els.strengthLabel.textContent = '—';
      els.strengthBits.textContent = '';
      return;
    }
    const bits = Math.round(length * Math.log2(poolSize));
    let level = 0;
    LEVELS.forEach((item, index) => {
      if (bits >= item.minBits) level = index;
    });
    els.strength.dataset.level = String(level + 1);
    els.strengthLabel.textContent = LEVELS[level].label;
    els.strengthBits.textContent = `(≈ ${bits} بت)`;
  }

  function resetCopyButton() {
    clearTimeout(copyTimer);
    els.copy.textContent = COPY_LABEL;
    els.copy.classList.remove('is-copied');
  }

  function generate() {
    const length = Number(els.length.value);
    const sets = selectedSets();
    els.lengthValue.textContent = String(length);
    resetCopyButton();

    if (sets.length === 0) {
      currentPassword = '';
      els.password.textContent = 'لا توجد كلمة مرور';
      els.password.classList.add('is-empty');
      els.alert.textContent = 'اختر نوعاً واحداً على الأقل من الأحرف لتوليد كلمة مرور.';
      els.copy.disabled = true;
      renderStrength(length, 0);
      return;
    }

    currentPassword = createPassword(length, sets);
    els.alert.textContent = '';
    els.copy.disabled = false;
    renderPassword(currentPassword);
    renderStrength(length, sets.join('').length);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall back to the legacy method below.
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  async function copyPassword() {
    if (!currentPassword) return;
    const copied = await copyText(currentPassword);
    clearTimeout(copyTimer);
    els.copy.textContent = copied ? COPIED_LABEL : COPY_FAILED_LABEL;
    els.copy.classList.toggle('is-copied', copied);
    copyTimer = setTimeout(resetCopyButton, 2000);
  }

  els.length.addEventListener('input', generate);
  els.form.addEventListener('change', (event) => {
    if (event.target.type === 'checkbox') generate();
  });
  els.form.addEventListener('submit', (event) => event.preventDefault());
  els.generate.addEventListener('click', generate);
  els.copy.addEventListener('click', copyPassword);

  generate();
})();
