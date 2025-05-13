//Dependencies: qa_extension.js, llm_add_interface_extension.js, llm_utils.js, prompts.js
console.log("LLM any sytem extension loaded");

// This bus is used to communicate between the LLM extension and the QA extension 
//it allows to make synchronous calls between the two extensions
const bus = new EventTarget();

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

// List of available LLM frameworks
window.LLMFrameworks = [];

/**
 * Class to handle the logic of the LLM extension
 */
class LLMFramework {
    /**
     * 
     * @param {str} question - question to answer
     * @param {*} question_id - id of the question div in the interface
     * @param {str|null} select_sugg_logic - logic to select suggestions in the qa extension
     */
    constructor(question, question_id, select_sugg_logic = null){
        this.errors = "";
        this.reasoning_text = "";
        this.sparklis_nl = "";
        this.sparql = "";
        this.result_text = "";
    
        this.steps_status = {};    
        this.sparql_query_limit_number = null;
        this.sparql_query_offset_number = null;
        this.order_date = false;
        this.group_by_action = null;

        this.question = question;
        this.question_id = question_id;
        this.insertNewStepStatus("Start", STATUS_NOT_STARTED);
        this.select_sugg_logic = select_sugg_logic;

        this.handleLimit = this.handleLimit.bind(this); // Bind the method to the class instance. JS needs it apparently.
        bus.addEventListener('limit', this.handleLimit);

        this.handleOffset = this.handleOffset.bind(this); // Bind the method to the class instance. JS needs it apparently.
        bus.addEventListener('offset', this.handleOffset);

        this.handleTermCmdBackup = this.handleOffset.bind(this); // Bind the method to the class instance. JS needs it apparently.
        bus.addEventListener('term_cmd_backup', this.handleTermCmdBackup);

        this.handleOrderDate = this.handleOrderDate.bind(this); // Bind the method to the class instance. JS needs it apparently.
        bus.addEventListener('order_date', this.handleOrderDate);

        this.handleGroupbyAction = this.handleGroupbyAction.bind(this); // Bind the method to the class instance. JS needs it apparently.
        bus.addEventListener('groupby_action', this.handleGroupbyAction);
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
        // set the starting step to done
        this.setCurrentStepStatus(STATUS_DONE)
        // change the logic of the suggestions for the qa extension
        window.select_sugg_logic = this.select_sugg_logic;
        // call the system logic to answer the question
        await this.answerQuestionLogic();
        // reset the logic of the suggestions for the qa extension
        window.select_sugg_logic = null;
    }

    /**
     * Logic to answer the question. The functions corresponding to steps are called in this function.
     */
    async answerQuestionLogic() {
        throw new Error("Method 'answerQuestion()' must be implemented.");
    }

    handleLimit(event) {
        const { limit_number } = event.detail;
        console.log(`Handling limit task with limit = ${limit_number}`);
        this.sparql_query_limit_number = limit_number;
    }
    handleOffset(event) {
        const { offset_number } = event.detail;
        console.log(`Handling offset task with offset = ${offset_number}`);
        this.sparql_query_offset_number = offset_number;
    }

    handleTermCmdBackup(event) {
        const { message } = event.detail;
        this.reasoning_text += "<br>" + message + "<br>";
        this.errors += "Warning:" + message + ";";
    }

    handleOrderDate(event) {
        console.log(`Handling order date task.`);
        this.order_date = true;
    }

    handleGroupbyAction(event) {
        console.log(`Handling group by action.`);
        const { action } = event.detail;
        this.group_by_action = action;
    }

