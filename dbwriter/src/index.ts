import express, { Request, Response } from "express";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";


function toInt(v: unknown): number | null {
	const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
	if (!Number.isFinite(n) || n <= 0) return null;
	return Math.trunc(n);
}

function clampQuery(q: unknown): string {
	if (typeof q !== "string") return "";
	return q.trim().slice(0, 32);
}

const PORT = process.env.DBWRITER_PORT ? Number(process.env.DBWRITER_PORT) : 4000;
const DB_FILE = process.env.DATABASE_URL ?? "/app/data/database.sqlite";

let db: Database<sqlite3.Database, sqlite3.Statement>;

async function initDb() {
	const filename = DB_FILE.startsWith("file:") ? DB_FILE.replace(/^file:/, "") : DB_FILE;
	const resolved = path.resolve(filename);

	db = await open({
		filename: resolved,
		driver: sqlite3.Database
	});

	await db.exec(`
		CREATE TABLE IF NOT EXISTS player (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			mail TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			wallet_adress TEXT,
			avatar_kind TEXT NOT NULL DEFAULT 'default',
			avatar_value TEXT NOT NULL DEFAULT 'default.png',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS tournament (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			creator_id INTEGER NOT NULL,
			status INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			finished_at TIMESTAMP,
			FOREIGN KEY (creator_id) REFERENCES player(id)
		);

		CREATE TABLE IF NOT EXISTS game (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tournament_id INTEGER NOT NULL,
			player1_id INTEGER NOT NULL,
			player2_id INTEGER NOT NULL,
			score1 INTEGER DEFAULT 0,
			score2 INTEGER DEFAULT 0,
			played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (tournament_id) REFERENCES tournament(id),
			FOREIGN KEY (player1_id) REFERENCES player(id),
			FOREIGN KEY (player2_id) REFERENCES player(id)
		);

		CREATE TABLE IF NOT EXISTS tournament_competitor (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tournament_id INTEGER NOT NULL,
			player_id INTEGER NOT NULL,
			FOREIGN KEY (tournament_id) REFERENCES tournament(id),
			FOREIGN KEY (player_id) REFERENCES player(id),
			UNIQUE (tournament_id, player_id)
		);

		CREATE TABLE IF NOT EXISTS refresh_token (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			player_id INTEGER NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMP NOT NULL,
			revoked_at TIMESTAMP,
			replaced_by_hash TEXT,
			FOREIGN KEY (player_id) REFERENCES player(id)
		);

		CREATE INDEX IF NOT EXISTS idx_refresh_token_player ON refresh_token(player_id);
		CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_token(token_hash);

		CREATE TABLE IF NOT EXISTS password_reset (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			player_id INTEGER NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMP NOT NULL,
			used_at TIMESTAMP,
			FOREIGN KEY (player_id) REFERENCES player(id)
		);

		CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset(token_hash);
		CREATE INDEX IF NOT EXISTS idx_password_reset_player ON password_reset(player_id);

	`);

	try {
		await db.exec(`ALTER TABLE player ADD COLUMN last_seen_at TIMESTAMP;`);
	} catch (err: any) {
		// if column already exists:
		const msg = String(err?.message ?? err);

		if (msg.includes("duplicate column name") && msg.includes("last_seen_at")) {
			// ok
		} else {
			console.error("DB migration failed: add column player.last_seen_at:", err);
			throw err;
		}
	}

	// tables friends
	await db.exec(`
		CREATE TABLE IF NOT EXISTS friend_request (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			from_player_id INTEGER NOT NULL,
			to_player_id INTEGER NOT NULL,
			status INTEGER NOT NULL DEFAULT 0, -- 0=pending, 1=accepted, 2=rejected
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			responded_at TIMESTAMP,
			FOREIGN KEY (from_player_id) REFERENCES player(id),
			FOREIGN KEY (to_player_id) REFERENCES player(id),
			UNIQUE(from_player_id, to_player_id)
		);

		CREATE INDEX IF NOT EXISTS idx_friend_request_to_status ON friend_request(to_player_id, status);
		CREATE INDEX IF NOT EXISTS idx_friend_request_from_status ON friend_request(from_player_id, status);

		CREATE TABLE IF NOT EXISTS friendship (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			player1_id INTEGER NOT NULL,
			player2_id INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (player1_id) REFERENCES player(id),
			FOREIGN KEY (player2_id) REFERENCES player(id),
			UNIQUE(player1_id, player2_id)
		);

		CREATE INDEX IF NOT EXISTS idx_friendship_p1 ON friendship(player1_id);
		CREATE INDEX IF NOT EXISTS idx_friendship_p2 ON friendship(player2_id);
	`);


	// tables dm (direct messages + block)
	await db.exec(`
		CREATE TABLE IF NOT EXISTS dm_message (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			from_player_id INTEGER NOT NULL,
			to_player_id INTEGER NOT NULL,
			body TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (from_player_id) REFERENCES player(id),
			FOREIGN KEY (to_player_id) REFERENCES player(id)
		);

		CREATE INDEX IF NOT EXISTS idx_dm_message_pair
			ON dm_message(from_player_id, to_player_id, id);

		CREATE INDEX IF NOT EXISTS idx_dm_message_to
			ON dm_message(to_player_id, id);

		CREATE TABLE IF NOT EXISTS dm_block (
			blocker_id INTEGER NOT NULL,
			blocked_id INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY(blocker_id, blocked_id),
			FOREIGN KEY (blocker_id) REFERENCES player(id),
			FOREIGN KEY (blocked_id) REFERENCES player(id)
		);

		CREATE INDEX IF NOT EXISTS idx_dm_block_blocked
			ON dm_block(blocked_id);
	`);
}

