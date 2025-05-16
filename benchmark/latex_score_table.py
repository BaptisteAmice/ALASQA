import json
import statistics
import os
from glob import glob

# === Configuration ===
JSON_DIR = r'C:\Users\PC\Desktop\llmSparklis\benchmark\BestOutputs\for_paper\QALD9Plus\wikidata\train\one_shot_the_most\best_suggestion'
OUTPUT_FILE = "latex_table.txt"  # File to save LaTeX table

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

def load_json_files(directory):
    filepaths = glob(os.path.join(directory, "*.json"))
    return [json.load(open(f, "r", encoding="utf-8")) for f in filepaths]

def compute_stats(data, fields):
    stats = {category: {metric: [] for metric in metrics} for category, metrics in fields.items()}

    for entry in data:
        for category, metrics in fields.items():
            for metric_label, json_key in metrics.items():
                value = entry["Stats"].get(json_key)
                if value is not None:
                    stats[category][metric_label].append(value)
    return stats

def format_mean_std(values):
    if not values:
        return "N/A"
    mean = statistics.mean(values)
    std = statistics.stdev(values) if len(values) > 1 else 0.0
    return f"{mean:.3f} $\\pm$ {std:.3f}"

def generate_latex_table(stats):
    rows = []
    header = "\\begin{table}[ht]\n\\centering\n\\begin{tabular}{l|ccc}\n\\hline"
    title = "\\textbf{Type} & Précision & Rappel & F1-score \\\\\n\\hline"
    rows.append(header)
    rows.append(title)

    for category in ["Tous", "Bool", "URIs", "Literals"]:
        pr = format_mean_std(stats[category]["Précision"])
        rc = format_mean_std(stats[category]["Rappel"])
        f1 = format_mean_std(stats[category]["F1-score"])
        row = f"{category} & {pr} & {rc} & {f1} \\\\"
        rows.append(row)

    footer = "\\hline\n\\end{tabular}\n\\caption{Performances du modèle \\textbf{nemo} selon le type de résultat}\n\\label{tab:nemo-scores}\n\\end{table}"
    rows.append(footer)
    return "\n".join(rows)

if __name__ == "__main__":
    print(f"Loading JSON files from '{JSON_DIR}'...")
    data = load_json_files(JSON_DIR)
    print(f"Loaded {len(data)} files.")

    print("Computing statistics...")
    stats = compute_stats(data, FIELDS)

    print("Generating LaTeX table...")
    latex = generate_latex_table(stats)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(latex)
    print(f"LaTeX table written to '{OUTPUT_FILE}'.")

    print("\n--- LaTeX Table ---\n")
    print(latex)
