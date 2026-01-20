
// frontend/src/router.ts

// 1. Définition des routes possibles
export type Route = "dashboard" | "tournament" | "pong" | "settings";

const VALID_ROUTES: Route[] = ["dashboard", "tournament", "pong", "settings"];

// 2. Normalise le hash (#, #/dashboard, #dashboard, etc.) -> route valide
function normalizeHash(hash: string): Route 
{
	// enlève le # ou #/ éventuel
	const cleaned = hash.replace(/^#\/?/, "");

	if (VALID_ROUTES.includes(cleaned as Route)) {
		return cleaned as Route;
	}
	// fallback : dashboard
	return "dashboard";
}

// 3. Affiche la bonne section et met à jour les onglets
function showRoute(route: Route): void
{
	// mapping route -> id de section
	const sections: Record<Route, HTMLElement | null> = {
		dashboard: document.getElementById("view-dashboard"),
		tournament: document.getElementById("view-tournament"),
		pong: document.getElementById("view-pong"),
		settings: document.getElementById("view-settings"),
	};

	// Afficher / cacher les sections
	(Object.keys(sections) as Route[]).forEach((key) => {
		const el = sections[key];
		if (!el)
			return;

		if (key === route) 
		{
			el.classList.remove("hidden");
		}
		else 
		{
			el.classList.add("hidden");
		}
	});

	// Mettre à jour les boutons de navigation .nav-pill
	const pills = document.querySelectorAll<HTMLButtonElement>(".nav-pill");
	pills.forEach((pill) => {
		const pillRoute = pill.dataset.view as Route | undefined;
		if (!pillRoute) return;

		if (pillRoute === route) {
		pill.classList.add("active");
		}
		else 
		{
		pill.classList.remove("active");
		}
	});
}

// 4. Handler central quand le hash change (Back/Forward ou set hash)
function handleHashChange(): void
{
	const route = normalizeHash(window.location.hash);
	showRoute(route);
}

// 5. Fonction publique pour naviguer depuis le code (cliquer sur un onglet)
export function navigateTo(route: Route): void
{
	if (!VALID_ROUTES.includes(route)) return;

	const targetHash = "#/" + route;

	// Si le hash est déjà le bon, on ne le change pas (mais on force l’affichage)
	if (window.location.hash === targetHash)
	{
		showRoute(route);
	}
	else
	{
		window.location.hash = targetHash;
	}
}

// 6. Initialisation du routeur (a appeler une fois au demarrage)
export function initRouter(): void {
	// 1. Ecoute les clics sur les boutons nav-pill
	const pills = document.querySelectorAll<HTMLButtonElement>(".nav-pill");

	pills.forEach((pill) => {
		pill.addEventListener("click", (event) => {
			event.preventDefault();
			const route = pill.dataset.view as Route | undefined;
			if (!route)
				return;
			navigateTo(route);
		});
	});

	// 2. Reagir aux changements de hash (Back/Forward)
	window.addEventListener("hashchange", () => {
		handleHashChange();
	});

	// 3. Premier affichage : toujours afficher la route actuelle
	// (Si pas de hash -> dashboard, si déjà un hash -> prendre celui-là)
	if (!window.location.hash || window.location.hash === "#") {
		window.location.hash = "#/dashboard";
	}
	
	handleHashChange();
}