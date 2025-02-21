console.log("LLM utility active");

const API = "http://localhost:1234/v1/chat/completions";

function usualPrompt(systemPrompt, userPrompt) {
    return [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": userPrompt}
    ];
}

async function sendPrompt(input, streamOption = true, updateCallback = null) {
    //careful the first parameter can be interpreted as several parameters...
    try {
        const response = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: input, stream : streamOption })
        });
        console.log("Ongoing...")
        let text = "";
        if (streamOption) {
            let reader = response.body.getReader();
            let result;
            let decoder = new TextDecoder('utf-8');
            let done = false;
            while (!done) {
                result = await reader.read();
                let chunk = decoder.decode(result.value);
                console.log(chunk);
                //postprocess to be able to parse string into json
                let chunkDataString = chunk.slice(6).trim(); // remove "data:"
                chunkDataString = chunkDataString.replace (/\ndata: \[DONE\]$/g, (match) => {
                    done = true; //end of stream
                    return ''; //remove matched part
                });

                let chunkData = JSON.parse(chunkDataString);
                text += chunkData.choices[0].delta["content"] || '';

                if (updateCallback != null) {
                    updateCallback(text);
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

////////// COMMANDS //////////
//todo à voir si on fait vraiment ca

const QueryTypes = {
    // Commands to get knowledge from the endpoint
    filter: "filter", // TypesAndRelations | IdentitiesOrValues | AggregationsAndOperators
    getSuggestions: "getSuggestions", // TypesAndRelations | IdentitiesOrValues | AggregationsAndOperators
    getResults: "getResults", // Execute outside of Sparklis to not be too dependent

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