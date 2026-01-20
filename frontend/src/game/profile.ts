// frontend/src/game/profile.ts

import * as Auth from "../spa/auth-client.js";
import {Ref, makeStandaloneRef} from "./Utils/utils.js"
import { navigateTo } from "../spa/router.js";
import { menusData } from "./menu.js";
import { renderFriendZone, stopFriendsRefresh  } from "./friendzone.js"; //! ---- For Friendzone ----
import { MenuId } from "./menusLoad.js";
//import { gUser as gUserReal } from "./user/user.js"; // option 1: import direct (voir plus bas)

let sessionListenerBound = false;
let subs: any;
let gUser: any;
const DEFAULT_IMG_PATH = "/images";

let IMG_PATH = DEFAULT_IMG_PATH;

export function initProfile(deps: { subs: any; gUser: any; IMG_PATH: string }) {
	subs = deps.subs;
	gUser = deps.gUser;
	IMG_PATH = deps.IMG_PATH;

	if (!sessionListenerBound) {
		window.addEventListener("ft:session:changed", onSessionChangedProfile);
		sessionListenerBound = true;
	}
}

type AvatarKind = "default" | "upload";


const avatarKind = makeStandaloneRef<AvatarKind>("default");
const avatarValue = makeStandaloneRef<string>(""); // filename (preset/default) ou dataURL (upload)

const PRESET_AVATARS = [
	"a01.png",
	"a02.png",
	"a03.png",
	"a04.png",
	"a05.png",
	"a06.png",
	"a07.png",
	"a08.png",
	"a09.png",
	"a10.png",
];


// ---- PROFILE STATE ----
const userName = makeStandaloneRef(""); // valeur par défaut OK, remplacée par loadProfileFromBackend()

let profileLoaded = false;
let profileLoading = false;
let profileLoadError: string | null = null;
let headerResizeBound = false;
let lastLoadedUserId: string | number | null = null; // Track which user's profile is currently loaded

// ---- For Friendzone ----
type ProfileTab = "profile" | "friendzone";
let activeTab: ProfileTab = "profile";



// let name = getCurrentOperator()?.name;

// 	if (this.sv_running)
// 	  return;
// 	  if (!name)
// 		  name = "Unknown Player";



//! --- === PROFILE STATE (password) === -------->
const oldPassword = makeStandaloneRef("");
const newPassword = makeStandaloneRef("");
const newPasswordConfirm = makeStandaloneRef("");

const showOldPassword = makeStandaloneRef(false);
const showNewPassword = makeStandaloneRef(false);
const showNewPasswordConfirm = makeStandaloneRef(false);

function validateNewPassword(pwd: string): string | null
{
  // Exemple strict mais réaliste :
  if (pwd.length < 8) return "Password must be at least 8 characters.";
  if (pwd.length > 72) return "Password too long.";
  return null;
}
//! ------------------------------------------------ >




//! ------------------ ajout John profile from backend------------------------>

async function loadProfileFromBackend(attempt: number = 0)
{
	if (profileLoading)
		return;          // avoid spam
	profileLoading = true;
	profileLoadError = null;

	try {
		const p = await Auth.me();
		// Track the user ID to prevent displaying stale data from previous user
		const currentUserId = p.id || p.username;
		lastLoadedUserId = currentUserId;
		
		userName.value = p.username;
		
		// Avatar: on lit ce que renvoie Auth.me()
		if (p.avatar_kind === "upload" || p.avatar_kind === "default")
			avatarKind.value = p.avatar_kind;
		else
			avatarKind.value = "default";

		// value: soit filename (default/preset), soit dataURL (upload)
		avatarValue.value = typeof p.avatar_value === "string" ? p.avatar_value : "";
		// Normalisation: si "default" sans valeur, on force un filename réel
		if (avatarKind.value === "default" && (!avatarValue.value || avatarValue.value.trim() === "")) {
			avatarValue.value = "default.png";
		}


		profileLoaded = true;
		//profileUpdate();
	} catch (e: any) {
		// Don't retry on 401 Unauthorized - user is not logged in
		if (e?.status === 401) {
			profileLoadError = "Not logged in";
			profileLoaded = false;
			profileLoading = false;
			return; // Don't call profileUpdate() to avoid infinite loop
		}
		
		// Auto-retry 1 fois (évite le "Retry" manuel au premier enter)
		if (attempt === 0) {
			profileLoading = false;
			await new Promise((r) => setTimeout(r, 250));
			return loadProfileFromBackend(1);
		}
		// IMPORTANT: ne pas rester bloqué en "Loading..."
		profileLoadError = e?.message ?? "Failed to load profile (unauthorized?).";
		profileLoaded = false;
	}
	finally {
		profileLoading = false;
		// Only update if we didn't already return (to avoid infinite loop on 401)
		if (profileLoadError !== "Not logged in") {
			profileUpdate();
		}
	}
}


