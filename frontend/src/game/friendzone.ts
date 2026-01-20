// frontend/src/game/friendzone.ts

//import { makeStandaloneRef } from "./Utils/utils.js";
import * as Friends from "../spa/friends-client.js";
import { hasUnreadFrom, checkUnreadFrom, startUnreadPolling, stopUnreadPolling } from "../spa/messenger-controller.js";

type FriendZoneState = {
	loadedOnce: boolean;

	loading: boolean;
	error: string | null;

	friends: Friends.Friend[];
	incoming: Friends.FriendRequestIncoming[];

	searchQuery: string;
	searchLoading: boolean;
	searchError: string | null;
	searchResults: Friends.SearchResult[];
	sentRequests: Set<number>,
	friendsSig: string;

	outgoing: Friends.FriendRequestOutgoing[];
};

const state: FriendZoneState = {
	loadedOnce: false,

	loading: false,
	error: null,

	friends: [],
	incoming: [],

	searchQuery: "",
	searchLoading: false,
	searchError: null,
	searchResults: [],
	sentRequests: new Set<number>(),

	friendsSig: "",

	outgoing: [],
};


let friendsRefreshTimer: number | null = null;
let unreadChangeHandler: (() => void) | null = null;

function startFriendsRefresh(deps: FriendZoneDeps): void {
	if (friendsRefreshTimer !== null) return;

	friendsRefreshTimer = window.setInterval(() => {
		void refreshFriends(deps);
		// Also check for unread messages
		for (const friend of state.friends) {
			void checkUnreadFrom(friend.id);
		}
	}, 4000);
}

export function stopFriendsRefresh(): void {
	if (friendsRefreshTimer === null) return;
	clearInterval(friendsRefreshTimer);
	friendsRefreshTimer = null;
	stopUnreadPolling();
}

function makeFriendsSig(list: Friends.Friend[]): string {
	// tri pour être stable même si le backend change l’ordre
	const sorted = [...list].sort((a, b) => a.id - b.id);
	return sorted.map((f) => `${f.id}:${f.online ? 1 : 0}`).join("|");
}

async function refreshFriends(deps: FriendZoneDeps): Promise<void> {
	try {
		const friends = await Friends.listFriends();
		const sig = makeFriendsSig(friends);

		// refresh silencieux: rien ne change => aucun rerender
		if (sig === state.friendsSig) return;

		// changement réel => on met à jour + rerender
		state.friends = friends;
		state.friendsSig = sig;
		deps.requestRerender();
	} catch {
		// ignore: pas d'erreur UI en boucle
	}
}



export type FriendZoneDeps = {
	subs: any;                   // on garde pour compatibilité avec ton appel actuel
	requestRerender: () => void;  // nouveau: rerender via profileUpdate()

//	// optionnel: branché plus tard sur le module DM
//	openDm?: (friendId: number, username: string) => void;
};

function forceReload(deps: FriendZoneDeps) {
	deps.requestRerender();
}


async function loadAll(deps: FriendZoneDeps) {
	try {
		await Friends.pingPresence();
	} catch (err) {
		console.warn("[FriendZone] presence ping failed:", err);
	}

	if (state.loading) return;
	state.loading = true;
	state.error = null;
	forceReload(deps);

	try {
		// const [friends, incoming] = await Promise.all([
		// 	Friends.listFriends(),
		// 	Friends.listIncoming(),
		// ]);
		// state.friends = friends;
		// state.friendsSig = makeFriendsSig(friends);
		// state.incoming = incoming;
		// state.loadedOnce = true;
		const [friends, incoming, outgoing] = await Promise.all([
			Friends.listFriends(),
			Friends.listIncoming(),
			Friends.listOutgoing(),
		]);
		state.friends = friends;
		state.friendsSig = makeFriendsSig(friends);
		state.incoming = incoming;
		state.outgoing = outgoing;
		state.sentRequests = new Set<number>(outgoing.map((r) => r.to_id));
		state.loadedOnce = true;
	} catch (e: any) {
		state.error = e?.message ?? "Failed to load FriendZone data.";
		state.loadedOnce = true;
	} finally {
		state.loading = false;
		forceReload(deps);
	}
}


