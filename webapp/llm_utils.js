console.log("LLM utility active");

const API = "http://localhost:1234/v1/chat/completions";

function usualPrompt(systemPrompt, userPrompt) {
    return [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": userPrompt}
    ];
}

async function sendPrompt(input, streamOption = true, outputField = null) {
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

                if (outputField != null) {
                    outputField.textContent = text;
                }   
            }
        } else {
            const data = await response.json();
            text = data["choices"][0]["message"]["content"] || "No response"

            if (outputField != null) {
                outputField.textContent = text;
            }
        }
        return text;
    } catch (error) {
        return "Error: " + error.message;
    }
}
