//Dependencies: llm_add_interface_extension.js, llm_utils.js
console.log("LLM with QA extension active");

/////// Steps status ////////

STATUS_NOT_STARTED = "Not started";
STATUS_ONGOING = "ONGOING";
STATUS_DONE = "DONE";
STATUS_FAILED = "FAILED";

var steps_status = {
    "0" : { "Name" : "Start", "Status" : STATUS_NOT_STARTED },
    "1" : { "Name" : "LLM generation", "Status" : STATUS_NOT_STARTED },
    "2" : { "Name" : "Retrieving SPARQL", "Status" : STATUS_NOT_STARTED },
    "3" : { "Name" : "Evaluate SPARQL in Sparklis", "Status" : STATUS_NOT_STARTED },
    "4" : { "Name" : "Parsing res. for display", "Status" : STATUS_NOT_STARTED },
};

// If updated, also update the post-processing script
var error_messages = [
    "Error: No match found for <sparql>...</sparql>;",
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

/////// System ////////

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
async function qa_control() {
    /////////// Initialization ///////////
    resetStepsStatus(); // Reset steps for each new question
    clearAlerts(); // Clear alerts for each new question
    currentStep = 0;
    updateStepsStatus(currentStep, STATUS_DONE);
    sparklis.home(); //reset sparklis
    let errors = "";
    //disable interactions with the llm input field (used as the condition to wait for the end of the process in tests)
    disableInputs();

    let used_endpoint = sparklis.endpoint();
    let systemMessage = direct_qa_system_prompt(used_endpoint);
    let input_field = document.getElementById("user-input");
    let input_question =direct_qa_input_prompt(input_field.value);
    let qa = document.getElementById("qa"); // input field of the qa extension

    /////////// Extraction ///////////

    questionId = addLLMQuestion(input_question); //  Add a div in the interface to display the question and the answer
   
    let reasoningText = ""; //to keep reasoning text and be able to update it
    let reasoningTextStep = "";
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    let output = await sendPrompt(
        usualPrompt(systemMessage, input_question), 
        true, 
        (text) => { 
            reasoningTextStep = "- Generation 1 - " + text;
            updateReasoning(questionId, reasoningTextStep); // Capture `questionId` and send `text`
        } 
    );
    reasoningText += reasoningTextStep;

    if (reasoningText != "") {
        updateStepsStatus(currentStep, STATUS_DONE);
    } else {
        updateStepsStatus(currentStep, STATUS_FAILED);
    }

    //get the generated query
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    let matchQuery = output.match(/<sparql>(.*?)<\/sparql>/s);
    let query = matchQuery ? matchQuery[1].trim() : ""; // Safe access since we checked if matchCommands is not null
    
    if (query) {
        updateStepsStatus(currentStep, STATUS_DONE);
    } else {
        let message = error_messages[0];
        console.log(message);
        errors += message;
        updateStepsStatus(currentStep, STATUS_FAILED);
    }

    console.log("Query:", query);

    let results;
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    try { 
        sparql = removePrefixes(sparql); //todo temp patch because of wikidata endpoint for which the prefixes are duplicated when requested by the LLM (only difference is that the event is automatically activated)
        results = await getResultsWithLabels(sparql);
        updateStepsStatus(currentStep, STATUS_DONE);
    } catch (e) {
        //catch error thrown by wikidata endpoint
        let message = error_messages[1];
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
            let message = error_messages[2];
            console.log(message, e);
            errors += message;
            updateStepsStatus(currentStep, STATUS_FAILED);
        }
    } else {
        updateStepsStatus(currentStep, STATUS_FAILED);
    }

    //set the result in the answer field
    updateAnswer(questionId, resultText, "???", query, errors); //todo sparklis_request 

    //re-enable interactions (used as the condition to end the wait from tests)
    enableInputs(); 
}

