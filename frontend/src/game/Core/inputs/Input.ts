export class Input
{
  private static keys: Record<string, boolean> = {};
  private static once: Record<string, boolean> = {};
  private static initialized = false;

  private static onKeyDown = (e: KeyboardEvent) =>
  {
    const key = e.key.toLowerCase();
    Input.keys[key] = true;

    if (!(key in Input.once))
      Input.once[key] = false;
  };

  private static onKeyUp = (e: KeyboardEvent) =>
  {
    const key = e.key.toLowerCase();
    Input.keys[key] = false;
    Input.once[key] = false;
  };

  static start()
  {
    if (Input.initialized) return;
    Input.initialized = true;

    window.addEventListener("keydown", Input.onKeyDown);
    window.addEventListener("keyup", Input.onKeyUp);
  }

  static stop()
  {
    if (!Input.initialized) return;
    Input.initialized = false;

    window.removeEventListener("keydown", Input.onKeyDown);
    window.removeEventListener("keyup", Input.onKeyUp);
    Input.keys = {};
    Input.once = {};
  }

  static isDown(key: string): boolean
  {
    return !!Input.keys[key.toLowerCase()];
  }

  static isDownOnce(key: string): boolean
  {
    key = key.toLowerCase();

    if (!Input.keys[key])
      return false;

    if (Input.once[key])
      return false;

    Input.once[key] = true;
    return true;
  }
}
