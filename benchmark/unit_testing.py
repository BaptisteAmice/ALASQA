"""
Not really unit testing, but allow to verify some properties of the system
"""
import unittest
from system_evaluation import stats_calculation, recursive_dict_extract

class TestRecursiveDictExtract(unittest.TestCase):

    def test_empty(self):
        self.assertEqual(recursive_dict_extract([], "value"), [])

    def test_one_item(self):
        dictList = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}}]
        self.assertEqual(recursive_dict_extract(dictList, "value"), ["http://www.wikidata.org/entity/Q42"])

    def test_several_items(self):
        dictList = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}},
                    {"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q43"}}]
        self.assertEqual(recursive_dict_extract(dictList, "value"), ["http://www.wikidata.org/entity/Q42", "http://www.wikidata.org/entity/Q43"])

class TestStatsCalculation(unittest.TestCase):

    ###### BOOLEANS

    def test_bool_equal(self):
        precisions, recalls, f1s = stats_calculation([True, False, True], [True, False, True])
        self.assertEqual(precisions, [1, 1, 1])
        self.assertEqual(recalls, [1, 1, 1])
        self.assertEqual(f1s, [1, 1 ,1])

    def test_bool_not_equal(self):
        precisions, recalls, f1s = stats_calculation([True, False, True], [False, True, False])
        self.assertEqual(precisions, [0, 0, 0])
        self.assertEqual(recalls, [0, 0, 0])
        self.assertEqual(f1s, [0, 0, 0])

    ###### NONE

    def test_none_system(self):
        precisions, recalls, f1s = stats_calculation([True, False, True], [None, None, None])
        self.assertEqual(precisions, [0, 0, 0])
        self.assertEqual(recalls, [0, 0, 0])
        self.assertEqual(f1s, [0, 0, 0])

    def test_none_benchmark(self):
        precisions, recalls, f1s = stats_calculation([None, None, None], [True, False, True])
        self.assertEqual(precisions, [None, None, None])
        self.assertEqual(recalls, [None, None, None])
        self.assertEqual(f1s, [None, None, None])

    def test_none_both(self):
        precisions, recalls, f1s = stats_calculation([None, None, None], [None, None, None])
        self.assertEqual(precisions, [None, None, None])
        self.assertEqual(recalls, [None, None, None])
        self.assertEqual(f1s, [None, None, None])


    ###### DICT

    def test_dict_one_equal(self):
        dictList = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42299"}}]
        precisions, recalls, f1s = stats_calculation([dictList], [dictList])
        self.assertEqual(precisions, [1])
        self.assertEqual(recalls, [1])
        self.assertEqual(f1s, [1])

    def test_dict_one_not_equal(self):
        dictList = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42299"}}]
        dictList2 = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}}]
        precisions, recalls, f1s = stats_calculation([dictList], [dictList2])
        self.assertEqual(precisions, [0])
        self.assertEqual(recalls, [0])
        self.assertEqual(f1s, [0])

    def test_dict_diffenrent_key(self):
        dictList = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}}]
        dictList2 = [{"Q215627_1": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}}]
        precisions, recalls, f1s = stats_calculation([dictList], [dictList2])
        self.assertEqual(precisions, [1])
        self.assertEqual(recalls, [1])
        self.assertEqual(f1s, [1])


    def test_dict_several_items_equals(self):
        dictList = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}},
                    {"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}},
                    {"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}}]
        precisions, recalls, f1s = stats_calculation([dictList], [dictList])
        self.assertEqual(precisions, [1])
        self.assertEqual(recalls, [1])
        self.assertEqual(f1s, [1])

    def test_dict_several_items_not_equals(self):
        dictList = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q41"}},
                    {"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}}]
        dictList2 = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q43"}},
                     {"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}}]
        precisions, recalls, f1s = stats_calculation([dictList], [dictList2])
        self.assertEqual(precisions, [1/2])
        self.assertEqual(recalls, [1/2])
        self.assertEqual(f1s, [(2*(1/2)*(1/2))/((1/2)+(1/2))])

if __name__ == '__main__':
    unittest.main()
