from collections import defaultdict
import json
import matplotlib.pyplot as plt
import config

# Extract precision, recall and f1 list from dictionary (["data"][str(i)][Precision]
def extract_scores(file_name: str) -> tuple[list, list, list]:
    with open(file_name, 'r') as file:
        data = json.load(file)
    precisions = []
    recalls = []
    f1_scores = []
    for i in range(len(data["Data"])):
        
        precisions.append(data["Data"].get(str(i), {}).get("Precision") or 0.0)
        recalls.append(data["Data"].get(str(i), {}).get("Recall") or 0.0)
        f1_scores.append(data["Data"].get(str(i), {}).get("F1Score") or 0.0)
    return precisions, recalls, f1_scores

# Plot the accuracy, recall and f1 scores for each question
def accuracy_recall_f1_plot(accuracy, recall, f1_scores):
    questions = range(1, len(accuracy) + 1)  # Adjust based on your data length
    plt.scatter(questions, accuracy, label="Accuracy", marker="o")
    plt.scatter(questions, recall, label="Recall", marker="s")
    plt.scatter(questions, f1_scores, label="F1-score", marker="^")

    plt.xlabel("Questions")
    plt.ylabel("Score")
    plt.title("Performance of the system for each question")
    plt.legend()
    plt.grid(True)
    plt.show() 

# Boxplot of the scores
def boxplot_scores(accuracy, recall, f1_scores):
    plt.boxplot([accuracy, recall, f1_scores], tick_labels=["Accuracy", "Recall", "F1-score"])
    plt.ylabel("Score")
    plt.title("Boxplot of the scores")
    plt.grid(True)
    plt.show()

import json
from collections import defaultdict

def count_metric_values(json_file, constraints=None):
    """
    Counts occurrences of metric values in a JSON file, while applying constraints.

    Args:
        json_file (str): Path to the JSON file.
        constraints (dict): A dictionary where keys are field names (e.g., "Precision")
                            and values are functions that return True if the entry is valid.

    Returns:
        dict: Dictionary containing counts of metric values for valid entries.
    """
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    precision_counts = defaultdict(int)
    recall_counts = defaultdict(int)
    f1_counts = defaultdict(int)

    # Iterate through the "Data" section of the JSON
    for entry in data.get("Data", {}).values():
        # Apply constraints
        if constraints:
            if not all(func(entry.get(key)) for key, func in constraints.items()):
                continue  # Skip entry if any constraint fails

        precision = entry.get("Precision")
        recall = entry.get("Recall")
        f1_score = entry.get("F1Score")

        precision_counts[precision] += 1
        recall_counts[recall] += 1
        f1_counts[f1_score] += 1

    # Order keys: first None, then ascending
    def sort_key(x):
        return (x[0] is not None, x[0])

    precision_counts = dict(sorted(precision_counts.items(), key=sort_key))
    recall_counts = dict(sorted(recall_counts.items(), key=sort_key))
    f1_counts = dict(sorted(f1_counts.items(), key=sort_key))

    return {
        "PrecisionCounts": precision_counts,
        "RecallCounts": recall_counts,
        "F1ScoreCounts": f1_counts
    }

if __name__ == "__main__":
    input_file = config.script_dir + "/Outputs/to_keep/llm_extension_with_qa_extension_no_data/QALD-10_sparklisllm_20250225_145041.json"
    # precisions, recalls, f1_scores = extract_scores(input_file)
    # accuracy_recall_f1_plot(precisions, recalls, f1_scores)
    # boxplot_scores(precisions, recalls, f1_scores)
    
    constraints = {
        "SystemResult": lambda x:  x==None or x==[]
    }   

    print(count_metric_values(input_file,constraints))