#https://www.kaggle.com/code/leomauro/text-clustering-grouping-texts/code
import sys
import os
import json
import numpy as np
import distance
from sklearn.cluster import AffinityPropagation

def levenshtein(texts):
    '''
    Levenshtein Distance
    - It requires negative similarities, so -1 * levenshtein(t1, t2)
    '''
    texts = np.asarray(texts, dtype=object)
    _similarity = np.array([[distance.levenshtein(list(w1),list(w2)) for w1 in texts] for w2 in texts])
    _similarity = -1.0*_similarity
    return _similarity


def text_clustering(texts, similarity=levenshtein, word_level=False, max_iterations=1_000):
    '''Text Clustering'''
    # similarity
    ids, sentences = zip(*texts)
    if word_level:
        sentences = [s.split() for s in sentences]
    _similarity = similarity(sentences)
    _affprop = AffinityPropagation(affinity="precomputed", damping=0.5, verbose=True,
        random_state=0, max_iter=max_iterations, convergence_iter=30)
    _affprop.fit(_similarity)
    return _affprop, _similarity


def print_clusters(affprop, texts):
    '''Print clusters and return dict with exemplars and group members'''
    texts = np.asarray(texts)
    clusters = np.unique(affprop.labels_)
    print(f'\n~ Number of texts:: {texts.shape[0]}')
    print(f'~ Number of clusters:: {clusters.shape[0]}')
    if clusters.shape[0] < 2:
        print("Only few clusters - Stopped")
        return {}

    cluster_dict = {}

    for cluster_id in clusters:
        exemplar_index = affprop.cluster_centers_indices_[cluster_id]
        exemplar_id, exemplar_text = texts[exemplar_index]
        print(f'\n# Cluster ({cluster_id}) with ({sum(affprop.labels_ == cluster_id)}) elements')
        print(f'Exemplar:: (ID: {exemplar_id}) {exemplar_text}')

        current_cluster_ids = [exemplar_id]

        for i, (qid, qtext) in enumerate(texts):
            if affprop.labels_[i] == cluster_id and i != exemplar_index:
                print(f'  ID: {qid} | {qtext}')
                current_cluster_ids.append(qid)

        cluster_dict[f"Cluster_{cluster_id}"] = {
            "exemplar_id": exemplar_id,
            "exemplar_question": exemplar_text,
            "members": current_cluster_ids
        }

    print("\nCluster Grouping:")
    print(json.dumps(cluster_dict, indent=2, ensure_ascii=False))  # readable with Unicode
    return cluster_dict


if __name__ == "__main__":
    ##### TO UPDATE MANUALLY
    input_file = "./benchmark/Inputs/qald_9_plus_train_wikidata_patched.json"
    character_level_enabled = False
    ######

    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # retrieve english questions
    texts = []
    for question in data["questions"]:
        q1_list = question["question"]
        q1 = next((q["string"] for q in q1_list if q["language"] == "en"), None)
        if q1:
            texts.append((question["id"], q1))

    if character_level_enabled:
        print("character level")
        affprop_char_level, _ = text_clustering(texts, similarity=levenshtein, word_level=False,
                                                max_iterations=10_000_000)
    print("word level")
    affprop_word_level, _ = text_clustering(texts, similarity=levenshtein, word_level=True,
                                            max_iterations=1_000)
    #redirect print in a file
    script_dir = os.path.dirname(os.path.realpath(__file__))
    output_file = script_dir + "/Outputs/question_similarity.txt"
    print("writing to file:", output_file)
    if os.path.exists(output_file):
        os.remove(output_file)
    sys.stdout = open(output_file, "w")

    if character_level_enabled:
        print("=" * 20, "Character Level Clustering", "=" * 20)
        print_clusters(affprop_char_level, texts)
    print("=" * 20, "Word Level Clustering", "=" * 20)
    print_clusters(affprop_word_level, texts)
    sys.stdout.close()