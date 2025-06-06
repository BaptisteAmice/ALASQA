"""
Old script to find similar questions based on Levenshtein distance.
The clustering seems to not work well, please use the new script instead.
"""

from collections import defaultdict
import json


def levenshtein_distance(str1, str2):
    """
    Calculates the Levenshtein distance between two strings.
    """
    len_str1 = len(str1)
    len_str2 = len(str2)
    
    # Create a matrix to store distances
    dp = [[0] * (len_str2 + 1) for _ in range(len_str1 + 1)]
    
    # Initialize the matrix with base cases
    for i in range(len_str1 + 1):
        dp[i][0] = i
    for j in range(len_str2 + 1):
        dp[0][j] = j
    
    # Fill the matrix with the Levenshtein distance
    for i in range(1, len_str1 + 1):
        for j in range(1, len_str2 + 1):
            cost = 0 if str1[i - 1] == str2[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1,        # Deletion
                           dp[i][j - 1] + 1,        # Insertion
                           dp[i - 1][j - 1] + cost) # Substitution
    
    return dp[len_str1][len_str2]


def are_similar(q1, q2, threshold=0.1):
    """
    Returns True if two questions are more than 90% similar, based on edit distance.
    """
    # Calculate Levenshtein distance
    dist = levenshtein_distance(q1, q2)
    
    # Calculate similarity as 1 - (distance / max length of the two strings)
    max_len = max(len(q1), len(q2))
    similarity = 1 - (dist / max_len)
    
    # Return if similarity is above the threshold (90%)
    return similarity >= (1 - threshold)


def print_similar_questions(data, similarity_ratio, language="en"):
    """
    Prints pairs of questions with more than 90% similarity based on Levenshtein distance.
    
    Parameters:
        data (dict): A dictionary containing a 'questions' list with question objects.
    """
    questions = [q.get("question", "") for q in data.get("questions", [])]
    
    for i in range(len(questions)):
        for j in range(i + 1, len(questions)):
            q1_list = questions[i]
            q2_list = questions[j]

            #the question is the item where the language is "en"
            q1 = next((q["string"] for q in q1_list if q["language"] == language), None)
            q2 = next((q["string"] for q in q2_list if q["language"] == language), None)

            q1_id = data["questions"][i]["id"]
            q2_id = data["questions"][j]["id"]
            
            if are_similar(q1, q2, (1 - similarity_ratio)):
                print(f"Question {q1_id}: {q1}")
                print(f"Question {q2_id}: {q2}")
                print("-" * 50)

def group_similar_questions(data, similarity_ratio, language="en"):
    """
    Groups questions based on similarity.
    
    Parameters:
        data (dict): A dictionary containing a 'questions' list with question objects.
        similarity_ratio (float): Similarity threshold for grouping.
        language (str): Language of the questions to process.
        
    Returns:
        list: List of question groups.
    """
    questions = [q.get("question", "") for q in data.get("questions", [])]
    
    groups = []  # To store the groups of similar questions
    group_map = {}  # To map question ID to their group index
    
    for i in range(len(questions)):
        q1_list = questions[i]
        q1 = next((q["string"] for q in q1_list if q["language"] == language), None)
        q1_id = data["questions"][i]["id"]
        
        # Check if q1 belongs to any existing group
        added_to_group = False
        for group_index, group in enumerate(groups):
            # Check if any question in the group is similar to q1
            for group_q_id in group:
                group_q_list = questions[group_q_id]
                group_q = next((q["string"] for q in group_q_list if q["language"] == language), None)
                if are_similar(q1, group_q, (1 - similarity_ratio)):
                    groups[group_index].append(i)
                    group_map[q1_id] = group_index
                    added_to_group = True
                    break
            if added_to_group:
                break
        
        # If q1 is not similar to any existing group, create a new group
        if not added_to_group:
            groups.append([i])
            group_map[q1_id] = len(groups) - 1
    
    return groups, group_map

def find_representative_question(group, data, similarity_ratio, language="en"):
    """
    Find a representative question in the group (the one with the most connections).
    
    Parameters:
        group (list): List of question indices in the group.
        data (dict): The data dictionary containing the questions.
        language (str): The language to filter questions by.
        
    Returns:
        str: The representative question text.
    """
    question_counts = defaultdict(int)
    
    for i in range(len(group)):
        q1_list = data["questions"][group[i]]["question"]
        q1 = next((q["string"] for q in q1_list if q["language"] == language), None)
        
        for j in range(len(group)):
            if i != j:
                q2_list = data["questions"][group[j]]["question"]
                q2 = next((q["string"] for q in q2_list if q["language"] == language), None)
                
                if are_similar(q1, q2, (1 - similarity_ratio)):
                    question_counts[q1] += 1
    
    # Get the question with the most matches
    representative_question = max(question_counts, key=question_counts.get)
    return representative_question


def print_grouped_questions(data, similarity_ratio, language="en"):
    """
    Print the groups of similar questions and a representative question for each group.
    
    Parameters:
        data (dict): A dictionary containing a 'questions' list with question objects.
    """
    groups, group_map = group_similar_questions(data, similarity_ratio, language)

    #remove groups with only one question
    groups = [group for group in groups if len(group) > 1]
    
    print(f"Number of groups: {len(groups)}")
    for group in groups:
        #representative_question = find_representative_question(group, data, similarity_ratio, language)
        #print(f"Group representative question: {representative_question}")
        print("Questions in this group:")
        
        for i in group:
            q1_list = data["questions"][i]["question"]
            q1 = next((q["string"] for q in q1_list if q["language"] == language), None)
            q1_id = data["questions"][i]["id"]
            print(f"  - Question {q1_id}: {q1}")
        
        print("-" * 50)

if __name__ == "__main__":
    input_file = "./benchmark/Inputs/qald_9_plus_train_wikidata_patched.json"

    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    #print_similar_questions(data, 0.8, "en")
    print_grouped_questions(data, 0.6, "en")

