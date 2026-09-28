"""F04 reproduction and adversarial source/eligibility checks."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import p2_d5_review as audit


class P2D5ReviewTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = audit.load_review()
        cls.repository, cls.local, cls.differences = audit.reconstruct()

    def guard(self):
        return audit.load_guard()[0]

    def test_exact_reproduction_and_actual_blockers(self):
        result = audit.check()
        self.assertTrue(result['audit_reproduced'])
        self.assertEqual(result['d5']['repository'], dict(surface_pass=42, blocked=25, rollup_exempt=1, outside_d5_unit_link=24, evidence_quotes=88, d5_eligible=False))
        self.assertEqual(result['d5']['local_overlay'], dict(surface_pass=45, blocked=3, rollup_exempt=1, outside_d5_unit_link=24, evidence_quotes=90, d5_eligible=False))
        self.assertEqual(result['personal_inference_eligible_units'], 0)
        m = audit.measure()
        blocked = [(u['unit_id'], l['target']) for u in m['units'] for l in u['local_overlay']['d5_links'] if l['status']=='blocked']
        self.assertEqual(blocked, [('UJ-0002','개념:통근'),('UJ-0003','개념:통근'),('UJ-0004','개념:통근')])

    def test_overlay_preserves_unchanged_fields_and_originals(self):
        for uid in audit.IDS:
            fields = set(self.differences[uid]['changes'])
            for key, value in self.repository[uid].items():
                if key not in fields:
                    self.assertEqual(audit.canonical(value), audit.canonical(self.local[uid][key]))
        local = audit.reconstruct()[1]
        local['UI-0001']['chain'][0]['out'] = 'changed'
        self.assertNotEqual(local['UI-0001'], self.repository['UI-0001'])
        self.assertEqual(audit.reconstruct()[1], self.local)
        self.assertEqual(len(self.local['UJ-0005']['근거']), len(self.repository['UJ-0005']['근거'])+1)
        self.assertEqual(len(self.local['UI-0002']['근거']), len(self.repository['UI-0002']['근거'])+1)

    def test_review_payload_identity_types_and_policy_cannot_be_swapped(self):
        for mutate in [lambda r:r['units'].reverse(),
                       lambda r:r['units'][0].update(unit_id='UJ-0001'),
                       lambda r:r.update(inference_enabled=0),
                       lambda r:r.update(training_labels=True),
                       lambda r:r['units'][0].update(probability=.7),
                       lambda r:r['sources']['CT-P155'].update(author='산책처럼'),
                       lambda r:r['units'][0].update(conditions_exceptions_unknown='approved')]:
            changed=copy.deepcopy(self.review);mutate(changed)
            with self.assertRaisesRegex(ValueError,'payload'):
                audit.validate(changed)

    def test_frozen_source_alias_pilot_and_guard_tampering_fails(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            for rel in self.review['inputs']:
                p=root/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((audit.REPO/rel).read_bytes())
            for rel in [audit.ALIASES, audit.PILOTS[0], audit.GUARD, self.review['sources']['CT-P155']['path']]:
                p=root/rel;data=p.read_bytes();p.write_bytes(data+b'\n')
                with self.assertRaisesRegex(ValueError,'Input changed'):
                    audit.validate(self.review,root)
                p.write_bytes(data)
            audit.validate(self.review,root)
            # Windows checkout newlines are allowed without weakening Unicode hashes.
            for rel in self.review['inputs']:
                p=root/rel;p.write_bytes(p.read_bytes().replace(b'\r\n',b'\n').replace(b'\n',b'\r\n'))
            audit.validate(self.review,root)

    def test_quote_binding_span_text_and_author(self):
        u=copy.deepcopy(self.repository['UJ-0001']);e=copy.deepcopy(u['근거'][0]);g=self.guard()
        result=audit.quote_check(u,e,self.review,g)
        self.assertTrue(result['literal_match']);self.assertTrue(result['physical_quote_spans'])
        for mutate in [lambda x:x.update(file='wrong.md'), lambda x:x.update(lines=[1,9999]),
                       lambda x:x.update(para_id='CT-P155-36'),lambda x:x.update(quote=x['quote']+'fabrication'),
                       lambda x:x.update(quote='')]:
            changed=copy.deepcopy(e);mutate(changed)
            with self.assertRaises(ValueError):audit.quote_check(u,changed,self.review,g)
        u['author_cluster']='산책처럼'
        with self.assertRaises(ValueError):audit.quote_check(u,e,self.review,g)

    def test_d5_uses_quotes_only_and_retains_asr_policy(self):
        g=self.guard()
        u={'근거':[{'quote':'다른 말'}], 'chain':[{'out':'일간'}]}
        self.assertFalse(g.is_quotable('일간',u))
        u={'근거':[{'quote':'일관'}], '오전사':{'일관':'일간'}}
        self.assertTrue(g.is_quotable('일간',u))
        self.assertFalse(g.is_quotable('일간',dict(u,오전사={})))
        # Existing lexical pass on negation is preserved and NOT called meaning approval.
        self.assertTrue(g.is_quotable('신강',{'근거':[{'quote':'신강이 아니다'}]}))

    def test_banned_paragraph_exemptions_and_unit_links(self):
        g=self.guard()
        self.assertFalse(g.is_citable('DT-P235-08'))
        u={'unit_id':'fixture','근거':[{'quote':'다른 말'}], 'links':{'횡단':[{'to':'개념:궁위·자리론'},{'to':'UI-0001'},{'to':'개념:통근'}]}}
        r=audit.d5_links(u,g)
        self.assertEqual([x['status'] for x in r],['rollup_exempt','outside_d5_unit_link','blocked'])

    def test_hypothetical_alias_promotion_is_not_applied(self):
        result=audit.alias_promotion_probe(self.repository,self.local)
        self.assertFalse(result['applied_to_stored_aliases'])
        self.assertEqual(result['changed_surface_results'],[{'version':'repository','unit_id':'UI-0005','target':'개념:상극','before':False,'hypothetical_after':True}])
        self.assertEqual(result['synthetic_boundary_counterexample'],{'text':'보호본능을 자극합니다','before':False,'hypothetical_after':True})
        self.assertNotIn('극합니다',self.guard()._safe_alias_map().get('상극',set()))

    def test_schema_and_chain_failures_stay_visible(self):
        m=audit.measure();r={u['unit_id']:u for u in m['units']}
        for version in ['repository','local_overlay']:
            step=r['UI-0003'][version]['chain'][4]
            self.assertEqual(step['para_id'],'ST-P0657-02');self.assertFalse(step['paragraph_in_evidence'])
            self.assertFalse(r['UJ-0001'][version]['chain'][6]['op_in_v3_enum'])
            self.assertTrue(r['UJ-0006'][version]['fallback_author_mismatch'])
            self.assertTrue(all(u[version]['semantic_eligible'] is False for u in r.values()))

    def test_fresh_guard_state_and_read_only_inputs(self):
        before={p:hashlib.sha256((audit.REPO/p).read_bytes()).hexdigest() for p in self.review['inputs']}
        first=audit.measure();second=audit.measure()
        self.assertEqual(first,second)
        self.assertEqual(before,{p:hashlib.sha256((audit.REPO/p).read_bytes()).hexdigest() for p in self.review['inputs']})
        self.assertEqual(self.guard().QUOTABLE_MISSES,[])

    def test_source_path_cannot_escape(self):
        for rel in ['../outside','/tmp/outside']:
            with self.assertRaises(ValueError):audit.checked_path(audit.REPO,rel)

    def test_cli_read_only_check_and_strict_failure_from_other_cwd(self):
        script=str(audit.REPO/'docs/knowledge-model/p2_d5_review.py')
        with tempfile.TemporaryDirectory() as d:
            for option,code in [('--check',0),('--strict-d5',1)]:
                p=subprocess.run([sys.executable,script,option],cwd=d,capture_output=True,text=True)
                self.assertEqual(p.returncode,code,p.stderr)
                self.assertFalse(json.loads(p.stdout)['d5']['repository']['d5_eligible'])
            p=subprocess.run([sys.executable,script,'--unit','UI-0005'],cwd=d,capture_output=True,text=True)
            self.assertEqual(p.returncode,0,p.stderr)
            self.assertIsNone(json.loads(p.stdout)['review']['probability'])


if __name__=='__main__':
    unittest.main()
