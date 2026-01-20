import * as DM from "./messenger-client.js";
import { getCurrentPlayer, getAccessToken } from "./auth-client.js";
import { getCurrentPlayerId } from "./auth-client.js";

type ActiveDm = {
	friendId: number;
	username: string;
	avatar_kind: "default" | "upload";
	avatar_value: string;
	lastId: number;
	blocked: boolean;
};

let active: ActiveDm | null = null;
let pollTimer: number | null = null;

// ========== UNREAD MESSAGES TRACKING ==========
// Map: friendId -> last message ID read by user (when they close the DM window)
const lastReadMessageId = new Map<number, number>();
// Map: friendId -> true if there are unread messages
const hasUnread = new Map<number, boolean>();
let unreadPollTimer: number | null = null;

// Start polling for new messages from all friends
function startUnreadPolling(): void {
	if (unreadPollTimer !== null) return;
	unreadPollTimer = window.setInterval(() => void checkUnreadMessages(), 3000);
}

function stopUnreadPolling(): void {
	if (unreadPollTimer !== null) {
		window.clearInterval(unreadPollTimer);
		unreadPollTimer = null;
	}
}

// Check for new messages from friends (messages sent TO me)
async function checkUnreadMessages(): Promise<void> {
	const token = getAccessToken();
	if (!token) return;

	const meId = getCurrentPlayerId();
	if (meId === null) return;

	try {
		// Get all messages sent to me (we'll need to add an endpoint or use existing)
		// For now, we'll poll individual friends from the friend list
		// This is called from friendzone when friends are loaded
	} catch {
		// Silent fail
	}
}

// Check if a friend has unread messages
export function hasUnreadFrom(friendId: number): boolean {
	return hasUnread.get(friendId) === true;
}

// Mark messages from a friend as read
export function markAsRead(friendId: number, lastMessageId?: number): void {
	if (lastMessageId !== undefined && lastMessageId > 0) {
		// Save the last read message ID so we know where the user left off
		lastReadMessageId.set(friendId, lastMessageId);
	}
	// Clear the unread flag
	hasUnread.delete(friendId);
	// Dispatch event to update UI
	window.dispatchEvent(new CustomEvent("ft:unread:changed"));
}

// Poll for unread messages from a specific friend
export async function checkUnreadFrom(friendId: number): Promise<void> {
	const token = getAccessToken();
	if (!token) return;

	const meId = getCurrentPlayerId();
	if (meId === null) return;

	// Skip if this is the currently active DM
	if (active && active.friendId === friendId) return;

	try {
		// Get the last message ID the user actually read
		const lastSeenId = lastReadMessageId.get(friendId) ?? 0;
		const msgs = await DM.listWith(friendId, lastSeenId, 10);
		
		// Check if there are new messages FROM the friend (not from me)
		const newFromFriend = msgs.filter(m => m.from_player_id === friendId);
		
		if (newFromFriend.length > 0) {
			// Mark as having unread messages
			hasUnread.set(friendId, true);
			// Dispatch event to update UI
			window.dispatchEvent(new CustomEvent("ft:unread:changed"));
		} else {
			// No new messages, clear unread flag
			hasUnread.delete(friendId);
		}
	} catch (e: any) {
		// Silent fail for 403 (blocked/not friends) or other errors
		// Clear any existing unread status if we get an error
		if (e?.status === 403) {
			hasUnread.delete(friendId);
			lastReadMessageId.delete(friendId);
		}
	}
}

// Export for use in friendzone
export { startUnreadPolling, stopUnreadPolling };

function el<T extends HTMLElement>(id: string): T | null {
	return document.getElementById(id) as T | null;
}

function showDm(open: boolean): void {
	const root = el<HTMLElement>("popup-stats");
	if (!root) return;
	
	// Remove focus from any element inside before hiding to avoid aria-hidden warning
	if (!open && root.contains(document.activeElement)) {
		(document.activeElement as HTMLElement)?.blur();
	}
	
	root.classList.toggle("hidden", !open);
	root.setAttribute("aria-hidden", open ? "false" : "true");
}

function avatarSrc(kind: "default" | "upload", value: string): string {
	if (kind === "upload" && value.startsWith("data:image/")) return value;
	if (!value) return "./public/images/avatars/default.png";
	return `./public/images/avatars/${value}`;
}

function clearLog(): void {
	const root = el<HTMLElement>("hud-log");
	if (root) root.innerHTML = "";
}

