///// Generic prompts
/**
 * Put the data from the dict between the tags named as the keys.
 * If include_think_step is true, add "Let's think step by step." at the end.
 * Returns the prompt as a string.
 * @param {*} data 
 * @param {boolean} include_think_step 
 * @returns 
 */
function data_input_prompt(data, include_think_step = false) {
    let prompt = Object.entries(data)
        .map(([key, value]) => `<${key}>${value}</${key}>`)
        .join("\n");

    if (include_think_step) {
        prompt += "\nLet's think step by step.";
    }

    return prompt;
}

function getEndpointFamily() {
  let endpoint = sparklis.endpoint().toLowerCase();
  if (endpoint.includes('wikidata')) {
    return 'wikidata';
  } else if (endpoint.includes('dbpedia')) {
    return 'dbpedia';
  } else if (endpoint.includes('corporate') || endpoint.includes('enterprise')) {
    return 'corporate';
  } else {
    return 'unknown';
  }
}

function synonyms_system_prompt() {
  return `Given a word or a group of words, return a list of at most 5 possible class or entity names that may be used to represent this concept in a structured knowledge graph. These should include synonyms, spelling variations (e.g., American vs. British English), plural or singular forms, and semantically equivalent terms that might appear in ontologies or datasets. The terms should be ordered by probability of relevance, with the most likely matches first. Output the list in <answer>...</answer> tags.

Examples:
Q: organization
A: <answer>organisation; institution; firm; nonprofit; NGO</answer>
Q: human
A: <answer>person; human being; individual; people; homo sapiens</answer>
Q: comic series
A: <answer>comic book series; comics; graphic novel series</answer>
`;
}

function commands_chain_system_prompt_v2() {
  return `
  ## Task: Generate knowledge graph query commands for Sparklis (SPARQL-based tool).

  ## Format:
  1. Think step by step about what entities and relationships are needed.
  2. Finish your response with a sequence of commands, separated by semicolons (;), and wrapped in <commands>...</commands>.

  ### Available Commands:
  - a [concept] → Retrieve entities of a given concept (e.g., "a book" to find books). **⚠️ IMPORTANT:** If the question already contains the name of an entity (e.g., the book title of the book), DO NOT use "a [concept]". Directly query the entity instead.
  - [entity] → Retrieve a specific entity (e.g., "Albert Einstein" to find the entity representing Einstein). Use this when asking about a specific thing or individual.
  - forwardProperty [property] → Filter by property (e.g., "forwardProperty director" to find films directed by someone). Use this when moving from subject to object.
  - backwardProperty [property] → Reverse relation (e.g., "backwardProperty director" to find directors of a given film). Use this when moving from object to subject. The object does not need to have been specified in the previous command (for example, you can use "backwardProperty director" as your first command).
  - higherThan [number], lowerThan [number] → Value constraints (e.g., "forwardProperty weight; higherThan 10").
  - after [date], before [date] → Time constraints (e.g., "forwardProperty release date ; after 2000").

  ### ⚠️ Best Practice:
  **If you use "forwardProperty", try to start from a known entity whenever possible.** If the question includes a specific entity (e.g., "Tim Burton"), use it as the starting point instead of querying a general concept (e.g., "a human"). This helps create more precise queries.
  **If multiple entities share the same name (homonyms), using backwardProperty first helps disambiguate the entity by its relationship (e.g., "backwardProperty director; Burton" will have better chances to succeed than "Burton ; forwardProperty director" if several Burtons exist in the knowledge graph).**

  ### Wikidata-Specific Precision:
  - a human → real people
  - a fictional human → fictional people

  ## Examples:
  Q: At which school went Alfons Zielonko?
  A: 
  - The question asks for the school where Alfons Zielonko studied.
  - We first retrieve the entity "Alfons Zielonko".
  - Then, we follow the "educated at" property to find the corresponding school.
   <commands>Alfons Zielonko; forwardProperty educated at</commands>

  Q: What is the boiling point of mercury?
  A: 
  - The question asks for the boiling point of mercury.
  - We first retrieve the entity "mercury".
  - Then, we follow the "boiling point" property to get the value.
  <commands>mercury; forwardProperty boiling point</commands>

  Q: Movies by Steven Spielberg after 1981?
  A: 
  - The question asks for movies directed by Steven Spielberg that were released after 1981.
  - We start by retrieving entities of type "film".
  - Then, we filter these films by the "director" property.
  - Next, we match the specific director "Steven Spielberg ".
  - Finally, we apply a date filter to include only movies released after 1981.
  <commands>a film; forwardProperty director; Steven Spielberg; forwardProperty release date; after 1981</commands>

  Q: among the founders of tencent company, who has been a chief executive officer?
  A: 
  - The question asks which of Tencent’s founders have also served as Chief Executive Officer.
  - We first retrieve "founders of" anything.
  - Then, we follow specify that the company is "Tencent".
  - Next, we filter by the "position" property to check roles these founders held.
  - Finally, we match "chief executive officer" to find which of them occupied this position.
  <commands>backwardProperty founder of; Tencent; forwardProperty position; chief executive officer</commands>  `;
}

