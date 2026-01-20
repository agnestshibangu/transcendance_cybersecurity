// frontend/src/game/menusLoad.ts

import { makeStandaloneRef } from "./Utils/utils.js"
import { MenuManager, menusData } from "./menu.js";
import { fakePay } from "./peypole.js";
import { gUser } from "./Core/user.js";
import { getAudioManager } from "./Core/audio.js";
import * as Auth from "../spa/auth-client.js";
import { navigateTo } from "../spa/router.js";
import { profileMenu, initProfile } from "./profile.js";
import { startPresenceLoop } from "../spa/presence.js";
import { SKIN_PACKS } from "./skinPacks.js";
import { stopEngine, startEngine } from "./Core/Engine.js";
import { getTrophyStatus, TROPHIES } from "./trophies.js";

export const IMG_PATH = "../../public/images";

export enum MenuId
{
    sub_main = 0,
    sub_play,
    sub_pve,
    sub_pvp,
    sub_2v2,
    sub_tnm,
    sub_settings,
    sub_trophy,
    sub_profile,
    sub_stats,
    sub_store,
    sub_peypole,
    sub_paused,
    sub_action,
    sub_max
}

let subs: any;
let xroot: any;

const var_goals = makeStandaloneRef(10);
const var_timelimit = makeStandaloneRef(10);
const var_difficulty = makeStandaloneRef(1);
const var_timescale = makeStandaloneRef(10);
const var_clientsCount = makeStandaloneRef(0);

const email = makeStandaloneRef("");
const password = makeStandaloneRef("");
let sherpaCoinStore = 0;
let sherpaCoinPriceStore = "";

function resetGameSettings()
{
    var_goals.value = 10;
    var_timelimit.value = 10;
    var_difficulty.value = 1;
    var_timescale.value = 10;
    var_clientsCount.value = 0;
    menusData[MenuId.sub_pve].reload(pveMenu);
    menusData[MenuId.sub_pvp].reload(pvpMenu);
    menusData[MenuId.sub_2v2].reload(_2vs2Menu);
    menusData[MenuId.sub_tnm].reload(tournamentMenu);
}

function updateDifficulty(v: string)
{
    switch (v)
    {
        case "Easy": var_difficulty.value = 0; break;
        case "Normal": var_difficulty.value = 1; break;
        case "Hard": var_difficulty.value = 2; break;
        case "Insane": var_difficulty.value = 3; break;
    }
}

function ActionMenu(title: string, onYes: () => void | Promise<void>, onNo: () => void) //! ajout de  " | Promise<void> "
{
    const sub = menusData[MenuId.sub_action];

    sub.clear();
    sub.setTitle(title);
    //sub.addYesNo(onYes, onNo);
	sub.addYesNo(
		() => { void onYes(); },  // accepte async sans warning
		() => onNo()
	);
    sub.show();
}

function onTrophiesSubmenu()
{
    const sub = menusData[MenuId.sub_trophy];

    sub.clear();
    for(const trophy of TROPHIES)
    {
      sub.addTrophies(trophy.name, trophy.type, getTrophyStatus(trophy.id));
    }
    sub.addButton("Back", () => subs.showMenu("menu-main"));
    sub.show();
}

function onStatsMenu()
{
    const sub = menusData[MenuId.sub_stats];

    sub.clear();
    sub.addLabel("Level:", gUser.network.stats.level.toString());
    sub.addLabel("XP:", `${gUser.network.stats.xp.toString()} / ${(975 * gUser.network.stats.level).toString()}`);
    sub.addLabel("Win:", gUser.network.stats.win.toString());
    sub.addLabel("Lose:", gUser.network.stats.lose.toString());
    sub.addLabel("Goals:", gUser.network.stats.goals.toString());
    sub.addLabel("Goals Taken:", gUser.network.stats.goalsTaken.toString());
    sub.addLabel("Total XP Earned:", gUser.network.stats.totalXp.toString());
    sub.addLabel("Total Match:", gUser.network.stats.totalMatch.toString());
    sub.addButton("Back", () => subs.showMenu("menu-main"));
    sub.show();
}

function onPeypoleSubmenu(coins: number, price:string)
{
    sherpaCoinStore = coins;
    sherpaCoinPriceStore = price;
    email.value = "";
    password.value = "";

    const sub = menusData[MenuId.sub_peypole];
    sub.clear();
    sub.setSubTitle("RIGHT", `${sherpaCoinStore} SherpaCoin - ${sherpaCoinPriceStore}`);
    sub.addTextbox("Email:", email);
    sub.addTextbox("Password:", password);
    sub.addButton("Login (very secure)", () => 
    {
        const ok = fakePay(email.value, password.value);

        if (!ok)
            return;
        email.value = "";
        password.value = "";
        gUser.refs.store.sherpaCoin.value = gUser.refs.store.sherpaCoin.value + sherpaCoinStore;
        alert("Payment validated by Sherpa Council 🐐");
        menusData[MenuId.sub_store].reload(storeMenu);
        menusData[MenuId.sub_paused].reload(pauseMenu);
        menusData[MenuId.sub_settings].reload(settingsMenu);
        menusData[MenuId.sub_store].show();
    });
    sub.addButton("Back", () => subs.showMenu("menu-store"));
    sub.show();
}



