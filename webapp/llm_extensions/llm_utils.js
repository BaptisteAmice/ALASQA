console.log("LLM utility active");

const DefaultALASQAConfig = {
    api_url: "http://localhost:1234/v1/chat/completions",
    nl_post_processing: true,
};

// Initialize sessionStorage if not set (we use sessionStorage to have it updated each time the page is loaded)
if (!sessionStorage.getItem("ALASQAConfig")) {
    sessionStorage.setItem("ALASQAConfig", JSON.stringify(DefaultALASQAConfig));
}

// Getter
function getALASQAConfig() {
    try {
        return JSON.parse(sessionStorage.getItem("ALASQAConfig")) || DefaultALASQAConfig;
    } catch (e) {
        sessionStorage.setItem("ALASQAConfig", JSON.stringify(DefaultALASQAConfig));
        return DefaultALASQAConfig;
    }
}

// Setter
function setALASQAConfig(newConfig) {
    const current = getALASQAConfig();
    const updated = { ...current, ...newConfig };
    sessionStorage.setItem("ALASQAConfig", JSON.stringify(updated));
}

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
        const response = await fetch(getALASQAConfig().api_url, {
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
    if (results && results.rows && isAskQuery(sparqlQuery)) { //the query also needs to not return an error
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

/**
 * Extract URIs from a list of SPARQL queries.
 * This function looks for both full URIs (like <http://www.wikidata.org/entity/Q5>)
 * and prefixed URIs (like wd:Q5, p:P735, etc.).
 * It returns a list of unique URIs found in the queries.
 * It only return the last part of the URI (after the last slash, hash, or colon).
 * @param {list<string>} queries 
 * @returns 
 */
function extract_uris_from_string_list(queries) {
  const uris = [];

  const fullUriRegex = /<([^>]+)>/g;
  const prefixedUriRegex = /\b(?:\w+):(\w+)\b/g;

  for (const query of queries) {
    let match;

    // Match full URIs like <http://www.wikidata.org/entity/Q5>
    while ((match = fullUriRegex.exec(query)) !== null) {
      const fullUri = match[1];
      const lastSlashIndex = fullUri.lastIndexOf('/');
      const lastHashIndex = fullUri.lastIndexOf('#');
      const lastColonIndex = fullUri.lastIndexOf(':');
      const delimiterIndex = Math.max(lastSlashIndex, lastHashIndex, lastColonIndex);
      const finalPart = fullUri.substring(delimiterIndex + 1);
      if (finalPart !== "") {
        uris.push(finalPart);
      }
    }

    // Match prefixed names like wd:Q5, p:P735, etc.
    while ((match = prefixedUriRegex.exec(query)) !== null) {
      uris.push(match[1]);
    }
  }

  // Remove duplicates
  const unique_uris = [...new Set(uris)];
  return unique_uris;
}

/**
 * Combines two SPARQL SELECT queries into a boolean ASK query with a comparison operator.
 * If the SELECT variables have the same name, rename the second variable to avoid collision.
 *
 * @param {string} query1 - First SPARQL SELECT query
 * @param {string} query2 - Second SPARQL SELECT query
 * @param {string} operator - Comparison operator ('=', '!=', '<', '>', 'IN', 'NOT IN', etc.)
 * @returns {string} - Combined SPARQL ASK query
 */
function combineSparqlQueries(query1, query2, operator) {
  // Extract first variable from SELECT clause
  const extractSelectVar = (query) => {
    const selectMatch = query.match(/SELECT\s+(?:DISTINCT\s+)?([\s\S]+?)WHERE/i);
    if (!selectMatch) throw new Error("Could not find SELECT clause.");
    const vars = selectMatch[1].match(/\?[a-zA-Z_][\w]*/g);
    if (!vars || vars.length === 0) throw new Error("No variable found in SELECT.");
    return vars[0]; // Use first variable
  };

  // Extract WHERE pattern (contents inside {...})
  const extractPattern = (query) => {
    const whereMatch = query.match(/WHERE\s*{([\s\S]+?)}\s*(LIMIT|ORDER|$)/i);
    if (!whereMatch) throw new Error("Could not extract WHERE clause.");
    return whereMatch[1].trim();
  };

  const var1 = extractSelectVar(query1);
  let var2 = extractSelectVar(query2);
  let pattern2 = extractPattern(query2);

  // If variable names collide, rename var2 and replace in pattern2
  if (var1 === var2) {
    const newVar2 = var2 + "_2";
    // Replace var2 occurrences with newVar2 in pattern2, with word boundary to avoid partial matches
    const regexVar2 = new RegExp(`\\${var2}\\b`, "g");
    pattern2 = pattern2.replace(regexVar2, newVar2);
    var2 = newVar2;
  }

  const pattern1 = extractPattern(query1);

  // Compose ASK query with FILTER
  let askQuery = `ASK {\n`;
  askQuery += `  {\n    ${pattern1}\n  }\n`;
  askQuery += `  {\n    ${pattern2}\n  }\n`;

  if (["=", "!=", "<", ">", "<=", ">="].includes(operator)) {
    askQuery += `  FILTER (${var1} ${operator} ${var2})\n`;
  } else if (operator.toUpperCase() === "IN") {
    askQuery += `  FILTER (${var1} IN (${var2}))\n`;
  } else if (operator.toUpperCase() === "NOT IN") {
    askQuery += `  FILTER (${var1} NOT IN (${var2}))\n`;
  } else {
    throw new Error(`Unsupported operator: ${operator}`);
  }

  askQuery += `}`;

  return askQuery;
}


/**
 * Fix problems of queries generated by the LLM.
 * Remove comments, patch invalid triples.
 * @param {string} query 
 * @returns 
 */
function get_patched_query(query) {
    let patched_query = query;
    // First, strip trailing comments between '#' and '}'
    patched_query = patched_query.replace(/#[^{}\n]*\}/g, (match) => {
        // keep the closing brace
        return " }";
    });

    // Don't patch inside FILTER, VALUES, etc.
    const forbidden_patterns = /(FILTER|VALUES|BIND|MINUS|OPTIONAL|UNION)[\s\S]*?{[^}]*p:P\d+\s+wd:Q\d+/i;
    if (forbidden_patterns.test(patched_query)) {
        return patched_query;
    }

    // Match triples using p: directly with wd: object
    const triple_regex = /([?\w\d:]+)\s+p:(P\d+)\s+wd:(Q\d+)\s*\.\s*/g;

    let match;
    const replacements = [];

    while ((match = triple_regex.exec(patched_query)) !== null) {
        const [fullMatch, subj, prop, obj] = match;
        const stmtVar = `?stmt_${prop}_${obj}`;
        const patched = `${subj} p:${prop} ${stmtVar} .\n${stmtVar} ps:${prop} wd:${obj} .`;
        replacements.push({ fullMatch, patched });
    }

    for (const { fullMatch, patched } of replacements) {
        patched_query = patched_query.replace(fullMatch, patched);
        console.warn(`Patched invalid triple: ${fullMatch.trim()}`);
    }

    return patched_query;
}
