export class GameTimer
{
    private elapsedMs: number = 0;
    private timeLimitMin: number = 0;
    callback: (() => void) | null = null;

    constructor(timeLimitMin: number, cb: (() => void) | null = null)
    {
        this.timeLimitMin = timeLimitMin;
        this.callback = cb;
    }

    update(deltaMs: number)
    {
        this.elapsedMs += deltaMs;
        if (this.elapsedMs > (this.timeLimitMin * 60_000))
        {
            this.elapsedMs = (this.timeLimitMin * 60_000);
        }
    }

    isFinished(): boolean
    {
        return (this.elapsedMs >= (this.timeLimitMin * 60_000));
    }

    getRemaining(): { min: number; sec: number }
    {
        const remainingMs = Math.max(this.timeLimitMin * 60_000 - this.elapsedMs, 0);
        const min = Math.floor(remainingMs / 60_000);
        const sec = Math.floor((remainingMs % 60_000) / 1000);
        return { min, sec };
    }

    getRemainingStr(): string
    {
        const { min, sec } = this.getRemaining();
        return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    }

    setCallback(cb: (() => void) | null)
    {
        this.callback = cb;
    }

    exec()
    {
        if (this.callback)
            this.callback();
    }

    reset()
    {
        this.elapsedMs = 0;
    }

    stop()
    {
        this.timeLimitMin = 0;
        this.elapsedMs = 0;
        this.callback = null;
    }
}