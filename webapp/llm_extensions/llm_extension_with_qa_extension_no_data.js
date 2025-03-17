//Dependencies: qa_extension.js, llm_add_interface_extension.js, llm_utils.js, prompts.js
console.log("LLM with QA extension active");

// Enable or not extensions to the base flow
const HANDLE_FAILED_COMMANDS = false;
const CHECK_INCORRECT_RESULT = true;
const ALTER_CONSIDERED_INCORRECT = CHECK_INCORRECT_RESULT && true;

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
    currentStep = 0;
    updateStepsStatus(currentStep, STATUS_DONE);
    sparklis.home(); //reset sparklis
    let errors = "";
    //disable interactions with the llm input field (used as the condition to wait for the end of the process in tests)
    disableInputs();

    let systemMessage = commands_chain_system_prompt();
    let input_field = document.getElementById("user-input");
    let input_question = input_field.value;
    let qa = document.getElementById("qa"); // input field of the qa extension

    /////////// Extraction ///////////

    questionId = addLLMQuestion(input_question); //  Add a div in the interface to display the question and the answer
   
    let reasoningText = ""; //to keep reasoning text and be able to update it
    currentStep++;
    reasoningText += "- GENERATION 1 - system prompt: " + systemMessage + " - user input: " + input_question + " - ";
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
    //let output = 'blablabla<commands>a animal ; has family ; camelini;</commands>dsfsd';

    //get commands from regular expression <commands>...</commands>
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    let matchCommands = output.match(/<commands>(.*?)<\/commands>/s);

    let commands = matchCommands ? matchCommands[1].trim() : ""; // Safe access since we checked if matchCommands is not null
    
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

    //get remaining commands count
    // let remainingCommands = qa.value;
    // let remainingCommandsCount = countCommands(remainingCommands);
    // console.log("Remaining commands:", remainingCommandsCount);
    // let executedCommmandsCount = commandsCount - remainingCommandsCount;

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
                let system_message_alter = refine_query_system_prompt();
                let input_alter = data_input_prompt({
                    "question": input_question,
                    "sparql": sparql,
                    "result": truncated_results_text
                }, true);
                reasoningText += "- Query alteration - ";
                let output_alter = await sendPrompt(
                    usualPrompt(system_message_alter, input_alter), 
                    true, 
                    (text) => { 
                        updateReasoning(questionId, reasoningText + text);
                    } 
                );
                reasoningText += output_alter;
                //get the new request SPARQL from the response
                let matchCorrect = output_alter.match(/<query>(.*?)<\/query>/s);
                let correct = matchCorrect ? matchCorrect[1].trim() : "";

                //todo better tests and error handling
                if (correct != "") {
                    //update the sparql with the new request
                    sparql = correct; //todo tester avant
                    try {
                        //evaluate the new request
                        results = await getResultsWithLabels(sparql);
                        resultText = JSON.stringify(results.rows);
                    } catch (e) {
                        console.log("error results correction:", e);
                    }
                }
                updateStepsStatus(currentStep, STATUS_DONE);
            }
        }
    }

    //update reasoning one last time in case of for
    updateReasoning(questionId, reasoningText);
    //set the result in the answer field
    updateAnswer(questionId, resultText, "???", sparql, errors); //todo sparklis_request 

    //re-enable interactions (used as the condition to end the wait from tests)
    enableInputs(); 
}