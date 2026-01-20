import { clamp } from "../Utils/math.js";
import { makeRefsTree } from "../Utils/utils.js"

export class User
{
  network =
  {
    settings:
    {
      volume_ui: 100,
      volume_sfx: 100,
      volume_music: 100,
      skinPackId: 0,
      fx_enabled: true,
      r_showFPS: false,
      r_balltrail: true,
      r_showUsers: true
    },
    stats:
    {
      level: 1,
      xp:0,
      win: 0,
      lose: 0,
      goals: 0,
      goalsTaken: 0,
      totalXp: 0,
      totalMatch: 0
    },
    trophies:
    {
      reach_lvl_10: false,
      reach_lvl_25: false,
      reach_lvl_50: false,
      first_win: false,
      first_lose: false,
      first_goal: false,
      first_goaltaken: false,
      reach_100_goal: false,
    },
    store:
    {
      sherpaCoin: 0,
      skinsPackBought: [true, false, false, false, false],
    },
    profile:
    {
      avatar_id: 0,
    }
  };

  refs: any;

  constructor()
  {
    this.refs = makeRefsTree(this.network);
  }

  get ratioWL()
  {
    const total = this.network.stats.win + this.network.stats.lose;
    return ((total === 0) ? (0) : (this.network.stats.win / total));
  }

  get ratioGoal()
  {
    const taken = this.network.stats.goalsTaken;
    return ((taken === 0) ? (this.network.stats.goals) : (this.network.stats.goals / taken));
  }

  toJSON()
  {
    return {
      version: "1.0.0",
      network: this.network,
    };
  }

  fromJSON(data: any)
  {
    if (!data || !data.network || data.version !== "1.0.0")
      return;

    const defaultNetwork = structuredClone(this.network);
    deepMerge(defaultNetwork, data.network);
    sanitizeNetwork(defaultNetwork);
    this.network = defaultNetwork;
    this.refs = makeRefsTree(this.network);
  }
}

function deepMerge(target: any, source: any)
{
  for (const key in source)
  {
    const s = source[key];
    const t = target[key];

    if (Array.isArray(s))
    {
      target[key] = s.slice();
    }
    else if (s !== null && typeof s === "object")
    {
      if (!t || typeof t !== "object")
        target[key] = {};
      deepMerge(target[key], s);
    }
    else
    {
      target[key] = s;
    }
  }
}

function sanitizeNetwork(net: any)
{
  const stats = net.stats;
  stats.level = Math.max(1, stats.level | 0);
  stats.xp = Math.max(0, stats.xp | 0);
  stats.win = Math.max(0, stats.win | 0);
  stats.lose = Math.max(0, stats.lose | 0);
  stats.goals = Math.max(0, stats.goals | 0);
  stats.goalsTaken = Math.max(0, stats.goalsTaken | 0);
  stats.totalXp = Math.max(0, stats.totalXp | 0);
  stats.totalMatch = Math.max(0, stats.totalMatch | 0);

  if (!Array.isArray(net.store.skinsPackBought))
  {
    net.store.skinsPackBought = [true, false, false, false, false];
  }

  while (net.store.skinsPackBought.length < 5)
  {
    net.store.skinsPackBought.push(false);
  }

  net.store.skinsPackBought.length = 5;
  net.store.sherpaCoin = Math.max(0, net.store.sherpaCoin | 0);

  const s = net.settings;
  s.volume_ui = clamp(s.volume_ui, 0, 100);
  s.volume_sfx = clamp(s.volume_sfx, 0, 100);
  s.volume_music = clamp(s.volume_music, 0, 100);
}

export const gUser = new User();