document.addEventListener("DOMContentLoaded", function () {
    let style = document.createElement("style");
    style.textContent = `
        .chatbot-menu-container {
            position: fixed;
            right: 20px;
            top: 60px;
            z-index: 1000;
            font-family: Arial, sans-serif;
        }
        .chatbot-menu-button {
            background: #007BFF;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s;
        }
        .chatbot-menu-button:hover {
            background: #0056b3;
        }
        .chatbot-menu {
            display: none;
            position: absolute;
            right: 0;
            top: 50px;
            width: 300px;
            background: white;
            padding: 15px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border-radius: 5px;
            max-height: 400px;
            overflow-y: auto;
            border:1px solid black;
        }
        .chatbot-menu input, .chatbot-menu button {
            width: 100%;
            margin-bottom: 10px;
            padding: 8px;
            font-size: 14px;
        }
        .chatbot-menu input {
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .chatbot-menu button {
            background: #28a745;
            color: white;
            border: none;
            cursor: pointer;
            border-radius: 5px;
            transition: background 0.3s;
        }
        .chatbot-menu button:hover {
            background: #218838;
        }
        .chatbot-download-button {
            background: #ffc107;
            color: black;
        }
        .chatbot-download-button:hover {
            background: #e0a800;
        }
        .chatbot-responses-container {
            border-top: 1px solid #ddd;
            margin-top: 10px;
            padding-top: 10px;
            max-height: 200px;
            overflow-y: auto;
        }
        .chatbot-response {
            background: #f8f9fa;
            padding: 10px;
            margin-bottom: 5px;
            border-radius: 5px;
        }
    `;
    document.head.appendChild(style);
    
    let container = document.createElement("div");
    container.classList.add("chatbot-menu-container");
    
    let button = document.createElement("button");
    button.classList.add("chatbot-menu-button");
    button.id = "chatbot-menu-button";
    button.textContent = "☰ LLMQA";
    button.onclick = function () {
        menu.style.display = (menu.style.display === "none" || menu.style.display === "") ? "block" : "none";
    };
    
    let menu = document.createElement("div");
    menu.classList.add("chatbot-menu");
    menu.style.display = "none";
    

    let input_div = document.createElement("div");

    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type your question here";
    input.id = "user-input";
    input.classList.add("disabled-during-request");
    input_div.appendChild(input);

    let input_button = document.createElement("button");
    input_button.textContent = "Send";
    input_button.onclick = function () {
        qa_control();
    };
    input_button.id = "input-send-button";
    input_button.classList.add("disabled-during-request");
    input_div.appendChild(input_button);

    
    let fileUpload = document.createElement("input");
    fileUpload.type = "file";
    fileUpload.accept = ".txt,.csv";
    
    let downloadButton = document.createElement("button");
    downloadButton.classList.add("chatbot-download-button");
    downloadButton.textContent = "Télécharger Réponses";
    downloadButton.onclick = function () {
        let blob = new Blob([JSON.stringify(questionsData, null, 2)], { type: "application/json" });
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "questions_data.json";
        a.click();
    };

    let clearSessionButton = document.createElement("button");
    clearSessionButton.classList.add("chatbot-clear-button");
    clearSessionButton.id = "chatbot-clear-button";
    clearSessionButton.textContent = "Effacer les données";
    clearSessionButton.onclick = function () {
        clearQuestionData();
    };
    
    let responseContainer = document.createElement("div");
    responseContainer.classList.add("chatbot-responses-container");
    responseContainer.id = "chatbot-responses-container";
    
    menu.appendChild(input_div);
    //menu.appendChild(fileUpload);
    menu.appendChild(downloadButton);
    menu.appendChild(clearSessionButton);
    menu.appendChild(responseContainer);
    container.appendChild(button);
    container.appendChild(menu);
    document.body.appendChild(container);
});


// Logic

let questionsData = JSON.parse(sessionStorage.getItem("questionsData")) || [];
let questionCounter = questionsData.length || 0;

function saveQuestionsData() {
    sessionStorage.setItem("questionsData", JSON.stringify(questionsData));
}

function clearQuestionData() {
    sessionStorage.removeItem("questionsData");
    questionsData = [];
    document.getElementsByClassName("chatbot-responses-container")[0].innerHTML = "";
    questionCounter = 0;
}

