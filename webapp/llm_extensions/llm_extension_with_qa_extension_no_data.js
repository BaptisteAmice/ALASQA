//Dependencies: qa_extension.js, llm_add_interface_extension.js, llm_utils.js, prompts.js
console.log("LLM with QA extension active");

const STATUS_NOT_STARTED = "Not started";
const STATUS_ONGOING = "ONGOING";
const STATUS_DONE = "DONE";
const STATUS_FAILED = "FAILED";

// Enable or not extensions to the base flow
const BOOLEAN_RESULT_EXPECTED = true;
const HANDLE_FAILED_COMMANDS = false;
const CHECK_INCORRECT_RESULT = false;
const ALTER_CONSIDERED_INCORRECT = CHECK_INCORRECT_RESULT && false;

/////// Steps status ////////
var steps_status = {
    "0" : { "Name" : "Start", "Status" : STATUS_NOT_STARTED },
    "1" : { "Name" : "LLM generation (p1)", "Status" : STATUS_NOT_STARTED },
    "2" : { "Name" : "Retrieving cmds (p1)", "Status" : STATUS_NOT_STARTED },
    "3" : { "Name" : "QA extension cmds execution (p1)", "Status" : STATUS_NOT_STARTED },
    "4" : { "Name" : "Evaluate SPARQL in Sparklis (p1)", "Status" : STATUS_NOT_STARTED },
    "5" : { "Name" : "Parsing res. for display", "Status" : STATUS_NOT_STARTED },
};
if (CHECK_INCORRECT_RESULT) {
    steps_status["6"] = { "Name" : "Result verification", "Status" : STATUS_NOT_STARTED };
}
if (ALTER_CONSIDERED_INCORRECT) {
    steps_status["7"] = { "Name" : "Query alteration", "Status" : STATUS_NOT_STARTED };
}

// If updated, also update the post-processing script
var error_messages = [
    "Error: No match found for <commands>...</commands>;",
    "Warning: Commands failed to finish due to: ",
    "Error: error while evaluating SPARQL query",
    "Error: error while parsing SPARQL results",
];

/////// System ////////

//todo voir pour mieux decouper en fonctions et mieux sécuriser le flow
async function qa_control() {
    /////////// Initialization ///////////
    resetStepsStatus(); // Reset steps for each new question
    clearAlerts(); // Clear alerts for each new question
    sparklis.home(); //reset sparklis
    //disable interactions with the llm input field (used as the condition to wait for the end of the process in tests)
    disableInputs();
    currentStep = 0;
    updateStepsStatus(currentStep, STATUS_DONE);
    let errors = "";

    let input_question = getInputQuestion();

    /////////// Extraction ///////////

    questionId = addLLMQuestion(input_question); //  Add a div in the interface to display the question and the answer
   
    let reasoningText = ""; //to keep reasoning text and be able to update it
    currentStep++;
    let systemMessage = commands_chain_system_prompt();
    reasoningText += "- GENERATION 1 - system prompt: " + "commands_chain_system_prompt()" + " - user input: " + input_question + " - ";
    updateStepsStatus(currentStep, STATUS_ONGOING);
    let output = await sendPrompt(
        usualPrompt(systemMessage, input_question), 
        true, 
        (text) => { 
            updateReasoning(questionId, reasoningText + text);
        } 
    );
    reasoningText += output;

    if (output != "") {
        updateStepsStatus(currentStep, STATUS_DONE);
    } else {
        updateStepsStatus(currentStep, STATUS_FAILED);
    }

    //get commands from regular expression <commands>...</commands>
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    let matchCommands = output.match(/<commands>(.*?)<\/commands>/s);
    let commands = matchCommands ? matchCommands[1].trim() : ""; // Safe access since we checked if matchCommands is not null
    
    if (commands) {
        getQAInputField().value = commands;  // Safe access since we checked if commands is not null
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
    await process_question(getQAInputField())
        .then(() => { 
            console.log("All steps completed");
            updateStepsStatus(currentStep, STATUS_DONE);
            }
        )
        .catch(async error => {
            let message = error_messages[1] + error;
            console.log(message);
            errors += message;
            updateStepsStatus(currentStep, STATUS_FAILED);
            if (HANDLE_FAILED_COMMANDS){ //todo tester
                console.log("commands (failed)",commands);
                reasoningText = await failed_command(questionId, commands, error, input_question, reasoningText);
            }
        }
    );

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
        results = await getResultsWithLabels(sparql);
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

    let truncated_results_text = truncateResults(resultText, 5);

    //verify the result, does the llm think the answer is correct
    if (CHECK_INCORRECT_RESULT) { //todo re test
        currentStep++;
        updateStepsStatus(currentStep, STATUS_ONGOING);
        let result_considered_invalid;
        [result_considered_invalid, reasoningText] = await verify_incorrect_result(input_question, sparql, truncated_results_text, reasoningText);
        updateStepsStatus(currentStep, STATUS_DONE);

        if (ALTER_CONSIDERED_INCORRECT) {
            currentStep++;
            updateStepsStatus(currentStep, STATUS_ONGOING);
            //if the answer is incorrect, let the llm alter the query
            if (result_considered_invalid) { //todo finish and test
                console.log("The LLM considers the answer incorrect");
                [sparql, resultText, reasoningText] = await refine_query(questionId, input_question, sparql, truncated_results_text, reasoningText);
                updateStepsStatus(currentStep, STATUS_DONE);
            }
        }
    }

    if (BOOLEAN_RESULT_EXPECTED) {
        console.log(resultText);
        //test if the result isn't already a boolean, if it's not, we may want to convert it
        if  (!resultText.includes("true") && !resultText.includes("false")) {
            //test if the result should be a boolean
            [boolean_expected, reasoningText] = await is_boolean_expected(questionId, input_question, reasoningText);
            if (boolean_expected) {
                console.log("The result should probably be a boolean, we will try to convert it.");
                [sparql, resultText, reasoningText] = await boolean_conversion_by_llm(questionId, input_question, sparql, truncated_results_text, reasoningText);
            }
        }
    }

    /////////// ENDING ///////////
    //update reasoning one last time in case of for
    updateReasoning(questionId, reasoningText);
    //set the result in the answer field
    updateAnswer(questionId, resultText, "???", sparql, errors); //todo sparklis_request 

    //re-enable interactions (used as the condition to end the wait from tests)
    enableInputs(); 
}