function question_user_prompt(question) {
  return `## Question: 
  ${question}`
}

function commands_chain_system_prompt_the_most_improved() {
  let endpoint_family = getEndpointFamily();
  let prompt;
  if (endpoint_family === 'dbpedia') {
    prompt = `## Task: Generate knowledge graph query commands for Sparklis (SPARQL-based tool) on a DBpedia endpoint.

## Format:
1. Think step by step about what entities and relationships are needed.
2. Finish your response with a sequence of commands, separated by semicolons (;), and wrapped in <commands>...</commands>.

### Available Commands:
- a [class] → Retrieve entities of a given class (e.g., "a book" to find books).
- [entity] → Retrieve a specific entity (e.g., "Albert Einstein" to find the entity representing Einstein). Use this when asking about a specific thing or individual. A good practice is to first query for the class of the entity and then filter by the specific name (e.g., "a person ; Albert Einstein").
- property [property] → Retrieve a specific property (e.g., "property height" to find the height of an entity).
- higherThan [number], lowerThan [constant number] → Value constraints (e.g., "property weight; higherThan 10").
- after [date], before [date] → Time constraints (e.g., "property release date ; after 2000").
- groupBy count → Can only be used if a property as been called previously. Group on the subject of the relation of the last property command and for each of them count the number objects (e.g. a movie ; property film director ; groupBy count).
- asc, desc → Sort the results of the last command in ascending or descending order according to the results of previous command (number or date).
- limit [constant number] → Limit the number of results returned by the last command.
- offset [constant number] → Skip the first N results.

### ⚠️ Best Practice:
**To get something that is "the most", you can use the command "asc" or "desc" to sort the results of the last command, then use "limit 1" to get only the first result (or more if you want to get the top N) (e.g., "a person ; property height; desc; limit 1" to get the tallest person).**
**If the question doesn't ask for the first but rather the second or third, you can use "offset" to skip the first N results (e.g., "a person ; property birth date; asc; offset 1; limit 1" to get the second oldest human).**
**It is also possible to use it combined with "groupBy count". For example, "a film; property director ; groupBy count ; desc; limit 1" will give the director with the most films.**

## Examples:
Q: Movies by Steven Spielberg after 1981?
A: 
- The question asks for movies directed by Steven Spielberg that were released after 1981.
- We start by retrieving entities of type "film".
- Then, we filter these films by the "director" property.
- Next, we match the specific director "Steven Spielberg".
- Finally, we apply a date filter to include only movies released after 1981.
<commands>a film; property director; Steven Spielberg; property release date; after 1981</commands>

Q: Was ist die Hauptstadt von Deutschland?
A:
- In english, this question is: What is the capital of Germany?
- We have to find the country "germany".
- Then we have to find its property "capital".
<commands>a country ; Germany; property capital</commands>

Q: Who wrote the book The Hobbit?
A:
- The question asks for the author of the book "The Hobbit".
- We start by retrieving entities of type "book".
- Then, we filter these books by the title "The Hobbit".
- Finally, we retrieve the property "author" to find the author of the book.
<commands>a book ; The Hobbit; property author</commands>`;
  } else if (endpoint_family === 'wikidata') {
    prompt = `
## Task: Generate knowledge graph query commands for Sparklis (SPARQL-based tool) on a Wikidata endpoint.

## Format:
1. Think step by step about what entities and relationships are needed.
2. Finish your response with a sequence of commands, separated by semicolons (;), and wrapped in <commands>...</commands>.

### Available Commands:
- a [class] → Retrieve entities of a given class (e.g., "a book" to find books). **⚠️ IMPORTANT:** If the question already contains the name of an entity (e.g., the title of the book), DO NOT use "a [class]". Directly query the entity instead.
- [entity] → Retrieve a specific entity (e.g., "Albert Einstein" to find the entity representing Einstein). Use this when asking about a specific thing or individual.
- property [property] → Retrieve a specific property (e.g., "property height" to find the height of an entity).
- higherThan [number], lowerThan [constant number] → Value constraints (e.g., "property weight; higherThan 10").
- after [date], before [date] → Time constraints (e.g., "property release date ; after 2000").
- groupBy count → Can only be used if a property as been called previously. Group on the subject of the relation of the last property command and for each of them count the number objects (e.g. property film director ; groupBy count).
- asc, desc → Sort the results of the last command in ascending or descending order according to the results of previous command (number or date).
- limit [constant number] → Limit the number of results returned by the last command.
- offset [constant number] → Skip the first N results.

### ⚠️ Best Practice:
**When using property X ; Entity Y, this means "filter the results to only those where property X is linked to Entity Y".**
**To get something that is "the most", you can use the command "asc" or "desc" to sort the results of the last command, then use "limit 1" to get only the first result (or more if you want to get the top N) (e.g., "a human ; property height; desc; limit 1" to get the tallest person).**
**If the question doesn't ask for the first but rather the second or third, you can use "offset" to skip the first N results (e.g., "a human ; property birth date; asc; offset 1; limit 1" to get the second oldest human).**
**It is also possible to use it combined with "groupBy count". For example, "a movie ; property film director ; groupBy count ; desc; limit 1" will give the director with the most films.**

## Examples:
Q: At which school went Alfons Zielonko?
A: 
- The question asks for the school where Alfons Zielonko studied.
- We first retrieve the entity "Alfons Zielonko".
- Then, we follow the "educated at" property to find the corresponding school.
<commands>Alfons Zielonko; property educated at</commands>

Q: Quel est le point d'ébullition du mercure ?
A: 
- In english, this question is: What is the boiling point of mercury?
- The question asks for the boiling point of mercury.
- We first retrieve the entity "mercury".
- Then, we follow the "boiling point" property to get the value.
<commands>mercury; property boiling point</commands>

Q: Movies by Steven Spielberg after 1981?
A: 
- The question asks for movies directed by Steven Spielberg that were released after 1981.
- We start by retrieving entities of type "film".
- Then, we filter these films by the "director" property.
- Next, we match the specific director "Steven Spielberg".
- Finally, we apply a date filter to include only movies released after 1981.
<commands>a film; property director; Steven Spielberg; property release date; after 1981</commands>

Q: among the founders of tencent company, who has been a chief executive officer?
A: 
- The question asks which of Tencent’s founders have also served as Chief Executive Officer.
- We first search for Tencent.
- Then, we follow the "founder" property to find the founders.
- Next, we filter by the "position" property to check roles these founders held.
- Finally, we match "chief executive officer" to find which of them occupied this position.
<commands>tencent ; property founder ; property position ; chief executive officer</commands>`;
  } else if (endpoint_family === 'corporate' || true) {
    prompt = `## Task: Generate knowledge graph query commands for Sparklis (a SPARQL-based tool) on a domain-specific knowledge graph representing a corporate setting.

## Vocabulary:
**classes**: BillOfMaterial, BomPart, Department, Employee, Hardware, Manager, Price, ProductCategory, Service, Supplier
**properties**: hasBomPart, name, hasPart, quantity, compatibleProduct, depth_mm, hasCategory, hasProductManager, hasSupplier, height_mm, id, price, reliabilityIndex, weight_g, width_mm, responsibleFor, eligibleFor, addressText, areaOfExpertise, email, hasManager, memberOf, phone, addressCountry, addressCountryCode, addressLocality, amount, currency, country, lat, long, label

## Format:
1. Think step by step about what entities and relationships are needed.
2. Finish your response with a sequence of commands, separated by semicolons (;), and wrapped in <commands>...</commands>.

### Available Commands:
- a [class] → Retrieve entities of a given class (e.g., "a Supplier" to find suppliers).
- [entity] → Retrieve a specific entity (e.g., "Adolphina Hoch" to find the entity representing Adolphina Hoch). Use this when asking about a specific thing or individual.
- property [property] → Retrieve a specific property (e.g., "property email" to find the email of an entity).
- higherThan [number], lowerThan [constant number] → Value constraints (e.g., "a Price ; property amount; higherThan 2").
- groupBy count → Can only be used if a property as been called previously. Group on the subject of the relation of the last property command and for each of them count the number objects (e.g. a Supplier ; property addressCountry ; groupBy count).
- asc, desc → Sort the results of the last command in ascending or descending order according to the results of previous command (number or date).
- limit [constant number] → Limit the number of results returned by the last command.
- offset [constant number] → Skip the first N results.

### ⚠️ Best Practice:
**When using property X ; Entity Y, this means "filter the results to only those where property X is linked to Entity Y".**
**To get something that is "the most", you can use the command "asc" or "desc" to sort the results of the last command, then use "limit 1" to get only the first result (or more if you want to get the top N) (e.g., "a Department ; property id ; asc ; limit 1" to get the department with the smallest id).**
**If the question doesn't ask for the first but rather the second or third, you can use "offset" to skip the first N results (e.g., "a Department ; property id ; asc ; offset 1; limit 1;" to get the department with the second smallest id).**
**It is also possible to use it combined with "groupBy count". For example, "a Department ; property member ; groupBy count ; desc ; limit 1" will give the department with the most members.**

## Examples:
Q: List all suppliers in France.
A:
- The question asks for suppliers in France.
- We first retrieve the class "Supplier".
- Then, we follow the property "country" to get the country of each supplier.
- Finally, we filter the results to include only those suppliers located in France.
<commands>a Supplier ; property country ; France</commands>

Q: Wie ist die Telefonnummer des Managers von Arnelle Gerber?
A:
- In english, this question is: What is the phone number of the manager of Arnelle Gerber?
- We first retrieve the entity matching the name "Arnelle Gerber".
- Then, we follow the property "hasManager" to find the manager of this entity.
- Finally, we retrieve the property "phone" to get the phone number of the manager.
<commands>property name ; Arnelle Gerber ; property hasManager ; property phone</commands>

Q: List the bills of material of AeroVibe Matrix.
A:
- The question asks for the Bill of Material (BOM) of AeroVibe Matrix.
- We first look for the list of BOMs.
- Then, we filter the results by the name "AeroVibe Matrix".
- Finally, we retrieve the property "bomPart" to get the specific BOM part associated with AeroVibe Matrix.
<commands>a BillOfMaterial; property name ; AeroVibe Matrix ; property hasBomPart</commands>

Q: What are the areas of expertise of Jarvis Jans?
A:
- The question asks for the areas of expertise of Jarvis Jans.
- We first try to find a match for the name "Jarvis Jans".
- Then, we search for the property "areaOfExpertise" associated with this entity.
<commands>property name ; Jarvis Jans ; property areaOfExpertise</commands>`;
  }
  return prompt;
}