function addLLMQuestion(question) {
    let questionId = `question-${questionCounter}`;
    let qaDiv = document.createElement("div");
    qaDiv.classList.add("chatbot-qa");
    qaDiv.dataset.id = questionId;
    
    let questionDiv = document.createElement("div");
    questionDiv.classList.add("chatbot-question");
    questionDiv.textContent = question;
    let questionHeader = document.createElement("h6");
    questionHeader.textContent = "Question";
    
    let reasoningDiv = document.createElement("div");
    reasoningDiv.classList.add("chatbot-reasoning");
    reasoningDiv.textContent = "...";
    let reasoningHeader = document.createElement("h6");
    reasoningHeader.textContent = "Reasoning";

    let sparklisRequestDiv = document.createElement("div");
    sparklisRequestDiv.classList.add("sparklis-request");
    sparklisRequestDiv.textContent =  "...";
    let sparklisHeader = document.createElement("h6");
    sparklisHeader.textContent = "Sparklis Request";

    let sparqlRequestDiv = document.createElement("div");
    sparqlRequestDiv.classList.add("sparql-request");
    sparqlRequestDiv.textContent = "...";
    let sparqlHeader = document.createElement("h6");
    sparqlHeader.textContent = "Sparql Request";
    
    let answerDiv = document.createElement("div");
    answerDiv.classList.add("chatbot-answer");
    answerDiv.textContent = "...";
    let answerHeader = document.createElement("h6");
    answerHeader.textContent = "Answer";
    
    qaDiv.appendChild(questionHeader);
    qaDiv.appendChild(questionDiv);
    qaDiv.appendChild(reasoningHeader);
    qaDiv.appendChild(reasoningDiv);
    qaDiv.appendChild(sparklisHeader);
    qaDiv.appendChild(sparklisRequestDiv);
    qaDiv.appendChild(sparqlHeader);
    qaDiv.appendChild(sparqlRequestDiv);
    qaDiv.appendChild(answerHeader);
    qaDiv.appendChild(answerDiv);
    
    let responseContainer = document.getElementById("chatbot-responses-container");
    responseContainer.appendChild(qaDiv);
    responseContainer.scrollTop = responseContainer.scrollHeight;
    
    questionsData.push({ id: questionId, question, reasoning: "", sparklis_request: "",
        sparql_request: "", answer: "" });
    saveQuestionsData();
    
    questionCounter++;
    return questionId;
}

function loadQuestionsFromSession() {
    questionsData.forEach(data => {
        let qaDiv = document.createElement("div");
        qaDiv.classList.add("chatbot-qa");
        qaDiv.dataset.id = data.id;
        
        let questionDiv = document.createElement("div");
        questionDiv.classList.add("chatbot-question");
        questionDiv.textContent = data.question;
        let questionHeader = document.createElement("h6");
        questionHeader.textContent = "Question";
        
        let reasoningDiv = document.createElement("div");
        reasoningDiv.classList.add("chatbot-reasoning");
        reasoningDiv.textContent = data.reasoning;
        let reasoningHeader = document.createElement("h6");
        reasoningHeader.textContent = "Reasoning";

        let sparklisRequestDiv = document.createElement("div");
        sparklisRequestDiv.classList.add("sparklis-request");
        sparklisRequestDiv.textContent = data.sparklis_request;
        let sparklisHeader = document.createElement("h6");
        sparklisHeader.textContent = "Sparklis Request";

        let sparqlRequestDiv = document.createElement("div");
        sparqlRequestDiv.classList.add("sparql-request");
        sparqlRequestDiv.textContent = data.sparql_request;
        let sparqlHeader = document.createElement("h6");
        sparqlHeader.textContent = "Sparql Request";
        
        let answerDiv = document.createElement("div");
        answerDiv.classList.add("chatbot-answer");
        answerDiv.textContent = data.answer;
        let answerHeader = document.createElement("h6");
        answerHeader.textContent = "Answer";
        
        qaDiv.appendChild(questionHeader);
        qaDiv.appendChild(questionDiv);
        qaDiv.appendChild(reasoningHeader);
        qaDiv.appendChild(reasoningDiv);
        qaDiv.appendChild(sparklisHeader);
        qaDiv.appendChild(sparklisRequestDiv);
        qaDiv.appendChild(sparqlHeader);
        qaDiv.appendChild(sparqlRequestDiv);
        qaDiv.appendChild(answerHeader);
        qaDiv.appendChild(answerDiv);
        
        document.getElementById("chatbot-responses-container").appendChild(qaDiv);
    });
}

document.addEventListener("DOMContentLoaded", loadQuestionsFromSession);

function updateReasoning(questionId, reasoning) {
    let qa = document.querySelector(`.chatbot-qa[data-id='${questionId}']`);
    if (qa) {
        qa.querySelector(".chatbot-reasoning").textContent = reasoning;
        let questionData = questionsData.find(q => q.id === questionId);
        if (questionData) {
            questionData.reasoning = reasoning;
            saveQuestionsData();
        }
    }
}

function updateAnswer(questionId, answer, sparklis_request = "", sparql_request = "") {
    let qa = document.querySelector(`.chatbot-qa[data-id='${questionId}']`);
    if (qa) {
        qa.querySelector(".sparklis-request").textContent = sparklis_request;
        qa.querySelector(".sparql-request").textContent = sparql_request;
        qa.querySelector(".chatbot-answer").textContent = answer;
        let questionData = questionsData.find(q => q.id === questionId);
        if (questionData) {
            questionData.sparklis_request = sparklis_request;
            questionData.sparql_request = sparql_request;
            questionData.answer = answer;
            saveQuestionsData();
        }
    }
}


function disableInputs() {
    let inputs = document.querySelectorAll(".disabled-during-request");
    inputs.forEach(input => input.disabled = true);
}

function enableInputs() {
    let inputs = document.querySelectorAll(".disabled-during-request");
    inputs.forEach(input => input.disabled = false);
}