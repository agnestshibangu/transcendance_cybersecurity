import { irandom } from "../Utils/math.js";
import { GameTimer } from "./GameTimer.js";
import { Player, PlayerTeam } from "./Player.js";

export enum GamePhase
{
    Init,
    Intro,
    Countdown,
    Playing,
    GoalPause,
    EndGame,
    Results
}

export enum ExitZone
{
  TopLeft = 1,
  TopRight,
  BottomLeft,
  BottomRight
}

type Ball =
{
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    angle: number;
    trail: { x: number; y: number, angle: number }[];
    maxTrail: number;
    lastTeamHit: PlayerTeam;
};

export class GameState
{
    private lastPlayerHit: Player | null = null;
    private partytimer: GameTimer | null = null;
    private phase: GamePhase = GamePhase.Init;
    private lastW: number;
    private lastH: number;
    private baseBallvx: number = 0.25;
    private baseBallvy: number = 0.175;
    private mpBallvx: number = 0;
    private mpBallvy: number = 0;
    lastCountdownSecond: number | null = null;
    countdownMs = 3000;
    
    teamScore: Record<PlayerTeam, number> =
    {
        ["allies"]: 0,
        ["axis"]: 0,
        ["neutral"]: 0
    };
    players: Map<number, { x:number, y: number}>
    ball: Ball;

    constructor(canvasWidth: number, canvasHeight: number)
    {
        this.players = new Map();
        this.lastW = canvasWidth;
        this.lastH = canvasHeight;
        this.partytimer = null;
        this.countdownMs = 3000;
        this.lastCountdownSecond = null;
        this.lastPlayerHit = null;
        this.ball = this.createBall();
        this.phase = GamePhase.Init;
    }

    createBall(): Ball
    {
        this.mpBallvx = 0;
        this.mpBallvy = 0;
        const radius = Math.min(this.lastW, this.lastH) * 0.035;
        return {x: this.lastW / 2, y: this.lastH / 2, vx: this.lastW * this.baseBallvx, vy: this.lastH * this.baseBallvy, radius, angle: 0, trail: [], maxTrail: 30, lastTeamHit: "neutral" };
    }

    launchBall()
    {
        let mpx = 1;
        let mpy = 1;

        if (!this.ball)
            return;
        if (irandom(0, 100) < 50)
            mpx *= -1;
        if (irandom(0, 100) >= 50)
            mpy *= -1;
        this.ball.vx = (this.lastW * this.baseBallvx) * mpx;
        this.ball.vy = (this.lastH * this.baseBallvy) * mpy;
    }

    updateBall()
    {
        if (!this.ball)
            return;
        const signX = Math.sign(this.ball.vx);
        const signY = Math.sign(this.ball.vy);

        this.mpBallvx += 0.05;
        this.mpBallvy += 0.05;

        if (this.mpBallvx > 0.8) this.mpBallvx = 0.8;
        if (this.mpBallvy > 0.8) this.mpBallvy = 0.8;

        this.ball.vx = this.lastW * ((this.baseBallvx + this.mpBallvx) * signX);
        this.ball.vy = this.lastH * ((this.baseBallvy + this.mpBallvy) * signY);
    }

    resize(newW: number, newH: number)
    {
        if (newW === this.lastW && newH === this.lastH)
            return;

        const paddleWidth = 10;
        const paddleHeight = Math.min(newW, newH) * 0.15;
        const ballRadius = Math.min(newW, newH) * 0.03;
        for (const [id, pos] of this.players)
        {
            pos.x = id === 0 ? 30 : newW - 30 - paddleWidth;
            pos.y = pos.y * (newH / this.lastH);
        }
        this.ball.x = newW / 2;
        this.ball.y = this.ball.y * (newH / this.lastH);
        this.ball.vx = this.ball.vx * (newW / this.lastW);
        this.ball.vy = this.ball.vy * (newH / this.lastH);
        this.ball.radius = ballRadius;
        this.lastW = newW;
        this.lastH = newH;
    }

    reset()
    {
        this.lastPlayerHit = null;
        this.ball = this.createBall();
    }

    setLastPlayerHit(p: Player | null)
    {
        this.lastPlayerHit = p;
    }

    getLastPlayerHit(): Player | null
    {
        return (this.lastPlayerHit);
    }

    setPhase(phase: GamePhase)
    {
        this.phase = phase;
    }

    getPhase()
    {
        return (this.phase);
    }

    addGoalForTeam(scoringTeam: PlayerTeam, players: Player[])
    {
        const lastHit = this.getLastPlayerHit();

        if (scoringTeam === "neutral")
            return;
        this.teamScore[scoringTeam]++;
        for (const p of players)
        {
            if (p.team === "neutral")
                continue;
            if (p === lastHit)
                p.goalsScored++;
            if (p.team === scoringTeam)
                p.goalsScoredByTeam++;
            else
                p.goalsConcededByTeam++;
        }
        this.setLastPlayerHit(null);
    }

    initPartyTimer(timeLimitMin: number, cb: (() => void) | null = null)
    {
        if (this.partytimer)
        {
            this.partytimer.stop();
            this.partytimer = null;
        }
		this.partytimer = new GameTimer(timeLimitMin, cb);
    }

    getPartyTimer(): GameTimer | null
    {
        return (this.partytimer);
    }

    getCountdownValue(): string | null
    {
        if (this.phase !== GamePhase.Countdown)
            return (null);
        return (Math.ceil(this.countdownMs / 1000).toString());
    }
   
    stop()
    {
        if (this.partytimer)
        {
            this.partytimer.stop();
            this.partytimer = null;
        }
        this.players.clear();
    }
}