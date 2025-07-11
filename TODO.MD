---------------------------------
- papier
    - Résumés des articles : 3 octobre 2025
    - Textes complets des articles : 12 octobre 2025
    - Interactions auteurs/membres comité de programme : 6-9 novembre 2025
    - Notification : 15 novembre 2025 (mon mail existera encore?)
    - Version finale des articles : 28 novembre 2025
    - Inscription auteur : 28 novembre 2025
---------------------------------

papier EGC (long)
https://www.egc2025.cnrs.fr/appels-a-communications/
ex: https://hal.science/hal-04906345v1
12 pages fr

------------------COUTS RUNS

coût = (prix_token_input * nb_token_input + prix_token_output * nb_token_output) * nb_questions * nb_runs

One-Shot
- GPT-4o
    - qald-10: ((5/1000000) * 1000 + (20/1000000) * 70) * 387 * 1 = 2.4768$
    - qald-9-plus wikidata test: ((5/1000000) * 1000 + (20/1000000) * 70) * 136 * 1 = 0.8704$
- GPT-4o (mini)
    - qald-10: ((0.6/1000000) * 1000 + (2.4/1000000) * 70) * 387 * 1 = 0.297216$
    - qald-9-plus wikidata test: ((0.6/1000000) * 1000 + (2.4/1000000) * 70) * 187 * 1 = 0.104448$

------------------

auteur? avec l'aide de ?
//todo renommer best_suggestion en greedy
//avoir un hover qui indique que ca se réfère à la stratégie de choix des suggestions
- git commit/nettoyage
todo reorganiser les dossiers
todo nettoyer le code
- enlever les todo du code
- jeter legacy code
- mieux commenter

- crée un system qui check d'abord le type de question bool vs non bool -> subquestion vs no subquestion et utilise tactique adaptée


- noter les constantes des nombre de retry
- noter les limites sur le nombre de suggestions
- le = cherche une intersection   non vide entre les deux (le documenter)
- //comparaison et bool marchent pour deux elements mais pas trois (version algo)
- //donner infos sur comparison algo -> retour entité ou bool ou autre...
- (remplacer higherThan par <  et tester llm)

TODO FACTORIZE PROMPTS
cmd_vocabulary(endpoint_family)

-----------------------------

todo fuse train test 

todo global try median en fonction du llm

Comme évoqué dans ???, Les LLMs ne sont pas efficaces pour créer directement des requêtes SPARQL, par exemple en direct sur WIkidata et ses uris opaques, en testant avec mistral nemo sans aucun outil externe on obtient un f1 score de 0.

todo dans le readme ajouter archi du dossier bestoutputs

todo mieux parler des limites dnas le papier