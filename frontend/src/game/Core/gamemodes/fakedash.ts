import { t_vec2 } from "../../Utils/vector"
import { GameState } from "../GameState.js";
import { Canvas, cvLayer } from "../canvas.js";
import { Resources } from "../Ressources.js";
import { getBackgroundSkin } from "../../skinPacks.js";
import { Engine } from "../Engine.js";

type Trap = { origin: number; enabled: boolean };

export class FakeDashManager {
    private gameState: GameState | null;
    private layers: Record<cvLayer, Canvas>;
    private engine: Engine | null = null;
    private traps: Trap[] = [];
    private maxTraps = 8;

    // Joueur
    private playerX = 0;
    private playerY = 0;
    private playerSize = 16;        // plus gros
    private playerVelocityY = 0;
    private gravity = 400;
    private jumpStrength = 280;     // saut plus haut
    private jumpState: "NONE" | "UP" = "NONE";

    // Sol
    private groundY = 0;

    // Traps
    private trapHeight = 16;       // plus gros
    private trapWidth = 16;        // plus large

    // Stats
    private deaths = 0;
    private score = 0;
    private highScore = 0;

    private running = true;
    private alive = true;

    constructor(engine: Engine, gameState: GameState | null, layers: Record<cvLayer, Canvas>) {
        this.gameState = gameState;
        this.layers = layers;
        this.engine = engine;

        this.updateLayout();
        this.buildTraps();

        window.addEventListener("keydown", e =>
        {
            if (e.key === "Escape")
            {
                if (!this.engine)
                    return;
                this.engine.togglePause();
            }
        });
    }

    private updateLayout() {
        const game = this.layers[cvLayer.GAME];
        this.groundY = game.height - 40;
        this.playerX = game.width * 0.15;
        this.playerSize = Math.min(12, game.height / 50);
        this.trapHeight = Math.min(16, game.height / 30);
        this.trapWidth = Math.min(16, game.width / 40);
        this.jumpStrength = game.height * 0.35; // saut plus haut
        this.gravity = game.height * 1.2;
        this.playerY = 0;
        this.playerVelocityY = 0;
    }

    update(delta: number)
    {
        if (!this.running) return;
        this.updatePlayer(delta);
        this.updateTraps(delta);
        this.render();
    }

    jump() {
        if (this.jumpState === "NONE") {
            this.jumpState = "UP";
            this.playerVelocityY = -this.jumpStrength;
        }
    }

    stop()
    {
        this.running = false;
        this.alive = false;
        this.traps = [];
        this.playerY = 0;
        this.playerVelocityY = 0;
        this.jumpState = "NONE";
    }

    private updatePlayer(delta: number)
    {
        if (this.jumpState === "UP")
        {
            this.playerVelocityY += this.gravity * delta;
            this.playerY += this.playerVelocityY * delta;

            if (this.playerY > 0)
            {
                this.playerY = 0;
                this.playerVelocityY = 0;
                this.jumpState = "NONE";
            }
        }
    }

    private updateTraps(delta: number)
    {
        const rMin: t_vec2 = { x: this.playerX, y: this.groundY + this.playerY - this.playerSize };
        const rMax: t_vec2 = { x: this.playerX + this.playerSize, y: this.groundY + this.playerY };

        for (let trap of this.traps)
        {
           // if (!trap.enabled)
            //    continue;

            trap.origin -= Math.min(2 + this.score / 32, 3) * delta * 60;

            const t1: t_vec2 = { x: trap.origin - 2, y: this.groundY };
            const t2: t_vec2 = { x: trap.origin + this.trapWidth / 2, y: this.groundY - this.trapHeight };
            const t3: t_vec2 = { x: trap.origin + this.trapWidth, y: this.groundY };

            if (trap.enabled && this.playerCollides(rMin, rMax, t1, t2, t3))
                this.resetPlayer();

            if (trap.enabled && trap.origin + this.trapWidth < this.playerX)
            {
                trap.enabled = false;
                this.score++;
            }
            if (!trap.enabled && trap.origin + this.trapWidth <= 0)
            {
                if (this.traps.every(t => !t.enabled))
                    this.buildTraps();
            }
        }
    }

    private resetPlayer()
    {
        this.alive = false;
        if (this.highScore < this.score)
            this.highScore = this.score;
        this.score = 0;
        this.deaths++;
        this.traps = [];
        this.buildTraps();
        this.alive = true;
        this.jumpState = "NONE";
        this.playerY = 0;
        this.playerVelocityY = 0;
    }

    private buildTraps()
    {
        const game = this.layers[cvLayer.GAME];
        let baseX = game.width;
        this.traps = [];

        for (let i = 0; i < this.maxTraps; i++)
        {
            const offset = 50 + Math.random() * 60;
            baseX += offset;
            this.traps.push({ origin: baseX, enabled: true });
        }
    }

    private playerCollides(rMin: t_vec2, rMax: t_vec2, a: t_vec2, b: t_vec2, c: t_vec2)
    {
        const sign = (p1: t_vec2, p2: t_vec2, p3: t_vec2) =>
            (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);

        const pointInTriangle = (p: t_vec2, a: t_vec2, b: t_vec2, c: t_vec2) =>
        {
            const b1 = sign(p, a, b) < 0;
            const b2 = sign(p, b, c) < 0;
            const b3 = sign(p, c, a) < 0;
            return b1 === b2 && b2 === b3;
        };

        const corners: t_vec2[] = [
            { x: rMin.x, y: rMin.y },
            { x: rMax.x, y: rMin.y },
            { x: rMax.x, y: rMax.y },
            { x: rMin.x, y: rMax.y },
        ];

        return corners.some(corner => pointInTriangle(corner, a, b, c));
    }

    render()
    {
        const bkg = this.layers[cvLayer.BKG];
        const game = this.layers[cvLayer.GAME];
        const ui = this.layers[cvLayer.UI];

        bkg.clear();
        game.clear();
        ui.clear();

        const img = getBackgroundSkin();
        
        bkg.drawRect(0, 0, bkg.width, bkg.height, "#000000ff");
        if (img)
        {
            bkg.drawImage(img, 0, 0, bkg.width, bkg.height);
        }
       // terrain.drawRect(0, 0, terrain.width, terrain.height, "#ff0000ff");

        //game.drawRect(-2, this.groundY - 2, 4, 4, "#000000ff");
        game.drawBox(0, this.groundY, game.width, 2, 2, "#000000ff", "#ffffffff", true, true);

        for (let trap of this.traps)
        {
            if (!trap.enabled)
                continue;
            const t1: t_vec2 = { x: trap.origin - 2, y: this.groundY };
            const t2: t_vec2 = { x: trap.origin + this.trapWidth / 2, y: this.groundY - this.trapHeight };
            const t3: t_vec2 = { x: trap.origin + this.trapWidth, y: this.groundY };
            game.drawTriangle(t1, t2, t3, "black", true, "white");
        }

        if (this.alive)
        {
            game.drawRect(this.playerX - 2, this.groundY + this.playerY - (this.playerSize + 2), this.playerSize + 4, this.playerSize + 4, "#000000ff");
            game.drawBox(this.playerX, this.groundY + this.playerY - this.playerSize, this.playerSize, this.playerSize, 2, "#ffffffff", "#0000ffff", true, true);
        }

        ui.drawText(`Deaths: ${this.deaths}`, 10, 20, "white");
        ui.drawText(`Score: ${this.score}`, 10, 40, "white");
        ui.drawText(`HighScore: ${this.highScore}`, 10, 60, "white");
    }
}