    resetQueryAlterationsVariables() {
        this.sparql_query_limit_number = null;
        this.sparql_query_offset_number = null;
        this.order_date = false;
        this.group_by_action = null;
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

    //the used framework type is inferred by the dropdown value (could also force a specific class here)
    // Get the selected value
    let dropdown = document.getElementById("system-dropdown");
    let selectedClassName = dropdown.value; // Example: "LLMFrameworkBooleanBySubquestions"

    let framework = null;
    // Select the class corresponding to the selected value (only if available)
    if (window[selectedClassName]) {
        framework = new window[selectedClassName](question, question_id);
        // Execute the logic of the extension
        await framework.answerQuestion();
    } else {
        console.error(selectedClassName + " is not a valid system class, using LLMFrameworkOneShotby default");
        framework = new LLMFrameworkOneShot(question, question_id);
        framework.errors += selectedClassName + " is not a valid system class";
    }

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
            let qa_field = getQAInputField();
            let qa_value = qa_field.value;
            //the first remaining command is the one that failed
            let first_remaining_command = qa_value.split(";")[0] || "";
            let message = error_messages[2] + error
            + ` (failed command:${first_remaining_command})`;
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
 * Function to remove the LIMIT clause from the query (only for a given limit number).
 * We don't want to remove a limit number that is not the one we are looking for (could be the result of previous commands).
 * @param {*} framework 
 * @param {*} query 
 * @param {*} limit 
 * @returns 
 */
function step_remove_limit(framework, query, limit) {
    framework.reasoning_text += "<br>Removing LIMIT " + limit + "<br>";
    const regex = new RegExp(`\\bLIMIT\\s+${limit}\\b`, 'i');
    return query.replace(regex, '').trim();
}

/**
 * Function to add a LIMIT clause to the query (or change it if it already exists).
 * @param {*} framework 
 * @param {*} query 
 * @param {*} limit 
 * @returns 
 */
function step_change_or_add_limit(framework, query, limit) {
    console.log("Query before limit change: ", query);
    framework.reasoning_text += "<br>Adding LIMIT " + limit + "<br>";
    
    // Remove existing LIMIT clause (case-insensitive)
    const queryWithoutLimit = query.replace(/LIMIT\s+\d+/i, '').trim();
    
    // Ensure there's a newline before appending LIMIT
    const updatedQuery = `${queryWithoutLimit}\nLIMIT ${limit}`;
    
    return updatedQuery;
}

function step_group_by_and_count(framework, query) {
    framework.reasoning_text += "<br>Modifying query to group by and count<br>";

    if (!query) {
        console.warn("Query is empty or undefined.");
        return query; // Return the original query if it's empty or undefined
    }

    const prefixSection = query.match(/^(PREFIX[\s\S]*?)SELECT/i)?.[1] || '';
    const selectVars = query.match(/SELECT\s+DISTINCT\s+(.*?)\s+WHERE/i)?.[1]?.trim().split(/\s+/) || [];
    const whereMatch = query.match(/WHERE\s*{([\s\S]*?)}/i);
    const limitMatch = query.match(/LIMIT\s+\d+/i)?.[0] || '';
  
    if (!whereMatch) return query;
  
    const whereContent = whereMatch[1].trim();
    const triples = whereContent.split('.').map(t => t.trim()).filter(Boolean);
  
    const lastTriple = triples[triples.length - 1];
    const tripleMatch = lastTriple.match(/(\?\w+)\s+[^\s]+\s+(?:\[.*?(\?\w+).*?\]|(\?\w+))/);
    if (!tripleMatch) return query;
  
    const subjectVar = tripleMatch[1];
    const groupByVars = [...new Set(selectVars.filter(v => v !== subjectVar))];
  
    const newSelect = [
      ...groupByVars,
      `(COUNT(DISTINCT ${subjectVar}) AS ?count)`
    ].join(' ');
  
    const groupByClause = groupByVars.length ? `GROUP BY ${groupByVars.join(' ')}` : '';
  
    // Handle ORDER BY direction
    let newOrderByClause = '';
    const orderMatch = query.match(/ORDER\s+BY\s+(ASC|DESC)?\s*\((?:[^\)]+)\)/i);
    if (orderMatch) {
      const direction = orderMatch[1]?.toUpperCase() || ''; // ASC or DESC
      newOrderByClause = direction ? `ORDER BY ${direction}(COUNT(DISTINCT ${subjectVar}))` : `ORDER BY ?count`;
    }
  
    return `
  ${prefixSection.trim()}
  SELECT DISTINCT ${newSelect}
  WHERE {
    ${triples.map(t => `  ${t} .`).join('\n')}
  }
  ${groupByClause}
  ${newOrderByClause}
  ${limitMatch}
  `.trim();
}  

/**
 * Function to add an OFFSET clause to the query (or change it if it already exists).
 * The OFFSET clause will appear before the LIMIT clause if one exists.
 * @param {*} framework 
 * @param {*} query 
 * @param {*} offset 
 */
function step_change_or_add_offset(framework, query, offset) {
    console.log("Query before offset change: ", query);
    framework.reasoning_text += "<br>Adding OFFSET " + offset + "<br>";

    // Remove existing OFFSET clause (case-insensitive)
    let queryWithoutOffset = query.replace(/OFFSET\s+\d+/i, '').trim();

    // Check if there's a LIMIT clause
    const limitMatch = queryWithoutOffset.match(/LIMIT\s+\d+/i);
    
    let updatedQuery;
    if (limitMatch) {
        // Insert OFFSET before LIMIT
        const limitStart = limitMatch.index;
        updatedQuery = 
            queryWithoutOffset.slice(0, limitStart).trim() +
            `\nOFFSET ${offset}\n` +
            queryWithoutOffset.slice(limitStart).trim();
    } else {
        // Append OFFSET at the end
        updatedQuery = `${queryWithoutOffset}\nOFFSET ${offset}`;
    }

    return updatedQuery;
}

function step_change_order_type_to_date(framework, query) {
    framework.reasoning_text += "<br>Changing order type to date<br>";

    //look for ORDER BY ASC(xsd:???(???)) or ORDER BY DESC(xsd:???(???))
    const orderRegex = /ORDER\s+BY\s+(ASC|DESC)\s*\(\s*([^\s]+)\s*\(\s*([^\s]+)\s*\)\s*\)/i;
    const orderMatch = query.match(orderRegex);

    // If no match is found, return the original query
    if (!orderMatch) return query;

    // Change the type to xsd:date in the order clause of the query
    const orderType = orderMatch[2].replace(/xsd:\w+/i, "xsd:date");
    const orderVar = orderMatch[3];
    const orderDirection = orderMatch[1].toUpperCase(); // ASC or DESC


    const updatedOrder = `ORDER BY ${orderDirection}(${orderType}(${orderVar}))`;
    const updatedQuery = query.replace(orderRegex, updatedOrder);

    return updatedQuery;
}

function step_remove_ordering_var_from_select(framework, query) {
    framework.reasoning_text += "<br>Removing ordering variable from SELECT<br>";
    const selectRegex = /SELECT\s+(DISTINCT\s+)?([^\n\r{]+)/i;
    const orderRegex = /ORDER\s+BY\s+([^\n\r]+)/i;

    const selectMatch = query.match(selectRegex);
    const orderMatch = query.match(orderRegex);

    if (!selectMatch || !orderMatch) return query;

    const fullSelect = selectMatch[0];
    const selectVarsRaw = selectMatch[2].trim();

    const orderExpr = orderMatch[1];
    const varMatch = orderExpr.match(/\?[\w\d_]+/g);
    if (!varMatch || varMatch.length === 0) return query;

    const orderingVar = varMatch[0];

    // Split the SELECT clause by spaces, preserving COUNT expressions
    // This regex captures:
    // - Aggregates like COUNT(?var) AS ?count or COUNT(DISTINCT ?var) AS ?count
    // - Simple variables like ?s ?p ?o
    const selectParts = Array.from(selectVarsRaw.matchAll(/(COUNT\s*\(.*?\)\s+AS\s+\?\w+|\?\w+)/gi)).map(m => m[0]);

    // If only one variable/expression is selected, we don't remove it
    if (selectParts.length <= 1) return query;

    // Check if ordering var comes from an aggregate alias
    let replacedInOrderBy = false;
    let newOrderExpr = orderExpr;
    const updatedSelectParts = selectParts.filter(part => {
        const aliasMatch = part.match(/(COUNT\s*\(.*?\))\s+AS\s+(\?\w+)/i);
        if (aliasMatch && aliasMatch[2] === orderingVar) {
            // Replace ?alias in ORDER BY with the actual expression
            newOrderExpr = orderExpr.replace(orderingVar, aliasMatch[1]);
            replacedInOrderBy = true;
            return false; // remove from SELECT
        }
        return !part.includes(orderingVar);
    });

    if (updatedSelectParts.length === selectParts.length) return query; // Nothing removed

    const updatedSelect = `SELECT ${selectMatch[1] || ''}${updatedSelectParts.join(' ')}`;
    query = query.replace(fullSelect, updatedSelect);

    if (replacedInOrderBy) {
        const fullOrder = orderMatch[0];
        const updatedOrder = `ORDER BY ${newOrderExpr}`;
        query = query.replace(fullOrder, updatedOrder);
    }

    return query;
}



/**
 * Function to query the results of the SPARQL query and parse them.
 * @param {*} framework 
 * @param {*} place 
 * @returns 
 */
async function step_get_results(framework, place, overidding_sparql = null) {
    framework.reasoning_text += "<br>" + framework.getCurrentStep()["Name"] + "<br>";
    let sparql;
    //if a query is given, we use it instead of the one from the place
    if (overidding_sparql) {
        sparql = overidding_sparql;
    } else {
        sparql = place.sparql();
    }
    let results;
    try { 
        results = await getQueryResults(sparql);
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
class LLMFrameworkOneShotImproved extends LLMFramework {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() {
        // Call llm generation
        let output_llm = await this.executeStep(step_generation, "LLM generation", 
            [this, commands_chain_system_prompt_v2(),"commands_chain_system_prompt_v2", this.question]
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
window.LLMFrameworkOneShotImproved = LLMFrameworkOneShotImproved; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkOneShotImproved.name); //to be able to access the class name


class LLMFrameworkTheMost extends LLMFramework {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() {
        // Call llm generation
        let output_llm = await this.executeStep(step_generation, "LLM generation", 
            [this, commands_chain_system_prompt_the_most(),"commands_chain_system_prompt_the_most", this.question]
        );
        // Extract the commands from the LLM output
        let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands",
             [this, output_llm, "commands"]
        );
        // Execute the commands, wait for place evaluation and get the results
        let extracted_commands = extracted_commands_list.at(-1) || "";
        await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
        
        //if the sparql query limit number is set, change the limit clause in the query
        let place = sparklis.currentPlace();
        this.sparql = place.sparql();
        if (this.sparql_query_limit_number) {
            //execute step
            this.sparql = await this.executeStep(step_change_or_add_limit, "Add/change limit", [this, this.sparql, this.sparql_query_limit_number]);
            //remove the ordering variable from the select clause
            this.sparql = await this.executeStep(step_remove_ordering_var_from_select, "Remove ordering variable from select", [this, this.sparql]);
        }
        if (this.sparql_query_offset_number) {
            //execute step
            this.sparql = await this.executeStep(step_change_or_add_offset, "Add/change offset", [this, this.sparql, this.sparql_query_offset_number]);
        }
        await this.executeStep(step_get_results, "Get results", [this, place, this.sparql]);
    }
}
window.LLMFrameworkTheMost = LLMFrameworkTheMost; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkTheMost.name); //to be able to access the class name

class LLMFrameworkTheMostImproved extends LLMFramework {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() {
        // Call llm generation
        let output_llm = await this.executeStep(step_generation, "LLM generation", 
            [this, commands_chain_system_prompt_the_most_improved(),"commands_chain_system_prompt_the_most_improved", this.question]
        );
        // Extract the commands from the LLM output
        let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands",
             [this, output_llm, "commands"]
        );
        // Execute the commands, wait for place evaluation and get the results
        let extracted_commands = extracted_commands_list.at(-1) || "";
        await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
        
        //get the current sparql query from the place
        let place = sparklis.currentPlace();
        this.sparql = place.sparql();

        //if an action for group by is defined modify the query (done before step_remove_ordering_var_from_select)
        if (this.group_by_action) {
            this.sparql = await this.executeStep(step_group_by_and_count, "Group by and count", [this, this.sparql]);
        }
        //if the sparql query limit number is set, change the limit clause in the query
        if (this.sparql_query_limit_number) {
            //execute step
            this.sparql = await this.executeStep(step_change_or_add_limit, "Add/change limit", [this, this.sparql, this.sparql_query_limit_number]);
            //remove the ordering variable from the select clause
            this.sparql = await this.executeStep(step_remove_ordering_var_from_select, "Remove ordering variable from select", [this, this.sparql]);
        }
        if (this.sparql_query_offset_number) {
            this.sparql = await this.executeStep(step_change_or_add_offset, "Add/change offset", [this, this.sparql, this.sparql_query_offset_number]);
        }
        if (this.order_date) {
            this.sparql = await this.executeStep(step_change_order_type_to_date, "Change order type to date", [this, this.sparql]);
        }
        console.log("sparql after modification", this.sparql);
        await this.executeStep(step_get_results, "Get results", [this, place, this.sparql]);
    }
}
window.LLMFrameworkTheMostImproved = LLMFrameworkTheMostImproved; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkTheMostImproved.name); //to be able to access the class name

class LLMFrameworkText2Sparql extends LLMFramework {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() {
        const startTime = performance.now();
        ////////////////////////// GET QUESTION TYPE
        let endpoint_is_corporate = getEndpointFamily() == "corporate";
        let extracted_type = "tocheck";
        if (!endpoint_is_corporate) { //we won't use llm knowledge if we are in a corporate endpoint
            //we will test number_bool_tests times that the expected result is a boolean
            let max_number_bool_tests = 2;
            let current_number_bool_tests = 0;
            while (current_number_bool_tests < max_number_bool_tests 
                && (extracted_type == "tocheck" || extracted_type == "boolean")) {
                    this.reasoning_text += "<br>Try to get the question type (" + current_number_bool_tests + ")<br>";
                // Call llm generation
                let output_llm_type = await this.executeStep(step_generation, "LLM generation", 
                    [this, prompt_is_boolean_expected(),"prompt_is_boolean_expected", question_user_prompt(this.question)]
                )
                // Extract the commands from the LLM output
                let extracted_type_list = await this.executeStep(step_extract_tags, "Extracted question type",
                    [this, output_llm_type, "answer"]
                );
                // Execute the commands, wait for place evaluation and get the results
                extracted_type = extracted_type_list.at(-1) || "";
                current_number_bool_tests++;
            }
        }
        //////////////////////////// IF BOOLEAN QUESTION JUST USE THE LLM
        if (!endpoint_is_corporate && extracted_type == "boolean") {
            //todo try it several times
            let output = await this.executeStep(step_generation, "LLM generation", 
                [this, direct_boolean_answering_prompt(),"direct_boolean_answering_prompt", this.question]
            );
            let extracted_bool_list = await this.executeStep(step_extract_tags, "Extracted SPARQL", [this, output, "answer"]);
            let extracted_bool = extracted_bool_list.at(-1) || "";
            let bool_query = "";

            //make a query always true or false depending on the answer of the LLM
            //the response is based on the LLM knowledge anyway, so it won't be persistent
            if (extracted_bool == "true") {
                bool_query = "ASK WHERE {}";
            } else {
                bool_query = "ASK WHERE { BIND(false AS ?x) FILTER(?x) }";
            } 
            this.sparql = bool_query;
        } else {
            ////////////////////////// TRY ANSWERING WITH SPARKLIS
            let got_a_response = false;
            let elapsedTime = (performance.now() - startTime) / 1000; // time in seconds
            let i = 1;
            while (!got_a_response && elapsedTime < (8 * 60)) {
                console.log("elapsed time", elapsedTime);
                this.reasoning_text += "<br>Try " + i + "<br>";
                // Call llm generation
                let output_llm = await this.executeStep(step_generation, "LLM generation", 
                    [this, commands_chain_system_prompt_the_most_improved(),"commands_chain_system_prompt_the_most_improved", this.question]
                );
                // Extract the commands from the LLM output
                let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands",
                    [this, output_llm, "commands"]
                );
                // Execute the commands, wait for place evaluation and get the results
                let extracted_commands = extracted_commands_list.at(-1) || "";
                await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
                
                //get the current sparql query from the place
                let place = sparklis.currentPlace();
                this.sparql = place.sparql();

                //if an action for group by is defined modify the query (done before step_remove_ordering_var_from_select)
                if (this.group_by_action) {
                    this.sparql = await this.executeStep(step_group_by_and_count, "Group by and count", [this, this.sparql]);
                }
                //if the sparql query limit number is set, change the limit clause in the query
                if (this.sparql_query_limit_number) {
                    //execute step
                    this.sparql = await this.executeStep(step_change_or_add_limit, "Add/change limit", [this, this.sparql, this.sparql_query_limit_number]);
                    //remove the ordering variable from the select clause
                    this.sparql = await this.executeStep(step_remove_ordering_var_from_select, "Remove ordering variable from select", [this, this.sparql]);
                }
                if (this.sparql_query_offset_number) {
                    this.sparql = await this.executeStep(step_change_or_add_offset, "Add/change offset", [this, this.sparql, this.sparql_query_offset_number]);
                }
                if (this.order_date) {
                    this.sparql = await this.executeStep(step_change_order_type_to_date, "Change order type to date", [this, this.sparql]);
                }
                console.log("sparql after modification", this.sparql);

                //only wait for the results if the query is not empty
                let results_array = [];
                if (this.sparql != "" && this.sparql != undefined && this.sparql != null) {
                    await this.executeStep(step_get_results, "Get results", [this, place, this.sparql]);
                    try {//todo mieux gérer cas où resulttext est vide
                        results_array = JSON.parse(this.result_text);
                    } catch (e) {
                        results_array = [];
                    }
                }

                //reset the variables to avoid side effects for the next queries
                this.resetQueryAlterationsVariables();

                //got a response if the query is not empty and has a response
                got_a_response = (this.sparql != "" && this.sparql != undefined && this.sparql != null)
                                && (this.result_text != "" && this.result_text != undefined && this.result_text != null
                                && results_array.length > 0);
                elapsedTime = (performance.now() - startTime) / 1000; 
                console.log("result text a", this.result_text);
                i++;
            }

            ////////////////////////// LAST TRY TO SAVE THE RESPONSE
            if (!got_a_response) {
                //todo
            }
        }      
    }
}
window.LLMFrameworkText2Sparql = LLMFrameworkText2Sparql; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkText2Sparql.name); //to be able to access the class name