function forward_commands_chain_system_prompt() {
    return `
    ## Task: Generate knowledge graph query commands for Sparklis (SPARQL-based tool).

    ## Format:
    1. Think step by step about what entities and relationships are needed.
    2. Finish your response with a sequence of commands, separated by semicolons (;), and wrapped in <commands>...</commands>.

    ### Available Commands:
    - a [concept] → Retrieve entities of a given concept (e.g., "a book" to find books). **⚠️ IMPORTANT:** If the question already contains the name of an entity (e.g., the book title of the book), DO NOT use "a [concept]". Directly query the entity instead.
    - [entity] → Retrieve a specific entity (e.g., "Albert Einstein" to find the entity representing Einstein). Use this when asking about a specific thing or individual.
    - forwardProperty [property] → Filter by property (e.g., "forwardProperty director" to find films directed by someone). **⚠️ Forward direction only:** You can only move from subject to object, not the reverse. Structure queries accordingly.
    - higherThan [number], lowerThan [number] → Value constraints.
    - after [date], before [date] → Time constraints (e.g., "after 2000").

    ### ⚠️ Best Practice:
    **Try to start from a known entity whenever possible.** If the question includes a specific entity (e.g., "Tim Burton"), use it as the starting point instead of querying a general concept (e.g., "a human"). This helps create more precise queries.

    ### Wikidata-Specific Precision:
    - a human → real people
    - a fictional human → fictional people

    ## Examples:
    Q: At which school went Alfons Zielonko?
    A: 
    - The question asks for the school where Alfons Zielonko studied.
    - We first retrieve the entity "Alfons Zielonko".
    - Then, we follow the "educated at" property to find the corresponding school.
     <commands>Alfons Zielonko; forwardProperty educated at</commands>

    Q: What is the boiling point of mercury?
    A: 
    - The question asks for the boiling point of mercury.
    - We first retrieve the entity "mercury".
    - Then, we follow the "boiling point" property to get the value.
    <commands>mercury; forwardProperty boiling point</commands>

    Q: Movies by Steven Spielberg after 1981?
    A: 
    - The question asks for movies directed by Steven Spielberg that were released after 1981.
    - We start by retrieving entities of type "film".
    - Then, we filter these films by the "director" property.
    - Next, we match the specific director "Steven Spielberg".
    - Finally, we apply a date filter to include only movies released after 1981.
    <commands>a film; forwardProperty director; Steven Spielberg; forwardProperty release date; after 1981</commands>

    Q: among the founders of tencent company, who has been a chief executive officer?
    A: 
    - The question asks which of Tencent’s founders have also served as Chief Executive Officer.
    - We first retrieve the entity "Tencent".
    - Then, we follow the "founder of" property to get its founders.
    - Next, we filter by the "position" property to check roles these founders held.
    - Finally, we match "chief executive officer" to find which of them occupied this position.
    <commands>Tencent;forwardProperty founder of; forwardProperty position; chief executive officer</commands>
    `;
}

