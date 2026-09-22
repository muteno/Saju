"""Context-conditioned logistic hypothesis model; no corpus-frequency training.

The untrained default has null parameters. Expert binary labels target a declared
hypothesis, not cosmic truth. Synthetic demonstration parameters are opt-in and
are not calibrated Saju outcome probabilities. Unknown differs from absent.
"""
import argparse
import copy
import json
import math
from pathlib import Path


class ValidationError(ValueError):
    pass


def _number(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _finite(value, name):
    if not _number(value):
        raise ValidationError(name + ' must remain finite; numeric overflow')
    return value


def _finite_sum(values, name):
    try:
        value = float(sum(values))
    except OverflowError as exc:
        raise ValidationError(name + ' must remain finite; numeric overflow') from exc
    return _finite(value, name)


def context_states(context):
    """Normalize binary or graded observations; None means unknown, not zero."""
    if isinstance(context, dict) and set(context) == {'features'}:
        features = context['features']
        if (not isinstance(features, dict) or any(not isinstance(k, str) or not k.strip() for k in features)
                or any(v is not None and (not _number(v) or not 0 <= v <= 1) for v in features.values())):
            raise ValidationError('features must map names to observed degree [0,1] or null; degree is not probability')
        return dict(features)
    if not isinstance(context, dict) or set(context) - {'present', 'absent', 'unknown'}:
        raise ValidationError('context must contain present/absent/unknown lists OR one features object')
    result = {}
    for state in ('present', 'absent', 'unknown'):
        values = context.get(state, [])
        if not isinstance(values, list) or any(not isinstance(x, str) or not x.strip() for x in values):
            raise ValidationError('context feature names must be nonempty strings')
        for feature in set(values):
            if feature in result:
                raise ValidationError('feature has contradictory states: ' + feature)
            result[feature] = {'present': 1.0, 'absent': 0.0, 'unknown': None}[state]
    return result


def validate_model(model):
    if not isinstance(model, dict) or model.get('hypothesis_mode') not in ('nonexclusive', 'competing'):
        raise ValidationError('hypothesis_mode must explicitly be nonexclusive or competing')
    origin = model.get('parameter_origin', 'untrained')
    if origin not in ('untrained', 'synthetic_illustration', 'expert_label_training'):
        raise ValidationError('parameter_origin must be untrained, synthetic_illustration or expert_label_training')
    claims = model.get('claims')
    if not isinstance(claims, list) or not claims:
        raise ValidationError('claims must be a nonempty list')
    ids = set()
    for claim in claims:
        if not isinstance(claim, dict) or not isinstance(claim.get('id'), str) or claim['id'] in ids:
            raise ValidationError('claim ids must be unique strings')
        ids.add(claim['id'])
        required = claim.get('required_features')
        weights = claim.get('feature_weights')
        if not isinstance(required, list) or any(not isinstance(x, str) or not x for x in required):
            raise ValidationError('required_features must be a list of feature names')
        if len(set(required)) != len(required) or not isinstance(weights, dict):
            raise ValidationError('required features must be unique and feature_weights an object')
        used = set(weights)
        interactions = claim.get('interactions', [])
        if not isinstance(interactions, list):
            raise ValidationError('interactions must be a list')
        names = set()
        for interaction in interactions:
            if not isinstance(interaction, dict) or not isinstance(interaction.get('id'), str) or interaction['id'] in names:
                raise ValidationError('interaction ids must be unique strings')
            names.add(interaction['id'])
            when = interaction.get('when')
            if not isinstance(when, dict) or not when or any(v not in ('present', 'absent') for v in when.values()):
                raise ValidationError('interaction when must contain one or more present/absent conditions')
            used.update(when)
        if not used <= set(required):
            raise ValidationError('all weighted features must be required, so unknown cannot silently mean absent')
        values = [claim.get('bias')] + list(weights.values()) + [x.get('weight') for x in interactions]
        if any(x is not None and not _number(x) for x in values):
            raise ValidationError('parameters must be finite numbers or null')
        if origin == 'untrained' and any(x is not None for x in values):
            raise ValidationError('untrained parameters must be null; numeric parameters require a declared trained or synthetic origin')
    if model['hypothesis_mode'] == 'competing' and len(claims) < 2:
        raise ValidationError('competing requires at least two alternative claims')


def _sigmoid(value):
    _finite(value, 'logit')
    if value >= 0:
        return 1 / (1 + math.exp(-value))
    exp = math.exp(value)
    return exp / (1 + exp)


def _terms(claim, states):
    result = [('bias', 1)]
    result.extend(('feature:' + feature, states[feature])
                  for feature in claim['feature_weights'])
    # Product conjunction accepts arbitrary arity; binary values recover logical AND.
    result.extend(('interaction:' + item['id'], math.prod(states[feature] if state == 'present' else 1 - states[feature]
                  for feature, state in item['when'].items())) for item in claim.get('interactions', []))
    return result


def _parameters(claim):
    return [claim.get('bias')] + list(claim['feature_weights'].values()) + [x.get('weight') for x in claim.get('interactions', [])]


def predict(model, context, *, allow_synthetic=False):
    validate_model(model)
    states = context_states(context)
    synthetic = model.get('parameter_origin') == 'synthetic_illustration'
    output = {'hypothesis_mode': model['hypothesis_mode'], 'parameter_origin': model.get('parameter_origin', 'untrained'),
              'probability_semantics': 'conditional expert-label model output; not calibrated real-world outcome probability',
              'normalization': 'none_each_claim_may_cooccur' if model['hypothesis_mode'] == 'nonexclusive' else 'softmax_over_competing_logits',
              'feature_semantics': 'observed activation degree in [0,1], not an input probability; null is unknown',
              'claims': []}
    for claim in model['claims']:
        item = {'id': claim['id'], 'probability': None}
        parameters = _parameters(claim)
        unknown = [x for x in claim['required_features'] if states.get(x) is None]
        if synthetic and not allow_synthetic:
            item.update(status='synthetic_excluded', explanation='Synthetic parameters require explicit --demo/allow_synthetic.')
        elif any(x is None for x in parameters):
            item.update(status='needs_training')
        elif unknown:
            item.update(status='needs_context', unknown_required_features=unknown)
        else:
            terms = _terms(claim, states)
            contributions = [{'term': name, 'active': active, 'weight': weight, 'contribution': active * weight}
                             for (name, active), weight in zip(terms, parameters)]
            logit = _finite_sum((x['contribution'] for x in contributions), 'logit')
            item.update(status='synthetic_illustration' if synthetic else 'model_estimate_uncalibrated',
                        probability=_sigmoid(logit), logit=logit, contributions=contributions)
        output['claims'].append(item)
    if model['hypothesis_mode'] == 'competing':
        complete = all(x['probability'] is not None for x in output['claims'])
        maximum = max(x['logit'] for x in output['claims']) if complete else None
        total = _finite_sum((math.exp(x['logit'] - maximum) for x in output['claims']), 'softmax total') if complete else None
        for item in output['claims']:
            item['probability'] = math.exp(item['logit'] - maximum) / total if complete else None
            if not complete:
                item['status'] = 'comparison_incomplete'
    return output


def fit(model, dataset, holdout_group, *, epochs=300, learning_rate=0.15, l2=0.001, allow_synthetic=False):
    """Fit BCE logistic parameters from labelled cases, leaving a source group out.

    Training requires two distinct source groups plus a third held-out group.
    Caller-supplied group identities must represent independent provenance, not
    copied pages given new group names. Held-out cases never update parameters.
    """
    validate_model(model)
    if model['hypothesis_mode'] == 'competing':
        raise ValidationError('unsupported: fit supports nonexclusive BCE models only; competing requires a separate multiclass trainer')
    if not isinstance(dataset, list) or not dataset:
        raise ValidationError('dataset must be nonempty expert-labelled cases, not corpus counts')
    if not isinstance(epochs, int) or isinstance(epochs, bool) or epochs < 1 or not _number(learning_rate) or learning_rate <= 0 or not _number(l2) or l2 < 0:
        raise ValidationError('invalid training hyperparameters')
    claim_ids = {x['id'] for x in model['claims']}
    case_ids, groups, origins = set(), set(), set()
    for row in dataset:
        if not isinstance(row, dict) or not isinstance(row.get('case_id'), str) or not row['case_id'] or row['case_id'] in case_ids:
            raise ValidationError('case_id must be unique and nonempty')
        case_ids.add(row['case_id'])
        group = row.get('source_group')
        if not isinstance(group, str) or not group:
            raise ValidationError('every case requires source_group')
        groups.add(group)
        origin = row.get('label_origin')
        if origin not in ('expert', 'synthetic'):
            raise ValidationError('labels must be expert or explicitly synthetic; frequency/pseudo labels are forbidden')
        origins.add(origin)
        labels = row.get('labels')
        label_type = row.get('label_type')
        if label_type not in ('binary', 'soft'):
            raise ValidationError('label_type must explicitly be binary or soft')
        if not isinstance(labels, dict) or set(labels) != claim_ids or any(not _number(v) or not 0 <= v <= 1 for v in labels.values()):
            raise ValidationError('labels must contain a finite [0,1] value for every claim')
        if label_type == 'binary' and any(type(v) is not int or v not in (0, 1) for v in labels.values()):
            raise ValidationError('binary labels must be integer 0/1; graded expert labels require label_type=soft')
        states = context_states(row.get('context'))
        if any(states.get(f) is None for c in model['claims'] for f in c['required_features']):
            raise ValidationError('training case has unknown required context')
    if len(origins) != 1 or ('synthetic' in origins and not allow_synthetic):
        raise ValidationError('synthetic data needs explicit opt-in and cannot mix with expert cases')
    if holdout_group not in groups or len(groups - {holdout_group}) < 2:
        raise ValidationError('hold out one source group and retain at least two distinct training source groups')
    train = [x for x in dataset if x['source_group'] != holdout_group]
    holdout = [x for x in dataset if x['source_group'] == holdout_group]
    fitted = copy.deepcopy(model)
    for claim in fitted['claims']:
        features = [[active for _, active in _terms(claim, context_states(row['context']))] for row in train]
        labels = [row['labels'][claim['id']] for row in train]
        weights = [0.0] * len(features[0])
        for _ in range(epochs):
            gradients = [0.0] * len(weights)
            for vector, label in zip(features, labels):
                error = _sigmoid(_finite_sum((w * x for w, x in zip(weights, vector)), 'training logit')) - label
                for i, value in enumerate(vector):
                    gradients[i] += error * value / len(train)
            weights = [_finite(w - learning_rate * (g + (l2 * w if i else 0)), 'updated parameter')
                       for i, (w, g) in enumerate(zip(weights, gradients))]
        claim['bias'] = weights[0]
        cursor = 1
        for key in claim['feature_weights']:
            claim['feature_weights'][key] = weights[cursor]
            cursor += 1
        for item in claim.get('interactions', []):
            item['weight'] = weights[cursor]
            cursor += 1
    fitted['parameter_origin'] = 'synthetic_illustration' if origins == {'synthetic'} else 'expert_label_training'
    fitted['training_status'] = 'fitted_uncalibrated'
    losses = []
    for row in holdout:
        states = context_states(row['context'])
        for claim in fitted['claims']:
            logit = _finite_sum((weight * active for weight, (_, active) in zip(_parameters(claim), _terms(claim, states))), 'holdout logit')
            y = row['labels'][claim['id']]
            # BCE from logits stays finite without clipping away confident errors.
            loss = ((1 - y) * logit if logit >= 0 else -y * logit) + math.log1p(math.exp(-abs(logit)))
            losses.append(_finite(loss, 'holdout loss'))
    holdout_loss = _finite_sum((loss / len(losses) for loss in losses), 'mean holdout loss')
    fitted['training_report'] = {'objective': 'binary_cross_entropy', 'training_groups': sorted(groups - {holdout_group}),
                                 'holdout_group': holdout_group, 'training_case_ids': [x['case_id'] for x in train],
                                 'holdout_case_ids': [x['case_id'] for x in holdout], 'holdout_binary_cross_entropy': holdout_loss,
                                 'calibrated': False, 'source_groups_verified_by_engine': False,
                                 'note': 'Group separation is enforced; expert identity, label quality and independent provenance still require review.'}
    return fitted


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--demo', action='store_true', help='Explicitly enable invented illustration weights')
    parser.add_argument('--input', type=Path, default=Path(__file__).with_name('context_demo.json'))
    parser.add_argument('--fit', type=Path, help='Expert-labelled dataset JSON; output a fitted model')
    parser.add_argument('--holdout-group')
    args = parser.parse_args()
    try:
        bundle = json.loads(args.input.read_text(encoding='utf-8'))
        if args.fit:
            data = json.loads(args.fit.read_text(encoding='utf-8'))
            result = fit(bundle['untrained_model'], data, args.holdout_group, allow_synthetic=args.demo)
        else:
            model = bundle['synthetic_model'] if args.demo else bundle['untrained_model']
            result = {'warning': bundle['warning'], 'scenarios': [
                {'name': row['name'], 'context': row['context'], 'result': predict(model, row['context'], allow_synthetic=args.demo)}
                for row in bundle['scenarios']]}
    except (ValidationError, OSError, json.JSONDecodeError, KeyError) as exc:
        print(json.dumps({'status': 'validation_error', 'message': str(exc)}, ensure_ascii=False, indent=2))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
