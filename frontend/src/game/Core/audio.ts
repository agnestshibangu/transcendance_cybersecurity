import { Ref, makeStandaloneRef } from "../Utils/utils.js";
import { gUser } from "./user.js";

const uiVolume    = makeStandaloneRef(100);
const sfxVolume   = makeStandaloneRef(100);
const musicVolume = makeStandaloneRef(100);

let hasSoundPermission = true;
let resultAudioPemission = 2;

class AudioBus
{
  private sounds: Record<string, HTMLAudioElement[]> = {};
  private volume: Ref<number>;
  private polyphonic: boolean;
  

  constructor(volume: Ref<number>, polyphonic = false)
  {
    this.volume = volume;
    this.polyphonic = polyphonic;
    this.volume.listeners.add(v =>
      {
        const vol = Math.max(0, Math.min(1, v / 100));
        this.forEachSound(s => s.volume = vol);
      });
  }

  forEachSound(fn: (s: HTMLAudioElement) => void)
  {
    Object.values(this.sounds).forEach(arr => arr.forEach(fn));
  }

  pause(name: string | null)
  {
    if (name)
    {
      const arr = this.sounds[name];
      if (!arr) return;
      arr.forEach(a => a.pause());
    }
  }

  resume(name: string | null)
  {
    if (name)
    {
      const arr = this.sounds[name];
      if (!arr) return;
      arr.forEach(a =>
      {
          if (a.paused) a.play().catch(() => {});
      });
    }
  }

  stop(name: string | null)
  {
    if (name)
    {
      const arr = this.sounds[name];
      if (!arr) return;
      arr.forEach(a =>
      {
          a.pause();
          a.currentTime = 0;
      });
    }
  }

  load(name: string, src: string, loop = false, instances = 4)
  {
    if (this.sounds[name])
      return;
    this.sounds[name] = [];

    const count = this.polyphonic ? instances : 1;
    for (let i = 0; i < count; i++)
    {
      const a = new Audio(src);
      a.preload = "auto";
      a.loop = loop;
      a.volume = this.volume.value / 100;
      this.sounds[name].push(a);
    }
  }

  play(name: string)
  {
    const arr = this.sounds[name];
    if (!arr)
    {
      return;
    }
    const s = arr.find(a => a.paused || a.ended) ?? arr[0];
    if (s != null)
    {
      s.currentTime = 0;
      s.play().catch(() =>
      {
        if (name == "null" && resultAudioPemission == 2)
        {
          hasSoundPermission = false;
          resultAudioPemission = 1;
        }
      });
    }
  }

  pauseAll()
  {
    this.forEachSound(s => s.pause());
  }

  resumeAll()
  {
    this.forEachSound(s =>
    {
      if (!s.loop || !s.paused)
        return;
      s.play();
    });
  }

  stopAll()
  {
    this.forEachSound(s =>
    {
      s.pause();
      s.currentTime = 0;
    });
  }
}

export class AudioManager
{
  ui    = new AudioBus(uiVolume, false);
  music = new AudioBus(musicVolume, false);
  sfx   = new AudioBus(sfxVolume, false);
  
  private music_rv = 666;
  private currentMusic: string | null = null;
  private static _instance: AudioManager;

  private constructor()
  {
      //init sound
    this.music.load("null", "/public/sounds/ui/null.ogg", true);
    this.music.load("null", "/public/sounds/sfx/null.ogg", true);
    this.music.load("null", "/public/sounds/music/null.ogg", true);


    this.ui.load("click", "/public/sounds/ui/click.ogg");
    this.ui.load("goodbye", "/public/sounds/ui/goodbye.ogg");
    this.ui.load("accessMainPage", "/public/sounds/ui/accessMainPage.ogg");
    this.ui.load("boughtfail", "/public/sounds/ui/bought_fail.ogg");
    this.ui.load("boughtsuccess", "/public/sounds/ui/bought_success.ogg");
    
    //this.ui.load("hover", "/sounds/hover.mp3");
    
    this.sfx.load("testSFX", "/public/sounds/sfx/sfx_settings.ogg");
    this.sfx.load("cntd_tick", "/public/sounds/sfx/countdown_tick.ogg");
    this.sfx.load("cntd_start", "/public/sounds/sfx/countdown_start.ogg");
    this.sfx.load("rankup", "/public/sounds/sfx/rankup.ogg");
    this.sfx.load("trophy", "/public/sounds/sfx/trophy.ogg");
    
    this.music.load("mainmenu", "/public/sounds/music/mainmenu.ogg", true);
    this.music.load("pve", "/public/sounds/music/pve_music.ogg", true);
    this.music.load("pvp", "/public/sounds/music/pvp_music.ogg", true);
    this.music.load("2v2", "/public/sounds/music/2v2_music.ogg", true);
    this.music.load("tournament_base", "/public/sounds/music/tournament_base.ogg", true);
    this.music.load("tournament_final", "/public/sounds/music/tournament_final.ogg", true);
    this.music.load("last_action", "/public/sounds/music/last_action.ogg", true);
    //this.music.load("bgm", "/sounds/bgm.mp3", true);
    //this.music.load("boss", "/sounds/boss.mp3", true);
  }

  static getInstance(): AudioManager
  {
    if (!this._instance)
        this._instance = new AudioManager();
    return (this._instance);
  }

  // Méthodes pause, resume, stop… comme avant
  pauseAll() { this.ui.pauseAll(); this.music.pauseAll(); this.sfx.pauseAll(); }
  resumeAll() { this.ui.forEachSound(s => s.paused && s.play()); this.music.resumeAll(); }
  stopAll() { this.ui.stopAll(); this.music.stopAll(); this.sfx.stopAll(); }


  playMusic(name: string)
  {
    if (!this.music || this.currentMusic === name)
      return;
    this.music.stopAll();
    this.music.play(name);
    this.currentMusic = name;
  }

  pauseCurrentMusic()
  {
    this.music.pause(this.currentMusic);
  }

  resumeCurrentMusic()
  {
    this.music.resume(this.currentMusic);
  }

  stopCurrentMusic()
  {
    this.music.stop(this.currentMusic);
  }

  updateUIVolume()
  {
    uiVolume.value    = gUser.refs.settings.volume_ui.value;
    uiVolume.listeners.forEach(fn => fn(uiVolume.value));
  }

  updateSFXVolume()
  {
    sfxVolume.value    = gUser.refs.settings.volume_sfx.value;
    sfxVolume.listeners.forEach(fn => fn(sfxVolume.value));
  }

  updateMusicVolume()
  {
    musicVolume.value    = gUser.refs.settings.volume_music.value;
    musicVolume.listeners.forEach(fn => fn(musicVolume.value));
  }

  reduceMusic()
  {
    if (this.music_rv != 666)
        return;
    this.music_rv = musicVolume.value;
    musicVolume.value = 10;
    musicVolume.listeners.forEach(fn => fn(musicVolume.value));
  }

  upMusic()
  {
    if (this.music_rv == 666)
        return;
    musicVolume.value = this.music_rv;
    musicVolume.listeners.forEach(fn => fn(musicVolume.value));
    this.music_rv = 666;
  }
}

export async function testAudioPermission(): Promise<boolean>
{
  if (resultAudioPemission == 2)
  {
    const audio = AudioManager.getInstance();

    try
    {
      await audio.ui.play("null");
      await audio.sfx.play("null");
      await audio.music.play("null");
    }
    catch
    {
      hasSoundPermission = false;
    }

    resultAudioPemission = 1;
  }
  return (hasSoundPermission);
}

export function getAudioManager(): AudioManager
{
  return (AudioManager.getInstance());
}
