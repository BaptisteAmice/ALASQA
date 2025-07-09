import json
import statistics
import os
from glob import glob

# === Configuration ===
JSON_DIR = r'C:\Users\PC\Desktop\llmSparklis\benchmark\BestOutputs\for_egc\QALD9Plus\Wikidata\train\SimpleBoolean\greedy'
OUTPUT_FILE = "latex_table.txt"  # File to save LaTeX table

# Recalculation options
RECALCULATE_FILTER = ["unknown"]

float_precision = f"{{:.{2}f}}"  # Number of decimal places for float values


# === Metrics & Categories to Extract ===
FIELDS = {
    "Tous": {
        "Précision": "MeanPrecision",
        "Rappel": "MeanRecall",
        "F1-score": "MeanF1Score"
    },
    "Bool": {
        "Précision": "MeanPrecisionBoolean",
        "Rappel": "MeanRecallBoolean",
        "F1-score": "MeanF1ScoreBoolean"
    },
    "URIs": {
        "Précision": "MeanPrecisionUri",
        "Rappel": "MeanRecallUri",
        "F1-score": "MeanF1ScoreUri"
    },
    "Literals": {
        "Précision": "MeanPrecisionLiteral",
        "Rappel": "MeanRecallLiteral",
        "F1-score": "MeanF1ScoreLiteral"
    }
}

FIELD_MODEL_NAME = "UsedLLM"  # Field to extract model name from JSON
FIELD_SYSTEM_STRATEGY = "TestedSystem"  # Field to extract system strategy from JSON
FIELD_SELECTION_TACTIC = "SuggestionCommandsTactic"  # Field to extract selection tactic from JSON

# =====================

def load_json_files(directory):
    filepaths = glob(os.path.join(directory, "*.json"))
    return [json.load(open(f, "r", encoding="utf-8")) for f in filepaths]

def compute_stats(data, fields):
    stats = {category: {metric: [] for metric in metrics} for category, metrics in fields.items()}
    ignored_number = 0
    for entry in data:
        stats_entry = {category: {metric: [] for metric in metrics} for category, metrics in fields.items()}
        for qid, item in entry.get("Data", {}).items():
            result_type = item.get("BenchmarkResultType", "").lower()
            
            if result_type in RECALCULATE_FILTER:
                ignored_number += 1
                continue
            else:
                precision = item.get("Precision")
                recall = item.get("Recall")
                f1 = item.get("F1Score")

                #skip if not a number
                if precision is None or recall is None or f1 is None:
                    ignored_number += 1
                    continue

                # Tous (global stats)
                stats_entry["Tous"]["Précision"].append(precision)
                stats_entry["Tous"]["Rappel"].append(recall)
                stats_entry["Tous"]["F1-score"].append(f1)

                # Par type (si connu)
                if result_type == "boolean":
                    category = "Bool"
                elif result_type == "uri":
                    category = "URIs"
                elif result_type == "literal":
                    category = "Literals"
                else:
                    continue
                stats_entry[category]["Précision"].append(precision)
                stats_entry[category]["Rappel"].append(recall)
                stats_entry[category]["F1-score"].append(f1)
        # Calculate mean
        for category, metrics in stats_entry.items():
            for metric, values in metrics.items():
                if values:
                    mean_value = statistics.mean(values)
                    stats[category][metric].append(mean_value)

    #dump to test.txt
    with open("test.txt", "a", encoding="utf-8") as f:
        f.write(f"Number of ignored entries: {ignored_number}\n")
        f.write("Stats per category:\n")
        for category, metrics in stats.items():
            f.write(f"{category}:\n")
            for metric, values in metrics.items():
                f.write(f"  {metric}: {values}\n")
    return stats

def format_mean_std(values):
    if not values:
        return "N/A"
    mean = statistics.mean(values)
    std = statistics.stdev(values) if len(values) > 1 else 0.0
    print(f"Mean: {mean}, Std: {std} for values: {values}")
    return f"{float_precision.format(mean)} $\\pm$ {float_precision.format(std)}"

def generate_latex_table(stats, model_name,system_strategy,selection_tactic):
    rows = []
    header = "\\begin{table}[ht]\n\\centering\n\\begin{tabular}{l|ccc}\n\\hline"
    title = "\\textbf{Type} & Précision & Rappel & F1-score \\\\\n\\hline"
    rows.append(header)
    rows.append(title)

    nb_files = len(data)

    for category in ["Tous", "Bool", "URIs", "Literals"]:
        print(f"Processing category: {category}")
        pr = format_mean_std(stats[category].get("Précision", []))
        rc = format_mean_std(stats[category].get("Rappel", []))
        f1 = format_mean_std(stats[category].get("F1-score", []))
        row = f"{category} & {pr} & {rc} & {f1} \\\\"
        rows.append(row)

    footer = "\\hline\n\\end{tabular}\n\\caption{Performances du modèle \\textbf{"+model_name+"} pour la stratégie système "+system_strategy+" et la tactique de sélection "+selection_tactic+" (basé sur "+str(nb_files)+" exécutions)}\n\\label{tab:"+model_name+system_strategy+selection_tactic+"}\n\\end{table}"
    rows.append(footer)
    return "\n".join(rows)

if __name__ == "__main__":
    print(f"Loading JSON files from '{JSON_DIR}'...")
    data = load_json_files(JSON_DIR)
    print(f"Loaded {len(data)} files.")

    print("Computing statistics...")
    stats = compute_stats(data, FIELDS)

    model_name = data[0].get(FIELD_MODEL_NAME, "Unknown Model")
    #remove text before - in the strategy name
    system_strategy = data[0].get(FIELD_SYSTEM_STRATEGY, "Unknown Strategy").split('-')[-1] if data[0].get(FIELD_SYSTEM_STRATEGY) else "Unknown Strategy"
    selection_tactic = data[0].get(FIELD_SELECTION_TACTIC, "Unknown Tactic")

    print("Generating LaTeX table...")
    latex = generate_latex_table(stats, model_name,system_strategy,selection_tactic)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(latex)
    print(f"LaTeX table written to '{OUTPUT_FILE}'.")

    print("\n--- LaTeX Table ---\n")
    print(latex)
