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
    ## Task: Generate knowledge graph query commands for Sparklis.

    ## Format:  
    1. Think step by step about what entities and relationships are needed 
    2. Then finish your response by a list of commands, separated by semicolons (;), and wrapped in <commands>...</commands>.  

    ### Available Commands:
    - a [concept] → Retrieve entities of a given concept (e.g., "a book" to find books).
    - [entity] → Retrieve an entity (e.g., "Albert Einstein" to find the entity representing Einstein).
    - forwardProperty [property] → Filter by property (e.g., "forwardProperty director" to find films directed by someone).
    - backwardProperty [property] → Reverse relation (e.g., "backwardProperty director" to find directors of films).
    - higherThan [number], lowerThan [number] → Value constraints.
    - after [date], before [date] → Time constraints (e.g., "after 2000").
    - and, or → Logical operators (e.g., "Tim Burton; or; Steven Spielberg").

    ## Examples:
    Q: At which school went Yayoi Kusama?
    A: To answer this question, we need to identify the entity for "Yayoi Kusama" and the property "educated at" that connects her to the schools she attended. Using the forwardProperty educated at command will allow us to filter the institutions where she received her education.
    <commands>Yayoi Kusama ; forwardProperty educated at</commands> 

    Q: What is the boiling point of water?
    A: The core of the request is WATER. From this entity I will probably be able to get a property such as its BOILING POINT.  
    <commands>water; forwardProperty boiling point</commands>  

    Q: Movies by Spielberg or Tim Burton after 1980?
    A: I need to find FILMS by Spielberg or Burton released after 1980. I can start by listing FILMS and then filter by DIRECTOR and RELEASE DATE. 
    <commands>a film; forwardProperty director; Tim Burton; or; Spielberg; forwardProperty release date; after 1980</commands>  

    Q: among the founders of tencent company, who has been member of national people' congress?"
    A: I can start by finding FOUNDERS of something called TENCENT. Then, I can filter by people who have been members of the NATIONAL PEOPLE'S CONGRESS.
    <commands>backwardProperty founder of; Tencent ; forwardProperty position ; National People's Congress</commands>
    `;
}

///// Verifier
function verifier_system_prompt() {
    return `For a given question, a given request SPARQL and a given result, do you think the result of the query answers the question?
    Think step by step, then finish your response by either <answer>correct</answer> or <answer>incorrect</answer> (but nothing else).`;
}

///// Commands step by step
function first_command_system_prompt() { //toimprove
    return `
    To generate a query that retrieves relevant entities from a knowledge base, follow these steps:

    1. **Identify the key entity or concept** in the question.
    - If the question asks about a specific entity (e.g., Tim Burton, water), retrieve that entity using its name.
    - If the question is broad and requires a list of entities (e.g., a animal, a country), start with a concept command (e.g., "a film").

    2. **Determine the relevant properties** if there isn't a direct entity in the question.
    - If the question requires filtering by a known attribute (e.g., directors of a film, the school someone attended), use \`forwardProperty\`.
    - If the question requires reversing a known relation (e.g., finding who founded a company), use \`backwardProperty\`.

    3. **Justify the command choice** based on the nature of the question.

    ### Examples:

    **Q: At which school did Yayoi Kusama study?**  
    - Yayoi Kusama is a specific entity. To retrieve her data, we first get her entity.  
    - To find the school, we need to look for an educational institution related to her.  
    - **Query:** \`<command>Yayoi Kusama</command>\`  

    **Q: What is the boiling point of water?**  
    - The question is about a property of "water," so we start by retrieving the entity "water."  
    - **Query:** \`<command>water</command>\`  

    **Q: Movies by Spielberg or Tim Burton after 1980?**  
    - The question asks for movies (a category of entities).  
    - We retrieve films first, then filter by director and release year.  
    - **Query:** \`<command>a film</command>\`  

    **Q: Among the founders of Tencent, who has been a member of the National People's Congress?**  
    - The question involves finding individuals related to Tencent as founders.  
    - To retrieve them, we reverse the "founder of" relationship from Tencent.  
    - **Query:** \`<command>backwardProperty founder of</command>\`  

    By following these steps, you ensure that the query starts from the right point and leads to relevant results.
    `;
}

function choose_action_system_prompt() {
    return `Based on the question we are trying to answer, the current query and its results, choose the next action to refine the query.
    Think step by step, then finish your response by one of the following actions:
    - <action>done</action>: If you think the query is complete and the results exactly answer the question.
    - <action>process</action>: If you think the results of the query are sufficient to answer the question but need further processing (e.g., filtering, counting).
    - <action>add command</action>: If you think the query needs additional commands to retrieve the desired information.
    `;
}

function refine_query_system_prompt() { //toimprove
    return `You will be given a question, a SPARQL query and its result.
    You have to think step by step and refine the query in order for its output to respond exactly to the question.
    For example, the question can expect a boolean response, if the query doesn't return a boolean but contains the necessary data to induce the boolean, you will have to adapt it in order to return the expected value.
    If the query and its result are totally irrelevant to the question, you will have to write a new query from scratch.
    Conclude your reasoning by wrapping the new query (without comments in it) in the balises <query>...</query>.
    `;
}

function following_command_system_prompt() { //toimprove
    return `
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
        - and, or → Logical operators (e.g., "Tim Burton; or; Steven Spielberg").
    
    2. **Explain the reasoning** behind each command choice.
    - Justify why each command is necessary to answer the question.
    - Consider how each command narrows down the search space.

    3. Conclude with the new command wrapped in <command>...</command>.

    ### Examples:

    **Q: Movies by Spielberg or Tim Burton after 1980?**
    - We already retrieved films and filtered by director.
    - To further narrow down the results, we need to filter by release date.
    - **Query:** \`<command>forwardProperty release date;</command>\`
    `;
}

///// Direct question to SPARQL
function direct_qa_system_prompt(endpoint) {
    return `For a given question, generate a SPARQL query to retrieve the relevant information from the knowledge graph (the endpoint to use is ${endpoint}).
    Think step by step, then finish your response by the generated SPARQL query wrapped in <sparql>...</sparql>.`;
}