function mainMenu()
{
    const sub = menusData[MenuId.sub_main];

    sub.addButton("PLAY", () => subs.showMenu("menu-play"));
    sub.addButton("SETTINGS", () => subs.showMenu("menu-settings"));
    sub.addButton("PROFILE", () => {
	// reconstruit le contenu du menu profile à chaque ouverture
	menusData[MenuId.sub_profile].reload(profileMenu);
	subs.showMenu("menu-profile");
    });
    sub.addButton("STATS", () => onStatsMenu());
    sub.addButton("TROPHIES", () => onTrophiesSubmenu());
    sub.addButton("STORE", () => subs.showMenu("menu-store"));
    sub.addButton("LOGOUT", () => 
		ActionMenu("Logout ?", //() => null, () => subs.showMenu("menu-main")));
			async () =>
			{
				try
				{
					await Auth.logout(); // POST /api/auth/logout + clearSession()
				}
				finally
				{
					// 1) masquer l'UI du jeu (évite overlay/menu en double)
					subs?.hideMenu?.("menu-main"); // si hideMenu existe
					// fallback si hideMenu n'existe pas:
					// subs?.showMenu("menu-main"); // ou rien

					// 2) afficher l'overlay login
					const overlay = document.getElementById("login-overlay");
					overlay?.classList.remove("hidden");

					// 3) revenir sur une vue propre SPA
					navigateTo("dashboard");
				}
			}, () => subs.showMenu("menu-main")
		)
	);
}

function playMenu()
{
    const sub = menusData[MenuId.sub_play];

    sub.addModeRow(
    [
        { icon: `${IMG_PATH}/icons/pve.png`, label: "PvE", description: "Player vs AI", onClick: () => subs.showMenu("menu-pve")},
        { icon: `${IMG_PATH}/icons/pvp.png`, label: "PvP", description: "Player vs Player (Local Only)", onClick: () => subs.showMenu("menu-pvp")},
        { icon: `${IMG_PATH}/icons/2v2.png`, label: "2 vs 2", description: "Players and AI", onClick: () => subs.showMenu("menu-2v2") },
        { icon: `${IMG_PATH}/icons/tournament.png`, label: "Tournament", description: "Player vs AI League", onClick: () => subs.showMenu("menu-tnm") },
        { icon: `${IMG_PATH}/icons/fakedash.png`, label: "FakeDash", description: "NyTekCFW Gamemode Ported", onClick: () => {startEngine(xroot, {gamemode: "fakedash", goalLimit: 1, timeLimit: 1, difficulty: 0, timescale:1.0, clientCounts: 0}); sub.hide()} }
    ]);
    sub.addButton("Back", () => subs.showMenu("menu-main"));
}

function pveMenu()
{
    const sub = menusData[MenuId.sub_pve];

    sub.addSlider("Win Score:", 1, 40, var_goals);
    sub.addSlider("Duration:", 1, 30, var_timelimit);
    sub.addSlider("Timescale:", 1, 20, var_timescale);
    sub.addSelect("Difficulty", ["Easy", "Normal", "Hard", "Insane"], "Normal", (v:string) => updateDifficulty(v));
    sub.addButton("Reset To Default", () => resetGameSettings());
    sub.addButton("Start Game", () => {startEngine(xroot, {gamemode: "pve", goalLimit: var_goals.value, timeLimit: var_timelimit.value, difficulty: var_difficulty.value, timescale:(var_timescale.value / 10.0), clientCounts: 0}); sub.hide()});
    sub.addButton("Back", () => subs.showMenu("menu-play"));
}

function pvpMenu()
{
    const sub = menusData[MenuId.sub_pvp];

    sub.addSlider("Win Score:", 1, 40, var_goals);
    sub.addSlider("Duration:", 1, 20, var_timelimit);
    sub.addSlider("Timescale:", 1, 20, var_timescale);
    sub.addButton("Reset To Default", () => resetGameSettings());
    sub.addButton("Start Game", () => {startEngine(xroot, {gamemode: "pvp", goalLimit: var_goals.value, timeLimit: var_timelimit.value, difficulty: var_difficulty.value, timescale:(var_timescale.value / 10.0), clientCounts: 0}); sub.hide()});
    sub.addButton("Back", () => subs.showMenu("menu-play"));
}

