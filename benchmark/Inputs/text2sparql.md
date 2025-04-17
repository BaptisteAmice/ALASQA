# Instructions from the text2sparql website

## Install the client (use your preferred way)
$ pipx install text2sparql-client

# prepare a questions file like this
$ cat questions.yaml
---
dataset:
  id: https://text2sparql.aksw.org/2025/corporate/
questions:

  - question:
      en: In which department is Ms. Müller?
      de: In welcher Abteilung ist Frau Müller?

  - question:
      de: Was ist der Sinn des Lebens?

  - question:
      de: Wieviele Einwohner hat Leipzig?

## Ask questions from the questions file on your endpoint
$ text2sparql ask questions.yml [YOUR-API-URL]
Asking questions about dataset https://text2sparql.aksw.org/2025/corporate/ on endpoint [YOUR-API-URL].
In which department is Ms. Müller? (en) ... done

# Our system
$ text2sparql ask ./benchmark/Inputs/text2sparql_questions_corporate_test.yaml http://localhost:8000/