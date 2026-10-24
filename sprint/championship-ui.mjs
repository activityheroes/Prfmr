import { MEETS, EVENTS, newMeet, readMeet, saveMeet, meetURL, standings } from "./championship.mjs?v=sports-1";

const el = (tag, text, cls) => { const node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; };
export function createChampionshipUI() {
  const nav = el("button", "Championships", "nav-command"); nav.type = "button"; document.querySelector(".event-nav").append(nav);
  const dialog = el("dialog", null, "meet-dialog"); dialog.setAttribute("aria-label", "Championships"); document.body.append(dialog);
  dialog.addEventListener("keydown", e => e.stopPropagation()); dialog.addEventListener("keyup", e => e.stopPropagation());
  const next = el("button", "Next event", "primary-button meet-next"); next.type = "button"; next.hidden = true;
  document.getElementById("result-dialog").append(next);
  const strip = el("div", null, "meet-strip"); strip.hidden = true; document.querySelector(".scoreboard").before(strip);
  let race, previous;
  const go = () => { const s = readMeet(); if (s) location.href = meetURL(s); };
  function show() {
    if (race?.racing || race?.presentation && !document.getElementById("result-dialog").open) return;
    dialog.replaceChildren();
    const close = el("button", "Close", "text-button"); close.type = "button"; close.addEventListener("click", () => dialog.close());
    const header = el("div", null, "meet-heading"); header.append(el("span", "LOCAL CHAMPIONSHIP", "eyebrow"), close); dialog.append(header);
    const s = readMeet();
    if (s) {
      const complete = s.rounds.length === 3, rows = standings(s), player = rows.find(r => r.player);
      dialog.append(el("h2", complete ? ["", "Gold Medal", "Silver Medal", "Bronze Medal", "Meet Complete"][player.rank] : MEETS[s.key].name));
      dialog.append(el("p", complete ? MEETS[s.key].name + " / " + player.total + " points" : "Three events. One attempt per event. Cumulative points against simulated rivals."));
      if (complete) {
        const podium = el("div", null, "podium");
        for (const rank of [2, 1, 3]) {
          const r = rows[rank - 1], step = el("div", null, "podium-step"); step.dataset.place = String(rank);
          step.append(el("strong", r.name), el("span", String(r.total)), el("b", String(r.rank))); podium.append(step);
        }
        dialog.append(podium);
      }
      const table = el("table", null, "meet-table"), head = el("tr");
      ["Place", "Athlete", "1", "2", "3", "Total"].forEach(v => head.append(el("th", v))); const thead = el("thead"); thead.append(head); table.append(thead);
      const body = el("tbody");
      rows.forEach(row => { const tr = el("tr"); tr.dataset.player = String(row.player); [row.rank, row.name, ...[0, 1, 2].map(i => row.scores[i] ?? "-"), row.total].forEach(v => tr.append(el("td", String(v)))); body.append(tr); });
      table.append(body); dialog.append(table);
      const rounds = el("ol", null, "meet-rounds");
      MEETS[s.key].events.forEach((id, i) => rounds.append(el("li", EVENTS[id].name + " / " + (s.rounds[i] ? s.rounds[i].failed ? "NO MARK - 0 PTS" : s.rounds[i].points + " PTS" : "UP NEXT")))); dialog.append(rounds);
      if (!complete) { const resume = el("button", "Continue: " + EVENTS[MEETS[s.key].events[s.rounds.length]].name, "primary-button"); resume.addEventListener("click", go); dialog.append(resume); }
    } else { dialog.append(el("h2", "Choose a Meet"), el("p", "Three events, cumulative points, and a final podium. Your progress is saved on this device.")); }
    const choices = el("div", null, "meet-choices");
    Object.entries(MEETS).forEach(([key, meet]) => {
      const button = el("button", null, "meet-choice"); button.type = "button";
      button.append(el("strong", meet.name), el("span", meet.events.map(id => EVENTS[id].name).join(" / ")));
      button.addEventListener("click", () => {
        if (s && s.rounds.length < 3 && !button.dataset.confirm) { button.dataset.confirm = "true"; button.querySelector("strong").textContent = "Replace current meet?"; return; }
        const nextMeet = newMeet(key, crypto.getRandomValues(new Uint32Array(1))[0]);
        if (saveMeet(nextMeet)) location.href = meetURL(nextMeet);
        else { button.querySelector("strong").textContent = "Storage unavailable"; }
      }); choices.append(button);
    }); dialog.append(el("h3", s ? "Start a New Meet" : "Circuits"), choices);
    if (!dialog.open) dialog.showModal();
  }
  nav.addEventListener("click", show);
  next.addEventListener("click", () => { if (readMeet()?.rounds.length === 3) show(); else go(); });
  return (current, paused) => {
    race = current; nav.disabled = race.racing || !!race.presentation && !document.getElementById("result-dialog").open;
    const key = [race === previous, race.meetRecorded, race.meetSaveError, document.getElementById("result-dialog").open].join(":");
    if (strip.dataset.key === key) return; strip.dataset.key = key; previous = race;
    const s = readMeet(), bound = s && race.meetTicket?.id === s.id;
    strip.hidden = !bound; next.hidden = !bound || !race.meetRecorded;
    if (!bound) return;
    strip.textContent = MEETS[s.key].name.toUpperCase() + " / EVENT " + (race.meetTicket.round + 1) + " OF 3";
    if (race.meetSaveError) strip.textContent += " / RESULT NOT SAVED: STORAGE UNAVAILABLE";
    if (race.meetRecorded) {
      const row = standings(s).find(r => r.player);
      strip.textContent += " / " + row.total + " PTS";
      next.textContent = s.rounds.length === 3 ? "View Podium" : "Next: " + EVENTS[MEETS[s.key].events[s.rounds.length]].name;
    }
  };
}
