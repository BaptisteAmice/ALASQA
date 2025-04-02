console.log("LLM utility active");

const API = "http://localhost:1234/v1/chat/completions";

/**
 * Common prompt template : one system message and one user message
 * @param {*} systemPrompt 
 * @param {*} userPrompt 
 * @returns
 */
function usualPrompt(systemPrompt, userPrompt) {
    return [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": userPrompt}
    ];
}

/**
 * Send a prompt to the LLM and return the response
 * @param {string} input - the prompt to send to the LLM
 * @param {boolean} streamOption - if true, the response will be streamed
 * @param {*} updateCallback - function to call when the LLM sends a response
 * @param {*} usedTemperature - the temperature to use for the LLM
 * @returns 
 */
async function sendPrompt(input, streamOption = true, updateCallback = null, usedTemperature = 0.8) {
    //careful the first parameter can be interpreted as several parameters...
    try {
        const response = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: input, temperature: usedTemperature,  stream : streamOption })
        });
        console.log("Ongoing LLM generation...")
        let text = "";
        if (streamOption) {
            let reader = response.body.getReader();
            let decoder = new TextDecoder('utf-8');
            let done = false;
        
            while (!done) {
                let { value, done: readerDone } = await reader.read();
                if (readerDone) break;
        
                let chunk = decoder.decode(value, { stream: true });
                console.log(chunk);
        
                // Split the chunk into multiple JSON objects
                let parts = chunk.split("data: ").filter(p => p.trim()); // Remove empty parts
        
                for (let part of parts) {
                    if (part.includes("[DONE]")) {
                        done = true;
                        break;
                    }
        
                    try {
                        let chunkData = JSON.parse(part.trim());
                        text += chunkData.choices[0].delta["content"] || '';
        
                        if (updateCallback != null) {
                            updateCallback(text);
                        }
                    } catch (error) {
                        console.error("JSON Parsing Error:", error, "Chunk Part:", part);
                    }
                }
            }
        } else {
            const data = await response.json();
            text = data["choices"][0]["message"]["content"] || "No response"

            if (updateCallback != null) {
                updateCallback(text);
            }
        }
        return text;
    } catch (error) {
        return "Error: " + error.message;
    }
}


////////// UTILS //////////
/**
 * Remove prefixes from a SPARQL query
 */
function removePrefixes(sparqlQuery) {
    return sparqlQuery.split('\n')
        .filter(line => !line.startsWith('PREFIX'))
        .join('\n');
}

/**
 * Count the number of commands of Sparklis QA extension in a string
 * @param {string} commands 
 * @returns 
 */
function countCommands(commands) {
    return commands.split(";").filter(cmd => cmd.trim().length > 0).length;
}

/**
 * Convert place.onEvaluated() to a promise to avoid nested callbacks
 * @param {*} place - the place to wait for evaluation
 * @returns 
 */
function waitForEvaluation(place) {
    return new Promise((resolve) => {
        place.onEvaluated(() => {
            console.log("Place evaluated");
            resolve();
        });
    });
}

/**
 * Get the label corresponding to a Wikidata URI and add it to the result text as a new field
 * @param {string} wikidataURI
 * @param {string} language 
 * @returns 
 */
