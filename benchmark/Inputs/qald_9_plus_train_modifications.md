# Corrected result (by correcting query)

## 1 
returned all boardgames instead of just GMT games
now only returns GMT games

# Corrected obsolete SPARQL query

# Removed non-pertinent

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

# Incorrect query to change

# Not working

## 18
no match

## 128
timeout

## 202
undefined prefix

## ...