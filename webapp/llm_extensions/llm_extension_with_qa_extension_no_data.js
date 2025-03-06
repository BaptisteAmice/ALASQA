//Dependencies: qa_extension.js, llm_add_interface_extension.js, llm_utils.js
console.log("LLM with QA extension active");

STATUS_NOT_STARTED = "Not started";
STATUS_ONGOING = "ONGOING";
STATUS_DONE = "DONE";
STATUS_FAILED = "FAILED";
var steps_status = {
    "0" : { "Name" : "Start", "Status" : STATUS_NOT_STARTED },
    "1" : { "Name" : "LLM generation", "Status" : STATUS_NOT_STARTED },
    "2" : { "Name" : "Retrieving commands", "Status" : STATUS_NOT_STARTED },
    "3" : { "Name" : "QA extension commands execution", "Status" : STATUS_NOT_STARTED },
    "4" : { "Name" : "Evaluate SPARQL in Sparklis", "Status" : STATUS_NOT_STARTED },
    "5" : { "Name" : "Parsing results for display", "Status" : STATUS_NOT_STARTED },
};

// If updated, also update the post-processing script
var error_messages = [
    "Error: No match found for <commands>...</commands>;",
    "Warning: Commands failed to finish due to: ",
    "Error: error while evaluating SPARQL query",
    "Error: error while parsing SPARQL results",
];

function resetStepsStatus() {
    for (let step in steps_status) {
        steps_status[step]["Status"] = STATUS_NOT_STARTED;
    }
}

function updateStepsStatus(step, status) {
    steps_status[step.toString()]["Status"] = status;
    localStorage.setItem("steps_status", JSON.stringify(steps_status));
}
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

function countCommands(commands) {
    return commands.split(";").filter(cmd => cmd.trim().length > 0).length;
}

/**
 * Convert p.onEvaluated() to a promise to avoid nested callbacks
 * @param {*} p 
 * @returns 
 */
function waitForEvaluation(p) {
    return new Promise((resolve) => {
        p.onEvaluated(() => {
            resolve();
        });
    });
}

async function qa_control() {
    resetStepsStatus(); // Reset steps for each new question
    clearAlerts(); // Clear alerts for each new question
    currentStep = 0;
    updateStepsStatus(currentStep, STATUS_DONE);

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
   
    let reasoningText = ""; //to keep reasoning text and be able to update it
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    let output = await sendPrompt(
        usualPrompt(systemMessage, input_question), 
        true, 
        (text) => { 
            updateReasoning(questionId, text); // Capture `questionId` and send `text`
            reasoningText = text;
        } 
    );

    if (reasoningText != "") {
        updateStepsStatus(currentStep, STATUS_DONE);
    } else {
        updateStepsStatus(currentStep, STATUS_FAILED);
    }
    //let output = 'blablabla<commands>a animal ; has family ; camelini;</commands>dsfsd';

    //get commands from regular expression <commands>...</commands>
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    let matchCommands = output.match(/<commands>(.*?)<\/commands>/s);

    let commands = matchCommands ? matchCommands[1].trim() : ""; // Safe access since we checked if matchCommands is not null
    let qa = document.getElementById("qa");
    
    if (commands) {
        qa.value = commands;  // Safe access since we checked if commands is not null
        updateStepsStatus(currentStep, STATUS_DONE);
    } else {
        let message = error_messages[0];
        console.log(message);
        errors += message;
        updateStepsStatus(currentStep, STATUS_FAILED);
    }

    //count commands
    let commandsCount = countCommands(commands);
    console.log("Number of commands:", commandsCount);

    //Execute commands and wait for them to finish or to halt
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    await process_question(qa)
        .then(() => { 
            console.log("All steps completed");
            updateStepsStatus(currentStep, STATUS_DONE);
            }
        )
        .catch(error => {
            let message = error_messages[1] + error;
            console.log(message);
            errors += message;
            updateStepsStatus(currentStep, STATUS_FAILED);
        }
    );

    //get remaining commands count
    let remainingCommands = qa.value;
    let remainingCommandsCount = countCommands(remainingCommands);
    console.log("Remaining commands:", remainingCommandsCount);
    let executedCommmandsCount = commandsCount - remainingCommandsCount;


    //get sparklis results from the commands
    let place = sparklis.currentPlace();

    //wait for evaluation of the place
    await waitForEvaluation(place);

    console.log("Place evaluated");
    let sparql = place.sparql();
    console.log("sparql",sparql);
    let results;
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    try { 
        sparql = removePrefixes(sparql); //todo temp patch because of wikidata endpoint for which the prefixes are duplicated when requested by the LLM (only difference is that the event is automatically activated)
        results = await sparklis.evalSparql(sparql); //todo peut etre pas comme ca
        updateStepsStatus(currentStep, STATUS_DONE);
    } catch (e) {
        //catch error thrown by wikidata endpoint
        let message = error_messages[2];
        console.log(message, e);
        errors += message;
        updateStepsStatus(currentStep, STATUS_FAILED);
    }

    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    let resultText = "";
    if (results && results.rows) {
        try {
            let rows = results.rows;
            resultText = JSON.stringify(rows);
            console.log("result",resultText);
            updateStepsStatus(currentStep, STATUS_DONE);
        } catch (e) {
            let message = error_messages[3];
            console.log(message, e);
            errors += message;
            updateStepsStatus(currentStep, STATUS_FAILED);
        }
    } else {
        updateStepsStatus(currentStep, STATUS_FAILED);
    }

    updateAnswer(questionId, resultText, "???", sparql, errors); //todo sparklis_request 

    //re-enable interactions (used as the condition to end the wait from tests)
    enableInputs(); 
}

