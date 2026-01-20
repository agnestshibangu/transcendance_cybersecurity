// frontend/src/hud.ts
type HudLogLevel = "INFO" | "WARN" | "ERROR";

export class AtlantisHUD {
	private clockEl: HTMLElement | null;
	private latencyEl: HTMLElement | null;
	private tickEl: HTMLElement | null;
	private logEl: HTMLElement;
	private playerAliasEl: HTMLElement | null;
	private playerEloEl: HTMLElement | null;
	private playerLobbyEl: HTMLElement | null;

	private tickCounter = 0;

	constructor() {
		this.clockEl = document.getElementById("hud-clock");
		this.latencyEl = document.getElementById("hud-latency");
		this.tickEl = document.getElementById("hud-tick");

		const logEl = document.getElementById("hud-log");
		if (!logEl) {
			throw new Error("#hud-log introuvable dans le DOM");
		}
		this.logEl = logEl;

		this.playerAliasEl = document.getElementById("hud-player-alias");
		this.playerEloEl = document.getElementById("hud-player-elo");
		this.playerLobbyEl = document.getElementById("hud-player-lobby");

		this.init();
	}

	private init() {
		this.initClock();
		this.startLatencyCheck();
		this.log("HUD initialized", "INFO");
	}

	private padding(n: number): string {
		return n < 10 ? "0" + n : "" + n;
	}

	private initClock() {
		this.updateClock();
		setInterval(() => {
			this.updateClock();
			this.updateTick();
		}, 1000);
	}

	private updateClock() {
		if (!this.clockEl) return;
		const now = new Date();
		const timeStr =
			`${this.padding(now.getHours())}:` +
			`${this.padding(now.getMinutes())}:` +
			`${this.padding(now.getSeconds())}`;
		this.clockEl.textContent = timeStr;
	}

	private updateTick() {
		this.tickCounter += 1;
		const sec = this.tickCounter % 60;
		const min = Math.floor(this.tickCounter / 60) % 60;
		const hour = Math.floor(this.tickCounter / 3600) % 24;
		const day = Math.floor(this.tickCounter / 86400);

		if (this.tickEl) {
			this.tickEl.textContent =
				`${this.padding(day)}:` +
				`${this.padding(hour)}:` +
				`${this.padding(min)}:` +
				`${this.padding(sec)}`;
		}
	}

	private async startLatencyCheck() {
		let ErrorServerCount = 0;

		const check = async () => {
			const start = performance.now();
			try {
				await fetch("../index.html", { method: "HEAD", cache: "no-store" });
				ErrorServerCount = 0;
			} catch (err) {
				ErrorServerCount++;
				if (ErrorServerCount >= 5) {
					window.location.reload();
					return;
				}
			}
			const latency = performance.now() - start;
			if (this.latencyEl)
				this.latencyEl.textContent = `${latency.toFixed(2)} ms`;
			setTimeout(check, 1000);
		};
		check();
	}

	// Mise à jour des infos joueur
	updatePlayerInfo(alias: string, elo: number | string, lobby: string) {
		if (this.playerAliasEl) this.playerAliasEl.textContent = alias;
		if (this.playerEloEl) this.playerEloEl.textContent = elo.toString();
		if (this.playerLobbyEl) this.playerLobbyEl.textContent = lobby;
	}

	log(message: string, level: HudLogLevel = "INFO")
	{
		if (!this.logEl) return;

		const time = new Date().toLocaleTimeString("fr-FR", {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});

		const line = document.createElement("div");
		line.className = "flex justify-between gap-2";

		const levelColor =
			level === "INFO"
				? "text-cyan-300"
				: level === "WARN"
				? "text-yellow-300"
				: "text-rose-300";

		line.innerHTML = `
			<span class="text-cyan-500/80 font-mono text-[0.65rem]">${time}</span>
			<span class="flex-1 text-[0.7rem] ${levelColor}">${level}</span>
			<span class="flex-[2] text-[0.7rem] text-cyan-100 truncate">${message}</span>
		`;

		this.logEl.prepend(line);

		// Limiter le nombre de lignes
		while (this.logEl.childElementCount > 20) {
			const last = this.logEl.lastElementChild;
			if (!last) break;
			this.logEl.removeChild(last);
		}
	}
}
