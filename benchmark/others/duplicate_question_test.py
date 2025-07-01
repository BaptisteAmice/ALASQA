"""
Find questions that are present in both benchmarks and print the duplicates.  
Useful for checking whether the question sets of two benchmarks are disjoint.
"""
import sys
import os

# Get the parent directory of the current script
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add the parent directory to the system path
sys.path.insert(0, parent_dir)

# Now you can import modules from the parent directory (not the cleanest way, but works for this case)
import benchmark_extraction
from system_evaluation import extract_benchmark


if __name__ == "__main__":
    # Example usage
    benchmark_file1 = r'C:\Users\PC\Desktop\llmSparklis\benchmark\Inputs\qald_9_plus_train_dbpedia_patched.json'
    benchmark_name1 = benchmark_extraction.QALD9_PLUS

    benchmark_file2 = r'C:\Users\PC\Desktop\llmSparklis\benchmark\Inputs\qald_9_plus_test_dbpedia_patched.json'
    benchmark_name2 = benchmark_extraction.QALD9_PLUS

    # Extract the benchmark data
    benchmark_data1 = extract_benchmark(benchmark_file1, benchmark_name1)
    benchmark_data2 = extract_benchmark(benchmark_file2, benchmark_name2)

    # Get the list of questions in both benchmarks
    questions1 = benchmark_data1[1]
    questions2 = benchmark_data2[1]

    # Find duplicate questions
    duplicates = set(questions1) & set(questions2)

    #Print number of duplicates
    print(f"Number of duplicate questions: {len(duplicates)}")
    # Print duplicate questions
    for question in duplicates:
        print(question)