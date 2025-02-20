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


## Besoins

- Transformer commande
    - compter le nombre de résultats -> juste wrapping
    - trouver le résultat spécifique attendu dans une liste de résultats -> ???
    - traduire une réponse en bool -> wrapping ask
        - verifier un nombre -> ajout filtre
        - verifier une info -> ??? //just ask sans filtre???

filtrer: limit/offset

### Exemple concrets
Did Tom Brady win a Super Bowl before 2005?
Tom Brady ; 

## Fonctonnalités envisagées
- Permettre au LLM d'accèder et de filtrer les suggestions
    - Permettrai de connaitre le vocabulaire du graphe

- Permettre au LLM de connaitre les résultats d'une commande
    - savoir si la commande a abouti ou le résultat fourni

- Raisonner sur si la réponse attendue est une liste de valeur ou un booléen
- Raisonner sur la liste de valeur attendue pour selectionner la bonne réponse
    - necessite traducteur entité -> string pour wikidata

- Raisonner sur si la réponse attendue semble être correcte

- donner des commandes
    - extraction
        - get suggestions / filter suggestions
        - command

    - reasoning
        - count -> compte le nombre de résultat dans un dict
        - search -> cherche une valeur dans un dict
        - traduction entité -> string