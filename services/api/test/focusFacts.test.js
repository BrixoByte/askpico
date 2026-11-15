import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeGroundedFacts, normalizeFocusFacts, parseFocusReply, renderFocus, withThread } from '../src/threadContext.js';
import { agentPersonas } from '../src/personas.js';
import { buildMemoryBlock, isStyleConstraint } from '../src/memory.js';
import { systemPrompt } from '../src/config.js';
import { applyVerificationSpans, parseVerificationSpans, shouldVerifyReply } from '../src/verify.js';
import { formatRetrievedContext, shouldRecall } from '../src/memory/vectorSearch.js';

test('normalizeFocusFacts keeps the four structured fields and drops empty input', () => {
  const out = JSON.parse(
    normalizeFocusFacts({
      current_goal: 'Launch a salt brand',
      product_focus: 'Iodized table salt',
      pricing_tiers: ['250 g: PKR 280', '1 kg: PKR 1050', ''],
      key_decisions: ['Target 2 pilot markets'],
      extra: 'ignored',
    })
  );
  assert.deepEqual(Object.keys(out), ['current_goal', 'product_focus', 'pricing_tiers', 'key_decisions']);
  assert.deepEqual(out.pricing_tiers, ['250 g: PKR 280', '1 kg: PKR 1050']);
  assert.equal(normalizeFocusFacts({}), '');
  assert.equal(normalizeFocusFacts(null), '');
});

test('parseFocusReply extracts JSON even when the model wraps it in text', () => {
  const reply = 'Here you go:\n```json\n{"current_goal":"Sell salt","pricing_tiers":["500 g: PKR 520"]}\n```';
  const facts = JSON.parse(parseFocusReply(reply));
  assert.equal(facts.current_goal, 'Sell salt');
  assert.deepEqual(facts.pricing_tiers, ['500 g: PKR 520']);
  assert.equal(parseFocusReply('not json at all'), '');
});

test('renderFocus shows structured facts as bullets and passes plain text through', () => {
  const stored = normalizeFocusFacts({
    current_goal: 'Launch a salt brand',
    product_focus: 'Iodized salt',
    pricing_tiers: ['250 g: PKR 280'],
    key_decisions: ['Sell on Daraz first'],
  });
  const rendered = renderFocus(stored);
  assert.match(rendered, /- current_goal: Launch a salt brand/);
  assert.match(rendered, /- pricing_tiers:\n {2}- 250 g: PKR 280/);
  assert.match(rendered, /- key_decisions:\n {2}- Sell on Daraz first/);
  assert.equal(renderFocus('plain note'), 'plain note');
});

test('withThread injects structured facts into the system content on every turn', () => {
  const focus = normalizeFocusFacts({ current_goal: 'Launch salt', pricing_tiers: ['1 kg: PKR 1050'] });
  const out = withThread('base', focus, []);
  assert.match(out, /THREAD FACTS[^\n]*\n- current_goal: Launch salt/);
  assert.match(out, /1 kg: PKR 1050/);
});

test('style constraints from memory become a HARD CONSTRAINT block, facts stay advisory', () => {
  const memories = ['keep replay short max 3 lines.', 'Runs a salt brand in Karachi'];
  assert.equal(isStyleConstraint('keep replay short max 3 lines.'), true);
  assert.equal(isStyleConstraint('Runs a salt brand in Karachi'), false);
  const block = buildMemoryBlock(memories);
  assert.match(block, /\[HARD CONSTRAINT[^\]]*\][^\n]*\n- keep replay short max 3 lines\./);
  assert.match(block, /- Runs a salt brand in Karachi/);
  // Hard constraints lead the block ahead of advisory facts.
  assert.ok(block.indexOf('[HARD CONSTRAINT') < block.indexOf('Runs a salt brand'));
});

