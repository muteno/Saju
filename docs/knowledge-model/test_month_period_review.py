from copy import deepcopy
import json
import subprocess
import unittest

from month_period_review import (REPO, MEASUREMENT, BRANCHES, compare_offset,
                                 load_review, measure, other_position_table,
                                 period_table, validate)


class MonthPeriodReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = load_review()

    def test_full_source_table_and_empty_middle_are_preserved(self):
        table=period_table(self.review)
        # Independently transcribed from source rows 99..103, including 午 己9/丁11.
        expected=['壬10 癸20','癸9 辛3 己18','戊7 丙7 甲16','甲10 乙20',
                  '乙9 癸3 戊18','戊7 庚7 丙16','丙10 己9 丁11','丁9 乙3 己18',
                  '戊7 壬7 庚16','庚10 辛20','辛9 丁3 戊18','戊7 甲7 壬16']
        self.assertEqual([' '.join(f"{s['stem']}{s['days']}" for s in table[b])
                          for b in BRANCHES], expected)
        for b in '子卯酉':
            self.assertEqual([s['stage'] for s in table[b]],['초기','정기'])

    def test_same_offset_keeps_wu_prose_table_conflict(self):
        rows=compare_offset(self.review,'午','19.5')['variants']
        self.assertEqual([[s['stage'] for s in v['candidates']] for v in rows],
                         [['정기'],['중기'],['중기']])
        self.assertEqual([[s['stem'] for s in v['candidates']] for v in rows],
                         [['丁'],[None],[None]])
        self.assertEqual(rows[0]['source_profile'],rows[1]['source_profile'])

    def test_internal_endpoints_never_silently_select_a_side(self):
        cases=[('寅','7',['초기','중기']),('寅','14',['중기','정기']),
               ('辰','9',['초기','중기']),('辰','12',['중기','정기']),
               ('子','10',['초기','정기']),('午','19',['중기','정기'])]
        for branch,offset,expected in cases:
            with self.subTest(branch=branch,offset=offset):
                row=compare_offset(self.review,branch,offset)['variants'][0]
                self.assertEqual([s['stage'] for s in row['candidates']],expected)
                self.assertEqual(row['status'],'internal_boundary_unknown')
        before=compare_offset(self.review,'午','18.9999999999999999999999999')
        after=compare_offset(self.review,'午','19.0000000000000000000000001')
        self.assertEqual(before['variants'][0]['candidates'][0]['stem'],'己')
        self.assertEqual(after['variants'][0]['candidates'][0]['stem'],'丁')

    def test_outer_boundaries_unknown_and_invalid_inputs_rejected(self):
        for b in BRANCHES:
            for x in (0,30):
                for v in compare_offset(self.review,b,x)['variants']:
                    self.assertEqual(v['candidates'],[])
                    self.assertEqual(v['status'],'outer_boundary_unknown')
        for x in (None,True,{},[],float('nan'),float('inf'),'NaN','Infinity','bad',-1,30.1):
            with self.subTest(offset=x),self.assertRaises(ValueError):
                compare_offset(self.review,'午',x)
        for b in ('','子丑','오',None,2):
            with self.assertRaises(ValueError): compare_offset(self.review,b,10)

    def test_all_inputs_stay_outside_personal_inference(self):
        for b in BRANCHES:
            for x in (0,7,10,12,14,19,19.5,20,29,30):
                result=compare_offset(self.review,b,x)
                self.assertEqual(result['personal_application'],'withheld')
                self.assertIsNone(result['probability'])
                self.assertIs(result['inference_enabled'],False)
                self.assertIs(result['use_as_training_labels'],False)
                self.assertEqual(len(result['missing_calendar_policy']),6)

    def test_power_ratios_are_not_normalized_or_converted_to_days(self):
        ratios=self.review['power_variants']
        self.assertEqual([sum(n for n in p['values'] if n is not None) for p in ratios],[100,90,100])
        self.assertEqual(ratios[2]['values'],[33,30,37])
        for p in ratios: self.assertEqual(p['unit'],'source_asserted_power_percent')
        self.assertEqual(self.review['period_variants'][2]['periods']['wu'],[10,10,10])

    def test_other_positions_not_reinterpreted_as_month_periods(self):
        other=other_position_table(self.review)
        self.assertEqual(other['子'],['癸'])
        self.assertEqual(other['午'],['己','丁'])
        self.assertEqual(other['亥'],['甲','壬'])
        # Read the real engine module rather than duplicating its lookup algorithm.
        script="import {HIDDEN_STEMS,STEMS_HANJA} from './dosa-app/engine/src/tables.js'; console.log(JSON.stringify(HIDDEN_STEMS.map(r=>r.map(s=>STEMS_HANJA[s]))))"
        engine=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=REPO,encoding='utf-8'))
        month=period_table(self.review)
        self.assertEqual(engine,[[s['stem'] for s in month[b]] for b in BRANCHES])
        self.assertEqual([b for b,ss in zip(BRANCHES,engine) if ss!=other[b]],list('子卯午酉亥'))

    def test_evidence_corruption_and_unreviewed_policies_fail_closed(self):
        changes=[lambda r:r.update(inference_enabled=True),
                 lambda r:r.update(probability=.5),
                 lambda r:r.update(use_as_training_labels=True),
                 lambda r:r['evidence'][0].update(sha256='0'*64),
                 lambda r:r['evidence'][0].update(quote='forged quote'),
                 lambda r:r['evidence'][0].update(lines=[0,1]),
                 lambda r:r['evidence'][0].update(path='../outside'),
                 lambda r:r['period_variants'][0]['boundary_policy'].update(endpoint_inclusion='left'),
                 lambda r:r['period_variants'][2].update(source_profile='sagong'),
                 lambda r:r['period_variants'][0].update(evidence_ids=['period_sagong_draft']),
                 lambda r:r['power_variants'][1].update(values=[30,None,70]),
                 lambda r:r['comparison_contract'].update(axis='birth_elapsed_days')]
        for change in changes:
            r=deepcopy(self.review); change(r)
            with self.assertRaises(ValueError): validate(r)

    def test_output_cannot_mutate_review_source_binding(self):
        review=deepcopy(self.review)
        output=compare_offset(review,'午','19.5')
        output['variants'][0]['evidence_ids'].append('period_sagong_draft')
        self.assertEqual(review,self.review)

    def test_reproducible_measurement_and_previous_inputs_unchanged(self):
        observed=measure()
        self.assertEqual(observed,json.loads((REPO/MEASUREMENT).read_text(encoding='utf-8')))
        self.assertEqual(observed['comparison_rows'],312)
        self.assertEqual(observed['month_vs_other_composition_differences'],list('子卯午酉亥'))


if __name__=='__main__':
    unittest.main()