class LLMFrameworkRetryWithoutTimeout extends LLMFramework {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() {
        ////////////////////////// GET QUESTION TYPE
        let endpoint_is_corporate = getEndpointFamily() == "corporate";
        let expected_response_type = "tocheck";

        //we will test number_bool_tests times that the expected result is a boolean
        const max_number_bool_tests = 2;
        let current_number_bool_tests = 0;
        while (current_number_bool_tests < max_number_bool_tests 
            && (expected_response_type == "tocheck" || expected_response_type == "boolean")) {
                this.reasoning_text += "<br>Try to get the question type (" + current_number_bool_tests + ")<br>";
            // Call llm generation
            let output_llm_type = await this.executeStep(step_generation, "LLM generation", 
                [this, prompt_is_boolean_expected(),"prompt_is_boolean_expected", question_user_prompt(this.question)]
            )
            // Extract the commands from the LLM output
            let expected_response_type_list = await this.executeStep(step_extract_tags, "Extracted question type",
                [this, output_llm_type, "answer"]
            );
            // Execute the commands, wait for place evaluation and get the results
            expected_response_type = expected_response_type_list.at(-1) || "";
            current_number_bool_tests++;
        }


        ////////////////////////// TRY ANSWERING WITH SPARKLIS
        let i = 1;
        let number_of_same_response_expected = 3;
        let got_number_of_same_response_expected = false;
        let valid_responses_queries = [];
        let valid_responses_results = [];
        while (!got_number_of_same_response_expected) {
            console.log("elapsed time", elapsedTime);
            this.reasoning_text += "<br>Try " + i + "<br>";
            // Call llm generation
            let output_llm = await this.executeStep(step_generation, "LLM generation", 
                [this, commands_chain_system_prompt_the_most_improved(),"commands_chain_system_prompt_the_most_improved", this.question]
            );
            // Extract the commands from the LLM output
            let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands",
                [this, output_llm, "commands"]
            );
            // Execute the commands, wait for place evaluation and get the results
            let extracted_commands = extracted_commands_list.at(-1) || "";
            await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
            
