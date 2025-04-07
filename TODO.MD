#todo
maintenant la moyenne est vraiment basse qd il y a une erreur
-> ca peut etre encore + interessant de s'interesser à la gestion des erreurs (property not found, etc.)


todo
- direct boolean answer
- tester prediction boolean qald9
- remplacer "boolean" par "yes/no question" et restester
- tester LLMFrameworkDirect
- restester v0.1
- retester v0.1 with logic
- tester juste backwardProperty
- tester LLMFrameworkBooleanBySubquestionsScoringReferences
- tester direct boolean
- tester meilleur LLM 
- tester score at all cost

question classification using llm
question classification prompt engineering

# A implémenter
- inverse tt les forward en backward
- utiliser match et pas selection dans extension (réfléchir détails)




todo
- LE GROS TRUC QUI MANQUE C LE REToUR EN LANGUE NATUREL ET SON utiLISATION APRES CHAQUE COMMANDE
- ajouter commande filter (trouver comment gérer par colonne)
//comment traduire suggestions d'objet vers texte affichage (il y a un hook pour?)

-todo save les schemas qq part

//todo nouvelles idées 
    - prendre en compte NL : avec/sans
    - prendre en compte le focus : avec/sans
    - prompt command list -> pour chaque commande
        - filtrer pour voir si entité/propriété existe
            - agir en fonction  

//todo add text output sparklis nl

//todo separer les commandes 
-> les executer individuelement et regarder résultat
    - commande pas executée
        - dire llm -> commande pas fonctionnée (existe pas), autre idée de commande?
    - commande executée
        - on a fait ca, on a eu ca -> on fait quoi maintenant?
----------------------------------

#todo patcher is something
->considéré comme entité -> si pas de rep -> seul suggrestion est celle obtenue -> l'annule
->pourrait mettre seuil sur la distance
->pourrait d'avantage impliquer llm 
- Class _
- Prop _   
- Prop inv _
- Prop -> fwd/bwd
- Plutot que expression régulière utiliser ca -> ajuster syntaxe des commandes
- y réfléchir
- s named after objet : this named after / is named after this

- ou sinon juste dire si propriété
- classe et propriétés 
- entités
- ...
- prop something

todo fuseki v2 <-> heberger dump graphe

-todo
-limites
-superlatif
-boolean


react solution


utilisation tool?

-------------
#https://lmstudio.ai/docs/api/tools
#todo yaml of python code
------------------------
#todo commenter mieux les raisons dans le code

#############################
#todo qd client die -> fenetre reste ouverte
#todo disable si llm pas dispo/erreur correspondante

#brainstorming des méthodes: pas à pas à la react, raisonneur à la fin
#v1 2 llm en concurrence
____________
Jeux de données

base entrainement et evaluation
WIKIDATA
https://github.com/KGQA/QALD-10 -> ~80% pour etre significatif
https://github.com/amazon-science/mintaka
https://query.wikidata.org/
-----------------------------------
TEXT2SPARQL workshop
https://text2sparql.aksw.org/#knowledge-graphs-for-evaluation