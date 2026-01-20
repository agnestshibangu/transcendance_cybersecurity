
// frontend/src/tournament-ui.ts
import { TournamentManager } from "./tournament.js";


// Helper générique pour éviter les "possibly null"
function getEl<T extends HTMLElement>(id: string): T {
	const el = document.getElementById(id);
	if (!el) {
		throw new Error(`Element with id "${id}" not found in DOM`);
	}
	return (el as T);
}

export function initTournamentView() {
	const tm = new TournamentManager();

	// Sélecteurs
	const input = getEl<HTMLInputElement>("tournament-alias-input");
	const btnAdd = getEl<HTMLInputElement>("tournament-add-player");
	const btnStart = getEl<HTMLInputElement>("tournament-start");
	const btnAdvance = getEl<HTMLInputElement>("tournament-advance");

	const listPlayers = getEl<HTMLInputElement>("tournament-player-list");
	const listMatches = getEl<HTMLInputElement>("tournament-match-list");
	const currentMatch = getEl<HTMLInputElement>("tournament-current-match");
	const nextMatch = getEl<HTMLInputElement>("tournament-next-match");

	// Vérification stricte (bonnes pratiques)
	if (!input || !btnAdd || !btnStart || !btnAdvance ||
		!listPlayers || !listMatches || !currentMatch || !nextMatch) {
		console.error("Tournament view elements missing from DOM.");
		return;
	}

	// ----- EVENTS -----
	btnAdd.addEventListener("click", () => {
		tm.addPlayer(input.value);
		input.value = "";
		render();
	});

	btnStart.addEventListener("click", () => {
		tm.generateMatches();
		render();
	});

	btnAdvance.addEventListener("click", () => {
		tm.advanceMatch();
		render();
	});

	// ----- RENDER -----
	function render() {
		const st = tm.getState();

		// players
		listPlayers.innerHTML = "";
			st.players.forEach((p) => {
			const li = document.createElement("li");
			li.textContent = p.alias;
			listPlayers.appendChild(li);
		});

		// enable start
		btnStart.disabled = st.players.length < 2;

		// matches
		listMatches.innerHTML = "";
		st.matches.forEach((m) => {
			const li = document.createElement("li");
			li.textContent = `${m.playerA.alias} vs ${m.playerB.alias} — ${m.status}`;
			listMatches.appendChild(li);
		});

		// current + next match
		if (st.currentMatchIndex === -1) {
			currentMatch.textContent = "Tournament finished";
			nextMatch.textContent = "--";
		} else {
			const cm = st.matches[st.currentMatchIndex];
			currentMatch.textContent = `${cm.playerA.alias} vs ${cm.playerB.alias}`;

			const nm = st.matches[st.currentMatchIndex + 1];
			nextMatch.textContent = nm
				? `${nm.playerA.alias} vs ${nm.playerB.alias}`
				: "End";
		}
	}

	// Initial render
	render();
}
