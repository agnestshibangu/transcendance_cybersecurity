// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ScoreStorage {
    // Admin du contrat
    address public admin;

    constructor() {
        admin = msg.sender;
    }

    // Structure d'un score
    struct PlayerScore {
        string username;
        uint score;
        uint timestamp;
    }

    // Mapping des joueurs vers leurs scores
    mapping(address => PlayerScore[]) private scores;

    // NOUVEAU : mapping pour retrouver l'adresse via le nom
    mapping(string => address) public usernameToAddress;

    // Événements
    event ScoreAdded(address indexed player, string username, uint score, uint timestamp);

    // Modificateur pour limiter l'accès à l'admin
    modifier onlyAdmin() {
        require(msg.sender == admin, "Non autorisé");
        _;
    }

    // Ajouter un score pour le joueur appelant
    function addScore(string calldata username, uint score) external {
        require(score > 0, "Score invalide");

        PlayerScore memory newScore = PlayerScore({
            username: username,
            score: score,
            timestamp: block.timestamp
        });

        scores[msg.sender].push(newScore);

        // NOUVEAU : enregistre le mapping username → address
        usernameToAddress[username] = msg.sender;

        emit ScoreAdded(msg.sender, username, score, block.timestamp);
    }

    // Récupérer tous les scores d'un joueur par adresse
    function getScores(address player) external view returns (PlayerScore[] memory) {
        return scores[player];
    }

    // Fonction admin pour réinitialiser les scores d'un joueur
    function resetScores(address player) external onlyAdmin {
        delete scores[player];
    }

    // Optionnel : récupérer le meilleur score d'un joueur
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
