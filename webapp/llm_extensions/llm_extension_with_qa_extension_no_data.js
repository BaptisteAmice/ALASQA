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
   
    // let output = await sendPrompt(
    //     usualPrompt(systemMessage, input_question), 
    //     true, 
    //     (text) => updateReasoning(questionId, text) // Capture `questionId` and send `text`
    // );    

    let output = 'blablabla<commands>a animal </commands>dsfsd';
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

    //wait for the endpoint to be ready //todo plus élégamment, voir avec sebastien
    await new Promise(r => setTimeout(r, 2000));

    //Execute commands
    //todo pas trop l'air de marcher
    //await process_question(qa); // from qa_extension.js //todo peut etre que je peut await
    process_question(qa); // from qa_extension.js //todo peut etre que je peut await

    //wait for the endpoint to be ready //todo plus élégamment (compliqué tant que je me base sur l'input field et pas l'api)
    await new Promise(r => setTimeout(r, 1000));
    let i = 0;
    while (qa.value != "" && i < 10) {
        console.log("Waiting for commands to finish");
        await new Promise(r => setTimeout(r, 1000));
        i++;
    }
    if (qa.value != "") {
        let message = ERROR_PREFIX + "Commands failed to finish;"
        console.log(message);
        errors += message;
    }
    //get sparklis results from the commands
    let place = sparklis.currentPlace();
    console.log("place",place);

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
            //todo understand why this error is thrown
            //catch error thrown by wikidata endpoint
            let message = ERROR_PREFIX + "error while evaluating SPARQL query";
            console.log(message, e);
            errors += message;
        }

        let resultText;
        try {
            let rows = results.rows;
            resultText = JSON.stringify(rows);
            console.log("result",resultText);
        } catch (e) {
            let message = ERROR_PREFIX + "error while parsing SPARQL results";
            console.log(message, e);
            errors += message;
        }

        updateAnswer(questionId, resultText, "???", sparql, errors); //todo sparklis_request 
        //todo separer answer et erreurs

        //re-enable interactions
        enableInputs();
    });    
    
}

const prompt_template = `
Your goal is to generate commands that query a knowledge graph to find answers to a given question.  

## Format:  
1. Always start by reasoning about what entities and relationships are needed. Wrap this in <think>...</think>.  
2. Translate this reasoning into structured commands, separated by semicolons (;), and wrap them in <commands>...</commands>.  

## Command Syntax:  
- a <class> → Retrieve entities of a class (e.g., a person).  
- has <property> → Filter by property (e.g., has director).  
- is <property> of → Reverse relation (e.g., is director of).  
- > <value>, < <value>, between <v1> and <v2> → Value constraints.  
- after <date>, before <date> → Time constraints.  
- asc, desc → Sorting.  
- and, or, not → Logical operators.  
- up, down → Navigation.  

## Examples:  
Q: Who are Einstein’s parents?  
A: <think>Einstein is a person. His parents are people who have him as a child.</think>  
<commands>a person; has child; Albert Einstein;</commands>  

Q: Which animals belong to Camelini?  
A: <think>Find ANIMALS in the Camelini FAMILY.</think>  
<commands>a animal; has family; camelini;</commands>  

Q: Movies by Spielberg or Tim Burton after 1980?
A: <think>Find FILMS by Spielberg or Burton released after 1980.</think>  
<commands>a film; has director; Tim Burton; or; Spielberg; has release date; after 1980;</commands>  
`;
