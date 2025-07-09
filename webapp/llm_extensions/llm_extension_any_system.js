// Core of extension SPARKLIS LLM
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
 * List of known prefixes for different knowledge bases.
 * Used to shorten the URIs in the LLM prompts.
 * To update if you want to identify more prefixes.
 **/
const PREFIX_MAPS = {
    wikidata: {
        "http://www.wikidata.org/entity/": "wd:",
        "http://www.wikidata.org/prop/direct/": "wdt:",
        "http://www.wikidata.org/prop/": "p:",
        "http://www.wikidata.org/prop/statement/": "ps:",
        "http://www.wikidata.org/prop/qualifier/": "pq:",
        "http://www.wikidata.org/prop/reference/": "pr:",
        "http://www.wikidata.org/prop/qualifier/value/": "pqv:",
        "http://www.wikidata.org/prop/statement/value/": "psv:",
        "http://www.wikidata.org/prop/reference/value/": "prv:",
        "http://schema.org/": "schema:"
    },
    dbpedia: {
        "http://dbpedia.org/resource/": "dbr:",
        "http://dbpedia.org/ontology/": "dbo:",
        "http://dbpedia.org/property/": "dbp:",
        "http://dbpedia.org/class/yago/": "yago:",
        "http://purl.org/dc/terms/": "dct:",
        "http://xmlns.com/foaf/0.1/": "foaf:",
        "http://www.w3.org/2000/01/rdf-schema#": "rdfs:",
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#": "rdf:",
        "http://www.w3.org/2002/07/owl#": "owl:"
    }
};

/**
 * Shorten a URI using the known prefixes for a given graph.
 * @param {*} uri 
 * @param {*} graph 
 * @returns 
 */
function shortenUri(uri, graph) {
    const prefixes = PREFIX_MAPS[graph];
    for (const [full, prefix] of Object.entries(prefixes)) {
        if (uri.startsWith(full)) {
            return uri.replace(full, prefix);
        }
    }
    return uri;
}


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
        disableProxyIfenabled(); // sometimes the proxy will activate itself and prevent from accessing the endpoint, so we desactivate it if it's the case
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
        // call the strategy logic to answer the question
        await this.answerQuestionLogic();
        // reset the logic of the suggestions for the qa extension
        window.select_sugg_logic = null;

        // if natural language post-processing is enabled, process the results into NL
        if (getALASQAConfig().nl_post_processing === true) {        
            let input_data_dict = { 
                "question": this.question,
                "sparql": this.sparql,
                "results": this.result_text,
            };
            
            let input_prompt = data_input_prompt(input_data_dict, false);

            // Call llm generation
            let final_nl_ouptput = await this.executeStep(step_generation, "Getting natural language answer", 
                [this, prompt_translate_res_to_nl(),"prompt_translate_res_to_nl", input_prompt]
            );

            console.log("output_llm", final_nl_ouptput);
            // Put the result in the answer field
            this.sparklis_nl = "- Réponse finale : " + final_nl_ouptput;
        }
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

    async execute_commands(framework, commands, outside_sparklis_processing) {
        console.log("Executing commands:", commands);

        // Execute the commands, wait for place evaluation and get the results
        await this.executeStep(step_execute_commands, "Commands execution", [framework, commands]);
        //get the current sparql query from the place
        let place = sparklis.currentPlace();
        this.sparql = place.sparql();

        if (outside_sparklis_processing) {
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
        }
        //todo remove prefixes that aren't needed -> to simplify query for the llm

        return place;

    }

    async generate_and_execute_commands(framework, question, outside_sparklis_processing) {
        // Call llm generation
        let output_llm = await this.executeStep(step_generation, "LLM generation", 
            [framework, commands_chain_system_prompt_the_most_improved(),"commands_chain_system_prompt_the_most_improved", question]
        );
        // Extract the commands from the LLM output
        let extracted_commands_list = await this.executeStep(step_extract_tags, "Extracted commands",
            [framework, output_llm, "commands"]
        );
        let extracted_commands = extracted_commands_list.at(-1) || "";
        // Execute the commands, wait for place evaluation and get the results
        let place = await this.execute_commands(framework, extracted_commands, outside_sparklis_processing);
        return place;
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

    let question_field = document.getElementById("user-input");
    let question = question_field.value;
    let question_id = addLLMQuestion(question); //  Add a div in the interface to display the question and the answer

    /////////// PROCESSING ///////////

    //the used framework type is inferred by the dropdown value (could also force a specific class here)
    // Get the selected value
    let dropdown = document.getElementById("strategy-dropdown");
    let selectedClassName = dropdown.value; // Example: "LLMFrameworkBooleanBySubquestions"

    let framework = null;
    // Select the class corresponding to the selected value (only if available)
    if (window[selectedClassName]) {
        framework = new window[selectedClassName](question, question_id);
        // Execute the logic of the extension
        await framework.answerQuestion();
    } else {
        console.error(selectedClassName + " is not a valid strategy class, using LLMFrameworkOneShot by default");
        framework = new LLMFrameworkOneShot(question, question_id);
        framework.errors += selectedClassName + " is not a valid strategy class";
    }

    /////////// ENDING ///////////
    //update reasoning one last time in case of for
    updateReasoning(framework.question_id, framework.reasoning_text);
    //set the result in the answer field
    updateAnswer(framework.question_id, framework.result_text, framework.sparklis_nl, framework.sparql, framework.errors); 
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
    framework.reasoning_text += "<br>" + framework.getCurrentStep()["Name"] + ": (" + commands + ")<br>";
    //to avoid any problem, we want to reset the sparklis place (else sometimes it isn't reset if a query failed to finish)
    sparklis.home();

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

    let remaining_commands = qa.value;
    let no_remaining_commands = remaining_commands === "";
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

    // Only change the query if it is not null or empty
    if (!query || typeof query !== 'string' || query.trim() === '') {
        console.warn("Query is empty or undefined, cannot add LIMIT.");
        return query; // Return the original query if it's empty or undefined
    }
    
    // Remove existing LIMIT clause (case-insensitive)
    const queryWithoutLimit = query.replace(/LIMIT\s+\d+/i, '').trim();

    // Ensure there's a newline before appending LIMIT
    const updatedQuery = `${queryWithoutLimit}\nLIMIT ${limit}`;

    return updatedQuery;
}

