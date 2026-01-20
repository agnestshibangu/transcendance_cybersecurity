// frontend/src/spa/auth-client.ts

//import * as Friends from "./friends-client.js";

export type Player = {
	id: number;
	username: string;
	mail: string;
	wallet_adress: string | null;
	created_at: string;
	avatar_kind?: "default" | "upload";
	avatar_value?: string;
};

let accessToken: string | null = null;
let currentPlayer: Player | null = null;

const AUTH_BASE = "/api/auth";

function setSession(token: string | null, player: Player | null) {
	accessToken = token;
	currentPlayer = player;
	notifySessionChanged();
}

function notifySessionChanged(): void {
	window.dispatchEvent(new CustomEvent("ft:session:changed"));
}

export function getAccessToken() {
	return accessToken;
}

export function getCurrentPlayer() {
	return currentPlayer;
}

export function getCurrentPlayerId(): number | null {
	if (!currentPlayer)
		return null;
	const id = Number(currentPlayer.id);
	if (!Number.isInteger(id) || id <= 0)
		return null;
	return id;
}


export function clearSession() {
	setSession(null, null);
	//notifySessionChanged();
	stopPresenceTimer();
}

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers || {});
	headers.set("Content-Type", "application/json");

	// Cookie refresh_token indispensable côté navigateur
	const res = await fetch(`${AUTH_BASE}${path}`, {
		...init,
		headers,
		credentials: "include",
	});

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  
  // Debug: if we get HTML instead of JSON, log the status and first 100 chars
  if (text && text[0] === "<") {
    console.error(`❌ Got HTML instead of JSON from ${path}`, {
      status: res.status,
      htmlStart: text.substring(0, 200)
    });
  }
  
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err: any = new Error(msg);
	err.status = res.status;
	throw err;
  }

  return data as T;
}

async function authed<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
	const headers = new Headers(init.headers || {});
	if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

	try {
		return await http<T>(path, { ...init, headers });
	} catch (e: any) {
		// Si pas de token, inutile de refresh => on renvoie direct l'erreur//!!!!!!!
		//if (!accessToken)													//!!!!!!!
		//	throw e;														//!!!!!!!

		// Si access token expiré → refresh cookie → retry 1 fois
		if (retry && e?.status === 401 && accessToken) {
			await refresh();
			return authed<T>(path, init, false);
		}
		throw e;
	}
}

// ---- Presence (ONLINE/OFFLINE) ----

let presenceTimer: number | null = null;

export async function presencePing(): Promise<void> {
	// Only ping if we have an access token (user is logged in)
	if (!accessToken) return;
	
	// endpoint AuthService
	await authed<void>("/presence/ping", { method: "POST", body: "{}" });
}

export async function presenceOffline(): Promise<void> {
	// Only send offline if we have an access token (user is logged in)
	if (!accessToken) return;
	
	await authed<void>("/presence/offline", { method: "POST", body: "{}" });
}

function startPresenceTimer(): void {
	if (presenceTimer !== null) return;

	// ping immédiat (important: online "tout de suite")
	void presencePing().catch(() => {});

	presenceTimer = window.setInterval(() => {
		void presencePing().catch(() => {});
	}, 25_000);

	// bonus UX: quand l’onglet redevient visible, ping tout de suite
	const onVis = () => {
		if (document.visibilityState === "visible") {
			void presencePing().catch(() => {});
		}
	};
	document.addEventListener("visibilitychange", onVis);
	window.addEventListener("focus", onVis);

	// on stocke les handlers sur window pour pouvoir cleanup (simple et lisible)
	(window as any).__presenceOnVis = onVis;
}

function stopPresenceTimer(): void {
	if (presenceTimer === null) return;
	window.clearInterval(presenceTimer);
	presenceTimer = null;

	const onVis = (window as any).__presenceOnVis as (() => void) | undefined;
	if (onVis) {
		document.removeEventListener("visibilitychange", onVis);
		window.removeEventListener("focus", onVis);
		delete (window as any).__presenceOnVis;
	}
}

export async function register(username: string, mail: string, password: string) {
  const resp = await http<{ access_token: string; player: Player }>("/register", {
    method: "POST",
    body: JSON.stringify({ username, mail, password }),
  });
  setSession(resp.access_token, resp.player);
  notifySessionChanged();
  startPresenceTimer();
  return resp.player;
}

export async function login(mail: string, password: string) {
  const resp = await http<{ access_token: string; player: Player }>("/login", {
    method: "POST",
    body: JSON.stringify({ mail, password }),
  });
  setSession(resp.access_token, resp.player);
  notifySessionChanged();
  startPresenceTimer();
  return resp.player;
}

export async function refresh() {
  const resp = await http<{ access_token: string; player: Player }>("/refresh", {
    method: "POST",
    body: JSON.stringify({}), // ton endpoint ignore le body, mais reste propre
  });
  setSession(resp.access_token, resp.player);
  notifySessionChanged();
  startPresenceTimer();
  return resp.player;
}

// export async function logout() {
//   await http<void>("/logout", { method: "POST", body: JSON.stringify({}) });
//   clearSession();
// }
export async function logout() {
	// 1) best-effort: marque offline pendant que le JWT est encore en mémoire
	try {
		await presenceOffline();
	} catch {
		// on n'empêche pas le logout si presence échoue
	}
	// 2) stop heartbeat local
	stopPresenceTimer();
	// 3) logout serveur
	await http<void>("/logout", { method: "POST", body: JSON.stringify({}) });
	// 4) cleanup local
	clearSession();
	notifySessionChanged();
}

export async function me() {
  const resp = await authed<{ player: Player }>("/me", { method: "GET" });
  currentPlayer = resp.player;
  //setSession(accessToken, resp.player); // garde le token, met à jour player + event
  startPresenceTimer();
  return resp.player;
}

export async function patchProfile(payload: Partial<Pick<Player, "username" | "avatar_kind" | "avatar_value">>) {
  const resp = await authed<{ player: Player }>("/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  currentPlayer = resp.player;
  return resp.player;
}

export async function changePassword(old_password: string, new_password: string) {
	await authed<void>("/change-password", {
		method: "POST",
		body: JSON.stringify({ old_password, new_password }),
	});
	// ton backend clear le cookie refresh_token après change-password → session morte
	clearSession();
}

// Forgot/reset : tu ajoutes ces endpoints ensuite côté backend
export async function forgotPassword(mail: string) {
	await http<void>("/forgot-password", {
		method: "POST",
		body: JSON.stringify({ mail }),
	});
}

export async function resetPassword(token: string, new_password: string) {
	await http<void>("/reset-password", {
		method: "POST",
		body: JSON.stringify({ token, new_password }),
	});
	clearSession();
}

export async function loginWithGoogle(token: string) {
	const resp = await http<{ access_token: string; player: Player }>("/google-login", {
		method: "POST",
		body: JSON.stringify({ token }),
	});
	setSession(resp.access_token, resp.player);
	startPresenceTimer();
	return resp.player;
}

