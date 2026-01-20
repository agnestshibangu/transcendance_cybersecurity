// frontend/src/game/menu.ts

import {Ref, makeRef, makeRefsTree} from "./Utils/utils.js"
import {getAudioManager} from "./Core/audio.js"

type MenuBuilder = ReturnType<MenuManager["createMenu"]>;
export const menusData: MenuBuilder[] = [];

export type PickerItem =
{
  id: string;
  icon: string;
  label: string;
  description?: string;
};


export class MenuManager
{
  private container: HTMLElement;
  private overlay: HTMLDivElement;
  private menus: Record<string, HTMLDivElement> = {};
  private menuWidth = 650;

  constructor(container: HTMLElement)
  {
    this.container = container;
    this.overlay = document.createElement("div");
    this.overlay.className = "fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 hidden";
    this.container.appendChild(this.overlay);
  }

  createMenu(id: string, title: string)
  {
    const LABEL_WIDTH = 200;
    const ITEM_HEIGHT = 36;
    const INPUT_HEIGHT = 28;
  
    if (this.menus[id])
      throw new Error(`Menu "${id}" existe déjà`);

    const menu = document.createElement("div");
    menu.id = id;
    menu.className = "flex flex-col items-stretch gap-4 rounded-2xl border border-cyan-500/40 bg-slate-950/80 px-8 py-6 shadow-lg";
    menu.style.width = `${this.menuWidth}px`;

    // Title
    const h1 = document.createElement("h1");
    h1.className = "text-3xl font-bold text-cyan-200 mb-4 text-center";
    h1.textContent = title;
    menu.appendChild(h1);

    //subtitle
    const subTitleBar = document.createElement("div");
    subTitleBar.className = "flex items-center justify-between w-full px-4 mb-2";
    menu.appendChild(subTitleBar);

    // Scroll area
    const content = document.createElement("div");
    content.className = "flex flex-col gap-3 w-full";
    content.style.maxHeight = "40vh";
    content.style.overflowY = "auto";
    content.style.paddingRight = "6px";
    const nav = document.createElement("nav");
    nav.className = "flex flex-col items-stretch gap-3 w-full";
    content.appendChild(nav);
    menu.appendChild(content);
    this.menus[id] = menu;
    this.overlay.appendChild(menu);

    const makeRow = () =>
    {
      const el = document.createElement("div");
      el.className = "flex items-center gap-2 w-full px-4";
      el.style.height = `${ITEM_HEIGHT}px`;
      return el;
    };

    const makeLabel = (label: string) =>
    {
      const span = document.createElement("span");
      span.textContent = label;
      span.style.width = `${LABEL_WIDTH}px`;
      span.className = "text-cyan-200";
      return span;
    };

    // ---- RETURN BUILDER ----
    return {
      setTitle: (newTitle: string) =>
      {
        h1.textContent = newTitle;
      },
      setSubTitle: (pos: "LEFT" | "RIGHT", text?: string, icon?: string, value?: string | number) =>
      {
          subTitleBar.innerHTML = "";
          const container = document.createElement("div");
          container.className = "flex items-center gap-2";
          if (icon)
          {
              const img = document.createElement("img");
              img.src = icon;
              img.style.width = "28px";
              img.style.height = "28px";
              img.style.objectFit = "contain";
              container.appendChild(img);
          }
          if (text)
          {
              const span = document.createElement("span");
              span.textContent = text;
              span.className = "text-cyan-200 text-lg font-semibold";
              container.appendChild(span);
          }
          if (value != null)
          {
              const span = document.createElement("span");
              span.textContent = value.toString();
              span.className = "text-cyan-300 text-xl font-bold";
              container.appendChild(span);
          }
          if (pos === "LEFT")
          {
              subTitleBar.appendChild(container);
              subTitleBar.appendChild(document.createElement("div"));
          }
          else
          {
              subTitleBar.appendChild(document.createElement("div"));
              subTitleBar.appendChild(container);
          }
          return (container);
      },

      addButton: (label: string, onClick: () => void) =>
      {
        const btn = document.createElement("button");
        btn.className = "nav-pill w-full text-lg";
        btn.textContent = label;
        btn.onclick = onClick;
        nav.appendChild(btn);
        return btn;
      },

      // === CHECKBOX ===
      addCheckbox: (label: string, ref: Ref<boolean>) =>
      {
        const row = makeRow();
        const lab = makeLabel(label);
        const inputZone = document.createElement("div");
        inputZone.className = "flex-1 flex items-center justify-center";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = ref.value;
        input.oninput = () =>
        {
          ref.value = input.checked;
          ref.listeners.forEach(fn => fn(ref.value));
        };

        inputZone.appendChild(input);
        row.appendChild(lab);
        row.appendChild(inputZone);
        nav.appendChild(row);

        return input;
      },


      // === SLIDER ===
      addSlider: (label: string, min: number, max: number, ref: Ref<number>, showPercent = false, onChange?: (() => void) | null, playsound?: {type:number, name: string} | null) =>
      {
        const row = makeRow();
        const lab = makeLabel(label);
        const valueText = document.createElement("span");

        valueText.className = "text-cyan-300 w-12 text-right text-sm";
        valueText.style.flexShrink = "0";
        valueText.style.textAlign = "right";
        valueText.style.width = showPercent ? "4ch" : "5ch";
        const input = document.createElement("input");
        input.type = "range";
        input.min = min.toString();
        input.max = max.toString();
        input.className = "flex-1";
        input.style.height = `${INPUT_HEIGHT}px`;
        const updateUI = (v: number) => 
        {
          input.value = v.toString();
          valueText.textContent = showPercent ? `${Math.round(((v - min) / (max - min)) * 100)}%` : v.toString();
        };
        updateUI(ref.value);
        input.oninput = () =>
        {
          ref.value = parseInt(input.value);
          ref.listeners.forEach(fn => fn(ref.value));
          if (onChange)
            onChange();
        };
        if (playsound != null)
        {
          input.addEventListener("input", () =>
          {
              const audio = getAudioManager();
              switch (playsound.type)
              {
                case 0:audio?.ui?.play(playsound.name);break;
                case 1:audio?.sfx?.play(playsound.name);break;
                case 2:audio?.music?.play(playsound.name);break;
              }
          });
        }
        ref.listeners.add(updateUI);
        row.appendChild(lab);
        row.appendChild(valueText);
        row.appendChild(input);
        nav.appendChild(row);
        return input;
      },

      // === COLOR PICKER ===
      addColor: (label: string, ref: Ref<string>) =>
      {
        const row = makeRow();
        const lab = makeLabel(label);
        const input = document.createElement("input");
        input.type = "color";
        input.value = ref.value
        input.style.flex = "1";
        input.oninput = () => 
        {
          ref.value = input.value;
          ref.listeners.forEach(fn => fn(ref.value));
        };
        row.appendChild(lab);
        row.appendChild(input);
        nav.appendChild(row);
        return (input);
      },

      // === SELECT ===
      addSelect: (label: string, options: string[], value: string, onChange: (v: string) => void) =>
      {
        const row = makeRow();
        const lab = makeLabel(label);

        const select = document.createElement("select");
        select.className = "flex-1";
        select.style.height = `${INPUT_HEIGHT}px`;

        options.forEach(opt => {
          const o = document.createElement("option");
          o.value = o.textContent = opt;
          select.appendChild(o);
        });

        select.value = value || options[0] || "";
        select.style.color = "#000";
        select.onchange = () => onChange(select.value);

        row.appendChild(lab);
        row.appendChild(select);

        nav.appendChild(row);
        return select;
      },

      // === TEXTBOX ===
      addTextbox(label: string, ref: Ref<string>)
      {
        const row = makeRow();
        const lab = makeLabel(label);
        const input = document.createElement("input");
        input.type = "text";
        input.value = ref.value;
        input.style.color = "#000000ff";
        input.style.flex = "1";
        input.style.height = `${INPUT_HEIGHT}px`;
        input.style.paddingLeft = "6px";
        row.appendChild(lab);
        row.appendChild(input);
        input.oninput = () =>
        {
          ref.value = input.value;
          ref.listeners.forEach(fn => fn(ref.value));
        };
        nav.appendChild(row);
        return (input);
      },

      /*addTextbox2: (label: string, options?: { showSetButton?: boolean; onChange: (v: string) => void }) =>
      {
        const row = makeRow();
        const lab = makeLabel(label);

        const input = document.createElement("input");
        input.type = "text";
        input.value = "";
        input.style.color = "#000000ff";
        input.style.flex = "1";
        input.style.height = `${INPUT_HEIGHT}px`;
        input.style.paddingLeft = "6px"; // padding pour le texte
        row.appendChild(lab);
        row.appendChild(input);
        if (options?.showSetButton)
        {
          const btn = document.createElement("button");
          btn.textContent = "Set";
          btn.className = "nav-pill text-sm px-2 py-1 flex-shrink-0"; 
          btn.onclick = () => options.onChange(input.value);
          row.appendChild(btn);
        }
        nav.appendChild(row);
        return (input);
    },*/
	//! -----------  AJOUT JOHN Version modif de addTextbox2
	addTextbox2: (
		label: string,
		options?: {
			showSetButton?: boolean;
			initialValue?: string;
			maxLength?: number;
			sanitize?: (v: string) => string;
			onChange?: (v: string) => void;
			onSet?: (v: string) => void | Promise<void>;
		}
		) =>
		{
		const row = makeRow();
		const lab = makeLabel(label);

		const input = document.createElement("input");
		input.type = "text";
		input.value = options?.initialValue ?? "";
		if (options?.maxLength != null) input.maxLength = options.maxLength;

		input.style.color = "#000000ff";
		input.style.flex = "1";
		input.style.height = `${INPUT_HEIGHT}px`;
		input.style.paddingLeft = "6px";

		const applySanitize = () =>
		{
			if (!options?.sanitize) return;
			const cleaned = options.sanitize(input.value);
			if (cleaned !== input.value) input.value = cleaned;
		};

		input.oninput = () =>
		{
			applySanitize();
			options?.onChange?.(input.value);
		};

		row.appendChild(lab);
		row.appendChild(input);

		if (options?.showSetButton)
		{
			const btn = document.createElement("button");
			btn.textContent = "Set";
			btn.className = "nav-pill text-sm px-2 py-1 flex-shrink-0";
			btn.onclick = () =>
			{
			applySanitize();
			if (options?.onSet) void options.onSet(input.value);
			else options?.onChange?.(input.value);
			};
			row.appendChild(btn);
		}

		nav.appendChild(row);
		return input;
		},

		//! ------------------------------------------->

      addTrophies: (label: string, type: number, unlocked: boolean, showinfo = true) =>
      {
        const row = makeRow();
        const lab = makeLabel(label);

        if (!unlocked && !showinfo)
          lab.textContent = "> Hidden Trophy <";
        const rightZone = document.createElement("div");
        rightZone.className = "flex-1 flex items-center justify-end gap-2";
        const icon = document.createElement("img");
        icon.style.width = "32px";
        icon.style.height = "32px";
        icon.style.objectFit = "contain";
        icon.className = "text-cyan-200 text-right";
        if (!unlocked)
        {
          icon.src = "../../public/images/trophy/lock.png";
        }
        else
        {
          switch (type)
          {
            case 0:
              icon.src = "../../public/images/trophy/bronze.png";
              break;
            case 1:
              icon.src = "../../public/images/trophy/silver.png";
              break;
            case 2:
              icon.src = "../../public/images/trophy/gold.png";
              break;
            default:
              icon.src = "../../public/images/trophy/bronze.png";
          }
        }
        rightZone.appendChild(icon);
        row.appendChild(lab);
        row.appendChild(rightZone);
        nav.appendChild(row);
        return { row, icon };
      },

      addSection: (label: string) =>
      {
        const row = document.createElement("div");
        row.className = "flex items-center gap-3 w-full px-4 py-2";
        const lineLeft = document.createElement("div");
        lineLeft.className = "flex-1 h-px bg-cyan-500/30";
        const text = document.createElement("span");
        text.textContent = label;
        text.className = "text-cyan-300 text-sm font-semibold whitespace-nowrap";
        const lineRight = document.createElement("div");
        lineRight.className = "flex-1 h-px bg-cyan-500/30";
        row.appendChild(lineLeft);
        row.appendChild(text);
        row.appendChild(lineRight);
        nav.appendChild(row);
        return (row);
      },
      // === LABEL ===
      addLabel: (label: string, value: string) =>
      {
        const row = makeRow();
        const lab = makeLabel(label);

        const valueZone = document.createElement("div");
        valueZone.className = "flex-1 flex items-center justify-end";

        const txt = document.createElement("span");
        txt.textContent = value;
        txt.className = "text-cyan-200 text-right";

        valueZone.appendChild(txt);
        row.appendChild(lab);
        row.appendChild(valueZone);
        nav.appendChild(row);

        return txt;
     },
	 //! Ajout John  == CUSTOM ==
	 addCustom: (node: HTMLElement) =>
		{
		nav.appendChild(node);
		return node;
		},
	//! ------------------------------>

      // === COIN CARD ===
      addCoinCard: (skin: { iconSkin: string; name: string; price: number | string; onClick?: () => void; }) =>
      {
        const btn = document.createElement("button");
        btn.className =
          "flex items-center justify-between gap-4 w-full px-4 py-3 rounded-xl border border-cyan-500/40 " +
          "bg-slate-900/60 hover:bg-slate-800/60 transition text-left";

        const img = document.createElement("img");
        img.src = skin.iconSkin;
        img.style.width = "64px";
        img.style.height = "64px";
        img.style.objectFit = "contain";

        const info = document.createElement("div");
        info.className = "flex flex-col flex-1";

        const name = document.createElement("span");
        name.textContent = skin.name;
        name.className = "text-cyan-200 text-lg font-bold";

        const priceRow = document.createElement("div");
        priceRow.className = "flex items-center gap-2";

        const price = document.createElement("span");
        price.textContent = skin.price.toString();
        price.className = "text-cyan-300 text-lg font-bold";

        const coin = document.createElement("img");
        coin.src = "../../public/images/coin/SC.png";
        coin.style.width = "28px";
        coin.style.height = "28px";

        priceRow.appendChild(price);
        priceRow.appendChild(coin);

        info.appendChild(name);
        info.appendChild(priceRow);

        btn.appendChild(img);
        btn.appendChild(info);

        if (skin.onClick) btn.onclick = skin.onClick;

        nav.appendChild(btn);
        return btn;
      },

      addSkinPicker(skins: { id: number; icon: string; label: string; description?: string; onPick: (id: number) => void; }[], selectedSkinId: number )
      {
        const row = document.createElement("div");
        row.className = "grid grid-cols-3 gap-2 w-full px-4";

        skins.forEach(skin =>
        {
          const isSelected = skin.id === selectedSkinId;

          const card = document.createElement("button");
          card.className = "relative flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border border-cyan-500/40 bg-slate-900/60 hover:bg-slate-800/60 transition text-center"; + (isSelected ? "border-green-400 bg-slate-800/80" : "border-cyan-500/40 bg-slate-900/60 hover:bg-slate-800/60");

          const img = document.createElement("img");
          img.src = skin.icon;
          img.style.width = "128px";
          img.style.height = "128px";
          img.style.objectFit = "contain";

          const title = document.createElement("span");
          title.textContent = skin.label;
          title.className = "text-cyan-200 text-base font-bold";

          const desc = document.createElement("span");
          desc.textContent = skin.description ?? "";
          desc.className = "text-cyan-300/70 text-xs leading-none";

          card.append(img, title, desc);

          // ✔ checkbox visuel
          if (isSelected) {
            const check = document.createElement("div");
            check.textContent = "✔";
            check.className =
              "absolute bottom-2 right-2 w-6 h-6 rounded-md bg-green-500 text-black text-sm font-bold flex items-center justify-center shadow-md";
            card.appendChild(check);
          }

          card.onclick = () => skin.onPick(skin.id);

          row.appendChild(card);
        });

        nav.appendChild(row);
        return row;
      },

      // === MODE ROW 3x GRID ===
      addModeRow: (items: { icon: string; label: string; description?: string; onClick?: () => void; }[]) =>
      {
        const row = document.createElement("div");
        row.className = "grid grid-cols-3 gap-2 w-full px-4";

        items.forEach(m =>
        {
          const card = document.createElement("button");
          card.className = "relative flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border border-cyan-500/40 bg-slate-900/60 hover:bg-slate-800/60 transition text-center";


          const img = document.createElement("img");
          img.src = m.icon || "";
          img.style.width = "128px";
          img.style.height = "128px";
          img.style.objectFit = "contain";

          const title = document.createElement("span");
          title.textContent = m.label;
          title.className = "text-cyan-200 text-base font-bold";

          const desc = document.createElement("span");
          desc.textContent = m.description ?? "";
          desc.className = "text-cyan-300/70 text-xs leading-none";

          card.appendChild(img);
          card.appendChild(title);
          card.appendChild(desc);

          if (m.onClick)
            card.onclick = m.onClick;

          row.appendChild(card);
        });

        nav.appendChild(row);
        return row;
      },
      addYesNo: (onYes: () => void, onNo: () => void) =>
      {
        const row = document.createElement("div");
        row.className = "flex justify-center gap-6 w-full px-4 py-4";

        const makeCard = (label: string, onClick: () => void) =>
        {
          const btn = document.createElement("button");
          btn.className = "flex flex-col items-center justify-center gap-3 px-6 py-5 rounded-xl " +
          "border border-cyan-500/40 bg-slate-900/60 hover:bg-slate-800/60 transition text-center " +
          "hover:shadow-[0_0_16px_rgba(34,211,238,0.35)]";
          btn.style.width = "200px";
          const text = document.createElement("span");
          text.textContent = label;
          text.className = "text-cyan-200 text-xl font-bold";
          btn.appendChild(text);
          btn.onclick = onClick;
          return (btn);
        };
        const yes = makeCard("YES", onYes);
        const no = makeCard("NO", onNo);
        row.appendChild(yes);
        row.appendChild(no);
        nav.appendChild(row);
        return { yes, no };
      },



      // === SHOW / HIDE ===
      show: () => {
        Object.values(this.menus).forEach(m => m.classList.add("hidden"));
        menu.classList.remove("hidden");
        this.overlay.classList.remove("hidden");
      },

      hide: () =>
      {
        menu.classList.add("hidden");
        this.overlay.classList.add("hidden");
      },

      clear: () =>
      {
        while (nav.firstChild)
          nav.removeChild(nav.firstChild);
      },

      reload: (x: () => void) =>
      {
        while (nav.firstChild)
          nav.removeChild(nav.firstChild);
        if (x)
          x();
      }
    };
  }

  showMenu(id: string) {
    const menu = this.menus[id];
    if (!menu) return;
    Object.values(this.menus).forEach(m => m.classList.add("hidden"));
    menu.classList.remove("hidden");
    this.overlay.classList.remove("hidden");
  }

  hideMenu(id: string) {
    const menu = this.menus[id];
    if (!menu) return;
    menu.classList.add("hidden");
    this.overlay.classList.add("hidden");
  }

  toggleMenu(id: string)
  {
    const menu = this.menus[id];
    if (!menu)
        return;
    menu.classList.contains("hidden") ? this.showMenu(id) : this.hideMenu(id);
  }
}