/**
 * Function to modify the query to group by and count the results.
 * @param {*} framework 
 * @param {*} query 
 * @returns 
 */
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

    // Only change the query if it is not null or empty
    if (!query || typeof query !== 'string' || query.trim() === '') {
        console.warn("Query is empty or undefined, cannot add OFFSET.");
        return query; // Return the original query if it's empty or undefined
    }

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

/**
 * Function to change the order type in the ORDER BY clause to xsd:date.
 * @param {*} framework 
 * @param {*} query 
 * @returns 
 */
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

/**
 * Function to remove the ordering variable from the SELECT clause.
 * @param {*} framework 
 * @param {*} query 
 * @returns 
 */
function step_remove_ordering_var_from_select(framework, query) {
    framework.reasoning_text += "<br>Removing ordering variable from SELECT<br>";

    // Only change the query if it is not null or empty
    if (!query || typeof query !== 'string' || query.trim() === '') {
        console.warn("Query is empty or undefined, cannot remove ordering variable.");
        return query; // Return the original query if it's empty or undefined
    }

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
 * @param {*} framework - the LLM framework instance
 * @param {*} sparql  - the SPARQL query to execute
 * @param {*} withLabels - whether to include labels in the results. If true and the KG is a wikidata endpoint, querying the graph will be needed to find the uris
 * @param {*} removeDispensableData - whether to remove dispensable data from the results (like type information and shortening URIs)
 * @returns 
 */
async function step_get_results(framework, sparql, withLabels = false, removeDispensableData = false) {
    framework.reasoning_text += "<br>" + framework.getCurrentStep()["Name"] + "<br>";
    let results;
    try { 
        results = await getQueryResults(sparql, withLabels);
    } catch (e) {
        //catch error thrown by wikidata endpoint
        let message = error_messages[3];
        console.log(message, e);
        framework.errors += message;
        //step failed
        framework.setCurrentStepStatus(STATUS_FAILED);
    }
    
    // Remove dispensable data if requested (be careful with map(), it may update the array before previous call of console.log())
    if (removeDispensableData && results && results.rows) {
        // Shorten URIs in the results and remove type information
        results.rows = results.rows.map(row =>
        row.map(cell => {
            const { type, datatype, uri, ...rest } = cell;
            return {
                ...rest,
                ...(uri ? { uri: shortenUri(uri, getEndpointFamily()) } : {}),
                };
            })
        );
    }

    //transform the results to a string

    let result_text = "";
    //either bool or rows
    if (results === true || results === false) {
        result_text = results.toString();
    } else if (results && results.rows) {
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
        result_text = "No results";
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
 * Execute in one time a sequence of commands to answer the question.
 * Referenced as the "One-shot" strategy or base strategy.
 */
class LLMFrameworkOneShot extends LLMFramework {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() {
        disableProxyIfenabled(); // sometimes the proxy will activate itself and prevent from accessing the endpoint, so we desactivate it if it's the case
        let place = await this.generate_and_execute_commands(this, this.question, true);
        let get_labels = getALASQAConfig().nl_post_processing === true;
        await this.executeStep(step_get_results, "Get results", [this, this.sparql, get_labels, get_labels]);
    }
}
window.LLMFrameworkOneShot = LLMFrameworkOneShot; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkOneShot.name); //to be able to access the class name


/**
 * In comparison to the OneShot strategy, this strategy can retry the LLM generation several times.
 * It needs to generate n queries with the same results to validate a query and return it.
 * This is useful to avoid the LLM generating queries that are not stable and that can change from one generation to another.
 * This strategy is referenced as the "Retry" strategy.
 */
class LLMFrameworkRetry extends LLMFramework {
    constructor(question, question_id,
        number_of_same_response_expected = 3,
        global_max_try = Infinity
    ) {
        super(question, question_id, "count_references");
        this.number_of_same_response_expected = number_of_same_response_expected;
        this.global_max_try = global_max_try;
    }

    async answerQuestionLogic() {
        await logic_retry(this, this.number_of_same_response_expected, this.global_max_try);
    }
    
}
window.LLMFrameworkRetry = LLMFrameworkRetry; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkRetry.name); //to be able to access the class name

/**
 * Logic to retry the LLM generation several times until we get the same response n times.
 * This is useful to avoid the LLM generating queries that are not stable and that can change
 * @param {*} framework 
 * @param {int} number_of_same_response_expected 
 */
async function logic_retry(framework, number_of_same_response_expected, global_max_try) {
    ////////////////////////// TRY ANSWERING WITH SPARKLIS
    let i = 1;
    let got_number_of_same_response_expected = false;
    let valid_responses_queries = [];
    let valid_responses_results = [];
    while (!got_number_of_same_response_expected && i <= global_max_try) {
        disableProxyIfenabled(); // sometimes the proxy will activate itself and prevent from accessing the endpoint, so we desactivate it if it's the case
        framework.reasoning_text += "<br>Try " + i + "<br>";
        let place = await framework.generate_and_execute_commands(framework, framework.question, true);
        console.log("sparql after modification", framework.sparql);

        //only wait for the results if the query is not empty
        let results_array = [];
        if (framework.sparql != "" && framework.sparql != undefined && framework.sparql != null) {
            let get_labels = getALASQAConfig().nl_post_processing === true;
            await framework.executeStep(step_get_results, "Get results", [framework, framework.sparql, get_labels, get_labels]);
            try {
                results_array = JSON.parse(framework.result_text);
            } catch (e) {
                results_array = [];
            }
        }

        //reset the variables to avoid side effects for the next queries
        framework.resetQueryAlterationsVariables();

        //got a response if the query is not empty and has a response
        let got_a_response = (framework.sparql != "" && framework.sparql != undefined && framework.sparql != null)
                        && (framework.result_text != "" && framework.result_text != undefined && framework.result_text != null
                        && results_array.length > 0);
        console.log("result text", framework.result_text);

        if (got_a_response) {
            //add to valid_responses
            valid_responses_queries.push(framework.sparql);
            valid_responses_results.push(framework.result_text);

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
                    framework.sparql = query_found;
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
                        framework.sparql = query_found;
                        got_number_of_same_response_expected = true;
                    }
                }
            }
        }
        i++;
    }
    //if we got to the max number of try, put the most returned result as the final query
    if (!got_number_of_same_response_expected && valid_responses_queries.length > 0) {
        let result = valid_responses_results.sort((a,b) => //get the most frequent result
            valid_responses_results.filter(v => v === b).length - valid_responses_results.filter(v => v === a).length
        )[0];
        let idx = valid_responses_results.indexOf(result); //get the first index of the most frequent result
        framework.sparql = valid_responses_queries[idx]; // get the query corresponding to the most frequent result
        await framework.executeStep(step_get_results, "Get results", [framework, framework.sparql, get_labels, get_labels]);
        framework.reasoning_text += `<br>Max tries reached, picked most frequent result: ${result}<br>`;
    }
}

