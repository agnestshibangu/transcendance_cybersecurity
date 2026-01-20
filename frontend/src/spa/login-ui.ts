// frontend/src/login-ui.ts

import * as Auth from "./auth-client.js";
import { navigateTo } from "./router.js";
//import { openMainMenu } from "../game/main.js";
import { showMainMenu } from "../game/menusLoad.js";


// Types pour le backend futur
export interface OperatorProfile {
	name: string;
	email: string;
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface SignupPayload {
	name: string;
	email: string;
	password: string;
}

// GOOGLE AUTHENTICATION --------------------------
// ------------------------------------------------

declare global {
	interface Window {
		google: any;
	}
}

const GOOGLE_CLIENT_ID = '138277743642-pj6hbjspm5ss2obl70ktbnt1obf8v8mt.apps.googleusercontent.com';

	async function handleGoogleLogin(response: any) {
		
		/*console.log("GOOGLE ID TOKEN:", response.credential);

		try {
		console.log("TRY");
		const res = await fetch("https://localhost:8443/auth/google-login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: response.credential }),
			credentials: "include",
		});

		if (!res.ok) throw new Error("Login failed");

		const data = await res.json();
		currentOperator = {
			name: data.player.username,
			email: data.player.mail,
		};*/
		try {
		const player = await Auth.loginWithGoogle(response.credential);

		currentOperator = {
			name: player.username,
			email: player.mail,
		};

		document.querySelector("#login-overlay")?.classList.add("hidden");
		showMainMenu();
		navigateTo("dashboard");
		} catch (err) {
		console.error("Google login failed", err);
		}
	}

	async function initGoogleAuth(): Promise<void>
	{
		if (!window.google?.accounts?.id) {
			// Google SDK not loaded yet, wait and retry
			setTimeout(() => initGoogleAuth(), 100);
			return;
		}
		
	window.google.accounts.id.initialize({
		client_id: GOOGLE_CLIENT_ID,
		callback: handleGoogleLogin,
	});


	document.querySelectorAll(".google-btn").forEach((container) => {
    	window.google.accounts.id.renderButton(container, {
			theme: "outline",
			size: "large",
			type: "standard",
			text: "signin_with",
			shape: "rectangular",
			logo_alignment: "left",
    	});
  	});
}

window.addEventListener("DOMContentLoaded", () => {
	initGoogleAuth();
});


// ------------------------------------------------
// ------------------------------------------------

let currentOperator: OperatorProfile | null = null;

export function getCurrentOperator(): OperatorProfile | null {
	return currentOperator;
}

type AuthMode = "login" | "signup";

// Contexte local pour le login overlay
interface LoginContext {
	overlay: HTMLDivElement;
	audioLogin: HTMLAudioElement | null;
	audioDashboard: HTMLAudioElement | null;

	tabLogin: HTMLButtonElement;
	tabSignup: HTMLButtonElement;
	errorEl: HTMLElement;

	loginForm: HTMLFormElement;
	signupForm: HTMLFormElement;

	loginEmail: HTMLInputElement;
	loginPassword: HTMLInputElement;
	btnLoginConnect: HTMLButtonElement;

	signupName: HTMLInputElement;
	signupEmail: HTMLInputElement;
	signupPassword: HTMLInputElement;
	signupPasswordConfirm: HTMLInputElement;
	btnSignupSubmit: HTMLButtonElement;

