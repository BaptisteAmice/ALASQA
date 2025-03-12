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
    - after [date], before [date] → Time constraints.  
    - and, or → Logical operators.  

    ## Examples:
    Q: At which school went Yayoi Kusama?
    A: Starting from the list of entities named Yayoi Kusama seems the best approach. Then, I just need to find the relationship that represents at which school she was educated.
    <commands>Yayoi Kusama ; forwardProperty education</commands> 

    Q: What is the boiling point of water?
    A: The core of the request is WATER. From this entity I will probably be able to get a property such as its BOILING POINT.  
    <commands>water; forwardProperty boiling point</commands>  

    Q: Movies by Spielberg or Tim Burton after 1980?
    A: I need to find FILMS by Spielberg or Burton released after 1980. I can start by listing FILMS and then filter by DIRECTOR and RELEASE DATE. 
    <commands>a film; forwardProperty director; Tim Burton; or; Spielberg; forwardProperty release date; after 1980</commands>  

    Q: among the founders of tencent company, who has been member of national people' congress?"
    A: I can start by finding FOUNDERS of something called TENCENT. Then, I can filter by people who have been members of the NATIONAL PEOPLE'S CONGRESS.
    <commands>backwardProperty founder ; Tencent ; forwardProperty position ; National People's Congress</commands>
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