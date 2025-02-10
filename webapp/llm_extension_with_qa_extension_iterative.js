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
    
    //todo
    /*
    systemMessage = "Your task is to build commands to query the knowledge graph to find data that answers the given question. Several successive commands can be used and should be separated by a semicolon. For example, to find the parent of Einstein, you can use the following reasoning and commands: \n REASONING[Einstein is a person, and his parents are the people who have him as a child]. \nCOMMANDS[a person; has child; Albert Einstein]. \n You need to reason accordingly and construct a command in the same format to answer the following question.";

    output = await sendPrompt(usualPrompt(systemMessage, input), streamOption = true, outputField = responseTextBalise);

    //get commands from regular expression COMMANDS[.*]
    let commands = output.match(/COMMANDS\[(.*)\]/);*/

    let qa = document.getElementById("qa");
    qa.value = commands[1];


}