import { Player, PlayerTeam } from "./Player.js";
import { Engine, IG_Profile, stopEngine } from "./Engine.js";
import { generateBotName } from "../bot_funcs.js";
import { Input } from "./inputs/Input.js";
import { PlayerController } from "./inputs/PlayerController.js";
import { HumanController } from "./inputs/HumanController.js";
import { BotController, BotDifficulty } from "./inputs/BotController.js";
import { GameState } from "./GameState.js";
import { GameSystem } from "./GameSystem.js";
import { gUser } from "./user.js";
import { irandom } from "../Utils/math.js";

export class EnginePlayers
{
    private engine: Engine | null;
    private system: GameSystem | null;
    private players: Player[] = [];
    private controllers: PlayerController[] = [];

    constructor(engine: Engine)
    {
        this.engine = engine;
        this.system = engine.getGameSystem();
    }

    private addHuman(name: string, team: PlayerTeam, avatarId: number, isHost: boolean = false)
    {
        const human = new Player(this.players.length, name, "human", team, avatarId, true);
        this.players.push(human);
        this.controllers.push(new HumanController(human));
    }

    private addBot(team: PlayerTeam, difficulty: BotDifficulty, name: string | null = null)
    {
        if (!name)
        {
            name = generateBotName();
        }
        const bot = new Player(this.players.length, name, "bot", team, irandom(1, 10));
        this.players.push(bot);
        this.controllers.push(new BotController(bot, difficulty));
    }

    private makeBackupProfiles(hostname: string): IG_Profile[]
    {
        let av = gUser.network.profile.avatar_id;
        return [ { name: hostname, avatarId: av, isBot: false }, { name: `${hostname} (2)`, avatarId: av, isBot: false }, { name: `${hostname} (3)`, avatarId: av, isBot: false }, { name: `${hostname} (4)`, avatarId: av, isBot: false },];
    }

    private normalizePlayersList(players: IG_Profile[], hostname: string): IG_Profile[]
    {
        const backups = this.makeBackupProfiles(hostname);

        return [ ...players, ...backups.slice(players.length) ].slice(0, 4);
    }

    private testHost(plist: IG_Profile[]): boolean
    {
        if (!this.engine)
            return false;
        const hostname = this.engine.getHostname();
        for (let i = 0; i < plist.length; i++)
        {
            if (plist[i].name === hostname)
            {
                console.log("Host ingame: " + i + ", " + plist[i] + ", " +plist);
                return (true);
            }
        }
        return (false);
    }

    setupPlayers(plist: IG_Profile[])
    {
        this.players = [];
        this.controllers = [];

        if (!this.engine)
            return;
        const hostname = this.engine.getHostname();
        const difficulty = this.engine.getDifficulty();
        const gameMode = this.engine.getGameMode();
        const clientCounts = this.engine.getClientsCount();
        plist = this.normalizePlayersList(plist, hostname);

        this.testHost(plist);
        this.addHuman(plist[0].name, "allies", plist[0].avatarId, (plist[0].name === hostname));
        switch (gameMode)
        {
            case "pvp":
            {
                this.addHuman(plist[1].name, "axis", plist[1].avatarId, (plist[1].name === hostname));
                break;
            }
            case "pve":
            {
                this.addBot("axis", difficulty);
                break;
            }
            case "2v2":
            {
                let i = 0;
                for (i = 0; i < 3; i++)
                {
                    let team: PlayerTeam = "allies";
                    if (!(i % 2))
                        team = "axis"
                    if (i < clientCounts)
                        this.addHuman(plist[i + 1].name, team, plist[i + 1].avatarId, (plist[i + 1].name === hostname));
                    else
                        this.addBot(team, difficulty);
                }
                break;
            }
            case "tnm":
            {
                if (plist[1].isBot)
                    this.addBot('axis', difficulty, plist[1].name);
                else
                    this.addHuman(plist[1].name, 'axis', plist[1].avatarId, (plist[1].name === hostname));
                break;
            }
        }
        plist = [];
    }

    updateControllers(delta: number)
    {
        let i = 0;
        for (const controller of this.controllers)
        {
            if (controller instanceof BotController)
            {
                if (this.system)
                    controller.update(delta, this.system.createBotContext(controller));
                i++;
                continue;
            }
            controller.update(delta, i);
            i++;
        }
    }

    getPlayers(): Player[]
    {
        return this.players;
    }

    getControllers(): PlayerController[]
    {
        return this.controllers;
    }
    getHumanPlayer(): Player
    {
        const human = this.players.find(p => p.type === "human");
        if (!human) throw new Error("Pas de joueur humain trouvé");
        return human;
    }

    removePlayer(player: Player)
    {
        this.players = this.players.filter(p => p !== player);
        this.controllers = this.controllers.filter(c => c['player'] !== player);
    }

    simulateBotMatch(): Player
    {
        const bots = this.players.filter(p => p.type === "bot");
        if (bots.length === 0) throw new Error("Pas de bot à simuler");
        const winnerIndex = Math.floor(Math.random() * bots.length);
        return bots[winnerIndex];
    }

    updateSystemInputs()
    {
        const host = this.players.find(p => p.isHost);
        if (!host || !this.engine)
            return;

        if (this.engine.getGameMode() === "fakedash")
        {
            if (Input.isDown(" "))
            {
                this.engine.getFakeDashManager()?.jump();
            }
            return;
        }
        if (Input.isDownOnce(" "))
            this.engine.togglePause();
    }

    stop()
    {
        this.players = [];
        this.controllers = [];
        this.engine = null;
        this.system = null;
    }
}
