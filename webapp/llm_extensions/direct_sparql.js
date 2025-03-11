//Dependencies: llm_add_interface_extension.js, llm_utils.js
console.log("LLM with QA extension active");

/////// Steps status ////////

STATUS_NOT_STARTED = "Not started";
STATUS_ONGOING = "ONGOING";
STATUS_DONE = "DONE";
STATUS_FAILED = "FAILED";

var steps_status = {
    "0" : { "Name" : "Start", "Status" : STATUS_NOT_STARTED },
    "1" : { "Name" : "LLM generation", "Status" : STATUS_NOT_STARTED },
    "2" : { "Name" : "Retrieving SPARQL", "Status" : STATUS_NOT_STARTED },
    "3" : { "Name" : "Parsing res. for display", "Status" : STATUS_NOT_STARTED },
};

function resetStepsStatus() {
    for (let step in steps_status) {
        steps_status[step]["Status"] = STATUS_NOT_STARTED;
    }
}

function updateStepsStatus(step, status) {
    steps_status[step.toString()]["Status"] = status;
    localStorage.setItem("steps_status", JSON.stringify(steps_status));
}

/////// System ////////

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
    resetStepsStatus(); // Reset steps for each new question
    clearAlerts(); // Clear alerts for each new question
    currentStep = 0;
    updateStepsStatus(currentStep, STATUS_DONE);

    //reset sparklis
    sparklis.home();

    //todo
    `what is the boiling point of water ?
    think step by step about how to generate the sparql query able to answer this question and put the resulting query in in the balises
    <query>SELECT ... { ... }</query>
    the used endpoint is wikidata.`
}

