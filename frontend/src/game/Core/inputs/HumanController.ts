import { PlayerController } from "./PlayerController.js";
import { Input } from "./Input.js";
import { Resources } from "../Ressources.js";
import { stopEngine } from "../Engine.js";

export class HumanController extends PlayerController
{
    update(delta: number, id?:number)
    {
        this.resetInput();
        
        switch (id)
        {
            case 0:
            {
                if (Input.isDown("e"))
                    this.input.moveY = -1;
                if (Input.isDown("d"))
                    this.input.moveY = 1;
                if (Input.isDownOnce("4"))
                    stopEngine();
                break;
            }
            case 1:
            {
                if (Input.isDown("o"))
                    this.input.moveY = -1;
                if (Input.isDown("l"))
                    this.input.moveY = 1;
                break;
            }
            case 2:
            {
                if (Input.isDown("g"))
                    this.input.moveY = -1;
                if (Input.isDown("b"))
                    this.input.moveY = 1;
                break;
            }
            case 3:
            {
                if (Input.isDown("5"))
                    this.input.moveY = -1;
                if (Input.isDown("2"))
                    this.input.moveY = 1;
                break;
            }
        }
    }
}
