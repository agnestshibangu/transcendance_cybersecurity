// frontend/src/spa/friends-client.ts

import { getAccessToken, refresh } from "./auth-client.js";

export type Friend = {
	id: number;
	username: string;
	online: boolean;
	avatar_kind?: "default" | "upload";
	avatar_value?: string;
};

export type FriendRequestIncoming = {
	id: number;
	from_id: number;
	from_username: string;
	created_at: string;
};

export type FriendRequestOutgoing = {
	id: number;
	to_id: number;
	to_username: string;
	created_at: string;
};


export type SearchResult = {
	id: number;
	username: string;
};

// We use the gateway → authservice exposed by /api/auth
const AUTH_BASE = "/api/auth";

const ONLINE_THRESHOLD_MS = 60_000;

function isOnline(last_seen_at: string | null | undefined): boolean {
	if (!last_seen_at) return false;

	// cas ISO -> OK
	let t = Date.parse(last_seen_at);
	if (Number.isFinite(t)) return Date.now() - t <= ONLINE_THRESHOLD_MS;

	// cas SQLite CURRENT_TIMESTAMP "YYYY-MM-DD HH:MM:SS"
	// Firefox peut renvoyer NaN -> on convertit en ISO basique
	if (last_seen_at.includes(" ") && !last_seen_at.includes("T")) {
		const iso = last_seen_at.replace(" ", "T") + "Z";
		t = Date.parse(iso);
		if (Number.isFinite(t)) return Date.now() - t <= ONLINE_THRESHOLD_MS;
	}

	return false;
}


async function httpBase<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers || {});
	headers.set("Content-Type", "application/json");

	const res = await fetch(`${base}${path}`, {
		...init,
		headers,
		credentials: "include",
	});

	if (res.status === 204) return undefined as T;

	const text = await res.text();
	const data = text ? JSON.parse(text) : null;

	if (!res.ok) {
		const msg = data?.error || `HTTP ${res.status}`;
		const err: any = new Error(msg);
		err.status = res.status;
		throw err;
	}

	return data as T;
}

async function authedAuth<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
	const headers = new Headers(init.headers || {});
	const token = getAccessToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);

	try {
		return await httpBase<T>(AUTH_BASE, path, { ...init, headers });
	} catch (e: any) {
		if (retry && e?.status === 401) {
			await refresh();
			return authedAuth<T>(path, init, false);
		}
		throw e;
	}
}


// DBWriter via AuthService

export async function listFriends(): Promise<Friend[]> {
	const rows = await authedAuth<
		Array<{ friend_id: number; username: string; avatar_kind?: string; avatar_value?: string; last_seen_at?: string | null }>
	>("/friends/list", { method: "GET" });

	return rows.map((r) => ({
		id: r.friend_id,
		username: r.username,
		online: isOnline(r.last_seen_at),
		avatar_kind: (r.avatar_kind === "upload" || r.avatar_kind === "default") ? r.avatar_kind : "default",
		avatar_value: typeof r.avatar_value === "string" ? r.avatar_value : "default.png",
	}));
}

export async function listIncoming(): Promise<FriendRequestIncoming[]> {
	const rows = await authedAuth<
		Array<{ id: number; from_player_id: number; from_username: string; created_at: string }>
	>("/friends/requests/incoming", { method: "GET" });

	return rows.map((r) => ({
		id: r.id,
		from_id: r.from_player_id,
		from_username: r.from_username,
		created_at: r.created_at,
	}));
}

export async function listOutgoing(): Promise<FriendRequestOutgoing[]> {
	const rows = await authedAuth<
		Array<{ id: number; to_player_id: number; to_username: string; created_at: string }>
	>("/friends/requests/outgoing", { method: "GET" });

	return rows.map((r) => ({
		id: r.id,
		to_id: r.to_player_id,
		to_username: r.to_username,
		created_at: r.created_at,
	}));
}


export async function searchPlayers(q: string): Promise<SearchResult[]> {
	const qs = encodeURIComponent(q);
	const rows = await authedAuth<Array<{ id: number; username: string }>>(
		`/players/search?q=${qs}`,
		{ method: "GET" }
	);

	return rows.map((r) => ({ id: r.id, username: r.username }));
}

export async function sendRequest(to_id: number): Promise<void> {
	await authedAuth<void>("/friends/requests", {
		method: "POST",
		body: JSON.stringify({ to_id }),
	});
}

export async function respondToRequest(request_id: number, action: "accept" | "decline"): Promise<void> {
	await authedAuth<void>(`/friends/requests/${request_id}/respond`, {
		method: "POST",
		body: JSON.stringify({ accept: action === "accept" }),
	});
}

export async function pingPresence(): Promise<void> {
	// Only ping if we have an access token (user is logged in)
	const token = getAccessToken();
	if (!token) return; // Silently skip if not authenticated
	
	await authedAuth<void>("/presence/ping", { method: "POST", body: "{}" });
}

export async function presenceOffline(): Promise<void> {
	// Only send offline if we have an access token (user is logged in)
	const token = getAccessToken();
	if (!token) return; // Silently skip if not authenticated
	
	await authedAuth<void>("/presence/offline", { method: "POST", body: "{}" });
}

export async function removeFriend(friend_id: number): Promise<void> {
	await authedAuth<void>(`/friends/${friend_id}`, {
		method: "DELETE",
		body: "{}",
	});
}