/**
 * Doesn't call the LLM but just pass the commands to the command extension.
 * (Useful to test command chains with commands using query post-processing outside of Sparklis).
 */
class PassCommands extends LLMFramework {
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() {
        let commands = this.question;
        let place = await this.execute_commands(this, commands, true);
        let get_labels = getALASQAConfig().nl_post_processing === true;
        await this.executeStep(step_get_results, "Get results", [this, this.sparql, get_labels, get_labels]);
    }
}
window.PassCommands = PassCommands; //to be able to access the class
window.LLMFrameworks.push(PassCommands.name); //to be able to access the class name

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

/**
 * Use the LLM to answer the question directly without using the commands.
 * Specifically for boolean questions.
 */
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

/**
 * Use the LLM to answer the question directly without using the commands.
 * Can't really work if the LLM doesn't know the endpoint.
 */
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


//////////////////// EXPERIMENTAL STRATEGIES //////////////////////


//todo omni strategy


//todo
//todo find where the crash causes timeout
//<operator>higherThan</operator> -> invalid operator, should be >
//one of the command chains fails, so the result is null
//<commands2>match []</commands2> -> query less than 3 caracters shouldn't be possible
//match no -> same
class LLMFrameworkBooleanByMergeByPatterns extends LLMFramework {
    constructor(question, question_id,
                global_max_try = Infinity,
                number_of_same_response_expected = 3
    ) {
        super(question, question_id, "count_references");
        this.global_max_try = global_max_try; //max number of tries
        this.number_of_same_response_expected = number_of_same_response_expected;
    }

    async answerQuestionLogic() {
        await logic_boolean_by_subquestion_merge_by_patterns(
            this, 
            this.global_max_try, 
            this.number_of_same_response_expected
        );

    }
 
}
window.LLMFrameworkBooleanByMergeByPatterns = LLMFrameworkBooleanByMergeByPatterns; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkBooleanByMergeByPatterns.name); //to be able to access the class name in the

/**
 * Answer a boolean question by having either one command sequence 
 * or two command sequence and an operator, 
 * then using pattern matching to merge the resulting queries based on the operator.
 * @param {*} framework 
 * @param {int} global_max_try 
 * @param {int} number_of_same_response_expected 
 */
