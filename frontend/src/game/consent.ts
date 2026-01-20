import { getAudioManager, testAudioPermission } from "./Core/audio.js";

const CONSENT_KEY = "audioConsent";
const CONSENT_TITLE = `Atlantis • Core`
const CONSENT_SUBTITLE = `Privacy & Usage Information`
const CONSENT_TEXT = `We use cookies and other data to:<br><br>
&nbsp;&nbsp;&nbsp;&nbsp;• Ensure Atlantis • Core services run smoothly.<br><br>
&nbsp;&nbsp;&nbsp;&nbsp;• Monitor service interruptions and protect against spam, fraud, and abuse.<br><br>
&nbsp;&nbsp;&nbsp;&nbsp;• Measure user engagement and site statistics to understand how our services
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;are used and improve their quality.<br><br>
By clicking “Accept All”, you also allow us to:<br><br>
&nbsp;&nbsp;&nbsp;&nbsp;• Develop new services and enhance existing ones.<br><br>
&nbsp;&nbsp;&nbsp;&nbsp;• Increase engagement using a virtual in‑game currency to purchase content.<br><br>
You can always visit <a href="https://github.com/NyTekCFW" target="_blank" class="underline">https://github.com/NyTekCFW</a> to see the frontend developer.`;

const CONSENT_BUTTONACCEPTTEXT = 'Accept All';
const CONSENT_BUTTONREJECTTEXT = 'Refuse All';
const CONSENT_ERROR = 'You have refused the conditions, you will not be able to access the site.';


/*export async function initConsent()
{
  const audio = getAudioManager();
  const hasPerm = await testAudioPermission();

  const bg = document.createElement("div");
  bg.id = "animated-bg";
  bg.className = "fixed inset-0 z-[9999] bg-atlantisBg overflow-hidden";

  bg.innerHTML = `
    <!-- GRID -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="w-full h-full
        bg-[linear-gradient(to_right,_rgba(15,118,110,0.25)_1px,transparent_1px),
            linear-gradient(to_bottom,_rgba(15,118,110,0.25)_1px,transparent_1px)]
        bg-[size:32px_32px]">
      </div>
    </div>

    <!-- SCAN VERTICAL -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute inset-x-0 h-full
        bg-gradient-to-b from-atlantisCyan/40 via-transparent to-transparent
        animate-scan-slow">
      </div>
    </div>

    <!-- SCAN HORIZONTAL -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute inset-y-0 w-full
        bg-gradient-to-r from-atlantisCyan/20 via-transparent to-transparent
        animate-scan-x-slow">
      </div>
    </div>
  `;

  document.body.appendChild(bg);

  if (!localStorage.getItem(CONSENT_KEY))
  {
      const box = document.createElement("div");
      box.className = "absolute inset-0 flex items-center justify-center";

      box.innerHTML = `
      <div class="hud-panel rounded-hud px-8 py-6 
                  border border-cyan-500/50 shadow-hud-panel
                  bg-slate-950/100 max-w-xl">
          
          <!-- Titre centré -->
          <h1 class="text-cyan-100 text-xl font-bold text-center mb-2">
              ${CONSENT_TITLE}
          </h1>
          
          <!-- Subtitle centré en dessous -->
          <h2 class="text-cyan-200 text-md font-bold text-center mb-4">
              ${CONSENT_SUBTITLE}
          </h2>
          
          <!-- Texte aligné à gauche -->
          <p class="text-cyan-200 text-sm text-left">
              ${CONSENT_TEXT}
          </p>
          
          <!-- Bouton -->
          <div class="flex justify-end gap-2 mt-6">
            <div
                id="reject"
                class="nav-pill active cursor-pointer
                    hover:bg-cyan-400/20 hover:text-cyan-50 transition-colors duration-150"
            >
                ${CONSENT_BUTTONREJECTTEXT}
            </div>
            <div
                id="accept-consent"
                class="nav-pill active cursor-pointer
                    hover:bg-cyan-400/20 hover:text-cyan-50 transition-colors duration-150"
            >
                ${CONSENT_BUTTONACCEPTTEXT}
            </div>
        </div>
      </div>
      `;

    bg.appendChild(box);

    box.querySelector("#accept-consent")!.addEventListener("click", () =>
    {
        localStorage.setItem(CONSENT_KEY, "1");
        if(!hasPerm)
        {
          audio.ui.play("null");
          audio.sfx.play("null");
          audio.music.play("null");
        }
        else
          audio.reduceMusic();
        audio.ui.play("accessMainPage");
        setTimeout(() =>
        {
            bg.remove();
            if(!hasPerm)
            {
              audio.music.play("mainmenu");
            }
            else
             audio.upMusic();
        }, 450);
    });
    box.querySelector("#reject")!.addEventListener("click", () =>
    {
        if (hasPerm)
            audio.reduceMusic();
        audio.ui.play("goodbye");
        const refusePopup = document.createElement("div");
        refusePopup.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/90";

        refusePopup.innerHTML = `
            <div class="hud-panel rounded-hud px-8 py-6 text-center max-w-md border border-cyan-500/50 shadow-hud-panel bg-slate-950">
                <p class="text-cyan-200 text-sm">
                    ${CONSENT_ERROR}
                </p>
            </div>
        `;

        document.body.appendChild(refusePopup);
        setTimeout(() =>
        {
            refusePopup.remove();
            window.location.href = "about:blank";
        }, 8000);
    });
    return;
  }*/

