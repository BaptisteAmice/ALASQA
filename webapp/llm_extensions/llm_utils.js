console.log("LLM utility active");

const API = "http://localhost:1234/v1/chat/completions";

function usualPrompt(systemPrompt, userPrompt) {
    return [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": userPrompt}
    ];
}

async function sendPrompt(input, streamOption = true, updateCallback = null, usedTemperature = 0.8) {
    //careful the first parameter can be interpreted as several parameters...
    try {
        const response = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: input, temperature: usedTemperature,  stream : streamOption })
        });
        console.log("Ongoing...")
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
function removePrefixes(sparqlQuery) {
    return sparqlQuery.split('\n')
        .filter(line => !line.startsWith('PREFIX'))
        .join('\n');
}

function countCommands(commands) {
    return commands.split(";").filter(cmd => cmd.trim().length > 0).length;
}

/**
 * Convert place.onEvaluated() to a promise to avoid nested callbacks
 * @param {*} place
 * @returns 
 */
function waitForEvaluation(place) {
    return new Promise((resolve) => {
        place.onEvaluated(() => {
            resolve();
        });
    });
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

async function getSuggestions() {
    //place needs to be evaluated
    //await sparklis.currentPlace().getConceptSuggestions(false,sparklis.conceptConstr());
    //les 2 autres
    return; //todo
}

function pickSuggestion() {
    //applySuggestion
    return; //todo
}

async function getResults() {
    //todo
    return await sparklis.evalSparql(removePrefixes(sparklis.currentPlace().sparql()));
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