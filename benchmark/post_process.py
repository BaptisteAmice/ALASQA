from collections import defaultdict
import json
import logging
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import seaborn as sns
import os
import re


# Page to display all data
pp = PdfPages("post_process_data.pdf")
show = False

# List of recognizable commands
command_list = [
    "a",
    "forwardProperty",
    "backwardProperty",
    "match",
    "higherThan",
    "lowerThan",
    "between",
    "before",
    "after",
    "asc",
    "desc",
    "and",
    "or",
    "not",
    "up",
    "down"
]

# List of recognizable error messages
error_messages = [
    "Error: No match found for <commands>...</commands>;",
    "Warning: Commands failed to finish due to: ",
    "Error: error while evaluating SPARQL query",
    "Error: error while parsing SPARQL results",
]

steps_names = {} # Global variable to store the names of the steps (need to call find_first_non_done_step to set it)

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
    plt.figure(figsize=(10, 6))
    plt.scatter(questions, precision, label="Precision", marker="o")
    plt.scatter(questions, recall, label="Recall", marker="s")
    plt.scatter(questions, f1_scores, label="F1-score", marker="^")

    plt.xlabel("Questions")
    plt.ylabel("Score")
    plt.title("Performance of the system for each question")
    plt.legend()
    plt.grid(True)
    pp.savefig()
    if show:
        plt.show() 

# Boxplot of the scores
def boxplot_scores(precision, recall, f1_scores, title_end: str):
    """
    Boxplot of the scores.
    """
    plt.figure()
    try:
        # boxplots
        plt.boxplot([precision, recall, f1_scores], 
                tick_labels=[ "Precision \n(Mean: {:.2f})".format(sum(precision) / len(precision)),
                              "Recall \n(Mean: {:.2f})".format(sum(recall) / len(recall)),
                              "F1-score \n(Mean: {:.2f})".format(sum(f1_scores) / len(f1_scores))])
        # plot means
        plt.scatter([1, 2, 3], [sum(precision) / len(precision), sum(recall) / len(recall), sum(f1_scores) / len(f1_scores)],
                    color='red', label='Mean')
    except:
        plt.text(x=0.5,y=0.5,s="No scores to plot.")

    plt.ylabel("Score")
    plt.title("Boxplot of the scores for " + title_end)
    plt.legend()
    plt.grid(True)
    pp.savefig()
    if show:
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

def hist_first_non_done_step(data: list, title_end: str):
    # Convert None to a string for proper sorting
    filtered_data = ['None' if x is None else x for x in data]
    
    # Count occurrences of each unique value
    unique_values, counts = np.unique(filtered_data, return_counts=True)
    
    # Sort values and ensure 'None' is at the end
    unique_values = sorted(unique_values, key=lambda x: (x == 'None', x))
    # Add corresponding names to the steps (if not None)
    unique_values = ["(" + x + ") " + steps_names[int(x)] if x != 'None' 
                     else x for x in unique_values]
    
    # Plot histogram
    plt.figure(figsize=(15, 6))
    plt.bar(unique_values, counts, color='skyblue', edgecolor='black')
    plt.xlabel('First non-Done Step')
    plt.ylabel('Count')
    plt.title("Histogram of First Non-Done Steps for "  + title_end)
    plt.xticks(unique_values)  # Ensure all unique values appear on x-axis
    plt.grid(axis='y')

    # Annotate each bar with its count
    for i, count in enumerate(counts):
        plt.text(i, count, str(count), ha='center', va='bottom', fontsize=8)

    pp.savefig()
    if show:
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
            steps_names[int(step_num)] = step["Name"]
            if step["Status"] != "DONE":
                non_done_step = int(step_num)
                break
        non_done_steps.append(non_done_step)
    return non_done_steps

def plot_box_system_time(filtered_data):
    """
    Plot the boxplot of the SystemTime.
    """
    system_times = [entry.get("SystemTime") for entry in filtered_data]
    plt.figure()
    plt.boxplot(system_times)
    plt.ylabel("System Time")
    plt.title("Boxplot of the System Time")
    plt.grid(True)
    pp.savefig()
    if show:
        plt.show()

def get_commands_from_reasoning(reasoning: str) -> list:
    """
    Extracts commands from the reasoning field.

    Args:
        reasoning (str): The reasoning field.
        command_list (list): A list of valid command names.

    Returns:
        list: List of commands extracted from the reasoning field.
    """
    # Extract content inside <commands>...</commands>
    match = re.search(r"<commands>(.*?)</commands>", reasoning, re.DOTALL)
    if not match:
        return []

    commands_str = match.group(1)
    commands = [cmd.strip() for cmd in commands_str.split(";") if cmd.strip()]

    used_commands = []
    for command in commands:
        found = False
        for c in command_list:
            # Ensure the command is a standalone word (beginning, end, or surrounded by spaces)
            if re.search(rf"(^|\s){re.escape(c)}(\s|$)", command):
                used_commands.append(c)
                found = True
                break
        if not found:
            used_commands.append("entity/literal")

    return used_commands

