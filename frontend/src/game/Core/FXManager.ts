import { Canvas } from "./canvas.js";
import { Resources } from "./Ressources.js";

export interface Fx
{
    x: number;
    y: number;
    frame: number;
    totalFrames: number;
    frameTime: number;
    timer: number;
    prefix: string;
}

export class FxManager
{
    private static _instance: FxManager | null = null;
    private fxList: Fx[] = [];

    private constructor()
    {
    }

    static start()
    {
        if (FxManager._instance)
            return;
        FxManager._instance = new FxManager;
    }

    static stop()
    {
        if (!FxManager._instance)
            return;
        FxManager.clear();
        FxManager._instance = null;
    }

    static getInstance(): FxManager | null
    {
        return (FxManager._instance);
    }

    static spawnFirework(x: number, y: number)
    {
        const inst = FxManager.getInstance();

        if (!inst)
            return;
        inst.fxList.push({x, y, frame: 0, totalFrames: 22, frameTime: 50, timer: 0, prefix: "fw_",});
        console.log( inst.fxList);
    }

    static update(delta: number)
    {
        const inst = FxManager.getInstance();

        if (!inst)
            return;
        for (let i = inst.fxList.length - 1; i >= 0; i--)
        {
            const fx = inst.fxList[i];
            fx.timer += delta;
            if (fx.timer >= fx.frameTime)
            {
                fx.frame++;
                fx.timer = 0;
            }
            if (fx.frame >= fx.totalFrames)
            {
                inst.fxList.splice(i, 1);
            }
        }
    }

    static draw(ctx: Canvas, size: number)
    {
        const inst = FxManager.getInstance();
        const res = Resources.getInstance();

        if (!inst || !res)
            return;
        for (const fx of inst.fxList)
        {
            const frameStr = fx.frame.toString().padStart(2, "0");
            const img = res.get("fx", fx.prefix + frameStr);
            if (img)
                ctx.drawImage(img, fx.x - size / 2, fx.y - size / 2, size, size);
        }
    }

    static clear()
    {
        const inst = FxManager.getInstance();

        if (!inst)
            return;
        inst.fxList = [];
    }

    static hasActiveFx(): boolean
    {
        const inst = FxManager.getInstance();

        if (!inst)
            return (false);
        return (inst.fxList.length > 0);
    }
}