async function logic_boolean_by_subquestion_merge_by_patterns(
        framework, 
        global_max_try,
        number_of_same_response_expected
    ) {
    let global_try = 1;
    let get_labels = getALASQAConfig().nl_post_processing === true;

    let valid_responses_queries = []; // will contain the valid responses queries
    let valid_responses_results = []; // will contain the valid responses results
    let got_enough_valid_responses = false; // will be set to true if we have enough valid responses

    while (!got_enough_valid_responses && global_try <= global_max_try) {
        disableProxyIfenabled(); // sometimes the proxy will activate itself and prevent from accessing the endpoint, so we desactivate it if it's the case
        let result_is_bool = false; // will be set to true if the final query returns a boolean result

        framework.reasoning_text += "<br>Global try " + global_try + "<br>";

        // Reset variables to avoid side effects for the next queries
        sparklis.home(); // we want to reset sparklis between different queries
        framework.resetQueryAlterationsVariables(); //reset the variables to avoid side effects for the next queries
        framework.sparql = ""; // Reset the SPARQL query
        framework.result_text = ""; // Reset the result text

        // Call llm generation
        let output_llm = await framework.executeStep(step_generation, "LLM generation", 
            [framework, prompt_get_subquestions_for_boolean_algo_ver(),"prompt_get_subquestions_for_boolean_algo_ver", framework.question]
        );
        // Extract the commands from the LLM output
        let extracted_commands_solo = (await framework.executeStep(step_extract_tags, "Extracted commands (solo)",
            [framework, output_llm, "commands"]
        )).at(-1) || "";
        let extracted_commands1 = (await framework.executeStep(step_extract_tags, "Extracted commands 1",
            [framework, output_llm, "commands1"]
        )).at(-1) || "";
        let extracted_commands2 = (await framework.executeStep(step_extract_tags, "Extracted commands 2",
            [framework, output_llm, "commands2"]
        )).at(-1) || "";
        let operator = (await framework.executeStep(step_extract_tags, "Extracted operator",
            [framework, output_llm, "operator"]
        )).at(-1) || "";

        if (extracted_commands_solo && extracted_commands_solo !== "") { //Only one sequence of commands
            // We want only one commands chain, so we check if there are other commands or an operator
            if (extracted_commands1 !== "" || extracted_commands_solo !== "" || operator !== "") {
                framework.reasoning_text += "<br>Got solo commands, but also another commands chain or operator. Retrying generation...<br>";
                console.error("Got solo commands, but also another commands chain or operator. Retrying generation...");
                // Skip this iteration and retry generation
                global_try++;
                continue;
            }
            // SPARQL query will be set in framework.sparql
            await framework.execute_commands(framework, extracted_commands_solo, true);

            // A solo command chain can also have some operators to alter the query
            if (operator && ["EXISTS", "NOT EXISTS"].includes(operator.toUpperCase())) {
                // Use the operator
                let merged_sparql = combineSparqlQueries(sparql1, sparql1, operator);
                framework.sparql = merged_sparql;
                framework.reasoning_text += "<br>Modified SPARQL query:<br>" + merged_sparql;
            }
                
        } else if (extracted_commands1 && extracted_commands1 !== ""
                    && extracted_commands2 && extracted_commands2 !== "" 
                    && operator && operator !== "") { // Two commands chains with an operator

            //todo check if the operator is valid //else retry

            let place1 = await framework.execute_commands(framework, extracted_commands1, true);
            // Get SPARQL query from the first place
            let sparql1 = framework.sparql; // Get the SPARQL query from the framework (because of outside sparklis treatments)

            // Reset the variables to avoid side effects for the next queries
            sparklis.home(); // we want to reset sparklis between different queries
            framework.resetQueryAlterationsVariables(); //reset the variables to avoid side effects for the next
            framework.sparql = ""; // Reset the SPARQL query
            framework.result_text = ""; // Reset the result text

            let place2 = await framework.execute_commands(framework, extracted_commands2, true);
            // Get SPARQL query from the second place
            let sparql2 = framework.sparql; // Get the SPARQL query from the framework (because of outside sparklis treatments)

            if (!sparql1 || !sparql2 || sparql1 === "" || sparql2 === "") {
                framework.reasoning_text += "<br>One of the SPARQL queries is empty.<br>";
                console.error("One of the SPARQL queries is empty.");
                //skip this iteration
                global_try++;
                continue;
            }

            // Reset the variables to avoid side effects for the next queries
            framework.sparql = ""; // Reset the SPARQL query
            framework.result_text = ""; // Reset the result text

            // Merge the two SPARQL queries
            let merged_sparql = combineSparqlQueries(sparql1, sparql2, operator);
            framework.sparql = merged_sparql;
            framework.reasoning_text += "<br>Merged SPARQL query:<br>" + merged_sparql;
        } else {
            //If we don't have any commands or only one commands chain, we can't continue
            framework.reasoning_text += "<br>No valid commands extracted from the LLM output.<br>";
            console.error("No valid commands extracted from the LLM output.");
            //skip this iteration
            global_try++;
            continue;
        }

        // Get results for the merged SPARQL query
        await framework.executeStep(step_get_results, "Get results", [framework, framework.sparql, get_labels, get_labels]);
        framework.reasoning_text += "<br>Results:<br>" + framework.result_text;

        // Check if the result is a boolean
        result_is_bool = (framework.result_text === "true" || framework.result_text === "false");
        if (!result_is_bool) {
            framework.reasoning_text += "<br>Result is not a boolean, trying again...<br>";
        } else {
            framework.reasoning_text += "<br>Result is a boolean: " + framework.result_text + "<br>";
        }

        // If the result is a boolean, we can add the query to the valid responses
        if (result_is_bool) {
            valid_responses_queries.push(framework.sparql);
            valid_responses_results.push(framework.result_text);
            framework.reasoning_text += "<br>Seemingly valid response found:<br>" + framework.sparql + "<br>Result: " + framework.result_text + "<br>";
            // Check if we have enough valid responses
            got_enough_valid_responses = valid_responses_queries.length >= number_of_same_response_expected;
            if (got_enough_valid_responses) {
                framework.reasoning_text += "<br>Enough valid responses found (" + number_of_same_response_expected + ").<br>";
            }
        }
        global_try++;
    }
    //if we got to the max number of try, put the most returned result as the final query
    if (!got_enough_valid_responses && valid_responses_queries.length > 0) {
        let result = valid_responses_results.sort((a,b) => //get the most frequent result
            valid_responses_results.filter(v => v === b).length - valid_responses_results.filter(v => v === a).length
        )[0];
        let idx = valid_responses_results.indexOf(result); //get the first index of the most frequent result
        framework.sparql = valid_responses_queries[idx]; // get the query corresponding to the most frequent result
        await framework.executeStep(step_get_results, "Get results", [framework, framework.sparql, get_labels, get_labels]);
        framework.reasoning_text += `<br>Max tries reached, picked most frequent result: ${result}<br>`;
    }
}


//todo when command chain fail, the expected result can be false, but we need to get the uri to build the final query
//todo problem: if a command chain fail, it can end on a valid entity and return true
//maybe we should do a and between return true and all commands executed ?
//todo the check of boolean failed, see if the patch worked
/**
 * LLM Framework that generates subquestions to answer a boolean question.
 * Use several tries to generate the subquestions and the final query.
 * Limits: a query with the good boolean response isn't necessarily the right one.
 */