// ---- For Friendzone ----
function makeTabsRow(onSwitch: (tab: "profile" | "friendzone") => void)
{
	const row = document.createElement("div");
	row.className = "mt-6 w-full flex items-center justify-center gap-5";

	const mk = (label: string, tab: "profile" | "friendzone") =>
	{
		const btn = document.createElement("button");
		btn.type = "button";

		const active = activeTab === tab;

		btn.className =
			"hud-panel rounded-hud border px-10 py-4 text-lg font-extrabold tracking-widest " +
			"shadow-hud-panel transition select-none " +
			"min-w-[220px] text-center " +
			(active
				? "border-cyan-400/80 bg-cyan-500/15 text-cyan-100"
				: "border-cyan-500/40 bg-slate-950/70 text-cyan-200 hover:border-cyan-400/70 hover:bg-cyan-500/10");

		btn.textContent = label;

		// btn.onclick = () => {
		// 	if (activeTab === tab)
		// 		return;
		// 	if (activeTab === "friendzone" && tab === "profile") {
		// 		stopFriendsRefresh();
		// 	}
		// 	activeTab = tab;
		// 	onSwitch(tab);
		// };
		btn.onclick = () => {
			if (activeTab === tab)
				return;

			if (activeTab === "friendzone" && tab === "profile")
				stopFriendsRefresh();

			activeTab = tab;

			// IMPORTANT: quand on revient sur Profile, on resync depuis le backend
			if (tab === "profile") {
				void loadProfileFromBackend(); // refresh silencieux, pas besoin de reset profileLoaded
			}

			onSwitch(tab);
		};




		return btn;
	};

	row.appendChild(mk("Profile", "profile"));
	row.appendChild(mk("Friendzone", "friendzone"));
	return row;
}

// --------------------------------------->

const DEV_MODE = false;

export function profileMenu()
{
	if (!subs || !gUser || !IMG_PATH)
		throw new Error("profile.ts not initialized: call initProfile({subs,gUser,IMG_PATH}) before profileMenu()");
	const sub = menusData[MenuId.sub_profile];
	if (DEV_MODE)
	{
		userName.value = "DevUser";
		sub.addButton("Back", () => subs.showMenu("menu-main"));
		subs.showMenu("menu-main");
		return;
	}
	
	// sub.setSubTitle("RIGHT", userName.value, `${IMG_PATH}/coin/SC.png`);
	// sub.addSection("Progress");
	// sub.addCustom(makeLevelRing(gUser.network.stats.level, gUser.network.stats.xp, {size: 96, stroke: 8}));
	sub.setSubTitle("RIGHT", "", ""); // ou sub.setSubTitle("RIGHT"); selon ton goût

	// Ensure profile data is loaded for the current session
	// If profileLoaded is false, we must be at the start of a new session, so load immediately
	if (!profileLoaded && !profileLoading)
	{
		sub.setSubTitle("RIGHT", "", "");

		// Si on a une erreur, on l'affiche + bouton retry
		if (profileLoadError)
		{
			sub.addLabel(profileLoadError, "");
			sub.addButton("Retry", () => {
				profileLoadError = null;
				void loadProfileFromBackend();
			});
			sub.addButton("Back", () => subs.showMenu("menu-main"));
			return;
		}

		// start loading now
		sub.addLabel("Loading profile...", "");
		void loadProfileFromBackend();
		return;
	}

	// Header (uniquement quand les données sont prêtes)
	sub.setSubTitle("RIGHT", "", "");
	sub.addCustom(makeProfileHeader());
	sub.addCustom(makeTabsRow(() => profileUpdate())); //! For Friendzone
	if (activeTab === "friendzone")
	{
		renderFriendZone(sub, {
			subs,
			requestRerender: () => profileUpdate(),
		});
		return;
	}


	// Username
	sub.addSection("Username");
	sub.addTextbox2("Change Name:", {
		showSetButton: true,
		initialValue: userName.value,    // <-- pré-rempli
		maxLength: 16,                   // <-- limite UI
		sanitize: (v: string) => v.replace(/[^A-Za-z0-9]/g, "").slice(0, 16),
		onSet: async (raw: string) =>
		{
			const candidate = raw.trim();
			const err = validateUsername(candidate);
			if (err) { alert(err); return; }

			try
			{
			const p = await Auth.patchProfile({ username: candidate });
			userName.value = p.username;
			alert("Username updated.");
			profileUpdate();
			}
			catch (e: any)
			{
			if (e?.status === 409) alert("Username already taken.");
			else alert(e?.message ?? "Failed to update username.");
			}
		},
	});

	// Avatar
	sub.addSection("Avatar");
	sub.addCustom(makeAvatarPanel());

	
	sub.addSection("Password");
	sub.addCustom(makePasswordPanel());
	
	sub.addButton("Back", () => subs.showMenu("menu-main"));
}
//! ------------------------------------------------------------------->

