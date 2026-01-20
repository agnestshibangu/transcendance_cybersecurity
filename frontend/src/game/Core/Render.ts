import { Canvas, cvLayer } from "./canvas.js";
import { GamePhase, GameState } from "./GameState.js";
import { Player, PlayerTeam } from "./Player.js";
import { gUser } from "./user.js";
import { getAvatarSkin, getBackgroundSkin, getBallSkin, getFxImgFrame } from "../skinPacks.js";
import { FxManager } from "./FXManager.js";

const FPS_UI_REFRESH = 250;
let lastRenderTime = performance.now();
let lastFpsUiUpdate = performance.now();
let realFps = 0;
let displayFps = 0;
let goalFxCurr = 0;

export class Renderer
{
    private layers: Record<cvLayer, Canvas> | null;
    private gameState: GameState | null;

    constructor(layers: Record<cvLayer, Canvas>, gameState: GameState)
    {
        this.layers = layers;
        this.gameState = gameState;
    }
    
    private clearAll()
    {
        if (this.layers)
        {
            this.layers[cvLayer.BKG].clear();
            this.layers[cvLayer.GAME].clear();
            this.layers[cvLayer.UI].clear();
        }
    }

    private drawBackground()
    {
        const img = getBackgroundSkin();
        let bkg = null;

        if (!this.layers)
            return;
        bkg = this.layers[cvLayer.BKG];
        bkg.drawRect(0, 0, bkg.width, bkg.height, "#000000ff");
        if (img)
        {
            bkg.drawImage(img, 0, 0, bkg.width, bkg.height);
        }
        bkg.drawBox(0, 0, bkg.width, bkg.height, 2, "#ffffffff", "#00000000", true, false);
        bkg.drawRect((bkg.width / 2) - 1, (bkg.height / 2) - (bkg.height / 4), 2, bkg.height / 2, "#ffffff7f");
    }

    private drawGame()
    {
        
    }

    private getUserColor(team: PlayerTeam, index: number): string
    {
        switch (team)
        {
            case "allies":
            {
                if (index == 0)
                    return ("#0af");
                else
                    return ("rgb(0, 255, 30)");
            }
            case "axis":
            {
                if (index == 1)
                    return ("#ff0000ff");
                else
                    return ("rgb(255, 220, 0)");
            }
            case "neutral": return ("rgb(255, 255, 255)");
        }
    }

    private drawUsers(ui: Canvas, players: Player[])
    {
        let i = 0;
        let pos: {avx: number, avy: number, tx: number, ty:  number};
        const pad = 56;

        for(i = 0; i < players.length; i++)
        {
            const player = players[i];
            const avatar_img = getAvatarSkin(player.avatarId);
            const pNameW = ui.getTextWidth(player.name);
            const pNameH = ui.getTextHeight(player.name);
            switch (i)
            {
                case 0:
                {
                    pos = {avx:8, avy:8, tx:pad, ty: pNameH + 8};
                    break;
                }
                case 1:
                {
                    pos = {avx:ui.width - pad, avy:8, tx:ui.width - (pad + pNameW), ty: pNameH +8};
                    break;
                }
                case 2:
                {
                    pos = {avx:8, avy: ui.height - pad, tx:pad, ty: ui.height - (pNameH - 8)};
                    break;
                }
                case 3:
                {
                    pos = {avx:ui.width - pad, avy: ui.height - pad, tx:ui.width - (pad + pNameW), ty:ui.height - (pNameH - 8)};
                    break;
                }
                default:return;
            }
            ui.drawImage(avatar_img, pos.avx, pos.avy, 48, 48);
            ui.drawText(player.name, pos.tx, pos.ty, this.getUserColor(player.team, i));
        }
    }

    private drawUI(players: Player[])
    {
        const font = "24px Arial";
        let ui = null;

        if (!this.layers)
            return;
        ui = this.layers[cvLayer.UI];
        const hp = ui.height / 16;
        const mid_w = ui.width / 2;

        if (gUser.network.settings.r_showUsers)
        {
           this.drawUsers(ui, players);
        }
        //! Draw FPS
        if (gUser.network.settings.r_showFPS)
        {
           // ui.drawText(`(FPS: ${displayFps.toFixed(2)})`, 10 + text_w, (text_h * 2) + 10, "#fff");
        }
        if (!this.gameState)
            return;
        //! Score
        const score_label = this.gameState.teamScore["allies"].toString() + "    -    " + this.gameState.teamScore["axis"].toString();
        const score_label_w = ui.getTextWidth(score_label, font);
        const score_label_h = ui.getTextHeight(score_label, font);
        ui.drawText(score_label, (ui.width / 2) - (score_label_w / 2), hp + score_label_h, "#ffffffff", true, font);
        //! Countdown
        if (this.gameState.getPhase() === GamePhase.Countdown)
        {
            const ctn_font = "50px Arial";
            const ctn_label = this.gameState.getCountdownValue();
            const ctn_label_h = ui.getTextHeight(ctn_label, ctn_font);
            const ctn_label_w = ui.getTextWidth(ctn_label, ctn_font);
            ui.drawText(ctn_label, (ui.width / 2) - (ctn_label_w / 2), (ui.height / 2) + ctn_label_h, "#fff", true, ctn_font);
        }
        //! Party Timer
        const ptimer = this.gameState.getPartyTimer();
        if (!ptimer)
            return;
        let timer = ptimer.getRemainingStr();
        let timer_w = ui.getTextWidth(timer);
        ui.drawText(timer, (ui.width / 2) - (timer_w / 2), 40, "#ffffffff");
    }