function _2vs2Menu()
{
    const sub = menusData[MenuId.sub_2v2];

    sub.addSlider("Win Score:", 1, 40, var_goals);
    sub.addSlider("Duration:", 1, 30, var_timelimit);
    sub.addSlider("Timescale:", 1, 20, var_timescale);
    sub.addSlider("Add Human's Player:", 0, 3, var_clientsCount);
    sub.addSelect("Difficulty", ["Easy", "Normal", "Hard", "Insane"], "Normal", (v:string) => updateDifficulty(v));
    sub.addButton("Reset To Default", () => resetGameSettings());
    sub.addButton("Start Game", () => {startEngine(xroot, {gamemode: "2v2", goalLimit: var_goals.value, timeLimit: var_timelimit.value, difficulty: var_difficulty.value, timescale:(var_timescale.value / 10.0), clientCounts: var_clientsCount.value}); sub.hide()});
    sub.addButton("Back", () => subs.showMenu("menu-play"));
}

function tournamentMenu()
{
    const sub = menusData[MenuId.sub_tnm];

    sub.addSlider("Match Win Score:", 1, 40, var_goals);
    sub.addSlider("Match Max Duration:", 1, 30, var_timelimit);
    sub.addSlider("Timescale:", 1, 20, var_timescale);
    sub.addSelect("Difficulty", ["Easy", "Normal", "Hard", "Insane"], "Normal", (v:string) => updateDifficulty(v));
    sub.addButton("Reset To Default", () => resetGameSettings());
    sub.addButton("Start Game", () => {startEngine(xroot, {gamemode: "tnm", goalLimit: var_goals.value, timeLimit: var_timelimit.value, difficulty: var_difficulty.value, timescale:(var_timescale.value / 10.0), clientCounts: 0}); sub.hide()});
    sub.addButton("Back", () => subs.showMenu("menu-play"));
}

function settingsMenu()
{
    const audio = getAudioManager();
    const sub = menusData[MenuId.sub_settings];

    sub.addSection("Global Volume");
    sub.addSlider("UI Volume:", 0, 100, gUser.refs.settings.volume_ui, true, audio?.updateUIVolume, {type: 0, name: "click"});
    sub.addSlider("SFX Volume:", 0, 100, gUser.refs.settings.volume_sfx, true, audio?.updateSFXVolume, {type: 1, name: "testSFX"});
    sub.addSlider("Music Volume:", 0, 100, gUser.refs.settings.volume_music, true, audio?.updateMusicVolume);
    sub.addSection("Visuals");
    sub.addCheckbox("Enable FX:", gUser.refs.settings.fx_enabled);
    sub.addCheckbox("Display FPS:", gUser.refs.settings.r_showFPS);
    sub.addCheckbox("Show Ball Trail:", gUser.refs.settings.r_balltrail);
    sub.addCheckbox("Show Ingame UserInfo:", gUser.refs.settings.r_showUsers);
    sub.addSection("Skins Pack");
    sub.addSkinPicker(SKIN_PACKS.filter(s => gUser.network.store.skinsPackBought[s.id]).map(s => ({ id: s.id, icon: `${IMG_PATH}${s.preview}`, label: s.name, onPick: (id) => { gUser.refs.settings.skinPackId.value = id; menusData[MenuId.sub_settings].reload(settingsMenu);}})), gUser.refs.settings.skinPackId.value);
    sub.addButton("Back", () => subs.showMenu("menu-main"));
}

function BoughtSkinPackStatus(id: number, price: number)
{
    const audio = getAudioManager();

    if (!gUser.network.store.skinsPackBought[id])
    {
        if (gUser.network.store.sherpaCoin - price < 0)
        {
            if (audio)
                audio?.ui.play("boughtfail");
            alert("Payment refused by Sherpa Council, not enought SherpaCoin🐐");
            return;
        }
        gUser.network.store.skinsPackBought[id] = true;
        gUser.refs.store.sherpaCoin.value -= price;
        if (audio)
            audio?.ui.play("boughtsuccess");
        alert("Payment accepted🐐");
        //syncDB
        menusData[MenuId.sub_store].reload(storeMenu);
        menusData[MenuId.sub_paused].reload(pauseMenu);
        menusData[MenuId.sub_settings].reload(settingsMenu);
        menusData[MenuId.sub_store].show();
    }
}

