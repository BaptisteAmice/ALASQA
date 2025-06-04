TODO à voir ensemble

- mettre fichiers à disposition : carrément le git avec le projet? -> je le migre sur github? sinon je peux fork les benchmarks et ajouter les dossiers
- nouvelle formule smoothing
- dbpedia
- participation challenge

RUN BOOL
RUN DBPEDIA OS
RUN DBPEDIA THE MOST

todo revoir les système spour qu'ils correspondent aux algo
todo maj pour que mintaka soit réellement fonctionnel (de nouveau)
todo reorganiser les dossiers
todo nettoyer le code
- enlever les todo du code
- jeter legacy code
- mieux commenter

---------------------------------
- rapport stage (preliminary May 28) (final June 6)
- oral stage (June 25-27, 2025)
- papier text2sparql (June 28th, 2025 PST) (Submission of camera-ready papers: July 26th, 2025 PST)
----------------

//synonyms


//a organization
-> no suggestion found
->synonyms? peut etre que si première commande

--------------------------

Captain_America
pas trouvé...mm en match...


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


question classification using llm
question classification prompt engineering


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

react solution


utilisation tool?

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