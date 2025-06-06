"""
This script gives information about the tags of the questions in a QALD JSON file.
"""
import json

def list_question_for_tag_list(input_file: str, tags: list[str], union: bool = False) -> list[str]:
    """
    Lists the question for a given list of tags in a JSON file.
    
    Parameters:
        input_file (str): Path to the input JSON file.
        tags (list[str]): List of tags to search for.
        union (bool): If True, returns IDs with any of the tags. If False, returns IDs with all tags.

    Returns:
        list[str]: List of question IDs matching the criteria.
    """
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    question_ids = []
    for q in data.get("questions", []):
        if "tags" in q and isinstance(q["tags"], list):
            if union:
                if any(tag in q["tags"] for tag in tags):
                    question_ids.append(q)
            else:
                if all(tag in q["tags"] for tag in tags):
                    question_ids.append(q)

    return question_ids
   

if __name__ == "__main__":
    input_file = "../benchmark/Inputs/qald_9_plus_train_wikidata_patched.json"

    tags = ["boolean", "person"]
    questions = list_question_for_tag_list(input_file, tags, union=False)
    print(f"{len(questions)} question IDs with tags {tags}:")
    for question in questions:
        #text in question["question"][0]["string"] where question["question"][0]["language"] == "en"
        question_text = next((q["string"] for q in question["question"] if q["language"] == "en"), None)
        print(question["id"], " - ", question_text)