function storeMenu()
{
    const sub = menusData[MenuId.sub_store];

    sub.setSubTitle("RIGHT", "", `${IMG_PATH}/coin/SC.png`, gUser.network.store.sherpaCoin);
    sub.addSection("Skins Pack");

    for (const pack of SKIN_PACKS)
    {
        if (gUser.network.store.skinsPackBought[pack.id])
            continue;
        sub.addCoinCard({ iconSkin: `${IMG_PATH}${pack.preview}`, name: pack.name, price: pack.price, onClick: () => ActionMenu( `Buy ${pack.name} for ${pack.price} coins?`, () => BoughtSkinPackStatus(pack.id, pack.price), () => sub.show() )});
    }
    sub.addSection("SherpaCoin");
    sub.addModeRow(
    [
        { icon: `${IMG_PATH}/coin/SC_30.png`, label: "2400 SherpaCoin", description: "19.99$", onClick: () => onPeypoleSubmenu(2400, "19.99$")},
        { icon: `${IMG_PATH}/coin/SC_50.png`, label: "3000 SherpaCoin", description: "29.99$", onClick: () => onPeypoleSubmenu(3000, "29.99$")},
        { icon: `${IMG_PATH}/coin/SC_100.png`, label: "15000 SherpaCoin", description: "99.99$", onClick: () => onPeypoleSubmenu(15000, "99.99$") }
    ]);
    sub.addButton("Back", () => subs.showMenu("menu-main"));
}

function pauseMenu()
{
    const audio = getAudioManager();

    const sub = menusData[MenuId.sub_paused];

    sub.addSection("Global Volume");
    sub.addSlider("UI Volume:", 0, 100, gUser.refs.settings.volume_ui, true, audio?.updateUIVolume, {type: 0, name: "click"});
    sub.addSlider("SFX Volume:", 0, 100, gUser.refs.settings.volume_sfx, true, audio?.updateSFXVolume, {type: 1, name: "testSFX"});
    sub.addSlider("Music Volume:", 0, 100, gUser.refs.settings.volume_music, true, audio?.updateMusicVolume);
    sub.addSection("Visuals");
    sub.addCheckbox("Enable FX:", gUser.refs.settings.fx_enabled);
    sub.addCheckbox("Display FPS:", gUser.refs.settings.r_showFPS);
    sub.addCheckbox("Show Ball Trail:", gUser.refs.settings.r_balltrail);
    sub.addCheckbox("Show Ingame UserInfo:", gUser.refs.settings.r_showUsers);
    sub.addSection("Skins Pack");
    sub.addSkinPicker(SKIN_PACKS.filter(s => gUser.network.store.skinsPackBought[s.id]).map(s => ({ id: s.id, icon: `${IMG_PATH}${s.preview}`, label: s.name, onPick: (id) => { gUser.refs.settings.skinPackId.value = id; menusData[MenuId.sub_paused].reload(pauseMenu);}})), gUser.refs.settings.skinPackId.value);
    sub.addButton("Give Up", () => { stopEngine();});
}

export function showMainMenu(): void
{
	if (!subs) return;
	subs.showMenu("menu-main");
}

export function initMenus(root:HTMLDivElement)
{
	if (menusData.length > 0)
	{
		subs?.showMenu("menu-main");
		return;
	}

    xroot = root;
    const obj = new MenuManager(root);
    menusData.push(obj.createMenu("menu-main", "Main Menu"));
    menusData.push(obj.createMenu("menu-play", "Play Menu"));
    menusData.push(obj.createMenu("menu-pve", "PVE Settings Menu"));
    menusData.push(obj.createMenu("menu-pvp", "PVP Settings Menu"));
    menusData.push(obj.createMenu("menu-2v2", "2 vs 2 Settings Menu"));
    menusData.push(obj.createMenu("menu-tnm", "Tournament Settings Menu"));
    menusData.push(obj.createMenu("menu-settings", "Settings"));
    menusData.push(obj.createMenu("menu-trophy", "Trophies Menu"));
    menusData.push(obj.createMenu("menu-profile", "Profile"));
    menusData.push(obj.createMenu("menu-stats", "Stats Menu"));
    menusData.push(obj.createMenu("menu-store", "Store Menu"));
    menusData.push(obj.createMenu("menu-peypole", "PeyPole™ Secure Payment"));
    menusData.push(obj.createMenu("menu-paused", "Pause Menu"));
    menusData.push(obj.createMenu("menu-action", ""));
    subs = obj;
	initProfile({ subs, gUser, IMG_PATH });

	startPresenceLoop();

    mainMenu();
    playMenu();
    pveMenu();
    pvpMenu();
    _2vs2Menu();
    tournamentMenu();
    settingsMenu();
    storeMenu();
    pauseMenu();
    //profileMenu();
    subs.showMenu("menu-main");
}

export function ShowPauseMenu(open: boolean)
{
    if (open)
    {
        subs.showMenu("menu-paused");
        return;
    }
    subs.hideMenu("menu-paused");
}

export function getSubs()
{
    return (subs);
}
