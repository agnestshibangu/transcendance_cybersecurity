// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ScoreStorage {
    address public admin;

    constructor() {
        admin = msg.sender;
    }

    struct PlayerScore {
        string username;
        uint score;
        uint timestamp;
    }

    mapping(address => PlayerScore[]) private scores;

    event ScoreAdded(address indexed player, string username, uint score, uint timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Non autorise");
        _;
    }

    function addScore(string calldata username, uint score) external {
        require(score > 0, "Score invalide");
        PlayerScore memory newScore = PlayerScore(username, score, block.timestamp);
        scores[msg.sender].push(newScore);
        emit ScoreAdded(msg.sender, username, score, block.timestamp);
    }

    function getScores(address player) external view returns (PlayerScore[] memory) {
        return scores[player];
    }

    function resetScores(address player) external onlyAdmin {
        delete scores[player];
    }

    function getBestScore(address player) external view returns (PlayerScore memory) {
        PlayerScore[] memory playerScores = scores[player];
        require(playerScores.length > 0, "Aucun score pour ce joueur");
        PlayerScore memory best = playerScores[0];
        for (uint i = 1; i < playerScores.length; i++) {
            if (playerScores[i].score > best.score) {
                best = playerScores[i];
            }
        }
        return best;
    }
}