async function runSearch(deps: FriendZoneDeps, raw: string) {
	const q = raw.trim();
	state.searchQuery = q;

	state.searchError = null;
	state.searchResults = [];
	if (!q) {
		forceReload(deps);
		return;
	}

	if (state.searchLoading) return;
	state.searchLoading = true;
	forceReload(deps);

	try {
		state.searchResults = await Friends.searchPlayers(q);
	} catch (e: any) {
		state.searchError = e?.message ?? "Search failed.";
	} finally {
		state.searchLoading = false;
		forceReload(deps);
	}
}


async function onSendRequest(deps: FriendZoneDeps, to_id: number)
{
	// Garde-fous: évite double POST / double click
	if (state.sentRequests.has(to_id)) return;
	if (state.friends.some((f) => f.id === to_id)) return;
	if (state.incoming.some((r) => r.from_id === to_id)) return;

	// Marque "pending" immédiatement (UX + anti double click)
	state.sentRequests.add(to_id);
	forceReload(deps);

	try {
		await Friends.sendRequest(to_id);

		// retire la ligne immédiatement
		state.searchResults = state.searchResults.filter((u) => u.id !== to_id);
		forceReload(deps);

		// refresh friends/incoming
		await loadAll(deps);
	}
	catch (e: any)
	{
		// rollback si erreur
		state.sentRequests.delete(to_id);
		forceReload(deps);

		alert(e?.message ?? "Failed to send friend request.");
	}
}



async function onRespond(deps: FriendZoneDeps, request_id: number, action: "accept" | "decline") {
	try {
		await Friends.respondToRequest(request_id, action);
		if (action === "accept") alert("Friend request accepted.");
		else alert("Friend request declined.");
		await loadAll(deps);
	} catch (e: any) {
		alert(e?.message ?? "Failed to respond to request.");
	}
}


function makeBadge(online: boolean): HTMLSpanElement {
	const b = document.createElement("span");
	b.className =
	"ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-bold " +
	(online
		? "border-emerald-400/60 bg-emerald-900/40 text-emerald-100"
		: "border-rose-400/60 bg-rose-900/30 text-rose-100");
	b.textContent = online ? "ONLINE" : "OFFLINE";
	return b;
}

function makeRow(titleLeft: string): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "flex items-center justify-between gap-2 py-1";

	const left = document.createElement("div");
	left.className = "flex items-center";
	left.textContent = titleLeft;

	const right = document.createElement("div");
	right.className = "flex items-center gap-2";

	row.appendChild(left);
	row.appendChild(right);
	return row;
}

function makeConfirmModal(opts: {
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel: string;
	onConfirm: () => void | Promise<void>;
}) {
	const overlay = document.createElement("div");
	overlay.className =
		"fixed inset-0 z-[9999] flex items-center justify-center bg-black/60";

	const panel = document.createElement("div");
	panel.className =
		"hud-panel w-[420px] max-w-[90vw] rounded-hud border border-cyan-500/50 " +
		"bg-slate-950/90 p-5 shadow-hud-panel";

	const h = document.createElement("div");
	h.className = "text-cyan-100 font-extrabold tracking-widest text-sm uppercase";
	h.textContent = opts.title;

	const p = document.createElement("div");
	p.className = "mt-3 text-cyan-200 text-sm";
	p.textContent = opts.message;

	const actions = document.createElement("div");
	actions.className = "mt-5 flex justify-end gap-3";

	const cancel = document.createElement("button");
	cancel.className =
		"rounded-md border border-cyan-500/40 bg-slate-950/70 px-4 py-2 " +
		"text-[0.75rem] font-semibold text-cyan-200 hover:border-cyan-400/70 hover:bg-cyan-500/10";
	cancel.textContent = opts.cancelLabel;

	const confirm = document.createElement("button");
	confirm.className =
		"rounded-md border border-rose-400/60 bg-rose-900/30 px-4 py-2 " +
		"text-[0.75rem] font-semibold text-rose-100 hover:bg-rose-900/60";
	confirm.textContent = opts.confirmLabel;

	const close = () => overlay.remove();

	cancel.onclick = () => close();

	confirm.onclick = async () => {
		confirm.disabled = true;
		confirm.className += " opacity-60";
		try {
			await opts.onConfirm();
			close();
		} catch (e: any) {
			confirm.disabled = false;
			confirm.className = confirm.className.replace(" opacity-60", "");
			alert(e?.message ?? "Failed.");
		}
	};

	// click outside closes (same as cancel)
	overlay.addEventListener("click", (ev) => {
		if (ev.target === overlay) close();
	});

	actions.appendChild(cancel);
	actions.appendChild(confirm);
	panel.appendChild(h);
	panel.appendChild(p);
	panel.appendChild(actions);
	overlay.appendChild(panel);

	return overlay;
}

