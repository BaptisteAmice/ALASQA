# todo
egypt biggest city is its capital city?

75 bizarre

# Added tags
added tags to questions for post-processing
Tag list: todo
todo 243

todo add location, time etc. list   to question already done (replace all by list ?)
traitemant auto
- This uses COUNT, GROUP BY, and ORDER BY → an aggregation query.


# Ambiguity between entity and relation
first death cause maybe????

# Question already missing in input file
6,.....
todo

# Weird

certaines questions n'ont pas les prefix necessaires de défini (xsd:date)
???

pas de group key
133


Peak 17400 (Q123374100) higher than everest?
la query ne se base par sur la mm métrique pour les deux

Give me the birthdays of all actors of the television show Charmed
return only the birthdays (technically respond to the question but probably not the intent)


# Corrected result (by correcting query)

## 1
returned all boardgames instead of just GMT boardgames
now only returns GMT boardgames

## 76
returned the list of museums instead of their count
now returns the count of museums in Paris

## 262
returned a list of thinhs bordering iran instead of the count
now filters the list to only include countries and returns the count

## 350 
wdt:P287 to wdt:P84

# Removed non-working in input file and now

## 13
bruce lee had a grandchild but the query returns nothing (even in input json) because she is not in wikidata

## 57
returns nothing (even in input json) 
should return a german lakes with rivers flowing into them

## 68
returns nothing (even in input json)
should return world heritage sites designated within the past two years
there isn't a proper time property on those items in wikidata to filter them

## 88
returns nothing (even in input json)
Last Christmas (Q1318118) doesn't have an album property in wikidata

## Empty result (in input json and in exp.) removed temporary but should be tested to know why
96, 109, 173, 331, 377, 383, 389, 392, 394, 399, 404

# Removed not working now

## 18
no match (null)
property foundation year not found anymore

## 128 
(null)
only 2 actors remain in Q33999

## 206
don't seem to have P131 property anymore

## 384
Who was the first to climb Mount Everest?
there were 2 but the question asks for only one
the query doesn't work anymore

# Patched not working now
## 202
undefined prefix (null)
patched

## 293
returned nothing, now return "made from material" list as expected

## 378
now return 4 books instead of none

## 407
all tim burton movies can't be found by the "creator" property
->also need "producer" and "director"
"capital cost" is more present than "budget"

# Changed question translation

## fr
### 24
Donnez-moi une liste de tous les joueurs de trempette qui sont chefs de groupe.
to
Donnez-moi une liste de tous les joueurs de trompette qui sont chefs de groupe.

### 180
Luke est-il le père de Dark Vador ?
to
Dark Vador est-il le père de Luke ?
