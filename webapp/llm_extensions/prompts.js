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

///// Commands chain
function commands_chain_system_prompt() {
    return `
    ## Task: Generate knowledge graph query commands for Sparklis (SPARQL-based tool).

    ## Format:
    1. Think step by step about what entities and relationships are needed.
    2. Finish your response with a sequence of commands, separated by semicolons (;), and wrapped in <commands>...</commands>.

    ### Available Commands:
    - list [concept] → Retrieve entities of a given concept (e.g., "list book" to find books). **⚠️ IMPORTANT:** If the question already contains the name of an entity (e.g., the book title of the book), DO NOT use "list [concept]". Directly query the entity instead.
    - [entity] → Retrieve a specific entity (e.g., "Albert Einstein" to find the entity representing Einstein). Use this when asking about a specific thing or individual.
    - forwardProperty [property] → Filter by property (e.g., "forwardProperty director" to find films directed by someone).
    - higherThan [number], lowerThan [number] → Value constraints.
    - after [date], before [date] → Time constraints (e.g., "after 2000").

    ## Examples:
    Q: At which school went Yayoi Kusama?
    A: To answer this question, I need to identify the entity for "Yayoi Kusama" and the property "educated at" that connects her to the schools she attended. Using the forwardProperty educated at command will allow us to filter the institutions where she received her education.
    <commands>Yayoi Kusama; forwardProperty educated at</commands>

    Q: What is the boiling point of water?
    A: The core of the request is WATER. From this entity, I will be able to retrieve the property BOILING POINT.  
    <commands>water; forwardProperty boiling point</commands>

    Q: Movies by Tim Burton after 1980?
    A: I need to find FILMS by Tim Burton released after 1980. I can start by listing FILMS and then filter by DIRECTOR and RELEASE DATE. 
    <commands>list film; forwardProperty director; Tim Burton; forwardProperty release date; after 1980</commands>

    Q: among the founders of tencent company, who has been member of national people' congress?"
    A: I can start by finding the FOUNDERS of something called TENCENT. Then, I can filter by people who have been members of the NATIONAL PEOPLE'S CONGRESS.
    <commands>Tencent;forwardProperty founder of; forwardProperty position; National People's Congress</commands>
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

function refine_query_system_prompt() { //toimprove
    return `You will be given a question, a SPARQL query, and the result of executing that query.
    Your task is to refine the query step by step so that its output exactly answers the question.
    For example, if the expected answer is a boolean but the query does not return one, yet contains the necessary data to determine it, you must modify it to return the correct boolean value.
    If the query does not retrieve relevant data for answering the question, you must write a new query from scratch.
    Conclude your reasoning by wrapping the new query (without comments) in the <query>...</query> tags.`;
}


function following_command_system_prompt() { //toimprove
    return `
    You will be given a question, a SPARQL query, the result of executing that query, and the last command you used to achieve that result.
    To continue building your query, follow these steps:

    1. **Add one command at a time** to refine the query.
    - Each command should add a new filter or condition to the query.
    - Available Commands:
        - a [concept] → Retrieve entities of a given concept (e.g., "a book" to find books).
        - [entity] → Retrieve an entity (e.g., "Albert Einstein" to find the entity representing Einstein).
        - forwardProperty [property] → Filter by property (e.g., "forwardProperty director" to find films directed by someone).
        - backwardProperty [property] → Reverse relation (e.g., "backwardProperty director" to find directors of films).
        - higherThan [number], lowerThan [number] → Value constraints.
        - after [date], before [date] → Time constraints (e.g., "after 2000").
        - and, or → Logical operators (e.g., if the previous command was "Tim Burton", you can add "or", and the next command could be "Steven Spielberg", to find films by either director).
        - goback → Undo the last command.

    Don't try to use ids such as Q513, instead just use the names of the entities.
    
    2. **Explain the reasoning** behind each command choice.
    - Justify why each command is necessary to answer the question.
    - Consider how each command narrows down the search space.

    3. Conclude with the new command wrapped in <command>...</command>.

    ### Examples:

    **Q: Movies by Spielberg or Tim Burton after 1980?**
    - We already retrieved films and filtered by director.
    - To further narrow down the results, we need to filter by release date.
    - We can get the property "release date" using the forwardProperty command.
    - **Query:** \`<command>forwardProperty release date;</command>\`
    - The next command should filter the release date to be after 1980.
    `;
}

