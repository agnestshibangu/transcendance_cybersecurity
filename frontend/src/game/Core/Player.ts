export type PlayerType = "human" | "bot";
export type PlayerTeam = "allies" | "axis" | "neutral";

export class Player
{
    readonly id: number;
    readonly name: string;
    readonly type: PlayerType;
    readonly isHost: boolean;
    readonly team: PlayerTeam = "neutral";
    readonly avatarId: number

    goalsScored = 0;
    goalsScoredByTeam = 0;
    goalsConcededByTeam = 0;

    constructor(id: number, name: string, type: PlayerType, team: PlayerTeam, avatar_id: number, isHost = false)
    {
        this.id = id;
        this.name = name;
        this.type = type;
        this.team = team;
        this.avatarId = avatar_id;
        this.isHost = isHost;
        //? stats
        this.goalsScored = 0;
        this.goalsScoredByTeam = 0;
        this.goalsConcededByTeam = 0;
    }
}