    drawUIEndGame(players: Player[])
    {
        let ui = null;

        if (!this.layers || !this.gameState || !(ui = this.layers[cvLayer.UI]))
            return;
        const stats = gUser.network.stats;
        const textH = ui.getTextHeight("W");
        const resultW = ui.getTextWidth("Results");
        const padding = textH + 16;
        const ptimer = this.gameState.getPartyTimer();
        const qw = ui.width / 4;
        const qh = ui.height / 4;
        const mw = (qw * 2);
        const mh = (qh * 2);
        const lText = qw + 8;
        let tText = qh + 8 + textH;

        ui.drawBox(qw, qh, ui.width - mw, ui.height - mh, 2, "#ffffffff", "#0000ffff", true, true);
        ui.drawText(`Results`, (ui.width / 2) - (resultW / 2), tText, "#ffffffff");
        tText += padding * 2;
        let alliesTeam: Player[] = [];
        let axisTeam: Player[] = [];
        let alliesScore = 0;
        let axisScore = 0;
        let winnerTeam: Player[] = [];
        let loserTeam: Player[] = [];

        for(let i = 0; i < players.length; i++)
        {
            let player = players[i];

            if (player.team === "allies")
            {
                alliesTeam.push(player);
                alliesScore = player.goalsScoredByTeam;
            }
            else if (player.team === "axis")
            {
                axisTeam.push(player);
                axisScore += player.goalsScoredByTeam;
            }
        }
        const isEquality = alliesScore === axisScore;
        if (isEquality)
        {
            ui.drawText(`Equality`, lText, tText, "rgb(25, 0, 255)");
            tText += padding;
            for (const p of alliesTeam)
            {
                ui.drawText(p.name, lText, tText, "rgb(38, 255, 0)");
                tText += padding;
            }
            for (const p of axisTeam)
            {
                ui.drawText(p.name, lText, tText, "rgb(255, 0, 0)");
                tText += padding;
            }
        }
        else
        {
            winnerTeam = (alliesScore > axisScore) ? alliesTeam : axisTeam;
            loserTeam = (alliesScore < axisScore) ? alliesTeam : axisTeam;

            ui.drawText(`Victory`, lText, tText, "rgb(21, 255, 0)");
            tText += padding;
            for (const p of winnerTeam)
            {
                ui.drawText(p.name, lText, tText, "rgb(255, 255, 255)");
                tText += padding;
            }
            ui.drawText(`Defeat`, lText, tText, "rgb(255, 0, 0)");
            tText += padding;
            for (const p of loserTeam)
            {
                ui.drawText(p.name, lText, tText, "rgb(255, 255, 255)");
                tText += padding;
            }
        }
        if (!ptimer)
            return;
        let timer = ptimer.getRemainingStr();
        let timer_w = ui.getTextWidth(timer);
        ui.drawText(timer, (ui.width / 2) - (timer_w / 2), (ui.height - qh) - textH, "#ffffffff");
    }

