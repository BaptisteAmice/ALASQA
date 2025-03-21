//Dependencies: qa_extension.js, llm_add_interface_extension.js, llm_utils.js, prompts.js
console.log("LLM any sytem extension loaded");

// If updated, also update the post-processing script 
var error_messages = [ //todo update pp
    "Empty LLM output",
    "Error: No match found in tags",
    "Warning: Commands failed to finish commands: ",
    "Error: error while evaluating SPARQL query",
    "Error: error while parsing SPARQL results",
    "Error: condition shouldn't have matched"
];
//todo update pp et implementation steps

const STATUS_NOT_STARTED = "Not started";
const STATUS_ONGOING = "ONGOING";
const STATUS_DONE = "DONE";
const STATUS_FAILED = "FAILED";

/**
 * Class to handle the logic of the LLM extension
 */
class LLMFramework {
    question;
    question_id;
    errors = "";
    reasoning_text = "";
    sparklis_nl = "";
    sparql = "";
    result_text = "";

    steps_status = {};

    constructor(question, question_id){
        this.question = question;
        this.question_id = question_id;
        this.insertNewStepStatus("Start", STATUS_NOT_STARTED);
    }

    /**
     * Insert a new step in the attribute steps_status.
     * @param {string} name 
     * @param {string} status 
     */
    insertNewStepStatus(name, status) {
        const step_index = Object.keys(this.steps_status).length.toString();
        this.steps_status[step_index] = { "Name" : name, "Status" : status };
        localStorage.setItem("steps_status", JSON.stringify(this.steps_status));
    }

    /**
     * Update the status of the current step in the attribute steps_status.
     * @param {number} step 
     * @param {string} status 
     */
    setCurrentStepStatus(status) {
        const step_index = (Object.keys(this.steps_status).length - 1).toString();
        this.steps_status[step_index]["Status"] = status
        localStorage.setItem("steps_status", JSON.stringify(this.steps_status));
    }


    /**
     * Get the status of the current step in the attribute steps_status.
     * @returns 
     */
    getCurrentStepStatus() {
        const step_index = (Object.keys(this.steps_status).length - 1).toString();
        return this.steps_status[step_index]["Status"];
    }

    /**
     * Get the current step in the steps_status attribute.
     * @returns
    */
    getCurrentStep() {
        return this.steps_status[(Object.keys(this.steps_status).length-1).toString()];
    }

    /**
     * Execute a asynchronous function with given parameters and update the status of the current step.
     * @param {*} func 
     * @param {string} name 
     * @param {*} params 
     * @returns 
     */
    async executeStep(func, name, params) {
        this.insertNewStepStatus(name, STATUS_ONGOING)
        const result  = await func(...params); // Execute the function with given parameters
        //change to done if not failed
        if (this.getCurrentStepStatus() == STATUS_ONGOING) {
            this.setCurrentStepStatus(STATUS_DONE) 
        }
        updateReasoning(this.question_id, this.reasoning_text); // Update the reasoning in the interface after each step
        return result;
    }
    
    /**
     * Answer the question by executing the logic of the extension.
     */
    async answerQuestion() {
        this.setCurrentStepStatus(STATUS_DONE)
        await this.answerQuestionLogic();
    }

    /**
     * Logic to answer the question. The functions corresponding to steps are called in this function.
     */
    async answerQuestionLogic() {
        throw new Error("Method 'answerQuestion()' must be implemented.");
    }
}

/**
 * Function to control the logic of the extension.
 */
