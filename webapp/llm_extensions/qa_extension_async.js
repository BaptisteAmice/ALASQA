// reporting that this extension is active
console.log("QA extension active");

var LAST_INITIATED_COMMAND = null; //used in case of error, to know which command was initiated last (code to update for each command needing it
var LAST_RESOLVED_COMMAND = null; //used in case of error, to know which command was resolved last (code to update for each command needing it
var previous_step = null; //used to store the previous command, to be able to go back to it if needed
var temp_patch_needed = false; //used to know if a temporary patch is needed (code to update for each command needing it

// upon window load... create text field and ENTER handler
window.addEventListener(
    'load',
    function(ev) {
	let qa = document.getElementById("qa");
	qa.addEventListener("keyup", function(event) {
	    if (event.keyCode == 13) { // ENTER
		event.stopPropagation();
		process_question(qa);
	    }
	})
});

/* processing a question, i.e. a sequence of steps */

/**
 * Process user question, available in qa HTML element.
 * Errors can be thrown by this function and should be handled by the caller.
 * @param {*} qa 
 * @returns 
 */
async function process_question(qa) {
	qa.disabled = true; // disable the input field to prevent multiple submissions
	LAST_INITIATED_COMMAND = null; // reset the previous command
	LAST_RESOLVED_COMMAND = null; // reset the previous command
	previous_step = null; // reset the previous step
    let question = qa.value;
	question = correct_command_chain_syntax(question); //patch malformed command chain syntax
    console.log("Question: " + question);
    let steps = question.split(/\s*;\s*/).filter(s => s !== '');
    console.log("Steps: " + steps);
    let place = sparklis.currentPlace();

	let commands_algo = "beam_search";
	let final_place;
	switch (commands_algo) {
		case "depth_first_search":
			final_place =  await depth_first_search(qa, steps, place, number_of_top_sugg_considered = 3);
			break;
		case "beam_search":
			//final_place = await beam_search(qa, steps, place, number_of_top_sugg_considered = 6, beam_width = 3);
			final_place = await beam_search(qa, steps, place, number_of_top_sugg_considered = 3, beam_width = 3);
			break;
		case "none":
		default:
    		final_place = await process_steps(qa, place, steps);
	}
	qa.disabled = false; // re-enable the input field

	//log the number of states created and evaluated
	console.log("Number of states created: ", SparklisState.number_of_states);
	console.log("Number of states evaluated: ", SparklisState.number_of_evaluated_states);
	return final_place;
}

