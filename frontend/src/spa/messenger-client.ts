// frontend/src/spa/messenger-client.ts

import { getAccessToken, refresh } from "./auth-client.js";


const AUTH_BASE = "/api/auth";

export type DmMessage = {
	id: number;
	from_player_id: number;
	to_player_id: number;
	body: string;
	created_at: string;
};

async function httpBase<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers || {});
	headers.set("Content-Type", "application/json");

	const res = await fetch(`${base}${path}`, {
		...init,
		headers,
		credentials: "include",
	});

	if (res.status === 204) 
		return undefined as T;

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

export async function listWith(otherId: number, after = 0, limit = 50): Promise<DmMessage[]> {
	const qs = `after=${encodeURIComponent(String(after))}&limit=${encodeURIComponent(String(limit))}`;
	return authedAuth<DmMessage[]>(`/dm/with/${otherId}?${qs}`, { method: "GET" });
}

export async function send(to_id: number, body: string): Promise<{ id: number }> {
	return authedAuth<{ id: number }>(`/dm/send`, {
		method: "POST",
		body: JSON.stringify({ to_id, body }),
	});
}

export async function setBlock(blocked_id: number, block: boolean): Promise<void> {
	await authedAuth<void>(`/dm/block`, {
		method: "POST",
		body: JSON.stringify({ blocked_id, block }),
	});
}