///// Verifier
function verifier_system_prompt() {
    return `For a given question, a given SPARQL query, and its result, evaluate whether the result of the query answers the question.
    Think step by step, then finish your response by replying with either <answer>correct</answer> or <answer>incorrect</answer> (but nothing else).`;
}

///// Commands step by step

function choose_action_system_prompt() {
    return `Given a question, a SPARQL query, and the result of executing that query, determine the next action to refine the query.
    Think step by step, then conclude with one of the following actions:
    - <action>done</action>: If the query is complete and the results exactly answer the question.
    - <action>process</action>: If the results of the query contain the necessary information but require further processing (e.g., filtering, counting, aggregating).
    - <action>add command</action>: If additional commands are needed to retrieve the desired information.`;
}

function refine_query_system_prompt() {
    return `You will be given a question, a SPARQL query, and the result of executing that query.
    Your task is to refine the query step by step so that its output exactly answers the question.
    For example, if the expected answer is a boolean but the query does not return one, yet contains the necessary data to determine it, you must modify it to return the correct boolean value.
    If the query does not retrieve relevant data for answering the question, you must write a new query from scratch.
    Conclude your reasoning by wrapping the new query (without comments) in the <query>...</query> tags.`;
}

///// Direct question to SPARQL
function direct_qa_system_prompt(endpoint) {
    return `Given a natural language question, generate an appropriate SPARQL query to retrieve the relevant information from the knowledge graph. Use the SPARQL endpoint: ${endpoint}.

    Follow these steps:
    1. Identify the key entities and relationships in the question.
    2. Determine the relevant classes, properties, or constraints in the knowledge graph.
    3. Construct a SPARQL query that retrieves precise information while being efficient.
    4. Output the final SPARQL query, wrapped in <sparql>...</sparql> (do **not** put comments in the sparql query, even with #).
    
    Example:
    - **Q:** What is the boiling point of mercury?
    - **A:** I need to find the boiling point of mercury. I can start by retrieving the entity "mercury" and then follow the property "boiling point".
    <sparql>SELECT DISTINCT ?P2102_7 WHERE { wd:Q925 p:P2102 [ ps:P2102 ?P2102_7 ] . }</sparql>
    `;
}

