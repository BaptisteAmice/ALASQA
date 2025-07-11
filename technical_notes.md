# Technical Notes and Known Issues

- You can implement new system strategies by adding classes in the file llm_extension_any_system.js. The tools for post-processing are already available, but only used in strategies after the "EXPERIMENTAL STRATEGIES" comment. As the name suggests, these systems are experimental and have yet to be validated.

---

- You can have bad results with DBpedia because of CORS.
A solution is to use a dump locally hosted or to use a proxy endpoint.
For the latter, it can make some queries fail because the queries are encapsulated in a SERVICE.

---

- Sometimes local LLM can be out of memory, from this point, the whole benchmark will fail.

---

- Not allowing the LLM to choose the direction of a property makes focus management more difficult. But LLMs such as Nemo are really bad at predicting the direction of a property. Using JSON to describe commands as a graph/tree (instead of a sequence) could be a solution to experiment with in the future.

- The groupBy commands have 2 alternative either using Sparklis constraints or remodeling the query after the navigation in Sparklis.

- "before" and "after" commands currently compare string values rather than dates, which can lead to issues, especially with negative dates.

- Commands executed on Wikidata can cause internal Sparklis queries to time out. A fallback mechanism has been implemented for the property command to mitigate such cases (e.g. a state ; property population).

---

- Tried to use LM Studio's Structured Output but it didn't work to enforce the available commands. At most it has been used to enforce a final response between <commands> tags. Only a subset of regex seems to be supported. It may be linked to the nature of the models used (GGUF).


```json
{
    "type": "object",
    "properties": {
        "reasoning": {
            "type": "string",
            "not": {
                "pattern": "<commands>"
            }
        },
        "commands": {
            "type": "string",
            "pattern": "^<commands>[^<]+</commands>$"
        }
    },
    "required": ["reasoning","commands"]
}
```
[Documentation lmstudio structured-output](https://lmstudio.ai/docs/app/api/structured-output)

[Documentation lmstudio structured-output in typescript](https://lmstudio.ai/docs/typescript/llm-prediction/structured-response)



- in case of ASK queries, Sparklis doesn't return the same results as tools such as YASGUI or Wikidata Query Service. You can for example try comparing the following query in Sparklis console and in YASGUI:
```js
await sparklis.evalSparql('ASK WHERE { wd:Q58815001 p:P57 [ ps:P57 wd:Q2745616 ] . }')
```
Because of that, ALASQA doesn't return the same results as Sparklis. The workaround is to check if the query is an ASK and then check if the results.rows.length > 0 to determine if the answer is true or false.

---

- Examples are currently listed in the prompt. It could be be interesting to have a pool of known examples and to select them based to the similarity of their question with the current one (the winners of TEXT2SPARQL'25 seem to do something similar (among other things)). A quick way to get such examples can be to extract questions with a f1-score of 1 in the output folder. The script successful_command_chains_extractor.py can be used and adapted to do so. However, the used system strategy should be taken into account (and maybe also the suggestion selection tactics). Be also careful not to have the same question in the pool of examples and test set, as it would bias the results. QALD-9-Plus have some of its questions duplicated across the train and test sets, which can lead to such issues. You can use the script duplicate_question_test.py to check if two benchmarks have the same questions. This warning also applies to tasks such as fine-tuning.

---

- String matching sometimes does weird things (in commands, but also in the Sparklis interface). It’s probably due to Wikidata and the way it handles labels. For example, for the entity The Storm on the Sea of Galilee (Q2246489), there is a property creator (and labelized as such in the interface), and this property can be found when using the filter “painter” but not when using the filter “creator”. So a command chain like “The Storm on the Sea of Galilee ; property creator” will fail — it stops at “The Storm on the Sea of Galilee” and shows a property labeled “creator” among the suggestions in the interface, but the chain does not proceed correctly.

---

The system strategy handling boolean by merging queries (LLMFrameworkBooleanByMergeByPatterns) is able to handle positive boolean question based on the presence of entities and properties in triple. It is also able to handle negative boolean questions based on the absence of object or subject in triple. However, it is not able to handle boolean questions based on the absence of a property in a triple. For example, it can't answer the question "Does Albert Einstein not have a date of death?".
The strategy use a comparison between the resulting sparql query of two commands sequences (e.g. <commands1>paris ; property capital</commands1> <operator>=</operator> <commands2>match paris</commands2>). To solve a question like "Is Albert Einstein still alive?", we could think to something like:
```xml
<commands1>albert einstein</commands1>
<operator>has property</operator>
<commands2>matchProperties date of death</commands2>
```
The problem being that a Sparklis focus only containing an entity and nothing else doesn't have a corresponding Sparql query. SO we would need to have an alternate way to get the first query. Also a command like matchProperties currently don't exist in Sparklis commands.