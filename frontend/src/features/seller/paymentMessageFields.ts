/** Conservative candidates only; the editable form remains the authority. */
export function paymentMessageFields(message: string) {
  const aliases: Record<string, string> = { বিকাশ: 'bkash', নগদ: 'nagad', রকেট: 'rocket' };
  const providers = [...message.matchAll(/\b(bkash|nagad)\b|বিকাশ|নগদ/gi)]
    .map(match => aliases[match[0]] ?? match[0].toLowerCase());
  const unique = [...new Set(providers)];
  const amounts = [...message.matchAll(/(?:^|\s)([+-]?[০-৯\d]+(?:,[০-৯\d]+)*(?:\.[০-৯\d]+)?)\s*(?:tk\b|taka\b|টাকা)/gi)];
  const identifiers = [...message.matchAll(/(?:\b(?:trx\s*id|txn\s*id|transaction\s*id)\b|ট্রানজেকশন\s*আইডি|আইডি)\s+([^\s]+)/gi)];
  const senders = [...message.matchAll(/(?:\bfrom\b|\bsender(?:\s+number)?\b|প্রেরক(?:ের নম্বর)?)\s+((?:\+?[০-৯\d])[০-৯\d-]+)/gi)];
  return { provider: unique.length === 1 ? unique[0] : undefined,
    amount: amounts[0]?.[1], trxId: identifiers[0]?.[1], sender: senders[0]?.[1],
    multiple: unique.length > 1 || amounts.length > 1 || identifiers.length > 1 || senders.length > 1 };
}