function direct_boolean_answering_prompt() {
  return `Given a natural language question, answer by true or false.
  Think step by step, then put your answer in <answer>...</answer> tags.

  Examples:
  - **Q:** Was Shaquille O'Neal a basketball player?
  - **A:** Yes, he was a basketball player. <answer>true</answer>
  - **Q:** Does the Isar flow into a lake?
  - **A:** No, the Isar doesn't flow into a lake — it originates in the mountains, passes by or through artificial lakes, and ends in the Danube River. <answer>false</answer>
  - **Q:** Ist die Hauptstadt von Frankreich Paris?
  - **A:** This question translate to "Is the capital of France Paris?". Yes, the capital of France is Paris. <answer>true</answer>`;
}

///// BOOLEAN HANDLING

function prompt_convert_query_to_boolean_query() {
    return "Given this query, i want a new query responding to the question by returning a boolean value (so, you will preferably use a ASK if possible). Wrap the new query in <query>...</query>. Do **not** put comments in the <query> (even with #).";
}

function prompt_is_boolean_expected() {
    return `
Determine whether the expected answer to the given question is a boolean (i.e., "true" or "false", a yes/no question). 
Think step by step, then respond strictly with <answer>boolean</answer> if the answer is a boolean value. Otherwise, respond with <answer>non-boolean</answer>.
You must absolutely end your question with <answer>boolean</answer> or <answer>non-boolean</answer>.

Examples:
- What is the boiling point of mercury? → The question is asking for a specific value, not a yes/no question. → <answer>non-boolean</answer>
- Did Tom Brady win a Super Bowl before 2005? → The question is asking for a yes/no answer based on a specific event. → <answer>boolean</answer>
- Do all of batman's partner speak english as native language? → The question is asking for a yes/no answer based on either or not every batman's partner speaks english as native language. → <answer>boolean</answer>
- In welcher Abteilung ist Frau Müller? → The question is asking for a specific department, not a yes/no question. → <answer>non-boolean</answer>
- Which pope succeeded John Paul II? → The question is asking for a specific name, not a yes/no question. → <answer>non-boolean</answer>

Now, analyze the following question accordingly:
    `;
}

function prompt_get_subquestions() { //todo revoir
    return `
    Your task is to decompose a given question into a set of necessary subquestions that will provide the data needed to answer it. Follow these principles:

    1. Identify key data points required to resolve the question.  
    2. Formulate each subquestion as a direct factual inquiry.  
    3. Ensure minimal yet complete coverage—only include subquestions that are strictly necessary.  
    4. If the question itself is already a factual inquiry, return it as is, without additional subquestions.  
    5. If no subquestions are needed, return exactly "no subquestion needed".

    ### Output Format:  
    - Return each subquestion between <subquestion> tags.
    - If no subquestions are needed, return exactly "no subquestion needed".    

    ### Examples:

    - **Q:** "Do more than 100,000,000 people speak Italian?"  
    **Response:**  
    <subquestion>How many people speak Italian?</subquestion>

    - **Q:** "Were Charles Darwin and Leo Tolstoy born in the same year?"  
    **Response:**  
    <subquestion>Which year was Charles Darwin born?</subquestion>  
    <subquestion>Which year was Leo Tolstoy born?</subquestion>

    - **Q:** "Was Shaquille O'Neal a basketball player?"  
    **Response:**  
    <subquestion>What was the occupation of Shaquille O'Neal ?</subquestion>

    - **Q:** "What is the capital of France?"  
    **Response:** no subquestion needed.

    `;
}

