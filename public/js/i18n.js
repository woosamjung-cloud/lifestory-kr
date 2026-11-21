// 다국어 지원 (지금은 한국어·English, 나라가 늘면 사전에 언어를 추가)
// - HTML: data-i18n="키" (글자), data-i18n-ph="키" (입력칸 안내 글), data-i18n-html="키" (줄바꿈 포함)
// - JS: t('키', { 이름: 값 })

import { PACKS } from './lang/index.js';

const DICT = Object.fromEntries(PACKS.map((p) => [p.code, p]));
const BASE = 'ko'; // 화면의 원래 글자 언어

export const LANGS = PACKS.map((p) => ({ code: p.code, label: p.label }));

function detect() {
  try {
    const saved = localStorage.getItem('haedoti.lang');
    if (saved && DICT[saved]) return saved;
  } catch {
    /* 저장 불가 */
  }
  const nav = (navigator.language || 'ko').slice(0, 2).toLowerCase();
  return DICT[nav] ? nav : BASE;
}

let lang = detect();
export const getLang = () => lang;

export function setLang(l) {
  if (!DICT[l]) return;
  lang = l;
  try {
    localStorage.setItem('haedoti.lang', l);
  } catch {
    /* 저장 불가 */
  }
  document.documentElement.lang = l;
  applyI18n();
  translateTree(document.body);
}

// 한국어 문장을 지금 언어로 (캔버스에 그리는 글자 등에 사용)
export function L(s) {
  return trNow(s);
}
// 지금 언어로 한국어 문장 바꾸기 (그 언어 파일의 translate)
function trNow(s) {
  if (lang === BASE) return s;
  const p = DICT[lang];
  return p && p.translate ? p.translate(s) : s;
}

// ---------- 화면 자동 번역: 영어일 때 화면에 나타나는 한국어 글자를 사전대로 바꿈 ----------
const ORIG = new WeakMap(); // 글자 노드 → 원래 한국어
const SHOWN = new WeakMap(); // 글자 노드 → 우리가 바꿔 넣은 글자
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
function fixText(node) {
  const cur = node.nodeValue;
  if (SHOWN.get(node) === cur) {
    // 우리가 바꿔 넣은 상태: 언어가 한국어로 돌아왔으면 원래 글자로
    if (lang === BASE) {
      node.nodeValue = ORIG.get(node);
      SHOWN.delete(node);
    }
    return;
  }
  // 앱이 새로 넣은 글자
  if (lang === BASE || !/[가-힣]/.test(cur)) return;
  const out = trNow(cur);
  if (out === cur) return;
  ORIG.set(node, cur);
  SHOWN.set(node, out);
  node.nodeValue = out;
}
const ATTR_STATE = new WeakMap(); // 요소 → { 속성: { orig, shown } }
function fixAttrs(el) {
  let st = ATTR_STATE.get(el);
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v == null) continue;
    const rec = st && st[a];
    if (rec && rec.shown === v) {
      if (lang === BASE) {
        el.setAttribute(a, rec.orig);
        delete st[a];
      }
      continue;
    }
    if (lang === BASE || !/[가-힣]/.test(v)) continue;
    const out = trNow(v);
    if (out === v) continue;
    if (!st) ATTR_STATE.set(el, (st = {}));
    st[a] = { orig: v, shown: out };
    el.setAttribute(a, out);
  }
}
export function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || SKIP.has(root.tagName) || root.closest?.('[data-noi18n]')) return;
  fixAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.tagName) || n.hasAttribute('data-noi18n')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let n = w.nextNode();
  while (n) {
    if (n.nodeType === 3) fixText(n);
    else fixAttrs(n);
    n = w.nextNode();
  }
}
let observer = null;
export function startAutoTranslate() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((list) => {
    if (lang === BASE) return;
    for (const m of list) {
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target);
      else m.addedNodes.forEach((n) => translateTree(n));
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  translateTree(document.body);
}

export function t(key, vars) {
  let s = DICT[lang]?.keys?.[key] ?? DICT[BASE].keys[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

// 사전에 있으면 번역, 없으면 원래 글자 그대로
export function tOr(key, fallback) {
  return DICT[lang]?.keys?.[key] ?? fallback;
}

export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
}

// 캔버스에 쓰는 글자도 지금 언어로 (글자 폭 계산도 같은 글자로)
export function localizeCtx(ctx) {
  if (ctx.__l10n) return ctx;
  const ft = ctx.fillText.bind(ctx);
  const st = ctx.strokeText.bind(ctx);
  const mt = ctx.measureText.bind(ctx);
  ctx.fillText = (t, ...a) => ft(L(t), ...a);
  ctx.strokeText = (t, ...a) => st(L(t), ...a);
  ctx.measureText = (t) => mt(L(t));
  ctx.__l10n = true;
  return ctx;
}
