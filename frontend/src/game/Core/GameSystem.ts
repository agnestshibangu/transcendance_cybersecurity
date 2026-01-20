import { GameState, ExitZone, GamePhase } from "./GameState.js";
import { cvLayer, Canvas } from "./canvas.js";
import { Engine, stopEngine } from "./Engine.js";
import { Player } from "./Player.js";
import { PlayerController } from "./inputs/PlayerController.js";
import { EnginePlayers } from "./EnginePlayers.js";
import { AudioManager, getAudioManager } from "./audio.js";
import { BotContext } from "./inputs/BotController.js";
import { FxManager } from "./FXManager.js";
import { gUser } from "./user.js";
import { trophiescheck } from "../trophies.js";

const WALL_THICKNESS = 2;

export class GameSystem
{
    private engine: Engine | null;
    private state: GameState | null;
    private audio: AudioManager | null;
    
    private paddleHeight = 0;
    private paddleWidth = 10;
    private paddleHeightRatio = 0.15;
    private paddleSpeedRatio = 1;
    private lastAction = false;

    constructor(engine: Engine, state: GameState)
    {
        this.engine = engine;
        this.state = state;
        this.audio = getAudioManager();
    }

    stop()
    {
      this.engine = null;
      this.state = null;
      this.audio = null;
    }

    createBotContext(controller: PlayerController): BotContext | null
    {
        let b: any;
        let pos: any;
        let layers: Record<cvLayer, Canvas>;[]
    
        if (!this.state || !this.engine || !(b = this.state.ball))
            return (null);
        pos = this.state.players.get(controller.getPlayer().id);
        layers = this.engine.getLayers();
        if (!pos)
            return (null);
        return {ballX: b.x, ballY: b.y, ballVX: b.vx, ballVY: b.vy, paddleH: this.paddleHeight, paddleY: pos.y, paddleX: pos.x, canvasH:layers[cvLayer.GAME].height, canvasW:layers[cvLayer.GAME].width};
    }

    onGoal(zone: ExitZone, players: Player[])
    {
        if (!this.engine || !this.state || !players)
            return;
        switch (zone)
        {
            case ExitZone.TopLeft:
            case ExitZone.BottomLeft:
            {
                this.state.addGoalForTeam("axis", players);
                break;
            }
            case ExitZone.TopRight:
            case ExitZone.BottomRight:
            {
                this.state.addGoalForTeam("allies", players);
                break;
            }
        }

        this.state.setPhase(GamePhase.GoalPause);
        FxManager.spawnFirework(this.state.ball.x, this.state.ball.y);
    }

    getBallExitZone(ball:any, width: number, height: number): ExitZone | null
    {
        const midY = height / 2;
        const outLeft = ball.x <= WALL_THICKNESS;
        const outRight = ball.x + ball.radius >= width - WALL_THICKNESS;

        if (outLeft)
        {
            return ((ball.y < midY) ? ExitZone.TopLeft : ExitZone.BottomLeft);
        }

        if (outRight)
        {
            return ((ball.y < midY) ? ExitZone.TopRight : ExitZone.BottomRight);
        }
        return (null);
    }

    private updateBall(delta: number, players: Player[], width:number, height:number)
    {
        const sec = delta / 1000;
        const EPS = 0.0001;
        let zone: ExitZone | null = null;
        let b: any;

        if (!this.state)
            return;
        b = this.state.ball;
        b.x += b.vx * sec;
        b.y += b.vy * sec;
        b.angle = (b.angle + 0.05) % (Math.PI * 2);

        if (b.y - b.radius <= 0)
        {
            b.y = b.radius + EPS;
            b.vy = Math.abs(b.vy);
        }
        else if (b.y + b.radius >= height)
        {
            b.y = height - b.radius - EPS;
            b.vy = -Math.abs(b.vy);
        }
        b.trail.push({ x: b.x, y: b.y, angle: b.angle });
        if (b.trail.length > b.maxTrail)
            b.trail.shift();
        for (let i = 0; i < players.length; i++)
        {
            const player = players[i];
            const pos = this.state.players.get(player.id)!;
            if (this.circleRectCollision(b, { x: pos.x, y: pos.y, w: this.paddleWidth, h: this.paddleHeight }))
            {
                if (this.state.ball.lastTeamHit !== player.team)
                {
                    this.state.ball.lastTeamHit = player.team;
                    this.state.updateBall();
                    this.state.setLastPlayerHit(player); 
                    b.vx *= -1;
                    switch (i)
                    {
                        case 0:case 2:
                        {
                            b.x = pos.x + this.paddleWidth + b.radius;
                            break;
                        }
                        case 1:case 3:
                        {
                            b.x = pos.x - b.radius;
                            break;
                        }
                    }
                    break;
                }
            }
        }
        if ((zone = this.getBallExitZone(b, width, height)))
        {
            this.onGoal(zone, players);
        }
    }