function prompt_use_subquestions_for_any() { //todo revoir
  return `
You are an AI system that answers a question using the answers to related subquestions. Your job is to read the subanswers and write a **valid SPARQL query** that directly gives the final answer.

### Your task:
1. **Read the original question.**
2. **Look at the answers to the subquestions** (in <subanswer> tags). Extract numbers, dates, names, or other relevant facts.
3. **Write a SPARQL query** that gives the final answer directly. Use the facts you found to build this query.
4. Your output must be inside <query> tags. The query should be **clean, short, and executable** — no comments or extra text.

### SPARQL rules:
- Use \`wdt:Pxxx\` for direct facts (always prefer this for simple properties).
- Use \`p:Pxxx/ps:Pxxx\` only if qualifiers or full statements are needed.
- Do not use \`p:Pxxx\` alone.
- Use filters like \`FILTER(?x > 100)\` or \`FILTER(YEAR(?date1) = YEAR(?date2))\` when comparing values.

---

## Example 1: Direct Answer Already Obtained
**Input:**
<question>How high is the Eiffel Tower?</question>
<subquestion1>What is the height of the Eiffel Tower?</subquestion1>
<subquery1>SELECT DISTINCT ?P2048_7 WHERE { wd:Q243 wdt:P2048 ?P2048_7 . } LIMIT 200</subquery1>
<subanswer1>[[{"number":157,"str":"157"}]]</subanswer1>

**Your output:**
The result is already given by the subquery, so I can keep it as is.
<query>SELECT DISTINCT ?P2048_7 WHERE { wd:Q243 wdt:P2048 ?P2048_7 . } LIMIT 200</query>

---

## Example 2: Yes/No Question with several subquestions
**Input:**
<question>Were Charles Darwin and Leo Tolstoy born in the same year?</question>  
<subquestion1>Which year was Charles Darwin born in?</subquestion1>  
<subquery1>
SELECT DISTINCT ?P569_7
WHERE { wd:Q1035 p:P569 [ ps:P569 ?P569_7 ] . }
LIMIT 200
</subquery1>  
<subanswer1>
[[{"value":"1809-02-12T00:00:00Z"}]]
</subanswer1>  
<subquestion2>Which year was Leo Tolstoy born in?</subquestion2>  
<subquery2>
SELECT DISTINCT ?P569_7
WHERE { wd:Q7243 p:P569 [ ps:P569 ?P569_7 ] . }
LIMIT 200
</subquery2>  
<subanswer2>
[[{"value":"1828-09-09T00:00:00Z"}]]
</subanswer2>

**Your output:**
<query>
ASK WHERE {
  wd:Q1035 wdt:P569 ?date1 .
  wd:Q7243 wdt:P569 ?date2 .
  FILTER(YEAR(?date1) = YEAR(?date2))
}
</query>

---
  
## Example 3: Finding the most something
**Input:**
<question>Who is the oldest actor in Avatar?</question>
<subquestion1>Who are the actors in Avatar and what are their birth dates?</subquestion1>
<subquery1>SELECT DISTINCT ?P161_7 ?P569_44 WHERE { wd:Q24871 p:P161 [ ps:P161 ?P161_7 ] . ?P161_7 p:P569 [ ps:P569 ?P569_44 ] . } LIMIT 200</subquery1>
<subanswer1>
[[{"label":"Matt Gerald","uri":"wd:Q1889482"},{"str":"1970-05-02T00:00:00Z"}],[{"label":"Laz Alonso","uri":"wd:Q302335"},{"str":"1974-03-25T00:00:00Z"}],[{"label":"Dileep Rao","uri":"wd:Q1225469"},{"str":"1973-07-29T00:00:00Z"}],and more truncated results...]
</subanswer1>

**Your output:**
The subquery give the actors and their birthdate.
To have the oldest, i need to order them by age and only keep the first one.
I only want to output the actor, not the birthdate.
<query>SELECT DISTINCT ?oldestActor WHERE { wd:Q24871 p:P161 [ ps:P161 ?oldestActor ] . ?oldestActor p:P569 [ ps:P569 ?birthDate ] . } ORDER BY ASC(?birthDate) LIMIT 1</query>
  `;
} 

