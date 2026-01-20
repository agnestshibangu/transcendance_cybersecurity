import { Resources } from "./Core/Ressources.js";
import { gUser } from "./Core/user.js";
import { irandom } from "./Utils/math.js";

export type SkinPackConfig =
{
  id: number;
  name: string;
  price: number;
  preview: string;
};

export const SKIN_PACKS: SkinPackConfig[] =
[
  {
    id: 0,
    name: "Default",
    price: 0,
    preview: "/skins/default/preview.png",
  },
  {
    id: 1,
    name: "Galaxy Pack",
    price: 3000,
    preview: "/skins/galaxy/preview.png",
  },
  {
    id: 2,
    name: "Moon Pack",
    price: 2400,
    preview: "/skins/moon/preview.png",
  },
  {
    id: 3,
    name: "Pocket Master",
    price: 2800,
    preview:"/skins/pokemon/preview.png",
  },
  {
    id: 4,
    name: "Call of Duty: Zombies",
    price: 3600,
    preview:"/skins/codzm/preview.png",
  },
];

export function getBackgroundSkin(): HTMLImageElement | null
{
    let resources = Resources.getInstance();
    let packId = gUser.network.settings.skinPackId;

    if (!resources)
      return (null);
    switch (packId)
    {
        case 1: return (resources.get("galaxy", "background"));
        case 2: return (resources.get("moon", "background"));
        case 3: return (resources.get("pokemon", "background"));
        case 4: return (resources.get("codzm", "background"));
        default: return (null);
    }
}

export function getBallSkin(): HTMLImageElement | null
{
    let resources = Resources.getInstance();
    let packId = gUser.network.settings.skinPackId;

    if (!resources)
      return (null);
    switch (packId)
    {
        case 1: return (resources.get("galaxy", "ball"));
        case 2: return (resources.get("moon", "ball"));
        case 3: return (resources.get("pokemon", "ball"));
        case 4: return (resources.get("codzm", "ball"));
        default: return (null);
    }
}

export function getAvatarSkin(id: number): HTMLImageElement | null
{
  let resources = Resources.getInstance();

  if (!resources)
    return (null);
  switch (id)
  {
      case 0: return (resources.get("avatar", "default"));
      case 1: return (resources.get("avatar", "a01"));
      case 2: return (resources.get("avatar", "a02"));
      case 3: return (resources.get("avatar", "a03"));
      case 4: return (resources.get("avatar", "a04"));
      case 5: return (resources.get("avatar", "a05"));
      case 6: return (resources.get("avatar", "a06"));
      case 7: return (resources.get("avatar", "a07"));
      case 8: return (resources.get("avatar", "a08"));
      case 9: return (resources.get("avatar", "a09"));
      case 10: return (resources.get("avatar", "a10"));
      default: return (null);
  }
}

export function getFxImgFrame(name:string, frame:number): HTMLImageElement | null
{
  let resources = Resources.getInstance();

  if (!resources)
    return (null);

  const id = frame.toString().padStart(2, "0");
  return (resources.get("fx", `${name}${id}`));
}