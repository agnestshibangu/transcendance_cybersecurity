import { gUser } from "./Core/user.js";

export type TrophyId =
  | "reach_lvl_10"
  | "reach_lvl_25"
  | "reach_lvl_50"
  | "first_win"
  | "first_lose"
  | "first_goal"
  | "first_goaltaken"
  | "reach_100_goal";

export interface TrophyDef
{
  id: TrophyId;
  type: number;
  name: string;
  description: string;
}

export const TROPHIES: TrophyDef[] =
[
  { id: "reach_lvl_10", type: 0, name: "Beginner", description: "Reach level 10." },
  { id: "reach_lvl_25", type: 1, name: "Rising Star", description: "Reach level 25." },
  { id: "reach_lvl_50", type: 2, name: "Veteran", description: "Reach level 50." },
  { id: "first_win", type: 0, name: "First Victory", description: "Win your very first match." },
  { id: "first_lose", type: 0, name: "First Defeat", description: "Lose a match for the first time." },
  { id: "first_goal", type: 0, name: "Goal!!!!!!!!", description: "Score your first goal." },
  { id: "first_goaltaken", type: 0, name: "Goal Conceded", description: "Concede your first goal." },
  { id: "reach_100_goal", type: 2, name: "Goal Machine", description: "Score a total of 100 goals." },
];

export function setTrophyStatus(id:TrophyId, unlocked: boolean)
{
  switch (id)
  {
    case "reach_lvl_10": gUser.refs.trophies.reach_lvl_10.value = unlocked; break;
    case "reach_lvl_25": gUser.refs.trophies.reach_lvl_25.value = unlocked; break;
    case "reach_lvl_50": gUser.refs.trophies.reach_lvl_25.value = unlocked; break;
    case "first_win": gUser.refs.trophies.first_win.value = unlocked; break;
    case "first_lose": gUser.refs.trophies.first_lose.value = unlocked; break;
    case "first_goal": gUser.refs.trophies.first_goal.value = unlocked; break;
    case "first_goaltaken": gUser.refs.trophies.first_goaltaken.value = unlocked; break;
    case "reach_100_goal": gUser.refs.trophies.reach_100_goal.value = unlocked; break;
  }
}

export function getTrophyStatus(id:TrophyId)
{
  switch (id)
  {
    case "reach_lvl_10": return (gUser.network.trophies.reach_lvl_10);
    case "reach_lvl_25": return (gUser.network.trophies.reach_lvl_25);
    case "reach_lvl_50": return (gUser.network.trophies.reach_lvl_25);
    case "first_win": return (gUser.network.trophies.first_win);
    case "first_lose": return (gUser.network.trophies.first_lose);
    case "first_goal": return (gUser.network.trophies.first_goal);
    case "first_goaltaken": return (gUser.network.trophies.first_goaltaken);
    case "reach_100_goal": return (gUser.network.trophies.reach_100_goal);
    default:return (false);
  }
}

export function trophiescheck(): boolean
{
  const tr = gUser.network.trophies;
  const lvl = gUser.network.stats.level;
  const stats = gUser.network.stats;
  let tr_list: TrophyId[] = [];

  for(const trophy of TROPHIES)
  {
    switch (trophy.id)
    {
      case "reach_lvl_10":
      {
        if (!tr.reach_lvl_10 && lvl >= 10)
          tr_list.push(trophy.id);
        break;
      }
      case "reach_lvl_25":
      {
        if (!tr.reach_lvl_25 && lvl >= 25)
          tr_list.push(trophy.id);
        break;
      }
      case "reach_lvl_50":
      {
        if (!tr.reach_lvl_50 && lvl >= 50)
          tr_list.push(trophy.id);
        break;
      }
      case "first_win":
      {
        if (!tr.first_win && stats.win >= 1)
          tr_list.push(trophy.id);
        break;
      }
      case "first_lose":
      {
        if (!tr.first_lose && stats.lose >= 1)
          tr_list.push(trophy.id);
        break;
      }
      case "first_goal":
      {
        if (!tr.first_goal && stats.goals >= 1)
          tr_list.push(trophy.id);
        break;
      }
      case "first_goaltaken":
      {
        if (!tr.first_goaltaken && stats.goalsTaken >= 1)
          tr_list.push(trophy.id);
        break;
      }
      case "reach_100_goal":
      {
        if (!tr.reach_100_goal && stats.goals >= 100)
          tr_list.push(trophy.id);
        break;
      }
    }
  }
  if (tr_list.length > 0)
  {
    for (const id of tr_list)
    {
      setTrophyStatus(id, true);
    }
    return (true);
  }
  return (false);
}