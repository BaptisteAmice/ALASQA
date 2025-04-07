
a person; forwardProperty mayor; New York City
->match New York City ; forwardProperty mayor; -> pp

Area 51; forwardProperty located in
->match Area 51; forwardProperty located in state ->pp

Abraham Lincoln; forwardProperty died in
->match Abraham Lincoln; forwardProperty death place -> pp


match Uzi; forwardProperty designer; backwardProperty design -> pp


Give me all actors starring in movies directed by and starring William Shatner.
-> on a de la perte parce qu'on filtre sur "a film"
-> on retourne les deux colonnes au lieu d'une seule

------------------------------------------------------------
PREFIX wikibase: <http://wikiba.se/ontology#>
wikibase:rank wikibase:PreferredRank 
->permet de garder le plus récent

# 0
In which U.S. state is Area 51 located?
->comprend pas pk voit pas la propriété 

Who is the mayor of New York City?
new york city ; forwardProperty head of government ; -> PreferredRank

Which other weapons did the designer of the Uzi develop?
Who created the comic Captain America?
Which state of the United States of America has the highest density?
Which spaceflights were launched from Baikonur?
# 0 < x < 1
Which people were born in Heraklion?

