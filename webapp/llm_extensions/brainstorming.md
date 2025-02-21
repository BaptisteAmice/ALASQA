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
- What is the boiling point of water
1. Filter "boil"
2. Selection "is boiling point of"
3. Filter "water"
4. Selection water
-> récupère requete et l'execute telle quelle (bizarrement j'ai 2 rep au lieu d'une)
COMMANDS: water ; has boiling ;
Get water, then get its boiling point.

- At which school went Yayoi Kusama?
1. Filter "Yayoi Kusama"
2. Selection Yayoi Kusama
3. Filter "education"
4. Selection educated at
->nickel
COMMANDS: yayoi kusama ; has education ;
Get who is Yayoi Kusama, then get where she was educated.

- did kill bill vol 1 come out after 2004?
1. Filter "kill bill"
2. Selection Kill Bill: Volume 1
3. Filter "publication"
4. Selection publication date
5. Selection aggregations and operations: the year of
6. Selection aggregations and operations: __ > __
7. Selection identities or values: the integer[2004]
-> résultat -> ne garder que la dernière colonne dans le select
->plusieurs release dates -> pas de probleme dans ce cas parce qu'elles retournent toutes false
COMMANDS: kill bill volume 1 ; has publication ; ????toask is year of???? ;
Get the first Kill Bill movie, then get its publication date, then check if it is after 2004. 

- Did Tom Brady win a Super Bowl before 2005?
Approche 1: 
1. Filtre Tom Brady
2. PLUSIEURS ENTITÉES DU MÊME NOM

Approche 2: Super bowl -> has a point in time -> point of time < -> date(2005-01-01)
1. Filtre types and relations: "superbowl"
2. Selection types and relations: every Super Bowl
3. Filtre types and relations: date
4. Selection types and relations: has a point in time
5. Selection aggregations and operations: the year of
6. Selection aggregations and operations: __ < __
7. Selection identities or values: the integer[2005]
8. Move focus: Super Bowl
9. Selection types and relations: has winner
10. BLOQUAGE -> true dans le dataset mais dans wikidata on sait juste que tom braddy est membre d'une equipe qui a gagné en 2005

Approche 3:
1. Filtre "tom brady"
2. PLUSIEURS RESULTATS -> match "tom brady"
3. Filtre "winner"
4. Selection "is winner of"
5. BLOQUAGE


Approche 4:
1. Filtre: "tom brady"
2. PLUSIEURS RESULTATS -> match: "tom brady"
3. Filtre: "team"
4. Selection: has a member of sports team
5. Filtre: "win"
6. Selection: has winner of something
7. Filtre: "superbowl"
8. Selection: a Super Bowl
9. Filtre: "date"
10. Selection: that has a point in time
11. Selection: The year of
12. Selection: <
13. Selection: integer[2005] 
14. -> sparklis mod table checker si il y a des lignes où la colonne 4 est a true 
->deja on peu se contenter de la denriere colonne -> retourne vrai et faux ->todo peut etre faire un or ?
-> pas forcement vrai (on sait juste que tom brady est membre d'une team qui a gagné le superbowl, mais c'est pareil dans mintaka)

COMMANDS: ???toask comment chercher string matching?
??? ; has team ; is winner of ; a superbowl; has time ; ???
ou
??? ; has team ; is winner of ; a superbowl; has time ; before 2005 ; -> mettre dans un ASK
Get Tom Brady, then get the team he is a member of, then check if they won a Super Bowl before 2005.
Wrap the previous command in an ASK to get a boolean answer.

#todo comment je fais en commandes?sans itnerface?
#->todo changer focus à la fin ? -> empty answer pour ca ?
#todo comment passer à table plutot que nested table?


- Which movie was directed by Gus Van Sant and starred Sean Penn?
COMMANDS:  a movie ; has director ; BLOQUAGE
COMMANDS: gus van sant ; is director of ; has actor ; sean penn

- How many oceans border Russia?
COMMANDS: russia; has ocean ; PROBLEME: resultat inconsistant
COMMANDS: a country; russie; has ocean ; a ocean -> wrap dans un count

//todo find best starting point
//maybe several in concurrence

opérations sparklis:
- selection (prend parfois un argument)
- filter
- match
- move focus
__________________
idée de commandes:
count -> count
ask -> boolean
call_llm -> just call another llm to adapt request



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