function fmtTime(ts: string): string {
	const d = new Date(ts.includes(" ") && !ts.includes("T") ? ts.replace(" ", "T") + "Z" : ts);
	if (Number.isNaN(d.getTime())) return "--:--";
	return d.toLocaleTimeString("fr-FR", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

function renderMessage(m: DM.DmMessage, meId: number, meName: string): void {
	const root = el<HTMLElement>("hud-log");
	if (!root || !active) return;

	const mine = m.from_player_id === meId;
	const who = mine ? meName : active.username;

	const row = document.createElement("div");
	row.className = `mb-2 flex ${mine ? "justify-end" : "justify-start"} gap-2`;

	// Avatar only for other player's messages
	if (!mine) {
		const avatar = document.createElement("img");
		avatar.src = avatarSrc(active.avatar_kind, active.avatar_value);
		avatar.className = "w-8 h-8 rounded-lg object-cover border border-cyan-500/30 flex-shrink-0";
		row.appendChild(avatar);
	}

	const bubble = document.createElement("div");
	bubble.className =
		"max-w-[85%] rounded-2xl border px-3 py-2 text-sm shadow-[0_0_18px_rgba(34,211,238,0.10)] " +
		(mine
			? "border-cyan-400/40 bg-cyan-900/15 text-cyan-50"
			: "border-cyan-500/25 bg-slate-900/55 text-sky-50");

	const head = document.createElement("div");
	head.className = "mb-1 flex items-center justify-between gap-3 text-[0.65rem] text-cyan-200/80";

	const label = document.createElement("span");
	label.className = "truncate";
	label.textContent = `${who} dit :`;

	const time = document.createElement("span");
	time.className = "shrink-0 font-mono text-cyan-300/70";
	time.textContent = fmtTime(m.created_at);

	const body = document.createElement("div");
	body.className = "whitespace-pre-wrap break-words text-cyan-50/95";
	body.textContent = m.body;

	head.appendChild(label);
	head.appendChild(time);
	bubble.appendChild(head);
	bubble.appendChild(body);
	row.appendChild(bubble);
	root.appendChild(row);

	root.scrollTop = root.scrollHeight;
}

async function loadInitial(): Promise<void> {
	if (!active) return;

	// Don't try to load if not authenticated
	const token = getAccessToken();
	if (!token) return;

	const meId = getCurrentPlayerId();
	const me = getCurrentPlayer();
	if (meId === null || !me?.username) return;

	clearLog();

	const msgs = await DM.listWith(active.friendId, 0, 80);
	for (const m of msgs) {
		renderMessage(m, meId, me.username);
		active.lastId = Math.max(active.lastId, m.id);
	}
	
	// Mark messages as read after loading
	if (active.lastId > 0) {
		markAsRead(active.friendId, active.lastId);
	}
}

async function pollOnce(): Promise<void> {
	if (!active) return;

	// Don't try to poll if not authenticated
	const token = getAccessToken();
	if (!token) return;

	const meId = getCurrentPlayerId();
	const me = getCurrentPlayer();
	if (meId === null || !me?.username) return;

	try {
		const msgs = await DM.listWith(active.friendId, active.lastId, 80);
		for (const m of msgs) {
			renderMessage(m, meId, me.username);
			active.lastId = Math.max(active.lastId, m.id);
		}
		
		// Mark as read since the window is open and user can see the messages
		if (active && active.lastId > 0 && msgs.length > 0) {
			markAsRead(active.friendId, active.lastId);
		}
	} catch {
		// silence
	}
}

function stopPolling(): void {
	if (pollTimer !== null) window.clearInterval(pollTimer);
	pollTimer = null;
}

function startPolling(): void {
	if (pollTimer !== null) return;
	pollTimer = window.setInterval(() => void pollOnce(), 1200);
}

async function sendNow(): Promise<void> {
	if (!active || active.blocked) return;

	const input = el<HTMLInputElement>("dm-input");
	const btn = el<HTMLButtonElement>("dm-send");
	if (!input || !btn) return;

	const body = input.value.trim();
	if (!body) return;

	input.value = "";
	btn.disabled = true;

	try {
		await DM.send(active.friendId, body);
	} catch (e: any) {
		alert(e?.message ?? "Failed to send.");
	} finally {
		btn.disabled = false;
	}
}

async function toggleBlock(): Promise<void> {
	if (!active) return;

	const btn = el<HTMLButtonElement>("dm-block");
	if (!btn) return;

	btn.disabled = true;

	try {
		const next = !active.blocked;
		await DM.setBlock(active.friendId, next);
		active.blocked = next;

		btn.textContent = next ? "UNBLOCK" : "BLOCK";
		btn.className =
			"rounded-xl border px-3 py-2 text-[0.7rem] font-semibold " +
			(next
				? "border-emerald-400/40 bg-emerald-900/15 text-emerald-100 hover:bg-emerald-900/25"
				: "border-rose-400/40 bg-rose-900/15 text-rose-100 hover:bg-rose-900/25");

		const sendBtn = el<HTMLButtonElement>("dm-send");
		const input = el<HTMLInputElement>("dm-input");
		if (sendBtn) sendBtn.disabled = next;
		if (input) input.disabled = next;
		if (input) input.placeholder = next ? "You blocked this user." : "Type a message…";
	} catch (e: any) {
		alert(e?.message ?? "Failed to toggle block.");
	} finally {
		btn.disabled = false;
	}
}

function bindUiOnce(): void {
	const close = el<HTMLButtonElement>("dm-close");
	const backdrop = el<HTMLDivElement>("dm-backdrop");
	const send = el<HTMLButtonElement>("dm-send");
	const input = el<HTMLInputElement>("dm-input");
	const block = el<HTMLButtonElement>("dm-block");

	close?.addEventListener("click", () => {
		if (active && active.lastId > 0) {
			// Save the last message ID when closing so we don't show unread again
			markAsRead(active.friendId, active.lastId);
		}
		stopPolling();
		active = null;
		showDm(false);
	});

	backdrop?.addEventListener("click", () => {
		if (active && active.lastId > 0) {
			// Save the last message ID when closing so we don't show unread again
			markAsRead(active.friendId, active.lastId);
		}
		stopPolling();
		active = null;
		showDm(false);
	});

	send?.addEventListener("click", () => void sendNow());

	input?.addEventListener("keydown", (ev) => {
		if (ev.key === "Enter") {
			ev.preventDefault();
			void sendNow();
		}
	});

	block?.addEventListener("click", () => void toggleBlock());
}

let bound = false;

export function initDmController(): void {
	if (!bound) {
		bindUiOnce();
		bound = true;
	}

	window.addEventListener("ft:dm:open", (ev: any) => {
		const d = ev?.detail ?? null;

		const friendId = d ? Number(d.friendId) : NaN;
		const username = d ? String(d.username || "") : "";

		//const avatar_kind = d && (d.avatar_kind === "upload" || d.avatar_kind === "default") ? d.avatar_kind : "default";
		//const avatar_value = d ? String(d.avatar_value || "default.png") : "default.png";

		const avatar_kind = (d?.avatar_kind === "upload" ? "upload" : "default") as "default" | "upload";
		const avatar_value = typeof d?.avatar_value === "string" ? d.avatar_value : "default.png";


		if (!Number.isInteger(friendId) || friendId <= 0 || !username) return;

		active = {
			friendId,
			username,
			avatar_kind,
			avatar_value,
			lastId: 0,
			blocked: false,
		};

		// --- header (avatar + name) ---
		const ava = el<HTMLImageElement>("dm-avatar");
		if (ava)
			ava.src = avatarSrc(active.avatar_kind, active.avatar_value);

		const name = el<HTMLElement>("dm-name");
		if (name)
			name.textContent = active.username;

		//if (name) name.textContent = username;

		const img = el<HTMLImageElement>("dm-avatar");
		if (img)
			img.src = avatarSrc(avatar_kind, avatar_value);

		const input = el<HTMLInputElement>("dm-input");
		const sendBtn = el<HTMLButtonElement>("dm-send");
		if (input) {
			input.disabled = false;
			input.placeholder = "Type a message…";
			input.value = "";
		}
		if (sendBtn) sendBtn.disabled = false;

		const blockBtn = el<HTMLButtonElement>("dm-block");
		if (blockBtn) {
			blockBtn.textContent = "BLOCK";
			blockBtn.className =
				"rounded-xl border border-rose-400/40 bg-rose-900/15 px-3 py-2 text-[0.7rem] font-semibold text-rose-100 hover:bg-rose-900/25";
		}

		showDm(true);
		stopPolling();

		// Mark as read when opening DM
		markAsRead(friendId);

		void loadInitial().then(() => startPolling());
	});
}