            //get the current sparql query from the place
            let place = sparklis.currentPlace();
            this.sparql = place.sparql();

            //if an action for group by is defined modify the query (done before step_remove_ordering_var_from_select)
            if (this.group_by_action) {
                this.sparql = await this.executeStep(step_group_by_and_count, "Group by and count", [this, this.sparql]);
            }
            //if the sparql query limit number is set, change the limit clause in the query
            if (this.sparql_query_limit_number) {
                //execute step
                this.sparql = await this.executeStep(step_change_or_add_limit, "Add/change limit", [this, this.sparql, this.sparql_query_limit_number]);
                //remove the ordering variable from the select clause
                this.sparql = await this.executeStep(step_remove_ordering_var_from_select, "Remove ordering variable from select", [this, this.sparql]);
            }
            if (this.sparql_query_offset_number) {
                this.sparql = await this.executeStep(step_change_or_add_offset, "Add/change offset", [this, this.sparql, this.sparql_query_offset_number]);
            }
            if (this.order_date) {
                this.sparql = await this.executeStep(step_change_order_type_to_date, "Change order type to date", [this, this.sparql]);
            }
            console.log("sparql after modification", this.sparql);

            //only wait for the results if the query is not empty
            let results_array = [];
            if (this.sparql != "" && this.sparql != undefined && this.sparql != null) {
                await this.executeStep(step_get_results, "Get results", [this, place, this.sparql]);
                try {//todo mieux gérer cas où resulttext est vide
                    results_array = JSON.parse(this.result_text);
                } catch (e) {
                    results_array = [];
                }
            }

