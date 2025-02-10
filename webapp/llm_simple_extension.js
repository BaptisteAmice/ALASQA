console.log("LLM simple extension active");

// upon window load... create text field and ENTER handler
window.addEventListener(
    'load',
    function(ev) {
	let input_field = document.getElementById("user-input");
	input_field.addEventListener("keyup", function(event) {
	    if (event.keyCode == 13) { // ENTER
            //todo
	    }
	})
});

//todo