function prompt_get_subquestions_for_boolean() {
    return `
Your task is to decompose a given **boolean question** (i.e., a yes/no question) into a set of necessary subquestions that will provide the data needed to answer it. Follow these principles:

1. Identify key data points required to resolve the question.  
2. Formulate each subquestion as a direct factual inquiry.  
3. Ensure minimal yet complete coverage—only include subquestions that are strictly necessary.  

### Output Format:  
- Return each subquestion between <subquestion> tags.

### Examples:

- **Q:** "Do more than 100,000,000 people speak Italian?"  
**Response:**  
<subquestion>How many people speak Italian?</subquestion>

- **Q:** "Were Charles Darwin and Leo Tolstoy born in the same year?"  
**Response:**  
<subquestion>Which year was Charles Darwin born?</subquestion>  
<subquestion>Which year was Leo Tolstoy born?</subquestion>

- **Q:** "Was Shaquille O'Neal a basketball player?"  
**Response:**  
<subquestion>What was the occupation of Shaquille O'Neal ?</subquestion>
    `;
}

//todo manque traduction des uris pour wikidata: pour les requetes aussi?
//todo remove useless fields from input (type, etc.)
function prompt_use_subquestions_for_boolean() { //todo wikidata vs dbpedia vs corporate
    let endpoint_family = getEndpointFamily();
    let prompt;
    if (endpoint_family === 'dbpedia') {
        //todo
    } else if (endpoint_family === 'wikidata') {
        prompt = `
You are an AI system that answers a **yes/no question** using the answers to related subquestions. The question is always boolean. Your job is to read the subanswers and write a **new SPARQL query** that directly gives the final boolean answer.

### Your task:
1. **Read the original question.**
2. **Look at the answers to the subquestions** (in <subanswer> tags). Extract numbers, dates, names, or other relevant facts.
3. **Write a SPARQL query** that gives the final answer directly. Use the facts you found to build this query.
4. Your output must be inside <query> tags. The query should be **clean, short, and executable** — no comments or extra text.

### SPARQL rules:
- Use \`wdt:Pxxx\` for direct facts (always prefer this for simple properties).
- Use \`p:Pxxx/ps:Pxxx\` only if qualifiers or full statements are needed.
- Do not use \`p:Pxxx\` alone.
- Use filters like \`FILTER(?x > 100)\` or \`FILTER(YEAR(?date1) = YEAR(?date2))\` when comparing values.

---

### Examples:

#### Example 1:
**Input:**
<question>Do more than 100,000,000 people speak Italian?</question>  
<subquestion1>How many people speak Italian?</subquestion1>  
<subquery1>
SELECT DISTINCT ?P1098_7
WHERE { wd:Q652 p:P1098 [ ps:P1098 ?P1098_7 ] . }
LIMIT 200
</subquery1>  
<subanswer1>
[[{"number":64800000}]]
</subanswer1>

**Your output:**
<query>
ASK WHERE {
  wd:Q652 wdt:P1098 ?count .
  FILTER(?count > 64800000)
}
</query>

---

#### Example 2:
**Input:**
<question>Were Charles Darwin and Leo Tolstoy born in the same year?</question>  
<subquestion1>Which year was Charles Darwin born in?</subquestion1>  
<subquery1>
SELECT DISTINCT ?P569_7
WHERE { wd:Q1035 p:P569 [ ps:P569 ?P569_7 ] . }
LIMIT 200
</subquery1>  
<subanswer1>
[[{"value":"1809-02-12T00:00:00Z"}]]
</subanswer1>  
<subquestion2>Which year was Leo Tolstoy born in?</subquestion2>  
<subquery2>
SELECT DISTINCT ?P569_7
WHERE { wd:Q7243 p:P569 [ ps:P569 ?P569_7 ] . }
LIMIT 200
</subquery2>  
<subanswer2>
[[{"value":"1828-09-09T00:00:00Z"}]]
</subanswer2>

**Your output:**
<query>
ASK WHERE {
  wd:Q1035 wdt:P569 ?date1 .
  wd:Q7243 wdt:P569 ?date2 .
  FILTER(YEAR(?date1) = YEAR(?date2))
}
</query>

---

Now do the same for the next input. Use the subanswers to build a direct query that answers the original question. Return only the final query inside <query> tags.
`;
    } else if (endpoint_family === 'corporate') {
        //todo
    }
    return prompt;
}

