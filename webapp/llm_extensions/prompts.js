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

function commands_chain_input_prompt(input) {
    return "Q: " + input + "\nA: ";
}

///// Verifier

function verifier_system_prompt() {
    return `For a given question, a given request SPARQL and a given result, do you think the result is correct?
    Think step by step, then finish your response by either <answer>correct</answer> or <answer>incorrect</answer> (but nothing else).`;
}

function verifier_input_prompt(input_question, sparql, resultText) {
    return `<question>${input_question}</question>
    <sparql>${sparql}</sparql>
    <result>${resultText}</result>
    Let's think step by step.
    `;
}

///// Patch

//todo


///// Direct question to SPARQL
function direct_qa_system_prompt(endpoint) {
    return `For a given question, generate a SPARQL query to retrieve the relevant information from the knowledge graph (the endpoint to use is ${endpoint}).
    Think step by step, then finish your response by the generated SPARQL query wrapped in <sparql>...</sparql>.`;
}

function direct_qa_input_prompt(input) {
    return "Q: " + input + "\nA: ";
}