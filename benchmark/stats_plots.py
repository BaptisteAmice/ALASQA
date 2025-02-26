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

if __name__ == "__main__":
   
    input_file = config.script_dir + "/Outputs/to_keep/llm_extension_with_qa_extension_no_data/QALD-10_sparklisllm_20250225_145041_unfinished.json"
    precisions, recalls, f1_scores = extract_scores(input_file)
    accuracy_recall_f1_plot(precisions, recalls, f1_scores)
    boxplot_scores(precisions, recalls, f1_scores)