    drawUIResults()
    {
        let ui = null;

        if (!this.layers || !this.gameState || !(ui = this.layers[cvLayer.UI]))
            return;
        const stats = gUser.network.stats;
        const textH = ui.getTextHeight("W");
        const resultW = ui.getTextWidth("Results");
        const padding = textH + 16;
        const ptimer = this.gameState.getPartyTimer();
        const qw = ui.width / 4;
        const qh = ui.height / 4;
        const mw = (qw * 2);
        const mh = (qh * 2);
        const lText = qw + 8;
        let tText = qh + 8 + textH;

        ui.drawBox(qw, qh, ui.width - mw, ui.height - mh, 2, "#ffffffff", "#0000ffff", true, true);
        ui.drawText(`Results`, (ui.width / 2) - (resultW / 2), tText, "#ffffffff");
        tText += padding * 2;
        ui.drawText(`Level : ${stats.level}`, lText, tText, "#ffffffff");
        tText += padding;
        ui.drawText(`XP : ${stats.xp}`, lText, tText, "#ffffffff");
        tText += padding;
        ui.drawText(`Win : ${stats.win}`, lText, tText, "#ffffffff");
        tText += padding;
        ui.drawText(`Lose : ${stats.lose}`, lText, tText, "#ffffffff");
        tText += padding;
        ui.drawText(`Goals : ${stats.goals}`, lText, tText, "#ffffffff");
        tText += padding;
        ui.drawText(`Goals Conceded : ${stats.goalsTaken}`, lText, tText, "#ffffffff");
        tText += padding;
        ui.drawText(`Total XP : ${stats.totalXp}`, lText, tText, "#ffffffff");
        tText += padding;
        ui.drawText(`Total Match : ${stats.totalMatch}`, lText, tText, "#ffffffff");

        if (!ptimer)
            return;
        let timer = ptimer.getRemainingStr();
        let timer_w = ui.getTextWidth(timer);
        ui.drawText(timer, (ui.width / 2) - (timer_w / 2), (ui.height - qh) - textH, "#ffffffff");
    }


    render(players: Player[], delta: number)
    {
        let game = null;

        if (!this.layers || !this.gameState)
            return;
        game = this.layers[cvLayer.GAME];
    
        this.clearAll();
        this.drawBackground();
        this.drawGame();
        this.drawUI(players);

        const canvasW = game.width;
        const canvasH = game.height;
        const paddleHeight = canvasH * 0.15;
        const paddleWidth = 10;

        // paddles
        for(let i = 0; i < players.length; i++)
        {
            let player = players[i];
            const pos = this.gameState.players.get(player.id);
            if (!pos)
                continue;
            let color = this.getUserColor(player.team, i);
            game.drawVCapsule(pos.x, pos.y, paddleWidth, paddleHeight, color);
        }

        const phase = this.gameState.getPhase();
        switch (phase)
        {
            case GamePhase.Init:
            {
                game.drawRect(0, 0, canvasW, canvasW, "#000000ff");
                break;
            }
            case GamePhase.Countdown:
            case GamePhase.Playing:
            {
                const b = this.gameState.ball;
                const SPRITE_SIZE = b.radius * 2;
                for (let i = 0; i < b.trail.length - 1; i++)
                {
                    const curr = b.trail[i];
                    const next = b.trail[i + 1];

                    const t = i / b.trail.length;
                    const alpha = 0.5 * Math.pow(t, 1.5); // inversé : plus récent = visible, plus vieux = transparent

                    const midX = (curr.x + next.x) / 2;
                    const midY = (curr.y + next.y) / 2;

                    const size = SPRITE_SIZE * 0.8; // taille légèrement plus petite pour le trail

                    if (!gUser.network.settings.r_balltrail && i + 1 !== b.trail.length)
                        continue;
                    const trailImg = getBallSkin();
                    if (trailImg)
                    {
                        // dessiner l'image de la balle pour le trail
                        game._ctx.globalAlpha = alpha;
                        game.drawImageRotated(trailImg, midX - b.radius, midY - b.radius, size, size, curr.angle);
                        game._ctx.globalAlpha = 1; // reset alpha
                    }
                    else
                    {
                        // sinon utiliser la couleur de la balle
                        game.drawSphere(midX, midY, b.radius * 0.8, `rgba(106,3,162,${alpha})`);
                    }
                }
                let imxg = getBallSkin();
                if (imxg)
                {
                    game.drawImageRotated(imxg, b.x - b.radius, b.y - b.radius, SPRITE_SIZE, SPRITE_SIZE, b.angle);
                } 
                else
                {
                    game.drawSphere(b.x, b.y, b.radius, "#6a03a2ff");
                }
                break;
            }
            case GamePhase.GoalPause:
            {
                const b = this.gameState.ball;
                FxManager.draw(game, b.radius * 4);
            }
            case GamePhase.Intro:
            {
                FxManager.draw(game, 128);
                break;
            }
            case GamePhase.EndGame:
            {
                this.drawUIEndGame(players);
                break;
            }
            case GamePhase.Results:
            {
                this.drawUIResults();
                break;
            }
        }

        const now = performance.now();
        realFps = 1000 / (now - lastRenderTime);
        lastRenderTime = now;
        if (now - lastFpsUiUpdate >= FPS_UI_REFRESH)
        {
            displayFps += (realFps - displayFps) * 0.3;
            lastFpsUiUpdate = now;
        }
    }

    stop()
    {
        this.clearAll();
        this.layers = null;
        this.gameState = null;
    }
}
