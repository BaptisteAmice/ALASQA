//Dependencies: qa_extension.js, llm_add_interface_extension.js, llm_utils.js
console.log("LLM with QA extension active");

ERROR_PREFIX = "Error: ";

// upon window load... create text field and ENTER handler
window.addEventListener(
    'load',
    function(ev) {
    let input_field = document.getElementById("user-input");
    input_field.addEventListener("keyup", function(event) {
        if (event.keyCode == 13) { // ENTER
            qa_control();
        }
	})
});

function removePrefixes(sparqlQuery) {
    return sparqlQuery.split('\n')
        .filter(line => !line.startsWith('PREFIX'))
        .join('\n');
}

async function qa_control() {
    //reset sparklis
    sparklis.home();

    let errors = "";

    //disable some interactions
    disableInputs();

    let input_field = document.getElementById("user-input");
    let input_question = input_field.value;

    //let systemMessage = "Your task is to build commands to query the knowledge graph to find data that answers the given question. Several successive commands can be used and should be separated by a semicolon. For example, to find the parent of Einstein, you can use the following reasoning and commands: \n <think>Einstein is a person, and his parents are the people who have him as a child</think>. \n<commands>a person; has child; Albert Einstein;</commands>.\n Another example with the question 'Which animal is from the camelini family?':<think>I need to find ANIMALS, that are members of a FAMILY, and this family needs to be camelini.</think><commands>a animal ; has family ; camelini;</commands> \n As in the examples, you don't need to anwer to the question but to make a quick reasonning about which kind of entity you need to find in the graphe and then construct a command in the same format to find the corresponding data in the knowledge graph.";
    let systemMessage = prompt_template;

    ////EXTRACTION

    questionId = addLLMQuestion(input_question);
   
    let output = await sendPrompt(
        usualPrompt(systemMessage, input_question), 
        true, 
        (text) => updateReasoning(questionId, text) // Capture `questionId` and send `text`
    );    

    //let output = 'blablabla<commands>a animal ; has family ; camelini;</commands>dsfsd';
    //get commands from regular expression <commands>...</commands>
    let match = output.match(/<commands>(.*?)<\/commands>/s);
    
    let commands = match ? match[1].trim() : "output malformated"; 
    let qa = document.getElementById("qa");
    
    if (commands) {
        qa.value = commands;  // Safe access since we checked if commands is not null
    } else {
        let message = ERROR_PREFIX + "No match found for <commands>...</commands>;"
        console.log(message);
        errors += message;
    }

    //Execute commands and wait for them to finish or to halt
    await process_question(qa)
        .then(() => console.log("All steps completed"))
        .catch(error => {
            let message = ERROR_PREFIX + "Commands failed to finish due to: " + error;
            console.log(message);
            errors += message;
        });


    //get sparklis results from the commands
    let place = sparklis.currentPlace();

    //define callback
    place.onEvaluated(async () => {
        console.log("Place evaluated");
        let sparql = place.sparql();
        console.log("sparql",sparql);
        let results;
        try { 
            sparql = removePrefixes(sparql); //todo temp patch because of wikidata endpoint for which the prefixes are duplicated when requested by the LLM (only difference is that the event is automatically activated)
            results = await sparklis.evalSparql(sparql);
        } catch (e) {
            //catch error thrown by wikidata endpoint
            let message = ERROR_PREFIX + "error while evaluating SPARQL query";
            console.log(message, e);
            errors += message;
        }

        let resultText;
        if (results && results.rows) {
            try {
                let rows = results.rows;
                resultText = JSON.stringify(rows);
                console.log("result",resultText);
            } catch (e) {
                let message = ERROR_PREFIX + "error while parsing SPARQL results";
                console.log(message, e);
                errors += message;
            }
        }

        updateAnswer(questionId, resultText, "???", sparql, errors); //todo sparklis_request 

        //re-enable interactions
        enableInputs();
    });    
    
}

const prompt_template = `
Your goal is to generate commands that query a knowledge graph to find answers to a given question.  
These commands will be used by Sparklis to generate SPARQL queries.

## Format:  
1. Always start by reasoning about what entities and relationships are needed. Wrap this in <think>...</think>.  
2. Translate this reasoning into structured commands, separated by semicolons (;), and wrap them in <commands>...</commands>.  

## Command Syntax:  
- a [class] → Retrieve entities of a class (e.g., a person).  
- has [property] → Filter by property (e.g., has director).  
- is [property] of → Reverse relation (e.g., is director of). Less adapted for filtering than has.
- > [value], < [value], between [v1] and [v2] → Value constraints where value, v1 and v2 are numbers.
- after [date], before [date] → Time constraints.  
- asc, desc → Sorting.  
- and, or, not → Logical operators.  
- up, down → Change the focus of the query.  

## Examples:  
Q: At which school went Yayoi Kusama?
A: <think>Starting from the entity Yayoi Kusama seems the best approach. Then, I just need to find the relationship that represents at which school she was educated.</think>
<commands>Yayoi Kusama ; has education ;</commands> 

Q: What is the boiling point of water?
A: <think>The core of the request is WATER. From this entity I will probably be able to get a property such as its BOILING POINT.</think>  
<commands>water; has boiling;</commands>  

Q: Movies by Spielberg or Tim Burton after 1980?
A: <think>I need to find FILMS by Spielberg or Burton released after 1980. I can start by listing FILMS and then filter by DIRECTOR and RELEASE DATE.</think> 
<commands>a film; has director; Tim Burton; or; Spielberg; has release date; after 1980;</commands>  

Q: among the founders of tencent company, who has been member of national people' congress?"
A: <think>I can start by finding FOUNDERS of something called TENCENT. Then, I can filter by people who have been members of the NATIONAL PEOPLE'S CONGRESS.</think>
<commands>is founder of ; Tencent ; has position ; National People's Congress;</commands>
`;