def get_commands_list(filtered_data):
    """
    Extracts commands from the reasoning field of the filtered data entries.

    Args:
        filtered_data (list): List of filtered data entries.
        command_list (list): List of valid commands.

    Returns:
        list: List of commands extracted from the reasoning field.
    """
    commands_list = []
    for entry in filtered_data:
        reasoning = entry.get("Reasoning")
        if not reasoning:
            logging.warning("Reasoning field is missing in the entry.")
            commands_list.append([])
            continue

        # Extract <reasoning>...</reasoning>
        match = re.search(r"(<commands>.*?</commands>)", reasoning, re.DOTALL)

        if not match:
            logging.warning("No <commands> tag found in the entry.")
            commands_list.append([])
            continue
        
        reasoning_content = match.group(1).strip()
        if not reasoning_content:
            logging.warning("Reasoning field is empty in the entry.")
            commands_list.append([])
            continue

        commands = get_commands_from_reasoning(reasoning_content)
        commands_list.append(commands)

    return commands_list

def get_system_errors(filtered_data):
    """
    Extracts system errors from the filtered data entries.

    Args:
        filtered_data (list): List of filtered data entries.

    Returns:
        list: List of system errors extracted from the SystemResult field.
    """
    system_errors = []
    for entry in filtered_data:
        error_field = entry.get("Error")
        if error_field:
            question_errors = []
            for error in error_messages:
                if error in error_field:
                    question_errors.append(error)
            if not question_errors:
                question_errors.append("No error message")
            system_errors.append(question_errors)
        else:
            system_errors.append([])
    return system_errors

def matrix_command_error(commands_list, system_errors):
    """
    Creates a matrix of used commands and system errors for each question.
    """
    #todo
    pass

def generate_boxplot(list_of_lists, values, x_label: str, y_label: str, label_rotation=45):
    # Create a dictionary to group values by their corresponding categories
    grouped_data = defaultdict(list)

    # Group the values by the first list's elements
    for i, sublist in enumerate(list_of_lists):
        # Convert each sublist to a set to remove duplicates, then add each item
        unique_items = set(sublist)
        for item in unique_items:
            grouped_data[item].append(values[i])

    # Convert the grouped data to a format that seaborn can handle
    boxplot_data = []
    categories = []
    means = []
    
    for category, group in grouped_data.items():
        categories.extend([category] * len(group))
        boxplot_data.extend(group)
        means.append(np.mean(group))

    # Create a DataFrame-like structure
    data = {str(x_label): categories, str(y_label): boxplot_data}
    
    # Create the figure
    plt.figure(figsize=(10, 8))

    # Plot the means as red dots on the boxplot
    for i, mean in enumerate(means):
        plt.scatter(x=i, y=mean, color='red', label='Mean' if i == 0 else "")

    # Display the count of items per group
    for i, (category, group) in enumerate(grouped_data.items()):
        # Calculate the number of items in each group
        count = len(group)
        # Annotate the count near the x-axis for each category
        plt.text(i, max(boxplot_data) + 0.2, f'n={count}', ha='center', fontsize=10, color='black')
   
    # Make the boxplot
    sns.boxplot(x=str(x_label), y=str(y_label), data=data, fill=False)
    plt.xticks(rotation=label_rotation, ha="right", fontsize=10)  # Adjust rotation and alignment
    plt.title("Boxplot of " + y_label + " per " + x_label)
    plt.grid()
    pp.savefig()
    if show:
        plt.show()

