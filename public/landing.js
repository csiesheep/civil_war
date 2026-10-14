// public/landing.js -- the entry on the home page (#44): pick a side, start a game against the bot (level 普通),
// or resume the saved one. Plain links to game.html; the save is only looked at to decide whether to show "resume"
// (every read in try/catch: no storage, no resume link, nothing else changes).
import { t } from "./i18n/zh-Hant.js";

const mount = document.getElementById("play");
if (mount) {
  let saved = false;
  try {
    const raw = localStorage.getItem("civil_war.save.v1");
    const s = raw && JSON.parse(raw);
    saved = !!(s && s.session && s.session.st && s.session.st.winner == null);
  } catch { saved = false; }
  const a = (href, cls, text) => { const el = document.createElement("a"); el.href = href; el.className = cls; el.textContent = text; return el; };
  const h2 = document.createElement("h2"); h2.textContent = t("home.startTitle");
  const p = document.createElement("p"); p.textContent = t("home.startNote");
  const row = document.createElement("div"); row.className = "row";
  row.append(a("game.html?new&side=0&level=normal", "go ccp", t("home.playCcp")), a("game.html?new&side=1&level=normal", "go kmt", t("home.playKmt")));
  mount.append(h2, p, row);
  if (saved) mount.append(a("game.html", "resume", t("home.resume")));
}
