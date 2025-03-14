//Dependencies: qa_extension.js, llm_add_interface_extension.js, llm_utils.js, prompts.js
console.log("LLM extension with QA extension steps loaded");

/////// Steps status ////////
var steps_status = {
    "0" : { "Name" : "Start", "Status" : STATUS_NOT_STARTED },
    "1" : { "Name" : "LLM generation (p1)", "Status" : STATUS_NOT_STARTED },
    "2" : { "Name" : "Retrieving cmds (p1)", "Status" : STATUS_NOT_STARTED },
    "3" : { "Name" : "QA extension cmds execution (p1)", "Status" : STATUS_NOT_STARTED },
    "4" : { "Name" : "Evaluate SPARQL in Sparklis (p1)", "Status" : STATUS_NOT_STARTED },
    "5" : { "Name" : "Parsing res. for display", "Status" : STATUS_NOT_STARTED },
};

// If updated, also update the post-processing script
var error_messages = [
    "Error: No match found for <command>...</command>;",
    "Warning: Commands failed to finish due to: ",
    "Error: error while evaluating SPARQL query",
    "Error: error while parsing SPARQL results",
];

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

    let systemMessage = first_command_system_prompt();
    let input_field = document.getElementById("user-input");
    let input_question = q_a_input_prompt(input_field.value);
    let qa_field = document.getElementById("qa"); // input field of the qa extension

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

    //get commands from regular expression <commands>...</commands>
    currentStep++;
    updateStepsStatus(currentStep, STATUS_ONGOING);
    let matchCommands = output.match(/<command>(.*?)<\/command>/s);

    let commands = matchCommands ? matchCommands[1].trim() : ""; // Safe access since we checked if matchCommands is not null
    
    if (commands) {
        qa_field.value = commands;  // Safe access since we checked if commands is not null
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
    await process_question(qa_field)
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
    let remainingCommands = qa_field.value;
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

    //todo step
    let next_action;
    do {
        let truncated_results_text = truncateResults(resultText, 3);
        reasoningText += "- Choosing action -";
        [next_action, reasoningText] = await choose_next_action(input_question, sparql, truncated_results_text, reasoningText);
        reasoningText += "- Starting action " + next_action + " - "; 
        console.log("Action:", next_action);
        switch (next_action) {
            case "done":
                break;
            case "process": //todo
                [sparql, resultText, reasoningText] = await refine_query(questionId, input_question, sparql, truncated_results_text, reasoningText);
                //sparklis can't take into account the new query, so we are done
                next_action = "done";
                break;
            case "add command": //todo
                [sparql, resultText, reasoningText] = await add_command(questionId, input_question, sparql, truncated_results_text, reasoningText, qa_field);
                break;
            default:
                console.error("Invalid next action " + next_action);
                //todo error log
                next_action = "done";
        }
    } while (next_action != "done")

    //set the result in the answer field
    updateAnswer(questionId, resultText, "???", sparql, errors); //todo sparklis_request 

    //re-enable interactions (used as the condition to end the wait from tests)
    enableInputs(); 
}

//todo tester et ameliorer
async function refine_query(questionId, question, sparql, results, reasoningText) { //todo catch error
    let reasoningTextStep = "";
    let output_refine = await sendPrompt(
        usualPrompt(refine_query_system_prompt(), refine_query_input_prompt(question, sparql, results)), 
        true, 
        (text) => { 
            reasoningTextStep = text;
            updateReasoning(questionId, reasoningTextStep); // Capture `questionId` and send `text`
        } 
    );
    reasoningText += reasoningTextStep;
    //get the new query
    let matchQuery = output.match(/<command>(.*?)<\/command>/s);
    let newQuery = matchQuery ? matchQuery[1].trim() : "";
    let newResults;
    //try the new query and get its results
    try { 
        newQuery = removePrefixes(newQuery);
        newResults = await getResultsWithLabels(newQuery);
    } catch (e) {
        //catch error thrown by wikidata endpoint
        console.error("refine_query failed", e);
        //If the new query fails, we keep the old one
        newQuery = sparql;
        newResults = results;
    }
    return  [new_query, new_results, reasoningText];
}

//todo tester et ameliorer
async function add_command(questionId, question, sparql, results, reasoningText, qa_field) {
    let reasoningTextStep = "";
    let output_add_command = await sendPrompt(
        usualPrompt(following_command_system_prompt(), following_command_input_prompt(question, sparql, results)), 
        true, 
        (text) => { 
            reasoningTextStep = text;
            updateReasoning(questionId, reasoningTextStep); // Capture `questionId` and send `text`
        } 
    );
    reasoningText += reasoningTextStep;
    //get the new command
    let matchCommand = output_add_command.match(/<command>(.*?)<\/command>/s);
    let newCommand = matchCommand ? matchCommand[1].trim() : "";

    //set the new command in the qa field
    qa_field.value = newCommand;

    //execute the new command
    await process_question(qa_field);
    
    //wait for evaluation of the place
    let newPlace = sparklis.currentPlace();
    await waitForEvaluation(newPlace);

    //get the new results
    let newSparql = newPlace.sparql();
    let newResults;
    try {
        newSparql = removePrefixes(newSparql);
        newResults = await getResultsWithLabels(newSparql);
    } catch (e) {
        //catch error thrown by wikidata endpoint
        console.error("add_command failed", e);
        //If the new command fails, we keep the old results
        newSparql = sparql;
        newResults = results; 
    }
    return [newSparql, newResults, reasoningText];
}