import hre from "hardhat";

async function main() {
    const ScoreStorage = await hre.ethers.getContractFactory("ScoreStorage");
    const scoreStorage = await ScoreStorage.deploy();
    await scoreStorage.deployed();
    console.log("Déployé à l'adresse :", scoreStorage.address);
}

main().catch(console.error);