    updatePaddle(delta:number, canvasH: number, controllers: PlayerController[])
    {
        const sec = (delta / 1000);
        const paddleSpeed = canvasH * this.paddleSpeedRatio;

        if (!this.state)
            return;
        for (const controller of controllers)
        {
            const pos = this.state.players.get(controller.getPlayer().id);
            if (!pos)
                continue;
            pos.y += controller.input.moveY * paddleSpeed * sec;
            pos.y = Math.max(WALL_THICKNESS, Math.min(canvasH - (this.paddleHeight + WALL_THICKNESS), pos.y));
        }
    }

    updateTimer(delta: number)
    {
        let ptimer: any = null;
        if (!this.state || !(ptimer = this.state.getPartyTimer()))
          return;
        ptimer.update(delta);
        if (ptimer.isFinished())
        {
            ptimer.exec();
            ptimer.stop();
        }
    }

    updateCountdown(delta: number)
    {
        if (!this.state)
            return;

        this.state.countdownMs -= delta;
        if (this.state.countdownMs < 0)
            this.state.countdownMs = 0;
        const currentSecond = Math.ceil(this.state.countdownMs / 1000);
        if (currentSecond > 0 && currentSecond !== this.state.lastCountdownSecond)
        {
            this.audio?.sfx.play("cntd_tick");
            this.state.lastCountdownSecond = currentSecond;
        }
        if (this.state.countdownMs === 0 && this.state.getPhase() === GamePhase.Countdown)
        {
            this.state.setPhase(GamePhase.Playing);
            this.state.lastCountdownSecond = null;
            this.state.launchBall();
            this.audio?.sfx.play("cntd_start");
        }
    }

    resetPaddles()
    {
        let game: Canvas;
        let pmanager:EnginePlayers | null = null;
        let players: Player[];

        if (!this.state || !this.engine || !(pmanager = this.engine.getPlayersManager()))
            return;
        game = this.engine.getLayers()[cvLayer.GAME];
        players = pmanager.getPlayers();
        for (const player of players)
        {
            this.state.players.set(player.id,
            {
                x: player.team === "allies" ? 30 : game.width - 30 - this.paddleWidth,
                y: (game.height - this.paddleHeight) / 2
            });
        }
    }

    updateStats()
    {
        let pmanager: EnginePlayers | null = null;
        let host: Player | null = null;

        if (!this.engine || !this.state || !this.audio)
            return;
        if (!(pmanager = this.engine.getPlayersManager()))
            return;
        let t_a = 0;
        let t_b = 0;
        for(const player of pmanager.getPlayers())
        {
            if (player.isHost)
                host = player;
            switch (player.team)
            {
                case "allies":t_a += player.goalsScoredByTeam; break;
                case "axis":t_b += player.goalsScoredByTeam; break;
            }
        }
        if (host)
        {
            const isWin = t_a > t_b;
            const isEquality = t_a === t_b;
            const base_xp = (host.goalsScored * 75) + ((host.goalsScoredByTeam - host.goalsScored) * 25) + (100 * (isWin ? 1 : 0));
            const blvl = gUser.network.stats.level;
            if (!isEquality)
            {
                gUser.refs.stats.win.value += isWin === true;
                gUser.refs.stats.lose.value += isWin === false;
            }
            gUser.refs.stats.goals.value += host.goalsScored;
            gUser.refs.stats.goalsTaken.value += host.goalsConcededByTeam;
            gUser.refs.stats.totalMatch.value += 1;
            gUser.refs.stats.totalXp.value += base_xp;
            let gainxp = base_xp;
            while (gainxp > 0)
            {
                const level = gUser.network.stats.level;
                const lvl_rq_xp = 975 * level;
                const lvl_nd_xp = lvl_rq_xp - gUser.network.stats.xp;

                if (gainxp >= lvl_nd_xp)
                {
                    gUser.refs.stats.level.value++;
                    gUser.refs.store.sherpaCoin.value += 250;
                    gUser.refs.stats.xp.value = 0;
                    gainxp -= lvl_nd_xp;
                }
                else
                {
                    gUser.refs.stats.xp.value += gainxp;
                    gainxp = 0;
                }
            }
            if (blvl !== gUser.network.stats.level)
            {
                this.audio.sfx.play("rankup");
            }
            if (trophiescheck())
            {
                this.audio.sfx.play("trophy")
            }
            //syncDB
        }
        this.state.setPhase(GamePhase.Results);
        this.state.initPartyTimer(0.10, stopEngine);
    }