            //reset the variables to avoid side effects for the next queries
            this.resetQueryAlterationsVariables();

            //got a response if the query is not empty and has a response
            let got_a_response = (this.sparql != "" && this.sparql != undefined && this.sparql != null)
                            && (this.result_text != "" && this.result_text != undefined && this.result_text != null
                            && results_array.length > 0);
            console.log("result text", this.result_text);

            if (got_a_response) {
                //add to valid_responses
                valid_responses_queries.push(this.sparql);
                valid_responses_results.push(this.result_text);

                if (valid_responses_queries.length >= number_of_same_response_expected) {
                    //test if we have number_of_same_response_expected times the same query in valid_responses_queries
                    //if it's the case, put it as the sparql query of the framework
                    let query_count = valid_responses_queries.reduce((acc, query) => {
                        acc[query] = (acc[query] || 0) + 1;
                        return acc;
                    }
                    , {});
                    let query_found = Object.keys(query_count).find(key => query_count[key] >= number_of_same_response_expected);
                    if (query_found) {
                        this.sparql = query_found;
                        got_number_of_same_response_expected = true;
                    }

                    //if we don't have the same number of query, we can also check the results (and keep the query with the same id as one of the results)
                    if (!got_number_of_same_response_expected) {
                        let result_count = valid_responses_results.reduce((acc, result) => {
                            acc[result] = (acc[result] || 0) + 1;
                            return acc;
                        }
                        , {});
                        let result_found = Object.keys(result_count).find(key => result_count[key] >= number_of_same_response_expected);
                        if (result_found) {
                            // get the query that corresponds to the result
                            let query_found = valid_responses_queries[valid_responses_results.indexOf(result_found)];
                            this.sparql = query_found;
                            got_number_of_same_response_expected = true;
                        }
                    }
                }
            }
            i++;
        }