async function onRemoveFriend(deps: FriendZoneDeps, friendId: number, username: string) {
	const modal = makeConfirmModal({
		title: "Remove friend",
		message: `Remove ${username} from your friends list?`,
		confirmLabel: "Delete",
		cancelLabel: "Cancel",
		onConfirm: async () => {
			await Friends.removeFriend(friendId);
			await loadAll(deps);
		},
	});
	document.body.appendChild(modal);
}

function openDmWith(friend: Friends.Friend) {
    window.dispatchEvent(new CustomEvent("ft:dm:open", {
        detail: {
            friendId: friend.id,
            username: friend.username,
            avatar_kind: friend.avatar_kind ?? "default",
            avatar_value: friend.avatar_value ?? "default.png",
        },
    }));
}

export function renderFriendZone(sub: any, deps: FriendZoneDeps) {
	startFriendsRefresh(deps);
	startUnreadPolling();

	// Listen for unread changes to trigger rerender
	if (unreadChangeHandler) {
		window.removeEventListener("ft:unread:changed", unreadChangeHandler);
	}
	unreadChangeHandler = () => deps.requestRerender();
	window.addEventListener("ft:unread:changed", unreadChangeHandler);

	// chargement auto UNE SEULE FOIS (sinon flicker infini quand liste vide)
	if (!state.loadedOnce && !state.loading) {
		void loadAll(deps);
	}

	// HEADER: status global
	sub.addSection("FriendZone");

	if (state.loading) {
		sub.addLabel("Loading friends...", "");
	} else if (state.error) {
		sub.addLabel(state.error, "");
		sub.addButton("Retry", () => void loadAll(deps));
	} else {
		sub.addButton("Refresh", () => void loadAll(deps));
	}

	// 2) Friends list
	sub.addSection("Friends");

	if (!state.loading && !state.error && state.friends.length === 0) {
		sub.addLabel("No friends yet.", "");
	} else {
		const box = document.createElement("div");
		box.className =
			"hud-panel w-full rounded-hud border border-cyan-500/40 bg-slate-950/80 " +
			"p-3 shadow-hud-panel";

		for (const f of state.friends) {
			const row = makeRow(f.username);
			row.className = "flex items-center justify-between gap-2 py-1 text-cyan-100";
			row.firstChild && (row.firstChild as HTMLDivElement).appendChild(makeBadge(f.online));

			const right = row.lastChild as HTMLDivElement;

			// Add unread indicator if there are unread messages
			if (hasUnreadFrom(f.id)) {
				const unreadIcon = document.createElement("span");
				unreadIcon.className = "unread-indicator";
				unreadIcon.innerHTML = "⏳";
				unreadIcon.title = "New message(s)";
				right.appendChild(unreadIcon);
			}

			const mail = document.createElement("button");
			
			mail.type = "button";
			mail.className =
				"rounded-md border border-cyan-400/60 bg-cyan-900/20 px-2 py-1 " +
				"text-[0.7rem] font-semibold text-cyan-100 hover:bg-cyan-900/50";
			mail.textContent = "✉️";
			mail.title = "Message";
			mail.onclick = () => openDmWith(f);

			const trash = document.createElement("button");
			trash.type = "button";
			trash.className =
				"rounded-md border border-rose-400/60 bg-rose-900/20 px-2 py-1 " +
				"text-[0.7rem] font-semibold text-rose-100 hover:bg-rose-900/50";
			trash.textContent = "🗑";
			trash.title = "Remove friend";
			trash.onclick = () => void onRemoveFriend(deps, f.id, f.username);

			right.appendChild(mail);
			right.appendChild(trash);
			box.appendChild(row);

		}

		sub.addCustom(box);
	}

	// INCOMING panel (HUD style)
	sub.addSection("Incoming Requests");

	if (!state.loading && !state.error && state.incoming.length === 0) {
		sub.addLabel("No incoming requests.", "");
	} else {
		const box = document.createElement("div");
		box.className =
		"hud-panel w-full rounded-xl border border-cyan-500/40 bg-slate-950/80 " +
		"p-4 shadow-hud-panel space-y-2 text-[0.75rem] text-cyan-100";

		for (const r of state.incoming) {
		const row = document.createElement("div");
		row.className = "flex items-center justify-between gap-2";

		const name = document.createElement("div");
		name.className = "font-semibold text-cyan-100";
		name.textContent = r.from_username;

		const actions = document.createElement("div");
		actions.className = "flex gap-2";

		const accept = document.createElement("button");
		accept.className =
			"rounded-md border border-emerald-400/60 bg-emerald-900/40 px-3 py-1 " +
			"text-[0.7rem] font-semibold text-emerald-100 hover:bg-emerald-900/60";
		accept.textContent = "Accept";
		accept.onclick = () => void onRespond(deps, r.id, "accept");

		const decline = document.createElement("button");
		decline.className =
			"rounded-md border border-rose-400/60 bg-rose-900/30 px-3 py-1 " +
			"text-[0.7rem] font-semibold text-rose-100 hover:bg-rose-900/60";
		decline.textContent = "Decline";
		decline.onclick = () => void onRespond(deps, r.id, "decline");

		actions.appendChild(accept);
		actions.appendChild(decline);

		row.appendChild(name);
		row.appendChild(actions);
		box.appendChild(row);
		}

		sub.addCustom(box);
	}

	// 4) Search + send request
	sub.addSection("Find players");

	sub.addTextbox2("Search:", {
		showSetButton: false, // on n'utilise plus le "Set" interne
		initialValue: state.searchQuery,
		maxLength: 32,
		sanitize: (v: string) => v.replace(/[^\w]/g, "").slice(0, 32),
		onChange: (v: string) => {
			state.searchQuery = v; // on garde l'état à jour
		},
	});

	sub.addButton("Search", () => void runSearch(deps, state.searchQuery));

	if (state.searchLoading) {
		sub.addLabel("Searching...", "");
	}
	if (state.searchError) {
		sub.addLabel(state.searchError, "");
	}

	if (!state.searchLoading && !state.searchError && state.searchQuery.trim() !== "" && state.searchResults.length === 0) {
		sub.addLabel("No results.", "");
	}

	if (state.searchResults.length > 0) {
		const box = document.createElement("div");
		box.className =
			"hud-panel w-full rounded-hud border border-cyan-500/40 bg-slate-950/80 " +
			"p-3 shadow-hud-panel";

		for (const u of state.searchResults) {
			// skip si déjà friend / déjà incoming / déjà demandé
			const alreadyFriend = state.friends.some((f) => f.id === u.id);
			const alreadyIncoming = state.incoming.some((r) => r.from_id === u.id);
			const alreadySent = state.sentRequests.has(u.id);

			const row = makeRow(u.username);
			row.className = "flex items-center justify-between gap-2 py-2 text-cyan-100";

			const right = row.lastChild as HTMLDivElement;

			if (alreadyFriend) {
				const tag = document.createElement("span");
				tag.className =
					"rounded-full border border-emerald-400/60 bg-emerald-900/30 px-3 py-1 text-xs font-bold text-emerald-100";
				tag.textContent = "FRIEND";
				right.appendChild(tag);
			}
			else if (alreadyIncoming) {
				const tag = document.createElement("span");
				tag.className =
					"rounded-full border border-cyan-400/60 bg-cyan-900/20 px-3 py-1 text-xs font-bold text-cyan-100";
				tag.textContent = "INCOMING";
				right.appendChild(tag);
			}
			else if (alreadySent) {
				const tag = document.createElement("span");
				tag.className =
					"rounded-full border border-yellow-400/60 bg-yellow-900/20 px-3 py-1 text-xs font-bold text-yellow-100";
				tag.textContent = "SENT";
				right.appendChild(tag);
			}
			else {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className =
					"rounded-hud border border-cyan-400/60 bg-cyan-500/10 px-4 py-2 text-xs font-extrabold " +
					"tracking-widest text-cyan-100 hover:bg-cyan-500/15 hover:border-cyan-300/80";
				btn.textContent = "SEND REQUEST";
				btn.onclick = () => void onSendRequest(deps, u.id);
				right.appendChild(btn);
			}

			box.appendChild(row);
		}

		sub.addCustom(box);
	}

	// 5) Back 
	sub.addButton("Back", () => { 
		stopFriendsRefresh();
		// Cleanup event listener
		if (unreadChangeHandler) {
			window.removeEventListener("ft:unread:changed", unreadChangeHandler);
			unreadChangeHandler = null;
		}
		deps.subs.showMenu("menu-main")
	});
}

