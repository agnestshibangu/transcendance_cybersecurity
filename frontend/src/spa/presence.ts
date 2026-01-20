// frontend/src/game/presence.ts

import * as Friends from "../spa/friends-client.js";

let timer: number | null = null;

export function startPresenceLoop(): void
{
	if (timer !== null)
		return;

	// ping immédiat (best-effort) + ping régulier
	void Friends.pingPresence().catch(() => {});
	timer = window.setInterval(() => {
		void Friends.pingPresence().catch(() => {});
	}, 25_000);
}

export function stopPresenceLoop(): void
{
	if (timer === null)
		return;
	window.clearInterval(timer);
	timer = null;
}
