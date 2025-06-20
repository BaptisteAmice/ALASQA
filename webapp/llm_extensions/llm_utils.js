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
 * @param {Array} stop_sequences - the sequences that will stop the LLM generation
 * @returns 
 */
async function sendPrompt(input, streamOption = true, updateCallback = null, usedTemperature = 0.8, stop_sequences = ["Q:"]) {
    //careful the first parameter can be interpreted as several parameters...
    try {
        const response = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: input, temperature: usedTemperature,  stream : streamOption, stop: stop_sequences })
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
 * Remove all PREFIX declarations from a SPARQL query
 * @param {string} sparqlQuery - the SPARQL query to clean
 * @returns 
 */
function removePrefixes(sparqlQuery) {
    return sparqlQuery.replace(/PREFIX\s+[^\s]+:\s+<[^>]+>\s*/gi, '').trim();
}

/**
 * Convert place.onEvaluated() to a promise to avoid nested callbacks
 * @param {*} place - the place to wait for evaluation
 * @returns 
 */
function waitForEvaluation(place) {
    console.log("Waiting for place evaluation...");
    return new Promise((resolve) => {
        place.onEvaluated(() => {
            console.log("Place evaluated");
            resolve();
        });
    });
}

/**
 * Get the label corresponding to a Wikidata URI and add it to the result text as a new field
 * @param {string} wikidataURI - the Wikidata URI to get the label for
 * @param {string} language - the language to get the label in (default is "en")
 * @returns 
 */
async function getWikidataLabel(wikidataURI, language = "en") {
    const entityId = wikidataURI.split('/').pop();
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&format=json&props=labels&languages=${language}&origin=*`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        let label ="Label not fetched";
        try {
            label = data.entities[entityId]?.labels[language]?.value || "Label not found";
        }
        catch(err) {
            console.error("Error fetching label:", err);
        }
        return label;
    } catch (error) {
        console.warn("Error fetching data:", error);
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
 * Truncate the results text to a certain number of results and/or a maximum number of characters.
 * @param {string} results_text - the results text to truncate
 * @param {number|null} res_number_to_keep - the number of results to keep
 * @param {number|null} max_number_of_char - the maximum number of characters to keep in the results text
 * @returns 
 */
function truncateResults(results_text, res_number_to_keep, max_number_of_char = null) {
    let resultsArray;
    let truncated_results_text = results_text;
    try {
        resultsArray = JSON.parse(truncated_results_text);
    } catch (e) {
        resultsArray = [];
    }

    //truncate the results if there are too many
    if (res_number_to_keep != null && resultsArray.length > res_number_to_keep) {
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
 * Evaluate a SPARQL query and return the results
 * @param {string} sparqlQuery - The SPARQL query to evaluate
 * @param {boolean} withLabels - If true, add labels to the results for Wikidata URIs
 * @returns {Promise<Object>} - The results of the SPARQL query
 */
async function getQueryResults(sparqlQuery, withLabels) {
    let results = await sparklis.evalSparql(sparqlQuery);
    //todo set with labels to true

    // If the query is an ASK query, replace the results with a boolean value (like other query services would do) //todo check it's always true and not just for wikidata
    if (results && isAskQuery(sparqlQuery)) { //the query also needs to not return an error
        results = results.rows.length > 0;
    } else if (withLabels && results && results.rows) { //only look for labels if needed
        for (let row of results.rows) {
            for (let value of row) {
                // for each value, if it is a wikidata uri, add the corresponding label from wikidata
                if (value && value.type === "uri" && value.uri.startsWith("http://www.wikidata.org/")) {
                    value.label = await getWikidataLabel(value.uri);
                }
            }
        }
    }
    return results;
}

/**
 * Check if a SPARQL query is an ASK query
 * @param {string} sparqlQuery - the SPARQL query to check
 * @returns 
 */
function isAskQuery(sparqlQuery) {
  if (typeof sparqlQuery !== 'string') return false;
  const trimmed = sparqlQuery.trim().toUpperCase();
  // Check if the query starts with ASK after optional PREFIX declarations
  const askRegex = /^(?:\s*PREFIX\s+\w*:\s*<[^>]*>\s*)*ASK\b/;
  return askRegex.test(trimmed);
}