///// Direct question to SPARQL
function direct_qa_system_prompt(endpoint) {
    return `Given a natural language question, generate an appropriate SPARQL query to retrieve the relevant information from the knowledge graph. Use the SPARQL endpoint: ${endpoint}.

    Follow these steps:
    1. Identify the key entities and relationships in the question.
    2. Determine the relevant classes, properties, or constraints in the knowledge graph.
    3. Construct a SPARQL query that retrieves precise information while being efficient.
    4. Output only the final SPARQL query, wrapped in <sparql>...</sparql>, without additional explanation.`;
}

///// BOOLEAN HANDLING

function prompt_convert_query_to_boolean_query() { //todo recu bon prompt sur autre pc
    return "Given this query, i want a new query responding to the question by returning a boolean value (so, you will preferably use a ASK if possible). Wrap the new query in <query>...</query>.";
}

function prompt_is_boolean_expected() {
    return `
    Determine whether the expected answer to the given question is a boolean (i.e., "true" or "false"). 
    Respond strictly with <answer>boolean</answer> if the answer is a boolean value. Otherwise, respond with <answer>non-boolean</answer>.

    Examples:
    - What is the boiling point of water? → <answer>non-boolean</answer>
    - Did Tom Brady win a Super Bowl before 2005? → <answer>boolean</answer>

    Now, analyze the following question accordingly:
    `;
}

function prompt_get_subquestions() {
    return `
    Your task is to decompose a given question into a set of necessary subquestions that will provide the data needed to answer it. Follow these principles:

    1. Identify key data points required to resolve the question.  
    2. Formulate each subquestion as a direct factual inquiry.  
    3. Ensure minimal yet complete coverage—only include subquestions that are strictly necessary.  
    4. If the question itself is already a factual inquiry, return it as is, without additional subquestions.  
    5. If no subquestions are needed, return nothing.

    ### Output Format:  
    Return each subquestion between <subquestion> tags. If no subquestions are required, return an empty response.

    ### Examples:

    - **Q:** "Do more than 100,000,000 people speak Japanese?"  
    **Response:**  
    <subquestion>How many people speak Japanese?</subquestion>

    - **Q:** "Were Angela Merkel and Tony Blair born in the same year?"  
    **Response:**  
    <subquestion>Which year was Angela Merkel born?</subquestion>  
    <subquestion>Which year was Tony Blair born?</subquestion>

    - **Q:** "Was Google founded by Bill Gates?"  
    **Response:**  
    <subquestion>Was Google founded by Bill Gates?</subquestion>

    - **Q:** "What is the capital of France?"  
    **Response:** *(empty output, as the question itself is already a factual inquiry)*

    Ensure the response only contains subquestions within <subquestion> tags, or nothing if no subquestions are needed.
    `;
}

