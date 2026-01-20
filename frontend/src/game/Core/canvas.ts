import { t_vec2 } from "../Utils/vector.js";

export enum cvLayer
{
  BKG = 0,
  GAME = 1,
  UI = 2
}

export class Canvas
{
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private parent!: HTMLDivElement;
  private resizeObserver!: ResizeObserver;

  constructor(parent: HTMLDivElement, zIndex: number)
  {
    this.parent = parent;
    this.init(zIndex);
    this.setupResize();
  }

  private init(zIndex: number)
  {
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.zIndex = zIndex.toString();
    this.parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();
  }

  private setupResize()
  {
      const resize = () => this.resize();
      this.resizeObserver = new ResizeObserver(() => resize());
      this.resizeObserver.observe(this.parent);
  }

  private resize()
  {
    const w = this.parent.clientWidth;
    const h = this.parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    if (
      this.canvas.width === Math.floor(w * dpr) &&
      this.canvas.height === Math.floor(h * dpr)
    ) return;

    this.canvas.width  = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width  = w + "px";
    this.canvas.style.height = h + "px";

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }


  get width()
  {
    return (this.canvas.width);
  }

  get height()
  {
    return (this.canvas.height);
  }

  get _ctx()
  {
    return (this.ctx);
  }

  setZIndex(z: number)
  {
    this.canvas.style.zIndex = z.toString();
  }

  clear()
  {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawRect(x:number, y:number, width:number, height:number, color:string)
  {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
  }

  drawBox(x:number, y:number, width:number, height:number, thickness:number, outlinesColor:string, bkgColor:string, showOutlines:boolean, showBkg:boolean)
  {
    if (showOutlines)
    {
      this.ctx.fillStyle = outlinesColor;
      this.ctx.fillRect(x, y, thickness, height);
      this.ctx.fillRect(x + width - thickness, y, thickness, height);
      this.ctx.fillRect(x, y, width, thickness);
      this.ctx.fillRect(x, y + height - thickness, width, thickness);
    }
    if (showBkg)
    {
      const m = thickness * 2;
      this.ctx.fillStyle = bkgColor;
      this.ctx.fillRect(x + thickness, y + thickness, width - m, height - m);
    }
  }

  drawTriangle(a: t_vec2, b: t_vec2, c: t_vec2, color: string, stroke: boolean, strokeColor?: string) {
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.lineTo(c.x, c.y);
    this.ctx.closePath();

    this.ctx.fillStyle = color;
    this.ctx.fill();

    if (stroke)
    {
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = "black";
      this.ctx.stroke();
      if (strokeColor)
      {
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.stroke();
      }
    }
}

  drawText(str: string | null, x: number, y: number, color: string, shadow: boolean = true, font: string = "20px Arial")
  {
    if (!str)
      return;
    this.ctx.save();
    this.ctx.font = font;
    this.ctx.fillStyle = color;
    if (shadow)
    {
      this.ctx.shadowColor = "black";
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetX = 2;
      this.ctx.shadowOffsetY = 2;
    }
    this.ctx.fillText(str, x, y);
    this.ctx.restore();
  }

  getTextWidth(str: string | null, font: string = "20px Arial"): number
  {
    if (!str)
      return (0);
    this.ctx.font = font;
    return (this.ctx.measureText(str).width);
  }

  getTextHeight(str: string | null, font: string = "20px Arial"): number//! should not work on Internet Explorer
  {
    if (!str)
      return (0);
    this.ctx.font = font;
    const metrics = this.ctx.measureText(str);
    return (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
  }

  drawImage(img: HTMLImageElement | null, x: number, y: number, width?: number, height?: number)
  {
    if (!img)
      return;
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    if (!width || !height)
    {
      this.ctx.drawImage(img, x, y);
      this.ctx.restore();
      return;
    }
    this.ctx.drawImage(img, x, y, width, height);
    this.ctx.restore();
  }

  drawImageRotated(img: HTMLImageElement, x: number, y: number, width: number,height: number, rotationRad: number)
  {
    this.ctx.save();
    const cx = x + width / 2;
    const cy = y + height / 2;
    this.ctx.translate(cx, cy);
    this.ctx.rotate(rotationRad);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.ctx.drawImage(img, -width / 2, -height / 2, width, height);
    this.ctx.restore();
  }

  drawVCapsule(x: number, y: number, w: number, h: number, color: string)
  {
    const radius = w / 2;
    const ctx = this.ctx;

    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.arc(x + w / 2, y + radius, radius, Math.PI, 0, false);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arc(x + w / 2, y + h - radius, radius, 0, Math.PI, false);
    ctx.lineTo(x, y + radius);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }


  drawSphere(x: number, y: number, radius: number, color:string)
  {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

export function initLayers(root: HTMLDivElement): Record<cvLayer, Canvas>
{
  const layers: Record<cvLayer, Canvas> =
  {
    [cvLayer.BKG]: new Canvas(root, 0),
    [cvLayer.GAME]: new Canvas(root, 1),
    [cvLayer.UI]: new Canvas(root, 2),
  }
  layers[cvLayer.BKG].setZIndex(0);
  layers[cvLayer.GAME].setZIndex(1);
  layers[cvLayer.UI].setZIndex(2);
  layers[cvLayer.BKG].clear();
  layers[cvLayer.GAME].clear();
  layers[cvLayer.UI].clear();
  return (layers);
}