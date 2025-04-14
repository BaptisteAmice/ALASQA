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


def text_clustering(texts, similarity=levenshtein, word_level=False):
    '''Text Clustering'''
    # similarity
    if word_level: texts = [t.split() for t in texts]
    _similarity = levenshtein(texts)
    _affprop = AffinityPropagation(affinity="precomputed", damping=0.5, verbose=True,
        random_state=0, max_iter=1_000, convergence_iter=10)
    _affprop.fit(_similarity)
    return _affprop, _similarity


def print_clusters(affprop, texts):
    '''Print clusters'''
    texts = np.asarray(texts)
    clusters = np.unique(affprop.labels_)
    print(f'\n~ Number of texts:: {texts.shape[0]}')
    print(f'~ Number of clusters:: {clusters.shape[0]}')
    if clusters.shape[0] < 2: return 'Only few clusters - Stopped'
    for cluster_id in clusters:
        exemplar = texts[affprop.cluster_centers_indices_[cluster_id]]
        cluster = np.unique(texts[np.nonzero(affprop.labels_==cluster_id)])
        cluster_str = '";\n  "'.join(cluster)
        print(f'\n# Cluster ({cluster_id}) with ({len(cluster)}) elements')
        print(f'Exemplar:: {exemplar}')
        print(f'\nOthers::\n  "{cluster_str}"')


input_file = "./benchmark/Inputs/qald_9_plus_train_wikidata_patched.json"

with open(input_file, "r", encoding="utf-8") as f:
    data = json.load(f)

# retrieve english questions
texts = []
for question in data["questions"]:
    q1_list = question["question"]
    q1 = next((q["string"] for q in q1_list if q["language"] == "en"), None)
    if q1:
        texts.append(q1)


#texts = [["apple"], ["banana"], ["apple", "pie"]]
print("character level")
affprop_char_level, _ = text_clustering(texts, similarity=levenshtein, word_level=False)
print("word level")
affprop_word_level, _ = text_clustering(texts, similarity=levenshtein, word_level=True)
print("writing to file")

#redirect print in a file
output_file = "question_similarity.txt"
if os.path.exists(output_file):
    os.remove(output_file)
sys.stdout = open(output_file, "w")

print("=" * 20, "Character Level Clustering", "=" * 20)
print_clusters(affprop_char_level, texts)
print("=" * 20, "Word Level Clustering", "=" * 20)
print_clusters(affprop_word_level, texts)
sys.stdout.close()