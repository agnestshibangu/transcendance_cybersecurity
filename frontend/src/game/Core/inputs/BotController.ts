import { Player } from "../Player.js";
import { PlayerController } from "./PlayerController.js";

const BOT_CONFIG =
{
    easy:   { reaction: 300, speed: 0.45, error: 60, chance: 0.6 },
    normal: { reaction: 180, speed: 0.65, error: 40, chance: 0.8 },
    hard:   { reaction: 80,  speed: 0.9,  error: 15, chance: 0.95 },
    insane: { reaction: 0,   speed: 1.2,  error: 0,  chance: 1 },
};

export type BotContext =
{
    ballX: number;
    ballY: number;
    ballVX: number;
    ballVY: number;
    paddleY: number;
    paddleH: number;
    paddleX: number;
    canvasH: number;
    canvasW: number;
};

export type BotDifficulty = "easy" | "normal" | "hard" | "insane";

export class BotController extends PlayerController
{
    private difficulty: BotDifficulty;
    private targetY: number | null = null;
    private thinkTimer = 0;

    constructor(player: Player, difficulty: BotDifficulty)
    {
        super(player);
        this.difficulty = difficulty;
        this.thinkTimer = 0;
    }

    update(delta: number, ctx?: BotContext | null)
    {
        const maxWSpeed = 0.25 + 0.8;

        if (!ctx)
        {
            this.resetInput();
            return;
        }
        let cfg = { ...BOT_CONFIG[this.difficulty] };
        const sec = delta / 1000;
        const currSpeedFactor = Math.min(1, Math.abs(ctx.ballVX / (ctx.canvasW * maxWSpeed)));
      
        cfg.chance = cfg.chance - 0.3 * currSpeedFactor;
        cfg.error  = cfg.error + 15 * currSpeedFactor;
        cfg.reaction = cfg.reaction + 30 * currSpeedFactor;

        this.resetInput();
        this.thinkTimer += delta;

        if (this.thinkTimer >= cfg.reaction || this.targetY === null)
        {
            this.thinkTimer = 0;


            if (Math.random() <= cfg.chance)
            {
                const timeToReach = (ctx.paddleX - ctx.ballX) / ctx.ballVX;

                if (timeToReach > 0)
                {
                    let predictedY = ctx.ballY + ctx.ballVY * timeToReach;
                    while (predictedY < 0 || predictedY > ctx.canvasH)
                    {
                        if (predictedY < 0) predictedY = -predictedY;
                        else predictedY = ctx.canvasH*2 - predictedY;
                    }

                    const errorOffset = (Math.random()*2 - 1) * cfg.error;
                    this.targetY = predictedY - ctx.paddleH / 2 + errorOffset;
                }
            }
            else
            {
                this.targetY = Math.random() * (ctx.canvasH - ctx.paddleH);
            }
        }

        if (this.targetY === null)
            return;

        const dy = this.targetY - ctx.paddleY;
        const maxMove = ctx.canvasH * cfg.speed * sec;
        const lerpFactor = Math.min(1, Math.abs(dy) / maxMove);
        const move = dy * lerpFactor / maxMove;
        this.input.moveY = Math.max(-1, Math.min(1, move));
    }
}
