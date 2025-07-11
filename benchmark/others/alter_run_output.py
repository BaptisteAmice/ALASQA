"""
Script to manipulate question IDs in a JSON file containing benchmark results.
This script provides functions to:
1. Retrieve question IDs from the JSON file.
2. Update question IDs by adding a prefix.
3. Delete specific question IDs from the JSON file.
"""
import json
import logging

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_question_ids(json_file):
    """Return a list of all question IDs in the JSON file."""
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    question_ids = list(data.get("Data", {}).keys())
    logger.info(f"Found {len(question_ids)} question IDs")
    return question_ids


def update_question_ids(json_file, output_file, prefix):
    """
    Add a prefix to all question IDs and write to a new file.
    Also updates the internal data structure accordingly.
    """
    with open(json_file, 'r', encoding='utf-8') as f:
        content = json.load(f)

    old_data = content.get("Data", {})
    new_data = {}
    for old_id, qdata in old_data.items():
        new_id = f"{prefix}{old_id}"
        new_data[new_id] = qdata

    content["Data"] = new_data

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(content, f, indent=4, ensure_ascii=False)

    logger.info(f"Updated IDs with prefix '{prefix}' and saved to {output_file}")


def delete_questions_by_ids(json_file, output_file, ids_to_delete):
    """
    Delete questions with IDs in the given list and save to a new file.
    """
    with open(json_file, 'r', encoding='utf-8') as f:
        content = json.load(f)

    data = content.get("Data", {})
    for qid in ids_to_delete:
        if qid in data:
            del data[qid]
            logger.info(f"Deleted question ID: {qid}")
        else:
            logger.warning(f"ID not found, skipping: {qid}")

    content["Data"] = data
    content["Stats"]["NbQuestions"] = len(data)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(content, f, indent=4, ensure_ascii=False)

    logger.info(f"Deleted {len(ids_to_delete)} IDs and saved to {output_file}")


if __name__ == "__main__":
    # Example usage
    file_path = r"C:\Users\PC\Desktop\llmSparklis\QALD-9-temp.json"

    # 1. Get IDs
    #ids = get_question_ids(file_path)
    #print(f"Question IDs: {ids}")

    # 2. Update IDs by adding prefix
    #update_question_ids(file_path, "updated_ids.json", prefix="NEW_")

    # 3. Delete some IDs
    #ids_to_remove = []
    #delete_questions_by_ids(file_path, "deleted_ids.json", ids_to_remove)