	mode: AuthMode;
	loginMusicStarted: boolean;
}

// ---------- Helpers génériques ----------

function getEl<T extends HTMLElement>(id: string): T {
	const el = document.getElementById(id);
	if (!el) {
		throw new Error(`Element "${id}" not found in DOM`);
	}
	return el as T;
}

// Validation email simple
function isValidEmail(email: string): boolean {
	const trimmed = email.trim();
	if (!trimmed) return false;
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return re.test(trimmed);
}

// Mot de passe "fort" basique
function isStrongPassword(pwd: string): boolean {
	if (pwd.length < 8) return false;
	const hasLetter = /[A-Za-z]/.test(pwd);
	const hasDigit = /\d/.test(pwd);
	const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
	return hasLetter && hasDigit && hasSpecial;
}

// ---------- Helpers liés au contexte ----------

function setError(ctx: LoginContext, msg: string): void {
	ctx.errorEl.textContent = msg;
}

function clearError(ctx: LoginContext): void {
	ctx.errorEl.textContent = "";
}

function ensureLoginMusic(ctx: LoginContext): void {
	const { audioLogin } = ctx;
	if (!audioLogin || ctx.loginMusicStarted) return;

	ctx.loginMusicStarted = true;
	audioLogin.volume = 0;

	audioLogin
		.play()
		.then(() => {
			let vol = 0;
			const fade = window.setInterval(() => {
				vol += 0.05;
				if (vol >= 0.6) {
					audioLogin.volume = 0.6;
					window.clearInterval(fade);
				}
				else {
					audioLogin.volume = vol;
				}
			}, 100);
		})
		.catch(() => {
			console.log("Login audio play blocked.");
		});
}

function switchToMode(ctx: LoginContext, target: AuthMode): void {
	ctx.mode = target;
	clearError(ctx);

	if (ctx.mode === "login") {
		ctx.loginForm.classList.remove("hidden");
		ctx.signupForm.classList.add("hidden");
		ctx.tabLogin.classList.add("active");
		ctx.tabSignup.classList.remove("active");
	} else {
		ctx.signupForm.classList.remove("hidden");
		ctx.loginForm.classList.add("hidden");
		ctx.tabSignup.classList.add("active");
		ctx.tabLogin.classList.remove("active");
	}
}

// ---------- Handlers métier ----------

const IS_LOCAL = false;

// async function localLogin(email: string, password: string): Promise<Auth.Player> {

// 	return {
// 		id: 0, // local user
// 		username: email.split("@")[0],
// 		mail: email,
// 		wallet_adress: null,
// 		created_at: new Date().toISOString(),
// 		avatar_kind: "default",
// 	};
// }

// async function handleLogin(ctx: LoginContext): Promise<void> //! LOCAL VERSION !!!!!
// {
// 	const email = ctx.loginEmail.value.trim();
// 	const password = ctx.loginPassword.value;

// 	if (!email || !password) {
// 		setError(ctx, "All fields are required.");
// 		return;
// 	}
// 	if (!isValidEmail(email)) {
// 		setError(ctx, "Please enter a valid email address.");
// 		return;
// 	}
// 	// if (!isStrongPassword(password)) {
// 	// 	setError(ctx,"Weak password: at least 8 chars with letters, digits and a symbol.");
// 	// 	return;
// 	// }

// 	clearError(ctx);

// 	let player: Auth.Player;
// try {
// 	player = IS_LOCAL
// 		? await localLogin(email, password)
// 		: await Auth.login(email, password);
// } catch (e: any) {
// 	setError(ctx, e?.message || "Invalid credentials.");
// 	return;
// }
// 	currentOperator = {
// 		name: player.username,
// 		email: player.mail,
// 	};


// 	// Audio
// 	if (ctx.audioLogin) {
// 		ctx.audioLogin.pause();
// 		ctx.audioLogin.currentTime = 0;
// 	}
// 	if (ctx.audioDashboard) {
// 		ctx.audioDashboard.volume = 0;
// 		ctx.audioDashboard
// 		.play()
// 		.then(() => {
// 			let vol = 0;
// 			const fade = window.setInterval(() => {
// 				vol += 0.05;
// 				if (vol >= 0.65) {
// 					ctx.audioDashboard!.volume = 0.65;
// 					window.clearInterval(fade);
// 				}
// 				else {
// 					ctx.audioDashboard!.volume = vol;
// 				}
// 			}, 100);
// 		})
// 		.catch(() => {
// 			console.log("Dashboard audio play blocked.");
// 		});
// 	}

// 	ctx.overlay.classList.add("hidden");
// 	showMainMenu();
// 	navigateTo("dashboard");
// }


async function handleLogin(ctx: LoginContext): Promise<void>
{
	const email = ctx.loginEmail.value.trim();
	const password = ctx.loginPassword.value;

	if (!email || !password) {
		setError(ctx, "All fields are required.");
		return;
	}
	if (!isValidEmail(email)) {
		setError(ctx, "Please enter a valid email address.");
		return;
	}
	// if (!isStrongPassword(password)) {
	// 	setError(ctx,"Weak password: at least 8 chars with letters, digits and a symbol.");
	// 	return;
	// }

	clearError(ctx);

	let player: Auth.Player;
	try
	{
		player = await Auth.login(email, password);
	} catch (e: any)
	{
		setError(ctx, e?.message || "Invalid credentials.");
		return;
	}
	currentOperator = {
		name: player.username,
		email: player.mail,
	};


	// Audio
	if (ctx.audioLogin) {
		ctx.audioLogin.pause();
		ctx.audioLogin.currentTime = 0;
	}
	if (ctx.audioDashboard) {
		ctx.audioDashboard.volume = 0;
		ctx.audioDashboard
		.play()
		.then(() => {
			let vol = 0;
			const fade = window.setInterval(() => {
				vol += 0.05;
				if (vol >= 0.65) {
					ctx.audioDashboard!.volume = 0.65;
					window.clearInterval(fade);
				}
				else {
					ctx.audioDashboard!.volume = vol;
				}
			}, 100);
		})
		.catch(() => {
			console.log("Dashboard audio play blocked.");
		});
	}

	ctx.overlay.classList.add("hidden");
	showMainMenu();
	navigateTo("dashboard");
}


async function handleSignup(ctx: LoginContext): Promise<void> {
	
	const name = ctx.signupName.value.trim();
	const email = ctx.signupEmail.value.trim();
	const password = ctx.signupPassword.value;
	const confirm = ctx.signupPasswordConfirm.value;
	
	if (!name || !email || !password || !confirm) {
		setError(ctx, "All fields are required.");
		return;
	}
	if (!isValidEmail(email)) {
		setError(ctx, "Please enter a valid email address.");
		return;
	}
	if (!isStrongPassword(password)) {
		setError(ctx,"Weak password: at least 8 chars with letters, digits and a symbol.");
		return;
	}
	if (password !== confirm) {
		setError(ctx, "Passwords do not match.");
		return;
	}
	
	clearError(ctx);

	let player: Auth.Player;
	try {
		player = await Auth.register(name, email, password); // Auth.register retourne un Player
	} catch (e: any) {
		setError(ctx, e?.message || "Signup failed.");
		return;
	}

	currentOperator = {
		name: player.username,
		email: player.mail,
	};

	// Audio
	if (ctx.audioLogin) {
		ctx.audioLogin.pause();
		ctx.audioLogin.currentTime = 0;
	}
	if (ctx.audioDashboard) {
		ctx.audioDashboard.volume = 0;
		ctx.audioDashboard
		.play()
		.then(() => {
			let vol = 0;
			const fade = window.setInterval(() => {
				vol += 0.05;
				if (vol >= 0.65) {
					ctx.audioDashboard!.volume = 0.65;
					window.clearInterval(fade);
				}
				else {
					ctx.audioDashboard!.volume = vol;
				}
			}, 100);
		})
		.catch(() => {
			console.log("Dashboard audio play blocked.");
		});
	}

	ctx.overlay.classList.add("hidden");
	showMainMenu();
	navigateTo("dashboard");
}

// ---------- Wiring des events ----------

function setupTabs(ctx: LoginContext): void {
	ctx.tabLogin.addEventListener("click", () => {
		ensureLoginMusic(ctx);
		switchToMode(ctx, "login");
	});

	ctx.tabSignup.addEventListener("click", () => {
		ensureLoginMusic(ctx);
		switchToMode(ctx, "signup");
	});
	}

