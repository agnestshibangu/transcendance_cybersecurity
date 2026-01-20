
// frontend/src/tournament.ts
import type { Player, Match, Tournament } from "./types.ts";

export class TournamentManager {
private state: Tournament = {
	players: [],
	matches: [],
	currentMatchIndex: -1,
};

addPlayer(alias: string): void {
	if (!alias.trim()) return;

	const newPlayer: Player = {
	id: Date.now(),
	alias,
	};
	this.state.players.push(newPlayer);
}

generateMatches(): void {
	const players = this.state.players;
	const matches: Match[] = [];
	let id = 0;

	// Round-robin simple
	for (let i = 0; i < players.length; i++) {
	for (let j = i + 1; j < players.length; j++) {
		matches.push({
		id: id++,
		playerA: players[i],
		playerB: players[j],
		status: "pending",
		});
	}
	}

	this.state.matches = matches;
	this.state.currentMatchIndex = matches.length > 0 ? 0 : -1;
}

advanceMatch(): void {
	if (this.state.currentMatchIndex === -1) return;

	const idx = this.state.currentMatchIndex;

	this.state.matches[idx].status = "done";

	if (idx + 1 < this.state.matches.length) {
	this.state.matches[idx + 1].status = "current";
	this.state.currentMatchIndex++;
	} else {
	this.state.currentMatchIndex = -1;
	}
}

getState(): Tournament {
	return this.state;
}
}
