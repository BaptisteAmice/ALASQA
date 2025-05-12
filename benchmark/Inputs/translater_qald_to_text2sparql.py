import json
import yaml
import os
import sys

def convert_json_to_yaml(json_file_path, yaml_file_path, languages=("en", "de")):
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions_yaml = []

    for q in data.get("questions", []):
        entry = {}
        translations = {}
        for t in q.get("question", []):
            lang = t.get("language")
            if lang in languages:
                translations[lang] = t.get("string")
        if translations:
            entry["question"] = translations
            questions_yaml.append(entry)

    final_yaml = {
        "dataset": {
            "id": "https://text2sparql.aksw.org/2025/dbpedia/"
        },
        "questions": questions_yaml
    }

    with open(yaml_file_path, 'w', encoding='utf-8') as f:
        yaml.dump(final_yaml, f, allow_unicode=True, sort_keys=False)

if __name__ == "__main__":
    # get current working directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, "qald_9_plus_train_dbpedia.json")
    output_file = os.path.join(script_dir, "qald_9_plus_train_dbpedia.yaml")
    convert_json_to_yaml(input_file, output_file, languages=("en", "de"))
