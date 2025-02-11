console.log("LLM with QA extension active");

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

async function qa_control() {
    //reset sparklis
    sparklis.home();

    let input_field = document.getElementById("user-input");
    let input_question = input_field.value;
    let responseTextBalise = document.getElementById("response");
    let responseTextBalise2 = document.getElementById("response2");

    let systemMessage = "Your task is to build commands to query the knowledge graph to find data that answers the given question. Several successive commands can be used and should be separated by a semicolon. For example, to find the parent of Einstein, you can use the following reasoning and commands: \n <think>Einstein is a person, and his parents are the people who have him as a child</think>. \n<commands>a person; has child; Albert Einstein</commands>.\n Another example with the question 'Which animal is from the camelini family?':<think>I need to find ANIMALS, that are members of a FAMILY, and this family needs t be camelini.</think><commands>a animal ; has family ; camelini</commands> \n As in the examples, you don't need to anwer to the question but to make a quick reasonning about which kind of entity you need to find in the graphe and then construct a command in the same format to find the corresponding data in the knowledge graph.";
    let userMessage;

    ////EXTRACTION
   
    let output = await sendPrompt(usualPrompt(systemMessage, input_question), streamOption = true, outputField = responseTextBalise);
    //let output = 'blablabla<commands>a animal ; has family ; camelini</commands>dsfsd';
    //get commands from regular expression <commands>...</commands>
    let match = output.match(/<commands>(.*?)<\/commands>/s);
    
    let commands = match ? match[1].trim() : "output malformated"; 
    let qa = document.getElementById("qa");
    
    if (commands) {
        qa.value = commands;  // Safe access since we checked if commands is not null
    } else {
        console.error("No match found for <commands>...</commands>");
        qa.value = "Error";
        return;
    }

    //wait for the endpoint to be ready //todo plus élégamment
    await new Promise(r => setTimeout(r, 2000));

    //Execute commands
    let event = new KeyboardEvent('keyup', { 'keyCode': 13 });
    qa.dispatchEvent(event);

    //wait for the endpoint to be ready //todo plus élégamment
    await new Promise(r => setTimeout(r, 2000));
    
    //get sparklis results from the commands
    let place = sparklis.currentPlace();

    place.onEvaluated(async () => {
        console.log("evaluated");
        let results = place.results();
        console.log(results);
        console.log('rows',results.rows);
        let rows = results.rows;
        let resultText = rows.map(item => item[0].uri).join(', '); //todo check
        console.log("result",resultText);


        //todo check error avant prompt 2//if output ="" -> no result
        //todo prompt 2

        ////REASONING

        let systemMessage2 = "Your task was to build commands to query the knowledge graph to find data that answers the given question. The question will be repeated to you, with the results you found. Use them to answer the question. Just write the answer and nothing else.";
        let userMessage2 = input_question + " : " + resultText;
        //todo très lent et résultat très mauvais
        let output2 = await sendPrompt(usualPrompt(systemMessage2, userMessage2), streamOption = true, outputField = responseTextBalise2);
        console.log("output",output);
    });    
    
}