/*
 * The editor layer drawn inside the page, so it lands in the recording: a cursor, click ripples,
 * lower-third captions, a spotlight, zoom and full-screen chapter cards. It hangs off <html>,
 * outside <body>, so zooming the app (a transform on <body>) never scales the captions.
 * Injected with addInitScript; the director drives it through window.__demo.
 */
(() => {
  if (window.__demo) return;
  const store = window.sessionStorage;
  const css = `
  #demo-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:"Atkinson Hyperlegible",system-ui,sans-serif;
    --ink:#ffffff;--muted:#c3cde3;--panel:rgba(10,18,41,.94);--accent:#13BCFB;--accent-2:#FFB020}
  #demo-cursor{position:absolute;left:0;top:0;width:30px;height:30px;transition:transform var(--move,700ms) cubic-bezier(.45,.05,.2,1);filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))}
  #demo-cursor.pressed svg{transform:scale(.86);transform-origin:4px 4px}
  #demo-cursor svg{transition:transform 120ms}
  .demo-ripple{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:3px solid var(--accent-2);
    animation:demo-ripple 650ms ease-out forwards}
  @keyframes demo-ripple{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}
  #demo-caption{position:absolute;max-width:640px;min-width:360px;padding:18px 24px 20px 26px;border-radius:16px;background:var(--panel);
    color:var(--ink);box-shadow:0 18px 50px rgba(0,0,0,.35);backdrop-filter:blur(6px);border-left:5px solid var(--accent);
    opacity:0;transform:translateY(16px);transition:opacity 380ms ease,transform 380ms ease,left 500ms ease,top 500ms ease}
  #demo-caption.show{opacity:1;transform:none}
  #demo-caption .kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:6px}
  #demo-caption .title{font-size:22px;font-weight:700;line-height:1.25}
  #demo-caption .text{font-size:16px;line-height:1.5;color:var(--muted);margin-top:6px}
  #demo-spot{position:absolute;border-radius:14px;box-shadow:0 0 0 4px var(--accent-2),0 0 0 9999px rgba(8,20,16,.5);
    opacity:0;transition:opacity 350ms ease,left 500ms ease,top 500ms ease,width 500ms ease,height 500ms ease}
  #demo-spot.show{opacity:1}
  #demo-card{position:absolute;inset:0;display:flex;align-items:center;padding:0 9vw;opacity:0;transition:opacity 600ms ease;
    background:radial-gradient(1100px 700px at 75% 30%,rgba(19,188,251,.28),transparent 60%),linear-gradient(135deg,#0A1229 0%,#141B38 55%,#0A1229 100%);color:var(--ink)}
  #demo-card.show{opacity:1}
  #demo-layer.carded #demo-cursor{opacity:0}
  #demo-cursor{opacity:1;transition:transform var(--move,700ms) cubic-bezier(.45,.05,.2,1),opacity 300ms}
  #demo-card .wrap{max-width:1150px;transform:translateY(18px);transition:transform 800ms cubic-bezier(.2,.7,.2,1)}
  #demo-card.show .wrap{transform:none}
  #demo-card .index{font-family:"ClashDisplay",sans-serif;font-size:26px;letter-spacing:.2em;color:var(--accent);font-weight:800}
  #demo-card .title{font-family:"ClashDisplay",sans-serif;font-size:88px;line-height:1;font-weight:600;margin:14px 0 22px}
  #demo-card .text{font-size:26px;line-height:1.5;color:var(--muted);max-width:980px}
  #demo-card ul{margin:28px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 48px;font-size:21px;color:var(--ink)}
  #demo-card li{display:flex;gap:12px;align-items:baseline}
  #demo-card li b{font-family:"ClashDisplay",sans-serif;color:var(--accent);font-size:22px;min-width:34px}
  #demo-card .brand{position:absolute;left:9vw;bottom:7vh;font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
  #demo-badge{position:absolute;top:22px;right:26px;padding:10px 18px;border-radius:999px;background:var(--accent-2);color:#1d1403;
    font-weight:700;font-size:15px;letter-spacing:.04em;box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;transform:translateY(-8px);transition:opacity 300ms,transform 300ms}
  #demo-badge.show{opacity:1;transform:none}
  body.demo-zoomable{transition:transform 900ms cubic-bezier(.2,.7,.2,1)}
  `;

  const el = (tag, id, html = "") => {
    const node = document.createElement(tag);
    if (id) node.id = id;
    node.innerHTML = html;
    return node;
  };
  const cursorSvg = `<svg width="30" height="30" viewBox="0 0 30 30"><path d="M4 3 L4 24 L9.5 18.6 L13.3 27 L17 25.3 L13.3 17 L21 17 Z" fill="#fff" stroke="#0A1229" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

  let layer;
  function ensure() {
    if (layer?.isConnected) return layer;
    if (!document.documentElement) return null;
    const style = el("style", "demo-style", css);
    layer = el("div", "demo-layer");
    layer.append(style, el("div", "demo-spot"), el("div", "demo-caption"), el("div", "demo-card"), el("div", "demo-badge"), el("div", "demo-cursor", cursorSvg));
    const badge = store.getItem("demo-badge");
    if (badge) { layer.querySelector("#demo-badge").textContent = badge; layer.querySelector("#demo-badge").classList.add("show"); }
    document.documentElement.appendChild(layer);
    const pos = JSON.parse(store.getItem("demo-cursor") || "[800,450]");
    place(pos[0], pos[1], 0);
    if (store.getItem("demo-card-open")) { layer.querySelector("#demo-card").classList.add("show"); layer.classList.add("carded"); }
    return layer;
  }
  const $ = (id) => ensure()?.querySelector(id);

  function place(x, y, ms) {
    const cursor = layer.querySelector("#demo-cursor");
    cursor.style.setProperty("--move", `${ms}ms`);
    cursor.style.transform = `translate(${x - 4}px, ${y - 3}px)`;
    store.setItem("demo-cursor", JSON.stringify([x, y]));
  }


  /**
   * Lower-third placement: the bottom of the free area (beside an open drawer, or over the main
   * column), moving to the top when it would cover `avoid`, the thing being talked about. A caption
   * fades when a drawer or modal opens or closes, since it was about the screen before.
   */
  let current = null;
  function layout() {
    if (!current) return;
    const node = $("#demo-caption");
    const dialog = [...document.querySelectorAll("[role=dialog]")].pop()?.getBoundingClientRect();
    // A caption belongs to the screen it was shown on: a drawer or modal opening or closing ends it.
    if (Boolean(dialog) !== current.withDialog) return api.hideCaption();
    const beside = dialog && dialog.left > 400;
    const main = document.querySelector("main")?.getBoundingClientRect();
    const margin = 36;
    const left = beside ? margin : Math.max(main?.left ?? 0, 0) + margin;
    const right = beside ? dialog.left - margin : window.innerWidth - margin;
    node.style.maxWidth = `${Math.min(680, right - left)}px`;
    const { width, height } = node.getBoundingClientRect();
    const x = Math.round(left + (right - left - width) / 2);
    const bottom = Math.round(window.innerHeight - height - margin);
    const { avoid, place } = current;
    const hits = (y) => avoid && !(x + width < avoid.x || x > avoid.x + avoid.width || y + height < avoid.y || y > avoid.y + avoid.height);
    let y = place === "top" ? margin : bottom;
    if (place === "auto" && hits(bottom)) y = margin;
    if (node.style.left !== `${x}px`) node.style.left = `${x}px`;
    if (node.style.top !== `${y}px`) node.style.top = `${y}px`;
  }
  setInterval(layout, 200);

  const api = {
    ensure,
    cursorAt: () => JSON.parse(store.getItem("demo-cursor") || "[800,450]"),
    move(x, y, ms) { ensure(); place(x, y, ms); },
    press(x, y) {
      const cursor = $("#demo-cursor");
      cursor.classList.add("pressed");
      setTimeout(() => cursor.classList.remove("pressed"), 160);
      const ripple = el("div", null);
      ripple.className = "demo-ripple";
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      layer.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    },
    /**
     * Lower-third caption. It sits at the bottom of the free area (beside an open drawer, or over
     * the main column) and moves to the top when it would cover `avoid`, the thing being shown.
     */
    caption({ kicker = "", title = "", text = "", avoid, place = "auto" }) {
      const node = $("#demo-caption");
      node.innerHTML = `${kicker ? `<div class="kicker">${kicker}</div>` : ""}<div class="title">${title}</div>${text ? `<div class="text">${text}</div>` : ""}`;
      current = { avoid, place, withDialog: Boolean(document.querySelector("[role=dialog]")) };
      layout();
      requestAnimationFrame(() => node.classList.add("show"));
    },
    hideCaption() { current = null; $("#demo-caption")?.classList.remove("show"); },
    spotlight(rect, pad = 10) {
      const node = $("#demo-spot");
      Object.assign(node.style, {
        left: `${rect.x - pad}px`, top: `${rect.y - pad}px`,
        width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px`,
      });
      node.classList.add("show");
    },
    hideSpotlight() { $("#demo-spot")?.classList.remove("show"); },
    card({ index = "", title = "", text = "", points = [], brand = "" }) {
      const node = $("#demo-card");
      const list = points.length
        ? `<ul>${points.map((p, i) => `<li><b>${String(i + 1).padStart(2, "0")}</b><span>${p}</span></li>`).join("")}</ul>`
        : "";
      node.innerHTML = `<div class="wrap"><div class="index">${index}</div><div class="title">${title}</div><div class="text">${text}</div>${list}</div><div class="brand">${brand}</div>`;
      store.setItem("demo-card-open", "1");
      layer.classList.add("carded");
      requestAnimationFrame(() => node.classList.add("show"));
    },
    hideCard() { store.removeItem("demo-card-open"); $("#demo-card")?.classList.remove("show"); layer?.classList.remove("carded"); },
    /** A pill in the top corner, e.g. "Fast-forward ×3"; it survives page loads until hidden. */
    badge(text) { store.setItem("demo-badge", text); const node = $("#demo-badge"); node.textContent = text; node.classList.add("show"); },
    hideBadge() { store.removeItem("demo-badge"); $("#demo-badge")?.classList.remove("show"); },
    zoom(rect, scale) {
      const body = document.body;
      body.classList.add("demo-zoomable");
      const cx = rect.x + rect.width / 2 + window.scrollX;
      const cy = rect.y + rect.height / 2 + window.scrollY;
      body.style.transformOrigin = `${cx}px ${cy}px`;
      body.style.transform = `scale(${scale})`;
    },
    unzoom() { document.body.style.transform = ""; },
  };
  window.__demo = api;
  if (document.documentElement) ensure();
  document.addEventListener("DOMContentLoaded", ensure);
})();
