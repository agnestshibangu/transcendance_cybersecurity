import { irandom } from "./Utils/math.js";

export function generateBotName(): string
{
    let name = "";
    let clanTag = "[SVSC]"
    let p3 = 0;
    let p = 0;
    let p2 = 0;
    let p4 = 0;

    let dictionnary: Array<string> =
    [
        "Ghost", "Spec", "Shadow", "Blaze", "Viper", "Striker", "Rogue", "Sniper", "Venom", "Drako",
        "Nexus", "Raptor", "Onyx", "Zero", "Phantom", "Havoc", "Falcon", "Titan", "Reaper", "Storm",
        "Inferno", "Glitch", "Spectre", "Wraith", "Hunter", "Dagger", "Voltage", "Echo", "Frost", 
        "Zenith", "Nightmare", "Oblivion", "Chaos", "Dark", "Scythe", "Pyro", "Arctic", "Stratos",
        "Tundra", "Meteor", "Rampage", "Warp", "Crusher", "Stealth", "Exo", "Omega", "Cobra", "Doom", 
        "Ember", "Pulse", "The", "Void", "Faze", "Cod", "Cyber", "Neo", "Pro", "Ragnar", "Havok", "Raven"
    ];

    p3 = irandom(0, dictionnary.length - 1);
    name += dictionnary[p3];
    p = irandom(0, 5);
    for (let i = 0; i < p && name.length < 16; ++i)
    {
        let p2 = irandom(0, 10);
        if (p2 < 4)
            name += '0' + irandom(0, 9);
        else if (p2 < 6)
            name += "-";
        else if (p2 < 8)
            name += "_";
        else
        {
            p4 = irandom(0, dictionnary.length - 1);
            while (p3 === p4)
                p4 = irandom(0, dictionnary.length - 1);
            name += dictionnary[p4];
            if (name.length >= 16)
                name.slice(0, 16);
        }
    }
    p4 = name.length;
    if (p4 < 3)
        return ("Bot");
    if (irandom(0, 100) < 50)
        name = name.charAt(0).toLowerCase()+ name.slice(1);
    if (irandom(0, 100) < 50)
    {
        p2 = irandom(0, name.length - 1);
        name = name.slice(0, p2) + name.charAt(p2).toUpperCase() + name.slice(p2 + 1);
    }
    if (irandom(0, 100) < 50)
    {
        let newName = name[0];
        for (let p3 = 1; p3 < name.length; ++p3)
        {
            let char = name[p3];
            if (irandom(0, 100) < 50)
            {
                if (char === 'E' || char === 'e')
                    char = '3';
                else if (char === 'A' || char === 'a')
                    char = '4';
                else if (char === 'O' || char === 'o')
                    char = '0';
                else if (char === 'I' || char === 'i')
                    char = '1';
                else if (char === 'L' || char === 'l')
                    char = '7';
            }
            newName += char;
        }
        name = newName;
    }
    return (clanTag + name);
}