async function qa_control() {
    /////////// Initialization ///////////
    clearAlerts(); // Clear alerts in the storage for each new question
    sparklis.home(); // we want to reset sparklis between different queries
    // disable interactions with the llm input field (used as the condition to wait for the end of the process in tests)
    disableInputs();

    let question = getInputQuestion();
    let question_id = addLLMQuestion(question); //  Add a div in the interface to display the question and the answer

    /////////// PROCESSING ///////////

    //the used framework type can be changed here
    let framework = new LLMFrameworkBooleanBySubquestions(question, question_id);
    await framework.answerQuestion();

    /////////// ENDING ///////////
    //update reasoning one last time in case of for
    updateReasoning(framework.question_id, framework.reasoning_text);
    //set the result in the answer field
    updateAnswer(framework.question_id, framework.result_text, framework.sparklis_nl, framework.sparql, framework.errors); //todo sparklis_request 
    //re-enable interactions (used as the condition to end the wait from tests)
    enableInputs(); 
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

/**
 * Function to call the LLM with a prompt and return the output.
 * @param {*} framework 
 * @param {*} system_input 
 * @param {*} system_input_name 
 * @param {*} user_input 
 * @returns 
 */
async function step_generation(framework, system_input, system_input_name, user_input) {
    console.log(framework)
    console.log(framework.getCurrentStep())
    framework.reasoning_text += "<br>" + framework.getCurrentStep()["Name"] + " - system prompt: " 
                                + system_input_name + " - user input: " + user_input + "<br>";

     let output = await sendPrompt(
        usualPrompt(system_input, user_input), 
        true, 
        (text) => { 
            updateReasoning(framework.question_id, framework.reasoning_text + text);
        }   
    );
    if (!output || output == "") {
        //step failed
        let message = error_messages[0] + system_input_name;
        console.log(message);
        framework.errors += message;
        framework.setCurrentStepStatus(STATUS_FAILED);
    }
    framework.reasoning_text += output;
    return output;                        
}

/**
 * Function to extract the content between tags in the LLM output.
 * @param {*} framework 
 * @param {*} llm_output 
 * @param {*} tag 
 * @returns 
 */
async function step_extract_tags(framework, llm_output, tag) {
    framework.reasoning_text += "<br>" + framework.getCurrentStep()["Name"] + " - tag: " + tag + "<br>";
    
    let matches = Array.from(llm_output.matchAll(new RegExp(`<${tag}>(.*?)<\/${tag}>`, "gs")));
    let match_output = matches.map(match => match[1].trim()).filter(text => text !== ""); // Remove empty strings

    if (match_output.length === 0) {
        let message = error_messages[1];
        console.log(message);
        framework.errors += message;
        // Step failed
        framework.setCurrentStepStatus(STATUS_FAILED);
    }
    return match_output;
}

/**
 * Function to execute commands of the QA extension.
 * @param {*} framework 
 * @param {*} commands 
 * @returns 
 */
async function step_execute_commands(framework, commands) {
    framework.reasoning_text += "<br>" + framework.getCurrentStep()["Name"] + " - commands: " + commands + "<br>";
    getQAInputField().value = commands;
    await process_question(getQAInputField())
        .then(() => { 
                console.log("All commands completed");
            }
        )
        .catch(async error => {
            let message = error_messages[2] + error;
            console.log(message);
            framework.errors  += message;
        }
    );
    //get sparklis results from the commands
    let place = sparklis.currentPlace();
    //wait for evaluation of the place
    await waitForEvaluation(place);
    return;
}

/**
 * Function to query the results of the SPARQL query and parse them.
 * @param {*} framework 
 * @param {*} place 
 * @returns 
 */
async function step_get_results(framework, place) {
    framework.reasoning_text += "<br>" + framework.getCurrentStep()["Name"] + "<br>";
    let sparql = place.sparql();
    let results;
    try { 
        sparql = removePrefixes(sparql); //todo temp patch because of wikidata endpoint for which the prefixes are duplicated when requested by the LLM (only difference is that the event is automatically activated)
        results = await getResultsWithLabels(sparql);
    } catch (e) {
        //catch error thrown by wikidata endpoint
        let message = error_messages[3];
        console.log(message, e);
        framework.errors += message;
        //step failed
        framework.setCurrentStepStatus(STATUS_FAILED);
    }

    let result_text = "";
    if (results && results.rows) {
        try {
            let rows = results.rows;
            result_text = JSON.stringify(rows);
            console.log("result", result_text);
        } catch (e) {
            let message = error_messages[4];
            console.log(message, e);
            framework.errors += message;
        }
    } else {
        //step failed
        framework.setCurrentStepStatus(STATUS_FAILED);
    }
    //update the attributes of the framework to retrieve them later
    framework.sparql = sparql;
    framework.result_text = result_text;

    //because getSentenceFromDiv() get the text in the interface, we have no guarantee it has been updated yet
    framework.sparklis_nl = getSentenceFromDiv(); //todo only a temporary solution
    return;
}

/**
 * Use a single interaction with the LLM to answer the question.
 * Execute in one time a series of commands to answer the question.
 */
class LLMFrameworkOneShot extends LLMFramework {
    async answerQuestionLogic() {
        // Call llm generation
        let output_llm = await this.executeStep(step_generation, "LLM generation", 
            [this, commands_chain_system_prompt(),"commands_chain_system_prompt", this.question]
        )
        // Extract the commands from the LLM output
        let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands",
             [this, output_llm, "commands"]
        );
        // Execute the commands, wait for place evaluation and get the results
        let extracted_commands = extracted_commands_list.at(-1) || "";
        await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
        let place = sparklis.currentPlace();
        await this.executeStep(step_get_results, "Get results", [this, place]);
    }
}

/**
 * Same as LLMFrameworkOneShot, but also checks if a boolean is expected for a result.
 * If a boolean is expected, call a second time the LLM to convert the query to a boolean query.
 */
