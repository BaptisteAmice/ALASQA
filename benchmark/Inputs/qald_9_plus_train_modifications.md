# Added tags
added tags to questions for post-processing
Tag list: todo
todo 243

todo add location, time etc. list   to question already done (replace all by list ?)
traitemant auto
- This uses COUNT, GROUP BY, and ORDER BY → an aggregation query.


# Question already missing in input file
6,.....
todo

# Weird

Question 1: List all boardgames by GMT.
Question 290: List all games by GMT.
--------------------------------------------------
Question 9: Give me all actors starring in movies directed by and starring William Shatner.
Question 286: Give me all actors starring in movies directed by William Shatner.
--------------------------------------------------
Question 11: Give me all Danish films.
Question 51: Give me all Danish movies.
--------------------------------------------------
Question 20: Give me the Apollo 14 astronauts.
Question 61: Give me all Apollo 14 astronauts.
--------------------------------------------------
Question 21: Who wrote the book The pillars of the Earth?
Question 335: Who wrote the book The Pillars of the Earth?
--------------------------------------------------
Question 23: Which spaceflights were launched from Baikonur?
Question 167: Which rockets were launched from Baikonur?
--------------------------------------------------
Question 25: Which U.S. states are in the same timezone as Utah?
Question 108: Which U.S. states are in the same time zone as Utah?
--------------------------------------------------
Question 148: Which holidays are celebrated around the world?
Question 305: Which holidays are celebrated around the world?
--------------------------------------------------


Give me the birthdays of all actors of the television show Charmed
return only the birthdays (technically respond to the question but probably not the intent)


# Corrected result (by correcting query)

## 1
returned all boardgames instead of just GMT boardgames
now only returns GMT boardgames

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
