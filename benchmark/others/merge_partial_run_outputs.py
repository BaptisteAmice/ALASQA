"""
Used to merge partial run outputs into a new JSON file.
Will add the questions and answers from the partial runs to the new file (ids in files must be unique).
Will also recalculate global metrics (averages) for the new file.
Useful to be able to evaluate a benchmark with multiple runs and merge the results into a single file.
(To run a benchmark starting from a given question, you can use BENCHMARK_QUESTIONS_FILTER in the config file).
"""
import json
from datetime import datetime
import logging

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def merge_benchmark_files(input_files, output_file):
    combined_data = {}
    all_questions = {}

    # Store per-question stats for later computation
    total_system_time = 0.0
    precisions = []
    recalls = []
    f1s = []

    precisions_boolean = []
    recalls_boolean = []
    f1s_boolean = []

    precisions_uri = []
    recalls_uri = []
    f1s_uri = []

    precisions_literal = []
    recalls_literal = []
    f1s_literal = []

    nb_boolean = 0
    nb_uri = 0
    nb_literal = 0

    nb_valid_questions = 0

    benchmark_name = None
    tested_system = None
    endpoint = None
    used_llm = None

    # For consistency checks
    input_stats = []

    for file in input_files:
        with open(file, 'r', encoding='utf-8') as f:
            result = json.load(f)

        if benchmark_name is None:
            benchmark_name = result.get("BenchmarkName")
            tested_system = result.get("TestedSystem")
            endpoint = result.get("Endpoint")
            used_llm = result.get("UsedLLM")

        stats = result.get("Stats", {})
        data = result.get("Data", {})

        input_stats.append({
            "NbQuestions": stats.get("NbQuestions", 0),
            "MeanPrecision": stats.get("MeanPrecision", 0.0),
            "MeanRecall": stats.get("MeanRecall", 0.0),
            "MeanF1Score": stats.get("MeanF1Score", 0.0)
        })

        for qid, qdata in data.items():
            if qid in all_questions:
                raise ValueError(f"Duplicate question ID found: {qid}")
            all_questions[qid] = qdata

            system_time = qdata.get("SystemTime")
            if system_time is not None:
                total_system_time += system_time

            precision = qdata.get("Precision")
            recall = qdata.get("Recall")
            f1 = qdata.get("F1Score")

            if precision is not None:
                precisions.append(precision)
                nb_valid_questions += 1
            if recall is not None:
                recalls.append(recall)
            if f1 is not None:
                f1s.append(f1)

            result_type = qdata.get("BenchmarkResultType")
            if result_type == "boolean":
                nb_boolean += 1
                if precision is not None:
                    precisions_boolean.append(precision)
                if recall is not None:
                    recalls_boolean.append(recall)
                if f1 is not None:
                    f1s_boolean.append(f1)
            elif result_type == "uri":
                nb_uri += 1
                if precision is not None:
                    precisions_uri.append(precision)
                if recall is not None:
                    recalls_uri.append(recall)
                if f1 is not None:
                    f1s_uri.append(f1)
            elif result_type == "literal":
                nb_literal += 1
                if precision is not None:
                    precisions_literal.append(precision)
                if recall is not None:
                    recalls_literal.append(recall)
                if f1 is not None:
                    f1s_literal.append(f1)

    nb_questions = len(all_questions)
    mean_system_time = total_system_time / nb_questions if nb_questions else 0.0

    def safe_mean(values):
        return sum(values) / len(values) if values else 0.0

    recomputed_precision = safe_mean(precisions)
    recomputed_recall = safe_mean(recalls)
    recomputed_f1 = safe_mean(f1s)

    # Perform consistency checks
    expected_precision = 0.0
    expected_recall = 0.0
    expected_f1 = 0.0
    total_nb = 0

    for s in input_stats:
        n = s["NbQuestions"]
        expected_precision += s["MeanPrecision"] * n
        expected_recall += s["MeanRecall"] * n
        expected_f1 += s["MeanF1Score"] * n
        total_nb += n

    tolerance = 1e-6

    if total_nb > 0:
        expected_precision /= total_nb
        expected_recall /= total_nb
        expected_f1 /= total_nb

        if abs(expected_precision - recomputed_precision) > tolerance:
            logger.warning(f"Precision mismatch: expected {expected_precision:.6f} vs recomputed {recomputed_precision:.6f}")
        if abs(expected_recall - recomputed_recall) > tolerance:
            logger.warning(f"Recall mismatch: expected {expected_recall:.6f} vs recomputed {recomputed_recall:.6f}")
        if abs(expected_f1 - recomputed_f1) > tolerance:
            logger.warning(f"F1 mismatch: expected {expected_f1:.6f} vs recomputed {recomputed_f1:.6f}")

    merged_result = {
        "BenchmarkName": benchmark_name,
        "TestedSystem": tested_system,
        "Date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Endpoint": endpoint,
        "UsedLLM": used_llm,
        "Stats": {
            "MeanSystemTime": mean_system_time,
            "NbQuestions": nb_questions,
            "NbValidQuestions": nb_valid_questions,
            "MeanPrecision": round(recomputed_precision, 4),
            "MeanRecall": round(recomputed_recall, 4),
            "MeanF1Score": round(recomputed_f1, 4),
            "NbBooleanQuestions": nb_boolean,
            "MeanPrecisionBoolean": round(safe_mean(precisions_boolean), 4),
            "MeanRecallBoolean": round(safe_mean(recalls_boolean), 4),
            "MeanF1ScoreBoolean": round(safe_mean(f1s_boolean), 4),
            "NbUriQuestions": nb_uri,
            "MeanPrecisionUri": round(safe_mean(precisions_uri), 4),
            "MeanRecallUri": round(safe_mean(recalls_uri), 4),
            "MeanF1ScoreUri": round(safe_mean(f1s_uri), 4),
            "NbLiteralQuestions": nb_literal,
            "MeanPrecisionLiteral": round(safe_mean(precisions_literal), 4),
            "MeanRecallLiteral": round(safe_mean(recalls_literal), 4),
            "MeanF1ScoreLiteral": round(safe_mean(f1s_literal), 4)
        },
        "Data": all_questions
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged_result, f, indent=4, ensure_ascii=False)

    logger.info(f"Merged {len(input_files)} files -> {output_file}")

if __name__ == "__main__":
    input_results_files = [
        r'C:\Users\PC\Desktop\llmSparklis\benchmark\QALD-9-plus_sparklisllm-LLMFrameworkOneShot_20250613_145733.json',
        r'C:\Users\PC\Desktop\llmSparklis\benchmark\QALD-9-plus_sparklisllm-LLMFrameworkOneShot_20250709_145353.json'
    ]
    output_file = "combined_results.json"
    merge_benchmark_files(input_results_files, output_file)
