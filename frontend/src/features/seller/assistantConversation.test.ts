import { describe, expect, it } from 'vitest';
import { interpretWorkflow } from './assistantConversation';

const preparationMessages = [
  'show orders awaiting delivery preparation',
  'delivery preparation baki order',
  'delivery prepare korte hobe',
  'ডেলিভারির প্রস্তুতি বাকি অর্ডার',
  'পুরোনো orders delivery preparation baki',
  'preparation baki ache',
];

describe('delivery-preparation intent', () => {
  it.each(preparationMessages)('recognizes %s locally', message => {
    expect(interpretWorkflow(message)).toEqual(['preparation']);
  });

  it('asks for clarification when preparation is combined with attention', () => {
    expect(interpretWorkflow('delivery preparation baki and attention dorkar')).toEqual(['attention', 'preparation']);
  });

  it('never turns unsupported mutation verbs into a workflow', () => {
    for (const message of ['cancel delivery preparation', 'book delivery preparation order', 'refund preparation']) {
      expect(interpretWorkflow(message)).toEqual([]);
    }
  });
});