class LLMFrameworkBooleanBySubquestionsMergeByLLM extends LLMFramework {
    constructor(
        question, question_id,
        global_max_try = Infinity,
        subquestion_creation_max_try = 10,
        final_query_generation_max_try = 5,
        number_of_same_response_expected = 3
    ) {
        super(question, question_id, "count_references");
        this.global_max_try = global_max_try; //max number of tries to generate the subquestions
        this.subquestion_creation_max_try = subquestion_creation_max_try; //max number of tries
        this.final_query_generation_max_try = final_query_generation_max_try; //max number of tries to generate the final query
        this.number_of_same_response_expected = number_of_same_response_expected;
    }

    async answerQuestionLogic() {
        await logic_boolean_by_subquestion_merge_by_llm(
            this,
            this.global_max_try,
            this.subquestion_creation_max_try,
            this.final_query_generation_max_try,
            this.number_of_same_response_expected
        );
    }
}
window.LLMFrameworkBooleanBySubquestionsMergeByLLM = LLMFrameworkBooleanBySubquestionsMergeByLLM; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkBooleanBySubquestionsMergeByLLM.name); //to be able to access the class name in the

/**
 * Answer a boolean question by generating n subquestions, 
 * answering the n subquestions, 
 * then calling the LLM to merge their queries and their results into a final query.
 * @param {*} framework 
 * @param {int} global_max_try 
 * @param {int} subquestion_creation_max_try 
 * @param {int} final_query_generation_max_try 
 * @param {int} number_of_same_response_expected 
 */
async function logic_boolean_by_subquestion_merge_by_llm(framework,
        global_max_try,
        subquestion_creation_max_try,
        final_query_generation_max_try,
        number_of_same_response_expected
    ) {
    let valid_responses_queries = []; // will contain the valid responses queries
    let valid_responses_results = []; // will contain the valid responses results
    let got_enough_valid_responses = false; // will be set to true if we have enough valid responses

    let get_labels = getALASQAConfig().nl_post_processing === true;
    let global_try = 1;
    while (!got_enough_valid_responses && global_try <= global_max_try) {
        let result_is_bool = false; // will be set to true if the final query returns a boolean result
        let hallucinated_uri = false; // will be set to true if a new id is generated in the final query in comparison to the subqueries and their results

        framework.reasoning_text += "<br>Global try " + global_try + "<br>";
        let extracted_subquestions = [];
        let subquestion_creation_try = 1;
        while ((!extracted_subquestions || extracted_subquestions.length == 0)
            && subquestion_creation_try <= subquestion_creation_max_try) {
            disableProxyIfenabled(); // sometimes the proxy will activate itself and prevent from accessing the endpoint, so we desactivate it if it's the case
            framework.reasoning_text += "<br>Subquestions creation, try" + subquestion_creation_try + "<br>";

            // Get a list of necessary subquestions to reach the answer
            framework.reasoning_text += "<br>Generating subquestions<br>";
            //Generation of the subquestions by the LLM
            let outputed_subquestions = await framework.executeStep(step_generation, "LLM generation 1", 
                [framework, prompt_get_subquestions_for_boolean(),"prompt_get_subquestions_for_boolean", framework.question]
            );
            
            // Extract the subquestions from the LLM output
            framework.reasoning_text += "<br>Extracting subquestions<br>";
            extracted_subquestions = await framework.executeStep(step_extract_tags, "Extract subquestions", [framework, outputed_subquestions, "subquestion"]);

            subquestion_creation_try++;
        }

        //solve the subquestions
        framework.reasoning_text += "<br>Answering the subquestions<br>";
        let subqueries = [];
        let subanswers = [];
        let place = null;
        let current_subquestion = 1;
        for (let subquestion of extracted_subquestions) {
            let subquestion_try = 1;
            let subquery_is_valid = false;
            while (!subquery_is_valid) {
                framework.reasoning_text += "<br>Answering subquestion " + current_subquestion + ": try " + subquestion_try + "<br>"; 
                // Reset variables to avoid side effects for the next queries
                sparklis.home(); // we want to reset sparklis between different queries
                framework.resetQueryAlterationsVariables(); //reset the variables to avoid side effects for the next queries
                framework.sparql = ""; // Reset the SPARQL query
                framework.result_text = ""; // Reset the result text

                place = await framework.generate_and_execute_commands(framework, subquestion, true);
                console.log("sparql after modification", framework.sparql);
                subquery_is_valid = framework.sparql != "" && framework.sparql != undefined && framework.sparql != null;
                subquestion_try++;
            }
            await framework.executeStep(step_get_results, "Get results", [framework, framework.sparql, true, true]);
            subqueries.push(framework.sparql);
            framework.result_text = truncateResults(framework.result_text, 20, 4000); //truncate results to avoid surpassing the token limit
            subanswers.push(framework.result_text);
            framework.reasoning_text += "<br>Subquestion query:<br>" + framework.sparql;
            framework.reasoning_text += "<br>Subquestion result (truncated):<br>" + framework.result_text;
            current_subquestion++;
        }
        //and then combine the results to generate a query answering the original question
        sparklis.home(); // we want to reset sparklis between different queries
        framework.resetQueryAlterationsVariables(); //reset the variables to avoid side effects for the next queries
        framework.reasoning_text += "<br>Combining the results of the subquestions<br>";

        //make the input data for the comparison prompt
        let input_data_dict = { "question": framework.question};
        for (let i = 0; i < subanswers.length; i++) {
            input_data_dict["subquery" + (i+1).toString()] = subqueries[i];
        }
        for (let i = 0; i < subanswers.length; i++) {
            input_data_dict["subanswer" + (i+1).toString()] = subanswers[i];
        }
        let input_comparison = data_input_prompt(input_data_dict, true);

        let final_query_generation_try = 1;
        //also check that no new id have been introduced
        let existing_uris = extract_uris_from_string_list(subqueries).join(extract_uris_from_string_list(subanswers)); // list of queries and results URIs

        while (final_query_generation_try <= final_query_generation_max_try && (!result_is_bool || hallucinated_uri)) {
            framework.reasoning_text += "<br>Final query generation try " + final_query_generation_try + "<br>";

            // Reset variables to avoid side effects for the next queries
            framework.sparql = ""; // Reset the SPARQL query
            framework.result_text = ""; // Reset the result text

            console.log("input_comparison",input_comparison);
            let output_combined = await framework.executeStep(step_generation, "LLM generation", 
                [framework, prompt_use_subquestions_for_boolean(),"prompt_use_subquestions_for_boolean",
                    input_comparison]
            ); //todo alternatives prompt
            let extracted_query_list = await framework.executeStep(step_extract_tags, "Extracted query", [framework, output_combined, "query"]);
            let extracted_query = extracted_query_list.at(-1) || ""; 
            framework.reasoning_text += "<br>Generated final query:<br>" + extracted_query;

            // Get patched query
            framework.reasoning_text += "<br>Trying to detect and patch any query issues<br>";
            framework.sparql = get_patched_query(extracted_query, framework);
            framework.reasoning_text += "<br>Patched query:<br>" + framework.sparql;

            //execute the generated sparql query
            await framework.executeStep(step_get_results, "Get results of created query", [framework, framework.sparql, get_labels, get_labels]); 
            result_is_bool = (framework.result_text === "true" || framework.result_text === "false");
            if (!result_is_bool) {
                framework.reasoning_text += "<br>Result is not a boolean, trying again the final query generation<br>";
            }

            const generated_uris = extract_uris_from_string_list([framework.sparql]);
            let hallucinated_uris_list = generated_uris.filter(uri => !existing_uris.includes(uri));
            hallucinated_uri = hallucinated_uris_list.length > 0;
            if (hallucinated_uri) {
                framework.reasoning_text += `<br>New URI generated (hallucinated) in the final query: ${[...new Set(hallucinated_uris_list)].join(", ")}. framework is not allowed, trying again the final query generation<br>`;
            }

            final_query_generation_try++;
        }
        if (!result_is_bool && global_try < global_max_try) {
            framework.reasoning_text += "<br>Result is not a boolean and tried to many times to generate the final query. Retrying the whole process<br>";
        } else if (hallucinated_uri && global_try < global_max_try) {
            framework.reasoning_text += "<br>Hallucinated URI in the final query and tried to many times to generate the final query. Retrying the whole process<br>";
        } else if ((!result_is_bool || hallucinated_uri) && global_try >= global_max_try) {
            framework.reasoning_text += "<br>Result is not a boolean or hallucinated URI in the final query and reached the maximum number of tries. Giving up.<br>";
        }

        // if the result is a boolean, we can add it to the valid responses
        // and check if we have enough valid responses
        if (result_is_bool && !hallucinated_uri) {
            //add the valid responses
            valid_responses_queries.push(framework.sparql);
            valid_responses_results.push(framework.result_text);
            framework.reasoning_text += "<br>Got a seemingly valid response: " + framework.result_text + "<br>";
            got_enough_valid_responses = valid_responses_queries.length >= number_of_same_response_expected;
            if (got_enough_valid_responses) {
                framework.reasoning_text += "<br>Got enough valid responses, stopping the process.<br>";
            }
        }
        global_try++;
    }

    //if we got to the max numbe rof try, put the most returned result as the final query
    if (!got_enough_valid_responses && valid_responses_queries.length > 0) {
        let result = valid_responses_results.sort((a,b) => //get the most frequent result
            valid_responses_results.filter(v => v === b).length - valid_responses_results.filter(v => v === a).length
        )[0];
        let idx = valid_responses_results.indexOf(result); //get the first index of the most frequent result
        framework.sparql = valid_responses_queries[idx]; // get the query corresponding to the most frequent result
        await framework.executeStep(step_get_results, "Get results", [framework, framework.sparql, get_labels, get_labels]);
        framework.reasoning_text += `<br>Max tries reached, picked most frequent result: ${result}<br>`;
    }
}