        let sparklis_response_is_boolean = false; //todo check if the response is boolean

        //if the expected type is a boolean, and the response from sparklis isn't a boolean, we will directly use the LLM to answer the question
        if (expected_response_type == "boolean" && !sparklis_response_is_boolean) {
            let number_of_same_boolean_response_needed = 2;
            //todo try several times
             let output_bool = await this.executeStep(step_generation, "LLM generation", 
                [this, direct_boolean_answering_prompt(),"direct_boolean_answering_prompt", this.question]
            );
            let extracted_bool_list = await this.executeStep(step_extract_tags, "Extracted SPARQL", [this, output_bool, "answer"]);
            let extracted_bool = extracted_bool_list.at(-1) || "";
            let bool_query = "";

            //make a query always true or false depending on the answer of the LLM
            //the response is based on the LLM knowledge anyway, so it won't be persistent
            if (extracted_bool == "true") {
                bool_query = "ASK WHERE {}";
            } else {
                bool_query = "ASK WHERE { BIND(false AS ?x) FILTER(?x) }";
            } 
            this.sparql = bool_query;
        }      
    }
}
window.LLMFrameworkRetryWithoutTimeout = LLMFrameworkRetryWithoutTimeout; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkRetryWithoutTimeout.name); //to be able to access the class name


class PassCommands extends LLMFramework {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() {
        let extracted_commands = this.question;
        await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
        
        //get the current sparql query from the place
        let place = sparklis.currentPlace();
        this.sparql = place.sparql();

        //if an action for group by is defined modify the query (done before step_remove_ordering_var_from_select)
        if (this.group_by_action) {
            this.sparql = await this.executeStep(step_group_by_and_count, "Group by and count", [this, this.sparql]);
        }
        //if the sparql query limit number is set, change the limit clause in the query
        if (this.sparql_query_limit_number) {
            //execute step
            this.sparql = await this.executeStep(step_change_or_add_limit, "Add/change limit", [this, this.sparql, this.sparql_query_limit_number]);
            //remove the ordering variable from the select clause
            this.sparql = await this.executeStep(step_remove_ordering_var_from_select, "Remove ordering variable from select", [this, this.sparql]);
        }
        if (this.sparql_query_offset_number) {
            this.sparql = await this.executeStep(step_change_or_add_offset, "Add/change offset", [this, this.sparql, this.sparql_query_offset_number]);
        }
        if (this.order_date) {
            this.sparql = await this.executeStep(step_change_order_type_to_date, "Change order type to date", [this, this.sparql]);
        }
        console.log("sparql after modification", this.sparql);
        await this.executeStep(step_get_results, "Get results", [this, place, this.sparql]);
    }
}
window.PassCommands = PassCommands; //to be able to access the class
window.LLMFrameworks.push(PassCommands.name); //to be able to access the class name

/**
 * Prompt is simplified with less commands
 */
