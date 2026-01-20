let apiKey = 0;

function initKey()
{
    const now = new Date();
    apiKey = (now.getHours() + now.getMinutes() + now.getSeconds() + now.getMilliseconds()) ^ 0xDEADC0DE;
}

export function rand(key:number)
{
    if (key === 0)
    {
        initKey();
        return;
    }
    apiKey = Math.floor(key);
}

export function irandom(beginRange: number, endRange:number): number
{
    const range = (endRange - beginRange) + 1;
    let r = 0;
    let c = 0;

    if (apiKey === 0)
        rand(0);

    apiKey ^= (apiKey << 13);
    apiKey ^= (apiKey >> 17);
    apiKey ^= (apiKey << 5);
    r = Math.abs(apiKey) % range;
    c = Math.floor(Math.random() * range);
    return (Math.floor(beginRange + (r + c) % range));
}

export function frandom(beginRange: number, endRange:number): number
{
    const range = (endRange - beginRange) + 1;
    let r = 0;
    let c = 0;

    if (apiKey === 0)
        rand(0);

    apiKey ^= (apiKey << 13);
    apiKey ^= (apiKey >> 17);
    apiKey ^= (apiKey << 5);
    r = (Math.abs(apiKey) / 0xFFFFFFFF) * range;
    c = Math.random() * range;
    return (beginRange + (r + c) % range);
}

export function linear_scaling(value:number, min:number, max:number, width:number): number
{
    return (((value - min) * width) / (max - min));
}

export function clamp(v: number, min: number, max: number)
{
  v = Number(v);
  if (Number.isNaN(v))
    return (min);
  return (Math.min(max, Math.max(min, v)));
}

export function toHex(v: number)
{
  return (clamp(v, 0, 255).toString(16).padStart(2, "0"));
}