function makeProfileHeader(): HTMLElement
{
	const wrap = document.createElement("div");
	wrap.className = "w-full px-4";

	const row = document.createElement("div");
	row.className = "flex items-start gap-6";

	// Left: big avatar
	const left = document.createElement("div");
	left.className = "flex-shrink-0";

	const big = document.createElement("img");
	big.src = resolveAvatarSrc(avatarKind.value, avatarValue.value);
	big.className =
		"w-80 h-80 rounded-3xl border-2 border-cyan-500/50 object-cover bg-slate-900";
	left.appendChild(big);

	// Right: username + logo, then progress ring
	const right = document.createElement("div");
	right.className = "flex-1 flex flex-col items-start gap-3 min-w-0";

	const nameRow = document.createElement("div");
	nameRow.className = "flex items-center gap-2 min-w-0 w-full";

	const logo = document.createElement("img");
	logo.src = `${IMG_PATH}/coin/SC.png`;
	logo.className = "w-7 h-7 object-contain";

	const name = document.createElement("div");
	name.className = "text-cyan-100 font-semibold tracking-wide leading-tight whitespace-nowrap flex-1 min-w-0";
	name.textContent = userName.value;
	//name.style.maxWidth = "100%";
	
	const refit = () => fitTextToContainer(name, { max: 28, min: 16 });

	requestAnimationFrame(() => {
		requestAnimationFrame(refit);
	});


	nameRow.appendChild(logo);
	nameRow.appendChild(name);

	const ring = makeLevelRing(gUser.network.stats.level, gUser.network.stats.xp,
		{ size: 160, stroke: 15 }
	);

	// (Optionnel) label "Progress" au-dessus du ring, si tu veux comme tes screenshots
	const progressLabel = document.createElement("div");
	progressLabel.className = "text-cyan-300 text-sm font-semibold";
	progressLabel.textContent = "Progress";

	const ringBlock = document.createElement("div");
	ringBlock.className = "flex flex-col items-center flex-shrink-0";
	ringBlock.appendChild(progressLabel);
	ringBlock.appendChild(ring);

	right.appendChild(nameRow);
	right.appendChild(ringBlock);

	row.appendChild(left);
	row.appendChild(right);
	wrap.appendChild(row);


	const resizeHandler = () => refit();

	if (!headerResizeBound) {
		window.addEventListener("resize", resizeHandler);
		headerResizeBound = true;
	}



	return wrap;
}


function profileUpdate()
{
	const sub = menusData[MenuId.sub_profile];
	sub.clear();
	profileMenu();
	//sub.show();
}

//! ------------------ ajout John validate username------------------------>
function validateUsername(v: string): string | null {
    if (v.length < 1) return "Username cannot be empty.";
    if (v.length > 16) return "Username must be <= 16 characters.";
    if (!/^[A-Za-z0-9]+$/.test(v)) return "Username must be alphanumeric only.";
    return null;
}


