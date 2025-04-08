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
        if "all " in question_text:
            tags.add("all")
        if "not " in question_text:
            tags.add("negation")
        if "how many " in question_text:
            tags.update(["number", "literal"])
        if "the most " in question_text or "the least" in question_text or "the first" in question_text:
            tags.add("the most")
        if "author" in question_text:
            tags.add("author")
        if "film" in question_text or "movie" in question_text:
            tags.add("film")
        if "countries" in question_text or "country" in question_text:
            tags.add("country")
        if "city" in question_text or "capital" in question_text:
            tags.add("city")
        if "date" in question_text or "year" in question_text or "when" in question_text:
            tags.add("time")
        if "where " in question_text:
            tags.add("localization")
        if "enterprise" in question_text or "company" in question_text:
            tags.add("enterprise")
        if "state " in question_text or "states " in question_text:
            tags.add("state")
        if "who " in question_text:
            tags.add("who")
        if "what " in question_text:
            tags.add("what")
        if "which " in question_text:
            tags.add("which")
        if "when " in question_text:
            tags.add("when")
        if "where " in question_text:
            tags.add("where")

        # Check if the answer is a boolean
        if any(isinstance(a.get("boolean"), bool) for a in q.get("answers", [])):
            tags.add("boolean")

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


if __name__ == "__main__":
    input_file = "./benchmark/Inputs/qald_9_plus_train_wikidata_patched.json"
    output_file = "./benchmark/Inputs/aaa.json"
    insert_tags_field(
        input_file,
        output_file
    )
    auto_tag_questions(
        output_file,
        output_file
    )
    # reorder_tags_in_file(
    #     output_file,
    #     output_file,
    #     ["entity", "class", 
    #      "single", "list", "all", "boolean", "literal", "number",
    #      "aggregation", "ask", "negation"
    #      ]
    # )
    print(get_all_tags(output_file))