function initAudio(hasPerm:boolean)
{
  const audio = getAudioManager();

  if (hasPerm || !audio)
    return;
  audio.ui?.play("null");
  audio.sfx?.play("null");
  audio.music?.play("null");
}

function startMainMusic(hasPerm:boolean)
{
  const audio = getAudioManager();

  if (!hasPerm || !audio)
    return;
  audio.music?.play("mainmenu");
}


export function initConsent(): Promise<void>
{
  return new Promise(async (resolve) =>
  {
    const audio = getAudioManager();
    const hasPerm = await testAudioPermission();

    if (document.getElementById("animated-bg"))
      return resolve();

    startMainMusic(hasPerm);
    const bg = document.createElement("div");
    bg.id = "animated-bg";
    bg.className = "fixed inset-0 z-[9999] bg-atlantisBg overflow-hidden";

    bg.innerHTML = `
	    <!-- GRID -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="w-full h-full
        bg-[linear-gradient(to_right,_rgba(15,118,110,0.25)_1px,transparent_1px),
            linear-gradient(to_bottom,_rgba(15,118,110,0.25)_1px,transparent_1px)]
        bg-[size:32px_32px]">
      </div>
    </div>

    <!-- SCAN VERTICAL -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute inset-x-0 h-full
        bg-gradient-to-b from-atlantisCyan/40 via-transparent to-transparent
        animate-scan-slow">
      </div>
    </div>

    <!-- SCAN HORIZONTAL -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute inset-y-0 w-full
        bg-gradient-to-r from-atlantisCyan/20 via-transparent to-transparent
        animate-scan-x-slow">
      </div>
    </div>
	`
    document.body.appendChild(bg);

    const finish = () =>
    {
      bg.remove();
      resolve();
    };

    if (!localStorage.getItem(CONSENT_KEY))
    {
      const box = document.createElement("div");
      box.className = "absolute inset-0 flex items-center justify-center";
      box.innerHTML = `<div class="hud-panel rounded-hud px-8 py-6 
                  border border-cyan-500/50 shadow-hud-panel
                  bg-slate-950/100 max-w-xl">
          
          <!-- Titre centré -->
          <h1 class="text-cyan-100 text-xl font-bold text-center mb-2">
              ${CONSENT_TITLE}
          </h1>
          
          <!-- Subtitle centré en dessous -->
          <h2 class="text-cyan-200 text-md font-bold text-center mb-4">
              ${CONSENT_SUBTITLE}
          </h2>
          
          <!-- Texte aligné à gauche -->
          <p class="text-cyan-200 text-sm text-left">
              ${CONSENT_TEXT}
          </p>
          
          <!-- Bouton -->
          <div class="flex justify-end gap-2 mt-6">
            <div
                id="reject"
                class="nav-pill active cursor-pointer
                    hover:bg-cyan-400/20 hover:text-cyan-50 transition-colors duration-150"
            >
                ${CONSENT_BUTTONREJECTTEXT}
            </div>
            <div
                id="accept-consent"
                class="nav-pill active cursor-pointer
                    hover:bg-cyan-400/20 hover:text-cyan-50 transition-colors duration-150"
            >
                ${CONSENT_BUTTONACCEPTTEXT}
            </div>
        </div>
      </div>
		`
      bg.appendChild(box);
      box.querySelector("#accept-consent")!.addEventListener("click", () =>
      {
        localStorage.setItem(CONSENT_KEY, "1");
        initAudio(hasPerm);
        audio.reduceMusic();
        audio.ui.play("accessMainPage");
        setTimeout(() =>
        {
          if (!hasPerm)
            startMainMusic(true);
          else
            audio.upMusic();
          finish();
        }, 450);
      });

      box.querySelector("#reject")!.addEventListener("click", () =>
      {
        if (hasPerm)
          audio.reduceMusic();
        audio.ui.play("goodbye");
        const refusePopup = document.createElement("div");
        refusePopup.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/90";
        refusePopup.innerHTML = `<div class="hud-panel rounded-hud px-8 py-6 text-center max-w-md border border-cyan-500/50 shadow-hud-panel bg-slate-950">
                                  <p class="text-cyan-200 text-sm">
                                      ${CONSENT_ERROR}
                                  </p>
                                </div>
		`;
        document.body.appendChild(refusePopup);
        setTimeout(() =>
        {
          refusePopup.remove();
          window.location.href = "about:blank";
        }, 8000);
      });
      return;
    }
    const text = document.createElement("div");
    text.className = "absolute bottom-6 left-1/2 -translate-x-1/2 text-cyan-100 font-bold text-center mb-2 uppercase tracking-widest text-xl animate-fade-blink";
    text.style.animation = "fadeBlink 1.2s ease-in-out infinite";
    text.textContent = "Click to access";
    bg.appendChild(text);
    bg.addEventListener("click", () =>
    {
        initAudio(hasPerm);
        audio?.reduceMusic();
        audio?.ui?.play("accessMainPage");
        setTimeout(() =>
        {
            text.remove();
            finish();
            if(!hasPerm)
            {
              startMainMusic(true);
            }
            else
              audio?.upMusic();
        }, 450);
      }, { once: true });
  });
}

