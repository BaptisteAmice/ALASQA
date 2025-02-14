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

    //wait for the endpoint to be ready //todo plus élégamment (compliqué tant que je me base sur l'input field et pas l'api)
    await new Promise(r => setTimeout(r, 1000));
    let i = 0;
    while (qa.value != "" && i < 10) {
        console.log("Waiting for commands to finish");
        await new Promise(r => setTimeout(r, 1000));
        i++;
    }
    if (qa.value != "") {
        console.log("Commands failed to finish");
        //todo voir si on fait ca
        let resultText = "Commands failed to finish";
        updateAnswer(questionId, resultText);
    }
    
    //get sparklis results from the commands
    let place = sparklis.currentPlace();

    place.onEvaluated(async () => {
        console.log("evaluated");
        let sparql = place.sparql();
        let results = await sparklis.evalSparql(sparql); 
        console.log(results);
        console.log('rows',results.rows);
        let rows = results.rows;
        let resultText = "Query: " + sparql + "\n" + "Results: \n" + rows.map(row => row.join(', ')).join('\n');
        console.log("result",resultText);
       
        //todo desactiver boutons et input pdt generation

        updateAnswer(questionId, resultText)
        
    });    
    
}

const prompt_template = `
Your goal is to generate commands that query a knowledge graph to find answers to a given question.  

## Format:  
1. Always start by reasoning about what entities and relationships are needed. Wrap this in <think>...</think>.  
2. Translate this reasoning into structured commands, separated by semicolons (;), and wrap them in <commands>...</commands>.  

## Command Syntax:  
- a <class> → Retrieve entities of a class (e.g., a person).  
- has <property> → Filter by property (e.g., has director).  
- is <property> of → Reverse relation (e.g., is director of).  
- > <value>, < <value>, between <v1> and <v2> → Value constraints.  
- after <date>, before <date> → Time constraints.  
- asc, desc → Sorting.  
- and, or, not → Logical operators.  
- up, down → Navigation.  

## Examples:  
Q: Who are Einstein’s parents?  
A: <think>Einstein is a person. His parents are people who have him as a child.</think>  
<commands>a person; has child; Albert Einstein;</commands>  

Q: Which animals belong to Camelini?  
A: <think>Find ANIMALS in the Camelini FAMILY.</think>  
<commands>a animal; has family; camelini;</commands>  

Q: Movies by Spielberg or Tim Burton after 1980?
A: <think>Find FILMS by Spielberg or Burton released after 1980.</think>  
<commands>a film; has director; Tim Burton; or; Spielberg; has release date; after 1980;</commands>  
`;
