#todo url pour traduire entitées wikidata
#todo revoir output pour api
#en interface <rep><questionsparklis><requetesparql><reponse></rep>

#todo prompt premiere question -> lire retour -> suite
#todo slide pour fin semaine/debut 24/02


se concentrer sur l'extraction
//todo réessayer en listant les commandes
//todo evoquer spaklis, donner structure model et langage des commandes
    // a qq ; has ...; is ... of ... ; ...    
#todo ce qu'on attend c'ets les requetes, mais ce qu'on veut comparer ces les résultats pour une mm version
#type

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