def all_prints(file_name: str):
    # Data to be displayed in a table
    table_headers = []
    table_data = []

    # All data
    table_headers.append("Question Count")
    all_data = load_and_filter_data(file_name, {})
    table_data.append([len(all_data)])

    # Unvalid data
    # constraints_invalid = {
    #     "BenchmarkResult": lambda x : x is None or x == []
    # }
    # filtered_invalid_data = load_and_filter_data(file_name, constraints_invalid)
    # table_headers.append("Empty BenchmarkResult")
    # table_data.append([len(filtered_invalid_data)])
        
    # Valid benchmark results
    constraints_none = {
        "BenchmarkResult": lambda x : x not in [None, []]
    }   
    filtered_valid_data = load_and_filter_data(file_name, constraints_none)
    table_headers.append("Valid benchmark results")
    table_data.append([len(filtered_valid_data)])


    precisions, recalls, f1_scores = extract_scores(filtered_valid_data)
    precision_recall_f1_plot(precisions, recalls, f1_scores)
    boxplot_scores(precisions, recalls, f1_scores, "valid benchmark results")

    precisions, recalls, f1_scores = extract_scores(filtered_valid_data)
    plot_box_system_time(filtered_valid_data)

    # Commands
    commands_list = get_commands_list(filtered_valid_data)
    generate_boxplot(commands_list, f1_scores, "Commands", "F1 Scores")
    print("Commands", commands_list)

    # System errors
    system_errors = get_system_errors(filtered_valid_data)
    print("System Errors", system_errors)
    generate_boxplot(system_errors, f1_scores, "System Errors", "F1 Scores", label_rotation=10)

    matrix_command_error(commands_list, system_errors)

    non_done_step = find_first_non_done_step(filtered_valid_data)
    hist_first_non_done_step(non_done_step, "valid benchmark results")

    # Empty reasoning
    constraints_empty_reasoning = {
        "Reasoning": lambda x: x == ""
    }
    filtered_empty_reasoning_data = load_and_filter_data(file_name, constraints_empty_reasoning)
    table_headers.append("Empty Reasoning")
    table_data.append([len(filtered_empty_reasoning_data)])    

    # Empty SystemResult
    constraints_empty_system_result = {
        "SystemResult": lambda x: x == "" or x is None or x == []
    }
    filtered_empty_system_result_data = load_and_filter_data(file_name, constraints_empty_system_result)
    table_headers.append("Empty SystemResult")
    table_data.append([len(filtered_empty_system_result_data)])

    non_done_step = find_first_non_done_step(filtered_empty_system_result_data)
    hist_first_non_done_step(non_done_step, "Empty SystemResult")

    # Non-empty response from the system
    filtered_non_empty_response = {
        "SystemResult" : lambda x: x not in [None, "", []],
    }
    filtered_non_empty_response_data = load_and_filter_data(file_name, filtered_non_empty_response)
    table_headers.append("Non-empty SystemResult")
    table_data.append([len(filtered_non_empty_response_data)])

    # Non-empty response from the system but with a score at  0
    filtered_non_empty_response_score_at_zero = {
        "SystemResult" : lambda x: x not in [None, "", []],
        "F1Score": lambda x: x == 0
    }
    filtered_non_empty_response_score_at_zero_data = load_and_filter_data(file_name, filtered_non_empty_response_score_at_zero)
    table_headers.append("Non-empty SystemResult\n(score at 0)")
    table_data.append([len(filtered_non_empty_response_score_at_zero_data)])

        # Expected boolean
    constraints_expected_boolean = {
        "BenchmarkResultType": lambda x: x == "boolean"
    }
    filtered_expected_boolean_data = load_and_filter_data(file_name, constraints_expected_boolean)
    table_headers.append("Expected Boolean")
    table_data.append([len(filtered_expected_boolean_data)])

    precisions, recalls, f1_scores = extract_scores(filtered_expected_boolean_data)
    boxplot_scores(precisions, recalls, f1_scores, "Expected Boolean")

    non_done_step = find_first_non_done_step(filtered_expected_boolean_data)
    hist_first_non_done_step(non_done_step, "Expected Boolean")

    # Expected uri
    constraints_expected_uri = {
        "BenchmarkResultType": lambda x: x == "uri"
    }
    filtered_expected_uri_data = load_and_filter_data(file_name, constraints_expected_uri)
    table_headers.append("Expected URI")
    table_data.append([len(filtered_expected_uri_data)])

    precisions, recalls, f1_scores = extract_scores(filtered_expected_uri_data)
    boxplot_scores(precisions, recalls, f1_scores, "Expected URI")

    non_done_step = find_first_non_done_step(filtered_expected_uri_data)
    hist_first_non_done_step(non_done_step, "Expected URI")

    # Expected literal
    constraints_expected_literal = {
        "BenchmarkResultType": lambda x: x == "literal"
    }
    filtered_expected_literal_data = load_and_filter_data(file_name, constraints_expected_literal)
    table_headers.append("Expected Literal")
    table_data.append([len(filtered_expected_literal_data)])

    precisions, recalls, f1_scores = extract_scores(filtered_expected_literal_data)
    boxplot_scores(precisions, recalls, f1_scores, "Expected Literal")

    non_done_step = find_first_non_done_step(filtered_expected_literal_data)
    hist_first_non_done_step(non_done_step, "Expected Literal")

    #todo specific warnings (from alerts, etc.)

    #todo specific used commands

    #todo matrice etape premiere erreur / commande

    # Table 
    fig, ax = plt.subplots()  # Adjust figure size
    ax.axis("off")  # Hide axes
    for i in range(len(table_data)):
        percentage = round(table_data[i][0] / len(all_data) * 100, 2)
        table_data[i].append(percentage)

    ax.table(cellText=table_data, colLabels=["Number of","%"], rowLabels=table_headers, bbox=[0.3, 0, 0.5, 1], cellLoc="center", colWidths=[1/6, 1/6])
    pp.savefig(fig)
    if show:
        plt.show()

    pp.close() # Close the pdf file

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.realpath(__file__))
    input_file = script_dir + "/Outputs/to_keep/llm_extension_with_qa_extension_no_data/pas_ouf.json"
    all_prints(input_file)