# Commands

## 1 TRUE
property publisher ; gmt games

## 2 TRUE
Skype; property developer

## 3 to test and compare
Heraklion ; property birth place XXX marche plus

property place of birth ; Heraklion

## 4 NOT WORKING
match Area51 ; forwardProperty located in state -> post-processing
probleme: differentes entités se contredisent

## 5 NOT WORKING
New York City ; forwardProperty mayor; forwardProperty start time -> post-processing
start time fonctionne pas

## 6

## 7 TOTEST
match Abraham Lincoln ; forwardProperty place of death -> post-processing
probleme: differentes entités se contredisent
## 8 TRUE
Air China ; forwardProperty serves

## 9

## 10

## 11

## 12

.........

## 16 NOT COMPLETE/TIMEOUT
Which state of the USA has the highest population density?
a US state ; property population

## 22 NOT COMPLETE/TIMEOUT
Which state of the United States of America has the highest density?

## 31 TRUE
Who is the tallest player of the Atlanta Falcons?
Atlanta Falcons ; property member sport team ; property height ; desc ; limit 1

## 52 TRUE
What is the most frequent cause of death?
property cause of death; groupBy count; desc; limit 1

## 53 TOTEST
Who are the four youngest MVP basketball players?
a mvp ; property sport ; basketball ; property winner ; property birth date ; desc ; limit 4

## 65 TODO
What is the highest place of the Urals?
???
## 84 TRUE
Who produced the most films?
a movie; property producer ; groupBy count ; desc; limit 1

## 105 TODO
What was Brazil's lowest rank in the FIFA World Ranking?

## 110 TOPATCH/TIMEOUT
Which country has the most official languages?
a country ; property official language ; groupBy count ; desc ; limit 1
get langue la plus parlée....

## 120 TOUNDERSTAND WHY BENCHMARK GET PEAK 
What is the highest mountain?
a mountain ; property height ; desc ; limit 1

## 121 TRUE
Which poet wrote the most books?
property occupation ; poet ; backwardProperty author; a book ; groupBy count ; desc ; limit 1
## 123 FAILED
Which musician wrote the most books?
property occupation ; XXX
musician; backwardProperty author; a book ; groupBy count ; desc ; limit 1

## 130 TODO
For which label did Elvis record his first album?
............;