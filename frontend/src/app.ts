

import { initRouter } from "./spa/router.js";
import { navigateTo } from "./spa/router.js";
import { AtlantisHUD } from "./spa/hud.js";
import { initLoginOverlay } from "./spa/login-ui.js";
import { refresh } from "./spa/auth-client.js";
import { g_main } from './game/main.js';
import { initConsent } from "./game/consent.js";
import { initDmController } from "./spa/messenger-controller.js";



export async function bootSession(): Promise<void> {
	const overlay = document.getElementById("login-overlay");
	if (!overlay) return;

	try {
		await refresh();               // utilise le cookie refresh_token
		overlay.classList.add("hidden");
		navigateTo("dashboard");
	} catch {
		overlay.classList.remove("hidden");
	}
}


document.addEventListener("DOMContentLoaded", () =>
{
	(async () =>
	{
		initRouter();
		new AtlantisHUD();
		initLoginOverlay();

		initDmController();

		// 1) consent obligatoire AVANT toute auth UI
		await initConsent();

		// 2) seulement après, on gère la session/login overlay
		await bootSession();

		// 3) puis on init le jeu/menus
		g_main();
	})();
});








// document.addEventListener("DOMContentLoaded", () => {
// 	initRouter();         // 1) on configure la navigation SPA
// 	new AtlantisHUD();    // 2) on initialise le HUD (clock, queue, logs, etc.)
// 	initTournamentView(); // 3) on initialise la partie Tournament.
// 	initLoginOverlay();   // 4) overlay de login full-screen

// 	void bootSession();

// 	g_main();
// });








// private initNav() {
// 	const pills = document.querySelectorAll<HTMLButtonElement>(".nav-pill");
// 	const views = {
// 	dashboard: document.getElementById("view-dashboard"),
// 	tournament: document.getElementById("view-tournament"),
// 	pong: document.getElementById("view-pong"),
// 	settings: document.getElementById("view-settings"),
// 	};

// 	pills.forEach((pill) => {
// 	pill.addEventListener("click", () => {
// 		const target = pill.dataset.view as keyof typeof views | undefined;
// 		if (!target) return;

// 		// toggle active pill
// 		pills.forEach((p) => p.classList.remove("active"));
// 		pill.classList.add("active");

// 		// toggle views
// 		(Object.keys(views) as Array<keyof typeof views>).forEach((key) => {
// 		const view = views[key];
// 		if (!view) return;
// 		if (key === target) {
// 			view.classList.remove("hidden");
// 		} else {
// 			view.classList.add("hidden");
// 		}
// 		});

// 		this.log(`Switched view to ${target}`, "INFO");
// 	});
// 	});
// }



