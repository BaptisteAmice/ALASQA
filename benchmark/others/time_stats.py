"""
# This script collects all JSON files from specified folders and computes the global weighted mean system time.
Useful to compare the time needed for different runs or configurations.
"""
import os
import json
import logging
from statistics import mean, median

def collect_json_files(folders):
    """Collect all .json files in the given list of folders."""
    json_files = []
    for folder in folders:
        for root, _, files in os.walk(folder):
            for file in files:
                if file.endswith(".json"):
                    json_files.append(os.path.join(root, file))
    return json_files

def extract_valid_question_times(json_files):
    """Extract system times of valid questions (with non-null precision)."""
    all_times = []

    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                questions = data.get("Data", {})
                for q_id, q_data in questions.items():
                    precision = q_data.get("Precision")
                    system_time = q_data.get("SystemTime")
                    if precision is not None and system_time is not None:
                        all_times.append(system_time)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")

    return all_times

def summarize_times(name, times):
    if not times:
        print(f"No valid question times found for {name}.")
        return
    logger.info(f"{name} — Number of valid questions: {len(times)}")
    logger.info(f"{name} — Mean system time: {mean(times):.2f} seconds")
    logger.info(f"{name} — Median system time: {median(times):.2f} seconds")
    logger.info(f"{name} — Max system time: {max(times):.2f} seconds")
    logger.info(f"{name} — Min system time: {min(times):.2f} seconds")

if __name__ == "__main__":
    folders_greedy = [
        r'benchmark\BestOutputs\for_egc\QALD-9-Plus\Wikidata\train_and_test_merge\OneShot\greedy',
        r'benchmark\BestOutputs\for_egc\QALD-10\OneShot\greedy',
        r'benchmark\BestOutputs\for_egc\QALD-9-Plus\Wikidata\test\OneShot\greedy\fr',
        r'benchmark\BestOutputs\for_egc\TEXT2SPARQL\Corporate\OneShot\greedy'
    ]

    folders_beam = [
        r'benchmark\BestOutputs\for_egc\QALD-9-Plus\Wikidata\train_and_test_merge\OneShot\beam_search',
        r'benchmark\BestOutputs\for_egc\QALD-10\OneShot\beam_search',
        r'benchmark\BestOutputs\for_egc\QALD-9-Plus\Wikidata\test\OneShot\beam_search_3x3\fr',
        r'benchmark\BestOutputs\for_egc\TEXT2SPARQL\Corporate\OneShot\beam_search'
    ]

    folders_dfs = [
        r'benchmark\BestOutputs\for_egc\QALD-9-Plus\Wikidata\train_and_test_merge\OneShot\dfs',
        r'benchmark\BestOutputs\for_egc\QALD-10\OneShot\dfs',
        r'benchmark\BestOutputs\for_egc\QALD-9-Plus\Wikidata\test\OneShot\dfs\fr',
        r'benchmark\BestOutputs\for_egc\TEXT2SPARQL\Corporate\OneShot\dfs'
    ]

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    for name, folders in [('Greedy', folders_greedy), ('Beam Search', folders_beam), ('DFS', folders_dfs)]:
        files = collect_json_files(folders)
        times = extract_valid_question_times(files)
        summarize_times(name, times)

    logger.info("Reminder: Median is more robust to outliers than the mean, especially if timeout values skew the distribution.")
