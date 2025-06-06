# Technical Notes and Known Issues

- You can implement new systems by adding classes in the file llm_extension_any_system.js. The tools for post-processing are already available, but only used in systems after the "EXPERIMENTAL SYSTEMS" comment. As the name suggests, these systems are experimental and have yet to be validated.

- You can have bad results with DBpedia because of CORS.
A solution is to use a dump locally hosted or to use a proxy endpoint.
For the latter, it can make some queries fail because the queries are encapsulated in a SERVICE.

- Allowing the LLM to choose the direction of a property makes focus management more difficult.

- The groupBy commands have 2 alternative either in Sparklis or in post-processing.

- "before" and "after" commands compare string values rather than dates, which can lead to issues, especially with negative dates.

- Commands executed on Wikidata can cause internal Sparklis queries to time out. A fallback mechanism has been implemented for the property command to mitigate such cases (e.g. a state ; property population).