async function getWikidataLabel(wikidataURI, language = "en") {
    const entityId = wikidataURI.split('/').pop();
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&format=json&props=labels&languages=${language}&origin=*`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.entities[entityId]?.labels[language]?.value || "Label not found";
    } catch (error) {
        console.error("Error fetching data:", error);
        return "Error fetching label";
    }
}

/**
 * Search for a keyword in Wikidata and return possible values as a list of dictionaries with id, label and description
 * @param {*} keyword 
 * @param {*} type 
 * @returns 
 */
async function searchWikidataKeyword(keyword, type) {
    const baseUrl = "https://www.wikidata.org/w/api.php";
    
    if (!["item", "property", "lexeme", "form", "sense"].includes(type)) {
        throw new Error("Invalid type. Use 'item', 'property', 'lexeme', 'form', or 'sense'");
    }
    
    const url = `${baseUrl}?action=wbsearchentities&search=${encodeURIComponent(keyword)}&language=en&type=${type}&format=json&origin=*`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return (data.search || []).map(item => ({
            id: item.id,
            label: item.label || "Unknown label",
            description: item.description || "No description available"
        }));
    } catch (error) {
        console.error(`Error fetching ${keyword}:`, error);
        return null;
    }
}

/**
 * Give the question currently in the input field.
 * @returns 
 */
function getInputQuestion() {
    let input_field = document.getElementById("user-input");
    let input_question = input_field.value;
    return input_question;
}

/**
 * Get the input field (of the QA extension) where the commands are set and read to be executed.
 * @returns 
 */
function getQAInputField() {
    return document.getElementById("qa");
}

/**
 * Get the Sparklis NL query from the interface.
 * @returns
 */
function getSentenceFromDiv() {
    // Select the #query-body div
    const queryBody = document.getElementById('query-body');
    
    // Get the text content of the div, excluding the inner span tags
    let text = queryBody.innerText || queryBody.textContent;

    // Return the cleaned-up text
    return text.trim();
}

/**
 * Only keep the first n results (to avoid too long prompts)
 * @param {*} results_text 
 * @param {*} res_number_to_keep 
 * @returns 
 */
function truncateResults(results_text, res_number_to_keep, max_number_of_char = null) {
    let resultsArray;
    let truncated_results_text = results_text;
    try {//todo mieux gérer cas où resulttext est vide
        resultsArray = JSON.parse(truncated_results_text);
    } catch (e) {
        resultsArray = [];
    }

    //truncate the results if there are too many
    if (resultsArray.length > res_number_to_keep) {
        resultsArray = resultsArray.slice(0, res_number_to_keep);
        truncated_results_text = JSON.stringify(resultsArray);
        //add ... to indicate that there are more results
        truncated_results_text = truncated_results_text.slice(0, -1) + ", and more truncated results...]";
        console.log("truncated_results_text", truncated_results_text);
    }

    //truncate the results if they are too long
    if (max_number_of_char != null && truncated_results_text.length > max_number_of_char) {
        truncated_results_text = truncated_results_text.substring(0, max_number_of_char) + "...and more truncated results...]";
    }

    return truncated_results_text;
}

/**
 * Verify the result. Does the llm think the answer is correct?
 * @param {string} input_question 
 * @param {string} sparql 
 * @param {string} resultText 
 * @param {string} reasoningText 
 * @returns 
 */
async function verify_incorrect_result(input_question, sparql, resultText, reasoningText) {
    let systemMessage_verifier = verifier_system_prompt();
    let input_verifier = data_input_prompt({ "question": input_question, "sparql": sparql, "result" : resultText }, true);
    reasoningText += "- RESULTS VERIFICATION - system message: " + "verifier_system_prompt()" + " - user input: " + input_verifier + " - ";
    let output_verifier = await sendPrompt(
        usualPrompt(systemMessage_verifier, input_verifier), 
        true, 
        (text) => { 
            updateReasoning(questionId, reasoningText + text);
        } 
    );
    reasoningText += output_verifier;
    // get the answer
    let answer = output_verifier.match(/<answer>(.*?)<\/answer>/s);
    let answer_considered_incorrect = answer && answer[1].toLowerCase() == "incorrect";

    return [answer_considered_incorrect, reasoningText];
}

/**
 * Add a single command to the QA extension field and execute it
 * @param {string} questionId 
 * @param {string} question 
 * @param {string} sparql 
 * @param {string} results 
 * @param {string} reasoningText 
 * @param {*} qa_field 
 * @returns 
 */
async function add_command(questionId, question, sparql, results, last_command, reasoningText, qa_field) {
    let input = data_input_prompt({ "question": question, "sparql": sparql, "results": results, "last_command":  last_command}, true);
    reasoningText += "- ADD COMMAND - system message: " + "following_command_system_prompt()" + " - user input: " + input + " - ";
    let output_add_command = await sendPrompt(
        usualPrompt(following_command_system_prompt(), input), 
        true, 
        (text) => { 
            updateReasoning(questionId, reasoningText + text);
        } 
    );
    reasoningText += output_add_command;
    //get the new command
    let matchCommand = output_add_command.match(/<command>(.*?)<\/command>/s);
    let newCommand = matchCommand ? matchCommand[1].trim() : "";

    //set the new command in the qa field
    qa_field.value = newCommand;

    //execute the new command
    await process_question(qa_field).catch(async error => {
        console.error("add_command failed", error);
        //todo gerer erreur
        [reasoningText] = await failed_command(questionId, newCommand, error, question, reasoningText);
    });
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
        console.error("add_command sparql evaluation failed", e);
        //If the new command fails, we keep the old results
        newSparql = sparql;
        newResults = results; 
    }
    return [newSparql, newResults, newCommand, reasoningText];
}

/**
 * Use the LLM to choose the next action to take
 * @param {string} input_question 
 * @param {string} sparql 
 * @param {string} resultText 
 * @param {string} reasoningText 
 * @returns 
 */
async function choose_next_action(input_question, sparql, resultText, reasoningText) {
    let systemMessage = choose_action_system_prompt();
    let input = data_input_prompt({ "question": input_question, "sparql": sparql, "results": resultText }, true);
    reasoningText += "- CHOOSE NEXT ACTION - system message: " + "choose_action_system_prompt()" + " user input: " + input + " - ";
    let output = await sendPrompt(
        usualPrompt(systemMessage, input), 
        true, 
        (text) => { 
            updateReasoning(questionId, reasoningText + text);
        } 
    );
    reasoningText += output;
    // Get the action
    let actionMatch = output.match(/<action>(.*?)<\/action>/s);
    let action = actionMatch ? actionMatch[1].trim() : "unknown";
    return [action, reasoningText];
}

////////// COMMANDS //////////
//todo à voir si on fait vraiment ca

const QueryTypes = {
    // Commands to get knowledge from the endpoint
    filter: "filter", // TypesAndRelations | IdentitiesOrValues | AggregationsAndOperators
    getSuggestions: "getSuggestions", // TypesAndRelations | IdentitiesOrValues | AggregationsAndOperators
    getResults: "getResults", // Execute outside of Sparklis to not be too dependent
    undo: "undo", //mainly needed because a wrong command can remove the whole constructed query
    redo: "redo",

    //if we are using the QA extension
    construct: "construct", // use the QA extension to construct a query

    // Commands if we are not using the QA extension
    pick: "pick", // Pick a specific suggestion
    stringMatch: "stringMatch", // Match a specific string
    moveFocus: "moveFocus", // UP | DOWN

    // Commands to adapt the query to the desired result (can't see the result in Sparklis)
    count: "count", // Wrap query to count results
    selectColumns: "selectColumns", // Only keep the listed columns in the select of the query
    llmHelp: "llmHelp", // Let the LLM directly alter the query

    verify: "verify", // ???
    search: "search", //search for a specific result // ???
};

async function getConceptSuggestionsWithLabels() { //todo
    //conceptSuggestions.forest -> for sugg in forest -> .item.suggestion.pred -> .uriE ou uriO
    //place needs to be evaluated
    let conceptSuggestions = await sparklis.currentPlace().getConceptSuggestions(false,sparklis.conceptConstr());
    console.log(conceptSuggestions);
    //replace wiki data uri by labels
    for (let suggestion of conceptSuggestions.forest) {
        if (suggestion && suggestion.item && suggestion.item.suggestion && suggestion.item.suggestion.pred && suggestion.item.suggestion.pred.uriE &&
            suggestion.item.suggestion.pred.uriE.startsWith("http://www.wikidata.org/")) {
            suggestion.item.suggestion.pred.label = await getWikidataLabel(suggestion.item.suggestion.pred.uriE);
        }
    }


    //les 2 autres
    return conceptSuggestions;
}

/**
 * Evaluate a SPARQL query and add labels to it's result if it's for every uri from wikidata.
 * @param {*} sparqlQuery 
 * @returns 
 */
async function getResultsWithLabels(sparqlQuery) {
    let results = await sparklis.evalSparql(sparqlQuery);
    for (let row of results.rows) {
        for (let value of row) {
            // for each value, if it is a wikidata uri, add the corresponding label from wikidata
            if (value && value.type === "uri" && value.uri.startsWith("http://www.wikidata.org/")) {
                value.label = await getWikidataLabel(value.uri);
            }
        }
    }
    return results;
}