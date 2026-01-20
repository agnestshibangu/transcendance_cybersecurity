
// frontend/src/types.ts

export interface Player {
	id: number;
	alias: string;
}

export interface Match {
	id: number;
	playerA: Player;
	playerB: Player;
	status: "pending" | "current" | "done";
}

export interface Tournament {
	players: Player[];
	matches: Match[];
	currentMatchIndex: number; // -1 = none yet
}
