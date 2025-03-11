todo
- cf todo diapo
- ajouter commande filter (trouver comment gérer par colonne)
//comment traduire suggestions d'objet vers texte affichage (il y a un hook pour?)
await sparklis.currentPlace().getConceptSuggestions(false,sparklis.conceptConstr())
-add prompt version in final log

//commande revient en arriere
//commande erreur

//probleme : higherThan -> higher or equal to

- Question is ..., we currently have filter by what ? -> pick
-> enough to respond ?
-> filter by what ? -> pick

property ??? not found


perso
finetuning? huggingface -> lmstudio (extracteur réponse au format pour finetuning->pp)
#experimentations à faire:
- low temperature
- autre modèles
- change prompt
- suite de prompts
-------------
probleme commandes
forwardProperty namedAfter -> fowardProperty named after

----------------------------------
#todo
qald 10: 
-id 2: faux la requete et son résultat (mm l'ancien)
-id 145: MAIS LEQUEL? YA UNE ADAPTATION MAIS YA FORCEMENT UN ORIGINAL WORK


#todo prochaine fois
- faire passer les requetes, savoir EXACTEMENT QUAND PASSE PAS, identifier tt les scenarios


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

-if wikidata mod -> wikidata search -> extarnal search -> get_constr inspi




react code
https://github.com/ysymyth/ReAct/blob/master/hotpotqa.ipynb
prompt file
https://raw.githubusercontent.com/ysymyth/ReAct/refs/heads/master/prompts/prompts_naive.json

instruction = """Generate a SPARQL query to solve a question answering task with interleaving Thought, Action, Observation steps. Thought can reason about the current situation, and Action can be three types: 
(1) Search[entity], which searches --- la liste des matches ---
(2) Lookup[keyword], which --- selectionne un match ---
(3) Finish[answer], which returns the generated query and finishes the task.
Here are some examples.
"""
webthink_prompt = instruction + webthink_examples

filter suggestions
- c quoi les 3 types?
- get les 3 fields -> remplir et valider
- eventuellement remplacer commande match par un filter puis appuis bouton
get suggestions
- ???
get responses
- ???


utilisation tool?

-------------
#https://lmstudio.ai/docs/api/tools
#todo yaml of python code

#todo graphes par strategie score questions

PK POPUP: SI CLIQUE AUTOMATISE -> LES PREFIXES SONT DUPLIQUES DANS LA REQUETE POST

si requete vide -> undo (parce que une mauvaise commande peut supprimer ce qui a été construit av)

->réponse vide car mauvaise condition de fin


montrer questions et blocages
->montrer commandes envisagées

????toask is year of???
???toask comment chercher string matching???
------------------------

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