//! Ajout John Helper to create a level ring element ---------------------->
function makeLevelRing(level: number, xp: number, opts?: { size?: number; stroke?: number })
{
	const max = 975 * Math.max(1, level);
	const clamped = Math.max(0, Math.min(xp, max));
	const pct = max === 0 ? 0 : clamped / max;

	const size = opts?.size ?? 72;
	const stroke = opts?.stroke ?? 7;
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	const dash = c * pct;

	const wrap = document.createElement("div");
	wrap.className = "relative grid place-items-center";

	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(size));
	svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

	const bg = document.createElementNS(svg.namespaceURI, "circle");
	bg.setAttribute("cx", String(size / 2));
	bg.setAttribute("cy", String(size / 2));
	bg.setAttribute("r", String(r));
	bg.setAttribute("fill", "none");
	bg.setAttribute("stroke-width", String(stroke));
	bg.setAttribute("stroke", "rgba(34,211,238,0.20)");

	const fg = document.createElementNS(svg.namespaceURI, "circle");
	fg.setAttribute("cx", String(size / 2));
	fg.setAttribute("cy", String(size / 2));
	fg.setAttribute("r", String(r));
	fg.setAttribute("fill", "none");
	fg.setAttribute("stroke-width", String(stroke));
	fg.setAttribute("stroke", "rgba(34,211,238,0.90)");
	fg.setAttribute("stroke-linecap", "round");
	fg.setAttribute("transform", `rotate(-90 ${size / 2} ${size / 2})`);
	fg.setAttribute("stroke-dasharray", `${dash} ${c - dash}`);

	svg.appendChild(bg);
	svg.appendChild(fg);

	const txt = document.createElement("div");
	txt.className = "absolute text-cyan-100 font-bold text-4xl leading-none";
	txt.textContent = String(level);

	const sub = document.createElement("div");
	sub.className = "mt-2 text-sm text-cyan-300/70 text-center";
	sub.textContent = `${clamped} / ${max}`;

	wrap.appendChild(svg);
	wrap.appendChild(txt);

	const container = document.createElement("div");
	container.className = "flex flex-col items-center";
	container.appendChild(wrap);
	container.appendChild(sub);

	return container;
}
//! ------------------------------------------------------------------->







//! Ajout John  === PROFILE STATE (avatar) ===

function resolveAvatarSrc(kind: AvatarKind, value: string): string
{
	const base = IMG_PATH || DEFAULT_IMG_PATH;

	if (kind === "upload" && value && value.startsWith("data:image/"))
		return value;

	if (!value)
		return `${base}/avatars/default.png`;

	return `${base}/avatars/${value}`;
}

//! ------------------------------------------------------->