test('system prompt contains the cross-thread guardrail, fact guardrail, and narrowed document rule', () => {
  assert.match(systemPrompt, /I don't have access to that past chat\. Could you remind me the details\?/);
  assert.match(systemPrompt, /\[Verify Local Data\]/);
  assert.match(systemPrompt, /Do not name specific suppliers, competitors, or brands unless the user named them/);
  assert.match(systemPrompt, /explicit requests only/);
  assert.match(systemPrompt, /brainstorming, strategy ideas/);
  assert.match(systemPrompt, /CRITICAL RULE: If a budget, financial target/);
  assert.doesNotMatch(systemPrompt, /Food and Drug Authority/);
  assert.match(agentPersonas.business, /CRITICAL RULE: If a budget, financial target/);
});

test('mergeGroundedFacts stores only figures stated by the user and keeps prior verified facts', () => {
  const previous = normalizeFocusFacts({ current_goal: 'Launch salt', key_decisions: ['Sell on Daraz'] });
  const reply = JSON.stringify({
    current_goal: 'Launch salt brand',
    key_decisions: ['Budget 3,500,000 PKR', 'Budget 500,000 PKR'],
    pricing_tiers: ['1 kg: PKR 1050'],
  });
  const { facts, rejected } = mergeGroundedFacts(previous, reply, 'My budget is 500,000 PKR. Launch salt.');
  const out = JSON.parse(facts);
  assert.equal(out.current_goal, 'Launch salt brand');
  assert.deepEqual(out.key_decisions, ['Sell on Daraz', 'Budget 500,000 PKR']);
  assert.deepEqual(out.pricing_tiers, []);
  assert.equal(rejected, 2);
});

test('mergeGroundedFacts falls back to the previous sheet when the reply has no usable facts', () => {
  const previous = normalizeFocusFacts({ current_goal: 'Launch salt', pricing_tiers: ['250 g: PKR 280'] });
  const { facts, rejected } = mergeGroundedFacts(previous, 'not json', 'hello');
  assert.equal(JSON.parse(facts).current_goal, 'Launch salt');
  assert.deepEqual(JSON.parse(facts).pricing_tiers, ['250 g: PKR 280']);
  assert.equal(rejected, 0);
});

test('shouldVerifyReply checks numeric and claim replies and skips code and empty replies', () => {
  assert.equal(shouldVerifyReply('Budget is 3,500,000 PKR'), true);
  assert.equal(shouldVerifyReply('The food authority approves it'), true);
  assert.equal(shouldVerifyReply('```jsx\nconst a = 200;\n```'), false);
  assert.equal(shouldVerifyReply('Hello there'), false);
  assert.equal(shouldVerifyReply(''), false);
});

test('parseVerificationSpans reads ungrounded spans and tolerates bad output', () => {
  assert.deepEqual(
    parseVerificationSpans('sure! ```json {"ungrounded":["3,500,000 PKR","x"]} ```'),
    ['3,500,000 PKR']
  );
  assert.deepEqual(parseVerificationSpans('{"ungrounded":[]}'), []);
  assert.deepEqual(parseVerificationSpans('no json'), []);
});

test('shouldRecall triggers only on past-thread cues in English and Roman Urdu', () => {
  assert.equal(shouldRecall('Pehle jo hum ne micro-mastery discuss kiya tha?'), true);
  assert.equal(shouldRecall('What did we decide in my other chat?'), true);
  assert.equal(shouldRecall('Do you remember my budget?'), true);
  assert.equal(shouldRecall('previous course business pricing'), true);
  assert.equal(shouldRecall('What is the price of salt?'), false);
  assert.equal(shouldRecall('Hello'), false);
  assert.equal(shouldRecall(''), false);
});

test('formatRetrievedContext builds a labeled block and stays empty without matches', () => {
  const block = formatRetrievedContext([
    { chat_id: 'pk-micromastery', content: 'tiered pricing: Basic, Premium', created_at: '2026-10-30T10:00:00Z', similarity: 0.84 },
  ]);
  assert.match(block, /\[RETRIEVED CONTEXT\]/);
  assert.match(block, /thread "pk-micromastery", 2026-10-30 \(match 84%\)/);
  assert.equal(formatRetrievedContext([]), '');
  assert.equal(formatRetrievedContext(null), '');
});

test('memoryRule allows answers from RETRIEVED CONTEXT but keeps the refusal fallback', () => {
  assert.match(systemPrompt, /\[RETRIEVED CONTEXT\]/);
  assert.match(systemPrompt, /don't have access to that past chat/);
});

test('applyVerificationSpans replaces verbatim spans only and collapses duplicates', () => {
  const reply = 'The FDA of Pakistan approves it. Your 500,000 PKR budget and 3,500,000 PKR cost matter.';
  const { corrected, flagged } = applyVerificationSpans(reply, [
    'The FDA of Pakistan',
    '3,500,000 PKR',
    'span not present',
  ]);
  assert.equal(flagged, 2);
  assert.match(corrected, /\[Verify Local Data\] approves it/);
  assert.match(corrected, /and \[Verify Local Data\] cost/);
  assert.match(corrected, /Your 500,000 PKR budget/);
  const { corrected: same, flagged: none } = applyVerificationSpans(reply, []);
  assert.equal(same, reply);
  assert.equal(none, 0);
});