async function startServer() {
	await initDb();
	const app = express();
	app.use(express.json());

	app.get("/health", (_req: Request, res: Response) => {
		res.json({ status: "ok", service: "dbwriter" });
	});

	// -----------------------> FrienList part --------------------->
	app.post("/presence/ping", async (req: Request, res: Response) => {
		try {
			const player_id = toInt(req.body?.player_id);
			if (!player_id) return res.status(400).json({ error: "player_id invalide" });

			const nowIso = new Date().toISOString();
			await db.run(`UPDATE player SET last_seen_at = ? WHERE id = ?`, [nowIso, player_id]);

			return res.status(204).send();
		} catch (err) {
			console.error("POST /presence/ping error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});
	app.post("/presence/offline", async (req: Request, res: Response) => {
		try {
			const player_id = toInt(req.body?.player_id);
			if (!player_id) return res.status(400).json({ error: "player_id invalide" });

			// NULL => offline immédiat côté logique (last_seen_at absent)
			await db.run(`UPDATE player SET last_seen_at = NULL WHERE id = ?`, [player_id]);

			return res.status(204).send();
		} catch (err) {
			console.error("POST /presence/offline error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});
	app.get("/players/search", async (req: Request, res: Response) => {
		try {
			const q = clampQuery(req.query?.q);
			if (q.length < 1) return res.json([]);

			// LIKE + param => no injection
			const rows = await db.all(
				`SELECT id, username, avatar_kind, avatar_value, last_seen_at FROM player
					WHERE username LIKE ? ORDER BY username ASC LIMIT 20`, [`${q}%`]
			);

			return res.json(rows);
		} catch (err) {
			console.error("GET /players/search error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});
	app.post("/friends/requests", async (req: Request, res: Response) => {
		try {
			const from_id = toInt(req.body?.from_id);
			const to_id = toInt(req.body?.to_id);
			if (!from_id || !to_id) return res.status(400).json({ error: "from_id/to_id invalides" });
			if (from_id === to_id) return res.status(400).json({ error: "Impossible de s'ajouter soi-même" });

			// Verify player existence
			const a = await db.get(`SELECT id FROM player WHERE id = ?`, [from_id]);
			const b = await db.get(`SELECT id FROM player WHERE id = ?`, [to_id]);
			if (!a || !b) return res.status(404).json({ error: "Player not found" });

			// verify if already friends
			const p1 = Math.min(from_id, to_id);
			const p2 = Math.max(from_id, to_id);

			const already = await db.get(
				`SELECT 1 FROM friendship WHERE player1_id = ? AND player2_id = ? LIMIT 1`,
				[p1, p2]
			);
			if (already) return res.status(409).json({ error: "Déjà amis" });

			// Inverse pending request exists? (B -> A)
			const inverse = await db.get(
				`SELECT id, status FROM friend_request WHERE from_player_id = ? AND to_player_id = ?`,
				[to_id, from_id]
			);

			if (inverse && inverse.status === 0) {
				return res.status(409).json({ error: "Une demande inverse existe déjà (pending)" });
			}

			// Same-direction existing request?
			const existing = await db.get(
				`SELECT id, status FROM friend_request WHERE from_player_id = ? AND to_player_id = ?`,
				[from_id, to_id]
			);

			if (existing) {
				if (existing.status === 0) {
					return res.status(409).json({ error: "Demande déjà en attente" });
				}
				if (existing.status === 2) {
					await db.run(
					`UPDATE friend_request
					SET status = 0, created_at = CURRENT_TIMESTAMP, responded_at = NULL
					WHERE id = ?`,
					[existing.id]
					);

					const revived = await db.get(
					`SELECT id, from_player_id, to_player_id, status, created_at, responded_at
					FROM friend_request WHERE id = ?`,
					[existing.id]
					);
					return res.status(201).json(revived);
				}
				// status === 1
				return res.status(409).json({ error: "Déjà acceptée" });
			}

			const result = await db.run(
				`INSERT INTO friend_request(from_player_id, to_player_id, status)
					VALUES (?, ?, 0)`, [from_id, to_id]
			);

			const created = await db.get(
				`SELECT id, from_player_id, to_player_id, status, created_at, responded_at
					FROM friend_request WHERE id = ?`, [result.lastID]
			);

			return res.status(201).json(created);
		} catch (err: any) {
			console.error("POST /friends/requests error:", err);
			if (String(err?.message || "").includes("UNIQUE constraint failed")) {
				return res.status(409).json({ error: "Demande déjà existante" });
			}
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});
	app.get("/friends/requests/incoming/:playerId", async (req: Request, res: Response) => {
		try {
			const playerId = toInt(req.params.playerId);
			if (!playerId) return res.status(400).json({ error: "ID invalide" });

			const rows = await db.all(
				`SELECT fr.id, fr.from_player_id,
					p.username as from_username,
					p.avatar_kind as from_avatar_kind,
					p.avatar_value as from_avatar_value,
					fr.created_at FROM friend_request fr JOIN player p ON p.id = fr.from_player_id
					WHERE fr.to_player_id = ? AND fr.status = 0 ORDER BY fr.created_at DESC`,
				[playerId]
			);

			return res.json(rows);
		} catch (err) {
			console.error("GET /friends/requests/incoming/:playerId error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});
	app.get("/friends/requests/outgoing/:playerId", async (req: Request, res: Response) => {
		try {
			const playerId = toInt(req.params.playerId);
			if (!playerId) return res.status(400).json({ error: "ID invalide" });

			const rows = await db.all(
				`SELECT fr.id, fr.to_player_id,
					p.username as to_username,
					p.avatar_kind as to_avatar_kind,
					p.avatar_value as to_avatar_value,
					fr.created_at
				FROM friend_request fr
				JOIN player p ON p.id = fr.to_player_id
				WHERE fr.from_player_id = ? AND fr.status = 0
				ORDER BY fr.created_at DESC`,
				[playerId]
			);

			return res.json(rows);
		} catch (err) {
			console.error("GET /friends/requests/outgoing/:playerId error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});
	app.post("/friends/requests/:requestId/respond", async (req: Request, res: Response) => {
		try {
			const requestId = toInt(req.params.requestId);
			const player_id = toInt(req.body?.player_id);
			const accept = req.body?.accept === true;

			if (!requestId || !player_id) return res.status(400).json({ error: "Paramètres invalides" });

			const fr = await db.get(
				`SELECT id, from_player_id, to_player_id, status FROM friend_request WHERE id = ?`,
				[requestId]
			);
			if (!fr) return res.status(404).json({ error: "Request not found" });
			if (fr.to_player_id !== player_id) return res.status(403).json({ error: "Forbidden" });
			if (fr.status !== 0) return res.status(409).json({ error: "Déjà répondu" });

			if (!accept) {
				await db.run(
					`UPDATE friend_request SET status = 2, responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
					[requestId]
				);
				return res.status(204).send();
			}

			// accept
			const a = fr.from_player_id;
			const b = fr.to_player_id;
			const p1 = Math.min(a, b);
			const p2 = Math.max(a, b);

			await db.exec("BEGIN");
			try {
				await db.run(
					`UPDATE friend_request SET status = 1, responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
					[requestId]
				);

				await db.run(
					`INSERT INTO friendship(player1_id, player2_id) VALUES (?, ?)`, [p1, p2]
				);

				await db.exec("COMMIT");
			} catch (e) {
				await db.exec("ROLLBACK");
				throw e;
			}

			return res.status(204).send();
		} catch (err: any) {
			console.error("POST /friends/requests/:requestId/respond error:", err);
			if (String(err?.message || "").includes("UNIQUE constraint failed")) {
				return res.status(409).json({ error: "Déjà amis" });
			}
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});
	// La table friendship est normalisée (p1<p2). Pour obtenir “mes amis”, il faut : je suis p1 → ami=p2, je suis p2 → ami=p1
	app.get("/friends/list/:playerId", async (req: Request, res: Response) => {
		try {
			const playerId = toInt(req.params.playerId);
			if (!playerId) return res.status(400).json({ error: "ID invalide" });

			const rows = await db.all(
				`SELECT
					CASE
						WHEN f.player1_id = ? THEN f.player2_id
						ELSE f.player1_id
					END AS friend_id,
					p.username,
					p.avatar_kind,
					p.avatar_value,
					p.last_seen_at
				FROM friendship f JOIN player p ON p.id = (
				CASE
					WHEN f.player1_id = ? THEN f.player2_id
					ELSE f.player1_id END)
				WHERE f.player1_id = ? OR f.player2_id = ? ORDER BY p.username ASC`,
				[playerId, playerId, playerId, playerId]
			);

			return res.json(rows);
		} catch (err) {
			console.error("GET /friends/list/:playerId error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});
	// DELETE friendship + reset friend_request to "rejected" so it can be re-requested later
	app.delete("/friends/:playerId/:friendId", async (req: Request, res: Response) => {
		try {
			const playerId = toInt(req.params.playerId);
			const friendId = toInt(req.params.friendId);
			if (!playerId || !friendId)
				return res.status(400).json({ error: "IDs invalides" });
			if (playerId === friendId)
				return res.status(400).json({ error: "Impossible" });

			// optional: verify existence (defensive)
			const a = await db.get(`SELECT id FROM player WHERE id = ?`, [playerId]);
			const b = await db.get(`SELECT id FROM player WHERE id = ?`, [friendId]);
			if (!a || !b) return res.status(404).json({ error: "Player not found" });

			const p1 = Math.min(playerId, friendId);
			const p2 = Math.max(playerId, friendId);

			await db.exec("BEGIN");
			try {
				// 1) delete friendship row (idempotent)
				await db.run(
					`DELETE FROM friendship WHERE player1_id = ? AND player2_id = ?`,
					[p1, p2]
				);

				// delete DM history both directions
				await db.run(
					`DELETE FROM dm_message
					WHERE (from_player_id = ? AND to_player_id = ?)
						OR (from_player_id = ? AND to_player_id = ?)`,
					[playerId, friendId, friendId, playerId]
				);

				// 2) IMPORTANT: reset any accepted request between them
				// Otherwise status=1 would block future requests ("Déjà acceptée").
				await db.run(
					`UPDATE friend_request
					SET status = 2, responded_at = CURRENT_TIMESTAMP
					WHERE (
					(from_player_id = ? AND to_player_id = ?)
					OR (from_player_id = ? AND to_player_id = ?)
					)
					AND status = 1`,
					[playerId, friendId, friendId, playerId]
				);

				await db.exec("COMMIT");
			} catch (e) {
				await db.exec("ROLLBACK");
				throw e;
			}

			return res.status(204).send();
		} catch (err) {
			console.error("DELETE /friends/:playerId/:friendId error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});

	// -------   Messenger Functions -------------------------------
	function normPair(a: number, b: number): [number, number] {
		return a < b ? [a, b] : [b, a];
	}

	async function assertFriends(db: any, a: number, b: number): Promise<boolean> {
		const [p1, p2] = normPair(a, b);
		const row = await db.get(
			`SELECT 1 FROM friendship WHERE player1_id = ? AND player2_id = ? LIMIT 1`,
			[p1, p2]
		);
		return !!row;
	}

	async function isBlocked(db: any, fromId: number, toId: number): Promise<boolean> {
		// When blocking, no matter the direction => We refuse exchange
		const row = await db.get(
			`SELECT 1 FROM dm_block
			WHERE (blocker_id = ? AND blocked_id = ?)
				OR (blocker_id = ? AND blocked_id = ?)
			LIMIT 1`,
			[fromId, toId, toId, fromId]
		);
		return !!row;
	}
	// ----------------------------------------->>

	// ----------  Messenger Roads  -----------------------
	// Conversation History
	app.get("/dm/with/:me/:other", async (req: Request, res: Response) => {
		try {
			const me = Number(req.params.me);
			const other = Number(req.params.other);
			const after = req.query.after ? Number(req.query.after) : 0;
			const limitRaw = req.query.limit ? Number(req.query.limit) : 50;
			const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

			if (!Number.isInteger(me) || !Number.isInteger(other) || me <= 0 || other <= 0) {
				return res.status(400).json({ error: "invalid ids" });
			}

			// Only with friends in the friendlist
			const okFriends = await assertFriends(db, me, other);
			if (!okFriends) return res.status(403).json({ error: "not friends" });

			// If blocking
			if (await isBlocked(db, me, other))
				return res.status(403).json({ error: "blocked" });

			const rows = await db.all(
				`SELECT id, from_player_id, to_player_id, body, created_at
				FROM dm_message
				WHERE (
					(from_player_id = ? AND to_player_id = ?)
					OR (from_player_id = ? AND to_player_id = ?)
				)
				AND id > ?
				ORDER BY id ASC
				LIMIT ?`,
				[me, other, other, me, after, limit]
			);

			return res.json(rows);
		} catch (err) {
			console.error("GET /dm/with/:me/:other error:", err);
			return res.status(500).json({ error: "internal error" });
		}
	});

	// Send a message
	app.post("/dm/send", async (req: Request, res: Response) => {
		try {
			const from_id = Number(req.body?.from_id);
			const to_id = Number(req.body?.to_id);
			const body = String(req.body?.body ?? "").trim();

			if (!Number.isInteger(from_id) || !Number.isInteger(to_id) || from_id <= 0 || to_id <= 0) {
				return res.status(400).json({ error: "invalid ids" });
			}
			if (!body || body.length > 500) {
				return res.status(400).json({ error: "invalid body" });
			}

			const okFriends = await assertFriends(db, from_id, to_id);
			if (!okFriends) 
				return res.status(403).json({ error: "not friends" });

			if (await isBlocked(db, from_id, to_id)) return res.status(403).json({ error: "blocked" });

			const r = await db.run(
				`INSERT INTO dm_message(from_player_id, to_player_id, body)
				VALUES (?, ?, ?)`,
				[from_id, to_id, body]
			);

			// sqlite: lastID
			return res.status(201).json({ id: r.lastID });
		} catch (err) {
			console.error("POST /dm/send error:", err);
			return res.status(500).json({ error: "internal error" });
		}
	});

	// Blocking / Unblocking
	app.post("/dm/block", async (req: Request, res: Response) => {
		try {
			const blocker_id = Number(req.body?.blocker_id);
			const blocked_id = Number(req.body?.blocked_id);
			const block = !!req.body?.block;

			if (!Number.isInteger(blocker_id) || !Number.isInteger(blocked_id) || blocker_id <= 0 || blocked_id <= 0) {
				return res.status(400).json({ error: "invalid ids" });
			}

			if (block) {
				await db.run(
					`INSERT OR IGNORE INTO dm_block(blocker_id, blocked_id) VALUES (?, ?)`,
					[blocker_id, blocked_id]
				);
			} else {
				await db.run(
					`DELETE FROM dm_block WHERE blocker_id = ? AND blocked_id = ?`,
					[blocker_id, blocked_id]
				);
			}

			return res.status(204).end();
		} catch (err) {
			console.error("POST /dm/block error:", err);
			return res.status(500).json({ error: "internal error" });
		}
	});


	// ----------------------------------------->>

	app.post("/players", async (req: Request, res: Response) => {
		try {
		const { username, mail, password_hash, wallet_adress } = req.body;

		if (!username || !mail || !password_hash) {
			return res.status(400).json({ error: "username, mail et password_hash sont requis" });
		}

		if (typeof password_hash !== "string" || password_hash.length < 20) {
			return res.status(400).json({ error: "password_hash invalide" });
		}

		const result = await db.run(
			`INSERT INTO player (username, mail, password_hash, wallet_adress) VALUES (?, ?, ?, ?)`,
			[username, mail, password_hash, wallet_adress ?? null]
		);

		const created = await db.get("SELECT id, username, mail, wallet_adress, created_at FROM player WHERE id = ?", [result.lastID]);
		res.status(201).json(created);
		} catch (err: any) {
		console.error("POST /players error:", err);
		if (err.message.includes("UNIQUE constraint failed")) {
			res.status(409).json({ error: "username ou mail déjà utilisé" });
		} else {
			res.status(500).json({ error: "Erreur interne du serveur" });
		}
		}
	});

	app.get("/players", async (_req: Request, res: Response) => {
		try {
		const players = await db.all("SELECT id, username, mail, wallet_adress, created_at FROM player ORDER BY id ASC");
		res.json(players);
		} catch (err) {
		console.error("GET /players error:", err);
		res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});

	// --- Get player by ID ---
	app.patch("/players/:id", async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) return res.status(400).json({ error: "ID invalide" });

		const { username, wallet_adress, avatar_kind, avatar_value } = req.body ?? {};

		// whitelist stricte
		const fields: string[] = [];
		const values: any[] = [];

		if (typeof username === "string") {
			if (username.trim().length < 1 || username.length > 32) return res.status(400).json({ error: "username invalide" });
			fields.push("username = ?");
			values.push(username.trim());
		}

		if (typeof wallet_adress === "string" || wallet_adress === null) {
			fields.push("wallet_adress = ?");
			values.push(wallet_adress ?? null);
		}

		if (typeof avatar_kind === "string") {
			if (!["default", "upload"].includes(avatar_kind)) return res.status(400).json({ error: "avatar_kind invalide" });
			fields.push("avatar_kind = ?");
			values.push(avatar_kind);
		}

		if (typeof avatar_value === "string") {
			if (avatar_value.length > 200_000) return res.status(400).json({ error: "avatar_value trop gros" }); // garde-fou
			fields.push("avatar_value = ?");
			values.push(avatar_value);
		}

		if (fields.length === 0) return res.status(400).json({ error: "Aucun champ modifiable fourni" });

		try {
			const sql = `UPDATE player SET ${fields.join(", ")} WHERE id = ?`;
			values.push(id);

			await db.run(sql, values);

			const updated = await db.get(
			"SELECT id, username, mail, wallet_adress, avatar_kind, avatar_value, created_at FROM player WHERE id = ?",
			[id]
			);
			if (!updated) return res.status(404).json({ error: "Joueur non trouvé" });

			return res.json(updated);
		} catch (err: any) {
			if (err.message?.includes("UNIQUE constraint failed")) {
			return res.status(409).json({ error: "username déjà utilisé" });
			}
			console.error("PATCH /players/:id error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});

	// Get joueur avec hash (pour change password)
	app.get("/players/private/:id", async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) return res.status(400).json({ error: "ID invalide" });

		try {
			const player = await db.get(
			"SELECT id, username, mail, password_hash, wallet_adress, avatar_kind, avatar_value, created_at FROM player WHERE id = ?",
			[id]
			);
			if (!player) return res.status(404).json({ error: "Joueur non trouvé" });
			return res.json(player);
		} catch (err) {
			console.error("GET /players/private/:id error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});

	// Put password-hash (pour change-password et reset password)
	app.put("/players/:id/password", async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) return res.status(400).json({ error: "ID invalide" });

		const { password_hash } = req.body ?? {};
		if (typeof password_hash !== "string" || password_hash.length < 20) {
			return res.status(400).json({ error: "password_hash invalide" });
		}

		try {
			await db.run("UPDATE player SET password_hash = ? WHERE id = ?", [password_hash, id]);
			return res.json({ success: true });
		} catch (err) {
			console.error("PUT /players/:id/password error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});

	// Password reset
	app.post("/password-reset/issue", async (req: Request, res: Response) => {
		const { player_id, token_hash, expires_at } = req.body ?? {};
		if (!player_id || typeof token_hash !== "string" || typeof expires_at !== "string") {
			return res.status(400).json({ error: "player_id, token_hash, expires_at requis" });
		}

		try {
			await db.run(
			"INSERT INTO password_reset (player_id, token_hash, expires_at) VALUES (?, ?, ?)",
			[player_id, token_hash, expires_at]
			);
			return res.status(201).json({ success: true });
		} catch (err: any) {
			if (err.message?.includes("UNIQUE constraint failed")) return res.status(409).json({ error: "token collision" });
			console.error("POST /password-reset/issue error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
		});

	app.post("/password-reset/consume", async (req: Request, res: Response) => {
		const { token_hash } = req.body ?? {};
		if (typeof token_hash !== "string" || !token_hash) return res.status(400).json({ error: "token_hash requis" });

		const nowIso = new Date().toISOString();

		try {
			await db.exec("BEGIN");

			const row = await db.get(
			`SELECT id, player_id, expires_at, used_at
			FROM password_reset
			WHERE token_hash = ?
			LIMIT 1`,
			[token_hash]
			);

			if (!row) { await db.exec("ROLLBACK"); return res.status(401).json({ error: "invalid" }); }
			if (row.used_at) { await db.exec("ROLLBACK"); return res.status(401).json({ error: "used" }); }
			if (row.expires_at <= nowIso) { await db.exec("ROLLBACK"); return res.status(401).json({ error: "expired" }); }

			const upd = await db.run(
			"UPDATE password_reset SET used_at = ? WHERE token_hash = ? AND used_at IS NULL",
			[nowIso, token_hash]
			);

			const changes = upd.changes ?? 0;
			if (changes === 0) { await db.exec("ROLLBACK"); return res.status(401).json({ error: "invalid" }); }

			await db.exec("COMMIT");
			return res.json({ player_id: row.player_id });
		} catch (err) {
			console.error("POST /password-reset/consume error:", err);
			await db.exec("ROLLBACK").catch((e: any) => {console.error("ROLLBACK failed:", e);});
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});

	app.get("/players/:id", async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) return res.status(400).json({ error: "ID invalide" });

		try {
		const player = await db.get("SELECT id, username, mail, wallet_adress, avatar_kind, avatar_value, created_at FROM player WHERE id = ?", [id]);
		
		if (!player) return res.status(404).json({ error: "Joueur non trouvé" });
		res.json(player);
		} catch (err) {
		console.error("GET /players/:id error:", err);
		res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});

	app.delete("/players/:id", async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		if (Number.isNaN(id)) return res.status(400).json({ error: "ID invalide" });

		try {
		const result = await db.run("DELETE FROM player WHERE id = ?", [id]);
		if (result.changes === 0) return res.status(404).json({ error: "Joueur non trouvé" });
		res.json({ success: true });
		} catch (err) {
		console.error("DELETE /players/:id error:", err);
		res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});

	app.get("/players/by-mail/:mail", async (req: Request, res: Response) => {
		const mail = String(req.params.mail || "").trim();
		if (!mail) return res.status(400).json({ error: "mail requis" });

		try {
			const player = await db.get(
			"SELECT id, username, mail, password_hash, wallet_adress, created_at FROM player WHERE mail = ?",
			[mail]
			);
			if (!player) return res.status(404).json({ error: "Joueur non trouvé" });
			res.json(player);
		} catch (err) {
			console.error("GET /players/by-mail/:mail error:", err);
			res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});


	// --- Issue refresh token (insert) ---
	app.post("/refresh/issue", async (req: Request, res: Response) => {
	try {
		const { player_id, token_hash, expires_at } = req.body;

		if (!player_id || typeof token_hash !== "string" || typeof expires_at !== "string") {
		return res.status(400).json({ error: "player_id, token_hash, expires_at requis" });
		}

		await db.run(
		`INSERT INTO refresh_token (player_id, token_hash, expires_at) VALUES (?, ?, ?)`,
		[player_id, token_hash, expires_at]
		);

		return res.status(201).json({ success: true });
	} catch (err: any) {
		console.error("POST /refresh/issue error:", err);
		if (err.message?.includes("UNIQUE constraint failed")) {
		return res.status(409).json({ error: "token_hash déjà utilisé" });
		}
		return res.status(500).json({ error: "Erreur interne du serveur" });
	}
	});

	// --- Lookup refresh token (validity check) ---
	app.post("/refresh/lookup", async (req: Request, res: Response) => {
	try {
		const { token_hash } = req.body;
		if (typeof token_hash !== "string" || !token_hash) {
		return res.status(400).json({ error: "token_hash requis" });
		}

		const row = await db.get(
		`SELECT id, player_id, token_hash, expires_at, revoked_at, replaced_by_hash
		FROM refresh_token
		WHERE token_hash = ?
		LIMIT 1`,
		[token_hash]
		);

		if (!row) return res.status(404).json({ error: "not found" });
		if (row.revoked_at) return res.status(401).json({ error: "revoked" });

		// SQLite compare timestamp strings OK si on utilise ISO (on va envoyer ISO depuis authservice)
		const nowIso = new Date().toISOString();
		if (row.expires_at <= nowIso) return res.status(401).json({ error: "expired" });

		return res.json({ player_id: row.player_id, expires_at: row.expires_at });
	} catch (err) {
		console.error("POST /refresh/lookup error:", err);
		return res.status(500).json({ error: "Erreur interne du serveur" });
	}
	});

	// --- Rotate refresh token (atomic) ---
	app.post("/refresh/rotate", async (req: Request, res: Response) => {
	const { old_token_hash, new_token_hash, new_expires_at } = req.body;

	if (
		typeof old_token_hash !== "string" || !old_token_hash ||
		typeof new_token_hash !== "string" || !new_token_hash ||
		typeof new_expires_at !== "string" || !new_expires_at
	) {
		return res.status(400).json({ error: "old_token_hash, new_token_hash, new_expires_at requis" });
	}

	const nowIso = new Date().toISOString();

	try {
		await db.exec("BEGIN");

		const oldRow = await db.get(
		`SELECT id, player_id, expires_at, revoked_at
		FROM refresh_token
		WHERE token_hash = ?
		LIMIT 1`,
		[old_token_hash]
		);

		if (!oldRow) {
		await db.exec("ROLLBACK");
		return res.status(401).json({ error: "invalid refresh" });
		}

		if (oldRow.revoked_at) {
		await db.exec("ROLLBACK");
		return res.status(401).json({ error: "revoked refresh" });
		}

		if (oldRow.expires_at <= nowIso) {
		await db.exec("ROLLBACK");
		return res.status(401).json({ error: "expired refresh" });
		}

		// Revoke old (only if still active)
		const upd = await db.run(
		`UPDATE refresh_token
		SET revoked_at = ?, replaced_by_hash = ?
		WHERE token_hash = ? AND revoked_at IS NULL`,
		[nowIso, new_token_hash, old_token_hash]
		);

		const updChanges = upd.changes ?? 0;
		if (updChanges === 0) {
		await db.exec("ROLLBACK");
		return res.status(401).json({ error: "invalid refresh" });
		}

		// Insert new token
		await db.run(
		`INSERT INTO refresh_token (player_id, token_hash, expires_at) VALUES (?, ?, ?)`,
		[oldRow.player_id, new_token_hash, new_expires_at]
		);

		await db.exec("COMMIT");
		return res.json({ player_id: oldRow.player_id });
	} catch (err: any) {
		console.error("POST /refresh/rotate error:", err);
		await db.exec("ROLLBACK").catch((e: any) => {console.error("ROLLBACK failed:", e);});
		if (err.message?.includes("UNIQUE constraint failed")) {
		return res.status(409).json({ error: "token collision" });
		}
		return res.status(500).json({ error: "Erreur interne du serveur" });
	}
	});

	// --- Revoke refresh token (logout) ---
	app.post("/refresh/revoke", async (req: Request, res: Response) => {
		try 
		{
			const { token_hash } = req.body;
			if (typeof token_hash !== "string" || !token_hash) {
				return res.status(400).json({ error: "token_hash requis" });
			}

			const nowIso = new Date().toISOString();

			const result = await db.run(
				`UPDATE refresh_token 
				SET revoked_at = ?
				WHERE token_hash = ? AND revoked_at IS NULL`,
			[nowIso, token_hash]
			);

			const changes = result.changes ?? 0;

			return res.json({ success: true, revoked: changes > 0 });
		} catch (err) {
			console.error("POST /refresh/revoke error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});


	// Revoke ALL refresh tokens (Security on change-password)
	app.post("/refresh/revoke-all", async (req: Request, res: Response) => {
		try {
			const { player_id } = req.body ?? {};
			const pid = Number(player_id);
			
			if (!Number.isFinite(pid) || pid <= 0) {
			return res.status(400).json({ error: "player_id requis" });
			}

			const nowIso = new Date().toISOString();

			const result = await db.run(
			`UPDATE refresh_token
			SET revoked_at = ?
			WHERE player_id = ? AND revoked_at IS NULL`,
			[nowIso, pid]
			);

			const changes = result.changes ?? 0;
			return res.json({ success: true, revoked_count: changes });
		} catch (err) {
			console.error("POST /refresh/revoke-all error:", err);
			return res.status(500).json({ error: "Erreur interne du serveur" });
		}
	});



	app.listen(PORT, () => {
		console.log(`✅ dbwriter launch: port ${PORT} — DB : ${DB_FILE}`);
	});
}

startServer().catch((err) => {
	console.error("❌ dbwriter cannot launch :", err);
	process.exit(1);
});