function prompt_get_subquestions_for_boolean_algo_ver() {
  let endpoint_family = getEndpointFamily();
  let prompt;
  if (endpoint_family === 'dbpedia') {
    prompt = `todo`; //todo
  } else if (endpoint_family === 'wikidata') {
    prompt = `
## Task: Generate knowledge graph query commands for Sparklis (SPARQL-based tool) on a Wikidata endpoint.
You will only be asked boolean questions.

## Format:
Always output either:
- A single Command Sequence – for simple numeric/date conditions): <commands>...</commands>
- A full Comparison – for testing membership or matching: <commands1>...</commands1><operator>...</operator><commands2>...</commands2>
Use semicolons (;) to separate commands inside each tag.

## Available Commands:
- a [class] → Retrieve entities of a given class (e.g., "a book" to find books). **⚠️ IMPORTANT:** If the question already contains the name of an entity (e.g., the title of the book), DO NOT use "a [class]". Directly query the entity instead.
- [entity] → Retrieve a specific entity (e.g., "Albert Einstein" to find the entity representing Einstein). Use this when asking about a specific thing or individual.
- property [property] → Retrieve a specific property (e.g., "property height" to find the height of an entity).
- higherThan [number], lowerThan [constant number] → Value constraints (e.g., "property weight; higherThan 10").
- after [date], before [date] → Time constraints (e.g., "property release date ; after 2000").
- groupBy count → Can only be used if a property as been called previously. Group on the subject of the relation of the last property command and for each of them count the number objects (e.g. property film director ; groupBy count).
- asc, desc → Sort the results of the last command in ascending or descending order according to the results of previous command (number or date).
- limit [constant number] → Limit the number of results returned by the last command.
- offset [constant number] → Skip the first N results.
- match [string] → Return the list of entities or values that match the given string

### ⚠️ Best Practice:
**When using property X ; Entity Y, this means "filter the results to only those where property X is linked to Entity Y".**
**To get something that is "the most", you can use the command "asc" or "desc" to sort the results of the last command, then use "limit 1" to get only the first result (or more if you want to get the top N) (e.g., "a human ; property height; desc; limit 1" to get the tallest person).**
**If the question doesn't ask for the first but rather the second or third, you can use "offset" to skip the first N results (e.g., "a human ; property birth date; asc; offset 1; limit 1" to get the second oldest human).**
**It is also possible to use it combined with "groupBy count". For example, "a movie ; property film director ; groupBy count ; desc; limit 1" will give the director with the most films.**

## Availables SPARQL comparison operators:
- IN → Used to check if a specific entity or value is part of the results of the second command sequence.
- NOT IN → Used to check if a specific entity or value is not part of the results of the second command sequence.
- = → Used to check if the results of the first command sequence intersect with the results of the second command sequence.
- != → Used to check if the results of the first command sequence are disjoint with the results of the second command sequence.
- <, >, <=, >= → Used to compare numerical or date values between the results of the first and second command sequences.
Be careful not to confuse the vocabulary of the commands sequence with the vocabulary of the comparison operators.

## Examples:

Q: Is Paris the capital of France?
A: <commands1>a country ; property capital</commands1>
<operator>=</operator>
<commands2>match Paris</commands2>

Q: Was Albert Einstein born in Germany?
A: <commands1>albert einstein ; property place of birth ; property country</commands1>
<operator>=</operator>
<commands2>match germany</commands2>

Q: Is the Everest higher than 8000 meters?
A: <commands>mount everest ; property elevation ; higherThan 8000</commands>

Q: Is India the most populous country?
A: <commands1>a country ; property population ; desc ; limit 1</commands1>
<operator>=</operator>
<commands2>match India</commands2>`;
  } else if (endpoint_family === 'corporate' || true) {
    prompt = `todo`; //todo
  }
  return prompt;
}

function prompt_translate_res_to_nl() {
  return `You are an AI system that **writes a natural language answer** to a factual question based on the results of a SPARQL query.

### Your task:
1. **Read the original question.**
2. **Read the SPARQL query and its result** (in <query> and <answer> tags).
3. **Translate the result into a concise natural language answer** to the original question.

---

### Examples:

#### Example 1:
**Input:**
<question>What is the capital of France?</question>  
<query>
SELECT ?capital WHERE {
  wd:Q142 wdt:P36 ?capital .
}
</query>  
<answer>
[[{"capital":"wd:Q90", label:"Paris"}]]
</answer>

**Output:**
The capital of France is Paris.

---

#### Example 2:
**Input:**
<question>How many people speak Italian?</question>  
<query>
SELECT DISTINCT ?count
WHERE { wd:Q652 wdt:P1098 ?count . }
</query>  
<answer>
[[{"count":64800000}]]
</answer>

**Output:**
Approximately 64.8 million people speak Italian.

---

#### Example 3:
**Input:**
<question>When was Charles Darwin born?</question>  
<query>
SELECT ?date WHERE {
  wd:Q1035 wdt:P569 ?date .
}
</query>  
<answer>
[[{"date":"1809-02-12T00:00:00Z"}]]
</answer>

**Output:**
Charles Darwin was born on February 12, 1809.

---

Apply the same logic to new inputs to generate a fluent and factually accurate natural language response.`;

}