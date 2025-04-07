//todo

// react code
// https://github.com/ysymyth/ReAct/blob/master/hotpotqa.ipynb
// prompt file
// https://raw.githubusercontent.com/ysymyth/ReAct/refs/heads/master/prompts/prompts_naive.json

instruction = `Solve a question answering task with interleaving Thought, Action, Observation steps. Thought can reason about the current situation, and Action can be five types: 
(1) SearchEntity[entity], which searches the list of matching entities in the knowledge graph and returns it.
(2) SearchClassAndProperty[class/property], which searches the list of matching classes and properties in the knowledge graph and returns it.
(3) LookupEntity[entity], which will select the best matching entity of Sparklis in the given list with the given keyword (the list being possibly filtered).
(4) ...
(5) Finish[answer], which returns the generated query by Sparklis and finishes the task.
Here are some examples.
`
webthink_prompt = instruction + webthink_examples