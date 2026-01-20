import hre from "hardhat";

async function main() {
    const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

    const contract = await hre.ethers.getContractAt(
        "ScoreStorage",
        contractAddress
    );

    console.log(Object.keys(contract)); // liste les fonctions accessibles

    const tx = await contract.addScore("Alice", 42);
    await tx.wait();

    console.log("Score ajoute !");
}

main().catch(console.error);