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
    let input_field = document.getElementById("user-input");
    input = input_field.value;
    let responseTextBalise = document.getElementById("response");
    systemMessage = "Your task is to build commands to query the knowledge graph to find data that answers the given question. Several successive commands can be used and should be separated by a semicolon. For example, to find the parent of Einstein, you can use the following reasoning and commands: \n <think>Einstein is a person, and his parents are the people who have him as a child</think>. \n<commands>a person; has child; Albert Einstein</commands>. \n As in the example, you don't need to anwer to the question but to make a quick reasonning about which kind of entity you need to find in the graphe and then construct a command in the same format to find the corresponding data in the knowledge graph.";

   
    //let output = await sendPrompt(usualPrompt(systemMessage, input), streamOption = true, outputField = responseTextBalise);
    let output = 'blablabla<commands>a animal ;</commands>dsfsd';
    //get commands from regular expression <commands>...</commands>
    let match = output.match(/<commands>(.*?)<\/commands>/s);
    
    let commands = match ? match[1].trim() : "output malformated"; 
    let qa = document.getElementById("qa");
    
    if (commands) {
        qa.value = commands;  // Safe access since we checked if commands is not null
    } else {
        console.error("No match found for <commands>...</commands>");
    }


    //Execute commands
    let event = new KeyboardEvent('keyup', { 'keyCode': 13 });
    qa.dispatchEvent(event);
    
    //get sparklis results from the commands //todo
    let sparql = p.sparql();
    console.log(sparql);
    //console.log(sparklis.evalSparql(sparql));
    //p.sparql(): string
    //sparklis.evalSparql(query: string): Promise(sparklis-results, int)
}