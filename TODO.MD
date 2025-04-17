//run system actuel sur tt le benchmark pour etre fixé
//regarder scores clusters
//faire plein de tests sur dbpedia et le jeu de données custom
//créer prompt dbpedia et custom
//avoir un exemple en français -> rep en anglais

//demarrer timer
//demande si booleen
//generation cdms llm
  //si boolean expected 
    //si retour boolean 
      //return
    //si retour autre chose
      //generation llm boolean
      //si true return true, sinon return false
  //sinon
    //si reponse
        //return reponse
    //sinon
        //generation llm fallback
        //return



faire à la main les cas
patcher groubby count



[Egypt ; property capital] == [a city ; (property country; egypt); property size ; desc ; limit 1]

[a city ; (property country; egypt); property size ; desc ; limit 1]
a city ; property country ; egypt ; up ; up ; property size ; desc


a metro transit ; property creation date ; asc ; limit 1
a metro transit ; property creation date ; asc ; limit 1 ; up ; up ; property city

essayer implementer focus
a metro transit ; (property creation date ; asc) ; limit 1 ; (property city)

/!\besoin de savoir si la requete précédente était fwd ou bwd
who produced the most films
- property film director ; groupby count 
-> grouped by director peut count direct (remplacer valeurs par count)
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
SELECT DISTINCT ?P57_1 ?thing_4
WHERE { ?thing_4 p:P57 [ ps:P57 ?P57_1 ] . }
LIMIT 200

PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
SELECT ?P57_1 (COUNT(DISTINCT ?thing_4) AS ?count)
WHERE {
  ?thing_4 p:P57 [ ps:P57 ?P57_1 ] .
}
GROUP BY ?P57_1
LIMIT 200

most frequent cause of death
- property death cause ; groupby count ; desc ; limit 1
->besoin group by les causes of death pour count le première colonne
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
SELECT DISTINCT ?P509_4 (COUNT(DISTINCT ?thing_1) AS ?count)
WHERE { ?thing_1 p:P509 [ ps:P509 ?P509_4 ] . }
GROUP BY ?P509_4
LIMIT 200
- a country ; property official language -> TROP LENT 
which poet wrote the most books
-> ????

which state has the highest population density
->div

Atlanta falcon????
4 yougest mvp basket players...

- fwd property timeout (qd bcp d'item mais pas bcp avec la property (je crois))
- basket ball player not working -> transitivité à résoudre
profession -> basket ball player
- implémenter property en une seule cmd, le sens à faire nous mm
Tim burton ; backwardPrperty director

property cause of death ; group ; count
a cause of death ; count


remove limit, add group by, order by desc, limit 1

PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>

SELECT ?P509_4 (COUNT(DISTINCT ?thing_1) AS ?count)
WHERE {
  SERVICE <https://query.wikidata.org/sparql> {
    SELECT DISTINCT ?thing_1 ?P509_4
    WHERE {
      ?thing_1 p:P509 [ ps:P509 ?P509_4 ] .
    }
  }
}
GROUP BY ?P509_4
ORDER BY DESC(?count)
LIMIT 1



#todo
#todo si pas de result repechage
->nouvelle version de score à tt prix

FAIRE MARCHER AVEC DBPEDIA POUR LE CHALLENGE
Et AVEC LE CUSTOM DATASET

todo a US state ; forwardProperty population
->crash fwd parce que timeout 1min par wikidata

ajouter details dans prompt
- oldest (plus petite date)
- offset
- remove colonne tris
donner un exemple plus complexe
who is the oldest person born in paris?


Who is the heaviest player of the Chicago Bulls?
Chicago Bulls; backwardProperty member of sport team ; forwardProperty weight ; desc
->(en vrai la requête est plus complexe...)

Who is the tallest basketball player?
backwardProperty basketball player ; forwardProperty height ; desc 
pas ouf

fonctionne pas (basketball player)
Who is the tallest basketball player?

Who are the four youngest MVP basketball players?  
a mvp ; forwardProperty sport ; basket

a human ; forwardProperty birth date ; asc


What is the highest mountain?
a mountain ; forwardProperty height ; desc

#todo
tags...
type erreurs??
failing command : son numero, son type
groupe similarité texte...

GERBIL Experiment?
https://gerbil-qa.aksw.org/gerbil/config
to try other systems

modeles à essayer 
claude

maintenant la moyenne est vraiment basse qd il y a une erreur
-> ca peut etre encore + interessant de s'interesser à la gestion des erreurs (property not found, etc.)


todo
- tester prediction boolean qald9
- remplacer "boolean" par "yes/no question" et restester
- tester LLMFrameworkDirect
- tester meilleur LLM 

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