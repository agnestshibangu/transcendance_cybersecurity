import { ethers } from "ethers";
import * as dotenv from "dotenv";
import ScoreStorage from "../artifacts/contracts/ScoreStorage.sol/ScoreStorage.json";

dotenv.config();

async function main() {
    const provider = new ethers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    const contractAddress = ""; // a remplacer par mon adresse de contrat
    const contract = new ethers.Contract(contractAddress, ScoreStorage.abi, signer);

    const tx = await contract.storeScore("Alice", 42);
    await tx.await();
    console.log("Score stored");

    const [name, score] = await contract.getScore(await signer.getAddress());
    console.log(`score de ${name} : ${score.toString()}`);
}


// async function storeScorePlayer(name: string, score: number) {
//     const tx = await contract.storeScore(name, score);
//     await tx.wait();
//     console.log("Score stored on blockchain !");
// }