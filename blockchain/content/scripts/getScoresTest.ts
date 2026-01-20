import hre from "hardhat";

async function main() {
    const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
    const contract = await hre.ethers.getContractAt("ScoreStorage", contractAddress);

    // récupère l'adresse du joueur via le mapping
    const playerAddress: string = await contract.usernameToAddress("Alice");

    // récupère les scores
    const scores = await contract.getScores(playerAddress);
    console.log("Scores d'Alice :", scores);
}

main().catch(console.error);
