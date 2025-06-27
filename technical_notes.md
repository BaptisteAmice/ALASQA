# Technical Notes and Known Issues

- You can implement new system strategies by adding classes in the file llm_extension_any_system.js. The tools for post-processing are already available, but only used in strategies after the "EXPERIMENTAL STRATEGIES" comment. As the name suggests, these systems are experimental and have yet to be validated.

- You can have bad results with DBpedia because of CORS.
A solution is to use a dump locally hosted or to use a proxy endpoint.
For the latter, it can make some queries fail because the queries are encapsulated in a SERVICE.

- Sometimes local LLM can be out of memory, from this point, the whole benchmark will fail.

- Not allowing the LLM to choose the direction of a property makes focus management more difficult. But LLMs such as Nemo are really bad at predicting the direction of a property. Using JSON to describe commands as a graph/tree (instead of a sequence) could be a solution to experiment with in the future.

- The groupBy commands have 2 alternative either using Sparklis constraints or remodeling the query after the navigation in Sparklis.

- "before" and "after" commands currently compare string values rather than dates, which can lead to issues, especially with negative dates.

- Commands executed on Wikidata can cause internal Sparklis queries to time out. A fallback mechanism has been implemented for the property command to mitigate such cases (e.g. a state ; property population).

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

- in case of ASK queries, Sparklis doesn't return the same results as tools such as YASGUI or Wikidata Query Service. You can for example try comparing the following query in Sparklis console and in YASGUI:
```js
await sparklis.evalSparql('ASK WHERE { wd:Q58815001 p:P57 [ ps:P57 wd:Q2745616 ] . }')
```
Because of that, ALASQA doesn't return the same results as Sparklis. The workaround is to check if the query is an ASK and then check if the results.rows.length > 0 to determine if the answer is true or false.
