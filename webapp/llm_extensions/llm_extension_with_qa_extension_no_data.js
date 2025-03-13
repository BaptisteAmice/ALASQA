//Dependencies: qa_extension.js, llm_add_interface_extension.js, llm_utils.js, prompts.js
console.log("LLM with QA extension active");

/////// Steps status ////////
var steps_status = {
    "0" : { "Name" : "Start", "Status" : STATUS_NOT_STARTED },
    "1" : { "Name" : "LLM generation (p1)", "Status" : STATUS_NOT_STARTED },
    "2" : { "Name" : "Retrieving cmds (p1)", "Status" : STATUS_NOT_STARTED },
    "3" : { "Name" : "QA extension cmds execution (p1)", "Status" : STATUS_NOT_STARTED },
    "4" : { "Name" : "Evaluate SPARQL in Sparklis (p1)", "Status" : STATUS_NOT_STARTED },
    "5" : { "Name" : "Parsing res. for display", "Status" : STATUS_NOT_STARTED },
    "6" : { "Name" : "Prompt verifier", "Status" : STATUS_NOT_STARTED },
};

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
    let input_question = q_a_input_prompt(input_field.value);
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

    //set the result in the answer field
    updateAnswer(questionId, resultText, "???", sparql, errors); //todo sparklis_request 

    //verify the result, does the llm think the answer is correct
    // currentStep++;
    // updateStepsStatus(currentStep, STATUS_ONGOING);
    // let result_considered_invalid;
    // [result_considered_invalid, reasoningText] = await verify_incorrect_result(input_question, sparql, resultText, reasoningText)
    // updateStepsStatus(currentStep, STATUS_DONE);

    // //if the answer is incorrect, let the llm alter the query
    // while (answer_is_incorrect) {
    //     //todo step pp
    //     //todo if not correct -> let the llm alter the query (not in no data version)
    //     console.log("The LLM considers the answer incorrect");
    //     let system_message_alter = "For the given question, an incorrect SPARQL query and its result are provided. Analyze them step by step, identify the mistake, and then provide a corrected SPARQL query inside <correction>...</correction>.";
    //     let input_alter = `
    //     <question>${input_question}</question>
    //     <sparql>${sparql}</sparql>
    //     <result>${resultText_verifier}</result>
    //     Let's think step by step.
    //     `;
    //     let output_alter = await sendPrompt(
    //         usualPrompt(system_message_alter, input_alter), 
    //         true, 
    //         (text) => { 
    //             reasoningTextStep = "- Prompt alteration - " + text;
    //             updateReasoning(questionId, reasoningText 
    //                 + reasoningTextStep); // Capture `questionId` and send `text`
                    
    //         } 
    //     );
    //     reasoningText += reasoningTextStep;
    //     //get the new request SPARQL from the response
    //     let matchCorrect = output_alter.match(/<correction>(.*?)<\/correction>/s);
    //     let correct = matchCorrect ? matchCorrect[1].trim() : "";
    //     console.log("correct", correct);
    //     if (correct != "") {
    //         //update the sparql with the new request
    //         sparql = correct; //todo tester avant
    //         try {
    //             results = await getResultsWithLabels(sparql);
    //         } catch (e) {

    //         }
    //         //todo test it and more
    //         //update the result in the answer field
    //         //updateAnswer(questionId, resultText, "???", sparql, errors); //todo sparklis_request 
    //     }
    //     answer_is_incorrect = false;
    // }

    //re-enable interactions (used as the condition to end the wait from tests)
    enableInputs(); 
}