	function setupSubmitHandlers(ctx: LoginContext): void {
	ctx.btnLoginConnect.addEventListener("click", () => {
		ensureLoginMusic(ctx);
		void handleLogin(ctx);
	});

	ctx.btnSignupSubmit.addEventListener("click", () => {
		ensureLoginMusic(ctx);
		void handleSignup(ctx);
	});
}

function setupEnterAndFocusHandlers(ctx: LoginContext): void {
	const inputs: HTMLInputElement[] = [
		ctx.loginEmail,
		ctx.loginPassword,
		ctx.signupName,
		ctx.signupEmail,
		ctx.signupPassword,
		ctx.signupPasswordConfirm,
	];

	inputs.forEach((input) => {
		input.addEventListener("focus", () => {
		ensureLoginMusic(ctx);
		});
		input.addEventListener("keydown", (ev: KeyboardEvent) => {
		if (ev.key === "Enter") {
			ev.preventDefault();
			ensureLoginMusic(ctx);
			if (ctx.mode === "login") {
			void handleLogin(ctx);
			} else {
			void handleSignup(ctx);
			}
		}
		});
	});
}

function setupPasswordEye(ctx: LoginContext): void {
	const toggles = document.querySelectorAll<HTMLButtonElement>(".password-toggle");

	// clic pour toggle visibilité
	toggles.forEach((btn) => {
		const targetId = btn.dataset.target;
		if (!targetId) return;

		btn.addEventListener("click", () => {
		const input = document.getElementById(targetId) as HTMLInputElement | null;
		if (!input) return;

		input.type = input.type === "password" ? "text" : "password";
		});
	});

	// suivi de la souris pour la pupille
	ctx.overlay.addEventListener("mousemove", (ev: MouseEvent) => {
		toggles.forEach((btn) => {
		const pupil = btn.querySelector<HTMLElement>(".eye-pupil");
		if (!pupil) return;

		const rect = btn.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		const dxRaw = ev.clientX - centerX;
		const dyRaw = ev.clientY - centerY;

		const maxRadius = 120;
		const maxOffset = 14;

		const dist = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw);
		if (dist > maxRadius) {
			pupil.style.transform = "translate(0, 0)";
			return;
		}

		const ratio = dist === 0 ? 0 : Math.min(dist / maxRadius, 1);
		const dirX = dxRaw / (dist || 1);
		const dirY = dyRaw / (dist || 1);

		const offset = ratio * maxOffset;
		const dx = dirX * offset;
		const dy = dirY * offset;

		pupil.style.transform = `translate(${dx}px, ${dy}px)`;
		});
	});

