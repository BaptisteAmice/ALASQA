//Dependencies: qa_extension.js, llm_add_interface_extension.js, llm_utils.js
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

    //let systemMessage = "Your task is to build commands to query the knowledge graph to find data that answers the given question. Several successive commands can be used and should be separated by a semicolon. For example, to find the parent of Einstein, you can use the following reasoning and commands: \n <think>Einstein is a person, and his parents are the people who have him as a child</think>. \n<commands>a person; has child; Albert Einstein;</commands>.\n Another example with the question 'Which animal is from the camelini family?':<think>I need to find ANIMALS, that are members of a FAMILY, and this family needs to be camelini.</think><commands>a animal ; has family ; camelini;</commands> \n As in the examples, you don't need to anwer to the question but to make a quick reasonning about which kind of entity you need to find in the graphe and then construct a command in the same format to find the corresponding data in the knowledge graph.";
    let systemMessage = prompt_template;
    let userMessage;

    ////EXTRACTION

    questionId = addLLMQuestion(input_question);
   
    let output = await sendPrompt(
        usualPrompt(systemMessage, input_question), 
        true, 
        (text) => updateReasoning(questionId, text) // Capture `questionId` and send `text`
    );    

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
        let results = place.results(); //todo c'est pas la réponse en fait...
        console.log(results);
        console.log('rows',results.rows);
        let rows = results.rows;
        let resultText = rows.map(item => item[0].uri).join(', '); //todo check
        console.log("result",resultText);


        //todo check error avant prompt 2//if output ="" -> no result
        //todo automated input list -> output save
       
       
        //to answer : check if command has halted, and test if command field is empty
        //command failed: failing command

        //todo trouver vrai réponse
        //todo regler probleme empty string
        //todo desactiver boutons et input pdt generation

        updateAnswer(questionId, resultText)
        
    });    
    
}

const prompt_template = `
Your goal is to construct commands that retrieve data from a knowledge graph to answer a question. Commands follow a structured syntax and are separated by semicolons (;).  

### Syntax:  
- \`a <class>\` → Retrieves entities of a class (e.g., \`a person\`).  
- \`has <property>\` → Filters by a property (e.g., \`has director\`).  
- \`is <property> of\` → Reverse relation (e.g., \`is director of\`).  
- \`> <value>\`, \`< <value>\`, \`between <v1> and <v2>\` → Value constraints.  
- \`after <date>\`, \`before <date>\` → Time constraints.  
- \`asc\`, \`desc\` → Sorting.  
- \`and\`, \`or\`, \`not\` → Logical operators.  
- \`up\`, \`down\` → Navigation.  

### Examples:  
**Who are Einstein’s parents?**  
\`<think>Einstein is a person, and his parents have him as a child.</think>\`  
\`<commands>a person; has child; Albert Einstein;</commands>\`  

**Which animals belong to Camelini?**  
\`<think>Find ANIMALS in the Camelini FAMILY.</think>\`  
\`<commands>a animal; has family; camelini;</commands>\`  

**Movies by Spielberg or Tim Burton after 1980**  
\`<think>Find FILMS by Spielberg or Burton released after 1980.</think>\`  
\`<commands>a film; has director; Tim Burton; or; Spielberg; has release date; after 1980;</commands>\`  
`;