class LLMFrameworkComparisonBySubquestions extends LLMFramework {
    constructor(
        question, question_id,
        global_max_try = Infinity,
        subquestion_creation_max_try = Infinity,
        final_query_generation_max_try = 5,
        number_of_same_response_expected = 3
    ) {
        super(question, question_id, "count_references");
        this.global_max_try = global_max_try; //max number of tries to generate the subquestions
        this.subquestion_creation_max_try = subquestion_creation_max_try; //max number of tries
        this.final_query_generation_max_try = final_query_generation_max_try; //max number of tries to generate the final query
        this.number_of_same_response_expected = number_of_same_response_expected;
    }

    async answerQuestionLogic() {
        await logic_any_by_subquestions_merge_llm(
            this,
            this.global_max_try,
            this.subquestion_creation_max_try,
            this.final_query_generation_max_try,
            this.number_of_same_response_expected
        );
    }


}
window.LLMFrameworkComparisonBySubquestions = LLMFrameworkComparisonBySubquestions; //to be able to access the class
window.LLMFrameworks.push(LLMFrameworkComparisonBySubquestions.name); //to be able to access the class name in the


/**
 * Answer a question by generating n subquestions,
 * answering the n subquestions,
 * then calling the LLM to merge their queries and their results into a final query.
 * This is a more generic version of the boolean question answering by subquestions.
 * @param {*} framework 
 * @param {int} global_max_try 
 * @param {int} subquestion_creation_max_try 
 * @param {int} final_query_generation_max_try 
 * @param {int} number_of_same_response_expected 
 */
