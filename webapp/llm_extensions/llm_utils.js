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
 * Only keep the first n results (to avoid too long prompts)
 * @param {*} results_text 
 * @param {*} res_number_to_keep 
 * @returns 
 */
function truncateResults(results_text, res_number_to_keep) {
    let resultsArray;
    let truncated_results_text = results_text;
    try {//todo mieux gérer cas où resulttext est vide
        resultsArray = JSON.parse(truncated_results_text);
    } catch (e) {
        resultsArray = [];
    }
    if (resultsArray.length > res_number_to_keep) {
        resultsArray = resultsArray.slice(0, res_number_to_keep);
        truncated_results_text = JSON.stringify(resultsArray);
        //add ... to indicate that there are more results
        truncated_results_text = truncated_results_text.slice(0, -1) + ", ...]";
        console.log("truncated_results_text", truncated_results_text);
    }
    return truncated_results_text;
}

/** //todo enlever le truncate d'ici?
 * Verify the result. Does the llm think the answer is correct?
 * @param {string} input_question 
 * @param {string} sparql 
 * @param {string} resultText 
 * @param {string} reasoningText 
 * @returns 
 */
async function verify_incorrect_result(input_question, sparql, resultText, reasoningText) {
    let reasoningTextStep = "";
    let systemMessage_verifier = verifier_system_prompt();
    let input_verifier = verifier_input_prompt(input_question, sparql, resultText);
    let output_verifier = await sendPrompt(
        usualPrompt(systemMessage_verifier, input_verifier), 
        true, 
        (text) => { 
            reasoningTextStep = "- Results verification - " + text;
            updateReasoning(questionId, reasoningText
                 + reasoningTextStep); // Capture `questionId` and send `text`
        } 
    );
    reasoningText += reasoningTextStep;

    // get the answer
    let answer = output_verifier.match(/<answer>(.*?)<\/answer>/s);
    let answer_considered_incorrect = answer && answer[1].toLowerCase() == "incorrect";

    return [answer_considered_incorrect, reasoningText];
}

////////// STEPS STATUS //////////

const STATUS_NOT_STARTED = "Not started";
const STATUS_ONGOING = "ONGOING";
const STATUS_DONE = "DONE";
const STATUS_FAILED = "FAILED";

/**
 * Reset all steps of the global variable steps_status, to STATUS_NOT_STARTED.
 */
function resetStepsStatus() {
    for (let step in steps_status) {
        steps_status[step]["Status"] = STATUS_NOT_STARTED;
    }
}

/**
 * Given a step index and a status, update on of the steps from the global variable steps_status.
 * @param {number} step 
 * @param {string} status 
 */
function updateStepsStatus(step, status) {
    steps_status[step.toString()]["Status"] = status;
    localStorage.setItem("steps_status", JSON.stringify(steps_status));
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

function pickSuggestion() {
    //applySuggestion
    return; //todo
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

function getQuery() {
    //let sparql = place.sparql();
    return; //todo
}

function llmHelp() {
    //current question
    //current query
    //current results (not all if too many) 
    //is this query responding to the question
    //can you alter this query to respond to the question
    return; //todo
}

function queryWrapping(query, type, options = {}) {
    //todo deplacer prefixes, mettre query dans wrapper filtrer grace aux options
    switch (type) {
        case QueryTypes.count:
            //todo
        case QueryTypes.verify:
            //todo
        default:
            return query;
    }
}

// ## Requete SPARQL conversion type
// ne pas oublier de déplacer les prefixes

// Boolean //celui là n'est pas assez générique
// ASK WHERE {
//   {
//     SELECT (COUNT(?ville) AS ?count) WHERE {
//       ?ville a ex:Ville .
//     }
//   }
//   FILTER(?count = 13)
// }

// Count
// SELECT (COUNT(*) AS ?count) WHERE {
//   {
//     SELECT ?ville WHERE {
//       ?ville a ex:Ville .
//     }
//   }
// }

/////// MODULES ////////

//find best suggestion

//choose between reasoners