//! Ajout John === AVATAR PANEL === ------------------------------
function makeAvatarPanel(): HTMLElement
{
  const wrap = document.createElement("div");
  wrap.className = "flex flex-col gap-3 w-full px-4 items-center";

  // --- Preview row ---
  const row = document.createElement("div");
  row.className = "flex flex-col items-center gap-3";

  const preview = document.createElement("div");
  preview.className = "flex items-center gap-4";

  const img = document.createElement("img");
  img.src = resolveAvatarSrc(avatarKind.value, avatarValue.value);
  img.className = "w-20 h-20 rounded-2xl border border-cyan-500/40 object-cover bg-slate-900";

  const meta = document.createElement("div");
  meta.className = "flex flex-col gap-1";
  const kindTxt = document.createElement("div");
  kindTxt.className = "text-cyan-200 text-sm";
  kindTxt.textContent = `Type: ${avatarKind.value}`;
  const hint = document.createElement("div");
  hint.className = "text-cyan-200/70 text-xs";
  hint.textContent = "Choose a preset or upload an image.";

  meta.appendChild(kindTxt);
  meta.appendChild(hint);
  preview.appendChild(img);
  preview.appendChild(meta);

  // hidden file input
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg";
  fileInput.className = "hidden";

  fileInput.addEventListener("change", () =>
  {
	const f = fileInput.files?.[0];
	if (!f) return;

	// Limite volontaire côté front : évite exploser DB / JSON
	// (la limite exacte doit être aussi côté backend)
	const MAX_BYTES = 120 * 1024; // ~120KB
	if (f.size > MAX_BYTES)
	{
	  alert("Image too large (max ~120KB).");
	  fileInput.value = "";
	  return;
	}

	const reader = new FileReader();
	reader.onload = async () =>
	{
	  const dataUrl = String(reader.result || "");
	  if (!dataUrl.startsWith("data:image/"))
	  {
		alert("Invalid image.");
		return;
	  }

	  try
	  {
		const p = await Auth.patchProfile({ avatar_kind: "upload", avatar_value: dataUrl });
		avatarKind.value = (p.avatar_kind === "upload") ? "upload" : "default";
		avatarValue.value = typeof p.avatar_value === "string" ? p.avatar_value : "";
		profileUpdate();
	  }
	  catch (e: any)
	  {
		alert(e?.message ?? "Failed to upload avatar.");
	  }
	};
	reader.readAsDataURL(f);
  });

  const actions = document.createElement("div");
  actions.className = "flex justify-center gap-2";

  const btnPreset = document.createElement("button");
  btnPreset.className = "px-3 py-2 rounded-xl border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10";
  btnPreset.textContent = "Choose preset";
  btnPreset.onclick = () => {
	// ouvre une grille inline juste en dessous
	const grid = makePresetGrid();
	wrap.appendChild(grid);
	btnPreset.disabled = true;
  };

  const btnUpload = document.createElement("button");
  btnUpload.className = "px-3 py-2 rounded-xl border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10";
  btnUpload.textContent = "Upload";
  btnUpload.onclick = () => fileInput.click();

  const btnReset = document.createElement("button");
  btnReset.className = "px-3 py-2 rounded-xl border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10";
  btnReset.textContent = "Default";
  btnReset.onclick = async () =>
  {
	try
	{
	  // Force default avatar filename for consistency
	  const p = await Auth.patchProfile({ avatar_kind: "default", avatar_value: "default.png" });
	  avatarKind.value = "default";
	  // Ensure UI immediately shows default.png even if backend returns empty value
	  avatarValue.value = "default.png";
	  profileUpdate();
	}
	catch (e: any)
	{
	  alert(e?.message ?? "Failed to reset avatar.");
	}
  };

  actions.appendChild(btnPreset);
  actions.appendChild(btnUpload);
  actions.appendChild(btnReset);

  row.appendChild(preview);
  row.appendChild(actions);

  wrap.appendChild(row);
  wrap.appendChild(fileInput);
  return wrap;
}


function makePresetGrid(): HTMLElement
{
  const grid = document.createElement("div");
  grid.className = "grid grid-cols-6 gap-2";

  // +1 = default
  const all = ["default.png", ...PRESET_AVATARS];

  for (const filename of all)
  {
	const cell = document.createElement("button");
	cell.className = "rounded-xl border border-cyan-500/40 hover:bg-cyan-500/10 p-1";

	const img = document.createElement("img");
	img.src = `${IMG_PATH}/avatars/${filename}`;
	img.className = "w-12 h-12 rounded-lg object-cover";

	cell.appendChild(img);

	cell.onclick = async () =>
	{
	  try
	  {
		// Les presets = kind "default" + value = filename
		const p = await Auth.patchProfile({ avatar_kind: "default", avatar_value: filename });
		avatarKind.value = "default";
		avatarValue.value = typeof p.avatar_value === "string" ? p.avatar_value : filename;
		profileUpdate();
	  }
	  catch (e: any)
	  {
		alert(e?.message ?? "Failed to set avatar.");
	  }
	};

	grid.appendChild(cell);
  }

  return grid;
}
//! ----------------------------------------------_>



//! Ajout John ------ PASSWORD CHANGE ----------------
function makePasswordRow(
  label: string,
  valueRef: Ref<string>,
  showRef: Ref<boolean>
): HTMLElement
{
  const row = document.createElement("div");
  row.className = "flex items-center gap-2 w-full px-4";
  row.style.height = "36px";

  const lab = document.createElement("span");
  lab.className = "text-cyan-200";
  lab.style.width = "200px";
  lab.textContent = label;

  const input = document.createElement("input");
  input.className = "flex-1 rounded-lg bg-slate-900/70 border border-cyan-500/30 px-3 text-cyan-100 outline-none";
  input.style.height = "28px";
  input.type = showRef.value ? "text" : "password";
  input.value = valueRef.value;

  input.addEventListener("input", () =>
  {
    valueRef.value = input.value;
  });

  const toggle = document.createElement("button");
  toggle.className = "px-3 py-2 rounded-xl border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10";
  toggle.textContent = showRef.value ? "Hide" : "Show";

  toggle.onclick = () =>
  {
    showRef.value = !showRef.value;
    // re-render simple (on suit la logique globale de Laurent)
    profileUpdate();
  };

  row.appendChild(lab);
  row.appendChild(input);
  row.appendChild(toggle);
  return row;
}