async function logic_any_by_subquestions_merge_llm(
        framework,
        global_max_try,
        subquestion_creation_max_try,
        final_query_generation_max_try,
        number_of_same_response_expected
    ){
    let valid_responses_queries = [];
    let valid_responses_results = [];
    let got_enough_valid_responses = false; // will be set to true if we got enough valid responses

    let get_labels = getALASQAConfig().nl_post_processing === true;
    let global_try = 1;
    while (!got_enough_valid_responses && global_try <= global_max_try) {
        disableProxyIfenabled(); // sometimes the proxy will activate itself and prevent from accessing the endpoint, so we desactivate it if it's the case
        let result_is_valid = false; // will be set to true if the final query returns a valid result
        let hallucinated_uri = false; // will be set to true if a new id is generated in the final query in comparison to the subqueries and their results
        framework.reasoning_text += "<br>Global try " + global_try + "<br>";
        let extracted_subquestions = [];
        let subquestion_creation_try = 1;
        while ((!extracted_subquestions || extracted_subquestions.length == 0)
            && subquestion_creation_try <= subquestion_creation_max_try) {
            framework.reasoning_text += "<br>Subquestions creation, try" + subquestion_creation_try + "<br>";

            // Get a list of necessary subquestions to reach the answer
            framework.reasoning_text += "<br>Generating subquestions<br>";
            //Generation of the subquestions by the LLM
            let outputed_subquestions = await framework.executeStep(step_generation, "LLM generation 1", 
                [framework, prompt_get_subquestions(),"prompt_get_subquestions", framework.question]
            ); //todo update prompt
            
            // Extract the subquestions from the LLM output
            framework.reasoning_text += "<br>Extracting subquestions<br>";
            extracted_subquestions = await framework.executeStep(step_extract_tags, "Extract subquestions", [framework, outputed_subquestions, "subquestion"]);

            subquestion_creation_try++;
        }

        //solve the subquestions
        framework.reasoning_text += "<br>Answering the subquestions<br>";
        let subqueries = [];
        let subanswers = [];
        let place = null;
        let current_subquestion = 1;
        for (let subquestion of extracted_subquestions) {
            let subquestion_try = 1;
            let subquery_is_valid = false;
            while (!subquery_is_valid) {
                framework.reasoning_text += "<br>Answering subquestion " + current_subquestion + ": try " + subquestion_try + "<br>"; 
                // Reset variables to avoid side effects for the next queries
                sparklis.home(); // we want to reset sparklis between different queries
                framework.resetQueryAlterationsVariables(); //reset the variables to avoid side effects for the next queries
                framework.sparql = ""; // Reset the SPARQL query
                framework.result_text = ""; // Reset the result text

                place = await framework.generate_and_execute_commands(framework, subquestion, true);
                console.log("sparql after modification", framework.sparql);
                subquery_is_valid = framework.sparql != "" && framework.sparql != undefined && framework.sparql != null;
                subquestion_try++;
            }
            await framework.executeStep(step_get_results, "Get results", [framework, framework.sparql, true, true]);
            subqueries.push(framework.sparql);
            framework.result_text = truncateResults(framework.result_text, 20, 4000); //truncate results to avoid surpassing the token limit
            subanswers.push(framework.result_text);
            framework.reasoning_text += "<br>Subquestion query:<br>" + framework.sparql;
            framework.reasoning_text += "<br>Subquestion result (truncated):<br>" + framework.result_text;
            current_subquestion++;
        }
        //and then combine the results to generate a query answering the original question
        sparklis.home(); // we want to reset sparklis between different queries
        framework.resetQueryAlterationsVariables(); //reset the variables to avoid side effects for the next queries
        framework.reasoning_text += "<br>Combining the results of the subquestions<br>";

        //make the input data for the comparison prompt
        let input_data_dict = { "question": framework.question};
        for (let i = 0; i < subanswers.length; i++) {
            input_data_dict["subquery" + (i+1).toString()] = subqueries[i];
        }
        for (let i = 0; i < subanswers.length; i++) {
            input_data_dict["subanswer" + (i+1).toString()] = subanswers[i];
        }
        let input_comparison = data_input_prompt(input_data_dict, true);

        let final_query_generation_try = 1;
        //also check that no new id have been introduced
        let existing_uris = extract_uris_from_string_list(subqueries).join(extract_uris_from_string_list(subanswers)); // list of queries and results URIs

        while (final_query_generation_try <= final_query_generation_max_try && (!result_is_valid || hallucinated_uri)) {
            framework.reasoning_text += "<br>Final query generation try " + final_query_generation_try + "<br>";

            // Reset variables to avoid side effects for the next queries
            framework.sparql = ""; // Reset the SPARQL query
            framework.result_text = ""; // Reset the result text

            console.log("input_comparison",input_comparison);
            let output_combined = await framework.executeStep(step_generation, "LLM generation", 
                [framework, prompt_use_subquestions_for_any(),"prompt_use_subquestions_for_any",
                    input_comparison] //todo update prompt
            ); //todo alternatives prompt
            let extracted_query_list = await framework.executeStep(step_extract_tags, "Extracted query", [framework, output_combined, "query"]);
            let extracted_query = extracted_query_list.at(-1) || ""; 
            framework.reasoning_text += "<br>Generated final query:<br>" + extracted_query;

            // Get patched query
            framework.reasoning_text += "<br>Trying to detect and patch any query issues<br>";
            framework.sparql = get_patched_query(extracted_query, framework);
            framework.reasoning_text += "<br>Patched query:<br>" + framework.sparql;

            //execute the generated sparql query
            await framework.executeStep(step_get_results, "Get results of created query", [framework, framework.sparql, get_labels, get_labels]); 
            result_is_valid = (framework.result_text !== null && framework.result_text !== undefined && framework.result_text !== "");
            if (!result_is_valid) {
                framework.reasoning_text += "<br>Result is not a valid, trying again the final query generation<br>";
            }

            const generated_uris = extract_uris_from_string_list([framework.sparql]);
            let hallucinated_uris_list = generated_uris.filter(uri => !existing_uris.includes(uri));
            hallucinated_uri = hallucinated_uris_list.length > 0;
            if (hallucinated_uri) {
                framework.reasoning_text += `<br>New URI generated (hallucinated) in the final query: ${[...new Set(hallucinated_uris_list)].join(", ")}. framework is not allowed, trying again the final query generation<br>`;
            }

            final_query_generation_try++;
        }
        if (!result_is_valid && global_try < global_max_try) {
            framework.reasoning_text += "<br>Result is not a valid and tried to many times to generate the final query. Retrying the whole process<br>";
        } else if (hallucinated_uri && global_try < global_max_try) {
            framework.reasoning_text += "<br>Hallucinated URI in the final query and tried to many times to generate the final query. Retrying the whole process<br>";
        } else if ((!result_is_valid || hallucinated_uri) && global_try >= global_max_try) {
            framework.reasoning_text += "<br>Result is not a valid or hallucinated URI in the final query and reached the maximum number of tries. Giving up.<br>";
        }
            
        //if the result is valid and no hallucinated uri, we can add the query and result to the valid responses
        if (result_is_valid && !hallucinated_uri) {
            valid_responses_queries.push(framework.sparql);
            valid_responses_results.push(framework.result_text);
            framework.reasoning_text += "<br>Seemingly valid response found:<br>" + framework.sparql + "<br>" + framework.result_text;
            got_enough_valid_responses = valid_responses_queries.length >= number_of_same_response_expected;
            if (got_enough_valid_responses) {
                framework.reasoning_text += "<br>Got enough valid responses, stopping the process.<br>";
            }
        }
        global_try++;
    }

    //if we got to the max numbe rof try, put the most returned result as the final query
    if (!got_enough_valid_responses && valid_responses_queries.length > 0) {
        let result = valid_responses_results.sort((a,b) => //get the most frequent result
            valid_responses_results.filter(v => v === b).length - valid_responses_results.filter(v => v === a).length
        )[0];
        let idx = valid_responses_results.indexOf(result); //get the first index of the most frequent result
        framework.sparql = valid_responses_queries[idx]; // get the query corresponding to the most frequent result
        await framework.executeStep(step_get_results, "Get results", [framework, framework.sparql, get_labels, get_labels]);
        framework.reasoning_text += `<br>Max tries reached, picked most frequent result: ${result}<br>`;
    }
}