const prompt_template = `
Your goal is to generate commands that query a knowledge graph to find answers to a given question.  
These commands will be used by Sparklis to generate SPARQL queries.

## Format:  
1. Always start by reasoning about what entities and relationships are needed. Wrap this in <think>...</think>.  
2. Translate this reasoning into structured commands, separated by semicolons (;), and wrap them in <commands>...</commands>.  

## Here are all the commands you can use:
- a [class] → Retrieve entities of a class (e.g., a person).  
- forwardProperty [property] → Filter by property (e.g., "forwardProperty director" to find films directed by someone).
- backwardProperty [property] of → Reverse relation (e.g., "backwardProperty director of" of to find directors of films).
- higherThan [value], lowerThan [value], between [v1] and [v2] → Value constraints where value, v1 and v2 are numbers.
- after [date], before [date] → Time constraints.  
- asc, desc → Sorting.  
- and, or, not → Logical operators.  
- up, down → Change the focus of the query.  

## Here are some examples:
Q: At which school went Yayoi Kusama?
A: <think>Starting from the list of entities named Yayoi Kusama seems the best approach. Then, I just need to find the relationship that represents at which school she was educated.</think>
<commands>Yayoi Kusama ; forwardProperty education</commands> 

Q: What is the boiling point of water?
A: <think>The core of the request is WATER. From this entity I will probably be able to get a property such as its BOILING POINT.</think>  
<commands>water; forwardProperty boiling</commands>  

Q: Movies by Spielberg or Tim Burton after 1980?
A: <think>I need to find FILMS by Spielberg or Burton released after 1980. I can start by listing FILMS and then filter by DIRECTOR and RELEASE DATE.</think> 
<commands>a film; forwardProperty director; Tim Burton; or; Spielberg; forwardProperty release date; after 1980</commands>  

Q: among the founders of tencent company, who has been member of national people' congress?"
A: <think>I can start by finding FOUNDERS of something called TENCENT. Then, I can filter by people who have been members of the NATIONAL PEOPLE'S CONGRESS.</think>
<commands>backwardProperty founder of ; Tencent ; forwardProperty position ; National People's Congress</commands>
`;