class LLMFrameworkOneShotWithBooleanConv extends LLMFramework {
    async answerQuestionLogic() {
        //same as LLMFrameworkOneShot
        let output_llm = await this.executeStep(step_generation, "LLM generation 1", 
            [this, commands_chain_system_prompt(),"commands_chain_system_prompt", this.question]
        )
        let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands", [this, output_llm, "commands"]);
        let extracted_commands = extracted_commands_list.at(-1) || "";
        await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
        let place = sparklis.currentPlace();
        await this.executeStep(step_get_results, "Get results", [this, place]);

        //check if a boolean is expected for a result (only if the result isn't already a boolean)        if  (!resultText.includes("true") && !resultText.includes("false")) {
        if  (!this.result_text.includes("true") && !this.result_text.includes("false")) {
            let output_llm_boolean_expected = await this.executeStep(step_generation, "LLM generation 2", 
                [this, prompt_is_boolean_expected(),"prompt_is_boolean_expected", this.question]
            );
            let extracted_boolean_expected_list = await this.executeStep(step_extract_tags, "Extracted boolean expected", [this, output_llm_boolean_expected, "answer"]);
            let extracted_boolean_expected = extracted_boolean_expected_list.at(-1) || "";
            let boolean_expected = extracted_boolean_expected == "boolean" ? true : false;

            //if a boolean is expected, convert the query to a boolean query
            if (boolean_expected){
                let input = data_input_prompt({ "question": this.question, "sparql": this.sparql }, true);
                let output_llm_boolean_conv = await this.executeStep(step_generation, "LLM generation 3", 
                    [this, prompt_convert_query_to_boolean_query(),"prompt_convert_query_to_boolean_query", input]
                )
                let extracted_boolean_conv_list = await this.executeStep(step_extract_tags, "Extracted boolean conversion", [this, output_llm_boolean_conv, "query"]);
                let extracted_boolean_conv = extracted_boolean_conv_list.at(-1) || "";
                this.sparql = extracted_boolean_conv;
            }
        }
    }
}

class LLMFrameworkReact extends LLMFramework {
    //todo
}
class LLMFrameworkDirect extends LLMFramework {
    //todo
}
class LLMFrameworkSteps extends LLMFramework {
    //todo
}


class LLMFrameworkBooleanBySubquestions extends LLMFramework {
    async answerQuestionLogic() {
        // Get a list of necessary subquestions to reach the answer
        //Generation of the subquestions by the LLML
        let outputed_subquestions = await this.executeStep(step_generation, "LLM generation 1", 
            [this, prompt_get_subquestions(),"prompt_get_subquestions", this.question]
        );
        // Extract the subquestions from the LLM output
        let extracted_subquestions = await this.executeStep(step_extract_tags, "Extract subquestions", [this, outputed_subquestions, "subquestion"]);
        //Adapt the bahavior depending on the number of subquestions
        if (extracted_subquestions.length == 0) {
            //if we don't have a subquery we will execute the commands as is
            //for questions such as "What is the capital of France?"
            sparklis.home(); // we want to reset sparklis between different queries
            this.reasoning_text += "<br>No subquestion needed, executing the commands directly<br>";
            let output_commands_query = await this.executeStep(step_generation, "LLM generation", 
                [this, commands_chain_system_prompt(),"commands_chain_system_prompt", this.question]
            );
            let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands", [this, output_commands_query, "commands"]);
            let extracted_commands = extracted_commands_list.at(-1) || "";
            await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
            let place = sparklis.currentPlace();
            await this.executeStep(step_get_results, "Get results", [this, place]);
        } else if (extracted_subquestions.length > 0) {
            //if we have multiple subquestions we will execute them 
            // for questions such as "Were Angela Merkel and Tony Blair born in the same year?"
            this.reasoning_text += "<br>Subquestions needed, answering them first<br>";
            let subqueries = [];
            let subanswers = [];
            for (let subquestion of extracted_subquestions) {
                sparklis.home(); // we want to reset sparklis between different queries
                this.reasoning_text += "<br>Subquestion:<br>";
                let output_commands_subquestion = await this.executeStep(step_generation, "LLM generation", 
                    [this, commands_chain_system_prompt(),"commands_chain_system_prompt", subquestion]
                );
                let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands", [this, output_commands_subquestion, "commands"]);
                let extracted_commands = extracted_commands_list.at(-1) || "";
                await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
                let place = sparklis.currentPlace();
                await this.executeStep(step_get_results, "Get results", [this, place]);
                subqueries.push(this.sparql);
                subanswers.push(this.result_text);
                this.reasoning_text += "<br>Subquestion query:<br>" + this.sparql;
                this.reasoning_text += "<br>Subquestion result:<br>" + this.result_text;
            }
            //and then combine the results to generate a query answering the original question
            sparklis.home(); // we want to reset sparklis between different queries
            this.reasoning_text += "<br>Combining the results of the subquestions<br>";

            //make the input data for the comparison prompt
            let input_data_dict = { "question": this.question};
            for (let i = 0; i < subanswers.length; i++) {
                input_data_dict["subquery" + (i-1).toString()] = subqueries[i];
            }
            for (let i = 0; i < subanswers.length; i++) {
                input_data_dict["subanswer" + (i-1).toString()] = subanswers[i];
            }
            let input_comparison = data_input_prompt(input_data_dict, true);

            let output_combined = await this.executeStep(step_generation, "LLM generation", 
                [this, prompt_use_subquestions(),"prompt_use_subquestions", input_comparison]
            );
            let extracted_query_list = await this.executeStep(step_extract_tags, "Extracted commands", [this, output_combined, "query"]);
            let extracted_query = extracted_query_list.at(-1) || "";
            this.sparql = extracted_query;
            //todo to redo t'as get l'answer au lieu de la query....
        } else {
            //error
            let message = error_messages[5];
            console.log(message);
            this.errors += message;
            // Step failed
            this.setCurrentStepStatus(STATUS_FAILED);
        }
    }
}