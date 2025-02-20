# Méthodes envisagées

## Approche naïve (implémentée)

Un seul prompt posant la question au LLM, lui donnant une syntaxe de commandes à exécuter pour obtenir la réponse. Retourne la réponse telle quelle.

Résultats:
- Rappel: 0.0
- Précision: 0.0
- F1: 0.0

Limites:
- Ne retourne que des listes de réponses
    - Ne peut pas retourner de booleen
    - Ne peut pas selectionner l'item attendu dans la liste de réponses si un seul est attendu
- Ne connait pas le vocabulaire du graphe
    - commandes qui n'aboutissent pas
- Ne connaît pas les résultats des commandes
    - ne peut pas savoir si la commande a abouti ou non
    - ne peut pas savoir le nombre de résultat d'une commande (ex: "person" dans wikidata n'a qu'un seul résultat -> plutot "human")



## Fonctonnalités envisagées
- Permettre au LLM d'accèder et de filtrer les suggestions
    - Permettrai de connaitre le vocabulaire du graphe

- Permettre au LLM de connaitre les résultats d'une commande
    - savoir si la commande a abouti ou le résultat fourni

- Raisonner sur si la réponse attendue est une liste de valeur ou un booléen
- Raisonner sur la liste de valeur attendue pour selectionner la bonne réponse
    - necessite traducteur entité -> string pour wikidata

- Raisonner sur si la réponse attendue semble être correcte