function correct_command_chain_syntax(steps_string) {
	/**
	 * Corrects malformed command chain syntax.
	 */
	// Remove the spaces at the start of the string
	let patched_steps_string = steps_string.replace(/^\s+/, '');

	// Remove quotes from the string (the LLM sometimes adds them)
	patched_steps_string = patched_steps_string.replace(/['"]+/g, '');

	return patched_steps_string;
}

// starting from place, apply sequence of steps as far as possible
async function process_steps(qa, place, steps) {
    if (steps.length === 0) {
		console.log("QA search completed");
		return Promise.resolve();
    } else {
	let first_step = steps[0];
	return process_step(place, first_step)
	    .then(async next_place => {
			//cancel the last class or match command if it doesn't have any results
			if (LAST_INITIATED_COMMAND === "class" || LAST_INITIATED_COMMAND === "match") {
				//if the last command got a class but doesn't have any results, we will just cancel it
				await waitForEvaluation(next_place);
				if (next_place.results().rows.length > 0) {
					LAST_RESOLVED_COMMAND = LAST_INITIATED_COMMAND;
					previous_step = first_step; // store the previous command
					sparklis.setCurrentPlace(next_place); // update Sparklis view
				} else {
					//Ignore the command
					console.log("Ignoring the command "+ LAST_INITIATED_COMMAND + " because it doesn't have any results."); 
					//a temp patch is needed because (a boardgame; property publisher; GMT Games) doesn't work well
					temp_patch_needed = true; // signal that a temporary patch is needed
				}
			} else {
				LAST_RESOLVED_COMMAND = LAST_INITIATED_COMMAND;
				previous_step = first_step; // store the previous command
				sparklis.setCurrentPlace(next_place); // update Sparklis view
			}
			let next_steps = steps.slice(1);
			qa.value = next_steps.join(" ; "); // update qa field
			return process_steps(qa, next_place, next_steps); // continue with next steps from there
		})
	    .catch(msg => {
			console.log("QA search halted because " + msg);

			//if the command that failed was trying to get a specific entity, we can instead try to match the corresponding string
			if (LAST_INITIATED_COMMAND === "term" && steps[0].length >=3) {
				//signal to add text to the reasoning and errors of the system
				bus.dispatchEvent(new CustomEvent('term_cmd_backup', { detail: { message: "The command trying to get a specific entity failed. Now trying to match the corresponding term instead." } }));
				console.log("Trying to match the term of the failed command.");
				//add a "match" to the first command of qa
				let first_step = steps[0];
				let new_first_step = "match " + first_step;
				steps[0] = new_first_step;
				qa.value = steps.join(" ; "); // update qa field
				return process_steps(qa, place, steps);


			} else if (place.focusPath().length > 1
				&& (LAST_INITIATED_COMMAND === "property" || 
					LAST_INITIATED_COMMAND === "up")
				) {
				//execute up and then retry the command
				console.log("Property failed. Now trying to go up and retry the command.");
				//add a new step "up" before the current one
				steps.unshift("up");
				console.log("Steps after adding up: ", steps);
				return process_steps(qa, place, steps);
			
			//todo disabled for the moment because it doesn't work well
			/*} //if poperty failed, we can try to get the property without constraint
			else if (LAST_INITIATED_COMMAND === "property") {
				//todo trouver tt les property, trouver leur labels -> tester distance edition
				//-> si fail temps

				//signal to add text to the reasoning and errors of the system
				console.log("Property failed. Now trying to get the property without constraint.");
				//add a "propertyWithoutConstraint" to the first command of qa
				let first_step = steps[0];
				let new_first_step = "propertyWithoutConstraint " + first_step;
				steps[0] = new_first_step;
				qa.value = steps.join(" ; "); // update qa field
				return process_steps(qa, place, steps);*/
			} 

			if (temp_patch_needed) {
				temp_patch_needed = false; // reset the temporary patch needed flag
				console.log("Temporary patch is used to prevent error after going back.");
				return process_question(qa); // retry the question
			}
			
			// default case if no save are possible
			LAST_INITIATED_COMMAND = null; // reset the last initiated command
			return Promise.reject(msg); // Propagate error
	    })
    }
}

/* processing a single step */

// applying step to place, returning a promise of the next place
async function process_step(place, step, target_suggestion_ranking = 1) {
    console.log("Step: ", step);
	LAST_INITIATED_COMMAND = step;
    let match;
    if (step === "up") {
	return move_focus(place, move_up)
    } else if (step === "down") {
	return move_focus(place, move_down)
    } else if (step === "and") {
	return apply_suggestion(place, "and", "IncrAnd")
    } else if (step === "or") {
	return apply_suggestion(place, "or", "IncrOr")
    } else if (step === "not") {
	return apply_suggestion(place, "not", "IncrNot")
    } else if (step === "maybe") {
	return apply_suggestion(place, "maybe", "IncrMaybe")
    } else if (step === "asc") {
	let sugg = { type: "IncrOrder", order: { type: "ASC", conv: null } };
	return apply_suggestion(place, "asc-order", sugg)
    } else if (step === "desc") {
	let sugg = { type: "IncrOrder", order: { type: "DESC", conv: null } };
	return apply_suggestion(place, "desc-order", sugg)
	} else if ((match = /^groupBy\s+(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "groupBy";
	bus.dispatchEvent(new CustomEvent('groupby_action', { detail: { action: 'count' } }));
	//Keep the current place and does nothing
	return new Promise((resolve, reject) => {
		try {
			waitForEvaluation(sparklis.currentPlace()).then(() => {
				resolve(sparklis.currentPlace());
			});
		} catch (error) {
			reject(error);
		}
	});
} else if ((match = /^group\s*(.+)$/.exec(step))) {
		return new Promise((resolve, reject) => {
			apply_suggestion(place, "foreach", "IncrForeach")
				.then(next_place => {
					let next_sugg = { type: "IncrAggregId", aggreg: "SAMPLE", id: 1 };
					if (match[1] === "count") {
						next_sugg = { type: "IncrAggregId", aggreg: "COUNT_DISTINCT", id: 1 };
					}
					//todo add other aggregations
					//todo add the other direction

					resolve(apply_suggestion(next_place, match[1], next_sugg));
				})
				.catch(msg => {
					reject(msg);
				})
		})
	} else if (step === "countDistinct") {
	let sugg = { type: "IncrAggreg", aggreg: "COUNT_DISTINCT" };
	return  apply_suggestion(place, "count", sugg)
    } else if ((match = /^after\s+(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "after";
	let constr = { type: "After", kwd: match[1] };
	let sugg = {type: "IncrConstr", constr: constr, filterType: "OnlyLiterals"};
	return apply_suggestion(place, "after", sugg)
    } else if ((match = /^before\s+(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "before";
	let constr = { type: "Before", kwd: match[1] };
	let sugg = {type: "IncrConstr", constr: constr, filterType: "OnlyLiterals"};
	return apply_suggestion(place, "before", sugg)
    } else if ((match = /^from\s+(.+)\s+to\s+(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "from to";
	let constr = { type: "FromTo", kwdFrom: match[1], kwdTo: match[2] };
	let sugg = {type: "IncrConstr", constr: constr, filterType: "OnlyLiterals"};
	return apply_suggestion(place, "from-to", sugg)
    } else if ((match = /^higherThan\s*(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "higher";
	if (!isNumeric(match[1])) {
		return Promise.reject("higherThan something that is not a number");
	}
	console.log(place.results());
	let constr = { type: "HigherThan", value: match[1] };
	let sugg = {type: "IncrConstr", constr: constr, filterType: "OnlyLiterals"};
	return apply_suggestion(place, "higher-than", sugg)
    } else if ((match = /^lowerThan\s*(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "lower";
	if (!isNumeric(match[1])) {
		return Promise.reject("lowerThan something that is not a number");
	}
	let constr = { type: "LowerThan", value: match[1] };
	let sugg = {type: "IncrConstr", constr: constr, filterType: "OnlyLiterals"};
	return apply_suggestion(place, "lower-than", sugg)
    } else if ((match = /^between\s+(.+)\s+and\s+(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "between";
	if (!isNumeric(match[1]) || !isNumeric(match[2])) {
		return Promise.reject("between something that is not a number");
	}
	let constr = { type: "Between", valueFrom: match[1], valueTo: match[2] };
	let sugg = {type: "IncrConstr", constr: constr, filterType: "OnlyLiterals"};
	return apply_suggestion(place, "between", sugg)
	
	} else if ((match = /^match\s*(.+)$/.exec(step))) { // Regex or Wikidata search
	LAST_INITIATED_COMMAND = "match";
	return new Promise((resolve, reject) => {
		let input_wikidata = document.getElementById("input-wikidata-mode");
		if (input_wikidata.checked) {
			get_constr("WikidataSearch", match[1]).
			then(constr => 
				place.onEvaluated(() => {
					let sugg = {type: "IncrConstr", constr: constr, filterType: "Mixed"};
					apply_suggestion(place, "match", sugg)
					.then(next_place => {
						resolve(next_place);
					})
					.catch(msg => {
						reject(msg);
					})
				}
			))
		} else {
			let constr = { type: "MatchesAll", kwds: match[1].split(/\s+/) };
			place.onEvaluated(() => {
				let sugg = {type: "IncrConstr", constr: constr, filterType: "Mixed"};
				apply_suggestion(place, "match", sugg)
				.then(next_place => {
					resolve(next_place);
				})
				.catch(msg => {
					reject(msg);
				})
			})
		}
	})	

	} else if ((match = /^limit\s*(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "limit";
		if (!isNumeric(match[1])) {
			return Promise.reject("limit something that is not a number");
		}

		//test if the bus exists
		if (typeof bus === "undefined") {
			return Promise.reject("bus is not defined, please include llm_extension_any_systems.js");
		}

		//synchronous signal, delegating the responsibility to the subscriber to handle the event
		bus.dispatchEvent(new CustomEvent('limit', { detail: { limit_number: match[1] } }));
		console.log("event dispatched");

		//Keep the current place and does nothing
		return new Promise((resolve, reject) => {
			try {
				waitForEvaluation(sparklis.currentPlace()).then(() => {
					resolve(sparklis.currentPlace());
				});
			} catch (error) {
				reject(error);
			}
		});

		} else if ((match = /^offset\s*(.+)$/.exec(step))) {
		LAST_INITIATED_COMMAND = "offset";
		if (!isNumeric(match[1])) {
			return Promise.reject("offset something that is not a number");
		}

		//test if the bus exists
		if (typeof bus === "undefined") {
			return Promise.reject("bus is not defined, please include llm_extension_any_systems.js");
		}

		//synchronous signal, delegating the responsibility to the subscriber to handle the event
		bus.dispatchEvent(new CustomEvent('offset', { detail: { offset_number: match[1] } }));
		console.log("event dispatched");

		//Keep the current place and does nothing
		return new Promise((resolve, reject) => {
			try {
				waitForEvaluation(sparklis.currentPlace()).then(() => {
					resolve(sparklis.currentPlace());
				});
			} catch (error) {
				reject(error);
			}
		});

	} else if (step === "goback") { //todo marche pas 2 fois d'affilées
		LAST_INITIATED_COMMAND = "goback";
		return new Promise((resolve, reject) => {
			try {
				sparklis.back();
				waitForEvaluation(sparklis.currentPlace()).then(() => {
					resolve(sparklis.currentPlace());
				});
			} catch (error) {
				reject(error);
			}
		});

	} else if ((match = /^filter\s+(.+)$/.exec(step))) {
		LAST_INITIATED_COMMAND = "filter";
		let constr = { type: "MatchesAll", kwds: match[1].split(/\s+/) };
		sparklis.setConceptConstr(constr);
		sparklis.setTermConstr(constr);
		sparklis.setModifierConstr(constr);
		return Promise.resolve(sparklis.currentPlace());

    } else if ((match = /^a\s+(.+)\s*$/.exec(step))) {
	LAST_INITIATED_COMMAND = "class";
	return search_and_apply_suggestion(
	    place, "class", match[1],
	    (place,constr) => place.getConceptSuggestions(false,constr),
	    sugg => suggestion_type(sugg) === "IncrType",
	    sparklis.classLabels(), target_suggestion_ranking)

	} else if ((match = /^classWithoutConstraint\s+(.+)\s*$/.exec(step))) {
		LAST_INITIATED_COMMAND = "classWithoutConstraint";
		return search_and_apply_suggestion(
			place, "class", match[1],
			(place,constr) => place.getConceptSuggestions(false,"True"),
			sugg => suggestion_type(sugg) === "IncrType",
			sparklis.classLabels(), target_suggestion_ranking)
			
    } else if ((match = /^forwardProperty\s+(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "fwd";
	return search_and_apply_suggestion(
	    place, "fwd property", match[1],
	    (place,constr) => place.getConceptSuggestions(false,constr),
	    sugg =>
	    suggestion_type(sugg) === "IncrRel" && sugg.orientation === "Fwd"
		|| suggestion_type(sugg) === "IncrPred" && sugg.arg === "S",
	    sparklis.propertyLabels(), target_suggestion_ranking)
    } else if ((match = /^backwardProperty\s+(.+)$/.exec(step))) {
	LAST_INITIATED_COMMAND = "bwd";
	return search_and_apply_suggestion(
	    place, "bwd property", match[1],
	    (place,constr) => place.getConceptSuggestions(false,constr),
	    sugg =>
	    suggestion_type(sugg) === "IncrRel" && sugg.orientation === "Bwd"
		|| suggestion_type(sugg) === "IncrPred" && sugg.arg === "O",
	    sparklis.propertyLabels(), target_suggestion_ranking)
	} else if ((match = /^propertyWithoutPriority\s+(.+)$/.exec(step))) { //depends on the first direction the property is found in
		LAST_INITIATED_COMMAND = "propertyWithoutPriority";
		return search_and_apply_suggestion(
			place, "fwd property", match[1],
			(place,constr) => place.getConceptSuggestions(false,constr),
			sugg =>
			suggestion_type(sugg) === "IncrRel" && sugg.orientation === "Fwd"
			|| suggestion_type(sugg) === "IncrPred" && sugg.arg === "S"
			|| suggestion_type(sugg) === "IncrRel" && sugg.orientation === "Bwd"
			|| suggestion_type(sugg) === "IncrPred" && sugg.arg === "O",
			sparklis.propertyLabels(), target_suggestion_ranking)
	} else if ((match = /^property\s+(.+)$/.exec(step))) { //forward property first, then backward property
		LAST_INITIATED_COMMAND = "property";
		const primaryFilter = sugg =>
			suggestion_type(sugg) === "IncrRel" && sugg.orientation === "Fwd" ||
			suggestion_type(sugg) === "IncrPred" && sugg.arg === "S";
	
		const fallbackFilter = sugg =>
			suggestion_type(sugg) === "IncrRel" && sugg.orientation === "Bwd" ||
			suggestion_type(sugg) === "IncrPred" && sugg.arg === "O";
	
		let result = null;
		try {
			result = await search_and_apply_suggestion(
				place, "fwd property", match[1],
				(place, constr) => place.getConceptSuggestions(false, constr),
				primaryFilter,
				sparklis.propertyLabels(),
				target_suggestion_ranking
			);
		} catch (error) {
			console.log("No forward property found, trying backward property.");
		}
		
	
		if (!result || result.length === 0) {
			result = search_and_apply_suggestion(
				place, "bwd property", match[1],
				(place, constr) => place.getConceptSuggestions(false, constr),
				fallbackFilter,
				sparklis.propertyLabels(),
				target_suggestion_ranking
			);
		}
		return result;
		} else if ((match = /^propertyWithoutConstraint\s+(.+)$/.exec(step))) { //todo priority order??
			LAST_INITIATED_COMMAND = "propertyWithoutConstraint";
			return search_and_apply_suggestion(
				place, "fwd property", match[1],
				(place,constr) => place.getConceptSuggestions(false,"True"),
				sugg =>
				suggestion_type(sugg) === "IncrRel" && sugg.orientation === "Fwd"
				|| suggestion_type(sugg) === "IncrPred" && sugg.arg === "S"
				|| suggestion_type(sugg) === "IncrRel" && sugg.orientation === "Bwd"
				|| suggestion_type(sugg) === "IncrPred" && sugg.arg === "O",
				sparklis.propertyLabels(), target_suggestion_ranking)
    } else {
	LAST_INITIATED_COMMAND = "term";
	return search_and_apply_suggestion(
	    place, "term", step,
	    (place,constr) => place.getTermSuggestions(false,constr),
	    sugg => suggestion_type(sugg) === "IncrTerm" && sugg.term.type === "uri",
	    sparklis.termLabels(), target_suggestion_ranking)
    }
}

function move_focus(place, move) {
    return new Promise((resolve, reject) => {
	let path = place.focusPath();
	let next_path = move(path);
	let next_place = place.focusAtPath(next_path);
	resolve(next_place)
    })
}

function apply_suggestion(place, kind, sugg) {
    return new Promise((resolve, reject) => {
	let next_place = place.applySuggestion(sugg);
	resolve(next_place);
    })
}
    
function search_and_apply_suggestion(place, kind, query, getSuggestions, filterSuggestion, lexicon, target_suggestion_ranking) {
    return new Promise((resolve, reject) => {
	get_constr(kind, query)
	    .then(constr => {
		console.log(kind, "constr : ", constr);
		place.onEvaluated(() => {
		    getSuggestions(place, constr)
			.then(async res => {
			    let forest = res.forest;
			    console.log("got suggestions for constraint");
			    //console.log(forest);
			    let best_sugg = await select_sugg(kind, query, forest, filterSuggestion, lexicon, target_suggestion_ranking);
			    if (!best_sugg) {
				reject("no suggestion found");
			    } else {
				console.log("choosing suggestion:");
				console.log(best_sugg);
				let next_place = place.applySuggestion(best_sugg);
				resolve(next_place);
			    }
			})
			.catch(() => {
			    reject(kind + " not found");
			})
		})
	    })
	    .catch(error => {
		reject(kind + " search failed");
	    })
    })
}		       

// defining a constraint promise from kind and query
function get_constr(kind, query) {
    return new Promise((resolve, reject) => {
	let input_wikidata = document.getElementById("input-wikidata-mode");
	if (input_wikidata.checked) {
	    let search =
		{ type: "WikidataSearch",
		  kwds: query.split(/\s+/) };
	    sparklis.externalSearchConstr(search)
		.then(constr => resolve(constr))
		.catch(reject);
	} else {
	    let constr =
		{ type: "MatchesAll",
		  kwds: query.split(/\s+/) };
	    resolve(constr);
	}
    })
}

// selecting the most frequent suggestion satisfying pred
async function select_sugg(kind, query, forest, pred, lexicon, target_suggestion_ranking) {
	SparklisState.single_child_command = false; // several children are needed when suggestions are to choose from
	if (window.select_sugg_logic) {
		// using custom logic
		console.log("using custom select_sugg_logic", window.select_sugg_logic);
		if (window.select_sugg_logic == "count_references") {
			return await count_references_select_sugg_logic(kind, query, forest, pred, lexicon, target_suggestion_ranking);
		}
	} else {
		// using basic logic
		console.log("using basic select_sugg_logic");
		return await count_references_select_sugg_logic(kind, query, forest, pred, lexicon, target_suggestion_ranking);
		//return basic_select_sugg_logic(kind, query, forest, pred, lexicon, target_suggestion_ranking);
	}
}

function basic_select_sugg_logic(kind, query, forest, pred, lexicon, target_suggestion_ranking) {
    const rank = Math.max(target_suggestion_ranking || 1, 1); // ensure it's at least 1
    const top_items = [];

    forest.forEach(tree => {
        const item = tree.item;
        if (pred(item.suggestion)) {
            const score = get_score(lexicon, kind, query, item);
            if (score !== null) {
                // Insert in descending order (simple insertion sort logic)
                let inserted = false;
                for (let i = 0; i < top_items.length; i++) {
                    if (score > top_items[i].score) {
                        top_items.splice(i, 0, { item, score });
                        inserted = true;
                        break;
                    }
                }
                if (!inserted && top_items.length < rank) {
                    top_items.push({ item, score });
                }

                // Keep only top N
                if (top_items.length > rank) {
                    top_items.pop();
                }
            }
        }
    });

	SparklisState.last_suggestion_score = top_items.length >= rank ? top_items[rank - 1].score : 0;
	// Return the (rank-1)th item, or null if not available
    return top_items.length >= rank ? top_items[rank - 1].item.suggestion : null;
}

async function count_references_select_sugg_logic(kind, query, forest, pred, lexicon, target_suggestion_ranking) {
    let all_items = [];

    // First pass: collect all suggestions with a valid score
    for (const tree of forest) {
        const suggestion = tree.item.suggestion;
        if (!pred(suggestion)) continue;

        const score = get_score(lexicon, kind, query, tree.item);
        if (score === null || score <= 0) continue;

        all_items.push({ suggestion, score }); // Store suggestion + score together
    }

    if (all_items.length === 0) {
        return null;
    }

    // Count total references for each suggestion
    async function get_total_references(suggestion) {
        const uri = suggestion_uri(suggestion);
        const [objects_result, subjects_result] = await Promise.all([
            sparklis.evalSparql(countObjectQuery(uri)),
            sparklis.evalSparql(countSubjectQuery(uri))
        ]);

        const objects_count = objects_result?.rows?.[0]?.[0]?.number || 0;
        const subjects_count = subjects_result?.rows?.[0]?.[0]?.number || 0;
        return objects_count + subjects_count;
    }

    // Add reference counts
    for (const obj of all_items) {
        obj.referenceCount = await get_total_references(obj.suggestion);
    }

    // Sort: score desc, then reference count desc
    all_items.sort((a, b) => {
        if (a.score !== b.score) {
            return b.score - a.score;
        }
        return b.referenceCount - a.referenceCount;
    });

    // Pick top-N
    const ranking_items = all_items.slice(0, target_suggestion_ranking);

    console.log("Ranking items: ", ranking_items);

    SparklisState.last_suggestion_score = ranking_items.length >= target_suggestion_ranking
        ? ranking_items[target_suggestion_ranking - 1].score
        : 0;
	//if last_suggestion_score isn't a number, we set it to 0
	if (isNaN(SparklisState.last_suggestion_score)) {
		SparklisState.last_suggestion_score = 0;
	}

    return ranking_items.length >= target_suggestion_ranking
        ? ranking_items[target_suggestion_ranking - 1].suggestion
        : null;
}



class SparklisState {
	//static var of the number of Sparklis states created and evaluated
	static number_of_states = 0; // static variable to count the number of states created
	static number_of_evaluated_states = 0; // static variable to count the number of states evaluated

	static last_suggestion_score = 1; //used to store the last suggestion score (originally to 1 because we want to prioritize a state having executed as many commands as possible (for commands without suggestions to choose)
	static single_child_command = true; // used to only have several children for commands with suggestion to choose from

	constructor(place, remaining_commands, score, number_of_top_sugg_considered) {
		this.place = place;
		this.remaining_commands = remaining_commands;
		this.score = score;
		this.number_of_top_sugg_considered = number_of_top_sugg_considered;
		this.children = []; // children states
		this.evaluated = false;
		SparklisState.number_of_states++; // increment the number of states created
		SparklisState.last_suggestion_score = 1; // reset between states
	}

	/**
	 * Evaluates the current state by executing the first command and creating its children.
	 * Executes the command and gets the top k suggestions.
	 * Each suggestion corresponds to a new child state.
	 * Child states have the same command chain as the parent state, but with the first command removed.
	 */
	async evaluate() { //todo current criteria is total score, also test command success number
		console.log("Evaluating state: ", this.place, " with remaining commands: ", this.remaining_commands);
		let steps = this.remaining_commands;
		if (steps.length > 0) {
			let first_step = steps[0];
			console.log("First step: ", first_step);
			//todo empecher avoir plusieurs enfants pour certaines commandes
			for (let i = 1; i <= this.number_of_top_sugg_considered; i++) {
				await process_step(this.place, first_step, i)
					.then(async next_place => {
						await waitForEvaluation(next_place);
						//if the last command got a class but doesn't have any results, we will just cancel it and pass through it
						if ((LAST_INITIATED_COMMAND === "class" || LAST_INITIATED_COMMAND === "match")
							&& next_place.results().rows.length == 0) {
							//replace the next place by the current place
							next_place = this.place; // keep the current place
							SparklisState.last_suggestion_score = 0; // reset the last suggestion score
							//useful if supposed members of a class aren't actually members of the said class
						}

						let new_child = new SparklisState(
							next_place,
							steps.slice(1), // remaining commands
							this.score + SparklisState.last_suggestion_score, // score of the current place + last suggestion score
							this.number_of_top_sugg_considered // number of top suggestions considered
						);
						this.children.push(new_child); // add child to the list of children
					}).catch(msg => {
						console.log("Error while processing step: ", msg);
						//todo regarder ce qu'on sauve
						//term -> match?
						//property->up?
					});
					sparklis.setCurrentPlace(this.place); // update Sparklis view

					//stop the loop and don't create other children if the command doesn't need it 
					if (SparklisState.single_child_command) {
						break;
					}
			}
			//reset for the next states
			SparklisState.single_child_command = true;
		} else {
			console.log("No more steps to execute.");
		}
		this.evaluated = true; // mark as evaluated
		SparklisState.number_of_evaluated_states++; // increment the number of evaluated states
	}

	toJSON() {
		return {
		  place: this.place.id || this.place.toString(), // customize as needed
		  score: this.score,
		  remaining_commands: this.remaining_commands,
		  evaluated: this.evaluated,
		  children: this.children.map(child => child.toJSON())
		};
	  }
	  
}

/**
 * Performs a depth-first search to find the best place based on the given commands.
 * @param {SparklisPlace} place - The current place in the Sparklis application.
 * @param {Array} commands - The list of commands to process.
 * @param {number} number_of_top_sugg_considered - The number of top suggestions to consider for each command.
 */
async function depth_first_search(qa, commands, place, number_of_top_sugg_considered = 3) {
	let initial_state = new SparklisState(place, 
		commands, 
		0,
		number_of_top_sugg_considered
	);

	let stack = [initial_state];
	let best_state = initial_state; // keep track of the best state
	let best_score = initial_state.score; // keep track of the best score
	
	while (stack.length > 0) {     
		let curr = stack.pop();
		if (!curr.evaluated) {
			await curr.evaluate(); // create direct children
			qa.value = curr.remaining_commands.join(" ; "); // update qa field
			console.log("state evaluated: ", curr);
			//console.log("Evaluated state: ", curr.place, " with score: ", curr.score);
			if (curr.score > best_score) { 
				console.log("New best state found: ", curr.place, " with score: ", curr.score);
				best_state = curr; // update best state
				best_score = curr.score; // update best score
			}
			for (let child of curr.children) {
				stack.push(child);
			}
		}
	}

	const stateTreeJSON = JSON.stringify(initial_state.toJSON(), null, 2);
	console.log("State Tree JSON:", stateTreeJSON);

	//set the best state as the current place
	sparklis.setCurrentPlace(best_state.place); // update Sparklis view
	return best_state.place; // return the best place
}

/**
 * Performs a beam search to find the best place based on the given commands.
 * @param {SparklisPlace} place - The current place in the Sparklis application.
 * @param {Array} commands - The list of commands to process.
 * @param {number} number_of_top_sugg_considered - The number of top suggestions to consider for each command.
 * @param {number} beam_width - The beam width (how many candidates to keep at each level).
 */
async function beam_search(qa, commands, place, number_of_top_sugg_considered = 3, beam_width = 3) {
	let initial_state = new SparklisState(place, commands, 0, number_of_top_sugg_considered);
	let beam = [initial_state];
	let best_state = initial_state;
	let best_score = initial_state.score;

	while (beam.length > 0) {
		let next_beam = [];

		// Evaluate all current states in the beam
		for (let state of beam) {
			if (!state.evaluated) {
				await state.evaluate(); // generate children
				qa.value = state.remaining_commands.join(" ; ");
				console.log("Evaluating: ", state);

				if (state.score > best_score) {
					console.log("New best state found: ", state.place, " with score: ", state.score);
					best_state = state;
					best_score = state.score;
				}
			}
			next_beam.push(...state.children);
		}

		// Sort all children by score and keep only the top N
		next_beam.sort((a, b) => b.score - a.score);
		beam = next_beam.slice(0, beam_width);
	}

	const stateTreeJSON = JSON.stringify(initial_state.toJSON(), null, 2);
	console.log("State Tree JSON:", stateTreeJSON);

	sparklis.setCurrentPlace(best_state.place); // update Sparklis view
	return best_state.place;
}

// computing score of item for suggestion choice
function get_score(lexicon, kind, query, item) {
    let freq = item_frequency(item);
    let uri = suggestion_uri(item.suggestion);
    if (uri === null) {
	return 0;
    } else {
	let label = lexicon.info(uri);
	if (typeof label !== "string") {
	    label = label.label;
	};
	let dist = editDistance(query,label);
	let score = freq * (1 / (1 + dist));
	console.log("score=", score, ", freq=", freq, ", dist=", dist, ", label=", label, ", uri=", uri);
	return score;
    }
}

/* utility functions */

function move_up(path) {
    let lastDownIndex = path.lastIndexOf("DOWN");
    if (lastDownIndex === -1) {
	return path;
    } else {
	return path.slice(0, lastDownIndex);
    }
}

function move_down(path) {
    return [...path, "DOWN"];
}

function item_frequency(item) {
    if (item.frequency === null) {
	return 0;
    } else {
	return item.frequency.value;
    }
}

function suggestion_type(sugg) {
    if (typeof sugg === "string") {
	return sugg;
    } else {
	return sugg.type;
    }
}

function suggestion_uri(sugg) {
    switch (sugg.type) {
    case "IncrType":
	return sugg.uri;
    case "IncrRel":
	return sugg.uri;
    case "IncrPred":
	let pred = sugg.pred;
	switch (pred.type) {
	case "Class":
	    return pred.uri;
	case "Prop":
	    return pred.uri;
	case "SO":
	    return pred.uriO;
	case "EO":
	    return pred.uriE;
	default:
	    return null;
	}
    case "IncrTerm":
	let term = sugg.term;
	switch (term.type) {
	case "uri":
	    return term.uri;
	default:
	    return null;
	}
    }
}

function editDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Create a 2D array to store distances
    const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

    // Initialize base cases
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    // Compute distances
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,    // Deletion
                dp[i][j - 1] + 1,    // Insertion
                dp[i - 1][j - 1] + cost // Substitution
            );
        }
    }

    return dp[len1][len2];
}

function isNumeric(str) {
	if (typeof str != "string") return false // we only process strings!  
	return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
		   !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

function countObjectQuery(entity_uri) {
	return `SELECT (COUNT(*) AS ?number) WHERE {
		?subject ?predicate <${entity_uri}> . }`;
}

function countSubjectQuery(entity_uri) {
	return `SELECT (COUNT(*) AS ?number) WHERE {
		<${entity_uri}> ?predicate ?object . }`;
}

// example steps
// on DBpedia Core: a film; has director; Tim Burton; down; or; Spielberg; up; up; has starring ; has birthdate ; after 1980
// on DBpedia Core: a film ; has budget ; desc ; > 1e7

