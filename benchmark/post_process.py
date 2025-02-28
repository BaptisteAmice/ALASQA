from collections import defaultdict
import json
import logging
import matplotlib.pyplot as plt
import os

def extract_scores(file_name: str) -> tuple[list, list, list]:
    """
    Extracts precision, recall, and F1 scores from a JSON file.
    """
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
    """
    Plot the accuracy, recall and f1 scores for each question.
    """
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
    """
    Boxplot of the scores.
    """
    plt.boxplot([accuracy, recall, f1_scores], tick_labels=["Accuracy", "Recall", "F1-score"])
    plt.ylabel("Score")
    plt.title("Boxplot of the scores")
    plt.grid(True)
    plt.show()

import json
from collections import defaultdict

def load_and_filter_data(json_file, constraints=None):
    """
    Loads a JSON file and filters its data based on given constraints.
    
    Args:
        json_file (str): Path to the JSON file.
        constraints (dict): A dictionary where keys are field names and values are functions
                            that return True if the entry is valid.
    
    Returns:
        list: Filtered list of data entries.
    """
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    filtered_data = []
    for entry in data.get("Data", {}).values():
        if constraints and not all(func(entry.get(key)) for key, func in constraints.items()):
            continue
        filtered_data.append(entry)
    
    return filtered_data


def count_metric_values(filtered_data):
    """
    Counts occurrences of metric values in a list of filtered data entries.
    
    Args:
        filtered_data (list): List of filtered data entries.
    
    Returns:
        dict: Dictionary containing counts of metric values.
    """
    precision_counts = defaultdict(int)
    recall_counts = defaultdict(int)
    f1_counts = defaultdict(int)
    
    for entry in filtered_data:
        precision_counts[entry.get("Precision")] += 1
        recall_counts[entry.get("Recall")] += 1
        f1_counts[entry.get("F1Score")] += 1
    
    def sort_key(x):
        return (x[0] is not None, x[0])
    
    return {
        "PrecisionCounts": dict(sorted(precision_counts.items(), key=sort_key)),
        "RecallCounts": dict(sorted(recall_counts.items(), key=sort_key)),
        "F1ScoreCounts": dict(sorted(f1_counts.items(), key=sort_key))
    }

import matplotlib.pyplot as plt
import numpy as np

def hist_first_non_done_step(data):
    # Convert None to a string for proper sorting
    filtered_data = ['None' if x is None else x for x in data]
    
    # Count occurrences of each unique value
    unique_values, counts = np.unique(filtered_data, return_counts=True)
    
    # Sort values to ensure 'None' is at the end
    unique_values = sorted(unique_values, key=lambda x: (x == 'None', x))
    
    # Plot histogram
    plt.bar(unique_values, counts, color='skyblue', edgecolor='black')
    plt.xlabel('First non-Done Step')
    plt.ylabel('Count')
    plt.title('Histogram of First Non-Done Steps')
    plt.xticks(unique_values)  # Ensure all unique values appear on x-axis
    plt.show()

def find_first_non_done_step(steps_status):
    """
    Finds the first step number in the StepsStatus field whose status is different from 'DONE'.
    
    Args:
        steps_status (str): The JSON string representing the steps and their statuses.
    
    Returns:
        int or None: The first step number with a status not equal to 'DONE', or None if all are DONE.
    """
    non_done_steps = []
    for entry in filtered_data:
        steps_status = entry.get("StepsStatus")

        if not steps_status:
            logging.warning("StepsStatus field is missing in the entry, skipping.")
            continue

        # Parse the StepsStatus field into a dictionary
        steps = json.loads(steps_status)
        
        non_done_step = None
        # Iterate over steps and find the first one that is not 'DONE'
        for step_num, step in steps.items():
            if step["Status"] != "DONE":
                non_done_step = int(step_num)
                break
        non_done_steps.append(non_done_step)
    return non_done_steps


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.realpath(__file__))
    input_file = script_dir + "/Outputs/to_keep\llm_extension_with_qa_extension_no_data\QALD-10_sparklisllm_20250228_141051_partiel.json"
    precisions, recalls, f1_scores = extract_scores(input_file)
    accuracy_recall_f1_plot(precisions, recalls, f1_scores)
    boxplot_scores(precisions, recalls, f1_scores)
    
    constraints = {
        #"BenchmarkResult": lambda x : not x in [True, False],
        #"SystemResult": lambda x:  x in [True, False]
    }   
    filtered_data = load_and_filter_data(input_file, constraints)
    non_done_step = find_first_non_done_step(filtered_data)
    print(non_done_step)
    hist_first_non_done_step(non_done_step)