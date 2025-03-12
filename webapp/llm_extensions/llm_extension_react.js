//todo

// react code
// https://github.com/ysymyth/ReAct/blob/master/hotpotqa.ipynb
// prompt file
// https://raw.githubusercontent.com/ysymyth/ReAct/refs/heads/master/prompts/prompts_naive.json

// instruction = """Generate a SPARQL query to solve a question answering task with interleaving Thought, Action, Observation steps. Thought can reason about the current situation, and Action can be three types: 
// (1) Search[entity], which searches --- filtre la liste des matches ---
// (2) Lookup[keyword], which --- selectionne un match ---
// (3) Finish[answer], which returns the generated query and finishes the task.
// Here are some examples.
// """
// webthink_prompt = instruction + webthink_examples