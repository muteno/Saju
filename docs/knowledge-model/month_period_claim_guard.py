"""Current period-audit entry point; retain PR205 historical artifacts unchanged.

This fixes claim/evidence/profile bindings and anchors the reviewed source payload.
The old module remains a reproduction dependency, not the current authoring API.
"""
import argparse
import hashlib
import json
import month_period_review as historical

# Canonical JSON from PR205/main 5afcb70816ceb17c6bec84b0853f7c03e8e0d56c.
# Independent of the input: new source editions need a separately reviewed contract.
REVIEW_CANONICAL_SHA256 = '45c9afe9c78f839f3255c337d9d0aae8f9198e96a849132fcddebdb076ee4c23'

CLAIM_BINDINGS = {'board_scope': [('month_board_scope', 'board_snapshot')],
 'sagong_draft': [('period_sagong_draft', 'sagong'), ('period_sagong_stage_conflict', 'sagong')],
 'wu_conflict': [('month_sagong_wu_table', 'sagong'),
                 ('period_sagong_table', 'sagong'),
                 ('month_choco_period', 'choco')],
 'myo_power_conflict': [('stages_choco_myo_ratio', 'choco'), ('stages_choco_wang_ratio', 'choco')],
 'wu_power_not_days': [('period_choco_wu_ratio', 'choco'), ('month_choco_period', 'choco')],
 'choco_example': [('period_choco_local_times', 'choco'),
                   ('month_choco_stage_conflict', 'choco'),
                   ('month_choco_command', 'choco'),
                   ('period_choco_full_context', 'choco')],
 'sagong_example': [('month_sagong_unverified_dates', 'sagong')],
 'other_positions': [('month_choco_other_positions', 'choco'),
                     ('month_sagong_other_stems', 'sagong'),
                     ('period_sagong_other_table', 'sagong')],
 'sagong_terms': [('month_sagong_dangnyeong', 'sagong'), ('month_sagong_deuknyeong', 'sagong')],
 'mechanical_limit': [('month_choco_not_mechanical', 'choco'), ('month_choco_schools', 'choco')],
 'solstice_asr': [('month_mixed_solstice', 'seokwoodang_asr')]}


def validate(review, repo=historical.REPO):
    historical.validate(review, repo)
    evidence = {e['id']: e for e in review['evidence']}
    claims = review['claims']
    historical.require(len(claims) == len(CLAIM_BINDINGS)
                       and {c['id'] for c in claims} == set(CLAIM_BINDINGS), 'Claim identity changed')
    for claim in claims:
        observed = [(i, evidence[i]['source_profile']) for i in claim['evidence_ids']]
        historical.require(observed == CLAIM_BINDINGS[claim['id']],
                           'Reviewed claim provenance changed: ' + claim['id'])
    canonical = json.dumps(review, sort_keys=True, ensure_ascii=True, allow_nan=False).encode('utf-8')
    historical.require(hashlib.sha256(canonical).hexdigest() == REVIEW_CANONICAL_SHA256,
                       'Reviewed source payload changed')
    return review


def load_review(repo=historical.REPO):
    return validate(json.loads((repo / historical.REVIEW).read_text(encoding='utf-8')), repo)


def compare_offset(review, branch, offset):
    validate(review)
    return historical.compare_offset(review, branch, offset)


def check():
    load_review()
    observed = historical.measure()
    preserved = json.loads((historical.REPO / historical.MEASUREMENT).read_text(encoding='utf-8'))
    historical.require(json.dumps(observed, sort_keys=True, allow_nan=False) ==
                       json.dumps(preserved, sort_keys=True, allow_nan=False),
                       'Historical period measurement changed')
    return dict(contract='month_period_claim_bindings_v2', claims=len(CLAIM_BINDINGS),
                comparison_rows=observed['comparison_rows'], inference_enabled=False,
                use_as_training_labels=False, probability=None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--synthetic-offset')
    parser.add_argument('--branch', choices=list(historical.BRANCHES), default='午')
    args = parser.parse_args()
    result = check() if args.check else compare_offset(load_review(), args.branch, args.synthetic_offset)
    print(json.dumps(result, ensure_ascii=True))


if __name__ == '__main__':
    main()