    endGame()
    {
        if (!this.state)
            return;
        this.state.setPhase(GamePhase.EndGame);
        this.state.initPartyTimer(0.10, this.updateStats.bind(this));
    }

    setupMusic()
    {
        if (!this.engine || !this.audio! || !this.state)
            return;
        const lscore = this.engine.getGoalLimit();
        const llscore = lscore - 1;
        if (this.state.teamScore["axis"] === llscore || this.state.teamScore["allies"] === llscore)
        {
            this.lastAction = true;
            this.audio.stopCurrentMusic();
            this.audio.playMusic("last_action");
            return;
        }
        switch (this.engine.getGameMode())
        {
            case "pve":
            {
                this.audio.playMusic("pve");
                break;
            }
            case "pvp":
            {
                this.audio.playMusic("pvp");
                break;
            }
            case "2v2":
            {
                this.audio.playMusic("2v2");
                break;
            }
            default:
            {
                switch (1)
                {
                    case 1:
                    {
                        this.audio.playMusic("tournament_final");
                        break;
                    }
                    default:
                    {
                        this.audio.playMusic("tournament_base");
                        break;
                    }
                }
                break;
            }
        }
    }

    update(delta: number)
    {
        let game: Canvas;
        let layers: Record<cvLayer, Canvas>;[]
        let pmanager:EnginePlayers | null = null;
        let players: Player[] | null = null;
        let controllers: PlayerController[] | null = null;

        if (!this.engine || !this.state || !this.audio)
            return;
        layers = this.engine.getLayers();
        game = layers[cvLayer.GAME];
        this.state.resize(game.width, game.height);
        this.paddleHeight = game.height * this.paddleHeightRatio;
        if (!(pmanager = this.engine.getPlayersManager()))
            return;
        players = pmanager.getPlayers();
        controllers = pmanager.getControllers();
        switch(this.state.getPhase())
        {
            case GamePhase.Init:
            {
                this.resetPaddles();
                this.setupMusic();

                this.state.initPartyTimer(this.engine.getTimeLimit(), this.endGame.bind(this));
                this.state.countdownMs = 3000;
                this.state.lastCountdownSecond = null;
                const wq = (game.width / 4);
                const hq = (game.height / 4);
                const midW = (game.width / 2);
                const midH = (game.height / 2);
                FxManager.spawnFirework(midW - wq, midH - hq);
                FxManager.spawnFirework(midW + wq, midH - hq);
                FxManager.spawnFirework(midW - wq, midH + hq);
                FxManager.spawnFirework(midW + wq, midH + hq);
                this.state.setPhase(GamePhase.Intro);
                break;
            }
            case GamePhase.Intro:
            {
                FxManager.update(delta);
                if (!FxManager.hasActiveFx())
                {
                    this.state.setPhase(GamePhase.Countdown);
                }
            }
            case GamePhase.Countdown:
            {
                this.audio.reduceMusic();
                this.updateCountdown(delta);
                break;
            }
            case GamePhase.Playing:
            {
                this.audio.upMusic();
                this.updatePaddle(delta, game.height, controllers);
                this.updateBall(delta, players, game.width, game.height);
                this.updateTimer(delta);
                break;
            }
            case GamePhase.GoalPause:
            {
                FxManager.update(delta);
                if (!FxManager.hasActiveFx())
                {
                    const lscore = this.engine.getGoalLimit();
                    const llscore = lscore - 1;
                    if (!this.lastAction && llscore > 0 && (this.state.teamScore["axis"] === llscore || this.state.teamScore["allies"] === llscore))
                    {
                        this.lastAction = true;
                        this.audio.stopCurrentMusic();
                        this.audio.playMusic("last_action");
                    }
                    if (this.state.teamScore["axis"] === lscore || this.state.teamScore["allies"] === lscore)
                    {
                        this.endGame();
                        return;
                    }
                    this.state.countdownMs = 3000;
                    this.state.lastCountdownSecond = null;
                    this.state.setPhase(GamePhase.Countdown);
                    this.resetPaddles();
                    this.state.reset();
                }
                break;
            }
            case GamePhase.EndGame:
            {
                this.updateTimer(delta);
                break;
            }
            case GamePhase.Results:
            {
                this.updateTimer(delta);
                break;
            }
        }
    }

    private circleRectCollision(ball: { x:number, y:number, radius:number }, rect: { x:number, y:number, w:number, h:number })
    {
        const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
        const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;

        return ((dx * dx + dy * dy) < (ball.radius * ball.radius));
    }
}
