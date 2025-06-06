"""
Post-processing script for analyzing and visualizing the results of a benchmark.
Will generate various plot in a PDF file.
If show is set to True, the plots will also be displayed on the screen.
"""
from collections import defaultdict
import json
import logging
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.lines as mlines
import matplotlib.table as tbl
import matplotlib.patches as mpatches
from matplotlib.ticker import NullFormatter
import seaborn as sns
import networkx as nx
import numpy as np
import os
import re
import math

logging.basicConfig(
    level=logging.INFO, # NOTSET | DEBUG | INFO | WARNING | ERROR | CRITICAL
)

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
    "filter",
    "limit",
    "offset",
    "property",
    "groupBy"
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

    # Backup from error messages
    "trying to match the corresponding term instead",

    # Alert messages
    "The query was not understood by the SPARQL endpoint",
    "There was an error at the SPARQL endpoint",

    # System evaluation/test system error messages
    "Timeout",
    "Error: please try to intercept the error before.",
]
# List of recognizable errors for "Warning: Commands failed to finish"
cmd_error_messages = [
    "term not found",
    "fwd property not found",
    "bwd property not found",
    "class not found",
    "higherThan something that is not a number",
    "between something that is not a number",
    "lowerThan something that is not a number",
    "limit something that is not a number",
    "bus is not defined",
    "command:property",
    "command:limit",
    "command:offset",
    "command:a",
    "command:groupBy"
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
    if not show:
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
        if not show:
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
    if not show:
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
    if not show:
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

def moving_average(x, w):
    return [sum(x[i:i+w])/w for i in range(len(x)-w+1)]

def plot_score_relative_to_time(filtered_data, window_size=5):
    # Même regroupement que précédemment
    scores_by_time = {}
    for entry in filtered_data.values():
        time = entry.get("SystemTime")
        score = entry.get("F1Score")
        if time is not None and score is not None:
            scores_by_time.setdefault(time, []).append(score)

    times = sorted(scores_by_time)
    mean_scores = [sum(scores_by_time[t])/len(scores_by_time[t]) for t in times]

    # Calculer moyenne glissante sur mean_scores
    if len(mean_scores) < window_size:
        window_size = len(mean_scores)

    smooth_scores = moving_average(mean_scores, window_size)
    smooth_times = times[(window_size-1)//2:-(window_size//2)]  # ajustement indices

    # Tracer
    plt.figure(figsize=(10, 5))
    plt.plot(times, mean_scores, 'o-', alpha=0.3, label='Moyenne brute')
    plt.plot(smooth_times, smooth_scores, 'r-', label=f'Moyenne glissante (w={window_size})')
    plt.xlabel("Temps")
    plt.ylabel("Score F1")
    plt.legend()
    plt.grid(True)
    if not show:
        plt.title("Evolution du score F1 avec moyenne glissante")
    pp.savefig()
    if show:
        plt.show()


def plot_cumulative_score_relative_to_time(filtered_data):
    nb_scores = len(filtered_data)
    scores_by_time = {}
    for entry in filtered_data.values():
        time = entry.get("SystemTime")
        score = entry.get("F1Score")
        if time is not None and score is not None:
            scores_by_time.setdefault(time, []).append(score)

    times = sorted(scores_by_time)

    cumulative_scores = []
    cum_sum = 0

    for t in times:
        scores = scores_by_time[t]
        cum_sum += sum(scores)
        avg = (cum_sum / nb_scores)
        cumulative_scores.append(avg)

    figure_font_size = 15

    # Tracé
    plt.figure(figsize=(12, 6))
    plt.plot(times, cumulative_scores, 'b-', label='Score F1 moyen (progressif)')
    plt.xlabel("Temps", fontsize=figure_font_size)
    plt.ylabel("Score F1 moyen", fontsize=figure_font_size)

    # Log scale
    plt.yscale('log')
    ax = plt.gca()
    ax.yaxis.set_major_formatter(NullFormatter())
    ax.yaxis.set_minor_formatter(NullFormatter())

    # Ajout manuel de ticks + labels à des valeurs spécifiques
    yticks = np.array([0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 1.0])
    yticks = yticks[yticks > min(cumulative_scores)]
    ax.set_yticks(yticks)
    ax.set_yticklabels([f"{y:.2f}" for y in yticks])
    # taille des ticks
    plt.tick_params(axis='y', which='major', labelsize=figure_font_size)
    plt.tick_params(axis='x', which='major', labelsize=figure_font_size)

    # Grille + légende
    ax.grid(True, which='both', linestyle='--', linewidth=0.5)
    plt.legend(fontsize=14)
    plt.tight_layout()
    if not show:
        plt.title("Évolution du score F1 moyen avec échelle verticale compressée", fontsize=18)
    pp.savefig()
    if show:
        plt.show()


def plot_box_system_time(filtered_data):
    """
    Plot the boxplot of the SystemTime.
    """
    figure_font_size = 15
    system_times = [entry.get("SystemTime") for entry in filtered_data.values()]
    plt.figure()
    plt.boxplot(system_times)
    plt.ylabel("System Time (seconds)", fontsize=figure_font_size)

    # logarithmic scale for better visibility
    plt.yscale('log')
    ax = plt.gca()

    #remove the y-axis ticks
    ax.yaxis.set_major_formatter(NullFormatter())
    ax.yaxis.set_minor_formatter(NullFormatter())
    ax.tick_params(axis='y', which='both', length=0)  # Cacher les traits de ticks
    # Add 6 ticks logarithmically spread between the 0 and the max value
    print("System times:", system_times)
    max_time = max(system_times) if system_times else 1
    min_time = min(system_times) if system_times else 0.1
    print("Max system time:", max_time)
    yticks = np.logspace(np.log10(min_time), np.log10(max_time), num=6)
    ax.set_yticks(yticks)
    ax.set_yticklabels([f"{y:.0f}" for y in yticks])

    plt.tick_params(axis='y', which='major', labelsize=figure_font_size)

    plt.tight_layout()
    if not show:
        plt.title("Boxplot of the system's response time")
    #hide x-axis ticks
    plt.xticks([])
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
    if not show:
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

def evaluate_criteria(scores, criterion):
    if not scores:
        return 0.0
    if criterion == "min":
        return min(scores)
    elif criterion == "max":
        return max(scores)
    elif criterion == "mean":
        return np.mean(scores)
    else:
        raise ValueError(f"Unsupported criterion: {criterion}")
        
def generate_score_comparison_matrices_to_core(core_files: list[str], new_files: list[str], evaluated_criteria: str, max_columns=None):
    if not core_files:
        print("No core to compare to.")
        return

    metrics = ["Precision", "Recall", "F1Score"]
    core_data_list = [load_and_filter_data(core_file, {}) for core_file in core_files]
    new_data_list = [load_and_filter_data(new_file, {}) for new_file in new_files]

    # Collect all possible keys to determine the full question range
    all_keys = set()
    for data in core_data_list + new_data_list:
        all_keys.update(data.keys())

    try:
        sorted_all_keys = sorted(all_keys, key=int)
        min_key, max_key = int(sorted_all_keys[0]), int(sorted_all_keys[-1])
        full_key_range = list(map(str, range(min_key, max_key + 1)))
    except ValueError:
        print("Warning: Some keys are not numeric. Sorting lexicographically instead.")
        full_key_range = sorted(all_keys)

    if max_columns is None:
        max_columns = int(np.ceil(np.sqrt(len(full_key_range))) * 1.5)
    num_rows = (len(full_key_range) + max_columns - 1) // max_columns

    cell_size = 0.8
    fig_width = max_columns * cell_size
    fig_height = num_rows * cell_size
    for metric in metrics:
        plt.figure(figsize=(fig_width, fig_height))

        ax = plt.gca()
        ax.set_frame_on(False)
        ax.set_xticks([])
        ax.set_yticks([])

        nbre_improvements = nbre_degradations = nbre_no_change = 0
        table_data = []
        cell_colors = []

        for key in full_key_range:
            # Handle keys possibly not in datasets
            core_scores = [
                core_data.get(key, {}).get(metric, None)
                for core_data in core_data_list
                if key in core_data and core_data.get(key, {}).get(metric, None) is not None
            ]
            new_scores = [
                new_data.get(key, {}).get(metric, None) 
                for new_data in new_data_list 
                if key in new_data and new_data.get(key, {}).get(metric, None) is not None
            ]
            if core_scores and new_scores:
                core_score = evaluate_criteria(core_scores, evaluated_criteria)
                new_score = evaluate_criteria(new_scores, evaluated_criteria)

                if new_score < core_score:
                    color = 'lightcoral'
                    nbre_degradations += 1
                elif new_score > core_score:
                    color = 'springgreen'
                    nbre_improvements += 1
                else:
                    color = 'lightblue'
                    nbre_no_change += 1

                text = f"{key}\n{new_score:.2f}"
            else:
                color = 'white'
                text = f"{key}"

            table_data.append(text)
            cell_colors.append(color)

        table_matrix = np.full((num_rows, max_columns), "", dtype=object)
        color_matrix = np.full((num_rows, max_columns), "white", dtype=object)

        for i, (value, color) in enumerate(zip(table_data, cell_colors)):
            row, col = divmod(i, max_columns)
            table_matrix[row, col] = value
            color_matrix[row, col] = color

        table = tbl.Table(ax, bbox=[0, 0, 1, 1])
        cell_width = 1.0 / max_columns
        cell_height = 1.0 / num_rows

        for row in range(num_rows):
            for col in range(max_columns):
                cell = table.add_cell(row, col, cell_width, cell_height,
                               text=table_matrix[row, col],
                               facecolor=color_matrix[row, col],
                               edgecolor='black', loc='center')

        ax.add_table(table)
        worse_patch = mpatches.Patch(color='lightcoral', label=f'Worse ({nbre_degradations})')
        better_patch = mpatches.Patch(color='springgreen', label=f'Better ({nbre_improvements})')
        same_patch = mpatches.Patch(color='lightblue', label=f'No Change ({nbre_no_change})')
        plt.legend(handles=[worse_patch, better_patch, same_patch], loc='upper center', bbox_to_anchor=(0.5, 0.0), ncol=3)
        if not show:
            plt.title(f"Comparison to previous system of {metric} using '{evaluated_criteria}' criterion")
        pp.savefig()
        if show:
            #force the cases to be square
            #ax.set_aspect('equal', adjustable='box')
            plt.show()
        plt.close()

def generate_score_comparison_matrices_to_treshold(new_files: list[str], evaluated_criteria: str, max_columns=None):
    metrics = ["Precision", "Recall", "F1Score"]
    new_data_list = [load_and_filter_data(new_file, {}) for new_file in new_files]

    # Collect all possible keys to determine the full question range
    all_keys = set()
    for data in new_data_list:
        all_keys.update(data.keys())

    try:
        sorted_all_keys = sorted(all_keys, key=int)
        min_key, max_key = int(sorted_all_keys[0]), int(sorted_all_keys[-1])
        full_key_range = list(map(str, range(min_key, max_key + 1)))
    except ValueError:
        print("Warning: Some keys are not numeric. Sorting lexicographically instead.")
        full_key_range = sorted(all_keys)

    if max_columns is None:
        max_columns = int(np.ceil(np.sqrt(len(full_key_range))) * 1.5)


    cell_size = 0.8  # Try values between 0.6 and 1.2 depending on density
    fig_width = max_columns * cell_size
    fig_height = ((len(full_key_range) + max_columns - 1) // max_columns) * cell_size
    for metric in metrics:
        plt.figure(figsize=(fig_width, fig_height))
        ax = plt.gca()
        ax.set_frame_on(False)
        ax.set_xticks([])
        ax.set_yticks([])

        nbre_improvements = nbre_degradations = nbre_no_change = 0
        table_data = []
        cell_colors = []

        for key in full_key_range:
            # Handle keys possibly not in datasets
            new_scores = [
                new_data.get(key, {}).get(metric, None) 
                for new_data in new_data_list 
                if key in new_data and new_data.get(key, {}).get(metric, None) is not None
            ]

            if new_scores:
                new_score = evaluate_criteria(new_scores, evaluated_criteria)

                if new_score == 1:
                    color = 'springgreen'
                    nbre_improvements += 1
                elif new_score > 0:
                    color = 'lightblue'
                    nbre_no_change += 1
                else: 
                    color = 'lightcoral'
                    nbre_degradations += 1

                text = f"{key}\n{new_score:.2f}"
            else:
                color = 'white'
                text = f"{key}"

            table_data.append(text)
            cell_colors.append(color)

        num_rows = (len(full_key_range) + max_columns - 1) // max_columns
        table_matrix = np.full((num_rows, max_columns), "", dtype=object)
        color_matrix = np.full((num_rows, max_columns), "white", dtype=object)

        for i, (value, color) in enumerate(zip(table_data, cell_colors)):
            row, col = divmod(i, max_columns)
            table_matrix[row, col] = value
            color_matrix[row, col] = color

        table = tbl.Table(ax, bbox=[0, 0, 1, 1])
        cell_width = 1.0 / max_columns
        cell_height = 1.0 / max_columns

        for row in range(num_rows):
            for col in range(max_columns):
                table.add_cell(row, col, cell_width, cell_height,
                               text=table_matrix[row, col],
                               facecolor=color_matrix[row, col],
                               edgecolor='black', loc='center')

        ax.add_table(table)
        worse_patch = mpatches.Patch(color='lightcoral', label=f'x==0: ({nbre_degradations})')
        better_patch = mpatches.Patch(color='springgreen', label=f'x==1: ({nbre_improvements})')
        same_patch = mpatches.Patch(color='lightblue', label=f'0<x<1: ({nbre_no_change})')
        plt.legend(handles=[worse_patch, better_patch, same_patch], loc='upper center', bbox_to_anchor=(0.5, 0.0), ncol=3)
        if not show:
            plt.title(f"{metric} scores using {evaluated_criteria} criteria")
        pp.savefig()
        if show:
            #force the cases to be square
            #ax.set_aspect('equal', adjustable='box')
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
        if not show:
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
    if not show:
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
    if not show:
        plt.title("Confusion Matrix for boolean results")
    plt.ylabel("Benchmark Class")
    plt.xlabel("Predicted Class")
    pp.savefig()
    if show:
        plt.show()
    plt.close()

def boolean_prediction_fiability(file_name: str, all_data: dict):
    """
    When the LLM predict if the expected answer to the question is boolean or not, we want to check how reliable it is.
    """
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


def boolean_prediction_fiability_confusion_matrix_with_variability(file_names: list[str], all_data: dict):
    """
    When the LLM predict if the expected answer to the question is boolean or not, we want to check how reliable it is.
    We want a confusion matrix but with the variability of the results (Mean ± std).

    """
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
    constraint_verifier_failed_p = { # Failed
        "BenchmarkResult": lambda x: x in [True, False],
        "Reasoning": lambda x: "<answer>boolean</answer>" not in x and "<answer>non-boolean</answer>" not in x
    }
    constraint_verifier_failed_n = { # Failed
        "BenchmarkResult": lambda x: x not in [True, False],
        "Reasoning": lambda x: "<answer>boolean</answer>" not in x and "<answer>non-boolean</answer>" not in x
    }

    #We need to get the mean and standard deviation for TP, FP, TN, FN
    # Create a dictionary to store the counts for each file
    counts = {
        "TP": [],
        "FP": [],
        "TN": [],
        "FN": [],
        "FailedP": [],
        "FailedN": []
    }
    for file_name in file_names:
        # Load the data
        filtered_verifier_tp_data = load_and_filter_data(file_name, constraints_verifier_tp)
        filtered_verifier_fp_data = load_and_filter_data(file_name, constraints_verifier_fp)
        filtered_verifier_fn_data = load_and_filter_data(file_name, constraints_verifier_fn)
        filtered_verifier_tn_data = load_and_filter_data(file_name, constraints_verifier_tn)
        filtered_verifier_failed_p_data = load_and_filter_data(file_name, constraint_verifier_failed_p)
        filtered_verifier_failed_n_data = load_and_filter_data(file_name, constraint_verifier_failed_n)

        # Append the counts to the list
        counts["TP"].append(len(filtered_verifier_tp_data)/len(all_data)*100)
        counts["FP"].append(len(filtered_verifier_fp_data)/len(all_data)*100)
        counts["TN"].append(len(filtered_verifier_tn_data)/len(all_data)*100)
        counts["FN"].append(len(filtered_verifier_fn_data)/len(all_data)*100)
        counts["FailedP"].append(len(filtered_verifier_failed_p_data)/len(all_data)*100)
        counts["FailedN"].append(len(filtered_verifier_failed_n_data)/len(all_data)*100)

    # Now we can calculate the mean and standard deviation for each count
    means = {key: np.mean(value) for key, value in counts.items()}
    stds = {key: np.std(value) for key, value in counts.items()}
    # Create the confusion matrix
    matrix = np.array(
        [
            [means["TP"], means["FN"], means["FailedP"]],
            [means["FP"], means["TN"], means["FailedN"]]
        ]
    )
    # Create the standard deviation matrix
    std_matrix = np.array(
        [
            [stds["TP"], stds["FN"], stds["FailedP"]],
            [stds["FP"], stds["TN"], stds["FailedN"]]
        ]
    )
    # Plotting
    plt.figure(figsize=(6, 4))
    sns.heatmap(matrix, annot=True, fmt=".2f", cmap="Blues", xticklabels=["Boolean","Non-Boolean", "Other"], yticklabels=["Boolean","Non-Boolean"], cbar=False)
    if not show:
        plt.title("Confusion Matrix for Boolean type prediction fiability")
    plt.ylabel("Benchmark Class")
    plt.xlabel("Predicted Class")
    # Add the standard deviation as text
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            plt.text(j + 0.5, i + 0.7, f"±{std_matrix[i, j]:.2f}", ha="center", va="center", color="black")
    pp.savefig()
    if show:
        plt.show()
    plt.close()

def question_word_ranking(filtered_valid_data, number_of_words=25):
    """
    Extracts the most frequent words from the questions in the filtered data.
    """
    word_count = defaultdict(int)

    for entry in filtered_valid_data.values():
        question = entry.get("Question")
        if question:
            words = re.findall(r'\w+', question.lower())
            for word in words:
                word_count[word] += 1

    # Sort by frequency (descending)
    sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)

    words, counts = zip(*sorted_words[:number_of_words])

    fig_font_size = 14
    plt.figure(figsize=(12, 6))
    plt.bar(words, counts, color='skyblue', edgecolor='black')
    plt.xticks(rotation=45, ha="right", fontsize=fig_font_size)
    plt.yticks(fontsize=fig_font_size)
    plt.xlabel("Words", fontsize=fig_font_size)
    plt.ylabel("Frequency", fontsize=fig_font_size)
    if not show:
        plt.title('Top {number_of_words} most frequent words in questions')

    plt.grid()
    pp.savefig()
    if show:
        plt.show()
    plt.close()

def question_word_ratio_ranking(filtered_data_0, filtered_data_1, title_complement="", number_of_words=25):
    word_count_0 = defaultdict(int)
    word_count_1 = defaultdict(int)


    smoothing = 10  # Smoothing factor to avoid division by zero and diminish the impact of small counts

    for entry in filtered_data_0.values():
        question = entry.get("Question")
        if question:
            words = re.findall(r'\w+', question.lower())
            for word in words:
                word_count_0[word] += 1

    for entry in filtered_data_1.values():
        question = entry.get("Question")
        if question:
            words = re.findall(r'\w+', question.lower())
            for word in words:
                word_count_1[word] += 1

    all_words = set(word_count_0.keys()) | set(word_count_1.keys())
    word_ratios = {}

    for word in all_words:
        count_0 = word_count_0.get(word, 0)
        count_1 = word_count_1.get(word, 0)
        # Smooth with +1
        ratio = (count_0 + smoothing) / (count_1 + smoothing)
        word_ratios[word] = ratio

    # Sort by ratio (descending = more prominent in data_0)
    sorted_ratios = sorted(word_ratios.items(), key=lambda x: x[1], reverse=True)

    words, ratios = zip(*sorted_ratios[:number_of_words])

    fig_font_size = 14
    plt.figure(figsize=(12, 6))

    # plot a line for the global ratio
    global_ratio = (len(filtered_data_0.values()) + smoothing) / (len(filtered_data_1.values()) + smoothing)
    plt.axhline(y=global_ratio, color='gray', linestyle='--', label='Global Ratio') 

    colors = ['springgreen' if r <= 1 else 'lightcoral' for r in ratios]
    plt.bar(words, ratios, color=colors, edgecolor='black')
    plt.xticks(rotation=45, ha="right", fontsize=fig_font_size)
    plt.yticks(fontsize=fig_font_size)
    plt.xlabel("Words", fontsize=fig_font_size)
    plt.ylabel("Frequency Ratio (+"+str(smoothing)+" smoothing)", fontsize=fig_font_size)
    if not show:
        plt.title(f'Top {number_of_words} worst words by ratio - {title_complement}')

    plt.grid()
    pp.savefig()
    if show:
        plt.show()
    plt.close()


def get_all_question_tags(filtered_data) -> set:
    """
    Extracts all question tags from the filtered data entries.
    Set of the concatenation of the lists of tags (field tags).
    """
    all_tags = set()
    for entry in filtered_data.values():
        tags = entry.get("Tags")
        if tags:
            for tag in tags:
                all_tags.add(tag)
    return all_tags
    


def question_tags_pp(filtered_data, file_name,number_of_tags=25):
    # Get data
    all_tags = get_all_question_tags(filtered_data)

    constraints_f1_at_1 = {
        "BenchmarkResult": lambda x : x not in [None, []],
        "F1Score": lambda x: x == 1
    }
    filtered_f1_at_1 = load_and_filter_data(file_name, constraints_f1_at_1)
    constraints_f1_at_0 = {
        "BenchmarkResult": lambda x : x not in [None, []],
        "F1Score": lambda x: x == 0
    }
    filtered_f1_at_0 = load_and_filter_data(file_name, constraints_f1_at_0)

    smoothing = 10 # Smoothing factor to avoid division by zero and diminish the impact of small counts

    #if no tags, return
    if not all_tags:
        logging.warning("No tags found in the data.")
        return

    all_tags_precisions, all_tags_recalls, all_tags_f1_scores = [], [], []
    filtered_tags_data_dict = {}
    for tag in all_tags:
        constraint_tag = {
            "Tags": lambda x: tag in x
        }
        filtered_tag_data = load_and_filter_data(file_name, constraint_tag)
        filtered_tags_data_dict[tag] = filtered_tag_data
        precisions, recalls, f1_scores = extract_scores(filtered_tag_data)
        all_tags_precisions.append(precisions)
        all_tags_recalls.append(recalls)
        all_tags_f1_scores.append(f1_scores)

    # Plot ranking of tags frequency for the 30 first tags
    fig_font_size = 14
    tag_frequencies = [len(filtered_tags_data_dict[tag]) for tag in all_tags]
    sorted_tags = sorted(zip(all_tags, tag_frequencies), key=lambda x: x[1], reverse=True)
    tags, frequencies = zip(*sorted_tags[0:number_of_tags])
    plt.figure(figsize=(12, 6))
    colors = ['lightblue' for f in frequencies]
    plt.bar(tags, frequencies, color=colors, edgecolor='black')
    plt.xticks(rotation=45, ha="right", fontsize= fig_font_size)
    plt.yticks(fontsize=fig_font_size)
    plt.xlabel("Tags", fontsize=fig_font_size)
    plt.ylabel("Frequency", fontsize=fig_font_size)
    if not show:
        plt.title(f'Top {len(all_tags)} most frequent tags')
    plt.grid()
    pp.savefig()
    if show:
        plt.show()

    # Plot boxplots for each metric
    metrics = [all_tags_precisions, all_tags_recalls, all_tags_f1_scores]
    metric_names = ["Precision", "Recall", "F1 Score"]
    for i, metric in enumerate(metrics):
        plt.figure(figsize=(12, 6))
        plt.boxplot(metric, tick_labels=all_tags)
        plt.xticks(rotation=45, ha="right", fontsize=10)
        plt.xlabel("Tags")
        plt.ylabel(metric_names[i])
        if not show:
            plt.title(f'Boxplot of {metric_names[i]} per Tag')
        plt.grid()
        pp.savefig()
        if show:
            plt.show()
        plt.close()

    # Plot ratio of tags (1+ nb score at 0)/(1 + nb score at 1)
    ratio_tags = []
    for tag in all_tags:
        constraint_tag = {
            "Tags": lambda x: tag in x
        }
        filtered_tag_data = load_and_filter_data(file_name, constraint_tag)
        precisions, recalls, f1_scores = extract_scores(filtered_tag_data)
        ratio_tags.append((f1_scores.count(0) + smoothing) / (f1_scores.count(1) + smoothing))
    # Sort tags by ratio
    sorted_tags = sorted(zip(all_tags, ratio_tags), key=lambda x: x[1], reverse=True)
    tags, ratios = zip(*sorted_tags)
    # Keep only the top number_of_tags
    tags = tags[:number_of_tags]
    ratios = ratios[:number_of_tags]

    plt.figure(figsize=(12, 6))

    # plot a line for the global ratio
    global_ratio = (len(filtered_f1_at_0.values()) + smoothing) / (len(filtered_f1_at_1.values()) + smoothing)
    plt.axhline(y=global_ratio, color='gray', linestyle='--', label='Global Ratio') 

    colors = ['springgreen' if r <= 1 else 'lightcoral' for r in ratios]
    plt.bar(tags, ratios, color=colors, edgecolor='black')
    plt.xticks(rotation=45, ha="right", fontsize=fig_font_size)
    plt.yticks(fontsize=fig_font_size)
    plt.xlabel("Tags", fontsize=fig_font_size)
    plt.ylabel("Frequency Ratio (+"+str(smoothing)+" smoothing)", fontsize=fig_font_size)
    if not show:
        plt.title(f'Top {len(all_tags)} worst tags by ratio')
    plt.grid()
    pp.savefig()
    if show:
        plt.show()
    plt.close()

    # Add total at the end of filtered_tags_data_dict 
    constraint_total = { #valid benchmark data
        "BenchmarkResult": lambda x: x not in [None, []]
    }
    filtered_total_data = load_and_filter_data(file_name, constraint_total)
    filtered_tags_data_dict["Total"] = filtered_total_data
    # Plot the table of commands and system errors
    plot_table_commands_failed(filtered_tags_data_dict)

def plot_table_commands_failed(rows: dict):
    """
    Creates a table displaying command completion and failure counts.

    Arguments:
        rows (dict): Dictionary where key is the row name and value is the data for that row.
    """
    nb_questions = len(rows)

    # Create the table headers
    table_headers = cmd_error_messages + ["Commands completed"]

    # Create the table data
    table_data = []
    for row_name, row_data in rows.items():
        # Columns are: Command completed + every error in cmd_error_messages
        # for each message in cmd_error_messages, score + 1 if in ["Error"]
        # if no error for the item, score + 1 in "Commands completed"
        row = [0] * (len(table_headers))
        for entry in row_data.values():
            failed_cmd_bool = False
            for cmd_error in cmd_error_messages:
                if cmd_error in entry.get("Error", ""):
                    row[table_headers.index(cmd_error)] += 1
                    failed_cmd_bool = True
            if not failed_cmd_bool:
                row[-1] += 1  # Increment the last column for completed commands
        table_data.append(row)
        
    fig, ax = plt.subplots(figsize=(12, 15))
    ax.axis("off")

    #put cells with a number above 10% of question number in red
    table = ax.table(
        cellText=table_data,
        colLabels=table_headers,
        rowLabels=list(rows.keys()),
        loc="center",
        cellLoc="center",
        cellColours=[["#FF9999" if cell > (nb_questions/10) else "#FFFFFF" for cell in row] for row in table_data],
    )

    ax.set_title("Table of Commands and System Errors", fontsize=14)
    # Disable auto font size
    table.auto_set_font_size(False)
    # Set font size for each cell
    for (row, col), cell in table.get_celld().items():
        if row == 0:
            cell.set_fontsize(4)  # smaller font for column headers
            # If the header cell contains more than 3 words, insert line breaks
            words = cell.get_text().get_text().split()
            if len(words) > 3:
                new_text = "\n".join([" ".join(words[i:i+3]) for i in range(0, len(words), 3)])
                cell.get_text().set_text(new_text)
        else:
            cell.set_fontsize(12)  # larger font for regular cells

    if pp:
        pp.savefig(fig)

    if show:
        plt.show()

    plt.close(fig)

def plot_question_clusters(question_groups_data, size_scale=100, spacing=3):
    """
    Plot question groups as circles:
    - circle size = number of questions
    - circle color = average F1 score (red=low, green=high)
    - circle text = representative question ID

    Circles are arranged in a grid with spacing to avoid overlap.
    
    Args:
        question_groups_data: list of dicts with keys 'representative_question', 'questions', 'f1scoremean'
        size_scale: scaling factor for circle size (default 100)
        spacing: space multiplier between circles in grid (default 3)
    """
    filtered_data = [g for g in question_groups_data if g["f1scoremean"] is not None]

    if not filtered_data:
        print("No valid data to plot.")
        return

    sizes = [len(g["questions"]) for g in filtered_data]
    colors = [g["f1scoremean"] for g in filtered_data]
    labels = [g["representative_question_id"] for g in filtered_data]

    sizes_scaled = [s * size_scale for s in sizes]

    cmap = plt.get_cmap('RdYlGn')

    n = len(filtered_data)
    cols = int(math.ceil(math.sqrt(n)))
    rows = int(math.ceil(n / cols))

    # Grid positions with spacing
    x = []
    y = []
    for i in range(n):
        col = i % cols
        row = i // cols
        x.append(col * spacing)
        y.append(-row * spacing)

    fig = plt.figure(figsize=(cols * 2, rows * 2))
    scatter = plt.scatter(x, y, s=sizes_scaled, c=colors, cmap=cmap, alpha=0.7, edgecolors='black')

    for i, label in enumerate(labels):
        plt.text(x[i], y[i], label, ha='center', va='center', fontsize=10, weight='bold')

    plt.colorbar(scatter, label='Average F1 Score')
    plt.xticks([])
    plt.yticks([])
    if not show:
        plt.title("Question Groups: Size by Number of Questions, Color by Avg F1 Score")
    plt.tight_layout()
    if pp:
        pp.savefig(fig)
    if show:
        plt.show()
    plt.close(fig)

def make_pdf_report(files_names: list[str], core_files_names: list[str], question_groups: dict):
    """
    Generate all the plots and tables for the given files.
    """
    logging.info("Starting to make to make the PDF")
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

    #print average f1 score for each question group (based on alldata)
    average_f1_score_per_question_group = []

    for name, question_group in question_groups.items():
        f1_scores_group = []
        for question_id in question_group["members"]:
            # only append the f1 score if not None
            if question_id in all_data and all_data[question_id]["F1Score"] is not None:
                f1_scores_group.append(all_data[question_id]["F1Score"])

        f1_mean = sum(f1_scores_group) / len(f1_scores_group) if f1_scores_group else None

        average_f1_score_per_question_group.append({
            "representative_question": question_group["exemplar_question"],
            "representative_question_id": question_group["exemplar_id"],
            "questions": question_group["members"],
            #"f1scores": f1_scores_group,
            "f1scoremean": f1_mean,
            "priority_score": len(question_group["members"]) * ((1 - f1_mean) if f1_mean is not None else 0)
        })

    # order the group by decreasing f1 score
    average_f1_score_per_question_group.sort(key=lambda x: x["priority_score"], reverse=True)

    plot_question_clusters(average_f1_score_per_question_group)

    print("NB of question groups:", len(question_groups))
    print("Average F1 score per question group:")
    for group_info in average_f1_score_per_question_group:
        print(group_info)


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
    plot_score_relative_to_time(filtered_valid_data)
    plot_cumulative_score_relative_to_time(filtered_valid_data)

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

    # Table 
    plot_table(table_headers, table_data, all_data, "global data")
    # Plot the tree
    plot_tree(tree_data)

    # Plot the confusion matrix of type predictions
    boolean_prediction_fiability(file_name, all_data)
    boolean_prediction_fiability_confusion_matrix_with_variability(files_names, all_data)


    constraints_f1_at_0 = {
        "BenchmarkResult": lambda x : x not in [None, []],
        "F1Score": lambda x: x == 0
    }   
    filtered_f1_at_0 = load_and_filter_data(file_name, constraints_f1_at_0)
    constraints_f1_at_1 = {
        "BenchmarkResult": lambda x : x not in [None, []],
        "F1Score": lambda x: x == 1
    }
    filtered_f1_at_1 = load_and_filter_data(file_name, constraints_f1_at_1)

    question_word_ranking(filtered_valid_data)
    question_word_ratio_ranking(filtered_f1_at_0, filtered_f1_at_1, "F1at0/F1at1")
    

    #### Advanced error analysis
    logging.info("Advanced error analysis")

    # boxplot per question tag
    question_tags_pp(filtered_valid_data, file_name)

    #failed cmd indexes (one of cmd_error_messages in Error)
    constraints_failed_cmd = {
        "Error": lambda x: isinstance(x, str) and any(cmd_error in x for cmd_error in cmd_error_messages)
    }
    filtered_failed_cmd_data = load_and_filter_data(file_name, constraints_failed_cmd)

    # todo pour groupe questions similaires
    # ->boite à moustache groupe de questions similaires

    # Close the pdf file
    pp.close()
    logging.info("PDF done.")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.realpath(__file__))
    core_files = [
        r'C:\Users\PC\Desktop\llmSparklis\benchmark\BestOutputs\for_paper\QALD9Plus\wikidata\train\one_shot_the_most\best_suggestion\nemo\QALD-9-plus_sparklisllm-LLMFrameworkOneShotTheMost_20250516_162438.json',
        r'C:\Users\PC\Desktop\llmSparklis\benchmark\BestOutputs\for_paper\QALD9Plus\wikidata\train\one_shot_the_most\best_suggestion\nemo\QALD-9-plus_sparklisllm-LLMFrameworkOneShotTheMost_20250517_031140.json',
        r'C:\Users\PC\Desktop\llmSparklis\benchmark\BestOutputs\for_paper\QALD9Plus\wikidata\train\one_shot_the_most\best_suggestion\nemo\QALD-9-plus_sparklisllm-LLMFrameworkOneShotTheMost_20250517_142256.json',
        r'C:\Users\PC\Desktop\llmSparklis\benchmark\BestOutputs\for_paper\QALD9Plus\wikidata\train\retry\best_suggestion\QALD-9-plus_sparklisllm-LLMFrameworkRetryWithoutTimeout_20250518_022648.json',
    ]

    input_files = [
        r'C:\Users\PC\Desktop\llmSparklis\benchmark\BestOutputs\for_paper\QALD9Plus\wikidata\train\retry\beam3x3\QALD-9-plus_sparklisllm-LLMFrameworkRetryWithoutTimeout_20250522_000656.json',
    ]

    questions_groups_qald_9_train_wikidata_level_word = { "Cluster_0": { "exemplar_id": "1", "exemplar_question": "List all boardgames by GMT.", "members": [ "1", "178", "249", "290" ] }, "Cluster_1": { "exemplar_id": "8", "exemplar_question": "Which airports does Air China serve?", "members": [ "8", "126", "196", "255" ] }, "Cluster_2": { "exemplar_id": "9", "exemplar_question": "Give me all actors starring in movies directed by and starring William Shatner.", "members": [ "9", "286" ] }, "Cluster_3": { "exemplar_id": "11", "exemplar_question": "Give me all Danish films.", "members": [ "11", "41", "51", "59", "71", "94", "118", "403" ] }, "Cluster_4": { "exemplar_id": "16", "exemplar_question": "Which state of the USA has the highest population density?", "members": [ "16", "22", "407" ] }, "Cluster_5": { "exemplar_id": "34", "exemplar_question": "Show me all basketball players that are higher than 2 meters.", "members": [ "34" ] }, "Cluster_6": { "exemplar_id": "36", "exemplar_question": "Which states border Illinois?", "members": [ "36", "48", "80", "102", "112", "122", "163", "253" ] }, "Cluster_7": { "exemplar_id": "43", "exemplar_question": "Which presidents were born in 1945?", "members": [ "43", "3", "17", "23", "72", "82", "100", "125", "139", "150", "162", "167", "263", "318", "326" ] }, "Cluster_8": { "exemplar_id": "50", "exemplar_question": "How many films did Hal Roach produce?", "members": [ "50", "56", "106", "130", "140", "258" ] }, "Cluster_9": { "exemplar_id": "54", "exemplar_question": "Give me all companies in Munich.", "members": [ "54", "20", "29", "64", "97", "113", "145", "161", "171", "181", "183", "204", "213", "231", "334", "347", "412" ] }, "Cluster_10": { "exemplar_id": "63", "exemplar_question": "In which films directed by Garry Marshall was Julia Roberts starring?", "members": [ "63" ] }, "Cluster_11": { "exemplar_id": "85", "exemplar_question": "How many employees does Google have?", "members": [ "85", "60", "76", "90", "144", "157", "168", "262", "284", "362", "382" ] }, "Cluster_12": { "exemplar_id": "86", "exemplar_question": "Give me all actors who were born in Berlin.", "members": [ "86", "33", "40", "69", "179" ] }, "Cluster_13": { "exemplar_id": "87", "exemplar_question": "Who created Goofy?", "members": [ "87", "2", "19", "37", "99", "129", "152", "191", "200", "210", "241", "350", "356", "365", "391", "413" ] }, "Cluster_14": { "exemplar_id": "108", "exemplar_question": "Which U.S. states are in the same time zone as Utah?", "members": [ "108", "25" ] }, "Cluster_15": { "exemplar_id": "119", "exemplar_question": "What other books have been written by the author of The Fault in Our Stars?", "members": [ "119" ] }, "Cluster_16": { "exemplar_id": "131", "exemplar_question": "Is Christian Bale starring in Batman Begins?", "members": [ "131", "314" ] }, "Cluster_17": { "exemplar_id": "134", "exemplar_question": "Which countries have more than two official languages?", "members": [ "134", "62", "338" ] }, "Cluster_18": { "exemplar_id": "136", "exemplar_question": "Show me all songs from Bruce Springsteen released between 1980 and 1990.", "members": [ "136" ] }, "Cluster_19": { "exemplar_id": "137", "exemplar_question": "Which television shows were created by John Cleese?", "members": [ "137", "12", "114", "199", "321", "378" ] }, "Cluster_20": { "exemplar_id": "141", "exemplar_question": "Give me the birthdays of all actors of the television show Charmed.", "members": [ "141", "55" ] }, "Cluster_21": { "exemplar_id": "147", "exemplar_question": "In which countries can you pay using the West African CFA franc?", "members": [ "147" ] }, "Cluster_22": { "exemplar_id": "148", "exemplar_question": "Which holidays are celebrated around the world?", "members": [ "148", "116", "174", "305" ] }, "Cluster_23": { "exemplar_id": "158", "exemplar_question": "List all episodes of the first season of the HBO television series The Sopranos!", "members": [ "158" ] }, "Cluster_24": { "exemplar_id": "160", "exemplar_question": "Does the new Battlestar Galactica series have more episodes than the old one?", "members": [ "160" ] }, "Cluster_25": { "exemplar_id": "164", "exemplar_question": "Give me a list of all bandleaders that play trumpet.", "members": [ "164", "24", "46", "143" ] }, "Cluster_26": { "exemplar_id": "169", "exemplar_question": "Which Chess players died in the same place they were born in?", "members": [ "169" ] }, "Cluster_27": { "exemplar_id": "172", "exemplar_question": "In which U.S. state is Fort Knox located?", "members": [ "172", "4", "115", "247", "297", "369" ] }, "Cluster_28": { "exemplar_id": "182", "exemplar_question": "Give me all films produced by Steven Spielberg with a budget of at least $80 million.", "members": [ "182" ] }, "Cluster_29": { "exemplar_id": "186", "exemplar_question": "Who is the heaviest player of the Chicago Bulls?", "members": [ "186", "31", "190", "202", "311" ] }, "Cluster_30": { "exemplar_id": "193", "exemplar_question": "Is Cola a beverage?", "members": [ "193", "104", "107", "166", "180", "211", "223", "235", "267", "268", "274", "343", "344", "358", "361" ] }, "Cluster_31": { "exemplar_id": "198", "exemplar_question": "Was the Cuban Missile Crisis earlier than the Bay of Pigs Invasion?", "members": [ "198" ] }, "Cluster_32": { "exemplar_id": "216", "exemplar_question": "how much is the elevation of D�sseldorf Airport ?", "members": [ "216", "217", "230", "278", "288" ] }, "Cluster_33": { "exemplar_id": "225", "exemplar_question": "How many people live in Poland?", "members": [ "225", "256", "324", "351" ] }, "Cluster_34": { "exemplar_id": "227", "exemplar_question": "Is the wife of president Obama called Michelle?", "members": [ "227", "245", "376" ] }, "Cluster_35": { "exemplar_id": "234", "exemplar_question": "What is the population of Cairo?", "members": [ "234", "10", "52", "65", "93", "120", "149", "151", "233", "236", "280", "283", "291", "303", "317", "353", "354", "370", "372", "380", "386", "393", "409" ] }, "Cluster_36": { "exemplar_id": "238", "exemplar_question": "Who is the author of the interpretation of dreams?", "members": [ "238", "67", "132", "194", "215", "285", "299" ] }, "Cluster_37": { "exemplar_id": "239", "exemplar_question": "When was the death of Shakespeare?", "members": [ "239", "35", "89", "92", "105", "138", "177", "214", "218", "219", "226", "254", "270", "275", "302", "325", "337", "359", "368", "374", "388", "405", "411" ] }, "Cluster_38": { "exemplar_id": "265", "exemplar_question": "Who is the mayor of Paris?", "members": [ "265", "5", "15", "27", "53", "66", "75", "170", "184", "192", "197", "209", "212", "220", "222", "229", "232", "259", "264", "271", "300", "306", "315", "320", "330", "379", "381", "396", "397", "398" ] }, "Cluster_39": { "exemplar_id": "279", "exemplar_question": "Which city has the most inhabitants?", "members": [ "279", "84", "110", "121", "123", "133", "224", "269", "332", "340", "349", "408" ] }, "Cluster_40": { "exemplar_id": "281", "exemplar_question": "When will start the final match of the football world cup 2018?", "members": [ "281" ] }, "Cluster_41": { "exemplar_id": "282", "exemplar_question": "Which films did Stanley Kubrick direct?", "members": [ "282", "14", "70", "124", "153", "221", "248" ] }, "Cluster_42": { "exemplar_id": "294", "exemplar_question": "In which country is the Limerick Lake?", "members": [ "294", "95", "203", "205", "243", "257", "273", "292", "346", "395", "406" ] }, "Cluster_43": { "exemplar_id": "296", "exemplar_question": "Give me all members of Prodigy.", "members": [ "296", "42", "61", "78", "91", "101", "103", "175", "185", "260", "313", "367", "402" ] }, "Cluster_44": { "exemplar_id": "307", "exemplar_question": "How many languages are spoken in Turkmenistan?", "members": [ "307", "58", "127", "142", "187", "327", "385" ] }, "Cluster_45": { "exemplar_id": "308", "exemplar_question": "Did Che Guevara have children?", "members": [ "308", "266", "309", "375" ] }, "Cluster_46": { "exemplar_id": "310", "exemplar_question": "To which party does the mayor of Paris belong?", "members": [ "310", "81", "355", "364" ] }, "Cluster_47": { "exemplar_id": "328", "exemplar_question": "Which scientist is known for the Manhattan Project and the Nobel Peace Prize?", "members": [ "328" ] }, "Cluster_48": { "exemplar_id": "335", "exemplar_question": "Who wrote the book The Pillars of the Earth?", "members": [ "335", "21", "195" ] }, "Cluster_49": { "exemplar_id": "336", "exemplar_question": "Do Prince Harry and Prince William have the same parents?", "members": [ "336" ] }, "Cluster_50": { "exemplar_id": "342", "exemplar_question": "How much did Pulp Fiction cost?", "members": [ "342", "44", "244", "329" ] }, "Cluster_51": { "exemplar_id": "345", "exemplar_question": "Who is starring in Spanish movies produced by Benicio del Toro?", "members": [ "345" ] }, "Cluster_52": { "exemplar_id": "348", "exemplar_question": "Where was Bach born?", "members": [ "348", "7", "38", "45", "74", "77", "237", "252", "333", "339" ] }, "Cluster_53": { "exemplar_id": "363", "exemplar_question": "How tall is Michael Jordan?", "members": [ "363", "156", "287", "304", "312" ] }, "Cluster_54": { "exemplar_id": "390", "exemplar_question": "In which films did Julia Roberts as well as Richard Gere play?", "members": [ "390" ] }, "Cluster_55": { "exemplar_id": "400", "exemplar_question": "What is the highest mountain in Australia?", "members": [ "400", "39", "154", "155", "165", "188", "189", "201", "207", "251", "289", "293", "301", "357" ] } }
    questions_groups_qald_9_train_dbpedia_level_word = {  "Cluster_0": {    "exemplar_id": "8",    "exemplar_question": "Which airports does Air China serve?",    "members": [      "8",      "70",      "126",      "196",      "255"    ]  },  "Cluster_1": {    "exemplar_id": "12",    "exemplar_question": "Which movies starring Brad Pitt were directed by Guy Ritchie?",    "members": [      "12",      "389"    ]  },  "Cluster_2": {    "exemplar_id": "16",    "exemplar_question": "Which state of the USA has the highest population density?",    "members": [      "16",      "22",      "373",      "407"    ]  },  "Cluster_3": {    "exemplar_id": "18",    "exemplar_question": "Which organizations were founded in 1950?",    "members": [      "18",      "3",      "17",      "23",      "26",      "43",      "72",      "80",      "82",      "100",      "114",      "117",      "125",      "139",      "142",      "150",      "167",      "263",      "318",      "323",      "326"    ]  },  "Cluster_4": {    "exemplar_id": "21",    "exemplar_question": "Who wrote the book The pillars of the Earth?",    "members": [      "21",      "195",      "311",      "335"    ]  },  "Cluster_5": {    "exemplar_id": "25",    "exemplar_question": "Which U.S. states are in the same timezone as Utah?",    "members": [      "25",      "108"    ]  },  "Cluster_6": {    "exemplar_id": "32",    "exemplar_question": "What are the top-10 action role-playing video games according to IGN?",    "members": [      "32"    ]  },  "Cluster_7": {    "exemplar_id": "34",    "exemplar_question": "Show me all basketball players that are higher than 2 meters.",    "members": [      "34"    ]  },  "Cluster_8": {    "exemplar_id": "41",    "exemplar_question": "Give me all cosmonauts.",    "members": [      "41",      "11",      "42",      "51",      "59",      "71",      "73",      "91",      "94",      "109",      "113",      "118",      "128",      "171",      "213",      "231",      "253",      "295",      "296",      "391",      "394",      "403"    ]  },  "Cluster_9": {    "exemplar_id": "50",    "exemplar_question": "How many films did Hal Roach produce?",    "members": [      "50",      "56",      "106",      "258",      "362"    ]  },  "Cluster_10": {    "exemplar_id": "54",    "exemplar_question": "Give me all companies in Munich.",    "members": [      "54",      "29",      "33",      "61",      "64",      "97",      "101",      "103",      "145",      "161",      "173",      "175",      "181",      "183",      "347"    ]  },  "Cluster_11": {    "exemplar_id": "58",    "exemplar_question": "How many airlines are there?",    "members": [      "58",      "127",      "140",      "163",      "168",      "250",      "262",      "334"    ]  },  "Cluster_12": {    "exemplar_id": "60",    "exemplar_question": "How many inhabitants does Maribor have?",    "members": [      "60",      "76",      "83",      "85",      "90",      "144",      "157",      "284",      "319",      "382"    ]  },  "Cluster_13": {    "exemplar_id": "63",    "exemplar_question": "In which films directed by Garry Marshall was Julia Roberts starring?",    "members": [      "63"    ]  },  "Cluster_14": {    "exemplar_id": "68",    "exemplar_question": "Give me all world heritage sites designated within the past two years.",    "members": [      "68"    ]  },  "Cluster_15": {    "exemplar_id": "86",    "exemplar_question": "Give me all actors who were born in Berlin.",    "members": [      "86",      "40",      "69",      "79",      "179"    ]  },  "Cluster_16": {    "exemplar_id": "87",    "exemplar_question": "Who created Goofy?",    "members": [      "87",      "2",      "19",      "37",      "99",      "112",      "129",      "162",      "184",      "191",      "200",      "210",      "241",      "302",      "365",      "413"    ]  },  "Cluster_17": {    "exemplar_id": "96",    "exemplar_question": "List all the musicals with music by Leonard Bernstein.",    "members": [      "96",      "249"    ]  },  "Cluster_18": {    "exemplar_id": "111",    "exemplar_question": "What is the total amount of men and women serving in the FDNY?",    "members": [      "111"    ]  },  "Cluster_19": {    "exemplar_id": "119",    "exemplar_question": "What other books have been written by the author of The Fault in Our Stars?",    "members": [      "119"    ]  },  "Cluster_20": {    "exemplar_id": "131",    "exemplar_question": "Is Christian Bale starring in Batman Begins?",    "members": [      "131",      "314"    ]  },  "Cluster_21": {    "exemplar_id": "135",    "exemplar_question": "Which countries have more than ten caves?",    "members": [      "135",      "6",      "30",      "47",      "62",      "134",      "199",      "338"    ]  },  "Cluster_22": {    "exemplar_id": "136",    "exemplar_question": "Show me all songs from Bruce Springsteen released between 1980 and 1990.",    "members": [      "136"    ]  },  "Cluster_23": {    "exemplar_id": "141",    "exemplar_question": "Give me the birthdays of all actors of the television show Charmed.",    "members": [      "141",      "55"    ]  },  "Cluster_24": {    "exemplar_id": "147",    "exemplar_question": "In which countries can you pay using the West African CFA franc?",    "members": [      "147"    ]  },  "Cluster_25": {    "exemplar_id": "148",    "exemplar_question": "Which holidays are celebrated around the world?",    "members": [      "148",      "174",      "305"    ]  },  "Cluster_26": {    "exemplar_id": "159",    "exemplar_question": "What does ICRO stand for?",    "members": [      "159",      "39",      "44",      "322",      "372"    ]  },  "Cluster_27": {    "exemplar_id": "160",    "exemplar_question": "Does the new Battlestar Galactica series have more episodes than the old one?",    "members": [      "160"    ]  },  "Cluster_28": {    "exemplar_id": "164",    "exemplar_question": "Give me a list of all bandleaders that play trumpet.",    "members": [      "164",      "24",      "46",      "143"    ]  },  "Cluster_29": {    "exemplar_id": "169",    "exemplar_question": "Which Chess players died in the same place they were born in?",    "members": [      "169"    ]  },  "Cluster_30": {    "exemplar_id": "172",    "exemplar_question": "In which U.S. state is Fort Knox located?",    "members": [      "172",      "4",      "115",      "206",      "297"    ]  },  "Cluster_31": {    "exemplar_id": "182",    "exemplar_question": "Give me all films produced by Steven Spielberg with a budget of at least $80 million.",    "members": [      "182"    ]  },  "Cluster_32": {    "exemplar_id": "188",    "exemplar_question": "What is the largest country in the world?",    "members": [      "188",      "65",      "98",      "105",      "189",      "251",      "357",      "370"    ]  },  "Cluster_33": {    "exemplar_id": "193",    "exemplar_question": "Is Cola a beverage?",    "members": [      "193",      "104",      "107",      "166",      "180",      "211",      "214",      "223",      "235",      "266",      "267",      "274",      "324",      "343",      "358"    ]  },  "Cluster_34": {    "exemplar_id": "198",    "exemplar_question": "Was the Cuban Missile Crisis earlier than the Bay of Pigs Invasion?",    "members": [      "198"    ]  },  "Cluster_35": {    "exemplar_id": "215",    "exemplar_question": "What is the location of the Houses of Parliament?",    "members": [      "215",      "49",      "67",      "116",      "132",      "176",      "194",      "238",      "299",      "352"    ]  },  "Cluster_36": {    "exemplar_id": "219",    "exemplar_question": "Who was the first King of England?",    "members": [      "219",      "53",      "74",      "152",      "190",      "218",      "254",      "270",      "330",      "337",      "339",      "359",      "384"    ]  },  "Cluster_37": {    "exemplar_id": "227",    "exemplar_question": "Is the wife of president Obama called Michelle?",    "members": [      "227",      "245",      "376"    ]  },  "Cluster_38": {    "exemplar_id": "234",    "exemplar_question": "What is the population of Cairo?",    "members": [      "234",      "10",      "45",      "52",      "93",      "120",      "149",      "151",      "209",      "217",      "230",      "233",      "236",      "275",      "278",      "280",      "283",      "288",      "291",      "293",      "317",      "353",      "354",      "380",      "386",      "393",      "409",      "411"    ]  },  "Cluster_39": {    "exemplar_id": "237",    "exemplar_question": "Where is Sungkyunkwan University?",    "members": [      "237",      "7",      "36",      "38",      "77",      "333",      "348",      "361",      "387"    ]  },  "Cluster_40": {    "exemplar_id": "257",    "exemplar_question": "In which ancient empire could you pay with cocoa beans?",    "members": [      "257"    ]  },  "Cluster_41": {    "exemplar_id": "265",    "exemplar_question": "Who is the mayor of Paris?",    "members": [      "265",      "5",      "15",      "27",      "31",      "66",      "75",      "146",      "170",      "186",      "192",      "197",      "202",      "204",      "208",      "212",      "216",      "220",      "222",      "229",      "232",      "242",      "259",      "264",      "285",      "300",      "306",      "315",      "320",      "379",      "381",      "396",      "397",      "398"    ]  },  "Cluster_42": {    "exemplar_id": "268",    "exemplar_question": "Does the Isar flow into a lake?",    "members": [      "268",      "57",      "374"    ]  },  "Cluster_43": {    "exemplar_id": "279",    "exemplar_question": "Which city has the most inhabitants?",    "members": [      "279",      "48",      "84",      "88",      "102",      "110",      "121",      "122",      "123",      "133",      "224",      "246",      "269",      "332",      "340",      "349",      "408"    ]  },  "Cluster_44": {    "exemplar_id": "282",    "exemplar_question": "Which films did Stanley Kubrick direct?",    "members": [      "282",      "124",      "153",      "221",      "248"    ]  },  "Cluster_45": {    "exemplar_id": "286",    "exemplar_question": "Give me all actors starring in movies directed by William Shatner.",    "members": [      "286",      "9",      "371",      "412"    ]  },  "Cluster_46": {    "exemplar_id": "290",    "exemplar_question": "List all games by GMT.",    "members": [      "290",      "1",      "178"    ]  },  "Cluster_47": {    "exemplar_id": "292",    "exemplar_question": "In which city did Nikos Kazantzakis die?",    "members": [      "292",      "130",      "243",      "247",      "369",      "377",      "399",      "406"    ]  },  "Cluster_48": {    "exemplar_id": "294",    "exemplar_question": "In which country is the Limerick Lake?",    "members": [      "294",      "203",      "205",      "273",      "276",      "346",      "366",      "395"    ]  },  "Cluster_49": {    "exemplar_id": "307",    "exemplar_question": "How many languages are spoken in Turkmenistan?",    "members": [      "307",      "187",      "298",      "327",      "385"    ]  },  "Cluster_50": {    "exemplar_id": "310",    "exemplar_question": "To which party does the mayor of Paris belong?",    "members": [      "310",      "81",      "355"    ]  },  "Cluster_51": {    "exemplar_id": "321",    "exemplar_question": "Which television shows were created by Walt Disney?",    "members": [      "321",      "137",      "378"    ]  },  "Cluster_52": {    "exemplar_id": "325",    "exemplar_question": "When was the Titanic completed?",    "members": [      "325",      "35",      "89",      "92",      "138",      "177",      "239",      "252",      "309",      "350",      "356",      "368",      "375",      "388",      "401"    ]  },  "Cluster_53": {    "exemplar_id": "328",    "exemplar_question": "Which scientist is known for the Manhattan Project and the Nobel Peace Prize?",    "members": [      "328"    ]  },  "Cluster_54": {    "exemplar_id": "331",    "exemplar_question": "List all episodes of the first season of the HBO television series The Sopranos.",    "members": [      "331",      "158"    ]  },  "Cluster_55": {    "exemplar_id": "341",    "exemplar_question": "What was the final result of the War of the Roses?",    "members": [      "341",      "226",      "281",      "410"    ]  },  "Cluster_56": {    "exemplar_id": "342",    "exemplar_question": "How much did Pulp Fiction cost?",    "members": [      "342",      "244",      "329"    ]  },  "Cluster_57": {    "exemplar_id": "344",    "exemplar_question": "Do Urdu and Persian have a common root?",    "members": [      "344",      "336"    ]  },  "Cluster_58": {    "exemplar_id": "345",    "exemplar_question": "Who is starring in Spanish movies produced by Benicio del Toro?",    "members": [      "345"    ]  },  "Cluster_59": {    "exemplar_id": "351",    "exemplar_question": "How many people live in Eurasia?",    "members": [      "351",      "225",      "256",      "316"    ]  },  "Cluster_60": {    "exemplar_id": "360",    "exemplar_question": "Does the Ford Motor Company have a manufacturing plant in Malaysia?",    "members": [      "360"    ]  },  "Cluster_61": {    "exemplar_id": "363",    "exemplar_question": "How tall is Michael Jordan?",    "members": [      "363",      "28",      "156",      "287",      "304",      "308",      "312",      "392"    ]  },  "Cluster_62": {    "exemplar_id": "390",    "exemplar_question": "In which films did Julia Roberts as well as Richard Gere play?",    "members": [      "390"    ]  },  "Cluster_63": {    "exemplar_id": "400",    "exemplar_question": "What is the highest mountain in Australia?",    "members": [      "400",      "154",      "155",      "165",      "201",      "207",      "289",      "301",      "303"    ]  },  "Cluster_64": {    "exemplar_id": "402",    "exemplar_question": "Give me the currency of China.",    "members": [      "402",      "13",      "20",      "78",      "185",      "260",      "271",      "313",      "367",      "383",      "405"    ]  },  "Cluster_65": {    "exemplar_id": "404",    "exemplar_question": "In which city are the headquarters of the United Nations?",    "members": [      "404",      "14",      "95",      "364"    ]  }}

    question_groups = questions_groups_qald_9_train_wikidata_level_word
    make_pdf_report(input_files, core_files, question_groups)