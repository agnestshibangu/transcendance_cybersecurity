
// authservice/src/main.ts
import Fastify, { FastifyInstance, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
import jwt from "@fastify/jwt";
import * as bcrypt from 'bcryptjs';
import cookie from "@fastify/cookie";
import crypto from "node:crypto";

// A METTRE EN VAR GLOBALE
const GOOGLE_CLIENT_ID = '138277743642-pj6hbjspm5ss2obl70ktbnt1obf8v8mt.apps.googleusercontent.com';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

type RegisterBody = {
	username: string;
	mail: string;
	password: string;
	wallet_adress?: string | null;
};

type LoginBody = {
	mail: string;
	password: string;
};

type GoogleLoginBody = {
	token: string;
};

const registerSchema = {
	body: {
		type: "object",
		required: ["username", "mail", "password"],
		additionalProperties: false,
		properties: {
		username: { type: "string", minLength: 1, maxLength: 32 },
		mail: { type: "string", minLength: 3, maxLength: 254 },
		password: { type: "string", minLength: 8, maxLength: 128 },
		wallet_adress: { type: ["string", "null"], maxLength: 256 },
		},
	},
} as const;

const loginSchema = {
	body: {
		type: "object",
		required: ["mail", "password"],
		additionalProperties: false,
		properties: {
			mail: { type: "string", minLength: 3, maxLength: 254 },
			password: { type: "string", minLength: 1, maxLength: 128 },
		},
	},
} as const;

const googleLoginSchema = {
  body: {
    type: "object",
    required: ["token"],
    properties: {
      token: { type: "string", minLength: 10 },
    },
    additionalProperties: false,
  },
} as const;


const patchProfileSchema = {
	body: {
		type: "object",
		additionalProperties: false,
		properties: {
			username: { type: "string", minLength: 1, maxLength: 32 },
			wallet_adress: { type: ["string", "null"], maxLength: 256 },
			avatar_kind: { type: "string", enum: ["default", "upload"] },
			avatar_value: { type: "string", minLength: 1, maxLength: 200000 },
		},
	},
} as const;

const changePasswordSchema = {
	body: {
		type: "object",
		required: ["old_password", "new_password"],
		additionalProperties: false,
		properties: {
			old_password: { type: "string", minLength: 1, maxLength: 128 },
			new_password: { type: "string", minLength: 8, maxLength: 128 },
		},
	},
} as const;

const forgotRequestSchema = {
	body: {
		type: "object",
		required: ["mail"],
		additionalProperties: false,
		properties: {
			mail: { type: "string", minLength: 3, maxLength: 254 },
		},
	},
} as const;

const forgotResetSchema = {
	body: {
		type: "object",
		required: ["token", "new_password"],
		additionalProperties: false,
		properties: {
			token: { type: "string", minLength: 10, maxLength: 500 },
			new_password: { type: "string", minLength: 8, maxLength: 128 },
		},
	},
} as const;



function sha256Hex(input: string): string {
	return crypto.createHash("sha256").update(input).digest("hex");
}

function makeRefreshToken(): string {
	// 32 bytes => très solide, format URL-safe
	return crypto.randomBytes(32).toString("base64url");
}

function addDaysIso(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toISOString();
}


async function buildServer(): Promise<FastifyInstance> {
	const app = Fastify({ 
		logger: true,
		ajv: {
			customOptions: {
				removeAdditional: false, // <-- au lieu de supprimer, AJV va rejeter
			},
		},
	});

	const JWT_SECRET = process.env.JWT_SECRET;
	if (!JWT_SECRET) {
		// Si tu démarres sans secret, c’est une config cassée.
		// Mieux vaut crash que tourner "en mode insecure" sans le dire.
		throw new Error("JWT_SECRET is missing");
	}

	const DBWRITER_URL = process.env.DBWRITER_URL ?? "http://dbwriter:4000";

	async function dbFetch(req: any, reply: any, path: string, init: RequestInit = {}) {
		const headers = new Headers(init.headers || {});
		if (init.body && !headers.has("Content-Type")) {
			headers.set("Content-Type", "application/json");
		}

		const resp = await fetch(`${DBWRITER_URL}${path}`, { ...init, headers });

		if (!resp.ok && resp.status !== 204) {
			const text = await resp.text().catch(() => "");
			req.log.error({ status: resp.status, text, path }, "DBWriter call failed");
		}
		return resp;
	}


	const ACCESS_TTL = "15m";
	const REFRESH_DAYS = 7;

	// Important: le navigateur voit l'URL externe /api/auth/*
	// Donc Path doit matcher cette URL externe.
	const REFRESH_COOKIE_NAME = "refresh_token";
	const REFRESH_COOKIE_PATH = "/api/auth";


	function setRefreshCookie(reply: any, token: string) {
		reply.setCookie(REFRESH_COOKIE_NAME, token, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: REFRESH_COOKIE_PATH,
			maxAge: REFRESH_DAYS * 24 * 60 * 60, // en secondes
		});
	}

	function clearRefreshCookie(reply: any) {
		reply.clearCookie(REFRESH_COOKIE_NAME, {
			path: REFRESH_COOKIE_PATH,
		});
	}




	// Plugin JWT Fastify
	await app.register(jwt, { secret: JWT_SECRET });

	await app.register(cookie);

	// Helper: protège les routes via JWT
	app.decorate("authenticate", async (req: any, reply: any) => {
		try {
		await req.jwtVerify();
		} catch {
		return reply.status(401).send({ error: "Unauthorized" });
		}
	});

	app.get("/", async () => ({
		status: "ok",
		service: "authservice",
		message: "Auth service is running!",
	}));

	app.get("/health", async () => ({
		status: "ok",
		service: "authservice",
		timestamp: new Date().toISOString(),
	}));

	app.post("/register", { schema: registerSchema },
		async (req: FastifyRequest<{ Body: RegisterBody }>, reply) => {
			const body = req.body;

		// 1) Hash du password (bcrypt)
		const password_hash = await bcrypt.hash(body.password, 10);

		// 2) Création dans DBWriter
		const resp = await fetch(`${DBWRITER_URL}/players`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: body.username,
				mail: body.mail,
				password_hash,
				wallet_adress: body.wallet_adress ?? null,
			}),
		});

		if (resp.status === 409) {
			const data = await resp.json().catch(() => ({}));
			return reply.status(409).send(data.error ? data : { error: "username ou mail déjà utilisé" });
		}

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			req.log.error({ status: resp.status, text }, "DBWriter register failed");
			return reply.status(502).send({ error: "DBWriter error" });
		}

		const created = await resp.json();

		const safePlayer = {
			id: created.id,
			username: created.username,
			mail: created.mail,
			wallet_adress: created.wallet_adress ?? null,
			created_at: created.created_at,
		};


		// 0) Refresh token (cookie) + DB
		const refreshToken = makeRefreshToken();
		const refreshHash = sha256Hex(refreshToken);
		const refreshExpiresAt = addDaysIso(REFRESH_DAYS);

		const issueResp = await fetch(`${DBWRITER_URL}/refresh/issue`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				player_id: safePlayer.id,
				token_hash: refreshHash,
				expires_at: refreshExpiresAt,
			}),
		});

		if (!issueResp.ok) {
			const text = await issueResp.text().catch(() => "");
			req.log.error({ status: issueResp.status, text }, "DBWriter refresh issue failed");
			return reply.status(502).send({ error: "DBWriter error" });
		}

		setRefreshCookie(reply, refreshToken);



		// 3) JWT (payload minimal)
		const token = app.jwt.sign(
			{ sub: safePlayer.id, username: safePlayer.username, mail: safePlayer.mail },
			{ expiresIn: ACCESS_TTL }
		);


		return reply.status(201).send({
			access_token: token,
			player: safePlayer, // ne contient pas password_hash (DBWriter ne doit pas le renvoyer sur /players)
		});
		}
	);

	/**
	 * POST /auth/login
	 * - Récupère password_hash depuis DBWriter via mail
	 * - Compare bcrypt
	 * - Retourne JWT
	 */
	app.post("/login", { schema: loginSchema },
		async (req: FastifyRequest<{ Body: LoginBody }>, reply) => {
		const body = req.body;

		// 1) Charger le player + hash depuis DBWriter
		const resp = await fetch(`${DBWRITER_URL}/players/by-mail/${encodeURIComponent(body.mail)}`);

		if (resp.status === 404) {
			return reply.status(401).send({ error: "Invalid credentials" });
		}

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			req.log.error({ status: resp.status, text }, "DBWriter lookup failed");
			return reply.status(502).send({ error: "DBWriter error" });
		}

		const player = await resp.json();

		if (typeof player.password_hash !== "string" || player.password_hash.length < 20) {
			req.log.error({ player }, "DBWriter returned invalid player payload");
			return reply.status(502).send({ error: "DBWriter invalid payload" });
		}

		// 2) Compare bcrypt
		const ok = await bcrypt.compare(body.password, player.password_hash);
		if (!ok) {
			return reply.status(401).send({ error: "Invalid credentials" });
		}

		// On renvoie un player "safe" (sans hash)
		const safePlayer = {
			id: player.id,
			username: player.username,
			mail: player.mail,
			wallet_adress: player.wallet_adress ?? null,
			created_at: player.created_at,
		};

		const refreshToken = makeRefreshToken();
		const refreshHash = sha256Hex(refreshToken);
		const refreshExpiresAt = addDaysIso(REFRESH_DAYS);

		const issueResp = await fetch(`${DBWRITER_URL}/refresh/issue`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				player_id: safePlayer.id,
				token_hash: refreshHash,
				expires_at: refreshExpiresAt,
			}),
		});

		if (!issueResp.ok) {
			const text = await issueResp.text().catch(() => "");
			req.log.error({ status: issueResp.status, text }, "DBWriter refresh issue failed");
			return reply.status(502).send({ error: "DBWriter error" });
		}

		setRefreshCookie(reply, refreshToken);

		// 3) JWT
		const token = app.jwt.sign(
			{ sub: safePlayer.id, username: safePlayer.username, mail: safePlayer.mail },
			{ expiresIn: ACCESS_TTL }
		);

		return reply.send({ access_token: token, player: safePlayer });
		}
	);

	/**
	 * POST /auth/google-login
	 * - auth google
	 */
	app.post(
  		"/google-login",
		{ schema: googleLoginSchema },
		async (req: FastifyRequest<{ Body: GoogleLoginBody }>, reply) => {

		const { token } = req.body;

		// 1) Vérification du token Google
		let payload;
		try {
			const ticket = await client.verifyIdToken({
			idToken: token,
			audience: GOOGLE_CLIENT_ID,
			});
			payload = ticket.getPayload();
		} catch (err) {
			req.log.warn(err, "Invalid Google token");
			return reply.status(401).send({ error: "Invalid credentials" });
		}

		if (!payload?.email) {
			return reply.status(401).send({ error: "Invalid credentials" });
		}

		const email = payload.email;

		// 2) Récupérer ou créer le player via DBWriter
		let player;

		const resp = await fetch(
			`${DBWRITER_URL}/players/by-mail/${encodeURIComponent(email)}`
		);

		if (resp.status === 404) {
			// création si inexistant
			const randomPassword = crypto.randomBytes(16).toString("hex"); // 32 caractères hex
			const password_hash = await bcrypt.hash(randomPassword, 10);

			const createResp = await fetch(`${DBWRITER_URL}/players`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				mail: email,
				username: payload.name ?? email.split("@")[0],
				password_hash,
				google_id: payload.sub,
			}),
			});

			if (!createResp.ok) {
			const text = await createResp.text().catch(() => "");
			req.log.error({ status: createResp.status, text }, "DBWriter google player creation failed");
			return reply.status(502).send({ error: "DBWriter error" });
			}

			player = await createResp.json();
		} else if (resp.ok) {
			player = await resp.json();
		} else {
			const text = await resp.text().catch(() => "");
			req.log.error({ status: resp.status, text }, "DBWriter lookup failed");
			return reply.status(502).send({ error: "DBWriter error" });
		}

		// 3) Player "safe"
		const safePlayer = {
			id: player.id,
			username: player.username,
			mail: player.mail,
			wallet_adress: player.wallet_adress ?? null,
			created_at: player.created_at,
		};

		// 4) Refresh token (identique à /login)
		const refreshToken = makeRefreshToken();
		const refreshHash = sha256Hex(refreshToken);
		const refreshExpiresAt = addDaysIso(REFRESH_DAYS);

		const issueResp = await fetch(`${DBWRITER_URL}/refresh/issue`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
			player_id: safePlayer.id,
			token_hash: refreshHash,
			expires_at: refreshExpiresAt,
			}),
		});

		if (!issueResp.ok) {
			const text = await issueResp.text().catch(() => "");
			req.log.error({ status: issueResp.status, text }, "DBWriter refresh issue failed");
			return reply.status(502).send({ error: "DBWriter error" });
		}

		setRefreshCookie(reply, refreshToken);

		// 5) JWT access token (identique à /login)
		const accessToken = app.jwt.sign(
			{
			sub: safePlayer.id,
			username: safePlayer.username,
			mail: safePlayer.mail,
			},
			{ expiresIn: ACCESS_TTL }
		);

		return reply.send({
			access_token: accessToken,
			player: safePlayer,
		});
		}
	);




	/**
   * GET /auth/me
   * - Nécessite Authorization: Bearer <token>
   * - Renvoie les claims du token
   */
	app.get("/me", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		// req.user = payload JWT validé
		const userId = req.user?.sub;
		if (!userId) return reply.status(401).send({ error: "Unauthorized" });

		const resp = await fetch(`${DBWRITER_URL}/players/${encodeURIComponent(String(userId))}`);

		if (resp.status === 404) return reply.status(404).send({ error: "Player not found" });
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			req.log.error({ status: resp.status, text }, "DBWriter /players/:id failed");
			return reply.status(502).send({ error: "DBWriter error" });
		}

		const player = await resp.json(); // déjà “safe” côté dbwriter
		return reply.send({ player });
	});

	//!  Ajout John Validation Avatars
	const ALLOWED_AVATARS = new Set([
		"default.png",
		"a01.png","a02.png","a03.png","a04.png","a05.png",
		"a06.png","a07.png","a08.png","a09.png","a10.png",
		]);

		function isDataImageUrl(v: string): boolean {
		return (
			v.startsWith("data:image/png;base64,") ||
			v.startsWith("data:image/jpeg;base64,")
		);
	}
	//! ------------------------------->

	// Route modification du profile
	app.patch("/profile",{ preHandler: (app as any).authenticate, schema: patchProfileSchema },
		async (req: any, reply) => {
			const userId = req.user?.sub;
			if (!userId) return reply.status(401).send({ error: "Unauthorized" });

			const body = req.body ?? {};


			//! Ajout John verification avatar cote server
			// --- server-side validation (ne fais pas confiance au front) ---
			if (body.username !== undefined)
			{
			if (typeof body.username !== "string" || body.username.length < 1 || body.username.length > 16)
				return reply.status(400).send({ error: "Invalid username" });

			if (!/^[A-Za-z0-9]+$/.test(body.username))
				return reply.status(400).send({ error: "Invalid username" });
			}

			// Avatar rules:
			if (body.avatar_kind !== undefined)
			{
			if (body.avatar_kind === "default")
			{
				// reset default allowed: avatar_value may be undefined
				if (body.avatar_value !== undefined)
				{
				if (typeof body.avatar_value !== "string" || !ALLOWED_AVATARS.has(body.avatar_value))
					return reply.status(400).send({ error: "Invalid avatar preset" });
				}
			}
			else if (body.avatar_kind === "upload")
			{
				if (typeof body.avatar_value !== "string" || !isDataImageUrl(body.avatar_value))
				return reply.status(400).send({ error: "Invalid avatar upload" });
			}
			}
			//! -------------------------------------------------------------->



			const resp = await fetch(`${DBWRITER_URL}/players/${encodeURIComponent(String(userId))}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			});

			if (resp.status === 409) return reply.status(409).send(await resp.json().catch(() => ({ error: "Conflict" })));
			if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			req.log.error({ status: resp.status, text }, "DBWriter profile patch failed");
			return reply.status(502).send({ error: "DBWriter error" });
			}

			const player = await resp.json();
			return reply.send({ player });
		}
	);

	// Route change Password
	app.post("/change-password",{ preHandler: (app as any).authenticate, schema: changePasswordSchema },
		async (req: any, reply) => {
			const userId = req.user?.sub;
			if (!userId) return reply.status(401).send({ error: "Unauthorized" });

			const { old_password, new_password } = req.body;

			// 1) load player + hash
			const pResp = await fetch(`${DBWRITER_URL}/players/private/${encodeURIComponent(String(userId))}`);
			if (pResp.status === 404) return reply.status(404).send({ error: "Player not found" });
			if (!pResp.ok) return reply.status(502).send({ error: "DBWriter error" });
			const player = await pResp.json();

			// 2) compare old password
			const ok = await bcrypt.compare(old_password, player.password_hash);
			if (!ok) return reply.status(401).send({ error: "Invalid credentials" });

			// 3) write new hash
			const newHash = await bcrypt.hash(new_password, 10);
			const uResp = await fetch(`${DBWRITER_URL}/players/${encodeURIComponent(String(userId))}/password`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password_hash: newHash }),
			});
			if (!uResp.ok) return reply.status(502).send({ error: "DBWriter error" });

			// 4) revoke all refresh tokens for this player (à implémenter côté DBWriter)
			await fetch(`${DBWRITER_URL}/refresh/revoke-all`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ player_id: userId }),
			}).catch((err) => {
				req.log.warn({ err }, "DBWriter revoke-all failed (best-effort)");
			});

			// 5) clear cookie + force relogin (option simple)
			clearRefreshCookie(reply);

			return reply.code(204).send();
		}
	);

	// ----------------> Friends / Presence ---------------->
	// presence ping (JWT)
	app.post("/presence/ping", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = req.user?.sub;
		if (!userId) return reply.status(401).send({ error: "Unauthorized" });

		const resp = await dbFetch(req, reply, "/presence/ping", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ player_id: userId }),
		});

		if (resp.status === 204) return reply.code(204).send();
		return reply.status(502).send({ error: "DBWriter error" });
	});
	// presence offline (JWT)
	app.post("/presence/offline", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = req.user?.sub;
		if (!userId) return reply.status(401).send({ error: "Unauthorized" });

		const resp = await dbFetch(req, reply, "/presence/offline", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ player_id: userId }),
		});

		if (resp.status === 204) return reply.code(204).send();
		return reply.status(502).send({ error: "DBWriter error" });
	});
	// search players (JWT)
	app.get("/players/search", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const q = typeof req.query?.q === "string" ? req.query.q : "";
		const resp = await dbFetch(req, reply, `/players/search?q=${encodeURIComponent(q)}`);
		if (!resp.ok) return reply.status(502).send({ error: "DBWriter error" });
		return reply.send(await resp.json());
	});

	// send friend request (JWT)
	app.post("/friends/requests", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = req.user?.sub;
		if (!userId) return reply.status(401).send({ error: "Unauthorized" });

		const to_id = req.body?.to_id;
		const resp = await dbFetch(req, reply, "/friends/requests", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ from_id: userId, to_id }),
		});

		if (resp.status === 201) return reply.code(201).send(await resp.json());
		const data = await resp.json().catch(() => ({ error: "DBWriter error" }));
		return reply.code(resp.status).send(data);
	});

	// incoming requests (JWT)
	app.get("/friends/requests/incoming", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = req.user?.sub;
		if (!userId) return reply.status(401).send({ error: "Unauthorized" });

		const resp = await dbFetch(req, reply, `/friends/requests/incoming/${encodeURIComponent(String(userId))}`);
		if (!resp.ok) return reply.status(502).send({ error: "DBWriter error" });
		return reply.send(await resp.json());
	});

	// outgoing requests (JWT)
	app.get("/friends/requests/outgoing", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = req.user?.sub;
		if (!userId) return reply.status(401).send({ error: "Unauthorized" });

		const resp = await dbFetch(req, reply, `/friends/requests/outgoing/${encodeURIComponent(String(userId))}`);
		if (!resp.ok) return reply.status(502).send({ error: "DBWriter error" });
		return reply.send(await resp.json());
	});


	// respond request (JWT)
	app.post("/friends/requests/:requestId/respond", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = req.user?.sub;
		if (!userId) return reply.status(401).send({ error: "Unauthorized" });

		const requestId = req.params?.requestId;
		const accept = req.body?.accept === true;

		const resp = await dbFetch(req, reply, `/friends/requests/${encodeURIComponent(String(requestId))}/respond`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ player_id: userId, accept }),
		});

		if (resp.status === 204) return reply.code(204).send();
		const data = await resp.json().catch(() => ({ error: "DBWriter error" }));
		return reply.code(resp.status).send(data);
	});

	// list friends (JWT)
	app.get("/friends/list", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = req.user?.sub;
		if (!userId) return reply.status(401).send({ error: "Unauthorized" });

		const resp = await dbFetch(req, reply, `/friends/list/${encodeURIComponent(String(userId))}`);
		if (!resp.ok) return reply.status(502).send({ error: "DBWriter error" });
		return reply.send(await resp.json());
	});

	// delete friend (JWT)
	app.delete("/friends/:friendId", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = req.user?.sub;
		if (!userId) return reply.status(401).send({ error: "Unauthorized" });

		const friendIdRaw = req.params?.friendId;
		const friendId = Number(friendIdRaw);
		if (!Number.isInteger(friendId) || friendId <= 0) {
			return reply.status(400).send({ error: "friendId invalide" });
		}
		if (friendId === userId) {
			return reply.status(400).send({ error: "Impossible" });
		}

		const resp = await dbFetch(req, reply, `/friends/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(friendId))}`, {
			method: "DELETE",
		});

		if (resp.status === 204) return reply.code(204).send();

		const data = await resp.json().catch(() => ({ error: "DBWriter error" }));
		return reply.code(resp.status).send(data);
	});

	// ----------------------------------------------> End of Friend Presence part



	// ----------------> Messenger ---------------->
	// list messages with a friend
	app.get("/dm/with/:otherId", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = Number(req.user?.sub);
		const otherId = Number(req.params.otherId);
		const after = req.query?.after ? String(req.query.after) : "0";
		const limit = req.query?.limit ? String(req.query.limit) : "50";

		const resp = await dbFetch(
			req,
			reply,
			`/dm/with/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(otherId))}?after=${encodeURIComponent(after)}&limit=${encodeURIComponent(limit)}`
		);

		if (resp.status === 204)
			return reply.code(204).send();

		const data = await resp.json().catch(() => null);
		return reply.code(resp.status).send(data);
	});

	// Send
	app.post("/dm/send", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = Number(req.user?.sub);
		const to_id = Number(req.body?.to_id);
		const body = String(req.body?.body ?? "");

		const resp = await dbFetch(req, reply, "/dm/send", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ from_id: userId, to_id, body }),
		});

		if (resp.status === 204)
			return reply.code(204).send();

		const data = await resp.json().catch(() => null);
		
		return reply.code(resp.status).send(data);
	});

	// Block/unblock
	app.post("/dm/block", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
		const userId = Number(req.user?.sub);
		const blocked_id = Number(req.body?.blocked_id);
		const block = !!req.body?.block;

		const resp = await dbFetch(req, reply, "/dm/block", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ blocker_id: userId, blocked_id, block }),
		});

		if (resp.status === 204)
			return reply.code(204).send();

		const data = await resp.json().catch(() => null);
		return reply.code(resp.status).send(data);
	});
	// ----------------------------------------------> End of Messenger part


	
	app.post("/refresh", async (req: any, reply) => {
		const token = req.cookies?.refresh_token;
		if (typeof token !== "string" || !token) {
			return reply.status(401).send({ error: "Unauthorized" });
		}

		const oldHash = sha256Hex(token);

		// rotate côté DB
		const newRefresh = makeRefreshToken();
		const newHash = sha256Hex(newRefresh);
		const newExpiresAt = addDaysIso(REFRESH_DAYS);

		const rotResp = await fetch(`${DBWRITER_URL}/refresh/rotate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
			old_token_hash: oldHash,
			new_token_hash: newHash,
			new_expires_at: newExpiresAt,
			}),
		});

		if (rotResp.status === 401) {
			clearRefreshCookie(reply);
			return reply.status(401).send({ error: "Unauthorized" });
		}

		if (!rotResp.ok) {
			const text = await rotResp.text().catch(() => "");
			req.log.error({ status: rotResp.status, text }, "DBWriter refresh rotate failed");
			return reply.status(502).send({ error: "DBWriter error" });
		}

		const { player_id } = await rotResp.json();

		// reload player safe (source de vérité)
		const pResp = await fetch(`${DBWRITER_URL}/players/${encodeURIComponent(String(player_id))}`);
		if (!pResp.ok) {
			const text = await pResp.text().catch(() => "");
			req.log.error({ status: pResp.status, text }, "DBWriter /players/:id failed after refresh");
			return reply.status(502).send({ error: "DBWriter error" });
		}
		const player = await pResp.json();

		// new access token
		const access = app.jwt.sign(
			{ sub: player.id, username: player.username, mail: player.mail },
			{ expiresIn: ACCESS_TTL }
		);

		// set rotated cookie
		setRefreshCookie(reply, newRefresh);

		return reply.send({ access_token: access, player });
	});

	// Route Password oublie
	function addMinutesIso(min: number): string {
		const d = new Date();
		d.setMinutes(d.getMinutes() + min);
		return d.toISOString();
		}

		app.post(
		"/forgot-password",
		{ schema: forgotRequestSchema },
		async (req: FastifyRequest, reply) => {
			const { mail } = (req.body as any) ?? {};
			const TTL_MIN = 15;

			// lookup player (tu peux réutiliser /players/by-mail mais ça renvoie password_hash)
			const resp = await fetch(`${DBWRITER_URL}/players/by-mail/${encodeURIComponent(mail)}`);

			// réponse neutre quoi qu’il arrive
			if (!resp.ok) return reply.code(204).send();

			const player = await resp.json().catch(() => null);
			if (!player?.id) return reply.code(204).send();

			const rawToken = makeRefreshToken();         // random base64url
			const tokenHash = sha256Hex(rawToken);
			const expiresAt = addMinutesIso(TTL_MIN);

			await fetch(`${DBWRITER_URL}/password-reset/issue`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ player_id: player.id, token_hash: tokenHash, expires_at: expiresAt }),
			}).catch(() => {});

			// DEV: log le lien (tu brancheras un vrai mailer après)
			req.log.info({ mail, link: `https://localhost:8443/reset-password?token=${rawToken}` }, "password reset link");

			return reply.code(204).send();
		}
	);

	// Route reset Password
	app.post("/reset-password",{ schema: forgotResetSchema }, 
		async (req: FastifyRequest, reply) => {
			const { token, new_password } = (req.body as any) ?? {};
			const tokenHash = sha256Hex(token);

			// consume token atomiquement
			const cResp = await fetch(`${DBWRITER_URL}/password-reset/consume`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token_hash: tokenHash }),
			});

			if (cResp.status === 401) return reply.status(401).send({ error: "Invalid or expired token" });
			if (!cResp.ok) return reply.status(502).send({ error: "DBWriter error" });

			const { player_id } = await cResp.json();

			const newHash = await bcrypt.hash(new_password, 10);
			const uResp = await fetch(`${DBWRITER_URL}/players/${encodeURIComponent(String(player_id))}/password`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password_hash: newHash }),
			});

			if (!uResp.ok) return reply.status(502).send({ error: "DBWriter error" });

			// sécurité: kill refresh cookie si le navigateur en a un
			clearRefreshCookie(reply);

			return reply.code(204).send();
		}
	);



	app.post("/logout", async (req: any, reply) => {
	const token = req.cookies?.refresh_token;

	// Logout idempotent: on clear cookie quoi qu'il arrive
	clearRefreshCookie(reply);

	if (typeof token !== "string" || !token) {
		return reply.code(204).send();
	}

	const hash = sha256Hex(token);

	const revResp = await fetch(`${DBWRITER_URL}/refresh/revoke`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ token_hash: hash }),
	});

	// Même si DBWriter est down, on ne doit pas bloquer le logout côté client
	if (!revResp.ok) {
		const text = await revResp.text().catch(() => "");
		req.log.error({ status: revResp.status, text }, "DBWriter refresh revoke failed");
	}

	return reply.code(204).send();
	});



	return app;
}

async function start() {
	const app = await buildServer();
	const port = Number(process.env.PORT) || 3000;
	const host = "0.0.0.0";
	await app.listen({ port, host });
	app.log.info(`authservice listening on http://${host}:${port}`);
}

	start().catch((err) => {
	console.error("Failed to start authservice:", err);
	process.exit(1);
});

