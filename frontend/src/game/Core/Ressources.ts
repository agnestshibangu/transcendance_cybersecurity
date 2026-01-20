export class Resources
{
    private static _instance: Resources | null = null;
    private images: Record<string, Record<string, HTMLImageElement | null >> = {};
    private fallback!: HTMLImageElement | null ;

    private constructor()
    {
        this.createFallback();
    }

    static getInstance(): Resources | null
    {
        return (Resources._instance);
    }

    private async loadImages(): Promise<void>
    {
        //! Avatar
        await this.addImage("avatar", "default", "./public/images/avatars/default.png");
        for (let i = 1; i < 11; i++)
        {
            const id = i.toString().padStart(2, "0");
            await this.addImage("avatar", `a${id}`, `./public/images/avatars/a${id}.png`);
        }
        //! Skins
        await this.addImage("galaxy", "ball", "./public/images/skins/galaxy/ball.png");
        await this.addImage("galaxy", "background", "./public/images/skins/galaxy/background.png");

        await this.addImage("moon", "ball", "./public/images/skins/moon/ball.png");
        await this.addImage("moon", "background", "./public/images/skins/moon/background.png");
        
        await this.addImage("pokemon", "ball", "./public/images/skins/pokemon/ball.png");
        await this.addImage("pokemon", "background", "./public/images/skins/pokemon/background.png");
        
        await this.addImage("codzm", "ball", "./public/images/skins/codzm/ball.png");
        await this.addImage("codzm", "background", "./public/images/skins/codzm/background.png");

        //!FX Fireworks
        for (let i = 0; i < 22; i++)
        {
            const id = i.toString().padStart(2, "0");
            await this.addImage("fx", `fw_${id}`, `./public/images/fx/fireworks/fx_fw_${id}.png`);
        }
    }

    private addImage(category: string, variant: string, src: string): Promise<void>
    {
        if (!this.images[category])
            this.images[category] = {};

        if (this.images[category][variant])
            return Promise.resolve();

        return new Promise((resolve) =>
        {
            const img = new Image();

            img.onload = () =>
            {
                this.images[category][variant] = img;
                resolve();
            };

            img.onerror = () =>
            {
                console.warn(`[Resources] Missing image: ${src}`);
                this.images[category][variant] = this.fallback;
                resolve();
            };

            img.src = src;
        });
    }

    private createFallback(width = 1920, height = 1080): void
    {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "#ff00ff";
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, width, height);

        ctx.fillStyle = "#ff00ff";
        ctx.font = "48px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("MISSING TEXTURE", width / 2, height / 2);

        this.fallback = new Image();
        this.fallback.src = canvas.toDataURL();
    }

    get(category: string, variant: string): HTMLImageElement | null
    {
        return this.images[category]?.[variant] ?? this.fallback;
    }

    has(category: string, variant: string): boolean
    {
        return !!this.images[category]?.[variant];
    }

    private clear(): void
    {
        for (const cat in this.images)
        {
            for (const key in this.images[cat])
            {
                const img = this.images[cat][key];
                if (img)
                {
                    img.onload = null;
                    img.onerror = null;
                    img.src = "";
                }
                this.images[cat][key] = null;
            }
            this.images[cat] = {};
        }
        this.images = {};
    }

    static async start()
    {
        if (Resources._instance)
            return (Resources._instance);
        Resources._instance = new Resources();
        if (Resources._instance)
            await Resources._instance.loadImages();
    }

    static stop(): void
    {
        if (!Resources._instance)
            return;
        Resources._instance.clear();
        if (Resources._instance.fallback)
        {
            Resources._instance.fallback.src = "";
            Resources._instance.fallback = null;
        }
        Resources._instance = null;
    }
}

