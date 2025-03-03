from collections import defaultdict
import json
import logging
import matplotlib.pyplot as plt
import os

def extract_scores_from_file(file_name: str) -> tuple[list, list, list]:
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

# Plot the precision, recall and f1 scores for each question
def precision_recall_f1_plot(precision, recall, f1_scores):
    """
    Plot the precision, recall and f1 scores for each question.
    """
    questions = range(1, len(precision) + 1)  # Adjust based on your data length
    plt.scatter(questions, precision, label="Precision", marker="o")
    plt.scatter(questions, recall, label="Recall", marker="s")
    plt.scatter(questions, f1_scores, label="F1-score", marker="^")

    plt.xlabel("Questions")
    plt.ylabel("Score")
    plt.title("Performance of the system for each question")
    plt.legend()
    plt.grid(True)
    plt.show() 

# Boxplot of the scores
def boxplot_scores(precision, recall, f1_scores, title: str = "Boxplot of the scores"):
    """
    Boxplot of the scores.
    """
    plt.boxplot([precision, recall, f1_scores], 
                tick_labels=[ "Precision \n(Mean: {:.2f})".format(sum(precision) / len(precision)),
                              "Recall \n(Mean: {:.2f})".format(sum(recall) / len(recall)),
                              "F1-score \n(Mean: {:.2f})".format(sum(f1_scores) / len(f1_scores))])
    plt.ylabel("Score")
    plt.title(title)
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

def extract_scores(filtered_data):
    """
    Extracts precision, recall, and F1 scores from a list of filtered data entries.
    
    Args:
        filtered_data (list): List of filtered data entries.
    
    Returns:
        tuple: A tuple containing precision, recall, and F1 scores.
    """
    precisions = [entry.get("Precision") or 0.0 for entry in filtered_data]
    recalls = [entry.get("Recall") or 0.0 for entry in filtered_data]
    f1_scores = [entry.get("F1Score") or 0.0 for entry in filtered_data]
    
    return precisions, recalls, f1_scores


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

def hist_first_non_done_step(data: list, title: str = "Histogram of First Non-Done Steps"):
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
    plt.title(title)
    plt.xticks(unique_values)  # Ensure all unique values appear on x-axis
    plt.show()

def find_first_non_done_step(filtered_data):
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

def all_prints(file_name: str):
    # Unvalid data
    constraints_invalid = {
        "BenchmarkResult": lambda x : x is None or x == []
    }
    filtered_invalid_data = load_and_filter_data(file_name, constraints_invalid)
    print("Number of invalid data:", len(filtered_invalid_data))
    

    # Valid data
    constraints_none = {
        "BenchmarkResult": lambda x : x is not None
    }   
    filtered_valid_data = load_and_filter_data(file_name, constraints_none)
    print("Number of valid data:", len(filtered_valid_data))

    precisions, recalls, f1_scores = extract_scores(filtered_valid_data)
    precision_recall_f1_plot(precisions, recalls, f1_scores)
    boxplot_scores(precisions, recalls, f1_scores, "Boxplot of the scores for valid data")

    non_done_step = find_first_non_done_step(filtered_valid_data)
    hist_first_non_done_step(non_done_step, "Histogram of First Non-Done Steps for Valid Data")

    # Empty reasoning
    constraints_empty_reasoning = {
        "Reasoning": lambda x: x == ""
    }
    filtered_empty_reasoning_data = load_and_filter_data(file_name, constraints_empty_reasoning)
    print("Number of empty reasoning:", len(filtered_empty_reasoning_data))

    # Empty SystemResult
    constraints_empty_system_result = {
        "SystemResult": lambda x: x == "" or x is None or x == []
    }
    filtered_empty_system_result_data = load_and_filter_data(file_name, constraints_empty_system_result)
    print("Number of empty SystemResult:", len(filtered_empty_system_result_data))

    non_done_step = find_first_non_done_step(filtered_empty_system_result_data)
    hist_first_non_done_step(non_done_step, "Histogram of First Non-Done Steps for Empty SystemResult")

    #todo specific warnings (from alerts, etc.)

    # Expected boolean
    constraints_expected_boolean = {
        "BenchmarkResultType": lambda x: x == "boolean"
    }
    filtered_expected_boolean_data = load_and_filter_data(file_name, constraints_expected_boolean)
    print("Number of expected boolean:", len(filtered_expected_boolean_data))

    precisions, recalls, f1_scores = extract_scores(filtered_expected_boolean_data)
    boxplot_scores(precisions, recalls, f1_scores, "Boxplot of the scores for Expected Boolean")

    non_done_step = find_first_non_done_step(filtered_expected_boolean_data)
    hist_first_non_done_step(non_done_step, "Histogram of First Non-Done Steps for Expected Boolean")

    # Expected uri
    constraints_expected_uri = {
        "BenchmarkResultType": lambda x: x == "uri"
    }
    filtered_expected_uri_data = load_and_filter_data(file_name, constraints_expected_uri)
    print("Number of expected uri:", len(filtered_expected_uri_data))

    precisions, recalls, f1_scores = extract_scores(filtered_expected_uri_data)
    boxplot_scores(precisions, recalls, f1_scores, "Boxplot of the scores for Expected URI")

    non_done_step = find_first_non_done_step(filtered_expected_uri_data)
    hist_first_non_done_step(non_done_step, "Histogram of First Non-Done Steps for Expected URI")

    # Expected literal
    constraints_expected_literal = {
        "BenchmarkResultType": lambda x: x == "literal"
    }
    filtered_expected_literal_data = load_and_filter_data(file_name, constraints_expected_literal)
    print("Number of expected literal:", len(filtered_expected_literal_data))

    precisions, recalls, f1_scores = extract_scores(filtered_expected_literal_data)
    boxplot_scores(precisions, recalls, f1_scores, "Boxplot of the scores for Expected Literal")

    non_done_step = find_first_non_done_step(filtered_expected_literal_data)
    hist_first_non_done_step(non_done_step, "Histogram of First Non-Done Steps for Expected Literal")



if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.realpath(__file__))
    input_file = script_dir + "/Outputs/to_keep/llm_extension_with_qa_extension_no_data/QALD-10_sparklisllm_20250228_171915.json"
    all_prints(input_file)