function makePasswordPanel(): HTMLElement
{
  const wrap = document.createElement("div");
  wrap.className = "flex flex-col gap-2 w-full";

  wrap.appendChild(makePasswordRow("Old password:", oldPassword, showOldPassword));
  wrap.appendChild(makePasswordRow("New password:", newPassword, showNewPassword));
  wrap.appendChild(makePasswordRow("Confirm new:", newPasswordConfirm, showNewPasswordConfirm));

  const btn = document.createElement("button");
  btn.className = "mx-4 mt-2 px-3 py-2 rounded-xl border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10";
  btn.textContent = "Update password";

  btn.onclick = async () =>
  {
    const oldP = oldPassword.value;
    const newP = newPassword.value;
    const cfm = newPasswordConfirm.value;

    if (!oldP || !newP || !cfm)
    {
      alert("Fill all password fields.");
      return;
    }
    if (newP !== cfm)
    {
      alert("New passwords do not match.");
      return;
    }
    const err = validateNewPassword(newP);
    if (err)
    {
      alert(err);
      return;
    }

    try
    {
      // IMPORTANT: ici, on appelle Auth.changePassword(old,new).
      await Auth.changePassword( oldP, newP);

      oldPassword.value = "";
      newPassword.value = "";
      newPasswordConfirm.value = "";
      alert("Password updated.");
	  // session est clear (auth-client) + refresh cookie supprimé côté serveur
		const overlay = document.getElementById("login-overlay");
		overlay?.classList.remove("hidden");
		navigateTo("dashboard");

      profileUpdate();
    }
    catch (e: any)
    {
      if (e?.status === 401) alert("Old password is incorrect.");
      else alert(e?.message ?? "Failed to update password.");
    }
  };

  wrap.appendChild(btn);
  return wrap;
}
//! --------------------------------------------------------

function fitTextToContainer( el: HTMLElement, {
		max = 32,   // taille max en px
		min = 14,   // taille min acceptable
		step = 1,
	} = {} ) {

	const w = el.clientWidth;
	if (!w)
		return; // évite fit sur élément pas layouté

	el.style.fontSize = `${max}px`;

	// Force reflow
	el.getBoundingClientRect();

	while (el.scrollWidth > el.clientWidth && max > min) {
		max -= step;
		el.style.fontSize = `${max}px`;
	}
}


export function updateAvatarId(name: string)
{
	switch (name)
	{
		//case "default": gUser.refs.profile.avatar_id.value = 0; break;
		case "a01.png": gUser.refs.profile.avatar_id.value = 1; break;
		case "a02.png": gUser.refs.profile.avatar_id.value = 2; break;
		case "a03.png": gUser.refs.profile.avatar_id.value = 3; break;
		case "a04.png": gUser.refs.profile.avatar_id.value = 4; break;
		case "a05.png": gUser.refs.profile.avatar_id.value = 5; break;
		case "a06.png": gUser.refs.profile.avatar_id.value = 6; break;
		case "a07.png": gUser.refs.profile.avatar_id.value = 7; break;
		case "a08.png": gUser.refs.profile.avatar_id.value = 8; break;
		case "a09.png": gUser.refs.profile.avatar_id.value = 9; break;
		case "a10.png": gUser.refs.profile.avatar_id.value = 10; break;
		default: gUser.refs.profile.avatar_id.value = 0; break;
	}
}

export function getDBUserName(): string
{
	return (userName.value);
}

export function onSessionChangedProfile(): void {
	profileLoaded = false;
	profileLoading = false;
	profileLoadError = null;
	userName.value = "";
	avatarKind.value = "default";
	avatarValue.value = "default.png";
	lastLoadedUserId = null; // Clear user ID tracking on session change
}
