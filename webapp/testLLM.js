console.log("testLLM extension active");

// upon window load... create text field and ENTER handler
window.addEventListener(
    'load',
    function(ev) {
	let qa = document.getElementById("user-input");
	qa.addEventListener("keyup", function(event) {
	    if (event.keyCode == 13) { // ENTER
            sendPrompt();
	    }
	})
});

const api = "http://localhost:1234/v1/chat/completions";

async function sendPrompt() {
    const inputBalise = document.getElementById("user-input");
    const input = [
        {"role": "system", "content": "You are a component of a Question Answering system having access to knowledge graphs through an interface named Sparklis. When an user ask a question, you have to identify Entities, Relations and Literals in this question. For example : Q: Who are the parent of Einstein? A: a person ; has child ; Albert Einstein"},
        {"role": "user", "content": inputBalise.value}
    ]
    const responseTextBalise = document.getElementById("response");

    let streamOption = true;


    try {
        let place = sparklis.currentPlace();
        let constNoConstraint = "True";
        let constrPersonne = { type: "MatchesAll", kwds: ["person"]};
        //console.log(sparklis.termConstr()); 
        //console.log(sparklis.conceptConstr()); 
        console.log("relation",await place.getConceptSuggestions(false,constNoConstraint)); //chercher relation
        console.log("valeurs",await place.getTermSuggestions(false,constNoConstraint)); //chercher valeur
        console.log("valeurs",await place.getModifierSuggestions(false,constNoConstraint));

        
        //sparklis.setConceptConstr(constr: sparklis-constr):
        
        //console.log(sparklis.propertyLabels());

        console.log(place.query());
          


        console.log("tt est bon")

              
        const response = await fetch(api, {
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
                responseTextBalise.textContent = text;
            }
        } else {
            const data = await response.json();
            text = data["choices"][0]["message"]["content"] || "No response"
            responseTextBalise.textContent = text;
        }

        let qa = document.getElementById("qa");
        qa.value = text;
        
    } catch (error) {
        responseTextBalise.textContent = "Error: " + error.message;
    }
}


// You are a Question Answering agent having access to wikidata knowledge graph through an interface named Sparklis. 
// When an user ask a question, you have to use the tools you have at disposition to respond.
// At each user's message, you will have to think, then finish your message by choosing an action among the following ones:

//The user question is : "..."
//You have made the question: "..." in Sparklis.
//Do you think the question is sufficient ? FInish your answer by: Response[Yes] or Response[No]



//todo option télécharger log conversation


//todo peut écrire steps et les met danx le champ QA


