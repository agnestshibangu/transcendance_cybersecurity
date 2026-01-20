import { cvLayer, Canvas, initLayers } from "./canvas.js";
import { EnginePlayers } from "./EnginePlayers.js";
import { Renderer } from "./Render.js";
import { Input } from "./inputs/Input.js";
import { GameState } from "./GameState.js";
import { GameSystem } from "./GameSystem.js";
import { FakeDashManager } from "./gamemodes/fakedash.js";
import { Resources } from "./Ressources.js";
import { BotDifficulty } from "./inputs/BotController.js";
import { getDBUserName } from "../profile.js";
import { getSubs, ShowPauseMenu } from "../menusLoad.js";
import { FxManager } from "./FXManager.js";
import { getAudioManager } from "./audio.js";

export type GameMode = "pve" | "pvp" | "2v2" | "tnm" | "fakedash";

export type GameConfig =
{
  gamemode: GameMode;
  goalLimit: number;
  timeLimit: number;
  difficulty: number;
  timescale: number;
  clientCounts: number;
};

export type IG_Profile =
{
  name: string
  avatarId: number;
  isBot: boolean;
};

let PlayersList: IG_Profile[] = [];

function getPlayersList(): IG_Profile[]
{
  return (PlayersList);
}

function setupPlayersList(Player1: IG_Profile | null = null, Player2: IG_Profile | null = null)
{
  if (PlayersList.length > 0)
  {
    PlayersList = [];
  }
  if (!Player1 || !Player2)
    return;
  PlayersList.push(Player1);
  PlayersList.push(Player2);
}


export class Engine
{
  private lastRender = 0;
  private lastUpdate = 0;
  private lastPlayerCmd = 0;
  private sv_running = false;
  private cl_paused = false;
  private cl_inGame = false;
  private renderer: Renderer | null = null;
  private playersManager: EnginePlayers | null = null;
  private gameState: GameState | null = null;
  private gameSystem: GameSystem | null = null;
  private layers: Record<cvLayer, Canvas>;
  private fakeDashManager: FakeDashManager | null = null;
  private configs =
  {
    sv_botDifficulty: 0,
    sv_goalLimit: 10,
    sv_timeLimit: 15,
    sv_hostname: "" as string,
    sv_gamemode: "pve" as GameMode,
    sv_clientsCount: 0
  };
  private settings =
  {
    timescale:  1.0,
    fps:        72, //? fps rendu (HZ)
    updateRate: 90, //? update per second (HZ)
    playerRate: 144,//? inputs per second (HZ)
  };
  
  constructor(renderRoot: HTMLDivElement)
  {
    this.layers = initLayers(renderRoot);
    FxManager.start();
    this.gameState = new GameState(this.layers[cvLayer.GAME].width,this.layers[cvLayer.GAME].height);
    this.gameSystem = new GameSystem(this, this.gameState);
    this.renderer = new Renderer(this.layers, this.gameState);
    this.configs.sv_hostname = getDBUserName();
    if (!this.configs.sv_hostname)
      this.configs.sv_hostname = "?";
  }
  
  async start()
  {
    if (this.sv_running)
      return;
      await Resources.start();  
      this.playersManager = new EnginePlayers(this);
      this.playersManager.setupPlayers(getPlayersList());
      this.sv_running = true;
      this.cl_inGame = true;
      this.lastRender = performance.now();
      this.lastUpdate = performance.now();
      this.lastPlayerCmd = performance.now();
      if (this.getGameMode() === "fakedash")
      {
        this.fakeDashManager = new FakeDashManager(this, this.gameState, this.layers);
      }
      requestAnimationFrame(this.run);
    }

    stop()
    {
      Input.stop();
      this.cl_paused = false;
      this.sv_running = false;
      this.cl_inGame = false;
      this.lastRender = 0;
      this.lastUpdate = 0;
      this.lastPlayerCmd = 0;
      if (this.getGameMode() === "fakedash")
        {
          //this.fakeDashManager = new FakeDashManager(this.gameState, this.layers);
        }
        if (this.renderer)
          this.renderer.stop();
        if (this.gameSystem)
          this.gameSystem.stop();
        if (this.playersManager)
          {
            this.playersManager.stop();
            this.playersManager = null;
          }
          if (this.gameState)
            {
              this.gameState.stop();
              console.log("Engine stopped and cleaned.");
            }
      FxManager.stop();
      Resources.stop();
    }

    getTimescale(): number
    {
      return (this.settings.timescale);
    }

    setTimescale(timescale: number)
    {
      this.settings.timescale = timescale;
    }
    
    setFPS(fpsCap:number)
    {
      this.settings.fps = fpsCap;
    }
    
    setPlayerRate(rate:number)
    {
      this.settings.playerRate = rate;
    }

    setUpdateRate(rate:number)
    {
      this.settings.updateRate = rate;
    }

    setGameMode(mode: GameMode)
    {
      this.configs.sv_gamemode = mode;
    }

    setBotDifficulty(difficulty: number)
    {
      this.configs.sv_botDifficulty = difficulty;
    }

    setTimeLimit(msTime: number)
    {
      this.configs.sv_timeLimit = msTime;
    }
    
    setGoalLimit(ngoal: number)
    {
      this.configs.sv_goalLimit = ngoal;
    }

    getGoalLimit(): number
    {
      return (this.configs.sv_goalLimit);
    }

