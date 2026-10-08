/* Placar Tênis — lógica compartilhada entre controle (index.html) e placar (overlay.html)
   Regras: melhor de 3 sets, contagem só de games.
   Set: 6 games com 2 de diferença, ou 7-5 / 7-6.
   Se ficar 1 set a 1: super tiebreak até 10 pontos (2 de diferença). */

const NTFY = "https://ntfy.sh/";

/* Cores disponíveis para a camiseta de cada jogador */
const CORES = [
  { n: "Azul", c: "#1e6fff" }, { n: "Azul-claro", c: "#4fc3f7" }, { n: "Vermelho", c: "#e53935" },
  { n: "Bordô", c: "#8b1e3f" }, { n: "Laranja", c: "#ff7a1f" }, { n: "Amarelo", c: "#ffd600" },
  { n: "Verde", c: "#2e9e4f" }, { n: "Roxo", c: "#8e44ad" }, { n: "Rosa", c: "#ff5fa2" },
  { n: "Branco", c: "#f5f5f5" }, { n: "Cinza", c: "#9aa5b1" }, { n: "Preto", c: "#1b1b1b" }
];
const CORES_PADRAO = ["#1e6fff", "#ff7a1f"];

function corClara(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165;
}

function camisetaSVG(cor) {
  const c = /^#[0-9a-fA-F]{6}$/.test(cor || "") ? cor : "#888888";
  return `<svg class="shirt" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3 4 5 1 9l3.5 2L6 10v11h12V10l1.5 1L23 9l-3-4-4-2c-.5 1.6-2 2.6-4 2.6S8.5 4.6 8 3Z" fill="${c}" stroke="rgba(255,255,255,.6)" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
}

function novoJogo(nomes, titulo, cores) {
  return {
    v: 1,
    nomes: nomes || ["Jogador 1", "Jogador 2"],
    cores: cores || CORES_PADRAO.slice(),
    titulo: titulo || "",
    sets: [[0, 0]],       // games de cada set (o último é o set atual)
    stb: null,            // [a, b] pontos do super tiebreak, ou null
    saque: 0,             // 0 ou 1
    vencedor: null,       // null, 0 ou 1
    ts: Date.now()
  };
}

function setFechado(g) {
  const [a, b] = g;
  const m = Math.max(a, b), d = Math.abs(a - b);
  return (m >= 6 && d >= 2) || m >= 7;
}

function setsGanhos(s) {
  const w = [0, 0];
  s.sets.forEach(g => { if (setFechado(g)) w[g[0] > g[1] ? 0 : 1]++; });
  return w;
}

/* Soma um game (ou ponto, no super tiebreak) para o jogador p. Devolve novo estado. */
function marcar(s0, p) {
  const s = JSON.parse(JSON.stringify(s0));
  if (s.vencedor !== null) return s0;

  if (s.stb) {
    s.stb[p]++;
    const total = s.stb[0] + s.stb[1];
    // saque troca após o 1º ponto e depois a cada 2 pontos
    if (total % 2 === 1) s.saque = 1 - s.saque;
    const m = Math.max(...s.stb), d = Math.abs(s.stb[0] - s.stb[1]);
    if (m >= 10 && d >= 2) s.vencedor = s.stb[0] > s.stb[1] ? 0 : 1;
  } else {
    const cur = s.sets[s.sets.length - 1];
    cur[p]++;
    s.saque = 1 - s.saque;
    if (setFechado(cur)) {
      const w = setsGanhos(s);
      if (w[0] === 2 || w[1] === 2) s.vencedor = w[0] === 2 ? 0 : 1;
      else if (w[0] === 1 && w[1] === 1) s.stb = [0, 0];
      else s.sets.push([0, 0]);
    }
  }
  s.ts = Date.now();
  return s;
}

function fase(s) {
  if (s.vencedor !== null) return "fim";
  if (s.stb) return "stb";
  return "set" + s.sets.length;
}

function esc(t) {
  return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Gera o HTML do placar (usado nas duas páginas) */
function placarHTML(s) {
  const fim = s.vencedor !== null;
  const ultimo = s.sets.length - 1;
  const cols = s.sets.map((g, i) => ({
    lbl: "S" + (i + 1),
    v: g,
    cur: !fim && !s.stb && i === ultimo,
    won: setFechado(g) ? (g[0] > g[1] ? 0 : 1) : null
  }));
  if (s.stb) cols.push({ lbl: "TB", v: s.stb, cur: !fim, won: fim ? s.vencedor : null, tb: true });

  const header =
    `<div class="sb-hdr"><span class="sb-ttl">${esc(s.titulo || "TÊNIS")}</span>` +
    cols.map(c => `<span class="sb-hc${c.tb ? " tb" : ""}">${c.lbl}</span>`).join("") +
    (fim ? `<span class="sb-hsp"></span>` : "") + `</div>`;

  const rows = [0, 1].map(p => {
    const cls = ["sb-row"];
    if (fim && s.vencedor === p) cls.push("win");
    if (fim && s.vencedor !== p) cls.push("lose");
    return `<div class="${cls.join(" ")}">` +
      `<span class="sb-srv">${!fim && s.saque === p ? '<i class="ball"></i>' : ""}</span>` +
      `<span class="sb-shirt">${camisetaSVG((s.cores || CORES_PADRAO)[p])}</span>` +
      `<span class="sb-nm">${esc(s.nomes[p] || "")}</span>` +
      cols.map(c => {
        const k = ["sb-g"];
        if (c.cur) k.push("cur");
        if (c.tb) k.push("tb");
        if (c.won === p) k.push("w");
        return `<span class="${k.join(" ")}">${c.v[p]}</span>`;
      }).join("") +
      `${fim && s.vencedor === p ? '<span class="sb-trophy">✓</span>' : ""}` +
      `</div>`;
  }).join("");

  return `<div class="sb">${header}${rows}</div>`;
}

/* ---- Sincronização via ntfy.sh (gratuito, sem cadastro) ---- */
function topico(sala) { return "placar-tenis-" + String(sala).toLowerCase().replace(/[^a-z0-9_-]/g, ""); }

async function enviarEstado(sala, s) {
  const r = await fetch(NTFY + topico(sala), { method: "POST", body: JSON.stringify(s) });
  if (!r.ok) throw new Error("HTTP " + r.status);
}

async function ultimoEstado(sala) {
  const r = await fetch(NTFY + topico(sala) + "/json?poll=1&since=latest", { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const linhas = (await r.text()).trim().split("\n").filter(Boolean);
  for (let i = linhas.length - 1; i >= 0; i--) {
    try {
      const m = JSON.parse(linhas[i]);
      if (m.event === "message" && m.message) return JSON.parse(m.message);
    } catch (e) { }
  }
  return null;
}

function ouvirEstado(sala, aoReceber, aoStatus) {
  let es;
  const abrir = () => {
    try {
      es = new EventSource(NTFY + topico(sala) + "/sse");
      es.onopen = () => aoStatus && aoStatus(true);
      es.onmessage = ev => {
        try {
          const m = JSON.parse(ev.data);
          if (m.event === "message" && m.message) aoReceber(JSON.parse(m.message));
        } catch (e) { }
      };
      es.onerror = () => { aoStatus && aoStatus(false); };
    } catch (e) { aoStatus && aoStatus(false); }
  };
  abrir();
  return () => es && es.close();
}