function prompt_use_subquestions() {
    return `
    You are an AI system that processes a question by analyzing the responses to its subqueries and generating a new query that provides the final answer.
    
    ### Instructions:
    1. Extract relevant numerical or textual data from the JSON responses provided in <subanswer> tags.
    2. Construct a new SPARQL query that directly retrieves the answer to the original question.
    3. Return the new query enclosed in <query> tags.
    
    ### Examples:
    
    #### Example 1:
    **Input:**
    <question>Do more than 100,000,000 people speak Japanese?</question>
    <subquestion1>How many people speak Japanese?</subquestion1>
    <subquery1>
    SELECT DISTINCT ?P1098_7
    WHERE { wd:Q5287 p:P1098 [ ps:P1098 ?P1098_7 ] . }
    LIMIT 200
    </subquery1> 
    <subanswer1>{
        "columns": [
            "P1098_7"
        ],
        "rows": [
            [
                {
                    "type": "number",
                    "number": 128000000,
                    "str": "128000000",
                    "datatype": "http://www.w3.org/2001/XMLSchema#decimal"
                }
            ]
        ]
    }</subanswer1>
    
    **Output:**
    <query>
    ASK WHERE {
      wd:Q5287 p:P1098 [ ps:P1098 ?count ] .
      FILTER(?count > 100000000)
    }
    </query>
    
    #### Example 2:
    **Input:**
    <question>Were Angela Merkel and Tony Blair born in the same year?</question>
    <subquestion1>Which year was Angela Merkel born in?</subquestion1>
    <subquery1>
        SELECT DISTINCT ?P569_7
        WHERE { wd:Q94746073 p:P569 [ ps:P569 ?P569_7 ] . }
        LIMIT 200
    </subquery1>
    <subanswer1>{
        "head" : {
          "vars" : [ "P569_133" ]
        },
        "results" : {
          "bindings" : [ {
            "P569_133" : {
              "datatype" : "http://www.w3.org/2001/XMLSchema#dateTime",
              "type" : "literal",
              "value" : "1932-01-01T00:00:00Z"
            }
          } ]
        }
      }</subanswer1>
    <subquestion2>Which year was Tony Blair born in?</subquestion2>
    <subquery2>
        SELECT DISTINCT ?P569_7
        WHERE { wd:Q9545 p:P569 [ ps:P569 ?P569_7 ] . }
        LIMIT 200
    </subquery2>
    <subanswer2>{
        "head" : {
          "vars" : [ "P569_7" ]
        },
        "results" : {
          "bindings" : [ {
            "P569_7" : {
              "datatype" : "http://www.w3.org/2001/XMLSchema#dateTime",
              "type" : "literal",
              "value" : "1953-05-06T00:00:00Z"
            }
          } ]
        }
      }</subanswer2>
    
    **Output:**
    <query>
    ASK WHERE {
      wd:Q94746073 p:P569 [ ps:P569 ?year1 ] .
      wd:Q9545 p:P569 [ ps:P569 ?year2 ] .
      FILTER(YEAR(?year1) = YEAR(?year2))
    }
    </query>
    
    #### Example 3:
    **Input:**
    <question>Who is the oldest cast member of the Netflix show “Queer Eye”?</question>
    <subquestion>Who are the actors in Queer Eye and what are their birth dates?</subquestion>
    <subquery>
    SELECT DISTINCT ?P161_104 ?P569_141
    WHERE { wd:Q48817408 p:P161 [ ps:P161 ?P161_104 ] .
            ?P161_104 p:P569 [ ps:P569 ?P569_141 ] . }
    LIMIT 200
    </subquery>
    <subanswer>
    [
        [
            {
                "type": "uri",
                "uri": "http://www.wikidata.org/entity/Q29452671",
                "label": "Jeremiah Brent"
            },
            {
                "type": "typedLiteral",
                "str": "1984-11-24T00:00:00Z",
                "datatype": "http://www.w3.org/2001/XMLSchema#dateTime"
            }
        ],
        [
            {
                "type": "uri",
                "uri": "http://www.wikidata.org/entity/Q44870529",
                "label": "Karamo Brown"
            },
            {
                "type": "typedLiteral",
                "str": "1980-11-02T00:00:00Z",
                "datatype": "http://www.w3.org/2001/XMLSchema#dateTime"
            }
        ],
        and more truncated results...
    ]
    </subanswer>
    
    **Output:**
    <query>
    SELECT ?oldestActor WHERE {
      wd:Q48817408 p:P161 [ ps:P161 ?oldestActor ] .
      ?oldestActor p:P569 [ ps:P569 ?birthDate ] .
    }
    ORDER BY ASC(?birthDate)
    LIMIT 1
    </query>
    
    Now, given a new input, extract relevant information, construct a new query that retrieves the answer, and return it in <query> tags.
    `;
}