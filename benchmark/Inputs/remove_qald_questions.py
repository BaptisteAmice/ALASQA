import json

# List of IDs to remove
nombres = [
    81, 31, 210, 187, 173, 166, 149, 132, 126, 10, 1, 178, 129,
    181, 50, 21, 96, 159, 107, 211, 144, 167, 151, 133, 165,
    108, 201, 194, 97, 19, 190, 94, 8, 119, 116
]

# Load the JSON file
file = r"C:\Users\PC\Desktop\llmSparklis\benchmark\Inputs\qald_9_plus_test_dbpedia_patched.json"
with open(file, "r", encoding="utf-8") as f:
    data = json.load(f)

# Filter out questions with an id in the list
filtered_questions = [
    q for q in data["questions"]
    if int(q["id"]) not in nombres
]

# Replace the questions list
data["questions"] = filtered_questions

# Save the cleaned JSON
with open(file, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"Filtered questions saved to 'filtered_questions.json'. {len(filtered_questions)} questions remaining.")
