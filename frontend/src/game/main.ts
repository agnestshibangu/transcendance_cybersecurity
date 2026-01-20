import { initMenus } from "./menusLoad.js";
import { MenuManager } from "./menu.js";

export let menus: MenuManager;

export function g_main()
{
  const root = document.getElementById("game-root")!;

	window.addEventListener("pageshow", (e) =>
	{
		if (e.persisted) window.location.reload();
	});
	if (!(root instanceof HTMLDivElement))
		throw new Error("game-root is not a div!");
	initMenus(root);
}