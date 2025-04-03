from collections import defaultdict
import json
import logging
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.lines as mlines
import matplotlib.table as tbl
import matplotlib.patches as mpatches
import seaborn as sns
import networkx as nx
import numpy as np
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
    "down",
    "goback",
    "filter"
]

# List of recognizable error messages
error_messages = [
    # System error messages
    "Empty LLM output",
    "Error: No match found in tags",
    "Warning: Commands failed to finish",
    "Error: error while evaluating SPARQL query",
    "Error: error while parsing SPARQL results",
    "Error: condition shouldn't have matched",

    # Alert messages
    "The query was not understood by the SPARQL endpoint",
    "There was an error at the SPARQL endpoint",

    # System evaluation/test system error messages
    "Timeout",
    "Error: please try to intercept the error before.",
]

step_names = {} # Global variable to store the names of the steps (need to call find_first_non_done_step to set it)

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
    plt.close()

def plot_scores_relative_to_core_responses(core_files: list[str], new_file: str, max_keys=10):
    """
    Plots the comparison of Precision, Recall, and F1Score between a new dataset and core datasets.
    
    Args:
        core_files (list[str]): List of core dataset file paths.
        new_file (str): Path to the new dataset file.
        output_pdf (str): Path to save the output PDF.
        show (bool): Whether to display the plots.
        max_keys (int): Maximum number of x-axis labels to display.
    """
    metrics = ["Precision", "Recall", "F1Score"]

    # Load the new dataset
    new_data = load_and_filter_data(new_file, {})
    
    # Load all core datasets and index them by key
    core_data_list = [load_and_filter_data(core_file, {}) for core_file in core_files]

    # Find the common keys in all datasets
    common_keys = set(new_data.keys())
    for core_data in core_data_list:
        common_keys.intersection_update(core_data.keys())

    if not common_keys:
        print("No common keys found across datasets. Exiting.")
        return

    # Sort keys numerically if possible
    try:
        sorted_keys = sorted(common_keys, key=int)
    except ValueError:
        print("Warning: Some keys are not numeric. Sorting lexicographically instead.")
        sorted_keys = sorted(common_keys)

    # Prepare x-axis labels (limit to max_keys)
    if len(sorted_keys) > max_keys:
        selected_indices = np.linspace(0, len(sorted_keys) - 1, max_keys, dtype=int)
        selected_labels = {sorted_keys[i] for i in selected_indices}  # Use a set for quick lookup
    else:
        selected_labels = set(sorted_keys)

    for metric in metrics:
        plt.figure(figsize=(14, 6))

        nbre_improvements = 0
        nbre_degradations = 0
        nbre_no_change = 0

        # Extract and plot all data points
        for key in sorted_keys:
            new_score = new_data[key].get(metric, 0.0) or 0.0
            core_scores = [core_data[key].get(metric, 0.0) or 0.0 for core_data in core_data_list]

            min_core = min(core_scores)
            max_core = max(core_scores)

            if new_score < min_core:
                color = 'red'
                nbre_degradations += 1
            elif new_score > max_core:
                color = 'green'
                nbre_improvements += 1
            else:
                color = 'blue'
                nbre_no_change += 1

            plt.scatter(int(key), new_score, color=color)  # Plot using int key

        # Define legend handles
        worse_handle = mlines.Line2D([], [], color='red', marker='o', linestyle='None', markersize=8, label=f'Worse ({nbre_degradations})')
        better_handle = mlines.Line2D([], [], color='green', marker='o', linestyle='None', markersize=8, label=f'Better ({nbre_improvements})')
        in_range_handle = mlines.Line2D([], [], color='blue', marker='o', linestyle='None', markersize=8, label=f'In core range ({nbre_no_change})')

        plt.legend(handles=[worse_handle, better_handle, in_range_handle])
        plt.xlabel("Response Key (Numerically Ordered)")
        plt.ylabel(metric)
        plt.title(f"Comparison of {metric} scores to all core responses")

        # Show only selected x-axis labels
        plt.xticks(
            ticks=[int(k) for k in sorted_keys if k in selected_labels], 
            labels=[k for k in sorted_keys if k in selected_labels], 
            rotation=45, ha="right", fontsize=8
        )

        plt.grid(True)
        pp.savefig()
        if show:
            plt.show()
        plt.close()

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
    plt.close()

def load_and_filter_data(json_file, constraints=None):
    """
    Loads a JSON file and filters its data based on given constraints.
    
    Args:
        json_file (str): Path to the JSON file.
        constraints (dict): A dictionary where keys are field names and values are functions
                            that return True if the entry is valid.
    
    Returns:
        dict: Dictionary of filtered data entries with keys from the JSON.
    """
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    filtered_data = {}
    for key, entry in data.get("Data", {}).items():
        if constraints and not all(func(entry.get(field)) for field, func in constraints.items()):
            continue
        filtered_data[key] = entry
    
    return filtered_data

