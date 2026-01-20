import { Player } from "../Player.js";

export type PlayerInput =
{
    moveY: number;
};

export abstract class PlayerController
{
    protected player: Player;
    readonly input: PlayerInput = { moveY: 0 };

    constructor(player: Player)
    {
        this.player = player;
    }

    abstract update(delta: number, n:any): void;

    resetInput()
    {
        this.input.moveY = 0;
    }

    getPlayer(): Player
    {
        return this.player;
    }
}