//////////////////// LEGACY STRATEGIES //////////////////////

/**
 * This strategy use the LLM to directly respond to boolean question and then give a fixed SPARQL query.
 * Please now prefere the strategy LLMFrameworkRetry.
 */
class LLMFrameworkRetryDelegatesBoolsToLLMLegacy extends LLMFramework {
    //get the highest score on benchmarks, but the reasoning behind boolean question isn't based on the KG
    constructor(question, question_id) {
        super(question, question_id, "count_references");
    }
    async answerQuestionLogic() {
        ////////////////////////// GET QUESTION TYPE
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
            this.reasoning_text += "<br>Try " + i + "<br>";
            let place = await this.generate_and_execute_commands(this, this.question, true);
            console.log("sparql after modification", this.sparql);
            //only wait for the results if the query is not empty
            let results_array = [];
            if (this.sparql != "" && this.sparql != undefined && this.sparql != null) {
                let get_labels = getALASQAConfig().nl_post_processing === true;
                await this.executeStep(step_get_results, "Get results", [this, this.sparql, get_labels, get_labels]);
                try {
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

        let sparklis_response_is_boolean = false;

        //if the expected type is a boolean, and the response from sparklis isn't a boolean, we will directly use the LLM to answer the question
        if (expected_response_type == "boolean" && !sparklis_response_is_boolean) {

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
//not added to the LLMFrameworks list, as it is not used anymore

/**
 * This strategy was used for our participation to the TEXT2SPARQL'25 challenge.
 * This is strategy is derivated from LLMFrameworkRetryDelegatesBoolsToLLM, is limited in time and check the used knowledge graph.
 */
class LLMFrameworkText2SparqlLegacy extends LLMFramework {
    constructor(question, question_id,
        max_number_bool_tests = 2, max_time_for_retry = 8*60) {
        super(question, question_id, "count_references");
        this.max_number_bool_tests = max_number_bool_tests; // Number of times to test if the expected result is a boolean
        this.max_time_for_retry = max_time_for_retry; // Maximum time in seconds to retry the question
    }
    async answerQuestionLogic() {
        const startTime = performance.now();
        ////////////////////////// GET QUESTION TYPE
        let endpoint_is_corporate = getEndpointFamily() == "corporate";
        let extracted_type = "tocheck";
        if (!endpoint_is_corporate) { //we won't use llm knowledge if we are in a corporate endpoint
            //we will test number_bool_tests times that the expected result is a boolean
            let current_number_bool_tests = 1;
            while (current_number_bool_tests <= this.max_number_bool_tests 
                && (extracted_type == "tocheck" || extracted_type == "boolean")) {
                    this.reasoning_text += "<br>Try to get the question type (" + current_number_bool_tests + ")<br>";
                // Call llm generation
                let output_llm_type = await this.executeStep(step_generation, "LLM generation", 
                    [this, prompt_is_boolean_expected(),"prompt_is_boolean_expected", question_user_prompt(this.question)]
                );
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
            while (!got_a_response && elapsedTime < (this.max_time_for_retry)) {
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
                    let get_labels = getALASQAConfig().nl_post_processing === true;
                    await this.executeStep(step_get_results, "Get results", [this, this.sparql, get_labels, get_labels]);
                    try {
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

            }
        }      
    }
}
//not added to the LLMFrameworks list, as it is not used anymore