    getTimeLimit(): number
    {
      return (this.configs.sv_timeLimit);
    }

    getHostname()
    {
      return (this.configs.sv_hostname);
    }

    getGameSystem(): GameSystem | null
    {
      return (this.gameSystem);
    }

    getDifficulty(): BotDifficulty
    {
      switch (this.configs.sv_botDifficulty)
      {
        case 1: return ("normal");
        case 2: return ("hard");
        case 3: return ("insane");
        default: return ("easy");
      }
    }

    getClientsCount(): number
    {
      return (this.configs.sv_clientsCount);
    }

    setClientsCount(v:number)
    {
      this.configs.sv_clientsCount = v;
    }
  
    getGameMode(): string
    {
      return (this.configs.sv_gamemode);
    }

    isPaused(): boolean
    {
      return (this.cl_paused);
    }

    isInGame(): boolean
    {
      return (this.cl_inGame);
    }

    getLayers(): Record<cvLayer, Canvas>
    {
      return (this.layers);
    }

    getPlayersManager(): EnginePlayers
    {
        if (!this.playersManager)
          throw new Error("Players manager non initialisé");
        return (this.playersManager);
    }

    togglePause()
    {
        this.cl_paused = !this.cl_paused;
        ShowPauseMenu(this.cl_paused);
    }

    pause()
    {
      this.cl_paused = true;
    }

    resume()
    {
      this.cl_paused = false;
    }

    getFakeDashManager()
    {
      return (this.fakeDashManager);
    }

    showData(): void
    {
      console.log("=== Engine Data ===");
      console.log("Render Layers:", this.layers);
      console.log("Last Render:", this.lastRender);
      console.log("Last Update:", this.lastUpdate);
      console.log("Last Player Cmd:", this.lastPlayerCmd);
      console.log("Server Running:", this.sv_running);
      console.log("Client Paused:", this.cl_paused);
      console.log("Client In Game:", this.cl_inGame);
      console.log("Players Manager:", this.playersManager);
      if (this.playersManager) {
          console.log("Players:", this.playersManager.getPlayers());
      }
      console.log("Configs:", this.configs);
      console.log("Settings:", this.settings);
      console.log("===================");
    }

    private canProcessInputs(): boolean
    {
      return (!this.cl_paused);
    }

    private canUpdate(): boolean
    {
      return (!this.cl_paused || this.configs.sv_gamemode !== "pve");
    }

    private run = (ts?:number) =>
    {
      ts = ts ?? performance.now();

      const isFakeDash = this.getGameMode() === "fakedash";
      const deltaRender = ts - this.lastRender;
      const deltaUpdate = ts - this.lastUpdate;
      const deltaPlayer = ts - this.lastPlayerCmd;
      const renderStep = (1000 / this.settings.fps);
      const updateStep = (1000 / this.settings.updateRate);
      const playerStep = (1000 / this.settings.playerRate);

      if (deltaPlayer >= playerStep)
      {
        this.lastPlayerCmd = ts;
        this.playersManager?.updateSystemInputs();
        if (!isFakeDash && this.canProcessInputs() && this.playersManager)
        {
          this.playersManager.updateControllers(deltaPlayer);
        }
      }
      if (deltaUpdate >= updateStep)
      {
        this.lastUpdate = ts;
        if (isFakeDash && this.fakeDashManager)
        {
          this.fakeDashManager.update(deltaUpdate / 1000);
        }
        else if (this.canUpdate())
        {
          if (this.gameSystem)
            this.gameSystem.update(deltaUpdate * this.settings.timescale);
        }
      }
      if (deltaRender >= renderStep)
      {
        this.lastRender = ts;
        if (isFakeDash && this.fakeDashManager)
        {
          this.fakeDashManager?.render();
        }
        else
        {
          let p = this.playersManager?.getPlayers();
          if (p)
            this.renderer?.render(p, deltaUpdate / 1000);
        }
      }
      if (!this.sv_running)
        return;
      requestAnimationFrame(this.run);
    };
}

let pEngine: Engine | null = null;

export function startEngine(root: HTMLDivElement, configs: GameConfig)
{
    if (pEngine)
        throw new Error("Engine already running");
    pEngine = new Engine(root);
    pEngine.setBotDifficulty(configs.difficulty);
    pEngine.setClientsCount(configs.clientCounts);
    pEngine.setGameMode(configs.gamemode);
    pEngine.setGoalLimit(configs.goalLimit);
    pEngine.setTimeLimit(configs.timeLimit);
    pEngine.setTimescale(configs.timescale);
    pEngine.setFPS(90);
    pEngine.setUpdateRate(90);
    pEngine.setPlayerRate(144);
    Input.start();
    pEngine.start();
    pEngine.showData();
}

export function getEngine(): Engine | null
{
    return (pEngine);
}

export async function stopEngine()
{
  const audio = getAudioManager();
   
    if (!pEngine)
        throw new Error("No engine running");
    let gm = pEngine.getGameMode();
    pEngine.stop();
    pEngine = null;
    const subs = getSubs();
    if (gm === "fakedash")
      gm = "play";
    subs.showMenu(`menu-${gm}`);
    audio.stopCurrentMusic();
    audio.playMusic("mainmenu");
}


setupPlayersList({name: "Gustave", avatarId: 10, isBot: false}, {name: "Einrich", avatarId: 2, isBot: true});