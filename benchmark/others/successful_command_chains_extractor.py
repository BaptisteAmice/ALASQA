"""
This script is used to extract successful command chains from a JSON file containing results from our system.
Can be useful to build a gold standard for command chains.
"""
import json
import os
import re

def get_successful_commands(filepath):
    # Load your JSON data
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    extracted_triples = []

    # Iterate through each question entry
    for qid, qdata in data.get("Data", {}).items():
        if qdata.get("F1Score") == 1:
            question = qdata.get("Question")
            reasoning = qdata.get("Reasoning")
            # Extract the last occurrence of <commands>...</commands>
            matches = re.findall(r"<commands>(.*?)</commands>", reasoning, re.DOTALL)
            commands = matches[-1].strip() if matches else None
            if commands is not None: #ignore question not using commands (e.g. boolean questions)
                extracted_triples.append((qid, question, commands))

    # Output results
    for id, question, commands in extracted_triples:
        print(f"ID: {id}")
        print(f"Question: {question}")
        print(f"Commands: {commands}")
        print()


if __name__ == "__main__":

    script_dir = os.path.dirname(os.path.realpath(__file__))
    # Get the path to the JSON file
    json_file_path = os.path.join(script_dir, 'BestOutputs/QALD9/DBpedia/QALD-9-plus_sparklisllm-LLMFrameworkText2Sparql_20250427_030418.json')

    # Call the function with the JSON file path
    get_successful_commands(json_file_path)



