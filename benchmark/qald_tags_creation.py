# Script to easily add tags
# This script isn't sufficient and should be complemented by manual tagging

import json

def insert_tags_field(input_path: str, output_path: str):
    """
    Inserts a "tags": [] field after the "id" key in each question entry,
    only if it does not already exist. Writes the modified data to the output path.
    """
    # Load the JSON file
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Modify each question entry
    for q in data.get("questions", []):
        if "id" in q and "question" in q and "tags" not in q:
            q_items = list(q.items())
            new_q = {}
            for key, value in q_items:
                new_q[key] = value
                if key == "id":
                    new_q["tags"] = []
            q.clear()
            q.update(new_q)

    # Save the modified JSON back
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def auto_tag_questions(input_path: str, output_path: str):
    """
    Adds specific tags to each question based on query structure, language content,
    and answer type. Tags are only added if not already present.
    """
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for q in data.get("questions", []):
        if "tags" not in q:
            q["tags"] = []
            print("no tags")

        tags = set(q["tags"])  # Use a set for fast lookup & to avoid duplicates

        # Check SPARQL query content
        sparql = q.get("query", {}).get("sparql", "").lower()
        if any(keyword in sparql for keyword in ["count", "group by", "order by"]):
            tags.add("aggregation")
        if "ask" in sparql:
            tags.add("ask")

        # Check English language question
        # English question string
        question_text = ""
        for q_obj in q.get("question", []):
            if q_obj.get("language") == "en":
                question_text = q_obj.get("string", "").lower()
                break
        
        keyword_tags = {
            "all ": ["all"],
            "not ": ["negation"],
            "how many ": ["number", "literal"],
            "how much ": ["number", "literal"],
            "how tall ": ["number", "literal"],
            "how often ": ["number", "literal"],
            "how big ": ["number", "literal"],
            "how long ": ["number", "literal"],
            "the most ": ["the most"],
            "the least": ["the most"],
            "the first": ["the most"],
            "largest": ["the most"],
            "highest": ["the most"],
            "longest": ["the most"],
            "tallest": ["the most"],
            "oldest": ["the most"],
            "than": ["comparison"],
            "more ":["comparison"],
            "less ":["comparison"],
            "author": ["author", "person"],
            "actor": ["actor", "person"],
            "starring": ["actor", "person"],
            "directed": ["director", "person"],
            "director": ["director", "person"],
            "film": ["film"],
            "movie": ["film"],
            "episode": ["series"],
            " series": ["series"],
            " book": ["book"],
            "countries": ["country", "location"],
            "country": ["country", "location"],
            "france": ["country", "location"],
            "germany": ["country", "location"],
            "italy": ["country", "location"],
            "germany": ["country", "location"],
            "spain": ["country", "location"],
            "australia": ["country", "location"],
            "usa ": ["country", "location"],
            "japan ": ["country", "location"],
            "china": ["country", "location"],
            "city": ["city", "location"],
            "capital": ["city", "location"],
            "paris": ["city", "location"],
            "berlin": ["city", "location"],
            "london": ["city", "location"],
            "new york": ["city", "location"],
            "tokyo": ["city", "location"],
            "date": ["time"],
            "year": ["time"],
            "before ": ["time", "comparison"],
            "after ": ["time", "comparison"],
            "when ": ["time", "when"],
            "where ": ["location", "where"],
            "place": ["location"],
            "locat": ["location"],
            "enterprise": ["enterprise"],
            "company": ["enterprise"],
            "companies": ["enterprise"],
            "organization": ["organization"],
            "state ": ["state", "location"],
            "states ": ["state", "location"],
            "who ": ["who"],
            "what ": ["what"],
            "which ": ["which"],
            "football": ["sport"],
            "basketball": ["sport"],
            "player": ["player", "person"],
            "mountain": ["mountain"],
            "lake": ["lake"],
            "river": ["river"],
            "borders": ["borders"],
            "education": ["education"],
            "school": ["education"],
            "university": ["education"],
            "death": ["death"],
            "died": ["death"],
            "birth": ["birth"],
            "born": ["birth"],
            "airport": ["airport"],
        }
        for keyword, associated_tags in keyword_tags.items():
            if keyword in question_text:
                for tag in associated_tags:
                    tags.add(tag)

        # Check if the answer is a boolean
        if any(isinstance(a.get("boolean"), bool) for a in q.get("answers", [])):
            tags.add("boolean")

        # if q["answers"][0]["results"]["bindings"] exists
        # add if a single answer or several are expected
        if "results" in q.get("answers", [{}])[0]:
            if "bindings" in q["answers"][0]["results"]:
                if len(q["answers"][0]["results"]["bindings"]) == 1:
                    tags.add("single")
                elif len(q["answers"][0]["results"]["bindings"]) > 1:
                    tags.add("list")

        #order alphabetically the tags
        tags = sorted(tags)
    
        q["tags"] = list(tags)  # Convert back to list for JSON serialization

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def reorder_tags_in_file(input_path: str, output_path: str, priority_list: list[str]):
    """
    Loads a JSON file with questions, reorders the 'tags' field in each question
    based on a given priority list, and writes the result to a new file.
    
    Tags not found in the priority list are kept at the end in their original order.

    Parameters:
        input_path (str): Path to the input JSON file.
        output_path (str): Path where the output JSON will be saved.
        priority_list (list[str]): Desired tag order.
    """
    # Load the JSON file
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Build a priority index for sorting
    priority_index = {tag: i for i, tag in enumerate(priority_list)}

    # Reorder tags in each question
    for q in data.get("questions", []):
        if "tags" in q and isinstance(q["tags"], list):
            original_tags = q["tags"]
            q["tags"] = sorted(
                original_tags,
                key=lambda tag: (priority_index.get(tag, float("inf")), original_tags.index(tag))
            )

    # Save the reordered JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def get_all_tags(input_path: str):
    """
    Loads a JSON file and returns a sorted list of all unique tags
    found in the 'tags' field across all questions.

    Parameters:
        input_path (str): Path to the input JSON file.

    Returns:
        list[str]: Sorted list of unique tags.
    """
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    tag_set = set()

    for q in data.get("questions", []):
        if "tags" in q and isinstance(q["tags"], list):
            tag_set.update(q["tags"])

    tag_list = sorted(tag_set)
    return tag_list

