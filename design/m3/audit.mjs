// design/m3/audit.mjs -- the three checks the brief asks for, run inside the page (paste into the console, or
// load a page with ?audit and read window.__audit). Returns { sideways, small, lowContrast, nodes }.
//   sideways     : the page is wider than the viewport
//   small        : buttons smaller than 44 x 44 css px
//   lowContrast  : text whose colour against its background is below 4.5:1 (a gradient counts as its darkest stop)
export function audit() {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none") {
        const cols = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter((c) => c && c.a > 0.5);
        if (cols.length) return cols.sort((p, q) => lum(p) - lum(q))[0]; // the darkest stop: the worst case for dark text
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const out = { sideways: document.documentElement.scrollWidth > innerWidth, vw: innerWidth, sw: document.documentElement.scrollWidth, small: [], lowContrast: [], nodes: 0 };
  for (const b of document.querySelectorAll("button")) {
    const r = b.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) out.small.push(`${(b.textContent || b.getAttribute("aria-label") || "").trim().slice(0, 12)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
    if (b.classList.contains("n")) out.nodes++;
  }
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (el.closest("[aria-hidden=true]") && !el.textContent.trim()) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    if (el.closest(".miniwrap")) continue; // the thumbnail in D hides its text
    const fg = parse(cs.color), bg = bgOf(el);
    if (!fg) continue;
    const cr = ratio(fg, bg);
    const key = cs.color + "|" + JSON.stringify(bg) + "|" + n.textContent.trim().slice(0, 8);
    if (cr < 4.5 && !seen.has(key)) { seen.add(key); out.lowContrast.push(`${cr.toFixed(2)} "${n.textContent.trim().slice(0, 14)}" ${cs.color} on rgb(${bg.r},${bg.g},${bg.b}) <${el.tagName.toLowerCase()} class="${el.className && el.className.baseVal === undefined ? el.className : ""}">`); }
  }
  return out;
}
if (/[?&]audit/.test(location.search)) addEventListener("load", () => setTimeout(() => { window.__audit = audit(); }, 800));
window.audit = audit;
