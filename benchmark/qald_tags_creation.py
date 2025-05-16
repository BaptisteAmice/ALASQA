# Script to easily add tags
# This script isn't sufficient and should be complemented by manual tagging

import json
import re


def contains_literal_type(obj):
    if isinstance(obj, dict):
        if obj.get("type") == "literal":
            return True
        return any(contains_literal_type(v) for v in obj.values())
    elif isinstance(obj, list):
        return any(contains_literal_type(item) for item in obj)
    return False


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

def auto_tag_questions(input_path: str, output_path: str, keep_existing_tags: bool = True):
    """
    Adds specific tags to each question based on query structure, language content,
    and answer type. Tags are only added if not already present.
    """
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for q in data.get("questions", []):
        if not keep_existing_tags:
            # If not keeping existing tags, initialize an empty list
            q["tags"] = []
            print("Resetting tags to empty list.")
        elif "tags" not in q:
            # If the tags field doesn't exist, initialize an empty list
            q["tags"] = []
            print("No existing tags, initializing empty list.")

        tags = set(q["tags"])  # Use a set for fast lookup & to avoid duplicates

        # Check SPARQL query content
        sparql = q.get("query", {}).get("sparql", "").lower()
        if any(keyword in sparql for keyword in ["count", "group by", "order by"]):
            tags.add("aggregation")
        if "ask" in sparql:
            tags.add("ask")
        if "limit  " in sparql:
            tags.add("limit")
        if "offset " in sparql:
            tags.add("offset")
        if ("YEAR(") in sparql or ("MONTH(") in sparql or ("DAY(") in sparql:
            tags.add("time")

        # Check English language question
        # English question string
        question_text = ""
        for q_obj in q.get("question", []):
            if q_obj.get("language") == "en":
                question_text = q_obj.get("string", "").lower()
                break
        
        keyword_tags = {
            " all ": ["all"],
            "not ": ["negation"],
            " and ": ["and"],
            " or ": ["or"],
            "how many ": ["number"],
            "how much ": ["number"],
            "how tall ": ["number"],
            "how often ": ["number"],
            "how big ": ["number"],
            "how long ": ["number"],
            "the most ": ["the most"],
            "the least": ["the most"],
            "the first": ["the most"],
            "the last": ["the most"],
            "first ": ["the most"],
            "last ": ["the most"],
            "largest": ["the most"],
            "biggest": ["the most"],
            "smallest": ["the most"],
            "highest": ["the most"],
            "lowest": ["the most"],
            "longest": ["the most"],
            "shortest": ["the most"],
            "tallest": ["the most"],
            "oldest": ["the most"],
            "youngest": ["the most"],
            "heaviest": ["the most"],
            "lightest": ["the most"],
            "than": ["comparison"],
            "more ":["comparison"],
            "less ":["comparison"],
            "people ": ["person"],
            "who ": ["who", "person"], #not always a person but most of the time
            "author": ["author", "person"],
            "writer": ["author", "person"],
            "wrote": ["author", "person"],
            "actor": ["actor", "person"],
            "starring": ["actor", "person"],
            "directed": ["director", "person"],
            "director": ["director", "person"],
            "player": ["person"],
            "mayor ": ["person"],
            "mayors ": ["person"],
            "monarch  ": ["person"],
            "monarchs ": ["person"],
            "president ": ["person"],
            "presidents ": ["person"],
            "governor ": ["person"],
            "governors ": ["person"],
            "chancellor ": ["person"],
            "chancellors ": ["person"],
            "astronaut": ["person"],
            "cosmonaut": ["person"],
            "swimmer": ["person"],
            "architect ": ["person"],
            "architects ": ["person"],
            "pope ": ["person"],
            "politician ": ["person"],
            "poet ": ["person"],
            "musician": ["person"],
            "bandleader": ["person"],
            "designer ": ["person"],
            "owner": ["person"],

            # Celebrities
            "dan brown": ["person"],
            "albert": ["person"],
            "einstein": ["person"],
            "burton": ["person"],
            "liz ": ["person"],
            "taylor ": ["person"],
            "william": ["person"],
            "shatner": ["person"],
            "guy ritchie": ["person"],
            "garry": ["person"],
            "marshall": ["person"],
            "julia": ["person"],
            "robert": ["person"],
            "clint eastwood": ["person"],
            "baldwin": ["person"],
            "christian bale": ["person"],
            "natalie": ["person"],
            "portman": ["person"],
            "francis": ["person"],
            "ford coppola": ["person"],
            "benicio": ["person"],
            "del toro": ["person"],
            "rourke": ["person"],
            "ritchie": ["person"],
            "neymar": ["person"],
            "abraham": ["person"],
            "lincoln": ["person"],
            "ingrid": ["person"],
            "bergman": ["person"],
            "hillel Slovak": ["person"],
            "jesse": ["person"],
            "eisenberg": ["person"],
            "lou reed": ["person"],
            "john": ["person"],
            "paul": ["person"],
            "jfk ": ["person"],
            "tom cruise": ["person"],
            "sigmund freud": ["person"],
            "douglas hofstadter": ["person"],
            "obama": ["person"],
            "michelle": ["person"],
            "adele": ["person"],
            "frank herbert": ["person"],
            "shakespeare": ["person"],
            "rachel stevens": ["person"],
            "donald trump": ["person"],
            "hillel slovak": ["person"],
            "claudia": ["person"],
            "schiffer": ["person"],

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
            "japan": ["country", "location"],
            "china": ["country", "location"],
            "philippines": ["country", "location"],
            "pakistan": ["country", "location"],
            "ireland": ["country", "location"],
            "netherlands": ["country", "location"],
            "poland": ["country", "location"],
            "ukraine": ["country", "location"],
            "iraq": ["country", "location"],
            "canada": ["country", "location"],

            "city": ["city", "location"],
            "capital": ["city", "location"],
            
            "paris": ["city", "location"],
            "berlin": ["city", "location"],
            "london": ["city", "location"],
            "new york": ["city", "location"],
            "tokyo": ["city", "location"],
            "heraklion": ["city", "location"],
            "baikonur": ["city", "location"],
            "moscow": ["city", "location"],
            "munich": ["city", "location"],
            "maribor": ["city", "location"],
            "cairo": ["city", "location"],

            "current": ["current"],
            "date": ["time"],
            "year": ["time"],
            "before ": ["time", "comparison"],
            "after ": ["time", "comparison"],
            "when ": ["time", "when"],
            "where ": ["location", "where"],
            "place": ["location"],
            "locat": ["location"],
            "organization": ["organization"],
            "enterprise": ["enterprise", "organization"],
            "company": ["enterprise", "organization"],
            "companies": ["enterprise", "organization"],

            "gmt": ["enterprise", "organization"],
            "air china": ["enterprise", "organization"],
            "universal studios": ["enterprise", "organization"],

            "state ": ["state", "location"],
            "states ": ["state", "location"],

            "wyoming": ["state", "location"],

            "what ": ["what"],
            "which ": ["which"],
            "football": ["sport"],
            "basketball": ["sport"],
            "soccer": ["sport"],
            "player": ["player", "person"],
            "mountain": ["mountain"],

            "urals": ["mountain"],
            "everest": ["mountain"],

            "lake": ["lake"],
            "river": ["river"],
            "borders": ["borders"],
            "education": ["education"],
            "school": ["education"],
            "university": ["education"],
            "death": ["death"],
            "died": ["death"],
            "assassinated": ["death"],
            "killed": ["death"],
            "birth": ["birth"],
            "born": ["birth"],
            "airport": ["airport"],

            "minecraft": ["game"],
            "boardgame": ["game"],
            "don't starve": ["game"],
            "Warcraft": ["game"],
            "game": ["game"],

            "language": ["language"],
        }

        matched_spans = []
        question_text_lower = question_text.lower()

        # Sort by length (longer phrases first)
        # By sorting by length, if a a section of the question matches to several keywords patterns, we only add the keyword of the longest match (but if the other keyword appear somewhere else in the question, we add it)
        sorted_keywords = sorted(keyword_tags.items(), key=lambda x: -len(x[0]))

        for keyword, associated_tags in sorted_keywords:
            for match in re.finditer(re.escape(keyword), question_text_lower):
                start, end = match.span()

                # Skip if this span overlaps with any previous match
                if any(s <= start < e or s < end <= e for s, e in matched_spans):
                    continue

                # Record matched span
                matched_spans.append((start, end))

                # Add tags
                for tag in associated_tags:
                    tags.add(tag)

        # Check if the answer is a boolean
        if any(isinstance(a.get("boolean"), bool) for a in q.get("answers", [])):
            tags.add("boolean")

        # if q["answers"][0]["results"]["bindings"] exists
        if "results" in q.get("answers", [{}])[0]:
            # add if a single answer or several are expected
            if "bindings" in q["answers"][0]["results"]:
                if len(q["answers"][0]["results"]["bindings"]) == 1:
                    tags.add("single")
                elif len(q["answers"][0]["results"]["bindings"]) > 1:
                    tags.add("list")

            # Check if the answer is a literal
            if contains_literal_type(q["answers"][0]["results"]["bindings"]):
                tags.add("literal")

        

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
        output_file,
        keep_existing_tags=False
    )

    print(get_all_tags(output_file))

    # pass_tags_to_output_of_run(
    #     input_file,
    #     './benchmark/BestOutputs/QALD9/QALD-9-plus_sparklisllm-LLMFrameworkOneShotForwardScoringReferences_20250403_100325.json'
    # )