def pass_tags_to_output_of_run(input_path: str, output_path: str):
    """
    Loads a JSON file and copies the 'tags' field from each question to the output file.
    To add tags to a run where the tags were not present in the input file.
    Parameters:
        input_path (str): Path to the input JSON file.
        output_path (str): Path where the output JSON will be saved.
    """
    # from json get dict of questions ids and corresponding tags
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    tags_dict = {}
    for q in data.get("questions", []):
        if "id" in q and "tags" in q:
            tags_dict[q["id"]] = q["tags"]

    # Load the output file and add the tags (for output file, questions are stored in the dict ["Data"]
    with open(output_path, "r", encoding="utf-8") as f:
        output_data = json.load(f)
    for q_id, q_data in output_data["Data"].items():
        if q_id in tags_dict:
            q_data["Tags"] = tags_dict[q_id]
    #dump
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=4)



if __name__ == "__main__":
    input_file = "./benchmark/Inputs/qald_9_plus_train_wikidata_patched.json"
    output_file = "./benchmark/Inputs/qald_9_plus_train_wikidata_patched.json"
    insert_tags_field(
        input_file,
        output_file
    )
    auto_tag_questions(
        output_file,
        output_file
    )

    print(get_all_tags(output_file))

    # pass_tags_to_output_of_run(
    #     input_file,
    #     './benchmark/BestOutputs/QALD9/QALD-9-plus_sparklisllm-LLMFrameworkOneShotForwardScoringReferences_20250403_100325.json'
    # )
