PK POPUP: SI CLIQUE AUTOMATISE -> LES PREFIXES SONT DUPLIQUES DANS LA REQUETE POST

->réponse vide car mauvaise condition de fin

JUSTE AFK PARFOIS CA ARRIVE AUSSI

montrer questions et blocages
->montrer commandes envisagées

????toask is year of???
???toask comment chercher string matching???
------------------------
#todo etape actuelle
question -> réponse
réussir à la construire avec sparklis (à la main) / voir les surcouches necessaires
-> adapter systeme

#todo regler probleme empty answer

#todo quand sebastien sera revenu: regler probleme asynchrone

#todo quand j'aurai fini -> calculs scores
->0 plutot que None quand le probleme vient du systeme

#todo slide 
- requetes bon resultat
- requetes bien formées mais pas bon résultat
- requete ressemble mais pas bien formée
- requete problème de typage (ask/select)
- combien
-limites 

#todo commenter mieux les raisons dans le code

#############################
#todo qd client die -> fenetre reste ouverte
#todo disable si llm pas dispo/erreur correspondante

#jeudi aprem vers 15h30 réunion 
#ajouter raisonnement sur bien ou pas à la fin (à faire plus tard)

#todo? add tps par requete et tps global? -> peut etre fait dans test_system abstrait

#todo enlever \ dans questions extraites


#brainstorming des méthodes: pas à pas à la react, raisonneur à la fin
#v1 2 llm en concurrence

#todo etre plus fin sur els echecs : systeme, pas aboutis

#todo url pour traduire entitées wikidata

#todo prompt premiere question -> lire retour -> suite

se concentrer sur l'extraction
//todo réessayer en listant les commandes
//todo evoquer spaklis, donner structure model et langage des commandes
    // a qq ; has ...; is ... of ... ; ...    

//wikidata requests -> popup comme quoi pas valides qui bloque le reste (alors que sans popup marcherait)

____________
Jeux de données

base entrainement et evaluation
WIKIDATA
https://github.com/KGQA/QALD-10 -> ~80% pour etre significatif
https://github.com/amazon-science/mintaka
https://query.wikidata.org/


--
Sparklis LLM
dossier webapp (dans doc -> api js)
Importer script "extension" dans js + ajouter dans html -> éventuellement en script

demander plan de base -> essayer pour guider de base 
comparer 2 stratégies simples
-? construire directement suite commande en input utilisant qa_extension
-? choix mot de départ -> filtre et cherche dans les deux listes (pas de rep demande synonyme)-> lecture retour fr + rep -> doit continuer ? -> si oui filtre et recherche dans les deux listes -> etc 


-----------------------------------
TEXT2SPARQL workshop
https://text2sparql.aksw.org/#knowledge-graphs-for-evaluation

-----------------------------------
Langchain??

-----------------------------------

http://127.0.0.1:8000/static/osparklis.html?

title=Wikidata
endpoint=https%3A//query.wikidata.org/sparql&wikidata_mode=true
class_hierarchy=false
property_hierarchy=false
intentional_init_concepts=false
nary_relations=true
entity_lexicon_select=http%3A//www.w3.org/2000/01/rdf-schema%23label
entity_lexicon_lang=en
concept_lexicons_select=http%3A//www.w3.org/2000/01/rdf-schema%23label
concept_lexicons_lang=en
auto-filtering=false


traduit entités
entity_lexicon_select=http%3A//www.w3.org/2000/01/rdf-schema%23label
traduit relations
concept_lexicons_select=http%3A//www.w3.org/2000/01/rdf-schema%23label

http://127.0.0.1:8000/static/osparklis.html?title=Wikidata&endpoint=https%3A//query.wikidata.org/sparql&wikidata_mode=true&class_hierarchy=false&property_hierarchy=false&intentional_init_concepts=false&nary_relations=true&entity_lexicon_select=http%3A//www.w3.org/2000/01/rdf-schema%23label&entity_lexicon_lang=en&concept_lexicons_select=http%3A//www.w3.org/2000/01/rdf-schema%23label&concept_lexicons_lang=en&auto-filtering=false

http://127.0.0.1:8000/static/osparklis.html?title=Core%20English%20DBpedia&endpoint=https%3A//query.wikidata.org/sparql

http://127.0.0.1:8000/static/osparklis.html?title=Core%20English%20DBpedia&endpoint=https%3A//query.wikidata.org/sparql

&wikidata_mode=true&entity_lexicon_select=http%3A//www.w3.org/2000/01/rdf-schema%23label&entity_lexicon_lang=en&concept_lexicons_select=http%3A//www.w3.org/2000/01/rdf-schema%23label&concept_lexicons_lang=en&auto-filtering=false