class LLMFrameworkOneShotForward extends LLMFramework {
    constructor(question, question_id, select_sugg_logic = null) {
        super(question, question_id, select_sugg_logic);
    }
    async answerQuestionLogic() {
        // Call llm generation
        let output_llm = await this.executeStep(step_generation, "LLM generation", 
            [this, forward_commands_chain_system_prompt(),"forward_commands_chain_system_prompt", this.question]
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
window.LLMFrameworkOneShotForward = LLMFrameworkOneShotForward; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkOneShotForward.name); //to be able to access the class name

class LLMFrameworkOneShotForwardScoringReferences extends LLMFrameworkOneShotForward {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
}
window.LLMFrameworkOneShotForwardScoringReferences = LLMFrameworkOneShotForwardScoringReferences; //to be able to use the class through the window object
window.LLMFrameworks.push(LLMFrameworkOneShotForwardScoringReferences.name); // to be able to access the class name in the interface and choose it in the dropdown

/**
 * Same as LLMFrameworkOneShot, but also checks if a boolean is expected for a result.
 * If a boolean is expected, call a second time the LLM to convert the query to a boolean query.
 */
class LLMFrameworkOneShotWithBooleanConv extends LLMFramework {
    async answerQuestionLogic() {
        //same as LLMFrameworkOneShot
        let output_llm = await this.executeStep(step_generation, "LLM generation 1", 
            [this, commands_chain_system_prompt_v2(),"commands_chain_system_prompt_v2", this.question]
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
window.LLMFrameworkOneShotWithBooleanConv = LLMFrameworkOneShotWithBooleanConv;
window.LLMFrameworks.push(LLMFrameworkOneShotWithBooleanConv.name);

class LLMFrameworkOneShotWithBooleanConvScoringReferences extends LLMFrameworkOneShotWithBooleanConv {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
}
window.LLMFrameworkOneShotWithBooleanConvScoringReferences = LLMFrameworkOneShotWithBooleanConvScoringReferences; //to be able to use the class through the window object
window.LLMFrameworks.push(LLMFrameworkOneShotWithBooleanConvScoringReferences.name); // to be able to access the class name in the interface and choose it in the dropdown

class LLMFrameworkReact extends LLMFramework {
    //todo
}
class LLMFrameworkDirect extends LLMFramework {
    async answerQuestionLogic() {
        let used_endpoint = sparklis.endpoint();
        let output = await this.executeStep(step_generation, "LLM generation", 
            [this, direct_qa_system_prompt(used_endpoint),"direct_qa_system_prompt", this.question]
        );
        let extracted_sparql = await this.executeStep(step_extract_tags, "Extracted SPARQL", [this, output, "sparql"]);
        let extracted_sparql_query = extracted_sparql.at(-1) || "";
        this.sparql = extracted_sparql_query;
    }
}
window.LLMFrameworkDirect = LLMFrameworkDirect; //to be able to use the class through the window object
window.LLMFrameworks.push(LLMFrameworkDirect.name); // to be able to access the class name in the interface and choose it in the dropdown


class LLMFrameworkDirectBoolean extends LLMFramework {
    async answerQuestionLogic() {
        let output = await this.executeStep(step_generation, "LLM generation", 
            [this, direct_boolean_answering_prompt(),"direct_boolean_answering_prompt", this.question]
        );
        let extracted_bool_list = await this.executeStep(step_extract_tags, "Extracted SPARQL", [this, output, "answer"]);
        let extracted_bool = extracted_bool_list.at(-1) || "";
        let bool_query = "";

        //make a query always true or false depending on the answer of the LLM
        //the response is based on the LLM knowledge anyway, so it won't be persistent
        if (extracted_bool == "true") {
            bool_query = "ASK WHERE {}";
        } else if(extracted_bool == "false") {
            bool_query = "ASK WHERE { BIND(false AS ?x) FILTER(?x) }";
        } 
        this.sparql = bool_query;
    }
}
window.LLMFrameworkDirectBoolean = LLMFrameworkDirectBoolean; //to be able to use the class through the window object
window.LLMFrameworks.push(LLMFrameworkDirectBoolean.name); // to be able to access the class name in the interface and choose it in the dropdown

class LLMFrameworkScoreAtAllCost extends LLMFramework { //todo tester
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() { 
        ////////////////////////// GET QUESTION TYPE
        // Call llm generation
        let output_llm = await this.executeStep(step_generation, "LLM generation", 
            [this, prompt_is_boolean_expected(),"prompt_is_boolean_expected", this.question]
        )
        // Extract the commands from the LLM output
        let extracted_type_list = await this.executeStep(step_extract_tags, "Extracted question type",
             [this, output_llm, "answer"]
        );
        // Execute the commands, wait for place evaluation and get the results
        let extracted_type = extracted_type_list.at(-1) || "";

        ////////////////////////// FOR BOOLEAN JUST USE THE LLM
        if (extracted_type == "boolean") {
            let output = await this.executeStep(step_generation, "LLM generation", 
                [this, direct_boolean_answering_prompt(),"direct_boolean_answering_prompt", this.question]
            );
            let extracted_bool_list = await this.executeStep(step_extract_tags, "Extracted SPARQL", [this, output, "answer"]);
            let extracted_bool = extracted_bool_list.at(-1) || "";
            let bool_query = "";

            //make a query always true or false depending on the answer of the LLM
            //the response is based on the LLM knowledge anyway, so it won't be persistent
            if (extracted_bool == "true") {
                bool_query = "ASK WHERE {}";
            } else {
                bool_query = "ASK WHERE { BIND(false AS ?x) FILTER(?x) }";
            } 
            this.sparql = bool_query;
        } else {
            ////////////////////////// USE ThE BEST WORKING SYSTEM FOR THE REST
            // Call llm generation
            let output_llm = await this.executeStep(step_generation, "LLM generation", 
                [this, forward_commands_chain_system_prompt(),"forward_commands_chain_system_prompt", this.question]
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
        // trying to save the process
        if (this.sparql == "") {
            this.reasoning_text += "<br>SPARQL query is empty, trying to get another result<br>";
            //todo temp solution
            this.sparql = "ASK WHERE { BIND(false AS ?x) FILTER(?x) }";
        } 
    }
}
window.LLMFrameworkScoreAtAllCost = LLMFrameworkScoreAtAllCost; //to be able to use the class through the window object
window.LLMFrameworks.push(LLMFrameworkScoreAtAllCost.name); // to be able to access the class name in the interface and choose it in the dropdown


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
                [this, commands_chain_system_prompt_v2(),"commands_chain_system_prompt_v2", this.question]
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
                    [this, commands_chain_system_prompt_v2(),"commands_chain_system_prompt_v2", subquestion]
                );
                let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands", [this, output_commands_subquestion, "commands"]);
                let extracted_commands = extracted_commands_list.at(-1) || "";
                await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
                let place = sparklis.currentPlace();
                await this.executeStep(step_get_results, "Get results", [this, place]);
                subqueries.push(this.sparql);
                this.result_text = truncateResults(this.result_text, 6, 4000); //truncate results to avoid surpassing the token limit
                subanswers.push(this.result_text);
                this.reasoning_text += "<br>Subquestion query:<br>" + this.sparql;
                this.reasoning_text += "<br>Subquestion result (truncated):<br>" + this.result_text;
            }
            //and then combine the results to generate a query answering the original question
            sparklis.home(); // we want to reset sparklis between different queries
            this.reasoning_text += "<br>Combining the results of the subquestions<br>";

            //make the input data for the comparison prompt
            let input_data_dict = { "question": this.question};
            for (let i = 0; i < subanswers.length; i++) {
                input_data_dict["subquery" + (i+1).toString()] = subqueries[i];
            }
            for (let i = 0; i < subanswers.length; i++) {
                input_data_dict["subanswer" + (i+1).toString()] = subanswers[i];
            }
            let input_comparison = data_input_prompt(input_data_dict, true);

            let output_combined = await this.executeStep(step_generation, "LLM generation", 
                [this, prompt_use_subquestions_for_boolean(),"prompt_use_subquestions_for_boolean",
                     input_comparison]
            );
            let extracted_query_list = await this.executeStep(step_extract_tags, "Extracted commands", [this, output_combined, "query"]);
            let extracted_query = extracted_query_list.at(-1) || "";
            this.sparql = extracted_query;
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
window.LLMFrameworkBooleanBySubquestions = LLMFrameworkBooleanBySubquestions;

class LLMFrameworkBooleanBySubquestionsScoringReferences 
    extends LLMFrameworkBooleanBySubquestions {
        constructor(question, question_id) {
            super(question, question_id, "count_references");
        }
}
window.LLMFrameworkBooleanBySubquestionsScoringReferences = LLMFrameworkBooleanBySubquestionsScoringReferences;
window.LLMFrameworks.push(LLMFrameworkBooleanBySubquestionsScoringReferences.name);


class LLMFrameworkBySubquestionsForward extends LLMFramework {
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
                [this, forward_commands_chain_system_prompt(),"forward_commands_chain_system_prompt", this.question]
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
                    [this, forward_commands_chain_system_prompt(),"forward_commands_chain_system_prompt", subquestion]
                );
                let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands", [this, output_commands_subquestion, "commands"]);
                let extracted_commands = extracted_commands_list.at(-1) || "";
                await this.executeStep(step_execute_commands, "Commands execution", [this, extracted_commands]);
                let place = sparklis.currentPlace();
                await this.executeStep(step_get_results, "Get results", [this, place]);
                subqueries.push(this.sparql);
                this.result_text = truncateResults(this.result_text, 4, 4000); //truncate results to avoid surpassing the token limit
                subanswers.push(this.result_text);
                this.reasoning_text += "<br>Subquestion query:<br>" + this.sparql;
                this.reasoning_text += "<br>Subquestion result (truncated):<br>" + this.result_text;
            }
            //and then combine the results to generate a query answering the original question
            sparklis.home(); // we want to reset sparklis between different queries
            this.reasoning_text += "<br>Combining the results of the subquestions<br>";

            //make the input data for the comparison prompt
            let input_data_dict = { "question": this.question};
            for (let i = 0; i < subanswers.length; i++) {
                input_data_dict["subquery" + (i+1).toString()] = subqueries[i];
            }
            for (let i = 0; i < subanswers.length; i++) {
                input_data_dict["subanswer" + (i+1).toString()] = subanswers[i];
            }
            let input_comparison = data_input_prompt(input_data_dict, true);

            let output_combined = await this.executeStep(step_generation, "LLM generation", 
                [this, prompt_use_subquestions_for_any(),"prompt_use_subquestions_for_any",
                     input_comparison]
            );
            let extracted_query_list = await this.executeStep(step_extract_tags, "Extracted commands", [this, output_combined, "query"]);
            let extracted_query = extracted_query_list.at(-1) || "";
            this.sparql = extracted_query;
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
window.LLMFrameworkBySubquestionsForward = LLMFrameworkBySubquestionsForward;
window.LLMFrameworks.push(LLMFrameworkBySubquestionsForward.name);

class LLMFrameworkBySubquestionsForwardScoringReferences extends LLMFrameworkBySubquestionsForward {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
}
window.LLMFrameworkBySubquestionsForwardScoringReferences = LLMFrameworkBySubquestionsForwardScoringReferences; //to be able to use the class through the window object
window.LLMFrameworks.push(LLMFrameworkBySubquestionsForwardScoringReferences.name); // to be able to access the class name in the interface and choose it in the dropdown


/**
 * Just test if the expected answer of a question is a boolean or not.
 */
class LLMFrameworkIsBooleanExpected extends LLMFramework {
    async answerQuestionLogic() {
        // Call llm generation
        let output_llm = await this.executeStep(step_generation, "LLM generation", 
            [this, prompt_is_boolean_expected(),"prompt_is_boolean_expected", this.question]
        )
        // Extract the commands from the LLM output
        let extracted_type_list = await this.executeStep(step_extract_tags, "Extracted question type",
             [this, output_llm, "answer"]
        );
        // Execute the commands, wait for place evaluation and get the results
        let extracted_type = extracted_type_list.at(-1) || "";
        this.result_text = extracted_type;
    }
}
window.LLMFrameworkIsBooleanExpected = LLMFrameworkIsBooleanExpected; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkIsBooleanExpected.name); // to be able to access the class name in the interface and choose it in the dropdown
