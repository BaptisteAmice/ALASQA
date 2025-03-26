

# Homonymes
## Problème
Plusieurs entités ont le même nom
## Solutions
essayer backward et forward?

Remarqué que : “Tony Blair ; forwardProperty birth year” ne fonctionne pas (homonymes),
mais “backwardProperty birth year; Tony Blair” si
Idée
-> essayer d’inverser à tt les cas avant d'exécuter les commandes et comparer
-> voir si ca change les résultats et aviser (éventuellement chemin de commandes parallèles par la suite)

# Filtre trop fort
## Problème
a person ; backwardProperty birth place
a game; Don't starve
-> a ... filtre trop


## Solutions
fusionner
-> backwardProperty person birth place
-> game Don't starve
marche pas tjrs...

changer a ... en list ...

# Wikidata
URI non explicites