	toggles.forEach((btn) => {
		const pupil = btn.querySelector<HTMLElement>(".eye-pupil");
		if (!pupil) return;

		btn.addEventListener("mouseleave", () => {
			pupil.style.transform = "translate(0, 0)";
		});
	});
}

// ---------- Point d’entrée ----------

export function  initLoginOverlay(): void
{
	const overlay = getEl<HTMLDivElement>("login-overlay");

	const ctx: LoginContext = {
		overlay,
		audioLogin: document.getElementById("audio-login") as HTMLAudioElement | null,
		audioDashboard: document.getElementById("audio-dashboard") as HTMLAudioElement | null,

		tabLogin: getEl<HTMLButtonElement>("login-mode-login"),
		tabSignup: getEl<HTMLButtonElement>("login-mode-signup"),
		errorEl: getEl<HTMLElement>("login-error"),

		loginForm: getEl<HTMLFormElement>("login-form"),
		signupForm: getEl<HTMLFormElement>("signup-form"),

		loginEmail: getEl<HTMLInputElement>("login-email"),
		loginPassword: getEl<HTMLInputElement>("login-password"),
		btnLoginConnect: getEl<HTMLButtonElement>("login-connect"),

		signupName: getEl<HTMLInputElement>("signup-name"),
		signupEmail: getEl<HTMLInputElement>("signup-email"),
		signupPassword: getEl<HTMLInputElement>("signup-password"),
		signupPasswordConfirm: getEl<HTMLInputElement>("signup-password-confirm"),
		btnSignupSubmit: getEl<HTMLButtonElement>("signup-submit"),

		mode: "login",
		loginMusicStarted: false,
	};

	setupTabs(ctx);
	setupSubmitHandlers(ctx);
	setupEnterAndFocusHandlers(ctx);
	setupPasswordEye(ctx);

	// mode initial
	switchToMode(ctx, "login");
	initGoogleAuth();

}