def extract_scores(filtered_data):
    """
    Extracts precision, recall, and F1 scores from a list of filtered data entries.
    
    Args:
        filtered_data (list): List of filtered data entries.
    
    Returns:
        tuple: A tuple containing precision, recall, and F1 scores.
    """
    precisions = [entry.get("Precision") or 0.0 for entry in filtered_data.values()]
    recalls = [entry.get("Recall") or 0.0 for entry in filtered_data.values()]
    f1_scores = [entry.get("F1Score") or 0.0 for entry in filtered_data.values()]
    
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
    
    for entry in filtered_data.values():
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

def hist_first_non_done_step(data: list, title_end: str):
    # Convert None to a string for proper sorting
    filtered_data = ['None' if x is None else x for x in data]
    
    # Count occurrences of each unique value
    unique_values, counts = np.unique(filtered_data, return_counts=True)
    
    # Sort values and ensure 'None' is at the end
    unique_values = sorted(unique_values, key=lambda x: (x == 'None', x))
    # Add corresponding names to the steps (if not None)
    unique_values = ["(" + str(x) + ") " + step_names[int(x)] if x != 'None' 
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
    plt.close()

def find_first_non_done_step(filtered_data): #todo remake
    """
    Finds the first step number in the StepsStatus field whose status is different from 'DONE'.
    
    Args:
        steps_status (str): The JSON string representing the steps and their statuses.
    
    Returns:
        int or None: The first step number with a status not equal to 'DONE', or None if all are DONE.
    """
    non_done_steps = []
    for entry in filtered_data.values():
        steps_status = entry.get("StepsStatus")

        if not steps_status:
            logging.warning("StepsStatus field is missing in the entry, skipping.")
            continue

        # Parse the StepsStatus field into a dictionary
        steps = json.loads(steps_status)
        
        non_done_step = None
        # Iterate over steps and find the first one that is not 'DONE'
        for step_num, step in steps.items():
            step_names[int(step_num)] = step["Name"]
            if step["Status"] != "DONE":
                non_done_step = int(step_num)
                break
        non_done_steps.append(non_done_step)
    return non_done_steps

def plot_box_system_time(filtered_data):
    """
    Plot the boxplot of the SystemTime.
    """
    system_times = [entry.get("SystemTime") for entry in filtered_data.values()]
    plt.figure()
    plt.boxplot(system_times)
    plt.ylabel("System Time")
    plt.title("Boxplot of the System Time")
    plt.grid(True)
    pp.savefig()
    if show:
        plt.show()
    plt.close()

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
    for entry in filtered_data.values():
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
    for entry in filtered_data.values():
        error_field = entry.get("Error")
        if error_field:
            question_errors = []
            for error in error_messages:
                if error in error_field:
                    question_errors.append(error)
            if not question_errors:
                question_errors.append("No matched error message")
            system_errors.append(question_errors)
        else:
            system_errors.append(["No error message"])
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
        plt.text(i, -0.045, f'n={count}', ha='center', fontsize=10, color='black')
   
    # Make the boxplot
    sns.boxplot(x=str(x_label), y=str(y_label), data=data, fill=False)
    plt.xticks(rotation=label_rotation, ha="right", fontsize=10)  # Adjust rotation and alignment
    plt.title("Boxplot of " + y_label + " per " + x_label)
    plt.grid()
    pp.savefig()
    if show:
        plt.show()
    plt.close()

def make_good_core(file_names: list, exclusive_core: bool = True):
    """
    Builds a 'core' set of responses where F1-score > 0 across multiple datasets.
    
    Args:
        file_names (list[str]): List of dataset filenames.
        exclusive_core (bool): If True, only responses that are good in all files are kept.
    
    Returns:
        tuple: (core_keys, core_precisions, core_recalls, core_f1s) with keys sorted numerically.
    """
    # Load and extract scores
    core_data_list = [load_and_filter_data(file, {}) for file in file_names]
    
    # Get common keys across all files
    common_keys = set(core_data_list[0].keys())
    for core_data in core_data_list[1:]:
        common_keys.intersection_update(core_data.keys())

    # Sort keys numerically
    try:
        sorted_keys = sorted(common_keys, key=int)
    except ValueError:
        sorted_keys = sorted(common_keys)

    core_precisions, core_recalls, core_f1s = [], [], []
    final_keys = []

    for key in sorted_keys:
        # Extract scores per key
        f1_scores_per_file = [core_data[key].get("F1Score", 0.0) or 0.0 for core_data in core_data_list]
        
        if ((exclusive_core and all(f1 > 0 for f1 in f1_scores_per_file)) or 
            (not exclusive_core and any(f1 > 0 for f1 in f1_scores_per_file))):
            
            final_keys.append(key)
            core_precisions.append([core_data[key].get("Precision", 0.0) or 0.0 for core_data in core_data_list])
            core_recalls.append([core_data[key].get("Recall", 0.0) or 0.0 for core_data in core_data_list])
            core_f1s.append(f1_scores_per_file)

    return final_keys, core_precisions, core_recalls, core_f1s

def plot_scores_relative_to_core_responses_multiple_criteria(core_files: list[str], new_files: list[str], evaluated_criteria: str, max_keys=10):
    """
    Plots the comparison of multiple new datasets' Precision, Recall, and F1Score against core datasets
    based on a specific evaluated criteria (min, max, mean).
    
    Args:
        core_files (list[str]): List of core dataset file paths.
        new_files (list[str]): List of new dataset file paths.
        evaluated_criteria (str): The criteria for evaluation ("min", "max", "mean").
        max_keys (int): Maximum number of x-axis labels to display.
        show (bool): Whether to display the plots.
    """
    metrics = ["Precision", "Recall", "F1Score"]

    # Load all core datasets and index them by key
    core_data_list = [load_and_filter_data(core_file, {}) for core_file in core_files]

    # Load the new datasets
    new_data_list = [load_and_filter_data(new_file, {}) for new_file in new_files]

    # Find the common keys in all datasets
    common_keys = set(core_data_list[0].keys())
    for core_data in core_data_list[1:]:
        common_keys.intersection_update(core_data.keys())
    for new_data in new_data_list:
        common_keys.intersection_update(new_data.keys())

    if not common_keys:
        print("No common keys found across datasets. Exiting.")
        return

    # Sort keys numerically if possible
    try:
        sorted_keys = sorted(common_keys, key=int)
    except ValueError:
        print("Warning: Some keys are not numeric. Sorting lexicographically instead.")
        sorted_keys = sorted(common_keys)

    # Prepare x-axis labels (limit to max_keys)
    if len(sorted_keys) > max_keys:
        selected_indices = np.linspace(0, len(sorted_keys) - 1, max_keys, dtype=int)
        selected_labels = {sorted_keys[i] for i in selected_indices}  # Use a set for quick lookup
    else:
        selected_labels = set(sorted_keys)

    # Criteria evaluation function
    def evaluate_criteria(core_scores, criterion):
        if criterion == "min":
            return min(core_scores)
        elif criterion == "max":
            return max(core_scores)
        elif criterion == "mean":
            return np.mean(core_scores)
        else:
            raise ValueError(f"Unsupported criterion: {criterion}")

    # Iterate through metrics
    for metric in metrics:
        plt.figure(figsize=(14, 6))

        # Initialize counters for the legend
        nbre_improvements = 0
        nbre_degradations = 0
        nbre_no_change = 0

        # Extract and plot all data points
        for key in sorted_keys:
            core_scores = [core_data[key].get(metric, 0.0) or 0.0 for core_data in core_data_list]
            core_evaluated_score = evaluate_criteria(core_scores, evaluated_criteria)

            # Calculate the aggregated value (max, mean, etc.) across all new datasets for the current key
            new_scores = [new_data[key].get(metric, 0.0) or 0.0 for new_data in new_data_list]
            new_evaluated_score = evaluate_criteria(new_scores, evaluated_criteria)

            if new_evaluated_score < core_evaluated_score:
                color = 'red'
                nbre_degradations += 1
            elif new_evaluated_score > core_evaluated_score:
                color = 'green'
                nbre_improvements += 1
            else:
                color = 'blue'
                nbre_no_change += 1

            # Plot the core score in black (under the new score if overlapping)
            plt.scatter(int(key), core_evaluated_score, color='black', label="Core Score" if key == sorted_keys[0] else "")  
            plt.scatter(int(key), new_evaluated_score, color=color)  # Plot using int key

        # Define legend handles
        worse_handle = mlines.Line2D([], [], color='red', marker='o', linestyle='None', markersize=8, label=f'Worse ({nbre_degradations})')
        better_handle = mlines.Line2D([], [], color='green', marker='o', linestyle='None', markersize=8, label=f'Better ({nbre_improvements})')
        in_range_handle = mlines.Line2D([], [], color='blue', marker='o', linestyle='None', markersize=8, label=f'In core range ({nbre_no_change})')

        plt.legend(handles=[worse_handle, better_handle, in_range_handle])
        plt.xlabel("Response Key (Numerically Ordered)")
        plt.ylabel(metric)
        plt.title(f"Comparison of {metric} scores using {evaluated_criteria} criteria")

        # Show only selected x-axis labels
        plt.xticks(
            ticks=[int(k) for k in sorted_keys if k in selected_labels], 
            labels=[k for k in sorted_keys if k in selected_labels], 
            rotation=45, ha="right", fontsize=8
        )

        plt.grid(True)
        pp.savefig()
        if show:
            plt.show()
        plt.close()


def generate_score_comparison_matrices_to_core(core_files: list[str], new_files: list[str], evaluated_criteria: str, max_columns=None):
    if not core_files:
        print("No core to compare to.")
        return
    
    metrics = ["Precision", "Recall", "F1Score"]
    core_data_list = [load_and_filter_data(core_file, {}) for core_file in core_files]
    new_data_list = [load_and_filter_data(new_file, {}) for new_file in new_files]
    common_keys = set(core_data_list[0].keys())
    for core_data in core_data_list[1:]:
        common_keys.intersection_update(core_data.keys())
    for new_data in new_data_list:
        common_keys.intersection_update(new_data.keys())

    if not common_keys:
        print("No common keys found across datasets. Exiting.")
        return

    try:
        sorted_keys = sorted(common_keys, key=int)
    except ValueError:
        print("Warning: Some keys are not numeric. Sorting lexicographically instead.")
        sorted_keys = sorted(common_keys)

    # if their isn't a max column number, we want as many columns as rows
    if max_columns == None:
        #so we use the rounded square root of the number of keys
        max_columns = int(np.ceil(np.sqrt(len(sorted_keys))))

    def evaluate_criteria(core_scores, criterion):
        if criterion == "min":
            return min(core_scores)
        elif criterion == "max":
            return max(core_scores)
        elif criterion == "mean":
            return np.mean(core_scores)
        else:
            raise ValueError(f"Unsupported criterion: {criterion}")

    for metric in metrics:
        plt.figure(figsize=(12, 12))
        ax = plt.gca()
        ax.set_frame_on(False)
        ax.set_xticks([])
        ax.set_yticks([])

        nbre_improvements, nbre_degradations, nbre_no_change = 0, 0, 0
        table_data = []
        cell_colors = []

        for key in sorted_keys:
            core_scores = [core_data[key].get(metric, 0.0) or 0.0 for core_data in core_data_list]
            core_evaluated_score = evaluate_criteria(core_scores, evaluated_criteria)
            new_scores = [new_data[key].get(metric, 0.0) or 0.0 for new_data in new_data_list]
            new_evaluated_score = evaluate_criteria(new_scores, evaluated_criteria)

            if new_evaluated_score < core_evaluated_score:
                color = 'red'
                nbre_degradations += 1
            elif new_evaluated_score > core_evaluated_score:
                color = 'green'
                nbre_improvements += 1
            else:
                color = 'blue'
                nbre_no_change += 1

            table_data.append(f"{key}\n{new_evaluated_score:.3f}")
            cell_colors.append(color)

        num_rows = (len(sorted_keys) + max_columns - 1) // max_columns
        table_matrix = np.empty((num_rows, max_columns), dtype=object)
        color_matrix = np.empty((num_rows, max_columns), dtype=object)
        table_matrix.fill("")
        color_matrix.fill("white")

        for i, (value, color) in enumerate(zip(table_data, cell_colors)):
            row, col = divmod(i, max_columns)
            table_matrix[row, col] = value
            color_matrix[row, col] = color

        table = tbl.Table(ax, bbox=[0, 0, 1, 1])
        cell_width = 1.0 / max_columns
        cell_height = 1.0 / num_rows

        for row in range(num_rows):
            for col in range(max_columns):
                text = table_matrix[row, col]
                table.add_cell(row, col, cell_width, cell_height, text=text, facecolor=color_matrix[row, col], edgecolor='black', loc='center')

        ax.add_table(table)
        worse_patch = mpatches.Patch(color='red', label=f'Worse ({nbre_degradations})')
        better_patch = mpatches.Patch(color='green', label=f'Better ({nbre_improvements})')
        same_patch = mpatches.Patch(color='blue', label=f'No Change ({nbre_no_change})')
        plt.legend(handles=[worse_patch, better_patch, same_patch], loc='upper center', bbox_to_anchor=(0.5, -0.1), ncol=3)
        plt.title(f"Comparison to previous system of {metric} scores using {evaluated_criteria} criteria")
        pp.savefig()
        if show:
            plt.show()
        plt.close()

def generate_score_comparison_matrices_to_treshold(new_files: list[str], evaluated_criteria: str, max_columns=None):
    metrics = ["Precision", "Recall", "F1Score"]
    new_data_list = [load_and_filter_data(new_file, {}) for new_file in new_files]
    common_keys = set(new_data_list[0].keys())
    for new_data in new_data_list[1:]:
        common_keys.intersection_update(new_data.keys())

    if not common_keys:
        print("No common keys found across datasets. Exiting.")
        return

    try:
        sorted_keys = sorted(common_keys, key=int)
    except ValueError:
        print("Warning: Some keys are not numeric. Sorting lexicographically instead.")
        sorted_keys = sorted(common_keys)

    # if their isn't a max column number, we want as many columns as rows
    if max_columns == None:
        #so we use the rounded square root of the number of keys
        max_columns = int(np.ceil(np.sqrt(len(sorted_keys))))

    def evaluate_criteria(core_scores, criterion):
        if criterion == "min":
            return min(core_scores)
        elif criterion == "max":
            return max(core_scores)
        elif criterion == "mean":
            return np.mean(core_scores)
        else:
            raise ValueError(f"Unsupported criterion: {criterion}")

    for metric in metrics:
        plt.figure(figsize=(12, 12))
        ax = plt.gca()
        ax.set_frame_on(False)
        ax.set_xticks([])
        ax.set_yticks([])

        nbre_improvements, nbre_degradations, nbre_no_change = 0, 0, 0
        table_data = []
        cell_colors = []

        for key in sorted_keys:
            new_scores = [new_data[key].get(metric, 0.0) or 0.0 for new_data in new_data_list]
            new_evaluated_score = evaluate_criteria(new_scores, evaluated_criteria)

            if new_evaluated_score == 1:
                color = 'green'
                nbre_improvements += 1
            elif new_evaluated_score > 0:
                color = 'blue'
                nbre_no_change += 1
            else: 
                color = 'red'
                nbre_degradations += 1

            table_data.append(f"{key}\n{new_evaluated_score:.3f}")
            cell_colors.append(color)

        num_rows = (len(sorted_keys) + max_columns - 1) // max_columns
        table_matrix = np.empty((num_rows, max_columns), dtype=object)
        color_matrix = np.empty((num_rows, max_columns), dtype=object)
        table_matrix.fill("")
        color_matrix.fill("white")

        for i, (value, color) in enumerate(zip(table_data, cell_colors)):
            row, col = divmod(i, max_columns)
            table_matrix[row, col] = value
            color_matrix[row, col] = color

        table = tbl.Table(ax, bbox=[0, 0, 1, 1])
        cell_width = 1.0 / max_columns
        cell_height = 1.0 / num_rows

        for row in range(num_rows):
            for col in range(max_columns):
                text = table_matrix[row, col]
                table.add_cell(row, col, cell_width, cell_height, text=text, facecolor=color_matrix[row, col], edgecolor='black', loc='center')

        ax.add_table(table)
        worse_patch = mpatches.Patch(color='red', label=f'==0: ({nbre_degradations})')
        better_patch = mpatches.Patch(color='green', label=f'==1: ({nbre_improvements})')
        same_patch = mpatches.Patch(color='blue', label=f'>0: ({nbre_no_change})')
        plt.legend(handles=[worse_patch,same_patch,better_patch], loc='upper center', bbox_to_anchor=(0.5, -0.1), ncol=3)
        plt.title(f"{metric} scores using {evaluated_criteria} criteria")
        pp.savefig()
        if show:
            plt.show()
        plt.close()


def plot_hist_scores_per_thresholds(filtered_data, thresholds: list = [0, 0.25, 0.5, 0.75, 1]):
    """
    Plot the histogram of the scores (precision, recall, f1) per thresholds and save to a PDF file.
    
    Parameters:
    - filtered_data: Data from which precision, recall, and f1 scores will be extracted.
    - thresholds: List of thresholds to group the data.
    """
    # Extract the precision, recall, and f1 scores from the filtered data
    precisions, recalls, f1_scores = extract_scores(filtered_data)
    
    # For each metric (precision, recall, f1), create a single plot
    for metric_name, scores in [("Precision", precisions), ("Recall", recalls), ("F1 Score", f1_scores)]:
        # Count how many values fall within each threshold range
        counts = []
        sum_previous_counts = 0
        for i in range(len(thresholds)):
            count = sum(score <= thresholds[i] for score in scores)
            counts.append(count - sum_previous_counts)
            sum_previous_counts = count
        
        # Plot the histogram for the current metric
        plt.figure()
        plt.bar(range(len(counts)), counts, color='skyblue', edgecolor='black')
        plt.xticks(range(len(thresholds)), [f"<={threshold}" for threshold in thresholds])
        plt.xlabel("Threshold Range")
        plt.ylabel("Count")
        plt.title(f"Histogram of {metric_name}s per Threshold")
        plt.grid(True)
        pp.savefig()  # Save the plot to the PDF
        if show:
            plt.show()  # Show the plot if 'show' is True
        plt.close()


def plot_tree(data, title="Tree Representation"):
    """
    Plots a tree from a nested dictionary structure.

    Parameters:
        data (dict): The hierarchical dictionary containing 'count' and 'children'.
        title (str): The title of the plot.
    """
    def add_nodes_edges(graph, parent, node_data):
        """ Recursively add nodes and edges to the graph. """
        if isinstance(node_data, dict) and 'count' in node_data:
            node_label = f"{parent}\n({node_data['count']})"  # Label with count
            graph.add_node(node_label)  # Add node

            for child_name, child_data in node_data['children'].items():
                child_label = f"{child_name}\n({child_data['count']})"
                graph.add_edge(node_label, child_label)  # Add edge
                add_nodes_edges(graph, child_name, child_data)  # Recursive call

            # add secondary links to sub-children
            for child_name in node_data.get("sub_children_names", []):
                # Find the node containing the child name as its label
                child_node = next((node for node in graph.nodes if child_name in node), None)
                if child_node:
                    graph.add_edge(node_label, child_node)

    # Create the graph
    G = nx.DiGraph()
    for root, root_data in data.items():
        add_nodes_edges(G, root, root_data)

    # Draw the graph
    plt.figure(figsize=(12, 8))
    try:
        pos = nx.nx_agraph.graphviz_layout(G, prog="dot")  # Tree layout (requires pygraphviz)
    except:
        pos = nx.spring_layout(G, seed=42)  # Alternative if pygraphviz is not installed

    nx.draw(G, pos, with_labels=True, node_size=2000, node_color="lightblue", edge_color="gray", font_size=10)
    plt.title(title)
    pp.savefig()
    if show:
        plt.show()
    plt.close()

def plot_table(table_headers, table_data, all_data, table_name):
    """
    Plots a table with the given headers and data.
    """
    fig, ax = plt.subplots()  # Adjust figure size
    ax.axis("off")  # Hide axes
    for i in range(len(table_data)):
        percentage = round(table_data[i][0] / len(all_data) * 100, 2)
        table_data[i].append(percentage)

    ax.table(cellText=table_data, colLabels=["Number of","%"], rowLabels=table_headers, bbox=[0.6, 0, 0.5, 1], cellLoc="center", colWidths=[1/4, 1/4])
    ax.set_title(f"Table of {table_name}")
    pp.savefig()
    if show:
        plt.show()
    plt.close()

def compute_confusion_matrix_bool(filtered_data):
    """
    Compute the confusion matrix of the system relative to the boolean results of the benchmark
    """
    TP, FP, TN, FN, Invalid_not_true, Invalid_not_false = 0, 0, 0, 0, 0, 0
    for entry in filtered_data.values():
        system_result = entry.get("SystemResult")
        benchmark_result = entry.get("BenchmarkResult")

        if isinstance(benchmark_result, bool):
            if not isinstance(system_result, bool) and benchmark_result is True:
                Invalid_not_true += 1
            elif not isinstance(system_result, bool) and benchmark_result is False:
                Invalid_not_false += 1
            elif system_result is True and benchmark_result is True:
                TP += 1
            elif system_result is True and benchmark_result is False:
                FP += 1
            elif system_result is False and benchmark_result is False:
                TN += 1
            elif system_result is False and benchmark_result is True:
                FN += 1
    return {"TP": TP, "FP": FP, "TN": TN, "FN": FN, "Invalid_not_true": Invalid_not_true, "Invalid_not_false": Invalid_not_false}

def plot_confusion_matrix_bool(filtered_data):
    matrix_data = compute_confusion_matrix_bool(filtered_data)
        # Create confusion matrix including Invalid count
    matrix = np.array(
        [
            [ matrix_data["TP"], matrix_data["FN"],  matrix_data["Invalid_not_true"]],
            [ matrix_data["FP"], matrix_data["TN"], matrix_data["Invalid_not_false"]]
        ]
    )

    # Plotting
    plt.figure(figsize=(6, 4))
    sns.heatmap(matrix, annot=True, fmt="d", cmap="Blues", xticklabels=["True","False", "Other"], yticklabels=["True","False"], cbar=False)
    plt.title("Confusion Matrix for boolean results")
    plt.ylabel("Benchmark Class")
    plt.xlabel("Predicted Class")
    pp.savefig()
    if show:
        plt.show()
    plt.close()

def boolean_prediction_fiability(file_name: str, all_data: dict):
    # Test the boolean expected fiability
    constraints_verifier_tp = { # True positive
        "BenchmarkResult": lambda x : x in [True, False],
        "Reasoning": lambda x: x is not None and "<answer>boolean</answer>" in x
    }
    constraints_verifier_fp = { # False positive
        "BenchmarkResult": lambda x : x not in [True, False],
        "Reasoning": lambda x: x is not None and "<answer>boolean</answer>" in x
    }
    constraints_verifier_fn = { # False negative
        "BenchmarkResult": lambda x : x in [True, False],
        "Reasoning": lambda x: x is not None and "<answer>non-boolean</answer>" in x
    }
    constraints_verifier_tn = { # True negative
        "BenchmarkResult": lambda x : x not in [True, False],
        "Reasoning": lambda x: x is not None and "<answer>non-boolean</answer>" in x
    }
    constraint_verifier_failed = { # Failed
        "Reasoning": lambda x: "<answer>boolean</answer>" not in x and "<answer>non-boolean</answer>" not in x
    }
    #make table with all the data
    table_headers_verifier = []
    table_data_verifier = []
    table_headers_verifier.append("True positive")
    filtered_verifier_tp_data = load_and_filter_data(file_name, constraints_verifier_tp)
    table_data_verifier.append([len(filtered_verifier_tp_data)])
    table_headers_verifier.append("False positive")
    filtered_verifier_fp_data = load_and_filter_data(file_name, constraints_verifier_fp)
    table_data_verifier.append([len(filtered_verifier_fp_data)])
    table_headers_verifier.append("False negative")
    filtered_verifier_fn_data = load_and_filter_data(file_name, constraints_verifier_fn)
    table_data_verifier.append([len(filtered_verifier_fn_data)])
    table_headers_verifier.append("True negative")
    filtered_verifier_tn_data = load_and_filter_data(file_name, constraints_verifier_tn)
    table_data_verifier.append([len(filtered_verifier_tn_data)])
    table_headers_verifier.append("Failed")
    filtered_verifier_failed_data = load_and_filter_data(file_name, constraint_verifier_failed)
    table_data_verifier.append([len(filtered_verifier_failed_data)])
    plot_table(table_headers_verifier, table_data_verifier, all_data, "Boolean type prediction fiability")

def question_word_ranking(filtered_data, filtered_data_malus, title_complement=""):
    """
    Parse all the questions and count the number of times each word appears.
    """
    word_count = defaultdict(int)
    for entry in filtered_data.values():
        question = entry.get("Question")
        if question:
            # Split the question into words and count them
            words = re.findall(r'\w+', question.lower())
            for word in words:
                word_count[word] += 1

    # Apply malus for words appearing in filtered_data_malus
    for entry in filtered_data_malus.values():
        question = entry.get("Question")
        if question:
            words = re.findall(r'\w+', question.lower())
            for word in words:
                word_count[word] -= 1  # Subtract malus for each occurrence

    # Sort the words by their counts in descending order
    sorted_word_count = sorted(word_count.items(), key=lambda x: x[1], reverse=True)

    # Make a histogram of the word count, ordered by the number of times they appear
    if sorted_word_count:
        words, counts = zip(*sorted_word_count)
    else:
        words, counts = [], []  # Assign empty lists if there's nothing to unpack

    plt.figure(figsize=(12, 6))
    plt.bar(words[:20], counts[:20], color='skyblue', edgecolor='black')
    plt.xticks(rotation=45, ha="right", fontsize=10)  # Rotate x-axis labels
    plt.xlabel("Words")
    plt.ylabel("Count")
    plt.title("Top 20 Words in Questions for " + title_complement)

    plt.grid()
    pp.savefig()
    if show:
        plt.show()
    plt.close()
    

def all_prints(files_names: list[str], core_files_names: list[str]):
    # Data to be displayed in a table
    table_headers = []
    table_data = []
    tree_data = {}

    # First input file, used for figures necessitating only one file
    file_name = files_names[0]

    # All data
    table_headers.append("Question Count")
    all_data = load_and_filter_data(file_name, {})
    table_data.append([len(all_data)])
    tree_data["All questions"] = {"count": len(all_data), "children": {}}

    # Unvalid data
    # constraints_invalid = {
    #     "BenchmarkResult": lambda x : x is None or x == []
    # }
    # filtered_invalid_data = load_and_filter_data(file_name, constraints_invalid)
    # table_headers.append("Empty BenchmarkResult")
    # table_data.append([len(filtered_invalid_data)])
        
    # Valid benchmark results
    constraints_valid_benchmark = {
        "BenchmarkResult": lambda x : x not in [None, []]
    }   
    filtered_valid_data = load_and_filter_data(file_name, constraints_valid_benchmark)
    table_headers.append("Valid benchmark results")
    table_data.append([len(filtered_valid_data)])


    precisions, recalls, f1_scores = extract_scores(filtered_valid_data)
    precision_recall_f1_plot(precisions, recalls, f1_scores)
    #plot_scores_relative_to_core_responses_multiple_criteria(core_files_names, files_names, "max")
    #plot_scores_relative_to_core_responses_multiple_criteria(core_files_names, files_names, "mean")
    #plot_scores_relative_to_core_responses_multiple_criteria(core_files_names, files_names, "min")
    generate_score_comparison_matrices_to_core(core_files_names, files_names, "max")
    generate_score_comparison_matrices_to_core(core_files_names, files_names, "mean")
    generate_score_comparison_matrices_to_core(core_files_names, files_names, "min")

    generate_score_comparison_matrices_to_treshold(files_names, "max")

    # plot_scores_relative_to_core_responses(core_files_names, file_name)
    # plot_comparison_to_core_good_responses(core_files_names, file_name, exclusive_core=True)
    plot_hist_scores_per_thresholds(filtered_valid_data)
    boxplot_scores(precisions, recalls, f1_scores, "valid benchmark results")

    precisions, recalls, f1_scores = extract_scores(filtered_valid_data)
    plot_box_system_time(filtered_valid_data)

    plot_confusion_matrix_bool(filtered_valid_data)

    # Commands
    commands_list = get_commands_list(filtered_valid_data)
    generate_boxplot(commands_list, precisions, "Commands", "Precisions")
    generate_boxplot(commands_list, recalls, "Commands", "Recalls")
    generate_boxplot(commands_list, f1_scores, "Commands", "F1 Scores")

    # System errors
    system_errors = get_system_errors(filtered_valid_data)
    generate_boxplot(system_errors, precisions, "System Errors", "Precisions", label_rotation=10)
    generate_boxplot(system_errors, recalls, "System Errors", "Recalls", label_rotation=10)
    generate_boxplot(system_errors, f1_scores, "System Errors", "F1 Scores", label_rotation=10)

    matrix_command_error(commands_list, system_errors)

    non_done_step = find_first_non_done_step(filtered_valid_data)
    hist_first_non_done_step(non_done_step, "valid benchmark results")

    #Score at 0
    constraints_score_at_zero = {
        "F1Score": lambda x: x == 0
    }
    filtered_score_at_zero_data = load_and_filter_data(file_name, constraints_score_at_zero)
    tree_data["All questions"]["children"]["Score at 0"] = {"count": len(filtered_score_at_zero_data), "children": {}}

    # Empty SystemResult
    constraints_empty_system_result = {
        "SystemResult": lambda x: x == "" or x is None or x == []
    }
    filtered_empty_system_result_data = load_and_filter_data(file_name, constraints_empty_system_result)
    tree_data["All questions"]["children"]["Score at 0"]["children"]["Empty SystemResult"] = {"count": len(filtered_empty_system_result_data), "children": {}}

    non_done_step = find_first_non_done_step(filtered_empty_system_result_data)
    hist_first_non_done_step(non_done_step, "Empty SystemResult")

    # Empty reasoning traces
    constraints_empty_reasoning = {
        "Reasoning": lambda x: x == ""
    }
    filtered_empty_reasoning_data = load_and_filter_data(file_name, constraints_empty_reasoning)
    tree_data["All questions"]["children"]["Score at 0"]["children"]["Empty system reasoning traces"] = {"count": len(filtered_empty_reasoning_data), "children": {}}

    # Non-empty response from the system
    filtered_non_empty_response = {
        "SystemResult" : lambda x: x not in [None, "", []],
    }
    filtered_non_empty_response_data = load_and_filter_data(file_name, filtered_non_empty_response)
    tree_data["All questions"]["children"]["Non-empty SystemResult"] = {"count": len(filtered_non_empty_response_data), "children": {}, "sub_children_names": {"Non-empty SystemResult\n(score at 0)"}}
    
    # Non-empty response from the system but with a score at  0
    filtered_non_empty_response_score_at_zero = {
        "SystemResult" : lambda x: x not in [None, "", []],
        "F1Score": lambda x: x == 0
    }
    filtered_non_empty_response_score_at_zero_data = load_and_filter_data(file_name, filtered_non_empty_response_score_at_zero)
    tree_data["All questions"]["children"]["Score at 0"]["children"]["Non-empty SystemResult\n(score at 0)"] = {"count": len(filtered_non_empty_response_score_at_zero_data), "children": {}}

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

    # Error: error while evaluating SPARQL query, for a non empty SystemQuery
    constraints_sparql_error = {
        "SystemQuery": lambda x: x not in [None, "", []],
        "Error": lambda x: x is not None and "error while evaluating SPARQL query" in x
    }
    filtered_sparql_error_but_not_empty_data = load_and_filter_data(file_name, constraints_sparql_error)
    tree_data["All questions"]["children"]["Error while evaluating non-empty SystemQuery"] = {"count": len(filtered_sparql_error_but_not_empty_data), "children": {}}

    #todo specific warnings (from alerts, etc.)

    #todo matrice etape premiere erreur / commande

    # Table 
    plot_table(table_headers, table_data, all_data, "global data")
    # Plot the tree
    plot_tree(tree_data)

    # Plot the confusion matrix of type predictions
    boolean_prediction_fiability(file_name, all_data)


    constraints_f1_at_0 = {
        "BenchmarkResult": lambda x : x not in [None, []],
        "F1Score": lambda x: x == 0
    }   
    filtered_f1_at_0 = load_and_filter_data(file_name, constraints_f1_at_0)
    constraints_f1_greater_than_0 = {
        "BenchmarkResult": lambda x : x not in [None, []],
        "F1Score": lambda x: x > 0
    }
    filtered_f1_greater_than_0 = load_and_filter_data(file_name, constraints_f1_greater_than_0)
    constraints_f1_at_1 = {
        "BenchmarkResult": lambda x : x not in [None, []],
        "F1Score": lambda x: x == 1
    }
    filtered_f1_at_1 = load_and_filter_data(file_name, constraints_f1_at_1)
    question_word_ranking(filtered_valid_data, {}, "valid benchmark data")
    question_word_ranking(filtered_f1_at_0, filtered_f1_at_1, "f1 score at 0 - f1 score at 1")
    


    pp.close() # Close the pdf file

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.realpath(__file__))
    core_files = [
        #script_dir + "/BestOutputs/QALD9/QALD-9-plus_sparklisllm-LLMFrameworkOneShot_20250326_102358.json",
        script_dir + "/BestOutputs/QALD9/QALD-9-plus_sparklisllm-LLMFrameworkOneShot_20250326_204637.json",
        script_dir + "/BestOutputs/QALD9/QALD-9-plus_sparklisllm-LLMFrameworkOneShot_20250331_014207.json",
        script_dir + "/BestOutputs/QALD9/QALD-9-plus_sparklisllm-LLMFrameworkOneShot_20250331_043712.json",
    ]

    input_files = [
        # script_dir + "/BestOutputs/QALD-10_sparklisllm_20250312_003603.json",
        script_dir + "/BestOutputs/QALD9/QALD-9-plus_sparklisllm-LLMFrameworkOneShotForward_20250328_184623.json",
    ]

    all_prints(input_files, core_files)