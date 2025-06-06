"""
This script removes specific questions from a QALD JSON file based on their IDs.
"""
import json

# List of IDs to remove
nombres = [
    25,87,145,195,258,330
]

# Load the JSON file
file = r"C:\Users\PC\Desktop\llmSparklis\benchmark\Inputs\qald_10_patched.json"
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
