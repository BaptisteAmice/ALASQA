import unittest
from system_evaluation import stats_calculation
# Not really unit testing, but allow to verify some properties of the system

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

    #todo
    # def test__bool_mixed(self):
    #     precisions, recalls, f1s = stats_calculation([True, False, True], [True, True, False])
    #     self.assertEqual(precisions, [0.5, 0.5, 0])
    #     self.assertEqual(recalls, [1, 0.5, 0])
    #     self.assertEqual(f1s, [2/3, 1/2, 0])

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

    #todo on veut que ca soit bon ou pas?
    def test_dict_diffenrent_key(self):
        dictList = [{"result": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}}]
        dictList2 = [{"Q215627_1": {"type": "uri", "value": "http://www.wikidata.org/entity/Q42"}}]
        precisions, recalls, f1s = stats_calculation([dictList], [dictList2])
        self.assertEqual(precisions, [0])
        self.assertEqual(recalls, [0])
        self.assertEqual(f1s, [0])

if __name__ == '__main__':
    unittest.main()
